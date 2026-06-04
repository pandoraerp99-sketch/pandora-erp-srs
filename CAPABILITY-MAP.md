# CAPABILITY-MAP.md — Pandora ERP

**Versión:** 1.0.0
**Fecha:** 2026-05-28
**Estado:** vigente
**Propósito:** mapa formal de las **capabilities** (capacidades funcionales) que Pandora ofrece, separadas por **dominio**, con ownership, dependencias y madurez F0/F1/F2.

> Capability = lo que Pandora HACE desde la perspectiva del usuario (vender, facturar, conciliar, auditar).
> Dominio = en qué territorio funcional vive esa capability (comercial, fiscal, operacional, plataforma).
>
> Este doc NO define cómo se implementa (eso es [BOUNDED-CONTEXTS.md](BOUNDED-CONTEXTS.md)). Define QUÉ se hace y QUIÉN es responsable.

---

## Por qué este documento existe

Sin separación clara de capabilities:
- Reuniones discuten 5 cosas a la vez sin saberlo
- Features se acoplan accidentalmente entre dominios
- Ownership ambiguo → bugs sin dueño
- Roadmap mezcla dominios → priorización imposible
- Onboarding nuevo dev = caos

Con separación clara:
- Cada capability tiene un dominio + ownership claro
- Dependencias explícitas
- Roadmap por dominio
- Análisis de impacto antes de cambios
- Discusiones acotadas

---

## Estructura

Toda capability tiene:

| Campo | Definición |
|---|---|
| **ID** | `C-{DOMINIO}-NN` |
| **Nombre** | Frase corta y operativa |
| **Dominio** | Comercial / Fiscal / Operacional / Plataforma / Identidad / Observabilidad |
| **Madurez F0** | Required / Optional / Deferred |
| **Madurez F1+** | Si cambia post-F0 |
| **Owner técnico** | Pandora team (sin equipo dedicado F0 — owner default es Agus) |
| **Depende de** | Otras capabilities que deben existir primero |
| **Cubierto por ADR / spec** | Referencias normativas |
| **Estado real** | 🟢 implementado / 🟡 documentado sin código / 🔴 abierto |

---

## DOMINIO COMERCIAL

Capacidades de venta y catálogo. Lo que el comerciante usa para vender.

### C-COM-01 — Carrito de venta POS

**Madurez F0:** Required.
**Owner:** Pandora team.
**Depende de:** C-COM-02 (catálogo), C-IDE-01 (auth).
**Cubierto por:** SRS v3.0 capítulo "POS Premium", §14 CLAUDE.md.
**Estado:** 🟡 documentado sin código.

Cajero arma un carrito agregando productos (búsqueda por nombre / código de barras), aplica descuentos por línea o globales, asocia (opcional) un cliente, calcula totales con `Decimal.js` (preview client-side), navega 100% keyboard-first (atajos F1-F12 + Enter/Esc).

### C-COM-02 — Catálogo de productos

**Madurez F0:** Required.
**Owner:** Pandora team.
**Depende de:** C-IDE-01.
**Cubierto por:** SRS v3.0, ADR-0022 (`products.tdf_exempt`).
**Estado:** 🟡 documentado sin código.

CRUD productos: nombre, código interno, código de barras opcional, precio venta, stock actual, stock mínimo (alerta), `tdf_exempt` (default false), categoría opcional. Sin variantes / sin atributos complejos F0.

### C-COM-03 — Búsqueda de productos en POS

**Madurez F0:** Required.
**Owner:** Pandora team.
**Depende de:** C-COM-02.
**Estado:** 🟡 documentado sin código.

Búsqueda por nombre (typeahead), código de barras (Enter directo), código interno. Resultados < 100ms. Index Postgres trigram + composite.

> **Nota:** Capability previa C-COM-04 "Gestión de clientes" se reasignó al dominio Identidad como **C-IDE-07** (corrección 2026-05-28 — la tabla `customers` es OWNED por Identity context, ver BOUNDED-CONTEXTS).

### C-COM-05 — Aplicación de descuentos

**Madurez F0:** Required.
**Owner:** Pandora team.
**Depende de:** C-COM-01.
**Cubierto por:** ADR-0005 (orden cálculo).
**Estado:** 🟡 documentado sin código.

Descuento por línea (% o $) + descuento global (% o $). Orden de cálculo determinístico: línea primero → subtotales → global. Recalcula IVA per-line según política rounding stage (ver MONEY-POLICY).

### C-COM-06 — Cobro en POS (efectivo + tarjeta + MP QR)

**Madurez F0:** Required.
**Owner:** Pandora team.
**Depende de:** C-COM-01, C-OPS-01 (caja abierta).
**Cubierto por:** SRS v3.0, ADR-0010 (idempotency).
**Estado:** 🟡 documentado sin código.

Cajero confirma cobro: selecciona forma de pago (efectivo / tarjeta debito / tarjeta crédito / MercadoPago QR), recibe vuelto si efectivo, espera confirmación MP (timeout 30s) si QR. Idempotency obligatorio.

### C-COM-07 — Catálogo de precios variables (lista de precios)

**Madurez F0:** Deferred a F1.
**Owner:** Pandora team.
**Trigger:** primer cliente con 2+ listas de precios reales.

Sin múltiples listas F0. Un precio por producto.

### C-COM-08 — Variantes de producto (talle/color)

**Madurez F0:** Deferred a F1.
**Trigger:** primer cliente con mercería o indumentaria que lo pida.

---

## DOMINIO FISCAL

Capacidades de facturación electrónica AFIP y compliance fiscal AR.

### C-FIS-01 — Emisión de factura electrónica WSFEv1

**Madurez F0:** Required.
**Owner:** Pandora team.
**Depende de:** C-FIS-02 (numeración), C-FIS-03 (snapshot), C-FIS-04 (WSAA), C-COM-06 (cobro).
**Cubierto por:** ADR-0004, ADR-0022, RECONCILIATION-ENGINE.
**Estado:** 🟡 documentado sin código.

Solicita CAE a AFIP vía WSFEv1 sincrónico (timeout 30s). Persiste XML respuesta inmutable. Sale → `fiscal_status` transitions según RECONCILIATION-ENGINE.

### C-FIS-02 — Numeración fiscal correlativa con lock pesimista

**Madurez F0:** Required.
**Owner:** Pandora team.
**Depende de:** Drizzle schema.
**Cubierto por:** ADR-0006 (SELECT FOR UPDATE), ADR-0011 (retry serializable).
**Estado:** 🟡 documentado sin código.

`invoice_sequences (tenant_id, sale_point, invoice_type, next_number)` con SELECT FOR UPDATE en transacción serializable. Números quemados NUNCA se reutilizan.

### C-FIS-03 — Fiscal Snapshot inmutable

**Madurez F0:** Required.
**Owner:** Pandora team.
**Cubierto por:** ADR-0022 (base) + **ADR-0023 (ampliación 2026-06-02)**, §8.2 CLAUDE.md.
**Estado:** 🟡 documentado sin código.

Cada factura emitida persiste snapshot completo. **Campos del snapshot tras ADR-0023:**

- Versioning: `calculation_engine_version`, `tax_policy_version` (convención `ar-YYYY-MM-vN` + archivo Git inmutable en `tax-policy-versions/` — ver C-FIS-15)
- Cálculo: `rounding_mode`, `rounding_stage`, `iva_rates_applied`, `currency_code`
- Jurisdicción: `jurisdiction_context`, `merchant_special_regime`, `merchant_jurisdiction_province`, `transaction_in_special_zone`
- Breakdown Ley 27.743: `fiscal_breakdown`
- **CondicionIVAReceptor (NUEVO ADR-0023 Decisión 1 — RG 5616/2024):** `condicion_iva_receptor_id` + `condicion_iva_receptor_desc_at_emission` + `condicion_iva_receptor_catalog_version_at_emission`
- **QR fiscal (NUEVO ADR-0023 Decisión 2 — RG 4892/2020):** `qr_version` + `qr_payload_json` (13 campos spec ARCA) + `qr_url_base_at_emission`
- **Tipo de autorización (NUEVO ADR-0023 Decisión 4 — RG 5782/5785/2025):** `authorization_code_type` (`'CAE' | 'CAEA'`)
- WSFEv1: `wsfe_version`, `wsfe_request_payload`, `wsfe_response_raw`

INMUTABLE post-emisión (trigger plpgsql `audit_log_immutable` reaplicado).

### C-FIS-04 — Gestión token WSAA

**Madurez F0:** Required.
**Owner:** Pandora team.
**Depende de:** C-PLT-04 (secret management).
**Cubierto por:** ADR-0019 S5, §17.2 CLAUDE.md.
**Estado:** 🟡 documentado sin código.

Cache token WSAA por tenant (memoria + DB 12h TTL). Worker `afip.refresh_wsaa_token` refresca proactivo. NUNCA loguear token.

### C-FIS-05 — Validación CUIT contra Padrón A5

**Madurez F0:** Required.
**Owner:** Pandora team.
**Cubierto por:** Pendiente A-4 contador (caché policy).
**Estado:** 🟡 documentado sin código.

Cache `padron_a5_cache (cuit, data, fetched_at)`. Caché TTL pendiente confirmación (24h hipótesis). Fail-closed si Padrón dice CUIT inválido (excluyente salvo NC).

### C-FIS-06 — Reconciliación post-timeout AFIP

**Madurez F0:** Required.
**Owner:** Pandora team.
**Depende de:** C-FIS-01, C-PLT-02 (jobs_queue), C-OBS-01 (audit_log).
**Cubierto por:** RECONCILIATION-ENGINE v1.0.0.
**Estado:** 🟡 documentado sin código.

Worker `afip-reconcile-pending` con SKIP LOCKED. Recovery vía `FECompUltimoAutorizado` + `FECompConsultar` + `validateRecoveredCae()`. MAX_ATTEMPTS=24, intervalo 5min, dead letter philosophy.

### C-FIS-07 — Fiscal Projection Layer (WSFEv1)

**Madurez F0:** Required.
**Owner:** Pandora team.
**Cubierto por:** ADR-0022 §8.2 CLAUDE.md.
**Estado:** 🟡 documentado sin código.

Módulo único `src/lib/fiscal/projection/wsfev1.ts`. Proyecta modelo interno per-line → payload AFIP per-bracket. Resto del sistema NO conoce shape WSFEv1.

### C-FIS-08 — FiscalBreakdown (Ley 27.743 Transparencia Fiscal)

**Madurez F0:** Required.
**Owner:** Pandora team.
**Cubierto por:** ADR-0022, §8.6 CLAUDE.md.
**Estado:** 🔴 BLOQUEADO por pregunta A-11 contador (texto literal + estructura visual).

Líneas obligatorias en ticket: Subtotal sin impuestos / IVA / Otros impuestos nacionales indirectos / TOTAL + leyenda "Régimen de Transparencia Fiscal al Consumidor Ley 27.743". Persiste en `fiscal_snapshots.fiscal_breakdown jsonb` inmutable.

### C-FIS-09 — TDF Ley 19.640 amparado

**Madurez F0:** Required.
**Owner:** Pandora team.
**Cubierto por:** ADR-0022 §"Jurisdicción F0".
**Estado:** 🟡 confirmado oficial WSFEv1, pendiente A-10 contador (texto + rubros + default).

`merchant_jurisdiction_province=TIERRA_DEL_FUEGO` + `merchant_special_regime='LEY_19640'` + `products.tdf_exempt`. Operación amparada → `ImpOpEx` header WSFEv1 + condición IVA receptor código 10.

### C-FIS-10 — Modelo "constancia provisoria" post-timeout

**Madurez F0:** Required.
**Owner:** Pandora team.
**Depende de:** C-FIS-06 (reconciliación).
**Cubierto por:** ADR-0004 (parcialmente invalidado por hallazgo oficial 2026-05-27), CLAUDE.md §8.10, `reunion-contador-y-abogado.md` preguntas A-2 + B-6.
**Estado:** 🔴 BLOQUEADO por pregunta A-2 contador + B-6 abogado. Sin decisión NO se puede escribir código de reconciliación productivo.

### C-FIS-11 — Notas de crédito (NC)

**Madurez F0:** Deferred a F1.
**Trigger:** primer cliente real que necesite cancelar venta facturada.

NC requiere lógica adicional (CbteAsoc, validación de fecha original, etc.). Deferido para foco F0.

### C-FIS-12 — WSMTXCA (factura con detalle ítem)

**Madurez F0:** Deferred a F1+.
**Trigger:** primer cliente B2B que requiera detalle de ítem en comprobante (CLAUDE.md §21.2 F1).
**Implementación esperada:** archivo `src/lib/fiscal/projection/wsmtxca.ts` siguiendo patrón ADR-0022. Resto del sistema NO conoce shape WSMTXCA — solo proyección.

### C-FIS-13 — WSFEX (exportación)

**Madurez F0:** Deferred a F2+.
**Trigger:** primer cliente exportador real.

### C-FIS-14 — IIBB liquidación

**Madurez F0:** Deferred a F2+.
**Trigger:** N-MKT-05 (multi-jurisdicción) reabre.

### C-FIS-15 — Reproducibilidad histórica de comprobantes (NUEVA — ADR-0023, 2026-06-02)

**Madurez F0:** Required.
**Owner:** Pandora team.
**Depende de:** C-FIS-03 (snapshot inmutable) + C-FIS-16 (catálogos runtime).
**Cubierto por:** ADR-0023, [tax-policy-versions/ar-2026-06-v1.md](tax-policy-versions/ar-2026-06-v1.md).
**Estado:** 🟡 documentado sin código.

Capacidad de reconstruir un comprobante histórico **bit-perfect** años después de emitido, sin depender de catálogos externos mutables ni ejecución de código Pandora actualizado. Garantizada por:

1. **Snapshot autosuficiente** (C-FIS-03) — datos + descripciones al momento de emitir
2. **Archivos `tax-policy-versions/ar-YYYY-MM-vN.md` inmutables en Git** — perfil normativo activo al momento de emitir, never edit
3. **QR regenerable determinísticamente** — `qr_payload_json` + `qr_url_base_at_emission` permiten regenerar la imagen QR exacta sin imagen persistida
4. **Catálogos versionados con `catalog_version_at_emission`** — hash + timestamp + size de la respuesta ARCA cacheada al momento de emitir

**Caso de uso target:** inspector AFIP a 5-10 años pide la factura del 2026-08-15 → snapshot dice todo, sin necesidad de ejecutar código Pandora ni consultar catálogos externos mutables.

### C-FIS-16 — Catálogos regulatorios runtime (NUEVA — ADR-0025, 2026-06-02)

**Madurez F0:** Required.
**Owner:** Pandora team.
**Depende de:** C-FIS-04 (token WSAA para consumir WS), C-OBS-01 (audit), C-PLT-02 (jobs_queue para cron refresh).
**Cubierto por:** ADR-0025, [WSDL WSFEv1](https://servicios1.afip.gov.ar/wsfev1/service.asmx?WSDL).
**Estado:** 🟡 documentado sin código.

Catálogos AFIP/ARCA consumidos via runtime lookup desde el WS oficial WSFEv1. Pandora NO hardcodea códigos regulatorios. 12 catálogos identificados:

- **F0 críticos (7):** TiposCbte, TiposDoc, TiposIva, TiposConcepto, CondicionIvaReceptor, TiposMonedas, PtosVenta
- **F0 condicional (2):** Actividades (depende A-21 contadora), Cotizacion (F2+ multi-moneda)
- **F1+ con trigger (3):** TiposTributos, TiposPaises, TiposOpcional

Patrón obligatorio: runtime cache + boot validation fail-closed + cron diario refresh + snapshot persiste `catalog_version_at_emission`. Fail-closed: si catálogo F0 crítico no disponible al boot → módulo fiscal NO arranca.

---

## DOMINIO OPERACIONAL

Capacidades de operación diaria del comerciante (caja, stock, cierres).

### C-OPS-01 — Apertura y cierre de caja

**Madurez F0:** Required.
**Owner:** Pandora team.
**Depende de:** C-IDE-01.
**Cubierto por:** SRS v3.0.
**Estado:** 🟡 documentado sin código.

Apertura de turno con saldo inicial. Sólo una `cash_session` abierta por (tenant, sale_point). Cierre con cuenta de caja + conciliación + descuadre permitido (con motivo obligatorio + audit).

### C-OPS-02 — Movimientos de stock por venta

**Madurez F0:** Required.
**Owner:** Pandora team.
**Depende de:** C-COM-06.
**Estado:** 🟡 documentado sin código.

Cada venta cobrada decrementa stock con SELECT FOR UPDATE. `stock_movements` append-only con `movement_type='sale'`. Si stock < cantidad → bloquea venta con UX clara.

### C-OPS-03 — Ajuste manual de stock

**Madurez F0:** Required.
**Owner:** Pandora team.
**Estado:** 🟡 documentado sin código.

Comerciante ajusta stock manual con motivo OBLIGATORIO (recuento físico, rotura, robo, error de carga). Append-only `stock_movements` con `movement_type='adjustment'` + audit.

### C-OPS-04 — Alerta stock mínimo

**Madurez F0:** Required.
**Owner:** Pandora team.
**Estado:** 🟡 documentado sin código.

UI muestra productos con stock < `min_stock`. F0 NO bloquea venta, solo informa visualmente (display-only). F1+: notificación proactiva via C-NTF (Notifications context) consumiendo evento `inventory.low_stock_warning`.

### C-OPS-05 — Compras / ingresos de stock

**Madurez F0:** Required.
**Owner:** Pandora team.
**Estado:** 🟡 documentado sin código.

Ingreso manual básico de mercadería: producto + cantidad + costo opcional. Sin gestión de proveedores compleja F0 (deferred F1+). Append-only `stock_movements` con `movement_type='purchase'`.

### C-OPS-06 — Reporte de ventas diario/mensual

**Madurez F0:** Required.
**Owner:** Pandora team.
**Estado:** 🟡 documentado sin código.

Reporte básico: ventas del día / semana / mes con totales + IVA + descuentos + por forma de pago. Export CSV/Excel.

### C-OPS-07 — Reporte de IVA ventas

**Madurez F0:** Required.
**Owner:** Pandora team.

Sumario IVA por alícuota para que contador haga DDJJ. Formato compatible con AFIP applicativos.

### C-OPS-08 — Vista contador (read-only multi-empresa)

**Madurez F0:** Required.
**Owner:** Pandora team.
**Depende de:** C-IDE-02 (contador JWT array).
**Cubierto por:** ADR-0008.
**Estado:** 🟡 documentado sin código.

Contador entra con su login + ve N empresas que lo invitaron (`company_ids[]` en JWT). Read-only por default. Acceso a reportes operacionales + export.

### C-OPS-09 — Invitación de contador externo

**Madurez F0:** Required.
**Owner:** Pandora team.
**Depende de:** C-IDE-02.

Comerciante invita contador por email. Contador acepta con su login Supabase. Sistema agrega `company_id` al array del contador.

### C-OPS-10 — Devoluciones (parcial sin NC)

**Madurez F0:** Deferred a F1.
**Trigger:** caso real reportado + ADR.

F0: devolución requiere venta cancelada manualmente. NC formal F1+.

### C-OPS-11 — Conciliación bancaria automática

**Madurez F0:** Deferred a F2+.

### C-OPS-12 — Conciliación MercadoPago automática

**Madurez F0:** Required.
**Owner:** Pandora team.
**Depende de:** C-PLT-05 (webhook MP).
**Estado:** 🟡 documentado sin código.

Webhook MP confirma cobro. Worker reconcilia si payment.status cambia post-creación. Conciliación básica F0 (transacción a transacción); conciliación cross-período F1+.

---

## DOMINIO PLATAFORMA

Capacidades de infraestructura, tenants, jobs, configuración.

### C-PLT-01 — Multi-tenant con RLS

**Madurez F0:** Required.
**Owner:** Pandora team.
**Cubierto por:** ADR-0002, §7 CLAUDE.md.
**Estado:** 🟡 documentado sin código.

RLS Postgres con `auth.jwt() ->> 'company_id'`. Service-side validation. Tests cross-tenant obligatorios (T-MT-01 a T-MT-07).

### C-PLT-02 — Jobs queue con SKIP LOCKED

**Madurez F0:** Required.
**Owner:** Pandora team.
**Cubierto por:** EVENT-TAXONOMY §6, RECONCILIATION-ENGINE.
**Estado:** 🟡 documentado sin código.

`jobs_queue` con 10 job_types canónicos. Worker dedicado por type. SKIP LOCKED + retry policy + dead letter.

### C-PLT-03 — Feature flags por tenant

**Madurez F0:** Required.
**Owner:** Pandora team.
**Cubierto por:** ADR-0009.
**Estado:** 🟡 documentado sin código.

`feature_flags (tenant_id, flag_key, enabled, payload jsonb)`. Helper `isEnabled(flagKey, tenantId)` con cache TTL 60s.

### C-PLT-04 — Secret management por tenant (encrypted)

**Madurez F0:** Required.
**Owner:** Pandora team.
**Cubierto por:** ADR-0019 S5 + S5-bis + S13.

Encrypted vault para certificados AFIP X.509 + passwords + keys por tenant. Versioning de encryption keys (`SECRETS_ENCRYPTION_KEY_V*` + `ACTIVE_VERSION`).

### C-PLT-05 — Webhooks entrantes (HMAC + replay + dedup)

**Madurez F0:** Required.
**Owner:** Pandora team.
**Cubierto por:** ADR-0019 S3 + S3-bis.
**Estado:** 🟡 documentado sin código. F0 cubre MercadoPago únicamente.

Pattern estándar: HMAC + timestamp window ±5min + dedup por `event_id` en `processed_webhook_events`.

### C-PLT-06 — Crons (Vercel cron F0)

**Madurez F0:** Required.
**Owner:** Pandora team.

Crons F0: archive expired demos, partition audit_log, cleanup old jobs, refresh padron batch.

### C-PLT-07 — Demo lifecycle

**Madurez F0:** Required.
**Owner:** Pandora team.
**Cubierto por:** ADR-0020.

60 días trial → 22 días read-only → archive día 82. Activación a paid antes del 82.

### C-PLT-08 — Onboarding asistido

**Madurez F0:** Required.
**Owner:** Pandora team.
**Estado:** 🟡 documentado sin código (manual / no automatizado en F0).

F0 son 5 clientes piloto — onboarding asistido manualmente por Pandora team (sin wizard). Self-service onboarding F1+ con métricas que justifiquen (ver NON-GOALS N-BIZ-02).

### C-PLT-09 — Backup + restore mensual test

**Madurez F0:** Required.
**Owner:** Pandora team.
**Cubierto por:** ADR-0019 S14.

Supabase managed backups. Cron mensual: test de restore + alerta si falla.

### C-PLT-10 — Outbox pattern enterprise

**Madurez F0:** Deferred a F1+.
**Trigger:** primer caso real de integración externa reactiva.

F0: audit_log directo en tx de mutación. Sin outbox dedicado.

### C-PLT-11 — Operator dashboard UI

**Madurez F0:** Deferred a F0.5/F1.
**Trigger:** clientes piloto + dolor empírico con queries SQL.

F0: SQL queries Q1-Q4 (RECONCILIATION-ENGINE §11). UI F1+.

---

## DOMINIO IDENTIDAD (auth + permisos)

### C-IDE-01 — Autenticación de usuario

**Madurez F0:** Required.
**Owner:** Pandora team.
**Cubierto por:** ADR-0001 (Supabase Auth), ADR-0019 S12 (session security).
**Estado:** 🟡 documentado sin código.

Supabase Auth + JWT custom (jose) con `tenant_id` + `roles` + `company_ids` (contador). Idle 30min / absolute 12h. Rotation al cambiar password/rol.

### C-IDE-02 — Contador multi-empresa (JWT array)

**Madurez F0:** Required.
**Cubierto por:** ADR-0008, §7.3 CLAUDE.md.

JWT contador contiene `company_ids: ['uuid1', 'uuid2']`. RLS usa `company_id = ANY(...)`.

### C-IDE-03 — Permisos básicos (RBAC simple)

**Madurez F0:** Required.
**Owner:** Pandora team.

Roles F0: owner / cashier / accountant. Permisos por rol hardcoded F0. RBAC granular F1+.

### C-IDE-04 — Support impersonation

**Madurez F0:** Required.
**Cubierto por:** §7.8 CLAUDE.md.

Flag `support_mode` + audit obligatorio + sesión 2h + read-only por default + mutations requieren consentimiento explícito comerciante.

### C-IDE-05 — Password reset

**Madurez F0:** Required.
**Owner:** Pandora team.
**Depende de:** C-NTF-01 (email transaccional).

Reset password vía email Supabase Auth standard flow.

### C-IDE-06 — 2FA / MFA

**Madurez F0:** Deferred a F1.
**Trigger:** cliente B2B grande que lo exija.

### C-IDE-07 — Gestión de customers del comerciante (clientes finales)

**Madurez F0:** Required.
**Owner:** Pandora team.
**Depende de:** C-IDE-01.
**Cubierto por:** SRS v3.0, Sesión 5 v4 cambio #3 (customer snapshot inmutable), BOUNDED-CONTEXTS Identity context.
**Estado:** 🟡 documentado sin código.

CRUD customers (clientes finales del comerciante): razón social / nombre, DocTipo + DocNro (CUIT/DNI), email, teléfono, condición IVA, dirección fiscal (opcional según A-3 contador). Tabla `customers` owned por Identity context. Customer snapshot al momento de venta es INMUTABLE post-facturación y vive en Sales/Fiscal contexts (NO mutable allí).

**Aclaración cross-context:** "Customer" en Identity = entidad mutable. "Customer snapshot" en Sales/Fiscal = copia inmutable momento-emisión. NO confundir (BOUNDED-CONTEXTS Identity anti-acoplamiento).

---

## DOMINIO OBSERVABILIDAD

### C-OBS-01 — audit_log inmutable

**Madurez F0:** Required.
**Owner:** Pandora team.
**Cubierto por:** EVENT-TAXONOMY §5.
**Estado:** 🟡 documentado sin código.

Particionado por año. Trigger INSERT-only. Cleanup vía DROP PARTITION (no DELETE).

### C-OBS-02 — Pino structured logs

**Madurez F0:** Required.
**Owner:** Pandora team.
**Cubierto por:** §10.5 CLAUDE.md.

Logger Proxy auto-inject `correlation_id` + `request_id` + `tenant_id` desde AsyncLocalStorage. Secret list canónica (NUNCA loguear).

### C-OBS-03 — Métricas con whitelist

**Madurez F0:** Required.
**Owner:** Pandora team.
**Cubierto por:** EVENT-TAXONOMY §7.

`metrics_counter` con `METRIC_WHITELIST` en código TS. `incrementCounter()` valida runtime. Cron mensual detecta cardinality drift.

### C-OBS-04 — Correlation propagation end-to-end

**Madurez F0:** Required.
**Owner:** Pandora team.
**Cubierto por:** CORRELATION-PROPAGATION v1.0.0.

2 IDs canónicos (`correlation_id` + `request_id`). AsyncLocalStorage Node + headers Edge + bridge.

### C-OBS-05 — Realtime broadcasts

**Madurez F0:** Required.
**Owner:** Pandora team.
**Depende de:** C-PLT-01.

Supabase Realtime canal por tenant. Payload incluye `correlation_id` para filtrado cliente.

### C-OBS-06 — Sentry instrumentación

**Madurez F0:** Required.
**Madurez F1+:** Expandida.
**Owner:** Pandora team.
**Estado:** 🟡 documentado sin código.

F0: capture de errors + fatal (instrumentación básica). F1+: instrumentación profunda con tracing.

### C-OBS-07 — Operator queries Q1-Q4

**Madurez F0:** Required.
**Owner:** Pandora team.
**Cubierto por:** RECONCILIATION-ENGINE §11.

4 queries SQL: active reconciliations, dead jobs, poison events, investigation por correlation_id.

---

## DOMINIO COMUNICACIÓN

### C-NTF-01 — Email transaccional (factura emitida)

**Madurez F0:** Required.
**Owner:** Pandora team.

Worker `email.send_invoice` envía PDF de factura al cliente final post-CAE.

### C-NTF-02 — Email demo expirando

**Madurez F0:** Required.
**Cubierto por:** ADR-0020.

### C-NTF-03 — Email breach notification

**Madurez F0:** Required.
**Owner:** Pandora team.
**Cubierto por:** ADR-0019 S11, runbook `RUNBOOKS/breach-notification.md`, pendiente B-3 abogado (plazo + formato exacto AAIP).
**Estado:** 🟡 documentado sin código (template + flow, plazo pendiente abogado).

### C-NTF-04 — SMS / WhatsApp

**Madurez F0:** Deferred a F1.

---

## DOMINIO INTEGRACIONES EXTERNAS

### C-INT-01 — AFIP WSAA + WSFEv1 + Padrón A5

Ver C-FIS-01, C-FIS-04, C-FIS-05.

### C-INT-02 — MercadoPago (cobro POS + webhook)

**Madurez F0:** Required.
**Owner:** Pandora team.
**Cubierto por:** §17.3 CLAUDE.md.

Checkout Pro / QR estático + webhook con HMAC + dedup.

### C-INT-03 — Email provider (Resend o equivalente)

**Madurez F0:** Required (provider TBD).
**Owner:** Pandora team.

### C-INT-04 — Mercado Libre / Tiendanube (lectura inventario)

**Madurez F0:** Deferred a F2+.
**Trigger:** N-MKT-03 caveat F2+.

### C-INT-05 — APIs públicas Pandora (para terceros)

**Madurez F0:** Deferred a F2+.

---

## Resumen por dominio (recalculado tras reasignación C-COM-04 → C-IDE-07)

| Dominio | Capabilities F0 | Capabilities deferred | Total |
|---|---|---|---|
| Comercial | 5 (C-COM-01, 02, 03, 05, 06) | 2 (C-COM-07, 08) | 7 |
| Fiscal | 10 (C-FIS-01..10, dos 🔴 bloqueadas) | 4 (C-FIS-11..14) | 14 |
| Operacional | 10 (C-OPS-01..09, C-OPS-12) | 2 (C-OPS-10, 11) | 12 |
| Plataforma | 9 (C-PLT-01..09) | 2 (C-PLT-10, 11) | 11 |
| Identidad | 6 (C-IDE-01..05, 07) | 1 (C-IDE-06) | 7 |
| Observabilidad | 7 (C-OBS-01..07) | 0 | 7 |
| Comunicación (Notifications) | 3 (C-NTF-01..03) | 1 (C-NTF-04) | 4 |
| Integraciones | 2 (C-INT-02, 03; C-INT-01 compartida con Fiscal) | 2 (C-INT-04, 05) | 4 |
| **TOTAL** | **52** | **14** | **66** |

52 capabilities F0 con ownership único (Pandora team) y dependencies trazables. **2 capabilities 🔴 BLOQUEADAS:** C-FIS-08 (Ley 27.743) + C-FIS-10 (constancia provisoria).

---

## Estado real al 2026-05-28

- **🟢 implementadas:** 0 (sin código productivo todavía)
- **🟡 documentadas sin código:** todas excepto las 🔴
- **🔴 bloqueadas:** 2 (C-FIS-08 Ley 27.743 + C-FIS-10 constancia provisoria)

Lo bloqueado requiere reuniones contador / abogado antes de código.

---

## Cross-references

- [BOUNDED-CONTEXTS.md](BOUNDED-CONTEXTS.md) — cómo se implementan estas capabilities (contextos + carpetas + ownership de datos)
- [CLAUDE.md §5.2](CLAUDE.md) — "Qué entra en F0"
- [NON-GOALS.md](NON-GOALS.md) — qué NO está acá y por qué
- [DECISION-LEDGER.md](DECISION-LEDGER.md) — autoridad
- [backlog-validaciones.md](backlog-validaciones.md) — items deferred con triggers

---

## Mantenimiento

- **Cuando se agregue capability nueva:** asignar ID + dominio + madurez + dependencies + cubrir con ADR si arquitectura.
- **Cuando se promueva capability deferred:** mover Madurez F1 → F0 con trigger documentado.
- **Trimestralmente:** revisar estado real vs implementación.

---

*CAPABILITY-MAP.md v1.0.0 — 2026-05-28*
