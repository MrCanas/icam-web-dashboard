"use server";

import { requireCurrentUser } from "@/lib/auth/currentUser";
import { resolveAuthUserIdByEmail } from "@/lib/auth/resolve-auth-user";
import { getActasAuthenticatedSupabase } from "@/modules/pm/actas/data/authenticatedClient";
import {
  mapLogEntryRow,
  type LogEntryRow,
} from "@/modules/pm/actas/data/map-log-entry";
import { toElementStatus } from "@/modules/pm/actas/logic/element-status";
import { resolveUserDisplayMap } from "@/modules/pm/actas/logic/user-display";
import type {
  ActasLogEntryItem,
  ElementStatus,
} from "@/modules/pm/actas/types";

export type CreateLogEntryInput = {
  elementId: string;
  content: string;
  statusAfter?: ElementStatus | null;
  entryDate?: string | null;
};

export type CreateLogEntryResult =
  | {
      ok: true;
      entry: ActasLogEntryItem;
      elementStatus: ElementStatus;
    }
  | { ok: false; error: string };

const ELEMENT_STATUSES = new Set<ElementStatus>([
  "not_started",
  "working_on_it",
  "stuck",
  "done",
]);

export async function createLogEntry(
  input: CreateLogEntryInput,
): Promise<CreateLogEntryResult> {
  const content = input.content.trim();
  if (!content) {
    return { ok: false, error: "El contenido no puede estar vacío" };
  }

  const elementId = input.elementId.trim();
  if (!elementId) {
    return { ok: false, error: "elementId requerido" };
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

  const { data: element, error: elementError } = await client
    .from("element")
    .select("id, status")
    .eq("id", elementId)
    .is("archived_at", null)
    .maybeSingle();

  if (elementError) {
    return { ok: false, error: elementError.message };
  }
  if (!element) {
    return {
      ok: false,
      error: "Elemento no encontrado o sin acceso al proyecto",
    };
  }

  const currentStatus = toElementStatus(element.status as string);
  let statusBefore: ElementStatus | null = null;
  let statusAfter: ElementStatus | null = null;

  const requested = input.statusAfter ?? null;
  if (
    requested &&
    ELEMENT_STATUSES.has(requested) &&
    requested !== currentStatus
  ) {
    statusBefore = currentStatus;
    statusAfter = requested;
  }

  const entryDate =
    input.entryDate?.trim() ?
      new Date(input.entryDate).toISOString()
    : new Date().toISOString();

  if (Number.isNaN(new Date(entryDate).getTime())) {
    return { ok: false, error: "Fecha de entrada no válida" };
  }

  const baseRow = {
    element_id: elementId,
    author_id: authorId,
    content,
    status_before: statusBefore,
    status_after: statusAfter,
    entry_date: entryDate,
  };

  const selectFields =
    "id, content, entry_date, deleted_at, status_before, status_after, author_id, source, edited_at";

  let row: Record<string, unknown> | null = null;
  let insertError: { message: string } | null = null;

  const withSource = await client
    .from("log_entry")
    .insert({ ...baseRow, source: "ui" })
    .select(selectFields)
    .single();

  if (withSource.error?.message?.includes("source")) {
    const fallback = await client
      .from("log_entry")
      .insert(baseRow)
      .select(selectFields)
      .single();
    row = fallback.data;
    insertError = fallback.error;
  } else {
    row = withSource.data;
    insertError = withSource.error;
  }

  if (insertError || !row) {
    return { ok: false, error: insertError?.message ?? "Error al insertar" };
  }

  const newElementStatus = statusAfter ?? currentStatus;

  const userDisplayMap = await resolveUserDisplayMap([authorId]);
  const mapped = mapLogEntryRow(row as LogEntryRow, userDisplayMap);
  const entry: ActasLogEntryItem = {
    ...mapped,
    source: mapped.source ?? "ui",
  };

  return { ok: true, entry, elementStatus: newElementStatus };
}
