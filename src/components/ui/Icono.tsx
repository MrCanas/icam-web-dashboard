/**
 * Iconos del portal, en línea (trazos al estilo lucide, 24×24, grosor 2). Sin
 * dependencia: una docena basta y así todos los iconos son del mismo estilo
 * que los que ya dibuja pm/actas.
 */
export type NombreIcono =
  | "info"
  | "check"
  | "alerta"
  | "candado"
  | "correo"
  | "enviar"
  | "descargar"
  | "externo"
  | "chevron"
  | "cerrar"
  | "filtro"
  | "actualizar"
  | "grafica"
  | "mas"
  | "pausa"
  | "play"
  | "buscar";

const TRAZOS: Record<NombreIcono, string> = {
  info: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z M12 16v-4 M12 8h.01",
  check: "M20 6 9 17l-5-5",
  alerta:
    "m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z M12 9v4 M12 17h.01",
  candado: "M7 11V7a5 5 0 0 1 10 0v4 M5 11h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2Z",
  correo: "M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z m22 6-10 7L2 6",
  enviar: "m22 2-7 20-4-9-9-4Z M22 2 11 13",
  descargar: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M7 10l5 5 5-5 M12 15V3",
  externo: "M15 3h6v6 M10 14 21 3 M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6",
  chevron: "m9 18 6-6-6-6",
  cerrar: "M18 6 6 18 M6 6l12 12",
  filtro: "M22 3H2l8 9.46V19l4 2v-8.54L22 3Z",
  actualizar: "M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8 M3 3v5h5 M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16 M16 16h5v5",
  grafica: "M3 3v18h18 M18 17V9 M13 17V5 M8 17v-3",
  mas: "M5 12h14 M12 5v14",
  pausa: "M6 4h4v16H6z M14 4h4v16h-4z",
  play: "m6 3 14 9-14 9V3Z",
  buscar: "m21 21-4.3-4.3 M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z",
};

export function Icono({ nombre, className = "h-4 w-4", titulo }: { nombre: NombreIcono; className?: string; titulo?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 ${className}`}
      aria-hidden={titulo ? undefined : "true"}
      role={titulo ? "img" : undefined}
    >
      {titulo ? <title>{titulo}</title> : null}
      <path d={TRAZOS[nombre]} />
    </svg>
  );
}
