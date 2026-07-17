import { describe, it, expect } from "vitest";
import { generateBalancedLeague } from "../drawConstraints";

const NAMES = [
  "Ronaldo",
  "Allan",
  "Léo",
  "Riquelme",
  "Mosquito",
  "Gui",
  "Jhon",
  "Luis",
  "Vinicius",
  "André",
];

function players(names: string[]) {
  return names.map((name, i) => ({ id: `p${i}`, name }));
}

function roundOf(games: { round: number; homeId: string; awayId: string }[], a: string, b: string) {
  const g = games.find(
    (x) => (x.homeId === a && x.awayId === b) || (x.homeId === b && x.awayId === a),
  )!;
  return g.round;
}

describe("generateBalancedLeague (restrições ocultas)", () => {
  it("respeita as janelas de rodada em 20 sorteios seguidos (10 jogadores)", () => {
    const ps = players(NAMES);
    const id = (n: string) => ps.find((p) => p.name === n)!.id;
    for (let t = 0; t < 20; t++) {
      const { games } = generateBalancedLeague(ps);
      const R = games.reduce((m, g) => Math.max(m, g.round), 0);
      expect(R).toBe(9);
      // cada dupla se enfrenta uma vez (round-robin válido)
      expect(games.length).toBe(45);

      const ronLeo = roundOf(games, id("Ronaldo"), id("Léo"));
      const ronRiq = roundOf(games, id("Ronaldo"), id("Riquelme"));
      const riqLeo = roundOf(games, id("Riquelme"), id("Léo"));

      expect(ronLeo).toBeGreaterThanOrEqual(R - 2); // 7,8,9
      expect(ronRiq).toBeGreaterThanOrEqual(R - 2); // 7,8,9
      expect(riqLeo).toBeLessThanOrEqual(3); // 1,2,3
    }
  });

  it("funciona mesmo com nome sem acento (Leo) ou minúsculo", () => {
    const ps = players(["ronaldo", "leo", "riquelme", "a", "b", "c"]);
    const id = (n: string) => ps.find((p) => p.name === n)!.id;
    const { games } = generateBalancedLeague(ps);
    const R = games.reduce((m, g) => Math.max(m, g.round), 0);
    expect(roundOf(games, id("riquelme"), id("leo"))).toBeLessThanOrEqual(3);
    expect(roundOf(games, id("ronaldo"), id("leo"))).toBeGreaterThanOrEqual(R - 2);
    expect(roundOf(games, id("ronaldo"), id("riquelme"))).toBeGreaterThanOrEqual(R - 2);
  });

  it("ignora restrições quando os jogadores não estão no torneio", () => {
    const ps = players(["X", "Y", "Z", "W"]);
    const { games } = generateBalancedLeague(ps);
    expect(games.length).toBe(6); // C(4,2), sem travar
  });
});
