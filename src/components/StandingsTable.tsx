"use client";

import { computeStandings, TOP_N } from "@/lib/standings";
import type { Match, Player } from "@/lib/types";
import { Avatar } from "@/components/ui";

/**
 * Classificação no formato das tabelas de TV da Champions (referência do
 * organizador): barra de posição colorida, escudo (foto) + nome em caixa alta
 * condensada, e os números na ordem que o organizador lê primeiro: PTS na frente,
 * depois PJ V E D e os gols separados (GM marcados · GC sofridos · SG saldo).
 */
export function StandingsTable({
  players,
  matches,
  big = false,
}: {
  players: Player[];
  matches: Match[];
  big?: boolean;
}) {
  const rows = computeStandings(players, matches);
  const photoById = new Map(players.map((p) => [p.id, p.photo] as const));

  const th = `px-2 py-2.5 font-display font-semibold uppercase tracking-[0.12em] text-ink-muted ${
    big ? "text-base" : "text-[11px]"
  }`;
  const num = `px-2 text-center font-display tabular text-ink ${
    big ? "py-4 text-3xl" : "py-3 text-lg"
  }`;

  return (
    <div className="panel overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-line">
            <th className={`${th} pl-3 text-left`} />
            <th className={`${th} text-left`}>Participante</th>
            <th className={`${th} text-center text-branco`}>Pts</th>
            <th className={`${th} text-center`}>PJ</th>
            <th className={`${th} text-center`}>V</th>
            <th className={`${th} text-center`}>E</th>
            <th className={`${th} text-center`}>D</th>
            <th className={`${th} text-center`} title="Gols marcados">
              GM
            </th>
            <th className={`${th} text-center`} title="Gols sofridos">
              GC
            </th>
            <th className={`${th} text-center`} title="Saldo de gols">
              SG
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const pos = i + 1;
            const qualified = pos <= TOP_N;
            return (
              <tr
                key={r.playerId}
                className={`group border-b border-line/50 transition-colors animate-reveal hover:bg-white/[0.03] ${
                  qualified ? "bg-azul/[0.07]" : ""
                }`}
              >
                {/* posição + barra lateral (zona de classificação) */}
                <td className="py-2 pl-0">
                  <span className="flex items-center">
                    <span
                      className={`rounded-r ${big ? "h-14 w-1.5" : "h-11 w-1"} ${
                        qualified ? "bg-azul" : "bg-ink-muted/25"
                      }`}
                    />
                    <span
                      className={`ml-2 w-7 text-center font-display font-bold tabular ${
                        big ? "text-3xl" : "text-xl"
                      }`}
                      // classificado em azul, quem está fora em branco
                      style={{ color: qualified ? "#3E9BE9" : "#FFFFFF" }}
                    >
                      {pos}
                    </span>
                  </span>
                </td>

                {/* escudo (foto) + nome em caixa alta */}
                <td className={`px-2 text-left ${big ? "py-4" : "py-3"}`}>
                  <span className="flex items-center gap-2.5">
                    <Avatar name={r.name} photo={photoById.get(r.playerId)} size={big ? 52 : 40} />
                    <span
                      className={`truncate font-display font-bold uppercase tracking-wide text-ink ${
                        big ? "text-4xl" : "text-2xl"
                      }`}
                    >
                      {r.name}
                    </span>
                    {r.unresolvedTie && (
                      <span
                        className="chip border-branco/50 font-sans text-branco"
                        title="Empate não resolvido que afeta o Top 6 — decidir em partida de desempate"
                      >
                        ⚠
                      </span>
                    )}
                  </span>
                </td>

                <td className={`${num} font-black text-branco ${big ? "text-4xl" : "text-xl"}`}>
                  {r.points}
                </td>
                <td className={`${num} text-ink-muted`}>{r.played}</td>
                <td className={num}>{r.wins}</td>
                <td className={num}>{r.draws}</td>
                <td className={num}>{r.losses}</td>
                <td className={num}>{r.goalsFor}</td>
                <td className={`${num} text-ink-muted`}>{r.goalsAgainst}</td>
                <td
                  className={`${num} ${
                    r.goalDiff > 0 ? "text-emerald-400" : r.goalDiff < 0 ? "text-danger" : ""
                  }`}
                >
                  {r.goalDiff > 0 ? `+${r.goalDiff}` : r.goalDiff}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
