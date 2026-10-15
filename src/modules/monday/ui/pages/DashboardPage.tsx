import { buscarReferenciaCatastral } from "@/modules/monday/data/catastro";
import { fetchAllItemsForBoard } from "@/modules/monday/data/dashboard-read";
import { acquisitionRate, ADQ_BOARD_ID, buildAdqAssets, CARD_STAGES, type AdqAsset } from "@/modules/monday/logic/adquisiciones-dashboard";
import { AdquisicionesDashboard } from "@/modules/monday/ui/AdquisicionesDashboard";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function loadAssets() {
  try {
    const items = await fetchAllItemsForBoard(ADQ_BOARD_ID, 500);
    return { assets: buildAdqAssets(items), adquisicion: acquisitionRate(items), error: null as string | null };
  } catch (error) {
    console.error("[dashboard/monday] data load failed", { error });
    return {
      assets: [],
      adquisicion: { acquired: 0, rest: 0, rate: 0 },
      error: "No se han podido leer los datos de Monday. Revisa el token de Monday y los logs del servidor.",
    };
  }
}

/** Referencia catastral de cada activo con tarjeta (por nombre). La respuesta del Catastro se cachea 30 días. */
async function loadCatastro(assets: AdqAsset[]): Promise<Record<string, string | null>> {
  const conTarjeta = assets.filter((a) => (CARD_STAGES as readonly string[]).includes(a.stage) && a.loc);
  const refs = await Promise.all(conTarjeta.map((a) => buscarReferenciaCatastral(a.loc)));
  return Object.fromEntries(conTarjeta.map((a, i) => [a.name, refs[i] ?? null]));
}

export default async function MondayDashboardPage() {
  const { assets, adquisicion, error } = await loadAssets();

  if (error) {
    return <section className="bg-card rounded-lg border border-red-200 p-6 text-red-700">{error}</section>;
  }

  const catastro = await loadCatastro(assets);
  return <AdquisicionesDashboard assets={assets} adquisicion={adquisicion} catastro={catastro} fetchedAt={new Date().toISOString()} />;
}
