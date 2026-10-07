import { Desplegable } from "@/components/ui/Ayuda";

/** Piezas pequeñas que comparten los dos paneles de analítica. Sin estado: valen en servidor. */

export function pct(tasa: number | null): string {
  if (tasa === null) return "—";
  return `${new Intl.NumberFormat("es-ES", { maximumFractionDigits: 1 }).format(tasa * 100)} %`;
}

/**
 * Cómo hay que leer estas cifras. Plegado, pero siempre a un clic: sin esto,
 * «no consta apertura» se lee como «no lo ha leído», y no es lo mismo.
 */
export function AvisoDeAnalitica() {
  return (
    <Desplegable titulo="Cómo leer estas cifras">
      <p>
        Una apertura solo consta si el programa de correo de quien lo recibe carga las imágenes, y muchos no lo
        hacen: <strong>«no consta apertura» no significa «no lo ha leído»</strong>.
      </p>
      <p>
        Los clics son el dato fiable, y quien pulsa un enlace cuenta como que lo abrió. Lo que abren o pulsan los
        filtros de correo por su cuenta se guarda aparte y no suma.
      </p>
      <p>
        Lo enviado en modo pruebas, por la pasarela simulada o antes de existir el seguimiento no mide a los
        destinatarios y queda fuera de las cifras.
      </p>
    </Desplegable>
  );
}
