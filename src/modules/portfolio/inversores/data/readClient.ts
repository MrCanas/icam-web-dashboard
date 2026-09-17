import type { UserContext } from "@/lib/auth/currentUser";
import { createServiceRoleClient } from "@/lib/db/admin";

/**
 * Clientes Supabase del área Inversores.
 *
 * Como en corporativo, aquí NO hay variante de navegador. Las tablas `inv_*`
 * guardan nombres, correos, teléfonos y patrimonio de los inversores, y la
 * migración 040 las deja con RLS habilitada y sin política de SELECT: ni `anon`
 * ni `authenticated` las leen. La única vía es el service role desde servidor,
 * y la pestaña entera se sirve desde Server Components tras pasar por
 * `requireRouteAccess("portfolio.inversores")`.
 *
 * Si algún día hiciera falta leer desde el navegador, el camino correcto es una
 * route handler que valide sesión Y route key, no abrir la tabla en RLS.
 */
export function getInversoresReadSupabase(_ctx: UserContext) {
  void _ctx;
  if (typeof window !== "undefined") {
    throw new Error(
      "El área Inversores no se lee desde el navegador: las tablas inv_* solo son " +
        "accesibles con service role desde Server Components.",
    );
  }
  return createServiceRoleClient();
}

/** Escrituras del sync — service role. */
export function getInversoresWriteSupabase(_ctx: UserContext) {
  void _ctx;
  return createServiceRoleClient();
}
