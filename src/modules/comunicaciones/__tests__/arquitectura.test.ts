import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { test } from "node:test";

// Dos reglas que no dependen de que alguien se acuerde de ellas:
//   · en todo el portal, la llamada de envío de correo de Zoho está en UN fichero;
//   · a las pasarelas solo se llega por `enviarConCandado`.
// Si alguna deja de ser cierta, un correo podría salir sin pasar por el candado.

const SRC = join(process.cwd(), "src");
const PASARELA = ["modules", "comunicaciones", "data", "pasarela"].join("/");

function ficheros(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entrada) => {
    const ruta = join(dir, entrada.name);
    if (entrada.isDirectory()) return entrada.name === "__tests__" ? [] : ficheros(ruta);
    return /\.(ts|tsx)$/.test(entrada.name) ? [ruta] : [];
  });
}

const FUENTES = ficheros(SRC).map((ruta) => ({
  ruta: relative(SRC, ruta).split(sep).join("/"),
  texto: readFileSync(ruta, "utf8"),
}));

test("la llamada de envío de correo de Zoho solo existe en la pasarela de Zoho", () => {
  // `actions/send_mail` es el final de la URL de Zoho. Los correos de Microsoft 365
  // del portal (alertas de actas) van por otra API y no son asunto de esta regla.
  const conEnvio = FUENTES.filter((f) => /actions\/send_mail/.test(f.texto)).map((f) => f.ruta);
  assert.deepEqual(conEnvio, [`${PASARELA}/pasarelaZoho.ts`]);
});

test("fuera de su carpeta nadie importa una pasarela: se entra por enviarConCandado", () => {
  const intrusos = FUENTES.filter(
    (f) => !f.ruta.startsWith(`${PASARELA}/`) && /pasarela\/pasarela(Zoho|Simulada)/.test(f.texto),
  ).map((f) => f.ruta);
  assert.deepEqual(intrusos, []);
});

test("el token de envíos solo se lee en la pasarela de Zoho", () => {
  const lectores = FUENTES.filter((f) => f.texto.includes("ZOHO_REFRESH_TOKEN_ENVIOS")).map((f) => f.ruta);
  assert.deepEqual(lectores, [`${PASARELA}/pasarelaZoho.ts`]);
});
