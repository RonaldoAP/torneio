"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useAllEditions } from "@/lib/useTournament";
import { buildProfiles, findProfile, type ProfileSeason } from "@/lib/profiles";
import { PageHeader, EmptyState, Loading, Avatar } from "@/components/ui";

/** Medalhas que a pessoa levou numa edição, do mais alto para o mais baixo. */
function medalhas(s: ProfileSeason) {
  const m: { icone: string; texto: string; cor: string }[] = [];
  if (s.champion) m.push({ icone: "🏆", texto: "Campeão", cor: "border-gremio/50 text-gremio" });
  if (s.runnerUp) m.push({ icone: "🥈", texto: "Vice", cor: "border-white/30 text-ink" });
  if (s.third) m.push({ icone: "🥉", texto: "3º lugar", cor: "border-amber-500/40 text-amber-400" });
  if (s.topScorer) m.push({ icone: "⚽", texto: "Artilheiro", cor: "border-gremio/40 text-gremio" });
  if (s.bestDefense)
    m.push({ icone: "🧤", texto: "Melhor defesa", cor: "border-cyan/50 text-cyan" });
  if (s.lastPlace) m.push({ icone: "🥄", texto: "Lanterna", cor: "border-danger/40 text-danger" });
  if (s.withdrawn) m.push({ icone: "✕", texto: "Desistiu", cor: "border-danger/50 text-danger" });
  return m;
}

const sg = (n: number) => (n > 0 ? `+${n}` : String(n));

function Numero({ valor, rotulo, destaque }: { valor: string; rotulo: string; destaque?: boolean }) {
  return (
    <div className="panel px-3 py-3 text-center">
      <div
        className={`font-display text-3xl font-bold leading-none ${
          destaque ? "text-azul" : "text-branco"
        }`}
      >
        {valor}
      </div>
      <div className="mt-1 font-sans text-[11px] uppercase tracking-wider text-ink-muted">
        {rotulo}
      </div>
    </div>
  );
}

export default function PerfilPage({ params }: { params: { slug: string } }) {
  const { players, matches, editions, loading } = useAllEditions();
  const perfil = useMemo(() => {
    const todos = buildProfiles(players, matches, editions);
    return findProfile(todos, params.slug);
  }, [players, matches, editions, params.slug]);

  if (loading) return <Loading />;

  if (!perfil) {
    return (
      <div className="animate-reveal">
        <PageHeader title="Perfil" subtitle="Participante não encontrado" />
        <EmptyState>
          <p>Não achamos ninguém com esse nome.</p>
          <p className="mt-2">
            <Link href="/historico" className="text-azul hover:underline">
              Ver todos os perfis
            </Link>
          </p>
        </EmptyState>
      </div>
    );
  }

  const c = perfil.career;
  // Edições mais recentes primeiro — é o que interessa olhar.
  const campanhas = [...perfil.seasons].sort((a, b) => b.edition - a.edition);

  return (
    <div className="animate-reveal">
      <div className="mb-4">
        <Link href="/historico" className="font-sans text-xs text-ink-muted hover:text-ink">
          ← Todos os perfis
        </Link>
      </div>

      {/* Cabeçalho: foto grande, nome e as medalhas da carreira */}
      <div className="panel mb-4 flex flex-wrap items-center gap-4 p-4">
        <Avatar name={perfil.name} photo={perfil.photo} size={96} />
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-5xl font-bold uppercase leading-none tracking-wide text-branco">
            {perfil.name}
          </h1>
          <p className="mt-1.5 font-sans text-sm text-ink-muted">
            {c.editions} {c.editions === 1 ? "edição disputada" : "edições disputadas"}
            {c.bestPosition != null && ` · melhor colocação: ${c.bestPosition}º`}
          </p>
          {(c.titles > 0 || c.topScorerAwards > 0 || c.bestDefenseAwards > 0 || c.podiums > 0) && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {c.titles > 0 && (
                <span className="chip border-gremio/50 font-sans text-gremio">
                  🏆 {c.titles}× campeão
                </span>
              )}
              {c.podiums > 0 && (
                <span className="chip border-white/25 font-sans text-ink">
                  {c.podiums}× no pódio
                </span>
              )}
              {c.topScorerAwards > 0 && (
                <span className="chip border-gremio/40 font-sans text-gremio">
                  ⚽ {c.topScorerAwards}× artilheiro
                </span>
              )}
              {c.bestDefenseAwards > 0 && (
                <span className="chip border-cyan/50 font-sans text-cyan">
                  🧤 {c.bestDefenseAwards}× melhor defesa
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Números da carreira */}
      <h2 className="mb-1 font-display text-xl tracking-wide">Carreira na liga</h2>
      <p className="mb-2 font-sans text-xs text-ink-muted">
        Somando a fase de liga de todas as edições — é a mesma conta da classificação, então o
        mata-mata não entra aqui.
      </p>
      <div className="mb-2 grid grid-cols-3 gap-2 sm:grid-cols-6">
        <Numero valor={String(c.played)} rotulo="Jogos" />
        <Numero valor={String(c.wins)} rotulo="Vitórias" />
        <Numero valor={String(c.draws)} rotulo="Empates" />
        <Numero valor={String(c.losses)} rotulo="Derrotas" />
        <Numero valor={String(c.points)} rotulo="Pontos" />
        <Numero valor={`${c.winRate}%`} rotulo="Aproveit." destaque />
      </div>
      <div className="mb-6 grid grid-cols-3 gap-2 sm:grid-cols-3">
        <Numero valor={String(c.goalsFor)} rotulo="Gols (GM)" />
        <Numero valor={String(c.goalsAgainst)} rotulo="Sofridos (GC)" />
        <Numero valor={sg(c.goalDiff)} rotulo="Saldo" />
      </div>

      <h2 className="mb-1 font-display text-xl tracking-wide">Números das medalhas</h2>
      <p className="mb-2 font-sans text-xs text-ink-muted">
        A conta que vale para artilheiro e melhor defesa: <strong className="text-ink">liga +
        mata-mata</strong>, sem W.O. e sem partida de desempate. Por isso estes gols são mais que os
        da liga acima.
      </p>
      <div className="mb-6 grid grid-cols-3 gap-2 sm:grid-cols-3">
        <Numero valor={String(c.goals)} rotulo="Gols marcados" />
        <Numero valor={String(c.conceded)} rotulo="Gols sofridos" />
        <Numero valor={String(c.cleanSheets)} rotulo="Sem sofrer" />
      </div>

      {/* Uma linha por edição */}
      <h2 className="mb-2 font-display text-xl tracking-wide">Campanha por edição</h2>
      <div className="space-y-3">
        {campanhas.map((s) => (
          <div key={s.edition} className="panel p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-display text-2xl tracking-wide text-branco">{s.label}</span>
              {s.position != null ? (
                <span className="chip border-azul/50 font-sans text-azul">
                  {s.position}º de {s.fieldSize}
                </span>
              ) : (
                <span className="chip border-white/15 font-sans text-ink-muted">
                  ainda sem jogos
                </span>
              )}
              {!s.closed && (
                <span className="chip border-emerald-400/40 font-sans text-emerald-400">
                  em andamento
                </span>
              )}
              {medalhas(s).map((m) => (
                <span key={m.texto} className={`chip font-sans ${m.cor}`}>
                  {m.icone} {m.texto}
                </span>
              ))}
            </div>

            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-ink-muted">
                    {[
                      ["Pts", "Pontos na liga"],
                      ["PJ", "Jogos na liga"],
                      ["V", "Vitórias"],
                      ["E", "Empates"],
                      ["D", "Derrotas"],
                      ["GM", "Gols marcados na liga"],
                      ["GC", "Gols sofridos na liga"],
                      ["SG", "Saldo na liga"],
                      ["Gols", "Gols do prêmio (liga + mata-mata)"],
                      ["Sofr.", "Sofridos do prêmio (liga + mata-mata)"],
                      ["SS", "Jogos sem sofrer gol"],
                    ].map(([h, t]) => (
                      <th
                        key={h}
                        title={t}
                        className="px-1.5 py-1.5 text-center font-display font-semibold uppercase tracking-[0.1em]"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="font-display tabular">
                    <td className="px-1.5 py-2 text-center text-xl font-black text-branco">
                      {s.points}
                    </td>
                    <td className="px-1.5 py-2 text-center text-ink-muted">{s.played}</td>
                    <td className="px-1.5 py-2 text-center text-ink">{s.wins}</td>
                    <td className="px-1.5 py-2 text-center text-ink">{s.draws}</td>
                    <td className="px-1.5 py-2 text-center text-ink">{s.losses}</td>
                    <td className="px-1.5 py-2 text-center text-ink">{s.goalsFor}</td>
                    <td className="px-1.5 py-2 text-center text-ink-muted">{s.goalsAgainst}</td>
                    <td
                      className={`px-1.5 py-2 text-center ${
                        s.goalDiff > 0
                          ? "text-emerald-400"
                          : s.goalDiff < 0
                            ? "text-danger"
                            : "text-ink-muted"
                      }`}
                    >
                      {sg(s.goalDiff)}
                    </td>
                    <td className="px-1.5 py-2 text-center text-ink">{s.goals}</td>
                    <td className="px-1.5 py-2 text-center text-ink-muted">{s.conceded}</td>
                    <td className="px-1.5 py-2 text-center text-ink-muted">{s.cleanSheets}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
