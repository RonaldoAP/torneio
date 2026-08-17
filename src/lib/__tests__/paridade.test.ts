import { beforeEach, describe, expect, it, vi } from "vitest";
import { criarBanco, clienteFake, type BancoFake } from "./helpers/fakeSupabase";
import { forEdition } from "../editions";
import type { Match, Player, TournamentState } from "../types";

// ---------------------------------------------------------------------------
// O servidor (route.ts) e o modo local (adminActions.ts) implementam a MESMA
// regra em dois lugares — é o erro mais fácil de cometer no projeto: mudar de
// um lado e esquecer o outro. Aqui os dois recebem o mesmo estado inicial e a
// mesma sequência de ações, e o resultado tem que ser idêntico.
// ---------------------------------------------------------------------------

const SLUG = "slug-de-teste";

let _banco: BancoFake;
vi.mock("@/lib/supabase/admin", () => ({ getAdminClient: () => clienteFake(_banco) }));

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

/** Interface comum: cada lado sabe executar uma ação e devolver seu estado. */
interface Lado {
  nome: string;
  acao: (action: string, payload?: any) => Promise<void>;
  estado: () => { players: Player[]; matches: Match[] };
}

/** Retrato comparável: sem ids (cada lado gera os seus) e em ordem estável. */
function normalizar({ players, matches }: { players: Player[]; matches: Match[] }) {
  const nome = new Map(players.map((p) => [p.id, p.name] as const));
  const n = (id: string | null | undefined) => (id ? (nome.get(id) ?? "?") : null);
  return {
    players: [...players]
      .map((p) => ({ name: p.name, withdrawn: !!p.withdrawn, photo: p.photo ?? null }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    matches: [...matches]
      .map((m) => ({
        stage: m.stage,
        round: m.round,
        slot: m.slot,
        casa: n(m.home_id),
        fora: n(m.away_id),
        golsCasa: m.home_goals,
        golsFora: m.away_goals,
        pen: n(m.pen_winner_id),
        contaArtilharia: m.counts_for_scorers,
      }))
      .sort((a, b) =>
        `${a.stage}|${a.slot}|${a.round}|${a.casa}|${a.fora}`.localeCompare(
          `${b.stage}|${b.slot}|${b.round}|${b.casa}|${b.fora}`,
        ),
      ),
  };
}

describe("servidor e modo local não podem divergir", () => {
  let servidor: Lado;
  let local: Lado;
  let base: TournamentState;

  beforeEach(async () => {
    process.env.ADMIN_SLUG = SLUG;

    // ---- lado local ----
    vi.stubGlobal("window", fakeWindow());
    vi.stubGlobal("CustomEvent", class {} as any);
    vi.resetModules();
    const [{ adminActions }, { readLocal }] = await Promise.all([
      import("../adminActions"),
      import("../localStore"),
    ]);
    const edLocal = () => {
      const s = readLocal();
      const cur = s.config.current_edition ?? 1;
      return { players: forEdition(s.players, cur), matches: forEdition(s.matches, cur) };
    };
    local = {
      nome: "local",
      acao: async (a, p) => void (await adminActions.run(a, p)),
      estado: edLocal,
    };

    // Sorteia no local e usa esse estado como base para os dois lados: o
    // sorteio é aleatório, então comparar exige partir do mesmo ponto.
    await adminActions.run("generate_league");
    const s = readLocal();
    base = {
      config: s.config,
      players: forEdition(s.players, 1).map((p) => ({ ...p })),
      matches: forEdition(s.matches, 1).map((m) => ({ ...m })),
    };

    // ---- lado servidor ----
    _banco = criarBanco([]); // sem participantes: o import traz tudo
    const { POST } = await import("@/app/api/admin/state/route");
    servidor = {
      nome: "servidor",
      acao: async (action, payload) => {
        const res = await POST(
          new Request("http://x", {
            method: "POST",
            headers: { "content-type": "application/json", "x-admin-slug": SLUG },
            body: JSON.stringify({ action, payload }),
          }),
        );
        if (res.status >= 500) throw new Error(`${action}: ${res.status}`);
      },
      estado: () => ({
        players: _banco.players.filter((p) => p.edition === 1) as Player[],
        matches: _banco.matches.filter((m) => m.edition === 1) as Match[],
      }),
    };
    await servidor.acao("import_state", base);
  });

  /** Roda a mesma sequência nos dois e devolve os retratos finais. */
  async function rodar(roteiro: (lado: Lado) => Promise<void>) {
    await roteiro(local);
    await roteiro(servidor);
    return {
      local: normalizar(local.estado()),
      servidor: normalizar(servidor.estado()),
    };
  }

  it("partem exatamente do mesmo estado", async () => {
    expect(normalizar(servidor.estado())).toEqual(normalizar(local.estado()));
  });

  it("placares, desistência e mata-mata terminam idênticos", async () => {
    const idsLiga = base.matches.filter((m) => m.stage === "liga").map((m) => m.id);
    const luis = base.players.find((p) => p.name === "Luis")!;

    const { local: L, servidor: S } = await rodar(async (lado) => {
      // 1) preenche a liga inteira com placares determinísticos
      for (let i = 0; i < idsLiga.length; i++) {
        await lado.acao("save_score", {
          id: idsLiga[i],
          home_goals: (i * 3) % 7,
          away_goals: (i * 5) % 4,
        });
      }
      // 2) alguém desiste no meio
      await lado.acao("withdraw", { id: luis.id });
      // 3) monta o mata-mata a partir da classificação resultante
      await lado.acao("seed_bracket");
      // 4) resolve a repescagem A no empate/pênalti
      const repA = lado.estado().matches.find((m) => m.slot === "REP_A")!;
      await lado.acao("save_score", {
        id: repA.id,
        home_goals: 1,
        away_goals: 1,
        pen_winner_id: repA.home_id,
      });
      // 5) corrige o placar (admin errou)
      await lado.acao("save_score", { id: repA.id, home_goals: 0, away_goals: 2 });
    });

    expect(S.players).toEqual(L.players);
    expect(S.matches).toEqual(L.matches);
  });

  it("zerar placares deixa os dois no mesmo estado", async () => {
    const idsLiga = base.matches.filter((m) => m.stage === "liga").map((m) => m.id);
    // nome vindo da lista semente do modo local
    const gui = base.players.find((p) => p.name === "Gui")!;

    const { local: L, servidor: S } = await rodar(async (lado) => {
      for (let i = 0; i < 10; i++) {
        await lado.acao("save_score", { id: idsLiga[i], home_goals: 2, away_goals: 1 });
      }
      await lado.acao("withdraw", { id: gui.id });
      await lado.acao("reset_scores");
      await lado.acao("reinstate", { id: gui.id });
    });

    expect(S.players).toEqual(L.players);
    expect(S.matches).toEqual(L.matches);
  });

  it("partida de desempate nasce igual dos dois lados", async () => {
    const a = base.players.find((p) => p.name === "Léo")!;
    const b = base.players.find((p) => p.name === "Jhon")!;

    const { local: L, servidor: S } = await rodar(async (lado) => {
      await lado.acao("create_desempate", { home_id: a.id, away_id: b.id });
      const de = lado.estado().matches.find((m) => m.stage === "desempate")!;
      await lado.acao("save_score", { id: de.id, home_goals: 2, away_goals: 1 });
    });

    expect(S.matches).toEqual(L.matches);
    const de = S.matches.find((m) => m.stage === "desempate")!;
    expect(de.contaArtilharia).toBe(false);
  });
});
