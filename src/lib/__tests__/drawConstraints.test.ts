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

describe("generateBalancedLeague", () => {
  it("gera um round-robin válido em 20 sorteios seguidos (10 jogadores)", () => {
    const ps = players(NAMES);
    for (let t = 0; t < 20; t++) {
      const { games } = generateBalancedLeague(ps);
      const R = games.reduce((m, g) => Math.max(m, g.round), 0);
      expect(R).toBe(9);
      // cada dupla se enfrenta uma vez
      expect(games.length).toBe(45);
      const pares = new Set(games.map((g) => [g.homeId, g.awayId].sort().join("|")));
      expect(pares.size).toBe(45);
      // ninguém joga duas vezes na mesma rodada
      for (let r = 1; r <= R; r++) {
        const daRodada = games.filter((g) => g.round === r);
        const gente = new Set(daRodada.flatMap((g) => [g.homeId, g.awayId]));
        expect(gente.size).toBe(daRodada.length * 2);
      }
    }
  });

  it("funciona com número ímpar de jogadores (alguém folga por rodada)", () => {
    const { games } = generateBalancedLeague(players(["a", "b", "c", "d", "e"]));
    expect(games.length).toBe(10); // C(5,2)
  });

  it("não trava com poucos jogadores", () => {
    const { games } = generateBalancedLeague(players(["X", "Y", "Z", "W"]));
    expect(games.length).toBe(6); // C(4,2)
  });

  // Não existe mais nenhuma restrição oculta: nenhum confronto fica preso a uma
  // janela de rodadas. Em 60 sorteios, cada um destes pares tem que aparecer
  // pelo menos uma vez cedo E pelo menos uma vez tarde — se um deles ficar
  // sempre do mesmo lado, é porque voltou regra em drawConstraints.ts.
  it("sorteia livre: nenhum par preso ao começo ou ao fim da tabela", () => {
    const ps = players(NAMES);
    const id = (n: string) => ps.find((p) => p.name === n)!.id;
    const pares: [string, string][] = [
      ["Ronaldo", "Léo"],
      ["Ronaldo", "Riquelme"],
      ["Riquelme", "Léo"],
    ];
    const visto = pares.map(() => ({ cedo: false, tarde: false }));

    for (let t = 0; t < 60; t++) {
      const { games } = generateBalancedLeague(ps);
      const R = games.reduce((m, g) => Math.max(m, g.round), 0);
      pares.forEach(([a, b], i) => {
        const r = roundOf(games, id(a), id(b));
        if (r <= 3) visto[i].cedo = true;
        if (r >= R - 2) visto[i].tarde = true;
      });
    }

    pares.forEach(([a, b], i) => {
      expect(visto[i], `${a} x ${b} caiu nas 3 primeiras rodadas alguma vez`).toHaveProperty(
        "cedo",
        true,
      );
      expect(visto[i], `${a} x ${b} caiu nas 3 últimas rodadas alguma vez`).toHaveProperty(
        "tarde",
        true,
      );
    });
  });
});
