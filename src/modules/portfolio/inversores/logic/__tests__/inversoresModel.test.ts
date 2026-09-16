import assert from "node:assert/strict";
import { test } from "node:test";

import type { Espejos } from "../../data/inversoresRepository";
import type {
  InvContactoRow,
  InvCuentaContactoRow,
  InvCuentaPromocionRow,
  InvCuentaRow,
  InvFlujoRow,
  InvPromocionRow,
} from "../../types";
import {
  agregarPorTrimestre,
  calcularKpis,
  construirModelo,
  cuentasEnPromocion,
  cuentasEnTramo,
  cuentasEnTrimestre,
  rolDeContacto,
  trimestreDe,
} from "../inversoresModel";

// ---------------------------------------------------------------------------
// Fábricas: solo se escribe lo que el test mira
// ---------------------------------------------------------------------------

const SYNC = { sync_id: null, sincronizado_at: "2026-09-16T06:00:00Z", borrado_at: null };

function cuenta(p: Partial<InvCuentaRow> & { zoho_id: string; nombre: string }): InvCuentaRow {
  return {
    codigo: null,
    estado: "Activa",
    tipo: null,
    fecha_alta: null,
    email: null,
    telefono: null,
    capital_comprometido: null,
    moneda: "EUR",
    propietario_zoho_id: null,
    propietario_nombre: null,
    zoho_modified_at: null,
    ...SYNC,
    ...p,
  };
}

function enlaceContacto(
  p: Partial<InvCuentaContactoRow> & { zoho_id: string },
): InvCuentaContactoRow {
  return {
    cuenta_zoho_id: null,
    cuenta_nombre: null,
    contacto_zoho_id: null,
    contacto_nombre: null,
    contacto_email: null,
    contacto_telefono: null,
    es_principal: null,
    es_secundario: null,
    es_representante_legal: null,
    es_abogado: null,
    es_intermediario: null,
    concepto_representante: null,
    rol: null,
    participacion: null,
    zoho_modified_at: null,
    ...SYNC,
    ...p,
  };
}

function enlacePromocion(
  p: Partial<InvCuentaPromocionRow> & { zoho_id: string },
): InvCuentaPromocionRow {
  return {
    cuenta_zoho_id: null,
    cuenta_nombre: null,
    promocion_zoho_id: null,
    promocion_nombre: null,
    importe_comprometido: null,
    importe_aportado: null,
    participacion: null,
    fecha: null,
    status: null,
    coste_vehiculo_intermedio: null,
    zoho_modified_at: null,
    ...SYNC,
    ...p,
  };
}

function flujo(p: Partial<InvFlujoRow> & { zoho_id: string }): InvFlujoRow {
  return {
    cuenta_zoho_id: null,
    promocion_zoho_id: null,
    tipo: "aporte",
    tipo_zoho: null,
    importe: 0,
    retencion: null,
    moneda: "EUR",
    fecha: null,
    concepto: null,
    zoho_modified_at: null,
    ...SYNC,
    ...p,
  };
}

function promocion(p: Partial<InvPromocionRow> & { zoho_id: string; nombre: string }): InvPromocionRow {
  return {
    codigo: null,
    situacion: null,
    tipologia: null,
    zoho_modified_at: null,
    ...SYNC,
    ...p,
  };
}

function contacto(
  p: Partial<InvContactoRow> & { zoho_id: string; nombre_completo: string },
): InvContactoRow {
  return {
    nombre: null,
    apellidos: null,
    email: null,
    email_secundario: null,
    telefono: null,
    zoho_modified_at: null,
    ...SYNC,
    ...p,
  };
}

function espejos(p: Partial<Espejos> = {}): Espejos {
  return {
    cuentas: [],
    contactos: [],
    cuentaContacto: [],
    promociones: [],
    cuentaPromocion: [],
    flujos: [],
    sinMigracion: false,
    ...p,
  };
}

/** El caso de referencia: dos cuentas, un inversor repetido, dos promociones. */
function escenario(): Espejos {
  return espejos({
    cuentas: [
      cuenta({ zoho_id: "C1", nombre: "Cuenta Uno", capital_comprometido: 300_000 }),
      // Sin comprometido propio: se deriva de sus enlaces con promociones.
      cuenta({ zoho_id: "C2", nombre: "Cuenta Dos" }),
    ],
    promociones: [
      promocion({ zoho_id: "P1", nombre: "Residencial Norte", situacion: "En marcha" }),
      promocion({ zoho_id: "P2", nombre: "Oficinas Sur" }),
    ],
    cuentaPromocion: [
      enlacePromocion({ zoho_id: "CP1", cuenta_zoho_id: "C1", promocion_zoho_id: "P1", importe_comprometido: 300_000 }),
      enlacePromocion({ zoho_id: "CP2", cuenta_zoho_id: "C2", promocion_zoho_id: "P1", importe_comprometido: 600_000 }),
      enlacePromocion({ zoho_id: "CP3", cuenta_zoho_id: "C2", promocion_zoho_id: "P2", importe_comprometido: 900_000 }),
    ],
    contactos: [
      contacto({ zoho_id: "K1", nombre_completo: "Ana Ruiz", email: "ana@example.com" }),
      contacto({ zoho_id: "K2", nombre_completo: "Luis Gil", email: "luis@example.com" }),
    ],
    cuentaContacto: [
      enlaceContacto({ zoho_id: "CC1", cuenta_zoho_id: "C1", contacto_zoho_id: "K1", rol: "Titular" }),
      // Ana está en las dos cuentas: sigue siendo UNA inversora.
      enlaceContacto({ zoho_id: "CC2", cuenta_zoho_id: "C2", contacto_zoho_id: "K1", rol: "Titular" }),
      enlaceContacto({
        zoho_id: "CC3",
        cuenta_zoho_id: "C2",
        contacto_zoho_id: "K2",
        contacto_email: "luis.gil@empresa.com",
      }),
    ],
    flujos: [
      flujo({ zoho_id: "F1", cuenta_zoho_id: "C1", promocion_zoho_id: "P1", tipo: "aporte", importe: 100_000, fecha: "2025-02-10" }),
      flujo({ zoho_id: "F2", cuenta_zoho_id: "C2", promocion_zoho_id: "P1", tipo: "aporte", importe: 400_000, fecha: "2025-05-20" }),
      flujo({ zoho_id: "F3", cuenta_zoho_id: "C1", promocion_zoho_id: "P1", tipo: "reparto", importe: 30_000, fecha: "2026-01-15" }),
      // Tipo no reconocido: se conserva, pero no entra en ningún total.
      flujo({ zoho_id: "F4", cuenta_zoho_id: "C1", tipo: "desconocido", importe: 999_999, fecha: "2026-01-20" }),
    ],
  });
}

// ---------------------------------------------------------------------------
// Trimestres
// ---------------------------------------------------------------------------

test("trimestreDe reparte los doce meses", () => {
  assert.equal(trimestreDe("2026-01-01"), "2026-T1");
  assert.equal(trimestreDe("2026-03-31"), "2026-T1");
  assert.equal(trimestreDe("2026-04-01"), "2026-T2");
  assert.equal(trimestreDe("2026-09-16"), "2026-T3");
  assert.equal(trimestreDe("2026-12-31"), "2026-T4");
  assert.equal(trimestreDe("no es fecha"), null);
});

// ---------------------------------------------------------------------------
// El rol: cinco casillas, no un desplegable
// ---------------------------------------------------------------------------

const SIN_ROL = {
  es_principal: null,
  es_secundario: null,
  es_representante_legal: null,
  es_abogado: null,
  es_intermediario: null,
  concepto_representante: null,
  rol: null,
};

test("las casillas del CRM se acumulan, no se excluyen", () => {
  // Es el caso real: un representante legal puede ser además el principal.
  assert.equal(
    rolDeContacto({
      ...SIN_ROL,
      es_principal: true,
      es_representante_legal: true,
      concepto_representante: "Administrador único",
    }),
    "Principal · Representante legal (Administrador único)",
  );
});

test("sin ninguna casilla marcada, el rol es null y no una cadena vacía", () => {
  assert.equal(rolDeContacto(SIN_ROL), null);
  assert.equal(rolDeContacto({ ...SIN_ROL, es_abogado: false }), null);
});

test("el rol de la cuenta llega hasta el contacto del modelo", () => {
  const modelo = construirModelo(
    espejos({
      cuentas: [cuenta({ zoho_id: "C1", nombre: "Uno" })],
      cuentaContacto: [
        enlaceContacto({
          zoho_id: "CC1",
          cuenta_zoho_id: "C1",
          contacto_zoho_id: "K1",
          contacto_nombre: "Ana",
          es_intermediario: true,
        }),
      ],
    }),
  );
  assert.equal(modelo.cuentas[0].contactos[0].rol, "Intermediario");
});

// ---------------------------------------------------------------------------
// Modelo
// ---------------------------------------------------------------------------

test("el comprometido se deriva de las promociones cuando la cuenta no lo trae", () => {
  const { cuentas } = construirModelo(escenario());
  const dos = cuentas.find((c) => c.zohoId === "C2");
  assert.equal(dos?.comprometido, 1_500_000);
});

test("una cuenta sin comprometido en ninguna parte se queda en null, no en cero", () => {
  // Cero diría «no ha comprometido nada», que es una afirmación distinta.
  const modelo = construirModelo(
    espejos({ cuentas: [cuenta({ zoho_id: "C9", nombre: "Vacía" })] }),
  );
  assert.equal(modelo.cuentas[0].comprometido, null);
});

test("los flujos de tipo desconocido no suman en ningún total", () => {
  const { cuentas, kpis } = construirModelo(escenario());
  const uno = cuentas.find((c) => c.zohoId === "C1");
  assert.equal(uno?.aportado, 100_000);
  assert.equal(uno?.repartido, 30_000);
  assert.equal(uno?.neto, 70_000);
  assert.equal(kpis.aportado, 500_000);
});

test("un inversor con dos cuentas cuenta una vez", () => {
  const { kpis } = construirModelo(escenario());
  assert.equal(kpis.numInversores, 2);
  assert.equal(kpis.numCuentas, 2);
  assert.equal(kpis.numPromociones, 2);
});

test("el correo del enlace gana al del módulo Contacts", () => {
  const { cuentas } = construirModelo(escenario());
  const dos = cuentas.find((c) => c.zohoId === "C2");
  const luis = dos?.contactos.find((k) => k.zohoId === "K2");
  assert.equal(luis?.email, "luis.gil@empresa.com");
  // Y cuando el enlace no lo trae, se cae al del módulo Contacts.
  const ana = dos?.contactos.find((k) => k.zohoId === "K1");
  assert.equal(ana?.email, "ana@example.com");
});

test("el pendiente nunca es negativo", () => {
  // Aportar más de lo firmado significa que el comprometido está desfasado en
  // el CRM, no que haya deuda negativa.
  const kpis = calcularKpis([
    {
      zohoId: "C1",
      nombre: "Uno",
      codigo: null,
      estado: null,
      tipo: null,
      fechaAlta: null,
      email: null,
      telefono: null,
      comprometido: 100_000,
      aportado: 150_000,
      repartido: 0,
      neto: 150_000,
      contactos: [],
      promociones: [],
    },
  ]);
  assert.equal(kpis.pendiente, 0);
  assert.equal(kpis.dpi, 0);
});

test("el DPI es null si todavía no se ha aportado nada", () => {
  const kpis = calcularKpis([]);
  assert.equal(kpis.dpi, null);
  assert.equal(kpis.aportado, 0);
});

// ---------------------------------------------------------------------------
// Series y resolutores del drill-down
// ---------------------------------------------------------------------------

test("los repartos van en negativo en la serie y el acumulado los resta", () => {
  const e = escenario();
  const puntos = agregarPorTrimestre(e.flujos, new Set(e.cuentas.map((c) => c.zoho_id)));
  const t1 = puntos.find((p) => p.periodo === "2025-T1");
  const t2026 = puntos.find((p) => p.periodo === "2026-T1");

  assert.equal(t1?.aportes, 100_000);
  assert.equal(t1?.netoAcumulado, 100_000);
  assert.equal(t2026?.repartos, -30_000);
  // 100.000 + 400.000 − 30.000
  assert.equal(t2026?.netoAcumulado, 470_000);
});

test("el drill-down de un trimestre enseña las cuentas con movimiento", () => {
  const modelo = construirModelo(escenario());
  const t2 = modelo.porTrimestre.find((p) => p.periodo === "2025-T2");
  assert.equal(t2?.numCuentas, 1);
  const cuentas = cuentasEnTrimestre(modelo.cuentas, t2!);
  assert.deepEqual(
    cuentas.map((c) => c.zohoId),
    ["C2"],
  );
});

test("cada cuenta cae en un solo tramo y los tramos suman el total de cuentas", () => {
  const modelo = construirModelo(escenario());
  const total = modelo.tramos.reduce((acc, t) => acc + t.numCuentas, 0);
  assert.equal(total, modelo.cuentas.length);

  // C1 tiene 300.000 comprometidos; C2, 1.500.000.
  assert.deepEqual(
    cuentasEnTramo(modelo.cuentas, "250k-500k").map((c) => c.zohoId),
    ["C1"],
  );
  assert.deepEqual(
    cuentasEnTramo(modelo.cuentas, "1M+").map((c) => c.zohoId),
    ["C2"],
  );
});

test("el drill-down de una promoción enseña las cuentas que participan", () => {
  const modelo = construirModelo(escenario());
  assert.deepEqual(
    cuentasEnPromocion(modelo.cuentas, "P1")
      .map((c) => c.zohoId)
      .sort(),
    ["C1", "C2"],
  );
  assert.deepEqual(
    cuentasEnPromocion(modelo.cuentas, "P2").map((c) => c.zohoId),
    ["C2"],
  );
});

test("la promoción agrega el comprometido de todas sus cuentas", () => {
  const modelo = construirModelo(escenario());
  const p1 = modelo.porPromocion.find((p) => p.zohoId === "P1");
  assert.equal(p1?.comprometido, 900_000);
  assert.equal(p1?.aportado, 500_000);
  assert.equal(p1?.pendiente, 400_000);
  assert.equal(p1?.numCuentas, 2);
});

test("la serie por trimestre ignora los flujos sin cuenta en el modelo", () => {
  // En Zoho hay movimientos que no cuelgan de ninguna cuenta, y otros que
  // cuelgan de una cuenta excluida. Si entraran aquí, la gráfica sumaría más
  // que los KPIs y las dos vistas del mismo dato dirían cosas distintas.
  const e = escenario();
  e.flujos.push(
    flujo({ zoho_id: "F9", cuenta_zoho_id: null, tipo: "aporte", importe: 9_000_000, fecha: "2025-02-11" }),
    flujo({ zoho_id: "F10", cuenta_zoho_id: "EXCLUIDA", tipo: "aporte", importe: 5_000_000, fecha: "2025-02-12" }),
  );
  const puntos = agregarPorTrimestre(e.flujos, new Set(e.cuentas.map((c) => c.zoho_id)));
  assert.equal(puntos.find((p) => p.periodo === "2025-T1")?.aportes, 100_000);
});

test("sin datos, el modelo no revienta", () => {
  const modelo = construirModelo(espejos());
  assert.deepEqual(modelo.cuentas, []);
  assert.equal(modelo.kpis.numCuentas, 0);
  assert.equal(modelo.tramos.length, 5);
  assert.deepEqual(modelo.porTrimestre, []);
});
