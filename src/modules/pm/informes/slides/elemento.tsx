import { createElement, type ReactNode } from "react";

import { componente, ETIQUETAS_HTML } from "./components";
import { Contenido, Slide, SlideHeader } from "./components/base";
import { rt } from "./texto";
import type { MetaInforme, NodoJson, SlideJson } from "./tipos";

/**
 * informe.json → elementos React. Port de `elemento()` de templates/motor.js:
 * misma resolución de nodos, mismo reparto de pie legal y número de página.
 */

/** Componentes que reciben pie legal y número de página. */
const CON_PIE = new Set([
  "Slide",
  "ResumenEjecutivo",
  "DosColumnas",
  "TextoImagen",
  "SlideKpisRiesgosObjetivos",
  "Colaboradores",
  "VehiculoInversion",
  "SlideBloqueado",
]);
const SOLO_PAGINA = new Set(["Disclaimer"]);
const HTML = new Set<string>(ETIQUETAS_HTML);

type ObjetoNodo = { c?: string; props?: Record<string, unknown>; hijos?: NodoJson[] };

function esObjeto(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

/** Nodo: texto | {c, props, hijos}. Cualquier valor de props con forma de nodo se convierte en elemento. */
function nodo(n: unknown, key?: number): ReactNode {
  if (n == null || typeof n !== "object") return n as ReactNode;
  if (Array.isArray(n)) return n.map((x, i) => nodo(x, i));
  const o = n as ObjetoNodo;
  if (!o.c) return valor(o) as ReactNode;
  const comp = HTML.has(o.c) ? o.c : componente(o.c);
  if (!comp) throw new Error("Componente desconocido: " + o.c);
  const props = valor(o.props || {}) as Record<string, unknown>;
  props.key = key;
  const hijos = (o.hijos || []).map((x, i) => nodo(x, i));
  return createElement(comp, props, ...hijos);
}

function valor(v: unknown): unknown {
  if (Array.isArray(v)) return v.map((x, i) => (esObjeto(x) && x.c ? nodo(x, i) : valor(x)));
  if (esObjeto(v)) {
    if (v.c) return nodo(v);
    const o: Record<string, unknown> = {};
    Object.keys(v).forEach((k) => {
      o[k] = valor(v[k]);
    });
    return o;
  }
  return v;
}

export function elemento(s: SlideJson, pagina: number, meta: MetaInforme | null | undefined): ReactNode {
  const pie = meta?.pie;
  if (s.compuesto) {
    const c = s.compuesto;
    return (
      <Slide pie={pie} pagina={pagina} layout={c.layout}>
        <SlideHeader seccion={c.seccion} titulo={c.titulo ?? ""} />
        <Contenido className={c.clase} style={c.estilo as React.CSSProperties | undefined}>
          {(c.contenido || []).map((x, i) => nodo(x, i))}
        </Contenido>
        {c.nota ? <div className="iq-nota">{rt(c.nota)}</div> : null}
      </Slide>
    );
  }
  const comp = s.c ? componente(s.c) : null;
  if (!comp || !s.c) throw new Error("Componente desconocido: " + s.c);
  const props = valor(s.props || {}) as Record<string, unknown>;
  if (CON_PIE.has(s.c)) {
    if (props.pie === undefined) props.pie = pie;
    props.pagina = pagina;
  }
  if (SOLO_PAGINA.has(s.c)) props.pagina = pagina;
  const hijos = (s.hijos || []).map((x, i) => nodo(x, i));
  return createElement(comp, props, ...hijos);
}
