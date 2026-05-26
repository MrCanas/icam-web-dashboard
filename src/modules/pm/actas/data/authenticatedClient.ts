import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { issueSupabaseTokenForIcamSession } from "@/lib/auth/issue-supabase-token";

function getPublicConfig(): { url: string; anonKey: string } | null {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    process.env.SUPABASE_URL?.trim();
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    process.env.SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey) return null;
  return { url, anonKey };
}

/**
 * Cliente Supabase con JWT del bridge ICAM (rol authenticated).
 * Necesario para INSERT/UPDATE sujetos a RLS (`auth.uid()` = author_id).
 */
export async function getActasAuthenticatedSupabase(): Promise<
  | { client: SupabaseClient; error: null }
  | { client: null; error: string }
> {
  const config = getPublicConfig();
  if (!config) {
    return { client: null, error: "Configuración Supabase incompleta" };
  }

  const tokenResult = await issueSupabaseTokenForIcamSession();
  if (!tokenResult.ok) {
    return { client: null, error: tokenResult.error };
  }

  const client = createClient(config.url, config.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: { Authorization: `Bearer ${tokenResult.access_token}` },
    },
  });

  return { client, error: null };
}
