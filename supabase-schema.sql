-- ============================================================================
--  Torneio FIFA 26 — Schema Supabase (Postgres + Realtime + RLS)
-- ============================================================================
--  Como usar:
--    1. Crie um projeto no Supabase.
--    2. Abra o SQL Editor e cole/rode este arquivo inteiro.
--    3. As tabelas ficam com leitura pública (anon) e escrita bloqueada por RLS.
--       As gravações são feitas pelas rotas /api/admin usando a service_role key,
--       que ignora o RLS (por isso essa chave nunca pode ir para o browser).
-- ============================================================================

-- Extensão para uuid
create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- ENUMs
-- ----------------------------------------------------------------------------
do $$ begin
  create type match_stage as enum ('liga','quartas','semi','final','terceiro','desempate');
exception when duplicate_object then null; end $$;

do $$ begin
  create type tournament_phase as enum ('liga','mata_mata','encerrado');
exception when duplicate_object then null; end $$;

-- ----------------------------------------------------------------------------
-- TABELAS
-- ----------------------------------------------------------------------------
create table if not exists players (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_at timestamptz not null default now()
);

create table if not exists matches (
  id                uuid primary key default gen_random_uuid(),
  stage             match_stage not null default 'liga',
  round             int,                       -- nº da rodada da liga; null no mata-mata
  home_id           uuid references players(id) on delete cascade,
  away_id           uuid references players(id) on delete cascade,
  home_goals        int,                       -- null = ainda não jogado
  away_goals        int,
  pen_winner_id     uuid references players(id) on delete set null,
  counts_for_scorers boolean not null default true,
  slot              text,                      -- QF1..QF4, SF_A, SF_B, FINAL, TERCEIRO
  created_at        timestamptz not null default now()
);

create index if not exists matches_stage_idx on matches(stage);
create index if not exists matches_round_idx on matches(round);
create index if not exists matches_slot_idx  on matches(slot);

create table if not exists config (
  id              int primary key default 1,
  tournament_name text not null default 'Torneio FIFA 26',
  phase           tournament_phase not null default 'liga',
  bracket_seeded  boolean not null default false,
  constraint config_singleton check (id = 1)
);

-- garante a linha única de config
insert into config (id) values (1) on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- RLS: leitura pública anônima; escrita bloqueada (só service_role grava)
-- ----------------------------------------------------------------------------
alter table players enable row level security;
alter table matches enable row level security;
alter table config  enable row level security;

-- Limpa policies antigas (idempotente)
drop policy if exists "public read players" on players;
drop policy if exists "public read matches" on matches;
drop policy if exists "public read config"  on config;

create policy "public read players" on players for select using (true);
create policy "public read matches" on matches for select using (true);
create policy "public read config"  on config  for select using (true);

-- Sem policies de INSERT/UPDATE/DELETE para anon/authenticated => escrita negada.
-- A service_role key (usada no servidor) ignora o RLS e faz as gravações.

-- ----------------------------------------------------------------------------
-- REALTIME: publica mudanças destas tabelas
-- ----------------------------------------------------------------------------
do $$ begin
  alter publication supabase_realtime add table players;
exception when duplicate_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table matches;
exception when duplicate_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table config;
exception when duplicate_object then null; end $$;

-- Necessário para receber os valores antigos em UPDATE/DELETE via realtime
alter table players replica identity full;
alter table matches replica identity full;
alter table config  replica identity full;
