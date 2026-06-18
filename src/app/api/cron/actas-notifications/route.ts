import { NextResponse, type NextRequest } from "next/server";

import { getCurrentUser } from "@/lib/auth/currentUser";
import { getUserRole } from "@/lib/auth/permissions";
import { createServiceRoleClient } from "@/lib/db/admin";
import { deliverPending } from "@/modules/pm/actas/notifications/notification-dispatcher";

export const dynamic = "force-dynamic";

/**
 * Checker de alertas de Actas: envía por correo las notificaciones vencidas
 * (remind_at <= now, email_sent_at IS NULL) al destinatario resuelto por cascada.
 *
 * No expuesto públicamente. Autorización:
 *   1) Sesión ICAM con rol admin de la zona pm, o
 *   2) cron desatendido con cabecera `Authorization: Bearer <CRON_SECRET>`
 *      (solo si CRON_SECRET está definido en el entorno).
 */
async function isAuthorized(request: NextRequest): Promise<boolean> {
  const user = await getCurrentUser();
  if (user && getUserRole(user, "pm") === "admin") return true;

  const secret = process.env.CRON_SECRET?.trim();
  if (secret) {
    const header = request.headers.get("authorization")?.trim();
    if (header === `Bearer ${secret}`) return true;
  }
  return false;
}

async function run(request: NextRequest) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }

  const client = createServiceRoleClient();
  const result = await deliverPending(client);
  return NextResponse.json({ ok: true, ...result });
}

export async function POST(request: NextRequest) {
  return run(request);
}

export async function GET(request: NextRequest) {
  return run(request);
}
