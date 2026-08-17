import { describe, it, expect } from "vitest";
import { computeStandings, matchWinner, matchLoser } from "../standings";
import type { Match, Player } from "../types";

function player(id: string, name: string): Player {
  return { id, name, created_at: "2026-01-01" };
}

let mid = 0;
function ligaMatch(home: string, away: string, hg: number, ag: number): Match {
  return {
    id: `m${mid++}`,
    stage: "liga",
    round: 1,
    home_id: home,
    away_id: away,
    home_goals: hg,
    away_goals: ag,
    pen_winner_id: null,
    counts_for_scorers: true,
    slot: null,
    created_at: "2026-01-01",
  };
}

describe("computeStandings", () => {
  it("aplica pontos, saldo e gols corretamente", () => {
    const players = [player("a", "Ana"), player("b", "Bia"), player("c", "Caio")];
    const matches = [
      ligaMatch("a", "b", 3, 0), // Ana vence
      ligaMatch("a", "c", 1, 1), // empate
      ligaMatch("b", "c", 0, 2), // Caio vence
    ];
    const table = computeStandings(players, matches);
    const ana = table.find((r) => r.playerId === "a")!;
    const bia = table.find((r) => r.playerId === "b")!;
    const caio = table.find((r) => r.playerId === "c")!;

    expect(ana.points).toBe(4); // V + E
    expect(caio.points).toBe(4); // V + E
    expect(bia.points).toBe(0);
    expect(ana.goalDiff).toBe(3); // 4-1
    expect(caio.goalDiff).toBe(2); // 3-1

    // Ana e Caio empatados em pontos; Ana tem saldo melhor -> 1º
    expect(table[0].playerId).toBe("a");
    expect(table[1].playerId).toBe("c");
    expect(table[2].playerId).toBe("b");
  });

  it("desempata por confronto direto quando pontos/saldo/gols iguais", () => {
    const players = [player("a", "Ana"), player("b", "Bia")];
    // Mesmo saldo e gols, mas Ana venceu o confronto direto
    const matches = [ligaMatch("a", "b", 2, 1)];
    const table = computeStandings(players, matches);
    expect(table[0].playerId).toBe("a");
  });

  it("desempata por partida de desempate quando confronto direto foi empate", () => {
    const players = [player("a", "Ana"), player("b", "Bia")];
    const draw = ligaMatch("a", "b", 1, 1);
    const desempate: Match = {
      id: "d1",
      stage: "desempate",
      round: null,
      home_id: "a",
      away_id: "b",
      home_goals: 0,
      away_goals: 0,
      pen_winner_id: "b", // Bia venceu nos pênaltis do desempate
      counts_for_scorers: false,
      slot: null,
      created_at: "2026-01-01",
    };
    const table = computeStandings(players, [draw, desempate]);
    expect(table[0].playerId).toBe("b");
  });
});

describe("matchWinner/matchLoser", () => {
  it("define vencedor pelo placar", () => {
    const m = ligaMatch("a", "b", 2, 1);
    expect(matchWinner(m)).toBe("a");
    expect(matchLoser(m)).toBe("b");
  });
  it("usa pênaltis no empate", () => {
    const m: Match = { ...ligaMatch("a", "b", 1, 1), stage: "final", pen_winner_id: "b" };
    expect(matchWinner(m)).toBe("b");
    expect(matchLoser(m)).toBe("a");
  });
  it("retorna null se não jogado", () => {
    const m: Match = { ...ligaMatch("a", "b", 0, 0), home_goals: null, away_goals: null };
    expect(matchWinner(m)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// O ⚠ de empate só aparece quando a liga acabou — antes disso ele marcava a
// tabela inteira (no começo todo mundo empata em 0) sem servir para nada.
// ---------------------------------------------------------------------------
describe("aviso de empate no corte do Top 6", () => {
  const nomes = ["A", "B", "C", "D", "E", "F", "G"];
  const players: Player[] = nomes.map((n) => ({ id: n, name: n, created_at: "" }));

  /** Liga completa (todos contra todos) com todos os jogos em 0×0 — empate geral. */
  function ligaZerada(comPlacar: boolean): Match[] {
    const ms: Match[] = [];
    let i = 0;
    for (let a = 0; a < nomes.length; a++) {
      for (let b = a + 1; b < nomes.length; b++) {
        ms.push({
          id: `m${i++}`,
          stage: "liga",
          round: 1,
          home_id: nomes[a],
          away_id: nomes[b],
          home_goals: comPlacar ? 0 : null,
          away_goals: comPlacar ? 0 : null,
          pen_winner_id: null,
          counts_for_scorers: true,
          slot: null,
          created_at: "",
        });
      }
    }
    return ms;
  }

  it("não marca ninguém antes de a liga terminar", () => {
    const semJogo = computeStandings(players, []);
    expect(semJogo.some((r) => r.unresolvedTie)).toBe(false);

    const sorteadaSemPlacar = computeStandings(players, ligaZerada(false));
    expect(sorteadaSemPlacar.some((r) => r.unresolvedTie)).toBe(false);
  });

  it("marca quando a liga acabou empatada em cima da linha do Top 6", () => {
    const fim = computeStandings(players, ligaZerada(true));
    expect(fim.filter((r) => r.unresolvedTie).length).toBeGreaterThanOrEqual(2);
  });
});
