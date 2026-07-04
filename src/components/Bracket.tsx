"use client";

import type { Match, Player, Slot } from "@/lib/types";
import { matchWinner, matchLoser } from "@/lib/standings";
import { championAndRunnerUp, thirdPlace } from "@/lib/bracket";

function nameMap(players: Player[]) {
  const m = new Map(players.map((p) => [p.id, p.name] as const));
  return (id: string | null) => (id ? m.get(id) ?? "?" : null);
}

function Side({
  label,
  goals,
  isWinner,
  isPenWinner,
  faded,
}: {
  label: string | null;
  goals: number | null;
  isWinner: boolean;
  isPenWinner: boolean;
  faded: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-2 px-3 py-1.5 ${
        isWinner ? "text-ink" : faded ? "text-ink-muted/60" : "text-ink-muted"
      }`}
    >
      <span className="flex items-center gap-1.5 truncate">
        {isWinner && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-grass" />}
        <span className="truncate text-sm">{label ?? "—"}</span>
        {isPenWinner && <span className="text-[10px] text-gold">pên</span>}
      </span>
      <span className={`font-display text-lg leading-none ${isWinner ? "text-grass" : ""}`}>
        {goals ?? "–"}
      </span>
    </div>
  );
}

export function MatchCard({
  match,
  players,
  title,
  accent = "grass",
}: {
  match?: Match;
  players: Player[];
  title?: string;
  accent?: "grass" | "gold";
}) {
  const name = nameMap(players);
  const winner = match ? matchWinner(match) : null;
  const loser = match ? matchLoser(match) : null;
  const penUsed =
    match && match.home_goals != null && match.away_goals != null && match.home_goals === match.away_goals;
  const border = accent === "gold" ? "border-gold/40" : "border-line";

  return (
    <div className={`rounded-xl border ${border} bg-base/50`}>
      {title && (
        <div className="border-b border-line px-3 py-1 font-display text-xs tracking-widest text-ink-muted">
          {title}
        </div>
      )}
      <div className="divide-y divide-line/60">
        <Side
          label={match ? name(match.home_id) : null}
          goals={match?.home_goals ?? null}
          isWinner={!!winner && winner === match?.home_id}
          isPenWinner={!!penUsed && match?.pen_winner_id === match?.home_id && match?.home_id != null}
          faded={!!loser && loser === match?.home_id}
        />
        <Side
          label={match ? name(match.away_id) : null}
          goals={match?.away_goals ?? null}
          isWinner={!!winner && winner === match?.away_id}
          isPenWinner={!!penUsed && match?.pen_winner_id === match?.away_id && match?.away_id != null}
          faded={!!loser && loser === match?.away_id}
        />
      </div>
    </div>
  );
}

export function Bracket({ players, matches }: { players: Player[]; matches: Match[] }) {
  const name = nameMap(players);
  const bySlot = (s: Slot) => matches.find((m) => m.slot === s);
  const { championId, runnerUpId } = championAndRunnerUp(matches);
  const third = thirdPlace(matches);

  return (
    <div className="space-y-5">
      {championId && (
        <div className="panel border-gold/40 p-5 text-center animate-reveal" style={{ borderColor: "rgba(245,196,81,0.4)" }}>
          <div className="font-display text-sm tracking-[0.3em] text-gold">CAMPEÃO</div>
          <div className="mt-1 font-display text-4xl text-gold sm:text-5xl">🏆 {name(championId)}</div>
          {runnerUpId && (
            <div className="mt-1 text-sm text-ink-muted">Vice-campeão: {name(runnerUpId)}</div>
          )}
          {third && <div className="text-sm text-ink-muted">3º lugar: {name(third)}</div>}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        {/* Quartas */}
        <div className="space-y-3">
          <h3 className="font-display text-lg tracking-wide text-ink-muted">Quartas</h3>
          <MatchCard match={bySlot("QF1")} players={players} title="QF1 · 1º × 8º" />
          <MatchCard match={bySlot("QF2")} players={players} title="QF2 · 4º × 5º" />
          <MatchCard match={bySlot("QF3")} players={players} title="QF3 · 2º × 7º" />
          <MatchCard match={bySlot("QF4")} players={players} title="QF4 · 3º × 6º" />
        </div>

        {/* Semis */}
        <div className="space-y-3 md:pt-9">
          <h3 className="font-display text-lg tracking-wide text-ink-muted">Semifinais</h3>
          <MatchCard match={bySlot("SF_A")} players={players} title="Semi A" />
          <MatchCard match={bySlot("SF_B")} players={players} title="Semi B" />
        </div>

        {/* Final + Terceiro */}
        <div className="space-y-3 md:pt-9">
          <h3 className="font-display text-lg tracking-wide text-gold">Final</h3>
          <MatchCard match={bySlot("FINAL")} players={players} title="FINAL" accent="gold" />
          <h3 className="pt-2 font-display text-lg tracking-wide text-ink-muted">3º lugar</h3>
          <MatchCard match={bySlot("TERCEIRO")} players={players} title="Disputa de 3º" />
        </div>
      </div>
    </div>
  );
}
