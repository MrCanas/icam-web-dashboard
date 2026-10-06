import { getCurrentUser, type UserContext } from "@/lib/auth/currentUser";
import { canAccessRouteKey, checkWriteAccess, getUserRole } from "@/lib/auth/permissions";
import type { RolZona } from "@/modules/comunicaciones/logic/controles";
import { ZONA_COMUNICACIONES } from "@/modules/comunicaciones/logic/paths";

/**
 * El corte de permisos que repite cada Server Action del módulo.
 *
 * Una acción es alcanzable por POST directo, no solo desde su botón, así que
 * ninguna da por hecho que quien la llama pasó por la página. Devuelven el
 * usuario o el mensaje de por qué no.
 *
 * Fuera de los ficheros `"use server"` a propósito: allí solo se pueden exportar
 * acciones.
 */

export async function usuarioConLectura(routeKey: string): Promise<UserContext | string> {
  const user = await getCurrentUser();
  if (!user) return "Sesión no válida.";
  if (!canAccessRouteKey(user, routeKey)) return "Sin acceso a Comunicaciones.";
  return user;
}

export async function usuarioConEscritura(routeKey: string): Promise<UserContext | string> {
  const user = await usuarioConLectura(routeKey);
  if (typeof user === "string") return user;
  return checkWriteAccess(user, ZONA_COMUNICACIONES) ?? user;
}

export function rolEnLaZona(user: UserContext): RolZona {
  return getUserRole(user, ZONA_COMUNICACIONES);
}
