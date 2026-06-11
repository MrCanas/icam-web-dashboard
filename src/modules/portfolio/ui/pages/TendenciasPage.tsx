import { SupabaseEmptyProjectsBanner } from "@/modules/portfolio/ui/SupabaseEmptyProjectsBanner";

import { HoldingPeriodChart } from "@/modules/portfolio/ui/HoldingPeriodChart";

import { MethodologyNotes } from "@/modules/portfolio/ui/MethodologyNotes";

import { PortfolioComparison } from "@/modules/portfolio/ui/PortfolioComparison";

import { VintageChart } from "@/modules/portfolio/ui/VintageChart";

import { VintageTIRChart } from "@/modules/portfolio/ui/VintageTIRChart";

import { getCurrentUser } from "@/lib/auth/currentUser";

import { buildTendenciasPageModel } from "@/modules/portfolio/logic/pageViewModels";

import {

  filterUltimaFilaRows,

  loadTendenciasPageData,

} from "@/modules/portfolio/logic/loadPortfolioPage";

import { Proyecto } from "@/modules/portfolio/types";



export default async function TendenciasPage() {

  const ctx = await getCurrentUser();

  if (!ctx) {

    return (

      <section className="bg-card rounded-lg border border-red-200 p-6 text-red-700">

        No autorizado

      </section>

    );

  }



  const { portfolioCount, countError, data, error } = await loadTendenciasPageData(ctx);



  if (error || countError) {

    const msg = error?.message ?? countError?.message ?? "Error desconocido";

    return (

      <section className="bg-card rounded-lg border border-red-200 p-6 text-red-700">

        Error cargando tendencias: {msg}

      </section>

    );

  }



  const proyectos = filterUltimaFilaRows(data as Proyecto[] | null);

  const showRlsEmpty = (portfolioCount ?? 0) === 0;

  const rows = showRlsEmpty ? [] : proyectos;

  const view = buildTendenciasPageModel(rows);



  return (

    <div className="space-y-3 sm:space-y-4 min-w-0">

      {showRlsEmpty ? <SupabaseEmptyProjectsBanner /> : null}

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-3 sm:gap-4">

        <VintageChart data={view.vintageGroups} />

        <VintageTIRChart data={view.vintageGroups} />

      </section>

      <HoldingPeriodChart data={view.holdingBuckets} averageMonths={view.holdingAvg} />

      <PortfolioComparison activos={view.activos} culminados={view.culminados} />

      <MethodologyNotes />

    </div>

  );

}

