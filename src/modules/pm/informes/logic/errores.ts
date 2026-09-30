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

export function mensajeErrorBd(error: ErrorBd): string {
  return esTablaInexistente(error) ? MENSAJE_SIN_MIGRACION : (error.message ?? "Error de base de datos");
}
