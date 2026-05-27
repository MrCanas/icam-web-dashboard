"use server";

import type { PoolClient } from "pg";
import { revalidatePath } from "next/cache";

import { requireCurrentUser } from "@/lib/auth/currentUser";
import { checkWriteAccess } from "@/lib/auth/permissions";
import { resolveAuthUserIdByEmail } from "@/lib/auth/resolve-auth-user";
import { getActasReadSupabase } from "@/modules/pm/actas/data/readClient";
import { getPgPool } from "@/modules/pm/actas/data/pg";
import { checkProjectCodeAvailable } from "@/modules/pm/actas/data/projectTemplateRepository";
import {
  isValidProjectCodeFormat,
  normalizeProjectCodeInput,
} from "@/modules/pm/actas/logic/project-wizard-options";

export type DuplicateProjectInput = {
  sourceProjectId: string;
  newCode: string;
  newName: string;
};

export type DuplicateProjectResult =
  | {
      ok: true;
      projectId: string;
      projectCode: string;
      sourceCode: string;
      structureEmpty: boolean;
    }
  | { ok: false; error: string; status?: number };

interface SourceProjectRow {
  id: string;
  code: string;
  phase: string;
  asset_type: string;
  organization_id: string;
}

interface CategoryRow {
  id: string;
  master_group_id: string | null;
  name: string;
  order_index: number;
  sublot_label: string | null;
}

interface ElementRow {
  id: string;
  category_id: string;
  master_element_id: string | null;
  name: string;
  order_index: number;
  timeline_start: string | null;
  timeline_end: string | null;
  parent_element_id: string | null;
}

class ProjectCodeConflictError extends Error {
  constructor() {
    super("Ya existe un proyecto con este código");
    this.name = "ProjectCodeConflictError";
  }
}

async function executeDuplicateInTransaction(
  client: PoolClient,
  source: SourceProjectRow,
  newCode: string,
  newName: string,
  createdBy: string | null,
): Promise<{ projectId: string; categoryCount: number; elementCount: number }> {
  const { rows: existing } = await client.query<{ id: string }>(
    "SELECT id FROM public.project WHERE code = $1 LIMIT 1",
    [newCode],
  );
  if (existing.length > 0) {
    throw new ProjectCodeConflictError();
  }

  const { rows: projectRows } = await client.query<{ id: string }>(
    `INSERT INTO public.project
       (code, name, phase, asset_type, organization_id, created_by, status, pm_activo_id)
     VALUES ($1, $2, $3, $4, $5, $6, 'active', NULL)
     RETURNING id`,
    [
      newCode,
      newName,
      source.phase,
      source.asset_type,
      source.organization_id,
      createdBy,
    ],
  );
  const projectId = projectRows[0]?.id;
  if (!projectId) throw new Error("INSERT project no devolvió id");

  await client.query(
    `INSERT INTO public.project_module (project_id, master_module_id)
     SELECT $1, master_module_id
     FROM public.project_module
     WHERE project_id = $2
     ON CONFLICT DO NOTHING`,
    [projectId, source.id],
  );

  const { rows: categories } = await client.query<CategoryRow>(
    `SELECT id, master_group_id, name, order_index, sublot_label
     FROM public.category
     WHERE project_id = $1 AND archived_at IS NULL
     ORDER BY order_index, name`,
    [source.id],
  );

  const categoryIdMap = new Map<string, string>();
  for (const cat of categories) {
    const { rows: catRows } = await client.query<{ id: string }>(
      `INSERT INTO public.category
         (project_id, master_group_id, name, order_index, sublot_label)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [
        projectId,
        cat.master_group_id,
        cat.name,
        cat.order_index,
        cat.sublot_label,
      ],
    );
    const newCategoryId = catRows[0]?.id;
    if (!newCategoryId) {
      throw new Error(`INSERT category falló para ${cat.name}`);
    }
    categoryIdMap.set(cat.id, newCategoryId);
  }

  const { rows: elements } = await client.query<ElementRow>(
    `SELECT e.id, e.category_id, e.master_element_id, e.name, e.order_index,
            e.timeline_start::text, e.timeline_end::text, e.parent_element_id
     FROM public.element e
     INNER JOIN public.category c ON c.id = e.category_id
     WHERE c.project_id = $1
       AND c.archived_at IS NULL
       AND e.archived_at IS NULL
     ORDER BY e.order_index, e.name`,
    [source.id],
  );

  const roots = elements
    .filter((e) => e.parent_element_id == null)
    .sort(
      (a, b) =>
        a.order_index - b.order_index || a.name.localeCompare(b.name),
    );
  const children = elements
    .filter((e) => e.parent_element_id != null)
    .sort(
      (a, b) =>
        a.order_index - b.order_index || a.name.localeCompare(b.name),
    );

  const elementIdMap = new Map<string, string>();
  let elementCount = 0;

  async function insertElement(
    el: ElementRow,
    parentDbId: string | null,
  ): Promise<void> {
    const categoryId = categoryIdMap.get(el.category_id);
    if (!categoryId) {
      throw new Error(
        `element ${el.id}: categoría ${el.category_id} sin mapear`,
      );
    }
    const { rows: elRows } = await client.query<{ id: string }>(
      `INSERT INTO public.element
         (category_id, master_element_id, name, status, timeline_start, timeline_end, parent_element_id, order_index)
       VALUES ($1, $2, $3, 'not_started', $4::date, $5::date, $6, $7)
       RETURNING id`,
      [
        categoryId,
        el.master_element_id,
        el.name,
        el.timeline_start,
        el.timeline_end,
        parentDbId,
        el.order_index,
      ],
    );
    const newElementId = elRows[0]?.id;
    if (!newElementId) throw new Error(`INSERT element falló para ${el.name}`);
    elementIdMap.set(el.id, newElementId);
    elementCount += 1;
  }

  for (const el of roots) {
    await insertElement(el, null);
  }
  for (const el of children) {
    const parentDbId = elementIdMap.get(el.parent_element_id!);
    if (!parentDbId) {
      throw new Error(
        `element ${el.id}: padre ${el.parent_element_id} sin mapear`,
      );
    }
    await insertElement(el, parentDbId);
  }

  return {
    projectId,
    categoryCount: categories.length,
    elementCount,
  };
}

export async function duplicateProject(
  input: DuplicateProjectInput,
): Promise<DuplicateProjectResult> {
  const ctx = await requireCurrentUser();
  const writeDenied = checkWriteAccess(ctx, "pm");
  if (writeDenied) return { ok: false, error: writeDenied };

  const newCode = normalizeProjectCodeInput(input.newCode);
  const newName = input.newName.trim();

  if (!isValidProjectCodeFormat(newCode)) {
    return {
      ok: false,
      error: "Código inválido (2–10 caracteres, letras, números y guiones).",
    };
  }
  if (!newName) {
    return { ok: false, error: "El nombre del proyecto es obligatorio." };
  }
  if (newName.length > 120) {
    return { ok: false, error: "El nombre no puede superar 120 caracteres." };
  }

  const available = await checkProjectCodeAvailable(ctx, newCode);
  if (!available) {
    return { ok: false, error: "Ya existe un proyecto con este código", status: 409 };
  }

  const supabase = await getActasReadSupabase(ctx);
  const { data: source, error: sourceErr } = await supabase
    .from("project")
    .select("id, code, phase, asset_type, organization_id")
    .eq("id", input.sourceProjectId)
    .is("archived_at", null)
    .maybeSingle();

  if (sourceErr) {
    return { ok: false, error: sourceErr.message };
  }
  if (!source) {
    return { ok: false, error: "Proyecto no encontrado o sin acceso", status: 404 };
  }

  const createdBy = await resolveAuthUserIdByEmail(ctx.email);
  const sourceRow: SourceProjectRow = {
    id: source.id as string,
    code: source.code as string,
    phase: source.phase as string,
    asset_type: source.asset_type as string,
    organization_id: source.organization_id as string,
  };

  const pool = getPgPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const { projectId, categoryCount, elementCount } =
      await executeDuplicateInTransaction(
        client,
        sourceRow,
        newCode,
        newName,
        createdBy,
      );
    await client.query("COMMIT");
    revalidatePath("/dashboard/pm/actas", "layout");

    return {
      ok: true,
      projectId,
      projectCode: newCode,
      sourceCode: sourceRow.code,
      structureEmpty: categoryCount === 0 && elementCount === 0,
    };
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* connection may be aborted */
    }

    if (err instanceof ProjectCodeConflictError) {
      return { ok: false, error: err.message, status: 409 };
    }
    const message =
      err instanceof Error ? err.message : "Error al duplicar el proyecto";
    console.error("[duplicateProject]", err);
    return { ok: false, error: message };
  } finally {
    client.release();
  }
}
