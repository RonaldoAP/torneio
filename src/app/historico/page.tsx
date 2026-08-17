"use client";

import Link from "next/link";
import { useEditions } from "@/lib/useTournament";
import { PageHeader, EmptyState, Loading } from "@/components/ui";
import { editionLabel, eventInfo } from "@/lib/editions";

/**
 * Histórico: lista as edições já encerradas. Cada uma abre em /historico/<n>
 * com a classificação final, a chave e a artilharia daquele ano — só leitura.
 */
export default function HistoricoPage() {
  const { editions, current, loading } = useEditions();
  const past = editions.filter((e) => e.id !== current).sort((a, b) => b.id - a.id);

  return (
    <div className="animate-reveal">
      <PageHeader title="Histórico" subtitle="As edições anteriores da Copa Costela" />

      {loading ? (
        <Loading />
      ) : past.length === 0 ? (
        <EmptyState>
          <p>Ainda não há edições encerradas.</p>
          <p className="mt-1 text-sm">
            Quando uma nova edição começar, a atual fica guardada aqui — com classificação, chave e
            artilharia.
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
                  <span className="chip w-fit border-cyan/50 text-cyan">{editionLabel(e.id)}</span>
                  <span className="mt-1 font-display text-2xl tracking-wide text-ink">{e.name}</span>
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
    </div>
  );
}
