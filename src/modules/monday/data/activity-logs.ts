import { mondayRequest } from "@/modules/monday/data/client";
import { MONDAY_ACTIVITY_LOGS_QUERY } from "@/modules/monday/data/queries";
import type { MondayActivityLogEntry } from "@/modules/monday/data/types";
import { normalizeStage } from "@/modules/monday/logic/dashboard-transform";
import type { MondayStage } from "@/modules/monday/data/dashboard-types";

type ActivityLogsResult = {
  boards: Array<{
    activity_logs: MondayActivityLogEntry[] | null;
  }>;
};

export async function fetchBoardActivityLogs(args: {
  boardId: string;
  columnIds: string[];
  fromIso?: string | null;
  toIso?: string | null;
  maxPages?: number;
  pageSize?: number;
}): Promise<MondayActivityLogEntry[]> {
  if (!args.columnIds.length) return [];
  const maxPages = args.maxPages ?? 12;
  const pageSize = args.pageSize ?? 250;
  const out: MondayActivityLogEntry[] = [];
  for (let page = 1; page <= maxPages; page += 1) {
    const data = await mondayRequest<ActivityLogsResult>(
      MONDAY_ACTIVITY_LOGS_QUERY,
      {
        boardId: [args.boardId],
        columnIds: args.columnIds,
        limit: pageSize,
        page,
        from: args.fromIso ?? undefined,
        to: args.toIso ?? undefined,
      },
      { timeoutMs: 45_000 },
    );
    const batch = data.boards[0]?.activity_logs ?? [];
    if (!batch.length) break;
    out.push(...batch);
    if (batch.length < pageSize) break;
  }
  return out;
}

function safeParseData(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function extractItemId(data: Record<string, unknown>): string | null {
  const candidates = [data.pulse_id, data.item_id, data.itemId, data.id];
  for (const c of candidates) {
    if (c === undefined || c === null) continue;
    return String(c);
  }
  return null;
}

function extractLabelFromValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    const o = value as Record<string, unknown>;
    const label = o.label ?? o.text ?? o.name;
    if (typeof label === "string") return label;
  }
  return null;
}

/** Interpreta filas de activity_logs de Monday para la columna de etapa. */
export function parseStageChangeEvents(
  logs: MondayActivityLogEntry[],
  stageColumnId: string | null,
): Map<string, Array<{ at: string; label: string; stage: MondayStage }>> {
  const byItem = new Map<string, Array<{ at: string; label: string; stage: MondayStage }>>();
  for (const row of logs) {
    const data = safeParseData(row.data);
    if (!data) continue;
    const itemId = extractItemId(data);
    if (!itemId) continue;
    if (stageColumnId) {
      const col = data.column_id ?? data.columnId;
      if (col !== undefined && col !== null && String(col) !== stageColumnId) continue;
    }
    const label =
      extractLabelFromValue(data.value) ??
      (typeof data.text === "string" ? data.text : null) ??
      (typeof data.label === "string" ? data.label : null);
    if (!label) continue;
    const at = row.created_at;
    if (!at) continue;
    const stage = normalizeStage(label);
    const list = byItem.get(itemId) ?? [];
    list.push({ at: new Date(at).toISOString(), label, stage });
    byItem.set(itemId, list);
  }
  for (const [id, list] of byItem) {
    list.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
    byItem.set(id, list);
  }
  return byItem;
}
