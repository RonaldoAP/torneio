import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | null = null;

// URL pública do projeto Supabase — fixa no código para evitar erro de digitação
// na variável de ambiente (a URL não é secreta; a anon key vem da env).
export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL_OVERRIDE || "https://kkquchkoqihqzwlrbqdm.supabase.co";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

/** Cliente Supabase para o browser (leitura pública + realtime). Singleton. */
export function getBrowserClient(): SupabaseClient | null {
  if (!isSupabaseConfigured) return null;
  if (!browserClient) {
    browserClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      realtime: { params: { eventsPerSecond: 10 } },
    });
  }
  return browserClient;
}
