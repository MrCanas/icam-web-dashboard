/**
 * Re-transform proyectos con entry_date corregido y genera docs/actas/10-rerun-sanity.md
 */
import { config } from "dotenv";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { MONDAY_EXTRACTS_DIR } from "./lib/monday-extract";
import {
  loadElementMappingFile,
  loadMondayExtractFile,
  loadUserMappingFile,
  MONDAY_TRANSFORMED_DIR,
  MONDAY_TRANSFORMED_FIX_DIR,
  transformMondayExtract,
  type MondayTransformedPayload,
  type TransformedLogEntry,
  writeMondayTransformed,
} from "./lib/monday-transform";

config({ path: resolve(process.cwd(), ".env.local") });

const PROJECTS = ["CA1", "CSP10", "PC25", "VBARE", "VE1"] as const;

const REPORT_PATH = resolve(process.cwd(), "docs/actas/10-rerun-sanity.md");

interface EntryComparable {
  content: string;
  status_before: string | null;
  status_after: string | null;
  source: string;
  entry_date: string;
}

interface ElementCompareRow {
  key: string;
  originalCount: number;
  fixedCount: number;
  contentMismatches: string[];
}

function elementKey(
  payload: MondayTransformedPayload,
  elementId: string,
): string {
  const el = payload.elements.find((e) => e.id === elementId);
  if (!el) return elementId;
  const cat = payload.categories.find((c) => c.id === el.category_id);
  const catName = cat?.name ?? "?";
  if (el.parent_element_id) {
    const parent = payload.elements.find((e) => e.id === el.parent_element_id);
    return `${catName}|${parent?.monday_item_name ?? "?"}|${el.monday_item_name}`;
  }
  return `${catName}|${el.monday_item_name}`;
}

function entriesByElementKey(
  payload: MondayTransformedPayload,
): Map<string, EntryComparable[]> {
  const byEl = new Map<string, TransformedLogEntry[]>();
  for (const le of payload.log_entries) {
    const list = byEl.get(le.element_id) ?? [];
    list.push(le);
    byEl.set(le.element_id, list);
  }

  const out = new Map<string, EntryComparable[]>();
  for (const [elementId, entries] of byEl) {
    const key = elementKey(payload, elementId);
    out.set(
      key,
      entries.map((e) => ({
        content: e.content,
        status_before: e.status_before,
        status_after: e.status_after,
        source: e.source,
        entry_date: e.entry_date,
      })),
    );
  }
  return out;
}

function compareContent(
  original: MondayTransformedPayload,
  fixed: MondayTransformedPayload,
): ElementCompareRow[] {
  const origByKey = entriesByElementKey(original);
  const fixedByKey = entriesByElementKey(fixed);
  const allKeys = new Set([...origByKey.keys(), ...fixedByKey.keys()]);
  const rows: ElementCompareRow[] = [];

  for (const key of [...allKeys].sort()) {
    const o = origByKey.get(key) ?? [];
    const f = fixedByKey.get(key) ?? [];
    const mismatches: string[] = [];

    if (o.length !== f.length) {
      mismatches.push(`recuento ${o.length} vs ${f.length}`);
    } else {
      for (let i = 0; i < o.length; i++) {
        const a = o[i]!;
        const b = f[i]!;
        if (
          a.content !== b.content ||
          a.status_before !== b.status_before ||
          a.status_after !== b.status_after ||
          a.source !== b.source
        ) {
          mismatches.push(
            `pos ${i}: content/status/source distinto (fechas ${a.entry_date} → ${b.entry_date})`,
          );
        }
      }
    }

    if (mismatches.length) {
      rows.push({
        key,
        originalCount: o.length,
        fixedCount: f.length,
        contentMismatches: mismatches,
      });
    }
  }

  return rows;
}

function distinctSnapshotDates(payload: MondayTransformedPayload): number {
  const dates = new Set<string>();
  for (const le of payload.log_entries) {
    if (le.source === "snapshot") dates.add(le.entry_date);
  }
  return dates.size;
}

function countSnapshotOnExtractDay(
  payload: MondayTransformedPayload,
  extractedDay: string,
): number {
  let n = 0;
  for (const le of payload.log_entries) {
    if (le.source === "snapshot" && le.entry_date === extractedDay) n++;
  }
  return n;
}

function countSnapshotOutsideRange(
  payload: MondayTransformedPayload,
  min: string | null,
  max: string | null,
): number {
  let n = 0;
  for (const le of payload.log_entries) {
    if (le.source !== "snapshot") continue;
    const d = le.entry_date;
    if ((min && d < min) || (max && d > max)) n++;
  }
  return n;
}

function dateChangesSummary(
  original: MondayTransformedPayload,
  fixed: MondayTransformedPayload,
): { changed: number; samples: string[] } {
  const origByKey = entriesByElementKey(original);
  const fixedByKey = entriesByElementKey(fixed);
  let changed = 0;
  const samples: string[] = [];

  for (const key of origByKey.keys()) {
    const o = origByKey.get(key)!;
    const f = fixedByKey.get(key);
    if (!f || o.length !== f.length) continue;
    for (let i = 0; i < o.length; i++) {
      if (o[i]!.entry_date !== f[i]!.entry_date) {
        changed++;
        if (samples.length < 5) {
          samples.push(
            `${key} [${i}]: ${o[i]!.entry_date} → ${f[i]!.entry_date}`,
          );
        }
      }
    }
  }

  return { changed, samples };
}

async function main(): Promise<void> {
  const mappingPath = resolve(process.cwd(), "docs/actas/07-element-mapping.json");
  const userMappingPath = resolve(process.cwd(), "docs/actas/06-user-mapping.json");
  const elementMapping = loadElementMappingFile(mappingPath);
  const userMappings = loadUserMappingFile(userMappingPath);

  const reportLines: string[] = [
    "# Sanity: transform entry_date (snapshot_date_iso)",
    "",
    `Generado: ${new Date().toISOString()}`,
    "",
    "Comparación `tmp/monday-transformed/` (original) vs `tmp/monday-transformed-fix/` (corregido).",
    "",
  ];

  for (const projectCode of PROJECTS) {
    console.log(`\n=== ${projectCode} ===`);
    const extractPath = resolve(MONDAY_EXTRACTS_DIR, `${projectCode}.json`);
    const originalPath = resolve(MONDAY_TRANSFORMED_DIR, `${projectCode}.json`);

    if (!existsSync(extractPath)) {
      throw new Error(`Falta extract: ${extractPath}`);
    }
    if (!existsSync(originalPath)) {
      throw new Error(`Falta original transformado: ${originalPath}`);
    }

    const extract = loadMondayExtractFile(extractPath);
    const original = JSON.parse(
      readFileSync(originalPath, "utf8"),
    ) as MondayTransformedPayload;

    const fixed = transformMondayExtract(extract, {
      userMappings,
      groupMappings: elementMapping.groups,
      elementsUnique: elementMapping.elements_unique,
    });

    const outPath = writeMondayTransformed(
      fixed,
      projectCode,
      MONDAY_TRANSFORMED_FIX_DIR,
    );
    console.log(`Escrito ${outPath}`);

    const contentIssues = compareContent(original, fixed);
    const origDistinct = distinctSnapshotDates(original);
    const fixDistinct = distinctSnapshotDates(fixed);
    const extractedDay = extract.extracted_at.slice(0, 10);
    const onExtractOrig = countSnapshotOnExtractDay(original, extractedDay);
    const onExtractFix = countSnapshotOnExtractDay(fixed, extractedDay);
    const outsideFix = countSnapshotOutsideRange(
      fixed,
      extract.summary.snapshot_date_min,
      extract.summary.snapshot_date_max,
    );
    const { changed: datesChanged, samples } = dateChangesSummary(
      original,
      fixed,
    );

    reportLines.push(`## ${projectCode}`, "");
    reportLines.push(
      "| Métrica | Original | Corregido |",
      "| --- | ---: | ---: |",
      `| log_entries (total) | ${original.log_entries.length} | ${fixed.log_entries.length} |`,
      `| log_entries snapshot (fechas distintas) | ${origDistinct} | ${fixDistinct} |`,
      `| entradas snapshot en día extracted_at (\`${extractedDay}\`) | ${onExtractOrig} | ${onExtractFix} |`,
      `| entradas snapshot fuera de [min,max] | — | ${outsideFix} |`,
      `| filas con entry_date distinta (mismo orden/content) | — | ${datesChanged} |`,
      "",
    );

    reportLines.push(
      "### Contenido (debe coincidir posición a posición)",
      "",
    );
    if (!contentIssues.length) {
      reportLines.push(
        "✓ Todos los elementos: mismo recuento y mismo `content` / `status_*` / `source` por posición.",
        "",
      );
    } else {
      reportLines.push(
        `✗ **${contentIssues.length} elemento(s) con discrepancias:**`,
        "",
      );
      for (const row of contentIssues.slice(0, 30)) {
        reportLines.push(`- \`${row.key}\`: ${row.contentMismatches.join("; ")}`);
      }
      if (contentIssues.length > 30) {
        reportLines.push(`- … y ${contentIssues.length - 30} más`);
      }
      reportLines.push("");
    }

    reportLines.push("### Fechas", "");
    reportLines.push(
      `- Rango extract: \`${extract.summary.snapshot_date_min}\` – \`${extract.summary.snapshot_date_max}\``,
    );
    reportLines.push(
      `- Confirmación extracted_at: ${onExtractFix === 0 ? "✓ 0 entradas snapshot en fecha de extracción" : `✗ ${onExtractFix} entradas en ${extractedDay}`}`,
    );
    reportLines.push(
      `- Confirmación rango: ${outsideFix === 0 ? "✓ ninguna fuera de rango" : `✗ ${outsideFix} fuera de rango`}`,
    );
    if (samples.length) {
      reportLines.push("- Ejemplos de cambio de fecha:");
      for (const s of samples) {
        reportLines.push(`  - ${s}`);
      }
    }
    reportLines.push("");
  }

  writeFileSync(REPORT_PATH, `${reportLines.join("\n")}\n`, "utf8");
  console.log(`\nReporte: ${REPORT_PATH}`);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
