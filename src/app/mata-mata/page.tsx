"use client";

import { useMemo } from "react";
import { useTournament } from "@/lib/useTournament";
import { PageHeader, LiveBadge, EmptyState, Loading } from "@/components/ui";
import { Bracket } from "@/components/Bracket";
import { computeStandings } from "@/lib/standings";
import { seedBracket } from "@/lib/bracket";
import type { Match } from "@/lib/types";

const KO_STAGES = ["quartas", "semi", "final", "terceiro"];

export default function MataMataPage() {
  const { players, matches, config, mode, connected, loading } = useTournament();
  const hasBracket = matches.some((m) => KO_STAGES.includes(m.stage));

  // Prévia ao vivo: enquanto o mata-mata não é montado, projeta a chave com a
  // classificação atual (Top 6). Muda sozinho a cada resultado.
  const standings = computeStandings(players, matches);
  const projected = useMemo<Match[]>(() => {
    if (hasBracket || standings.length < 6) return [];
    const top6 = standings.slice(0, 6).map((r) => r.playerId);
    return seedBracket(top6).map((s) => ({
      id: `proj-${s.slot}`,
      stage: s.stage!,
      round: null,
      home_id: s.home_id ?? null,
      away_id: s.away_id ?? null,
      home_goals: null,
      away_goals: null,
      pen_winner_id: null,
      counts_for_scorers: true,
      slot: s.slot ?? null,
      created_at: "",
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasBracket, JSON.stringify(standings.map((r) => r.playerId))]);

  const anyPlayed = matches.some(
    (m) => m.stage === "liga" && m.home_goals != null && m.away_goals != null,
  );

  return (
    <div className="animate-reveal">
      <PageHeader
        title="Mata-mata"
        subtitle="Repescagem → Semis → Final · 1º e 2º já na semi · jogo único (empate → prorrogação → pênaltis)"
        right={<LiveBadge mode={mode} connected={connected} />}
      />

      {loading ? (
        <Loading />
      ) : hasBracket ? (
        <Bracket players={players} matches={matches} />
      ) : projected.length > 0 ? (
        <div className="space-y-4">
          <div className="panel flex items-start gap-3 border-cyan/30 p-3.5">
            <span className="mt-0.5 h-2.5 w-2.5 shrink-0 animate-pulseAzul rounded-full bg-cyan" />
            <div>
              <p className="font-display tracking-wide text-cyan">Prévia ao vivo</p>
              <p className="text-sm text-ink-muted">
                {anyPlayed
                  ? "Projeção com a classificação atual — o chaveamento muda a cada resultado. Vira oficial quando o admin montar o mata-mata."
                  : "Assim que os jogos começarem, a chave se monta aqui com a classificação do momento."}
              </p>
            </div>
          </div>
          <Bracket players={players} matches={projected} />
        </div>
      ) : (
        <EmptyState>
          <p>O mata-mata ainda não foi montado.</p>
          <p className="mt-1 text-sm">
            Ele é semeado com o Top 6 — aparece uma prévia aqui assim que houver 6 participantes.
          </p>
        </EmptyState>
      )}
    </div>
  );
}
