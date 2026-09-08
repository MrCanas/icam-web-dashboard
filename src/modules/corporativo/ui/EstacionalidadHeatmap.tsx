import { fmtEurosCompact } from "@/lib/formatters";
import type { MatrizEstacionalidad } from "@/modules/corporativo/logic/calculations";
import { SECUENCIAL } from "@/modules/corporativo/ui/charts/tokens";

const TRIMESTRES = [1, 2, 3, 4];

/**
 * Mapa de calor año × trimestre de la facturación.
 *
 * Sin librería de gráficas: es una rejilla, y una rejilla CSS la dibuja mejor
 * que un SVG. Server Component, así que no manda nada de JavaScript al
 * navegador.
 *
 * La escala es secuencial —un solo tono, claro a oscuro— porque lo que codifica
 * es magnitud, no identidad ni polaridad. Cada celda lleva su cifra escrita
 * encima: el color ordena de un vistazo y el número da el dato, de modo que la
 * lectura no depende de distinguir dos azules contiguos.
 */
export function EstacionalidadHeatmap({ matriz }: { matriz: MatrizEstacionalidad }) {
  if (matriz.anios.length === 0) {
    return <p className="text-sm text-text-muted">Sin trimestres que representar.</p>;
  }

  function paso(valor: number | null): string {
    if (valor === null || matriz.maximo <= 0) return "transparent";
    const indice = Math.min(
      SECUENCIAL.length - 1,
      Math.floor((valor / matriz.maximo) * SECUENCIAL.length),
    );
    return SECUENCIAL[indice]!;
  }

  /**
   * Tinta que contrasta con el paso de la rampa. A partir del cuarto el fondo ya
   * es oscuro y el texto tiene que invertirse.
   *
   * La usan el texto Y el borde de previsión: un gris fijo se veía sobre los
   * pasos claros y desaparecía sobre los oscuros, justo donde caen 2026 3T y 4T,
   * que son precisamente los periodos que hay que marcar.
   */
  function tinta(valor: number | null): string {
    if (valor === null || matriz.maximo <= 0) return "#6E6E6E";
    const indice = Math.floor((valor / matriz.maximo) * SECUENCIAL.length);
    return indice >= 4 ? "#FFFFFF" : "#1E2A56";
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[420px] border-separate border-spacing-[2px] text-sm">
        <caption className="sr-only">Facturación por año y trimestre</caption>
        <thead>
          <tr>
            <th scope="col" className="px-1 py-1 text-left text-xs font-medium text-text-muted">
              Año
            </th>
            {TRIMESTRES.map((t) => (
              <th
                key={t}
                scope="col"
                className="px-1 py-1 text-center text-xs font-medium text-text-muted"
              >
                {t}T
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matriz.anios.map((anio) => (
            <tr key={anio}>
              <th
                scope="row"
                className="px-1 py-1 text-left text-xs font-medium text-text-primary"
              >
                {anio}
              </th>
              {TRIMESTRES.map((t) => {
                const celda = matriz.celdas.find((c) => c.anio === anio && c.trimestre === t);
                if (!celda) {
                  return (
                    <td
                      key={t}
                      className="rounded border border-dashed border-subtle px-1 py-2 text-center text-xs text-text-muted"
                    >
                      —
                    </td>
                  );
                }
                return (
                  <td
                    key={t}
                    className="rounded px-1 py-2 text-center text-xs font-medium tabular-nums"
                    style={{
                      backgroundColor: paso(celda.facturacion),
                      color: tinta(celda.facturacion),
                      // La previsión se marca con borde punteado, no con otro color:
                      // el color ya está ocupado codificando la magnitud. El
                      // borde va en la tinta de la celda para que se vea en
                      // cualquier paso de la rampa.
                      outline: celda.cerrado
                        ? undefined
                        : `2px dashed ${tinta(celda.facturacion)}`,
                      outlineOffset: "-3px",
                    }}
                    title={`${anio} ${t}T · ${fmtEurosCompact(celda.facturacion)}${
                      celda.cerrado ? "" : " (previsión)"
                    }`}
                  >
                    {fmtEurosCompact(celda.facturacion)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
