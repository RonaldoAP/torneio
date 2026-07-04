"use client";

import type { Config, Match, Player, TournamentState } from "./types";
import { isSupabaseConfigured } from "./supabase/client";
import { readLocal, writeLocal, localApi } from "./localStore";
import { generateRoundRobin } from "./roundRobin";
import { computeStandings } from "./standings";
import { seedBracket, recomputeBracket } from "./bracket";

async function callServer(action: string, payload?: any) {
  const res = await fetch("/api/admin/state", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, payload }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error ?? "Falha na operação.");
  return data;
}

// ---------------------------------------------------------------------------
// Implementação LOCAL (localStorage) — espelha a lógica do servidor.
// ---------------------------------------------------------------------------
function localPropagate(state: TournamentState) {
  const updates = recomputeBracket(state.matches);
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

async function localAction(action: string, payload: any) {
  const state = readLocal();
  switch (action) {
    case "set_config":
      state.config = { ...state.config, ...payload };
      break;
    case "add_player":
      if (state.players.length < 12 && String(payload.name).trim()) {
        localApi.addPlayer(String(payload.name).trim());
        return;
      }
      break;
    case "remove_player":
      localApi.removePlayer(payload.id);
      return;
    case "generate_league": {
      state.matches = state.matches.filter(
        (m) => m.stage !== "liga" && m.stage !== "desempate",
      );
      const { games } = generateRoundRobin(state.players);
      for (const g of games) {
        state.matches.push(
          localApi.newMatch({
            stage: "liga",
            round: g.round,
            home_id: g.homeId,
            away_id: g.awayId,
          }),
        );
      }
      state.config = { ...state.config, phase: "liga", bracket_seeded: false };
      break;
    }
    case "save_score": {
      const m = state.matches.find((x) => x.id === payload.id);
      if (m) {
        m.home_goals =
          payload.home_goals === "" || payload.home_goals == null
            ? null
            : Number(payload.home_goals);
        m.away_goals =
          payload.away_goals === "" || payload.away_goals == null
            ? null
            : Number(payload.away_goals);
        m.pen_winner_id = payload.pen_winner_id || null;
        if (["quartas", "semi", "final", "terceiro"].includes(m.stage)) {
          localPropagate(state);
        }
      }
      break;
    }
    case "create_desempate":
      state.matches.push(
        localApi.newMatch({
          stage: "desempate",
          home_id: payload.home_id,
          away_id: payload.away_id,
          counts_for_scorers: false,
        }),
      );
      break;
    case "delete_match":
      state.matches = state.matches.filter((m) => m.id !== payload.id);
      break;
    case "seed_bracket": {
      const standings = computeStandings(state.players, state.matches);
      if (standings.length < 8) throw new Error("São necessários ao menos 8 classificados.");
      const top8 = standings.slice(0, 8).map((r) => r.playerId);
      state.matches = state.matches.filter(
        (m) => !["quartas", "semi", "final", "terceiro"].includes(m.stage),
      );
      for (const seed of seedBracket(top8)) {
        state.matches.push(localApi.newMatch(seed));
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
    case "import_state":
      writeLocal(payload as TournamentState);
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
  removePlayer: (id: string) => adminActions.run("remove_player", { id }),
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
  seedBracket: () => adminActions.run("seed_bracket"),
  closeTournament: () => adminActions.run("close_tournament"),
  reopen: (phase: Config["phase"]) => adminActions.run("reopen", { phase }),
  importState: (state: TournamentState) => adminActions.run("import_state", state),
};
