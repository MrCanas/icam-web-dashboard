import { fmtEurosCompact, fmtPctOrDash } from "@/lib/formatters";
import type { FilaComparativa } from "@/modules/corporativo/logic/calculations";
import type { Sociedad } from "@/modules/corporativo/types";

interface ComparativaSociedadesProps {
  filas: FilaComparativa[];
  /** La sociedad seleccionada en la barra flotante, que se resalta. */
  destacada: Sociedad;
}

/**
 * Las tres sociedades en el mismo periodo. Es la vista tabular que exige la
 * regla de accesibilidad de las gráficas: quien no distinga los colores del
 * anillo de mix tiene aquí las mismas cifras en texto.
 */
export function ComparativaSociedades({ filas, destacada }: ComparativaSociedadesProps) {
  if (filas.length === 0) {
    return <p className="text-sm text-text-muted">Sin datos para el periodo seleccionado.</p>;
  }

  return (
    <div className="-mx-1 overflow-x-auto">
      <table className="w-full min-w-[520px] border-collapse text-sm">
        <caption className="sr-only">
          Facturación, gastos, EBITDA, margen y peso sobre el grupo por sociedad
        </caption>
        <thead>
          <tr className="border-b border-subtle text-left text-xs uppercase tracking-wider text-text-muted">
            <th scope="col" className="px-1 py-2 font-medium">
              Sociedad
            </th>
            <th scope="col" className="px-1 py-2 text-right font-medium">
              Facturación
            </th>
            <th scope="col" className="px-1 py-2 text-right font-medium">
              Gastos
            </th>
            <th scope="col" className="px-1 py-2 text-right font-medium">
              EBITDA
            </th>
            <th scope="col" className="px-1 py-2 text-right font-medium">
              Margen
            </th>
            <th scope="col" className="px-1 py-2 text-right font-medium">
              % grupo
            </th>
          </tr>
        </thead>
        <tbody>
          {filas.map((fila) => (
            <tr
              key={fila.sociedad}
              className={`border-b border-subtle/60 last:border-0 ${
                fila.sociedad === destacada ? "bg-page/70" : ""
              }`}
            >
              <th scope="row" className="px-1 py-2 text-left font-medium text-text-primary">
                {fila.sociedad}
                {fila.perimetro ? (
                  <span className="block text-xs font-normal text-text-muted">
                    {fila.perimetro}
                  </span>
                ) : null}
              </th>
              {fila.presente ? (
                <>
                  <td className="px-1 py-2 text-right tabular-nums text-text-body">
                    {fmtEurosCompact(fila.facturacion)}
                  </td>
                  <td className="px-1 py-2 text-right tabular-nums text-text-body">
                    {fmtEurosCompact(fila.gastos)}
                  </td>
                  <td className="px-1 py-2 text-right tabular-nums font-medium text-text-primary">
                    {fmtEurosCompact(fila.ebitda)}
                  </td>
                  <td className="px-1 py-2 text-right tabular-nums text-text-body">
                    {fmtPctOrDash(fila.margenPct)}
                  </td>
                  <td className="px-1 py-2 text-right tabular-nums text-text-body">
                    {fmtPctOrDash(fila.pesoGrupoPct)}
                  </td>
                </>
              ) : (
                <td colSpan={5} className="px-1 py-2 text-right text-xs text-text-muted">
                  Sin actividad en este periodo
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
