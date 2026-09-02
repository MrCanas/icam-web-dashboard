import { SupabaseEmptyProjectsBanner } from "@/modules/portfolio/ui/SupabaseEmptyProjectsBanner";
import { HoldingPeriodChart } from "@/modules/portfolio/ui/HoldingPeriodChart";
import { MethodologyNotes } from "@/modules/portfolio/ui/MethodologyNotes";
import { PortfolioComparison } from "@/modules/portfolio/ui/PortfolioComparison";
import { ProyeccionesSection } from "@/modules/portfolio/ui/ProyeccionesSection";
import { VintageChart } from "@/modules/portfolio/ui/VintageChart";
import { VintageTIRChart } from "@/modules/portfolio/ui/VintageTIRChart";
import { PortfolioToolbar } from "@/modules/portfolio/ui/toolbar/PortfolioToolbar";
import { getCurrentUser } from "@/lib/auth/currentUser";
import {
  applyPortfolioSearchFilters,
  buildTendenciasPageModel,
} from "@/modules/portfolio/logic/pageViewModels";
import { sanitizeSituacion, sanitizeTipo } from "@/modules/portfolio/logic/portfolioParams";
import { portfolioPaths } from "@/modules/portfolio/logic/paths";
import { pipelineVencimientos, sanitizeCrecimiento } from "@/modules/portfolio/logic/projections";
import {
  filterUltimaFilaRows,
  loadTendenciasPageData,
} from "@/modules/portfolio/logic/loadPortfolioPage";
import { Proyecto } from "@/modules/portfolio/types";

interface TendenciasPageProps {
  searchParams: Promise<{
    situacion?: string;
    tipo?: string;
    crecimiento?: string;
  }>;
}

export default async function TendenciasPage({ searchParams }: TendenciasPageProps) {
  const params = await searchParams;
  const selectedSituacion = sanitizeSituacion(params.situacion);
  const selectedTipo = sanitizeTipo(params.tipo);
  const crecimiento = sanitizeCrecimiento(params.crecimiento);

  const ctx = await getCurrentUser();
  if (!ctx) {
    return (
      <section className="bg-card rounded-lg border border-red-200 p-6 text-red-700">
        No autorizado
      </section>
    );
  }

  const { portfolioCount, countError, data, error } = await loadTendenciasPageData(ctx);

  if (error || countError) {
    const msg = error?.message ?? countError?.message ?? "Error desconocido";
    return (
      <section className="bg-card rounded-lg border border-red-200 p-6 text-red-700">
        Error cargando tendencias: {msg}
      </section>
    );
  }

  const proyectos = filterUltimaFilaRows(data as Proyecto[] | null);
  const showRlsEmpty = (portfolioCount ?? 0) === 0;
  const rows = applyPortfolioSearchFilters(showRlsEmpty ? [] : proyectos, {
    situacion: selectedSituacion,
    tipoProyecto: selectedTipo,
  });
  const view = buildTendenciasPageModel(rows);
  // El vencimiento se calcula sobre las filas ya filtradas, para que la
  // proyección cuadre con lo que muestran las gráficas de arriba.
  const pipeline = pipelineVencimientos(rows);

  return (
    <div className="space-y-3 sm:space-y-4 min-w-0">
      {showRlsEmpty ? <SupabaseEmptyProjectsBanner /> : null}

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-3 sm:gap-4">
        <VintageChart data={view.vintageGroups} />
        <VintageTIRChart data={view.vintageGroups} />
      </section>

      <HoldingPeriodChart
        data={view.holdingBuckets}
        averageMonths={view.holdingAvg}
        proyectos={view.proyectos}
      />

      <PortfolioComparison activos={view.activos} culminados={view.culminados} />

      <ProyeccionesSection pipeline={pipeline} crecimientoInicial={crecimiento} />

      <MethodologyNotes />

      <PortfolioToolbar
        basePath={portfolioPaths.tendencias}
        situacion={selectedSituacion}
        tipo={selectedTipo}
      />
    </div>
  );
}
