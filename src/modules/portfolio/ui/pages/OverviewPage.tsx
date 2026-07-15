import { FilterBar } from "@/modules/portfolio/ui/FilterBar";
import { ProjectGroupedBarChart } from "@/modules/portfolio/ui/ProjectGroupedBarChart";
import { ProjectBarChart } from "@/modules/portfolio/ui/ProjectBarChart";
import { ProjectSharePie } from "@/modules/portfolio/ui/ProjectSharePie";
import { SupabaseEmptyProjectsBanner } from "@/modules/portfolio/ui/SupabaseEmptyProjectsBanner";
import { getCurrentUser } from "@/lib/auth/currentUser";
import {
  applyPortfolioSearchFilters,
  buildOverviewPageModel,
} from "@/modules/portfolio/logic/pageViewModels";
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

export default async function OverviewPage({ searchParams }: OverviewPageProps) {
  const params = await searchParams;
  const selectedSituacion = params.situacion;
  const selectedTipo = params.tipo;

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
        Error cargando overview: {msg}
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
  const view = buildOverviewPageModel(proyectos);

  return (
    <div className="space-y-3 sm:space-y-4 min-w-0">
      {showRlsEmpty ? <SupabaseEmptyProjectsBanner /> : null}

      <section className="bg-card rounded-lg border border-subtle/50 shadow-sm p-3 sm:p-4">
        <h1 className="text-xl font-semibold text-text-primary">Overview</h1>
        <p className="mt-1 text-sm text-text-muted">
          Resumen global por proyecto · {proyectos.length} proyectos
        </p>
      </section>

      <FilterBar
        selectedSituacion={selectedSituacion}
        selectedTipo={selectedTipo}
        basePath={portfolioPaths.overview}
      />

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-3 sm:gap-4">
        <ProjectGroupedBarChart
          title="ROE desp. IS vs TIR desp. IS"
          data={view.tirRoe}
          seriesNames={["TIR desp. IS", "ROE desp. IS"]}
          valueType="pct"
        />
        <ProjectGroupedBarChart
          title="Inversión vs Venta"
          data={view.inversionVenta}
          seriesNames={["Inversión total", "Total ingresos por venta"]}
          valueType="meuros"
        />
        <ProjectGroupedBarChart
          title="Yield entrada vs Yield salida"
          data={view.yields}
          seriesNames={["Yield entrada", "Yield salida"]}
          valueType="pct"
        />
        <ProjectBarChart title="Crédito" data={view.credito} valueType="meuros" />
        <ProjectSharePie title="Equity" data={view.equity} valueType="meuros" />
        <ProjectSharePie title="Beneficio" data={view.beneficio} valueType="meuros" />
      </section>
    </div>
  );
}
