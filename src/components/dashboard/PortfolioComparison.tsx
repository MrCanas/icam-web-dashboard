import { avgHoldingPeriod } from "@/lib/calculations";
import { fmtInt, fmtMEuros, fmtMult, fmtPct } from "@/lib/formatters";
import { Proyecto } from "@/lib/types";

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
    <section className="bg-card rounded-lg border border-subtle/50 shadow-sm p-4">
      <h3 className="text-base font-semibold text-text-primary mb-3">
        Comparativa: Portfolio Activo vs Culminado
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-subtle text-text-muted">
              <th className="text-left py-2 pr-3">Métrica</th>
              <th className="text-right py-2 pr-3">En Marcha ({activosMetrics.n})</th>
              <th className="text-right py-2">Culminado ({culmMetrics.n})</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const betterA = row.better === "high" ? row.a > row.c : row.a < row.c;
              const betterC = row.better === "high" ? row.c > row.a : row.c < row.a;
              return (
                <tr key={row.label} className="border-b border-subtle/60 text-text-body">
                  <td className="py-2 pr-3">{row.label}</td>
                  <td className={`py-2 pr-3 text-right ${betterA ? "bg-[rgba(45,139,78,0.08)]" : ""}`}>
                    {row.fmt(row.a)}
                  </td>
                  <td className={`py-2 text-right ${betterC ? "bg-[rgba(45,139,78,0.08)]" : ""}`}>
                    {row.fmt(row.c)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
