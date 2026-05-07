"use client";

import { useState } from "react";
import { DataComparisonPanel } from "@/components/data/DataComparisonPanel";
import type { PortfolioDiffResult } from "@/lib/portfolio-diff";

function isPortfolioDiffDetalle(d: unknown): d is PortfolioDiffResult {
  if (!d || typeof d !== "object") return false;
  const o = d as Record<string, unknown>;
  return (
    o.resumen != null &&
    typeof o.resumen === "object" &&
    Array.isArray(o.nuevos) &&
    Array.isArray(o.eliminados) &&
    Array.isArray(o.modificados)
  );
}

interface ActivityLogDetailProps {
  detalle: unknown;
}

export function ActivityLogDetail({ detalle }: ActivityLogDetailProps) {
  const [showRaw, setShowRaw] = useState(false);
  const o = detalle && typeof detalle === "object" ? (detalle as Record<string, unknown>) : null;
  const errDetail = o && typeof o.error_detail === "string" ? o.error_detail : null;
  const errCode = o && o.error != null ? String(o.error) : null;

  return (
    <div className="space-y-4 text-sm text-text-body">
      {errDetail || errCode ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-red-900">
          {errDetail ? <p>{errDetail}</p> : null}
          {errCode && !errDetail ? <p className="font-mono text-xs">{errCode}</p> : null}
        </div>
      ) : null}

      {isPortfolioDiffDetalle(detalle) ? (
        <DataComparisonPanel comparison={detalle} sectionTitle="Resumen del cambio" />
      ) : null}

      <div>
        <button
          type="button"
          onClick={() => setShowRaw((s) => !s)}
          className="text-xs text-icam-gold hover:underline"
        >
          {showRaw ? "Ocultar" : "Ver"} JSON crudo
        </button>
        {showRaw ? (
          <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded border border-subtle bg-card p-2 font-mono text-xs">
            {JSON.stringify(detalle, null, 2)}
          </pre>
        ) : null}
      </div>
    </div>
  );
}
