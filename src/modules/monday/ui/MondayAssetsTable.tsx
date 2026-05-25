import type { MondayAsset } from "@/modules/monday/data/dashboard-types";

const locale = "es-ES";

function fmtMEur(value: number | null): string {
  if (!value || value <= 0) return "—";
  return `${new Intl.NumberFormat(locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value / 1_000_000)} M€`;
}

function stageLabel(stage: string): string {
  return stage.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

interface MondayAssetsTableProps {
  rows: MondayAsset[];
}

export function MondayAssetsTable({ rows }: MondayAssetsTableProps) {
  return (
    <section className="bg-card rounded-lg border border-subtle/50 shadow-sm p-3 sm:p-4">
      <h3 className="text-sm font-semibold text-text-primary mb-3">Activos en curso · {rows.length}</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-text-muted">No hay activos en curso para los filtros seleccionados.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-subtle text-left text-text-muted">
                <th className="py-2 pr-4 font-medium">Fase</th>
                <th className="py-2 pr-4 font-medium">Activo</th>
                <th className="py-2 pr-4 font-medium">Ubicación</th>
                <th className="py-2 pr-4 font-medium">Uso</th>
                <th className="py-2 pr-4 font-medium">Asking</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-subtle/70">
                  <td className="py-2 pr-4 text-text-body">{stageLabel(row.stage)}</td>
                  <td className="py-2 pr-4 text-text-primary">{row.name}</td>
                  <td className="py-2 pr-4 text-text-body">{row.location ?? "—"}</td>
                  <td className="py-2 pr-4 text-text-body">{row.useType}</td>
                  <td className="py-2 pr-4 text-text-body">{fmtMEur(row.askingPriceEur)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

