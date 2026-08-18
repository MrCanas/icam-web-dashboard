import { getCurrentUser } from "@/lib/auth/currentUser";
import { canAccessRouteKey } from "@/lib/auth/permissions";
import { fetchActasLinkForPmActivo } from "@/modules/pm/actas/data/actasRepository";
import { actasProjectPath } from "@/modules/pm/actas/logic/actas-paths";
import { PmProjectTabs } from "@/modules/pm/ui/PmProjectTabs";

export default async function ProyectoLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const idActivo = decodeURIComponent(id);
  const user = await getCurrentUser();

  // Con actas vivas la pestaña lleva a su URL canónica; si están archivadas,
  // no hay vínculo o falla la consulta, al resolver anidado (que explica el
  // estado sin sacar del panel).
  let actasHref = `/dashboard/pm/proyecto/${encodeURIComponent(idActivo)}/actas`;
  try {
    const link = user ? await fetchActasLinkForPmActivo(user, idActivo) : null;
    if (link && !link.archived) actasHref = actasProjectPath(link.code);
  } catch {
    // fallback ya asignado
  }

  return (
    <div className="space-y-4 min-w-0">
      <PmProjectTabs
        idActivo={idActivo}
        actasHref={actasHref}
        showPlanificacion={user ? canAccessRouteKey(user, "pm.planificacion") : true}
        showActas={user ? canAccessRouteKey(user, "pm.actas") : true}
      />
      {children}
    </div>
  );
}
