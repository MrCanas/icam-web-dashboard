import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { UserContext } from "@/lib/auth/currentUser";
import type { PmProjectNavItem } from "@/modules/pm/data/pmRepository";
import { pmLandingPath } from "@/modules/pm/logic/pm-landing";

function usuario(overrides: Partial<UserContext> = {}): UserContext {
  return {
    id: "u1",
    email: "u1@example.com",
    name: "U1",
    zones: [{ zone_key: "pm", role: "lector" }],
    isPlatformAdmin: false,
    deniedRouteKeys: [],
    ...overrides,
  };
}

function proyecto(idActivo: string): PmProjectNavItem {
  return { idActivo, nombre: null, actasCode: null };
}

describe("pmLandingPath", () => {
  it("con proyectos y pm.detalle visible aterriza en el primer proyecto", () => {
    assert.equal(
      pmLandingPath(usuario(), [proyecto("CA1"), proyecto("PC25")]),
      "/dashboard/pm/proyecto/CA1",
    );
  });

  it("codifica el id del activo en la URL", () => {
    assert.equal(
      pmLandingPath(usuario(), [proyecto("CA 1/β")]),
      `/dashboard/pm/proyecto/${encodeURIComponent("CA 1/β")}`,
    );
  });

  it("con pm.detalle denegado cae a la primera página visible no oculta", () => {
    assert.equal(
      pmLandingPath(usuario({ deniedRouteKeys: ["pm.detalle"] }), [proyecto("CA1")]),
      "/dashboard/pm/planificacion",
    );
  });

  it("sin proyectos cae a la primera página visible no oculta", () => {
    assert.equal(pmLandingPath(usuario(), []), "/dashboard/pm/planificacion");
  });

  it("si solo quedan páginas ocultas, devuelve la primera visible", () => {
    assert.equal(
      pmLandingPath(
        usuario({ deniedRouteKeys: ["pm.planificacion", "pm.proyectos", "pm.detalle"] }),
        [],
      ),
      "/dashboard/pm/actas",
    );
  });

  it("sin acceso a la zona pm devuelve null", () => {
    assert.equal(pmLandingPath(usuario({ zones: [] }), [proyecto("CA1")]), null);
  });
});
