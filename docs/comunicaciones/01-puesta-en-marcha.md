# Comunicaciones · puesta en marcha de la fase 1

Cuatro pasos para que las tres pantallas funcionen con datos reales. Ninguno envía un correo: el
código de la fase 1 no contiene ninguna llamada de envío.

Los pasos 1 y 2 **escriben en la base de producción** (solo hay una, ver [`README.md`](README.md)).
Los autoriza Javier Canas cada vez.

## 1. Aplicar la migración 047

```bash
npm run comunicaciones:apply-migration-047             # simulación: aplica y revierte
npm run comunicaciones:apply-migration-047 -- --apply  # de verdad
```

Es aditiva e idempotente. Crea la zona `comunicaciones`, las tablas `com_ajustes`,
`com_comunicacion` y `com_destinatario`, y añade dos columnas al espejo de Inversores
(`inv_cuentas.tiene_intermediario`, `inv_contactos.email_opt_out`) con su fila en
`inv_campo_catalogo`.

El script aplica la migración dos veces dentro de una transacción, enseña cómo queda y **solo
confirma si todo cuadra**. Lo que tiene que imprimir:

- seis zonas, con `comunicaciones` en la posición 5 y `data` en la 6;
- `Usuarios con la zona Comunicaciones: 0`;
- `Ajustes: 1 fila · envíos desactivados · modo pruebas`;
- dos campos nuevos en el catálogo de Inversores;
- tres tablas `com_*`, las tres con RLS y 0 políticas.

Si algo no cuadra hace ROLLBACK y no queda nada aplicado.

El orden respecto al despliegue no importa: sin la migración las páginas dicen que falta, y el sync
de Inversores ignora las dos columnas hasta que el catálogo las tenga.

## 2. Conceder la zona

La zona nace sin nadie. Se concede en `/dashboard/admin/usuarios` o por consola:

```bash
npm run auth:grant -- javiercanas@imparcapital.com comunicaciones admin
npm run auth:grant -- <email> comunicaciones none      # revocar
```

| Rol | Puede |
|---|---|
| `lector` | Ver el historial, las listas y las vistas previas |
| `editor` | Además, preparar comunicaciones, excluir destinatarios y elegir plantilla |
| `admin` | Lo mismo hoy. En la fase 2, además el interruptor general y el modo real |

## 3. Actualizar los datos de Zoho

En «Nueva comunicación», pulsar **«Actualizar datos de Zoho»**. Es la sincronización de Inversores
de siempre: solo lee de Zoho y tarda alrededor de un minuto.

Hace falta una vez tras la migración, porque es la que rellena las dos columnas nuevas. Hasta
entonces `tiene_intermediario` vale `NULL` en todas las cuentas y la audiencia «Inversores
directos» sale vacía.

## 4. Comprobar las tres pantallas

En la previsualización de la PR #64 o en local:

```bash
npx next dev --webpack
```

- [ ] **Historial** (`/dashboard/comunicaciones`): carga vacío, sin el aviso de que falta la
      migración. La pestaña le aparece a quien tiene la zona y a nadie más.
- [ ] **Nueva**: enseña la hora de los datos de Zoho y el número de cuentas de cada audiencia.
      «Toda la base» ronda las **164 cuentas** e «Inversores directos» las **87**. Ninguna cuenta
      queda sin el dato de intermediario.
- [ ] **Detalle**, preparando «Toda la base»: alrededor de **22 cuentas «Sin destinatario»**. Las
      cuentas de prueba y las que solo tienen direcciones internas aparecen marcadas y excluidas.
      Excluir y volver a incluir funciona, y la descarga en CSV trae la misma lista.
- [ ] **Plantilla**: la lista de plantillas llega de Zoho y la vista previa resuelve los campos
      combinados con los datos del destinatario elegido.
- [ ] Descartar una comunicación de prueba la deja como «Cancelada» en el historial.
- [ ] **Sin regresiones**: la pestaña Inversores carga, y «Subir a Zoho» de Avance de obra sigue
      disponible.

Las cifras salen del recuento hecho en el CRM el 2026-10-05. Se mueven con el día a día del CRM;
lo que hay que investigar es una diferencia grande, no una cuenta de más o de menos.

## Diagnóstico

```bash
npm run comunicaciones:zoho-descubrir
```

Dice qué ve el token de Zoho: si existen los dos campos nuevos y qué plantillas de correo lee.

| Síntoma | Causa probable |
|---|---|
| La pestaña no aparece | La zona no está concedida a ese usuario |
| «Falta aplicar la migración `047_comunicaciones`» | Paso 1 sin hacer |
| «Inversores directos» sale con 0 cuentas | Paso 3 sin hacer |
| «No son de hoy: actualízalos antes de preparar» | La copia de Zoho es de ayer: pulsar «Actualizar datos de Zoho» |
| No llegan plantillas | El token no lee plantillas o caducó: ver `docs/inversores/01-zoho.md` § Credenciales |

## Cómo quitarlo

Está en el `README.md` del módulo, § «Cómo quitarlo».
