import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import {
  getSupabaseServiceRoleKey,
  getSupabaseUrl,
  loadActasEnv,
} from "./env";

/**
 * Cliente Supabase con service_role — scripts, migraciones de datos, bypass RLS.
 * No usar en componentes cliente ni en el navegador.
 */
export function createActasServerClient(): SupabaseClient {
  loadActasEnv();
  return createClient(getSupabaseUrl(), getSupabaseServiceRoleKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
