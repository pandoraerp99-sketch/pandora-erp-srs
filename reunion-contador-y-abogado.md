# Pandora ERP — Reuniones con Contador y Abogado

**Proyecto:** Pandora ERP — SaaS POS+ERP fiscal para comercios chicos AR
**Owner:** Agus Rochelle · agusrochelle@gmail.com
**Status doc:** Listo para imprimir. **Dos reuniones independientes** documentadas en este archivo. Imprimir por separado según a quién consultes.
**Última actualización:** 2026-06-03 PM v4 (extracción Manual QR fiscal RG 4892/2020 — **ADR-0023 §QR Decisión 2 = 100% validado oficialmente** 13/13 campos. A-22 a/b/c parcialmente resueltas técnicamente; falta solo confirmación LEGAL contadora. A-25 nueva — Tipo C ImpOpEx=0 obliga rever régimen Monotributistas TDF Ley 19.640. A-23 + A-24 algunas sub-preguntas ya respondidas empíricamente — ver `tax-policy-versions/ar-2026-06-v2.md`)

| Reunión | Duración | Honorarios USD | Output esperado |
|---|---|---|---|
| **Parte A — Contador** (matriculado, idealmente con experiencia TDF) | ~2-2.5h | USD 100-300 | Definiciones cerradas en los 11 items críticos + lineamiento en los importantes |
| **Parte B — Abogado** (especializado en SaaS / protección de datos AAIP) | ~1-1.5h | USD 100-300 | Definiciones cerradas en 5 puntos críticos legales + lineamiento T&C |

---

## 🎯 CHEAT SHEET EJECUTIVO — qué bloquea exactamente Sprint 6

Este cheat sheet es para imprimir y llevar a la reunión. Vista de 1 página de qué destraba qué.

### Items que BLOQUEAN Sprint 6 fiscal — Contador (10 críticos)

| ID | Tema | Bloquea código |
|---|---|---|
| **A-1** | Stage redondeo PER_LINE vs PER_BRACKET | Cálculo IVA real |
| **A-2** | Modelo "constancia provisoria" post-timeout WSFEv1 | Reconciliación fiscal (ADR-0004) |
| **A-4** | Caché Padrón A5 — política exacta | Refinamiento fail-closed |
| **A-10** | Ley 19.640 TDF — texto + rubros + default | Tickets TDF amparados |
| **A-11** | Ley 27.743 Transparencia Fiscal — texto literal + estructura | Primer ticket impreso productivo |
| **A-18** | RG 5003/2021 — RI a Monotri = clase A + leyenda Ley 27.618 | LIS facturación a Monotri (caso real) |
| **A-19** | RG 5762/2025 — sub-tipos A (Op. Sujeta a Retención / Pago CBU) | Catálogo tipos comprobante Sprint 6 |
| **A-20** | RG 5782/2025 — política CAEA pool + contingencia | ADR-0004 reconciliación reescritura |
| **A-21** | RG 5824/2026 — vinculación PV ↔ actividad (opcional) | Setup Punto de Venta |
| **A-22** | **NUEVA** RG 4892/2020 — representación legal QR (imagen vs JSON) | Persistencia snapshot ADR-0023 |
| **A-23** | **NUEVA (Auditoría Beta 2026-06-03)** CondicionIVAReceptorId estado real obligatoriedad al 01/08/2026 + caso CF cash sin DocTipo | Schema fiscal_snapshots NOT NULL vs NULL + handler payload |
| **A-24** | **NUEVA (Auditoría Beta 2026-06-03)** Manual WSFEv1 v4.2 — re-validación QR spec + validaciones nuevas + códigos error + ImpOpEx semántica. **Estado: ✅ parcialmente resuelta empíricamente** post-extracción Manual v4.2 (ver `ar-2026-06-v2.md`) |
| **A-25** | **NUEVA (Auditoría Beta 2026-06-03 PM)** Tipo C + ImpOpEx=0 obligatorio per Manual v4.2 → Monotributista TDF ¿cómo amparar Ley 19.640? | A-10 redirigida + scope Pandora F0 (¿solo RI TDF?) |

### Items que BLOQUEAN Sprint 6 fiscal — Abogado (1 crítico)

| ID | Tema | Bloquea código |
|---|---|---|
| **B-6** | Ángulo legal de venta cobrada sin CAE post-2h | Cierre A-2 (constancia provisoria) |

### Después de las reuniones — qué se desbloquea

- ✅ Auditoría Beta pre-fiscal (validación final pre-Sprint 6)
- ✅ Sprint 6 fiscal arranca (3 semanas estimadas)
- ✅ Pandora puede emitir primera factura productiva

### Validaciones humanas que NO bloquean Sprint 6 (pueden esperar)

- A-3, A-5, A-6, A-7, A-8, A-9 (contador) — pre-primer cliente real productivo
- A-12 a A-17 (contador) — conocimiento empírico nice-to-have
- B-1, B-2, B-3, B-4, B-5, B-7, B-8, B-9, B-10 (abogado) — pre-lanzamiento

---

## Contexto en 30 segundos (compartido)

Pandora es un POS+ERP que reemplaza la combinación "Excel + facturador RCEL" para kioscos, mercerías, panaderías, ferreterías. Factura electrónica AFIP integrada desde día 1 (WSAA + WSFEv1 + Padrón A5). Multi-tenant (varios comercios en una misma base) con contador externo invitado gratis para ver N empresas con un login. Target Fase 0: 5 clientes pagando en Tierra del Fuego. Stack: Next.js 16 + Supabase Postgres + Drizzle ORM + Vercel.

Documentación previa: SRS v3.0 + 22 ADRs formales + trilogía de spec arquitectónica (eventos / correlación / reconciliación). La mayoría de decisiones técnicas están cerradas. Estas reuniones son para validar lo fiscal y lo legal específico antes de tipear código productivo y antes de levantar el primer cliente real.

---

## ⚠️ Lo que ya está CERRADO por fuente oficial (no requiere consulta, solo contexto)

Investigación 2026-05-27 con fuentes ARCA/AFIP + AAIP + Infoleg + Manuales WSFEv1/WSMTXCA/WSFEX. **No hace falta preguntar nada de lo siguiente** — los items con ⚠️ aparecen sólo como contexto, no como pregunta abierta.

### Fiscal (cerrado oficialmente)

| Tema | Resolución oficial | Fuente |
|---|---|---|
| **Modo de redondeo** | `HALF_EVEN` (Round Half Even) en WSFEv1, WSMTXCA y WSFEX | Manuales oficiales AFIP (3 docs) |
| **TDF en webservices AFIP** | WSFEv1 reconoce explícitamente condición `10 - IVA Liberado – Ley N° 19.640` en CondicionIVAReceptorId | Manual WSFEv1 |
| **TDF — ley de fondo** | Ley 19.640 exime impuestos nacionales por hechos/actividades/operaciones en TDF | Infoleg |
| **WS para retail TDF** | WSFEv1 estándar alcanza. WSFEX es exportación y WSBFE es MiPyMEs/FCE — NO obligatorios para kioscos/ferreterías fueguinas | Manuales AFIP |
| **`ImpOpEx` para exentos** | Campo "Importe exento" del header WSFEv1, separado del array `Iva[]`. Para Tipo C el array IVA NO se informa | Manual WSFEv1 |
| **DocTipo tipo A** | Debe ser `80` (CUIT). DocNro con rango específico | Manual WSFEv1 |
| **CondicionIVAReceptorId** | Obligatorio conforme **RG 5616** | Normativa AFIP |
| **CUIT inactiva/inválida** | Rechazo de CAE excluyente, salvo para nota de crédito | Manual WSFEv1 |
| **Plazo entrega al cliente** | Comprobante electrónico autorizado debe ponerse a disposición dentro de **10 días** de asignado el CAE | Régimen factura electrónica AFIP |
| **"Ticket no fiscal" oficial** | El término pertenece al régimen de **controladores fiscales**, NO es un fallback válido para WSFEv1 timeout | Régimen AFIP controladores fiscales |
| **Retención fiscal** | 10 años (Ley 11.683) + Decreto 1397/79 + régimen de comprobantes electrónicos originales | Ley 11.683 + Decreto 1397/79 |
| **Régimen Transparencia Fiscal Ley 27.743** | OBLIGATORIO desde 2025. Leyenda "Régimen de Transparencia Fiscal al Consumidor Ley 27.743" + IVA en línea separada + "Otros impuestos nacionales indirectos" en otra línea | Ley 27.743 + comunicación ARCA |

### Legal / protección datos (cerrado oficialmente)

| Tema | Resolución oficial | Fuente |
|---|---|---|
| **Inscripción AAIP** | OBLIGATORIA para bases privadas destinadas a dar informes. Trámite vía TAD con clave fiscal nivel 2+. Incumplimiento = sanciones | Ley 25.326 + AAIP |
| **Categorías típicas de base** | Clientes, proveedores, personal, publicidad (bases de Pandora encajan) | AAIP — portal público |
| **Deber confidencialidad + seguridad** | Establecido por Ley 25.326 sobre datos personales | Ley 25.326 |
| **Derechos ARCO** | Acceso + Rectificación/Actualización/Supresión reconocidos por Ley 25.326 | Ley 25.326 |
| **"Datos personales" — definición** | Amplia para personas físicas (Art. 2 Ley 25.326). "Datos sensibles" tienen tratamiento especial (Art. 7) | Ley 25.326 |
| **Conservación fiscal** | 10 años — confirma A6.1 parcial | Ley 11.683 |

### Implicancia para Pandora (alineación arquitectónica)

- ✅ ADR-0005 Dimensión 1 (HALF_EVEN) — confirmado oficialmente, no requiere validación
- ✅ ADR-0022 `jurisdiction_context` + `LEY_19640` + `tdf_exempt` — alineado con WSFEv1 código 10
- ✅ ADR-0022 `FiscalBreakdown` — alineado con Régimen Transparencia Fiscal Ley 27.743 (no es invención propia)
- ✅ ADR-0022 `ImpOpEx` para exentos en WSFEv1 — confirmado oficialmente
- ✅ Retención XML AFIP 10 años — confirmado por Ley 11.683
- ❌ **"Ticket no fiscal post-2h sin CAE" como reemplazo de comprobante fiscal — NO ES VÁLIDO según fuentes oficiales.** Esto invalida parte del modelo ADR-0004 actual (ver pregunta A-2 reformulada).

---

# PARTE A — REUNIÓN CONTADOR

**Duración estimada:** ~2 horas
**Honorarios estimados:** USD 100-300 / ARS 80k-300k
**Output esperado:** definiciones cerradas en los 5 puntos críticos + lineamiento en los importantes

---

## Decisiones técnicas ya tomadas (no cuestionar, solo validar si rompen algo fiscal)

- **Money:** `numeric(19,4)` interno, presentación AFIP a 2 decimales, HALF_EVEN (confirmado oficial)
- **Numeración:** `SELECT FOR UPDATE` en `invoice_sequences` por (sale_point, invoice_type); números quemados nunca se reutilizan
- **AFIP timeout:** sincrónico 30s; si timeout → `fiscal_status = requires_reconciliation` + worker async retoma cada 5 min × 24 intentos = 2h ventana. **PENDIENTE A-2 + B-6:** qué se le entrega al cliente entre venta cobrada y emisión post-CAE (el modelo "ticket no fiscal" del ADR-0004 original quedó invalidado por fuente oficial — ver bloque ⚠️ arriba). Necesitamos definir el modelo de "constancia provisoria" o anulación.
- **Customer snapshot inmutable:** cada venta y cada factura capturan datos del cliente al momento; no se reescriben si el cliente cambia datos después
- **Multi-tenant:** RLS con `auth.jwt() ->> 'company_id'` (no `current_setting`)
- **Audit log:** append-only, write-only server-side, dentro de la misma transacción que la operación de negocio
- **Reconciliation Engine:** worker dedicado `afip-reconcile-pending` con SKIP LOCKED + recovery vía `FECompUltimoAutorizado` + `FECompConsultar` + validación de match obligatoria (ImpTotal + DocTipo + DocNro)

---

## 🔴 PREGUNTAS CRÍTICAS (bloquean código fiscal)

### A-1. Stage de redondeo (PER_LINE vs PER_BRACKET) + conciliación de centavos

> ⚠️ Modo (HALF_EVEN) ya cerrado por fuente oficial — no preguntar. Esta sección es sólo sobre **cuándo redondear** (stage).

**Contexto:** ARCA documenta el modo (HALF_EVEN) en manuales WSFEv1/WSMTXCA/WSFEX, pero **no fija el stage**. La única exigencia técnica de WSFEv1 es la invariante `ImpIVA == sum(Iva[].Importe)` con tolerancia 0. El resto es decisión profesional contable.

**Caso concreto:** factura A con 3 items × $333.335 + IVA 21%.

- ☐ **PER_LINE** — redondear IVA de cada item, después sumar.
  - $333.34 IVA por item × 3 = $1000.02 IVA total
  - Cada línea del comprobante es coherente con su IVA
  - Pro: la línea del ticket impreso "cuadra" con su IVA visible
  - Contra: puede diferir del IVA calculado sobre el total

- ☐ **PER_TAX_BRACKET** — agrupar items por alícuota, redondear el subtotal del grupo
  - round(3 × $333.335 × 0.21) = $210.00
  - Pro: alineado con shape WSFEv1 (array `Iva[]` agrupa por alícuota)
  - Contra: las líneas individuales pueden NO cuadrar con la suma del grupo

**Hipótesis de Pandora:** PER_LINE por defecto, configurable a PER_BRACKET si tu criterio fundamenta lo contrario.

Recomendación del contador: ☐ PER_LINE ☐ PER_BRACKET ☐ Otro: __________

**Sub-pregunta — tratamiento contable de la diferencia:** si IVA por línea suma $1000.02 pero IVA por total da $1000.01, ¿cómo se trata contablemente esa diferencia de centavos?

- ☐ Asiento de ajuste "diferencia de redondeo"
- ☐ Se acepta sin ajuste (diferencia estándar tolerada)
- ☐ Depende del monto / umbral: __________
- ☐ Otro tratamiento: __________

¿Hay límite contable de diferencia tolerable (ej: hasta $1 ARS sin ajuste)? __________

**Sub-pregunta nueva (research 2026-06-11) — estándar industria SaaS AR:**

> 📊 **Comparación con SaaS líderes:** investigación previa a esta reunión detectó que **Stripe Tax, Siigo, Bind ERP** usan PER_BRACKET por defecto. Argumento técnico: la estructura del array `Iva[]` en WSFEv1 agrupa por alícuota — PER_BRACKET es coherente con el shape oficial. PER_LINE puede acumular errores de redondeo que rompan la invariante WSFEv1 con tolerancia 0 en multi-alícuota + descuentos prorrateados.

**Pandora está actualmente con PER_LINE implementado** (decisión cerrada 2026-06-03 antes de este research). Si tu recomendación es PER_BRACKET, el refactor es ~2-3h antes de Sprint 6 fiscal.

- ¿Hay razón **normativa AR** para preferir uno sobre otro? ☐ Sí → cuál: __________ ☐ No, es indistinto profesionalmente
- Si es indistinto: ☐ Mantener PER_LINE (Pandora actual) ☐ Cambiar a PER_BRACKET (estándar industria)
- En multi-alícuota con descuentos: ¿alguno de los dos rompe en práctica? __________

### A-2. Cómo proceder cuando WSFEv1 timeout > 2h (sabiendo que el "ticket no fiscal" NO es comprobante fiscal válido)

> ⚠️ La investigación oficial confirmó que el término "comprobante no fiscal" pertenece al régimen de **controladores fiscales**, NO es un fallback válido para WSFEv1. Además, el comprobante autorizado debe ponerse a disposición del cliente dentro de 10 días de asignado el CAE. **Esto invalida el modelo actual de Pandora** (ADR-0004 sección reconciliación) que asumía que un ticket interno post-2h podía ser entregado al cliente como comprobante operativo.

**Escenario real:** AFIP no responde tras 24 reintentos en 2h. La venta ya quedó cobrada (cliente pagó), mercadería entregada. Sin CAE no hay comprobante fiscal válido.

**Necesitamos cerrar:** ¿qué hacemos legalmente con esa venta?

- ☐ **Opción A — entregar recibo interno NO FISCAL etiquetado como "constancia provisoria"** + obligación de emisión del comprobante fiscal dentro de 10 días cuando AFIP responda. Cliente queda sabiendo que recibirá factura fiscal por mail. Pandora marca venta como `fiscal_status=requires_reconciliation`. ¿Es defendible?
- ☐ **Opción B — anular la venta y devolver el dinero al cliente** si no podemos obtener CAE en X minutos
- ☐ **Opción C — esperar contingencia de AFIP** (puede ser horas) con el cliente esperando físicamente — no realista en retail
- ☐ **Opción D — otra solución que conozcas en la práctica:** __________________________

**Pregunta sub-a:** ¿Existe alguna figura legal-fiscal de **"constancia provisoria de operación"** o equivalente que un POS pueda imprimir mientras se obtiene el CAE, con leyenda específica que aclare "este NO es comprobante fiscal, factura electrónica será enviada dentro de 10 días"?

Respuesta: ____________________________________________________________

**Pregunta sub-b:** Si el cliente reclama factura física en el momento y no podemos emitir CAE — ¿qué hace un comercio TDF en la práctica? ¿Se rechaza la venta? ¿Se entrega mercadería contra promesa de mail?

Respuesta: ____________________________________________________________

**Pregunta sub-c:** Si tras 10 días seguimos sin CAE (downtime extendido AFIP), ¿hay obligación de anular/devolver, o se puede emitir con fecha retroactiva una vez que AFIP vuelva?

Respuesta: ____________________________________________________________

**Sub-pregunta nueva (research 2026-06-11) — CAEA como solución oficial:**

> 🔴 **Hallazgo del research previo:** investigación detectó que las opciones A/B/C/D listadas arriba pueden estar **superadas por CAEA**. Cronología normativa:
> - **RG 5782/2025** (BO 03/11/2025): CAEA pasa a "único mecanismo de contingencia" sujeto a Título III RG 4290
> - **RG 5785/2025**: para emisores WS, CAEA es "primera opción de contingencia obligatoria"
> - **RG 5852/2026** (BO 29/05/2026): **elimina el requisito de adhesión previa desde 01/06/2026** — cualquier contribuyente puede usar CAEA como contingencia sin tramitar alta especial
>
> SaaS líderes (Alegra, Zeus ERP) implementan CAEA como fallback automático: cuando CAE falla, emiten con CAEA. El cliente recibe un comprobante CAEA, no un recibo interno provisional.

**El modelo "correcto" según esta investigación sería:**
```
venta cobrada → timeout WSFEv1 → activar CAEA pre-cargado →
  emitir con CAEA → reportar a ARCA dentro de 8 días post-quincena
```

**Sub-pregunta urgente para esta reunión:**

- ¿LIS ya tiene CAEA habilitado (pre-RG 5852) o usás CAE-online exclusivamente? ☐ CAEA habilitado ☐ Solo CAE ☐ No sabés
- ¿Recomendás que **Pandora F0 implemente CAEA desde el día 1** (Sprint 6 fiscal), o se puede diferir a F0.5 lanzando solo con CAE-online?
  - ☐ CAEA desde F0 (riesgo: implementación más compleja antes de primer cliente real)
  - ☐ CAE-online F0 + CAEA F0.5 (riesgo: si AFIP cae durante piloto, NO hay fallback legal)
  - ☐ Otro: __________

> **Cross-ref a A-20** (RG 5782 CAEA): el research previo une A-2 + A-20 como **misma pregunta**. La respuesta a esta sub-pregunta cierra ambas A-* en la misma conversación.

### A-3. `legal_name` y `fiscal_address` en customer_snapshot — ¿capturar aunque WSFEv1 no los exija?

> ⚠️ Lo que ya está cerrado por fuente oficial WSFEv1:
> - **Tipo A:** `DocTipo=80` (CUIT) obligatorio + `DocNro` válido + `CondicionIVAReceptorId` (RG 5616)
> - **Tipo B:** `DocTipo`/`DocNro` válidos si se informan + `CondicionIVAReceptorId`
> - **Tipo C:** array `Iva[]` NO se informa
> - **No obligatorios para AFIP en esquema base:** `legal_name` (razón social) ni `fiscal_address`

**Lo que necesitamos validar contigo:**

- Aunque AFIP no los exija, ¿hay obligación **civil/comercial** (Código Civil, Defensa del Consumidor, etc.) de capturar `legal_name` y `fiscal_address` para tipo A/B?
  - Tipo A: ☐ Sí ☐ No ☐ Recomendado pero no obligatorio
  - Tipo B: ☐ Sí ☐ No ☐ Recomendado pero no obligatorio

- ¿Hay rubros / situaciones donde sí son exigidos (ej: B2B sobre cierto monto, ventas a empresas, etc.)?
  
  Respuesta: ____________________________________________________________

- ¿Falta algún campo que NO esté en este listado y que debamos capturar por defecto en customer_snapshot? (ej: IIBB del cliente, percepciones, condición ante otros impuestos)
  
  Respuesta: ____________________________________________________________

### A-4. Política de caché del Padrón A5 — ¿revalidar siempre o caché 24h aceptable?

> ⚠️ Lo que ya está cerrado: AFIP valida CUIT inactiva/inválida como **excluyente** (rechazo CAE), salvo para nota de crédito. No vale "emitir con CUIT inválido". Lo que NO está en fuentes oficiales es la política exacta de caché vs revalidación en hot path.

**Hipótesis Pandora:** caché de Padrón válido por 24h. Si última validación > 24h o no existe, revalidar antes de emitir. Si Padrón timeout, comportamiento depende de tu criterio:

- ☐ **Estricto** — bloquear emisión si Padrón timeout (no emitir con datos potencialmente stale)
- ☐ **Permisivo con audit** — emitir con caché y log warning (asumir que CUIT no se invalidó en últimas 24h)
- ☐ **Caché más corto** (ej: 6h) — equilibrio: __________
- ☐ **Sin caché — revalidar siempre** — más costoso pero seguro
- ☐ Otro: __________

¿Tenés experiencia empírica de cuánto cambia la condición de un CUIT en 24h en la realidad? (frecuencia de inactivaciones, baja por monotributo, etc.)

Respuesta: ____________________________________________________________

---

## 🟡 PREGUNTAS IMPORTANTES (antes del primer cliente real)

### A-5. Cambio de condición IVA del comerciante — hacia adelante o reemisión

> ⚠️ Los portales oficiales muestran que el contribuyente puede administrar/modificar sus datos y altas/bajas vía clave fiscal. NO encontré regla oficial que obligue a "reemitir" comprobantes históricos por cambio posterior de régimen. Hipótesis razonable: cambio efectivo hacia adelante.

- ¿Confirmás que las facturas ya emitidas NO deben reemitirse cuando el tenant cambia RI ↔ Monotributo, y el cambio aplica sólo a futuras? ☐ Sí ☐ No
- ¿Hay ventana fiscal específica donde NO se puede cambiar (ej: durante un mes ya facturado)? __________

### A-6. Cambio de condición IVA de un cliente con histórico (NC sobre factura vieja)
- NC sobre factura anterior: ¿se usa condición del momento de la NC o de la factura original? __________
- ¿AFIP requiere comunicación específica? ☐ Sí ☐ No

### A-7. Manejo de comprobantes observed / rechazados

> ⚠️ Confirmado por fuente oficial: `CondicionIVAReceptorId` inválido → rechazo en CAE / observación en CAEA. NO existe estado oficial "CAE con observaciones" como equivalente a "emitido normal".

- Para tipo de error/observación más común que veas en la práctica, ¿se entrega al cliente igual y se rectifica con NC, o se bloquea entrega hasta corregir y reemitir?
  
  Respuesta: ____________________________________________________________

- ¿Plazo para corregir una observación antes de quedar en problema fiscal? __________

### A-8. Cold storage para XMLs AFIP > 1 año

> ⚠️ Conservación 10 años + XML original electrónico ya está cerrado por Ley 11.683 + Decreto 1397/79. Sólo queda: **¿formato cold storage es aceptable?**

- ¿Cold storage tipo S3 Glacier (acceso 24-48h al recuperar) es aceptable para XMLs > 1 año, sabiendo que ante inspección AFIP el plazo de respuesta típico es de días?
  - ☐ Sí, aceptable
  - ☐ No, debe estar siempre en acceso inmediato
  - ☐ Depende de: __________

- ¿Es exigible hash + firma digital sobre los XMLs conservados, o alcanza el XML tal cual lo devolvió AFIP?
  - ☐ XML tal cual + hash propio Pandora alcanza
  - ☐ Requiere firma digital adicional
  - ☐ Otro: __________

### A-9. CAE inmediato vs diferido — confirmación de interpretación oficial

> ⚠️ Fuente oficial: comprobante autorizado debe ponerse a disposición del cliente dentro de **10 días** de asignado el CAE. Esto sugiere que "diferido" debe ser estado interno transitorio, NO emisión fiscal terminada.

- ¿Confirmás esta interpretación? ¿Existe alguna categoría de comprobante (NC, FCE, ND) que admita oficialmente emisión diferida sin CAE inmediato en el momento de la venta?
  
  Respuesta: ____________________________________________________________

### A-10. Tierra del Fuego — Ley 19.640 (🔴 CRÍTICO — target F0 real)

> ⚠️ YA cerrado por fuentes oficiales:
> - WSFEv1 tiene código `10 - IVA Liberado – Ley N° 19.640` en `CondicionIVAReceptorId`
> - Ley 19.640 exime impuestos nacionales por hechos/actividades/operaciones en TDF
> - WSFEv1 alcanza para retail TDF (WSBFE es MiPyMEs/FCE, WSCT es turismo)
> - `ImpOpEx` del header es el campo de "Importe exento" en WSFEv1
> - Para Tipo C el array `Iva[]` NO se informa
>
> Eliminadas: preguntas b (¿WSFEv1 alcanza?) y c (¿ImpOpEx o Iva[]?) — ya confirmadas oficialmente.

**Contexto actualizado 2026-05-27:** los comercios piloto F0 son retail pequeño TDF (kioscos, ferreterías, mercerías locales). Por eso TDF deja de ser caso F2+ y pasa a ser jurisdicción soportada desde día 1.

**Buscamos contador con experiencia TDF específicamente.** Si solo conocés caso CABA/GBA estándar, podemos seguir igual — pero las preguntas que siguen requieren input de alguien con experiencia TDF real.

#### A-10.a — Texto legal obligatorio en comprobantes TDF (LO ÚNICO QUE FALTA)

¿Qué texto exacto debe aparecer en facturas/tickets de comercios TDF para operaciones amparadas por Ley 19.640?

Ejemplos vistos en otros sistemas: "Operación amparada por Ley 19.640" · "Venta en zona aduanera especial Ley 19.640" · "Operación exenta — Ley 19.640". ¿Cuál es la fórmula canónica que esperan ver los inspectores en TDF?

Respuesta: ____________________________________________________________________

#### A-10.b — Productos típicos amparados por rubro (criterio práctico)

Para retail pequeño TDF, ¿qué rubros están típicamente amparados? (necesito tu lectura empírica de la práctica fiscal TDF, no el texto frío de la ley)

- Alimentos y bebidas: ☐ amparados ☐ no amparados ☐ depende
- Electrónica de consumo: ☐ amparados ☐ no amparados ☐ depende
- Indumentaria: ☐ amparados ☐ no amparados ☐ depende
- Ferretería / herramientas: ☐ amparados ☐ no amparados ☐ depende
- Productos de limpieza / higiene: ☐ amparados ☐ no amparados ☐ depende

¿Existe un criterio general simple (ej: "todo lo producido en TDF está amparado") o es caso por caso?

Respuesta: ____________________________________________________________________

#### A-10.c — Default conservador ante duda

Si el comerciante TDF no sabe si un producto específico está amparado por exención, ¿cuál es el default conservador desde criterio fiscal-contable?

- ☐ Default exento (cargar exención, después rectificar si corresponde)
- ☐ Default gravado (cobrar IVA, después emitir NC si el cliente tiene derecho)
- ☐ Default según rubro: _______________

**Hipótesis Pandora:** default `gravado` (cobrar IVA). Falso negativo (IVA cobrado de más) es ajustable contablemente. Falso positivo (IVA omitido sin amparo) = riesgo de inspección AFIP + multa.

#### Honorarios y disponibilidad TDF

- Honorarios estimados para esta consulta TDF-specific: USD __________ / ARS __________
- Disponibilidad para consultas posteriores (post-launch): __________
- ¿Tu estudio acepta clientes nuevos en TDF? ☐ Sí ☐ No

### A-11. Régimen de Transparencia Fiscal al Consumidor (Ley 27.743) — texto y estructura

> ⚠️ CONFIRMADO POR FUENTE OFICIAL: desde 2025 todos los comprobantes deben detallar el componente impositivo bajo la leyenda **"Régimen de Transparencia Fiscal al Consumidor Ley 27.743"**, con IVA en línea separada e "Otros impuestos nacionales indirectos" en otra línea.
>
> Esto valida que el `FiscalBreakdown` de Pandora (ADR-0022) no es invención — está alineado con la dirección oficial. Lo que NO está en fuentes que revisé es el **texto literal exacto** de cada línea y la **estructura visual obligatoria**.

#### A-11.a — Texto literal exacto de las líneas obligatorias

¿La leyenda obligatoria es literalmente "Régimen de Transparencia Fiscal al Consumidor Ley 27.743" o admite variantes? __________

Texto literal exacto para la línea de IVA: __________

Texto literal exacto para la línea de otros impuestos: __________ (ejemplos: "Otros impuestos nacionales indirectos", "Otros impuestos nacionales", etc.)

#### A-11.b — Estructura visual / formato

- ¿Las dos líneas (IVA + otros impuestos) deben aparecer SIEMPRE aunque uno de los importes sea cero?
  ☐ Sí ☐ No ☐ Sólo si hay importe
- ¿Hay tamaño tipográfico mínimo o ubicación obligatoria en el ticket (ej: al pie, junto al total, en bloque destacado)? __________
- ¿La leyenda va antes de las líneas, después, o como header de bloque?
  Respuesta: __________

#### A-11.c — Aplicabilidad por tipo de comprobante

- ¿Aplica también a comprobantes Tipo C? ☐ Sí ☐ No
- ¿Aplica a comprobantes TDF amparados (donde IVA = 0 por exención)? ☐ Sí ☐ No — y si aplica, ¿qué se pone en la línea de IVA?
  Respuesta: __________
- ¿Hay rubros / tamaños de comercio exentos del régimen? __________

#### A-11.d — Sanción y plazo

- ¿Cuál es la sanción por incumplimiento de Ley 27.743 a la fecha de tu reunión? __________
- ¿Hay período de gracia / transición vigente para comercios chicos? __________

---

## ⚪ SI QUEDA TIEMPO — Conocimiento empírico (muy útil)

### A-12. Motivos obligatorios en operaciones destructivas

> ⚠️ Investigación oficial: NO encontré obligación normativa general de capturar motivos para cada operación destructiva. Esto se mantiene como pregunta sólo por valor de auditoría / defensa empírica, no como obligación legal.

Lista actual del sistema: anulación de venta, NC, ajuste stock manual, cierre con descuadre, cambio de condición IVA cliente. Desde tu experiencia, ¿hay alguna operación destructiva específica donde la falta de motivo te haya dejado expuesto en inspección? __________________

### A-13. Errores de ERPs típicos en clientes migrados
¿Qué errores de ERPs ves constantemente en clientes que te llegan migrados? _______________

### A-14. Inconsistencias fiscales que disparan inspecciones AFIP en tu cartera
_______________

### A-15. Fallback empírico real cuando AFIP cae
Más allá del ticket no fiscal (que oficialmente no es válido), ¿qué hacen los comercios reales? _______________

### A-16. Reportes contables imprescindibles para competir con Tango/Bejerman
_______________

### A-17. Patrones fiscales provinciales (IIBB CABA, ARBA, otros)
¿Hay algún patrón provincial que un POS deba cumplir aunque el target sea TDF? _______________

### A-19. RG 5762/2025 — Chau factura M, dos sub-tipos A (🔴 vigente desde 1 dic 2025)

ARCA eliminó la factura clase M. La reemplaza con dos sub-tipos de clase A:

| Sub-tipo | Leyenda obligatoria | Cuándo |
|---|---|---|
| A "Operación Sujeta a Retención" | "OPERACIÓN SUJETA A RETENCIÓN" | Sin solvencia patrimonial — reemplazo directo de la vieja M |
| A "Pago en CBU Informada" | "PAGO EN CBU INFORMADA" | Cumple requisitos pero no acredita solvencia, opta por bancarización sin retención |
| A estándar | (sin leyenda específica RG 5762) | Solvencia acreditada |

#### A-19.a — Texto literal exacto de cada leyenda

¿Es exactamente "OPERACIÓN SUJETA A RETENCIÓN" o tiene variantes que ARCA acepta hoy?

¿Es exactamente "PAGO EN CBU INFORMADA" o tiene formato adicional (ej: "Pago en CBU informada: AR12345...")?

#### A-19.b — Cómo Pandora detecta solvencia

¿Hay forma de consultar el estado de solvencia de un emisor vía WebService ARCA / Padrón A5? ¿O es información que el comerciante declara manual en el setup de Pandora?

#### A-19.c — Decisión del sub-tipo en cada emisión

¿Pandora calcula el sub-tipo automáticamente o el cajero elige antes de emitir? ¿Cómo lo hace LIS hoy con PosNet+?

#### A-19.d — LIS solvencia patrimonial

¿LIS tiene acreditada solvencia patrimonial? ¿Cómo se verifica?

#### A-19.e — Coexistencia con otras leyendas

Si emite A "Operación Sujeta a Retención" a un Monotributista (caso límite), ¿van **3 leyendas** en el mismo comprobante?
- "Operación Sujeta a Retención" (RG 5762)
- "Crédito fiscal sólo computable Ley 27.618" (RG 5003)
- "Régimen de Transparencia Fiscal Ley 27.743" (si aplica a receptor)

---

### A-20. RG 5782/2025 — CAEA solo contingencia (revisa A-2 + B-6 — hay respuesta oficial al hallazgo #1)

ARCA dispuso: CAE en línea = norma obligatoria. CAEA = solo fallback de contingencia (corte internet, falla servidor). Adhesión ya no se requiere. Vigencia postergada por RG 5852/2026 al **1 agosto 2026**.

**Esto resuelve parcialmente el hallazgo crítico #1** (ticket no fiscal post-2h no es válido) — CAEA precargados son fallback oficial formal.

#### A-20.a — Pool de CAEA pre-cargados

¿Cuántos CAEA típicamente se solicitan por mes y por sale_point? ¿Hay tope ARCA explícito o solo el 5% mensual del RG 4290?

#### A-20.b — Cómo solicitar CAEA

¿Vía portal web ARCA o WebService? Si WebService, ¿qué método del WSFEv1 o servicio separado?

#### A-20.c — Reporte de uso post-contingencia

Cuando se usa un CAEA (porque WSFEv1 estaba caído), ¿cómo se reporta a ARCA después? ¿Hay método WSFEv1 para esto o es manual?

#### A-20.d — CAEA agotado en contingencia prolongada

¿Qué pasa si se agotan todos los CAEA precargados en una contingencia prolongada (ej: corte 8h)? ¿La venta queda sin comprobante o hay otro mecanismo?

#### A-20.e — LIS adhesión

¿LIS está adherida a CAEA actualmente? (Probable que no — la mayoría de comercios solo usan CAE online).

#### A-20.f — Pandora F0 vs F0.5 alcance

Dada vigencia 1 ago 2026: ¿Pandora F0 debe lanzar con soporte CAEA (riesgo de no llegar) o defer a F0.5/F1+ y operar solo con CAE online F0 (riesgo de bloquearse si AFIP cae)?

---

### A-21. Vinculación Punto de Venta ↔ Actividad económica (RG 5824/2026, opcional desde 1 jul 2026)

ARCA permite (opcionalmente) asociar cada Punto de Venta a una actividad económica declarada específica en el "Sistema Registral". Disponible desde 1 jul 2026 en "Administración de Puntos de Venta y Domicilios". **Opcional, no obligatorio** (al menos por ahora).

#### A-21.a — ¿Conviene declararlo desde día 1?

Aun siendo opcional, ¿hay beneficio fiscal (Ganancias / IIBB / inspecciones) de hacerlo? ¿Conviene que Pandora lo capture desde el primer setup?

#### A-21.b — LIS multi-actividad

¿LIS tiene una o múltiples actividades económicas declaradas? ¿Múltiples sale_points?

#### A-21.c — Código actividad LIS

¿Cuál es el código del Nomenclador AFIP para "venta minorista de telas y mercería"?

---

### A-18. RG 5003/2021 — Factura A a Monotributista + leyenda Ley 27.618 (🔴 destapado por owner 2026-06-01)

Contexto: RG 5003/2021 (AFIP, hoy ARCA) cambió que cuando un Responsable Inscripto le factura a un Monotributista, debe emitir **factura clase A** (no B) con leyenda obligatoria sobre Ley 27.618 (Régimen de Sostenimiento e Inclusión Fiscal para Pequeños Contribuyentes).

LIS (sedería novia owner) es RI clase A. Cuando le vende a otro comercio Monotri (kioscos vecinos, mercerías, etc.), aplica esta RG. Caso real F0.

#### A-18.a — Texto literal exacto de la leyenda

La spec dice:
> "El crédito fiscal discriminado en el presente comprobante sólo podrá ser computado a los efectos del Régimen de Sostenimiento e Inclusión Fiscal para Pequeños Contribuyentes de la Ley 27.618"

¿Es exactamente este texto o tiene variantes que ARCA está aceptando hoy?

¿Cambió en alguna RG posterior (5614/24, 5616/24, 5824/26, 5852/26)?

#### A-18.b — Aplicabilidad a ticket vs factura

¿Aplica a ticket electrónico A (caso típico POS Pandora) o solo a factura A "tradicional"?

¿Hay alguna diferencia en el lugar donde tiene que ir la leyenda según tipo de comprobante?

#### A-18.c — Coexistencia con Ley 27.743 Transparencia Fiscal

Si la operación es a Monotri, ¿van **ambas leyendas** en el mismo comprobante (RG 5003 Ley 27.618 + Ley 27.743 Transparencia Fiscal)?

¿O Transparencia Fiscal no aplica cuando receptor es Monotri por la naturaleza del crédito fiscal?

#### A-18.d — Interacción con Ley 19.640 TDF

Para LIS específicamente (TDF, Ley 19.640): si vende a otro comercio TDF Monotri amparado, ¿aplica RG 5003 normal o hay alguna excepción por el régimen?

#### A-18.e — Sanción y validación Padrón A5

¿Sanción por emitir B (en vez de A con leyenda) a Monotri? ¿Solo administrativa o también penal tributario?

¿Es obligación del emisor verificar en Padrón A5 antes de cada emisión que el CUIT no se haya recategorizado de Monotri a RI o viceversa? ¿O alcanza con la condición declarada por el cliente?

---

### A-22. Representación legal vinculante del QR fiscal (🔴 nueva — introducida en ADR-0023, 2026-06-02)

Contexto verificado en fuente oficial ([QRespecificaciones.pdf ARCA](https://www.afip.gob.ar/fe/qr/documentos/QRespecificaciones.pdf), RG 4892/2020 publicada en Boletín Oficial 24/12/2020):

- El QR es obligatorio en todo comprobante electrónico emitido bajo régimen RG 4291/2018.
- El payload se compone de 13 campos JSON codificados en Base64, concatenados a la URL `https://www.arca.gob.ar/fe/qr/?p={Base64}`.
- El QR es **bit-perfect determinístico** desde el JSON + URL base — la imagen PNG es derivable, no aporta info nueva.

Pandora (ADR-0023) decidió persistir el `qr_payload_json` completo + `qr_version` + `qr_url_base_at_emission` en el snapshot fiscal. La imagen PNG NO se persiste (es regenerable). **Hipótesis Pandora:** ambas representaciones (imagen vs payload Base64) son legalmente equivalentes ya que una es derivación determinística de la otra.

#### A-22.a — Confirmación de equivalencia legal

¿Confirma que para AFIP, los dos formatos son equivalentes a efectos de auditoría / inspección?

- (a) Imagen QR impresa en el comprobante físico
- (b) Payload JSON Base64 dentro de la URL
- (c) Ambos equivalentes (hipótesis Pandora)
- (d) Solo (a) tiene validez legal — Pandora debe persistir también el binario PNG
- (e) Otra interpretación

Si la respuesta es (d), Pandora agrega ~2KB por factura para persistir la imagen. Si es (c), ahorramos espacio + simplificamos reimpresión.

#### A-22.b — Reimpresión histórica del QR

Cuando se reimprime un comprobante de hace 5 años:

¿Es legalmente válido si el QR se **regenera** del JSON persistido (siempre que el resultado sea idéntico bit-perfect)? ¿O AFIP exige que el QR impreso sea **literalmente la imagen originalmente entregada al cliente**?

Si exige la imagen original, ¿qué pasa cuando la impresora térmica original se cambia y el rendering varía levemente (ancho de líneas, contraste)?

#### A-22.c — Spec ARCA versión 2 — comprobantes históricos

Si ARCA publica versión 2 del QR (con campos adicionales) en 2028, ¿los comprobantes ya emitidos con versión 1 mantienen validez con su payload original?

Pandora persiste `qr_version` por factura. ¿Es suficiente con esta trazabilidad?

#### A-22.d — Plazo de entrega del comprobante con QR al receptor

Recordatorio: investigación oficial 2026-05-27 confirmó que el comprobante autorizado debe entregarse al cliente dentro de 10 días post-CAE.

¿El QR debe estar presente en TODAS las representaciones entregadas al cliente (PDF email + ticket impreso + WhatsApp + portal cliente)? ¿O alcanza con que esté en una?

Caso de uso: cliente recibe ticket impreso con QR + después pide PDF por email. ¿El PDF también debe llevar el QR o se acepta como "copia simplificada"?

#### A-22.e — QR en sub-tipos clase A (RG 5762/2025)

Para las dos nuevas modalidades A ("OPERACIÓN SUJETA A RETENCIÓN" / "PAGO EN CBU INFORMADA"):

¿El QR se incorpora igual que en factura A clásica? ¿Hay variantes en los campos del payload según sub-tipo?

---

### A-23. Estado real de obligatoriedad CondicionIVAReceptorId al 01/08/2026 (🔴 nueva — detectada en Auditoría Beta 2026-06-03)

**Contexto del hallazgo:** Auditoría Beta pre-fiscal detectó una **discrepancia entre fuentes** sobre el estado actual del campo `CondicionIVAReceptorId` en WSFEv1:

- **Manual ARCA COMPG v4.0** (publicado abril 2025): declara el campo como **OPCIONAL** + agrega validación no-exclusiva 10245 ("será obligatorio según RG 5616 cuando ARCA anuncie nueva fecha")
- **Cronograma RG 5616/2024 inicial**: obligatorio desde 15/04/2025, exclusivo desde 01/07/2025
- **Algunas fuentes secundarias 2026** (blogs de proveedores facturación): aseguran que ARCA postergó nuevamente la obligatoriedad sin nueva fecha anunciada
- **Otras fuentes 2026**: aseguran que ya es exigible desde 01/07/2025

**ADR-0023 + tax-policy-versions/ar-2026-06-v1.md de Pandora asumen obligatoriedad activa.** Si el estado real al 01/08/2026 fuera "opcional", el schema fiscal_snapshots Sprint 6 marcando `condicion_iva_receptor_id NOT NULL` puede ser excesivo y rompería en escenarios donde el comerciante no conoce el dato del receptor (caso típico CF cash con DocTipo=99).

#### A-23.a — Confirmación estado actual

¿Al 01/08/2026 (fecha vigente RG 5782/5785 post-RG 5852/2026) **es obligatorio o opcional** enviar `CondicionIVAReceptorId` en WSFEv1 FECAESolicitar?

#### A-23.b — Manejo de Consumidor Final sin DNI (DocTipo=99)

Para venta retail típica TDF (cliente CF cash sin documento, payment_method='efectivo', DocTipo=99 DocNro=0):

- ¿Existe un código `CondicionIVAReceptorId` que represente "CF sin identificación"?
- ¿O en este caso se omite el campo?
- Si es obligatorio + no se conoce → ¿default 'CF' (código 5 si existe)?

#### A-23.c — Validación cruzada con CUIT del receptor

Cuando el receptor sí está identificado (CUIT informado, DocTipo=80):

- ¿La consulta Padrón A5 retorna `CondicionIVAReceptor` o solo el régimen tributario?
- ¿Hay riesgo de divergencia entre lo declarado por Pandora y lo que ARCA tiene en sus registros (validación 10245)?

#### A-23.d — Impacto en TDF Ley 19.640

¿La condición IVA del receptor cambia algo para ventas amparadas TDF? Hipotéticamente: tenant en TDF amparado, receptor también amparado (otro comerciante TDF) → ¿código específico o no aplica?

---

### A-24. Manual WSFEv1 oficial actualizado a v4.2 — re-validación spec (🔴 nueva — detectada en Auditoría Beta 2026-06-03)

**Contexto del hallazgo:** El research oficial del 2026-06-02 (que cerró ADR-0023 + tax-policy-versions/ar-2026-06-v1.md) usó como fuente el manual COMPG **v3.4.2** (URL versionada `/WSFEV1/documentos/manual-desarrollador-COMPG-v3-4-2.pdf`).

La URL **canónica** de AFIP (`/ws/documentacion/manuales/manual-desarrollador-ARCA-COMPG.pdf`, sin versión) sirve actualmente la **v4.2**. Versiones intermedias publicadas en 2025-2026: v4.0 (abril 2025), v4.1, v4.2.

**Esto significa que el spec de ADR-0023 + tax-policy-versions/ar-2026-06-v1.md puede tener inconsistencias técnicas respecto al manual vigente al momento de Sprint 6.**

Pandora NO puede leer PDF directamente (no hay extractor disponible en el ambiente actual). Por eso te paso esta pregunta:

#### A-24.a — Spec del QR fiscal en v4.2

¿La estructura del payload QR (los 13 campos definidos en RG 4892/2020) **cambió** entre v3.4.2 y v4.2? Si cambió, ¿qué campos se agregaron / modificaron / eliminaron?

#### A-24.b — Validaciones nuevas en v4.2

El v4.1 trajo la modificación a validación 10119 (tipo de cambio < 400% de cotización ARCA). ¿v4.2 trae validaciones nuevas relevantes para Pandora F0 (retail TDF, sin moneda extranjera, sin notas de crédito todavía)?

#### A-24.c — Códigos de error nuevos

¿Hay códigos de error WSFEv1 nuevos en v4.2 que ameriten manejo específico en el handler de Pandora (más allá de los genéricos)?

#### A-24.d — Catálogos FEParam* (ADR-0025)

¿Los 12 métodos `FEParamGet*` siguen vigentes en v4.2 con la misma signature? ¿Algún catálogo runtime nuevo se agregó (que ADR-0025 deba contemplar)?

#### A-24.e — ImpOpEx (operaciones exentas TDF Ley 19.640)

El research v3.4.2 confirmó `ImpOpEx` como "Importe exento" del header. ¿v4.2 mantiene esa semántica o introduce cambios?

**Acción Pandora antes de Sprint 6:** instalar herramienta de extracción de PDF (poppler-utils o python pypdf) para validar v4.2 contra ar-2026-06-v1.md + ADR-0023. Si v4.2 difiere → bumpear a ar-2026-08-v1.md con fuente updated.

---

## Cierre Parte A — qué me llevo de la reunión con el contador

**🔴 Críticas (bloquean código):**

- [ ] **A-1** — Stage de redondeo (PER_LINE vs PER_BRACKET) + tratamiento contable diferencia centavos
- [ ] **A-2** — Modelo para venta cobrada sin CAE post-2h (Opción A constancia provisoria / B anulación / C otro) + leyenda obligatoria si A
- [ ] **A-3** — Captura de `legal_name` / `fiscal_address` aunque WSFEv1 no los exija (obligación civil/comercial)
- [ ] **A-4** — Política caché Padrón A5 (estricto vs permisivo) + estimación frecuencia real de cambios CUIT

**🟡 Importantes (antes primer cliente):**

- [ ] **A-5** — Cambio IVA del comerciante: hacia adelante sin reemisión (validación)
- [ ] **A-6** — NC sobre factura vieja con cambio condición IVA del cliente
- [ ] **A-7** — Manejo observed: entregar y NC vs bloquear y reemitir
- [ ] **A-8** — Cold storage Glacier para XMLs > 1 año (sí/no) + necesidad de hash/firma
- [ ] **A-9** — Confirmación interpretación CAE inmediato vs categoría que admita diferido

**🔴 TDF — A-10 (lo que falta tras confirmación oficial WSFEv1 + Ley 19.640):**

- [ ] **A-10.a** — Texto legal exacto en comprobante TDF amparado
- [ ] **A-10.b** — Rubros típicamente amparados (criterio práctico empírico)
- [ ] **A-10.c** — Default conservador ante duda (gravado vs exento)

**🔴 Ley 27.743 Transparencia Fiscal — A-11 (nueva — confirmado oficial 2025):**

- [ ] **A-11.a** — Texto literal exacto de leyenda + líneas IVA / otros impuestos
- [ ] **A-11.b** — Estructura visual (ubicación, tipografía, cuándo aparece)
- [ ] **A-11.c** — Aplicabilidad a Tipo C + comprobantes TDF amparados
- [ ] **A-11.d** — Sanción + período de gracia vigente

**🔴 RG 5003/2021 — A-18 (destapado por owner 2026-06-01, RI a Monotri = clase A + leyenda Ley 27.618):**

- [ ] **A-18.a** — Texto literal exacto de la leyenda RG 5003 + Ley 27.618 (vigente hoy)
- [ ] **A-18.b** — Aplicabilidad a ticket A vs factura A "tradicional"
- [ ] **A-18.c** — Coexistencia con Ley 27.743 Transparencia Fiscal (¿ambas leyendas?)
- [ ] **A-18.d** — Interacción con régimen Ley 19.640 TDF (LIS caso real)
- [ ] **A-18.e** — Sanción + validación Padrón A5 obligatoria por emisión

**🔴 RG 5762/2025 — A-19 (Chau M, dos sub-tipos A vigentes desde 1 dic 2025):**

- [ ] **A-19.a** — Texto literal exacto de cada leyenda (Op. Sujeta a Retención + Pago CBU Informada)
- [ ] **A-19.b** — Cómo Pandora detecta solvencia patrimonial del emisor
- [ ] **A-19.c** — Decisión del sub-tipo en cada emisión (automático vs manual)
- [ ] **A-19.d** — LIS: solvencia acreditada o no
- [ ] **A-19.e** — Coexistencia con 3 leyendas en mismo comprobante (RG 5762 + RG 5003 + Ley 27.743)

**🔴 RG 5782/2025 — A-20 (CAEA solo contingencia, vigencia 1 ago 2026, revisa A-2 + B-6):**

- [ ] **A-20.a** — Pool de CAEA pre-cargados — tamaño típico mensual y tope ARCA
- [ ] **A-20.b** — Cómo solicitar CAEA (portal web vs WebService)
- [ ] **A-20.c** — Cómo reportar uso post-contingencia a ARCA
- [ ] **A-20.d** — Qué pasa si se agota pool de CAEA en contingencia prolongada
- [ ] **A-20.e** — LIS adhesión actual a CAEA (probable que no)
- [ ] **A-20.f** — Pandora F0 alcance: lanzar con CAEA o defer F0.5

**🟡 RG 5824/2026 — A-21 (Vinculación PV ↔ actividad económica, opcional desde 1 jul 2026):**

- [ ] **A-21.a** — Beneficio fiscal de declararlo desde día 1
- [ ] **A-21.b** — LIS multi-actividad (una o varias)
- [ ] **A-21.c** — Código Nomenclador AFIP "venta minorista telas/mercería"

**🔴 QR fiscal RG 4892/2020 — A-22 (NUEVA — introducida en ADR-0023, 2026-06-02):**

- [ ] **A-22.a** — Equivalencia legal imagen PNG vs payload JSON Base64 (o solo (a) válida) — **técnicamente equivalentes** (manual oficial QR confirma imagen es derivable del JSON+URL); falta confirmación LEGAL contadora
- [ ] **A-22.b** — Reimpresión histórica del QR — regeneración determinística vs imagen original — **técnicamente OK** (ADR-0023 persiste qr_payload_json completo); falta confirmación LEGAL
- [ ] **A-22.c** — Validez de comprobantes con QR v1 si ARCA publica v2 — **técnicamente OK** (qr_version+qr_url_base_at_emission permiten autosuficiencia); falta confirmación LEGAL
- [ ] **A-22.d** — QR en TODAS las representaciones del comprobante (PDF email + impreso + WhatsApp + portal)
- [ ] **A-22.e** — QR en sub-tipos clase A nuevos (RG 5762/2025)

**🔴 A-23 — CondicionIVAReceptorId estado real (Auditoría Beta 2026-06-03):**

- [ ] **A-23.a** — Confirmar si al 01/08/2026 es obligatorio u opcional enviar el campo
- [ ] **A-23.b** — Manejo CF cash sin DocTipo: código por defecto o omitir campo
- [ ] **A-23.c** — Validación cruzada con CUIT del receptor (Padrón A5)
- [ ] **A-23.d** — Impacto TDF Ley 19.640 (receptor también amparado)

**🔴 A-24 — Manual WSFEv1 v4.2 vs research v3.4.2 (Auditoría Beta 2026-06-03):**

- [x] **A-24.a** — ✅ QR vive en RG 4892/2020 manual aparte, NO en COMPG (resuelto empíricamente)
- [x] **A-24.b** — ✅ Validaciones nuevas v4.2: solo módulo alertas/monitoreo (CAE 10247-10249 + CAEA 827-829), no afectan path Pandora F0 (resuelto empíricamente)
- [ ] **A-24.c** — Códigos error nuevos completos: contadora confirma cuáles requieren handler específico Pandora (ver `ar-2026-06-v2.md` para listado)
- [x] **A-24.d** — ✅ FEParam* vigentes; nuevo método `FEParamGetCondicionIvaReceptor` v4.0 confirma ADR-0025 (resuelto empíricamente)
- [x] **A-24.e** — ✅ ImpOpEx semántica idéntica para Tipo A/B/E; **NUEVO**: Tipo C debe ser = 0 → genera A-25

**🔴 A-25 — Tipo C + ImpOpEx + TDF Ley 19.640 (Auditoría Beta 2026-06-03):**

- [ ] **A-25.a** — ¿Monotributistas TDF pueden ampararse Ley 19.640?
- [ ] **A-25.b** — Si SÍ: ¿mecanismo correcto si no es ImpOpEx en Tipo C?
- [ ] **A-25.c** — Si NO: ¿hay caso real cliente piloto Pandora monotributista TDF amparado?
- [ ] **A-25.d** — Scope Pandora F0: ¿solo RI TDF + diferir monotributistas TDF amparados a F1+?

> **✅ Auditoría Beta empírica (2026-06-03 PM)**: pdf-parse@2.4.5 instalado en proyecto Pandora. Manual COMPG v4.2 (1 de Mayo de 2026, 197 páginas) extraído + analizado. `tax-policy-versions/ar-2026-06-v2.md` creado reemplazando v1. **3 sub-preguntas A-24 resueltas sin contadora.** **A-25 nueva detectada** (Tipo C + ImpOpEx restrictivo).

> **✅ ESTADO POST-EXTRACCIÓN (2026-06-03 PM):** pdf-parse@2.4.5 instalado como devDependency de Pandora. Manual v4.2 extraído verificadamente. Hallazgos persistidos en `tax-policy-versions/ar-2026-06-v2.md` (reemplaza v1). Algunas sub-preguntas A-24 ya resueltas empíricamente sin contadora — ver tabla en ar-2026-06-v2.md §"Lo que cambia respecto a ar-2026-06-v1".

---

### A-25. Tipo C + ImpOpEx + TDF Ley 19.640 (🔴 nueva — hallazgo empírico Manual v4.2)

**Contexto del hallazgo:** la extracción del Manual COMPG v4.2 del 2026-06-03 reveló:

> **"ImpOpEx... Importe exento... Para comprobantes tipo C debe ser igual a cero (0)."** *(Manual v4.2, sección descripción de campos FECAESolicitar)*

**Implicación crítica para retail TDF:**

Un comerciante **Monotributista TDF** (que emite **tipo C** por default) NO puede usar `ImpOpEx > 0` para amparar productos bajo Ley 19.640. El campo debe ser cero.

Esto significa que el flujo:
```
Monotributista TDF + Producto amparado Ley 19.640 → ¿cómo se factura?
```
NO tiene respuesta obvia en el manual oficial WSFEv1.

#### A-25.a — Régimen fiscal de Monotributistas en TDF

¿Los comerciantes **monotributistas** ubicados en TDF pueden ampararse bajo Ley 19.640? ¿O el régimen Ley 19.640 está reservado para **Responsables Inscriptos**?

#### A-25.b — Si Monotributista TDF SÍ puede usar régimen Ley 19.640

¿Cuál es el mecanismo correcto si NO es `ImpOpEx > 0` en tipo C?
- ¿Usar tipo B + transformarse a RI temporalmente?
- ¿Usar tipo C con marca específica en `Opcionales` array?
- ¿Algún otro código de comprobante?

#### A-25.c — Si Monotributista TDF NO puede usar régimen Ley 19.640

Esto significaría que el comerciante factura al precio bruto (con IVA aunque sea cero porcentaje en su régimen).

¿Hay caso real de cliente piloto Pandora que sea **monotributista TDF con productos amparados**? Si sí, hay que cerrar este flujo antes de Sprint 6.

#### A-25.d — Pandora F0 alcance — Solo Responsable Inscripto TDF?

¿Es viable que **Pandora F0 NO soporte monotributistas TDF amparados Ley 19.640** y se enfoque solo en Responsables Inscriptos TDF? El caso confirmado (papá rotisería + LIS sedería) es RI; los kioscos pueden ser monotributistas.

#### A-25.e — Hipótesis técnica del research 2026-06-11 (confirmar o refutar)

> 💡 **Hipótesis del research previo:** la tensión "Monotributista TDF no puede usar ImpOpEx > 0 en Tipo C" puede ser **aparente, no real**, por el siguiente razonamiento:
>
> 1. Ley 19.640 exime del pago de IVA por operaciones en TDF
> 2. **Un Monotributista ya está exento de IVA por su propio régimen** (Monotributo) — no cobra IVA en ninguna operación, estén donde estén
> 3. Para el Tipo C la exención de IVA es "automática" por el régimen, no por Ley 19.640
> 4. **Solo un RI TDF necesita declarar ImpOpEx** porque solo él cobraría IVA si no fuese por la Ley 19.640
>
> **Consecuencia operativa**: un Monotributista TDF amparado puede simplemente **agregar la leyenda "Operación amparada por Ley 19.640"** como texto libre en el comprobante (campo descripción o pie), sin tocar ImpOpEx. La exención ya está implícita en el Tipo C.

**Confirmación necesaria del contador:**

- ¿Esta hipótesis es **correcta fiscalmente**? ☐ Sí ☐ No → corregir cómo: __________
- Si es correcta: ¿hay leyenda canónica para esa marca en Tipo C, o es texto libre? __________
- ¿Tenés algún caso real de Monotributista TDF amparado que hayas asesorado? ¿Cómo lo resolviste? __________

> **Si la hipótesis sobrevive a la reunión**: A-25.d (excluir Monotri TDF de F0) deja de ser obligatorio. Pandora F0 puede soportar Monotri TDF con solo agregar leyenda + sin tocar ImpOpEx. A-10 queda reformulada: ImpOpEx solo para RI TDF, leyenda libre para Monotri TDF.

> **Acción Pandora:** este hallazgo redirige A-10 (TDF Ley 19.640) — esa pregunta original asumía "todos los comerciantes TDF pueden ampararse vía ImpOpEx". El manual oficial v4.2 desmiente esta asunción para Monotributistas. **A-10 debe re-formularse a luz de A-25.**

**⚪ Si queda tiempo (A-12 a A-17):**

- [ ] Motivos en destructivas · errores típicos · inconsistencias inspecciones · fallback empírico · reportes imprescindibles · patrones provinciales

**Cierre operativo:**

- [ ] Honorarios para validar trimestralmente cuando haya clientes reales: ARS __________ / mes
- [ ] Datos de contacto del contador para consultas puntuales: __________________

**Nota para el contador:** este documento está pensado para definiciones operativas, no para auditoría completa. Cuando Pandora tenga primer cliente real pagando facturas, se contratará revisión profunda (estimada USD 1.500-5.000 según alcance). Esta reunión es para destrabar arquitectura previa al primer commit productivo.

---

# PARTE B — REUNIÓN ABOGADO

**Duración estimada:** ~1-1.5 horas
**Honorarios estimados:** USD 100-300 / ARS 80k-300k
**Output esperado:** definiciones cerradas en los 5 puntos críticos legales + lineamiento T&C / DPA / política privacidad

**Perfil ideal del abogado:** especializado en SaaS B2B argentino, conocimiento práctico Ley 25.326 (Protección Datos Personales) + Disposición AAIP 47/2018 (seguridad datos) + Ley 11.683 (procedimiento tributario). Bonus: experiencia con startups y T&C SaaS.

---

## Contexto adicional para el abogado (5 minutos)

- **Modelo:** SaaS multi-tenant. Pandora opera como **encargado de tratamiento** de datos personales (Art. 25 Ley 25.326) — el responsable legal sigue siendo cada comerciante cliente.
- **Datos sensibles que toca el sistema:** datos identificatorios de comerciantes (CUIT, razón social, domicilio fiscal), datos transaccionales (ventas, facturas, productos), datos de clientes finales (cuando el comerciante factura A o B con identificación), datos de empleados del comerciante (turnos, accesos).
- **Riesgos identificados arquitectónicamente:**
  - Error fiscal automatizado (cálculo IVA, redondeo, numeración) → multa AFIP al comerciante
  - Fuga cross-tenant (un comerciante ve datos de otro) → violación deber confidencialidad
  - Breach de seguridad (acceso no autorizado a la DB Supabase) → datos personales expuestos
  - Pérdida de comprobantes XML AFIP → incumplimiento conservación Ley 11.683 (10 años)
  - Caída prolongada → pérdida comercial del cliente
- **Mitigaciones técnicas ya implementadas (no requieren validación legal, son contexto):**
  - RLS Postgres con JWT-scoped tenant_id
  - Audit log append-only inmutable con trigger en transacción
  - Customer snapshot inmutable post-emisión
  - Cifrado AES-256-GCM at-rest para secretos sensibles
  - HMAC signing en webhooks + replay protection
  - Versionado de encryption keys para rotation
  - Fail-closed fiscal (si integridad incierta → NO emitir)

---

## 🔴 PREGUNTAS CRÍTICAS (bloquean código o lanzamiento)

### B-1. Responsabilidad civil ante error fiscal automatizado (item B1.1)

**Escenario:** Pandora calcula mal el IVA por bug propio (ej: stage de redondeo incorrecto, cambio normativo no incorporado, bug del Fiscal Projection Layer). El comerciante emite 200 facturas con IVA mal calculado. AFIP detecta y multa al comerciante.

- ¿La responsabilidad civil recae sobre el comerciante (responsable inscripto ante AFIP) o sobre Pandora (proveedor del software que ejecutó el cálculo)?
  
  Respuesta: ____________________________________________________________

- ¿Una cláusula de "best effort" + "limitación de responsabilidad" en T&C es suficiente para acotar la exposición de Pandora, o hay límites legales en AR?
  
  Respuesta: ____________________________________________________________

- ¿Es recomendable / obligatorio contratar **seguro de Responsabilidad Civil Profesional** (RC tech) antes del primer cliente productivo? ¿Costo estimado y aseguradoras que operen el ramo en AR?
  
  Respuesta: ____________________________________________________________

- ¿Conviene constituir SRL desde día 1 o el monotributo cubre el riesgo de los primeros 5 clientes?
  
  Respuesta: ____________________________________________________________

### B-2. Inscripción AAIP — cómo declarar SaaS multi-tenant + cronograma + riesgo del piloto

> ⚠️ YA CERRADO POR FUENTE OFICIAL: las bases privadas destinadas a dar informes deben inscribirse en el Registro Nacional de Bases de Datos Personales (Ley 25.326 + AAIP). Trámite vía TAD con clave fiscal nivel 2+. Incumplimiento = sanciones. NO hace falta preguntar "¿es obligatorio?" — es obligatorio.

**Lo que falta cerrar contigo:**

- ¿Cómo se declara una arquitectura SaaS multi-tenant ante AAIP? Opciones que vi en el portal:
  - ☐ Una sola base "ERP SaaS" con categorías mixtas (clientes + empleados + transacciones)
  - ☐ Bases separadas por categoría (clientes del comerciante, empleados del comerciante, datos transaccionales, etc.)
  - ☐ Una base por cada tenant comerciante (no escala — descartar si confirmás)
  - ☐ Otro: __________
  
  Recomendación tuya basada en cómo declaraste SaaS antes: __________________________

- **Cronograma realista** desde "decisión de operar" hasta "inscripción completa": __________ (plazo administrativo AAIP típico, idas y vueltas que hayas visto)

- **Riesgo concreto** de operar 1-5 clientes piloto SIN estar inscripto todavía:
  - Multa monetaria estimada: __________
  - Otra exposición (clausura, denuncia, civil ante titular): __________
  - ¿Recomendás esperar inscripción para abrir piloto, o hacer piloto en paralelo? __________

- Costo total estimado del proceso (honorarios + tasas oficiales): ARS __________

- ¿Hay obligación adicional por ser SaaS B2B que procesa datos de **clientes finales del comerciante** (no sólo del comerciante)? __________

### B-3. Notificación obligatoria a AAIP ante breach — plazo y formato (item B4.4 + ADR-0019 S11)

> ⚠️ Contexto investigación oficial: AAIP evalúa si la organización tiene **protocolo de incidentes, notificación a autoridad y/o titulares, y documentación de incidentes**. Pero NO encontré un "72h" oficial argentino tipo GDPR. Esto sigue siendo genuinamente abierto y necesita tu lectura.

**Contexto interno:** la arquitectura tiene un **runbook de respuesta a incidentes** (`security-incident.md`) parcialmente diseñado. Falta el plazo legal exacto y el formato exigido para notificar incidentes de seguridad que comprometan datos personales.

- ¿Existe **plazo legal específico** en Argentina para notificar a AAIP un breach de datos personales? (en GDPR son 72h; ¿AAIP exige lo mismo? ¿menos? ¿no hay plazo definido?)
  
  Respuesta: ____________________________________________________________

- ¿La notificación debe hacerse vía formulario AAIP específico, oficio, mail, otro? Si hay template oficial, ¿podés compartirlo?
  
  Respuesta: ____________________________________________________________

- ¿Qué califica como "breach reportable"? Por ejemplo:
  - Acceso no autorizado por usuario interno con permisos válidos pero excedido en scope → ☐ reportable ☐ no
  - SQL leak de N filas detectado por DBA en logs → ☐ reportable ☐ no
  - Phishing exitoso contra un usuario que expuso credenciales → ☐ reportable ☐ no
  - Bug que muestra datos de tenant A al tenant B (cross-tenant leak) → ☐ reportable ☐ no
  - Pérdida temporal de disponibilidad sin exposición de datos (DDoS, outage) → ☐ reportable ☐ no
  
  Criterio general: __________________________________________________

- ¿También hay obligación de notificar al **titular del dato** (cliente final, comerciante)? ¿En qué casos y con qué plazo?
  
  Respuesta: ____________________________________________________________

### B-4. Fuga cross-tenant — responsabilidades y obligaciones (item B4.1)

**Escenario:** un bug en RLS o un permiso mal configurado permite que el comerciante X vea ventas / clientes / productos del comerciante Y durante 2 horas antes de detectarse.

- ¿Quién responde legalmente ante el comerciante Y?
  - ☐ Pandora directamente (incumplió deber confidencialidad como encargado de tratamiento)
  - ☐ El comerciante X (recibió datos sin derecho, debe destruirlos)
  - ☐ Responsabilidad solidaria entre ambos
  
  Justificación legal: __________________________________________________

- ¿Es obligatorio notificar al **comerciante afectado**? ¿En qué plazo? ¿Por escrito? ¿Hay obligación de indemnizar?
  
  Respuesta: ____________________________________________________________

- ¿La obligación de notificar a AAIP (B-3) se activa aunque el "fugado" sea otro encargado/usuario del mismo servicio, no un tercero externo?
  
  Respuesta: ____________________________________________________________

- ¿Cómo se documenta legalmente que el comerciante X **no usó / borró / destruyó** los datos vistos? ¿Bastan los logs de Pandora + carta documento al comerciante X?
  
  Respuesta: ____________________________________________________________

### B-5. Conservación legal de documentos NO fiscales (lo fiscal ya está cerrado)

> ⚠️ YA CERRADO POR FUENTE OFICIAL: comprobantes/documentos fiscales = 10 años (Ley 11.683 + Decreto 1397/79 + régimen comprobantes electrónicos originales). XML original AFIP + hash es la estrategia defendible — PDF solo NO.
>
> Lo que NO encontré en fuentes oficiales: plazo legal único para logs aplicación, backups, T&C, política de privacidad. Eso necesita tu lectura profesional.

| Tipo de documento NO fiscal | Plazo conservación recomendado | Formato exigido | Eliminable después | Notas |
|---|---|---|---|---|
| Audit log de operaciones fiscales (eventos AFIP, numeración, snapshots) | _________ años | ☐ append-only ☐ firma digital ☐ otro | ☐ Sí ☐ No | ¿se equipara a "documento fiscal" por contener decisión fiscal, o es separable? |
| Audit log de operaciones NO fiscales (login, permisos, cambios config) | _________ años | _________ | ☐ Sí ☐ No | ¿hay obligación legal o sólo defensa civil? |
| Customer snapshot al momento de venta (datos del cliente final) | _________ años | _________ | ☐ Sí ☐ No | ¿se equipara a comprobante fiscal por estar adentro de la factura? |
| Logs aplicación (Pino con request_id, correlation_id, sin PII según pii_level) | _________ días/meses | _________ | ☐ Sí ☐ No | _____________ |
| Logs aplicación con PII (CUIT, email, IP) | _________ días/meses | ☐ anonimizar al cerrar período | ☐ Sí ☐ No | choca con derecho ARCO — ¿plazo máximo legal? |
| Backups de la DB completa | _________ tiempo | _________ | ☐ Sí ☐ No | ¿hay límite máximo para no chocar con ARCO? |
| Términos y condiciones aceptados por usuario (versión + timestamp) | _________ años | _________ | ☐ Sí ☐ No | ¿obligación o defensa civil? |
| Política de privacidad aceptada por usuario | _________ años | _________ | ☐ Sí ☐ No | _____________ |
| Otro: _______________ | _________ | _________ | ☐ Sí ☐ No | _____________ |

### B-6. Validez legal de venta cobrada sin CAE post-2h (complementa A-2 contador)

> ⚠️ YA CERRADO: el "ticket no fiscal" en sentido técnico AFIP pertenece al régimen de controladores fiscales y NO es fallback de WSFEv1. Plus: comprobante autorizado debe ponerse a disposición dentro de 10 días de asignado el CAE.
>
> Pregunta puramente legal — ya sabemos que NO es comprobante fiscal válido. Falta el ángulo civil/comercial.

**Escenario:** AFIP no responde tras 2h. La venta queda cobrada, mercadería entregada, sin CAE. Pandora emitirá factura electrónica dentro de 10 días cuando AFIP vuelva.

- En el período intermedio (entre venta cobrada y emisión post-CAE), si el cliente reclama por garantía / cambio / defensa al consumidor, ¿qué documento le sirve para acreditar la operación?
  - ☐ Una "constancia provisoria" con leyenda específica + número interno trazable
  - ☐ El extracto bancario del pago + DNI del cliente
  - ☐ Nada — la operación no tiene respaldo civil hasta CAE
  - ☐ Otro: __________

- ¿La responsabilidad civil por NO entregar factura en el acto es del comerciante (que cobró) o de Pandora (que falló en WS)?
  
  Respuesta: ____________________________________________________________

- ¿Existe jurisprudencia o disposición que regule expresamente "POS cobra sin emitir comprobante fiscal por falla del WS AFIP"?
  
  Respuesta: ____________________________________________________________

---

## 🟡 PREGUNTAS IMPORTANTES (antes del primer cliente real productivo)

### B-7. Términos y Condiciones / EULA — cláusulas mínimas obligatorias

Lista mínima propuesta para T&C de Pandora (validar / completar):

| Cláusula | ¿Imprescindible? | Wording sugerido / notas |
|---|---|---|
| Best effort sobre disponibilidad AFIP (Pandora no garantiza que AFIP no falle) | ☐ Sí ☐ No | _________ |
| Limitación responsabilidad por errores fiscales (cap monetario y/o cap a N meses de facturación SaaS) | ☐ Sí ☐ No | _________ |
| Limitación responsabilidad por caídas de terceros (Supabase, Vercel, AFIP, MercadoPago) | ☐ Sí ☐ No | _________ |
| Limitación responsabilidad sobre datos del usuario que el comerciante carga (catálogos, clientes) | ☐ Sí ☐ No | _________ |
| Jurisdicción competente (Río Grande / Ushuaia / CABA / otra) | ☐ Sí ☐ No | _________ |
| Consentimiento operacional (qué operaciones se ejecutan automáticamente sin confirmación explícita) | ☐ Sí ☐ No | _________ |
| Cancelación de suscripción y plazo conservación / exportación de datos post-cancelación | ☐ Sí ☐ No | _________ |
| Modificación unilateral T&C por parte de Pandora — plazo notificación al cliente | ☐ Sí ☐ No | _________ |
| Cláusula arbitraje obligatorio antes de juicio | ☐ Sí ☐ No | _________ |

- ¿T&C B2B (Pandora ↔ comerciante) y T&C B2C (comerciante ↔ cliente final del comerciante vía POS) son documentos separados o uno solo? ¿Pandora debe proveer template del segundo?
  
  Respuesta: ____________________________________________________________

### B-8. Política de Privacidad y Data Processing Agreement (DPA)

- ¿Pandora necesita publicar Política de Privacidad pública desde día 1 (web pública) o solo dentro del producto?
  - ☐ Pública ☐ Solo dentro producto ☐ Ambas

- ¿Es necesario firmar **DPA explícito** con cada comerciante (Pandora como encargado de tratamiento) o alcanza con la cláusula correspondiente embebida en T&C?
  - ☐ DPA separado obligatorio ☐ T&C alcanza ☐ DPA solo si el cliente lo pide

- ¿Existe template oficial AAIP de DPA o se redacta libre?
  
  Respuesta: ____________________________________________________________

### B-9. Logs y PII — mapping legal de `pii_level` operacional contra Ley 25.326

> ⚠️ CONFIRMADO POR FUENTE OFICIAL: Ley 25.326 define "datos personales" de forma **amplia** para personas físicas (Art. 2), y "datos sensibles" tienen tratamiento especial (Art. 7). El detalle fino — qué exactamente cae en cada categoría según el contexto de procesamiento — sigue requiriendo tu criterio.

**Contexto técnico:** Pandora clasifica datos en `pii_level` operacional (`public / internal / pii_low / pii_high / secret`) para decidir retention y acceso (definido en ADR-0019 S8). Necesitamos validar el mapping con vos.

- ¿Cuáles de estos datos califican como "datos personales" Ley 25.326 en el contexto de Pandora?
  - CUIT del comerciante (persona física): ☐ dato personal ☐ no ☐ sólo si vincula a persona física
  - CUIT del comerciante (persona jurídica / SRL / SA): ☐ dato personal ☐ no
  - Razón social del comerciante (persona física): ☐ dato personal ☐ no
  - IP del usuario logueado: ☐ dato personal ☐ no
  - Email del usuario interno del comerciante: ☐ dato personal ☐ no
  - Domicilio fiscal del cliente final identificado en factura: ☐ dato personal ☐ no
  - Lista de productos comprados por cliente final identificado (perfilamiento posible): ☐ dato personal ☐ no

- ¿Algún dato que Pandora maneja califica como **"dato sensible"** (Art. 7 Ley 25.326 — origen racial, opiniones políticas, salud, vida sexual)?
  
  Respuesta: ____________________________________________________________

- Plazo máximo legal de retención sin anonimizar para logs con CUIT / email / IP:
  - CUIT en logs: __________
  - IP del usuario: __________
  - Email del usuario: __________

- ¿Anonimización obligatoria pasado X tiempo o sólo recomendación? __________

### B-10. Derechos ARCO del titular del dato (Acceso / Rectificación / Cancelación / Oposición)

**Escenario:** un cliente final de un comerciante (ej: comprador de un kiosco que dio CUIT para factura A) ejerce derecho de acceso / borrado contra Pandora.

- ¿La petición debe dirigirse a Pandora (encargado) o al comerciante (responsable)? ¿Cuál es el flujo formal?
  
  Respuesta: ____________________________________________________________

- ¿Plazo legal de respuesta a un pedido ARCO?
  
  Respuesta: ____________________________________________________________

- ¿El derecho a "olvido" choca con la obligación de conservación fiscal 10 años (Ley 11.683)? ¿Cómo se resuelve el conflicto en la práctica?
  - ☐ Prevalece conservación fiscal (rechazo del olvido con fundamento)
  - ☐ Prevalece derecho ARCO (borrado parcial, mantener mínimo fiscal)
  - ☐ Otro: __________________

---

## ⚪ SI QUEDA TIEMPO — Conocimiento empírico legal

11. **¿Qué errores legales típicos ves en startups SaaS argentinas en sus primeros 12 meses?**
    _______________________________________________________________

12. **¿Hay precedente jurisprudencial relevante sobre responsabilidad de proveedores SaaS por errores en cálculo fiscal automatizado en AR?**
    _______________________________________________________________

13. **¿Conviene constituir la SRL en CABA, Tierra del Fuego (régimen promocional), u otra jurisdicción? ¿Trade-offs?**
    _______________________________________________________________

14. **¿Hay obligaciones legales específicas por operar desde / hacia Tierra del Fuego (Ley 19.640) más allá de lo fiscal AFIP?**
    _______________________________________________________________

15. **¿Honorarios para retainer mensual (consultas puntuales + revisión documental cuando crezca la operación)?** ARS __________ / mes

---

## Cierre Parte B — qué me llevo de la reunión con el abogado

**🔴 Críticas (bloquean código o lanzamiento):**

- [ ] **B-1** — Responsabilidad civil error fiscal automatizado: límite legal + necesidad RC profesional + SRL vs monotributo
- [ ] **B-2** — Cómo declarar SaaS multi-tenant ante AAIP + cronograma + riesgo de piloto sin inscribir
- [ ] **B-3** — Plazo legal notificación breach AAIP + criterio "qué califica" + formato (sigue genuinamente abierto)
- [ ] **B-4** — Responsabilidades + obligaciones notificación ante fuga cross-tenant
- [ ] **B-5** — Tabla de conservación legal de docs NO fiscales (audit log, logs PII, backups, T&C, política)
- [ ] **B-6** — Ángulo civil/comercial de venta cobrada sin CAE post-2h (complementa A-2)

**🟡 Importantes (antes primer cliente):**

- [ ] **B-7** — Cláusulas T&C mínimas (best effort AFIP, limitación responsabilidad, jurisdicción TDF/CABA, etc.) + B2B vs B2C separados
- [ ] **B-8** — Política Privacidad pública vs solo producto + DPA separado vs embebido
- [ ] **B-9** — Mapping legal `pii_level` operacional vs Ley 25.326 (qué califica como personal/sensible en contexto Pandora) + plazos retención logs
- [ ] **B-10** — Flujo formal ARCO + resolución conflicto ARCO vs conservación fiscal 10 años

**⚪ Si queda tiempo (B-11 a B-14):**

- [ ] Errores legales típicos · jurisprudencia SaaS AR · SRL en TDF vs CABA · obligaciones legales TDF más allá de fiscal

**Cierre operativo:**

- [ ] Honorarios retainer mensual cuando haya 5+ clientes: ARS __________ / mes
- [ ] Datos de contacto del abogado para consultas puntuales: __________________

**Nota para el abogado:** este documento está pensado para destrabar arquitectura previa al primer commit productivo y para definir T&C / DPA / Política de Privacidad antes del primer cliente real. NO es una auditoría de cumplimiento integral. Cuando Pandora tenga 10+ clientes pagando, se contratará revisión profunda (estimada USD 1.500-5.000 según alcance).

---

# Resumen ejecutivo combinado

Tras ambas reuniones, los siguientes ADRs / docs se actualizan. El bloque "Decisiones cerradas oficialmente" del header **ya está aplicado en código pendiente** — no requiere reunión.

> **Bloqueo de sprints según ROADMAP.md:**
> - **Sprint 6 (Fiscal core, 3 semanas)** GATED por: A-1 + A-2 + A-4 + A-10 + A-11
> - **Sprint 7 (Reconciliation Engine, 2 semanas)** GATED por: A-2 + B-6
> - **Sprint 10 (Pilot Launch)** GATED por: B-2 (inscripción AAIP) + B-7 (T&C) + B-8 (Privacy Policy)
>
> Sin estas respuestas no se puede escribir código fiscal productivo. Sprints 0-5 (Setup + Platform + Identity + Inventory + Cash + Sales+MP) NO requieren respuestas y pueden ejecutarse en paralelo a las reuniones.

| Pregunta | Status previo | Tras reunión actualiza |
|---|---|---|
| A-1 stage redondeo + conciliación | 🟡 abierto | ADR-0005 Dimensión 2 CERRADA + tratamiento contable conciliación |
| A-2 + B-6 venta sin CAE post-2h | 🔴 NUEVO: ya sabemos que "ticket no fiscal" NO es válido | **Refactor mayor de ADR-0004** + ADR-0022 sección fail-closed extendida + nuevo modelo "constancia provisoria" si abogado lo valida |
| A-3 customer_snapshot legal_name/fiscal_address | 🟡 abierto | Schema decision: capturar default vs opcional + actualizar Sesión 5 v4 cambio #3 |
| A-4 política caché Padrón A5 | 🟡 abierto | ADR nuevo o sección en ADR-0022 (estricto vs permisivo) |
| A-5 cambio condición IVA tenant | 🟢 mostly cerrado por hipótesis razonable | Confirmación informal o ADR si refuta |
| A-7 manejo observed | 🟡 abierto | Runbook `afip-observed-handling.md` |
| A-8 cold storage Glacier para XMLs | 🟡 abierto | ADR-0019 S14 (backup security) extendido con política Glacier |
| A-10 TDF (sólo texto + rubros + default) | 🟡 abierto | ADR-0022 sección "Texto legal TDF" + tabla productos amparados (referencia, no canónica) |
| **A-11 Régimen Transparencia Fiscal Ley 27.743** | 🔴 NUEVO crítico | **ADR-0022 nueva sección obligatoria + Pencil mockup de ticket actualizado** |
| B-1 responsabilidad civil + RC + SRL | 🔴 abierto | Decisión SRL vs monotributo + cotizar RC profesional + cláusulas T&C |
| B-2 AAIP declaración + cronograma + riesgo piloto | 🟢 obligación confirmada / 🟡 cómo declarar abierto | Plan de inscripción + decisión: piloto en paralelo o esperar |
| B-3 breach notification plazo + formato | 🔴 genuinamente abierto | ADR-0019 S11 cerrado + runbook `security-incident.md` completo |
| B-4 fuga cross-tenant responsabilidades | 🔴 abierto | Runbook `cross-tenant-leak.md` + cláusulas T&C |
| B-5 conservación NO fiscal | 🟡 abierto | Tabla retention canónica en ADR-0019 S8 + Rule 04-observability |
| B-7 cláusulas T&C | 🔴 abierto | Nuevo doc `terminos-y-condiciones-v1.md` |
| B-8 DPA + Privacy Policy | 🔴 abierto | Nuevo doc `politica-de-privacidad-v1.md` + DPA template si aplica |
| B-9 mapping legal PII | 🟡 abierto | ADR-0019 S8 con tabla pii_level → categoría legal Ley 25.326 |
| B-10 ARCO vs conservación fiscal | 🟡 abierto | Runbook `arco-request.md` (cuando aparezca primer caso) |
