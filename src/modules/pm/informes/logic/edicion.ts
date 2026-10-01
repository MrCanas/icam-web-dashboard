import type { SlideJson } from "../slides/tipos";
import { clon, NO_TEXTO, recorrer, type Ruta } from "./informe";

/**
 * Edición a mano de un slide, sin Claude: textos literales y disposición de
 * bloques e imágenes. Lógica pura sobre el JSON del slide; quién es qué en la
 * slide pintada lo resuelve ui/editor/mapa.ts.
 *
 * Ninguna función muta el slide que recibe: todas devuelven uno nuevo.
 */

type Objeto = Record<string, unknown>;

function esObjeto(v: unknown): v is Objeto {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

export function leerRuta(raiz: unknown, ruta: Ruta): unknown {
  let v = raiz;
  for (const k of ruta) {
    if (v == null || typeof v !== "object") return undefined;
    v = (v as Record<string | number, unknown>)[k];
  }
  return v;
}

function ponerRuta(raiz: unknown, ruta: Ruta, valor: unknown): void {
  const padre = leerRuta(raiz, ruta.slice(0, -1)) as Record<string | number, unknown>;
  padre[ruta[ruta.length - 1]!] = valor;
}

export function mismaRuta(a: Ruta, b: Ruta): boolean {
  return a.length === b.length && a.every((k, i) => k === b[i]);
}

function empiezaPor(ruta: Ruta, prefijo: Ruta): boolean {
  return prefijo.length <= ruta.length && prefijo.every((k, i) => k === ruta[i]);
}

/* ------------------------------------------------------------------ textos */

export interface CampoTexto {
  ruta: Ruta;
  valor: string;
}

/** Claves cuyo valor es configuración del componente, no texto que se lea en la slide. */
const NO_EDITABLE = new Set(["fondo", "recorte", "tono", "estado", "tipo"]);

/** Textos de un slide con su sitio en el JSON, en el orden en que aparecen. */
export function camposTexto(slide: SlideJson): CampoTexto[] {
  const out: CampoTexto[] = [];
  recorrer(slide, (v, r) => {
    const k = String(r[r.length - 1]);
    if (typeof v !== "string" || !v.trim()) return;
    if (NO_TEXTO.has(k) || NO_EDITABLE.has(k) || r.includes("estilo") || r.includes("style")) return;
    if (/^(\/|https?:|data:)/.test(v)) return;
    out.push({ ruta: r, valor: v });
  });
  return out;
}

const NOMBRES: Record<string, string> = {
  parrafos: "párrafo",
  items: "viñeta",
  vinetas: "viñeta",
  logros: "logro",
  titulo: "título",
  subtitulo: "subtítulo",
  nota: "nota",
  pie: "pie de foto",
  izquierda: "izquierda",
  derecha: "derecha",
  imagenes: "imagen",
  filas: "fila",
  hitos: "hito",
};

/** Nombre legible del sitio de un texto: «izquierda · párrafo 2». */
export function etiquetaRuta(ruta: Ruta): string {
  const partes: string[] = [];
  ruta.forEach((k) => {
    if (typeof k === "number") {
      if (partes.length) partes[partes.length - 1] += ` ${k + 1}`;
      return;
    }
    if (["props", "hijos", "compuesto", "contenido"].includes(k)) return;
    partes.push(NOMBRES[k] ?? k);
  });
  return partes.join(" · ") || "texto";
}

/**
 * Sustituye un texto. En una lista de textos (párrafos, viñetas), una línea en
 * blanco lo parte en dos elementos y dejarlo vacío lo quita de la lista.
 */
export function ponerTexto(slide: SlideJson, ruta: Ruta, valor: string): SlideJson {
  const s = clon(slide);
  const padre = leerRuta(s, ruta.slice(0, -1));
  const k = ruta[ruta.length - 1]!;
  if (Array.isArray(padre) && typeof k === "number" && padre.every((x) => typeof x === "string")) {
    const partes = valor
      .split(/\n\s*\n/)
      .map((p) => p.replace(/\s*\n\s*/g, " ").trim())
      .filter(Boolean);
    padre.splice(k, 1, ...partes);
    return s;
  }
  ponerRuta(s, ruta, valor.replace(/\s*\n\s*/g, " ").trim());
  return s;
}

/** Texto sin negritas ni espacios: así se compara lo pintado con lo guardado. */
export function sinFormato(t: string): string {
  return t.replace(/\*\*/g, "").replace(/\s+/g, "");
}

/**
 * Qué texto del JSON produjo lo que se ha pulsado en la slide. `bloque` es el
 * texto del párrafo, viñeta, celda o título pulsado, y `pulsado` el del trozo
 * exacto bajo el cursor. Devuelve los candidatos, del más probable al menos:
 * el que coincide con el bloque, el que contiene lo pulsado o, si la plantilla
 * compone el texto («Antecedentes. Q2 2026»), los que forman parte de él.
 */
export function localizarCampo(campos: CampoTexto[], pulsado: string, bloque: string): CampoTexto[] {
  const b = sinFormato(bloque);
  const p = sinFormato(pulsado);
  if (!b && !p) return [];
  const iguales = campos.filter((c) => sinFormato(c.valor) === b);
  if (iguales.length) return iguales;
  if (p.length >= 2) {
    const contienen = campos.filter((c) => sinFormato(c.valor).includes(p));
    if (contienen.length) return contienen;
  }
  return campos
    .filter((c) => {
      const v = sinFormato(c.valor);
      return v.length >= 3 && (p.includes(v) || b.includes(v));
    })
    .sort((x, y) => sinFormato(y.valor).length - sinFormato(x.valor).length);
}

/* ------------------------------------------------------------------ bloques */

/**
 * Árbol de lo que se puede mover en un slide. Un contenedor apila bloques
 * (`pila`) o los reparte en columnas (`columnas`); un bloque sin contenedor es
 * un componente entero (un texto, una galería, una tabla).
 */
export interface NodoArbol {
  /** Sitio del nodo en el JSON. */
  ruta: Ruta;
  /** Componente («Texto», «Galeria», «div»…); null en el área de contenido y en las columnas de DosColumnas. */
  c: string | null;
  contenedor: {
    /** Sitio de la lista de hijos en el JSON. */
    ruta: Ruta;
    orientacion: "pila" | "columnas";
    hijos: NodoArbol[];
    /** Tiene texto suelto entre los bloques: no se puede reordenar a mano. */
    mixto: boolean;
  } | null;
}

function esColumnas(clase: unknown): boolean {
  return typeof clase === "string" && /\biq-cols\b/.test(clase);
}

function arbolDeNodo(n: Objeto, ruta: Ruta): NodoArbol {
  const c = typeof n.c === "string" ? n.c : null;
  if (c !== "div" || !Array.isArray(n.hijos)) return { ruta, c, contenedor: null };
  const props = esObjeto(n.props) ? n.props : {};
  return { ruta, c, contenedor: listaDeNodos(n.hijos, [...ruta, "hijos"], esColumnas(props.className) ? "columnas" : "pila") };
}

function listaDeNodos(lista: unknown[], ruta: Ruta, orientacion: "pila" | "columnas"): NonNullable<NodoArbol["contenedor"]> {
  const hijos: NodoArbol[] = [];
  let mixto = false;
  lista.forEach((x, i) => {
    if (esObjeto(x) && typeof x.c === "string") hijos.push(arbolDeNodo(x, [...ruta, i]));
    else if (x != null && x !== false && x !== "") mixto = true;
  });
  return { ruta, orientacion, hijos, mixto };
}

const LADOS = ["izquierda", "derecha"] as const;

/**
 * Deja el slide en la forma con la que trabaja la edición: las columnas de
 * DosColumnas pasan a ser listas de nodos (se pintan igual). Las rutas del
 * árbol y de las operaciones se refieren siempre al slide normalizado.
 */
export function normalizar(slide: SlideJson): SlideJson {
  const s = clon(slide);
  if (s.c === "DosColumnas" && esObjeto(s.props)) {
    for (const lado of LADOS) {
      const v = s.props[lado];
      if (!Array.isArray(v)) s.props[lado] = v == null ? [] : [v];
    }
  }
  return s;
}

/** Área de contenido de un slide (ya normalizado) como árbol de bloques; null si su plantilla es fija. */
export function arbolBloques(slide: SlideJson): NodoArbol | null {
  if (slide.compuesto) {
    const c = slide.compuesto;
    return {
      ruta: ["compuesto"],
      c: null,
      contenedor: listaDeNodos(c.contenido ?? [], ["compuesto", "contenido"], esColumnas(c.clase) ? "columnas" : "pila"),
    };
  }
  if (slide.c === "DosColumnas" && esObjeto(slide.props)) {
    const props = slide.props;
    const columnas: NodoArbol[] = LADOS.map((lado) => ({
      ruta: ["props", lado],
      c: null,
      contenedor: listaDeNodos(Array.isArray(props[lado]) ? (props[lado] as unknown[]) : [], ["props", lado], "pila"),
    }));
    return { ruta: ["props"], c: "DosColumnas", contenedor: { ruta: ["props"], orientacion: "columnas", hijos: columnas, mixto: false } };
  }
  return null;
}

/** Todos los nodos del árbol, de fuera adentro. */
export function nodosDe(arbol: NodoArbol | null): NodoArbol[] {
  if (!arbol) return [];
  return [arbol, ...(arbol.contenedor?.hijos ?? []).flatMap(nodosDe)];
}

function padreDe(arbol: NodoArbol | null, ruta: Ruta): NodoArbol | null {
  return nodosDe(arbol).find((n) => n.contenedor?.hijos.some((h) => mismaRuta(h.ruta, ruta))) ?? null;
}

/** Rejilla de columnas en la que está un bloque y columna que ocupa; null si no está en ninguna. */
export function rejillaDe(arbol: NodoArbol | null, ruta: Ruta): { rejilla: NodoArbol; columna: number } | null {
  let actual = ruta;
  for (;;) {
    const padre = padreDe(arbol, actual);
    if (!padre?.contenedor) return null;
    if (padre.contenedor.orientacion === "columnas") {
      return { rejilla: padre, columna: padre.contenedor.hijos.findIndex((h) => mismaRuta(h.ruta, actual)) };
    }
    actual = padre.ruta;
  }
}

type Pila = NonNullable<NodoArbol["contenedor"]>;

/** Un `div` que solo envuelve a otra pila (la columna de DosColumnas con su `div` dentro). */
export function esEnvoltorio(c: Pila): boolean {
  return c.orientacion === "pila" && c.hijos.length === 1 && c.hijos[0]!.contenedor?.orientacion === "pila";
}

/** Pila en la que se apilan de verdad los bloques de un nodo, bajando por los envoltorios; null si no apila. */
export function pilaInterior(nodo: NodoArbol): Pila | null {
  let c = nodo.contenedor;
  while (c && esEnvoltorio(c)) c = c.hijos[0]!.contenedor;
  return c?.orientacion === "pila" ? c : null;
}

export interface DestinoBloque {
  /** Ruta de la lista de hijos del contenedor destino (NodoArbol.contenedor.ruta). */
  contenedor: Ruta;
  indice: number;
}

/**
 * Mueve un bloque a otra posición de su contenedor o a otro contenedor. Para
 * dejarlo en una columna que es un componente suelto, primero `columnaComoPila`.
 */
export function moverBloque(slide: SlideJson, desde: Ruta, hacia: DestinoBloque): SlideJson {
  const s = normalizar(slide);
  if (empiezaPor(hacia.contenedor, desde)) throw new Error("Un bloque no se puede mover dentro de sí mismo.");
  const origen = leerRuta(s, desde.slice(0, -1));
  const destino = leerRuta(s, hacia.contenedor);
  const i = desde[desde.length - 1];
  if (!Array.isArray(origen) || !Array.isArray(destino) || typeof i !== "number") throw new Error("Ese bloque no se puede mover.");
  const [bloque] = origen.splice(i, 1);
  // En la misma lista, los índices posteriores al hueco han bajado uno.
  const indice = origen === destino && hacia.indice > i ? hacia.indice - 1 : hacia.indice;
  destino.splice(Math.max(0, Math.min(destino.length, indice)), 0, bloque);
  return s;
}

/**
 * Convierte en pila una columna que es un componente suelto, envolviéndolo en
 * un `div`, para poder dejar otro bloque encima o debajo. Devuelve el slide y
 * la ruta de la lista de hijos de la nueva pila.
 */
export function columnaComoPila(slide: SlideJson, columna: Ruta): { slide: SlideJson; contenedor: Ruta } {
  const s = normalizar(slide);
  const nodo = leerRuta(s, columna);
  if (Array.isArray(nodo)) return { slide: s, contenedor: columna };
  if (esObjeto(nodo) && nodo.c === "div" && Array.isArray(nodo.hijos) && !esColumnas((nodo.props as Objeto | undefined)?.className)) {
    return { slide: s, contenedor: [...columna, "hijos"] };
  }
  ponerRuta(s, columna, { c: "div", hijos: [nodo] });
  return { slide: s, contenedor: [...columna, "hijos"] };
}

/** Intercambia el orden de las columnas de una rejilla (`rejilla` = ruta de su lista de columnas). */
export function intercambiarColumnas(slide: SlideJson, rejilla: Ruta): SlideJson {
  const s = normalizar(slide);
  if (s.c === "DosColumnas" && mismaRuta(rejilla, ["props"]) && esObjeto(s.props)) {
    [s.props.izquierda, s.props.derecha] = [s.props.derecha, s.props.izquierda];
    return s;
  }
  const lista = leerRuta(s, rejilla);
  if (!Array.isArray(lista)) throw new Error("Esa rejilla no se puede reordenar.");
  lista.reverse();
  return s;
}

export const PROPORCIONES: { valor: string; nombre: string }[] = [
  { valor: "1fr 1fr", nombre: "Mitad y mitad" },
  { valor: "3fr 2fr", nombre: "Izquierda más ancha" },
  { valor: "2fr 3fr", nombre: "Derecha más ancha" },
  { valor: "1fr 270px", nombre: "Texto y lateral estrecho" },
];

/** Dónde guarda una rejilla el reparto de sus columnas; null si su plantilla no lo permite (DosColumnas). */
function estiloDeRejilla(s: SlideJson, rejilla: Ruta, crear: boolean): Objeto | null {
  if (mismaRuta(rejilla, ["compuesto", "contenido"]) && s.compuesto) {
    if (!s.compuesto.estilo && crear) s.compuesto.estilo = {};
    return s.compuesto.estilo ?? null;
  }
  if (rejilla[rejilla.length - 1] !== "hijos") return null;
  const nodo = leerRuta(s, rejilla.slice(0, -1));
  if (!esObjeto(nodo)) return null;
  if (!esObjeto(nodo.props)) {
    if (!crear) return null;
    nodo.props = {};
  }
  const props = nodo.props as Objeto;
  if (!esObjeto(props.style)) {
    if (!crear) return null;
    props.style = {};
  }
  return props.style as Objeto;
}

export function admiteProporcion(slide: SlideJson, rejilla: Ruta): boolean {
  return mismaRuta(rejilla, ["compuesto", "contenido"]) || rejilla[rejilla.length - 1] === "hijos";
}

export function proporcionActual(slide: SlideJson, rejilla: Ruta): string {
  const e = estiloDeRejilla(slide, rejilla, false);
  return typeof e?.gridTemplateColumns === "string" ? e.gridTemplateColumns : "1fr 1fr";
}

/** Reparto del ancho entre las columnas de una rejilla («1fr 1fr» vuelve al de la plantilla). */
export function proporcionColumnas(slide: SlideJson, rejilla: Ruta, valor: string): SlideJson {
  const s = normalizar(slide);
  const e = estiloDeRejilla(s, rejilla, true);
  if (!e) throw new Error("Esta plantilla no permite cambiar el ancho de las columnas.");
  if (valor === "1fr 1fr") delete e.gridTemplateColumns;
  else e.gridTemplateColumns = valor;
  return s;
}

/* ------------------------------------------------------------------ imágenes */

export const DISPOSICIONES_GALERIA: { valor: string; nombre: string; huecos: number }[] = [
  { valor: "1", nombre: "1 foto grande", huecos: 1 },
  { valor: "2", nombre: "2 fotos", huecos: 2 },
  { valor: "3", nombre: "3 fotos", huecos: 3 },
  { valor: "4", nombre: "4 fotos", huecos: 4 },
  { valor: "hero-2", nombre: "1 grande y 2 pequeñas", huecos: 3 },
];

export interface GrupoImagenes {
  /** Nodo que pinta las imágenes (o [] si es el propio slide: TextoImagen, Portada, SlideBloqueado). */
  nodo: Ruta;
  tipo: "Galeria" | "ImagenMarco" | "TextoImagen" | "Portada" | "MapaLateral" | "SlideBloqueado";
  /** Sitio de cada imagen en el JSON, por orden de aparición. */
  imagenes: Ruta[];
  /**
   * true: cada imagen es un objeto {src, pie, focalX…} y admite encuadre.
   * false: la plantilla solo guarda la dirección de la imagen (portada, mapa, página de Finanzas).
   */
  objetos: boolean;
}

/** Imágenes de un slide que la PM puede cambiar y, donde la plantilla lo admite, reencuadrar o reordenar. */
export function gruposDeImagenes(slide: SlideJson): GrupoImagenes[] {
  const out: GrupoImagenes[] = [];
  if (slide.c === "TextoImagen") {
    // Como la plantilla: sin lista pinta un hueco; con lista, hasta una o dos de sus imágenes.
    const props = esObjeto(slide.props) ? slide.props : {};
    const tope = props.variante === "dos-apiladas" ? 2 : 1;
    const n = Array.isArray(props.imagenes) ? Math.min(props.imagenes.length, tope) : 1;
    out.push({ nodo: [], tipo: "TextoImagen", objetos: true, imagenes: Array.from({ length: n }, (_, i) => ["props", "imagenes", i]) });
  }
  if (slide.c === "Portada") out.push({ nodo: [], tipo: "Portada", objetos: false, imagenes: [["props", "imagen"]] });
  // Una slide bloqueada con contenido propio (hijos) no lleva página aportada.
  if (slide.c === "SlideBloqueado" && !slide.hijos?.length) out.push({ nodo: [], tipo: "SlideBloqueado", objetos: false, imagenes: [["props", "vista"]] });
  recorrer(slide, (v, r) => {
    if (!esObjeto(v) || !r.length) return;
    if (v.c === "ImagenMarco") out.push({ nodo: r, tipo: "ImagenMarco", objetos: true, imagenes: [[...r, "props"]] });
    if (v.c === "MapaLateral") {
      out.push({ nodo: r, tipo: "MapaLateral", objetos: false, imagenes: [[...r, "props", "mapa"], [...r, "props", "foto"]] });
    }
    if (v.c === "Galeria") {
      const props = esObjeto(v.props) ? v.props : {};
      const d = DISPOSICIONES_GALERIA.find((x) => x.valor === props.disposicion) ?? DISPOSICIONES_GALERIA[3]!;
      out.push({ nodo: r, tipo: "Galeria", objetos: true, imagenes: Array.from({ length: d.huecos }, (_, i) => [...r, "props", "imagenes", i]) });
    }
  });
  return out;
}

/** Dirección de la imagen que hay en un hueco; null si está vacío. */
export function srcDeImagen(slide: SlideJson, grupo: GrupoImagenes, imagen: Ruta): string | null {
  const v = leerRuta(slide, imagen);
  const src = grupo.objetos ? (esObjeto(v) ? v.src : null) : v;
  return typeof src === "string" && src ? src : null;
}

/** Objeto de una imagen, creando lo que falte por el camino (props, la lista, los huecos anteriores). */
function imagenEn(s: SlideJson, ruta: Ruta): Objeto {
  let v = s as unknown as Record<string | number, unknown>;
  ruta.forEach((k, j) => {
    if (Array.isArray(v) && typeof k === "number") while (v.length < k) v.push({});
    const lista = typeof ruta[j + 1] === "number";
    if (lista ? !Array.isArray(v[k]) : !esObjeto(v[k])) v[k] = lista ? [] : {};
    v = v[k] as Record<string | number, unknown>;
  });
  return v as Objeto;
}

/**
 * Cambia la imagen de un hueco. En galerías e imágenes sueltas el encuadre
 * vuelve al centro; en una página de Finanzas la slide pasa a «Aportado».
 */
export function cambiarFoto(slide: SlideJson, grupo: GrupoImagenes, imagen: Ruta, src: string): SlideJson {
  const s = clon(slide);
  if (grupo.objetos) {
    const im = imagenEn(s, imagen);
    im.src = src;
    delete im.focalX;
    delete im.focalY;
    return s;
  }
  imagenEn(s, imagen.slice(0, -1))[String(imagen[imagen.length - 1])] = src;
  if (grupo.tipo === "SlideBloqueado") {
    const props = s.props as Objeto;
    if (props.estado === "Pendiente de Finanzas") props.estado = "Aportado";
    if (!s.fuentes) s.fuentes = "Página aportada a mano";
  }
  return s;
}

/** Punto de la foto que debe quedar a la vista (0–1 en cada eje). */
export function reencuadrar(slide: SlideJson, imagen: Ruta, x: number, y: number): SlideJson {
  const s = clon(slide);
  const im = imagenEn(s, imagen);
  const limitar = (v: number) => Math.round(Math.max(0, Math.min(1, v)) * 100) / 100;
  im.focalX = limitar(x);
  im.focalY = limitar(y);
  return s;
}

/** Intercambia dos fotos del mismo grupo (galería o columna de imágenes). */
export function intercambiarFotos(slide: SlideJson, a: Ruta, b: Ruta): SlideJson {
  const s = clon(slide);
  const ia = { ...imagenEn(s, a) };
  const ib = { ...imagenEn(s, b) };
  ponerRuta(s, a, ib);
  ponerRuta(s, b, ia);
  return s;
}

/** Disposición de una galería («1», «2», «3», «4», «hero-2»). */
export function disposicionGaleria(slide: SlideJson, nodo: Ruta, valor: string): SlideJson {
  const s = clon(slide);
  const n = leerRuta(s, nodo);
  if (!esObjeto(n) || n.c !== "Galeria" || !DISPOSICIONES_GALERIA.some((d) => d.valor === valor)) throw new Error("Disposición no válida.");
  if (!esObjeto(n.props)) n.props = {};
  (n.props as Objeto).disposicion = valor;
  return s;
}

/** Una imagen o dos apiladas en un slide de texto e imagen. */
export function varianteTextoImagen(slide: SlideJson, valor: "una" | "dos-apiladas"): SlideJson {
  const s = clon(slide);
  if (s.c !== "TextoImagen") throw new Error("Este slide no es de texto e imagen.");
  const imagenes = Array.isArray(s.props?.imagenes) ? [...(s.props.imagenes as unknown[])] : [{}];
  // La plantilla solo pinta las imágenes que hay en la lista: el segundo hueco tiene que existir para poder rellenarlo.
  while (valor === "dos-apiladas" && imagenes.length < 2) imagenes.push({});
  s.props = { ...(s.props ?? {}), variante: valor, imagenes };
  return s;
}
