"use client";

import Link from "next/link";
import { useTournament } from "@/lib/useTournament";
import { PageHeader, EmptyState, Loading, Avatar } from "@/components/ui";
import { StandingsTable } from "@/components/StandingsTable";
import { Bracket } from "@/components/Bracket";
import { editionLabel, eventInfo, summarizeEdition } from "@/lib/editions";

const KO_STAGES = ["quartas", "semi", "final", "terceiro"];

/** Uma edição arquivada: classificação final, chave e artilharia — só leitura. */
export default function EdicaoArquivadaPage({ params }: { params: { edicao: string } }) {
  const id = Number(params.edicao);
  const valid = Number.isInteger(id) && id > 0;
  const { players, matches, editions, edition, loading } = useTournament({
    edition: valid ? id : undefined,
  });

  const info = editions.find((e) => e.id === id) ?? null;
  const ev = eventInfo(info);
  const { championId, runnerUpId, thirdId, topScorer, bestDefense, lastPlaceId, scorers } =
    summarizeEdition(players, matches);
  const nameOf = (pid: string | null) => players.find((p) => p.id === pid) ?? null;
  const hasBracket = matches.some((m) => KO_STAGES.includes(m.stage));

  const podium = [
    { label: "Campeão", medal: "🏆", player: nameOf(championId) },
    { label: "Vice", medal: "🥈", player: nameOf(runnerUpId) },
    { label: "3º lugar", medal: "🥉", player: nameOf(thirdId) },
  ].filter((x) => x.player);

  const premios = [
    topScorer && {
      label: "Artilheiro",
      medal: "⚽",
      texto: `${topScorer.name} — ${topScorer.goals} gols`,
    },
    bestDefense && {
      label: "Melhor defesa",
      medal: "🧤",
      texto: `${bestDefense.name} — ${bestDefense.conceded} sofridos`,
    },
    lastPlaceId &&
      nameOf(lastPlaceId) && {
        label: "Lanterna",
        medal: "🔻",
        texto: nameOf(lastPlaceId)!.name,
      },
  ].filter(Boolean) as { label: string; medal: string; texto: string }[];

  if (!valid) {
    return (
      <div className="animate-reveal">
        <PageHeader title="Histórico" />
        <EmptyState>
          <p>Edição inválida.</p>
          <Link className="mt-2 inline-block text-cyan hover:underline" href="/historico">
            ← Voltar ao histórico
          </Link>
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="animate-reveal">
      <PageHeader
        title={info?.name ?? "Edição"}
        subtitle={`${editionLabel(id)} · 📅 ${ev.date} · 📍 ${ev.local}`}
        right={<span className="chip">arquivada</span>}
      />

      <Link className="mb-4 inline-block text-sm text-cyan hover:underline" href="/historico">
        ← Todas as edições
      </Link>

      {loading ? (
        <Loading />
      ) : players.length === 0 || edition !== id ? (
        <EmptyState>
          <p>Não há dados guardados para esta edição.</p>
        </EmptyState>
      ) : (
        <div className="space-y-6">
          {podium.length > 0 && (
            <section className="grid gap-2 sm:grid-cols-3">
              {podium.map(({ label, medal, player }) => (
                <div key={label} className="panel flex items-center gap-3 p-3.5">
                  <span className="text-2xl">{medal}</span>
                  <Avatar name={player!.name} photo={player!.photo} size={40} />
                  <div className="min-w-0">
                    <p className="text-xs uppercase tracking-widest text-ink-muted">{label}</p>
                    <p className="truncate font-display text-lg tracking-wide text-ink">
                      {player!.name}
                    </p>
                  </div>
                </div>
              ))}
            </section>
          )}

          {premios.length > 0 && (
            <section className="grid gap-2 sm:grid-cols-3">
              {premios.map(({ label, medal, texto }) => (
                <div key={label} className="panel flex items-center gap-3 p-3.5">
                  <span className="text-2xl">{medal}</span>
                  <div className="min-w-0">
                    <p className="text-xs uppercase tracking-widest text-ink-muted">{label}</p>
                    <p className="truncate font-display text-lg tracking-wide text-ink">{texto}</p>
                  </div>
                </div>
              ))}
            </section>
          )}

          <section>
            <h2 className="mb-2 font-display text-xl tracking-wide">Classificação final</h2>
            <StandingsTable players={players} matches={matches} />
          </section>

          {hasBracket && (
            <section>
              <h2 className="mb-2 font-display text-xl tracking-wide">Mata-mata</h2>
              <Bracket players={players} matches={matches} />
            </section>
          )}

          {scorers.length > 0 && (
            <section>
              <h2 className="mb-2 font-display text-xl tracking-wide">Artilharia</h2>
              <div className="panel overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-line text-ink-muted">
                      <th className="px-3 py-2 text-center">#</th>
                      <th className="px-3 py-2 text-left">Participante</th>
                      <th className="px-3 py-2 text-center">Jogos</th>
                      <th className="px-3 py-2 text-center">Gols</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scorers.map((r, i) => (
                      <tr key={r.playerId} className="border-b border-line/60">
                        <td className="px-3 py-3 text-center text-ink-muted">{i + 1}</td>
                        <td className="px-3 py-3 text-left">
                          <span className="flex items-center gap-2.5">
                            <Avatar
                              name={r.name}
                              photo={players.find((p) => p.id === r.playerId)?.photo}
                              size={28}
                            />
                            <span className="truncate font-display text-xl tracking-wide text-ink">{r.name}</span>
                          </span>
                        </td>
                        <td className="px-3 py-3 text-center tabular text-ink-muted">{r.games}</td>
                        <td className="px-3 py-3 text-center font-display text-xl text-ink">
                          {r.goals}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
