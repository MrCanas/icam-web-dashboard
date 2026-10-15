"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  accionBorrarInforme,
  accionExportaciones,
  accionGuardarVersion,
  accionHistorial,
  accionMarcarRevisionDeshecha,
  accionRegistrarRevision,
  accionRevisiones,
} from "../../actions/informes";
import { NO_ANADIBLES } from "../../logic/biblioteca";
import { slideDesdeClaude, traerDelAnterior } from "../../logic/estructuraFija";
import { anadirAvisos, instruccionDeAvisos, marcar, normalizarCoherencia, nuevaRevision, resolverSlides, slidesDeAviso } from "../../logic/coherencia";
import { hitosObligatorios, reponerHitos, textoCambioHito } from "../../logic/cronograma";
import { desmarcarAplicadas, marcarAplicadas, pendientesDirigidas, seleccionBase, slidesConDirigidas } from "../../logic/dirigidas";
import { incidenciasExportacion, resumenIncidencias } from "../../logic/exportacion";
import { conFlotantesDe } from "../../logic/flotantes";
import { actualizarPeriodo, clon, idNuevo, ordenar, qaMecanico, renumerar, tituloDe, validarSlide, type MedidaQa } from "../../logic/informe";
import {
  aplicarResultado,
  deshacerRevision,
  duplicarSlide,
  etiquetaSlide,
  leerResultado,
  mapaNumeros,
  slidesCitadas,
  type ResultadoRevision,
} from "../../logic/operaciones";
import { rutaImprimir, rutaListaInformes, rutaPdf } from "../../logic/paths";
import { componentesPermitidos } from "../../slides/components";
import { medirFuera, type MedidaSlide } from "../../slides/motor";
import type { InformeJson, MetaInforme, SlideJson } from "../../slides/tipos";
import type { Cambio, Exportacion, IncidenciaCoherencia, QaInforme, ResumenUso, RevisionInforme, Seleccion, TipoRevision } from "../../types";
import { Aviso, Boton, ChipEstado, claseCampo, fechaCorta, Tarjeta } from "../componentes";
import type { HerramientaInforme } from "../InformeApp";
import { DialogoExportar } from "../exportacion/DialogoExportar";
import { ZonaSoltar } from "../asistente/ZonaSoltar";
import { esCancelado, mensajeErrorClaude, pedirClaude, type ImagenClaude } from "../lib/claude";
import { ACEPTA_DOCUMENTOS, extraerTexto } from "../lib/ficheros";
import type { ResultadoVisor } from "../slides/VisorSlide";
import { PanelCoherencia } from "./PanelCoherencia";
import { PanelRevisiones } from "./PanelRevisiones";
import { TarjetaSlide } from "./TarjetaSlide";

/** Lo que el editor pide a Claude sobre el informe (instrucción, desdoblar, fusionar, coherencia…). */
export interface PeticionRevision {
  instruccion: string;
  ambito: string[];
  tipo: TipoRevision;
  adjuntos?: string;
  imagenes?: ImagenClaude[];
  /** Cambio del QA que se guarda junto con el resultado (p. ej. marcar avisos como aplicados). */
  qa?: (qa: QaInforme) => QaInforme;
}

/** Datos de una petición a Claude que ha devuelto una slide (para avisos, cronograma e historial). */
export interface OrigenClaude {
  tipo: TipoRevision;
  instruccion: string;
  json: unknown;
}

const TITULO_REVISION: Record<TipoRevision, string> = {
  instruccion: "Instrucción",
  correccion: "Corrección",
  coherencia: "Coherencia aplicada",
  desdoblar: "Desdoblada",
  fusionar: "Fusionadas",
  duplicar: "Duplicada",
  nueva: "Slide nueva",
  analisis: "Análisis revisado",
};

/** Avisos que devuelve Claude junto a una corrección o revisión (texto suelto o {slide, problema}), con las slides por id. */
function avisosDeClaude(json: unknown, slides: SlideJson[]): IncidenciaCoherencia[] {
  const av = json && typeof json === "object" ? (json as { avisos?: unknown }).avisos : null;
  const lista = Array.isArray(av) ? av.map((x) => (typeof x === "string" ? { slide: "", problema: x } : x)) : [];
  return resolverSlides(normalizarCoherencia(lista, "correccion"), mapaNumeros(slides).porNumero, new Set(slides.map((s) => s.id)));
}

function hitosQuitadosDe(json: unknown): string[] {
  const q = json && typeof json === "object" ? (json as { hitosQuitados?: unknown }).hitosQuitados : null;
  return Array.isArray(q) ? q.filter((x): x is string => typeof x === "string") : [];
}

interface Props {
  h: HerramientaInforme;
  estadoGuardado: string;
  usoInicial: ResumenUso | null;
}

/** Editor del informe generado: revisión, correcciones, orden, versiones, aprobación y PDF. */
export function Editor({ h, estadoGuardado, usoInicial }: Props) {
  const router = useRouter();
  const { informe, biblioteca, puedeEditar } = h;
  const contenido = informe.contenido;
  const [medidas, setMedidas] = useState<Record<string, ResultadoVisor>>({});
  const [ocupado, setOcupado] = useState("");
  const [bib, setBib] = useState<number>(() => biblioteca.find((b) => !NO_ANADIBLES.includes(b.id))?.n ?? 0);
  const [confirmar, setConfirmar] = useState(false);
  const [historial, setHistorial] = useState<Cambio[] | null>(null);
  const [uso, setUso] = useState<ResumenUso | null>(usoInicial);
  const [pdf, setPdf] = useState<{ generando: boolean; error: string | null }>({ generando: false, error: null });
  // Validador de exportación abierto, y registro de exportaciones (null: sin cargar; string: no se ha podido leer).
  const [exportando, setExportando] = useState(false);
  const [exportaciones, setExportaciones] = useState<Exportacion[] | string | null>(null);

  // Cada slide conserva su objeto mientras no cambie su contenido: así no se repintan todas tras cada guardado.
  const [cache] = useState(() => new Map<string, { json: string; slide: SlideJson }>());
  const slides = useMemo(() => {
    return (contenido?.slides ?? []).map((s) => {
      const json = JSON.stringify(s);
      const prev = cache.get(s.id);
      if (prev && prev.json === json) return prev.slide;
      cache.set(s.id, { json, slide: s });
      return s;
    });
  }, [contenido, cache]);
  const visibles = slides.filter((s) => !s.oculto);
  const ocultas = slides.filter((s) => s.oculto);
  // Lo mismo con los datos comunes del informe: cada guardado trae un objeto nuevo aunque no hayan cambiado.
  const [cacheMeta] = useState(() => new Map<string, MetaInforme | null>());
  const meta = useMemo(() => {
    const json = JSON.stringify(contenido?.meta ?? null);
    if (!cacheMeta.has(json)) {
      cacheMeta.clear();
      cacheMeta.set(json, contenido?.meta ?? null);
    }
    return cacheMeta.get(json) ?? null;
  }, [contenido, cacheMeta]);
  // Slides anteriores a cada cambio de esta sesión, para «Deshacer» (la más reciente, al final).
  const [anteriores, setAnteriores] = useState<Record<string, SlideJson[]>>({});
  // Información que el equipo ha dirigido a slides concretas y todavía no se ha usado para montarlas.
  const pendientes = useMemo(
    () => (contenido ? pendientesDirigidas(informe.seleccion, h.fuentes, contenido.slides) : []),
    [contenido, informe.seleccion, h.fuentes],
  );
  const [montando, setMontando] = useState(false);
  // Historial de revisiones (null: sin cargar; texto: no se ha podido leer, p. ej. sin la migración 050).
  const [revisiones, setRevisiones] = useState<RevisionInforme[] | string | null>(null);
  const [instruccion, setInstruccion] = useState("");
  const [adjuntos, setAdjuntos] = useState<{ nombre: string; texto: string }[]>([]);
  const [revisando, setRevisando] = useState(false);
  const obligatorios = useMemo(() => hitosObligatorios(informe.analisis, h.previo), [informe.analisis, h.previo]);

  useEffect(() => {
    let vivo = true;
    void accionRevisiones(informe.id).then((r) => vivo && setRevisiones(r.ok ? r.data : r.error));
    return () => {
      vivo = false;
    };
  }, [informe.id]);

  // Historial y coste: se recargan tras cada guardado.
  useEffect(() => {
    let vivo = true;
    void accionHistorial(informe.id).then((r) => {
      if (!vivo || !r.ok) return;
      setHistorial(r.data.cambios);
      setUso(r.data.uso);
    });
    return () => {
      vivo = false;
    };
  }, [informe.id, informe.actualizado]);

  const medidasQa: Record<string, MedidaQa> = useMemo(() => {
    const out: Record<string, MedidaQa> = {};
    for (const [id, m] of Object.entries(medidas)) {
      out[id] = { pendientes: m.pendientes, relleno: m.medida?.relleno ?? null, desborde: m.medida?.desborde, error: m.error };
    }
    return out;
  }, [medidas]);
  const qa = useMemo(() => (contenido ? qaMecanico(contenido.slides, medidasQa, informe) : []), [contenido, medidasQa, informe]);
  const medidasCompletas = visibles.every((s) => medidas[s.id]);
  const bloqueantes = qa.filter((x) => x.nivel === "error");
  // Lo que verá el validador antes de exportar: la revisión más las incoherencias, Finanzas y huecos de imagen.
  const incidencias = useMemo(
    () => (contenido ? incidenciasExportacion(contenido.slides, medidasQa, informe, informe.qa?.coherencia ?? []) : []),
    [contenido, medidasQa, informe],
  );

  const cargarExportaciones = useCallback(() => {
    void accionExportaciones(informe.id).then((r) => setExportaciones(r.ok ? r.data : r.error));
  }, [informe.id]);
  useEffect(() => cargarExportaciones(), [cargarExportaciones]);

  if (!contenido) {
    return (
      <Tarjeta>
        <p className="text-sm">Este informe todavía no tiene slides.</p>
        <Boton onClick={() => h.ir("paso3")}>Ir a la biblioteca y GO</Boton>
      </Tarjeta>
    );
  }

  function conSlides(fn: (sl: SlideJson[]) => SlideJson[] | void, cambio: string) {
    const c: InformeJson = clon(contenido!);
    const r = fn(c.slides);
    if (r) c.slides = r;
    renumerar(c.slides);
    void h.guardar({ contenido: c }, cambio);
  }

  /**
   * Sustituye una slide (corrección de Claude o cambio a mano): comprueba que
   * pinta, la guarda y deja la anterior para «Deshacer». Devuelve su medida.
   */
  async function cambiarSlide(
    id: string,
    pagina: number,
    nueva: SlideJson,
    cambio: string,
    deshaciendo = false,
    seleccion?: Seleccion,
    claude?: OrigenClaude,
  ): Promise<MedidaSlide> {
    const anterior = contenido!.slides.find((s) => s.id === id);
    if (!anterior) throw new Error("la slide ya no existe");
    if (anterior.cerrada && claude) throw new Error("la slide está cerrada: ábrela para cambiarla");
    let qa: QaInforme | null = null;
    if (claude) {
      // Lo que hace Claude pasa por las mismas comprobaciones que la generación: el cronograma se conserva y sus avisos se guardan.
      const conNueva = contenido!.slides.map((x) => (x.id === id ? nueva : x));
      const crono = reponerHitos(conNueva, obligatorios, { quitados: hitosQuitadosDe(claude.json), soloSlides: [id] });
      nueva = crono.slides.find((x) => x.id === id) ?? nueva;
      const avisos = [
        ...avisosDeClaude(claude.json, contenido!.slides),
        ...normalizarCoherencia(crono.cambios.map((c) => ({ slide: c.slide, problema: textoCambioHito(c) })), "cronograma"),
      ];
      if (avisos.length) qa = anadirAvisos(informe.qa, avisos);
    }
    const m = medirFuera(nueva, pagina, contenido!.meta);
    if (m.error) throw new Error(m.error);
    const c: InformeJson = clon(contenido!);
    c.slides = c.slides.map((x) => (x.id === id ? clon(nueva) : x));
    renumerar(c.slides);
    const cambios = { contenido: c, ...(seleccion ? { seleccion } : {}), ...(qa ? { qa } : {}) };
    if (!(await h.guardar(cambios, cambio))) throw new Error("no se ha podido guardar");
    setAnteriores((p) => ({ ...p, [id]: deshaciendo ? (p[id] ?? []).slice(0, -1) : [...(p[id] ?? []).slice(-19), anterior] }));
    if (claude) void registrar(claude.tipo, claude.instruccion, "", [anterior], [id], c.slides, contenido!.slides.map((x) => x.id));
    return m;
  }

  /* ---------- revisiones con Claude que pueden tocar varias slides ---------- */

  const permitidos = componentesPermitidos();
  const numeroDe = (id: string) => {
    const n = mapaNumeros(contenido!.slides).porId.get(id);
    return n ? `Slide ${n}` : id;
  };
  const etiqueta = (id: string) => (id ? etiquetaSlide(contenido!.slides, id) : "Informe");

  async function registrar(tipo: TipoRevision, instr: string, resumen: string, antes: SlideJson[], despuesIds: string[], todas: SlideJson[], ordenAntes: string[]) {
    const r = await accionRegistrarRevision(informe.id, {
      tipo,
      instruccion: instr,
      resumen,
      antes,
      despues: todas.filter((s) => despuesIds.includes(s.id)),
      ordenAntes,
    });
    if (r.ok) setRevisiones((p) => (Array.isArray(p) ? [r.data, ...p] : [r.data]));
  }

  /** Aplica lo que propone Claude (varias slides), con cronograma, avisos e historial. Devuelve el resumen para enseñarlo. */
  async function integrar(r: ResultadoRevision, meta: { tipo: TipoRevision; instruccion: string; avisos: IncidenciaCoherencia[]; qa?: (qa: QaInforme) => QaInforme }): Promise<string> {
    const base = contenido!;
    const validar = (o: unknown, id: string): SlideJson => {
      const s = actualizarPeriodo(validarSlide(o, id, permitidos), informe);
      const m = medirFuera(s, 5, base.meta);
      if (m.error) throw new Error(m.error);
      return s;
    };
    const ap = aplicarResultado(base.slides, r, validar);
    if (!ap.despues.length && !ap.antes.length) throw new Error(ap.rechazos.join(" ") || "Claude no ha propuesto ningún cambio.");
    const crono = reponerHitos(ap.slides, obligatorios, { quitados: r.hitosQuitados, soloSlides: ap.despues });
    const avisos = [
      ...meta.avisos,
      ...normalizarCoherencia(crono.cambios.map((c) => ({ slide: c.slide, problema: textoCambioHito(c) })), "cronograma"),
    ];
    let qa = avisos.length ? anadirAvisos(informe.qa, avisos) : informe.qa;
    if (meta.qa) qa = meta.qa(qa ?? { coherencia: [], fecha: new Date().toISOString() });
    const c: InformeJson = { ...clon(base), slides: crono.slides };
    const ok = await h.guardar(qa ? { contenido: c, qa } : { contenido: c }, `${TITULO_REVISION[meta.tipo]}: ${meta.instruccion.slice(0, 300)}`);
    if (!ok) throw new Error("no se ha podido guardar");
    void registrar(meta.tipo, meta.instruccion, r.resumen, ap.antes, ap.despues, crono.slides, base.slides.map((s) => s.id));
    const primera = ap.despues[0];
    if (primera) setTimeout(() => document.getElementById(`ed-${primera}`)?.scrollIntoView({ block: "center" }), 300);
    return [
      r.resumen || "Hecho.",
      ap.rechazos.length ? `No se ha aplicado: ${ap.rechazos.join(" ")}` : "",
      avisos.length ? `${avisos.length} aviso(s) nuevo(s) en «Coherencia entre slides».` : "",
    ]
      .filter(Boolean)
      .join(" ");
  }

  /** Pide a Claude una revisión del informe y la aplica. Lanza si falla. */
  async function revisar(p: PeticionRevision): Promise<string> {
    const { json } = await pedirClaude(
      { tipo: "revision", informeId: informe.id, instruccion: p.instruccion, slides: contenido!.slides, ambito: p.ambito, adjuntos: p.adjuntos },
      { imagenes: p.imagenes },
    );
    return integrar(leerResultado(json), { tipo: p.tipo, instruccion: p.instruccion, avisos: avisosDeClaude(json, contenido!.slides), qa: p.qa });
  }

  /** Lo mismo, desde los botones del editor: con el mensaje de «ocupado» y el error explicado. */
  async function lanzar(p: PeticionRevision, mensaje: string): Promise<boolean> {
    if (revisando) return false;
    setRevisando(true);
    setOcupado(mensaje);
    try {
      setOcupado(await revisar(p));
      return true;
    } catch (e) {
      setOcupado(e instanceof Error && !("code" in e) ? `No se ha podido aplicar: ${e.message}` : mensajeErrorClaude(e));
      return false;
    } finally {
      setRevisando(false);
    }
  }

  async function aplicarInstruccion() {
    const instr = instruccion.trim();
    if (!instr) return;
    const ambito = slidesCitadas(instr, contenido!.slides);
    const adj = adjuntos.length
      ? "== MATERIAL ADJUNTO A ESTA INSTRUCCIÓN (úsalo como fuente; prevalece sobre lo anterior si se contradicen) ==\n" +
        adjuntos.map((a) => `### DOCUMENTO: ${a.nombre}\n${a.texto}`).join("\n\n")
      : undefined;
    const ok = await lanzar(
      { instruccion: instr, ambito, tipo: "instruccion", adjuntos: adj },
      `Claude está aplicando la instrucción${ambito.length ? ` (${ambito.map(numeroDe).join(", ")})` : ""}…`,
    );
    if (ok) {
      setInstruccion("");
      setAdjuntos([]);
    }
  }

  async function adjuntarGlobal(files: File[]) {
    for (const file of files) {
      setOcupado(`Leyendo ${file.name}…`);
      try {
        const texto = (await extraerTexto(file)).slice(0, 40_000);
        setAdjuntos((a) => [...a, { nombre: file.name, texto }]);
        setOcupado("");
      } catch (e) {
        setOcupado(`No se ha podido leer ${file.name}: ${e instanceof Error ? e.message : "error"}`);
      }
    }
  }

  function aplicarAvisos(avisos: IncidenciaCoherencia[], general: string) {
    const ids = avisos.map((x) => x.id!);
    const ambito = [...new Set(avisos.flatMap(slidesDeAviso))].filter((id) => contenido!.slides.some((s) => s.id === id));
    void lanzar(
      {
        instruccion: instruccionDeAvisos(avisos, general, numeroDe),
        ambito,
        tipo: "coherencia",
        qa: (qa) => {
          const m = marcar(qa, ids, { estado: "aplicado" });
          if (general.trim()) delete m.comentarioGeneral;
          return m;
        },
      },
      `Claude está aplicando ${avisos.length ? `${avisos.length} aviso(s)` : "el comentario general"}…`,
    );
  }

  /**
   * «Traer del trimestre anterior»: la slide como estaba en el informe
   * anterior, al periodo de este (las fijas, montadas con su estructura). Con
   * su «Deshacer»; CM/PM, que puede ocupar dos, se cambia de una vez.
   */
  function traerAnterior(id: string, pagina: number): (() => Promise<void>) | null {
    const previo = h.previo?.slides;
    if (!previo) return null;
    const actual = contenido!.slides.find((x) => x.id === id) ?? null;
    const nuevas = traerDelAnterior(id, previo, actual, informe);
    if (!nuevas?.length) return null;
    const cambio = `${tituloDe(nuevas[0]!)}: traída del ${informe.trimestreAnterior}`;
    if (!/^situacion-cm-pm/.test(id)) return async () => void (await cambiarSlide(id, pagina, nuevas[0]!, cambio));
    return async () =>
      conSlides((sl) => {
        const i = sl.findIndex((x) => x.id === "situacion-cm-pm");
        const i2 = sl.findIndex((x) => x.id === "situacion-cm-pm-2");
        const [primera, segunda] = nuevas;
        if (i >= 0) sl[i] = conFlotantesDe(sl[i], primera!);
        if (segunda) {
          if (i2 >= 0) sl[i2] = conFlotantesDe(sl[i2], segunda);
          else sl.splice(i + 1, 0, segunda);
        } else if (i2 >= 0) sl[i2]!.oculto = true;
      }, cambio);
  }

  function duplicar(id: string) {
    const d = duplicarSlide(contenido!.slides, id);
    if (!d) return;
    const c: InformeJson = { ...clon(contenido!), slides: d.slides };
    void h.guardar({ contenido: c }, `Duplicada: ${etiqueta(id)}`).then((ok) => {
      if (!ok) return;
      void registrar("duplicar", `Duplicar ${etiqueta(id)}`, "", [], [d.nueva], d.slides, contenido!.slides.map((s) => s.id));
      setTimeout(() => document.getElementById(`ed-${d.nueva}`)?.scrollIntoView({ block: "center" }), 300);
    });
  }

  function alternarCerrada(id: string) {
    const s = slides.find((x) => x.id === id)!;
    conSlides(
      (sl) => {
        const x = sl.find((y) => y.id === id)!;
        if (x.cerrada) delete x.cerrada;
        else x.cerrada = true;
      },
      `${s.cerrada ? "Abierta" : "Cerrada"}: ${tituloDe(s)}`,
    );
  }

  async function deshacerRev(r: RevisionInforme) {
    const res = deshacerRevision(contenido!.slides, r);
    if ("error" in res) {
      setOcupado(`No se puede deshacer: ${res.error}`);
      return;
    }
    const c: InformeJson = { ...clon(contenido!), slides: res.slides };
    if (!(await h.guardar({ contenido: c }, `Revisión deshecha: ${r.instruccion.slice(0, 200)}`))) return;
    const m = await accionMarcarRevisionDeshecha(informe.id, r.id);
    if (m.ok) setRevisiones((p) => (Array.isArray(p) ? p.map((x) => (x.id === r.id ? { ...x, deshecha: true } : x)) : p));
    setOcupado("Revisión deshecha.");
  }

  function deshacer(id: string, pagina: number): Promise<MedidaSlide> {
    const previa = anteriores[id]?.at(-1);
    if (!previa) return Promise.reject(new Error("no hay cambios que deshacer"));
    // Si lo que se deshace es un montaje con información dirigida, esa información vuelve a estar pendiente.
    const seleccion = slidesConDirigidas(informe.seleccion, h.fuentes).has(id)
      ? desmarcarAplicadas(seleccionBase(informe.seleccion, informe.analisis), [id])
      : undefined;
    return cambiarSlide(id, pagina, previa, `${tituloDe(previa)}: cambio deshecho`, true, seleccion);
  }

  /**
   * Monta con Claude las slides que tienen información dirigida sin aplicar
   * (todas, o solo una): una petición por slide, que la rehace entera con su
   * documento. Cada una queda con su «Deshacer».
   */
  async function montarDirigidas(soloId?: string) {
    const lista = pendientes.filter((p) => !soloId || p.slide.id === soloId);
    if (!lista.length || montando) return;
    setMontando(true);
    // Varias slides seguidas: se trabaja sobre lo último guardado, no sobre el estado de este render.
    let base: InformeJson = clon(contenido!);
    let seleccion = seleccionBase(informe.seleccion, informe.analisis);
    const permitidos = componentesPermitidos();
    const fallos: string[] = [];
    let hechas = 0;
    for (const [n, p] of lista.entries()) {
      const actual = base.slides.find((s) => s.id === p.slide.id);
      if (!actual || actual.cerrada) continue;
      const documentos = p.fuentes.map((f) => f.nombre).join(", ");
      setOcupado(`Claude está montando «${tituloDe(actual)}» con ${documentos} (${n + 1} de ${lista.length})…`);
      try {
        const { json } = await pedirClaude({ tipo: "slide", informeId: informe.id, slideId: actual.id, modo: "dirigida", slide: actual });
        let s = actualizarPeriodo(slideDesdeClaude(json, actual.id, permitidos, informe)[0]!, informe);
        s.origen = "actualizada";
        let m = medirFuera(s, p.pagina, base.meta);
        if (m.error) throw new Error(m.error);
        if (m.desborde) {
          // Como en la generación: un ajuste si desborda, y se queda solo si lo arregla.
          setOcupado(`«${tituloDe(s)}» desborda: Claude la está ajustando (${n + 1} de ${lista.length})…`);
          try {
            const { json: j2 } = await pedirClaude({
              tipo: "ajuste",
              informeId: informe.id,
              slide: s,
              medida: { desborde: true, ocupacion: m.ocupacion, relleno: m.relleno },
            });
            const s2 = actualizarPeriodo(slideDesdeClaude(j2, actual.id, permitidos, informe)[0]!, informe);
            s2.origen = "actualizada";
            const m2 = medirFuera(s2, p.pagina, base.meta);
            if (!m2.error && !m2.desborde) {
              s = s2;
              m = m2;
            }
          } catch (e) {
            if (esCancelado(e)) throw e;
          }
        }
        // Lo que el equipo colocó a mano encima de la slide no lo rehace Claude: se queda.
        s = conFlotantesDe(actual, s);
        const c: InformeJson = clon(base);
        c.slides = c.slides.map((x) => (x.id === actual.id ? s : x));
        renumerar(c.slides);
        const marcada = marcarAplicadas(seleccion, [actual.id]);
        if (!(await h.guardar({ contenido: c, seleccion: marcada }, `${tituloDe(s)}: montada con ${documentos}`))) throw new Error("no se ha podido guardar");
        setAnteriores((prev) => ({ ...prev, [actual.id]: [...(prev[actual.id] ?? []).slice(-19), actual] }));
        base = c;
        seleccion = marcada;
        hechas++;
      } catch (e) {
        fallos.push(`${tituloDe(actual)}: ${e instanceof Error && !("code" in e) ? e.message : mensajeErrorClaude(e)}`);
        if (esCancelado(e)) break;
      }
    }
    setMontando(false);
    setOcupado(
      (hechas ? `${hechas} slide(s) montada(s) con la información dirigida. Revísalas: cada una tiene «Deshacer». ` : "") +
        (fallos.length ? `No se han podido montar: ${fallos.join(" · ")}` : ""),
    );
  }

  function mover(id: string, delta: number) {
    conSlides((sl) => {
      const vis = sl.filter((s) => !s.oculto);
      const j = vis.findIndex((s) => s.id === id);
      const otro = vis[j + delta];
      if (!otro) return;
      const a = sl.indexOf(vis[j]!);
      const b = sl.indexOf(otro);
      [sl[a], sl[b]] = [sl[b]!, sl[a]!];
    }, `Orden: ${tituloDe(slides.find((s) => s.id === id)!)} ${delta < 0 ? "sube" : "baja"}`);
    setTimeout(() => document.getElementById(`ed-${id}`)?.scrollIntoView({ block: "center" }), 50);
  }

  function alternarOculto(id: string) {
    const s = slides.find((x) => x.id === id)!;
    conSlides(
      (sl) => {
        const x = sl.find((y) => y.id === id)!;
        x.oculto = !x.oculto;
      },
      `${s.oculto ? "Visible" : "Oculta"}: ${tituloDe(s)}`,
    );
  }

  async function anadir() {
    const b = biblioteca.find((x) => x.n === bib);
    if (!b) return;
    const id = idNuevo(b, contenido!.slides);
    setOcupado(`Claude está redactando «${b.nombre}»…`);
    try {
      const { json } = await pedirClaude({ tipo: "slide", informeId: informe.id, slideId: id, modo: "nueva" });
      const s = actualizarPeriodo(validarSlide(json, id, componentesPermitidos()), informe);
      s.origen = "nueva";
      const m = medirFuera(s, 5, contenido!.meta);
      if (m.error) throw new Error(m.error);
      conSlides((sl) => ordenar([...sl, s]), `Añadida: ${b.nombre}`);
      setOcupado("");
      setTimeout(() => document.getElementById(`ed-${id}`)?.scrollIntoView({ block: "center" }), 300);
    } catch (e) {
      setOcupado(e instanceof Error && !("code" in e) ? `No se pudo añadir: ${e.message}` : mensajeErrorClaude(e));
    }
  }

  async function coherencia() {
    setOcupado("Claude está revisando la coherencia del informe…");
    try {
      const { json } = await pedirClaude({ tipo: "coherencia", informeId: informe.id, slides: contenido!.slides });
      const sl = contenido!.slides;
      const lista = resolverSlides(normalizarCoherencia(json).slice(0, 12), mapaNumeros(sl).porNumero, new Set(sl.map((s) => s.id)));
      await h.guardar({ qa: nuevaRevision(informe.qa, lista, new Date().toISOString()) });
      setOcupado(lista.length ? "" : "Sin incoherencias detectadas.");
    } catch (e) {
      setOcupado(mensajeErrorClaude(e));
    }
  }

  async function guardarVersion() {
    setOcupado(`Guardando la versión ${informe.version}…`);
    const r = await accionGuardarVersion(informe.id);
    if (!r.ok) {
      setOcupado(`No se pudo guardar la versión: ${r.error}`);
      return;
    }
    const c = clon(contenido!);
    c.meta.version = `v${r.data.version}`;
    // Solo en local: el servidor ya ha subido la versión.
    await h.guardar({ version: r.data.version, contenido: c });
    setOcupado(`Versión ${informe.version} guardada. Ahora trabajas en la versión ${r.data.version}.`);
  }

  async function aprobar() {
    if (informe.estado !== "aprobado") {
      if (!medidasCompletas) {
        setOcupado("Espera a que terminen de pintarse y medirse todas las slides.");
        return;
      }
      if (bloqueantes.length) {
        setOcupado(`Hay ${bloqueantes.length} bloqueante(s) en la revisión: resuélvelos antes de aprobar.`);
        return;
      }
      const c = clon(contenido!);
      c.meta.estado = "Aprobado";
      await h.guardar({ estado: "aprobado", contenido: c }, "Aprobado");
    } else {
      const c = clon(contenido!);
      c.meta.estado = "Borrador";
      await h.guardar({ estado: "borrador", contenido: c }, "Vuelve a borrador");
    }
    setOcupado("");
  }

  async function borrar() {
    const r = await accionBorrarInforme(informe.id);
    if (!r.ok) {
      h.avisar(`No se ha podido eliminar el informe: ${r.error}`, "error");
      setConfirmar(false);
      return;
    }
    router.push(rutaListaInformes());
  }

  /**
   * Descarga el PDF hecho en el servidor, con todo lo editado ya guardado. El
   * servidor vuelve a pasar el validador y anota la exportación.
   */
  async function descargarPdf(confirmado: boolean) {
    setPdf({ generando: true, error: null });
    try {
      await h.guardadoAlDia();
      const r = await fetch(rutaPdf(informe.id), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmado }),
      });
      if (!r.ok) {
        const cuerpo = (await r.json().catch(() => null)) as { error?: string } | null;
        throw new Error(cuerpo?.error ?? `el servidor ha respondido ${r.status}.`);
      }
      const nombre = /filename\*=UTF-8''([^;]+)/.exec(r.headers.get("Content-Disposition") ?? "")?.[1];
      const url = URL.createObjectURL(await r.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = nombre ? decodeURIComponent(nombre) : `${informe.id}.pdf`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      setPdf({ generando: false, error: null });
      setExportando(false);
      cargarExportaciones();
    } catch (e) {
      setPdf({ generando: false, error: e instanceof Error ? e.message : "error desconocido." });
    }
  }

  const irA = (id: string) => document.getElementById(`ed-${id}`)?.scrollIntoView({ behavior: "smooth" });

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">
            {informe.proyecto.nombre} · {informe.trimestre}
          </h1>
          <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-sm text-text-muted">
            Versión {informe.version} · <ChipEstado estado={informe.estado} /> · actualizado {fechaCorta(informe.actualizado)}
            {uso?.peticiones ? (
              <span>
                · Claude: {uso.peticiones} peticiones,{" "}
                {uso.costeUsd.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $
              </span>
            ) : null}
            {estadoGuardado ? <span>· {estadoGuardado}</span> : null}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {confirmar ? (
            <span className="inline-flex flex-wrap items-center gap-2 text-sm">
              ¿Eliminar este informe con sus fuentes, fotos y versiones? No se puede deshacer.
              <button type="button" onClick={() => void borrar()} className="rounded-md bg-red-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-700">
                Sí, eliminar
              </button>
              <Boton pequeno onClick={() => setConfirmar(false)}>
                Cancelar
              </Boton>
            </span>
          ) : (
            <>
              <Link href={rutaListaInformes()} className="text-sm font-medium text-icam-900 hover:underline">
                Volver a la lista
              </Link>
              {puedeEditar ? (
                <Boton variante="peligro" pequeno onClick={() => setConfirmar(true)}>
                  Eliminar informe
                </Boton>
              ) : null}
              <Link href={rutaImprimir(informe.id)} className="text-sm font-medium text-icam-900 hover:underline">
                Vista de impresión
              </Link>
              <Boton
                variante="primario"
                disabled={pdf.generando || !medidasCompletas}
                title={medidasCompletas ? "Descarga el informe en PDF, tal como se ve aquí, tras pasar el validador" : "Espera a que termine la revisión de las slides"}
                onClick={() => {
                  setPdf({ generando: false, error: null });
                  setExportando(true);
                }}
              >
                {pdf.generando ? "Generando PDF…" : "PDF"}
              </Boton>
            </>
          )}
        </div>
      </div>

      {pdf.error && !exportando ? (
        <Aviso tipo="error">
          No se ha podido generar el PDF: {pdf.error} Mientras tanto puedes sacarlo desde la «Vista de impresión».
        </Aviso>
      ) : null}
      {exportando ? (
        <DialogoExportar
          medio="pdf"
          incidencias={incidencias}
          ocupado={pdf.generando}
          error={pdf.error ? `No se ha podido generar el PDF: ${pdf.error}` : null}
          onCerrar={() => setExportando(false)}
          onExportar={(confirmado) => void descargarPdf(confirmado)}
        />
      ) : null}

      <Tarjeta>
        <h2 className="text-sm font-semibold text-text-primary">Revisión</h2>
        {!medidasCompletas ? (
          <p className="text-sm text-text-muted">Revisando…</p>
        ) : qa.length ? (
          <ul className="space-y-1 text-sm">
            {qa.map((x, i) => (
              <li key={i} className="flex flex-wrap items-center gap-1.5">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${x.nivel === "error" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-800"}`}
                >
                  {x.nivel === "error" ? "Bloqueante" : "Aviso"}
                </span>
                {x.slide} · {x.texto}
                {x.slide ? (
                  <Boton variante="texto" onClick={() => irA(x.slide)}>
                    Ir
                  </Boton>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-text-muted">Sin incidencias mecánicas: nada desborda, sin [pendiente] y los trimestres cuadran.</p>
        )}
        <PanelCoherencia
          qa={informe.qa}
          puedeEditar={puedeEditar}
          ocupado={revisando}
          etiqueta={etiqueta}
          existe={(id) => contenido.slides.some((s) => s.id === id)}
          irA={irA}
          guardarQa={(qa) => void h.guardar({ qa })}
          aplicar={aplicarAvisos}
        />
        {bloqueantes.length ? <p className="text-sm text-text-muted">Resuelve los bloqueantes antes de aprobar y exportar la versión final.</p> : null}
      </Tarjeta>

      {puedeEditar ? (
        <Tarjeta>
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex min-w-[220px] flex-1 flex-col gap-1.5 text-sm font-medium text-text-primary">
              Añadir slide de la biblioteca
              <select className={claseCampo} value={bib} onChange={(e) => setBib(Number(e.target.value))}>
                {biblioteca
                  .filter((b) => !NO_ANADIBLES.includes(b.id))
                  .map((b) => (
                    <option key={b.n} value={b.n}>
                      {b.n} · {b.nombre}
                    </option>
                  ))}
              </select>
            </label>
            <Boton onClick={() => void anadir()}>Añadir</Boton>
            <Boton
              title="Vuelve a «Información del trimestre» para aportar más documentos, también dirigidos a slides concretas"
              onClick={() => h.ir("paso2")}
            >
              Añadir información
            </Boton>
            <Boton onClick={() => void coherencia()}>Revisar coherencia</Boton>
            <Boton onClick={() => void guardarVersion()}>Guardar versión</Boton>
            <Boton variante={informe.estado === "aprobado" ? "secundario" : "primario"} onClick={() => void aprobar()}>
              {informe.estado === "aprobado" ? "Volver a borrador" : "Marcar como aprobado"}
            </Boton>
          </div>
          {ocupado ? (
            <p className="text-sm text-text-muted" aria-live="polite">
              {ocupado}
            </p>
          ) : null}
        </Tarjeta>
      ) : null}

      {puedeEditar ? (
        <Tarjeta>
          <h2 className="text-sm font-semibold text-text-primary">Instrucción al informe</h2>
          <p className="text-sm text-text-muted">
            Pide cualquier cambio citando las slides por su número: «slide 5: desdóblala en dos», «junta la 7 y la 8», «crea una slide de
            comercialización detrás de la 9», «en las slides 3 a 6 la entrega es en noviembre». Si no citas ninguna, Claude elige cuáles tocar.
          </p>
          <textarea
            className={`${claseCampo} min-h-[70px]`}
            value={instruccion}
            onChange={(e) => setInstruccion(e.target.value)}
            aria-label="Instrucción al informe"
            placeholder="Ej.: slide 6: sepárala en dos, una con licencia y otra con obra"
            disabled={revisando}
          />
          {instruccion.trim() ? (
            <p className="text-xs text-text-muted">
              {slidesCitadas(instruccion, contenido.slides).length
                ? `Afecta a: ${slidesCitadas(instruccion, contenido.slides).map(etiqueta).join(" · ")}`
                : "No cita ninguna slide por número: Claude decidirá cuáles tocar."}
            </p>
          ) : null}
          <ZonaSoltar acepta={ACEPTA_DOCUMENTOS} multiple pequena onFicheros={(f) => void adjuntarGlobal(f)} deshabilitado={revisando}>
            Adjuntar documentos o tablas para esta instrucción (PDF, Word, PowerPoint, Excel, CSV)
          </ZonaSoltar>
          {adjuntos.length ? (
            <div className="flex flex-wrap gap-1.5">
              {adjuntos.map((a, i) => (
                <span key={i} className="inline-flex items-center gap-1.5 rounded-full border border-subtle bg-page px-2 py-0.5 text-xs">
                  ▤ {a.nombre} <span className="text-text-muted">· {a.texto.length.toLocaleString("es-ES")} car.</span>
                  <button type="button" aria-label={`Quitar ${a.nombre}`} onClick={() => setAdjuntos((x) => x.filter((_, j) => j !== i))}>
                    ×
                  </button>
                </span>
              ))}
            </div>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <Boton variante="primario" disabled={revisando || !instruccion.trim()} onClick={() => void aplicarInstruccion()}>
              {revisando ? "Aplicando…" : "Aplicar instrucción"}
            </Boton>
            <span className="text-xs text-text-muted">Queda en el historial de revisiones, con «Deshacer».</span>
          </div>
        </Tarjeta>
      ) : null}

      {puedeEditar && pendientes.length ? (
        <Tarjeta>
          <h2 className="text-sm font-semibold text-text-primary">Información dirigida a slides, sin aplicar</h2>
          <ul className="space-y-1 text-sm">
            {pendientes.map((p) => (
              <li key={p.slide.id}>
                <b>
                  Slide {p.pagina} · {tituloDe(p.slide)}
                </b>
                <span className="text-text-muted"> ← {p.fuentes.map((f) => f.nombre).join(", ")}</span>{" "}
                <Boton variante="texto" onClick={() => irA(p.slide.id)}>
                  Ir
                </Boton>
              </li>
            ))}
          </ul>
          <p className="text-sm text-text-muted">
            Claude rehace cada una de esas slides por completo con su documento: elige la plantilla y copia las cifras tal cual, sin calcular
            ninguna. Es una petición por slide.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Boton variante="primario" disabled={montando} onClick={() => void montarDirigidas()}>
              {montando ? "Montando…" : `Montar ${pendientes.length === 1 ? "la slide" : `las ${pendientes.length} slides`} con Claude`}
            </Boton>
          </div>
        </Tarjeta>
      ) : null}

      {informe.estado === "aprobado" ? <Aviso tipo="ok">Informe aprobado. El PDF sale sin marcas de borrador.</Aviso> : null}

      <div className="flex flex-col gap-6">
        {visibles.map((s, i) => (
          <TarjetaSlide
            key={s.id}
            h={h}
            slide={s}
            pagina={i + 1}
            total={visibles.length}
            meta={meta!}
            medida={medidas[s.id]}
            onPintado={(r) => setMedidas((m) => ({ ...m, [s.id]: r }))}
            mover={(d) => mover(s.id, d)}
            ocultar={() => alternarOculto(s.id)}
            cambiar={(nueva, cambio, claude) => cambiarSlide(s.id, i + 1, nueva, cambio, false, undefined, claude)}
            revisar={revisar}
            integrar={(r, meta) => integrar(r, { ...meta, avisos: avisosDeClaude(meta.json, contenido.slides) })}
            duplicar={() => duplicar(s.id)}
            alternarCerrada={() => alternarCerrada(s.id)}
            siguiente={visibles[i + 1] ?? null}
            previa={h.previo?.slides.find((x) => x.id === s.id) ?? null}
            traer={traerAnterior(s.id, i + 1)}
            metaPrevia={h.previo?.meta ?? null}
            numeroDe={numeroDe}
            ocupadoGlobal={revisando}
            deshacer={anteriores[s.id]?.length ? () => deshacer(s.id, i + 1) : null}
            dirigida={pendientes.find((p) => p.slide.id === s.id)?.fuentes.map((f) => f.nombre) ?? null}
            montarDirigida={montando ? null : () => void montarDirigidas(s.id)}
          />
        ))}
      </div>

      {ocultas.length ? (
        <Tarjeta>
          <h2 className="text-sm font-semibold text-text-primary">Slides ocultas</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {ocultas.map((s) => (
              <li key={s.id}>
                {tituloDe(s)}{" "}
                {puedeEditar ? (
                  <Boton variante="texto" onClick={() => alternarOculto(s.id)}>
                    Mostrar
                  </Boton>
                ) : null}
              </li>
            ))}
          </ul>
        </Tarjeta>
      ) : null}

      <Tarjeta>
        <h2 className="text-sm font-semibold text-text-primary">Exportaciones</h2>
        {exportaciones === null ? (
          <p className="text-sm text-text-muted">Cargando…</p>
        ) : typeof exportaciones === "string" ? (
          <p className="text-sm text-red-700">No se ha podido leer el registro: {exportaciones}</p>
        ) : !exportaciones.length ? (
          <p className="text-sm text-text-muted">Nadie ha exportado todavía este informe.</p>
        ) : (
          <ul className="space-y-1.5 text-sm">
            {exportaciones.map((e) => (
              <li key={e.id} className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                <span className="text-text-muted">{fechaCorta(e.fecha)}</span>
                <b className="text-text-primary">{e.usuario}</b>
                <span className="text-text-muted">
                  · {e.medio === "pdf" ? "PDF descargado" : "impreso desde la vista de impresión"} · v{e.version} · {e.estado}
                </span>
                {e.incidencias.length ? (
                  <details className="basis-full">
                    <summary className={`cursor-pointer ${e.confirmado ? "text-amber-800" : "text-text-muted"}`}>
                      {e.confirmado ? "Marcó «Estoy seguro» con " : "Con "}
                      {resumenIncidencias(e.incidencias)}
                    </summary>
                    <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs text-text-muted">
                      {e.incidencias.map((x, i) => (
                        <li key={i}>
                          {x.nivel === "error" ? "Bloqueante" : "Aviso"}
                          {x.slide ? ` · ${x.slide}` : ""} · {x.texto}
                        </li>
                      ))}
                    </ul>
                  </details>
                ) : (
                  <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-800">sin incidencias</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Tarjeta>

      <PanelRevisiones revisiones={revisiones} puedeEditar={puedeEditar} ocupado={revisando} deshacer={(r) => void deshacerRev(r)} />

      {historial?.length ? (
        <details className="rounded-lg border border-subtle/50 bg-card p-4 shadow-sm">
          <summary className="cursor-pointer text-sm font-semibold text-text-primary">Historial de cambios</summary>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
            {historial.map((c) => (
              <li key={c.id}>
                <span className="text-text-muted">
                  {fechaCorta(c.fecha)}
                  {c.autor ? ` · ${c.autor}` : ""}
                </span>{" "}
                · {c.texto}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
