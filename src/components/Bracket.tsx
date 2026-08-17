"use client";

import type { Match, Player, Slot } from "@/lib/types";
import { matchWinner, matchLoser } from "@/lib/standings";
import { championAndRunnerUp, thirdPlace } from "@/lib/bracket";
import { Avatar } from "@/components/ui";
import { MatchRow } from "@/components/MatchRow";

/* ------------------------------------------------------------------ *
 * Chaveamento no formato da referência: barras horizontais com o NOME em
 * condensada e a FOTO quadrada (moldura azul) na ponta, ligadas por traços
 * finos da esquerda para a direita, até o campeão.
 *
 * 4 colunas: repescagens → semifinais → final → campeão.
 * A geometria é calculada em pixels no eixo Y e percentual no eixo X, sem
 * medir o DOM: o telão fica horas ligado e às vezes só recebe resize, e é
 * isso que garante que os traços não saiam do lugar.
 * ------------------------------------------------------------------ */

/** Colunas em % da largura: [início, fim] de cada barra. */
const COL = [
  { x: 0.5, w: 22 },
  { x: 28, w: 22 },
  { x: 55.5, w: 22 },
  { x: 80, w: 19.5 },
];

function Barra({
  player,
  goals,
  seed,
  state = "idle",
  isPenWinner,
  h,
  placeholder = "A definir",
  espelhado = false,
}: {
  player?: Player;
  goals?: number | null;
  seed?: string;
  state?: "winner" | "loser" | "idle";
  isPenWinner?: boolean;
  h: number;
  placeholder?: string;
  /** lado direito da chave: foto e placar viram para dentro (à esquerda) */
  espelhado?: boolean;
}) {
  const fundo =
    state === "winner"
      ? "border-emerald-400/45 bg-emerald-400/[0.08]"
      : "border-white/10 bg-[#08172B]/70";

  const nome = (
    <div
      className={`flex min-w-0 flex-1 items-center gap-2 border backdrop-blur-md ${fundo} ${
        state === "loser" ? "opacity-45" : ""
      } ${espelhado ? "flex-row-reverse text-right" : ""}`}
      style={{ paddingInline: h * 0.26 }}
    >
      {seed && (
        <span
          className="shrink-0 font-display font-bold leading-none text-azul"
          style={{ fontSize: h * 0.3 }}
        >
          {seed}
        </span>
      )}
      <span
        className={`min-w-0 flex-1 truncate font-display font-bold uppercase leading-none tracking-wide ${
          state === "winner" ? "text-branco" : player ? "text-ink" : "text-ink-muted/40"
        }`}
        style={{ fontSize: h * 0.46 }}
      >
        {player?.name ?? placeholder}
      </span>
      {isPenWinner && (
        <span
          className="shrink-0 font-display uppercase leading-none tracking-widest text-cyan"
          style={{ fontSize: h * 0.24 }}
        >
          pên
        </span>
      )}
    </div>
  );

  const foto = <Avatar name={player?.name ?? "?"} photo={player?.photo} size={h} />;

  const placar = (
    <span
      className={`grid shrink-0 place-items-center border-y border-white/10 font-display font-bold leading-none tabular ${
        espelhado ? "border-l" : "border-r"
      } ${state === "winner" ? "bg-emerald-400 text-base" : "bg-[#08172B]/70 text-ink"}`}
      style={{ width: h * 0.8, fontSize: h * 0.46 }}
    >
      <span className={goals == null ? "text-ink-muted/40" : ""}>{goals ?? "–"}</span>
    </span>
  );

  // No lado direito a ordem inverte, para foto e placar ficarem virados ao centro.
  return (
    <div className="flex items-stretch" style={{ height: h }}>
      {espelhado ? (
        <>
          {placar}
          {foto}
          {nome}
        </>
      ) : (
        <>
          {nome}
          {foto}
          {placar}
        </>
      )}
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

  // ---- geometria ----
  const H = big ? 58 : 44; // altura da barra
  const GAP = big ? 12 : 9; // entre as duas barras de um confronto

  const yRep0 = 0;
  const yRep1 = H + GAP;
  const cRep = yRep1 - GAP / 2; // centro do confronto da repescagem

  const ySemiVenc = cRep - H / 2; // quem subiu entra alinhado com a repescagem
  const ySemiHead = ySemiVenc - GAP - H; // cabeça de chave logo acima
  const cSemi = ySemiHead + H + GAP / 2; // centro da semifinal = altura do troféu

  const desloca = -Math.min(ySemiHead, 0);
  const altura = yRep1 + H + desloca;

  // colunas em % (lado esquerdo; o direito espelha por 100 - x)
  const C1 = { x: 0, w: 20.5 };
  const C2 = { x: 24, w: 20.5 };
  const JOIN1 = 22.2;
  const JOIN2 = 46.4;
  const CENTRO = 47.6;

  const esp = (x: number) => 100 - x; // espelha um ponto
  const espCol = (c: { x: number; w: number }) => ({ x: 100 - c.x - c.w, w: c.w });

  const finalM = bySlot("FINAL");
  const finalCasa = sideOf(finalM, "home");
  const finalFora = sideOf(finalM, "away");
  const finalJogado = finalM?.home_goals != null && finalM?.away_goals != null;

  const caixa = (col: { x: number; w: number }, y: number) => ({
    position: "absolute" as const,
    left: `${col.x}%`,
    width: `${col.w}%`,
    top: y + desloca,
  });

  /** Colchete que junta duas barras e sai para a fase seguinte. */
  const colchete = (yA: number, yB: number, xDe: number, xJoin: number, xAte: number) =>
    `M ${xDe} ${yA + desloca} H ${xJoin} V ${yB + desloca} H ${xDe} M ${xJoin} ${
      (yA + yB) / 2 + desloca
    } H ${xAte}`;

  const linhas = [
    // esquerda
    colchete(yRep0 + H / 2, yRep1 + H / 2, C1.x + C1.w, JOIN1, C2.x),
    colchete(ySemiHead + H / 2, ySemiVenc + H / 2, C2.x + C2.w, JOIN2, CENTRO),
    // direita (espelhada)
    colchete(yRep0 + H / 2, yRep1 + H / 2, esp(C1.x + C1.w), esp(JOIN1), esp(C2.x)),
    colchete(ySemiHead + H / 2, ySemiVenc + H / 2, esp(C2.x + C2.w), esp(JOIN2), esp(CENTRO)),
  ];

  /** Um lado da chave: repescagem (col 1) e semifinal (col 2). */
  function Lado({ lado }: { lado: "A" | "B" }) {
    const dir = lado === "B";
    const rep = bySlot(dir ? "REP_B" : "REP_A");
    const sf = bySlot(dir ? "SF_B" : "SF_A");
    const seeds = dir ? { a: "3º", b: "6º", head: "2º" } : { a: "4º", b: "5º", head: "1º" };
    const col1 = dir ? espCol(C1) : C1;
    const col2 = dir ? espCol(C2) : C2;

    return (
      <>
        <div style={caixa(col1, yRep0)}>
          <Barra {...sideOf(rep, "home")} player={get(sideOf(rep, "home").id)} seed={seeds.a} h={H} espelhado={dir} />
        </div>
        <div style={caixa(col1, yRep1)}>
          <Barra {...sideOf(rep, "away")} player={get(sideOf(rep, "away").id)} seed={seeds.b} h={H} espelhado={dir} />
        </div>
        <div style={caixa(col2, ySemiHead)}>
          <Barra {...sideOf(sf, "home")} player={get(sideOf(sf, "home").id)} seed={seeds.head} h={H} espelhado={dir} />
        </div>
        <div style={caixa(col2, ySemiVenc)}>
          <Barra
            {...sideOf(sf, "away")}
            player={get(sideOf(sf, "away").id)}
            h={H}
            placeholder="Repescagem"
            espelhado={dir}
          />
        </div>
      </>
    );
  }

  const rotulo = (t: string, extra = "") => (
    <span className={`font-display text-[11px] uppercase tracking-[0.3em] text-ink-muted/70 ${extra}`}>
      {t}
    </span>
  );

  return (
    <div className="space-y-5">
      {/* ================= TELÃO / DESKTOP: chave espelhada ================= */}
      <div className="hidden md:block">
        <div className="mb-3 flex items-start justify-between">
          <div>
            <div className="font-display text-xl font-bold uppercase tracking-[0.2em] text-azul">
              Chave A
            </div>
            {rotulo("Repescagem · Semifinal")}
          </div>
          <div className="text-right">
            <div className="font-display text-xl font-bold uppercase tracking-[0.2em] text-azul">
              Chave B
            </div>
            {rotulo("Semifinal · Repescagem")}
          </div>
        </div>

        <div className="relative" style={{ height: altura }}>
          <svg
            className="pointer-events-none absolute inset-0 h-full w-full"
            viewBox={`0 0 100 ${altura}`}
            preserveAspectRatio="none"
          >
            {linhas.map((d, i) => (
              <path
                key={i}
                d={d}
                fill="none"
                stroke="rgba(234,240,255,0.4)"
                strokeWidth={1.5}
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </svg>

          <Lado lado="A" />
          <Lado lado="B" />

          {/* centro: troféu, placar da final e campeão */}
          <div
            className="absolute flex flex-col items-center text-center"
            style={{
              left: "50%",
              top: cSemi + desloca,
              width: "12%",
              transform: "translate(-50%, -50%)",
            }}
          >
            <div
              className="select-none leading-none"
              style={{
                fontSize: big ? 76 : 58,
                filter: "drop-shadow(0 10px 30px rgba(62,155,233,0.5))",
              }}
            >
              🏆
            </div>
            <div className="mt-1 font-display text-[11px] uppercase tracking-[0.3em] text-ink-muted">
              Final
            </div>
            <div
              className="font-display font-bold leading-none text-branco"
              style={{ fontSize: big ? 38 : 28 }}
            >
              <span className={finalJogado ? "" : "text-ink-muted/40"}>
                {finalCasa.goals ?? "–"}
              </span>
              <span className="mx-1.5 align-middle text-[0.4em] font-normal text-ink-muted">x</span>
              <span className={finalJogado ? "" : "text-ink-muted/40"}>
                {finalFora.goals ?? "–"}
              </span>
            </div>
            {championId && (
              <div
                className="mt-1 truncate font-display font-black uppercase tracking-wide text-branco"
                style={{ fontSize: big ? 30 : 22 }}
                title={get(championId)?.name}
              >
                {get(championId)?.name}
              </div>
            )}
          </div>
        </div>

        {/* 3º lugar fora da árvore: é decidido antes da final */}
        <div className="mt-6 flex justify-center">
          <div className="panel w-full max-w-2xl px-5 py-3">
            <div className="mb-2 text-center font-display text-[11px] uppercase tracking-[0.3em] text-ink-muted/70">
              🥉 Disputa de 3º lugar
            </div>
            <MobileRow match={bySlot("TERCEIRO")} byId={byId} />
            {third && (
              <div className="pb-1 text-center font-display text-sm uppercase tracking-widest text-ink-muted">
                3º lugar: <span className="text-ink">{get(third)?.name}</span>
              </div>
            )}
          </div>
        </div>

        {championId && runnerUpId && (
          <p className="mt-3 text-center font-display text-lg uppercase tracking-widest text-ink-muted">
            Campeão <span className="text-branco">{get(championId)?.name}</span> · vice{" "}
            <span className="text-ink">{get(runnerUpId)?.name}</span>
          </p>
        )}

        <p className="mt-3 text-center text-xs text-ink-muted">
          1º e 2º entram direto na semifinal · empate no mata-mata → prorrogação → pênaltis. A chave
          avança sozinha a cada placar lançado.
        </p>
      </div>

      {/* ================= CELULAR: fases empilhadas ================= */}
      <div className="space-y-4 md:hidden">
        {championId && (
          <div className="panel flex flex-col items-center gap-1 border-azul/40 p-5 text-center">
            <div className="font-display text-[11px] uppercase tracking-[0.3em] text-azul">
              Campeão
            </div>
            <div className="select-none text-5xl leading-none">🏆</div>
            <div className="font-display text-3xl font-black uppercase text-branco">
              {get(championId)?.name}
            </div>
            {runnerUpId && <div className="text-xs text-ink-muted">Vice: {get(runnerUpId)?.name}</div>}
            {third && <div className="text-xs text-ink-muted">3º: {get(third)?.name}</div>}
          </div>
        )}

        <MobilePhase title="Chave A">
          <MobileRow match={bySlot("REP_A")} byId={byId} />
          <MobileRow match={bySlot("SF_A")} byId={byId} />
        </MobilePhase>

        <MobilePhase title="Chave B">
          <MobileRow match={bySlot("REP_B")} byId={byId} />
          <MobileRow match={bySlot("SF_B")} byId={byId} />
        </MobilePhase>

        <MobilePhase title="3º lugar" note="decidido antes da final">
          <MobileRow match={bySlot("TERCEIRO")} byId={byId} />
        </MobilePhase>

        <MobilePhase title="Final" accent>
          <MobileRow match={finalM} byId={byId} />
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
        <h3
          className={`font-display text-lg font-bold uppercase tracking-[0.15em] ${
            accent ? "text-azul" : "text-ink"
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
      <div className="panel divide-y divide-line">{children}</div>
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
      avatarSize={38}
    />
  );
}
