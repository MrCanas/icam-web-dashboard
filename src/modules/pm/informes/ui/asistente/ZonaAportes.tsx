"use client";

import { useState } from "react";

import { accionAnadirFuente } from "../../actions/informes";
import type { Fuente } from "../../types";
import { Boton, claseCampo } from "../componentes";
import type { HerramientaInforme } from "../InformeApp";
import { ACEPTA_DOCUMENTOS, extraerTexto } from "../lib/ficheros";
import { ZonaSoltar } from "./ZonaSoltar";

/**
 * Añadir información sin salir del paso en el que se está: un texto (queda
 * como documento «Aportación …») o ficheros, que se leen en el navegador y
 * pasan a las fuentes del trimestre. La siguiente revisión los ve como nuevos.
 */
export function ZonaAportes({ h, titulo, ayuda, onAportado }: { h: HerramientaInforme; titulo: string; ayuda: string; onAportado?: (f: Fuente) => void }) {
  const { informe, puedeEditar } = h;
  const [texto, setTexto] = useState("");
  const [ocupado, setOcupado] = useState<string | null>(null);

  function anadida(f: Fuente) {
    h.setFuentes((fs) => [...fs, f]);
    onAportado?.(f);
  }

  async function guardarTexto() {
    if (!texto.trim()) return;
    setOcupado("Guardando…");
    const nombre = `Aportación ${new Date().toLocaleString("es-ES", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}`;
    const r = await accionAnadirFuente(informe.id, { tipo: "documento", nombre, texto: texto.slice(0, 60_000) });
    setOcupado(null);
    if (!r.ok) {
      h.avisar(`No se ha podido guardar la información: ${r.error}`, "error");
      return;
    }
    anadida(r.data);
    setTexto("");
  }

  async function subir(files: File[]) {
    for (const file of files) {
      setOcupado(`Leyendo ${file.name}…`);
      try {
        const t = await extraerTexto(file);
        const r = await accionAnadirFuente(informe.id, { tipo: "documento", nombre: file.name, texto: t.slice(0, 60_000) });
        if (!r.ok) throw new Error(r.error);
        anadida(r.data);
      } catch (e) {
        h.avisar(`No se ha podido leer ${file.name}: ${e instanceof Error ? e.message : "error"}`, "error");
      }
    }
    setOcupado(null);
  }

  if (!puedeEditar) return null;
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold text-text-primary">{titulo}</h3>
      <p className="text-sm text-text-muted">{ayuda}</p>
      <textarea
        className={`${claseCampo} min-h-20 leading-normal`}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder="Pega aquí lo que quieras añadir: un correo, una nota, una tabla…"
        aria-label={titulo}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Boton pequeno disabled={!texto.trim() || !!ocupado} onClick={() => void guardarTexto()}>
          Añadir el texto
        </Boton>
        {ocupado ? <span className="text-sm text-text-muted">{ocupado}</span> : null}
      </div>
      <ZonaSoltar acepta={ACEPTA_DOCUMENTOS} multiple pequena onFicheros={(f) => void subir(f)} deshabilitado={!!ocupado}>
        Documentos (PDF, Word, PowerPoint, Excel, CSV, texto): arrastra aquí o pulsa para elegir
      </ZonaSoltar>
    </div>
  );
}
