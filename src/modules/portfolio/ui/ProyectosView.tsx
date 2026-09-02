"use client";

import { getTIRColorClass } from "@/modules/portfolio/logic/calculations";
import { projectByName } from "@/modules/portfolio/logic/drilldown";
import { gridClassForView, type ProyectosView as ViewMode } from "@/modules/portfolio/logic/portfolioParams";
import { fmtInt, fmtMEuros, fmtMult, fmtPct } from "@/lib/formatters";
import { ProjectCard } from "@/modules/portfolio/ui/ProjectCard";
import { useChartDrilldown } from "@/modules/portfolio/ui/charts/useChartDrilldown";
import type { Proyecto } from "@/modules/portfolio/types";

interface ProyectosViewProps {
  proyectos: Proyecto[];
  view: ViewMode;
}

function maybe(value: number | null, formatter: (value: number) => string): string {
  if (value === null || !Number.isFinite(value) || value <= 0) return "—";
  return formatter(value);
}

/**
 * Renderiza los proyectos en el modo elegido desde la barra flotante: tabla o
 * rejilla de 2, 3 o 4 columnas. Cualquiera de los dos abre el mismo modal de
 * detalle al pinchar, igual que las gráficas.
 */
export function ProyectosView({ proyectos, view }: ProyectosViewProps) {
  const drilldown = useChartDrilldown();

  function abrirDetalle(proyecto: Proyecto) {
    drilldown.open({
      title: proyecto.proyecto,
      subtitle: [proyecto.ubicacion, proyecto.tipo_proyecto, proyecto.situacion]
        .filter(Boolean)
        .join(" · "),
      proyectos: projectByName(proyectos, proyecto.proyecto),
    });
  }

  if (proyectos.length === 0) {
    return (
      <section className="bg-card rounded-lg border border-subtle/50 shadow-sm p-6 text-center text-sm text-text-muted">
        Ningún proyecto coincide con los filtros activos.
      </section>
    );
  }

  if (view === "tabla") {
    return (
      <>
        <section className="bg-card rounded-lg border border-subtle/50 shadow-sm p-3 sm:p-4 min-w-0">
          <div className="overflow-x-auto overscroll-x-contain">
            <table className="w-full text-sm min-w-[760px]">
              <thead className="sticky top-0 z-10 bg-card shadow-[0_1px_0_0_#EAEBEE]">
                <tr className="text-left text-text-muted border-b border-subtle">
                  <th className="py-2 pr-3 bg-card">Proyecto</th>
                  <th className="py-2 pr-3 bg-card">Tipo</th>
                  <th className="py-2 pr-3 bg-card">Situación</th>
                  <th className="py-2 pr-3 bg-card text-right">Inversión</th>
                  <th className="py-2 pr-3 bg-card text-right">TIR</th>
                  <th className="py-2 pr-3 bg-card text-right">ROE</th>
                  <th className="py-2 pr-3 bg-card text-right">Múltiplo</th>
                  <th className="py-2 pr-3 bg-card text-right">Beneficio</th>
                  <th className="py-2 bg-card text-right">Unidades</th>
                </tr>
              </thead>
              <tbody>
                {proyectos.map((p) => (
                  <tr
                    key={p.id}
                    onClick={() => abrirDetalle(p)}
                    className="cursor-pointer border-b border-subtle/60 text-text-body last:border-b-0 hover:bg-page/60"
                  >
                    <td className="py-2 pr-3">
                      {/* El nombre es un botón real: la fila entera responde al
                          ratón, pero el teclado necesita algo enfocable. */}
                      <button
                        type="button"
                        onClick={(ev) => {
                          ev.stopPropagation();
                          abrirDetalle(p);
                        }}
                        className="flex items-center gap-2 rounded text-left focus-visible:outline-2 focus-visible:outline-icam-900"
                      >
                        <span
                          className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${getTIRColorClass(
                            p.tir_desp_is ?? 0,
                          )}`}
                          aria-hidden
                        />
                        <span className="font-medium text-icam-900">{p.proyecto}</span>
                      </button>
                      {p.ubicacion ? (
                        <span className="block pl-[18px] text-xs text-text-muted">
                          {p.ubicacion}
                        </span>
                      ) : null}
                    </td>
                    <td className="py-2 pr-3 whitespace-nowrap">{p.tipo_proyecto}</td>
                    <td className="py-2 pr-3 whitespace-nowrap">{p.situacion}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">
                      {maybe(p.inversion_total, fmtMEuros)}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">
                      {maybe(p.tir_desp_is, fmtPct)}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">
                      {maybe(p.roe_desp_is, fmtPct)}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">
                      {maybe(p.multiplo, fmtMult)}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">
                      {maybe(p.beneficios, fmtMEuros)}
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {maybe(p.unidades_totales, fmtInt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        {drilldown.modal}
      </>
    );
  }

  return (
    <>
      <section className={gridClassForView(view)}>
        {proyectos.map((project) => (
          <button
            key={project.id}
            type="button"
            onClick={() => abrirDetalle(project)}
            className="min-w-0 text-left rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-icam-900"
          >
            <ProjectCard project={project} compact={view === "cols3" || view === "cols4"} />
          </button>
        ))}
      </section>
      {drilldown.modal}
    </>
  );
}
