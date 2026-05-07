import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isIcamAuthenticated } from "@/lib/api-auth";
import {
  isLikelyPmExcelBuffer,
  parsePmOverviewWorkbook,
  type PmReplaceRow,
} from "@/lib/pm-excel-parser";
import { createServiceRoleClient } from "@/lib/supabase/admin";

function previewPayload(
  rows: PmReplaceRow[],
  archivoNombre: string,
  stats: ReturnType<typeof parsePmOverviewWorkbook>["stats"],
  warnings: string[],
) {
  const activos = [...new Set(rows.map((r) => r.id_activo))].sort();
  return {
    archivoNombre,
    stats,
    warnings,
    activos,
    muestraHitos: rows.slice(0, 40).map((r) => ({
      id_activo: r.id_activo,
      hito: r.hito,
      orden_hito: r.orden_hito,
      fecha_actual: r.fecha_actual,
      snapshots: r.snapshots,
    })),
  };
}

function serializePmRow(r: PmReplaceRow): Record<string, unknown> {
  const snapshots: Record<string, string> = {};
  for (const [k, v] of Object.entries(r.snapshots)) {
    if (v) snapshots[k] = v;
  }
  return {
    id_activo: r.id_activo,
    tipo_uso_activo: r.tipo_uso_activo,
    hito: r.hito,
    orden_hito: String(r.orden_hito),
    fecha_actual: r.fecha_actual ?? "",
    desviacion_vs_anterior_dias:
      r.desviacion_vs_anterior_dias != null ? String(r.desviacion_vs_anterior_dias) : "",
    desviacion_vs_levantamiento_dias:
      r.desviacion_vs_levantamiento_dias != null ? String(r.desviacion_vs_levantamiento_dias) : "",
    snapshots,
  };
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
      : "pm-overview.xlsb";

  const buf = await fileEntry.arrayBuffer();
  const bytes = new Uint8Array(buf);
  if (!isLikelyPmExcelBuffer(bytes)) {
    return NextResponse.json(
      { error: "El archivo no parece un Excel binario (.xlsb) ni .xlsx/.xlsm" },
      { status: 400 },
    );
  }

  let parsed: ReturnType<typeof parsePmOverviewWorkbook>;
  try {
    parsed = parsePmOverviewWorkbook(buf);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error al leer el Excel";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const { rows, warnings, stats } = parsed;

  if (!confirm) {
    return NextResponse.json({
      success: true,
      preview: previewPayload(rows, archivoNombre, stats, warnings),
    });
  }

  if (rows.length === 0) {
    return NextResponse.json(
      {
        error: "No hay filas válidas para importar.",
        preview: previewPayload(rows, archivoNombre, stats, warnings),
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

  const payload = rows.map((r) => serializePmRow(r));

  const { error: rpcError } = await supabase.rpc("replace_pm_portfolio", {
    p_rows: payload,
  });

  const duracion_ms = Date.now() - started;

  if (rpcError) {
    await supabase.from("pm_import_logs").insert({
      archivo: archivoNombre,
      estado: "error",
      duracion_ms,
      detalle: {
        num_hitos: rows.length,
        stats,
        warnings,
        error: rpcError.message,
        code: rpcError.code,
      },
    });

    return NextResponse.json(
      {
        error: `Fallo al guardar en Supabase: ${rpcError.message}`,
        preview: previewPayload(rows, archivoNombre, stats, warnings),
      },
      { status: 500 },
    );
  }

  await supabase.from("pm_import_logs").insert({
    archivo: archivoNombre,
    estado: "completado",
    duracion_ms,
    detalle: {
      num_hitos: rows.length,
      stats,
      warnings,
    },
  });

  return NextResponse.json({
    success: true,
    duracion_ms,
    preview: previewPayload(rows, archivoNombre, stats, warnings),
  });
}

export const maxDuration = 60;
