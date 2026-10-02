/**
 * Comprueba en Edge headless las «imágenes libres» del editor de informes: en
 * una slide (por defecto la portada, que no admite imágenes como bloque) se
 * elige una imagen de la biblioteca, se dibuja su área, se mueve arrastrando,
 * se redimensiona con un tirador, se ajusta con el teclado y se quita. Cada
 * paso compara la caja pintada con la esperada, en unidades de slide. Deja el
 * informe como estaba (los cambios quedan en su historial).
 *
 * Requiere el portal en marcha y un usuario editor de pm; no usa Claude.
 *
 *   npm run pm:informes-imagen-libre -- --email x@imparcapital.com --url http://localhost:3210
 *   npm run pm:informes-imagen-libre -- --email x@imparcapital.com --informe SE84_Q3-2026 --slide cierre
 */
import { join } from "node:path";

import type { Locator, Page } from "playwright-core";

import { cargarEnv } from "./lib/env";
import { abrirEdge, contextoConSesion } from "./lib/navegador";

function arg(nombre: string, porDefecto?: string): string | undefined {
  const i = process.argv.indexOf(`--${nombre}`);
  return i > 0 ? process.argv[i + 1] : porDefecto;
}

const URL_BASE = arg("url", "http://localhost:3000")!;
const INFORME = arg("informe", "SE84_Q3-2026")!;
const SLIDE = arg("slide", "portada")!;
const SALIDA = arg("salida", process.cwd())!;

type Caja = [x: number, y: number, ancho: number, alto: number];

function log(t: string) {
  console.log(`[${new Date().toLocaleTimeString("es-ES")}] ${t}`);
}

/** Cajas (unidades de slide) de las imágenes libres pintadas en la tarjeta. */
async function cajas(tarjeta: Locator): Promise<Caja[]> {
  return tarjeta
    .locator("img[data-flotante]")
    .evaluateAll((ims) => ims.map((im) => ["left", "top", "width", "height"].map((p) => parseFloat((im as HTMLElement).style.getPropertyValue(p))) as Caja));
}

/** Espera a que la slide guardada y repintada tenga exactamente esas imágenes libres (±1 unidad). */
async function esperar(page: Page, tarjeta: Locator, esperadas: Caja[], paso: string) {
  const fin = Date.now() + 30_000;
  let vistas: Caja[] = [];
  while (Date.now() < fin) {
    vistas = await cajas(tarjeta);
    const iguales = vistas.length === esperadas.length && vistas.every((c, i) => c.every((v, j) => Math.abs(v - esperadas[i]![j]!) <= 1));
    // Guardado y repintado: la barra de edición vuelve a estar disponible.
    if (iguales && !(await tarjeta.getByRole("button", { name: "＋ Imagen en un área" }).isDisabled())) {
      log(`✓ ${paso}: ${JSON.stringify(vistas)}`);
      return;
    }
    await page.waitForTimeout(200);
  }
  throw new Error(`${paso}: se esperaba ${JSON.stringify(esperadas)} y hay ${JSON.stringify(vistas)}`);
}

async function main() {
  cargarEnv();
  const email = arg("email", process.env.INFORMES_EMAIL_PRUEBAS);
  if (!email) throw new Error("Falta --email (un editor de pm)");
  const navegador = await abrirEdge();
  try {
    const ctx = await contextoConSesion(navegador, URL_BASE, email);
    const page = await ctx.newPage();
    const errores: string[] = [];
    page.on("pageerror", (e) => errores.push(e.message));
    await page.goto(`${URL_BASE}/dashboard/pm/informes/${encodeURIComponent(INFORME)}`, { waitUntil: "networkidle", timeout: 240_000 });
    await page.getByRole("heading", { level: 2, name: "Revisión" }).waitFor({ timeout: 120_000 });
    const tarjeta = page.locator(`section[id="ed-${SLIDE}"]`);
    await tarjeta.scrollIntoViewIfNeeded();
    const previas = await cajas(tarjeta);
    if (previas.length) throw new Error(`La slide «${SLIDE}» ya tiene ${previas.length} imagen(es) libre(s): elige otra con --slide`);

    // Elegir imagen de la biblioteca y dibujar su área.
    await tarjeta.getByRole("button", { name: "Editar" }).click();
    await tarjeta.getByRole("button", { name: "＋ Imagen en un área" }).click();
    await page.getByRole("heading", { name: "Imagen en un área" }).waitFor();
    const foto = page.locator("section[aria-label] button:has(img)").first();
    await foto.waitFor({ timeout: 30_000 }).catch(() => {
      throw new Error("La biblioteca del proyecto no tiene imágenes: sube una antes de lanzar la comprobación");
    });
    await foto.click();
    const capa = tarjeta.getByLabel(/^Imágenes libres de /);
    await tarjeta.getByText("Arrastra sobre la slide para marcar el área").waitFor();
    const b = (await capa.boundingBox())!;
    // Unidades de slide → píxeles de pantalla.
    const px = (x: number, y: number): [number, number] => [b.x + (x * b.width) / 960, b.y + (y * b.height) / 540];
    const arrastrar = async (de: [number, number], a: [number, number]) => {
      await page.mouse.move(...px(...de));
      await page.mouse.down();
      await page.mouse.move(...px((de[0] + a[0]) / 2, (de[1] + a[1]) / 2), { steps: 4 });
      await page.mouse.move(...px(...a), { steps: 4 });
      await page.mouse.up();
    };

    await arrastrar([96, 108], [384, 324]);
    await esperar(page, tarjeta, [[96, 108, 288, 216]], "Colocada en el área dibujada");
    await page.screenshot({ path: join(SALIDA, "imagen-libre.png") });

    await arrastrar([240, 216], [336, 270]);
    await esperar(page, tarjeta, [[192, 162, 288, 216]], "Movida arrastrando");

    // Tirador de la esquina inferior derecha.
    await arrastrar([480, 378], [528, 405]);
    await esperar(page, tarjeta, [[192, 162, 336, 243]], "Redimensionada con el tirador");

    await capa.focus();
    await page.keyboard.press("Shift+ArrowLeft");
    await esperar(page, tarjeta, [[182, 162, 336, 243]], "Ajustada con el teclado");

    // Fuera de la slide no puede quedar: se arrastra más allá del borde y se queda pegada a él.
    await arrastrar([300, 250], [959, 539]);
    await esperar(page, tarjeta, [[624, 297, 336, 243]], "Retenida dentro de la slide");

    await tarjeta.getByRole("button", { name: "Quitar" }).click();
    await esperar(page, tarjeta, [], "Quitada");
    await tarjeta.getByRole("button", { name: "Listo" }).click();
    log(`Errores de página: ${errores.length ? errores.join(" | ") : "ninguno"}`);
    if (errores.length) process.exitCode = 1;
  } finally {
    await navegador.close();
  }
}

main().catch((err: unknown) => {
  console.error(`✗ ${err instanceof Error ? err.message : err}`);
  process.exitCode = 1;
});
