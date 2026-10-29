import type { Edition, Match, Player } from "./types";
import { computeStandings, TOP_N } from "./standings";
import { computeDefense, computeScorers } from "./scorers";
import { championAndRunnerUp, thirdPlace } from "./bracket";
import { editionLabel, editionOf, forEdition } from "./editions";

// ============================================================================
//  PERFIS — a ficha de cada pessoa somando TODAS as Copas Costela.
//
//  Um detalhe que manda em tudo aqui: o `players.id` é DE CADA EDIÇÃO. Quando
//  uma edição nova é aberta levando a turma, cada participante ganha uma linha
//  nova, com id novo (de propósito: assim remover alguém hoje nunca encosta no
//  histórico). Então o que liga o "Ronaldo da 1ª" ao "Ronaldo da 2ª" é o NOME
//  normalizado — mesma chave que o sorteio já usava. Trocar o nome de alguém
//  no painel separa o perfil em dois; renomear de volta junta de novo.
// ============================================================================

/** Chave da pessoa: nome sem acento, sem caixa e sem espaço sobrando. */
export function personKey(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ");
}

/** Chave virada em endereço: "luis pato" → "luis-pato". */
export function personSlug(name: string): string {
  return personKey(name).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "participante";
}

/** A campanha de uma pessoa em UMA edição. */
export interface ProfileSeason {
  edition: number;
  label: string;
  /** id daquela edição (o perfil não tem id próprio) */
  playerId: string;
  name: string;
  /** colocação na liga — null enquanto não houver jogo com placar */
  position: number | null;
  fieldSize: number;
  points: number;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  /** gols no recorte dos prêmios (sem W.O./desempate) */
  goals: number;
  conceded: number;
  cleanSheets: number;
  qualified: boolean;
  champion: boolean;
  runnerUp: boolean;
  third: boolean;
  lastPlace: boolean;
  topScorer: boolean;
  bestDefense: boolean;
  withdrawn: boolean;
  /** edição arquivada: os números não mudam mais */
  closed: boolean;
}

export interface ProfileCareer {
  editions: number;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  points: number;
  /** % de aproveitamento de pontos (3 por jogo) */
  winRate: number;
  goals: number;
  conceded: number;
  cleanSheets: number;
  titles: number;
  runnerUps: number;
  thirds: number;
  finals: number;
  podiums: number;
  topScorerAwards: number;
  bestDefenseAwards: number;
  /** vezes que terminou a liga dentro do Top 6 */
  top6: number;
  lastPlaces: number;
  bestPosition: number | null;
  /** nota de carreira — ver PESOS */
  score: number;
}

// ---------------------------------------------------------------------------
// Nota de carreira: título, prêmio e pódio pesam muito mais que campanha.
// O aproveitamento entra dividido por 10 (0 a 10 pontos) de propósito: serve
// para desempatar duas fichas parecidas, nunca para passar na frente de quem
// tem uma medalha a mais.
// É um ranking GERAL: o número de edições não ordena nada por fora da nota —
// entra só como mais um peso, hoje zerado.
// ---------------------------------------------------------------------------
export const PESOS = {
  titulo: 100,
  vice: 45,
  terceiro: 25,
  artilheiro: 20,
  melhorDefesa: 20,
  top6: 4,
  lanterna: -8,
  /** Edições disputadas entram na conta, mas valendo nada: o ranking é por
   *  conquista, não por quilometragem. Fica aqui como botão — subir este
   *  número passa a premiar quem apareceu em mais copas. */
  edicao: 0,
} as const;

export interface Profile {
  key: string;
  slug: string;
  /** grafia mais recente do nome */
  name: string;
  /** foto mais recente que a pessoa teve em qualquer edição */
  photo: string | null;
  seasons: ProfileSeason[];
  career: ProfileCareer;
}

/** Premiação de uma edição, resolvida uma vez só. */
function awardsOf(players: Player[], matches: Match[]) {
  const standings = computeStandings(players, matches);
  const { championId, runnerUpId } = championAndRunnerUp(matches);
  const artilheiro = computeScorers(players, matches).find((s) => s.goals > 0) ?? null;
  const defesa = computeDefense(players, matches)[0] ?? null;
  const jogou = standings.some((r) => r.played > 0);
  return {
    standings,
    championId,
    runnerUpId,
    thirdId: thirdPlace(matches),
    lastPlaceId: jogou ? standings[standings.length - 1]?.playerId ?? null : null,
    topScorerId: artilheiro?.playerId ?? null,
    bestDefenseId: defesa?.playerId ?? null,
    jogou,
  };
}

/**
 * Monta a ficha de todo mundo que já passou por qualquer edição.
 * Recebe os dados BRUTOS (todas as edições juntas) — é a única parte do app
 * que olha o torneio inteiro de uma vez.
 * Ordena por: mais títulos; depois mais edições; depois nome.
 */
export function buildProfiles(
  allPlayers: Player[],
  allMatches: Match[],
  editions: Edition[],
): Profile[] {
  // Quais edições existem de fato: as cadastradas + as que aparecem nos dados
  // (banco antigo pode ter jogador sem linha em `editions`).
  const ids = new Set<number>(editions.map((e) => e.id));
  for (const p of allPlayers) ids.add(editionOf(p));
  const ordenadas = [...ids].sort((a, b) => a - b);

  const porChave = new Map<string, Profile>();

  for (const ed of ordenadas) {
    const players = forEdition(allPlayers, ed);
    if (players.length === 0) continue;
    const matches = forEdition(allMatches, ed);
    const info = editions.find((e) => e.id === ed) ?? null;
    const a = awardsOf(players, matches);
    const scorers = new Map(computeScorers(players, matches).map((s) => [s.playerId, s]));
    const defense = new Map(computeDefense(players, matches).map((d) => [d.playerId, d]));

    a.standings.forEach((row, i) => {
      const p = players.find((x) => x.id === row.playerId);
      if (!p) return;
      const key = personKey(p.name);
      const s = scorers.get(p.id);
      const d = defense.get(p.id);

      const season: ProfileSeason = {
        edition: ed,
        label: editionLabel(ed),
        playerId: p.id,
        name: p.name,
        position: a.jogou ? i + 1 : null,
        fieldSize: players.length,
        points: row.points,
        played: row.played,
        wins: row.wins,
        draws: row.draws,
        losses: row.losses,
        goalsFor: row.goalsFor,
        goalsAgainst: row.goalsAgainst,
        goalDiff: row.goalDiff,
        goals: s?.goals ?? 0,
        conceded: d?.conceded ?? 0,
        cleanSheets: d?.cleanSheets ?? 0,
        qualified: a.jogou && i < TOP_N,
        champion: a.championId === p.id,
        runnerUp: a.runnerUpId === p.id,
        third: a.thirdId === p.id,
        lastPlace: a.lastPlaceId === p.id,
        topScorer: a.topScorerId === p.id,
        bestDefense: a.bestDefenseId === p.id,
        withdrawn: !!p.withdrawn,
        closed: !!info?.closed_at,
      };

      const atual = porChave.get(key);
      if (atual) {
        atual.seasons.push(season);
        atual.name = p.name; // a grafia mais recente vence
        if (p.photo) atual.photo = p.photo;
      } else {
        porChave.set(key, {
          key,
          slug: personSlug(p.name),
          name: p.name,
          photo: p.photo ?? null,
          seasons: [season],
          career: vazio(),
        });
      }
    });
  }

  const perfis = [...porChave.values()];
  for (const perfil of perfis) {
    perfil.slug = personSlug(perfil.name);
    perfil.career = somar(perfil.seasons);
  }

  return perfis.sort((x, y) => {
    if (y.career.titles !== x.career.titles) return y.career.titles - x.career.titles;
    if (y.career.editions !== x.career.editions) return y.career.editions - x.career.editions;
    return x.name.localeCompare(y.name, "pt-BR");
  });
}

function vazio(): ProfileCareer {
  return {
    editions: 0,
    played: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDiff: 0,
    points: 0,
    winRate: 0,
    goals: 0,
    conceded: 0,
    cleanSheets: 0,
    titles: 0,
    runnerUps: 0,
    thirds: 0,
    finals: 0,
    podiums: 0,
    topScorerAwards: 0,
    bestDefenseAwards: 0,
    top6: 0,
    lastPlaces: 0,
    bestPosition: null,
    score: 0,
  };
}

function somar(seasons: ProfileSeason[]): ProfileCareer {
  const c = vazio();
  c.editions = seasons.length;
  for (const s of seasons) {
    c.played += s.played;
    c.wins += s.wins;
    c.draws += s.draws;
    c.losses += s.losses;
    c.goalsFor += s.goalsFor;
    c.goalsAgainst += s.goalsAgainst;
    c.points += s.points;
    c.goals += s.goals;
    c.conceded += s.conceded;
    c.cleanSheets += s.cleanSheets;
    if (s.champion) c.titles += 1;
    if (s.runnerUp) c.runnerUps += 1;
    if (s.third) c.thirds += 1;
    if (s.champion || s.runnerUp) c.finals += 1;
    if (s.champion || s.runnerUp || s.third) c.podiums += 1;
    if (s.topScorer) c.topScorerAwards += 1;
    if (s.bestDefense) c.bestDefenseAwards += 1;
    if (s.qualified) c.top6 += 1;
    if (s.lastPlace) c.lastPlaces += 1;
    if (s.position != null && (c.bestPosition == null || s.position < c.bestPosition)) {
      c.bestPosition = s.position;
    }
  }
  c.goalDiff = c.goalsFor - c.goalsAgainst;
  // Aproveitamento: pontos ganhos sobre os que estavam em jogo (3 por partida).
  c.winRate = c.played > 0 ? Math.round((c.points / (c.played * 3)) * 100) : 0;
  c.score =
    PESOS.titulo * c.titles +
    PESOS.vice * c.runnerUps +
    PESOS.terceiro * c.thirds +
    PESOS.artilheiro * c.topScorerAwards +
    PESOS.melhorDefesa * c.bestDefenseAwards +
    PESOS.top6 * c.top6 +
    PESOS.lanterna * c.lastPlaces +
    PESOS.edicao * c.editions +
    c.winRate / 10;
  return c;
}

/**
 * Ranking GERAL do mural: uma lista só, da maior nota para a menor.
 * O número de edições não ordena por fora — ele já está dentro da nota, com o
 * peso `PESOS.edicao` (hoje 0). Empate na nota cai em gols e depois no nome.
 */
export function rankProfiles(profiles: Profile[]): Profile[] {
  return [...profiles].sort((a, b) => {
    if (b.career.score !== a.career.score) return b.career.score - a.career.score;
    if (b.career.goals !== a.career.goals) return b.career.goals - a.career.goals;
    return a.name.localeCompare(b.name, "pt-BR");
  });
}

/** Acha um perfil pelo endereço (slug) ou pelo nome. */
export function findProfile(profiles: Profile[], slug: string): Profile | null {
  const alvo = personSlug(decodeURIComponent(slug));
  return profiles.find((p) => p.slug === alvo) ?? null;
}

// ---------------------------------------------------------------------------
// Banco de participantes: quem já jogou e NÃO está na edição em cartaz.
// É daqui que o painel puxa a turma de volta, com foto e tudo.
// ---------------------------------------------------------------------------

export interface RosterEntry {
  key: string;
  name: string;
  photo: string | null;
  /** edições que a pessoa já disputou */
  editions: number[];
  /** já está na edição em cartaz? */
  inCurrent: boolean;
}

export function buildRoster(
  allPlayers: Player[],
  allMatches: Match[],
  editions: Edition[],
  current: number,
): RosterEntry[] {
  const dentro = new Set(forEdition(allPlayers, current).map((p) => personKey(p.name)));
  return buildProfiles(allPlayers, allMatches, editions).map((p) => ({
    key: p.key,
    name: p.name,
    photo: p.photo,
    editions: p.seasons.map((s) => s.edition),
    inCurrent: dentro.has(p.key),
  }));
}
