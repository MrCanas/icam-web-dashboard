import type { UserContext } from "@/lib/auth/currentUser";
import { getPmReadSupabase } from "@/modules/pm/data/readClient";

/** Lecturas Actas — mismo selector Supabase que PM / Portfolio. */
export async function getActasReadSupabase(ctx: UserContext) {
  return getPmReadSupabase(ctx);
}
