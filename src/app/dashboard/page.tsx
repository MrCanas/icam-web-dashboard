import { ConsolidatedKPIs } from "@/components/dashboard/ConsolidatedKPIs";
import { DistributionBlock } from "@/components/dashboard/DistributionBlock";
import { DonutChart } from "@/components/dashboard/DonutChart";
import { FilterBar } from "@/components/dashboard/FilterBar";
import { KPICard } from "@/components/dashboard/KPICard";
import { Top10BarChart } from "@/components/dashboard/Top10BarChart";
import { SupabaseEmptyProjectsBanner } from "@/components/dashboard/SupabaseEmptyProjectsBanner";
import { computeKPIs, getTop10, groupByField, segmentKPIs } from "@/lib/calculations";
import { fmtInt, fmtMEuros, fmtPct } from "@/lib/formatters";
import { createDashboardReadClient } from "@/lib/supabase/dashboard-read";
import { Proyecto } from "@/lib/types";

interface DashboardPageProps {
  searchParams: Promise<{
    situacion?: string;
    tipo?: string;
  }>;
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
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
  const top10 = getTop10(proyectos);
  const groupedTipo = groupByField(proyectos, "tipo_proyecto");
  const groupedSituacion = groupByField(proyectos, "situacion");
  const segmented = segmentKPIs(proyectos);

  const donutTipoData = Object.entries(groupedTipo).map(([label, value]) => ({
    label,
    count: value.count,
    inversion: value.inversion,
  }));
  const donutSituacionData = Object.entries(groupedSituacion).map(([label, value]) => ({
    label,
    count: value.count,
    inversion: value.inversion,
  }));

  const distributionRows = [...donutTipoData, ...donutSituacionData];

  return (
    <div className="space-y-3 sm:space-y-4 min-w-0">
      {showRlsEmpty ? <SupabaseEmptyProjectsBanner /> : null}
      <FilterBar selectedSituacion={selectedSituacion} selectedTipo={selectedTipo} />

      <section className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4">
        <KPICard
          title="Nº Proyectos"
          value={fmtInt(kpis.nProyectos)}
          subtitle={`${kpis.nActivos} activos · ${kpis.nCulminados} culminados`}
        />
        <KPICard
          title="Inversión Total"
          value={fmtMEuros(kpis.inversionTotal)}
          subtitle={`Media: ${fmtMEuros(kpis.inversionMedia)}`}
        />
        <KPICard
          title="GDV Total"
          value={fmtMEuros(kpis.gdvTotal)}
          subtitle={`Margen: ${fmtPct(kpis.margenPct)}`}
        />
        <KPICard
          title="Beneficio Agregado"
          value={fmtMEuros(kpis.beneficioTotal)}
          subtitle={`Media: ${fmtMEuros(kpis.beneficioMedio)}`}
        />
        <KPICard
          title="TIR Media Ponderada"
          value={fmtPct(kpis.tirPonderada)}
          subtitle={`${kpis.tirSup15} de ${kpis.tirValidCount} proy > 15%`}
          highlight
        />
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-3 sm:gap-4">
        <Top10BarChart data={top10} />
        <div className="space-y-3 sm:space-y-4 min-w-0">
          <DonutChart title="Distribución por tipo de proyecto" data={donutTipoData} />
          <DonutChart title="Distribución por situación" data={donutSituacionData} />
        </div>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-3 sm:gap-4">
        <DistributionBlock rows={distributionRows} />
        <ConsolidatedKPIs segmented={segmented} />
      </section>
    </div>
  );
}
