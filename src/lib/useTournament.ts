"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Config, Edition, Match, Player, TournamentState } from "./types";
import { getBrowserClient, isSupabaseConfigured } from "./supabase/client";
import { readLocal, migrateSeed, LOCAL_EVENT } from "./localStore";
import { FIRST_EDITION, forEdition } from "./editions";

export type DataMode = "supabase" | "local";

export interface UseTournamentResult extends TournamentState {
  loading: boolean;
  mode: DataMode;
  connected: boolean;
  refresh: () => Promise<void>;
  /** número da edição exibida */
  edition: number;
  /** metadados da edição exibida (data/hora/local do evento) */
  editionInfo: Edition | null;
  editions: Edition[];
}

export interface UseTournamentOptions {
  /** Fixa uma edição (usado no histórico). Sem isso, mostra a edição em cartaz. */
  edition?: number;
}

const EMPTY_CONFIG: Config = {
  id: 1,
  tournament_name: "Copa Costela",
  phase: "liga",
  bracket_seeded: false,
  current_edition: FIRST_EDITION,
};

/** Lê uma tabela filtrando por edição; se o banco ainda não tem a coluna
 *  (migração pendente), cai para a leitura sem filtro — o site não quebra. */
async function selectByEdition(
  supabase: NonNullable<ReturnType<typeof getBrowserClient>>,
  table: "players" | "matches",
  edition: number,
) {
  const base = () => supabase.from(table).select("*").order("created_at", { ascending: true });
  const filtered = await base().eq("edition", edition);
  if (!filtered.error) return filtered.data ?? [];
  const all = await base();
  return all.data ?? [];
}

/**
 * Hook central: carrega jogadores/partidas/config e mantém tudo AO VIVO.
 * - Modo Supabase: subscriptions de Postgres changes (Realtime).
 * - Modo local: fallback em localStorage com eventos entre abas.
 * Sempre restrito a UMA edição: a que está em cartaz, ou a pedida em `options`.
 */
export function useTournament(options?: UseTournamentOptions): UseTournamentResult {
  const wanted = options?.edition;
  const mode: DataMode = isSupabaseConfigured ? "supabase" : "local";
  const [players, setPlayers] = useState<Player[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [config, setConfig] = useState<Config>(EMPTY_CONFIG);
  const [editions, setEditions] = useState<Edition[]>([]);
  const [edition, setEdition] = useState<number>(wanted ?? FIRST_EDITION);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const mounted = useRef(true);

  const fetchSupabase = useCallback(async () => {
    const supabase = getBrowserClient();
    if (!supabase) return;
    const c = await supabase.from("config").select("*").eq("id", 1).maybeSingle();
    const cfg = { ...EMPTY_CONFIG, ...((c.data as Config) ?? {}) };
    const ed = wanted ?? cfg.current_edition ?? FIRST_EDITION;

    const [p, m, e] = await Promise.all([
      selectByEdition(supabase, "players", ed),
      selectByEdition(supabase, "matches", ed),
      supabase.from("editions").select("*").order("id", { ascending: true }),
    ]);
    if (!mounted.current) return;
    setConfig(cfg);
    setEdition(ed);
    setPlayers(p as Player[]);
    setMatches(m as Match[]);
    setEditions(e.error ? [] : ((e.data as Edition[]) ?? []));
    setLoading(false);
  }, [wanted]);

  const loadLocal = useCallback(() => {
    const s = readLocal();
    const ed = wanted ?? s.config.current_edition ?? FIRST_EDITION;
    setConfig(s.config);
    setEdition(ed);
    setPlayers(forEdition(s.players, ed));
    setMatches(forEdition(s.matches, ed));
    setEditions(s.editions ?? []);
    setLoading(false);
    setConnected(true);
  }, [wanted]);

  const refresh = useCallback(async () => {
    if (mode === "supabase") await fetchSupabase();
    else loadLocal();
  }, [mode, fetchSupabase, loadLocal]);

  useEffect(() => {
    mounted.current = true;

    if (mode === "local") {
      migrateSeed(); // atualiza a lista de confirmados em quem já abriu o site
      loadLocal();
      const handler = () => loadLocal();
      window.addEventListener(LOCAL_EVENT, handler);
      window.addEventListener("storage", handler);
      return () => {
        mounted.current = false;
        window.removeEventListener(LOCAL_EVENT, handler);
        window.removeEventListener("storage", handler);
      };
    }

    // ---- Supabase realtime ----
    const supabase = getBrowserClient();
    if (!supabase) return;
    fetchSupabase();

    const channel = supabase
      .channel("torneio-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "players" }, () =>
        fetchSupabase(),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, () =>
        fetchSupabase(),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "config" }, () =>
        fetchSupabase(),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "editions" }, () =>
        fetchSupabase(),
      )
      .subscribe((status) => {
        if (mounted.current) setConnected(status === "SUBSCRIBED");
      });

    return () => {
      mounted.current = false;
      supabase.removeChannel(channel);
    };
  }, [mode, fetchSupabase, loadLocal]);

  return {
    players,
    matches,
    config,
    editions,
    edition,
    editionInfo: editions.find((e) => e.id === edition) ?? null,
    loading,
    mode,
    connected,
    refresh,
  };
}

/** Lista de edições (para o menu e a página de histórico), sem carregar jogos. */
export function useEditions(): { editions: Edition[]; current: number; loading: boolean } {
  const [editions, setEditions] = useState<Edition[]>([]);
  const [current, setCurrent] = useState<number>(FIRST_EDITION);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    if (!isSupabaseConfigured) {
      const load = () => {
        const s = readLocal();
        if (!alive) return;
        setEditions(s.editions ?? []);
        setCurrent(s.config.current_edition ?? FIRST_EDITION);
        setLoading(false);
      };
      load();
      window.addEventListener(LOCAL_EVENT, load);
      window.addEventListener("storage", load);
      return () => {
        alive = false;
        window.removeEventListener(LOCAL_EVENT, load);
        window.removeEventListener("storage", load);
      };
    }

    const supabase = getBrowserClient();
    if (!supabase) return;
    (async () => {
      const [e, c] = await Promise.all([
        supabase.from("editions").select("*").order("id", { ascending: true }),
        supabase.from("config").select("current_edition").eq("id", 1).maybeSingle(),
      ]);
      if (!alive) return;
      setEditions(e.error ? [] : ((e.data as Edition[]) ?? []));
      setCurrent(((c.data as any)?.current_edition as number) ?? FIRST_EDITION);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, []);

  return { editions, current, loading };
}
