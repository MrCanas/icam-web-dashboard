/**
 * Aplicar corrección entry_date (CA1, CSP10, PC25, VBARE, VE1).
 * Por defecto: verificación (sin writes). Con --apply: backup + UPDATE + status.
 */
import { config } from "dotenv";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import type { PoolClient } from "pg";

import { getPgPool } from "./lib/db";
import {
  dateOnly,
  introspectLogEntryHasSource,
  loadDbContext,
  loadFixJson,
  MIGRATION_WINDOW_END,
  RECONCILE_PROJECTS,
  reconcileProjectHardened,
  type ProposedDateUpdate,
  type ReconcileProjectResult,
} from "./lib/reconcile-entry-dates";

config({ path: resolve(process.cwd(), ".env.local") });

const UPDATES_FINAL_DIR = resolve(
  process.cwd(),
  "tmp/entry-date-updates-final",
);
const REPORT_PATH = resolve(process.cwd(), "docs/actas/12-apply.md");
const DRYRUN_REPORT_PATH = resolve(
  process.cwd(),
  "docs/actas/11-reconcile-dryrun.md",
);

const BACKUP_TABLE = "log_entry_entrydate_backup_20260528";

interface ApplyProjectStats {
  proposed: number;
  updated: number;
  skippedDrift: number;
  unchanged: number;
  elementsStatusUpdated: number;
  distinctDatesBefore: number;
  distinctDatesAfter: number;
}

interface SpotCheckRow {
  entry_date: string;
  content: string;
  status_after: string | null;
}

function parseArgs(): { apply: boolean } {
  return { apply: process.argv.includes("--apply") };
}

function readDryRunExpectedCounts(): Map<string, number> {
  const map = new Map<string, number>();
  try {
    const md = readFileSync(DRYRUN_REPORT_PATH, "utf8");
    for (const line of md.split("\n")) {
      const m = /^\| (CA1|CSP10|PC25|VBARE|VE1) \| \d+ \| (\d+) \|/.exec(line);
      if (m) map.set(m[1]!, Number(m[2]));
    }
  } catch {
    /* sin 11-reconcile */
  }
  return map;
}

function verifyPreApply(results: ReconcileProjectResult[]): {
  abort: boolean;
  lines: string[];
} {
  const lines: string[] = [
    "## Verificación pre-aplicación (emparejamiento endurecido)",
    "",
    `Generado: ${new Date().toISOString()}`,
    "",
  ];

  let abort = false;

  const allMismatches = results.flatMap((r) => r.contentMismatches);
  const allManual = results.flatMap((r) => r.manualReview);

  if (allMismatches.length) {
    abort = true;
    lines.push(
      "### ABORT: desajustes de content",
      "",
      "| Proyecto | Elemento | created_at | db_content | json_content |",
      "| --- | --- | --- | --- | --- |",
    );
    for (const m of allMismatches) {
      lines.push(
        `| ${m.projectCode} | ${m.element_key} | ${m.created_at.slice(0, 19)} | ${m.db_content.slice(0, 80)} | ${m.json_content.slice(0, 80)} |`,
      );
    }
    lines.push("");
  } else {
    lines.push("✓ **0 desajustes de content** en todos los pares.", "");
  }

  if (allManual.length) {
    abort = true;
    lines.push(
      "### ABORT: revisión manual (created_at empatado, status_after variable)",
      "",
    );
    for (const c of allManual) {
      lines.push(
        `- **${c.projectCode}** · ${c.element_key} · content=${JSON.stringify(c.content.slice(0, 60))} · created_at=${c.created_at} · status_after=${c.status_after_values.join(", ")} · ids=${c.row_ids.join(", ")}`,
      );
    }
    lines.push("");
  } else {
    lines.push(
      "✓ **0 casos de revisión manual** (grupos duplicados con created_at empatado y status_after distinto).",
      "",
    );
  }

  const dryRunExpected = readDryRunExpectedCounts();

  lines.push("### Por proyecto", "");
  lines.push(
    "| Proyecto | Total DB | Pares | A actualizar | Sin cambio | Reales | Anomalías | Cuadre | vs dry-run 11 |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |",
  );

  for (const r of results) {
    const sum =
      r.toUpdate.length + r.unchanged + r.realesPosteriores.length + r.anomalias.length;
    const cuadre = sum === r.totalDb ? "✓" : `✗ (${sum}≠${r.totalDb})`;
    if (sum !== r.totalDb) abort = true;

    const expected = dryRunExpected.get(r.projectCode);
    const vsDry =
      expected == null
        ? "—"
        : r.toUpdate.length === expected
          ? "✓"
          : `${r.toUpdate.length} vs ${expected}`;

    lines.push(
      `| ${r.projectCode} | ${r.totalDb} | ${r.pairs.length} | ${r.toUpdate.length} | ${r.unchanged} | ${r.realesPosteriores.length} | ${r.anomalias.length} | ${cuadre} | ${vsDry} |`,
    );
  }
  lines.push("");

  const touchedReales = results.flatMap((r) =>
    r.toUpdate.filter((u) => u.created_at >= MIGRATION_WINDOW_END),
  );
  if (touchedReales.length) {
    abort = true;
    lines.push(
      `### ABORT: ${touchedReales.length} cambios propuestos tocarían entradas reales (created_at >= ${MIGRATION_WINDOW_END})`,
      "",
    );
  } else {
    lines.push(
      `✓ Ningún cambio propuesto con \`created_at >= ${MIGRATION_WINDOW_END}\`.`,
      "",
    );
  }

  lines.push("### Muestra de cambios propuestos (15)", "");
  const sample = results.flatMap((r) =>
    r.toUpdate.map((u) => ({ ...u, project: r.projectCode })),
  );
  if (!sample.length) {
    lines.push("_Ninguno._", "");
  } else {
    for (const u of sample.slice(0, 15)) {
      lines.push(
        `- **${u.project}** · ${u.element_key} · ${dateOnly(u.old)} → ${u.new}`,
      );
    }
    lines.push("");
  }

  if (abort) {
    lines.push(
      "> **Estado: ABORT** — no ejecutar `--apply` hasta resolver lo anterior.",
      "",
    );
  } else {
    lines.push(
      "> **Estado: OK para aplicar** — ejecutar `npm run actas:apply-entry-dates -- --apply`.",
      "",
    );
  }

  return { abort, lines };
}

async function recalcElementStatus(
  client: PoolClient,
  elementIds: string[],
): Promise<number> {
  if (!elementIds.length) return 0;

  const { rows } = await client.query<{ element_id: string; status_after: string }>(
    `SELECT DISTINCT ON (element_id)
       element_id,
       status_after
     FROM public.log_entry
     WHERE element_id = ANY($1::uuid[])
       AND deleted_at IS NULL
       AND status_after IS NOT NULL
     ORDER BY element_id, entry_date DESC, created_at DESC`,
    [elementIds],
  );

  let updated = 0;
  for (const row of rows) {
    const res = await client.query(
      `UPDATE public.element
       SET status = $2, updated_at = now()
       WHERE id = $1 AND status IS DISTINCT FROM $2`,
      [row.element_id, row.status_after],
    );
    updated += res.rowCount ?? 0;
  }
  return updated;
}

async function applyProject(
  client: PoolClient,
  projectCode: string,
  updates: ProposedDateUpdate[],
): Promise<{ updated: number; skippedDrift: number; elementIds: Set<string> }> {
  let updated = 0;
  let skippedDrift = 0;
  const elementIds = new Set<string>();

  for (const u of updates) {
    const { rows } = await client.query<{ id: string; element_id: string }>(
      `UPDATE public.log_entry
       SET entry_date = ($1::text || 'T00:00:00Z')::timestamptz
       WHERE id = $2::uuid
         AND entry_date = $3::timestamptz
       RETURNING id, element_id`,
      [u.new, u.id, u.old],
    );
    if (rows.length) {
      updated += 1;
      elementIds.add(rows[0]!.element_id);
    } else {
      skippedDrift += 1;
    }
  }

  return { updated, skippedDrift, elementIds };
}

async function distinctSnapshotDates(
  client: PoolClient,
  projectCode: string,
): Promise<number> {
  const { rows } = await client.query<{ n: string }>(
    `SELECT COUNT(DISTINCT date_trunc('day', le.entry_date)::date) AS n
     FROM public.log_entry le
     INNER JOIN public.element e ON e.id = le.element_id
     INNER JOIN public.category c ON c.id = e.category_id
     INNER JOIN public.project p ON p.id = c.project_id
     WHERE p.code = $1
       AND e.archived_at IS NULL
       AND c.archived_at IS NULL
       AND le.created_at < $2::timestamptz`,
    [projectCode, MIGRATION_WINDOW_END],
  );
  return Number(rows[0]?.n ?? 0);
}

async function spotChecks(
  client: PoolClient,
  projectCode: string,
  updates: ProposedDateUpdate[],
): Promise<{ element_key: string; rows: SpotCheckRow[] }[]> {
  const byElement = new Map<string, number>();
  for (const u of updates) {
    byElement.set(u.element_key, (byElement.get(u.element_key) ?? 0) + 1);
  }
  const topKeys = [...byElement.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([k]) => k);

  const out: { element_key: string; rows: SpotCheckRow[] }[] = [];

  for (const key of topKeys) {
    const parts = key.split("|");
    const categoryName = parts[0]!;
    const parentName = parts.length === 3 ? parts[1]! : null;
    const elementName = parts.length === 3 ? parts[2]! : parts[1]!;

    const { rows: elRows } = await client.query<{ id: string }>(
      `SELECT e.id
       FROM public.element e
       INNER JOIN public.category c ON c.id = e.category_id
       INNER JOIN public.project p ON p.id = c.project_id
       LEFT JOIN public.element pe ON pe.id = e.parent_element_id
       WHERE p.code = $1
         AND c.name = $2
         AND e.name = $3
         AND (($4::text IS NULL AND e.parent_element_id IS NULL) OR pe.name = $4)
         AND e.archived_at IS NULL
       LIMIT 1`,
      [projectCode, categoryName, elementName, parentName],
    );
    if (!elRows[0]) continue;

    const { rows } = await client.query<SpotCheckRow>(
      `SELECT le.entry_date::text AS entry_date, le.content, le.status_after
       FROM public.log_entry le
       WHERE le.element_id = $1 AND le.deleted_at IS NULL
       ORDER BY le.entry_date ASC, le.created_at ASC
       LIMIT 12`,
      [elRows[0].id],
    );
    out.push({ element_key: key, rows });
  }

  return out;
}

async function main(): Promise<void> {
  const { apply } = parseArgs();
  console.log(
    apply
      ? "apply-entry-dates — MODO APLICACIÓN (--apply)\n"
      : "apply-entry-dates — MODO VERIFICACIÓN (sin writes)\n",
  );

  const hasSource = await introspectLogEntryHasSource();
  mkdirSync(UPDATES_FINAL_DIR, { recursive: true });

  const results: ReconcileProjectResult[] = [];

  for (const projectCode of RECONCILE_PROJECTS) {
    console.log(`\n=== ${projectCode} ===`);
    const payload = loadFixJson(projectCode);
    const db = await loadDbContext(projectCode, hasSource);
    const result = reconcileProjectHardened(projectCode, payload, db);
    results.push(result);

    writeFileSync(
      resolve(UPDATES_FINAL_DIR, `${projectCode}.json`),
      `${JSON.stringify(
        result.toUpdate.map(({ id, old, new: n }) => ({ id, old, new: n })),
        null,
        2,
      )}\n`,
      "utf8",
    );

    console.log(`  Pares: ${result.pairs.length}`);
    console.log(`  Content mismatch: ${result.contentMismatches.length}`);
    console.log(`  Revisión manual: ${result.manualReview.length}`);
    console.log(`  A actualizar: ${result.toUpdate.length}`);
  }

  const pre = verifyPreApply(results);
  const reportLines: string[] = [
    "# Aplicación corrección entry_date",
    "",
    ...pre.lines,
  ];

  if (pre.abort) {
    writeFileSync(REPORT_PATH, `${reportLines.join("\n")}\n`, "utf8");
    console.log(`\nReporte: ${REPORT_PATH}`);
    console.error("\nABORT: verificación fallida. No se ha escrito en la BD.");
    await getPgPool().end();
    process.exit(1);
  }

  if (!apply) {
    reportLines.push(
      "## Aplicación",
      "",
      "_No ejecutada (falta `--apply`)._",
      "",
      "## Reversión (cuando se aplique)",
      "",
      "```sql",
      "UPDATE public.log_entry le",
      "SET entry_date = b.entry_date_old",
      `FROM public.${BACKUP_TABLE} b`,
      "WHERE le.id = b.id;",
      "```",
      "",
    );
    writeFileSync(REPORT_PATH, `${reportLines.join("\n")}\n`, "utf8");
    console.log(`\nReporte: ${REPORT_PATH}`);
    console.log(`Updates: ${UPDATES_FINAL_DIR}/`);
    console.log("\nVerificación OK. Ejecuta con --apply tras revisar.");
    await getPgPool().end();
    return;
  }

  const pool = getPgPool();
  const allIds = results.flatMap((r) => r.toUpdate.map((u) => u.id));

  reportLines.push("## Aplicación (--apply)", "");

  const client = await pool.connect();
  try {
    const { rows: exists } = await client.query<{ regclass: string | null }>(
      `SELECT to_regclass('public.${BACKUP_TABLE}') AS regclass`,
    );
    if (exists[0]?.regclass) {
      throw new Error(
        `La tabla ${BACKUP_TABLE} ya existe. Revisa si hubo un apply previo antes de continuar.`,
      );
    }

    if (allIds.length) {
      await client.query("BEGIN");
      await client.query(
        `CREATE TABLE public.${BACKUP_TABLE} AS
         SELECT id, entry_date AS entry_date_old, now() AS backed_up_at
         FROM public.log_entry
         WHERE id = ANY($1::uuid[])`,
        [allIds],
      );
      const { rows: backupCount } = await client.query<{ n: string }>(
        `SELECT COUNT(*)::text AS n FROM public.${BACKUP_TABLE}`,
      );
      const nBackup = Number(backupCount[0]?.n ?? 0);
      if (nBackup !== allIds.length) {
        await client.query("ROLLBACK");
        throw new Error(
          `Backup count ${nBackup} ≠ cambios propuestos ${allIds.length}`,
        );
      }
      await client.query("COMMIT");
      reportLines.push(
        `✓ Backup \`${BACKUP_TABLE}\`: **${nBackup}** filas.`,
        "",
      );
    } else {
      reportLines.push("_Sin cambios que aplicar (backup omitido)._", "");
    }

    const applyStats = new Map<string, ApplyProjectStats>();

    for (const result of results) {
      const datesBefore = await distinctSnapshotDates(client, result.projectCode);

      await client.query("BEGIN");
      try {
        const { updated, skippedDrift, elementIds } = await applyProject(
          client,
          result.projectCode,
          result.toUpdate,
        );

        const statusUpdated = await recalcElementStatus(
          client,
          [...elementIds],
        );

        await client.query("COMMIT");

        const datesAfter = await distinctSnapshotDates(
          client,
          result.projectCode,
        );

        applyStats.set(result.projectCode, {
          proposed: result.toUpdate.length,
          updated,
          skippedDrift,
          unchanged: result.unchanged,
          elementsStatusUpdated: statusUpdated,
          distinctDatesBefore: datesBefore,
          distinctDatesAfter: datesAfter,
        });

        console.log(
          `  ${result.projectCode}: updated=${updated} drift=${skippedDrift} status=${statusUpdated}`,
        );
      } catch (projectErr) {
        await client.query("ROLLBACK");
        throw projectErr;
      }
    }

    reportLines.push("## Post-aplicación", "");
    reportLines.push(
      "| Proyecto | Propuestos | Actualizados | Saltados (drift) | element.status recalc | Fechas distintas (migr.) antes → después |",
      "| --- | ---: | ---: | ---: | ---: | --- |",
    );

    for (const result of results) {
      const s = applyStats.get(result.projectCode)!;
      const ok =
        s.updated + s.skippedDrift === s.proposed ? "✓" : "✗";
      reportLines.push(
        `| ${result.projectCode} | ${s.proposed} | ${s.updated} | ${s.skippedDrift} | ${s.elementsStatusUpdated} | ${s.distinctDatesBefore} → ${s.distinctDatesAfter} (${ok}) |`,
      );

      reportLines.push("", `### Spot-checks ${result.projectCode}`, "");
      const checks = await spotChecks(client, result.projectCode, result.toUpdate);
      for (const check of checks) {
        reportLines.push(`**${check.element_key}**`, "");
        reportLines.push("```");
        for (const row of check.rows) {
          reportLines.push(
            `${dateOnly(row.entry_date)} | ${row.status_after ?? "—"} | ${row.content.slice(0, 70)}`,
          );
        }
        reportLines.push("```", "");
      }
    }

    const { rows: realesTouched } = await client.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n
       FROM public.log_entry le
       INNER JOIN public.${BACKUP_TABLE} b ON b.id = le.id
       WHERE le.created_at >= $1::timestamptz`,
      [MIGRATION_WINDOW_END],
    );
    const nReales = Number(realesTouched[0]?.n ?? 0);
    reportLines.push(
      `✓ Entradas reales modificadas (created_at >= ventana, en backup): **${nReales}** (debe ser 0).`,
      "",
    );
    if (nReales > 0) {
      reportLines.push("> ⚠ Revisar: se tocó alguna entrada posterior a la migración.", "");
    }
  } finally {
    client.release();
  }

  reportLines.push(
    "## Reversión",
    "",
    "Para deshacer todos los cambios de entry_date:",
    "",
    "```sql",
    "BEGIN;",
    "UPDATE public.log_entry le",
    "SET entry_date = b.entry_date_old",
    `FROM public.${BACKUP_TABLE} b`,
    "WHERE le.id = b.id;",
    "-- Recalcular element.status manualmente o repetir lógica de recálculo",
    "COMMIT;",
    "```",
    "",
    `La tabla de backup conserva \`entry_date_old\` y \`backed_up_at\` para auditoría.`,
    "",
  );

  writeFileSync(REPORT_PATH, `${reportLines.join("\n")}\n`, "utf8");
  console.log(`\nReporte: ${REPORT_PATH}`);
  await pool.end();
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
