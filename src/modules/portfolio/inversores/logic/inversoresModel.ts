import type { Espejos } from "@/modules/portfolio/inversores/data/inversoresRepository";
import type {
  ContactoInversor,
  CuentaInversion,
  KpisInversores,
  ModeloInversores,
  PromocionDeCuenta,
  PuntoPromocion,
  PuntoTrimestre,
  TramoInversion,
} from "@/modules/portfolio/inversores/types";

/**
 * Espejos → lo que pinta la pantalla.
 *
 * Todo puro y sin React ni Supabase, para poder probarlo. Y todo agregado AQUÍ,
 * en servidor: los flujos crudos pueden ser decenas de miles y no tienen por
 * qué bajar al navegador. Lo que sí baja son las cuentas con sus contactos,
 * porque es lo que el drill-down necesita enseñar sin esperar.
 */

/** Cuánto capital «pesa» una cuenta: lo firmado, y si no, lo puesto. */
export function capitalDe(cuenta: CuentaInversion): number {
  return cuenta.comprometido ?? cuenta.aportado;
}

/** `2026-02-14` → `2026-T1`. Ordenable como texto. */
export function trimestreDe(fecha: string): string | null {
  const m = /^(\d{4})-(\d{2})/.exec(fecha);
  if (!m) return null;
  const mes = Number(m[2]);
  if (mes < 1 || mes > 12) return null;
  return `${m[1]}-T${Math.floor((mes - 1) / 3) + 1}`;
}

const TRAMOS: readonly { id: string; etiqueta: string; desde: number; hasta: number | null }[] = [
  { id: "0-100k", etiqueta: "< 100 k€", desde: 0, hasta: 100_000 },
  { id: "100k-250k", etiqueta: "100 – 250 k€", desde: 100_000, hasta: 250_000 },
  { id: "250k-500k", etiqueta: "250 – 500 k€", desde: 250_000, hasta: 500_000 },
  { id: "500k-1M", etiqueta: "500 k€ – 1 M€", desde: 500_000, hasta: 1_000_000 },
  { id: "1M+", etiqueta: "> 1 M€", desde: 1_000_000, hasta: null },
];

function suma(valores: readonly (number | null)[]): number {
  return valores.reduce<number>((acc, v) => acc + (v ?? 0), 0);
}

function agrupar<T>(filas: readonly T[], clave: (f: T) => string | null): Map<string, T[]> {
  const mapa = new Map<string, T[]>();
  for (const fila of filas) {
    const k = clave(fila);
    if (!k) continue;
    const lista = mapa.get(k);
    if (lista) lista.push(fila);
    else mapa.set(k, [fila]);
  }
  return mapa;
}

export function construirModelo(espejos: Espejos): ModeloInversores {
  const {
    cuentas: filasCuentas,
    contactos,
    cuentaContacto,
    promociones,
    cuentaPromocion,
    flujos,
  } = espejos;

  const contactoPorId = new Map(contactos.map((c) => [c.zoho_id, c]));
  const promocionPorId = new Map(promociones.map((p) => [p.zoho_id, p]));

  const enlacesPorCuenta = agrupar(cuentaContacto, (e) => e.cuenta_zoho_id);
  const promosPorCuenta = agrupar(cuentaPromocion, (e) => e.cuenta_zoho_id);
  const flujosPorCuenta = agrupar(flujos, (f) => f.cuenta_zoho_id);

  const cuentas: CuentaInversion[] = filasCuentas.map((fila) => {
    const misFlujos = flujosPorCuenta.get(fila.zoho_id) ?? [];
    const aportado = suma(misFlujos.filter((f) => f.tipo === "aporte").map((f) => f.importe));
    const repartido = suma(misFlujos.filter((f) => f.tipo === "reparto").map((f) => f.importe));

    const misPromos = promosPorCuenta.get(fila.zoho_id) ?? [];
    const flujosPorPromo = agrupar(misFlujos, (f) => f.promocion_zoho_id);

    const promocionesDeLaCuenta: PromocionDeCuenta[] = misPromos.map((enlace) => {
      const id = enlace.promocion_zoho_id ?? "";
      const deLaPromo = flujosPorPromo.get(id) ?? [];
      return {
        zohoId: id,
        // El nombre denormalizado del enlace gana al del espejo: sobrevive a un
        // sync en el que el módulo de promociones falló.
        nombre:
          enlace.promocion_nombre ?? promocionPorId.get(id)?.nombre ?? "(promoción sin nombre)",
        situacion: promocionPorId.get(id)?.situacion ?? null,
        comprometido: enlace.importe_comprometido,
        aportado:
          enlace.importe_aportado ??
          suma(deLaPromo.filter((f) => f.tipo === "aporte").map((f) => f.importe)),
        repartido: suma(deLaPromo.filter((f) => f.tipo === "reparto").map((f) => f.importe)),
      };
    });

    const misContactos: ContactoInversor[] = (enlacesPorCuenta.get(fila.zoho_id) ?? []).map(
      (enlace) => {
        const ficha = enlace.contacto_zoho_id
          ? contactoPorId.get(enlace.contacto_zoho_id)
          : undefined;
        return {
          zohoId: enlace.contacto_zoho_id ?? enlace.zoho_id,
          nombre: enlace.contacto_nombre ?? ficha?.nombre_completo ?? "(sin nombre)",
          // El correo del enlace manda; el del módulo Contacts es el respaldo
          // para cuando el enlace no lo trae.
          email: enlace.contacto_email ?? ficha?.email ?? null,
          telefono: enlace.contacto_telefono ?? ficha?.telefono ?? null,
          rol: enlace.rol,
          participacion: enlace.participacion,
        };
      },
    );

    // Si Zoho no lleva el comprometido en la cuenta, se deriva de lo firmado en
    // cada promoción. `null` solo si no hay ni una cosa ni la otra: un 0 aquí
    // diría «no ha comprometido nada», que es otra cosa.
    const comprometidoEnPromos = misPromos.some((p) => p.importe_comprometido != null)
      ? suma(misPromos.map((p) => p.importe_comprometido))
      : null;

    return {
      zohoId: fila.zoho_id,
      nombre: fila.nombre,
      codigo: fila.codigo,
      estado: fila.estado,
      tipo: fila.tipo,
      fechaAlta: fila.fecha_alta,
      comprometido: fila.capital_comprometido ?? comprometidoEnPromos,
      aportado,
      repartido,
      neto: aportado - repartido,
      contactos: misContactos,
      promociones: promocionesDeLaCuenta,
    };
  });

  cuentas.sort((a, b) => a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" }));

  return {
    cuentas,
    kpis: calcularKpis(cuentas),
    porPromocion: agregarPorPromocion(cuentas),
    porTrimestre: agregarPorTrimestre(espejos),
    tramos: agregarPorTramo(cuentas),
    topCuentas: [...cuentas].sort((a, b) => capitalDe(b) - capitalDe(a)).slice(0, 10),
  };
}

export function calcularKpis(cuentas: readonly CuentaInversion[]): KpisInversores {
  const comprometido = suma(cuentas.map((c) => c.comprometido));
  const aportado = suma(cuentas.map((c) => c.aportado));
  const repartido = suma(cuentas.map((c) => c.repartido));

  // Un inversor con dos cuentas es un inversor. Se cuenta por identidad, no por
  // número de filas de enlace.
  const inversores = new Set<string>();
  for (const cuenta of cuentas) {
    for (const contacto of cuenta.contactos) inversores.add(contacto.zohoId);
  }
  const promos = new Set<string>();
  for (const cuenta of cuentas) {
    for (const promocion of cuenta.promociones) promos.add(promocion.zohoId);
  }

  return {
    comprometido,
    aportado,
    repartido,
    // Sin bajar de cero: un desembolso mayor que lo firmado significa que el
    // comprometido está desactualizado en el CRM, no que quede deuda negativa.
    pendiente: Math.max(0, comprometido - aportado),
    dpi: aportado > 0 ? repartido / aportado : null,
    numCuentas: cuentas.length,
    numInversores: inversores.size,
    numPromociones: promos.size,
  };
}

export function agregarPorPromocion(cuentas: readonly CuentaInversion[]): PuntoPromocion[] {
  const acc = new Map<string, PuntoPromocion>();

  for (const cuenta of cuentas) {
    for (const promocion of cuenta.promociones) {
      const punto = acc.get(promocion.zohoId) ?? {
        zohoId: promocion.zohoId,
        nombre: promocion.nombre,
        aportado: 0,
        pendiente: 0,
        comprometido: 0,
        numCuentas: 0,
      };
      punto.aportado += promocion.aportado;
      punto.comprometido += promocion.comprometido ?? 0;
      punto.numCuentas += 1;
      acc.set(promocion.zohoId, punto);
    }
  }

  for (const punto of acc.values()) {
    punto.pendiente = Math.max(0, punto.comprometido - punto.aportado);
  }

  return [...acc.values()].sort((a, b) => b.comprometido - a.comprometido || b.aportado - a.aportado);
}

export function agregarPorTrimestre(espejos: Espejos): PuntoTrimestre[] {
  const acc = new Map<string, { aportes: number; repartos: number; cuentas: Set<string> }>();

  for (const flujo of espejos.flujos) {
    if (!flujo.fecha || flujo.tipo === "desconocido") continue;
    const periodo = trimestreDe(flujo.fecha);
    if (!periodo) continue;

    const punto = acc.get(periodo) ?? { aportes: 0, repartos: 0, cuentas: new Set<string>() };
    if (flujo.tipo === "aporte") punto.aportes += flujo.importe;
    else punto.repartos += flujo.importe;
    if (flujo.cuenta_zoho_id) punto.cuentas.add(flujo.cuenta_zoho_id);
    acc.set(periodo, punto);
  }

  let acumulado = 0;
  return [...acc.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([periodo, punto]) => {
      acumulado += punto.aportes - punto.repartos;
      return {
        periodo,
        aportes: punto.aportes,
        // Negativo para pintarlo hacia abajo en la barra divergente. El valor
        // absoluto es el que se enseña en el tooltip.
        repartos: -punto.repartos,
        netoAcumulado: acumulado,
        numCuentas: punto.cuentas.size,
        cuentaIds: [...punto.cuentas],
      };
    });
}

export function agregarPorTramo(cuentas: readonly CuentaInversion[]): TramoInversion[] {
  return TRAMOS.map((tramo) => {
    const dentro = cuentas.filter((cuenta) => {
      const capital = capitalDe(cuenta);
      return capital >= tramo.desde && (tramo.hasta === null || capital < tramo.hasta);
    });
    return {
      ...tramo,
      numCuentas: dentro.length,
      total: suma(dentro.map(capitalDe)),
    };
  });
}

/** Las cuentas de un tramo. El resolutor del drill-down, puro y probable. */
export function cuentasEnTramo(
  cuentas: readonly CuentaInversion[],
  tramoId: string,
): CuentaInversion[] {
  const tramo = TRAMOS.find((t) => t.id === tramoId);
  if (!tramo) return [];
  return cuentas.filter((cuenta) => {
    const capital = capitalDe(cuenta);
    return capital >= tramo.desde && (tramo.hasta === null || capital < tramo.hasta);
  });
}

/** Las cuentas que participan en una promoción. */
export function cuentasEnPromocion(
  cuentas: readonly CuentaInversion[],
  promocionId: string,
): CuentaInversion[] {
  return cuentas.filter((cuenta) => cuenta.promociones.some((p) => p.zohoId === promocionId));
}

/** Las cuentas con algún flujo en un trimestre. */
export function cuentasEnTrimestre(
  cuentas: readonly CuentaInversion[],
  punto: PuntoTrimestre,
): CuentaInversion[] {
  const ids = new Set(punto.cuentaIds);
  return cuentas.filter((cuenta) => ids.has(cuenta.zohoId));
}
