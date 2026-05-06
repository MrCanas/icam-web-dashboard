"use client";

import { useEffect, useMemo, useState } from "react";
import { PM_DOMAIN_END, PM_DOMAIN_START } from "@/lib/pm-viz";

const STORAGE_KEY = "pm-timeline-range-ms";

function domainToMs(): { min: number; max: number } {
  return { min: PM_DOMAIN_START.getTime(), max: PM_DOMAIN_END.getTime() };
}

export interface PmTimelineRangeControlProps {
  value?: [Date, Date];
  onChange?: (range: [Date, Date]) => void;
}

/** Ventana visible dentro de 2020–2035 (doble slider). */
export function PmTimelineRangeControl({ value, onChange }: PmTimelineRangeControlProps) {
  const { min, max } = useMemo(() => domainToMs(), []);

  const [internal, setInternal] = useState<[number, number]>(() => {
    if (typeof window !== "undefined") {
      try {
        const raw = sessionStorage.getItem(STORAGE_KEY);
        if (raw) {
          const [a, b] = JSON.parse(raw) as [number, number];
          if (typeof a === "number" && typeof b === "number" && a < b && a >= min && b <= max) {
            return [a, b];
          }
        }
      } catch {
        /* ignore */
      }
    }
    return [min, max];
  });

  const isControlled = value != null && onChange != null;
  const [lo, hi] = isControlled
    ? ([value[0].getTime(), value[1].getTime()] as [number, number])
    : internal;

  const clampPair = (a: number, b: number): [number, number] => {
    let x = Math.max(min, Math.min(max, a));
    let y = Math.max(min, Math.min(max, b));
    if (x > y) [x, y] = [y, x];
    const minSpan = 45 * 86400000;
    if (y - x < minSpan) {
      if (x + minSpan <= max) y = x + minSpan;
      else x = y - minSpan;
    }
    return [x, y];
  };

  const commit = (next: [number, number]) => {
    const [a, b] = clampPair(next[0], next[1]);
    if (isControlled) {
      onChange([new Date(a), new Date(b)]);
    } else {
      setInternal([a, b]);
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify([a, b]));
      } catch {
        /* ignore */
      }
    }
  };

  useEffect(() => {
    if (isControlled) return;
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify([lo, hi]));
    } catch {
      /* ignore */
    }
  }, [isControlled, lo, hi]);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-6 w-full min-w-0">
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex justify-between text-[10px] text-text-muted uppercase tracking-wide">
          <span>Inicio</span>
          <span className="tabular-nums">{new Date(lo).toLocaleDateString("es-ES")}</span>
        </div>
        <input
          type="range"
          min={min}
          max={max}
          step={86400000 * 7}
          value={lo}
          onChange={(e) => commit([Number(e.target.value), hi])}
          className="w-full h-2 accent-icam-900 cursor-pointer"
          aria-label="Inicio del rango temporal visible"
        />
      </div>
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex justify-between text-[10px] text-text-muted uppercase tracking-wide">
          <span>Fin</span>
          <span className="tabular-nums">{new Date(hi).toLocaleDateString("es-ES")}</span>
        </div>
        <input
          type="range"
          min={min}
          max={max}
          step={86400000 * 7}
          value={hi}
          onChange={(e) => commit([lo, Number(e.target.value)])}
          className="w-full h-2 accent-[#B89660] cursor-pointer"
          aria-label="Fin del rango temporal visible"
        />
      </div>
    </div>
  );
}
