import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  buildElementsUniqueIndex,
  isMondaySubitemsGroup,
  lookupElementMapping,
  resolveCategoryFromMondayGroup,
  resolveElementFromMapping,
  type GroupMappingFrom07,
  type ResolvedCategory,
  type UniqueElementMapping,
} from "./migration-resolve";
import {
  type MondayExtractBoard,
  type MondayExtractColumnValue,
  type MondayExtractPayload,
  type MondayExtractUpdate,
} from "./monday-extract";
import { isOwnerColumn, normalizeKey } from "./normalize";

/** Mínimo de ítems raíz para considerar un snapshot completo (alineado con diagnose). */
export const COMPLETE_SNAPSHOT_MIN_ROOT_ITEMS = 6;

const OPTIONAL_MODULE_GROUP_NAMES = new Set([
  "DESINVERSIÓN",
  "OPERADOR HOTELERO",
  "SITUACIÓN INQUILINOS",
  "ACTIVO ACCESORIO VINCULADO",
]);

const MONDAY_STATUS_TO_DB: Record<string, string> = {
  "working on it": "working_on_it",
  done: "done",
  stuck: "stuck",
  "not started": "not_started",
};

export const MONDAY_TRANSFORMED_DIR = resolve(
  process.cwd(),
  "tmp/monday-transformed",
);

export type ElementStatus =
  | "not_started"
  | "working_on_it"
  | "stuck"
  | "done";

export interface TransformedProject {
  code: string;
  name: string;
}

export interface TransformedCategory {
  id: string;
  master_group_id: string | null;
  name: string;
  sublot_label: string | null;
  order_index: number;
  monday_group_title: string;
}

export interface TransformedElement {
  id: string;
  category_id: string;
  master_element_id: string | null;
  name: string;
  parent_element_id: string | null;
  order_index: number;
  monday_item_name: string;
  status: ElementStatus;
  timeline_start: string | null;
  timeline_end: string | null;
}

export interface TransformedElementOwner {
  element_id: string;
  user_id: string | null;
  monday_user_id: string | null;
}

export interface TransformedLogEntry {
  id: string;
  element_id: string;
  author_id: string | null;
  content: string;
  status_before: string | null;
  status_after: string | null;
  entry_date: string;
  source: "snapshot" | "monday_update";
  monday_update_id?: string;
}

export interface TransformedModuleToActivate {
  master_module_id: string | null;
  master_module_name: string;
}

export type BoardDiscardReason =
  | "unparsed"
  | "duplicado_de"
  | "subelementos"
  | "stub";

export interface TransformStats {
  snapshots_processed: number;
  snapshots_discarded_stubs: number;
  snapshots_discarded_duplicado: number;
  snapshots_discarded_subelementos: number;
  snapshots_discarded_unparsed: number;
  /** Días (`snapshot_date_iso`) con más de un tablero canónico procesado. */
  snapshots_same_day_count: number;
  elements_total: number;
  elements_mapped: number;
  elements_custom: number;
  log_entries_total: number;
  log_entries_by_source: { snapshot: number; monday_update: number };
}

export interface MondayTransformedPayload {
  project: TransformedProject;
  categories: TransformedCategory[];
  elements: TransformedElement[];
  element_owners: TransformedElementOwner[];
  log_entries: TransformedLogEntry[];
  modules_to_activate: TransformedModuleToActivate[];
  transform_stats: TransformStats;
}

interface SnapshotObservation {
  snapshot_date_iso: string;
  /** Timestamp del board (`updated_at`) para ordenar y `entry_date` con resolución temporal. */
  observation_at: string;
  texto: string;
  status: ElementStatus;
  owner_monday_id: string | null;
  timeline_start: string | null;
  timeline_end: string | null;
}

interface ElementAccumulator {
  id: string;
  category_id: string;
  master_element_id: string | null;
  name: string;
  monday_item_name: string;
  parent_element_id: string | null;
  order_index: number;
  observations: SnapshotObservation[];
  latest: SnapshotObservation | null;
}

interface CategoryAccumulator {
  id: string;
  master_group_id: string | null;
  name: string;
  sublot_label: string | null;
  monday_group_title: string;
  order_index: number;
}

interface UserMappingFile {
  mappings: Record<string, string | null>;
}

interface ElementMappingFile {
  groups: GroupMappingFrom07[];
  elements_unique: UniqueElementMapping[];
}

function isDuplicadoBoard(name: string): boolean {
  return /^Duplicado de\s+/i.test(name.trim());
}

function isSubelementosBoard(kind: string): boolean {
  return kind === "subelementos" || kind === "subitems";
}

function normalizeBoardTitle(title: string): string {
  return title.replace(/\s+/g, " ").trim();
}

function isExactCanonicalSnapshotTitle(
  boardName: string,
  projectCode: string,
  snapshotDateDisplay: string | null,
): boolean {
  if (!snapshotDateDisplay) return false;
  const expected = normalizeBoardTitle(`${projectCode} - ${snapshotDateDisplay}`);
  const actual = normalizeBoardTitle(boardName);
  return (
    actual === expected || normalizeKey(actual) === normalizeKey(expected)
  );
}

export function countBoardRootItems(board: MondayExtractBoard): number {
  let root_items = 0;
  for (const group of board.groups) {
    root_items += group.items.length;
  }
  return root_items;
}

export interface CanonicalBoardSelection {
  canonical: MondayExtractBoard[];
  stats: Pick<
    TransformStats,
    | "snapshots_discarded_stubs"
    | "snapshots_discarded_duplicado"
    | "snapshots_discarded_subelementos"
    | "snapshots_discarded_unparsed"
    | "snapshots_same_day_count"
  >;
}

function logBoardDiscard(
  board: MondayExtractBoard,
  reason: BoardDiscardReason,
  enabled: boolean,
): void {
  if (!enabled) return;
  console.log(
    `  [discard:${reason}] id=${board.id} title=${JSON.stringify(board.name)} iso=${board.parsed.snapshot_date_iso ?? "—"}`,
  );
}

/** Orden cronológico de procesamiento (más antiguo primero). */
export function compareBoardsChronologically(
  a: MondayExtractBoard,
  b: MondayExtractBoard,
): number {
  const ta = a.updated_at;
  const tb = b.updated_at;
  if (ta && tb) {
    const cmp = ta.localeCompare(tb);
    if (cmp !== 0) return cmp;
  } else if (ta) return -1;
  else if (tb) return 1;

  return a.id.localeCompare(b.id, undefined, { numeric: true });
}

function canonicalTitleGroupKey(board: MondayExtractBoard): string {
  const iso = board.parsed.snapshot_date_iso ?? "";
  return `${iso}|${normalizeKey(board.name)}`;
}

/**
 * Selecciona tableros canónicos: título exacto `<CODE> - DD/MM/YYYY`, ≥6 ítems raíz.
 * Por cada (`snapshot_date_iso`, título) procesa **todos** los tableros del grupo,
 * ordenados por `updated_at` ascendente (desempate `id`).
 */
export function selectCanonicalBoards(
  boards: readonly MondayExtractBoard[],
  projectCode: string,
  options?: { logDiscards?: boolean },
): CanonicalBoardSelection {
  const logDiscards = options?.logDiscards !== false;
  const code = projectCode.trim().toUpperCase();
  let snapshots_discarded_stubs = 0;
  let snapshots_discarded_duplicado = 0;
  let snapshots_discarded_subelementos = 0;
  let snapshots_discarded_unparsed = 0;
  let snapshots_same_day_count = 0;

  const byIso = new Map<string, MondayExtractBoard[]>();

  if (logDiscards) console.log("\n## Boards descartados\n");

  for (const board of boards) {
    const iso = board.parsed.snapshot_date_iso;
    if (!iso) {
      snapshots_discarded_unparsed += 1;
      logBoardDiscard(board, "unparsed", logDiscards);
      continue;
    }

    if (isDuplicadoBoard(board.name)) {
      snapshots_discarded_duplicado += 1;
      logBoardDiscard(board, "duplicado_de", logDiscards);
      continue;
    }

    if (isSubelementosBoard(board.parsed.kind)) {
      snapshots_discarded_subelementos += 1;
      logBoardDiscard(board, "subelementos", logDiscards);
      continue;
    }

    if (board.parsed.kind !== "snapshot") continue;

    const rootItems = countBoardRootItems(board);
    if (rootItems < COMPLETE_SNAPSHOT_MIN_ROOT_ITEMS) {
      snapshots_discarded_stubs += 1;
      logBoardDiscard(board, "stub", logDiscards);
      continue;
    }

    if (
      board.parsed.project_code?.toUpperCase() !== code &&
      !board.name.toUpperCase().startsWith(`${code} -`)
    ) {
      continue;
    }

    const list = byIso.get(iso) ?? [];
    list.push(board);
    byIso.set(iso, list);
  }

  const canonical: MondayExtractBoard[] = [];

  for (const iso of [...byIso.keys()].sort()) {
    const candidates = byIso.get(iso)!;
    const exact = candidates.filter((b) =>
      isExactCanonicalSnapshotTitle(
        b.name,
        code,
        b.parsed.snapshot_date,
      ),
    );

    if (!exact.length) continue;

    const byTitle = new Map<string, MondayExtractBoard[]>();
    for (const board of exact) {
      const key = canonicalTitleGroupKey(board);
      const list = byTitle.get(key) ?? [];
      list.push(board);
      byTitle.set(key, list);
    }

    let boardsThisDay = 0;
    for (const group of byTitle.values()) {
      group.sort(compareBoardsChronologically);
      boardsThisDay += group.length;
      canonical.push(...group);
    }

    if (boardsThisDay > 1) snapshots_same_day_count += 1;
  }

  canonical.sort((a, b) => {
    const isoCmp = (a.parsed.snapshot_date_iso ?? "").localeCompare(
      b.parsed.snapshot_date_iso ?? "",
    );
    if (isoCmp !== 0) return isoCmp;
    return compareBoardsChronologically(a, b);
  });

  return {
    canonical,
    stats: {
      snapshots_discarded_stubs,
      snapshots_discarded_duplicado,
      snapshots_discarded_subelementos,
      snapshots_discarded_unparsed,
      snapshots_same_day_count,
    },
  };
}

function extractSublotLabel(mondayGroupTitle: string): string | null {
  const t = mondayGroupTitle.trim();
  const pc25 = t.match(/\bPC\d+\s*-\s*(.+)$/i);
  if (pc25) return pc25[1]!.trim();
  const suffix = t.match(/\s+-\s+(EAST|WEST|VILLAGE)\s*$/i);
  if (suffix) return suffix[1]!.trim();
  return null;
}

/** Identidad canónica de categoría (alias de grupo Monday → mismo master_group). */
function categoryKey(
  resolved: ResolvedCategory,
  sublotLabel: string | null,
): string {
  const idPart =
    resolved.master_group_id ?? `unmapped:${normalizeKey(resolved.name)}`;
  return `${idPart}|${sublotLabel ?? ""}`;
}

function rootElementKey(categoryId: string, mondayItemName: string): string {
  return `root|${categoryId}|${normalizeKey(mondayItemName)}`;
}

function subElementKey(
  categoryId: string,
  parentMondayName: string,
  subitemName: string,
): string {
  return `sub|${categoryId}|${normalizeKey(parentMondayName)}|${normalizeKey(subitemName)}`;
}

function normalizeTexto(text: string | null | undefined): string {
  return (text ?? "").trim();
}

function parseMondayStatus(text: string | null): ElementStatus {
  if (!text?.trim()) return "not_started";
  const mapped = MONDAY_STATUS_TO_DB[normalizeKey(text)];
  return (mapped as ElementStatus | undefined) ?? "not_started";
}

function findColumn(
  columnValues: MondayExtractColumnValue[],
  predicate: (cv: MondayExtractColumnValue) => boolean,
): MondayExtractColumnValue | undefined {
  return columnValues.find(predicate);
}

function parseOwnerMondayId(
  columnValues: MondayExtractColumnValue[],
): string | null {
  const col = findColumn(columnValues, (cv) =>
    isOwnerColumn(cv.column_title, cv.column_type),
  );
  if (!col?.value) return null;
  try {
    const parsed = JSON.parse(col.value) as {
      personsAndTeams?: { id: string | number; kind?: string }[];
    };
    const person = parsed.personsAndTeams?.find((p) => p.kind === "person");
    const id = person?.id ?? parsed.personsAndTeams?.[0]?.id;
    return id != null ? String(id) : null;
  } catch {
    return null;
  }
}

function parseTexto(columnValues: MondayExtractColumnValue[]): string {
  const col =
    findColumn(
      columnValues,
      (cv) => normalizeKey(cv.column_title) === "texto",
    ) ??
    findColumn(
      columnValues,
      (cv) => cv.column_type === "long_text",
    );
  if (!col) return "";
  if (col.text?.trim()) return col.text.trim();
  if (!col.value) return "";
  try {
    const parsed = JSON.parse(col.value) as { text?: string };
    return normalizeTexto(parsed.text);
  } catch {
    return normalizeTexto(col.text);
  }
}

function parseStatusColumn(
  columnValues: MondayExtractColumnValue[],
): ElementStatus {
  const col = findColumn(
    columnValues,
    (cv) =>
      cv.column_type === "status" &&
      normalizeKey(cv.column_title) === "status",
  );
  return parseMondayStatus(col?.text ?? null);
}

function parseTimeline(
  columnValues: MondayExtractColumnValue[],
): { timeline_start: string | null; timeline_end: string | null } {
  const col = findColumn(
    columnValues,
    (cv) =>
      cv.column_type === "timeline" &&
      normalizeKey(cv.column_title) === "timeline",
  );
  if (!col?.value) {
    return { timeline_start: null, timeline_end: null };
  }
  try {
    const v = JSON.parse(col.value) as { from?: string; to?: string };
    const start = v.from?.slice(0, 10) ?? null;
    const end = v.to?.slice(0, 10) ?? null;
    return { timeline_start: start, timeline_end: end };
  } catch {
    return { timeline_start: null, timeline_end: null };
  }
}

function boardObservationTimestamp(board: MondayExtractBoard): string {
  if (board.updated_at?.trim()) return board.updated_at.trim();
  const iso = board.parsed.snapshot_date_iso;
  return iso ? `${iso}T00:00:00.000Z` : new Date(0).toISOString();
}

function observationFromRow(
  board: MondayExtractBoard,
  columnValues: MondayExtractColumnValue[],
): SnapshotObservation {
  const { timeline_start, timeline_end } = parseTimeline(columnValues);
  return {
    snapshot_date_iso: board.parsed.snapshot_date_iso!,
    observation_at: boardObservationTimestamp(board),
    texto: parseTexto(columnValues),
    status: parseStatusColumn(columnValues),
    owner_monday_id: parseOwnerMondayId(columnValues),
    timeline_start,
    timeline_end,
  };
}

function resolveAuthorId(
  mondayUserId: string | null,
  userMappings: Record<string, string | null>,
): string | null {
  if (!mondayUserId) return null;
  return userMappings[mondayUserId] ?? null;
}

function buildLogEntriesFromObservations(
  elementId: string,
  observations: SnapshotObservation[],
  userMappings: Record<string, string | null>,
): TransformedLogEntry[] {
  const sorted = [...observations].sort((a, b) =>
    a.observation_at.localeCompare(b.observation_at),
  );
  const entries: TransformedLogEntry[] = [];
  let prevText: string | null = null;
  let prevStatus: ElementStatus | null = null;

  for (let i = 0; i < sorted.length; i++) {
    const obs = sorted[i]!;
    const text = obs.texto;
    const status = obs.status;

    if (i === 0) {
      if (text) {
        entries.push({
          id: randomUUID(),
          element_id: elementId,
          author_id: resolveAuthorId(obs.owner_monday_id, userMappings),
          content: text,
          status_before: null,
          status_after: null,
          entry_date: obs.observation_at,
          source: "snapshot",
        });
      }
      prevText = text;
      prevStatus = status;
      continue;
    }

    if (text !== prevText) {
      const statusChanged = status !== prevStatus;
      entries.push({
        id: randomUUID(),
        element_id: elementId,
        author_id: resolveAuthorId(obs.owner_monday_id, userMappings),
        content: text,
        status_before: statusChanged ? prevStatus : null,
        status_after: statusChanged ? status : null,
        entry_date: obs.observation_at,
        source: "snapshot",
      });
      prevText = text;
      prevStatus = status;
    }
  }

  return entries;
}

function updateContent(update: MondayExtractUpdate): string {
  return normalizeTexto(update.text_body ?? update.body);
}

function buildLogEntriesFromUpdates(
  elementId: string,
  updates: MondayExtractUpdate[],
  userMappings: Record<string, string | null>,
): TransformedLogEntry[] {
  const entries: TransformedLogEntry[] = [];
  const sorted = [...updates].sort((a, b) => {
    const da = a.created_at ?? "";
    const db = b.created_at ?? "";
    return da.localeCompare(db);
  });

  for (const update of sorted) {
    const content = updateContent(update);
    if (!content) continue;
    const entryDate = (update.created_at ?? update.updated_at ?? "").slice(
      0,
      10,
    );
    if (!entryDate) continue;

    entries.push({
      id: randomUUID(),
      element_id: elementId,
      author_id: resolveAuthorId(
        update.creator_id ? String(update.creator_id) : null,
        userMappings,
      ),
      content,
      status_before: null,
      status_after: null,
      entry_date: entryDate,
      source: "monday_update",
      monday_update_id: update.id,
    });
  }

  return entries;
}

export async function loadMasterModuleIds(
  supabase: SupabaseClient | null,
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (!supabase) return map;

  const { data, error } = await supabase
    .from("master_module")
    .select("id, name");
  if (error) {
    console.warn(`master_module: ${error.message} (modules sin UUID)`);
    return map;
  }
  for (const row of data ?? []) {
    map.set(String(row.name).trim().toUpperCase(), row.id as string);
  }
  return map;
}

function collectOptionalModules(
  seenGroupTitles: Set<string>,
  groupMappings: readonly GroupMappingFrom07[],
  moduleIdsByName: Map<string, string>,
): TransformedModuleToActivate[] {
  const out: TransformedModuleToActivate[] = [];
  const added = new Set<string>();

  for (const title of seenGroupTitles) {
    const resolved = resolveCategoryFromMondayGroup(title, groupMappings);
    const canonicalName = (
      resolved.master_group_id ? resolved.name : title.trim()
    ).toUpperCase();

    if (!OPTIONAL_MODULE_GROUP_NAMES.has(canonicalName) || added.has(canonicalName)) {
      continue;
    }

    added.add(canonicalName);
    out.push({
      master_module_id: moduleIdsByName.get(canonicalName) ?? null,
      master_module_name: canonicalName,
    });
  }

  out.sort((a, b) => a.master_module_name.localeCompare(b.master_module_name));
  return out;
}

export interface TransformMondayExtractOptions {
  userMappings: Record<string, string | null>;
  groupMappings: GroupMappingFrom07[];
  elementsUnique: UniqueElementMapping[];
  masterModuleIdsByName?: Map<string, string>;
}

export function transformMondayExtract(
  extract: MondayExtractPayload,
  options: TransformMondayExtractOptions,
): MondayTransformedPayload {
  const projectCode = extract.project_code.trim().toUpperCase();
  const elementsIndex = buildElementsUniqueIndex(options.elementsUnique);

  const { canonical, stats: discardStats } = selectCanonicalBoards(
    extract.boards,
    projectCode,
  );

  const categories = new Map<string, CategoryAccumulator>();
  const elements = new Map<string, ElementAccumulator>();
  const seenGroupTitles = new Set<string>();
  let categoryOrder = 0;
  const elementOrderByCategory = new Map<string, number>();
  const seenUpdateIds = new Set<string>();
  const updatesByElementKey = new Map<string, MondayExtractUpdate[]>();

  function getOrCreateCategory(mondayGroupTitle: string): CategoryAccumulator {
    const sublot = extractSublotLabel(mondayGroupTitle);
    const resolved = resolveCategoryFromMondayGroup(
      mondayGroupTitle,
      options.groupMappings,
    );
    const key = categoryKey(resolved, sublot);
    let cat = categories.get(key);
    if (cat) return cat;
    cat = {
      id: randomUUID(),
      master_group_id: resolved.master_group_id,
      name: resolved.name,
      sublot_label: sublot,
      monday_group_title: mondayGroupTitle.trim(),
      order_index: categoryOrder++,
    };
    categories.set(key, cat);
    seenGroupTitles.add(mondayGroupTitle.trim());
    return cat;
  }

  function nextElementOrder(categoryId: string): number {
    const n = elementOrderByCategory.get(categoryId) ?? 0;
    elementOrderByCategory.set(categoryId, n + 1);
    return n;
  }

  function getOrCreateRootElement(
    cat: CategoryAccumulator,
    mondayItemName: string,
  ): ElementAccumulator {
    const key = rootElementKey(cat.id, mondayItemName);
    let el = elements.get(key);
    if (el) return el;

    const mapping = lookupElementMapping(mondayItemName, elementsIndex);
    const resolved = resolveElementFromMapping(mondayItemName, mapping);

    el = {
      id: randomUUID(),
      category_id: cat.id,
      master_element_id: resolved.master_element_id,
      name: resolved.name,
      monday_item_name: mondayItemName.trim(),
      parent_element_id: null,
      order_index: nextElementOrder(cat.id),
      observations: [],
      latest: null,
    };
    elements.set(key, el);
    return el;
  }

  function getOrCreateSubElement(
    cat: CategoryAccumulator,
    parent: ElementAccumulator,
    subitemName: string,
  ): ElementAccumulator {
    const key = subElementKey(cat.id, parent.monday_item_name, subitemName);
    let el = elements.get(key);
    if (el) return el;

    const mapping = lookupElementMapping(subitemName, elementsIndex);
    const resolved = resolveElementFromMapping(subitemName, mapping);

    el = {
      id: randomUUID(),
      category_id: cat.id,
      master_element_id: resolved.master_element_id,
      name: resolved.name,
      monday_item_name: subitemName.trim(),
      parent_element_id: parent.id,
      order_index: nextElementOrder(cat.id),
      observations: [],
      latest: null,
    };
    elements.set(key, el);
    return el;
  }

  function recordObservation(
    el: ElementAccumulator,
    obs: SnapshotObservation,
  ): void {
    el.observations.push(obs);
    if (!el.latest || obs.observation_at >= el.latest.observation_at) {
      el.latest = obs;
    }
  }

  function collectUpdates(
    elementKey: string,
    updates: MondayExtractUpdate[],
  ): void {
    const list = updatesByElementKey.get(elementKey) ?? [];
    for (const u of updates) {
      if (seenUpdateIds.has(u.id)) continue;
      seenUpdateIds.add(u.id);
      list.push(u);
    }
    updatesByElementKey.set(elementKey, list);
  }

  for (const board of canonical) {
    for (const group of board.groups) {
      if (isMondaySubitemsGroup(group.title)) continue;

      const cat = getOrCreateCategory(group.title);

      for (const item of group.items) {
        const rootEl = getOrCreateRootElement(cat, item.name);
        recordObservation(
          rootEl,
          observationFromRow(board, item.column_values),
        );
        collectUpdates(rootElementKey(cat.id, item.name), item.updates);

        for (const sub of item.subitems) {
          const subEl = getOrCreateSubElement(cat, rootEl, sub.name);
          recordObservation(
            subEl,
            observationFromRow(board, sub.column_values),
          );
          collectUpdates(
            subElementKey(cat.id, item.name, sub.name),
            sub.updates,
          );
        }
      }
    }
  }

  const log_entries: TransformedLogEntry[] = [];
  let logSnapshot = 0;
  let logMondayUpdate = 0;

  for (const [key, el] of elements) {
    const snapshotEntries = buildLogEntriesFromObservations(
      el.id,
      el.observations,
      options.userMappings,
    );
    logSnapshot += snapshotEntries.length;
    log_entries.push(...snapshotEntries);

    const updateEntries = buildLogEntriesFromUpdates(
      el.id,
      updatesByElementKey.get(key) ?? [],
      options.userMappings,
    );
    logMondayUpdate += updateEntries.length;
    log_entries.push(...updateEntries);
  }

  const element_owners: TransformedElementOwner[] = [];
  for (const el of elements.values()) {
    if (!el.latest) continue;
    const user_id = resolveAuthorId(
      el.latest.owner_monday_id,
      options.userMappings,
    );
    if (user_id == null) continue;
    element_owners.push({
      element_id: el.id,
      user_id,
      monday_user_id: el.latest.owner_monday_id,
    });
  }

  const elementsOut: TransformedElement[] = [];
  let elements_mapped = 0;
  let elements_custom = 0;

  for (const el of elements.values()) {
    const latest = el.latest;
    if (el.master_element_id) elements_mapped += 1;
    else elements_custom += 1;

    elementsOut.push({
      id: el.id,
      category_id: el.category_id,
      master_element_id: el.master_element_id,
      name: el.name,
      parent_element_id: el.parent_element_id,
      order_index: el.order_index,
      monday_item_name: el.monday_item_name,
      status: latest?.status ?? "not_started",
      timeline_start: latest?.timeline_start ?? null,
      timeline_end: latest?.timeline_end ?? null,
    });
  }

  const categoryOrderById = new Map(
    [...categories.values()].map((c) => [c.id, c.order_index]),
  );
  elementsOut.sort((a, b) => {
    const oa = categoryOrderById.get(a.category_id) ?? 0;
    const ob = categoryOrderById.get(b.category_id) ?? 0;
    if (oa !== ob) return oa - ob;
    return a.order_index - b.order_index;
  });

  const modules_to_activate = collectOptionalModules(
    seenGroupTitles,
    options.groupMappings,
    options.masterModuleIdsByName ?? new Map(),
  );

  const transform_stats: TransformStats = {
    snapshots_processed: canonical.length,
    ...discardStats,
    elements_total: elementsOut.length,
    elements_mapped,
    elements_custom,
    log_entries_total: log_entries.length,
    log_entries_by_source: {
      snapshot: logSnapshot,
      monday_update: logMondayUpdate,
    },
  };

  return {
    project: {
      code: projectCode,
      name: projectCode,
    },
    categories: [...categories.values()].map(
      ({ monday_group_title: _t, ...c }) => c,
    ),
    elements: elementsOut,
    element_owners,
    log_entries,
    modules_to_activate,
    transform_stats,
  };
}

export function loadElementMappingFile(path: string): ElementMappingFile {
  const raw = JSON.parse(readFileSync(path, "utf8")) as ElementMappingFile;
  if (!Array.isArray(raw.groups) || !Array.isArray(raw.elements_unique)) {
    throw new Error(`${path}: se esperan groups y elements_unique`);
  }
  return raw;
}

export function loadUserMappingFile(path: string): Record<string, string | null> {
  const raw = JSON.parse(readFileSync(path, "utf8")) as UserMappingFile;
  return raw.mappings ?? {};
}

export function loadMondayExtractFile(path: string): MondayExtractPayload {
  const raw = JSON.parse(readFileSync(path, "utf8")) as MondayExtractPayload;
  if (!raw.project_code || !Array.isArray(raw.boards)) {
    throw new Error(`${path}: extract inválido`);
  }
  return raw;
}

export function writeMondayTransformed(
  payload: MondayTransformedPayload,
  projectCode: string,
): string {
  mkdirSync(MONDAY_TRANSFORMED_DIR, { recursive: true });
  const filePath = resolve(
    MONDAY_TRANSFORMED_DIR,
    `${projectCode.trim().toUpperCase()}.json`,
  );
  writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return filePath;
}

/** Suma de tableros contabilizados en transform_stats (debe igualar total del extract). */
export function sumBoardsInTransformStats(stats: TransformStats): number {
  return (
    stats.snapshots_processed +
    stats.snapshots_discarded_stubs +
    stats.snapshots_discarded_duplicado +
    stats.snapshots_discarded_subelementos +
    stats.snapshots_discarded_unparsed
  );
}

export function printTransformReport(
  payload: MondayTransformedPayload,
  totalBoards?: number,
  options?: { previousLogEntriesTotal?: number },
): void {
  const { transform_stats: s } = payload;
  console.log("\n## transform_stats\n");
  console.log(JSON.stringify(s, null, 2));

  if (options?.previousLogEntriesTotal != null) {
    const delta = s.log_entries_total - options.previousLogEntriesTotal;
    console.log(
      `\n  Δ log_entries vs run anterior (${options.previousLogEntriesTotal}): ${delta >= 0 ? "+" : ""}${delta}`,
    );
  }

  if (totalBoards != null) {
    const sum = sumBoardsInTransformStats(s);
    console.log("\n## Ecuación de tableros\n");
    console.log(`  total_boards (extract): ${totalBoards}`);
    console.log(`  suma contadores:      ${sum}`);
    console.log(`  cuadra: ${sum === totalBoards ? "sí" : "NO"}`);
  }

  const invalidStatusPair = payload.log_entries.filter(
    (le) => le.status_after != null && le.status_before == null,
  ).length;
  console.log("\n## Validación log_entry status\n");
  console.log(`  status_after sin status_before: ${invalidStatusPair}`);

  const byElement = new Map<string, number>();
  for (const le of payload.log_entries) {
    byElement.set(le.element_id, (byElement.get(le.element_id) ?? 0) + 1);
  }

  const elementName = new Map(payload.elements.map((e) => [e.id, e.monday_item_name]));
  const top = [...byElement.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  console.log("\n## Top 3 elementos por log_entries\n");
  if (!top.length) {
    console.log("_Sin entradas._");
    return;
  }
  for (const [id, count] of top) {
    console.log(`  - ${count} entradas · ${elementName.get(id) ?? id}`);
  }
}
