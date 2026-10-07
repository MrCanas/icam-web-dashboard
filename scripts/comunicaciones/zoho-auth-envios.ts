/**
 * Canjea un grant code de Zoho por el token de ENVÍOS y lo guarda en `.env.local`
 * como `ZOHO_REFRESH_TOKEN_ENVIOS`.
 *
 * NO es `pm:zoho-auth`: aquel escribe `ZOHO_REFRESH_TOKEN`, el token de lectura
 * que usan Inversores y Avance de obra. Usarlo para esto lo machacaría con un
 * token que no puede leer. Este script solo toca la clave de envíos.
 *
 * EJECÚTALO EN TU TERMINAL, no a través del asistente: es un inicio de sesión
 * tuyo. No imprime el token; solo dice si ha funcionado.
 *
 * Antes, en https://api-console.zoho.eu → el Self Client del portal → «Generate
 * Code», con este scope (y nada más):
 *
 *   ZohoCRM.send_mail.all.CREATE,ZohoCRM.settings.emails.READ
 *
 * Y después, antes de 10 minutos:
 *
 *   npm run comunicaciones:zoho-auth-envios
 *
 * Usa el client id, el secret y el centro de datos que ya están en `.env.local`;
 * solo pide el código. El usuario que genera el código es el dueño del token:
 * los correos salen con SUS direcciones de remitente y cuentan en SU límite
 * diario (100 correos al día por usuario, según la documentación de Zoho).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { cargarEnv } from "../pm/lib/env";
import { hayTerminal, preguntar } from "../pm/lib/preguntar";

const ENV_PATH = resolve(process.cwd(), ".env.local");
const CLAVE = "ZOHO_REFRESH_TOKEN_ENVIOS";
export const SCOPE_DE_ENVIOS = "ZohoCRM.send_mail.all.CREATE,ZohoCRM.settings.emails.READ";

function arg(nombre: string): string | undefined {
  const i = process.argv.indexOf(`--${nombre}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

/** Escribe SOLO la clave de envíos, conservando el resto del fichero intacto. */
function guardarTokenDeEnvios(valor: string): void {
  let texto = "";
  try {
    texto = readFileSync(ENV_PATH, "utf8");
  } catch {
    texto = "";
  }
  const re = new RegExp(`^${CLAVE}=.*$`, "m");
  if (re.test(texto)) {
    texto = texto.replace(re, `${CLAVE}=${valor}`);
  } else {
    const sep = texto.endsWith("\n") || texto === "" ? "" : "\n";
    texto +=
      `${sep}\n# --- Zoho CRM · token de ENVÍOS de Comunicaciones (escrito por comunicaciones:zoho-auth-envios) ---\n` +
      "# Solo en local para las pruebas y en Producción de Vercel. Nunca en Preview.\n" +
      `${CLAVE}=${valor}\n`;
  }
  writeFileSync(ENV_PATH, texto, "utf8");
}

async function main(): Promise<void> {
  cargarEnv();

  const accounts = process.env.ZOHO_ACCOUNTS_URL?.trim().replace(/\/+$/, "");
  const clientId = process.env.ZOHO_CLIENT_ID?.trim();
  const clientSecret = process.env.ZOHO_CLIENT_SECRET?.trim();
  const faltan = [
    !accounts && "ZOHO_ACCOUNTS_URL",
    !clientId && "ZOHO_CLIENT_ID",
    !clientSecret && "ZOHO_CLIENT_SECRET",
  ].filter(Boolean);
  if (faltan.length > 0) {
    throw new Error(
      `Faltan en .env.local: ${faltan.join(", ")}. Son las credenciales del Self Client del portal ` +
        "(ver docs/pm/01-avance-obra.md § «Conectar la API de Zoho»).",
    );
  }

  let code = arg("code") ?? process.env.ZOHO_GRANT_CODE;
  if (!code && hayTerminal()) {
    console.log(
      "\nToken de ENVÍOS de Comunicaciones.\n" +
        "En la consola de Zoho → Self Client → «Generate Code», con el scope:\n\n" +
        `  ${SCOPE_DE_ENVIOS}\n\n` +
        "El código caduca a los 10 minutos y solo sirve una vez.\n",
    );
    code = await preguntar("Grant code: ");
    console.log("");
  }
  if (!code) throw new Error("Falta el grant code. Lánzalo sin argumentos y te lo pide.");

  const url = new URL(`${accounts}/oauth/v2/token`);
  url.searchParams.set("grant_type", "authorization_code");
  url.searchParams.set("client_id", clientId!);
  url.searchParams.set("client_secret", clientSecret!);
  url.searchParams.set("code", code.trim());

  console.log(`canjeando el código en ${accounts}…`);
  const res = await fetch(url, { method: "POST" });
  const body = (await res.json().catch(() => ({}))) as {
    refresh_token?: string;
    access_token?: string;
    scope?: string;
    error?: string;
  };

  if (!body.refresh_token) {
    const pistas: Record<string, string> = {
      invalid_code: "el código ha caducado (dura 10 minutos) o ya se había usado: genera otro",
      invalid_client: "el client id o el centro de datos de .env.local no son los de ese Self Client",
      invalid_client_secret: "el client secret de .env.local no corresponde a ese client id",
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

  const scope = body.scope ?? "";
  if (scope && !scope.includes("send_mail")) {
    throw new Error(
      `El código se generó con otro scope (${scope}) y no permite enviar. No se ha guardado nada.\n` +
        `Genera otro con: ${SCOPE_DE_ENVIOS}`,
    );
  }

  guardarTokenDeEnvios(body.refresh_token);
  console.log(
    `\n✓ Token de envíos guardado en .env.local como ${CLAVE} (no se imprime aquí).\n` +
      (scope ? `  scope: ${scope}\n` : "") +
      "  El token de lectura (ZOHO_REFRESH_TOKEN) no se ha tocado.\n\n" +
      "Siguiente paso:  npm run comunicaciones:zoho-envio-verificar",
  );
}

// Ver la nota de zoho-auth.ts sobre process.exitCode en Windows.
main().catch((err: unknown) => {
  console.error(`\n${err instanceof Error ? err.message : err}`);
  process.exitCode = 1;
});
