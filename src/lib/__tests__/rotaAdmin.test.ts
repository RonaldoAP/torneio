import { beforeEach, describe, expect, it, vi } from "vitest";
import { criarBanco, clienteFake, type BancoFake } from "./helpers/fakeSupabase";
import { computeStandings } from "../standings";
import { computeScorers } from "../scorers";

// ---------------------------------------------------------------------------
// Testa o route.ts DE VERDADE contra um Supabase em memória. É o caminho que o
// site usa em produção (o modo local é só o espelho), e é onde um filtro de
// edição esquecido ou uma coluna com nome errado passaria despercebido.
// ---------------------------------------------------------------------------

const SLUG = "slug-de-teste";
let banco: BancoFake;
let POST: (req: Request) => Promise<Response>;

vi.mock("@/lib/supabase/admin", () => ({
  getAdminClient: () => clienteFake(bancoAtual()),
}));

let _banco: BancoFake;
const bancoAtual = () => _banco;

const NOMES = ["Ronaldo", "André", "Gabriel", "Léo", "Luciano", "Luis", "Jhon", "Riquelme", "Vinicius"];

async function chamar(action: string, payload?: any) {
  const req = new Request("http://x/api/admin/state", {
    method: "POST",
    headers: { "content-type": "application/json", "x-admin-slug": SLUG },
    body: JSON.stringify({ action, payload }),
  });
  const res = await POST(req);
  return { status: res.status, body: await res.json() };
}

const jogos = (ed = 1) => banco.matches.filter((m) => m.edition === ed);
const liga = (ed = 1) => jogos(ed).filter((m) => m.stage === "liga");
const quem = (nome: string) => banco.players.find((p) => p.name === nome)!;

beforeEach(async () => {
  process.env.ADMIN_SLUG = SLUG;
  banco = criarBanco(NOMES.map((name) => ({ name })));
  _banco = banco;
  vi.resetModules();
  ({ POST } = await import("../../app/api/admin/state/route"));
});

describe("autorização", () => {
  it("recusa gravação sem o slug secreto", async () => {
    const req = new Request("http://x", {
      method: "POST",
      body: JSON.stringify({ action: "generate_league" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
    expect(banco.matches).toHaveLength(0);
  });
});

describe("liga", () => {
  it("sorteia todos contra todos e grava com a edição em cartaz", async () => {
    const { status } = await chamar("generate_league");
    expect(status).toBe(200);
    expect(liga()).toHaveLength((NOMES.length * (NOMES.length - 1)) / 2);
    expect(jogos().every((m) => m.edition === 1)).toBe(true);
  });

  it("grava o placar e a classificação bate", async () => {
    await chamar("generate_league");
    const j = liga()[0];
    await chamar("save_score", { id: j.id, home_goals: 3, away_goals: 1 });
    const t = computeStandings(banco.players as any, banco.matches as any);
    expect(t.find((r) => r.playerId === j.home_id)!.points).toBe(3);
  });

  it("gol negativo é barrado no servidor também", async () => {
    await chamar("generate_league");
    const j = liga()[0];
    await chamar("save_score", { id: j.id, home_goals: -5, away_goals: 2 });
    expect(banco.matches.find((m) => m.id === j.id)!.home_goals).toBe(0);
  });
});

describe("desistência no servidor", () => {
  it("marca o participante e aplica 3×0 em tudo", async () => {
    await chamar("generate_league");
    const leo = quem("Léo");
    const j = liga().find((m) => m.home_id === leo.id || m.away_id === leo.id)!;
    await chamar("save_score", { id: j.id, home_goals: 7, away_goals: 0 });

    const { status } = await chamar("withdraw", { id: leo.id });
    expect(status).toBe(200);
    expect(quem("Léo").withdrawn).toBe(true);

    const meus = liga().filter((m) => m.home_id === leo.id || m.away_id === leo.id);
    for (const m of meus) {
      const casa = m.home_id === leo.id;
      expect([m.home_goals, m.away_goals]).toEqual(casa ? [0, 3] : [3, 0]);
      expect(m.counts_for_scorers).toBe(false);
    }
    const art = computeScorers(banco.players as any, banco.matches as any);
    expect(art.reduce((s, r) => s + r.goals, 0)).toBe(0);
  });

  it("a marca pega partida criada depois (o buraco da semifinal)", async () => {
    await chamar("generate_league");
    const leo = quem("Léo");
    await chamar("withdraw", { id: leo.id });
    await chamar("generate_league"); // sorteio refeito
    const meus = liga().filter((m) => m.home_id === leo.id || m.away_id === leo.id);
    expect(meus.length).toBeGreaterThan(0);
    expect(meus.every((m) => m.counts_for_scorers === false)).toBe(true);
  });

  it("cancelar devolve a pessoa ao torneio", async () => {
    await chamar("generate_league");
    const leo = quem("Léo");
    await chamar("withdraw", { id: leo.id });
    await chamar("reinstate", { id: leo.id });
    expect(quem("Léo").withdrawn).toBe(false);
  });
});

describe("proteções", () => {
  it("remover quem tem jogos devolve 409 e não apaga nada", async () => {
    await chamar("generate_league");
    const leo = quem("Léo");
    const antes = banco.matches.length;
    const r = await chamar("remove_player", { id: leo.id });
    expect(r.status).toBe(409);
    expect(r.body.error).toMatch(/W\.O\./);
    expect(banco.players.some((p) => p.id === leo.id)).toBe(true);
    expect(banco.matches).toHaveLength(antes);
  });

  it("com force, remove o participante", async () => {
    await chamar("generate_league");
    const leo = quem("Léo");
    const r = await chamar("remove_player", { id: leo.id, force: true });
    expect(r.status).toBe(200);
    expect(banco.players.some((p) => p.id === leo.id)).toBe(false);
  });

  it("mata-mata com empate no corte é barrado", async () => {
    await chamar("generate_league");
    for (const m of liga()) await chamar("save_score", { id: m.id, home_goals: 0, away_goals: 0 });
    const r = await chamar("seed_bracket");
    expect(r.status).toBe(400);
    expect(r.body.error).toMatch(/empate/i);
  });

  it("ação desconhecida não derruba a rota", async () => {
    const r = await chamar("apagar_tudo_por_favor");
    expect(r.status).toBe(400);
  });
});

describe("mata-mata no servidor", () => {
  async function ligaCompleta() {
    await chamar("generate_league");
    const js = liga();
    for (let i = 0; i < js.length; i++) {
      await chamar("save_score", {
        id: js[i].id,
        home_goals: (i * 3) % 7,
        away_goals: (i * 5) % 4,
      });
    }
  }

  it("monta a chave com o Top 6 e propaga o vencedor", async () => {
    await ligaCompleta();
    const r = await chamar("seed_bracket");
    expect(r.status).toBe(200);
    const slots = jogos().filter((m) => m.slot).map((m) => m.slot).sort();
    expect(slots).toEqual(["FINAL", "REP_A", "REP_B", "SF_A", "SF_B", "TERCEIRO"]);

    const repA = jogos().find((m) => m.slot === "REP_A")!;
    await chamar("save_score", { id: repA.id, home_goals: 2, away_goals: 1 });
    expect(jogos().find((m) => m.slot === "SF_A")!.away_id).toBe(repA.home_id);
  });

  it("empate no mata-mata resolve por pênalti", async () => {
    await ligaCompleta();
    await chamar("seed_bracket");
    const repA = jogos().find((m) => m.slot === "REP_A")!;
    await chamar("save_score", {
      id: repA.id,
      home_goals: 1,
      away_goals: 1,
      pen_winner_id: repA.away_id,
    });
    expect(jogos().find((m) => m.slot === "SF_A")!.away_id).toBe(repA.away_id);
  });

  it("corrigir uma fase invalida o placar da seguinte", async () => {
    await ligaCompleta();
    await chamar("seed_bracket");
    const repA = jogos().find((m) => m.slot === "REP_A")!;
    await chamar("save_score", { id: repA.id, home_goals: 3, away_goals: 0 });
    const sfA = jogos().find((m) => m.slot === "SF_A")!;
    await chamar("save_score", { id: sfA.id, home_goals: 2, away_goals: 0 });
    await chamar("save_score", { id: repA.id, home_goals: 0, away_goals: 3 });
    const depois = jogos().find((m) => m.slot === "SF_A")!;
    expect(depois.away_id).toBe(repA.away_id);
    expect(depois.home_goals).toBeNull();
  });
});

describe("edições", () => {
  it("abrir a próxima edição não encosta na anterior", async () => {
    await chamar("generate_league");
    const jogosEd1 = liga(1).length;
    const r = await chamar("new_edition", { copy_players: true });
    expect(r.status).toBe(200);
    expect(banco.config[0].current_edition).toBe(2);
    expect(banco.editions.find((e) => e.id === 1)!.closed_at).toBeTruthy();
    expect(liga(1)).toHaveLength(jogosEd1);
    expect(jogos(2)).toHaveLength(0);
    expect(banco.players.filter((p) => p.edition === 2)).toHaveLength(NOMES.length);
    // ninguém começa a nova edição marcado como desistente
    expect(banco.players.filter((p) => p.edition === 2).every((p) => !p.withdrawn)).toBe(true);
  });

  it("sortear na 2ª edição não apaga os jogos da 1ª", async () => {
    await chamar("generate_league");
    const ids1 = liga(1).map((m) => m.id).sort();
    await chamar("new_edition", { copy_players: true });
    await chamar("generate_league");
    expect(liga(1).map((m) => m.id).sort()).toEqual(ids1);
    expect(liga(2).length).toBeGreaterThan(0);
  });

  it("zerar placares só afeta a edição em cartaz", async () => {
    await chamar("generate_league");
    const j = liga(1)[0];
    await chamar("save_score", { id: j.id, home_goals: 4, away_goals: 2 });
    await chamar("new_edition", { copy_players: true });
    await chamar("generate_league");
    await chamar("reset_scores");
    expect(banco.matches.find((m) => m.id === j.id)!.home_goals).toBe(4);
  });

  it("descartar uma edição sem jogos volta para a anterior", async () => {
    await chamar("generate_league");
    await chamar("new_edition", { copy_players: true });
    const r = await chamar("discard_edition");
    expect(r.status).toBe(200);
    expect(banco.config[0].current_edition).toBe(1);
    expect(banco.editions.some((e) => e.id === 2)).toBe(false);
    expect(banco.editions.find((e) => e.id === 1)!.closed_at).toBeNull();
  });

  it("descartar edição que já tem jogos é barrado", async () => {
    await chamar("new_edition", { copy_players: true });
    await chamar("generate_league");
    const r = await chamar("discard_edition");
    expect(r.status).toBe(400);
    expect(banco.config[0].current_edition).toBe(2);
  });
});

describe("backup (importar estado)", () => {
  it("restaura foto e marca de desistência, e não toca no histórico", async () => {
    await chamar("generate_league");
    const leo = quem("Léo");
    await chamar("set_photo", { id: leo.id, photo: "data:image/jpeg;base64,AAAA" });

    const retrato = {
      config: { ...banco.config[0] },
      players: banco.players.filter((p) => p.edition === 1).map((p) => ({ ...p })),
      matches: banco.matches.filter((m) => m.edition === 1).map((m) => ({ ...m })),
    };

    await chamar("withdraw", { id: leo.id });
    expect(quem("Léo").withdrawn).toBe(true);

    await chamar("import_state", retrato);
    expect(quem("Léo").withdrawn).toBe(false);
    expect(quem("Léo").photo).toBe("data:image/jpeg;base64,AAAA");
    expect(liga(1)).toHaveLength(retrato.matches.length);
  });
});
