import { DonutChart } from "@/modules/portfolio/ui/DonutChart";
import { PortfolioToolbar } from "@/modules/portfolio/ui/toolbar/PortfolioToolbar";
import { SupabaseEmptyProjectsBanner } from "@/modules/portfolio/ui/SupabaseEmptyProjectsBanner";
import { getCurrentUser } from "@/lib/auth/currentUser";
import {
  applyPortfolioSearchFilters,
  buildExecutivePageModel,
} from "@/modules/portfolio/logic/pageViewModels";
import { sanitizeSituacion, sanitizeTipo } from "@/modules/portfolio/logic/portfolioParams";
import { portfolioPaths } from "@/modules/portfolio/logic/paths";
import {
  filterUltimaFilaRows,
  loadPortfolioCountAndList,
} from "@/modules/portfolio/logic/loadPortfolioPage";
import { Proyecto } from "@/modules/portfolio/types";

interface OverviewPageProps {
  searchParams: Promise<{
    situacion?: string;
    tipo?: string;
  }>;
}

/**
 * Pestaña «WIP». Conserva la ruta y la key `portfolio.overview` porque esa key
 * es la que guardan las denegaciones de permisos (app_user_route_deny).
 */
export default async function OverviewPage({ searchParams }: OverviewPageProps) {
  const params = await searchParams;
  const selectedSituacion = sanitizeSituacion(params.situacion);
  const selectedTipo = sanitizeTipo(params.tipo);

  const ctx = await getCurrentUser();
  if (!ctx) {
    return (
      <section className="bg-card rounded-lg border border-red-200 p-6 text-red-700">
        No autorizado
      </section>
    );
  }

  const { portfolioCount, countError, data, error } = await loadPortfolioCountAndList(ctx, {
    situacion: selectedSituacion,
    tipoProyecto: selectedTipo,
  });

  if (error || countError) {
    const msg = error?.message ?? countError?.message ?? "Error desconocido";
    return (
      <section className="bg-card rounded-lg border border-red-200 p-6 text-red-700">
        Error cargando WIP: {msg}
      </section>
    );
  }

  const baseRows = filterUltimaFilaRows(data as Proyecto[] | null);
  const showRlsEmpty = (portfolioCount ?? 0) === 0;
  const rows = showRlsEmpty ? [] : baseRows;
  const proyectos = applyPortfolioSearchFilters(rows, {
    situacion: selectedSituacion,
    tipoProyecto: selectedTipo,
  });
  const view = buildExecutivePageModel(proyectos);

  return (
    <div className="space-y-3 sm:space-y-4 min-w-0">
      {showRlsEmpty ? <SupabaseEmptyProjectsBanner /> : null}

      <section className="bg-card rounded-lg border border-subtle/50 shadow-sm p-3 sm:p-4">
        <h1 className="text-xl font-semibold text-text-primary">WIP</h1>
        <p className="mt-1 text-sm text-text-muted">
          Reparto de la cartera · {proyectos.length} proyectos
        </p>
      </section>


      <section className="grid grid-cols-1 xl:grid-cols-2 gap-3 sm:gap-4">
        <DonutChart
          title="Distribución por tipo de proyecto"
          data={view.donutTipoData}
          proyectos={proyectos}
          field="tipo_proyecto"
        />
        <DonutChart
          title="Distribución por situación"
          data={view.donutSituacionData}
          proyectos={proyectos}
          field="situacion"
        />
      </section>

      <PortfolioToolbar
        basePath={portfolioPaths.overview}
        situacion={selectedSituacion}
        tipo={selectedTipo}
      />
    </div>
  );
}
