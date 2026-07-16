"use client";

import { useState } from "react";

import type { PmHitoEnriched } from "@/modules/pm/data/pmRepository";
import type { PmHitoCatalogo, PmSnapshot } from "@/modules/pm/types";
import {
  formatFechaCorta,
  GRID_BASE_CLASS,
  planificacionGridTemplate,
} from "@/modules/pm/planificacion/logic/planificacion-display";
import {
  ETIQUETA_MAPEO,
  estadoMapeo,
  type EstadoMapeoTablaMadre,
} from "@/modules/pm/planificacion/logic/tabla-madre-columnas";

import { PlanificacionFechaCell } from "./PlanificacionFechaCell";

const BADGE: Record<EstadoMapeoTablaMadre, string> = {
  // Verde: el Financiero ya ve este hito en su hoja.
  en_tabla_madre: "bg-emerald-50 text-emerald-700 border-emerald-200",
  // Ámbar: mapeado pero la columna aún no existe en el Excel.
  propuesto: "bg-amber-50 text-amber-700 border-amber-200",
  sin_mapear: "bg-subtle/40 text-text-muted border-subtle",
};

interface PlanificacionHitoRowProps {
  hito: PmHitoEnriched;
  catalogo: PmHitoCatalogo | undefined;
  snapshots: PmSnapshot[];
  hasWriteAccess: boolean;
  seleccionado: boolean;
  onToggleSeleccion: (hitoId: string) => void;
  onError: (message: string) => void;
}

export function PlanificacionHitoRow({
  hito,
  catalogo,
  snapshots,
  hasWriteAccess,
  seleccionado,
  onToggleSeleccion,
  onError,
}: PlanificacionHitoRowProps) {
  // El estado optimista vive aquí, en la fila: las celdas son controladas y solo
  // notifican. Mismo reparto que ActasElementRow.
  const [fecha, setFecha] = useState<string | null>(hito.fecha_actual);

  const estado = estadoMapeo(
    catalogo?.tabla_madre_columna ?? null,
    catalogo?.tabla_madre_existe ?? false,
  );

  const tituloMapeo =
    estado === "en_tabla_madre"
      ? `Ya existe en la Tabla madre como «${catalogo?.tabla_madre_columna}»`
      : estado === "propuesto"
        ? `Propuesto: habría que crear la columna «${catalogo?.tabla_madre_columna}» en la Tabla madre`
        : "Sin mapear a la Tabla madre. El Financiero no ve este hito.";

  return (
    <div
      className={`group/row ${GRID_BASE_CLASS} border-b border-subtle/60 px-3 py-1.5 hover:bg-page/60 ${
        seleccionado ? "bg-icam-900/[0.04]" : ""
      }`}
      style={{ gridTemplateColumns: planificacionGridTemplate(snapshots.length) }}
    >
      <input
        type="checkbox"
        checked={seleccionado}
        disabled={!hasWriteAccess}
        aria-label={`Seleccionar ${hito.hito}`}
        className="h-3.5 w-3.5 accent-icam-900 disabled:opacity-40"
        onChange={() => onToggleSeleccion(hito.id)}
        onClick={(e) => e.stopPropagation()}
      />

      <span className="min-w-0 truncate text-sm font-medium text-text-body" title={hito.hito}>
        {catalogo?.color ? (
          <span
            aria-hidden
            className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle"
            style={{ backgroundColor: catalogo.color }}
          />
        ) : null}
        {hito.hito}
        {catalogo?.es_puntual ? (
          <span className="ml-1 text-[10px] text-text-muted" title="Hito puntual: un trimestre exacto en el Gantt">
            ·
          </span>
        ) : null}
      </span>

      <span
        className={`inline-flex w-fit items-center rounded border px-1.5 py-0.5 text-[10px] font-medium ${BADGE[estado]}`}
        title={tituloMapeo}
      >
        {ETIQUETA_MAPEO[estado]}
      </span>

      <span className="text-xs tabular-nums text-text-muted">{hito.orden_hito}</span>

      <PlanificacionFechaCell
        hitoId={hito.id}
        fecha={fecha}
        readOnly={!hasWriteAccess}
        onFechaChange={setFecha}
        onError={onError}
      />

      {snapshots.map((s) => {
        const iso = hito.snapshots[s.snapshot_code] ?? null;
        const txt = formatFechaCorta(iso);
        return (
          <span
            key={s.snapshot_code}
            className={`truncate text-xs tabular-nums ${
              s.visible_en_dashboard ? "text-text-body" : "text-text-muted/60"
            }`}
            title={
              txt
                ? `${s.snapshot_code}: ${txt} (congelado, solo lectura)`
                : `${s.snapshot_code}: sin previsión`
            }
          >
            {txt ?? <span className="text-text-muted">—</span>}
          </span>
        );
      })}
    </div>
  );
}
