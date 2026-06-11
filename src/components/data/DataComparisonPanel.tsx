"use client";

import { useState } from "react";
import type { CompareField, PortfolioDiffResult } from "@/modules/portfolio/logic/portfolio-diff";
import { fmtInt, fmtMEuros, fmtMult, fmtPct } from "@/lib/formatters";

const FIELD_LABELS: Record<CompareField, string> = {
  inversion_total: "Inversión",
  total_ingresos_venta: "GDV",
  beneficios: "Beneficio",
  unidades_totales: "Unidades",
  tir_desp_is: "TIR",
  roe_desp_is: "ROE",
  multiplo: "Múltiplo",
  project_irr: "Project IRR",
  bcr: "BCR",
  situacion: "Situación",
  tipo_proyecto: "Tipo",
  equity: "Equity",
  holding_period: "Holding",
};

function fmtFieldValue(field: CompareField, v: number | string | null): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "string") return v;
  switch (field) {
    case "inversion_total":
    case "total_ingresos_venta":
    case "beneficios":
    case "equity":
      return fmtMEuros(v);
    case "tir_desp_is":
    case "roe_desp_is":
    case "project_irr":
      return fmtPct(v);
    case "multiplo":
    case "bcr":
      return fmtMult(v);
    case "unidades_totales":
    case "holding_period":
      return fmtInt(Math.round(v));
    default:
      return String(v);
  }
}

function deltaClass(delta: number, invert = false): string {
  if (Math.abs(delta) < 1e-9) return "text-text-muted";
  const pos = invert ? delta < 0 : delta > 0;
  return pos ? "text-green-600" : "text-red-600";
}

interface DataComparisonPanelProps {
  comparison: PortfolioDiffResult | null;
  comparisonError?: string | null;
  /** Título de la sección (p. ej. "Resumen del cambio" en logs). */
  sectionTitle?: string;
}

export function DataComparisonPanel({
  comparison,
  comparisonError,
  sectionTitle = "Comparativa de datos",
}: DataComparisonPanelProps) {
  const [openSinCambios, setOpenSinCambios] = useState(false);

  if (comparisonError) {
    return (
      <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
        <p className="font-medium">No se pudo cargar la comparativa con Supabase</p>
        <p className="mt-1">{comparisonError}</p>
      </div>
    );
  }

  if (!comparison) {
    return null;
  }

  const {
    resumen,
    nuevos = [],
    eliminados = [],
    modificados = [],
    sinCambios = [],
  } = comparison;
  const { antes, despues, deltas } = resumen;

  return (
    <div className="mt-6 space-y-4 border-t border-subtle pt-5">
      <h4 className="text-base font-semibold text-icam-900">{sectionTitle}</h4>

      <div className="overflow-x-auto rounded-lg border border-subtle">
        <table className="min-w-full text-sm">
          <thead className="bg-subtle/80 text-left text-xs uppercase text-text-muted">
            <tr>
              <th className="px-3 py-2"> </th>
              <th className="px-3 py-2">Datos actuales</th>
              <th className="px-3 py-2">Datos nuevos</th>
              <th className="px-3 py-2">Cambio</th>
            </tr>
          </thead>
          <tbody className="text-text-body">
            <tr className="border-t border-subtle">
              <td className="px-3 py-2 font-medium">Nº Proyectos</td>
              <td className="px-3 py-2">{antes.proyectos}</td>
              <td className="px-3 py-2 font-semibold">{despues.proyectos}</td>
              <td className={`px-3 py-2 ${deltaClass(deltas.proyectos)}`}>
                {deltas.proyectos >= 0 ? "+" : ""}
                {deltas.proyectos}
              </td>
            </tr>
            <tr className="border-t border-subtle">
              <td className="px-3 py-2 font-medium">Inversión total</td>
              <td className="px-3 py-2">{fmtMEuros(antes.inversion)}</td>
              <td className="px-3 py-2 font-semibold">{fmtMEuros(despues.inversion)}</td>
              <td className={`px-3 py-2 ${deltaClass(deltas.inversion)}`}>
                {deltas.inversion >= 0 ? "+" : "−"}
                {fmtMEuros(Math.abs(deltas.inversion))}
              </td>
            </tr>
            <tr className="border-t border-subtle">
              <td className="px-3 py-2 font-medium">GDV total</td>
              <td className="px-3 py-2">{fmtMEuros(antes.gdv)}</td>
              <td className="px-3 py-2 font-semibold">{fmtMEuros(despues.gdv)}</td>
              <td className={`px-3 py-2 ${deltaClass(deltas.gdv)}`}>
                {deltas.gdv >= 0 ? "+" : "−"}
                {fmtMEuros(Math.abs(deltas.gdv))}
              </td>
            </tr>
            <tr className="border-t border-subtle">
              <td className="px-3 py-2 font-medium">Beneficio total</td>
              <td className="px-3 py-2">{fmtMEuros(antes.beneficio)}</td>
              <td className="px-3 py-2 font-semibold">{fmtMEuros(despues.beneficio)}</td>
              <td className={`px-3 py-2 ${deltaClass(deltas.beneficio)}`}>
                {deltas.beneficio >= 0 ? "+" : "−"}
                {fmtMEuros(Math.abs(deltas.beneficio))}
              </td>
            </tr>
            <tr className="border-t border-subtle">
              <td className="px-3 py-2 font-medium">TIR ponderada</td>
              <td className="px-3 py-2">{fmtPct(antes.tirPond)}</td>
              <td className="px-3 py-2 font-semibold">{fmtPct(despues.tirPond)}</td>
              <td className={`px-3 py-2 ${deltaClass(deltas.tirPond)}`}>
                {deltas.tirPond >= 0 ? "+" : ""}
                {(deltas.tirPond * 100).toFixed(1)} pp
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        <span className="rounded-full bg-[#22C55E] px-2 py-0.5 font-medium text-white">
          Nuevo: {nuevos.length}
        </span>
        <span className="rounded-full bg-[#EF4444] px-2 py-0.5 font-medium text-white">
          Eliminado: {eliminados.length}
        </span>
        <span className="rounded-full bg-icam-gold px-2 py-0.5 font-medium text-white">
          Modificado: {modificados.length}
        </span>
        <span className="rounded-full bg-subtle px-2 py-0.5 font-medium text-[#8A8A8A]">
          Sin cambios: {sinCambios.length}
        </span>
      </div>

      {nuevos.length > 0 ? (
        <section>
          <h5 className="text-sm font-semibold text-green-700">Proyectos nuevos</h5>
          <ul className="mt-1 flex flex-wrap gap-1">
            {nuevos.map((p) => (
              <li key={p}>
                <span className="rounded bg-green-50 px-2 py-0.5 text-sm text-green-800">{p}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {eliminados.length > 0 ? (
        <section>
          <h5 className="text-sm font-semibold text-red-700">Proyectos eliminados (solo en Supabase)</h5>
          <ul className="mt-1 flex flex-wrap gap-1">
            {eliminados.map((p) => (
              <li key={p}>
                <span className="rounded bg-red-50 px-2 py-0.5 text-sm text-red-800">{p}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {modificados.length > 0 ? (
        <section>
          <h5 className="text-sm font-semibold text-icam-gold">Proyectos modificados</h5>
          <ul className="mt-2 space-y-2">
            {modificados.map((m) => (
              <li
                key={m.proyecto}
                className="rounded-md border border-icam-gold/40 bg-amber-50/50 px-3 py-2 text-sm"
              >
                <span className="font-medium text-icam-900">{m.proyecto}</span>
                <div className="mt-1 space-y-0.5 text-text-body">
                  {(Object.entries(m.cambios) as [CompareField, { antes: unknown; despues: unknown }][]).map(
                    ([field, ch]) => (
                      <div key={field}>
                        <span className="text-text-muted">{FIELD_LABELS[field]}: </span>
                        <span className="text-[#8A8A8A] line-through">
                          {fmtFieldValue(field, ch.antes as number | string | null)}
                        </span>
                        <span className="mx-1 text-text-muted">→</span>
                        <strong>{fmtFieldValue(field, ch.despues as number | string | null)}</strong>
                      </div>
                    ),
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {sinCambios.length > 0 ? (
        <section>
          <button
            type="button"
            onClick={() => setOpenSinCambios((o) => !o)}
            className="text-sm font-medium text-[#8A8A8A] hover:text-text-body"
          >
            {openSinCambios ? "Ocultar" : "Mostrar"} proyectos sin cambios ({sinCambios.length})
          </button>
          {openSinCambios ? (
            <p className="mt-2 text-xs text-[#8A8A8A]">{sinCambios.join(", ")}</p>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
