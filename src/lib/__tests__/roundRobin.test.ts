import { describe, it, expect } from "vitest";
import { generateRoundRobin } from "../roundRobin";

function makePlayers(n: number) {
  return Array.from({ length: n }, (_, i) => ({ id: `p${i + 1}` }));
}

function validate(n: number) {
  const players = makePlayers(n);
  const { games, byes } = generateRoundRobin(players);
  const ids = players.map((p) => p.id);

  // 1) cada dupla se enfrenta exatamente uma vez
  const pairSeen = new Map<string, number>();
  for (const g of games) {
    const key = [g.homeId, g.awayId].sort().join("|");
    pairSeen.set(key, (pairSeen.get(key) ?? 0) + 1);
  }
  const expectedPairs = (n * (n - 1)) / 2;
  expect(pairSeen.size).toBe(expectedPairs);
  for (const [, count] of pairSeen) expect(count).toBe(1);
  expect(games.length).toBe(expectedPairs);

  // 2) nenhum jogador aparece 2x na mesma rodada
  const byRound = new Map<number, Set<string>>();
  for (const g of games) {
    const set = byRound.get(g.round) ?? new Set<string>();
    expect(set.has(g.homeId)).toBe(false);
    expect(set.has(g.awayId)).toBe(false);
    set.add(g.homeId);
    set.add(g.awayId);
    byRound.set(g.round, set);
  }

  // 3) nº de rodadas: n-1 (par) ou n (ímpar)
  const rounds = new Set(games.map((g) => g.round));
  const expectedRounds = n % 2 === 0 ? n - 1 : n;
  expect(rounds.size).toBe(expectedRounds);

  // 4) se ímpar, exatamente 1 folga por rodada e cada jogador folga 1x
  if (n % 2 === 1) {
    const byeCounts = new Map<string, number>();
    for (const r of rounds) {
      const bye = byes[r];
      expect(bye).toBeTruthy();
      byeCounts.set(bye!, (byeCounts.get(bye!) ?? 0) + 1);
    }
    expect(byeCounts.size).toBe(n);
    for (const id of ids) expect(byeCounts.get(id)).toBe(1);
  } else {
    for (const r of rounds) expect(byes[r]).toBeNull();
  }
}

describe("generateRoundRobin", () => {
  it("gera tabela válida para 10 jogadores", () => validate(10));
  it("gera tabela válida para 11 jogadores (ímpar, com folgas)", () => validate(11));
  it("gera tabela válida para 12 jogadores", () => validate(12));

  it("cobre de 2 a 12 jogadores", () => {
    for (let n = 2; n <= 12; n++) validate(n);
  });

  it("retorna vazio com menos de 2 jogadores", () => {
    expect(generateRoundRobin([]).games).toHaveLength(0);
    expect(generateRoundRobin([{ id: "x" }]).games).toHaveLength(0);
  });
});
