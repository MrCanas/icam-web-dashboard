import type { SlideJson } from "../slides/tipos";
import type { Analisis, Foto, Fuente, PrevioEstructurado } from "../types";
import { entradaDeId, type EntradaBiblioteca } from "./biblioteca";
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

function conTarea(m: MaterialInforme, tarea: string, extra: string[] = []): BloquePrompt[] {
  return [
    ...baseSlide(m),
    {
      cachear: false,
      texto: [
        "== TAREA ==\n" + tarea,
        ...extra,
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
  return conTarea(m, t, [informacion]);
}

export function promptNueva(m: MaterialInforme, id: string): BloquePrompt[] {
  const b = entradaDeId(m.biblioteca, id);
  let t = `Crea el slide "${id}"${b ? ` (biblioteca nº ${b.n}: ${b.nombre} — ${b.para})` : ""}. Usa la receta de ese id en el catálogo.`;
  if (m.previoTexto && !m.previo) {
    t += "\nTEXTO DEL INFORME ANTERIOR (usa lo que siga vigente para este slide):\n" + recortar(m.previoTexto, MAX_BYTES_PREVIO_NUEVA);
  }
  return conTarea(m, t);
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
  return conTarea(m, t + "\nSLIDE ACTUAL:\n" + jsonDeSlide(slide));
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
    'Devuelve {"slide": <slide completo>, "avisos": ["otros slides que también deberían cambiar por coherencia, con su id", …]}.\nSLIDE ACTUAL:\n' +
    jsonDeSlide(slide);
  // El documento dirigido a este slide no está entre las fuentes generales: sin él no se podría corregir contra sus datos.
  const dirigida = bloqueDirigido(m, slide.id);
  return conTarea(
    m,
    t,
    [extra.marcas, recortar(extra.adjuntos ?? "", 24_000), dirigida ? dirigida + "\n" + REGLAS_DIRIGIDA : null].filter((x): x is string => !!x),
  );
}

export function promptAnalisis(m: MaterialInforme): BloquePrompt[] {
  const d = m.informe;
  const estructurado = !!m.previo;
  const noReportar = bloqueNoReportar(m.fuentes);
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
          (noReportar ? ',"omitidos":["…"]}' : "}"),
        "REGLAS:\n- No inventes nada: hechos, fechas y cifras solo de las fuentes o del informe anterior. Máximo 45 hechos, los más relevantes, con fecha si la hay.\n" +
          (estructurado
            ? '- "estructura" recorre TODAS las slides del informe anterior en su orden, con su mismo id. "mantener" solo para slides legales o sin información nueva que no citen el trimestre (disclaimer, cierre, colaboradores sin cambios); "actualizar" para las que deben reflejar el nuevo trimestre (portada, índice y financieras se tratan aparte, márcalas "actualizar"); "ocultar" si ya no aplican. Añade al final con "nueva" las slides que el material pida y no existan (id de la biblioteca).\n'
            : '- "estructura" propone el informe completo usando ids de la biblioteca en el orden canónico (portada, indice, resumen-ejecutivo, … , disclaimer, cierre), todas con "nueva" salvo disclaimer y cierre ("mantener").\n') +
          `- Evalúa cada objetivo que el informe anterior fijó para ${d.trimestre}.\n- "faltan": datos necesarios que no están en las fuentes. "contradicciones": datos que no cuadran entre fuentes.` +
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
    .map((s) => `### ${s.id} · ${tituloDe(s)}\n${textos(s).slice(0, 2200)}`)
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
        'Devuelve SOLO un array JSON: [{"slide":"id","problema":"…","sugerencia":"…"}] (máximo 12; [] si no hay problemas).',
        recortar(cuerpo, 52_000),
      ]
        .filter((x): x is string => !!x)
        .join("\n\n"),
    },
  ];
}

/** Tamaño total de un prompt (bytes). */
export function tamano(bloques: BloquePrompt[]): number {
  return bloques.reduce((s, b) => s + bytes(b.texto), 0);
}
