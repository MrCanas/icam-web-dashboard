"use client";

import { useEffect, useRef, type ReactNode } from "react";

import { Ayuda } from "@/components/ui/Ayuda";
import { Boton } from "@/components/ui/Boton";
import { Icono } from "@/components/ui/Icono";

/**
 * Preguntas guiadas: dentro de un paso, una pregunta cada vez.
 *
 * - `activa`: la que toca ahora; abierta, destacada y con su explicación.
 * - `hecha`: plegada en una línea con la respuesta y «Cambiar».
 * - `bloqueada`: la que viene después; solo el título, apagado, para que se
 *   vea el camino que queda.
 * - `error`: algo la impide; abierta y en rojo.
 *
 * Unidas por una línea vertical, como una lista de tareas.
 */
export type EstadoPregunta = "activa" | "hecha" | "bloqueada" | "error";

export function ListaGuiada({ children }: { children: ReactNode }) {
  return <ol className="relative space-y-3">{children}</ol>;
}

const CIRCULO: Record<EstadoPregunta, string> = {
  activa: "bg-icam-900 text-white ring-4 ring-icam-900/10",
  hecha: "bg-green-600 text-white",
  bloqueada: "border-2 border-subtle bg-page text-text-muted",
  error: "bg-red-600 text-white ring-4 ring-red-600/10",
};

export function PreguntaGuiada({
  numero,
  estado,
  titulo,
  subtitulo,
  ayuda,
  respuesta,
  onCambiar,
  ultima,
  abiertaSiHecha,
  cargando,
  children,
}: {
  numero: number;
  estado: EstadoPregunta;
  titulo: ReactNode;
  /** Una línea bajo el título cuando está activa: qué se decide aquí. */
  subtitulo?: ReactNode;
  ayuda?: ReactNode;
  /** Lo respondido, en una línea, cuando está hecha. */
  respuesta?: ReactNode;
  onCambiar?: () => void;
  /** La última no dibuja la línea hacia la siguiente. */
  ultima?: boolean;
  /** Hecha, pero su contenido sigue a la vista (un resumen que se lee). */
  abiertaSiHecha?: boolean;
  /** Trabajando: rueda en lugar del número. */
  cargando?: boolean;
  children?: ReactNode;
}) {
  const ref = useRef<HTMLLIElement | null>(null);
  const activa = estado === "activa" || estado === "error";

  // Cuando una pregunta pasa a ser la que toca, se lleva a la vista.
  useEffect(() => {
    if (estado === "activa") ref.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [estado]);

  const abierta = activa || (estado === "hecha" && abiertaSiHecha);

  return (
    <li ref={ref} aria-current={activa ? "step" : undefined} className="relative flex gap-3 sm:gap-4">
      {!ultima ? (
        <span
          aria-hidden="true"
          className={`absolute left-[15px] top-9 -bottom-3 w-0.5 ${estado === "hecha" ? "bg-green-600/40" : "bg-subtle"}`}
        />
      ) : null}
      <span
        aria-hidden="true"
        className={`relative z-10 mt-3 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold transition ${CIRCULO[estado]}`}
      >
        {cargando ? (
          <Icono nombre="actualizar" className="h-4 w-4 animate-spin" />
        ) : estado === "hecha" ? (
          <Icono nombre="check" className="h-4 w-4" />
        ) : estado === "error" ? (
          "!"
        ) : (
          numero
        )}
      </span>

      <div
        className={`min-w-0 flex-1 rounded-xl border transition ${
          estado === "activa"
            ? "border-icam-900/30 bg-card p-4 shadow-md sm:p-5"
            : estado === "error"
              ? "border-red-200 bg-card p-4 shadow-md sm:p-5"
              : estado === "hecha"
                ? `border-subtle/60 bg-card px-4 ${abierta ? "py-3" : "py-3"}`
                : "border-dashed border-subtle bg-transparent px-4 py-3"
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <div className="min-w-0">
            <p
              className={`flex items-center gap-1.5 ${
                activa ? "text-base font-semibold text-text-primary" : estado === "hecha" ? "text-xs font-medium text-text-muted" : "text-sm text-text-muted"
              }`}
            >
              {titulo}
              {activa && ayuda ? <Ayuda>{ayuda}</Ayuda> : null}
            </p>
            {estado === "hecha" && respuesta ? <p className="text-sm font-semibold text-text-primary">{respuesta}</p> : null}
            {activa && subtitulo ? <p className="mt-0.5 text-sm text-text-muted">{subtitulo}</p> : null}
          </div>
          {estado === "hecha" && onCambiar ? (
            <Boton variante="texto" pequeno onClick={onCambiar}>
              Cambiar
            </Boton>
          ) : null}
        </div>
        {abierta && children ? <div className={activa ? "mt-4" : "mt-3"}>{children}</div> : null}
      </div>
    </li>
  );
}
