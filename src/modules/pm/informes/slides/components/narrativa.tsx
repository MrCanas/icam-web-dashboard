import type { ReactNode } from "react";

import { icono } from "../assets";
import { rt } from "../texto";
import type { Rich } from "../tipos";
import { Contenido, ImagenMarco, Slide, SlideHeader, Subtitulo, Texto, Vinetas, type Imagen, type SlideBase } from "./base";

export interface BloqueIconoProps {
  icono?: "situacion-actual" | "compraventa-financiacion" | "operacion-cronograma" | "logros" | (string & {});
  titulo: string;
  parrafos?: Rich[];
  vinetas?: Rich[];
  children?: ReactNode;
}

export function BloqueIcono(props: BloqueIconoProps) {
  return (
    <div className="iq-bloque-icono">
      {props.icono ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="iq-bloque-icono-img" src={icono(props.icono)} alt="" />
      ) : (
        <span className="iq-bloque-icono-img" />
      )}
      <div className="iq-bloque-icono-cuerpo">
        <Subtitulo>{props.titulo}</Subtitulo>
        {props.parrafos ? <Texto parrafos={props.parrafos} /> : null}
        {props.vinetas ? <Vinetas items={props.vinetas} /> : null}
        {props.children}
      </div>
    </div>
  );
}

function columnaBloques(bloques: BloqueIconoProps[] | undefined) {
  return (bloques || []).map((b, i) => <BloqueIcono key={i} {...b} />);
}

export interface ResumenEjecutivoProps extends SlideBase {
  trimestre: string;
  izquierda: BloqueIconoProps[];
  logros: Rich[];
  derecha?: BloqueIconoProps[];
  seccion?: number;
}

export function ResumenEjecutivo(props: ResumenEjecutivoProps) {
  const logros: BloqueIconoProps = { icono: "logros", titulo: "LOGROS " + (props.trimestre || ""), vinetas: props.logros };
  const der = [logros].concat(props.derecha || []);
  return (
    <Slide layout="resumen-ejecutivo" pie={props.pie} pagina={props.pagina}>
      <SlideHeader seccion={props.seccion || 1} titulo={"Resumen Ejecutivo del Proyecto. " + (props.trimestre || "")} />
      <Contenido className="iq-cols">
        <div>{columnaBloques(props.izquierda)}</div>
        <div>{columnaBloques(der)}</div>
      </Contenido>
    </Slide>
  );
}

export interface AntecedentesNovedadesProps {
  titulo?: string;
  anterior: { trimestre: string; parrafos: Rich[] };
  actual: { trimestre: string; parrafos: Rich[]; vinetas?: Rich[] };
}

export function AntecedentesNovedades(props: AntecedentesNovedadesProps) {
  return (
    <div className="iq-antecedentes">
      {props.titulo ? <Subtitulo>{props.titulo}</Subtitulo> : null}
      <Subtitulo nivel={2}>{"Antecedentes. " + props.anterior.trimestre}</Subtitulo>
      <Texto parrafos={props.anterior.parrafos} />
      <Subtitulo nivel={2}>{"Novedades. " + props.actual.trimestre}</Subtitulo>
      <Texto parrafos={props.actual.parrafos} />
      {props.actual.vinetas ? <Vinetas items={props.actual.vinetas} /> : null}
    </div>
  );
}

export interface DosColumnasProps extends SlideBase {
  seccion: number;
  titulo: string;
  izquierda: ReactNode;
  derecha: ReactNode;
  nota?: Rich;
}

export function DosColumnas(props: DosColumnasProps) {
  return (
    <Slide layout="dos-columnas" pie={props.pie} pagina={props.pagina}>
      <SlideHeader seccion={props.seccion} titulo={props.titulo} />
      <Contenido className="iq-cols">
        <div>{props.izquierda}</div>
        <div>{props.derecha}</div>
      </Contenido>
      {props.nota ? <div className="iq-nota">{rt(props.nota)}</div> : null}
    </Slide>
  );
}

export interface TextoImagenProps extends SlideBase {
  seccion: number;
  titulo: string;
  subtitulo?: string;
  parrafos: Rich[];
  imagenes?: Imagen[];
  variante?: "una" | "dos-apiladas";
  nota?: Rich;
}

export function TextoImagen(props: TextoImagenProps) {
  const imgs = props.imagenes || [{}];
  const apiladas = props.variante === "dos-apiladas";
  return (
    <Slide layout="texto-imagen" pie={props.pie} pagina={props.pagina}>
      <SlideHeader seccion={props.seccion} titulo={props.titulo} />
      <Contenido className="iq-cols">
        <div>
          {props.subtitulo ? <Subtitulo>{props.subtitulo}</Subtitulo> : null}
          <Texto parrafos={props.parrafos} />
          {props.nota ? <div className="iq-nota-inline">{rt(props.nota)}</div> : null}
        </div>
        <div className="iq-imagenes-col">
          {(apiladas ? imgs.slice(0, 2) : imgs.slice(0, 1)).map((im, i) => (
            <ImagenMarco key={i} ancho={348} alto={apiladas ? 180 : 290} {...im} />
          ))}
        </div>
      </Contenido>
    </Slide>
  );
}

export interface MapaLateralProps {
  mapa?: string;
  pin?: string;
  rotulo: string;
  foto?: string;
}

export function MapaLateral(props: MapaLateralProps) {
  return (
    <aside className="iq-mapa-lateral">
      <ImagenMarco src={props.mapa} ancho={262} alto={176} placeholder="Mapa de ubicación" />
      {props.pin ? <div className="iq-mapa-pin-label">{props.pin}</div> : null}
      <div className="iq-regla-oro" />
      <div className="iq-mapa-rotulo">{props.rotulo}</div>
      <ImagenMarco src={props.foto} ancho={270} alto={172} />
    </aside>
  );
}
