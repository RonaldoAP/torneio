import { describe, expect, it } from "vitest";
import { applyWalkovers, walkoverUpdates } from "../walkover";
import type { Match, Player } from "../types";

const p = (id: string, withdrawn = false): Player => ({
  id,
  name: id,
  created_at: "",
  withdrawn,
});

const m = (partial: Partial<Match>): Match => ({
  id: partial.id ?? "m",
  stage: partial.stage ?? "liga",
  round: partial.round ?? 1,
  home_id: partial.home_id ?? null,
  away_id: partial.away_id ?? null,
  home_goals: partial.home_goals ?? null,
  away_goals: partial.away_goals ?? null,
  pen_winner_id: partial.pen_winner_id ?? null,
  counts_for_scorers: partial.counts_for_scorers ?? true,
  slot: partial.slot ?? null,
  created_at: "",
});

describe("desistência grudada no participante", () => {
  const players = [p("a", true), p("b"), p("c")];

  it("marca 3×0 para o adversário, em jogo já disputado ou não", () => {
    const matches = [
      m({ id: "1", home_id: "a", away_id: "b", home_goals: 5, away_goals: 1 }),
      m({ id: "2", home_id: "c", away_id: "a" }),
    ];
    const u = walkoverUpdates(players, matches);
    expect(u).toEqual([
      { id: "1", home_goals: 0, away_goals: 3, pen_winner_id: null, counts_for_scorers: false },
      { id: "2", home_goals: 3, away_goals: 0, pen_winner_id: null, counts_for_scorers: false },
    ]);
  });

  it("pega a partida que só ganhou adversário depois (o buraco do mata-mata)", () => {
    const semi = m({ id: "sf", stage: "semi", slot: "SF_A", home_id: "a", away_id: null });
    expect(walkoverUpdates(players, [semi])).toHaveLength(0); // ainda sem adversário
    semi.away_id = "b"; // repescagem resolveu
    expect(walkoverUpdates(players, [semi])).toHaveLength(1);
  });

  it("não mexe em partida de desempate nem em jogo entre quem ficou", () => {
    const matches = [
      m({ id: "d", stage: "desempate", home_id: "a", away_id: "b" }),
      m({ id: "x", home_id: "b", away_id: "c", home_goals: 2, away_goals: 2 }),
    ];
    expect(walkoverUpdates(players, matches)).toHaveLength(0);
  });

  it("é idempotente: rodar de novo não devolve nada", () => {
    const matches = [m({ id: "1", home_id: "a", away_id: "b", home_goals: 5, away_goals: 1 })];
    expect(applyWalkovers(players, matches)).toBe(true);
    expect(walkoverUpdates(players, matches)).toHaveLength(0);
    expect(matches[0].counts_for_scorers).toBe(false);
  });

  it("os dois desistiram: 0×0, ninguém leva vitória", () => {
    const dois = [p("a", true), p("b", true)];
    const matches = [m({ id: "1", home_id: "a", away_id: "b" })];
    applyWalkovers(dois, matches);
    expect([matches[0].home_goals, matches[0].away_goals]).toEqual([0, 0]);
  });

  it("sem ninguém desistindo, não faz nada", () => {
    expect(walkoverUpdates([p("a"), p("b")], [m({ id: "1", home_id: "a", away_id: "b" })])).toEqual(
      [],
    );
  });
});
