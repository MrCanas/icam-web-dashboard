# Aplicación corrección entry_date

## Verificación pre-aplicación (emparejamiento endurecido)

Generado: 2026-05-28T16:25:33.772Z

✓ **0 desajustes de content** en todos los pares.

✓ **0 casos de revisión manual** (grupos duplicados con created_at empatado y status_after distinto).

### Por proyecto

| Proyecto | Total DB | Pares | A actualizar | Sin cambio | Reales | Anomalías | Cuadre | vs dry-run 11 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |
| CA1 | 170 | 150 | 88 | 62 | 20 | 0 | ✓ | ✓ |
| CSP10 | 302 | 292 | 290 | 2 | 10 | 0 | ✓ | 290 vs 289 |
| PC25 | 644 | 644 | 190 | 454 | 0 | 0 | ✓ | 190 vs 203 |
| VBARE | 95 | 95 | 0 | 95 | 0 | 0 | ✓ | ✓ |
| VE1 | 281 | 241 | 202 | 39 | 40 | 0 | ✓ | ✓ |

✓ Ningún cambio propuesto con `created_at >= 2026-05-27T00:00:00.000Z`.

### Muestra de cambios propuestos (15)

- **CA1** · SOCIETARIO|Gobernanza · 2026-05-22 → 2026-03-05
- **CA1** · SOCIETARIO|Gobernanza · 2026-05-22 → 2026-03-26
- **CA1** · SOCIETARIO|Gobernanza · 2026-05-22 → 2026-04-09
- **CA1** · SOCIETARIO|Gobernanza · 2026-05-22 → 2026-04-30
- **CA1** · SOCIETARIO|Gobernanza · 2026-05-22 → 2026-05-14
- **CA1** · SOCIETARIO|Levantamiento de Capital|Proceso comercialización · 2026-02-02 → 2026-01-29
- **CA1** · SOCIETARIO|Levantamiento de Capital|Proceso firma · 2026-02-02 → 2026-01-29
- **CA1** · SOCIETARIO|Levantamiento de Capital|Capital Call · 2026-02-02 → 2026-01-29
- **CA1** · SOCIETARIO|Compraventa · 2026-02-02 → 2026-01-29
- **CA1** · SOCIETARIO|Viaje inversores · 2026-05-22 → 2026-04-30
- **CA1** · ESTADO PROYECTO|Tramitación de licencias · 2026-02-02 → 2026-01-29
- **CA1** · ESTADO PROYECTO|Tramitación de licencias · 2026-05-22 → 2026-03-19
- **CA1** · ESTADO PROYECTO|Tramitación de licencias · 2026-05-22 → 2026-03-26
- **CA1** · ESTADO PROYECTO|Tramitación de licencias · 2026-05-22 → 2026-04-30
- **CA1** · ESTADO PROYECTO|Presupuesto obra · 2026-05-22 → 2026-05-14

> **Estado: OK para aplicar** — ejecutar `npm run actas:apply-entry-dates -- --apply`.

## Aplicación (--apply)

✓ Backup `log_entry_entrydate_backup_20260528`: **770** filas.

## Post-aplicación

| Proyecto | Propuestos | Actualizados | Saltados (drift) | element.status recalc | Fechas distintas (migr.) antes → después |
| --- | ---: | ---: | ---: | ---: | --- |
| CA1 | 88 | 88 | 0 | 2 | 8 → 13 (✓) |

### Spot-checks CA1

**SITUACIÓN INQUILINOS|Vaciado de pisos|Antena**

```
2026-03-05 | — | Pendiente enviar burofax para vencimiento el 01/08/2026
2026-03-26 | — | Enviado burofax de vencimiento para el 01/08/2026
2026-05-14 | — | Enviado burofax de vencimiento para el 01/08/2026. 
Se van antes de la
```

**ESTADO PROYECTO|Interiorismo**

```
2026-01-15 | — | Inicio de trabajo con IM
2026-01-29 | — | Trabajndo en paralelo con layout y PB
2026-03-05 | — | Trabajndo en paralelo con layout y PB. Reuniones con HBA, Rockwell. ND
2026-03-19 | — | Trabajndo en paralelo con layout y PB. Reuniones con HBA, Rockwell, y 
2026-03-26 | — | Pendiente cerrar contrato con HBA para comenzar a desarrollar el Proye
2026-04-09 | — | Cerrado contrato con HBA para comenzar a desarrollar el Proyecto de in
2026-04-16 | — | Se hace reunión de kick off con HBA el 08/04/2026, se hace visita al e
2026-05-28 | — | Se mantiene reunión de presentación de Concept con HBA. HBA está traba
2026-05-28 | — | Se mantiene reunión de presentación de Concept con HBA el 18/05. HBA e
```

**SOCIETARIO|Gobernanza**

```
2026-01-15 | — | Inscrito. 
Pendiente acta Q4 2025 Pedro
2026-02-12 | — | Inscrita. 
Pendiente envio firma acta Q4 2025
2026-03-05 | — | Inscrita.
2026-03-26 | done | Pendiente disminución y aumento de capital.
2026-04-09 | working_on_it | Pendiente disminución y aumento de capital.
Pendiente revisar cambio d
2026-04-30 | — | Pendiente de inscripción disminución y aumento de capital.
Pendiente r
2026-05-14 | — | Pendiente de inscripción disminución y aumento de capital.
Pendiente r
2026-05-28 | — | Disminución y aumento inscritos. 
CCAA a la espera de recibir acta por
```

| CSP10 | 290 | 290 | 0 | 0 | 3 → 29 (✓) |

### Spot-checks CSP10

**ESTADO PROYECTO|Tramitación de licencias**

```
2025-06-26 | — | ERIU metido esperando para meter Proyecto Básico, se hace seguimiento

2025-07-03 | — | ERIU metido esperando para meter Proyecto Básico, se hace seguimiento

2025-07-11 | — | ERIU metido esperando para meter Proyecto Básico, se hace seguimiento

2025-07-17 | — | ERIU metido esperando para meter Proyecto Básico, se hace seguimiento

2025-07-23 | — | ERIU metido esperando para meter Proyecto Básico, se hace seguimiento

2025-07-31 | — | ERIU metido esperando para meter Proyecto Básico, se hace seguimiento

2025-09-04 | — | Se aprobó 20/08 el Plan de Movilidad. Pendiente de inscribir el ERIU. 
2025-09-11 | — | Se aprobó 20/08 el Plan de Movilidad. Pendiente de inscribir el ERIU. 
2025-09-18 | — | Se aprobó 20/08 el Plan de Movilidad. Pendiente de inscribir el ERIU. 
2025-09-25 | — | Se aprobó 20/08 el Plan de Movilidad. Pendiente de inscribir el ERIU. 
2025-10-02 | — | Respecto al pago del ICIO, puesto que al ser obra nueva no está bonifi
2025-10-16 | — | Se entrega P. básico y solicita licencia el 17/10/2025. con las modifi
```

**ESTADO PROYECTO|Antena**

```
2025-06-26 | — | Se debe retomar el último correo (Solicitar a Pepe)
2025-07-03 | — | Hemos recibido propuesta de reubicación del Operador
Se comienza a def
2025-09-04 | — | Hemos recibido propuesta de reubicación del Operador
Se comienza a def
2025-09-11 | — | Hemos recibido propuesta de reubicación del Operador
Se comienza a def
2025-09-18 | — | Hemos recibido propuesta de reubicación del Operador
Se comienza a def
2025-09-25 | — | Se convoca a reunión de seguimiento el día 29/09. Se solicita por part
2025-10-02 | — | Reunión mantenida, se envía acta vía email con los puntos a tratados y
2025-10-16 | — | Se recibe el CAP, se incorpora en al doc del proyecto básico
2025-10-23 | — | Se recibe el CAP, se incorpora en al doc del proyecto básico. Importan
2025-11-13 | — | Se decide alimentar la antena con luz de obra exclusiva para ella, pdt
2025-11-27 | — | Se decide alimentar la antena con luz de obra exclusiva para ella, Ade
2025-12-11 | — | Se decide alimentar la antena con luz de obra exclusiva para ella, Ade
```

**COMERCIAL|Alquiler antena**

```
2025-06-26 | — | Burofax enviado para cambio de titularidad. Pendiente de comenzar a co
2025-08-07 | — | Recibimos notificación de cambio de arrendador. Pendiente recibir rent
2025-09-04 | — | Recibimos notificación de cambio de arrendador. 
No pagan rentas atras
2025-09-11 | — | Recibimos notificación de cambio de arrendador. 
Pagado desde 25/06 a 
2025-09-25 | — | Recibimos notificación de cambio de arrendador. 
Pagado desde 25/06 a 
2025-10-02 | — | No pagado, ya reclamado y pendiente de respuesta.
2025-10-16 | — | No han pagado, ya reclamado y pendiente de respuesta.
2025-10-23 | — | Nos contestaron que en octubre regularizaran los pagos. De momento no 
2025-11-13 | — | Han abonado 1.224 euros de 2.931,70 euros que tienen pendientes hasta 
2025-11-13 | — | Pendiente pagos desde septiembre de la antena, nos dicen que los harán
2025-11-27 | — | Han abonado 1.224 euros de 2.931,70 euros que tienen pendientes hasta 
2025-12-11 | — | Recibidos pagos hasta diciembre.
Pdte hacer previsión de gastos exclus
```

| PC25 | 190 | 190 | 0 | 0 | 24 → 34 (✓) |

### Spot-checks PC25

**PROPERTY MANAGEMENT|Seguros**

```
2025-06-06 | — | Depende del banco con que se firme
TRC y RC
2025-06-12 | — | Depende del banco con que se firme
TRC y RC
2025-06-19 | — | Depende del banco con que se firme
TRC y RC
2025-06-26 | — | Sin seguro hasta comenzar la construcción
TRC y RC
2025-07-03 | — | Sin seguro hasta comenzar la construcción
TRC y RC
2025-07-17 | — | Sin seguro hasta comenzar la construcción
TRC y RC
2025-07-23 | — | Sin seguro hasta comenzar la construcción
TRC y RC
2025-08-28 | — | Sin seguro hasta comenzar la construcción
TRC y RC
2025-09-04 | — | En proceso de RC para solares
2025-09-11 | — | En proceso de RC para solares
2025-09-18 | — | Contratado seguro RC solar. 790€/anual
2025-10-02 | — | Contratado seguro RC solar. 790€/anual
```

**SOCIETARIO|Gobernanza**

```
2025-06-06 | — | Sociedad constituida. Aportes de capital hechos. Pendientes de elevaci
2025-06-12 | — | Sociedad constituida. Aportes de capital hechos, pendientes 2. Pendien
2025-06-19 | — | Lunes 23/06 se adquieren los terrenos y se eleva a público el aumento 
2025-06-26 | — | Terrenos adquiridos y aumentado el capital social
Pendiente cambio de 
2025-07-03 | — | Terrenos adquiridos y aumentado el capital social
Pendiente cambio de 
2025-07-17 | — | Terrenos adquiridos y aumentado el capital social
Pendiente cambio de 
2025-07-23 | — | Terrenos adquiridos y aumentado el capital social
Pendiente cambio de 
2025-08-28 | — | Terrenos adquiridos y aumentado el capital social
Pendiente cambio de 
2025-09-04 | — | Terrenos adquiridos y aumentado el capital social
Pendiente cambio de 
2025-09-11 | — | Terrenos adquiridos y aumentado el capital social
Pendiente elevación 
2025-09-18 | — | Terrenos adquiridos y aumentado el capital social
Pendiente elevación 
2025-10-02 | — | Terrenos adquiridos y aumentado el capital social
Pendiente elevación 
```

**ESTADO PROYECTO|Proyecto Arquitectura**

```
2025-06-06 | — | Modificando proyecto para adaptar a respuesta de requerimiento
2025-06-12 | — | Modificando proyecto para adaptar a respuesta de requerimiento
2025-06-19 | — | Modificando proyecto para adaptar a respuesta de requerimiento
2025-06-26 | — | Modificando proyecto para adaptar a respuesta de requerimiento
2025-07-11 | — | Modificando proyecto para adaptar a respuesta de requerimiento
Reunión
2025-07-17 | — | Modificando proyecto para adaptar a respuesta de requerimiento
Reunión
2025-07-23 | — | Modificando proyecto para adaptar a respuesta de requerimiento
Aprobad
2025-07-31 | — | Modificando proyecto para adaptar a respuesta de requerimiento
Aprobad
2025-08-14 | — | Modificando proyecto para adaptar a respuesta de requerimiento
Aprobad
2025-08-28 | — | Modificando proyecto para adaptar a respuesta de requerimiento
Aprobad
2025-09-04 | — | Modificando proyecto para adaptar a respuesta de requerimiento
Aprobad
2025-09-11 | — | Modificando proyecto para adaptar a respuesta de requerimiento
Aprobad
```

| VBARE | 0 | 0 | 0 | 0 | 4 → 4 (✓) |

### Spot-checks VBARE

| VE1 | 202 | 202 | 0 | 2 | 7 → 23 (✓) |

### Spot-checks VE1

**ESTADO PROYECTO|Inicio Obra**

```
2025-09-18 | — | A partir del 15/11. Noviembre ZZCC y 1ºD.
2025-09-25 | — | A partir del 15/11.  ZZCC + 4 viviendas libres. Fecha finalización Feb
2025-10-02 | — | Se indica que se va a proceder a ejecutar ZZCC + 4 viviendas libres. F
2025-10-09 | — | Se indica que se va a proceder a ejecutar ZZCC + 4 viviendas libres. F
2025-10-16 | — | Se indica que se va a proceder a ejecutar ZZCC + 3 viviendas libres. F
2025-11-06 | — | Se indica que se va a proceder a ejecutar ZZCC + 3 viviendas libres. F
2025-11-27 | — | Se está trabajando con las viviendas libres y trabajo con saneamiento.
2025-12-18 | — | Se está trabajando con las viviendas libres y trabajo con saneamiento 
2026-01-15 | — | Se está trabajando con las viviendas libres y trabajo con saneamiento 
2026-02-12 | — | Inicio de Obra 1D/4D/4F: 24/11/2025
Inicio de Obra ZZCC: 20/12/2025
2026-03-19 | — | Finalizada Obra 1D/4D/4F: marzo 2026 (pdte repasos)
Finalizada Obra ZZ
2026-03-26 | — | Finalizada Obra 1D/4D/4F: marzo 2026 (pdte repasos)
Finalizada Obra ZZ
```

**PROPERTY MANAGEMENT|Suministros|Saneamiento**

```
2025-09-18 | — | Visita 18/09. Recibiremos semana 22/09 presupuesto.
2025-09-25 | — | Visita 18/09. Recibiremos semana 22/09 presupuesto. Recibido presupues
2025-10-09 | — | Presupuesto aprobado. Se hará la revisión el martes 14/10 por la mañan
2025-10-16 | — | Revisión de saneamiento hecha el 15/10. Nos adelantan que ven deficien
2025-10-23 | — | Cerraremos reunión para la semana del 24/10 para revisión de informe y
2025-10-30 | — | Informe de saneamiento recibido.
2025-11-06 | — | Informe de saneamiento recibido. Esperando segundo presupuesto a travé
2025-11-13 | — | Informe de saneamiento recibido. Segundo presupuesto recibido.
2025-11-20 | — | Aceptado presupuesto de rehabilitación. Fecha tentativa de inicio de t
2025-12-11 | — | Trabajos en marcha. Fecha de finalización el 19/12/2025
2026-01-15 | — | Trabajos finalizados el 19/12/2025.
El lunes 12/01 iniciaron trabajos 
2026-02-12 | — | Trabajos finalizados el 19/12/2025.
El lunes 12/01 iniciaron trabajos 
```

**ESTADO PROYECTO|Interiorismo**

```
2025-09-18 | — | En proceso de licitación.
2025-09-25 | — | Recibido Borrador de contrato, se está revisando. Fecha prevista de la
2025-10-02 | — | Presentado concept el dia 01/10/2025.
Lanzamiento del contrato hoy dia
2025-10-09 | — | Se pone en pausa y se busca alternativa de proveedor.
2025-10-16 | — | Se empieza a gestionar el contrato con Impar Management. 17/10/2025 se
2025-10-23 | — | Se prevee firma de contrato. Se. manda a firma 23/10. 
23/10 se ha rev
2025-11-06 | — | Contrato firmado. 
Semana 10/11 se presenta nuevo proyecto y actualiza
2025-11-27 | — | Contrato firmado.
2026-03-19 | — | Finalizados los 3 pisos amueblados. Pendiente de repasos y remates.
2026-05-28 | — | Finalizados los 3 pisos amueblados
2026-05-28 | done | Estado cambiado: En curso → Hecho
```

✓ Entradas reales modificadas (created_at >= ventana, en backup): **0** (debe ser 0).

## Reversión

Para deshacer todos los cambios de entry_date:

```sql
BEGIN;
UPDATE public.log_entry le
SET entry_date = b.entry_date_old
FROM public.log_entry_entrydate_backup_20260528 b
WHERE le.id = b.id;
-- Recalcular element.status manualmente o repetir lógica de recálculo
COMMIT;
```

La tabla de backup conserva `entry_date_old` y `backed_up_at` para auditoría.

