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
        subtitle="Os 6 primeiros avançam ao mata-mata"
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
              <span className="mr-1 inline-block h-2 w-2 rounded-full bg-cyan align-middle" />
              Zona de classificação (Top 6) · 1º e 2º vão direto à semifinal
            </span>
            <span>Pts pontos · PJ jogos · V vitórias · E empates · D derrotas</span>
            <span>GM gols marcados · GC gols sofridos · SG saldo (3º critério de desempate)</span>
          </p>
        </>
      )}
    </div>
  );
}
