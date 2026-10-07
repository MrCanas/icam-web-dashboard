import { Aviso } from "@/components/ui/Aviso";
import { EncabezadoDePagina } from "@/components/ui/EncabezadoDePagina";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { getUserRole } from "@/lib/auth/permissions";
import { puedeCambiarAjustes } from "@/modules/comunicaciones/logic/controles";
import { loadDatosDeEnvios } from "@/modules/comunicaciones/logic/loadComunicaciones";
import { COMUNICACIONES_PATH, ZONA_COMUNICACIONES } from "@/modules/comunicaciones/logic/paths";
import { AjustesForm } from "@/modules/comunicaciones/ui/components/AjustesForm";
import { Candado } from "@/modules/comunicaciones/ui/components/ui/Candado";

/**
 * Ajustes de envío: el interruptor general, el modo, la cuenta de pruebas, los
 * remitentes y el tope diario.
 *
 * Los ve cualquiera con la zona, porque explican por qué un envío sale o no. Los
 * cambia solo un administrador de la zona.
 */
export default async function AjustesPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const datos = await loadDatosDeEnvios(user);
  const sinPermiso = puedeCambiarAjustes(getUserRole(user, ZONA_COMUNICACIONES));

  return (
    <div className="min-w-0 space-y-3 sm:space-y-4">
      <EncabezadoDePagina
        ruta={[{ etiqueta: "Comunicaciones", href: COMUNICACIONES_PATH }, { etiqueta: "Ajustes" }]}
        titulo="Ajustes de envío"
        meta="Lo que decide si un correo sale, en qué modo y por dónde."
      />

      <Candado datos={datos} conEnlace={false} />

      {sinPermiso ? (
        <Aviso tipo="info">{sinPermiso}</Aviso>
      ) : datos.ajustes ? (
        <AjustesForm ajustes={datos.ajustes} cuentasDePrueba={datos.cuentasPermitidas} />
      ) : null}
    </div>
  );
}
