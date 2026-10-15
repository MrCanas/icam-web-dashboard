import { fetchAllItemsForBoard } from "@/modules/monday/data/dashboard-read";
import { ADQ_BOARD_ID, buildAdqAssets } from "@/modules/monday/logic/adquisiciones-dashboard";
import { AdquisicionesDashboard } from "@/modules/monday/ui/AdquisicionesDashboard";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function loadAssets() {
  try {
    const items = await fetchAllItemsForBoard(ADQ_BOARD_ID, 500);
    return { assets: buildAdqAssets(items), error: null as string | null };
  } catch (error) {
    console.error("[dashboard/monday] data load failed", { error });
    return {
      assets: [],
      error: "No se han podido leer los datos de Monday. Revisa el token de Monday y los logs del servidor.",
    };
  }
}

export default async function MondayDashboardPage() {
  const { assets, error } = await loadAssets();

  if (error) {
    return <section className="bg-card rounded-lg border border-red-200 p-6 text-red-700">{error}</section>;
  }

  return <AdquisicionesDashboard assets={assets} fetchedAt={new Date().toISOString()} />;
}
