import { getCurrentUser } from "@/lib/auth/currentUser";
import { fetchActasProjects } from "@/modules/pm/actas/data/actasRepository";
import { ActasHubPage } from "@/modules/pm/actas/ui/pages/ActasHubPage";

export default async function ActasIndexPage() {
  const ctx = await getCurrentUser();
  if (!ctx) {
    return null;
  }

  const { projects } = await fetchActasProjects(ctx);
  return <ActasHubPage projects={projects} />;
}
