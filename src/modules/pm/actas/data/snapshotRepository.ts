import type { UserContext } from "@/lib/auth/currentUser";

import { buildElementTree } from "../logic/build-element-tree";
import { formatCategoryDisplayName } from "../logic/actas-category-display";
import { toElementStatus } from "../logic/element-status";
import { asOfDateToTimestamptz } from "../logic/operativo-asof";
import { resolveUserDisplayMap } from "../logic/user-display";
import type {
  ActasElementOwner,
  ActasOperativoCategory,
  ActasOperativoElement,
} from "../types";
import { getActasAuthenticatedSupabase } from "./authenticatedClient";
import type { FetchActasProjectOperativoResult } from "./actasRepository";
import { getActasReadSupabase } from "./readClient";

type SnapshotRpcRow = {
  element_id: string;
  element_name: string;
  category_id: string;
  status_at_date: string;
  last_log_content: string | null;
  last_log_entry_date: string | null;
  last_log_author_id: string | null;
};

export async function fetchProjectCreatedAt(
  ctx: UserContext,
  projectId: string,
): Promise<{ createdAt: string | null; error: string | null }> {
  const supabase = await getActasReadSupabase(ctx);
  const { data, error } = await supabase
    .from("project")
    .select("created_at")
    .eq("id", projectId)
    .maybeSingle();
  if (error) return { createdAt: null, error: error.message };
  return { createdAt: (data?.created_at as string) ?? null, error: null };
}

export async function fetchProjectSnapshotAtDate(
  ctx: UserContext,
  projectId: string,
  asOfIsoDate: string,
): Promise<FetchActasProjectOperativoResult> {
  const auth = await getActasAuthenticatedSupabase();
  if (!auth.client) {
    return { categories: [], error: auth.error };
  }

  const asOfTs = asOfDateToTimestamptz(asOfIsoDate);
  const { data: snapRows, error: snapErr } = await auth.client.rpc(
    "reconstruct_project_at_date",
    {
      p_project_id: projectId,
      p_as_of_date: asOfTs,
    },
  );

  if (snapErr) {
    return { categories: [], error: snapErr.message };
  }

  const snapshotByElement = new Map<string, SnapshotRpcRow>();
  for (const row of (snapRows ?? []) as SnapshotRpcRow[]) {
    snapshotByElement.set(row.element_id, row);
  }

  const supabase = await getActasReadSupabase(ctx);

  const { data: catRows, error: catErr } = await supabase
    .from("category")
    .select("id, name, order_index, sublot_label, master_group_id")
    .eq("project_id", projectId)
    .is("archived_at", null)
    .order("order_index", { ascending: true });

  if (catErr) return { categories: [], error: catErr.message };

  const categoriesRaw = catRows ?? [];
  if (categoriesRaw.length === 0) {
    return { categories: [], error: null };
  }

  const categoryIds = categoriesRaw.map((c) => c.id as string);

  const { data: elRows, error: elErr } = await supabase
    .from("element")
    .select(
      "id, category_id, name, order_index, parent_element_id, timeline_start, timeline_end",
    )
    .in("category_id", categoryIds)
    .is("archived_at", null)
    .order("order_index", { ascending: true });

  if (elErr) return { categories: [], error: elErr.message };

  const allElements = elRows ?? [];
  const elementIds = allElements.map((el) => el.id as string);

  const ownerResult =
    elementIds.length > 0
      ? await supabase
          .from("element_owner")
          .select("element_id, user_id")
          .in("element_id", elementIds)
      : { data: [], error: null };

  if (ownerResult.error) {
    return { categories: [], error: ownerResult.error.message };
  }

  const ownersByElement = new Map<string, string[]>();
  for (const row of ownerResult.data ?? []) {
    const eid = row.element_id as string;
    const uid = row.user_id as string;
    const list = ownersByElement.get(eid) ?? [];
    if (!list.includes(uid)) list.push(uid);
    ownersByElement.set(eid, list);
  }

  const allOwnerIds = [
    ...new Set((ownerResult.data ?? []).map((r) => r.user_id as string)),
  ];

  let userDisplayMap: Map<string, ActasElementOwner>;
  try {
    userDisplayMap = await resolveUserDisplayMap(allOwnerIds);
  } catch (err) {
    return {
      categories: [],
      error: err instanceof Error ? err.message : "Error resolviendo owners",
    };
  }

  const elementsByCategory = new Map<string, typeof allElements>();
  for (const row of allElements) {
    const cid = row.category_id as string;
    const list = elementsByCategory.get(cid) ?? [];
    list.push(row);
    elementsByCategory.set(cid, list);
  }

  const categories: ActasOperativoCategory[] = categoriesRaw.map((cat) => {
    const name = cat.name as string;
    const sublotLabel = (cat.sublot_label as string | null) ?? null;
    const flat = (elementsByCategory.get(cat.id as string) ?? []).map((el) => {
      const eid = el.id as string;
      const snap = snapshotByElement.get(eid);
      const ownerIds = ownersByElement.get(eid) ?? [];
      const owners = ownerIds
        .map((uid) => userDisplayMap.get(uid))
        .filter((o): o is ActasElementOwner => o != null);
      const parentElementId = (el.parent_element_id as string | null) ?? null;

      const status = snap
        ? toElementStatus(snap.status_at_date)
        : ("not_started" as const);

      return {
        id: eid,
        name: el.name as string,
        status,
        orderIndex: el.order_index as number,
        parentElementId,
        canHaveSubelements: parentElementId === null,
        owners,
        timelineStart: (el.timeline_start as string | null) ?? null,
        timelineEnd: (el.timeline_end as string | null) ?? null,
        lastEntryContent: snap?.last_log_content ?? null,
        lastEntryDate: snap?.last_log_entry_date ?? null,
      } satisfies Omit<ActasOperativoElement, "children">;
    });

    return {
      id: cat.id as string,
      name,
      displayName: formatCategoryDisplayName(name, sublotLabel),
      orderIndex: cat.order_index as number,
      sublotLabel,
      masterGroupId: (cat.master_group_id as string | null) ?? null,
      elements: buildElementTree(flat),
    };
  });

  return { categories, error: null };
}
