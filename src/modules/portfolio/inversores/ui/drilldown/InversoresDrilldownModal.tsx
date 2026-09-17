"use client";

import { useEffect, useRef } from "react";

import { Modal } from "@/components/ui/Modal";
import { NivelContactos } from "@/modules/portfolio/inversores/ui/drilldown/NivelContactos";
import { NivelCuentas } from "@/modules/portfolio/inversores/ui/drilldown/NivelCuentas";
import type { NivelInversores } from "@/modules/portfolio/inversores/ui/drilldown/tipos";
import type { CuentaInversion } from "@/modules/portfolio/inversores/types";

interface Props {
  pila: NivelInversores[];
  onEntrarEnCuenta: (cuenta: CuentaInversion) => void;
  onVolver: () => void;
  onCerrar: () => void;
}

/**
 * El modal del drill-down: un solo diálogo para los dos niveles.
 *
 * Va en la capa elevada (portal + z-[80]) porque la barra flotante de portfolio
 * vive en z-[65] y un modal z-50 quedaría por debajo.
 *
 * OJO con el foco. El efecto de `Modal` que mete el foco dentro depende solo de
 * `open`, así que NO vuelve a correr al cambiar de nivel: el botón que lo tenía
 * se desmonta, el foco cae a `<body>` y la trampa de Tab —que compara el activo
 * con el primero, el último o la caja— deja de funcionar sin que nada lo
 * indique. Por eso aquí se recoloca a mano en cada cambio de nivel. Se arregla
 * en este modal y no en el compartido para no cambiarle el comportamiento a los
 * cinco sitios que ya lo usan.
 */
export function InversoresDrilldownModal({ pila, onEntrarEnCuenta, onVolver, onCerrar }: Props) {
  const actual = pila[pila.length - 1];
  const cuerpoRef = useRef<HTMLDivElement | null>(null);
  const volverRef = useRef<HTMLButtonElement | null>(null);
  const profundidadPrevia = useRef(0);
  /** La cuenta en la que se entró, para devolverle el foco al volver. */
  const cuentaVisitada = useRef<string | null>(null);

  useEffect(() => {
    const profundidad = pila.length;
    const previa = profundidadPrevia.current;
    profundidadPrevia.current = profundidad;

    if (actual?.nivel === "cuenta") cuentaVisitada.current = actual.cuenta.zohoId;

    // Ni al abrir (de eso ya se encarga `Modal`) ni al cerrar del todo.
    if (profundidad === 0 || previa === 0 || profundidad === previa) return;

    if (profundidad > previa) {
      // Hacia dentro: «← Volver» es el punto de entrada natural, y además deja
      // el camino de salida bajo el dedo.
      volverRef.current?.focus();
      return;
    }

    // Hacia fuera: al botón de la cuenta de la que se venía, no al primero de
    // la lista — si no, volver de la cuenta 30 te deja en la 1.
    const id = cuentaVisitada.current;
    const destino =
      (id
        ? cuerpoRef.current?.querySelector<HTMLElement>(`[data-cuenta-id="${CSS.escape(id)}"]`)
        : null) ?? cuerpoRef.current?.querySelector<HTMLElement>("[data-cuenta-id]");
    destino?.focus();
  }, [pila, actual]);

  return (
    <Modal
      open={pila.length > 0}
      title={actual?.titulo ?? ""}
      subtitle={actual?.subtitulo}
      width="xl"
      elevated
      onClose={onCerrar}
      footer={
        <>
          {pila.length > 1 ? (
            <button
              ref={volverRef}
              type="button"
              onClick={onVolver}
              className="min-h-9 rounded-md border border-subtle px-3 py-1.5 text-sm text-text-body hover:border-icam-900"
            >
              ← Volver
            </button>
          ) : null}
          <button
            type="button"
            onClick={onCerrar}
            className="min-h-9 rounded-md border border-subtle px-3 py-1.5 text-sm text-text-body hover:border-icam-900"
          >
            Cerrar
          </button>
        </>
      }
    >
      {/* El cambio de nivel no lleva transición a propósito: el selector de
          enfocables de `Modal` descarta lo que tiene `offsetParent` nulo, así
          que un panel a medio animar devuelve lista vacía y clava el foco. */}
      <div ref={cuerpoRef}>
        {actual?.nivel === "cuentas" ? (
          <NivelCuentas cuentas={actual.cuentas} onEntrar={onEntrarEnCuenta} />
        ) : null}
        {actual?.nivel === "cuenta" ? <NivelContactos cuenta={actual.cuenta} /> : null}
      </div>
    </Modal>
  );
}
