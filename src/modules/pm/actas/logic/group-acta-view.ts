import { formatCategoryDisplayName } from "@/modules/pm/actas/logic/actas-category-display";
import type {
  ActasActaAuthorOption,
  ActasActaCategorySection,
  ActasActaElementSection,
  ActasActaFilterOption,
  ActasActaQueryInput,
  ActasActaViewData,
  ActasLogEntryItem,
} from "@/modules/pm/actas/types";

interface CategoryMeta {
  id: string;
  name: string;
  displayName: string;
  orderIndex: number;
  masterGroupId: string | null;
}

interface ElementMeta {
  id: string;
  categoryId: string;
  name: string;
  orderIndex: number;
  parentElementId: string | null;
}

interface FlatActaRow {
  entry: ActasLogEntryItem;
  elementId: string;
  categoryId: string;
}

function computeDepths(elements: ElementMeta[]): Map<string, number> {
  const parentById = new Map(
    elements.map((e) => [e.id, e.parentElementId]),
  );
  const depth = new Map<string, number>();

  function getDepth(id: string): number {
    const cached = depth.get(id);
    if (cached != null) return cached;
    const parent = parentById.get(id);
    if (!parent) {
      depth.set(id, 0);
      return 0;
    }
    const d = getDepth(parent) + 1;
    depth.set(id, d);
    return d;
  }

  for (const el of elements) {
    getDepth(el.id);
  }
  return depth;
}

function sortElementsForActa(
  elementIds: string[],
  elementsById: Map<string, ElementMeta>,
  depths: Map<string, number>,
): string[] {
  const set = new Set(elementIds);
  const roots = elementIds
    .filter((id) => {
      const parent = elementsById.get(id)?.parentElementId;
      return !parent || !set.has(parent);
    })
    .sort((a, b) => {
      const ea = elementsById.get(a)!;
      const eb = elementsById.get(b)!;
      return ea.orderIndex - eb.orderIndex || ea.name.localeCompare(eb.name);
    });

  const result: string[] = [];
  const visit = (id: string) => {
    if (!set.has(id) || result.includes(id)) return;
    result.push(id);
    const children = elementIds
      .filter((cid) => elementsById.get(cid)?.parentElementId === id)
      .sort((a, b) => {
        const ea = elementsById.get(a)!;
        const eb = elementsById.get(b)!;
        return ea.orderIndex - eb.orderIndex || ea.name.localeCompare(eb.name);
      });
    for (const child of children) visit(child);
  };

  for (const root of roots) visit(root);
  for (const id of elementIds) {
    if (!result.includes(id)) result.push(id);
  }
  return result;
}

function matchesAuthorFilter(
  authorId: string | null,
  authorIds: (string | null)[] | undefined,
): boolean {
  if (!authorIds || authorIds.length === 0) return true;
  return authorIds.some((a) =>
    a == null ? authorId == null : a === authorId,
  );
}

function matchesCategoryFilter(
  categoryId: string,
  categoryIds: string[] | undefined,
): boolean {
  if (!categoryIds || categoryIds.length === 0) return true;
  return categoryIds.includes(categoryId);
}

export function buildActaViewData(params: {
  categories: CategoryMeta[];
  elements: ElementMeta[];
  rows: FlatActaRow[];
  filters: Pick<
    ActasActaQueryInput,
    "categoryIds" | "authorIds" | "onlyWithStatusChange"
  >;
  authorOptionsFromRange: ActasActaAuthorOption[];
}): ActasActaViewData {
  const { categories, elements, rows, filters, authorOptionsFromRange } = params;

  const availableCategories: ActasActaFilterOption[] = categories.map((c) => ({
    id: c.id,
    label: c.displayName,
  }));

  const elementsById = new Map(elements.map((e) => [e.id, e]));
  const depths = computeDepths(elements);

  const filteredRows = rows.filter((row) => {
    if (
      !matchesCategoryFilter(row.categoryId, filters.categoryIds)
    ) {
      return false;
    }
    if (!matchesAuthorFilter(row.entry.authorId, filters.authorIds)) {
      return false;
    }
    if (filters.onlyWithStatusChange) {
      if (
        row.entry.statusBefore == null ||
        row.entry.statusAfter == null
      ) {
        return false;
      }
    }
    return true;
  });

  const byCategory = new Map<string, Map<string, ActasLogEntryItem[]>>();
  for (const row of filteredRows) {
    let byElement = byCategory.get(row.categoryId);
    if (!byElement) {
      byElement = new Map();
      byCategory.set(row.categoryId, byElement);
    }
    const list = byElement.get(row.elementId) ?? [];
    list.push(row.entry);
    byElement.set(row.elementId, list);
  }

  const categorySections: ActasActaCategorySection[] = [];

  for (const cat of categories) {
    const byElement = byCategory.get(cat.id);
    if (!byElement || byElement.size === 0) continue;

    const elementIds = [...byElement.keys()];
    const sortedElementIds = sortElementsForActa(
      elementIds,
      elementsById,
      depths,
    );

    const elementSections: ActasActaElementSection[] = [];
    let categoryEntryCount = 0;

    for (const elementId of sortedElementIds) {
      const entries = [...(byElement.get(elementId) ?? [])].sort(
        (a, b) =>
          new Date(a.entryDate).getTime() - new Date(b.entryDate).getTime(),
      );
      if (entries.length === 0) continue;

      const meta = elementsById.get(elementId);
      if (!meta) continue;

      categoryEntryCount += entries.length;
      elementSections.push({
        id: elementId,
        name: meta.name,
        depth: depths.get(elementId) ?? 0,
        orderIndex: meta.orderIndex,
        entryCount: entries.length,
        entries,
      });
    }

    if (elementSections.length === 0) continue;

    categorySections.push({
      id: cat.id,
      name: cat.name,
      displayName: cat.displayName,
      masterGroupId: cat.masterGroupId,
      orderIndex: cat.orderIndex,
      entryCount: categoryEntryCount,
      elements: elementSections,
    });
  }

  return {
    categories: categorySections,
    totalEntryCount: filteredRows.length,
    availableCategories,
    availableAuthors: authorOptionsFromRange,
  };
}

export function buildCategoryMeta(
  rows: {
    id: string;
    name: string;
    order_index: number;
    master_group_id: string | null;
    sublot_label: string | null;
  }[],
): CategoryMeta[] {
  return rows.map((c) => ({
    id: c.id,
    name: c.name,
    displayName: formatCategoryDisplayName(c.name, c.sublot_label),
    orderIndex: c.order_index,
    masterGroupId: c.master_group_id,
  }));
}

export function buildAuthorOptionsFromEntries(
  entries: ActasLogEntryItem[],
  userLabels: Map<string, string>,
): ActasActaAuthorOption[] {
  const seen = new Map<string | null, ActasActaAuthorOption>();
  for (const entry of entries) {
    const id = entry.authorId;
    if (seen.has(id)) continue;
    if (id == null) {
      seen.set(null, { id: null, label: "Sin autor" });
    } else {
      const label =
        entry.author?.label ??
        userLabels.get(id) ??
        entry.author?.email?.split("@")[0] ??
        id.slice(0, 8);
      seen.set(id, { id, label });
    }
  }
  const list = [...seen.values()];
  list.sort((a, b) => {
    if (a.id == null) return 1;
    if (b.id == null) return -1;
    return a.label.localeCompare(b.label, "es");
  });
  return list;
}
