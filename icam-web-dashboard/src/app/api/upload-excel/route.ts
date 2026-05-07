import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isIcamAuthenticated } from "@/lib/api-auth";
import {
  isLikelyExcelBuffer,
  parseMaestroWorkbook,
  type MaestroParseResult,
  type ProyectoInsert,
} from "@/lib/excel-parser";
import { formatReplaceProyectosRpcError } from "@/lib/format-replace-proyectos-error";
import { buildUploadLogDetalle, comparePortfolios, type PortfolioDiffResult } from "@/lib/portfolio-diff";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import type { Proyecto } from "@/lib/types";

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

async function fetchProyectosWithServiceRole(): Promise<{
  rows: Proyecto[];
  error: string | null;
}> {
  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from("proyectos")
      .select("*")
      .eq("es_ultima_fila", 1)
      .order("proyecto", { ascending: true });
    if (error) {
      return { rows: [], error: error.message };
    }
    return { rows: (data ?? []) as Proyecto[], error: null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "No se pudo conectar a Supabase";
    return { rows: [], error: msg };
  }
}

export async function POST(request: NextRequest) {
  if (!isIcamAuthenticated(request)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

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
    const { rows: currentRows, error: loadErr } = await fetchProyectosWithServiceRole();
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
  let supabase;
  try {
    supabase = createServiceRoleClient();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Configuración incompleta";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const { rows: currentBefore, error: beforeErr } = await fetchProyectosWithServiceRole();
  if (beforeErr) {
    return NextResponse.json(
      { error: `No se pudo leer el portfolio actual: ${beforeErr}` },
      { status: 500 },
    );
  }

  const diff = comparePortfolios(currentBefore, parsed.rows);
  const payload = parsed.rows.map((r) => serializeRow(r));

  const { error: rpcError } = await supabase.rpc("replace_proyectos", {
    p_rows: payload,
  });

  const duracion_ms = Date.now() - started;

  if (process.env.NODE_ENV === "development") {
    if (rpcError) {
      console.error("[upload-excel] RPC error", rpcError);
    } else {
      const { count, error: cErr } = await supabase
        .from("proyectos")
        .select("*", { count: "exact", head: true })
        .eq("es_ultima_fila", 1);
      console.log(
        "[upload-excel] RPC ok, filas con es_ultima_fila=1:",
        count,
        cErr ? `(count error: ${cErr.message})` : "",
      );
    }
  }

  if (rpcError) {
    const friendly = formatReplaceProyectosRpcError(rpcError.message);
    await supabase.from("upload_logs").insert({
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

  await supabase.from("upload_logs").insert({
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
