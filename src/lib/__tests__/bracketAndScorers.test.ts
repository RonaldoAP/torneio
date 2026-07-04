import { describe, it, expect } from "vitest";
import { seedBracket, recomputeBracket, championAndRunnerUp, thirdPlace } from "../bracket";
import { computeScorers } from "../scorers";
import type { Match, Player } from "../types";

const top8 = ["s1", "s2", "s3", "s4", "s5", "s6", "s7", "s8"];

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

describe("seedBracket", () => {
  it("semeia 1x8, 4x5, 2x7, 3x6", () => {
    const b = seedBracket(top8);
    const bySlot = Object.fromEntries(b.map((m) => [m.slot, m]));
    expect([bySlot.QF1.home_id, bySlot.QF1.away_id]).toEqual(["s1", "s8"]);
    expect([bySlot.QF2.home_id, bySlot.QF2.away_id]).toEqual(["s4", "s5"]);
    expect([bySlot.QF3.home_id, bySlot.QF3.away_id]).toEqual(["s2", "s7"]);
    expect([bySlot.QF4.home_id, bySlot.QF4.away_id]).toEqual(["s3", "s6"]);
    expect(bySlot.SF_A.home_id).toBeNull();
  });

  it("exige exatamente 8 classificados", () => {
    expect(() => seedBracket(["a", "b"])).toThrow();
  });
});

describe("recomputeBracket", () => {
  it("propaga vencedores das quartas para as semis", () => {
    const matches = asMatches(seedBracket(top8));
    const set = (slot: string, hg: number, ag: number) => {
      const m = matches.find((x) => x.slot === slot)!;
      m.home_goals = hg;
      m.away_goals = ag;
    };
    set("QF1", 2, 0); // s1
    set("QF2", 1, 3); // s5
    set("QF3", 0, 1); // s7
    set("QF4", 4, 2); // s3

    const updates = recomputeBracket(matches);
    const sfa = updates.find((u) => u.id === matches.find((m) => m.slot === "SF_A")!.id)!;
    const sfb = updates.find((u) => u.id === matches.find((m) => m.slot === "SF_B")!.id)!;
    expect([sfa.home_id, sfa.away_id]).toEqual(["s1", "s5"]);
    expect([sfb.home_id, sfb.away_id]).toEqual(["s7", "s3"]);
  });

  it("preenche final (vencedores) e terceiro (perdedores) das semis", () => {
    const matches = asMatches(seedBracket(top8));
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
    set("QF1", 1, 0); set("QF2", 1, 0); set("QF3", 1, 0); set("QF4", 1, 0);
    apply(recomputeBracket(matches)); // SF_A = s1 x s4, SF_B = s2 x s3
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
    expect(table[0].playerId).toBe("a");
  });
});
