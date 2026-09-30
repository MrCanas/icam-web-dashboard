"use client";

import Link from "next/link";
import { useCallback, useMemo, useRef, useState } from "react";

import { accionActualizarInforme } from "../actions/informes";
import type { CambiosInforme } from "../data/informesRepository";
import type { EntradaBiblioteca } from "../logic/biblioteca";
import { rutaListaInformes } from "../logic/paths";
import type { Foto, Fuente, Informe, PrevioEstructurado, ResumenUso } from "../types";
import { Aviso, Pasos } from "./componentes";
import { PasoBiblioteca } from "./asistente/PasoBiblioteca";
import { PasoFuentes } from "./asistente/PasoFuentes";
import { PasoPrevio } from "./asistente/PasoPrevio";
import { Editor } from "./editor/Editor";
import { VistaGenerando } from "./generacion/VistaGenerando";

export type Vista = "paso1" | "paso2" | "paso3" | "generando" | "editor";

export interface HerramientaInforme {
  informe: Informe;
  fuentes: Fuente[];
  fotos: Foto[];
  previo: PrevioEstructurado | null;
  biblioteca: EntradaBiblioteca[];
  puedeEditar: boolean;
  setFuentes: (f: Fuente[] | ((x: Fuente[]) => Fuente[])) => void;
  setFotos: (f: Foto[] | ((x: Foto[]) => Foto[])) => void;
  /** Aplica los cambios en local y los guarda (en cola: una escritura cada vez). */
  guardar: (cambios: CambiosInforme, cambio?: string) => Promise<boolean>;
  ir: (v: Vista) => void;
  avisar: (texto: string | null, tipo?: "aviso" | "error" | "ok") => void;
}

interface Props {
  informe: Informe;
  fuentes: Fuente[];
  fotos: Foto[];
  previo: PrevioEstructurado | null;
  biblioteca: EntradaBiblioteca[];
  puedeEditar: boolean;
  existia: boolean;
  uso: ResumenUso | null;
}

function vistaInicial(i: Informe): Vista {
  switch (i.estado) {
    case "datos":
      return "paso1";
    case "fuentes":
      return "paso2";
    case "analizado":
    case "generando":
      return "paso3";
    default:
      return "editor";
  }
}

/** Herramienta del informe: asistente (pasos 1–3), generación y editor, según el estado. */
export function InformeApp(props: Props) {
  const [informe, setInforme] = useState(props.informe);
  const [fuentes, setFuentes] = useState(props.fuentes);
  const [fotos, setFotos] = useState(props.fotos);
  const [vista, setVista] = useState<Vista>(() => vistaInicial(props.informe));
  const [mensaje, setMensaje] = useState<{ texto: string; tipo: "aviso" | "error" | "ok" } | null>(() =>
    props.existia
      ? { texto: `Ya existía el informe ${props.informe.proyecto.nombre} ${props.informe.trimestre}: se ha abierto donde se quedó.`, tipo: "ok" }
      : props.informe.estado === "generando"
        ? { texto: "La generación anterior no terminó. Pulsa GO para reanudarla: las slides ya redactadas se conservan.", tipo: "aviso" }
        : null,
  );
  const [estadoGuardado, setEstadoGuardado] = useState<string>("");
  const cola = useRef<Promise<unknown>>(Promise.resolve());

  const guardar = useCallback(
    (cambios: CambiosInforme, cambio?: string) => {
      setInforme((i) => ({ ...i, ...cambios }) as Informe);
      const id = props.informe.id;
      const p = cola.current.then(async () => {
        try {
          const r = await accionActualizarInforme(id, cambios, cambio);
          if (!r.ok) {
            setEstadoGuardado(`No se ha podido guardar: ${r.error}`);
            return false;
          }
          setEstadoGuardado(`Guardado · ${new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}`);
          setInforme((i) => ({ ...i, actualizado: r.data.actualizado }));
          return true;
        } catch (e) {
          setEstadoGuardado(`No se ha podido guardar (${e instanceof Error ? e.message : "error"}). Revisa la conexión.`);
          return false;
        }
      });
      cola.current = p;
      return p as Promise<boolean>;
    },
    [props.informe.id],
  );

  const avisar = useCallback((texto: string | null, tipo: "aviso" | "error" | "ok" = "aviso") => {
    setMensaje(texto ? { texto, tipo } : null);
    if (texto && tipo === "error") window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const ir = useCallback((v: Vista) => {
    setVista(v);
    setMensaje(null);
    window.scrollTo(0, 0);
  }, []);

  const h: HerramientaInforme = useMemo(
    () => ({
      informe,
      fuentes,
      fotos,
      previo: props.previo,
      biblioteca: props.biblioteca,
      puedeEditar: props.puedeEditar,
      setFuentes,
      setFotos,
      guardar,
      ir,
      avisar,
    }),
    [informe, fuentes, fotos, props.previo, props.biblioteca, props.puedeEditar, guardar, ir, avisar],
  );

  const paso = vista === "paso1" ? 1 : vista === "paso2" ? 2 : vista === "paso3" ? 3 : null;

  return (
    <div className="space-y-4 min-w-0">
      {vista !== "editor" ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-xl font-semibold text-text-primary">
            {informe.proyecto.nombre} · {informe.trimestre}
          </h1>
          <div className="flex items-center gap-3">
            <span className="text-xs text-text-muted" aria-live="polite">
              {estadoGuardado}
            </span>
            <Link href={rutaListaInformes()} className="text-sm font-medium text-icam-900 hover:underline">
              Volver a la lista
            </Link>
          </div>
        </div>
      ) : null}
      {paso != null ? <Pasos actual={paso} /> : null}
      {!props.puedeEditar ? (
        <Aviso>Tu acceso a Proyectos es de lectura: puedes consultar este informe, pero no generarlo ni corregirlo.</Aviso>
      ) : null}
      {mensaje ? <Aviso tipo={mensaje.tipo}>{mensaje.texto}</Aviso> : null}

      {vista === "paso1" ? <PasoPrevio h={h} /> : null}
      {vista === "paso2" ? <PasoFuentes h={h} /> : null}
      {vista === "paso3" ? <PasoBiblioteca h={h} /> : null}
      {vista === "generando" ? <VistaGenerando h={h} /> : null}
      {vista === "editor" ? <Editor h={h} estadoGuardado={estadoGuardado} usoInicial={props.uso} /> : null}
    </div>
  );
}
