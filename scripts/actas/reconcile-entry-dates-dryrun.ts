/**
 * Dry-run: reconciliar entry_date de log_entries Monday con JSON corregido.
 * Solo SELECT en Postgres; no modifica la BD.
 */
import { config } from "dotenv";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { getPgPool } from "./lib/db";
import type { MondayTransformedPayload } from "./lib/monday-transform";

config({ path: resolve(process.cwd(), ".env.local") });

const PROJECTS = ["CA1", "CSP10", "PC25", "VBARE", "VE1"] as const;

const FIX_JSON_DIR = resolve(process.cwd(), "tmp/monday-transformed-fix");
const UPDATES_DIR = resolve(process.cwd(), "tmp/entry-date-updates");
const REPORT_PATH = resolve(process.cwd(), "docs/actas/11-reconcile-dryrun.md");

/** Carga Monday P3.5 (2026-05-26); entradas de app posteriores quedan fuera del update. */
const MIGRATION_WINDOW_END = "2026-05-27T00:00:00.000Z";

interface LogEntryColumnInfo {
  column_name: string;
  data_type: string;
  is_nullable: string;
}

interface JsonEntryRow {
  content: string;
  source: string;
  entry_date_correcta: string;
}

interface DbLogRow {
  id: string;
  element_id: string;
  content: string;
  entry_date: string;
  created_at: string;
  source: string | null;
}

interface DbElementRow {
  element_id: string;
  element_name: string;
  category_name: string;
  parent_name: string | null;
  order_index: number;
}

interface JsonElementInfo {
  json_element_id: string;
  key: string;
  order_index: number;
}

interface DbElementInfo {
  db_element_id: string;
  key: string;
  order_index: number;
}

interface ProposedChange {
  id: string;
  element_key: string;
  content_trunc: string;
  old: string;
  new: string;
}

interface UnmatchedRow {
  id: string;
  element_key: string;
  content_trunc: string;
  entry_date: string;
  created_at: string;
}

interface ProjectReconcileResult {
  projectCode: string;
  schemaNote: string;
  migrationWindowEnd: string;
  jsonSnapshotDateMax: string | null;
  totalDb: number;
  toUpdate: ProposedChange[];
  unchanged: number;
  realesPosteriores: UnmatchedRow[];
  anomalias: UnmatchedRow[];
  jsonOnly: { element_key: string; content_trunc: string; entry_date: string }[];
  matchStats: { elementsInJson: number; elementsInDb: number; elementsMatched: number };
}

function truncate(s: string, max = 60): string {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

function dateOnly(iso: string): string {
  return iso.slice(0, 10);
}

function entryDateToTimestamptz(isoDate: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
    return `${isoDate}T12:00:00.000Z`;
  }
  return isoDate;
}

function datesEquivalent(dbIso: string, jsonDate: string): boolean {
  return dateOnly(dbIso) === dateOnly(jsonDate);
}

function elementKey(
  categoryName: string,
  elementName: string,
  parentName: string | null,
): string {
  if (parentName) {
    return `${categoryName}|${parentName}|${elementName}`;
  }
  return `${categoryName}|${elementName}`;
}

function elementKeyFromJson(
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

/** Orden del array global log_entries (primera aparición por elemento). */
function buildJsonElements(payload: MondayTransformedPayload): JsonElementInfo[] {
  return payload.elements.map((el) => ({
    json_element_id: el.id,
    key: elementKeyFromJson(payload, el.id),
    order_index: el.order_index,
  }));
}

function buildJsonEntriesByElementId(
  payload: MondayTransformedPayload,
): Map<string, JsonEntryRow[]> {
  const out = new Map<string, JsonEntryRow[]>();
  for (const le of payload.log_entries) {
    const list = out.get(le.element_id) ?? [];
    list.push({
      content: le.content,
      source: le.source,
      entry_date_correcta: le.entry_date,
    });
    out.set(le.element_id, list);
  }
  return out;
}

function pairElementsByKey<T extends { key: string; order_index: number }>(
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
      (a, b) => a.order_index - b.order_index || a.json_element_id.localeCompare(b.json_element_id),
    );
    const ds = (dbByKey.get(key) ?? []).sort(
      (a, b) => a.order_index - b.order_index || a.db_element_id.localeCompare(b.db_element_id),
    );
    const n = Math.min(js.length, ds.length);
    for (let i = 0; i < n; i++) {
      pairs.push({ json: js[i]!, db: ds[i]! });
    }
  }
  return pairs;
}

function countByContent<T extends { content: string }>(rows: T[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of rows) {
    m.set(r.content, (m.get(r.content) ?? 0) + 1);
  }
  return m;
}

function matchElementEntries(
  elementKeyStr: string,
  jsonRows: JsonEntryRow[],
  dbRows: DbLogRow[],
): {
  pairs: { db: DbLogRow; json: JsonEntryRow }[];
  unmatchedDb: DbLogRow[];
  unmatchedJson: JsonEntryRow[];
} {
  const dbSorted = [...dbRows].sort((a, b) => {
    const c = a.created_at.localeCompare(b.created_at);
    if (c !== 0) return c;
    return a.id.localeCompare(b.id);
  });

  const jsonCounts = countByContent(jsonRows);
  const dbCounts = countByContent(dbSorted);

  const pairedDb = new Set<string>();
  const pairedJsonIdx = new Set<number>();
  const pairs: { db: DbLogRow; json: JsonEntryRow }[] = [];

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
      pairs.push({ db: dbMatch, json: je });
      pairedDb.add(dbMatch.id);
      pairedJsonIdx.add(ji);
    }
  }

  const jsonRemain = jsonRows.filter((_, i) => !pairedJsonIdx.has(i));
  const dbRemain = dbSorted.filter((d) => !pairedDb.has(d.id));

  const n = Math.min(jsonRemain.length, dbRemain.length);
  for (let i = 0; i < n; i++) {
    pairs.push({ db: dbRemain[i]!, json: jsonRemain[i]! });
  }

  const unmatchedDb = dbRemain.slice(n);
  const unmatchedJson = jsonRemain.slice(n);

  return { pairs, unmatchedDb, unmatchedJson };
}

async function introspectLogEntrySchema(): Promise<{
  columns: LogEntryColumnInfo[];
  hasCreatedAt: boolean;
  hasSource: boolean;
}> {
  const pool = getPgPool();
  const { rows } = await pool.query<LogEntryColumnInfo>(
    `SELECT column_name, data_type, is_nullable
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'log_entry'
     ORDER BY ordinal_position`,
  );
  const names = new Set(rows.map((r) => r.column_name));
  return {
    columns: rows,
    hasCreatedAt: names.has("created_at"),
    hasSource: names.has("source"),
  };
}

async function loadDbContext(projectCode: string, hasSource: boolean): Promise<{
  dbElements: DbElementInfo[];
  logRows: DbLogRow[];
}> {
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
       ${sourceCol}
     FROM public.log_entry le
     WHERE le.element_id = ANY($1::uuid[])
     ORDER BY le.element_id, le.created_at ASC, le.id ASC`,
    [elementIds],
  );

  return { dbElements, logRows };
}

function maxSnapshotDateFromJson(payload: MondayTransformedPayload): string | null {
  let max: string | null = null;
  for (const le of payload.log_entries) {
    if (le.source !== "snapshot") continue;
    const d = dateOnly(le.entry_date);
    if (!max || d > max) max = d;
  }
  return max;
}

function reconcileProject(
  projectCode: string,
  payload: MondayTransformedPayload,
  schema: { hasCreatedAt: boolean; hasSource: boolean; columns: LogEntryColumnInfo[] },
  db: {
    dbElements: DbElementInfo[];
    logRows: DbLogRow[];
  },
): ProjectReconcileResult {
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

  const toUpdate: ProposedChange[] = [];
  let unchanged = 0;
  const realesPosteriores: UnmatchedRow[] = [];
  const anomalias: UnmatchedRow[] = [];
  const jsonOnly: ProjectReconcileResult["jsonOnly"] = [];

  const migrationEnd = MIGRATION_WINDOW_END;

  for (const { json: jEl, db: dEl } of elementPairs) {
    pairedDbIds.add(dEl.db_element_id);
    pairedJsonIds.add(jEl.json_element_id);

    const jsonRows = jsonEntriesById.get(jEl.json_element_id) ?? [];
    const dbRows = dbByElementId.get(dEl.db_element_id) ?? [];

    const { pairs, unmatchedDb, unmatchedJson } = matchElementEntries(
      jEl.key,
      jsonRows,
      dbRows,
    );

    for (const { db: d, json: j } of pairs) {
      const newDate = entryDateToTimestamptz(j.entry_date_correcta);
      if (datesEquivalent(d.entry_date, j.entry_date_correcta)) {
        unchanged += 1;
        continue;
      }
      toUpdate.push({
        id: d.id,
        element_key: jEl.key,
        content_trunc: truncate(d.content),
        old: d.entry_date,
        new: newDate,
      });
    }

    for (const j of unmatchedJson) {
      jsonOnly.push({
        element_key: jEl.key,
        content_trunc: truncate(j.content),
        entry_date: j.entry_date_correcta,
      });
    }

    for (const d of unmatchedDb) {
      const row: UnmatchedRow = {
        id: d.id,
        element_key: jEl.key,
        content_trunc: truncate(d.content),
        entry_date: d.entry_date,
        created_at: d.created_at,
      };
      if (d.created_at >= migrationEnd) {
        realesPosteriores.push(row);
      } else {
        anomalias.push(row);
      }
    }
  }

  for (const dEl of db.dbElements) {
    if (pairedDbIds.has(dEl.db_element_id)) continue;
    const dbRows = dbByElementId.get(dEl.db_element_id) ?? [];
    for (const d of dbRows) {
      const row: UnmatchedRow = {
        id: d.id,
        element_key: dEl.key,
        content_trunc: truncate(d.content),
        entry_date: d.entry_date,
        created_at: d.created_at,
      };
      if (d.created_at >= migrationEnd) {
        realesPosteriores.push(row);
      } else {
        anomalias.push(row);
      }
    }
  }

  for (const jEl of jsonElements) {
    if (pairedJsonIds.has(jEl.json_element_id)) continue;
    const jsonRows = jsonEntriesById.get(jEl.json_element_id) ?? [];
    for (const j of jsonRows) {
      jsonOnly.push({
        element_key: jEl.key,
        content_trunc: truncate(j.content),
        entry_date: j.entry_date_correcta,
      });
    }
  }

  const jsonKeys = new Set(jsonElements.map((e) => e.key));
  const dbKeys = new Set(db.dbElements.map((e) => e.key));
  let elementsMatched = 0;
  for (const k of jsonKeys) {
    if (dbKeys.has(k)) elementsMatched += 1;
  }

  const schemaNote = schema.columns
    .map((c) => `\`${c.column_name}\` (${c.data_type})`)
    .join(", ");

  return {
    projectCode,
    schemaNote,
    migrationWindowEnd: migrationEnd,
    jsonSnapshotDateMax: maxSnapshotDateFromJson(payload),
    totalDb: db.logRows.length,
    toUpdate,
    unchanged,
    realesPosteriores,
    anomalias,
    jsonOnly,
    matchStats: {
      elementsInJson: jsonElements.length,
      elementsInDb: db.dbElements.length,
      elementsMatched,
    },
  };
}

function verifyCuadre(r: ProjectReconcileResult): string | null {
  const sum =
    r.toUpdate.length +
    r.unchanged +
    r.realesPosteriores.length +
    r.anomalias.length;
  if (sum !== r.totalDb) {
    return `CUADRE ROTO: ${r.toUpdate.length} actualizar + ${r.unchanged} sin cambio + ${r.realesPosteriores.length} reales + ${r.anomalias.length} anomalías = ${sum} ≠ total DB ${r.totalDb} (jsonOnly=${r.jsonOnly.length})`;
  }
  return null;
}

function formatReportSection(r: ProjectReconcileResult): string[] {
  const lines: string[] = [];
  const cuadreErr = verifyCuadre(r);
  const cuadreOk =
    r.toUpdate.length +
      r.unchanged +
      r.realesPosteriores.length +
      r.anomalias.length ===
    r.totalDb;

  lines.push(`## ${r.projectCode}`, "");
  lines.push("| Métrica | Valor |", "| --- | ---: |");
  lines.push(`| log_entries (elementos actuales, DB) | ${r.totalDb} |`);
  lines.push(`| A actualizar (entry_date distinta) | ${r.toUpdate.length} |`);
  lines.push(`| Sin cambio | ${r.unchanged} |`);
  lines.push(`| Reales / posteriores (sin match, fuera del update) | ${r.realesPosteriores.length} |`);
  lines.push(`| Anomalías (sin match, revisión) | ${r.anomalias.length} |`);
  lines.push(`| JSON sin par en DB | ${r.jsonOnly.length} |`);
  lines.push(
    `| Cuadre (actualizar+sin cambio+reales+anomalías=total) | ${cuadreOk ? "✓" : "✗"} |`,
  );
  lines.push(
    `| Elementos con entradas (JSON / DB / ambos) | ${r.matchStats.elementsInJson} / ${r.matchStats.elementsInDb} / ${r.matchStats.elementsMatched} |`,
  );
  lines.push("");

  if (cuadreErr) {
    lines.push(`> **${cuadreErr}**`, "");
  }

  lines.push(
    "### Muestra de cambios propuestos (máx. 15)",
    "",
  );
  if (!r.toUpdate.length) {
    lines.push("_Ninguno._", "");
  } else {
    for (const c of r.toUpdate.slice(0, 15)) {
      lines.push(
        `- \`${c.id.slice(0, 8)}…\` · ${c.element_key} · «${c.content_trunc}» · ${dateOnly(c.old)} → **${dateOnly(c.new)}**`,
      );
    }
    if (r.toUpdate.length > 15) {
      lines.push(`- … y ${r.toUpdate.length - 15} más`);
    }
    lines.push("");
  }

  if (r.realesPosteriores.length) {
    lines.push("### Reales / posteriores (respetadas)", "");
    for (const u of r.realesPosteriores.slice(0, 10)) {
      lines.push(
        `- \`${u.id.slice(0, 8)}…\` · ${u.element_key} · created_at=${u.created_at.slice(0, 19)} · entry_date=${dateOnly(u.entry_date)}`,
      );
    }
    if (r.realesPosteriores.length > 10) {
      lines.push(`- … y ${r.realesPosteriores.length - 10} más`);
    }
    lines.push("");
  }

  if (r.anomalias.length) {
    lines.push("### Anomalías", "");
    for (const u of r.anomalias) {
      lines.push(
        `- \`${u.id}\` · ${u.element_key} · «${u.content_trunc}» · entry_date=${u.entry_date} · created_at=${u.created_at}`,
      );
    }
    lines.push("");
  }

  if (r.jsonOnly.length) {
    lines.push("### JSON sin par en DB", "");
    for (const j of r.jsonOnly.slice(0, 10)) {
      lines.push(`- ${j.element_key} · «${j.content_trunc}» · ${j.entry_date}`);
    }
    lines.push("");
  }

  const may13 = r.toUpdate.filter((c) => dateOnly(c.old) === "2026-05-13").length;
  if (r.projectCode === "CSP10" && may13) {
    lines.push(
      `**CSP10:** ${may13} cambios propuestos desde \`entry_date\` 2026-05-13 (bug updated_at).`,
      "",
    );
  }

  return lines;
}

async function main(): Promise<void> {
  console.log("reconcile-entry-dates-dryrun — SOLO LECTURA\n");

  const schema = await introspectLogEntrySchema();
  console.log("## Esquema public.log_entry\n");
  for (const col of schema.columns) {
    console.log(
      `  - ${col.column_name}: ${col.data_type} (nullable=${col.is_nullable})`,
    );
  }
  console.log(
    `\n  created_at: ${schema.hasCreatedAt ? "sí" : "no"}`,
  );
  console.log(`  source: ${schema.hasSource ? "sí" : "no"}\n`);

  mkdirSync(UPDATES_DIR, { recursive: true });

  const reportLines: string[] = [
    "# Dry-run reconciliación entry_date",
    "",
    `Generado: ${new Date().toISOString()}`,
    "",
    "Solo SELECT en Postgres. Fuente de fechas: `tmp/monday-transformed-fix/{code}.json`.",
    "",
    "## Esquema `public.log_entry`",
    "",
    "| Columna | Tipo | Nullable |",
    "| --- | --- | --- |",
  ];

  for (const col of schema.columns) {
    reportLines.push(
      `| ${col.column_name} | ${col.data_type} | ${col.is_nullable} |`,
    );
  }
  reportLines.push(
    "",
    `**created_at:** ${schema.hasCreatedAt ? "presente (orden de desempate en duplicados)" : "ausente"}`,
    `**source:** ${schema.hasSource ? "presente (no usada en match; no existe en migración P3.5)" : "ausente en BD"}`,
    "",
    `Ventana migración Monday: entradas con \`created_at >= ${MIGRATION_WINDOW_END}\` sin match → reales/posteriores.`,
    "",
  );

  const allResults: ProjectReconcileResult[] = [];

  for (const projectCode of PROJECTS) {
    console.log(`\n=== ${projectCode} ===`);
    const jsonPath = resolve(FIX_JSON_DIR, `${projectCode}.json`);
    if (!existsSync(jsonPath)) {
      throw new Error(`Falta JSON corregido: ${jsonPath}`);
    }

    const payload = JSON.parse(
      readFileSync(jsonPath, "utf8"),
    ) as MondayTransformedPayload;

    const db = await loadDbContext(projectCode, schema.hasSource);
    const result = reconcileProject(projectCode, payload, schema, db);
    allResults.push(result);

    const cuadreErr = verifyCuadre(result);
    console.log(`  DB log_entries: ${result.totalDb}`);
    console.log(`  Actualizar: ${result.toUpdate.length}`);
    console.log(`  Sin cambio: ${result.unchanged}`);
    console.log(`  Reales: ${result.realesPosteriores.length}`);
    console.log(`  Anomalías: ${result.anomalias.length}`);
    if (cuadreErr) console.warn(`  ${cuadreErr}`);

    writeFileSync(
      resolve(UPDATES_DIR, `${projectCode}.json`),
      `${JSON.stringify(
        result.toUpdate.map(({ id, old, new: newDate }) => ({
          id,
          old,
          new: newDate,
        })),
        null,
        2,
      )}\n`,
      "utf8",
    );

    reportLines.push(...formatReportSection(result));
  }

  reportLines.push("## Resumen global", "");
  reportLines.push("| Proyecto | Total DB | Actualizar | Sin cambio | Reales | Anomalías | Cuadre |");
  reportLines.push("| --- | ---: | ---: | ---: | ---: | ---: | --- |");
  for (const r of allResults) {
    const ok = verifyCuadre(r) == null;
    reportLines.push(
      `| ${r.projectCode} | ${r.totalDb} | ${r.toUpdate.length} | ${r.unchanged} | ${r.realesPosteriores.length} | ${r.anomalias.length} | ${ok ? "✓" : "✗"} |`,
    );
  }
  reportLines.push("");

  writeFileSync(REPORT_PATH, `${reportLines.join("\n")}\n`, "utf8");
  console.log(`\nReporte: ${REPORT_PATH}`);
  console.log(`Updates: ${UPDATES_DIR}/`);

  await getPgPool().end();
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
