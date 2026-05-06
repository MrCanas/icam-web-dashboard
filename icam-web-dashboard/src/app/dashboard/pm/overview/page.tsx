import Link from "next/link";
import { PmGanttOverview } from "@/components/pm/PmGanttOverview";
import { PmSnapshotSelector } from "@/components/pm/PmSnapshotSelector";
import { KPICard } from "@/components/dashboard/KPICard";
import {
  fechaForSnapshot,
  hitoActualYPendiente,
  meanAbsLevantamiento,
  portfolioPmKpis,
  trafficLightForActiv,
} from "@/lib/pm-kpis";
import { fetchPmPortfolio } from "@/lib/pm-queries";
import { createDashboardReadClient } from "@/lib/supabase/dashboard-read";

interface PageProps {
  searchParams: Promise<{ snapshot?: string }>;
}

function trafficDot(light: ReturnType<typeof trafficLightForActiv>) {
  if (light === "green") return "bg-emerald-500";
  if (light === "yellow") return "bg-amber-400";
  return "bg-red-500";
}

export default async function PmOverviewPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const snapshot = params.snapshot ?? "fecha_actual";

  const supabase = await createDashboardReadClient();
  const { rows, snapshotCodes, error } = await fetchPmPortfolio(supabase);

  if (error) {
    return (
      <section className="bg-card rounded-lg border border-red-200 p-6 text-red-700">
        Error cargando datos PM: {error}. ¿Ejecutaste{" "}
        <code className="text-xs">scripts/supabase/pm_schema.sql</code> en Supabase?
      </section>
    );
  }

  const kpis = portfolioPmKpis(rows);

  return (
    <div className="space-y-4 min-w-0">
      <header className="bg-card rounded-lg border border-subtle/50 shadow-sm p-4">
        <h1 className="text-xl font-semibold text-text-primary">PM — Overview</h1>
        <p className="mt-1 text-sm text-text-muted">
          Seguimiento de hitos por proyecto · snapshot en URL para compartir
        </p>
      </header>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPICard
          title="Proyectos PM"
          value={String(kpis.nProyectos)}
          subtitle="En seguimiento"
        />
        <KPICard
          title="Hitos completados"
          value={`${kpis.hitosCompletados} / ${kpis.totalHitos}`}
          subtitle="Con fecha ≤ hoy"
        />
        <KPICard
          title="Desv. media portfolio"
          value={kpis.desviacionMediaPortfolio != null ? `${kpis.desviacionMediaPortfolio} d` : "—"}
          subtitle="vs levantamiento (|días|)"
        />
        <KPICard
          title="Mayor retraso"
          value={kpis.proyectoMayorRetraso ?? "—"}
          subtitle="Por media |días|"
        />
      </section>

      <section className="bg-card rounded-lg border border-subtle/50 p-4 space-y-4">
        <PmSnapshotSelector
          current={snapshot}
          extraCodes={snapshotCodes}
          hrefForSnapshot={(code) =>
            `/dashboard/pm/overview?snapshot=${encodeURIComponent(code)}`
          }
        />
        <PmGanttOverview portfolio={rows} snapshot={snapshot} />
      </section>

      <section className="bg-card rounded-lg border border-subtle/50 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-subtle bg-subtle/30 text-left">
              <th className="p-3 font-semibold">Proyecto</th>
              <th className="p-3 font-semibold">Tipo</th>
              <th className="p-3 font-semibold">Hito actual</th>
              <th className="p-3 font-semibold">Próximo hito</th>
              <th className="p-3 font-semibold">Fecha prevista</th>
              <th className="p-3 font-semibold">Desv. vs plan</th>
              <th className="p-3 font-semibold">Estado</th>
              <th className="p-3 font-semibold" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const mean = meanAbsLevantamiento(row);
              const light = trafficLightForActiv(mean);
              const { ultimoCumplido, proximo } = hitoActualYPendiente(row);
              const fechaProx = proximo ? fechaForSnapshot(proximo, snapshot) : null;

              return (
                <tr key={row.activo.id} className="border-b border-subtle/80">
                  <td className="p-3 font-medium">{row.activo.id_activo}</td>
                  <td className="p-3 text-text-muted">{row.activo.tipo_uso_activo}</td>
                  <td className="p-3">{ultimoCumplido?.hito ?? "—"}</td>
                  <td className="p-3">{proximo?.hito ?? "—"}</td>
                  <td className="p-3 whitespace-nowrap">
                    {fechaProx
                      ? new Date(fechaProx + "T12:00:00").toLocaleDateString("es-ES")
                      : "—"}
                  </td>
                  <td className="p-3">
                    {mean != null ? `${Math.round(mean)} d (media)` : "—"}
                  </td>
                  <td className="p-3">
                    <span
                      className={`inline-block h-3 w-3 rounded-full ${trafficDot(light)}`}
                      title={light}
                    />
                  </td>
                  <td className="p-3">
                    <Link
                      href={`/dashboard/pm/proyecto/${encodeURIComponent(row.activo.id_activo)}?snapshot=${encodeURIComponent(snapshot)}`}
                      className="text-icam-900 underline text-xs font-medium"
                    >
                      Detalle
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}
