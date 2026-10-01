import { icono } from "../assets";
import { rt } from "../texto";
import type { Rich } from "../tipos";
import { Contenido, Slide, SlideHeader, Subtitulo, Texto, Vinetas, type SlideBase } from "./base";

interface Rol {
  rol: string;
  parrafos?: Rich[];
  vinetas?: Rich[];
}

export interface ColaboradoresProps extends SlideBase {
  intro?: Rich;
  roles: Rol[];
  logos?: { src?: string; nombre?: string; pie?: string }[];
  seccion?: number;
}

export function Colaboradores(props: ColaboradoresProps) {
  const roles = props.roles || [];
  const mitad = Math.ceil(roles.length / 2);
  const col = (rs: Rol[]) =>
    rs.map((r, i) => (
      <div key={i} className="iq-colab-rol">
        <Subtitulo>{r.rol}</Subtitulo>
        {r.parrafos ? <Texto parrafos={r.parrafos} /> : null}
        {r.vinetas ? <Vinetas items={r.vinetas} compacta /> : null}
      </div>
    ));
  return (
    <Slide layout="colaboradores" pie={props.pie} pagina={props.pagina}>
      <SlideHeader seccion={props.seccion || 5} titulo="Colaboradores" />
      <Contenido>
        {props.intro ? <Texto parrafos={[props.intro]} /> : null}
        <div className="iq-cols">
          <div>{col(roles.slice(0, mitad))}</div>
          <div>{col(roles.slice(mitad))}</div>
        </div>
      </Contenido>
      <LogosColaboradores logos={props.logos} />
    </Slide>
  );
}

export interface LogosColaboradoresProps {
  logos?: { src?: string; nombre?: string; pie?: string }[];
}

/** Franja de logos de la slide de colaboradores (va fuera del área de contenido, al pie). */
export function LogosColaboradores(props: LogosColaboradoresProps) {
  return (
    <div className="iq-colab-logos">
      {(props.logos || []).map((l, i) => (
        <figure key={i} className="iq-colab-logo">
          {l.src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={l.src} alt={l.nombre || ""} />
          ) : (
            <div className="iq-ph iq-ph-logo">
              <span>{l.nombre || "Logo"}</span>
            </div>
          )}
          {l.pie ? <figcaption>{l.pie}</figcaption> : null}
        </figure>
      ))}
    </div>
  );
}

export interface VehiculoInversionProps extends SlideBase {
  titulo?: string;
  detalles: Rich[];
  fichas: { icono: string; etiqueta: string; valor: string }[];
  nota?: Rich;
  seccion?: number;
}

export function VehiculoInversion(props: VehiculoInversionProps) {
  return (
    <Slide layout="vehiculo" pie={props.pie} pagina={props.pagina}>
      <SlideHeader seccion={props.seccion || 6} titulo={props.titulo || "Vehículo de inversión. Detalles"} />
      <Contenido>
        <Subtitulo>DETALLES DEL VEHÍCULO DE INVERSIÓN</Subtitulo>
        <Vinetas items={props.detalles} />
        <FichasVehiculo fichas={props.fichas} />
        {props.nota ? <div className="iq-nota-inline">{rt(props.nota)}</div> : null}
      </Contenido>
    </Slide>
  );
}

export interface FichasVehiculoProps {
  fichas: { icono: string; etiqueta: string; valor: string }[];
}

/** Fila de fichas con icono de la slide del vehículo de inversión. */
export function FichasVehiculo(props: FichasVehiculoProps) {
  return (
    <div className="iq-fichas">
      {(props.fichas || []).map((f, i) => (
        <div key={i} className="iq-ficha">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={icono(f.icono)} alt="" />
          <div className="iq-ficha-label">{f.etiqueta}</div>
          <div className="iq-ficha-valor">{f.valor}</div>
        </div>
      ))}
    </div>
  );
}

export interface ConsejoAdministracionProps {
  titulo: string;
  intro?: string;
  puntos: Rich[];
}

export function ConsejoAdministracion(props: ConsejoAdministracionProps) {
  return (
    <div className="iq-consejo">
      <Subtitulo>{props.titulo}</Subtitulo>
      {props.intro ? <Texto parrafos={[props.intro]} /> : null}
      <ol className="iq-consejo-lista">
        {(props.puntos || []).map((p, i) => (
          <li key={i}>{rt(p)}</li>
        ))}
      </ol>
    </div>
  );
}
