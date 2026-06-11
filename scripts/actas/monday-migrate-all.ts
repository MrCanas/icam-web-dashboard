import { config } from "dotenv";
import { createInterface } from "node:readline/promises";
import { resolve } from "node:path";
import { stdin as input, stdout as output } from "node:process";

import {
  MigrateAllBatchAbortError,
  runMigrateAllPhases,
  shutdownMigrateAll,
  writeMigrationSummary,
} from "./lib/monday-migrate-all";

config({ path: resolve(process.cwd(), ".env.local") });

function parseFlags(argv: string[]): { yes: boolean } {
  return { yes: argv.includes("--yes") || argv.includes("-y") };
}

async function askYesNo(question: string): Promise<boolean> {
  const rl = createInterface({ input, output });
  try {
    for (;;) {
      const raw = await rl.question(`${question} (yes/no): `);
      const answer = raw.trim().toLowerCase();
      if (["yes", "y", "si", "sí", "s"].includes(answer)) return true;
      if (["no", "n"].includes(answer)) return false;
      console.log("  Responde yes o no.");
    }
  } finally {
    rl.close();
  }
}

async function main(): Promise<void> {
  const { yes: skipConfirmations } = parseFlags(process.argv.slice(2));
  const workspaceId = process.env.MONDAY_WORKSPACE_ID_ACTAS?.trim();

  if (!workspaceId) {
    throw new Error("Falta MONDAY_WORKSPACE_ID_ACTAS en .env.local");
  }

  console.log("Monday migrate-all (P3.5)");
  console.log(`  workspace: ${workspaceId}`);
  if (skipConfirmations) {
    console.log("  modo: --yes (sin confirmaciones interactivas)\n");
  } else {
    console.log("  modo: interactivo\n");
  }

  let exitCode = 0;
  let result: Awaited<ReturnType<typeof runMigrateAllPhases>> | null = null;

  try {
    result = await runMigrateAllPhases({
      workspaceId,
      skipConfirmations,
      askFn: askYesNo,
    });

    if (result.loadAbortedAt) {
      exitCode = 1;
    } else if (result.realLoadConfirmed && result.loaded.length === result.pending.length) {
      console.log(
        `\nExit 0 — ${result.loaded.length} proyecto(s) cargados en Supabase.`,
      );
    } else if (!result.pending.length) {
      console.log("\nExit 0 — sin proyectos pendientes.");
    } else if (!result.realLoadConfirmed) {
      console.log(
        `\nExit 0 — staging listo para ${result.staged.length} proyecto(s); carga real no ejecutada.`,
      );
    } else {
      console.log("\nExit 0.");
    }
  } catch (err) {
    if (err instanceof MigrateAllBatchAbortError) {
      if (err.partialResult) result = err.partialResult;
      console.error(`\n${err.message}`);
      if (err.cause instanceof Error && err.cause.stack) {
        console.error(err.cause.stack);
      }
    } else {
      console.error(err instanceof Error ? err.message : err);
    }
    exitCode = 1;
  } finally {
    if (result) {
      const summaryPath = writeMigrationSummary(result);
      console.log(`\nInforme: ${summaryPath}`);
    }
    await shutdownMigrateAll();
  }

  if (exitCode) process.exit(exitCode);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
