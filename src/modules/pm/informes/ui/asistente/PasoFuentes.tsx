"use client";

import Link from "next/link";
import { useRef, useState } from "react";

import {
  accionActualizarFoto,
  accionAnadirFuente,
  accionBorrarFoto,
  accionBorrarFuente,
  accionCargarFuentesAuto,
  accionGuardarNoReportar,
  accionGuardarNotas,
  accionIncluirFuente,
} from "../../actions/informes";
import { dirigirFuente, pendientesDirigidas, seleccionBase, slidesDeFuente } from "../../logic/dirigidas";
import { fechaEs } from "../../logic/fuentes-actas";
import { respuestaAuto } from "../../logic/fuentes-auto";
import { normalizarEstructura, tituloDe } from "../../logic/informe";
import { rutaActasTrimestre, rutaPlanificacionProyecto, urlFoto } from "../../logic/paths";
import { parseTrimestre, rangoTrimestre } from "../../logic/trimestre";
import { CATEGORIAS_FOTO, PARA_FINANZAS, type Analisis, type CategoriaFoto, type Foto, type Fuente, type TipoFuenteAuto } from "../../types";
import { Aviso, Boton, Chip, claseCampo, Tarjeta } from "../componentes";
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

const ETIQUETA_AUTO: Record<TipoFuenteAuto, string> = { actas: "las actas", planificacion: "la planificación" };

/** Pregunta de sí o no sobre una fuente del portal. */
function PreguntaAuto({
  pregunta,
  detalle,
  enlace,
  textoEnlace,
  respuesta,
  cargada,
  deshabilitada,
  onResponder,
  onRecargar,
}: {
  pregunta: string;
  detalle: string;
  enlace: string;
  textoEnlace: string;
  respuesta: boolean | null;
  cargada: boolean;
  deshabilitada: boolean;
  onResponder: (si: boolean) => void;
  onRecargar: () => void;
}) {
  const clase = (activa: boolean) =>
    `rounded-md border px-3.5 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${
      activa ? "border-icam-900 bg-icam-900 text-white" : "border-subtle bg-card text-text-primary hover:bg-page"
    }`;
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-subtle/60 p-3">
      <div className="min-w-0 flex-1 basis-72 space-y-1">
        <p className="text-sm font-medium text-text-primary">{pregunta}</p>
        <p className="text-sm text-text-muted">
          {detalle}{" "}
          <Link href={enlace} target="_blank" className="font-medium text-icam-900 hover:underline">
            {textoEnlace}
          </Link>
        </p>
        {cargada ? (
          <button type="button" className="text-sm font-medium text-icam-900 underline disabled:opacity-40" disabled={deshabilitada} onClick={onRecargar}>
            Volver a cargar
          </button>
        ) : null}
      </div>
      <div className="flex gap-2" role="group" aria-label={pregunta}>
        <button type="button" className={clase(respuesta === true)} aria-pressed={respuesta === true} disabled={deshabilitada} onClick={() => onResponder(true)}>
          Sí
        </button>
        <button type="button" className={clase(respuesta === false)} aria-pressed={respuesta === false} disabled={deshabilitada} onClick={() => onResponder(false)}>
          No
        </button>
      </div>
    </div>
  );
}

/** Paso 2 · Información del trimestre. */
export function PasoFuentes({ h }: { h: HerramientaInforme }) {
  const { informe, fuentes, fotos, puedeEditar } = h;
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [avisosAuto, setAvisosAuto] = useState<string[]>([]);
  // Lo respondido en esta visita que todavía no ha dejado fuente guardada (un «no», o un «sí» que no se pudo cargar).
  const [respondido, setRespondido] = useState<Partial<Record<TipoFuenteAuto, boolean>>>({});
  const [analizando, setAnalizando] = useState<string | null>(null);
  const notasIniciales = fuentes.find((f) => f.tipo === "notas")?.texto ?? "";
  const [notas, setNotas] = useState(notasIniciales);
  const tNotas = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noReportarInicial = fuentes.find((f) => f.tipo === "no_reportar")?.texto ?? "";
  const [noReportar, setNoReportar] = useState(noReportarInicial);
  const tNoReportar = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortar = useRef<AbortController | null>(null);

  const idActivo = informe.proyecto.idActivo;
  const trimestre = parseTrimestre(informe.trimestre);
  const rango = trimestre ? rangoTrimestre(trimestre) : null;
  const respuesta = (tipo: TipoFuenteAuto) => respuestaAuto(fuentes, tipo) ?? respondido[tipo] ?? null;
  const sinResponder = !!idActivo && (respuesta("actas") === null || respuesta("planificacion") === null);
  const documentos = fuentes.filter((f) => f.tipo !== "notas" && f.tipo !== "previo" && f.tipo !== "no_reportar");
  // Con el informe ya generado se vuelve aquí desde la revisión: los documentos se pueden dirigir a slides concretas.
  const slides = (informe.contenido?.slides ?? []).filter((s) => !s.oculto);
  const yaGenerado = slides.length > 0;
  const porAplicar = pendientesDirigidas(informe.seleccion, fuentes, informe.contenido?.slides ?? []).length;

  function dirigir(fuenteId: number, slideId: string, marcada: boolean) {
    const actuales = slidesDeFuente(informe.seleccion, fuenteId);
    const nuevas = marcada ? [...actuales, slideId] : actuales.filter((s) => s !== slideId);
    void h.guardar({ seleccion: dirigirFuente(seleccionBase(informe.seleccion, informe.analisis), fuenteId, nuevas) });
  }

  async function volverALaRevision() {
    try {
      await guardarNotasYa();
      await guardarNoReportarYa();
      h.ir("editor");
    } catch (e) {
      h.avisar(`No se ha podido guardar: ${e instanceof Error ? e.message : "error"}`, "error");
    }
  }

  async function cargarAuto(tipo: TipoFuenteAuto) {
    setOcupado(`Cargando ${ETIQUETA_AUTO[tipo]} del portal…`);
    try {
      const r = await accionCargarFuentesAuto(informe.id, [tipo]);
      if (!r.ok) setAvisosAuto([r.error]);
      else {
        h.setFuentes(r.data.fuentes);
        setAvisosAuto(r.data.avisos);
      }
    } catch (e) {
      setAvisosAuto([`No se han podido cargar ${ETIQUETA_AUTO[tipo]} (${e instanceof Error ? e.message : "error"}). Puedes añadir esa información a mano.`]);
    } finally {
      setOcupado(null);
    }
  }

  async function responder(tipo: TipoFuenteAuto, si: boolean) {
    setRespondido((r) => ({ ...r, [tipo]: si }));
    setAvisosAuto([]);
    const fuente = fuentes.find((f) => f.auto && f.tipo === tipo);
    if (si && (!fuente || !fuente.incluida)) await cargarAuto(tipo);
    else if (!si && fuente?.incluida) {
      h.setFuentes((fs) => fs.map((x) => (x.id === fuente.id ? { ...x, incluida: false } : x)));
      const r = await accionIncluirFuente(informe.id, fuente.id, false);
      if (!r.ok) h.avisar(r.error, "error");
    }
  }

  // Lo guardado pasa a las fuentes del informe: al volver a este paso se ve lo último escrito.
  function ponerFuente(guardada: Fuente | null) {
    if (guardada) h.setFuentes((fs) => [...fs.filter((f) => f.tipo !== guardada.tipo), guardada]);
  }

  function cambiarNotas(v: string) {
    setNotas(v);
    if (tNotas.current) clearTimeout(tNotas.current);
    tNotas.current = setTimeout(async () => {
      const r = await accionGuardarNotas(informe.id, v);
      if (!r.ok) h.avisar(`No se han podido guardar las notas: ${r.error}`, "error");
      else ponerFuente(r.data);
    }, 1200);
  }

  async function guardarNotasYa() {
    if (tNotas.current) clearTimeout(tNotas.current);
    if (notas !== notasIniciales || !fuentes.some((f) => f.tipo === "notas")) {
      const r = await accionGuardarNotas(informe.id, notas);
      if (!r.ok) throw new Error(r.error);
      ponerFuente(r.data);
    }
  }

  function cambiarNoReportar(v: string) {
    setNoReportar(v);
    if (tNoReportar.current) clearTimeout(tNoReportar.current);
    tNoReportar.current = setTimeout(async () => {
      const r = await accionGuardarNoReportar(informe.id, v);
      if (!r.ok) h.avisar(`No se ha podido guardar «No reportar»: ${r.error}`, "error");
      else ponerFuente(r.data);
    }, 1200);
  }

  // Sin esto guardado, el análisis saldría sin la restricción: si falla, no se analiza.
  async function guardarNoReportarYa() {
    if (tNoReportar.current) clearTimeout(tNoReportar.current);
    if (noReportar !== noReportarInicial) {
      const r = await accionGuardarNoReportar(informe.id, noReportar);
      if (!r.ok) throw new Error(`no se ha podido guardar «No reportar» (${r.error})`);
      ponerFuente(r.data);
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
      await guardarNoReportarYa();
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
      // Sin indicaciones de «No reportar» no hay lista: así el paso 3 distingue «nada afectado» de «no se aplicaron».
      a.omitidos = noReportar.trim() ? (Array.isArray(a.omitidos) ? a.omitidos : []) : undefined;
      const analisis = a as unknown as Analisis;
      analisis.estructura = normalizarEstructura(a.estructura, h.previo);
      const ok = await h.guardar(
        { analisis, seleccion: { estructura: analisis.estructura, anadir: [], dirigidas: informe.seleccion?.dirigidas }, estado: "analizado" },
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
        {idActivo ? (
          <div className="space-y-2">
            <PreguntaAuto
              pregunta="¿Quieres incorporar las actas del trimestre?"
              detalle={
                rango
                  ? `Se añaden todas las anotaciones de las actas del ${fechaEs(rango.desde)} al ${fechaEs(rango.hasta)}, con el estado de cada elemento al inicio y al cierre.`
                  : "Se añaden todas las anotaciones de las actas del trimestre."
              }
              enlace={rutaActasTrimestre(idActivo, informe.trimestre)}
              textoEnlace="Ver las actas del trimestre"
              respuesta={respuesta("actas")}
              cargada={respuestaAuto(fuentes, "actas") === true}
              deshabilitada={!puedeEditar || !!ocupado || !!analizando}
              onResponder={(si) => void responder("actas", si)}
              onRecargar={() => void cargarAuto("actas")}
            />
            <PreguntaAuto
              pregunta="¿Quieres incorporar la planificación?"
              detalle="Se añaden los hitos con su fecha vigente, la comparación con la previsión anterior y el avance de obra al cierre del trimestre."
              enlace={rutaPlanificacionProyecto(idActivo)}
              textoEnlace="Ver la planificación"
              respuesta={respuesta("planificacion")}
              cargada={respuestaAuto(fuentes, "planificacion") === true}
              deshabilitada={!puedeEditar || !!ocupado || !!analizando}
              onResponder={(si) => void responder("planificacion", si)}
              onRecargar={() => void cargarAuto("planificacion")}
            />
          </div>
        ) : (
          <Aviso>Este proyecto no está vinculado a un activo de Proyectos: añade las actas y la planificación a mano.</Aviso>
        )}
        {avisosAuto.length ? (
          <Aviso>
            <ul className="list-disc pl-5">
              {avisosAuto.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          </Aviso>
        ) : null}
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
              <li key={d.id} className={`flex flex-wrap items-center gap-x-2 gap-y-1 ${d.incluida ? "" : "opacity-50"}`}>
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
                {yaGenerado && !d.auto ? (
                  <details className="basis-full pl-1">
                    <summary className="cursor-pointer text-sm text-icam-900">
                      {slidesDeFuente(informe.seleccion, d.id).length
                        ? `Dirigido a ${slides
                            .map((s, i) => (slidesDeFuente(informe.seleccion, d.id).includes(s.id) ? `la slide ${i + 1}` : null))
                            .filter(Boolean)
                            .join(", ")}`
                        : "Para todo el informe · dirigir a unas slides concretas"}
                    </summary>
                    <fieldset className="mt-1.5 grid gap-x-4 gap-y-1 sm:grid-cols-2" disabled={!puedeEditar}>
                      <legend className="sr-only">Slides a las que va dirigido {d.nombre}</legend>
                      {slides.map((s, i) => (
                        <label key={s.id} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={slidesDeFuente(informe.seleccion, d.id).includes(s.id)}
                            onChange={(e) => dirigir(d.id, s.id, e.target.checked)}
                          />
                          {i + 1} · {tituloDe(s)}
                        </label>
                      ))}
                    </fieldset>
                  </details>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
      </Tarjeta>

      <Tarjeta>
        <h2 className="text-sm font-semibold text-text-primary">Qué no debe aparecer en el informe</h2>
        <p className="text-sm text-text-muted">
          Indica lo que no hay que contar a los inversores aunque salga en las actas, la planificación, los documentos o el informe anterior. Una
          indicación por línea. Se aplica al análisis, a la redacción de cada slide, a las correcciones y a la revisión final.
          Si el informe anterior del proyecto ya tenía indicaciones, aparecen aquí copiadas: revisa que sigan vigentes.
        </p>
        <textarea
          className={`${claseCampo} min-h-28 leading-normal`}
          value={noReportar}
          maxLength={4000}
          onChange={(e) => cambiarNoReportar(e.target.value)}
          placeholder={
            "No mencionar la negociación con el operador hasta que se firme\nNo dar el importe de la oferta recibida por el local\nNo citar las incidencias con la comunidad de vecinos"
          }
          aria-label="Qué no debe aparecer en el informe"
          disabled={!puedeEditar}
        />
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
        {yaGenerado ? (
          <Boton variante="primario" onClick={() => void volverALaRevision()} disabled={!!ocupado || !!analizando}>
            {porAplicar ? `Volver a la revisión (${porAplicar} slide${porAplicar > 1 ? "s" : ""} por montar)` : "Volver a la revisión"}
          </Boton>
        ) : null}
        <Boton
          variante={yaGenerado ? "secundario" : "primario"}
          onClick={() => void analizar()}
          disabled={!puedeEditar || !!ocupado || !!analizando || sinResponder}
        >
          {yaGenerado ? "Volver a analizar" : "Analizar la información"}
        </Boton>
        {analizando ? <Boton onClick={() => abortar.current?.abort()}>Parar</Boton> : null}
        <span className="text-sm text-text-muted">
          {sinResponder
            ? "Antes de analizar, indica si quieres incorporar las actas y la planificación."
            : yaGenerado
              ? "Para usar un documento en unas slides, dirígelo a ellas y vuelve a la revisión: allí Claude las monta. Volver a analizar y generar rehace todo el informe."
              : "Claude lee todo y propone la estructura (1–3 minutos)."}
        </span>
      </div>
    </>
  );
}
