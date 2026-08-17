"use client";

import type { Config, Edition, Match, Player, TournamentState } from "./types";
import { EVENT } from "./config";
import { FIRST_EDITION, editionOf, removalBlockedMessage } from "./editions";

// ----------------------------------------------------------------------------
// Modo LOCAL (sem backend): estado em localStorage, um dispositivo só.
// Usado como fallback quando o Supabase não está configurado.
// "Realtime" é simulado via evento na própria aba + storage event entre abas.
// ----------------------------------------------------------------------------

const KEY = "torneio_fifa26_state";
export const LOCAL_EVENT = "torneio-local-change";

function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return "id-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// Jogadores já confirmados — semeados no estado inicial para que todos vejam
// ao abrir o site (modo local). O admin pode adicionar/remover à vontade.
const SEED_PLAYERS: Player[] = [
  { id: "seed-ronaldo", name: "Ronaldo", created_at: "2026-01-01T00:00:00.000Z", edition: 1 },
  { id: "seed-allan", name: "Allan", created_at: "2026-01-01T00:00:01.000Z", edition: 1 },
  { id: "seed-leo", name: "Léo", created_at: "2026-01-01T00:00:02.000Z", edition: 1 },
  { id: "seed-riquelme", name: "Riquelme", created_at: "2026-01-01T00:00:03.000Z", edition: 1 },
  { id: "seed-mosquito", name: "Mosquito", created_at: "2026-01-01T00:00:04.000Z", edition: 1 },
  { id: "seed-gui", name: "Gui", created_at: "2026-01-01T00:00:05.000Z", edition: 1 },
  { id: "seed-jhon", name: "Jhon", created_at: "2026-01-01T00:00:06.000Z", edition: 1 },
  { id: "seed-luis", name: "Luis", created_at: "2026-01-01T00:00:07.000Z", edition: 1 },
  { id: "seed-vinicius", name: "Vinicius", created_at: "2026-01-01T00:00:08.000Z", edition: 1 },
  { id: "seed-andre", name: "André", created_at: "2026-01-01T00:00:09.000Z", edition: 1 },
];

const SEED_EDITIONS: Edition[] = [
  {
    id: FIRST_EDITION,
    name: "Copa Costela",
    event_date: EVENT.date,
    event_time: EVENT.time,
    event_local: EVENT.local,
    event_note: EVENT.note,
    created_at: "2026-01-01T00:00:00.000Z",
    closed_at: null,
  },
];

// Sobe a versão quando a lista de confirmados muda, para atualizar até quem
// já abriu o site antes (desde que a liga ainda não tenha começado).
export const SEED_VERSION = 3;
const SEED_VERSION_KEY = "torneio_seed_version";

/** Atualiza os confirmados em dispositivos que já têm estado salvo, sem apagar
 *  um torneio em andamento (só re-semeia se ainda não há partidas). */
export function migrateSeed() {
  if (typeof window === "undefined") return;
  if (window.localStorage.getItem(SEED_VERSION_KEY) === String(SEED_VERSION)) return;
  const s = readLocal();
  const cur = currentEdition(s);
  // Só re-semeia a 1ª edição e só enquanto ela não tiver jogos — edições
  // seguintes têm a lista própria montada no painel e não podem ser mexidas.
  if (cur === FIRST_EDITION && s.matches.every((m) => editionOf(m) !== cur)) {
    s.players = [
      ...s.players.filter((p) => editionOf(p) !== cur),
      ...SEED_PLAYERS.map((p) => ({ ...p })),
    ];
    writeLocal(s);
  }
  window.localStorage.setItem(SEED_VERSION_KEY, String(SEED_VERSION));
}

/** Edição em cartaz no estado local. */
export function currentEdition(state: TournamentState): number {
  return state.config.current_edition ?? FIRST_EDITION;
}

function emptyState(): TournamentState {
  return {
    config: {
      id: 1,
      tournament_name: "Copa Costela",
      phase: "liga",
      bracket_seeded: false,
      current_edition: FIRST_EDITION,
    },
    players: SEED_PLAYERS.map((p) => ({ ...p })),
    matches: [],
    editions: SEED_EDITIONS.map((e) => ({ ...e })),
  };
}

export function readLocal(): TournamentState {
  if (typeof window === "undefined") return emptyState();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw) as TournamentState;
    return {
      config: { ...emptyState().config, ...parsed.config },
      players: parsed.players ?? [],
      matches: parsed.matches ?? [],
      editions: parsed.editions?.length ? parsed.editions : SEED_EDITIONS.map((e) => ({ ...e })),
    };
  } catch {
    return emptyState();
  }
}

export function writeLocal(state: TournamentState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(state));
  window.dispatchEvent(new CustomEvent(LOCAL_EVENT));
}

/** Apaga tudo e volta ao estado inicial (só faz sentido no modo local). */
export function resetLocal() {
  writeLocal(emptyState());
}

function mutate(fn: (s: TournamentState) => void) {
  const s = readLocal();
  fn(s);
  writeLocal(s);
}

// ---- Operações (espelham a API do admin) ----
export const localApi = {
  setConfig(patch: Partial<Config>) {
    mutate((s) => {
      s.config = { ...s.config, ...patch };
    });
  },
  addPlayer(name: string) {
    mutate((s) => {
      const cur = currentEdition(s);
      if (s.players.filter((p) => editionOf(p) === cur).length >= 12) return;
      s.players.push({ id: uuid(), name, created_at: new Date().toISOString(), edition: cur });
    });
  },
  /** Remove o participante E os jogos dele. Com jogos na mesa exige `force`. */
  removePlayer(id: string, force = false) {
    const state = readLocal();
    const cur = currentEdition(state);
    const mine = state.matches.filter((m) => editionOf(m) === cur);
    if (!force) {
      const blocked = removalBlockedMessage(
        mine,
        id,
        state.players.find((p) => p.id === id)?.name,
      );
      if (blocked) throw new Error(blocked);
    }
    mutate((s) => {
      s.players = s.players.filter((p) => p.id !== id);
      s.matches = s.matches.filter(
        (m) => editionOf(m) !== cur || (m.home_id !== id && m.away_id !== id),
      );
    });
  },
  setMatches(matches: Match[]) {
    mutate((s) => {
      s.matches = matches;
    });
  },
  upsertMatch(match: Match) {
    mutate((s) => {
      const i = s.matches.findIndex((m) => m.id === match.id);
      if (i >= 0) s.matches[i] = match;
      else s.matches.push(match);
    });
  },
  updateMatch(id: string, patch: Partial<Match>) {
    mutate((s) => {
      const i = s.matches.findIndex((m) => m.id === id);
      if (i >= 0) s.matches[i] = { ...s.matches[i], ...patch };
    });
  },
  newPlayer(partial: { name: string; photo?: string | null; edition?: number }): Player {
    return {
      id: uuid(),
      name: partial.name,
      photo: partial.photo ?? null,
      created_at: new Date().toISOString(),
      edition: partial.edition ?? FIRST_EDITION,
    };
  },
  newMatch(partial: Partial<Match>, edition = FIRST_EDITION): Match {
    return {
      id: uuid(),
      edition: partial.edition ?? edition,
      stage: partial.stage ?? "liga",
      round: partial.round ?? null,
      home_id: partial.home_id ?? null,
      away_id: partial.away_id ?? null,
      home_goals: partial.home_goals ?? null,
      away_goals: partial.away_goals ?? null,
      pen_winner_id: partial.pen_winner_id ?? null,
      counts_for_scorers: partial.counts_for_scorers ?? true,
      slot: partial.slot ?? null,
      created_at: new Date().toISOString(),
    };
  },
  replaceAll(state: TournamentState) {
    writeLocal(state);
  },
};
