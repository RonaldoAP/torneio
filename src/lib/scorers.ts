import type { DefenseRow, Match, Player, ScorerRow } from "./types";

/**
 * Uma partida vale para artilharia/defesa? Liga + quartas + semis + 3º lugar +
 * final (tempo normal + prorrogação). Nunca desempate, nunca disputa de
 * pênaltis, nunca W.O. — quem levou 0×3 no W.O. não sofreu gol de ninguém.
 */
function contaParaPremio(m: Match): boolean {
  return (
    m.counts_for_scorers &&
    m.stage !== "desempate" &&
    m.home_goals != null &&
    m.away_goals != null
  );
}

/** Marcados e sofridos de cada participante, no recorte dos prêmios. */
interface Tally {
  goals: number;
  conceded: number;
  games: number;
  cleanSheets: number;
}

function tally(players: Player[], matches: Match[]): Map<string, Tally> {
  const rows = new Map<string, Tally>();
  for (const p of players) {
    rows.set(p.id, { goals: 0, conceded: 0, games: 0, cleanSheets: 0 });
  }

  for (const m of matches) {
    if (!contaParaPremio(m)) continue;
    // O que o adversário fez é o que este participante sofreu.
    const lados = [
      { id: m.home_id, fez: m.home_goals!, sofreu: m.away_goals! },
      { id: m.away_id, fez: m.away_goals!, sofreu: m.home_goals! },
    ];
    for (const { id, fez, sofreu } of lados) {
      if (!id) continue;
      const r = rows.get(id);
      if (!r) continue;
      r.goals += fez;
      r.conceded += sofreu;
      r.games += 1;
      if (sofreu === 0) r.cleanSheets += 1;
    }
  }

  return rows;
}

/**
 * Ranking de artilharia por PARTICIPANTE (o placar do lado dele).
 * Ordena por: mais gols; **empate no saldo de gols (marcados − sofridos)**;
 * depois menos jogos; depois nome.
 * O saldo aqui é o do mesmo recorte dos prêmios (sem W.O./desempate), então
 * pode divergir da coluna SG da classificação — que soma tudo, porque lá o W.O.
 * precisa valer para decidir pontos.
 */
export function computeScorers(players: Player[], matches: Match[]): ScorerRow[] {
  const t = tally(players, matches);

  return players
    .map((p): ScorerRow => {
      const r = t.get(p.id)!;
      return {
        playerId: p.id,
        name: p.name,
        goals: r.goals,
        games: r.games,
        conceded: r.conceded,
        goalDiff: r.goals - r.conceded,
      };
    })
    .sort((a, b) => {
      if (b.goals !== a.goals) return b.goals - a.goals;
      if (b.goalDiff !== a.goalDiff) return b.goalDiff - a.goalDiff; // desempate: saldo
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
 * Ordena por: menos gols sofridos; **empate no saldo de gols**; depois mais
 * jogos; depois nome.
 */
export function computeDefense(players: Player[], matches: Match[]): DefenseRow[] {
  const t = tally(players, matches);

  return players
    .map((p): DefenseRow => {
      const r = t.get(p.id)!;
      return {
        playerId: p.id,
        name: p.name,
        conceded: r.conceded,
        games: r.games,
        cleanSheets: r.cleanSheets,
        goalsFor: r.goals,
        goalDiff: r.goals - r.conceded,
      };
    })
    .filter((r) => r.games > 0)
    .sort((a, b) => {
      if (a.conceded !== b.conceded) return a.conceded - b.conceded;
      if (b.goalDiff !== a.goalDiff) return b.goalDiff - a.goalDiff; // desempate: saldo
      if (b.games !== a.games) return b.games - a.games;
      return a.name.localeCompare(b.name, "pt-BR");
    });
}
