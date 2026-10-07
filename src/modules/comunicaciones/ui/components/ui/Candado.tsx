import Link from "next/link";

import { Ayuda } from "@/components/ui/Ayuda";
import { Icono } from "@/components/ui/Icono";
import type { DatosDeEnvios } from "@/modules/comunicaciones/logic/loadComunicaciones";
import { COMUNICACIONES_AJUSTES_PATH } from "@/modules/comunicaciones/logic/paths";
import { ChipEnvios, ChipModo, ChipPasarela } from "@/modules/comunicaciones/ui/components/ui/ChipEstado";
import { ListaDeDirecciones } from "@/modules/comunicaciones/ui/components/ui/ListaDeDirecciones";

/**
 * La tira del candado: a quién puede escribir este módulo ahora mismo, si los
 * envíos están encendidos, en qué modo y por dónde saldrían.
 *
 * Va encima de todo en Historial, Detalle y Ajustes, y nunca se pliega: quien
 * llega aquí viene de un kiosk que enviaba al terminar, y esto se lee, no se
 * supone.
 */
export function Candado({ datos, conEnlace = true }: { datos: DatosDeEnvios; conEnlace?: boolean }) {
  const { ajustes, emailsPermitidos, cuentasPermitidas, promocionEncontrada, pasarela, error } = datos;

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-icam-900/15 bg-icam-900/[0.04] px-3.5 py-2.5 text-sm">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1.5">
        <span className="inline-flex items-center gap-1.5 font-semibold text-icam-900">
          <Icono nombre="candado" className="h-4 w-4" />
          Candado de destinatarios
          <Ayuda etiqueta="Qué es el candado de destinatarios">
            Mientras exista, este módulo solo puede escribir a las direcciones de una lista cerrada, escrita en el
            código, y solo sobre las cuentas de prueba de la promoción de pruebas del CRM
            {cuentasPermitidas.length > 0 ? ` (${cuentasPermitidas.map((c) => c.nombre).join(", ")})` : ""}.
            Cualquier otro correo se rechaza antes de salir. Nada que se toque en Zoho lo ensancha; quitarlo es una
            decisión aparte.
          </Ayuda>
        </span>
        <span className="text-text-muted">solo puede escribir a</span>
        <ListaDeDirecciones direcciones={emailsPermitidos} vacio="nadie" compacta tono="marca" />
      </div>

      {ajustes ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <ChipEnvios activados={ajustes.envios_activados} />
          <ChipModo modo={ajustes.modo} />
          <ChipPasarela pasarela={pasarela} />
          {conEnlace ? (
            <Link
              href={COMUNICACIONES_AJUSTES_PATH}
              className="ml-1 text-xs font-medium text-icam-900 underline-offset-2 hover:underline"
            >
              Ajustes
            </Link>
          ) : null}
        </div>
      ) : null}

      {!promocionEncontrada && !error ? (
        <p role="alert" className="basis-full text-xs text-red-700">
          La promoción de pruebas no aparece en los datos de Zoho: no hay ninguna cuenta sobre la que enviar.
          Actualiza los datos de Zoho.
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="basis-full text-xs text-red-700">
          No se pudo leer el estado de los envíos: {error}
        </p>
      ) : null}
    </div>
  );
}
