import { config } from "dotenv";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { closePgPool } from "./lib/db";
import {
  LoadVerificationError,
  printLoadReport,
  runMondayLoad,
} from "./lib/monday-load";
import {
  loadTransformedPayload,
  transformedPath,
} from "./lib/monday-validate";

config({ path: resolve(process.cwd(), ".env.local") });

function parseArgs(argv: string[]): { projectCode: string; dryRun: boolean } {
  const dryRun = argv.includes("--dry-run");
  const code = argv.find((a) => !a.startsWith("-"))?.trim();
  if (!code) {
    throw new Error(
      "Uso: npm run actas:monday-load -- <CÓDIGO_PROYECTO> [--dry-run]\n" +
        "  Ejemplo: npm run actas:monday-load -- GQ8 --dry-run",
    );
  }
  if (argv.includes("--force")) {
    throw new Error("--force no está implementado.");
  }
  return { projectCode: code.toUpperCase(), dryRun };
}

async function main(): Promise<void> {
  const { projectCode, dryRun } = parseArgs(process.argv.slice(2));
  const jsonPath = transformedPath(projectCode);

  if (!existsSync(jsonPath)) {
    throw new Error(
      `No existe ${jsonPath}. Ejecuta antes: npm run actas:monday-transform -- ${projectCode}`,
    );
  }

  console.log(`Monday load — ${projectCode}${dryRun ? " (dry-run)" : ""}`);
  console.log(`  entrada: ${jsonPath}`);
  console.log("  Postgres: transacción única (BEGIN … COMMIT | ROLLBACK)\n");

  const payload = loadTransformedPayload(jsonPath);
  if (payload.project.code.trim().toUpperCase() !== projectCode) {
    throw new Error(
      `El JSON tiene project.code=${payload.project.code}, no ${projectCode}`,
    );
  }

  const report = await runMondayLoad(payload, { dryRun });
  printLoadReport(report);

  const mismatch = Object.entries(report.expected).some(
    ([key, exp]) =>
      report.inserted[key as keyof typeof report.inserted] !== exp,
  );
  if (mismatch) {
    console.error("\nExit 1 — Conteos insertados ≠ esperados.");
    process.exit(1);
  }

  console.log(`\nExit 0 — ${dryRun ? "Dry-run OK" : "Carga completada"}.`);
}

main()
  .catch((err: unknown) => {
    if (err instanceof LoadVerificationError) {
      console.error(err.message);
      for (const d of err.differences) {
        console.error(`  - ${d}`);
      }
    } else {
      console.error(err instanceof Error ? err.message : err);
    }
    process.exit(1);
  })
  .finally(() => closePgPool());
