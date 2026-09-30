"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type { InformeJson } from "../../slides/tipos";
import { VisorSlide, type ResultadoVisor } from "../slides/VisorSlide";

interface Props {
  /** informe.json de ejemplo (solo en desarrollo, desde INFORMES_GALERIA_JSON). */
  inicial: InformeJson | null;
}

/**
 * Galería interna de las slides nativas: pinta un informe.json completo con
 * medición de relleno. Sirve para comprobar la paridad con el visor del skill
 * (scripts/pm/informes-paridad.ts lee `data-medidas`). No guarda nada.
 */
export default function GaleriaSlidesPage({ inicial }: Props) {
  const [informe, setInforme] = useState<InformeJson | null>(inicial);
  const [error, setError] = useState<string | null>(null);
  const [medidas, setMedidas] = useState<Record<string, ResultadoVisor>>({});

  const visibles = useMemo(() => (informe?.slides ?? []).filter((s) => !s.oculto), [informe]);

  // Cuando todas las slides están medidas, se publican en <body> para scripts/pm/informes-paridad.ts.
  useEffect(() => {
    if (!visibles.length || visibles.some((s) => !medidas[s.id])) {
      document.body.removeAttribute("data-listo");
      return;
    }
    const lista = visibles.map((s, i) => {
      const m = medidas[s.id]!;
      return {
        id: s.id,
        pagina: i + 1,
        c: s.c || "compuesto",
        ocupacion: m.medida?.ocupacion ?? null,
        relleno: m.medida?.relleno ?? null,
        desborde: !!m.medida?.desborde,
        error: m.error,
      };
    });
    document.body.setAttribute("data-medidas", JSON.stringify(lista));
    document.body.setAttribute("data-listo", "1");
  }, [medidas, visibles]);

  const alPintar = useCallback((id: string) => (r: ResultadoVisor) => setMedidas((m) => ({ ...m, [id]: r })), []);

  async function cargar(f: File | undefined) {
    if (!f) return;
    try {
      const datos = JSON.parse(await f.text()) as InformeJson;
      if (!Array.isArray(datos?.slides)) throw new Error("No es un informe.json (falta «slides»).");
      setError(null);
      setMedidas({});
      setInforme(datos);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div className="space-y-4 min-w-0">
      <section className="rounded-lg border border-subtle/50 bg-card p-4 space-y-2">
        <h1 className="text-xl font-semibold text-text-primary">Galería de slides</h1>
        <p className="text-sm text-text-muted">
          Pinta un informe.json con las slides nativas y mide el relleno de cada una. Página interna de comprobación:
          no guarda nada.
        </p>
        <label className="inline-flex items-center gap-2 text-sm text-text-primary">
          <span>Abrir informe.json</span>
          <input
            type="file"
            accept="application/json,.json"
            onChange={(e) => void cargar(e.target.files?.[0])}
            className="text-sm"
          />
        </label>
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
        {informe ? (
          <p className="text-sm text-text-muted">
            {informe.meta?.proyecto} · {informe.meta?.trimestre} · {visibles.length} slides
          </p>
        ) : null}
      </section>
      <div className="space-y-6" id="galeria-slides">
        {visibles.map((s, i) => {
          const m = medidas[s.id];
          return (
            <section key={`${s.id}-${i}`} className="space-y-1" data-slide={s.id}>
              <div className="flex flex-wrap items-baseline gap-2 text-xs text-text-muted">
                <b className="text-sm text-text-primary">Slide {i + 1}</b>
                <span>{s.id}</span>
                {m?.error ? <span className="text-red-700">{m.error}</span> : null}
                {m?.medida ? (
                  <span className={m.medida.desborde ? "text-red-700 font-semibold" : m.medida.relleno < 80 ? "text-amber-700" : ""}>
                    {m.medida.desborde ? "desborda" : `texto ${m.medida.ocupacion} % · relleno ${m.medida.relleno} %`}
                  </span>
                ) : null}
                {m?.pendientes ? <span className="text-amber-700">{m.pendientes} pendiente(s)</span> : null}
              </div>
              <VisorSlide
                slide={s}
                pagina={i + 1}
                meta={informe?.meta}
                onPintado={alPintar(s.id)}
                className="border border-subtle rounded-md"
              />
            </section>
          );
        })}
      </div>
    </div>
  );
}
