"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useAllEditions } from "@/lib/useTournament";
import { buildProfiles } from "@/lib/profiles";
import { PageHeader, LiveBadge, EmptyState, Loading, Avatar } from "@/components/ui";

/**
 * Galeria de perfis: todo mundo que já passou por qualquer Copa Costela, com a
 * ficha somada das edições. Ordenado por títulos (ver buildProfiles).
 */
export default function PerfisPage() {
  const { players, matches, editions, loading, mode } = useAllEditions();
  const perfis = useMemo(
    () => buildProfiles(players, matches, editions),
    [players, matches, editions],
  );

  return (
    <div className="animate-reveal">
      <PageHeader
        title="Perfis"
        subtitle="A ficha de cada participante somando todas as Copas Costela"
        right={<LiveBadge mode={mode} connected={!loading} />}
      />

      {loading ? (
        <Loading />
      ) : perfis.length === 0 ? (
        <EmptyState>
          <p>Nenhum participante cadastrado ainda.</p>
        </EmptyState>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {perfis.map((p) => (
            <li key={p.key}>
              <Link
                href={`/perfis/${p.slug}`}
                className="panel flex items-center gap-3 p-3 transition-colors hover:bg-white/[0.04]"
              >
                <Avatar name={p.name} photo={p.photo} size={52} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-display text-2xl tracking-wide text-ink">
                    {p.name}
                  </span>
                  <span className="block font-sans text-xs text-ink-muted">
                    {p.career.editions} {p.career.editions === 1 ? "edição" : "edições"} ·{" "}
                    {p.career.played} {p.career.played === 1 ? "jogo" : "jogos"} · {p.career.goals}{" "}
                    {p.career.goals === 1 ? "gol" : "gols"}
                  </span>
                </span>
                <span className="flex shrink-0 gap-1">
                  {p.career.titles > 0 && (
                    <span className="chip border-gremio/50 font-sans text-gremio" title="Títulos">
                      🏆 {p.career.titles}
                    </span>
                  )}
                  {p.career.topScorerAwards > 0 && (
                    <span className="chip border-gremio/40 font-sans text-gremio" title="Artilharias">
                      ⚽ {p.career.topScorerAwards}
                    </span>
                  )}
                  {p.career.bestDefenseAwards > 0 && (
                    <span className="chip border-cyan/50 font-sans text-cyan" title="Melhor defesa">
                      🧤 {p.career.bestDefenseAwards}
                    </span>
                  )}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
