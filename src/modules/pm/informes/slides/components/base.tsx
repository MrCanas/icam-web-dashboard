import type { CSSProperties, ReactNode } from "react";

import { assets } from "../assets";
import { cx, partirTitulo, rt, textoPie } from "../texto";
import type { Pie, Rich } from "../tipos";

export interface SlideBase {
  pie?: Pie;
  pagina?: number;
}

export interface Imagen {
  src?: string;
  pie?: string;
  alt?: string;
  focalX?: number;
  focalY?: number;
  placeholder?: string;
  style?: CSSProperties;
}

export function PieConfidencial(props: Pie) {
  return <div className="iq-pie">{textoPie(props)}</div>;
}

export interface LogoProps {
  tono?: "azul" | "blanco";
  className?: string;
  style?: CSSProperties;
}

export function Logo(props: LogoProps) {
  const tono = props.tono || "azul";
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className={cx("iq-logo", props.className)}
      src={tono === "blanco" ? assets.logoBlanco : assets.logoAzul}
      alt="Impar Capital"
      style={props.style}
    />
  );
}

export interface SlideProps extends SlideBase {
  fondo?: "paper" | "navy" | "warm" | "pearl";
  layout?: string;
  className?: string;
  children?: ReactNode;
}

export function Slide(props: SlideProps) {
  const fondo = props.fondo || "paper";
  return (
    <section className={cx("iq-slide", "iq-fondo-" + fondo, props.className)} data-layout={props.layout}>
      {props.children}
      {props.pie && fondo === "paper" ? <PieConfidencial {...props.pie} /> : null}
      {props.pagina != null ? <div className="iq-pagina">{props.pagina}</div> : null}
    </section>
  );
}

export interface SlideHeaderProps {
  seccion?: number;
  titulo: string;
  subtitulo?: string;
  logo?: boolean;
}

export function SlideHeader(props: SlideHeaderProps) {
  const p = partirTitulo(props.titulo, props.subtitulo);
  return (
    <header className={cx("iq-header", p[1] && "iq-header-sub")}>
      <h1 className="iq-titulo">
        {props.seccion != null ? <span className="iq-seccion">{props.seccion}</span> : null}
        <span className="iq-titulo-linea">
          {p[0]}
          {p[1] ? <span className="iq-titulo-sub">{p[1]}</span> : null}
        </span>
      </h1>
      {props.logo === false ? null : <Logo tono="azul" className="iq-header-logo" />}
    </header>
  );
}

export interface ContenidoProps {
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}

export function Contenido(props: ContenidoProps) {
  return (
    <div className={cx("iq-contenido", props.className)} style={props.style}>
      {props.children}
    </div>
  );
}

export interface SubtituloProps {
  nivel?: 1 | 2;
  children: ReactNode;
}

export function Subtitulo(props: SubtituloProps) {
  const Etiqueta = props.nivel === 2 ? "h3" : "h2";
  return <Etiqueta className={props.nivel === 2 ? "iq-sub2" : "iq-sub"}>{props.children}</Etiqueta>;
}

export interface TextoProps {
  parrafos?: Rich[];
  children?: ReactNode;
}

export function Texto(props: TextoProps) {
  const p = props.parrafos || (props.children != null ? [props.children] : []);
  return (
    <div className="iq-texto">
      {p.map((t, i) => (
        <p key={i}>{rt(t)}</p>
      ))}
    </div>
  );
}

export interface VinetasProps {
  items: Rich[];
  compacta?: boolean;
}

export function Vinetas(props: VinetasProps) {
  return (
    <ul className={cx("iq-vinetas", props.compacta && "iq-vinetas-compacta")}>
      {(props.items || []).map((t, i) => (
        <li key={i}>{rt(t)}</li>
      ))}
    </ul>
  );
}

export interface ImagenMarcoProps extends Imagen {
  ancho: number;
  alto: number;
}

export function ImagenMarco(props: ImagenMarcoProps) {
  const style: CSSProperties = Object.assign({ width: props.ancho, height: props.alto }, props.style);
  return (
    <figure className="iq-figura" style={{ width: props.ancho }}>
      {props.src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className="iq-img"
          src={props.src}
          alt={props.alt || props.pie || ""}
          style={Object.assign(
            {
              objectPosition:
                (props.focalX != null ? props.focalX * 100 : 50) + "% " + (props.focalY != null ? props.focalY * 100 : 50) + "%",
            },
            style,
          )}
        />
      ) : (
        <div className="iq-ph" style={style}>
          <span>{props.placeholder || "Foto aportada por el PM"}</span>
        </div>
      )}
      {props.pie ? <figcaption className="iq-pie-foto">{props.pie}</figcaption> : null}
    </figure>
  );
}
