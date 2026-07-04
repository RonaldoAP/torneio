export type Stage =
  | "liga"
  | "quartas"
  | "semi"
  | "final"
  | "terceiro"
  | "desempate";

export type Phase = "liga" | "mata_mata" | "encerrado";

export type Slot =
  | "QF1"
  | "QF2"
  | "QF3"
  | "QF4"
  | "SF_A"
  | "SF_B"
  | "FINAL"
  | "TERCEIRO";

export interface Player {
  id: string;
  name: string;
  created_at: string;
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
}

export interface Config {
  id: number;
  tournament_name: string;
  phase: Phase;
  bracket_seeded: boolean;
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
  /** true quando este jogador está empatado com outro em critérios que afetam o Top 8 */
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
}
