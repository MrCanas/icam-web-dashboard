import { esEmailValido } from "@/modules/comunicaciones/logic/direcciones";
import type { CorreoSaliente } from "@/modules/comunicaciones/logic/envio";
import {
  esEnlaceRastreable,
  RUTA_APERTURA,
  RUTA_ENLACE,
  TOKEN_RE,
  urlDeApertura,
  urlDeEnlace,
} from "@/modules/comunicaciones/logic/seguimiento";

/**
 * La última revisión de un correo antes de que llegue a la pasarela.
 *
 * El candado decide A QUIÉN puede ir un correo. Esto decide si el correo ESTÁ
 * BIEN HECHO: que no lleve un campo combinado a medio resolver, que cada enlace
 * tenga su destino guardado, que el seguimiento sea el de ese destinatario y no
 * el de otro. Devuelve la lista de problemas; vacía es que puede salir.
 *
 * No arregla nada: un correo con un problema no sale.
 *
 * Puro.
 */

/** Zoho admite hasta 10 MB con adjuntos; el cuerpo solo no tiene por qué pasar de esto. */
export const TAMANO_MAXIMO_DEL_CUERPO = 400_000;

export interface Esperado {
  /** El identificador de seguimiento de este destinatario. */
  token: string;
  /** El registro de Zoho sobre el que tiene que salir. */
  registro: { modulo: string; id: string };
  /** Los destinos guardados de sus enlaces, por posición. */
  enlaces: readonly string[];
  /** Cuántos enlaces http(s) tenía la plantilla. */
  enlacesDePlantilla: number;
  /** Cuántos adjuntos tenía la plantilla. */
  adjuntosDePlantilla: number;
  /** Dirección base del seguimiento. */
  base: string;
}

function escaparRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function decodificar(valor: string): string {
  return valor.replace(/&amp;/gi, "&").replace(/&quot;/gi, '"');
}

function atributos(html: string, etiqueta: string, atributo: string): string[] {
  const re = new RegExp(`<${etiqueta}\\b[^>]*?\\b${atributo}\\s*=\\s*(["'])(.*?)\\1`, "gi");
  return [...html.matchAll(re)].map((m) => decodificar(m[2] ?? "").trim());
}

export function validarCorreo(correo: CorreoSaliente, esperado: Esperado): string[] {
  const problemas: string[] = [];
  const { contenido } = correo;

  if (!contenido) return ["El correo no viene montado por el portal."];
  if (!TOKEN_RE.test(esperado.token)) return ["El identificador de seguimiento no tiene el formato esperado."];

  // --- Asunto y cuerpo ---
  if (!contenido.asunto.trim()) problemas.push("El asunto está vacío.");
  if (/[\r\n]/.test(contenido.asunto)) problemas.push("El asunto tiene saltos de línea.");
  if (!contenido.html.trim()) problemas.push("El cuerpo está vacío.");
  if (contenido.html.length > TAMANO_MAXIMO_DEL_CUERPO) {
    problemas.push(`El cuerpo pesa ${contenido.html.length} caracteres; el máximo es ${TAMANO_MAXIMO_DEL_CUERPO}.`);
  }
  const restos = [...new Set(`${contenido.asunto}\n${contenido.html}`.match(/\$\{[^}]*\}/g) ?? [])];
  if (restos.length > 0) problemas.push(`Quedan campos combinados sin resolver: ${restos.join(", ")}.`);

  // --- Direcciones ---
  const direcciones = [correo.remitente, ...correo.para, ...correo.copia, ...correo.copiaOculta];
  for (const d of new Set(direcciones)) {
    if (!esEmailValido(d)) problemas.push(`«${d}» no es una dirección de correo válida.`);
  }
  if (correo.para.length === 0) problemas.push("No hay nadie en «Para».");

  // --- Registro ---
  if (correo.registro.modulo !== esperado.registro.modulo || correo.registro.id !== esperado.registro.id) {
    problemas.push("El registro de Zoho no es el de este destinatario.");
  }

  // --- Enlaces ---
  const hrefs = atributos(contenido.html, "a", "href").filter((h) => esEnlaceRastreable(h));
  const prefijo = urlDeEnlace(esperado.base, esperado.token, 0).replace(/\/0$/, "/");
  const posiciones: number[] = [];
  for (const href of hrefs) {
    if (!href.startsWith(prefijo)) {
      problemas.push(`Hay un enlace sin rastrear o con el identificador de otro correo: ${href.slice(0, 120)}`);
      continue;
    }
    const resto = href.slice(prefijo.length);
    if (!/^\d+$/.test(resto)) {
      problemas.push(`Hay un enlace rastreado mal formado: ${href.slice(0, 120)}`);
      continue;
    }
    posiciones.push(Number(resto));
  }
  if (hrefs.length !== esperado.enlacesDePlantilla) {
    problemas.push(`La plantilla tiene ${esperado.enlacesDePlantilla} enlaces y el correo ${hrefs.length}.`);
  }
  if (esperado.enlaces.length !== esperado.enlacesDePlantilla) {
    problemas.push(
      `Hay ${esperado.enlaces.length} destinos guardados para ${esperado.enlacesDePlantilla} enlaces.`,
    );
  }
  const ordenadas = [...posiciones].sort((a, b) => a - b);
  if (ordenadas.some((p, i) => p !== i)) problemas.push("Las posiciones de los enlaces no son 0, 1, 2… sin repetir.");
  for (const destino of esperado.enlaces) {
    if (!esEnlaceRastreable(destino)) problemas.push(`Un destino guardado no es un enlace http(s): ${destino.slice(0, 120)}`);
  }

  // --- Imagen de apertura ---
  const srcs = atributos(contenido.html, "img", "src");
  const apertura = [urlDeApertura(esperado.base, esperado.token, "pixel"), urlDeApertura(esperado.base, esperado.token, "logo")];
  const nApertura = srcs.filter((s) => apertura.includes(s)).length;
  if (nApertura !== 1) problemas.push(`El correo tiene ${nApertura} imágenes de apertura; tiene que tener una.`);

  // --- Ningún identificador que no sea el suyo ---
  const reToken = new RegExp(`(?:${escaparRe(RUTA_APERTURA)}|${escaparRe(RUTA_ENLACE)})/([A-Za-z0-9_-]+)`, "g");
  const ajenos = [...new Set([...contenido.html.matchAll(reToken)].map((m) => m[1]!))].filter(
    (t) => t !== esperado.token,
  );
  if (ajenos.length > 0) problemas.push("El correo lleva el identificador de seguimiento de otro correo.");

  // --- Adjuntos ---
  if (contenido.adjuntos.length !== esperado.adjuntosDePlantilla) {
    problemas.push(
      `La plantilla tiene ${esperado.adjuntosDePlantilla} adjuntos y el correo ${contenido.adjuntos.length}.`,
    );
  }
  if (contenido.adjuntos.some((a) => !a.trim())) problemas.push("Un adjunto no tiene identificador de fichero.");

  return problemas;
}
