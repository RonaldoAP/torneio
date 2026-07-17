"use client";

import type { Player } from "@/lib/types";
import { Avatar } from "@/components/ui";

/**
 * Linha de confronto padrão: nome + foto | placar | foto + nome.
 * Usada nos Confrontos (liga) e no Mata-mata (mesmo layout).
 * Vencedor em verde, perdedor em vermelho; empate neutro. Nos pênaltis do
 * mata-mata, o vencedor (pen_winner) é destacado com o selo "pên".
 */
export function MatchRow({
  home,
  away,
  homeGoals,
  awayGoals,
  penWinnerId,
  avatarSize = 36,
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
    ((homeGoals as number) > (awayGoals as number) || (tie && !!penWinnerId && penWinnerId === home?.id));
  const awayWin =
    played &&
    ((awayGoals as number) > (homeGoals as number) || (tie && !!penWinnerId && penWinnerId === away?.id));
  const bothPresent = !!home && !!away;

  const nameCls = (win: boolean, lose: boolean, present: boolean) =>
    `truncate ${
      !present ? "italic text-ink-muted/50" : win ? "font-semibold text-emerald-400" : lose ? "text-danger" : "text-ink"
    }`;
  const scoreCls = (win: boolean, lose: boolean) =>
    win ? "text-emerald-400" : lose ? "text-danger" : "text-white";

  return (
    <div className="px-3 py-4 sm:py-5">
      {caption && (
        <div className="mb-2 text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-muted/70">
          {caption}
        </div>
      )}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-4">
        {/* mandante: nome + foto */}
        <div className="flex min-w-0 items-center justify-end gap-2.5">
          {tie && penWinnerId === home?.id && <span className="text-[10px] font-semibold text-cyan">pên</span>}
          <span className={nameCls(homeWin, awayWin, !!home)}>{home?.name ?? "Aguardando…"}</span>
          <Avatar name={home?.name ?? "?"} photo={home?.photo} size={avatarSize} />
        </div>

        {/* placar */}
        <div className="min-w-[68px] text-center">
          {played ? (
            <span className="font-display text-2xl leading-none tracking-tight">
              <span className={scoreCls(homeWin, awayWin)}>{homeGoals}</span>
              <span className="mx-1 text-ink-muted/60">×</span>
              <span className={scoreCls(awayWin, homeWin)}>{awayGoals}</span>
            </span>
          ) : bothPresent ? (
            <span className="rounded-md border border-line px-2 py-0.5 font-display text-xs tracking-widest text-ink-muted">
              VS
            </span>
          ) : (
            <span className="text-ink-muted/40">·</span>
          )}
        </div>

        {/* visitante: foto + nome */}
        <div className="flex min-w-0 items-center gap-2.5">
          <Avatar name={away?.name ?? "?"} photo={away?.photo} size={avatarSize} />
          <span className={nameCls(awayWin, homeWin, !!away)}>{away?.name ?? "Aguardando…"}</span>
          {tie && penWinnerId === away?.id && <span className="text-[10px] font-semibold text-cyan">pên</span>}
        </div>
      </div>
    </div>
  );
}
