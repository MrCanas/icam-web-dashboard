import type { SlideJson } from "../slides/tipos";
import type { Analisis, Foto, Fuente, PrevioEstructurado } from "../types";
import { comentariosActivos } from "./analisis";
import { entradaDeId, type EntradaBiblioteca } from "./biblioteca";
import { bloqueCronograma, esSlideDeCronograma, hitosObligatorios } from "./cronograma";
import { fuentesParaSlide } from "./dirigidas";
import { flotantesValidos, sinFlotantes } from "./flotantes";
import { textos, tituloDe } from "./informe";
import { urlFoto } from "./paths";
import { qCierre } from "./trimestre";

/**
 * Prompts para Claude, montados en el servidor. Port de las funciones de
 * app-equipo/src/app.html (contexto, SALIDA, baseSlide, promptActualizar,
 * promptNueva, promptResumen, promptAjuste, promptCorreccion, análisis y
 * coherencia), con el texto de las reglas sin cambios.
 *
 * Cada prompt es una lista de bloques. Los de slide van en tres:
 *   1. estable del informe (rol, contexto, catálogo de layouts, API, reglas de
 *      redacción y de salida) → caché;
 *   2. material del trimestre (hechos, fotos y fuentes, recortadas a un tope
 *      fijo para que el bloque no cambie entre peticiones) → caché;
 *   3. la tarea concreta.
 * Así, las 20–30 peticiones de un informe leen de caché los bloques 1 y 2.
 *
 * «No reportar» (lo que el equipo pide dejar fuera) no es una fuente: va como
 * instrucción en el bloque de la tarea de cada petición, en el análisis y en la
 * revisión de coherencia, para que cambiarlo no invalide la caché.
 */

export interface BloquePrompt {
  texto: string;
  cachear: boolean;
}

export interface Referencias {
  /** layouts.md sin el ejemplo final: formato de informe.json y catálogo de layouts. */
  recetas: string;
  /** API de componentes (api-componentes.d.ts.txt). */
  api: string;
  /** redaccion.md. */
  reglas: string;
}

export interface ContextoInforme {
  proyecto: string;
  codigo: string;
  arquetipo: string;
  trimestre: string;
  trimestreAnterior: string;
  siguiente: string;
}

export interface MaterialInforme {
  informe: ContextoInforme;
  referencias: Referencias;
  biblioteca: EntradaBiblioteca[];
  /** Fuentes incluidas, en su orden (sin el texto del informe anterior). */
  fuentes: Fuente[];
  /** Fuentes dirigidas a slides concretas (fuente → slides): solo las ven las peticiones de esas slides. */
  dirigidas?: Record<string, string[]>;
  /** Texto extraído del informe anterior (PDF/PPTX), si no hay estructurado. */
  previoTexto: string | null;
  previo: PrevioEstructurado | null;
  fotos: Foto[];
  analisis: Analisis | null;
}

/** Tope de las fuentes del trimestre en cada petición (bytes UTF-8). */
export const MAX_BYTES_FUENTES = 60_000;
const MAX_BYTES_ESQUEMA_PREVIO = 22_000;
const MAX_BYTES_NO_REPORTAR = 6_000;
const MAX_BYTES_DIRIGIDA = 45_000;
const MAX_BYTES_PREVIO_NUEVA = 14_000;

const codificador = new TextEncoder();
export function bytes(s: string): number {
  return codificador.encode(s || "").length;
}

/** Recorta a `max` bytes UTF-8 sin partir caracteres. */
export function recortar(s: string, max: number): string {
  s = s || "";
  if (bytes(s) <= max) return s;
  let lo = 0;
  let hi = s.length;
  while (lo < hi) {
    const m = (lo + hi + 1) >> 1;
    if (bytes(s.slice(0, m)) <= max) lo = m;
    else hi = m - 1;
  }
  return s.slice(0, lo) + "\n[… recortado]";
}

export function contexto(d: ContextoInforme): string {
  return (
    `PROYECTO: ${d.proyecto} (${d.codigo}), tipo ${d.arquetipo || "?"}.\n` +
    `INFORME NUEVO: ${d.trimestre} (cierre ${qCierre(d.trimestre)}). Trimestre anterior: ${d.trimestreAnterior}. ` +
    `Los objetivos que fija el informe son para ${d.siguiente}.`
  );
}

/** Fuentes del trimestre: notas, luego las del portal (actas, planificación), luego lo aportado a mano. */
export function fuentesTexto(fuentes: Fuente[]): string {
  const incl = fuentes.filter((f) => f.incluida && f.tipo !== "previo" && f.tipo !== "no_reportar" && f.texto.trim());
  const notas = incl.filter((f) => f.tipo === "notas");
  const auto = incl.filter((f) => f.tipo !== "notas" && f.auto);
  const resto = incl.filter((f) => f.tipo !== "notas" && !f.auto);
  let out = "";
  for (const f of notas) out += `### NOTAS DEL EQUIPO\n${f.texto}\n\n`;
  for (const f of [...auto, ...resto]) out += `### DOCUMENTO: ${f.nombre}\n${f.texto}\n\n`;
  return out || "(sin notas)";
}

/** Lo que el equipo ha pedido dejar fuera del informe aunque esté en la información aportada. */
export function noReportarTexto(fuentes: Fuente[]): string {
  return fuentes
    .filter((f) => f.tipo === "no_reportar" && f.incluida)
    .map((f) => f.texto.trim())
    .filter(Boolean)
    .join("\n");
}

/** Instrucción de «No reportar» para las peticiones que redactan; null si el equipo no ha indicado nada. */
export function bloqueNoReportar(fuentes: Fuente[]): string | null {
  const t = noReportarTexto(fuentes);
  if (!t) return null;
  return (
    "== NO REPORTAR ==\n" +
    "El equipo ha indicado que lo siguiente NO puede aparecer en el informe para inversores. Prevalece sobre las fuentes, los hechos del trimestre y el informe anterior:\n" +
    recortar(t, MAX_BYTES_NO_REPORTAR) +
    "\nNo lo menciones ni lo insinúes, tampoco con otras palabras ni como dato suelto (nombres, importes, fechas). Si el informe anterior lo contaba, quítalo. " +
    'No pongas "[pendiente: …]" en su lugar ni digas que se ha omitido algo: redacta con el resto de la información.'
  );
}

/** Fuentes generales del trimestre: todas menos las dirigidas a slides concretas. */
export function fuentesGenerales(m: Pick<MaterialInforme, "fuentes" | "dirigidas">): Fuente[] {
  const d = m.dirigidas ?? {};
  return m.fuentes.filter((f) => !d[String(f.id)]?.length);
}

/** Información que el equipo ha dirigido a un slide; null si no hay ninguna. */
export function bloqueDirigido(m: Pick<MaterialInforme, "fuentes" | "dirigidas">, slideId: string): string | null {
  const d = m.dirigidas ?? {};
  const suyas = fuentesParaSlide(d, m.fuentes, slideId);
  if (!suyas.length) return null;
  const docs = suyas
    .map((f) => {
      const otros = (d[String(f.id)] ?? []).filter((s) => s !== slideId);
      return `### DOCUMENTO: ${f.nombre}${otros.length ? ` (va también a los slides: ${otros.join(", ")})` : ""}\n${f.texto}`;
    })
    .join("\n\n");
  return "== INFORMACIÓN DIRIGIDA A ESTE SLIDE ==\nEl equipo la ha aportado expresamente para este slide.\n" + recortar(docs, MAX_BYTES_DIRIGIDA);
}

const REGLAS_DIRIGIDA =
  "- Las cifras del documento son exactas: cópialas tal cual, con sus unidades, signos y decimales. No calcules, no redondees, no estimes ni completes ninguna; lo que no esté en el documento no se pone. " +
  "Para este slide no aplica la regla de no redactar cifras financieras: vienen del documento.\n" +
  "- Tu criterio se limita a la disposición y, si hace falta, a un texto breve que acompañe a los datos.\n" +
  "- Si el documento va también a otros slides, toma para este solo lo que corresponde a su tema, sin repetir lo de los demás.";

export function fotosTexto(fotos: Foto[]): string {
  const f = fotos.filter((x) => x.categoria !== "Página de Finanzas");
  if (!f.length) return "(no hay fotos nuevas)";
  return f
    .map(
      (x) =>
        `- src "${urlFoto(x.id)}" · ${x.categoria} · ${(x.ancho ?? 1) >= (x.alto ?? 0) ? "horizontal" : "vertical"}${x.pie ? " · " + x.pie : ""}`,
    )
    .join("\n");
}

export function hechosTexto(a: Analisis | null, trimestreAnterior: string): string {
  const h = (a?.hechos ?? [])
    .map(
      (x) =>
        `- [${x.tipo || ""}${x.modulo ? " · " + x.modulo : ""}] ${x.texto}${x.fecha ? ` (${x.fecha})` : ""}${x.fuente ? " — fuente: " + x.fuente : ""}`,
    )
    .join("\n");
  const o = (a?.objetivosPrevios ?? []).map((x) => `- ${x.objetivo} → ${x.estado}${x.evidencia ? ": " + x.evidencia : ""}`).join("\n");
  return (h || "(sin hechos)") + (o ? `\nOBJETIVOS DEL ${trimestreAnterior}:\n${o}` : "");
}

export function esquemaPrevio(m: Pick<MaterialInforme, "previo" | "previoTexto">): string {
  if (m.previo) {
    return (
      "ESTRUCTURA DEL INFORME ANTERIOR (id · título · extracto):\n" +
      m.previo.slides.map((s) => `- ${s.id}${s.oculto ? " (oculta)" : ""} · ${tituloDe(s)} · ${textos(s).slice(0, 260)}`).join("\n")
    );
  }
  if (m.previoTexto) return "TEXTO DEL INFORME ANTERIOR:\n" + recortar(m.previoTexto, MAX_BYTES_ESQUEMA_PREVIO);
  return "NO HAY INFORME ANTERIOR: es el primer informe del proyecto.";
}

export function bibliotecaTexto(bib: EntradaBiblioteca[]): string {
  return bib.map((b) => `${b.n} · ${b.nombre} · id ${b.id} · ${b.para} · sugerir: ${b.sugerir}`).join("\n");
}

function salida(d: ContextoInforme): string {
  return (
    "== REGLAS DE SALIDA ==\n" +
    '- Devuelve SOLO un objeto JSON: el slide completo, con el mismo "id", "origen" ("actualizada" o "nueva") y "fuentes" (de dónde sale cada dato, breve).\n' +
    "- Solo componentes del API (o div/span/p para agrupar), con sus props. Texto enriquecido solo con **negrita** para el dato clave.\n" +
    `- Periodo: todo campo "trimestre" = "${d.trimestre}" salvo dentro de "anterior"; "siguiente" = "${d.siguiente}". En AntecedentesNovedades, "anterior" (trimestre ${d.trimestreAnterior}) resume en ≤ 400 caracteres lo que el informe anterior contaba como Novedades; "actual" solo hechos del ${d.trimestre}.\n` +
    "- ESPACIO: el slide debe quedar lleno (85–95 % del área) al tamaño de letra actual, con información real: el texto vigente del informe anterior y las fuentes. Usa la capacidad orientativa del catálogo. Nunca relleno vacío.\n" +
    '- No inventes: si falta un dato imprescindible, escribe "[pendiente: qué falta]". No calcules ni redactes cifras financieras (TIR, ROE, NOI, varianzas).\n' +
    '- Fotos: solo las de la lista, con su src exacto ("/api/informes/fotos/…"). Si no hay fotos adecuadas, usa un layout sin fotos.\n' +
    '- Pon "seccion" con el número que corresponda (se renumera después). Títulos en tipo frase «Sección. Subtema».'
  );
}

/** Bloques 1 y 2 de las peticiones de slide. */
function baseSlide(m: MaterialInforme): BloquePrompt[] {
  const d = m.informe;
  return [
    {
      cachear: true,
      texto: [
        "Eres el redactor y maquetador de los informes trimestrales para inversores de Impar Capital.",
        contexto(d),
        "== FORMATO DE informe.json Y CATÁLOGO DE LAYOUTS ==\n" + m.referencias.recetas,
        "== API DE COMPONENTES ==\n" + m.referencias.api,
        "== REGLAS DE REDACCIÓN ==\n" + m.referencias.reglas,
        salida(d),
      ].join("\n\n"),
    },
    {
      cachear: true,
      texto: [
        "== HECHOS DEL TRIMESTRE ==\n" + hechosTexto(m.analisis, d.trimestreAnterior),
        "== FOTOS DISPONIBLES ==\n" + fotosTexto(m.fotos),
        "== FUENTES DEL TRIMESTRE ==\n" + recortar(fuentesTexto(fuentesGenerales(m)), MAX_BYTES_FUENTES),
      ].join("\n\n"),
    },
  ];
}

/**
 * El slide tal como lo ve Claude: sin las imágenes que el equipo ha colocado a
 * mano encima (`flotantes`), que no son suyas y se conservan aparte.
 */
function jsonDeSlide(slide: SlideJson): string {
  const n = flotantesValidos(slide.flotantes).length;
  return (
    JSON.stringify(sinFlotantes(slide)) +
    (n
      ? `
(Sobre este slide el equipo ha colocado a mano ${n} imagen(es) superpuesta(s) que no están en el JSON y se conservan solas: no las añadas ni intentes cambiarlas.)`
      : "")
  );
}

/**
 * Lo que el equipo ha dicho sobre un slide (o sobre todo el informe) en el
 * paso 3 y Claude todavía no ha atendido en una revisión del análisis.
 */
export function bloqueComentarios(m: Pick<MaterialInforme, "analisis">, slideId: string | null): string | null {
  const c = comentariosActivos(m.analisis).filter(([k]) => k === "general" || (slideId && k === `estructura.${slideId}`));
  if (!c.length) return null;
  return (
    "== INDICACIONES DEL EQUIPO ==\nTenlas en cuenta; prevalecen sobre la propuesta del análisis:\n" +
    c.map(([k, v]) => `- ${k === "general" ? "Para todo el informe" : "Para este slide"}: ${v.trim()}`).join("\n")
  );
}

/** Hitos que el slide tiene que conservar, si es el del cronograma. */
function cronogramaDe(m: MaterialInforme, slideId: string, slide?: SlideJson | null): string | null {
  const obligatorios = hitosObligatorios(m.analisis, m.previo);
  if (!esSlideDeCronograma(slideId, obligatorios, slide)) return null;
  const propios = obligatorios.filter((h) => !h.slide || h.slide === slideId);
  return bloqueCronograma(propios.length ? propios : obligatorios);
}

/** Cabecera de un slide en los prompts que ven varios: «### Slide 5 · calendario · Calendario. Q3 2026». */
export function cabeceraSlide(n: number | null, s: SlideJson): string {
  return `### ${n ? `Slide ${n} · ` : "(oculta) · "}${s.id} · ${tituloDe(s)}${s.cerrada ? " · CERRADA (no se toca)" : ""}`;
}

function conTarea(
  m: MaterialInforme,
  tarea: string,
  extra: string[] = [],
  slideId: string | null = null,
  slide: SlideJson | null = null,
): BloquePrompt[] {
  return [
    ...baseSlide(m),
    {
      cachear: false,
      texto: [
        "== TAREA ==\n" + tarea,
        ...extra,
        slideId ? cronogramaDe(m, slideId, slide) : null,
        bloqueComentarios(m, slideId),
        bloqueNoReportar(m.fuentes),
        "Responde solo con el JSON pedido, siguiendo las reglas de salida.",
      ]
        .filter((x): x is string => !!x)
        .join("\n\n"),
    },
  ];
}

export function promptActualizar(m: MaterialInforme, prev: SlideJson): BloquePrompt[] {
  const d = m.informe;
  return conTarea(
    m,
    `Actualiza al ${d.trimestre} el slide "${prev.id}" del informe ${d.trimestreAnterior}. Conserva su layout salvo que el contenido pida otro. ` +
      "Mantén lo persistente que siga vigente (sin resumirlo de más) y sustituye lo propio del trimestre por lo nuevo.\n" +
      "SLIDE ANTERIOR:\n" +
      jsonDeSlide(prev),
    [],
    prev.id,
    prev,
  );
}

/**
 * Monta por completo un slide con la información que el equipo ha dirigido a
 * él (un informe financiero para las slides de finanzas). Claude elige layout
 * y componentes; las cifras se copian del documento, sin calcular nada.
 */
export function promptDirigida(m: MaterialInforme, slide: SlideJson, informacion: string): BloquePrompt[] {
  const t =
    `Rehaz por completo el slide "${slide.id}" («${tituloDe(slide)}») con la INFORMACIÓN DIRIGIDA A ESTE SLIDE. ` +
    'Monta el slide entero: elige en el catálogo el layout y los componentes que mejor presenten esa información (tablas, KPIs, gráficos o texto) y devuélvelo completo, con su mismo "id".\n' +
    REGLAS_DIRIGIDA +
    "\n- Si el slide actual es una página bloqueada (SlideBloqueado) o un hueco pendiente, sustitúyelo por un slide real hecho con los componentes del API." +
    "\n- Conserva del slide actual el título y lo que siga siendo válido y no contradiga al documento.\nSLIDE ACTUAL:\n" +
    jsonDeSlide(slide);
  return conTarea(m, t, [informacion], slide.id, slide);
}

export function promptNueva(m: MaterialInforme, id: string): BloquePrompt[] {
  const b = entradaDeId(m.biblioteca, id);
  let t = `Crea el slide "${id}"${b ? ` (biblioteca nº ${b.n}: ${b.nombre} — ${b.para})` : ""}. Usa la receta de ese id en el catálogo.`;
  if (m.previoTexto && !m.previo) {
    t += "\nTEXTO DEL INFORME ANTERIOR (usa lo que siga vigente para este slide):\n" + recortar(m.previoTexto, MAX_BYTES_PREVIO_NUEVA);
  }
  return conTarea(m, t, [], id);
}

export function promptResumen(m: MaterialInforme, slides: SlideJson[], prev: SlideJson | null): BloquePrompt[] {
  const d = m.informe;
  const otros = slides
    .filter((s) => !s.oculto && s.id !== "resumen-ejecutivo" && !["portada", "indice", "disclaimer", "cierre"].includes(s.id))
    .map((s) => `### ${s.id} · ${tituloDe(s)}\n${textos(s).slice(0, 1500)}`)
    .join("\n");
  const t =
    `Redacta el slide "resumen-ejecutivo" (componente ResumenEjecutivo, trimestre "${d.trimestre}") a partir del informe ya redactado. ` +
    "Jerarquía: fase actual; logros más materiales; retrasos e incidencias con su mitigación; avance hacia el siguiente hito; operador, comercialización o desinversión; próximas fechas. " +
    `Situación actual 650–900 caracteres. Logros: 6 (máximo 9), hechos concretos y fechados del ${d.trimestre}. Coherente al dígito con los demás slides.` +
    (prev ? "\nRESUMEN EJECUTIVO ANTERIOR (estructura y datos persistentes):\n" + jsonDeSlide(prev) : "") +
    "\nRESTO DEL INFORME YA REDACTADO:\n" +
    recortar(otros, 22_000);
  return conTarea(m, t);
}

export interface MedidaAjuste {
  desborde: boolean;
  ocupacion: number | null;
  relleno: number | null;
}

export function promptAjuste(m: MaterialInforme, slide: SlideJson, med: MedidaAjuste): BloquePrompt[] {
  const t = med.desborde
    ? `El slide "${slide.id}" DESBORDA: su contenido ocupa el ${med.ocupacion} % del área útil medida en el navegador. Acórtalo hasta ~90 % quitando lo menos relevante, sin cambiar estilos ni tamaños (o cambia a un layout más compacto).`
    : `El slide "${slide.id}" queda al ${med.relleno} % del área tras repartir huecos (objetivo ≥ 85 %). Amplíalo con información REAL de las fuentes o del texto vigente del informe anterior, o agranda las fotos (disposición mayor). Si no hay más información real, devuélvelo sin cambios.`;
  return conTarea(m, t + "\nSLIDE ACTUAL:\n" + jsonDeSlide(slide), [], slide.id, slide);
}

export function promptCorreccion(
  m: MaterialInforme,
  slide: SlideJson,
  instruccion: string,
  extra: { marcas?: string; adjuntos?: string },
): BloquePrompt[] {
  const t =
    `Aplica esta corrección del equipo al slide "${slide.id}": «${instruccion}». Cambia solo lo pedido; mantén el resto igual. ` +
    "Si la instrucción incluye una tabla pegada (columnas separadas por tabuladores o |), úsala como datos. " +
    'Devuelve {"slide": <slide completo>, "avisos": [{"slide": "id de otro slide", "problema": "qué debería cambiar en él por coherencia"}], "hitosQuitados": ["título de cada hito del cronograma que quitas porque la instrucción lo pide"]}. ' +
    'Si la instrucción pide desdoblar, separar o partir el slide en dos (o más), devuelve en su lugar {"slides": [<primer slide, con el mismo id>, <segundo slide>, …], "avisos": […]}: reparte el contenido entre ellos sin perder nada y con títulos que los distingan.\nSLIDE ACTUAL:\n' +
    jsonDeSlide(slide);
  // El documento dirigido a este slide no está entre las fuentes generales: sin él no se podría corregir contra sus datos.
  const dirigida = bloqueDirigido(m, slide.id);
  return conTarea(
    m,
    t,
    [extra.marcas, recortar(extra.adjuntos ?? "", 24_000), dirigida ? dirigida + "\n" + REGLAS_DIRIGIDA : null].filter((x): x is string => !!x),
    slide.id,
    slide,
  );
}

export function promptAnalisis(m: MaterialInforme): BloquePrompt[] {
  const d = m.informe;
  const estructurado = !!m.previo;
  const noReportar = bloqueNoReportar(m.fuentes);
  // Con el informe anterior en PDF/PPTX el cronograma llega como texto suelto: Claude lo saca para poder conservarlo.
  const hitosDelTexto = !estructurado && !!m.previoTexto;
  return [
    {
      cachear: false,
      texto: [
        "Eres el asistente de reporting de Impar Capital. Analiza la información para preparar el informe trimestral para inversores. Devuelve SOLO un objeto JSON.",
        contexto(d),
        esquemaPrevio(m),
        "BIBLIOTECA DE SLIDES (nº · nombre · id · para qué · cuándo sugerirla):\n" + bibliotecaTexto(m.biblioteca),
        `FOTOS APORTADAS: ${m.fotos.length} (${m.fotos.map((f) => f.categoria).join(", ")})`,
        "FORMA DEL JSON:\n" +
          '{"resumen":["5 a 8 frases con lo esencial del trimestre"],' +
          '"objetivosPrevios":[{"objetivo":"…","estado":"cumplido|parcial|no cumplido|ya no aplica","evidencia":"…"}],' +
          '"hechos":[{"tipo":"logro|hito|kpi|riesgo|riesgo-resuelto|objetivo-siguiente|incidencia|decision|estado|colaborador","texto":"…","fecha":"…","modulo":"obra|licencia|operador|breeam|desinversion|financiacion|…","fuente":"…"}],' +
          '"estructura":[{"id":"…","titulo":"…","accion":"mantener|actualizar|ocultar|nueva","motivo":"…"}],' +
          '"sugeridas":[números de la biblioteca, máximo 3, que NO estén ya en la estructura],"faltan":["…"],"contradicciones":["…"]' +
          (hitosDelTexto ? ',"hitosPrevios":[{"titulo":"…","fecha":"MM/AA","hecho":true}]' : "") +
          (noReportar ? ',"omitidos":["…"]}' : "}"),
        "REGLAS:\n- No inventes nada: hechos, fechas y cifras solo de las fuentes o del informe anterior. Máximo 45 hechos, los más relevantes, con fecha si la hay.\n" +
          (estructurado
            ? '- "estructura" recorre TODAS las slides del informe anterior en su orden, con su mismo id. "mantener" solo para slides legales o sin información nueva que no citen el trimestre (disclaimer, cierre, colaboradores sin cambios); "actualizar" para las que deben reflejar el nuevo trimestre (portada, índice y financieras se tratan aparte, márcalas "actualizar"); "ocultar" si ya no aplican. Añade al final con "nueva" las slides que el material pida y no existan (id de la biblioteca).\n'
            : '- "estructura" propone el informe completo usando ids de la biblioteca en el orden canónico (portada, indice, resumen-ejecutivo, … , disclaimer, cierre), todas con "nueva" salvo disclaimer y cierre ("mantener").\n') +
          `- Evalúa cada objetivo que el informe anterior fijó para ${d.trimestre}.\n- "faltan": datos necesarios que no están en las fuentes. "contradicciones": datos que no cuadran entre fuentes.` +
          (hitosDelTexto
            ? '\n- "hitosPrevios": TODOS los hitos del cronograma (calendario, timeline o hitos del proyecto) del informe anterior, en su orden, con el título exacto, la fecha en MM/AA y "hecho" según el informe anterior. [] si no tenía cronograma.'
            : "") +
          (noReportar
            ? '\n- Lo indicado en NO REPORTAR no entra en "resumen", "hechos" ni en la evidencia de los objetivos, no justifica slides nuevas y no se pide en "faltan".' +
              '\n- "omitidos": lo que has dejado fuera por NO REPORTAR, una frase por cada cosa: qué era y en qué fuente o slide del informe anterior aparecía. Solo lo ve el equipo, para comprobar que has entendido cada indicación. [] si nada de lo aportado estaba afectado.'
            : ""),
        "== FUENTES DEL TRIMESTRE ==\n" + recortar(fuentesTexto(fuentesGenerales(m)), MAX_BYTES_FUENTES),
        noReportar,
      ]
        .filter((x): x is string => !!x)
        .join("\n\n"),
    },
  ];
}

export function promptCoherencia(d: ContextoInforme, slides: SlideJson[], fuentes: Fuente[] = []): BloquePrompt[] {
  const noReportar = noReportarTexto(fuentes);
  const cuerpo = slides
    .filter((s) => !s.oculto)
    .map((s, i) => `${cabeceraSlide(i + 1, s)}\n${textos(s).slice(0, 2200)}`)
    .join("\n");
  return [
    {
      cachear: false,
      texto: [
        "Revisa la coherencia de este informe trimestral para inversores. Busca: el mismo dato (fechas, %, importes, nombres de operador, constructora o financiador) con valores distintos entre slides; referencias al trimestre equivocado; previsiones presentadas como hechos; frases del trimestre anterior que no se hayan actualizado. No propongas cambios de estilo.",
        contexto(d),
        noReportar
          ? "NO REPORTAR. El equipo pidió que esto no apareciera en el informe:\n" +
            recortar(noReportar, MAX_BYTES_NO_REPORTAR) +
            "\nComprueba también que ningún slide lo menciona ni lo insinúa. Cada aparición es un problema («Contenido que el equipo pidió no reportar: …»), con la sugerencia de quitarlo, y va antes que los demás."
          : null,
        'Devuelve SOLO un array JSON: [{"slide":"id del slide (el id, no su número)","slides":["ids de otros slides implicados, si los hay"],"problema":"…","sugerencia":"…"}] (máximo 12; [] si no hay problemas). En "slide" y "slides" van ids; en "problema" y "sugerencia" cita los slides por su número («Slide 5»).',
        recortar(cuerpo, 52_000),
      ]
        .filter((x): x is string => !!x)
        .join("\n\n"),
    },
  ];
}

/**
 * Nueva ronda del análisis: Claude parte del análisis actual tal como lo ha
 * dejado el equipo (lo editado a mano es definitivo), atiende sus comentarios y
 * la información aportada desde la ronda anterior, y devuelve el análisis
 * entero con lo que ha hecho con cada comentario.
 */
export function promptRevisionAnalisis(m: MaterialInforme, nuevas: Fuente[]): BloquePrompt[] {
  const d = m.informe;
  const a = m.analisis;
  const noReportar = bloqueNoReportar(m.fuentes);
  const actual: Partial<Analisis> = { ...(a ?? {}) };
  const editados = actual.editados ?? [];
  delete actual.comentarios;
  delete actual.respuestas;
  delete actual.editados;
  const comentarios = comentariosActivos(a);
  return [
    {
      cachear: false,
      texto: [
        "Eres el asistente de reporting de Impar Capital. Ya analizaste la información del trimestre y el equipo ha revisado tu análisis. Haz una nueva ronda. Devuelve SOLO un objeto JSON.",
        contexto(d),
        esquemaPrevio(m),
        "BIBLIOTECA DE SLIDES (nº · nombre · id · para qué · cuándo sugerirla):\n" + bibliotecaTexto(m.biblioteca),
        "== ANÁLISIS ACTUAL (con las ediciones del equipo) ==\n" + JSON.stringify(actual),
        editados.length
          ? "== EDITADO A MANO POR EL EQUIPO ==\nEstos elementos los ha escrito o corregido el equipo: consérvalos literalmente (mismo texto, misma posición) salvo que un comentario pida cambiarlos. Si la información nueva los contradice, no los cambies: dilo en \"contradicciones\".\n" +
            editados.map((k) => `- ${k}`).join("\n")
          : null,
        comentarios.length
          ? "== COMENTARIOS DEL EQUIPO ==\nCada uno va sobre un elemento (clave: lista.posición, estructura.<id de slide>, o general). Atiéndelos todos.\n" +
            comentarios.map(([k, v]) => `- [${k}] ${v.trim()}`).join("\n")
          : null,
        nuevas.length
          ? "== INFORMACIÓN NUEVA DESDE LA RONDA ANTERIOR ==\n" +
            nuevas.map((f) => `- ${f.tipo === "notas" ? "Notas del equipo (actualizadas)" : f.nombre}`).join("\n") +
            "\nIncorpórala: añade hechos, actualiza el resumen, los objetivos y la estructura (o propón slides nuevas) si lo justifica."
          : null,
        "FORMA DEL JSON: la misma del ANÁLISIS ACTUAL, completa (todas sus claves, también las que no cambian), más " +
          '"respuestas":[{"clave":"la clave del comentario","respuesta":"qué has hecho, en una frase"}] con una entrada por comentario.',
        "REGLAS:\n- No inventes nada: hechos, fechas y cifras solo de las fuentes, del informe anterior o de lo que diga el equipo.\n" +
          '- "estructura": mantén el orden y los ids; cambia la acción o añade slides solo si un comentario o la información nueva lo piden.\n' +
          '- "hitosPrevios" (si existe): es el cronograma que se conserva. Solo cambia si un comentario lo pide.\n' +
          "- Si un comentario no se puede atender (falta información, contradice las fuentes), dilo en su respuesta.",
        "== FUENTES DEL TRIMESTRE ==\n" + recortar(fuentesTexto(fuentesGenerales(m)), MAX_BYTES_FUENTES),
        noReportar,
      ]
        .filter((x): x is string => !!x)
        .join("\n\n"),
    },
  ];
}

/** Tope del JSON de slides completas en una revisión del informe. */
const MAX_BYTES_SLIDES_REVISION = 70_000;

export interface PeticionRevisionInforme {
  instruccion: string;
  slides: SlideJson[];
  /** Slides que la instrucción nombra (por número o desde un botón); vacío = Claude decide. */
  ambito: string[];
  adjuntos?: string;
}

/**
 * Revisión del informe con una instrucción del equipo que puede tocar varias
 * slides: modificar, desdoblar una en varias, fusionar, crear o quitar. Claude
 * ve el índice numerado de todo el informe y el JSON de las slides en juego.
 */
export function promptRevisionInforme(m: MaterialInforme, p: PeticionRevisionInforme): BloquePrompt[] {
  const visibles = p.slides.filter((s) => !s.oculto);
  const numero = new Map(visibles.map((s, i) => [s.id, i + 1]));
  const indice = p.slides.map((s) => `${cabeceraSlide(numero.get(s.id) ?? null, s)}\n${textos(s).slice(0, 400)}`).join("\n");
  // Las slides en juego van completas; sin ámbito, todas las que quepan (las cerradas no hacen falta).
  const enJuego = (p.ambito.length ? p.ambito.map((id) => p.slides.find((s) => s.id === id)) : visibles).filter(
    (s): s is SlideJson => !!s && !s.cerrada,
  );
  let completas = "";
  const incluidas: string[] = [];
  for (const s of enJuego) {
    const bloque = `${cabeceraSlide(numero.get(s.id) ?? null, s)}\n${jsonDeSlide(s)}\n`;
    if (bytes(completas + bloque) > MAX_BYTES_SLIDES_REVISION) break;
    completas += bloque;
    incluidas.push(s.id);
  }
  const obligatorios = hitosObligatorios(m.analisis, m.previo);
  const cronograma = incluidas.some((id) => esSlideDeCronograma(id, obligatorios, p.slides.find((s) => s.id === id)))
    ? bloqueCronograma(obligatorios)
    : null;
  const t =
    `Aplica esta instrucción del equipo al informe: «${p.instruccion}».\n` +
    "Los slides se citan por su número visible («Slide 5», «la 7 y la 8»): usa el ÍNDICE para saber cuál es cada uno. Cambia solo lo pedido; el resto queda igual.\n" +
    "Operaciones posibles:\n" +
    "- Modificar un slide: un reemplazo con un solo slide, con su mismo id.\n" +
    "- Desdoblar, separar o partir un slide en dos o más: un reemplazo con varios slides; el primero conserva el id; reparte el contenido sin perder nada y con títulos que los distingan.\n" +
    '- Juntar, fusionar o unir slides: un reemplazo del primero con un único slide que reúna lo esencial de todos, y los demás en "eliminar".\n' +
    '- Crear un slide nuevo: en "nuevas", con "despuesDe" (id del slide tras el que va) y el slide completo (id nuevo, del estilo de la biblioteca).\n' +
    "- Nunca toques slides marcados CERRADA, ni portada, índice, disclaimer o cierre salvo que la instrucción los nombre.\n" +
    `- Solo puedes reemplazar o eliminar slides de la lista SLIDES COMPLETOS (${incluidas.length ? incluidas.join(", ") : "ninguno"}).\n` +
    "Devuelve SOLO este JSON:\n" +
    '{"reemplazos":[{"id":"…","slides":[<slide completo>, …]}],"eliminar":["id"],"nuevas":[{"despuesDe":"id","slide":<slide completo>}],' +
    '"hitosQuitados":["título de cada hito del cronograma que quitas porque la instrucción lo pide"],' +
    '"avisos":[{"slide":"id (no el número)","problema":"otro cambio que haría falta por coherencia y no has hecho"}],' +
    '"resumen":"qué has cambiado, en una o dos frases, citando los slides por su número"}\n' +
    "Cada slide sigue las reglas de salida (componentes del API, periodo, sin inventar).";
  return conTarea(
    m,
    t,
    [
      "== ÍNDICE DEL INFORME (número visible · id · título · extracto) ==\n" + indice,
      "== SLIDES COMPLETOS ==\n" + (completas || "(ninguno)"),
      p.adjuntos ? recortar(p.adjuntos, 24_000) : "",
      cronograma ?? "",
    ].filter(Boolean),
  );
}

/** Tamaño total de un prompt (bytes). */
export function tamano(bloques: BloquePrompt[]): number {
  return bloques.reduce((s, b) => s + bytes(b.texto), 0);
}
