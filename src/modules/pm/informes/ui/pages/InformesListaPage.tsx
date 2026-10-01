import type { UserContext } from "@/lib/auth/currentUser";

import { puedeEditarInformes } from "../../actions/acceso";
import { listarInformes } from "../../data/informesRepository";
import { ListaInformes } from "../ListaInformes";

/** Lista de informes: todos (Configuración) o los de un activo (subpestaña «Informes Trimestrales» del proyecto). */
export default async function InformesListaPage({ ctx, idActivo }: { ctx: UserContext; idActivo?: string }) {
  const r = await listarInformes(ctx, { idActivo });
  return (
    <ListaInformes
      informes={r.data ?? []}
      error={r.error}
      puedeEditar={puedeEditarInformes(ctx)}
      idActivo={idActivo}
    />
  );
}
