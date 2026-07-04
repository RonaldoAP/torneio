import type { Match, Slot, Stage } from "./types";
import { matchWinner, matchLoser } from "./standings";

/** Definição da estrutura do chaveamento a partir do Top 8 (seeds 1..8). */
export interface SeedPair {
  slot: Slot;
  stage: Stage;
  // seeds (1-based) para as quartas; null nos slots que se preenchem depois
  homeSeed: number | null;
  awaySeed: number | null;
}

/**
 * Semeadura mantendo 1º e 2º em lados opostos (só se cruzam na final):
 *  Chave A: QF1 = 1×8, QF2 = 4×5  -> SF_A
 *  Chave B: QF3 = 2×7, QF4 = 3×6  -> SF_B
 *  FINAL = venc(SF_A) x venc(SF_B)
 *  TERCEIRO = perd(SF_A) x perd(SF_B)
 */
export const BRACKET_TEMPLATE: SeedPair[] = [
  { slot: "QF1", stage: "quartas", homeSeed: 1, awaySeed: 8 },
  { slot: "QF2", stage: "quartas", homeSeed: 4, awaySeed: 5 },
  { slot: "QF3", stage: "quartas", homeSeed: 2, awaySeed: 7 },
  { slot: "QF4", stage: "quartas", homeSeed: 3, awaySeed: 6 },
  { slot: "SF_A", stage: "semi", homeSeed: null, awaySeed: null },
  { slot: "SF_B", stage: "semi", homeSeed: null, awaySeed: null },
  { slot: "FINAL", stage: "final", homeSeed: null, awaySeed: null },
  { slot: "TERCEIRO", stage: "terceiro", homeSeed: null, awaySeed: null },
];

/**
 * Monta as 8 partidas do mata-mata a partir dos ids do Top 8 (ordenados 1..8).
 * Retorna objetos prontos para inserir em `matches`.
 */
export function seedBracket(top8: string[]): Array<Partial<Match>> {
  if (top8.length !== 8) {
    throw new Error("São necessários exatamente 8 classificados para montar o mata-mata.");
  }
  const seedTo = (n: number | null) => (n == null ? null : top8[n - 1]);

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
 * Recalcula os participantes de SF_A/SF_B/FINAL/TERCEIRO a partir dos resultados
 * das rodadas anteriores. Retorna somente os updates necessários.
 *
 * Regras de propagação:
 *   SF_A = venc(QF1) x venc(QF2)
 *   SF_B = venc(QF3) x venc(QF4)
 *   FINAL = venc(SF_A) x venc(SF_B)
 *   TERCEIRO = perd(SF_A) x perd(SF_B)
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
    SF_A: { home: winnerOf("QF1"), away: winnerOf("QF2") },
    SF_B: { home: winnerOf("QF3"), away: winnerOf("QF4") },
    FINAL: { home: winnerOf("SF_A"), away: winnerOf("SF_B") },
    TERCEIRO: { home: loserOf("SF_A"), away: loserOf("SF_B") },
  };

  const updates: BracketUpdate[] = [];
  for (const slot of ["SF_A", "SF_B", "FINAL", "TERCEIRO"] as Slot[]) {
    const m = bySlot.get(slot);
    if (!m) continue;
    const want = desired[slot];
    if (m.home_id !== want.home || m.away_id !== want.away) {
      // Se um participante mudou e já havia placar lançado, o placar é zerado.
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
