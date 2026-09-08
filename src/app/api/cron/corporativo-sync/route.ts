import { NextResponse, type NextRequest } from "next/server";

import { getCurrentUser, type UserContext } from "@/lib/auth/currentUser";
import { getUserRole } from "@/lib/auth/permissions";
import { sendGraphMail } from "@/lib/email";
import { downloadMaestroFromFolder } from "@/lib/graph/sharepoint";
import { insertCorporativoUploadLog } from "@/modules/corporativo/data/corpPeriodosRepository";
import { commitCorporativoReplace } from "@/modules/corporativo/logic/commitCorporativoUpload";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Sincronización semanal del maestro CORPORATIVO desde SharePoint.
 *
 * Gemela de /api/cron/portfolio-sync y con el mismo diseño: dos disparos UTC los
 * miércoles (08:00 y 09:00) en vercel.json, y una puerta horaria que deja pasar
 * solo el que caiga a las 10:00 de Madrid, de modo que la sincronización ocurre
 * a las 10:00 locales todo el año sin depender del horario de verano.
 *
 * Ruta aparte y no un paso más del cron de portfolio: son dos ficheros, dos
 * tablas y dos formas de fallar. Compartir ruta haría que un maestro de
 * vehículos ilegible impidiera actualizar el corporativo, y al revés.
 *
 * Los dos maestros viven en la MISMA carpeta de SharePoint, así que comparten
 * SHAREPOINT_DRIVE_ID y SHAREPOINT_FOLDER_ITEM_ID; lo único que cambia es qué
 * fichero se busca dentro. `findMaestroInFolder` aborta si el patrón casa con
 * más de uno, así que SHAREPOINT_CORPORATIVO_NAME_MATCH tiene que ser
 * suficientemente específico («MAESTRO_CORPORATIVO», no «MAESTRO»).
 *
 * Autorización:
 *   1) Sesión ICAM con rol admin de la zona `corporativo`, o
 *   2) cron desatendido con `Authorization: Bearer <CRON_SECRET>`.
 * `?force=true` salta la puerta horaria con cualquiera de las dos vías.
 */
const SYSTEM_CTX: UserContext = {
  id: "00000000-0000-0000-0000-000000000000",
  email: "corporativo-cron@imparcapital.com",
  name: "Cron Corporativo Sync",
  zones: [],
  isPlatformAdmin: false,
  deniedRouteKeys: [],
};

const NAME_MATCH_POR_DEFECTO = "MAESTRO_CORPORATIVO";

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
  const isAdmin = !!user && getUserRole(user, "corporativo") === "admin";

  const secret = process.env.CRON_SECRET?.trim();
  const bearerOk =
    !!secret && request.headers.get("authorization")?.trim() === `Bearer ${secret}`;

  if (!isAdmin && !bearerOk) {
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }

  // `request.url` es la URL cruda: `request.nextUrl` puede llegar normalizado y
  // perder la query, que es lo que dejaba `?force=true` sin efecto en producción.
  const sawForce =
    new URL(request.url).searchParams.get("force") === "true" ||
    request.nextUrl.searchParams.get("force") === "true";

  const force = sawForce && (isAdmin || bearerOk);
  if (!force && !isMadridWednesday10()) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: "Fuera de la ventana (miércoles 10:00 Europe/Madrid).",
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
  const nameMatch =
    process.env.SHAREPOINT_CORPORATIVO_NAME_MATCH?.trim() || NAME_MATCH_POR_DEFECTO;

  let file: { buffer: ArrayBuffer; filename: string };
  try {
    file = await downloadMaestroFromFolder(driveId, folderItemId, nameMatch);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error descargando de SharePoint";
    await logDownloadError(msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 502 });
  }

  const result = await commitCorporativoReplace(SYSTEM_CTX, file.buffer, file.filename);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
  }

  return NextResponse.json({
    ok: true,
    archivo: file.filename,
    numFilas: result.numFilas,
    duracion_ms: result.duracion_ms,
    resumen: result.diff.resumen,
    ...(result.metadatosError ? { metadatos_error: result.metadatosError } : {}),
  });
}

/**
 * Deja traza del fallo de descarga en upload_logs y avisa por correo.
 *
 * El aviso existe por lo aprendido con el cron de portfolio: falló cuatro
 * miércoles seguidos escribiendo su error en una tabla que nadie miró en un mes.
 * Un log que nadie consulta no es una alerta.
 *
 * Nunca revienta el cron: si el correo falla, el error de descarga sigue siendo
 * el que se devuelve.
 */
async function logDownloadError(msg: string): Promise<void> {
  try {
    await insertCorporativoUploadLog(SYSTEM_CTX, {
      archivo: "SharePoint (descarga corporativo)",
      num_proyectos: 0,
      estado: "error",
      duracion_ms: 0,
      detalle: { origen: "cron/corporativo-sync", error: msg },
    });
  } catch {
    // no-op: el error de descarga ya se devuelve al llamante.
  }

  try {
    const to = process.env.PORTFOLIO_SYNC_ALERT_TO?.trim() || process.env.EMAIL_FROM?.trim();
    if (!to) return;
    await sendGraphMail({
      to,
      subject: "ICAM · la sincronización del maestro corporativo ha fallado",
      html:
        `<p>El cron <code>/api/cron/corporativo-sync</code> no ha podido descargar el maestro ` +
        `corporativo de SharePoint. El tab Corporativas sigue mostrando los datos de la última ` +
        `carga buena.</p>` +
        `<p><b>Error:</b><br><code>${escaparHtml(msg)}</code></p>` +
        `<p>Para ver qué hay realmente en la carpeta y con qué IDs se está mirando:<br>` +
        `<code>npm run corporativo:check-sharepoint -- --list</code></p>`,
    });
  } catch {
    // no-op: avisar es un extra; que falle el aviso no debe cambiar la respuesta.
  }
}

function escaparHtml(texto: string): string {
  return texto.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function POST(request: NextRequest) {
  return run(request);
}

export async function GET(request: NextRequest) {
  return run(request);
}
