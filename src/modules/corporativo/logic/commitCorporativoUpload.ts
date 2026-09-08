/**
 * Pipeline de «commit» del maestro corporativo: parsear → diff → reemplazo atómico
 * → registrar en upload_logs.
 *
 * Vive aquí y no en la ruta del cron para que la subida manual y la sincronización
 * desatendida hagan exactamente lo mismo, con la misma auditoría, venga el fichero
 * de donde venga. Es el mismo reparto que `commitMaestroReplace` en portfolio.
 */
import type { UserContext } from "@/lib/auth/currentUser";
import {
  parseCorporativoWorkbook,
  type CorporativoParseResult,
} from "@/modules/corporativo/data/corporativo-excel-parser";
import {
  insertCorporativoUploadLog,
  listCorpPeriodos,
  replaceCorpDiccionario,
  replaceCorpNotas,
  replaceCorpPeriodos,
} from "@/modules/corporativo/data/corpPeriodosRepository";
import {
  buildCorporativoUploadLogDetalle,
  compararCorpPeriodos,
  type CorporativoDiffResult,
} from "@/modules/corporativo/logic/corporativo-diff";

export type CommitCorporativoResult =
  | {
      ok: true;
      duracion_ms: number;
      diff: CorporativoDiffResult;
      parsed: CorporativoParseResult;
      numFilas: number;
      /** Fallos no fatales al persistir glosario y notas (los periodos ya están). */
      metadatosError: string | null;
    }
  | {
      ok: false;
      status: number;
      error: string;
      diff?: CorporativoDiffResult;
      parsed?: CorporativoParseResult;
    };

/** Serializa para JSON/Postgres: sin `undefined`, null explícito. */
function serializeRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) out[k] = v === undefined ? null : v;
  return out;
}

function mensajeError(e: unknown, porDefecto: string): string {
  return e instanceof Error ? e.message : porDefecto;
}

/**
 * Parsea el buffer del maestro corporativo y reemplaza atómicamente el snapshot de
 * `corp_periodos`, dejando traza en `upload_logs` con `fuente = 'corporativo'`.
 *
 * `ctx` solo sirve para atribuir la auditoría: el cliente es service role y no
 * mira la identidad.
 */
export async function commitCorporativoReplace(
  ctx: UserContext,
  buffer: ArrayBuffer,
  archivoNombre: string,
): Promise<CommitCorporativoResult> {
  let parsed: CorporativoParseResult;
  try {
    parsed = parseCorporativoWorkbook(buffer);
  } catch (e) {
    return { ok: false, status: 400, error: mensajeError(e, "Error al leer el Excel corporativo") };
  }

  const started = Date.now();

  // Estado previo, para poder contar qué cambia. Un fallo aquí sí aborta: sin la
  // foto de antes, el log de la carga no valdría para auditar nada.
  const { data: antes, error: errorAntes } = await listCorpPeriodos(ctx);
  if (errorAntes) {
    return {
      ok: false,
      status: 500,
      error: `No se pudo leer el maestro corporativo actual: ${errorAntes.message}`,
      parsed,
    };
  }

  const diff = compararCorpPeriodos(antes ?? [], parsed.rows);
  const payload = parsed.rows.map((r) => serializeRow(r as unknown as Record<string, unknown>));

  const { error: rpcError } = await replaceCorpPeriodos(ctx, payload);
  const duracion_ms = Date.now() - started;

  if (rpcError) {
    await insertCorporativoUploadLog(ctx, {
      archivo: archivoNombre,
      num_proyectos: parsed.rows.length,
      estado: "error",
      duracion_ms,
      detalle: buildCorporativoUploadLogDetalle(diff, {
        origen: "corporativo",
        warnings: parsed.warnings,
        stats: parsed.stats,
        error: rpcError.message,
        code: rpcError.code,
      }),
    });
    return {
      ok: false,
      status: 500,
      error: `Fallo al guardar en Supabase: ${rpcError.message}`,
      diff,
      parsed,
    };
  }

  // Glosario y notas: NO pueden tumbar la carga. Los periodos ya están escritos y
  // el tab funciona sin metodología; lo que no puede pasar es que un fallo aquí
  // deje el snapshot a medias y sin traza.
  const metadatosErrores: string[] = [];
  if (parsed.diccionario.length > 0) {
    const { error } = await replaceCorpDiccionario(
      ctx,
      parsed.diccionario as unknown as Record<string, unknown>[],
    );
    if (error) metadatosErrores.push(`diccionario: ${error.message}`);
  }
  if (parsed.notas.length > 0) {
    const { error } = await replaceCorpNotas(
      ctx,
      parsed.notas as unknown as Record<string, unknown>[],
    );
    if (error) metadatosErrores.push(`notas: ${error.message}`);
  }
  const metadatosError = metadatosErrores.length > 0 ? metadatosErrores.join(" · ") : null;

  await insertCorporativoUploadLog(ctx, {
    archivo: archivoNombre,
    num_proyectos: parsed.rows.length,
    estado: "completado",
    duracion_ms,
    detalle: buildCorporativoUploadLogDetalle(diff, {
      origen: "corporativo",
      warnings: parsed.warnings,
      stats: parsed.stats,
      diccionario: parsed.diccionario.length,
      notas: parsed.notas.length,
      ...(metadatosError ? { metadatos_error: metadatosError } : {}),
    }),
  });

  return {
    ok: true,
    duracion_ms,
    diff,
    parsed,
    numFilas: parsed.rows.length,
    metadatosError,
  };
}
