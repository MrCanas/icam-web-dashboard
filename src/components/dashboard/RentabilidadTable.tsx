import { fmtMEuros, fmtMult, fmtPct } from "@/lib/formatters";
import { Proyecto } from "@/lib/types";

interface RentabilidadTableProps {
  data: Proyecto[];
}

function sortByTIRDesc(data: Proyecto[]): Proyecto[] {
  return [...data].sort((a, b) => (b.tir_desp_is ?? -1) - (a.tir_desp_is ?? -1));
}

function fmtMaybe(value: number | null, formatter: (value: number) => string): string {
  if (value === null || value <= 0) return "—";
  return formatter(value);
}

export function RentabilidadTable({ data }: RentabilidadTableProps) {
  const rows = sortByTIRDesc(data);

  return (
    <section className="bg-card rounded-lg border border-subtle/50 shadow-sm p-4">
      <h3 className="text-base font-semibold text-text-primary mb-3">Rentabilidad por proyecto</h3>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1100px] text-[12px] text-text-body">
          <thead className="sticky top-0 bg-card z-10">
            <tr className="border-b border-subtle text-text-muted">
              <th className="text-left py-2 pr-3">Proyecto</th>
              <th className="text-left py-2 pr-3">Situación</th>
              <th className="text-left py-2 pr-3">Tipo</th>
              <th className="text-right py-2 pr-3">Inversión (M€)</th>
              <th className="text-right py-2 pr-3">GDV (M€)</th>
              <th className="text-right py-2 pr-3">Beneficio (M€)</th>
              <th className="text-right py-2 pr-3">TIR</th>
              <th className="text-right py-2 pr-3">ROE</th>
              <th className="text-right py-2 pr-3">Múltiplo</th>
              <th className="text-right py-2">Project IRR</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const hasHighTIR = (row.tir_desp_is ?? 0) >= 0.15;
              return (
                <tr key={row.id} className="border-b border-subtle hover:bg-subtle/40 transition-colors">
                  <td className="py-2 pr-3 font-medium">{row.proyecto}</td>
                  <td className="py-2 pr-3">{row.situacion}</td>
                  <td className="py-2 pr-3">{row.tipo_proyecto}</td>
                  <td className="py-2 pr-3 text-right font-mono">
                    {fmtMaybe(row.inversion_total, fmtMEuros)}
                  </td>
                  <td className="py-2 pr-3 text-right font-mono">
                    {fmtMaybe(row.total_ingresos_venta, fmtMEuros)}
                  </td>
                  <td className="py-2 pr-3 text-right font-mono">
                    {fmtMaybe(row.beneficios, fmtMEuros)}
                  </td>
                  <td
                    className={`py-2 pr-3 text-right font-mono ${
                      hasHighTIR ? "bg-green-50 text-green-800" : ""
                    }`}
                  >
                    {fmtMaybe(row.tir_desp_is, fmtPct)}
                  </td>
                  <td className="py-2 pr-3 text-right font-mono">{fmtMaybe(row.roe_desp_is, fmtPct)}</td>
                  <td className="py-2 pr-3 text-right font-mono">{fmtMaybe(row.multiplo, fmtMult)}</td>
                  <td className="py-2 text-right font-mono">{fmtMaybe(row.project_irr, fmtPct)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
