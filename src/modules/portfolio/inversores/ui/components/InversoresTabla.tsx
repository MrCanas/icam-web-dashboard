"use client";

import { useMemo, useState } from "react";

import { fmtEurosCompact, fmtInt } from "@/lib/formatters";
import { capitalDe } from "@/modules/portfolio/inversores/logic/inversoresModel";
import type { CuentaInversion } from "@/modules/portfolio/inversores/types";

type Columna = "nombre" | "estado" | "comprometido" | "aportado" | "repartido" | "neto" | "contactos";
type Sentido = "asc" | "desc";

interface Props {
  cuentas: CuentaInversion[];
  onAbrirCuenta: (cuenta: CuentaInversion) => void;
}

function euros(valor: number | null): string {
  return valor === null || !Number.isFinite(valor) ? "—" : fmtEurosCompact(valor);
}

function compararTexto(a: string | null, b: string | null): number {
  return (a ?? "").localeCompare(b ?? "", "es", { sensitivity: "base" });
}

/** Los nulos al final en los dos sentidos: un hueco no es ni el mayor ni el menor. */
function compararNumero(a: number | null, b: number | null, sentido: Sentido): number {
  const faltaA = a === null || !Number.isFinite(a);
  const faltaB = b === null || !Number.isFinite(b);
  if (faltaA && faltaB) return 0;
  if (faltaA) return 1;
  if (faltaB) return -1;
  const orden = (a as number) - (b as number);
  return sentido === "asc" ? orden : -orden;
}

function Cabecera({
  columna,
  etiqueta,
  activa,
  sentido,
  onOrdenar,
  alineada,
}: {
  columna: Columna;
  etiqueta: string;
  activa: Columna;
  sentido: Sentido;
  onOrdenar: (columna: Columna) => void;
  alineada?: "right";
}) {
  const esActiva = activa === columna;
  return (
    <th
      scope="col"
      aria-sort={esActiva ? (sentido === "asc" ? "ascending" : "descending") : "none"}
      className={`cursor-pointer select-none py-2 pr-3 hover:bg-subtle/30 ${
        alineada === "right" ? "text-right" : "text-left"
      }`}
      onClick={() => onOrdenar(columna)}
    >
      {etiqueta}
      {esActiva ? <span aria-hidden="true"> {sentido === "asc" ? "▲" : "▼"}</span> : null}
    </th>
  );
}

/**
 * Todas las cuentas, en texto.
 *
 * No es un extra de la pantalla: la regla de accesibilidad del portal dice que
 * nada puede quedar codificado solo por color o por altura de barra, así que
 * esta tabla repite en palabras lo que dicen las cuatro gráficas. Y de paso es
 * la única forma cómoda de buscar una cuenta concreta.
 */
export function InversoresTabla({ cuentas, onAbrirCuenta }: Props) {
  const [columna, setColumna] = useState<Columna>("comprometido");
  const [sentido, setSentido] = useState<Sentido>("desc");

  function ordenarPor(siguiente: Columna) {
    if (siguiente === columna) {
      setSentido((s) => (s === "asc" ? "desc" : "asc"));
      return;
    }
    setColumna(siguiente);
    setSentido(siguiente === "nombre" || siguiente === "estado" ? "asc" : "desc");
  }

  const ordenadas = useMemo(() => {
    const copia = [...cuentas];
    copia.sort((a, b) => {
      switch (columna) {
        case "nombre": {
          const orden = compararTexto(a.nombre, b.nombre);
          return sentido === "asc" ? orden : -orden;
        }
        case "estado": {
          const orden = compararTexto(a.estado, b.estado);
          return sentido === "asc" ? orden : -orden;
        }
        case "comprometido":
          return compararNumero(a.comprometido, b.comprometido, sentido);
        case "aportado":
          return compararNumero(a.aportado, b.aportado, sentido);
        case "repartido":
          return compararNumero(a.repartido, b.repartido, sentido);
        case "neto":
          return compararNumero(a.neto, b.neto, sentido);
        case "contactos":
          return compararNumero(a.contactos.length, b.contactos.length, sentido);
        default:
          return 0;
      }
    });
    return copia;
  }, [cuentas, columna, sentido]);

  const total = useMemo(
    () =>
      cuentas.reduce(
        (acc, cuenta) => ({
          capital: acc.capital + capitalDe(cuenta),
          aportado: acc.aportado + cuenta.aportado,
          repartido: acc.repartido + cuenta.repartido,
          neto: acc.neto + cuenta.neto,
          contactos: acc.contactos + cuenta.contactos.length,
        }),
        { capital: 0, aportado: 0, repartido: 0, neto: 0, contactos: 0 },
      ),
    [cuentas],
  );

  if (cuentas.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-subtle p-6 text-center text-sm text-text-muted">
        No hay cuentas de inversión sincronizadas.
      </p>
    );
  }

  return (
    <div className="max-h-[520px] overflow-auto overscroll-x-contain rounded-lg border border-subtle/50 bg-card">
      <table className="w-full min-w-[720px] text-sm">
        <caption className="sr-only">
          Cuentas de inversión con su capital, sus flujos y su número de contactos. Pulsa el nombre
          para ver los contactos de una cuenta.
        </caption>
        <thead className="sticky top-0 z-10 bg-card">
          <tr className="border-b border-subtle text-text-muted">
            <Cabecera columna="nombre" etiqueta="Cuenta" activa={columna} sentido={sentido} onOrdenar={ordenarPor} />
            <Cabecera columna="estado" etiqueta="Estado" activa={columna} sentido={sentido} onOrdenar={ordenarPor} />
            <Cabecera columna="comprometido" etiqueta="Comprometido" activa={columna} sentido={sentido} onOrdenar={ordenarPor} alineada="right" />
            <Cabecera columna="aportado" etiqueta="Aportado" activa={columna} sentido={sentido} onOrdenar={ordenarPor} alineada="right" />
            <Cabecera columna="repartido" etiqueta="Repartido" activa={columna} sentido={sentido} onOrdenar={ordenarPor} alineada="right" />
            <Cabecera columna="neto" etiqueta="Sigue puesto" activa={columna} sentido={sentido} onOrdenar={ordenarPor} alineada="right" />
            <Cabecera columna="contactos" etiqueta="Contactos" activa={columna} sentido={sentido} onOrdenar={ordenarPor} alineada="right" />
          </tr>
        </thead>
        <tbody>
          {ordenadas.map((cuenta) => (
            <tr key={cuenta.zohoId} className="border-b border-subtle/60 text-text-body last:border-b-0">
              <th scope="row" className="py-1 pr-3 text-left font-normal">
                <button
                  type="button"
                  onClick={() => onAbrirCuenta(cuenta)}
                  className="min-h-9 rounded text-left font-medium text-icam-900 underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-icam-900"
                >
                  {cuenta.nombre}
                </button>
              </th>
              <td className="py-1 pr-3 whitespace-nowrap">{cuenta.estado ?? "—"}</td>
              <td className="py-1 pr-3 text-right tabular-nums">{euros(cuenta.comprometido)}</td>
              <td className="py-1 pr-3 text-right tabular-nums">{euros(cuenta.aportado)}</td>
              <td className="py-1 pr-3 text-right tabular-nums">{euros(cuenta.repartido)}</td>
              <td className="py-1 pr-3 text-right tabular-nums">{euros(cuenta.neto)}</td>
              <td className="py-1 pr-3 text-right tabular-nums">{fmtInt(cuenta.contactos.length)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-subtle font-semibold text-icam-900">
            <td className="py-2 pr-3">{fmtInt(cuentas.length)} cuentas</td>
            <td className="py-2 pr-3" />
            <td className="py-2 pr-3 text-right tabular-nums">{euros(total.capital)}</td>
            <td className="py-2 pr-3 text-right tabular-nums">{euros(total.aportado)}</td>
            <td className="py-2 pr-3 text-right tabular-nums">{euros(total.repartido)}</td>
            <td className="py-2 pr-3 text-right tabular-nums">{euros(total.neto)}</td>
            <td className="py-2 pr-3 text-right tabular-nums">{fmtInt(total.contactos)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
