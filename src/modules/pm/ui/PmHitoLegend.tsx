"use client";

import type { CanonicalHitoEntry } from "@/modules/pm/logic/pm-hito-palette";
import { getHitoColor, hitoColorIndex } from "@/modules/pm/logic/pm-hito-palette";

interface PmHitoLegendProps {
  canonicalHitos: CanonicalHitoEntry[];
}

export function PmHitoLegend({ canonicalHitos }: PmHitoLegendProps) {
  if (canonicalHitos.length === 0) return null;
  return (
    <div
      className="flex flex-wrap gap-x-3 gap-y-2 justify-center sm:justify-start max-w-5xl"
      aria-label="Leyenda de hitos"
    >
      {canonicalHitos.map((h) => {
        const idx = hitoColorIndex(canonicalHitos, h.name);
        const color = getHitoColor(h.name, idx);
        return (
          <div key={h.name} className="flex items-center gap-1.5 text-[10px] text-[#1E2A56]">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-sm"
              style={{ backgroundColor: color }}
            />
            <span className="truncate max-w-[140px]" title={h.name}>
              {h.name}
            </span>
          </div>
        );
      })}
    </div>
  );
}
