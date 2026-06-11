import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildElementsUniqueIndex,
  isMondaySubitemsGroup,
  lookupElementMapping,
  resolveCategoryForSubitem,
  resolveCategoryFromMondayGroup,
  resolveElementFromMapping,
  type GroupMappingFrom07,
  type UniqueElementMapping,
} from "../migration-resolve";

const COMERCIAL_GROUP_ID = "a322a613-14af-4ac5-86eb-a57ee3aa486b";
const PM_GROUP_ID = "ff390dae-443e-4a50-9132-bed05868c7ed";

const groupMappings: GroupMappingFrom07[] = [
  {
    monday_group_id: "comercial",
    monday_title: "COMERCIAL",
    master_group_id: COMERCIAL_GROUP_ID,
    master_group_name: "COMERCIAL",
    mapped: true,
    unmapped: false,
    match_method: "normalized",
    manual_master_group_id: null,
    notes: null,
  },
  {
    monday_group_id: "business plan - edificios",
    monday_title: "BUSINESS PLAN - EDIFICIOS",
    master_group_id: null,
    master_group_name: null,
    mapped: false,
    unmapped: true,
    match_method: "none",
    manual_master_group_id: null,
    notes: null,
  },
  {
    monday_group_id: "ficc - societario",
    monday_title: "FICC - SOCIETARIO",
    master_group_id: "1678bc10-3d55-4002-aaef-4e8bdaab9206",
    master_group_name: "SOCIETARIO",
    mapped: true,
    unmapped: false,
    match_method: "alias_exact",
    manual_master_group_id: null,
    notes: null,
  },
  {
    monday_group_id: "property management",
    monday_title: "PROPERTY MANAGEMENT",
    master_group_id: PM_GROUP_ID,
    master_group_name: "PROPERTY MANAGEMENT",
    mapped: true,
    unmapped: false,
    match_method: "normalized",
    manual_master_group_id: null,
    notes: null,
  },
  {
    monday_group_id: "grupo custom padre",
    monday_title: "GRUPO CUSTOM PADRE",
    master_group_id: null,
    master_group_name: null,
    mapped: false,
    unmapped: true,
    match_method: "none",
    manual_master_group_id: null,
    notes: null,
  },
];

const elementsUnique: UniqueElementMapping[] = [
  {
    monday_name: "Gobernanza",
    monday_name_normalized: "gobernanza",
    master_element_id: "faa95bf6-7112-4777-a6a5-b1099c3210c7",
    master_element_name: "Gobernanza",
    master_group_id: "1678bc10-3d55-4002-aaef-4e8bdaab9206",
    mapped: true,
    unmapped: false,
    match_type: "normalized",
    suggested_master_name: null,
    manual_master_element_id: null,
    notes: null,
    matched_via_parent: null,
  },
  {
    monday_name: "Ascensor",
    monday_name_normalized: "ascensor",
    master_element_id: null,
    master_element_name: null,
    master_group_id: null,
    mapped: false,
    unmapped: true,
    match_type: null,
    suggested_master_name: null,
    manual_master_element_id: null,
    notes: "Sin coincidencia",
    matched_via_parent: null,
  },
];

const index = buildElementsUniqueIndex(elementsUnique);

describe("resolveCategoryFromMondayGroup", () => {
  it("grupo mapeado → master_group_id del 07", () => {
    const cat = resolveCategoryFromMondayGroup("COMERCIAL", groupMappings);
    assert.equal(cat.master_group_id, COMERCIAL_GROUP_ID);
    assert.equal(cat.name, "COMERCIAL");
  });

  it("grupo unmapped → master_group_id null + nombre Monday literal", () => {
    const cat = resolveCategoryFromMondayGroup(
      "BUSINESS PLAN - EDIFICIOS",
      groupMappings,
    );
    assert.equal(cat.master_group_id, null);
    assert.equal(cat.name, "BUSINESS PLAN - EDIFICIOS");
  });

  it("alias de grupo (FICC - SOCIETARIO) resuelve al master_group mapeado", () => {
    const cat = resolveCategoryFromMondayGroup("FICC - SOCIETARIO", groupMappings);
    assert.equal(cat.master_group_id, "1678bc10-3d55-4002-aaef-4e8bdaab9206");
    assert.equal(cat.name, "SOCIETARIO");
  });
});

describe("resolveCategoryForSubitem", () => {
  it("subitem + padre con grupo mapeado → categoría del padre", () => {
    assert.ok(isMondaySubitemsGroup("Subitems"));
    const cat = resolveCategoryForSubitem("PROPERTY MANAGEMENT", groupMappings);
    assert.equal(cat.master_group_id, PM_GROUP_ID);
    assert.equal(cat.name, "PROPERTY MANAGEMENT");
  });

  it("subitem + padre con grupo unmapped → categoría custom con nombre del grupo padre", () => {
    const cat = resolveCategoryForSubitem("GRUPO CUSTOM PADRE", groupMappings);
    assert.equal(cat.master_group_id, null);
    assert.equal(cat.name, "GRUPO CUSTOM PADRE");
  });
});

describe("resolveElementFromMapping", () => {
  it("ítem mapeado → master_element_id correcto", () => {
    const mapped = elementsUnique[0]!;
    const el = resolveElementFromMapping("Gobernanza", mapped);
    assert.equal(el.master_element_id, "faa95bf6-7112-4777-a6a5-b1099c3210c7");
    assert.equal(el.name, "Gobernanza");
  });

  it("ítem unmapped → master_element_id null + nombre Monday literal del ítem", () => {
    const unmapped = elementsUnique[1]!;
    const el = resolveElementFromMapping("Ascensor en obra 12", unmapped);
    assert.equal(el.master_element_id, null);
    assert.equal(el.name, "Ascensor en obra 12");
  });

  it("mapping null → trata como unmapped", () => {
    const el = resolveElementFromMapping("Nuevo ítem local", null);
    assert.equal(el.master_element_id, null);
    assert.equal(el.name, "Nuevo ítem local");
  });
});

describe("lookupElementMapping", () => {
  it("lookup case-insensitive y sin tildes", () => {
    const hit = lookupElementMapping("gobernanza", index);
    assert.ok(hit);
    assert.equal(hit!.master_element_id, "faa95bf6-7112-4777-a6a5-b1099c3210c7");

    const hit2 = lookupElementMapping("  GOBERNANZA  ", index);
    assert.ok(hit2);
  });

  it("devuelve null si no existe en el índice", () => {
    assert.equal(lookupElementMapping("No existe", index), null);
  });
});
