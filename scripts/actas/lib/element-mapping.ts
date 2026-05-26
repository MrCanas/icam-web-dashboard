import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { createActasServerClient } from "./supabase-server";
import {
  findManualElementResolution,
  findManualParentChildResolution,
} from "./manual-element-resolutions";
import {
  flattenMondayItemsWithParentContext,
  type MondayFlattenedElement,
  type MondayRawItem,
} from "./monday-board-parse";
import {
  normalizeKey,
  normalizeForMatch,
  resolveElementAlias,
  resolveGroupAlias,
} from "./normalize";
import { mondayQuery } from "../../../src/services/monday/client";

export const ELEMENT_MAPPING_OUTPUT = resolve(
  process.cwd(),
  "docs/actas/07-element-mapping.json",
);
export const UNMAPPED_SUMMARY_OUTPUT = resolve(
  process.cwd(),
  "docs/actas/07b-elements-unmapped-summary.md",
);

export type ElementMatchType =
  | "exact"
  | "cross_group"
  | "parent_context"
  | "manual_resolution"
  | "normalized"
  | "inclusion"
  | "fuzzy";

export interface MasterGroup {
  id: string;
  name: string;
}

export interface MasterElement {
  id: string;
  name: string;
  master_group_id: string;
  parent_element_id: string | null;
  is_subitem: boolean;
}

export interface ElementMatchContext {
  parent_item_name?: string | null;
  parent_monday_group?: string | null;
}

export interface GroupMapping {
  monday_group_id: string;
  monday_title: string;
  master_group_id: string | null;
  master_group_name: string | null;
  mapped: boolean;
  unmapped: boolean;
  match_method: "alias_exact" | "normalized" | "manual" | "none";
  manual_master_group_id: string | null;
  notes: string | null;
  appearance_count?: number;
  project_codes?: string[];
}

export interface ElementMatchOutcome {
  master_element_id: string | null;
  master_element_name: string | null;
  master_group_id: string | null;
  mapped: boolean;
  unmapped: boolean;
  match_type: ElementMatchType | null;
  suggested_master_name: string | null;
  manual_master_element_id: string | null;
  notes: string | null;
  matched_via_parent: string | null;
}

export interface ElementMappingRow extends ElementMatchOutcome {
  monday_item_id: string;
  monday_name: string;
  monday_group_title: string;
  parent_item_name: string | null;
  parent_monday_group: string | null;
}

export interface UniqueElementMapping extends ElementMatchOutcome {
  monday_name: string;
  monday_name_normalized: string;
  appearance_count: number;
  occurrence_count: number;
  project_codes: string[];
  monday_groups_seen: string[];
  sample_monday_group: string;
  sample_board_id: string;
  sample_board_name: string;
  proposed_master_group: string | null;
  proposed_master_group_id: string | null;
  boards_sample: { board_id: string; board_name: string; project_code: string | null }[];
  parent_item_name: string | null;
  parent_monday_group: string | null;
}

export type { MondayFlattenedElement };

export type MasterCatalog = Awaited<ReturnType<typeof loadMasterCatalog>>;

interface CatalogElementIndex {
  element: MasterElement;
  groupName: string;
  exactKey: string;
  matchKey: string;
}

const BOARD_ITEMS_QUERY = `
  query BoardItems($id: ID!, $limit: Int!, $cursor: String) {
    boards(ids: [$id]) {
      items_page(limit: $limit, cursor: $cursor) {
        cursor
        items {
          id
          name
          group { id title }
          subitems {
            id
            name
          }
        }
      }
    }
  }
`;

const FUZZY_MAX_DISTANCE = 2;
const FUZZY_MIN_LENGTH = 6;

export async function loadMasterCatalog(): Promise<{
  groups: MasterGroup[];
  elements: MasterElement[];
  groupByNorm: Map<string, MasterGroup>;
  groupNameById: Map<string, string>;
  elementsByGroupNorm: Map<string, Map<string, MasterElement>>;
  elementIndex: CatalogElementIndex[];
  elementsByExactKey: Map<string, CatalogElementIndex[]>;
  elementsByMatchKey: Map<string, CatalogElementIndex[]>;
  childrenByParentId: Map<string, CatalogElementIndex[]>;
}> {
  const supabase = createActasServerClient();

  const { data: groups, error: gErr } = await supabase
    .from("master_group")
    .select("id, name")
    .order("order_index");
  if (gErr) throw new Error(gErr.message);

  const { data: elements, error: eErr } = await supabase
    .from("master_element")
    .select("id, name, master_group_id, parent_element_id, is_subitem")
    .order("order_index");
  if (eErr) throw new Error(eErr.message);

  const groupByNorm = new Map<string, MasterGroup>();
  const groupNameById = new Map<string, string>();
  for (const g of groups ?? []) {
    groupByNorm.set(normalizeKey(g.name), g);
    groupNameById.set(g.id, g.name);
  }

  const elementsByGroupNorm = new Map<string, Map<string, MasterElement>>();
  const elementIndex: CatalogElementIndex[] = [];
  const elementsByExactKey = new Map<string, CatalogElementIndex[]>();
  const elementsByMatchKey = new Map<string, CatalogElementIndex[]>();
  const childrenByParentId = new Map<string, CatalogElementIndex[]>();

  for (const el of elements ?? []) {
    const groupName = groupNameById.get(el.master_group_id) ?? "";
    const gNorm = normalizeKey(groupName);
    if (!elementsByGroupNorm.has(gNorm)) {
      elementsByGroupNorm.set(gNorm, new Map());
    }
    elementsByGroupNorm.get(gNorm)!.set(normalizeKey(el.name), el);

    const row: CatalogElementIndex = {
      element: el,
      groupName,
      exactKey: normalizeKey(el.name),
      matchKey: normalizeForMatch(el.name),
    };
    elementIndex.push(row);

    for (const map of [elementsByExactKey, elementsByMatchKey] as const) {
      const key = map === elementsByExactKey ? row.exactKey : row.matchKey;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(row);
    }

    if (el.parent_element_id) {
      if (!childrenByParentId.has(el.parent_element_id)) {
        childrenByParentId.set(el.parent_element_id, []);
      }
      childrenByParentId.get(el.parent_element_id)!.push(row);
    }
  }

  return {
    groups: groups ?? [],
    elements: elements ?? [],
    groupByNorm,
    groupNameById,
    elementsByGroupNorm,
    elementIndex,
    elementsByExactKey,
    elementsByMatchKey,
    childrenByParentId,
  };
}

export function matchGroup(
  mondayTitle: string,
  catalog: MasterCatalog,
): Pick<
  GroupMapping,
  "master_group_id" | "master_group_name" | "mapped" | "unmapped" | "match_method"
> {
  const alias = resolveGroupAlias(mondayTitle);
  const keys = [normalizeKey(alias), normalizeKey(mondayTitle)];

  for (const key of keys) {
    const hit = catalog.groupByNorm.get(key);
    if (hit) {
      return {
        master_group_id: hit.id,
        master_group_name: hit.name,
        mapped: true,
        unmapped: false,
        match_method:
          key === normalizeKey(mondayTitle) ? "normalized" : "alias_exact",
      };
    }
  }

  return {
    master_group_id: null,
    master_group_name: null,
    mapped: false,
    unmapped: true,
    match_method: "none",
  };
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const rows = a.length + 1;
  const cols = b.length + 1;
  const matrix: number[][] = Array.from({ length: rows }, () =>
    Array(cols).fill(0),
  );

  for (let i = 0; i < rows; i++) matrix[i]![0] = i;
  for (let j = 0; j < cols; j++) matrix[0]![j] = j;

  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i]![j] = Math.min(
        matrix[i - 1]![j]! + 1,
        matrix[i]![j - 1]! + 1,
        matrix[i - 1]![j - 1]! + cost,
      );
    }
  }

  return matrix[rows - 1]![cols - 1]!;
}

function hitToOutcome(
  row: CatalogElementIndex,
  matchType: ElementMatchType,
  notes: string | null = null,
  matchedViaParent: string | null = null,
): ElementMatchOutcome {
  return {
    master_element_id: row.element.id,
    master_element_name: row.element.name,
    master_group_id: row.element.master_group_id,
    mapped: true,
    unmapped: false,
    match_type: matchType,
    suggested_master_name: null,
    manual_master_element_id: null,
    notes,
    matched_via_parent: matchedViaParent,
  };
}

function unmappedOutcome(
  suggested: string | null = null,
  notes: string | null = null,
): ElementMatchOutcome {
  return {
    master_element_id: null,
    master_element_name: null,
    master_group_id: null,
    mapped: false,
    unmapped: true,
    match_type: null,
    suggested_master_name: suggested,
    manual_master_element_id: null,
    notes,
    matched_via_parent: null,
  };
}

function filterByGroupNorm(
  rows: CatalogElementIndex[],
  groupNorm: string | null,
): CatalogElementIndex[] {
  if (!groupNorm) return rows;
  return rows.filter((r) => normalizeKey(r.groupName) === groupNorm);
}

function findExactInGroup(
  mondayName: string,
  catalog: MasterCatalog,
  groupNorm: string | null,
): ElementMatchOutcome | null {
  if (!groupNorm) return null;
  const key = normalizeKey(mondayName);
  const map = catalog.elementsByGroupNorm.get(groupNorm);
  const el = map?.get(key);
  if (!el) return null;
  const row = catalog.elementIndex.find((r) => r.element.id === el.id);
  return row ? hitToOutcome(row, "exact") : null;
}

function findExactCrossGroup(
  mondayName: string,
  catalog: MasterCatalog,
  groupNorm: string | null,
): ElementMatchOutcome | null {
  const key = normalizeKey(mondayName);
  const hits = catalog.elementsByExactKey.get(key) ?? [];
  if (!hits.length) return null;

  if (groupNorm) {
    const inGroup = hits.filter((r) => normalizeKey(r.groupName) === groupNorm);
    if (inGroup.length) return null;
    const outGroup = hits.filter((r) => normalizeKey(r.groupName) !== groupNorm);
    if (outGroup.length) return hitToOutcome(outGroup[0]!, "cross_group");
    return null;
  }

  if (hits.length) return hitToOutcome(hits[0]!, "cross_group");
  return null;
}

function findManual(
  mondayName: string,
  catalog: MasterCatalog,
): ElementMatchOutcome | null {
  const rule = findManualElementResolution(mondayName);
  if (!rule) return null;

  const row = catalog.elementIndex.find(
    (r) =>
      normalizeKey(r.element.name) === normalizeKey(rule.master_element_name) &&
      normalizeKey(r.groupName) === normalizeKey(rule.master_group_name),
  );
  if (!row) return null;

  return hitToOutcome(row, "manual_resolution", rule.reason);
}

function findNormalized(
  mondayName: string,
  catalog: MasterCatalog,
  groupNorm: string | null,
): ElementMatchOutcome | null {
  const key = normalizeForMatch(mondayName);
  const hits = catalog.elementsByMatchKey.get(key) ?? [];
  const inGroup = filterByGroupNorm(hits, groupNorm);
  if (inGroup.length === 1) return hitToOutcome(inGroup[0]!, "normalized");
  const outGroup = groupNorm
    ? hits.filter((r) => normalizeKey(r.groupName) !== groupNorm)
    : hits;
  if (outGroup.length === 1) return hitToOutcome(outGroup[0]!, "normalized");
  if (hits.length === 1) return hitToOutcome(hits[0]!, "normalized");
  return null;
}

function findInclusion(
  mondayName: string,
  catalog: MasterCatalog,
  groupNorm: string | null,
): ElementMatchOutcome | null {
  const mondayNorm = normalizeForMatch(mondayName);
  if (!mondayNorm) return null;

  const candidates = groupNorm
    ? catalog.elementIndex.filter(
        (r) => normalizeKey(r.groupName) === groupNorm,
      )
    : catalog.elementIndex;

  let best: { row: CatalogElementIndex; len: number } | null = null;

  for (const row of candidates) {
    const catNorm = row.matchKey;
    if (!catNorm || catNorm.length < 3) continue;
    if (!mondayNorm.includes(catNorm)) continue;
    if (!best || catNorm.length > best.len) {
      best = { row, len: catNorm.length };
    }
  }

  if (best) return hitToOutcome(best.row, "inclusion");

  if (groupNorm) {
    return findInclusion(mondayName, catalog, null);
  }

  return null;
}

function findFuzzy(
  mondayName: string,
  catalog: MasterCatalog,
  groupNorm: string | null,
): ElementMatchOutcome | null {
  const mondayNorm = normalizeForMatch(mondayName);
  if (mondayNorm.length < FUZZY_MIN_LENGTH) return null;

  const pool = groupNorm
    ? catalog.elementIndex.filter(
        (r) => normalizeKey(r.groupName) === groupNorm,
      )
    : catalog.elementIndex;

  let best: { row: CatalogElementIndex; dist: number } | null = null;

  for (const row of pool) {
    if (row.matchKey.length < FUZZY_MIN_LENGTH) continue;
    const dist = levenshtein(mondayNorm, row.matchKey);
    if (dist > FUZZY_MAX_DISTANCE) continue;
    if (!best || dist < best.dist) {
      best = { row, dist };
    }
  }

  if (best) return hitToOutcome(best.row, "fuzzy");

  if (groupNorm) {
    return findFuzzy(mondayName, catalog, null);
  }

  return null;
}

function suggestClosestName(
  mondayName: string,
  catalog: MasterCatalog,
): string | null {
  const mondayNorm = normalizeForMatch(mondayName);
  let best: { name: string; dist: number } | null = null;
  for (const row of catalog.elementIndex) {
    const dist = levenshtein(mondayNorm, row.matchKey);
    if (!best || dist < best.dist) {
      best = { name: row.element.name, dist };
    }
  }
  return best && best.dist <= 4 ? best.name : null;
}

/** Resolución de padre: exact → cross_group → manual_resolution (sin parent_context). */
function matchElementShallow(
  mondayName: string,
  groupNorm: string | null,
  catalog: MasterCatalog,
): ElementMatchOutcome {
  const name = resolveElementAlias(mondayName);

  const exactInGroup = findExactInGroup(name, catalog, groupNorm);
  if (exactInGroup) return exactInGroup;

  const cross = findExactCrossGroup(name, catalog, groupNorm);
  if (cross) return cross;

  const manual = findManual(name, catalog);
  if (manual) return manual;

  return unmappedOutcome();
}

function findExactInSubset(
  mondayName: string,
  subset: CatalogElementIndex[],
): ElementMatchOutcome | null {
  const key = normalizeKey(mondayName);
  const hit = subset.find((r) => r.exactKey === key);
  return hit ? hitToOutcome(hit, "exact") : null;
}

function findNormalizedInSubset(
  mondayName: string,
  subset: CatalogElementIndex[],
): ElementMatchOutcome | null {
  const key = normalizeForMatch(mondayName);
  const hits = subset.filter((r) => r.matchKey === key);
  if (hits.length === 1) return hitToOutcome(hits[0]!, "normalized");
  return null;
}

function findInclusionInSubset(
  mondayName: string,
  subset: CatalogElementIndex[],
): ElementMatchOutcome | null {
  const mondayNorm = normalizeForMatch(mondayName);
  if (!mondayNorm) return null;

  let best: { row: CatalogElementIndex; len: number } | null = null;
  for (const row of subset) {
    const catNorm = row.matchKey;
    if (!catNorm || catNorm.length < 3) continue;
    if (!mondayNorm.includes(catNorm)) continue;
    if (!best || catNorm.length > best.len) {
      best = { row, len: catNorm.length };
    }
  }
  return best ? hitToOutcome(best.row, "inclusion") : null;
}

function findFuzzyInSubset(
  mondayName: string,
  subset: CatalogElementIndex[],
): ElementMatchOutcome | null {
  const mondayNorm = normalizeForMatch(mondayName);
  if (mondayNorm.length < FUZZY_MIN_LENGTH) return null;

  let best: { row: CatalogElementIndex; dist: number } | null = null;
  for (const row of subset) {
    if (row.matchKey.length < FUZZY_MIN_LENGTH) continue;
    const dist = levenshtein(mondayNorm, row.matchKey);
    if (dist > FUZZY_MAX_DISTANCE) continue;
    if (!best || dist < best.dist) {
      best = { row, dist };
    }
  }
  return best ? hitToOutcome(best.row, "fuzzy") : null;
}

function matchInChildSubset(
  mondayName: string,
  subset: CatalogElementIndex[],
): ElementMatchOutcome | null {
  const name = resolveElementAlias(mondayName);
  return (
    findExactInSubset(name, subset) ??
    findNormalizedInSubset(name, subset) ??
    findInclusionInSubset(name, subset) ??
    findFuzzyInSubset(name, subset)
  );
}

function findParentContext(
  mondayName: string,
  groupNorm: string | null,
  catalog: MasterCatalog,
  ctx: ElementMatchContext,
): ElementMatchOutcome | null {
  const parentName = ctx.parent_item_name?.trim();
  if (!parentName) return null;

  const manualPc = findManualParentChildResolution(parentName, mondayName);
  if (manualPc) {
    const row = catalog.elementIndex.find(
      (r) =>
        normalizeKey(r.element.name) ===
          normalizeKey(manualPc.master_element_name) &&
        normalizeKey(r.groupName) === normalizeKey(manualPc.master_group_name),
    );
    if (row) {
      return hitToOutcome(
        row,
        "parent_context",
        manualPc.reason,
        parentName,
      );
    }
  }

  const parentGroupTitle = ctx.parent_monday_group?.trim() ?? "";
  const parentGroupMatch = parentGroupTitle
    ? matchGroup(parentGroupTitle, catalog)
    : null;
  const parentGroupNorm = parentGroupMatch.master_group_name
    ? normalizeKey(parentGroupMatch.master_group_name)
    : groupNorm;

  const parentMatch = matchElementShallow(
    parentName,
    parentGroupNorm,
    catalog,
  );
  if (!parentMatch.mapped || !parentMatch.master_element_id) return null;

  const children =
    catalog.childrenByParentId.get(parentMatch.master_element_id) ?? [];
  if (!children.length) return null;

  const childHit = matchInChildSubset(mondayName, children);
  if (!childHit) return null;

  return {
    ...childHit,
    match_type: "parent_context",
    matched_via_parent: parentMatch.master_element_name,
    notes: childHit.notes,
  };
}

/**
 * Cascada: exact → cross_group → parent_context → manual_resolution → normalized → inclusion → fuzzy.
 */
export function matchElement(
  mondayName: string,
  groupNorm: string | null,
  catalog: MasterCatalog,
  ctx: ElementMatchContext = {},
): ElementMatchOutcome {
  const name = resolveElementAlias(mondayName);

  const exactInGroup = findExactInGroup(name, catalog, groupNorm);
  if (exactInGroup) return exactInGroup;

  const cross = findExactCrossGroup(name, catalog, groupNorm);
  if (cross) return cross;

  const parentCtx = findParentContext(name, groupNorm, catalog, ctx);
  if (parentCtx) return parentCtx;

  const manual = findManual(name, catalog);
  if (manual) return manual;

  const normalized = findNormalized(name, catalog, groupNorm);
  if (normalized) return normalized;

  const inclusion = findInclusion(name, catalog, groupNorm);
  if (inclusion) return inclusion;

  const fuzzy = findFuzzy(name, catalog, groupNorm);
  if (fuzzy) return fuzzy;

  return unmappedOutcome(
    suggestClosestName(name, catalog),
    "Sin coincidencia en cascada del matcher",
  );
}

export function countByMatchType(
  elements: { match_type: ElementMatchType | null; mapped: boolean }[],
): Record<ElementMatchType | "unmapped", number> {
  const counts: Record<ElementMatchType | "unmapped", number> = {
    exact: 0,
    cross_group: 0,
    parent_context: 0,
    manual_resolution: 0,
    normalized: 0,
    inclusion: 0,
    fuzzy: 0,
    unmapped: 0,
  };

  for (const e of elements) {
    if (!e.mapped || !e.match_type) {
      counts.unmapped += 1;
    } else {
      counts[e.match_type] += 1;
    }
  }

  return counts;
}

type FrequencyBucket = "criticos" | "frecuentes" | "ocasionales" | "marginales";

function frequencyBucket(
  appearanceCount: number,
): FrequencyBucket {
  if (appearanceCount >= 50) return "criticos";
  if (appearanceCount >= 10) return "frecuentes";
  if (appearanceCount >= 3) return "ocasionales";
  return "marginales";
}

const BUCKET_LABELS: Record<FrequencyBucket, string> = {
  criticos: "Críticos (≥50 tableros)",
  frecuentes: "Frecuentes (10–49)",
  ocasionales: "Ocasionales (3–9)",
  marginales: "Marginales (1–2)",
};

export function writeUnmappedSummaryMd(
  unmapped: UniqueElementMapping[],
  workspaceId: string,
  matchTypeCounts?: Record<ElementMatchType | "unmapped", number>,
  unmappedBuckets?: Record<FrequencyBucket, number>,
): void {
  const byBucket: Record<FrequencyBucket, UniqueElementMapping[]> = {
    criticos: [],
    frecuentes: [],
    ocasionales: [],
    marginales: [],
  };

  for (const e of unmapped) {
    byBucket[frequencyBucket(e.appearance_count)].push(e);
  }

  for (const key of Object.keys(byBucket) as FrequencyBucket[]) {
    byBucket[key].sort((a, b) => b.appearance_count - a.appearance_count);
  }

  const lines = [
    "# Elementos Monday sin mapeo al catálogo",
    "",
    `**Generado:** ${new Date().toISOString().slice(0, 10)}`,
    `**Workspace:** \`${workspaceId}\``,
    `**Total sin mapear:** ${unmapped.length}`,
    "",
  ];

  if (matchTypeCounts) {
    lines.push("## Resumen matcher (elementos únicos)", "", "| match_type | Cantidad |", "|------------|----------:|");
    for (const t of [
      "exact",
      "cross_group",
      "parent_context",
      "manual_resolution",
      "normalized",
      "inclusion",
      "fuzzy",
      "unmapped",
    ] as const) {
      lines.push(`| ${t} | ${matchTypeCounts[t] ?? 0} |`);
    }
    lines.push("");
  }

  if (unmappedBuckets) {
    lines.push(
      "## Unmapped por bucket",
      "",
      "| Bucket | Cantidad |",
      "|--------|----------:|",
      `| Críticos (≥50 tableros) | ${unmappedBuckets.criticos} |`,
      `| Frecuentes (10–49) | ${unmappedBuckets.frecuentes} |`,
      `| Ocasionales (3–9) | ${unmappedBuckets.ocasionales} |`,
      `| Marginales (1–2) | ${unmappedBuckets.marginales} |`,
      "",
    );
  }

  lines.push("## Buckets por frecuencia (tableros distintos)", "");

  for (const bucket of [
    "criticos",
    "frecuentes",
    "ocasionales",
    "marginales",
  ] as FrequencyBucket[]) {
    const items = byBucket[bucket];
    lines.push(`### ${BUCKET_LABELS[bucket]} — ${items.length} elementos`, "");
    if (!items.length) {
      lines.push("_Ninguno._", "");
      continue;
    }
    lines.push(
      "| Elemento | Tableros | Proyectos | Grupo Monday | Padre (item) | Grupo padre | Propuesta master_group | Sugerencia |",
      "|----------|----------:|-----------|--------------|--------------|-------------|------------------------|------------|",
    );
    for (const e of items) {
      const projects =
        e.project_codes.length > 5
          ? `${e.project_codes.slice(0, 5).join(", ")} (+${e.project_codes.length - 5})`
          : e.project_codes.join(", ") || "—";
      const name = e.monday_name.replace(/\|/g, "\\|");
      const parent = (e.parent_item_name ?? "—").replace(/\|/g, "\\|");
      const parentGroup = (e.parent_monday_group ?? "—").replace(/\|/g, "\\|");
      lines.push(
        `| ${name} | ${e.appearance_count} | ${projects.replace(/\|/g, "\\|")} | ${(e.sample_monday_group || "—").replace(/\|/g, "\\|")} | ${parent} | ${parentGroup} | ${(e.proposed_master_group ?? "—").replace(/\|/g, "\\|")} | ${(e.suggested_master_name ?? "—").replace(/\|/g, "\\|")} |`,
      );
    }
    lines.push("");
  }

  writeFileSync(UNMAPPED_SUMMARY_OUTPUT, `${lines.join("\n")}\n`, "utf8");
}

async function fetchMondayRawItems(boardId: string): Promise<MondayRawItem[]> {
  const items: MondayRawItem[] = [];
  let cursor: string | null = null;

  for (;;) {
    const data = await mondayQuery<{
      boards: {
        items_page: {
          cursor: string | null;
          items: {
            id: string;
            name: string;
            group: { title: string } | null;
            subitems: { id: string; name: string }[] | null;
          }[];
        };
      }[];
    }>(
      BOARD_ITEMS_QUERY,
      { id: boardId, limit: 100, cursor },
      { timeoutMs: 90_000 },
    );

    const page = data.boards?.[0]?.items_page;
    for (const item of page?.items ?? []) {
      items.push({
        id: item.id,
        name: item.name,
        groupTitle: item.group?.title?.trim() ?? "",
        subitems: item.subitems ?? [],
      });
    }
    cursor = page?.cursor ?? null;
    if (!cursor) break;
  }

  return items;
}

/** Ítems + subitems con `parent_item_name` / `parent_monday_group` en subitems. */
export async function fetchBoardFlattenedElements(
  boardId: string,
): Promise<MondayFlattenedElement[]> {
  const raw = await fetchMondayRawItems(boardId);
  return flattenMondayItemsWithParentContext(raw);
}

/** @deprecated Usar fetchBoardFlattenedElements */
export async function fetchBoardItemsWithSubitems(
  boardId: string,
): Promise<MondayRawItem[]> {
  return fetchMondayRawItems(boardId);
}

export function pickDominantGroup(groupCounts: Map<string, number>): string {
  let best = "";
  let max = 0;
  for (const [g, n] of groupCounts) {
    if (n > max) {
      max = n;
      best = g;
    }
  }
  return best;
}

export interface DominantParentContext {
  parent_item_name: string | null;
  parent_monday_group: string | null;
}

export function pickDominantParent(
  parentCounts: Map<string, { count: number; parent_item_name: string; parent_monday_group: string }>,
): DominantParentContext {
  let best: DominantParentContext = {
    parent_item_name: null,
    parent_monday_group: null,
  };
  let max = 0;
  for (const entry of parentCounts.values()) {
    if (entry.count > max) {
      max = entry.count;
      best = {
        parent_item_name: entry.parent_item_name,
        parent_monday_group: entry.parent_monday_group,
      };
    }
  }
  return best;
}

export function frequencyBucketLabel(
  appearanceCount: number,
): FrequencyBucket {
  return frequencyBucket(appearanceCount);
}

export function bucketUnmappedCounts(
  unmapped: UniqueElementMapping[],
): Record<FrequencyBucket, number> {
  const counts: Record<FrequencyBucket, number> = {
    criticos: 0,
    frecuentes: 0,
    ocasionales: 0,
    marginales: 0,
  };
  for (const e of unmapped) {
    counts[frequencyBucket(e.appearance_count)] += 1;
  }
  return counts;
}

/** Snapshot persistido de `monday-map-elements-all` (re-mapeable sin re-escanear Monday). */
export interface ElementMappingCachePayload {
  generated_at: string;
  description: string;
  scope: string;
  workspace_id: string;
  boards_total: number;
  boards_scanned: number;
  unique_element_names: number;
  unique_monday_groups: number;
  remapped_from_cache?: boolean;
  cache_source_generated_at?: string;
  groups: GroupMapping[];
  elements_unique: UniqueElementMapping[];
  unmapped_groups: GroupMapping[];
  unmapped_elements: UniqueElementMapping[];
  summary: {
    groups_total: number;
    groups_mapped: number;
    groups_unmapped: number;
    elements_unique_total: number;
    elements_mapped: number;
    elements_unmapped: number;
    total_occurrences: number;
    match_type_counts: Record<ElementMatchType | "unmapped", number>;
    unmapped_by_bucket: Record<FrequencyBucket, number>;
  };
}

export function loadElementMappingCache(
  path: string = ELEMENT_MAPPING_OUTPUT,
): ElementMappingCachePayload {
  const raw = readFileSync(path, "utf8");
  const data = JSON.parse(raw) as ElementMappingCachePayload;
  if (!Array.isArray(data.elements_unique) || data.elements_unique.length === 0) {
    throw new Error(
      `${path} no contiene elements_unique; ejecuta primero actas:monday-map-elements-all sin --from-cache`,
    );
  }
  if (!Array.isArray(data.groups)) {
    throw new Error(`${path} no contiene groups`);
  }
  return data;
}

export function remapGroupFromCache(
  cached: GroupMapping,
  catalog: MasterCatalog,
): GroupMapping {
  const m = matchGroup(cached.monday_title, catalog);
  return {
    ...cached,
    ...m,
    notes: m.unmapped
      ? "Añadir alias en scripts/actas/lib/normalize.ts o manual_master_group_id"
      : null,
  };
}

export function remapUniqueElementFromCache(
  cached: UniqueElementMapping,
  catalog: MasterCatalog,
  groupNormByTitle: Map<string, string | null>,
): UniqueElementMapping {
  const sampleGroup =
    cached.sample_monday_group?.trim() ||
    cached.monday_groups_seen[0]?.trim() ||
    "";
  const groupNorm =
    groupNormByTitle.get(sampleGroup) ??
    (() => {
      const gm = matchGroup(sampleGroup, catalog);
      return gm.master_group_name
        ? normalizeKey(gm.master_group_name)
        : null;
    })();

  const m = matchElement(cached.monday_name, groupNorm, catalog, {
    parent_item_name: cached.parent_item_name,
    parent_monday_group: cached.parent_monday_group,
  });
  const groupMatch = matchGroup(sampleGroup, catalog);

  return {
    ...cached,
    monday_name_normalized: normalizeKey(cached.monday_name),
    ...m,
    manual_master_element_id: null,
    notes: m.unmapped
      ? m.suggested_master_name
        ? `Sugerencia catálogo: «${m.suggested_master_name}»`
        : "Sin coincidencia automática en master_element"
      : null,
    proposed_master_group: groupMatch.master_group_name,
    proposed_master_group_id: groupMatch.master_group_id,
  };
}

export function buildGroupNormByTitle(
  groupMappings: GroupMapping[],
): Map<string, string | null> {
  const map = new Map<string, string | null>();
  for (const gm of groupMappings) {
    map.set(
      gm.monday_title,
      gm.master_group_name ? normalizeKey(gm.master_group_name) : null,
    );
  }
  return map;
}
