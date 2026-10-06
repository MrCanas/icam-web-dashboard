# Comunicaciones · el envío, sus controles y el candado

Cómo sale un correo de este módulo y todo lo que tiene que pasar antes. Para quien lo mantenga.

## La regla

El 2026-10-05 un kiosk de Zoho envió 60 correos por error porque enviar era lo que pasaba si no se
hacía nada. Aquí es al revés: **no enviar es lo que pasa si no se hace nada**, y cada paso hacia el
envío lo da una persona viendo exactamente qué va a salir.

Hay tres capas, y cada una funciona aunque fallen las otras:

1. **El candado de destinatarios** (§1): a quién se puede escribir, en código.
2. **Los nueve controles** (§2): qué tiene que pasar antes de cada envío.
3. **Los ajustes** (§4): un interruptor general y el modo pruebas, apagado y en pruebas de salida.

Sobre ellas van el **ensayo general** y las validaciones de cada correo, que llegaron con el
seguimiento de aperturas y clics: están en
[`04-analitica-y-reenvio.md`](04-analitica-y-reenvio.md) § 4 y § 5.

## 1. El candado de destinatarios

**Mientras exista, este módulo solo puede escribir a dos direcciones:**

- `javiercanas@imparcapital.com`
- `iranzuvicente@imparcapital.com`

**y solo sobre las cuentas de prueba de la promoción `PROMOCIONTEST` del CRM.**

Está en `src/modules/comunicaciones/logic/candado.ts`. No es un ajuste ni una variable de entorno:
es una constante en el código.

| Qué | Cómo |
|---|---|
| Qué direcciones valen | Las de la **lista cerrada** `CANDADO.emailsPermitidos`, escrita en el código. No se calcula a partir del CRM: marcar a otra persona como contacto principal de una cuenta de prueba **no** la convierte en destinataria. Nada que se toque en Zoho ensancha a quién se escribe |
| Sobre qué registros se puede enviar | Las cuentas suscritas a `PROMOCIONTEST` (se exigen su id de Zoho **y** su código) **y** marcadas como cuenta de prueba (`inv_cuentas.excluida`). Suscribir por error a un inversor real no la convierte en registro válido |
| Qué mira de cada correo | **Todas** las direcciones («Para», copia y copia oculta) y **el registro de Zoho sobre el que se envía**: Zoho archiva el correo en esa ficha, y un correo de pruebas no pinta nada en la de un inversor |
| Qué hace si algo sobra | Rechaza el correo entero. No quita la dirección que sobra y envía el resto |
| Dónde se aplica | En `enviarConCandado` (`data/pasarela/index.ts`), pegado a la llamada, para la pasarela real y la simulada. Además, al confirmar, para negarse antes de empezar |
| Si la promoción de pruebas desaparece o cambia | No queda ningún registro sobre el que enviar: no sale nada |

Consecuencia práctica: se puede **preparar y revisar** cualquier audiencia, pero solo se puede
**enviar** una comunicación a `PROMOCIONTEST`.

**La lista de destinatarios de una audiencia real no es a quién se va a escribir.** Es a quién iría
si no hubiera candado, y sirve para revisarla. La página lo dice junto a la lista: la sección
«Envío» de una comunicación que el candado no dejaría salir no ofrece ningún paso, solo el aviso
«Esta comunicación no se puede enviar». Y en las que sí, enseña las direcciones exactas que
recibirían algo antes del primer botón.

### Cómo comprobarlo sin enviar nada

```bash
npm run comunicaciones:candado-verificar
```

Solo lee. Coge cada comunicación guardada y le pasa las mismas funciones que usa el envío, en modo
pruebas y en modo real, y dice cuántos correos dejaría salir el candado y a qué direcciones
exactas. Termina con error si alguna no está en la lista cerrada.

### Cómo se quita

Con una PR aparte, decidida por Javier Canas, que cambie `logic/candado.ts` y sus pruebas
(`logic/__tests__/candado.test.ts`). Antes de abrirla conviene tener resuelto el límite diario de
Zoho (§6). No hay otra forma: ningún ajuste, rol ni variable de entorno lo abre.

## 2. Los nueve controles

Una comunicación solo se envía si ha pasado, en orden, todos estos pasos. **Los comprueba el
servidor en cada acción** (`logic/controles.ts`, llamado desde `actions/envio.ts`); que un botón
esté apagado en pantalla no es un control.

| # | Control | Qué bloquea |
|---|---|---|
| 1 | **Datos recientes** | No se prepara sin la copia de Zoho de hoy, y no se confirma una comunicación preparada otro día |
| 2 | **Revisión**: «He revisado los N destinatarios» | Sin ella no hay prueba. Excluir o incluir a alguien la anula |
| 3 | **Prueba obligatoria**: la plantilla de verdad, enviada solo a quien ha iniciado sesión | Sin prueba enviada y marcada «La he recibido y está bien» no se confirma. Cambiar de plantilla la anula |
| 4 | **Resumen final**: correos, direcciones externas, plantilla, remitente, modo y la lista completa. Y el **ensayo general**: se montan todos los correos sin enviar ninguno y se enseñan las direcciones exactas | Sin un ensayo correcto y vigente (30 minutos, mismo modo, misma lista) no se confirma |
| 5 | **Confirmación escrita**: teclear el número de correos | Si no coincide, no envía. Tampoco si el envío no cabe en el tope diario |
| 6 | **Tandas de 10**, con progreso y botón **Detener** | Detener para antes del siguiente correo. Las tandas las pide la pantalla: cerrarla deja de enviar |
| 7 | **Interruptor general**, solo para el rol `admin` | Se consulta antes de **cada** correo. Apagado, no sale ni la prueba |
| 8 | **Sin duplicados** | Cada destinatario se marca «enviando» antes de enviarle, así que repetir no reenvía. Una dirección recibe un solo correo por comunicación: la segunda cuenta queda «Omitida» |
| 9 | **Registro** | Cada paso queda en `audit_log` con quién y cuándo: revisar, prueba enviada, prueba vista, confirmar, cada correo, detener, reanudar y cada cambio de ajustes |

Estados de una comunicación: `borrador` → `revisada` → `probada` → `enviando` ⇄ `pausada` →
`enviada`. Cada cambio de estado es condicional: si dos personas pulsan a la vez, la segunda
encuentra que «la comunicación ha cambiado».

Estados de un destinatario: `pendiente` → `enviando` → `enviado`, `error` u `omitido`.

- Un **error no se reintenta solo**. Queda anotado con lo que contestó Zoho.
- Uno que se quedó **a medias** (marcado «enviando» y sin resultado, por un corte) pasa a error con
  el aviso de comprobarlo en la ficha de Zoho: pudo salir o no, y reenviar a ciegas es justo lo que
  no puede pasar.
- Si no se puede **anotar** un resultado, el envío se detiene solo.

De cada correo se guarda **a qué direcciones salió de verdad** (`com_destinatario.enviado_para`),
que en modo pruebas no son las de la lista, su identificador de Zoho y por qué pasarela salió.

## 3. La pasarela de correo

Todo envío pasa por **una sola puerta**, `enviarConCandado`, con dos pasarelas detrás:

| Pasarela | Cuándo | Qué hace |
|---|---|---|
| Simulada | Donde no existe el token de envíos (previsualizaciones y cualquier copia local sin él), o donde se fuerza con `COMUNICACIONES_PASARELA=simulada` | No llama a nadie. El recorrido se completa y lo que se guarda queda marcado «simulado» |
| Zoho | Donde existe `ZOHO_REFRESH_TOKEN_ENVIOS` y no se ha forzado la simulada | Envía de verdad |

`COMUNICACIONES_PASARELA` solo sirve para forzar la simulada: **no hay valor que fuerce la real**.
Existe porque dejar vacía la variable del token al arrancar no basta —el cargador de `.env.local`
la rellena—, y un servidor local que se creía simulado salía por Zoho (2026-10-06; se vio en la
banda de la página antes de enviar nada).

La llamada de envío de Zoho está en **un solo fichero** de todo el portal,
`data/pasarela/pasarelaZoho.ts`, y lo vigila una prueba (`__tests__/arquitectura.test.ts`): si
alguien la escribe en otro sitio, o importa una pasarela saltándose `enviarConCandado`, `npm run
check` falla.

La llamada, comprobada contra la documentación de Zoho (API v8):

```
POST {ZOHO_API_DOMAIN}/crm/v8/{módulo}/{id del registro}/actions/send_mail
```

```json
{
  "data": [
    {
      "from": { "user_name": "Nombre", "email": "remitente@imparcapital.com" },
      "to": [{ "email": "destinatario@ejemplo.com" }],
      "cc": [{ "email": "copia@ejemplo.com" }],
      "bcc": [{ "email": "remitente@imparcapital.com" }],
      "subject": "<asunto ya resuelto>",
      "content": "<HTML ya montado, con su seguimiento>",
      "mail_format": "html",
      "attachments": [{ "id": "<file_id del adjunto de la plantilla>" }],
      "org_email": false
    }
  ]
}
```

- **El correo lo monta el portal**, no Zoho: resuelve los campos combinados y pone la imagen de
  apertura y los enlaces rastreados de ese destinatario
  ([`04-analitica-y-reenvio.md`](04-analitica-y-reenvio.md) § 2 y § 3). Por eso va `subject` +
  `content` y no `template`.
- El correo se envía **sobre un registro**: la cuenta de inversión, o el primer contacto en «Para»
  si la plantilla es del módulo Contactos. Los campos combinados se resuelven con ese registro y
  Zoho archiva el correo en su ficha.
- Zoho incrusta las imágenes de la plantilla en el correo y envuelve cada enlace en uno suyo de
  rastreo, que redirige al del portal.
- En modo real el remitente va además en copia oculta, para que el correo le quede en su buzón,
  como hace el kiosk «Emails a Fondos/Promos».
- `org_email` es `true` solo si el remitente es una dirección de la organización en Zoho.
- Antes de enviar se comprueba que Zoho acepta ese remitente con el token
  (`GET /settings/emails/actions/from_addresses`).
- Zoho, por su cuenta, rechaza escribir a un contacto con «Email Opt Out».

## 4. Los ajustes

En **Comunicaciones > Ajustes** (`/dashboard/comunicaciones/ajustes`). Los ve cualquiera con la
zona; los cambia solo el rol `admin` de la zona. Tabla `com_ajustes`, una sola fila.

| Ajuste | Nace | Qué hace |
|---|---|---|
| Envíos activados | **No** | Apagado no sale ningún correo, ni de prueba, y un envío en curso se para antes del siguiente |
| Modo | **Pruebas** | En pruebas, todo correo se redirige a quien lo envía. En real van a la lista (y el candado sigue mandando) |
| Cuenta de pruebas | Ninguna | Sobre qué cuenta se envía la prueba obligatoria. Tiene que ser una cuenta de prueba de `PROMOCIONTEST` |
| Remitentes permitidos | Ninguno | Con qué direcciones se puede enviar. Zoho solo acepta las del usuario dueño del token |
| Tope diario | 100 | Cuántos correos reales pueden salir en un día, pruebas incluidas. No se confirma un envío que no quepa, y una tanda no lo pasa. Entre 1 y 100 |

## 5. El token de envíos

- Variable **`ZOHO_REFRESH_TOKEN_ENVIOS`**, distinta de `ZOHO_REFRESH_TOKEN`. El token de lectura,
  el que usan Inversores y Avance de obra, no puede enviar y no se toca.
- Permisos: `ZohoCRM.send_mail.all.CREATE,ZohoCRM.settings.emails.READ`.
- En Vercel va **solo en Production**. En Preview no: ahí la pasarela es la simulada.
- El usuario de Zoho que lo genera es el dueño: los correos salen con sus direcciones de remitente
  y cuentan en su límite diario.

Cómo se genera (lo hace una persona; es un inicio de sesión suyo):

1. En <https://api-console.zoho.eu>, el Self Client del portal > «Generate Code», con el scope de
   arriba.
2. Antes de 10 minutos:

   ```bash
   npm run comunicaciones:zoho-auth-envios      # pide el código y guarda SOLO el token de envíos
   npm run comunicaciones:zoho-envio-verificar  # solo lee: con qué remitentes deja enviar
   ```

3. Para producción: `npx vercel env add ZOHO_REFRESH_TOKEN_ENVIOS production`.

**No usar `npm run pm:zoho-auth` para esto.** Ese script escribe `ZOHO_REFRESH_TOKEN` y machacaría
el token de lectura con uno que no puede leer.

## 6. Límites de Zoho

- **100 correos al día por usuario**, según la documentación de la API. «Toda la base» son unas 164
  cuentas: no cabe en un día con un solo token. Hay que resolverlo antes de quitar el candado
  (repartir en dos días, o confirmar con Zoho el límite real del plan contratado).
- El portal lleva su propia cuenta (el ajuste «Tope diario», §4) y se niega antes de llegar. Si aun
  así Zoho contesta `LIMIT_EXCEEDED`, el destinatario queda en error y el resto sigue intentándose
  y fallando igual: **Detener**.
- La API de correos de Zoho no está disponible para 102 de las 164 cuentas (`NOT_SUPPORTED`): en
  ellas no se puede comprobar después a quién dice Zoho que mandó el correo, ni si rebotó.

## 7. Pruebas automáticas

Dentro de `npm run check`, sin base de datos, sin red y sin credenciales:

| Fichero | Qué fija |
|---|---|
| `logic/__tests__/candado.test.ts` | A quién deja pasar el candado y a quién no, caso a caso |
| `logic/__tests__/controles.test.ts` | Que cada control dice que no: sin revisión, sin prueba, número mal tecleado, interruptor apagado, datos de otro día, comunicación detenida |
| `logic/__tests__/envio.test.ts` | A qué direcciones sale cada correo; que el modo pruebas redirige todo; que repetir no reenvía; y que de una audiencia de inversores reales no sale ningún correo en ningún modo |
| `data/pasarela/__tests__/pasarela.test.ts` | Que lo que el candado rechaza no llega a ninguna pasarela; que la real no arranca sin token; que el token de lectura no sirve; que `COMUNICACIONES_PASARELA=simulada` fuerza la simulada y nada fuerza la real |
| `__tests__/arquitectura.test.ts` | Que la llamada de envío y el token de envíos solo existen en la pasarela de Zoho |
