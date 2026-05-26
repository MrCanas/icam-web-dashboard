import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { getSupabaseAnonKey, getSupabaseUrl, loadActasEnv } from "./env";

/**
 * Cliente Supabase con anon key — mismo rol que el frontend (respeta RLS).
 */
export function createActasAnonClient(): SupabaseClient {
  loadActasEnv();
  return createClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
