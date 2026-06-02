/**
 * Auditoría / fix de entry_date: esperado desde transform actual (snapshot_date_iso)
 * emparejado con BD por elemento + content (migración no guardó snapshot_id en log_entry).
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  loadElementMappingFile,
  loadMondayExtractFile,
  loadUserMappingFile,
  selectCanonicalBoards,
  transformMondayExtract,
  type MondayTransformedPayload,
} from "./monday-transform";
import { MONDAY_EXTRACTS_DIR, type MondayExtractPayload } from "./monday-extract";
import {
  buildJsonElements,
  buildJsonEntriesByElementId,
  dateOnly,
  datesEquivalent,
  entryDateIso,
  entryDateToTimestamptzUtcMidnight,
  introspectLogEntryHasSource,
  isRealAppEntry,
  loadDbContext,
  matchElementEntriesHardened,
  pairElementsByKey,
  type DbLogRow,
  type MatchedPair,
} from "./reconcile-entry-dates";
import { getPgPool } from "./db";

const MAPPING_PATH = resolve(process.cwd(), "docs/actas/07-element-mapping.json");
const USER_MAPPING_PATH = resolve(process.cwd(), "docs/actas/06-user-mapping.json");

export interface EntryDateDiscrepancy {
  entry_id: string;
  fecha_actual: string;
  fecha_esperada: string;
  nombre_snapshot: string;
  element_key: string;
  provenance: "snapshot" | "monday_update";
}

export interface ProjectAuditResult {
  projectCode: string;
  hasExtract: boolean;
  hasDbProject: boolean;
  canonicalSnapshots: number;
  totalLogEntries: number;
  /** Emparejadas a entrada esperada del transform (snapshot o update). */
  matchedAuditable: number;
  snapshotMatched: number;
  correct: number;
  incorrect: number;
  /** Sin match (app, anomalías, etc.) — no entran en correct/incorrect del bug. */
  excludedUnmatched: number;
  excludedReales: number;
  discrepancies: EntryDateDiscrepancy[];
  dbSourceSnapshotCount: number | null;
}

export function isoToDisplayDate(iso: string): string {
  const d = dateOnly(iso);
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

export function buildBoardNameByIso(
  extract: MondayExtractPayload,
): Map<string, string> {
  const map = new Map<string, string>();
  const code = extract.project_code.trim().toUpperCase();
  const { canonical } = selectCanonicalBoards(extract.boards, code);

  for (const board of canonical) {
    const iso = board.parsed.snapshot_date_iso;
    if (iso) map.set(iso, board.name.trim());
  }
  for (const board of extract.boards) {
    const iso = board.parsed.snapshot_date_iso;
    if (iso && !map.has(iso)) map.set(iso, board.name.trim());
  }
  return map;
}

export function snapshotNameForExpectedDate(
  projectCode: string,
  expectedIso: string,
  boardNames: Map<string, string>,
): string {
  return (
    boardNames.get(expectedIso) ??
    `${projectCode} - ${isoToDisplayDate(expectedIso)}`
  );
}

export function transformExpectedPayload(
  projectCode: string,
): MondayTransformedPayload | null {
  const extractPath = resolve(MONDAY_EXTRACTS_DIR, `${projectCode}.json`);
  if (!existsSync(extractPath)) return null;

  const extract = loadMondayExtractFile(extractPath);
  const elementMapping = loadElementMappingFile(MAPPING_PATH);
  const userMappings = loadUserMappingFile(USER_MAPPING_PATH);

  return transformMondayExtract(extract, {
    userMappings,
    groupMappings: elementMapping.groups,
    elementsUnique: elementMapping.elements_unique,
  });
}

function collectPairs(
  projectCode: string,
  payload: MondayTransformedPayload,
  db: Awaited<ReturnType<typeof loadDbContext>>,
): {
  pairs: MatchedPair[];
  reales: DbLogRow[];
  anomalias: DbLogRow[];
  unmatchedDbIds: Set<string>;
} {
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
  const allPairs: MatchedPair[] = [];
  const reales: DbLogRow[] = [];
  const anomalias: DbLogRow[] = [];

  for (const { json: jEl, db: dEl } of elementPairs) {
    pairedDbIds.add(dEl.db_element_id);
    const jsonRows = jsonEntriesById.get(jEl.json_element_id) ?? [];
    const dbRows = dbByElementId.get(dEl.db_element_id) ?? [];
    const matched = matchElementEntriesHardened(
      jEl.key,
      projectCode,
      jsonRows,
      dbRows,
    );
    allPairs.push(...matched.pairs);
    for (const d of matched.unmatchedDb) {
      if (isRealAppEntry(d.created_at)) reales.push(d);
      else anomalias.push(d);
    }
  }

  for (const dEl of db.dbElements) {
    if (pairedDbIds.has(dEl.db_element_id)) continue;
    for (const d of dbByElementId.get(dEl.db_element_id) ?? []) {
      if (isRealAppEntry(d.created_at)) reales.push(d);
      else anomalias.push(d);
    }
  }

  return { pairs: allPairs, reales, anomalias, unmatchedDbIds: pairedDbIds };
}

export async function listProjectCodesInDb(): Promise<string[]> {
  const pool = getPgPool();
  const { rows } = await pool.query<{ code: string }>(
    `SELECT code FROM public.project ORDER BY code`,
  );
  return rows.map((r) => r.code.trim().toUpperCase());
}

export async function countDbSourceSnapshot(
  projectCode: string,
  hasSource: boolean,
): Promise<number | null> {
  if (!hasSource) return null;
  const pool = getPgPool();
  const { rows } = await pool.query<{ n: string }>(
    `SELECT COUNT(*)::text AS n
     FROM public.log_entry le
     INNER JOIN public.element e ON e.id = le.element_id
     INNER JOIN public.category c ON c.id = e.category_id
     INNER JOIN public.project p ON p.id = c.project_id
     WHERE p.code = $1 AND le.source = 'snapshot'`,
    [projectCode],
  );
  return Number(rows[0]?.n ?? 0);
}

export async function auditProject(
  projectCode: string,
): Promise<ProjectAuditResult> {
  const code = projectCode.trim().toUpperCase();
  const hasSource = await introspectLogEntryHasSource();
  const db = await loadDbContext(code, hasSource);
  const hasDbProject = db.dbElements.length > 0 || db.logRows.length > 0;

  const extractPath = resolve(MONDAY_EXTRACTS_DIR, `${code}.json`);
  const hasExtract = existsSync(extractPath);

  if (!hasExtract || !hasDbProject) {
    return {
      projectCode: code,
      hasExtract,
      hasDbProject,
      canonicalSnapshots: 0,
      totalLogEntries: db.logRows.length,
      matchedAuditable: 0,
      snapshotMatched: 0,
      correct: 0,
      incorrect: 0,
      excludedUnmatched: db.logRows.length,
      excludedReales: 0,
      discrepancies: [],
      dbSourceSnapshotCount: hasSource
        ? await countDbSourceSnapshot(code, hasSource)
        : null,
    };
  }

  const extract = loadMondayExtractFile(extractPath);
  const { canonical } = selectCanonicalBoards(extract.boards, code);
  const boardNames = buildBoardNameByIso(extract);
  const payload = transformExpectedPayload(code);
  if (!payload) {
    throw new Error(`transform falló para ${code}`);
  }

  const { pairs, reales, anomalias } = collectPairs(code, payload, db);
  const pairedDbIds = new Set(pairs.map((p) => p.db.id));

  let correct = 0;
  let incorrect = 0;
  let snapshotMatched = 0;
  const discrepancies: EntryDateDiscrepancy[] = [];

  for (const { db: row, json, element_key } of pairs) {
    const prov = json.source === "snapshot" ? "snapshot" : "monday_update";
    if (prov !== "snapshot") continue;

    snapshotMatched += 1;
    const expectedIso = entryDateIso(json.entry_date_correcta);
    const actualDay = dateOnly(row.entry_date);

    if (datesEquivalent(row.entry_date, json.entry_date_correcta)) {
      correct += 1;
      continue;
    }

    if (isRealAppEntry(row.created_at)) continue;

    incorrect += 1;
    discrepancies.push({
      entry_id: row.id,
      fecha_actual: actualDay,
      fecha_esperada: expectedIso,
      nombre_snapshot: snapshotNameForExpectedDate(
        code,
        expectedIso,
        boardNames,
      ),
      element_key,
      provenance: prov,
    });
  }

  return {
    projectCode: code,
    hasExtract,
    hasDbProject,
    canonicalSnapshots: canonical.length,
    totalLogEntries: db.logRows.length,
    matchedAuditable: pairs.length,
    snapshotMatched,
    correct,
    incorrect,
    excludedUnmatched: db.logRows.length - correct - incorrect,
    excludedReales: reales.length,
    discrepancies,
    dbSourceSnapshotCount: await countDbSourceSnapshot(code, hasSource),
  };
}

export interface ApplyFixResult {
  projectCode: string;
  dryRun: boolean;
  proposed: number;
  applied: number;
  skippedAlreadyOk: number;
  skippedDrift: number;
}

export async function applyFixesForProject(
  projectCode: string,
  dryRun: boolean,
): Promise<ApplyFixResult> {
  const audit = await auditProject(projectCode);
  const updates = audit.discrepancies;

  if (dryRun) {
    return {
      projectCode: audit.projectCode,
      dryRun: true,
      proposed: updates.length,
      applied: 0,
      skippedAlreadyOk: 0,
      skippedDrift: 0,
    };
  }

  const pool = getPgPool();
  const client = await pool.connect();
  let applied = 0;
  let skippedDrift = 0;

  try {
    await client.query("BEGIN");
    for (const u of updates) {
      const { rows: dbRow } = await client.query<{ entry_date: string }>(
        `SELECT entry_date::text FROM public.log_entry WHERE id = $1`,
        [u.entry_id],
      );
      const current = dbRow[0]?.entry_date;
      if (!current) {
        skippedDrift += 1;
        continue;
      }
      if (datesEquivalent(current, u.fecha_esperada)) {
        continue;
      }

      const res = await client.query(
        `UPDATE public.log_entry
         SET entry_date = ($1::text || 'T00:00:00Z')::timestamptz
         WHERE id = $2::uuid
           AND entry_date = $3::timestamptz`,
        [u.fecha_esperada, u.entry_id, current],
      );
      if ((res.rowCount ?? 0) > 0) applied += 1;
      else skippedDrift += 1;
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }

  return {
    projectCode: audit.projectCode,
    dryRun: false,
    proposed: updates.length,
    applied,
    skippedAlreadyOk: updates.length - applied - skippedDrift,
    skippedDrift,
  };
}

/** Comprueba en código fuente que entry_date snapshot usa snapshot_date_iso. */
export function verifyMondayTransformSourceFix(): {
  ok: boolean;
  note: string;
} {
  const path = resolve(process.cwd(), "scripts/actas/lib/monday-transform.ts");
  const src = readFileSync(path, "utf8");
  const usesIso =
    src.includes("entry_date: obs.snapshot_date_iso") &&
    !src.match(/entry_date:\s*obs\.observation_at/);
  return {
    ok: usesIso,
    note: usesIso
      ? "`buildLogEntriesFromObservations` asigna `entry_date: obs.snapshot_date_iso` (corregido). `observation_at` solo ordena observaciones."
      : "REGRESIÓN: revisar asignaciones entry_date en monday-transform.ts",
  };
}

export { entryDateToTimestamptzUtcMidnight };
