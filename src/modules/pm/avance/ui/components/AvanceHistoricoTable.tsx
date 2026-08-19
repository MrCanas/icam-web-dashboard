import { fmtPorcentaje } from "@/modules/pm/avance/logic/avance-obra";
import type { PmAvanceHistorico } from "@/modules/pm/avance/types";

interface AvanceHistoricoTableProps {
  filas: (PmAvanceHistorico & { fase_nombre: string })[];
}

const FECHA = new Intl.DateTimeFormat("es-ES", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/**
 * Los últimos cambios de avance de la promoción.
 *
 * Es la serie temporal con la que se pintará la evolución del avance; de momento
 * se lista, porque con una sola importación un gráfico no diría nada.
 */
export function AvanceHistoricoTable({ filas }: AvanceHistoricoTableProps) {
  if (filas.length === 0) {
    return (
      <p className="rounded-lg border border-subtle/50 bg-card p-4 text-sm text-text-muted">
        Todavía no hay cambios registrados.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-subtle/50 bg-card">
      <table className="w-full min-w-[520px] text-left text-sm">
        <thead className="bg-subtle/30">
          <tr>
            <th className="p-3 font-semibold text-icam-900">Fase</th>
            <th className="p-3 font-semibold text-icam-900">Cambio</th>
            <th className="p-3 font-semibold text-icam-900">Origen</th>
            <th className="p-3 font-semibold text-icam-900">Quién</th>
            <th className="p-3 font-semibold text-icam-900">Cuándo</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => (
            <tr key={f.id} className="border-t border-subtle/50">
              <td className="p-3 text-text-body">{f.fase_nombre}</td>
              <td className="p-3 tabular-nums text-text-body">
                <span className="text-text-muted">{fmtPorcentaje(f.porcentaje_anterior)}</span>
                {" → "}
                <span className="font-medium">{fmtPorcentaje(f.porcentaje_nuevo)}</span>
              </td>
              <td className="p-3">
                <span
                  className={`rounded px-1.5 py-0.5 text-xs ${
                    f.origen === "zoho_import"
                      ? "bg-subtle text-text-muted"
                      : "bg-icam-900/[0.06] text-icam-900"
                  }`}
                >
                  {f.origen === "zoho_import" ? "Zoho" : "Portal"}
                </span>
              </td>
              <td className="p-3 text-text-muted">{f.cambiado_por_email ?? "—"}</td>
              <td className="p-3 whitespace-nowrap text-text-muted">
                {FECHA.format(new Date(f.cambiado_at))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
