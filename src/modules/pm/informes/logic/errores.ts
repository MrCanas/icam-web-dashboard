/**
 * Errores de Supabase que ve la PM. El caso que más confunde es el de las
 * tablas que aún no existen (migración 043 sin aplicar): PostgREST responde
 * «Could not find the table … in the schema cache» (PGRST205).
 */

interface ErrorBd {
  code?: string | null;
  message?: string | null;
}

export const MENSAJE_SIN_MIGRACION =
  "Las tablas de informes todavía no existen en la base de datos: falta aplicar la migración 043 " +
  "(npm run pm:apply-migration-043 -- --apply).";

export function esTablaInexistente(error: ErrorBd | null | undefined): boolean {
  if (!error) return false;
  return (
    error.code === "PGRST205" ||
    error.code === "42P01" ||
    /could not find the table|does not exist/i.test(error.message ?? "")
  );
}

export const MENSAJE_SIN_MIGRACION_044 =
  "La base de datos todavía no admite el apartado «No reportar»: falta aplicar la migración 044 " +
  "(npm run pm:apply-migration-044 -- --apply).";

/** La restricción de tipos de informe_fuente rechaza «no_reportar» hasta que se aplica la 044. */
export function esTipoFuenteNoAdmitido(error: ErrorBd | null | undefined): boolean {
  return error?.code === "23514" && /informe_fuente_tipo_chk/.test(error.message ?? "");
}

export function mensajeErrorBd(error: ErrorBd): string {
  if (esTablaInexistente(error)) return MENSAJE_SIN_MIGRACION;
  if (esTipoFuenteNoAdmitido(error)) return MENSAJE_SIN_MIGRACION_044;
  return error.message ?? "Error de base de datos";
}
