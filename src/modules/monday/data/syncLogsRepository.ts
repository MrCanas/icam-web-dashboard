import type { UserContext } from "@/lib/auth/currentUser";
import { withAudit } from "@/lib/audit/withAudit";
import { getMondayBoardItems, getMondayBoards } from "@/modules/monday/data/read";
import { getMondayWriteSupabase } from "@/modules/monday/data/readClient";

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

export async function createSyncLog(ctx: UserContext): Promise<string> {
  return withAudit(
    ctx,
    "monday.sync_log.create",
    { resourceType: "sync_log" },
    async () => {
      const supabase = getMondayWriteSupabase(ctx);
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
    },
  );
}

export async function updateSyncLog(
  ctx: UserContext,
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
  return withAudit(
    ctx,
    "monday.sync_log.update",
    {
      resourceType: "sync_log",
      resourceId: id,
      payload,
    },
    async () => {
      const supabase = getMondayWriteSupabase(ctx);
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
    },
  );
}

export async function runMondaySyncJob(ctx: UserContext, id: string): Promise<void> {
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
    await updateSyncLog(ctx, id, {
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
    await updateSyncLog(ctx, id, {
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

export async function fetchMondaySyncLogs(
  ctx: UserContext,
  limit = 200,
): Promise<MondaySyncLogRecord[]> {
  const safeLimit = Math.min(Math.max(limit, 1), 500);
  const supabase = getMondayWriteSupabase(ctx);
  const { data, error } = await supabase
    .from("monday_sync_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(safeLimit);
  if (error) throw new Error(error.message);
  return (data ?? []) as MondaySyncLogRecord[];
}
