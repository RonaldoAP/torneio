"use client";

import { computeStandings, TOP_N } from "@/lib/standings";
import type { Match, Player } from "@/lib/types";

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
  const cell = big ? "px-2 py-3 sm:px-3" : "px-2 py-2";
  const numCls = "text-center tabular";

  return (
    <div className="panel overflow-x-auto">
      <table className={`w-full ${big ? "text-lg sm:text-2xl" : "text-sm"}`}>
        <thead>
          <tr className="border-b border-line text-ink-muted">
            <th className={`${cell} text-center`}>#</th>
            <th className={`${cell} text-left`}>Jogador</th>
            <th className={numCls}>P</th>
            <th className={numCls}>J</th>
            <th className={numCls}>V</th>
            <th className={numCls}>E</th>
            <th className={numCls}>D</th>
            <th className={`${numCls} hidden sm:table-cell`}>GP</th>
            <th className={`${numCls} hidden sm:table-cell`}>GC</th>
            <th className={numCls}>SG</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const pos = i + 1;
            const qualified = pos <= TOP_N;
            return (
              <tr
                key={r.playerId}
                className={`border-b border-line/60 transition-colors animate-reveal ${
                  qualified ? "bg-gremio/[0.06]" : ""
                }`}
              >
                <td className={`${cell} text-center`}>
                  <span
                    className={`inline-grid h-6 w-6 place-items-center rounded-md font-display ${
                      qualified ? "bg-gremio/20 text-gremio" : "text-ink-muted"
                    } ${big ? "h-9 w-9 text-2xl" : ""}`}
                  >
                    {pos}
                  </span>
                </td>
                <td className={`${cell} text-left`}>
                  <span className="flex items-center gap-2">
                    <span className="truncate text-ink">{r.name}</span>
                    {r.unresolvedTie && (
                      <span
                        className="chip border-branco/50 text-branco"
                        title="Empate não resolvido que afeta o Top 8 — decidir em partida de desempate"
                      >
                        empate ⚠
                      </span>
                    )}
                  </span>
                </td>
                <td className={`${numCls} font-semibold text-ink`}>{r.points}</td>
                <td className={numCls}>{r.played}</td>
                <td className={numCls}>{r.wins}</td>
                <td className={numCls}>{r.draws}</td>
                <td className={numCls}>{r.losses}</td>
                <td className={`${numCls} hidden sm:table-cell`}>{r.goalsFor}</td>
                <td className={`${numCls} hidden sm:table-cell`}>{r.goalsAgainst}</td>
                <td className={`${numCls} ${r.goalDiff > 0 ? "text-gremio" : r.goalDiff < 0 ? "text-danger" : ""}`}>
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
