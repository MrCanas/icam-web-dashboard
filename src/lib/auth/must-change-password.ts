import { createServiceRoleClient } from "@/lib/db/admin";

/**
 * ¿Tiene el usuario que cambiar la contraseña antes de seguir? Lo marca un
 * admin desde /dashboard/admin/usuarios y lo limpia /api/account/password.
 *
 * Ante un error de lectura devuelve false: un fallo aquí no debe dejar a
 * nadie fuera del portal.
 */
export async function mustChangePassword(userId: string): Promise<boolean> {
  const admin = createServiceRoleClient();
  const { data, error } = await admin
    .from("app_user_password")
    .select("must_change_password")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    console.error("[auth] must_change_password", error.message);
    return false;
  }
  return data?.must_change_password === true;
}
