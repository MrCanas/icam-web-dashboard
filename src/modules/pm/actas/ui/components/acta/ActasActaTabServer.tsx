import type { UserContext } from "@/lib/auth/currentUser";
import { fetchActasActaView } from "@/modules/pm/actas/data/actaRepository";
import {
  actaQueryForState,
  actaQueryKey,
  parseActaUrlState,
} from "@/modules/pm/actas/logic/acta-url-state";

import { ActasActaTab } from "./ActasActaTab";

interface ActasActaTabServerProps {
  ctx: UserContext;
  projectId: string;
  projectCode: string;
  searchParams: Record<string, string | string[] | undefined>;
}

/**
 * Carga la vista de acta en el servidor, dentro del Suspense de la página, en
 * vez de esperar a hidratar y lanzar una Server Action (que repetía la
 * autenticación). El cliente solo vuelve a pedir datos si su consulta no
 * coincide con esta (p. ej. el día cambia entre el reloj del servidor y el del
 * navegador).
 */
export async function ActasActaTabServer({
  ctx,
  projectId,
  projectCode,
  searchParams,
}: ActasActaTabServerProps) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    // Como URLSearchParams.get en el cliente: con claves repetidas, la primera.
    const first = Array.isArray(value) ? value[0] : value;
    if (first !== undefined) params.set(key, first);
  }
  const query = actaQueryForState(projectId, parseActaUrlState(params));
  const { data, error } = await fetchActasActaView(ctx, query);

  return (
    <ActasActaTab
      projectId={projectId}
      projectCode={projectCode}
      initial={{ key: actaQueryKey(query), data, error }}
    />
  );
}
