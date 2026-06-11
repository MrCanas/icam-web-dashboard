import type { PoolClient } from "pg";

import type { UserContext } from "@/lib/auth/currentUser";
import { resolveAuthUserIdByEmail } from "@/lib/auth/resolve-auth-user";
import { getActasReadSupabase } from "./readClient";

const ICAM_ORG_ID = "a0000000-0000-4000-8000-000000000001";

export interface MasterModuleOption {
  id: string;
  name: string;
  description: string | null;
  elementCount: number;
}

export interface TemplatePreviewCounts {
  categoryCount: number;
  elementCount: number;
  coreElementCount: number;
}

export interface PmActivoOption {
  id: string;
  idActivo: string;
  label: string;
}

export async function checkProjectCodeAvailable(
  ctx: UserContext,
  code: string,
): Promise<boolean> {
  const supabase = await getActasReadSupabase(ctx);
  const { data, error } = await supabase
    .from("project")
    .select("id")
    .eq("code", code.trim().toUpperCase())
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data == null;
}

export async function fetchMasterModulesWithCounts(
  ctx: UserContext,
): Promise<MasterModuleOption[]> {
  const supabase = await getActasReadSupabase(ctx);

  const [{ data: modules, error: modErr }, { data: links, error: linkErr }] =
    await Promise.all([
      supabase.from("master_module").select("id, name, description").order("name"),
      supabase.from("master_element_module").select("master_module_id"),
    ]);

  if (modErr) throw new Error(modErr.message);
  if (linkErr) throw new Error(linkErr.message);

  const countByModule = new Map<string, number>();
  for (const row of links ?? []) {
    const mid = row.master_module_id as string;
    countByModule.set(mid, (countByModule.get(mid) ?? 0) + 1);
  }

  return (modules ?? []).map((m) => ({
    id: m.id as string,
    name: m.name as string,
    description: (m.description as string | null) ?? null,
    elementCount: countByModule.get(m.id as string) ?? 0,
  }));
}

export async function fetchTemplatePreviewCounts(
  ctx: UserContext,
  selectedModuleIds: string[],
): Promise<TemplatePreviewCounts> {
  const supabase = await getActasReadSupabase(ctx);

  const [{ data: coreGroups }, { data: allGroups }, { data: coreElements }, { data: moduleLinks }] =
    await Promise.all([
      supabase.from("master_group").select("id").eq("is_core", true),
      supabase.from("master_group").select("id, name"),
      supabase.from("master_element").select("id, master_group_id"),
      supabase
        .from("master_element_module")
        .select("master_element_id, master_module_id"),
    ]);

  const moduleElementIds = new Set<string>();
  const selected = new Set(selectedModuleIds);
  for (const link of moduleLinks ?? []) {
    if (selected.has(link.master_module_id as string)) {
      moduleElementIds.add(link.master_element_id as string);
    }
  }

  const coreElementIds = new Set<string>();
  const linkedAny = new Set(
    (moduleLinks ?? []).map((l) => l.master_element_id as string),
  );
  for (const el of coreElements ?? []) {
    if (!linkedAny.has(el.id as string)) {
      coreElementIds.add(el.id as string);
    }
  }

  const elementCount = coreElementIds.size + moduleElementIds.size;

  const categoryGroupIds = new Set<string>();
  for (const g of coreGroups ?? []) {
    categoryGroupIds.add(g.id as string);
  }

  if (selectedModuleIds.length > 0) {
    const { data: modules } = await supabase
      .from("master_module")
      .select("name")
      .in("id", selectedModuleIds);
    const moduleNames = new Set(
      (modules ?? []).map((m) => (m.name as string).trim().toUpperCase()),
    );
    for (const g of allGroups ?? []) {
      if (moduleNames.has((g.name as string).trim().toUpperCase())) {
        categoryGroupIds.add(g.id as string);
      }
    }
  }

  return {
    categoryCount: categoryGroupIds.size,
    elementCount,
    coreElementCount: coreElementIds.size,
  };
}

export async function searchPmActivos(
  ctx: UserContext,
  query: string,
  limit = 20,
): Promise<PmActivoOption[]> {
  const supabase = await getActasReadSupabase(ctx);
  const q = query.trim();
  let builder = supabase
    .from("pm_activos")
    .select("id, id_activo, nombre_display")
    .order("id_activo")
    .limit(limit);

  if (q) {
    builder = builder.or(`id_activo.ilike.%${q}%,nombre_display.ilike.%${q}%`);
  }

  const { data, error } = await builder;
  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const idActivo = row.id_activo as string;
    const name = (row.nombre_display as string | null)?.trim();
    return {
      id: row.id as string,
      idActivo,
      label: name ? `${idActivo} — ${name}` : idActivo,
    };
  });
}

export async function resolveOrganizationIdForUser(
  ctx: UserContext,
): Promise<string> {
  const authUserId = await resolveAuthUserIdByEmail(ctx.email);
  if (!authUserId) return ICAM_ORG_ID;

  const supabase = await getActasReadSupabase(ctx);
  const { data, error } = await supabase
    .from("org_member")
    .select("organization_id")
    .eq("user_id", authUserId)
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data?.organization_id as string) ?? ICAM_ORG_ID;
}

/** Cuenta elementos del catálogo seleccionados (core + módulos). */
export async function countCatalogElementsPg(
  client: PoolClient,
  selectedModuleIds: string[],
): Promise<number> {
  const { rows } = await client.query<{ c: string }>(
    `SELECT count(DISTINCT me.id)::text AS c
     FROM public.master_element me
     LEFT JOIN public.master_element_module mem
       ON mem.master_element_id = me.id
     WHERE mem.master_module_id IS NULL
        OR mem.master_module_id = ANY($1::uuid[])`,
    [selectedModuleIds],
  );
  return Number(rows[0]?.c ?? 0);
}
