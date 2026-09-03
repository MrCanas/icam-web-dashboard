import { SupabaseEmptyProjectsBanner } from "@/modules/portfolio/ui/SupabaseEmptyProjectsBanner";
import { ProyectosView } from "@/modules/portfolio/ui/ProyectosView";
import { PortfolioToolbar } from "@/modules/portfolio/ui/toolbar/PortfolioToolbar";
import { fmtMEuros } from "@/lib/formatters";
import { getCurrentUser } from "@/lib/auth/currentUser";
import {
  applyPortfolioSearchFilters,
  buildProyectosActivosPageModel,
} from "@/modules/portfolio/logic/pageViewModels";
import {
  sanitizeQuery,
  sanitizeSituacion,
  sanitizeTipo,
  sanitizeView,
} from "@/modules/portfolio/logic/portfolioParams";
import { portfolioPaths } from "@/modules/portfolio/logic/paths";
import {
  filterUltimaFilaRows,
  loadProyectosPageData,
} from "@/modules/portfolio/logic/loadPortfolioPage";
import { sanitizeSort } from "@/modules/portfolio/logic/proyectoSort";
import { Proyecto } from "@/modules/portfolio/types";

interface ProyectosPageProps {
  searchParams: Promise<{
    sort?: string;
    situacion?: string;
    tipo?: string;
    q?: string;
    view?: string;
  }>;
}

export default async function ProyectosPage({ searchParams }: ProyectosPageProps) {
  const params = await searchParams;
  const selectedSort = sanitizeSort(params.sort);
  const selectedSituacion = sanitizeSituacion(params.situacion);
  const selectedTipo = sanitizeTipo(params.tipo);
  const query = sanitizeQuery(params.q);
  const view = sanitizeView(params.view);

  const ctx = await getCurrentUser();
  if (!ctx) {
    return (
      <section className="bg-card rounded-lg border border-red-200 p-6 text-red-700">
        No autorizado
      </section>
    );
  }

  const { portfolioCount, countError, data, error } = await loadProyectosPageData(
    ctx,
    selectedSituacion,
    selectedTipo,
  );

  if (error || countError) {
    const msg = error?.message ?? countError?.message ?? "Error desconocido";
    return (
      <section className="bg-card rounded-lg border border-red-200 p-6 text-red-700">
        Error cargando proyectos activos: {msg}
      </section>
    );
  }

  const baseRows = filterUltimaFilaRows(data as Proyecto[] | null);
  const showRlsEmpty = (portfolioCount ?? 0) === 0;
  const rows = showRlsEmpty ? [] : baseRows;
  // El texto del buscador se aplica aquí, en servidor, con la misma función que
  // el resto de filtros: así el modelo y la barra no pueden divergir.
  const filtradas = applyPortfolioSearchFilters(rows, { q: query });
  const model = buildProyectosActivosPageModel(filtradas, selectedSort);

  const resumen = `${model.totalCount} proyectos · ${fmtMEuros(model.inversionComprometida)}`;

  return (
    <div className="space-y-3 sm:space-y-4 min-w-0">
      {showRlsEmpty ? <SupabaseEmptyProjectsBanner /> : null}

      <ProyectosView proyectos={model.projects} view={view} />

      <PortfolioToolbar
        basePath={portfolioPaths.proyectos}
        situacion={selectedSituacion}
        tipo={selectedTipo}
        sort={selectedSort}
        query={query}
        view={view}
        resumen={resumen}
      />
    </div>
  );
}
