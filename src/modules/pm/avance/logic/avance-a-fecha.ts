/**
 * Avance de obra a una fecha pasada: el que se enseña en el Operativo de actas
 * cuando se consulta un snapshot histórico (`?asOf=YYYY-MM-DD`).
 *
 * Solo se guarda el valor vigente (`pm_avance_obra`) y un histórico append-only
 * de cambios (`pm_avance_obra_historico`), así que el valor a una fecha se
 * reconstruye desde el histórico. Puro: sin Supabase, para poder testearlo.
 */

import type { PmAvanceFaseValor, PmAvanceProyecto } from "@/modules/pm/avance/types";

/** Lo mínimo de una fila del histórico para reconstruir un valor. */
export interface CambioAvance {
  fase_id: string;
  porcentaje_anterior: number | null;
  porcentaje_nuevo: number | null;
  cambiado_at: string;
}

/**
 * Porcentaje de una fase en el instante `corte` (ms epoch, inclusive).
 *
 * - Hay cambios hasta el corte: manda el `porcentaje_nuevo` del último.
 * - Solo hay cambios posteriores: el `porcentaje_anterior` del primero, que es
 *   lo que había antes de tocarlo.
 * - La fase nunca ha cambiado: el valor vigente.
 *
 * NULL se conserva como «sin dato»; nunca se convierte en 0.
 */
export function porcentajeAFecha(
  cambios: readonly CambioAvance[],
  faseId: string,
  corte: number,
  actual: number | null,
): number | null {
  const deLaFase = cambios
    .filter((c) => c.fase_id === faseId)
    .map((c) => ({ c, t: new Date(c.cambiado_at).getTime() }))
    .filter(({ t }) => !Number.isNaN(t))
    .sort((a, b) => a.t - b.t);

  if (deLaFase.length === 0) return actual;

  let ultimoHastaCorte: CambioAvance | null = null;
  for (const { c, t } of deLaFase) {
    if (t <= corte) ultimoHastaCorte = c;
    else break;
  }
  if (ultimoHastaCorte) return ultimoHastaCorte.porcentaje_nuevo;
  return deLaFase[0]!.c.porcentaje_anterior;
}

/** Final del día `YYYY-MM-DD` (UTC, como el snapshot de actas). */
export function finDelDia(fechaYmd: string): number {
  return new Date(`${fechaYmd}T23:59:59.999Z`).getTime();
}

function aFecha(
  valor: PmAvanceFaseValor,
  cambios: readonly CambioAvance[],
  corte: number,
): PmAvanceFaseValor {
  return {
    ...valor,
    porcentaje: porcentajeAFecha(cambios, valor.fase.id, corte, valor.porcentaje),
    // En un snapshot no hay nada pendiente de comunicar: no aplica.
    pendiente: false,
  };
}

/**
 * El mismo `PmAvanceProyecto` con los porcentajes reconstruidos al corte, para
 * pintarlo con los mismos componentes que el vigente (en solo lectura).
 * El histórico se recorta a los cambios hasta el corte y la bandeja se vacía.
 */
export function avanceProyectoAFecha(
  data: PmAvanceProyecto,
  cambios: readonly CambioAvance[],
  corte: number,
): PmAvanceProyecto {
  return {
    ...data,
    general: data.general ? aFecha(data.general, cambios, corte) : null,
    fases: data.fases.map((f) => aFecha(f, cambios, corte)),
    historico: data.historico.filter((h) => new Date(h.cambiado_at).getTime() <= corte),
    pendientes: [],
  };
}
