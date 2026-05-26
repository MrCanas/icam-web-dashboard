/** Parseo de títulos de tableros Actas (snapshot / subelementos) e ítems con jerarquía. */

const DATE_SUFFIX = /\s*-\s*(\d{2})\/(\d{2})\/(\d{4})\s*$/;

export type MondayBoardKind = "snapshot" | "subelementos" | "subitems" | "other";

export interface ParsedMondayBoard {
  id: string;
  rawName: string;
  kind: MondayBoardKind;
  projectCode: string | null;
  snapshotDate: string | null;
  itemsCount: number;
}

/** Fila cruda devuelta por la API Monday (items_page). */
export interface MondayRawItem {
  id: string;
  name: string;
  groupTitle: string;
  subitems: { id: string; name: string }[];
}

/** Elemento aplanado listo para mapeo (ítem raíz o subitem con contexto padre). */
export interface MondayFlattenedElement {
  id: string;
  name: string;
  monday_group_title: string;
  parent_item_name: string | null;
  parent_monday_group: string | null;
  kind: "item" | "subitem";
}

function normalizeProjectCode(code: string): string {
  return code.replace(/\s+/g, " ").trim();
}

function parseSnapshotDate(match: RegExpMatchArray): string | null {
  const day = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  const year = Number.parseInt(match[3], 10);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return Number.isNaN(new Date(iso).getTime()) ? null : iso;
}

export function parseMondayBoardName(
  id: string,
  name: string,
  itemsCount = 0,
): ParsedMondayBoard {
  const trimmed = name.trim();
  let kind: MondayBoardKind = "other";
  let projectCode: string | null = null;
  let snapshotDate: string | null = null;

  const subEs = trimmed.match(/^Subelementos de\s+(.+)$/i);
  const subEn = trimmed.match(/^Subitems of\s+(.+)$/i);
  const prefix = subEs ?? subEn;

  if (prefix) {
    kind = subEs ? "subelementos" : "subitems";
    const rest = prefix[1];
    const dateMatch = rest.match(DATE_SUFFIX);
    if (dateMatch) {
      projectCode = normalizeProjectCode(rest.slice(0, dateMatch.index).trim());
      const parsed = parseSnapshotDate(dateMatch);
      if (parsed) snapshotDate = parsed;
    }
  } else {
    const dateMatch = trimmed.match(DATE_SUFFIX);
    if (dateMatch) {
      kind = "snapshot";
      projectCode = normalizeProjectCode(trimmed.slice(0, dateMatch.index!).trim());
      const parsed = parseSnapshotDate(dateMatch);
      if (parsed) snapshotDate = parsed;
    }
  }

  return {
    id,
    rawName: trimmed,
    kind,
    projectCode,
    snapshotDate,
    itemsCount,
  };
}

/**
 * Asocia cada subitem con el nombre y grupo Monday de su ítem padre.
 */
export function flattenMondayItemsWithParentContext(
  items: MondayRawItem[],
): MondayFlattenedElement[] {
  const out: MondayFlattenedElement[] = [];

  for (const item of items) {
    const groupTitle = item.groupTitle.trim();
    const parentName = item.name.trim();

    out.push({
      id: item.id,
      name: parentName,
      monday_group_title: groupTitle,
      parent_item_name: null,
      parent_monday_group: null,
      kind: "item",
    });

    for (const sub of item.subitems) {
      out.push({
        id: sub.id,
        name: sub.name.trim(),
        monday_group_title: groupTitle,
        parent_item_name: parentName,
        parent_monday_group: groupTitle,
        kind: "subitem",
      });
    }
  }

  return out;
}
