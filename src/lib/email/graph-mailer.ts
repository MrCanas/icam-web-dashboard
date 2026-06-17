/**
 * Envío de correo vía Microsoft Graph (flujo app-only / client credentials).
 *
 * 1) Obtiene un token de aplicación contra el tenant (cacheado en memoria).
 * 2) POST /users/{EMAIL_FROM}/sendMail.
 *
 * Seguridad: el client_secret y el token solo viajan en las peticiones HTTPS a
 * Microsoft; NUNCA se escriben en logs ni se incluyen en los mensajes de error.
 * SOLO servidor.
 */
import { getM365Config, type M365Config } from "./m365-config";

const TOKEN_SCOPE = "https://graph.microsoft.com/.default";
const GRAPH_BASE = "https://graph.microsoft.com/v1.0";
const TOKEN_SKEW_MS = 60_000; // renovar 60 s antes de expirar

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAppToken(cfg: M365Config): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + TOKEN_SKEW_MS) {
    return cachedToken.token;
  }

  const url = `https://login.microsoftonline.com/${encodeURIComponent(
    cfg.tenantId,
  )}/oauth2/v2.0/token`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      scope: TOKEN_SCOPE,
      grant_type: "client_credentials",
    }),
  });

  if (!res.ok) {
    // No incluimos el cuerpo: podría reflejar el client_id/secret enviados.
    throw new Error(
      `No se pudo obtener el token de Microsoft 365 (HTTP ${res.status}). ` +
        "Revisa MS_GRAPH_TENANT_ID / MS_GRAPH_CLIENT_ID / MS_GRAPH_CLIENT_SECRET.",
    );
  }

  const json = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
  };
  if (!json.access_token) {
    throw new Error("Respuesta de token de Microsoft 365 sin access_token.");
  }

  cachedToken = {
    token: json.access_token,
    expiresAt: now + (json.expires_in ?? 3600) * 1000,
  };
  return cachedToken.token;
}

export interface SendGraphMailInput {
  to: string;
  subject: string;
  /** Cuerpo HTML. */
  html: string;
}

export async function sendGraphMail(input: SendGraphMailInput): Promise<void> {
  const cfg = getM365Config();
  const token = await getAppToken(cfg);

  const res = await fetch(
    `${GRAPH_BASE}/users/${encodeURIComponent(cfg.from)}/sendMail`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          subject: input.subject,
          body: { contentType: "HTML", content: input.html },
          toRecipients: [{ emailAddress: { address: input.to } }],
        },
        saveToSentItems: false,
      }),
    },
  );

  // sendMail responde 202 Accepted (cuerpo vacío) en éxito.
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    // El error de Graph no contiene credenciales; se trunca por prudencia.
    throw new Error(
      `Microsoft Graph sendMail falló (HTTP ${res.status})` +
        (detail ? `: ${detail.slice(0, 300)}` : "") +
        ".",
    );
  }
}
