"use client";

import { useMemo } from "react";

import { diferenciasTexto } from "../../logic/operaciones";
import type { MetaInforme, SlideJson } from "../../slides/tipos";
import { Boton } from "../componentes";
import { VisorSlide } from "../slides/VisorSlide";

/**
 * Una slide frente a su versión del informe anterior: las dos pintadas lado a
 * lado y la lista de textos que entran y salen.
 */
export function VistaComparar({
  actual,
  previa,
  pagina,
  meta,
  metaPrevia,
  trimestreAnterior,
  onCerrar,
}: {
  actual: SlideJson;
  previa: SlideJson;
  pagina: number;
  meta: MetaInforme;
  metaPrevia: MetaInforme | null;
  trimestreAnterior: string;
  onCerrar: () => void;
}) {
  const d = useMemo(() => diferenciasTexto(previa, actual), [previa, actual]);
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-subtle bg-card p-3 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-text-primary">Comparación con el {trimestreAnterior}</h3>
        <Boton pequeno onClick={onCerrar}>
          Cerrar
        </Boton>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <figure className="flex flex-col gap-1">
          <figcaption className="text-xs font-medium text-text-muted">{trimestreAnterior}</figcaption>
          <VisorSlide slide={previa} pagina={pagina} meta={metaPrevia ?? meta} sinMarcas className="rounded-md border border-subtle" />
        </figure>
        <figure className="flex flex-col gap-1">
          <figcaption className="text-xs font-medium text-text-muted">Ahora</figcaption>
          <VisorSlide slide={actual} pagina={pagina} meta={meta} sinMarcas className="rounded-md border border-subtle" />
        </figure>
      </div>
      <div className="grid gap-3 text-sm md:grid-cols-2">
        <div>
          <h4 className="font-semibold text-red-700">Sale ({d.quitados.length})</h4>
          {d.quitados.length ? (
            <ul className="mt-1 list-disc space-y-0.5 pl-5 text-text-muted">
              {d.quitados.map((t, i) => (
                <li key={i} className="line-through">
                  {t}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-text-muted">Nada.</p>
          )}
        </div>
        <div>
          <h4 className="font-semibold text-green-800">Entra ({d.anadidos.length})</h4>
          {d.anadidos.length ? (
            <ul className="mt-1 list-disc space-y-0.5 pl-5">
              {d.anadidos.map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ul>
          ) : (
            <p className="text-text-muted">Nada.</p>
          )}
        </div>
      </div>
      <p className="text-xs text-text-muted">{d.iguales} texto(s) se mantienen igual.</p>
    </div>
  );
}
