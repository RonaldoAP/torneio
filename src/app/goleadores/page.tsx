"use client";

import { useTournament } from "@/lib/useTournament";
import { computeScorers } from "@/lib/scorers";
import { PageHeader, LiveBadge, EmptyState, Loading, Avatar } from "@/components/ui";

export default function GoleadoresPage() {
  const { players, matches, mode, connected, loading } = useTournament();
  const rows = computeScorers(players, matches).filter((r) => r.goals > 0);
  const photoById = new Map(players.map((p) => [p.id, p.photo] as const));

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
        <div className="panel overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-ink-muted">
                <th className="px-3 py-2 text-center">#</th>
                <th className="px-3 py-2 text-left">Participante</th>
                <th className="px-3 py-2 text-center">Jogos</th>
                <th className="px-3 py-2 text-center">Gols marcados</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr
                  key={r.playerId}
                  className={`border-b border-line/60 animate-reveal ${i === 0 ? "bg-gremio/[0.06]" : ""}`}
                >
                  <td className="px-3 py-3.5 text-center">
                    <span
                      className={`inline-grid h-7 w-7 place-items-center rounded-md font-display ${
                        i === 0 ? "bg-gremio/20 text-gremio" : "text-ink-muted"
                      }`}
                    >
                      {i + 1}
                    </span>
                  </td>
                  <td className="px-3 py-3.5 text-left">
                    <span className="flex items-center gap-2.5">
                      <Avatar name={r.name} photo={photoById.get(r.playerId)} size={30} />
                      <span className="truncate font-semibold text-ink">{r.name}</span>
                      {i === 0 && (
                        <span className="chip border-gremio/50 text-gremio" title="Artilheiro">
                          ⚽
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="px-3 py-3.5 text-center tabular text-ink-muted">{r.games}</td>
                  <td className="px-3 py-3.5 text-center">
                    <span className="font-display text-2xl leading-none text-ink">{r.goals}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
