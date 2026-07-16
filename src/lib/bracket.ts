import type { Match, Slot, Stage } from "./types";
import { matchWinner, matchLoser } from "./standings";

/** Definição da estrutura do chaveamento a partir do Top 6 (seeds 1..6). */
export interface SeedPair {
  slot: Slot;
  stage: Stage;
  // seeds (1-based); null nos slots que se preenchem depois
  homeSeed: number | null;
  awaySeed: number | null;
}

/**
 * Alternativa B — classificam 6; 1º e 2º vão direto à semifinal.
 *  Repescagem: REP_A = 4º×5º · REP_B = 3º×6º
 *  Semifinais: SF_A = 1º × venc(REP_A) · SF_B = 2º × venc(REP_B)
 *  Final = venc(SF_A) × venc(SF_B)
 *  3º lugar = perd(SF_A) × perd(SF_B)
 * O 1º e o 2º só podem se enfrentar na final.
 */
export const BRACKET_TEMPLATE: SeedPair[] = [
  { slot: "REP_A", stage: "quartas", homeSeed: 4, awaySeed: 5 },
  { slot: "REP_B", stage: "quartas", homeSeed: 3, awaySeed: 6 },
  { slot: "SF_A", stage: "semi", homeSeed: 1, awaySeed: null }, // away = venc(REP_A)
  { slot: "SF_B", stage: "semi", homeSeed: 2, awaySeed: null }, // away = venc(REP_B)
  { slot: "FINAL", stage: "final", homeSeed: null, awaySeed: null },
  { slot: "TERCEIRO", stage: "terceiro", homeSeed: null, awaySeed: null },
];

/**
 * Monta as 6 partidas do mata-mata a partir dos ids do Top 6 (ordenados 1..6).
 * Retorna objetos prontos para inserir em `matches`.
 */
export function seedBracket(top6: string[]): Array<Partial<Match>> {
  if (top6.length !== 6) {
    throw new Error("São necessários exatamente 6 classificados para montar o mata-mata.");
  }
  const seedTo = (n: number | null) => (n == null ? null : top6[n - 1]);

  return BRACKET_TEMPLATE.map((t) => ({
    stage: t.stage,
    round: null,
    slot: t.slot,
    home_id: seedTo(t.homeSeed),
    away_id: seedTo(t.awaySeed),
    home_goals: null,
    away_goals: null,
    pen_winner_id: null,
    counts_for_scorers: true,
  }));
}

export interface BracketUpdate {
  id: string;
  home_id: string | null;
  away_id: string | null;
  /** true quando a mudança de participantes invalida um placar já lançado */
  clearScore: boolean;
}

/**
 * Recalcula os participantes das fases seguintes a partir dos resultados anteriores.
 *   SF_A: mantém 1º (home), away = venc(REP_A)
 *   SF_B: mantém 2º (home), away = venc(REP_B)
 *   FINAL = venc(SF_A) × venc(SF_B)
 *   TERCEIRO = perd(SF_A) × perd(SF_B)
 */
export function recomputeBracket(matches: Match[]): BracketUpdate[] {
  const bySlot = new Map<string, Match>();
  for (const m of matches) if (m.slot) bySlot.set(m.slot, m);

  const winnerOf = (slot: Slot) => {
    const m = bySlot.get(slot);
    return m ? matchWinner(m) : null;
  };
  const loserOf = (slot: Slot) => {
    const m = bySlot.get(slot);
    return m ? matchLoser(m) : null;
  };

  const desired: Record<string, { home: string | null; away: string | null }> = {
    // 1º e 2º (home) são fixos — só o adversário (venc. da repescagem) muda.
    SF_A: { home: bySlot.get("SF_A")?.home_id ?? null, away: winnerOf("REP_A") },
    SF_B: { home: bySlot.get("SF_B")?.home_id ?? null, away: winnerOf("REP_B") },
    FINAL: { home: winnerOf("SF_A"), away: winnerOf("SF_B") },
    TERCEIRO: { home: loserOf("SF_A"), away: loserOf("SF_B") },
  };

  const updates: BracketUpdate[] = [];
  for (const slot of ["SF_A", "SF_B", "FINAL", "TERCEIRO"] as Slot[]) {
    const m = bySlot.get(slot);
    if (!m) continue;
    const want = desired[slot];
    if (m.home_id !== want.home || m.away_id !== want.away) {
      const hadScore = m.home_goals != null || m.away_goals != null || m.pen_winner_id != null;
      updates.push({
        id: m.id,
        home_id: want.home,
        away_id: want.away,
        clearScore: hadScore,
      });
    }
  }
  return updates;
}

export const CHAMPION_SLOT: Slot = "FINAL";

/** Campeão e vice a partir da final concluída. */
export function championAndRunnerUp(matches: Match[]): {
  championId: string | null;
  runnerUpId: string | null;
} {
  const finalM = matches.find((m) => m.slot === "FINAL");
  if (!finalM) return { championId: null, runnerUpId: null };
  const championId = matchWinner(finalM);
  const runnerUpId = matchLoser(finalM);
  return { championId, runnerUpId };
}

/** 3º colocado a partir da disputa de terceiro concluída. */
export function thirdPlace(matches: Match[]): string | null {
  const m = matches.find((mm) => mm.slot === "TERCEIRO");
  return m ? matchWinner(m) : null;
}
