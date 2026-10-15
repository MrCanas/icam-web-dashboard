"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";

import { Icono } from "@/components/ui/Icono";
import { COMUNICACIONES_AJUSTES_PATH } from "@/modules/comunicaciones/logic/paths";
import { ChipEnvios, ChipModo, ChipPasarela } from "@/modules/comunicaciones/ui/components/ui/ChipEstado";
import { ListaDeDirecciones } from "@/modules/comunicaciones/ui/components/ui/ListaDeDirecciones";

import type { EntornoDeEnvio } from "./entorno";

/**
 * El entorno de envío en una pastilla: candado, envíos activados, modo y
 * pasarela. Pulsándola se abre lo que antes era la tira del candado, entera:
 * a quién puede escribir el módulo, en qué modo y por dónde saldría.
 *
 * Se pone roja si algo impide enviar: envíos desactivados, el candado
 * rechazaría correos de esta comunicación, o no se pudo leer el estado.
 */
export function ChipEntorno({
  entorno,
  /** El candado rechazaría correos de esta comunicación. */
  bloqueada = false,
  conEnlace = true,
}: {
  entorno: EntornoDeEnvio;
  bloqueada?: boolean;
  conEnlace?: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  const raiz = useRef<HTMLDivElement | null>(null);
  const id = useId();
  const { ajustes, emailsPermitidos, cuentasPermitidas, promocionEncontrada, pasarela, error } = entorno;

  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => {
      if (!raiz.current?.contains(e.target as Node)) setAbierto(false);
    };
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAbierto(false);
    };
    document.addEventListener("mousedown", fuera);
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("mousedown", fuera);
      document.removeEventListener("keydown", tecla);
    };
  }, [abierto]);

  const problema = Boolean(error) || !promocionEncontrada || bloqueada || (ajustes !== null && !ajustes.envios_activados);
  const partes = [
    ajustes ? (ajustes.modo === "real" ? "Modo real" : "Modo pruebas") : null,
    pasarela === "simulada" ? "simulada" : "Zoho",
  ].filter(Boolean);
  const texto = bloqueada
    ? "No enviable: candado"
    : error
      ? "Estado desconocido"
      : ajustes && !ajustes.envios_activados
        ? "Envíos desactivados"
        : partes.join(" · ");

  return (
    <div ref={raiz} className="relative">
      <button
        type="button"
        aria-expanded={abierto}
        aria-controls={id}
        onClick={() => setAbierto((v) => !v)}
        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-icam-900/40 ${
          problema
            ? "border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
            : "border-icam-900/15 bg-icam-900/[0.04] text-icam-900 hover:bg-icam-900/[0.08]"
        }`}
      >
        <Icono nombre="candado" className="h-3.5 w-3.5" />
        {texto}
        <Icono nombre="info" className="h-3 w-3 opacity-60" />
      </button>
      {abierto ? (
        <div
          id={id}
          role="dialog"
          aria-label="Entorno de envío"
          className="absolute right-0 top-full z-40 mt-2 w-[min(92vw,24rem)] space-y-3 rounded-xl border border-subtle bg-card p-4 text-left text-xs leading-relaxed text-text-body shadow-xl"
        >
          <div>
            <p className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-icam-900">
              <Icono nombre="candado" className="h-4 w-4" />
              Candado de destinatarios
            </p>
            <p>
              Mientras exista, este módulo solo puede escribir a las direcciones de una lista cerrada, escrita en el
              código, y solo sobre las cuentas de prueba de la promoción de pruebas del CRM
              {cuentasPermitidas.length > 0 ? ` (${cuentasPermitidas.map((c) => c.nombre).join(", ")})` : ""}.
              Cualquier otro correo se rechaza antes de salir. Nada que se toque en Zoho lo ensancha; quitarlo es una
              decisión aparte.
            </p>
          </div>
          <div>
            <p className="mb-1 font-medium text-text-primary">Solo puede escribir a</p>
            <ListaDeDirecciones direcciones={emailsPermitidos} vacio="nadie" compacta tono="marca" />
          </div>
          {ajustes ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <ChipEnvios activados={ajustes.envios_activados} />
              <ChipModo modo={ajustes.modo} />
              <ChipPasarela pasarela={pasarela} />
            </div>
          ) : null}
          <ul className="list-disc space-y-1 pl-4 text-text-muted">
            {ajustes ? (
              <li>
                {ajustes.modo === "pruebas"
                  ? "Modo pruebas: todo correo se redirige a quien lo envía, sea cual sea la lista."
                  : "Modo real: los correos van a las direcciones de la lista. El candado sigue mandando."}
              </li>
            ) : null}
            <li>
              {pasarela === "simulada"
                ? "Pasarela simulada: en este entorno no sale ningún correo, aunque el recorrido se complete."
                : "Los correos salen de verdad, por Zoho CRM."}
            </li>
          </ul>
          {bloqueada ? (
            <p role="alert" className="text-red-700">
              El candado rechazaría correos de esta comunicación, así que no se puede enviar. La lista sirve para
              revisarla, pero a nadie de ella se le escribe.
            </p>
          ) : null}
          {!promocionEncontrada && !error ? (
            <p role="alert" className="text-red-700">
              La promoción de pruebas no aparece en los datos de Zoho: no hay ninguna cuenta sobre la que enviar.
              Actualiza los datos de Zoho.
            </p>
          ) : null}
          {error ? (
            <p role="alert" className="text-red-700">
              No se pudo leer el estado de los envíos: {error}
            </p>
          ) : null}
          {conEnlace ? (
            <Link href={COMUNICACIONES_AJUSTES_PATH} className="inline-block font-medium text-icam-900 underline-offset-2 hover:underline">
              Ver ajustes de envío
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
