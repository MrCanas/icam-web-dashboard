import Link from "next/link";
import type { ReactNode } from "react";

import { Ayuda } from "@/components/ui/Ayuda";
import { Icono } from "@/components/ui/Icono";
import { COMUNICACIONES_PATH } from "@/modules/comunicaciones/logic/paths";

/** El contenedor con scroll del asistente: al cambiar de paso se vuelve arriba. */
export const ID_CUERPO_DEL_ASISTENTE = "asistente-cuerpo";

/**
 * El marco del asistente: una pantalla propia que tapa la cabecera y el pie
 * del portal mientras se prepara un envío, para que solo se vea el paso en
 * curso. Es una página normal (tiene URL y se recarga); «Salir» vuelve al
 * historial y la comunicación queda donde estaba.
 */
export function ModoFoco({
  titulo,
  subtitulo,
  entorno,
  acciones,
  stepper,
  salirHref = COMUNICACIONES_PATH,
  children,
}: {
  titulo: ReactNode;
  subtitulo?: ReactNode;
  /** El chip de entorno: candado, modo y pasarela. */
  entorno?: ReactNode;
  /** Acciones secundarias de la cabecera (descartar). */
  acciones?: ReactNode;
  stepper?: ReactNode;
  salirHref?: string;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-page" role="region" aria-label="Asistente de envío">
      <header className="shrink-0 border-b border-subtle/60 bg-card">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
          <Link
            href={salirHref}
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-medium text-text-muted transition hover:bg-page hover:text-icam-900"
          >
            <Icono nombre="chevron" className="h-3.5 w-3.5 rotate-180" />
            Salir
          </Link>
          <span className="hidden h-5 w-px bg-subtle sm:block" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-text-primary">{titulo}</p>
            {subtitulo ? <p className="truncate text-xs text-text-muted">{subtitulo}</p> : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {entorno}
            {acciones}
          </div>
        </div>
        {stepper ? <div className="mx-auto max-w-6xl px-4 pb-3 sm:px-6">{stepper}</div> : null}
      </header>
      <div id={ID_CUERPO_DEL_ASISTENTE} className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex min-h-full flex-col">{children}</div>
      </div>
    </div>
  );
}

/**
 * Un paso del asistente: título en forma de pregunta, una línea que explica qué
 * se hace aquí, el contenido y la barra de abajo con «Atrás» y «Continuar».
 * Las explicaciones largas van detrás del ⓘ del título.
 */
export function PasoDelAsistente({
  titulo,
  subtitulo,
  ayuda,
  ancho = "normal",
  pie,
  children,
}: {
  titulo: ReactNode;
  subtitulo?: ReactNode;
  ayuda?: ReactNode;
  ancho?: "estrecho" | "normal" | "ancho";
  pie?: ReactNode;
  children: ReactNode;
}) {
  const max = ancho === "estrecho" ? "max-w-2xl" : ancho === "ancho" ? "max-w-6xl" : "max-w-4xl";
  return (
    <>
      <section className={`mx-auto w-full flex-1 px-4 py-6 sm:px-6 sm:py-8 ${max}`}>
        <div className="mb-5 sm:mb-6">
          <h1 className="flex items-center gap-1.5 text-xl font-semibold text-text-primary sm:text-2xl">
            {titulo}
            {ayuda ? <Ayuda etiqueta="Más sobre este paso">{ayuda}</Ayuda> : null}
          </h1>
          {subtitulo ? <p className="mt-1 text-sm text-text-muted">{subtitulo}</p> : null}
        </div>
        <div className="space-y-4">{children}</div>
      </section>
      {pie}
    </>
  );
}

/**
 * La barra fija de abajo: a la izquierda, volver; a la derecha, el siguiente
 * paso. Si no se puede continuar, el motivo va al lado del botón.
 */
export function BarraDeAcciones({
  atras,
  motivo,
  principal,
  extra,
}: {
  atras?: ReactNode;
  /** Por qué el botón principal está apagado, o una línea de contexto. */
  motivo?: ReactNode;
  principal?: ReactNode;
  extra?: ReactNode;
}) {
  return (
    <div className="sticky bottom-0 mt-auto border-t border-subtle/60 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2">{atras}</div>
        <div className="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-x-3 gap-y-2">
          {motivo ? <span className="min-w-0 text-right text-xs text-text-muted">{motivo}</span> : null}
          {extra}
          {principal}
        </div>
      </div>
    </div>
  );
}
