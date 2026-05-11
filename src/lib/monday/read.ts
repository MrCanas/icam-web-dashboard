import { mondayRequest } from "@/lib/monday/client";
import { getMondayConfig } from "@/lib/monday/config";
import {
  MONDAY_BOARDS_QUERY,
  MONDAY_COLUMNS_QUERY,
  MONDAY_ITEMS_QUERY,
  MONDAY_ME_QUERY,
} from "@/lib/monday/queries";
import type { MondayBoard, MondayColumn, MondayItemsPage } from "@/lib/monday/types";

type MeQueryResult = {
  me: {
    id: string;
    name: string;
  };
};

type BoardsQueryResult = {
  boards: MondayBoard[];
};

type BoardColumnsQueryResult = {
  boards: Array<{
    id: string;
    name: string;
    columns: MondayColumn[];
  }>;
};

type BoardItemsQueryResult = {
  boards: Array<{
    id: string;
    name: string;
    items_page: MondayItemsPage;
  }>;
};

export async function getMondayMe() {
  const data = await mondayRequest<MeQueryResult>(MONDAY_ME_QUERY);
  return data.me;
}

export async function getMondayBoards() {
  const { boardIds } = getMondayConfig();
  const data = await mondayRequest<BoardsQueryResult>(MONDAY_BOARDS_QUERY, {
    ids: boardIds.length ? boardIds : undefined,
  });
  return data.boards;
}

export async function getMondayBoardColumns(boardId: string) {
  const data = await mondayRequest<BoardColumnsQueryResult>(MONDAY_COLUMNS_QUERY, {
    boardId: [boardId],
  });
  return data.boards[0] ?? null;
}

export async function getMondayBoardItems(boardId: string, limit = 50, cursor?: string) {
  const data = await mondayRequest<BoardItemsQueryResult>(MONDAY_ITEMS_QUERY, {
    boardId,
    limit,
    cursor: cursor || undefined,
  });
  return data.boards[0] ?? null;
}
