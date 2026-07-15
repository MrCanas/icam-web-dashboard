/**
 * Verifica el acceso app-only a la carpeta de SharePoint del maestro.
 *
 * Dos modos:
 *   1) Con SHAREPOINT_DRIVE_ID + SHAREPOINT_FOLDER_ITEM_ID en .env.local: lista la
 *      carpeta y muestra el maestro que sincronizaría el cron. Sirve para confirmar
 *      que el permiso concedido a la app funciona.
 *   2) Pasando un sharing link como argumento: resuelve driveId + itemId de ese
 *      recurso (carpeta o fichero). Solo funciona si la app ya tiene acceso.
 *
 *   npm run portfolio:check-sharepoint
 *   npx tsx scripts/portfolio/check-sharepoint.ts "<sharing-link>"
 *
 * Requiere en .env.local: MS_GRAPH_TENANT_ID / MS_GRAPH_CLIENT_ID / MS_GRAPH_CLIENT_SECRET.
 */
import { loadActasEnv } from "../actas/lib/env";
import { findMaestroInFolder, resolveShareTarget } from "../../src/lib/graph/sharepoint";

async function main(): Promise<void> {
  loadActasEnv();

  const link = process.argv[2]?.trim();
  if (link) {
    const t = await resolveShareTarget(link);
    console.log(`Recurso: ${t.name} (${t.folder ? "carpeta" : "fichero"})\n`);
    console.log("Pega esto en .env.local y en Vercel:\n");
    console.log(`SHAREPOINT_DRIVE_ID=${t.driveId}`);
    console.log(`SHAREPOINT_FOLDER_ITEM_ID=${t.itemId}`);
    return;
  }

  const driveId = process.env.SHAREPOINT_DRIVE_ID?.trim();
  const folderItemId = process.env.SHAREPOINT_FOLDER_ITEM_ID?.trim();
  if (!driveId || !folderItemId) {
    throw new Error(
      "Faltan SHAREPOINT_DRIVE_ID / SHAREPOINT_FOLDER_ITEM_ID en .env.local " +
        "(o pasa un sharing link como argumento).",
    );
  }
  const nameMatch = process.env.SHAREPOINT_FILE_NAME_MATCH?.trim() || "MAESTRO";

  const file = await findMaestroInFolder(driveId, folderItemId, nameMatch);
  console.log("Acceso OK. El cron sincronizaría este fichero:");
  console.log(`  ${file.name}  (modificado: ${file.lastModifiedDateTime ?? "?"})`);
}

main().catch((err) => {
  console.error("\nError:", err instanceof Error ? err.message : err);
  process.exit(1);
});
