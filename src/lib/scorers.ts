import type { Match, Player, ScorerRow } from "./types";

/**
 * Ranking de artilharia por PARTICIPANTE (o placar do lado dele).
 * Soma os gols em partidas com counts_for_scorers = true
 * (liga + quartas + semis + 3º lugar + final; tempo normal + prorrogação).
 * NÃO conta gols de partidas de desempate nem de disputa de pênaltis.
 * Ordena por: mais gols; empate por menos jogos; depois por nome.
 */
export function computeScorers(players: Player[], matches: Match[]): ScorerRow[] {
  const rows = new Map<string, ScorerRow>();
  for (const p of players) {
    rows.set(p.id, { playerId: p.id, name: p.name, goals: 0, games: 0 });
  }

  for (const m of matches) {
    if (!m.counts_for_scorers) continue;
    if (m.stage === "desempate") continue; // reforço: desempate nunca conta
    if (m.home_goals == null || m.away_goals == null) continue;

    if (m.home_id) {
      const r = rows.get(m.home_id);
      if (r) {
        r.goals += m.home_goals;
        r.games += 1;
      }
    }
    if (m.away_id) {
      const r = rows.get(m.away_id);
      if (r) {
        r.goals += m.away_goals;
        r.games += 1;
      }
    }
  }

  return [...rows.values()].sort((a, b) => {
    if (b.goals !== a.goals) return b.goals - a.goals;
    if (a.games !== b.games) return a.games - b.games;
    return a.name.localeCompare(b.name, "pt-BR");
  });
}
