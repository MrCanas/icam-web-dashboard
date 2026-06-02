import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { getPgPool } from "./db";
import type { MondayTransformedPayload } from "./monday-transform";

export const RECONCILE_PROJECTS = ["CA1", "CSP10", "PC25", "VBARE", "VE1"] as const;
export type ReconcileProjectCode = (typeof RECONCILE_PROJECTS)[number];

export const MIGRATION_WINDOW_END = "2026-05-27T00:00:00.000Z";

export const FIX_JSON_DIR = resolve(
  process.cwd(),
  "tmp/monday-transformed-fix",
);

export interface JsonEntryRow {
  content: string;
  source: string;
  status_after: string | null;
  entry_date_correcta: string;
}

export interface DbLogRow {
  id: string;
  element_id: string;
  content: string;
  entry_date: string;
  created_at: string;
  status_after: string | null;
  source: string | null;
}

export interface DbElementRow {
  element_id: string;
  element_name: string;
  category_name: string;
  parent_name: string | null;
  order_index: number;
}

export interface JsonElementInfo {
  json_element_id: string;
  key: string;
  order_index: number;
}

export interface DbElementInfo {
  db_element_id: string;
  key: string;
  order_index: number;
}

export interface MatchedPair {
  db: DbLogRow;
  json: JsonEntryRow;
  element_key: string;
}

export interface ContentMismatch {
  projectCode: string;
  element_key: string;
  db_content: string;
  json_content: string;
  created_at: string;
  db_id: string;
}

export interface ManualReviewCase {
  projectCode: string;
  element_key: string;
  content: string;
  created_at: string;
  status_after_values: string[];
  row_ids: string[];
}

export interface ProposedDateUpdate {
  id: string;
  old: string;
  /** Fecha ISO YYYY-MM-DD */
  new: string;
  element_key: string;
  created_at: string;
}

export interface ReconcileProjectResult {
  projectCode: string;
  totalDb: number;
  pairs: MatchedPair[];
  contentMismatches: ContentMismatch[];
  manualReview: ManualReviewCase[];
  toUpdate: ProposedDateUpdate[];
  unchanged: number;
  realesPosteriores: DbLogRow[];
  anomalias: DbLogRow[];
  jsonOnly: { element_key: string; content: string; entry_date: string }[];
}

export function dateOnly(iso: string): string {
  return iso.slice(0, 10);
}

export function entryDateIso(jsonDate: string): string {
  return dateOnly(jsonDate);
}

export function entryDateToTimestamptzUtcMidnight(isoDate: string): string {
  const d = entryDateIso(isoDate);
  return `${d}T00:00:00.000Z`;
}

export function datesEquivalent(dbIso: string, jsonDate: string): boolean {
  return dateOnly(dbIso) === entryDateIso(jsonDate);
}

export function elementKey(
  categoryName: string,
  elementName: string,
  parentName: string | null,
): string {
  if (parentName) {
    return `${categoryName}|${parentName}|${elementName}`;
  }
  return `${categoryName}|${elementName}`;
}

export function elementKeyFromJson(
  payload: MondayTransformedPayload,
  elementId: string,
): string {
  const el = payload.elements.find((e) => e.id === elementId);
  if (!el) return elementId;
  const cat = payload.categories.find((c) => c.id === el.category_id);
  const catName = cat?.name ?? "?";
  if (el.parent_element_id) {
    const parent = payload.elements.find((e) => e.id === el.parent_element_id);
    return elementKey(catName, el.name, parent?.name ?? null);
  }
  return elementKey(catName, el.name, null);
}

export function buildJsonElements(
  payload: MondayTransformedPayload,
): JsonElementInfo[] {
  return payload.elements.map((el) => ({
    json_element_id: el.id,
    key: elementKeyFromJson(payload, el.id),
    order_index: el.order_index,
  }));
}

export function buildJsonEntriesByElementId(
  payload: MondayTransformedPayload,
): Map<string, JsonEntryRow[]> {
  const out = new Map<string, JsonEntryRow[]>();
  for (const le of payload.log_entries) {
    const list = out.get(le.element_id) ?? [];
    list.push({
      content: le.content,
      source: le.source,
      status_after: le.status_after,
      entry_date_correcta: le.entry_date,
    });
    out.set(le.element_id, list);
  }
  return out;
}

export function pairElementsByKey(
  jsonEls: JsonElementInfo[],
  dbEls: DbElementInfo[],
): { json: JsonElementInfo; db: DbElementInfo }[] {
  const pairs: { json: JsonElementInfo; db: DbElementInfo }[] = [];
  const jsonByKey = new Map<string, JsonElementInfo[]>();
  const dbByKey = new Map<string, DbElementInfo[]>();

  for (const j of jsonEls) {
    const list = jsonByKey.get(j.key) ?? [];
    list.push(j);
    jsonByKey.set(j.key, list);
  }
  for (const d of dbEls) {
    const list = dbByKey.get(d.key) ?? [];
    list.push(d);
    dbByKey.set(d.key, list);
  }

  const keys = new Set([...jsonByKey.keys(), ...dbByKey.keys()]);
  for (const key of keys) {
    const js = (jsonByKey.get(key) ?? []).sort(
      (a, b) =>
        a.order_index - b.order_index ||
        a.json_element_id.localeCompare(b.json_element_id),
    );
    const ds = (dbByKey.get(key) ?? []).sort(
      (a, b) =>
        a.order_index - b.order_index ||
        a.db_element_id.localeCompare(b.db_element_id),
    );
    const n = Math.min(js.length, ds.length);
    for (let i = 0; i < n; i++) {
      pairs.push({ json: js[i]!, db: ds[i]! });
    }
  }
  return pairs;
}

function sortDbRows(rows: DbLogRow[]): DbLogRow[] {
  return [...rows].sort((a, b) => {
    const c = a.created_at.localeCompare(b.created_at);
    if (c !== 0) return c;
    return a.id.localeCompare(b.id);
  });
}

function countByContent<T extends { content: string }>(rows: T[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of rows) {
    m.set(r.content, (m.get(r.content) ?? 0) + 1);
  }
  return m;
}

/** Inserción masiva P3.5: mismo timestamp de load (varía unos minutos por proyecto). */
export function isMigrationBatchCreatedAt(created_at: string): boolean {
  return /^2026-05-26 13:3[34]:/.test(created_at);
}

export function isRealAppEntry(created_at: string): boolean {
  return created_at >= MIGRATION_WINDOW_END;
}

/**
 * Empate created_at con distintos status_after cuando el orden no es recuperable.
 * Excluye el batch de migración (mismo timestamp 13:33:xx → desempate por id).
 */
export function detectManualReviewInDbGroup(
  projectCode: string,
  elementKeyStr: string,
  content: string,
  dbGroup: DbLogRow[],
  jsonGroupLength: number,
): ManualReviewCase | null {
  if (dbGroup.length < 2) return null;
  if (dbGroup.length !== jsonGroupLength) {
    return {
      projectCode,
      element_key: elementKeyStr,
      content,
      created_at: dbGroup[0]!.created_at,
      status_after_values: [`count db=${dbGroup.length} json=${jsonGroupLength}`],
      row_ids: dbGroup.map((r) => r.id),
    };
  }

  const byCreated = new Map<string, { statuses: Set<string | null>; ids: string[] }>();
  for (const row of dbGroup) {
    const bucket = byCreated.get(row.created_at) ?? {
      statuses: new Set<string | null>(),
      ids: [],
    };
    bucket.statuses.add(row.status_after);
    bucket.ids.push(row.id);
    byCreated.set(row.created_at, bucket);
  }

  for (const [created_at, bucket] of byCreated) {
    if (bucket.statuses.size <= 1) continue;
    if (bucket.ids.length >= 2 && isMigrationBatchCreatedAt(created_at)) {
      continue;
    }
    return {
      projectCode,
      element_key: elementKeyStr,
      content,
      created_at,
      status_after_values: [...bucket.statuses].map((s) => s ?? "null"),
      row_ids: bucket.ids,
    };
  }
  return null;
}

/**
 * Emparejamiento endurecido: duplicados solo dentro del mismo content, por orden.
 * No emparejamiento posicional entre contents distintos.
 */
export function matchElementEntriesHardened(
  elementKeyStr: string,
  projectCode: string,
  jsonRows: JsonEntryRow[],
  dbRows: DbLogRow[],
): {
  pairs: MatchedPair[];
  contentMismatches: ContentMismatch[];
  manualReview: ManualReviewCase[];
  unmatchedDb: DbLogRow[];
  unmatchedJson: JsonEntryRow[];
} {
  const contentMismatches: ContentMismatch[] = [];
  const manualReview: ManualReviewCase[] = [];
  const pairs: MatchedPair[] = [];

  const dbSorted = sortDbRows(dbRows);
  const jsonCounts = countByContent(jsonRows);
  const dbCounts = countByContent(dbSorted);

  const pairedDb = new Set<string>();
  const pairedJsonIdx = new Set<number>();

  for (let ji = 0; ji < jsonRows.length; ji++) {
    const je = jsonRows[ji]!;
    if (jsonCounts.get(je.content) !== 1) continue;
    const dbMatch = dbSorted.find(
      (d) =>
        !pairedDb.has(d.id) &&
        d.content === je.content &&
        dbCounts.get(d.content) === 1,
    );
    if (dbMatch) {
      pairs.push({ db: dbMatch, json: je, element_key: elementKeyStr });
      pairedDb.add(dbMatch.id);
      pairedJsonIdx.add(ji);
    }
  }

  const jsonRemain: { idx: number; row: JsonEntryRow }[] = [];
  for (let i = 0; i < jsonRows.length; i++) {
    if (!pairedJsonIdx.has(i)) jsonRemain.push({ idx: i, row: jsonRows[i]! });
  }
  const dbRemain = dbSorted.filter((d) => !pairedDb.has(d.id));

  const contents = new Set<string>();
  for (const { row } of jsonRemain) contents.add(row.content);
  for (const d of dbRemain) contents.add(d.content);

  for (const content of contents) {
    const dbGroupAll = sortDbRows(dbRemain.filter((d) => d.content === content));
    const jsonGroup = jsonRemain.filter((j) => j.row.content === content);

    const dbMigracion = dbGroupAll.filter((d) => !isRealAppEntry(d.created_at));
    const dbRealesInGroup = dbGroupAll.filter((d) => isRealAppEntry(d.created_at));

    const review = detectManualReviewInDbGroup(
      projectCode,
      elementKeyStr,
      content,
      dbMigracion,
      jsonGroup.length,
    );
    if (review) manualReview.push(review);

    const dbGroupSorted =
      dbMigracion.length > 1 &&
      dbMigracion.every((r) => isMigrationBatchCreatedAt(r.created_at))
        ? sortDbRows(dbMigracion)
        : dbMigracion;

    const n = Math.min(dbGroupSorted.length, jsonGroup.length);
    for (let i = 0; i < n; i++) {
      pairs.push({
        db: dbGroupSorted[i]!,
        json: jsonGroup[i]!.row,
        element_key: elementKeyStr,
      });
      pairedDb.add(dbGroupSorted[i]!.id);
      pairedJsonIdx.add(jsonGroup[i]!.idx);
    }
    // Entradas de app con el mismo content no se emparejan con JSON Monday
    for (const d of dbRealesInGroup) {
      if (!pairedDb.has(d.id)) {
        /* quedan en dbRemain → realesPosteriores */
      }
    }
  }

  for (const pair of pairs) {
    if (pair.db.content !== pair.json.content) {
      contentMismatches.push({
        projectCode,
        element_key: elementKeyStr,
        db_content: pair.db.content,
        json_content: pair.json.content,
        created_at: pair.db.created_at,
        db_id: pair.db.id,
      });
    }
  }

  const unmatchedDb = dbSorted.filter((d) => !pairedDb.has(d.id));
  const unmatchedJson = jsonRows.filter((_, i) => !pairedJsonIdx.has(i));

  return {
    pairs,
    contentMismatches,
    manualReview,
    unmatchedDb,
    unmatchedJson,
  };
}

export async function loadDbContext(
  projectCode: string,
  hasSource: boolean,
): Promise<{ dbElements: DbElementInfo[]; logRows: DbLogRow[] }> {
  const pool = getPgPool();

  const { rows: elRows } = await pool.query<DbElementRow>(
    `SELECT
       e.id AS element_id,
       e.name AS element_name,
       c.name AS category_name,
       p_el.name AS parent_name,
       e.order_index
     FROM public.element e
     INNER JOIN public.category c ON c.id = e.category_id
     INNER JOIN public.project p ON p.id = c.project_id
     LEFT JOIN public.element p_el ON p_el.id = e.parent_element_id
     WHERE p.code = $1
       AND e.archived_at IS NULL
       AND c.archived_at IS NULL`,
    [projectCode],
  );

  const dbElements: DbElementInfo[] = elRows.map((row) => ({
    db_element_id: row.element_id,
    key: elementKey(row.category_name, row.element_name, row.parent_name),
    order_index: row.order_index,
  }));

  const elementIds = elRows.map((r) => r.element_id);
  if (!elementIds.length) {
    return { dbElements, logRows: [] };
  }

  const sourceCol = hasSource ? "le.source" : "NULL::text AS source";
  const { rows: logRows } = await pool.query<DbLogRow>(
    `SELECT
       le.id,
       le.element_id,
       le.content,
       le.entry_date::text AS entry_date,
       le.created_at::text AS created_at,
       le.status_after,
       ${sourceCol}
     FROM public.log_entry le
     WHERE le.element_id = ANY($1::uuid[])
     ORDER BY le.element_id, le.created_at ASC, le.id ASC`,
    [elementIds],
  );

  return { dbElements, logRows };
}

export function loadFixJson(projectCode: string): MondayTransformedPayload {
  const jsonPath = resolve(FIX_JSON_DIR, `${projectCode}.json`);
  return JSON.parse(readFileSync(jsonPath, "utf8")) as MondayTransformedPayload;
}

export function reconcileProjectHardened(
  projectCode: string,
  payload: MondayTransformedPayload,
  db: { dbElements: DbElementInfo[]; logRows: DbLogRow[] },
): ReconcileProjectResult {
  const jsonElements = buildJsonElements(payload);
  const jsonEntriesById = buildJsonEntriesByElementId(payload);
  const dbByElementId = new Map<string, DbLogRow[]>();
  for (const row of db.logRows) {
    const list = dbByElementId.get(row.element_id) ?? [];
    list.push(row);
    dbByElementId.set(row.element_id, list);
  }

  const elementPairs = pairElementsByKey(jsonElements, db.dbElements);
  const pairedDbIds = new Set<string>();
  const pairedJsonIds = new Set<string>();

  const allPairs: MatchedPair[] = [];
  const contentMismatches: ContentMismatch[] = [];
  const manualReview: ManualReviewCase[] = [];
  const toUpdate: ProposedDateUpdate[] = [];
  let unchanged = 0;
  const realesPosteriores: DbLogRow[] = [];
  const anomalias: DbLogRow[] = [];
  const jsonOnly: ReconcileProjectResult["jsonOnly"] = [];

  for (const { json: jEl, db: dEl } of elementPairs) {
    pairedDbIds.add(dEl.db_element_id);
    pairedJsonIds.add(jEl.json_element_id);

    const jsonRows = jsonEntriesById.get(jEl.json_element_id) ?? [];
    const dbRows = dbByElementId.get(dEl.db_element_id) ?? [];

    const matched = matchElementEntriesHardened(
      jEl.key,
      projectCode,
      jsonRows,
      dbRows,
    );

    allPairs.push(...matched.pairs);
    contentMismatches.push(...matched.contentMismatches);
    manualReview.push(...matched.manualReview);

    for (const { db: d, json: j } of matched.pairs) {
      const newIso = entryDateIso(j.entry_date_correcta);
      if (datesEquivalent(d.entry_date, j.entry_date_correcta)) {
        unchanged += 1;
        continue;
      }
      if (d.created_at >= MIGRATION_WINDOW_END) {
        continue;
      }
      toUpdate.push({
        id: d.id,
        old: d.entry_date,
        new: newIso,
        element_key: jEl.key,
        created_at: d.created_at,
      });
    }

    for (const j of matched.unmatchedJson) {
      jsonOnly.push({
        element_key: jEl.key,
        content: j.content,
        entry_date: j.entry_date_correcta,
      });
    }

    for (const d of matched.unmatchedDb) {
      if (d.created_at >= MIGRATION_WINDOW_END) {
        realesPosteriores.push(d);
      } else {
        anomalias.push(d);
      }
    }
  }

  for (const dEl of db.dbElements) {
    if (pairedDbIds.has(dEl.db_element_id)) continue;
    for (const d of dbByElementId.get(dEl.db_element_id) ?? []) {
      if (d.created_at >= MIGRATION_WINDOW_END) {
        realesPosteriores.push(d);
      } else {
        anomalias.push(d);
      }
    }
  }

  for (const jEl of jsonElements) {
    if (pairedJsonIds.has(jEl.json_element_id)) continue;
    for (const j of jsonEntriesById.get(jEl.json_element_id) ?? []) {
      jsonOnly.push({
        element_key: jEl.key,
        content: j.content,
        entry_date: j.entry_date_correcta,
      });
    }
  }

  return {
    projectCode,
    totalDb: db.logRows.length,
    pairs: allPairs,
    contentMismatches,
    manualReview,
    toUpdate,
    unchanged,
    realesPosteriores,
    anomalias,
    jsonOnly,
  };
}

export async function introspectLogEntryHasSource(): Promise<boolean> {
  const pool = getPgPool();
  const { rows } = await pool.query<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'log_entry' AND column_name = 'source'`,
  );
  return rows.length > 0;
}
