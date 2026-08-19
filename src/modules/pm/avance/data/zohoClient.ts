/**
 * COSTURA HACIA ZOHO CRM — no es una implementación.
 *
 * Hoy no se envía nada a Zoho automáticamente: los cambios se aprueban a mano y
 * se exportan en CSV/JSON para subirlos desde Zoho. Este fichero existe para que
 * el día que se conecte la API no haya que rediseñar nada, y para que quede
 * escrito exactamente qué falta.
 *
 * Faltan tres cosas y ninguna está en el repositorio:
 *
 *   1. El nombre API del módulo de Promociones
 *      (Zoho → Configuración → Espacio para desarrolladores → APIs).
 *   2. El nombre API de cada uno de los 7 campos de avance, que va en
 *      `pm_avance_fase_catalogo.zoho_api_name` (migración 028). Mientras esté a
 *      NULL, la exportación JSON emite una clave marcada en vez de inventárselo.
 *   3. Credenciales OAuth (self-client) y el centro de datos: los dominios de
 *      Zoho cambian entre `.eu` y `.com` y usar el equivocado da un 401 opaco.
 *
 * Cuando existan: implementar `pushAvance`, añadir una acción que la llame
 * SOLO sobre cambios ya aprobados, y usar el estado `enviado` del outbox, que
 * ya está previsto en el esquema. El modelo de datos no hay que tocarlo.
 *
 * NINGÚN punto del código llama hoy a `pushAvance`. Es intencionado.
 */

export interface ZohoAvanceUpdate {
  /** pm_promociones.zoho_record_id (la parte numérica del id de Zoho). */
  id: string;
  /** { <zoho_api_name>: porcentaje }. */
  data: Record<string, number | null>;
}

export type ZohoPushResult =
  | { ok: true; actualizados: number }
  | { ok: false; error: string };

const VARIABLES = [
  "ZOHO_ACCOUNTS_URL",
  "ZOHO_API_DOMAIN",
  "ZOHO_CLIENT_ID",
  "ZOHO_CLIENT_SECRET",
  "ZOHO_REFRESH_TOKEN",
  "ZOHO_MODULO_PROMOCIONES",
] as const;

/** Variables de entorno que faltan para poder hablar con Zoho. */
export function zohoVariablesQueFaltan(): string[] {
  return VARIABLES.filter((v) => !process.env[v]?.trim());
}

export function isZohoConfigured(): boolean {
  return zohoVariablesQueFaltan().length === 0;
}

export const ZOHO_NO_CONFIGURADO =
  "La integración con Zoho no está configurada. Los cambios aprobados se descargan en CSV/JSON y se suben a Zoho a mano (ver docs/pm/avance-obra-zoho.md).";

/** Reservado. Hoy siempre falla: no hay integración y no debe simularse que la hay. */
export async function pushAvance(_updates: ZohoAvanceUpdate[]): Promise<ZohoPushResult> {
  void _updates;
  return { ok: false, error: ZOHO_NO_CONFIGURADO };
}
