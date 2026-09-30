import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/currentUser";
import { canAccessRouteKey, checkWriteAccess } from "@/lib/auth/permissions";
import { subirFoto } from "@/modules/pm/informes/data/fotosRepository";
import { esIdInforme } from "@/modules/pm/informes/logic/trimestre";
import { CATEGORIAS_FOTO, type CategoriaFoto } from "@/modules/pm/informes/types";

export const runtime = "nodejs";

/** Sube una foto del informe (ya redimensionada en el navegador a ≤ 1600 px). */
export async function POST(request: Request) {
  const ctx = await getCurrentUser();
  if (!ctx) return NextResponse.json({ error: "Tu sesión ha caducado: vuelve a entrar." }, { status: 401 });
  if (!canAccessRouteKey(ctx, "pm.informes") || checkWriteAccess(ctx, "pm")) {
    return NextResponse.json({ error: "Sin permiso para subir fotos" }, { status: 403 });
  }
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Formulario no válido" }, { status: 400 });
  }
  const informeId = String(form.get("informeId") ?? "");
  const fichero = form.get("foto");
  if (!esIdInforme(informeId) || !(fichero instanceof File)) {
    return NextResponse.json({ error: "Falta el informe o la foto" }, { status: 400 });
  }
  const numero = (k: string) => {
    const n = Number(form.get(k));
    return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
  };
  const cat = String(form.get("categoria") ?? "Obra") as CategoriaFoto;
  const r = await subirFoto(ctx, informeId, {
    bytes: await fichero.arrayBuffer(),
    mime: fichero.type,
    nombre: String(form.get("nombre") ?? fichero.name ?? "foto"),
    ancho: numero("ancho"),
    alto: numero("alto"),
    categoria: CATEGORIAS_FOTO.includes(cat) ? cat : "Obra",
    pie: form.get("pie") ? String(form.get("pie")) : null,
  });
  if (r.error !== null) return NextResponse.json({ error: r.error }, { status: 400 });
  return NextResponse.json({ foto: r.data });
}
