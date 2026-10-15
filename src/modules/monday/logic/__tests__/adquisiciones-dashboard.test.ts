import assert from "node:assert/strict";
import { test } from "node:test";

import type { MondayItem } from "@/modules/monday/data/types";
import {
  ADQ_COLUMNS,
  avgTicket,
  buildAdqAssets,
  buildAdqData,
  buildCards,
  CARD_STAGES,
  catastroUrl,
  buildFunnel,
  acquisitionRate,
  parseMondayNumber,
  provincia,
  type AdqAsset,
} from "../adquisiciones-dashboard";

// Foto de Monday del 13 oct 2026 (18 activos del grupo «En análisis»): las
// cifras esperadas son las del dashboard que se presentó al Comité.
const FOTO: [string, string, number | null, number | null, string, string][] = [
  ["Somera, 9", "Comité", 9100000, 5110, "Residencial", "Calle Somera 9, Aravaca; Madrid, España"],
  ["Hotel Huesca, 21", "Stand by", 25500000, 2070, "Hotel", "Calle Huesca, 21, Madrid, España"],
  ["Zenit, 20", "Stand by", 11900000, 6399.96, "Residencial", "Calle del Zenit, 20, Madrid, España"],
  ["Hotel Granada", "Stand by", 10000000, 3563, "Hotel", "Granada centro, España"],
  ["Avenida del Consejo de Europa, 4", "Descartado", 25000000, 10380, "Hotel", "Avenida del Consejo de Europa 4, Madrid, España"],
  ["Avenida de los Castros, 1", "Stand by", 11500000, 2445, "Hotel", "Avenida de los Castros, 1, Cantabria, España"],
  ["Príncipe de Vergara, 9", "Stand by", 57290000, 5729, "Oficinas", "Príncipe de Vergara 9, Madrid, España"],
  ["Hermosilla, 15", "LOI", 65000000, 5600, "Residencial", "Calle Hermosilla 15, Madrid, España"],
  ["Seminario de Nobles, 4", "LOI", 25550000, 3631, "Residencial", "Calle del Seminario de Nobles 4, Madrid, España"],
  ["Príncipe de Vergara, 156", "Stand by", 25000000, 4150, "Residencial", "Príncipe de Vergara 156, Madrid, España"],
  ["Goya 41", "Stand by", 30000000, null, "Residencial", ""],
  ["Ramón de Aguinaga 8, Vizconde de Matamala 7", "Stand by", 11200000, 3467, "Apartamentos Turísticos", "Calle Ramón de Aguinaga 8 / Vizconde de Matamala 7, Madrid, España"],
  ["Duque de Pastrana, 5", "Info. Solicitada", null, null, "Otro", ""],
  ["Carmen de la Concepción", "Descartado", null, 1867, "Hotel", "Albaicín, Granada, España"],
  ["Sector APE 08.20 Malmea", "Descartado", null, null, "Residencial", "Madrid Nuevo Norte, Madrid, España"],
  ["Suelo Residencial Méndez Álvaro 19, 25 y 27", "Descartado", null, 4113, "Residencial", "Calle Méndez Álvaro 19, 25 y 27, Madrid, España"],
  ["Caños del Peral, 11", "Comité", 22000000, 2722, "Residencial", "Calle Caños del Peral 11, Madrid, España"],
  ["Hotel Rincón Andaluz", "Servilleta", 50750000, 15586.76, "Hotel", "Nueva Andalucía - Puerto Banús, Marbella, Málaga, España"],
];

const ASSETS: AdqAsset[] = FOTO.map(([name, stage, price, m2, uso, loc]) => ({ name, stage, price, m2, uso, loc }));

test("KPIs de la foto del 13 oct 2026", () => {
  const d = buildAdqData(ASSETS);
  assert.equal(d.total, 18);
  assert.equal(d.discarded, 4);
  assert.equal(d.withPrice, 14);
  assert.equal(d.vol, 379_790_000);
  assert.equal(Math.round(avgTicket(d)), 27_127_857);
  assert.equal(d.eurM2Count, 13);
  assert.equal(d.m2Count, 15);
});

test("tasa de adquisición: adquiridos ÷ el resto del tablero", () => {
  const item = (group: string, etapa: string) =>
    ({ name: "x", group: { title: group }, column_values: [{ id: "estado_186", text: etapa, value: null }] }) as never;
  const items = [
    ...Array.from({ length: 25 }, () => item("Adquiridos", "Adquirido")),
    ...Array.from({ length: 694 }, () => item("Stand by", "Stand by")),
  ];
  assert.deepEqual(acquisitionRate(items), { acquired: 25, rest: 694, rate: 3.6 });
});

test("situación actual: activos por etapa hoy, sin acumular", () => {
  const f = buildFunnel(buildAdqData(ASSETS).stages);
  assert.deepEqual(f.map((s) => [s.name, s.count]), [
    ["Info. Solicitada", 1],
    ["Servilleta", 1],
    ["Comité", 2],
    ["LOI", 2],
    ["Stand by", 8],
    ["Descartado", 4],
  ]);
});

test("usos múltiples cuentan en cada uso", () => {
  const d = buildAdqData([{ name: "x", stage: "Recibido", price: null, m2: null, uso: "Residencial, Hotel", loc: "" }]);
  assert.deepEqual(d.uses, { Residencial: 1, Hotel: 1 });
});

test("provincia desde la dirección", () => {
  assert.equal(provincia("Granada centro, España"), "Granada");
  assert.equal(provincia("Calle X 1, 28001 Madrid, España"), "Madrid");
  assert.equal(provincia("Calle Y, Santander, España"), "Cantabria");
  assert.equal(provincia(""), null);
});

test("tarjetas de Comité y de las etapas en estudio", () => {
  const cards = buildCards(ASSETS, ["Comité"]);
  assert.deepEqual(cards.map((c) => c.name), ["Somera, 9", "Caños del Peral, 11"]);
  assert.deepEqual(
    buildCards(ASSETS, CARD_STAGES).map((c) => c.stage),
    ["Comité", "Comité", "Servilleta"],
  );
  assert.match(catastroUrl("9947609VK3794F"), /rc1=9947609&rc2=VK3794F$/);
  assert.match(catastroUrl(null), /OVCBusqueda/);
  assert.equal(Math.round(cards[1]!.repercusion!), 8082);
  assert.equal(cards[1]!.location, "Madrid · Residencial");
});

test("lee las columnas de Monday y filtra el grupo «En análisis»", () => {
  const item = (name: string, group: string, asking: string | null): MondayItem => ({
    id: name,
    name,
    created_at: null,
    updated_at: null,
    group: { id: "g", title: group },
    column_values: [
      { id: ADQ_COLUMNS.etapa, text: "Comité", value: null },
      { id: ADQ_COLUMNS.asking, text: asking, value: asking ? JSON.stringify(asking) : null },
      { id: ADQ_COLUMNS.superficie, text: "6399.96", value: '"6399.96"' },
      { id: ADQ_COLUMNS.uso, text: "Residencial", value: null },
      { id: ADQ_COLUMNS.ubicacion, text: "Madrid, España", value: null },
    ],
  });
  const assets = buildAdqAssets([item("A", "En análisis", "9100000"), item("B", "Stand by", "1")]);
  assert.equal(assets.length, 1);
  assert.equal(assets[0]!.price, 9_100_000);
  assert.equal(assets[0]!.m2, 6399.96);
  assert.equal(parseMondayNumber(null, ""), null);
});
