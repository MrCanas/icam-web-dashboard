import { Aviso } from "@/components/ui/Aviso";
import { EncabezadoDePagina } from "@/components/ui/EncabezadoDePagina";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { checkWriteAccess } from "@/lib/auth/permissions";
import { mismoDia } from "@/modules/comunicaciones/logic/controles";
import { loadDatosDeEnvios, loadNueva } from "@/modules/comunicaciones/logic/loadComunicaciones";
import { COMUNICACIONES_PATH, ZONA_COMUNICACIONES } from "@/modules/comunicaciones/logic/paths";
import { entornoDe } from "@/modules/comunicaciones/ui/components/asistente/entorno";
import { NuevaComunicacion } from "@/modules/comunicaciones/ui/components/asistente/PasoAudiencia";
import { NuevaForm } from "@/modules/comunicaciones/ui/components/NuevaForm";

/**
 * Nueva comunicación: a quién va dirigida.
 *
 * Enseña cuántas cuentas tiene cada audiencia ANTES de elegirla y de qué hora
 * son los datos. Al terminar no se envía nada: se guarda la lista y se pasa a
 * revisarla.
 *
 * Es el primer paso del asistente de envío, a pantalla completa. `?clasica=1`
 * abre el formulario de antes mientras se valida el asistente.
 */
export default async function NuevaPage({ clasica = false }: { clasica?: boolean }) {
  const user = await getCurrentUser();
  if (!user) return null;

  const sinEscritura = checkWriteAccess(user, ZONA_COMUNICACIONES);
  const [{ recuento, datosZohoAt, sinMigracion, error }, envios] = await Promise.all([loadNueva(user), loadDatosDeEnvios(user)]);

  // «Hoy» lo decide el servidor, con la fecha de Madrid: el mismo corte que aplica al preparar.
  if (!clasica && !sinEscritura && !sinMigracion && !error) {
    return (
      <NuevaComunicacion
        recuento={recuento}
        datosZohoAt={datosZohoAt}
        datosDeHoy={mismoDia(datosZohoAt, new Date())}
        entorno={entornoDe(envios)}
      />
    );
  }

  return (
    <div className="min-w-0 space-y-3 sm:space-y-4">
      <EncabezadoDePagina
        ruta={[{ etiqueta: "Comunicaciones", href: COMUNICACIONES_PATH }, { etiqueta: "Nueva" }]}
        titulo="Nueva comunicación"
        meta="Preparar no envía nada: calcula a quién iría y después se revisa la lista, se prueba y se confirma."
      />

      {sinMigracion ? (
        <Aviso tipo="aviso">
          Las tablas de Inversores no existen todavía en la base de datos (migración <code>040_inversores</code>).
        </Aviso>
      ) : null}
      {error ? <Aviso tipo="error">No se pudieron leer los datos: {error}</Aviso> : null}

      {sinEscritura ? (
        <Aviso tipo="info">Tu rol en Comunicaciones es de lectura: puedes ver el historial, pero no preparar comunicaciones.</Aviso>
      ) : !sinMigracion && !error ? (
        // «Hoy» lo decide el servidor, con la fecha de Madrid: el mismo corte que aplica al preparar.
        <NuevaForm recuento={recuento} datosZohoAt={datosZohoAt} datosDeHoy={mismoDia(datosZohoAt, new Date())} />
      ) : null}
    </div>
  );
}
