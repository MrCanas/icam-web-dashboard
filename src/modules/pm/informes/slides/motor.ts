"use client";

import { createElement } from "react";
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";

import { elemento } from "./elemento";
import type { Medida, MetaInforme, SlideJson } from "./tipos";

/**
 * Motor de pintado y medición de slides, en el navegador. Port de
 * templates/motor.js del skill `informe-trimestral`: misma lógica y mismas
 * constantes, para que el relleno que se mide aquí sea el de los informes que
 * ya se aprobaron con el visor.
 */

export interface RaizSlide {
  root: Root;
  error?: string;
}

/** Pinta un slide de forma síncrona (para poder medirlo justo después). */
export function pintar(esc: HTMLElement, s: SlideJson, pagina: number, meta: MetaInforme | null | undefined, raiz?: RaizSlide): RaizSlide {
  let r: RaizSlide = raiz ?? { root: createRoot(esc) };
  try {
    flushSync(() => r.root.render(elemento(s, pagina, meta)));
  } catch (e) {
    r.root.unmount();
    esc.innerHTML = "";
    r = { root: createRoot(esc) };
    const msg = "Error en el slide «" + s.id + "»: " + (e instanceof Error ? e.message : String(e));
    flushSync(() =>
      r.root.render(createElement("div", { style: { padding: 40, font: "14px Lato, sans-serif", color: "#b00" } }, msg)),
    );
    r.error = msg;
  }
  return r;
}

/** Resalta «[pendiente: …]». Devuelve cuántos hay. */
export function marcarPendientes(esc: HTMLElement): number {
  const w = document.createTreeWalker(esc, NodeFilter.SHOW_TEXT);
  const nodos: Text[] = [];
  let t: Node | null;
  while ((t = w.nextNode())) if (/\[pendiente[^\]]*\]/i.test(t.nodeValue ?? "")) nodos.push(t as Text);
  nodos.forEach((n) => {
    const span = document.createElement("span");
    span.innerHTML = (n.nodeValue ?? "")
      .replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c] as string)
      .replace(/\[pendiente[^\]]*\]/gi, (m) => '<mark class="v-pend">' + m + "</mark>");
    n.parentNode?.replaceChild(span, n);
  });
  return nodos.length;
}

/* ---------- Aireado: reparte el hueco libre entre las partes de cada slide sin tocar el cuerpo de letra ----------
   Todas las medidas en unidades del lienzo (960 × 540). Orden: huecos entre partes → espacio entre párrafos y
   viñetas → alto de filas de tabla. Si el contenido desborda, no airea y lo marca. */
const ATOMICAS = [
  "iq-texto",
  "iq-vinetas",
  "iq-timeline",
  "iq-galeria",
  "iq-fichas",
  "iq-kpi-iconos",
  "iq-bloque-icono",
  "iq-colab-rol",
  "iq-mapa-lateral",
  "iq-breeam",
  "iq-consol",
  "iq-barras",
  "iq-tlq",
  "iq-donut",
  "iq-cols",
  "iq-figura",
];
const TOPE_HUECO = 36;
const TOPE_HUECO_POCOS = 56;
const TOPE_PARRAFO = 6;
const TOPE_CELDA = 4;
const HOLGURA = 4;

function esTitulo(el: Element) {
  return el.classList.contains("iq-sub") || el.classList.contains("iq-sub2");
}
function esAtomica(el: Element) {
  if (el.tagName !== "DIV" && el.tagName !== "SECTION") return true;
  return ATOMICAS.some((c) => el.classList.contains(c));
}
function partes(cont: Element): HTMLElement[] {
  let out: HTMLElement[] = [];
  Array.prototype.forEach.call(cont.children, (el: HTMLElement) => {
    if (!el.offsetHeight || getComputedStyle(el).position === "absolute") return;
    if (esTitulo(el) || esAtomica(el)) out.push(el);
    else out = out.concat(partes(el));
  });
  return out;
}
// Un subtítulo, o un texto que termina en «:», va pegado a lo que le sigue.
function introduce(el: Element) {
  return esTitulo(el) || (el.classList.contains("iq-texto") && /:\s*$/.test(el.textContent ?? ""));
}
function grupos(ps: HTMLElement[]): HTMLElement[][] {
  const gs: HTMLElement[][] = [];
  ps.forEach((p, i) => {
    if (i === 0 || !introduce(ps[i - 1]!)) gs.push([p]);
    else gs[gs.length - 1]!.push(p);
  });
  return gs;
}
function sumarMargen(el: HTMLElement, px: number) {
  el.style.marginTop = parseFloat(getComputedStyle(el).marginTop) + px + "px";
}

/**
 * Mide y airea un slide ya pintado dentro de `esc` (caja de 960 × 540, escalada o no).
 * Devuelve {ocupacion, relleno, desborde}; null en slides sin área de contenido (portada, índice…).
 */
export function airear(esc: HTMLElement): Medida | null {
  const k = esc.getBoundingClientRect().width / 960;
  if (!k) return null;
  const cont = esc.querySelector<HTMLElement>(".iq-contenido, .iq-bloqueado-cuerpo");
  if (!cont) return null;
  const y = (el: Element, lado: "top" | "bottom") => (el.getBoundingClientRect()[lado] - esc.getBoundingClientRect().top) / k;
  const arriba = y(cont, "top");
  let limite = y(cont, "bottom");
  // Elementos fijos dentro del área (logos de colaboradores, notas) acortan el espacio útil.
  esc.querySelectorAll(".iq-colab-logos, .iq-nota").forEach((el) => {
    const t = y(el, "top");
    if (t > arriba + 40 && t < limite) limite = t - 8;
  });
  const fondo = (ps: Element[]) => ps.reduce((m, p) => Math.max(m, y(p, "bottom")), arriba);
  const todas = partes(cont);
  if (!todas.length) return { ocupacion: 0, relleno: 0, desborde: false };
  const ultimo = Math.max(fondo(todas), fondo(Array.from(cont.querySelectorAll(".iq-cols > div > *"))));
  const ocupacion = Math.round((100 * (ultimo - arriba)) / (limite - arriba));
  if (ultimo > limite + 1) return { ocupacion, relleno: ocupacion, desborde: true };

  function airearCont(contenedor: Element, tope: number) {
    const ps = partes(contenedor);
    let libre = tope - fondo(ps) - HOLGURA;
    if (libre <= 2) return;
    const gs = grupos(ps);
    if (gs.length > 1) {
      const g = Math.min(gs.length <= 3 ? TOPE_HUECO_POCOS : TOPE_HUECO, libre / (gs.length - 1));
      gs.slice(1).forEach((grp) => sumarMargen(grp[0]!, g));
      libre -= g * (gs.length - 1);
    }
    const sep = Array.from(contenedor.querySelectorAll<HTMLElement>(".iq-texto p, .iq-vinetas li")).filter(
      (el) => el.previousElementSibling,
    );
    if (libre > 4 && sep.length) {
      const d = Math.min(TOPE_PARRAFO, libre / sep.length);
      sep.forEach((el) => sumarMargen(el, d));
      libre -= d * sep.length;
    }
    const filas = contenedor.querySelectorAll(".iq-tabla-rayada tbody tr");
    if (libre > 4 && filas.length) {
      const c = Math.min(TOPE_CELDA, libre / (2 * filas.length));
      filas.forEach((tr) => {
        Array.prototype.forEach.call(tr.children, (td: HTMLElement) => {
          const cs = getComputedStyle(td);
          td.style.paddingTop = parseFloat(cs.paddingTop) + c + "px";
          td.style.paddingBottom = parseFloat(cs.paddingBottom) + c + "px";
        });
      });
    }
  }
  // Pila principal (o columnas si el área entera es de dos columnas); después, cada rejilla iguala sus columnas.
  if (cont.classList.contains("iq-cols")) Array.prototype.forEach.call(cont.children, (col: Element) => airearCont(col, limite));
  else airearCont(cont, limite);
  // Cada rejilla interior (de la última a la primera) crece con el hueco que quede al final del área.
  Array.from(cont.querySelectorAll(".iq-cols"))
    .reverse()
    .forEach((grid) => {
      if (grid === cont) return;
      const sobrante = Math.max(0, limite - HOLGURA - fondo(partes(cont)));
      const tope = y(grid, "bottom") + sobrante;
      Array.prototype.forEach.call(grid.children, (col: Element) => airearCont(col, tope));
    });
  const despues = Math.max(fondo(partes(cont)), fondo(Array.from(cont.querySelectorAll(".iq-cols > div > *"))));
  return { ocupacion, relleno: Math.round((100 * (despues - arriba)) / (limite - arriba)), desborde: false };
}

/** Pinta, marca pendientes y mide un slide en `esc`. Devuelve la raíz (para desmontarla) y la medida. */
export function pintarYMedir(
  esc: HTMLElement,
  s: SlideJson,
  pagina: number,
  meta: MetaInforme | null | undefined,
): { raiz: RaizSlide; pendientes: number; medida: Medida | null; error?: string } {
  const raiz = pintar(esc, s, pagina, meta);
  if (raiz.error) return { raiz, pendientes: 0, medida: null, error: raiz.error };
  const pendientes = marcarPendientes(esc);
  try {
    return { raiz, pendientes, medida: airear(esc) };
  } catch (e) {
    return { raiz, pendientes, medida: null, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Medida de un slide para la orquestación: sin área de contenido (portada, índice…) no hay relleno que
 * medir y `relleno` queda null, como en la app original.
 */
export interface MedidaSlide {
  ocupacion: number | null;
  relleno: number | null;
  desborde: boolean;
  error?: string;
}

/** Mide un slide fuera de pantalla (lienzo oculto de 960 × 540) y lo desmonta. */
export function medirFuera(s: SlideJson, pagina: number, meta: MetaInforme | null | undefined): MedidaSlide {
  const el = document.createElement("div");
  el.className = "iq-lienzo";
  contenedorOculto().appendChild(el);
  const raiz = pintar(el, s, pagina, meta);
  let r: MedidaSlide;
  try {
    const m = raiz.error ? null : airear(el);
    r = raiz.error
      ? { ocupacion: null, relleno: null, desborde: false, error: raiz.error }
      : m ?? { ocupacion: null, relleno: null, desborde: false };
  } catch (e) {
    r = { ocupacion: null, relleno: null, desborde: false, error: e instanceof Error ? e.message : String(e) };
  }
  raiz.root.unmount();
  el.remove();
  return r;
}

/** Contenedor fuera de pantalla para medir y capturar slides. */
export function contenedorOculto(): HTMLElement {
  let el = document.getElementById("iq-lienzo-oculto");
  if (!el) {
    el = document.createElement("div");
    el.id = "iq-lienzo-oculto";
    el.setAttribute("aria-hidden", "true");
    el.className = "iq-lienzo-oculto";
    document.body.appendChild(el);
  }
  return el;
}
