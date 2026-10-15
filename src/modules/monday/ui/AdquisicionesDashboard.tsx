"use client";

import { useMemo, useState } from "react";

import {
  avgTicket,
  buildAdqData,
  buildComiteCards,
  buildFunnel,
  discardRate,
  type AdqAsset,
} from "@/modules/monday/logic/adquisiciones-dashboard";

// Colores del dashboard del Comité de Adquisiciones.
const NAVY = "#1C2E69";
const GOLD = "#9B7F57";
const GRAY = "#E2DEDA";
const BORDER = "#E2DEDA";
const MUTED = "#9BA3B2";
const INK = "#1A2035";

const USO_COLOR: Record<string, string> = {
  Residencial: NAVY,
  Hotel: GOLD,
  Oficinas: "#7D8799",
  "Apartamentos Turísticos": GRAY,
};
const PROV_COLOR: Record<string, string> = {
  Madrid: NAVY,
  Sevilla: GOLD,
  Granada: GOLD,
  Málaga: "#7D8799",
  Lisboa: GRAY,
  Cantabria: "#A8A29E",
  Barcelona: "#4F6A9E",
};

const fmtInt = (n: number) => Number(n || 0).toLocaleString("es-ES");
const fmtM = (n: number) => {
  const m = Number(n || 0) / 1e6;
  return (m >= 100 ? Math.round(m) : Math.round(m * 10) / 10).toLocaleString("es-ES") + "M€";
};
const fmtEur = (n: number) => Math.round(n).toLocaleString("es-ES") + " €";
const fmtM2 = (n: number) =>
  (n >= 1000 ? (Math.round(n / 100) / 10).toLocaleString("es-ES") + "K" : fmtInt(Math.round(n))) + " m²";

type Vista = "analisis" | "comite";

interface Props {
  assets: AdqAsset[];
  /** Momento de la lectura de Monday (ISO). */
  fetchedAt: string;
}

export function AdquisicionesDashboard({ assets, fetchedAt }: Props) {
  const [vista, setVista] = useState<Vista>("analisis");

  const comite = useMemo(() => buildComiteCards(assets), [assets]);
  const d = useMemo(
    () => buildAdqData(vista === "comite" ? assets.filter((a) => a.stage === "Comité") : assets),
    [assets, vista],
  );

  const uses = Object.entries(d.uses)
    .map(([name, n]) => ({ name, n }))
    .sort((a, b) => b.n - a.n);
  const provincias = Object.entries(d.provincias)
    .map(([name, n]) => ({ name, n }))
    .sort((a, b) => b.n - a.n);
  const funnel = buildFunnel(d.stages);
  const base = funnel[0]?.reached ?? 0;
  const descarte = discardRate(d);

  return (
    <div className="min-w-0" style={{ color: INK }}>
      <div
        className="mb-4 pb-3 flex flex-wrap gap-2 items-center justify-between"
        style={{ borderBottom: `1px solid ${BORDER}` }}
      >
        <h1 className="font-bold text-lg">Análisis de oportunidades</h1>
        <div className="flex rounded-lg overflow-hidden border" style={{ borderColor: BORDER }}>
          <VistaBoton activo={vista === "analisis"} color={NAVY} onClick={() => setVista("analisis")}>
            En análisis
          </VistaBoton>
          <VistaBoton activo={vista === "comite"} color={GOLD} onClick={() => setVista("comite")}>
            En Comité
          </VistaBoton>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-3">
        <Kpi
          label="Activos en análisis"
          value={fmtInt(d.total)}
          sub={`${fmtInt(d.total - d.discarded)} activos en curso · ${fmtInt(d.discarded)} descartados`}
        />
        <Kpi
          label="Volumen analizado"
          value={fmtM(d.vol)}
          sub={`asking disponible en ${fmtInt(d.withPrice)} de ${fmtInt(d.total)} activos`}
        />
        <Kpi label="Ticket medio" value={fmtM(avgTicket(d))} sub={`sobre ${fmtInt(d.withPrice)} activos con precio`} />
        <Kpi
          label="Precio medio €/m²"
          value={d.eurM2 != null ? fmtEur(d.eurM2) : "—"}
          sub={`sobre ${fmtInt(d.eurM2Count)} activos con ambos datos`}
        />
        <Kpi label="M² analizados" value={fmtM2(d.m2)} sub={`superficie total de ${fmtInt(d.m2Count)} activos`} />
        <Kpi
          label="Tasa de descarte"
          value={`${descarte.rate}%`}
          sub={`${fmtInt(d.discarded)} descartados de ${fmtInt(descarte.base)} activos`}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel title="Avance de etapas">
          <div className="space-y-2.5 py-1">
            {funnel.map((s, i) => {
              if (s.reached === 0 && i > 0) return null;
              const pct = base > 0 ? (s.reached / base) * 100 : 0;
              return (
                <div key={s.name}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium">{s.name}</span>
                    <span className="font-semibold" style={{ color: NAVY }}>
                      {fmtInt(s.reached)} · {Math.round(pct)}%
                    </span>
                  </div>
                  <div className="h-5 rounded" style={{ background: GRAY }}>
                    <div
                      className="h-5 rounded"
                      style={{
                        width: `${Math.max(pct, 1.5)}%`,
                        background: NAVY,
                        opacity: Math.max(1 - i * 0.06, 0.3),
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>

        <Panel title="Distribución de los activos">
          <div className="flex flex-col gap-6">
            <Barras title="Por uso" data={uses} total={d.total} colors={USO_COLOR} />
            <Barras title="Por ubicación" data={provincias} total={d.total} colors={PROV_COLOR} />
          </div>
        </Panel>
      </div>

      {comite.length > 0 ? (
        <div className="mt-4">
          <div className="text-xs font-semibold tracking-widest uppercase mb-2 px-1" style={{ color: MUTED }}>
            Activos en Comité
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {comite.map((a) => {
              const contenido = (
                <div className="p-5">
                  <div className="text-xl font-bold leading-tight" style={{ color: NAVY }}>
                    {a.name}
                  </div>
                  <div className="text-xs mt-0.5 mb-4" style={{ color: MUTED }}>
                    {a.location}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {(
                      [
                        ["Asking", a.price ? fmtM(a.price) : "—"],
                        ["Superficie", a.m2 ? `${fmtInt(Math.round(a.m2))} m²` : "—"],
                        ["Repercusión", a.repercusion ? `${fmtInt(Math.round(a.repercusion))} €/m²` : "—"],
                      ] as const
                    ).map(([lbl, val]) => (
                      <div key={lbl}>
                        <div
                          className="text-[10px] font-semibold tracking-widest uppercase mb-1"
                          style={{ color: MUTED }}
                        >
                          {lbl}
                        </div>
                        <div className="text-lg font-bold leading-tight" style={{ color: NAVY }}>
                          {val}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
              const clases = "block rounded-lg border bg-card shadow-sm overflow-hidden transition hover:shadow-md";
              const estilo = { borderColor: BORDER, borderTop: `3px solid ${NAVY}` };
              return a.mapsQuery ? (
                <a
                  key={a.name}
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(a.mapsQuery)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Ver en Google Maps"
                  className={clases}
                  style={estilo}
                >
                  {contenido}
                </a>
              ) : (
                <div key={a.name} className={clases} style={estilo}>
                  {contenido}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      <p className="text-xs mt-3" style={{ color: MUTED }}>
        Datos en directo de Monday · leídos el{" "}
        {new Date(fetchedAt).toLocaleString("es-ES", {
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "Europe/Madrid",
        })}
        .
      </p>
    </div>
  );
}

function VistaBoton({
  activo,
  color,
  onClick,
  children,
}: {
  activo: boolean;
  color: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={activo}
      onClick={onClick}
      className="px-4 py-1.5 text-sm font-semibold transition"
      style={{ background: activo ? color : "#fff", color: activo ? "#fff" : MUTED }}
    >
      {children}
    </button>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="bg-card rounded-lg border p-3 shadow-sm min-w-0" style={{ borderColor: BORDER, borderTop: `3px solid ${NAVY}` }}>
      <div className="text-[10px] font-semibold tracking-wide uppercase leading-tight" style={{ color: MUTED }}>
        {label}
      </div>
      <div className="mt-1 text-[22px] sm:text-[32px] font-bold leading-none">{value}</div>
      <div className="text-[11px] mt-1 leading-tight" style={{ color: MUTED }}>
        {sub}
      </div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-card rounded-lg border shadow-sm min-w-0" style={{ borderColor: BORDER }}>
      <div className="px-4 py-3" style={{ borderBottom: `1px solid ${BORDER}` }}>
        <h2 className="font-semibold text-sm">{title}</h2>
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function Barras({
  title,
  data,
  total,
  colors,
}: {
  title: string;
  data: { name: string; n: number }[];
  total: number;
  colors: Record<string, string>;
}) {
  const maxN = Math.max(...data.map((x) => x.n), 1);
  return (
    <div>
      <div className="text-sm font-semibold mb-3">{title}</div>
      <div className="flex gap-3 overflow-x-auto">
        {data.map((x) => {
          const pct = total > 0 ? Math.round((x.n / total) * 100) : 0;
          const barH = Math.max((x.n / maxN) * 100, 20);
          return (
            <div key={x.name} className="flex flex-col items-center flex-1 min-w-[56px]">
              <div className="flex items-end w-full" style={{ height: 100 }}>
                <div className="w-full rounded-t relative" style={{ height: barH, background: colors[x.name] ?? MUTED }}>
                  <span className="absolute top-1 inset-x-0 text-center text-[11px] font-bold text-white">{x.n}</span>
                </div>
              </div>
              <div className="text-center w-full mt-1.5">
                <div className="text-[12px] leading-snug" style={{ color: MUTED }}>
                  {x.name}
                </div>
                <div className="text-[12px] font-semibold" style={{ color: NAVY }}>
                  {pct}%
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
