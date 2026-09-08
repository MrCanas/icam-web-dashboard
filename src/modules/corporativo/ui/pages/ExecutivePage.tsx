import { getCurrentUser } from "@/lib/auth/currentUser";
import {
  aniosDisponibles,
  buildKpis,
  comparativaSociedades,
  mixFacturacion,
  periodoCorte,
  periodoReferencia,
  puenteEbitda,
  serieAum,
  serieCaja,
  serieDe,
  serieFacturacionEbitda,
} from "@/modules/corporativo/logic/calculations";
import {
  sanitizeDesde,
  sanitizeGranularidad,
  sanitizePrevision,
  sanitizeSociedad,
  tipoPeriodoDe,
} from "@/modules/corporativo/logic/corporativoParams";
import { loadCorporativoPage } from "@/modules/corporativo/logic/loadCorporativoPage";
import { corporativoPaths } from "@/modules/corporativo/logic/paths";
import { SOCIEDADES } from "@/modules/corporativo/types";
import { AumVehiculosChart } from "@/modules/corporativo/ui/AumVehiculosChart";
import { CajaChart } from "@/modules/corporativo/ui/CajaChart";
import { ComparativaSociedades } from "@/modules/corporativo/ui/ComparativaSociedades";
import { CorporativoVacio, ErrorCorporativo } from "@/modules/corporativo/ui/EstadosCorporativo";
import { FacturacionEbitdaChart } from "@/modules/corporativo/ui/FacturacionEbitdaChart";
import { KpisCorporativos } from "@/modules/corporativo/ui/KpisCorporativos";
import { MixFacturacionChart } from "@/modules/corporativo/ui/MixFacturacionChart";
import { PuenteEbitdaChart } from "@/modules/corporativo/ui/PuenteEbitdaChart";
import { BloqueGrafica, SinDatos } from "@/modules/corporativo/ui/charts/BloqueGrafica";
import { CorporativoToolbar } from "@/modules/corporativo/ui/toolbar/CorporativoToolbar";

interface ExecutivePageProps {
  searchParams: Promise<{
    sociedad?: string;
    granularidad?: string;
    desde?: string;
    prevision?: string;
  }>;
}

/**
 * Pantalla ejecutiva del tab Corporativas: cinco KPI sobre el último trimestre
 * cerrado y seis bloques que cuentan de dónde salen.
 *
 * Server Component: todo el filtrado y la agregación ocurren aquí, y las
 * gráficas reciben datos ya masticados. Lo que llega al navegador es solo
 * Recharts y la barra flotante.
 */
export default async function CorporativoExecutivePage({ searchParams }: ExecutivePageProps) {
  const params = await searchParams;
  const ctx = await getCurrentUser();
  if (!ctx) return <ErrorCorporativo mensaje="No autorizado" />;

  const sociedad = sanitizeSociedad(params.sociedad);
  const granularidad = sanitizeGranularidad(params.granularidad);
  const desde = sanitizeDesde(params.desde);
  const prevision = sanitizePrevision(params.prevision);

  const { filas, error } = await loadCorporativoPage(ctx);
  if (error) return <ErrorCorporativo mensaje={`Error cargando el maestro corporativo: ${error}`} />;
  if (filas.length === 0) return <CorporativoVacio />;

  const serie = serieDe(filas, { sociedad, granularidad, desde, incluirPrevision: prevision });
  const corte = periodoCorte(serie);
  const referencia = periodoReferencia(serie);
  const kpis = buildKpis(filas, sociedad);

  const etiquetaPeriodo = referencia?.periodo ?? "sin datos";
  const pasos = puenteEbitda(referencia);
  const mix = mixFacturacion(referencia);
  const aum = serieAum(serie);
  const hayAum = aum.some((p) => p.total !== null);
  const comparativa = comparativaSociedades(
    filas,
    referencia?.periodo ?? null,
    tipoPeriodoDe(granularidad),
    SOCIEDADES,
  );

  return (
    <div className="min-w-0 space-y-3 sm:space-y-4">
      <KpisCorporativos kpis={kpis} sociedad={sociedad} />

      <div className="grid grid-cols-1 gap-3 sm:gap-4 xl:grid-cols-2">
        <BloqueGrafica
          titulo="Facturación y EBITDA"
          subtitulo={`${sociedad} · por ${granularidad === "anio" ? "año" : "trimestre"}`}
          ancho
        >
          {serie.length > 0 ? (
            <FacturacionEbitdaChart datos={serieFacturacionEbitda(serie)} periodoCorte={corte} />
          ) : (
            <SinDatos mensaje="Sin periodos para los filtros seleccionados." alto={300} />
          )}
        </BloqueGrafica>

        <BloqueGrafica
          titulo="Comparativa por sociedad"
          subtitulo={etiquetaPeriodo}
          nota="GRUPO es la suma de GIIC e ICI+ICAM, sin eliminaciones entre sociedades."
        >
          <ComparativaSociedades filas={comparativa} destacada={sociedad} />
        </BloqueGrafica>

        <BloqueGrafica
          titulo="Puente de EBITDA"
          subtitulo={`${sociedad} · ${etiquetaPeriodo}`}
          nota={
            pasos.some((p) => p.nombre === "Gastos totales")
              ? "Sin desglose variables/estructura en este periodo: se muestra el gasto total."
              : undefined
          }
        >
          {pasos.length > 0 ? (
            <PuenteEbitdaChart pasos={pasos} />
          ) : (
            <SinDatos mensaje="Este periodo no trae facturación o EBITDA." />
          )}
        </BloqueGrafica>

        <BloqueGrafica titulo="Mix de facturación del grupo" subtitulo={etiquetaPeriodo}>
          {mix.length > 0 ? (
            <MixFacturacionChart porciones={mix} />
          ) : (
            <SinDatos mensaje="El maestro no desglosa la facturación por sociedad en este periodo." />
          )}
        </BloqueGrafica>

        <BloqueGrafica
          titulo="Capital bajo gestión"
          subtitulo={`${sociedad} · saldo a cierre de cada periodo`}
          nota="El AUM es un saldo a una fecha: cada barra es la foto al cierre, no lo captado en el periodo."
        >
          {hayAum ? (
            <AumVehiculosChart datos={aum} periodoCorte={corte} />
          ) : (
            <SinDatos mensaje={`${sociedad} no gestiona capital de terceros.`} />
          )}
        </BloqueGrafica>

        <BloqueGrafica
          titulo="Caja y generación del periodo"
          subtitulo={`${sociedad} · saldo a cierre frente a EBITDA de caja`}
          ancho
          nota="El EBITDA de caja es facturación menos gastos sin periodificar; el saldo es el depósito acumulado."
        >
          {serie.length > 0 ? (
            <CajaChart datos={serieCaja(serie)} periodoCorte={corte} />
          ) : (
            <SinDatos mensaje="Sin periodos para los filtros seleccionados." />
          )}
        </BloqueGrafica>
      </div>

      <CorporativoToolbar
        basePath={corporativoPaths.executive}
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
