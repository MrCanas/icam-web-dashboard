"use client";

import { componentesPermitidos } from "../../slides/components";
import { medirFuera, type MedidaSlide } from "../../slides/motor";
import type { InformeJson, MetaInforme, SlideJson } from "../../slides/tipos";
import type { EntradaBiblioteca } from "../../logic/biblioteca";
import { ESTRUCTURALES } from "../../logic/biblioteca";
import { conFlotantesDe, flotantesAlHeredar, flotantesValidos } from "../../logic/flotantes";
import { actualizarPeriodo, clon, idNuevo, ordenar, renumerar, slideDeterminista, tituloDe, validarSlide } from "../../logic/informe";
import { urlFoto } from "../../logic/paths";
import { qCierre } from "../../logic/trimestre";
import type { Foto, Informe, IncidenciaCoherencia, PrevioEstructurado } from "../../types";
import { esCancelado, mensajeErrorClaude, pedirClaude } from "../lib/claude";

/**
 * Generación del informe en el navegador (la medición del relleno necesita
 * maquetación real). Port de generar() de app-equipo/src/app.html:
 *   - slides deterministas sin Claude (portada, índice, disclaimer, cierre,
 *     mantenidas y bloqueadas de Finanzas);
 *   - el resto, 2 a la vez: Claude → validar → medir → como mucho un ajuste
 *     si desborda o el relleno es < 80 %;
 *   - el resumen ejecutivo, el último; luego secciones, índice y coherencia.
 * Cada slide terminada se guarda al momento: si se cierra la pestaña, al
 * volver se reanuda con las que falten.
 */

export type EstadoFila = "cola" | "curso" | "hecho" | "error" | "fijo";

export interface FilaGeneracion {
  id: string;
  titulo: string;
  estado: EstadoFila;
  detalle: string;
  nota: string;
}

interface Tarea {
  id: string;
  accion: string;
  prev: SlideJson | null;
  titulo: string;
}

export interface OpcionesGeneracion {
  informe: Informe;
  previo: PrevioEstructurado | null;
  fotos: Foto[];
  biblioteca: EntradaBiblioteca[];
  /** Slides con información dirigida a ellas (logic/dirigidas.ts): Claude las monta con su documento. */
  dirigidas: Set<string>;
  signal: AbortSignal;
  /** Guarda el informe (en cola). */
  guardar: (contenido: InformeJson, extra?: { estado?: "generando" | "borrador"; qa?: { coherencia: IncidenciaCoherencia[]; fecha: string } }, cambio?: string) => Promise<boolean>;
  onFilas: (filas: FilaGeneracion[]) => void;
  onFase: (fase: string) => void;
}

/** Slide ya redactada (una que falló queda como «error» y se repite al reanudar). */
export function slideHecha(s: SlideJson): boolean {
  return !!(s.c || s.compuesto) && s.origen !== "error";
}

function metaInforme(i: Informe, previo: PrevioEstructurado | null): MetaInforme {
  return {
    proyecto: i.proyecto.nombre,
    codigo: i.codigo,
    trimestre: i.trimestre,
    trimestreAnterior: i.trimestreAnterior,
    siguiente: i.siguiente,
    fechaCierre: qCierre(i.trimestre),
    arquetipo: i.proyecto.arquetipo ?? "A",
    pie: previo?.meta?.pie || i.proyecto.pie || { variante: "sl" },
    version: `v${i.version}`,
    estado: "Borrador",
    actualizado: new Date().toISOString().slice(0, 10),
  };
}

export async function generarInforme(o: OpcionesGeneracion): Promise<"hecho" | "parado"> {
  const { informe: d, previo } = o;
  const permitidos = componentesPermitidos();
  const prevPorId = new Map((previo?.slides ?? []).map((s) => [s.id, s]));
  const sel = d.seleccion ?? { estructura: d.analisis?.estructura ?? [], anadir: [] };
  const accionDe = new Map(sel.estructura.map((e) => [e.id, e]));
  const periodo = { trimestre: d.trimestre, trimestreAnterior: d.trimestreAnterior, siguiente: d.siguiente, proyecto: d.proyecto.nombre };

  let meta: MetaInforme;
  let slides: SlideJson[];
  const tareas: Tarea[] = [];
  const reanudar = d.estado === "generando" && !!d.contenido?.slides?.length;

  if (reanudar) {
    meta = { ...metaInforme(d, previo), ...d.contenido!.meta };
    slides = clon(d.contenido!.slides);
    for (const s of slides) {
      if (s.oculto || slideHecha(s)) continue;
      const e = accionDe.get(s.id);
      const prev = prevPorId.get(s.id) ?? null;
      tareas.push({ id: s.id, accion: prev ? (e?.accion ?? "actualizar") : "nueva", prev, titulo: e?.titulo || (prev ? tituloDe(prev) : s.id) });
    }
  } else {
    meta = metaInforme(d, previo);
    slides = [];
    // Imágenes colocadas a mano: si este informe ya tenía slides (se regenera), las suyas; si no, las que se heredan del anterior.
    const propias = d.contenido?.slides?.length ? new Map(d.contenido.slides.map((s) => [s.id, s])) : null;
    for (const e of sel.estructura) {
      const prev = prevPorId.get(e.id) ?? null;
      const s: SlideJson = prev ? clon(prev) : { id: e.id };
      const flotantes = propias ? flotantesValidos(propias.get(e.id)?.flotantes) : flotantesAlHeredar(e.accion, e.id, prev);
      if (flotantes.length) s.flotantes = flotantes;
      else delete s.flotantes;
      if (e.accion === "ocultar") {
        s.oculto = true;
        slides.push(s);
        continue;
      }
      delete s.oculto;
      if (prev) {
        // Se reescribe: hasta que Claude la redacte no cuenta como hecha.
        s.origen = e.accion === "mantener" ? s.origen : "error";
      }
      slides.push(s);
      tareas.push({
        id: e.id,
        accion: prev ? e.accion : e.accion === "mantener" && ["disclaimer", "cierre"].includes(e.id) ? "mantener" : "nueva",
        prev,
        titulo: e.titulo || (prev ? tituloDe(prev) : e.id),
      });
    }
    for (const n of sel.anadir) {
      const b = o.biblioteca.find((x) => x.n === n);
      if (!b) continue;
      const id = idNuevo(b, slides);
      slides.push({ id });
      tareas.push({ id, accion: "nueva", prev: null, titulo: b.nombre });
    }
    slides = ordenar(slides);
  }

  const filas: FilaGeneracion[] = tareas.map((t) => ({ id: t.id, titulo: t.titulo, estado: "cola", detalle: "", nota: "" }));
  const refrescar = () => o.onFilas(filas.map((f) => ({ ...f })));
  const fila = (id: string) => filas.find((f) => f.id === id)!;
  const contenido = (): InformeJson => ({ meta, slides });
  // La generación rehace slides enteras: las imágenes que el equipo colocó a mano encima se quedan.
  const poner = (id: string, s: SlideJson) => {
    const i = slides.findIndex((x) => x.id === id);
    if (i >= 0) slides[i] = conFlotantesDe(slides[i], s);
  };

  refrescar();
  if (!reanudar) await o.guardar(contenido(), { estado: "generando" }, "Generación iniciada (GO)");

  async function redactar(t: Tarea, f: FilaGeneracion, peticion: Parameters<typeof pedirClaude>[0], origen: string) {
    try {
      const { json } = await pedirClaude(peticion, { signal: o.signal });
      let s = actualizarPeriodo(validarSlide(json, t.id, permitidos), periodo);
      s.origen = s.origen || origen;
      let m: MedidaSlide = medirFuera(s, 5, meta);
      if (m.error) throw new Error(m.error);
      // Un ajuste si desborda o queda corta; un segundo solo si sigue desbordando (a menudo por pocos px,
      // y una slide que desborda bloquea la aprobación).
      for (let intento = 0; intento < 2; intento++) {
        const hace = intento === 0 ? m.desborde || (m.relleno != null && m.relleno < 80) : m.desborde;
        if (!hace) break;
        f.detalle = m.desborde ? `Ajustando: desborda${intento ? " (2.º intento)" : ""}` : `Ajustando: relleno ${m.relleno} %`;
        refrescar();
        try {
          const { json: j2 } = await pedirClaude(
            { tipo: "ajuste", informeId: d.id, slide: s, medida: { desborde: m.desborde, ocupacion: m.ocupacion, relleno: m.relleno } },
            { signal: o.signal },
          );
          const s2 = actualizarPeriodo(validarSlide(j2, t.id, permitidos), periodo);
          s2.origen = s2.origen || origen;
          const m2 = medirFuera(s2, 5, meta);
          // Se queda el ajuste salvo que rompa algo que antes estaba bien.
          if (!m2.error && !(m2.desborde && !m.desborde)) {
            s = s2;
            m = m2;
          }
        } catch (e) {
          if (esCancelado(e)) throw e;
          break;
        }
      }
      poner(t.id, s);
      await o.guardar(contenido());
      f.estado = "hecho";
      f.detalle = "";
      f.nota = m.desborde ? "Desborda: revísalo" : m.relleno != null ? `Relleno ${m.relleno} %` : "Hecho";
    } catch (e) {
      f.estado = "error";
      f.detalle = "";
      f.nota = esCancelado(e) ? "Parado" : mensajeErrorClaude(e);
      const actual = slides.find((x) => x.id === t.id);
      if (actual && !slideHecha(actual)) {
        poner(t.id, {
          id: t.id,
          origen: "error",
          compuesto: {
            seccion: 1,
            titulo: f.titulo,
            contenido: [{ c: "Texto", props: { parrafos: ["[pendiente: no se pudo redactar este slide; usa «Corregir» o vuelve a generar]"] } }],
          },
        });
        await o.guardar(contenido());
      }
    }
    refrescar();
  }

  async function unaTarea(t: Tarea) {
    const f = fila(t.id);
    if (o.signal.aborted) {
      f.estado = "error";
      f.nota = "Parado";
      refrescar();
      return;
    }
    const actual = slides.find((x) => x.id === t.id) ?? { id: t.id };
    // Con un documento dirigido a ella, la slide se monta con ese documento (también las de Finanzas, que si no irían como página pendiente).
    if (o.dirigidas.has(t.id) && !ESTRUCTURALES.includes(t.id) && t.id !== "resumen-ejecutivo") {
      f.estado = "curso";
      f.detalle = "Montando con su información";
      refrescar();
      await redactar(t, f, { tipo: "slide", informeId: d.id, slideId: t.id, modo: "dirigida", slide: actual }, t.prev ? "actualizada" : "nueva");
      return;
    }
    const det = slideDeterminista(t, actual, periodo, o.fotos, urlFoto);
    if (det) {
      poner(t.id, det);
      f.estado = "fijo";
      f.nota = det.origen === "bloqueada" ? String((det.props as { estado?: string }).estado ?? "") : "Sin cambios de contenido";
      refrescar();
      return;
    }
    if (t.id === "resumen-ejecutivo") return; // al final
    f.estado = "curso";
    f.detalle = "Redactando";
    refrescar();
    await redactar(
      t,
      f,
      { tipo: "slide", informeId: d.id, slideId: t.id, modo: t.prev && t.accion === "actualizar" ? "actualizar" : "nueva" },
      t.prev ? "actualizada" : "nueva",
    );
  }

  o.onFase("Redactando las slides (2 a la vez)");
  const cola = tareas.filter((t) => t.id !== "resumen-ejecutivo");
  let i = 0;
  const trabajador = async () => {
    while (i < cola.length) await unaTarea(cola[i++]!);
  };
  await Promise.all([trabajador(), trabajador()]);
  // Las deterministas no guardan una a una: se guardan aquí juntas.
  await o.guardar(contenido());

  const tRes = tareas.find((t) => t.id === "resumen-ejecutivo");
  if (tRes && !o.signal.aborted) {
    o.onFase("Redactando el resumen ejecutivo");
    const f = fila(tRes.id);
    f.estado = "curso";
    f.detalle = "Redactando";
    refrescar();
    await redactar(tRes, f, { tipo: "resumen", informeId: d.id, slides }, "actualizada");
  }

  if (o.signal.aborted) {
    await o.guardar(contenido(), undefined, "Generación parada a medias");
    return "parado";
  }

  renumerar(slides);
  o.onFase("Revisando la coherencia entre slides");
  let qa: { coherencia: IncidenciaCoherencia[]; fecha: string } | undefined;
  try {
    const { json } = await pedirClaude({ tipo: "coherencia", informeId: d.id, slides }, { signal: o.signal });
    qa = { coherencia: Array.isArray(json) ? (json as IncidenciaCoherencia[]).slice(0, 12) : [], fecha: new Date().toISOString() };
  } catch {
    // La coherencia se puede repetir desde el editor.
  }
  const fallidas = filas.filter((f) => f.estado === "error").length;
  await o.guardar(contenido(), { estado: "borrador", qa }, `v${d.version} generada${fallidas ? ` (${fallidas} slide(s) sin redactar)` : ""}`);
  return "hecho";
}
