import type { SupabaseClient } from "@supabase/supabase-js";

import type { UserContext } from "@/lib/auth/currentUser";
import { requireCurrentUser } from "@/lib/auth/currentUser";
import {
  requireWriteAccess,
  WriteAccessDeniedError,
} from "@/lib/auth/permissions";
import { resolveAuthUserIdByEmail } from "@/lib/auth/resolve-auth-user";

export const LOG_ENTRY_SELECT =
  "id, content, entry_date, deleted_at, status_before, status_after, author_id, source, edited_at";

const NON_EDITABLE_SOURCES = new Set(["snapshot", "monday_update"]);

export type LogEntryAuthorContext = {
  authorId: string;
  icamUser: UserContext;
};

export async function requireLogEntryAuthor(): Promise<
  | { ok: true; author: LogEntryAuthorContext }
  | { ok: false; error: string }
> {
  const icamUser = await requireCurrentUser();
  try {
    requireWriteAccess(icamUser, "pm");
  } catch (err) {
    if (err instanceof WriteAccessDeniedError) {
      return { ok: false, error: err.message };
    }
    throw err;
  }
  const authorId = await resolveAuthUserIdByEmail(icamUser.email);
  if (!authorId) {
    return {
      ok: false,
      error: `Usuario ${icamUser.email} no provisionado en Supabase Auth.`,
    };
  }
  return { ok: true, author: { authorId, icamUser } };
}

type ExistingRow = {
  id: string;
  author_id: string | null;
  deleted_at: string | null;
  source: string | null;
};

export async function loadLogEntryForAuthorAction(
  client: SupabaseClient,
  logEntryId: string,
  authorId: string,
  options?: { blockMondaySource?: boolean },
): Promise<
  | { ok: true; existing: ExistingRow }
  | { ok: false; error: string; forbidden?: boolean; notFound?: boolean }
> {
  const { data: existing, error: fetchError } = await client
    .from("log_entry")
    .select("id, author_id, deleted_at, source")
    .eq("id", logEntryId)
    .maybeSingle();

  if (fetchError) {
    return { ok: false, error: fetchError.message };
  }
  if (!existing) {
    return { ok: false, error: "Entrada no encontrada", notFound: true };
  }

  const rowAuthorId = existing.author_id as string | null;
  if (!rowAuthorId || rowAuthorId !== authorId) {
    return {
      ok: false,
      forbidden: true,
      error: "Solo el autor de una entrada puede modificarla",
    };
  }

  if (options?.blockMondaySource !== false) {
    const src = (existing.source as string | null)?.toLowerCase() ?? "";
    if (NON_EDITABLE_SOURCES.has(src)) {
      return {
        ok: false,
        forbidden: true,
        error: "Las entradas migradas de Monday no se pueden modificar desde la UI",
      };
    }
  }

  return {
    ok: true,
    existing: existing as ExistingRow,
  };
}
