"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Config, Match, Player, TournamentState } from "./types";
import { getBrowserClient, isSupabaseConfigured } from "./supabase/client";
import { readLocal, LOCAL_EVENT } from "./localStore";

export type DataMode = "supabase" | "local";

export interface UseTournamentResult extends TournamentState {
  loading: boolean;
  mode: DataMode;
  connected: boolean;
  refresh: () => Promise<void>;
}

const EMPTY_CONFIG: Config = {
  id: 1,
  tournament_name: "Torneio FIFA 26",
  phase: "liga",
  bracket_seeded: false,
};

/**
 * Hook central: carrega jogadores/partidas/config e mantém tudo AO VIVO.
 * - Modo Supabase: subscriptions de Postgres changes (Realtime).
 * - Modo local: fallback em localStorage com eventos entre abas.
 */
export function useTournament(): UseTournamentResult {
  const mode: DataMode = isSupabaseConfigured ? "supabase" : "local";
  const [players, setPlayers] = useState<Player[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [config, setConfig] = useState<Config>(EMPTY_CONFIG);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const mounted = useRef(true);

  const fetchSupabase = useCallback(async () => {
    const supabase = getBrowserClient();
    if (!supabase) return;
    const [p, m, c] = await Promise.all([
      supabase.from("players").select("*").order("created_at", { ascending: true }),
      supabase.from("matches").select("*").order("created_at", { ascending: true }),
      supabase.from("config").select("*").eq("id", 1).maybeSingle(),
    ]);
    if (!mounted.current) return;
    if (p.data) setPlayers(p.data as Player[]);
    if (m.data) setMatches(m.data as Match[]);
    if (c.data) setConfig(c.data as Config);
    setLoading(false);
  }, []);

  const loadLocal = useCallback(() => {
    const s = readLocal();
    setPlayers(s.players);
    setMatches(s.matches);
    setConfig(s.config);
    setLoading(false);
    setConnected(true);
  }, []);

  const refresh = useCallback(async () => {
    if (mode === "supabase") await fetchSupabase();
    else loadLocal();
  }, [mode, fetchSupabase, loadLocal]);

  useEffect(() => {
    mounted.current = true;

    if (mode === "local") {
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
      .subscribe((status) => {
        if (mounted.current) setConnected(status === "SUBSCRIBED");
      });

    return () => {
      mounted.current = false;
      supabase.removeChannel(channel);
    };
  }, [mode, fetchSupabase, loadLocal]);

  return { players, matches, config, loading, mode, connected, refresh };
}
