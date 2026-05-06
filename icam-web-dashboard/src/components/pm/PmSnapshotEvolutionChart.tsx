"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PmHitoEnriched } from "@/lib/pm-queries";
import {
  PM_DOMAIN_END,
  PM_DOMAIN_START,
  dateInChartDomain,
  formatSnapshotLabel,
  normalizePmDate,
} from "@/lib/pm-viz";
import { fechaForSnapshot } from "@/lib/pm-kpis";
import { PmChartTooltip } from "@/components/pm/PmChartTooltip";
import { PmTimelineRangeControl } from "@/components/pm/PmTimelineRangeControl";

const ROW_H = 28;
const LABEL_W = 200;
const PAD_R = 32;
const PAD_T = 28;
const PAD_B = 40;

const QUARTER_LINE_COLORS = ["#2563EB", "#0D9488", "#65A30D", "#B89660", "#EA580C", "#DC2626"];

function colorForSeries(code: string, quarterCodesOrdered: string[]): string {
  if (code === "fecha_actual") return "#1E2A56";
  const qi = quarterCodesOrdered.indexOf(code);
  if (qi >= 0) return QUARTER_LINE_COLORS[qi % QUARTER_LINE_COLORS.length];
  return "#64748b";
}

interface TooltipSt {
  x: number;
  y: number;
  hitoName: string;
  snapshotLabel: string;
  fecha: string;
}

export interface PmSnapshotEvolutionChartProps {
  hitos: PmHitoEnriched[];
  /** Orden de snapshots (trimestres cronológicos + fecha_actual al final). */
  orderedCodes: string[];
}

export function PmSnapshotEvolutionChart({ hitos, orderedCodes }: PmSnapshotEvolutionChartProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [chartW, setChartW] = useState(960);
  const [range, setRange] = useState<[Date, Date]>([PM_DOMAIN_START, PM_DOMAIN_END]);
  const quarterCodesOrdered = useMemo(
    () => orderedCodes.filter((c) => c !== "fecha_actual"),
    [orderedCodes],
  );

  const defaultVisible = useMemo(() => {
    const s = new Set<string>();
    if (orderedCodes.includes("fecha_actual")) s.add("fecha_actual");
    const lastQ = [...quarterCodesOrdered].reverse()[0];
    if (lastQ) s.add(lastQ);
    return s;
  }, [orderedCodes, quarterCodesOrdered]);

  const [visible, setVisible] = useState(() => new Set(defaultVisible));
  const [highlight, setHighlight] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<TooltipSt | null>(null);

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

  const sortedHitos = useMemo(
    () => [...hitos].sort((a, b) => a.orden_hito - b.orden_hito),
    [hitos],
  );

  const chronoVisible = useMemo(
    () => orderedCodes.filter((c) => visible.has(c)),
    [orderedCodes, visible],
  );

  const hitoTracks = useMemo(() => {
    return sortedHitos.map((h, hitoIndex) => {
      const points: { code: string; date: Date }[] = [];
      for (const code of chronoVisible) {
        const iso = fechaForSnapshot(h, code);
        const d = dateInChartDomain(normalizePmDate(iso));
        if (!d) continue;
        points.push({ code, date: d });
      }
      return { hito: h, hitoIndex, points };
    });
  }, [sortedHitos, chronoVisible]);

  const innerW = chartW - LABEL_W - PAD_R;
  const plotH = Math.max(1, sortedHitos.length) * ROW_H;
  const svgH = PAD_T + plotH + PAD_B;
  const svgW = chartW;

  const winStart = range[0].getTime();
  const winEnd = range[1].getTime();
  const winSpan = Math.max(1, winEnd - winStart);

  const xScale = useCallback(
    (t: number) => LABEL_W + ((t - winStart) / winSpan) * innerW,
    [innerW, winStart, winSpan],
  );

  const yCenter = useCallback((rowIdx: number) => PAD_T + rowIdx * ROW_H + ROW_H / 2, []);

  const toggleCode = (code: string) => {
    setVisible((prev) => {
      const next = new Set(prev);
      if (next.has(code)) {
        if (next.size <= 1) return prev;
        next.delete(code);
      } else {
        next.add(code);
      }
      return next;
    });
  };

  const polylinePointsStr = (points: { date: Date }[], hitoIndex: number): string => {
    const parts: string[] = [];
    for (const p of points) {
      const t = p.date.getTime();
      if (t < winStart || t > winEnd) continue;
      parts.push(`${xScale(t)},${yCenter(hitoIndex)}`);
    }
    return parts.join(" ");
  };

  const pointOpacity = (code: string) => {
    if (!highlight) return 1;
    return highlight === code ? 1 : 0.35;
  };

  if (sortedHitos.length === 0) {
    return null;
  }

  return (
    <div ref={wrapRef} className="space-y-3 min-w-0">
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-xs text-text-muted shrink-0">Series:</span>
        {orderedCodes.map((code) => {
          const on = visible.has(code);
          const col = colorForSeries(code, quarterCodesOrdered);
          return (
            <button
              key={code}
              type="button"
              onClick={() => toggleCode(code)}
              onDoubleClick={() => setHighlight((h) => (h === code ? null : code))}
              className={`rounded-full px-2.5 py-1 text-[10px] font-medium border transition ease-out duration-300 ${
                on
                  ? "border-[#1E2A56]/40 bg-white text-[#1E2A56]"
                  : "border-subtle text-text-muted opacity-60"
              } ${highlight === code ? "ring-2 ring-[#B89660]" : ""}`}
              style={{ borderLeftWidth: 3, borderLeftColor: col }}
            >
              {formatSnapshotLabel(code)}
            </button>
          );
        })}
        <span className="text-[10px] text-text-muted">Doble clic: destacar serie</span>
      </div>

      <PmTimelineRangeControl value={range} onChange={setRange} />

      <div className="overflow-x-auto rounded-lg border border-subtle/50 bg-card">
        <svg
          width={svgW}
          height={svgH}
          className="min-w-[720px] block"
          role="img"
          aria-label="Evolución de previsiones por snapshot"
        >
          {sortedHitos.map((h, i) => {
            const cy = yCenter(i);
            return (
              <g key={h.id}>
                <text
                  x={LABEL_W - 8}
                  y={cy + 4}
                  textAnchor="end"
                  className="fill-[#1E2A56] text-[10px]"
                >
                  {h.hito.length > 36 ? `${h.hito.slice(0, 34)}…` : h.hito}
                </text>
                <line
                  x1={LABEL_W}
                  y1={cy}
                  x2={LABEL_W + innerW}
                  y2={cy}
                  className="stroke-subtle/30"
                  strokeWidth={1}
                />
              </g>
            );
          })}

          {hitoTracks.map((track) => {
            const d = polylinePointsStr(track.points, track.hitoIndex);
            if (track.points.length === 0) return null;
            return (
              <g key={track.hito.id}>
                {track.points.length >= 2 && d.includes(" ") ? (
                  <polyline
                    fill="none"
                    stroke="#94a3b8"
                    strokeWidth={1.25}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    opacity={highlight ? 0.45 : 0.75}
                    points={d}
                    style={{ transition: "opacity 300ms ease-out" }}
                  />
                ) : null}
                {track.points.map((p) => {
                  const t = p.date.getTime();
                  if (t < winStart || t > winEnd) return null;
                  const cx = xScale(t);
                  const cy = yCenter(track.hitoIndex);
                  const col = colorForSeries(p.code, quarterCodesOrdered);
                  const op = pointOpacity(p.code);
                  return (
                    <circle
                      key={`${track.hito.id}-${p.code}`}
                      cx={cx}
                      cy={cy}
                      r={5}
                      fill={col}
                      stroke="#fff"
                      strokeWidth={1}
                      opacity={op}
                      className="cursor-crosshair"
                      style={{ transition: "cx 400ms ease-out, cy 400ms ease-out, opacity 300ms ease-out" }}
                      onMouseEnter={(e) => {
                        setTooltip({
                          x: e.clientX,
                          y: e.clientY,
                          hitoName: track.hito.hito,
                          snapshotLabel: formatSnapshotLabel(p.code),
                          fecha: p.date.toLocaleDateString("es-ES", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                          }),
                        });
                      }}
                      onMouseMove={(e) => {
                        setTooltip((prev) =>
                          prev ? { ...prev, x: e.clientX, y: e.clientY } : prev,
                        );
                      }}
                      onMouseLeave={() => setTooltip(null)}
                    />
                  );
                })}
              </g>
            );
          })}
        </svg>
      </div>

      <PmChartTooltip visible={tooltip !== null} x={tooltip?.x ?? 0} y={tooltip?.y ?? 0}>
        {tooltip ? (
          <div className="space-y-0.5">
            <p className="font-semibold">{tooltip.hitoName}</p>
            <p>Snapshot: {tooltip.snapshotLabel}</p>
            <p>Fecha prevista: {tooltip.fecha}</p>
          </div>
        ) : null}
      </PmChartTooltip>
    </div>
  );
}
