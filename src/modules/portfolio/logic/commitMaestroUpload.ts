/**
 * Pipeline de "commit" del maestro de portfolio: parsear → diff → reemplazo atómico
 * → registrar upload_log. Extraído de la ruta /api/upload-excel para poder invocarlo
 * también desde el cron de sincronización con SharePoint. Mismo comportamiento y
 * misma auditoría (upload_logs + audit_log) sea cual sea el origen del fichero.
 */
import type { UserContext } from "@/lib/auth/currentUser";
import {
  parseMaestroWorkbook,
  type MaestroParseResult,
  type ProyectoInsert,
} from "@/modules/portfolio/data/excel-parser";
import {
  countProyectosUltimaFilaForDev,
  listProyectosWithServiceRole,
  replaceProyectos,
} from "@/modules/portfolio/data/proyectosRepository";
import { insertUploadLog } from "@/modules/portfolio/data/uploadLogsRepository";
import { formatReplaceProyectosRpcError } from "@/lib/format-replace-proyectos-error";
import {
  buildUploadLogDetalle,
  comparePortfolios,
  type PortfolioDiffResult,
} from "@/modules/portfolio/logic/portfolio-diff";

export type CommitMaestroResult =
  | {
      ok: true;
      duracion_ms: number;
      comparison: PortfolioDiffResult;
      parsed: MaestroParseResult;
      numProyectos: number;
    }
  | {
      ok: false;
      status: number;
      error: string;
      comparison?: PortfolioDiffResult;
      parsed?: MaestroParseResult;
    };

/** Serializa filas para JSON/Postgres (sin undefined; null explícito). */
function serializeRow(r: ProyectoInsert): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  (Object.keys(r) as (keyof ProyectoInsert)[]).forEach((k) => {
    const v = r[k];
    out[k] = v === undefined ? null : v;
  });
  return out;
}

/**
 * Parsea el buffer del maestro y reemplaza atómicamente el snapshot de `proyectos`,
 * dejando traza en `upload_logs`. `ctx` solo se usa para atribución de auditoría y
 * para construir el cliente service-role (que ignora la identidad del usuario).
 */
export async function commitMaestroReplace(
  ctx: UserContext,
  buffer: ArrayBuffer,
  archivoNombre: string,
): Promise<CommitMaestroResult> {
  let parsed: MaestroParseResult;
  try {
    parsed = parseMaestroWorkbook(buffer);
  } catch (e) {
    return {
      ok: false,
      status: 400,
      error: e instanceof Error ? e.message : "Error al leer el Excel",
    };
  }

  if (parsed.rows.length === 0) {
    return {
      ok: false,
      status: 400,
      error: "No hay filas con EsUltimaFila = 1. No se ha modificado la base de datos.",
      parsed,
    };
  }

  const started = Date.now();

  const { rows: currentBefore, error: beforeErr } = await listProyectosWithServiceRole(ctx);
  if (beforeErr) {
    return {
      ok: false,
      status: 500,
      error: `No se pudo leer el portfolio actual: ${beforeErr}`,
      parsed,
    };
  }

  const diff = comparePortfolios(currentBefore, parsed.rows);
  const payload = parsed.rows.map((r) => serializeRow(r));

  const { error: rpcError } = await replaceProyectos(ctx, payload);

  const duracion_ms = Date.now() - started;

  if (process.env.NODE_ENV === "development") {
    if (rpcError) {
      console.error("[commitMaestroReplace] RPC error", rpcError);
    } else {
      const { count, error: cErr } = await countProyectosUltimaFilaForDev(ctx);
      console.log(
        "[commitMaestroReplace] RPC ok, filas con es_ultima_fila=1:",
        count,
        cErr ? `(count error: ${cErr.message})` : "",
      );
    }
  }

  if (rpcError) {
    const friendly = formatReplaceProyectosRpcError(rpcError.message);
    await insertUploadLog(ctx, {
      archivo: archivoNombre,
      num_proyectos: parsed.rows.length,
      estado: "error",
      duracion_ms,
      detalle: {
        ...buildUploadLogDetalle(diff, { warnings: parsed.warnings, stats: parsed.stats }),
        error: rpcError.message,
        error_detail: friendly,
        code: rpcError.code,
      },
    });

    return {
      ok: false,
      status: 500,
      error: `Fallo al guardar en Supabase: ${friendly}`,
      comparison: diff,
      parsed,
    };
  }

  await insertUploadLog(ctx, {
    archivo: archivoNombre,
    num_proyectos: parsed.rows.length,
    estado: "completado",
    duracion_ms,
    detalle: buildUploadLogDetalle(diff, {
      warnings: parsed.warnings,
      stats: parsed.stats,
    }),
  });

  return {
    ok: true,
    duracion_ms,
    comparison: diff,
    parsed,
    numProyectos: parsed.rows.length,
  };
}
