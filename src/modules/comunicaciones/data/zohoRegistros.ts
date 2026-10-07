import { getZohoConfig, zohoApi, type ZohoConfig } from "@/lib/zoho/client";

/**
 * Un registro de Zoho con TODOS sus campos. Solo LECTURA.
 *
 * El espejo de Inversores guarda únicamente los campos mapeados, y una
 * plantilla puede combinar cualquiera (`CIF_Empresa`, `Apellido`…). Para la
 * vista previa se lee el registro entero en vivo: una llamada por vista previa,
 * no por visita.
 */
export async function leerRegistro(
  modulo: string,
  id: string,
  cfg: ZohoConfig = getZohoConfig({ conModulo: false }),
): Promise<Record<string, unknown> | null> {
  const r = await zohoApi<{ data?: Record<string, unknown>[] }>(
    `/${encodeURIComponent(modulo)}/${encodeURIComponent(id)}`,
    undefined,
    cfg,
  );
  return r.data?.[0] ?? null;
}
