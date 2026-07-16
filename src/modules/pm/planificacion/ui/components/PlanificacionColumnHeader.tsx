"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { PmSnapshot } from "@/modules/pm/types";
import { toggleSnapshotVisible } from "@/modules/pm/planificacion/actions/toggle-snapshot-visible";
import {
  GRID_BASE_CLASS,
  planificacionGridTemplate,
  snapshotLabel,
} from "@/modules/pm/planificacion/logic/planificacion-display";

const TH = "text-[10px] font-semibold uppercase tracking-wide text-text-muted";

interface PlanificacionColumnHeaderProps {
  snapshots: PmSnapshot[];
  hasWriteAccess: boolean;
  todosSeleccionados: boolean;
  onToggleTodos: () => void;
  onError: (message: string) => void;
}

/**
 * Cabecera de la rejilla. Cada columna de snapshot lleva su check de PUBLICAR,
 * que decide si ese trimestre aparece en el Overview.
 *
 * Ojo: esto no es lo mismo que ocultar la columna (control de arriba del
 * tablero). Publicar es una decisión de reporte, global y persistida; ocultar es
 * comodidad de quien está editando y solo afecta a su navegador.
 */
export function PlanificacionColumnHeader({
  snapshots,
  hasWriteAccess,
  todosSeleccionados,
  onToggleTodos,
  onError,
}: PlanificacionColumnHeaderProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [optimista, setOptimista] = useState<Record<string, boolean>>({});

  const visible = (s: PmSnapshot) => optimista[s.snapshot_code] ?? s.visible_en_dashboard;

  const togglePublicar = (s: PmSnapshot) => {
    const siguiente = !visible(s);
    setOptimista((o) => ({ ...o, [s.snapshot_code]: siguiente }));
    startTransition(async () => {
      const r = await toggleSnapshotVisible({
        snapshotCode: s.snapshot_code,
        visible: siguiente,
      });
      if (!r.ok) {
        setOptimista((o) => ({ ...o, [s.snapshot_code]: !siguiente }));
        onError(r.error);
        return;
      }
      router.refresh();
    });
  };

  return (
    <div
      className={`sticky top-0 z-10 ${GRID_BASE_CLASS} border-b border-subtle/60 bg-page/95 px-3 py-1.5 backdrop-blur`}
      style={{ gridTemplateColumns: planificacionGridTemplate(snapshots.length) }}
    >
      <input
        type="checkbox"
        checked={todosSeleccionados}
        disabled={!hasWriteAccess}
        aria-label="Seleccionar todos los hitos"
        className="h-3.5 w-3.5 accent-icam-900 disabled:opacity-40"
        onChange={onToggleTodos}
      />
      <span className={TH}>Hito</span>
      <span className={TH}>Tabla madre</span>
      <span className={TH}>Ord.</span>
      <span className={TH}>Previsión</span>

      {snapshots.map((s) => (
        <div key={s.snapshot_code} className="flex min-w-0 flex-col gap-0.5">
          <span className={`${TH} truncate`} title={s.snapshot_code}>
            {snapshotLabel(s)}
          </span>
          <label
            className={`flex cursor-pointer items-center gap-1 text-[9px] ${
              visible(s) ? "text-icam-900" : "text-text-muted"
            } ${hasWriteAccess ? "" : "cursor-default opacity-60"}`}
            title={
              visible(s)
                ? "Se muestra en el Overview. Desmárcalo para dejar de publicarlo (no borra fechas)."
                : "Oculto en el Overview. Las fechas siguen guardadas."
            }
          >
            <input
              type="checkbox"
              checked={visible(s)}
              disabled={!hasWriteAccess || pending}
              className="h-2.5 w-2.5 accent-icam-900"
              onChange={() => togglePublicar(s)}
            />
            publicar
          </label>
        </div>
      ))}
    </div>
  );
}
