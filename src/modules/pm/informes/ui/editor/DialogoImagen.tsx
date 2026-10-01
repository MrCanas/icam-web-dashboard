"use client";

import { useEffect, useState } from "react";

import { Modal } from "@/components/ui/Modal";

import { accionActualizarFoto, accionBibliotecaFotos } from "../../actions/informes";
import { urlFoto } from "../../logic/paths";
import { compararTrimestres } from "../../logic/trimestre";
import type { CategoriaFoto, Foto, FotoBiblioteca } from "../../types";
import { subirFotoInforme } from "../asistente/PasoFuentes";
import { ZonaSoltar } from "../asistente/ZonaSoltar";
import { Boton, claseCampo } from "../componentes";
import { ACEPTA_FOTOS } from "../lib/ficheros";

interface Props {
  informeId: string;
  /** Trimestre del informe abierto, para rotular sus fotos. */
  trimestre: string;
  /** Imagen que hay ahora en el hueco, para señalarla en la biblioteca. */
  actual: string | null;
  /** Categoría con la que se guarda lo que se suba desde aquí. */
  categoria: CategoriaFoto;
  /** Solo para páginas de Finanzas: a qué slide va. */
  para?: string | null;
  onElegir: (src: string) => void;
  /** Foto recién subida: pasa a ser una más del informe. */
  onSubida: (f: Foto) => void;
  onCerrar: () => void;
}

/**
 * Diálogo para elegir la imagen de un hueco de la slide: un archivo del
 * ordenador (que se sube y queda en la biblioteca) o una foto ya subida en
 * cualquier informe del proyecto.
 */
export function DialogoImagen({ informeId, trimestre, actual, categoria, para, onElegir, onSubida, onCerrar }: Props) {
  const [fotos, setFotos] = useState<FotoBiblioteca[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState<string | null>(null);
  const [filtro, setFiltro] = useState("");

  useEffect(() => {
    let vivo = true;
    void accionBibliotecaFotos(informeId)
      .then((r) => {
        if (!vivo) return;
        if (r.ok) setFotos(r.data);
        else setError(`No se ha podido leer la biblioteca de imágenes: ${r.error}`);
      })
      .catch(() => vivo && setError("No se ha podido leer la biblioteca de imágenes. Revisa la conexión."));
    return () => {
      vivo = false;
    };
  }, [informeId]);

  async function subir(files: File[]) {
    const imagenes = files.filter((f) => ACEPTA_FOTOS.split(",").includes(f.type));
    if (!imagenes.length) {
      setError("Elige una imagen JPG, PNG o WEBP.");
      return;
    }
    setError(null);
    const subidas: FotoBiblioteca[] = [];
    for (const file of imagenes) {
      setSubiendo(`Subiendo ${file.name}…`);
      try {
        const f = await subirFotoInforme(informeId, file, categoria);
        if (para) {
          const r = await accionActualizarFoto(informeId, f.id, { para });
          if (r.ok) f.para = para;
        }
        onSubida(f);
        subidas.push({ ...f, informeId, trimestre, creada: new Date().toISOString() });
      } catch (e) {
        setError(`No se ha podido subir ${file.name}: ${e instanceof Error ? e.message : "error"}`);
      }
    }
    setSubiendo(null);
    if (!subidas.length) return;
    // Un solo archivo: es el que se quería colocar. Varios: quedan arriba para elegir.
    if (imagenes.length === 1) onElegir(urlFoto(subidas[0]!.id));
    else setFotos((fs) => [...subidas.reverse(), ...(fs ?? [])]);
  }

  const texto = filtro.trim().toLowerCase();
  const visibles = (fotos ?? []).filter((f) => !texto || `${f.pie ?? ""} ${f.nombre ?? ""} ${f.categoria} ${f.trimestre ?? ""}`.toLowerCase().includes(texto));
  // «Este informe» primero; luego los demás trimestres, del más reciente al más antiguo; al final, las de informes ya eliminados.
  const grupos = new Map<string, FotoBiblioteca[]>();
  for (const f of visibles) {
    const clave = f.informeId === informeId ? "" : (f.trimestre ?? "~");
    grupos.set(clave, [...(grupos.get(clave) ?? []), f]);
  }
  const claves = [...grupos.keys()].sort((a, b) => (a === "" ? -1 : b === "" ? 1 : a === "~" ? 1 : b === "~" ? -1 : compararTrimestres(b, a)));
  const titulo = (clave: string) => (clave === "" ? `Este informe · ${trimestre}` : clave === "~" ? "De informes ya eliminados" : clave);

  return (
    <Modal
      open
      elevated
      width="xl"
      title="Elegir imagen"
      subtitle="Sube un archivo de tu ordenador o elige una imagen de la biblioteca del proyecto."
      busy={!!subiendo}
      onClose={onCerrar}
      footer={
        <Boton onClick={onCerrar} disabled={!!subiendo}>
          Cancelar
        </Boton>
      }
    >
      <div className="space-y-4">
        <ZonaSoltar acepta={ACEPTA_FOTOS} multiple onFicheros={(f) => void subir(f)} deshabilitado={!!subiendo}>
          <b className="text-icam-900">Elegir un archivo del ordenador</b>
          <br />o arrastra aquí la imagen (JPG, PNG o WEBP). Se guarda en la biblioteca del proyecto.
        </ZonaSoltar>
        {subiendo ? (
          <p className="text-sm text-text-muted" aria-live="polite">
            {subiendo}
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-text-primary">Biblioteca del proyecto</h3>
          {fotos?.length ? (
            <input
              className={`${claseCampo} !w-56`}
              type="search"
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
              placeholder="Buscar por nombre o pie…"
              aria-label="Buscar en la biblioteca"
            />
          ) : null}
        </div>
        {fotos === null ? (
          error ? null : <p className="text-sm text-text-muted">Cargando la biblioteca…</p>
        ) : !fotos.length ? (
          <p className="text-sm text-text-muted">Este proyecto todavía no tiene imágenes. Las que subas quedarán aquí para los siguientes informes.</p>
        ) : !visibles.length ? (
          <p className="text-sm text-text-muted">Ninguna imagen coincide con la búsqueda.</p>
        ) : (
          claves.map((clave) => (
            <section key={clave} className="space-y-2" aria-label={titulo(clave)}>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                {titulo(clave)} · {grupos.get(clave)!.length}
              </h4>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(130px,1fr))] gap-2">
                {grupos.get(clave)!.map((f) => {
                  const src = urlFoto(f.id);
                  const rotulo = f.pie || f.nombre || f.categoria;
                  return (
                    <button
                      key={f.id}
                      type="button"
                      disabled={!!subiendo}
                      aria-current={src === actual ? "true" : undefined}
                      title={rotulo}
                      className={`flex flex-col overflow-hidden rounded-md border text-left hover:border-icam-900 focus:outline-none focus:ring-2 focus:ring-icam-900/40 ${
                        src === actual ? "border-icam-900 ring-2 ring-icam-900/40" : "border-subtle"
                      }`}
                      onClick={() => onElegir(src)}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={src} alt={rotulo} loading="lazy" className="h-24 w-full bg-page object-cover" />
                      <span className="truncate px-1.5 py-1 text-xs text-text-muted">
                        {src === actual ? "En uso · " : ""}
                        {rotulo}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          ))
        )}
      </div>
    </Modal>
  );
}
