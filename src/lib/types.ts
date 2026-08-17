export type Stage =
  | "liga"
  | "quartas"
  | "semi"
  | "final"
  | "terceiro"
  | "desempate";

export type Phase = "liga" | "mata_mata" | "encerrado";

export type Slot =
  | "REP_A" // repescagem 4º × 5º
  | "REP_B" // repescagem 3º × 6º
  | "SF_A" // 1º × vencedor(REP_A)
  | "SF_B" // 2º × vencedor(REP_B)
  | "FINAL"
  | "TERCEIRO";

export interface Player {
  id: string;
  name: string;
  created_at: string;
  photo?: string | null; // foto de perfil (data URI ou URL) — opcional
  /** edição a que pertence (1ª, 2ª, ...). Ausente = 1ª edição. */
  edition?: number | null;
}

export interface Match {
  id: string;
  stage: Stage;
  round: number | null;
  home_id: string | null;
  away_id: string | null;
  home_goals: number | null;
  away_goals: number | null;
  pen_winner_id: string | null;
  counts_for_scorers: boolean;
  slot: Slot | null;
  created_at: string;
  /** edição a que pertence (1ª, 2ª, ...). Ausente = 1ª edição. */
  edition?: number | null;
}

export interface Config {
  id: number;
  tournament_name: string;
  phase: Phase;
  bracket_seeded: boolean;
  /** edição em cartaz — é a que o site mostra. Ausente = 1ª edição. */
  current_edition?: number | null;
}

/** Metadados de uma edição do torneio (uma linha por edição). */
export interface Edition {
  id: number; // 1, 2, 3...
  name: string; // "Copa Costela"
  event_date: string | null; // "18 de julho"
  event_time: string | null; // "10h"
  event_local: string | null; // "Casa do Léo"
  event_note: string | null; // recado do sorteio/W.O.
  created_at: string;
  /** preenchido quando a edição é arquivada (uma nova começa) */
  closed_at: string | null;
}

export interface StandingRow {
  playerId: string;
  name: string;
  played: number; // J
  wins: number; // V
  draws: number; // E
  losses: number; // D
  goalsFor: number; // GP
  goalsAgainst: number; // GC
  goalDiff: number; // SG
  points: number; // P
  /** true quando este jogador está empatado com outro em critérios que afetam o Top 6 */
  unresolvedTie?: boolean;
}

export interface ScorerRow {
  playerId: string;
  name: string;
  goals: number;
  games: number; // jogos que contam
}

export interface TournamentState {
  config: Config;
  players: Player[];
  matches: Match[];
  /** presente nos backups/estados que já conhecem edições */
  editions?: Edition[];
}
