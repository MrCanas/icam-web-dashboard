"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

import { Icono } from "./Icono";

/**
 * Un ⓘ que abre una explicación corta al lado del término. Para lo que hay que
 * poder leer sin salir de la pantalla, pero no hace falta ver siempre.
 *
 * Se cierra con Escape, con un clic fuera o volviendo a pulsar.
 */
export function Ayuda({ children, etiqueta = "Más información", className = "" }: { children: ReactNode; etiqueta?: string; className?: string }) {
  const [abierta, setAbierta] = useState(false);
  const raiz = useRef<HTMLSpanElement | null>(null);
  const id = useId();

  useEffect(() => {
    if (!abierta) return;
    const fuera = (e: MouseEvent) => {
      if (!raiz.current?.contains(e.target as Node)) setAbierta(false);
    };
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAbierta(false);
    };
    document.addEventListener("mousedown", fuera);
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("mousedown", fuera);
      document.removeEventListener("keydown", tecla);
    };
  }, [abierta]);

  return (
    <span ref={raiz} className={`relative inline-flex align-middle ${className}`}>
      <button
        type="button"
        aria-label={etiqueta}
        aria-expanded={abierta}
        aria-controls={id}
        onClick={() => setAbierta((v) => !v)}
        className="inline-flex h-5 w-5 items-center justify-center rounded-full text-text-muted transition hover:bg-subtle hover:text-icam-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-icam-900/40"
      >
        <Icono nombre="info" className="h-3.5 w-3.5" />
      </button>
      {abierta ? (
        <span
          id={id}
          role="note"
          className="absolute left-1/2 top-full z-30 mt-1.5 w-72 max-w-[85vw] -translate-x-1/2 rounded-lg border border-subtle bg-card p-3 text-left text-xs font-normal leading-relaxed text-text-body shadow-xl"
        >
          {children}
        </span>
      ) : null}
    </span>
  );
}

/**
 * Un bloque plegado con título: para la metodología y las explicaciones
 * largas. Nativo (`<details>`), sin estado.
 */
export function Desplegable({
  titulo,
  abierto,
  children,
  className = "",
}: {
  titulo: ReactNode;
  abierto?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <details open={abierto} className={`group rounded-lg border border-subtle/50 bg-card shadow-sm ${className}`}>
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-2.5 text-sm font-medium text-text-primary marker:content-none [&::-webkit-details-marker]:hidden">
        <Icono nombre="chevron" className="h-3.5 w-3.5 text-text-muted transition group-open:rotate-90" />
        {titulo}
      </summary>
      <div className="space-y-2 border-t border-subtle/50 px-4 py-3 text-sm leading-relaxed text-text-body">{children}</div>
    </details>
  );
}
