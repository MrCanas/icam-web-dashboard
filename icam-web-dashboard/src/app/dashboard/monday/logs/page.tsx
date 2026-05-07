import { getMondayBoardColumns, getMondayBoardItems, getMondayBoards, getMondayMe } from "@/lib/monday/read";
import { MondaySyncLogsPanel } from "@/components/monday/MondaySyncLogsPanel";
import { computeSyncSummary, fetchMondaySyncLogs } from "@/lib/monday/sync-logs";

interface MondayLogsPageProps {
  searchParams: Promise<{
    boardId?: string;
    limit?: string;
  }>;
}

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function loadMondayLogsData(params: { boardId?: string; limit?: string }) {
  const limit = Number(params.limit ?? "25");
  const safeLimit = Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 100) : 25;

  const [me, boards] = await Promise.all([getMondayMe(), getMondayBoards()]);
  const selectedBoardId = params.boardId ?? boards[0]?.id;
  const selectedBoard = selectedBoardId ? boards.find((b) => b.id === selectedBoardId) : undefined;

  const [columnsBoard, itemsBoard] = selectedBoardId
    ? await Promise.all([getMondayBoardColumns(selectedBoardId), getMondayBoardItems(selectedBoardId, safeLimit)])
    : [null, null];

  return {
    me,
    boards,
    selectedBoard,
    selectedBoardId,
    safeLimit,
    columns: columnsBoard?.columns ?? [],
    items: itemsBoard?.items_page?.items ?? [],
  };
}

export default async function MondayLogsPage({ searchParams }: MondayLogsPageProps) {
  const params = await searchParams;
  const [data, syncLogs] = await Promise.all([loadMondayLogsData(params), fetchMondaySyncLogs(200)]);

  return (
    <div className="space-y-4 min-w-0">
      <section className="bg-card rounded-lg border border-subtle/50 shadow-sm p-4 sm:p-5">
        <h1 className="text-xl font-semibold text-icam-900">Monday Logs</h1>
        <p className="text-sm text-text-muted mt-1">
          Inspector técnico de datos Monday. Conectado como <span className="font-medium">{data.me.name}</span>.
        </p>
      </section>

      <MondaySyncLogsPanel initialLogs={syncLogs} initialSummary={computeSyncSummary(syncLogs)} />

      <section className="bg-card rounded-lg border border-subtle/50 shadow-sm p-4 sm:p-5">
        <form className="flex flex-wrap gap-3 items-end">
          <label className="flex flex-col gap-1 text-sm text-text-body min-w-[260px]">
            Board
            <select
              name="boardId"
              defaultValue={data.selectedBoardId}
              className="h-10 rounded-md border border-subtle px-2 text-sm bg-white"
            >
              {data.boards.map((board) => (
                <option key={board.id} value={board.id}>
                  {board.name} ({board.id})
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm text-text-body">
            Límite items
            <input
              name="limit"
              type="number"
              min={1}
              max={100}
              defaultValue={data.safeLimit}
              className="h-10 w-28 rounded-md border border-subtle px-2 text-sm bg-white"
            />
          </label>
          <button type="submit" className="h-10 px-4 rounded-md bg-icam-900 text-white text-sm hover:bg-icam-800 transition">
            Cargar
          </button>
        </form>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <article className="bg-card rounded-lg border border-subtle/50 shadow-sm p-4 sm:p-5">
          <h2 className="text-base font-semibold text-icam-900 mb-3">
            Columnas de {data.selectedBoard?.name ?? "board seleccionado"} ({data.columns.length})
          </h2>
          <ul className="space-y-2 max-h-[360px] overflow-auto pr-1">
            {data.columns.map((column) => (
              <li key={column.id} className="text-sm text-text-body">
                <span className="font-medium">{column.title}</span>{" "}
                <span className="text-text-muted">
                  ({column.id} · {column.type})
                </span>
              </li>
            ))}
          </ul>
        </article>

        <article className="bg-card rounded-lg border border-subtle/50 shadow-sm p-4 sm:p-5">
          <h2 className="text-base font-semibold text-icam-900 mb-3">
            Items de {data.selectedBoard?.name ?? "board seleccionado"} ({data.items.length})
          </h2>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-subtle text-left text-text-muted">
                  <th className="py-2 pr-4 font-medium">Item ID</th>
                  <th className="py-2 pr-4 font-medium">Nombre</th>
                  <th className="py-2 pr-4 font-medium">Actualizado</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((item) => (
                  <tr key={item.id} className="border-b border-subtle/70">
                    <td className="py-2 pr-4 text-text-body">{item.id}</td>
                    <td className="py-2 pr-4 text-text-primary">{item.name}</td>
                    <td className="py-2 pr-4 text-text-body">{item.updated_at ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      </section>
    </div>
  );
}

