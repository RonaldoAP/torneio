import type { Player } from "./types";
import {
  generateRoundRobin,
  orderForRest,
  shuffle,
  type RoundRobinResult,
  type RoundRobinGame,
} from "./roundRobin";

// ============================================================================
//  Restrições INVISÍVEIS do sorteio (equilíbrio de confrontos).
//  Isto vive só na lógica do sorteio — NUNCA é exibido na plataforma.
//  Identifica os jogadores por NOME (ignora acento/maiúsculas), então funciona
//  tanto no modo local (seeds) quanto no Supabase (nomes cadastrados no admin).
// ============================================================================

type Window = "first3" | "last3";

interface RawConstraint {
  a: string;
  b: string;
  window: Window; // first3 = rodadas 1..3 · last3 = 3 últimas rodadas
}

const CONSTRAINTS: RawConstraint[] = [
  { a: "Riquelme", b: "Léo", window: "first3" }, // Riquelme pega Léo até a 3ª rodada
];

function norm(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, ""); // remove acentos
}

function idByName(players: Pick<Player, "id" | "name">[], name: string): string | null {
  const n = norm(name);
  const p = players.find((x) => norm(x.name) === n);
  return p ? p.id : null;
}

function roundOfPair(games: RoundRobinGame[], aId: string, bId: string): number | null {
  const g = games.find(
    (x) => (x.homeId === aId && x.awayId === bId) || (x.homeId === bId && x.awayId === aId),
  );
  return g ? g.round : null;
}

function totalRounds(games: RoundRobinGame[]): number {
  return games.reduce((m, g) => Math.max(m, g.round), 0);
}

interface ResolvedConstraint {
  aId: string;
  bId: string;
  window: Window;
}

function satisfies(result: RoundRobinResult, resolved: ResolvedConstraint[]): boolean {
  const R = totalRounds(result.games);
  for (const c of resolved) {
    const r = roundOfPair(result.games, c.aId, c.bId);
    if (r == null) continue; // par não existe neste torneio → ignora
    if (c.window === "first3" && !(r <= 3)) return false;
    if (c.window === "last3" && !(r >= R - 2)) return false;
  }
  return true;
}

/**
 * Sorteio "equilibrado": embaralha e gera a tabela normalmente, mas repete até
 * cair numa que respeite as restrições invisíveis. Se (num caso extremo) não
 * achar dentro do limite, devolve o último sorteio — o sorteio nunca falha.
 */
export function generateBalancedLeague(
  players: Pick<Player, "id" | "name">[],
  maxAttempts = 50000,
): RoundRobinResult {
  const resolved: ResolvedConstraint[] = CONSTRAINTS.map((c) => ({
    aId: idByName(players, c.a) ?? "",
    bId: idByName(players, c.b) ?? "",
    window: c.window,
  })).filter((c) => c.aId && c.bId && c.aId !== c.bId);

  // Aplica o descanso (ordem interna das rodadas) só no fim, sem afetar as
  // restrições — elas dependem do nº da rodada, que não muda.
  const withRest = (r: RoundRobinResult): RoundRobinResult => ({
    ...r,
    games: orderForRest(r.games),
  });

  let last = generateRoundRobin(shuffle(players));
  if (resolved.length === 0) return withRest(last);

  for (let i = 0; i < maxAttempts; i++) {
    const cand = generateRoundRobin(shuffle(players));
    if (satisfies(cand, resolved)) return withRest(cand);
    last = cand;
  }
  return withRest(last);
}
