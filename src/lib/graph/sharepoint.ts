/**
 * Acceso a SharePoint vía Microsoft Graph con el token app-only compartido.
 *
 * Modelo de permiso: mínimo privilegio. La app tiene `Sites.Selected` y un admin le
 * concede rol de lectura SOLO sobre una carpeta concreta (`POST /drives/{driveId}/
 * items/{folderId}/permissions`). El acceso a esa carpeta cubre los ficheros dentro.
 *
 * Por eso el cron direcciona por CARPETA (`driveId` + `folderItemId`) y localiza el
 * maestro dentro de ella, en lugar de usar el enlace de compartir (`/shares`, que da
 * 403 con Sites.Selected). SOLO servidor.
 */
import { graphFetch } from "@/lib/graph/client";

export interface DownloadedFile {
  buffer: ArrayBuffer;
  filename: string;
}

export interface DriveChild {
  id: string;
  name: string;
  file?: { mimeType?: string };
  folder?: { childCount?: number };
  lastModifiedDateTime?: string;
}

const EXCEL_NAME_RE = /\.xls[xmb]$/i;

async function errorDetail(res: Response): Promise<string> {
  const body = await res.text().catch(() => "");
  return body ? `: ${body.slice(0, 200)}` : "";
}

/**
 * Vuelca la carpeta entera, siguiendo la paginación de Graph.
 *
 * Se expone porque el diagnóstico necesita ver lo que hay SIN filtrar: cuando el
 * cron dice que no encuentra el maestro, la pregunta útil es qué había realmente
 * en la carpeta, no repetir la misma búsqueda que ya falló.
 */
export async function listFolderChildren(
  driveId: string,
  folderItemId: string,
): Promise<{ children: DriveChild[]; paginas: number }> {
  const children: DriveChild[] = [];
  let paginas = 0;
  let url: string | null =
    `/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(folderItemId)}/children` +
    `?$select=id,name,file,folder,lastModifiedDateTime&$top=200`;

  while (url) {
    const res: Response = await graphFetch(url);
    if (!res.ok) {
      throw new Error(
        `No se pudo listar la carpeta de SharePoint (HTTP ${res.status})` +
          `${await errorDetail(res)}. Revisa driveId/folderItemId y el permiso concedido a la app.`,
      );
    }
    const json = (await res.json()) as { value?: DriveChild[]; "@odata.nextLink"?: string };
    children.push(...(json.value ?? []));
    paginas += 1;
    // El nextLink viene absoluto; graphFetch acepta ambas formas.
    url = json["@odata.nextLink"] ?? null;
  }

  return { children, paginas };
}

/**
 * Localiza el fichero maestro dentro de la carpeta concedida: el Excel (.xlsx/.xlsm/
 * .xlsb) cuyo nombre contiene `nameMatch`; si hay varios, el más reciente.
 *
 * Si no lo encuentra, el error dice qué había en la carpeta. Sin eso, el mensaje
 * («no se encontró ningún Excel con "MAESTRO"») no distingue entre carpeta
 * equivocada, fichero renombrado o fichero movido a una subcarpeta — y esa
 * ambigüedad dejó el sync roto sin diagnosticar desde que se puso en marcha.
 */
export async function findMaestroInFolder(
  driveId: string,
  folderItemId: string,
  nameMatch = "MAESTRO",
): Promise<DriveChild> {
  const { children } = await listFolderChildren(driveId, folderItemId);

  const match = (nameMatch || "").toLowerCase();
  const excels = children.filter((it) => it.file && EXCEL_NAME_RE.test(it.name));
  const candidates = excels.filter(
    (it) => match === "" || it.name.toLowerCase().includes(match),
  );

  if (candidates.length === 0) {
    const subcarpetas = children.filter((it) => it.folder).map((it) => it.name);
    const muestra = children.slice(0, 5).map((it) => it.name);
    throw new Error(
      `No se encontró ningún Excel${nameMatch ? ` con "${nameMatch}" en el nombre` : ""} ` +
        `en la carpeta de SharePoint. La carpeta tenía ${children.length} elemento(s), ` +
        `de ellos ${excels.length} Excel` +
        (subcarpetas.length ? `, y ${subcarpetas.length} subcarpeta(s) en las que el cron no entra: ${subcarpetas.join(", ")}` : "") +
        (muestra.length ? `. Primeros nombres: ${muestra.join(", ")}` : "") +
        `. Revisa SHAREPOINT_FOLDER_ITEM_ID y SHAREPOINT_FILE_NAME_MATCH en el entorno del despliegue.`,
    );
  }

  candidates.sort((a, b) => (b.lastModifiedDateTime ?? "").localeCompare(a.lastModifiedDateTime ?? ""));
  return candidates[0];
}

/**
 * Descarga el maestro desde la carpeta concedida (`driveId` + `folderItemId`).
 * Devuelve el buffer (listo para `parseMaestroWorkbook`) y el nombre del fichero.
 */
export async function downloadMaestroFromFolder(
  driveId: string,
  folderItemId: string,
  nameMatch = "MAESTRO",
): Promise<DownloadedFile> {
  if (!driveId?.trim() || !folderItemId?.trim()) {
    throw new Error("Faltan SHAREPOINT_DRIVE_ID / SHAREPOINT_FOLDER_ITEM_ID en el entorno.");
  }

  const file = await findMaestroInFolder(driveId.trim(), folderItemId.trim(), nameMatch);

  const contentRes = await graphFetch(
    `/drives/${encodeURIComponent(driveId.trim())}/items/${encodeURIComponent(file.id)}/content`,
  );
  if (!contentRes.ok) {
    throw new Error(
      `No se pudo descargar "${file.name}" de SharePoint (HTTP ${contentRes.status})` +
        `${await errorDetail(contentRes)}.`,
    );
  }

  const buffer = await contentRes.arrayBuffer();
  return { buffer, filename: file.name };
}

export interface ResolvedShareTarget {
  driveId: string;
  itemId: string;
  name: string;
  folder: boolean;
}

/** Codifica una sharing URL al `shareId` que espera el endpoint /shares de Graph. */
export function encodeShareId(sharingUrl: string): string {
  return "u!" + Buffer.from(sharingUrl, "utf-8").toString("base64url");
}

/**
 * Resuelve `driveId` + `itemId` (de una carpeta o fichero) a partir de un sharing link.
 * Solo funciona si la app ya tiene acceso al recurso; útil para verificar tras conceder
 * el permiso. En la configuración inicial es más fiable obtener los IDs desde Graph
 * Explorer (contexto delegado del admin).
 */
export async function resolveShareTarget(sharingUrl: string): Promise<ResolvedShareTarget> {
  if (!sharingUrl?.trim()) {
    throw new Error("Falta la URL de SharePoint (sharing link).");
  }
  const res = await graphFetch(
    `/shares/${encodeShareId(sharingUrl.trim())}/driveItem?$select=id,name,parentReference,folder`,
  );
  if (!res.ok) {
    throw new Error(
      `No se pudo resolver el sharing link (HTTP ${res.status})` +
        `${await errorDetail(res)}. La app necesita acceso concedido a ese recurso.`,
    );
  }
  const item = (await res.json()) as {
    id?: string;
    name?: string;
    parentReference?: { driveId?: string };
    folder?: unknown;
  };
  const driveId = item.parentReference?.driveId;
  const itemId = item.id;
  if (!driveId || !itemId) {
    throw new Error("La respuesta de Graph no incluyó driveId/itemId.");
  }
  return { driveId, itemId, name: item.name?.trim() || "", folder: item.folder != null };
}
