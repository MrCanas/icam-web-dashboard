import { getCurrentUser } from "@/lib/auth/currentUser";
import {
  aniosDisponibles,
  buildKpis,
  matrizEstacionalidad,
  periodoCorte,
  serieCuentasOficiales,
  serieDe,
  serieEstructuraGastos,
  serieVarInteranual,
} from "@/modules/corporativo/logic/calculations";
import {
  sanitizeDesde,
  sanitizeGranularidad,
  sanitizePrevision,
  sanitizeSociedad,
} from "@/modules/corporativo/logic/corporativoParams";
import { loadCorporativoPage } from "@/modules/corporativo/logic/loadCorporativoPage";
import { corporativoPaths } from "@/modules/corporativo/logic/paths";
import { CorporativoTabla } from "@/modules/corporativo/ui/CorporativoTabla";
import {
  BalanceChart,
  CuentasVsGestionChart,
} from "@/modules/corporativo/ui/CuentasOficialesChart";
import { CorporativoVacio, ErrorCorporativo } from "@/modules/corporativo/ui/EstadosCorporativo";
import { EstacionalidadHeatmap } from "@/modules/corporativo/ui/EstacionalidadHeatmap";
import { EstructuraGastosChart } from "@/modules/corporativo/ui/EstructuraGastosChart";
import { MetodologiaCorporativa } from "@/modules/corporativo/ui/MetodologiaCorporativa";
import { VarInteranualChart } from "@/modules/corporativo/ui/VarInteranualChart";
import { BloqueGrafica, SinDatos } from "@/modules/corporativo/ui/charts/BloqueGrafica";
import { CorporativoToolbar } from "@/modules/corporativo/ui/toolbar/CorporativoToolbar";

interface DetallePageProps {
  searchParams: Promise<{
    sociedad?: string;
    granularidad?: string;
    desde?: string;
    prevision?: string;
  }>;
}

/**
 * Segunda pantalla del tab: lo que no cabe en la ejecutiva sin convertirla en un
 * scroll interminable. Estructura de gastos, variación interanual,
 * estacionalidad, las cuentas depositadas de GIIC, la tabla completa y la
 * metodología del maestro.
 *
 * Comparte la barra flotante y sus parámetros de URL con la ejecutiva, así que
 * pasar de una a otra conserva sociedad, granularidad y recorte.
 */
export default async function CorporativoDetallePage({ searchParams }: DetallePageProps) {
  const params = await searchParams;
  const ctx = await getCurrentUser();
  if (!ctx) return <ErrorCorporativo mensaje="No autorizado" />;

  const sociedad = sanitizeSociedad(params.sociedad);
  const granularidad = sanitizeGranularidad(params.granularidad);
  const desde = sanitizeDesde(params.desde);
  const prevision = sanitizePrevision(params.prevision);

  const { filas, diccionario, notas, error } = await loadCorporativoPage(ctx);
  if (error) return <ErrorCorporativo mensaje={`Error cargando el maestro corporativo: ${error}`} />;
  if (filas.length === 0) return <CorporativoVacio />;

  const serie = serieDe(filas, { sociedad, granularidad, desde, incluirPrevision: prevision });
  const corte = periodoCorte(serie);
  const kpis = buildKpis(filas, sociedad);

  // La estacionalidad es siempre trimestral: en granularidad anual no hay matriz
  // que construir, así que se pide la serie trimestral aparte.
  const serieTrimestral = serieDe(filas, {
    sociedad,
    granularidad: "trimestre",
    desde,
    incluirPrevision: prevision,
  });
  const cuentas = serieCuentasOficiales(filas);
  const variaciones = serieVarInteranual(serie);
  const etiquetaGranularidad = granularidad === "anio" ? "por año" : "por trimestre";

  return (
    <div className="min-w-0 space-y-3 sm:space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:gap-4 xl:grid-cols-2">
        <BloqueGrafica
          titulo="Estructura de gastos"
          subtitulo={`${sociedad} · ${etiquetaGranularidad}`}
          ancho
        >
          {serie.length > 0 ? (
            <EstructuraGastosChart datos={serieEstructuraGastos(serie)} periodoCorte={corte} />
          ) : (
            <SinDatos mensaje="Sin periodos para los filtros seleccionados." alto={250} />
          )}
        </BloqueGrafica>

        <BloqueGrafica
          titulo="Variación interanual de la facturación"
          subtitulo={`${sociedad} · contra el mismo periodo del año anterior`}
        >
          {variaciones.length > 0 ? (
            <VarInteranualChart datos={variaciones} />
          ) : (
            <SinDatos mensaje="No hay periodo anterior con el que comparar." alto={240} />
          )}
        </BloqueGrafica>

        <BloqueGrafica
          titulo="Estacionalidad"
          subtitulo={`${sociedad} · facturación por año y trimestre`}
          nota="El color ordena la magnitud; la cifra va escrita en cada celda. Borde punteado, previsión."
        >
          <EstacionalidadHeatmap matriz={matrizEstacionalidad(serieTrimestral)} />
        </BloqueGrafica>

        <BloqueGrafica
          titulo="Cuentas depositadas frente a gestión"
          subtitulo="GIIC · cifra de negocio oficial y facturación del cash flow"
          nota="Solo GIIC: es la única sociedad de la que el maestro trae cuentas depositadas."
        >
          {cuentas.length > 0 ? (
            <CuentasVsGestionChart datos={cuentas} />
          ) : (
            <SinDatos mensaje="El maestro no trae cuentas depositadas." alto={240} />
          )}
        </BloqueGrafica>

        <BloqueGrafica
          titulo="Balance oficial de GIIC"
          subtitulo="A cierre de cada ejercicio"
        >
          {cuentas.length > 0 ? (
            <BalanceChart datos={cuentas} />
          ) : (
            <SinDatos mensaje="El maestro no trae balance." alto={220} />
          )}
        </BloqueGrafica>

        <BloqueGrafica
          titulo="Detalle por periodo"
          subtitulo={`${sociedad} · ${etiquetaGranularidad} · ${serie.length} periodos`}
          ancho
        >
          <CorporativoTabla filas={serie} />
        </BloqueGrafica>

        <MetodologiaCorporativa diccionario={diccionario} notas={notas} />
      </div>

      <CorporativoToolbar
        basePath={corporativoPaths.detalle}
        sociedad={sociedad}
        granularidad={granularidad}
        desde={desde}
        prevision={prevision}
        anios={aniosDisponibles(filas)}
        resumen={`${serie.length} periodos · cierre ${kpis.periodo ?? "—"}`}
      />
    </div>
  );
}
