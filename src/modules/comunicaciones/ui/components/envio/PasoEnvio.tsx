"use client";

import type { ReactNode } from "react";

import { Aviso } from "@/components/ui/Aviso";
import { Boton, BotonEnlace } from "@/components/ui/Boton";
import { Icono } from "@/components/ui/Icono";
import { fmtFechaHora, fmtInt } from "@/lib/formatters";
import { TANDA, type Progreso } from "@/modules/comunicaciones/logic/envio";
import { comunicacionAnaliticaPath } from "@/modules/comunicaciones/logic/paths";
import type { ComComunicacionRow, EstadoComunicacion } from "@/modules/comunicaciones/types";
import { PasoCard } from "@/modules/comunicaciones/ui/components/ui/PasoCard";

export function PasoEnvio({
  comunicacion,
  estado,
  avance,
  simulada,
  enviando,
  ocupado,
  puedeEscribir,
  onDetener,
  onContinuar,
  onReanudar,
  seguimiento,
}: {
  comunicacion: ComComunicacionRow;
  estado: EstadoComunicacion;
  avance: Progreso;
  simulada: boolean;
  enviando: boolean;
  ocupado: boolean;
  puedeEscribir: boolean;
  onDetener: () => void;
  onContinuar: () => void;
  onReanudar: () => void;
  /** El botón de seguimiento, si procede. */
  seguimiento?: ReactNode;
}) {
  const hechos = avance.enviados + avance.errores + avance.omitidos;
  const porcentaje = avance.total > 0 ? Math.round((hechos / avance.total) * 100) : 0;
  const terminada = estado === "enviada";

  return (
    <PasoCard numero={4} titulo={terminada ? "Enviada" : "Envío"} estado={terminada ? "hecho" : "actual"}>
      <div>
        <div className="mb-1 flex items-center justify-between text-xs text-text-muted">
          <span>
            {fmtInt(hechos)} de {fmtInt(avance.total)}
            {enviando ? ` · enviando en tandas de ${TANDA}` : ""}
          </span>
          <span className="tabular-nums">{porcentaje} %</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-subtle" role="progressbar" aria-valuenow={porcentaje} aria-valuemin={0} aria-valuemax={100}>
          <div className={`h-full rounded-full ${terminada ? "bg-green-600" : "bg-icam-900"} transition-all`} style={{ width: `${porcentaje}%` }} />
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {(
          [
            ["Enviados", avance.enviados],
            ["Pendientes", avance.pendientes + avance.enCurso],
            ["Errores", avance.errores],
            ["Omitidos", avance.omitidos],
            ["Total", avance.total],
          ] as const
        ).map(([etiqueta, valor]) => (
          <div key={etiqueta} className="rounded-md bg-page px-3 py-2">
            <dt className="text-xs font-medium uppercase tracking-wider text-text-muted">{etiqueta}</dt>
            <dd className="text-xl font-semibold tabular-nums text-text-primary">{fmtInt(valor)}</dd>
          </div>
        ))}
      </dl>

      {comunicacion.pasarela === "simulada" || simulada ? (
        <Aviso tipo="info">Pasarela simulada: no ha salido ningún correo de verdad.</Aviso>
      ) : null}

      {terminada ? (
        <Aviso
          tipo="ok"
          acciones={
            <>
              <BotonEnlace href={comunicacionAnaliticaPath(comunicacion.id)} variante="secundario" pequeno icono={<Icono nombre="grafica" />}>
                Ver analítica
              </BotonEnlace>
              {puedeEscribir ? seguimiento : null}
            </>
          }
        >
          Terminado{comunicacion.enviada_at ? ` el ${fmtFechaHora(comunicacion.enviada_at)}` : ""}. El detalle de cada correo está
          en la pestaña «Destinatarios».
        </Aviso>
      ) : null}

      {estado === "enviando" && enviando ? (
        <Aviso
          tipo="aviso"
          acciones={
            <Boton variante="peligro" pequeno icono={<Icono nombre="pausa" />} disabled={ocupado} onClick={onDetener}>
              Detener
            </Boton>
          }
        >
          No cierres esta página: cerrarla detiene el envío.
        </Aviso>
      ) : null}

      {estado === "enviando" && !enviando && puedeEscribir ? (
        <Aviso
          tipo="aviso"
          acciones={
            <>
              <Boton variante="primario" pequeno icono={<Icono nombre="play" />} disabled={ocupado} onClick={onContinuar}>
                Continuar el envío
              </Boton>
              <Boton variante="secundario" pequeno disabled={ocupado} onClick={onDetener}>
                Dejarlo detenido
              </Boton>
            </>
          }
        >
          El envío está a medias y ahora mismo no sale nada: nadie tiene esta página enviando.
        </Aviso>
      ) : null}

      {estado === "pausada" && puedeEscribir ? (
        <Aviso
          tipo="aviso"
          acciones={
            <Boton variante="primario" pequeno icono={<Icono nombre="play" />} disabled={ocupado || enviando} onClick={onReanudar}>
              Reanudar
            </Boton>
          }
        >
          Envío detenido. Los pendientes siguen pendientes.
        </Aviso>
      ) : null}
    </PasoCard>
  );
}
