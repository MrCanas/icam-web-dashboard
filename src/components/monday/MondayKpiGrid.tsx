import { KPICard } from "@/components/dashboard/KPICard";
import type { MondayKpiBundle } from "@/lib/monday/dashboard-types";

const locale = "es-ES";

function fmtInt(value: number) {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value);
}

function fmtPct(value: number) {
  return `${new Intl.NumberFormat(locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value * 100)}%`;
}

function fmtMEur(value: number) {
  return `${new Intl.NumberFormat(locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value / 1_000_000)} M€`;
}

function fmtEur(value: number) {
  return `${new Intl.NumberFormat(locale, {
    maximumFractionDigits: 0,
  }).format(value)}€`;
}

interface MondayKpiGridProps {
  kpis: MondayKpiBundle;
}

export function MondayKpiGrid({ kpis }: MondayKpiGridProps) {
  return (
    <section className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
      <KPICard
        title="Activos analizados"
        value={fmtInt(kpis.analyzedCount)}
        subtitle={`${fmtInt(kpis.inProgressCount)} en curso · ${fmtInt(kpis.rejectedCount)} descartados`}
      />
      <KPICard
        title="Volumen analizado"
        value={fmtMEur(kpis.analyzedVolume)}
        subtitle={`asking en ${fmtInt(kpis.analyzedWithPriceCount)} activos`}
      />
      <KPICard
        title="Ticket medio"
        value={fmtMEur(kpis.avgTicket)}
        subtitle="sobre activos con precio"
      />
      <KPICard
        title="Precio medio €/m²"
        value={fmtEur(kpis.avgPricePerSqm)}
        subtitle={`sobre ${fmtInt(kpis.pricePerSqmCount)} activos`}
      />
      <KPICard
        title="m² analizados"
        value={fmtInt(kpis.analyzedSurface)}
        subtitle={`en ${fmtInt(kpis.analyzedWithSurfaceCount)} activos`}
      />
      <KPICard
        title="Tasa descarte"
        value={fmtPct(kpis.discardRate)}
        subtitle={`${fmtInt(kpis.rejectedCount)} rechazados de ${fmtInt(kpis.receivedCount)}`}
        highlight
      />
    </section>
  );
}

