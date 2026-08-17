"use client";

import { useEffect, useMemo, useState } from "react";
import { useTournament } from "@/lib/useTournament";
import { adminActions, setAdminSlug } from "@/lib/adminActions";
import { computeStandings, TOP_N } from "@/lib/standings";
import { computeDefense, computeScorers } from "@/lib/scorers";
import { editionLabel, eventInfo, removalBlockedMessage, removalImpact } from "@/lib/editions";
import type { Match, Player, TournamentState } from "@/lib/types";
import { ScoreEditor } from "@/components/admin/ScoreEditor";
import { Avatar } from "@/components/ui";
import { fileToAvatarDataUrl } from "@/lib/image";

/**
 * Painel de administração. O acesso é protegido pela URL secreta (slug) —
 * as rotas que renderizam este componente já validaram o slug no servidor.
 * Sem senha: quem tem o link secreto administra.
 */
export function AdminApp({ slug }: { slug?: string }) {
  const state = useTournament();
  const { mode, players, matches, config, edition, editionInfo } = state;
  const isLocal = mode === "local";
  const ev = eventInfo(editionInfo);

  const [name, setName] = useState("");
  const [tName, setTName] = useState(config.tournament_name);
  const [evDate, setEvDate] = useState(ev.date);
  const [evTime, setEvTime] = useState(ev.time);
  const [evLocal, setEvLocal] = useState(ev.local);
  const [evNote, setEvNote] = useState(ev.note);
  const [copyPlayers, setCopyPlayers] = useState(true);
  const [deA, setDeA] = useState("");
  const [deB, setDeB] = useState("");
  const [quitId, setQuitId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [undo, setUndo] = useState<{ label: string; state: TournamentState } | null>(null);
  const [copied, setCopied] = useState(false);

  // Envia o slug secreto em cada gravação (modo Supabase autoriza por ele).
  useEffect(() => {
    setAdminSlug(slug ?? "");
  }, [slug]);

  useEffect(() => setTName(config.tournament_name), [config.tournament_name]);

  // Ao trocar de edição, os campos do evento acompanham o que está gravado.
  useEffect(() => {
    const e = eventInfo(editionInfo);
    setEvDate(e.date);
    setEvTime(e.time);
    setEvLocal(e.local);
    setEvNote(e.note);
  }, [editionInfo]);

  async function act(fn: () => Promise<any>, okMsg?: string) {
    setError(null);
    setInfo(null);
    try {
      await fn();
      if (okMsg) setInfo(okMsg);
    } catch (e: any) {
      setError(e?.message ?? "Erro.");
    }
  }

  /** Igual ao act(), mas antes tira um "retrato" do estado atual para permitir
   *  desfazer a ação (restaura via importar estado). Usado nas ações destrutivas. */
  async function actUndo(label: string, fn: () => Promise<any>, okMsg?: string) {
    setError(null);
    setInfo(null);
    const snapshot: TournamentState = JSON.parse(
      JSON.stringify({ config, players, matches }),
    );
    try {
      await fn();
      setUndo({ label, state: snapshot });
      if (okMsg) setInfo(okMsg);
    } catch (e: any) {
      setError(e?.message ?? "Erro.");
    }
  }

  async function doUndo() {
    if (!undo) return;
    setError(null);
    setInfo(null);
    try {
      await adminActions.importState(undo.state);
      setInfo(`Desfeito: ${undo.label}.`);
      setUndo(null);
    } catch (e: any) {
      setError(e?.message ?? "Falha ao desfazer.");
    }
  }

  /**
   * Remover apaga o participante E TODOS os jogos dele — foi assim que a 1ª
   * edição perdeu 10 partidas já jogadas. Com jogos na mesa, mostra o estrago
   * antes, lembra do W.O. e só então apaga (com Desfazer disponível).
   */
  async function removeParticipant(p: Player) {
    const impact = removalImpact(matches, p.id);
    if (impact.total === 0) {
      if (!confirm(`Remover ${p.name} da lista?`)) return;
      return act(() => adminActions.removePlayer(p.id), `${p.name} removido.`);
    }
    const aviso = removalBlockedMessage(matches, p.id, p.name);
    const jogos = `${impact.total} ${impact.total === 1 ? "jogo" : "jogos"}`;
    if (!confirm(`${aviso}\n\nApagar ${p.name} e ${jogos} mesmo assim?`)) return;
    return actUndo(
      `remover ${p.name}`,
      () => adminActions.removePlayer(p.id, true),
      `${p.name} e ${jogos} removidos.`,
    );
  }

  const ligaRounds = useMemo(() => {
    const byRound = new Map<number, Match[]>();
    for (const m of matches.filter((x) => x.stage === "liga")) {
      const r = m.round ?? 0;
      if (!byRound.has(r)) byRound.set(r, []);
      byRound.get(r)!.push(m);
    }
    // Rodada em andamento no topo; rodadas já encerradas descem pro fim.
    return [...byRound.entries()]
      .map(([round, games]) => ({
        round,
        games,
        finished:
          games.length > 0 && games.every((g) => g.home_goals != null && g.away_goals != null),
      }))
      .sort((a, b) => {
        if (a.finished !== b.finished) return a.finished ? 1 : -1;
        return a.round - b.round;
      });
  }, [matches]);

  const koMatches = useMemo(() => {
    const order = ["REP_A", "REP_B", "SF_A", "SF_B", "FINAL", "TERCEIRO"];
    return matches
      .filter((m) => ["quartas", "semi", "final", "terceiro"].includes(m.stage))
      .sort((a, b) => order.indexOf(a.slot ?? "") - order.indexOf(b.slot ?? ""));
  }, [matches]);

  const desempates = matches.filter((m) => m.stage === "desempate");
  const standings = computeStandings(players, matches);
  // Empate no corte do Top 6 que precisa de partida de desempate (raro — só se
  // cair empatado na linha de classificação). Só aparece quando realmente ocorre.
  const tiedAtCut = standings.filter((r) => r.unresolvedTie);

  /** Monta a mensagem de classificação para colar no grupo (WhatsApp). */
  function buildGroupMessage(): string {
    const nameOf = new Map(players.map((p) => [p.id, p.name] as const));
    const lines: string[] = [];
    lines.push(`🏆 ${config.tournament_name} — Classificação`);
    lines.push("");
    standings.forEach((r, i) => {
      const pos = i + 1;
      const mark = pos <= TOP_N ? "✅" : "▫️";
      lines.push(`${mark} ${pos}º ${r.name} — ${r.points} pts (${r.played}J ${r.wins}V ${r.draws}E ${r.losses}D)`);
    });
    const scorers = computeScorers(players, matches).filter((s) => s.goals > 0);
    if (scorers.length > 0) {
      lines.push("");
      lines.push("⚽ Artilharia");
      scorers.slice(0, 5).forEach((s) => lines.push(`• ${s.name}: ${s.goals}`));
    }
    const defesa = computeDefense(players, matches);
    if (defesa.length > 0) {
      lines.push("");
      lines.push("🧤 Melhor defesa (gols sofridos)");
      defesa.slice(0, 3).forEach((d) => lines.push(`• ${d.name}: ${d.conceded}`));
    }
    if (standings.length > 0) {
      lines.push("");
      lines.push(`🔻 Lanterna: ${standings[standings.length - 1].name}`);
    }
    lines.push("");
    lines.push(`✅ = classificado (Top ${TOP_N})`);
    return lines.join("\n");
  }

  async function copyGroupMessage() {
    const text = buildGroupMessage();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Fallback: seleção manual via prompt se a área de transferência falhar.
      window.prompt("Copie a mensagem:", text);
    }
  }

  function exportJson() {
    const data: TournamentState = { config, players, matches };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `torneio-ed${edition}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function importJson(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as TournamentState;
        if (!parsed.players || !parsed.matches) throw new Error("Arquivo inválido.");
        act(() => adminActions.importState(parsed), "Estado importado.");
      } catch (e: any) {
        setError(e?.message ?? "Falha ao importar.");
      }
    };
    reader.readAsText(file);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl tracking-wide">Painel do Admin</h1>
        <div className="flex items-center gap-2">
          <span className="chip">{isLocal ? "Modo local" : "Supabase · ao vivo"}</span>
          <span className="chip border-cyan/50 text-cyan">{editionLabel(edition)}</span>
          <span className="chip">Fase: {config.phase}</span>
        </div>
      </div>

      {isLocal && (
        <p className="rounded-xl border border-branco/30 bg-branco/5 p-3 text-sm text-ink-muted">
          <strong className="text-ink">Modo local</strong> — os dados ficam só neste
          navegador/dispositivo e <strong>não espelham para os outros</strong>. Para o placar
          aparecer ao vivo para todos, configure o Supabase (veja o README) — aí este painel passa a
          gravar no servidor compartilhado automaticamente.
        </p>
      )}
      {error && <p className="rounded-xl border border-danger/30 bg-danger/10 p-3 text-sm text-danger">{error}</p>}
      {info && <p className="rounded-xl border border-gremio/30 bg-gremio/10 p-3 text-sm text-gremio">{info}</p>}

      {undo && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-branco/30 bg-branco/5 p-3 text-sm">
          <span className="text-ink-muted">
            Última ação: <strong className="text-ink">{undo.label}</strong>
          </span>
          <div className="flex items-center gap-2">
            <button className="btn-primary py-1.5 text-sm" onClick={doUndo}>
              Desfazer
            </button>
            <button className="btn-ghost py-1.5 text-sm" onClick={() => setUndo(null)}>
              Dispensar
            </button>
          </div>
        </div>
      )}

      {/* Copiar mensagem para o grupo (só no admin) */}
      <div className="flex flex-wrap items-center gap-2">
        <button className="btn-ghost" onClick={copyGroupMessage} disabled={standings.length === 0}>
          📋 Copiar mensagem pro grupo
        </button>
        {copied && <span className="text-sm text-gremio">copiado ✓</span>}
        <span className="text-xs text-ink-muted">Classificação + artilharia, prontinho pra colar no WhatsApp.</span>
      </div>

      {/* Alerta de empate no corte do Top 6 — só quando realmente acontece */}
      {tiedAtCut.length >= 2 && (
        <div className="rounded-xl border border-danger/40 bg-danger/10 p-3 text-sm">
          <p className="font-semibold text-danger">⚠ Empate na zona de classificação (Top {TOP_N})</p>
          <p className="mt-1 text-ink-muted">
            {tiedAtCut.map((r) => r.name).join(", ")} estão empatados no critério e o confronto
            direto não resolveu. Crie a partida de desempate abaixo e marque o resultado — só então dá
            pra montar o mata-mata.
          </p>
          <button
            className="btn-primary mt-2 py-1.5 text-sm"
            onClick={() => {
              setDeA(tiedAtCut[0].playerId);
              setDeB(tiedAtCut[1].playerId);
              document.getElementById("secao-desempate")?.scrollIntoView({ behavior: "smooth", block: "center" });
            }}
          >
            Preparar desempate: {tiedAtCut[0].name} × {tiedAtCut[1].name}
          </button>
        </div>
      )}

      {/* Edição: dados do evento + abrir a próxima */}
      <section className="panel p-4">
        <h2 className="mb-1 font-display text-xl tracking-wide">
          Edição em cartaz <span className="text-sm text-ink-muted">({editionLabel(edition)})</span>
        </h2>
        <p className="mb-3 text-xs text-ink-muted">
          Estes dados aparecem no regulamento e no telão. Editáveis sem precisar de deploy.
        </p>
        <div className="grid gap-2 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs text-ink-muted">Data</label>
            <input className="input w-full" value={evDate} onChange={(e) => setEvDate(e.target.value)} placeholder="18 de julho" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-ink-muted">Hora</label>
            <input className="input w-full" value={evTime} onChange={(e) => setEvTime(e.target.value)} placeholder="10h" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-ink-muted">Local</label>
            <input className="input w-full" value={evLocal} onChange={(e) => setEvLocal(e.target.value)} placeholder="Casa do Léo" />
          </div>
        </div>
        <div className="mt-2">
          <label className="mb-1 block text-xs text-ink-muted">Recado (sorteio / W.O.)</label>
          <input className="input w-full" value={evNote} onChange={(e) => setEvNote(e.target.value)} />
        </div>
        <button
          className="btn-ghost mt-3"
          onClick={() =>
            act(
              () =>
                adminActions.setEditionMeta({
                  event_date: evDate,
                  event_time: evTime,
                  event_local: evLocal,
                  event_note: evNote,
                }),
              "Dados do evento salvos.",
            )
          }
        >
          Salvar dados do evento
        </button>

        <div className="mt-4 border-t border-line pt-3">
          <h3 className="font-display tracking-wide text-ink">Abrir a próxima edição</h3>
          <p className="mt-1 text-xs text-ink-muted">
            A edição atual é <strong className="text-ink">arquivada no Histórico</strong> (classificação,
            chave e artilharia ficam guardadas) e a próxima começa zerada: sem jogos, sem placares.
            Nada da edição arquivada pode ser alterado depois.
          </p>
          <label className="mt-2 flex items-center gap-2 text-sm text-ink-muted">
            <input
              type="checkbox"
              checked={copyPlayers}
              onChange={(e) => setCopyPlayers(e.target.checked)}
            />
            Levar os {players.length} participantes atuais (com foto) para a nova edição
          </label>
          <button
            className="btn-primary mt-2"
            onClick={() => {
              if (
                confirm(
                  `Arquivar a ${editionLabel(edition)} e abrir a ${editionLabel(edition + 1)}?\n\n` +
                    "A edição atual vira histórico (só leitura) e o site passa a mostrar a nova, zerada.",
                )
              ) {
                act(
                  () => adminActions.newEdition({ copy_players: copyPlayers }),
                  `${editionLabel(edition + 1)} aberta. A anterior está no Histórico.`,
                );
              }
            }}
          >
            Arquivar e abrir a {editionLabel(edition + 1)}
          </button>
          {edition > 1 && matches.length === 0 && (
            <button
              className="btn-ghost mt-2 sm:ml-2"
              onClick={() => {
                if (
                  confirm(
                    `Voltar para a ${editionLabel(edition - 1)}? A ${editionLabel(edition)} ainda não tem jogos e será descartada.`,
                  )
                ) {
                  act(
                    () => adminActions.discardEdition(),
                    `De volta à ${editionLabel(edition - 1)}.`,
                  );
                }
              }}
            >
              Desfazer: voltar para a {editionLabel(edition - 1)}
            </button>
          )}
        </div>
      </section>

      {/* Configuração + fases */}
      <section className="panel p-4">
        <h2 className="mb-3 font-display text-xl tracking-wide">Torneio</h2>
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex-1">
            <label className="mb-1 block text-xs text-ink-muted">Nome do torneio</label>
            <input className="input w-full" value={tName} onChange={(e) => setTName(e.target.value)} />
          </div>
          <button
            className="btn-ghost"
            onClick={() => act(() => adminActions.setConfig({ tournament_name: tName }), "Nome salvo.")}
          >
            Salvar nome
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            className="btn-primary"
            onClick={() =>
              actUndo("montar mata-mata", () => adminActions.seedBracket(), "Mata-mata montado com o Top 6.")
            }
          >
            Montar mata-mata (Top 6)
          </button>
          <button
            className="btn-ghost"
            onClick={() => act(() => adminActions.closeTournament(), "Torneio encerrado.")}
          >
            Encerrar torneio
          </button>
          {config.phase !== "liga" && (
            <button
              className="btn-ghost"
              onClick={() => act(() => adminActions.reopen("liga"), "Voltou para a fase de liga.")}
            >
              Reabrir liga
            </button>
          )}
          {config.phase === "encerrado" && (
            <button
              className="btn-ghost"
              onClick={() => act(() => adminActions.reopen("mata_mata"), "Reaberto.")}
            >
              Reabrir mata-mata
            </button>
          )}
          <button
            className="btn-danger"
            onClick={() => {
              if (
                confirm(
                  "Zerar TODOS os placares? Os confrontos e a chave continuam — só os resultados voltam a ficar em branco.",
                )
              ) {
                actUndo("zerar placares", () => adminActions.resetScores(), "Todos os placares foram zerados.");
              }
            }}
          >
            Zerar todos os placares
          </button>
        </div>
        <p className="mt-2 text-xs text-ink-muted">
          “Zerar placares” apaga só os resultados (mantém o sorteio e o mata-mata). Para refazer os
          confrontos do zero, use “Sortear confrontos” abaixo.
        </p>
      </section>

      {/* Participantes */}
      <section className="panel p-4">
        <h2 className="mb-3 font-display text-xl tracking-wide">
          Participantes <span className="text-sm text-ink-muted">({players.length}/12)</span>
        </h2>
        <div className="flex gap-2">
          <input
            className="input flex-1"
            placeholder="Nome do participante"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && name.trim()) {
                act(() => adminActions.addPlayer(name.trim()));
                setName("");
              }
            }}
          />
          <button
            className="btn-primary"
            disabled={players.length >= 12 || !name.trim()}
            onClick={() => {
              act(() => adminActions.addPlayer(name.trim()));
              setName("");
            }}
          >
            Adicionar
          </button>
        </div>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {players.map((p, i) => (
            <li key={p.id} className="flex items-center gap-3 rounded-lg border border-line bg-base/40 px-3 py-2">
              <span className="w-4 shrink-0 text-center text-ink-muted">{i + 1}</span>
              <Avatar name={p.name} photo={p.photo} size={40} />
              <span className="min-w-0 flex-1 truncate font-display text-xl tracking-wide">
                {p.name}
              </span>
              {p.withdrawn && (
                <span className="chip border-danger/50 font-sans text-danger" title="Desistiu — todos os jogos dele são W.O. 3×0">
                  desistiu
                </span>
              )}
              <label className="btn-ghost cursor-pointer px-2 py-1 text-xs" title="Enviar/trocar foto">
                {p.photo ? "Trocar foto" : "Foto"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (!f) return;
                    try {
                      const data = await fileToAvatarDataUrl(f);
                      await act(() => adminActions.setPhoto(p.id, data), `Foto de ${p.name} salva.`);
                    } catch (err: any) {
                      setError(err?.message ?? "Falha ao enviar a foto.");
                    }
                  }}
                />
              </label>
              {p.photo && (
                <button
                  className="text-xs text-ink-muted hover:text-danger"
                  title="Remover foto"
                  onClick={() => act(() => adminActions.setPhoto(p.id, null))}
                >
                  ✕
                </button>
              )}
              <button className="btn-danger px-2 py-1 text-xs" onClick={() => removeParticipant(p)}>
                Remover
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-3">
          <button
            className="btn-primary"
            disabled={players.length < 2}
            onClick={() => {
              if (confirm("Sortear/refazer os confrontos? Isso reinicia todos os placares da liga.")) {
                actUndo("sortear confrontos", () => adminActions.generateLeague(), "Confrontos sorteados.");
              }
            }}
          >
            Sortear confrontos (todos contra todos)
          </button>
          <p className="mt-1 text-xs text-ink-muted">
            Gera a tabela da liga (turno único). Os 6 primeiros se classificam para o mata-mata.
          </p>
        </div>
      </section>

      {/* Desistência (W.O.) */}
      <section className="panel p-4">
        <h2 className="mb-1 font-display text-xl tracking-wide">Desistência (W.O.)</h2>
        <p className="mb-3 text-xs text-ink-muted">
          Se alguém abandonar, todos os jogos dele — feitos ou a fazer — viram vitória por 3×0 para
          os adversários (todos em igualdade). Os gols de W.O. não contam para a artilharia nem para
          a melhor defesa. No mata-mata, o adversário avança. A marca fica{" "}
          <strong className="text-ink">grudada na pessoa</strong>: qualquer jogo que ela ainda vier a
          ter — como uma semifinal que dependia da repescagem — já nasce 3×0, sem precisar registrar
          de novo.
        </p>
        <div className="flex flex-wrap items-end gap-2">
          <select className="input" value={quitId} onChange={(e) => setQuitId(e.target.value)}>
            <option value="">Quem desistiu…</option>
            {players.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <button
            className="btn-danger"
            disabled={!quitId}
            onClick={() => {
              const nm = players.find((p) => p.id === quitId)?.name ?? "";
              if (
                confirm(
                  `Registrar desistência de ${nm}? Todos os jogos dele viram W.O. 3×0 para os adversários.`,
                )
              ) {
                actUndo(`desistência de ${nm}`, () => adminActions.withdraw(quitId), "Desistência registrada (W.O. 3×0).");
                setQuitId("");
              }
            }}
          >
            Registrar desistência
          </button>
        </div>

        {players.some((p) => p.withdrawn) && (
          <div className="mt-3 border-t border-line pt-3">
            <p className="mb-2 text-xs text-ink-muted">Quem está marcado como desistente:</p>
            <ul className="flex flex-wrap gap-2">
              {players
                .filter((p) => p.withdrawn)
                .map((p) => (
                  <li key={p.id} className="flex items-center gap-2 rounded-lg border border-danger/40 bg-danger/10 px-2.5 py-1.5">
                    <span className="font-display text-lg tracking-wide text-ink">{p.name}</span>
                    <button
                      className="text-xs text-ink-muted underline hover:text-ink"
                      onClick={() => {
                        if (
                          confirm(
                            `Cancelar a desistência de ${p.name}? Os placares 3×0 já lançados continuam — corrija à mão os que quiser.`,
                          )
                        ) {
                          actUndo(
                            `cancelar desistência de ${p.name}`,
                            () => adminActions.reinstate(p.id),
                            `${p.name} voltou ao torneio.`,
                          );
                        }
                      }}
                    >
                      cancelar
                    </button>
                  </li>
                ))}
            </ul>
          </div>
        )}
      </section>

      {/* Placares da liga */}
      {ligaRounds.length > 0 && (
        <section className="panel p-4">
          <h2 className="mb-3 font-display text-xl tracking-wide">Placares — Liga</h2>
          <div className="space-y-4">
            {ligaRounds.map(({ round, games, finished }, i) => {
              const isCurrent = !finished && i === 0;
              return (
                <div key={round} className={finished ? "opacity-70" : ""}>
                  <h3 className="mb-2 flex items-center gap-2 font-display tracking-wide text-ink-muted">
                    Rodada {round}
                    {isCurrent && <span className="chip border-cyan/50 text-cyan">jogando agora</span>}
                    {finished && <span className="chip border-line text-ink-muted/70">encerrada</span>}
                  </h3>
                  <div className="grid gap-2">
                    {games.map((m) => (
                      <ScoreEditor key={m.id} match={m} players={players} onError={setError} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Desempate */}
      <section id="secao-desempate" className="panel p-4">
        <h2 className="mb-1 font-display text-xl tracking-wide">Partida de desempate</h2>
        <p className="mb-3 text-xs text-ink-muted">
          Critério 6. Os gols NÃO contam para a artilharia. Empate → escolha o vencedor nos
          pênaltis.
        </p>
        <div className="flex flex-wrap items-end gap-2">
          <select className="input" value={deA} onChange={(e) => setDeA(e.target.value)}>
            <option value="">Jogador A…</option>
            {players.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <select className="input" value={deB} onChange={(e) => setDeB(e.target.value)}>
            <option value="">Jogador B…</option>
            {players.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <button
            className="btn-ghost"
            disabled={!deA || !deB || deA === deB}
            onClick={() => {
              act(() => adminActions.createDesempate(deA, deB), "Partida de desempate criada.");
              setDeA("");
              setDeB("");
            }}
          >
            Criar desempate
          </button>
        </div>
        {desempates.length > 0 && (
          <div className="mt-3 grid gap-2">
            {desempates.map((m) => (
              <div key={m.id} className="relative">
                <ScoreEditor match={m} players={players} onError={setError} />
                <button
                  className="absolute right-2 top-2 text-xs text-danger hover:underline"
                  onClick={() => act(() => adminActions.deleteMatch(m.id))}
                >
                  excluir
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Placares do mata-mata */}
      {koMatches.length > 0 && (
        <section className="panel p-4">
          <h2 className="mb-3 font-display text-xl tracking-wide">Placares — Mata-mata</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {koMatches.map((m) => (
              <div key={m.id}>
                <div className="mb-1 font-display text-xs tracking-widest text-ink-muted">
                  {m.slot}
                </div>
                <ScoreEditor match={m} players={players} onError={setError} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Backup */}
      <section className="panel p-4">
        <h2 className="mb-1 font-display text-xl tracking-wide">Backup do evento (JSON)</h2>
        <p className="mb-3 text-xs text-ink-muted">
          Exporta e importa a <strong className="text-ink">{editionLabel(edition)}</strong> — as
          edições arquivadas no Histórico não são tocadas. Exporte antes de qualquer ação destrutiva.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <button className="btn-ghost" onClick={exportJson}>
            Exportar JSON
          </button>
          <label className="btn-ghost cursor-pointer">
            Importar JSON
            <input
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) importJson(f);
                e.target.value = "";
              }}
            />
          </label>
          {isLocal && (
            <button
              className="btn-danger"
              onClick={() => {
                if (confirm("Apagar TODO o torneio deste dispositivo e recomeçar do zero?")) {
                  act(() => adminActions.resetLocal(), "Torneio reiniciado.");
                }
              }}
            >
              Reiniciar torneio (apagar tudo)
            </button>
          )}
        </div>
        {isLocal && (
          <p className="mt-2 text-xs text-ink-muted">
            Dica: exporte o JSON antes de reiniciar se quiser guardar o resultado.
          </p>
        )}
      </section>
    </div>
  );
}
