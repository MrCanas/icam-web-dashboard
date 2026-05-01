import { ProjectCard } from "@/components/dashboard/ProjectCard";
import { SortKey, SortSelector } from "@/components/dashboard/SortSelector";
import { fmtMEuros } from "@/lib/formatters";
import { seedProyectos } from "@/lib/seedProyectos";
import { createClient } from "@/lib/supabase/server";
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

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("proyectos")
    .select("*")
    .eq("es_ultima_fila", 1)
    .eq("situacion", "En Marcha")
    .order("inversion_total", { ascending: false, nullsFirst: false });

  if (error) {
    return (
      <section className="bg-card rounded-lg border border-red-200 p-6 text-red-700">
        Error cargando proyectos activos: {error.message}
      </section>
    );
  }

  const supabaseRows = (data ?? []) as Proyecto[];
  const baseRows =
    supabaseRows.length > 0
      ? supabaseRows
      : seedProyectos.filter(
          (row) => row.es_ultima_fila === 1 && row.situacion === "En Marcha",
        );

  const projects = sortProjects(baseRows, selectedSort);
  const inversionComprometida = baseRows.reduce((acc, row) => acc + toNumber(row.inversion_total), 0);

  return (
    <div className="space-y-3 sm:space-y-4 min-w-0">
      <section className="bg-card rounded-lg border border-subtle/50 shadow-sm p-3 sm:p-4">
        <h1 className="text-xl font-semibold text-text-primary">Proyectos Activos</h1>
        <p className="mt-1 text-sm text-text-muted">
          {baseRows.length} proyectos en marcha · Inversión comprometida:{" "}
          {fmtMEuros(inversionComprometida)}
        </p>
      </section>

      <SortSelector selectedSort={selectedSort} basePath="/dashboard/proyectos" />

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
        {projects.map((project) => (
          <ProjectCard key={project.id} project={project} />
        ))}
      </section>
    </div>
  );
}
