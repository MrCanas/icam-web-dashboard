import type { SupabaseClient } from "@supabase/supabase-js";

import type { NotificationChannel } from "./types";

export type DeliverPendingResult = {
  inAppCount: number;
  emailQueued: number;
  emailSent: number;
  errors: string[];
};

/**
 * Procesa notificaciones cuyo `remind_at` ya pasó y siguen en `pending`.
 *
 * - **in_app**: no requiere acción activa; la campana consulta la tabla directamente.
 * - **email**: TODO — encolar/enviar desde aquí cuando exista proveedor + cron.
 *
 * @example
 * // Futuro cron (no implementado):
 * // const { client } = await getActasAuthenticatedSupabase();
 * // await deliverPending(client);
 */
export async function deliverPending(
  client: SupabaseClient,
): Promise<DeliverPendingResult> {
  const now = new Date().toISOString();

  const { data, error } = await client
    .from("element_notification")
    .select("id, channels, status, remind_at")
    .eq("status", "pending")
    .lte("remind_at", now);

  if (error) {
    return {
      inAppCount: 0,
      emailQueued: 0,
      emailSent: 0,
      errors: [error.message],
    };
  }

  let inAppCount = 0;
  let emailQueued = 0;
  const errors: string[] = [];

  for (const row of data ?? []) {
    const channels = (row.channels ?? ["in_app"]) as NotificationChannel[];

    if (channels.includes("in_app")) {
      inAppCount += 1;
    }

    if (channels.includes("email")) {
      // TODO(email): resolver plantilla, destinatario y envío (SendGrid/SES).
      // Tras enviar con éxito: UPDATE status = 'sent' WHERE id = row.id.
      // Mientras tanto, no marcamos como sent para no perder el recordatorio in-app.
      emailQueued += 1;
      errors.push(
        `TODO(email): notificación ${row.id as string} pendiente de implementar cron SMTP`,
      );
    }
  }

  return {
    inAppCount,
    emailQueued,
    emailSent: 0,
    errors,
  };
}
