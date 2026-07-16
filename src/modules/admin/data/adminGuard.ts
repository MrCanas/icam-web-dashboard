import { requireCurrentUser, type UserContext } from "@/lib/auth/currentUser";
import { checkPlatformAdmin } from "@/lib/auth/permissions";

/**
 * Gate único de la gestión de usuarios. Las Server Actions son alcanzables por
 * POST directo, no solo desde la UI, así que toda action de este módulo debe
 * empezar por aquí — el filtrado de nav y los redirects son solo UX.
 */
export async function requireAdminContext(): Promise<
  { ok: true; ctx: UserContext } | { ok: false; error: string }
> {
  const ctx = await requireCurrentUser();
  const denied = checkPlatformAdmin(ctx);
  if (denied) return { ok: false, error: denied };
  return { ok: true, ctx };
}
