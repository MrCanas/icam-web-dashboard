import type { UserContext } from "@/lib/auth/currentUser";
import { visibleRoutesForZone } from "@/lib/auth/permissions";
import type { PmProjectNavItem } from "@/modules/pm/data/pmRepository";

/**
 * Destino de aterrizaje de la zona Proyectos, compartido por la pestaña
 * primaria de DashboardNav y el redirect de /dashboard/pm: el primer proyecto
 * activo si lo hay (y pm.detalle no está denegado, que es la key que gobierna
 * proyecto/*), si no la primera página visible no oculta de la nav.
 *
 * null solo si el usuario no ve ninguna página de la zona.
 */
export function pmLandingPath(
  user: UserContext,
  pmProjects: PmProjectNavItem[],
): string | null {
  const visible = visibleRoutesForZone(user, "pm");
  if (visible.length === 0) return null;

  if (pmProjects.length > 0 && visible.some((r) => r.key === "pm.detalle")) {
    return `/dashboard/pm/proyecto/${encodeURIComponent(pmProjects[0]!.idActivo)}`;
  }

  return (visible.find((r) => !r.hiddenInNav) ?? visible[0]!).path;
}
