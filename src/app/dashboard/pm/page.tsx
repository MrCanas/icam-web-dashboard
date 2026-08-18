import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/currentUser";
import { hasZoneAccess } from "@/lib/auth/permissions";
import { firstAccessiblePath } from "@/lib/auth/zone-access";
import {
  fetchPmProjectNavItems,
  type PmProjectNavItem,
} from "@/modules/pm/data/pmRepository";
import { pmLandingPath } from "@/modules/pm/logic/pm-landing";

/**
 * /dashboard/pm no tiene contenido propio: aterriza donde aterrizaría la
 * pestaña «Proyectos» (primer proyecto activo, o la primera página visible).
 */
export default async function Page() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  let projects: PmProjectNavItem[] = [];
  if (hasZoneAccess(user, "pm")) {
    try {
      projects = await fetchPmProjectNavItems(user);
    } catch {
      // degrada al aterrizaje sin proyectos
    }
  }

  redirect(
    pmLandingPath(user, projects) ?? firstAccessiblePath(user) ?? "/sin-acceso",
  );
}
