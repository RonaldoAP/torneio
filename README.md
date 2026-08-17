# 🏆 Torneio FIFA 26 — placar em tempo real

Mini-site para gerenciar e exibir um torneio de **FIFA 26 (EA Sports FC 26)** ao vivo:
da fase de liga até a final. O admin lança os placares e **todos os espectadores veem a
classificação, os confrontos, o mata-mata e a artilharia atualizarem sozinhos**, sem recarregar
a página.

- **Stack:** Next.js 14 (App Router) · TypeScript · Tailwind CSS
- **Tempo real:** Supabase (Postgres + Realtime)
- **Deploy:** Vercel
- Leitura **pública**; escrita (placares) só no painel de admin numa **URL secreta** (`/painel/<ADMIN_SLUG>`, sem senha).
- **Edições:** cada torneio é uma edição. Ao abrir a próxima, a anterior é arquivada em `/historico`
  (classificação, chave e artilharia preservadas) e a nova começa zerada.

> Sem Supabase configurado, o app cai automaticamente num **modo local** (estado em
> `localStorage`, um dispositivo só) — ótimo para testar. O modo **padrão** é o Supabase.

---

## 1. Rodar localmente

```bash
npm install
cp .env.example .env.local   # opcional: preencha para usar Supabase
npm run dev                  # http://localhost:3000
```

Sem preencher o `.env.local`, o app roda em **modo local** (um dispositivo).
Rode os testes da lógica (round-robin, classificação, mata-mata, artilharia):

```bash
npm test
```

---

## 2. Configurar o Supabase (modo tempo real)

1. Crie um projeto em <https://supabase.com>.
2. Abra **SQL Editor** e rode o arquivo [`supabase-schema.sql`](./supabase-schema.sql) inteiro.
   Ele cria as tabelas (`players`, `matches`, `config`, `editions`), habilita **RLS** (leitura
   pública anônima; escrita bloqueada) e liga o **Realtime** nelas.
   O arquivo é **idempotente**: rode-o de novo em um banco já existente para aplicar a
   migração das edições sem perder dados.
3. Em **Project Settings → API**, copie:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` (secreta) → `SUPABASE_SERVICE_ROLE_KEY`
4. Preencha o `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-anon-key
SUPABASE_SERVICE_ROLE_KEY=sua-service-role-key
ADMIN_SLUG=uma-slug-secreta-longa
```

### Como a segurança funciona

- O **browser** usa só a `anon key` e, pelo RLS, **só consegue ler**.
- As gravações passam pelas rotas `/api/admin/*` (servidor), que exigem o slug secreto `ADMIN_SLUG`
  e usam a `service_role key` (que ignora o RLS). **Essa chave nunca vai para o browser.**

> Teste o tempo real: abra o site em duas abas/aparelhos, lance um placar no `/admin` e veja a
> outra tela atualizar sozinha.

---

## 3. Deploy na Vercel

1. Suba o repositório para o GitHub.
2. Em <https://vercel.com> → **Add New → Project** → importe o repositório.
3. Framework: **Next.js** (detectado automaticamente).
4. Em **Environment Variables**, adicione as quatro variáveis do `.env.local`:
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_SLUG`.
5. **Deploy.** Pronto.

Ou pela CLI:

```bash
npm i -g vercel
vercel            # primeiro deploy (preview)
vercel --prod     # produção
```

Lembre de cadastrar as variáveis de ambiente também no painel da Vercel
(**Settings → Environment Variables**) — inclusive a `SUPABASE_SERVICE_ROLE_KEY`.

---

## 4. Como usar o torneio (fluxo do admin)

Acesse **`/painel/<ADMIN_SLUG>`** (a URL secreta que só você sabe — sem senha).

1. **Defina o nome** do torneio e os **dados do evento** (data, hora, local) em *Edição em cartaz*.
2. **Cadastre os participantes** aos poucos (máx. 12), conforme confirmam presença.
3. Quando as inscrições fecharem, clique em **Sortear confrontos** (round-robin, turno único).
   Se entrar mais alguém antes de começar, é só **regerar** (isso reinicia os placares da liga).
4. **Lance os placares** da liga. A classificação atualiza ao vivo para todos.
   Na liga **não há pênalti**: empate vale 1 ponto para cada.
5. Terminada a liga, clique em **Montar mata-mata (Top 6)** — o chaveamento é semeado
   automaticamente (ver *Regras implementadas*).
6. Lance os placares do mata-mata. Empate no tempo normal → **prorrogação** (registrada no
   placar final); persistindo → **pênaltis** (o admin escolhe o vencedor). Os vencedores
   avançam sozinhos e a **disputa de 3º lugar** é montada com os perdedores das semis.
7. **Encerrar torneio** exibe o banner de campeão.
8. Para a edição seguinte: **Arquivar e abrir a próxima edição**. A atual vira histórico
   (só leitura) e a nova começa zerada — com a opção de levar a mesma turma de participantes.

**Remover participante:** apaga também **todos os jogos dele**. Com partidas na mesa o painel
avisa quantas somem e sugere a **Desistência (W.O.)**, que preserva os jogos. Só apaga depois
de confirmar (e ainda dá pra **Desfazer**).

**Desempate na liga (critério 6):** se dois empatarem em tudo (inclusive confronto direto),
crie uma **partida de desempate** no admin — os gols dela **não contam** para a artilharia,
só definem quem fica na frente.

**Backup:** botões de **Exportar/Importar JSON** salvam/restauram todo o estado do evento.

---

## 5. Páginas

| Rota            | O quê                                                                   |
| --------------- | ----------------------------------------------------------------------- |
| `/`             | Regulamento (com **Imprimir / PDF**)                                    |
| `/participantes`| Lista de jogadores (máx. 12)                                            |
| `/confrontos`   | Jogos da liga por rodada + quem folga (nº ímpar de jogadores)          |
| `/classificacao`| Tabela ao vivo (P, J, V, E, D, GP, GC, SG) — Top 6 destacado           |
| `/mata-mata`    | Chaveamento (Repescagem → Semis → Final) + 3º lugar + banner de campeão |
| `/goleadores`   | Artilharia + melhor defesa (gols sofridos)                             |
| `/historico`    | Edições anteriores (aparece quando existe alguma arquivada)            |
| `/historico/<n>`| Uma edição arquivada: pódio, classificação final, chave e artilharia   |
| `/tv`           | Modo TV/Projetor (fonte grande, tela cheia, tempo real)               |
| `/painel/<slug>` | Painel de admin em URL secreta (sem senha)                          |

---

## 6. Regras implementadas

- **Liga:** pontos corridos, turno único. Vitória 3 · Empate 1 · Derrota 0.
  Confrontos gerados pelo **método do círculo** (com BYE quando ímpar). **Sem pênalti na liga.**
- **Desempate da classificação (nesta ordem):** 1) pontos · 2) vitórias · 3) saldo ·
  4) gols marcados · 5) confronto direto · 6) partida de desempate.
- **Artilharia:** por participante (o placar do lado dele); soma liga + mata-mata
  (tempo normal + prorrogação). **Não** conta W.O., desempate nem pênaltis.
- **Melhor defesa:** quem sofreu menos gols, com o **mesmo filtro** da artilharia — por
  isso pode divergir da coluna **GC** da classificação, que soma tudo (lá o W.O. vale pontos).
- **Mata-mata (Top 6):** 1º e 2º vão **direto à semifinal**. Repescagem: 4º×5º e 3º×6º.
  Semis: 1º × vencedor(4º×5º) e 2º × vencedor(3º×6º). Final e disputa de 3º lugar.
  Jogo único; empate → prorrogação → pênaltis. O 1º e o 2º só se cruzam na final.
- **Desistência (W.O.):** todos os jogos de quem desiste viram 3×0 para os adversários
  (feitos e a fazer) e **não contam para a artilharia**.

---

## 7. Estrutura

```
src/
  app/                 # páginas (App Router) + rotas /api/admin
  components/          # TabBar, StandingsTable, Bracket, ScoreEditor, ui
  lib/
    roundRobin.ts      # geração dos confrontos (círculo)
    standings.ts       # classificação + critérios de desempate
    scorers.ts         # artilharia
    bracket.ts         # semeadura e propagação do mata-mata
    editions.ts        # edições: filtro por edição, resumo e blindagem do remover
    useTournament.ts   # hook de dados AO VIVO (Supabase realtime / local)
    adminActions.ts    # mutações (servidor via API ou local)
    localStore.ts      # fallback em localStorage
    __tests__/         # testes (round-robin 10/11/12, classificação, mata-mata, artilharia)
supabase-schema.sql    # tabelas (players/matches/config/editions) + RLS + realtime
```
