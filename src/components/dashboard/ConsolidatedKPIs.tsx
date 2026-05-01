import { fmtMEuros, fmtMult, fmtPct } from "@/lib/formatters";
import { SegmentKPIs } from "@/lib/types";

interface ConsolidatedKPIsProps {
  segmented: SegmentKPIs;
}

export function ConsolidatedKPIs({ segmented }: ConsolidatedKPIsProps) {
  const columns = [
    { label: "Portfolio", data: segmented.portfolio },
    { label: "En Marcha", data: segmented.enMarcha },
    { label: "Culminado", data: segmented.culminado },
  ];
  const metrics = [
    { label: "Inversión", render: (v: typeof segmented.portfolio) => fmtMEuros(v.inversionTotal) },
    { label: "Beneficio", render: (v: typeof segmented.portfolio) => fmtMEuros(v.beneficioTotal) },
    { label: "TIR pond.", render: (v: typeof segmented.portfolio) => fmtPct(v.tirPonderada) },
    { label: "ROE medio", render: (v: typeof segmented.portfolio) => fmtPct(v.roeMedia) },
    { label: "Múltiplo", render: (v: typeof segmented.portfolio) => fmtMult(v.multiploMedio) },
  ];

  return (
    <section className="bg-card rounded-lg border border-subtle/50 shadow-sm p-3 sm:p-4 min-w-0">
      <h3 className="text-base font-semibold text-text-primary mb-3 sm:mb-4">KPIs consolidados</h3>
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
          <table className="w-full text-sm min-w-[520px]">
            <thead className="sticky top-0 z-10 bg-card shadow-[0_1px_0_0_#EAEBEE]">
              <tr className="text-left text-text-muted border-b border-subtle">
                <th className="py-2 pr-3 bg-card">Métrica</th>
                {columns.map((column) => (
                  <th key={column.label} className="py-2 pr-3 bg-card whitespace-nowrap">
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {metrics.map((metric) => (
                <tr key={metric.label} className="border-b last:border-b-0 border-subtle/60 text-text-body">
                  <td className="py-2 pr-3 font-medium whitespace-nowrap">{metric.label}</td>
                  {columns.map((column) => (
                    <td key={`${metric.label}-${column.label}`} className="py-2 pr-3 whitespace-nowrap">
                      {metric.render(column.data)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
