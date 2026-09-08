/**
 * Verifica que el cron corporativo encuentra SU maestro en la carpeta de
 * SharePoint, y solo ese.
 *
 * Los dos maestros —el de vehículos y el corporativo— viven en la misma carpeta,
 * así que comparten SHAREPOINT_DRIVE_ID y SHAREPOINT_FOLDER_ITEM_ID y lo único
 * que los separa es el patrón de nombre. Desde que `findMaestroInFolder` aborta
 * cuando el patrón casa con más de un fichero, el fallo típico ya no es «no lo
 * encuentro» sino «encuentro dos y no sé cuál es»; por eso este script imprime
 * cómo quedan repartidos los Excel entre los DOS patrones, no solo el propio.
 *
 * Modos:
 *   npm run corporativo:check-sharepoint            # dice qué fichero cogería
 *   npm run corporativo:check-sharepoint -- --list  # vuelca la carpeta entera
 *
 * Requiere en .env.local: MS_GRAPH_TENANT_ID / MS_GRAPH_CLIENT_ID /
 * MS_GRAPH_CLIENT_SECRET / SHAREPOINT_DRIVE_ID / SHAREPOINT_FOLDER_ITEM_ID.
 */
import { loadActasEnv } from "../actas/lib/env";
import { findMaestroInFolder, listFolderChildren } from "../../src/lib/graph/sharepoint";

const EXCEL_RE = /\.xls[xmb]$/i;
const CORPORATIVO_POR_DEFECTO = "MAESTRO_CORPORATIVO";
const VEHICULOS_POR_DEFECTO = "MAESTRO";

/** Enseña un id largo sin volcarlo entero: sirve para compararlo con Vercel. */
function huella(valor: string): string {
  if (valor.length <= 16) return valor;
  return `${valor.slice(0, 8)}…${valor.slice(-6)}  (${valor.length} car.)`;
}

function casa(nombre: string, patron: string): boolean {
  return EXCEL_RE.test(nombre) && nombre.toLowerCase().includes(patron.toLowerCase());
}

async function listar(
  driveId: string,
  folderItemId: string,
  patronCorp: string,
  patronVeh: string,
): Promise<void> {
  console.log("— configuración en uso —");
  console.log(`  SHAREPOINT_DRIVE_ID                 ${huella(driveId)}`);
  console.log(`  SHAREPOINT_FOLDER_ITEM_ID           ${huella(folderItemId)}`);
  console.log(
    `  SHAREPOINT_CORPORATIVO_NAME_MATCH   ${patronCorp}` +
      (process.env.SHAREPOINT_CORPORATIVO_NAME_MATCH ? "" : "  (por defecto, no está en el entorno)"),
  );
  console.log(
    `  SHAREPOINT_FILE_NAME_MATCH          ${patronVeh}` +
      (process.env.SHAREPOINT_FILE_NAME_MATCH ? "" : "  (por defecto, no está en el entorno)"),
  );
  console.log("\n  Compara estos con los de Vercel: si el cron falla y esto funciona,");
  console.log("  la diferencia está ahí y no en SharePoint.\n");

  const { children, paginas } = await listFolderChildren(driveId, folderItemId);
  console.log(`— contenido de la carpeta: ${children.length} elemento(s) en ${paginas} página(s) —`);
  if (children.length === 0) console.log("  (vacía)");

  for (const it of children) {
    const tipo = it.folder ? "carpeta " : it.file ? "fichero " : "?       ";
    const fecha = it.lastModifiedDateTime?.slice(0, 10) ?? "?";
    const marcas = [
      casa(it.name, patronCorp) ? "CORP" : null,
      casa(it.name, patronVeh) ? "VEH" : null,
    ]
      .filter(Boolean)
      .join("+");
    console.log(`  ${marcas ? `→ [${marcas}]` : "        "} ${tipo} ${fecha}  ${it.name}`);
  }

  const corp = children.filter((it) => it.file && casa(it.name, patronCorp));
  const veh = children.filter((it) => it.file && casa(it.name, patronVeh));
  console.log(`\n  Casan con el patrón CORPORATIVO: ${corp.length} → ${corp.map((c) => c.name).join(", ") || "(ninguno)"}`);
  console.log(`  Casan con el patrón VEHÍCULOS:   ${veh.length} → ${veh.map((c) => c.name).join(", ") || "(ninguno)"}`);

  // El aviso que importa: cada cron tiene que quedarse con exactamente uno.
  if (corp.length !== 1) {
    console.log(`\n  ⚠ El cron corporativo abortará: necesita exactamente 1 fichero, hay ${corp.length}.`);
  }
  const solapan = corp.filter((c) => veh.some((v) => v.name === c.name));
  if (solapan.length > 0) {
    console.log(
      `\n  ⚠ ${solapan.length} fichero(s) casan con AMBOS patrones (${solapan.map((s) => s.name).join(", ")}). ` +
        "Afina SHAREPOINT_FILE_NAME_MATCH para que el de vehículos no se lleve el corporativo.",
    );
  }
}

async function main(): Promise<void> {
  loadActasEnv();

  const args = process.argv.slice(2).map((a) => a.trim());
  const driveId = process.env.SHAREPOINT_DRIVE_ID?.trim();
  const folderItemId = process.env.SHAREPOINT_FOLDER_ITEM_ID?.trim();
  if (!driveId || !folderItemId) {
    throw new Error("Faltan SHAREPOINT_DRIVE_ID / SHAREPOINT_FOLDER_ITEM_ID en .env.local.");
  }

  const patronCorp =
    process.env.SHAREPOINT_CORPORATIVO_NAME_MATCH?.trim() || CORPORATIVO_POR_DEFECTO;
  const patronVeh = process.env.SHAREPOINT_FILE_NAME_MATCH?.trim() || VEHICULOS_POR_DEFECTO;

  if (args.includes("--list")) {
    await listar(driveId, folderItemId, patronCorp, patronVeh);
    return;
  }

  const file = await findMaestroInFolder(driveId, folderItemId, patronCorp);
  console.log("Acceso OK. El cron corporativo sincronizaría este fichero:");
  console.log(`  ${file.name}  (modificado: ${file.lastModifiedDateTime ?? "?"})`);
  console.log("\nSi el cron falla igualmente, mira con --list: el problema estará en los");
  console.log("SHAREPOINT_* de Vercel, no en SharePoint.");
}

main().catch((err) => {
  console.error("\nError:", err instanceof Error ? err.message : err);
  process.exit(1);
});
