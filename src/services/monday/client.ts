const DEFAULT_ENDPOINT = "https://api.monday.com/v2";
const DEFAULT_API_VERSION = "2026-04";
const DEFAULT_TIMEOUT_MS = 60_000;
const MAX_RETRIES = 5;
const INITIAL_BACKOFF_MS = 1_000;
const MAX_BACKOFF_MS = 30_000;

/** Espacio de trabajo Monday.com */
export interface Workspace {
  id: string;
  name: string;
}

/** Tablero */
export interface Board {
  id: string;
  name: string;
  updated_at?: string | null;
  items_count?: number | null;
  state?: string | null;
}

/** Grupo dentro de un tablero */
export interface Group {
  id: string;
  title: string;
}

/** Columna de tablero */
export interface Column {
  id: string;
  title: string;
  type: string;
}

/** Valor de columna en un item */
export interface ColumnValue {
  id: string;
  text: string | null;
  value: string | null;
}

/** Item (fila) */
export interface Item {
  id: string;
  name: string;
  created_at?: string | null;
  updated_at?: string | null;
  group?: Group | null;
  column_values?: ColumnValue[];
  subitems?: Subitem[];
}

/** Subitem */
export interface Subitem {
  id: string;
  name: string;
  created_at?: string | null;
  updated_at?: string | null;
  column_values?: ColumnValue[];
}

/** Actualización / comentario en un item */
export interface Update {
  id: string;
  body: string;
  created_at: string;
  creator_id?: string | null;
}

export interface MondayGraphqlError {
  message: string;
  extensions?: Record<string, unknown>;
}

interface MondayGraphqlResponse<T> {
  data?: T;
  errors?: MondayGraphqlError[];
}

export class MondayApiError extends Error {
  status: number;
  details?: MondayGraphqlError[];

  constructor(message: string, status = 500, details?: MondayGraphqlError[]) {
    super(message);
    this.name = "MondayApiError";
    this.status = status;
    this.details = details;
  }
}

function getMondayEnv() {
  const token = process.env.MONDAY_API_TOKEN?.trim();
  const apiVersion = process.env.MONDAY_API_VERSION?.trim() || DEFAULT_API_VERSION;
  if (!token) {
    throw new MondayApiError(
      "Falta MONDAY_API_TOKEN en variables de entorno (.env.local).",
      500,
    );
  }
  return { token, apiVersion };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRateLimited(status: number, errors?: MondayGraphqlError[]): boolean {
  if (status === 429) return true;
  if (!errors?.length) return false;
  return errors.some((e) =>
    /rate|limit|complexity|throttl|retry/i.test(e.message),
  );
}

function isRetryableHttp(status: number): boolean {
  return status === 429 || status === 502 || status === 503 || status === 504;
}

function backoffMs(attempt: number, retryAfterHeader: string | null): number {
  if (retryAfterHeader) {
    const seconds = Number.parseInt(retryAfterHeader, 10);
    if (Number.isFinite(seconds) && seconds > 0) {
      return Math.min(seconds * 1000, MAX_BACKOFF_MS);
    }
  }
  const exp = INITIAL_BACKOFF_MS * 2 ** attempt;
  const jitter = Math.floor(Math.random() * 250);
  return Math.min(exp + jitter, MAX_BACKOFF_MS);
}

async function postMonday<T>(
  query: string,
  variables: Record<string, unknown> | undefined,
  attempt: number,
  options?: MondayQueryOptions,
): Promise<T> {
  const { token, apiVersion } = getMondayEnv();
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxRetries = options?.maxRetries ?? MAX_RETRIES;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(DEFAULT_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: token,
        "Content-Type": "application/json",
        "API-Version": apiVersion,
      },
      body: JSON.stringify({ query, variables }),
      cache: "no-store",
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new MondayApiError(`Timeout consultando Monday (${timeoutMs}ms).`, 504);
    }
    if (attempt < maxRetries - 1) {
      await sleep(backoffMs(attempt, null));
      return postMonday<T>(query, variables, attempt + 1, options);
    }
    throw new MondayApiError("No se pudo conectar con Monday.", 502);
  } finally {
    clearTimeout(timeout);
  }

  let payload: MondayGraphqlResponse<T>;
  try {
    payload = (await response.json()) as MondayGraphqlResponse<T>;
  } catch {
    if (isRetryableHttp(response.status) && attempt < maxRetries - 1) {
      await sleep(backoffMs(attempt, response.headers.get("Retry-After")));
      return postMonday<T>(query, variables, attempt + 1, options);
    }
    throw new MondayApiError("Respuesta inválida desde Monday.", response.status || 502);
  }

  const graphqlRateLimited = isRateLimited(response.status, payload.errors);

  if (
    (!response.ok || graphqlRateLimited) &&
    attempt < maxRetries - 1
  ) {
    await sleep(backoffMs(attempt, response.headers.get("Retry-After")));
    return postMonday<T>(query, variables, attempt + 1, options);
  }

  if (!response.ok) {
    const reason =
      payload.errors?.map((e) => e.message).join("; ") || "Error HTTP de Monday.";
    throw new MondayApiError(reason, response.status || 502, payload.errors);
  }

  if (payload.errors?.length) {
    const reason = payload.errors.map((e) => e.message).join("; ");
    throw new MondayApiError(reason, 400, payload.errors);
  }

  if (!payload.data) {
    throw new MondayApiError("Monday devolvió una respuesta vacía.", 502);
  }

  return payload.data;
}

/**
 * Ejecuta una consulta GraphQL contra Monday.com v2.
 * Reintentos con backoff exponencial ante rate limiting (429) y errores transitorios.
 */
export interface MondayQueryOptions {
  timeoutMs?: number;
  maxRetries?: number;
}

export async function mondayQuery<T>(
  query: string,
  variables?: object,
  options?: MondayQueryOptions,
): Promise<T> {
  const vars =
    variables === undefined
      ? undefined
      : (variables as Record<string, unknown>);
  return postMonday<T>(query, vars, 0, options);
}
