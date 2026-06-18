"use server";

import { requireCurrentUser } from "@/lib/auth/currentUser";
import { checkWriteAccess } from "@/lib/auth/permissions";
import { getActasAuthenticatedSupabase } from "@/modules/pm/actas/data/authenticatedClient";
import { resolveUserDisplayMap } from "@/modules/pm/actas/logic/user-display";
import type { ActasProjectOwner } from "@/modules/pm/actas/types";

export type SetProjectOwnerInput = {
  projectId: string;
  /** userId del nuevo responsable, o null para "Sin responsable". */
  ownerUserId: string | null;
};

export type SetProjectOwnerResult =
  | { ok: true; owner: ActasProjectOwner | null }
  | { ok: false; error: string };

export async function setProjectOwner(
  input: SetProjectOwnerInput,
): Promise<SetProjectOwnerResult> {
  const user = await requireCurrentUser();
  // Gate de rol EDITOR de la zona pm (la RLS de project_update es defensa extra).
  const writeDenied = checkWriteAccess(user, "pm");
  if (writeDenied) return { ok: false, error: writeDenied };

  const projectId = input.projectId.trim();
  if (!projectId) return { ok: false, error: "projectId requerido" };
  const ownerUserId = input.ownerUserId?.trim() || null;

  const auth = await getActasAuthenticatedSupabase();
  if (!auth.client) return { ok: false, error: auth.error };

  const { error } = await auth.client
    .from("project")
    .update({ owner_user_id: ownerUserId })
    .eq("id", projectId);

  if (error) return { ok: false, error: error.message };

  if (!ownerUserId) return { ok: true, owner: null };

  const displayMap = await resolveUserDisplayMap([ownerUserId]);
  const resolved = displayMap.get(ownerUserId);
  const owner: ActasProjectOwner = {
    userId: ownerUserId,
    email: resolved?.email ?? null,
    displayName: resolved?.label || resolved?.email?.split("@")[0] || "Usuario",
    initials: resolved?.initials ?? "?",
  };
  return { ok: true, owner };
}
