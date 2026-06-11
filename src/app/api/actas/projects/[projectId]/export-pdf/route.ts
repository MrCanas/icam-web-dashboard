import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/currentUser";
import { fetchActasActaView } from "@/modules/pm/actas/data/actaRepository";
import { getActasReadSupabase } from "@/modules/pm/actas/data/readClient";
import {
  actaPdfFilename,
  buildActaPdfFilterLines,
  type ActaExportPdfBody,
} from "@/modules/pm/actas/pdf/acta-pdf-types";
import { renderActaPdfBuffer } from "@/modules/pm/actas/pdf/render-acta-pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DATE_YMD = /^\d{4}-\d{2}-\d{2}$/;

interface RouteContext {
  params: Promise<{ projectId: string }>;
}

function parseBody(raw: unknown): ActaExportPdfBody | { error: string } {
  if (!raw || typeof raw !== "object") {
    return { error: "Body JSON inválido" };
  }
  const body = raw as Record<string, unknown>;
  const dateFrom = typeof body.dateFrom === "string" ? body.dateFrom.trim() : "";
  const dateTo = typeof body.dateTo === "string" ? body.dateTo.trim() : "";

  if (!DATE_YMD.test(dateFrom) || !DATE_YMD.test(dateTo)) {
    return { error: "dateFrom y dateTo deben ser YYYY-MM-DD" };
  }

  const categoryIds = Array.isArray(body.categoryIds)
    ? body.categoryIds.filter((id): id is string => typeof id === "string")
    : undefined;

  const authorIds = Array.isArray(body.authorIds)
    ? body.authorIds.map((id) => (id === null ? null : String(id)))
    : undefined;

  return {
    dateFrom,
    dateTo,
    categoryIds: categoryIds?.length ? categoryIds : undefined,
    authorIds: authorIds?.length ? authorIds : undefined,
    onlyWithStatusChange: body.onlyWithStatusChange === true,
  };
}

export async function POST(request: Request, context: RouteContext) {
  const ctx = await getCurrentUser();
  if (!ctx) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { projectId } = await context.params;
  const id = projectId?.trim();
  if (!id) {
    return NextResponse.json({ error: "projectId requerido" }, { status: 400 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Body JSON inválido" }, { status: 400 });
  }

  const parsed = parseBody(json);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const supabase = await getActasReadSupabase(ctx);
  const { data: project, error: projectErr } = await supabase
    .from("project")
    .select("id, code, name")
    .eq("id", id)
    .is("archived_at", null)
    .maybeSingle();

  if (projectErr) {
    return NextResponse.json({ error: projectErr.message }, { status: 500 });
  }
  if (!project) {
    return NextResponse.json(
      { error: "Proyecto no encontrado o sin acceso" },
      { status: 404 },
    );
  }

  const queryInput = {
    projectId: id,
    dateFrom: parsed.dateFrom,
    dateTo: parsed.dateTo,
    categoryIds: parsed.categoryIds,
    authorIds: parsed.authorIds,
    onlyWithStatusChange: parsed.onlyWithStatusChange,
  };

  const { data: viewData, error: viewErr } = await fetchActasActaView(
    ctx,
    queryInput,
  );
  if (viewErr || !viewData) {
    return NextResponse.json(
      { error: viewErr ?? "No se pudo cargar el acta" },
      { status: 500 },
    );
  }

  try {
    const filterLines = buildActaPdfFilterLines(parsed, viewData);
    const pdfBuffer = await renderActaPdfBuffer({
      projectCode: project.code as string,
      projectName: project.name as string,
      dateFrom: parsed.dateFrom,
      dateTo: parsed.dateTo,
      generatedAt: new Date(),
      filterLines,
      viewData,
    });

    const filename = actaPdfFilename(
      project.code as string,
      parsed.dateFrom,
      parsed.dateTo,
    );

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (err) {
    console.error("[export-pdf]", err);
    const message =
      err instanceof Error ? err.message : "Error al generar el PDF";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
