"use client";

import { useTournament } from "@/lib/useTournament";
import { PageHeader, LiveBadge, EmptyState, Loading, Avatar } from "@/components/ui";

export default function ParticipantesPage() {
  const { players, mode, connected, loading } = useTournament();

  return (
    <div className="animate-reveal">
      <PageHeader
        title="Participantes"
        subtitle={`${players.length} de 12 inscritos`}
        right={<LiveBadge mode={mode} connected={connected} />}
      />

      {loading ? (
        <Loading />
      ) : players.length === 0 ? (
        <EmptyState>
          <p>Nenhum participante ainda.</p>
          <p className="mt-1 text-sm">O admin cadastra os jogadores conforme confirmam presença.</p>
        </EmptyState>
      ) : (
        <ol className="grid gap-2 sm:grid-cols-2">
          {players.map((p, i) => (
            <li key={p.id} className="panel flex items-center gap-3 p-3">
              <span className="w-5 shrink-0 text-center font-display text-lg text-ink-muted">
                {i + 1}
              </span>
              <Avatar name={p.name} photo={p.photo} size={44} />
              <span className="truncate font-display text-2xl tracking-wide text-ink">{p.name}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
