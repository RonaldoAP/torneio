import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Match, Player, TournamentState } from "../types";
import { forEdition } from "../editions";

// ---------------------------------------------------------------------------
// O modo local espelha a lógica do servidor — é onde um erro passa despercebido
// (não tem banco pra reclamar). Aqui rodamos o fluxo de ponta a ponta num
// localStorage de mentira: sortear → nova edição → sortear de novo, conferindo
// que a edição arquivada não é tocada.
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

async function load() {
  vi.stubGlobal("window", fakeWindow());
  vi.stubGlobal("CustomEvent", class {} as any);
  vi.resetModules();
  const [{ adminActions }, { readLocal }] = await Promise.all([
    import("../adminActions"),
    import("../localStore"),
  ]);
  return { adminActions, readLocal };
}

let adminActions: Awaited<ReturnType<typeof load>>["adminActions"];
let readLocal: () => TournamentState;

beforeEach(async () => {
  ({ adminActions, readLocal } = await load());
});

const ligaOf = (s: TournamentState, ed: number) =>
  forEdition(s.matches, ed).filter((m: Match) => m.stage === "liga");

describe("edições no modo local", () => {
  it("começa na 1ª edição com os confirmados semeados", async () => {
    const s = readLocal();
    expect(s.config.current_edition).toBe(1);
    expect(forEdition(s.players, 1).length).toBe(10);
    expect(s.editions?.[0].id).toBe(1);
  });

  it("arquiva a edição atual e abre a próxima zerada, levando a turma", async () => {
    await adminActions.generateLeague();
    const antes = readLocal();
    const jogosEd1 = ligaOf(antes, 1).length;
    expect(jogosEd1).toBe(45); // 10 participantes, turno único

    // marca um placar pra conferir que ele sobrevive ao arquivamento
    const alvo = ligaOf(antes, 1)[0];
    await adminActions.saveScore({ id: alvo.id, home_goals: 3, away_goals: 1 });

    await adminActions.newEdition({ copy_players: true });
    const depois = readLocal();

    expect(depois.config.current_edition).toBe(2);
    expect(depois.editions?.find((e) => e.id === 1)?.closed_at).toBeTruthy();
    // a 2ª nasce sem jogos, com a mesma turma em participantes NOVOS
    expect(forEdition(depois.matches, 2)).toHaveLength(0);
    expect(forEdition(depois.players, 2).map((p: Player) => p.name)).toEqual(
      forEdition(antes.players, 1).map((p: Player) => p.name),
    );
    const idsEd1 = new Set(forEdition(depois.players, 1).map((p: Player) => p.id));
    expect(forEdition(depois.players, 2).some((p: Player) => idsEd1.has(p.id))).toBe(false);
    // e a 1ª continua intacta, com o placar lançado
    expect(ligaOf(depois, 1)).toHaveLength(jogosEd1);
    expect(depois.matches.find((m) => m.id === alvo.id)?.home_goals).toBe(3);
  });

  it("sortear a 2ª edição não encosta nos jogos da 1ª", async () => {
    await adminActions.generateLeague();
    const jogosEd1 = ligaOf(readLocal(), 1).map((m) => m.id);

    await adminActions.newEdition({ copy_players: true });
    await adminActions.generateLeague();

    const s = readLocal();
    expect(ligaOf(s, 2)).toHaveLength(45);
    expect(ligaOf(s, 1).map((m) => m.id)).toEqual(jogosEd1);
  });

  it("zerar placares e desistência ficam presos à edição em cartaz", async () => {
    await adminActions.generateLeague();
    const alvo = ligaOf(readLocal(), 1)[0];
    await adminActions.saveScore({ id: alvo.id, home_goals: 2, away_goals: 0 });

    await adminActions.newEdition({ copy_players: true });
    await adminActions.generateLeague();
    await adminActions.resetScores();

    const s = readLocal();
    expect(s.matches.find((m) => m.id === alvo.id)?.home_goals).toBe(2);
  });

  it("remover participante com jogos exige confirmação — e o W.O. é o caminho sugerido", async () => {
    await adminActions.generateLeague();
    const leo = forEdition(readLocal().players, 1).find((p) => p.name === "Léo")!;

    await expect(adminActions.removePlayer(leo.id)).rejects.toThrow(/W\.O\./);
    expect(forEdition(readLocal().players, 1).some((p) => p.id === leo.id)).toBe(true);

    await adminActions.removePlayer(leo.id, true);
    const s = readLocal();
    expect(forEdition(s.players, 1).some((p) => p.id === leo.id)).toBe(false);
    expect(ligaOf(s, 1).some((m) => m.home_id === leo.id || m.away_id === leo.id)).toBe(false);
  });

  it("participante sem jogos sai sem cerimônia", async () => {
    await adminActions.addPlayer("Convidado");
    const novo = forEdition(readLocal().players, 1).find((p) => p.name === "Convidado")!;
    await adminActions.removePlayer(novo.id);
    expect(forEdition(readLocal().players, 1).some((p) => p.id === novo.id)).toBe(false);
  });

  it("desfazer a abertura de uma edição volta pra anterior (enquanto não há jogos)", async () => {
    await adminActions.generateLeague();
    await adminActions.newEdition({ copy_players: true });
    await adminActions.discardEdition();

    const s = readLocal();
    expect(s.config.current_edition).toBe(1);
    expect(s.editions?.find((e) => e.id === 1)?.closed_at).toBeNull();
    expect(s.editions?.some((e) => e.id === 2)).toBe(false);
    expect(forEdition(s.players, 2)).toHaveLength(0);
    expect(ligaOf(s, 1)).toHaveLength(45);
  });

  it("não descarta uma edição que já tem jogos sorteados", async () => {
    await adminActions.newEdition({ copy_players: true });
    await adminActions.generateLeague();
    await expect(adminActions.discardEdition()).rejects.toThrow(/já tem jogos/);
    expect(readLocal().config.current_edition).toBe(2);
  });

  it("importar um backup de edição só restaura a edição em cartaz", async () => {
    await adminActions.generateLeague();
    const ed1 = readLocal();
    const snapshot: TournamentState = JSON.parse(
      JSON.stringify({
        config: ed1.config,
        players: forEdition(ed1.players, 1),
        matches: forEdition(ed1.matches, 1),
      }),
    );

    await adminActions.newEdition({ copy_players: false });
    await adminActions.importState(snapshot); // Desfazer dentro da 2ª edição

    const s = readLocal();
    expect(s.config.current_edition).toBe(2);
    expect(ligaOf(s, 2)).toHaveLength(45); // veio pra edição em cartaz
    expect(ligaOf(s, 1)).toHaveLength(45); // e a 1ª segue intacta
    expect(s.editions?.some((e) => e.id === 2)).toBe(true);
  });
});
