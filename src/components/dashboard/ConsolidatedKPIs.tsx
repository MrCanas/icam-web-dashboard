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
    <section className="bg-card rounded-lg border border-subtle/50 shadow-sm p-4">
      <h3 className="text-base font-semibold text-text-primary mb-4">KPIs consolidados</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-text-muted border-b border-subtle">
              <th className="py-2 pr-3">Métrica</th>
              {columns.map((column) => (
                <th key={column.label} className="py-2 pr-3">
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {metrics.map((metric) => (
              <tr key={metric.label} className="border-b last:border-b-0 border-subtle/60 text-text-body">
                <td className="py-2 pr-3 font-medium">{metric.label}</td>
                {columns.map((column) => (
                  <td key={`${metric.label}-${column.label}`} className="py-2 pr-3">
                    {metric.render(column.data)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
