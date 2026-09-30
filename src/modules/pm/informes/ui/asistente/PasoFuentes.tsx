"use client";

import { useEffect, useRef, useState } from "react";

import {
  accionActualizarFoto,
  accionAnadirFuente,
  accionBorrarFoto,
  accionBorrarFuente,
  accionCargarFuentesAuto,
  accionGuardarNotas,
  accionIncluirFuente,
} from "../../actions/informes";
import { normalizarEstructura } from "../../logic/informe";
import { urlFoto } from "../../logic/paths";
import { CATEGORIAS_FOTO, PARA_FINANZAS, type Analisis, type CategoriaFoto, type Foto } from "../../types";
import { Boton, Chip, claseCampo, fechaCorta, Tarjeta } from "../componentes";
import type { HerramientaInforme } from "../InformeApp";
import { mensajeErrorClaude, pedirClaude } from "../lib/claude";
import { ACEPTA_DOCUMENTOS, ACEPTA_FOTOS, extraerTexto, redimensionar } from "../lib/ficheros";
import { ZonaSoltar } from "./ZonaSoltar";

/** Sube una foto (ya redimensionada) al informe. */
export async function subirFotoInforme(informeId: string, file: File, categoria: CategoriaFoto = "Obra", pie?: string): Promise<Foto> {
  const r = await redimensionar(file);
  const fd = new FormData();
  fd.set("informeId", informeId);
  fd.set("foto", new File([r.blob], file.name.replace(/\.[a-z0-9]+$/i, "") + ".jpg", { type: "image/jpeg" }));
  fd.set("nombre", file.name);
  fd.set("ancho", String(r.ancho));
  fd.set("alto", String(r.alto));
  fd.set("categoria", categoria);
  if (pie) fd.set("pie", pie);
  const res = await fetch("/api/informes/fotos", { method: "POST", body: fd });
  const cuerpo = (await res.json().catch(() => ({}))) as { foto?: Foto; error?: string };
  if (!res.ok || !cuerpo.foto) throw new Error(cuerpo.error ?? `Error ${res.status}`);
  return cuerpo.foto;
}

/** Paso 2 · Información del trimestre. */
export function PasoFuentes({ h }: { h: HerramientaInforme }) {
  const { informe, fuentes, fotos, puedeEditar } = h;
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [avisosAuto, setAvisosAuto] = useState<string[] | null>(null);
  const [analizando, setAnalizando] = useState<string | null>(null);
  const notasIniciales = fuentes.find((f) => f.tipo === "notas")?.texto ?? "";
  const [notas, setNotas] = useState(notasIniciales);
  const tNotas = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortar = useRef<AbortController | null>(null);
  const cargada = useRef(false);

  const auto = fuentes.filter((f) => f.auto);
  const documentos = fuentes.filter((f) => f.tipo !== "notas" && f.tipo !== "previo");

  async function cargarAuto(forzar: boolean) {
    if (!puedeEditar) return;
    if (!forzar && auto.length) return;
    setOcupado("Cargando las actas y la planificación del portal…");
    try {
      const r = await accionCargarFuentesAuto(informe.id);
      if (!r.ok) setAvisosAuto([r.error]);
      else {
        h.setFuentes(r.data.fuentes);
        setAvisosAuto(r.data.avisos);
      }
    } catch (e) {
      setAvisosAuto([`No se han podido cargar las actas y la planificación (${e instanceof Error ? e.message : "error"}). Puedes añadirlas a mano.`]);
    } finally {
      setOcupado(null);
    }
  }

  useEffect(() => {
    if (cargada.current) return;
    cargada.current = true;
    void cargarAuto(false);
    // Solo al entrar en el paso.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function cambiarNotas(v: string) {
    setNotas(v);
    if (tNotas.current) clearTimeout(tNotas.current);
    tNotas.current = setTimeout(async () => {
      const r = await accionGuardarNotas(informe.id, v);
      if (!r.ok) h.avisar(`No se han podido guardar las notas: ${r.error}`, "error");
    }, 1200);
  }

  async function guardarNotasYa() {
    if (tNotas.current) clearTimeout(tNotas.current);
    if (notas !== notasIniciales || !fuentes.some((f) => f.tipo === "notas")) {
      const r = await accionGuardarNotas(informe.id, notas);
      if (!r.ok) throw new Error(r.error);
    }
  }

  async function subirDocs(files: File[]) {
    for (const file of files) {
      setOcupado(`Leyendo ${file.name}…`);
      try {
        const texto = await extraerTexto(file);
        const r = await accionAnadirFuente(informe.id, { tipo: "documento", nombre: file.name, texto: texto.slice(0, 60_000) });
        if (!r.ok) throw new Error(r.error);
        h.setFuentes((fs) => [...fs, r.data]);
      } catch (e) {
        h.avisar(`No se ha podido leer ${file.name}: ${e instanceof Error ? e.message : "error"}`, "error");
      }
    }
    setOcupado(null);
  }

  async function subirFotos(files: File[]) {
    for (const file of files) {
      setOcupado(`Subiendo ${file.name}…`);
      try {
        const f = await subirFotoInforme(informe.id, file);
        h.setFotos((fs) => [...fs, f]);
      } catch (e) {
        h.avisar(`No se ha podido subir ${file.name}: ${e instanceof Error ? e.message : "error"}`, "error");
      }
    }
    setOcupado(null);
  }

  async function cambiarFoto(f: Foto, cambios: Partial<Pick<Foto, "categoria" | "para" | "pie">>) {
    const nuevo = { ...cambios };
    if (cambios.categoria === "Página de Finanzas" && !f.para) nuevo.para = "resumen-financiero";
    h.setFotos((fs) => fs.map((x) => (x.id === f.id ? { ...x, ...nuevo } : x)));
    const r = await accionActualizarFoto(informe.id, f.id, nuevo);
    if (!r.ok) h.avisar(`No se ha podido guardar la foto: ${r.error}`, "error");
  }

  async function analizar() {
    setAnalizando("Claude está leyendo la información…");
    h.avisar(null);
    abortar.current = new AbortController();
    try {
      await guardarNotasYa();
      const { json } = await pedirClaude(
        { tipo: "analisis", informeId: informe.id },
        {
          signal: abortar.current.signal,
          onProgreso: () => setAnalizando("Claude está escribiendo el análisis…"),
        },
      );
      const a = (json && typeof json === "object" ? json : {}) as Record<string, unknown>;
      for (const k of ["resumen", "objetivosPrevios", "hechos", "estructura", "sugeridas", "faltan", "contradicciones"]) {
        if (!Array.isArray(a[k])) a[k] = [];
      }
      const analisis = a as unknown as Analisis;
      analisis.estructura = normalizarEstructura(a.estructura, h.previo);
      const ok = await h.guardar(
        { analisis, seleccion: { estructura: analisis.estructura, anadir: [] }, estado: "analizado" },
        "Información del trimestre analizada",
      );
      if (!ok) throw new Error("no se ha podido guardar el análisis");
      h.ir("paso3");
    } catch (e) {
      h.avisar(mensajeErrorClaude(e), "error");
    } finally {
      setAnalizando(null);
      abortar.current = null;
    }
  }

  return (
    <>
      <Tarjeta>
        <h2 className="text-sm font-semibold text-text-primary">Información del {informe.trimestre}</h2>
        <div
          className={`rounded-md border px-3.5 py-2.5 text-sm ${
            avisosAuto?.length ? "border-amber-200 bg-amber-50 text-amber-900" : "border-green-200 bg-green-50 text-green-900"
          }`}
        >
          {auto.length
            ? `Actas y planificación del ${informe.trimestre} cargadas del portal (${fechaCorta(auto[0]!.actualizado)}). Están en la lista de documentos: puedes quitarlas o añadir más.`
            : "Las actas y la planificación del trimestre se cargan del portal."}
          {avisosAuto?.length ? (
            <ul className="mt-1 list-disc pl-5">
              {avisosAuto.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          ) : null}{" "}
          {puedeEditar ? (
            <button type="button" className="font-medium underline" disabled={!!ocupado} onClick={() => void cargarAuto(true)}>
              Volver a cargar
            </button>
          ) : null}
        </div>
        <p className="text-sm text-text-muted">
          Pega todo lo que tengas: notas, correos, actas, informes del PM, del asesor BREEAM o de Finanzas. No hace falta ordenarlo.
        </p>
        <textarea
          className={`${claseCampo} min-h-44 leading-normal`}
          value={notas}
          onChange={(e) => cambiarNotas(e.target.value)}
          placeholder="Notas del trimestre…"
          disabled={!puedeEditar}
        />
        {puedeEditar ? (
          <ZonaSoltar acepta={ACEPTA_DOCUMENTOS} multiple onFicheros={(f) => void subirDocs(f)} deshabilitado={!!ocupado}>
            Documentos (PDF, Word, PowerPoint, Excel, CSV, texto): arrastra aquí o pulsa para elegir
          </ZonaSoltar>
        ) : null}
        {documentos.length ? (
          <ul className="space-y-1 text-sm">
            {documentos.map((d) => (
              <li key={d.id} className={`flex flex-wrap items-center gap-2 ${d.incluida ? "" : "opacity-50"}`}>
                <span className={d.incluida ? "" : "line-through"}>{d.nombre}</span>
                {d.auto ? <Chip tono="ok">del portal</Chip> : null}
                {d.tipo === "correccion" ? <Chip>de una corrección</Chip> : null}
                <span className="text-xs text-text-muted">· {d.texto.length.toLocaleString("es-ES")} caracteres</span>
                {puedeEditar ? (
                  d.auto ? (
                    <Boton
                      variante="texto"
                      onClick={async () => {
                        h.setFuentes((fs) => fs.map((x) => (x.id === d.id ? { ...x, incluida: !d.incluida } : x)));
                        const r = await accionIncluirFuente(informe.id, d.id, !d.incluida);
                        if (!r.ok) h.avisar(r.error, "error");
                      }}
                    >
                      {d.incluida ? "Quitar" : "Volver a incluir"}
                    </Boton>
                  ) : (
                    <Boton
                      variante="texto"
                      onClick={async () => {
                        const r = await accionBorrarFuente(informe.id, d.id);
                        if (!r.ok) h.avisar(r.error, "error");
                        else h.setFuentes((fs) => fs.filter((x) => x.id !== d.id));
                      }}
                    >
                      Quitar
                    </Boton>
                  )
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
      </Tarjeta>

      <Tarjeta>
        <h2 className="text-sm font-semibold text-text-primary">Fotos</h2>
        {puedeEditar ? (
          <ZonaSoltar acepta={ACEPTA_FOTOS} multiple onFicheros={(f) => void subirFotos(f)} deshabilitado={!!ocupado}>
            Arrastra las fotos (JPG, PNG) o pulsa para elegirlas. Indica la categoría de cada una.
          </ZonaSoltar>
        ) : null}
        {fotos.length ? (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3">
            {fotos.map((f, i) => (
              <div key={f.id} className="flex flex-col gap-1.5 text-sm">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={urlFoto(f.id)}
                  alt={f.pie || `Foto ${i + 1}`}
                  className="aspect-[4/3] w-full rounded-md border border-subtle bg-page object-cover"
                />
                <select
                  className={claseCampo}
                  aria-label="Categoría"
                  value={f.categoria}
                  disabled={!puedeEditar}
                  onChange={(e) => void cambiarFoto(f, { categoria: e.target.value as CategoriaFoto })}
                >
                  {CATEGORIAS_FOTO.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
                {f.categoria === "Página de Finanzas" ? (
                  <select
                    className={claseCampo}
                    aria-label="Para qué slide"
                    value={f.para ?? "resumen-financiero"}
                    disabled={!puedeEditar}
                    onChange={(e) => void cambiarFoto(f, { para: e.target.value })}
                  >
                    {PARA_FINANZAS.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.etiqueta}
                      </option>
                    ))}
                  </select>
                ) : null}
                <input
                  className={claseCampo}
                  defaultValue={f.pie ?? ""}
                  placeholder="Qué muestra (opcional)"
                  disabled={!puedeEditar}
                  onBlur={(e) => {
                    if (e.target.value !== (f.pie ?? "")) void cambiarFoto(f, { pie: e.target.value || null });
                  }}
                />
                {puedeEditar ? (
                  <Boton
                    variante="texto"
                    className="self-start"
                    onClick={async () => {
                      const r = await accionBorrarFoto(informe.id, f.id);
                      if (!r.ok) h.avisar(r.error, "error");
                      else h.setFotos((fs) => fs.filter((x) => x.id !== f.id));
                    }}
                  >
                    Quitar foto
                  </Boton>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
      </Tarjeta>

      {ocupado || analizando ? (
        <p className="text-sm text-text-muted" aria-live="polite">
          {analizando ?? ocupado}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <Boton onClick={() => h.ir("paso1")} disabled={!!analizando}>
          Atrás
        </Boton>
        <Boton variante="primario" onClick={() => void analizar()} disabled={!puedeEditar || !!ocupado || !!analizando}>
          Analizar la información
        </Boton>
        {analizando ? <Boton onClick={() => abortar.current?.abort()}>Parar</Boton> : null}
        <span className="text-sm text-text-muted">Claude lee todo y propone la estructura (1–3 minutos).</span>
      </div>
    </>
  );
}
