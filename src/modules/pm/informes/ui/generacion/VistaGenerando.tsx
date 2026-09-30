"use client";

import { useEffect, useRef, useState } from "react";

import { clon } from "../../logic/informe";
import { Boton, Tarjeta } from "../componentes";
import type { HerramientaInforme } from "../InformeApp";
import { fuentesListas } from "../../slides/fuentes";
import { FuentesInforme } from "../../slides/fuentes";
import "../../slides/slides.css";
import { generarInforme, type FilaGeneracion } from "./generar";

const ICONO: Record<FilaGeneracion["estado"], string> = { cola: "·", curso: "●", hecho: "✓", error: "!", fijo: "✓" };

/** Progreso de la generación (tras el GO). */
export function VistaGenerando({ h }: { h: HerramientaInforme }) {
  const [filas, setFilas] = useState<FilaGeneracion[]>([]);
  const [fase, setFase] = useState("Preparando…");
  const [parado, setParado] = useState(false);
  const abortar = useRef<AbortController | null>(null);
  const iniciado = useRef(false);
  // Foto del informe al pulsar GO: la generación no debe ver sus propios guardados a medias.
  const informe = useRef(h.informe);

  useEffect(() => {
    if (iniciado.current) return;
    iniciado.current = true;
    const ctrl = new AbortController();
    abortar.current = ctrl;
    const alSalir = () => ctrl.abort();
    window.addEventListener("pagehide", alSalir);
    void (async () => {
      try {
        await fuentesListas();
        const r = await generarInforme({
          informe: informe.current,
          previo: h.previo,
          fotos: h.fotos,
          biblioteca: h.biblioteca,
          signal: ctrl.signal,
          guardar: (contenido, extra, cambio) => h.guardar({ contenido: clon(contenido), ...extra }, cambio),
          onFilas: setFilas,
          onFase: setFase,
        });
        if (r === "hecho") h.ir("editor");
        else {
          setParado(true);
          setFase("Parado. Las slides ya redactadas están guardadas.");
        }
      } catch (e) {
        setParado(true);
        setFase(`La generación se ha interrumpido: ${e instanceof Error ? e.message : "error"}. Las slides ya redactadas están guardadas.`);
      } finally {
        window.removeEventListener("pagehide", alSalir);
      }
    })();
    // La generación se lanza una sola vez por GO.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hechas = filas.filter((f) => f.estado === "hecho" || f.estado === "error" || f.estado === "fijo").length;
  const pct = filas.length ? Math.round((100 * hechas) / filas.length) : 0;

  return (
    <>
      <FuentesInforme />
      <Tarjeta>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-text-primary" aria-live="polite" data-fase>
            {fase}
          </p>
          {parado ? (
            <div className="flex gap-2">
              <Boton onClick={() => h.ir("paso3")}>Volver a la biblioteca</Boton>
              <Boton variante="primario" onClick={() => h.ir("editor")}>
                Abrir el editor
              </Boton>
            </div>
          ) : (
            <Boton onClick={() => abortar.current?.abort()}>Parar</Boton>
          )}
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-subtle" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <i className="block h-full bg-icam-900 transition-[width] duration-300" style={{ width: `${pct}%` }} />
        </div>
        <div className="flex flex-col">
          {filas.map((f) => (
            <div key={f.id} className="grid grid-cols-[26px_1fr_auto] items-baseline gap-2.5 border-b border-subtle px-1 py-2 text-sm">
              <span
                className={`text-center font-semibold ${f.estado === "curso" ? "animate-pulse text-icam-900" : ""} ${
                  f.estado === "error" ? "text-red-600" : f.estado === "hecho" || f.estado === "fijo" ? "text-emerald-700" : ""
                }`}
              >
                {ICONO[f.estado]}
              </span>
              <span>
                {f.titulo}
                {f.detalle ? <span className="text-text-muted"> · {f.detalle}</span> : null}
              </span>
              <span className="text-text-muted">{f.nota}</span>
            </div>
          ))}
        </div>
      </Tarjeta>
    </>
  );
}
