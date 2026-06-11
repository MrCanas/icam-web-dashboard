"use server";

import { requireCurrentUser } from "@/lib/auth/currentUser";
import { checkWriteAccess } from "@/lib/auth/permissions";
import { resolveAuthUserIdByEmail } from "@/lib/auth/resolve-auth-user";
import { getActasAuthenticatedSupabase } from "@/modules/pm/actas/data/authenticatedClient";
import {
  mapLogEntryRow,
  type LogEntryRow,
} from "@/modules/pm/actas/data/map-log-entry";
import { toElementStatus } from "@/modules/pm/actas/logic/element-status";
import { formatStatusChangeLogContent } from "@/modules/pm/actas/logic/status-change-log";
import { resolveUserDisplayMap } from "@/modules/pm/actas/logic/user-display";
import type {
  ActasLogEntryItem,
  ElementStatus,
} from "@/modules/pm/actas/types";

export type ChangeElementStatusInput = {
  elementId: string;
  newStatus: ElementStatus;
};

export type ChangeElementStatusResult =
  | {
      ok: true;
      elementStatus: ElementStatus;
      entry: ActasLogEntryItem | null;
      noop: boolean;
    }
  | { ok: false; error: string };

const ELEMENT_STATUSES = new Set<ElementStatus>([
  "not_started",
  "working_on_it",
  "stuck",
  "done",
]);

export async function changeElementStatus(
  input: ChangeElementStatusInput,
): Promise<ChangeElementStatusResult> {
  const elementId = input.elementId.trim();
  const newStatus = input.newStatus;

  if (!elementId) {
    return { ok: false, error: "elementId requerido" };
  }
  if (!ELEMENT_STATUSES.has(newStatus)) {
    return { ok: false, error: "Estado no válido" };
  }

  const icamUser = await requireCurrentUser();
  const writeDenied = checkWriteAccess(icamUser, "pm");
  if (writeDenied) {
    return { ok: false, error: writeDenied };
  }
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
  if (newStatus === currentStatus) {
    return {
      ok: true,
      elementStatus: currentStatus,
      entry: null,
      noop: true,
    };
  }

  const content = formatStatusChangeLogContent(currentStatus, newStatus);
  const entryDate = new Date().toISOString();

  const baseRow = {
    element_id: elementId,
    author_id: authorId,
    content,
    status_before: currentStatus,
    status_after: newStatus,
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

  // Marca/limpia completed_at según el nuevo estado (P4: ciclo "Hecho").
  // El estado de element lo sincroniza el trigger desde el log_entry; aquí solo
  // gestionamos la marca temporal. Es secundaria: si falla (p.ej. columna aún
  // no migrada) no rompemos el cambio de estado ya realizado.
  await client
    .from("element")
    .update({ completed_at: newStatus === "done" ? entryDate : null })
    .eq("id", elementId);

  const userDisplayMap = await resolveUserDisplayMap([authorId]);
  const mapped = mapLogEntryRow(row as LogEntryRow, userDisplayMap);
  const entry: ActasLogEntryItem = {
    ...mapped,
    source: mapped.source ?? "ui",
  };

  return {
    ok: true,
    elementStatus: newStatus,
    entry,
    noop: false,
  };
}
