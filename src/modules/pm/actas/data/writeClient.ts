import type { UserContext } from "@/lib/auth/currentUser";
import { requireCurrentUser } from "@/lib/auth/currentUser";
import { checkWriteAccess } from "@/lib/auth/permissions";
import { getPmWriteSupabase } from "@/modules/pm/data/readClient";
import type { SupabaseClient } from "@supabase/supabase-js";

export type ActasWriteClientResult =
  | { ok: true; client: SupabaseClient; user: UserContext }
  | { ok: false; error: string };

/**
 * Cliente service role para mutaciones Actas tras validar sesión ICAM + escritura PM.
 * Evita el bridge JWT (generateLink + verifyOtp) en cada Server Action — crítico en Vercel.
 */
export async function requireActasWriteSupabase(): Promise<ActasWriteClientResult> {
  const user = await requireCurrentUser();
  const denied = checkWriteAccess(user, "pm");
  if (denied) {
    return { ok: false, error: denied };
  }

  return { ok: true, client: getPmWriteSupabase(user), user };
}
