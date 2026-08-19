/**
 * Canjea el grant code de Zoho por un refresh token y lo guarda en `.env.local`.
 *
 * Sustituye al `curl` + copiar/pegar + editar el fichero a mano, que es donde
 * se pierde el tiempo: el grant code caduca a los 10 minutos y solo sirve una
 * vez, así que cualquier paso manual de más suele acabar en «invalid_code».
 *
 * EJECÚTALO EN TU TERMINAL, no a través del asistente: maneja el client secret.
 * No imprime jamás el secret ni el refresh token; solo dice si ha funcionado.
 *
 *   npm run pm:zoho-auth -- --dc eu
 *
 * Sin argumentos pide los tres datos de uno en uno, con el secret oculto al
 * teclearlo. Es la forma recomendada: no queda nada en el historial del shell
 * ni hay que pelearse con el escapado de comillas de Windows.
 *
 * También admite `--client-id`, `--client-secret` y `--code`, o las variables
 * ZOHO_CLIENT_ID / ZOHO_CLIENT_SECRET / ZOHO_GRANT_CODE, para poder automatizarlo.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { cargarEnv, ficherosEnvPresentes } from "./lib/env";
import { hayTerminal, preguntar } from "./lib/preguntar";

const ENV_PATH = resolve(process.cwd(), ".env.local");

function arg(nombre: string): string | undefined {
  const i = process.argv.indexOf(`--${nombre}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

/** Los dominios de Zoho cambian por centro de datos y no son intercambiables. */
const CENTROS: Record<string, { accounts: string; api: string }> = {
  eu: { accounts: "https://accounts.zoho.eu", api: "https://www.zohoapis.eu" },
  com: { accounts: "https://accounts.zoho.com", api: "https://www.zohoapis.com" },
  in: { accounts: "https://accounts.zoho.in", api: "https://www.zohoapis.in" },
  "com.au": { accounts: "https://accounts.zoho.com.au", api: "https://www.zohoapis.com.au" },
  jp: { accounts: "https://accounts.zoho.jp", api: "https://www.zohoapis.jp" },
  ca: { accounts: "https://accounts.zohocloud.ca", api: "https://www.zohoapis.ca" },
};

/** Reescribe las claves indicadas conservando el resto del fichero intacto. */
function guardarEnEnvLocal(valores: Record<string, string>): void {
  let contenido = "";
  try {
    contenido = readFileSync(ENV_PATH, "utf8");
  } catch {
    contenido = "";
  }

  let texto = contenido;
  const nuevas: string[] = [];

  for (const [clave, valor] of Object.entries(valores)) {
    const re = new RegExp(`^${clave}=.*$`, "m");
    if (re.test(texto)) texto = texto.replace(re, `${clave}=${valor}`);
    else nuevas.push(`${clave}=${valor}`);
  }

  if (nuevas.length > 0) {
    const sep = texto.endsWith("\n") || texto === "" ? "" : "\n";
    texto += `${sep}\n# --- Zoho CRM · Avance de obra (escrito por pm:zoho-auth) ---\n${nuevas.join("\n")}\n`;
  }

  writeFileSync(ENV_PATH, texto, "utf8");
}

async function main(): Promise<void> {
  cargarEnv();

  const dc = (arg("dc") ?? "eu").toLowerCase();
  const centro = CENTROS[dc];
  if (!centro) {
    throw new Error(
      `Centro de datos «${dc}» desconocido. Admitidos: ${Object.keys(CENTROS).join(", ")}. ` +
        "Es el dominio donde abres el CRM: crm.zoho.eu → eu, crm.zoho.com → com.",
    );
  }

  let clientId = arg("client-id") ?? process.env.ZOHO_CLIENT_ID;
  let clientSecret = arg("client-secret") ?? process.env.ZOHO_CLIENT_SECRET;
  let code = arg("code") ?? process.env.ZOHO_GRANT_CODE;

  // Si falta algo y hay a quién preguntar, se pregunta. Es el modo normal: nada
  // queda en el historial del shell y no hay que pelearse con las comillas.
  if ((!clientId || !clientSecret || !code) && hayTerminal()) {
    console.log(
      `\nCredenciales del Self Client (api-console.zoho.${dc} → tu cliente).\n` +
        "El código sale de «Generate Code» y caduca a los 10 minutos.\n",
    );
    if (!clientId) clientId = await preguntar("Client ID:     ");
    if (!clientSecret) clientSecret = await preguntar("Client Secret: ", true);
    if (!code) code = await preguntar("Grant code:    ");
    console.log("");
  }

  const faltan = [
    !clientId && "client id",
    !clientSecret && "client secret",
    !code && "grant code",
  ].filter(Boolean);
  if (faltan.length > 0) {
    throw new Error(
      `Faltan datos: ${faltan.join(", ")}\n\n` +
        `  npm run pm:zoho-auth -- --dc ${dc}\n\n` +
        "Lánzalo sin más argumentos y te los pide de uno en uno (el secret no se ve al teclearlo).\n" +
        `El client id y el secret están en api-console.zoho.${dc} → tu Self Client.`,
    );
  }

  const url = new URL(`${centro.accounts}/oauth/v2/token`);
  url.searchParams.set("grant_type", "authorization_code");
  url.searchParams.set("client_id", clientId!);
  url.searchParams.set("client_secret", clientSecret!);
  url.searchParams.set("code", code!);

  console.log(`canjeando el código en ${centro.accounts}…`);
  const res = await fetch(url, { method: "POST" });
  const body = (await res.json().catch(() => ({}))) as {
    refresh_token?: string;
    access_token?: string;
    api_domain?: string;
    error?: string;
  };

  if (!body.refresh_token) {
    // Los tres errores que salen siempre, con su causa real.
    const pistas: Record<string, string> = {
      invalid_code:
        "el código ha caducado (dura 10 minutos) o ya se había usado — genera otro en «Generate Code»",
      invalid_client:
        `el centro de datos no coincide: has usado «${dc}», prueba con el dominio donde abres el CRM`,
      invalid_client_secret: "el client secret no corresponde a ese client id",
    };
    const err = body.error ?? `respuesta inesperada (HTTP ${res.status})`;
    throw new Error(
      `Zoho no devolvió refresh_token: ${err}` +
        (pistas[err] ? `\n  → ${pistas[err]}` : "") +
        (body.access_token
          ? "\n  → llegó access_token pero no refresh_token: el Self Client ya tenía un token para " +
            "ese scope. Revócalo en la consola y genera el código otra vez."
          : ""),
    );
  }

  guardarEnEnvLocal({
    ZOHO_ACCOUNTS_URL: centro.accounts,
    // El api_domain de la respuesta manda sobre el de la tabla: Zoho puede
    // devolver uno distinto según cómo esté provisionada la organización.
    ZOHO_API_DOMAIN: body.api_domain ?? centro.api,
    ZOHO_CLIENT_ID: clientId!,
    ZOHO_CLIENT_SECRET: clientSecret!,
    ZOHO_REFRESH_TOKEN: body.refresh_token,
    ZOHO_MODULO_PROMOCIONES: process.env.ZOHO_MODULO_PROMOCIONES ?? "",
  });

  console.log(
    "\n✓ Credenciales guardadas en .env.local (no se imprimen aquí).\n" +
      `  centro de datos: ${body.api_domain ?? centro.api}\n\n` +
      `  ficheros de entorno presentes: ${ficherosEnvPresentes().join(", ")}\n\n` +
      "Siguiente paso:  npm run pm:zoho-explore",
  );
  if (arg("client-secret")) {
    console.log(
      "\n⚠ Has pasado el secret como argumento: queda en el historial del shell.\n" +
        "  Límpialo si es un equipo compartido.",
    );
  }
}

// `process.exitCode` y no `process.exit()`: en Windows, salir de golpe con una
// petición todavía cerrándose dispara un assert de libuv que tapa el error real.
main().catch((err: unknown) => {
  console.error(`\n${err instanceof Error ? err.message : err}`);
  process.exitCode = 1;
});
