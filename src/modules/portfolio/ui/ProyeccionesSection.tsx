"use client";

import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  LabelList,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { fmtInt, fmtMEuros } from "@/lib/formatters";
import { captacionObjetivo, type PipelineYear } from "@/modules/portfolio/logic/projections";
import { DrilldownTooltip } from "@/modules/portfolio/ui/charts/DrilldownTooltip";
import { useChartDrilldown } from "@/modules/portfolio/ui/charts/useChartDrilldown";

interface ProyeccionesSectionProps {
  pipeline: PipelineYear[];
  /** Crecimiento inicial (tanto por uno), saneado en servidor desde la URL. */
  crecimientoInicial: number;
}

const ATAJOS = [0, 0.05, 0.1, 0.15, 0.2];

/**
 * Proyección del portfolio a futuro: cuándo vence lo que está en marcha y
 * cuánto habría que captar cada año para no decrecer.
 *
 * El porcentaje de crecimiento es estado local, no de URL: es un *what-if* que
 * se mueve muchas veces seguidas y no debe provocar una ida y vuelta al
 * servidor por cada pulsación. Todo lo que necesita ya está en el cliente.
 */
export function ProyeccionesSection({ pipeline, crecimientoInicial }: ProyeccionesSectionProps) {
  const [crecimiento, setCrecimiento] = useState(crecimientoInicial);
  const drilldown = useChartDrilldown();

  const porAnio = new Map(pipeline.map((a) => [a.year, a]));
  const objetivos = captacionObjetivo(pipeline, crecimiento);
  const totalVence = pipeline.reduce((acc, a) => acc + a.inversion, 0);
  const totalObjetivo = objetivos.reduce((acc, a) => acc + a.objetivo, 0);
  const totalEstimados = pipeline.reduce((acc, a) => acc + a.estimados, 0);
  const pct = Math.round(crecimiento * 100);

  function abrirDetalle(item: unknown) {
    const year = (item as { payload?: { year?: number } })?.payload?.year;
    if (typeof year !== "number") return;
    const anio = porAnio.get(year);
    if (!anio || anio.count === 0) return;
    drilldown.open({
      title: `Vencimientos de ${year}`,
      subtitle: `${anio.count} proyectos · ${fmtMEuros(anio.inversion)} de inversión`,
      proyectos: anio.proyectos,
      key: String(year),
    });
  }

  if (pipeline.length === 0) {
    return (
      <section className="bg-card rounded-lg border border-subtle/50 shadow-sm p-3 sm:p-4">
        <h3 className="text-base font-semibold text-text-primary">Proyección del pipeline</h3>
        <p className="mt-2 text-sm text-text-muted">
          No hay proyectos En Marcha con fecha de fin conocida ni estimable. Hace falta que el
          maestro traiga la columna <code className="font-mono">EndQuarter</code>, o al menos fecha
          de inicio y holding period.
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-3 sm:space-y-4 min-w-0">
      <section className="bg-card rounded-lg border border-subtle/50 shadow-sm p-3 sm:p-4 min-w-0">
        <h3 className="text-base font-semibold text-text-primary mb-2 sm:mb-3">
          Vencimiento del pipeline
        </h3>
        <p className="text-xs text-text-muted mb-2 sm:mb-3">
          Cuándo termina cada proyecto que sigue{" "}
          <span className="font-medium text-icam-900">En Marcha</span>, según la fecha de fin del
          maestro y, cuando falta, estimándola como fecha de inicio más el holding period. Lo que ya
          debería haber vencido y sigue vivo se acumula en el año en curso.
          {totalEstimados > 0 ? (
            <>
              {" "}
              <strong className="font-semibold">
                {totalEstimados} de {pipeline.reduce((acc, a) => acc + a.count, 0)} vencimientos son
                estimados
              </strong>{" "}
              porque el proyecto no trae fecha de fin.
            </>
          ) : null}
        </p>
        <div className="h-[260px] w-full sm:h-[300px] min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={pipeline} margin={{ top: 16, right: 8, left: -18, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EAEBEE" />
              <XAxis dataKey="year" stroke="#8A8A8A" tick={{ fontSize: 10 }} interval={0} />
              <YAxis
                stroke="#8A8A8A"
                tick={{ fontSize: 10 }}
                width={40}
                tickFormatter={(value) => fmtMEuros(Number(value))}
              />
              <Tooltip
                cursor={false}
                content={
                  <DrilldownTooltip
                    heading={(payload) => `Vencimientos de ${payload[0]?.payload?.year ?? ""}`}
                    rows={(payload) => {
                      const anio = payload[0]?.payload as PipelineYear | undefined;
                      return [
                        { label: "Inversión", value: fmtMEuros(Number(anio?.inversion ?? 0)) },
                        { label: "Equity", value: fmtMEuros(Number(anio?.equity ?? 0)) },
                        { label: "Proyectos", value: fmtInt(Number(anio?.count ?? 0)) },
                      ];
                    }}
                    hint={(payload) =>
                      (payload[0]?.payload as PipelineYear | undefined)?.count
                        ? "Click para ver detalle"
                        : false
                    }
                  />
                }
              />
              <Bar
                dataKey="inversion"
                fill="#1E2A56"
                radius={[4, 4, 0, 0]}
                activeBar={false}
                cursor="pointer"
                onClick={abrirDetalle}
              >
                <LabelList
                  dataKey="count"
                  position="top"
                  formatter={(value) => (Number(value) > 0 ? `${value} proy.` : "")}
                  fill="#1E2A56"
                  fontSize={9}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="bg-card rounded-lg border border-subtle/50 shadow-sm p-3 sm:p-4 min-w-0">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-2 sm:mb-3">
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-text-primary">
              Captación objetivo año a año
            </h3>
            <p className="mt-1 text-xs text-text-muted">
              Reponer lo que vence mantiene el capital comprometido plano. El objetivo aplica encima
              un crecimiento del {pct} %: {fmtMEuros(totalVence)} que vencen ⇒{" "}
              <strong className="font-semibold text-icam-900">{fmtMEuros(totalObjetivo)}</strong> a
              captar en el periodo.
            </p>
          </div>

          <fieldset className="shrink-0">
            <legend className="text-xs text-text-muted mb-1">Crecimiento anual</legend>
            <div className="flex items-center gap-1.5">
              {ATAJOS.map((valor) => (
                <button
                  key={valor}
                  type="button"
                  onClick={() => setCrecimiento(valor)}
                  aria-pressed={crecimiento === valor}
                  className={`min-h-8 rounded-md border px-2 py-1 text-xs ${
                    crecimiento === valor
                      ? "border-icam-900 bg-icam-900 text-white"
                      : "border-subtle bg-white text-text-body hover:border-icam-900"
                  }`}
                >
                  {Math.round(valor * 100)} %
                </button>
              ))}
            </div>
            <label className="mt-2 flex items-center gap-2">
              <span className="sr-only">Crecimiento anual personalizado</span>
              <input
                type="range"
                min={0}
                max={50}
                step={1}
                value={pct}
                onChange={(ev) => setCrecimiento(Number(ev.target.value) / 100)}
                className="w-40 accent-icam-900"
              />
              <span className="w-10 text-right text-xs tabular-nums text-text-body">{pct} %</span>
            </label>
          </fieldset>
        </div>

        <div className="h-[260px] w-full sm:h-[300px] min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={objetivos} margin={{ top: 16, right: 8, left: -18, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EAEBEE" />
              <XAxis dataKey="year" stroke="#8A8A8A" tick={{ fontSize: 10 }} interval={0} />
              <YAxis
                stroke="#8A8A8A"
                tick={{ fontSize: 10 }}
                width={40}
                tickFormatter={(value) => fmtMEuros(Number(value))}
              />
              <Tooltip
                cursor={false}
                content={
                  <DrilldownTooltip
                    heading={(payload) => String(payload[0]?.payload?.year ?? "")}
                    rows={(payload) =>
                      payload.map((point) => ({
                        label: point.dataKey === "vence" ? "Vence" : `Objetivo (+${pct} %)`,
                        value: fmtMEuros(Number(point.value ?? 0)),
                        color: point.color,
                      }))
                    }
                    hint={false}
                  />
                }
              />
              <Legend wrapperStyle={{ fontSize: "12px" }} />
              <Bar
                dataKey="vence"
                name="Vence (reposición)"
                fill="#B89660"
                radius={[4, 4, 0, 0]}
                activeBar={false}
              />
              <Line
                type="monotone"
                dataKey="objetivo"
                name={`Objetivo (+${pct} %)`}
                stroke="#1E2A56"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </section>

      {drilldown.modal}
    </div>
  );
}
