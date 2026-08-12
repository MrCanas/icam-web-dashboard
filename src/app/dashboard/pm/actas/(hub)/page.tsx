import { requireRouteAccess } from "@/lib/auth/require-route-access";
import { fetchActasProjects } from "@/modules/pm/actas/data/actasRepository";
import { ActasHubPage } from "@/modules/pm/actas/ui/pages/ActasHubPage";

export default async function ActasIndexPage() {
  const ctx = await requireRouteAccess("pm.actas");

  const { projects } = await fetchActasProjects(ctx);
  return <ActasHubPage projects={projects} />;
}
