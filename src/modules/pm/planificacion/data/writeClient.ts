import type { SupabaseClient } from "@supabase/supabase-js";

import type { UserContext } from "@/lib/auth/currentUser";
import { requireCurrentUser } from "@/lib/auth/currentUser";
import { checkWriteAccess } from "@/lib/auth/permissions";
import { getPmWriteSupabase } from "@/modules/pm/data/readClient";

export type PmWriteClientResult =
  | { ok: true; client: SupabaseClient; user: UserContext }
  | { ok: false; error: string };

/**
 * Cliente service role para mutaciones de Planificación, tras validar sesión
 * ICAM + permiso de escritura en la zona PM.
 *
 * Mismo criterio que requireActasWriteSupabase: evita el bridge JWT
 * (generateLink + verifyOtp) en cada Server Action, crítico por latencia en
 * Vercel. Las tablas pm_* solo tienen policies de SELECT público, así que la
 * escritura va por service role con el permiso comprobado aquí.
 */
export async function requirePmWriteSupabase(): Promise<PmWriteClientResult> {
  const user = await requireCurrentUser();
  const denied = checkWriteAccess(user, "pm");
  if (denied) {
    return { ok: false, error: denied };
  }

  return { ok: true, client: getPmWriteSupabase(user), user };
}
