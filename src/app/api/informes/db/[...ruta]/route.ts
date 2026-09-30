import { NextResponse } from "next/server";

import { readAccessResponse, writeAccessResponse } from "@/lib/auth/api-guard";
import { getCurrentUser } from "@/lib/auth/currentUser";
import {
  borrarDocumento,
  guardarDocumento,
  listarDocumentos,
  obtenerDocumento,
} from "@/modules/pm/informes/data/informesRepository";
import {
  esColeccion,
  esIdValido,
  validarDocumento,
} from "@/modules/pm/informes/logic/colecciones";
import type { ColeccionInforme, DocumentoApp } from "@/modules/pm/informes/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Base de datos de la app de informes, con la misma forma que la del artifact:
 *   GET    /api/informes/db/<coleccion>[?campo=…&valor=…]  → { docs: [{ id, datos }] }
 *   GET    /api/informes/db/<coleccion>/<id>               → { datos } | 404
 *   PUT    /api/informes/db/<coleccion>/<id>               ← documento completo
 *   DELETE /api/informes/db/<coleccion>/<id>
 * Leer: zona pm. Escribir o borrar: editor/admin de pm.
 */

interface RouteContext {
  params: Promise<{ ruta: string[] }>;
}

type Ruta = { coleccion: ColeccionInforme; id: string | null } | { error: NextResponse };

async function resolver(context: RouteContext): Promise<Ruta> {
  const { ruta } = await context.params;
  const [coleccion, id, ...resto] = ruta ?? [];
  if (!coleccion || !esColeccion(coleccion) || resto.length) {
    return { error: NextResponse.json({ error: "Colección no válida" }, { status: 404 }) };
  }
  if (id != null && !esIdValido(id)) {
    return { error: NextResponse.json({ error: "Id no válido" }, { status: 400 }) };
  }
  return { coleccion, id: id ?? null };
}

export async function GET(request: Request, context: RouteContext) {
  const ctx = await getCurrentUser();
  if (!ctx) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const denegado = readAccessResponse(ctx, "pm");
  if (denegado) return denegado;

  const r = await resolver(context);
  if ("error" in r) return r.error;

  if (r.id) {
    const { data, error } = await obtenerDocumento(ctx, r.coleccion, r.id);
    if (error) return NextResponse.json({ error }, { status: 500 });
    if (!data) return NextResponse.json({ error: "No existe" }, { status: 404 });
    return NextResponse.json({ id: r.id, datos: data }, { headers: { "Cache-Control": "no-store" } });
  }

  const url = new URL(request.url);
  const campo = url.searchParams.get("campo");
  const valor = url.searchParams.get("valor");
  const { data, error } = await listarDocumentos(
    ctx,
    r.coleccion,
    campo && valor != null ? { campo, valor } : undefined,
  );
  if (error) return NextResponse.json({ error }, { status: 400 });
  return NextResponse.json({ docs: data }, { headers: { "Cache-Control": "no-store" } });
}

export async function PUT(request: Request, context: RouteContext) {
  const ctx = await getCurrentUser();
  if (!ctx) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const denegado = writeAccessResponse(ctx, "pm");
  if (denegado) return denegado;

  const r = await resolver(context);
  if ("error" in r) return r.error;
  if (!r.id) return NextResponse.json({ error: "Falta el id" }, { status: 400 });

  let doc: unknown;
  try {
    doc = await request.json();
  } catch {
    return NextResponse.json({ error: "Body JSON inválido" }, { status: 400 });
  }
  const invalido = validarDocumento(r.coleccion, r.id, doc);
  if (invalido) return NextResponse.json({ error: invalido }, { status: 400 });

  const { error } = await guardarDocumento(ctx, r.coleccion, r.id, doc as DocumentoApp);
  if (error) return NextResponse.json({ error }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const ctx = await getCurrentUser();
  if (!ctx) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const denegado = writeAccessResponse(ctx, "pm");
  if (denegado) return denegado;

  const r = await resolver(context);
  if ("error" in r) return r.error;
  if (!r.id) return NextResponse.json({ error: "Falta el id" }, { status: 400 });

  const { error } = await borrarDocumento(ctx, r.coleccion, r.id);
  if (error) return NextResponse.json({ error }, { status: 500 });
  return NextResponse.json({ ok: true });
}
