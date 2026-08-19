import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { config } from "dotenv";

let cargado = false;

/**
 * Carga las variables de entorno de los scripts de PM.
 *
 * Lee `.env.local` y TAMBIÉN `.env`. El resto del repo solo mira `.env.local`,
 * pero «.env» es el nombre que la gente escribe por costumbre, y una variable
 * pegada ahí desaparecía sin más: el script decía «faltan credenciales» con el
 * fichero delante. Gana `.env.local` si una clave está en los dos.
 */
export function cargarEnv(): void {
  if (cargado) return;
  for (const nombre of [".env.local", ".env"]) {
    const ruta = resolve(process.cwd(), nombre);
    if (existsSync(ruta)) config({ path: ruta });
  }
  cargado = true;
}

/** Ficheros de entorno que existen ahora mismo, para poder decirlo en los errores. */
export function ficherosEnvPresentes(): string[] {
  return [".env.local", ".env"].filter((n) => existsSync(resolve(process.cwd(), n)));
}
