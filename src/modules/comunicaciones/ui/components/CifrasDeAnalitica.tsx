/** Piezas pequeñas que comparten los dos paneles de analítica. Sin estado: valen en servidor. */

export function pct(tasa: number | null): string {
  if (tasa === null) return "—";
  return `${new Intl.NumberFormat("es-ES", { maximumFractionDigits: 1 }).format(tasa * 100)} %`;
}

export function Cifra({ etiqueta, valor, nota }: { etiqueta: string; valor: string; nota?: string }) {
  return (
    <div className="rounded-lg border border-subtle/50 bg-card px-3 py-2">
      <dt className="text-xs text-text-muted">{etiqueta}</dt>
      <dd className="text-xl font-semibold tabular-nums text-text-primary">{valor}</dd>
      {nota ? <dd className="text-xs text-text-muted">{nota}</dd> : null}
    </div>
  );
}

/**
 * Cómo hay que leer estas cifras. Va siempre en pantalla: sin esto, «no consta
 * apertura» se lee como «no lo ha leído», y no es lo mismo.
 */
export function AvisoDeAnalitica() {
  return (
    <p className="rounded-lg border border-subtle bg-card p-3 text-sm text-text-body">
      <strong>Cómo leer estas cifras.</strong> Una apertura solo consta si el programa de correo de quien lo
      recibe carga las imágenes, y muchos no lo hacen: <strong>«no consta apertura» no significa «no lo ha
      leído»</strong>. Los clics son el dato fiable, y quien pulsa un enlace cuenta como que lo abrió. Lo que
      abren o pulsan los filtros de correo por su cuenta se guarda aparte y no suma.
    </p>
  );
}
