import { describe, it, expect } from "vitest";
import {
  buildProfiles,
  buildRoster,
  findProfile,
  personKey,
  personSlug,
  rankProfiles,
  PESOS,
  type Profile,
} from "../profiles";
import type { Edition, Match, Player } from "../types";

// ---------------------------------------------------------------------------
// Cenário: duas Copas Costela com a MESMA turma, mas ids diferentes em cada
// edição (é o que o "Abrir a próxima edição" faz de verdade). O que liga as
// duas é o nome.
// ---------------------------------------------------------------------------

const EDICOES: Edition[] = [
  {
    id: 1,
    name: "Copa Costela",
    event_date: null,
    event_time: null,
    event_local: null,
    event_note: null,
    created_at: "2025-01-01",
    closed_at: "2025-12-01", // arquivada
  },
  {
    id: 2,
    name: "Copa Costela",
    event_date: null,
    event_time: null,
    event_local: null,
    event_note: null,
    created_at: "2026-01-01",
    closed_at: null, // em cartaz
  },
];

function jogador(id: string, name: string, edition: number, photo: string | null = null): Player {
  return { id, name, photo, created_at: `2025-01-0${edition}`, edition, withdrawn: false } as Player;
}

function jogo(p: Partial<Match> & { edition: number }): Match {
  return {
    id: p.id ?? Math.random().toString(36).slice(2),
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
    edition: p.edition,
  } as Match;
}

// 1ª edição: Ronaldo bate o Léo na final. André amarga a lanterna.
// 2ª edição: Léo se vinga e é campeão.
const PLAYERS: Player[] = [
  jogador("a1", "Ronaldo", 1, "foto-antiga"),
  jogador("b1", "Léo", 1),
  jogador("c1", "André", 1),
  jogador("a2", "Ronaldo", 2, "foto-nova"),
  jogador("b2", "Léo", 2, "foto-leo"),
  jogador("c2", "André", 2),
];

const MATCHES: Match[] = [
  // --- 1ª edição (liga) ---
  jogo({ id: "1a", edition: 1, home_id: "a1", away_id: "b1", home_goals: 3, away_goals: 1 }),
  jogo({ id: "1b", edition: 1, home_id: "a1", away_id: "c1", home_goals: 2, away_goals: 0 }),
  jogo({ id: "1c", edition: 1, home_id: "b1", away_id: "c1", home_goals: 4, away_goals: 1 }),
  // final da 1ª: Ronaldo campeão
  jogo({
    id: "1f",
    edition: 1,
    stage: "final",
    slot: "FINAL",
    home_id: "a1",
    away_id: "b1",
    home_goals: 2,
    away_goals: 1,
  }),
  // --- 2ª edição (liga) ---
  jogo({ id: "2a", edition: 2, home_id: "b2", away_id: "a2", home_goals: 5, away_goals: 0 }),
  jogo({ id: "2b", edition: 2, home_id: "b2", away_id: "c2", home_goals: 3, away_goals: 0 }),
  jogo({ id: "2c", edition: 2, home_id: "a2", away_id: "c2", home_goals: 1, away_goals: 1 }),
  // final da 2ª: Léo campeão
  jogo({
    id: "2f",
    edition: 2,
    stage: "final",
    slot: "FINAL",
    home_id: "b2",
    away_id: "a2",
    home_goals: 1,
    away_goals: 0,
  }),
];

describe("personKey / personSlug", () => {
  it("ignora acento, caixa e espaço sobrando", () => {
    expect(personKey("  LÉO ")).toBe("leo");
    expect(personKey("Léo")).toBe(personKey("leo"));
    expect(personKey("Luis  Pato")).toBe("luis pato");
  });

  it("vira endereço de URL", () => {
    expect(personSlug("Luis Pato")).toBe("luis-pato");
    expect(personSlug("André")).toBe("andre");
  });
});

describe("buildProfiles", () => {
  const perfis = buildProfiles(PLAYERS, MATCHES, EDICOES);
  const de = (n: string) => perfis.find((p) => p.key === personKey(n))!;

  it("junta as duas edições na mesma pessoa, mesmo com ids diferentes", () => {
    expect(perfis).toHaveLength(3);
    expect(de("Ronaldo").seasons.map((s) => s.edition)).toEqual([1, 2]);
    expect(de("Léo").seasons.map((s) => s.edition)).toEqual([1, 2]);
  });

  it("guarda a foto mais recente que a pessoa teve", () => {
    expect(de("Ronaldo").photo).toBe("foto-nova"); // não a "foto-antiga" da 1ª
    expect(de("André").photo).toBeNull();
  });

  it("soma os números das duas copas", () => {
    const r = de("Ronaldo").career;
    // PJ/V/E/D/GM/GC vêm da CLASSIFICAÇÃO, que é só a liga — a final fica
    // fora, igual na tabela do site.
    // liga 1ª: 3x1 e 2x0 · liga 2ª: 0x5 e 1x1
    expect(r.editions).toBe(2);
    expect(r.played).toBe(4);
    expect(r.wins).toBe(2);
    expect(r.draws).toBe(1);
    expect(r.losses).toBe(1);
    expect(r.goalsFor).toBe(6);
    expect(r.goalsAgainst).toBe(7);
    expect(r.goalDiff).toBe(-1);
    expect(r.points).toBe(7);
  });

  it("os gols do prêmio incluem o mata-mata (a classificação não)", () => {
    const r = de("Ronaldo").career;
    // liga (3+2+0+1 = 6) + finais (2 na 1ª, 0 na 2ª) = 8
    expect(r.goals).toBe(8);
    expect(r.goalsFor).toBe(6);
  });

  it("conta títulos, vices e pódios de cada um", () => {
    expect(de("Ronaldo").career.titles).toBe(1);
    expect(de("Léo").career.titles).toBe(1);
    expect(de("André").career.titles).toBe(0);
    // cada um foi campeão uma vez e vice uma vez → 2 finais
    expect(de("Ronaldo").career.finals).toBe(2);
    expect(de("Léo").career.finals).toBe(2);
  });

  it("marca campeão e vice na edição certa", () => {
    const ron = de("Ronaldo").seasons;
    expect(ron.find((s) => s.edition === 1)!.champion).toBe(true);
    expect(ron.find((s) => s.edition === 2)!.champion).toBe(false);
    expect(ron.find((s) => s.edition === 2)!.runnerUp).toBe(true);
  });

  it("marca a edição arquivada e a que ainda está rolando", () => {
    const leo = de("Léo").seasons;
    expect(leo.find((s) => s.edition === 1)!.closed).toBe(true);
    expect(leo.find((s) => s.edition === 2)!.closed).toBe(false);
  });

  it("guarda a colocação na liga de cada edição e a melhor da carreira", () => {
    const pos = (n: string) =>
      de(n)
        .seasons.sort((a, b) => a.edition - b.edition)
        .map((s) => s.position);
    expect(pos("Ronaldo")).toEqual([1, 3]); // caiu de 1º para último na 2ª
    expect(pos("Léo")).toEqual([2, 1]);
    expect(pos("André")).toEqual([3, 2]);
    expect(de("Ronaldo").career.bestPosition).toBe(1);
    expect(de("André").career.bestPosition).toBe(2);
  });

  it("marca a lanterna de cada edição pelo último da classificação", () => {
    const lanterna = (n: string) =>
      de(n)
        .seasons.sort((a, b) => a.edition - b.edition)
        .map((s) => s.lastPlace);
    // André foi último na 1ª; na 2ª o saldo pior (-5) jogou o Ronaldo pra lá
    expect(lanterna("André")).toEqual([true, false]);
    expect(lanterna("Ronaldo")).toEqual([false, true]);
  });

  it("calcula o aproveitamento em cima dos pontos disputados", () => {
    const andre = de("André").career;
    // André: 1 empate em 4 jogos de liga → 1 ponto de 12 possíveis
    expect(andre.points).toBe(1);
    expect(andre.played).toBe(4);
    expect(andre.winRate).toBe(8);
  });

  it("ordena por títulos, depois edições, depois nome", () => {
    // Léo e Ronaldo têm 1 título cada e 2 edições → desempata no nome
    expect(perfis.map((p) => p.name)).toEqual(["Léo", "Ronaldo", "André"]);
  });

  it("acha o perfil pelo endereço", () => {
    expect(findProfile(perfis, "leo")!.name).toBe("Léo");
    expect(findProfile(perfis, "andre")!.name).toBe("André");
    expect(findProfile(perfis, "ninguem")).toBeNull();
  });

  it("não quebra com edição sem nenhum jogo", () => {
    const novos = [...PLAYERS, jogador("a3", "Ronaldo", 3)];
    const p = buildProfiles(novos, MATCHES, EDICOES).find((x) => x.key === "ronaldo")!;
    const terceira = p.seasons.find((s) => s.edition === 3)!;
    expect(terceira.position).toBeNull(); // ninguém jogou ainda
    expect(terceira.lastPlace).toBe(false); // e ninguém é lanterna
    expect(p.career.editions).toBe(3);
  });
});

describe("buildRoster (banco de participantes)", () => {
  it("lista quem já jogou e diz quem já está na edição em cartaz", () => {
    const banco = buildRoster(PLAYERS, MATCHES, EDICOES, 2);
    expect(banco.every((r) => r.inCurrent)).toBe(true); // todos estão na 2ª
  });

  it("numa edição nova e vazia, todo mundo fica disponível com a foto", () => {
    const banco = buildRoster(PLAYERS, MATCHES, EDICOES, 3);
    expect(banco.every((r) => !r.inCurrent)).toBe(true);
    const ron = banco.find((r) => r.key === "ronaldo")!;
    expect(ron.photo).toBe("foto-nova"); // a foto vem junto
    expect(ron.editions).toEqual([1, 2]);
  });

  it("quem já foi adicionado à edição some da lista de disponíveis", () => {
    const comRonaldo = [...PLAYERS, jogador("a3", "Ronaldo", 3)];
    const banco = buildRoster(comRonaldo, MATCHES, EDICOES, 3);
    const livres = banco.filter((r) => !r.inCurrent).map((r) => r.name);
    expect(livres).not.toContain("Ronaldo");
    expect(livres.sort()).toEqual(["André", "Léo"]);
  });
});

// ---------------------------------------------------------------------------
// Ordem do mural (Histórico): edições mandam, depois a nota de carreira.
// ---------------------------------------------------------------------------
describe("rankProfiles (ranking geral)", () => {
  const perfis = buildProfiles(PLAYERS, MATCHES, EDICOES);

  function comCarreira(nome: string, editions: number, patch: Partial<Profile["career"]>) {
    const base = perfis[0];
    return {
      ...base,
      key: nome.toLowerCase(),
      slug: nome.toLowerCase(),
      name: nome,
      career: { ...base.career, ...patch, editions },
    } as Profile;
  }

  it("é um ranking só: mais edições NÃO passa na frente de ficha melhor", () => {
    const veterano = comCarreira("Veterano", 5, { score: 10 });
    const estrela = comCarreira("Estrela", 1, { score: 120 });
    expect(rankProfiles([veterano, estrela]).map((p) => p.name)).toEqual(["Estrela", "Veterano"]);
  });

  it("edições valem zero: duas fichas iguais empatam, independente das copas", () => {
    const a = buildProfiles(
      [jogador("x1", "Xis", 1), jogador("y1", "Ipsilon", 1), jogador("y2", "Ipsilon", 2)],
      [],
      EDICOES,
    );
    const xis = a.find((p) => p.key === "xis")!;
    const ips = a.find((p) => p.key === "ipsilon")!;
    expect(ips.career.editions).toBe(2);
    expect(xis.career.editions).toBe(1);
    expect(ips.career.score).toBe(xis.career.score); // o nº de copas não soma nada
  });

  it("subir PESOS.edicao é o único jeito de premiar quilometragem", () => {
    expect(PESOS.edicao).toBe(0);
  });

  it("título pesa mais que qualquer campanha", () => {
    const campeao = perfis.find((p) => p.key === "leo")!;
    const semNada = perfis.find((p) => p.key === "andre")!;
    expect(campeao.career.score).toBeGreaterThan(semNada.career.score);
  });

  it("aproveitamento nunca passa na frente de uma medalha", () => {
    // 100% de aproveitamento vale 10 pontos; um 3º lugar vale 25
    const craque = comCarreira("Craque", 2, { thirds: 0, winRate: 100, score: 100 / 10 });
    const medalhista = comCarreira("Medalhista", 2, { thirds: 1, winRate: 0, score: 25 });
    expect(rankProfiles([craque, medalhista])[0].name).toBe("Medalhista");
  });

  it("empate na nota cai em gols e depois no nome", () => {
    const a = comCarreira("Zeca", 1, { score: 50, goals: 10 });
    const b = comCarreira("Ana", 3, { score: 50, goals: 10 });
    const c = comCarreira("Bia", 2, { score: 50, goals: 99 });
    expect(rankProfiles([a, b, c]).map((p) => p.name)).toEqual(["Bia", "Ana", "Zeca"]);
  });

  it("a nota sai dos pesos declarados", () => {
    const leo = perfis.find((p) => p.key === "leo")!.career;
    const esperado =
      PESOS.titulo * leo.titles +
      PESOS.vice * leo.runnerUps +
      PESOS.terceiro * leo.thirds +
      PESOS.artilheiro * leo.topScorerAwards +
      PESOS.melhorDefesa * leo.bestDefenseAwards +
      PESOS.top6 * leo.top6 +
      PESOS.lanterna * leo.lastPlaces +
      PESOS.edicao * leo.editions +
      leo.winRate / 10;
    expect(leo.score).toBeCloseTo(esperado);
  });
});
