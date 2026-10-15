import type { NodoJson, SlideJson } from "../slides/tipos";
import { conFlotantesDe, flotantesValidos } from "./flotantes";
import { actualizarPeriodo, clon, nodosDe, recorrer, validarSlide, type PeriodoInforme } from "./informe";

/**
 * Estructura fija del informe trimestral (sacada del informe real de
 * Costanilla Q2 2026). Estas slides salen siempre, en este orden y con los
 * mismos bloques cada trimestre: solo cambia el texto.
 *
 * Claude no devuelve la slide: rellena sus «huecos» y aquí se monta siempre el
 * mismo esqueleto (`montar`). `extraer` hace lo contrario (lee los huecos de
 * una slide ya montada, o de las formas de informes anteriores) para traerla
 * del trimestre anterior o pedir un ajuste.
 *
 * Los bloques montados llevan la clave `hueco` (el motor la ignora al pintar):
 * así se encuentran aunque el equipo los haya movido o editado.
 */

export type Huecos = Record<string, unknown>;

export interface DefHueco {
  clave: string;
  tipo: "parrafos" | "vinetas" | "texto" | "imagenes" | "hitos" | "filas" | "objeto";
  guia: string;
  /** Sin él no sale «Pendiente» (p. ej. imágenes o notas). */
  opcional?: boolean;
}

export interface CtxFija extends PeriodoInforme {
  /** Solo CM/PM: forzar dos slides (lo pide la generación si en una desborda). */
  dividir?: boolean;
}

export interface SlideFija {
  id: string;
  /** Posición dentro de su sección (las demás slides de la sección van en 50). */
  orden: number;
  titulo: string;
  modo: "determinista" | "finanzas" | "claude";
  /** Ids de informes anteriores que alimentan esta slide. */
  alias?: string[];
  huecos?: DefHueco[];
  montar?(h: Huecos, ctx: CtxFija): SlideJson[];
  /** Huecos de una slide (y de su grupo, para CM/PM); null si no se reconoce su forma. */
  extraer?(s: SlideJson, grupo?: SlideJson[]): Huecos | null;
  /** Cómo se hereda al trimestre siguiente (p. ej. las Novedades pasan a Antecedentes). */
  heredar?(h: Huecos): Huecos;
}

export const PENDIENTE_FIJO = "Pendiente de información este trimestre.";

/* ---------- Bloques ---------- */

/** Bloque «Pendiente»; con etiqueta cuando no lo precede un subtítulo que diga qué falta. */
const pendiente = (etiqueta?: string): NodoJson => ({
  c: "div",
  props: { className: "iq-pendiente-fijo" },
  hijos: etiqueta ? [{ c: "strong", hijos: [`${etiqueta}: `] }, PENDIENTE_FIJO] : [PENDIENTE_FIJO],
});
const sub = (t: string, nivel?: 2): NodoJson => (nivel ? { c: "Subtitulo", props: { nivel }, hijos: [t] } : { c: "Subtitulo", hijos: [t] });
const texto = (parrafos: string[], hueco: string): NodoJson =>
  parrafos.length ? { c: "Texto", hueco, props: { parrafos } } : { ...(pendiente() as object), hueco };
const conTexto = (l: string[]) => (l.length ? l : [PENDIENTE_FIJO]);

function lista(v: unknown): string[] {
  if (typeof v === "string") return v.trim() ? [v.trim()] : [];
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string" && !!x.trim() && x.trim() !== PENDIENTE_FIJO).map((x) => x.trim());
}
const cadena = (v: unknown) => (typeof v === "string" && v.trim() !== PENDIENTE_FIJO ? v.trim() : "");
const objetos = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x)) : []);
/** Solo rutas de foto que existen (las de la lista de fotos del informe o URLs completas). */
const srcValido = (v: unknown) => (typeof v === "string" && /^(\/api\/|https?:\/\/)/.test(v) ? v : undefined);

function imagenes(v: unknown): { src?: string; pie?: string }[] {
  return objetos(v)
    .map((o) => ({ src: srcValido(o.src), pie: cadena(o.pie) || undefined }))
    .filter((o) => o.src)
    .slice(0, 2);
}

function hitos(v: unknown): { titulo: string; fecha: string; hecho: boolean }[] {
  return objetos(v)
    .map((o) => ({ titulo: cadena(o.titulo), fecha: cadena(o.fecha), hecho: o.hecho === true }))
    .filter((o) => o.titulo);
}

/** Nodos de una slide con un hueco dado, en orden. */
function deHueco(s: unknown, clave: string): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  recorrer(s, (x) => {
    if (x && typeof x === "object" && !Array.isArray(x) && (x as { hueco?: unknown }).hueco === clave) out.push(x as Record<string, unknown>);
  });
  return out;
}

/** Párrafos y viñetas de los Texto/Vinetas que cuelgan de un nodo. */
function parrafosDe(n: unknown): string[] {
  const out: string[] = [];
  recorrer(n, (x) => {
    if (!x || typeof x !== "object" || Array.isArray(x)) return;
    const o = x as { c?: string; props?: Record<string, unknown> };
    if (o.c === "Texto") out.push(...lista(o.props?.parrafos));
    if (o.c === "Vinetas") out.push(...lista(o.props?.items));
  });
  return out;
}

const huecoParrafos = (s: SlideJson, clave: string) => deHueco(s, clave).flatMap(parrafosDe);
const tieneHuecos = (s: SlideJson) => JSON.stringify(s).includes('"hueco":');

function compuesta(id: string, titulo: string, contenido: NodoJson[], extra: Partial<NonNullable<SlideJson["compuesto"]>> = {}): SlideJson {
  return { id, compuesto: { layout: id, seccion: 1, titulo, ...extra, contenido } };
}

/* ---------- La estructura ---------- */

const CM_PM_UMBRAL = 2600;
const TITULO_CM_PM = "Situación de Proyecto. Construction & Project Management";
const NOTA_CM_PM = "Nota: Se dispone de la planificación actualizada en el portal del inversor";

/** Reparte unos párrafos en dos columnas de longitud parecida. */
function enDos(p: string[]): [string[], string[]] {
  const total = p.reduce((a, x) => a + x.length, 0);
  let acc = 0;
  let corte = p.length;
  for (let i = 0; i < p.length; i++) {
    if (acc >= total / 2) {
      corte = i;
      break;
    }
    acc += p[i]!.length;
  }
  if (p.length > 1 && corte >= p.length) corte = p.length - 1;
  return [p.slice(0, corte), p.slice(corte)];
}

function columnas(p: string[], hueco: string): NodoJson {
  const [a, b] = enDos(p);
  if (!p.length) return pendiente();
  return { c: "div", props: { className: "iq-cols" }, hijos: [texto(a, hueco), b.length ? texto(b, hueco) : { c: "div" }] };
}

export const ESTRUCTURA_FIJA: SlideFija[] = [
  { id: "portada", orden: 0, titulo: "Portada", modo: "determinista" },
  { id: "indice", orden: 0, titulo: "Índice", modo: "determinista" },
  {
    id: "resumen-ejecutivo",
    orden: 10,
    titulo: "Resumen ejecutivo del proyecto",
    modo: "claude",
    huecos: [
      { clave: "situacion", tipo: "parrafos", guia: "SITUACIÓN ACTUAL: fase y estado del proyecto, 650–900 caracteres en 1–3 párrafos." },
      { clave: "compraventa", tipo: "vinetas", guia: "COMPRAVENTA Y FINANCIACIÓN: 2–4 viñetas (importe de adquisición, crédito, estrategia de salida)." },
      { clave: "operacion", tipo: "vinetas", guia: "OPERACIÓN Y CRONOGRAMA: 2–5 viñetas (operador y contrato, licencia, inicio y fin de obra, entrega)." },
      { clave: "logros", tipo: "vinetas", guia: "LOGROS del trimestre: 6 (máximo 9) hechos concretos y fechados." },
    ],
    montar(h, ctx) {
      return [
        {
          id: "resumen-ejecutivo",
          c: "ResumenEjecutivo",
          props: {
            seccion: 1,
            trimestre: ctx.trimestre,
            izquierda: [
              { icono: "situacion-actual", titulo: "SITUACIÓN ACTUAL", parrafos: conTexto(lista(h.situacion)) },
              { icono: "compraventa-financiacion", titulo: "COMPRAVENTA Y FINANCIACIÓN", vinetas: conTexto(lista(h.compraventa)) },
              { icono: "operacion-cronograma", titulo: "OPERACIÓN Y CRONOGRAMA", vinetas: conTexto(lista(h.operacion)) },
            ],
            logros: conTexto(lista(h.logros)),
          },
        },
      ];
    },
    extraer(s) {
      if (s.c !== "ResumenEjecutivo") return null;
      const p = (s.props ?? {}) as { izquierda?: unknown; logros?: unknown };
      const izq = objetos(p.izquierda);
      const bloque = (icono: string, i: number) => izq.find((b) => b.icono === icono) ?? izq[i];
      const de = (b: Record<string, unknown> | undefined) => [...lista(b?.parrafos), ...lista(b?.vinetas)];
      return {
        situacion: de(bloque("situacion-actual", 0)),
        compraventa: de(bloque("compraventa-financiacion", 1)),
        operacion: de(bloque("operacion-cronograma", 2)),
        logros: lista(p.logros),
      };
    },
    heredar: (h) => ({ ...h, logros: [] }),
  },
  { id: "resumen-financiero", orden: 20, titulo: "Resumen ejecutivo financiero", modo: "finanzas" },
  { id: "varianzas", orden: 10, titulo: "Análisis de varianzas", modo: "finanzas" },
  {
    id: "estrategia-compraventa",
    orden: 10,
    titulo: "Resumen de proyecto. Estrategia, compraventa y financiación",
    modo: "claude",
    alias: ["estrategia", "compraventa-financiacion"],
    huecos: [
      { clave: "estrategia", tipo: "parrafos", guia: "ESTRATEGIA DE PROYECTO: en qué consiste el proyecto, programa y estrategia; ≤ 1.100 caracteres. Persistente: se hereda salvo cambio." },
      { clave: "compraventa", tipo: "parrafos", guia: "COMPRAVENTA DEL INMUEBLE Y FINANCIACIÓN: importe y forma de pago de la adquisición, préstamo y disposiciones; ≤ 700 caracteres." },
      { clave: "imagenes", tipo: "imagenes", opcional: true, guia: 'Hasta 2 fotos [{"src","pie"}] de la lista (fachada/render y plano o situación). [] si no hay.' },
    ],
    montar(h) {
      const im = imagenes(h.imagenes);
      const marcos = [
        { c: "ImagenMarco", props: { ...(im[0] ?? {}), ancho: 204, alto: 252, placeholder: "Imagen del proyecto" } },
        { c: "ImagenMarco", props: { ...(im[1] ?? {}), ancho: 122, alto: 130, placeholder: "Imagen" } },
      ];
      return [
        compuesta(
          "estrategia-compraventa",
          "Resumen de Proyecto. Estrategia, Compraventa y Financiación",
          [
            {
              c: "div",
              hijos: [
                sub("ESTRATEGIA DE PROYECTO"),
                texto(lista(h.estrategia), "estrategia"),
                { c: "div", props: { style: { marginTop: 12 } }, hijos: [sub("COMPRAVENTA DEL INMUEBLE Y FINANCIACIÓN"), texto(lista(h.compraventa), "compraventa")] },
              ],
            },
            { c: "div", hueco: "imagenes", props: { className: "iq-imagenes-col" }, hijos: marcos },
          ],
          { seccion: 3, clase: "iq-cols", estilo: { gridTemplateColumns: "1fr 210px", columnGap: 32 } },
        ),
      ];
    },
    extraer(s, grupo = []) {
      if (s.id === "estrategia-compraventa" && tieneHuecos(s)) {
        return {
          estrategia: huecoParrafos(s, "estrategia"),
          compraventa: huecoParrafos(s, "compraventa"),
          imagenes: nodosDe(deHueco(s, "imagenes") as NodoJson, "ImagenMarco")
            .map((n) => n.props as Record<string, unknown>)
            .filter((p) => srcValido(p?.src))
            .map((p) => ({ src: p.src, pie: p.pie })),
        };
      }
      // Informes anteriores: «estrategia» (texto + MapaLateral) y «compraventa-financiacion» (DosColumnas) por separado.
      const est = s.id === "estrategia" ? s : grupo.find((x) => x.id === "estrategia");
      const cv = s.id === "compraventa-financiacion" ? s : grupo.find((x) => x.id === "compraventa-financiacion");
      if (!est && !cv) return null;
      const fotos: { src: string; pie?: string }[] = [];
      if (est) {
        nodosDe(est, "ImagenMarco").forEach((n) => {
          const p = (n.props ?? {}) as Record<string, unknown>;
          if (srcValido(p.src)) fotos.push({ src: p.src as string, pie: cadena(p.pie) || undefined });
        });
        nodosDe(est, "MapaLateral").forEach((n) => {
          const p = (n.props ?? {}) as Record<string, unknown>;
          if (srcValido(p.foto)) fotos.push({ src: p.foto as string });
        });
      }
      return { estrategia: est ? parrafosDe(est) : [], compraventa: cv ? parrafosDe(cv) : [], imagenes: fotos.slice(0, 2) };
    },
  },
  {
    id: "calendario",
    orden: 20,
    titulo: "Resumen de proyecto. Calendario",
    modo: "claude",
    huecos: [
      { clave: "anterior", tipo: "parrafos", guia: "Antecedentes (trimestre anterior): resumen ≤ 400 caracteres de lo que el informe anterior contaba como Novedades." },
      { clave: "actual", tipo: "parrafos", guia: "Novedades del trimestre: solo hechos de este trimestre, 1.500–2.200 caracteres en párrafos." },
    ],
    montar(h, ctx) {
      return [
        compuesta(
          "calendario",
          "Resumen de Proyecto. Calendario",
          [
            {
              c: "AntecedentesNovedades",
              hueco: "calendario",
              props: {
                titulo: "CALENDARIO",
                anterior: { trimestre: ctx.trimestreAnterior, parrafos: conTexto(lista(h.anterior)) },
                actual: { trimestre: ctx.trimestre, parrafos: conTexto(lista(h.actual)) },
              },
            },
          ],
          { seccion: 3 },
        ),
      ];
    },
    extraer(s) {
      const an = nodosDe(s, "AntecedentesNovedades")[0];
      if (!an) return null;
      const p = (an.props ?? {}) as { anterior?: Record<string, unknown>; actual?: Record<string, unknown> };
      return { anterior: lista(p.anterior?.parrafos), actual: [...lista(p.actual?.parrafos), ...lista(p.actual?.vinetas)] };
    },
    heredar: (h) => ({ anterior: h.actual, actual: [] }),
  },
  {
    id: "calendario-timeline",
    orden: 30,
    titulo: "Resumen de proyecto. Calendario e hitos reseñables",
    modo: "claude",
    alias: ["calendario"],
    huecos: [
      { clave: "intro", tipo: "parrafos", guia: "Texto de CALENDARIO: plazo total del proyecto y cómo se lee el cronograma; 300–700 caracteres." },
      { clave: "hitos", tipo: "hitos", guia: 'Hitos reseñables del cronograma [{"titulo" ≤ 32,"fecha":"MM/AAAA","hecho":true|false}], 5–11, en orden.' },
    ],
    montar(h) {
      const hs = hitos(h.hitos);
      return [
        compuesta(
          "calendario-timeline",
          "Resumen de Proyecto. Calendario",
          [
            sub("CALENDARIO"),
            texto(lista(h.intro), "intro"),
            sub("Hitos Reseñables", 2),
            ...(hs.length ? [] : [pendiente()]),
            { c: "Timeline", hueco: "hitos", props: { hitos: hs, ancho: 840 } },
          ],
          { seccion: 3 },
        ),
      ];
    },
    extraer(s) {
      const t = nodosDe(s, "Timeline")[0];
      if (!t) return null;
      // En informes anteriores el «calendario» llevaba el Timeline debajo de Antecedentes/Novedades: de ahí solo el cronograma.
      const intro = s.id === "calendario-timeline" ? (tieneHuecos(s) ? huecoParrafos(s, "intro") : parrafosDe(s)) : [];
      return { intro, hitos: hitos((t.props as { hitos?: unknown } | undefined)?.hitos) };
    },
  },
  {
    id: "kpis-riesgos-objetivos",
    orden: 40,
    titulo: "KPIs, riesgos, mitigaciones y objetivos",
    modo: "claude",
    huecos: [
      { clave: "kpis", tipo: "filas", guia: 'INDICADORES CLAVE: [{"indicador","actual","objetivo"}], 3–8 filas (celdas ≤ 140/220 caracteres).' },
      { clave: "riesgos", tipo: "filas", guia: 'RIESGOS Y MITIGACIONES: [{"riesgo","mitigacion"}], 2–5 filas.' },
      { clave: "objetivos", tipo: "vinetas", guia: "OBJETIVOS del trimestre siguiente: 3–6 viñetas." },
    ],
    montar(h, ctx) {
      const kpis = objetos(h.kpis)
        .map((k) => ({ indicador: cadena(k.indicador), actual: cadena(k.actual), objetivo: cadena(k.objetivo) }))
        .filter((k) => k.indicador);
      const riesgos = objetos(h.riesgos)
        .map((r) => ({ riesgo: cadena(r.riesgo), mitigacion: cadena(r.mitigacion) }))
        .filter((r) => r.riesgo);
      return [
        {
          id: "kpis-riesgos-objetivos",
          c: "SlideKpisRiesgosObjetivos",
          props: {
            seccion: 3,
            trimestre: ctx.trimestre,
            siguiente: ctx.siguiente,
            kpis: kpis.length ? kpis : [{ indicador: PENDIENTE_FIJO, actual: "", objetivo: "" }],
            riesgos: riesgos.length ? riesgos : [{ riesgo: PENDIENTE_FIJO, mitigacion: "" }],
            objetivos: conTexto(lista(h.objetivos)),
          },
        },
      ];
    },
    extraer(s) {
      if (s.c !== "SlideKpisRiesgosObjetivos") return null;
      const p = (s.props ?? {}) as Record<string, unknown>;
      return {
        kpis: objetos(p.kpis).filter((k) => cadena(k.indicador)),
        riesgos: objetos(p.riesgos).filter((r) => cadena(r.riesgo)),
        objetivos: lista(p.objetivos),
      };
    },
    heredar: (h) => ({ ...h, objetivos: [] }),
  },
  {
    id: "situacion-cm-pm",
    orden: 10,
    titulo: "Situación de proyecto. Construction & project management",
    modo: "claude",
    huecos: [
      { clave: "cm", tipo: "parrafos", guia: "CONSTRUCTION MANAGEMENT: papel del CM, licitación y coordinación de la obra en el trimestre." },
      { clave: "pm", tipo: "parrafos", guia: "PROJECT MANAGEMENT: supervisión de Impar (plazos, costes, calidad), control de costes y planificación." },
      { clave: "nota", tipo: "texto", opcional: true, guia: `Nota al pie; por defecto «${NOTA_CM_PM}».` },
    ],
    montar(h, ctx) {
      const cm = lista(h.cm);
      const pm = lista(h.pm);
      const nota = cadena(h.nota) || NOTA_CM_PM;
      const largo = [...cm, ...pm].reduce((a, x) => a + x.length, 0);
      if (!(ctx.dividir ?? largo > CM_PM_UMBRAL)) {
        return [
          compuesta(
            "situacion-cm-pm",
            TITULO_CM_PM,
            [
              { c: "div", hijos: [sub("CONSTRUCTION MANAGEMENT"), texto(cm, "cm")] },
              { c: "div", hijos: [sub("PROJECT MANAGEMENT"), texto(pm, "pm")] },
            ],
            { seccion: 4, clase: "iq-cols", nota },
          ),
        ];
      }
      return [
        compuesta("situacion-cm-pm", TITULO_CM_PM, [sub("CONSTRUCTION MANAGEMENT"), columnas(cm, "cm")], { seccion: 4 }),
        compuesta("situacion-cm-pm-2", TITULO_CM_PM, [sub("PROJECT MANAGEMENT"), columnas(pm, "pm")], { seccion: 4, nota }),
      ];
    },
    extraer(s, grupo = []) {
      const todas = [s, ...grupo.filter((x) => x.id !== s.id && /^situacion-cm-pm/.test(x.id) && !x.oculto)];
      if (!todas.some(tieneHuecos)) return null;
      return {
        cm: todas.flatMap((x) => huecoParrafos(x, "cm")),
        pm: todas.flatMap((x) => huecoParrafos(x, "pm")),
        nota: todas.map((x) => x.compuesto?.nota).find((n) => typeof n === "string") ?? "",
      };
    },
  },
  {
    id: "sostenibilidad",
    orden: 80,
    titulo: "Situación de proyecto. Sostenibilidad (BREEAM)",
    modo: "claude",
    huecos: [
      { clave: "texto", tipo: "parrafos", guia: "SOSTENIBILIDAD Y ESTRATEGIA GLOBAL: enfoque de sostenibilidad y certificación; 900–1.400 caracteres." },
      { clave: "intro", tipo: "texto", opcional: true, guia: "Frase que introduce la puntuación objetivo y el avance." },
      { clave: "breeam", tipo: "objeto", guia: 'Calificación objetivo {"estrellas":n,"calificacion":"Muy Bueno","rango":"55-70%"} SOLO con datos del asesor; null si no hay.' },
      { clave: "consolidacion", tipo: "filas", opcional: true, guia: 'Puntuación consolidada [{"etiqueta","valor":n}] si el asesor la da; [] si no.' },
      { clave: "categorias", tipo: "filas", guia: 'Puntuación por categoría [{"nombre","objetivo":n,"avance":n}] del informe del asesor; [] si no hay.' },
    ],
    montar(h) {
      const b = h.breeam && typeof h.breeam === "object" && !Array.isArray(h.breeam) ? (h.breeam as Record<string, unknown>) : null;
      const estrellas = Number(b?.estrellas);
      const breeam = b && cadena(b.calificacion) && estrellas > 0 ? { estrellas, calificacion: cadena(b.calificacion), ...(cadena(b.rango) ? { rango: cadena(b.rango) } : {}) } : null;
      const seg = objetos(h.consolidacion)
        .map((x) => ({ etiqueta: cadena(x.etiqueta), valor: Number(x.valor) }))
        .filter((x) => x.etiqueta && Number.isFinite(x.valor));
      const cat = objetos(h.categorias)
        .map((x) => ({ nombre: cadena(x.nombre), objetivo: Number(x.objetivo), ...(Number.isFinite(Number(x.avance)) && x.avance != null ? { avance: Number(x.avance) } : {}) }))
        .filter((x) => x.nombre && Number.isFinite(x.objetivo));
      const intro = cadena(h.intro);
      return [
        compuesta(
          "sostenibilidad",
          "Situación de Proyecto. Sostenibilidad",
          [
            { c: "div", hijos: [sub("SOSTENIBILIDAD Y ESTRATEGIA GLOBAL"), texto(lista(h.texto), "texto")] },
            {
              c: "div",
              hijos: [
                ...(intro ? [{ c: "Texto", hueco: "intro", props: { parrafos: [intro] } }] : []),
                breeam ? { c: "BreeamRating", hueco: "breeam", props: breeam } : { ...(pendiente("Calificación BREEAM") as object), hueco: "breeam" },
                ...(seg.length ? [{ c: "BarraConsolidacion", hueco: "consolidacion", props: { segmentos: seg } }] : []),
                cat.length ? { c: "BarrasBreeam", hueco: "categorias", props: { categorias: cat } } : { ...(pendiente("Puntuación por categorías") as object), hueco: "categorias" },
              ],
            },
          ],
          { seccion: 4, clase: "iq-cols" },
        ),
      ];
    },
    extraer(s) {
      const rating = nodosDe(s, "BreeamRating")[0];
      const barras = nodosDe(s, "BarrasBreeam")[0];
      const cons = nodosDe(s, "BarraConsolidacion")[0];
      if (!tieneHuecos(s) && !rating && !barras) return null;
      const intro = deHueco(s, "intro").flatMap(parrafosDe)[0] ?? "";
      const textoSlide = tieneHuecos(s) ? huecoParrafos(s, "texto") : parrafosDe(s);
      return {
        texto: textoSlide,
        intro,
        breeam: rating?.props ?? null,
        consolidacion: (cons?.props as { segmentos?: unknown } | undefined)?.segmentos ?? [],
        categorias: (barras?.props as { categorias?: unknown } | undefined)?.categorias ?? [],
      };
    },
  },
  {
    id: "sostenibilidad-seguimiento",
    orden: 81,
    titulo: "Situación de proyecto. Cronograma BREEAM",
    modo: "claude",
    huecos: [
      { clave: "texto", tipo: "parrafos", guia: "SEGUIMIENTO Y CRONOGRAMA: reuniones, informes y fase de la certificación en el trimestre; 600–1.200 caracteres." },
      { clave: "hitos", tipo: "hitos", guia: 'Fases de la certificación BREEAM [{"titulo" ≤ 32,"fecha":"MM/AAAA","hecho":true|false}], 5–9, en orden.' },
      { clave: "nota", tipo: "texto", opcional: true, guia: "Nota al pie (p. ej. «Nota: Se dispone del informe de avance en el portal del inversor.»)." },
    ],
    montar(h) {
      const hs = hitos(h.hitos);
      const nota = cadena(h.nota);
      return [
        compuesta(
          "sostenibilidad-seguimiento",
          "Situación de Proyecto. Sostenibilidad",
          [
            sub("SEGUIMIENTO Y CRONOGRAMA"),
            texto(lista(h.texto), "texto"),
            ...(hs.length ? [] : [pendiente()]),
            { c: "Timeline", hueco: "hitos", props: { hitos: hs, ancho: 840, variante: "teal" } },
          ],
          { seccion: 4, ...(nota ? { nota } : {}) },
        ),
      ];
    },
    extraer(s) {
      const t = nodosDe(s, "Timeline")[0];
      if (!t && !tieneHuecos(s)) return null;
      return {
        texto: tieneHuecos(s) ? huecoParrafos(s, "texto") : parrafosDe(s),
        hitos: hitos((t?.props as { hitos?: unknown } | undefined)?.hitos),
        nota: s.compuesto?.nota ?? "",
      };
    },
  },
  {
    id: "colaboradores",
    orden: 10,
    titulo: "Colaboradores",
    modo: "claude",
    huecos: [
      { clave: "intro", tipo: "texto", guia: "Párrafo introductorio sobre el seguimiento de Impar Capital y sus colaboradores (≤ 300 caracteres)." },
      { clave: "roles", tipo: "filas", guia: 'Roles [{"rol":"ARQUITECTURA, INTERIORISMO Y CONSTRUCTION MANAGEMENT","parrafos":["… firma en **negrita** …"]}], 4–8, párrafo ≤ 300.' },
      { clave: "logos", tipo: "filas", opcional: true, guia: 'Logos [{"src"?,"nombre","pie"}] de las firmas, 4–7 (src solo de la lista de fotos).' },
    ],
    montar(h) {
      const roles = objetos(h.roles)
        .map((r) => ({ rol: cadena(r.rol), parrafos: lista(r.parrafos), ...(lista(r.vinetas).length ? { vinetas: lista(r.vinetas) } : {}) }))
        .filter((r) => r.rol);
      const logos = objetos(h.logos).map((l) => ({ ...(srcValido(l.src) ? { src: l.src as string } : {}), nombre: cadena(l.nombre), pie: cadena(l.pie) || undefined }));
      return [
        {
          id: "colaboradores",
          c: "Colaboradores",
          props: {
            seccion: 5,
            intro: cadena(h.intro) || PENDIENTE_FIJO,
            roles: roles.length ? roles : [{ rol: "COLABORADORES", parrafos: [PENDIENTE_FIJO] }],
            logos: logos.filter((l) => l.src || l.nombre),
          },
        },
      ];
    },
    extraer(s) {
      if (s.c !== "Colaboradores") return null;
      const p = (s.props ?? {}) as Record<string, unknown>;
      return { intro: cadena(p.intro), roles: objetos(p.roles), logos: objetos(p.logos) };
    },
  },
  {
    id: "vehiculo",
    orden: 10,
    titulo: "Vehículo de inversión",
    modo: "claude",
    huecos: [
      { clave: "detalles", tipo: "vinetas", guia: "DETALLES: viñetas con los datos del vehículo (constitución, notario, protocolo, registro, capital, administración…). Persistente." },
      {
        clave: "fichas",
        tipo: "objeto",
        guia: 'Valores de las 4 fichas {"aeat":"AL CORRIENTE","cda":"siguiente reunión del consejo, p. ej. Q4 2026","rm":"fecha de inscripción en el RM","informe":"mes del siguiente informe, p. ej. ENERO 2027"}.',
      },
    ],
    montar(h) {
      const f = (h.fichas && typeof h.fichas === "object" ? h.fichas : {}) as Record<string, unknown>;
      const v = (k: string) => cadena(f[k]) || "Pendiente";
      return [
        {
          id: "vehiculo",
          c: "VehiculoInversion",
          props: {
            seccion: 6,
            titulo: "Vehículo de Inversión. Detalles",
            detalles: conTexto(lista(h.detalles)),
            fichas: [
              { icono: "vehiculo-aeat", etiqueta: "AEAT", valor: v("aeat") },
              { icono: "vehiculo-obligacion-mercantil", etiqueta: "SIGUIENTE REUNIÓN CDA", valor: v("cda") },
              { icono: "vehiculo-inscripcion-rm", etiqueta: "INSCRIPCIÓN RM", valor: v("rm") },
              { icono: "vehiculo-siguiente-informe", etiqueta: "SIGUIENTE INFORME TRIMESTRAL", valor: v("informe") },
            ],
          },
        },
      ];
    },
    extraer(s) {
      if (s.c !== "VehiculoInversion") return null;
      const p = (s.props ?? {}) as Record<string, unknown>;
      const fichas = objetos(p.fichas);
      const de = (icono: string, i: number) => {
        const x = cadena((fichas.find((f) => f.icono === icono) ?? fichas[i])?.valor);
        return x === "Pendiente" ? "" : x;
      };
      return {
        detalles: lista(p.detalles),
        fichas: { aeat: de("vehiculo-aeat", 0), cda: de("vehiculo-obligacion-mercantil", 1), rm: de("vehiculo-inscripcion-rm", 2), informe: de("vehiculo-siguiente-informe", 3) },
      };
    },
  },
  { id: "disclaimer", orden: 0, titulo: "Disclaimer", modo: "determinista" },
  { id: "cierre", orden: 0, titulo: "Cierre", modo: "determinista" },
];

export const IDS_FIJOS = ESTRUCTURA_FIJA.map((d) => d.id);

/** Ids de informes anteriores sustituidos por una slide fija (siguen pintándose en los informes viejos). */
export const SUSTITUIDAS: Record<string, string> = { estrategia: "estrategia-compraventa", "compraventa-financiacion": "estrategia-compraventa" };

/** Definición fija de un id («situacion-cm-pm-2» es la segunda página de CM/PM). */
export function defFija(id: string): SlideFija | undefined {
  return ESTRUCTURA_FIJA.find((d) => d.id === (id === "situacion-cm-pm-2" ? "situacion-cm-pm" : id));
}

/** ¿La redacta Claude rellenando huecos? */
export function esFijaConHuecos(id: string): boolean {
  return defFija(id)?.modo === "claude";
}

/** Posición dentro de su sección: fijas en su sitio, las demás en 50 (las sustituidas, donde estaba su fija). */
export function subOrden(id: string): number {
  if (id === "situacion-cm-pm-2") return 11;
  if (id === "compraventa-financiacion") return 11;
  const d = defFija(SUSTITUIDAS[id] ?? id);
  return d ? d.orden : 50;
}

/** Slide a la que van los hitos de una slide que ya no lleva cronograma (el «calendario» viejo → «calendario-timeline»). */
export function destinoHitos(id: string | undefined): string | undefined {
  return id === "calendario" ? "calendario-timeline" : id;
}

/* ---------- Leer lo que devuelve Claude ---------- */

/** Huecos saneados: solo las claves de la definición, con su tipo. */
export function leerHuecos(def: SlideFija, raw: unknown): Huecos {
  const o = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const out: Huecos = {};
  for (const hd of def.huecos ?? []) {
    const v = o[hd.clave];
    if (hd.tipo === "parrafos" || hd.tipo === "vinetas") out[hd.clave] = lista(v);
    else if (hd.tipo === "texto") out[hd.clave] = Array.isArray(v) ? lista(v).join(" ") : cadena(v);
    else if (hd.tipo === "imagenes") out[hd.clave] = imagenes(v);
    else if (hd.tipo === "hitos") out[hd.clave] = hitos(v);
    else if (hd.tipo === "filas") out[hd.clave] = objetos(v);
    else out[hd.clave] = v && typeof v === "object" && !Array.isArray(v) ? v : null;
  }
  return out;
}

export function huecosVacios(def: SlideFija): Huecos {
  return leerHuecos(def, {});
}

/** Huecos de una slide fija en el informe anterior (por su id o por sus alias). null si no estaba. */
export function huecosDelAnterior(def: SlideFija, previo: SlideJson[]): Huecos | null {
  if (!def.extraer) return null;
  const visibles = previo.filter((s) => !s.oculto);
  const propia = visibles.find((s) => s.id === def.id);
  const h = propia ? def.extraer(propia, visibles) : null;
  if (h) return leerHuecos(def, h);
  for (const a of def.alias ?? []) {
    const s = visibles.find((x) => x.id === a);
    const ha = s && def.extraer(s, visibles);
    if (ha) return leerHuecos(def, ha);
  }
  return null;
}

/** Monta una slide fija con sus huecos (validada como cualquier slide). */
export function montarFija(def: SlideFija, h: Huecos, ctx: CtxFija, permitidos?: string[]): SlideJson[] {
  if (!def.montar) return [];
  const out = def.montar(leerHuecos(def, h), ctx).map((s) => actualizarPeriodo(s, ctx));
  if (permitidos) out.forEach((s) => validarSlide(s, s.id, permitidos));
  return out;
}

/**
 * Lo que devuelve Claude, convertido en slide(s). En una fija acepta
 * {"huecos":…} y, si llega una slide entera, saca sus huecos y la vuelve a
 * montar (`reparar`); si no se reconoce, la deja como venga. Fuera de las
 * fijas es `validarSlide` de siempre.
 */
export function slideDesdeClaude(json: unknown, id: string, permitidos: string[], ctx: CtxFija, o: { reparar?: boolean } = {}): SlideJson[] {
  const def = defFija(id);
  let x = json as Record<string, unknown> | null;
  if (x && typeof x === "object" && x.slide && typeof x.slide === "object") x = x.slide as Record<string, unknown>;
  if (!def || def.modo !== "claude" || !x || typeof x !== "object" || Array.isArray(x)) return [validarSlide(json, id, permitidos)];
  const base = id === "situacion-cm-pm-2" ? "situacion-cm-pm" : id;
  let h: Huecos | null = null;
  if (x.huecos && typeof x.huecos === "object") h = leerHuecos(def, x.huecos);
  else {
    const s = validarSlide(x, id, permitidos);
    const e = o.reparar === false ? null : def.extraer?.(s);
    if (!e) return [s];
    h = leerHuecos(def, e);
  }
  const slides = montarFija(def, h, ctx, permitidos);
  if (!slides.length) throw new Error("la slide fija no se ha podido montar");
  slides[0]!.id = base;
  slides.forEach((s) => {
    if (typeof x.fuentes === "string") s.fuentes = x.fuentes;
    if (typeof x.origen === "string") s.origen = x.origen;
  });
  return slides;
}

/** Cuántos huecos de la estructura fija siguen «Pendiente» en una slide. */
export function huecosPendientes(s: SlideJson): number {
  let n = 0;
  recorrer(s, (v) => {
    if (v === PENDIENTE_FIJO) n++;
  });
  return n;
}

/** ¿Conserva la slide su estructura fija? (false si se ha reorganizado o corregido a mano hasta perderla). */
export function conservaEstructura(s: SlideJson, todas: SlideJson[] = []): boolean {
  const def = defFija(s.id);
  if (!def?.extraer || def.modo !== "claude" || s.id === "situacion-cm-pm-2") return true;
  return !!def.extraer(s, todas);
}

/* ---------- Traer del trimestre anterior ---------- */

/**
 * La slide `id` tal como estaba en el informe anterior, al periodo actual. En
 * una fija se vuelve a montar con sus huecos (así también llega de los ids
 * viejos, p. ej. estrategia + compraventa-financiacion); en las demás es una
 * copia. Las imágenes colocadas a mano se quedan las de ahora o, si no hay,
 * las del anterior. null si el anterior no la tenía.
 */
export function traerDelAnterior(id: string, previo: SlideJson[], actual: SlideJson | null, ctx: CtxFija): SlideJson[] | null {
  const def = defFija(id);
  let out: SlideJson[] | null = null;
  let origenPrevio: SlideJson | undefined;
  if (def?.montar && def.modo === "claude") {
    const h = huecosDelAnterior(def, previo);
    if (h) {
      out = montarFija(def, def.heredar ? def.heredar(h) : h, ctx);
      origenPrevio = previo.find((s) => s.id === id) ?? previo.find((s) => (def.alias ?? []).includes(s.id));
    }
  }
  if (!out) {
    const p = previo.find((s) => s.id === id && !s.oculto);
    if (!p) return null;
    origenPrevio = p;
    out = [actualizarPeriodo(clon(p), ctx)];
  }
  return out.map((s, i) => {
    s.origen = "heredada";
    delete s.oculto;
    delete s.cerrada;
    if (i > 0) return s;
    if (flotantesValidos(actual?.flotantes).length) return conFlotantesDe(actual, s);
    const heredadas = flotantesValidos(origenPrevio?.flotantes).map((f) => ({ ...f, heredada: true }));
    if (heredadas.length) s.flotantes = heredadas;
    else delete s.flotantes;
    return s;
  });
}

/* ---------- Texto para los prompts ---------- */

/** La estructura fija, para el bloque común de los prompts (igual en todas las peticiones: se cachea). */
export function textoEstructuraFija(): string {
  return (
    "== ESTRUCTURA FIJA DEL INFORME ==\n" +
    "Estas slides salen SIEMPRE, en este orden y con los mismos bloques cada trimestre (solo cambia el texto). Las demás de la biblioteca son opcionales y van en su sección:\n" +
    ESTRUCTURA_FIJA.map((d, i) => `${i + 1}. ${d.id} · ${d.titulo}${d.huecos ? ` · bloques: ${d.huecos.map((h) => h.clave).join(", ")}` : ""}`).join("\n") +
    "\nEn ellas la maqueta la pone el sistema: cuando se te pida un slide fijo devuelves solo sus huecos."
  );
}

/** Instrucciones de salida para un slide fijo: qué huecos devolver y los del informe anterior como punto de partida. */
export function bloqueHuecos(def: SlideFija, o: { previos?: Huecos | null; actuales?: Huecos | null } = {}): string {
  const lineas = (def.huecos ?? []).map((h) => `- "${h.clave}" (${h.tipo}${h.opcional ? ", opcional" : ""}): ${h.guia}`);
  return (
    `== ESTRUCTURA FIJA DE ESTE SLIDE («${def.titulo}») ==\n` +
    "Este slide tiene estructura fija: sus bloques, subtítulos y maqueta los pone el sistema. Esto sustituye a la primera regla de salida y a cualquier indicación de elegir layout o componentes: " +
    'NO devuelvas el slide; devuelve SOLO {"huecos":{…},"fuentes":"de dónde sale cada dato, breve"} con estas claves:\n' +
    lineas.join("\n") +
    '\nSi no hay información real para un hueco, déjalo vacío ([] o "") y el sistema pondrá «Pendiente»: no inventes ni escribas [pendiente: …]. Texto enriquecido solo con **negrita**.' +
    (o.actuales ? "\nHUECOS ACTUALES DEL SLIDE:\n" + JSON.stringify(o.actuales) : "") +
    (o.previos ? "\nHUECOS DEL INFORME ANTERIOR (punto de partida: conserva lo persistente y actualiza lo del trimestre):\n" + JSON.stringify(o.previos) : "")
  );
}

/** Para correcciones del equipo sobre un slide fijo: que no se pierdan sus bloques. */
export function avisoConservarEstructura(def: SlideFija): string {
  return (
    `== ESTRUCTURA FIJA («${def.titulo}») ==\n` +
    `Este slide tiene estructura fija (bloques: ${(def.huecos ?? []).map((h) => h.clave).join(", ")}). Salvo que la instrucción lo pida expresamente, conserva todos sus bloques, subtítulos y su orden, y las claves "hueco" de los nodos; cambia solo el contenido.`
  );
}

/** Para tests y utilidades: los alias de las fijas. */
export function aliasDe(id: string): string[] {
  return defFija(id)?.alias ?? [];
}

/** Las slides de un grupo fijo (CM/PM puede ocupar dos). */
export function idsDelGrupo(id: string): string[] {
  return /^situacion-cm-pm/.test(id) ? ["situacion-cm-pm", "situacion-cm-pm-2"] : [id];
}

/** Slide vacía de la estructura (con todos sus «Pendiente»). */
export function slideVacia(id: string, ctx: CtxFija): SlideJson | null {
  const def = defFija(id);
  if (!def?.montar) return null;
  return clon(montarFija(def, huecosVacios(def), ctx)[0]!);
}
