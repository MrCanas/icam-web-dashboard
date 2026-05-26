import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  MONDAY_TRANSFORMED_DIR,
  type ElementStatus,
  type MondayTransformedPayload,
  type TransformedElement,
  type TransformedLogEntry,
} from "./monday-transform";

const VALID_ELEMENT_STATUSES = new Set<ElementStatus>([
  "not_started",
  "working_on_it",
  "stuck",
  "done",
]);

const MAX_ERROR_SAMPLES = 8;

export interface ValidationIssue {
  check: string;
  message: string;
  sample?: string;
}

export interface ValidationWarning {
  check: string;
  message: string;
  sample?: string;
}

export interface ValidationResult {
  projectCode: string;
  payload: MondayTransformedPayload;
  errors: ValidationIssue[];
  warnings: ValidationWarning[];
  errorCount: number;
  passed: boolean;
}

export function loadTransformedPayload(path: string): MondayTransformedPayload {
  const raw = JSON.parse(readFileSync(path, "utf8")) as MondayTransformedPayload;
  if (!raw.project?.code || !Array.isArray(raw.elements)) {
    throw new Error(`${path}: JSON transformado inválido`);
  }
  return raw;
}

export function transformedPath(projectCode: string): string {
  return resolve(
    MONDAY_TRANSFORMED_DIR,
    `${projectCode.trim().toUpperCase()}.json`,
  );
}

export function validationReportPath(projectCode: string): string {
  return resolve(
    process.cwd(),
    "docs/actas",
    `11-validation-${projectCode.trim().toUpperCase()}.md`,
  );
}

function recordError(
  errors: ValidationIssue[],
  counters: { errorCount: number },
  check: string,
  message: string,
  sample?: string,
): void {
  counters.errorCount += 1;
  const samples = errors.filter((e) => e.check === check).length;
  if (samples >= MAX_ERROR_SAMPLES) return;
  errors.push({ check, message, sample });
}

function isValidIso8601(value: string): boolean {
  const v = value.trim();
  if (!v) return false;
  const t = Date.parse(v);
  return !Number.isNaN(t);
}

function logEntryStatusPairValid(
  before: string | null,
  after: string | null,
): boolean {
  if (before == null && after == null) return true;
  if (before != null && after != null) return true;
  return false;
}

async function fetchAllTableIds(
  supabase: SupabaseClient,
  table: "master_element" | "master_group",
): Promise<Set<string>> {
  const ids = new Set<string>();
  const pageSize = 1000;
  let from = 0;

  for (;;) {
    const { data, error } = await supabase
      .from(table)
      .select("id")
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    const rows = data ?? [];
    for (const row of rows) {
      ids.add(row.id as string);
    }
    if (rows.length < pageSize) break;
    from += pageSize;
  }

  return ids;
}

async function fetchAllAuthUserIds(
  supabase: SupabaseClient,
): Promise<Set<string>> {
  const ids = new Set<string>();
  let page = 1;
  const perPage = 200;

  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage,
    });
    if (error) throw new Error(`auth.users: ${error.message}`);
    for (const u of data.users) {
      ids.add(u.id);
    }
    if (data.users.length < perPage) break;
    page += 1;
  }

  return ids;
}

function validateInMemoryRefs(
  payload: MondayTransformedPayload,
  errors: ValidationIssue[],
  counters: { errorCount: number },
): void {
  const elementIds = new Set(payload.elements.map((e) => e.id));
  const categoryIds = new Set(payload.categories.map((c) => c.id));
  const elementById = new Map(payload.elements.map((e) => [e.id, e]));

  for (const le of payload.log_entries) {
    if (!elementIds.has(le.element_id)) {
      recordError(
        errors,
        counters,
        "1_log_entry_element_id",
        `log_entry ${le.id} referencia element_id inexistente`,
        le.element_id,
      );
    }
  }

  for (const el of payload.elements) {
    if (!categoryIds.has(el.category_id)) {
      recordError(
        errors,
        counters,
        "2_element_category_id",
        `element ${el.id} (${el.monday_item_name}) referencia category_id inexistente`,
        el.category_id,
      );
    }

    if (el.parent_element_id != null) {
      const parent = elementById.get(el.parent_element_id);
      if (!parent) {
        recordError(
          errors,
          counters,
          "3_element_parent_element_id",
          `element ${el.id} referencia parent_element_id inexistente`,
          el.parent_element_id,
        );
      }
    }
  }
}

function validateMasterRefs(
  payload: MondayTransformedPayload,
  masterElementIds: Set<string>,
  masterGroupIds: Set<string>,
  errors: ValidationIssue[],
  counters: { errorCount: number },
): void {
  for (const el of payload.elements) {
    if (
      el.master_element_id != null &&
      !masterElementIds.has(el.master_element_id)
    ) {
      recordError(
        errors,
        counters,
        "4_element_master_element_id",
        `element ${el.id} (${el.monday_item_name}) master_element_id no está en catálogo`,
        el.master_element_id,
      );
    }
  }

  for (const cat of payload.categories) {
    if (
      cat.master_group_id != null &&
      !masterGroupIds.has(cat.master_group_id)
    ) {
      recordError(
        errors,
        counters,
        "5_category_master_group_id",
        `category ${cat.id} (${cat.name}) master_group_id no está en catálogo`,
        cat.master_group_id,
      );
    }
  }
}

function validateAuthRefs(
  payload: MondayTransformedPayload,
  authUserIds: Set<string>,
  errors: ValidationIssue[],
  counters: { errorCount: number },
): void {
  for (const le of payload.log_entries) {
    if (le.author_id == null) continue;
    if (!authUserIds.has(le.author_id)) {
      recordError(
        errors,
        counters,
        "6_log_entry_author_id",
        `log_entry ${le.id} author_id no existe en auth.users`,
        le.author_id,
      );
    }
  }

  for (const eo of payload.element_owners) {
    if (eo.user_id == null) continue;
    if (!authUserIds.has(eo.user_id)) {
      recordError(
        errors,
        counters,
        "7_element_owner_user_id",
        `element_owner user_id no existe en auth.users`,
        eo.user_id,
      );
    }
  }
}

function validateSqlConstraints(
  payload: MondayTransformedPayload,
  errors: ValidationIssue[],
  counters: { errorCount: number },
): void {
  for (const le of payload.log_entries) {
    if (!logEntryStatusPairValid(le.status_before, le.status_after)) {
      recordError(
        errors,
        counters,
        "8_log_entry_status_pair",
        `log_entry ${le.id} viola par status (before=${le.status_before}, after=${le.status_after})`,
      );
    }
    if (
      le.status_before != null &&
      !VALID_ELEMENT_STATUSES.has(le.status_before as ElementStatus)
    ) {
      recordError(
        errors,
        counters,
        "8_log_entry_status_pair",
        `log_entry ${le.id} status_before inválido: ${le.status_before}`,
      );
    }
    if (
      le.status_after != null &&
      !VALID_ELEMENT_STATUSES.has(le.status_after as ElementStatus)
    ) {
      recordError(
        errors,
        counters,
        "8_log_entry_status_pair",
        `log_entry ${le.id} status_after inválido: ${le.status_after}`,
      );
    }
  }

  for (const el of payload.elements) {
    if (!VALID_ELEMENT_STATUSES.has(el.status)) {
      recordError(
        errors,
        counters,
        "9_element_status",
        `element ${el.id} (${el.monday_item_name}) status inválido: ${el.status}`,
      );
    }
  }

  for (const le of payload.log_entries) {
    if (!isValidIso8601(le.entry_date)) {
      recordError(
        errors,
        counters,
        "10_iso_dates",
        `log_entry ${le.id} entry_date no ISO 8601`,
        le.entry_date,
      );
    }
  }

  for (const el of payload.elements) {
    if (el.timeline_start != null && !isValidIso8601(el.timeline_start)) {
      recordError(
        errors,
        counters,
        "10_iso_dates",
        `element ${el.id} timeline_start no ISO 8601`,
        el.timeline_start,
      );
    }
    if (el.timeline_end != null && !isValidIso8601(el.timeline_end)) {
      recordError(
        errors,
        counters,
        "10_iso_dates",
        `element ${el.id} timeline_end no ISO 8601`,
        el.timeline_end,
      );
    }
  }
}

function collectWarnings(
  payload: MondayTransformedPayload,
  warnings: ValidationWarning[],
): void {
  const entryCountByElement = new Map<string, number>();
  for (const le of payload.log_entries) {
    entryCountByElement.set(
      le.element_id,
      (entryCountByElement.get(le.element_id) ?? 0) + 1,
    );
  }

  const withoutEntries = payload.elements.filter(
    (e) => !entryCountByElement.has(e.id),
  );
  if (withoutEntries.length) {
    warnings.push({
      check: "13_elements_without_log_entries",
      message: `${withoutEntries.length} elemento(s) sin ninguna log_entry`,
      sample: withoutEntries
        .slice(0, 5)
        .map((e) => e.monday_item_name)
        .join(", "),
    });
  }
}

function monthKeyFromEntryDate(entryDate: string): string | null {
  const d = new Date(entryDate);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function buildInformativeMarkdown(
  payload: MondayTransformedPayload,
  warnings: ValidationWarning[],
  failed: boolean,
  errorCount: number,
): string {
  const projectCode = payload.project.code;
  const generatedAt = new Date().toISOString();
  const lines: string[] = [
    `# Validación pre-load — ${projectCode}`,
    "",
    `Generado: ${generatedAt}`,
    "",
    `Origen: \`tmp/monday-transformed/${projectCode}.json\``,
    "",
    "## Resultado",
    "",
  ];

  if (failed) {
    lines.push(
      `**FALLO** — ${errorCount} error(es) en checks 1–10 (ver consola).`,
    );
  } else {
    lines.push("**OK** — checks 1–10 pasados.");
  }

  if (warnings.length) {
    lines.push(
      "",
      `**Warnings:** ${warnings.length}`,
      "",
      ...warnings.map((w) => `- **${w.check}**: ${w.message}${w.sample ? ` (_${w.sample}_)` : ""}`),
    );
  }

  lines.push("", "## 11. Elementos mapped vs custom por categoría", "");
  lines.push("| Categoría | Mapped | Custom | Total |");
  lines.push("|-----------|-------:|-------:|------:|");

  const categoryById = new Map(payload.categories.map((c) => [c.id, c]));
  const byCategory = new Map<
    string,
    { mapped: number; custom: number; name: string }
  >();

  for (const el of payload.elements) {
    const cat = categoryById.get(el.category_id);
    const name = cat?.name ?? el.category_id;
    const row = byCategory.get(el.category_id) ?? {
      mapped: 0,
      custom: 0,
      name,
    };
    if (el.master_element_id) row.mapped += 1;
    else row.custom += 1;
    byCategory.set(el.category_id, row);
  }

  for (const row of [...byCategory.values()].sort((a, b) =>
    a.name.localeCompare(b.name, "es"),
  )) {
    const total = row.mapped + row.custom;
    lines.push(`| ${row.name} | ${row.mapped} | ${row.custom} | ${total} |`);
  }

  lines.push("", "## 12. Top 10 elementos por log_entries", "");
  const entryCountByElement = new Map<string, number>();
  for (const le of payload.log_entries) {
    entryCountByElement.set(
      le.element_id,
      (entryCountByElement.get(le.element_id) ?? 0) + 1,
    );
  }
  const elementById = new Map(payload.elements.map((e) => [e.id, e]));
  const top10 = [...entryCountByElement.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  if (!top10.length) {
    lines.push("_Sin log_entries._");
  } else {
    lines.push("| # | Elemento | Categoría | Entradas |");
    lines.push("|---|----------|-----------|----------:|");
    top10.forEach(([id, count], i) => {
      const el = elementById.get(id);
      const catName = el
        ? (categoryById.get(el.category_id)?.name ?? "—")
        : "—";
      lines.push(
        `| ${i + 1} | ${el?.monday_item_name ?? id} | ${catName} | ${count} |`,
      );
    });
  }

  lines.push("", "## 13. Elementos sin log_entry", "");
  const withoutEntries = payload.elements.filter(
    (e) => !entryCountByElement.has(e.id),
  );
  if (!withoutEntries.length) {
    lines.push("_Ninguno._");
  } else {
    lines.push(
      `**${withoutEntries.length}** elemento(s) — puede ser ruido o ítems sin columna Texto:`,
      "",
    );
    for (const el of withoutEntries) {
      const catName = categoryById.get(el.category_id)?.name ?? "—";
      lines.push(`- ${el.monday_item_name} (${catName})`);
    }
  }

  lines.push("", "## 14. Cambios de estado por elemento", "");
  const statusChanges: {
    element: TransformedElement;
    changes: { before: string; after: string; date: string }[];
  }[] = [];

  for (const el of payload.elements) {
    const changes = payload.log_entries
      .filter(
        (le) =>
          le.element_id === el.id &&
          le.status_before != null &&
          le.status_after != null &&
          le.status_before !== le.status_after,
      )
      .map((le) => ({
        before: le.status_before!,
        after: le.status_after!,
        date: le.entry_date,
      }));
    if (changes.length) statusChanges.push({ element: el, changes });
  }

  if (!statusChanges.length) {
    lines.push("_Ningún cambio de estado registrado en log_entries._");
  } else {
    lines.push(`**${statusChanges.length}** elemento(s) con al menos un cambio:`, "");
    for (const { element, changes } of statusChanges) {
      lines.push(`### ${element.monday_item_name}`, "");
      for (const c of changes) {
        lines.push(
          `- ${c.date.slice(0, 10)}: \`${c.before}\` → \`${c.after}\``,
        );
      }
      lines.push("");
    }
  }

  lines.push("## 15. Authors únicos", "");
  const byAuthor = new Map<string, number>();
  let nullAuthors = 0;
  for (const le of payload.log_entries) {
    if (le.author_id == null) {
      nullAuthors += 1;
      continue;
    }
    byAuthor.set(le.author_id, (byAuthor.get(le.author_id) ?? 0) + 1);
  }
  lines.push(`| author_id | log_entries |`);
  lines.push("|-----------|------------:|");
  for (const [id, count] of [...byAuthor.entries()].sort((a, b) => b[1] - a[1])) {
    lines.push(`| \`${id}\` | ${count} |`);
  }
  if (nullAuthors) {
    lines.push("", `_Además ${nullAuthors} log_entry(s) con author_id null._`);
  }

  lines.push("", "## 16. Distribución de log_entries por mes", "");
  const byMonth = new Map<string, number>();
  for (const le of payload.log_entries) {
    const mk = monthKeyFromEntryDate(le.entry_date);
    if (!mk) continue;
    byMonth.set(mk, (byMonth.get(mk) ?? 0) + 1);
  }
  const months = [...byMonth.keys()].sort();
  if (!months.length) {
    lines.push("_Sin fechas parseables._");
  } else {
    lines.push("| Mes | Entradas |");
    lines.push("|-----|----------:|");
    for (const m of months) {
      lines.push(`| ${m} | ${byMonth.get(m)} |`);
    }
    const gaps: string[] = [];
    for (let i = 1; i < months.length; i++) {
      const prev = months[i - 1]!;
      const curr = months[i]!;
      const [py, pm] = prev.split("-").map(Number);
      const [cy, cm] = curr.split("-").map(Number);
      let y = py;
      let m = pm! + 1;
      if (m > 12) {
        m = 1;
        y += 1;
      }
      const expected = `${y}-${String(m).padStart(2, "0")}`;
      if (expected !== curr) {
        gaps.push(`hueco entre ${prev} y ${curr}`);
      }
    }
    if (gaps.length) {
      lines.push("", "**Huecos temporales detectados:**", "");
      for (const g of gaps) lines.push(`- ${g}`);
    } else {
      lines.push("", "_Serie mensual continua (sin huecos entre primer y último mes)._");
    }
  }

  lines.push("", "## Resumen transform_stats", "");
  lines.push("```json");
  lines.push(JSON.stringify(payload.transform_stats, null, 2));
  lines.push("```");
  lines.push("");

  return lines.join("\n");
}

export async function validateTransformedPayload(
  payload: MondayTransformedPayload,
  supabase: SupabaseClient,
): Promise<ValidationResult> {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationWarning[] = [];
  const counters = { errorCount: 0 };
  const projectCode = payload.project.code.trim().toUpperCase();

  validateInMemoryRefs(payload, errors, counters);
  validateSqlConstraints(payload, errors, counters);

  const [masterElementIds, masterGroupIds, authUserIds] = await Promise.all([
    fetchAllTableIds(supabase, "master_element"),
    fetchAllTableIds(supabase, "master_group"),
    fetchAllAuthUserIds(supabase),
  ]);

  validateMasterRefs(payload, masterElementIds, masterGroupIds, errors, counters);
  validateAuthRefs(payload, authUserIds, errors, counters);
  collectWarnings(payload, warnings);

  return {
    projectCode,
    payload,
    errors,
    warnings,
    errorCount: counters.errorCount,
    passed: counters.errorCount === 0,
  };
}

export function printValidationErrors(result: ValidationResult): void {
  if (!result.errorCount) {
    console.log("\nChecks 1–10: OK");
    return;
  }

  console.error(
    `\nValidación FALLIDA — ${result.errorCount} error(es) (${result.errors.length} muestras):\n`,
  );
  const byCheck = new Map<string, ValidationIssue[]>();
  for (const e of result.errors) {
    const list = byCheck.get(e.check) ?? [];
    list.push(e);
    byCheck.set(e.check, list);
  }
  for (const [check, issues] of [...byCheck.entries()].sort()) {
    console.error(`[${check}]`);
    for (const i of issues) {
      console.error(`  - ${i.message}${i.sample ? ` (${i.sample})` : ""}`);
    }
  }
}

export function writeValidationReport(
  result: ValidationResult,
  projectCode: string,
): string {
  const outPath = validationReportPath(projectCode);
  mkdirSync(resolve(process.cwd(), "docs/actas"), { recursive: true });
  const md = buildInformativeMarkdown(
    result.payload,
    result.warnings,
    !result.passed,
    result.errorCount,
  );
  writeFileSync(outPath, md, "utf8");
  return outPath;
}
