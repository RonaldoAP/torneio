"use client";

import { useEffect } from "react";
import { useTournament } from "@/lib/useTournament";
import { PageHeader, LiveBadge } from "@/components/ui";
import { editionLabel, eventInfo } from "@/lib/editions";

/* Blocos de leitura: o regulamento é lido no celular, em pé, no meio do jogo —
   então nada de parágrafo corrido. Tudo vira lista curta, com o termo que
   importa destacado. */
const Chave = ({ children }: { children: React.ReactNode }) => (
  <span className="font-semibold text-branco">{children}</span>
);

const Lista = ({ children }: { children: React.ReactNode }) => (
  <ul className="list-disc space-y-1.5 pl-5 leading-relaxed marker:text-cyan/60">{children}</ul>
);

const Ordem = ({ children }: { children: React.ReactNode }) => (
  <ol className="list-decimal space-y-1.5 pl-5 leading-relaxed marker:font-display marker:text-cyan/70">
    {children}
  </ol>
);

/** Linha "rótulo → valor", para o que é tabelinha e não frase. */
const Dado = ({ rotulo, children }: { rotulo: string; children: React.ReactNode }) => (
  <div className="flex flex-wrap items-baseline gap-x-2 border-b border-line/60 py-1.5 last:border-0">
    <span className="min-w-[7.5rem] font-display text-[13px] uppercase tracking-wider text-ink-muted">
      {rotulo}
    </span>
    <span className="flex-1 leading-relaxed">{children}</span>
  </div>
);

const RULES: { n: string; title: string; body: React.ReactNode; aberto?: boolean }[] = [
  {
    n: "01",
    title: "Formato",
    aberto: true,
    body: (
      <Lista>
        <li>
          <Chave>Fase de liga:</Chave> pontos corridos em turno único — todos contra todos, um jogo
          cada.
        </li>
        <li>
          Classificam-se os <Chave>6 primeiros</Chave> para a fase final.
        </li>
        <li>
          <Chave>1º e 2º avançam direto para a semifinal.</Chave>
        </li>
        <li>
          <Chave>Repescagem:</Chave> 3º×6º e 4º×5º.
        </li>
        <li>
          <Chave>Semifinais:</Chave> 1º × vencedor de (4º×5º) · 2º × vencedor de (3º×6º).
        </li>
        <li>
          Final e disputa de 3º lugar. O 1º e o 2º só podem se enfrentar na final.
        </li>
      </Lista>
    ),
  },
  {
    n: "02",
    title: "Pontuação",
    body: (
      <div className="flex gap-2">
        {[
          { k: "Vitória", v: "3" },
          { k: "Empate", v: "1" },
          { k: "Derrota", v: "0" },
        ].map(({ k, v }) => (
          <div
            key={k}
            className="flex-1 rounded-xl border border-line bg-white/[0.03] px-3 py-2.5 text-center"
          >
            <div className="font-display text-3xl leading-none text-branco">{v}</div>
            <div className="mt-1 font-display text-[12px] uppercase tracking-widest text-ink-muted">
              {k}
            </div>
          </div>
        ))}
      </div>
    ),
  },
  {
    n: "03",
    title: "Critérios de desempate (fase de liga)",
    body: (
      <>
        <p className="mb-2">Aplicados nesta ordem, um a um, até desempatar:</p>
        <Ordem>
          <li>Pontos</li>
          <li>Vitórias</li>
          <li>Saldo de gols</li>
          <li>Gols marcados</li>
          <li>Confronto direto</li>
          <li>
            <Chave>Nova partida</Chave> entre os empatados
          </li>
        </Ordem>
        <p className="mt-2 text-xs text-ink-muted">
          Os gols da partida de desempate não contam para a artilharia — ela só define quem fica
          na frente.
        </p>
      </>
    ),
  },
  {
    n: "04",
    title: "Configurações das partidas",
    body: (
      <div>
        <Dado rotulo="Duração">5 minutos por tempo — 10 minutos de partida</Dado>
        <Dado rotulo="Velocidade">Padrão</Dado>
        <Dado rotulo="Câmera">Padrão</Dado>
        <Dado rotulo="Ativados">Lesões, cartões e impedimentos</Dado>
      </div>
    ),
  },
  {
    n: "05",
    title: "Escolha de times",
    body: (
      <Lista>
        <li>Cada um escolhe o time que quiser, livremente.</li>
        <li>
          <Chave>É permitido</Chave> os dois usarem o mesmo time na mesma partida.
        </li>
      </Lista>
    ),
  },
  {
    n: "06",
    title: "Mata-mata",
    body: (
      <Lista>
        <li>Classificam-se 6. O 1º e o 2º entram direto na semifinal.</li>
        <li>3º a 6º disputam a repescagem (3º×6º e 4º×5º) por uma vaga na semi.</li>
        <li>
          <Chave>Jogo único</Chave> em todas as fases — não há critério de saldo.
        </li>
        <li>
          Empate no tempo normal → <Chave>prorrogação</Chave>; persistindo →{" "}
          <Chave>pênaltis</Chave>. Quem vencer avança.
        </li>
        <li>Há disputa de 3º lugar entre os perdedores das semifinais.</li>
      </Lista>
    ),
  },
  {
    n: "07",
    title: "Conduta e W.O.",
    body: (
      <Lista>
        <li>Pausas só com a bola parada.</li>
        <li>
          Atraso: tolerância de <Chave>5 minutos</Chave>. Depois disso, derrota por{" "}
          <Chave>W.O. (3×0)</Chave>.
        </li>
        <li>
          Conduta antidesportiva pode gerar advertência ou eliminação, a critério da organização.
        </li>
      </Lista>
    ),
  },
  {
    n: "08",
    title: "Queda de energia",
    body: (
      <Lista>
        <li>A partida é reiniciada e joga-se apenas o tempo que faltava.</li>
        <li>
          Sem lembrar o tempo exato, os dois combinam um aproximado — ex.: caiu aos 70’, jogam-se
          os 25’ restantes.
        </li>
        <li>O tempo restante já considera os acréscimos.</li>
        <li>
          A partida só termina quando a <Chave>bola sair de jogo</Chave>.
        </li>
      </Lista>
    ),
  },
  {
    n: "09",
    title: "Organização",
    body: (
      <Lista>
        <li>Casos omissos são resolvidos pela organização.</li>
        <li>A inscrição implica concordância com este regulamento.</li>
      </Lista>
    ),
  },
  {
    n: "10",
    title: "Desistência / abandono",
    body: (
      <Lista>
        <li>
          Todos os jogos de quem desistir — <Chave>já disputados ou não</Chave> — viram vitória por
          3×0 para cada adversário, deixando todos em igualdade.
        </li>
        <li>Os gols de W.O. não contam para a artilharia nem para a melhor defesa.</li>
        <li>No mata-mata, a desistência é W.O. e o adversário avança.</li>
      </Lista>
    ),
  },
  {
    n: "11",
    title: "Premiação",
    body: (
      <ul className="grid gap-1.5 sm:grid-cols-2">
        {[
          ["🥇", "1º lugar", "Troféu + Medalha de Campeão"],
          ["🥈", "2º lugar", "Troféu + Medalha de Vice"],
          ["🥉", "3º lugar", "Troféu"],
          ["🔻", "Lanterna (último)", "Medalha de Lanterna"],
          ["⚽", "Artilheiro", "Medalha — quem fizer mais gols"],
          ["🧤", "Melhor defesa", "Medalha — quem sofrer menos gols"],
          ["🎖️", "Demais participantes", "Medalha de participação"],
        ].map(([icone, quem, premio]) => (
          <li
            key={quem}
            className="flex items-center gap-2.5 rounded-lg border border-line bg-white/[0.03] px-3 py-2"
          >
            <span className="text-lg leading-none">{icone}</span>
            <span className="min-w-0">
              <span className="block font-display text-[15px] uppercase tracking-wide text-branco">
                {quem}
              </span>
              <span className="block text-xs text-ink-muted">{premio}</span>
            </span>
          </li>
        ))}
      </ul>
    ),
  },
  {
    n: "12",
    title: "Artilheiro e melhor defesa",
    body: (
      <>
        <Lista>
          <li>
            <Chave>Artilheiro:</Chave> quem marcar mais gols. Empate → leva quem fez em menos jogos.
          </li>
          <li>
            <Chave>Melhor defesa:</Chave> quem sofrer menos gols. Empate → leva quem sofreu menos em
            mais jogos.
          </li>
          <li>
            As duas contas somam <Chave>liga + mata-mata</Chave> e não contam gols de{" "}
            <Chave>W.O.</Chave> nem de <Chave>partida de desempate</Chave>.
          </li>
        </Lista>
        <p className="mt-2 text-xs text-ink-muted">
          Por isso a melhor defesa pode não bater com a coluna “Gols” da classificação, que soma
          tudo — lá o W.O. precisa valer, porque decide pontos.
        </p>
      </>
    ),
  },
];

export default function RegulamentoPage() {
  const { config, mode, connected, loading, edition, editionInfo } = useTournament();
  const EVENT = eventInfo(editionInfo);

  /** Impressão: <details> fechado não sai no papel — abre tudo antes. */
  useEffect(() => {
    const abrirTudo = () =>
      document.querySelectorAll("details").forEach((d) => d.setAttribute("open", ""));
    window.addEventListener("beforeprint", abrirTudo);
    return () => window.removeEventListener("beforeprint", abrirTudo);
  }, []);

  return (
    <div className="animate-reveal">
      <PageHeader
        title={loading ? "Regulamento" : config.tournament_name}
        subtitle={`Regulamento oficial · ${editionLabel(edition)}`}
        right={<LiveBadge mode={mode} connected={connected} />}
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

      {/* Acordeão: uma regra por linha. Só o Formato nasce aberto — o resto o
          leitor abre conforme precisa. <details> nativo: funciona sem JS, com
          teclado, e a impressão abre tudo antes de mandar pro papel. */}
      <div className="space-y-2">
        {RULES.map((r) => (
          <details key={r.n} open={r.aberto} className="panel group overflow-hidden">
            <summary className="flex cursor-pointer list-none items-center gap-2.5 p-4 transition-colors hover:bg-white/[0.03] [&::-webkit-details-marker]:hidden">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gremio/15 font-display text-xl text-gremio">
                {r.n}
              </span>
              <h2 className="flex-1 font-display text-2xl font-bold uppercase tracking-wide text-ink">
                {r.title}
              </h2>
              <span
                aria-hidden
                className="shrink-0 text-ink-muted transition-transform duration-200 group-open:rotate-180"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M6 9l6 6 6-6"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
            </summary>
            <div className="border-t border-line px-4 pb-4 pt-3 text-sm text-ink-muted">
              {r.body}
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}
