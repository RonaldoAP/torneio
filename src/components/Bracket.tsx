"use client";

import type { Match, Player, Slot } from "@/lib/types";
import { matchWinner, matchLoser } from "@/lib/standings";
import { championAndRunnerUp, thirdPlace } from "@/lib/bracket";
import { Avatar } from "@/components/ui";
import { MatchRow } from "@/components/MatchRow";

/* ------------------------------------------------------------------ *
 * Chaveamento no estilo dos infográficos de Champions: a FOTO de cada
 * participante faz as vezes de escudo, o nome vai embaixo em caixa alta,
 * e as linhas finas levam ao círculo da fase seguinte — que começa vazio
 * e vai sendo preenchido por quem avança, até o troféu no centro.
 *
 * A geometria é fixa (percentuais no eixo X, múltiplos da altura de linha
 * no eixo Y), então nada depende de medir o DOM: no telão, que fica horas
 * ligado e às vezes só recebe resize, isso é o que garante que as linhas
 * nunca saiam do lugar.
 * ------------------------------------------------------------------ */

type Side = "left" | "right";

/** Colunas em % da largura (lado esquerdo; o direito é espelhado por 100-x). */
const X = {
  crest: 8.5, // centro do escudo
  crestEdge: 17, // onde a linha encosta no escudo
  joinRep: 27, // vertical que junta a dupla da repescagem
  repCrest: 34.5, // círculo do vencedor da repescagem
  repEdge: 41.5, // borda desse círculo
  joinSemi: 44, // vertical que junta rep + cabeça de chave
  finalist: 47, // círculo do finalista (vencedor da semi)
  finalEdge: 44.8, // onde a linha da semi encosta no finalista
};

const mirror = (x: number) => 100 - x;

function Crest({
  player,
  goals,
  seed,
  state = "idle",
  isPenWinner,
  size,
  placeholder = "A definir",
}: {
  player?: Player;
  goals?: number | null;
  seed?: string;
  state?: "winner" | "loser" | "idle";
  isPenWinner?: boolean;
  size: number;
  placeholder?: string;
}) {
  const ring =
    state === "winner"
      ? "ring-2 ring-emerald-400 shadow-[0_0_26px_rgba(52,211,153,0.35)]"
      : player
        ? "ring-1 ring-white/15"
        : "ring-1 ring-dashed ring-white/15";

  return (
    <div className={`flex flex-col items-center ${state === "loser" ? "opacity-45" : ""}`}>
      <div className="relative">
        <div className={`overflow-hidden rounded-full bg-panel ${ring}`}>
          {player ? (
            <Avatar name={player.name} photo={player.photo} size={size} />
          ) : (
            <div
              className="grid place-items-center font-display text-ink-muted/50"
              style={{ width: size, height: size, fontSize: size * 0.5 }}
            >
              ?
            </div>
          )}
        </div>
        {goals != null && (
          <span
            className={`absolute -bottom-1 -right-1 grid place-items-center rounded-full border border-base font-display tabular leading-none ${
              state === "winner" ? "bg-emerald-400 text-base" : "bg-panel-light text-ink"
            }`}
            style={{
              minWidth: size * 0.42,
              height: size * 0.42,
              fontSize: size * 0.28,
              paddingInline: size * 0.08,
            }}
          >
            {goals}
          </span>
        )}
        {isPenWinner && (
          <span className="absolute -top-1 -right-1 rounded-full bg-cyan px-1 font-display text-[9px] font-bold leading-tight text-base">
            pên
          </span>
        )}
      </div>

      {seed && (
        <span className="mt-2 rounded-full border border-cyan/40 bg-cyan/10 px-2 py-0.5 font-display text-[12px] font-bold uppercase leading-none tracking-[0.12em] text-cyan">
          {seed}
        </span>
      )}
      <span
        className={`mt-0.5 max-w-full truncate px-1 text-center font-display font-bold uppercase leading-tight tracking-wide ${
          state === "winner" ? "text-branco" : player ? "text-ink" : "text-ink-muted/60"
        }`}
        style={{ fontSize: size * 0.3 }}
      >
        {player?.name ?? placeholder}
      </span>
    </div>
  );
}

/** Um lado de uma partida, já resolvido em estado visual. */
function sideOf(match: Match | undefined, which: "home" | "away") {
  const id = match?.[`${which}_id`] ?? null;
  const winner = match ? matchWinner(match) : null;
  const loser = match ? matchLoser(match) : null;
  const played = match?.home_goals != null && match?.away_goals != null;
  const tie = played && match!.home_goals === match!.away_goals;
  return {
    id,
    goals: match?.[`${which}_goals`] ?? null,
    state: (winner && winner === id ? "winner" : loser && loser === id ? "loser" : "idle") as
      | "winner"
      | "loser"
      | "idle",
    isPenWinner: !!tie && !!id && match?.pen_winner_id === id,
  };
}

export function Bracket({
  players,
  matches,
  big = false,
}: {
  players: Player[];
  matches: Match[];
  big?: boolean;
}) {
  const byId = new Map(players.map((p) => [p.id, p] as const));
  const get = (id: string | null | undefined) => (id ? byId.get(id) : undefined);
  const bySlot = (s: Slot) => matches.find((m) => m.slot === s);
  const { championId, runnerUpId } = championAndRunnerUp(matches);
  const third = thirdPlace(matches);

  // Geometria: 3 linhas por lado (dupla da repescagem + cabeça de chave).
  const ROW = big ? 172 : 132;
  const H = ROW * 3;
  const yTop = ROW * 0.5;
  const yMid = ROW * 1.5;
  const yBottom = ROW * 2.5;
  const yRep = (yTop + yMid) / 2; // vencedor da repescagem
  const ySemi = (yRep + yBottom) / 2; // vencedor da semi (e altura da final)

  const crestSize = big ? 84 : 62;
  const nodeSize = big ? 76 : 56;

  /** Traços de um lado: dupla → repescagem → semi → final. */
  const strokes = (side: Side) => {
    const x = (v: number) => (side === "left" ? v : mirror(v));
    return [
      // dupla da repescagem se encontra
      `M ${x(X.crestEdge)} ${yTop} H ${x(X.joinRep)} V ${yMid} H ${x(X.crestEdge)}`,
      `M ${x(X.joinRep)} ${yRep} H ${x(X.repCrest - 6)}`,
      // vencedor da repescagem encontra a cabeça de chave
      `M ${x(X.repEdge)} ${yRep} H ${x(X.joinSemi)} V ${yBottom} H ${x(X.crestEdge)}`,
      // semi → final
      `M ${x(X.joinSemi)} ${ySemi} H ${x(X.finalEdge)}`,
    ];
  };

  const finalM = bySlot("FINAL");
  const finalHome = sideOf(finalM, "home");
  const finalAway = sideOf(finalM, "away");

  /** Um lado inteiro da chave (esquerda = REP_A/SF_A; direita = REP_B/SF_B). */
  function HalfTree({ side }: { side: Side }) {
    const repSlot: Slot = side === "left" ? "REP_A" : "REP_B";
    const sfSlot: Slot = side === "left" ? "SF_A" : "SF_B";
    const rep = bySlot(repSlot);
    const sf = bySlot(sfSlot);
    const seeds = side === "left" ? { top: "4º", mid: "5º", head: "1º" } : { top: "3º", mid: "6º", head: "2º" };

    const repHome = sideOf(rep, "home");
    const repAway = sideOf(rep, "away");
    // Na semi a cabeça de chave é sempre o mandante; o visitante é quem subiu.
    const sfHead = sideOf(sf, "home");
    const sfRisen = sideOf(sf, "away");

    const x = (v: number) => (side === "left" ? v : mirror(v));
    const at = (xPct: number, y: number, w: number) => ({
      position: "absolute" as const,
      left: `${xPct}%`,
      top: y,
      width: w,
      transform: "translate(-50%, -50%)",
    });

    return (
      <>
        <div style={at(x(X.crest), yTop, crestSize * 1.9)}>
          <Crest
            player={get(repHome.id)}
            goals={repHome.goals}
            seed={seeds.top}
            state={repHome.state}
            isPenWinner={repHome.isPenWinner}
            size={crestSize}
          />
        </div>
        <div style={at(x(X.crest), yMid, crestSize * 1.9)}>
          <Crest
            player={get(repAway.id)}
            goals={repAway.goals}
            seed={seeds.mid}
            state={repAway.state}
            isPenWinner={repAway.isPenWinner}
            size={crestSize}
          />
        </div>
        <div style={at(x(X.crest), yBottom, crestSize * 1.9)}>
          <Crest
            player={get(sfHead.id)}
            goals={sfHead.goals}
            seed={seeds.head}
            state={sfHead.state}
            isPenWinner={sfHead.isPenWinner}
            size={crestSize}
          />
        </div>

        {/* círculo do vencedor da repescagem — entra na semi */}
        <div style={at(x(X.repCrest), yRep, nodeSize * 1.9)}>
          <Crest
            player={get(sfRisen.id)}
            goals={sfRisen.goals}
            state={sfRisen.state}
            isPenWinner={sfRisen.isPenWinner}
            size={nodeSize}
            placeholder="Repescagem"
          />
        </div>
      </>
    );
  }

  return (
    <div className="space-y-5">
      {/* ================= TELÃO / DESKTOP: organograma ================= */}
      <div className="relative hidden md:block" style={{ height: H }}>
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full"
          viewBox={`0 0 100 ${H}`}
          preserveAspectRatio="none"
        >
          {[...strokes("left"), ...strokes("right")].map((d, i) => (
            <path
              key={i}
              d={d}
              fill="none"
              stroke="rgba(234,240,255,0.35)"
              strokeWidth={1.5}
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>

        <HalfTree side="left" />
        <HalfTree side="right" />

        {/* centro: troféu acima, finalistas nos círculos que recebem as linhas */}
        <div
          className="absolute flex flex-col items-center"
          style={{
            left: "50%",
            top: ySemi - nodeSize * 0.85,
            width: big ? 340 : 260,
            transform: "translate(-50%, -100%)",
          }}
        >
          <div className="mb-1 font-display text-[12px] font-bold uppercase tracking-[0.34em] text-cyan">
            {championId ? "Campeão" : "Final"}
          </div>
          <div
            className="animate-floatY select-none leading-none motion-reduce:animate-none"
            style={{ fontSize: big ? 62 : 44, filter: "drop-shadow(0 8px 26px rgba(37,228,255,0.55))" }}
          >
            🏆
          </div>
          {championId && (
            <>
              <div
                className="mt-1 max-w-full truncate text-center font-display font-black uppercase tracking-wide text-branco"
                style={{ fontSize: big ? 44 : 32 }}
              >
                {get(championId)?.name}
              </div>
              {runnerUpId && (
                <div className="font-display text-sm uppercase tracking-widest text-ink-muted">
                  vice: {get(runnerUpId)?.name}
                </div>
              )}
            </>
          )}
        </div>

        {/* os dois finalistas — é neles que as linhas das semis terminam */}
        <div
          className="absolute"
          style={{
            left: `${X.finalist}%`,
            top: ySemi,
            width: nodeSize * 1.9,
            transform: "translate(-50%, -50%)",
          }}
        >
          <Crest
            player={get(finalHome.id)}
            goals={finalHome.goals}
            state={finalHome.state}
            isPenWinner={finalHome.isPenWinner}
            size={nodeSize}
            placeholder="Semi A"
          />
        </div>
        <div
          className="absolute"
          style={{
            left: `${mirror(X.finalist)}%`,
            top: ySemi,
            width: nodeSize * 1.9,
            transform: "translate(-50%, -50%)",
          }}
        >
          <Crest
            player={get(finalAway.id)}
            goals={finalAway.goals}
            state={finalAway.state}
            isPenWinner={finalAway.isPenWinner}
            size={nodeSize}
            placeholder="Semi B"
          />
        </div>
      </div>

      {/* 3º lugar: fora da árvore, porque é decidido antes da final */}
      <ThirdPlaceStrip match={bySlot("TERCEIRO")} byId={byId} third={third} big={big} />

      <p className="hidden text-center text-xs text-ink-muted md:block">
        1º e 2º entram direto na semifinal · empate no mata-mata → prorrogação → pênaltis. A chave
        avança sozinha a cada placar lançado.
      </p>

      {/* ================= CELULAR: fases empilhadas ================= */}
      <div className="space-y-4 md:hidden">
        {championId && (
          <div
            className="panel flex flex-col items-center gap-1 p-5 text-center"
            style={{ borderColor: "rgba(37,228,255,0.5)", boxShadow: "0 0 40px rgba(59,91,255,0.28)" }}
          >
            <div className="font-display text-[10px] font-bold uppercase tracking-[0.3em] text-cyan">
              Campeão
            </div>
            <div className="animate-floatY select-none text-5xl leading-none motion-reduce:animate-none">
              🏆
            </div>
            <div className="font-display text-3xl font-black uppercase text-branco">
              {get(championId)?.name}
            </div>
            {runnerUpId && (
              <div className="text-xs text-ink-muted">Vice: {get(runnerUpId)?.name}</div>
            )}
            {third && <div className="text-xs text-ink-muted">3º: {get(third)?.name}</div>}
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

function ThirdPlaceStrip({
  match,
  byId,
  third,
  big,
}: {
  match?: Match;
  byId: Map<string, Player>;
  third: string | null;
  big: boolean;
}) {
  const home = sideOf(match, "home");
  const away = sideOf(match, "away");
  const get = (id: string | null) => (id ? byId.get(id) : undefined);
  const size = big ? 48 : 38;

  return (
    <div className="hidden justify-center md:flex">
      <div className="panel flex items-center gap-4 px-5 py-3">
        <span className="font-display text-[11px] font-bold uppercase tracking-[0.3em] text-ink-muted">
          🥉 3º lugar
        </span>
        <Crest
          player={get(home.id)}
          goals={home.goals}
          state={home.state}
          isPenWinner={home.isPenWinner}
          size={size}
          placeholder="Perd. Semi A"
        />
        <span className="font-display text-ink-muted">×</span>
        <Crest
          player={get(away.id)}
          goals={away.goals}
          state={away.state}
          isPenWinner={away.isPenWinner}
          size={size}
          placeholder="Perd. Semi B"
        />
        {third && (
          <span className="font-display text-sm uppercase tracking-widest text-ink">
            {get(third)?.name}
          </span>
        )}
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
        <h3
          className={`font-display text-lg font-bold uppercase tracking-[0.15em] ${
            accent ? "text-cyan" : "text-ink"
          }`}
        >
          {title}
        </h3>
        {note && (
          <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
            {note}
          </span>
        )}
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
