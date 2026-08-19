"use server";

import { requireCurrentUser } from "@/lib/auth/currentUser";
import { checkWriteAccess } from "@/lib/auth/permissions";
import { getActasAuthenticatedSupabase } from "@/modules/pm/actas/data/authenticatedClient";

export type UpdateElementTimelineInput = {
  elementId: string;
  timelineStart: string | null;
  timelineEnd: string | null;
};

export type UpdateElementTimelineResult =
  | {
      ok: true;
      timelineStart: string | null;
      timelineEnd: string | null;
    }
  | { ok: false; error: string };

function normalizeDate(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  return trimmed;
}

export async function updateElementTimeline(
  input: UpdateElementTimelineInput,
): Promise<UpdateElementTimelineResult> {
  // Es una escritura: exige permiso de escritura en PM, no solo sesión. Sin
  // esto, un rol `lector` podía mover las fechas de cualquier elemento.
  const user = await requireCurrentUser();
  const denied = checkWriteAccess(user, "pm");
  if (denied) return { ok: false, error: denied };

  const elementId = input.elementId.trim();
  if (!elementId) {
    return { ok: false, error: "elementId requerido" };
  }

  let timelineStart = normalizeDate(input.timelineStart);
  const timelineEnd = normalizeDate(input.timelineEnd);

  if (input.timelineStart && timelineStart == null) {
    return { ok: false, error: "timelineStart no válido (YYYY-MM-DD)" };
  }
  if (input.timelineEnd && timelineEnd == null) {
    return { ok: false, error: "timelineEnd no válido (YYYY-MM-DD)" };
  }

  if (timelineStart && timelineEnd && timelineStart > timelineEnd) {
    // UX defensiva: si llega invertido, corregimos en vez de fallar.
    const swap = timelineStart;
    timelineStart = timelineEnd;
    return await persistTimeline(elementId, timelineStart, swap);
  }

  return persistTimeline(elementId, timelineStart, timelineEnd);
}

async function persistTimeline(
  elementId: string,
  timelineStart: string | null,
  timelineEnd: string | null,
): Promise<UpdateElementTimelineResult> {
  const { client, error: clientError } = await getActasAuthenticatedSupabase();
  if (!client) {
    return { ok: false, error: clientError };
  }

  const { data: element, error: elementError } = await client
    .from("element")
    .select("id")
    .eq("id", elementId)
    .is("archived_at", null)
    .maybeSingle();

  if (elementError) {
    return { ok: false, error: elementError.message };
  }
  if (!element) {
    return {
      ok: false,
      error: "Elemento no encontrado o sin acceso al proyecto",
    };
  }

  const { error: updateError } = await client
    .from("element")
    .update({
      timeline_start: timelineStart,
      timeline_end: timelineEnd,
    })
    .eq("id", elementId);

  if (updateError) {
    return { ok: false, error: updateError.message };
  }

  return { ok: true, timelineStart, timelineEnd };
}
