import { config } from "dotenv";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { mondayQuery } from "../../src/services/monday/client";
import {
  ELEMENT_MAPPING_OUTPUT,
  loadMasterCatalog,
  matchElement,
  matchGroup,
  fetchBoardFlattenedElements,
  type ElementMappingRow,
  type GroupMapping,
} from "./lib/element-mapping";
import { normalizeKey } from "./lib/normalize";

config({ path: resolve(process.cwd(), ".env.local") });

const DEFAULT_SAMPLE_BOARD_ID = "18401743922";

const BOARD_META_QUERY = `
  query BoardMeta($id: ID!) {
    boards(ids: [$id]) {
      id
      name
      groups { id title }
    }
  }
`;

async function main(): Promise<void> {
  const boardId =
    process.env.MONDAY_SAMPLE_BOARD_ID?.trim() || DEFAULT_SAMPLE_BOARD_ID;

  console.log("Catálogo maestro (Supabase)…");
  const catalog = await loadMasterCatalog();
  console.log(
    `  ${catalog.groups.length} grupos · ${catalog.elements.length} elementos`,
  );

  console.log(`Monday tablero muestra ${boardId}…`);
  const meta = await mondayQuery<{
    boards: { id: string; name: string; groups: { id: string; title: string }[] }[];
  }>(BOARD_META_QUERY, { id: boardId });
  const board = meta.boards?.[0];
  if (!board) throw new Error(`Tablero ${boardId} no encontrado`);

  const flat = await fetchBoardFlattenedElements(boardId);
  console.log(`  ${board.groups.length} grupos · ${flat.length} filas (items + subitems)`);

  const groupMappings: GroupMapping[] = board.groups.map((g) => {
    const m = matchGroup(g.title, catalog);
    return {
      monday_group_id: g.id,
      monday_title: g.title,
      ...m,
      manual_master_group_id: null,
      notes: m.unmapped
        ? "Completar manual_master_group_id o añadir alias en scripts/actas/lib/normalize.ts"
        : null,
    };
  });

  const groupNormByMondayTitle = new Map<string, string | null>();
  for (const gm of groupMappings) {
    groupNormByMondayTitle.set(
      gm.monday_title,
      gm.master_group_name ? normalizeKey(gm.master_group_name) : null,
    );
  }

  const elementMappings: ElementMappingRow[] = flat.map((row) => {
    const groupNorm = groupNormByMondayTitle.get(row.monday_group_title) ?? null;
    const m = matchElement(row.name, groupNorm, catalog, {
      parent_item_name: row.parent_item_name,
      parent_monday_group: row.parent_monday_group,
    });

    return {
      monday_item_id: row.id,
      monday_name: row.name,
      monday_group_title: row.monday_group_title,
      parent_item_name: row.parent_item_name,
      parent_monday_group: row.parent_monday_group,
      ...m,
      manual_master_element_id: null,
      notes: m.unmapped
        ? m.suggested_master_name
          ? `Sugerencia: «${m.suggested_master_name}»`
          : "Sin coincidencia automática"
        : null,
    };
  });

  const unmappedGroups = groupMappings.filter((g) => g.unmapped);
  const unmappedElements = elementMappings.filter((e) => e.unmapped);

  const payload = {
    generated_at: new Date().toISOString(),
    description:
      "Mapeo grupos/elementos Monday → master_group/master_element (tablero muestra).",
    scope: "sample_board",
    sample_board_id: boardId,
    sample_board_name: board.name,
    groups: groupMappings,
    elements: elementMappings,
    unmapped_groups: unmappedGroups,
    unmapped_elements: unmappedElements,
    summary: {
      groups_total: groupMappings.length,
      groups_mapped: groupMappings.length - unmappedGroups.length,
      groups_unmapped: unmappedGroups.length,
      elements_total: elementMappings.length,
      elements_mapped: elementMappings.length - unmappedElements.length,
      elements_unmapped: unmappedElements.length,
    },
  };

  writeFileSync(
    ELEMENT_MAPPING_OUTPUT,
    `${JSON.stringify(payload, null, 2)}\n`,
    "utf8",
  );
  console.log(`\nEscrito ${ELEMENT_MAPPING_OUTPUT}`);
  console.log(
    `Grupos: ${payload.summary.groups_mapped}/${payload.summary.groups_total} mapped`,
  );
  console.log(
    `Elementos: ${payload.summary.elements_mapped}/${payload.summary.elements_total} mapped`,
  );
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
