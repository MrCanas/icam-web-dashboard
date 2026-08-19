import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/currentUser";
import { canAccessRouteKey } from "@/lib/auth/permissions";
import { fetchCambiosAprobados } from "@/modules/pm/avance/data/avanceRepository";
import {
  construirFilasCsvZoho,
  construirJsonZoho,
  serializarCsvZoho,
} from "@/modules/pm/avance/logic/avance-obra";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Descarga los cambios de avance APROBADOS para subirlos a Zoho a mano.
 *
 * Es un GET y NO muta nada: cerrar el cambio es un botón aparte
 * («Marcar como exportado»). Un GET que cambia estado se dispararía solo con el
 * prefetch del navegador.
 */
export async function GET(request: Request): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!canAccessRouteKey(user, "pm.avance_obra")) {
    return NextResponse.json({ error: "Sin acceso a Avance de obra" }, { status: 403 });
  }

  const format = new URL(request.url).searchParams.get("format") === "json" ? "json" : "csv";
  const { cambios, columnasFase, error } = await fetchCambiosAprobados(user);
  if (error) return NextResponse.json({ error }, { status: 500 });

  const fecha = new Date().toISOString().slice(0, 10);

  if (format === "json") {
    // Forma exacta de un bulk update de Zoho CRM: [{ id, data: { campo: valor } }].
    // Donde falta el nombre API se emite una clave marcada, para que el fichero
    // no se pueda subir «sin querer» creyendo que está listo.
    return new NextResponse(JSON.stringify(construirJsonZoho(cambios), null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="zoho-avance-obra-${fecha}.json"`,
      },
    });
  }

  const csv = serializarCsvZoho(construirFilasCsvZoho(cambios), columnasFase);
  // BOM + separador «;»: sin ambos, Excel en español destroza los acentos y mete
  // toda la fila en una sola columna.
  return new NextResponse(`﻿${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="zoho-avance-obra-${fecha}.csv"`,
    },
  });
}
