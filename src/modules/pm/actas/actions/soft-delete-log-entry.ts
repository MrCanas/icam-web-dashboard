"use server";

import { getActasAuthenticatedSupabase } from "@/modules/pm/actas/data/authenticatedClient";
import {
  mapLogEntryRow,
  type LogEntryRow,
} from "@/modules/pm/actas/data/map-log-entry";
import {
  loadLogEntryForAuthorAction,
  LOG_ENTRY_SELECT,
  requireLogEntryAuthor,
} from "@/modules/pm/actas/actions/log-entry-auth";
import { resolveUserDisplayMap } from "@/modules/pm/actas/logic/user-display";
import type { ActasLogEntryItem } from "@/modules/pm/actas/types";

export type SoftDeleteLogEntryInput = {
  logEntryId: string;
};

export type SoftDeleteLogEntryResult =
  | { ok: true; entry: ActasLogEntryItem }
  | { ok: false; error: string; forbidden?: boolean };

export async function softDeleteLogEntry(
  input: SoftDeleteLogEntryInput,
): Promise<SoftDeleteLogEntryResult> {
  const logEntryId = input.logEntryId.trim();
  if (!logEntryId) {
    return { ok: false, error: "logEntryId requerido" };
  }

  const authorResult = await requireLogEntryAuthor();
  if (!authorResult.ok) {
    return { ok: false, error: authorResult.error };
  }
  const { authorId, isPmAdmin } = authorResult.author;

  const { client, error: clientError } = await getActasAuthenticatedSupabase();
  if (!client) {
    return { ok: false, error: clientError };
  }

  const access = await loadLogEntryForAuthorAction(
    client,
    logEntryId,
    authorId,
    { isPmAdmin },
  );
  if (!access.ok) {
    return {
      ok: false,
      error:
        access.forbidden ?
          "Solo el autor de una entrada puede borrarla"
        : access.error,
      forbidden: access.forbidden,
    };
  }

  const deletedAt = new Date().toISOString();

  if (access.existing.deleted_at) {
    const { data: row, error } = await client
      .from("log_entry")
      .select(LOG_ENTRY_SELECT)
      .eq("id", logEntryId)
      .single();
    if (error || !row) {
      return { ok: false, error: error?.message ?? "Entrada no encontrada" };
    }
    const userDisplayMap = await resolveUserDisplayMap([authorId]);
    return {
      ok: true,
      entry: mapLogEntryRow(row as LogEntryRow, userDisplayMap),
    };
  }

  const { data: row, error: updateError } = await client
    .from("log_entry")
    .update({ deleted_at: deletedAt })
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
