"use server";

import { requireCurrentUser } from "@/lib/auth/currentUser";
import {
  fetchHistoricoElementDetail,
  fetchHistoricoElementOptions,
} from "@/modules/pm/actas/data/actasRepository";
import type {
  ActasHistoricoElementDetail,
  ActasHistoricoElementOption,
} from "@/modules/pm/actas/types";

export async function getHistoricoElementOptions(
  projectId: string,
): Promise<
  | { ok: true; options: ActasHistoricoElementOption[] }
  | { ok: false; error: string }
> {
  const ctx = await requireCurrentUser();
  const { options, error } = await fetchHistoricoElementOptions(ctx, projectId);
  if (error) return { ok: false, error };
  return { ok: true, options };
}

export async function getHistoricoElementDetail(
  projectId: string,
  elementId: string,
): Promise<
  | { ok: true; detail: ActasHistoricoElementDetail }
  | { ok: false; error: string; notFound?: boolean }
> {
  const ctx = await requireCurrentUser();
  const result = await fetchHistoricoElementDetail(ctx, projectId, elementId);
  if (result.error) {
    return { ok: false, error: result.error };
  }
  if (!result.detail) {
    return { ok: false, error: "Elemento no encontrado", notFound: true };
  }
  return { ok: true, detail: result.detail };
}
