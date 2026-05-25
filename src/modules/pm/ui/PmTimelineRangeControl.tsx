"use client";

import { useMemo } from "react";

function clampTimelinePair(a: number, b: number, min: number, max: number): [number, number] {
  let x = Math.max(min, Math.min(max, a));
  let y = Math.max(min, Math.min(max, b));
  if (x > y) [x, y] = [y, x];
  const minSpan = 45 * 86400000;
  if (y - x < minSpan) {
    if (x + minSpan <= max) y = x + minSpan;
    else x = y - minSpan;
  }
  return [x, y];
}

export interface PmTimelineRangeControlProps {
  extentMin: Date;
  extentMax: Date;
  value: [Date, Date];
  onChange: (range: [Date, Date]) => void;
}

/** Ventana visible dentro del extent de datos (doble slider). Siempre controlado por el padre. */
export function PmTimelineRangeControl({
  extentMin,
  extentMax,
  value,
  onChange,
}: PmTimelineRangeControlProps) {
  const { min, max } = useMemo(
    () => ({ min: extentMin.getTime(), max: extentMax.getTime() }),
    [extentMin, extentMax],
  );

  const lo = value[0].getTime();
  const hi = value[1].getTime();

  const commit = (next: [number, number]) => {
    const [a, b] = clampTimelinePair(next[0], next[1], min, max);
    onChange([new Date(a), new Date(b)]);
  };

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
          value={Math.min(Math.max(lo, min), max)}
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
          value={Math.min(Math.max(hi, min), max)}
          onChange={(e) => commit([lo, Number(e.target.value)])}
          className="w-full h-2 accent-[#B89660] cursor-pointer"
          aria-label="Fin del rango temporal visible"
        />
      </div>
    </div>
  );
}
