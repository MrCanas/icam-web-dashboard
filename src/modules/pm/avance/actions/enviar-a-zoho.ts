"use server";

import { revalidatePath } from "next/cache";

import { withAudit } from "@/lib/audit/withAudit";
import { getUserRole } from "@/lib/auth/permissions";
import { fetchCambiosAprobados } from "@/modules/pm/avance/data/avanceRepository";
import { pushAvance, zohoVariablesQueFaltan } from "@/modules/pm/avance/data/zohoClient";
import { requirePmWriteSupabase } from "@/modules/pm/planificacion/data/writeClient";
import {
  AVANCE_OBRA_HUB_PATH,
  AVANCE_OBRA_ROUTE_PATTERN,
} from "@/modules/pm/avance/logic/avance-paths";

export type EnviarAZohoResult =
  | { ok: true; enviados: number; promociones: number }
  | { ok: false; error: string; enviados?: number };

/**
 * Sube a Zoho CRM los cambios de avance YA APROBADOS.
 *
 * Es el único punto del código que escribe en Zoho, y lo dispara una persona
 * pulsando un botón: no hay cron, ni webhook, ni escritura al editar. La regla
 * del encargo es que nada se sobrescriba sin aprobación previa, y aquí se
 * cumple dos veces — un admin aprueba cada cambio y otro acto explícito lo
 * envía.
 *
 * Solo viajan las fases con cambio aprobado: emitir el resto sería reescribir
 * en Zoho valores que nadie ha revisado.
 */
export async function enviarAZoho(): Promise<EnviarAZohoResult> {
  const auth = await requirePmWriteSupabase();
  if (!auth.ok) return { ok: false, error: auth.error };
  const { client, user } = auth;

  if (getUserRole(user, "pm") !== "admin") {
    return { ok: false, error: "Solo un administrador de PM puede subir cambios a Zoho." };
  }

  const faltan = zohoVariablesQueFaltan();
  if (faltan.length > 0) {
    return {
      ok: false,
      error:
        `La conexión con Zoho no está configurada (faltan ${faltan.join(", ")}). ` +
        "Mientras tanto, usa «Descargar CSV/JSON» y súbelo desde Zoho.",
    };
  }

  const { cambios, error } = await fetchCambiosAprobados(user);
  if (error) return { ok: false, error };
  if (cambios.length === 0) {
    return { ok: false, error: "No hay cambios aprobados que subir." };
  }

  // Sin el nombre API del campo no se puede escribir, y adivinarlo escribiría en
  // el sitio equivocado. Se para antes de enviar nada: un envío a medias deja
  // Zoho y el portal descuadrados sin que nadie se entere.
  const sinApiName = [...new Set(cambios.filter((c) => !c.zohoApiName).map((c) => c.faseNombre))];
  if (sinApiName.length > 0) {
    return {
      ok: false,
      error:
        `No se conoce el nombre API en Zoho de: ${sinApiName.join(", ")}. ` +
        "Ejecuta `npm run pm:zoho-explore -- --campos` y rellena pm_avance_fase_catalogo.zoho_api_name.",
    };
  }

  // Un registro de Zoho por promoción, con todas sus fases aprobadas juntas.
  const porRegistro = new Map<
    string,
    { campos: Record<string, number | null>; outboxIds: string[] }
  >();
  for (const c of cambios) {
    const entrada = porRegistro.get(c.zohoRecordId) ?? { campos: {}, outboxIds: [] };
    entrada.campos[c.zohoApiName!] = c.porcentajeNuevo;
    entrada.outboxIds.push(c.outboxId);
    porRegistro.set(c.zohoRecordId, entrada);
  }

  const resultado = await pushAvance(
    [...porRegistro.entries()].map(([id, v]) => ({ id, campos: v.campos })),
  );

  // Zoho responde 207: unos registros pueden ir bien y otros mal. Se cierra solo
  // lo que de verdad llegó, y el fallo se guarda en la fila para poder mirarlo.
  const ahora = new Date().toISOString();
  const okIds = new Set((resultado.detalles ?? []).filter((d) => d.ok).map((d) => d.id));
  const errorPorId = new Map(
    (resultado.detalles ?? []).filter((d) => !d.ok).map((d) => [d.id, d.mensaje]),
  );

  let enviados = 0;
  for (const [recordId, { outboxIds }] of porRegistro) {
    if (okIds.has(recordId)) {
      const { error: e } = await client
        .from("pm_avance_zoho_outbox")
        .update({ estado: "enviado", enviado_at: ahora, error: null })
        .in("id", outboxIds)
        .eq("estado", "aprobado");
      if (!e) enviados += outboxIds.length;
      continue;
    }
    const mensaje = errorPorId.get(recordId);
    if (mensaje) {
      // Se queda en «aprobado» a propósito: así se puede reintentar sin volver
      // a aprobarlo, con el motivo del fallo a la vista.
      await client.from("pm_avance_zoho_outbox").update({ error: mensaje }).in("id", outboxIds);
    }
  }

  await withAudit(
    user,
    "pm.avance_obra.enviar_zoho",
    {
      resourceType: "pm_avance_zoho_outbox",
      payload: { promociones: porRegistro.size, cambios: cambios.length, enviados },
    },
    async () => ({ error: resultado.ok ? null : { message: resultado.error } }),
  );

  revalidatePath(AVANCE_OBRA_HUB_PATH);
  revalidatePath(AVANCE_OBRA_ROUTE_PATTERN, "page");

  if (!resultado.ok) return { ok: false, error: resultado.error, enviados };
  return { ok: true, enviados, promociones: porRegistro.size };
}
