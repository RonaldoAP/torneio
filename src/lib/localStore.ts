"use client";

import type { Config, Match, Player, TournamentState } from "./types";

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

function emptyState(): TournamentState {
  return {
    config: {
      id: 1,
      tournament_name: "Torneio FIFA 26",
      phase: "liga",
      bracket_seeded: false,
    },
    players: [],
    matches: [],
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
      if (s.players.length >= 12) return;
      s.players.push({ id: uuid(), name, created_at: new Date().toISOString() });
    });
  },
  removePlayer(id: string) {
    mutate((s) => {
      s.players = s.players.filter((p) => p.id !== id);
      s.matches = s.matches.filter((m) => m.home_id !== id && m.away_id !== id);
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
  newMatch(partial: Partial<Match>): Match {
    return {
      id: uuid(),
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
