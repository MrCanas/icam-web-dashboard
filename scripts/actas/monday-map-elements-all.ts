import { config } from "dotenv";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { mondayQuery } from "../../src/services/monday/client";
import { parseMondayBoardName } from "./lib/monday-board-parse";
import {
  ELEMENT_MAPPING_OUTPUT,
  UNMAPPED_SUMMARY_OUTPUT,
  loadMasterCatalog,
  loadElementMappingCache,
  matchElement,
  matchGroup,
  fetchBoardFlattenedElements,
  pickDominantGroup,
  pickDominantParent,
  writeUnmappedSummaryMd,
  countByMatchType,
  bucketUnmappedCounts,
  remapGroupFromCache,
  remapUniqueElementFromCache,
  buildGroupNormByTitle,
  type UniqueElementMapping,
  type GroupMapping,
  type ElementMatchType,
  type ElementMappingCachePayload,
  type MasterCatalog,
} from "./lib/element-mapping";
import { normalizeKey } from "./lib/normalize";

config({ path: resolve(process.cwd(), ".env.local") });

const PAGE_SIZE = 500;

const BOARDS_PAGE_QUERY = `
  query BoardsPage($workspaceIds: [ID!]!, $limit: Int!, $page: Int!) {
    boards(workspace_ids: $workspaceIds, limit: $limit, page: $page) {
      id
      name
      items_count
      groups { id title }
    }
  }
`;

interface BoardListRow {
  id: string;
  name: string;
  items_count?: number | null;
  groups?: { id: string; title: string }[];
}

interface ElementOccurrence {
  monday_name: string;
  monday_group_title: string;
  board_id: string;
  board_name: string;
  project_code: string | null;
  parent_item_name: string | null;
  parent_monday_group: string | null;
}

interface UniqueAccumulator {
  monday_name: string;
  monday_name_normalized: string;
  groupCounts: Map<string, number>;
  parentCounts: Map<
    string,
    { count: number; parent_item_name: string; parent_monday_group: string }
  >;
  boardIds: Set<string>;
  boardSamples: Map<string, { board_name: string; project_code: string | null }>;
  projectCodes: Set<string>;
  occurrence_count: number;
}

function parseArgs(argv: string[]): { fromCache: boolean } {
  return {
    fromCache: argv.includes("--from-cache") || argv.includes("--fromCache"),
  };
}

async function fetchAllWorkspaceBoards(
  workspaceId: string,
): Promise<BoardListRow[]> {
  const all: BoardListRow[] = [];
  let page = 1;

  for (;;) {
    const data = await mondayQuery<{ boards: BoardListRow[] }>(
      BOARDS_PAGE_QUERY,
      { workspaceIds: [workspaceId], limit: PAGE_SIZE, page },
      { timeoutMs: 90_000 },
    );
    const batch = data.boards ?? [];
    all.push(...batch);
    if (batch.length < PAGE_SIZE) break;
    console.log(`  listado página ${page}: +${batch.length} (total ${all.length})`);
    page += 1;
  }

  return all;
}

function parentCountKey(parentName: string, parentGroup: string): string {
  return `${normalizeKey(parentName)}|${normalizeKey(parentGroup)}`;
}

function addOccurrence(
  byName: Map<string, UniqueAccumulator>,
  occ: ElementOccurrence,
): void {
  const norm = normalizeKey(occ.monday_name);
  if (!norm) return;

  let acc = byName.get(norm);
  if (!acc) {
    acc = {
      monday_name: occ.monday_name.trim(),
      monday_name_normalized: norm,
      groupCounts: new Map(),
      parentCounts: new Map(),
      boardIds: new Set(),
      boardSamples: new Map(),
      projectCodes: new Set(),
      occurrence_count: 0,
    };
    byName.set(norm, acc);
  }

  acc.occurrence_count += 1;
  if (occ.monday_group_title) {
    const gk = occ.monday_group_title;
    acc.groupCounts.set(gk, (acc.groupCounts.get(gk) ?? 0) + 1);
  }
  if (occ.parent_item_name) {
    const pk = parentCountKey(occ.parent_item_name, occ.parent_monday_group ?? "");
    const prev = acc.parentCounts.get(pk);
    if (prev) {
      prev.count += 1;
    } else {
      acc.parentCounts.set(pk, {
        count: 1,
        parent_item_name: occ.parent_item_name,
        parent_monday_group: occ.parent_monday_group ?? "",
      });
    }
  }
  acc.boardIds.add(occ.board_id);
  acc.boardSamples.set(occ.board_id, {
    board_name: occ.board_name,
    project_code: occ.project_code,
  });
  if (occ.project_code) acc.projectCodes.add(occ.project_code);
}

function buildElementsUniqueFromScan(
  byName: Map<string, UniqueAccumulator>,
  catalog: MasterCatalog,
  groupNormByTitle: Map<string, string | null>,
): UniqueElementMapping[] {
  const elementsUnique: UniqueElementMapping[] = [];

  for (const acc of [...byName.values()].sort((a, b) =>
    a.monday_name.localeCompare(b.monday_name, "es"),
  )) {
    const sampleGroup = pickDominantGroup(acc.groupCounts);
    const groupNorm = groupNormByTitle.get(sampleGroup) ?? null;
    const dominantParent = pickDominantParent(acc.parentCounts);

    const m = matchElement(acc.monday_name, groupNorm, catalog, {
      parent_item_name: dominantParent.parent_item_name,
      parent_monday_group: dominantParent.parent_monday_group,
    });
    const groupMatch = matchGroup(sampleGroup, catalog);

    const boardsSample = [...acc.boardSamples.entries()]
      .slice(0, 5)
      .map(([board_id, v]) => ({
        board_id,
        board_name: v.board_name,
        project_code: v.project_code,
      }));

    const sampleBoard = boardsSample[0];

    elementsUnique.push({
      monday_name: acc.monday_name,
      monday_name_normalized: acc.monday_name_normalized,
      ...m,
      manual_master_element_id: null,
      notes: m.unmapped
        ? m.suggested_master_name
          ? `Sugerencia catálogo: «${m.suggested_master_name}»`
          : "Sin coincidencia automática en master_element"
        : null,
      appearance_count: acc.boardIds.size,
      occurrence_count: acc.occurrence_count,
      project_codes: [...acc.projectCodes].sort((a, b) => a.localeCompare(b, "es")),
      monday_groups_seen: [...acc.groupCounts.keys()].sort((a, b) =>
        a.localeCompare(b, "es"),
      ),
      sample_monday_group: sampleGroup,
      sample_board_id: sampleBoard?.board_id ?? "",
      sample_board_name: sampleBoard?.board_name ?? "",
      proposed_master_group: groupMatch.master_group_name,
      proposed_master_group_id: groupMatch.master_group_id,
      boards_sample: boardsSample,
      parent_item_name: dominantParent.parent_item_name,
      parent_monday_group: dominantParent.parent_monday_group,
    });
  }

  return elementsUnique;
}

function buildElementsUniqueFromCache(
  cachedElements: UniqueElementMapping[],
  catalog: MasterCatalog,
  groupNormByTitle: Map<string, string | null>,
): UniqueElementMapping[] {
  return cachedElements
    .map((row) => remapUniqueElementFromCache(row, catalog, groupNormByTitle))
    .sort((a, b) => a.monday_name.localeCompare(b.monday_name, "es"));
}

function writeMappingOutputs(
  payload: ElementMappingCachePayload,
  workspaceId: string,
): void {
  const unmappedElements = payload.elements_unique.filter((e) => e.unmapped);
  const unmappedGroups = payload.groups.filter((g) => g.unmapped);
  const matchTypeCounts = countByMatchType(payload.elements_unique);
  const unmappedBuckets = bucketUnmappedCounts(unmappedElements);

  payload.summary = {
    groups_total: payload.groups.length,
    groups_mapped: payload.groups.length - unmappedGroups.length,
    groups_unmapped: unmappedGroups.length,
    elements_unique_total: payload.elements_unique.length,
    elements_mapped: payload.elements_unique.length - unmappedElements.length,
    elements_unmapped: unmappedElements.length,
    total_occurrences: payload.elements_unique.reduce(
      (s, e) => s + e.occurrence_count,
      0,
    ),
    match_type_counts: matchTypeCounts,
    unmapped_by_bucket: unmappedBuckets,
  };
  payload.unmapped_groups = unmappedGroups;
  payload.unmapped_elements = unmappedElements;

  writeFileSync(
    ELEMENT_MAPPING_OUTPUT,
    `${JSON.stringify(payload, null, 2)}\n`,
    "utf8",
  );
  writeUnmappedSummaryMd(
    unmappedElements,
    workspaceId,
    matchTypeCounts,
    unmappedBuckets,
  );

  console.log(`\nEscrito ${ELEMENT_MAPPING_OUTPUT}`);
  console.log(`Escrito ${UNMAPPED_SUMMARY_OUTPUT}`);
  console.log(`\n--- Resumen ---\nTotal únicos: ${payload.summary.elements_unique_total}`);
  console.log("Mapped por match_type:");
  for (const t of [
    "exact",
    "cross_group",
    "parent_context",
    "manual_resolution",
    "normalized",
    "inclusion",
    "fuzzy",
  ] as ElementMatchType[]) {
    console.log(`  ${t}: ${matchTypeCounts[t]}`);
  }
  console.log(`  unmapped: ${matchTypeCounts.unmapped}`);
  console.log("\nUnmapped por bucket:");
  console.log(`  Críticos (≥50): ${unmappedBuckets.criticos}`);
  console.log(`  Frecuentes (10-49): ${unmappedBuckets.frecuentes}`);
  console.log(`  Ocasionales (3-9): ${unmappedBuckets.ocasionales}`);
  console.log(`  Marginales (1-2): ${unmappedBuckets.marginales}`);

  if (unmappedElements.length) {
    console.log("\nTop unmapped (por apariciones en tableros):");
    for (const e of [...unmappedElements]
      .sort((a, b) => b.appearance_count - a.appearance_count)
      .slice(0, 10)) {
      const parent = e.parent_item_name ? ` ← ${e.parent_item_name}` : "";
      console.log(
        `  - ${e.monday_name}${parent} (${e.appearance_count} tableros) [${e.sample_monday_group}]`,
      );
    }
  }
}

async function runFromMondayScan(workspaceId: string): Promise<void> {
  const catalog = await loadMasterCatalog();
  const childParents = catalog.childrenByParentId.size;
  console.log(
    `  ${catalog.groups.length} grupos · ${catalog.elements.length} elementos · ${childParents} padres con sub-elementos`,
  );

  console.log(`Monday: listando tableros workspace ${workspaceId}…`);
  const boards = await fetchAllWorkspaceBoards(workspaceId);
  const toScan = boards.filter((b) => (b.items_count ?? 0) > 0);
  console.log(`  ${boards.length} tableros · ${toScan.length} con items > 0`);

  const byName = new Map<string, UniqueAccumulator>();
  const groupTitlesGlobal = new Map<
    string,
    { title: string; boardIds: Set<string>; projectCodes: Set<string> }
  >();

  let scanned = 0;
  for (const board of toScan) {
    scanned += 1;
    const parsed = parseMondayBoardName(
      board.id,
      board.name,
      board.items_count ?? 0,
    );

    for (const g of board.groups ?? []) {
      const title = g.title.trim();
      if (!title) continue;
      const gk = normalizeKey(title);
      if (!groupTitlesGlobal.has(gk)) {
        groupTitlesGlobal.set(gk, {
          title,
          boardIds: new Set(),
          projectCodes: new Set(),
        });
      }
      const gr = groupTitlesGlobal.get(gk)!;
      gr.boardIds.add(board.id);
      if (parsed.projectCode) gr.projectCodes.add(parsed.projectCode);
    }

    if (scanned % 25 === 0 || scanned === toScan.length) {
      console.log(
        `  items ${scanned}/${toScan.length}: ${parsed.rawName.slice(0, 50)}…`,
      );
    }

    const flat = await fetchBoardFlattenedElements(board.id);
    for (const row of flat) {
      addOccurrence(byName, {
        monday_name: row.name,
        monday_group_title: row.monday_group_title,
        board_id: board.id,
        board_name: parsed.rawName,
        project_code: parsed.projectCode,
        parent_item_name: row.parent_item_name,
        parent_monday_group: row.parent_monday_group,
      });
    }
  }

  const groupMappings: GroupMapping[] = [...groupTitlesGlobal.values()]
    .sort((a, b) => a.title.localeCompare(b.title, "es"))
    .map((g) => {
      const m = matchGroup(g.title, catalog);
      return {
        monday_group_id: normalizeKey(g.title),
        monday_title: g.title,
        ...m,
        manual_master_group_id: null,
        appearance_count: g.boardIds.size,
        project_codes: [...g.projectCodes].sort((a, b) => a.localeCompare(b, "es")),
        notes: m.unmapped
          ? "Añadir alias en scripts/actas/lib/normalize.ts o manual_master_group_id"
          : null,
      };
    });

  const groupNormByTitle = buildGroupNormByTitle(groupMappings);
  const elementsUnique = buildElementsUniqueFromScan(
    byName,
    catalog,
    groupNormByTitle,
  );

  const payload: ElementMappingCachePayload = {
    generated_at: new Date().toISOString(),
    description:
      "Mapeo deduplicado de nombres de elemento Monday (workspace) → master_element. Matcher con jerarquía padre-hijo.",
    scope: "workspace_all_boards",
    workspace_id: workspaceId,
    boards_total: boards.length,
    boards_scanned: toScan.length,
    unique_element_names: elementsUnique.length,
    unique_monday_groups: groupMappings.length,
    groups: groupMappings,
    elements_unique: elementsUnique,
    unmapped_groups: [],
    unmapped_elements: [],
    summary: {
      groups_total: 0,
      groups_mapped: 0,
      groups_unmapped: 0,
      elements_unique_total: 0,
      elements_mapped: 0,
      elements_unmapped: 0,
      total_occurrences: 0,
      match_type_counts: countByMatchType([]),
      unmapped_by_bucket: bucketUnmappedCounts([]),
    },
  };

  writeMappingOutputs(payload, workspaceId);
}

async function runFromCache(workspaceId: string): Promise<void> {
  console.log(`Caché: leyendo ${ELEMENT_MAPPING_OUTPUT}…`);
  const cached = loadElementMappingCache();
  console.log(
    `  ${cached.elements_unique.length} elementos únicos · ${cached.groups.length} grupos Monday (generado ${cached.generated_at})`,
  );

  const catalog = await loadMasterCatalog();
  console.log(
    `  Catálogo Supabase: ${catalog.groups.length} grupos · ${catalog.elements.length} elementos`,
  );

  const groupMappings = cached.groups
    .map((g) => remapGroupFromCache(g, catalog))
    .sort((a, b) => a.monday_title.localeCompare(b.monday_title, "es"));
  const groupNormByTitle = buildGroupNormByTitle(groupMappings);
  const elementsUnique = buildElementsUniqueFromCache(
    cached.elements_unique,
    catalog,
    groupNormByTitle,
  );

  const payload: ElementMappingCachePayload = {
    ...cached,
    generated_at: new Date().toISOString(),
    cache_source_generated_at: cached.generated_at,
    remapped_from_cache: true,
    description:
      "Re-mapeo desde caché (07-element-mapping.json) con catálogo Supabase actualizado; sin scan Monday.",
    workspace_id: workspaceId || cached.workspace_id,
    unique_element_names: elementsUnique.length,
    unique_monday_groups: groupMappings.length,
    groups: groupMappings,
    elements_unique: elementsUnique,
    unmapped_groups: [],
    unmapped_elements: [],
    summary: cached.summary,
  };

  writeMappingOutputs(payload, payload.workspace_id);
}

async function main(): Promise<void> {
  const { fromCache } = parseArgs(process.argv.slice(2));

  const workspaceId = process.env.MONDAY_WORKSPACE_ID_ACTAS?.trim();
  if (!workspaceId) {
    throw new Error("Falta MONDAY_WORKSPACE_ID_ACTAS en .env.local");
  }

  console.log("Catálogo maestro (Supabase)…");

  if (fromCache) {
    console.log("Modo --from-cache: omitiendo scan de Monday.\n");
    await runFromCache(workspaceId);
    return;
  }

  await runFromMondayScan(workspaceId);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
