/**
 * Recorrido completo del informe trimestral en el portal, en Edge headless:
 * paso 0 (proyecto y trimestres) → paso 1 (informe anterior) → paso 2
 * (fuentes automáticas) → análisis → GO → editor → una corrección con marcas
 * → PDF. Es la verificación del plan (SE84, Q2 → Q3 2026).
 *
 * Requiere el portal en marcha (npm run dev) y un usuario editor de pm. Las
 * fases con Claude necesitan ANTHROPIC_API_KEY en el servidor y cuestan dinero
 * (1,5–3 $ por informe): por defecto el recorrido para en el paso 2.
 *
 *   npm run pm:informes-recorrido -- --email x@imparcapital.com
 *   npm run pm:informes-recorrido -- --email x@imparcapital.com --con-claude
 *   npm run pm:informes-recorrido -- --email-lector y@imparcapital.com   (comprueba el 403)
 */
import { join } from "node:path";

import type { Page } from "playwright-core";

import { cargarEnv } from "./lib/env";
import { abrirEdge, contextoConSesion } from "./lib/navegador";

function arg(nombre: string, porDefecto?: string): string | undefined {
  const i = process.argv.indexOf(`--${nombre}`);
  return i > 0 ? process.argv[i + 1] : porDefecto;
}

const URL_BASE = arg("url", "http://localhost:3000")!;
const ACTIVO = arg("activo", "SE84")!;
const TRIMESTRE = arg("trimestre", "Q3 2026")!;
const SALIDA = arg("salida", process.cwd())!;

function log(t: string) {
  console.log(`[${new Date().toLocaleTimeString("es-ES")}] ${t}`);
}

async function esperarTexto(page: Page, texto: string | RegExp, timeout = 120_000) {
  await page.getByText(texto).first().waitFor({ timeout });
}

/** Recuadra la zona de texto de la primera slide de contenido redactada por Claude y pide una corrección. */
async function corregirConMarca(page: Page) {
  const tarjeta = page
    .locator("section[id^=ed-]")
    .filter({ hasText: "Relleno" })
    .filter({ hasText: /\b(actualizada|nueva)\b/ })
    .first();
  const idSlide = await tarjeta.getAttribute("id");
  await tarjeta.getByRole("button", { name: "Marcar" }).click();
  await tarjeta.getByRole("button", { name: "Recuadro" }).click();
  const caja = (await tarjeta.locator("canvas").boundingBox())!;
  await page.mouse.move(caja.x + caja.width * 0.06, caja.y + caja.height * 0.16);
  await page.mouse.down();
  await page.mouse.move(caja.x + caja.width * 0.5, caja.y + caja.height * 0.5, { steps: 8 });
  await page.mouse.up();
  log(`Marca en ${idSlide}: ${await tarjeta.locator("p", { hasText: "Marcas:" }).innerText()}`);
  await tarjeta.locator("textarea").fill("1: pon en negrita la fecha más relevante de lo recuadrado; no cambies nada más.");
  const t = Date.now();
  await tarjeta.getByRole("button", { name: "Aplicar corrección" }).click();
  // El estado de la corrección (no el texto de la slide, que puede contener cualquier cosa).
  await tarjeta
    .locator("span[aria-live=polite]")
    .filter({ hasText: /^(Aplicada|No se pudo|Claude no|Error de Claude|Se ha cortado|Se ha alcanzado|Tu |Demasiada|Parado|La respuesta)/ })
    .waitFor({ timeout: 600_000 });
  log(`Corrección (${Math.round((Date.now() - t) / 1000)} s): ${await tarjeta.locator("[aria-live=polite]").last().innerText()}`);
}

async function main() {
  cargarEnv();
  const email = arg("email", process.env.INFORMES_EMAIL_PRUEBAS);
  const lector = arg("email-lector");
  const conClaude = process.argv.includes("--con-claude");
  const navegador = await abrirEdge();
  try {
    if (lector) {
      const ctx = await contextoConSesion(navegador, URL_BASE, lector);
      const r = await ctx.request.post(`${URL_BASE}/api/informes/claude`, {
        data: { tipo: "analisis", informeId: `${ACTIVO}_${TRIMESTRE.replace(" ", "-")}` },
      });
      log(`Lector → POST /api/informes/claude: ${r.status()} ${(await r.text()).slice(0, 160)}`);
      const f = await ctx.request.post(`${URL_BASE}/api/informes/fotos`, { multipart: { informeId: "X_Q1-2026" } });
      log(`Lector → POST /api/informes/fotos: ${f.status()}`);
      const p = await ctx.newPage();
      await p.goto(`${URL_BASE}/dashboard/pm/informes`, { waitUntil: "networkidle" });
      log(`Lector ve la lista: ${(await p.getByText("Tu acceso a Proyectos es de lectura").count()) > 0 ? "sí, en solo lectura" : "¿sin aviso?"}; botón «Nuevo informe»: ${await p.getByRole("link", { name: "Nuevo informe" }).count()}`);
      await ctx.close();
    }
    if (!email) return;
    if (process.argv.includes("--solo-correccion")) {
      const ctx = await contextoConSesion(navegador, URL_BASE, email);
      const page = await ctx.newPage();
      await page.goto(`${URL_BASE}/dashboard/pm/informes/${ACTIVO}_${TRIMESTRE.replace(" ", "-")}`, { waitUntil: "networkidle", timeout: 240_000 });
      await page.getByRole("heading", { level: 2, name: "Revisión" }).waitFor({ timeout: 120_000 });
      await page.waitForFunction("!document.body.innerText.includes('Revisando…')", undefined, { timeout: 180_000 });
      await corregirConMarca(page);
      return;
    }

    const ctx = await contextoConSesion(navegador, URL_BASE, email);
    const page = await ctx.newPage();
    const errores: string[] = [];
    page.on("pageerror", (e) => errores.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errores.push(m.text());
    });

    // Paso 0.
    await page.goto(`${URL_BASE}/dashboard/pm/informes/nuevo?activo=${encodeURIComponent(ACTIVO)}`, { waitUntil: "networkidle", timeout: 240_000 });
    const [qPrev, qNew] = await page.locator("select").evaluateAll((s) => s.slice(1, 3).map((x) => (x as HTMLSelectElement).value));
    log(`Paso 0: proyecto ${await page.locator("select").first().inputValue()}, ${qPrev} → ${qNew}`);
    if (qNew !== TRIMESTRE) await page.locator("select").nth(2).selectOption(TRIMESTRE);
    await page.getByRole("button", { name: "Continuar" }).click();
    await page.waitForURL(/\/dashboard\/pm\/informes\/[^/]+_Q\d-\d{4}/, { timeout: 120_000 });
    log(`Informe: ${page.url()}`);

    // Paso 1.
    await esperarTexto(page, /Es el punto de partida|Información del|Estructura propuesta|Revisión/);
    if (await page.getByText("Es el punto de partida").count()) {
      const elegido = page.getByRole("radio", { checked: true });
      log(`Paso 1: ${(await elegido.locator("xpath=ancestor::label").allInnerTexts()).map((t) => t.replace(/\s+/g, " ")).join(" → ")}`);
      await page.getByRole("button", { name: "Continuar" }).click();
    }

    // Paso 2: las actas y la planificación se incorporan al responder que sí.
    await esperarTexto(page, /¿Quieres incorporar las actas|no está vinculado/);
    for (const pregunta of ["¿Quieres incorporar las actas del trimestre?", "¿Quieres incorporar la planificación?"]) {
      const grupo = page.getByRole("group", { name: pregunta });
      if (!(await grupo.count())) continue;
      await grupo.getByRole("button", { name: "Sí" }).click();
      await page.waitForFunction("!document.body.innerText.includes('del portal…')", undefined, { timeout: 180_000 });
    }
    const fuentes = await page.locator("li").filter({ hasText: "caracteres" }).allInnerTexts();
    log(`Paso 2: ${fuentes.map((f) => f.replace(/\s+/g, " ")).join(" | ")}`);
    await page.screenshot({ path: join(SALIDA, "recorrido-paso2.png"), fullPage: true });

    if (!conClaude) {
      log("Sin --con-claude: el recorrido para aquí.");
      log(`Errores de consola: ${errores.length ? errores.join(" | ") : "ninguno"}`);
      return;
    }

    // Análisis.
    const t0 = Date.now();
    await page.getByRole("button", { name: "Analizar la información" }).click();
    await esperarTexto(page, "Lo que he entendido del trimestre", 600_000).catch(async (e) => {
      log(`Análisis: ${await page.locator("[role=alert]").allInnerTexts()}`);
      throw e;
    });
    log(`Análisis en ${Math.round((Date.now() - t0) / 1000)} s`);
    await page.screenshot({ path: join(SALIDA, "recorrido-paso3.png"), fullPage: true });

    // GO.
    const t1 = Date.now();
    await page.getByRole("button", { name: /GO · Generar informe/ }).click();
    const fin = Date.now() + 60 * 60_000;
    let ultimo = "";
    while (Date.now() < fin) {
      if (await page.getByRole("heading", { level: 2, name: "Revisión" }).count()) break;
      const fase = await page.locator("[data-fase]").first().innerText().catch(() => "");
      if (fase !== ultimo) {
        log(`Generación: ${fase}`);
        ultimo = fase;
      }
      if (/interrumpido|Parado\./.test(fase)) throw new Error(fase);
      await page.waitForTimeout(5_000);
    }
    log(`Generación en ${Math.round((Date.now() - t1) / 60_000)} min`);
    await page.waitForFunction("!document.body.innerText.includes('Revisando…')", undefined, { timeout: 180_000 });
    const barras = await page.locator("section[id^=ed-] > div:first-child").allInnerTexts();
    log(`Editor:\n  ${barras.map((b) => b.replace(/Marcar[\s\S]*$/, "").replace(/\s+/g, " ")).join("\n  ")}`);
    const revision = await page.locator("section", { has: page.getByRole("heading", { level: 2, name: "Revisión" }) }).first().innerText();
    log(`Revisión:\n${revision}`);
    await page.screenshot({ path: join(SALIDA, "recorrido-editor.png") });

    await corregirConMarca(page);

    // PDF.

    const id = decodeURIComponent(page.url().split("/informes/")[1]!.split(/[?#]/)[0]!);
    await page.goto(`${URL_BASE}/dashboard/pm/informes/${encodeURIComponent(id)}/imprimir`, { waitUntil: "networkidle" });
    await page.waitForSelector(".iq-paginas[data-listo]", { timeout: 180_000 });
    await page.waitForFunction("Array.from(document.images).every((i) => i.complete)");
    await page.emulateMedia({ media: "print" });
    const pdf = join(SALIDA, `${await page.title()}.pdf`);
    await page.pdf({ path: pdf, preferCSSPageSize: true, printBackground: true });
    log(`PDF: ${pdf}`);
    log(`Errores de consola: ${errores.length ? errores.join(" | ") : "ninguno"}`);
  } finally {
    await navegador.close();
  }
}

main().catch((err: unknown) => {
  console.error(`✗ ${err instanceof Error ? err.message : err}`);
  process.exitCode = 1;
});
