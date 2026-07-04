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
    const allIds = players.map((p) => p.id);
    return [...byRound.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([round, games]) => {
        const playing = new Set<string>();
        for (const g of games) {
          if (g.home_id) playing.add(g.home_id);
          if (g.away_id) playing.add(g.away_id);
        }
        const byes = allIds.filter((id) => !playing.has(id));
        return { round, games, byes };
      });
  }, [matches, players]);

  return (
    <div className="animate-reveal">
      <PageHeader
        title="Confrontos"
        subtitle="Fase de liga — turno único"
        right={<LiveBadge mode={mode} connected={connected} />}
      />

      {loading ? (
        <Loading />
      ) : rounds.length === 0 ? (
        <EmptyState>
          <p>A tabela da liga ainda não foi gerada.</p>
          <p className="mt-1 text-sm">O admin gera os confrontos quando as inscrições fecharem.</p>
        </EmptyState>
      ) : (
        <div className="space-y-4">
          {rounds.map(({ round, games, byes }) => (
            <section key={round} className="panel p-3 sm:p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-display text-xl tracking-wide text-ink">Rodada {round}</h2>
                {byes.length > 0 && (
                  <span className="chip">Folga: {byes.map((id) => name(id)).join(", ")}</span>
                )}
              </div>
              <ul className="grid gap-2">
                {games.map((g) => {
                  const played = g.home_goals != null && g.away_goals != null;
                  return (
                    <li
                      key={g.id}
                      className={`grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-xl border px-3 py-2 ${
                        played
                          ? "border-grass/25 bg-grass/5"
                          : "border-line bg-base/40"
                      }`}
                    >
                      <span className="truncate text-right text-ink">{name(g.home_id)}</span>
                      <span className="min-w-[74px] text-center">
                        {played ? (
                          <span className="font-display text-2xl leading-none text-ink">
                            {g.home_goals} <span className="text-ink-muted">×</span> {g.away_goals}
                          </span>
                        ) : (
                          <span className="font-display text-xl leading-none text-ink-muted">VS</span>
                        )}
                      </span>
                      <span className="truncate text-left text-ink">{name(g.away_id)}</span>
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
