"use client";

import { useTournament } from "@/lib/useTournament";
import { PageHeader, LiveBadge, EmptyState, Loading } from "@/components/ui";
import { Bracket } from "@/components/Bracket";

export default function MataMataPage() {
  const { players, matches, config, mode, connected, loading } = useTournament();
  const hasBracket = matches.some((m) =>
    ["quartas", "semi", "final", "terceiro"].includes(m.stage),
  );

  return (
    <div className="animate-reveal">
      <PageHeader
        title="Mata-mata"
        subtitle="Quartas → Semis → Final · jogo único (empate → prorrogação → pênaltis)"
        right={<LiveBadge mode={mode} connected={connected} />}
      />

      {loading ? (
        <Loading />
      ) : !hasBracket ? (
        <EmptyState>
          <p>O mata-mata ainda não foi montado.</p>
          <p className="mt-1 text-sm">
            {config.phase === "liga"
              ? "Ele é semeado com o Top 8 quando a liga terminar."
              : "Aguardando a montagem do chaveamento pelo admin."}
          </p>
        </EmptyState>
      ) : (
        <Bracket players={players} matches={matches} />
      )}
    </div>
  );
}
