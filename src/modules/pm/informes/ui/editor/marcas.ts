"use client";

import { contenedorOculto, airear, pintar } from "../../slides/motor";
import type { MetaInforme, SlideJson } from "../../slides/tipos";

/**
 * Marcas sobre una slide para pedir una corrección: resaltar, subrayar,
 * recuadro y lápiz. Coordenadas en píxeles de slide (960 × 540). Port de las
 * funciones de marcas de app-equipo/src/app.html.
 */

export const ANCHO = 960;
export const ALTO = 540;
const ROJO = "#d42a1f";

export type Herramienta = "resaltar" | "subrayar" | "recuadro" | "lapiz";

export const HERRAMIENTAS: { id: Herramienta; nombre: string; ayuda: string }[] = [
  { id: "resaltar", nombre: "Resaltar", ayuda: "Pinta encima del texto o la zona, como un rotulador fluorescente" },
  { id: "subrayar", nombre: "Subrayar", ayuda: "Arrastra una línea recta bajo el texto" },
  { id: "recuadro", nombre: "Recuadro", ayuda: "Arrastra para encerrar una zona (tabla, gráfico, foto, bloque)" },
  { id: "lapiz", nombre: "Lápiz", ayuda: "Dibujo libre: rodea, tacha o señala con flechas" },
];

export const NOMBRE_MARCA: Record<Herramienta, string> = {
  resaltar: "resaltado",
  subrayar: "subrayado",
  recuadro: "recuadro",
  lapiz: "trazo a mano",
};

export type Punto = [number, number];

export interface Marca {
  tipo: Herramienta;
  puntos: Punto[];
  textos?: { texto: string; marcado: string }[];
  imagenes?: string[];
}

interface Caja {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export function cajaMarca(m: Marca): Caja {
  const xs = m.puntos.map((p) => p[0]);
  const ys = m.puntos.map((p) => p[1]);
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
}

/** Dibuja una marca en un contexto cuya unidad es el píxel de slide. */
export function trazarMarca(ctx: CanvasRenderingContext2D, m: Marca, n?: number) {
  const p = m.puntos;
  if (!p.length) return;
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (m.tipo === "recuadro") {
    const b = cajaMarca(m);
    ctx.strokeStyle = ROJO;
    ctx.lineWidth = 2.5;
    ctx.fillStyle = "rgba(212,42,31,.06)";
    ctx.fillRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
    ctx.strokeRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
  } else {
    ctx.strokeStyle = m.tipo === "resaltar" ? "rgba(255,205,0,.45)" : ROJO;
    ctx.lineWidth = m.tipo === "resaltar" ? 16 : m.tipo === "subrayar" ? 3 : 2.5;
    ctx.beginPath();
    ctx.moveTo(p[0]![0], p[0]![1]);
    if (p.length === 1) ctx.lineTo(p[0]![0] + 0.1, p[0]![1]);
    for (let i = 1; i < p.length; i++) ctx.lineTo(p[i]![0], p[i]![1]);
    ctx.stroke();
  }
  if (n) {
    // Recuadro: en la esquina; trazos: a la izquierda, para no tapar el texto marcado.
    const b = cajaMarca(m);
    const rq = m.tipo === "recuadro";
    const x = Math.max(11, Math.min(ANCHO - 11, rq ? b.x0 - 4 : b.x0 - 16));
    const y = Math.max(11, Math.min(ALTO - 11, rq ? b.y0 - 4 : m.tipo === "subrayar" ? b.y0 - 7 : (b.y0 + b.y1) / 2));
    ctx.fillStyle = ROJO;
    ctx.beginPath();
    ctx.arc(x, y, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = "bold 12px Lato, Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(n), x, y + 0.5);
  }
  ctx.restore();
}

/** Zonas (en px de slide) que cubre una marca, para saber qué texto hay debajo. */
function zonasMarca(m: Marca): Caja[] {
  const p = m.puntos;
  const b = cajaMarca(m);
  if (m.tipo === "recuadro") return [b];
  if (m.tipo === "lapiz") {
    const diag = Math.hypot(b.x1 - b.x0, b.y1 - b.y0);
    const cierre = Math.hypot(p[0]![0] - p[p.length - 1]![0], p[0]![1] - p[p.length - 1]![1]);
    if (b.x1 - b.x0 > 20 && b.y1 - b.y0 > 14 && cierre < diag * 0.3) return [b]; // rodea algo: vale todo lo de dentro
  }
  let pts = p;
  if (m.tipo === "subrayar") {
    pts = [];
    const L = Math.hypot(p[1]![0] - p[0]![0], p[1]![1] - p[0]![1]);
    const n = Math.max(1, Math.ceil(L / 6));
    for (let i = 0; i <= n; i++) pts.push([p[0]![0] + ((p[1]![0] - p[0]![0]) * i) / n, p[0]![1] + ((p[1]![1] - p[0]![1]) * i) / n]);
  }
  return pts.map((q) => {
    if (m.tipo === "subrayar") return { x0: q[0] - 3, y0: q[1] - 20, x1: q[0] + 3, y1: q[1] + 4 }; // el texto queda justo encima
    const r = m.tipo === "resaltar" ? 9 : 7;
    return { x0: q[0] - r, y0: q[1] - r, x1: q[0] + r, y1: q[1] + r };
  });
}

function corta(a: Caja, b: Caja) {
  return a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
}

/** Texto e imágenes de la slide pintada (`lienzo`) que quedan bajo la marca. */
export function contenidoBajo(lienzo: HTMLElement, m: Marca): { textos: { texto: string; marcado: string }[]; imagenes: string[] } {
  const base = lienzo.getBoundingClientRect();
  const k = base.width / ANCHO;
  const zonas = zonasMarca(m);
  const aSlide = (rc: DOMRect): Caja => ({
    x0: (rc.left - base.left) / k,
    y0: (rc.top - base.top) / k,
    x1: (rc.right - base.left) / k,
    y1: (rc.bottom - base.top) / k,
  });
  const toca = (rc: DOMRect) => !!rc.width && !!rc.height && zonas.some((z) => corta(z, aSlide(rc)));
  const textos: { texto: string; marcado: string }[] = [];
  const w = document.createTreeWalker(lienzo, NodeFilter.SHOW_TEXT);
  const rango = document.createRange();
  let nodo: Node | null;
  while ((nodo = w.nextNode())) {
    const t = nodo.nodeValue ?? "";
    if (!t.trim()) continue;
    rango.selectNodeContents(nodo);
    if (!Array.from(rango.getClientRects()).some(toca)) continue;
    const completo = t.replace(/\s+/g, " ").trim();
    let marcado = completo;
    if (completo.length > 60) {
      // Párrafo largo: se queda con las palabras marcadas.
      const re = /\S+/g;
      let x: RegExpExecArray | null;
      let ini = -1;
      let fin = -1;
      while ((x = re.exec(t))) {
        rango.setStart(nodo, x.index);
        rango.setEnd(nodo, x.index + x[0].length);
        if (Array.from(rango.getClientRects()).some(toca)) {
          if (ini < 0) ini = x.index;
          fin = x.index + x[0].length;
        }
      }
      if (ini >= 0) marcado = t.slice(ini, fin).replace(/\s+/g, " ").trim();
    }
    if (!textos.some((y) => y.texto === completo && y.marcado === marcado)) textos.push({ texto: completo, marcado });
  }
  const imagenes = Array.from(lienzo.querySelectorAll("img"))
    .filter((im) => toca(im.getBoundingClientRect()))
    .map((im) => im.getAttribute("src") ?? "");
  return { textos: textos.slice(0, 12), imagenes: imagenes.slice(0, 4) };
}

function zonaTexto(m: Marca): string {
  const b = cajaMarca(m);
  const cx = (b.x0 + b.x1) / 2 / ANCHO;
  const cy = (b.y0 + b.y1) / 2 / ALTO;
  return (
    (cy < 0.33 ? "arriba" : cy < 0.66 ? "centro" : "abajo") +
    "-" +
    (cx < 0.33 ? "izquierda" : cx < 0.66 ? "centro" : "derecha") +
    ` (x ${Math.round((b.x0 / ANCHO) * 100)}–${Math.round((b.x1 / ANCHO) * 100)} %, y ${Math.round((b.y0 / ALTO) * 100)}–${Math.round((b.y1 / ALTO) * 100)} % del slide)`
  );
}

/** Descripción de las marcas para el prompt de corrección. */
export function marcasTexto(ms: Marca[], conImagen: boolean): string {
  if (!ms.length) return "";
  return (
    "== MARCAS DEL EQUIPO SOBRE EL SLIDE ==\n" +
    "El equipo ha marcado sobre el slide pintado las partes que quiere cambiar (numeradas; la instrucción puede citarlas por su número). " +
    "La corrección se refiere a lo MARCADO: localiza en el JSON los textos o elementos indicados y cámbialos; no toques lo no marcado salvo que la instrucción lo pida o haga falta para que el slide quepa. " +
    "Si una marca rodea o recuadra un bloque entero (tabla, gráfico, foto, lista), la instrucción se aplica a ese bloque." +
    (conImagen
      ? " La PRIMERA imagen adjunta es la captura del slide con las marcas dibujadas (rojo = recuadro, subrayado o trazo; amarillo = resaltado), con su número en un círculo rojo."
      : "") +
    "\n" +
    ms
      .map((m, i) => {
        let l = `Marca ${i + 1} · ${NOMBRE_MARCA[m.tipo]} · zona ${zonaTexto(m)}`;
        if (m.textos?.length) {
          l +=
            "\n  Texto bajo la marca: " +
            m.textos
              .map((x) => (x.marcado !== x.texto ? `«${x.marcado}» (dentro de «${x.texto.length > 300 ? x.texto.slice(0, 300) + "…" : x.texto}»)` : `«${x.texto}»`))
              .join(" | ");
        }
        if (m.imagenes?.length) l += "\n  Imágenes bajo la marca: " + m.imagenes.map((s) => `src "${s}"`).join(", ");
        if (!m.textos?.length && !m.imagenes?.length) l += "\n  (zona sin texto: espacio vacío o elemento gráfico; úsala como ubicación)";
        return l;
      })
      .join("\n")
  );
}

/** Captura del slide (pintado aparte, sin escala, sin sello de bloqueo) con las marcas encima, en JPEG. */
export async function capturaMarcada(s: SlideJson, pagina: number, meta: MetaInforme, ms: Marca[]): Promise<Blob> {
  const { default: html2canvas } = await import("html2canvas-pro");
  const el = document.createElement("div");
  el.className = "iq-lienzo";
  contenedorOculto().appendChild(el);
  const raiz = pintar(el, s, pagina, meta);
  try {
    try {
      airear(el);
    } catch {
      // Se captura tal cual.
    }
    await Promise.all(
      Array.from(el.querySelectorAll("img")).map((im) =>
        im.complete ? null : new Promise((ok) => ((im.onload = ok), (im.onerror = ok))),
      ),
    );
    const cv = await html2canvas(el, { scale: 1.5, backgroundColor: "#ffffff", useCORS: true, logging: false });
    const out = document.createElement("canvas");
    out.width = ANCHO * 1.5;
    out.height = ALTO * 1.5;
    const ctx = out.getContext("2d")!;
    ctx.drawImage(cv, 0, 0, out.width, out.height);
    ctx.setTransform(1.5, 0, 0, 1.5, 0, 0);
    ms.forEach((m, i) => trazarMarca(ctx, m, i + 1));
    return await new Promise<Blob>((ok, ko) => out.toBlob((b) => (b ? ok(b) : ko(new Error("captura vacía"))), "image/jpeg", 0.88));
  } finally {
    raiz.root.unmount();
    el.remove();
  }
}
