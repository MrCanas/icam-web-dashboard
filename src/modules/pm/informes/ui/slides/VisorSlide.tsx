"use client";

import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react";

import "../../slides/slides.css";
import { FuentesInforme, fuentesListas } from "../../slides/fuentes";
import { pintarYMedir } from "../../slides/motor";
import type { Medida, MetaInforme, SlideJson } from "../../slides/tipos";

export interface ResultadoVisor {
  pendientes: number;
  medida: Medida | null;
  error?: string;
}

interface VisorSlideProps {
  slide: SlideJson;
  pagina: number;
  meta: MetaInforme | null | undefined;
  /** Se llama tras pintar, marcar pendientes y airear, con el lienzo y el slide que se ha pintado en él. */
  onPintado?: (r: ResultadoVisor, lienzo: HTMLElement, slide: SlideJson) => void;
  /** Sin sello de bloqueo ni marcas de pendiente (impresión y PDF). */
  sinMarcas?: boolean;
  /** Capa encima de la slide (marcas del editor). */
  children?: ReactNode;
  className?: string;
}

/**
 * Una slide escalada al ancho disponible. Se pinta con el motor (raíz React
 * propia, fuera del árbol de la página) porque el aireado modifica márgenes y
 * paddings del DOM pintado: si React reconciliara ese DOM, los desharía.
 */
export function VisorSlide({ slide, pagina, meta, onPintado, sinMarcas, children, className }: VisorSlideProps) {
  const marcoRef = useRef<HTMLDivElement>(null);
  const escalaRef = useRef<HTMLDivElement>(null);
  const avisar = useRef(onPintado);
  useLayoutEffect(() => {
    avisar.current = onPintado;
  });

  // Escala: ancho disponible / 960.
  useEffect(() => {
    const marco = marcoRef.current;
    const escala = escalaRef.current;
    if (!marco || !escala) return;
    const ajustar = () => {
      escala.style.transform = `scale(${marco.clientWidth / 960})`;
    };
    ajustar();
    const ro = new ResizeObserver(ajustar);
    ro.observe(marco);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const escala = escalaRef.current;
    if (!escala) return;
    let cancelado = false;
    let desmontar: (() => void) | null = null;
    // Cada pintado va en su propio lienzo: la raíz anterior se desmonta aparte,
    // fuera del commit de React.
    const lienzo = document.createElement("div");
    lienzo.style.width = "960px";
    lienzo.style.height = "540px";
    lienzo.style.position = "relative";
    const t = setTimeout(async () => {
      await fuentesListas();
      if (cancelado) return;
      escala.replaceChildren(lienzo);
      const r = pintarYMedir(lienzo, slide, pagina, meta);
      desmontar = () => r.raiz.root.unmount();
      avisar.current?.({ pendientes: r.pendientes, medida: r.medida, error: r.error }, lienzo, slide);
    }, 0);
    return () => {
      cancelado = true;
      clearTimeout(t);
      const d = desmontar;
      if (d) setTimeout(d, 0);
    };
  }, [slide, pagina, meta]);

  return (
    <div ref={marcoRef} className={`iq-marco${sinMarcas ? " iq-sin-marcas" : ""}${className ? ` ${className}` : ""}`}>
      <FuentesInforme />
      <div ref={escalaRef} className="iq-escala" />
      {children}
    </div>
  );
}
