"use client";

import { useLayoutEffect, useRef, useState } from "react";
import type { Match, Player, Slot } from "@/lib/types";
import { matchWinner, matchLoser } from "@/lib/standings";
import { championAndRunnerUp, thirdPlace } from "@/lib/bracket";
import { Avatar } from "@/components/ui";
import { MatchRow } from "@/components/MatchRow";

/* ------------------------------------------------------------------ *
 * Card compacto (duas linhas) usado no organograma do telão/desktop. *
 * ------------------------------------------------------------------ */
function TreeSide({
  player,
  goals,
  isWinner,
  isLoser,
  isPenWinner,
  seed,
}: {
  player?: Player;
  goals: number | null;
  isWinner: boolean;
  isLoser: boolean;
  isPenWinner: boolean;
  seed?: string;
}) {
  return (
    <div className="flex items-center gap-2 px-2.5 py-2">
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${isWinner ? "bg-emerald-400" : "bg-transparent"}`} />
      {seed && (
        <span className="shrink-0 rounded bg-white/[0.06] px-1.5 text-[9px] font-bold text-ink-muted">{seed}</span>
      )}
      <Avatar name={player?.name ?? "?"} photo={player?.photo} size={24} />
      <span
        className={`flex-1 truncate text-[13px] font-semibold ${
          !player
            ? "italic text-ink-muted/50"
            : isWinner
              ? "text-emerald-400"
              : isLoser
                ? "text-ink-muted"
                : "text-ink"
        }`}
      >
        {player?.name ?? "Aguardando…"}
      </span>
      {isPenWinner && <span className="shrink-0 rounded border border-cyan px-1 text-[9px] font-bold text-cyan">pên</span>}
      <span
        className={`min-w-[16px] text-center font-display text-[15px] tabular-nums ${
          isWinner ? "text-emerald-400" : isLoser ? "text-ink-muted" : "text-ink"
        }`}
      >
        {goals ?? "–"}
      </span>
    </div>
  );
}

function TreeCard({
  match,
  byId,
  caption,
  seedHome,
  seedAway,
  variant = "default",
  cardRef,
}: {
  match?: Match;
  byId: Map<string, Player>;
  caption: string;
  seedHome?: string;
  seedAway?: string;
  variant?: "default" | "final" | "third";
  cardRef?: React.Ref<HTMLDivElement>;
}) {
  const home = match?.home_id ? byId.get(match.home_id) : undefined;
  const away = match?.away_id ? byId.get(match.away_id) : undefined;
  const winner = match ? matchWinner(match) : null;
  const loser = match ? matchLoser(match) : null;
  const played = match != null && match.home_goals != null && match.away_goals != null;
  const tie = played && match!.home_goals === match!.away_goals;
  const bothSet = !!match?.home_id && !!match?.away_id;
  const liveNext = bothSet && !played;

  const border =
    variant === "final" ? "border-cyan/45" : liveNext ? "border-gremio/50" : "border-line";
  const glow = variant === "final" ? "shadow-[0_0_40px_rgba(59,91,255,0.30)]" : "shadow-[0_10px_30px_rgba(2,6,30,0.45)]";
  const width = variant === "default" ? "" : "w-[210px]";

  return (
    <div ref={cardRef} className={`relative z-10 rounded-xl border bg-base/85 ${border} ${glow} ${width} ${liveNext ? "animate-pulseAzul" : ""}`}>
      <div className="flex items-center justify-between border-b border-line px-2.5 py-1.5">
        <span className={`font-display text-[10px] uppercase tracking-[0.14em] ${variant === "final" ? "text-cyan" : "text-ink-muted"}`}>
          {caption}
        </span>
        {match && (
          <span className={`text-[8.5px] font-semibold uppercase tracking-wide ${played ? "text-cyan" : liveNext ? "text-branco" : "text-ink-muted/50"}`}>
            {played ? "fim" : liveNext ? "a jogar" : "aguard."}
          </span>
        )}
      </div>
      <div className="divide-y divide-line/60">
        <TreeSide
          player={home}
          goals={match?.home_goals ?? null}
          isWinner={!!winner && winner === match?.home_id}
          isLoser={!!loser && loser === match?.home_id}
          isPenWinner={tie && match?.pen_winner_id === match?.home_id && match?.home_id != null}
          seed={seedHome}
        />
        <TreeSide
          player={away}
          goals={match?.away_goals ?? null}
          isWinner={!!winner && winner === match?.away_id}
          isLoser={!!loser && loser === match?.away_id}
          isPenWinner={tie && match?.pen_winner_id === match?.away_id && match?.away_id != null}
          seed={seedAway}
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Bracket: organograma no telão/desktop, fases empilhadas no celular *
 * ------------------------------------------------------------------ */
export function Bracket({ players, matches }: { players: Player[]; matches: Match[] }) {
  const byId = new Map(players.map((p) => [p.id, p] as const));
  const name = (id: string | null) => (id ? byId.get(id)?.name ?? "?" : null);
  const bySlot = (s: Slot) => matches.find((m) => m.slot === s);
  const { championId, runnerUpId } = championAndRunnerUp(matches);
  const third = thirdPlace(matches);

  // ---- conectores do organograma (SVG desenhado sobre as posições reais) ----
  const wrapRef = useRef<HTMLDivElement>(null);
  const repARef = useRef<HTMLDivElement>(null);
  const sfARef = useRef<HTMLDivElement>(null);
  const sfBRef = useRef<HTMLDivElement>(null);
  const repBRef = useRef<HTMLDivElement>(null);
  const finRef = useRef<HTMLDivElement>(null);
  const [lines, setLines] = useState<{ d: string; g: string }[]>([]);
  const [dims, setDims] = useState<{ w: number; h: number }>({ w: 0, h: 0 });

  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const compute = () => {
      const els = [repARef, sfARef, sfBRef, repBRef, finRef].map((r) => r.current);
      if (els.some((e) => !e)) return;
      const r0 = wrap.getBoundingClientRect();
      if (r0.width === 0) return; // escondido (mobile) → não desenha
      const box = (el: HTMLDivElement) => {
        const r = el.getBoundingClientRect();
        return { l: r.left - r0.left, r: r.right - r0.left, cy: (r.top + r.bottom) / 2 - r0.top };
      };
      const [a, b, c, d, f] = els.map((e) => box(e!));
      const eR = (x: typeof a, y: typeof a) => {
        const mx = (x.r + y.l) / 2;
        return `M ${x.r} ${x.cy} H ${mx} V ${y.cy} H ${y.l}`;
      };
      const eL = (x: typeof a, y: typeof a) => {
        const mx = (x.l + y.r) / 2;
        return `M ${x.l} ${x.cy} H ${mx} V ${y.cy} H ${y.r}`;
      };
      setDims({ w: r0.width, h: r0.height });
      setLines([
        { d: eR(a, b), g: "gL" }, // REP_A → SF_A
        { d: eR(b, f), g: "gL" }, // SF_A → FINAL
        { d: eL(d, c), g: "gR" }, // REP_B → SF_B
        { d: eL(c, f), g: "gR" }, // SF_B → FINAL
      ]);
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(wrap);
    window.addEventListener("resize", compute);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", compute);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(matches.map((m) => [m.slot, m.home_id, m.away_id, m.home_goals, m.away_goals]))]);

  const Trophy = ({ big }: { big?: boolean }) => (
    <div className={`select-none leading-none animate-floatY motion-reduce:animate-none ${big ? "text-6xl" : "text-5xl"}`} style={{ filter: "drop-shadow(0 8px 26px rgba(37,228,255,0.55))" }}>
      🏆
    </div>
  );

  return (
    <div className="space-y-5">
      {/* ================= TELÃO / DESKTOP: organograma ================= */}
      <div ref={wrapRef} className="relative hidden md:block">
        <svg
          className="pointer-events-none absolute inset-0 z-0"
          width={dims.w}
          height={dims.h}
          viewBox={`0 0 ${dims.w} ${dims.h}`}
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="gL" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="rgba(143,160,208,0.35)" />
              <stop offset="1" stopColor="rgba(37,228,255,0.75)" />
            </linearGradient>
            <linearGradient id="gR" x1="1" y1="0" x2="0" y2="0">
              <stop offset="0" stopColor="rgba(143,160,208,0.35)" />
              <stop offset="1" stopColor="rgba(37,228,255,0.75)" />
            </linearGradient>
          </defs>
          {lines.map((l, i) => (
            <path key={i} d={l.d} fill="none" stroke={`url(#${l.g})`} strokeWidth={2} strokeLinecap="round" />
          ))}
        </svg>

        <div className="relative z-10 grid grid-cols-[1fr_1fr_1.15fr_1fr_1fr] items-center gap-x-2.5">
          {/* col 1 — repescagem esquerda */}
          <div className="flex flex-col justify-start pt-2">
            <TreeCard match={bySlot("REP_A")} byId={byId} caption="Repescagem · 4º×5º" cardRef={repARef} />
          </div>
          {/* col 2 — semi esquerda */}
          <div className="flex flex-col justify-center">
            <TreeCard match={bySlot("SF_A")} byId={byId} caption="Semi A · 1º × venc." seedHome="1º" cardRef={sfARef} />
          </div>
          {/* col 3 — centro / troféu */}
          <div className="flex flex-col items-center justify-center gap-3">
            <div className="text-center font-display text-[10px] font-bold uppercase tracking-[0.3em] text-cyan">
              {championId ? "Campeão" : "Final"}
            </div>
            <Trophy big />
            {championId && <div className="text-center font-display text-xl font-extrabold text-branco">{name(championId)}</div>}
            <TreeCard match={bySlot("TERCEIRO")} byId={byId} caption="3º lugar · 1º a decidir" variant="third" />
            <TreeCard match={bySlot("FINAL")} byId={byId} caption="Final" variant="final" cardRef={finRef} />
          </div>
          {/* col 4 — semi direita */}
          <div className="flex flex-col justify-center">
            <TreeCard match={bySlot("SF_B")} byId={byId} caption="Semi B · 2º × venc." seedHome="2º" cardRef={sfBRef} />
          </div>
          {/* col 5 — repescagem direita */}
          <div className="flex flex-col justify-start pt-2">
            <TreeCard match={bySlot("REP_B")} byId={byId} caption="Repescagem · 3º×6º" cardRef={repBRef} />
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-ink-muted">
          1º e 2º entram direto na semifinal · empate no mata-mata → prorrogação → pênaltis. A chave avança sozinha a
          cada placar lançado.
        </p>
      </div>

      {/* ================= CELULAR: fases empilhadas ================= */}
      <div className="space-y-4 md:hidden">
        {championId && (
          <div
            className="panel flex flex-col items-center gap-1 p-5 text-center"
            style={{ borderColor: "rgba(37,228,255,0.5)", boxShadow: "0 0 40px rgba(59,91,255,0.28)" }}
          >
            <div className="font-display text-[10px] font-bold uppercase tracking-[0.3em] text-cyan">Campeão</div>
            <Trophy />
            <div className="font-display text-2xl font-extrabold text-branco">{name(championId)}</div>
            {runnerUpId && <div className="text-xs text-ink-muted">Vice: {name(runnerUpId)}</div>}
            {third && <div className="text-xs text-ink-muted">3º: {name(third)}</div>}
          </div>
        )}

        <MobilePhase title="Repescagem">
          <MobileRow match={bySlot("REP_A")} byId={byId} />
          <MobileRow match={bySlot("REP_B")} byId={byId} />
        </MobilePhase>

        <MobilePhase title="Semifinais">
          <MobileRow match={bySlot("SF_A")} byId={byId} />
          <MobileRow match={bySlot("SF_B")} byId={byId} />
        </MobilePhase>

        <MobilePhase title="3º lugar" note="decidido antes da final">
          <MobileRow match={bySlot("TERCEIRO")} byId={byId} />
        </MobilePhase>

        <MobilePhase title="Final" accent>
          <MobileRow match={bySlot("FINAL")} byId={byId} />
        </MobilePhase>

        <p className="text-center text-xs text-ink-muted">
          Empate no mata-mata → prorrogação → pênaltis. A chave avança sozinha a cada placar.
        </p>
      </div>
    </div>
  );
}

function MobilePhase({
  title,
  note,
  accent,
  children,
}: {
  title: string;
  note?: string;
  accent?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-2 flex items-center justify-between px-1">
        <h3 className={`font-display text-sm uppercase tracking-[0.15em] ${accent ? "text-cyan" : "text-ink"}`}>{title}</h3>
        {note && <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted">{note}</span>}
      </div>
      <div className="panel divide-y divide-line/60">{children}</div>
    </section>
  );
}

function MobileRow({ match, byId }: { match?: Match; byId: Map<string, Player> }) {
  const home = match?.home_id ? byId.get(match.home_id) : undefined;
  const away = match?.away_id ? byId.get(match.away_id) : undefined;
  return (
    <MatchRow
      home={home}
      away={away}
      homeGoals={match?.home_goals ?? null}
      awayGoals={match?.away_goals ?? null}
      penWinnerId={match?.pen_winner_id}
    />
  );
}
