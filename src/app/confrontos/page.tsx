"use client";

import { useMemo } from "react";
import { useTournament } from "@/lib/useTournament";
import { PageHeader, LiveBadge, EmptyState, Loading, useNameMap } from "@/components/ui";
import type { Match } from "@/lib/types";

export default function ConfrontosPage() {
  const { players, matches, mode, connected, loading } = useTournament();
  const name = useNameMap(players);

  const rounds = useMemo(() => {
    const liga = matches.filter((m) => m.stage === "liga");
    const byRound = new Map<number, Match[]>();
    for (const m of liga) {
      const r = m.round ?? 0;
      if (!byRound.has(r)) byRound.set(r, []);
      byRound.get(r)!.push(m);
    }
    return [...byRound.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([round, games]) => ({ round, games }));
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
        <div className="space-y-4">
          {rounds.map(({ round, games }) => (
            <section key={round} className="panel p-3 sm:p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-display text-xl tracking-wide text-ink">Rodada {round}</h2>
              </div>
              <ul className="grid gap-2">
                {games.map((g) => {
                  const played = g.home_goals != null && g.away_goals != null;
                  const homeWin = played && (g.home_goals as number) > (g.away_goals as number);
                  const awayWin = played && (g.away_goals as number) > (g.home_goals as number);

                  const win = "text-emerald-400 font-semibold";
                  const lose = "text-danger";
                  const homeCls = homeWin ? win : awayWin ? lose : "text-ink";
                  const awayCls = awayWin ? win : homeWin ? lose : "text-ink";

                  return (
                    <li
                      key={g.id}
                      className={`grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-xl border px-3 py-2 ${
                        played ? "border-line bg-white/[0.03]" : "border-line bg-base/40"
                      }`}
                    >
                      <span className={`truncate text-right ${played ? homeCls : "text-ink"}`}>
                        {name(g.home_id)}
                      </span>
                      <span className="min-w-[74px] text-center">
                        {played ? (
                          <span className="font-display text-2xl leading-none">
                            <span className={homeCls}>{g.home_goals}</span>
                            <span className="text-ink-muted"> × </span>
                            <span className={awayCls}>{g.away_goals}</span>
                          </span>
                        ) : (
                          <span className="font-display text-xl leading-none text-ink-muted">VS</span>
                        )}
                      </span>
                      <span className={`truncate text-left ${played ? awayCls : "text-ink"}`}>
                        {name(g.away_id)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
