"use client";

import { useMemo } from "react";
import { useTournament } from "@/lib/useTournament";
import { PageHeader, LiveBadge, EmptyState, Loading } from "@/components/ui";
import { MatchRow } from "@/components/MatchRow";
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
    const arr = [...byRound.entries()].map(([round, games]) => ({
      round,
      games,
      // rodada encerrada = todos os jogos com placar lançado
      finished:
        games.length > 0 && games.every((g) => g.home_goals != null && g.away_goals != null),
    }));
    // Rodadas em andamento no topo (a atual sempre visível); as encerradas
    // descem para o fim da fila. Dentro de cada grupo, ordem crescente.
    arr.sort((a, b) => {
      if (a.finished !== b.finished) return a.finished ? 1 : -1;
      return a.round - b.round;
    });
    return arr;
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
          {rounds.map(({ round, games, finished }, i) => {
            const isCurrent = !finished && i === 0;
            return (
            <section key={round} className={finished ? "opacity-60" : ""}>
              <h2 className="mb-2 flex items-center gap-2 px-1 font-display text-sm uppercase tracking-[0.15em] text-ink-muted">
                <span className="text-cyan">{round}ª</span> Rodada
                {isCurrent && (
                  <span className="chip border-cyan/50 text-cyan">jogando agora</span>
                )}
                {finished && (
                  <span className="chip border-line text-ink-muted/70">encerrada</span>
                )}
              </h2>
              <div className="panel divide-y divide-line/60">
                {games.map((g) => (
                  <MatchRow
                    key={g.id}
                    home={g.home_id ? byId.get(g.home_id) : undefined}
                    away={g.away_id ? byId.get(g.away_id) : undefined}
                    homeGoals={g.home_goals}
                    awayGoals={g.away_goals}
                    penWinnerId={g.pen_winner_id}
                  />
                ))}
              </div>
            </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
