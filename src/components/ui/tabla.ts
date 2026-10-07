/**
 * Clases de las tablas del portal (las de pm/informes y Comunicaciones), para
 * escribir `<table>` a mano con el mismo aspecto. Constantes, no componente:
 * cada tabla tiene su markup y aquí solo va el estilo.
 */
export const TABLA = {
  /** El contenedor con scroll horizontal. Va dentro de una `Tarjeta sinRelleno`. */
  marco: "overflow-x-auto",
  /** El mismo, con alto máximo y scroll vertical. */
  marcoFijo: "max-h-[640px] overflow-auto overscroll-x-contain",
  tabla: "w-full border-collapse text-left text-sm",
  thead: "bg-subtle/30",
  /** Cabecera que se queda arriba al hacer scroll dentro de `marcoFijo`. */
  theadFija: "sticky top-0 z-10 bg-page shadow-[inset_0_-1px_0_0_theme(colors.subtle)]",
  th: "whitespace-nowrap px-3 py-2.5 text-xs font-semibold uppercase tracking-wider text-icam-900",
  thNum: "whitespace-nowrap px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-icam-900",
  tr: "border-t border-subtle/60 align-top",
  trPulsable: "border-t border-subtle/60 align-top transition hover:bg-page/70",
  trApagada: "border-t border-subtle/60 align-top text-text-muted",
  td: "px-3 py-2.5",
  tdNum: "px-3 py-2.5 text-right tabular-nums",
  /** Segunda línea dentro de una celda. */
  sub: "mt-0.5 block text-xs text-text-muted",
  vacio: "px-3 py-8 text-center text-sm text-text-muted",
} as const;
