import type { UserContext } from "@/lib/auth/currentUser";
import { createServiceRoleClient } from "@/lib/db/admin";
import { createClient as createBrowserClient } from "@/lib/db/client";
import { createClient as createServerClient } from "@/lib/db/server";

/** Read client for dashboard / browser (service role when configured on server). */
export async function getPortfolioReadSupabase(_ctx: UserContext) {
  void _ctx;
  if (typeof window !== "undefined") {
    return createBrowserClient();
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (url && serviceKey) {
    return createServiceRoleClient();
  }
  return createServerClient();
}

/** Writes and RPCs (upload, replace) — service role. */
export function getPortfolioWriteSupabase(_ctx: UserContext) {
  void _ctx;
  return createServiceRoleClient();
}
