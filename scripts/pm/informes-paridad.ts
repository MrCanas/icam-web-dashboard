/**
 * Paridad de las slides nativas con el visor del skill `informe-trimestral`.
 *
 * Abre en Edge headless el visor original (publicar/local.html de un informe
 * ya construido) y la galería del portal con el MISMO informe.json, y compara
 * nodo a nodo el estilo computado (fuente, peso, tamaño, color, tracking,
 * interlineado, mayúsculas, márgenes del aireado) y la caja de cada nodo, más
 * el relleno que mide `airear` en cada slide. Tiene que salir 0 diferencias.
 *
 * Requiere el portal en marcha (npm run dev) y un usuario con acceso a pm.
 *
 *   npm run pm:informes-paridad -- --email alguien@imparcapital.com
 *   npm run pm:informes-paridad -- --visor "<carpeta>/publicar/local.html" --url http://localhost:3000
 */
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import type { Page } from "playwright-core";

import { cargarEnv } from "./lib/env";
import { abrirEdge, contextoConSesion } from "./lib/navegador";

const ORIG = resolve(process.env.USERPROFILE ?? "", "OneDrive - Impar Capital/Documentos/ImparOS-InformesTrimestrales");

function arg(nombre: string, porDefecto?: string): string | undefined {
  const i = process.argv.indexOf(`--${nombre}`);
  return i > 0 ? process.argv[i + 1] : porDefecto;
}

interface Nodo {
  slide: string;
  i: number;
  tag: string;
  clase: string;
  estilo: Record<string, string>;
  caja: [number, number, number, number];
  texto: string;
}

const PROPIEDADES = [
  "font-family",
  "font-weight",
  "font-size",
  "font-style",
  "color",
  "letter-spacing",
  "line-height",
  "text-transform",
  "text-align",
  "margin-top",
  "padding-top",
  "padding-bottom",
  "display",
  "list-style-type",
  "background-color",
];

/**
 * Recorre cada .iq-slide (en orden) y saca estilo y caja de todos sus nodos. Va como texto: tsx
 * reescribe las funciones con un helper `__name` que no existe dentro de la página.
 */
const RECOGER = `(props) => {
  const out = [];
  document.querySelectorAll(".iq-slide").forEach((slide, si) => {
    const base = slide.getBoundingClientRect();
    const k = base.width / 960;
    [slide, ...slide.querySelectorAll("*")].forEach((el, i) => {
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      const estilo = {};
      for (const p of props) estilo[p] = cs.getPropertyValue(p);
      out.push({
        slide: String(si + 1), i, tag: el.tagName.toLowerCase(),
        clase: typeof el.className === "string" ? el.className : (el.getAttribute("class") || ""),
        estilo,
        caja: [(r.left - base.left) / k, (r.top - base.top) / k, r.width / k, r.height / k].map((v) => Math.round(v * 2) / 2),
        texto: Array.from(el.childNodes).filter((n) => n.nodeType === 3).map((n) => n.nodeValue).join("").trim().slice(0, 40),
      });
    });
  });
  return out;
}`;

async function recoger(page: Page): Promise<Nodo[]> {
  // La caja de un <img height:auto> depende de que haya cargado.
  await page.waitForFunction("Array.from(document.images).every((i) => i.complete)", undefined, { timeout: 60_000 });
  return page.evaluate(`(${RECOGER})(${JSON.stringify(PROPIEDADES)})`) as Promise<Nodo[]>;
}

async function medidas(page: Page): Promise<{ id: string; ocupacion: number | null; relleno: number | null; desborde: boolean }[]> {
  return JSON.parse((await page.getAttribute("body", "data-medidas")) ?? "[]");
}

/**
 * Iguales, salvo ruido en los márgenes que calcula el aireado: se mide a escala (el visor y el portal no
 * pintan al mismo ancho) y el navegador cuantiza la maquetación en 1/64 px. Tolerancia: una unidad.
 */
function iguales(a: string, b: string): boolean {
  if (a === b) return true;
  const px = /^(-?[\d.]+)px$/;
  const ma = px.exec(a);
  const mb = px.exec(b);
  return !!ma && !!mb && Math.abs(Number(ma[1]) - Number(mb[1])) <= 1 / 64 + 1e-6;
}

async function main() {
  cargarEnv();
  const visor = resolve(arg("visor", join(ORIG, "informes/SE84/Q2 2026/publicar/local.html"))!);
  const url = arg("url", "http://localhost:3000")!;
  const email = arg("email", process.env.INFORMES_EMAIL_PRUEBAS);
  if (!email) throw new Error("Indica --email (usuario con acceso a Proyectos) o INFORMES_EMAIL_PRUEBAS");
  if (!existsSync(visor)) throw new Error(`No existe ${visor}`);

  const html = readFileSync(visor, "utf8");
  const m = /<script id="informe-datos" type="application\/json">([\s\S]*?)<\/script>/.exec(html);
  if (!m) throw new Error("El visor no lleva el informe embebido");
  const informe = m[1]!.replace(/<\\\//g, "</");
  const tmp = mkdtempSync(join(tmpdir(), "paridad-"));
  const ruta = join(tmp, "informe.json");
  writeFileSync(ruta, informe, "utf8");
  const fotos = join(dirname(visor), "fotos");

  const navegador = await abrirEdge();
  try {
    // 1. Visor original.
    const a = await navegador.newPage({ viewport: { width: 1400, height: 1000 } });
    // El tracking de h2/h3 con el que se aprobaron los informes (app del equipo) está fijado en slides.css;
    // el visor del skill no lo lleva. Se le añade para comparar contra lo aprobado (--sin-tracking-app: no).
    if (!process.argv.includes("--sin-tracking-app")) {
      await a.addInitScript({
        content: `document.addEventListener("DOMContentLoaded", function () {
          var st = document.createElement("style");
          st.textContent = ".iq-slide h2 { letter-spacing: .02em; } .iq-slide h3 { letter-spacing: .08em; }";
          document.head.appendChild(st);
        });`,
      });
    }
    await a.goto(pathToFileURL(visor).href);
    await a.waitForSelector("body[data-listo]", { timeout: 60_000 });
    const nodosA = await recoger(a);
    const medA = await medidas(a);

    // 2. Galería del portal con el mismo JSON; las fotos relativas se sirven desde publicar/fotos.
    const ctx = await contextoConSesion(navegador, url, email);
    const b = await ctx.newPage();
    await b.route("**/dashboard/pm/informes/fotos/**", (route) => {
      const nombre = decodeURIComponent(new URL(route.request().url()).pathname.split("/fotos/")[1] ?? "");
      const f = join(fotos, nombre);
      return existsSync(f) ? route.fulfill({ path: f }) : route.fulfill({ status: 404 });
    });
    await b.goto(`${url}/dashboard/pm/informes/galeria`);
    await b.setInputFiles('input[type="file"]', ruta);
    await b.waitForSelector("body[data-listo]", { timeout: 120_000 });
    const nodosB = await recoger(b);
    const medB = await medidas(b);

    // 3. Comparación.
    const difs: string[] = [];
    if (nodosA.length !== nodosB.length) difs.push(`Nº de nodos: visor ${nodosA.length}, portal ${nodosB.length}`);
    const n = Math.min(nodosA.length, nodosB.length);
    for (let i = 0; i < n; i++) {
      const x = nodosA[i]!;
      const y = nodosB[i]!;
      const donde = `slide ${x.slide} · nodo ${x.i} <${x.tag} class="${x.clase}">${x.texto ? ` «${x.texto}»` : ""}`;
      if (x.tag !== y.tag || x.clase !== y.clase) {
        difs.push(`${donde}: estructura distinta (portal <${y.tag} class="${y.clase}">)`);
        break; // a partir de aquí los nodos ya no se corresponden
      }
      for (const p of PROPIEDADES) {
        if (!iguales(x.estilo[p]!, y.estilo[p]!)) difs.push(`${donde}: ${p} ${x.estilo[p]} ≠ ${y.estilo[p]}`);
      }
      if (x.caja.some((v, j) => Math.abs(v - y.caja[j]!) > 0.5)) {
        difs.push(`${donde}: caja ${x.caja.join(",")} ≠ ${y.caja.join(",")}`);
      }
    }
    const porId = new Map(medB.map((q) => [q.id, q]));
    for (const q of medA) {
      const r = porId.get(q.id);
      if (!r) difs.push(`relleno: falta la slide ${q.id} en el portal`);
      else if (q.ocupacion !== r.ocupacion || q.relleno !== r.relleno || q.desborde !== r.desborde) {
        difs.push(`relleno ${q.id}: visor ${q.ocupacion}/${q.relleno}${q.desborde ? " desborda" : ""} ≠ portal ${r.ocupacion}/${r.relleno}${r.desborde ? " desborda" : ""}`);
      }
    }

    console.log(`Slides: ${medA.length} · nodos comparados: ${n} · propiedades: ${PROPIEDADES.join(", ")}`);
    if (!difs.length) {
      console.log("✓ 0 diferencias de estilo, caja y relleno.");
    } else {
      console.log(`✗ ${difs.length} diferencias:`);
      for (const d of difs.slice(0, 80)) console.log(`  ${d}`);
      process.exitCode = 1;
    }
  } finally {
    await navegador.close();
  }
}

main().catch((err: unknown) => {
  console.error(`✗ ${err instanceof Error ? err.message : err}`);
  process.exitCode = 1;
});
