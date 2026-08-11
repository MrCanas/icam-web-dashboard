"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { PmHitoEnriched } from "@/modules/pm/data/pmRepository";
import type { PmHitoCatalogo, PmSnapshot } from "@/modules/pm/types";
import { archivarHito } from "@/modules/pm/planificacion/actions/archivar-hito";
import {
  formatFechaCorta,
  GRID_BASE_CLASS,
  planificacionGridTemplate,
  snapshotLabel,
  type Anchos,
  type ColumnaFijaKey,
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
  fijasVisibles: ColumnaFijaKey[];
  snapshots: PmSnapshot[];
  anchos: Anchos;
  retirados: Set<string>;
  hasWriteAccess: boolean;
  seleccionado: boolean;
  onToggleSeleccion: (hitoId: string) => void;
  onError: (message: string) => void;
  onArchivado: (mensaje: string) => void;
}

export function PlanificacionHitoRow({
  hito,
  catalogo,
  fijasVisibles,
  snapshots,
  anchos,
  retirados,
  hasWriteAccess,
  seleccionado,
  onToggleSeleccion,
  onError,
  onArchivado,
}: PlanificacionHitoRowProps) {
  const router = useRouter();
  // El estado optimista vive aquí, en la fila: las celdas son controladas y solo
  // notifican. Mismo reparto que ActasElementRow.
  const [fecha, setFecha] = useState<string | null>(hito.fecha_actual);
  const [snapshotsLocal, setSnapshotsLocal] = useState<Record<string, string | null>>(
    hito.snapshots,
  );
  const [pending, startTransition] = useTransition();

  // Resincronizar cuando el servidor manda datos nuevos (router.refresh o pegado
  // en bloque): ajuste de estado durante el render, sin efecto, para no
  // encadenar renders (react.dev/learn/you-might-not-need-an-effect).
  const [hitoPrevio, setHitoPrevio] = useState(hito);
  if (hitoPrevio.fecha_actual !== hito.fecha_actual || hitoPrevio.snapshots !== hito.snapshots) {
    setHitoPrevio(hito);
    setFecha(hito.fecha_actual);
    setSnapshotsLocal(hito.snapshots);
  }

  const archivado = Boolean(hito.archivado_at);

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

  const toggleArchivar = () => {
    startTransition(async () => {
      const r = await archivarHito(hito.id, !archivado);
      if (!r.ok) {
        onError(r.error);
        return;
      }
      onArchivado(
        r.archivado
          ? `«${hito.hito}» archivado. Sale del Gantt y del detalle; sus fechas se conservan.`
          : `«${hito.hito}» restaurado.`,
      );
      router.refresh();
    });
  };

  const celdaFija = (key: ColumnaFijaKey) => {
    switch (key) {
      case "hito":
        return (
          <span
            key={key}
            className={`flex min-w-0 items-center gap-1.5 text-sm font-medium ${
              archivado
                ? "text-text-muted line-through decoration-text-muted/40"
                : "text-text-body"
            }`}
            title={hito.hito}
          >
            {catalogo?.color ? (
              <span
                aria-hidden
                className="inline-block h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: catalogo.color, opacity: archivado ? 0.4 : 1 }}
              />
            ) : null}
            <span className="truncate">{hito.hito}</span>
            {catalogo?.es_puntual ? (
              <span
                className="shrink-0 text-[10px] text-text-muted"
                title="Hito puntual: un trimestre exacto en el Gantt"
              >
                ·
              </span>
            ) : null}
          </span>
        );
      case "tabla_madre":
        return (
          <span
            key={key}
            className={`inline-flex w-fit items-center rounded border px-1.5 py-0.5 text-[10px] font-medium ${BADGE[estado]}`}
            title={tituloMapeo}
          >
            {ETIQUETA_MAPEO[estado]}
          </span>
        );
      case "orden":
        return (
          <span key={key} className="text-xs tabular-nums text-text-muted">
            {hito.orden_hito}
          </span>
        );
      case "prevision":
        return archivado ? (
          <span key={key} className="truncate text-xs tabular-nums text-text-muted">
            {formatFechaCorta(fecha) ?? "—"}
          </span>
        ) : (
          <PlanificacionFechaCell
            key={key}
            hitoId={hito.id}
            fecha={fecha}
            target={{ tipo: "prevision" }}
            readOnly={!hasWriteAccess}
            onFechaChange={setFecha}
            onError={onError}
          />
        );
    }
  };

  return (
    <div
      className={`group/row relative ${GRID_BASE_CLASS} border-b border-subtle/60 px-3 py-1.5 ${
        archivado ? "bg-subtle/20" : "hover:bg-page/60"
      } ${seleccionado ? "bg-icam-900/[0.04]" : ""}`}
      style={{
        gridTemplateColumns: planificacionGridTemplate(
          fijasVisibles,
          snapshots.map((s) => s.snapshot_code),
          anchos,
        ),
      }}
    >
      {archivado ? (
        // Los archivados no entran en la selección múltiple ni en el
        // desplazamiento en bloque: no aplican a este proyecto.
        <button
          type="button"
          disabled={!hasWriteAccess || pending}
          onClick={toggleArchivar}
          title="Restaurar este hito"
          aria-label={`Restaurar ${hito.hito}`}
          className="text-xs font-medium text-icam-900 hover:underline disabled:opacity-40"
        >
          ↩
        </button>
      ) : (
        <input
          type="checkbox"
          checked={seleccionado}
          disabled={!hasWriteAccess}
          aria-label={`Seleccionar ${hito.hito}`}
          className="h-3.5 w-3.5 accent-icam-900 disabled:opacity-40"
          onChange={() => onToggleSeleccion(hito.id)}
          onClick={(e) => e.stopPropagation()}
        />
      )}

      {fijasVisibles.map(celdaFija)}

      {snapshots.map((s) => {
        const iso = snapshotsLocal[s.snapshot_code] ?? null;
        const txt = formatFechaCorta(iso);
        const retirado = retirados.has(`${hito.activo_id}|${s.snapshot_code}`);
        const label = snapshotLabel(s);
        return (
          <PlanificacionFechaCell
            key={s.snapshot_code}
            hitoId={hito.id}
            fecha={iso}
            target={{ tipo: "snapshot", snapshotCode: s.snapshot_code, label }}
            readOnly={!hasWriteAccess || archivado}
            muted={retirado || archivado}
            title={
              txt
                ? `${label}: ${txt}${
                    retirado ? " · retirado del Overview en este proyecto" : ""
                  }`
                : `${label}: sin fecha reportada`
            }
            onFechaChange={(nueva) =>
              setSnapshotsLocal((prev) => ({ ...prev, [s.snapshot_code]: nueva }))
            }
            onError={onError}
          />
        );
      })}

      {!archivado && hasWriteAccess ? (
        <button
          type="button"
          disabled={pending}
          onClick={toggleArchivar}
          title="Archivar: este hito no aplica a este proyecto. No borra sus fechas."
          className="absolute right-2 top-1/2 hidden -translate-y-1/2 rounded border border-subtle bg-card px-1.5 py-0.5 text-[10px] text-text-muted shadow-sm hover:text-text-body group-hover/row:inline-block disabled:opacity-40"
        >
          Archivar
        </button>
      ) : null}
    </div>
  );
}
