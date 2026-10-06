# Comunicaciones · seguimiento, analítica y reenvío

Cómo sabe el portal quién ha abierto un correo y quién ha pulsado sus enlaces, qué enseña el panel
y cómo se reenvía una comunicación a un subconjunto. Para quien lo mantenga.

Nada de esto cambia a quién se puede escribir: el candado de destinatarios
([`02-envio-con-controles.md`](02-envio-con-controles.md) § 1) sigue delante de todo, también del
reenvío.

## 1. Por qué seguimiento propio

Se sondeó Zoho antes de decidir (2026-10-06, solo lectura):

- La API de Zoho **no expone los correos de 102 de las 164 cuentas** de inversión (`NOT_SUPPORTED`).
- En las 62 que sí, **desde agosto no constaba ni una apertura en 142 correos**.

Así que el seguimiento lo hace el portal. Consecuencia: **el correo lo monta el portal**, no Zoho,
porque cada destinatario lleva una imagen y unos enlaces distintos. El correo sigue saliendo por
Zoho y quedando en la ficha del registro.

## 2. Cómo se monta un correo

`actions/montaje.ts` (lectura de Zoho) + `logic/composicion.ts`, `logic/plantilla.ts`,
`logic/seguimiento.ts` y `logic/validarCorreo.ts` (lógica pura). La prueba, el ensayo general y el
envío montan el correo con las mismas funciones.

1. Se lee la plantilla del CRM y el registro (la cuenta, o el contacto).
2. Se resuelven los campos combinados. **Tipos admitidos**: texto, texto largo, correo, teléfono,
   web, lista de valores y autonumérico. Un importe, una fecha, un campo de otro módulo o la firma
   del usuario quedan «sin resolver», y **un correo con un campo sin resolver no sale**. Qué usa
   cada plantilla: `npm run comunicaciones:plantillas-campos` (unas 10 plantillas usan importes).
3. Se le pone el seguimiento (§3).
4. Se valida (§5) y se envía con `subject` + `content` y los adjuntos de la plantilla por su
   identificador de fichero.

## 3. El seguimiento

| Qué | Cómo |
|---|---|
| Identificador | 22 caracteres aleatorios **por destinatario y por envío**, único en la base. Si la misma plantilla se envía dos veces —otra comunicación, o un reenvío—, cada correo lleva el suyo y sus cifras van aparte. La prueba obligatoria lleva otro, que no cuenta |
| Apertura | Una imagen servida por `GET /api/s/a/{identificador}`. Si la plantilla ya trae imágenes es un píxel invisible; **si no trae ninguna, se añade al pie el logotipo de Impar Capital**, para que el programa de correo ofrezca cargar imágenes |
| Clic | Cada enlace `http(s)` pasa a `GET /api/s/e/{identificador}/{n}`. El destino se guarda al ensayar y **sale de la base, nunca de la dirección**: no sirve para redirigir a donde quiera un tercero |
| Lo que no se toca | `mailto:`, `tel:` y anclas |
| Lecturas automáticas | Peticiones `HEAD`, agentes de filtros de correo conocidos y lo que llega en los 10 segundos siguientes al envío. Se guardan, marcadas, y **no suman** |
| Lo que no se guarda | La IP de nadie |
| Límite | 30 anotaciones por identificador y minuto |

Las dos rutas son públicas (no hay sesión en el programa de correo de un inversor), solo aceptan
`GET`, y lo desconocido contesta 404 sin escribir nada. Anotan a través de la función
`com_registrar_evento`, que solo puede ejecutar el servidor.

**Zoho añade su propio rastreo encima.** Al enviar, Zoho envuelve cada enlace en uno suyo
(`…zohoinsights…`) que redirige al del portal, que redirige al destino. Comprobado el 2026-10-06:
la cadena completa funciona y el clic queda anotado en el portal.

### El dominio `go.imparcapital.com`

Los enlaces y la imagen cuelgan de la dirección de la variable **`COMUNICACIONES_SEGUIMIENTO_URL`**.
En producción, `https://go.imparcapital.com`. Sin ella, o si no es válida, no se puede ensayar ni
enviar.

- Es un dominio más del proyecto de Vercel `icam-web-dashboard`: sirve producción.
- Por ese nombre **solo se sirve `/api/s/*`**; todo lo demás, 404 (`src/proxy.ts`).
- DNS, en Cloudflare (zona `imparcapital.com`): `CNAME go → 1429ddcbf3c9f778.vercel-dns-017.com`,
  **solo DNS, sin el proxy naranja**, para que Vercel emita el certificado.

## 4. El ensayo general

Antes de aceptar el número tecleado, el servidor **monta todos los correos sin enviar ninguno**
(`ensayarEnvioAction`), los valida y los pasa por el candado. Enseña cuántos saldrían, **a qué
direcciones exactas**, cuántos se omiten por dirección repetida y qué cuentas tienen vacío algún
campo de la plantilla (el «Buenas tardes ,»). Si uno solo falla, no se guarda nada y no se puede
confirmar.

De cada correo se guarda una **huella** (SHA-256 de registro, remitente, direcciones, asunto,
cuerpo y adjuntos). Al enviar se vuelve a montar: **si la huella no coincide, ese correo no sale y
el envío se detiene**.

- El ensayo vale 30 minutos, para el mismo modo y la misma lista.
- Quien se ensayó como «omitido» no recibe nada después, pase lo que pase con los demás.
- La huella deja fuera una sola cosa: la clave de las imágenes de la plantilla
  (`viewInLineImage?fileContent=…`), que Zoho cambia en cada lectura aunque la imagen sea la misma.

## 5. Validaciones

Además de los nueve controles y del candado. Todas en el servidor; lo que no pasa se enseña y no
sale.

| Cuándo | Qué |
|---|---|
| Al preparar | Sintaxis estricta de cada dirección (una mal formada no entra en «Para»); que el dominio reciba correo (consulta DNS, una vez por dominio; si no, la cuenta nace excluida); aviso de posible errata (`gmial.com`…) |
| En cada correo (`logic/validarCorreo.ts`) | Ningún campo sin resolver ni resto de `${…}`; asunto y cuerpo no vacíos y dentro de tamaño; tantos enlaces rastreados como tenía la plantilla, todos `http(s)`; exactamente una imagen de apertura; el identificador es el de ese destinatario y el registro el de su cuenta; tantos adjuntos como la plantilla |
| Al confirmar | Ensayo general vigente y sin problemas; que el envío quepa en el tope diario |
| En cada tanda | Huella igual a la ensayada; interruptor, estado y tope antes de cada correo; que el modo no haya cambiado desde el ensayo |
| Tras cada tanda | Donde Zoho lo expone, se lee el correo recién enviado y se compara a quién dice Zoho que fue. Si no coincide, el envío se detiene |
| En el reenvío | Solo cuentas del envío original; una dirección que no estaba en aquel nace excluida con el aviso «Dirección nueva» |

**Tope diario**: ajuste `limite_diario`, 100 por defecto (el límite de Zoho por usuario). Cuentan
también las pruebas.

## 6. El panel

| Página | Qué enseña |
|---|---|
| **Analítica** (`/dashboard/comunicaciones/analitica`) | El agregado, con selector de periodo: totales; **por comunicación**; **por plantilla** (los envíos de una misma plantilla juntos, cada uno con sus cifras, y las personas distintas alcanzadas); **por cuenta** (cuántas recibió, abrió y pulsó, y su última actividad) |
| **Analítica de una comunicación** (`/dashboard/comunicaciones/{id}/analitica`) | Cifras; evolución de las primeras 72 horas; enlaces más pulsados; tabla de destinatarios con filtros, buscador, CSV y el detalle de cada apertura y cada clic |

Filtros: no consta apertura · abrió · hizo clic · abrió y no hizo clic · pulsó un enlace concreto ·
error al enviar · rebotado.

Cómo leerlo, y lo dice la propia pantalla:

- Una apertura solo consta si el programa de correo carga las imágenes. **«No consta apertura» no
  significa «no lo leyó».** Los clics son el dato fiable; quien pulsa cuenta como que abrió.
- Lo enviado **en modo pruebas, por la pasarela simulada o antes de existir el seguimiento** se
  enseña aparte («Fuera de las cifras») y no entra en el agregado.
- **Entrega y rebotes, parcial**: «Consultar entrega en Zoho» pregunta por cada correo, y Zoho solo
  contesta para unas 62 de las 164 cuentas. El resto queda «sin dato».

## 7. El reenvío

En la analítica de una comunicación enviada en modo real, con un filtro aplicado: **«Preparar
reenvío a estas N cuentas»**.

- Crea una **comunicación nueva, en borrador**, ligada a la original (`origen_comunicacion_id`,
  `reenvio_filtro`). No envía nada.
- El servidor recalcula quién cumple el filtro; no se fía de lo que tenga el navegador.
- Los destinatarios se vuelven a resolver con los datos de Zoho de hoy (bajas, direcciones
  cambiadas), limitados a las cuentas filtradas y con los mismos papeles.
- Pasa por **todos** los controles —revisión, prueba, ensayo, confirmación tecleada, tandas— y por
  el candado. La plantilla nace siendo la original y se puede cambiar.

## 8. Datos

Migración `…_049_comunicaciones_analitica.sql`, aplicada el 2026-10-06
(`npm run comunicaciones:apply-migration-049`).

| Tabla | Qué guarda |
|---|---|
| `com_destinatario` (columnas nuevas) | Identificador de seguimiento, destinos de sus enlaces, huella, aperturas y clics con su primera y última vez, y lo que dice Zoho de la entrega |
| `com_enlace` | Los enlaces de cada comunicación, para agrupar los clics |
| `com_evento` | Una fila por apertura o clic: cuándo, qué enlace, agente, si es automático, si es de la prueba |
| `com_comunicacion` (columnas nuevas) | Modo y asunto con que salió, el ensayo, el seguimiento de la prueba y de qué comunicación es reenvío |
| `com_ajustes.limite_diario` | El tope diario |

**Privacidad.** Registrar aperturas y clics por persona es tratamiento de datos personales. Se
guarda: qué cuenta y a qué dirección, cuándo abrió o pulsó, qué enlace y el agente del programa de
correo. No se guarda la IP. **Conviene confirmarlo con quien lleve protección de datos antes de
usarlo con inversores.**

## 9. Probado el 2026-10-06

En local, con la base real y bajo el candado:

- **Simulado** (`COMUNICACIONES_PASARELA=simulada`): recorrido completo, rutas de seguimiento con
  identificadores válidos, desconocidos, fuera de rango, de la prueba y de correos que no llegaron
  a salir (estos no anotan nada).
- **Real, cuatro correos, los cuatro solo a `javiercanas@imparcapital.com`** (comprobado en su
  buzón): prueba y envío de una comunicación a TEST CUENTA JCV_Updated; clic seguido desde el
  correo recibido (Zoho → portal → destino) y visto en el panel; reenvío preparado desde el filtro
  «Hizo clic», con su prueba y su envío. El agregado agrupa los dos envíos de la misma plantilla
  con cifras separadas.

El recorrido destapó y dejó corregidos tres fallos: un servidor local que se creía simulado y salía
por Zoho (ahora hay interruptor explícito), el ensayo que no dejaba ensayado al omitido por
dirección repetida, y la huella que nunca coincidía por la clave de imagen de Zoho.

**Sin comprobar todavía, y solo comprobable tras el merge**: las **aperturas** con el correo de
verdad. `go.imparcapital.com` sirve producción, y producción no tiene las rutas de seguimiento
hasta que la PR esté en `main`. Tampoco se ha enviado de verdad una plantilla sin imágenes (el
logotipo al pie está cubierto por pruebas automáticas y por la vista previa).

## 10. Pruebas automáticas

En `npm run check`, sin red:

| Fichero | Qué fija |
|---|---|
| `logic/__tests__/seguimiento.test.ts` | Reescritura de enlaces e imagen; logotipo solo si no había imagen; lecturas automáticas; sintaxis y erratas de direcciones |
| `logic/__tests__/validarCorreo.test.ts` | Cada regla diciendo que no; la huella: qué la cambia y qué no |
| `logic/__tests__/plantilla.test.ts` | Tipos de campo admitidos y lo que queda sin resolver |
| `logic/__tests__/analitica.test.ts` | Cifras, filtros, la misma plantilla enviada dos veces, y que el reenvío no incluye cuentas ajenas al original |
| `logic/__tests__/controles.test.ts` | Ensayo vigente y tope diario |
| `data/pasarela/__tests__/pasarela.test.ts` | El interruptor de pasarela simulada |
