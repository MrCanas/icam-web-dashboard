import { getCurrentUser } from "@/lib/auth/currentUser";
import { fetchActasProjectDetail } from "@/modules/pm/actas/data/actasRepository";
import { ActasNotFound } from "@/modules/pm/actas/ui/components/ActasNotFound";
import { ActasProjectPage } from "@/modules/pm/actas/ui/pages/ActasProjectPage";
import type { ActasProjectTab } from "@/modules/pm/actas/types";
import { ACTAS_PROJECT_TABS } from "@/modules/pm/actas/types";

interface PageProps {
  params: Promise<{ projectCode: string }>;
  searchParams: Promise<{ tab?: string }>;
}

export default async function ActasProjectRoutePage({
  params,
  searchParams,
}: PageProps) {
  const ctx = await getCurrentUser();
  if (!ctx) return null;

  const { projectCode } = await params;
  const { tab } = await searchParams;
  const decoded = decodeURIComponent(projectCode).trim();

  const activeTab: ActasProjectTab =
    ACTAS_PROJECT_TABS.some((t) => t.key === tab)
      ? (tab as ActasProjectTab)
      : "operativo";

  const { project, error } = await fetchActasProjectDetail(ctx, decoded);

  if (error) {
    return (
      <section className="bg-card rounded-lg border border-red-200 p-4 text-sm text-red-700">
        Error cargando proyecto: {error}
      </section>
    );
  }

  if (!project) {
    return <ActasNotFound projectCode={decoded} />;
  }

  return (
    <ActasProjectPage ctx={ctx} project={project} activeTab={activeTab} />
  );
}
