import type { Match, Player, StandingRow } from "./types";

export const TOP_N = 6; // classificados para o mata-mata (Alternativa B)

interface MutableRow extends StandingRow {
  primaryKey: string;
}

/** Vencedor de uma partida pelo placar; empate no tempo normal decide por pênaltis. */
export function matchWinner(m: Match): string | null {
  if (m.home_goals == null || m.away_goals == null) return null;
  if (m.home_goals > m.away_goals) return m.home_id;
  if (m.away_goals > m.home_goals) return m.away_id;
  return m.pen_winner_id ?? null;
}

export function matchLoser(m: Match): string | null {
  const w = matchWinner(m);
  if (!w) return null;
  return w === m.home_id ? m.away_id : m.home_id;
}

export type Result = "V" | "E" | "D";

/** Últimos N resultados do jogador na liga, em ordem cronológica (rodada). */
export function recentResults(playerId: string, matches: Match[], n = 5): Result[] {
  const liga = matches
    .filter(
      (m) =>
        m.stage === "liga" &&
        m.home_goals != null &&
        m.away_goals != null &&
        (m.home_id === playerId || m.away_id === playerId),
    )
    .sort((a, b) => (a.round ?? 0) - (b.round ?? 0));
  const res: Result[] = liga.map((m) => {
    const gf = (m.home_id === playerId ? m.home_goals : m.away_goals) as number;
    const ga = (m.home_id === playerId ? m.away_goals : m.home_goals) as number;
    return gf > ga ? "V" : gf < ga ? "D" : "E";
  });
  return res.slice(-n);
}

/** Head-to-head / desempate entre dois jogadores.
 *  Retorna <0 se `a` fica na frente, >0 se `b` fica na frente, 0 se não resolvido. */
function pairwise(aId: string, bId: string, matches: Match[]): number {
  // 5) Confronto direto (partidas da liga entre os dois)
  const liga = matches.filter(
    (m) =>
      m.stage === "liga" &&
      m.home_goals != null &&
      m.away_goals != null &&
      ((m.home_id === aId && m.away_id === bId) ||
        (m.home_id === bId && m.away_id === aId)),
  );
  for (const m of liga) {
    const w = matchWinner(m);
    if (w === aId) return -1;
    if (w === bId) return 1;
  }

  // 6) Nova partida de desempate entre os dois
  const desempates = matches.filter(
    (m) =>
      m.stage === "desempate" &&
      ((m.home_id === aId && m.away_id === bId) ||
        (m.home_id === bId && m.away_id === aId)),
  );
  for (const m of desempates) {
    const w = matchWinner(m);
    if (w === aId) return -1;
    if (w === bId) return 1;
  }

  return 0;
}

/**
 * Calcula a classificação ao vivo a partir das partidas da liga.
 * Critérios de desempate (nesta ordem):
 *   1) pontos  2) vitórias  3) saldo  4) gols marcados
 *   5) confronto direto  6) partida de desempate
 */
export function computeStandings(players: Player[], matches: Match[]): StandingRow[] {
  const rows = new Map<string, MutableRow>();
  for (const p of players) {
    rows.set(p.id, {
      playerId: p.id,
      name: p.name,
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDiff: 0,
      points: 0,
      primaryKey: "",
    });
  }

  for (const m of matches) {
    if (m.stage !== "liga") continue;
    if (m.home_goals == null || m.away_goals == null) continue;
    if (!m.home_id || !m.away_id) continue;
    const home = rows.get(m.home_id);
    const away = rows.get(m.away_id);
    if (!home || !away) continue;

    home.played++;
    away.played++;
    home.goalsFor += m.home_goals;
    home.goalsAgainst += m.away_goals;
    away.goalsFor += m.away_goals;
    away.goalsAgainst += m.home_goals;

    if (m.home_goals > m.away_goals) {
      home.wins++;
      home.points += 3;
      away.losses++;
    } else if (m.away_goals > m.home_goals) {
      away.wins++;
      away.points += 3;
      home.losses++;
    } else {
      home.draws++;
      away.draws++;
      home.points += 1;
      away.points += 1;
    }
  }

  const list = [...rows.values()];
  for (const r of list) {
    r.goalDiff = r.goalsFor - r.goalsAgainst;
    r.primaryKey = [r.points, r.wins, r.goalDiff, r.goalsFor].join(":");
  }

  // Ordena pelos critérios 1-4 (desc) e nome como tie-break estável inicial.
  list.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (b.goalDiff !== a.goalDiff) return b.goalDiff - a.goalDiff;
    if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
    return a.name.localeCompare(b.name, "pt-BR");
  });

  // Agrupa jogadores com os mesmos critérios 1-4 e resolve por confronto
  // direto / desempate. O que sobrar empatado fica estável por nome.
  let i = 0;
  while (i < list.length) {
    let j = i + 1;
    while (j < list.length && list[j].primaryKey === list[i].primaryKey) j++;
    const group = list.slice(i, j);

    if (group.length > 1) {
      // Ordenação por inserção usando o comparador pairwise.
      group.sort((a, b) => {
        const r = pairwise(a.playerId, b.playerId, matches);
        if (r !== 0) return r;
        return a.name.localeCompare(b.name, "pt-BR");
      });

      // Detecta pares não resolvidos dentro do grupo.
      let hasUnresolved = false;
      for (let x = 0; x < group.length; x++) {
        for (let y = x + 1; y < group.length; y++) {
          if (pairwise(group[x].playerId, group[y].playerId, matches) === 0) {
            hasUnresolved = true;
          }
        }
      }

      if (hasUnresolved) {
        // Só sinaliza se o empate atravessa a linha do Top 6 (afeta classificação).
        const startPos = i; // 0-based
        const endPos = j - 1;
        const affectsCut = startPos <= TOP_N - 1 && endPos >= TOP_N - 1;
        for (const g of group) g.unresolvedTie = affectsCut;
      }

      for (let k = 0; k < group.length; k++) list[i + k] = group[k];
    }

    i = j;
  }

  return list.map(({ primaryKey, ...row }) => row);
}
