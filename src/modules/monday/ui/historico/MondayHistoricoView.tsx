"use client";

import type { MondayHistoricoPayload } from "@/modules/monday/data/historico-read";
import type { MondayAsset, MondayStage } from "@/modules/monday/data/dashboard-types";
import {
  buildCumulativeFunnelRows,
  buildEvolutionSeries,
  buildResolutionStats,
  buildStageDurationRows,
  buildSuccessRatio,
  buildTimelinesForAssets,
  buildUseActivityByItem,
  filterHistoricoAssets,
  FUNNEL_PIPELINE_STAGES,
  type HistoricoFunnelRow,
  type HistoricoStageDurationRow,
} from "@/modules/monday/logic/historico-transform";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  ComposedChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const locale = "es-ES";
const CORP = { navy: "#1E2A56", gold: "#B89660", muted: "#8A8A8A", line: "#EAEBEE" };

type PeriodPreset = "all" | "year" | "6m" | "quarter" | "custom";

function periodRange(
  preset: PeriodPreset,
  customFrom: string,
  customTo: string,
): { from: number | null; to: number | null } | null {
  if (preset === "all") return null;
  const now = Date.now();
  const day = 86_400_000;
  if (preset === "year") return { from: now - 365 * day, to: now };
  if (preset === "6m") return { from: now - 182 * day, to: now };
  if (preset === "quarter") return { from: now - 91 * day, to: now };
  const from = customFrom ? new Date(`${customFrom}T00:00:00`).getTime() : null;
  const to = customTo ? new Date(`${customTo}T23:59:59.999`).getTime() : null;
  if (from === null && to === null) return null;
  return { from, to };
}

function fmtPct(n: number) {
  return `${(n * 100).toLocaleString(locale, { maximumFractionDigits: 1 })}%`;
}

function fmtMEur(eur: number) {
  return `${(eur / 1_000_000).toLocaleString(locale, { maximumFractionDigits: 1 })} M€`;
}

function fmtDays(n: number) {
  return `${n.toLocaleString(locale, { maximumFractionDigits: 1 })} d`;
}

function chartTooltipProps() {
  return {
    contentStyle: {
      background: "#FFFFFF",
      border: `1px solid ${CORP.line}`,
      borderRadius: 8,
      boxShadow: "0 4px 12px rgba(30, 42, 86, 0.08)",
    },
    labelStyle: { color: CORP.navy, fontWeight: 600 },
  };
}

interface MondayHistoricoViewProps {
  data: MondayHistoricoPayload;
}

export function MondayHistoricoView({ data }: MondayHistoricoViewProps) {
  const router = useRouter();
  const [groups, setGroups] = useState<Set<string>>(() => new Set(data.groupTitles));
  const [preset, setPreset] = useState<PeriodPreset>("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [funnelMode, setFunnelMode] = useState<"units" | "volume">("units");
  const [evoGranularity, setEvoGranularity] = useState<"month" | "quarter">("month");

  const logMap = useMemo(() => {
    const m = new Map<string, Array<{ at: string; stage: MondayStage }>>();
    for (const [k, v] of Object.entries(data.logEventsByItemId)) m.set(k, v);
    return m;
  }, [data.logEventsByItemId]);

  const range = useMemo(() => periodRange(preset, customFrom, customTo), [preset, customFrom, customTo]);

  const filtered = useMemo(() => {
    const titles = data.groupTitles.filter((g) => groups.has(g));
    return filterHistoricoAssets(data.assets, titles.length ? titles : [], range);
  }, [data.assets, data.groupTitles, groups, range]);

  const useActivityByItem = useMemo(
    () => buildUseActivityByItem(filtered, logMap, data.activityMode),
    [filtered, data.activityMode, logMap],
  );

  const timelines = useMemo(
    () => buildTimelinesForAssets(filtered, logMap),
    [filtered, logMap],
  );

  const funnelRows = useMemo(
    () => buildCumulativeFunnelRows(filtered, timelines, useActivityByItem),
    [filtered, timelines, useActivityByItem],
  );

  const durationRows = useMemo(
    () => buildStageDurationRows(filtered, timelines, useActivityByItem),
    [filtered, timelines, useActivityByItem],
  );

  const resolution = useMemo(
    () => buildResolutionStats(filtered, timelines, useActivityByItem),
    [filtered, timelines, useActivityByItem],
  );

  const success = useMemo(() => buildSuccessRatio(filtered), [filtered]);

  const evolution = useMemo(
    () => buildEvolutionSeries(filtered, timelines, useActivityByItem, evoGranularity),
    [filtered, timelines, useActivityByItem, evoGranularity],
  );

  const totalVolume = useMemo(
    () => filtered.reduce((s, a: MondayAsset) => s + (a.askingPriceEur ?? 0), 0),
    [filtered],
  );

  const resolvedTotal = success.acquired + success.rejected;
  const globalSuccessPct = resolvedTotal > 0 ? success.acquired / resolvedTotal : 0;

  const toggleGroup = (title: string) => {
    setGroups((prev) => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      return next;
    });
  };

  const selectAllGroups = () => setGroups(new Set(data.groupTitles));

  return (
    <div className="space-y-4 min-w-0 transition-opacity duration-300">
      <section className="bg-card rounded-lg border border-subtle/50 shadow-sm p-4 sm:p-5">
        <h1 className="text-xl font-semibold text-icam-900">Histórico — pipeline de adquisiciones</h1>
        <p className="text-sm text-text-muted mt-1">
          Board: <span className="font-medium">{data.selectedBoardName ?? data.selectedBoardId}</span>. Incluye todos
          los grupos del tablero. Fuente embudo tiempos:{" "}
          <span className="font-medium">
            {data.activityMode === "activity_logs" ? "registro de actividad (columna etapa)" : "aproximación por etapa actual"}
          </span>
          .
        </p>
      </section>

      <section className="bg-card rounded-lg border border-subtle/50 shadow-sm p-3 sm:p-4">
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const boardId = String(fd.get("boardId") ?? "");
            const q = boardId ? `?boardId=${encodeURIComponent(boardId)}` : "";
            router.push(`/dashboard/monday/historico${q}`);
          }}
        >
          <label className="text-sm text-text-body flex flex-col gap-1 max-w-md">
            Board
            <select
              name="boardId"
              defaultValue={data.selectedBoardId ?? undefined}
              className="h-10 rounded-md border border-subtle px-2 text-sm bg-white"
            >
              {data.boards.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="h-9 w-fit rounded-md bg-icam-900 text-white text-sm px-4 hover:bg-icam-800 transition"
          >
            Cambiar board
          </button>
        </form>
      </section>

      <section className="bg-card rounded-lg border border-subtle/50 shadow-sm p-3 sm:p-4 transition-all duration-300">
        <div className="flex flex-col lg:flex-row lg:items-start gap-6">
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-text-primary mb-2">Grupo del tablero</h3>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={selectAllGroups}
                className="text-xs px-2 py-1 rounded border border-subtle text-text-body hover:bg-page"
              >
                Todos
              </button>
              {data.groupTitles.map((g) => (
                <label
                  key={g}
                  className="inline-flex items-center gap-2 text-sm text-text-body cursor-pointer select-none"
                >
                  <input
                    type="checkbox"
                    checked={groups.has(g)}
                    onChange={() => toggleGroup(g)}
                    className="h-4 w-4 accent-icam-900"
                  />
                  {g}
                </label>
              ))}
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-text-primary mb-2">Periodo (fecha entrada / creación)</h3>
            <div className="flex flex-wrap gap-2 mb-2">
              {(
                [
                  ["all", "Todo"],
                  ["year", "Último año"],
                  ["6m", "Últimos 6 meses"],
                  ["quarter", "Último trimestre"],
                ] as const
              ).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setPreset(k)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition ${
                    preset === k
                      ? "bg-icam-900 text-white border-icam-900"
                      : "border-subtle text-text-body hover:bg-page"
                  }`}
                >
                  {label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setPreset("custom")}
                className={`text-xs px-3 py-1.5 rounded-full border transition ${
                  preset === "custom"
                    ? "bg-icam-900 text-white border-icam-900"
                    : "border-subtle text-text-body hover:bg-page"
                }`}
              >
                Personalizado
              </button>
            </div>
            {preset === "custom" ? (
              <div className="flex flex-wrap gap-2 items-end">
                <label className="text-xs text-text-muted flex flex-col gap-1">
                  Desde
                  <input
                    type="date"
                    value={customFrom}
                    onChange={(e) => setCustomFrom(e.target.value)}
                    className="h-9 rounded-md border border-subtle px-2 text-sm bg-white"
                  />
                </label>
                <label className="text-xs text-text-muted flex flex-col gap-1">
                  Hasta
                  <input
                    type="date"
                    value={customTo}
                    onChange={(e) => setCustomTo(e.target.value)}
                    className="h-9 rounded-md border border-subtle px-2 text-sm bg-white"
                  />
                </label>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 transition-all duration-300">
        <KpiCard title="Total activos" value={String(filtered.length)} />
        <KpiCard
          title="Tasa de éxito (resueltos)"
          value={resolvedTotal ? fmtPct(globalSuccessPct) : "—"}
          subtitle={resolvedTotal ? `${success.acquired} adq. / ${success.rejected} rech.` : "Sin resueltos en filtro"}
        />
        <KpiCard
          title="Tiempo medio resolución"
          value={resolution.countAcquired + resolution.countRejected > 0 ? fmtDays(resolution.meanDaysAll) : "—"}
          subtitle={`Mediana: ${
            resolution.countAcquired + resolution.countRejected > 0 ? fmtDays(resolution.medianDaysAll) : "—"
          } | Adq: ${fmtDays(resolution.meanDaysAcquired)} · Rech: ${fmtDays(resolution.meanDaysRejected)}`}
        />
        <KpiCard title="Volumen total (asking)" value={fmtMEur(totalVolume)} />
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-3 transition-all duration-300">
        <HistoricoFunnelPanel rows={funnelRows} mode={funnelMode} onModeChange={setFunnelMode} />
        <HistoricoConversionStrip rows={funnelRows} />
      </section>

      <section className="bg-card rounded-lg border border-subtle/50 shadow-sm p-3 sm:p-4 transition-all duration-300">
        <h3 className="text-sm font-semibold text-text-primary mb-2">Tiempo medio por etapa (solo con historial)</h3>
        <p className="text-xs text-text-muted mb-3">
          Media de días entre primera entrada en una etapa y la siguiente. Si no hay eventos de actividad por ítem, no
          aporta muestra.
        </p>
        <div className="h-[320px] min-h-[280px] min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={durationRows}
              layout="vertical"
              margin={{ left: 8, right: 12, top: 8, bottom: 8 }}
            >
              <XAxis type="number" tick={{ fontSize: 11, fill: CORP.muted }} unit=" d" />
              <YAxis type="category" dataKey="label" width={200} tick={{ fontSize: 10, fill: CORP.navy }} />
              <Tooltip
                {...chartTooltipProps()}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const p = payload[0]?.payload as HistoricoStageDurationRow | undefined;
                  if (!p) return null;
                  return (
                    <div
                      className="text-xs px-3 py-2 rounded-lg border shadow-md bg-white"
                      style={{ borderColor: CORP.line }}
                    >
                      <p className="font-semibold text-icam-900 mb-1">{p.label}</p>
                      <p className="text-text-muted">
                        {fmtDays(p.meanDays)} media | {fmtDays(p.medianDays)} mediana | {fmtDays(p.maxDays)} máx (
                        {p.sampleCount} ítems)
                      </p>
                    </div>
                  );
                }}
              />
              <Bar dataKey="meanDays" radius={[0, 4, 4, 0]}>
                {durationRows.map((e, i) => (
                  <Cell key={i} fill={e.exceedsThreshold ? "#C45C5C" : CORP.navy} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="bg-card rounded-lg border border-subtle/50 shadow-sm p-3 sm:p-4 transition-all duration-300">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h3 className="text-sm font-semibold text-text-primary">Evolución temporal</h3>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setEvoGranularity("month")}
              className={`text-xs px-2 py-1 rounded border ${evoGranularity === "month" ? "border-icam-900 bg-page" : "border-subtle"}`}
            >
              Mensual
            </button>
            <button
              type="button"
              onClick={() => setEvoGranularity("quarter")}
              className={`text-xs px-2 py-1 rounded border ${evoGranularity === "quarter" ? "border-icam-900 bg-page" : "border-subtle"}`}
            >
              Trimestral
            </button>
          </div>
        </div>
        <div className="h-[280px] min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={evolution} margin={{ left: 0, right: 8, top: 8, bottom: 24 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={CORP.line} />
              <XAxis dataKey="period" tick={{ fontSize: 10, fill: CORP.muted }} />
              <YAxis tick={{ fontSize: 11, fill: CORP.muted }} />
              <Tooltip {...chartTooltipProps()} />
              <Legend />
              <Bar dataKey="received" name="Nuevos" fill={CORP.navy} radius={[4, 4, 0, 0]} />
              <Line type="monotone" dataKey="resolved" name="Resueltos" stroke={CORP.gold} strokeWidth={2} dot />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <article className="bg-card rounded-lg border border-subtle/50 shadow-sm p-3 sm:p-4 flex flex-col items-center transition-all duration-300">
          <h3 className="text-sm font-semibold text-text-primary mb-2 self-start">Ratio Adquirido / Rechazado</h3>
          <p className="text-xs text-text-muted mb-2 self-start">Solo activos con resolución final en el filtro actual.</p>
          <div className="h-[240px] w-full max-w-sm">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={
                    resolvedTotal
                      ? [
                          { name: "Adquirido", value: success.acquired, fill: "#2E7D4A" },
                          { name: "Rechazado", value: success.rejected, fill: "#C62828" },
                        ]
                      : [{ name: "Sin datos", value: 1, fill: CORP.line }]
                  }
                  dataKey="value"
                  nameKey="name"
                  innerRadius={58}
                  outerRadius={86}
                  paddingAngle={2}
                />
                <Tooltip
                  {...chartTooltipProps()}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const row = payload[0];
                    const name = String(row?.name ?? "");
                    const v = Number(row?.value ?? 0);
                    return (
                      <div
                        className="text-xs px-3 py-2 rounded-lg border shadow-md bg-white"
                        style={{ borderColor: CORP.line }}
                      >
                        <p className="font-semibold text-icam-900">{name}</p>
                        <p className="text-text-muted">
                          {resolvedTotal ? `${v} (${fmtPct(v / resolvedTotal)})` : `${name}`}
                        </p>
                      </div>
                    );
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </article>
        <article className="bg-card rounded-lg border border-subtle/50 shadow-sm p-4 text-sm text-text-body transition-all duration-300">
          <h3 className="text-sm font-semibold text-text-primary mb-2">Notas</h3>
          <ul className="list-disc pl-4 space-y-1 text-xs text-text-muted">
            <li>
              El embudo acumulativo usa el historial de la columna de etapa cuando Monday devuelve{" "}
              <code className="text-[11px]">activity_logs</code>; si no, se asume progresión lineal hasta la etapa
              actual.
            </li>
            <li>Los tiempos por etapa requieren al menos dos hitos distintos en el historial por ítem.</li>
            <li>
              <Link href="/dashboard/monday" className="text-icam-900 underline">
                Volver al Dashboard Monday
              </Link>
            </li>
          </ul>
        </article>
      </section>
    </div>
  );
}

function KpiCard({ title, value, subtitle }: { title: string; value: string; subtitle?: string }) {
  return (
    <article className="bg-card rounded-lg border border-subtle/50 shadow-sm p-4 transition-all duration-300">
      <p className="text-xs uppercase tracking-wide text-text-muted">{title}</p>
      <p className="text-2xl font-semibold text-icam-900 mt-1">{value}</p>
      {subtitle ? <p className="text-xs text-text-muted mt-1 leading-snug">{subtitle}</p> : null}
    </article>
  );
}

function HistoricoFunnelPanel({
  rows,
  mode,
  onModeChange,
}: {
  rows: HistoricoFunnelRow[];
  mode: "units" | "volume";
  onModeChange: (m: "units" | "volume") => void;
}) {
  const max =
    mode === "units"
      ? Math.max(1, ...rows.map((r) => r.count))
      : Math.max(1, ...rows.map((r) => r.volumeEur));
  return (
    <article className="bg-card rounded-lg border border-subtle/50 shadow-sm p-3 sm:p-4 transition-all duration-300">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <h3 className="text-sm font-semibold text-text-primary">Embudo de conversión</h3>
        <div className="flex rounded-md border border-subtle overflow-hidden text-xs">
          <button
            type="button"
            onClick={() => onModeChange("units")}
            className={`px-3 py-1.5 ${mode === "units" ? "bg-icam-900 text-white" : "bg-white text-text-body"}`}
          >
            Unidades
          </button>
          <button
            type="button"
            onClick={() => onModeChange("volume")}
            className={`px-3 py-1.5 ${mode === "volume" ? "bg-icam-900 text-white" : "bg-white text-text-body"}`}
          >
            Volumen (M€)
          </button>
        </div>
      </div>
      <div className="space-y-3">
        {rows.map((row, idx) => {
          const raw = mode === "units" ? row.count : row.volumeEur;
          const pctWidth = (raw / max) * 100;
          const t = idx / Math.max(1, rows.length - 1);
          const c1 = "#1E2A56";
          const c2 = "#B89660";
          const blend = `linear-gradient(90deg, ${c1} 0%, ${c2} ${65 + t * 35}%)`;
          return (
            <div key={row.stage} className="flex flex-col items-center gap-1 transition-all duration-300">
              <div className="w-full flex justify-center">
                <div
                  className="relative h-11 rounded-md shadow-sm flex items-center justify-center text-white text-sm font-medium px-3 transition-all duration-300"
                  style={{
                    width: `${Math.max(18, pctWidth)}%`,
                    background: blend,
                    minWidth: 120,
                  }}
                  title={`${row.label}: ${mode === "units" ? row.count : fmtMEur(row.volumeEur)} · ${fmtPct(row.percentOfTop)} del tope`}
                >
                  <span className="truncate">{row.label}</span>
                </div>
              </div>
              <div className="text-xs text-text-muted">
                {mode === "units" ? (
                  <>
                    {row.count} activos · {fmtPct(row.percentOfTop)} vs Recibido
                  </>
                ) : (
                  <>
                    {fmtMEur(row.volumeEur)} · {fmtPct(row.percentOfTop)} vs Recibido
                  </>
                )}
                {row.conversionToNext !== null ? (
                  <span className="ml-2 text-text-body">→ siguiente: {fmtPct(row.conversionToNext)}</span>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </article>
  );
}

function HistoricoConversionStrip({ rows }: { rows: HistoricoFunnelRow[] }) {
  return (
    <article className="bg-card rounded-lg border border-subtle/50 shadow-sm p-3 sm:p-4 transition-all duration-300">
      <h3 className="text-sm font-semibold text-text-primary mb-3">Tasa entre etapas</h3>
      <div className="flex flex-col gap-2">
        {FUNNEL_PIPELINE_STAGES.slice(0, -1).map((stage, i) => {
          const row = rows[i];
          const next = rows[i + 1];
          if (!row || !next) return null;
          const rate = row.count > 0 ? next.count / row.count : 0;
          return (
            <div
              key={stage}
              className="flex items-center justify-between gap-2 text-sm border-b border-subtle/60 pb-2 last:border-0"
            >
              <span className="text-text-body shrink min-w-0">
                {row.label} → {next.label}
              </span>
              <span className="font-semibold text-icam-900 whitespace-nowrap">{fmtPct(rate)}</span>
            </div>
          );
        })}
      </div>
    </article>
  );
}
