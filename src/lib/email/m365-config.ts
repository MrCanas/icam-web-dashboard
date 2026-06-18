/**
 * Configuración de Microsoft 365 (Microsoft Graph, app-only) para email transaccional.
 *
 * Lee EXCLUSIVAMENTE las variables ya definidas en `.env.local`:
 *   - MS_GRAPH_TENANT_ID
 *   - MS_GRAPH_CLIENT_ID
 *   - MS_GRAPH_CLIENT_SECRET
 *   - EMAIL_FROM           (buzón remitente, p. ej. noreply@imparcapital.com)
 *
 * No se hardcodea ningún valor: si falta una variable, se detiene y la lista.
 * SOLO servidor — nunca importar desde código cliente.
 */
export interface M365Config {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  from: string;
}

const REQUIRED_VARS = [
  "MS_GRAPH_TENANT_ID",
  "MS_GRAPH_CLIENT_ID",
  "MS_GRAPH_CLIENT_SECRET",
  "EMAIL_FROM",
] as const;

export function getM365Config(): M365Config {
  const missing = REQUIRED_VARS.filter((name) => !process.env[name]?.trim());
  if (missing.length > 0) {
    throw new Error(
      `Faltan variables de entorno para el envío de email M365: ${missing.join(", ")}. ` +
        "Defínelas en .env.local (no se deben hardcodear ni inventar).",
    );
  }

  return {
    tenantId: process.env.MS_GRAPH_TENANT_ID!.trim(),
    clientId: process.env.MS_GRAPH_CLIENT_ID!.trim(),
    clientSecret: process.env.MS_GRAPH_CLIENT_SECRET!.trim(),
    from: process.env.EMAIL_FROM!.trim(),
  };
}
