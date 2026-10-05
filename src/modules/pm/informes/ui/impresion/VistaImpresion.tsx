"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { nombrePdf, rutaInforme } from "../../logic/paths";
import { carasQueFaltan } from "../../slides/fuentes";
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
  /** La abre el servidor para generar el PDF: slides a su tamaño real y sin nada alrededor. */
  modoPdf?: boolean;
}

/**
 * Vista de impresión: una slide por página de 960 × 540 pt. De aquí sale el
 * PDF, vectorial y con el texto seleccionable: lo genera el servidor abriendo
 * esta misma vista (api/informes/pdf) y, como respaldo, el diálogo de impresión
 * del navegador (Guardar como PDF). El sello de «bloqueado» y los [pendiente]
 * no salen.
 *
 * `data-listo` solo se pone cuando el PDF va a ser fiel: todas las slides
 * pintadas con sus fuentes de verdad y todas las imágenes cargadas. Si algo
 * falla se pone `data-error`, a la vista, en vez de dejar salir un PDF distinto
 * de lo que se ve en el editor.
 */
export function VistaImpresion({ id, codigo, trimestre, estado, version, contenido, modoPdf }: Props) {
  const raiz = useRef<HTMLDivElement>(null);
  const visibles = useMemo(() => contenido.slides.filter((s) => !s.oculto), [contenido]);
  // Slides ya pintadas, por id (una slide puede pintarse más de una vez).
  const [pintadas, setPintadas] = useState<Record<string, string | null>>({});
  const todasPintadas = visibles.every((s) => s.id in pintadas);
  // Alguna slide se pintó (y se midió) sin sus fuentes: ya no vale aunque lleguen después.
  const sinFuentes = useRef<string[]>([]);
  const [comprobado, setComprobado] = useState<{ error: string | null } | null>(null);
  const listo = todasPintadas && comprobado?.error === null;
  const error = todasPintadas ? (comprobado?.error ?? null) : null;
  const nombre = nombrePdf({ codigo, trimestre, estado, version });

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

  // Con todo pintado: fuentes cargadas de verdad e imágenes descodificadas, o no hay PDF.
  useEffect(() => {
    if (!todasPintadas) return;
    let vivo = true;
    void (async () => {
      const fallos = visibles.filter((s) => pintadas[s.id]).map((s) => `la slide «${s.id}» no se ha podido pintar (${pintadas[s.id]})`);
      await document.fonts.ready;
      const faltan = [...new Set([...sinFuentes.current, ...carasQueFaltan()])];
      if (faltan.length) fallos.push(`no se han cargado las fuentes del informe (${faltan.join(", ")})`);
      const imagenes = Array.from(raiz.current?.querySelectorAll<HTMLImageElement>(".iq-paginas img") ?? []);
      const rotas = (
        await Promise.all(
          imagenes.map((im) =>
            im.decode().then(
              () => null,
              () => im.getAttribute("src") ?? "imagen",
            ),
          ),
        )
      ).filter((x): x is string => x !== null);
      if (rotas.length) fallos.push(`${rotas.length} imagen(es) no se han podido cargar (${[...new Set(rotas)].slice(0, 3).join(", ")})`);
      if (vivo) setComprobado({ error: fallos.length ? fallos.join("; ") : null });
    })();
    return () => {
      vivo = false;
    };
  }, [todasPintadas, pintadas, visibles]);

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
            {listo ? "Imprimir o guardar como PDF" : error ? "No se puede imprimir" : "Preparando…"}
          </Boton>
        </div>
      </div>
      <div className="iq-no-imprimir mb-4">
        {error ? (
          <Aviso tipo="error">El PDF no saldría igual que el informe: {error}. Recarga la página; si sigue igual, revisa la conexión.</Aviso>
        ) : (
          <Aviso>
            El botón «PDF» del informe ya descarga el fichero hecho. Desde aquí se imprime con el navegador: elige «Guardar como PDF» y sin
            márgenes. El tamaño de página (960 × 540 pt) y el nombre del fichero ya vienen puestos.
          </Aviso>
        )}
      </div>
      <div className={`iq-paginas${modoPdf ? " iq-modo-pdf" : ""}`} data-listo={listo ? "1" : undefined} data-error={error ?? undefined}>
        {visibles.map((s, i) => (
          <div key={s.id} className="iq-pagina-pdf">
            <VisorSlide
              slide={s}
              pagina={i + 1}
              meta={contenido.meta}
              sinMarcas
              onPintado={(r) => {
                sinFuentes.current.push(...carasQueFaltan());
                setPintadas((p) => ({ ...p, [s.id]: r.error ?? null }));
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
