import { describe, expect, it } from "vitest";
import {
  FIRST_EDITION,
  editionOf,
  forEdition,
  makeEdition,
  nextEditionId,
  removalBlockedMessage,
  removalImpact,
  summarizeEdition,
} from "../editions";
import type { Edition, Match, Player } from "../types";

function player(id: string, name: string, edition?: number): Player {
  return { id, name, created_at: "2026-01-01T00:00:00.000Z", edition };
}

function match(partial: Partial<Match>): Match {
  return {
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
    created_at: partial.created_at ?? "2026-01-01T00:00:00.000Z",
    edition: partial.edition,
  };
}

describe("edições", () => {
  it("linha sem edição pertence à 1ª (bancos anteriores às edições)", () => {
    expect(editionOf(player("a", "Léo"))).toBe(FIRST_EDITION);
    expect(editionOf(player("a", "Léo", 2))).toBe(2);
    expect(editionOf(null)).toBe(FIRST_EDITION);
  });

  it("filtra jogadores e partidas por edição sem misturar", () => {
    const players = [player("a", "Léo"), player("b", "Riquelme", 1), player("c", "Léo", 2)];
    expect(forEdition(players, 1).map((p) => p.id)).toEqual(["a", "b"]);
    expect(forEdition(players, 2).map((p) => p.id)).toEqual(["c"]);
  });

  it("a próxima edição é a maior + 1", () => {
    const eds: Edition[] = [makeEdition(1, "Copa Costela"), makeEdition(2, "Copa Costela")];
    expect(nextEditionId(eds)).toBe(3);
    expect(nextEditionId([])).toBe(1);
  });

  it("edição nova nasce aberta e sem data marcada", () => {
    const e = makeEdition(2, "Copa Costela");
    expect(e.closed_at).toBeNull();
    expect(e.event_date).toBeNull();
  });
});

describe("blindagem do remover participante", () => {
  const matches = [
    match({ id: "m1", home_id: "leo", away_id: "riq", home_goals: 2, away_goals: 1 }),
    match({ id: "m2", home_id: "leo", away_id: "gui" }), // ainda sem placar
    match({ id: "m3", home_id: "riq", away_id: "gui", home_goals: 0, away_goals: 0 }),
  ];

  it("conta os jogos que sumiriam junto, e quantos já têm placar", () => {
    expect(removalImpact(matches, "leo")).toEqual({ total: 2, played: 1 });
    expect(removalImpact(matches, "ninguem")).toEqual({ total: 0, played: 0 });
  });

  it("bloqueia quem já tem partidas e avisa do W.O.", () => {
    const msg = removalBlockedMessage(matches, "leo", "Léo");
    expect(msg).toContain("2 partidas");
    expect(msg).toContain("1 já tem placar lançado");
    expect(msg).toContain("W.O.");
  });

  it("libera quem ainda não entrou em nenhum jogo", () => {
    expect(removalBlockedMessage(matches, "novato", "Novato")).toBeNull();
    expect(removalBlockedMessage([], "leo", "Léo")).toBeNull();
  });
});

describe("resumo de uma edição arquivada", () => {
  const players = [
    player("leo", "Léo", 1),
    player("riq", "Riquelme", 1),
    player("gui", "Gui", 1),
    player("all", "Allan", 1),
  ];
  const matches = [
    match({ id: "l1", home_id: "leo", away_id: "riq", home_goals: 3, away_goals: 1, edition: 1 }),
    match({ id: "l2", home_id: "gui", away_id: "all", home_goals: 2, away_goals: 2, edition: 1 }),
    match({
      id: "f",
      stage: "final",
      slot: "FINAL",
      round: null,
      home_id: "leo",
      away_id: "gui",
      home_goals: 2,
      away_goals: 0,
      edition: 1,
    }),
    match({
      id: "t",
      stage: "terceiro",
      slot: "TERCEIRO",
      round: null,
      home_id: "riq",
      away_id: "all",
      home_goals: 1,
      away_goals: 0,
      edition: 1,
    }),
  ];

  it("extrai campeão, vice, terceiro e artilheiro", () => {
    const s = summarizeEdition(players, matches);
    expect(s.championId).toBe("leo");
    expect(s.runnerUpId).toBe("gui");
    expect(s.thirdId).toBe("riq");
    expect(s.topScorer?.playerId).toBe("leo"); // 3 na liga + 2 na final
    expect(s.topScorer?.goals).toBe(5);
    expect(s.played).toBe(4);
    expect(s.total).toBe(4);
  });

  it("não vaza dados de outra edição para o resumo", () => {
    const outra = [
      ...matches,
      match({ id: "x", home_id: "leo", away_id: "riq", home_goals: 9, away_goals: 0, edition: 2 }),
    ];
    const s = summarizeEdition(players, forEdition(outra, 1));
    expect(s.topScorer?.goals).toBe(5);
  });
});
