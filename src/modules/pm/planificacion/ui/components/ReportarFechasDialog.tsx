"use client";

import { useState } from "react";
import { createPortal } from "react-dom";

import {
  reportarFechas,
  type ReportarFechasResult,
} from "@/modules/pm/planificacion/actions/reportar-fechas";

interface ReportarFechasDialogProps {
  activoId: string;
  snapshotCode: string;
  /** Etiqueta del trimestre («Q4 2025»). */
  label: string;
  /** true cuando no quedan discrepancias pendientes. */
  listo: boolean;
  onError: (mensaje: string) => void;
}

/** dd/mm/aaaa con año completo: es como se escriben las fechas en el maestro. */
function fechaExcel(iso: string | null): string {
  if (!iso) return "";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

/**
 * «Reportar fechas»: tras validar el trimestre, lleva las fechas oficiales al
 * maestro. En modo manual (el de arranque, y el fallback permanente si el
 * write-back por Graph no supera el spike) muestra las celdas DW-EL con su
 * valor y botones de copiar para pegarlas en el Excel.
 */
export function ReportarFechasDialog({
  activoId,
  snapshotCode,
  label,
  listo,
  onError,
}: ReportarFechasDialogProps) {
  const [pending, setPending] = useState(false);
  const [reporte, setReporte] = useState<Extract<ReportarFechasResult, { ok: true }> | null>(
    null,
  );
  const [copiada, setCopiada] = useState<string | null>(null);

  const abrir = async () => {
    setPending(true);
    const r = await reportarFechas({ activoId, snapshotCode });
    setPending(false);
    if (!r.ok) {
      onError(r.error);
      return;
    }
    setReporte(r);
  };

  const copiar = async (letra: string, valor: string) => {
    try {
      await navigator.clipboard.writeText(valor);
      setCopiada(letra);
    } catch {
      onError("No se pudo copiar al portapapeles");
    }
  };

  return (
    <>
      <button
        type="button"
        disabled={!listo || pending}
        onClick={abrir}
        title={
          listo
            ? "Preparar el reporte de las fechas validadas para el Excel maestro"
            : "Resuelve las discrepancias pendientes antes de reportar"
        }
        className="w-fit rounded border border-icam-900/30 px-1.5 py-0.5 text-left text-[9px] font-medium text-icam-900 hover:bg-icam-900/5 disabled:cursor-default disabled:opacity-40"
      >
        Reportar fechas
      </button>

      {reporte && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-[90] flex items-center justify-center bg-black/30 p-4"
              onClick={() => setReporte(null)}
            >
              <div
                role="dialog"
                aria-label="Reportar fechas al maestro"
                className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-lg border border-subtle/60 bg-card p-4 shadow-xl"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className="text-sm font-semibold text-text-primary">
                  Reportar fechas al maestro — {reporte.proyecto} · {label}
                </h3>
                <p className="mt-1 text-[11px] leading-snug text-text-muted">
                  Pega estos valores en la fila de {reporte.proyecto} con Trimestre{" "}
                  {label} de la hoja «Tabla madre». La app no escribe el Excel:
                  este reporte queda registrado en la auditoría.
                </p>
                {reporte.proyectoCompartido ? (
                  <p className="mt-1.5 rounded border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] text-amber-800">
                    Otro proyecto de PM comparte esta línea del maestro (caso
                    PC25): este reporte solo cubre los hitos de este proyecto.
                  </p>
                ) : null}

                <table className="mt-3 w-full text-xs">
                  <thead>
                    <tr className="border-b border-subtle/60 text-left text-[10px] uppercase tracking-wide text-text-muted">
                      <th className="py-1 pr-2">Celda</th>
                      <th className="py-1 pr-2">Columna</th>
                      <th className="py-1 pr-2">Valor</th>
                      <th className="py-1" />
                    </tr>
                  </thead>
                  <tbody>
                    {reporte.fechas.map((f) => {
                      const valor = fechaExcel(f.fecha);
                      return (
                        <tr key={f.letra} className="border-b border-subtle/30">
                          <td className="py-1.5 pr-2 font-mono text-[11px] text-text-muted">
                            {f.letra}
                          </td>
                          <td className="py-1.5 pr-2 text-text-body">{f.columna}</td>
                          <td className="py-1.5 pr-2 tabular-nums text-text-body">
                            {valor || <span className="text-text-muted">vacío</span>}
                          </td>
                          <td className="py-1.5 text-right">
                            <button
                              type="button"
                              className="rounded border border-subtle px-1.5 py-0.5 text-[10px] text-text-body hover:bg-page"
                              onClick={() => void copiar(f.letra, valor)}
                            >
                              {copiada === f.letra ? "Copiado ✓" : "Copiar"}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    className="rounded-md border border-subtle px-3 py-1.5 text-xs text-text-body hover:bg-page"
                    onClick={() => setReporte(null)}
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
