import { HoldingPeriodChart } from "@/components/dashboard/HoldingPeriodChart";
import { MethodologyNotes } from "@/components/dashboard/MethodologyNotes";
import { PortfolioComparison } from "@/components/dashboard/PortfolioComparison";
import { VintageChart } from "@/components/dashboard/VintageChart";
import { VintageTIRChart } from "@/components/dashboard/VintageTIRChart";
import { avgHoldingPeriod, getHoldingPeriodBuckets, groupByVintage } from "@/lib/calculations";
import { seedProyectos } from "@/lib/seedProyectos";
import { createClient } from "@/lib/supabase/server";
import { Proyecto } from "@/lib/types";

export default async function TendenciasPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("proyectos")
    .select(
      "id,proyecto,situacion,tipo_proyecto,inversion_total,total_ingresos_venta,beneficios,unidades_totales,tir_desp_is,roe_desp_is,multiplo,project_irr,bcr,ubicacion,equity,holding_period,superficie_edificable,es_ultima_fila,fecha_inicio,created_at",
    )
    .eq("es_ultima_fila", 1)
    .order("proyecto", { ascending: true });

  if (error) {
    return (
      <section className="bg-card rounded-lg border border-red-200 p-6 text-red-700">
        Error cargando tendencias: {error.message}
      </section>
    );
  }

  const supabaseRows = (data ?? []) as Proyecto[];
  const baseRows = supabaseRows.length > 0 ? supabaseRows : seedProyectos;
  const proyectos = baseRows.filter((row) => row.es_ultima_fila === 1);

  const vintageMap = groupByVintage(proyectos);
  const vintageRows = Object.values(vintageMap).sort((a, b) => Number(a.year) - Number(b.year));
  const activos = proyectos.filter((item) => item.situacion === "En Marcha");
  const culminados = proyectos.filter((item) => item.situacion === "Culminado");
  const holdingBuckets = getHoldingPeriodBuckets(proyectos);
  const holdingAvg = avgHoldingPeriod(proyectos);

  return (
    <div className="space-y-3 sm:space-y-4 min-w-0">
      <section className="bg-card rounded-lg border border-subtle/50 shadow-sm p-3 sm:p-4">
        <h1 className="text-xl font-semibold text-text-primary">Tendencias e Histórico</h1>
        <p className="mt-1 text-sm text-text-muted">Evolución del portfolio · 2014-2025</p>
      </section>

      {vintageRows.length > 0 && <VintageChart data={vintageRows} />}
      {vintageRows.some((item) => item.tirPonderada > 0) && <VintageTIRChart data={vintageRows} />}
      <PortfolioComparison activos={activos} culminados={culminados} />
      {holdingBuckets.some((item) => item.activos > 0 || item.culminados > 0) && (
        <HoldingPeriodChart data={holdingBuckets} averageMonths={holdingAvg} />
      )}
      <MethodologyNotes />
    </div>
  );
}
