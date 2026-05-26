import { normalizeKey, resolveGroupAlias } from "./normalize";

/** Tipos alineados con `docs/actas/07-element-mapping.json` (arrays `groups`, `elements_unique`). */

export type ElementMatchType =
  | "exact"
  | "cross_group"
  | "parent_context"
  | "manual_resolution"
  | "normalized"
  | "inclusion"
  | "fuzzy";

export interface GroupMappingFrom07 {
  monday_group_id: string;
  monday_title: string;
  master_group_id: string | null;
  master_group_name: string | null;
  mapped: boolean;
  unmapped: boolean;
  match_method: "alias_exact" | "normalized" | "manual" | "none";
  manual_master_group_id: string | null;
  notes: string | null;
  appearance_count?: number;
  project_codes?: string[];
}

export interface UniqueElementMapping {
  monday_name: string;
  monday_name_normalized: string;
  master_element_id: string | null;
  master_element_name: string | null;
  master_group_id: string | null;
  mapped: boolean;
  unmapped: boolean;
  match_type: ElementMatchType | null;
  suggested_master_name: string | null;
  manual_master_element_id: string | null;
  notes: string | null;
  matched_via_parent: string | null;
  appearance_count?: number;
  occurrence_count?: number;
  project_codes?: string[];
  monday_groups_seen?: string[];
  sample_monday_group?: string;
  sample_board_id?: string;
  sample_board_name?: string;
  proposed_master_group?: string | null;
  proposed_master_group_id?: string | null;
  boards_sample?: {
    board_id: string;
    board_name: string;
    project_code: string | null;
  }[];
  parent_item_name?: string | null;
  parent_monday_group?: string | null;
}

export interface ResolvedCategory {
  master_group_id: string | null;
  name: string;
}

export interface ResolvedElement {
  master_element_id: string | null;
  name: string;
}

/** Índice `normalizeKey(monday_name)` → fila de `elements_unique`. */
export type ElementsUniqueIndex = ReadonlyMap<string, UniqueElementMapping>;

const SUBITEMS_GROUP_NORM = normalizeKey("Subitems");

/**
 * Criterio canónico de elemento sin catálogo en el 07.
 * No usar la cadena `"unmapped"` en `match_type` (los no mapeados llevan `match_type: null`).
 */
export function isElementMappingUnmapped(
  mapping: UniqueElementMapping | null,
): boolean {
  if (!mapping) return true;
  return !mapping.mapped || mapping.match_type == null;
}

/**
 * Construye el índice de lookup para `lookupElementMapping`.
 */
export function buildElementsUniqueIndex(
  elements: readonly UniqueElementMapping[],
): ElementsUniqueIndex {
  const map = new Map<string, UniqueElementMapping>();
  for (const row of elements) {
    map.set(normalizeKey(row.monday_name), row);
  }
  return map;
}

function findGroupMapping(
  mondayGroupTitle: string,
  groupMappings: readonly GroupMappingFrom07[],
): GroupMappingFrom07 | null {
  const trimmed = mondayGroupTitle.trim();
  const keys = new Set([
    normalizeKey(trimmed),
    normalizeKey(resolveGroupAlias(trimmed)),
  ]);

  for (const g of groupMappings) {
    if (keys.has(normalizeKey(g.monday_title))) {
      return g;
    }
  }
  return null;
}

/**
 * Resuelve la categoría operativa a partir del título de grupo Monday del ítem.
 *
 * @param mondayGroupTitle - `item.group.title` en el tablero snapshot
 * @param groupMappings - `groups` del 07
 * @returns Si el grupo está mapeado en el 07: `master_group_id` + nombre de catálogo;
 *   si no: `master_group_id: null` y `name` = título Monday literal
 */
export function resolveCategoryFromMondayGroup(
  mondayGroupTitle: string,
  groupMappings: readonly GroupMappingFrom07[],
): ResolvedCategory {
  const title = mondayGroupTitle.trim();
  const hit = findGroupMapping(title, groupMappings);

  if (hit?.mapped && hit.master_group_id) {
    return {
      master_group_id: hit.master_group_id,
      name: hit.master_group_name?.trim() || title,
    };
  }

  return {
    master_group_id: null,
    name: title,
  };
}

/**
 * Indica si el grupo Monday es el contenedor técnico de subitems.
 */
export function isMondaySubitemsGroup(mondayGroupTitle: string): boolean {
  return normalizeKey(mondayGroupTitle.trim()) === SUBITEMS_GROUP_NORM;
}

/**
 * Para subitems cuyo `mondayGroupTitle` es `"Subitems"`: categoría desde el grupo del ítem padre,
 * no desde `"Subitems"`.
 *
 * @param parentMondayGroup - `parent_monday_group` del subitem (grupo del padre en Monday)
 */
export function resolveCategoryForSubitem(
  parentMondayGroup: string,
  groupMappings: readonly GroupMappingFrom07[],
): ResolvedCategory {
  return resolveCategoryFromMondayGroup(parentMondayGroup, groupMappings);
}

/**
 * Resuelve `master_element_id` y nombre operativo para un ítem Monday.
 *
 * @param mondayItemName - Nombre literal del ítem en el tablero (fila Monday), no el agregado del 07
 * @param mapping - Fila de `elements_unique` o `null` si el nombre no está en el índice.
 *   Unmapped según {@link isElementMappingUnmapped}: `!mapped || match_type == null`.
 */
export function resolveElementFromMapping(
  mondayItemName: string,
  mapping: UniqueElementMapping | null,
): ResolvedElement {
  const literalName = mondayItemName.trim();

  if (isElementMappingUnmapped(mapping)) {
    return {
      master_element_id: null,
      name: literalName,
    };
  }

  return {
    master_element_id: mapping!.master_element_id,
    name: mapping!.master_element_name?.trim() || literalName,
  };
}

/**
 * Busca la fila de mapeo por nombre de elemento (case-insensitive, sin tildes).
 */
export function lookupElementMapping(
  itemName: string,
  elementsUniqueIndex: ElementsUniqueIndex,
): UniqueElementMapping | null {
  return elementsUniqueIndex.get(normalizeKey(itemName.trim())) ?? null;
}
