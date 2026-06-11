import { config } from "dotenv";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { MONDAY_EXTRACTS_DIR } from "./lib/monday-extract";
import { createActasServerClient } from "./lib/supabase-server";
import {
  loadElementMappingFile,
  loadMasterModuleIds,
  loadMondayExtractFile,
  loadUserMappingFile,
  printTransformReport,
  transformMondayExtract,
  writeMondayTransformed,
} from "./lib/monday-transform";

config({ path: resolve(process.cwd(), ".env.local") });

function parseProjectCodeArg(argv: string[]): string {
  const code = argv.find((a) => !a.startsWith("-"))?.trim();
  if (!code) {
    throw new Error(
      "Uso: npm run actas:monday-transform -- <CÓDIGO_PROYECTO>\n  Ejemplo: npm run actas:monday-transform -- GQ8",
    );
  }
  return code.toUpperCase();
}

async function main(): Promise<void> {
  const projectCode = parseProjectCodeArg(process.argv.slice(2));
  const extractPath = resolve(MONDAY_EXTRACTS_DIR, `${projectCode}.json`);

  if (!existsSync(extractPath)) {
    throw new Error(
      `No existe ${extractPath}. Ejecuta antes: npm run actas:monday-extract -- ${projectCode}`,
    );
  }

  const mappingPath = resolve(process.cwd(), "docs/actas/07-element-mapping.json");
  const userMappingPath = resolve(process.cwd(), "docs/actas/06-user-mapping.json");

  console.log(`Transform Monday → staging — proyecto ${projectCode}`);
  console.log(`  extract: ${extractPath}`);
  console.log(`  mapping: ${mappingPath}\n`);

  const extract = loadMondayExtractFile(extractPath);
  const elementMapping = loadElementMappingFile(mappingPath);
  const userMappings = loadUserMappingFile(userMappingPath);

  let masterModuleIdsByName = new Map<string, string>();
  try {
    const supabase = createActasServerClient();
    masterModuleIdsByName = await loadMasterModuleIds(supabase);
  } catch {
    console.warn(
      "Supabase no disponible; modules_to_activate llevarán master_module_id null.",
    );
  }

  const payload = transformMondayExtract(extract, {
    userMappings,
    groupMappings: elementMapping.groups,
    elementsUnique: elementMapping.elements_unique,
    masterModuleIdsByName,
  });

  const outPath = writeMondayTransformed(payload, projectCode);
  console.log(`Escrito ${outPath}`);
  printTransformReport(payload, extract.boards.length);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
