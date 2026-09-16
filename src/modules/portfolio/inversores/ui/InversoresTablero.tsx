"use client";

import { fmtEurosCompact, fmtInt } from "@/lib/formatters";
import {
  cuentasEnPromocion,
  cuentasEnTramo,
  cuentasEnTrimestre,
} from "@/modules/portfolio/inversores/logic/inversoresModel";
import type { ModeloInversores } from "@/modules/portfolio/inversores/types";
import { AportesRepartosChart } from "@/modules/portfolio/inversores/ui/charts/AportesRepartosChart";
import { CapitalPorPromocionChart } from "@/modules/portfolio/inversores/ui/charts/CapitalPorPromocionChart";
import { CuentasPorTramoChart } from "@/modules/portfolio/inversores/ui/charts/CuentasPorTramoChart";
import { TopCuentasChart } from "@/modules/portfolio/inversores/ui/charts/TopCuentasChart";
import { InversoresTabla } from "@/modules/portfolio/inversores/ui/components/InversoresTabla";
import { KpisInversores } from "@/modules/portfolio/inversores/ui/components/KpisInversores";
import { useInversoresDrilldown } from "@/modules/portfolio/inversores/ui/drilldown/useInversoresDrilldown";

/**
 * La parte interactiva de la pantalla.
 *
 * Existe como componente de cliente propio para que el drill-down sea UNO solo
 * para toda la página: KPIs, las cuatro gráficas y la tabla comparten la misma
 * pila y, por tanto, el mismo `<Modal>`. Un hook por gráfica montaría cinco
 * diálogos que se pelearían por el scroll del fondo y por el foco.
 *
 * Todo llega ya agregado por props desde el Server Component. No hay `fetch` en
 * cliente: el nivel 2 del drill-down abre instantáneo, sin un estado de carga
 * dentro de un diálogo, que es donde peor sienta.
 */
export function InversoresTablero({ modelo }: { modelo: ModeloInversores }) {
  const drilldown = useInversoresDrilldown();
  const { cuentas, kpis, tramos, porPromocion, porTrimestre, topCuentas } = modelo;

  return (
    <div className="space-y-3 sm:space-y-4">
      <KpisInversores kpis={kpis} cuentas={cuentas} onAbrir={drilldown.abrirCuentas} />

      <div className="grid grid-cols-1 gap-3 sm:gap-4 xl:grid-cols-2">
        <CuentasPorTramoChart
          tramos={tramos}
          onAbrir={(tramo) =>
            drilldown.abrirCuentas({
              titulo: `Tramo ${tramo.etiqueta}`,
              subtitulo: `${fmtInt(tramo.numCuentas)} cuentas · ${fmtEurosCompact(tramo.total)}`,
              cuentas: cuentasEnTramo(cuentas, tramo.id),
            })
          }
        />

        <TopCuentasChart
          topCuentas={topCuentas}
          totalComprometido={kpis.comprometido}
          onAbrir={(cuenta) => drilldown.abrirCuenta(cuenta, "10 mayores cuentas")}
        />

        <CapitalPorPromocionChart
          porPromocion={porPromocion}
          onAbrir={(promocion) =>
            drilldown.abrirCuentas({
              titulo: promocion.nombre,
              subtitulo: `${fmtInt(promocion.numCuentas)} cuentas · ${fmtEurosCompact(
                promocion.comprometido,
              )} comprometidos`,
              cuentas: cuentasEnPromocion(cuentas, promocion.zohoId),
            })
          }
        />

        <AportesRepartosChart
          porTrimestre={porTrimestre}
          onAbrir={(punto) =>
            drilldown.abrirCuentas({
              titulo: punto.periodo,
              subtitulo: `${fmtEurosCompact(punto.aportes)} aportados · ${fmtEurosCompact(
                Math.abs(punto.repartos),
              )} repartidos`,
              cuentas: cuentasEnTrimestre(cuentas, punto),
            })
          }
        />
      </div>

      <section className="space-y-2">
        <h2 className="text-base font-semibold text-text-primary">Todas las cuentas</h2>
        <InversoresTabla cuentas={cuentas} onAbrirCuenta={(cuenta) => drilldown.abrirCuenta(cuenta)} />
      </section>

      {drilldown.modal}
    </div>
  );
}
