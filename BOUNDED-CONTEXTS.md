# BOUNDED-CONTEXTS.md — Pandora ERP

**Versión:** 1.0.0
**Fecha:** 2026-05-28
**Estado:** vigente
**Propósito:** definir los **bounded contexts** (DDD-lite, sin ceremonia) que estructuran el código de Pandora, con ownership de datos, interfaces entre contextos, anti-acoplamiento.

> Bounded Context = territorio del código donde un concepto significa una cosa específica. "Customer" en `Sales` puede ser distinto de "Customer" en `Identity` — bounded contexts hacen esa diferencia EXPLÍCITA.
>
> Esto NO es DDD ceremonial. Es supervivencia arquitectónica para que el monolito modular NO se vuelva spaghetti.

---

## Por qué este documento existe

Sin bounded contexts:
- "Customer" significa cosa distinta en código de venta vs facturación vs auth
- Cambios en `User` propagan a 12 archivos sin estructura
- Tests acoplados a TODA la app
- Imposible saber dónde vive una responsabilidad
- ERP spaghetti garantizado

Con bounded contexts:
- Cada contexto define SU vocabulario
- Cambios local-first
- Tests acotados
- Ownership claro
- Refactor seguro

---

## Estructura

Cada Bounded Context tiene:

| Campo | Definición |
|---|---|
| **Nombre** | `PascalCase` |
| **Folder físico** | Path en `src/lib/` |
| **Responsabilidad** | Frase corta de lo que hace |
| **Capabilities cubiertas** | IDs de CAPABILITY-MAP |
| **Owns tables** | Tablas Postgres bajo su control (CRUD permitido) |
| **Reads tables** | Tablas que solo lee (no escribe) |
| **Publishes events** | Eventos canónicos que emite |
| **Consumes events** | Eventos que escucha |
| **Public API** | Funciones / Services exportadas a otros contextos |
| **Private** | Lo que NO debe importarse desde fuera |

---

## Mapa visual de contextos

```
┌───────────────────────────────────────────────────────────────────┐
│  PRESENTATION (src/app/, src/components/)                         │
│  ─ atraviesa todos los contextos vía Public APIs                  │
└─────────────────────────────────────────────────────────────────┬─┘
                                                                  │
┌─────────────────────────────────────────────────────────────────▼─┐
│  CORE BUSINESS                                                    │
│                                                                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐          │
│  │  Sales   │→ │  Fiscal  │  │   Cash   │  │Inventory │          │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘          │
│       │             │             │             │                 │
│       └─────────────┴─────────────┴─────────────┘                 │
│                              │                                    │
│                  ┌───────────▼──────────────┐                     │
│                  │      Reporting           │                     │
│                  └──────────────────────────┘                     │
└─────────────────────────────────────────────────────────────────┬─┘
                                                                  │
┌─────────────────────────────────────────────────────────────────▼─┐
│  SUPPORTING                                                       │
│                                                                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────────┐                     │
│  │ Identity │  │Notifica- │  │ Integrations │                     │
│  │          │  │tions     │  │  ─ AFIP      │                     │
│  └──────────┘  └──────────┘  │  ─ MP        │                     │
│                              │  ─ Email     │                     │
│                              └──────────────┘                     │
└─────────────────────────────────────────────────────────────────┬─┘
                                                                  │
┌─────────────────────────────────────────────────────────────────▼─┐
│  PLATFORM (cross-cutting)                                         │
│                                                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │
│  │MultiTenant   │  │ Observability│  │   Tracing    │             │
│  │              │  │              │  │              │             │
│  └──────────────┘  └──────────────┘  └──────────────┘             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │
│  │  JobsQueue   │  │   Audit      │  │   Security   │             │
│  │              │  │              │  │              │             │
│  └──────────────┘  └──────────────┘  └──────────────┘             │
└───────────────────────────────────────────────────────────────────┘
```

Reglas de dependencia:
- **Presentation** importa de **Core** + **Supporting** + **Platform** vía public APIs.
- **Core** puede importar de **Supporting** + **Platform**, NO entre cores sin pasar por public API.
- **Supporting** puede importar de **Platform**, NO de **Core**.
- **Platform** NO importa de NADIE excepto otros Platform específicos.
- **NUNCA** dependencias circulares.

---

## CORE BUSINESS CONTEXTS

### Sales

**Folder:** `src/lib/sales/`
**Responsabilidad:** gestión del ciclo de venta — carrito, descuentos, cobro, estado comercial.

**Capabilities:** C-COM-01 (carrito POS), C-COM-05 (descuentos), C-COM-06 (cobro). Consume C-IDE-07 (customers) vía Public API de Identity.

**Owns tables:**
- `sales` (PK, tenant, customer, total, commercial_status, fiscal_status, correlation_id, created_at, ...)
- `sale_items` (FK sale_id, product snapshot, qty, unit_price, line_total, line_iva)
- `sale_payments` (FK sale_id, method, amount, mp_payment_id?)

**Reads tables:**
- `products` (vía Inventory public API, no acceso directo a DB)
- `customers` (vía Identity public API)
- `cash_sessions` (vía Cash public API)

**Publishes events:**
- `sale.draft_created`
- `sale.items_added`
- `sale.cobrada` (venta cobrada, antes de fiscal)
- `sale.cancelled`

**Consumes events:**
- `fiscal.cae_received` → actualiza `fiscal_status='issued'`
- `fiscal.reconciliation_timeout` → actualiza `fiscal_status='manual_resolution_required'`

**Public API:**
- `SaleService.createDraft(tenantId, userId)`
- `SaleService.addItem(saleId, productId, qty)`
- `SaleService.applyDiscount(saleId, discount)`
- `SaleService.cobrar(saleId, payments[]) → Sale cobrada`
- `SaleService.cancel(saleId, reason)`
- `SaleQuery.findById(saleId)`
- `SaleQuery.findByCorrelationId(correlationId)`

**Private (NO importar desde fuera):**
- `src/lib/sales/internal/*` — pricing engine privado, draft state machine privada.

**Anti-acoplamiento:**
- NO importar `src/lib/fiscal/*` directamente. La emisión de factura post-cobro pasa por `FiscalService.emitInvoice(saleId)` que es API pública de Fiscal.
- NO importar tablas `products` / `customers` directamente. Snapshot al momento.

---

### Fiscal

**Folder:** `src/lib/fiscal/`
**Responsabilidad:** AFIP/ARCA integration, emisión de comprobantes electrónicos, snapshots fiscales, reconciliación.

**Capabilities:** C-FIS-01 a C-FIS-14 (C-FIS-11..14 deferred F1+/F2+, ver CAPABILITY-MAP).

> ⚠️ **2 capabilities 🔴 BLOQUEADAS para código:** C-FIS-08 (Ley 27.743 — bloquea primer ticket impreso) + C-FIS-10 (constancia provisoria post-timeout — bloquea código reconciliación). NO codear hasta cerrar A-11 + A-2 + B-6 con contador/abogado.

**Sub-folders internos:**
- `src/lib/fiscal/projection/wsfev1.ts` — proyección al payload AFIP
- `src/lib/fiscal/snapshot.ts` — snapshot inmutable (campos ampliados por ADR-0023: `condicion_iva_receptor_*` + `qr_*` + `authorization_code_type`)
- `src/lib/fiscal/breakdown.ts` — FiscalBreakdown (Ley 27.743)
- `src/lib/fiscal/numeration.ts` — SELECT FOR UPDATE numeración
- `src/lib/fiscal/recovery.ts` — FECompUltimoAutorizado + validateRecoveredCae
- `src/lib/fiscal/wsaa.ts` — gestión token WSAA
- `src/lib/fiscal/padron.ts` — Padrón A5 cache
- `src/lib/fiscal/qr.ts` — generador determinístico del payload QR (RG 4892/2020, spec versión 1) — **NUEVO ADR-0023**
- `src/lib/fiscal/catalogs/` — **NUEVO submódulo introducido por ADR-0025**. Registry runtime de los 12 catálogos `FEParam*` del WSFEv1:
  - `registry.ts` — `CatalogRegistry` class con lookup tipado por catálogo + cache lookup
  - `cache.ts` — Cache in-memory con TTL configurable por catálogo (24h críticos, 1h `Cotizacion` F2+)
  - `boot.ts` — `bootFiscalModule()` — preload 7 catálogos críticos F0, fail-closed si alguno no disponible
  - `errors.ts` — `CatalogNotAvailableError`, `CatalogIdNotInVersionError`, `FiscalModuleNotReadyError`
  - `types.ts` — `CatalogEntry`, `CatalogReference {fetched_from_arca_at, hash, size}`
- `src/lib/fiscal/services/` — Application Services (FiscalService)
- `src/lib/workers/catalog-refresh.ts` (Workers context, ownership compartido) — cron diario refresh + diff por hash + emite `system.catalog.degraded_fail_closed` cuando > 7 días sin refresh exitoso

**Owns tables:**
- `invoices` (FK sale_id, invoice_number, invoice_type, cae, cae_due_date, fiscal_status, ...)
- `fiscal_snapshots` (FK invoice_id, snapshot completo inmutable jsonb + columnas materializadas para query)
- `invoice_sequences` (tenant_id, sale_point, invoice_type, next_number)
- `wsaa_tokens_cache` (tenant_id, token, expires_at)
- `padron_a5_cache` (cuit, data jsonb, fetched_at)

**Reads tables:**
- `sales` (vía Sales public API)
- `customers` (vía Identity public API para customer_snapshot)
- `products` (vía Inventory public API para item snapshot)

**Publishes events** (catálogo canónico EVENT-TAXONOMY §5):
- `fiscal.invoice.cae_received`
- `fiscal.invoice.cae_rejected`
- `fiscal.invoice.requires_reconciliation`
- `fiscal.invoice.reconciled_issued`
- `fiscal.invoice.reconciliation_timeout`
- `fiscal.invoice.number_burned`
- `fiscal.invoice.manual_resolution_required`
- `fiscal.invariant_violation`

**Consumes events:**
- `sale.cobrada` → trigger emisión async (via JobsQueue)

**Public API:**
- `FiscalService.emitInvoice(saleId, options) → InvoiceResult`
- `FiscalService.reconcilePending(invoiceId) → ReconcileResult` (worker)
- `FiscalService.validateCuit(cuit) → PadronResult`
- `FiscalQuery.findInvoiceBySaleId(saleId)`
- `FiscalQuery.getFiscalSnapshot(invoiceId)`
- `FiscalProjection.toWSFEv1(snapshot) → WSFEv1Payload` (función pura, exportada para tests)

**Private:**
- Schema WSFEv1 detalles, AFIP SOAP client internals, recovery internals.

**Anti-acoplamiento crítico:**
- **Resto del sistema NUNCA conoce shape WSFEv1.** Solo importa `FiscalService.emitInvoice()` y tipos del modelo interno.
- Si cambia WSFEv1 → cambio LOCAL a `projection/wsfev1.ts` + tests. Resto del código intacto.

---

### Cash

**Folder:** `src/lib/cash/`
**Responsabilidad:** apertura, cierre y conciliación de caja diaria.

**Capabilities:** C-OPS-01 (apertura/cierre caja).

**Owns tables:**
- `cash_sessions` (PK, tenant_id, sale_point, opened_by, opened_at, closed_at, initial_amount, final_amount, expected_amount, descuadre)
- `cash_movements` (FK cash_session_id, type, amount, reason, audit fields)

**Reads tables:**
- `sales` (sumarizar por session vía Sales public API)
- `sale_payments` (sumarizar por session)

**Publishes events:**
- `cash.session_opened`
- `cash.session_closed`
- `cash.descuadre_detected`

**Public API:**
- `CashService.openSession(tenantId, salePoint, initialAmount, userId)`
- `CashService.closeSession(sessionId, countedAmount, reason?)`
- `CashService.registerMovement(sessionId, type, amount, reason)`
- `CashQuery.getActiveSession(tenantId, salePoint)`
- `CashQuery.getSessionSummary(sessionId)`

**Constraint:** unique partial index `WHERE closed_at IS NULL` para garantizar solo 1 session abierta por (tenant, sale_point).

---

### Inventory

**Folder:** `src/lib/inventory/`
**Responsabilidad:** catálogo de productos + movimientos de stock + alertas stock mínimo.

**Capabilities:** C-COM-02 (catálogo), C-COM-03 (búsqueda POS), C-OPS-02 (mov stock venta), C-OPS-03 (ajuste manual), C-OPS-04 (alerta stock mínimo — F0 display only, F1+ proactivo vía Notifications), C-OPS-05 (compras básicas). F1+: C-COM-07 (listas precios), C-COM-08 (variantes).

**Owns tables:**
- `products` (PK, tenant_id, name, code, barcode?, price, stock_actual, min_stock, tdf_exempt, category?)
- `stock_movements` (PK, tenant_id, product_id, type, qty, reason?, related_sale_id?, related_purchase_id?, created_at) — APPEND-ONLY

**Reads tables:**
- ninguna (independiente)

**Publishes events:**
- `inventory.product_created`
- `inventory.stock_decremented` (por venta)
- `inventory.stock_adjusted` (manual)
- `inventory.low_stock_warning`

**Consumes events:**
- `sale.cobrada` → decrementa stock

**Public API:**
- `InventoryService.createProduct(tenantId, productData)`
- `InventoryService.updateProduct(productId, changes)`
- `InventoryService.adjustStock(productId, delta, reason, userId)`
- `InventoryService.registerPurchase(productId, qty, cost?)`
- `InventoryQuery.findById(productId)`
- `InventoryQuery.search(tenantId, query)` (typeahead)
- `InventoryQuery.findByBarcode(tenantId, barcode)`
- `InventoryQuery.getLowStock(tenantId)`
- `InventoryProjection.toSaleItemSnapshot(productId, qty) → SnapshotForSale` (función pura para Sales)

**Constraint crítico:** decremento de stock en venta debe ser SELECT FOR UPDATE para evitar oversell concurrente.

---

### Reporting

**Folder:** `src/lib/reporting/`
**Responsabilidad:** generación de reportes operativos y fiscales para comerciante + contador.

**Capabilities:** C-OPS-06 (reporte ventas), C-OPS-07 (reporte IVA), C-OPS-08 (vista contador read-only — coordina con Identity para acceso multi-empresa C-IDE-02, ver C-OPS-09 invitación que vive en Identity).

**Owns tables:**
- (ninguna — solo queries)

**Reads tables:**
- `sales`, `invoices`, `fiscal_snapshots`, `cash_sessions`, `stock_movements` (vía Queries de cada contexto)

**Publishes events:**
- `reporting.export_generated`

**Public API:**
- `ReportingService.generateDailySalesReport(tenantId, date)`
- `ReportingService.generateIVAReport(tenantId, month)`
- `ReportingService.generateStockReport(tenantId)`
- `ReportingService.generateCashSessionReport(sessionId)`
- `ReportingExport.toCSV(report)`
- `ReportingExport.toExcel(report)`

**Anti-acoplamiento:**
- NO escribe en tablas de otros contextos.
- NO hace cálculos fiscales (delega en FiscalQuery / FiscalProjection).

---

## SUPPORTING CONTEXTS

### Identity

**Folder:** `src/lib/identity/`
**Responsabilidad:** autenticación, permisos, gestión de usuarios (comerciantes + cajeros + contadores), customer (clientes finales del comerciante), invitación contador.

**Capabilities:** C-IDE-01 (auth), C-IDE-02 (contador multi-empresa JWT array), C-IDE-03 (RBAC simple), C-IDE-04 (support impersonation), C-IDE-05 (password reset), C-IDE-07 (gestión customers — owns tabla `customers`), C-OPS-09 (invitación contador). C-IDE-06 (2FA/MFA) deferred F1.

**Owns tables:**
- `companies` (tenant equivalent — PK, name, cuit, jurisdiction_context, plan, demo_state, demo_started_at, ...)
- `users` (PK, email, supabase_auth_user_id, ...) — perfil base
- `user_roles` (user_id, company_id, role enum) — multi-empresa para contador
- `customers` (PK, tenant_id, doc_type, doc_number, name, fiscal_address?, iva_condition, ...) — clientes finales del comerciante

**Reads tables:**
- ninguna

**Publishes events:**
- `auth.login_success`
- `auth.login_failed`
- `auth.password_changed`
- `multi_tenant.user_invited`
- `multi_tenant.accountant_added_to_company`

**Public API:**
- `AuthService.loginWithSupabase(...)` (wrapper Supabase Auth)
- `AuthService.getCurrentContext() → { userId, tenantId, role, companyIds[] }` (lee AsyncLocalStorage)
- `IdentityService.createCustomer(tenantId, customerData)`
- `IdentityService.inviteAccountant(tenantId, email)`
- `IdentityQuery.findCustomer(tenantId, docNumber)`
- `IdentityQuery.searchCustomers(tenantId, query)`

**Anti-acoplamiento crítico:**
- "Customer" en Identity = entidad del comerciante (datos cliente final, mutables hasta venta).
- "Customer" en Sales y Fiscal = snapshot inmutable persistido en `sale_items` o `fiscal_snapshots`.
- **NO confundir.** El snapshot es copia momento-emisión.

---

### Notifications

**Folder:** `src/lib/notifications/`
**Responsabilidad:** envío de emails (F0), SMS / WhatsApp (F1+) transaccionales.

**Capabilities:** C-NTF-01 (email factura), C-NTF-02 (email demo expirando), C-NTF-03 (email breach notification). C-NTF-04 (SMS/WhatsApp) deferred F1.

**Owns tables:**
- `notification_log` (PK, tenant_id, type, recipient, status, sent_at, retry_count, last_error)

**Reads tables:**
- ninguna (recibe payloads vía Public API)

**Publishes events:**
- `notification.sent` (informativo)
- `notification.failed` (informativo)

**Consumes events:**
- `fiscal.cae_received` → enqueue worker `email.send_invoice`
- `multi_tenant.demo_expiring` → enqueue worker `email.send_demo_expiring`
- (breach se dispara manualmente desde runbook, no por evento)

**Public API:**
- `NotificationService.sendInvoiceEmail(invoiceId, recipientEmail)`
- `NotificationService.sendDemoExpiringEmail(tenantId)`
- `NotificationService.sendBreachNotification(...)`

**Private:**
- `src/lib/notifications/internal/*` — workers (`email.send_invoice` lives here), template renderers privados.

**Anti-acoplamiento:**
- NO conoce contenido fiscal/legal — recibe payload listo desde el contexto que emite.
- NO conoce identidad del recipient más allá del email — Sales/Fiscal le pasan el destinatario.
- **USA internamente** `EmailService` de Integrations context (`MercadoPagoService` también es de Integrations). Notifications orquesta WHO + WHEN + WHAT; Integrations es el cliente HTTP/SDK puro.

---

### Integrations

**Folder:** `src/lib/integrations/`
**Responsabilidad:** clientes HTTP/SDK para servicios externos (AFIP SOAP, MercadoPago SDK, email provider). Wrappers mínimos sobre librerías de terceros para testability + secret management.

**Capabilities:** C-INT-02 (MercadoPago), C-INT-03 (Email provider). C-INT-01 (AFIP) compartida — wrapper SOAP vive acá, lógica fiscal vive en Fiscal context. C-INT-04 (Mercado Libre) y C-INT-05 (APIs públicas) deferred F2+.

**Sub-folders:**
- `src/lib/integrations/afip/` — SOAP client (privado, solo Fiscal lo usa via Public API que vive en Fiscal)
- `src/lib/integrations/mp/` — MercadoPago wrapper
- `src/lib/integrations/email/` — Resend / equivalente (consumido por Notifications)

**Owns tables:**
- `processed_webhook_events` (provider, event_id, processed_at)
- `mp_payments` (FK sale_id, mp_payment_id, status, amount, ...)

**Publishes events:**
- `webhook.received` (MercadoPago en F0)
- `webhook.signature_invalid` (alerta security)

**Consumes events:**
- ninguno (es punto de entrada externo)

**Public API:**
- `MercadoPagoService.createPayment(amount, idempotencyKey)`
- `MercadoPagoService.handleWebhook(rawBody, headers) → Event`
- `EmailService.send(to, template, data)` — consumido por Notifications context (uso esperado). Otros contexts NO emiten emails directos.
- `AfipSoapClient` — **NO exportado al exterior, solo usado internamente por Fiscal**

**Private:**
- SOAP envelope building, response parsing, retry-internal, SDK específicos.

**Anti-acoplamiento crítico:**
- Fiscal usa `AfipSoapClient` internamente. Otros contextos NO importan AfipSoapClient.
- Webhook MP entra a `MercadoPagoService.handleWebhook()` → ese a su vez consume Sales / Fiscal via public API.
- `EmailService` es público pero su uso esperado es desde Notifications. NO emitir emails desde Sales/Fiscal/etc directo — siempre via NotificationService.

---

## PLATFORM CONTEXTS (cross-cutting)

### MultiTenant

**Folder:** `src/lib/multi_tenant/`
**Responsabilidad:** RLS helpers, tenant_id validation, contador multi-company logic.

**Capabilities:** C-PLT-01 (multi-tenant con RLS), C-PLT-03 (feature flags por tenant).

**Owns tables:**
- `feature_flags` (tenant_id, flag_key, enabled, payload jsonb)

**Publishes events:**
- `multi_tenant.feature_flag_changed`
- `security.cross_tenant_access_attempt` (cuando validateTenantAccess falla)

**Consumes events:**
- ninguno

**Public API:**
- `withTenantContext(tenantId, fn)` (AsyncLocalStorage setter)
- `getCurrentTenantId() → string`
- `validateTenantAccess(resource, tenantId)`
- `isEnabled(flagKey, tenantId) → boolean` (feature flags)
- `CrossTenantAccessError` class

**Private:**
- RLS policy templates, feature flag cache TTL internals.

**Reglas operativas:**
- TODO Service que toca tabla con `tenant_id` debe validar via `validateTenantAccess()`.
- Si validación falla → throw `CrossTenantAccessError` + audit automático.
- Feature flags cache TTL 60s (ver C-PLT-03).

---

### Observability

**Folder:** `src/lib/observability/`
**Responsabilidad:** Pino logger, metrics writer, audit log writer, Sentry integration.

**Capabilities:** C-OBS-02 (Pino structured logs), C-OBS-03 (métricas con whitelist), C-OBS-05 (realtime broadcasts), C-OBS-06 (Sentry). C-OBS-01 (audit_log) re-exportada desde Audit context. C-OBS-04 (correlation) provista por Tracing context. C-OBS-07 (operator queries Q1-Q4) es SQL directo, no código.

**Sub-folders:**
- `src/lib/observability/logger.ts` — Pino Proxy con AsyncLocalStorage
- `src/lib/observability/metrics.ts` — `incrementCounter()` con whitelist
- `src/lib/observability/audit.ts` — `auditLog()` (re-export de Audit context)
- `src/lib/observability/realtime.ts` — `publishRealtimeEvent()` con correlation_id auto-inject

**Owns tables:**
- `metrics_counter` (canonical schema EVENT-TAXONOMY §7)

**Publishes events:**
- (vía Realtime broadcasts) — payload SIEMPRE incluye `correlation_id`

**Consumes events:**
- ninguno directo (es write-only)

**Public API:**
- `logger` (Pino Proxy auto-inject de correlation_id + request_id + tenant_id)
- `incrementCounter(metricName, tags)` — valida contra `METRIC_WHITELIST` runtime
- `auditLog(eventName, payload, severity, piiLevel)` — DEBE invocarse dentro de tx
- `publishRealtimeEvent(channel, event, payload)` — Supabase Realtime

**Private:**
- METRIC_WHITELIST definitions, Pino Proxy internals, Sentry config.

**Reglas operativas:**
- TODO Service usa `logger` en lugar de `console.*`.
- TODO mutation crítica llama `auditLog()` dentro de su tx.
- `incrementCounter()` valida tag_key + tag_value contra whitelist — throw si no autorizado.
- Realtime broadcasts SIEMPRE incluyen `correlation_id` en payload.

---

### Tracing

**Folder:** `src/lib/tracing/`
**Responsabilidad:** AsyncLocalStorage context (correlation_id + request_id + tenant_id + userId), helpers `withServerActionTracing()` / `withWorkerTracing()` / `withCronTracing()`. Bridge Edge Runtime → Node Runtime para correlation propagation.

**Capabilities:** C-OBS-04 (correlation propagation end-to-end).

**Owns tables:**
- ninguna (puramente runtime)

**Publishes events:**
- ninguno

**Consumes events:**
- ninguno

**Public API:**
- `withServerActionTracing(req, fn)`
- `withWorkerTracing(jobType, fn)`
- `withCronTracing(cronName, fn)`
- `getTracingContext() → TracingContext`
- `useOperationCorrelationId(operationKey)` (hook React cliente, ver CORRELATION-PROPAGATION §5)

**Private:**
- AsyncLocalStorage instance singleton, Edge→Node bridge internals.

**Reglas operativas:**
- Middleware Next.js SIEMPRE genera `request_id` por cada HTTP request.
- Workers heredan `correlation_id` de `jobs_queue.correlation_id`; generan nuevo `request_id` propio por attempt.
- Crons sin trigger previo generan nuevo `correlation_id`.

---

### JobsQueue

**Folder:** `src/lib/jobs_queue/`
**Responsabilidad:** enqueue + SKIP LOCKED fetch + retry policy + dead letter. Provee primitivas para que workers dedicados (que viven en sus contexts respectivos: Fiscal, Notifications, etc.) procesen jobs.

**Capabilities:** C-PLT-02 (jobs queue con SKIP LOCKED), C-PLT-06 (crons Vercel F0).

**Owns tables:**
- `jobs_queue` (canonical schema EVENT-TAXONOMY §6)

**Publishes events:**
- `jobs.poisoned` (cuando se detecta poison job)
- `jobs.manual_required` (cuando MAX_ATTEMPTS agotado)

**Consumes events:**
- ninguno directo (workers en otros contexts consumen jobs vía fetchNextWithLock)

**Public API:**
- `JobsQueue.enqueue(jobType, payload, tenantId, correlationId)`
- `JobsQueue.fetchNextWithLock(jobType) → Job | null`
- `JobsQueue.markDone(jobId)`
- `JobsQueue.markFailed(jobId, error, shouldRetry)`
- `JobsQueue.markPoisoned(jobId, reason)`

**Private:**
- SKIP LOCKED query internals, retry calculations, poison detection helpers.

**Reglas operativas (EVENT-TAXONOMY §6 J1-J6):**
- **J1:** catálogo CERRADO de 10 job_types (afip.emit_invoice, afip.reconcile_pending, afip.refresh_wsaa_token, afip.refresh_padron, email.send_invoice, email.send_breach_notification, mp.reconcile_webhook, cron.archive_expired_demos, cron.partition_audit_log, cron.cleanup_old_jobs).
- **J2:** worker dedicado por type (no handler genérico). Worker vive en su context dueño (ej: `afip.*` en Fiscal context, `email.*` en Notifications context).
- **J3:** SKIP LOCKED obligatorio.
- **J4:** prohibido fan-out implícito.
- **J5:** `correlation_id` para trazabilidad, NO para state.
- **J6:** eliminación de type requiere PR + audit.

---

### Audit

**Folder:** `src/lib/audit/`
**Responsabilidad:** `audit_log` writes con trigger inmutable + cleanup vía DROP PARTITION.

**Capabilities:** C-OBS-01 (audit_log inmutable).

**Owns tables:**
- `audit_log` partitioned por año

**Publishes events:**
- ninguno (es persistencia pura, no publica)

**Consumes events:**
- ninguno (recibe writes vía Public API directa)

**Public API:**
- `auditLog(...)` (re-exportado vía Observability para uso conveniente)
- `dropPartitionWithVerification(year)` (usado solo por cron de cleanup)

**Private:**
- Trigger definitions, partition management internals.

**Reglas operativas:**
- INSERT-only strict.
- Trigger throw en UPDATE/DELETE.
- Cleanup: cron diciembre crea partition next year + cron enero drop partition con > 10 años (con verificación previa).
- Cleanup deja audit propio de la operación de cleanup.

---

### Security

**Folder:** `src/lib/security/`
**Responsabilidad:** rate limiting, HMAC validation, replay protection, secret vault, CSP middleware.

**Capabilities:** C-PLT-04 (secret management por tenant encrypted), C-PLT-05 (webhooks HMAC + replay + dedup) — coordinada con Integrations que recibe webhooks.

**Sub-folders:**
- `src/lib/security/rate_limit.ts`
- `src/lib/security/hmac.ts`
- `src/lib/security/vault.ts` — encryption versioning
- `src/lib/security/middleware.ts` — CSP + headers

**Owns tables:**
- ninguna (env vars + Supabase Storage encrypted)

**Publishes events:**
- `security.rate_limit_hit`
- `security.hmac_validation_failed`
- `security.webhook_replay_detected`

**Consumes events:**
- ninguno

**Public API:**
- `rateLimitCheck(key, limit)`
- `validateHmacSignature(body, signature, secret)`
- `vault.get(tenantId, secretKey) → DecryptedSecret`
- `vault.put(tenantId, secretKey, value)`

**Private:**
- AES-256-GCM internals, key rotation logic, CSP nonce generation.

**Reglas operativas:**
- TODO endpoint público con rate limit.
- TODO endpoint autenticado con rate limit per tenant.
- TODO webhook entrante valida HMAC + timestamp ±5min + dedup por event_id.
- Cliente NUNCA accede a `vault.*` directamente — services lo usan en boundary.

---

## Reglas absolutas de Bounded Contexts

### R1 — Context boundary inviolable

Un context NUNCA importa de internals de otro context. Solo de su Public API.

```ts
// ❌ MAL
import { processWSFEv1Response } from 'src/lib/fiscal/projection/wsfev1';

// ✅ BIEN
import { FiscalService } from 'src/lib/fiscal/services/FiscalService';
```

### R2 — Tablas tienen UN dueño

Cada tabla tiene UN context que la posee (CRUD). Otros contexts LEEN vía Public API del owner, NUNCA escriben directo.

### R3 — Snapshots para inmutabilidad cross-context

Cuando context A necesita datos de context B en un momento (ej: customer al momento de venta), copia el snapshot en su propia tabla. NO depende de cambios en B después.

### R4 — Eventos para comunicación entre contexts

Si A necesita reaccionar a algo en B, B emite evento canónico, A se suscribe vía worker o trigger. NO llamadas directas que crean acoplamiento temporal.

### R5 — Layering claro

- Presentation → Core → Supporting → Platform
- NUNCA al revés
- NUNCA circular

### R6 — Public API explícita

Cada context tiene `src/lib/{context}/index.ts` que exporta SOLO lo público. Internals no se re-exportan.

### R7 — Tests por context

Cada context tiene tests dentro de su folder. Tests integration cross-context viven en `tests/integration/`.

### R8 — Ownership de migraciones

Quien posee tablas posee migraciones de esas tablas. PR que modifica `products` debe estar en Inventory context.

---

## Anti-patterns prohibidos

| Anti-pattern | Por qué malo | Qué hacer |
|---|---|---|
| **Importar `src/lib/fiscal/projection/*` desde Sales** | Acoplamiento al shape WSFEv1 | Usar `FiscalService.emitInvoice()` |
| **UPDATE en `products` desde Sales** | Cross-context table write | `InventoryService.adjustStock()` |
| **Helper `src/lib/utils/*` con lógica de dominio** | Context boundary borroso | Mover al context correcto |
| **Importar de `src/lib/sales/internal/*`** | Violación R1 | Pedir feature en public API |
| **Service que muta tablas de 3 contexts en 1 tx** | God Service | Descomponer + emitir eventos |
| **`src/lib/shared/customer.ts`** | Customer ambiguo | Identity.Customer vs Sales.CustomerSnapshot vs Fiscal.CustomerSnapshot |
| **Test de Sales que usa schema de Fiscal** | Test acoplado | Mock FiscalService public API |

---

## Cómo agregar context nuevo

1. **Justificar:** ¿realmente es contexto separado o feature dentro de uno existente?
2. **Documentar acá** siguiendo template.
3. **Crear folder `src/lib/{nuevo}/`** con `index.ts` público.
4. **Crear tabla(s)** owned con migration.
5. **Tests dentro del folder.**
6. **Actualizar CLAUDE.md §6** si cambia layering.
7. **Actualizar este doc** mapa visual.

---

## Cómo dividir context que crece demasiado

Síntomas:
- Folder con > 30 archivos
- Public API con > 20 funciones
- Tests > 1000 líneas

Acción:
- Identificar sub-responsabilidades distintas
- Extraer sub-context con boundaries claros
- Actualizar mapa visual + dependencias
- Migrar incremental con flag

---

## Estado real al 2026-05-28

Todos los contexts están **🟡 documentados sin código**. La estructura de carpetas + public APIs servirá de scaffold cuando arranque setup técnico WSL.

---

## Tabla aclaratoria: "Customer" en 3 contextos

| Context | Tipo | Mutabilidad | Tabla / estructura | Owner |
|---|---|---|---|---|
| **Identity** | `Customer` (entidad mutable) | CRUD permitido | `customers` (tabla owned) | Identity context |
| **Sales** | `CustomerSnapshot` (al carrito + venta) | INMUTABLE post-cobro | embebido en `sale_items` payload | Sales context |
| **Fiscal** | `CustomerSnapshot` (al CAE) | INMUTABLE post-emisión | embebido en `fiscal_snapshots.payload` | Fiscal context |

NO confundir. Identity owns la mutación. Sales/Fiscal copian snapshots inmutables al momento.

---

## Cross-references

- [CAPABILITY-MAP.md](CAPABILITY-MAP.md) — qué hace cada context desde perspectiva de capability
- [CLAUDE.md §6.3](CLAUDE.md) — layering general
- [CLAUDE.md §6.4](CLAUDE.md) — reglas de separación absolutas
- [CLAUDE.md §7](CLAUDE.md) — Multi-Tenant Constitution
- [CLAUDE.md §8](CLAUDE.md) — Fiscal Constitution
- [EVENT-TAXONOMY.md](EVENT-TAXONOMY.md) — eventos canónicos publicados/consumidos
- [OPERATIONAL-SEVERITY.md](OPERATIONAL-SEVERITY.md) — severidad por evento dominio
- [NON-GOALS.md](NON-GOALS.md) — lo que NO debe meter ningún context
- [DECISION-LEDGER.md](DECISION-LEDGER.md) — autoridad

---

*BOUNDED-CONTEXTS.md v1.0.0 — 2026-05-28. Es supervivencia arquitectónica, no ceremonia DDD.*
