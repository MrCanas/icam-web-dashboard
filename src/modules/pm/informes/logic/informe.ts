import type { NodoJson, SlideJson } from "../slides/tipos";
import type { EntradaEstructura, Foto, PrevioEstructurado } from "../types";
import type { EntradaBiblioteca } from "./biblioteca";

/**
 * Lógica pura sobre el informe (slides en formato informe.json), portada de
 * app-equipo/src/app.html: textos, títulos, secciones e índice, periodo,
 * validación de lo que devuelve Claude, estructura del análisis y QA mecánico.
 */

export function clon<T>(o: T): T {
  return JSON.parse(JSON.stringify(o)) as T;
}

export type Ruta = (string | number)[];

export function recorrer(v: unknown, fn: (v: unknown, ruta: Ruta) => void, ruta: Ruta = []): void {
  fn(v, ruta);
  if (Array.isArray(v)) v.forEach((x, i) => recorrer(x, fn, ruta.concat(i)));
  else if (v && typeof v === "object") Object.keys(v).forEach((k) => recorrer((v as Record<string, unknown>)[k], fn, ruta.concat(k)));
}

export const NO_TEXTO = new Set([
  "src", "imagen", "vista", "foto", "mapa", "c", "icono", "variante", "disposicion", "layout", "clase", "id", "origen", "fuentes", "className",
]);

/** Texto legible de un slide (sin rutas, ids ni estilos), separado por « · ». */
export function textos(slide: unknown): string {
  const out: string[] = [];
  recorrer(slide, (v, r) => {
    const k = r[r.length - 1];
    if (typeof v === "string" && !NO_TEXTO.has(String(k)) && !r.includes("estilo") && !r.includes("style")) {
      out.push(v.replace(/\*\*/g, ""));
    }
  });
  return out.join(" · ");
}

const TITULOS: Record<string, string> = {
  Portada: "Portada",
  Indice: "Índice",
  ResumenEjecutivo: "Resumen ejecutivo",
  SlideKpisRiesgosObjetivos: "KPIs, riesgos y objetivos",
  Colaboradores: "Colaboradores",
  Disclaimer: "Disclaimer",
  Cierre: "Cierre",
};

export function tituloDe(s: SlideJson): string {
  if (s.compuesto) return s.compuesto.titulo || s.id;
  const p = (s.props ?? {}) as Record<string, unknown>;
  return (typeof p.titulo === "string" && p.titulo) || (s.c && TITULOS[s.c]) || s.id;
}

/* ---------- Secciones, orden e índice ---------- */

export const SECCIONES = [
  "Resumen Ejecutivo",
  "Análisis de Varianzas",
  "Resumen de Proyecto",
  "Situación de Proyecto",
  "Obra",
  "Colaboradores",
  "Vehículo de Inversión",
];

export function seccionDe(id: string): number {
  if (/^resumen-(ejecutivo|financiero)/.test(id)) return 0;
  if (/^varianzas/.test(id)) return 1;
  if (/^(estrategia|compraventa|calendario|kpis|cartera)/.test(id)) return 2;
  if (/^(obra|seguimiento-economico)/.test(id)) return 4;
  if (/^colaboradores/.test(id)) return 5;
  if (/^(vehiculo|consejo)/.test(id)) return 6;
  return 3;
}

function rango(s: SlideJson): number {
  return s.id === "portada" ? -2 : s.id === "indice" ? -1 : s.id === "disclaimer" ? 100 : s.id === "cierre" ? 101 : seccionDe(s.id);
}

/** Orden canónico: portada, índice, secciones en su orden (estable dentro de cada una), disclaimer, cierre. */
export function ordenar(slides: SlideJson[]): SlideJson[] {
  return slides
    .map((s, i) => [s, i] as const)
    .sort((a, b) => rango(a[0]) - rango(b[0]) || a[1] - b[1])
    .map((x) => x[0]);
}

/** Numera cada slide con la posición de su sección entre las presentes y rehace el índice. Muta y devuelve `slides`. */
export function renumerar(slides: SlideJson[]): SlideJson[] {
  const presentes: number[] = [];
  slides.forEach((s) => {
    if (!s.oculto && rango(s) >= 0 && rango(s) < 100 && !presentes.includes(seccionDe(s.id))) presentes.push(seccionDe(s.id));
  });
  presentes.sort((a, b) => a - b);
  slides.forEach((s) => {
    if (rango(s) < 0 || rango(s) >= 100) return;
    const n = presentes.indexOf(seccionDe(s.id)) + 1;
    if (!n) return;
    if (s.compuesto) s.compuesto.seccion = n;
    else {
      s.props = s.props || {};
      s.props.seccion = n;
    }
  });
  slides.forEach((s) => {
    if (s.id === "indice") {
      s.c = "Indice";
      s.props = { secciones: presentes.map((i) => SECCIONES[i]) };
    }
  });
  return slides;
}

/** Id libre para una slide nueva de la biblioteca: «situacion-<tema>» → situacion-nueva, «obra-n» → obra-2, obra-3… */
export function idNuevo(b: EntradaBiblioteca, slides: SlideJson[]): string {
  const base = b.id.replace(/<.*>/, "nueva").replace(/-n$/, "");
  let k = 2;
  let id = /-n$/.test(b.id) ? `${base}-${k}` : base;
  while (slides.some((s) => s.id === id)) id = `${base}-${k++}`;
  return id;
}

export interface PeriodoInforme {
  trimestre: string;
  trimestreAnterior: string;
  siguiente: string;
}

/** Fija el periodo de un slide: «trimestre» al del informe (salvo en «anterior»), «siguiente» a Q+1. Muta y devuelve `s`. */
export function actualizarPeriodo<T>(s: T, d: PeriodoInforme): T {
  recorrer(s, (v, r) => {
    if (!v || typeof v !== "object" || Array.isArray(v) || r.includes("anterior")) return;
    const o = v as Record<string, unknown>;
    if (typeof o.trimestre === "string" && r[r.length - 1] !== "anterior") o.trimestre = d.trimestre;
    if (typeof o.siguiente === "string") o.siguiente = d.siguiente;
    if (typeof o.titulo === "string") o.titulo = o.titulo.split(d.trimestreAnterior).join(d.trimestre);
  });
  return s;
}

/**
 * Comprueba lo que devuelve Claude antes de pintarlo: un slide (o {slide}),
 * con componente, solo con componentes del API y sin rutas de foto inventadas.
 */
export function validarSlide(o: unknown, id: string, permitidos: string[]): SlideJson {
  let x = o as Record<string, unknown> | null;
  if (x && typeof x === "object" && x.slide && typeof x.slide === "object") x = x.slide as Record<string, unknown>;
  if (!x || typeof x !== "object" || Array.isArray(x)) throw new Error("la respuesta no es un slide");
  if (!x.c && !x.compuesto) throw new Error("el slide no indica componente");
  x.id = id;
  const malos: string[] = [];
  recorrer(x, (v) => {
    if (v && typeof v === "object" && !Array.isArray(v) && typeof (v as { c?: unknown }).c === "string") {
      const c = (v as { c: string }).c;
      if (!permitidos.includes(c)) malos.push(c);
    }
  });
  if (malos.length) throw new Error("usa componentes que no existen: " + [...new Set(malos)].join(", "));
  recorrer(x, (v) => {
    if (typeof v === "string" && (/^fotos\//.test(v) || /^\/_blob\//.test(v))) throw new Error(`usa una ruta de foto que no existe (${v})`);
  });
  return x as unknown as SlideJson;
}

const ACCIONES = ["mantener", "actualizar", "ocultar", "nueva"] as const;

/**
 * Estructura del análisis, saneada: sin repetidos, con todas las slides del
 * informe anterior, y portada, índice y resumen al inicio y disclaimer y cierre
 * al final.
 */
export function normalizarEstructura(est: unknown, previo: PrevioEstructurado | null): EntradaEstructura[] {
  const vistos = new Set<string>();
  const out: EntradaEstructura[] = [];
  (Array.isArray(est) ? est : []).forEach((e: Record<string, unknown>) => {
    if (e && e.id && !vistos.has(String(e.id))) {
      vistos.add(String(e.id));
      out.push({
        id: String(e.id),
        titulo: typeof e.titulo === "string" ? e.titulo : "",
        accion: (ACCIONES as readonly string[]).includes(e.accion as string) ? (e.accion as EntradaEstructura["accion"]) : "actualizar",
        motivo: typeof e.motivo === "string" ? e.motivo : "",
      });
    }
  });
  previo?.slides.forEach((s) => {
    if (!vistos.has(s.id)) {
      vistos.add(s.id);
      out.push({ id: s.id, titulo: tituloDe(s), accion: s.oculto ? "ocultar" : "actualizar", motivo: "" });
    }
  });
  ["portada", "indice", "resumen-ejecutivo"].forEach((id, i) => {
    if (!vistos.has(id)) out.splice(i, 0, { id, titulo: "", accion: "nueva", motivo: "Obligatoria" });
  });
  ["disclaimer", "cierre"].forEach((id) => {
    if (!vistos.has(id)) out.push({ id, titulo: "", accion: "mantener", motivo: "Obligatoria" });
  });
  return out;
}

export const SLIDES_FINANZAS = ["resumen-financiero", "varianzas", "seguimiento-economico-obra"];

/**
 * Slides que se hacen sin Claude: portada (con la foto de Portada), índice,
 * disclaimer, cierre, las bloqueadas de Finanzas (con la página aportada o
 * «Pendiente de Finanzas») y las que se mantienen. null = la redacta Claude.
 */
export function slideDeterminista(
  t: { id: string; accion: string },
  actual: SlideJson,
  d: PeriodoInforme & { proyecto: string },
  fotos: Foto[],
  urlFoto: (id: string) => string,
): SlideJson | null {
  let s = clon(actual);
  const props = (s.props ?? {}) as Record<string, unknown>;
  if (t.id === "portada") {
    // Si hay varias, la última subida: es la que la PM acaba de elegir.
    const fp = fotos.findLast((f) => f.categoria === "Portada");
    return {
      id: "portada",
      c: "Portada",
      origen: "actualizada",
      props: { trimestre: d.trimestre, proyecto: d.proyecto, imagen: fp ? urlFoto(fp.id) : (props.imagen as string | undefined) || undefined },
    };
  }
  if (t.id === "indice") return { id: "indice", c: "Indice", origen: "actualizada", props: { secciones: [] } };
  if (t.id === "disclaimer") return { id: "disclaimer", c: "Disclaimer", origen: "heredada" };
  if (t.id === "cierre") return { id: "cierre", c: "Cierre", origen: "heredada" };
  if (s.c === "SlideBloqueado" || SLIDES_FINANZAS.includes(t.id)) {
    const pag = fotos.findLast((f) => f.categoria === "Página de Finanzas" && (f.para || "resumen-financiero") === t.id);
    const base =
      (props.titulo as string | undefined) ||
      (t.id === "varianzas"
        ? "Análisis de Varianzas. Financiero "
        : t.id === "resumen-financiero"
          ? "Resumen Ejecutivo. Financiero "
          : "Obra. Seguimiento Económico") + (t.id === "seguimiento-economico-obra" ? "" : d.trimestre);
    return {
      id: t.id,
      c: "SlideBloqueado",
      origen: "bloqueada",
      fuentes: pag ? "Página aportada por Finanzas" : "",
      props: {
        seccion: (props.seccion as number | undefined) || 1,
        titulo: base.split(d.trimestreAnterior).join(d.trimestre),
        origen: t.id === "seguimiento-economico-obra" ? "Project Monitoring" : "Finanzas",
        version: d.trimestre,
        estado: pag ? "Aportado" : "Pendiente de Finanzas",
        vista: pag ? urlFoto(pag.id) : undefined,
      },
    };
  }
  if (t.accion === "mantener") {
    s = actualizarPeriodo(s, d);
    s.origen = "heredada";
    return s;
  }
  return null;
}

export interface MedidaQa {
  pendientes?: number;
  relleno?: number | null;
  desborde?: boolean;
  error?: string;
}

export interface IncidenciaQa {
  nivel: "error" | "aviso";
  slide: string;
  texto: string;
}

/** QA mecánico del editor: desbordes, [pendiente], trimestres mal y disclaimer. Los «error» bloquean la aprobación. */
export function qaMecanico(slides: SlideJson[], medidas: Record<string, MedidaQa>, d: PeriodoInforme): IncidenciaQa[] {
  const out: IncidenciaQa[] = [];
  const sl = slides.filter((s) => !s.oculto);
  if (!sl.some((s) => s.c === "Disclaimer")) out.push({ nivel: "error", slide: "", texto: "Falta el Disclaimer." });
  sl.forEach((s) => {
    const m = medidas[s.id] || {};
    if (m.pendientes) out.push({ nivel: "error", slide: s.id, texto: `${m.pendientes} dato(s) [pendiente] sin resolver.` });
    if (m.desborde) out.push({ nivel: "error", slide: s.id, texto: "El contenido desborda la slide." });
    else if (m.relleno != null && m.relleno < 80 && s.c !== "SlideBloqueado") {
      out.push({ nivel: "aviso", slide: s.id, texto: `Relleno ${m.relleno} %: queda hueco.` });
    }
    if (m.error) out.push({ nivel: "error", slide: s.id, texto: m.error });
    recorrer(s, (v, r) => {
      if (typeof v !== "string" || r.includes("anterior")) return;
      const k = r[r.length - 1];
      if (k === "trimestre" && v !== d.trimestre) out.push({ nivel: "error", slide: s.id, texto: `Trimestre ${v} en lugar de ${d.trimestre}.` });
      if (k === "siguiente" && v !== d.siguiente) out.push({ nivel: "error", slide: s.id, texto: `Trimestre siguiente ${v} en lugar de ${d.siguiente}.` });
    });
  });
  return out;
}

/** Nodos con un «c» dado (para contar componentes, p. ej.). */
export function nodosDe(v: NodoJson | SlideJson, nombre: string): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  recorrer(v, (x) => {
    if (x && typeof x === "object" && !Array.isArray(x) && (x as { c?: string }).c === nombre) out.push(x as Record<string, unknown>);
  });
  return out;
}
