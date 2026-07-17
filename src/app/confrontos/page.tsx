"use client";

import { useMemo } from "react";
import { useTournament } from "@/lib/useTournament";
import { PageHeader, LiveBadge, EmptyState, Loading, Avatar } from "@/components/ui";
import type { Match, Player } from "@/lib/types";

export default function ConfrontosPage() {
  const { players, matches, mode, connected, loading } = useTournament();
  const byId = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);

  const rounds = useMemo(() => {
    const liga = matches.filter((m) => m.stage === "liga");
    const byRound = new Map<number, Match[]>();
    for (const m of liga) {
      const r = m.round ?? 0;
      if (!byRound.has(r)) byRound.set(r, []);
      byRound.get(r)!.push(m);
    }
    return [...byRound.entries()].sort((a, b) => a[0] - b[0]).map(([round, games]) => ({ round, games }));
  }, [matches]);

  const hasGames = rounds.length > 0;

  return (
    <div className="animate-reveal">
      <PageHeader
        title="Confrontos"
        subtitle="Fase de liga — todos contra todos, turno único"
        right={<LiveBadge mode={mode} connected={connected} />}
      />

      {loading ? (
        <Loading />
      ) : !hasGames ? (
        <EmptyState>
          <p>A tabela da liga ainda não foi sorteada.</p>
          <p className="mt-1 text-sm">O admin realiza o sorteio dos jogos no painel.</p>
        </EmptyState>
      ) : (
        <div className="space-y-5">
          {rounds.map(({ round, games }) => (
            <section key={round}>
              <h2 className="mb-2 flex items-center gap-2 px-1 font-display text-sm uppercase tracking-[0.15em] text-ink-muted">
                <span className="text-cyan">{round}ª</span> Rodada
              </h2>
              <div className="panel divide-y divide-line/60">
                {games.map((g) => (
                  <MatchRow key={g.id} game={g} byId={byId} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function MatchRow({ game, byId }: { game: Match; byId: Map<string, Player> }) {
  const home = game.home_id ? byId.get(game.home_id) : undefined;
  const away = game.away_id ? byId.get(game.away_id) : undefined;
  const played = game.home_goals != null && game.away_goals != null;
  const homeWin = played && (game.home_goals as number) > (game.away_goals as number);
  const awayWin = played && (game.away_goals as number) > (game.home_goals as number);

  const nameCls = (win: boolean, lose: boolean) =>
    `truncate font-semibold ${win ? "text-emerald-400" : lose ? "text-danger" : "text-ink"}`;
  const scoreCls = (win: boolean, lose: boolean) =>
    win ? "text-emerald-400" : lose ? "text-danger" : "text-white";

  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 py-2.5 sm:gap-4">
      {/* mandante: nome + foto */}
      <div className="flex min-w-0 items-center justify-end gap-2.5">
        <span className={nameCls(homeWin, awayWin)}>{home?.name ?? "—"}</span>
        <Avatar name={home?.name ?? "?"} photo={home?.photo} size={36} />
      </div>

      {/* placar */}
      <div className="min-w-[68px] text-center">
        {played ? (
          <span className="font-display text-2xl leading-none tracking-tight">
            <span className={scoreCls(homeWin, awayWin)}>{game.home_goals}</span>
            <span className="mx-1 text-ink-muted/60">×</span>
            <span className={scoreCls(awayWin, homeWin)}>{game.away_goals}</span>
          </span>
        ) : (
          <span className="rounded-md border border-line px-2 py-0.5 font-display text-xs tracking-widest text-ink-muted">
            VS
          </span>
        )}
      </div>

      {/* visitante: foto + nome */}
      <div className="flex min-w-0 items-center gap-2.5">
        <Avatar name={away?.name ?? "?"} photo={away?.photo} size={36} />
        <span className={nameCls(awayWin, homeWin)}>{away?.name ?? "—"}</span>
      </div>
    </div>
  );
}
