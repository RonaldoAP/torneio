"use client";

import type { Player } from "@/lib/types";
import type { DataMode } from "@/lib/useTournament";

export function PageHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-3xl leading-none tracking-wide text-ink sm:text-4xl">
          {title}
        </h1>
        {subtitle && <p className="mt-1 text-sm text-ink-muted">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

export function LiveBadge({ mode, connected }: { mode: DataMode; connected: boolean }) {
  if (mode === "local") {
    return (
      <span className="chip border-gold/40 text-gold" title="Sem Supabase: estado local neste dispositivo">
        <span className="h-2 w-2 rounded-full bg-gold" />
        Modo local
      </span>
    );
  }
  return (
    <span className={`chip ${connected ? "border-grass/40 text-grass" : "text-ink-muted"}`}>
      <span
        className={`h-2 w-2 rounded-full ${connected ? "animate-pulseGrass bg-grass" : "bg-ink-muted"}`}
      />
      {connected ? "Ao vivo" : "Conectando…"}
    </span>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="panel grid place-items-center px-6 py-14 text-center text-ink-muted">
      {children}
    </div>
  );
}

export function Loading() {
  return (
    <div className="panel grid place-items-center px-6 py-14 text-ink-muted">
      Carregando…
    </div>
  );
}

/** Mapa id -> nome para exibir jogadores. */
export function useNameMap(players: Player[]) {
  const map = new Map<string, string>();
  for (const p of players) map.set(p.id, p.name);
  return (id: string | null | undefined, fallback = "—") =>
    id ? map.get(id) ?? "?" : fallback;
}
