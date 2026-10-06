import type { UserContext } from "@/lib/auth/currentUser";
import { createServiceRoleClient } from "@/lib/db/admin";

/**
 * Cliente Supabase del módulo Comunicaciones.
 *
 * Como en Inversores, NO hay variante de navegador: las tablas `com_*` guardan
 * nombres y correos de inversores y la migración 047 las deja con RLS
 * habilitada y sin política de SELECT. La única vía es el service role desde
 * servidor, tras `requireRouteAccess` o la comprobación de la Server Action.
 */
export function getComunicacionesSupabase(_ctx: UserContext) {
  void _ctx;
  if (typeof window !== "undefined") {
    throw new Error(
      "El módulo Comunicaciones no se lee desde el navegador: las tablas com_* solo son " +
        "accesibles con service role desde el servidor.",
    );
  }
  return createServiceRoleClient();
}
