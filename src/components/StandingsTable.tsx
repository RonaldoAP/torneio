"use client";

import { computeStandings, TOP_N } from "@/lib/standings";
import type { Match, Player } from "@/lib/types";
import { Avatar } from "@/components/ui";

/**
 * Classificação no formato das tabelas de TV da Champions (referência do
 * organizador): barra de posição colorida, escudo (foto) + nome em caixa alta
 * condensada, colunas PJ V E D GOLS PTS. "GOLS" traz marcados:sofridos — o saldo
 * sai daí, e continua valendo como 3º critério de desempate.
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
            <th className={`${th} text-center`}>PJ</th>
            <th className={`${th} text-center`}>V</th>
            <th className={`${th} text-center`}>E</th>
            <th className={`${th} text-center`}>D</th>
            <th className={`${th} text-center`}>Gols</th>
            <th className={`${th} text-center text-branco`}>Pts</th>
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
                  qualified ? "bg-cyan/[0.04]" : ""
                }`}
              >
                {/* posição + barra lateral (zona de classificação) */}
                <td className="py-2 pl-0">
                  <span className="flex items-center">
                    <span
                      className={`rounded-r ${big ? "h-12 w-1.5" : "h-9 w-1"} ${
                        qualified ? "bg-cyan" : "bg-ink-muted/25"
                      }`}
                    />
                    <span
                      className={`ml-2 w-6 text-center font-display tabular ${
                        big ? "text-2xl" : "text-base"
                      } ${qualified ? "text-cyan" : "text-ink-muted"}`}
                    >
                      {pos}
                    </span>
                  </span>
                </td>

                {/* escudo (foto) + nome em caixa alta */}
                <td className={`px-2 text-left ${big ? "py-4" : "py-3"}`}>
                  <span className="flex items-center gap-2.5">
                    <Avatar name={r.name} photo={photoById.get(r.playerId)} size={big ? 44 : 32} />
                    <span
                      className={`truncate font-display font-bold uppercase tracking-wide text-ink ${
                        big ? "text-3xl" : "text-lg"
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

                <td className={`${num} text-ink-muted`}>{r.played}</td>
                <td className={num}>{r.wins}</td>
                <td className={num}>{r.draws}</td>
                <td className={num}>{r.losses}</td>
                <td className={`${num} whitespace-nowrap text-ink-muted`}>
                  <span className="text-ink">{r.goalsFor}</span>
                  <span className="mx-0.5 text-ink-muted/60">:</span>
                  <span>{r.goalsAgainst}</span>
                </td>
                <td className={`${num} font-black text-branco ${big ? "text-4xl" : "text-xl"}`}>
                  {r.points}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
