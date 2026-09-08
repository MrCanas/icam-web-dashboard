import type { UserContext } from "@/lib/auth/currentUser";
import { createServiceRoleClient } from "@/lib/db/admin";

/**
 * Clientes Supabase del módulo corporativo.
 *
 * A diferencia de `getPortfolioReadSupabase`, aquí NO hay variante de navegador.
 * `corp_periodos` es la cuenta de resultados del grupo y la migración 038 la deja
 * con RLS habilitada y sin política de SELECT: ni `anon` ni `authenticated` la
 * leen. La única vía es el service role desde servidor, y el tab entero se sirve
 * desde Server Components tras pasar por `requireRouteAccess`.
 *
 * Si algún día hiciera falta leer desde el navegador, el camino correcto es una
 * route handler que valide la sesión, no abrir la tabla en RLS.
 */
export function getCorporativoReadSupabase(_ctx: UserContext) {
  void _ctx;
  if (typeof window !== "undefined") {
    throw new Error(
      "El módulo corporativo no se lee desde el navegador: corp_periodos solo es accesible " +
        "con service role desde Server Components.",
    );
  }
  return createServiceRoleClient();
}

/** Escrituras y RPC (carga del maestro) — service role. */
export function getCorporativoWriteSupabase(_ctx: UserContext) {
  void _ctx;
  return createServiceRoleClient();
}
