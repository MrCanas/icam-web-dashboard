import assert from "node:assert/strict";
import { test } from "node:test";

import {
  canManageLogEntry,
  canShowLogEntryManageActions,
  isLogEntryManageDisabled,
} from "@/modules/pm/actas/logic/log-entry-access";

const entry = (over: Partial<Parameters<typeof canManageLogEntry>[0]> = {}) => ({
  authorId: "autor-1",
  deletedAt: null,
  source: null,
  ...over,
});

test("el autor gestiona su propia entrada", () => {
  assert.equal(canManageLogEntry(entry(), "autor-1"), true);
});

test("otro usuario no la gestiona; un admin pm sí", () => {
  assert.equal(canManageLogEntry(entry(), "otro"), false);
  assert.equal(canManageLogEntry(entry(), "otro", true), true);
});

test("las entradas importadas (snapshot / monday) no se gestionan ni siendo admin", () => {
  assert.equal(canManageLogEntry(entry({ source: "snapshot" }), "autor-1"), false);
  assert.equal(canManageLogEntry(entry({ source: "monday_update" }), "autor-1", true), false);
});

test("una entrada borrada o sin usuario no se gestiona", () => {
  assert.equal(canManageLogEntry(entry({ deletedAt: "2026-01-01" }), "autor-1"), false);
  assert.equal(canManageLogEntry(entry(), null), false);
});

test("los iconos de gestión solo salen con permiso de escritura", () => {
  assert.equal(canShowLogEntryManageActions(entry(), true), true);
  assert.equal(canShowLogEntryManageActions(entry(), false), false);
  assert.equal(canShowLogEntryManageActions(entry({ source: "snapshot" }), true), false);
});

test("deshabilitado = visible pero no gestionable (entrada de otro)", () => {
  assert.equal(isLogEntryManageDisabled(entry(), "otro", false, true), true);
  // El autor lo ve habilitado, no deshabilitado.
  assert.equal(isLogEntryManageDisabled(entry(), "autor-1", false, true), false);
});
