/**
 * Biblioteca de slides (referencia/biblioteca.md → lista). Mismo parseo que
 * construir_app.py:biblioteca() de la app original: una fila por slide con su
 * número estable, nombre, para qué sirve, cuándo sugerirla, id y grupo.
 */

export interface EntradaBiblioteca {
  n: number;
  nombre: string;
  para: string;
  sugerir: string;
  id: string;
  grupo: string;
}

export function parsearBiblioteca(md: string): EntradaBiblioteca[] {
  const filas: EntradaBiblioteca[] = [];
  let grupo = "";
  for (const linea of md.split(/\r?\n/)) {
    if (linea.startsWith("## ")) {
      grupo = linea.slice(3).trim();
      continue;
    }
    const m = /^\|\s*(\d+)\s*\|(.*)\|\s*$/.exec(linea);
    if (!m) continue;
    const celdas = m[2]!.split("|").map((c) => c.trim());
    const id = celdas[celdas.length - 1]!.replace(/^[`\s]+|[`\s]+$/g, "");
    const [nombre, para, sugerir] = celdas.length === 3 ? [celdas[0]!, celdas[1]!, "Siempre"] : [celdas[0]!, celdas[1]!, celdas[2]!];
    filas.push({ n: Number(m[1]), nombre, para, sugerir, id, grupo });
  }
  return filas;
}

/** Slides de estructura: no se ofrecen para añadir. */
export const ESTRUCTURALES = ["portada", "indice", "disclaimer", "cierre"];

/** Entrada de la biblioteca para un id (acepta «situacion-<tema>» y «obra-n»). */
export function entradaDeId(bib: EntradaBiblioteca[], id: string): EntradaBiblioteca | undefined {
  return bib.find((x) => x.id === id || (x.id.indexOf("<") > 0 && id.indexOf(x.id.split("<")[0]!) === 0));
}
