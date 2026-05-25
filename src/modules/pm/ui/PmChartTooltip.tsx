"use client";

import type { ReactNode } from "react";

interface PmChartTooltipProps {
  visible: boolean;
  x: number;
  y: number;
  children: ReactNode;
}

/** Tooltip flotante para gráficos PM (estilo corporativo). */
export function PmChartTooltip({ visible, x, y, children }: PmChartTooltipProps) {
  if (!visible) return null;
  return (
    <div
      className="pointer-events-none fixed z-50 max-w-xs rounded-lg border border-subtle/40 px-3 py-2 text-xs text-[#1E2A56] shadow-[0_4px_12px_rgba(0,0,0,0.1)] bg-white"
      style={{
        left: x + 12,
        top: y + 12,
      }}
      role="tooltip"
    >
      {children}
    </div>
  );
}
