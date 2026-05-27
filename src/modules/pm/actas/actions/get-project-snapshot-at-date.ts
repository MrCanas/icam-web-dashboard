"use server";

import { requireCurrentUser } from "@/lib/auth/currentUser";
import {
  fetchProjectCreatedAt,
  fetchProjectSnapshotAtDate,
} from "@/modules/pm/actas/data/snapshotRepository";
import {
  isAsOfBeforeProject,
  isAsOfFuture,
  parseAsOfDateParam,
} from "@/modules/pm/actas/logic/operativo-asof";
import type { ActasOperativoCategory } from "@/modules/pm/actas/types";

export type GetProjectSnapshotInput = {
  projectId: string;
  asOfDate: string;
};

export type GetProjectSnapshotResult =
  | { ok: true; mode: "live" }
  | { ok: true; mode: "historical"; categories: ActasOperativoCategory[]; asOfDate: string }
  | { ok: true; mode: "before_project"; asOfDate: string }
  | { ok: false; error: string };

export async function getProjectSnapshotAtDate(
  input: GetProjectSnapshotInput,
): Promise<GetProjectSnapshotResult> {
  const ctx = await requireCurrentUser();
  const iso = parseAsOfDateParam(input.asOfDate);
  if (!iso) {
    return { ok: false, error: "Fecha no válida" };
  }

  if (isAsOfFuture(iso)) {
    return { ok: true, mode: "live" };
  }

  const { createdAt, error: createdErr } = await fetchProjectCreatedAt(
    ctx,
    input.projectId,
  );
  if (createdErr) {
    return { ok: false, error: createdErr };
  }
  if (createdAt && isAsOfBeforeProject(iso, createdAt)) {
    return { ok: true, mode: "before_project", asOfDate: iso };
  }

  const { categories, error } = await fetchProjectSnapshotAtDate(
    ctx,
    input.projectId,
    iso,
  );
  if (error) {
    return { ok: false, error };
  }

  return { ok: true, mode: "historical", categories, asOfDate: iso };
}
