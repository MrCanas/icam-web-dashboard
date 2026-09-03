import assert from "node:assert/strict";
import { test } from "node:test";

import type { UserContext } from "@/lib/auth/currentUser";
import {
  canAccessRouteKey,
  checkWriteAccess,
  getUserRole,
  hasZoneAccess,
  isPlatformAdmin,
} from "@/lib/auth/permissions";

type Zona = { zone_key: string; role: string };

function user(zones: Zona[], extra: Partial<UserContext> = {}): UserContext {
  return {
    id: "u1",
    email: "u@icam.test",
    name: "U",
    zones: zones as UserContext["zones"],
    isPlatformAdmin: false,
    deniedRouteKeys: [],
    ...extra,
  };
}

test("getUserRole devuelve el rol de la zona, o null si no la tiene", () => {
  const u = user([{ zone_key: "pm", role: "editor" }]);
  assert.equal(getUserRole(u, "pm"), "editor");
  assert.equal(getUserRole(u, "financiero"), null);
});

test("un rol desconocido se trata como sin rol", () => {
  const u = user([{ zone_key: "pm", role: "superjefe" }]);
  assert.equal(getUserRole(u, "pm"), null);
});

test("checkWriteAccess: lector no escribe, editor y admin sí", () => {
  assert.ok(checkWriteAccess(user([{ zone_key: "pm", role: "lector" }]), "pm"));
  assert.equal(checkWriteAccess(user([{ zone_key: "pm", role: "editor" }]), "pm"), null);
  assert.equal(checkWriteAccess(user([{ zone_key: "pm", role: "admin" }]), "pm"), null);
  assert.ok(checkWriteAccess(user([]), "pm"));
});

test("hasZoneAccess es true para cualquier rol de la zona", () => {
  assert.equal(hasZoneAccess(user([{ zone_key: "pm", role: "lector" }]), "pm"), true);
  assert.equal(hasZoneAccess(user([]), "pm"), false);
});

test("canAccessRouteKey exige zona y respeta la denylist", () => {
  const u = user([{ zone_key: "pm", role: "lector" }]);
  assert.equal(canAccessRouteKey(u, "pm.detalle"), true);
  assert.equal(
    canAccessRouteKey(user([{ zone_key: "pm", role: "lector" }], { deniedRouteKeys: ["pm.detalle"] }), "pm.detalle"),
    false,
  );
  // Sin la zona, no accede aunque no esté denegada.
  assert.equal(canAccessRouteKey(user([]), "pm.detalle"), false);
});

test("REGRESIÓN: canAccessRouteKey abre las keys sin zona (fail-open documentado)", () => {
  // zoneForRouteKey de una key inexistente da null → la función devuelve true.
  // Está así a propósito (rutas fuera del registry heredan permiso de zona),
  // pero es justo el borde que conviene fijar para que no cambie sin querer.
  assert.equal(canAccessRouteKey(user([]), "key.inexistente"), true);
});

test("isPlatformAdmin refleja el flag", () => {
  assert.equal(isPlatformAdmin(user([], { isPlatformAdmin: true })), true);
  assert.equal(isPlatformAdmin(user([])), false);
});
