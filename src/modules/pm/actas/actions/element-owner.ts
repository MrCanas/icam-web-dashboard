"use server";

import { requireCurrentUser } from "@/lib/auth/currentUser";
import { getActasAuthenticatedSupabase } from "@/modules/pm/actas/data/authenticatedClient";
import {
  fetchElementOwnerPickerContext,
  searchOrgMembers as searchOrgMembersRepo,
} from "@/modules/pm/actas/data/orgMembersRepository";

export type GetOwnerPickerContextResult =
  | { ok: true; orgId: string; orgName: string }
  | { ok: false; error: string };

export async function getElementOwnerPickerContext(
  elementId: string,
): Promise<GetOwnerPickerContextResult> {
  await requireCurrentUser();
  const result = await fetchElementOwnerPickerContext(elementId);
  if (!result.ok) return result;
  return { ok: true, ...result.context };
}

export type SearchOrgMembersInput = {
  orgId: string;
  query?: string;
  limit?: number;
};

export type SearchOrgMembersResult =
  | {
      ok: true;
      members: {
        userId: string;
        email: string;
        label: string;
        initials: string;
      }[];
    }
  | { ok: false; error: string };

export async function searchOrgMembers(
  input: SearchOrgMembersInput,
): Promise<SearchOrgMembersResult> {
  await requireCurrentUser();
  return searchOrgMembersRepo(
    input.orgId,
    input.query ?? "",
    input.limit ?? 20,
  );
}

export type MutateElementOwnerInput = {
  elementId: string;
  userId: string;
};

export type MutateElementOwnerResult =
  | { ok: true }
  | { ok: false; error: string };

async function assertElementAccess(
  elementId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const auth = await getActasAuthenticatedSupabase();
  if (!auth.client) {
    return { ok: false, error: auth.error };
  }

  const { data, error } = await auth.client
    .from("element")
    .select("id")
    .eq("id", elementId)
    .is("archived_at", null)
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!data) {
    return { ok: false, error: "Elemento no encontrado o sin acceso al proyecto" };
  }
  return { ok: true };
}

export async function addElementOwner(
  input: MutateElementOwnerInput,
): Promise<MutateElementOwnerResult> {
  await requireCurrentUser();
  const elementId = input.elementId.trim();
  const userId = input.userId.trim();
  if (!elementId || !userId) {
    return { ok: false, error: "elementId y userId requeridos" };
  }

  const access = await assertElementAccess(elementId);
  if (!access.ok) return access;

  const auth = await getActasAuthenticatedSupabase();
  if (!auth.client) {
    return { ok: false, error: auth.error };
  }

  const { error } = await auth.client.from("element_owner").upsert(
    { element_id: elementId, user_id: userId },
    { onConflict: "element_id,user_id", ignoreDuplicates: true },
  );

  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export async function removeElementOwner(
  input: MutateElementOwnerInput,
): Promise<MutateElementOwnerResult> {
  await requireCurrentUser();
  const elementId = input.elementId.trim();
  const userId = input.userId.trim();
  if (!elementId || !userId) {
    return { ok: false, error: "elementId y userId requeridos" };
  }

  const access = await assertElementAccess(elementId);
  if (!access.ok) return access;

  const auth = await getActasAuthenticatedSupabase();
  if (!auth.client) {
    return { ok: false, error: auth.error };
  }

  const { error } = await auth.client
    .from("element_owner")
    .delete()
    .eq("element_id", elementId)
    .eq("user_id", userId);

  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
