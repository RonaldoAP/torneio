"use client";

import { useTournament } from "@/lib/useTournament";
import { PageHeader, LiveBadge } from "@/components/ui";
import { editionLabel, eventInfo } from "@/lib/editions";

const RULES: { n: string; title: string; body: React.ReactNode }[] = [
  {
    n: "01",
    title: "Formato",
    body: (
      <ul className="list-disc space-y-1 pl-5">
        <li>Fase de liga: pontos corridos em turno único — todos contra todos, um jogo cada.</li>
        <li>Classificam-se os 6 primeiros para a fase final.</li>
        <li>
          <span className="text-branco">1º e 2º avançam direto para a semifinal.</span>
        </li>
        <li>Repescagem: 3º×6º e 4º×5º.</li>
        <li>Semifinais: 1º × vencedor de (4º×5º) · 2º × vencedor de (3º×6º).</li>
        <li>Final e disputa de 3º lugar. O 1º e o 2º só podem se enfrentar na final.</li>
      </ul>
    ),
  },
  {
    n: "02",
    title: "Pontuação",
    body: <p>Vitória: 3 · Empate: 1 · Derrota: 0.</p>,
  },
  {
    n: "03",
    title: "Critérios de desempate (fase de liga)",
    body: (
      <p>
        Nesta ordem: 1) pontos; 2) vitórias; 3) saldo de gols; 4) gols marcados; 5) confronto
        direto; 6) nova partida entre os empatados (os gols dessa partida não contam para a
        artilharia, só definem quem avança).
      </p>
    ),
  },
  {
    n: "04",
    title: "Configurações das partidas",
    body: (
      <p>
        5 minutos por tempo (10 min por partida); velocidade e câmera padrão; lesões, cartões e
        impedimentos ativados.
      </p>
    ),
  },
  {
    n: "05",
    title: "Escolha de times",
    body: (
      <p>
        Cada jogador escolhe o time que quiser, livremente, inclusive é permitido os dois usarem o
        mesmo time na mesma partida.
      </p>
    ),
  },
  {
    n: "06",
    title: "Mata-mata",
    body: (
      <p>
        Classificam-se 6. O 1º e o 2º entram direto na semifinal; 3º a 6º disputam a repescagem
        (3º×6º e 4º×5º) por uma vaga na semi. Jogo único em todas as fases; empate no tempo normal →
        prorrogação; persistindo → pênaltis; quem vencer avança (sem critério de saldo). Há disputa
        de 3º lugar entre os perdedores das semifinais.
      </p>
    ),
  },
  {
    n: "07",
    title: "Conduta e W.O.",
    body: (
      <p>
        Pausas só com a bola parada; tolerância de atraso de 5 minutos, após isso derrota por W.O.
        (3×0); conduta antidesportiva pode gerar advertência ou eliminação, a critério da
        organização.
      </p>
    ),
  },
  {
    n: "08",
    title: "Queda de energia",
    body: (
      <p>
        Se a luz cair, a partida é reiniciada e joga-se apenas o tempo que faltava; se não lembrarem
        o tempo exato, os dois combinam um tempo aproximado (ex.: caiu aos 70', joga-se os 25'
        restantes); o tempo restante já considera os acréscimos, e a partida só termina quando a
        bola sair de jogo.
      </p>
    ),
  },
  {
    n: "09",
    title: "Organização",
    body: (
      <p>
        Casos omissos são resolvidos pela organização; a inscrição implica concordância com este
        regulamento.
      </p>
    ),
  },
  {
    n: "10",
    title: "Desistência / abandono",
    body: (
      <p>
        Se um participante desistir no meio do torneio, todos os jogos dele — já disputados ou não —
        contam como W.O.: vitória por 3×0 para cada adversário, deixando todos em igualdade. Os gols
        de W.O. não contam para a artilharia. No mata-mata, a desistência é W.O. e o adversário
        avança.
      </p>
    ),
  },
  {
    n: "11",
    title: "Premiação",
    body: (
      <ul className="list-none space-y-1">
        <li>🥇 <span className="text-branco">1º lugar:</span> Troféu + Medalha de Campeão</li>
        <li>🥈 <span className="text-branco">2º lugar:</span> Troféu + Medalha de Vice</li>
        <li>🥉 <span className="text-branco">3º lugar:</span> Troféu</li>
        <li>🔻 <span className="text-branco">Lanterna (último):</span> Medalha de Lanterna</li>
        <li>🎖️ <span className="text-branco">Demais participantes:</span> Medalha de participação</li>
      </ul>
    ),
  },
];

export default function RegulamentoPage() {
  const { config, mode, connected, loading, edition, editionInfo } = useTournament();
  const EVENT = eventInfo(editionInfo);

  return (
    <div className="animate-reveal">
      <PageHeader
        title={loading ? "Regulamento" : config.tournament_name}
        subtitle={`Regulamento oficial · ${editionLabel(edition)}`}
        right={
          <div className="flex items-center gap-2 no-print">
            <LiveBadge mode={mode} connected={connected} />
            <button className="btn-ghost" onClick={() => window.print()}>
              Imprimir / PDF
            </button>
          </div>
        }
      />

      {/* Informações do evento */}
      <div className="panel mb-4 p-4">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <span className="font-display text-xl tracking-wide text-gremio">📅 {EVENT.date}</span>
          <span className="font-display text-xl tracking-wide text-ink">🕒 {EVENT.time}</span>
          <span className="font-display text-xl tracking-wide text-ink">📍 {EVENT.local}</span>
          <span className="chip">Até {EVENT.slots} participantes</span>
        </div>
        <p className="mt-2 text-sm text-ink-muted">⏱️ {EVENT.note}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {RULES.map((r) => (
          <section key={r.n} className="panel p-4">
            <div className="mb-2 flex items-center gap-2">
              <span className="font-display text-2xl text-gremio">{r.n}</span>
              <h2 className="font-display text-xl tracking-wide text-ink">{r.title}</h2>
            </div>
            <div className="text-sm leading-relaxed text-ink-muted">{r.body}</div>
          </section>
        ))}
      </div>
    </div>
  );
}
