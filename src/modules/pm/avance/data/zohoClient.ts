/**
 * Cliente de Zoho CRM para Avance de obra.
 *
 * LECTURA automática (traer promociones y su avance), ESCRITURA solo previa
 * aprobación humana: `pushAvance` no se invoca desde ninguna ruta automática,
 * únicamente sobre cambios ya aprobados en la bandeja de salida.
 *
 * Configuración en `.env.local` (ver `.env.local.example` y
 * `docs/pm/01-avance-obra.md`). OJO al centro de datos: los dominios cambian
 * entre `.eu` y `.com` y el equivocado devuelve un 401 sin explicación.
 *
 * Solo servidor: usa el client secret y el refresh token.
 */

export interface ZohoConfig {
  accountsUrl: string;
  apiDomain: string;
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  modulo: string;
}

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
  "La integración con Zoho no está configurada. Faltan variables de entorno; ver docs/pm/01-avance-obra.md.";

export class ZohoNotConfiguredError extends Error {
  constructor(faltan: string[]) {
    super(`${ZOHO_NO_CONFIGURADO} (${faltan.join(", ")})`);
    this.name = "ZohoNotConfiguredError";
  }
}

export function getZohoConfig(): ZohoConfig {
  const faltan = zohoVariablesQueFaltan();
  if (faltan.length > 0) throw new ZohoNotConfiguredError(faltan);
  const limpia = (s: string) => s.trim().replace(/\/+$/, "");
  return {
    accountsUrl: limpia(process.env.ZOHO_ACCOUNTS_URL!),
    apiDomain: limpia(process.env.ZOHO_API_DOMAIN!),
    clientId: process.env.ZOHO_CLIENT_ID!.trim(),
    clientSecret: process.env.ZOHO_CLIENT_SECRET!.trim(),
    refreshToken: process.env.ZOHO_REFRESH_TOKEN!.trim(),
    modulo: process.env.ZOHO_MODULO_PROMOCIONES!.trim(),
  };
}

// ---------------------------------------------------------------------------
// Token
// ---------------------------------------------------------------------------

let cache: { token: string; expiraEn: number } | null = null;

/**
 * Access token, renovado con el refresh token.
 *
 * Se cachea en memoria con 60 s de margen: Zoho limita el número de refrescos
 * por minuto y un script que pagina 30 páginas pediría uno por página.
 */
export async function getAccessToken(cfg = getZohoConfig()): Promise<string> {
  if (cache && Date.now() < cache.expiraEn) return cache.token;

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
    // `invalid_client` casi siempre es el centro de datos equivocado, no unas
    // credenciales malas: el refresh token solo vale en el dominio que lo emitió.
    const pista =
      body.error === "invalid_client"
        ? " — revisa que ZOHO_ACCOUNTS_URL sea el centro de datos donde se generó el token (.eu vs .com)"
        : "";
    throw new Error(`Zoho no devolvió token (${res.status}): ${body.error ?? "sin detalle"}${pista}`);
  }

  cache = {
    token: body.access_token,
    expiraEn: Date.now() + Math.max(0, (body.expires_in ?? 3600) - 60) * 1000,
  };
  return cache.token;
}

/** Fuerza un refresco en la siguiente llamada. Para tests y scripts largos. */
export function resetZohoTokenCache(): void {
  cache = null;
}

// ---------------------------------------------------------------------------
// Peticiones
// ---------------------------------------------------------------------------

async function zohoFetch(
  path: string,
  init: RequestInit = {},
  cfg = getZohoConfig(),
): Promise<Response> {
  const token = await getAccessToken(cfg);
  return fetch(`${cfg.apiDomain}/crm/v8${path}`, {
    ...init,
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
}

async function zohoJson<T>(path: string, init?: RequestInit, cfg?: ZohoConfig): Promise<T> {
  const res = await zohoFetch(path, init, cfg);
  if (res.status === 204) return {} as T;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const b = body as { code?: string; message?: string };
    throw new Error(`Zoho ${res.status} en ${path}: ${b.code ?? ""} ${b.message ?? JSON.stringify(body)}`);
  }
  return body as T;
}

// ---------------------------------------------------------------------------
// Descubrimiento (qué módulos y qué campos hay realmente)
// ---------------------------------------------------------------------------

export interface ZohoModulo {
  api_name: string;
  module_name: string;
  plural_label: string;
  generated_type: string;
  /** false en módulos que la API no expone. */
  api_supported: boolean;
}

export async function listarModulos(cfg?: ZohoConfig): Promise<ZohoModulo[]> {
  const r = await zohoJson<{ modules: ZohoModulo[] }>("/settings/modules", undefined, cfg);
  return r.modules ?? [];
}

export interface ZohoCampo {
  api_name: string;
  field_label: string;
  data_type: string;
  /** Valores admitidos en desplegables (tipología, situación…). */
  pick_list_values?: { display_value: string; actual_value: string }[];
}

export async function listarCampos(modulo: string, cfg?: ZohoConfig): Promise<ZohoCampo[]> {
  const r = await zohoJson<{ fields: ZohoCampo[] }>(
    `/settings/fields?module=${encodeURIComponent(modulo)}`,
    undefined,
    cfg,
  );
  return r.fields ?? [];
}

// ---------------------------------------------------------------------------
// Registros
// ---------------------------------------------------------------------------

export type ZohoRegistro = Record<string, unknown> & { id: string };

interface ZohoListaRespuesta {
  data?: ZohoRegistro[];
  info?: { more_records?: boolean; next_page_token?: string };
}

/**
 * Todos los registros de un módulo, paginando hasta el final.
 *
 * Se pagina con `page_token` y no con `page`: a partir de 2.000 registros Zoho
 * rechaza la paginación por número, y el token es además estable si alguien
 * está editando mientras se lee.
 *
 * `campos` es obligatorio en la API v8. Sin filtro de tipología ni de
 * propietario: el problema que traía el export de Excel era exactamente ese.
 */
export async function fetchTodosLosRegistros(
  campos: readonly string[],
  cfg = getZohoConfig(),
  opciones: { porPagina?: number; maxPaginas?: number } = {},
): Promise<ZohoRegistro[]> {
  const { porPagina = 200, maxPaginas = 200 } = opciones;
  const salida: ZohoRegistro[] = [];
  let token: string | undefined;

  for (let pagina = 0; pagina < maxPaginas; pagina++) {
    const params = new URLSearchParams({
      fields: campos.join(","),
      per_page: String(porPagina),
    });
    if (token) params.set("page_token", token);

    const r = await zohoJson<ZohoListaRespuesta>(
      `/${encodeURIComponent(cfg.modulo)}?${params}`,
      undefined,
      cfg,
    );
    salida.push(...(r.data ?? []));

    if (!r.info?.more_records || !r.info.next_page_token) return salida;
    token = r.info.next_page_token;
  }

  throw new Error(
    `Se alcanzó el límite de ${maxPaginas} páginas leyendo ${cfg.modulo}. ` +
      "Sube maxPaginas antes de asumir que están todas.",
  );
}

// ---------------------------------------------------------------------------
// Escritura — SOLO sobre cambios ya aprobados
// ---------------------------------------------------------------------------

export interface ZohoAvanceUpdate {
  /** pm_promociones.zoho_record_id (la parte numérica del id de Zoho). */
  id: string;
  /** { <api_name del campo>: porcentaje }. `null` vacía el campo en Zoho. */
  campos: Record<string, number | null>;
}

export interface ZohoPushDetalle {
  id: string;
  ok: boolean;
  mensaje: string;
}

export type ZohoPushResult =
  | { ok: true; detalles: ZohoPushDetalle[] }
  | { ok: false; error: string; detalles?: ZohoPushDetalle[] };

/** Zoho acepta como mucho 100 registros por llamada de actualización masiva. */
const LOTE = 100;

/**
 * Escribe porcentajes de avance en Zoho.
 *
 * NO la llama ningún cron ni ninguna ruta automática: solo la acción que
 * procesa cambios YA APROBADOS en la bandeja de salida. La regla del encargo es
 * que nada se sobrescriba sin aprobación previa.
 *
 * Devuelve el detalle por registro: Zoho responde 207 con éxitos y fallos
 * mezclados, así que un `ok` global mentiría.
 */
export async function pushAvance(updates: ZohoAvanceUpdate[]): Promise<ZohoPushResult> {
  const faltan = zohoVariablesQueFaltan();
  if (faltan.length > 0) return { ok: false, error: new ZohoNotConfiguredError(faltan).message };
  if (updates.length === 0) return { ok: true, detalles: [] };

  const cfg = getZohoConfig();
  const detalles: ZohoPushDetalle[] = [];

  try {
    for (let i = 0; i < updates.length; i += LOTE) {
      const lote = updates.slice(i, i + LOTE);
      const body = {
        data: lote.map((u) => ({ id: u.id, ...u.campos })),
        // Sin disparar workflows: esto es una corrección de dato, no un evento
        // de negocio, y no queremos encadenar automatismos del CRM sin querer.
        trigger: [] as string[],
      };

      const r = await zohoJson<{ data?: { code?: string; message?: string; details?: { id?: string } }[] }>(
        `/${encodeURIComponent(cfg.modulo)}`,
        { method: "PUT", body: JSON.stringify(body) },
        cfg,
      );

      (r.data ?? []).forEach((res, j) => {
        detalles.push({
          id: res.details?.id ?? lote[j]?.id ?? "?",
          ok: res.code === "SUCCESS",
          mensaje: res.message ?? res.code ?? "sin detalle",
        });
      });
    }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      detalles,
    };
  }

  const fallidos = detalles.filter((d) => !d.ok);
  if (fallidos.length > 0) {
    return {
      ok: false,
      error: `${fallidos.length} de ${detalles.length} registros fallaron: ${fallidos
        .map((d) => `${d.id} (${d.mensaje})`)
        .join("; ")}`,
      detalles,
    };
  }
  return { ok: true, detalles };
}
