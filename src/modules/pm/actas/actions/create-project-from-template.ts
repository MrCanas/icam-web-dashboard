"use server";

import type { PoolClient } from "pg";
import { revalidatePath } from "next/cache";

import { requireCurrentUser } from "@/lib/auth/currentUser";
import { resolveAuthUserIdByEmail } from "@/lib/auth/resolve-auth-user";
import { getPgPool } from "@/modules/pm/actas/data/pg";
import {
  checkProjectCodeAvailable,
  resolveOrganizationIdForUser,
  countCatalogElementsPg,
} from "@/modules/pm/actas/data/projectTemplateRepository";
import {
  isValidProjectCodeFormat,
  normalizeProjectCodeInput,
} from "@/modules/pm/actas/logic/project-wizard-options";
import type { ProjectPhase } from "@/modules/pm/actas/types";

const CATALOG_EMPTY_MSG =
  "El catálogo maestro no está cargado. Ejecuta npm run actas:seed-master-catalog primero.";

const VALID_PHASES = new Set<ProjectPhase>([
  "adquisicion",
  "desarrollo",
  "comercializacion",
  "desinversion",
]);

const VALID_ASSET_TYPES = new Set([
  "hotel",
  "residencial",
  "oficinas",
  "mixto",
  "otro",
]);

export type CreateProjectFromTemplateInput = {
  code: string;
  name: string;
  phase: ProjectPhase;
  assetType: string;
  pmActivoId?: string | null;
  selectedModuleIds: string[];
};

export type CreateProjectFromTemplateResult =
  | { ok: true; projectId: string; projectCode: string }
  | { ok: false; error: string; status?: number };

interface MasterGroupRow {
  id: string;
  name: string;
  is_core: boolean;
  order_index: number;
}

interface MasterElementRow {
  id: string;
  master_group_id: string;
  name: string;
  parent_element_id: string | null;
  order_index: number;
}

async function assertCatalogLoaded(client: PoolClient): Promise<void> {
  const { rows } = await client.query<{ groups: string; elements: string }>(
    `SELECT
       (SELECT count(*)::text FROM public.master_group WHERE is_core = true) AS groups,
       (SELECT count(*)::text FROM public.master_element me
        WHERE NOT EXISTS (
          SELECT 1 FROM public.master_element_module mem
          WHERE mem.master_element_id = me.id
        )) AS elements`,
  );
  const groupCount = Number(rows[0]?.groups ?? 0);
  const elementCount = Number(rows[0]?.elements ?? 0);
  if (groupCount === 0 || elementCount === 0) {
    throw new CatalogEmptyError();
  }
}

class CatalogEmptyError extends Error {
  constructor() {
    super(CATALOG_EMPTY_MSG);
    this.name = "CatalogEmptyError";
  }
}

class ProjectCodeConflictError extends Error {
  constructor() {
    super("Ya existe un proyecto con este código");
    this.name = "ProjectCodeConflictError";
  }
}

async function resolveCategoryGroupIds(
  client: PoolClient,
  selectedModuleIds: string[],
): Promise<{ groupIds: string[]; groups: MasterGroupRow[] }> {
  const { rows: groups } = await client.query<MasterGroupRow>(
    `SELECT id, name, is_core, order_index
     FROM public.master_group
     ORDER BY order_index, name`,
  );

  if (!groups.length) {
    throw new CatalogEmptyError();
  }

  let moduleNames = new Set<string>();
  if (selectedModuleIds.length > 0) {
    const { rows: modules } = await client.query<{ name: string }>(
      `SELECT name FROM public.master_module WHERE id = ANY($1::uuid[])`,
      [selectedModuleIds],
    );
    moduleNames = new Set(
      modules.map((m) => m.name.trim().toUpperCase()),
    );
  }

  const selected = groups.filter(
    (g) =>
      g.is_core ||
      moduleNames.has(g.name.trim().toUpperCase()),
  );

  return {
    groups: selected,
    groupIds: selected.map((g) => g.id),
  };
}

async function fetchElementsForProject(
  client: PoolClient,
  selectedModuleIds: string[],
  allowedGroupIds: Set<string>,
): Promise<MasterElementRow[]> {
  const { rows } = await client.query<MasterElementRow>(
    `SELECT DISTINCT ON (me.id)
       me.id,
       me.master_group_id,
       me.name,
       me.parent_element_id,
       me.order_index
     FROM public.master_element me
     LEFT JOIN public.master_element_module mem
       ON mem.master_element_id = me.id
     WHERE mem.master_module_id IS NULL
        OR mem.master_module_id = ANY($1::uuid[])
     ORDER BY me.id, me.master_group_id, me.order_index, me.name`,
    [selectedModuleIds],
  );

  return rows.filter((r) => allowedGroupIds.has(r.master_group_id));
}

async function executeCreateInTransaction(
  client: PoolClient,
  input: CreateProjectFromTemplateInput,
  organizationId: string,
  createdBy: string | null,
): Promise<{ projectId: string; projectCode: string }> {
  const code = normalizeProjectCodeInput(input.code);
  const name = input.name.trim();
  const selectedModuleIds = [...new Set(input.selectedModuleIds)];

  await assertCatalogLoaded(client);

  const { rows: existing } = await client.query<{ id: string }>(
    "SELECT id FROM public.project WHERE code = $1 LIMIT 1",
    [code],
  );
  if (existing.length > 0) {
    throw new ProjectCodeConflictError();
  }

  const elementTotal = await countCatalogElementsPg(client, selectedModuleIds);
  if (elementTotal === 0) {
    throw new CatalogEmptyError();
  }

  const { groups: categoryGroups } = await resolveCategoryGroupIds(
    client,
    selectedModuleIds,
  );
  const allowedGroupIds = new Set(categoryGroups.map((g) => g.id));

  const { rows: projectRows } = await client.query<{ id: string }>(
    `INSERT INTO public.project
       (code, name, phase, asset_type, organization_id, created_by, pm_activo_id, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'active')
     RETURNING id`,
    [
      code,
      name,
      input.phase,
      input.assetType,
      organizationId,
      createdBy,
      input.pmActivoId ?? null,
    ],
  );
  const projectId = projectRows[0]?.id;
  if (!projectId) throw new Error("INSERT project no devolvió id");

  for (const moduleId of selectedModuleIds) {
    await client.query(
      `INSERT INTO public.project_module (project_id, master_module_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [projectId, moduleId],
    );
  }

  const categoryIdByGroupId = new Map<string, string>();
  for (const group of categoryGroups) {
    const { rows: catRows } = await client.query<{ id: string }>(
      `INSERT INTO public.category
         (project_id, master_group_id, name, order_index)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [projectId, group.id, group.name, group.order_index],
    );
    const categoryId = catRows[0]?.id;
    if (!categoryId) {
      throw new Error(`INSERT category falló para grupo ${group.name}`);
    }
    categoryIdByGroupId.set(group.id, categoryId);
  }

  const masterElements = await fetchElementsForProject(
    client,
    selectedModuleIds,
    allowedGroupIds,
  );

  const roots = masterElements
    .filter((e) => e.parent_element_id == null)
    .sort(
      (a, b) =>
        a.order_index - b.order_index || a.name.localeCompare(b.name),
    );
  const children = masterElements
    .filter((e) => e.parent_element_id != null)
    .sort(
      (a, b) =>
        a.order_index - b.order_index || a.name.localeCompare(b.name),
    );

  const elementIdByMasterId = new Map<string, string>();

  async function insertElement(
    me: MasterElementRow,
    parentDbId: string | null,
  ): Promise<void> {
    const categoryId = categoryIdByGroupId.get(me.master_group_id);
    if (!categoryId) {
      throw new Error(
        `master_element ${me.id}: grupo ${me.master_group_id} sin categoría`,
      );
    }
    const { rows: elRows } = await client.query<{ id: string }>(
      `INSERT INTO public.element
         (category_id, master_element_id, name, status, parent_element_id, order_index)
       VALUES ($1, $2, $3, 'not_started', $4, $5)
       RETURNING id`,
      [categoryId, me.id, me.name, parentDbId, me.order_index],
    );
    const elementId = elRows[0]?.id;
    if (!elementId) throw new Error(`INSERT element falló para ${me.name}`);
    elementIdByMasterId.set(me.id, elementId);
  }

  for (const me of roots) {
    await insertElement(me, null);
  }
  for (const me of children) {
    const parentDbId = elementIdByMasterId.get(me.parent_element_id!);
    if (!parentDbId) {
      throw new Error(
        `master_element ${me.id}: padre ${me.parent_element_id} sin mapear`,
      );
    }
    await insertElement(me, parentDbId);
  }

  return { projectId, projectCode: code };
}

export async function createProjectFromTemplate(
  input: CreateProjectFromTemplateInput,
): Promise<CreateProjectFromTemplateResult> {
  const ctx = await requireCurrentUser();

  const code = normalizeProjectCodeInput(input.code);
  const name = input.name.trim();

  if (!isValidProjectCodeFormat(code)) {
    return {
      ok: false,
      error: "Código inválido (2–10 caracteres, letras, números y guiones).",
    };
  }
  if (!name) {
    return { ok: false, error: "El nombre del proyecto es obligatorio." };
  }
  if (name.length > 120) {
    return { ok: false, error: "El nombre no puede superar 120 caracteres." };
  }
  if (!VALID_PHASES.has(input.phase)) {
    return { ok: false, error: "Fase no válida." };
  }
  if (!VALID_ASSET_TYPES.has(input.assetType)) {
    return { ok: false, error: "Tipo de activo no válido." };
  }

  const available = await checkProjectCodeAvailable(ctx, code);
  if (!available) {
    return { ok: false, error: "Ya existe un proyecto con este código", status: 409 };
  }

  const organizationId = await resolveOrganizationIdForUser(ctx);
  const createdBy = await resolveAuthUserIdByEmail(ctx.email);

  const pool = getPgPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const result = await executeCreateInTransaction(
      client,
      { ...input, code, name },
      organizationId,
      createdBy,
    );
    await client.query("COMMIT");
    revalidatePath("/dashboard/pm/actas", "layout");
    return { ok: true, ...result };
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* connection may be aborted */
    }

    if (err instanceof ProjectCodeConflictError) {
      return { ok: false, error: err.message, status: 409 };
    }
    if (err instanceof CatalogEmptyError) {
      return { ok: false, error: err.message };
    }

    const message =
      err instanceof Error ? err.message : "Error al crear el proyecto";
    console.error("[createProjectFromTemplate]", err);
    return { ok: false, error: message };
  } finally {
    client.release();
  }
}
