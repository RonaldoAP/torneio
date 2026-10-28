"use client";

import Link from "next/link";
import { groupByEditions, type Profile } from "@/lib/profiles";
import { Avatar } from "@/components/ui";

/**
 * Mural de perfis: um box por participante, em linhas.
 * A ordem é a do `groupByEditions` — quem disputou mais edições primeiro,
 * sempre; dentro de cada grupo, a nota de carreira (título/prêmio/pódio pesam
 * muito mais que campanha).
 */
export function ProfileGrid({ profiles }: { profiles: Profile[] }) {
  const grupos = groupByEditions(profiles);

  return (
    <div className="space-y-5">
      {grupos.map(({ editions, profiles: linha }) => (
        <section key={editions}>
          <h3 className="mb-2 font-display text-sm uppercase tracking-[0.2em] text-ink-muted">
            {editions} {editions === 1 ? "edição" : "edições"}
            <span className="ml-2 font-sans text-[11px] normal-case tracking-normal text-ink-muted/60">
              {linha.length} {linha.length === 1 ? "participante" : "participantes"}
            </span>
          </h3>

          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {linha.map((p, i) => {
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
        </section>
      ))}
    </div>
  );
}
