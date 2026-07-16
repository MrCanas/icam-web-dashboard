import { redirect } from "next/navigation";

import { getCurrentUser, type UserContext } from "@/lib/auth/currentUser";
import { canAccessRouteKey } from "@/lib/auth/permissions";
import { firstAccessiblePath } from "@/lib/auth/zone-access";

/**
 * Guard de servidor para las page shells del registry: exige sesión y que la
 * página (`ModuleRoute.key`) no esté denegada para el usuario.
 *
 * DashboardNav y DashboardZoneGuard hacen lo mismo en cliente, pero eso es UX:
 * este es el corte que un usuario no puede saltarse escribiendo la URL.
 */
export async function requireRouteAccess(
  routeKey: string,
): Promise<UserContext> {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  if (!canAccessRouteKey(user, routeKey)) {
    redirect(firstAccessiblePath(user) ?? "/sin-acceso");
  }

  return user;
}
