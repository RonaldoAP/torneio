import type { DefenseRow, Edition, Match, Player, ScorerRow, StandingRow } from "./types";
import { computeStandings } from "./standings";
import { computeDefense, computeScorers } from "./scorers";
import { championAndRunnerUp, thirdPlace } from "./bracket";
import { EVENT } from "./config";

// ============================================================================
//  EDIÇÕES — cada torneio é uma "edição" (1ª Copa Costela, 2ª, ...).
//  `players` e `matches` carregam o número da edição a que pertencem; o site
//  mostra sempre a edição ATIVA (config.current_edition) e guarda as antigas
//  em /historico. Linhas sem `edition` são da 1ª edição (bancos antigos).
// ============================================================================

export const FIRST_EDITION = 1;

type WithEdition = { edition?: number | null };

/** Número da edição de uma linha (players/matches). Sem valor = 1ª edição. */
export function editionOf(row: WithEdition | null | undefined): number {
  const n = row?.edition;
  return typeof n === "number" && Number.isFinite(n) ? n : FIRST_EDITION;
}

/** Filtra jogadores/partidas de uma edição. */
export function forEdition<T extends WithEdition>(rows: T[], edition: number): T[] {
  return rows.filter((r) => editionOf(r) === edition);
}

/** Próximo número livre (maior + 1). */
export function nextEditionId(editions: Edition[]): number {
  return editions.reduce((max, e) => Math.max(max, e.id), 0) + 1;
}

/** "1ª edição", "2ª edição"… */
export function editionLabel(id: number): string {
  return `${id}ª edição`;
}

/** Dados do evento da edição, com as constantes de `config.ts` como fallback. */
export function eventInfo(edition?: Edition | null) {
  return {
    date: edition?.event_date || EVENT.date,
    time: edition?.event_time || EVENT.time,
    local: edition?.event_local || EVENT.local,
    note: edition?.event_note || EVENT.note,
    slots: EVENT.slots,
  };
}

/** Cria a linha de uma nova edição (metadados em branco — o admin preenche). */
export function makeEdition(id: number, name: string): Edition {
  return {
    id,
    name,
    event_date: null,
    event_time: null,
    event_local: null,
    event_note: null,
    created_at: new Date().toISOString(),
    closed_at: null,
  };
}

// ---------------------------------------------------------------------------
// Resumo de uma edição (usado nos cards do histórico)
// ---------------------------------------------------------------------------

export interface EditionSummary {
  standings: StandingRow[];
  scorers: ScorerRow[];
  championId: string | null;
  runnerUpId: string | null;
  thirdId: string | null;
  topScorer: ScorerRow | null;
  bestDefense: DefenseRow | null;
  /** último colocado (lanterna) — null enquanto não houver classificação */
  lastPlaceId: string | null;
  /** partidas com placar lançado */
  played: number;
  /** total de partidas da edição */
  total: number;
}

export function summarizeEdition(players: Player[], matches: Match[]): EditionSummary {
  const standings = computeStandings(players, matches);
  const scorers = computeScorers(players, matches).filter((s) => s.goals > 0);
  const { championId, runnerUpId } = championAndRunnerUp(matches);
  const defense = computeDefense(players, matches);
  return {
    standings,
    scorers,
    championId,
    runnerUpId,
    thirdId: thirdPlace(matches),
    topScorer: scorers[0] ?? null,
    bestDefense: defense[0] ?? null,
    lastPlaceId: standings.length > 0 ? standings[standings.length - 1].playerId : null,
    played: matches.filter((m) => m.home_goals != null && m.away_goals != null).length,
    total: matches.length,
  };
}

// ---------------------------------------------------------------------------
// Blindagem do "Remover participante"
// ---------------------------------------------------------------------------

export interface RemovalImpact {
  /** partidas em que o jogador aparece */
  total: number;
  /** dessas, quantas já têm placar lançado */
  played: number;
}

/** Quantas partidas somem junto se este participante for removido. */
export function removalImpact(matches: Match[], playerId: string): RemovalImpact {
  const mine = matches.filter((m) => m.home_id === playerId || m.away_id === playerId);
  return {
    total: mine.length,
    played: mine.filter((m) => m.home_goals != null || m.away_goals != null).length,
  };
}

/**
 * Mensagem de bloqueio da remoção — ou null quando é seguro remover.
 * Remover apaga o participante E todos os jogos dele (foi assim que a 1ª edição
 * perdeu 10 partidas já jogadas). Com partidas na mesa, só passa com `force`.
 */
export function removalBlockedMessage(
  matches: Match[],
  playerId: string,
  playerName?: string,
): string | null {
  const { total, played } = removalImpact(matches, playerId);
  if (total === 0) return null;
  const quem = playerName ? `${playerName} ` : "";
  const jogos = `${total} ${total === 1 ? "partida" : "partidas"}`;
  const comPlacar =
    played > 0
      ? ` — ${played} já ${played === 1 ? "tem placar lançado" : "têm placar lançado"}`
      : "";
  return (
    `Remover ${quem}apaga junto ${jogos}${comPlacar}. ` +
    `Quem apenas abandonou o torneio deve entrar em "Desistência (W.O.)": ali os jogos ` +
    `são mantidos e viram 3×0 para os adversários. Confirme se quiser mesmo apagar.`
  );
}
