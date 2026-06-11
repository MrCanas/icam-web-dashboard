import { createServiceRoleClient } from "@/lib/db/admin";

import { getActasAuthenticatedSupabase } from "./authenticatedClient";
import { ownerFromAuthUser } from "../logic/user-display";

export interface OrgMemberSearchResult {
  userId: string;
  email: string;
  label: string;
  initials: string;
}

export interface ElementOwnerPickerContext {
  orgId: string;
  orgName: string;
}

type ProjectOrgRow = {
  organization_id: string;
  organization: { id: string; name: string } | { id: string; name: string }[] | null;
};

type CategoryProjectRow = {
  project: ProjectOrgRow | ProjectOrgRow[] | null;
};

type ElementOrgRow = {
  id: string;
  category: CategoryProjectRow | CategoryProjectRow[] | null;
};

function normalizeOne<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export async function fetchElementOwnerPickerContext(
  elementId: string,
): Promise<
  | { ok: true; context: ElementOwnerPickerContext }
  | { ok: false; error: string }
> {
  const auth = await getActasAuthenticatedSupabase();
  if (!auth.client) {
    return { ok: false, error: auth.error };
  }

  const { data, error } = await auth.client
    .from("element")
    .select(
      `
      id,
      category:category_id (
        project:project_id (
          organization_id,
          organization:organization_id ( id, name )
        )
      )
    `,
    )
    .eq("id", elementId)
    .is("archived_at", null)
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!data) {
    return { ok: false, error: "Elemento no encontrado o sin acceso" };
  }

  const row = data as ElementOrgRow;
  const category = normalizeOne(row.category);
  const project = normalizeOne(category?.project ?? null);
  const org = normalizeOne(project?.organization ?? null);
  const orgId =
    (org?.id as string | undefined) ??
    (project?.organization_id as string | undefined);

  if (!orgId) {
    return { ok: false, error: "No se pudo resolver la organización del proyecto" };
  }

  return {
    ok: true,
    context: {
      orgId,
      orgName: (org?.name as string) ?? "la organización",
    },
  };
}

async function listOrgMemberUserIds(orgId: string): Promise<string[]> {
  const auth = await getActasAuthenticatedSupabase();
  if (!auth.client) {
    throw new Error(auth.error);
  }

  const { data, error } = await auth.client
    .from("org_member")
    .select("user_id")
    .eq("organization_id", orgId);

  if (error) throw new Error(error.message);
  return [...new Set((data ?? []).map((r) => r.user_id as string))];
}

export async function searchOrgMembers(
  orgId: string,
  query: string,
  limit = 20,
): Promise<
  | { ok: true; members: OrgMemberSearchResult[] }
  | { ok: false; error: string }
> {
  const trimmed = query.trim().toLowerCase();
  const effectiveLimit = trimmed ? limit : Math.min(10, limit);

  try {
    const memberIds = await listOrgMemberUserIds(orgId);
    if (memberIds.length === 0) {
      return { ok: true, members: [] };
    }

    const memberSet = new Set(memberIds);
    const admin = createServiceRoleClient();
    const matches: OrgMemberSearchResult[] = [];
    let page = 1;
    const perPage = 200;

    for (;;) {
      const { data, error } = await admin.auth.admin.listUsers({
        page,
        perPage,
      });
      if (error) {
        return { ok: false, error: error.message };
      }

      for (const user of data.users) {
        if (!memberSet.has(user.id)) continue;
        const owner = ownerFromAuthUser(user.id, user.email);
        const email = owner.email ?? "";
        const name =
          typeof user.user_metadata?.name === "string"
            ? user.user_metadata.name
            : "";
        if (trimmed) {
          const haystack = `${email} ${name} ${owner.label}`.toLowerCase();
          if (!haystack.includes(trimmed)) continue;
        }
        matches.push({
          userId: owner.userId,
          email: email || owner.label,
          label: owner.label,
          initials: owner.initials,
        });
      }

      if (data.users.length < perPage) break;
      page += 1;
    }

    matches.sort((a, b) => a.email.localeCompare(b.email, "es"));
    return { ok: true, members: matches.slice(0, effectiveLimit) };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error buscando miembros",
    };
  }
}
