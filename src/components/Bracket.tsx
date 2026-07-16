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
        isWinner ? "text-ink" : faded ? "text-ink-muted/60 line-through decoration-danger/40" : "text-ink-muted"
      }`}
    >
      <span className="flex items-center gap-1.5 truncate">
        {isWinner && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-gremio" />}
        <span className={`truncate text-sm ${label ? "" : "italic text-ink-muted/50"}`}>
          {label ?? "Aguardando…"}
        </span>
        {isPenWinner && <span className="text-[10px] font-semibold text-branco">pên</span>}
      </span>
      <span className={`font-display text-lg leading-none ${isWinner ? "text-gremio" : ""}`}>
        {goals ?? "–"}
      </span>
    </div>
  );
}

export function MatchCard({
  match,
  players,
  title,
  accent = "gremio",
}: {
  match?: Match;
  players: Player[];
  title?: string;
  accent?: "gremio" | "branco";
}) {
  const name = nameMap(players);
  const winner = match ? matchWinner(match) : null;
  const loser = match ? matchLoser(match) : null;
  const penUsed =
    match && match.home_goals != null && match.away_goals != null && match.home_goals === match.away_goals;

  const bothSet = !!match?.home_id && !!match?.away_id;
  const played = match?.home_goals != null && match?.away_goals != null;
  // "a jogar" = os dois definidos mas sem placar → pulsa (ao vivo)
  const liveNext = bothSet && !played;

  const border =
    accent === "branco"
      ? "border-branco/40"
      : liveNext
        ? "border-gremio/50"
        : "border-line";

  return (
    <div
      className={`rounded-xl border ${border} bg-base/50 ${liveNext ? "animate-pulseAzul" : ""}`}
    >
      {title && (
        <div className="flex items-center justify-between border-b border-line px-3 py-1">
          <span className="font-display text-xs tracking-widest text-ink-muted">{title}</span>
          {match && (
            <span
              className={`text-[9px] font-semibold uppercase tracking-wide ${
                played ? "text-gremio" : liveNext ? "text-branco" : "text-ink-muted/50"
              }`}
            >
              {played ? "encerrado" : liveNext ? "a jogar" : "aguardando"}
            </span>
          )}
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
        <div
          className="panel p-5 text-center animate-reveal"
          style={{ borderColor: "rgba(27,157,224,0.5)", boxShadow: "0 0 40px rgba(27,157,224,0.15)" }}
        >
          <div className="font-display text-sm tracking-[0.3em] text-gremio">CAMPEÃO</div>
          <div className="mt-1 font-display text-4xl text-branco sm:text-5xl">🏆 {name(championId)}</div>
          {runnerUpId && (
            <div className="mt-1 text-sm text-ink-muted">Vice-campeão: {name(runnerUpId)}</div>
          )}
          {third && (
            <div className="text-sm text-ink-muted">
              3º lugar: <span className="text-branco">{name(third)}</span>
            </div>
          )}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        {/* Repescagem */}
        <div className="space-y-3">
          <h3 className="font-display text-lg tracking-wide text-ink-muted">Repescagem</h3>
          <MatchCard match={bySlot("REP_A")} players={players} title="4º × 5º" />
          <MatchCard match={bySlot("REP_B")} players={players} title="3º × 6º" />
          <p className="px-1 text-xs text-ink-muted">
            1º e 2º já estão garantidos na semifinal.
          </p>
        </div>

        {/* Semis */}
        <div className="space-y-3 md:pt-9">
          <h3 className="font-display text-lg tracking-wide text-ink-muted">Semifinais</h3>
          <MatchCard match={bySlot("SF_A")} players={players} title="Semi A · 1º × venc. (4º×5º)" />
          <MatchCard match={bySlot("SF_B")} players={players} title="Semi B · 2º × venc. (3º×6º)" />
        </div>

        {/* Final + Terceiro */}
        <div className="space-y-3 md:pt-9">
          <h3 className="font-display text-lg tracking-wide text-gremio">Final</h3>
          <MatchCard match={bySlot("FINAL")} players={players} title="FINAL" accent="branco" />
          <h3 className="pt-2 font-display text-lg tracking-wide text-ink-muted">3º lugar</h3>
          <MatchCard match={bySlot("TERCEIRO")} players={players} title="Disputa de 3º" />
        </div>
      </div>

      <p className="text-center text-xs text-ink-muted">
        O chaveamento avança sozinho: ao lançar cada placar, o vencedor sobe para a próxima fase em
        tempo real.
      </p>
    </div>
  );
}
