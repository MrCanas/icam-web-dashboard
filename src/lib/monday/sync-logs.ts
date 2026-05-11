import { getMondayBoardItems, getMondayBoards } from "@/lib/monday/read";
import { createServiceRoleClient } from "@/lib/supabase/admin";

type SyncEstado = "en_proceso" | "completado" | "completado_con_errores" | "error";

interface SyncBoardDetalle {
  id: string;
  nombre: string;
  items: number;
  estado: "ok" | "error";
}

interface SyncErrorDetalle {
  board: string;
  mensaje: string;
  timestamp: string;
}

interface SyncDetalle {
  boards: SyncBoardDetalle[];
  errores: SyncErrorDetalle[];
  duracion_por_board_ms: Record<string, number>;
}

export interface MondaySyncLogRecord {
  id: string;
  fecha: string | null;
  created_at: string | null;
  estado: string;
  boards_sincronizados: number;
  items_sincronizados: number;
  errores: number;
  duracion_ms: number;
  detalle: SyncDetalle | null;
}

async function countBoardItems(boardId: string): Promise<number> {
  let total = 0;
  let cursor: string | undefined = undefined;
  let guard = 0;
  do {
    const board = await getMondayBoardItems(boardId, 200, cursor);
    total += board?.items_page.items.length ?? 0;
    cursor = board?.items_page.cursor ?? undefined;
    guard += 1;
  } while (cursor && guard < 50);
  return total;
}

export async function createSyncLog(): Promise<string> {
  const supabase = createServiceRoleClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("monday_sync_logs")
    .insert({
      fecha: now,
      estado: "en_proceso",
      duracion_ms: 0,
      boards_sincronizados: 0,
      items_sincronizados: 0,
      errores: 0,
      detalle: { boards: [], errores: [], duracion_por_board_ms: {} },
    })
    .select("id")
    .single();

  if (error || !data?.id) {
    throw new Error(error?.message ?? "No se pudo crear registro monday_sync_logs.");
  }
  return String(data.id);
}

export async function updateSyncLog(
  id: string,
  payload: {
    estado: SyncEstado;
    duracionMs: number;
    boardsSincronizados: number;
    itemsSincronizados: number;
    errores: number;
    detalle: SyncDetalle;
  },
) {
  const supabase = createServiceRoleClient();
  const { error } = await supabase
    .from("monday_sync_logs")
    .update({
      fecha: new Date().toISOString(),
      estado: payload.estado,
      duracion_ms: payload.duracionMs,
      boards_sincronizados: payload.boardsSincronizados,
      items_sincronizados: payload.itemsSincronizados,
      errores: payload.errores,
      detalle: payload.detalle,
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function runMondaySyncJob(id: string): Promise<void> {
  const started = Date.now();
  const boardsDetalle: SyncBoardDetalle[] = [];
  const erroresDetalle: SyncErrorDetalle[] = [];
  const duracionPorBoard: Record<string, number> = {};

  let itemsTotal = 0;
  let boardsOk = 0;

  try {
    const boards = await getMondayBoards();
    for (const board of boards) {
      const bStart = Date.now();
      try {
        const items = await countBoardItems(board.id);
        itemsTotal += items;
        boardsOk += 1;
        boardsDetalle.push({
          id: board.id,
          nombre: board.name,
          items,
          estado: "ok",
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Error desconocido";
        boardsDetalle.push({
          id: board.id,
          nombre: board.name,
          items: 0,
          estado: "error",
        });
        erroresDetalle.push({
          board: board.name,
          mensaje: message,
          timestamp: new Date().toISOString(),
        });
      } finally {
        duracionPorBoard[board.id] = Date.now() - bStart;
      }
    }

    const hasErrors = erroresDetalle.length > 0;
    await updateSyncLog(id, {
      estado: hasErrors ? "completado_con_errores" : "completado",
      duracionMs: Date.now() - started,
      boardsSincronizados: boardsOk,
      itemsSincronizados: itemsTotal,
      errores: erroresDetalle.length,
      detalle: {
        boards: boardsDetalle,
        errores: erroresDetalle,
        duracion_por_board_ms: duracionPorBoard,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido en sincronización";
    await updateSyncLog(id, {
      estado: "error",
      duracionMs: Date.now() - started,
      boardsSincronizados: boardsOk,
      itemsSincronizados: itemsTotal,
      errores: erroresDetalle.length + 1,
      detalle: {
        boards: boardsDetalle,
        errores: [
          ...erroresDetalle,
          {
            board: "global",
            mensaje: message,
            timestamp: new Date().toISOString(),
          },
        ],
        duracion_por_board_ms: duracionPorBoard,
      },
    });
  }
}

function toDate(value: string | null): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function computeSyncSummary(logs: MondaySyncLogRecord[]) {
  const latest = logs[0] ?? null;
  const windowLogs = logs.slice(0, 30);
  const successCount = windowLogs.filter((log) => log.estado === "completado").length;
  const successRate = windowLogs.length > 0 ? successCount / windowLogs.length : 0;

  let averageFrequencyDays = 0;
  if (windowLogs.length > 1) {
    const diffs: number[] = [];
    for (let i = 0; i < windowLogs.length - 1; i += 1) {
      const d1 = toDate(windowLogs[i].created_at) ?? toDate(windowLogs[i].fecha);
      const d2 = toDate(windowLogs[i + 1].created_at) ?? toDate(windowLogs[i + 1].fecha);
      if (d1 && d2) diffs.push(Math.abs(d1.getTime() - d2.getTime()));
    }
    if (diffs.length > 0) {
      averageFrequencyDays = diffs.reduce((acc, cur) => acc + cur, 0) / diffs.length / 86_400_000;
    }
  }
  return { latest, successRate, averageFrequencyDays };
}

export async function fetchMondaySyncLogs(limit = 200): Promise<MondaySyncLogRecord[]> {
  const safeLimit = Math.min(Math.max(limit, 1), 500);
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("monday_sync_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(safeLimit);
  if (error) throw new Error(error.message);
  return (data ?? []) as MondaySyncLogRecord[];
}

