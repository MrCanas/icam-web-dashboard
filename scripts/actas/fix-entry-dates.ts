/**
 * Corrige entry_date en log_entry según fecha del tablero Monday (transform actual).
 * Dry-run por defecto; --apply para escribir. --project <CODE> opcional.
 */
import { config } from "dotenv";
import { resolve } from "node:path";

import {
  applyFixesForProject,
  auditProject,
  listProjectCodesInDb,
} from "./lib/entry-date-audit-core";
import { getPgPool } from "./lib/db";

config({ path: resolve(process.cwd(), ".env.local") });

function parseArgs(): { apply: boolean; project: string | null } {
  const argv = process.argv.slice(2);
  let apply = false;
  let project: string | null = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--apply") apply = true;
    if (argv[i] === "--project" && argv[i + 1]) {
      project = argv[i + 1]!.trim().toUpperCase();
      i++;
    }
  }
  return { apply, project };
}

async function main(): Promise<void> {
  const { apply, project } = parseArgs();
  console.log(
    apply
      ? "fix-entry-dates — APLICANDO cambios\n"
      : "fix-entry-dates — dry-run (sin writes)\n",
  );

  const codes = project ? [project] : await listProjectCodesInDb();

  let totalProposed = 0;
  let totalApplied = 0;

  for (const code of codes) {
    const auditBefore = await auditProject(code);
    console.log(`\n=== ${code} ===`);
    console.log(`  Incorrectas (audit): ${auditBefore.incorrect}`);

    if (!auditBefore.hasExtract) {
      console.log("  Omitido: sin extract");
      continue;
    }

    const result = await applyFixesForProject(code, !apply);
    totalProposed += result.proposed;

    if (apply) {
      totalApplied += result.applied;
      console.log(`  Actualizadas: ${result.applied}`);
      console.log(`  Saltadas (drift): ${result.skippedDrift}`);

      const auditAfter = await auditProject(code);
      console.log(`  Incorrectas tras apply: ${auditAfter.incorrect}`);
    } else {
      console.log(`  Propuestas (dry-run): ${result.proposed}`);
      if (result.proposed > 0 && auditBefore.discrepancies[0]) {
        const d = auditBefore.discrepancies[0]!;
        console.log(
          `  Ejemplo: ${d.entry_id.slice(0, 8)}… ${d.fecha_actual} → ${d.fecha_esperada} (${d.nombre_snapshot.slice(0, 40)})`,
        );
      }
    }
  }

  console.log("\n---");
  console.log(`Total propuestas: ${totalProposed}`);
  if (apply) {
    console.log(`Total aplicadas: ${totalApplied}`);
  } else if (totalProposed > 0) {
    console.log("Ejecuta con --apply para persistir.");
  }

  await getPgPool().end();
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
