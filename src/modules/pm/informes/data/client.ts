import type { UserContext } from "@/lib/auth/currentUser";
import { createServiceRoleClient } from "@/lib/db/admin";

export const INFORMES_FOTOS_BUCKET = "informes-fotos";

/**
 * Las tablas informe_* tienen RLS sin políticas (migración 043): solo se leen y
 * escriben con service role, desde route handlers que ya han comprobado la
 * zona pm. Mismo patrón que corporativo/data/readClient.ts.
 */
export function getInformesSupabase(_ctx: UserContext) {
  void _ctx;
  if (typeof window !== "undefined") {
    throw new Error("getInformesSupabase solo puede usarse en el servidor");
  }
  return createServiceRoleClient();
}
