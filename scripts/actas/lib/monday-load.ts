import type { PoolClient } from "pg";

import { getPgPool } from "./db";
import type {
  MondayTransformedPayload,
  TransformedElement,
  TransformedLogEntry,
  TransformStats,
} from "./monday-transform";

const LOG_ENTRY_BATCH_SIZE = 500;

/** Defaults when el JSON de transform no incluye phase/asset_type (P3.4). */
export const DEFAULT_PROJECT_PHASE = "desarrollo" as const;
export const DEFAULT_PROJECT_ASSET_TYPE = "otro" as const;
export const DEFAULT_ORGANIZATION_SLUG = "icam";

export interface LoadCounts {
  project: number;
  project_module: number;
  category: number;
  element: number;
  element_owner: number;
  log_entry: number;
}

export interface LoadReport {
  projectCode: string;
  dryRun: boolean;
  inserted: LoadCounts;
  expected: LoadCounts;
  transformStats: TransformStats;
  dateRange: { min: string | null; max: string | null };
  nullAuthorLogEntries: number;
  mappedElements: number;
  customElements: number;
  logEntryBatches: number;
  chronologicalOrderOk: boolean;
  warnings: string[];
  projectId: string | null;
}

export class LoadVerificationError extends Error {
  constructor(
    message: string,
    readonly differences: string[],
  ) {
    super(message);
    this.name = "LoadVerificationError";
  }
}

function expectedCounts(payload: MondayTransformedPayload): LoadCounts {
  const modules = payload.modules_to_activate.filter(
    (m) => m.master_module_id != null,
  );
  const owners = payload.element_owners.filter((o) => o.user_id != null);
  return {
    project: 1,
    project_module: modules.length,
    category: payload.categories.length,
    element: payload.elements.length,
    element_owner: owners.length,
    log_entry: payload.log_entries.length,
  };
}

function logEntryDateKey(entry: TransformedLogEntry): string {
  return entry.entry_date;
}

function isLogEntriesChronological(entries: TransformedLogEntry[]): boolean {
  for (let i = 1; i < entries.length; i++) {
    const prev = logEntryDateKey(entries[i - 1]!);
    const cur = logEntryDateKey(entries[i]!);
    if (cur < prev) return false;
    if (cur === prev && entries[i]!.id < entries[i - 1]!.id) return false;
  }
  return true;
}

function sortedLogEntries(
  entries: TransformedLogEntry[],
): TransformedLogEntry[] {
  return [...entries].sort((a, b) => {
    const d = a.entry_date.localeCompare(b.entry_date);
    if (d !== 0) return d;
    return a.id.localeCompare(b.id);
  });
}

function dateOnly(iso: string): string {
  return iso.slice(0, 10);
}

function computeDateRange(entries: TransformedLogEntry[]): {
  min: string | null;
  max: string | null;
} {
  if (!entries.length) return { min: null, max: null };
  const sorted = sortedLogEntries(entries);
  return {
    min: dateOnly(sorted[0]!.entry_date),
    max: dateOnly(sorted[sorted.length - 1]!.entry_date),
  };
}

export async function assertProjectCodeAvailable(
  client: PoolClient,
  code: string,
): Promise<void> {
  const { rows } = await client.query<{ id: string }>(
    "SELECT id FROM public.project WHERE code = $1 LIMIT 1",
    [code],
  );
  if (rows.length > 0) {
    throw new Error(
      `Project ${code} already exists. Use --force to overwrite (not yet implemented).`,
    );
  }
}

async function resolveOrganizationId(client: PoolClient): Promise<string> {
  const slug =
    process.env.ACTAS_ORGANIZATION_SLUG?.trim() || DEFAULT_ORGANIZATION_SLUG;
  const { rows } = await client.query<{ id: string }>(
    "SELECT id FROM public.organization WHERE slug = $1 LIMIT 1",
    [slug],
  );
  const id = rows[0]?.id;
  if (!id) {
    throw new Error(
      `Organización slug="${slug}" no encontrada. Ejecuta migraciones 004b o crea la org ICAM.`,
    );
  }
  return id;
}

async function insertProject(
  client: PoolClient,
  payload: MondayTransformedPayload,
): Promise<string> {
  const organizationId = await resolveOrganizationId(client);
  const { rows } = await client.query<{ id: string }>(
    `INSERT INTO public.project (code, name, phase, asset_type, status, organization_id)
     VALUES ($1, $2, $3, $4, 'active', $5)
     RETURNING id`,
    [
      payload.project.code,
      payload.project.name,
      DEFAULT_PROJECT_PHASE,
      DEFAULT_PROJECT_ASSET_TYPE,
      organizationId,
    ],
  );
  const id = rows[0]?.id;
  if (!id) throw new Error("INSERT project no devolvió id");
  return id;
}

async function insertProjectModules(
  client: PoolClient,
  projectId: string,
  payload: MondayTransformedPayload,
): Promise<number> {
  let count = 0;
  for (const mod of payload.modules_to_activate) {
    if (!mod.master_module_id) continue;
    await client.query(
      `INSERT INTO public.project_module (project_id, master_module_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [projectId, mod.master_module_id],
    );
    count += 1;
  }
  return count;
}

async function insertCategories(
  client: PoolClient,
  projectId: string,
  payload: MondayTransformedPayload,
  categoryIdMap: Map<string, string>,
): Promise<number> {
  const ordered = [...payload.categories].sort(
    (a, b) => a.order_index - b.order_index || a.id.localeCompare(b.id),
  );
  for (const cat of ordered) {
    const { rows } = await client.query<{ id: string }>(
      `INSERT INTO public.category
         (project_id, master_group_id, name, sublot_label, order_index)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [
        projectId,
        cat.master_group_id,
        cat.name,
        cat.sublot_label,
        cat.order_index,
      ],
    );
    const dbId = rows[0]?.id;
    if (!dbId) throw new Error(`INSERT category falló para ${cat.name}`);
    categoryIdMap.set(cat.id, dbId);
  }
  return ordered.length;
}

async function insertElementRow(
  client: PoolClient,
  el: TransformedElement,
  categoryIdMap: Map<string, string>,
  elementIdMap: Map<string, string>,
  parentDbId: string | null,
): Promise<void> {
  const categoryDbId = categoryIdMap.get(el.category_id);
  if (!categoryDbId) {
    throw new Error(
      `element ${el.id}: category_id ${el.category_id} sin mapear`,
    );
  }

  const { rows } = await client.query<{ id: string }>(
    `INSERT INTO public.element
       (category_id, master_element_id, name, status, timeline_start, timeline_end, parent_element_id, order_index)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id`,
    [
      categoryDbId,
      el.master_element_id,
      el.name,
      el.status,
      el.timeline_start,
      el.timeline_end,
      parentDbId,
      el.order_index,
    ],
  );
  const dbId = rows[0]?.id;
  if (!dbId) throw new Error(`INSERT element falló para ${el.name}`);
  elementIdMap.set(el.id, dbId);
}

async function insertElements(
  client: PoolClient,
  payload: MondayTransformedPayload,
  categoryIdMap: Map<string, string>,
  elementIdMap: Map<string, string>,
): Promise<number> {
  const roots = payload.elements
    .filter((e) => e.parent_element_id == null)
    .sort((a, b) => a.order_index - b.order_index || a.id.localeCompare(b.id));
  const children = payload.elements
    .filter((e) => e.parent_element_id != null)
    .sort((a, b) => a.order_index - b.order_index || a.id.localeCompare(b.id));

  for (const el of roots) {
    await insertElementRow(client, el, categoryIdMap, elementIdMap, null);
  }
  for (const el of children) {
    const parentJsonId = el.parent_element_id!;
    const parentDbId = elementIdMap.get(parentJsonId);
    if (!parentDbId) {
      throw new Error(
        `element ${el.id}: parent_element_id ${parentJsonId} sin mapear (pasada 2)`,
      );
    }
    await insertElementRow(
      client,
      el,
      categoryIdMap,
      elementIdMap,
      parentDbId,
    );
  }

  return roots.length + children.length;
}

async function insertElementOwners(
  client: PoolClient,
  payload: MondayTransformedPayload,
  elementIdMap: Map<string, string>,
): Promise<number> {
  let count = 0;
  for (const row of payload.element_owners) {
    if (!row.user_id) continue;
    const elementDbId = elementIdMap.get(row.element_id);
    if (!elementDbId) {
      throw new Error(
        `element_owner: element_id ${row.element_id} sin mapear`,
      );
    }
    await client.query(
      `INSERT INTO public.element_owner (element_id, user_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [elementDbId, row.user_id],
    );
    count += 1;
  }
  return count;
}

async function insertLogEntryBatch(
  client: PoolClient,
  batch: TransformedLogEntry[],
  elementIdMap: Map<string, string>,
): Promise<number> {
  if (!batch.length) return 0;

  const values: unknown[] = [];
  const tuples: string[] = [];
  let p = 1;

  for (const entry of batch) {
    const elementDbId = elementIdMap.get(entry.element_id);
    if (!elementDbId) {
      throw new Error(
        `log_entry ${entry.id}: element_id ${entry.element_id} sin mapear`,
      );
    }
    tuples.push(
      `($${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++})`,
    );
    values.push(
      elementDbId,
      entry.author_id,
      entry.content,
      entry.status_before,
      entry.status_after,
      entry.entry_date,
    );
  }

  await client.query(
    `INSERT INTO public.log_entry
       (element_id, author_id, content, status_before, status_after, entry_date)
     VALUES ${tuples.join(", ")}`,
    values,
  );

  return batch.length;
}

async function insertLogEntries(
  client: PoolClient,
  payload: MondayTransformedPayload,
  elementIdMap: Map<string, string>,
): Promise<{ count: number; batches: number }> {
  const sorted = sortedLogEntries(payload.log_entries);
  let count = 0;
  let batches = 0;

  for (let i = 0; i < sorted.length; i += LOG_ENTRY_BATCH_SIZE) {
    const batch = sorted.slice(i, i + LOG_ENTRY_BATCH_SIZE);
    count += await insertLogEntryBatch(client, batch, elementIdMap);
    batches += 1;
  }

  return { count, batches };
}

async function executeLoadInTransaction(
  client: PoolClient,
  payload: MondayTransformedPayload,
): Promise<{
  counts: LoadCounts;
  projectId: string;
  logEntryBatches: number;
  categoryIdMap: Map<string, string>;
  elementIdMap: Map<string, string>;
}> {
  const categoryIdMap = new Map<string, string>();
  const elementIdMap = new Map<string, string>();

  const projectId = await insertProject(client, payload);
  const projectModuleCount = await insertProjectModules(
    client,
    projectId,
    payload,
  );
  const categoryCount = await insertCategories(
    client,
    projectId,
    payload,
    categoryIdMap,
  );
  const elementCount = await insertElements(
    client,
    payload,
    categoryIdMap,
    elementIdMap,
  );
  const ownerCount = await insertElementOwners(
    client,
    payload,
    elementIdMap,
  );
  const { count: logCount, batches } = await insertLogEntries(
    client,
    payload,
    elementIdMap,
  );

  return {
    counts: {
      project: 1,
      project_module: projectModuleCount,
      category: categoryCount,
      element: elementCount,
      element_owner: ownerCount,
      log_entry: logCount,
    },
    projectId,
    logEntryBatches: batches,
    categoryIdMap,
    elementIdMap,
  };
}

export interface PostLoadVerification {
  category: number;
  element: number;
  element_owner: number;
  log_entry: number;
  log_entry_null_author: number;
  entry_date_min: string | null;
  entry_date_max: string | null;
}

export async function verifyPostLoad(
  client: PoolClient,
  projectId: string,
  payload: MondayTransformedPayload,
): Promise<PostLoadVerification> {
  const { rows: catRows } = await client.query<{ c: number }>(
    "SELECT count(*)::int AS c FROM public.category WHERE project_id = $1",
    [projectId],
  );

  const { rows: elRows } = await client.query<{ c: number }>(
    `SELECT count(*)::int AS c
     FROM public.element e
     JOIN public.category c ON c.id = e.category_id
     WHERE c.project_id = $1`,
    [projectId],
  );

  const { rows: ownerRows } = await client.query<{ c: number }>(
    `SELECT count(*)::int AS c
     FROM public.element_owner eo
     JOIN public.element e ON e.id = eo.element_id
     JOIN public.category c ON c.id = e.category_id
     WHERE c.project_id = $1`,
    [projectId],
  );

  const { rows: logRows } = await client.query<{ c: number }>(
    `SELECT count(*)::int AS c
     FROM public.log_entry le
     JOIN public.element e ON e.id = le.element_id
     JOIN public.category c ON c.id = e.category_id
     WHERE c.project_id = $1`,
    [projectId],
  );

  const { rows: nullAuthorRows } = await client.query<{ c: number }>(
    `SELECT count(*)::int AS c
     FROM public.log_entry le
     JOIN public.element e ON e.id = le.element_id
     JOIN public.category c ON c.id = e.category_id
     WHERE c.project_id = $1 AND le.author_id IS NULL`,
    [projectId],
  );

  const { rows: dateRows } = await client.query<{
    min: string | null;
    max: string | null;
  }>(
    `SELECT
       min(le.entry_date)::text AS min,
       max(le.entry_date)::text AS max
     FROM public.log_entry le
     JOIN public.element e ON e.id = le.element_id
     JOIN public.category c ON c.id = e.category_id
     WHERE c.project_id = $1`,
    [projectId],
  );

  return {
    category: catRows[0]?.c ?? 0,
    element: elRows[0]?.c ?? 0,
    element_owner: ownerRows[0]?.c ?? 0,
    log_entry: logRows[0]?.c ?? 0,
    log_entry_null_author: nullAuthorRows[0]?.c ?? 0,
    entry_date_min: dateRows[0]?.min ?? null,
    entry_date_max: dateRows[0]?.max ?? null,
  };
}

function comparePostLoad(
  expected: LoadCounts,
  payload: MondayTransformedPayload,
  db: PostLoadVerification,
): string[] {
  const diffs: string[] = [];
  const stats = payload.transform_stats;

  if (db.category !== expected.category) {
    diffs.push(`category: BD=${db.category} esperado=${expected.category}`);
  }
  if (db.element !== expected.element) {
    diffs.push(`element: BD=${db.element} esperado=${expected.element}`);
  }
  if (db.element_owner !== expected.element_owner) {
    diffs.push(
      `element_owner: BD=${db.element_owner} esperado=${expected.element_owner}`,
    );
  }
  if (db.log_entry !== expected.log_entry) {
    diffs.push(`log_entry: BD=${db.log_entry} esperado=${expected.log_entry}`);
  }
  if (db.log_entry !== stats.log_entries_total) {
    diffs.push(
      `log_entry vs transform_stats: BD=${db.log_entry} stats=${stats.log_entries_total}`,
    );
  }
  if (db.element !== stats.elements_total) {
    diffs.push(
      `element vs transform_stats: BD=${db.element} stats=${stats.elements_total}`,
    );
  }

  const expectedNullAuthors = payload.log_entries.filter(
    (e) => e.author_id == null,
  ).length;
  if (db.log_entry_null_author !== expectedNullAuthors) {
    diffs.push(
      `log_entry author_id NULL: BD=${db.log_entry_null_author} JSON=${expectedNullAuthors}`,
    );
  }

  const jsonRange = computeDateRange(payload.log_entries);
  if (db.entry_date_min && jsonRange.min) {
    const dbMin = dateOnly(db.entry_date_min);
    if (dbMin !== jsonRange.min) {
      diffs.push(
        `entry_date min: BD=${dbMin} JSON=${jsonRange.min}`,
      );
    }
  }
  if (db.entry_date_max && jsonRange.max) {
    const dbMax = dateOnly(db.entry_date_max);
    if (dbMax !== jsonRange.max) {
      diffs.push(
        `entry_date max: BD=${dbMax} JSON=${jsonRange.max}`,
      );
    }
  }

  return diffs;
}

export async function runMondayLoad(
  payload: MondayTransformedPayload,
  options: { dryRun: boolean },
): Promise<LoadReport> {
  const projectCode = payload.project.code.trim().toUpperCase();
  const expected = expectedCounts(payload);
  const warnings: string[] = [];
  const jsonChronological = isLogEntriesChronological(payload.log_entries);
  if (!jsonChronological) {
    warnings.push(
      "log_entries en JSON no venían en orden cronológico; se reordenaron por entry_date ASC al insertar.",
    );
  }

  const elementsWithoutLogs = payload.elements.filter(
    (el) => !payload.log_entries.some((le) => le.element_id === el.id),
  );
  if (elementsWithoutLogs.length) {
    warnings.push(
      `${elementsWithoutLogs.length} elemento(s) sin log_entry: ${elementsWithoutLogs.map((e) => e.name).join(", ")}`,
    );
  }

  const pool = getPgPool();
  const client = await pool.connect();

  let inserted: LoadCounts = {
    project: 0,
    project_module: 0,
    category: 0,
    element: 0,
    element_owner: 0,
    log_entry: 0,
  };
  let projectId: string | null = null;
  let logEntryBatches = 0;

  try {
    await assertProjectCodeAvailable(client, projectCode);

    await client.query("BEGIN");

    const result = await executeLoadInTransaction(client, payload);
    inserted = result.counts;
    projectId = result.projectId;
    logEntryBatches = result.logEntryBatches;

    if (options.dryRun) {
      await client.query("ROLLBACK");

      const { rows } = await client.query<{ c: number }>(
        "SELECT count(*)::int AS c FROM public.project WHERE code = $1",
        [projectCode],
      );
      if ((rows[0]?.c ?? 0) > 0) {
        throw new Error(
          `Dry-run: tras ROLLBACK aún existe project.code=${projectCode} (esperado 0 filas persistidas)`,
        );
      }
    } else {
      const dbVerify = await verifyPostLoad(client, projectId, payload);
      const diffs = comparePostLoad(expected, payload, dbVerify);
      if (diffs.length) {
        await client.query("ROLLBACK");
        throw new LoadVerificationError(
          "Verificación post-load falló; transacción revertida.",
          diffs,
        );
      }
      await client.query("COMMIT");
    }
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* connection may already be aborted */
    }
    throw err;
  } finally {
    client.release();
  }

  const nullAuthorLogEntries = payload.log_entries.filter(
    (e) => e.author_id == null,
  ).length;

  return {
    projectCode,
    dryRun: options.dryRun,
    inserted,
    expected,
    transformStats: payload.transform_stats,
    dateRange: computeDateRange(payload.log_entries),
    nullAuthorLogEntries,
    mappedElements: payload.transform_stats.elements_mapped,
    customElements: payload.transform_stats.elements_custom,
    logEntryBatches,
    chronologicalOrderOk: jsonChronological,
    warnings,
    projectId: options.dryRun ? null : projectId,
  };
}

export function printLoadReport(report: LoadReport): void {
  const mode = report.dryRun ? "DRY-RUN (ROLLBACK)" : "LOAD";
  console.log(`\n=== Monday load — ${report.projectCode} [${mode}] ===\n`);

  console.log("Conteos (esperado → insertado en transacción):");
  const rows: [string, number, number][] = [
    ["project", report.expected.project, report.inserted.project],
    [
      "project_module",
      report.expected.project_module,
      report.inserted.project_module,
    ],
    ["category", report.expected.category, report.inserted.category],
    ["element", report.expected.element, report.inserted.element],
    [
      "element_owner",
      report.expected.element_owner,
      report.inserted.element_owner,
    ],
    ["log_entry", report.expected.log_entry, report.inserted.log_entry],
  ];
  for (const [table, exp, got] of rows) {
    const ok = exp === got ? "OK" : "MISMATCH";
    console.log(`  ${table.padEnd(16)} ${String(exp).padStart(5)} → ${String(got).padStart(5)}  ${ok}`);
  }

  console.log("\ntransform_stats:");
  console.log(
    `  elements: ${report.transformStats.elements_total} (${report.mappedElements} mapped + ${report.customElements} custom)`,
  );
  console.log(
    `  log_entries: ${report.transformStats.log_entries_total} (snapshot=${report.transformStats.log_entries_by_source.snapshot}, monday_update=${report.transformStats.log_entries_by_source.monday_update})`,
  );

  console.log("\nlog_entry:");
  console.log(
    `  rango fechas (JSON): ${report.dateRange.min ?? "—"} … ${report.dateRange.max ?? "—"}`,
  );
  console.log(`  author_id NULL: ${report.nullAuthorLogEntries}`);
  console.log(`  lotes insertados: ${report.logEntryBatches} (≤${LOG_ENTRY_BATCH_SIZE}/lote)`);
  console.log(
    `  orden cronológico en JSON: ${report.chronologicalOrderOk ? "sí" : "no (reordenado al cargar)"}`,
  );

  if (report.warnings.length) {
    console.log("\nWarnings:");
    for (const w of report.warnings) {
      console.log(`  - ${w}`);
    }
  }

  if (report.dryRun) {
    console.log(
      "\nROLLBACK confirmado — ninguna fila persistida en la base de datos.",
    );
  } else if (report.projectId) {
    console.log(`\nProyecto creado: project.id = ${report.projectId}`);
  }
}
