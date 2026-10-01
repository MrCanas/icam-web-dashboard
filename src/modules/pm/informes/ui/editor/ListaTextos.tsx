"use client";

import { useState } from "react";

import { camposTexto, etiquetaRuta, ponerTexto } from "../../logic/edicion";
import { tituloDe } from "../../logic/informe";
import type { SlideJson } from "../../slides/tipos";
import { Boton, claseCampo } from "../componentes";

interface Props {
  slide: SlideJson;
  trabajando: boolean;
  aplicar: (nueva: SlideJson, cambio: string) => void;
}

/** Todos los textos de una slide, para cambiar los que no se localizan pulsando sobre ella. */
export function ListaTextos({ slide, trabajando, aplicar }: Props) {
  const campos = camposTexto(slide);
  const [abierto, setAbierto] = useState<{ clave: string; texto: string } | null>(null);

  if (!campos.length) return <p className="text-sm text-text-muted">Esta slide no tiene textos que se puedan cambiar a mano.</p>;

  return (
    <ul className="divide-y divide-subtle/60 rounded-lg border border-subtle bg-card text-sm shadow-sm">
      {campos.map((c) => {
        const clave = c.ruta.join("/");
        const editando = abierto?.clave === clave;
        return (
          <li key={clave} className="flex flex-col gap-1.5 p-2.5">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className="text-xs font-medium text-text-muted">{etiquetaRuta(c.ruta)}</span>
              {editando ? null : (
                <button type="button" className="flex-1 text-left hover:underline" disabled={trabajando} onClick={() => setAbierto({ clave, texto: c.valor })}>
                  {c.valor.length > 160 ? c.valor.slice(0, 157) + "…" : c.valor}
                </button>
              )}
            </div>
            {editando ? (
              <>
                <textarea
                  className={`${claseCampo} min-h-[70px] leading-normal`}
                  autoFocus
                  value={abierto.texto}
                  aria-label={etiquetaRuta(c.ruta)}
                  onChange={(e) => setAbierto({ clave, texto: e.target.value })}
                />
                <div className="flex flex-wrap items-center gap-2">
                  <Boton
                    variante="primario"
                    pequeno
                    disabled={trabajando}
                    onClick={() => {
                      const texto = abierto.texto;
                      setAbierto(null);
                      if (texto !== c.valor) aplicar(ponerTexto(slide, c.ruta, texto), `${tituloDe(slide)}: texto editado a mano`);
                    }}
                  >
                    Aplicar
                  </Boton>
                  <Boton pequeno onClick={() => setAbierto(null)}>
                    Cancelar
                  </Boton>
                  <span className="text-xs text-text-muted">Negrita: **así**.</span>
                </div>
              </>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
