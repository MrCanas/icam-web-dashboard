"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import {
  admiteProporcion,
  ALTO_IMAGEN,
  altoDeImagen,
  arbolBloques,
  cambiarFoto,
  camposTexto,
  columnaComoPila,
  desplegar,
  disposicionGaleria,
  DISPOSICIONES_GALERIA,
  esEnvoltorio,
  insertarBloque,
  etiquetaRuta,
  intercambiarColumnas,
  intercambiarFotos,
  leerRuta,
  localizarCampo,
  mismaRuta,
  moverBloque,
  nodoImagen,
  pilaInterior,
  ponerTexto,
  proporcionActual,
  proporcionColumnas,
  PROPORCIONES,
  quitarBloque,
  reencuadrar,
  rejillaDe,
  sinFormato,
  srcDeImagen,
  vaciarFoto,
  type CampoTexto,
  type GrupoImagenes,
  type NodoArbol,
} from "../../logic/edicion";
import { tituloDe, type Ruta } from "../../logic/informe";
import type { SlideJson } from "../../slides/tipos";
import { PARA_FINANZAS, type CategoriaFoto, type Foto } from "../../types";
import { claseCampo } from "../componentes";
import { DialogoImagen } from "./DialogoImagen";
import {
  bloqueDeTexto,
  cajaDe,
  encuadreAlPulsar,
  mapaSlide,
  ocurrencia,
  seleccionables,
  textoPulsado,
  type BloquePintado,
  type Caja,
  type ImagenPintada,
} from "./mapa";

export type ModoEdicion = "textos" | "disposicion";

interface Props {
  /** Slide normalizado (logic/edicion.ts) que está pintado en `lienzo`. */
  slide: SlideJson;
  lienzo: HTMLElement;
  modo: ModoEdicion;
  /** Informe abierto: lo que se suba al elegir una imagen se guarda en él. */
  informeId: string;
  trimestre: string;
  alSubirFoto: (f: Foto) => void;
  /** Se ha pulsado «Añadir imagen»: se abre el diálogo y lo elegido entra como un bloque nuevo. */
  anadiendo: boolean;
  alTerminarAnadir: () => void;
  trabajando: boolean;
  aplicar: (nueva: SlideJson, cambio: string) => void;
  avisar: (texto: string) => void;
  /** Abre la lista con todos los textos de la slide (para los que no se localizan con el clic). */
  abrirLista: () => void;
}

/* ------------------------------------------------------------------ geometría */

interface Geometria {
  ancho: number;
  alto: number;
  unidades: { b: BloquePintado; caja: Caja }[];
  imagenes: { im: ImagenPintada; caja: Caja }[];
  contenedores: { nodo: NodoArbol; caja: Caja; hijos: Caja[] }[];
  desajustes: number;
}

interface Destino {
  contenedor: Ruta;
  indice: number;
  /** Columna que es un componente suelto: se convierte en pila antes de soltar. */
  envolver?: Ruta;
  /** Línea que marca dónde va a quedar el bloque. */
  linea: Caja;
  /** Zona en la que soltar equivale a este hueco (el espacio libre bajo el último bloque de una columna). */
  zona?: Caja;
}

type Seleccion = { tipo: "bloque" | "imagen"; ruta: Ruta };

interface Pulso extends Seleccion {
  /** Imagen pulsada cuando lo que se arrastra es su bloque (una imagen suelta). */
  imagen?: Ruta;
  x0: number;
  y0: number;
  x: number;
  y: number;
  arrastrando: boolean;
}

function dentro(c: Caja, x: number, y: number): boolean {
  return x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h;
}

function distancia(c: Caja, x: number, y: number): number {
  const dx = Math.max(c.x - x, 0, x - (c.x + c.w));
  const dy = Math.max(c.y - y, 0, y - (c.y + c.h));
  return Math.hypot(dx, dy);
}

function empiezaPor(ruta: Ruta, prefijo: Ruta): boolean {
  return prefijo.length <= ruta.length && prefijo.every((k, i) => k === ruta[i]);
}

function esPaginaDeFinanzas(idSlide: string): boolean {
  return PARA_FINANZAS.some((p) => p.id === idSlide);
}

/**
 * Categoría con la que se guarda una imagen subida para un hueco: la de
 * portada y las páginas de Finanzas llevan la suya, que es la que busca la
 * generación al rehacer esas slides.
 */
function categoriaDe(grupo: GrupoImagenes, idSlide: string): CategoriaFoto {
  if (grupo.tipo === "Portada") return "Portada";
  if (grupo.tipo === "SlideBloqueado") return esPaginaDeFinanzas(idSlide) ? "Página de Finanzas" : "Otra";
  return grupo.tipo === "MapaLateral" ? "Otra" : "Obra";
}

const NOMBRE_BLOQUE: Record<string, string> = {
  Texto: "Texto",
  Vinetas: "Viñetas",
  Subtitulo: "Subtítulo",
  Galeria: "Galería",
  ImagenMarco: "Imagen",
  Timeline: "Calendario",
  TimelineTrimestral: "Calendario",
  div: "Grupo",
};

/** Huecos en los que se puede soltar el bloque que se arrastra. */
function destinosDe(geo: Geometria, origen: BloquePintado): Destino[] {
  const out: Destino[] = [];
  const GROSOR = 4;
  for (const c of geo.contenedores) {
    const cont = c.nodo.contenedor!;
    // En un envoltorio no se suelta: los bloques van a la pila que lleva dentro.
    if (empiezaPor(cont.ruta, origen.nodo.ruta) || esEnvoltorio(cont)) continue;
    const propio = origen.padre === c.nodo ? cont.hijos.indexOf(origen.nodo) : -1;
    if (cont.orientacion === "pila") {
      for (let i = 0; i <= c.hijos.length; i++) {
        if (propio >= 0 && (i === propio || i === propio + 1)) continue;
        const antes = c.hijos[i - 1];
        const despues = c.hijos[i];
        const y = antes && despues ? (antes.y + antes.h + despues.y) / 2 : antes ? antes.y + antes.h + 4 : despues ? despues.y - 4 : c.caja.y + 4;
        const linea = { x: c.caja.x, y: y - GROSOR / 2, w: Math.max(c.caja.w, 40), h: GROSOR };
        const libre = c.caja.y + c.caja.h - y;
        out.push({ contenedor: cont.ruta, indice: i, linea, zona: i === c.hijos.length && libre > GROSOR ? { ...linea, y, h: libre } : undefined });
      }
      continue;
    }
    // Rejilla: sus columnas se reordenan entre sí, y sobre una columna suelta se puede apilar.
    for (let i = 0; i <= c.hijos.length; i++) {
      if (propio < 0 || i === propio || i === propio + 1) continue;
      const antes = c.hijos[i - 1];
      const despues = c.hijos[i];
      const x = antes && despues ? (antes.x + antes.w + despues.x) / 2 : antes ? antes.x + antes.w + 6 : despues!.x - 6;
      out.push({ contenedor: cont.ruta, indice: i, linea: { x: x - GROSOR / 2, y: c.caja.y, w: GROSOR, h: Math.max(c.caja.h, 40) } });
    }
    cont.hijos.forEach((h, i) => {
      if (h.contenedor || h === origen.nodo || !h.c) return;
      const caja = c.hijos[i]!;
      const hijos = [...h.ruta, "hijos"];
      out.push({ contenedor: hijos, indice: 0, envolver: h.ruta, linea: { x: caja.x, y: caja.y - 6, w: caja.w, h: GROSOR } });
      out.push({ contenedor: hijos, indice: 1, envolver: h.ruta, linea: { x: caja.x, y: caja.y + caja.h + 2, w: caja.w, h: GROSOR } });
    });
  }
  return out;
}

/* ------------------------------------------------------------------ capa */

/**
 * Capa de edición a mano sobre la slide del editor: textos literales (clic
 * sobre el texto) y disposición (seleccionar, mover con botones o arrastrando,
 * columnas e imágenes). No llama a Claude: cada cambio sale como un slide nuevo
 * por `aplicar`.
 */
export function CapaEdicion({
  slide,
  lienzo,
  modo,
  informeId,
  trimestre,
  alSubirFoto,
  anadiendo,
  alTerminarAnadir,
  trabajando,
  aplicar,
  avisar,
  abrirLista,
}: Props) {
  const capa = useRef<HTMLDivElement>(null);
  const titulo = tituloDe(slide);
  // La disposición trabaja sobre la plantilla desplegada: se pinta igual, y lo que se guarde ya es un
  // slide compuesto de este informe. Los textos se editan sobre el slide tal como está.
  const trabajo = useMemo(() => (modo === "disposicion" ? desplegar(slide) : slide), [slide, modo]);
  const arbol = useMemo(() => arbolBloques(trabajo), [trabajo]);

  /* ---------- Textos ---------- */
  const [resalte, setResalte] = useState<Caja | null>(null);
  const [editor, setEditor] = useState<{ caja: Caja; candidatos: CampoTexto[]; elegido: number | null; texto: string } | null>(null);

  useEffect(() => {
    if (modo !== "textos" || slide.id === "indice") return;
    lienzo.style.setProperty("cursor", "text");
    const mover = (e: MouseEvent) => {
      const b = bloqueDeTexto(lienzo, e.target);
      setResalte(b && capa.current ? cajaDe(b, capa.current) : null);
    };
    const salir = () => setResalte(null);
    const pulsar = (e: MouseEvent) => {
      const b = bloqueDeTexto(lienzo, e.target);
      if (!b || !capa.current || trabajando) return;
      e.preventDefault();
      const campos = camposTexto(slide);
      let candidatos = localizarCampo(campos, textoPulsado(e.clientX, e.clientY, b), b.textContent ?? "");
      // Textos repetidos en la slide: el que ocupa el mismo puesto entre los iguales.
      if (candidatos.length > 1 && candidatos.every((c) => sinFormato(c.valor) === sinFormato(candidatos[0]!.valor))) {
        const k = ocurrencia(lienzo, b);
        if (candidatos[k]) candidatos = [candidatos[k]];
      }
      if (!candidatos.length) {
        avisar("Ese texto lo pone la plantilla a partir de otros datos. Búscalo en «Todos los textos» o pide el cambio con «Corregir».");
        abrirLista();
        return;
      }
      setEditor({
        caja: cajaDe(b, capa.current),
        candidatos,
        elegido: candidatos.length === 1 ? 0 : null,
        texto: candidatos.length === 1 ? candidatos[0]!.valor : "",
      });
    };
    lienzo.addEventListener("mousemove", mover);
    lienzo.addEventListener("mouseleave", salir);
    lienzo.addEventListener("click", pulsar);
    return () => {
      lienzo.style.removeProperty("cursor");
      lienzo.removeEventListener("mousemove", mover);
      lienzo.removeEventListener("mouseleave", salir);
      lienzo.removeEventListener("click", pulsar);
    };
  }, [lienzo, slide, modo, trabajando, avisar, abrirLista]);

  function aplicarTexto() {
    if (!editor || editor.elegido == null) return;
    const campo = editor.candidatos[editor.elegido]!;
    setEditor(null);
    setResalte(null);
    if (editor.texto === campo.valor) return;
    aplicar(ponerTexto(slide, campo.ruta, editor.texto), `${titulo}: texto editado a mano`);
  }

  /* ---------- Disposición ---------- */
  const [geo, setGeo] = useState<Geometria | null>(null);
  const [sel, setSel] = useState<Seleccion | null>(null);
  const [pulso, setPulso] = useState<Pulso | null>(null);
  const [fotosAbiertas, setFotosAbiertas] = useState(false);
  const [reencuadrando, setReencuadrando] = useState(false);

  useEffect(() => {
    const c = capa.current;
    if (!c) return;
    // El observador avisa al empezar a observar y en cada cambio de tamaño: ahí se mide.
    const medir = () => {
      if (modo !== "disposicion") {
        setGeo({ ancho: c.clientWidth, alto: c.clientHeight, unidades: [], imagenes: [], contenedores: [], desajustes: 0 });
        return;
      }
      const mapa = mapaSlide(lienzo, trabajo, arbol);
      setGeo({
        ancho: c.clientWidth,
        alto: c.clientHeight,
        unidades: seleccionables(mapa, arbol).map((b) => ({ b, caja: cajaDe(b.el, c) })),
        imagenes: mapa.imagenes.map((im) => ({ im, caja: cajaDe(im.el, c) })),
        contenedores: mapa.contenedores.map((x) => ({
          nodo: x.nodo,
          caja: cajaDe(x.el, c),
          hijos: (Array.from(x.el.children) as HTMLElement[]).map((h) => cajaDe(h, c)),
        })),
        desajustes: mapa.desajustes,
      });
    };
    const ro = new ResizeObserver(medir);
    ro.observe(c);
    return () => ro.disconnect();
  }, [lienzo, trabajo, arbol, modo]);

  const imagen = sel?.tipo === "imagen" ? (geo?.imagenes.find((x) => mismaRuta(x.im.ruta, sel.ruta)) ?? null) : null;
  /** Bloque de una imagen suelta (ImagenMarco): se mueve, se redimensiona y se quita como bloque. */
  const bloqueDe = (im: ImagenPintada) =>
    im.grupo.tipo === "ImagenMarco" ? (geo?.unidades.find((u) => empiezaPor(im.grupo.nodo, u.b.nodo.ruta)) ?? null) : null;
  const unidad =
    sel?.tipo === "bloque" ? (geo?.unidades.find((u) => mismaRuta(u.b.nodo.ruta, sel.ruta)) ?? null) : imagen ? bloqueDe(imagen.im) : null;
  const origenArrastre = pulso?.arrastrando && pulso.tipo === "bloque" ? (geo?.unidades.find((u) => mismaRuta(u.b.nodo.ruta, pulso.ruta)) ?? null) : null;
  const destinos = useMemo(() => (geo && origenArrastre ? destinosDe(geo, origenArrastre.b) : []), [geo, origenArrastre]);
  const destino =
    pulso?.arrastrando && destinos.length
      ? destinos.reduce<{ d: Destino; dist: number } | null>((mejor, d) => {
          const dist = distancia(d.zona ?? d.linea, pulso.x, pulso.y);
          return dist < 90 && (!mejor || dist < mejor.dist) ? { d, dist } : mejor;
        }, null)?.d ?? null
      : null;
  const imagenDestino =
    pulso?.arrastrando && pulso.tipo === "imagen" && geo
      ? (geo.imagenes.find((x) => !mismaRuta(x.im.ruta, pulso.ruta) && dentro(x.caja, pulso.x, pulso.y)) ?? null)
      : null;

  function punto(e: React.PointerEvent): [number, number] {
    const r = capa.current!.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  }

  function alPulsar(e: React.PointerEvent) {
    // Los eventos del diálogo de imagen suben hasta aquí por el árbol de React aunque se pinte fuera.
    if (!geo || trabajando || fotosAbiertas || anadiendo || e.button > 0) return;
    const [x, y] = punto(e);
    const im = geo.imagenes.find((i) => dentro(i.caja, x, y));
    // El bloque más pequeño que contiene el punto.
    const u = geo.unidades.filter((b) => dentro(b.caja, x, y)).sort((a, b) => a.caja.w * a.caja.h - b.caja.w * b.caja.h)[0];
    const nuevo: Seleccion | null = im ? { tipo: "imagen", ruta: im.im.ruta } : u ? { tipo: "bloque", ruta: u.b.nodo.ruta } : null;
    if (!nuevo) {
      setSel(null);
      setReencuadrando(false);
      return;
    }
    if (!(reencuadrando && sel && nuevo.tipo === "imagen" && mismaRuta(nuevo.ruta, sel.ruta))) setReencuadrando(false);
    e.preventDefault();
    capa.current!.setPointerCapture(e.pointerId);
    setSel(nuevo);
    // Una imagen suelta se arrastra como bloque; las de una galería se intercambian entre sí.
    const suelta = im ? bloqueDe(im.im) : null;
    const arrastre: Seleccion = suelta ? { tipo: "bloque", ruta: suelta.b.nodo.ruta } : nuevo;
    setPulso({ ...arrastre, imagen: im?.im.ruta, x0: x, y0: y, x, y, arrastrando: false });
  }

  function alMover(e: React.PointerEvent) {
    if (!pulso) return;
    const [x, y] = punto(e);
    setPulso({ ...pulso, x, y, arrastrando: pulso.arrastrando || (!reencuadrando && Math.hypot(x - pulso.x0, y - pulso.y0) > 6) });
  }

  function alSoltar() {
    const p = pulso;
    setPulso(null);
    if (!p || !geo) return;
    if (p.arrastrando) {
      if (p.tipo === "bloque" && destino) soltar(p.ruta, destino);
      if (p.tipo === "imagen" && imagenDestino) {
        const origen = geo.imagenes.find((x) => mismaRuta(x.im.ruta, p.ruta));
        if (origen && origen.im.grupo.tipo === "Galeria" && mismaRuta(origen.im.grupo.nodo, imagenDestino.im.grupo.nodo)) {
          setSel({ tipo: "imagen", ruta: imagenDestino.im.ruta });
          aplicar(intercambiarFotos(trabajo, p.ruta, imagenDestino.im.ruta), `${titulo}: fotos reordenadas`);
        } else avisar("Las fotos solo se intercambian dentro de la misma galería. Para poner esa imagen en otro hueco, usa «Cambiar imagen».");
      }
      return;
    }
    if (p.imagen && reencuadrando) {
      const im = geo.imagenes.find((x) => mismaRuta(x.im.ruta, p.imagen!));
      if (!im || !(im.im.el instanceof HTMLImageElement)) return;
      const datos = leerRuta(trabajo, im.im.ruta) as { focalX?: number; focalY?: number } | undefined;
      const f = encuadreAlPulsar(im.im.el, (p.x - im.caja.x) / im.caja.w, (p.y - im.caja.y) / im.caja.h, {
        x: datos?.focalX ?? 0.5,
        y: datos?.focalY ?? 0.5,
      });
      aplicar(reencuadrar(trabajo, im.im.ruta, f.x, f.y), `${titulo}: foto reencuadrada`);
    }
  }

  function soltar(origen: Ruta, d: Destino) {
    try {
      let s = trabajo;
      let contenedor = d.contenedor;
      if (d.envolver) {
        const r = columnaComoPila(s, d.envolver);
        s = r.slide;
        contenedor = r.contenedor;
      }
      setSel(null);
      aplicar(moverBloque(s, origen, { contenedor, indice: d.indice }), `${titulo}: bloque movido`);
    } catch (e) {
      avisar(e instanceof Error ? e.message : "Ese bloque no se puede mover ahí.");
    }
  }

  /** Tras mover la unidad seleccionada, la selección la sigue a su nuevo sitio (también si es una imagen suelta). */
  function seguir(anterior: Ruta, nueva: Ruta) {
    if (sel?.tipo === "imagen") setSel({ tipo: "imagen", ruta: [...nueva, ...sel.ruta.slice(anterior.length)] });
    else setSel({ tipo: "bloque", ruta: nueva });
  }

  /** Mueve la unidad seleccionada un puesto en su pila (dy) o a la columna de al lado (dx). */
  function moverSeleccion(dx: number, dy: number) {
    if (!unidad) return;
    const { nodo, padre } = unidad.b;
    const c = padre.contenedor!;
    const i = c.hijos.indexOf(nodo);
    if (dy) {
      seguir(nodo.ruta, [...c.ruta, i + dy]);
      aplicar(moverBloque(trabajo, nodo.ruta, { contenedor: c.ruta, indice: dy < 0 ? i - 1 : i + 2 }), `${titulo}: bloque movido`);
      return;
    }
    const r = rejillaDe(arbol, nodo.ruta);
    if (!r) return;
    const columnas = r.rejilla.contenedor!;
    if (padre === r.rejilla) {
      // El bloque es una columna entera: cambia de sitio con la de al lado.
      seguir(nodo.ruta, [...columnas.ruta, r.columna + dx]);
      aplicar(moverBloque(trabajo, nodo.ruta, { contenedor: columnas.ruta, indice: dx < 0 ? r.columna - 1 : r.columna + 2 }), `${titulo}: columna movida`);
      return;
    }
    const otra = columnas.hijos[r.columna + dx];
    if (!otra) return;
    const pila = pilaInterior(otra);
    soltar(nodo.ruta, pila ? { contenedor: pila.ruta, indice: pila.hijos.length, linea: unidad.caja } : { contenedor: [...otra.ruta, "hijos"], indice: 1, envolver: otra.ruta, linea: unidad.caja });
  }

  /**
   * Dónde entra una imagen nueva: debajo del bloque seleccionado o, si no hay
   * ninguno, al final de la columna con más hueco. Con el tamaño que cabe ahí,
   * en unidades de slide.
   */
  function sitioParaImagen(): { slide: SlideJson; contenedor: Ruta; indice: number; ancho: number; alto: number } | null {
    if (!geo || !arbol) return null;
    const k = geo.ancho / 960;
    const medida = (caja: Caja, libre: number) => {
      const ancho = Math.max(120, Math.round(caja.w / k));
      const cabe = libre / k - 14;
      const alto = Math.round(Math.max(90, Math.min(260, ancho * 0.6, cabe >= 90 ? cabe : 260)));
      return { ancho, alto };
    };
    const libreEn = (c: Geometria["contenedores"][number]) => {
      const ultimo = c.hijos[c.hijos.length - 1];
      return c.caja.y + c.caja.h - (ultimo ? ultimo.y + ultimo.h : c.caja.y);
    };
    const pilas = geo.contenedores.filter((c) => c.nodo.contenedor!.orientacion === "pila" && !esEnvoltorio(c.nodo.contenedor!));
    const propia = unidad ? pilas.find((c) => c.nodo === unidad.b.padre) : null;
    if (unidad && propia) {
      const i = propia.nodo.contenedor!.hijos.indexOf(unidad.b.nodo);
      return { slide: trabajo, contenedor: propia.nodo.contenedor!.ruta, indice: i + 1, ...medida(propia.caja, libreEn(propia)) };
    }
    const mejor = [...pilas].sort((a, b) => libreEn(b) - libreEn(a))[0];
    if (mejor) return { slide: trabajo, contenedor: mejor.nodo.contenedor!.ruta, indice: mejor.nodo.contenedor!.hijos.length, ...medida(mejor.caja, libreEn(mejor)) };
    // Solo hay columnas que son un componente suelto: la imagen se apila bajo la que tenga más hueco.
    let candidata: { ruta: Ruta; caja: Caja; libre: number } | null = null;
    for (const c of geo.contenedores) {
      c.nodo.contenedor!.hijos.forEach((h, i) => {
        const caja = c.hijos[i]!;
        const libre = c.caja.y + c.caja.h - (caja.y + caja.h);
        if (!h.contenedor && h.c && (!candidata || libre > candidata.libre)) candidata = { ruta: h.ruta, caja, libre };
      });
    }
    const elegida = candidata as { ruta: Ruta; caja: Caja; libre: number } | null;
    if (!elegida) return null;
    const r = columnaComoPila(trabajo, elegida.ruta);
    return { slide: r.slide, contenedor: r.contenedor, indice: 1, ...medida(elegida.caja, elegida.libre) };
  }

  function anadirImagen(src: string) {
    alTerminarAnadir();
    const sitio = sitioParaImagen();
    if (!sitio) {
      avisar("La plantilla de esta slide no admite imágenes nuevas. Pide el cambio con «Corregir» adjuntando la imagen.");
      return;
    }
    setSel({ tipo: "imagen", ruta: [...sitio.contenedor, sitio.indice, "props"] });
    aplicar(
      insertarBloque(sitio.slide, { contenedor: sitio.contenedor, indice: sitio.indice }, nodoImagen(src, sitio.ancho, sitio.alto)),
      `${titulo}: imagen añadida`,
    );
  }

  function abrirImagen(im: ImagenPintada) {
    setSel({ tipo: "imagen", ruta: im.ruta });
    setReencuadrando(false);
    setFotosAbiertas(true);
  }

  const rejilla = unidad ? rejillaDe(arbol, unidad.b.nodo.ruta) : null;
  const pila = unidad?.b.padre.contenedor;
  const indice = unidad && pila ? pila.hijos.indexOf(unidad.b.nodo) : -1;
  const enPila = pila?.orientacion === "pila";
  const columnas = rejilla?.rejilla.contenedor ?? null;
  const otraColumna = (dx: number) => {
    if (!rejilla || !columnas) return false;
    const otra = columnas.hijos[rejilla.columna + dx];
    return !!otra && (unidad?.b.padre === rejilla.rejilla || otra.contenedor?.orientacion !== "columnas");
  };
  const srcElegida = imagen ? srcDeImagen(trabajo, imagen.im.grupo, imagen.im.ruta) : null;
  const altoElegida = imagen?.im.grupo.tipo === "ImagenMarco" ? ((leerRuta(trabajo, [...imagen.im.grupo.nodo, "props", "alto"]) as number | undefined) ?? 200) : null;

  const boton = "rounded border border-subtle bg-card px-1.5 py-0.5 text-xs font-medium text-text-primary hover:bg-page disabled:opacity-40";
  const barra = "absolute z-20 flex flex-wrap items-center gap-1 rounded-md border border-subtle bg-card px-1.5 py-1 text-xs shadow-md";

  /** Sitio de una barra flotante: encima de la caja si cabe y, si no, dentro, arriba. */
  function sobre(c: Caja, ancho: number): React.CSSProperties {
    const W = geo?.ancho ?? 0;
    return { left: Math.max(4, Math.min(c.x, W - ancho - 4)), top: c.y >= 34 ? c.y - 32 : c.y + 4, maxWidth: W - 8 };
  }

  /** Flechas para mover la unidad seleccionada (un bloque o una imagen suelta). */
  const flechas = unidad ? (
    <>
      {enPila ? (
        <>
          <button type="button" className={boton} aria-label="Subir bloque" disabled={trabajando || indice <= 0} onClick={() => moverSeleccion(0, -1)}>
            ↑
          </button>
          <button type="button" className={boton} aria-label="Bajar bloque" disabled={trabajando || indice >= (pila?.hijos.length ?? 0) - 1} onClick={() => moverSeleccion(0, 1)}>
            ↓
          </button>
        </>
      ) : null}
      {rejilla ? (
        <>
          <button type="button" className={boton} aria-label="Pasar a la columna de la izquierda" disabled={trabajando || !otraColumna(-1)} onClick={() => moverSeleccion(-1, 0)}>
            ←
          </button>
          <button type="button" className={boton} aria-label="Pasar a la columna de la derecha" disabled={trabajando || !otraColumna(1)} onClick={() => moverSeleccion(1, 0)}>
            →
          </button>
        </>
      ) : null}
    </>
  ) : null;

  return (
    <div
      ref={capa}
      className={`absolute inset-0 ${modo === "disposicion" ? "touch-none select-none" : "pointer-events-none"}`}
      onPointerDown={modo === "disposicion" ? alPulsar : undefined}
      onPointerMove={modo === "disposicion" ? alMover : undefined}
      onPointerUp={modo === "disposicion" ? alSoltar : undefined}
      onPointerCancel={modo === "disposicion" ? () => setPulso(null) : undefined}
      onDoubleClick={
        modo === "disposicion"
          ? (e) => {
              // Doble clic sobre una imagen o un hueco vacío: directamente a elegir imagen.
              if (!geo || trabajando || fotosAbiertas || anadiendo) return;
              const r = e.currentTarget.getBoundingClientRect();
              const im = geo.imagenes.find((i) => dentro(i.caja, e.clientX - r.left, e.clientY - r.top));
              if (im) abrirImagen(im.im);
            }
          : undefined
      }
    >
      {modo === "textos" ? (
        <>
          {slide.id === "indice" ? (
            <p className="absolute left-2 top-2 rounded-md border border-subtle bg-card px-2 py-1 text-xs text-text-muted shadow-sm">
              El índice se rehace solo a partir de las secciones del informe.
            </p>
          ) : null}
          {resalte && !editor ? (
            <div
              className="absolute rounded-sm outline outline-2 outline-icam-900/60"
              style={{ left: resalte.x - 2, top: resalte.y - 2, width: resalte.w + 4, height: resalte.h + 4 }}
            />
          ) : null}
          {editor ? (
            <CuadroTexto
              editor={editor}
              ancho={geo?.ancho ?? 0}
              alto={geo?.alto ?? 0}
              onElegir={(i) => setEditor({ ...editor, elegido: i, texto: editor.candidatos[i]!.valor })}
              onTexto={(t) => setEditor({ ...editor, texto: t })}
              onAplicar={aplicarTexto}
              onCancelar={() => setEditor(null)}
            />
          ) : null}
        </>
      ) : geo ? (
        <>
          {geo.unidades.map(({ b, caja }) => {
            const elegida = unidad?.b === b;
            return (
              <div
                key={b.nodo.ruta.join("/")}
                className={`absolute rounded-sm ${elegida ? "outline outline-2 outline-icam-900" : "outline-dashed outline-1 outline-icam-900/35"} ${
                  pulso?.arrastrando && elegida ? "bg-icam-900/10" : ""
                } cursor-grab`}
                style={{ left: caja.x - 2, top: caja.y - 2, width: caja.w + 4, height: caja.h + 4 }}
              />
            );
          })}
          {geo.imagenes.map(({ im, caja }) => {
            const elegida = imagen?.im === im;
            const vacia = !srcDeImagen(trabajo, im.grupo, im.ruta);
            return (
              <div
                key={"im" + im.ruta.join("/")}
                className={`absolute ${elegida ? "outline outline-2 outline-amber-500" : "outline-dashed outline-1 outline-amber-500/70"} ${
                  imagenDestino?.im === im ? "bg-amber-400/30" : ""
                } ${elegida && reencuadrando ? "cursor-crosshair" : "cursor-pointer"}`}
                style={{ left: caja.x, top: caja.y, width: caja.w, height: caja.h }}
              >
                {/* Siempre a la vista: es la forma de subir o cambiar la imagen de este hueco. */}
                {pulso?.arrastrando || (elegida && reencuadrando) ? null : (
                  <button
                    type="button"
                    className="absolute right-1 top-1 rounded bg-icam-900/90 px-1.5 py-0.5 text-[11px] font-medium text-white shadow hover:bg-icam-900 disabled:opacity-40"
                    disabled={trabajando}
                    onPointerDown={(e) => e.stopPropagation()}
                    onDoubleClick={(e) => e.stopPropagation()}
                    onClick={() => abrirImagen(im)}
                  >
                    {vacia ? "＋ Poner imagen" : "Cambiar imagen"}
                  </button>
                )}
              </div>
            );
          })}
          {destino ? (
            <div className="absolute rounded-full bg-icam-900" style={{ left: destino.linea.x, top: destino.linea.y, width: destino.linea.w, height: destino.linea.h }} />
          ) : null}
          {pulso?.arrastrando ? (
            <div
              className="pointer-events-none absolute z-30 whitespace-nowrap rounded bg-icam-900 px-2 py-0.5 text-xs font-medium text-white shadow"
              style={{ left: pulso.x + 14, top: pulso.y + 14 }}
            >
              {pulso.tipo === "imagen"
                ? imagenDestino
                  ? "Intercambiar con esta foto"
                  : "Suelta sobre otra foto de la galería"
                : destino
                  ? "Soltar aquí"
                  : "Lleva el bloque a un hueco"}
            </div>
          ) : null}

          {unidad && !imagen && !pulso?.arrastrando ? (
            <div className={barra} style={sobre(unidad.caja, 330)} onPointerDown={(e) => e.stopPropagation()}>
              <span className="px-1 font-medium text-text-muted">{NOMBRE_BLOQUE[unidad.b.nodo.c ?? ""] ?? unidad.b.nodo.c}</span>
              {flechas}
              {rejilla ? (
                <>
                  <button
                    type="button"
                    className={boton}
                    disabled={trabajando}
                    onClick={() => {
                      setSel(null);
                      aplicar(intercambiarColumnas(trabajo, columnas!.ruta), `${titulo}: columnas intercambiadas`);
                    }}
                  >
                    Intercambiar columnas
                  </button>
                  {columnas!.hijos.length === 2 && admiteProporcion(trabajo, columnas!.ruta) ? (
                    <select
                      className="rounded border border-subtle bg-card px-1 py-0.5 text-xs"
                      aria-label="Ancho de las columnas"
                      disabled={trabajando}
                      value={proporcionActual(trabajo, columnas!.ruta)}
                      onChange={(e) => aplicar(proporcionColumnas(trabajo, columnas!.ruta, e.target.value), `${titulo}: ancho de columnas`)}
                    >
                      {PROPORCIONES.some((p) => p.valor === proporcionActual(trabajo, columnas!.ruta)) ? null : (
                        <option value={proporcionActual(trabajo, columnas!.ruta)}>A medida</option>
                      )}
                      {PROPORCIONES.map((p) => (
                        <option key={p.valor} value={p.valor}>
                          {p.nombre}
                        </option>
                      ))}
                    </select>
                  ) : null}
                </>
              ) : null}
            </div>
          ) : null}

          {imagen && !pulso?.arrastrando ? (
            <div className={barra} style={sobre(imagen.caja, 420)} onPointerDown={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
              <button type="button" className={boton} disabled={trabajando} onClick={() => setFotosAbiertas(true)}>
                {srcElegida ? "Cambiar imagen" : "Poner imagen"}
              </button>
              <button
                type="button"
                className={`${boton} ${reencuadrando ? "!border-amber-500 !bg-amber-100" : ""}`}
                aria-pressed={reencuadrando}
                disabled={trabajando || !imagen.im.grupo.objetos || !(imagen.im.el instanceof HTMLImageElement)}
                title={
                  imagen.im.grupo.objetos
                    ? "Pulsa sobre la foto lo que quieres que quede en el centro"
                    : "La plantilla de este hueco no admite reencuadre: recorta la imagen antes de subirla"
                }
                onClick={() => setReencuadrando(!reencuadrando)}
              >
                Reencuadrar
              </button>
              {imagen.im.grupo.tipo === "Galeria" ? (
                <select
                  className="rounded border border-subtle bg-card px-1 py-0.5 text-xs"
                  aria-label="Disposición de la galería"
                  disabled={trabajando}
                  value={String((leerRuta(trabajo, [...imagen.im.grupo.nodo, "props", "disposicion"]) as string | undefined) ?? "4")}
                  onChange={(e) => {
                    setSel(null);
                    aplicar(disposicionGaleria(trabajo, imagen.im.grupo.nodo, e.target.value), `${titulo}: disposición de la galería`);
                  }}
                >
                  {DISPOSICIONES_GALERIA.map((d) => (
                    <option key={d.valor} value={d.valor}>
                      {d.nombre}
                    </option>
                  ))}
                </select>
              ) : null}
              {altoElegida != null ? (
                <>
                  <button
                    type="button"
                    className={boton}
                    aria-label="Imagen más pequeña"
                    disabled={trabajando || altoElegida <= ALTO_IMAGEN.min}
                    onClick={() => aplicar(altoDeImagen(trabajo, imagen.im.grupo.nodo, -ALTO_IMAGEN.paso), `${titulo}: tamaño de la imagen`)}
                  >
                    −
                  </button>
                  <button
                    type="button"
                    className={boton}
                    aria-label="Imagen más grande"
                    disabled={trabajando || altoElegida >= ALTO_IMAGEN.max}
                    onClick={() => aplicar(altoDeImagen(trabajo, imagen.im.grupo.nodo, ALTO_IMAGEN.paso), `${titulo}: tamaño de la imagen`)}
                  >
                    +
                  </button>
                </>
              ) : null}
              {flechas}
              {imagen.im.grupo.tipo === "ImagenMarco" || imagen.im.grupo.tipo === "Galeria" ? (
                <button
                  type="button"
                  className={boton}
                  // Solo se quita lo que es un elemento de una lista de bloques.
                  disabled={trabajando || typeof imagen.im.grupo.nodo[imagen.im.grupo.nodo.length - 1] !== "number"}
                  onClick={() => {
                    setSel(null);
                    aplicar(quitarBloque(trabajo, imagen.im.grupo.nodo), `${titulo}: ${imagen.im.grupo.tipo === "Galeria" ? "galería quitada" : "imagen quitada"}`);
                  }}
                >
                  {imagen.im.grupo.tipo === "Galeria" ? "Quitar galería" : "Quitar"}
                </button>
              ) : null}
              {imagen.im.grupo.tipo !== "ImagenMarco" && srcElegida ? (
                <button
                  type="button"
                  className={boton}
                  disabled={trabajando}
                  onClick={() => aplicar(vaciarFoto(trabajo, imagen.im.grupo, imagen.im.ruta), `${titulo}: imagen quitada`)}
                >
                  Vaciar hueco
                </button>
              ) : null}
              {reencuadrando ? <span className="text-text-muted">Pulsa en la foto el punto que debe quedar centrado.</span> : null}
            </div>
          ) : null}

          {imagen && fotosAbiertas ? (
            <DialogoImagen
              titulo={srcElegida ? "Cambiar imagen" : "Elegir imagen"}
              informeId={informeId}
              trimestre={trimestre}
              actual={srcElegida}
              categoria={categoriaDe(imagen.im.grupo, slide.id)}
              para={imagen.im.grupo.tipo === "SlideBloqueado" && esPaginaDeFinanzas(slide.id) ? slide.id : null}
              onSubida={alSubirFoto}
              onCerrar={() => setFotosAbiertas(false)}
              onElegir={(src) => {
                setFotosAbiertas(false);
                aplicar(cambiarFoto(trabajo, imagen.im.grupo, imagen.im.ruta, src), `${titulo}: imagen cambiada`);
              }}
            />
          ) : null}
          {anadiendo ? (
            <DialogoImagen
              titulo="Añadir imagen"
              informeId={informeId}
              trimestre={trimestre}
              actual={null}
              categoria="Obra"
              onSubida={alSubirFoto}
              onCerrar={alTerminarAnadir}
              onElegir={anadirImagen}
            />
          ) : null}

          {!arbol || geo.desajustes ? (
            <p className="pointer-events-none absolute left-2 top-2 max-w-[60%] rounded-md border border-subtle bg-card px-2 py-1 text-xs text-text-muted shadow-sm">
              {!arbol
                ? "La plantilla de esta slide no tiene bloques que mover: se cambian sus textos y sus imágenes."
                : "Parte de esta slide no se puede reordenar a mano: pide ese cambio con «Corregir»."}
            </p>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ cuadro de texto */

function CuadroTexto({
  editor,
  ancho,
  alto,
  onElegir,
  onTexto,
  onAplicar,
  onCancelar,
}: {
  editor: { caja: Caja; candidatos: CampoTexto[]; elegido: number | null; texto: string };
  ancho: number;
  alto: number;
  onElegir: (i: number) => void;
  onTexto: (t: string) => void;
  onAplicar: () => void;
  onCancelar: () => void;
}) {
  const w = Math.max(300, Math.min(560, editor.caja.w + 24, ancho - 16));
  const h = editor.elegido == null ? 60 + editor.candidatos.length * 30 : 190;
  const debajo = editor.caja.y + editor.caja.h + 6;
  const top = debajo + h <= alto - 4 ? debajo : Math.max(4, editor.caja.y - h - 6);
  const left = Math.max(8, Math.min(editor.caja.x - 12, ancho - w - 8));
  return (
    <div
      className="pointer-events-auto absolute z-20 flex flex-col gap-2 rounded-md border border-subtle bg-card p-2.5 text-sm shadow-lg"
      style={{ left, top, width: w }}
      role="dialog"
      aria-label="Editar texto"
    >
      {editor.elegido == null ? (
        <>
          <p className="text-xs text-text-muted">Ese texto se compone de varios datos. ¿Cuál quieres cambiar?</p>
          {editor.candidatos.map((c, i) => (
            <button key={c.ruta.join("/")} type="button" className="rounded border border-subtle px-2 py-1 text-left text-xs hover:bg-page" onClick={() => onElegir(i)}>
              <b>{etiquetaRuta(c.ruta)}</b> · {c.valor.length > 70 ? c.valor.slice(0, 67) + "…" : c.valor}
            </button>
          ))}
          <button type="button" className="self-start text-xs font-medium text-icam-900 hover:underline" onClick={onCancelar}>
            Cancelar
          </button>
        </>
      ) : (
        <>
          <textarea
            className={`${claseCampo} min-h-[96px] leading-normal`}
            autoFocus
            value={editor.texto}
            aria-label="Texto"
            onChange={(e) => onTexto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) onAplicar();
              if (e.key === "Escape") onCancelar();
            }}
          />
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="rounded-md bg-icam-900 px-3 py-1 text-xs font-medium text-white hover:bg-icam-800" onClick={onAplicar}>
              Aplicar
            </button>
            <button type="button" className="rounded-md border border-subtle px-3 py-1 text-xs font-medium hover:bg-page" onClick={onCancelar}>
              Cancelar
            </button>
            <span className="text-xs text-text-muted">Negrita: **así**. Una línea en blanco separa párrafos. Ctrl+Intro aplica.</span>
          </div>
        </>
      )}
    </div>
  );
}
