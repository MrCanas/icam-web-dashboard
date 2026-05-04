import { createServiceRoleClient } from "@/lib/supabase/admin";

/**
 * Cliente de lectura para Server Components bajo /dashboard (tras auth ICAM en middleware).
 * Usa service role para leer `proyectos` aunque RLS no conceda SELECT al rol `anon` con la clave pública.
 * No importar desde componentes cliente ni rutas públicas.
 */
export function createDashboardReadClient() {
  return createServiceRoleClient();
}
