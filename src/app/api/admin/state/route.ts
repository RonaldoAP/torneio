import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getAdminClient } from "@/lib/supabase/admin";
import { generateBalancedLeague } from "@/lib/drawConstraints";
import { computeStandings } from "@/lib/standings";
import { seedBracket, recomputeBracket } from "@/lib/bracket";
import {
  FIRST_EDITION,
  makeEdition,
  nextEditionId,
  removalBlockedMessage,
} from "@/lib/editions";
import type { Config, Edition, Match, Player, TournamentState } from "@/lib/types";

export const dynamic = "force-dynamic";

type Db = ReturnType<typeof getAdminClient>;

const NEEDS_MIGRATION =
  "O banco ainda não tem o suporte a edições. Rode o supabase-schema.sql atualizado no SQL Editor do Supabase e tente de novo.";

const DEFAULT_CONFIG: Config = {
  id: 1,
  tournament_name: "Torneio FIFA 26",
  phase: "liga",
  bracket_seeded: false,
  current_edition: FIRST_EDITION,
};

/**
 * O banco já tem o suporte a edições (migração de `supabase-schema.sql` rodada)?
 * Enquanto não tiver, tudo funciona como antes — uma edição só, sem filtros —
 * para o site não quebrar entre o deploy e a migração.
 * Memoiza só o "sim": assim, quando a migração rodar, o processo já quente detecta.
 */
let editionsReady = false;
async function supportsEditions(db: Db): Promise<boolean> {
  if (editionsReady) return true;
  const { error } = await db.from("editions").select("id").limit(1);
  editionsReady = !error;
  return editionsReady;
}

/** Aplica o filtro de edição só quando o banco suporta edições. */
function scoped<T>(query: T, multi: boolean, edition: number): T {
  return multi ? ((query as any).eq("edition", edition) as T) : query;
}

interface LoadedState extends TournamentState {
  /** edição em cartaz */
  edition: number;
  /** o banco suporta edições */
  multi: boolean;
}

async function loadState(): Promise<LoadedState> {
  const db = getAdminClient();
  const multi = await supportsEditions(db);
  const c = await db.from("config").select("*").eq("id", 1).maybeSingle();
  const config = { ...DEFAULT_CONFIG, ...((c.data as Config) ?? {}) };
  const edition = multi ? (config.current_edition ?? FIRST_EDITION) : FIRST_EDITION;

  const [p, m, e] = await Promise.all([
    scoped(db.from("players").select("*").order("created_at", { ascending: true }), multi, edition),
    scoped(db.from("matches").select("*").order("created_at", { ascending: true }), multi, edition),
    multi
      ? db.from("editions").select("*").order("id", { ascending: true })
      : Promise.resolve({ data: [] as Edition[] }),
  ]);

  return {
    players: (p.data as Player[]) ?? [],
    matches: (m.data as Match[]) ?? [],
    editions: (e.data as Edition[]) ?? [],
    config,
    edition,
    multi,
  };
}

/** Após salvar um placar de mata-mata, propaga vencedores para as fases seguintes. */
async function propagateBracket(multi: boolean, edition: number) {
  const db = getAdminClient();
  const { data } = await scoped(db.from("matches").select("*"), multi, edition);
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

/** Carimba a edição nas linhas a inserir (omitido em banco sem migração). */
function stamp<T extends object>(rows: T[], multi: boolean, edition: number): T[] {
  return multi ? rows.map((r) => ({ ...r, edition })) : rows;
}

const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

export async function POST(req: Request) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  let body: { action?: string; payload?: any };
  try {
    body = await req.json();
  } catch {
    return bad("JSON inválido");
  }

  const db = getAdminClient();
  const { action, payload } = body;
  const { edition: ed, multi } = await loadState();

  try {
    switch (action) {
      case "set_config": {
        await db.from("config").update(payload).eq("id", 1);
        // O nome do torneio é o nome da edição em cartaz — mantém os dois iguais.
        if (multi && payload?.tournament_name) {
          await db.from("editions").update({ name: payload.tournament_name }).eq("id", ed);
        }
        break;
      }

      case "add_player": {
        const { players } = await loadState();
        if (players.length >= 12) return bad("Máximo de 12 jogadores.");
        const name = String(payload?.name ?? "").trim();
        if (!name) return bad("Nome vazio.");
        await db.from("players").insert(stamp([{ name }], multi, ed));
        break;
      }

      case "remove_player": {
        // Remover apaga o participante E TODOS os jogos dele. Com jogos na mesa,
        // só passa com confirmação explícita (foi assim que a 1ª edição perdeu
        // 10 partidas já jogadas — ver HANDOFF, incidente do Mosquito).
        const { players, matches } = await loadState();
        if (payload?.force !== true) {
          const blocked = removalBlockedMessage(
            matches,
            payload.id,
            players.find((p) => p.id === payload.id)?.name,
          );
          if (blocked) return NextResponse.json({ error: blocked, needsConfirm: true }, { status: 409 });
        }
        await db.from("players").delete().eq("id", payload.id);
        break;
      }

      case "set_photo": {
        await db.from("players").update({ photo: payload.photo ?? null }).eq("id", payload.id);
        break;
      }

      case "reset_scores": {
        // Zera todos os placares (mantém confrontos e chave), depois repropaga o mata-mata.
        await scoped(
          db
            .from("matches")
            .update({ home_goals: null, away_goals: null, pen_winner_id: null })
            .neq("id", "00000000-0000-0000-0000-000000000000"),
          multi,
          ed,
        );
        await propagateBracket(multi, ed);
        break;
      }

      case "generate_league": {
        // Regerar reinicia a liga: apaga partidas de liga e desempate.
        await scoped(db.from("matches").delete().in("stage", ["liga", "desempate"]), multi, ed);
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
          await db.from("matches").insert(stamp(rows, multi, ed));
        }
        await db.from("config").update({ phase: "liga", bracket_seeded: false }).eq("id", 1);
        break;
      }

      case "save_score": {
        const { id, home_goals, away_goals, pen_winner_id } = payload;
        // Gols nunca negativos (min=0) e sempre inteiros.
        const clampGoal = (v: unknown) =>
          v === "" || v == null ? null : Math.max(0, Math.floor(Number(v) || 0));
        await db
          .from("matches")
          .update({
            home_goals: clampGoal(home_goals),
            away_goals: clampGoal(away_goals),
            pen_winner_id: pen_winner_id || null,
          })
          .eq("id", id);
        // Se for partida de mata-mata, propaga.
        const { data: m } = await db.from("matches").select("stage").eq("id", id).maybeSingle();
        if (m && ["quartas", "semi", "final", "terceiro"].includes((m as any).stage)) {
          await propagateBracket(multi, ed);
        }
        break;
      }

      case "create_desempate": {
        await db.from("matches").insert(
          stamp(
            [
              {
                stage: "desempate",
                round: null,
                home_id: payload.home_id,
                away_id: payload.away_id,
                counts_for_scorers: false,
              },
            ],
            multi,
            ed,
          ),
        );
        break;
      }

      case "delete_match": {
        await db.from("matches").delete().eq("id", payload.id);
        break;
      }

      case "withdraw": {
        // Desistência = W.O. 3×0 para todos os adversários (jogos feitos e a fazer).
        const pid = payload.id as string;
        const { data } = await scoped(db.from("matches").select("*"), multi, ed);
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
        await propagateBracket(multi, ed);
        break;
      }

      case "seed_bracket": {
        const { players, matches } = await loadState();
        const standings = computeStandings(players, matches);
        if (standings.length < 6) {
          return bad("São necessários ao menos 6 jogadores classificados.");
        }
        if (standings.some((r) => r.unresolvedTie)) {
          return bad(
            "Há empate no corte do Top 6. Crie e resolva a partida de desempate antes de montar o mata-mata.",
          );
        }
        const top6 = standings.slice(0, 6).map((r) => r.playerId);
        // Remove partidas de mata-mata anteriores antes de re-semear.
        await scoped(
          db.from("matches").delete().in("stage", ["quartas", "semi", "final", "terceiro"]),
          multi,
          ed,
        );
        await db.from("matches").insert(stamp(seedBracket(top6), multi, ed));
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

      case "set_edition_meta": {
        if (!multi) return bad(NEEDS_MIGRATION);
        const patch = payload as Partial<Edition>;
        const row: Partial<Edition> = {};
        for (const k of ["name", "event_date", "event_time", "event_local", "event_note"] as const) {
          if (patch[k] !== undefined) (row as any)[k] = patch[k];
        }
        if (Object.keys(row).length > 0) {
          await db.from("editions").update(row).eq("id", ed);
          if (row.name) {
            await db.from("config").update({ tournament_name: row.name }).eq("id", 1);
          }
        }
        break;
      }

      case "new_edition": {
        if (!multi) return bad(NEEDS_MIGRATION);
        const state = await loadState();
        const id = nextEditionId(state.editions ?? []);
        const name = String(payload?.name ?? "").trim() || state.config.tournament_name;
        // Arquiva a edição em cartaz — ela passa a viver no /historico.
        await db.from("editions").update({ closed_at: new Date().toISOString() }).eq("id", ed);
        await db.from("editions").insert(makeEdition(id, name));
        if (payload?.copy_players) {
          // Mesma turma, participantes novos: ids próprios da edição (assim
          // remover alguém aqui nunca encosta no histórico).
          const rows = state.players.map((p, i) => ({
            name: p.name,
            photo: p.photo ?? null,
            edition: id,
            created_at: new Date(Date.now() + i).toISOString(),
          }));
          if (rows.length > 0) await db.from("players").insert(rows);
        }
        await db
          .from("config")
          .update({
            tournament_name: name,
            phase: "liga",
            bracket_seeded: false,
            current_edition: id,
          })
          .eq("id", 1);
        break;
      }

      case "discard_edition": {
        // Desfaz a abertura de uma edição — só enquanto ela não tiver jogos.
        if (!multi) return bad(NEEDS_MIGRATION);
        const state = await loadState();
        const prev = (state.editions ?? [])
          .filter((e) => e.id < ed)
          .sort((a, b) => b.id - a.id)[0];
        if (!prev) return bad("Não há edição anterior para voltar.");
        if (state.matches.length > 0) {
          return bad(
            "Esta edição já tem jogos sorteados. Descartá-la apagaria partidas — se é isso mesmo, apague os jogos antes.",
          );
        }
        await db.from("players").delete().eq("edition", ed);
        await db.from("editions").delete().eq("id", ed);
        await db.from("editions").update({ closed_at: null }).eq("id", prev.id);
        const { data: prevMatches } = await db
          .from("matches")
          .select("stage")
          .eq("edition", prev.id);
        const hadBracket = ((prevMatches as { stage: string }[]) ?? []).some((m) =>
          ["quartas", "semi", "final", "terceiro"].includes(m.stage),
        );
        await db
          .from("config")
          .update({
            tournament_name: prev.name,
            current_edition: prev.id,
            phase: hadBracket ? "mata_mata" : "liga",
            bracket_seeded: hadBracket,
          })
          .eq("id", 1);
        break;
      }

      case "import_state": {
        const incoming = payload as TournamentState;
        // Backup completo (traz edições) restaura tudo; backup de uma edição só
        // (o caso do Desfazer) restaura apenas a edição em cartaz.
        const full = multi && !!incoming.editions?.length;
        const anyId = "00000000-0000-0000-0000-000000000000";

        if (full) {
          await db.from("matches").delete().neq("id", anyId);
          await db.from("players").delete().neq("id", anyId);
          for (const e of incoming.editions!) {
            await db.from("editions").upsert(e);
          }
        } else {
          await scoped(db.from("matches").delete().neq("id", anyId), multi, ed);
          await scoped(db.from("players").delete().neq("id", anyId), multi, ed);
        }

        const keepEdition = (row: { edition?: number | null }) =>
          full ? (row.edition ?? FIRST_EDITION) : ed;

        if (incoming.players?.length) {
          await db.from("players").insert(
            incoming.players.map((p) => ({
              id: p.id,
              name: p.name,
              photo: p.photo ?? null,
              created_at: p.created_at,
              ...(multi ? { edition: keepEdition(p) } : {}),
            })),
          );
        }
        if (incoming.matches?.length) {
          await db.from("matches").insert(
            incoming.matches.map((m) => ({
              ...m,
              ...(multi ? { edition: keepEdition(m) } : {}),
            })),
          );
        }
        if (incoming.config) {
          await db
            .from("config")
            .update({
              tournament_name: incoming.config.tournament_name,
              phase: incoming.config.phase,
              bracket_seeded: incoming.config.bracket_seeded,
              ...(multi
                ? { current_edition: full ? (incoming.config.current_edition ?? ed) : ed }
                : {}),
            })
            .eq("id", 1);
        }
        break;
      }

      default:
        return bad("Ação desconhecida.");
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
