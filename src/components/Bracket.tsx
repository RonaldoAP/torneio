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

  const H = big ? 58 : 44; // altura da barra

  const finalM = bySlot("FINAL");

  /** Confronto: as duas barras e o traço que leva ao vencedor. */
  function Confronto({
    match,
    seeds,
    placeholders,
    label,
  }: {
    match?: Match;
    seeds?: [string?, string?];
    placeholders?: [string?, string?];
    label: string;
  }) {
    const casa = sideOf(match, "home");
    const fora = sideOf(match, "away");
    return (
      <div>
        <div className="mb-1.5 font-display text-[11px] uppercase tracking-[0.3em] text-ink-muted/70">
          {label}
        </div>
        <div className="relative flex flex-col gap-1.5">
          <Barra
            {...casa}
            player={get(casa.id)}
            seed={seeds?.[0]}
            h={H}
            placeholder={placeholders?.[0] ?? "A definir"}
          />
          <Barra
            {...fora}
            player={get(fora.id)}
            seed={seeds?.[1]}
            h={H}
            placeholder={placeholders?.[1] ?? "A definir"}
          />
          {/* colchete: junta as duas barras e aponta para a fase seguinte */}
          <span
            aria-hidden
            className="pointer-events-none absolute -right-4 top-[25%] hidden h-1/2 w-3 rounded-r border-y border-r border-white/25 sm:block"
          />
        </div>
      </div>
    );
  }

  /** Um lado da chave: repescagem em cima, semifinal embaixo. */
  function Chave({ lado }: { lado: "A" | "B" }) {
    const rep = bySlot(lado === "A" ? "REP_A" : "REP_B");
    const sf = bySlot(lado === "A" ? "SF_A" : "SF_B");
    const venc = sf ? matchWinner(sf) : null;
    return (
      <section className="panel p-4 sm:p-5">
        <h3 className="mb-4 flex items-center gap-2 font-display text-2xl font-bold uppercase tracking-wide text-ink">
          <span className="grid h-7 w-7 place-items-center rounded border border-azul/40 bg-azul/15 text-lg text-azul">
            {lado}
          </span>
          Chave {lado}
        </h3>

        <div className="space-y-5 pr-4 sm:pr-6">
          <Confronto
            match={rep}
            label="Repescagem"
            seeds={lado === "A" ? ["4º", "5º"] : ["3º", "6º"]}
          />

          <div className="flex items-center gap-2 pl-1 text-ink-muted/70">
            <span className="font-display text-[11px] uppercase tracking-[0.25em]">
              vencedor sobe
            </span>
            <span aria-hidden>↓</span>
          </div>

          <Confronto
            match={sf}
            label="Semifinal"
            seeds={lado === "A" ? ["1º"] : ["2º"]}
            placeholders={[undefined, "Venc. repescagem"]}
          />
        </div>

        <p className="mt-4 border-t border-line pt-3 font-display text-sm uppercase tracking-widest text-ink-muted">
          Finalista:{" "}
          <span className={venc ? "text-branco" : "text-ink-muted/50"}>
            {venc ? get(venc)?.name : "a definir"}
          </span>
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-5">
      {/* ================= TELÃO / DESKTOP ================= */}
      <div className="hidden space-y-5 md:block">
        <div className="grid gap-5 lg:grid-cols-2">
          <Chave lado="A" />
          <Chave lado="B" />
        </div>

        {/* Final: sai das duas chaves */}
        <section className="panel p-5">
          <h3 className="mb-4 text-center font-display text-2xl font-bold uppercase tracking-[0.2em] text-azul">
            Final
          </h3>
          <div className="grid items-center gap-5 lg:grid-cols-[1fr_auto_1fr]">
            <div className="space-y-1.5">
              <Barra
                {...sideOf(finalM, "home")}
                player={get(sideOf(finalM, "home").id)}
                h={H}
                placeholder="Venc. chave A"
              />
              <Barra
                {...sideOf(finalM, "away")}
                player={get(sideOf(finalM, "away").id)}
                h={H}
                placeholder="Venc. chave B"
              />
            </div>

            <div className="flex flex-col items-center justify-center px-4">
              <div
                className="select-none leading-none"
                style={{
                  fontSize: big ? 74 : 56,
                  filter: "drop-shadow(0 10px 30px rgba(62,155,233,0.45))",
                }}
              >
                🏆
              </div>
              <div className="mt-1 font-display text-[11px] uppercase tracking-[0.34em] text-ink-muted">
                Campeão
              </div>
              <div
                className={`font-display font-black uppercase tracking-wide ${
                  championId ? "text-branco" : "text-ink-muted/50"
                }`}
                style={{ fontSize: big ? 42 : 30 }}
              >
                {championId ? get(championId)?.name : "a definir"}
              </div>
              {championId && runnerUpId && (
                <div className="font-display text-sm uppercase tracking-widest text-ink-muted">
                  vice: {get(runnerUpId)?.name}
                </div>
              )}
            </div>

            {/* 3º lugar ao lado: é decidido antes da final */}
            <div>
              <div className="mb-1.5 font-display text-[11px] uppercase tracking-[0.3em] text-ink-muted/70">
                🥉 Disputa de 3º lugar
              </div>
              <div className="space-y-1.5">
                <Barra
                  {...sideOf(bySlot("TERCEIRO"), "home")}
                  player={get(sideOf(bySlot("TERCEIRO"), "home").id)}
                  h={H}
                  placeholder="Perd. semi A"
                />
                <Barra
                  {...sideOf(bySlot("TERCEIRO"), "away")}
                  player={get(sideOf(bySlot("TERCEIRO"), "away").id)}
                  h={H}
                  placeholder="Perd. semi B"
                />
              </div>
              {third && (
                <p className="mt-2 font-display text-sm uppercase tracking-widest text-ink-muted">
                  3º lugar: <span className="text-ink">{get(third)?.name}</span>
                </p>
              )}
            </div>
          </div>
        </section>

        <p className="text-center text-xs text-ink-muted">
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
