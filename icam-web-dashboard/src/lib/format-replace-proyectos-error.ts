const SCHEMA_CACHE_HINT =
  "En Supabase → SQL Editor, ejecuta el archivo completo icam-web-dashboard/scripts/supabase/replace_proyectos.sql (incluye NOTIFY al final). Luego espera un minuto o reinicia el dev server y vuelve a confirmar.";

/**
 * Mensaje más claro cuando falla el RPC replace_proyectos (p. ej. PostgREST no ve la función).
 */
export function formatReplaceProyectosRpcError(raw: string): string {
  const lower = raw.toLowerCase();
  if (
    lower.includes("could not find the function") &&
    lower.includes("replace_proyectos")
  ) {
    return `La función RPC replace_proyectos no está en el proyecto Supabase o PostgREST aún no la ha cargado. ${SCHEMA_CACHE_HINT}`;
  }
  if (lower.includes("schema cache") && lower.includes("replace_proyectos")) {
    return `PostgREST no encuentra replace_proyectos en la caché de esquema. ${SCHEMA_CACHE_HINT}`;
  }
  return raw;
}
