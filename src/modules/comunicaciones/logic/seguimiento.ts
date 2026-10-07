import type { ImagenApertura } from "@/modules/comunicaciones/types";

/**
 * El seguimiento propio de aperturas y clics.
 *
 * A cada correo se le pone una imagen y se le cambian los enlaces por otros que
 * pasan por el portal, todos con un identificador que es solo de ese correo.
 * Cuando alguien carga la imagen o pulsa un enlace, el portal lo anota.
 *
 * Por qué propio: Zoho no expone los correos de la mayoría de las cuentas y,
 * donde los expone, no registra aperturas (ver docs/comunicaciones).
 *
 * Puro: recibe el HTML y devuelve el HTML. No genera identificadores ni anota
 * nada.
 */

/** 16 bytes aleatorios en base64url: 22 caracteres. */
export const TOKEN_RE = /^[A-Za-z0-9_-]{22}$/;

export const RUTA_APERTURA = "/api/s/a";
export const RUTA_ENLACE = "/api/s/e";

function sinBarraFinal(base: string): string {
  return base.trim().replace(/\/+$/, "");
}

export function urlDeApertura(base: string, token: string, imagen: ImagenApertura): string {
  // El `v` solo dice qué imagen servir; la apertura se anota igual.
  return `${sinBarraFinal(base)}${RUTA_APERTURA}/${token}${imagen === "logo" ? "?v=logo" : ""}`;
}

export function urlDeEnlace(base: string, token: string, posicion: number): string {
  return `${sinBarraFinal(base)}${RUTA_ENLACE}/${token}/${posicion}`;
}

/** Una base de seguimiento vale si es https (o http en local) y no trae ruta ni parámetros. */
export function baseDeSeguimientoValida(base: string | undefined | null): base is string {
  if (!base?.trim()) return false;
  try {
    const u = new URL(base.trim());
    const local = u.hostname === "localhost" || u.hostname === "127.0.0.1";
    if (u.protocol !== "https:" && !(local && u.protocol === "http:")) return false;
    return (u.pathname === "/" || u.pathname === "") && !u.search && !u.hash && !u.username;
  } catch {
    return false;
  }
}

function decodificar(valor: string): string {
  return valor
    .replace(/&amp;/gi, "&")
    .replace(/&#38;/g, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function codificar(valor: string): string {
  return valor.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

function quitarEtiquetas(html: string): string {
  return decodificar(html.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
}

/** ¿Es un destino que se puede rastrear? Solo http y https, y bien formado. */
export function esEnlaceRastreable(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export function tieneImagen(html: string): boolean {
  return /<img\b/i.test(html);
}

const ENLACE_RE = /<a\b([^>]*?)\bhref\s*=\s*(["'])(.*?)\2([^>]*)>([\s\S]*?)<\/a\s*>/gi;

export interface EnlaceDePlantilla {
  posicion: number;
  url: string;
  texto: string;
}

/**
 * Los enlaces http(s) de un HTML, en orden. Lo demás (`mailto:`, `tel:`,
 * anclas) no se toca ni se cuenta.
 */
export function enlacesDe(html: string): EnlaceDePlantilla[] {
  const enlaces: EnlaceDePlantilla[] = [];
  for (const m of html.matchAll(ENLACE_RE)) {
    const url = decodificar(m[3] ?? "").trim();
    if (!esEnlaceRastreable(url)) continue;
    enlaces.push({ posicion: enlaces.length, url, texto: textoDeEnlace(m[5] ?? "") });
  }
  return enlaces;
}

/**
 * Cómo se nombra un enlace en el panel. Un enlace que envuelve una imagen (un
 * botón, un icono de red social) no tiene texto: se nombra por la imagen.
 */
function textoDeEnlace(interior: string): string {
  const texto = quitarEtiquetas(interior).trim().slice(0, 200);
  if (texto || !/<img\b/i.test(interior)) return texto;
  const alt = decodificar(/<img\b[^>]*?\balt\s*=\s*(["'])(.*?)\1/i.exec(interior)?.[2] ?? "").trim();
  return alt ? `Imagen: ${alt}`.slice(0, 200) : "(imagen)";
}

export interface Instrumentado {
  html: string;
  /** El destino de verdad de cada enlace, por posición. Es lo que se guarda. */
  enlaces: string[];
  imagen: ImagenApertura;
}

function insertarAlFinal(html: string, trozo: string): string {
  if (/<\/body\s*>/i.test(html)) return html.replace(/<\/body\s*>/i, `${trozo}</body>`);
  if (/<\/html\s*>/i.test(html)) return html.replace(/<\/html\s*>/i, `${trozo}</html>`);
  return html + trozo;
}

/**
 * Pone el seguimiento en un correo ya montado.
 *
 * - Cada enlace http(s) pasa a apuntar al portal, con el identificador del
 *   correo y su posición. El destino de verdad se devuelve aparte para
 *   guardarlo: el clic redirige a lo guardado, nunca a algo que viaje en la URL.
 * - Si el correo ya trae alguna imagen, se añade una invisible de 1×1. Si no
 *   trae ninguna, se añade al pie el logotipo: sin una imagen a la vista, el
 *   programa de correo no ofrece cargar imágenes y la apertura no se sabría.
 */
export function instrumentar(html: string, base: string, token: string): Instrumentado {
  const enlaces: string[] = [];
  const conEnlaces = html.replace(
    ENLACE_RE,
    (todo: string, antes: string, comilla: string, href: string, despues: string, contenido: string) => {
      const url = decodificar(href).trim();
      if (!esEnlaceRastreable(url)) return todo;
      const rastreado = urlDeEnlace(base, token, enlaces.length);
      enlaces.push(url);
      return `<a${antes}href=${comilla}${codificar(rastreado)}${comilla}${despues}>${contenido}</a>`;
    },
  );

  const imagen: ImagenApertura = tieneImagen(html) ? "pixel" : "logo";
  const src = codificar(urlDeApertura(base, token, imagen));
  const trozo =
    imagen === "pixel"
      ? `<img src="${src}" width="1" height="1" alt="" style="display:block;border:0;width:1px;height:1px">`
      : `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>` +
        `<td align="center" style="padding:24px 0 8px 0">` +
        `<img src="${src}" width="140" alt="Impar Capital" style="display:block;border:0;width:140px;height:auto">` +
        `</td></tr></table>`;

  return { html: insertarAlFinal(conEnlaces, trozo), enlaces, imagen };
}

/**
 * Lo mismo, para enseñarlo en la vista previa: los enlaces se dejan como están
 * y la imagen que se añadiría se pinta con el logotipo del propio portal, sin
 * ningún identificador. Mirar una vista previa no puede anotar una apertura.
 */
export function instrumentarParaVistaPrevia(html: string): { html: string; imagen: ImagenApertura } {
  const imagen: ImagenApertura = tieneImagen(html) ? "pixel" : "logo";
  if (imagen === "pixel") return { html, imagen };
  const trozo =
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>` +
    `<td align="center" style="padding:24px 0 8px 0">` +
    `<img src="/logo-correo-impar.png" width="140" alt="Impar Capital" style="display:block;border:0;width:140px;height:auto">` +
    `</td></tr></table>`;
  return { html: insertarAlFinal(html, trozo), imagen };
}

// ---------------------------------------------------------------------------
// Lecturas automáticas
// ---------------------------------------------------------------------------

/**
 * Programas que abren imágenes y pulsan enlaces por su cuenta: filtros de
 * correo, antivirus y robots. No son una persona leyendo.
 *
 * Los proxies de imágenes de Gmail o de Apple NO están aquí: descargan la
 * imagen porque alguien abrió el correo (o, en el caso de Apple, quizá no: por
 * eso las aperturas son siempre una aproximación y los clics el dato fiable).
 */
const AGENTES_AUTOMATICOS =
  /bot\b|crawler|spider|scanner|urlscan|proofpoint|barracuda|mimecast|symantec|trendmicro|trend micro|forcepoint|sophos|fortinet|fortigate|checkpoint|safelinks|urldefense|cloudmark|ironport|mailguard|headless|phantomjs|python-requests|python-urllib|curl\/|wget\/|go-http-client|okhttp|java\/|libwww|axios\/|node-fetch|postman/i;

export function esAgenteAutomatico(agente: string | null | undefined): boolean {
  if (!agente?.trim()) return true; // nadie navega sin identificarse
  return AGENTES_AUTOMATICOS.test(agente);
}

/** Una petición que no es `GET` (un `HEAD` de comprobación) tampoco es una persona. */
export function esLecturaAutomatica(metodo: string, agente: string | null | undefined): boolean {
  return metodo.toUpperCase() !== "GET" || esAgenteAutomatico(agente);
}
