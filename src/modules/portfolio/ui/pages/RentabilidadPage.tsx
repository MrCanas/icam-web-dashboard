import { PortfolioToolbar } from "@/modules/portfolio/ui/toolbar/PortfolioToolbar";
import { ProjectGroupedBarChart } from "@/modules/portfolio/ui/ProjectGroupedBarChart";
import { MultiploDistribution } from "@/modules/portfolio/ui/MultiploDistribution";
import { RentabilidadTable } from "@/modules/portfolio/ui/RentabilidadTable";
import { ScatterTIRvsROE } from "@/modules/portfolio/ui/ScatterTIRvsROE";
import { SupabaseEmptyProjectsBanner } from "@/modules/portfolio/ui/SupabaseEmptyProjectsBanner";
import { TIRDistribution } from "@/modules/portfolio/ui/TIRDistribution";
import { fmtMEuros, fmtMult, fmtPct } from "@/lib/formatters";
import { getCurrentUser } from "@/lib/auth/currentUser";
import {
  applyPortfolioSearchFilters,
  buildRentabilidadPageModel,
} from "@/modules/portfolio/logic/pageViewModels";
import { sanitizeSituacion, sanitizeTipo } from "@/modules/portfolio/logic/portfolioParams";
import { portfolioPaths } from "@/modules/portfolio/logic/paths";
import {
  filterUltimaFilaRows,
  loadPortfolioCountAndList,
} from "@/modules/portfolio/logic/loadPortfolioPage";
import { Proyecto } from "@/modules/portfolio/types";

interface RentabilidadPageProps {
  searchParams: Promise<{
    situacion?: string;
    tipo?: string;
  }>;
}

export default async function RentabilidadPage({ searchParams }: RentabilidadPageProps) {
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
  const view = buildRentabilidadPageModel(proyectos);

  return (
    <div className="space-y-3 sm:space-y-4 min-w-0">
      {showRlsEmpty ? <SupabaseEmptyProjectsBanner /> : null}

      <section className="bg-card rounded-lg border border-subtle/50 shadow-sm p-3 sm:p-4">
        <h3 className="text-base font-semibold text-text-primary">Resumen de rentabilidad</h3>
        <p className="mt-1 mb-3 text-sm text-text-muted">
          {view.kpis.tirValidCount} proyectos con datos financieros
        </p>
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-2 sm:gap-3">
          <div className="p-2 sm:p-3 rounded-md border border-subtle/70 min-w-0">
            <p className="text-xs uppercase tracking-wide text-text-muted">TIR Ponderada</p>
            <p className="mt-1 text-base sm:text-lg font-semibold text-text-primary break-words leading-tight">
              {fmtPct(view.kpis.tirPonderada)}
            </p>
          </div>
          <div className="p-2 sm:p-3 rounded-md border border-subtle/70 min-w-0">
            <p className="text-xs uppercase tracking-wide text-text-muted">Múltiplo Medio</p>
            <p className="mt-1 text-base sm:text-lg font-semibold text-text-primary break-words leading-tight">
              {fmtMult(view.kpis.multiploMedio)}
            </p>
          </div>
          <div className="p-2 sm:p-3 rounded-md border border-subtle/70 min-w-0">
            <p className="text-xs uppercase tracking-wide text-text-muted">Proy. TIR ≥ 15%</p>
            <p className="mt-1 text-base sm:text-lg font-semibold text-text-primary break-words leading-tight">
              {view.kpis.tirSup15} de {view.kpis.tirValidCount}
            </p>
          </div>
          <div className="p-2 sm:p-3 rounded-md border border-subtle/70 min-w-0 col-span-2 xl:col-span-1">
            <p className="text-xs uppercase tracking-wide text-text-muted">Inversión TIR ≥ 15%</p>
            <p className="mt-1 text-base sm:text-lg font-semibold text-text-primary break-words leading-tight">
              {fmtMEuros(view.highTIRInvestment)} ({fmtPct(view.highTIRPctOfTotal)} del total)
            </p>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-3 sm:gap-4">
        <ProjectGroupedBarChart
          title="ROE desp. IS vs TIR desp. IS"
          data={view.tirRoe}
          seriesNames={["TIR desp. IS", "ROE desp. IS"]}
          valueType="pct"
          proyectos={view.proyectos}
        />
        <ProjectGroupedBarChart
          title="Inversión vs Venta"
          data={view.inversionVenta}
          seriesNames={["Inversión total", "Total ingresos por venta"]}
          valueType="meuros"
          proyectos={view.proyectos}
        />
      </section>

      <ScatterTIRvsROE data={view.proyectos} />

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-3 sm:gap-4 min-w-0">
        <TIRDistribution data={view.tirBuckets} proyectos={view.proyectos} />
        <MultiploDistribution data={view.multiploBuckets} proyectos={view.proyectos} />
      </section>

      <RentabilidadTable data={view.proyectos} />

      <PortfolioToolbar
        basePath={portfolioPaths.rentabilidad}
        situacion={selectedSituacion}
        tipo={selectedTipo}
      />
    </div>
  );
}
