/**
 * Auditoría entry_date vs fecha del tablero Monday (solo lectura).
 */
import { config } from "dotenv";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  auditProject,
  listProjectCodesInDb,
  verifyMondayTransformSourceFix,
} from "./lib/entry-date-audit-core";
import { getPgPool } from "./lib/db";

config({ path: resolve(process.cwd(), ".env.local") });

const REPORT_PATH = resolve(process.cwd(), "docs/actas/14-entry-date-audit.md");

function formatDiscrepancyTable(
  rows: {
    entry_id: string;
    fecha_actual: string;
    fecha_esperada: string;
    nombre_snapshot: string;
  }[],
): string[] {
  if (!rows.length) return ["_Ninguna._", ""];
  const lines = [
    "| entry_id | fecha_actual | fecha_esperada | nombre_snapshot |",
    "| --- | --- | --- | --- |",
  ];
  for (const r of rows.slice(0, 10)) {
    const snap = r.nombre_snapshot.replace(/\|/g, "\\|").slice(0, 60);
    lines.push(
      `| \`${r.entry_id.slice(0, 8)}…\` | ${r.fecha_actual} | ${r.fecha_esperada} | ${snap} |`,
    );
  }
  if (rows.length > 10) {
    lines.push(`| … | | | _y ${rows.length - 10} más_ |`);
  }
  lines.push("");
  return lines;
}

async function main(): Promise<void> {
  console.log("audit-entry-dates — solo lectura\n");

  const transformCheck = verifyMondayTransformSourceFix();
  console.log(`monday-transform.ts: ${transformCheck.note}\n`);

  const codes = await listProjectCodesInDb();
  const results = [];

  for (const code of codes) {
    console.log(`  ${code}…`);
    results.push(await auditProject(code));
  }

  const lines: string[] = [
    "# Auditoría entry_date (log_entry vs tablero Monday)",
    "",
    `Generado: ${new Date().toISOString()}`,
    "",
    "## Procedencia y método",
    "",
    "- **BD:** `log_entry` no tiene `snapshot_id`. La migración P3.5 (`monday-load`) insertó solo `element_id`, `content`, `status_*`, `entry_date` (sin columna `source` en el INSERT).",
    "- **Columna `source`:** existe desde migración 007 (`snapshot` / `ui` / …) pero puede estar NULL en filas migradas.",
    "- **Fecha esperada:** re-transform del extract (`tmp/monday-extracts/<CODE>.json`) con `monday-transform.ts` actual; cada entrada `source: snapshot` lleva `entry_date = board.parsed.snapshot_date_iso`.",
    "- **Emparejamiento BD↔esperado:** mismo algoritmo endurecido que `reconcile-entry-dates` (elemento + content, duplicados por grupo de content).",
    "- **Nombre snapshot:** tablero canónico del extract con esa `snapshot_date_iso`, p. ej. `CSP10 - 02/02/2026`.",
    "",
    "## Verificación `monday-transform.ts`",
    "",
    transformCheck.ok
      ? `✓ ${transformCheck.note}`
      : `✗ ${transformCheck.note}`,
    "",
    "## Resumen por proyecto",
    "",
    "| Proyecto | log_entries | snapshot auditables | correctas | incorrectas | excluidas* | Snapshots canónicos | Estado |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |",
  ];

  for (const r of results) {
    if (!r.hasExtract) {
      lines.push(
        `| ${r.projectCode} | ${r.totalLogEntries} | — | — | — | — | — | sin extract |`,
      );
      continue;
    }
    if (!r.hasDbProject) {
      lines.push(
        `| ${r.projectCode} | 0 | — | — | — | — | ${r.canonicalSnapshots} | sin datos BD |`,
      );
      continue;
    }

    const estado =
      r.incorrect === 0
        ? "✓ limpio"
        : r.incorrect > 0
          ? "✗ requiere fix"
          : "—";

    lines.push(
      `| ${r.projectCode} | ${r.totalLogEntries} | ${r.snapshotMatched} | ${r.correct} | ${r.incorrect} | ${r.excludedUnmatched} | ${r.canonicalSnapshots} | ${estado} |`,
    );
  }

  lines.push(
    "",
    "\\* Excluidas: entradas de app (`created_at >= 2026-05-27`), `monday_update`, sin par, o anomalías de match.",
    "",
    "### Proyectos ya corregidos (rama fix/actas-entry-date)",
    "",
    "CA1, CSP10, PC25, VBARE, VE1 — si el apply de esa rama se aplicó en BD, deberían figurar como **limpios** (0 incorrectas).",
    "",
  );

  for (const r of results) {
    if (!r.hasExtract || !r.hasDbProject) continue;
    lines.push(`## ${r.projectCode}`, "");
    lines.push(
      `- Total \`log_entry\` (elementos actuales): **${r.totalLogEntries}**`,
    );
    lines.push(`- Snapshot auditables (emparejadas): **${r.snapshotMatched}**`);
    lines.push(`- Correctas: **${r.correct}** · Incorrectas: **${r.incorrect}**`);
    lines.push(`- Excluidas del audit de bug: **${r.excludedUnmatched}**`);
    if (r.dbSourceSnapshotCount != null) {
      lines.push(
        `- Filas con \`source='snapshot'\` en BD: **${r.dbSourceSnapshotCount}**`,
      );
    }
    lines.push("");
    lines.push("### Primeras discrepancias (máx. 10)", "");
    lines.push(...formatDiscrepancyTable(r.discrepancies));
  }

  const totalIncorrect = results.reduce((s, r) => s + r.incorrect, 0);
  lines.push("## Conclusión", "");
  if (totalIncorrect === 0) {
    lines.push(
      "Todos los proyectos auditables tienen `entry_date` alineado con la fecha del tablero Monday (snapshot).",
    );
  } else {
    lines.push(
      `Hay **${totalIncorrect}** entradas snapshot con fecha incorrecta en total. Ejecutar \`npm run actas:fix-entry-dates -- --apply\` (opcionalmente por \`--project\`).`,
    );
  }
  lines.push("");

  writeFileSync(REPORT_PATH, `${lines.join("\n")}\n`, "utf8");
  console.log(`\nReporte: ${REPORT_PATH}`);

  await getPgPool().end();
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
