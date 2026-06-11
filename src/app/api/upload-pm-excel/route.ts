import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { writeAccessResponse } from "@/lib/auth/api-guard";
import {
  isLikelyPmExcelBuffer,
  parsePmOverviewWorkbook,
  type PmReplaceRow,
} from "@/modules/pm/data/pm-excel-parser";
import { insertPmImportLog, replacePmPortfolio } from "@/modules/pm/data/pmRepository";

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
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const denied = writeAccessResponse(user, "pm");
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
  const payload = rows.map((r) => serializePmRow(r));

  const { error: rpcError } = await replacePmPortfolio(user, payload);

  const duracion_ms = Date.now() - started;

  if (rpcError) {
    await insertPmImportLog(user, {
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

  await insertPmImportLog(user, {
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
