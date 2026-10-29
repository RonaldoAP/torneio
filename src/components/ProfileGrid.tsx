"use client";

import Link from "next/link";
import { rankProfiles, type Profile } from "@/lib/profiles";
import { Avatar } from "@/components/ui";

/**
 * Mural de perfis: um box por participante, em linhas, num ranking GERAL.
 * A ordem vem de `rankProfiles` — só a nota de carreira (título, prêmio e
 * pódio pesam muito mais que campanha). O número de edições não ordena nada
 * por fora: é só mais um peso dentro da nota, hoje zerado.
 */
export function ProfileGrid({ profiles }: { profiles: Profile[] }) {
  const ranking = rankProfiles(profiles);

  return (
    <div>
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {ranking.map((p, i) => {
          const c = p.career;
          return (
            <li key={p.key}>
              <Link
                href={`/perfis/${p.slug}`}
                className="panel flex h-full items-center gap-3 p-3 transition-colors hover:bg-white/[0.04]"
              >
                {/* posição dentro do grupo */}
                <span className="w-5 shrink-0 text-center font-display text-lg text-ink-muted">
                  {i + 1}
                </span>
                <Avatar name={p.name} photo={p.photo} size={48} />

                <span className="min-w-0 flex-1">
                  <span className="block truncate font-display text-2xl tracking-wide text-ink">
                    {p.name}
                  </span>
                  <span className="mt-0.5 block font-sans text-[11px] text-ink-muted">
                    {c.editions} {c.editions === 1 ? "edição" : "edições"} ·{" "}
                    {c.played} {c.played === 1 ? "jogo" : "jogos"} · {c.goals}{" "}
                    {c.goals === 1 ? "gol" : "gols"} · {c.winRate}% aprov.
                    {c.bestPosition != null && ` · melhor ${c.bestPosition}º`}
                  </span>

                  {(c.titles > 0 ||
                    c.runnerUps > 0 ||
                    c.thirds > 0 ||
                    c.topScorerAwards > 0 ||
                    c.bestDefenseAwards > 0) && (
                    <span className="mt-1.5 flex flex-wrap gap-1">
                      {c.titles > 0 && (
                        <span
                          className="chip border-gremio/50 font-sans text-gremio"
                          title={`${c.titles}× campeão`}
                        >
                          🏆 {c.titles}
                        </span>
                      )}
                      {c.runnerUps > 0 && (
                        <span
                          className="chip border-white/25 font-sans text-ink"
                          title={`${c.runnerUps}× vice`}
                        >
                          🥈 {c.runnerUps}
                        </span>
                      )}
                      {c.thirds > 0 && (
                        <span
                          className="chip border-amber-500/40 font-sans text-amber-400"
                          title={`${c.thirds}× terceiro lugar`}
                        >
                          🥉 {c.thirds}
                        </span>
                      )}
                      {c.topScorerAwards > 0 && (
                        <span
                          className="chip border-gremio/40 font-sans text-gremio"
                          title={`${c.topScorerAwards}× artilheiro`}
                        >
                          ⚽ {c.topScorerAwards}
                        </span>
                      )}
                      {c.bestDefenseAwards > 0 && (
                        <span
                          className="chip border-cyan/50 font-sans text-cyan"
                          title={`${c.bestDefenseAwards}× melhor defesa`}
                        >
                          🧤 {c.bestDefenseAwards}
                        </span>
                      )}
                    </span>
                  )}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
