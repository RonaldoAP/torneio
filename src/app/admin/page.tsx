"use client";

import { useEffect, useMemo, useState } from "react";
import { useTournament } from "@/lib/useTournament";
import { adminActions } from "@/lib/adminActions";
import { computeStandings } from "@/lib/standings";
import type { Match, TournamentState } from "@/lib/types";
import { ScoreEditor } from "@/components/admin/ScoreEditor";

export default function AdminPage() {
  const state = useTournament();
  const { mode } = state;

  const [authed, setAuthed] = useState<boolean | null>(null);
  const [pwSet, setPwSet] = useState(true);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const isLocal = mode === "local";

  useEffect(() => {
    if (isLocal) {
      setAuthed(true);
      return;
    }
    fetch("/api/admin/session")
      .then((r) => r.json())
      .then((d) => {
        setAuthed(!!d.authed);
        setPwSet(!!d.adminPasswordSet);
      })
      .catch(() => setAuthed(false));
  }, [isLocal]);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      setAuthed(true);
      setPassword("");
    } else {
      const d = await res.json().catch(() => ({}));
      setError(d?.error ?? "Senha incorreta.");
    }
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    setAuthed(false);
  }

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

  if (authed === null) {
    return <div className="panel mt-6 p-6 text-ink-muted">Verificando acesso…</div>;
  }

  if (!authed) {
    return (
      <div className="mx-auto mt-10 max-w-sm">
        <h1 className="mb-4 font-display text-3xl tracking-wide">Painel do Admin</h1>
        <form onSubmit={login} className="panel space-y-3 p-5">
          <label className="block text-sm text-ink-muted">Senha do admin</label>
          <input
            type="password"
            className="input w-full"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
          />
          {error && <p className="text-sm text-danger">{error}</p>}
          {!pwSet && (
            <p className="text-xs text-branco">
              Aviso: ADMIN_PASSWORD não está definida no servidor.
            </p>
          )}
          <button className="btn-primary w-full">Entrar</button>
        </form>
      </div>
    );
  }

  return (
    <AdminDashboard
      state={state}
      onLogout={isLocal ? undefined : logout}
      isLocal={isLocal}
      error={error}
      info={info}
      act={act}
      setError={setError}
    />
  );
}

function AdminDashboard({
  state,
  onLogout,
  isLocal,
  error,
  info,
  act,
  setError,
}: {
  state: ReturnType<typeof useTournament>;
  onLogout?: () => void;
  isLocal: boolean;
  error: string | null;
  info: string | null;
  act: (fn: () => Promise<any>, okMsg?: string) => Promise<void>;
  setError: (m: string | null) => void;
}) {
  const { players, matches, config } = state;
  const [name, setName] = useState("");
  const [tName, setTName] = useState(config.tournament_name);
  const [deA, setDeA] = useState("");
  const [deB, setDeB] = useState("");
  const [quitId, setQuitId] = useState("");

  useEffect(() => setTName(config.tournament_name), [config.tournament_name]);

  const ligaRounds = useMemo(() => {
    const byRound = new Map<number, Match[]>();
    for (const m of matches.filter((x) => x.stage === "liga")) {
      const r = m.round ?? 0;
      if (!byRound.has(r)) byRound.set(r, []);
      byRound.get(r)!.push(m);
    }
    return [...byRound.entries()].sort((a, b) => a[0] - b[0]);
  }, [matches]);

  const koMatches = useMemo(() => {
    const order = ["QF1", "QF2", "QF3", "QF4", "SF_A", "SF_B", "FINAL", "TERCEIRO"];
    return matches
      .filter((m) => ["quartas", "semi", "final", "terceiro"].includes(m.stage))
      .sort((a, b) => order.indexOf(a.slot ?? "") - order.indexOf(b.slot ?? ""));
  }, [matches]);

  const desempates = matches.filter((m) => m.stage === "desempate");
  const standings = computeStandings(players, matches);

  function exportJson() {
    const data: TournamentState = { config, players, matches };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `torneio-${new Date().toISOString().slice(0, 10)}.json`;
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
          <span className="chip">{isLocal ? "Modo local" : "Supabase"}</span>
          <span className="chip">Fase: {config.phase}</span>
          {onLogout && (
            <button className="btn-ghost py-1.5 text-sm" onClick={onLogout}>
              Sair
            </button>
          )}
        </div>
      </div>

      {isLocal && (
        <p className="rounded-xl border border-line bg-white/5 p-3 text-sm text-ink-muted">
          <strong className="text-ink">Modo local</strong> — os dados ficam salvos só neste
          navegador/dispositivo (sem servidor). Use <strong>Exportar JSON</strong> para backup.
          Quando quiser tempo real entre aparelhos, configure o Supabase (veja o README).
        </p>
      )}
      {error && <p className="rounded-xl border border-danger/30 bg-danger/10 p-3 text-sm text-danger">{error}</p>}
      {info && <p className="rounded-xl border border-gremio/30 bg-gremio/10 p-3 text-sm text-gremio">{info}</p>}

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
            onClick={() => act(() => adminActions.seedBracket(), "Mata-mata montado com o Top 8.")}
          >
            Montar mata-mata (Top 8)
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
        </div>
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
            <li key={p.id} className="flex items-center justify-between rounded-lg border border-line bg-base/40 px-3 py-2">
              <span className="truncate">
                <span className="mr-2 text-ink-muted">{i + 1}.</span>
                {p.name}
              </span>
              <button
                className="btn-danger px-2 py-1 text-xs"
                onClick={() => act(() => adminActions.removePlayer(p.id))}
              >
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
              if (
                confirm(
                  "Sortear/refazer os confrontos? Isso reinicia todos os placares da liga.",
                )
              ) {
                act(() => adminActions.generateLeague(), "Confrontos sorteados.");
              }
            }}
          >
            Sortear confrontos (todos contra todos)
          </button>
          <p className="mt-1 text-xs text-ink-muted">
            Gera a tabela da liga (turno único). Os 8 primeiros se classificam para o mata-mata.
          </p>
        </div>
      </section>

      {/* Desistência (W.O.) */}
      <section className="panel p-4">
        <h2 className="mb-1 font-display text-xl tracking-wide">Desistência (W.O.)</h2>
        <p className="mb-3 text-xs text-ink-muted">
          Se alguém abandonar, todos os jogos dele — feitos ou a fazer — viram vitória por 3×0 para
          os adversários (todos em igualdade). Os gols de W.O. não contam para a artilharia. No
          mata-mata, o adversário avança.
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
                act(() => adminActions.withdraw(quitId), "Desistência registrada (W.O. 3×0).");
                setQuitId("");
              }
            }}
          >
            Registrar desistência
          </button>
        </div>
      </section>

      {/* Placares da liga */}
      {ligaRounds.length > 0 && (
        <section className="panel p-4">
          <h2 className="mb-3 font-display text-xl tracking-wide">Placares — Liga</h2>
          <div className="space-y-4">
            {ligaRounds.map(([round, games]) => (
              <div key={round}>
                <h3 className="mb-2 font-display tracking-wide text-ink-muted">Rodada {round}</h3>
                <div className="grid gap-2">
                  {games.map((m) => (
                    <ScoreEditor key={m.id} match={m} players={players} onError={setError} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Desempate */}
      <section className="panel p-4">
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
        <h2 className="mb-3 font-display text-xl tracking-wide">Backup do evento (JSON)</h2>
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
