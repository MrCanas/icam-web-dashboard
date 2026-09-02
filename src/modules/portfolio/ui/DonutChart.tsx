"use client";

import { fmtMEuros } from "@/lib/formatters";
import { projectsByField } from "@/modules/portfolio/logic/drilldown";
import type { Proyecto } from "@/modules/portfolio/types";
import { DrilldownTooltip } from "@/modules/portfolio/ui/charts/DrilldownTooltip";
import { useChartDrilldown } from "@/modules/portfolio/ui/charts/useChartDrilldown";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { PieLabelRenderProps } from "recharts";

interface DonutChartDatum {
  label: string;
  count: number;
  inversion: number;
}

interface DonutChartProps {
  title: string;
  data: DonutChartDatum[];
  /** Filas ya filtradas, para resolver el drill-down del sector pinchado. */
  proyectos: Proyecto[];
  /** Campo por el que agrupa este donut. */
  field: "tipo_proyecto" | "situacion";
}

const palette = ["#1E2A56", "#9b7f57", "#B89660", "#A0824F", "#8A8A8A"];

/** Por debajo de este porcentaje la etiqueta no cabe sin solaparse. */
const MIN_PORCENTAJE_ETIQUETA = 0.06;

/**
 * Millones sobre el propio sector, para leerlos sin pasar el ratón. Se dibujan
 * fuera del donut porque dentro no caben con un radio de 58 px.
 */
function renderSliceLabel(props: PieLabelRenderProps) {
  const { cx, cy, midAngle, outerRadius, percent, value } = props;
  if (typeof percent === "number" && percent < MIN_PORCENTAJE_ETIQUETA) return null;
  if (typeof cx !== "number" || typeof cy !== "number") return null;
  if (typeof midAngle !== "number" || typeof outerRadius !== "number") return null;

  const rad = -midAngle * (Math.PI / 180);
  const radius = outerRadius + 14;
  const x = cx + radius * Math.cos(rad);
  const y = cy + radius * Math.sin(rad);

  return (
    <text
      x={x}
      y={y}
      fill="#1E2A56"
      fontSize={10}
      fontWeight={600}
      textAnchor={x > cx ? "start" : "end"}
      dominantBaseline="central"
    >
      {fmtMEuros(Number(value ?? 0))}
    </text>
  );
}

export function DonutChart({ title, data, proyectos, field }: DonutChartProps) {
  const totalCount = data.reduce((acc, item) => acc + item.count, 0);
  const drilldown = useChartDrilldown();

  function abrirDetalle(label: string) {
    const delSector = projectsByField(proyectos, field, label);
    drilldown.open({
      title: `${title} · ${label}`,
      subtitle: `${delSector.length} de ${proyectos.length} proyectos`,
      proyectos: delSector,
    });
  }

  return (
    <section className="bg-card rounded-lg border border-subtle/50 shadow-sm p-3 sm:p-4 min-w-0">
      <h3 className="text-sm font-semibold text-text-primary mb-2 sm:mb-3">{title}</h3>
      <div className="flex flex-col sm:flex-row gap-4 sm:gap-3 sm:items-center min-w-0">
        <div className="h-[180px] w-full sm:w-1/2 sm:max-w-[240px] sm:h-[175px] mx-auto sm:mx-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="inversion"
                nameKey="label"
                innerRadius={34}
                outerRadius={58}
                paddingAngle={2}
                label={renderSliceLabel}
                labelLine={false}
                isAnimationActive={false}
                cursor="pointer"
                onClick={(entry) => {
                  const label = (entry as { label?: string })?.label;
                  if (label) abrirDetalle(label);
                }}
              >
                {data.map((entry, index) => (
                  <Cell key={entry.label} fill={palette[index % palette.length]} />
                ))}
              </Pie>
              <Tooltip
                cursor={false}
                content={
                  <DrilldownTooltip
                    heading={(payload) => String(payload[0]?.payload?.label ?? "")}
                    rows={(payload) => {
                      const slice = payload[0]?.payload as DonutChartDatum | undefined;
                      return [
                        { label: "Inversión", value: fmtMEuros(Number(slice?.inversion ?? 0)) },
                        { label: "Proyectos", value: String(slice?.count ?? 0) },
                      ];
                    }}
                  />
                }
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="w-full sm:w-1/2 flex flex-col justify-center gap-2 text-sm min-w-0">
          {data.map((item, index) => (
            <button
              key={item.label}
              type="button"
              onClick={() => abrirDetalle(item.label)}
              className="text-text-body flex items-center justify-between gap-2 min-w-0 rounded px-1 py-0.5 text-left hover:bg-subtle/60 focus-visible:outline-2 focus-visible:outline-icam-900"
            >
              <span className="flex items-center gap-2 min-w-0">
                <span
                  className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: palette[index % palette.length] }}
                />
                <span className="truncate">{item.label}</span>
              </span>
              <span className="text-text-muted shrink-0">
                {item.count}/{totalCount}
              </span>
            </button>
          ))}
        </div>
      </div>
      {drilldown.modal}
    </section>
  );
}
