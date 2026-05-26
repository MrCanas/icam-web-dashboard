import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  extractProjectFromMonday,
  MONDAY_EXTRACTS_DIR,
  writeMondayExtract,
} from "./monday-extract";
import { closePgPool, getPgPool } from "./db";
import {
  LoadVerificationError,
  runMondayLoad,
  type LoadReport,
} from "./monday-load";
import { discoverProjectCodes } from "./monday-discovery";
import {
  loadTransformedPayload,
  validateTransformedPayload,
  writeValidationReport,
  type ValidationResult,
  type ValidationWarning,
} from "./monday-validate";
import {
  loadElementMappingFile,
  loadMasterModuleIds,
  loadMondayExtractFile,
  loadUserMappingFile,
  MONDAY_TRANSFORMED_DIR,
  transformMondayExtract,
  writeMondayTransformed,
  type MondayTransformedPayload,
  type TransformStats,
} from "./monday-transform";
import { createActasServerClient } from "./supabase-server";

export type MigratePipelineStep =
  | "extract"
  | "transform"
  | "validate"
  | "dry-run"
  | "load";

export class MigrateAllBatchAbortError extends Error {
  constructor(
    readonly projectCode: string,
    readonly step: MigratePipelineStep,
    readonly cause: unknown,
    readonly partialResult: MigrateAllResult | null = null,
  ) {
    const detail =
      cause instanceof Error ? cause.message : String(cause ?? "error desconocido");
    super(
      `Batch abortado en proyecto ${projectCode} (paso: ${step}): ${detail}`,
    );
    this.name = "MigrateAllBatchAbortError";
  }
}

export interface ProjectStagingReport {
  code: string;
  extractPath: string;
  transformedPath: string;
  validationReportPath: string;
  transformStats: TransformStats;
  validationWarnings: ValidationWarning[];
  loadDryRun: LoadReport;
  dateRange: { min: string | null; max: string | null };
}

export interface ProjectLoadReport {
  code: string;
  projectId: string;
  loadReport: LoadReport;
}

export interface MigrateAllResult {
  workspaceId: string;
  detected: string[];
  existingInDb: string[];
  pending: string[];
  skippedExisting: string[];
  staged: ProjectStagingReport[];
  loaded: ProjectLoadReport[];
  stagingAbortedAt: string | null;
  stagingError: string | null;
  loadAbortedAt: string | null;
  loadError: string | null;
  realLoadConfirmed: boolean;
  startedAt: string;
  finishedAt: string;
}

const MIGRATION_SUMMARY_PATH = resolve(
  process.cwd(),
  "docs/actas/12-migration-summary.md",
);

const ELEMENT_MAPPING_PATH = resolve(
  process.cwd(),
  "docs/actas/07-element-mapping.json",
);
const USER_MAPPING_PATH = resolve(
  process.cwd(),
  "docs/actas/06-user-mapping.json",
);

export async function fetchExistingProjectCodes(): Promise<Set<string>> {
  const { rows } = await getPgPool().query<{ code: string }>(
    "SELECT code FROM public.project ORDER BY code",
  );
  return new Set(rows.map((r) => r.code.trim().toUpperCase()));
}

function dateRangeFromPayload(
  payload: MondayTransformedPayload,
): { min: string | null; max: string | null } {
  if (!payload.log_entries.length) return { min: null, max: null };
  const sorted = [...payload.log_entries].sort((a, b) =>
    a.entry_date.localeCompare(b.entry_date),
  );
  return {
    min: sorted[0]!.entry_date.slice(0, 10),
    max: sorted[sorted.length - 1]!.entry_date.slice(0, 10),
  };
}

function loadCountsMismatch(report: LoadReport): boolean {
  return Object.entries(report.expected).some(
    ([key, exp]) =>
      report.inserted[key as keyof typeof report.inserted] !== exp,
  );
}

async function transformExtractForProject(
  extractPath: string,
  projectCode: string,
): Promise<{ payload: MondayTransformedPayload; path: string }> {
  const extract = loadMondayExtractFile(extractPath);
  const elementMapping = loadElementMappingFile(ELEMENT_MAPPING_PATH);
  const userMappings = loadUserMappingFile(USER_MAPPING_PATH);

  let masterModuleIdsByName = new Map<string, string>();
  try {
    const supabase = createActasServerClient();
    masterModuleIdsByName = await loadMasterModuleIds(supabase);
  } catch {
    /* modules_to_activate con master_module_id null */
  }

  const payload = transformMondayExtract(extract, {
    userMappings,
    groupMappings: elementMapping.groups,
    elementsUnique: elementMapping.elements_unique,
    masterModuleIdsByName,
  });

  if (payload.project.code.trim().toUpperCase() !== projectCode) {
    throw new Error(
      `Transform devolvió project.code=${payload.project.code}, esperado ${projectCode}`,
    );
  }

  const path = writeMondayTransformed(payload, projectCode);
  return { payload, path };
}

export async function runProjectStagingPipeline(
  workspaceId: string,
  projectCode: string,
): Promise<ProjectStagingReport> {
  const code = projectCode.trim().toUpperCase();
  console.log(`\n── ${code} ──`);
  console.log("  extract…");

  let extractPath: string;
  try {
    const extractPayload = await extractProjectFromMonday(workspaceId, code, {
      onBoardProgress: (current, total, name) => {
        console.log(`    tablero ${current}/${total}: ${name.slice(0, 55)}…`);
      },
    });
    extractPath = writeMondayExtract(extractPayload, code);
  } catch (err) {
    throw new MigrateAllBatchAbortError(code, "extract", err);
  }

  console.log("  transform…");
  let transformedPath: string;
  let payload: MondayTransformedPayload;
  try {
    const out = await transformExtractForProject(extractPath, code);
    transformedPath = out.path;
    payload = out.payload;
  } catch (err) {
    throw new MigrateAllBatchAbortError(code, "transform", err);
  }

  console.log("  validate…");
  let validation: ValidationResult;
  try {
    const supabase = createActasServerClient();
    validation = await validateTransformedPayload(payload, supabase);
    writeValidationReport(validation, code);
  } catch (err) {
    throw new MigrateAllBatchAbortError(code, "validate", err);
  }

  if (!validation.passed) {
    throw new MigrateAllBatchAbortError(
      code,
      "validate",
      new Error(
        `${validation.errorCount} error(es) de validación — ver docs/actas/11-validation-${code}.md`,
      ),
    );
  }

  console.log("  dry-run load…");
  let loadDryRun: LoadReport;
  try {
    loadDryRun = await runMondayLoad(payload, { dryRun: true });
  } catch (err) {
    throw new MigrateAllBatchAbortError(code, "dry-run", err);
  }

  if (loadCountsMismatch(loadDryRun)) {
    throw new MigrateAllBatchAbortError(
      code,
      "dry-run",
      new Error("Conteos dry-run ≠ esperados (insertado vs JSON)"),
    );
  }

  console.log(
    `  OK — snapshots=${payload.transform_stats.snapshots_processed} elements=${payload.transform_stats.elements_total} log_entries=${payload.transform_stats.log_entries_total}`,
  );

  return {
    code,
    extractPath,
    transformedPath,
    validationReportPath: resolve(
      process.cwd(),
      "docs/actas",
      `11-validation-${code}.md`,
    ),
    transformStats: payload.transform_stats,
    validationWarnings: validation.warnings,
    loadDryRun,
    dateRange: loadDryRun.dateRange,
  };
}

export async function runProjectRealLoad(
  projectCode: string,
): Promise<ProjectLoadReport> {
  const code = projectCode.trim().toUpperCase();
  const jsonPath = resolve(MONDAY_TRANSFORMED_DIR, `${code}.json`);
  const payload = loadTransformedPayload(jsonPath);

  const loadReport = await runMondayLoad(payload, { dryRun: false });

  if (loadCountsMismatch(loadReport)) {
    throw new Error("Verificación post-load: conteos ≠ esperados");
  }

  if (!loadReport.projectId) {
    throw new Error("Load real sin project.id en el reporte");
  }

  return { code, projectId: loadReport.projectId, loadReport };
}

export function printDiscoveryReport(
  detected: string[],
  existingInDb: Set<string>,
  pending: string[],
): void {
  const skipped = detected.filter((c) => existingInDb.has(c));

  console.log("\n=== Discovery (Fase 1) ===\n");
  console.log(`Detectados en Monday (${detected.length}):`);
  console.log(`  ${detected.join(", ") || "—"}`);
  console.log(`\nYa en Supabase (${skipped.length}):`);
  console.log(`  ${skipped.join(", ") || "—"}`);
  console.log(`\nPendientes de migrar (${pending.length}):`);
  console.log(`  ${pending.join(", ") || "—"}`);
}

export function printStagingSummaryTable(reports: ProjectStagingReport[]): void {
  console.log("\n=== Resumen staging (Fase 2) ===\n");
  const header = [
    "code".padEnd(8),
    "snapshots".padStart(10),
    "elements".padStart(10),
    "log_entries".padStart(12),
    "warnings".padStart(10),
  ].join(" | ");
  console.log(header);
  console.log("-".repeat(header.length));

  for (const r of reports) {
    const row = [
      r.code.padEnd(8),
      String(r.transformStats.snapshots_processed).padStart(10),
      String(r.transformStats.elements_total).padStart(10),
      String(r.transformStats.log_entries_total).padStart(12),
      String(r.validationWarnings.length).padStart(10),
    ].join(" | ");
    console.log(row);
  }
}

function warningLines(warnings: ValidationWarning[]): string[] {
  if (!warnings.length) return ["_Ninguno._"];
  return warnings.map((w) => `- **${w.check}**: ${w.message}`);
}

export function writeMigrationSummary(result: MigrateAllResult): string {
  mkdirSync(resolve(process.cwd(), "docs/actas"), { recursive: true });

  const lines: string[] = [
    "# Resumen migración Monday → Supabase (P3.5)",
    "",
    `**Generado:** ${result.finishedAt}`,
    `**Workspace Actas:** \`${result.workspaceId}\``,
    "",
    "## Totales",
    "",
    `| Métrica | Valor |`,
    `| --- | --- |`,
    `| Proyectos detectados (Monday) | ${result.detected.length} |`,
    `| Ya existentes en BD (omitidos) | ${result.skippedExisting.length} |`,
    `| Pendientes al inicio | ${result.pending.length} |`,
    `| Staging completado (extract+transform+validate+dry-run) | ${result.staged.length} |`,
    `| Carga real confirmada | ${result.realLoadConfirmed ? "sí" : "no"} |`,
    `| Cargados en BD (esta ejecución) | ${result.loaded.length} |`,
    `| Fallo en carga real | ${result.loadAbortedAt ?? "—"} |`,
    "",
  ];

  if (result.skippedExisting.length) {
    lines.push("### Códigos ya existentes (skipped)", "");
    lines.push(result.skippedExisting.map((c) => `\`${c}\``).join(", "));
    lines.push("");
  }

  if (result.staged.length) {
    lines.push("## Por proyecto (staging)", "");
    lines.push(
      "| code | snapshots | elements | log_entries | fechas | warnings validate |",
    );
    lines.push("| --- | ---: | ---: | ---: | --- | ---: |");
    for (const r of result.staged) {
      const dates =
        r.dateRange.min && r.dateRange.max
          ? `${r.dateRange.min} … ${r.dateRange.max}`
          : "—";
      lines.push(
        `| ${r.code} | ${r.transformStats.snapshots_processed} | ${r.transformStats.elements_total} | ${r.transformStats.log_entries_total} | ${dates} | ${r.validationWarnings.length} |`,
      );
    }
    lines.push("");

    for (const r of result.staged) {
      lines.push(`### ${r.code}`, "");
      lines.push(
        `- Extract: \`${r.extractPath}\``,
        `- Transformado: \`${r.transformedPath}\``,
        `- Validación: \`${r.validationReportPath}\``,
        `- Elementos: ${r.transformStats.elements_mapped} mapped + ${r.transformStats.elements_custom} custom`,
        `- log_entry author_id NULL: ${r.loadDryRun.nullAuthorLogEntries}`,
        "",
        "**Warnings validación:**",
        "",
        ...warningLines(r.validationWarnings),
        "",
      );
      if (r.loadDryRun.warnings.length) {
        lines.push("**Warnings load (dry-run):**", "");
        for (const w of r.loadDryRun.warnings) {
          lines.push(`- ${w}`);
        }
        lines.push("");
      }
    }
  }

  if (result.loaded.length) {
    lines.push("## Carga real (Fase 4)", "");
    lines.push("| code | project.id | log_entries | fechas |", "| --- | --- | ---: | --- |");
    for (const r of result.loaded) {
      const dr = r.loadReport.dateRange;
      const dates =
        dr.min && dr.max ? `${dr.min} … ${dr.max}` : "—";
      lines.push(
        `| ${r.code} | \`${r.projectId}\` | ${r.loadReport.inserted.log_entry} | ${dates} |`,
      );
    }
    lines.push("");
  }

  if (result.stagingAbortedAt) {
    lines.push("## Fallo en staging (Fase 2)", "");
    lines.push(`- **Proyecto:** \`${result.stagingAbortedAt}\``);
    lines.push(`- **Error:** ${result.stagingError ?? "—"}`);
    lines.push(
      `- **Staging completado antes del fallo:** ${result.staged.map((r) => r.code).join(", ") || "—"}`,
    );
    lines.push("", "_Batch abortado; no se ejecutó carga real._", "");
  }

  if (result.loadAbortedAt) {
    lines.push("## Fallo en carga real", "");
    lines.push(`- **Proyecto:** \`${result.loadAbortedAt}\``);
    lines.push(`- **Error:** ${result.loadError ?? "—"}`);
    lines.push(
      `- **Cargados antes del fallo:** ${result.loaded.map((r) => r.code).join(", ") || "—"}`,
    );
    lines.push(
      `- **Sin tocar (restantes):** ${result.pending
        .filter(
          (c) =>
            !result.loaded.some((l) => l.code === c) &&
            c !== result.loadAbortedAt,
        )
        .join(", ") || "—"}`,
    );
    lines.push("", "_Intervención manual requerida antes de reintentar el batch._", "");
  }

  const md = `${lines.join("\n")}\n`;
  writeFileSync(MIGRATION_SUMMARY_PATH, md, "utf8");
  return MIGRATION_SUMMARY_PATH;
}

export async function runMigrateAllPhases(options: {
  workspaceId: string;
  skipConfirmations: boolean;
  askFn: (question: string) => Promise<boolean>;
}): Promise<MigrateAllResult> {
  const startedAt = new Date().toISOString();
  const { workspaceId, skipConfirmations, askFn } = options;

  console.log("Fase 1 — Discovery (Monday workspace)…");
  const detected = await discoverProjectCodes(workspaceId);
  const existingInDb = await fetchExistingProjectCodes();
  const pending = detected.filter((c) => !existingInDb.has(c));
  const skippedExisting = detected.filter((c) => existingInDb.has(c));

  printDiscoveryReport(detected, existingInDb, pending);

  const result: MigrateAllResult = {
    workspaceId,
    detected,
    existingInDb: [...existingInDb].sort((a, b) => a.localeCompare(b, "es")),
    pending,
    skippedExisting,
    staged: [],
    loaded: [],
    loadAbortedAt: null,
    loadError: null,
    realLoadConfirmed: false,
    startedAt,
    finishedAt: startedAt,
  };

  if (!pending.length) {
    console.log("\nNo hay proyectos pendientes. Exit 0.");
    result.finishedAt = new Date().toISOString();
    return result;
  }

  if (
    !skipConfirmations &&
    !(await askFn(
      `¿Continuar con extract+transform+validate+dry-run para ${pending.length} proyecto(s)?`,
    ))
  ) {
    console.log("\nCancelado antes de Fase 2. Exit 0.");
    result.finishedAt = new Date().toISOString();
    return result;
  }

  console.log("\nFase 2 — Extract + Transform + Validate + Dry-run…");

  for (const code of pending) {
    try {
      const report = await runProjectStagingPipeline(workspaceId, code);
      result.staged.push(report);
    } catch (err) {
      result.stagingAbortedAt = code;
      result.stagingError =
        err instanceof Error ? err.message : String(err ?? "error");
      result.finishedAt = new Date().toISOString();
      if (err instanceof MigrateAllBatchAbortError) {
        throw new MigrateAllBatchAbortError(
          err.projectCode,
          err.step,
          err.cause,
          result,
        );
      }
      throw new MigrateAllBatchAbortError(code, "extract", err, result);
    }
  }

  printStagingSummaryTable(result.staged);

  if (
    !skipConfirmations &&
    !(await askFn(`¿Lanzar carga real para los ${pending.length} proyectos?`))
  ) {
    console.log(
      "\nCarga real omitida. Artefactos en tmp/monday-extracts y tmp/monday-transformed.",
    );
    result.finishedAt = new Date().toISOString();
    return result;
  }

  result.realLoadConfirmed = true;
  console.log("\nFase 4 — Carga real…");

  for (const code of pending) {
    console.log(`\n── load ${code} ──`);
    try {
      const loadReport = await runProjectRealLoad(code);
      result.loaded.push(loadReport);
      console.log(`  OK — project.id=${loadReport.projectId}`);
    } catch (err) {
      result.loadAbortedAt = code;
      result.loadError =
        err instanceof Error ? err.message : String(err ?? "error");
      const loadedCodes = result.loaded.map((r) => r.code);
      const remaining = pending.filter(
        (c) => !loadedCodes.includes(c) && c !== code,
      );
      console.error(
        `\nBatch de carga abortado en ${code}: ${result.loadError}`,
      );
      console.error(
        `${loadedCodes.length} proyecto(s) cargados antes del fallo: ${loadedCodes.join(", ") || "—"}`,
      );
      console.error(
        `${remaining.length} restante(s) sin tocar: ${remaining.join(", ") || "—"}`,
      );
      console.error("Intervención manual requerida.");
      result.finishedAt = new Date().toISOString();
      return result;
    }
  }

  result.finishedAt = new Date().toISOString();
  return result;
}

export function migrationSummaryPath(): string {
  return MIGRATION_SUMMARY_PATH;
}

export async function shutdownMigrateAll(): Promise<void> {
  await closePgPool();
}
