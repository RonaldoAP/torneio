import type { Match, Player } from "./types";

// ============================================================================
//  DESISTÊNCIA (W.O.) — a marca fica no participante, não só nos jogos.
//  Marcando `withdrawn`, qualquer partida dele — inclusive as que só ganham
//  adversário depois (uma semifinal que ainda dependia da repescagem) — já
//  nasce 3×0 para o outro lado, sem precisar registrar a desistência de novo.
// ============================================================================

export const WO_GOALS = 3;

export interface WalkoverPatch {
  id: string;
  home_goals: number;
  away_goals: number;
  pen_winner_id: null;
  counts_for_scorers: false;
}

/**
 * Placar que uma partida deve ter, dado quem desistiu — ou null quando a
 * partida não envolve ninguém que desistiu.
 * Os dois desistiram? 0×0: não há vitória a distribuir.
 */
function woScore(homeOut: boolean, awayOut: boolean): [number, number] | null {
  if (homeOut && awayOut) return [0, 0];
  if (homeOut) return [0, WO_GOALS];
  if (awayOut) return [WO_GOALS, 0];
  return null;
}

/**
 * Partidas que precisam virar (ou voltar a ser) W.O. por causa de quem
 * desistiu. Devolve só o que está diferente do que já está gravado, então é
 * seguro rodar a cada gravação — na maioria das vezes devolve lista vazia.
 * Partidas de desempate nunca entram.
 */
export function walkoverUpdates(players: Player[], matches: Match[]): WalkoverPatch[] {
  const desistiu = new Set(players.filter((p) => p.withdrawn).map((p) => p.id));
  if (desistiu.size === 0) return [];

  const patches: WalkoverPatch[] = [];
  for (const m of matches) {
    if (m.stage === "desempate") continue;
    if (!m.home_id || !m.away_id) continue;
    const score = woScore(desistiu.has(m.home_id), desistiu.has(m.away_id));
    if (!score) continue;
    const [h, a] = score;
    const jaEsta =
      m.home_goals === h && m.away_goals === a && !m.pen_winner_id && !m.counts_for_scorers;
    if (jaEsta) continue;
    patches.push({
      id: m.id,
      home_goals: h,
      away_goals: a,
      pen_winner_id: null,
      counts_for_scorers: false,
    });
  }
  return patches;
}

/** Aplica os patches numa lista de partidas em memória (modo local). */
export function applyWalkovers(players: Player[], matches: Match[]): boolean {
  const patches = walkoverUpdates(players, matches);
  for (const p of patches) {
    const m = matches.find((x) => x.id === p.id);
    if (!m) continue;
    m.home_goals = p.home_goals;
    m.away_goals = p.away_goals;
    m.pen_winner_id = null;
    m.counts_for_scorers = false;
  }
  return patches.length > 0;
}
