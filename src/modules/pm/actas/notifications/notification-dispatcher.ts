import type { SupabaseClient } from "@supabase/supabase-js";

import { sendTaskAlertEmail } from "@/lib/email/task-alert";

import { resolveNotificationRecipient } from "./logic/resolve-notification-recipient";
import type { NotificationChannel } from "./types";

export interface DeliverPendingResult {
  /** Alertas vencidas (remind_at <= now) aún sin email enviado. */
  due: number;
  emailSent: number;
  emailFailed: number;
  /** De las vencidas, cuántas incluyen canal in_app (entrega pasiva vía campana). */
  inAppCount: number;
  errors: string[];
}

type ProjectJoin = { id: string; name: string; owner_user_id: string | null };
type CategoryJoin = { project: ProjectJoin | ProjectJoin[] | null };
type ElementJoin = {
  name: string;
  timeline_end: string | null;
  category: CategoryJoin | CategoryJoin[] | null;
};

type DueRow = {
  id: string;
  element_id: string;
  created_by: string;
  remind_at: string;
  channels: string[] | null;
  element: ElementJoin | ElementJoin[] | null;
};

function one<T>(value: T | T[] | null): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

/** Días (redondeo al alza) hasta la fecha límite; fin del día para fechas date-only. */
function computeDaysRemaining(deadlineIso: string, nowMs: number): number {
  const iso = deadlineIso.includes("T") ? deadlineIso : `${deadlineIso}T23:59:59`;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 0;
  return Math.ceil((d.getTime() - nowMs) / 86_400_000);
}

const DUE_SELECT = `
  id,
  element_id,
  created_by,
  remind_at,
  channels,
  element!inner (
    name,
    timeline_end,
    category!inner (
      project!inner ( id, name, owner_user_id )
    )
  )
`;

/**
 * Checker de alertas: procesa las notificaciones cuyo `remind_at` ya pasó y a las
 * que aún no se les ha enviado correo (`email_sent_at IS NULL`).
 *
 * Para cada una resuelve el destinatario con la cascada
 * {@link resolveNotificationRecipient} (owner de proyecto → owner de elemento →
 * creador), envía el email de alerta y sella `email_sent_at`. La entrega in-app
 * (campana) sigue funcionando aparte vía `status`, por eso NO se toca `status`.
 *
 * Robustez: cada notificación se procesa de forma aislada; un fallo de envío se
 * registra y no rompe el resto ni la entrega in-app. Nunca se loguean credenciales.
 *
 * Requiere un cliente con SERVICE ROLE (lee auth.users vía admin API y salta RLS).
 */
export async function deliverPending(
  client: SupabaseClient,
): Promise<DeliverPendingResult> {
  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();

  const { data, error } = await client
    .from("element_notification")
    .select(DUE_SELECT)
    .is("email_sent_at", null)
    .lte("remind_at", nowIso);

  if (error) {
    return { due: 0, emailSent: 0, emailFailed: 0, inAppCount: 0, errors: [error.message] };
  }

  const rows = (data ?? []) as unknown as DueRow[];
  const errors: string[] = [];
  let emailSent = 0;
  let emailFailed = 0;
  let inAppCount = 0;

  // Caché de email por userId para no repetir llamadas a la admin API.
  const emailCache = new Map<string, string | null>();
  const resolveEmail = async (userId: string): Promise<string | null> => {
    if (emailCache.has(userId)) return emailCache.get(userId)!;
    const { data: u } = await client.auth.admin.getUserById(userId);
    const email = u?.user?.email?.trim() || null;
    emailCache.set(userId, email);
    return email;
  };

  for (const row of rows) {
    const channels = (row.channels ?? ["in_app"]) as NotificationChannel[];
    if (channels.includes("in_app")) inAppCount += 1;

    try {
      const element = one(row.element);
      const category = one(element?.category ?? null);
      const project = one(category?.project ?? null);
      if (!element || !project) {
        throw new Error("elemento/proyecto no resoluble (¿archivado?)");
      }

      const recipientId = await resolveNotificationRecipient(client, {
        elementId: row.element_id,
        projectOwnerUserId: project.owner_user_id,
        createdBy: row.created_by,
      });

      const to = await resolveEmail(recipientId);
      if (!to) {
        throw new Error(`destinatario ${recipientId} sin email`);
      }

      const deadlineIso = element.timeline_end ?? row.remind_at;

      await sendTaskAlertEmail({
        to,
        taskName: element.name,
        projectName: project.name,
        dueDate: deadlineIso,
        daysRemaining: computeDaysRemaining(deadlineIso, nowMs),
      });

      const { error: stampErr } = await client
        .from("element_notification")
        .update({ email_sent_at: new Date().toISOString() })
        .eq("id", row.id);
      if (stampErr) {
        // El correo SÍ se envió; avisar para evitar reenvío en la próxima pasada.
        throw new Error(`email enviado pero no se pudo sellar email_sent_at: ${stampErr.message}`);
      }

      emailSent += 1;
    } catch (err) {
      emailFailed += 1;
      errors.push(
        `notificación ${row.id}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  return { due: rows.length, emailSent, emailFailed, inAppCount, errors };
}
