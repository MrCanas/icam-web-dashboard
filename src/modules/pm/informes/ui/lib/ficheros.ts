"use client";

/**
 * Lectura de ficheros en el navegador (el fichero no sale del equipo: solo se
 * guarda el texto). Port de textoPdf / textoOffice / textoHoja / redimensionar
 * de la app original, con pdf.js y JSZip del paquete en vez de CDN.
 */

export const ACEPTA_DOCUMENTOS = ".pdf,.docx,.pptx,.xlsx,.xlsm,.csv,.txt,.md,.json";
export const ACEPTA_FOTOS = "image/jpeg,image/png,image/webp";

export async function extraerTexto(file: File): Promise<string> {
  const n = file.name.toLowerCase();
  if (n.endsWith(".pdf")) return textoPdf(file);
  if (n.endsWith(".pptx")) return textoOffice(file, /^ppt\/slides\/slide(\d+)\.xml$/, "a:p", "a:t", "Slide");
  if (n.endsWith(".docx")) return textoOffice(file, /^word\/document\.xml$/, "w:p", "w:t", null);
  if (/\.(xlsx|xlsm)$/.test(n)) return textoHoja(file);
  if (/\.(txt|md|csv|json)$/.test(n)) return file.text();
  if (n.endsWith(".xls")) throw new Error(`${file.name}: el formato .xls antiguo no se puede leer; guárdalo como .xlsx o CSV`);
  throw new Error(`Formato no admitido: ${file.name}. Pega su contenido en las notas.`);
}

async function textoPdf(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/legacy/build/pdf.worker.min.mjs", import.meta.url).toString();
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  let out = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const pg = await pdf.getPage(i);
    const tc = await pg.getTextContent();
    const t = tc.items
      .map((it) => ("str" in it ? it.str + (it.hasEOL ? "\n" : " ") : ""))
      .join("")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n");
    out += `\n## Página ${i}\n${t.trim()}\n`;
  }
  return out;
}

function decodificar(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, "&");
}

async function textoOffice(file: File, patron: RegExp, parrafo: string, run: string, etiqueta: string | null): Promise<string> {
  const { default: JSZip } = await import("jszip");
  const zip = await JSZip.loadAsync(file);
  const nombres = Object.keys(zip.files)
    .filter((k) => patron.test(k))
    .sort((a, b) => Number(patron.exec(a)?.[1] ?? 0) - Number(patron.exec(b)?.[1] ?? 0));
  const xmls = await Promise.all(nombres.map((k) => zip.file(k)!.async("string")));
  return xmls
    .map((xml, i) => {
      const ps = xml
        .split(`</${parrafo}>`)
        .map((p) => {
          const r = new RegExp(`<${run}(?:\\s[^>]*)?>([^<]*)</${run}>`, "g");
          let m: RegExpExecArray | null;
          let out = "";
          while ((m = r.exec(p))) out += decodificar(m[1]!);
          return out.trim();
        })
        .filter(Boolean);
      return (etiqueta ? `\n## ${etiqueta} ${i + 1}\n` : "") + ps.join("\n");
    })
    .join("\n");
}

/** Hojas de un .xlsx como tablas de texto (columnas separadas por « | »), sin librería de Excel. */
async function textoHoja(file: File): Promise<string> {
  const { default: JSZip } = await import("jszip");
  const zip = await JSZip.loadAsync(file);
  const leer = (k: string) => zip.file(k)?.async("string") ?? Promise.resolve("");
  const compartidas = [...(await leer("xl/sharedStrings.xml")).matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) =>
    decodificar([...m[1]!.matchAll(/<t(?:\s[^>]*)?>([^<]*)<\/t>/g)].map((t) => t[1]).join("")),
  );
  const libro = await leer("xl/workbook.xml");
  const rels = await leer("xl/_rels/workbook.xml.rels");
  const hojas = [...libro.matchAll(/<sheet\b[^>]*name="([^"]*)"[^>]*r:id="([^"]*)"/g)].map((m) => {
    const destino = new RegExp(`Id="${m[2]}"[^>]*Target="([^"]*)"`).exec(rels)?.[1] ?? "";
    return { nombre: decodificar(m[1]!), ruta: "xl/" + destino.replace(/^\/?xl\//, "") };
  });
  const partes: string[] = [];
  for (const h of hojas) {
    const xml = await leer(h.ruta);
    const filas = [...xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)].map((r) =>
      [...r[1]!.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)]
        .map((c) => {
          const attrs = c[1] ?? "";
          const cuerpo = c[2] ?? "";
          const v = /<v>([^<]*)<\/v>/.exec(cuerpo)?.[1];
          if (/t="s"/.test(attrs) && v != null) return compartidas[Number(v)] ?? "";
          if (/t="inlineStr"/.test(attrs)) return decodificar(/<t(?:\s[^>]*)?>([^<]*)<\/t>/.exec(cuerpo)?.[1] ?? "");
          return v != null ? decodificar(v) : "";
        })
        .join(" | ")
        .replace(/( \| )+$/, ""),
    );
    const texto = filas.filter((f) => f.replace(/[ |]/g, "")).join("\n");
    partes.push(`\n## Tabla «${h.nombre}» (columnas separadas por |)\n${texto}`);
  }
  return partes.join("\n");
}

/** Reduce una foto a ≤ 1600 px y la pasa a JPEG 0,85. */
export async function redimensionar(file: Blob): Promise<{ blob: Blob; ancho: number; alto: number }> {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const ancho = Math.round(bmp.width * k);
  const alto = Math.round(bmp.height * k);
  const cv = document.createElement("canvas");
  cv.width = ancho;
  cv.height = alto;
  cv.getContext("2d")!.drawImage(bmp, 0, 0, ancho, alto);
  const blob = await new Promise<Blob>((ok, ko) => cv.toBlob((b) => (b ? ok(b) : ko(new Error("No se ha podido convertir la foto"))), "image/jpeg", 0.85));
  return { blob, ancho, alto };
}

export async function aBase64(blob: Blob): Promise<string> {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let s = "";
  for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(s);
}
