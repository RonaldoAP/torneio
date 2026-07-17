import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getAdminClient } from "@/lib/supabase/admin";
import { generateBalancedLeague } from "@/lib/drawConstraints";
import { computeStandings } from "@/lib/standings";
import { seedBracket, recomputeBracket } from "@/lib/bracket";
import type { Match, Player, TournamentState } from "@/lib/types";

export const dynamic = "force-dynamic";

async function loadState(): Promise<TournamentState> {
  const db = getAdminClient();
  const [p, m, c] = await Promise.all([
    db.from("players").select("*").order("created_at", { ascending: true }),
    db.from("matches").select("*").order("created_at", { ascending: true }),
    db.from("config").select("*").eq("id", 1).maybeSingle(),
  ]);
  return {
    players: (p.data as Player[]) ?? [],
    matches: (m.data as Match[]) ?? [],
    config: (c.data as TournamentState["config"]) ?? {
      id: 1,
      tournament_name: "Torneio FIFA 26",
      phase: "liga",
      bracket_seeded: false,
    },
  };
}

/** Após salvar um placar de mata-mata, propaga vencedores para as fases seguintes. */
async function propagateBracket() {
  const db = getAdminClient();
  const { data } = await db.from("matches").select("*");
  const matches = (data as Match[]) ?? [];
  const updates = recomputeBracket(matches);
  for (const u of updates) {
    const patch: Partial<Match> = { home_id: u.home_id, away_id: u.away_id };
    if (u.clearScore) {
      patch.home_goals = null;
      patch.away_goals = null;
      patch.pen_winner_id = null;
    }
    await db.from("matches").update(patch).eq("id", u.id);
  }
}

export async function POST(req: Request) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  let body: { action?: string; payload?: any };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const db = getAdminClient();
  const { action, payload } = body;

  try {
    switch (action) {
      case "set_config": {
        await db.from("config").update(payload).eq("id", 1);
        break;
      }

      case "add_player": {
        const { players } = await loadState();
        if (players.length >= 12) {
          return NextResponse.json({ error: "Máximo de 12 jogadores." }, { status: 400 });
        }
        const name = String(payload?.name ?? "").trim();
        if (!name) return NextResponse.json({ error: "Nome vazio." }, { status: 400 });
        await db.from("players").insert({ name });
        break;
      }

      case "remove_player": {
        await db.from("players").delete().eq("id", payload.id);
        break;
      }

      case "set_photo": {
        await db.from("players").update({ photo: payload.photo ?? null }).eq("id", payload.id);
        break;
      }

      case "reset_scores": {
        // Zera todos os placares (mantém confrontos e chave), depois repropaga o mata-mata.
        await db
          .from("matches")
          .update({ home_goals: null, away_goals: null, pen_winner_id: null })
          .neq("id", "00000000-0000-0000-0000-000000000000");
        await propagateBracket();
        break;
      }

      case "generate_league": {
        // Regerar reinicia a liga: apaga partidas de liga e desempate.
        await db.from("matches").delete().in("stage", ["liga", "desempate"]);
        const { players } = await loadState();
        const { games } = generateBalancedLeague(players);
        if (games.length > 0) {
          // created_at explícito e crescente: a leitura é ordenada por
          // created_at, então isso preserva a ordem de disputa (o descanso
          // entre jogos calculado no sorteio). Insert em lote usa now() igual
          // pra todas as linhas, o que deixaria a ordem interna indefinida.
          const base = Date.now();
          const rows = games.map((g, i) => ({
            stage: "liga" as const,
            round: g.round,
            home_id: g.homeId,
            away_id: g.awayId,
            counts_for_scorers: true,
            created_at: new Date(base + i).toISOString(),
          }));
          await db.from("matches").insert(rows);
        }
        await db.from("config").update({ phase: "liga", bracket_seeded: false }).eq("id", 1);
        break;
      }

      case "save_score": {
        const { id, home_goals, away_goals, pen_winner_id } = payload;
        await db
          .from("matches")
          .update({
            home_goals: home_goals === "" || home_goals == null ? null : Number(home_goals),
            away_goals: away_goals === "" || away_goals == null ? null : Number(away_goals),
            pen_winner_id: pen_winner_id || null,
          })
          .eq("id", id);
        // Se for partida de mata-mata, propaga.
        const { data: m } = await db.from("matches").select("stage").eq("id", id).maybeSingle();
        if (m && ["quartas", "semi", "final", "terceiro"].includes((m as any).stage)) {
          await propagateBracket();
        }
        break;
      }

      case "create_desempate": {
        await db.from("matches").insert({
          stage: "desempate",
          round: null,
          home_id: payload.home_id,
          away_id: payload.away_id,
          counts_for_scorers: false,
        });
        break;
      }

      case "delete_match": {
        await db.from("matches").delete().eq("id", payload.id);
        break;
      }

      case "withdraw": {
        // Desistência = W.O. 3×0 para todos os adversários (jogos feitos e a fazer).
        const pid = payload.id as string;
        const { data } = await db.from("matches").select("*");
        const all = (data as Match[]) ?? [];
        for (const m of all) {
          if (m.stage === "desempate") continue;
          const isHome = m.home_id === pid;
          const isAway = m.away_id === pid;
          if ((!isHome && !isAway) || !m.home_id || !m.away_id) continue;
          const goals = isHome ? { home_goals: 0, away_goals: 3 } : { home_goals: 3, away_goals: 0 };
          await db
            .from("matches")
            .update({ ...goals, pen_winner_id: null, counts_for_scorers: false })
            .eq("id", m.id);
        }
        await propagateBracket();
        break;
      }

      case "seed_bracket": {
        const { players, matches } = await loadState();
        const standings = computeStandings(players, matches);
        if (standings.length < 6) {
          return NextResponse.json(
            { error: "São necessários ao menos 6 jogadores classificados." },
            { status: 400 },
          );
        }
        const top6 = standings.slice(0, 6).map((r) => r.playerId);
        // Remove partidas de mata-mata anteriores antes de re-semear.
        await db
          .from("matches")
          .delete()
          .in("stage", ["quartas", "semi", "final", "terceiro"]);
        const bracket = seedBracket(top6);
        await db.from("matches").insert(bracket);
        await db.from("config").update({ phase: "mata_mata", bracket_seeded: true }).eq("id", 1);
        break;
      }

      case "close_tournament": {
        await db.from("config").update({ phase: "encerrado" }).eq("id", 1);
        break;
      }

      case "reopen": {
        await db.from("config").update({ phase: payload?.phase ?? "mata_mata" }).eq("id", 1);
        break;
      }

      case "import_state": {
        const state = payload as TournamentState;
        await db.from("matches").delete().neq("id", "00000000-0000-0000-0000-000000000000");
        await db.from("players").delete().neq("id", "00000000-0000-0000-0000-000000000000");
        if (state.players?.length) {
          await db.from("players").insert(
            state.players.map((p) => ({ id: p.id, name: p.name, created_at: p.created_at })),
          );
        }
        if (state.matches?.length) {
          await db.from("matches").insert(state.matches);
        }
        if (state.config) {
          await db
            .from("config")
            .update({
              tournament_name: state.config.tournament_name,
              phase: state.config.phase,
              bracket_seeded: state.config.bracket_seeded,
            })
            .eq("id", 1);
        }
        break;
      }

      default:
        return NextResponse.json({ error: "Ação desconhecida." }, { status: 400 });
    }

    const state = await loadState();
    return NextResponse.json({ ok: true, state });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Erro interno" }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const state = await loadState();
  return NextResponse.json({ ok: true, state });
}
