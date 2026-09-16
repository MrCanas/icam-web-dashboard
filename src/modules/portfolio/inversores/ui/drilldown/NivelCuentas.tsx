"use client";

import { fmtEurosCompact, fmtInt } from "@/lib/formatters";
import { capitalDe } from "@/modules/portfolio/inversores/logic/inversoresModel";
import type { CuentaInversion } from "@/modules/portfolio/inversores/types";

function euros(valor: number | null): string {
  return valor === null || !Number.isFinite(valor) ? "—" : fmtEurosCompact(valor);
}

interface NivelCuentasProps {
  cuentas: CuentaInversion[];
  onEntrar: (cuenta: CuentaInversion) => void;
}

/**
 * Nivel 1: las cuentas que hay detrás de la cifra pinchada.
 *
 * El nombre de la cuenta es un `<button>` y no un `<tr onClick>`. No es
 * cosmético: `Modal` atrapa el tabulado recorriendo los elementos que casan con
 * su selector `FOCUSABLES`, donde entran los botones y no las filas con
 * manejador. Con `<tr onClick>` el segundo nivel sería inalcanzable con
 * teclado.
 */
export function NivelCuentas({ cuentas, onEntrar }: NivelCuentasProps) {
  if (cuentas.length === 0) {
    return (
      <p className="text-sm text-text-muted">
        No hay cuentas de inversión en este tramo.
      </p>
    );
  }

  const total = cuentas.reduce(
    (acc, cuenta) => ({
      capital: acc.capital + capitalDe(cuenta),
      aportado: acc.aportado + cuenta.aportado,
      repartido: acc.repartido + cuenta.repartido,
      contactos: acc.contactos + cuenta.contactos.length,
    }),
    { capital: 0, aportado: 0, repartido: 0, contactos: 0 },
  );

  return (
    <div className="overflow-x-auto overscroll-x-contain">
      <table className="w-full min-w-[640px] text-sm">
        <caption className="sr-only">
          Cuentas de inversión del tramo seleccionado. Pulsa el nombre de una cuenta para ver sus
          contactos.
        </caption>
        <thead>
          <tr className="border-b border-subtle text-left text-text-muted">
            <th scope="col" className="py-2 pr-3">Cuenta</th>
            <th scope="col" className="py-2 pr-3">Estado</th>
            <th scope="col" className="py-2 pr-3 text-right">Comprometido</th>
            <th scope="col" className="py-2 pr-3 text-right">Aportado</th>
            <th scope="col" className="py-2 pr-3 text-right">Repartido</th>
            <th scope="col" className="py-2 text-right">Contactos</th>
          </tr>
        </thead>
        <tbody>
          {cuentas.map((cuenta) => (
            <tr
              key={cuenta.zohoId}
              className="border-b border-subtle/60 text-text-body last:border-b-0"
            >
              <td className="py-1 pr-3">
                <button
                  type="button"
                  data-cuenta-id={cuenta.zohoId}
                  onClick={() => onEntrar(cuenta)}
                  className="min-h-9 rounded text-left font-medium text-icam-900 underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-icam-900"
                >
                  {cuenta.nombre}
                  {cuenta.codigo ? (
                    <span className="block text-xs font-normal text-text-muted">
                      {cuenta.codigo}
                    </span>
                  ) : null}
                </button>
              </td>
              <td className="py-1 pr-3 whitespace-nowrap">{cuenta.estado ?? "—"}</td>
              <td className="py-1 pr-3 text-right tabular-nums">{euros(cuenta.comprometido)}</td>
              <td className="py-1 pr-3 text-right tabular-nums">{euros(cuenta.aportado)}</td>
              <td className="py-1 pr-3 text-right tabular-nums">{euros(cuenta.repartido)}</td>
              <td className="py-1 text-right tabular-nums">{fmtInt(cuenta.contactos.length)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-subtle font-semibold text-icam-900">
            <td className="py-2 pr-3">
              {fmtInt(cuentas.length)} {cuentas.length === 1 ? "cuenta" : "cuentas"}
            </td>
            <td className="py-2 pr-3" />
            <td className="py-2 pr-3 text-right tabular-nums">{euros(total.capital)}</td>
            <td className="py-2 pr-3 text-right tabular-nums">{euros(total.aportado)}</td>
            <td className="py-2 pr-3 text-right tabular-nums">{euros(total.repartido)}</td>
            <td className="py-2 text-right tabular-nums">{fmtInt(total.contactos)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
