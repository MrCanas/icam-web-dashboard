import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { writeAccessResponse } from "@/lib/auth/api-guard";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { isLikelyExcelBuffer } from "@/modules/portfolio/data/excel-parser";
import {
  parseCorporativoWorkbook,
  type CorporativoParseResult,
} from "@/modules/corporativo/data/corporativo-excel-parser";
import { listCorpPeriodos } from "@/modules/corporativo/data/corpPeriodosRepository";
import { commitCorporativoReplace } from "@/modules/corporativo/logic/commitCorporativoUpload";
import {
  compararCorpPeriodos,
  type CorporativoDiffResult,
} from "@/modules/corporativo/logic/corporativo-diff";

/**
 * Subida manual del maestro corporativo. Gemela de /api/upload-excel y con el
 * mismo contrato de dos pasos: sin `?confirm=true` solo parsea y devuelve la
 * previsualización y el diff, para que quien sube vea qué va a cambiar ANTES de
 * reemplazar el snapshot; con `confirm=true` ejecuta el mismo pipeline que el
 * cron.
 *
 * `isLikelyExcelBuffer` se reutiliza del parser de portfolio: comprueba la firma
 * del fichero, no su extensión, y eso no tiene nada de específico de un maestro
 * concreto.
 */

function previewPayload(parsed: CorporativoParseResult, archivoNombre: string) {
  return {
    archivoNombre,
    stats: parsed.stats,
    warnings: parsed.warnings,
    diccionario: parsed.diccionario.length,
    notas: parsed.notas.length,
  };
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const denied = writeAccessResponse(user, "corporativo");
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
      : "maestro-corporativo.xlsx";

  const buf = await fileEntry.arrayBuffer();
  if (!isLikelyExcelBuffer(new Uint8Array(buf))) {
    return NextResponse.json(
      { error: "El archivo no parece un Excel (.xlsx / .xlsm)" },
      { status: 400 },
    );
  }

  if (!confirm) {
    let parsed: CorporativoParseResult;
    try {
      parsed = parseCorporativoWorkbook(buf);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error al leer el Excel";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const { data: actuales, error } = await listCorpPeriodos(user);
    let comparison: CorporativoDiffResult | null = null;
    let comparisonError: string | null = error?.message ?? null;
    if (!comparisonError) {
      try {
        comparison = compararCorpPeriodos(actuales ?? [], parsed.rows);
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

  const result = await commitCorporativoReplace(user, buf, archivoNombre);

  if (!result.ok) {
    return NextResponse.json(
      {
        error: result.error,
        preview: result.parsed ? previewPayload(result.parsed, archivoNombre) : undefined,
        comparison: result.diff,
      },
      { status: result.status },
    );
  }

  return NextResponse.json({
    success: true,
    duracion_ms: result.duracion_ms,
    preview: previewPayload(result.parsed, archivoNombre),
    comparison: result.diff,
    ...(result.metadatosError ? { metadatos_error: result.metadatosError } : {}),
  });
}

export const maxDuration = 60;
