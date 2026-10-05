import { chromium, type Browser, type BrowserContext } from "playwright-core";

import type { IncidenciaExportacion } from "../types";

/**
 * PDF del informe hecho en el servidor: un Chromium sin ventana abre la vista
 * de impresión (la misma que ve el equipo, con las mismas slides) y la guarda
 * como PDF. Sale vectorial, con las fuentes incrustadas y siempre igual, sin
 * depender del navegador ni de los ajustes de impresión de cada persona.
 * Lo usan la ruta api/informes/pdf y los scripts de comprobación.
 */

/** Fallo al generar el PDF, con un texto que se puede enseñar al equipo. */
export class ErrorPdf extends Error {
  constructor(
    mensaje: string,
    readonly status = 500,
  ) {
    super(mensaje);
  }
}

/**
 * Navegador para el PDF. En Vercel, el Chromium empaquetado para funciones
 * (@sparticuz/chromium); en local, el Edge o el Chrome instalados
 * (playwright-core no descarga navegadores).
 */
export async function abrirNavegadorPdf(): Promise<Browser> {
  if (process.env.VERCEL) {
    const { default: binario } = await import("@sparticuz/chromium");
    return chromium.launch({ executablePath: await binario.executablePath(), args: binario.args, headless: true });
  }
  const canales = process.env.INFORMES_PDF_CANAL ? [process.env.INFORMES_PDF_CANAL] : ["msedge", "chrome"];
  let ultimo: unknown;
  for (const channel of canales) {
    try {
      return await chromium.launch({ channel, headless: true });
    } catch (e) {
      ultimo = e;
    }
  }
  throw new ErrorPdf(`No hay navegador para generar el PDF (${canales.join(", ")}): ${ultimo instanceof Error ? ultimo.message.split("\n")[0] : ultimo}`);
}

const FUENTES = ["fonts.googleapis.com", "fonts.gstatic.com"];

/**
 * Contexto que solo habla con el portal (y con las fuentes de las slides): la
 * sesión que lleva es la de quien pide el PDF y no debe salir de ahí.
 * `cabeceras` van solo en las peticiones al portal.
 */
export async function contextoPdf(navegador: Browser, origen: string, cabeceras: Record<string, string> = {}): Promise<BrowserContext> {
  const contexto = await navegador.newContext({ viewport: { width: 1280, height: 720 } });
  await contexto.route("**/*", (ruta) => {
    const peticion = ruta.request();
    const url = new URL(peticion.url());
    if (url.origin === origen) return ruta.continue({ headers: { ...peticion.headers(), ...cabeceras } });
    if (url.protocol === "data:" || url.protocol === "blob:" || FUENTES.includes(url.hostname)) return ruta.continue();
    return ruta.abort();
  });
  return contexto;
}

/**
 * Abre la vista de impresión (`url`, con ?pdf=1) y devuelve el PDF junto con
 * lo que el validador de exportación ha encontrado en esa misma vista
 * (`data-incidencias`). Espera a que la vista se declare lista —slides
 * pintadas con sus fuentes e imágenes cargadas— y falla con su mensaje si
 * declara un error: nunca devuelve un PDF que no sea fiel.
 */
export async function imprimirInforme(contexto: BrowserContext, url: string): Promise<{ pdf: Buffer; incidencias: IncidenciaExportacion[] }> {
  const page = await contexto.newPage();
  const errores: string[] = [];
  page.on("pageerror", (e) => errores.push(e.message));
  const r = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
  if (new URL(page.url()).pathname === "/login") throw new ErrorPdf("La sesión ha caducado: vuelve a entrar y repite la descarga.", 401);
  if (!r || !r.ok()) throw new ErrorPdf(`La vista de impresión ha respondido ${r?.status() ?? "sin respuesta"}.`);
  let marca;
  try {
    marca = await page.waitForSelector(".iq-paginas[data-listo], .iq-paginas[data-error]", { state: "attached", timeout: 90_000 });
  } catch {
    throw new ErrorPdf(`La vista de impresión no ha terminado de pintarse${errores.length ? ` (${errores[0]})` : ""}.`);
  }
  const error = await marca.getAttribute("data-error");
  if (error) throw new ErrorPdf(`El PDF no saldría igual que el informe: ${error}.`);
  let incidencias: IncidenciaExportacion[] = [];
  try {
    incidencias = JSON.parse((await marca.getAttribute("data-incidencias")) || "[]") as IncidenciaExportacion[];
  } catch {
    // Sin lista no se puede validar: mejor no dejar pasar nada en silencio.
    throw new ErrorPdf("La vista de impresión no ha devuelto el resultado del validador.");
  }
  await page.emulateMedia({ media: "print" });
  return { pdf: await page.pdf({ preferCSSPageSize: true, printBackground: true }), incidencias };
}
