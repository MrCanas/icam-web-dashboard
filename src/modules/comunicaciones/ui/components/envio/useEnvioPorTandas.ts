"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import {
  confirmarEnvioAction,
  detenerEnvioAction,
  enviarTandaAction,
  reanudarEnvioAction,
} from "@/modules/comunicaciones/actions/envio";
import type { Progreso } from "@/modules/comunicaciones/logic/envio";
import type { EstadoComunicacion } from "@/modules/comunicaciones/types";

/**
 * El envío en sí: confirmar, pedir tandas hasta que no quede nadie, detener y
 * reanudar. Las tandas las pide la página una a una, así que cerrarla deja de
 * enviar. Cada acción vuelve a pasar todos los controles en el servidor.
 *
 * Lo usan el asistente y la vista clásica del detalle.
 */
export function useEnvioPorTandas({
  comunicacionId,
  estadoInicial,
  progresoInicial,
}: {
  comunicacionId: string;
  estadoInicial: EstadoComunicacion;
  progresoInicial: Progreso;
}) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  // El envío en curso manda sobre lo que trajo la página: se actualiza tanda a tanda.
  const [enVivo, setEnVivo] = useState<{ progreso: Progreso; estado: EstadoComunicacion } | null>(null);
  const parar = useRef(false);

  const estado = enVivo?.estado ?? estadoInicial;
  const avance = enVivo?.progreso ?? progresoInicial;

  /** Pide tandas hasta que no quede nadie, alguien detenga o algo falle. */
  const enviarTandas = async () => {
    parar.current = false;
    setEnviando(true);
    setError(null);
    setAviso(null);
    for (;;) {
      if (parar.current) break;
      const r = await enviarTandaAction(comunicacionId);
      if (!r.ok) {
        setError(r.mensaje);
        break;
      }
      setEnVivo({ progreso: r.progreso, estado: r.estado });
      if (r.detenidoPor) {
        setAviso(r.detenidoPor);
        break;
      }
      if (r.estado !== "enviando") break;
    }
    setEnviando(false);
    router.refresh();
  };

  /** Confirma con el número tecleado y, si el servidor lo acepta, empieza. */
  const confirmar = async (numero: number) => {
    setOcupado(true);
    setError(null);
    setAviso(null);
    const r = await confirmarEnvioAction(comunicacionId, numero);
    setOcupado(false);
    if (!r.ok) {
      setError(r.mensaje);
      return;
    }
    setEnVivo({ progreso: avance, estado: "enviando" });
    await enviarTandas();
  };

  const detener = async () => {
    parar.current = true;
    setOcupado(true);
    const r = await detenerEnvioAction(comunicacionId);
    if (r.ok) setEnVivo((v) => ({ progreso: v?.progreso ?? avance, estado: "pausada" }));
    else setError(r.mensaje);
    setOcupado(false);
    router.refresh();
  };

  const reanudar = async () => {
    setOcupado(true);
    setError(null);
    const r = await reanudarEnvioAction(comunicacionId);
    setOcupado(false);
    if (!r.ok) {
      setError(r.mensaje);
      return;
    }
    setEnVivo((v) => ({ progreso: v?.progreso ?? avance, estado: "enviando" }));
    await enviarTandas();
  };

  return { estado, avance, ocupado, enviando, error, aviso, setError, setAviso, confirmar, enviarTandas, detener, reanudar };
}
