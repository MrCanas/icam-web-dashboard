import type { MondayBoard } from "@/modules/monday/data/types";
import type { MondayStatusGroup } from "@/modules/monday/data/dashboard-types";

interface MondayDashboardFiltersProps {
  boards: MondayBoard[];
  selectedBoardId: string | null;
  from?: string;
  to?: string;
  selectedGroups: MondayStatusGroup[];
}

const GROUP_OPTIONS: Array<{ value: MondayStatusGroup; label: string }> = [
  { value: "en_analisis", label: "En análisis" },
  { value: "stand_by", label: "Stand by" },
  { value: "rechazado", label: "Rechazados" },
  { value: "adquirido", label: "Adquiridos" },
];

export function MondayDashboardFilters({
  boards,
  selectedBoardId,
  from,
  to,
  selectedGroups,
}: MondayDashboardFiltersProps) {
  return (
    <section className="bg-card rounded-lg border border-subtle/50 shadow-sm p-3 sm:p-4">
      <form className="flex flex-col gap-3">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <label className="text-sm text-text-body flex flex-col gap-1">
            Board
            <select
              name="boardId"
              defaultValue={selectedBoardId ?? undefined}
              className="h-10 rounded-md border border-subtle px-2 text-sm bg-white"
            >
              {boards.map((board) => (
                <option key={board.id} value={board.id}>
                  {board.name}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm text-text-body flex flex-col gap-1">
            Desde
            <input
              type="date"
              name="from"
              defaultValue={from}
              className="h-10 rounded-md border border-subtle px-2 text-sm bg-white"
            />
          </label>

          <label className="text-sm text-text-body flex flex-col gap-1">
            Hasta
            <input
              type="date"
              name="to"
              defaultValue={to}
              className="h-10 rounded-md border border-subtle px-2 text-sm bg-white"
            />
          </label>

          <div className="flex items-end">
            <button
              type="submit"
              className="h-10 w-full rounded-md bg-icam-900 text-white text-sm hover:bg-icam-800 transition"
            >
              Aplicar
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          {GROUP_OPTIONS.map((option) => (
            <label key={option.value} className="inline-flex items-center gap-2 text-sm text-text-body">
              <input
                type="checkbox"
                name="group"
                value={option.value}
                defaultChecked={selectedGroups.includes(option.value)}
                className="h-4 w-4 accent-icam-900"
              />
              {option.label}
            </label>
          ))}
        </div>
      </form>
    </section>
  );
}

