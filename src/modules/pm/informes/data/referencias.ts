import { readFileSync } from "node:fs";
import { join } from "node:path";

import { parsearBiblioteca, type EntradaBiblioteca } from "../logic/biblioteca";
import type { Referencias } from "../logic/prompts";

/**
 * Referencias del skill (catálogo de layouts, reglas de redacción, biblioteca
 * y API de componentes). Se leen en el servidor: no viajan al navegador salvo
 * la biblioteca, que se enseña en el paso 3. next.config incluye la carpeta en
 * el bundle de las funciones (outputFileTracingIncludes).
 */
const CARPETA = join(process.cwd(), "src/modules/pm/informes/referencia");

let cache: { referencias: Referencias; biblioteca: EntradaBiblioteca[] } | null = null;

function leer(nombre: string): string {
  return readFileSync(join(CARPETA, nombre), "utf8").replace(/\r\n/g, "\n");
}

export function cargarReferencias(): { referencias: Referencias; biblioteca: EntradaBiblioteca[] } {
  if (cache && process.env.NODE_ENV === "production") return cache;
  const layouts = leer("layouts.md");
  cache = {
    referencias: {
      // Sin el ejemplo final, como construir_app.py:recetas().
      recetas: layouts.split("## Ejemplo de slide compuesto")[0]!.trim(),
      api: leer("api-componentes.d.ts.txt").trim(),
      reglas: leer("redaccion.md").trim(),
    },
    biblioteca: parsearBiblioteca(leer("biblioteca.md")),
  };
  return cache;
}
