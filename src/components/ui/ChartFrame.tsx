/**
 * Hueco que ocupa una gráfica mientras se descarga su código.
 *
 * Las gráficas se cargan en diferido para sacar los 356 KB de recharts del
 * arranque, y sin un hueco de la altura exacta el contenido de debajo salta
 * cuando llegan. Un salto de maquetación se percibe como que la página va a
 * trompicones — justo lo contrario de lo que busca el diferido.
 *
 * Reproduce la tarjeta y el título reales, así que durante la carga la página ya
 * tiene su estructura y solo falta el trazado. `bodyClassName` debe llevar las
 * MISMAS clases de altura que el contenedor de la gráfica que sustituye.
 */
interface ChartFrameProps {
  /** El mismo título que pintará la gráfica: la tarjeta no debe cambiar al llegar. */
  title?: string;
  /** Clases de altura idénticas a las del contenedor real. */
  bodyClassName: string;
  /**
   * Clases del `<h3>` real. Se pasan enteras en vez de elegir entre tamaños
   * porque en el módulo conviven tres combinaciones distintas y el título no
   * debe moverse ni un píxel cuando llega la gráfica.
   */
  titleClassName?: string;
  /** Altura en píxeles cuando la gráfica la calcula a partir de sus datos. */
  bodyStyle?: React.CSSProperties;
}

const TITULO_POR_DEFECTO = "text-base font-semibold text-text-primary mb-2 sm:mb-3";

export function ChartFrame({
  title,
  bodyClassName,
  titleClassName = TITULO_POR_DEFECTO,
  bodyStyle,
}: ChartFrameProps) {
  return (
    <section
      className="bg-card rounded-lg border border-subtle/50 shadow-sm p-3 sm:p-4 min-w-0"
      role="status"
      aria-live="polite"
    >
      <span className="sr-only">{title ? `Cargando ${title}…` : "Cargando gráfica…"}</span>
      {title ? (
        <h3 className={titleClassName}>{title}</h3>
      ) : null}
      <div
        aria-hidden="true"
        style={bodyStyle}
        className={`animate-pulse rounded-md bg-subtle/40 ${bodyClassName}`}
      />
    </section>
  );
}
