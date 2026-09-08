/**
 * Paleta y constantes de las gráficas del tab Corporativas.
 *
 * Son los MISMOS colores que pintan las gráficas del tab Dashboard: navy
 * corporativo y oro de los tokens de marca, y el tercer tono sale de la paleta
 * del gráfico de sectores de portfolio (`ProjectSharePie`). Las dos zonas se
 * miran seguidas y tienen que parecer el mismo producto.
 *
 * Verificado con el validador de paletas (modo claro, superficie #FFFFFF, TODOS
 * los pares, no solo los adyacentes):
 *
 *   Separación CVD    peor par ΔE 17,4 (protan) · 15,9 (tritan)   ≥ 8   PASA
 *   Visión normal     peor par ΔE 19,1                            ≥ 15  PASA
 *
 * Es decir: distinguir una serie de otra, incluso con daltonismo, está resuelto
 * con holgura. Lo que el validador marca en rojo de esta paleta es que el navy
 * queda fuera de la banda de luminosidad y que los tres tonos van por debajo del
 * suelo de croma —o sea, que la paleta es sobria y poco saturada—, y que el oro
 * se queda en 2,77:1 de contraste contra el blanco. Nada de eso confunde dos
 * series entre sí; el aviso de contraste obliga a que el valor se pueda leer sin
 * depender del color, y así es: cada gráfica lleva leyenda con la cifra escrita
 * al lado, y la pantalla de Detalle repite todo en una tabla.
 *
 * TOPE DE TRES SERIES. Ninguna gráfica del tab pinta más a la vez. Si algún día
 * hicieran falta más, la salida es agrupar en «Otros» o partir en varias
 * gráficas, nunca inventar un cuarto color.
 */

/** Serie categórica, en orden fijo. Nunca se cicla ni se reordena por ranking. */
export const SERIE = {
  /** Navy ICAM (`icam-900`): las barras principales, igual que en Dashboard. */
  uno: "#1E2A56",
  /** Oro ICAM (`icam-gold`): la serie secundaria, igual que en Dashboard. */
  dos: "#B89660",
  /** Azul claro de la paleta del sectores de portfolio. Solo con tres series. */
  tres: "#6E7BB0",
} as const;

/**
 * Par divergente para magnitudes con signo (variación interanual, tramos del
 * puente de EBITDA), con gris neutro en el punto medio.
 *
 * El positivo es el navy de marca; el negativo, un ladrillo apagado elegido para
 * convivir con navy y oro en vez del rojo de alerta del portal (`#EF4444`), que
 * ahí significa «error» y no «cae respecto al año anterior».
 */
export const DIVERGENTE = {
  positivo: "#1E2A56",
  negativo: "#9B3B3B",
  neutro: "#8A8A8A",
} as const;

/**
 * Rampa secuencial de un solo tono (azul ICAM), claro → oscuro, con luminosidad
 * monótona verificada. Para el mapa de calor de estacionalidad.
 */
export const SECUENCIAL = [
  "#EDF0F7",
  "#C9D2E6",
  "#9FAED2",
  "#7286B9",
  "#4A61A0",
  "#2C3F7A",
  "#1E2A56",
] as const;

/** Cromo de la gráfica. Mismos valores que las gráficas de portfolio. */
export const GRID = "#EAEBEE";
export const EJE = "#8A8A8A";
/** La superficie de la tarjeta: separa los tramos apilados y los solapes. */
export const SUPERFICIE = "#FFFFFF";

/**
 * Ancho fijo del eje Y y márgenes laterales. Los comparten la gráfica principal y
 * su tira de apoyo, que es lo que las mantiene alineadas en el eje X: sin esto,
 * dos ejes Y de anchos distintos desplazan una respecto de la otra y las columnas
 * dejan de corresponderse.
 */
export const EJE_Y_ANCHO = 70;
export const MARGEN = { top: 8, right: 12, left: 4, bottom: 4 } as const;
/** Para las gráficas con etiqueta encima de la línea de corte, que si no se recorta. */
export const MARGEN_CON_ETIQUETA = { top: 22, right: 12, left: 4, bottom: 4 } as const;

/** Clase de la tarjeta que envuelve cada bloque. Igual que en portfolio. */
export const CLASE_TARJETA =
  "bg-card rounded-lg border border-subtle/50 shadow-sm p-3 sm:p-4 min-w-0";
