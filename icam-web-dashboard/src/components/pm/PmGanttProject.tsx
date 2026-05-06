"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PmHitoEnriched } from "@/lib/pm-queries";
import {
  collectCanonicalHitosFromHitos,
  getHitoColor,
  hitoColorIndex,
  type CanonicalHitoEntry,
} from "@/lib/pm-hito-palette";
import {
  PM_DOMAIN_END,
  PM_DOMAIN_START,
  buildGanttSegmentsForProject,
  type GanttSegmentModel,
} from "@/lib/pm-viz";
import { PmChartTooltip } from "@/components/pm/PmChartTooltip";
import { PmHitoLegend } from "@/components/pm/PmHitoLegend";
import { PmTimelineRangeControl } from "@/components/pm/PmTimelineRangeControl";

const ROW_H = 30;
const LABEL_W = 200;
const PAD_R = 28;
const PAD_T = 36;
const PAD_B = 36;
const AXIS_H = 22;

function formatDmY(d: Date): string {
  return d.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function quarterStartsBetween(start: Date, end: Date): Date[] {
  const out: Date[] = [];
  let y = start.getFullYear();
  let q = Math.floor(start.getMonth() / 3);
  const endT = end.getTime();
  while (true) {
    const d = new Date(y, q * 3, 1);
    if (d.getTime() >= endT) break;
    if (d.getTime() >= start.getTime()) out.push(d);
    q++;
    if (q >= 4) {
      q = 0;
      y++;
    }
    if (y > 2040) break;
  }
  return out;
}

interface TooltipState {
  x: number;
  y: number;
  seg: GanttSegmentModel;
  key: string;
}

export interface PmGanttProjectProps {
  hitos: PmHitoEnriched[];
  snapshot: string;
}

/** Un proyecto: una fila por hito, mismo modelo de segmentos que Overview pero sin navegación. */
export function PmGanttProject({ hitos, snapshot }: PmGanttProjectProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [chartW, setChartW] = useState(960);
  const [range, setRange] = useState<[Date, Date]>([PM_DOMAIN_START, PM_DOMAIN_END]);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [hoverSegKey, setHoverSegKey] = useState<string | null>(null);

  const sorted = useMemo(
    () => [...hitos].sort((a, b) => a.orden_hito - b.orden_hito),
    [hitos],
  );

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
    () => collectCanonicalHitosFromHitos(sorted),
    [sorted],
  );

  const innerW = chartW - LABEL_W - PAD_R;
  const plotH = sorted.length * ROW_H;
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

  const yearTicks = useMemo(() => {
    const ys: number[] = [];
    for (let y = 2020; y <= 2035; y++) {
      const t = new Date(y, 0, 1).getTime();
      if (t >= winStart && t <= winEnd) ys.push(t);
    }
    return ys;
  }, [winStart, winEnd]);

  const quarterTicks = useMemo(
    () => quarterStartsBetween(new Date(winStart), new Date(winEnd)),
    [winStart, winEnd],
  );

  const segmentsFull = useMemo(
    () => buildGanttSegmentsForProject(sorted, snapshot, range[0], range[1]),
    [sorted, snapshot, range],
  );

  if (sorted.length === 0) {
    return <p className="text-sm text-text-muted">No hay hitos para este proyecto.</p>;
  }

  return (
    <div ref={wrapRef} className="space-y-4 min-w-0">
      <PmTimelineRangeControl value={range} onChange={setRange} />

      <div className="overflow-x-auto rounded-lg border border-subtle/50 bg-card">
        <svg
          width={svgW}
          height={svgH}
          className="min-w-[720px] block text-[#1E2A56]"
          role="img"
          aria-label="Gantt de hitos del proyecto"
        >
          {yearTicks.map((t) => {
            const x = xScale(t);
            return (
              <line
                key={`y-${t}`}
                x1={x}
                y1={PAD_T}
                x2={x}
                y2={PAD_T + plotH}
                className="stroke-subtle/60"
                strokeWidth={1}
              />
            );
          })}

          {quarterTicks.map((d, i) => {
            const t = d.getTime();
            if (d.getMonth() === 0 && d.getDate() === 1) return null;
            const x = xScale(t);
            return (
              <line
                key={`q-${i}-${t}`}
                x1={x}
                y1={PAD_T}
                x2={x}
                y2={PAD_T + plotH}
                className="stroke-subtle/25"
                strokeWidth={1}
              />
            );
          })}

          {yearTicks.map((t) => {
            const x = xScale(t);
            return (
              <text
                key={`yl-${t}`}
                x={x + 4}
                y={PAD_T - 10}
                className="fill-text-muted text-[10px]"
              >
                {new Date(t).getFullYear()}
              </text>
            );
          })}

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

          {sorted.map((hitoRow, rowIdx) => {
            const y0 = PAD_T + rowIdx * ROW_H;
            const cy = y0 + ROW_H / 2;
            const seg = segmentsFull.find((s) => s.hitoId === hitoRow.id);

            return (
              <g key={hitoRow.id}>
                <text
                  x={LABEL_W - 10}
                  y={cy + 4}
                  textAnchor="end"
                  className="fill-[#1E2A56] text-[10px] font-medium"
                >
                  {hitoRow.hito.length > 34 ? `${hitoRow.hito.slice(0, 32)}…` : hitoRow.hito}
                </text>
                <title>{hitoRow.hito}</title>
                <line
                  x1={LABEL_W}
                  y1={cy}
                  x2={LABEL_W + innerW}
                  y2={cy}
                  className="stroke-subtle/40"
                  strokeWidth={1}
                />

                {seg ? (() => {
                  const x1 = xScale(seg.start.getTime());
                  const x2 = xScale(seg.end.getTime());
                  const w = Math.max(1, x2 - x1);
                  const idx = hitoColorIndex(canonicalHitos, seg.hitoName);
                  const fill = getHitoColor(seg.hitoName, idx);
                  const segKey = `${hitoRow.id}-bar`;
                  const hovered = hoverSegKey === segKey;
                  const barY = y0 + (hovered ? 4 : 6);
                  const barH = hovered ? ROW_H - 8 : ROW_H - 12;

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
                      style={{
                        transition:
                          "x 400ms ease-out, y 400ms ease-out, width 400ms ease-out, height 300ms ease-out, opacity 300ms ease-out",
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
                })() : null}
              </g>
            );
          })}
        </svg>
      </div>

      <PmHitoLegend canonicalHitos={canonicalHitos} />

      <PmChartTooltip visible={tooltip !== null} x={tooltip?.x ?? 0} y={tooltip?.y ?? 0}>
        {tooltip ? (
          <div className="space-y-1">
            <p className="font-semibold">{tooltip.seg.hitoName}</p>
            <p>Inicio: {formatDmY(tooltip.seg.start)}</p>
            <p>Fin segmento: {formatDmY(tooltip.seg.end)}</p>
            <p className="text-text-muted">
              Desv. vs plan original (levantamiento):{" "}
              {tooltip.seg.deviationVsBaselineDays != null
                ? `${tooltip.seg.deviationVsBaselineDays >= 0 ? "+" : ""}${tooltip.seg.deviationVsBaselineDays} d`
                : "N/A"}
            </p>
          </div>
        ) : null}
      </PmChartTooltip>
    </div>
  );
}
