# Copa Costela — FIFA 26 · Documento de Handoff

> Guia completo pra quem vai assumir o projeto. Lê do começo ao fim uma vez;
> depois usa como referência. Tudo que você precisa pra entender e continuar
> está aqui.

---

## 1. O que é o projeto

App web **em tempo real** para gerenciar um torneio de **FIFA 26 (EA Sports FC 26)** —
a "Copa Costela". Mostra, ao vivo, para todos os participantes:

- **Regulamento**, **Participantes** (com foto), **Confrontos** (tabela da liga),
  **Classificação**, **Mata-mata** (chave/organograma) e **Goleadores** (artilharia).
- Um **painel de admin secreto** onde o organizador sorteia os jogos, lança
  placares e monta o mata-mata. O que o admin faz **espelha na hora** no
  dispositivo de todo mundo (realtime).
- Um **telão** (`/tv`) em tela cheia que roda sozinho (slideshow) para projetar
  num telão/TV durante o evento.
- Um **histórico** (`/historico`) com as **edições anteriores** — cada uma com
  pódio, classificação final, chave e artilharia congelados.

1ª edição: **18 de julho de 2026, 10h, Casa do Léo.** Formato de liga (turno
único, todos contra todos) + mata-mata dos 6 primeiros.

**Produção:** https://copa-costela.vercel.app (Vercel) · banco no Supabase.

---

## 2. Stack

| Camada | Tecnologia |
|---|---|
| Framework | **Next.js 14** (App Router) + **TypeScript** |
| Estilo | **Tailwind CSS** (tema "Champions League": azul-marinho + ciano; fonte **Manrope**) |
| Banco / Realtime | **Supabase** (Postgres + Realtime + RLS) |
| Deploy | **Vercel** (auto-deploy a partir da branch `main`) |
| Testes | **Vitest** (`npm test`) |

---

## 3. Como rodar

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # build de produção (sempre rode antes de commitar mudanças grandes)
npm start        # sobe o build de produção
npm test         # roda a suíte de testes (Vitest)
npm run lint     # eslint
```

### Variáveis de ambiente (`.env.local`) — veja `.env.example`
```
NEXT_PUBLIC_SUPABASE_URL=https://kkquchkoqihqzwlrbqdm.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key pública do Supabase>
SUPABASE_SERVICE_ROLE_KEY=<service_role — SÓ no servidor, nunca no browser>
ADMIN_SLUG=<slug secreta do painel de admin>
```
> ⚠️ **Sem env de Supabase, o app cai no modo LOCAL** (localStorage, um dispositivo
> só — bom pra desenvolver, mas não espelha pra ninguém). Com as envs, entra no
> modo **Supabase (ao vivo)** automaticamente.

---

## 4. Deploy e fluxo de branches

- **Desenvolva numa branch de trabalho** (a última foi
  `claude/github-atualizacao-historicos-d0s0vm`; antes, `claude/fifa-26-tournament-app-sshkzh`).
- Para publicar: **fast-forward merge para `main`** e push. A Vercel faz
  **auto-deploy a partir de `main`**.
  ```bash
  git push -u origin <sua-branch>
  git fetch origin main && git checkout -B main origin/main
  git merge --ff-only <sua-branch>
  git push -u origin main
  git checkout <sua-branch>
  ```
- **Gotcha da Vercel:** ela pode reusar o *build cache* e **não re-injetar** as
  variáveis `NEXT_PUBLIC_*`. Se mudar uma env pública, faça um deploy **sem
  cache** (um commit novo já resolve, ou desmarque "Use existing Build Cache").
- **Env vars ficam no painel da Vercel** (Project → Settings → Environment
  Variables): `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
  `ADMIN_SLUG` (e `NEXT_PUBLIC_SUPABASE_URL`).

---

## 5. Supabase (banco)

- **Project ref:** `kkquchkoqihqzwlrbqdm` · região `sa-east-1` · **plano grátis**.
- **Schema:** está em [`supabase-schema.sql`](./supabase-schema.sql) — rode no SQL
  Editor do Supabase para criar as tabelas, RLS e habilitar realtime.
- **A URL do Supabase está fixada em código** em `src/lib/supabase/client.ts`
  (`https://kkquchkoqihqzwlrbqdm.supabase.co`). Motivo histórico: a env
  `NEXT_PUBLIC_SUPABASE_URL` já foi cadastrada com um **typo** no ref, o que
  derrubava a conexão; para blindar, o ref correto foi hardcoded. Dá pra
  sobrescrever com `NEXT_PUBLIC_SUPABASE_URL_OVERRIDE` se um dia trocar de projeto.
- **RLS:** leitura liberada para o papel `anon` (o site lê com a anon key);
  escrita só via `service_role` (as rotas `/api/admin`).
- **Realtime:** o hook assina as 3 tabelas (`players`, `matches`, `config`).
- ⚠️ **Plano grátis = SEM backup restaurável e SEM Point-in-Time-Recovery.**
  Isso mordeu o projeto (ver seção 12). Considere **habilitar backups/PITR**
  (plano Pro) antes de um próximo evento.

### Tabelas (resumo)
- **`players`**: `id` (uuid), `name`, `created_at`, `photo` (data URI ou null), `edition`.
- **`matches`**: `id`, `stage`, `round`, `home_id`, `away_id`, `home_goals`,
  `away_goals`, `pen_winner_id`, `counts_for_scorers`, `slot`, `created_at`, `edition`.
- **`config`** (linha única id=1): `tournament_name`, `phase`, `bracket_seeded`,
  `current_edition` (a edição que o site mostra).
- **`editions`**: `id` (1, 2, 3...), `name`, `event_date`, `event_time`, `event_local`,
  `event_note`, `created_at`, `closed_at` (preenchido ao arquivar).

> `supabase-schema.sql` é **idempotente** — rodá-lo de novo aplica a migração das
> edições no banco existente sem perder nada (`edition` entra com default 1).

`stage` ∈ `liga | quartas | semi | final | terceiro | desempate`.
`slot` (só no mata-mata) ∈ `REP_A | REP_B | SF_A | SF_B | FINAL | TERCEIRO`.

---

## 6. Arquitetura em uma folha

O coração é o hook **`src/lib/useTournament.ts`**: carrega `players/matches/config`
e mantém tudo **ao vivo**. Ele detecta o modo:
- **Supabase** (se as envs existem): busca via REST e assina o Realtime.
- **Local** (fallback): lê o `localStorage` (`src/lib/localStore.ts`), com eventos
  entre abas.

Toda **escrita** passa por **`src/lib/adminActions.ts`**, que também detecta o modo:
- Supabase → faz `POST /api/admin/state` com o header `x-admin-slug`.
- Local → aplica a mesma lógica direto no `localStorage`.

O servidor (**`src/app/api/admin/state/route.ts`**) valida a slug
(`src/lib/auth.ts`) e grava no Supabase com a `service_role`. **A lógica do
servidor e a do modo local são espelhadas** — se mudar uma regra, mude nos dois
lugares (`route.ts` **e** `adminActions.ts`).

### Mapa de arquivos
```
src/lib/
  types.ts            # tipos (Player, Match, Config, Stage, Slot, ...)
  useTournament.ts    # hook central: dados ao vivo (Supabase ou local)
  adminActions.ts     # TODAS as ações de escrita (espelha servidor + local)
  auth.ts             # validação da slug secreta do admin
  config.ts           # dados do EVENTO (data, hora, local) e constantes
  localStore.ts       # modo local (localStorage) + jogadores semente
  supabase/client.ts  # cliente browser (anon) + URL hardcoded
  supabase/admin.ts   # cliente servidor (service_role)
  roundRobin.ts       # sorteio круг (circle method) + orderForRest (descanso)
  drawConstraints.ts  # sorteio "equilibrado" com restrições OCULTAS (backend)
  editions.ts         # edições: filtro, resumo do histórico e blindagem do remover
  standings.ts        # classificação + desempates (6 critérios) + TOP_N=6
  bracket.ts          # mata-mata Alternativa B (seed/recompute/campeão)
  scorers.ts          # artilharia + melhor defesa (gols sofridos)
  image.ts            # redimensiona foto de perfil (canvas → data URI)
  __tests__/          # testes Vitest de cada módulo acima

src/app/
  layout.tsx          # layout global (TabBar + main); TabBar some em /tv
  page.tsx            # Regulamento (home)
  participantes/      # lista de participantes com foto
  confrontos/         # tabela da liga (rodada atual no topo, encerradas embaixo)
  classificacao/      # classificação estilo GloboEsporte
  mata-mata/          # chave (organograma) + prévia ao vivo
  goleadores/         # artilharia
  historico/          # edições anteriores (lista) e /historico/<n> (edição arquivada)
  tv/                 # TELÃO: slideshow em tela cheia, auto-rotativo
  admin/page.tsx      # admin em modo LOCAL (quando ADMIN_SLUG não está setado)
  painel/[slug]/      # admin em modo Supabase (valida a slug no servidor)
  api/admin/state/    # rota de escrita (valida slug, grava com service_role)

src/components/
  TabBar.tsx          # navegação (some no /tv)
  StandingsTable.tsx  # tabela de classificação (avatar + colunas + forma)
  Bracket.tsx         # organograma do mata-mata (desktop) + fases (mobile)
  MatchRow.tsx        # linha de confronto padrão (nome+foto | placar | foto+nome)
  admin/AdminApp.tsx  # painel de admin completo
  admin/ScoreEditor.tsx # editor de placar (com pênalti só no KO/desempate)
  ui.tsx              # Avatar, PageHeader, LiveBadge, EmptyState, Loading
```

---

## 7. Formato do torneio e regras (IMPORTANTE)

### Liga
- **Turno único, todos contra todos** (round-robin, circle method).
- **Empate vale 1 ponto** — **NÃO existe pênalti nem prorrogação na liga.**
  (Pênalti só no mata-mata e na partida de desempate.)
- Classificam os **6 primeiros** (`TOP_N = 6` em `standings.ts`).

### Critérios de desempate da classificação (nesta ordem)
1. Pontos · 2. Vitórias · 3. Saldo de gols · 4. Gols marcados ·
5. **Confronto direto** · 6. **Partida de desempate** (criada pelo admin).
> Se sobrar empate **na linha do Top 6**, a classificação marca com ⚠ e o app
> **bloqueia montar o mata-mata** até o desempate ser resolvido (o painel mostra
> um alerta com atalho pra criar a partida de desempate). Ver `standings.ts`
> (`unresolvedTie`) e a checagem no `seed_bracket`.

### Mata-mata — **Alternativa B** (`bracket.ts`)
Classificam 6; **1º e 2º vão direto à semifinal**:
- **Repescagem:** `REP_A` = 4º×5º · `REP_B` = 3º×6º
- **Semifinais:** `SF_A` = 1º × venc(REP_A) · `SF_B` = 2º × venc(REP_B)
- **Final** = venc(SF_A) × venc(SF_B) · **3º lugar** = perd(SF_A) × perd(SF_B)
- Jogo único; empate → prorrogação → **pênaltis** (`pen_winner_id`).
- A chave **avança sozinha**: ao lançar cada placar, o vencedor sobe de fase
  (`recomputeBracket`). Obs.: a disputa de **3º lugar é decidida antes da final**.

### Artilheiro e melhor defesa (medalhas)
- **Artilheiro:** mais gols (`computeScorers`). **Melhor defesa:** menos gols sofridos
  (`computeDefense`, em `scorers.ts`).
- As duas usam **o mesmo filtro** (`counts_for_scorers`): **não contam W.O. nem
  desempate**. Por isso a melhor defesa **pode divergir da coluna GC** da
  classificação, que soma tudo (lá o W.O. precisa valer, porque decide pontos).
  Isso é intencional e está escrito no regulamento e na tela.
- Desempate: artilharia → menos jogos; defesa → mais jogos. Quem não jogou não entra
  no ranking de defesa.
- Aparecem em `/goleadores`, no telão (slide próprio) e no "copiar mensagem pro grupo"
  (junto com a lanterna).

### Desistência / W.O. (`withdraw`)
- A desistência fica **marcada no participante** (`players.withdrawn`), não só nos
  jogos: qualquer partida que ele venha a ter — como uma semi que ainda dependia
  da repescagem — **já nasce 3×0**. Quem aplica isso é o `settle()` (servidor) /
  o laço no fim do `localAction` (local), que rodam depois de **toda** gravação:
  aplicam `walkoverUpdates` e propagam a chave até estabilizar. Ver
  `src/lib/walkover.ts` (puro, com testes).
- `reinstate` desfaz a marca; os placares 3×0 já lançados permanecem.
- Se alguém desiste, **todos os jogos dele viram W.O. 3×0 para os adversários**
  (jogos feitos e a fazer) — "desistência é vitória pra todo mundo".
- **Gols de W.O. NÃO contam para a artilharia** (`counts_for_scorers = false`).
- No mata-mata, o adversário avança.

### Sorteio equilibrado (regras OCULTAS — só no backend)
`src/lib/drawConstraints.ts` gera a tabela por **rejection sampling** até cair numa
que respeite restrições que **NÃO aparecem na plataforma** (identificadas por nome,
ignorando acento/maiúsculas):
- **Ronaldo** enfrenta **Léo** e **Riquelme** nas **3 últimas rodadas**.
- **Riquelme** enfrenta **Léo** até a **3ª rodada**.
> Essas restrições são pedido do organizador e devem permanecer **invisíveis** na UI.

### Descanso entre jogos (`orderForRest` em `roundRobin.ts`)
Como o telão roda a lista de cima pra baixo (inclusive virando a rodada), a ordem
**dentro de cada rodada** é reordenada para que **ninguém jogue no jogo
imediatamente seguinte ao seu** — de preferência com **2 jogos de folga**. Não
altera confrontos nem números de rodada (as restrições por rodada seguem valendo).
No Supabase, o `created_at` é gravado crescente para a leitura preservar essa ordem.

---

## 7-B. Edições (1ª, 2ª, ...) e o histórico

Cada torneio é uma **edição**. Toda linha de `players` e `matches` carrega o número
da edição a que pertence; o site mostra **só a edição em cartaz**
(`config.current_edition`) e as anteriores ficam em `/historico`.

- **Abrir a próxima edição** (painel → *Edição em cartaz*): a atual recebe
  `closed_at` e vira histórico (só leitura); a nova nasce zerada — sem jogos, sem
  placares — com a opção de **levar a mesma turma** (participantes novos, com foto;
  ids próprios, então mexer na nova edição nunca encosta no histórico).
- **Desfazer a abertura:** enquanto a edição nova **não tiver jogos**, o painel
  oferece voltar para a anterior (`discard_edition`). Depois do sorteio, não.
- **Data / hora / local** deixaram de ser código: ficam em `editions` e são
  editáveis no painel (`set_edition_meta`). `EVENT` em `src/lib/config.ts` virou
  apenas o **fallback** da 1ª edição.
- **Toda ação de escrita é escopada pela edição em cartaz** — sortear, zerar
  placares, W.O., montar mata-mata, importar backup. Nada alcança uma edição
  arquivada. Se mudar alguma ação, mantenha esse escopo nos **dois** lados
  (`route.ts` e `adminActions.ts`) — há testes cobrindo isso em
  `src/lib/__tests__/localEditions.test.ts`.
- **Backup (JSON):** exporta/importa **a edição em cartaz**. Um JSON com a chave
  `editions` é tratado como backup completo e restaura tudo.
- **Banco sem a migração:** o app detecta e roda como antes (uma edição só), para
  não quebrar entre o deploy e o `supabase-schema.sql`. As ações de edição avisam
  que falta rodar a migração.

---

## 8. Painel de admin

- **Acesso:** `https://<site>/painel/<ADMIN_SLUG>` (sem senha — **quem tem o link
  administra**). A slug fica na env `ADMIN_SLUG` (na Vercel). Se `ADMIN_SLUG` não
  estiver setada, o admin fica em `/admin` (modo local).
- **O que dá pra fazer:** salvar nome do torneio; adicionar/remover participantes
  e **fotos**; **sortear confrontos**; **montar mata-mata (Top 6)**; lançar
  placares (liga, desempate, mata-mata); registrar **desistência (W.O.)**;
  **zerar todos os placares**; encerrar/reabrir; **exportar/importar JSON** (backup).
- **Remover participante (blindado):** remover apaga também **todos os jogos** da
  pessoa. Com partidas na mesa, o painel mostra quantas somem (e quantas já têm
  placar), lembra que **Desistência (W.O.)** preserva os jogos, e só apaga após
  confirmação — com **Desfazer** disponível. Ver `removalBlockedMessage` em
  `src/lib/editions.ts`; o servidor rejeita com **409** sem `force`.
- **Desfazer:** ações destrutivas (zerar, sortear, montar mata-mata, desistência, remover)
  tiram um "retrato" do estado antes e mostram um botão **Desfazer** que restaura
  via import de estado.
- **Copiar mensagem pro grupo:** botão que gera a classificação + artilharia
  formatada pra colar no WhatsApp (só no admin).
- **Placares — Liga** e **Confrontos**: a **rodada atual fica no topo** e as
  **encerradas descem** (chips "jogando agora" / "encerrada").

---

## 9. Telão (`/tv`)

Slideshow em tela cheia (cobre o menu). Rotaciona sozinho entre as telas que têm
conteúdo: **Classificação (12s) → Rodada atual (6s) → Mata-mata (5s) →
Artilharia (6s)**. Barra de progresso, bolinhas, relógio ao vivo.
- **Controles:** `←`/`→` navega, `espaço` pausa, `F` ou `⛶` tela cheia.
- **Atualização à prova de realtime caído:** a cada 6s (`POLL_MS`) o telão
  **rebusca os dados** do servidor via `refresh()`, independente do websocket —
  porque numa TV rodando por horas o Realtime pode cair sem avisar. Sem reload,
  sem piscar.

---

## 10. Modelo mental de "quem escreve o quê"

```
UI (admin) ──> adminActions.run(action, payload)
                     │
        ┌── Supabase modo? ──┐
        │                    │
  POST /api/admin/state   localAction() no localStorage
  (header x-admin-slug)      (mesma lógica espelhada)
        │
  route.ts valida slug ──> grava no Supabase (service_role) ──> Realtime avisa todos
```
Ações existentes: `set_config, add_player, remove_player, set_photo, reset_scores,
generate_league, save_score, create_desempate, delete_match, withdraw,
seed_bracket, close_tournament, reopen, set_edition_meta, new_edition,
discard_edition, import_state, reset_local`.

---

## 11. Linha do tempo do que foi construído (changelog)

1. App completo (páginas, liga, classificação, mata-mata, artilharia, admin).
2. Deploy na Vercel + domínio `copa-costela.vercel.app`.
3. Tema **Champions League** (azul-marinho/ciano, Manrope); layout de
   classificação/confrontos estilo GloboEsporte.
4. **Alternativa B** de mata-mata (1º e 2º direto na semi; repescagem).
5. **Sorteio aleatório** (Fisher-Yates) + **restrições ocultas** de confronto.
6. Regra de **desistência = W.O. 3×0** (gol de W.O. não conta na artilharia).
7. **Fotos** de perfil (upload no admin, redimensionadas no cliente).
8. **URL secreta** de admin (slug) + escrita ao vivo via Supabase.
9. Ajustes de UX: espaçamento, opacidade das linhas, "zerar placares".
10. **Mata-mata em organograma** (troféu ao centro) + **fotos** na chave; layout
    idêntico ao dos Confrontos via `MatchRow` compartilhado.
11. **Foto nos Goleadores** (unificado com a classificação).
12. **Descanso entre jogos** no sorteio (`orderForRest`).
13. Correções de admin: **liga sem pênalti**, **botão Desfazer**, **desempate no
    corte do Top 6** (bloqueia montar mata-mata), **min=0** nos placares,
    **copiar mensagem pro grupo**.
14. **Confrontos e Placares—Liga:** rodada atual no topo, encerradas embaixo.
15. **Telão `/tv`**: slideshow auto-rotativo, durações por tela, polling de 6s.
16. **Edições + histórico**: `editions` no banco, `edition` em players/matches,
    arquivar/abrir edição no painel, `/historico` e `/historico/<n>` (pódio,
    classificação final, chave e artilharia), dados do evento editáveis no painel.
17. **Blindagem do "Remover participante"** (o footgun do incidente do Mosquito).
18. **Medalhas de artilheiro e melhor defesa** (2ª edição): `computeDefense`, tabela em
    `/goleadores`, slide no telão, lanterna + defesa na mensagem do grupo e no histórico.

---

## 12. ⚠️ Incidente conhecido: exclusão do "Mosquito" (LER)

**O que houve:** a liga foi sorteada com **11 jogadores** (incluindo o Mosquito).
Alguém **removeu o Mosquito** pelo painel. O botão **"Remover" apaga o participante
E TODOS os jogos dele** — então os **10 jogos do Mosquito, já com placares reais,
foram deletados de vez**. Sobraram 45 jogos (cada um dos outros 10 ficou sem o jogo
contra ele) e o Isaias ocupou a vaga. A base ficou 100% consistente, mas **sem o
Mosquito**.

**Recuperação (esgotada):** sem backup/PITR no plano grátis; os logs do Supabase
**não guardam os valores** dos comandos; não havia export anterior à exclusão. As
linhas deletadas **ainda estão fisicamente no banco** (11 "dead tuples"), mas ler
isso exige a extensão `pageinspect`, que o Supabase **só libera para superusuário**
(o papel `postgres` não é). Único caminho para o dado exato: **ticket de suporte do
Supabase** (fora do prazo do evento).

**Resolução adotada:** artilharia definida pelos jogos válidos. Recuperados de
memória: **Riquelme 18×0 Mosquito** e **Léo 9×2 Mosquito** → somando aos totais,
**Léo é o artilheiro (81 × 77 do Riquelme)** — vence contando ou não os jogos do
Mosquito. Os outros 8 jogos do Mosquito continuam perdidos.

**Lições / TODO desta história:**
- ~~**BLINDAR o botão "Remover"**~~ — **feito**: com partidas na mesa, o painel
  avisa quantas somem, aponta a **Desistência (W.O.)** como caminho certo e só
  apaga após confirmação; o servidor recusa com **409** sem `force`.
- **Habilitar backups/PITR** no Supabase antes do próximo evento.
- Existe um **backup manual** do estado pós-incidente (JSON exportado) — guardar
  sempre um export antes de qualquer ação destrutiva.

---

## 13. Pendências e próximos passos recomendados

- [x] ~~**Blindar `remove_player`**~~ — feito: avisa quantos jogos somem, sugere o
      W.O. e exige confirmação (servidor devolve 409 sem `force`).
- [ ] Confirmar/registrar oficialmente a **artilharia** (Léo campeão) — se quiser
      número exato no site, dá pra reinserir os jogos conhecidos do Mosquito, mas
      isso deixa a classificação inconsistente enquanto os outros 8 faltarem.
- [ ] **Backups automáticos** (Supabase Pro/PITR) e rotina de export JSON.
- [ ] Nice-to-have: PWA/"adicionar à tela inicial"; tempo do telão configurável por
      URL (`/tv?t=8`); animação/som ao salvar placar; card de campeão pra compartilhar.

---

## 14. Acessos e segredos (onde ficam)

- **Vercel:** deploy e env vars (`ADMIN_SLUG`, keys do Supabase). Conta do dono.
- **Supabase:** dashboard do projeto `kkquchkoqihqzwlrbqdm`. Conta do dono.
  - A **anon key** é pública (vai no bundle). A **service_role** e o **ADMIN_SLUG**
    são secretos e ficam só na Vercel/servidor.
- **A slug do admin** só o organizador conhece (é o "login" do painel).
> Nenhum segredo está commitado no repo. Rotacione keys/slug se houver suspeita de
> vazamento (e nunca cole tokens em chat/commits).

---

## 15. Dicas finais pra quem assume

- Rode `npm test` — 88 testes em `src/lib/__tests__/`. Mudou regra? Atualize o teste.
  - `rotaAdmin.test.ts` roda o **route.ts de verdade** contra um Supabase em
    memória (`helpers/fakeSupabase.ts`), que recusa coluna inexistente como o
    Postgres faria.
  - `paridade.test.ts` dá o **mesmo estado inicial e a mesma sequência** de ações
    para o servidor e para o modo local e exige resultado idêntico — é a rede que
    pega a divergência entre os dois espelhos.
  - `cenarios.test.ts` cobre o dia do evento: correção de placar, empate,
    pênaltis, desistência em vários momentos e as travas do admin.
- **Espelhe toda mudança de regra** em `route.ts` (Supabase) **e** `adminActions.ts`
  (local). É o erro mais fácil de cometer.
- Antes de qualquer ação destrutiva no dia do evento, **Exporte o JSON** (Backup).
- Pra testar visual sem afetar produção: rode local (`npm run dev`) — sem envs de
  Supabase ele usa o modo local com jogadores semente.
- O tema, cores e animações estão em `tailwind.config.ts` e `globals.css`.
- **Visual (regra da casa):** fundo `#01040A` com a foto de estádio
  (`public/estadio.jpg`) numa camada fixa em `body::before`, coberta por um
  gradiente escuro. O `body` **não** pode ter cor de fundo própria — ela taparia
  o `::before` (que usa `z-index: -1`). Todo box usa `.panel`: vidro escuro com
  `backdrop-filter: blur(16px)`. Foto de participante é **quadrada com moldura
  azul** (`.foto-frame`, `#3E9BE9`) — o "escudo"; `<Avatar round />` volta ao
  círculo onde fizer sentido.
- **Navegação:** topo com escudo à esquerda e **hambúrguer à direita**, no
  celular e no desktop (`TabBar.tsx`).
- **Tipografia (regra da casa):** `font-display` = **Sofia Sans Extra Condensed**,
  sempre em **CAIXA ALTA** — títulos, nomes de participantes, placares e tabelas.
  O `text-transform: uppercase` está uma vez só, na regra `.font-display` do
  `globals.css`, para que qualquer texto novo nessa fonte já nasça certo. Texto de
  corpo e explicações usam `font-sans` (**Manrope**), em caixa normal.

Boa sorte — e que o Léo comemore o título de artilheiro. 🏆
