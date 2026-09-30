import type { UserContext } from "@/lib/auth/currentUser";

import { puedeEditarInformes } from "../../actions/acceso";
import { listarProyectos } from "../../data/informesRepository";
import { listaTrimestres, trimestrePorDefecto } from "../../logic/trimestre";
import { PasoDatos } from "../asistente/PasoDatos";

/** Paso 0 del asistente: proyecto y trimestres. */
export default async function NuevoInformePage({ ctx, activo }: { ctx: UserContext; activo: string | null }) {
  const r = await listarProyectos(ctx);
  return (
    <PasoDatos
      proyectos={r.data ?? []}
      error={r.error}
      activoInicial={activo}
      trimestres={listaTrimestres()}
      trimestrePorDefecto={trimestrePorDefecto()}
      puedeEditar={puedeEditarInformes(ctx)}
    />
  );
}
