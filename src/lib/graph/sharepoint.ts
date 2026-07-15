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

interface DriveChild {
  id: string;
  name: string;
  file?: { mimeType?: string };
  lastModifiedDateTime?: string;
}

const EXCEL_NAME_RE = /\.xls[xmb]$/i;

async function errorDetail(res: Response): Promise<string> {
  const body = await res.text().catch(() => "");
  return body ? `: ${body.slice(0, 200)}` : "";
}

/**
 * Localiza el fichero maestro dentro de la carpeta concedida: el Excel (.xlsx/.xlsm/
 * .xlsb) cuyo nombre contiene `nameMatch`; si hay varios, el más reciente.
 */
export async function findMaestroInFolder(
  driveId: string,
  folderItemId: string,
  nameMatch = "MAESTRO",
): Promise<DriveChild> {
  const res = await graphFetch(
    `/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(folderItemId)}/children` +
      `?$select=id,name,file,lastModifiedDateTime&$top=200`,
  );
  if (!res.ok) {
    throw new Error(
      `No se pudo listar la carpeta de SharePoint (HTTP ${res.status})` +
        `${await errorDetail(res)}. Revisa driveId/folderItemId y el permiso concedido a la app.`,
    );
  }
  const json = (await res.json()) as { value?: DriveChild[] };
  const match = (nameMatch || "").toLowerCase();
  const candidates = (json.value ?? []).filter(
    (it) =>
      it.file &&
      EXCEL_NAME_RE.test(it.name) &&
      (match === "" || it.name.toLowerCase().includes(match)),
  );
  if (candidates.length === 0) {
    throw new Error(
      `No se encontró ningún Excel${nameMatch ? ` con "${nameMatch}" en el nombre` : ""} en la carpeta de SharePoint.`,
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
