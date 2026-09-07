import { describe, it, expect } from "vitest";
import { seedBracket, recomputeBracket, championAndRunnerUp, thirdPlace } from "../bracket";
import { computeDefense, computeScorers } from "../scorers";
import type { Match, Player } from "../types";

const top6 = ["s1", "s2", "s3", "s4", "s5", "s6"];

function asMatches(seeds: Array<Partial<Match>>): Match[] {
  return seeds.map((s, i) => ({
    id: `m${i}`,
    stage: s.stage!,
    round: null,
    home_id: s.home_id ?? null,
    away_id: s.away_id ?? null,
    home_goals: s.home_goals ?? null,
    away_goals: s.away_goals ?? null,
    pen_winner_id: s.pen_winner_id ?? null,
    counts_for_scorers: s.counts_for_scorers ?? true,
    slot: s.slot ?? null,
    created_at: "2026-01-01",
  }));
}

describe("seedBracket (Alternativa B — Top 6)", () => {
  it("semeia repescagem 4x5 e 3x6, com 1º e 2º já na semi", () => {
    const b = seedBracket(top6);
    const bySlot = Object.fromEntries(b.map((m) => [m.slot, m]));
    expect([bySlot.REP_A.home_id, bySlot.REP_A.away_id]).toEqual(["s4", "s5"]);
    expect([bySlot.REP_B.home_id, bySlot.REP_B.away_id]).toEqual(["s3", "s6"]);
    // 1º e 2º já colocados como mandantes das semis; adversário definido depois
    expect([bySlot.SF_A.home_id, bySlot.SF_A.away_id]).toEqual(["s1", null]);
    expect([bySlot.SF_B.home_id, bySlot.SF_B.away_id]).toEqual(["s2", null]);
  });

  it("exige exatamente 6 classificados", () => {
    expect(() => seedBracket(["a", "b"])).toThrow();
    expect(() => seedBracket(["a", "b", "c", "d", "e", "f", "g", "h"])).toThrow();
  });
});

describe("recomputeBracket (Alternativa B)", () => {
  it("leva o vencedor da repescagem para a semi do 1º/2º (sem trocar o mandante)", () => {
    const matches = asMatches(seedBracket(top6));
    const set = (slot: string, hg: number, ag: number) => {
      const m = matches.find((x) => x.slot === slot)!;
      m.home_goals = hg;
      m.away_goals = ag;
    };
    set("REP_A", 1, 3); // s5 vence (4º×5º)
    set("REP_B", 2, 0); // s3 vence (3º×6º)

    const updates = recomputeBracket(matches);
    const sfa = updates.find((u) => u.id === matches.find((m) => m.slot === "SF_A")!.id)!;
    const sfb = updates.find((u) => u.id === matches.find((m) => m.slot === "SF_B")!.id)!;
    expect([sfa.home_id, sfa.away_id]).toEqual(["s1", "s5"]); // 1º × venc(REP_A)
    expect([sfb.home_id, sfb.away_id]).toEqual(["s2", "s3"]); // 2º × venc(REP_B)
  });

  it("preenche final (vencedores) e terceiro (perdedores) das semis", () => {
    const matches = asMatches(seedBracket(top6));
    const apply = (updates: ReturnType<typeof recomputeBracket>) => {
      for (const u of updates) {
        const m = matches.find((x) => x.id === u.id)!;
        m.home_id = u.home_id;
        m.away_id = u.away_id;
      }
    };
    const set = (slot: string, hg: number, ag: number, pen?: string) => {
      const m = matches.find((x) => x.slot === slot)!;
      m.home_goals = hg;
      m.away_goals = ag;
      if (pen) m.pen_winner_id = pen;
    };
    set("REP_A", 1, 0); // s4 vence
    set("REP_B", 1, 0); // s3 vence
    apply(recomputeBracket(matches)); // SF_A = s1 × s4, SF_B = s2 × s3
    set("SF_A", 2, 1); // s1 vence, s4 perde
    set("SF_B", 0, 0, "s2"); // s2 vence nos pênaltis, s3 perde
    apply(recomputeBracket(matches));

    const finalM = matches.find((m) => m.slot === "FINAL")!;
    const terceiroM = matches.find((m) => m.slot === "TERCEIRO")!;
    expect([finalM.home_id, finalM.away_id]).toEqual(["s1", "s2"]);
    expect([terceiroM.home_id, terceiroM.away_id]).toEqual(["s4", "s3"]);

    set("FINAL", 3, 1); // s1 campeão
    set("TERCEIRO", 2, 0); // s4 em 3º
    expect(championAndRunnerUp(matches)).toEqual({ championId: "s1", runnerUpId: "s2" });
    expect(thirdPlace(matches)).toBe("s4");
  });
});

describe("computeScorers", () => {
  const players: Player[] = ["a", "b", "c"].map((id) => ({
    id,
    name: id.toUpperCase(),
    created_at: "2026-01-01",
  }));

  it("soma gols de liga e mata-mata, ignora desempate", () => {
    const matches = asMatches([
      { stage: "liga", home_id: "a", away_id: "b", home_goals: 3, away_goals: 1 },
      { stage: "final", home_id: "a", away_id: "c", home_goals: 2, away_goals: 2, pen_winner_id: "a" },
      { stage: "desempate", home_id: "a", away_id: "b", home_goals: 5, away_goals: 0, counts_for_scorers: false },
    ]);
    const table = computeScorers(players, matches);
    const a = table.find((r) => r.playerId === "a")!;
    expect(a.goals).toBe(5); // 3 (liga) + 2 (final); desempate ignorado
    expect(a.games).toBe(2);
    expect(a.conceded).toBe(3); // 1 (liga) + 2 (final)
    expect(a.goalDiff).toBe(2);
    expect(table[0].playerId).toBe("a");
  });

  it("empate na artilharia: leva o melhor saldo", () => {
    const matches = asMatches([
      // A e C fazem 4 gols cada; A sofreu 1, C sofreu 3
      { stage: "liga", home_id: "a", away_id: "b", home_goals: 4, away_goals: 1 },
      { stage: "liga", home_id: "c", away_id: "b", home_goals: 4, away_goals: 3 },
    ]);
    const table = computeScorers(players, matches);
    expect(table[0].name).toBe("A"); // 4 gols, saldo +3
    expect(table[0].goalDiff).toBe(3);
    expect(table[1].name).toBe("C"); // 4 gols, saldo +1
    expect(table[1].goalDiff).toBe(1);
  });

  it("saldo igual: cai no critério antigo (menos jogos)", () => {
    const matches = asMatches([
      // A: 3 gols e 1 sofrido em 1 jogo → +2
      { stage: "liga", home_id: "a", away_id: "b", home_goals: 3, away_goals: 1 },
      // C: 3 gols e 1 sofrido em 2 jogos → também +2
      { stage: "liga", home_id: "c", away_id: "b", home_goals: 2, away_goals: 0 },
      { stage: "liga", home_id: "c", away_id: "b", home_goals: 1, away_goals: 1 },
    ]);
    const table = computeScorers(players, matches);
    expect([table[0].goalDiff, table[1].goalDiff]).toEqual([2, 2]);
    expect(table[0].name).toBe("A"); // mesmo saldo, mas em 1 jogo só
    expect(table[1].name).toBe("C");
  });
});

// ---------------------------------------------------------------------------
// Melhor defesa (medalha da 2ª edição): quem sofreu menos gols.
// Segue a MESMA regra da artilharia — sem W.O. e sem desempate.
// ---------------------------------------------------------------------------
describe("melhor defesa", () => {
  const players: Player[] = [
    { id: "a", name: "Ana", created_at: "" },
    { id: "b", name: "Bia", created_at: "" },
    { id: "c", name: "Caio", created_at: "" },
    { id: "d", name: "Duda", created_at: "" },
  ];

  const jogo = (p: Partial<Match>): Match => ({
    id: p.id ?? "m",
    stage: p.stage ?? "liga",
    round: p.round ?? 1,
    home_id: p.home_id ?? null,
    away_id: p.away_id ?? null,
    home_goals: p.home_goals ?? null,
    away_goals: p.away_goals ?? null,
    pen_winner_id: p.pen_winner_id ?? null,
    counts_for_scorers: p.counts_for_scorers ?? true,
    slot: p.slot ?? null,
    created_at: "",
  });

  it("ordena por menos gols sofridos e conta jogos sem sofrer", () => {
    const matches = [
      jogo({ id: "1", home_id: "a", away_id: "b", home_goals: 2, away_goals: 0 }),
      jogo({ id: "2", home_id: "a", away_id: "c", home_goals: 1, away_goals: 1 }),
      jogo({ id: "3", home_id: "b", away_id: "c", home_goals: 0, away_goals: 4 }),
    ];
    const d = computeDefense(players, matches);
    // Ana e Caio sofreram 1; o saldo desempata: Caio +4 (5 feitos) contra
    // Ana +2 (3 feitos). Bia sofreu 6.
    expect(d.map((r) => [r.name, r.conceded])).toEqual([
      ["Caio", 1],
      ["Ana", 1],
      ["Bia", 6],
    ]);
    expect(d.find((r) => r.name === "Ana")!.cleanSheets).toBe(1);
    expect(d.find((r) => r.name === "Bia")!.cleanSheets).toBe(0);
  });

  it("não conta gols de W.O. nem de desempate", () => {
    const matches = [
      jogo({ id: "1", home_id: "a", away_id: "b", home_goals: 0, away_goals: 1 }),
      // W.O. contra a Ana: 3 gols que ninguém fez nela
      jogo({
        id: "2",
        home_id: "a",
        away_id: "c",
        home_goals: 0,
        away_goals: 3,
        counts_for_scorers: false,
      }),
      // desempate também fica de fora
      jogo({ id: "3", stage: "desempate", home_id: "a", away_id: "d", home_goals: 0, away_goals: 5 }),
    ];
    const ana = computeDefense(players, matches).find((r) => r.name === "Ana")!;
    expect(ana.conceded).toBe(1);
    expect(ana.games).toBe(1);
  });

  it("quem ainda não jogou fica fora do ranking", () => {
    const d = computeDefense(players, [
      jogo({ id: "1", home_id: "a", away_id: "b", home_goals: 1, away_goals: 1 }),
    ]);
    expect(d.map((r) => r.name).sort()).toEqual(["Ana", "Bia"]);
  });

  it("empate nos gols sofridos: leva o melhor saldo", () => {
    const matches = [
      // Ana: 4 feitos, 2 sofridos → saldo +2
      jogo({ id: "1", home_id: "a", away_id: "c", home_goals: 4, away_goals: 2 }),
      // Bia: 9 feitos, 2 sofridos → saldo +7
      jogo({ id: "2", home_id: "b", away_id: "d", home_goals: 9, away_goals: 2 }),
    ];
    const d = computeDefense(players, matches);
    expect(d[0].name).toBe("Bia"); // mesmo 2 sofridos, saldo maior
    expect(d[0].goalDiff).toBe(7);
    expect(d[1].name).toBe("Ana");
    expect(d[1].goalDiff).toBe(2);
  });

  it("o saldo do desempate também ignora W.O. e partida de desempate", () => {
    const matches = [
      jogo({ id: "1", home_id: "a", away_id: "b", home_goals: 3, away_goals: 1 }),
      // goleada por W.O.: não pode inflar o saldo da Ana
      jogo({
        id: "2",
        home_id: "a",
        away_id: "c",
        home_goals: 3,
        away_goals: 0,
        counts_for_scorers: false,
      }),
      jogo({ id: "3", stage: "desempate", home_id: "a", away_id: "d", home_goals: 7, away_goals: 0 }),
    ];
    const ana = computeDefense(players, matches).find((r) => r.name === "Ana")!;
    expect(ana.goalsFor).toBe(3);
    expect(ana.conceded).toBe(1);
    expect(ana.goalDiff).toBe(2);
  });
});
