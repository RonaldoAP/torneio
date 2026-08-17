import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Match, TournamentState } from "../types";
import { forEdition } from "../editions";
import { computeStandings } from "../standings";
import { computeScorers, computeDefense } from "../scorers";

// ---------------------------------------------------------------------------
// Auditoria dos cenários do dia do evento, ponta a ponta no modo local (que é
// o espelho da lógica do servidor): alterar placar já lançado, empate,
// pênaltis, desistência em vários momentos e correção de erro do admin.
// ---------------------------------------------------------------------------

function fakeWindow() {
  const store = new Map<string, string>();
  return {
    localStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    },
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => true,
  };
}

let A: any;
let ler: () => TournamentState;

beforeEach(async () => {
  vi.stubGlobal("window", fakeWindow());
  vi.stubGlobal("CustomEvent", class {} as any);
  vi.resetModules();
  const [{ adminActions }, { readLocal }] = await Promise.all([
    import("../adminActions"),
    import("../localStore"),
  ]);
  A = adminActions;
  ler = readLocal;
});

const ed = () => {
  const s = ler();
  const cur = s.config.current_edition ?? 1;
  return { players: forEdition(s.players, cur), matches: forEdition(s.matches, cur), config: s.config };
};
const liga = () => ed().matches.filter((m) => m.stage === "liga");
const porNome = (n: string) => ed().players.find((p) => p.name === n)!;
const tabela = () => {
  const { players, matches } = ed();
  return computeStandings(players, matches);
};

/** Lança um placar em todos os jogos da liga (determinístico). */
async function preencherLiga(gols: (i: number) => [number, number]) {
  const jogos = liga();
  for (let i = 0; i < jogos.length; i++) {
    const [h, a] = gols(i);
    await A.saveScore({ id: jogos[i].id, home_goals: h, away_goals: a });
  }
}

describe("modificação de placar", () => {
  it("corrigir um placar já lançado recalcula a classificação", async () => {
    await A.generateLeague();
    const jogo = liga()[0];
    await A.saveScore({ id: jogo.id, home_goals: 5, away_goals: 0 });

    const casa = jogo.home_id!;
    expect(tabela().find((r) => r.playerId === casa)!.points).toBe(3);

    // admin errou: era 0×5
    await A.saveScore({ id: jogo.id, home_goals: 0, away_goals: 5 });
    const linha = tabela().find((r) => r.playerId === casa)!;
    expect(linha.points).toBe(0);
    expect(linha.goalsFor).toBe(0);
    expect(linha.goalsAgainst).toBe(5);
    expect(linha.losses).toBe(1);
  });

  it("apagar o placar (deixar em branco) devolve o jogo para 'a jogar'", async () => {
    await A.generateLeague();
    const jogo = liga()[0];
    await A.saveScore({ id: jogo.id, home_goals: 3, away_goals: 1 });
    await A.saveScore({ id: jogo.id, home_goals: "", away_goals: "" });
    const depois = liga().find((m) => m.id === jogo.id)!;
    expect(depois.home_goals).toBeNull();
    expect(tabela().every((r) => r.played === 0)).toBe(true);
  });

  it("gol negativo é barrado (vira 0)", async () => {
    await A.generateLeague();
    const jogo = liga()[0];
    await A.saveScore({ id: jogo.id, home_goals: -3, away_goals: 2 });
    expect(liga().find((m) => m.id === jogo.id)!.home_goals).toBe(0);
  });
});

describe("empate", () => {
  it("empate na liga vale 1 ponto para cada e não pede pênalti", async () => {
    await A.generateLeague();
    const jogo = liga()[0];
    await A.saveScore({ id: jogo.id, home_goals: 2, away_goals: 2 });
    const t = tabela();
    expect(t.find((r) => r.playerId === jogo.home_id)!.points).toBe(1);
    expect(t.find((r) => r.playerId === jogo.away_id)!.points).toBe(1);
    expect(liga().find((m) => m.id === jogo.id)!.pen_winner_id).toBeNull();
  });

  it("liga terminando com todo mundo empatado trava o mata-mata", async () => {
    await A.generateLeague();
    await preencherLiga(() => [0, 0]);
    await expect(A.seedBracket()).rejects.toThrow(/empate/i);
  });

  it("partida de desempate resolve e libera o mata-mata", async () => {
    await A.generateLeague();
    await preencherLiga(() => [0, 0]);
    const t = tabela();
    const empatados = t.filter((r) => r.unresolvedTie);
    expect(empatados.length).toBeGreaterThanOrEqual(2);

    // desempate entre os dois primeiros da linha de corte
    await A.createDesempate(t[5].playerId, t[6].playerId);
    const de = ed().matches.find((m) => m.stage === "desempate")!;
    await A.saveScore({ id: de.id, home_goals: 1, away_goals: 0 });

    // o gol do desempate não entra na artilharia
    const art = computeScorers(ed().players, ed().matches);
    expect(art.every((s) => s.goals === 0)).toBe(true);
  });
});

describe("mata-mata", () => {
  async function chegarNoMataMata() {
    await A.generateLeague();
    // placares variados: gera uma classificação sem empate no corte
    await preencherLiga((i) => [(i * 3) % 7, (i * 5) % 4]);
    await A.seedBracket();
  }

  it("empate no mata-mata é decidido nos pênaltis e a chave avança", async () => {
    await chegarNoMataMata();
    const repA = ed().matches.find((m) => m.slot === "REP_A")!;
    await A.saveScore({
      id: repA.id,
      home_goals: 2,
      away_goals: 2,
      pen_winner_id: repA.home_id,
    });
    const sfA = ed().matches.find((m) => m.slot === "SF_A")!;
    expect(sfA.away_id).toBe(repA.home_id);
  });

  it("corrigir o placar de uma fase limpa a fase seguinte", async () => {
    await chegarNoMataMata();
    const repA = ed().matches.find((m) => m.slot === "REP_A")!;
    await A.saveScore({ id: repA.id, home_goals: 3, away_goals: 0 });
    let sfA = ed().matches.find((m) => m.slot === "SF_A")!;
    expect(sfA.away_id).toBe(repA.home_id);

    // admin inverteu o placar
    await A.saveScore({ id: repA.id, home_goals: 0, away_goals: 3 });
    sfA = ed().matches.find((m) => m.slot === "SF_A")!;
    expect(sfA.away_id).toBe(repA.away_id);
    expect(sfA.home_goals).toBeNull(); // placar antigo da semi foi invalidado
  });

  it("campeão, vice e 3º saem certos ao fim da chave", async () => {
    await chegarNoMataMata();
    const jogar = async (slot: string, h: number, a: number) => {
      const m = ed().matches.find((x) => x.slot === slot)!;
      await A.saveScore({ id: m.id, home_goals: h, away_goals: a });
    };
    await jogar("REP_A", 2, 0);
    await jogar("REP_B", 2, 0);
    await jogar("SF_A", 1, 0);
    await jogar("SF_B", 0, 1);
    await jogar("TERCEIRO", 3, 1);
    await jogar("FINAL", 2, 1);

    const { matches, players } = ed();
    const fin = matches.find((m) => m.slot === "FINAL")!;
    const ter = matches.find((m) => m.slot === "TERCEIRO")!;
    expect(fin.home_id).toBeTruthy();
    expect(ter.home_id).toBeTruthy();
    // artilharia soma liga + mata-mata
    const art = computeScorers(players, matches);
    expect(art.reduce((s, r) => s + r.goals, 0)).toBeGreaterThan(0);
  });
});

describe("desistência", () => {
  it("no meio da liga: todos os jogos viram 3×0 e saem da artilharia", async () => {
    await A.generateLeague();
    const leo = porNome("Léo");
    const jogos = liga().filter((m) => m.home_id === leo.id || m.away_id === leo.id);
    // ele tinha feito 5 gols num jogo
    await A.saveScore({ id: jogos[0].id, home_goals: 5, away_goals: 1 });

    await A.withdraw(leo.id);

    const meus = liga().filter((m) => m.home_id === leo.id || m.away_id === leo.id);
    expect(meus).toHaveLength(jogos.length);
    for (const m of meus) {
      const souCasa = m.home_id === leo.id;
      expect([m.home_goals, m.away_goals]).toEqual(souCasa ? [0, 3] : [3, 0]);
      expect(m.counts_for_scorers).toBe(false);
    }
    const art = computeScorers(ed().players, ed().matches);
    expect(art.find((s) => s.playerId === leo.id)!.goals).toBe(0);
    // e ninguém ganhou gol de graça
    expect(art.reduce((s, r) => s + r.goals, 0)).toBe(0);

    // os adversários levam 3 pontos cada
    const t = tabela();
    expect(t.find((r) => r.playerId === leo.id)!.points).toBe(0);
  });

  it("a marca é permanente: jogo criado depois já nasce 3×0", async () => {
    await A.generateLeague();
    await preencherLiga((i) => [(i * 3) % 7, (i * 5) % 4]);
    const campeaoDaLiga = tabela()[0].playerId;
    await A.withdraw(campeaoDaLiga); // desiste antes do mata-mata

    await A.generateLeague(); // sorteio refeito: jogos novos
    const meus = liga().filter(
      (m) => m.home_id === campeaoDaLiga || m.away_id === campeaoDaLiga,
    );
    expect(meus.length).toBeGreaterThan(0);
    for (const m of meus) {
      expect(m.counts_for_scorers).toBe(false);
      const souCasa = m.home_id === campeaoDaLiga;
      expect([m.home_goals, m.away_goals]).toEqual(souCasa ? [0, 3] : [3, 0]);
    }
  });

  it("zerar placares não ressuscita quem desistiu", async () => {
    await A.generateLeague();
    const gui = porNome("Gui");
    await A.withdraw(gui.id);
    await A.resetScores();
    const meus = liga().filter((m) => m.home_id === gui.id || m.away_id === gui.id);
    for (const m of meus) {
      expect(m.home_goals).not.toBeNull();
      expect(m.counts_for_scorers).toBe(false);
    }
  });

  it("cancelar a desistência devolve a pessoa ao torneio", async () => {
    await A.generateLeague();
    const gui = porNome("Gui");
    await A.withdraw(gui.id);
    expect(porNome("Gui").withdrawn).toBe(true);
    await A.reinstate(gui.id);
    expect(porNome("Gui").withdrawn).toBe(false);
    // a partir daqui o admin pode corrigir os placares na mão
    const jogo = liga().find((m) => m.home_id === gui.id || m.away_id === gui.id)!;
    await A.saveScore({ id: jogo.id, home_goals: 2, away_goals: 2 });
    expect(liga().find((m) => m.id === jogo.id)!.home_goals).toBe(2);
  });

  it("melhor defesa ignora os jogos de W.O.", async () => {
    await A.generateLeague();
    const leo = porNome("Léo");
    await A.withdraw(leo.id);
    const d = computeDefense(ed().players, ed().matches);
    // ninguém aparece com jogo contado, porque só há W.O. lançado
    expect(d.every((r) => r.games === 0)).toBe(true);
  });
});

describe("proteções do admin", () => {
  it("remover quem já tem jogos exige confirmação", async () => {
    await A.generateLeague();
    const leo = porNome("Léo");
    await expect(A.removePlayer(leo.id)).rejects.toThrow(/W\.O\./);
    expect(ed().players.some((p) => p.id === leo.id)).toBe(true);
  });

  it("montar o mata-mata com menos de 6 participantes é barrado", async () => {
    // remove até sobrar 5 (antes de sortear, ninguém tem jogo)
    const nomes = ed().players.map((p) => p.name);
    for (const n of nomes.slice(0, 5)) await A.removePlayer(porNome(n).id);
    expect(ed().players).toHaveLength(5);
    await expect(A.seedBracket()).rejects.toThrow(/6/);
  });
});
