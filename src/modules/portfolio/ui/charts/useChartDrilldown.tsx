"use client";

import { useCallback, useState } from "react";

import {
  ChartDrilldownModal,
  type ChartDrilldownSelection,
} from "@/modules/portfolio/ui/charts/ChartDrilldownModal";

/**
 * Estado del drill-down de una gráfica. Devuelve el modal ya montado para que
 * cada gráfica solo tenga que declarar su `onClick` y pintar `{modal}`.
 */
export function useChartDrilldown() {
  const [selection, setSelection] = useState<ChartDrilldownSelection | null>(null);

  const close = useCallback(() => setSelection(null), []);
  const open = useCallback((next: ChartDrilldownSelection) => setSelection(next), []);

  return {
    selection,
    open,
    close,
    modal: <ChartDrilldownModal selection={selection} onClose={close} />,
  };
}
