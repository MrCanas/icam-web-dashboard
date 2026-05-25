"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  collectCanonicalHitosFromPortfolio,
  getHitoColor,
  hitoColorIndex,
  type CanonicalHitoEntry,
} from "@/modules/pm/logic/pm-hito-palette";
import type { PmPortfolioRow } from "@/modules/pm/data/pmRepository";
import { axisTopPadding, buildPmAxisModel } from "@/modules/pm/logic/pm-axis";
import {
  buildGanttSegmentsForProject,
  computeGanttExtentForPortfolio,
  formatDeviationMonths,
  type GanttSegmentModel,
} from "@/modules/pm/logic/pm-viz";
import { PmChartTooltip } from "@/modules/pm/ui/PmChartTooltip";
import { PmHitoLegend } from "@/modules/pm/ui/PmHitoLegend";
import { PmTimelineRangeControl } from "@/modules/pm/ui/PmTimelineRangeControl";

const ROW_H = 34;
const LABEL_W = 152;
const PAD_R = 28;
const PAD_B = 36;
const AXIS_H = 22;

const PM_PROJECT_ORDER = [
  "SE84",
  "DC-15",
  "GQ8",
  "CSP-10",
  "PC25-CP6",
  "SA-33-31",
  "PC25-26-RESIDENCIAL",
  "EM-RESIDENCIAL",
  "CA1",
] as const;

function sortPortfolioRows(rows: PmPortfolioRow[]): PmPortfolioRow[] {
  const idx = (id: string) => {
    const i = PM_PROJECT_ORDER.indexOf(id as (typeof PM_PROJECT_ORDER)[number]);
    return i >= 0 ? i : 1000;
  };
  return [...rows].sort(
    (a, b) =>
      idx(a.activo.id_activo) - idx(b.activo.id_activo) ||
      a.activo.id_activo.localeCompare(b.activo.id_activo),
  );
}

function formatDmY(d: Date): string {
  return d.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

interface TooltipState {
  x: number;
  y: number;
  seg: GanttSegmentModel;
  key: string;
}

export interface PmGanttOverviewProps {
  portfolio: PmPortfolioRow[];
  snapshot: string;
}

export function PmGanttOverview({ portfolio, snapshot }: PmGanttOverviewProps) {
  const router = useRouter();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [chartW, setChartW] = useState(960);

  const sortedRows = useMemo(() => sortPortfolioRows(portfolio), [portfolio]);
  const autoExtent = useMemo(
    () => computeGanttExtentForPortfolio(sortedRows, snapshot),
    [sortedRows, snapshot],
  );

  const contextKey = useMemo(
    () => `${snapshot}::${sortedRows.map((r) => r.activo.id).join(",")}`,
    [snapshot, sortedRows],
  );
  const prevCtxRef = useRef("");
  const userAdjustedRangeRef = useRef(false);

  const [range, setRange] = useState<[Date, Date]>(autoExtent);

  useEffect(() => {
    if (sortedRows.length === 0) return;
    const ctxChanged = prevCtxRef.current !== contextKey;
    if (ctxChanged) {
      prevCtxRef.current = contextKey;
      userAdjustedRangeRef.current = false;
    }
    if (!userAdjustedRangeRef.current) {
      setRange(autoExtent);
    }
  }, [contextKey, autoExtent, sortedRows.length]);

  const onRangeChange = useCallback((next: [Date, Date]) => {
    userAdjustedRangeRef.current = true;
    setRange(next);
  }, []);

  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [hoverSegKey, setHoverSegKey] = useState<string | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setChartW(Math.max(720, Math.floor(el.clientWidth)));
    });
    ro.observe(el);
    setChartW(Math.max(720, Math.floor(el.clientWidth)));
    return () => ro.disconnect();
  }, []);

  const canonicalHitos: CanonicalHitoEntry[] = useMemo(
    () => collectCanonicalHitosFromPortfolio(portfolio),
    [portfolio],
  );

  const axisModel = useMemo(() => buildPmAxisModel(range[0], range[1]), [range]);
  const PAD_T = axisTopPadding(axisModel);

  const innerW = chartW - LABEL_W - PAD_R;
  const plotH = sortedRows.length * ROW_H;
  const svgH = PAD_T + plotH + PAD_B + AXIS_H;
  const svgW = chartW;

  const winStart = range[0].getTime();
  const winEnd = range[1].getTime();
  const winSpan = Math.max(1, winEnd - winStart);

  const xScale = useCallback(
    (t: number) => LABEL_W + ((t - winStart) / winSpan) * innerW,
    [innerW, winStart, winSpan],
  );

  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const todayT = today.getTime();
  const showTodayLine = snapshot !== "fecha_actual" && todayT >= winStart && todayT <= winEnd;

  const navigateToProject = useCallback(
    (idActivo: string) => {
      router.push(
        `/dashboard/pm/proyecto/${encodeURIComponent(idActivo)}?snapshot=${encodeURIComponent(snapshot)}`,
      );
    },
    [router, snapshot],
  );

  if (portfolio.length === 0) {
    return (
      <p className="text-sm text-text-muted py-6">
        No hay datos PM. Sube el Excel desde Data → Subir datos.
      </p>
    );
  }

  return (
    <div ref={wrapRef} className="space-y-4 min-w-0">
      <PmTimelineRangeControl
        extentMin={autoExtent[0]}
        extentMax={autoExtent[1]}
        value={range}
        onChange={onRangeChange}
      />

      <div className="overflow-x-auto rounded-lg border border-subtle/50 bg-card">
        <svg
          width={svgW}
          height={svgH}
          className="min-w-[720px] block text-[#1E2A56]"
          role="img"
          aria-label="Gantt de hitos por proyecto"
        >
          {axisModel.kind === "annual" ? (
            <>
              {axisModel.yearLines.map((t) => {
                const x = xScale(t);
                return (
                  <line
                    key={`y-${t}`}
                    x1={x}
                    y1={PAD_T}
                    x2={x}
                    y2={PAD_T + plotH}
                    className="stroke-subtle/55"
                    strokeWidth={1}
                  />
                );
              })}
              {axisModel.yearLines.map((t) => (
                <text
                  key={`yl-${t}`}
                  x={xScale(t) + 4}
                  y={PAD_T - 10}
                  className="fill-text-muted text-[10px]"
                >
                  {new Date(t).getFullYear()}
                </text>
              ))}
            </>
          ) : (
            <>
              {axisModel.quarterLines.map((t) => {
                const isYear = axisModel.yearLines.includes(t);
                const x = xScale(t);
                return (
                  <line
                    key={`q-${t}`}
                    x1={x}
                    y1={PAD_T}
                    x2={x}
                    y2={PAD_T + plotH}
                    className={isYear ? "stroke-subtle/55" : "stroke-subtle/28"}
                    strokeWidth={isYear ? 1 : 0.75}
                  />
                );
              })}
              {axisModel.labels.map(({ t, showYear, year, quarterText }) => {
                const x = xScale(t) + 3;
                return (
                  <g key={`lb-${t}`}>
                    {showYear ? (
                      <text x={x} y={PAD_T - 22} className="fill-text-muted text-[11px] font-medium">
                        {year}
                      </text>
                    ) : null}
                    <text x={x} y={PAD_T - 7} className="fill-text-muted text-[9px]">
                      {quarterText}
                    </text>
                  </g>
                );
              })}
            </>
          )}

          {showTodayLine ? (
            <line
              x1={xScale(todayT)}
              y1={PAD_T}
              x2={xScale(todayT)}
              y2={PAD_T + plotH}
              stroke="#B89660"
              strokeWidth={2}
              strokeDasharray="6 5"
              opacity={0.95}
            />
          ) : null}

          {sortedRows.map((row, rowIdx) => {
            const y0 = PAD_T + rowIdx * ROW_H;
            const cy = y0 + ROW_H / 2;
            const segments = buildGanttSegmentsForProject(
              row.hitos,
              snapshot,
              range[0],
              range[1],
            );

            return (
              <g key={row.activo.id}>
                <rect
                  x={0}
                  y={y0}
                  width={LABEL_W - 6}
                  height={ROW_H}
                  fill="transparent"
                  className="cursor-pointer hover:fill-subtle/30 transition-colors duration-300 ease-out"
                  onClick={() => navigateToProject(row.activo.id_activo)}
                />
                <text
                  x={LABEL_W - 10}
                  y={cy + 4}
                  textAnchor="end"
                  className="fill-[#1E2A56] text-[11px] font-medium cursor-pointer"
                  onClick={() => navigateToProject(row.activo.id_activo)}
                >
                  {row.activo.id_activo}
                </text>
                <line
                  x1={LABEL_W}
                  y1={cy}
                  x2={LABEL_W + innerW}
                  y2={cy}
                  className="stroke-subtle/40"
                  strokeWidth={1}
                />

                {segments.map((seg, si) => {
                  const x1 = xScale(seg.start.getTime());
                  const x2 = xScale(seg.end.getTime());
                  const w = Math.max(1, x2 - x1);
                  const idx = hitoColorIndex(canonicalHitos, seg.hitoName);
                  const fill = getHitoColor(seg.hitoName, idx);
                  const segKey = `${row.activo.id}-${seg.hitoId}-${si}`;
                  const hovered = hoverSegKey === segKey;
                  const barY = y0 + (hovered ? 5 : 7);
                  const barH = hovered ? ROW_H - 10 : ROW_H - 14;

                  return (
                    <rect
                      key={segKey}
                      x={x1}
                      y={barY}
                      width={w}
                      height={barH}
                      rx={3}
                      fill={fill}
                      opacity={hovered ? 1 : 0.92}
                      stroke="#fff"
                      strokeWidth={0.75}
                      className="cursor-pointer"
                      style={{
                        transition:
                          "x 400ms ease-out, y 400ms ease-out, width 400ms ease-out, height 300ms ease-out, opacity 300ms ease-out",
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        navigateToProject(row.activo.id_activo);
                      }}
                      onMouseEnter={(e) => {
                        setHoverSegKey(segKey);
                        setTooltip({ x: e.clientX, y: e.clientY, seg, key: segKey });
                      }}
                      onMouseMove={(e) => {
                        setTooltip((prev) =>
                          prev?.key === segKey
                            ? { x: e.clientX, y: e.clientY, seg, key: segKey }
                            : prev,
                        );
                      }}
                      onMouseLeave={() => {
                        setHoverSegKey(null);
                        setTooltip(null);
                      }}
                    />
                  );
                })}
              </g>
            );
          })}
        </svg>
      </div>

      <PmHitoLegend canonicalHitos={canonicalHitos} />

      <PmChartTooltip visible={tooltip !== null} x={tooltip?.x ?? 0} y={tooltip?.y ?? 0}>
        {tooltip ? (
          <div className="space-y-1">
            <p className="font-semibold flex items-center gap-2">
              <span
                className="inline-block h-2.5 w-2.5 rounded-sm"
                style={{
                  backgroundColor: getHitoColor(
                    tooltip.seg.hitoName,
                    hitoColorIndex(canonicalHitos, tooltip.seg.hitoName),
                  ),
                }}
              />
              {tooltip.seg.hitoName}
            </p>
            <p>Inicio: {formatDmY(tooltip.seg.start)}</p>
            <p>Fin segmento: {formatDmY(tooltip.seg.end)}</p>
            <p className="text-text-muted">
              Desv. vs plan original (levantamiento):{" "}
              {tooltip.seg.deviationVsBaselineDays != null
                ? formatDeviationMonths(tooltip.seg.deviationVsBaselineDays)
                : "N/A"}
            </p>
          </div>
        ) : null}
      </PmChartTooltip>
    </div>
  );
}
