"use server";

import { requireCurrentUser } from "@/lib/auth/currentUser";
import { fetchActasActaView } from "@/modules/pm/actas/data/actaRepository";
import type {
  ActasActaQueryInput,
  ActasActaViewData,
} from "@/modules/pm/actas/types";

export type GetActaViewResult =
  | { ok: true; data: ActasActaViewData }
  | { ok: false; error: string };

export async function getActaView(
  input: ActasActaQueryInput,
): Promise<GetActaViewResult> {
  const ctx = await requireCurrentUser();
  const { data, error } = await fetchActasActaView(ctx, input);
  if (error || !data) {
    return { ok: false, error: error ?? "No se pudo cargar el acta" };
  }
  return { ok: true, data };
}
