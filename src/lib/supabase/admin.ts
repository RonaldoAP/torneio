import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "./client";

/**
 * Cliente Supabase para o SERVIDOR usando a service_role key.
 * Ignora o RLS — use APENAS dentro das rotas /api/admin já protegidas pelo slug.
 * NUNCA importe isto em componentes client.
 */
export function getAdminClient(): SupabaseClient {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !serviceKey) {
    throw new Error("Supabase não configurado: defina SUPABASE_SERVICE_ROLE_KEY.");
  }
  return createClient(SUPABASE_URL, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
