"use client";

import { fmtMEuros, fmtMult, fmtPct } from "@/lib/formatters";
import { Proyecto } from "@/lib/types";
import { useMemo, useState } from "react";

interface RentabilidadTableProps {
  data: Proyecto[];
}

type SortKey =
  | "proyecto"
  | "situacion"
  | "tipo_proyecto"
  | "inversion_total"
  | "total_ingresos_venta"
  | "beneficios"
  | "tir_desp_is"
  | "roe_desp_is"
  | "multiplo"
  | "project_irr";

type SortDir = "asc" | "desc";

const TEXT_COLUMNS: SortKey[] = ["proyecto", "situacion", "tipo_proyecto"];

function isTextColumn(key: SortKey): boolean {
  return TEXT_COLUMNS.includes(key);
}

function numericOrNull(value: number | null | undefined): number | null {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return null;
  }
  return value;
}

function compareNullableNumber(a: number | null, b: number | null, dir: SortDir): number {
  const aBad = a === null;
  const bBad = b === null;
  if (aBad && bBad) return 0;
  if (aBad) return 1;
  if (bBad) return -1;
  const cmp = (a as number) - (b as number);
  return dir === "asc" ? cmp : -cmp;
}

function compareText(a: string, b: string, dir: SortDir): number {
  const cmp = a.localeCompare(b, "es", { sensitivity: "base" });
  return dir === "asc" ? cmp : -cmp;
}

function getCellString(row: Proyecto, key: SortKey): string {
  switch (key) {
    case "proyecto":
      return row.proyecto ?? "";
    case "situacion":
      return row.situacion ?? "";
    case "tipo_proyecto":
      return row.tipo_proyecto ?? "";
    default:
      return "";
  }
}

function getCellNumber(row: Proyecto, key: SortKey): number | null {
  switch (key) {
    case "inversion_total":
      return numericOrNull(row.inversion_total);
    case "total_ingresos_venta":
      return numericOrNull(row.total_ingresos_venta);
    case "beneficios":
      return numericOrNull(row.beneficios);
    case "tir_desp_is":
      return numericOrNull(row.tir_desp_is);
    case "roe_desp_is":
      return numericOrNull(row.roe_desp_is);
    case "multiplo":
      return numericOrNull(row.multiplo);
    case "project_irr":
      return numericOrNull(row.project_irr);
    default:
      return null;
  }
}

function sortRows(rows: Proyecto[], sortKey: SortKey, sortDir: SortDir): Proyecto[] {
  return [...rows].sort((a, b) => {
    if (isTextColumn(sortKey)) {
      return compareText(getCellString(a, sortKey), getCellString(b, sortKey), sortDir);
    }
    return compareNullableNumber(getCellNumber(a, sortKey), getCellNumber(b, sortKey), sortDir);
  });
}

function fmtMaybe(value: number | null, formatter: (value: number) => string): string {
  if (value === null || value <= 0) return "—";
  return formatter(value);
}

interface SortHeaderProps {
  label: string;
  sortKey: SortKey;
  activeKey: SortKey;
  dir: SortDir;
  align: "left" | "right";
  onSort: (key: SortKey) => void;
}

function SortHeader({ label, sortKey, activeKey, dir, align, onSort }: SortHeaderProps) {
  const active = activeKey === sortKey;
  const arrow = active ? (dir === "asc" ? "▲" : "▼") : "";
  return (
    <th
      className={`py-2 ${align === "right" ? "text-right pr-3" : "text-left pr-3"} cursor-pointer select-none hover:bg-subtle/30 transition-colors`}
      onClick={() => onSort(sortKey)}
      scope="col"
    >
      <span
        className={`inline-flex items-center gap-1 ${align === "right" ? "w-full justify-end" : ""}`}
      >
        {label}
        {active ? <span className="text-text-primary text-[10px]" aria-hidden>{arrow}</span> : null}
      </span>
    </th>
  );
}

export function RentabilidadTable({ data }: RentabilidadTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("inversion_total");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDir(isTextColumn(key) ? "asc" : "desc");
  }

  const rows = useMemo(() => sortRows(data, sortKey, sortDir), [data, sortKey, sortDir]);

  return (
    <section className="bg-card rounded-lg border border-subtle/50 shadow-sm p-4">
      <h3 className="text-base font-semibold text-text-primary mb-3">Rentabilidad por proyecto</h3>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1100px] text-[12px] text-text-body">
          <thead className="sticky top-0 bg-card z-10">
            <tr className="border-b border-subtle text-text-muted">
              <SortHeader
                label="Proyecto"
                sortKey="proyecto"
                activeKey={sortKey}
                dir={sortDir}
                align="left"
                onSort={handleSort}
              />
              <SortHeader
                label="Situación"
                sortKey="situacion"
                activeKey={sortKey}
                dir={sortDir}
                align="left"
                onSort={handleSort}
              />
              <SortHeader
                label="Tipo"
                sortKey="tipo_proyecto"
                activeKey={sortKey}
                dir={sortDir}
                align="left"
                onSort={handleSort}
              />
              <SortHeader
                label="Inversión (M€)"
                sortKey="inversion_total"
                activeKey={sortKey}
                dir={sortDir}
                align="right"
                onSort={handleSort}
              />
              <SortHeader
                label="GDV (M€)"
                sortKey="total_ingresos_venta"
                activeKey={sortKey}
                dir={sortDir}
                align="right"
                onSort={handleSort}
              />
              <SortHeader
                label="Beneficio (M€)"
                sortKey="beneficios"
                activeKey={sortKey}
                dir={sortDir}
                align="right"
                onSort={handleSort}
              />
              <SortHeader label="TIR" sortKey="tir_desp_is" activeKey={sortKey} dir={sortDir} align="right" onSort={handleSort} />
              <SortHeader label="ROE" sortKey="roe_desp_is" activeKey={sortKey} dir={sortDir} align="right" onSort={handleSort} />
              <SortHeader label="Múltiplo" sortKey="multiplo" activeKey={sortKey} dir={sortDir} align="right" onSort={handleSort} />
              <SortHeader
                label="Project IRR"
                sortKey="project_irr"
                activeKey={sortKey}
                dir={sortDir}
                align="right"
                onSort={handleSort}
              />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const hasHighTIR = (row.tir_desp_is ?? 0) >= 0.15;
              return (
                <tr key={row.id} className="border-b border-subtle hover:bg-subtle/40 transition-colors">
                  <td className="py-2 pr-3 font-medium">{row.proyecto}</td>
                  <td className="py-2 pr-3">{row.situacion}</td>
                  <td className="py-2 pr-3">{row.tipo_proyecto}</td>
                  <td className="py-2 pr-3 text-right font-mono">{fmtMaybe(row.inversion_total, fmtMEuros)}</td>
                  <td className="py-2 pr-3 text-right font-mono">{fmtMaybe(row.total_ingresos_venta, fmtMEuros)}</td>
                  <td className="py-2 pr-3 text-right font-mono">{fmtMaybe(row.beneficios, fmtMEuros)}</td>
                  <td
                    className={`py-2 pr-3 text-right font-mono ${hasHighTIR ? "bg-green-50 text-green-800" : ""}`}
                  >
                    {fmtMaybe(row.tir_desp_is, fmtPct)}
                  </td>
                  <td className="py-2 pr-3 text-right font-mono">{fmtMaybe(row.roe_desp_is, fmtPct)}</td>
                  <td className="py-2 pr-3 text-right font-mono">{fmtMaybe(row.multiplo, fmtMult)}</td>
                  <td className="py-2 text-right font-mono">{fmtMaybe(row.project_irr, fmtPct)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
