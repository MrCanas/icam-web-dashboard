"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { mapActivoProyecto } from "@/modules/pm/planificacion/actions/map-activo-proyecto";
import type { ProyectoFinancieroOption } from "@/modules/pm/planificacion/data/planificacionRepository";

interface MapeoProyectoCellProps {
  pmActivoId: string;
  valor: string | null;
  opciones: ProyectoFinancieroOption[];
  /** Cuántos activos de PM apuntan al mismo proyecto (caso PC25). */
  compartidoCon: number;
  hasWriteAccess: boolean;
  onError: (message: string) => void;
}

/**
 * Desplegable de mapeo al maestro financiero.
 *
 * Las opciones salen de la tabla `proyectos` (sincronizada desde la Tabla madre),
 * no de una lista escrita a mano: los códigos de PM y los del maestro no
 * coinciden por diseño (SE84 ↔ RETAIL SE84, SICC II ↔ VBARE), así que el
 * emparejamiento no se puede inferir y lo decide la PMO aquí.
 */
export function MapeoProyectoCell({
  pmActivoId,
  valor,
  opciones,
  compartidoCon,
  hasWriteAccess,
  onError,
}: MapeoProyectoCellProps) {
  const router = useRouter();
  const [actual, setActual] = useState<string | null>(valor);
  const [pending, startTransition] = useTransition();

  const guardar = (siguiente: string | null) => {
    const previo = actual;
    setActual(siguiente); // optimista
    startTransition(async () => {
      const r = await mapActivoProyecto({
        pmActivoId,
        proyectoFinancieroKey: siguiente,
      });
      if (!r.ok) {
        setActual(previo); // rollback
        onError(r.error);
        return;
      }
      router.refresh();
    });
  };

  if (!hasWriteAccess) {
    return (
      <span className="text-sm text-text-body">
        {actual ?? <span className="text-text-muted">— sin mapear —</span>}
      </span>
    );
  }

  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <select
        value={actual ?? ""}
        disabled={pending}
        className={`min-w-0 flex-1 rounded border bg-page px-1.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-icam-900/20 disabled:opacity-60 ${
          actual ? "border-subtle text-text-body" : "border-amber-300 text-text-muted"
        }`}
        onChange={(e) => guardar(e.target.value || null)}
      >
        <option value="">— sin mapear —</option>
        {opciones.map((o) => (
          <option key={o.proyecto} value={o.proyecto}>
            {o.proyecto}
            {o.situacion ? ` · ${o.situacion}` : ""}
          </option>
        ))}
      </select>
      {compartidoCon > 1 ? (
        <span
          className="shrink-0 rounded border border-icam-900/20 bg-icam-900/[0.06] px-1 py-0.5 text-[9px] font-medium text-icam-900"
          title={`Este proyecto financiero está compartido por ${compartidoCon} activos de PM. Es correcto cuando PM separa por uso lo que el maestro mantiene unido (PC25).`}
        >
          ×{compartidoCon}
        </span>
      ) : null}
    </div>
  );
}
