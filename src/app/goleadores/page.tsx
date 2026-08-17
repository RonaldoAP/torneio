"use client";

import { useTournament } from "@/lib/useTournament";
import { computeDefense, computeScorers } from "@/lib/scorers";
import { PageHeader, LiveBadge, EmptyState, Loading, Avatar } from "@/components/ui";

export default function GoleadoresPage() {
  const { players, matches, mode, connected, loading } = useTournament();
  const rows = computeScorers(players, matches).filter((r) => r.goals > 0);
  const defesa = computeDefense(players, matches);
  const photoById = new Map(players.map((p) => [p.id, p.photo] as const));

  return (
    <div className="animate-reveal">
      <PageHeader
        title="Goleadores"
        subtitle="Artilharia e melhor defesa — liga + mata-mata (sem W.O., desempate ou pênaltis)"
        right={<LiveBadge mode={mode} connected={connected} />}
      />

      {loading ? (
        <Loading />
      ) : rows.length === 0 && defesa.length === 0 ? (
        <EmptyState>
          <p>Nenhum gol registrado ainda.</p>
        </EmptyState>
      ) : (
        <div className="space-y-6">
        {rows.length > 0 && (
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
                      <span className="truncate font-display text-xl tracking-wide text-ink">{r.name}</span>
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

        {defesa.length > 0 && (
          <section>
            <h2 className="mb-1 font-display text-xl tracking-wide">🧤 Melhor defesa</h2>
            <p className="mb-2 text-xs text-ink-muted">
              Quem sofreu menos gols. Mesma regra da artilharia: não conta W.O. nem partida de
              desempate — por isso pode divergir da coluna GC da classificação.
            </p>
            <div className="panel overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-ink-muted">
                    <th className="px-3 py-2 text-center">#</th>
                    <th className="px-3 py-2 text-left">Participante</th>
                    <th className="px-3 py-2 text-center">Jogos</th>
                    <th className="px-3 py-2 text-center" title="Jogos sem sofrer gol">
                      Sem sofrer
                    </th>
                    <th className="px-3 py-2 text-center">Gols sofridos</th>
                  </tr>
                </thead>
                <tbody>
                  {defesa.map((r, i) => (
                    <tr
                      key={r.playerId}
                      className={`border-b border-line/60 animate-reveal ${i === 0 ? "bg-cyan/[0.06]" : ""}`}
                    >
                      <td className="px-3 py-3.5 text-center">
                        <span
                          className={`inline-grid h-7 w-7 place-items-center rounded-md font-display ${
                            i === 0 ? "bg-cyan/20 text-cyan" : "text-ink-muted"
                          }`}
                        >
                          {i + 1}
                        </span>
                      </td>
                      <td className="px-3 py-3.5 text-left">
                        <span className="flex items-center gap-2.5">
                          <Avatar name={r.name} photo={photoById.get(r.playerId)} size={30} />
                          <span className="truncate font-display text-xl tracking-wide text-ink">{r.name}</span>
                          {i === 0 && (
                            <span className="chip border-cyan/50 text-cyan" title="Melhor defesa">
                              🧤
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="px-3 py-3.5 text-center tabular text-ink-muted">{r.games}</td>
                      <td className="px-3 py-3.5 text-center tabular text-ink-muted">
                        {r.cleanSheets}
                      </td>
                      <td className="px-3 py-3.5 text-center">
                        <span className="font-display text-2xl leading-none text-ink">
                          {r.conceded}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
        </div>
      )}
    </div>
  );
}
