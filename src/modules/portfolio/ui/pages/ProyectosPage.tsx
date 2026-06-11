import { SupabaseEmptyProjectsBanner } from "@/modules/portfolio/ui/SupabaseEmptyProjectsBanner";
import { ProjectCard } from "@/modules/portfolio/ui/ProjectCard";
import { SortSelector } from "@/modules/portfolio/ui/SortSelector";
import { fmtMEuros } from "@/lib/formatters";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { buildProyectosActivosPageModel } from "@/modules/portfolio/logic/pageViewModels";
import { portfolioPaths } from "@/modules/portfolio/logic/paths";
import {
  filterUltimaFilaRows,
  loadProyectosPageData,
} from "@/modules/portfolio/logic/loadPortfolioPage";
import { sanitizeSort } from "@/modules/portfolio/logic/proyectoSort";
import { Proyecto } from "@/modules/portfolio/types";

interface ProyectosPageProps {
  searchParams: Promise<{
    sort?: string;
  }>;
}

export default async function ProyectosPage({ searchParams }: ProyectosPageProps) {
  const params = await searchParams;
  const selectedSort = params.sort;

  const ctx = await getCurrentUser();
  if (!ctx) {
    return (
      <section className="bg-card rounded-lg border border-red-200 p-6 text-red-700">
        No autorizado
      </section>
    );
  }

  const { portfolioCount, countError, data, error } = await loadProyectosPageData(ctx);

  if (error || countError) {
    const msg = error?.message ?? countError?.message ?? "Error desconocido";
    return (
      <section className="bg-card rounded-lg border border-red-200 p-6 text-red-700">
        Error cargando proyectos activos: {msg}
      </section>
    );
  }

  const baseRows = filterUltimaFilaRows(data as Proyecto[] | null);
  const showRlsEmpty = (portfolioCount ?? 0) === 0;
  const rows = showRlsEmpty ? [] : baseRows;
  const view = buildProyectosActivosPageModel(rows, selectedSort);

  return (
    <div className="space-y-3 sm:space-y-4 min-w-0">
      {showRlsEmpty ? <SupabaseEmptyProjectsBanner /> : null}
      <section className="bg-card rounded-lg border border-subtle/50 shadow-sm p-3 sm:p-4">
        <h1 className="text-xl font-semibold text-text-primary">Proyectos Activos</h1>
        <p className="mt-1 text-sm text-text-muted">
          {view.activeCount} proyectos en marcha · Inversión comprometida:{" "}
          {fmtMEuros(view.inversionComprometida)}
        </p>
      </section>

      <SortSelector
        selectedSort={sanitizeSort(selectedSort)}
        basePath={portfolioPaths.proyectos}
      />

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
        {view.projects.map((project) => (
          <ProjectCard key={project.id} project={project} />
        ))}
      </section>
    </div>
  );
}
