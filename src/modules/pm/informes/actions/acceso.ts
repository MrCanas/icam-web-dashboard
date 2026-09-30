import { getCurrentUser, type UserContext } from "@/lib/auth/currentUser";
import { canAccessRouteKey, checkWriteAccess } from "@/lib/auth/permissions";

/**
 * Permisos de los informes: cualquier rol de pm con la página pm.informes
 * puede ver; generar, corregir, subir fotos, aprobar y borrar exige editor o
 * admin de pm.
 */
export async function usuarioLectura(): Promise<{ user: UserContext } | { error: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "Tu sesión ha caducado: vuelve a entrar." };
  if (!canAccessRouteKey(user, "pm.informes")) return { error: "No tienes acceso a los informes trimestrales." };
  return { user };
}

export async function usuarioEscritura(): Promise<{ user: UserContext } | { error: string }> {
  const r = await usuarioLectura();
  if ("error" in r) return r;
  const denegado = checkWriteAccess(r.user, "pm");
  if (denegado) return { error: "Tu acceso a Proyectos es de lectura: puedes consultar informes, pero no generarlos ni modificarlos." };
  return r;
}

/** Para la UI: ¿puede este usuario modificar informes? */
export function puedeEditarInformes(user: UserContext): boolean {
  return canAccessRouteKey(user, "pm.informes") && checkWriteAccess(user, "pm") === null;
}
