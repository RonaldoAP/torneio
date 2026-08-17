"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useTournament } from "@/lib/useTournament";
import { StandingsTable } from "@/components/StandingsTable";
import { Bracket } from "@/components/Bracket";
import { MatchRow } from "@/components/MatchRow";
import { Avatar } from "@/components/ui";
import { computeStandings } from "@/lib/standings";
import { computeDefense, computeScorers } from "@/lib/scorers";
import { seedBracket } from "@/lib/bracket";
import { eventInfo } from "@/lib/editions";
import type { Match, Player } from "@/lib/types";

const POLL_MS = 6000; // rebusca de dados (freshness), independente da duração da tela
const SLIDE_MS_DEFAULT = 6000; // duração padrão de uma tela
const KO_STAGES = ["quartas", "semi", "final", "terceiro"];

interface Slide {
  key: string;
  label: string;
  ms: number; // quanto tempo esta tela fica no ar
  node: ReactNode;
}

export default function TvPage() {
  const { players, matches, config, mode, connected, refresh, editionInfo } = useTournament();
  const EVENT = eventInfo(editionInfo);

  // Telão pode rodar por horas numa TV onde o websocket do realtime cai sem
  // avisar. Para garantir que a tela nunca fique defasada, rebuscamos os dados
  // do servidor a cada troca de slide (a cada SLIDE_MS), independente do
  // realtime. Sem reload de página e sem "piscar".
  useEffect(() => {
    const id = setInterval(() => {
      refresh();
    }, POLL_MS);
    return () => clearInterval(id);
  }, [refresh]);

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
        ms: 12000, // classificação fica mais tempo
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
        ms: SLIDE_MS_DEFAULT,
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
        ms: 8000, // a chave tem foto+nome de todo mundo: dá tempo de ler
        node: <Bracket players={players} matches={bracketMatches} big />,
      });
    }

    // 4) Goleadores
    const scorers = computeScorers(players, matches).filter((s) => s.goals > 0);
    if (scorers.length > 0) {
      list.push({
        key: "scorers",
        label: "Artilharia",
        ms: SLIDE_MS_DEFAULT,
        node: <ScorersBig players={players} rows={scorers} />,
      });
    }

    // 5) Melhor defesa
    const defense = computeDefense(players, matches);
    if (defense.length > 0) {
      list.push({
        key: "defense",
        label: "Melhor defesa",
        ms: SLIDE_MS_DEFAULT,
        node: <DefenseBig players={players} rows={defense.slice(0, 8)} />,
      });
    }

    return list;
  }, [players, matches]);

  return <Slideshow slides={slides} config={config} mode={mode} connected={connected} event={EVENT} />;
}

/* ------------------------------------------------------------------ */

function Slideshow({
  slides,
  config,
  mode,
  connected,
  event,
}: {
  slides: Slide[];
  config: { tournament_name: string; phase: string };
  mode: "supabase" | "local";
  connected: boolean;
  event: { date: string; time: string; local: string };
}) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const n = slides.length;
  const safeIndex = n > 0 ? index % n : 0;

  // avança sozinho — cada tela fica no ar pelo seu próprio tempo
  const currentMs = slides[safeIndex]?.ms ?? SLIDE_MS_DEFAULT;
  useEffect(() => {
    if (paused || n <= 1) return;
    const id = setTimeout(() => setIndex((i) => (i + 1) % n), currentMs);
    return () => clearTimeout(id);
  }, [safeIndex, paused, n, currentMs]);

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
        backgroundImage:
          'radial-gradient(1200px 700px at 50% -8%, rgba(62,155,233,0.18), transparent 62%), linear-gradient(rgba(1,4,10,0.62), rgba(1,4,10,0.86) 55%, rgba(1,4,10,0.94)), url("/estadio.jpg")',
        backgroundSize: "cover",
        backgroundPosition: "center 20%",
        backgroundColor: "#01040A",
      }}
    >
      {/* Cabeçalho */}
      <header className="flex items-center justify-between gap-4 px-6 pt-4 sm:px-10 sm:pt-5">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="h-2.5 w-2.5 shrink-0 animate-pulseAzul bg-azul" />
          <h1 className="truncate font-display text-2xl uppercase leading-none tracking-[0.2em] text-ink sm:text-4xl">
            {current?.label ?? ""}
          </h1>
        </div>
        <div className="flex shrink-0 items-center gap-3">
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

      {/* Conteúdo da tela — sem rolagem: tudo precisa caber no telão */}
      <div className="relative flex min-h-0 flex-1 flex-col justify-center overflow-hidden px-4 py-3 sm:px-10">
        {paused && (
          <span className="absolute right-10 top-0 chip border-branco/40 text-branco">pausado</span>
        )}
        {current ? (
          <div key={current.key} className="animate-reveal">
            {current.node}
          </div>
        ) : (
          <div className="grid h-full place-items-center text-center text-ink-muted">
            <div>
              <div className="mb-2 font-display text-4xl text-ink">Tudo pronto pro pontapé inicial ⚽</div>
              <div className="text-lg">
                📅 {event.date} · 🕒 {event.time} · 📍 {event.local}
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
                animation: paused ? "none" : `tv-progress ${currentMs}ms linear forwards`,
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

/* ------------------------------------------------------------------ */

function DefenseBig({
  players,
  rows,
}: {
  players: Player[];
  rows: ReturnType<typeof computeDefense>;
}) {
  const photoById = new Map(players.map((p) => [p.id, p.photo] as const));
  return (
    <div className="mx-auto w-full max-w-4xl panel divide-y divide-line/60">
      {rows.map((r, i) => (
        <div key={r.playerId} className="flex items-center gap-4 px-5 py-4">
          <span
            className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl font-display text-xl ${
              i === 0 ? "bg-cyan/20 text-cyan" : "text-ink-muted"
            }`}
          >
            {i + 1}
          </span>
          <Avatar name={r.name} photo={photoById.get(r.playerId)} size={52} />
          <span className="flex-1 truncate font-display text-2xl text-ink sm:text-3xl">{r.name}</span>
          {i === 0 && <span className="chip border-cyan/50 text-cyan">Melhor defesa 🧤</span>}
          <span className="font-display text-4xl leading-none text-ink sm:text-5xl">{r.conceded}</span>
          <span className="w-24 text-right text-sm text-ink-muted">
            sofridos em {r.games} {r.games === 1 ? "jogo" : "jogos"}
          </span>
        </div>
      ))}
    </div>
  );
}
