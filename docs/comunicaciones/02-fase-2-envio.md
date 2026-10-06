# Comunicaciones · fase 2: envío con controles

Especificación para quien la programe. **Nada de esto existe todavía**: la fase 1 no contiene
ninguna llamada de envío. La fase 2 empieza cuando Javier Canas haya validado la fase 1, y va en su
propia rama y su propia PR.

## La regla

El 2026-10-05 un kiosk de Zoho envió 60 correos por error porque enviar era lo que pasaba si no
se hacía nada. Aquí es al revés: **no enviar es lo que pasa si no se hace nada**, y cada paso hacia
el envío lo da una persona viendo exactamente qué va a salir.

**Un asistente o un script no lanza envíos reales.** Los activa y los lanza Javier.

## 1. Los nueve controles

Una comunicación solo se envía si ha pasado, en orden, todos estos pasos. **Los comprueba el
servidor en cada envío**; que un botón esté apagado en pantalla no cuenta como control.

| # | Control | Qué bloquea |
|---|---|---|
| 1 | **Datos recientes**: la copia de Zoho es de hoy | Si es más antigua, obliga a actualizar antes de preparar. Ya existe en la fase 1 |
| 2 | **Revisión de destinatarios**: «He revisado los N destinatarios» | Sin él no se avanza. Cambiar la audiencia o las exclusiones lo anula |
| 3 | **Prueba obligatoria**: el correo real, con la plantilla, enviado solo a quien ha iniciado sesión | Sin prueba enviada y marcada como vista no se avanza. Cambiar de plantilla la anula |
| 4 | **Resumen final**: número de correos, de direcciones externas, plantilla, remitente y la lista completa de nombres | Es informativo: es lo último que se ve antes de confirmar |
| 5 | **Confirmación escrita**: teclear el número de correos que van a salir | Si no coincide, no envía |
| 6 | **Tandas de 10** con progreso visible y botón **Detener** | Detener para en la tanda en curso. Cerrar la página también pausa |
| 7 | **Interruptor general** «Envíos desactivados», solo para el rol `admin` | Se consulta antes de cada correo, no una vez al empezar |
| 8 | **Sin duplicados**: una dirección recibe un solo correo por comunicación | Cada destinatario se marca antes de enviar, para que repetir no reenvíe |
| 9 | **Registro** en `audit_log`: quién preparó, quién probó, quién confirmó y cuándo | — |

Las tablas de la migración 047 ya llevan las columnas: `revisada_*`, `probada_*` y `confirmada_*`
en `com_comunicacion`; `estado_envio`, `intentos` y `zoho_message_id` en `com_destinatario`;
`envios_activados` y `modo` en `com_ajustes`.

El envío de prueba se hace sobre una cuenta de pruebas designada
(`com_ajustes.cuenta_pruebas_zoho_id`), para no dejar correos de prueba en las fichas de inversores
reales.

## 2. La pasarela de correo

Todo envío pasa por **una sola puerta**, con dos implementaciones detrás de la misma interfaz:

| Pasarela | Cuándo | Qué hace |
|---|---|---|
| Simulada | En local y en las previsualizaciones | No llama a Zoho. Deja los correos en un buzón de pruebas visible en pantalla |
| Real | Solo en Producción | Llama a Zoho con el token de envíos |

La real **se niega a arrancar si falta el token de envíos**. Ningún otro fichero del módulo llama
al envío de Zoho. Esa puerta única es también la frontera por la que el envío podría sacarse a un
servicio propio más adelante.

## 3. El token de envíos

- Variable **`ZOHO_REFRESH_TOKEN_ENVIOS`**, distinta de `ZOHO_REFRESH_TOKEN`.
- Se guarda **solo en el entorno de Producción de Vercel**. Ni en Preview, ni en Development, ni en
  ningún `.env.local`. Así, enviar desde fuera de producción no es una cuestión de cuidado: no se
  puede.
- El token actual, el que usan Inversores y Avance de obra, no cambia y sigue sin poder enviar.
- Lo genera Javier, con el mismo procedimiento que el token actual (`npm run pm:zoho-auth -- --dc eu`,
  ver `docs/pm/01-avance-obra.md` § «Conectar la API de Zoho»), pidiendo además el permiso de envío
  de correo. El nombre exacto de ese permiso hay que confirmarlo en la documentación de Zoho al
  empezar.

```bash
npx vercel env add ZOHO_REFRESH_TOKEN_ENVIOS production
```

## 4. Modo pruebas y modo real

Producción arranca en **modo pruebas** (`com_ajustes.modo = 'pruebas'`): todo correo se redirige a
quien ha iniciado sesión, sea cual sea la audiencia.

El **modo real** lo activa una persona con rol `admin` en la zona, desde la pantalla de ajustes.
No es un valor por defecto, ni una variable de entorno, ni algo que cambie un despliegue.

Los dos cierres son independientes: con `envios_activados = false` no sale ningún correo, ni
siquiera de prueba, esté el modo como esté.

## 5. La llamada de envío de Zoho

Formato tomado del kiosk retirado (`archivo/2026-10-05-kiosk/functions/com_enviar_lote.dg`, en
`ZohoCRM-Automations`), que es el que funcionó contra el CRM:

```
POST {ZOHO_API_DOMAIN}/crm/v8/{módulo}/{id del registro}/actions/send_mail
```

```json
{
  "data": [
    {
      "from": { "email": "remitente@imparcapital.com" },
      "to": [{ "email": "inversor@ejemplo.com" }],
      "cc": [{ "email": "copia@ejemplo.com" }],
      "bcc": [{ "email": "remitente@imparcapital.com", "user_name": "Impar Capital" }],
      "template": { "id": "<id de la plantilla>" },
      "org_email": true
    }
  ]
}
```

- El correo se envía **sobre un registro**: el del módulo de la plantilla (`Contacts` o
  `Cuentas_de_Inversi_n`). Zoho resuelve los campos combinados con ese registro y deja el correo en
  su ficha.
- El remitente va también en copia oculta para que el correo le quede en su buzón, como hace el
  kiosk «Emails a Fondos/Promos».
- Respuesta correcta: `data[0].code == "SUCCESS"`, con el identificador en
  `data[0].details.message_id`. Se guarda en `com_destinatario.zoho_message_id`.
- Cualquier otra respuesta se anota en `com_destinatario.error` y **no se reintenta sola**.

## 6. Por verificar antes de programar

- **Con qué remitentes acepta enviar Zoho** usando el token del portal. Si solo acepta la dirección
  del dueño del token, el remitente será fijo o una dirección de la organización. De aquí sale
  `com_ajustes.remitentes_permitidos`.
- **El límite diario de correos** de la cuenta de Zoho, y qué devuelve la API al alcanzarlo.
- Que el permiso de lectura del token actual cubre las plantillas; si no, se añade al token nuevo.

## 7. Pruebas automáticas exigidas

Dentro de `npm run check`, sin base de datos ni credenciales:

- Cada control por separado: intentar enviar sin revisión, sin prueba, con el número mal tecleado y
  con el interruptor apagado, y comprobar que **el servidor lo rechaza**.
- En modo pruebas, que todos los correos salen redirigidos a quien ha iniciado sesión.
- Que la pasarela real se niega a arrancar sin `ZOHO_REFRESH_TOKEN_ENVIOS`.
- Que repetir un envío no reenvía a quien ya lo recibió.
- Que Detener deja la comunicación en «Pausada» y con los pendientes intactos.

A mano: el recorrido completo en local con la pasarela simulada.

## 8. Puesta en marcha (fase 3)

1. Javier hace un envío completo en modo pruebas con «Inversores directos» y comprueba que solo le
   llega a él.
2. Javier activa el modo real y hace un primer envío a la promoción de prueba (PROMOCIONTEST).
3. Se concede la zona a quienes vayan a enviar y se amplía [`03-guia-de-uso.md`](03-guia-de-uso.md).
