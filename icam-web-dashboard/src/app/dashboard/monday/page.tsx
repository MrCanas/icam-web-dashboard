import { MondayAssetsTable } from "@/components/monday/MondayAssetsTable";
import { MondayChartsPanel } from "@/components/monday/MondayChartsPanel";
import { MondayDashboardFilters } from "@/components/monday/MondayDashboardFilters";
import { MondayFunnel } from "@/components/monday/MondayFunnel";
import { MondayKpiGrid } from "@/components/monday/MondayKpiGrid";
import { MondaySyncActions } from "@/components/monday/MondaySyncActions";
import { getMondayDashboardData } from "@/lib/monday/dashboard-read";
import type { MondayStatusGroup } from "@/lib/monday/dashboard-types";
import { fetchMondaySyncLogs } from "@/lib/monday/sync-logs";

interface MondayPageProps {
  searchParams: Promise<{
    boardId?: string;
    from?: string;
    to?: string;
    group?: string | string[];
  }>;
}

export const dynamic = "force-dynamic";
export const revalidate = 0;

function parseGroups(raw: string | string[] | undefined): MondayStatusGroup[] {
  const values = Array.isArray(raw) ? raw : raw ? [raw] : ["en_analisis"];
  const allowed: MondayStatusGroup[] = ["en_analisis", "stand_by", "rechazado", "adquirido"];
  const parsed = values.filter((value): value is MondayStatusGroup =>
    allowed.includes(value as MondayStatusGroup),
  );
  return parsed.length ? parsed : ["en_analisis"];
}

export default async function MondayDashboardPage({ searchParams }: MondayPageProps) {
  const params = await searchParams;
  const selectedGroups = parseGroups(params.group);
  const [data, latestLogs] = await Promise.all([
    getMondayDashboardData({
      boardId: params.boardId,
      from: params.from,
      to: params.to,
      groups: selectedGroups,
    }),
    fetchMondaySyncLogs(1),
  ]);

  if (!data.kpis) {
    return (
      <section className="bg-card rounded-lg border border-red-200 p-6 text-red-700">
        No hay boards visibles para este token de Monday.
      </section>
    );
  }

  return (
    <div className="space-y-4 min-w-0">
      <section className="bg-card rounded-lg border border-subtle/50 shadow-sm p-4 sm:p-5">
        <h1 className="text-xl font-semibold text-icam-900">Análisis de oportunidades (Monday)</h1>
        <p className="text-sm text-text-muted mt-1">
          Board seleccionado: <span className="font-medium">{data.selectedBoardName ?? data.selectedBoardId}</span>.
        </p>
      </section>

      <MondayDashboardFilters
        boards={data.boards}
        selectedBoardId={data.selectedBoardId}
        from={params.from}
        to={params.to}
        selectedGroups={selectedGroups}
      />

      <MondayKpiGrid kpis={data.kpis} />
      <MondayChartsPanel stageMetrics={data.stageMetrics} useMetrics={data.useMetrics} />
      <MondayFunnel
        data={data.funnelMetrics}
        standByCount={data.filteredAssets.filter((asset) => asset.statusGroup === "stand_by").length}
      />
      <MondayAssetsTable rows={data.assetsInProgress} />
      <MondaySyncActions initialLatestLog={latestLogs[0] ?? null} />
    </div>
  );
}
