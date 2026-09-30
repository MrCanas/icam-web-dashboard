import type { UserContext } from "@/lib/auth/currentUser";
import { withAudit } from "@/lib/audit/withAudit";

import type { RegistroUso } from "../types";
import { getInformesSupabase } from "./client";

/** Una fila por petición a Claude. Best-effort: un fallo aquí no rompe la respuesta. */
export async function registrarUso(ctx: UserContext, uso: RegistroUso): Promise<void> {
  try {
    const { error } = await withAudit(
      ctx,
      "pm.informe.claude.call",
      {
        resourceType: "informe",
        resourceId: uso.informeId ?? undefined,
        payload: { tipo: uso.tipo, coste_usd: uso.costeUsd },
      },
      async () =>
        getInformesSupabase(ctx).from("informe_uso").insert({
          informe_id: uso.informeId,
          user_id: ctx.id,
          tipo: uso.tipo,
          modelo: uso.modelo,
          input_tokens: uso.inputTokens,
          output_tokens: uso.outputTokens,
          cache_creation_tokens: uso.cacheCreationTokens,
          cache_read_tokens: uso.cacheReadTokens,
          coste_usd: uso.costeUsd,
          stop_reason: uso.stopReason,
          duracion_ms: uso.duracionMs,
        }),
    );
    if (error) console.error("[informes] registrar uso", error.message);
  } catch (err) {
    console.error("[informes] registrar uso", err);
  }
}

export interface ResumenUso {
  peticiones: number;
  costeUsd: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
}

/** Coste acumulado de un informe (se muestra en el editor de la app). */
export async function resumenUsoInforme(
  ctx: UserContext,
  informeId: string,
): Promise<{ data: ResumenUso | null; error: string | null }> {
  const { data, error } = await getInformesSupabase(ctx)
    .from("informe_uso")
    .select("input_tokens, output_tokens, cache_read_tokens, coste_usd")
    .eq("informe_id", informeId);
  if (error) return { data: null, error: error.message };
  const filas = data ?? [];
  return {
    data: {
      peticiones: filas.length,
      costeUsd: Math.round(filas.reduce((s, f) => s + Number(f.coste_usd), 0) * 100) / 100,
      inputTokens: filas.reduce((s, f) => s + Number(f.input_tokens), 0),
      outputTokens: filas.reduce((s, f) => s + Number(f.output_tokens), 0),
      cacheReadTokens: filas.reduce((s, f) => s + Number(f.cache_read_tokens), 0),
    },
    error: null,
  };
}
