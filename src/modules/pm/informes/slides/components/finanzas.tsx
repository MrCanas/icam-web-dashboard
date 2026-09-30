import type { ReactNode } from "react";

import { icono } from "../assets";
import { rt } from "../texto";
import type { Rich } from "../tipos";
import { Slide, SlideHeader, type SlideBase } from "./base";

function Candado() {
  return (
    <svg viewBox="0 0 24 24" width={14} height={14} aria-hidden className="iq-candado">
      <rect x={5} y={11} width={14} height={10} rx={1} />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" fill="none" />
    </svg>
  );
}

export interface SlideBloqueadoProps extends SlideBase {
  seccion?: number;
  titulo?: string;
  origen?: string;
  version?: number | string;
  estado?: string;
  vista?: string;
  children?: ReactNode;
}

/** Slide que no redacta Claude: la aporta Finanzas (o el PM) como página. */
export function SlideBloqueado(props: SlideBloqueadoProps) {
  return (
    <Slide layout="bloqueado" pie={props.pie} pagina={props.pagina}>
      {props.titulo ? <SlideHeader seccion={props.seccion} titulo={props.titulo} /> : null}
      <div className="iq-bloqueado-cuerpo">
        {props.children ||
          (props.vista ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={props.vista} alt={props.titulo || ""} />
          ) : null)}
      </div>
      <div className="iq-bloqueado-sello">
        <Candado />
        {" Bloqueado · "}
        {props.origen || "Finanzas"}
        {props.version ? " · v" + props.version : ""}
        {props.estado ? " · " + props.estado : ""}
      </div>
    </Slide>
  );
}

export interface KpiIconosFinancierosProps {
  kpis: { icono: string; etiqueta: string; valor: string }[];
  columnas?: number;
}

export function KpiIconosFinancieros(props: KpiIconosFinancierosProps) {
  return (
    <div className="iq-kpi-iconos" style={{ gridTemplateColumns: "repeat(" + (props.columnas || 4) + ", 1fr)" }}>
      {(props.kpis || []).map((k, i) => (
        <div key={i} className="iq-kpi-icono">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={icono(k.icono)} alt="" />
          <div className="iq-kpi-icono-label">{k.etiqueta}</div>
          <div className="iq-kpi-icono-valor">{k.valor}</div>
        </div>
      ))}
    </div>
  );
}

export interface TablaVarianzasProps {
  anterior: string;
  actual: string;
  filas: {
    descripcion: string;
    previo: string;
    actual: string;
    variacion: string;
    variacionPct: string;
    observaciones?: Rich;
  }[];
}

export function TablaVarianzas(props: TablaVarianzasProps) {
  return (
    <table className="iq-tabla iq-tabla-var">
      <thead>
        <tr>
          <th rowSpan={2} className="iq-l">
            Descripción
          </th>
          <th colSpan={2}>Proyecciones Financieras</th>
          <th colSpan={2}>Variación</th>
          <th rowSpan={2} className="iq-l">
            Observaciones
          </th>
        </tr>
        <tr>
          <th>{props.anterior}</th>
          <th className="iq-var-actual">{props.actual}</th>
          <th>Informe previo €</th>
          <th>Informe previo %</th>
        </tr>
      </thead>
      <tbody>
        {(props.filas || []).map((f, i) => (
          <tr key={i}>
            <td>{f.descripcion}</td>
            <td className="iq-r">{f.previo}</td>
            <td className="iq-r iq-var-actual">{f.actual}</td>
            <td className="iq-r">{f.variacion}</td>
            <td className="iq-r">{f.variacionPct}</td>
            <td>{rt(f.observaciones)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export interface TablaFinancieraProps {
  titulo: string;
  columnas: string[];
  filas: { celdas: string[]; total?: boolean }[];
}

export function TablaFinanciera(props: TablaFinancieraProps) {
  const cols = props.columnas || [];
  return (
    <div className="iq-tfin">
      <div className="iq-tfin-barra">{props.titulo}</div>
      <table className="iq-tabla iq-tabla-fin">
        <thead>
          <tr>
            {cols.map((c, i) => (
              <th key={i} className={i ? "iq-r" : "iq-l"}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(props.filas || []).map((f, i) => (
            <tr key={i} className={f.total ? "iq-tfin-total" : undefined}>
              {f.celdas.map((c, j) => (
                <td key={j} className={j ? "iq-r" : undefined}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export interface TablaLicitacionesProps {
  titulo: string;
  columnas?: string[];
  filas: Rich[][];
}

export function TablaLicitaciones(props: TablaLicitacionesProps) {
  const cols = props.columnas || ["Lote", "Alcance", "Empresas previstas"];
  return (
    <div className="iq-tlic">
      <table className="iq-tabla iq-tabla-lic">
        <thead>
          <tr>
            <th colSpan={cols.length} className="iq-tlic-titulo">
              {props.titulo}
            </th>
          </tr>
          <tr>
            {cols.map((c, i) => (
              <th key={i}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(props.filas || []).map((f, i) => (
            <tr key={i}>
              {f.map((c, j) => (
                <td key={j}>{rt(c)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export interface TablaMensualProps {
  meses: string[];
  filas: { activo: string; valores: string[]; total: string; vendido?: boolean }[];
  total?: { valores: string[]; total: string };
  etiquetaTotal?: string;
}

export function TablaMensual(props: TablaMensualProps) {
  const meses = props.meses || [];
  return (
    <table className="iq-tabla iq-tabla-mensual">
      <thead>
        <tr>
          <th className="iq-l">Activo</th>
          {meses.map((m, i) => (
            <th key={i}>{m}</th>
          ))}
          <th>{props.etiquetaTotal || "Total"}</th>
        </tr>
      </thead>
      <tbody>
        {(props.filas || []).map((f, i) => (
          <tr key={i} className={f.vendido ? "iq-vendido" : undefined}>
            <td>{f.activo}</td>
            {f.valores.map((v, j) => (
              <td key={j} className="iq-r">
                {v}
              </td>
            ))}
            <td className="iq-r">{f.total}</td>
          </tr>
        ))}
        {props.total ? (
          <tr className="iq-tfin-total">
            <td>TOTAL</td>
            {props.total.valores.map((v, j) => (
              <td key={j} className="iq-r">
                {v}
              </td>
            ))}
            <td className="iq-r">{props.total.total}</td>
          </tr>
        ) : null}
      </tbody>
    </table>
  );
}

const TONOS_DONUT = [
  "var(--navy)",
  "var(--slate-600)",
  "var(--periwinkle)",
  "var(--teal-600)",
  "var(--teal-200)",
  "var(--pearl-300)",
];

export interface DonutOcupacionProps {
  titulo?: string;
  segmentos: { etiqueta: string; valor: number }[];
  tam?: number;
}

export function DonutOcupacion(props: DonutOcupacionProps) {
  const segs = props.segmentos || [];
  const tot = segs.reduce((a, s) => a + s.valor, 0) || 1;
  const r = 42;
  const c = 2 * Math.PI * r;
  // Longitud de cada arco y dónde empieza (suma de los anteriores).
  const arcos = segs.map((s) => (s.valor / tot) * c);
  const inicios = arcos.map((_, i) => arcos.slice(0, i).reduce((a, b) => a + b, 0));
  return (
    <figure className="iq-donut">
      {props.titulo ? <figcaption className="iq-donut-titulo">{props.titulo}</figcaption> : null}
      <svg viewBox="0 0 120 120" width={props.tam || 140} height={props.tam || 140} role="img" aria-label={props.titulo}>
        {segs.map((s, i) => {
          const len = arcos[i]!;
          return (
            <circle
              key={i}
              cx={60}
              cy={60}
              r={r}
              fill="none"
              stroke={TONOS_DONUT[i % TONOS_DONUT.length]}
              strokeWidth={18}
              strokeDasharray={len + " " + (c - len)}
              strokeDashoffset={-inicios[i]!}
              transform="rotate(-90 60 60)"
            />
          );
        })}
      </svg>
      <div className="iq-leyenda iq-leyenda-v">
        {segs.map((s, i) => (
          <span key={i}>
            <i className="iq-sw" style={{ background: TONOS_DONUT[i % TONOS_DONUT.length] }} />
            {s.etiqueta + " · " + Math.round((s.valor / tot) * 100) + " %"}
          </span>
        ))}
      </div>
    </figure>
  );
}
