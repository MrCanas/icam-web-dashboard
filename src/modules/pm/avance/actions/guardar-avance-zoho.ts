"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";

import { withAudit } from "@/lib/audit/withAudit";
import type { UserContext } from "@/lib/auth/currentUser";
import { requirePmWriteSupabase } from "@/modules/pm/planificacion/data/writeClient";
import { validateUuid } from "@/modules/pm/planificacion/logic/planificacion-validation";
import { validatePorcentaje } from "@/modules/pm/avance/logic/avance-obra";
import { pushAvance, zohoVariablesQueFaltan } from "@/modules/pm/avance/data/zohoClient";
import {
  AVANCE_OBRA_HUB_PATH,
  AVANCE_OBRA_ROUTE_PATTERN,
} from "@/modules/pm/avance/logic/avance-paths";

export interface GuardarAvanceZohoInput {
  promocionId: string;
  /** Solo las fases que de verdad se han tocado en el panel. */
  cambios: { faseId: string; porcentaje: number | string | null }[];
}

export type GuardarAvanceZohoResult =
  | { ok: true; enviados: number; pendientes: string[] }
  | { ok: false; error: string };

/**
 * Guarda de una tirada las fases editadas de una promoción y las sube a Zoho.
 *
 * Sustituye, para este flujo, el paso de aprobación de la bandeja de salida:
 * en vez de dejar el cambio en «pendiente» a la espera de que un admin lo
 * apruebe y lo suba en otro acto, aquí «Guardar» hace las dos cosas de un
 * golpe. Sigue siendo un solo acto humano explícito (el usuario lo confirma
 * en el panel antes de llamar aquí) y sigue dejando rastro en el histórico y
 * en la bandeja de salida — solo que la fila nace ya aprobada y, si Zoho
 * responde bien, enviada.
 *
 * La bandeja de salida (aprobar/descartar/exportar) sigue existiendo para lo
 * que necesite revisión aparte; este botón no pasa por ahí.
 *
 * Cada fase se escribe con la misma RPC que el editor de toda la vida
 * (`pm_avance_registrar_cambio`: vigente + histórico + bandeja en una
 * transacción), así que «guardar el mismo valor» sigue sin escribir nada y el
 * histórico no se duplica. Lo nuevo empieza después: aprobar en el mismo gesto
 * y, solo para las fases con nombre de campo conocido en Zoho, enviarlas ya.
 * Una fase sin `zoho_api_name` se guarda igual (no se pierde el dato) pero se
 * queda pendiente en la bandeja, visible para exportar a mano.
 */
export async function guardarAvanceZoho(
  input: GuardarAvanceZohoInput,
): Promise<GuardarAvanceZohoResult> {
  const promocion = validateUuid(input.promocionId, "promocionId");
  if (!promocion.ok) return { ok: false, error: promocion.error };

  if (!input.cambios || input.cambios.length === 0) {
    return { ok: false, error: "No hay cambios que guardar." };
  }

  const validados: { faseId: string; porcentaje: number | null }[] = [];
  for (const c of input.cambios) {
    const faseId = validateUuid(c.faseId, "faseId");
    if (!faseId.ok) return { ok: false, error: faseId.error };
    const porcentaje = validatePorcentaje(c.porcentaje);
    if (!porcentaje.ok) return { ok: false, error: porcentaje.error };
    validados.push({ faseId: faseId.value, porcentaje: porcentaje.value });
  }

  const auth = await requirePmWriteSupabase();
  if (!auth.ok) return { ok: false, error: auth.error };
  const { client, user } = auth;

  const resultado = await withAudit(
    user,
    "pm.avance_obra.guardar_zoho",
    {
      resourceType: "pm_avance_obra",
      resourceId: promocion.value,
      payload: { cambios: validados },
    },
    () => guardarYEnviar(client, user, promocion.value, validados),
  );

  revalidatePath(AVANCE_OBRA_ROUTE_PATTERN, "page");
  revalidatePath(AVANCE_OBRA_HUB_PATH);

  if (resultado.error) return { ok: false, error: resultado.error.message };
  return resultado.data as GuardarAvanceZohoResult;
}

async function guardarYEnviar(
  client: SupabaseClient,
  user: UserContext,
  promocionId: string,
  cambios: { faseId: string; porcentaje: number | null }[],
): Promise<{ data: GuardarAvanceZohoResult | null; error: { message: string } | null }> {
  // 1. Vigente + histórico + bandeja (pendiente), uno por fase, con la misma
  //    RPC que usa el editor de toda la vida.
  const pendientesFase: string[] = [];
  for (const c of cambios) {
    const { data, error } = await client.rpc("pm_avance_registrar_cambio", {
      p_promocion_id: promocionId,
      p_fase_id: c.faseId,
      p_porcentaje: c.porcentaje,
      p_usuario_id: user.id,
      p_usuario_email: user.email,
    });
    if (error) return { data: null, error: { message: error.message } };
    const res = (data ?? {}) as { pendiente?: boolean };
    if (res.pendiente) pendientesFase.push(c.faseId);
  }

  if (pendientesFase.length === 0) {
    // Todos los valores ya coincidían con lo que tiene Zoho: nada que enviar.
    return { data: { ok: true, enviados: 0, pendientes: [] }, error: null };
  }

  // 2. Qué se puede enviar por API (nombre de campo conocido) y qué se queda
  //    pendiente en la bandeja para exportar a mano.
  const { data: catalogo, error: eCatalogo } = await client
    .from("pm_avance_fase_catalogo")
    .select("id, nombre, zoho_api_name")
    .in("id", pendientesFase);
  if (eCatalogo) return { data: null, error: { message: eCatalogo.message } };
  const porFase = new Map(
    ((catalogo ?? []) as { id: string; nombre: string; zoho_api_name: string | null }[]).map(
      (f) => [f.id, f],
    ),
  );

  const conApi = pendientesFase.filter((id) => porFase.get(id)?.zoho_api_name);
  const sinApi = pendientesFase.filter((id) => !porFase.get(id)?.zoho_api_name);
  const nombresSinApi = sinApi.map((id) => porFase.get(id)?.nombre ?? id);

  if (conApi.length === 0) {
    return { data: { ok: true, enviados: 0, pendientes: nombresSinApi }, error: null };
  }

  const faltan = zohoVariablesQueFaltan();
  if (faltan.length > 0) {
    return {
      data: {
        ok: true,
        enviados: 0,
        pendientes: [...nombresSinApi, ...conApi.map((id) => porFase.get(id)?.nombre ?? id)],
      },
      error: null,
    };
  }

  const { data: promo, error: ePromo } = await client
    .from("pm_promociones")
    .select("zoho_record_id")
    .eq("id", promocionId)
    .maybeSingle();
  if (ePromo) return { data: null, error: { message: ePromo.message } };
  if (!promo) return { data: null, error: { message: "Promoción no encontrada." } };

  // 3. Aprobar en el mismo gesto las filas que sí se van a enviar ya.
  const ahora = new Date().toISOString();
  const { data: filasAprobadas, error: eAprobar } = await client
    .from("pm_avance_zoho_outbox")
    .update({
      estado: "aprobado",
      aprobado_por: user.id,
      aprobado_por_email: user.email,
      aprobado_at: ahora,
    })
    .eq("promocion_id", promocionId)
    .in("fase_id", conApi)
    .eq("estado", "pendiente")
    .select("id, fase_id, porcentaje_nuevo");
  if (eAprobar) return { data: null, error: { message: eAprobar.message } };

  const filas = (filasAprobadas ?? []) as {
    id: string;
    fase_id: string;
    porcentaje_nuevo: number | string | null;
  }[];
  if (filas.length === 0) {
    return { data: { ok: true, enviados: 0, pendientes: nombresSinApi }, error: null };
  }

  const campos: Record<string, number | null> = {};
  for (const f of filas) {
    const apiName = porFase.get(f.fase_id)?.zoho_api_name;
    if (!apiName) continue;
    const v = f.porcentaje_nuevo;
    campos[apiName] = v === null ? null : Number(v);
  }

  const resultadoZoho = await pushAvance([
    { id: (promo as { zoho_record_id: string }).zoho_record_id, campos },
  ]);

  if (resultadoZoho.ok) {
    const idsAprobados = filas.map((f) => f.id);
    await client
      .from("pm_avance_zoho_outbox")
      .update({ estado: "enviado", enviado_at: new Date().toISOString(), error: null })
      .in("id", idsAprobados)
      .eq("estado", "aprobado");
    return { data: { ok: true, enviados: filas.length, pendientes: nombresSinApi }, error: null };
  }

  // Se queda en «aprobado», con el motivo a la vista: el dato ya está guardado
  // en el portal, solo ha fallado el viaje a Zoho, y se puede reintentar desde
  // la bandeja de salida sin volver a aprobarlo.
  await client
    .from("pm_avance_zoho_outbox")
    .update({ error: resultadoZoho.error })
    .in(
      "id",
      filas.map((f) => f.id),
    )
    .eq("estado", "aprobado");

  return {
    data: null,
    error: {
      message: `Se guardó en el portal pero falló el envío a Zoho: ${resultadoZoho.error}`,
    },
  };
}
