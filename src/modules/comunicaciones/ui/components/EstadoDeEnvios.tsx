import Link from "next/link";

import type { DatosDeEnvios } from "@/modules/comunicaciones/logic/loadComunicaciones";
import { COMUNICACIONES_AJUSTES_PATH } from "@/modules/comunicaciones/logic/paths";

/**
 * Lo que este módulo puede y no puede enviar ahora mismo, dicho en la pantalla.
 *
 * Quien llega aquí viene de un kiosk que enviaba al terminar. A quién puede
 * llegar un correo, si los envíos están encendidos y por dónde saldrían tiene
 * que leerse, no suponerse.
 */
export function EstadoDeEnvios({ datos, conEnlace = true }: { datos: DatosDeEnvios; conEnlace?: boolean }) {
  const { ajustes, emailsPermitidos, cuentasPermitidas, promocionEncontrada, pasarela, error } = datos;

  return (
    <div className="space-y-2 rounded-lg border border-subtle bg-card p-3 text-sm text-text-body">
      <p>
        <strong className="text-text-primary">Candado de destinatarios activo.</strong> Este módulo solo
        puede escribir a{" "}
        {emailsPermitidos.length > 0 ? (
          <strong className="text-text-primary">{emailsPermitidos.join(", ")}</strong>
        ) : (
          "nadie"
        )}
        {cuentasPermitidas.length > 0 ? (
          <>
            , y solo sobre las cuentas de prueba {cuentasPermitidas.map((c) => c.nombre).join(", ")}.
          </>
        ) : (
          "."
        )}{" "}
        Cualquier otro correo se rechaza antes de salir.
      </p>

      {!promocionEncontrada && !error ? (
        <p className="text-[#9B3B3B]">
          La promoción de pruebas no aparece en los datos de Zoho, así que no hay ninguna cuenta sobre la que
          enviar. Actualiza los datos de Zoho.
        </p>
      ) : null}

      {error ? <p className="text-[#9B3B3B]">No se pudo leer el estado de los envíos: {error}</p> : null}

      {ajustes ? (
        <p>
          {ajustes.envios_activados ? (
            <>
              Envíos <strong className="text-text-primary">activados</strong>
            </>
          ) : (
            <>
              Envíos <strong className="text-text-primary">desactivados</strong>: no sale ningún correo, ni de
              prueba
            </>
          )}
          {" · "}
          {ajustes.modo === "pruebas" ? (
            <>
              <strong className="text-text-primary">Modo pruebas</strong>: todo correo se redirige a quien lo
              envía
            </>
          ) : (
            <>
              <strong className="text-[#9B3B3B]">Modo real</strong>: los correos van a las direcciones de la
              lista
            </>
          )}
          {" · "}
          {pasarela === "zoho" ? (
            <>
              Salen por <strong className="text-text-primary">Zoho</strong>
            </>
          ) : (
            <>
              <strong className="text-text-primary">Pasarela simulada</strong>: en este entorno no sale ningún
              correo, aunque el recorrido se complete
            </>
          )}
          {conEnlace ? (
            <>
              {" · "}
              <Link href={COMUNICACIONES_AJUSTES_PATH} className="text-icam-900 underline underline-offset-2">
                Ajustes
              </Link>
            </>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}
