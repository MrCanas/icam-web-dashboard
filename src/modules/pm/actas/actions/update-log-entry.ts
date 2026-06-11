"use server";

import { getActasAuthenticatedSupabase } from "@/modules/pm/actas/data/authenticatedClient";
import {
  loadLogEntryForAuthorAction,
  mutateLogEntryRow,
  requireLogEntryAuthor,
} from "@/modules/pm/actas/actions/log-entry-auth";
import { mapLogEntryRow } from "@/modules/pm/actas/data/map-log-entry";
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

  const authorResult = await requireLogEntryAuthor();
  if (!authorResult.ok) {
    return { ok: false, error: authorResult.error, forbidden: true };
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
      error: access.error,
      forbidden: access.forbidden,
    };
  }
  if (access.existing.deleted_at) {
    return { ok: false, error: "No se puede editar una entrada borrada" };
  }

  const updateResult = await mutateLogEntryRow(logEntryId, {
    content,
    entry_date: entryDateIso,
    edited_at: new Date().toISOString(),
  });

  if (!updateResult.ok) {
    return { ok: false, error: updateResult.error };
  }

  const row = updateResult.row;
  const displayAuthorId = row.author_id ?? authorId;
  const userDisplayMap = await resolveUserDisplayMap([displayAuthorId]);
  const entry = mapLogEntryRow(row, userDisplayMap);

  return { ok: true, entry };
}
