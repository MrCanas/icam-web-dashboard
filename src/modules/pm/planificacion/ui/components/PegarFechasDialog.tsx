"use client";

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";

import {
  mapPasteAFilas,
  parseClipboardFechas,
} from "@/modules/pm/planificacion/logic/planificacion-paste";
import { formatFechaCorta } from "@/modules/pm/planificacion/logic/planificacion-display";
import type { FechaCellTarget } from "./PlanificacionFechaCell";

interface PegarFechasDialogProps {
  /** Hitos visibles del proyecto abierto, en su orden en la rejilla. */
  hitos: { id: string; nombre: string }[];
  /** Columnas donde se puede pegar: Previsión + trimestres visibles. */
  destinos: { target: FechaCellTarget; etiqueta: string }[];
  /** El mismo aplicador que el Ctrl+V en celda (optimista + toast + refresh). */
  onAplicar: (hitoIdAncla: string, target: FechaCellTarget, texto: string) => void;
}

/**
 * «Pegar desde Excel» con las cosas a la vista: eliges columna de destino y
 * desde qué hito, pegas el texto y ves EXACTAMENTE qué fecha va a cada hito
 * antes de aplicar. El Ctrl+V directo sobre una celda sigue funcionando; esto
 * es el camino guiado.
 */
export function PegarFechasDialog({ hitos, destinos, onAplicar }: PegarFechasDialogProps) {
  const [open, setOpen] = useState(false);
  const [destinoIdx, setDestinoIdx] = useState(0);
  const [anclaId, setAnclaId] = useState<string>(hitos[0]?.id ?? "");
  const [texto, setTexto] = useState("");

  const nombrePorId = useMemo(() => new Map(hitos.map((h) => [h.id, h.nombre])), [hitos]);

  const abrir = () => {
    setDestinoIdx(0);
    setAnclaId(hitos[0]?.id ?? "");
    setTexto("");
    setOpen(true);
  };

  const preview = useMemo(() => {
    if (!texto.trim()) return null;
    const parsed = parseClipboardFechas(texto);
    if (parsed.errores.length > 0) return { ...parsed, items: [] as { nombre: string; fecha: string | null }[] };
    const items = mapPasteAFilas(
      anclaId,
      hitos.map((h) => h.id),
      parsed.fechas,
    ).map((it) => ({ nombre: nombrePorId.get(it.hitoId) ?? it.hitoId, fecha: it.fecha }));
    return { ...parsed, items };
  }, [texto, anclaId, hitos, nombrePorId]);

  const recortadas =
    preview && preview.errores.length === 0
      ? Math.max(0, preview.fechas.length - preview.items.length)
      : 0;

  const aplicar = () => {
    const destino = destinos[destinoIdx];
    if (!destino || !preview || preview.errores.length > 0 || preview.items.length === 0) return;
    onAplicar(anclaId, destino.target, texto);
    setOpen(false);
  };

  if (hitos.length === 0 || destinos.length === 0) return null;

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        className="rounded border border-subtle px-2 py-1 text-xs text-text-body hover:bg-page"
        title="Copia una columna de fechas en Excel y pégala aquí con vista previa"
      >
        Pegar desde Excel
      </button>

      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-[90] flex items-center justify-center bg-black/30 p-4"
              onClick={() => setOpen(false)}
            >
              <div
                role="dialog"
      aria-modal="true"
                aria-label="Pegar fechas desde Excel"
                className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-lg border border-subtle/60 bg-card p-4 shadow-xl"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className="text-sm font-semibold text-text-primary">
                  Pegar fechas desde Excel
                </h3>
                <p className="mt-1 text-[11px] leading-snug text-text-muted">
                  En tu Excel, selecciona la columna de fechas (una fecha por
                  fila, en el mismo orden que los hitos de la rejilla), cópiala
                  (Ctrl+C) y pégala abajo (Ctrl+V). Una fila vacía borra la
                  fecha de ese hito.
                </p>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <label className="flex flex-col gap-1 text-[11px] font-medium text-text-muted">
                    Pegar en la columna
                    <select
                      value={destinoIdx}
                      onChange={(e) => setDestinoIdx(Number(e.target.value))}
                      className="rounded border border-subtle bg-page px-2 py-1 text-xs text-text-body"
                    >
                      {destinos.map((d, i) => (
                        <option key={d.etiqueta} value={i}>
                          {d.etiqueta}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-[11px] font-medium text-text-muted">
                    Empezando por el hito
                    <select
                      value={anclaId}
                      onChange={(e) => setAnclaId(e.target.value)}
                      className="rounded border border-subtle bg-page px-2 py-1 text-xs text-text-body"
                    >
                      {hitos.map((h) => (
                        <option key={h.id} value={h.id}>
                          {h.nombre}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <textarea
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  rows={5}
                  placeholder={"Pega aquí la columna copiada de Excel, p. ej.:\n30/06/2026\n15/09/2026\n\n01/12/2026"}
                  className="mt-2 w-full rounded border border-subtle bg-page px-2 py-1.5 font-mono text-xs text-text-body placeholder:text-text-muted/60 focus:outline-none focus:ring-1 focus:ring-icam-900/20"
                />

                {preview && preview.errores.length > 0 ? (
                  <div className="mt-2 rounded border border-red-200 bg-red-50 px-2 py-1.5 text-[11px] text-red-700">
                    No se pegará nada hasta corregir esto:
                    <ul className="mt-0.5 list-inside list-disc">
                      {preview.errores.slice(0, 4).map((e) => (
                        <li key={e.linea}>
                          Línea {e.linea}: {e.motivo}
                        </li>
                      ))}
                      {preview.errores.length > 4 ? (
                        <li>… y {preview.errores.length - 4} más</li>
                      ) : null}
                    </ul>
                  </div>
                ) : null}

                {preview && preview.errores.length === 0 && preview.items.length > 0 ? (
                  <div className="mt-2 rounded border border-subtle/60">
                    <p className="border-b border-subtle/40 bg-page/60 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-text-muted">
                      Así quedará · {preview.items.length}{" "}
                      {preview.items.length === 1 ? "hito" : "hitos"}
                      {preview.multiColumna ? " · solo la 1ª columna del pegado" : ""}
                      {recortadas > 0
                        ? ` · ${recortadas} ${recortadas === 1 ? "fecha sobra" : "fechas sobran"} (no hay más hitos debajo)`
                        : ""}
                    </p>
                    <div className="max-h-44 overflow-y-auto">
                      {preview.items.map((it, i) => (
                        <div
                          key={`${i}-${it.nombre}`}
                          className="flex items-center justify-between border-b border-subtle/30 px-2 py-1 text-xs last:border-b-0"
                        >
                          <span className="truncate text-text-body">{it.nombre}</span>
                          <span className="ml-2 shrink-0 tabular-nums text-text-body">
                            {formatFechaCorta(it.fecha) ?? (
                              <span className="text-text-muted">quitar fecha</span>
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="mt-3 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    className="rounded-md border border-subtle px-3 py-1.5 text-xs text-text-body hover:bg-page"
                    onClick={() => setOpen(false)}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={
                      !preview || preview.errores.length > 0 || preview.items.length === 0
                    }
                    className="rounded-md bg-icam-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-icam-800 disabled:opacity-50"
                    onClick={aplicar}
                  >
                    Aplicar {preview?.items.length ? `(${preview.items.length})` : ""}
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
