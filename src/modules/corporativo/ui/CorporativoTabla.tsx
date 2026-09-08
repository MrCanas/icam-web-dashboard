import { fmtEurosCompact, fmtIntOrDash, fmtPctOrDash } from "@/lib/formatters";
import type { CorpPeriodo } from "@/modules/corporativo/types";

/**
 * La serie, fila a fila y en texto.
 *
 * No es un extra: es la vista tabular que exige la regla de accesibilidad de las
 * gráficas. Todo lo que las diez gráficas del tab codifican con color o altura
 * está aquí escrito, para quien no distinga los tonos, imprima en blanco y negro
 * o simplemente quiera copiar una cifra.
 *
 * Server Component: se pinta ya ordenada por la propia consulta y no manda
 * JavaScript al navegador.
 */
export function CorporativoTabla({ filas }: { filas: CorpPeriodo[] }) {
  if (filas.length === 0) {
    return <p className="text-sm text-text-muted">Sin periodos para los filtros seleccionados.</p>;
  }

  return (
    <div className="-mx-1 max-h-[520px] overflow-auto">
      <table className="w-full min-w-[860px] border-collapse text-sm">
        <caption className="sr-only">
          Detalle por periodo: facturación, gastos, EBITDA, márgenes, caja y capital bajo gestión
        </caption>
        <thead className="sticky top-0 z-10 bg-card">
          <tr className="border-b border-subtle text-left text-xs uppercase tracking-wider text-text-muted">
            <th scope="col" className="px-2 py-2 font-medium">Periodo</th>
            <th scope="col" className="px-2 py-2 text-right font-medium">Facturación</th>
            <th scope="col" className="px-2 py-2 text-right font-medium">Gastos</th>
            <th scope="col" className="px-2 py-2 text-right font-medium">EBITDA</th>
            <th scope="col" className="px-2 py-2 text-right font-medium">Margen</th>
            <th scope="col" className="px-2 py-2 text-right font-medium">EBITDA caja</th>
            <th scope="col" className="px-2 py-2 text-right font-medium">Caja cierre</th>
            <th scope="col" className="px-2 py-2 text-right font-medium">AUM</th>
            <th scope="col" className="px-2 py-2 text-right font-medium">Vehíc.</th>
            <th scope="col" className="px-2 py-2 text-right font-medium">Var. interanual</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((fila) => (
            <tr key={fila.id} className="border-b border-subtle/60 last:border-0">
              <th scope="row" className="px-2 py-1.5 text-left font-medium text-text-primary">
                {fila.periodo}
                {fila.naturaleza !== "REAL" ? (
                  <span className="ml-1.5 rounded bg-page px-1 py-0.5 text-[10px] font-normal uppercase tracking-wide text-text-muted">
                    {fila.naturaleza === "PREVISIÓN" ? "previsión" : "mixto"}
                  </span>
                ) : null}
              </th>
              <td className="px-2 py-1.5 text-right tabular-nums text-text-body">{fmtEurosCompact(fila.facturacion)}</td>
              <td className="px-2 py-1.5 text-right tabular-nums text-text-body">{fmtEurosCompact(fila.gastos_totales)}</td>
              <td className="px-2 py-1.5 text-right tabular-nums font-medium text-text-primary">{fmtEurosCompact(fila.ebitda)}</td>
              <td className="px-2 py-1.5 text-right tabular-nums text-text-body">{fmtPctOrDash(fila.margen_ebitda_pct)}</td>
              <td className="px-2 py-1.5 text-right tabular-nums text-text-body">{fmtEurosCompact(fila.ebitda_caja)}</td>
              <td className="px-2 py-1.5 text-right tabular-nums text-text-body">{fmtEurosCompact(fila.saldo_caja_cierre)}</td>
              <td className="px-2 py-1.5 text-right tabular-nums text-text-body">{fmtEurosCompact(fila.capital_bajo_gestion)}</td>
              <td className="px-2 py-1.5 text-right tabular-nums text-text-body">{fmtIntOrDash(fila.n_vehiculos)}</td>
              <td className="px-2 py-1.5 text-right tabular-nums text-text-body">{fmtPctOrDash(fila.var_facturacion_interanual_pct)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
