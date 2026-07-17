import type { Player } from "./types";

export interface RoundRobinGame {
  round: number;
  homeId: string;
  awayId: string;
}

export interface RoundRobinResult {
  games: RoundRobinGame[];
  /** playerId que folga em cada rodada (round -> playerId | null) */
  byes: Record<number, string | null>;
}

/** Embaralha uma cópia do array (Fisher-Yates). Usado para dar aleatoriedade
 *  ao sorteio — cada sorteio produz uma tabela diferente. */
export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Reordena os jogos DENTRO de cada rodada para dar descanso aos jogadores na
 * sequência real de disputa (a lista é jogada de cima pra baixo, inclusive
 * virando a rodada). Regra: um jogador não deve jogar no(s) jogo(s)
 * imediatamente seguinte(s) ao seu — de preferência com 2 jogos de folga; se
 * não der, pelo menos 1 (nunca dois jogos seguidos).
 *
 * Só mexe na ordem interna das rodadas — os números de rodada e os confrontos
 * (round-robin) ficam intactos, então quaisquer restrições por rodada seguem
 * valendo. Usa uma heurística gulosa: a cada passo escolhe, entre os jogos
 * restantes da rodada, aquele cujos dois jogadores estão há mais tempo sem
 * jogar (maximiza o menor intervalo). Empates são desempatados ao acaso, para
 * o sorteio continuar aleatório.
 */
export function orderForRest(games: RoundRobinGame[]): RoundRobinGame[] {
  const byRound = new Map<number, RoundRobinGame[]>();
  for (const g of games) {
    if (!byRound.has(g.round)) byRound.set(g.round, []);
    byRound.get(g.round)!.push(g);
  }

  const result: RoundRobinGame[] = [];
  const lastIdx = new Map<string, number>(); // último índice (na sequência) em que o jogador jogou
  let idx = 0;

  for (const round of [...byRound.keys()].sort((a, b) => a - b)) {
    const pool = byRound.get(round)!;
    while (pool.length > 0) {
      let bestK = 0;
      let bestScore = -Infinity;
      let bestTie = -Infinity;
      for (let k = 0; k < pool.length; k++) {
        const g = pool[k];
        const gapH = lastIdx.has(g.homeId) ? idx - lastIdx.get(g.homeId)! : Infinity;
        const gapA = lastIdx.has(g.awayId) ? idx - lastIdx.get(g.awayId)! : Infinity;
        const score = Math.min(gapH, gapA); // pior (menor) intervalo dos dois jogadores
        const tie = Math.random();
        if (score > bestScore || (score === bestScore && tie > bestTie)) {
          bestScore = score;
          bestTie = tie;
          bestK = k;
        }
      }
      const [g] = pool.splice(bestK, 1);
      result.push(g);
      lastIdx.set(g.homeId, idx);
      lastIdx.set(g.awayId, idx);
      idx++;
    }
  }

  return result;
}

/**
 * Gera os confrontos da liga (turno único, todos contra todos) usando o
 * método do círculo (circle / round-robin). Se o nº de jogadores for ímpar,
 * adiciona um "BYE" fictício — o adversário do BYE folga naquela rodada.
 *
 * Garante: cada dupla se enfrenta exatamente uma vez e cada jogador aparece
 * no máximo uma vez por rodada.
 */
export function generateRoundRobin(players: Pick<Player, "id">[]): RoundRobinResult {
  const ids = players.map((p) => p.id);
  const games: RoundRobinGame[] = [];
  const byes: Record<number, string | null> = {};

  if (ids.length < 2) {
    return { games, byes };
  }

  // Trabalha com uma cópia; adiciona BYE se ímpar.
  const BYE = "__BYE__";
  const list = [...ids];
  const odd = list.length % 2 === 1;
  if (odd) list.push(BYE);

  const n = list.length; // par
  const rounds = n - 1;
  const half = n / 2;

  // Método do círculo: o primeiro elemento fica fixo, os demais rodam.
  const arr = [...list];

  for (let r = 0; r < rounds; r++) {
    const round = r + 1;
    byes[round] = null;

    for (let i = 0; i < half; i++) {
      const a = arr[i];
      const b = arr[n - 1 - i];

      if (a === BYE || b === BYE) {
        byes[round] = a === BYE ? b : a;
        continue;
      }

      // Alterna mando de campo para distribuir home/away de forma justa.
      // Em rodadas pares invertemos o par que envolve o elemento fixo.
      if (i === 0 && r % 2 === 1) {
        games.push({ round, homeId: b, awayId: a });
      } else {
        games.push({ round, homeId: a, awayId: b });
      }
    }

    // Rotação: mantém arr[0] fixo, rotaciona o resto no sentido horário.
    const last = arr[n - 1];
    for (let i = n - 1; i > 1; i--) {
      arr[i] = arr[i - 1];
    }
    arr[1] = last;
  }

  return { games, byes };
}
