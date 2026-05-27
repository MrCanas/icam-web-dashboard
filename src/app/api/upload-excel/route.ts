import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { writeAccessResponse } from "@/lib/auth/api-guard";
import {
  isLikelyExcelBuffer,
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
import { buildUploadLogDetalle, comparePortfolios, type PortfolioDiffResult } from "@/modules/portfolio/logic/portfolio-diff";

function previewPayload(parsed: MaestroParseResult, archivoNombre: string) {
  return {
    archivoNombre,
    stats: parsed.stats,
    warnings: parsed.warnings,
    proyectos: parsed.rows.map((r) => ({
      proyecto: r.proyecto,
      situacion: r.situacion,
      tipo_proyecto: r.tipo_proyecto,
      inversion_total: r.inversion_total,
    })),
  };
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const denied = writeAccessResponse(user, "financiero");
  if (denied) return denied;

  const confirm = request.nextUrl.searchParams.get("confirm") === "true";

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const fileEntry = formData.get("file");
  if (!(fileEntry instanceof Blob)) {
    return NextResponse.json({ error: "Falta el archivo (campo file)" }, { status: 400 });
  }

  const archivoNombre =
    typeof File !== "undefined" && fileEntry instanceof File && fileEntry.name
      ? fileEntry.name
      : "maestro.xlsm";

  const buf = await fileEntry.arrayBuffer();
  const bytes = new Uint8Array(buf);
  if (!isLikelyExcelBuffer(bytes)) {
    return NextResponse.json(
      { error: "El archivo no parece un Excel (.xlsx / .xlsm)" },
      { status: 400 },
    );
  }

  let parsed: MaestroParseResult;
  try {
    parsed = parseMaestroWorkbook(buf);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error al leer el Excel";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  if (!confirm) {
    const { rows: currentRows, error: loadErr } = await listProyectosWithServiceRole(user);
    let comparison: PortfolioDiffResult | null = null;
    let comparisonError: string | null = loadErr;
    if (!loadErr && parsed.rows.length >= 0) {
      try {
        comparison = comparePortfolios(currentRows, parsed.rows);
      } catch (e) {
        comparisonError = e instanceof Error ? e.message : "Error al comparar";
      }
    }
    return NextResponse.json({
      success: true,
      preview: previewPayload(parsed, archivoNombre),
      comparison,
      comparisonError: comparisonError ?? undefined,
    });
  }

  if (parsed.rows.length === 0) {
    return NextResponse.json(
      {
        error:
          "No hay filas con EsUltimaFila = 1. No se ha modificado la base de datos.",
        preview: previewPayload(parsed, archivoNombre),
      },
      { status: 400 },
    );
  }

  const started = Date.now();

  const { rows: currentBefore, error: beforeErr } = await listProyectosWithServiceRole(user);
  if (beforeErr) {
    return NextResponse.json(
      { error: `No se pudo leer el portfolio actual: ${beforeErr}` },
      { status: 500 },
    );
  }

  const diff = comparePortfolios(currentBefore, parsed.rows);
  const payload = parsed.rows.map((r) => serializeRow(r));

  const { error: rpcError } = await replaceProyectos(user, payload);

  const duracion_ms = Date.now() - started;

  if (process.env.NODE_ENV === "development") {
    if (rpcError) {
      console.error("[upload-excel] RPC error", rpcError);
    } else {
      const { count, error: cErr } = await countProyectosUltimaFilaForDev(user);
      console.log(
        "[upload-excel] RPC ok, filas con es_ultima_fila=1:",
        count,
        cErr ? `(count error: ${cErr.message})` : "",
      );
    }
  }

  if (rpcError) {
    const friendly = formatReplaceProyectosRpcError(rpcError.message);
    await insertUploadLog(user, {
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

    return NextResponse.json(
      {
        error: `Fallo al guardar en Supabase: ${friendly}`,
        preview: previewPayload(parsed, archivoNombre),
        comparison: diff,
      },
      { status: 500 },
    );
  }

  const detalle = buildUploadLogDetalle(diff, {
    warnings: parsed.warnings,
    stats: parsed.stats,
  });

  await insertUploadLog(user, {
    archivo: archivoNombre,
    num_proyectos: parsed.rows.length,
    estado: "completado",
    duracion_ms,
    detalle,
  });

  return NextResponse.json({
    success: true,
    duracion_ms,
    preview: previewPayload(parsed, archivoNombre),
    comparison: diff,
  });
}

/** Serializa filas para JSON/Postgres (sin undefined; null explícito). */
function serializeRow(r: ProyectoInsert): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  (Object.keys(r) as (keyof ProyectoInsert)[]).forEach((k) => {
    const v = r[k];
    out[k] = v === undefined ? null : v;
  });
  return out;
}

export const maxDuration = 60;
