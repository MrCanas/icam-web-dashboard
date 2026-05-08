import { getMondayConfig } from "@/lib/monday/config";
import type { MondayQueryError } from "@/lib/monday/types";

interface MondayGraphqlResponse<T> {
  data?: T;
  errors?: MondayQueryError[];
}

export class MondayApiError extends Error {
  status: number;
  details?: MondayQueryError[];

  constructor(message: string, status = 500, details?: MondayQueryError[]) {
    super(message);
    this.name = "MondayApiError";
    this.status = status;
    this.details = details;
  }
}

export async function mondayRequest<TData>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<TData> {
  const { endpoint, token, apiVersion } = getMondayConfig();
  const controller = new AbortController();
  const timeoutMs = 15_000;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(endpoint, {
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
    throw new MondayApiError("No se pudo conectar con Monday.", 502);
  } finally {
    clearTimeout(timeout);
  }

  let payload: MondayGraphqlResponse<TData>;
  try {
    payload = (await response.json()) as MondayGraphqlResponse<TData>;
  } catch {
    throw new MondayApiError("Respuesta inválida desde Monday.", response.status || 502);
  }

  if (!response.ok) {
    const reason = payload.errors?.map((e) => e.message).join("; ") || "Error HTTP de Monday.";
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
