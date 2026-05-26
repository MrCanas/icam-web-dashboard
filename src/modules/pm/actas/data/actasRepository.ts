import type { UserContext } from "@/lib/auth/currentUser";

import { getActasReadSupabase } from "./readClient";
import { formatCategoryDisplayName } from "../logic/actas-category-display";
import { buildElementTree } from "../logic/build-element-tree";
import { toElementStatus } from "../logic/element-status";
import { resolveUserDisplayMap } from "../logic/user-display";
import type {
  ActasElementOwner,
  ActasLogEntryItem,
  ActasOperativoCategory,
  ActasProjectDetail,
  ActasProjectListItem,
  ProjectPhase,
} from "../types";

const PROJECT_PHASES = new Set<ProjectPhase>([
  "adquisicion",
  "desarrollo",
  "comercializacion",
  "operacion",
  "desinversion",
  "cierre",
]);

function toProjectPhase(value: string): ProjectPhase {
  if (PROJECT_PHASES.has(value as ProjectPhase)) {
    return value as ProjectPhase;
  }
  return "desarrollo";
}

export interface FetchActasProjectsResult {
  projects: ActasProjectListItem[];
  error: string | null;
}

export async function fetchActasProjects(
  ctx: UserContext,
): Promise<FetchActasProjectsResult> {
  const supabase = await getActasReadSupabase(ctx);

  const { data, error } = await supabase
    .from("project")
    .select("id, code, name, phase")
    .is("archived_at", null)
    .order("name", { ascending: true });

  if (error) {
    return { projects: [], error: error.message };
  }

  const projects: ActasProjectListItem[] = (data ?? []).map((row) => ({
    id: row.id,
    code: row.code,
    name: row.name,
    phase: toProjectPhase(row.phase),
  }));

  return { projects, error: null };
}

// ---------------------------------------------------------------------------
// Project detail
// ---------------------------------------------------------------------------

export interface FetchActasProjectDetailResult {
  project: ActasProjectDetail | null;
  error: string | null;
}

export async function fetchActasProjectDetail(
  ctx: UserContext,
  projectCode: string,
): Promise<FetchActasProjectDetailResult> {
  const supabase = await getActasReadSupabase(ctx);
  const code = projectCode.trim();

  // Fetch base project row
  const { data: projectRow, error: projectErr } = await supabase
    .from("project")
    .select("id, code, name, phase")
    .is("archived_at", null)
    .eq("code", code)
    .maybeSingle();

  if (projectErr) {
    return { project: null, error: projectErr.message };
  }
  if (!projectRow) {
    return { project: null, error: null };
  }

  const projectId = projectRow.id as string;

  // Fetch latest log_entry date and element count in parallel
  const [logResult, elementResult, ownerResult] = await Promise.all([
    supabase
      .from("log_entry")
      .select("entry_date")
      .eq(
        "element_id",
        supabase
          .from("element")
          .select("id")
          .eq(
            "category_id",
            supabase
              .from("category")
              .select("id")
              .eq("project_id", projectId)
              .is("archived_at", null),
          )
          .is("archived_at", null),
      )
      .order("entry_date", { ascending: false })
      .limit(1),
    // element count via category join
    supabase
      .from("element")
      .select("id", { count: "exact", head: true })
      .is("archived_at", null)
      .in(
        "category_id",
        // subquery: categories of this project
        (await supabase
          .from("category")
          .select("id")
          .eq("project_id", projectId)
          .is("archived_at", null)
        ).data?.map((c: { id: string }) => c.id) ?? [],
      ),
    // owner: first element_owner user email (lexicographic by user_id)
    supabase
      .from("element_owner")
      .select("user_id")
      .in(
        "element_id",
        (await supabase
          .from("element")
          .select("id")
          .is("archived_at", null)
          .in(
            "category_id",
            (await supabase
              .from("category")
              .select("id")
              .eq("project_id", projectId)
              .is("archived_at", null)
            ).data?.map((c: { id: string }) => c.id) ?? [],
          )
        ).data?.map((e: { id: string }) => e.id) ?? [],
      )
      .limit(1),
  ]);

  // Resolve owner email from auth.users via service role (supabase admin API not available in JS client; read from element_owner.user_id only for now)
  const ownerUserId =
    (ownerResult.data as { user_id: string }[] | null)?.[0]?.user_id ?? null;

  const lastLogEntryAt =
    (logResult.data as { entry_date: string }[] | null)?.[0]?.entry_date ??
    null;

  return {
    project: {
      id: projectId,
      code: projectRow.code as string,
      name: projectRow.name as string,
      phase: toProjectPhase(projectRow.phase as string),
      ownerEmail: ownerUserId,
      lastLogEntryAt,
      elementCount: elementResult.count ?? 0,
    },
    error: null,
  };
}

// ---------------------------------------------------------------------------
// Vista operativa (categorías + elementos)
// ---------------------------------------------------------------------------

export interface FetchActasProjectOperativoResult {
  categories: ActasOperativoCategory[];
  error: string | null;
}

export async function fetchActasProjectOperativo(
  ctx: UserContext,
  projectId: string,
): Promise<FetchActasProjectOperativoResult> {
  const supabase = await getActasReadSupabase(ctx);

  const { data: catRows, error: catErr } = await supabase
    .from("category")
    .select("id, name, order_index, sublot_label, master_group_id")
    .eq("project_id", projectId)
    .is("archived_at", null)
    .order("order_index", { ascending: true });

  if (catErr) {
    return { categories: [], error: catErr.message };
  }

  const categoriesRaw = catRows ?? [];
  if (categoriesRaw.length === 0) {
    return { categories: [], error: null };
  }

  const categoryIds = categoriesRaw.map((c) => c.id as string);

  const { data: elRows, error: elErr } = await supabase
    .from("element")
    .select(
      "id, category_id, name, status, order_index, parent_element_id, timeline_start, timeline_end",
    )
    .in("category_id", categoryIds)
    .is("archived_at", null)
    .order("order_index", { ascending: true });

  if (elErr) {
    return { categories: [], error: elErr.message };
  }

  const allElements = elRows ?? [];
  const elementIds = allElements.map((el) => el.id as string);

  const [ownerResult, logResult] = await Promise.all([
    elementIds.length > 0
      ? supabase
          .from("element_owner")
          .select("element_id, user_id")
          .in("element_id", elementIds)
      : Promise.resolve({ data: [], error: null }),
    elementIds.length > 0
      ? supabase
          .from("log_entry")
          .select("element_id, content, entry_date")
          .in("element_id", elementIds)
          .is("deleted_at", null)
          .order("entry_date", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (ownerResult.error) {
    return { categories: [], error: ownerResult.error.message };
  }
  if (logResult.error) {
    return { categories: [], error: logResult.error.message };
  }

  const ownersByElement = new Map<string, string[]>();
  for (const row of ownerResult.data ?? []) {
    const eid = row.element_id as string;
    const uid = row.user_id as string;
    const list = ownersByElement.get(eid) ?? [];
    if (!list.includes(uid)) list.push(uid);
    ownersByElement.set(eid, list);
  }

  const lastLogByElement = new Map<
    string,
    { content: string; entryDate: string }
  >();
  for (const row of logResult.data ?? []) {
    const eid = row.element_id as string;
    if (!lastLogByElement.has(eid)) {
      lastLogByElement.set(eid, {
        content: row.content as string,
        entryDate: row.entry_date as string,
      });
    }
  }

  const allOwnerIds = [
    ...new Set(
      (ownerResult.data ?? []).map((r) => r.user_id as string),
    ),
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
      const ownerIds = ownersByElement.get(eid) ?? [];
      const owners = ownerIds
        .map((uid) => userDisplayMap.get(uid))
        .filter((o): o is ActasElementOwner => o != null);
      const lastLog = lastLogByElement.get(eid);

      const parentElementId = (el.parent_element_id as string | null) ?? null;

      return {
        id: eid,
        name: el.name as string,
        status: toElementStatus(el.status as string),
        orderIndex: el.order_index as number,
        parentElementId,
        canHaveSubelements: parentElementId === null,
        owners,
        timelineStart: (el.timeline_start as string | null) ?? null,
        timelineEnd: (el.timeline_end as string | null) ?? null,
        lastEntryContent: lastLog?.content ?? null,
        lastEntryDate: lastLog?.entryDate ?? null,
      };
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

// ---------------------------------------------------------------------------
// Log entries por elemento (histórico inline P5.3)
// ---------------------------------------------------------------------------

export interface FetchElementLogEntriesResult {
  entries: ActasLogEntryItem[];
  error: string | null;
}

export async function fetchElementLogEntries(
  ctx: UserContext,
  elementId: string,
): Promise<FetchElementLogEntriesResult> {
  const supabase = await getActasReadSupabase(ctx);

  const { data: rows, error } = await supabase
    .from("log_entry")
    .select(
      "id, content, entry_date, deleted_at, status_before, status_after, author_id",
    )
    .eq("element_id", elementId)
    .order("entry_date", { ascending: false });

  if (error) {
    return { entries: [], error: error.message };
  }

  const authorIds = [
    ...new Set(
      (rows ?? [])
        .map((r) => r.author_id as string | null)
        .filter((id): id is string => id != null),
    ),
  ];

  let userDisplayMap: Map<string, ActasElementOwner>;
  try {
    userDisplayMap = await resolveUserDisplayMap(authorIds);
  } catch (err) {
    return {
      entries: [],
      error: err instanceof Error ? err.message : "Error resolviendo autores",
    };
  }

  const entries = (rows ?? []).map((row) => {
    const authorId = row.author_id as string | null;
    const statusBefore = row.status_before as string | null;
    const statusAfter = row.status_after as string | null;

    return {
      id: row.id as string,
      content: row.content as string,
      entryDate: row.entry_date as string,
      deletedAt: (row.deleted_at as string | null) ?? null,
      statusBefore:
        statusBefore != null ? toElementStatus(statusBefore) : null,
      statusAfter: statusAfter != null ? toElementStatus(statusAfter) : null,
      author: authorId ? (userDisplayMap.get(authorId) ?? null) : null,
    };
  });

  return { entries, error: null };
}
