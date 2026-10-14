"use client";

import { useState, type ReactNode } from "react";

import { Boton, claseCampo } from "../componentes";

/**
 * Comentario del equipo sobre un elemento del análisis o de la presentación:
 * se abre con 💬, se guarda al salir del campo y enseña debajo cómo lo atendió
 * Claude en la última revisión.
 */
export function Comentario({
  valor,
  respuesta,
  puedeEditar,
  onGuardar,
  etiqueta = "Comentario para Claude",
  abiertoInicial = false,
}: {
  valor: string;
  respuesta?: string;
  puedeEditar: boolean;
  onGuardar: (texto: string) => void;
  etiqueta?: string;
  abiertoInicial?: boolean;
}) {
  const [abierto, setAbierto] = useState(abiertoInicial || !!valor);
  const [texto, setTexto] = useState(valor);
  // Si el comentario cambia por fuera (una revisión lo da por atendido), se ve el nuevo.
  const [visto, setVisto] = useState(valor);
  if (visto !== valor) {
    setVisto(valor);
    setTexto(valor);
  }
  return (
    <div className="flex flex-col gap-1">
      {abierto ? (
        <textarea
          className={`${claseCampo} min-h-[44px] !py-1.5 text-sm`}
          value={texto}
          aria-label={etiqueta}
          placeholder="Qué debe cambiar, añadir o tener en cuenta Claude…"
          disabled={!puedeEditar}
          onChange={(e) => setTexto(e.target.value)}
          onBlur={() => texto !== valor && onGuardar(texto)}
        />
      ) : puedeEditar ? (
        <button
          type="button"
          className="self-start text-xs font-medium text-icam-900 hover:underline"
          title={etiqueta}
          onClick={() => setAbierto(true)}
        >
          💬 Comentar
        </button>
      ) : null}
      {respuesta ? <p className="text-xs italic text-text-muted">Claude: {respuesta}</p> : null}
    </div>
  );
}

/**
 * Texto del análisis que el equipo puede reescribir. Se ve como texto; «Editar»
 * lo abre y al salir del campo se guarda. Con su comentario y, si se puede
 * quitar, su botón.
 */
export function ElementoEditable({
  valor,
  puedeEditar,
  onGuardar,
  onBorrar,
  comentario,
  respuesta,
  onComentar,
  editado,
  multilinea = true,
  children,
}: {
  valor: string;
  puedeEditar: boolean;
  onGuardar: (texto: string) => void;
  onBorrar?: () => void;
  comentario?: string;
  respuesta?: string;
  onComentar?: (texto: string) => void;
  /** Ya lo ha tocado el equipo: Claude lo respeta en las revisiones. */
  editado?: boolean;
  multilinea?: boolean;
  /** Algo más a la derecha del texto (un chip, un selector). */
  children?: ReactNode;
}) {
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(valor);

  function terminar() {
    setEditando(false);
    if (texto.trim() !== valor.trim()) onGuardar(texto.trim());
  }

  return (
    <div className="group flex flex-col gap-1">
      <div className="flex items-start gap-2">
        {editando ? (
          multilinea ? (
            <textarea
              autoFocus
              className={`${claseCampo} min-h-[60px] flex-1 !py-1.5 text-sm`}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onBlur={terminar}
              onKeyDown={(e) => e.key === "Escape" && (setTexto(valor), setEditando(false))}
            />
          ) : (
            <input
              autoFocus
              className={`${claseCampo} flex-1 !py-1 text-sm`}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onBlur={terminar}
              onKeyDown={(e) => {
                if (e.key === "Enter") terminar();
                if (e.key === "Escape") {
                  setTexto(valor);
                  setEditando(false);
                }
              }}
            />
          )
        ) : (
          <span className={`flex-1 text-sm ${valor ? "" : "italic text-text-muted"}`}>
            {valor || "(vacío)"}
            {editado ? <span className="ml-1.5 text-xs text-icam-gold" title="Editado por el equipo: Claude lo respeta en las revisiones">✎</span> : null}
          </span>
        )}
        {children}
        {puedeEditar && !editando ? (
          <span className="flex shrink-0 gap-1 opacity-60 transition group-hover:opacity-100">
            <Boton
              variante="texto"
              className="!text-xs"
              onClick={() => {
                setTexto(valor);
                setEditando(true);
              }}
            >
              Editar
            </Boton>
            {onBorrar ? (
              <Boton variante="texto" className="!text-xs" aria-label="Quitar" onClick={onBorrar}>
                Quitar
              </Boton>
            ) : null}
          </span>
        ) : null}
      </div>
      {onComentar ? <Comentario valor={comentario ?? ""} respuesta={respuesta} puedeEditar={puedeEditar} onGuardar={onComentar} /> : null}
    </div>
  );
}
