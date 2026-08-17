import type { DefenseRow, Match, Player, ScorerRow } from "./types";

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

/**
 * Ranking de MELHOR DEFESA por participante: quem sofreu menos gols.
 * Usa exatamente o mesmo filtro da artilharia (`counts_for_scorers`), então
 * **não conta gol de W.O. nem de partida de desempate** — sem isso, quem levasse
 * um W.O. 0×3 apareceria tendo sofrido 3 gols que ninguém fez nele.
 * Por isso este número pode divergir da coluna **GC** da classificação, que soma
 * tudo (lá o W.O. precisa valer, porque decide pontos).
 * Só entram no ranking quem já jogou — sem jogo não há defesa a premiar.
 * Ordena por: menos gols sofridos; empate por mais jogos; depois por nome.
 */
export function computeDefense(players: Player[], matches: Match[]): DefenseRow[] {
  const rows = new Map<string, DefenseRow>();
  for (const p of players) {
    rows.set(p.id, { playerId: p.id, name: p.name, conceded: 0, games: 0, cleanSheets: 0 });
  }

  for (const m of matches) {
    if (!m.counts_for_scorers) continue;
    if (m.stage === "desempate") continue; // reforço: desempate nunca conta
    if (m.home_goals == null || m.away_goals == null) continue;

    // O que o adversário fez é o que este participante sofreu.
    const lados = [
      { id: m.home_id, sofridos: m.away_goals },
      { id: m.away_id, sofridos: m.home_goals },
    ];
    for (const { id, sofridos } of lados) {
      if (!id) continue;
      const r = rows.get(id);
      if (!r) continue;
      r.conceded += sofridos;
      r.games += 1;
      if (sofridos === 0) r.cleanSheets += 1;
    }
  }

  return [...rows.values()]
    .filter((r) => r.games > 0)
    .sort((a, b) => {
      if (a.conceded !== b.conceded) return a.conceded - b.conceded;
      if (b.games !== a.games) return b.games - a.games;
      return a.name.localeCompare(b.name, "pt-BR");
    });
}
