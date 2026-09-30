import { assets } from "../assets";
import { cx, rt } from "../texto";
import type { Rich } from "../tipos";
import { ImagenMarco, Logo, Slide } from "./base";

export interface PortadaProps {
  trimestre: string;
  proyecto: string;
  imagen?: string;
  recorte?: "paisaje" | "sobresale";
}

export function Portada(props: PortadaProps) {
  return (
    <Slide fondo="navy" layout="portada">
      <div className="iq-portada-fecha">{props.trimestre}</div>
      <Logo tono="blanco" className="iq-logo-navy" />
      <div className={cx("iq-portada-foto", props.recorte === "sobresale" && "iq-portada-sobresale")}>
        <ImagenMarco src={props.imagen} ancho={390} alto={296} placeholder="Foto de portada aportada por el PM" />
      </div>
      <div className="iq-portada-titulo">INFORME TRIMESTRAL</div>
      <div className="iq-portada-proyecto">{props.proyecto}</div>
    </Slide>
  );
}

function Chevron() {
  return (
    <svg className="iq-chevron" viewBox="0 0 32 32" width={32} height={32} aria-hidden>
      <circle cx={16} cy={16} r={15} className="iq-chevron-aro" />
      <path d="M13 9 L20 16 L13 23" className="iq-chevron-flecha" />
    </svg>
  );
}

export interface IndiceProps {
  secciones: string[];
}

export function Indice(props: IndiceProps) {
  const s = props.secciones || [];
  return (
    <Slide fondo="navy" layout="indice">
      <Logo tono="blanco" className="iq-logo-navy" />
      <ol className="iq-indice">
        {s.map((t, i) => (
          <li key={i} className={i === s.length - 1 ? "iq-indice-ultimo" : undefined}>
            <span className="iq-indice-num">{(i < 9 ? "0" : "") + (i + 1)}</span>
            <span className="iq-indice-label">{t}</span>
            <Chevron />
          </li>
        ))}
      </ol>
      <div className="iq-indice-titulo">ÍNDICE</div>
    </Slide>
  );
}

export const DISCLAIMER: Rich[] = [
  "El presente documento es propiedad de **IMPAR CAPITAL**. Cualquier denominación, diseño, marca y/o logotipos contenidos en el mismo son propiedad intelectual de Impar Capital.",
  "Este documento se limita a describir de forma genérica una oportunidad de inversión y la información contenida es meramente informativa. Por tanto, dicho documento no constituye, bajo ningún concepto, una recomendación, propuesta de inversión o modalidad de asesoramiento análoga alguna para sus destinatarios.",
  "La información contenida en este documento ha sido elaborada sobre la base de condiciones específicas que constituyen premisas o asunciones razonablemente válidas en la fecha de su emisión, de acuerdo con la experiencia de Impar Capital y en cumplimiento de los más altos estándares de cuidado o diligencia. No obstante, dichas condiciones podrían cambiar debido a la incidencia de factores que no dependen de Impar Capital, de modo que éste no garantiza expresa o implícitamente que la información referida sea exacta, completa y/o actualizada en fechas posteriores a aquella en que fue obtenida y/o analizada.",
  "Asimismo, se advierte que este documento podría contener previsiones y/o proyecciones que, por definición, tienen naturaleza incierta. Dichas previsiones responden a expectativas que se han considerado razonables atendiendo a la evolución futura de distintas variables, si bien los resultados reales pueden diferir de dichas expectativas por razón de diversos factores. En particular, y a título meramente enunciativo, tales factores podrían estar relacionados directa o indirectamente con (i) alteraciones macroeconómicas, políticas y/o regulatorias, (ii) variaciones en los mercados, tipos de interés, tipos de cambio u otros riesgos de mercado, (iii) condiciones específicas de la financiación concedida a fin de acometer las inversiones descritas, (iv) plazos de concesión de las licencias, autorizaciones o permisos necesarios por parte de los organismos públicos competentes, (v) costes de construcción, precios de venta, ritmos de comercialización o circunstancias análogas propias del sector o, incluso, (vi) perturbaciones económicas impredecibles a nivel global y/o local (tanto derivadas de factores o circunstancias puramente económicas, como de cualquier otro tipo -como pandemias, catástrofes naturales y/o cualesquiera otras causas de fuerza mayor-), que puedan producirse en el futuro.",
  "El inversor o potencial inversor que tenga acceso a este documento debe ser plenamente consciente de que se trata de un producto complejo, no adecuado para todos los clientes y, cuya rentabilidad es variable pudiendo llegar a perder la totalidad del capital invertido ya que éste no está garantizado. Antes de realizar cualquier inversión debe ser consciente de que se trata de un producto destinado a inversores profesionales que puedan mantener la inversión durante toda la vida del vehículo. Antes de adoptar cualquier decisión de inversión debe tener en cuenta sus circunstancias personales y recurrir, si fuera necesario, a asesoramiento profesional independiente sobre las implicaciones financieras, legales, regulatorias y/o fiscales asociadas a dichas inversiones.",
  "En el supuesto de acometerse las inversiones referidas en este documento, los destinatarios de éste deben ser igualmente conscientes de que dichas inversiones tienen asociados determinados riesgos financieros que deben analizarse o valorarse de forma personalizada antes de formalizar dichas inversiones. En particular, y a título meramente enunciativo, las inversiones podrían presentar (i) riesgos de obtener una rentabilidad inferior a la esperada o de perder todo el capital invertido, (ii) riesgos de iliquidez derivados del desfase entre la fecha real y deseada de la liquidación de la inversión, (iii) riesgos ligados a la transmisibilidad de las acciones o participaciones sociales adquiridas a los efectos de articular las inversiones, (iv) riesgos de dilución, (v) riesgos de no recibir dividendos o (vi) riesgos de no poder influir en la gestión de las sociedades en las que se materialicen las inversiones.",
  "La información contenida en este documento se facilita única y exclusivamente al receptor de este documento, y con el propósito para el que ha sido elaborado. Dicha información tiene carácter confidencial y, en consecuencia, no puede ser parcial o completamente (i) copiada o duplicada en ningún medio o soporte, (ii) redistribuida, citada, divulgada o comunicada ni (iii) entregada a ninguna otra persona o entidad sin la autorización previa y por escrito de Impar Capital.",
  "En ningún caso, Impar Capital, sus administradores, directivos, empleados y/o personal autorizado asumen responsabilidad alguna en relación con cualquier perjuicio, pérdida, reclamación o gastos de ningún tipo que pueda derivar del uso de este documento o de su contenido, y en particular, de la confianza que los inversores o potenciales inversores depositen o puedan depositar en el mismo.",
  "Impar Capital declina expresamente cualquier responsabilidad por error u omisión en la información contenida en este documento.",
  "Los destinatarios de este documento aceptan en su integridad todas las advertencias expresadas anteriormente mediante la mera recepción de este.",
];

export interface DisclaimerProps {
  pagina?: number;
  parrafos?: Rich[];
}

export function Disclaimer(props: DisclaimerProps) {
  return (
    <Slide fondo="pearl" layout="disclaimer" pagina={props.pagina}>
      <h1 className="iq-disclaimer-titulo">DISCLAIMER</h1>
      <Logo tono="azul" className="iq-header-logo" />
      <div className="iq-disclaimer-texto">
        {(props.parrafos || DISCLAIMER).map((t, i) => (
          <p key={i}>{rt(t)}</p>
        ))}
      </div>
    </Slide>
  );
}

export function Cierre() {
  return (
    <Slide fondo="navy" layout="cierre">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="iq-cierre-fondo" src={assets.cierreMosaico} alt="" />
      <Logo tono="blanco" className="iq-cierre-logo" />
    </Slide>
  );
}
