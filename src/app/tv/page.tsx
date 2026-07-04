"use client";

import { useTournament } from "@/lib/useTournament";
import { StandingsTable } from "@/components/StandingsTable";
import { Bracket } from "@/components/Bracket";
import { LiveBadge } from "@/components/ui";

export default function TvPage() {
  const { players, matches, config, mode, connected } = useTournament();
  const hasBracket = matches.some((m) =>
    ["quartas", "semi", "final", "terceiro"].includes(m.stage),
  );
  const showBracket = config.phase !== "liga" && hasBracket;

  return (
    <div className="min-h-dvh px-4 py-6 sm:px-8 sm:py-10">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <div className="font-display text-sm tracking-[0.35em] text-grass">FIFA 26 · AO VIVO</div>
          <h1 className="font-display text-5xl leading-none tracking-wide text-ink sm:text-7xl">
            {config.tournament_name}
          </h1>
        </div>
        <LiveBadge mode={mode} connected={connected} />
      </header>

      {showBracket ? (
        <Bracket players={players} matches={matches} />
      ) : (
        <StandingsTable players={players} matches={matches} big />
      )}
    </div>
  );
}
