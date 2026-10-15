"use client";

import { useMemo, useState, type ReactNode } from "react";

import { EncabezadoDePagina } from "@/components/ui/EncabezadoDePagina";
import { Icono } from "@/components/ui/Icono";
import { Tarjeta } from "@/components/ui/Tarjeta";
import {
  avgTicket,
  buildAdqData,
  buildCards,
  buildFunnel,
  CARD_STAGES,
  catastroUrl,
  earthUrl,
  mapsUrl,
  STAGE_LABEL,
  type AdqAcquisition,
  type AdqAsset,
  type AdqCard,
} from "@/modules/monday/logic/adquisiciones-dashboard";
import { KPICard } from "@/modules/portfolio/ui/KPICard";

const fmtInt = (n: number) => Number(n || 0).toLocaleString("es-ES");
const fmtM = (n: number) => {
  const m = Number(n || 0) / 1e6;
  return (m >= 100 ? Math.round(m) : Math.round(m * 10) / 10).toLocaleString("es-ES") + " M€";
};
const fmtEur = (n: number) => Math.round(n).toLocaleString("es-ES") + " €";
const fmtM2 = (n: number) =>
  (n >= 1000 ? (Math.round(n / 100) / 10).toLocaleString("es-ES") + "K" : fmtInt(Math.round(n))) + " m²";

type Vista = "analisis" | "comite";

interface Props {
  assets: AdqAsset[];
  /** Tasa de adquisición de todo el tablero, no solo del grupo «En análisis». */
  adquisicion: AdqAcquisition;
  /** Referencia catastral por nombre de activo (null si no se encontró). */
  catastro: Record<string, string | null>;
  /** Momento de la lectura de Monday (ISO). */
  fetchedAt: string;
}

export function AdquisicionesDashboard({ assets, adquisicion, catastro, fetchedAt }: Props) {
  const [vista, setVista] = useState<Vista>("analisis");

  const cards = useMemo(
    () => buildCards(assets, vista === "comite" ? ["Comité"] : CARD_STAGES),
    [assets, vista],
  );
  const d = useMemo(
    () => buildAdqData(vista === "comite" ? assets.filter((a) => a.stage === "Comité") : assets),
    [assets, vista],
  );

  const porN = (rec: Record<string, number>) =>
    Object.entries(rec)
      .map(([name, n]) => ({ name, n }))
      .sort((a, b) => b.n - a.n);
  const funnel = buildFunnel(d.stages);
  const base = d.total;
  const leido = new Date(fetchedAt).toLocaleString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Madrid",
  });

  return (
    <div className="space-y-4 min-w-0">
      <EncabezadoDePagina
        titulo="Análisis de oportunidades"
        meta={`Datos en directo de Monday · leídos el ${leido}`}
        acciones={
          <div className="flex rounded-md overflow-hidden border border-subtle" role="group" aria-label="Vista">
            <VistaBoton activo={vista === "analisis"} activoClase="bg-icam-900" onClick={() => setVista("analisis")}>
              En análisis
            </VistaBoton>
            <VistaBoton activo={vista === "comite"} activoClase="bg-icam-gold" onClick={() => setVista("comite")}>
              En Comité
            </VistaBoton>
          </div>
        }
      />

      <section className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
        <KPICard
          title="Activos en análisis"
          value={fmtInt(d.total)}
        />
        <KPICard
          title="Volumen analizado"
          value={fmtM(d.vol)}
        />
        <KPICard title="Ticket medio" value={fmtM(avgTicket(d))} />
        <KPICard
          title="Precio medio €/m²"
          value={d.eurM2 != null ? fmtEur(d.eurM2) : "—"}
        />
        <KPICard title="m² analizados" value={fmtM2(d.m2)} />
        <KPICard
          title="Tasa de adquisición"
          value={`${adquisicion.rate.toLocaleString("es-ES")}%`}
          highlight
        />
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Tarjeta titulo="Situación actual" subtitulo="Activos en cada etapa hoy, según Monday">
          <div className="space-y-2.5">
            {funnel.map((s, i) => {
              const pct = base > 0 ? (s.count / base) * 100 : 0;
              return (
                <div key={s.name}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-text-body">{s.name}</span>
                    <span className="font-semibold text-text-primary">
                      {fmtInt(s.count)} · {Math.round(pct)}%
                    </span>
                  </div>
                  <div className="h-4 rounded bg-subtle">
                    <div
                      className="h-4 rounded bg-icam-900"
                      style={{ width: `${Math.max(pct, 1.5)}%`, opacity: Math.max(1 - i * 0.07, 0.35) }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Tarjeta>

        <Tarjeta titulo="Distribución de los activos" subtitulo="Un activo con varios usos cuenta en cada uno">
          <div className="flex flex-col gap-6">
            <Barras title="Por uso" data={porN(d.uses)} total={d.total} />
            <Barras title="Por ubicación" data={porN(d.provincias)} total={d.total} />
          </div>
        </Tarjeta>
      </div>

      {cards.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-xs font-medium uppercase tracking-wider text-text-muted px-1">
            {vista === "comite" ? "Activos en Comité" : "Activos en análisis"}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {cards.map((a) => (
              <TarjetaActivo key={a.name} a={a} rc={catastro[a.name] ?? null} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

/**
 * Tarjeta de un activo: pulsarla abre Google Maps; los iconos abren su ficha
 * del Catastro y Google Earth en la misma ubicación.
 */
function TarjetaActivo({ a, rc }: { a: AdqCard; rc: string | null }) {
  const enlace = "relative z-10 rounded p-1.5 text-text-muted transition hover:bg-subtle hover:text-icam-900";
  return (
    <article className="relative min-w-0 overflow-hidden rounded-lg border border-subtle/50 bg-card shadow-sm transition hover:border-icam-900 hover:shadow-md">
      <div className={`h-[3px] ${a.stage === "Comité" ? "bg-icam-gold" : "bg-icam-900"}`} />
      <div className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-medium uppercase tracking-wider text-text-muted">
              {STAGE_LABEL[a.stage] ?? a.stage}
            </p>
            {a.mapsQuery ? (
              <a
                href={mapsUrl(a.mapsQuery)}
                target="_blank"
                rel="noopener noreferrer"
                title="Ver en Google Maps"
                className="block text-lg font-semibold text-text-primary leading-tight after:absolute after:inset-0"
              >
                {a.name}
              </a>
            ) : (
              <p className="text-lg font-semibold text-text-primary leading-tight">{a.name}</p>
            )}
            <p className="text-xs text-text-muted mt-0.5">{a.location}</p>
          </div>
          <div className="flex shrink-0 gap-1">
            <a
              href={catastroUrl(rc)}
              target="_blank"
              rel="noopener noreferrer"
              title={rc ? `Ficha del Catastro (${rc})` : "Buscar en el Catastro"}
              aria-label="Abrir en el Catastro"
              className={enlace}
            >
              <Icono nombre="documento" className="h-[18px] w-[18px]" />
            </a>
            {a.mapsQuery ? (
              <a
                href={earthUrl(a.mapsQuery)}
                target="_blank"
                rel="noopener noreferrer"
                title="Ver en Google Earth"
                aria-label="Abrir en Google Earth"
                className={enlace}
              >
                <Icono nombre="planeta" className="h-[18px] w-[18px]" />
              </a>
            ) : null}
          </div>
        </div>
        <dl className="grid grid-cols-3 gap-2 mt-4">
          <Dato etiqueta="Asking">{a.price ? fmtM(a.price) : "—"}</Dato>
          <Dato etiqueta="Superficie">{a.m2 ? `${fmtInt(Math.round(a.m2))} m²` : "—"}</Dato>
          <Dato etiqueta="Repercusión">{a.repercusion ? `${fmtInt(Math.round(a.repercusion))} €/m²` : "—"}</Dato>
        </dl>
      </div>
    </article>
  );
}

function VistaBoton({
  activo,
  activoClase,
  onClick,
  children,
}: {
  activo: boolean;
  activoClase: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={activo}
      onClick={onClick}
      className={`min-h-9 px-4 text-sm font-medium transition ${
        activo ? `${activoClase} text-white` : "bg-card text-text-muted hover:text-text-primary"
      }`}
    >
      {children}
    </button>
  );
}

function Dato({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-medium uppercase tracking-wider text-text-muted mb-1">{etiqueta}</dt>
      <dd className="text-base sm:text-lg font-semibold text-text-primary leading-tight">{children}</dd>
    </div>
  );
}

/** Nombres cortos en los gráficos. */
const CHART_LABEL: Record<string, string> = { "Apartamentos Turísticos": "AT" };

function Barras({ title, data, total }: { title: string; data: { name: string; n: number }[]; total: number }) {
  const maxN = Math.max(...data.map((x) => x.n), 1);
  return (
    <div>
      <p className="text-sm font-medium text-text-primary mb-3">{title}</p>
      {data.length === 0 ? (
        <p className="text-sm text-text-muted">Sin datos.</p>
      ) : (
        <div className="flex gap-3 overflow-x-auto">
          {data.map((x, i) => {
            const pct = total > 0 ? Math.round((x.n / total) * 100) : 0;
            return (
              <div key={x.name} className="flex flex-col items-center flex-1 min-w-[56px]">
                <div className="flex items-end w-full h-24">
                  <div
                    className={`w-full rounded-t relative ${i === 0 ? "bg-icam-900" : "bg-icam-800"}`}
                    style={{ height: `${Math.max((x.n / maxN) * 100, 20)}%`, opacity: i === 0 ? 1 : 0.75 }}
                  >
                    <span className="absolute top-1 inset-x-0 text-center text-[11px] font-semibold text-white">
                      {x.n}
                    </span>
                  </div>
                </div>
                <p className="mt-1.5 text-center text-xs leading-snug text-text-muted">{CHART_LABEL[x.name] ?? x.name}</p>
                <p className="text-xs font-semibold text-text-primary">{pct}%</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
