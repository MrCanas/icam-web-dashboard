/**
 * Envío de correo vía Microsoft Graph (flujo app-only / client credentials).
 *
 * El token de aplicación y su caché viven en `@/lib/graph/client` (compartidos con
 * SharePoint). Aquí solo se compone y envía el POST /users/{EMAIL_FROM}/sendMail.
 *
 * Seguridad: credenciales y token nunca se escriben en logs ni en errores. SOLO servidor.
 */
import { getM365Config } from "./m365-config";
import { GRAPH_BASE, getGraphToken } from "@/lib/graph/client";

export interface SendGraphMailInput {
  to: string;
  subject: string;
  /** Cuerpo HTML. */
  html: string;
}

export async function sendGraphMail(input: SendGraphMailInput): Promise<void> {
  const cfg = getM365Config();
  const token = await getGraphToken();

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
