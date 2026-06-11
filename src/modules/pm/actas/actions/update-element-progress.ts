"use server";

import { requireCurrentUser } from "@/lib/auth/currentUser";
import { checkWriteAccess } from "@/lib/auth/permissions";
import { getActasAuthenticatedSupabase } from "@/modules/pm/actas/data/authenticatedClient";

export type UpdateElementProgressInput = {
  elementId: string;
  /** 0–100; se clampa por seguridad. */
  progress: number;
};

export type UpdateElementProgressResult =
  | { ok: true; progress: number }
  | { ok: false; error: string };

function clampProgress(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export async function updateElementProgress(
  input: UpdateElementProgressInput,
): Promise<UpdateElementProgressResult> {
  const elementId = input.elementId.trim();
  if (!elementId) {
    return { ok: false, error: "elementId requerido" };
  }

  const user = await requireCurrentUser();
  const writeDenied = checkWriteAccess(user, "pm");
  if (writeDenied) return { ok: false, error: writeDenied };

  const progress = clampProgress(input.progress);

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
    .update({ progress })
    .eq("id", elementId);

  if (updateError) {
    return { ok: false, error: updateError.message };
  }

  return { ok: true, progress };
}
