import {
  applyFilters,
  buildFunnelMetrics,
  buildMondayAssets,
  buildStageMetrics,
  buildUseMetrics,
  computeMondayKpis,
  getAssetsInProgress,
} from "@/lib/monday/dashboard-transform";
import type {
  MondayAsset,
  MondayFunnelMetric,
  MondayKpiBundle,
  MondayStageMetric,
  MondayStatusGroup,
  MondayUseMetric,
} from "@/lib/monday/dashboard-types";
import type { MondayBoard } from "@/lib/monday/types";
import { getMondayBoardColumns, getMondayBoardItems, getMondayBoards } from "@/lib/monday/read";

async function fetchAllItemsForBoard(boardId: string, pageSize = 200) {
  const items = [];
  let cursor: string | undefined = undefined;
  let iterations = 0;
  do {
    const board = await getMondayBoardItems(boardId, pageSize, cursor);
    const pageItems = board?.items_page.items ?? [];
    items.push(...pageItems);
    cursor = board?.items_page.cursor ?? undefined;
    iterations += 1;
  } while (cursor && iterations < 25);
  return items;
}

export interface MondayDashboardDataReady {
  boards: MondayBoard[];
  selectedBoardId: string;
  selectedBoardName: string | null;
  assets: MondayAsset[];
  filteredAssets: MondayAsset[];
  kpis: MondayKpiBundle;
  stageMetrics: MondayStageMetric[];
  useMetrics: MondayUseMetric[];
  funnelMetrics: MondayFunnelMetric[];
  assetsInProgress: MondayAsset[];
}

export interface MondayDashboardDataEmpty {
  boards: MondayBoard[];
  selectedBoardId: null;
  selectedBoardName: null;
  assets: MondayAsset[];
  filteredAssets: MondayAsset[];
  kpis: null;
  stageMetrics: MondayStageMetric[];
  useMetrics: MondayUseMetric[];
  funnelMetrics: MondayFunnelMetric[];
  assetsInProgress: MondayAsset[];
}

export type MondayDashboardData = MondayDashboardDataReady | MondayDashboardDataEmpty;

export async function getMondayDashboardData(options: {
  boardId?: string;
  from?: string;
  to?: string;
  groups: MondayStatusGroup[];
}): Promise<MondayDashboardData> {
  const boards = await getMondayBoards();
  const selectedBoardId = options.boardId ?? boards[0]?.id;
  if (!selectedBoardId) {
    return {
      boards,
      selectedBoardId: null,
      selectedBoardName: null,
      assets: [],
      filteredAssets: [],
      kpis: null,
      stageMetrics: [],
      useMetrics: [],
      funnelMetrics: [],
      assetsInProgress: [],
    };
  }

  const [columnsBoard, items] = await Promise.all([
    getMondayBoardColumns(selectedBoardId),
    fetchAllItemsForBoard(selectedBoardId),
  ]);

  const assets = buildMondayAssets(items, columnsBoard?.columns ?? []);
  const filteredAssets = applyFilters(assets, {
    from: options.from,
    to: options.to,
    groups: options.groups,
  });

  return {
    boards,
    selectedBoardId,
    selectedBoardName: columnsBoard?.name ?? null,
    assets,
    filteredAssets,
    kpis: computeMondayKpis(filteredAssets),
    stageMetrics: buildStageMetrics(filteredAssets),
    useMetrics: buildUseMetrics(filteredAssets),
    funnelMetrics: buildFunnelMetrics(filteredAssets),
    assetsInProgress: getAssetsInProgress(filteredAssets),
  };
}

