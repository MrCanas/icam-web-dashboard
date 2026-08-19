"use client";

import { useState } from "react";
import Link from "next/link";

import { AVANCE_OBRA_HUB_PATH } from "@/modules/pm/avance/logic/avance-paths";
import {
  fmtPorcentaje,
  generalDivergeDeFases,
} from "@/modules/pm/avance/logic/avance-obra";
import type { PmAvanceProyecto } from "@/modules/pm/avance/types";
import { AvanceFaseRow } from "./AvanceFaseRow";

interface AvanceObraPanelProps {
  data: PmAvanceProyecto;
  hasWriteAccess: boolean;
}

/**
 * El cuerpo de la pestaña. Es cliente porque las barras se editan en línea y el
 * error de una edición se muestra arriba, compartido por todas.
 */
export function AvanceObraPanel({ data, hasWriteAccess }: AvanceObraPanelProps) {
  const [error, setError] = useState<string | null>(null);
  const { promocion, general, fases, pendientes } = data;

  const divergencia = generalDivergeDeFases(
    general?.porcentaje ?? null,
    fases.map((f) => f.porcentaje),
  );
  const pendientesSinAprobar = pendientes.filter((p) => p.estado === "pendiente");

  return (
    <div className="space-y-4 min-w-0">
      {error ? (
        <div
          role="alert"
          className="flex items-start justify-between gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="shrink-0 font-medium">
            Cerrar
          </button>
        </div>
      ) : null}

      <section className="overflow-hidden rounded-lg border border-subtle/50 bg-card shadow-sm">
        <div className="h-[3px] bg-icam-gold" />
        <div className="space-y-3 p-4">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2 className="text-xs font-medium uppercase tracking-wider text-text-muted">
              Promoción en Zoho
            </h2>
            <span className="text-sm font-semibold text-text-primary">
              {promocion.codigo_promocion}
            </span>
            {promocion.nombre ? (
              <span className="text-sm text-text-muted">{promocion.nombre}</span>
            ) : null}
            {promocion.situacion ? (
              <span className="rounded-full bg-subtle px-2 py-0.5 text-xs text-text-muted">
                {promocion.situacion}
              </span>
            ) : null}
          </div>

          {general ? (
            <AvanceFaseRow
              promocionId={promocion.id}
              faseId={general.fase.id}
              nombre={general.fase.nombre}
              porcentaje={general.porcentaje}
              porcentajeZoho={general.porcentajeZoho}
              destacado
              hasWriteAccess={hasWriteAccess}
              onError={setError}
            />
          ) : null}

          <p className="rounded border border-subtle/60 bg-page px-2 py-1.5 text-xs leading-snug text-text-muted">
            «Avance general» es el valor que reporta Zoho, no la media de las fases: aquí no se
            recalcula nada.
            {divergencia.diverge ? (
              <>
                {" "}
                En esta promoción no cuadran —las fases con dato promedian{" "}
                <span className="font-medium text-text-body">
                  {fmtPorcentaje(divergencia.mediaFases)}
                </span>
                —, y es lo esperable: Zoho pondera cada fase a su manera.
              </>
            ) : null}
          </p>
        </div>
      </section>

      <section className="space-y-4 rounded-lg border border-subtle/50 bg-card p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-icam-900">Fases de obra</h2>
        {fases.length === 0 ? (
          <p className="text-sm text-text-muted">El catálogo de fases está vacío.</p>
        ) : (
          <div className="space-y-3">
            {fases.map((f) => (
              <AvanceFaseRow
                key={f.fase.id}
                promocionId={promocion.id}
                faseId={f.fase.id}
                nombre={f.fase.nombre}
                porcentaje={f.porcentaje}
                porcentajeZoho={f.porcentajeZoho}
                hasWriteAccess={hasWriteAccess}
                onError={setError}
              />
            ))}
          </div>
        )}
        <p className="text-xs leading-snug text-text-muted">
          «—» es <span className="font-medium">sin dato en Zoho</span>, que no es lo mismo que
          0 %. {hasWriteAccess ? "El aspa vacía el dato." : null}
        </p>
      </section>

      {pendientesSinAprobar.length > 0 ? (
        <section className="rounded-lg border border-amber-200 bg-amber-50/60 p-4">
          <h2 className="text-sm font-semibold text-amber-800">
            {pendientesSinAprobar.length} cambio
            {pendientesSinAprobar.length === 1 ? "" : "s"} sin comunicar a Zoho
          </h2>
          <ul className="mt-2 space-y-1 text-xs text-amber-900">
            {pendientesSinAprobar.map((p) => (
              <li key={p.id}>
                {p.fase_nombre}: {fmtPorcentaje(p.porcentaje_zoho)} →{" "}
                <span className="font-medium">{fmtPorcentaje(p.porcentaje_nuevo)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs leading-snug text-amber-800">
            Nada se envía automáticamente. Un administrador de PM tiene que aprobarlo en{" "}
            <Link href={AVANCE_OBRA_HUB_PATH} className="font-medium underline">
              Avance de obra · bandeja de salida
            </Link>
            .
          </p>
        </section>
      ) : null}
    </div>
  );
}
