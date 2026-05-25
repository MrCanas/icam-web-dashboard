import { avgHoldingPeriod } from "@/modules/portfolio/logic/calculations";
import { fmtInt, fmtMEuros, fmtMult, fmtPct } from "@/lib/formatters";
import { Proyecto } from "@/modules/portfolio/types";

interface PortfolioComparisonProps {
  activos: Proyecto[];
  culminados: Proyecto[];
}

function toNumber(value: number | null): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function weightedTIR(data: Proyecto[]): number {
  const rows = data
    .map((item) => ({ tir: toNumber(item.tir_desp_is), inv: toNumber(item.inversion_total) }))
    .filter((item) => item.tir > 0 && item.inv > 0);
  const dividend = rows.reduce((acc, item) => acc + item.tir * item.inv, 0);
  const divisor = rows.reduce((acc, item) => acc + item.inv, 0);
  return divisor > 0 ? dividend / divisor : 0;
}

function meanMultiplo(data: Proyecto[]): number {
  const values = data.map((item) => toNumber(item.multiplo)).filter((value) => value > 0);
  if (values.length === 0) return 0;
  return values.reduce((acc, current) => acc + current, 0) / values.length;
}

export function PortfolioComparison({ activos, culminados }: PortfolioComparisonProps) {
  const activosMetrics = {
    n: activos.length,
    inv: activos.reduce((acc, item) => acc + toNumber(item.inversion_total), 0),
    gdv: activos.reduce((acc, item) => acc + toNumber(item.total_ingresos_venta), 0),
    bene: activos.reduce((acc, item) => acc + toNumber(item.beneficios), 0),
    tir: weightedTIR(activos),
    mult: meanMultiplo(activos),
    hold: avgHoldingPeriod(activos),
  };
  const culmMetrics = {
    n: culminados.length,
    inv: culminados.reduce((acc, item) => acc + toNumber(item.inversion_total), 0),
    gdv: culminados.reduce((acc, item) => acc + toNumber(item.total_ingresos_venta), 0),
    bene: culminados.reduce((acc, item) => acc + toNumber(item.beneficios), 0),
    tir: weightedTIR(culminados),
    mult: meanMultiplo(culminados),
    hold: avgHoldingPeriod(culminados),
  };

  const rows = [
    { label: "Nº Proyectos", a: activosMetrics.n, c: culmMetrics.n, fmt: (v: number) => fmtInt(v), better: "high" },
    { label: "Inversión Total", a: activosMetrics.inv, c: culmMetrics.inv, fmt: fmtMEuros, better: "high" },
    { label: "GDV Total", a: activosMetrics.gdv, c: culmMetrics.gdv, fmt: fmtMEuros, better: "high" },
    { label: "Beneficio Total", a: activosMetrics.bene, c: culmMetrics.bene, fmt: fmtMEuros, better: "high" },
    { label: "TIR Ponderada", a: activosMetrics.tir, c: culmMetrics.tir, fmt: fmtPct, better: "high" },
    { label: "Múltiplo Medio", a: activosMetrics.mult, c: culmMetrics.mult, fmt: fmtMult, better: "high" },
    { label: "Holding Period Medio", a: activosMetrics.hold, c: culmMetrics.hold, fmt: (v: number) => `${fmtInt(v)} meses`, better: "low" },
  ] as const;

  return (
    <section className="bg-card rounded-lg border border-subtle/50 shadow-sm p-3 sm:p-4 min-w-0">
      <h3 className="text-base font-semibold text-text-primary mb-2 sm:mb-3">
        Comparativa: Portfolio Activo vs Culminado
      </h3>
      <p className="sm:hidden text-xs text-text-muted mb-2 flex items-center gap-1">
        <span className="text-icam-gold" aria-hidden>
          →
        </span>
        Desliza horizontalmente para ver todas las columnas
      </p>
      <div className="relative rounded-md">
        <div
          className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 z-[1] bg-gradient-to-l from-card to-transparent sm:hidden"
          aria-hidden
        />
        <div className="overflow-x-auto overscroll-x-contain -mx-1 px-1">
          <table className="w-full text-sm min-w-[340px]">
            <thead className="sticky top-0 z-10 bg-card shadow-[0_1px_0_0_#EAEBEE]">
              <tr className="border-b border-subtle text-text-muted">
                <th className="text-left py-2 pr-3 bg-card">Métrica</th>
                <th className="text-right py-2 pr-3 bg-card whitespace-nowrap">
                  En Marcha ({activosMetrics.n})
                </th>
                <th className="text-right py-2 bg-card whitespace-nowrap">
                  Culminado ({culmMetrics.n})
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const betterA = row.better === "high" ? row.a > row.c : row.a < row.c;
                const betterC = row.better === "high" ? row.c > row.a : row.c < row.a;
                return (
                  <tr key={row.label} className="border-b border-subtle/60 text-text-body">
                    <td className="py-2 pr-3">{row.label}</td>
                    <td className={`py-2 pr-3 text-right whitespace-nowrap ${betterA ? "bg-[rgba(45,139,78,0.08)]" : ""}`}>
                      {row.fmt(row.a)}
                    </td>
                    <td className={`py-2 text-right whitespace-nowrap ${betterC ? "bg-[rgba(45,139,78,0.08)]" : ""}`}>
                      {row.fmt(row.c)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
