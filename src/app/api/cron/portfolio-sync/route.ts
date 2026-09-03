import { NextResponse, type NextRequest } from "next/server";

import { getCurrentUser, type UserContext } from "@/lib/auth/currentUser";
import { getUserRole } from "@/lib/auth/permissions";
import { sendGraphMail } from "@/lib/email";
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
 * `?force=true` salta el gate horario para sincronizar a demanda; vale con cualquiera de
 * las dos vías de autorización (el botón de la pestaña Datos usa la sesión de admin).
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

  // `request.url` es la URL cruda: `request.nextUrl` puede llegar normalizado y perder la
  // query, que es justo lo que dejaba `?force=true` sin efecto en producción.
  const sawForce =
    new URL(request.url).searchParams.get("force") === "true" ||
    request.nextUrl.searchParams.get("force") === "true";

  const force = sawForce && (isAdmin || bearerOk);
  if (!force && !isMadridWednesday10()) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: "Fuera de la ventana (miércoles 10:00 Europe/Madrid).",
      // Por qué no se forzó, para que el salto sea diagnosticable desde el cliente.
      sawForce,
      isAdmin,
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

/**
 * Deja traza del fallo de descarga en upload_logs (sin enmascarar el error original)
 * y avisa por correo.
 *
 * El aviso existe porque la traza sola no bastó: el sync falló cuatro miércoles
 * seguidos escribiendo aquí su error, y nadie lo miró en un mes. Un log que nadie
 * consulta no es una alerta.
 *
 * Se envía a PORTFOLIO_SYNC_ALERT_TO y, si no está definida, a EMAIL_FROM — que
 * siempre lo está, porque sin él no hay envío posible. Nunca revienta el cron: si
 * el correo falla, el error de descarga sigue siendo el que se devuelve.
 */
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

  try {
    const to = process.env.PORTFOLIO_SYNC_ALERT_TO?.trim() || process.env.EMAIL_FROM?.trim();
    if (!to) return;
    await sendGraphMail({
      to,
      subject: "ICAM · la sincronización del maestro financiero ha fallado",
      html:
        `<p>El cron <code>/api/cron/portfolio-sync</code> no ha podido descargar el maestro ` +
        `de SharePoint. El portfolio sigue mostrando los datos de la última carga buena.</p>` +
        `<p><b>Error:</b><br><code>${escaparHtml(msg)}</code></p>` +
        `<p>Para ver qué hay realmente en la carpeta y con qué IDs se está mirando:<br>` +
        `<code>npm run portfolio:check-sharepoint -- --list</code></p>`,
    });
  } catch {
    // no-op: avisar es un extra; que falle el aviso no debe cambiar la respuesta.
  }
}

function escaparHtml(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export async function POST(request: NextRequest) {
  return run(request);
}

export async function GET(request: NextRequest) {
  return run(request);
}
