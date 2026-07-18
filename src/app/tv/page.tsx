"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useTournament } from "@/lib/useTournament";
import { StandingsTable } from "@/components/StandingsTable";
import { Bracket } from "@/components/Bracket";
import { MatchRow } from "@/components/MatchRow";
import { LiveBadge, Avatar } from "@/components/ui";
import { computeStandings } from "@/lib/standings";
import { computeScorers } from "@/lib/scorers";
import { seedBracket } from "@/lib/bracket";
import { EVENT } from "@/lib/config";
import type { Match, Player } from "@/lib/types";

const SLIDE_MS = 13000; // tempo de cada tela
const KO_STAGES = ["quartas", "semi", "final", "terceiro"];

interface Slide {
  key: string;
  label: string;
  node: ReactNode;
}

export default function TvPage() {
  const { players, matches, config, mode, connected } = useTournament();

  // ---- monta as telas disponíveis conforme os dados ----
  const slides = useMemo<Slide[]>(() => {
    const list: Slide[] = [];
    const byId = new Map(players.map((p) => [p.id, p] as const));
    const standings = computeStandings(players, matches);

    // 1) Classificação
    if (players.length > 0) {
      list.push({
        key: "class",
        label: "Classificação",
        node: <StandingsTable players={players} matches={matches} big />,
      });
    }

    // 2) Rodada atual (primeira rodada ainda não encerrada)
    const byRound = new Map<number, Match[]>();
    for (const m of matches.filter((x) => x.stage === "liga")) {
      const r = m.round ?? 0;
      if (!byRound.has(r)) byRound.set(r, []);
      byRound.get(r)!.push(m);
    }
    const roundsArr = [...byRound.entries()]
      .map(([round, games]) => ({
        round,
        games,
        finished: games.length > 0 && games.every((g) => g.home_goals != null && g.away_goals != null),
      }))
      .sort((a, b) => a.round - b.round);
    const current = roundsArr.find((r) => !r.finished);
    if (current) {
      list.push({
        key: `round-${current.round}`,
        label: `${current.round}ª Rodada — ao vivo`,
        node: (
          <div className="mx-auto w-full max-w-4xl panel divide-y divide-line/60">
            {current.games.map((g) => (
              <MatchRow
                key={g.id}
                home={g.home_id ? byId.get(g.home_id) : undefined}
                away={g.away_id ? byId.get(g.away_id) : undefined}
                homeGoals={g.home_goals}
                awayGoals={g.away_goals}
                penWinnerId={g.pen_winner_id}
                avatarSize={56}
              />
            ))}
          </div>
        ),
      });
    }

    // 3) Mata-mata (oficial se montado; senão prévia com o Top 6)
    const hasBracket = matches.some((m) => KO_STAGES.includes(m.stage));
    let bracketMatches: Match[] = [];
    if (hasBracket) {
      bracketMatches = matches.filter((m) => KO_STAGES.includes(m.stage));
    } else if (standings.length >= 6) {
      const top6 = standings.slice(0, 6).map((r) => r.playerId);
      bracketMatches = seedBracket(top6).map((s) => ({
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
    }
    if (bracketMatches.length > 0) {
      list.push({
        key: "ko",
        label: hasBracket ? "Mata-mata" : "Mata-mata — prévia ao vivo",
        node: <Bracket players={players} matches={bracketMatches} />,
      });
    }

    // 4) Goleadores
    const scorers = computeScorers(players, matches).filter((s) => s.goals > 0);
    if (scorers.length > 0) {
      list.push({
        key: "scorers",
        label: "Artilharia",
        node: <ScorersBig players={players} rows={scorers} />,
      });
    }

    return list;
  }, [players, matches]);

  return <Slideshow slides={slides} config={config} mode={mode} connected={connected} />;
}

/* ------------------------------------------------------------------ */

function Slideshow({
  slides,
  config,
  mode,
  connected,
}: {
  slides: Slide[];
  config: { tournament_name: string; phase: string };
  mode: "supabase" | "local";
  connected: boolean;
}) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [clock, setClock] = useState("");
  const n = slides.length;
  const safeIndex = n > 0 ? index % n : 0;

  // relógio ao vivo
  useEffect(() => {
    const tick = () =>
      setClock(new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }));
    tick();
    const id = setInterval(tick, 15000);
    return () => clearInterval(id);
  }, []);

  // avança sozinho
  useEffect(() => {
    if (paused || n <= 1) return;
    const id = setTimeout(() => setIndex((i) => (i + 1) % n), SLIDE_MS);
    return () => clearTimeout(id);
  }, [safeIndex, paused, n]);

  // teclado: ← → (navegar), espaço (pausar), F (tela cheia)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") setIndex((i) => (i + 1) % Math.max(n, 1));
      else if (e.key === "ArrowLeft") setIndex((i) => (i - 1 + Math.max(n, 1)) % Math.max(n, 1));
      else if (e.key === " ") {
        e.preventDefault();
        setPaused((p) => !p);
      } else if (e.key.toLowerCase() === "f") toggleFullscreen();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [n]);

  function toggleFullscreen() {
    if (typeof document === "undefined") return;
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {});
    else document.exitFullscreen?.().catch(() => {});
  }

  const current = slides[safeIndex];

  return (
    <div
      className="fixed inset-0 z-40 flex flex-col overflow-hidden"
      style={{
        background:
          "radial-gradient(1100px 560px at 50% -12%, rgba(59,91,255,0.22), transparent 62%), radial-gradient(900px 520px at 100% 0%, rgba(37,228,255,0.08), transparent 55%), #050A2C",
      }}
    >
      {/* Cabeçalho */}
      <header className="flex items-center justify-between gap-4 px-6 pt-6 sm:px-10 sm:pt-8">
        <div className="min-w-0">
          <div className="font-display text-xs tracking-[0.35em] text-gremio sm:text-sm">
            FIFA 26 · AO VIVO
          </div>
          <h1 className="truncate font-display text-3xl leading-none tracking-wide text-ink sm:text-5xl">
            {config.tournament_name}
          </h1>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className="hidden font-display text-2xl tabular text-ink-muted sm:block">{clock}</span>
          <LiveBadge mode={mode} connected={connected} />
          <button
            onClick={toggleFullscreen}
            className="btn-ghost px-3 py-2"
            title="Tela cheia (F)"
            aria-label="Tela cheia"
          >
            ⛶
          </button>
        </div>
      </header>

      {/* Título da tela atual */}
      <div className="flex items-center gap-3 px-6 pb-2 pt-4 sm:px-10">
        <span className="h-2.5 w-2.5 animate-pulseAzul rounded-full bg-cyan" />
        <span className="font-display text-lg uppercase tracking-[0.2em] text-cyan sm:text-2xl">
          {current?.label ?? "—"}
        </span>
        {paused && <span className="chip border-branco/40 text-branco">pausado</span>}
      </div>

      {/* Conteúdo da tela */}
      <div className="relative flex-1 overflow-auto px-4 pb-4 sm:px-10">
        {current ? (
          <div key={current.key} className="animate-reveal">
            {current.node}
          </div>
        ) : (
          <div className="grid h-full place-items-center text-center text-ink-muted">
            <div>
              <div className="mb-2 font-display text-4xl text-ink">Tudo pronto pro pontapé inicial ⚽</div>
              <div className="text-lg">
                📅 {EVENT.date} · 🕒 {EVENT.time} · 📍 {EVENT.local}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Rodapé: barra de progresso + indicadores */}
      {n > 1 && (
        <footer className="px-6 pb-5 sm:px-10">
          <div className="mb-2 h-1 w-full overflow-hidden rounded-full bg-white/10">
            <div
              key={`${current?.key}-${paused}`}
              className="h-full origin-left rounded-full bg-cyan"
              style={{
                animation: paused ? "none" : `tv-progress ${SLIDE_MS}ms linear forwards`,
                transform: paused ? "scaleX(1)" : undefined,
              }}
            />
          </div>
          <div className="flex items-center justify-center gap-2">
            {slides.map((s, i) => (
              <button
                key={s.key}
                onClick={() => setIndex(i)}
                aria-label={s.label}
                className={`h-2.5 rounded-full transition-all ${
                  i === safeIndex ? "w-8 bg-cyan" : "w-2.5 bg-white/25 hover:bg-white/40"
                }`}
              />
            ))}
          </div>
        </footer>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function ScorersBig({
  players,
  rows,
}: {
  players: Player[];
  rows: ReturnType<typeof computeScorers>;
}) {
  const photoById = new Map(players.map((p) => [p.id, p.photo] as const));
  return (
    <div className="mx-auto w-full max-w-4xl panel divide-y divide-line/60">
      {rows.map((r, i) => (
        <div key={r.playerId} className="flex items-center gap-4 px-5 py-4">
          <span
            className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl font-display text-xl ${
              i === 0 ? "bg-gremio/20 text-gremio" : "text-ink-muted"
            }`}
          >
            {i + 1}
          </span>
          <Avatar name={r.name} photo={photoById.get(r.playerId)} size={52} />
          <span className="flex-1 truncate font-display text-2xl text-ink sm:text-3xl">{r.name}</span>
          {i === 0 && <span className="chip border-gremio/50 text-gremio">Artilheiro ⚽</span>}
          <span className="font-display text-4xl leading-none text-ink sm:text-5xl">{r.goals}</span>
          <span className="w-16 text-right text-sm text-ink-muted">
            {r.games} {r.games === 1 ? "jogo" : "jogos"}
          </span>
        </div>
      ))}
    </div>
  );
}
