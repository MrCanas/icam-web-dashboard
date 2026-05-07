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

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: token,
      "Content-Type": "application/json",
      "API-Version": apiVersion,
    },
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
  });

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
