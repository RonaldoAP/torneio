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
  destaque,
}: {
  player?: Player;
  goals?: number | null;
  seed?: string;
  state?: "winner" | "loser" | "idle";
  isPenWinner?: boolean;
  h: number;
  placeholder?: string;
  destaque?: boolean;
}) {
  const fundo = destaque
    ? "border-azul/60 bg-azul/15"
    : state === "winner"
      ? "border-emerald-400/45 bg-emerald-400/[0.08]"
      : "border-white/10 bg-[#08172B]/70";

  return (
    <div className="flex items-stretch" style={{ height: h }}>
      <div
        className={`flex min-w-0 flex-1 items-center gap-2 border backdrop-blur-md ${fundo} ${
          state === "loser" ? "opacity-45" : ""
        }`}
        style={{ paddingInline: h * 0.28 }}
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
          className={`truncate font-display font-bold uppercase leading-none tracking-wide ${
            state === "winner" ? "text-branco" : player ? "text-ink" : "text-ink-muted/40"
          }`}
          style={{ fontSize: h * 0.46 }}
        >
          {player?.name ?? placeholder}
        </span>
        {isPenWinner && (
          <span
            className="ml-auto shrink-0 font-display uppercase leading-none tracking-widest text-cyan"
            style={{ fontSize: h * 0.24 }}
          >
            pên
          </span>
        )}
      </div>

      <Avatar name={player?.name ?? "?"} photo={player?.photo} size={h} />

      <span
        className={`grid shrink-0 place-items-center border-y border-r border-white/10 font-display leading-none tabular ${
          state === "winner" ? "bg-emerald-400 text-base" : "bg-[#08172B]/70 text-ink"
        }`}
        style={{ width: h * 0.82, fontSize: h * 0.46 }}
      >
        {goals ?? ""}
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

  // ---- geometria vertical (px) ----
  const H = big ? 62 : 46; // altura da barra
  const GAP_PAR = big ? 10 : 8; // entre as duas barras de um confronto
  const GAP_CHAVE = big ? 64 : 48; // entre a chave de cima e a de baixo

  const par = 2 * H + GAP_PAR; // altura de um confronto
  const yRepA = 0;
  const yRepB = par + GAP_CHAVE;
  const cRepA = yRepA + par / 2; // centro do confronto REP_A
  const cRepB = yRepB + par / 2;

  // Semis: o vencedor da repescagem entra alinhado ao centro da repescagem;
  // a cabeça de chave (1º/2º) fica logo acima dele.
  const ySfA_risen = cRepA - H / 2;
  const ySfA_head = ySfA_risen - GAP_PAR - H;
  const ySfB_risen = cRepB - H / 2;
  const ySfB_head = ySfB_risen - GAP_PAR - H;
  const cSfA = (ySfA_head + ySfA_risen + H) / 2;
  const cSfB = (ySfB_head + ySfB_risen + H) / 2;

  // Final: cada finalista alinhado à sua semi. Campeão no meio dos dois.
  const yFinA = cSfA - H / 2;
  const yFinB = cSfB - H / 2;
  const cFinal = (cSfA + cSfB) / 2;
  const yCampeao = cFinal - H / 2;

  const topo = Math.min(ySfA_head, 0); // as cabeças de chave sobem acima do zero
  const altura = yRepB + par - topo;
  const desloca = -topo; // empurra tudo para dentro do container

  const repA = bySlot("REP_A");
  const repB = bySlot("REP_B");
  const sfA = bySlot("SF_A");
  const sfB = bySlot("SF_B");
  const finalM = bySlot("FINAL");

  /** Caixa posicionada numa coluna/linha da chave. */
  const at = (col: number, y: number) => ({
    position: "absolute" as const,
    left: `${COL[col].x}%`,
    width: `${COL[col].w}%`,
    top: y + desloca,
  });

  // ---- traços (x em %, y em px) ----
  const fimCol = (c: number) => COL[c].x + COL[c].w;
  const traco = (yA: number, yB: number, xDe: number, xPara: number) => {
    const meio = (xDe + xPara) / 2;
    return `M ${xDe} ${yA + desloca} H ${meio} V ${yB + desloca} H ${xDe} M ${meio} ${
      (yA + yB) / 2 + desloca
    } H ${xPara}`;
  };

  const linhas = [
    // repescagem → vencedor entra na semi
    traco(yRepA + H / 2, yRepA + H + GAP_PAR + H / 2, fimCol(0), COL[1].x),
    traco(yRepB + H / 2, yRepB + H + GAP_PAR + H / 2, fimCol(0), COL[1].x),
    // semi → final
    traco(ySfA_head + H / 2, ySfA_risen + H / 2, fimCol(1), COL[2].x),
    traco(ySfB_head + H / 2, ySfB_risen + H / 2, fimCol(1), COL[2].x),
    // final → campeão
    traco(yFinA + H / 2, yFinB + H / 2, fimCol(2), COL[3].x),
  ];

  const rotulo = (texto: string) => (
    <span className="font-display text-[11px] uppercase tracking-[0.3em] text-ink-muted/70">
      {texto}
    </span>
  );

  return (
    <div className="space-y-5">
      {/* ================= TELÃO / DESKTOP ================= */}
      <div className="hidden md:block">
        <div className="mb-3 grid" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
          <div>{rotulo("Repescagem")}</div>
          <div>{rotulo("Semifinais")}</div>
          <div>{rotulo("Final")}</div>
          <div className="text-right">{rotulo("Campeão")}</div>
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
                stroke="rgba(234,240,255,0.35)"
                strokeWidth={1.5}
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </svg>

          {/* coluna 1 — repescagens */}
          <div style={at(0, yRepA)}>
            <Barra {...sideOf(repA, "home")} player={get(sideOf(repA, "home").id)} seed="4º" h={H} />
          </div>
          <div style={at(0, yRepA + H + GAP_PAR)}>
            <Barra {...sideOf(repA, "away")} player={get(sideOf(repA, "away").id)} seed="5º" h={H} />
          </div>
          <div style={at(0, yRepB)}>
            <Barra {...sideOf(repB, "home")} player={get(sideOf(repB, "home").id)} seed="3º" h={H} />
          </div>
          <div style={at(0, yRepB + H + GAP_PAR)}>
            <Barra {...sideOf(repB, "away")} player={get(sideOf(repB, "away").id)} seed="6º" h={H} />
          </div>

          {/* coluna 2 — semifinais (cabeça de chave + quem subiu) */}
          <div style={at(1, ySfA_head)}>
            <Barra {...sideOf(sfA, "home")} player={get(sideOf(sfA, "home").id)} seed="1º" h={H} />
          </div>
          <div style={at(1, ySfA_risen)}>
            <Barra
              {...sideOf(sfA, "away")}
              player={get(sideOf(sfA, "away").id)}
              h={H}
              placeholder="Repescagem"
            />
          </div>
          <div style={at(1, ySfB_head)}>
            <Barra {...sideOf(sfB, "home")} player={get(sideOf(sfB, "home").id)} seed="2º" h={H} />
          </div>
          <div style={at(1, ySfB_risen)}>
            <Barra
              {...sideOf(sfB, "away")}
              player={get(sideOf(sfB, "away").id)}
              h={H}
              placeholder="Repescagem"
            />
          </div>

          {/* coluna 3 — final */}
          <div style={at(2, yFinA)}>
            <Barra
              {...sideOf(finalM, "home")}
              player={get(sideOf(finalM, "home").id)}
              h={H}
              placeholder="Venc. semi A"
            />
          </div>
          <div style={at(2, yFinB)}>
            <Barra
              {...sideOf(finalM, "away")}
              player={get(sideOf(finalM, "away").id)}
              h={H}
              placeholder="Venc. semi B"
            />
          </div>

          {/* coluna 4 — campeão */}
          <div style={at(3, yCampeao)}>
            <div className="relative">
              <div
                className="pointer-events-none absolute left-1/2 -translate-x-1/2 select-none leading-none"
                style={{ top: -(big ? 62 : 46), fontSize: big ? 52 : 38 }}
              >
                🏆
              </div>
              <Barra
                player={get(championId)}
                state={championId ? "winner" : "idle"}
                h={H}
                placeholder="A definir"
                destaque={!championId}
              />
            </div>
          </div>
        </div>

        {/* 3º lugar fora da árvore: é decidido antes da final */}
        <div className="mt-6 flex justify-center">
          <div className="panel w-full max-w-xl px-4 py-2.5">
            <div className="mb-1 text-center font-display text-[11px] uppercase tracking-[0.3em] text-ink-muted/70">
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

        <p className="mt-4 text-center text-xs text-ink-muted">
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

        <MobilePhase title="Repescagem">
          <MobileRow match={repA} byId={byId} />
          <MobileRow match={repB} byId={byId} />
        </MobilePhase>

        <MobilePhase title="Semifinais">
          <MobileRow match={sfA} byId={byId} />
          <MobileRow match={sfB} byId={byId} />
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
