"use server";

import { getActasAuthenticatedSupabase } from "@/modules/pm/actas/data/authenticatedClient";
import { mapLogEntryRow } from "@/modules/pm/actas/data/map-log-entry";
import {
  fetchLogEntryRow,
  loadLogEntryForAuthorAction,
  mutateLogEntryRow,
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

  if (access.existing.deleted_at) {
    const fetchResult = await fetchLogEntryRow(logEntryId);
    if (!fetchResult.ok) {
      return { ok: false, error: fetchResult.error };
    }
    const userDisplayMap = await resolveUserDisplayMap([authorId]);
    return {
      ok: true,
      entry: mapLogEntryRow(fetchResult.row, userDisplayMap),
    };
  }

  const updateResult = await mutateLogEntryRow(logEntryId, {
    deleted_at: new Date().toISOString(),
  });

  if (!updateResult.ok) {
    return { ok: false, error: updateResult.error };
  }

  const userDisplayMap = await resolveUserDisplayMap([authorId]);
  return {
    ok: true,
    entry: mapLogEntryRow(updateResult.row, userDisplayMap),
  };
}
