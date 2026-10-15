"use client";

import { useState } from "react";

import { marcar, normalizarCoherencia, slidesDeAviso } from "../../logic/coherencia";
import type { IncidenciaCoherencia, QaInforme } from "../../types";
import { Boton, Chip, fechaCorta } from "../componentes";
import { Comentario } from "../asistente/ElementoEditable";

const ORIGEN: Record<NonNullable<IncidenciaCoherencia["origen"]>, string> = {
  coherencia: "revisión",
  correccion: "de una corrección",
  cronograma: "cronograma",
};

/**
 * «Coherencia entre slides» como lista de trabajo: cada aviso con su
 * comentario, «Aplicar» (Claude corrige las slides afectadas con la sugerencia
 * y el comentario) y «Descartar»; varios a la vez, y un comentario general
 * sobre la presentación que va con lo que se aplique.
 */
export function PanelCoherencia({
  qa,
  puedeEditar,
  ocupado,
  etiqueta,
  irA,
  guardarQa,
  aplicar,
}: {
  qa: QaInforme | null;
  puedeEditar: boolean;
  ocupado: boolean;
  /** «Slide 5 · Calendario» para un id. */
  etiqueta: (id: string) => string;
  irA: (id: string) => void;
  guardarQa: (qa: QaInforme) => void;
  /** Aplica con Claude los avisos dados (y el comentario general). */
  aplicar: (avisos: IncidenciaCoherencia[], general: string) => void;
}) {
  const todos = normalizarCoherencia(qa?.coherencia ?? []);
  const pendientes = todos.filter((x) => x.estado === "pendiente");
  const cerrados = todos.filter((x) => x.estado !== "pendiente");
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const general = qa?.comentarioGeneral ?? "";
  const elegidos = pendientes.filter((x) => marcados.has(x.id!));

  if (!todos.length && !puedeEditar) return null;

  const base: QaInforme = { coherencia: todos, fecha: qa?.fecha ?? new Date().toISOString(), ...(general ? { comentarioGeneral: general } : {}) };

  return (
    <div className="flex flex-col gap-2">
      <h3 className="pt-1 text-sm font-semibold text-text-primary">
        Coherencia entre slides {qa?.fecha ? <span className="font-normal text-text-muted">· {fechaCorta(qa.fecha)}</span> : null}
      </h3>
      {pendientes.length ? (
        <ul className="flex flex-col gap-2 text-sm">
          {pendientes.map((x) => (
            <li key={x.id} className="flex gap-2 rounded-md border border-subtle/60 p-2">
              {puedeEditar ? (
                <input
                  type="checkbox"
                  className="mt-1"
                  aria-label="Elegir para aplicar"
                  checked={marcados.has(x.id!)}
                  onChange={(e) =>
                    setMarcados((m) => {
                      const n = new Set(m);
                      if (e.target.checked) n.add(x.id!);
                      else n.delete(x.id!);
                      return n;
                    })
                  }
                />
              ) : null}
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div>
                  {slidesDeAviso(x).map((id) => (
                    <b key={id} className="mr-1.5">
                      {etiqueta(id)}
                    </b>
                  ))}
                  {x.origen && x.origen !== "coherencia" ? <Chip>{ORIGEN[x.origen]}</Chip> : null} · {x.problema}
                  {x.sugerencia ? <span className="text-text-muted"> → {x.sugerencia}</span> : null}
                </div>
                <Comentario
                  valor={x.comentario ?? ""}
                  puedeEditar={puedeEditar}
                  etiqueta="Comentario sobre este aviso"
                  onGuardar={(t) => guardarQa(marcar(base, [x.id!], { comentario: t }))}
                />
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                {x.slide ? (
                  <Boton variante="texto" className="!text-xs" onClick={() => irA(x.slide)}>
                    Ir
                  </Boton>
                ) : null}
                {puedeEditar ? (
                  <>
                    <Boton pequeno variante="primario" disabled={ocupado} onClick={() => aplicar([x], "")}>
                      Aplicar
                    </Boton>
                    <Boton pequeno disabled={ocupado} onClick={() => guardarQa(marcar(base, [x.id!], { estado: "descartado" }))}>
                      Descartar
                    </Boton>
                  </>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-text-muted">{todos.length ? "No quedan avisos pendientes." : "Pulsa «Revisar coherencia» para que Claude repase el informe."}</p>
      )}
      {puedeEditar ? (
        <div className="flex flex-col gap-1.5 rounded-md bg-page p-2">
          <Comentario
            valor={general}
            puedeEditar={puedeEditar}
            abiertoInicial
            etiqueta="Comentario general para modificar la presentación"
            onGuardar={(t) => guardarQa({ ...base, comentarioGeneral: t })}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Boton pequeno variante="primario" disabled={ocupado || (!elegidos.length && !general.trim())} onClick={() => aplicar(elegidos, general)}>
              {elegidos.length ? `Aplicar ${elegidos.length} aviso(s)${general.trim() ? " y el comentario" : ""}` : "Aplicar el comentario general"}
            </Boton>
            {pendientes.length > 1 ? (
              <Boton pequeno disabled={ocupado} onClick={() => setMarcados(new Set(pendientes.map((x) => x.id!)))}>
                Elegir todos
              </Boton>
            ) : null}
            <span className="text-xs text-text-muted">Se hace en una sola petición; queda en el historial de revisiones con «Deshacer».</span>
          </div>
        </div>
      ) : null}
      {cerrados.length ? (
        <details className="text-sm">
          <summary className="cursor-pointer text-text-muted">Aplicados o descartados ({cerrados.length})</summary>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-text-muted">
            {cerrados.map((x) => (
              <li key={x.id}>
                {x.estado === "aplicado" ? "Aplicado" : "Descartado"} · {slidesDeAviso(x).map(etiqueta).join(", ")} · {x.problema}
                {x.comentario ? ` (${x.comentario})` : ""}
                {puedeEditar && x.estado === "descartado" ? (
                  <Boton variante="texto" className="ml-1 !text-xs" onClick={() => guardarQa(marcar(base, [x.id!], { estado: "pendiente" }))}>
                    Recuperar
                  </Boton>
                ) : null}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
