"use server";

import { requireCurrentUser } from "@/lib/auth/currentUser";
import { checkProjectCodeAvailable } from "@/modules/pm/actas/data/projectTemplateRepository";
import {
  isValidProjectCodeFormat,
  normalizeProjectCodeInput,
} from "@/modules/pm/actas/logic/project-wizard-options";

export type CheckActasProjectCodeResult =
  | { ok: true; available: boolean; code: string }
  | { ok: false; error: string };

export async function checkActasProjectCode(
  rawCode: string,
): Promise<CheckActasProjectCodeResult> {
  const ctx = await requireCurrentUser();
  const code = normalizeProjectCodeInput(rawCode);

  if (!code) {
    return { ok: true, available: false, code };
  }
  if (!isValidProjectCodeFormat(code)) {
    return {
      ok: false,
      error: "Formato inválido (alfanumérico y guiones, 2–10 caracteres).",
    };
  }

  try {
    const available = await checkProjectCodeAvailable(ctx, code);
    return { ok: true, available, code };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error de validación";
    return { ok: false, error: message };
  }
}
