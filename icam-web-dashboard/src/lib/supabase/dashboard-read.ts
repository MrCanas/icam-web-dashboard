import { createServiceRoleClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Cliente de lectura para Server Components bajo /dashboard (tras auth ICAM en middleware).
 * Si existe `SUPABASE_SERVICE_ROLE_KEY`, usa service role (lee `proyectos` con RLS omitido).
 * Si no (p. ej. Vercel sin la variable), usa el cliente SSR con anon para evitar 500; puede devolver 0 filas según RLS.
 */
export async function createDashboardReadClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (url && serviceKey) {
    return createServiceRoleClient();
  }
  return createClient();
}
