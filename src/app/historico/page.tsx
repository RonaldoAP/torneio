"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useAllEditions } from "@/lib/useTournament";
import { buildProfiles } from "@/lib/profiles";
import { PageHeader, EmptyState, Loading } from "@/components/ui";
import { ProfileGrid } from "@/components/ProfileGrid";
import { editionLabel, eventInfo } from "@/lib/editions";

/**
 * Histórico: as edições já encerradas e, abaixo, o mural de perfis.
 * Cada edição abre em /historico/<n> com a classificação final, a chave e a
 * artilharia daquele ano — só leitura. Cada box de participante abre a ficha
 * dele somando todas as edições.
 */
export default function HistoricoPage() {
  const { players, matches, editions, current, loading } = useAllEditions();
  const past = editions.filter((e) => e.id !== current).sort((a, b) => b.id - a.id);
  const perfis = useMemo(
    () => buildProfiles(players, matches, editions),
    [players, matches, editions],
  );

  return (
    <div className="animate-reveal">
      <PageHeader title="Histórico" subtitle="As edições anteriores da Copa Costela" />

      {loading ? (
        <Loading />
      ) : (
        <div className="space-y-8">
          <section>
            {past.length === 0 ? (
              <EmptyState>
                <p>Ainda não há edições encerradas.</p>
                <p className="mt-1 text-sm">
                  Quando uma nova edição começar, a atual fica guardada aqui — com classificação,
                  chave e artilharia.
                </p>
              </EmptyState>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2">
                {past.map((e) => {
                  const ev = eventInfo(e);
                  return (
                    <li key={e.id}>
                      <Link
                        href={`/historico/${e.id}`}
                        className="panel flex h-full flex-col gap-1 p-4 transition-colors hover:border-cyan/40"
                      >
                        <span className="chip w-fit border-cyan/50 text-cyan">
                          {editionLabel(e.id)}
                        </span>
                        <span className="mt-1 font-display text-2xl tracking-wide text-ink">
                          {e.name}
                        </span>
                        <span className="text-sm text-ink-muted">
                          📅 {ev.date} · 📍 {ev.local}
                        </span>
                        <span className="mt-2 text-sm text-cyan">Ver classificação e chave →</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {perfis.length > 0 && (
            <section>
              <h2 className="font-display text-2xl tracking-wide">Perfis</h2>
              <p className="mb-3 mt-1 font-sans text-xs text-ink-muted">
                Ranking geral por títulos, prêmios e pódios — campanha e aproveitamento só
                desempatam. O número de edições não dá pontos. Clique num box para ver a ficha
                completa.
              </p>
              <ProfileGrid profiles={perfis} />
            </section>
          )}
        </div>
      )}
    </div>
  );
}
