import assert from "node:assert/strict";
import { test } from "node:test";

import { renderizarPlantilla } from "../plantilla";

const MODULO = "Cuentas_de_Inversi_n";

test("sustituye los campos combinados por el valor del registro", () => {
  const vista = renderizarPlantilla(
    { asunto: "Informe para ${!Cuentas_de_Inversi_n.Name}", html: "<p>Estimado ${!Cuentas_de_Inversi_n.Nombre}:</p>" },
    MODULO,
    { Name: "Inversiones Ejemplo S.L.", Nombre: "Ana" },
  );
  assert.equal(vista.asunto, "Informe para Inversiones Ejemplo S.L.");
  assert.equal(vista.html, "<p>Estimado Ana:</p>");
  assert.deepEqual(vista.sinResolver, []);
  assert.deepEqual(vista.vacios, []);
});

test("un campo vacío sale en blanco y se avisa: «Estimado :»", () => {
  const vista = renderizarPlantilla(
    { asunto: null, html: "<p>Estimado ${!Cuentas_de_Inversi_n.Nombre}:</p>" },
    MODULO,
    { Nombre: null },
  );
  assert.equal(vista.html, "<p>Estimado :</p>");
  assert.deepEqual(vista.vacios, ["${!Cuentas_de_Inversi_n.Nombre}"]);
});

test("un campo que el registro no trae se marca, no se borra", () => {
  const vista = renderizarPlantilla(
    { asunto: null, html: "<p>${!Cuentas_de_Inversi_n.Campo_Inexistente}</p>" },
    MODULO,
    { Nombre: "Ana" },
  );
  assert.deepEqual(vista.sinResolver, ["${!Cuentas_de_Inversi_n.Campo_Inexistente}"]);
  assert.ok(vista.html.includes("Campo_Inexistente"));
});

test("un campo de otro módulo no se resuelve con este registro", () => {
  const vista = renderizarPlantilla(
    { asunto: null, html: "<p>${!Contacts.First_Name}</p>" },
    MODULO,
    { First_Name: "No debería usarse" },
  );
  assert.deepEqual(vista.sinResolver, ["${!Contacts.First_Name}"]);
  assert.ok(!vista.html.includes("No debería usarse"));
});

test("el valor se escapa en el cuerpo: un nombre no puede inyectar HTML", () => {
  const vista = renderizarPlantilla(
    { asunto: "${!Cuentas_de_Inversi_n.Name}", html: "<p>${!Cuentas_de_Inversi_n.Name}</p>" },
    MODULO,
    { Name: 'A & B <script>alert("x")</script>' },
  );
  assert.equal(vista.html, "<p>A &amp; B &lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;</p>");
  // El asunto es texto plano: ahí no se escapa.
  assert.equal(vista.asunto, 'A & B <script>alert("x")</script>');
});

test("un lookup se pinta con su nombre, no como [object Object]", () => {
  const vista = renderizarPlantilla(
    { asunto: null, html: "${!Cuentas_de_Inversi_n.Owner}" },
    MODULO,
    { Owner: { id: "1", name: "Javier Canas" } },
  );
  assert.equal(vista.html, "Javier Canas");
});
