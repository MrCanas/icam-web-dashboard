"use server";

import { requireCurrentUser } from "@/lib/auth/currentUser";
import { resolveAuthUserIdByEmail } from "@/lib/auth/resolve-auth-user";
import { getActasAuthenticatedSupabase } from "@/modules/pm/actas/data/authenticatedClient";
import {
  mapLogEntryRow,
  type LogEntryRow,
} from "@/modules/pm/actas/data/map-log-entry";
import { resolveUserDisplayMap } from "@/modules/pm/actas/logic/user-display";
import type { ActasLogEntryItem } from "@/modules/pm/actas/types";

export type UpdateLogEntryInput = {
  logEntryId: string;
  content: string;
  entryDate: string;
};

export type UpdateLogEntryResult =
  | { ok: true; entry: ActasLogEntryItem }
  | { ok: false; error: string; forbidden?: boolean };

const LOG_ENTRY_SELECT =
  "id, content, entry_date, deleted_at, status_before, status_after, author_id, source, edited_at";

export async function updateLogEntry(
  input: UpdateLogEntryInput,
): Promise<UpdateLogEntryResult> {
  const content = input.content.trim();
  if (!content) {
    return { ok: false, error: "El contenido no puede estar vacío" };
  }

  const logEntryId = input.logEntryId.trim();
  if (!logEntryId) {
    return { ok: false, error: "logEntryId requerido" };
  }

  const entryDateIso = new Date(input.entryDate).toISOString();
  if (Number.isNaN(new Date(entryDateIso).getTime())) {
    return { ok: false, error: "Fecha de entrada no válida" };
  }

  const icamUser = await requireCurrentUser();
  const authorId = await resolveAuthUserIdByEmail(icamUser.email);
  if (!authorId) {
    return {
      ok: false,
      error: `Usuario ${icamUser.email} no provisionado en Supabase Auth.`,
    };
  }

  const { client, error: clientError } = await getActasAuthenticatedSupabase();
  if (!client) {
    return { ok: false, error: clientError };
  }

  const { data: existing, error: fetchError } = await client
    .from("log_entry")
    .select("id, author_id, deleted_at, source")
    .eq("id", logEntryId)
    .maybeSingle();

  if (fetchError) {
    return { ok: false, error: fetchError.message };
  }
  if (!existing) {
    return { ok: false, error: "Entrada no encontrada" };
  }
  if (existing.deleted_at) {
    return { ok: false, error: "No se puede editar una entrada borrada" };
  }

  const rowAuthorId = existing.author_id as string | null;
  if (!rowAuthorId || rowAuthorId !== authorId) {
    return {
      ok: false,
      forbidden: true,
      error: "Solo el autor de una entrada puede editarla",
    };
  }

  const src = (existing.source as string | null)?.toLowerCase() ?? "";
  if (src === "snapshot" || src === "monday_update") {
    return {
      ok: false,
      forbidden: true,
      error: "Las entradas migradas de Monday no se pueden editar desde la UI",
    };
  }

  const { data: row, error: updateError } = await client
    .from("log_entry")
    .update({
      content,
      entry_date: entryDateIso,
      edited_at: new Date().toISOString(),
    })
    .eq("id", logEntryId)
    .select(LOG_ENTRY_SELECT)
    .single();

  if (updateError) {
    return { ok: false, error: updateError.message };
  }

  const userDisplayMap = await resolveUserDisplayMap([authorId]);
  const entry = mapLogEntryRow(row as LogEntryRow, userDisplayMap);

  return { ok: true, entry };
}
