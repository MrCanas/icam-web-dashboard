"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { rutaInforme } from "../../logic/paths";
import { qCierre } from "../../logic/trimestre";
import type { InformeJson } from "../../slides/tipos";
import type { EstadoInforme } from "../../types";
import { Aviso, Boton } from "../componentes";
import { VisorSlide } from "../slides/VisorSlide";
import "./impresion.css";

interface Props {
  id: string;
  codigo: string;
  trimestre: string;
  estado: EstadoInforme;
  version: number;
  contenido: InformeJson;
}

/** Nombre del PDF: YYYYMMDD_<CODIGO>_<Qn AAAA>_Informe Trimestral Inversores[ (borrador vN)]. */
export function nombrePdf(p: { codigo: string; trimestre: string; estado: EstadoInforme; version: number }): string {
  return (
    `${qCierre(p.trimestre).replace(/-/g, "")}_${p.codigo}_${p.trimestre}_Informe Trimestral Inversores` +
    (p.estado === "aprobado" ? "" : ` (borrador v${p.version})`)
  );
}

/**
 * Vista de impresión: una slide por página de 960 × 540 pt y «Descargar PDF»
 * con el diálogo de impresión del navegador (Guardar como PDF). Sale vectorial,
 * con el texto seleccionable, como el visor del skill. El sello de «bloqueado»
 * y los [pendiente] no salen.
 */
export function VistaImpresion({ id, codigo, trimestre, estado, version, contenido }: Props) {
  const raiz = useRef<HTMLDivElement>(null);
  const visibles = useMemo(() => contenido.slides.filter((s) => !s.oculto), [contenido]);
  const [pintadas, setPintadas] = useState(0);
  const listo = pintadas >= visibles.length;
  const nombre = nombrePdf({ codigo, trimestre, estado, version });

  // El navegador propone como nombre del PDF el título de la página.
  useEffect(() => {
    const antes = document.title;
    document.title = nombre;
    return () => {
      document.title = antes;
    };
  }, [nombre]);

  // Tamaño de página del PDF, solo mientras esta vista está abierta.
  useEffect(() => {
    const st = document.createElement("style");
    st.textContent = "@page { size: 960pt 540pt; margin: 0; }";
    document.head.appendChild(st);
    return () => st.remove();
  }, []);

  // Al imprimir solo sale la vista: se ocultan cabecera y pie del dashboard (los hermanos de cada ancestro).
  useEffect(() => {
    const marcados: Element[] = [];
    let el: Element | null = raiz.current;
    while (el && el !== document.body) {
      el.classList.add("iq-imprimir-contenedor");
      marcados.push(el);
      for (const h of Array.from(el.parentElement?.children ?? [])) {
        if (h !== el) {
          h.classList.add("iq-no-imprimir");
          marcados.push(h);
        }
      }
      el = el.parentElement;
    }
    return () => marcados.forEach((m) => m.classList.remove("iq-imprimir-contenedor", "iq-no-imprimir"));
  }, []);

  return (
    <div ref={raiz} className="iq-impresion">
      <div className="iq-no-imprimir mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Vista de impresión</h1>
          <p className="text-sm text-text-muted">
            {nombre}.pdf · {visibles.length} páginas
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={rutaInforme(id)} className="text-sm font-medium text-icam-900 hover:underline">
            Volver al informe
          </Link>
          <Boton variante="primario" disabled={!listo} onClick={() => window.print()}>
            {listo ? "Descargar PDF" : "Preparando…"}
          </Boton>
        </div>
      </div>
      <div className="iq-no-imprimir mb-4">
        <Aviso>
          En el diálogo de impresión elige «Guardar como PDF», sin márgenes y con «Gráficos de fondo» activado. El tamaño de página (960 × 540
          pt) y el nombre del fichero ya vienen puestos.
        </Aviso>
      </div>
      <div className="iq-paginas" data-listo={listo ? "1" : undefined}>
        {visibles.map((s, i) => (
          <div key={s.id} className="iq-pagina-pdf">
            <VisorSlide slide={s} pagina={i + 1} meta={contenido.meta} sinMarcas onPintado={() => setPintadas((n) => n + 1)} />
          </div>
        ))}
      </div>
    </div>
  );
}
