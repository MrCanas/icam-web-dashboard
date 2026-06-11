import { config } from "dotenv";

import { resolve } from "node:path";



import {

  extractProjectFromMonday,

  writeMondayExtract,

} from "./lib/monday-extract";



config({ path: resolve(process.cwd(), ".env.local") });



function parseProjectCodeArg(argv: string[]): string {

  const code = argv.find((a) => !a.startsWith("-"))?.trim();

  if (!code) {

    throw new Error(

      "Uso: npm run actas:monday-extract -- <CÓDIGO_PROYECTO>\n  Ejemplo: npm run actas:monday-extract -- GQ8",

    );

  }

  return code.toUpperCase();

}



async function main(): Promise<void> {

  const projectCode = parseProjectCodeArg(process.argv.slice(2));

  const workspaceId = process.env.MONDAY_WORKSPACE_ID_ACTAS?.trim();

  if (!workspaceId) {

    throw new Error("Falta MONDAY_WORKSPACE_ID_ACTAS en .env.local");

  }



  console.log(`Extracción Monday — proyecto ${projectCode} (workspace ${workspaceId})`);

  console.log("Sin escritura en Supabase; salida en tmp/monday-extracts/\n");



  const payload = await extractProjectFromMonday(workspaceId, projectCode, {

    onBoardProgress: (current, total, name) => {

      console.log(`  tablero ${current}/${total}: ${name.slice(0, 60)}…`);

    },

  });



  const outPath = writeMondayExtract(payload);

  const { summary } = payload;



  console.log(`\nEscrito ${outPath}`);

  console.log("\n--- Resumen ---");

  console.log(`  Tableros: ${summary.boards_count}`);

  console.log(

    `  Rango fechas (snapshots): ${summary.snapshot_date_min ?? "—"} → ${summary.snapshot_date_max ?? "—"}`,

  );

  console.log(`  Items (raíz): ${summary.items_count}`);

  console.log(`  Subitems: ${summary.subitems_count}`);

  console.log(`  Updates (items + subitems): ${summary.updates_count}`);
  if (summary.updates_count === 0) {
    console.log(
      "  (Si el proyecto no usa Updates de Monday en actas, el histórico irá en log_entry tras migración.)",
    );
  }
}



main().catch((err: unknown) => {

  console.error(err instanceof Error ? err.message : err);

  process.exit(1);

});


