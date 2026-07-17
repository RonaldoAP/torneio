"use client";

import { useEffect, useState } from "react";
import type { Match, Player } from "@/lib/types";
import { adminActions } from "@/lib/adminActions";

const KO_STAGES = ["quartas", "semi", "final", "terceiro"];

export function ScoreEditor({
  match,
  players,
  onError,
}: {
  match: Match;
  players: Player[];
  onError?: (msg: string) => void;
}) {
  const name = (id: string | null) =>
    id ? players.find((p) => p.id === id)?.name ?? "?" : "—";
  const [home, setHome] = useState<string>(match.home_goals?.toString() ?? "");
  const [away, setAway] = useState<string>(match.away_goals?.toString() ?? "");
  const [pen, setPen] = useState<string>(match.pen_winner_id ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Sincroniza quando o dado muda por realtime.
  useEffect(() => {
    setHome(match.home_goals?.toString() ?? "");
    setAway(match.away_goals?.toString() ?? "");
    setPen(match.pen_winner_id ?? "");
  }, [match.home_goals, match.away_goals, match.pen_winner_id]);

  const bothFilled = home !== "" && away !== "";
  // Pênaltis só existem no mata-mata e na partida de desempate.
  // Na LIGA empate é empate (1 ponto pra cada) — nunca há pênalti/prorrogação.
  const penEligible = KO_STAGES.includes(match.stage) || match.stage === "desempate";
  const isTie = bothFilled && Number(home) === Number(away);
  const needsPen = penEligible && isTie && !!match.home_id && !!match.away_id;
  const disabled = !match.home_id || !match.away_id;

  async function save() {
    if (needsPen && !pen) {
      onError?.("Empate: escolha o vencedor nos pênaltis.");
      return;
    }
    setSaving(true);
    try {
      await adminActions.saveScore({
        id: match.id,
        home_goals: home,
        away_goals: away,
        pen_winner_id: needsPen ? pen : null,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch (e: any) {
      onError?.(e?.message ?? "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-line bg-base/40 p-3">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <span className="truncate text-right text-sm text-ink">{name(match.home_id)}</span>
        <div className="flex items-center gap-1">
          <input
            aria-label={`Gols ${name(match.home_id)}`}
            className="score-input"
            inputMode="numeric"
            value={home}
            disabled={disabled}
            onChange={(e) => setHome(e.target.value.replace(/[^0-9]/g, ""))}
          />
          <span className="text-ink-muted">×</span>
          <input
            aria-label={`Gols ${name(match.away_id)}`}
            className="score-input"
            inputMode="numeric"
            value={away}
            disabled={disabled}
            onChange={(e) => setAway(e.target.value.replace(/[^0-9]/g, ""))}
          />
        </div>
        <span className="truncate text-left text-sm text-ink">{name(match.away_id)}</span>
      </div>

      {needsPen && (
        <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-branco/10 px-2 py-1.5">
          <span className="text-xs text-branco">Empate → pênaltis. Vencedor:</span>
          <select
            className="input py-1 text-sm"
            value={pen}
            onChange={(e) => setPen(e.target.value)}
          >
            <option value="">Selecione…</option>
            <option value={match.home_id!}>{name(match.home_id)}</option>
            <option value={match.away_id!}>{name(match.away_id)}</option>
          </select>
        </div>
      )}

      <div className="mt-2 flex items-center justify-end gap-2">
        {saved && <span className="text-xs text-gremio">salvo ✓</span>}
        <button className="btn-primary py-1.5 text-sm" onClick={save} disabled={saving || disabled}>
          {saving ? "Salvando…" : "Salvar placar"}
        </button>
      </div>
    </div>
  );
}
