import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { writeAccessResponse } from "@/lib/auth/api-guard";
import {
  isLikelyExcelBuffer,
  parseMaestroWorkbook,
  type MaestroParseResult,
} from "@/modules/portfolio/data/excel-parser";
import { listProyectosWithServiceRole } from "@/modules/portfolio/data/proyectosRepository";
import { comparePortfolios, type PortfolioDiffResult } from "@/modules/portfolio/logic/portfolio-diff";
import { commitMaestroReplace } from "@/modules/portfolio/logic/commitMaestroUpload";

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

  if (!confirm) {
    let parsed: MaestroParseResult;
    try {
      parsed = parseMaestroWorkbook(buf);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error al leer el Excel";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const { rows: currentRows, error: loadErr } = await listProyectosWithServiceRole(user);
    let comparison: PortfolioDiffResult | null = null;
    let comparisonError: string | null = loadErr;
    if (!loadErr) {
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

  // confirm = true → reemplazo atómico (pipeline compartido con el cron).
  const result = await commitMaestroReplace(user, buf, archivoNombre);

  if (!result.ok) {
    return NextResponse.json(
      {
        error: result.error,
        preview: result.parsed ? previewPayload(result.parsed, archivoNombre) : undefined,
        comparison: result.comparison,
      },
      { status: result.status },
    );
  }

  return NextResponse.json({
    success: true,
    duracion_ms: result.duracion_ms,
    preview: previewPayload(result.parsed, archivoNombre),
    comparison: result.comparison,
  });
}

export const maxDuration = 60;
