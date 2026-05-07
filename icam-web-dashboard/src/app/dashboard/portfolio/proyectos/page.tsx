import { SupabaseEmptyProjectsBanner } from "@/components/dashboard/SupabaseEmptyProjectsBanner";
import { ProjectCard } from "@/components/dashboard/ProjectCard";
import { SortKey, SortSelector } from "@/components/dashboard/SortSelector";
import { fmtMEuros } from "@/lib/formatters";
import { createDashboardReadClient } from "@/lib/supabase/dashboard-read";
import { Proyecto } from "@/lib/types";

interface ProyectosPageProps {
  searchParams: Promise<{
    sort?: string;
  }>;
}

function toNumber(value: number | null): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function sanitizeSort(sort?: string): SortKey {
  if (sort === "tir" || sort === "multiplo" || sort === "beneficio") {
    return sort;
  }
  return "inversion";
}

function sortProjects(data: Proyecto[], sort: SortKey): Proyecto[] {
  const list = [...data];

  switch (sort) {
    case "tir":
      return list.sort((a, b) => toNumber(b.tir_desp_is) - toNumber(a.tir_desp_is));
    case "multiplo":
      return list.sort((a, b) => toNumber(b.multiplo) - toNumber(a.multiplo));
    case "beneficio":
      return list.sort((a, b) => toNumber(b.beneficios) - toNumber(a.beneficios));
    case "inversion":
    default:
      return list.sort((a, b) => toNumber(b.inversion_total) - toNumber(a.inversion_total));
  }
}

export default async function ProyectosPage({ searchParams }: ProyectosPageProps) {
  const params = await searchParams;
  const selectedSort = sanitizeSort(params.sort);

  const supabase = await createDashboardReadClient();

  const [{ count: portfolioCount, error: countError }, filteredResult] = await Promise.all([
    supabase
      .from("proyectos")
      .select("*", { count: "exact", head: true })
      .eq("es_ultima_fila", 1),
    supabase
      .from("proyectos")
      .select("*")
      .eq("es_ultima_fila", 1)
      .eq("situacion", "En Marcha")
      .order("inversion_total", { ascending: false, nullsFirst: false }),
  ]);

  const { data, error } = filteredResult;

  if (error || countError) {
    const msg = error?.message ?? countError?.message ?? "Error desconocido";
    return (
      <section className="bg-card rounded-lg border border-red-200 p-6 text-red-700">
        Error cargando proyectos activos: {msg}
      </section>
    );
  }

  const supabaseRows = (data ?? []) as Proyecto[];
  const showRlsEmpty = (portfolioCount ?? 0) === 0;
  const baseRows = showRlsEmpty ? [] : supabaseRows;

  const projects = sortProjects(baseRows, selectedSort);
  const inversionComprometida = baseRows.reduce((acc, row) => acc + toNumber(row.inversion_total), 0);

  return (
    <div className="space-y-3 sm:space-y-4 min-w-0">
      {showRlsEmpty ? <SupabaseEmptyProjectsBanner /> : null}
      <section className="bg-card rounded-lg border border-subtle/50 shadow-sm p-3 sm:p-4">
        <h1 className="text-xl font-semibold text-text-primary">Proyectos Activos</h1>
        <p className="mt-1 text-sm text-text-muted">
          {baseRows.length} proyectos en marcha · Inversión comprometida:{" "}
          {fmtMEuros(inversionComprometida)}
        </p>
      </section>

      <SortSelector selectedSort={selectedSort} basePath="/dashboard/portfolio/proyectos" />

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
        {projects.map((project) => (
          <ProjectCard key={project.id} project={project} />
        ))}
      </section>
    </div>
  );
}
