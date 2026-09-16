import { NextResponse, type NextRequest } from "next/server";

import { getCurrentUser, type UserContext } from "@/lib/auth/currentUser";
import { canAccessRouteKey, getUserRole } from "@/lib/auth/permissions";
import { sendGraphMail } from "@/lib/email";
import { sincronizarInversores } from "@/modules/portfolio/inversores/logic/inversoresSync";
import { INVERSORES_ROUTE_KEY } from "@/modules/portfolio/inversores/logic/paths";

export const dynamic = "force-dynamic";
// Los otros dos crones se apañan con 60 s porque descargan UN Excel. Aquí hay
// que paginar seis módulos de Zoho, y `Aportes_Repartos` puede ser grande.
export const maxDuration = 300;

/**
 * Sincronización diaria de Inversores desde Zoho CRM.
 *
 * Mismo diseño que /api/cron/portfolio-sync y /api/cron/corporativo-sync: dos
 * disparos UTC en vercel.json (04:00 y 05:00) y una puerta horaria que deja
 * pasar solo el que caiga a las 06:00 de Madrid, de modo que ocurre a las 06:00
 * locales todo el año sin depender del horario de verano.
 *
 * Diaria y no semanal porque los flujos de aportes y repartos se dan de alta
 * todos los días, y un dato de hace una semana en una pantalla de dinero se
 * confunde con el de hoy.
 *
 * Autorización:
 *   1) Sesión ICAM con rol admin de `financiero` Y acceso a la pestaña, o
 *   2) cron desatendido con `Authorization: Bearer <CRON_SECRET>`.
 * `?force=true` salta la puerta horaria con cualquiera de las dos vías.
 * `?modulo=Aportes_Repartos` sincroniza solo ese módulo: la salida de
 * emergencia si algún día no cabe en la ventana de la función.
 *
 * SOLO LECTURA contra Zoho: este cron no escribe nunca en el CRM.
 */
const SYSTEM_CTX: UserContext = {
  id: "00000000-0000-0000-0000-000000000000",
  email: "inversores-cron@imparcapital.com",
  name: "Cron Inversores Sync",
  zones: [],
  isPlatformAdmin: false,
  deniedRouteKeys: [],
};

/** ¿Son ahora mismo las 06:00 en Europe/Madrid? */
function esHoraMadrid(hora: number, now = new Date()): boolean {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Madrid",
    hour: "numeric",
    hour12: false,
  }).formatToParts(now);
  return Number(partes.find((p) => p.type === "hour")?.value) === hora;
}

async function run(request: NextRequest) {
  const user = await getCurrentUser();
  // La zona `financiero` la tiene mucha gente: el rol de admin no basta por sí
  // solo para disparar la sincronización de una pestaña que puede tener
  // denegada. Los otros crones no necesitan esta segunda condición porque sus
  // zonas no tienen páginas restringidas.
  const isAdmin =
    !!user &&
    getUserRole(user, "financiero") === "admin" &&
    canAccessRouteKey(user, INVERSORES_ROUTE_KEY);

  const secret = process.env.CRON_SECRET?.trim();
  const bearerOk =
    !!secret && request.headers.get("authorization")?.trim() === `Bearer ${secret}`;

  if (!isAdmin && !bearerOk) {
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }

  // `request.url` es la URL cruda: `request.nextUrl` puede llegar normalizado y
  // perder la query, que es lo que dejaba `?force=true` sin efecto en producción.
  const params = new URL(request.url).searchParams;
  const sawForce =
    params.get("force") === "true" || request.nextUrl.searchParams.get("force") === "true";
  const force = sawForce && (isAdmin || bearerOk);

  if (!force && !esHoraMadrid(6)) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: "Fuera de la ventana (06:00 Europe/Madrid).",
      sawForce,
      isAdmin,
    });
  }

  const modulo = params.get("modulo")?.trim();
  const ctx = isAdmin && user ? user : SYSTEM_CTX;

  const resultado = await sincronizarInversores(ctx, {
    origen: bearerOk && !isAdmin ? "cron" : "manual",
    ...(modulo ? { soloModulos: [modulo] } : {}),
  });

  if (!resultado.ok) {
    await avisar(`La sincronización no llegó a ejecutarse.\n\n${resultado.error}`);
    return NextResponse.json({ ok: false, error: resultado.error }, { status: 502 });
  }

  if (resultado.estado === "parcial") {
    const fallidos = resultado.modulos.filter((m) => m.error);
    await avisar(
      "La sincronización terminó a medias. Los módulos que fallaron conservan su última carga buena.\n\n" +
        fallidos.map((m) => `${m.modulo}: ${m.error}`).join("\n"),
    );
  }

  return NextResponse.json({
    ok: true,
    estado: resultado.estado,
    syncId: resultado.syncId,
    duracion_ms: resultado.duracionMs,
    modulos: resultado.modulos,
    ...(resultado.avisos.length > 0 ? { avisos: resultado.avisos } : {}),
  });
}

/**
 * Avisa por correo. Nunca revienta el cron.
 *
 * Existe por lo aprendido con el cron de portfolio: falló cuatro miércoles
 * seguidos escribiendo su error en una tabla que nadie miró en un mes. Un log
 * que nadie consulta no es una alerta.
 */
async function avisar(detalle: string): Promise<void> {
  try {
    const to = process.env.PORTFOLIO_SYNC_ALERT_TO?.trim() || process.env.EMAIL_FROM?.trim();
    if (!to) return;
    await sendGraphMail({
      to,
      subject: "ICAM · la sincronización de Inversores ha fallado",
      html:
        `<p>El cron <code>/api/cron/inversores-sync</code> no ha podido traer los datos de Zoho ` +
        `CRM. La pestaña Inversores sigue mostrando la última carga buena.</p>` +
        `<p><b>Detalle:</b><br><code>${escaparHtml(detalle)}</code></p>` +
        `<p>Para ver el estado del mapeo de campos:<br>` +
        `<code>npm run inversores:zoho-descubrir</code></p>`,
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
