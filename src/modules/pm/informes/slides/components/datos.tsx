import { Fragment } from "react";

import { cx, rt } from "../texto";
import type { Rich } from "../tipos";
import { Contenido, ImagenMarco, Slide, SlideHeader, Subtitulo, Texto, Vinetas, type Imagen, type SlideBase } from "./base";

export interface FilaKpi {
  indicador: string;
  actual: string;
  objetivo: Rich;
}

export interface TablaKpisProps {
  trimestre: string;
  siguiente: string;
  cabeceraObjetivo?: string;
  filas: FilaKpi[];
}

export function TablaKpis(props: TablaKpisProps) {
  return (
    <table className="iq-tabla iq-tabla-rayada">
      <colgroup>
        <col style={{ width: "27%" }} />
        <col style={{ width: "17%" }} />
        <col />
      </colgroup>
      <thead>
        <tr>
          <th>Indicador</th>
          <th>{"Estado actual (" + props.trimestre + ")"}</th>
          <th>{(props.cabeceraObjetivo || "Objetivo") + " (" + props.siguiente + ")"}</th>
        </tr>
      </thead>
      <tbody>
        {(props.filas || []).map((f, i) => (
          <tr key={i}>
            <td>{f.indicador}</td>
            <td className="iq-c">{f.actual}</td>
            <td>{rt(f.objetivo)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export interface FilaRiesgo {
  riesgo: Rich;
  mitigacion: Rich;
}

export interface TablaRiesgosProps {
  filas: FilaRiesgo[];
}

export function TablaRiesgos(props: TablaRiesgosProps) {
  return (
    <table className="iq-tabla iq-tabla-rayada">
      <colgroup>
        <col style={{ width: "42%" }} />
        <col />
      </colgroup>
      <thead>
        <tr>
          <th>Riesgo identificado</th>
          <th>Mitigación</th>
        </tr>
      </thead>
      <tbody>
        {(props.filas || []).map((f, i) => (
          <tr key={i}>
            <td>{rt(f.riesgo)}</td>
            <td>{rt(f.mitigacion)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export interface ListaObjetivosProps {
  trimestre: string;
  items: Rich[];
}

export function ListaObjetivos(props: ListaObjetivosProps) {
  return (
    <div className="iq-objetivos">
      <Subtitulo>{"OBJETIVOS " + props.trimestre}</Subtitulo>
      <Vinetas items={props.items} compacta />
    </div>
  );
}

export interface SlideKpisRiesgosObjetivosProps extends SlideBase {
  trimestre: string;
  siguiente: string;
  kpis: FilaKpi[];
  riesgos: FilaRiesgo[];
  objetivos: Rich[];
  cabeceraObjetivo?: string;
  seccion?: number;
}

export function SlideKpisRiesgosObjetivos(props: SlideKpisRiesgosObjetivosProps) {
  return (
    <Slide layout="kpis-riesgos-objetivos" pie={props.pie} pagina={props.pagina}>
      <SlideHeader
        seccion={props.seccion || 3}
        titulo={"Resumen de Proyecto. KPIs, Riesgos y Mitigaciones & Objetivos " + props.siguiente}
      />
      <Contenido className="iq-apilado">
        <Subtitulo>INDICADORES CLAVE (KPIs)</Subtitulo>
        <TablaKpis
          trimestre={props.trimestre}
          siguiente={props.siguiente}
          filas={props.kpis}
          cabeceraObjetivo={props.cabeceraObjetivo}
        />
        <Subtitulo>RIESGOS Y MITIGACIONES</Subtitulo>
        <TablaRiesgos filas={props.riesgos} />
        <ListaObjetivos trimestre={props.siguiente} items={props.objetivos} />
      </Contenido>
    </Slide>
  );
}

export interface TimelineProps {
  hitos: { titulo: string; fecha: string; hecho: boolean }[];
  puntoSituacion?: number | false;
  variante?: "slate" | "teal";
  ancho?: number;
  nota?: Rich;
}

export function Timeline(props: TimelineProps) {
  const hitos = props.hitos || [];
  const n = hitos.length;
  const ancho = props.ancho || 760;
  const paso = n > 1 ? (ancho - 80) / (n - 1) : 0;
  const x0 = 40;
  const y = 92;
  const hechos = hitos.filter((m) => m.hecho).length;
  const punto = props.puntoSituacion != null ? (props.puntoSituacion as number) : hechos - 0.5;
  const xPunto = x0 + punto * paso;
  return (
    // Con nota, el calendario ocupa sus 170 px y la nota va debajo, en el flujo (como en TextoImagen o
    // VehiculoInversion). Antes iba con la clase .iq-nota, cuyo `top: 488px` la sacaba de la slide: no se veía.
    <div
      className={cx("iq-timeline", "iq-timeline-" + (props.variante || "slate"))}
      style={props.nota ? { width: ancho, paddingTop: 170 } : { width: ancho, height: 170 }}
    >
      <div className="iq-tl-linea iq-tl-pend" style={{ left: x0, width: ancho - 80, top: y - 1.5 }} />
      {hechos ? (
        <div className="iq-tl-linea iq-tl-hecha" style={{ left: x0, width: Math.max(0, xPunto - x0), top: y - 1.5 }} />
      ) : null}
      {hitos.map((m, i) => {
        const x = x0 + i * paso;
        const arriba = i % 2 === 0;
        return (
          <Fragment key={i}>
            <div className={cx("iq-tl-nodo", m.hecho ? "iq-tl-nodo-hecho" : "iq-tl-nodo-pend")} style={{ left: x, top: y }} />
            <div
              className={cx("iq-tl-tallo", m.hecho ? "iq-tl-tallo-hecho" : "iq-tl-tallo-pend")}
              style={{ left: x, top: arriba ? y - 58 : y + 12, height: 46 }}
            />
            <div
              className={cx("iq-tl-etiqueta", m.hecho ? "iq-tl-hecho" : "iq-tl-pend-txt")}
              style={{ left: x + 6, top: arriba ? y - 64 : y + 22 }}
            >
              <span className="iq-tl-num">{i + 1}</span>
              <span className="iq-tl-texto">
                {m.titulo}
                <br />
                <b>{m.fecha}</b>
              </span>
            </div>
          </Fragment>
        );
      })}
      {props.puntoSituacion !== false && n ? (
        <>
          <div className="iq-tl-punto" style={{ left: xPunto, top: y + 4 }} />
          <div className="iq-tl-punto-label" style={{ left: xPunto + 6, top: y + 72 }}>
            Punto de situación
          </div>
        </>
      ) : null}
      {props.nota ? <div className="iq-nota-inline">{rt(props.nota)}</div> : null}
    </div>
  );
}

export interface HitosResenablesProps {
  intro?: string;
  items: { etiqueta: string; fecha: string }[];
}

export function HitosResenables(props: HitosResenablesProps) {
  return (
    <div className="iq-hitos">
      <Subtitulo nivel={2}>Hitos reseñables</Subtitulo>
      {props.intro ? <Texto parrafos={[props.intro]} /> : null}
      <Vinetas items={(props.items || []).map((it) => "**" + it.etiqueta + "**: " + it.fecha)} compacta />
    </div>
  );
}

export interface TimelineTrimestralProps {
  trimestres: {
    nombre: string;
    estado: "pasado" | "actual" | "futuro";
    eventos: { fecha: string; texto: string }[];
  }[];
}

export function TimelineTrimestral(props: TimelineTrimestralProps) {
  const tr = props.trimestres || [];
  return (
    <div className="iq-tlq">
      <div className="iq-tlq-linea" />
      <div className="iq-tlq-grupos">
        {tr.map((q, qi) => (
          <div key={qi} className={cx("iq-tlq-grupo", "iq-tlq-" + (q.estado || "futuro"))}>
            <div className="iq-tlq-eventos">
              {(q.eventos || []).map((e, i) => (
                <div key={i} className={cx("iq-tlq-evento", i % 2 ? "iq-tlq-abajo" : "iq-tlq-arriba")}>
                  <b>{e.fecha}</b>
                  <span>{e.texto}</span>
                </div>
              ))}
            </div>
            <div className="iq-tlq-llave" />
            <div className="iq-tlq-nombre">{q.nombre}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

const DISPOSICIONES: Record<string, [number, number][]> = {
  "1": [[600, 330]],
  "2": [
    [420, 300],
    [420, 300],
  ],
  "3": [
    [280, 260],
    [280, 260],
    [280, 260],
  ],
  "4": [
    [420, 170],
    [420, 170],
    [420, 170],
    [420, 170],
  ],
  "hero-2": [
    [540, 350],
    [300, 170],
    [300, 170],
  ],
};

export interface GaleriaProps {
  imagenes?: Imagen[];
  disposicion?: "1" | "2" | "3" | "4" | "hero-2";
  escala?: number;
  ancho?: number;
}

export function Galeria(props: GaleriaProps) {
  const d = props.disposicion || "4";
  const tam = DISPOSICIONES[d] || DISPOSICIONES["4"]!;
  const imgs = props.imagenes || [];
  return (
    <div className={cx("iq-galeria", "iq-galeria-" + d)} style={props.ancho ? { width: props.ancho } : undefined}>
      {tam.map((t, i) => (
        <ImagenMarco
          key={i}
          ancho={props.escala ? t[0] * props.escala : t[0]}
          alto={props.escala ? t[1] * props.escala : t[1]}
          {...(imgs[i] || {})}
        />
      ))}
    </div>
  );
}
