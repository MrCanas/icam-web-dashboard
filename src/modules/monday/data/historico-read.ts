import { fetchBoardActivityLogs, parseStageChangeEvents } from "@/modules/monday/data/activity-logs";
import { fetchAllItemsForBoard } from "@/modules/monday/data/dashboard-read";
import { buildMondayAssets } from "@/modules/monday/logic/dashboard-transform";
import type { MondayAsset, MondayStage } from "@/modules/monday/data/dashboard-types";
import {
  buildLogEventsByItem,
  collectBoardGroupTitles,
  pickStageColumnId,
  type HistoricoActivityMode,
} from "@/modules/monday/logic/historico-transform";
import { getMondayBoardColumns, getMondayBoards } from "@/modules/monday/data/read";
import type { MondayActivityLogEntry, MondayBoard } from "@/modules/monday/data/types";

function logMapToRecord(map: Map<string, Array<{ at: string; stage: MondayStage }>>): Record<
  string,
  Array<{ at: string; stage: MondayStage }>
> {
  const o: Record<string, Array<{ at: string; stage: MondayStage }>> = {};
  for (const [k, v] of map) {
    if (v.length) o[k] = v;
  }
  return o;
}

export interface MondayHistoricoPayload {
  boards: MondayBoard[];
  selectedBoardId: string | null;
  selectedBoardName: string | null;
  groupTitles: string[];
  assets: MondayAsset[];
  activityMode: HistoricoActivityMode;
  logEventsByItemId: Record<string, Array<{ at: string; stage: MondayStage }>>;
}

export async function getMondayHistoricoPayload(options: { boardId?: string }): Promise<MondayHistoricoPayload> {
  const boards = await getMondayBoards();
  const selectedBoardId = options.boardId ?? boards[0]?.id ?? null;
  if (!selectedBoardId) {
    return {
      boards,
      selectedBoardId: null,
      selectedBoardName: null,
      groupTitles: [],
      assets: [],
      activityMode: "heuristic",
      logEventsByItemId: {},
    };
  }

  const boardMeta = await getMondayBoardColumns(selectedBoardId);
  const items = await fetchAllItemsForBoard(selectedBoardId);
  const assets = buildMondayAssets(items, boardMeta?.columns ?? []);
  const stageColumnId = pickStageColumnId(boardMeta?.columns ?? []);

  let activityMode: HistoricoActivityMode = "heuristic";
  let rawLogs: MondayActivityLogEntry[] = [];
  if (stageColumnId) {
    try {
      rawLogs = await fetchBoardActivityLogs({
        boardId: selectedBoardId,
        columnIds: [stageColumnId],
      });
      if (rawLogs.length) activityMode = "activity_logs";
    } catch (error) {
      console.warn("[monday historico] activity_logs no disponibles", error);
    }
  }

  const parsed = parseStageChangeEvents(rawLogs, stageColumnId);
  const logEventsByItem = buildLogEventsByItem(parsed);

  const fromBoard = (boardMeta?.groups ?? []).map((g) => g.title);
  const fromAssets = collectBoardGroupTitles(assets);
  const groupTitles = Array.from(new Set([...fromBoard, ...fromAssets])).sort((a, b) =>
    a.localeCompare(b, "es"),
  );

  return {
    boards,
    selectedBoardId,
    selectedBoardName: boardMeta?.name ?? null,
    groupTitles,
    assets,
    activityMode,
    logEventsByItemId: logMapToRecord(logEventsByItem),
  };
}
