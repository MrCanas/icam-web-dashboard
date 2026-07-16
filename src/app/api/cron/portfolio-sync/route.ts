import { NextResponse, type NextRequest } from "next/server";

import { getCurrentUser, type UserContext } from "@/lib/auth/currentUser";
import { getUserRole } from "@/lib/auth/permissions";
import { downloadMaestroFromFolder } from "@/lib/graph/sharepoint";
import { commitMaestroReplace } from "@/modules/portfolio/logic/commitMaestroUpload";
import { insertUploadLog } from "@/modules/portfolio/data/uploadLogsRepository";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Sincronización semanal del portfolio financiero desde SharePoint.
 *
 * Descarga el maestro (sharing link en SHAREPOINT_MAESTRO_URL) vía Microsoft Graph
 * y ejecuta el mismo pipeline de reemplazo que la subida manual, dejando traza en
 * upload_logs. Programado en vercel.json con DOS disparos UTC (08:00 y 09:00 los
 * miércoles); el gate horario deja pasar solo el que caiga a las 10:00 de Madrid,
 * de modo que la sincronización ocurre a las 10:00 locales todo el año (DST-safe).
 *
 * Autorización:
 *   1) Sesión ICAM con rol admin de la zona `financiero`, o
 *   2) cron desatendido con `Authorization: Bearer <CRON_SECRET>` (Vercel Cron lo
 *      envía automáticamente cuando CRON_SECRET está en el entorno).
 * `?force=true` (solo sesión admin) salta el gate horario para pruebas manuales.
 */
const SYSTEM_CTX: UserContext = {
  id: "00000000-0000-0000-0000-000000000000",
  email: "portfolio-cron@imparcapital.com",
  name: "Cron Portfolio Sync",
  zones: [],
  isPlatformAdmin: false,
  deniedRouteKeys: [],
};

/** ¿Es ahora mismo miércoles a las 10:00 en Europe/Madrid? */
function isMadridWednesday10(now = new Date()): boolean {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Madrid",
    weekday: "long",
    hour: "numeric",
    hour12: false,
  }).formatToParts(now);
  const weekday = parts.find((p) => p.type === "weekday")?.value;
  const hour = Number(parts.find((p) => p.type === "hour")?.value);
  return weekday === "Wednesday" && hour === 10;
}

async function run(request: NextRequest) {
  const user = await getCurrentUser();
  const isAdmin = !!user && getUserRole(user, "financiero") === "admin";

  const secret = process.env.CRON_SECRET?.trim();
  const bearerOk =
    !!secret && request.headers.get("authorization")?.trim() === `Bearer ${secret}`;

  if (!isAdmin && !bearerOk) {
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }

  const force = request.nextUrl.searchParams.get("force") === "true" && isAdmin;
  if (!force && !isMadridWednesday10()) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: "Fuera de la ventana (miércoles 10:00 Europe/Madrid).",
    });
  }

  const driveId = process.env.SHAREPOINT_DRIVE_ID?.trim();
  const folderItemId = process.env.SHAREPOINT_FOLDER_ITEM_ID?.trim();
  if (!driveId || !folderItemId) {
    return NextResponse.json(
      { ok: false, error: "Faltan SHAREPOINT_DRIVE_ID / SHAREPOINT_FOLDER_ITEM_ID en el entorno." },
      { status: 500 },
    );
  }
  const nameMatch = process.env.SHAREPOINT_FILE_NAME_MATCH?.trim() || "MAESTRO";

  let file: { buffer: ArrayBuffer; filename: string };
  try {
    file = await downloadMaestroFromFolder(driveId, folderItemId, nameMatch);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error descargando de SharePoint";
    await logDownloadError(msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 502 });
  }

  const result = await commitMaestroReplace(SYSTEM_CTX, file.buffer, file.filename);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
  }

  return NextResponse.json({
    ok: true,
    archivo: file.filename,
    numProyectos: result.numProyectos,
    duracion_ms: result.duracion_ms,
    resumen: result.comparison.resumen,
  });
}

/** Deja traza del fallo de descarga en upload_logs (sin enmascarar el error original). */
async function logDownloadError(msg: string): Promise<void> {
  try {
    await insertUploadLog(SYSTEM_CTX, {
      archivo: "SharePoint (descarga)",
      num_proyectos: 0,
      estado: "error",
      duracion_ms: 0,
      detalle: { origen: "cron/portfolio-sync", error: msg },
    });
  } catch {
    // no-op: el error de descarga ya se devuelve al llamante.
  }
}

export async function POST(request: NextRequest) {
  return run(request);
}

export async function GET(request: NextRequest) {
  return run(request);
}
