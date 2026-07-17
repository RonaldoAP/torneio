"use client";

import { computeStandings, recentResults, TOP_N } from "@/lib/standings";
import type { Match, Player } from "@/lib/types";
import { Avatar } from "@/components/ui";

function FormDots({ results }: { results: ReturnType<typeof recentResults> }) {
  if (results.length === 0) {
    return <span className="text-ink-muted/40">—</span>;
  }
  return (
    <span className="inline-flex items-center gap-1">
      {results.map((r, i) => (
        <span
          key={i}
          title={r === "V" ? "Vitória" : r === "E" ? "Empate" : "Derrota"}
          className={`inline-block h-2.5 w-2.5 rounded-full ${
            r === "V" ? "bg-emerald-400" : r === "D" ? "bg-danger" : "bg-ink-muted/50"
          }`}
        />
      ))}
    </span>
  );
}

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
  const num = "px-2 py-2 text-center tabular";
  const th = "px-2 py-2 text-center font-semibold uppercase tracking-wide text-[11px] text-ink-muted";

  return (
    <div className="panel overflow-x-auto">
      <table className={`w-full ${big ? "text-lg sm:text-2xl" : "text-sm"}`}>
        <thead>
          <tr className="border-b border-line">
            <th className={`${th} text-left pl-3`}>#</th>
            <th className={`${th} text-left`}>Participante</th>
            <th className={`${th} text-white`}>P</th>
            <th className={th}>J</th>
            <th className={th}>V</th>
            <th className={th}>E</th>
            <th className={th}>D</th>
            <th className={th}>GP</th>
            <th className={th}>GC</th>
            <th className={th}>SG</th>
            <th className={`${th} hidden sm:table-cell`}>%</th>
            <th className={`${th} hidden md:table-cell`}>Últ.</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const pos = i + 1;
            const qualified = pos <= TOP_N;
            const aprov = r.played > 0 ? Math.round((r.points / (r.played * 3)) * 100) : 0;
            return (
              <tr
                key={r.playerId}
                className={`group border-b border-line/50 transition-colors animate-reveal hover:bg-white/[0.03] ${
                  qualified ? "bg-cyan/[0.05]" : ""
                }`}
              >
                <td className="py-2 pl-0 text-center">
                  <span className="flex items-center">
                    <span
                      className={`h-8 w-1 rounded-r ${qualified ? "bg-cyan" : "bg-transparent"} ${big ? "h-11" : ""}`}
                    />
                    <span
                      className={`ml-1.5 w-6 text-center font-display tabular ${
                        qualified ? "text-cyan" : "text-ink-muted"
                      } ${big ? "text-2xl" : ""}`}
                    >
                      {pos}
                    </span>
                  </span>
                </td>
                <td className="px-2 py-2 text-left">
                  <span className="flex items-center gap-2.5">
                    <Avatar name={r.name} photo={photoById.get(r.playerId)} size={big ? 40 : 30} />
                    <span className="truncate font-semibold text-ink">{r.name}</span>
                    {r.unresolvedTie && (
                      <span
                        className="chip border-branco/50 text-branco"
                        title="Empate não resolvido que afeta o Top 6 — decidir em partida de desempate"
                      >
                        ⚠
                      </span>
                    )}
                  </span>
                </td>
                <td className={`${num} font-display text-white`}>{r.points}</td>
                <td className={`${num} text-ink-muted`}>{r.played}</td>
                <td className={num}>{r.wins}</td>
                <td className={num}>{r.draws}</td>
                <td className={num}>{r.losses}</td>
                <td className={num}>{r.goalsFor}</td>
                <td className={num}>{r.goalsAgainst}</td>
                <td className={`${num} ${r.goalDiff > 0 ? "text-emerald-400" : r.goalDiff < 0 ? "text-danger" : ""}`}>
                  {r.goalDiff > 0 ? `+${r.goalDiff}` : r.goalDiff}
                </td>
                <td className={`${num} hidden text-ink-muted sm:table-cell`}>{aprov}%</td>
                <td className="hidden px-3 py-2 text-center md:table-cell">
                  <FormDots results={recentResults(r.playerId, matches)} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
