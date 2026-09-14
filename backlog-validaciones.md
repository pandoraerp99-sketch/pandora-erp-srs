# Backlog de validaciones — items diferidos de Sesión 5 v4

**Fecha de extracción:** 2026-05-26
**Última actualización:** 2026-05-28 (auditoría Lote 5 — alineación con advisor doc reformulado + reflejar investigación oficial 2026-05-27)
**Fuente:** Apéndice "Validaciones Humanas Pendientes Ampliadas" de Sesión 5 v4
**Estado:** items NO bloqueantes para F0 — se atacan iterativamente

> **Cross-references importantes:**
> - [reunion-contador-y-abogado.md](reunion-contador-y-abogado.md) — guion advisor reformulado (Parte A contador A-1..A-17 + Parte B abogado B-1..B-14)
> - [ROADMAP.md](ROADMAP.md) — Sprint 6 (Fiscal core) y Sprint 7 (Reconciliation) GATED por items críticos abajo
> - [DECISION-LEDGER.md](DECISION-LEDGER.md) — autoridad
>
> **⚠️ Numeración:** este backlog usa notación Sesión 5 v4 original (A1.1, A2.10, B2.7, etc.). El advisor doc reformuló las preguntas críticas como A-1..A-17 + B-1..B-14. Cuando un item del backlog tiene mapping al advisor, lo indica.

---

## Cómo usar este documento

Sesión 5 v4 tenía **110 items** organizados como 4 BloqueanteCode + 38 BloqueanteProd + 62 Importantes + 6 Nice-to-have.

**Análisis crítico (auditoría 2026-05-26):** la mayoría de los "Importantes" y muchos "BloqueanteProd" no son realmente bloqueantes para los primeros 5 clientes. Se difieren acá con criterio explícito de cuándo validarlos.

**Lo que SÍ entra a F0** (queda en Sesión 5 v4):
- **4 BloqueanteCode** — validar antes de tipear código relacionado
- **10 BloqueanteProd reducido** — validar antes del primer cliente real facturando

**Lo que va a este backlog** (resto):
- 28 BloqueanteProd que pueden esperar al cliente 6+
- 35 Importantes (filtrados de 62 originales — algunos ya cubiertos por ADRs)
- 6 Nice-to-have

Total backlog: **79 items diferidos** (ver tabla resumen ejecutivo más abajo). 41 activos F0 quedan en Sesión 5 v4. Total Sesión 5 v4 original: 110 items + 3 agregados de campo (D.4, ver nota de reconciliación en el resumen).

---

## Criterio de promoción (de backlog → activo)

Un item sale del backlog cuando:

1. **Trigger objetivo aparece:** un cliente real pidió, una métrica cruzó un umbral, un cambio normativo lo gatilla.
2. **Tiempo en backlog > 12 meses:** revisar si sigue siendo relevante. Quitar si no.
3. **Bug en producción lo hace bloqueante:** se promueve a fix inmediato.

---

## Items diferidos por sección

### Sección A — Contador (33 items diferidos, 15 quedan en Sesión 5 v4)

#### A.1 Responsabilidad profesional (3 items diferidos)

| ID | Item | Trigger para promover |
|---|---|---|
| A1.5 | Disclaimers fiscales exactos en UI/reportes | Primer reporte mensual generado por sistema |
| A1.6 | Eventos que requieren aceptación explícita usuario | Primer evento donde el usuario disputa la operación |

(A1.1, A1.2, A1.3, A1.4 quedan en Sesión 5 v4 como **BloqueanteCode**.)

#### A.2 Facturación electrónica (8 items diferidos)

| ID | Item | Trigger |
|---|---|---|
| A2.5 | Fallback real de comercios cuando AFIP cae | Validar empíricamente con 3+ comercios piloto en F0 |
| A2.6 | Contingencia offline en comercios reales | F2+ cuando se evalúe modo offline |
| A2.8 | Datos AFIP valida vs ignora | Cliente reporta rechazo AFIP por campo "blando" |
| A2.9 | Inconsistencias que generan inspecciones | Después de primer año de operación real (datos empíricos) |
| A2.13 | Cambio condición IVA del tenant AFIP comunica | Primer tenant que cambie condición IVA |
| A2.14 | Cambio condición IVA cliente con histórico NC | Primera NC sobre factura > 6 meses old |
| A2.15 | Comprobantes "observed" CAE con observaciones | Primer caso real |
| A2.16 | Patrones AR específicos no nacionales (IIBB, ARBA, otras provincias) | F2+. **Trigger:** primer cliente target con domicilio fiscal fuera CABA/GBA O cliente que pida facturar IIBB-CABA específico. Al promover: expandir `fiscal_snapshots.jurisdiction_context` (ADR-0022). |
| ~~A2.17~~ | ~~TDF F2+~~ | **PROMOVIDO A F0 — 2026-05-27.** Target real F0 incluye comercios TDF. Ver ADR-0022 sección "Jurisdicción — F0 (TDF incluido como target real)". Scope F0 acotado: marca `special_regime`, flag `tdf_exempt` en productos, `FiscalBreakdown` en ticket, WSFEv1 con `ImpOpEx`. NO incluye: WSBFE, WSCT, multi-currency, tax engine. |
| A2.18 (NUEVO 2026-05-26) | Soporte WSMTXCA (factura con detalle de ítem) | F1+. **Trigger:** primer cliente B2B que requiera detalle de ítem en comprobante AFIP. Acción: crear `src/lib/fiscal/projection/wsmtxca.ts` siguiendo patrón ADR-0022. |
| A2.19 (NUEVO 2026-05-26) | Soporte WSFEX (factura electrónica exportación) | F2+. **Trigger:** primer cliente target exportador. Misma arquitectura que A2.18. |

(A2.1, A2.2, A2.3, A2.4, A2.7, A2.10, A2.11, A2.12 quedan en Sesión 5 v4 como **BloqueanteProd**.)

#### A.3 Trazabilidad y auditoría (6 items diferidos)

| ID | Item | Trigger |
|---|---|---|
| A3.1 | Eventos que deberían ser inmutables (extras) | Inspección AFIP real revela vacío |
| A3.2 | Campos sutiles que no deberían editarse | Auditoría interna F1 |
| A3.3 | Versionado histórico de entidades | Cliente pide reconstruir estado pasado |
| A3.4 | Cómo se ve una auditoría desde el inspector | Primera inspección AFIP real |
| A3.5 | Qué esperan ver en una inspección | Idem A3.4 |
| A3.6 | Reportes que piden inspectores | Idem A3.4 |

(A3.7, A3.8, A3.9 quedan en Sesión 5 v4 como **BloqueanteProd**.)

#### A.4 Multiempresa y multiusuario (5 items — todos diferidos)

| ID | Item | Trigger |
|---|---|---|
| A4.1 | Cómo manejan estudios contables múltiples clientes | Primer contador con 5+ clientes en Pandora |
| A4.2 | Permisos que necesitan empleados | Primer cliente con > 3 empleados activos |
| A4.3 | Separación entre empresas software contable | Idem A4.1 |
| A4.4 | Acciones que requieren doble validación | Primer fraude o intento sospechoso |
| A4.5 | Logs por usuario para defensa legal | Primera disputa laboral con cliente |

#### A.5 Conciliación y dinero (4 items diferidos)

| ID | Item | Trigger |
|---|---|---|
| A5.2 | Liquidación parcial MercadoPago | Implementación MP QR completa |
| A5.4 | Contracargos y devoluciones | F1+ con NC implementada. **Detalle técnico y estado real del código en §D.5** (auditado 2026-09-05) + pregunta **A-27** a la contadora |
| A5.5 | Conciliaciones bancarias | F2+ (CLAUDE.md §5.3, §21.2). Ver §D.5 |
| A5.6 | Cambio medio de pago tras cierre | Primer reporte real de error |

(A5.1, A5.3 quedan en Sesión 5 v4 como **BloqueanteProd**.)

#### A.6 Retención documental (3 items diferidos)

| ID | Item | Trigger |
|---|---|---|
| A6.4 | Backups que esperan auditores | Primera inspección AFIP |
| A6.5 | Cold storage acceso 24-48h | Cliente reporta necesidad de acceso a archivo |
| A6.6 | Solicitud eliminación datos (Ley 25.326) vs retención | Primer pedido ARCO real |

(A6.1, A6.2, A6.3 quedan en Sesión 5 v4 como **BloqueanteProd**.)

### Sección B — Abogado (24 items diferidos, 7 quedan en Sesión 5 v4)

#### B.1 Riesgo operativo SaaS (8 items diferidos)

| ID | Item | Trigger |
|---|---|---|
| B1.3 | Separar razón social operativa y tecnológica | Facturación SaaS > USD 10k/mes |
| B1.4 | Seguros RC profesional | Primer cliente Business o > 20 clientes |
| B1.5 | Errores facturación masivos protocolo | Primer incidente |
| B1.6 | Cláusula "best effort" AFIP | Redacción T&C definitivos |
| B1.7 | Protección caída terceros | Idem B1.6 |
| B1.8 | Limitar responsabilidad por datos del usuario | Idem B1.6 |
| B1.9 | Jurisdicción T&C | Idem B1.6 |
| B1.10 | Consentimiento operacional | Idem B1.6 |

(B1.1, B1.2 quedan en Sesión 5 v4 como **BloqueanteCode** / **BloqueanteProd**.)

#### B.2 Datos y privacidad (8 items diferidos)

| ID | Item | Trigger |
|---|---|---|
| B2.1 | Qué datos en logs (nombre, CUIT, email, IP) | Ya cubierto por Rule 04-observability — solo validar policy con abogado |
| B2.2 | CUIT completo en logs | Idem B2.1 |
| B2.3 | IP del usuario en logs | Idem B2.1 |
| B2.4 | Anonimización logs históricos | F1+ retention policies |
| B2.5 | Derecho borrado ARCO plazos | Primer pedido ARCO |
| B2.6 | Borrado en backups históricos | Idem B2.5 |
| B2.8 | DPAs modelo con cada cliente | Primer cliente B2B grande que lo pida |
| B2.9 | Customer snapshot inmutable vs actualización | Primer pedido de rectificación de cliente final |
| B2.10 | Archive idempotency + derecho al olvido | F1+ archive |

(B2.7 queda en Sesión 5 v4 como **BloqueanteProd**.)

#### B.3 Empleados y accesos (4 items — todos diferidos)

| ID | Item | Trigger |
|---|---|---|
| B3.1 | Responsabilidad titular sobre empleados | Primera disputa con empleado |
| B3.2 | Evidencia legal para defender al titular | Idem B3.1 |
| B3.4 | Operaciones que requieren firma digital | Cliente pide / regulación cambia |
| B3.5 | Consentimiento explícito documentado | Redacción T&C definitivos |

(B3.3 queda en Sesión 5 v4 como **BloqueanteProd**.)

#### B.4 Multi-tenant y aislamiento (4 items diferidos)

| ID | Item | Trigger |
|---|---|---|
| B4.3 | SLA mínimo contractual | T&C definitivos |
| B4.5 | T&C B2B vs B2C separados | Idem B4.3 |
| B4.6 | Delete company 7 días defendible | Parcialmente cubierto por ADR-0020 (demo lifecycle: 60d trial → 22d read_only → archive día 82). "Delete company 7 días" no está cubierto directo — F1+ trigger: primer comerciante que pide cancelar y delete inmediato + plazo legal con abogado (B-5 advisor) |

(B4.1, B4.2, B4.4 quedan en Sesión 5 v4 como **BloqueanteCode** / **BloqueanteProd**.)

### Sección C — Clientes reales (8 items diferidos, 9 quedan)

#### C.2 Performance operacional (5 items diferidos)

| ID | Item | Trigger |
|---|---|---|
| C2.1 | Cuánto tarda hoy una venta | Validar empírico con 3 clientes piloto |
| C2.2 | Ventas simultáneas en pico | Métrica real F0 |
| C2.3 | Qué hacen sin internet | F2+ offline |
| C2.4 | Qué hacen cuando AFIP cae | Validar con 5 comercios piloto |
| C2.5 | Necesidad real de seguir vendiendo offline | F2+ |

#### C.3 Pricing y ROI (3 items diferidos)

| ID | Item | Trigger |
|---|---|---|
| C3.2 | Tiempo administrativo perdido por semana | Encuesta cliente 1-5 |
| C3.3 | Costo actual contador + errores + tiempo | Idem C3.2 |
| C3.4 | ROI esperado | Idem C3.2 |

(C1.1-C1.6, C3.1, C3.5, C3.6 quedan en Sesión 5 v4 como **BloqueanteProd**.)

### Sección D — Producto (4 diferidos, 2 quedan en Sesión 5 v4)

(D.1, D.2 ambos son críticos para definir UX — quedan como **BloqueanteProd**.)

#### D.3 Distribución de ganancias por socios (1 item diferido — destapado por owner 2026-06-02)

| ID | Item | Trigger |
|---|---|---|
| D3.1 | **Apartado de distribución de ganancias entre socios del comercio** (caso real LIS: 70% novia + 30% socia). Calcula automáticamente porcentaje correspondiente a cada socia sobre la ganancia neta del período. Sección dedicada en vista propietario o vista contador. | **F1+ con cliente pagando** O cuando se construya vista propietario/dashboard owner. NO F0 porque (a) operativa POS no se ve afectada, (b) ganancia neta requiere primero módulo de gastos/costos que NO está en F0, (c) la distribución legal real se hace via contador/escribano, Pandora solo expone el cálculo informativo. |

**Caveat operativo:** owner trajo la idea explícitamente como "para más adelante, no romper flujo Sprint 1". Disciplina aplicada: persistida acá, no agregada a F0. Cuando se promueva, validar con contadora si calcular sobre `ingresos brutos` (simple) o `ganancia neta = ingresos − costos − impuestos − sueldos` (real, requiere módulo gastos previo). Schema candidato: tabla `tenant_partners (tenant_id, user_id?, partner_name, percentage_basis_points, valid_from, valid_to)` — usar basis points (7000 = 70.00%) para evitar floating point en porcentajes.

**Aplicabilidad fuera de LIS:** común en SRL/SAS multi-socio (LIS = SAS según cierre Z). Patrón potencialmente útil también para rotisería del papá del amigo si tiene socio. Validar con 2+ clientes reales antes de promover.

#### D.4 Catálogo — ideas tomadas de Tango Facturador (3 items diferidos — observación de campo owner 2026-09-03)

Origen: el owner fotografió la pantalla **"Precios y saldos de stock"** de Tango Facturador en un comercio real (Mar de Cobo). Se aplicó el filtro §4.3 de CLAUDE.md: de lo observado, **el modo consulta de precio se promovió a la cola** (ver `QUEUE.md` P4 #15) por ser un flujo diario con gap real; estos tres quedan diferidos con trigger; y se descartaron explícitamente *stock por depósito* (NON-GOAL multi-sucursal), *descuento en cascada* (complejidad sin caso real — el guard de margen de Ofertas cubre el 95%) y *moneda de la lista* (ARS-only hasta F2).

| ID | Item | Trigger |
|---|---|---|
| D4.1 | **Códigos alternativos / "sinónimo" por producto.** Tango muestra `Sinónimo: PDP6648` además del código de barras `779355406648`: el mismo artículo tiene el código del fabricante Y uno interno del comercio. Hoy tenemos `sku` + `barcode` (dos); esto sería un tercer eje N:1. Schema candidato: tabla `product_codes (product_id, code, type)` en vez de agregar columnas. | **1 comercio real que lo pida** (típico cuando migra de otro sistema y arrastra códigos viejos que el personal ya tiene memorizados). NO antes: agrega una tabla y complica el escaneo, que hoy funciona. |
| D4.2 | **Artículos sustitutos y accesorios.** "No hay Coca 600 → ofrecé la de 500" (sustituto) y "va bien con esto" (accesorio). Muy útil en kiosco para no perder la venta por faltante. | **Catálogo maduro** (>300 SKU cargados en un cliente real) **+ pedido explícito**. Sin catálogo grande la relación se arma a mano y no se mantiene. |
| D4.3 | **Listas de precios múltiples** (Tango: "Venta Minorista" como una de N). Hoy Pandora tiene **un** precio por producto. | **Primer cliente con precio mayorista/minorista diferenciado.** Nota de diseño: engancha directo con los **tipos comerciales de cliente** ya diseñados en `pos-preview/clientes-v6.html` (clasificación ortogonal a la condición IVA, multi-tag, habilita promos) — cuando se promueva, la lista de precios se asocia al tipo comercial, no a un campo suelto. |

**Observación de producto (no accionable, pero registrada):** la pantalla de Tango muestra **precio sin impuestos y precio con impuestos lado a lado**, que es exactamente lo que exige el Régimen de Transparencia Fiscal (Ley 27.743) y lo que ya modela nuestro `FiscalBreakdown` (ADR-0022). Es validación externa de que esa parte del diseño va bien encaminada.

### Sección E — Avanzado (8 items diferidos, 4 quedan)

#### E.1 A contador empírico (4 items diferidos)

| ID | Item | Trigger |
|---|---|---|
| E1.1 | Patrones que disparan auditorías AFIP | Primer año operativo |
| E1.2 | Inconsistencias que disparan inspecciones | Idem |
| E1.3 | Errores constantes en ERPs argentinos | Conversación con contadores referentes |
| E1.4 | Reportes contables imprescindibles | F1 al diseñar reportes |

#### E.2 A abogado estratégico (4 items diferidos)

| ID | Item | Trigger |
|---|---|---|
| E2.1 | Cláusula "best effort" AFIP | T&C definitivos |
| E2.2 | Protección caída terceros | Idem |
| E2.3 | Consentimiento operacional efectivo | Idem |
| E2.4 | SRL vs monotributo | Facturación SaaS > umbral monotributo |

(E.3 4 items se quedan en Sesión 5 v4 como **BloqueanteProd**.)

---

### D.5 — Detección de contracargos (pagos revertidos después de cobrados)

> Surgido de una pregunta del owner (2026-09-05): *"¿cómo chequeo que un pago de hace un mes no fue dado de baja por el consumidor y no represente una pérdida no contemplada?"* Auditado contra el código el mismo día.

**Estado real hoy:** el sistema **no lo detecta**.

| Medio | Qué hay | Qué falta |
|---|---|---|
| **MercadoPago** | `charged_back` está reconocido en `payment-status.ts` → mapea a `pending` + `reclassified:true` y se audita. El razonamiento está escrito: *"un charged_back mal interpretado como approved sería plata mal contada"* | (a) el único disparador es el webhook entrante — **ningún job revisa pagos viejos**; (b) el estado cambia en `mp_payments` y **nadie se entera**: la venta sigue `cobrada` y la caja ya contó esa plata |
| **Débito / Crédito** | **NADA.** El POS escribe `credito $X` y no hay integración, ni webhook, ni archivo de liquidación | Todo. Es la exposición real |
| **Conciliación bancaria** | — | Es **F2** por decisión de scope (CLAUDE.md §5.3, §21.2) |

| ID | Ítem | Trigger para promover |
|---|---|---|
| D5.1 | **Exponer el `reclassified` que ya se detecta** — que un contracargo de MP le llegue a una persona (queries de operador §10.8; `payment.mp.refunded` ya está en el catálogo de eventos) | Barato y no depende de nadie. Primer cliente que cobre con MP en producción |
| D5.2 | **Archivo de liquidación del procesador de tarjeta** (Posnet/Lapos) — única fuente real de contracargos de tarjeta. Conseguirlo es **trámite con el proveedor, no código** (misma categoría que el certificado de homologación) | Primer cliente que cobre con tarjeta en volumen |
| D5.3 | Job proactivo que re-consulte pagos ya cobrados dentro de la ventana de contracargo | Requiere D5.2 + saber la ventana real (pregunta A-27 a la contadora) |

**🔴 Ojo al scope:** si la contadora responde que un contracargo sobre venta facturada se resuelve con **nota de crédito** (pregunta **A-27**), entonces **NC deja de ser diferible**. Hoy está en F1+ asumiendo que sólo sirve para devoluciones voluntarias — un contracargo no es voluntario y el comercio no lo elige.

**Por qué NO es parte del cierre de caja:** el contracargo llega **después** de que la sesión cerró. ADR-0026 deja las sesiones cerradas en F1+ explícitamente. Es un mecanismo aparte, no una extensión del arqueo.

---

### D.6 — Análisis de compras del cliente / ofertas personalizadas

> **Evidencia de campo 2026-09-05:** un emprendedor lo pidió en una reunión — *"análisis de las compras de los clientes para hacerle ofertas personalizadas, u ofrecerle mercadería que suele comprar"*. Es la **primera señal real** del módulo "Clientes (CRM-lite)" del Centro de Inteligencia, que hasta ahora era hipótesis de brainstorm.

Son **tres pedidos distintos**, y conviene no tratarlos como uno:

| ID | Ítem | Dificultad | Trigger para promover |
|---|---|---|---|
| D6.1 | Ver qué compra habitualmente un cliente (historial) | Baja — consulta sobre `sale_items` + cliente de la venta | 3+ comercios que lo pidan **y** que sus ventas tengan cliente identificado |
| D6.2 | Sugerir reposición ("suele comprar X cada 15 días") | Media — patrón temporal por cliente/producto | Requiere D6.1 con historial real de meses |
| D6.3 | Ofertas **personalizadas** (precio o promo por cliente) | Alta — y **no sólo técnica** | 🔴 **Bloqueado por dos gates, ver abajo** |

**🔴 Gate legal (abogado).** Analizar el comportamiento de compra de una persona para ofrecerle cosas es **elaboración de perfiles** sobre datos personales → **Ley 25.326**: base legal, finalidad, consentimiento, derecho de oposición. Registrar una venta (finalidad fiscal, obligatoria) NO es lo mismo que usar esa venta para perfilar (finalidad comercial, opcional). Misma categoría que el gate **B-IA**.

**🔴 Gate fiscal (contadora).** El research de Ofertas ya cerró que **no hay descuento por medio de pago — precio único**. Un precio distinto por cliente es su vecino cercano: hay que verificar implicancias sobre base imponible y sobre el régimen de transparencia (Ley 27.743) antes de asumir que "es marketing y es libre".

**⚠️ Dependencia dura:** requiere que la venta tenga **cliente identificado**. En un kiosco el 80%+ es consumidor final anónimo y no hay nada que analizar. Es cierto en sedería/ferretería con habitués, falso en otros rubros. **Pregunta para las entrevistas:** *"¿sabés quiénes son los clientes que te vuelven?"*.

**Estado:** asentado a pedido del owner, sin analizar todavía.

---

## Resumen ejecutivo del backlog

| Sección | Diferidos | Activos F0 | Total |
|---|---|---|---|
| A — Contador | 29 | 19 | 48 |
| B — Abogado | 24 | 7 | 31 |
| C — Cliente | 8 | 9 | 17 |
| D — Producto | 10 | 2 | 12 |
| E — Avanzado | 8 | 4 | 12 |
| **TOTAL** | **79** | **41** | **120** |

**Discrepancia con Sesión 5 v4 conteos previos:** la auditoría 2026-05-26 redujo "activos F0" de 42 a 41 (cambio menor por reclasificación de B4.6 que ya está cubierto por ADR-0020).

**Reconciliación de conteos 2026-09-03:** al sumar los 3 items de D.4 se detectó que el encabezado del doc decía **69** diferidos mientras esta tabla ya sumaba **70** — drift preexistente de 1, anterior a este cambio. Se tomó la tabla como fuente (es la que desglosa por sección) y se alineó el encabezado. Nuevo total: 70 + 3 = **73**.

**2026-09-05:** +3 por D.5 (detección de contracargos) → **76**. +3 por D.6 (análisis de compras del cliente) → **79**.

---

## Items activos F0 (referencia rápida — el detalle queda en Sesión 5 v4)

### BloqueanteCode (4) — validar antes de tipear código relacionado

1. **A1.1** — ¿Es "asesoramiento contable automatizado"?
2. **A1.3** — ¿Qué operaciones NO automatizar?
3. **B1.1** — Responsabilidad civil ante error fiscal automatizado
4. **B4.1** — Qué pasa legalmente ante fuga cross-tenant

### BloqueanteProd (10 — reformulados post-investigación oficial 2026-05-27)

> **Mapping a advisor doc:** los items A2.X y BX.Y de Sesión 5 v4 original se reorganizaron en advisor doc como A-1..A-17 / B-1..B-14. Cross-references abajo.

#### Contador (5)
1. **A2.1 + A2.2** — Política redondeo (HALF_EVEN cerrado oficial; stage PER_LINE pendiente A-1 advisor) — ver advisor A-1
2. **A2.10** — Ticket no fiscal post 2h ✅ CONFIRMADO oficialmente que NO es válido (régimen controladores fiscales, no WSFEv1). Reformulado a **A-2 advisor** (modelo "constancia provisoria")
3. **A2.11** — Campos customer_snapshot por tipo A/B/C — parcialmente cerrado oficial (DocTipo=80 tipo A, Tipo C sin Iva[]). Falta legal_name/fiscal_address — ver advisor **A-3**
4. **A2.12** — Política CUIT por capas (Padrón A5 caché) — ver advisor **A-4**
5. **A-11 advisor (NUEVO 2026-05-27)** — Régimen Transparencia Fiscal Ley 27.743 (texto + estructura visual)

#### Abogado (5)
6. **A6.1** — Conservación legal docs NO fiscales — ver advisor **B-5**
7. **B2.7** — Inscripción AAIP ✅ obligatoria CONFIRMADO oficial. Reformulado a **B-2 advisor** (cómo declarar SaaS multi-tenant)
8. **B4.4** — Notificación breach AAIP — ver advisor **B-3** (plazo "72h" NO existe oficial AR — sigue genuinamente abierto)
9. **B-1 advisor** — Responsabilidad civil error fiscal + RC profesional + SRL
10. **B-6 advisor** — Ángulo civil/comercial de venta cobrada sin CAE (complementa A-2)

#### Cliente (1)
- **C3.5** — Validar pricing $25k / $60k ARS con 5 piloto TDF

#### Producto (1)
- **D.1** — Qué cosas hacen manualmente porque no confían en sistemas (research empírico con 3 piloto)

---

## Cross-references

- [reunion-contador-y-abogado.md](reunion-contador-y-abogado.md) — guion advisor con preguntas A-1..A-17 + B-1..B-14 (reformulación de items críticos)
- [DECISION-LEDGER.md](DECISION-LEDGER.md) — autoridad y estado de cada decisión
- [ROADMAP.md](ROADMAP.md) — Sprints 6, 7, 10 GATED por items críticos del advisor
- [CAPABILITY-MAP.md](CAPABILITY-MAP.md) — capabilities afectadas por cada item al promoverse
- [NON-GOALS.md](NON-GOALS.md) — items que NO entran al backlog (rechazados explícitos)

---

*Backlog vivo. Items pueden moverse a Sesión 5 v4 si aparece trigger justificado. Última auditoría 2026-05-28 (Lote 5).*
