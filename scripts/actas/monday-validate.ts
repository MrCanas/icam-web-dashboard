import { config } from "dotenv";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

import {
  loadTransformedPayload,
  printValidationErrors,
  transformedPath,
  validateTransformedPayload,
  writeValidationReport,
} from "./lib/monday-validate";
import { createActasServerClient } from "./lib/supabase-server";

config({ path: resolve(process.cwd(), ".env.local") });

function parseProjectCodeArg(argv: string[]): string {
  const code = argv.find((a) => !a.startsWith("-"))?.trim();
  if (!code) {
    throw new Error(
      "Uso: npm run actas:monday-validate -- <CÓDIGO_PROYECTO>\n  Ejemplo: npm run actas:monday-validate -- GQ8",
    );
  }
  return code.toUpperCase();
}

async function main(): Promise<void> {
  const projectCode = parseProjectCodeArg(process.argv.slice(2));
  const jsonPath = transformedPath(projectCode);

  if (!existsSync(jsonPath)) {
    throw new Error(
      `No existe ${jsonPath}. Ejecuta antes: npm run actas:monday-transform -- ${projectCode}`,
    );
  }

  console.log(`Validación pre-load — ${projectCode}`);
  console.log(`  entrada: ${jsonPath}`);
  console.log("  Supabase: solo lectura (master_*, auth.users)\n");

  const payload = loadTransformedPayload(jsonPath);
  const supabase = createActasServerClient();
  const result = await validateTransformedPayload(payload, supabase);

  const reportPath = writeValidationReport(result, projectCode);
  console.log(`Informe: ${reportPath}`);

  if (result.warnings.length) {
    console.log(`\nWarnings (${result.warnings.length}):`);
    for (const w of result.warnings) {
      console.log(`  - ${w.check}: ${w.message}`);
    }
  }

  printValidationErrors(result);

  if (!result.passed) {
    console.error(
      "\nExit 1 — Corrige los errores antes del load (P3.4).",
    );
    process.exit(1);
  }

  console.log(
    `\nExit 0 — Validación OK${result.warnings.length ? " (con warnings)" : ""}.`,
  );
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
