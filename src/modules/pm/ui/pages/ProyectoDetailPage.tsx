import Link from "next/link";
import { notFound } from "next/navigation";
import { PmDeviationTable } from "@/modules/pm/ui/PmDeviationTable";
import { PmGanttProject } from "@/modules/pm/ui/PmGanttProject";
import { PmSnapshotEvolutionChart } from "@/modules/pm/ui/PmSnapshotEvolutionChart";
import { PmSnapshotSelector } from "@/modules/pm/ui/PmSnapshotSelector";
import {
  buildPmDeviationRows,
  defaultEvolutionSnapshotOrder,
  quarterCodesFromSnapshotList,
} from "@/modules/pm/logic/pm-viz";
import { fetchPmActivoBySlug } from "@/modules/pm/data/pmRepository";
import { getCurrentUser } from "@/lib/auth/currentUser";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ snapshot?: string }>;
}

export default async function PmProyectoDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const q = await searchParams;
  const snapshot = q.snapshot ?? "fecha_actual";

  const ctx = await getCurrentUser();
  if (!ctx) {
    return (
      <section className="bg-card rounded-lg border border-red-200 p-6 text-red-700">
        No autorizado
      </section>
    );
  }
  const { row, error } = await fetchPmActivoBySlug(ctx, id);

  if (error) {
    return (
      <section className="bg-card rounded-lg border border-red-200 p-6 text-red-700">{error}</section>
    );
  }
  if (!row) notFound();

  const codesFromHitos = [...new Set(row.hitos.flatMap((h) => Object.keys(h.snapshots)))];
  const quarterList = quarterCodesFromSnapshotList(codesFromHitos);
  const evolutionOrder = defaultEvolutionSnapshotOrder(row, quarterList);
  const deviationRows = buildPmDeviationRows(row.hitos, quarterList);

  const hrefForSnapshot = (code: string) =>
    `/dashboard/pm/proyecto/${encodeURIComponent(row.activo.id_activo)}?snapshot=${encodeURIComponent(code)}`;

  return (
    <div className="space-y-8 min-w-0">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/dashboard/pm/overview" className="text-sm text-icam-900 underline">
          ← Overview
        </Link>
        <h1 className="text-xl font-semibold text-text-primary">{row.activo.id_activo}</h1>
        <span className="text-xs px-2 py-1 rounded-full bg-subtle text-text-muted">
          {row.activo.tipo_uso_activo}
        </span>
      </div>

      <section className="bg-card rounded-lg border border-subtle/50 p-4 space-y-4">
        <h2 className="text-sm font-semibold text-icam-900">Snapshot</h2>
        <PmSnapshotSelector
          current={snapshot}
          extraCodes={codesFromHitos}
          hrefForSnapshot={hrefForSnapshot}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-icam-900">Gantt del proyecto</h2>
        <PmGanttProject hitos={row.hitos} snapshot={snapshot} />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-icam-900">Evolución de previsiones</h2>
        <p className="text-xs text-text-muted">
          Cada hito conecta los snapshots visibles en el tiempo; los puntos usan el color del trimestre.
        </p>
        <PmSnapshotEvolutionChart
          key={evolutionOrder.join("|")}
          hitos={row.hitos}
          orderedCodes={evolutionOrder}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-icam-900">Desviaciones vs levantamiento</h2>
        <PmDeviationTable rows={deviationRows} />
      </section>
    </div>
  );
}
