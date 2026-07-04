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
