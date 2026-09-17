"use client";

import { useState } from "react";

import type { AvanceProyectoResult } from "@/modules/pm/avance/data/avanceRepository";

import { AvanceHistoricoTable } from "./AvanceHistoricoTable";
import { AvanceObraEstadoVacio } from "./AvanceObraEstadoVacio";
import { AvanceObraPanel } from "./AvanceObraPanel";

interface AvanceObraOperativoGroupProps {
  idActivo: string;
  resultado: AvanceProyectoResult;
  hasWriteAccess: boolean;
  /** Snapshot histórico (`?asOf=`): valores reconstruidos, sin edición. */
  readOnly: boolean;
}

/**
 * «Avance de obra» como primera categoría del Operativo de actas.
 *
 * No es una fila de `category`: no se arrastra, no se renombra ni se borra, y
 * sus «elementos» son las fases de Zoho. Imita la cabecera de
 * `ActasCategoryGroup` para que se lea como un grupo más del tablero.
 */
export function AvanceObraOperativoGroup({
  idActivo,
  resultado,
  hasWriteAccess,
  readOnly,
}: AvanceObraOperativoGroupProps) {
  const [expanded, setExpanded] = useState(true);
  const [verHistorico, setVerHistorico] = useState(false);
  const { data } = resultado;
  const nFases = data ? data.fases.length : 0;

  return (
    <section className="rounded-md overflow-hidden border border-subtle/50 shadow-sm">
      <div className="flex w-full items-center gap-2 bg-icam-900 px-3 py-2.5 text-left text-white">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-xs font-bold hover:bg-black/10"
          style={{ backgroundColor: "rgba(0,0,0,0.12)" }}
          aria-expanded={expanded}
          aria-label={expanded ? "Colapsar grupo" : "Expandir grupo"}
        >
          {expanded ? "▾" : "▸"}
        </button>
        <span className="min-w-0 flex-1 truncate text-sm font-semibold">Avance de obra</span>
        {data ? (
          <span className="shrink-0 text-xs font-medium opacity-90 tabular-nums">
            {data.promocion.codigo_promocion} · {nFases} {nFases === 1 ? "fase" : "fases"}
          </span>
        ) : null}
      </div>

      {expanded ? (
        <div className="space-y-4 bg-card p-4">
          {!data ? (
            <AvanceObraEstadoVacio
              idActivo={idActivo}
              sinPromocion={
                resultado.sinPromocion || (!resultado.migracionPendiente && !resultado.error)
              }
              migracionPendiente={resultado.migracionPendiente}
              error={resultado.error}
            />
          ) : (
            <>
              {!readOnly && !hasWriteAccess ? (
                <p className="text-xs text-amber-700">Tienes acceso de solo lectura.</p>
              ) : null}

              <AvanceObraPanel data={data} hasWriteAccess={hasWriteAccess && !readOnly} />

              <div>
                <button
                  type="button"
                  className="text-sm font-medium text-icam-900 hover:underline"
                  aria-expanded={verHistorico}
                  onClick={() => setVerHistorico((v) => !v)}
                >
                  {verHistorico ? "▾" : "▸"} Histórico de cambios
                </button>
                {verHistorico ? (
                  <div className="mt-2">
                    <AvanceHistoricoTable filas={data.historico} />
                  </div>
                ) : null}
              </div>
            </>
          )}
        </div>
      ) : null}
    </section>
  );
}
