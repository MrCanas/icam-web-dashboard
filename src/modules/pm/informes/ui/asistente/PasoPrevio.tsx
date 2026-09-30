"use client";

import { useState } from "react";

import { accionAnadirFuente, accionBorrarFuente } from "../../actions/informes";
import type { BaseInforme } from "../../types";
import { Boton, Tarjeta } from "../componentes";
import type { HerramientaInforme } from "../InformeApp";
import { extraerTexto } from "../lib/ficheros";
import { ZonaSoltar } from "./ZonaSoltar";

/** Paso 1 · Informe anterior: el del portal (estructurado), el PDF/PPTX leído en el navegador o ninguno. */
export function PasoPrevio({ h }: { h: HerramientaInforme }) {
  const { informe, previo, fuentes, puedeEditar } = h;
  const textoPrevio = fuentes.find((f) => f.tipo === "previo") ?? null;
  const [sinPrevio, setSinPrevio] = useState(informe.base?.tipo === "ninguno");
  const [ocupado, setOcupado] = useState<string | null>(null);

  async function subir(files: File[]) {
    const file = files[0];
    if (!file) return;
    setOcupado(`Leyendo ${file.name}…`);
    try {
      const texto = await extraerTexto(file);
      if (!texto.trim()) throw new Error("no tiene texto (¿es un PDF escaneado?)");
      if (textoPrevio) await accionBorrarFuente(informe.id, textoPrevio.id);
      const r = await accionAnadirFuente(informe.id, { tipo: "previo", nombre: file.name, texto });
      if (!r.ok) throw new Error(r.error);
      h.setFuentes((fs) => [...fs.filter((f) => f.tipo !== "previo"), r.data]);
      setSinPrevio(false);
      h.avisar(null);
    } catch (e) {
      h.avisar(`No se ha podido leer ${file.name}: ${e instanceof Error ? e.message : "error"}`, "error");
    } finally {
      setOcupado(null);
    }
  }

  async function continuar() {
    const base: BaseInforme = previo
      ? { tipo: "estructurado", id: previo.id }
      : textoPrevio
        ? { tipo: "texto", nombre: textoPrevio.nombre }
        : { tipo: "ninguno" };
    const ok = await h.guardar({ base, estado: informe.estado === "datos" ? "fuentes" : informe.estado });
    if (ok) h.ir("paso2");
    else h.avisar("No se ha podido guardar el paso. Vuelve a intentarlo.", "error");
  }

  const listo = !!previo || !!textoPrevio || sinPrevio;

  return (
    <Tarjeta>
      <h2 className="text-sm font-semibold text-text-primary">Informe anterior · {informe.trimestreAnterior}</h2>
      {previo ? (
        <p className="rounded-md border border-green-200 bg-green-50 px-3.5 py-2.5 text-sm text-green-900">
          Se usará el informe <b>{informe.trimestreAnterior}</b> guardado en el portal ({previo.slides.filter((s) => !s.oculto).length} slides, v
          {previo.version}). No hace falta subir nada.
        </p>
      ) : (
        <>
          {textoPrevio ? (
            <div className="space-y-2">
              <p className="rounded-md border border-green-200 bg-green-50 px-3.5 py-2.5 text-sm text-green-900">
                Informe anterior leído: <b>{textoPrevio.nombre}</b> · {textoPrevio.texto.length.toLocaleString("es-ES")} caracteres.
              </p>
              <details>
                <summary className="cursor-pointer text-sm text-text-muted">Ver el texto extraído</summary>
                <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded bg-page p-3 text-xs">{textoPrevio.texto.slice(0, 4000)}</pre>
              </details>
            </div>
          ) : (
            <p className="text-sm">
              Sube el informe del <b>{informe.trimestreAnterior}</b> en PDF o PowerPoint. Se lee en tu navegador; solo se guarda el texto.
            </p>
          )}
          {puedeEditar ? (
            <>
              <ZonaSoltar acepta=".pdf,.pptx" onFicheros={subir} deshabilitado={!!ocupado}>
                Arrastra aquí el PDF o PPTX, o pulsa para elegirlo
              </ZonaSoltar>
              <label className="flex items-center gap-2 text-sm text-text-muted">
                <input type="checkbox" checked={sinPrevio} onChange={(e) => setSinPrevio(e.target.checked)} />
                No hay informe anterior (proyecto nuevo)
              </label>
            </>
          ) : null}
        </>
      )}
      {ocupado ? (
        <p className="text-sm text-text-muted" aria-live="polite">
          {ocupado}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Boton variante="primario" onClick={() => void continuar()} disabled={!listo || !puedeEditar || !!ocupado}>
          Continuar
        </Boton>
      </div>
    </Tarjeta>
  );
}
