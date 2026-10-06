import type { PasarelaCorreo, RespuestaPasarela } from "@/modules/comunicaciones/data/pasarela/tipos";
import { normalizarEmail } from "@/modules/comunicaciones/logic/candado";
import type { CorreoSaliente } from "@/modules/comunicaciones/logic/envio";

/**
 * La pasarela real: el ÚNICO fichero del portal que le pide a Zoho que envíe un
 * correo.
 *
 * Usa un token propio, `ZOHO_REFRESH_TOKEN_ENVIOS`, distinto del que usan
 * Inversores y Avance de obra (`ZOHO_REFRESH_TOKEN`), que no tiene permiso de
 * envío. Por eso no reutiliza `src/lib/zoho/client.ts`: aquel cliente cachea un
 * solo token, y mezclarlos sería dar permiso de envío a quien no lo pidió.
 *
 * Donde ese token no existe, esta pasarela no arranca. Permisos que necesita:
 * `ZohoCRM.send_mail.all.CREATE` y `ZohoCRM.settings.emails.READ`.
 *
 * Nadie la llama directamente: se llega a ella por `enviarConCandado`.
 *
 * Solo servidor.
 */

export const VARIABLE_TOKEN_ENVIOS = "ZOHO_REFRESH_TOKEN_ENVIOS";

const VARIABLES = [
  "ZOHO_ACCOUNTS_URL",
  "ZOHO_API_DOMAIN",
  "ZOHO_CLIENT_ID",
  "ZOHO_CLIENT_SECRET",
  VARIABLE_TOKEN_ENVIOS,
] as const;

export function hayTokenDeEnvios(): boolean {
  return Boolean(process.env[VARIABLE_TOKEN_ENVIOS]?.trim());
}

export class SinTokenDeEnviosError extends Error {
  constructor(faltan: readonly string[]) {
    super(
      `La pasarela de Zoho no puede arrancar: falta ${faltan.join(", ")}. ` +
        "Sin el token de envíos no sale ningún correo.",
    );
    this.name = "SinTokenDeEnviosError";
  }
}

interface ConfigEnvios {
  accountsUrl: string;
  apiDomain: string;
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}

function configDeEnvios(): ConfigEnvios {
  const faltan = VARIABLES.filter((v) => !process.env[v]?.trim());
  if (faltan.length > 0) throw new SinTokenDeEnviosError(faltan);
  const limpia = (s: string) => s.trim().replace(/\/+$/, "");
  return {
    accountsUrl: limpia(process.env.ZOHO_ACCOUNTS_URL!),
    apiDomain: limpia(process.env.ZOHO_API_DOMAIN!),
    clientId: process.env.ZOHO_CLIENT_ID!.trim(),
    clientSecret: process.env.ZOHO_CLIENT_SECRET!.trim(),
    refreshToken: process.env[VARIABLE_TOKEN_ENVIOS]!.trim(),
  };
}

// ---------------------------------------------------------------------------
// Token — caché propia, separada de la del cliente compartido
// ---------------------------------------------------------------------------

let cacheToken: { token: string; expiraEn: number } | null = null;

async function accessTokenDeEnvios(cfg: ConfigEnvios): Promise<string> {
  if (cacheToken && Date.now() < cacheToken.expiraEn) return cacheToken.token;

  const url = new URL(`${cfg.accountsUrl}/oauth/v2/token`);
  url.searchParams.set("refresh_token", cfg.refreshToken);
  url.searchParams.set("client_id", cfg.clientId);
  url.searchParams.set("client_secret", cfg.clientSecret);
  url.searchParams.set("grant_type", "refresh_token");

  const res = await fetch(url, { method: "POST" });
  const body = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
  };
  if (!res.ok || !body.access_token) {
    throw new Error(
      `Zoho no devolvió el token de envíos (${res.status}): ${body.error ?? "sin detalle"}. ` +
        `Revisa ${VARIABLE_TOKEN_ENVIOS}.`,
    );
  }
  cacheToken = {
    token: body.access_token,
    expiraEn: Date.now() + Math.max(0, (body.expires_in ?? 3600) - 60) * 1000,
  };
  return cacheToken.token;
}

async function zohoEnvios(path: string, init: RequestInit = {}): Promise<{ status: number; body: unknown }> {
  const cfg = configDeEnvios();
  const token = await accessTokenDeEnvios(cfg);
  const res = await fetch(`${cfg.apiDomain}/crm/v8${path}`, {
    ...init,
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const body: unknown = res.status === 204 ? {} : await res.json().catch(() => ({}));
  return { status: res.status, body };
}

// ---------------------------------------------------------------------------
// Remitentes
// ---------------------------------------------------------------------------

export interface RemitenteZoho {
  email: string;
  nombre: string | null;
  /** `primary`, `imap` u `org_email`. */
  tipo: string;
}

let cacheRemitentes: { lista: RemitenteZoho[]; expiraEn: number } | null = null;

/**
 * Las direcciones con las que Zoho deja enviar al usuario dueño del token.
 *
 * Zoho rechaza cualquier otra, así que se comprueba antes de intentar el envío
 * y el error que se enseña es legible. Solo lectura.
 */
export async function remitentesDeZoho(): Promise<RemitenteZoho[]> {
  if (cacheRemitentes && Date.now() < cacheRemitentes.expiraEn) return cacheRemitentes.lista;

  const { status, body } = await zohoEnvios("/settings/emails/actions/from_addresses");
  if (status < 200 || status >= 300) {
    const b = body as { code?: string; message?: string };
    throw new Error(
      `Zoho no devolvió los remitentes (${status}): ${b.code ?? ""} ${b.message ?? JSON.stringify(body)}`,
    );
  }
  const crudos = (body as { from_addresses?: Record<string, unknown>[] }).from_addresses ?? [];
  const lista = crudos
    .filter((c) => typeof c.email === "string" && c.email.trim())
    .map((c) => ({
      email: normalizarEmail(String(c.email)),
      nombre: typeof c.user_name === "string" ? c.user_name : null,
      tipo: typeof c.type === "string" ? c.type : "",
    }));
  cacheRemitentes = { lista, expiraEn: Date.now() + 5 * 60 * 1000 };
  return lista;
}

/**
 * La entrada de Zoho que corresponde a un remitente.
 *
 * La misma dirección puede venir dos veces: como buzón del usuario (`pop`,
 * `imap`, `primary`) y como dirección de la organización (`org_email`). Se
 * prefiere la de la organización, que es por donde envía el kiosk «Emails a
 * Fondos/Promos» y no depende del buzón personal de nadie.
 */
export function elegirRemitente(remitentes: readonly RemitenteZoho[], email: string): RemitenteZoho | null {
  const suyas = remitentes.filter((r) => r.email === normalizarEmail(email));
  return suyas.find((r) => r.tipo === "org_email") ?? suyas[0] ?? null;
}

// ---------------------------------------------------------------------------
// Envío
// ---------------------------------------------------------------------------

interface RespuestaEnvio {
  data?: { code?: string; message?: string; status?: string; details?: Record<string, unknown> }[];
  code?: string;
  message?: string;
}

function direcciones(emails: readonly string[]): { email: string }[] {
  return emails.map((email) => ({ email }));
}

/** El cuerpo de la llamada, tal como lo espera Zoho. Exportado para probarlo sin red. */
export function cuerpoDeEnvio(correo: CorreoSaliente, remitente: RemitenteZoho): Record<string, unknown> {
  const mensaje: Record<string, unknown> = {
    from: remitente.nombre
      ? { user_name: remitente.nombre, email: remitente.email }
      : { email: remitente.email },
    to: direcciones(correo.para),
    template: { id: correo.plantillaId },
    // Solo las direcciones de la organización salen por el servidor de Zoho.
    org_email: remitente.tipo === "org_email",
  };
  if (correo.copia.length > 0) mensaje.cc = direcciones(correo.copia);
  if (correo.copiaOculta.length > 0) mensaje.bcc = direcciones(correo.copiaOculta);
  return { data: [mensaje] };
}

async function enviar(correo: CorreoSaliente): Promise<RespuestaPasarela> {
  try {
    const remitente = elegirRemitente(await remitentesDeZoho(), correo.remitente);
    if (!remitente) {
      return {
        ok: false,
        error: `Zoho no acepta ${correo.remitente} como remitente con el token de envíos.`,
      };
    }

    // Zoho resuelve la plantilla con el registro sobre el que se envía y
    // archiva el correo en su ficha.
    const { modulo, id } = correo.registro;
    const { status, body } = await zohoEnvios(
      `/${encodeURIComponent(modulo)}/${encodeURIComponent(id)}/actions/send_mail`,
      { method: "POST", body: JSON.stringify(cuerpoDeEnvio(correo, remitente)) },
    );

    const r = body as RespuestaEnvio;
    const primero = r.data?.[0];
    const messageId = primero?.details?.message_id;
    if (primero?.code === "SUCCESS" && typeof messageId === "string" && messageId) {
      return { ok: true, messageId };
    }
    const codigo = primero?.code ?? r.code ?? `HTTP ${status}`;
    const detalle = primero?.message ?? r.message ?? JSON.stringify(body).slice(0, 300);
    return { ok: false, error: `Zoho no envió el correo (${codigo}): ${detalle}` };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Lanza si falta el token de envíos o cualquiera de las credenciales de Zoho. */
export function crearPasarelaZoho(): PasarelaCorreo {
  configDeEnvios();
  return { nombre: "zoho", enviar };
}
