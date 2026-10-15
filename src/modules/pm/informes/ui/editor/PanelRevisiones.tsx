"use client";

import type { RevisionInforme, TipoRevision } from "../../types";
import { Boton, fechaCorta } from "../componentes";

const TIPO: Record<TipoRevision, string> = {
  instruccion: "Instrucción al informe",
  correccion: "Corrección",
  coherencia: "Coherencia aplicada",
  desdoblar: "Desdoblar",
  fusionar: "Fusionar",
  duplicar: "Duplicar",
  nueva: "Slide nueva",
  analisis: "Revisión del análisis",
};

/** Historial de revisiones del informe, con «Deshacer» para las que cambiaron slides. */
export function PanelRevisiones({
  revisiones,
  puedeEditar,
  ocupado,
  deshacer,
}: {
  /** null: cargando; texto: no se ha podido leer (p. ej. falta la migración 050). */
  revisiones: RevisionInforme[] | string | null;
  puedeEditar: boolean;
  ocupado: boolean;
  deshacer: (r: RevisionInforme) => void;
}) {
  return (
    <details className="rounded-lg border border-subtle/50 bg-card p-4 shadow-sm">
      <summary className="cursor-pointer text-sm font-semibold text-text-primary">
        Historial de revisiones{Array.isArray(revisiones) && revisiones.length ? ` (${revisiones.length})` : ""}
      </summary>
      {revisiones === null ? (
        <p className="mt-2 text-sm text-text-muted">Cargando…</p>
      ) : typeof revisiones === "string" ? (
        <p className="mt-2 text-sm text-text-muted">No se puede leer el historial de revisiones: {revisiones}</p>
      ) : !revisiones.length ? (
        <p className="mt-2 text-sm text-text-muted">Todavía no hay revisiones.</p>
      ) : (
        <ul className="mt-2 flex flex-col gap-2 text-sm">
          {revisiones.map((r) => (
            <li key={r.id} className={`rounded-md border border-subtle/60 p-2 ${r.deshecha ? "opacity-50" : ""}`}>
              <div className="flex flex-wrap items-baseline gap-x-1.5">
                <span className="text-text-muted">{fechaCorta(r.fecha)}</span>
                {r.autor ? <b>{r.autor}</b> : null}
                <span>· {TIPO[r.tipo] ?? r.tipo}</span>
                {r.deshecha ? <span className="text-text-muted">· deshecha</span> : null}
                {puedeEditar && !r.deshecha && (r.antes.length || r.despues.length) ? (
                  <Boton variante="texto" className="ml-auto !text-xs" disabled={ocupado} onClick={() => deshacer(r)}>
                    Deshacer
                  </Boton>
                ) : null}
              </div>
              {r.instruccion ? <p className="mt-1 whitespace-pre-line text-text-primary">{r.instruccion}</p> : null}
              {r.resumen ? <p className="mt-1 whitespace-pre-line text-text-muted">{r.resumen}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </details>
  );
}
