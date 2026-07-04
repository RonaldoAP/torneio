"use client";

import { useTournament } from "@/lib/useTournament";
import { PageHeader, LiveBadge } from "@/components/ui";

const RULES: { n: string; title: string; body: React.ReactNode }[] = [
  {
    n: "01",
    title: "Formato",
    body: (
      <ul className="list-disc space-y-1 pl-5">
        <li>Máximo de 12 vagas (participantes).</li>
        <li>Fase de liga: pontos corridos em turno único — todos contra todos, um jogo cada.</li>
        <li>Classificam-se os 8 primeiros para a fase final.</li>
        <li>Mata-mata: quartas, semifinais e final em jogo único.</li>
        <li>
          Chaveamento: 1º×8º, 2º×7º, 3º×6º, 4º×5º. O 1º e o 2º ficam em lados opostos da chave e só
          podem se enfrentar na final.
        </li>
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
        Jogo único em todas as fases; empate no tempo normal → prorrogação; persistindo → pênaltis;
        quem vencer avança (sem critério de saldo). Há disputa de 3º lugar entre os perdedores das
        semifinais.
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
];

export default function RegulamentoPage() {
  const { config, mode, connected, loading } = useTournament();

  return (
    <div className="animate-reveal">
      <PageHeader
        title={loading ? "Regulamento" : config.tournament_name}
        subtitle="Regulamento oficial do torneio"
        right={
          <div className="flex items-center gap-2 no-print">
            <LiveBadge mode={mode} connected={connected} />
            <button className="btn-ghost" onClick={() => window.print()}>
              Imprimir / PDF
            </button>
          </div>
        }
      />

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
