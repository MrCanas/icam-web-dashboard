import { FilterBar } from "@/components/dashboard/FilterBar";
import { MultiploDistribution } from "@/components/dashboard/MultiploDistribution";
import { RentabilidadTable } from "@/components/dashboard/RentabilidadTable";
import { ScatterTIRvsROE } from "@/components/dashboard/ScatterTIRvsROE";
import { SupabaseEmptyProjectsBanner } from "@/components/dashboard/SupabaseEmptyProjectsBanner";
import { TIRDistribution } from "@/components/dashboard/TIRDistribution";
import {
  computeKPIs,
  getHighTIRInvestment,
  getMultiploBuckets,
  getTIRBuckets,
} from "@/lib/calculations";
import { fmtMEuros, fmtMult, fmtPct } from "@/lib/formatters";
import { createDashboardReadClient } from "@/lib/supabase/dashboard-read";
import { Proyecto } from "@/lib/types";

interface RentabilidadPageProps {
  searchParams: Promise<{
    situacion?: string;
    tipo?: string;
  }>;
}

export default async function RentabilidadPage({ searchParams }: RentabilidadPageProps) {
  const params = await searchParams;
  const selectedSituacion = params.situacion;
  const selectedTipo = params.tipo;

  const supabase = createDashboardReadClient();

  const [{ count: portfolioCount, error: countError }, filteredResult] = await Promise.all([
    supabase
      .from("proyectos")
      .select("*", { count: "exact", head: true })
      .eq("es_ultima_fila", 1),
    (async () => {
      let q = supabase.from("proyectos").select("*").eq("es_ultima_fila", 1);
      if (selectedSituacion) q = q.eq("situacion", selectedSituacion);
      if (selectedTipo) q = q.eq("tipo_proyecto", selectedTipo);
      return q.order("proyecto", { ascending: true });
    })(),
  ]);

  const { data, error } = filteredResult;

  if (error || countError) {
    const msg = error?.message ?? countError?.message ?? "Error desconocido";
    return (
      <section className="bg-card rounded-lg border border-red-200 p-6 text-red-700">
        Error cargando proyectos: {msg}
      </section>
    );
  }

  const supabaseRows = (data ?? []) as Proyecto[];
  const showRlsEmpty = (portfolioCount ?? 0) === 0;
  const baseRows = showRlsEmpty ? [] : supabaseRows;
  const proyectos = baseRows
    .filter((row) => row.es_ultima_fila === 1)
    .filter((row) => (selectedSituacion ? row.situacion === selectedSituacion : true))
    .filter((row) => (selectedTipo ? row.tipo_proyecto === selectedTipo : true));

  const kpis = computeKPIs(proyectos);
  const tirBuckets = getTIRBuckets(proyectos);
  const multiploBuckets = getMultiploBuckets(proyectos);
  const highTIRInvestment = getHighTIRInvestment(proyectos, 0.15);
  const highTIRPctOfTotal = kpis.inversionTotal > 0 ? highTIRInvestment / kpis.inversionTotal : 0;

  return (
    <div className="space-y-3 sm:space-y-4 min-w-0">
      {showRlsEmpty ? <SupabaseEmptyProjectsBanner /> : null}
      <section className="bg-card rounded-lg border border-subtle/50 shadow-sm p-3 sm:p-4">
        <h1 className="text-xl font-semibold text-text-primary">Análisis de Rentabilidad</h1>
        <p className="mt-1 text-sm text-text-muted">
          {kpis.tirValidCount} proyectos con datos financieros
        </p>
      </section>

      <FilterBar
        selectedSituacion={selectedSituacion}
        selectedTipo={selectedTipo}
        basePath="/dashboard/rentabilidad"
      />

      <section className="bg-card rounded-lg border border-subtle/50 shadow-sm p-3 sm:p-4">
        <h3 className="text-base font-semibold text-text-primary mb-3">Resumen de rentabilidad</h3>
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-2 sm:gap-3">
          <div className="p-2 sm:p-3 rounded-md border border-subtle/70 min-w-0">
            <p className="text-xs uppercase tracking-wide text-text-muted">TIR Ponderada</p>
            <p className="mt-1 text-base sm:text-lg font-semibold text-text-primary break-words leading-tight">
              {fmtPct(kpis.tirPonderada)}
            </p>
          </div>
          <div className="p-2 sm:p-3 rounded-md border border-subtle/70 min-w-0">
            <p className="text-xs uppercase tracking-wide text-text-muted">Múltiplo Medio</p>
            <p className="mt-1 text-base sm:text-lg font-semibold text-text-primary break-words leading-tight">
              {fmtMult(kpis.multiploMedio)}
            </p>
          </div>
          <div className="p-2 sm:p-3 rounded-md border border-subtle/70 min-w-0">
            <p className="text-xs uppercase tracking-wide text-text-muted">Proy. TIR ≥ 15%</p>
            <p className="mt-1 text-base sm:text-lg font-semibold text-text-primary break-words leading-tight">
              {kpis.tirSup15} de {kpis.tirValidCount}
            </p>
          </div>
          <div className="p-2 sm:p-3 rounded-md border border-subtle/70 min-w-0 col-span-2 xl:col-span-1">
            <p className="text-xs uppercase tracking-wide text-text-muted">Inversión TIR ≥ 15%</p>
            <p className="mt-1 text-base sm:text-lg font-semibold text-text-primary break-words leading-tight">
              {fmtMEuros(highTIRInvestment)} ({fmtPct(highTIRPctOfTotal)})
            </p>
          </div>
        </div>
      </section>

      <ScatterTIRvsROE data={proyectos} />

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-3 sm:gap-4 min-w-0">
        <TIRDistribution data={tirBuckets} proyectos={proyectos} />
        <MultiploDistribution data={multiploBuckets} proyectos={proyectos} />
      </section>

      <RentabilidadTable data={proyectos} />
    </div>
  );
}
