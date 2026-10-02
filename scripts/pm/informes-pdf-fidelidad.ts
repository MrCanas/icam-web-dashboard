/**
 * Comprueba que el PDF de un informe es fiel a sus slides. Descarga el PDF que
 * genera el servidor (api/informes/pdf) —o lee uno ya descargado, p. ej. de un
 * preview de Vercel— y lo compara, página a página, con las slides pintadas en
 * Edge a su tamaño real:
 *   - tantas páginas como slides visibles, todas de 960 × 540 pt;
 *   - solo las fuentes del informe (Lato y Baskervville), incrustadas;
 *   - el mismo texto en cada página;
 *   - la misma imagen: el PDF se rasteriza con pdf.js y se compara por zonas
 *     con la captura de la slide. Un párrafo que parta las líneas de otra
 *     forma, un fondo que falte o una imagen movida disparan la diferencia.
 *
 * Requiere el portal en marcha y un usuario de pm; no usa Claude.
 *
 *   npm run pm:informes-pdf-fidelidad -- --email x@imparcapital.com --url http://localhost:3210
 *   npm run pm:informes-pdf-fidelidad -- --email x@imparcapital.com --informe SE84_Q3-2026 --pdf descargado.pdf
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { cargarEnv } from "./lib/env";
import { abrirEdge, contextoConSesion } from "./lib/navegador";

function arg(nombre: string, porDefecto?: string): string | undefined {
  const i = process.argv.indexOf(`--${nombre}`);
  return i > 0 ? process.argv[i + 1] : porDefecto;
}

const URL_BASE = arg("url", "http://localhost:3000")!;
const INFORME = arg("informe", "SE84_Q3-2026")!;
const SALIDA = arg("salida", process.cwd())!;
const PDF = arg("pdf");
/** Diferencia media de luminancia (0–255) admitida en la peor zona de una página: por encima, algo se ha movido. */
const UMBRAL = Number(arg("umbral", "22"));
const FUENTES = /Lato|Baskervville/i;

function log(t: string) {
  console.log(`[${new Date().toLocaleTimeString("es-ES")}] ${t}`);
}

interface PaginaPdf {
  ancho: number;
  alto: number;
  texto: string;
  fuentes: string[];
  /** Peor zona y media de la página, y la imagen de diferencias si supera el umbral. */
  peor: number;
  media: number;
  zona: string;
  diferencias: string | null;
}

async function main() {
  cargarEnv();
  const email = arg("email", process.env.INFORMES_EMAIL_PRUEBAS);
  if (!email) throw new Error("Falta --email (un usuario de pm)");
  const navegador = await abrirEdge();
  try {
    const sesion = await contextoConSesion(navegador, URL_BASE, email);
    let pdf: Buffer;
    if (PDF) {
      pdf = readFileSync(resolve(PDF));
      log(`PDF leído de ${PDF} (${Math.round(pdf.length / 1024)} KB)`);
    } else {
      const t = Date.now();
      const r = await sesion.request.get(`${URL_BASE}/api/informes/pdf/${encodeURIComponent(INFORME)}`, { timeout: 240_000 });
      if (!r.ok()) throw new Error(`El servidor no ha generado el PDF (${r.status()}): ${(await r.text()).slice(0, 300)}`);
      pdf = await r.body();
      const destino = join(SALIDA, `${INFORME}.pdf`);
      writeFileSync(destino, pdf);
      log(`PDF generado en ${Math.round((Date.now() - t) / 1000)} s (${Math.round(pdf.length / 1024)} KB): ${destino} · ${r.headers()["content-disposition"]}`);
    }

    // Las slides, a su tamaño real y a doble densidad, como referencia.
    const ctx = await navegador.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
    await ctx.addCookies(await sesion.cookies());
    const page = await ctx.newPage();
    await page.goto(`${URL_BASE}/dashboard/pm/informes/${encodeURIComponent(INFORME)}/imprimir?pdf=1`, { waitUntil: "networkidle", timeout: 240_000 });
    const marca = await page.waitForSelector(".iq-paginas[data-listo], .iq-paginas[data-error]", { state: "attached", timeout: 180_000 });
    const error = await marca.getAttribute("data-error");
    if (error) throw new Error(`La vista de impresión no está lista: ${error}`);
    // El indicador de desarrollo de Next flota sobre la página y saldría en las capturas.
    await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
    const marcos = page.locator(".iq-pagina-pdf .iq-marco");
    const n = await marcos.count();
    const slides: { captura: string; texto: string }[] = [];
    for (let i = 0; i < n; i++) {
      const m = marcos.nth(i);
      await m.scrollIntoViewIfNeeded();
      // Solo el texto que se ve: lo que una plantilla deja fuera de la slide tampoco sale en el PDF.
      const texto = await m.evaluate((marco) => {
        const caja = marco.getBoundingClientRect();
        const rango = document.createRange();
        const w = document.createTreeWalker(marco, NodeFilter.SHOW_TEXT);
        const out: string[] = [];
        for (let nodo = w.nextNode(); nodo; nodo = w.nextNode()) {
          rango.selectNodeContents(nodo);
          const visible = Array.from(rango.getClientRects()).some(
            (r) => r.width > 0 && r.height > 0 && r.left < caja.right && r.right > caja.left && r.top < caja.bottom && r.bottom > caja.top,
          );
          if (visible) out.push(nodo.nodeValue ?? "");
        }
        return out.join(" ");
      });
      slides.push({ captura: (await m.screenshot({ type: "png" })).toString("base64"), texto });
    }
    log(`Slides visibles: ${n}`);

    // pdf.js, servido a la página desde node_modules.
    const dirPdfjs = resolve(process.cwd(), "node_modules/pdfjs-dist/build");
    await page.route("**/__pdfjs/*", (ruta) =>
      ruta.fulfill({ path: join(dirPdfjs, new URL(ruta.request().url()).pathname.split("/").pop()!), contentType: "text/javascript" }),
    );
    // tsx envuelve las funciones con nombre en __name(), que en la página no existe.
    await page.evaluate("globalThis.__name = (f) => f");
    const paginas = await page.evaluate(
      async ({ pdf64, capturas, umbral }) => {
        const pdfjs = await import(/* webpackIgnore: true */ `${location.origin}/__pdfjs/pdf.mjs`);
        pdfjs.GlobalWorkerOptions.workerSrc = `${location.origin}/__pdfjs/pdf.worker.mjs`;
        const doc = await pdfjs.getDocument({ data: Uint8Array.from(atob(pdf64), (c) => c.charCodeAt(0)) }).promise;
        const W = 960;
        const H = 540;
        const lienzo = (w: number, h: number) => {
          const c = document.createElement("canvas");
          c.width = w;
          c.height = h;
          return c;
        };
        // Todo se compara a 960 × 540: reducir desde el doble iguala el suavizado de los dos pintados.
        const reducir = (origen: CanvasImageSource) => {
          const c = lienzo(W, H);
          const g = c.getContext("2d")!;
          g.imageSmoothingQuality = "high";
          g.drawImage(origen, 0, 0, W, H);
          return g.getImageData(0, 0, W, H);
        };
        const out = [];
        for (let i = 1; i <= doc.numPages; i++) {
          const pagina = await doc.getPage(i);
          const base = pagina.getViewport({ scale: 1 });
          const vista = pagina.getViewport({ scale: (2 * W) / base.width });
          const c = lienzo(Math.round(vista.width), Math.round(vista.height));
          await pagina.render({ canvasContext: c.getContext("2d")!, canvas: c, viewport: vista }).promise;
          const texto = (await pagina.getTextContent()).items.map((x: { str?: string }) => x.str ?? "").join(" ");
          const fuentes = new Set<string>();
          const ops = await pagina.getOperatorList();
          ops.fnArray.forEach((fn: number, k: number) => {
            if (fn !== pdfjs.OPS.setFont) return;
            try {
              fuentes.add(String(pagina.commonObjs.get(ops.argsArray[k][0])?.name ?? "?"));
            } catch {
              fuentes.add("?");
            }
          });
          let peor = -1;
          let media = -1;
          let zona = "";
          let diferencias: string | null = null;
          const captura = capturas[i - 1];
          if (captura) {
            const img = new Image();
            img.src = `data:image/png;base64,${captura}`;
            await img.decode();
            const a = reducir(img).data;
            const b = reducir(c).data;
            const T = 40;
            const mapa = lienzo(W, H);
            const g = mapa.getContext("2d")!;
            const px = g.createImageData(W, H);
            let total = 0;
            const sumas = new Map<string, { s: number; n: number }>();
            for (let y = 0; y < H; y++) {
              for (let x = 0; x < W; x++) {
                const k = (y * W + x) * 4;
                const la = 0.299 * a[k]! + 0.587 * a[k + 1]! + 0.114 * a[k + 2]!;
                const lb = 0.299 * b[k]! + 0.587 * b[k + 1]! + 0.114 * b[k + 2]!;
                const d = Math.abs(la - lb);
                total += d;
                const clave = `${Math.floor(x / T)},${Math.floor(y / T)}`;
                const z = sumas.get(clave) ?? { s: 0, n: 0 };
                z.s += d;
                z.n++;
                sumas.set(clave, z);
                px.data[k] = 255;
                px.data[k + 1] = px.data[k + 2] = 255 - Math.min(255, d * 4);
                px.data[k + 3] = 255;
              }
            }
            media = total / (W * H);
            for (const [clave, z] of sumas) {
              if (z.s / z.n > peor) {
                peor = z.s / z.n;
                zona = clave;
              }
            }
            if (peor > umbral) {
              g.putImageData(px, 0, 0);
              diferencias = mapa.toDataURL("image/png").split(",")[1]!;
            }
          }
          out.push({ ancho: base.width, alto: base.height, texto, fuentes: [...fuentes], peor, media, zona, diferencias });
        }
        return out as PaginaPdf[];
      },
      { pdf64: pdf.toString("base64"), capturas: slides.map((s) => s.captura), umbral: UMBRAL },
    );

    const fallos: string[] = [];
    if (paginas.length !== n) fallos.push(`El PDF tiene ${paginas.length} páginas y el informe ${n} slides visibles`);
    // Mismas letras en la página y en la slide (sin espacios ni las viñetas, que pone el CSS).
    // Sin mayúsculas: en la slide las pone el CSS (text-transform) y en el PDF ya vienen puestas.
    const letras = (t: string) => [...t.normalize("NFKC").toLocaleLowerCase("es").replace(/[\s•]/g, "")].sort().join("");
    /** Letras que están en una lista y no en la otra, para decir en qué se diferencian dos textos. */
    const sobrantes = (pdfT: string, slideT: string) => {
      const cuenta = new Map<string, number>();
      for (const c of pdfT) cuenta.set(c, (cuenta.get(c) ?? 0) + 1);
      for (const c of slideT) cuenta.set(c, (cuenta.get(c) ?? 0) - 1);
      const de = (signo: number) =>
        [...cuenta].filter(([, n]) => n * signo > 0).map(([c, n]) => (Math.abs(n) > 1 ? `${c}×${Math.abs(n)}` : c)).join(" ").slice(0, 80);
      return `solo en el PDF: ${de(1) || "nada"}; solo en la slide: ${de(-1) || "nada"}`;
    };
    const fuentes = new Set<string>();
    paginas.forEach((p, i) => {
      const s = slides[i];
      const marcas: string[] = [];
      if (Math.abs(p.ancho - 960) > 0.01 || Math.abs(p.alto - 540) > 0.01) marcas.push(`tamaño ${p.ancho} × ${p.alto} pt`);
      if (s && letras(p.texto) !== letras(s.texto)) {
        const fichero = join(SALIDA, `pdf-texto-${i + 1}.txt`);
        writeFileSync(fichero, `== PDF ==
${p.texto}

== SLIDE ==
${s.texto}
`);
        marcas.push(`el texto no coincide (${sobrantes(letras(p.texto), letras(s.texto))}; ver ${fichero})`);
      }
      if (p.peor > UMBRAL) {
        const [zx, zy] = p.zona.split(",").map(Number);
        const fichero = join(SALIDA, `pdf-diferencias-${i + 1}.png`);
        if (p.diferencias) writeFileSync(fichero, Buffer.from(p.diferencias, "base64"));
        marcas.push(`imagen distinta hacia x ${zx! * 40}, y ${zy! * 40} (${p.peor.toFixed(1)} > ${UMBRAL}; ver ${fichero})`);
      }
      const otras = p.fuentes.filter((f) => !FUENTES.test(f));
      if (otras.length) marcas.push(`fuentes que no son del informe: ${otras.join(", ")}`);
      p.fuentes.forEach((f) => fuentes.add(f.replace(/^[A-Z]{6}\+/, "")));
      log(`${marcas.length ? "✗" : "✓"} Página ${i + 1}: peor zona ${p.peor.toFixed(1)}, media ${p.media.toFixed(2)}${marcas.length ? ` · ${marcas.join(" · ")}` : ""}`);
      if (marcas.length) fallos.push(`Página ${i + 1}: ${marcas.join("; ")}`);
    });
    log(`Fuentes incrustadas: ${[...fuentes].sort().join(", ") || "ninguna"}`);
    if (fallos.length) throw new Error(`${fallos.length} diferencia(s):\n  ${fallos.join("\n  ")}`);
    log(`✓ El PDF es fiel a las ${n} slides: mismo tamaño, mismo texto, mismas fuentes y misma imagen.`);
  } finally {
    await navegador.close();
  }
}

main().catch((err: unknown) => {
  console.error(`✗ ${err instanceof Error ? err.message : err}`);
  process.exitCode = 1;
});
