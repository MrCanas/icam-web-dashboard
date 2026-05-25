import type { UserContext } from "@/lib/auth/currentUser";
import { createServiceRoleClient } from "@/lib/db/admin";
import { getPortfolioReadSupabase } from "@/modules/portfolio/data/readClient";

/** PM dashboard reads use the same Supabase selection as portfolio. */
export async function getPmReadSupabase(ctx: UserContext) {
  return getPortfolioReadSupabase(ctx);
}

export function getPmWriteSupabase(_ctx: UserContext) {
  void _ctx;
  return createServiceRoleClient();
}
