"use client";

import type { Player } from "@/lib/types";
import { Avatar } from "@/components/ui";

/**
 * Linha de confronto no formato da referência: NOME | foto | placar × placar |
 * foto | NOME — nomes em condensada caixa alta, fotos quadradas com moldura
 * azul e o "×" bem menor que os números.
 * Usada nos Confrontos (liga) e no Mata-mata (celular).
 * Vencedor em verde, perdedor apagado; nos pênaltis o vencedor leva o selo.
 */
export function MatchRow({
  home,
  away,
  homeGoals,
  awayGoals,
  penWinnerId,
  avatarSize = 44,
  caption,
}: {
  home?: Player | null;
  away?: Player | null;
  homeGoals: number | null;
  awayGoals: number | null;
  penWinnerId?: string | null;
  avatarSize?: number;
  caption?: string;
}) {
  const played = homeGoals != null && awayGoals != null;
  const tie = played && homeGoals === awayGoals;
  const homeWin =
    played &&
    ((homeGoals as number) > (awayGoals as number) ||
      (tie && !!penWinnerId && penWinnerId === home?.id));
  const awayWin =
    played &&
    ((awayGoals as number) > (homeGoals as number) ||
      (tie && !!penWinnerId && penWinnerId === away?.id));
  const bothPresent = !!home && !!away;

  // No telão o avatar vem grande; nome e placar acompanham a escala, senão não
  // se lê de longe.
  const grande = avatarSize >= 56;
  const nameSize = grande ? "text-3xl sm:text-5xl" : "text-xl sm:text-2xl";
  const scoreSize = grande ? "text-5xl sm:text-7xl" : "text-3xl sm:text-4xl";

  const nameCls = (win: boolean, lose: boolean, present: boolean) =>
    `truncate font-display font-bold uppercase tracking-wide ${nameSize} ${
      !present
        ? "text-ink-muted/40"
        : win
          ? "text-emerald-400"
          : lose
            ? "text-ink-muted"
            : "text-ink"
    }`;
  const scoreCls = (win: boolean, lose: boolean) =>
    win ? "text-emerald-400" : lose ? "text-ink-muted" : "text-branco";

  return (
    <div className="px-3 py-4 sm:px-5 sm:py-5">
      {caption && (
        <div className="mb-2 text-center font-display text-[11px] uppercase tracking-[0.28em] text-ink-muted/70">
          {caption}
        </div>
      )}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-5">
        {/* mandante: nome + foto */}
        <div className="flex min-w-0 items-center justify-end gap-2.5 sm:gap-4">
          {tie && penWinnerId === home?.id && (
            <span className="font-display text-[11px] uppercase tracking-widest text-cyan">
              pên
            </span>
          )}
          <span className={nameCls(homeWin, awayWin, !!home)}>{home?.name ?? "Aguardando"}</span>
          <Avatar name={home?.name ?? "?"} photo={home?.photo} size={avatarSize} />
        </div>

        {/* placar */}
        <div className="shrink-0 text-center">
          {played ? (
            <span className={`font-display leading-none ${scoreSize}`}>
              <span className={scoreCls(homeWin, awayWin)}>{homeGoals}</span>
              <span className="mx-1.5 align-middle text-[0.42em] text-ink-muted sm:mx-2.5">×</span>
              <span className={scoreCls(awayWin, homeWin)}>{awayGoals}</span>
            </span>
          ) : bothPresent ? (
            <span className="rounded border border-white/15 px-2.5 py-1 font-display text-sm tracking-[0.2em] text-ink-muted">
              VS
            </span>
          ) : (
            <span className="text-ink-muted/40">·</span>
          )}
        </div>

        {/* visitante: foto + nome */}
        <div className="flex min-w-0 items-center gap-2.5 sm:gap-4">
          <Avatar name={away?.name ?? "?"} photo={away?.photo} size={avatarSize} />
          <span className={nameCls(awayWin, homeWin, !!away)}>{away?.name ?? "Aguardando"}</span>
          {tie && penWinnerId === away?.id && (
            <span className="font-display text-[11px] uppercase tracking-widest text-cyan">
              pên
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
