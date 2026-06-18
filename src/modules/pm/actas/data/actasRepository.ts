import type { UserContext } from "@/lib/auth/currentUser";

import { getActasReadSupabase } from "./readClient";
import { formatCategoryDisplayName } from "../logic/actas-category-display";
import { asOfDateToTimestamptz } from "../logic/operativo-asof";
import { buildElementTree } from "../logic/build-element-tree";
import { toElementStatus } from "../logic/element-status";
import { mapLogEntryRow } from "./map-log-entry";
import { resolveUserDisplayMap } from "../logic/user-display";
import type {
  ActasArchivedElementRef,
  ActasArchivedProjectListItem,
  ActasArchivedProjectRef,
  ActasElementOwner,
  ActasHistoricoElementDetail,
  ActasHistoricoElementOption,
  ActasLogEntryItem,
  ActasOperativoCategory,
  ActasProjectDetail,
  ActasProjectListItem,
  ActasProjectOwner,
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
    .order("sort_order", { ascending: true })
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

export interface FetchActasArchivedProjectsResult {
  projects: ActasArchivedProjectListItem[];
  error: string | null;
}

export async function fetchActasArchivedProjects(
  ctx: UserContext,
): Promise<FetchActasArchivedProjectsResult> {
  const supabase = await getActasReadSupabase(ctx);

  const { data, error } = await supabase
    .from("project")
    .select("id, code, name, phase, archived_at")
    .not("archived_at", "is", null)
    .order("archived_at", { ascending: false });

  if (error) {
    return { projects: [], error: error.message };
  }

  const projects: ActasArchivedProjectListItem[] = (data ?? []).map((row) => ({
    id: row.id as string,
    code: row.code as string,
    name: row.name as string,
    phase: toProjectPhase(row.phase as string),
    archivedAt: row.archived_at as string,
  }));

  return { projects, error: null };
}

export async function fetchActasArchivedProjectsCount(
  ctx: UserContext,
): Promise<{ count: number; error: string | null }> {
  const supabase = await getActasReadSupabase(ctx);
  const { count, error } = await supabase
    .from("project")
    .select("id", { count: "exact", head: true })
    .not("archived_at", "is", null);

  if (error) {
    return { count: 0, error: error.message };
  }
  return { count: count ?? 0, error: null };
}

export type ActasProjectRouteResolution =
  | { kind: "active"; project: ActasProjectDetail }
  | { kind: "archived"; project: ActasArchivedProjectRef }
  | { kind: "not_found" };

export async function resolveActasProjectRoute(
  ctx: UserContext,
  projectCode: string,
): Promise<{ resolution: ActasProjectRouteResolution; error: string | null }> {
  const supabase = await getActasReadSupabase(ctx);
  const code = projectCode.trim();

  const { data: row, error: rowErr } = await supabase
    .from("project")
    .select("id, code, name, archived_at")
    .eq("code", code)
    .maybeSingle();

  if (rowErr) {
    return { resolution: { kind: "not_found" }, error: rowErr.message };
  }
  if (!row) {
    return { resolution: { kind: "not_found" }, error: null };
  }

  if (row.archived_at) {
    return {
      resolution: {
        kind: "archived",
        project: {
          id: row.id as string,
          code: row.code as string,
          name: row.name as string,
          archivedAt: row.archived_at as string,
        },
      },
      error: null,
    };
  }

  const { project, error } = await fetchActasProjectDetail(ctx, code);
  if (error) {
    return { resolution: { kind: "not_found" }, error };
  }
  if (!project) {
    return { resolution: { kind: "not_found" }, error: null };
  }

  return { resolution: { kind: "active", project }, error: null };
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
    .select("id, code, name, phase, owner_user_id")
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
  const [logResult, elementResult] = await Promise.all([
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
  ]);

  // Responsable del proyecto (project.owner_user_id) resuelto a avatar + nombre.
  const ownerUserId = (projectRow.owner_user_id as string | null) ?? null;
  let owner: ActasProjectOwner | null = null;
  if (ownerUserId) {
    const displayMap = await resolveUserDisplayMap([ownerUserId]);
    const resolved = displayMap.get(ownerUserId);
    owner = {
      userId: ownerUserId,
      email: resolved?.email ?? null,
      displayName:
        resolved?.label || resolved?.email?.split("@")[0] || "Usuario",
      initials: resolved?.initials ?? "?",
    };
  }

  const lastLogEntryAt =
    (logResult.data as { entry_date: string }[] | null)?.[0]?.entry_date ??
    null;

  return {
    project: {
      id: projectId,
      code: projectRow.code as string,
      name: projectRow.name as string,
      phase: toProjectPhase(projectRow.phase as string),
      owner,
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
      "id, category_id, name, status, order_index, parent_element_id, timeline_start, timeline_end, progress",
    )
    .in("category_id", categoryIds)
    .is("archived_at", null)
    .order("order_index", { ascending: true });

  if (elErr) {
    return { categories: [], error: elErr.message };
  }

  const allElements = elRows ?? [];
  const elementIds = allElements.map((el) => el.id as string);

  // Recuento de adjuntos por elemento. No fatal: si la tabla aún no existe
  // (migración 014 sin aplicar) seguimos con 0 para no romper el tablero.
  const attachmentCountByElement = new Map<string, number>();
  if (elementIds.length > 0) {
    const { data: attachmentRows } = await supabase
      .from("actas_attachment")
      .select("element_id")
      .in("element_id", elementIds);
    for (const row of attachmentRows ?? []) {
      const eid = row.element_id as string;
      attachmentCountByElement.set(
        eid,
        (attachmentCountByElement.get(eid) ?? 0) + 1,
      );
    }
  }

  // Elementos archivados (soft-delete) por categoría → sección "Archivados".
  const { data: archivedRows, error: archErr } = await supabase
    .from("element")
    .select("id, category_id, name, parent_element_id, archived_at")
    .in("category_id", categoryIds)
    .not("archived_at", "is", null)
    .order("archived_at", { ascending: false });

  if (archErr) {
    return { categories: [], error: archErr.message };
  }

  const archivedAll = archivedRows ?? [];
  const archivedIds = new Set(archivedAll.map((r) => r.id as string));

  const countArchivedDescendants = (id: string): number => {
    let n = 0;
    for (const r of archivedAll) {
      if (((r.parent_element_id as string | null) ?? null) === id) {
        n += 1 + countArchivedDescendants(r.id as string);
      }
    }
    return n;
  };

  const archivedByCategory = new Map<string, ActasArchivedElementRef[]>();
  for (const r of archivedAll) {
    const parentId = (r.parent_element_id as string | null) ?? null;
    // Solo "raíces de archivado": sin padre o con padre no archivado.
    if (parentId != null && archivedIds.has(parentId)) continue;
    const cid = r.category_id as string;
    const list = archivedByCategory.get(cid) ?? [];
    list.push({
      id: r.id as string,
      name: r.name as string,
      isSubelement: parentId != null,
      archivedAt: (r.archived_at as string | null) ?? null,
      descendantCount: countArchivedDescendants(r.id as string),
    });
    archivedByCategory.set(cid, list);
  }

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
          .select("id, element_id, content, entry_date, author_id, source")
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
    {
      id: string;
      content: string;
      entryDate: string;
      authorId: string | null;
      source: string | null;
    }
  >();
  for (const row of logResult.data ?? []) {
    const eid = row.element_id as string;
    if (!lastLogByElement.has(eid)) {
      lastLogByElement.set(eid, {
        id: row.id as string,
        content: row.content as string,
        entryDate: row.entry_date as string,
        authorId: (row.author_id as string | null) ?? null,
        source: (row.source as string | null) ?? null,
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
        progress: (el.progress as number | null) ?? 0,
        attachmentCount: attachmentCountByElement.get(eid) ?? 0,
        timelineStart: (el.timeline_start as string | null) ?? null,
        timelineEnd: (el.timeline_end as string | null) ?? null,
        lastEntryContent: lastLog?.content ?? null,
        lastEntryDate: lastLog?.entryDate ?? null,
        lastEntryId: lastLog?.id ?? null,
        lastEntryAuthorId: lastLog?.authorId ?? null,
        lastEntrySource: lastLog?.source ?? null,
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
      archivedElements: archivedByCategory.get(cat.id as string) ?? [],
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
  options?: { asOfIsoDate?: string },
): Promise<FetchElementLogEntriesResult> {
  const supabase = await getActasReadSupabase(ctx);

  let query = supabase
    .from("log_entry")
    .select(
      "id, content, entry_date, deleted_at, status_before, status_after, author_id, source, edited_at",
    )
    .eq("element_id", elementId);

  if (options?.asOfIsoDate) {
    query = query.lte("entry_date", asOfDateToTimestamptz(options.asOfIsoDate));
  }

  const { data: rows, error } = await query.order("entry_date", {
    ascending: false,
  });

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

  const entries = (rows ?? []).map((row) =>
    mapLogEntryRow(
      {
        id: row.id as string,
        content: row.content as string,
        entry_date: row.entry_date as string,
        deleted_at: (row.deleted_at as string | null) ?? null,
        status_before: row.status_before as string | null,
        status_after: row.status_after as string | null,
        author_id: row.author_id as string | null,
        source: row.source as string | null | undefined,
        edited_at: row.edited_at as string | null | undefined,
      },
      userDisplayMap,
    ),
  );

  return { entries, error: null };
}

// ---------------------------------------------------------------------------
// Tab Histórico (P8.3)
// ---------------------------------------------------------------------------

export interface FetchHistoricoElementOptionsResult {
  options: ActasHistoricoElementOption[];
  error: string | null;
}

export async function fetchHistoricoElementOptions(
  ctx: UserContext,
  projectId: string,
): Promise<FetchHistoricoElementOptionsResult> {
  const supabase = await getActasReadSupabase(ctx);

  const { data: catRows, error: catErr } = await supabase
    .from("category")
    .select("id, name, sublot_label")
    .eq("project_id", projectId)
    .is("archived_at", null)
    .order("order_index", { ascending: true });

  if (catErr) {
    return { options: [], error: catErr.message };
  }

  const categories = catRows ?? [];
  if (categories.length === 0) {
    return { options: [], error: null };
  }

  const categoryMeta = new Map(
    categories.map((c) => [
      c.id as string,
      formatCategoryDisplayName(
        c.name as string,
        (c.sublot_label as string | null) ?? null,
      ),
    ]),
  );
  const categoryIds = categories.map((c) => c.id as string);

  const { data: elRows, error: elErr } = await supabase
    .from("element")
    .select("id, name, category_id, archived_at")
    .in("category_id", categoryIds)
    .order("name", { ascending: true });

  if (elErr) {
    return { options: [], error: elErr.message };
  }

  const options: ActasHistoricoElementOption[] = (elRows ?? []).map((row) => ({
    id: row.id as string,
    name: row.name as string,
    categoryId: row.category_id as string,
    categoryLabel: categoryMeta.get(row.category_id as string) ?? "",
    archived: row.archived_at != null,
  }));

  return { options, error: null };
}

export type FetchHistoricoElementDetailResult =
  | { detail: ActasHistoricoElementDetail; error: null }
  | { detail: null; error: string | null; notFound?: boolean };

export async function fetchHistoricoElementDetail(
  ctx: UserContext,
  projectId: string,
  elementId: string,
): Promise<FetchHistoricoElementDetailResult> {
  const supabase = await getActasReadSupabase(ctx);

  const { data: elRow, error: elErr } = await supabase
    .from("element")
    .select(
      "id, name, status, created_at, archived_at, timeline_start, timeline_end, category_id, category:category_id ( id, name, sublot_label, project_id, archived_at )",
    )
    .eq("id", elementId)
    .maybeSingle();

  if (elErr) {
    return { detail: null, error: elErr.message };
  }
  if (!elRow) {
    return { detail: null, error: null, notFound: true };
  }

  const categoryJoined = elRow.category as
    | {
        id: string;
        name: string;
        sublot_label: string | null;
        project_id: string;
        archived_at: string | null;
      }
    | {
        id: string;
        name: string;
        sublot_label: string | null;
        project_id: string;
        archived_at: string | null;
      }[]
    | null;
  const categoryRaw = Array.isArray(categoryJoined)
    ? categoryJoined[0]
    : categoryJoined;

  if (!categoryRaw || categoryRaw.project_id !== projectId) {
    return { detail: null, error: null, notFound: true };
  }

  const [ownerResult, logResult] = await Promise.all([
    supabase
      .from("element_owner")
      .select("user_id")
      .eq("element_id", elementId),
    supabase
      .from("log_entry")
      .select(
        "id, content, entry_date, deleted_at, status_before, status_after, author_id, source, edited_at",
      )
      .eq("element_id", elementId)
      .order("entry_date", { ascending: true }),
  ]);

  if (ownerResult.error) {
    return { detail: null, error: ownerResult.error.message };
  }
  if (logResult.error) {
    return { detail: null, error: logResult.error.message };
  }

  const authorIds = [
    ...new Set(
      (logResult.data ?? [])
        .map((r) => r.author_id as string | null)
        .filter((id): id is string => id != null),
    ),
    ...(ownerResult.data ?? []).map((r) => r.user_id as string),
  ];

  let userDisplayMap: Map<string, ActasElementOwner>;
  try {
    userDisplayMap = await resolveUserDisplayMap(authorIds);
  } catch (err) {
    return {
      detail: null,
      error: err instanceof Error ? err.message : "Error resolviendo autores",
    };
  }

  const entries: ActasLogEntryItem[] = (logResult.data ?? []).map((row) =>
    mapLogEntryRow(
      {
        id: row.id as string,
        content: row.content as string,
        entry_date: row.entry_date as string,
        deleted_at: (row.deleted_at as string | null) ?? null,
        status_before: row.status_before as string | null,
        status_after: row.status_after as string | null,
        author_id: row.author_id as string | null,
        source: row.source as string | null | undefined,
        edited_at: row.edited_at as string | null | undefined,
      },
      userDisplayMap,
    ),
  );

  const activeEntries = entries.filter((e) => e.deletedAt == null);
  const lastActivityAt =
    activeEntries.length > 0
      ? activeEntries[activeEntries.length - 1]!.entryDate
      : null;

  const owners: ActasElementOwner[] = (ownerResult.data ?? []).map((row) => {
    const uid = row.user_id as string;
    return (
      userDisplayMap.get(uid) ?? {
        userId: uid,
        email: null,
        label: uid.slice(0, 8),
        initials: uid.slice(0, 2).toUpperCase(),
      }
    );
  });

  return {
    detail: {
      element: {
        id: elRow.id as string,
        name: elRow.name as string,
        status: toElementStatus(elRow.status as string),
        archivedAt: (elRow.archived_at as string | null) ?? null,
        createdAt: elRow.created_at as string,
        lastActivityAt,
        timelineStart: (elRow.timeline_start as string | null) ?? null,
        timelineEnd: (elRow.timeline_end as string | null) ?? null,
      },
      category: {
        id: categoryRaw.id,
        displayName: formatCategoryDisplayName(
          categoryRaw.name,
          categoryRaw.sublot_label,
        ),
      },
      owners,
      entries,
    },
    error: null,
  };
}
