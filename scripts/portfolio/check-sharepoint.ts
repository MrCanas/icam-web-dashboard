/**
 * Verifica el acceso app-only a la carpeta de SharePoint del maestro.
 *
 * Tres modos:
 *   1) Sin argumentos: busca el maestro como lo haría el cron y dice cuál cogería.
 *   2) `--list`: vuelca la carpeta ENTERA sin filtrar, más la configuración en uso.
 *      Es el modo de diagnóstico: si el cron dice que no encuentra el Excel, esto
 *      enseña qué hay de verdad ahí y con qué IDs se está mirando.
 *   3) Pasando un sharing link como argumento: resuelve driveId + itemId de ese
 *      recurso (carpeta o fichero). Solo funciona si la app ya tiene acceso.
 *
 *   npm run portfolio:check-sharepoint
 *   npm run portfolio:check-sharepoint -- --list
 *   npx tsx scripts/portfolio/check-sharepoint.ts "<sharing-link>"
 *
 * Requiere en .env.local: MS_GRAPH_TENANT_ID / MS_GRAPH_CLIENT_ID / MS_GRAPH_CLIENT_SECRET.
 *
 * Por qué existe el modo --list: hasta 2026-09-03 este script llamaba a la misma
 * `findMaestroInFolder` que el cron, así que fallaba exactamente igual y con el
 * mismo mensaje. Era un diagnóstico ciego, y por eso cuatro fallos semanales
 * seguidos no dijeron nada útil sobre su causa.
 */
import { loadActasEnv } from "../actas/lib/env";
import { findMaestroInFolder, listFolderChildren, resolveShareTarget } from "../../src/lib/graph/sharepoint";

/** Enseña un id largo sin volcarlo entero: sirve para comparar con Vercel de un vistazo. */
function huella(valor: string): string {
  if (valor.length <= 16) return valor;
  return `${valor.slice(0, 8)}…${valor.slice(-6)}  (${valor.length} car.)`;
}

async function listar(driveId: string, folderItemId: string, nameMatch: string): Promise<void> {
  console.log("— configuración en uso —");
  console.log(`  SHAREPOINT_DRIVE_ID        ${huella(driveId)}`);
  console.log(`  SHAREPOINT_FOLDER_ITEM_ID  ${huella(folderItemId)}`);
  console.log(`  SHAREPOINT_FILE_NAME_MATCH ${nameMatch}${process.env.SHAREPOINT_FILE_NAME_MATCH ? "" : "  (por defecto, no está en el entorno)"}`);
  console.log("\n  Compara estos tres con los de Vercel: si el cron falla y esto funciona,");
  console.log("  la diferencia está ahí y no en SharePoint.\n");

  const { children, paginas } = await listFolderChildren(driveId, folderItemId);
  console.log(`— contenido de la carpeta: ${children.length} elemento(s) en ${paginas} página(s) —`);
  if (children.length === 0) {
    console.log("  (vacía)");
  }
  for (const it of children) {
    const tipo = it.folder ? "carpeta " : it.file ? "fichero " : "?       ";
    const fecha = it.lastModifiedDateTime?.slice(0, 10) ?? "?";
    const casa = it.file && /\.xls[xmb]$/i.test(it.name) && it.name.toLowerCase().includes(nameMatch.toLowerCase());
    console.log(`  ${casa ? "→" : " "} ${tipo} ${fecha}  ${it.name}`);
  }

  const excels = children.filter((it) => it.file && /\.xls[xmb]$/i.test(it.name));
  console.log(`\n  Excel en la carpeta: ${excels.length}`);
  console.log(`  De ellos, con "${nameMatch}" en el nombre: ${excels.filter((e) => e.name.toLowerCase().includes(nameMatch.toLowerCase())).length}`);
  const subcarpetas = children.filter((it) => it.folder);
  if (subcarpetas.length) {
    console.log(`  Subcarpetas (el cron NO entra en ellas): ${subcarpetas.map((s) => s.name).join(", ")}`);
  }
}

async function main(): Promise<void> {
  loadActasEnv();

  const args = process.argv.slice(2).map((a) => a.trim());
  const list = args.includes("--list");
  const link = args.find((a) => a && !a.startsWith("--"));

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

  if (list) {
    await listar(driveId, folderItemId, nameMatch);
    return;
  }

  const file = await findMaestroInFolder(driveId, folderItemId, nameMatch);
  console.log("Acceso OK. El cron sincronizaría este fichero:");
  console.log(`  ${file.name}  (modificado: ${file.lastModifiedDateTime ?? "?"})`);
  console.log("\nSi el cron falla igualmente, mira con --list: el problema estará en los");
  console.log("SHAREPOINT_* de Vercel, no en SharePoint.");
}

main().catch((err) => {
  console.error("\nError:", err instanceof Error ? err.message : err);
  process.exit(1);
});
