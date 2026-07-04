"use client";

import { useTournament } from "@/lib/useTournament";
import { computeScorers } from "@/lib/scorers";
import { PageHeader, LiveBadge, EmptyState, Loading } from "@/components/ui";

export default function GoleadoresPage() {
  const { players, matches, mode, connected, loading } = useTournament();
  const rows = computeScorers(players, matches).filter((r) => r.goals > 0);
  const max = rows[0]?.goals ?? 0;

  return (
    <div className="animate-reveal">
      <PageHeader
        title="Goleadores"
        subtitle="Artilharia — liga + mata-mata (sem desempate e sem pênaltis)"
        right={<LiveBadge mode={mode} connected={connected} />}
      />

      {loading ? (
        <Loading />
      ) : rows.length === 0 ? (
        <EmptyState>
          <p>Nenhum gol registrado ainda.</p>
        </EmptyState>
      ) : (
        <ol className="space-y-2">
          {rows.map((r, i) => (
            <li key={r.playerId} className="panel flex items-center gap-3 p-3 animate-reveal">
              <span
                className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg font-display text-lg ${
                  i === 0 ? "bg-gold/20 text-gold" : "bg-white/5 text-ink-muted"
                }`}
              >
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-ink">{r.name}</span>
                  <span className="shrink-0 text-xs text-ink-muted">{r.games} jogos</span>
                </div>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-white/5">
                  <div
                    className={`h-full rounded-full ${i === 0 ? "bg-gold" : "bg-grass"}`}
                    style={{ width: `${max ? (r.goals / max) * 100 : 0}%` }}
                  />
                </div>
              </div>
              <span className="font-display text-3xl leading-none text-ink">{r.goals}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
