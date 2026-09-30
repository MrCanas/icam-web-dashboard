import { fmtPct } from "../texto";

function Estrella(p: { llena: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width={22} height={22} aria-hidden>
      <path
        className={p.llena ? "iq-estrella-llena" : "iq-estrella-vacia"}
        d="M12 2.5l2.9 6.2 6.8.8-5 4.6 1.3 6.7L12 17.5l-6 3.3 1.3-6.7-5-4.6 6.8-.8z"
      />
    </svg>
  );
}

export interface BreeamRatingProps {
  estrellas: number;
  calificacion: string;
  rango?: string;
  total?: number;
}

export function BreeamRating(props: BreeamRatingProps) {
  const total = props.total || 5;
  const arr = [];
  for (let i = 0; i < total; i++) arr.push(<Estrella key={i} llena={i < (props.estrellas || 0)} />);
  return (
    <div className="iq-breeam" role="img" aria-label={props.estrellas + " de " + total + " estrellas"}>
      <span className="iq-breeam-estrellas">{arr}</span>
      <span className="iq-breeam-label">
        <b>{props.calificacion}</b>
        {props.rango ? " (" + props.rango + ")" : ""}
      </span>
    </div>
  );
}

export interface BarrasBreeamProps {
  titulo?: string;
  categorias: { nombre: string; objetivo: number; avance?: number }[];
  max?: number;
}

export function BarrasBreeam(props: BarrasBreeamProps) {
  const max =
    props.max ||
    Math.max(...(props.categorias || []).map((c) => Math.max(c.objetivo || 0, c.avance || 0)).concat([1]));
  return (
    <div className="iq-barras">
      {props.titulo ? <div className="iq-barras-titulo">{props.titulo}</div> : null}
      {(props.categorias || []).map((c, i) => (
        <div key={i} className="iq-barras-fila">
          <span className="iq-barras-cat">{c.nombre}</span>
          <span className="iq-barras-pista">
            <span className="iq-barra iq-barra-obj" style={{ width: (c.objetivo / max) * 100 + "%" }} />
            <span className="iq-barra iq-barra-av" style={{ width: ((c.avance || 0) / max) * 100 + "%" }} />
          </span>
          <span className="iq-barras-val">{fmtPct(c.objetivo)}</span>
        </div>
      ))}
      <div className="iq-leyenda">
        <span>
          <i className="iq-sw iq-barra-obj" />
          OBJETIVO
        </span>
        <span>
          <i className="iq-sw iq-barra-av" />
          AVANCE
        </span>
      </div>
    </div>
  );
}

export interface BarraConsolidacionProps {
  segmentos: { etiqueta: string; valor: number; tono?: 0 | 1 | 2 | 3 }[];
}

export function BarraConsolidacion(props: BarraConsolidacionProps) {
  const segs = props.segmentos || [];
  return (
    <div className="iq-consol">
      <div className="iq-consol-barra">
        {segs.map((s, i) => (
          <span key={i} className={"iq-consol-seg iq-tono-" + (s.tono || i)} style={{ width: s.valor + "%" }}>
            {s.valor >= 8 ? fmtPct(s.valor) : ""}
          </span>
        ))}
      </div>
      <div className="iq-leyenda">
        {segs.map((s, i) => (
          <span key={i}>
            <i className={"iq-sw iq-tono-" + (s.tono || i)} />
            {s.etiqueta}
          </span>
        ))}
      </div>
    </div>
  );
}
