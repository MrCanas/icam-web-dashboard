import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/currentUser";
import { fetchActasArchivedProjects } from "@/modules/pm/actas/data/actasRepository";
import { ActasArchivedProjectsPage } from "@/modules/pm/actas/ui/pages/ActasArchivedProjectsPage";

export const dynamic = "force-dynamic";

export default async function ActasArchivedProjectsRoutePage() {
  const ctx = await getCurrentUser();
  if (!ctx) {
    redirect("/login");
  }

  const { projects, error } = await fetchActasArchivedProjects(ctx);

  if (error) {
    return (
      <section className="bg-card rounded-lg border border-red-200 p-4 text-sm text-red-700">
        No se pudieron cargar los proyectos archivados: {error}
      </section>
    );
  }

  return <ActasArchivedProjectsPage projects={projects} />;
}
