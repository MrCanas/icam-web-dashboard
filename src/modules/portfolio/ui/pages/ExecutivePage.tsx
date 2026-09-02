import { ConsolidatedKPIs } from "@/modules/portfolio/ui/ConsolidatedKPIs";
import { PortfolioToolbar } from "@/modules/portfolio/ui/toolbar/PortfolioToolbar";
import { KPICard } from "@/modules/portfolio/ui/KPICard";
import { ProjectBarChart } from "@/modules/portfolio/ui/ProjectBarChart";
import { ProjectGroupedBarChart } from "@/modules/portfolio/ui/ProjectGroupedBarChart";
import { ProjectSharePie } from "@/modules/portfolio/ui/ProjectSharePie";
import { Top10BarChart } from "@/modules/portfolio/ui/Top10BarChart";
import { SupabaseEmptyProjectsBanner } from "@/modules/portfolio/ui/SupabaseEmptyProjectsBanner";
import { fmtInt, fmtMEuros, fmtPct } from "@/lib/formatters";
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

interface DashboardPageProps {
  searchParams: Promise<{
    situacion?: string;
    tipo?: string;
  }>;
}

async function loadPortfolioData(searchParams: Awaited<DashboardPageProps["searchParams"]>) {
  try {
    const ctx = await getCurrentUser();
    if (!ctx) {
      return {
        selectedSituacion: undefined,
        selectedTipo: undefined,
        portfolioCount: null,
        countError: null,
        data: null,
        error: null,
        fatal: "No autorizado",
      };
    }

    const selectedSituacion = sanitizeSituacion(searchParams.situacion);
    const selectedTipo = sanitizeTipo(searchParams.tipo);
    const { portfolioCount, countError, data, error } = await loadPortfolioCountAndList(ctx, {
      situacion: selectedSituacion,
      tipoProyecto: selectedTipo,
    });

    return {
      selectedSituacion,
      selectedTipo,
      portfolioCount,
      countError,
      data,
      error,
      fatal: null as string | null,
    };
  } catch (error) {
    console.error("[dashboard/portfolio] SSR render failed", error);
    return {
      selectedSituacion: undefined,
      selectedTipo: undefined,
      portfolioCount: null,
      countError: null,
      data: null,
      error: null,
      fatal: "Error cargando Portfolio. Revisa variables de entorno y logs de servidor.",
    };
  }
}

export default async function PortfolioExecutivePage({ searchParams }: DashboardPageProps) {
  const params = await searchParams;
  const loaded = await loadPortfolioData(params);

  if (loaded.fatal) {
    return (
      <section className="bg-card rounded-lg border border-red-200 p-6 text-red-700">
        {loaded.fatal}
      </section>
    );
  }

  const { selectedSituacion, selectedTipo, portfolioCount, countError, data, error } = loaded;

  if (error || countError) {
    const msg = error?.message ?? countError?.message ?? "Error desconocido";
    return (
      <section className="bg-card rounded-lg border border-red-200 p-6 text-red-700">
        Error cargando proyectos: {msg}
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

      <section className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4">
        <KPICard
          title="Nº Proyectos"
          value={fmtInt(view.kpis.nProyectos)}
          subtitle={`${view.kpis.nActivos} activos · ${view.kpis.nCulminados} culminados`}
        />
        <KPICard
          title="Fondos Propios Totales"
          value={fmtMEuros(view.kpis.fondosPropiosTotales)}
          subtitle={`Equity gestionado · Media: ${fmtMEuros(view.kpis.fondosPropiosMedia)}`}
        />
        <KPICard
          title="Ventas Totales"
          value={fmtMEuros(view.kpis.gdvTotal)}
          subtitle={`Margen: ${fmtPct(view.kpis.margenPct)}`}
        />
        <KPICard
          title="Beneficio Agregado"
          value={fmtMEuros(view.kpis.beneficioTotal)}
          subtitle={`Media: ${fmtMEuros(view.kpis.beneficioMedio)}`}
        />
        <KPICard
          title="TIR Media Ponderada"
          value={fmtPct(view.kpis.tirPonderada)}
          subtitle={`${view.kpis.tirSup15} de ${view.kpis.tirValidCount} proy > 15%`}
          highlight
        />
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-3 sm:gap-4">
        <Top10BarChart data={view.top10} />
        <ConsolidatedKPIs segmented={view.segmented} />
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-3 sm:gap-4">
        <ProjectSharePie
          title="Equity"
          data={view.equity}
          valueType="meuros"
          proyectos={proyectos}
        />
        <ProjectSharePie
          title="Beneficio"
          data={view.beneficio}
          valueType="meuros"
          proyectos={proyectos}
        />
      </section>

      {/*
        Yield y Crédito dependen de entry_yield / exit_yield / credito_total, que
        el RPC replace_proyectos no insertaba hasta la migración 034. Salen vacías
        hasta que se aplique y se vuelva a cargar el maestro.
      */}
      <section className="grid grid-cols-1 xl:grid-cols-2 gap-3 sm:gap-4">
        <ProjectGroupedBarChart
          title="Yield entrada vs Yield salida"
          data={view.yields}
          seriesNames={["Yield entrada", "Yield salida"]}
          valueType="pct"
          proyectos={proyectos}
        />
        <ProjectBarChart
          title="Crédito"
          data={view.credito}
          valueType="meuros"
          proyectos={proyectos}
        />
      </section>

      {/*
        «Distribución del portfolio» (DistributionBlock) se oculta por decisión de
        producto (2026-09). El componente y view.distributionRows se conservan.
      */}

      <PortfolioToolbar
        basePath={portfolioPaths.executive}
        situacion={selectedSituacion}
        tipo={selectedTipo}
      />
    </div>
  );
}
