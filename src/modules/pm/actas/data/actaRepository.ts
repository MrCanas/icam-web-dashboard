import type { UserContext } from "@/lib/auth/currentUser";

import {
  buildActaViewData,
  buildAuthorOptionsFromEntries,
  buildCategoryMeta,
} from "../logic/group-acta-view";
import { mapLogEntryRow, type LogEntryRow } from "./map-log-entry";
import { getActasReadSupabase } from "./readClient";
import { resolveUserDisplayMap } from "../logic/user-display";
import type {
  ActasActaQueryInput,
  ActasActaViewData,
  ActasLogEntryItem,
} from "../types";

function toIsoRangeBounds(dateFrom: string, dateTo: string): {
  from: string;
  to: string;
} {
  const from = new Date(`${dateFrom}T00:00:00`);
  const to = new Date(`${dateTo}T23:59:59.999`);
  return { from: from.toISOString(), to: to.toISOString() };
}

export interface FetchActasActaViewResult {
  data: ActasActaViewData | null;
  error: string | null;
}

export async function fetchActasActaView(
  ctx: UserContext,
  input: ActasActaQueryInput,
): Promise<FetchActasActaViewResult> {
  const supabase = await getActasReadSupabase(ctx);
  const { from, to } = toIsoRangeBounds(input.dateFrom, input.dateTo);

  const { data: catRows, error: catErr } = await supabase
    .from("category")
    .select("id, name, order_index, master_group_id, sublot_label")
    .eq("project_id", input.projectId)
    .is("archived_at", null)
    .order("order_index", { ascending: true });

  if (catErr) {
    return { data: null, error: catErr.message };
  }

  const categories = buildCategoryMeta(catRows ?? []);
  if (categories.length === 0) {
    return {
      data: {
        categories: [],
        totalEntryCount: 0,
        availableCategories: [],
        availableAuthors: [],
      },
      error: null,
    };
  }

  const categoryIds = categories.map((c) => c.id);

  const { data: elRows, error: elErr } = await supabase
    .from("element")
    .select("id, category_id, name, order_index, parent_element_id")
    .in("category_id", categoryIds)
    .is("archived_at", null);

  if (elErr) {
    return { data: null, error: elErr.message };
  }

  const elements = (elRows ?? []).map((row) => ({
    id: row.id as string,
    categoryId: row.category_id as string,
    name: row.name as string,
    orderIndex: row.order_index as number,
    parentElementId: (row.parent_element_id as string | null) ?? null,
  }));

  const elementIds = elements.map((e) => e.id);
  if (elementIds.length === 0) {
    return {
      data: {
        categories: [],
        totalEntryCount: 0,
        availableCategories: categories.map((c) => ({
          id: c.id,
          label: c.displayName,
        })),
        availableAuthors: [],
      },
      error: null,
    };
  }

  const { data: logRows, error: logErr } = await supabase
    .from("log_entry")
    .select(
      "id, content, entry_date, deleted_at, status_before, status_after, author_id, source, edited_at, element_id",
    )
    .in("element_id", elementIds)
    .is("deleted_at", null)
    .gte("entry_date", from)
    .lte("entry_date", to)
    .order("entry_date", { ascending: true });

  if (logErr) {
    return { data: null, error: logErr.message };
  }

  const elementById = new Map(elements.map((e) => [e.id, e]));
  const categoryById = new Map(categories.map((c) => [c.id, c]));

  const authorIdsForResolve = [
    ...new Set(
      (logRows ?? [])
        .map((r) => r.author_id as string | null)
        .filter((id): id is string => id != null),
    ),
  ];

  let userDisplayMap: Awaited<ReturnType<typeof resolveUserDisplayMap>>;
  try {
    userDisplayMap = await resolveUserDisplayMap(authorIdsForResolve);
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err.message : "Error resolviendo autores",
    };
  }

  const entriesInRange: ActasLogEntryItem[] = [];
  const flatRows: {
    entry: ActasLogEntryItem;
    elementId: string;
    categoryId: string;
  }[] = [];

  for (const row of logRows ?? []) {
    const elementId = row.element_id as string;
    const element = elementById.get(elementId);
    if (!element) continue;
    const category = categoryById.get(element.categoryId);
    if (!category) continue;

    const entry = mapLogEntryRow(row as LogEntryRow, userDisplayMap);
    entriesInRange.push(entry);
    flatRows.push({
      entry,
      elementId,
      categoryId: element.categoryId,
    });
  }

  const userLabels = new Map<string, string>();
  for (const [id, owner] of userDisplayMap) {
    userLabels.set(id, owner.label);
  }

  const authorOptionsFromRange = buildAuthorOptionsFromEntries(
    entriesInRange,
    userLabels,
  );

  const data = buildActaViewData({
    categories,
    elements,
    rows: flatRows,
    filters: {
      categoryIds: input.categoryIds,
      authorIds: input.authorIds,
      onlyWithStatusChange: input.onlyWithStatusChange,
    },
    authorOptionsFromRange,
  });

  return { data, error: null };
}
