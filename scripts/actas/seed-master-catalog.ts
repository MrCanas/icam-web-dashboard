import { existsSync } from "node:fs";
import { resolve } from "node:path";
import * as XLSX from "xlsx";
import type { SupabaseClient } from "@supabase/supabase-js";

import { createActasServerClient } from "./lib/supabase-server";

const SHEET_CATALOG = "Catálogo Maestro";
const SHEET_SUMMARY = "Resumen";

const OPTIONAL_MODULE_GROUPS = new Set([
  "DESINVERSIÓN",
  "OPERADOR HOTELERO",
  "SITUACIÓN INQUILINOS",
  "ACTIVO ACCESORIO VINCULADO",
]);

const MODULE_DESCRIPTIONS: Record<string, string> = {
  DESINVERSIÓN:
    "Módulo opcional: categoría activada según tipo y fase (fase Desinversión).",
  "OPERADOR HOTELERO":
    "Módulo opcional: activos Hotel/SRA con cualquier operador (Marriott, Numa, BOBW, …).",
  "SITUACIÓN INQUILINOS":
    "Módulo opcional: vaciado de pisos e instancias por unidad.",
  "ACTIVO ACCESORIO VINCULADO":
    "Módulo opcional: activos accesorios vinculados (proindiviso, deuda, etc.).",
};

type RowStats = { inserted: number; updated: number; skipped: number };

interface CatalogRow {
  groupName: string;
  elementLabel: string;
  subName: string;
  defaultOwner: string | null;
  tipo: string;
  modPhase: string;
  orderIndex: number;
}

interface GroupMeta {
  name: string;
  isCore: boolean;
  orderIndex: number;
}

function resolveCatalogPath(): string {
  const candidates = [
    resolve(process.cwd(), "docs/actas/catalogo-maestro.xlsx"),
    resolve(process.cwd(), "docs/actas/Catalogo_Maestro_Proyectos.xlsx"),
  ];
  const found = candidates.find((p) => existsSync(p));
  if (!found) {
    throw new Error(
      `No se encontró el Excel del catálogo. Coloca el archivo en docs/actas/catalogo-maestro.xlsx`,
    );
  }
  return found;
}

function cellStr(value: unknown): string {
  if (value == null) return "";
  return String(value).trim();
}

function parseWorkbook(path: string): {
  groups: GroupMeta[];
  catalogRows: CatalogRow[];
} {
  const wb = XLSX.readFile(path);
  const summarySheet = wb.Sheets[SHEET_SUMMARY];
  const catalogSheet = wb.Sheets[SHEET_CATALOG];
  if (!catalogSheet) {
    throw new Error(`Falta la hoja "${SHEET_CATALOG}" en ${path}`);
  }

  const summaryRows = XLSX.utils.sheet_to_json<unknown[]>(summarySheet, {
    header: 1,
    defval: "",
  }) as unknown[][];

  const groups: GroupMeta[] = [];
  for (let i = 1; i < summaryRows.length; i++) {
    const name = cellStr(summaryRows[i][0]);
    const tipo = cellStr(summaryRows[i][1]);
    if (!name || name === "TOTAL") continue;
    groups.push({
      name,
      isCore: tipo.toLowerCase() !== "módulo" && tipo.toLowerCase() !== "modulo",
      orderIndex: groups.length,
    });
  }

  const raw = XLSX.utils.sheet_to_json<unknown[]>(catalogSheet, {
    header: 1,
    defval: "",
  }) as unknown[][];

  let currentGroup = "";
  let orderInSheet = 0;
  const catalogRows: CatalogRow[] = [];

  for (let i = 1; i < raw.length; i++) {
    const grupo = cellStr(raw[i][0]);
    const elemento = cellStr(raw[i][1]);
    const subElemento = cellStr(raw[i][2]);
    const owner = cellStr(raw[i][3]);
    const tipo = cellStr(raw[i][4]);
    const modPhase = cellStr(raw[i][5]);

    if (grupo) currentGroup = grupo;
    if (!currentGroup || !elemento) continue;

    catalogRows.push({
      groupName: currentGroup,
      elementLabel: elemento,
      subName: subElemento,
      defaultOwner: owner || null,
      tipo,
      modPhase,
      orderIndex: orderInSheet++,
    });
  }

  return { groups, catalogRows };
}

function appliesWhen(row: CatalogRow): string | null {
  if (row.subName.startsWith("[Unidad:")) return row.subName;
  const mod = row.modPhase;
  if (!mod || mod === "Universal") return null;
  return mod;
}

async function upsertGroup(
  supabase: SupabaseClient,
  meta: GroupMeta,
  stats: RowStats,
): Promise<string> {
  const { data: existing, error: selErr } = await supabase
    .from("master_group")
    .select("id, name, is_core, order_index")
    .eq("name", meta.name)
    .maybeSingle();

  if (selErr) throw new Error(`master_group select: ${selErr.message}`);

  const payload = {
    name: meta.name,
    is_core: meta.isCore,
    order_index: meta.orderIndex,
  };

  if (!existing) {
    const { data, error } = await supabase
      .from("master_group")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(`master_group insert: ${error.message}`);
    stats.inserted++;
    return data.id;
  }

  const unchanged =
    existing.is_core === payload.is_core &&
    existing.order_index === payload.order_index;
  if (unchanged) {
    stats.skipped++;
    return existing.id;
  }

  const { error } = await supabase
    .from("master_group")
    .update(payload)
    .eq("id", existing.id);
  if (error) throw new Error(`master_group update: ${error.message}`);
  stats.updated++;
  return existing.id;
}

async function upsertModule(
  supabase: SupabaseClient,
  name: string,
  stats: RowStats,
): Promise<string> {
  const description = MODULE_DESCRIPTIONS[name] ?? null;
  const { data: existing, error: selErr } = await supabase
    .from("master_module")
    .select("id, name, description")
    .eq("name", name)
    .maybeSingle();

  if (selErr) throw new Error(`master_module select: ${selErr.message}`);

  if (!existing) {
    const { data, error } = await supabase
      .from("master_module")
      .insert({ name, description })
      .select("id")
      .single();
    if (error) throw new Error(`master_module insert: ${error.message}`);
    stats.inserted++;
    return data.id;
  }

  if (existing.description === description) {
    stats.skipped++;
    return existing.id;
  }

  const { error } = await supabase
    .from("master_module")
    .update({ description })
    .eq("id", existing.id);
  if (error) throw new Error(`master_module update: ${error.message}`);
  stats.updated++;
  return existing.id;
}

async function findElement(
  supabase: SupabaseClient,
  groupId: string,
  name: string,
  parentElementId: string | null,
) {
  let q = supabase
    .from("master_element")
    .select(
      "id, name, default_owner, is_subitem, parent_element_id, applies_when, order_index",
    )
    .eq("master_group_id", groupId)
    .eq("name", name);

  if (parentElementId) {
    q = q.eq("parent_element_id", parentElementId);
  } else {
    q = q.is("parent_element_id", null);
  }

  const { data, error } = await q.maybeSingle();
  if (error) throw new Error(`master_element select: ${error.message}`);
  return data;
}

async function upsertElement(
  supabase: SupabaseClient,
  payload: {
    master_group_id: string;
    name: string;
    default_owner: string | null;
    is_subitem: boolean;
    parent_element_id: string | null;
    applies_when: string | null;
    order_index: number;
  },
  stats: RowStats,
): Promise<string> {
  const existing = await findElement(
    supabase,
    payload.master_group_id,
    payload.name,
    payload.parent_element_id,
  );

  if (!existing) {
    const { data, error } = await supabase
      .from("master_element")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(`master_element insert: ${error.message}`);
    stats.inserted++;
    return data.id;
  }

  const unchanged =
    existing.default_owner === payload.default_owner &&
    existing.is_subitem === payload.is_subitem &&
    existing.applies_when === payload.applies_when &&
    existing.order_index === payload.order_index;

  if (unchanged) {
    stats.skipped++;
    return existing.id;
  }

  const { error } = await supabase
    .from("master_element")
    .update(payload)
    .eq("id", existing.id);
  if (error) throw new Error(`master_element update: ${error.message}`);
  stats.updated++;
  return existing.id;
}

async function linkElementModule(
  supabase: SupabaseClient,
  elementId: string,
  moduleId: string,
  stats: RowStats,
): Promise<void> {
  const { data: existing, error: selErr } = await supabase
    .from("master_element_module")
    .select("master_element_id")
    .eq("master_element_id", elementId)
    .eq("master_module_id", moduleId)
    .maybeSingle();

  if (selErr) throw new Error(`master_element_module select: ${selErr.message}`);
  if (existing) {
    stats.skipped++;
    return;
  }

  const { error } = await supabase.from("master_element_module").insert({
    master_element_id: elementId,
    master_module_id: moduleId,
  });
  if (error) throw new Error(`master_element_module insert: ${error.message}`);
  stats.inserted++;
}

async function main(): Promise<void> {
  const catalogPath = resolveCatalogPath();
  console.log(`Leyendo ${catalogPath}…`);
  const { groups, catalogRows } = parseWorkbook(catalogPath);
  console.log(
    `  ${groups.length} grupos, ${catalogRows.length} filas de catálogo (${catalogRows.filter((r) => !r.subName).length} elementos + ${catalogRows.filter((r) => r.subName).length} sub-elementos)\n`,
  );

  const supabase = createActasServerClient();

  const groupStats: RowStats = { inserted: 0, updated: 0, skipped: 0 };
  const moduleStats: RowStats = { inserted: 0, updated: 0, skipped: 0 };
  const elementStats: RowStats = { inserted: 0, updated: 0, skipped: 0 };
  const linkStats: RowStats = { inserted: 0, updated: 0, skipped: 0 };

  const groupIds = new Map<string, string>();
  for (const meta of groups) {
    const id = await upsertGroup(supabase, meta, groupStats);
    groupIds.set(meta.name, id);
  }

  const moduleIds = new Map<string, string>();
  for (const name of OPTIONAL_MODULE_GROUPS) {
    const id = await upsertModule(supabase, name, moduleStats);
    moduleIds.set(name, id);
  }

  /** Top-level parent id per group + element label (Excel "Elemento" column). */
  const parentIds = new Map<string, string>();

  for (const row of catalogRows) {
    const groupId = groupIds.get(row.groupName);
    if (!groupId) {
      throw new Error(`Grupo no registrado: ${row.groupName}`);
    }

    const isSubitem = row.subName.length > 0;
    const name = isSubitem ? row.subName : row.elementLabel;
    const parentKey = `${row.groupName}|${row.elementLabel}`;
    const parentElementId = isSubitem
      ? (parentIds.get(parentKey) ?? null)
      : null;

    if (isSubitem && !parentElementId) {
      throw new Error(
        `Sub-elemento sin padre: ${row.groupName} / ${row.elementLabel} / ${row.subName}`,
      );
    }

    const elementId = await upsertElement(
      supabase,
      {
        master_group_id: groupId,
        name,
        default_owner: row.defaultOwner,
        is_subitem: isSubitem,
        parent_element_id: parentElementId,
        applies_when: appliesWhen(row),
        order_index: row.orderIndex,
      },
      elementStats,
    );

    if (!isSubitem) {
      parentIds.set(parentKey, elementId);
    }

    if (OPTIONAL_MODULE_GROUPS.has(row.groupName)) {
      const moduleId = moduleIds.get(row.groupName);
      if (moduleId) {
        await linkElementModule(supabase, elementId, moduleId, linkStats);
      }
    }
  }

  const { count, error: countErr } = await supabase
    .from("master_element")
    .select("id", { count: "exact", head: true });
  if (countErr) throw new Error(`count master_element: ${countErr.message}`);

  console.log("master_group:", groupStats);
  console.log("master_module:", moduleStats);
  console.log("master_element:", elementStats);
  console.log("master_element_module:", linkStats);
  console.log(`\nmaster_element total en BD: ${count ?? 0}`);

  if ((count ?? 0) < 148) {
    console.error("Se esperaban al menos 148 filas en master_element (catálogo v2).");
    process.exit(1);
  }

  console.log("\nSeed del catálogo maestro completado.");
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
