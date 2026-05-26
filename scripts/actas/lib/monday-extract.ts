import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { mondayQuery, type Board } from "../../../src/services/monday/client";
import { parseMondayBoardName, type MondayBoardKind } from "./monday-board-parse";

const PAGE_SIZE = 500;
const ITEMS_PAGE_LIMIT = 100;
const UPDATES_PAGE_LIMIT = 100;

const BOARDS_PAGE_QUERY = `
  query BoardsPage($workspaceIds: [ID!]!, $limit: Int!, $page: Int!) {
    boards(workspace_ids: $workspaceIds, limit: $limit, page: $page) {
      id
      name
      items_count
      updated_at
      groups { id title }
    }
  }
`;

const UPDATE_FIELDS = `
  id
  body
  text_body
  created_at
  updated_at
  creator_id
  creator { id name }
`;

const BOARD_EXTRACT_PAGE_QUERY = `
  query BoardExtractPage($id: ID!, $limit: Int!, $cursor: String) {
    boards(ids: [$id]) {
      id
      name
      updated_at
      groups { id title }
      columns { id title type }
      items_page(limit: $limit, cursor: $cursor) {
        cursor
        items {
          id
          name
          created_at
          updated_at
          group { id title }
          column_values {
            id
            text
            value
            type
            column { id title type }
          }
          updates(limit: ${UPDATES_PAGE_LIMIT}) {
            ${UPDATE_FIELDS}
          }
          subitems {
            id
            name
            created_at
            updated_at
            column_values {
              id
              text
              value
              type
              column { id title type }
            }
            updates(limit: ${UPDATES_PAGE_LIMIT}) {
              ${UPDATE_FIELDS}
            }
          }
        }
      }
    }
  }
`;

const ITEM_UPDATES_PAGE_QUERY = `
  query ItemUpdatesPage($ids: [ID!]!, $limit: Int!, $page: Int!) {
    items(ids: $ids) {
      id
      updates(limit: $limit, page: $page) {
        ${UPDATE_FIELDS}
      }
    }
  }
`;

export const MONDAY_EXTRACTS_DIR = resolve(
  process.cwd(),
  "tmp/monday-extracts",
);

export interface MondayExtractColumnValue {
  column_id: string;
  column_title: string;
  column_type: string;
  text: string | null;
  value: string | null;
}

export interface MondayExtractUpdate {
  id: string;
  body: string | null;
  text_body: string | null;
  created_at: string | null;
  updated_at: string | null;
  creator_id: string | null;
  creator: { id: string; name: string | null } | null;
}

export interface MondayExtractSubitem {
  id: string;
  name: string;
  created_at: string | null;
  updated_at: string | null;
  column_values: MondayExtractColumnValue[];
  updates: MondayExtractUpdate[];
}

export interface MondayExtractItem {
  id: string;
  name: string;
  created_at: string | null;
  updated_at: string | null;
  column_values: MondayExtractColumnValue[];
  updates: MondayExtractUpdate[];
  subitems: MondayExtractSubitem[];
}

export interface MondayExtractGroup {
  id: string;
  title: string;
  items: MondayExtractItem[];
}

export interface MondayExtractColumn {
  id: string;
  title: string;
  type: string;
}

export interface MondayExtractBoard {
  id: string;
  name: string;
  updated_at: string | null;
  parsed: {
    kind: MondayBoardKind;
    project_code: string | null;
    snapshot_date: string | null;
    snapshot_date_iso: string | null;
  };
  groups: MondayExtractGroup[];
  columns: MondayExtractColumn[];
}

export interface MondayExtractPayload {
  extracted_at: string;
  project_code: string;
  workspace_id: string;
  boards: MondayExtractBoard[];
  summary: {
    boards_count: number;
    snapshot_date_min: string | null;
    snapshot_date_max: string | null;
    items_count: number;
    subitems_count: number;
    updates_count: number;
  };
}

type BoardListRow = Board & {
  groups?: { id: string; title: string }[];
};

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Tableros del workspace que pertenecen al código de proyecto (snapshot, subelementos, duplicados). */
export function boardMatchesProjectCode(
  boardName: string,
  projectCode: string,
): boolean {
  const code = projectCode.trim();
  if (!code) return false;

  const parsed = parseMondayBoardName("", boardName.trim());
  if (
    parsed.projectCode &&
    parsed.projectCode.localeCompare(code, "es", { sensitivity: "accent" }) === 0
  ) {
    return true;
  }

  const re = new RegExp(`^${escapeRegExp(code)}\\s*-`, "i");
  if (re.test(boardName.trim())) return true;

  const dupRe = new RegExp(`^Duplicado de\\s+${escapeRegExp(code)}\\s*-`, "i");
  return dupRe.test(boardName.trim());
}

export async function fetchWorkspaceBoards(
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
    page += 1;
  }

  return all;
}

function mapColumnValue(cv: {
  id: string;
  text: string | null;
  value: string | null;
  type?: string | null;
  column?: { id: string; title: string; type: string } | null;
}): MondayExtractColumnValue {
  return {
    column_id: cv.column?.id ?? cv.id,
    column_title: cv.column?.title ?? cv.id,
    column_type: cv.column?.type ?? cv.type ?? "unknown",
    text: cv.text ?? null,
    value: cv.value ?? null,
  };
}

function mapUpdate(u: {
  id: string;
  body?: string | null;
  text_body?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  creator_id?: string | null;
  creator?: { id: string; name: string | null } | null;
}): MondayExtractUpdate {
  return {
    id: u.id,
    body: u.body ?? null,
    text_body: u.text_body ?? null,
    created_at: u.created_at ?? null,
    updated_at: u.updated_at ?? null,
    creator_id: u.creator_id ?? null,
    creator: u.creator
      ? { id: u.creator.id, name: u.creator.name ?? null }
      : null,
  };
}

/** Páginas adicionales cuando un ítem tiene más de UPDATES_PAGE_LIMIT updates. */
async function fetchExtraUpdatesForItems(
  itemIds: string[],
): Promise<Map<string, MondayExtractUpdate[]>> {
  const byItem = new Map<string, MondayExtractUpdate[]>();
  if (!itemIds.length) return byItem;

  const chunkSize = 25;
  for (let i = 0; i < itemIds.length; i += chunkSize) {
    const chunk = itemIds.slice(i, i + chunkSize);
    for (let page = 2; ; page += 1) {
      const data = await mondayQuery<{
        items: {
          id: string;
          updates: {
            id: string;
            body?: string | null;
            text_body?: string | null;
            created_at?: string | null;
            updated_at?: string | null;
            creator_id?: string | null;
            creator?: { id: string; name: string | null } | null;
          }[];
        }[];
      }>(
        ITEM_UPDATES_PAGE_QUERY,
        { ids: chunk, limit: UPDATES_PAGE_LIMIT, page },
        { timeoutMs: 90_000 },
      );

      let anyPageData = false;
      for (const item of data.items ?? []) {
        const updates = item.updates ?? [];
        if (!updates.length) continue;
        anyPageData = true;
        if (!byItem.has(item.id)) byItem.set(item.id, []);
        const list = byItem.get(item.id)!;
        for (const u of updates) {
          if (!list.some((x) => x.id === u.id)) list.push(mapUpdate(u));
        }
      }

      const fullPage = (data.items ?? []).some(
        (it) => (it.updates?.length ?? 0) >= UPDATES_PAGE_LIMIT,
      );
      if (!fullPage || !anyPageData) break;
    }
  }

  return byItem;
}

async function extractBoard(boardId: string): Promise<{
  board: MondayExtractBoard;
  items_count: number;
  subitems_count: number;
  updates_count: number;
}> {
  const columns: MondayExtractColumn[] = [];
  const groupOrder: { id: string; title: string }[] = [];
  const itemsByGroupId = new Map<string, MondayExtractItem[]>();
  let boardMeta: {
    id: string;
    name: string;
    updated_at: string | null;
  } | null = null;

  const needsMoreUpdates: string[] = [];
  const rawItems: {
    id: string;
    name: string;
    created_at: string | null;
    updated_at: string | null;
    group: { id: string; title: string } | null;
    column_values: MondayExtractColumnValue[];
    updates: MondayExtractUpdate[];
    subitems: MondayExtractSubitem[];
  }[] = [];

  let cursor: string | null = null;
  for (;;) {
    const data = await mondayQuery<{
      boards: {
        id: string;
        name: string;
        updated_at: string | null;
        groups: { id: string; title: string }[];
        columns: { id: string; title: string; type: string }[];
        items_page: {
          cursor: string | null;
          items: {
            id: string;
            name: string;
            created_at: string | null;
            updated_at: string | null;
            group: { id: string; title: string } | null;
            column_values: {
              id: string;
              text: string | null;
              value: string | null;
              type?: string | null;
              column?: { id: string; title: string; type: string } | null;
            }[];
            updates: {
              id: string;
              body?: string | null;
              text_body?: string | null;
              created_at?: string | null;
              updated_at?: string | null;
              creator_id?: string | null;
              creator?: { id: string; name: string | null } | null;
            }[];
            subitems: {
              id: string;
              name: string;
              created_at: string | null;
              updated_at: string | null;
              column_values: {
                id: string;
                text: string | null;
                value: string | null;
                type?: string | null;
                column?: { id: string; title: string; type: string } | null;
              }[];
              updates: {
                id: string;
                body?: string | null;
                text_body?: string | null;
                created_at?: string | null;
                updated_at?: string | null;
                creator_id?: string | null;
                creator?: { id: string; name: string | null } | null;
              }[];
            }[];
          }[];
        };
      }[];
    }>(
      BOARD_EXTRACT_PAGE_QUERY,
      { id: boardId, limit: ITEMS_PAGE_LIMIT, cursor },
      { timeoutMs: 120_000 },
    );

    const board = data.boards?.[0];
    if (!board) throw new Error(`Tablero ${boardId} no encontrado`);

    if (!boardMeta) {
      boardMeta = {
        id: board.id,
        name: board.name,
        updated_at: board.updated_at ?? null,
      };
      if (!columns.length) {
        for (const c of board.columns ?? []) {
          columns.push({ id: c.id, title: c.title, type: c.type });
        }
      }
      if (!groupOrder.length) {
        for (const g of board.groups ?? []) {
          groupOrder.push({ id: g.id, title: g.title });
          itemsByGroupId.set(g.id, []);
        }
      }
    }

    for (const item of board.items_page?.items ?? []) {
      const itemUpdates = (item.updates ?? []).map(mapUpdate);
      if (itemUpdates.length >= UPDATES_PAGE_LIMIT) needsMoreUpdates.push(item.id);

      const subitems: MondayExtractSubitem[] = (item.subitems ?? []).map((sub) => {
        const subUpdates = (sub.updates ?? []).map(mapUpdate);
        if (subUpdates.length >= UPDATES_PAGE_LIMIT) needsMoreUpdates.push(sub.id);
        return {
          id: sub.id,
          name: sub.name,
          created_at: sub.created_at ?? null,
          updated_at: sub.updated_at ?? null,
          column_values: (sub.column_values ?? []).map(mapColumnValue),
          updates: subUpdates,
        };
      });

      rawItems.push({
        id: item.id,
        name: item.name,
        created_at: item.created_at ?? null,
        updated_at: item.updated_at ?? null,
        group: item.group,
        column_values: (item.column_values ?? []).map(mapColumnValue),
        updates: itemUpdates,
        subitems,
      });
    }

    cursor = board.items_page?.cursor ?? null;
    if (!cursor) break;
  }

  const extraUpdates = await fetchExtraUpdatesForItems(needsMoreUpdates);

  let updates_count = 0;
  for (const raw of rawItems) {
    const more = extraUpdates.get(raw.id) ?? [];
    for (const u of more) {
      if (!raw.updates.some((x) => x.id === u.id)) raw.updates.push(u);
    }
    updates_count += raw.updates.length;

    for (const sub of raw.subitems) {
      const moreSub = extraUpdates.get(sub.id) ?? [];
      for (const u of moreSub) {
        if (!sub.updates.some((x) => x.id === u.id)) sub.updates.push(u);
      }
      updates_count += sub.updates.length;
    }

    const groupId = raw.group?.id ?? "_ungrouped";
    const groupTitle = raw.group?.title ?? "Sin grupo";
    if (!itemsByGroupId.has(groupId)) {
      groupOrder.push({ id: groupId, title: groupTitle });
      itemsByGroupId.set(groupId, []);
    }

    itemsByGroupId.get(groupId)!.push({
      id: raw.id,
      name: raw.name,
      created_at: raw.created_at,
      updated_at: raw.updated_at,
      column_values: raw.column_values,
      updates: raw.updates,
      subitems: raw.subitems,
    });
  }

  const parsedBoard = parseMondayBoardName(
    boardMeta!.id,
    boardMeta!.name,
    rawItems.length,
  );

  const groups: MondayExtractGroup[] = groupOrder.map((g) => ({
    id: g.id,
    title: g.title,
    items: itemsByGroupId.get(g.id) ?? [],
  }));

  const extractBoard: MondayExtractBoard = {
    id: boardMeta!.id,
    name: boardMeta!.name,
    updated_at: boardMeta!.updated_at,
    parsed: {
      kind: parsedBoard.kind,
      project_code: parsedBoard.projectCode,
      snapshot_date: parsedBoard.snapshotDate
        ? formatDisplayDate(parsedBoard.snapshotDate)
        : null,
      snapshot_date_iso: parsedBoard.snapshotDate,
    },
    groups,
    columns,
  };

  const subitems_count = rawItems.reduce((n, i) => n + i.subitems.length, 0);

  return {
    board: extractBoard,
    items_count: rawItems.length,
    subitems_count,
    updates_count,
  };
}

function formatDisplayDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

export async function extractProjectFromMonday(
  workspaceId: string,
  projectCode: string,
  options: { onBoardProgress?: (current: number, total: number, name: string) => void } = {},
): Promise<MondayExtractPayload> {
  const code = projectCode.trim().toUpperCase();
  const allBoards = await fetchWorkspaceBoards(workspaceId);
  const matched = allBoards
    .filter((b) => boardMatchesProjectCode(b.name, code))
    .sort((a, b) => a.name.localeCompare(b.name, "es"));

  if (!matched.length) {
    throw new Error(
      `No se encontraron tableros para el proyecto «${code}» en el workspace ${workspaceId}`,
    );
  }

  const boards: MondayExtractBoard[] = [];
  let items_count = 0;
  let subitems_count = 0;
  let updates_count = 0;
  const snapshotDates: string[] = [];

  for (let i = 0; i < matched.length; i++) {
    const row = matched[i]!;
    options.onBoardProgress?.(i + 1, matched.length, row.name);
    const result = await extractBoard(row.id);
    boards.push(result.board);
    items_count += result.items_count;
    subitems_count += result.subitems_count;
    updates_count += result.updates_count;
    if (result.board.parsed.snapshot_date_iso) {
      snapshotDates.push(result.board.parsed.snapshot_date_iso);
    }
  }

  snapshotDates.sort();

  return {
    extracted_at: new Date().toISOString(),
    project_code: code,
    workspace_id: workspaceId,
    boards,
    summary: {
      boards_count: boards.length,
      snapshot_date_min: snapshotDates[0] ?? null,
      snapshot_date_max: snapshotDates[snapshotDates.length - 1] ?? null,
      items_count,
      subitems_count,
      updates_count,
    },
  };
}

export function writeMondayExtract(
  payload: MondayExtractPayload,
  projectCode?: string,
): string {
  const code = (projectCode ?? payload.project_code).trim().toUpperCase();
  mkdirSync(MONDAY_EXTRACTS_DIR, { recursive: true });
  const outPath = resolve(MONDAY_EXTRACTS_DIR, `${code}.json`);
  writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return outPath;
}
