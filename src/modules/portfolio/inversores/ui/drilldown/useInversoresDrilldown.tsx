"use client";

import { useCallback, useState, type ReactNode } from "react";

import { InversoresDrilldownModal } from "@/modules/portfolio/inversores/ui/drilldown/InversoresDrilldownModal";
import type {
  AperturaCuentas,
  NivelInversores,
} from "@/modules/portfolio/inversores/ui/drilldown/tipos";
import type { CuentaInversion } from "@/modules/portfolio/inversores/types";

export interface Drilldown {
  /** Nivel 1: las cuentas detrás de una cifra. */
  abrirCuentas: (apertura: AperturaCuentas) => void;
  /** Nivel 2 directo, sin pasar por la lista (top de cuentas, fila de tabla). */
  abrirCuenta: (cuenta: CuentaInversion, subtitulo?: string) => void;
  cerrar: () => void;
  /** El modal ya montado. Se pinta una vez, al final del JSX que lo usa. */
  modal: ReactNode;
}

/**
 * Drill-down de dos niveles, con PILA y no con una selección suelta.
 *
 * La pila es lo que hace que «volver» salga gratis y, sobre todo, lo que
 * permite tener un único `<Modal>` montado para los dos niveles. Montar uno por
 * nivel sería peor de lo que parece: `Modal` guarda y repone
 * `document.body.style.overflow` y devuelve el foco al desmontarse, así que dos
 * modales encadenados se pisan el scroll del fondo y roban el foco entre ellos.
 *
 * Se clona en vez de reutilizar `useChartDrilldown` de portfolio porque aquél
 * está tipado contra `Proyecto` y su modal es, entera, una tabla de proyectos.
 * Generalizarlo pedía genéricos y render props, y tocaba las nueve gráficas que
 * ya lo usan en producción a cambio de nada.
 */
export function useInversoresDrilldown(): Drilldown {
  const [pila, setPila] = useState<NivelInversores[]>([]);

  const abrirCuentas = useCallback((apertura: AperturaCuentas) => {
    setPila([{ nivel: "cuentas", ...apertura }]);
  }, []);

  const abrirCuenta = useCallback((cuenta: CuentaInversion, subtitulo?: string) => {
    setPila([{ nivel: "cuenta", titulo: cuenta.nombre, subtitulo, cuenta }]);
  }, []);

  const entrarEnCuenta = useCallback((cuenta: CuentaInversion) => {
    setPila((previa) => [
      ...previa,
      {
        nivel: "cuenta",
        titulo: cuenta.nombre,
        subtitulo: previa[previa.length - 1]?.titulo,
        cuenta,
      },
    ]);
  }, []);

  const volver = useCallback(() => setPila((previa) => previa.slice(0, -1)), []);
  const cerrar = useCallback(() => setPila([]), []);

  return {
    abrirCuentas,
    abrirCuenta,
    cerrar,
    modal: (
      <InversoresDrilldownModal
        pila={pila}
        onEntrarEnCuenta={entrarEnCuenta}
        onVolver={volver}
        onCerrar={cerrar}
      />
    ),
  };
}
