"use client";

import { useTournament } from "@/lib/useTournament";
import { PageHeader, LiveBadge, EmptyState, Loading } from "@/components/ui";
import { StandingsTable } from "@/components/StandingsTable";

export default function ClassificacaoPage() {
  const { players, matches, mode, connected, loading } = useTournament();

  return (
    <div className="animate-reveal">
      <PageHeader
        title="Classificação"
        subtitle="Os 8 primeiros avançam ao mata-mata"
        right={<LiveBadge mode={mode} connected={connected} />}
      />

      {loading ? (
        <Loading />
      ) : players.length === 0 ? (
        <EmptyState>
          <p>Sem jogadores para classificar ainda.</p>
        </EmptyState>
      ) : (
        <>
          <StandingsTable players={players} matches={matches} />
          <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-muted">
            <span>
              <span className="mr-1 inline-block h-2 w-2 rounded-full bg-gremio align-middle" />
              Zona de classificação (Top 8)
            </span>
            <span>P pontos · J jogos · V vitórias · E empates · D derrotas</span>
            <span>GP gols pró · GC gols contra · SG saldo</span>
          </p>
        </>
      )}
    </div>
  );
}
