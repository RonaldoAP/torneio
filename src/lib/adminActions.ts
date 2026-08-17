"use client";

import type { Config, Edition, Match, TournamentState } from "./types";
import { isSupabaseConfigured } from "./supabase/client";
import { readLocal, writeLocal, resetLocal, localApi, currentEdition } from "./localStore";
import { generateBalancedLeague } from "./drawConstraints";
import { computeStandings } from "./standings";
import { seedBracket, recomputeBracket } from "./bracket";
import { editionOf, forEdition, makeEdition, nextEditionId } from "./editions";

// Slug secreto do admin — enviado em cada gravação (o servidor autoriza por ele).
let adminSlug = "";
export function setAdminSlug(s: string) {
  adminSlug = s;
}

async function callServer(action: string, payload?: any) {
  const res = await fetch("/api/admin/state", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-admin-slug": adminSlug },
    body: JSON.stringify({ action, payload }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error ?? "Falha na operação.");
  return data;
}

// ---------------------------------------------------------------------------
// Implementação LOCAL (localStorage) — espelha a lógica do servidor.
// ---------------------------------------------------------------------------
function localPropagate(state: TournamentState, edition: number) {
  // Só a chave da edição em cartaz — cada edição tem seus próprios slots.
  const updates = recomputeBracket(forEdition(state.matches, edition));
  for (const u of updates) {
    const m = state.matches.find((x) => x.id === u.id);
    if (!m) continue;
    m.home_id = u.home_id;
    m.away_id = u.away_id;
    if (u.clearScore) {
      m.home_goals = null;
      m.away_goals = null;
      m.pen_winner_id = null;
    }
  }
}

/** Troca as partidas da edição em cartaz preservando as das edições arquivadas. */
function replaceEditionMatches(state: TournamentState, edition: number, next: Match[]) {
  state.matches = [...state.matches.filter((m) => editionOf(m) !== edition), ...next];
}

async function localAction(action: string, payload: any) {
  const state = readLocal();
  const cur = currentEdition(state);
  const myPlayers = forEdition(state.players, cur);
  const myMatches = forEdition(state.matches, cur);
  switch (action) {
    case "set_config":
      state.config = { ...state.config, ...payload };
      // O nome do torneio é o nome da edição em cartaz — mantém os dois iguais.
      if (payload?.tournament_name) {
        state.editions = (state.editions ?? []).map((e) =>
          e.id === cur ? { ...e, name: payload.tournament_name } : e,
        );
      }
      break;
    case "add_player":
      if (myPlayers.length < 12 && String(payload.name).trim()) {
        localApi.addPlayer(String(payload.name).trim());
        return;
      }
      break;
    case "remove_player":
      localApi.removePlayer(payload.id, payload?.force === true);
      return;
    case "set_photo": {
      const p = state.players.find((x) => x.id === payload.id);
      if (p) p.photo = payload.photo ?? null;
      break;
    }
    case "reset_scores": {
      // Zera todos os placares (mantém confrontos e chave), depois reverte a propagação.
      for (const m of myMatches) {
        m.home_goals = null;
        m.away_goals = null;
        m.pen_winner_id = null;
      }
      localPropagate(state, cur);
      break;
    }
    case "generate_league": {
      replaceEditionMatches(
        state,
        cur,
        myMatches.filter((m) => m.stage !== "liga" && m.stage !== "desempate"),
      );
      const { games } = generateBalancedLeague(myPlayers);
      for (const g of games) {
        state.matches.push(
          localApi.newMatch(
            {
              stage: "liga",
              round: g.round,
              home_id: g.homeId,
              away_id: g.awayId,
            },
            cur,
          ),
        );
      }
      state.config = { ...state.config, phase: "liga", bracket_seeded: false };
      break;
    }
    case "save_score": {
      const m = state.matches.find((x) => x.id === payload.id);
      if (m) {
        const clampGoal = (v: unknown) =>
          v === "" || v == null ? null : Math.max(0, Math.floor(Number(v) || 0));
        m.home_goals = clampGoal(payload.home_goals);
        m.away_goals = clampGoal(payload.away_goals);
        m.pen_winner_id = payload.pen_winner_id || null;
        if (["quartas", "semi", "final", "terceiro"].includes(m.stage)) {
          localPropagate(state, editionOf(m));
        }
      }
      break;
    }
    case "create_desempate":
      state.matches.push(
        localApi.newMatch(
          {
            stage: "desempate",
            home_id: payload.home_id,
            away_id: payload.away_id,
            counts_for_scorers: false,
          },
          cur,
        ),
      );
      break;
    case "delete_match":
      state.matches = state.matches.filter((m) => m.id !== payload.id);
      break;
    case "withdraw": {
      // Desistência = W.O. 3×0 para todos os adversários (jogos feitos e a fazer).
      const pid = payload.id as string;
      for (const m of myMatches) {
        if (m.stage === "desempate") continue;
        const isHome = m.home_id === pid;
        const isAway = m.away_id === pid;
        if (!isHome && !isAway) continue;
        if (!m.home_id || !m.away_id) continue;
        if (isHome) {
          m.home_goals = 0;
          m.away_goals = 3;
        } else {
          m.home_goals = 3;
          m.away_goals = 0;
        }
        m.pen_winner_id = null;
        m.counts_for_scorers = false; // gols de W.O. não contam para artilharia
      }
      localPropagate(state, cur); // mata-mata: adversário avança
      break;
    }
    case "seed_bracket": {
      const standings = computeStandings(myPlayers, myMatches);
      if (standings.length < 6) throw new Error("São necessários ao menos 6 classificados.");
      if (standings.some((r) => r.unresolvedTie)) {
        throw new Error(
          "Há empate no corte do Top 6. Crie e resolva a partida de desempate antes de montar o mata-mata.",
        );
      }
      const top6 = standings.slice(0, 6).map((r) => r.playerId);
      replaceEditionMatches(
        state,
        cur,
        myMatches.filter((m) => !["quartas", "semi", "final", "terceiro"].includes(m.stage)),
      );
      for (const seed of seedBracket(top6)) {
        state.matches.push(localApi.newMatch(seed, cur));
      }
      state.config = { ...state.config, phase: "mata_mata", bracket_seeded: true };
      break;
    }
    case "close_tournament":
      state.config = { ...state.config, phase: "encerrado" };
      break;
    case "reopen":
      state.config = { ...state.config, phase: payload?.phase ?? "mata_mata" };
      break;

    case "set_edition_meta": {
      const patch = payload as Partial<Edition>;
      state.editions = (state.editions ?? []).map((e) =>
        e.id === cur
          ? {
              ...e,
              name: patch.name ?? e.name,
              event_date: patch.event_date ?? e.event_date,
              event_time: patch.event_time ?? e.event_time,
              event_local: patch.event_local ?? e.event_local,
              event_note: patch.event_note ?? e.event_note,
            }
          : e,
      );
      if (patch.name) state.config = { ...state.config, tournament_name: patch.name };
      break;
    }

    case "new_edition": {
      // Arquiva a edição em cartaz (ela vira histórico) e abre a próxima, zerada.
      const editions = state.editions ?? [];
      const id = nextEditionId(editions);
      const name = String(payload?.name ?? "").trim() || state.config.tournament_name;
      const now = new Date().toISOString();
      state.editions = [
        ...editions.map((e) => (e.id === cur ? { ...e, closed_at: e.closed_at ?? now } : e)),
        makeEdition(id, name),
      ];
      if (payload?.copy_players) {
        // Mesma turma, participantes novos: ids próprios da edição (assim
        // remover alguém aqui nunca encosta no histórico).
        for (const p of myPlayers) {
          state.players.push(localApi.newPlayer({ name: p.name, photo: p.photo, edition: id }));
        }
      }
      state.config = {
        ...state.config,
        tournament_name: name,
        phase: "liga",
        bracket_seeded: false,
        current_edition: id,
      };
      break;
    }

    case "discard_edition": {
      // Desfaz a abertura de uma edição — só enquanto ela não tiver jogos.
      const editions = state.editions ?? [];
      const prev = editions.filter((e) => e.id < cur).sort((a, b) => b.id - a.id)[0];
      if (!prev) throw new Error("Não há edição anterior para voltar.");
      if (myMatches.length > 0) {
        throw new Error(
          "Esta edição já tem jogos sorteados. Descartá-la apagaria partidas — se é isso mesmo, apague os jogos antes.",
        );
      }
      state.editions = editions
        .filter((e) => e.id !== cur)
        .map((e) => (e.id === prev.id ? { ...e, closed_at: null } : e));
      state.players = state.players.filter((p) => editionOf(p) !== cur);
      const prevMatches = forEdition(state.matches, prev.id);
      const hadBracket = prevMatches.some((m) =>
        ["quartas", "semi", "final", "terceiro"].includes(m.stage),
      );
      state.config = {
        ...state.config,
        tournament_name: prev.name,
        current_edition: prev.id,
        phase: hadBracket ? "mata_mata" : "liga",
        bracket_seeded: hadBracket,
      };
      break;
    }

    case "import_state": {
      const incoming = payload as TournamentState;
      // Backup completo (traz edições) restaura tudo; backup de uma edição só
      // (o caso do Desfazer) restaura apenas a edição em cartaz.
      if (incoming.editions?.length) {
        writeLocal(incoming);
        return;
      }
      writeLocal({
        config: { ...state.config, ...(incoming.config ?? {}), current_edition: cur },
        players: [
          ...state.players.filter((p) => editionOf(p) !== cur),
          ...(incoming.players ?? []).map((p) => ({ ...p, edition: cur })),
        ],
        matches: [
          ...state.matches.filter((m) => editionOf(m) !== cur),
          ...(incoming.matches ?? []).map((m) => ({ ...m, edition: cur })),
        ],
        editions: state.editions,
      });
      return;
    }
    case "reset_local":
      resetLocal();
      return;
    default:
      throw new Error("Ação desconhecida.");
  }
  writeLocal(state);
}

// ---------------------------------------------------------------------------
// API pública usada pela UI de admin.
// ---------------------------------------------------------------------------
export const adminActions = {
  isLocal: () => !isSupabaseConfigured,

  async run(action: string, payload?: any) {
    if (isSupabaseConfigured) return callServer(action, payload);
    return localAction(action, payload ?? {});
  },

  setConfig: (patch: Partial<Config>) => adminActions.run("set_config", patch),
  addPlayer: (name: string) => adminActions.run("add_player", { name }),
  /** `force` só depois de confirmar: remover apaga também os jogos do participante. */
  removePlayer: (id: string, force = false) => adminActions.run("remove_player", { id, force }),
  setPhoto: (id: string, photo: string | null) => adminActions.run("set_photo", { id, photo }),
  generateLeague: () => adminActions.run("generate_league"),
  saveScore: (p: {
    id: string;
    home_goals: number | string | null;
    away_goals: number | string | null;
    pen_winner_id?: string | null;
  }) => adminActions.run("save_score", p),
  createDesempate: (home_id: string, away_id: string) =>
    adminActions.run("create_desempate", { home_id, away_id }),
  deleteMatch: (id: string) => adminActions.run("delete_match", { id }),
  withdraw: (id: string) => adminActions.run("withdraw", { id }),
  seedBracket: () => adminActions.run("seed_bracket"),
  resetScores: () => adminActions.run("reset_scores"),
  closeTournament: () => adminActions.run("close_tournament"),
  reopen: (phase: Config["phase"]) => adminActions.run("reopen", { phase }),
  /** Data/hora/local/nome da edição em cartaz (aparece no regulamento e no telão). */
  setEditionMeta: (patch: Partial<Edition>) => adminActions.run("set_edition_meta", patch),
  /** Arquiva a edição atual no histórico e abre a próxima, zerada. */
  newEdition: (opts: { name?: string; copy_players?: boolean }) =>
    adminActions.run("new_edition", opts),
  /** Desfaz a abertura de uma edição ainda sem jogos e volta para a anterior. */
  discardEdition: () => adminActions.run("discard_edition"),
  importState: (state: TournamentState) => adminActions.run("import_state", state),
  /** Só no modo local: apaga tudo e recomeça. */
  resetLocal: () => adminActions.run("reset_local"),
};
