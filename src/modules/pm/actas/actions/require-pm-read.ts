import { requireCurrentUser, type UserContext } from "@/lib/auth/currentUser";
import { hasZoneAccess } from "@/lib/auth/permissions";

/**
 * Sesión + acceso a la zona PM para las acciones de LECTURA de actas.
 *
 * Estas acciones leen con el cliente service role (salta RLS), así que sin este
 * corte cualquier usuario del portal —aunque no tenga la zona PM— podía leer
 * todas las actas invocando la Server Action directamente. La escritura ya tenía
 * su propio guard (requireActasWriteSupabase); esto cierra la lectura.
 */
export async function requirePmReadContext(): Promise<
  { ok: true; ctx: UserContext } | { ok: false; error: string }
> {
  const ctx = await requireCurrentUser();
  if (!hasZoneAccess(ctx, "pm")) {
    return { ok: false, error: "Sin acceso a la zona PM" };
  }
  return { ok: true, ctx };
}
