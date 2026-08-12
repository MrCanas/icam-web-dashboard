/**
 * ¿El error es «la tabla no existe»? Ocurre cuando una migración aún no se ha
 * aplicado: PostgREST devuelve PGRST205 («Could not find the table … in the
 * schema cache») y Postgres directo 42P01 (undefined_table).
 *
 * Los lectores de tablas OPCIONALES (features detrás de una migración) deben
 * tratar esto como «feature no disponible», no como error fatal: una pantalla
 * que ya funcionaba no puede romperse porque una migración posterior no esté.
 */
export function isMissingTableError(
  error: { code?: string | null; message?: string | null } | null | undefined,
): boolean {
  if (!error) return false;
  if (error.code === "PGRST205" || error.code === "42P01") return true;
  const msg = error.message ?? "";
  return msg.includes("Could not find the table") && msg.includes("schema cache");
}
