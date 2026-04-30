import { FilterBar } from "@/components/dashboard/FilterBar";
import { MultiploDistribution } from "@/components/dashboard/MultiploDistribution";
import { RentabilidadTable } from "@/components/dashboard/RentabilidadTable";
import { ScatterTIRvsROE } from "@/components/dashboard/ScatterTIRvsROE";
import { TIRDistribution } from "@/components/dashboard/TIRDistribution";
import {
  computeKPIs,
  getHighTIRInvestment,
  getMultiploBuckets,
  getTIRBuckets,
} from "@/lib/calculations";
import { fmtMEuros, fmtMult, fmtPct } from "@/lib/formatters";
import { seedProyectos } from "@/lib/seedProyectos";
import { createClient } from "@/lib/supabase/server";
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

  const supabase = await createClient();
  let query = supabase.from("proyectos").select("*").eq("es_ultima_fila", 1);

  if (selectedSituacion) {
    query = query.eq("situacion", selectedSituacion);
  }
  if (selectedTipo) {
    query = query.eq("tipo_proyecto", selectedTipo);
  }

  const { data, error } = await query.order("proyecto", { ascending: true });

  if (error) {
    return (
      <section className="bg-card rounded-lg border border-red-200 p-6 text-red-700">
        Error cargando proyectos: {error.message}
      </section>
    );
  }

  const supabaseRows = (data ?? []) as Proyecto[];
  const baseRows = supabaseRows.length > 0 ? supabaseRows : seedProyectos;
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
    <div className="space-y-4">
      <section className="bg-card rounded-lg border border-subtle/50 shadow-sm p-4">
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

      <ScatterTIRvsROE data={proyectos} />

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <TIRDistribution data={tirBuckets} />
        <MultiploDistribution data={multiploBuckets} />
      </section>

      <RentabilidadTable data={proyectos} />

      <section className="bg-card rounded-lg border border-subtle/50 shadow-sm p-4">
        <h3 className="text-base font-semibold text-text-primary mb-3">Resumen de rentabilidad</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          <div className="p-3 rounded-md border border-subtle/70">
            <p className="text-xs uppercase tracking-wide text-text-muted">TIR Ponderada</p>
            <p className="mt-1 text-lg font-semibold text-text-primary">{fmtPct(kpis.tirPonderada)}</p>
          </div>
          <div className="p-3 rounded-md border border-subtle/70">
            <p className="text-xs uppercase tracking-wide text-text-muted">Múltiplo Medio</p>
            <p className="mt-1 text-lg font-semibold text-text-primary">{fmtMult(kpis.multiploMedio)}</p>
          </div>
          <div className="p-3 rounded-md border border-subtle/70">
            <p className="text-xs uppercase tracking-wide text-text-muted">Proy. TIR ≥ 15%</p>
            <p className="mt-1 text-lg font-semibold text-text-primary">
              {kpis.tirSup15} de {kpis.tirValidCount}
            </p>
          </div>
          <div className="p-3 rounded-md border border-subtle/70">
            <p className="text-xs uppercase tracking-wide text-text-muted">Inversión TIR ≥ 15%</p>
            <p className="mt-1 text-lg font-semibold text-text-primary">
              {fmtMEuros(highTIRInvestment)} ({fmtPct(highTIRPctOfTotal)})
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
