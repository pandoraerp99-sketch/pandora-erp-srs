# PANDORA ERP — SRS v3.0
## Software Requirements Specification — Versión Definitiva

**Versión:** 3.0
**Fecha:** 18 mayo 2026
**Estado:** Aprobado para implementación
**Autor:** Owner técnico (Pandora ERP)
**Reemplaza:** v2.0-OMN

---

## Notas de versión

Este documento es la versión definitiva del SRS de Pandora ERP. Integra:

- **v2.0-OMN** (base original)
- **Sesión 1** — 10 fixes quirúrgicos + Sección 14 UX Operacional completa
- **Sesión 2** — Sección 13 Observabilidad operativa + 9 máquinas de estado faltantes
- **Sesión 3** — 8 ambigüedades resueltas + 11 ADRs técnicos + Sección 4 Dominios expandida
- **Sesión 3.5** — 10 correcciones de auditoría externa primera pasada
- **Sesión 3.5.2** — 4 refinements de auditoría segunda pasada
- **Sesión 3.7** — Sistema visual completo (3 atmospheres) + 6 ADRs visuales

**Total:** 17 ADRs formales (archivos separados en `adr/`), 12 máquinas de estado completas, 13 dominios definidos, 3 atmospheres visuales, sistema completo de observabilidad y UX operacional.

---

## Marcado de validación

A lo largo de este documento, las secciones están marcadas con:

- 🟢 **VERDE:** Técnico/operacional, alta confianza, listo para implementar
- 🟡 **AMARILLO:** Requiere validación de contador, abogado, o entrevistas a clientes antes de producción
- 🔴 **ROJO:** Decisión pendiente del owner

**Validaciones humanas críticas pendientes antes de producción real:**

⚠️ Con contador advisor:
- Política de venta válida sin factura tras 2h de reconciliation_timeout
- Esquema de retención de XML AFIP 10 años
- Motivos obligatorios fiscales en operaciones destructivas
- Redondeo exacto que AFIP espera (half-up, half-even)
- Customer snapshot: campos obligatorios para AFIP en cada tipo de comprobante
- Revalidación de CUIT en hot path de facturación

⚠️ Con abogado:
- Audit_log con cierre estricto cumple Ley 11.683
- Política delete company con 7 días de delay
- Privacidad de exports de datos personales
- Compliance con Ley 25.326 sobre datos en logs
- Terms & Conditions con limitación de responsabilidad
- Inscripción AAIP obligatoria
- DPAs (Data Processing Agreements) con cada cliente

⚠️ Con clientes reales (primeros 5):
- Validación de pricing $25k/$60k ARS
- Validación de UX operacional en POS
- Validación de timeline de suspensión por impago
- Validación de sonido/notificaciones en local comercial real

---

## Índice

1. [Visión y propósito](#1-visión-y-propósito)
2. [Alcance del producto](#2-alcance-del-producto)
3. [Modelo de datos conceptual](#3-modelo-de-datos-conceptual)
4. [Dominios del sistema](#4-dominios-del-sistema)
5. [Multi-tenancy](#5-multi-tenancy)
6. [Identity y autorización](#6-identity-y-autorización)
7. [Customers (clientes del comerciante)](#7-customers)
8. [Catalog e inventory](#8-catalog-e-inventory)
9. [Sales, orders y pagos](#9-sales-orders-y-pagos)
10. [Cash (turnos y arqueo)](#10-cash)
11. [Fiscal: AFIP/ARCA](#11-fiscal-afip-arca)
12. [Notifications](#12-notifications)
13. [Observabilidad operativa](#13-observabilidad-operativa)
14. [UX operacional](#14-ux-operacional)
15. [Visual system: 3 atmospheres](#15-visual-system)
16. [Máquinas de estado](#16-máquinas-de-estado)
17. [Riesgos estructurales](#17-riesgos-estructurales)
18. [Roadmap por fases](#18-roadmap-por-fases)
19. [Decisiones de NO hacer](#19-decisiones-de-no-hacer)
20. [Apéndices](#20-apéndices)

---

# 1. Visión y propósito

🟢 **VERDE**

## 1.1 Qué es Pandora ERP

Pandora ERP es un SaaS POS+ERP fiscal para comercios pequeños argentinos (kioscos, mercerías, panaderías, ferreterías, indumentaria, almacenes). Reemplaza la combinación actual de "Excel + facturador gratuito AFIP RCEL" por una plataforma integrada que el comerciante usa 8-12 horas diarias.

**Diferenciadores clave:**

1. **POS premium real**, no un facturador con vista de venta. UX comparable a Square, Toast, Lightspeed.
2. **Contador integrado gratuito**: cada cliente del SaaS invita a su contador, el contador accede a múltiples empresas con un solo login.
3. **AFIP/ARCA nativo** desde día 1, no como add-on. Con tolerancia a fallos de AFIP (ticket no fiscal + reconciliación async).
4. **Identidad visual distintiva** (Dawn Sky + glass + motion philosophy) que diferencia inmediatamente de Tango, Bejerman, Holistor (todos visualmente arcaicos).
5. **Pricing local y predecible** ajustado trimestralmente por IPC INDEC.

## 1.2 Target de mercado

**Mercado total:** ~300.000 comercios argentinos que hoy usan Excel + AFIP RCEL.

**Perfiles target Fase 0:**

| Perfil | Pricing target | Volumen/día | Características |
|---|---|---|---|
| **A — Kiosco** | $25.000 ARS/mes | 100-300 ventas | Bajo ticket promedio, alta frecuencia, 12-18h operación |
| **B — Mercería/Bazar** | $60.000 ARS/mes | 30-80 ventas | Ticket medio, productos con variantes (color/talle), inventario complejo |

**Perfiles target Fase 1+:**

- Panaderías (alta frecuencia, productos perecederos)
- Ferreterías (catálogo grande, ticket medio)
- Indumentaria (variantes color/talle, temporadas)
- Almacenes (ticket alto, fiados, clientes recurrentes)
- Gastronomía simple (Fase 2+, requiere features específicas)

## 1.3 Objetivos comerciales por fase

🟡 **AMARILLO** — Metas comerciales sin validación de mercado real. Marcadas como aspiracionales, no compromiso.

**Fase 0 (semanas 1-16):**
- 5 clientes pagando
- ARR objetivo: $1.5M-3M ARS (~$1.5K-3K USD MRR a TC mayo 2026)
- Validación de pricing real con clientes

**Fase 1 (semanas 17-28):**
- 30-50 clientes activos
- ARR: $5M-12M ARS
- Contador como canal de adquisición validado

**Fase 2 (semanas 29-44):**
- 200 clientes activos
- ARR: $25M-50M ARS
- Omnicanal (WhatsApp/Instagram) operativo

**Fase 3 (mes 10-18):**
- 500-1000 clientes
- ARR: $60M-120M ARS
- Marketplace de módulos internos

**Fase 4 (mes 18-24):**
- 2000+ clientes
- ARR: $150M+ ARS
- Programa de partners externos

**Fase 5 (mes 24+, aspiracional):**
- 5000+ clientes
- Multi-país (UY, CL, MX evaluación)
- Trigger de Serie A si justifica

**Nota inflacionaria:** Todas las metas en ARS son referenciales al tipo de cambio de mayo 2026. Se ajustan trimestralmente con IPC INDEC. Las metas reales se trackean en USD MRR equivalente.

## 1.4 Antivisión (lo que Pandora NO va a ser)

**No va a ser:**
- Un Excel mejorado
- Un facturador AFIP genérico
- Un POS minimalista sin ERP
- Un ERP corporativo (SAP, Oracle, Holistor enterprise)
- Una plataforma de e-commerce (Shopify, Tiendanube)
- Un software de contabilidad (Tango, Bejerman, Holistor)
- Un sistema gastronómico especializado (Fase 0-2)
- Multi-país desde día 1
- Un producto white-label genérico

**No va a tener:**
- Apps móviles nativas (Fase 0-3)
- Marketplace externo abierto (Fase 0-3)
- Customización visual por usuario individual
- Plugin/extensiones de terceros sin review
- Integraciones con sistemas legacy bajo demanda
- Soporte 24/7 humano en Fase 0-1
- SLA contractuales con garantías de uptime hasta Fase 2+

## 1.5 Principios fundamentales

🟢 **VERDE**

**Filosofía de producto:**

1. **POS antes que ERP:** la venta diaria es el corazón. Todo lo demás (stock, clientes, reportes) sirve a la venta.
2. **Comerciante antes que contador:** el comerciante paga, el contador entra gratis. Toda decisión de producto se evalúa primero por su impacto en el comerciante.
3. **Velocidad antes que features:** una operación rápida y confiable vale más que diez features extras lentas.
4. **Fiscal real antes que estética:** lo que va al AFIP es sagrado. Cualquier feature visual cede ante claridad fiscal.
5. **Mantenibilidad antes que escala prematura:** monolito modular en 1-2 devs, no microservicios en 5 devs.
6. **Stack pequeño y vertical:** una sola línea (Next.js + Supabase + Drizzle), no diversidad por diversidad.

**Filosofía de arquitectura:**

1. **Multi-tenant con defensa en profundidad** (Application Service + RLS con auth.jwt()).
2. **Audit todo lo crítico, dentro de transacción** (sin operación sin audit, sin audit sin operación).
3. **Idempotencia obligatoria** en mutaciones públicas.
4. **Snapshots inmutables** en datos fiscales/contables (cliente al momento de venta, condición IVA al abrir turno).
5. **Retry serializable con backoff** en hot path (conflictos 40001/40P01 son normales bajo carga).
6. **Observabilidad operativa desde día 1** (logs estructurados + métricas de negocio + alertas con destinos concretos).
7. **AFIP sincrónico con timeout + reconciliación async** (mejor UX que async total).
8. **Mantenibilidad sobre cleverness** (TypeScript strict, sin plpgsql para lógica de negocio).

---

# 2. Alcance del producto

🟢 **VERDE**

## 2.1 Funcionalidades Fase 0 (obligatorias)

**Operación de venta:**
- POS con keyboard-first y atajos F1-F12
- Venta con múltiples items, variantes simples (Fase 0 sin matriz de variantes)
- Pagos mixtos (efectivo + tarjeta + transferencia + MP)
- Facturación AFIP automática (A/B/C según condición IVA del cliente)
- Ticket no fiscal cuando AFIP no responde
- Reimpresión de tickets del turno actual

**Gestión:**
- Productos con SKU, barcode, categoría, precio, IVA, stock
- Clientes con CUIT, condición IVA, datos fiscales
- Caja: apertura con monto inicial, cierre con arqueo, cierre forzado configurable
- Stock con movimientos auditados (entrada, salida, ajuste, transferencia básica)
- Reportes básicos: ventas del día, ventas del turno, stock crítico

**Administración:**
- Onboarding wizard de 3 pasos (registro → datos → AFIP opcional)
- Modo demo con 14 días + 7 de extensión + bloqueo
- Múltiples usuarios con roles (owner, admin, cashier, viewer)
- Acceso de contador gratuito multi-empresa
- Audit log inmutable de operaciones críticas

**Integraciones:**
- AFIP WSFEv1 + WSAA (facturación electrónica)
- Padrón AFIP A5 (validación de CUIT)
- MercadoPago (cobro presencial + suscripción Pandora)
- Resend (emails transaccionales)
- Twilio (SMS para alertas críticas owner)

**No incluido en Fase 0:**

| Feature | Fase planificada |
|---|---|
| Múltiples sucursales operativas | F1 |
| Múltiples depósitos | F1 |
| Compras / órdenes de compra | F1 |
| Notas de crédito (NC) | F1 |
| Notas de débito | F2 |
| Cuenta corriente de clientes | F1 |
| Variantes complejas (matriz color/talle) | F1 |
| WhatsApp Business API | F1 (opcional) |
| Omnicanal completo (Instagram, web) | F2 |
| Modo offline POS | F2 |
| Conciliación bancaria (CSV) | F2 |
| BI/Analytics avanzado | F3 |
| Módulos verticales (gastronomía, etc.) | F3 |
| Marketplace de módulos internos | F3 |
| Programa de partners externos | F4 |
| API pública para integraciones | F4 |
| Multi-país | F5 |

## 2.2 Stack tecnológico cerrado

🟢 **VERDE** — Decisiones formalizadas en ADR-0001.

**Frontend:**
- Next.js 14 App Router
- TypeScript strict mode
- Tailwind CSS
- shadcn/ui (primitives) + extensiones propias (Surface, GlassCard, etc.)

**Backend:**
- Supabase managed (PostgreSQL 16 + Auth + Storage)
- Drizzle ORM (NUNCA plpgsql para lógica de negocio — ver ADR-0003)
- Application Services en TypeScript con transacciones serializables

**Async:**
- Fase 0: jobs en proceso Next.js (background queue Postgres simple)
- Fase 1+: Worker Node.js en Railway + BullMQ sobre Upstash Redis

**Deploy:**
- Vercel para app
- Railway para worker (Fase 1+)
- Upstash Redis para BullMQ
- Supabase Storage para PDFs y archivos

**Integraciones externas:**
- AFIP/ARCA WSFEv1 + WSAA (SOAP, sincrónico, timeout 30s)
- Padrón AFIP A5 (cache 7 días con revalidación en hot path si > 24h)
- MercadoPago Webhooks + API
- Resend para email
- Twilio para SMS
- WhatsApp Business Cloud API (Fase 1+)

**Tests:**
- Vitest (unit + integration)
- Tests cross-tenant obligatorios
- Tests de concurrencia con isolation level
- Playwright para E2E (Fase 1+)

---

# 3. Modelo de datos conceptual

🟢 **VERDE**

## 3.1 Entidades principales

**Tenancy:**
- `companies` — empresa cliente (tenant)
- `branches` — sucursal (1 default en F0)
- `sale_points` — punto de venta fiscal AFIP
- `cash_registers` — caja física
- `terminals` — dispositivo (POS terminal)
- `company_settings` — configuración por tenant

**Identity:**
- `profiles` — usuario (vinculado a Supabase Auth)
- `accountant_companies` — vínculos contador ↔ empresas autorizadas
- `user_invitations` — invitaciones pendientes

**Catalog:**
- `products` — producto vendible
- `categories` — categoría jerárquica
- `product_variants` — variantes simples F0 / matriz F1+
- `iva_rates` — alícuotas AFIP (referencia estática)

**Inventory:**
- `warehouses` — depósito (1 default en F0)
- `stock` — denormalización de cantidad por (producto, depósito)
- `stock_movements` — append-only de cambios
- `stock_reservations` — reservas blandas F2+

**Customers:**
- `customers` — cliente del comerciante
- `customer_credit_account` — cuenta corriente F1+
- `customer_addresses` — direcciones F1+

**Sales:**
- `sales` — venta (con `customer_snapshot` inmutable)
- `sale_items` — items de la venta
- `sale_payments` — pagos aplicados
- `orders` — pedido omnicanal F2+
- `order_items` — items del pedido

**Cash:**
- `cash_sessions` — turno (con `tenant_fiscal_snapshot` inmutable)
- `cash_movements` — append-only de movimientos

**Fiscal:**
- `afip_invoices` — comprobante emitido (con `customer_snapshot` inmutable)
- `invoice_sequences` — secuencias correlativas por (sale_point, invoice_type)
- `afip_certificates` — certificados X.509
- `afip_tokens` — tokens WSAA con TTL

**Billing:**
- `subscriptions` — suscripción Pandora del comerciante
- `subscription_payments` — pagos a Pandora
- `plans` — planes disponibles

**Notifications:**
- `notifications` — log de envíos
- `notification_templates` — plantillas por tipo

**Integrations:**
- `external_integrations` — configuración por tenant por servicio
- `webhook_events` — log de webhooks inbound/outbound
- `webhook_endpoints` — endpoints registrados F3+

**Audit:**
- `audit_log` — append-only, write-only server-side
- `idempotency_log` — UUIDs de operaciones idempotentes (hot 90 días)
- `idempotency_log_archive_index` — índice de keys archivadas

**Background:**
- `jobs_queue` — cola de jobs F0
- `import_jobs` — jobs de importación masiva
- `export_jobs` — jobs de exportación

**Features:**
- `tenant_features` — feature flags por tenant en JSONB

## 3.2 Reglas absolutas del modelo

🟢 **VERDE** — Estas reglas son no negociables y se aplican en DB con constraints.

**Inmutabilidad histórica:**
- Toda factura emitida es inmutable. Modificación = nueva factura o NC.
- `audit_log` no permite UPDATE ni DELETE.
- `stock_movements` es append-only. Corrección = nuevo movimiento inverso.
- `cash_movements` es append-only.
- `idempotency_log` es append-only.

**Snapshots inmutables:**
- `sales.customer_snapshot` NOT NULL — datos del cliente al momento de la venta.
- `afip_invoices.customer_snapshot` con constraint estructural.
- `cash_sessions.tenant_fiscal_snapshot` NOT NULL — condición fiscal del tenant al abrir turno.

**Multi-tenancy:**
- Toda tabla con datos de tenant tiene `company_id uuid NOT NULL`.
- Toda tabla con `company_id` tiene RLS habilitado con policy basada en `auth.jwt()`.
- Constraint adicional: validación en Application Service como primera barrera.

**Numeración fiscal:**
- `invoice_sequences` con `last_number int NOT NULL`.
- Reserva atómica con `SELECT FOR UPDATE` + transacción serializable.
- Números quemados NUNCA se reutilizan.

**Soft delete:**
- Todas las entidades con relevancia histórica usan `deleted_at timestamptz`.
- Eliminación física solo permitida después de 90 días post-suspensión definitiva.

## 3.3 Constraints clave

```sql
-- Audit log: write-only server-side
REVOKE ALL ON audit_log FROM authenticated;
REVOKE UPDATE, DELETE, TRUNCATE ON audit_log FROM service_role;
GRANT INSERT ON audit_log TO service_role;

-- Reason obligatorio en operaciones destructivas
ALTER TABLE audit_log ADD CONSTRAINT reason_required_for_destructive
CHECK (
  action NOT IN (
    'sale.cancelled', 'sale.refunded',
    'stock.negative_override',
    'cash_session.closed_with_difference', 'cash_session.force_closing_reverted',
    'customer.deleted', 'customer.iva_condition_changed',
    'product.deleted', 'product.price_changed',
    'user.role_changed', 'user.deactivated',
    'accountant.revoked',
    'company.deleted', 'company.iva_condition_changed',
    'subscription.suspended',
    'fiscal_config.modified',
    'support.impersonation_started',
    'import.rolled_back'
  ) OR reason IS NOT NULL
);

-- Customer snapshot inmutable y estructural
ALTER TABLE sales ALTER COLUMN customer_snapshot SET NOT NULL;
ALTER TABLE sales ADD CONSTRAINT customer_snapshot_structure_valid
CHECK (
  customer_snapshot ? 'name'
  AND customer_snapshot ? 'iva_condition'
  AND customer_snapshot ? 'captured_at'
);

-- Invoice customer snapshot estricto
ALTER TABLE afip_invoices ADD CONSTRAINT invoice_customer_snapshot_not_empty
CHECK (
  customer_snapshot != '{}'::jsonb
  AND customer_snapshot ? 'legal_name'
  AND customer_snapshot ? 'iva_condition'
  AND customer_snapshot ? 'captured_at'
);

-- Cash session tenant fiscal snapshot
ALTER TABLE cash_sessions ALTER COLUMN tenant_fiscal_snapshot SET NOT NULL;
ALTER TABLE cash_sessions ADD CONSTRAINT tenant_fiscal_snapshot_structure_valid
CHECK (
  tenant_fiscal_snapshot ? 'iva_condition'
  AND tenant_fiscal_snapshot ? 'cuit'
  AND tenant_fiscal_snapshot ? 'captured_at'
);

-- Stock movement con motivo si genera negativo
ALTER TABLE stock_movements ADD CONSTRAINT negative_override_requires_reason
CHECK (
  resulting_quantity >= 0
  OR negative_stock_override_reason IS NOT NULL
);

-- Cash session: solo 1 abierto por caja
CREATE UNIQUE INDEX cash_session_one_open_per_register
ON cash_sessions(cash_register_id)
WHERE status = 'open';

-- Idempotency: unique por tenant + key
ALTER TABLE idempotency_log ADD CONSTRAINT unique_idempotency_per_tenant
UNIQUE (company_id, idempotency_key);
```

---

# 4. Dominios del sistema

🟢 **VERDE**

## 4.1 Filosofía de bounded contexts

Pandora se organiza en dominios funcionales con responsabilidades claras y fronteras explícitas. Cada dominio tiene un owner único (módulo de código), entidades propias, eventos emitidos/consumidos, dependencias declaradas.

**Regla absoluta:** Dominio A nunca toca tablas de Dominio B directamente. La comunicación ocurre vía Application Services o eventos internos.

## 4.2 Inventario de dominios

| Dominio | Código | Fase | Entidades principales |
|---|---|---|---|
| **Tenancy** | `src/lib/services/tenancy/` | F0 | companies, branches, sale_points, terminals |
| **Identity** | `src/lib/services/identity/` | F0 | profiles, accountant_companies |
| **Catalog** | `src/lib/services/catalog/` | F0 | products, categories, variants (F1) |
| **Inventory** | `src/lib/services/inventory/` | F0 | warehouses, stock, stock_movements |
| **Customers** | `src/lib/services/customers/` | F0 | customers |
| **Sales** | `src/lib/services/sales/` | F0 | sales, sale_items, sale_payments, orders (F2) |
| **Cash** | `src/lib/services/cash/` | F0 | cash_registers, cash_sessions, cash_movements |
| **Fiscal** | `src/lib/services/fiscal/` | F0 | afip_invoices, invoice_sequences, certificates |
| **Suppliers** | `src/lib/services/suppliers/` | F1 | suppliers, purchases |
| **Expenses** | `src/lib/services/expenses/` | F1 | expenses |
| **Accounting** | `src/lib/services/accounting/` | F1/F2 | ledger_entries (F2 completo) |
| **Notifications** | `src/lib/services/notifications/` | F0 | notifications, templates |
| **Integrations** | `src/lib/services/integrations/` | F0 | external_integrations, webhook_events |
| **Audit** | `src/lib/services/audit/` | F0 | audit_log, idempotency_log |
| **Billing** | `src/lib/services/billing/` | F0 | subscriptions, payments_to_pandora |
| **Reports** | `src/lib/services/reports/` | F0/F1 | export_jobs |
| **Imports** | `src/lib/services/imports/` | F0 | import_jobs |
| **Background** | `src/lib/services/background/` | F0 | jobs_queue |
| **Features** | `src/lib/services/features/` | F0 | tenant_features |

## 4.3 Mapa de dependencias permitidas

| Dominio | Puede leer de | Puede llamar a | Emite eventos para |
|---|---|---|---|
| Tenancy | — | — | Identity, Fiscal |
| Identity | Tenancy | — | Todos |
| Catalog | Tenancy | — | Sales, Inventory, Reports |
| Inventory | Catalog, Tenancy | Catalog | Sales, Reports |
| Customers | Tenancy | Integrations | Sales, Fiscal, Notifications |
| Sales | Catalog, Inventory, Customers, Tenancy | Catalog, Inventory, Customers, Cash, Fiscal | Inventory, Cash, Fiscal, Notifications, Audit |
| Cash | Tenancy, Identity | — | Sales, Reports, Notifications, Audit |
| Fiscal | Tenancy, Customers, Sales | Integrations | Sales, Notifications, Audit |
| Notifications | Todos (read-only) | Integrations | Audit |
| Integrations | Tenancy | External APIs | Todos |
| Audit | Todos (read-only) | — | — |
| Billing | Tenancy | Integrations, Identity | Notifications, Audit |
| Background | Todos | Todos | Audit |

**Si un dominio quiere cruzar una frontera no permitida, es señal de bug arquitectónico.** Debe pasar por refactor o por eventos.

## 4.4 Eventos críticos del sistema

**Sales:**
- `sales.sale.draft_created`
- `sales.sale.pending_payment`
- `sales.sale.completed` ⭐ (dispara cadena: stock, cash, fiscal, notifications)
- `sales.sale.cancelled`
- `sales.sale.refunded` (F1+)
- `sales.invoice_requested`

**Fiscal:**
- `fiscal.invoice.requested`
- `fiscal.invoice.number_reserved`
- `fiscal.invoice.afip_sent`
- `fiscal.invoice.issued` ⭐
- `fiscal.invoice.failed`
- `fiscal.invoice.timeout`
- `fiscal.invoice.reconciled`
- `fiscal.invoice.burned`
- `fiscal.invoice.reconciliation_timeout`
- `fiscal.certificate.expiring`

**Cash:**
- `cash.session.opened`
- `cash.session.closing`
- `cash.session.closed`
- `cash.session.closed_with_difference`
- `cash.session.force_closed`
- `cash.session.force_closing_reverted`
- `cash.movement.created`

**Inventory:**
- `inventory.stock.adjusted`
- `inventory.stock.critical`
- `inventory.stock.exhausted`
- `inventory.reservation.created` (F2+)
- `inventory.reservation.released` (F2+)
- `inventory.reservation.expired` (F2+)

**Identity:**
- `identity.user.invited`
- `identity.user.activated`
- `identity.user.role_changed`
- `identity.accountant.invited`
- `identity.accountant.revoked`

**Billing:**
- `billing.subscription.payment_due`
- `billing.subscription.grace_period_entered`
- `billing.subscription.reading_mode_entered`
- `billing.subscription.suspended`
- `billing.subscription.reactivated`

## 4.5 Reglas de cross-domain communication

1. **Domain A nunca lee directamente tablas de Domain B.** Si Sales necesita info de Customer, llama a `customersService.getById()`.

2. **Eventos son fire-and-forget en F0-F2.** No hay garantía de orden ni de entrega exactamente una vez. Sí hay idempotencia en handlers.

3. **Transacciones cross-domain:** dentro de una transacción Drizzle se pueden usar tablas de múltiples dominios SI son operaciones que deben ser atómicas (ej: completar venta + descontar stock + insertar cash_movement). El Application Service de Sales orquesta esto.

4. **Eventos son async cuando posible.** Una venta no espera a que la notification se envíe. La factura SÍ se espera (sincrónica).

5. **Audit dentro de transacción** (ver ADR-0011): toda operación que muta datos críticos ejecuta el audit log dentro de la misma transacción de negocio.

6. **El test cross-tenant DEBE pasar** sin excepción para cada PR que toque dominios con `company_id`.

---

# 5. Multi-tenancy

🟢 **VERDE** — Decisión formalizada en ADR-0002.

## 5.1 Modelo: shared DB + shared schema + RLS

Toda tabla con datos de tenant tiene `company_id uuid NOT NULL` con FK a `companies(id)`.

RLS habilitado en todas las tablas con `company_id`, con policy basada en `auth.jwt()`:

```sql
CREATE POLICY tenant_isolation ON sales
  USING (company_id = (auth.jwt() ->> 'company_id')::uuid);
```

**NUNCA usar `current_setting('app.company_id')`** — no sobrevive a pooling Supavisor.

## 5.2 Defensa en profundidad

Dos capas de aislamiento independientes:

1. **Application Service** (TypeScript): valida `companyId` del JWT contra `companyId` del recurso antes de operar.
2. **RLS PostgreSQL**: red de seguridad. Si el Service tiene bug, RLS bloquea cross-tenant leak.

Tests obligatorios en CI:
- Test que simula reasignación de conexión bajo carga.
- Test cross-tenant en cada PR que toque tabla con `company_id`.
- Test de Application Service con userId/companyId mismatched.

## 5.3 Caso especial: contador con multi-empresa

🟢 **VERDE** — Formalizado en ADR-0008.

El rol `accountant` accede a N empresas con un solo login. JWT incluye claim `authorized_companies` como array de UUIDs + `company_id` activo (la empresa seleccionada en sesión).

Schema:

```sql
CREATE TABLE accountant_companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  accountant_id uuid NOT NULL REFERENCES profiles(id),
  company_id uuid NOT NULL REFERENCES companies(id),
  invited_by uuid REFERENCES profiles(id),
  invited_at timestamptz DEFAULT now(),
  revoked_at timestamptz,
  UNIQUE(accountant_id, company_id)
);
```

RLS expandido con EXISTS (sintaxis robusta, ver ADR corregido en Sesión 3.5.2):

```sql
CREATE POLICY accountant_multi_tenant_select ON sales
  FOR SELECT
  USING (
    company_id = (auth.jwt() ->> 'company_id')::uuid
    OR (
      (auth.jwt() ->> 'rol') = 'accountant'
      AND EXISTS (
        SELECT 1
        FROM jsonb_array_elements_text(auth.jwt() -> 'authorized_companies') AS ac(company_id_text)
        WHERE ac.company_id_text = company_id::text
      )
    )
  );
```

Mismo patrón aplicado a: `sales`, `sale_items`, `sale_payments`, `afip_invoices`, `cash_sessions`, `cash_movements`, `stock_movements`, `customers`, `products`, `audit_log`.

## 5.4 Límite operativo

JWT crece con cantidad de empresas autorizadas. Límite ~50 empresas por contador antes de exceder 4KB de header.

Mitigación cuando se acerque: migrar de claim array a lookup en DB con cache.

## 5.5 Niveles de aislamiento

| Nivel | Mecanismo | Garantía |
|---|---|---|
| **Application** | TypeScript validation | Primera barrera, rechaza con 403 |
| **Row-Level** | RLS con auth.jwt() | Postgres rechaza con error |
| **Database** | Schema único | Sin separación física F0 |
| **Storage** | Path por tenant | `/companies/{company_id}/...` |

## 5.6 Protección anti-cross-tenant

```typescript
// Helper obligatorio en Application Services
async function assertTenantMatches(
  resourceCompanyId: string,
  context: RequestContext
): Promise<void> {
  if (resourceCompanyId !== context.companyId 
      && context.userRole !== 'support') {
    logger.fatal({
      attempted: resourceCompanyId,
      actual: context.companyId,
      userId: context.userId,
      correlationId: context.correlationId,
    }, 'CROSS_TENANT_ATTEMPT_BLOCKED');
    
    metrics.increment('cross_tenant_attempt_blocked');
    
    // Freezar al tenant si es repetido (>3 intentos en 5 min)
    await checkAndFreezeIfRepeated(context.userId);
    
    throw new ForbiddenError('CROSS_TENANT_ACCESS_DENIED');
  }
}
```

---

# 6. Identity y autorización

🟢 **VERDE**

## 6.1 Roles del sistema

| Rol | Descripción | Puede facturar | Puede anular | Multi-empresa |
|---|---|---|---|---|
| **owner** | Dueño del comercio | Sí | Sí (todas) | No (1 empresa) |
| **admin** | Administrador del comerciante | Sí | Sí (con motivo) | No |
| **cashier** | Cajero operativo | Sí | Solo propias mismo turno | No |
| **warehouse** | Encargado de stock | No | No | No |
| **viewer** | Solo lectura para auditoría interna | No | No | No |
| **accountant** | Contador externo (gratuito) | No | No | **Sí** (varias empresas) |
| **auditor** | Auditor temporal con expiración | No | No | No (solo lectura) |
| **support** | Soporte Pandora con audit obligatorio | Solo emergencia | Solo emergencia | Cross-tenant |

## 6.2 Permisos por acción

Matriz simplificada (ver detalle completo en Apéndice C):

| Acción | owner | admin | cashier | warehouse | viewer | accountant | auditor |
|---|---|---|---|---|---|---|---|
| Crear venta | ✓ | ✓ | ✓ | — | — | — | — |
| Anular venta < 24h mismo turno | ✓ | ✓ | ✓ propia | — | — | — | — |
| Anular venta cualquiera | ✓ | ✓ con motivo | — | — | — | — | — |
| Crear producto | ✓ | ✓ | — | ✓ | — | — | — |
| Eliminar producto | ✓ | ✓ con motivo | — | — | — | — | — |
| Ajustar stock | ✓ | ✓ | — | ✓ | — | — | — |
| Stock negativo (si tenant lo permite) | ✓ con motivo | ✓ con motivo | — | — | — | — | — |
| Abrir/cerrar turno | ✓ | ✓ | ✓ | — | — | — | — |
| Cierre con descuadre >5% | ✓ | ✓ con motivo | — | — | — | — | — |
| Configurar AFIP | ✓ | — | — | — | — | — | — |
| Cambiar condición IVA | ✓ con motivo | — | — | — | — | — | — |
| Eliminar empresa | ✓ + delay 7d | — | — | — | — | — | — |
| Invitar usuario | ✓ | ✓ | — | — | — | — | — |
| Cambiar rol usuario | ✓ | — | — | — | — | — | — |
| Invitar contador | ✓ | — | — | — | — | — | — |
| Ver audit log | ✓ | ✓ | — | — | — | ✓ propias empresas | ✓ desde access_from |
| Exportar datos | ✓ | ✓ | — | — | — | ✓ propias empresas | — |
| Suplantar tenant | — | — | — | — | — | — | — solo support |

## 6.3 JWT structure

```json
{
  "sub": "uuid del profile",
  "email": "user@example.com",
  "rol": "owner|admin|cashier|warehouse|viewer|accountant|auditor|support",
  "company_id": "uuid empresa activa",
  "authorized_companies": ["uuid1", "uuid2"],
  "auditor_access_from": "2026-05-01T00:00:00Z",
  "auditor_expires_at": "2026-08-01T00:00:00Z",
  "exp": "...",
  "iat": "..."
}
```

`authorized_companies` solo presente si rol = `accountant`.
`auditor_*` solo presente si rol = `auditor`.

## 6.4 Sesiones

- Gestionadas por Supabase Auth.
- Sesión activa max 12 horas en POS, 24 horas en dashboard/contador.
- Refresh token automático antes de expiración si actividad reciente.
- Logout invalida sesión inmediatamente (no espera expiración).

## 6.5 Anti-brute-force

- 5 intentos fallidos en 15 minutos: lockout de 30 minutos.
- Recovery por email con link de un solo uso.
- Audit log de logins fallidos con IP.
- Alerta al owner si hay > 10 intentos fallidos del mismo email en 1 hora.

## 6.6 Rol auditor: detalle

🟢 **VERDE** — Resuelto en Sesión 3.

- **Quién configura:** owner del tenant que invita.
- **Default expiración:** 90 días.
- **Rango permitido:** 7 a 365 días.
- **Acceso:** solo lectura desde `auditor_access_from` hasta `auditor_expires_at`.
- **Renovación:** owner puede extender en cualquier momento.
- **Email:** al auditor 7 días antes y el día de expiración.
- **Caducidad durante sesión:** sesión actual sigue hasta logout (max 24h), después bloqueo.
- **Revocación:** owner puede revocar en cualquier momento, invalidación en próximo request.
- **Audit log:** invitación, extensión, revocación generan entradas con motivo.

## 6.7 Rol support (Pandora interno)

- Cross-tenant access para soporte y debugging.
- Cada acción genera `audit_log` con `metadata.support_ticket_id` obligatorio.
- Suplantación de tenant: requiere ticket de soporte explícito + audit con motivo.
- Sesión de support con auto-logout a 4 horas (no puede quedar logueado indefinidamente).
- Alertas al owner cuando support accede: email "Un agente de Pandora accedió a tu cuenta para resolver el ticket #X".

## 6.8 Baja de usuario

🟢 **VERDE** — Resuelto en Sesión 1 con política soft delete + historia visible.

Cuando un usuario es desactivado (`profiles.active = false` o eliminación lógica):

- **Turno abierto:** queda en `pending_deactivation`. No puede iniciar sesión nueva. El turno permanece abierto y debe cerrarse por owner/admin antes de completar baja.
- **Ventas en `pending_payment`:** se transfieren automáticamente al admin que ejecuta la baja, con audit.
- **Ventas en `draft`:** se descartan automáticamente (no afectan stock ni caja).
- **Movimientos de stock pendientes:** se mantienen con el `user_id` original (histórico inmutable).
- **Histórico:** `user_id` en `sales` queda intacto referencial. `profiles` con `active=false, deleted_at=timestamp`.
- **Nunca DELETE físico** de profiles. Histórico siempre muestra "Usuario eliminado" si la baja fue posterior a la operación.

---

# 7. Customers

🟢 **VERDE** + 🟡 **AMARILLO** (campos fiscales obligatorios pendientes de validación con contador)

## 7.1 Modelo

```typescript
interface Customer {
  id: string;                    // uuid
  companyId: string;             // tenant
  name: string;                  // nombre comercial o de fantasía
  legalName?: string;            // razón social (para facturación A)
  documentType: DocumentType;    // CUIT | CUIL | DNI | CONSUMIDOR_FINAL | OTRO
  documentNumber?: string;
  ivaCondition: IvaCondition;    // RI | MONOTRIBUTO | EXENTO | CONSUMIDOR_FINAL | NO_RESPONSABLE | NO_ALCANZADO
  fiscalAddress?: string;
  phone?: string;
  email?: string;
  active: boolean;
  deletedAt?: Date;
  padronLastValidatedAt?: Date;  // cache de validación A5
  padronStatus?: 'valid' | 'inactive' | 'pending';
  createdAt: Date;
  updatedAt: Date;
}
```

## 7.2 Cliente "Consumidor Final" default

Cada tenant tiene un cliente "Consumidor Final" creado automáticamente al crear la empresa. No se puede eliminar. Es el default de cualquier venta sin cliente identificado.

```sql
-- Trigger al crear company
INSERT INTO customers (company_id, name, document_type, iva_condition, active)
VALUES ($company_id, 'Consumidor Final', 'CONSUMIDOR_FINAL', 'consumidor_final', true);
```

## 7.3 Validación contra Padrón AFIP A5

🟢 **VERDE** — Política definida + revalidación en hot path (Sesión 3.5).

**Al crear/actualizar cliente con CUIT:**
- Validación async contra Padrón A5.
- Cache 7 días en `padronLastValidatedAt`.
- Status: `valid`, `inactive`, `pending`.

**Revalidación en hot path de facturación:**

Antes de cada emisión, si `padronLastValidatedAt > 24 horas`:
- Llamar Padrón A5 sincrónicamente (timeout 3s).
- Si responde: actualizar customer con datos frescos.
- Si CUIT inactivo o condición IVA cambió: bloquear emisión, alertar al cajero.
- Si Padrón timeout: política configurable (default: proceder con cache + log warn).

```sql
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS
  fiscal_padron_revalidation_required boolean NOT NULL DEFAULT true,
  fiscal_padron_revalidation_max_age_hours int NOT NULL DEFAULT 24,
  fiscal_padron_timeout_policy text NOT NULL DEFAULT 'proceed_with_cache'
    CHECK (fiscal_padron_timeout_policy IN ('proceed_with_cache', 'block_emission'));
```

## 7.4 Customer snapshot inmutable

🟢 **VERDE** — Crítico, formalizado en Sesión 3.5 + refinado en 3.5.2.

**Regla absoluta:** El histórico de ventas y facturas **nunca** se reescribe.

Cuando un cliente se elimina (soft delete):
- `customers.active = false`, `customers.deleted_at = now()`.
- Ventas y facturas históricas **mantienen** el `customer_id` original como FK.
- Ventas y facturas históricas **mantienen** el `customer_snapshot` inmutable.
- UI muestra en histórico: nombre original + badge "(eliminado)".
- Nuevas ventas no pueden seleccionar este cliente.

**Schema sales:**

```sql
ALTER TABLE sales ADD COLUMN customer_snapshot jsonb;
-- backfill ...
ALTER TABLE sales ALTER COLUMN customer_snapshot SET NOT NULL;
ALTER TABLE sales ADD CONSTRAINT customer_snapshot_structure_valid
  CHECK (
    customer_snapshot ? 'name'
    AND customer_snapshot ? 'iva_condition'
    AND customer_snapshot ? 'captured_at'
  );
```

**Captura en SaleService.create():**

```typescript
const customerSnapshot = customer ? {
  name: customer.name,
  document_type: customer.document_type,
  document_number: customer.document_number,
  iva_condition: customer.iva_condition,
  fiscal_address: customer.fiscal_address,
  phone: customer.phone,
  email: customer.email,
  captured_at: new Date().toISOString(),
} : {
  name: 'Consumidor Final',
  document_type: 'CONSUMIDOR_FINAL',
  document_number: null,
  iva_condition: 'consumidor_final',
  fiscal_address: null,
  phone: null,
  email: null,
  captured_at: new Date().toISOString(),
};
```

## 7.5 Cambio de condición IVA

🟡 **AMARILLO** — Requiere validación contable.

Cuando un cliente cambia de condición IVA (ej: pasa de RI a Monotributo):
- Cambio permitido solo por admin/owner.
- Motivo obligatorio en `audit_log`.
- Ventas futuras usan la nueva condición.
- Ventas históricas mantienen el `customer_snapshot` con condición original.
- NCs futuras sobre facturas anteriores: usan condición de la factura original (snapshot).

**Pregunta abierta:** ¿AFIP requiere comunicación específica cuando un cliente cambia de condición? Validar con contador.

## 7.6 Deduplicación

Al crear cliente con CUIT o DNI:
- Buscar duplicados por `(company_id, document_type, document_number)`.
- Si existe: proponer merge al usuario.
- Si el usuario confirma merge: ventas históricas del duplicado se mantienen con su `customer_id` original (no se reasignan). El cliente "ganador" recibe los datos de contacto del duplicado.

## 7.7 Cuenta corriente (Fase 1+)

Pospuesta a Fase 1. Estructura preparada:

```sql
CREATE TABLE customer_credit_account (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id),
  customer_id uuid NOT NULL REFERENCES customers(id),
  balance numeric(19,4) NOT NULL DEFAULT 0,
  credit_limit numeric(19,4) NOT NULL DEFAULT 0,
  enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

**Decisión Fase 1:** ajuste por inflación opcional (CER, IPC, USD).

---

*[Sesión 4 — Parte 1 de 5 — Continúa en parte 2]*
# 8. Catalog e Inventory

🟢 **VERDE**

## 8.1 Catalog: productos y categorías

**Modelo:**

```typescript
interface Product {
  id: string;
  companyId: string;
  sku?: string;                  // único por tenant
  barcode?: string;              // único por tenant
  name: string;
  description?: string;
  categoryId?: string;
  price: number;                 // numeric(19,4)
  ivaRateId: string;             // FK a iva_rates
  active: boolean;
  trackStock: boolean;           // default true
  minStock?: number;             // alerta de stock crítico
  imageUrl?: string;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface Category {
  id: string;
  companyId: string;
  name: string;
  parentId?: string;             // jerárquica
  position: number;              // orden visual
  active: boolean;
}
```

**Reglas:**

- SKU único por tenant (`UNIQUE(company_id, sku)` con `WHERE deleted_at IS NULL`).
- Barcode único por tenant.
- Soft delete: producto eliminado no se puede vender pero histórico se preserva.
- Cambio de precio: audit log obligatorio con motivo.
- Cambio de IVA rate: audit log obligatorio + alerta al owner ("Cambiaste el IVA del producto X, esto afecta cómo se factura").

## 8.2 Productos demo por rubro

🟢 **VERDE** — Onboarding facilitado.

Al crear tenant + elegir rubro, se cargan 20-30 productos demo:

| Rubro | Productos demo |
|---|---|
| Kiosco | Coca-Cola 500ml, Gaseosa marca propia, Cigarrillos Marlboro, Cigarrillos Philip Morris, Chicles Beldent, Caramelos surtidos, Galletitas Oreo, Galletitas Pepitos, Alfajor Jorgito, Mantecol, Snack Lays, Tarjeta SUBE recarga, Carga celular Movistar, etc. |
| Mercería | Hilo de coser blanco, Hilo de coser negro, Aguja N°8, Cierre 20cm, Botón nacarado, Cinta de medir, Tijera de modista, Almohadilla, Tiza de sastre, Velcro adhesivo, etc. |
| Panadería | Pan flauta, Pan miñón, Facturas surtidas, Medialunas dulces, Medialunas saladas, Bizcochos, Tortas pequeñas, Pan dulce, Galletitas surtidas, etc. |
| Ferretería | Tornillos varios, Clavos varios, Pegamento universal, Cinta aisladora, Llave inglesa 8", Destornillador Phillips, Martillo, Sierra manual, etc. |

El comerciante puede editar precios, eliminar, o agregar más. Los productos demo son punto de partida, no obligatorios.

## 8.3 Variantes simples (Fase 0)

Fase 0 soporta variantes simples (color o talle, no matriz):

```typescript
interface ProductVariant {
  id: string;
  productId: string;
  name: string;                  // "Rojo", "M", etc.
  sku?: string;                  // override SKU base
  priceModifier?: number;        // delta sobre precio base
  active: boolean;
}
```

**Fase 1+:** variantes en matriz (color × talle). Schema preparado pero sin lógica completa.

## 8.4 Inventory: stock y movimientos

🟢 **VERDE** — Append-only, append-only, append-only.

**Modelo:**

```typescript
interface Stock {
  productId: string;             // PK compuesto (productId, warehouseId)
  warehouseId: string;
  quantity: number;              // denormalización
  reservedQuantity: number;      // sumatoria de stock_reservations activas (F2+)
  availableQuantity: number;     // quantity - reservedQuantity (computed)
  lastMovementAt: Date;
}

interface StockMovement {
  id: bigint;                    // bigserial
  companyId: string;
  warehouseId: string;
  productId: string;
  movementType: MovementType;    // 'sale' | 'purchase' | 'adjustment' | 'transfer_out' | 'transfer_in' | 'initial' | 'cancellation_reverse'
  quantity: number;              // positivo o negativo
  resultingQuantity: number;     // stock después del movimiento
  saleId?: string;               // si proviene de venta
  cancellationOfMovementId?: bigint;  // si es reverso de cancelación
  userId?: string;
  reason?: string;               // obligatorio en adjustments
  negativeStockOverrideReason?: string;
  metadata: jsonb;
  createdAt: Date;               // append-only, NUNCA UPDATE
}
```

**Reglas absolutas:**

- `stock_movements` es **append-only**. Nunca UPDATE ni DELETE.
- Corrección de movimiento erróneo: nuevo movimiento inverso con `cancellation_of_movement_id`.
- `stock.quantity` es denormalización de `SUM(stock_movements WHERE product_id, warehouse_id)`. Se mantiene por performance pero la verdad está en los movimientos.
- Recálculo periódico (cron diario) que valida que la denormalización coincide con la suma. Si difiere: alerta crítica.

## 8.5 Stock negativo

🟢 **VERDE** — Política definida en Sesión 3.

**Default:** stock negativo bloqueado para todo tenant.

**Activación:**
- Solo owner puede activar (no admin).
- Segunda confirmación + motivo obligatorio en audit_log.

**Operación:**
- Cada venta que genera stock negativo requiere motivo obligatorio en `stock_movements.negative_stock_override_reason`.
- Email automático al owner: "Venta con stock negativo registrada por [usuario] - Producto: X - Cantidad: Y - Motivo: Z".
- Dashboard muestra "Top 5 productos con stock negativo" para revisión.

**Schema:**

```sql
ALTER TABLE company_settings ADD COLUMN
  allow_negative_stock boolean NOT NULL DEFAULT false,
  negative_stock_alert_email text;

ALTER TABLE stock_movements ADD COLUMN
  negative_stock_override_reason text;

ALTER TABLE stock_movements ADD CONSTRAINT
  negative_override_requires_reason
  CHECK (
    resulting_quantity >= 0
    OR negative_stock_override_reason IS NOT NULL
  );
```

## 8.6 Importación CSV de productos

🟢 **VERDE** — Wizard con preview obligatorio (ver máquina de estado SM-09).

**Flujo:**

1. Owner sube CSV.
2. Sistema parsea con auto-detección de encoding (UTF-8, CP1252, ISO-8859-1).
3. Validación row-by-row: SKU único, barcode único, precio > 0, IVA rate válido, categoría existente o auto-crear.
4. Preview con 3 categorías:
   - Verde: filas OK, listas para importar.
   - Amarillo: filas con warnings (ej: precio sospechosamente bajo). Importables con confirmación.
   - Rojo: filas con errores. Requieren corrección de CSV.
5. Owner confirma. Sistema importa filas verdes y amarillas confirmadas en batches de 500.
6. Si error transversal: rollback completo. Si filas individuales fallan: `partial_applied` con reporte.

**TTL del preview:** 24 horas. Después: requiere re-upload.

## 8.7 Stock reservations (Fase 2+)

Para omnicanal (pedido confirmado pero no cobrado todavía):

```typescript
interface StockReservation {
  id: string;
  companyId: string;
  productId: string;
  warehouseId: string;
  quantity: number;
  orderId: string;               // pedido que reserva
  channel: 'pos' | 'whatsapp' | 'instagram' | 'web' | 'phone';
  status: 'active' | 'converted' | 'released' | 'expired';
  expiresAt: Date;
  createdAt: Date;
}
```

**TTL por canal (Fase 2):**
- POS: 60 minutos
- WhatsApp/Instagram: 24 horas (configurable hasta 72h)
- Web: 30 minutos (configurable hasta 24h)
- Marketplace (F3+): según marketplace

**Cron de cleanup:** cada 15 minutos. Reservas expiradas liberan stock y notifican.

---

# 9. Sales, orders y pagos

🟢 **VERDE**

## 9.1 Separación conceptual Order / Sale / Invoice

🟢 **VERDE** — Decisión formalizada en ADR-0015 (parte del v2.0-OMN original).

**Order (Pedido):** intención de compra. Captura demanda. Fase 0: implícito en POS. Fase 2+: explícito en omnicanal.

**Sale (Venta):** transacción completada. Tiene items, pagos, total. Puede o no tener factura.

**Invoice (Factura):** documento fiscal emitido a AFIP. Tiene CAE. Una venta puede tener 0 o 1 factura.

**Por qué la separación importa:**
- Venta puede existir sin factura (ticket no fiscal cuando AFIP no responde).
- Pedido puede existir sin venta (cliente reservó pero no vino).
- Factura puede existir sin reflejarse en venta (NC sobre venta antigua).

## 9.2 Sale model

```typescript
interface Sale {
  id: string;
  companyId: string;
  saleNumber: number;            // correlativo interno por tenant
  cashSessionId: string;         // turno donde se hizo
  branchId: string;
  cashRegisterId: string;
  terminalId: string;
  userId: string;                // cajero
  customerId?: string;           // null = consumidor final
  customerSnapshot: jsonb;       // INMUTABLE, NOT NULL
  status: SaleStatus;
  
  // Totales (numeric 19,4)
  subtotal: number;
  totalDiscounts: number;
  totalTaxes: number;
  total: number;
  
  // Pagos
  totalPaid: number;
  
  // Fiscal
  invoiceRequested: boolean;
  afipInvoiceId?: string;        // FK
  
  // Audit
  cancellationReason?: string;
  refundReason?: string;
  notes?: string;
  channel: 'pos' | 'omnichannel';
  
  createdAt: Date;
  completedAt?: Date;
  cancelledAt?: Date;
}
```

## 9.3 SaleItem model

```typescript
interface SaleItem {
  id: string;
  saleId: string;
  productId: string;
  productSnapshot: jsonb;        // INMUTABLE: name, sku, barcode al momento
  variantId?: string;
  quantity: number;              // numeric 19,4 (permite fracciones para peso)
  unitPrice: number;
  totalDiscount: number;
  ivaRate: number;               // % aplicable
  ivaAmount: number;
  totalAmount: number;
  position: number;              // orden en el ticket
}
```

**Snapshot inmutable de producto:** captura nombre y SKU al momento de venta. Si el producto se renombra después, el ticket histórico mantiene el nombre original.

## 9.4 SalePayment model

```typescript
interface SalePayment {
  id: string;
  saleId: string;
  paymentMethod: PaymentMethod;  // cash | card_present | mp_qr | transfer | check | credit_account
  amount: number;
  status: PaymentStatus;
  externalReference?: string;    // ej: MP operation_id
  metadata: jsonb;
  confirmedAt?: Date;
  createdAt: Date;
}
```

## 9.5 Pagos mixtos

Una venta puede tener N pagos. Suma exacta debe igualar `total`:

```typescript
// Validación en SaleService
const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
if (Math.abs(totalPaid - sale.total) > 0.01) {
  throw new BusinessError('PAYMENTS_DO_NOT_MATCH_TOTAL', `Total: ${sale.total}, Pagado: ${totalPaid}`);
}
```

**Regla:** la diferencia debe ser <= $0.01 ARS (un centavo) por errores de redondeo numéricos.

## 9.6 Flujo de creación de venta

🟢 **VERDE** + ⚠️ retry obligatorio (ADR-0011).

```typescript
async function createSale(input: CreateSaleInput) {
  return withSerializationRetry(
    'sale.create',
    () => executeCreateSaleTransaction(input),
    { correlationId: input.correlationId, companyId: input.companyId }
  );
}

async function executeCreateSaleTransaction(input: CreateSaleInput) {
  return await db.transaction(async (tx) => {
    // 1. Idempotency check
    await checkIdempotency(tx, input.idempotencyKey, input.companyId);
    
    // 2. Validar tenant
    await assertTenantMatches(input.companyId, currentContext);
    
    // 3. Validar shift abierto
    const shift = await tx.query.cashSessions.findFirst({
      where: and(
        eq(cashSessions.id, input.cashSessionId),
        eq(cashSessions.status, 'open')
      )
    });
    if (!shift) throw new BusinessError('NO_OPEN_SHIFT');
    
    // 4. Validar customer si aplica, capturar snapshot
    const customer = input.customerId 
      ? await customersService.getById(tx, input.customerId)
      : null;
    const customerSnapshot = buildCustomerSnapshot(customer);
    
    // 5. Lock y descontar stock (SELECT FOR UPDATE)
    for (const item of input.items) {
      await lockAndDecrementStock(tx, item, shift.tenant_fiscal_snapshot);
    }
    
    // 6. Calcular totales con redondeo half-up
    const totals = calculateTotals(input.items, input.discounts);
    
    // 7. Validar pagos cuadran
    validatePaymentsMatchTotal(input.payments, totals.total);
    
    // 8. Insertar sale
    const [sale] = await tx.insert(sales).values({
      ...sale_fields,
      customer_snapshot: customerSnapshot,
    }).returning();
    
    // 9. Insertar sale_items
    await tx.insert(saleItems).values(items_with_snapshots);
    
    // 10. Insertar payments y cash_movements
    await tx.insert(salePayments).values(input.payments);
    await tx.insert(cashMovements).values(cash_movements_for_each_payment);
    
    // 11. Si invoice requested: llamar FiscalService DENTRO de la misma tx
    if (input.invoiceRequested) {
      const invoice = await fiscalService.issueInvoice(tx, {
        saleId: sale.id,
        customerSnapshot,
        items: items_with_snapshots,
        salePoint: shift.tenant_fiscal_snapshot.sale_point_id,
      });
      sale.afip_invoice_id = invoice.id;
    }
    
    // 12. Audit DENTRO de la transacción (ADR-0011)
    await auditService.log({
      tx,
      companyId: input.companyId,
      userId: input.userId,
      userRole: input.userRole,
      action: 'sale.created',
      entity: 'sale',
      entityId: sale.id,
      changes: { before: null, after: sale },
      metadata: {
        correlationId: input.correlationId,
        ip: input.ip,
        terminalId: input.terminalId,
        branchId: input.branchId,
        channel: input.channel,
      },
    });
    
    // 13. Idempotency log entry
    await tx.insert(idempotencyLog).values({
      company_id: input.companyId,
      idempotency_key: input.idempotencyKey,
      operation: 'sale.create',
      result: { sale_id: sale.id },
      status: 200,
    });
    
    return sale;
  }, { isolationLevel: 'serializable' });
}
```

## 9.7 Anulación de venta

🟢 **VERDE** — Criterio resuelto en Sesión 3.

**Anulación (rollback completo) válida solo si:**
- Está dentro de 24 horas cronológicas desde `sale.completed_at`, **Y**
- El turno donde se hizo la venta sigue abierto.

**Si pasaron 24h o el turno cerró:** requiere Nota de Crédito (Fase 1+), no anulación.

**Permisos:**
- Cashier puede anular propias dentro de mismo turno + 24h.
- Admin/owner pueden anular cualquiera del mismo turno + 24h.

**Side effects de anulación:**
- Stock movement inverso (devuelve stock).
- Cash movement inverso.
- Si factura emitida: bloquear anulación, requerir NC.
- Audit log con motivo obligatorio.

## 9.8 Orders (Fase 2+)

Pedido omnicanal. Modelo preparado:

```typescript
interface Order {
  id: string;
  companyId: string;
  orderNumber: number;
  customerId?: string;
  customerSnapshot: jsonb;       // INMUTABLE
  channel: 'whatsapp' | 'instagram' | 'web' | 'phone';
  status: OrderStatus;
  reservationExpiresAt: Date;
  total: number;
  notes?: string;
  saleId?: string;               // null hasta convertir
  createdAt: Date;
}
```

**TTL por canal** (Sesión 1, Fix 6):
- POS (implícito): 60 min
- WhatsApp/Instagram: 24h
- Web/teléfono: 30 min - 24h configurable

## 9.9 Reservation expires (Fase 2+)

Cron `orders-cleanup` cada 15 minutos:

```sql
UPDATE orders 
SET status = 'expired'
WHERE reservation_expires_at < now() 
AND status = 'confirmed';

-- + liberar stock_reservations asociadas
-- + notification al cliente si tiene email
-- + notification al vendedor que armó pedido
```

---

# 10. Cash

🟢 **VERDE** — Estados completos formalizados en Sesión 2 + unificación en 3.5.

## 10.1 Modelo de turno

```typescript
interface CashSession {
  id: string;
  companyId: string;
  cashRegisterId: string;
  userId: string;                // cajero que abrió
  status: CashSessionStatus;     // ver máquina de estado SM-05
  
  // Apertura
  openedAt: Date;
  initialAmount: number;
  
  // Cierre (si aplica)
  closingStartedAt?: Date;
  closedAt?: Date;
  expectedAmount?: number;       // calculado
  declaredAmount?: number;       // declarado por cajero
  difference?: number;           // declared - expected
  closureReason?: string;
  closedByUserId?: string;
  
  // Force close
  forceClosingStartedAt?: Date;
  forceClosedAt?: Date;
  forceClosingRevertedAt?: Date;
  forceClosingRevertedByUserId?: string;
  forceClosingRevertReason?: string;
  
  // Snapshot fiscal del tenant
  tenantFiscalSnapshot: jsonb;   // INMUTABLE, NOT NULL
  
  notes?: string;
}
```

## 10.2 Snapshot fiscal del tenant

🟢 **VERDE** — Crítico para consistencia fiscal durante el turno (Sesión 3.5).

Al abrir cash_session, capturar:

```json
{
  "iva_condition": "RI",
  "cuit": "30-12345678-9",
  "fiscal_address": "...",
  "sale_point_id": "uuid",
  "sale_point_number": 1,
  "captured_at": "2026-05-18T08:00:00Z",
  "source": "session_open"
}
```

Todas las ventas del turno usan este snapshot, no consultan estado actual del tenant.

**Bloqueo:** owner no puede cambiar condición IVA con turnos abiertos.

```typescript
async function changeIvaCondition(input: ChangeIvaInput) {
  const openSessions = await db.query.cashSessions.findMany({
    where: and(
      eq(cashSessions.companyId, input.companyId),
      eq(cashSessions.status, 'open')
    )
  });
  
  if (openSessions.length > 0) {
    throw new BusinessError(
      'CANNOT_CHANGE_IVA_WITH_OPEN_SESSIONS',
      `No podés cambiar tu condición IVA con turnos abiertos. 
       Cerrá las cajas primero. Turnos abiertos: ${openSessions.length}.`
    );
  }
  
  // Proceder con cambio + audit_log
}
```

## 10.3 Cash movements

```typescript
interface CashMovement {
  id: bigint;
  companyId: string;
  cashSessionId: string;
  movementType: CashMovementType; // 'initial' | 'sale_payment' | 'sale_payment_reverse' | 'expense' | 'adjustment' | 'closing_difference'
  amount: number;
  paymentMethod?: PaymentMethod;
  saleId?: string;
  salePaymentId?: string;
  expenseId?: string;
  reason?: string;
  userId: string;
  createdAt: Date;
}
```

**Append-only.** Corrección = nuevo movimiento inverso.

## 10.4 Cierre forzado

🟢 **VERDE** — Versión unificada (Sesión 3 + 3.5).

**Worker:** `cron-cash-session-force-close`
**Frecuencia:** cada 5 minutos.

**Configuración por tenant:**

```sql
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS
  force_close_hour text NOT NULL DEFAULT '23:59',
  smart_detection_enabled boolean NOT NULL DEFAULT true,
  smart_detection_inactivity_threshold_hours int NOT NULL DEFAULT 2,
  cash_session_no_auto_close boolean NOT NULL DEFAULT false,
  cash_difference_tolerance_percent numeric(5,2) NOT NULL DEFAULT 1.00;
```

**Lógica:**

```
Cada 5 minutos:

Para cada cash_session candidata (status=open, pasada la hora configurada):

  1. Si smart_detection_enabled:
     Verificar actividad en últimas N horas:
     - cash_movements creados
     - sales creados
     
     Si HAY actividad reciente:
       SKIP. Próxima evaluación en 5 min.
  
  2. Marcar status = 'force_closing'
  3. Notificar cashier por email/SMS
  4. Esperar 1 hora de gracia
  
  5. Si cashier respondió (status pasó a closing): flujo normal de cierre.
  6. Si admin/owner revirtió (status volvió a open): audit + reevaluar próximo ciclo.
  7. Si 1 hora sin respuesta: 
     - status = 'force_closed' 
     - calcular expected_amount
     - reporte PDF con disclaimer
     - audit_log
     - notificar owner
```

**Reversión de force_closing:**

| Acción | Quién | Requiere |
|---|---|---|
| `force_closing → open` | admin / owner | Motivo obligatorio |
| `force_closing → closing` | cashier | Continúa como cierre voluntario |
| `force_closing → force_closed` | sistema | 1 hora sin respuesta |

**Excepción:** tenants con `cash_session_no_auto_close = true` quedan completamente fuera del cron. Comercios 24h reales pueden desactivar con audit + advertencia UI.

## 10.5 Tolerancia de descuadre

| Descuadre | Acción |
|---|---|
| <= tolerancia (default 1%) | Cierre normal a `closed` |
| > tolerancia y <= 5% | Requiere motivo, cierra a `closed_with_difference` |
| > 5% | Requiere autorización admin |
| > 10% | Requiere autorización owner |

Tolerancia configurable en `company_settings.cash_difference_tolerance_percent`.

## 10.6 Reportes de turno

Al cerrar turno (cualquier status terminal), generar PDF automático con:

- Período (apertura → cierre)
- Monto inicial
- Ventas totales por método de pago
- Gastos del turno (Fase 1+)
- Anulaciones del turno
- Diferencia (si aplica)
- Items vendidos (resumen top 10)
- Cajero responsable

PDF guardado en Storage con TTL 10 años (fiscal).

---

# 11. Fiscal: AFIP/ARCA

🟢 **VERDE** + 🟡 **AMARILLO** (validación contable pendiente)

## 11.1 Stack fiscal

| Servicio | Uso | Implementación |
|---|---|---|
| **WSAA** | Autenticación con certificado X.509 | Sincrónico, token TTL 12h |
| **WSFEv1** | Facturación electrónica A/B/C | Sincrónico con timeout 30s |
| **WSPN A5 (Padrón)** | Validación CUIT y condición IVA | Cache 7 días + revalidación 24h |
| **WSMTXCA** | Comprobantes especiales | Evaluar en F2, no F0 |

## 11.2 Certificados

```typescript
interface AfipCertificate {
  id: string;
  companyId: string;
  certificatePem: string;        // X.509 encriptado en DB
  privateKeyPem: string;         // RSA encriptada en DB
  cn: string;                    // Common Name del certificado
  issuer: string;
  validFrom: Date;
  validUntil: Date;
  environment: 'homologation' | 'production';
  active: boolean;
  createdAt: Date;
}
```

**Reglas:**

- Solo 1 certificado activo por (company_id, environment) — `UNIQUE constraint`.
- Encriptación at-rest con AES-256 (clave en Supabase Vault).
- Solo owner puede subir/cambiar certificado.
- Audit log al subir/rotar/eliminar.
- Alertas de vencimiento: 30, 15, 7, 3, 1 días antes.

## 11.3 Tokens WSAA

```typescript
interface AfipToken {
  id: string;
  companyId: string;
  service: 'wsfev1' | 'ws_sr_padron_a5' | 'wsmtxca';
  token: string;                 // encriptado
  sign: string;                  // encriptado
  generationTime: Date;
  expirationTime: Date;          // típicamente 12 horas
  environment: 'homologation' | 'production';
}
```

**Reglas:**
- Token reutilizado dentro de TTL para evitar throttling AFIP.
- Refresh automático 30 min antes de expiración.
- Token expirado nunca se intenta usar.

## 11.4 Numeración fiscal correlativa

🟢 **VERDE** — Formalizado en ADR-0006 + retry serializable en ADR-0011.

```typescript
interface InvoiceSequence {
  id: string;
  companyId: string;
  salePointId: string;
  invoiceType: InvoiceType;      // 'A' | 'B' | 'C' | 'M' | etc.
  lastNumber: number;
  updatedAt: Date;
}
```

**Reserva atómica con SELECT FOR UPDATE + transacción serializable:**

```typescript
async function reserveInvoiceNumber(
  tx: Transaction,
  salePointId: string,
  invoiceType: InvoiceType
): Promise<number> {
  const seq = await tx.execute(sql`
    SELECT last_number 
    FROM invoice_sequences 
    WHERE sale_point_id = ${salePointId} 
    AND invoice_type = ${invoiceType}
    FOR UPDATE
  `);
  
  const nextNumber = seq.rows[0].last_number + 1;
  
  await tx.update(invoiceSequences)
    .set({ last_number: nextNumber, updated_at: new Date() })
    .where(and(
      eq(invoiceSequences.salePointId, salePointId),
      eq(invoiceSequences.invoiceType, invoiceType)
    ));
  
  return nextNumber;
}
```

**Números quemados nunca se reutilizan.** Si AFIP rechaza el comprobante, el número queda como `burned`.

## 11.5 Flujo de facturación

🟢 **VERDE** + 🟡 **AMARILLO** (política de "ticket no fiscal válido" pendiente de validación)

```typescript
async function issueInvoice(tx: Transaction, input: IssueInvoiceInput) {
  // 1. Customer snapshot fresh (con revalidación Padrón si > 24h)
  const customerSnapshot = await buildFreshCustomerSnapshot(input.customer);
  
  // 2. Determinar tipo de comprobante según condición IVA del cliente + tenant
  const invoiceType = determineInvoiceType(
    input.tenantIvaCondition,
    customerSnapshot.iva_condition
  );
  
  // 3. Reservar número correlativo
  const number = await reserveInvoiceNumber(tx, input.salePointId, invoiceType);
  
  // 4. Insertar afip_invoice en estado 'pending'
  const [invoice] = await tx.insert(afipInvoices).values({
    company_id: input.companyId,
    sale_id: input.saleId,
    sale_point_id: input.salePointId,
    invoice_type: invoiceType,
    invoice_number: number,
    customer_snapshot: customerSnapshot,
    total: input.total,
    iva_breakdown: input.ivaBreakdown,
    status: 'pending',
    requested_at: new Date(),
  }).returning();
  
  // 5. Llamar AFIP WSFEv1 con timeout 30s
  try {
    const cae = await Promise.race([
      afipClient.requestCAE(invoice, customerSnapshot),
      timeoutAfter(30000),
    ]);
    
    if (cae.success) {
      await tx.update(afipInvoices)
        .set({ 
          status: 'issued',
          cae: cae.cae,
          cae_expiration: cae.expiration,
          afip_response: cae.rawResponse,
          issued_at: new Date(),
        })
        .where(eq(afipInvoices.id, invoice.id));
      return { ...invoice, cae: cae.cae };
    } else {
      // AFIP rechazó: número quemado
      await tx.update(afipInvoices)
        .set({
          status: 'burned',
          afip_error: cae.error,
          afip_response: cae.rawResponse,
        })
        .where(eq(afipInvoices.id, invoice.id));
      throw new BusinessError('AFIP_REJECTED', cae.error);
    }
  } catch (err) {
    if (err.code === 'TIMEOUT') {
      // Timeout: requires_reconciliation
      await tx.update(afipInvoices)
        .set({ 
          status: 'requires_reconciliation',
          timeout_at: new Date(),
          attempts: 0,
        })
        .where(eq(afipInvoices.id, invoice.id));
      
      // Encolar worker de reconciliación
      await scheduleReconciliation(invoice.id);
      
      // Devolver invoice sin CAE — caller debe emitir ticket no fiscal
      return { ...invoice, cae: null, status: 'requires_reconciliation' };
    }
    throw err;
  }
}
```

## 11.6 Reconciliation worker

🟢 **VERDE** — Cadencia definida en Sesión 3.5.

**Worker:** `afip-reconciliation`
**Frecuencia:** cada 5 minutos.

**Por cada `afip_invoice` en `requires_reconciliation`:**

```
1. Verificar attempts < 24
   Si >= 24: → reconciliation_timeout (terminal)
            → audit_log
            → notificación owner

2. Consultar AFIP:
   - FECompUltimoAutorizado para (sale_point, invoice_type)
   - Si último >= número reservado:
     → FECompConsultar(número reservado)
     → Si CAE existe: status = 'issued', save CAE
     → Si rechazo: status = 'burned'
   - Si último < número reservado:
     → AFIP no procesó. Incrementar attempts.

3. Incrementar attempts y next_attempt_at = now() + interval '5 minutes'
```

**Tope temporal duro:** 2 horas = 24 intentos × 5 min.

**Notificaciones intermedias:**
- 30 min: email "Tu factura sigue pendiente, seguimos intentando."
- 1h: email + dashboard banner.
- 2h (terminal): email + alerta visible en POS.

## 11.7 Estados de afip_invoice

Ver máquina de estado completa en Sección 16 (SM-03 Invoice).

Resumen:
- `pending`: insertado, AFIP no contactado todavía
- `issued`: CAE recibido
- `failed`: AFIP rechazó explícitamente
- `requires_reconciliation`: timeout, worker reintenta
- `reconciliation_timeout`: terminal, no se pudo emitir tras 2h
- `burned`: número quemado, NUNCA se reutiliza

## 11.8 Customer snapshot fiscal

🟢 **VERDE** — Crítico (Sesión 3.5).

```sql
ALTER TABLE afip_invoices ADD CONSTRAINT invoice_customer_snapshot_not_empty
CHECK (
  customer_snapshot != '{}'::jsonb
  AND customer_snapshot ? 'legal_name'
  AND customer_snapshot ? 'iva_condition'
  AND customer_snapshot ? 'captured_at'
);
```

**Captura:**

```typescript
const fiscalSnapshot = {
  legal_name: customer.legal_name ?? customer.name,
  document_type: customer.document_type,
  document_number: customer.document_number,
  iva_condition: customer.iva_condition,
  fiscal_address: customer.fiscal_address,
  captured_at: new Date().toISOString(),
  source: padron_fresh ? 'padron_a5_fresh' : 'cache_within_24h',
};
```

## 11.9 Retención de XML

🟡 **AMARILLO** — Política de 10 años, validar con contador.

- XML request/response de cada llamada AFIP persistido.
- Hot storage (DB) 2 años.
- Cold storage (S3 Glacier) años 2-10.
- Cron mensual de archivado.
- Acceso a archivado: async, 24-48h.

## 11.10 Redondeo

🟡 **AMARILLO** — Validar con contador qué política exacta espera AFIP.

**Política propuesta:**

- Cálculos internos: `numeric(19,4)` (ADR-0005).
- Presentación AFIP: redondeo half-up al centavo (2 decimales).
- Cálculo de IVA: redondeo por línea (no solo en total).

```typescript
function roundHalfUp(value: number, decimals: number = 2): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}
```

## 11.11 Tipos de comprobante

Determinación según condición IVA del tenant y del cliente:

| Tenant | Cliente | Comprobante |
|---|---|---|
| RI | RI | A |
| RI | Monotributo | B |
| RI | Consumidor Final | B |
| RI | Exento | B |
| Monotributo | RI | C |
| Monotributo | Monotributo | C |
| Monotributo | Consumidor Final | C |

(Tabla resumida, validar matriz completa con contador.)

## 11.12 Notificaciones operativas de AFIP

🟢 **VERDE** — Sesión 1, Fix 9.

**Cuando venta queda en `requires_reconciliation`:**

1. **Inmediato (toast 5s):** "AFIP no respondió. Ticket no fiscal emitido. La factura saldrá automáticamente."
2. **Dashboard:** panel con sales en `requires_reconciliation`, contador "X intentos, próximo a HH:MM".
3. **Cada 5 min si exitosa:** email + push (F1+): "Tu factura #X salió."
4. **Tras 2h sin éxito:** email + alerta POS: "Contactá a tu contador para gestión manual."

---

# 12. Notifications

🟢 **VERDE**

## 12.1 Stack

| Servicio | Canal | Fase |
|---|---|---|
| Resend | Email | F0 |
| Twilio | SMS | F0 (solo alertas owner) |
| WhatsApp Business Cloud API | WhatsApp | F1+ |
| Push web (Service Workers) | Push browser | F1+ |

## 12.2 Modelo

```typescript
interface Notification {
  id: string;
  companyId: string;
  templateKey: string;
  recipient: string;             // email o teléfono
  recipientUserId?: string;
  channel: 'email' | 'sms' | 'whatsapp' | 'push';
  status: 'pending' | 'sent' | 'delivered' | 'bounced' | 'failed';
  subject?: string;
  bodyData: jsonb;               // variables del template
  externalMessageId?: string;
  sentAt?: Date;
  deliveredAt?: Date;
  failedReason?: string;
  metadata: jsonb;
  createdAt: Date;
}

interface NotificationTemplate {
  key: string;
  channel: 'email' | 'sms' | 'whatsapp' | 'push';
  subject?: string;
  body: string;                  // con placeholders {{var}}
  active: boolean;
}
```

## 12.3 Templates Fase 0

| Key | Canal | Trigger |
|---|---|---|
| `welcome_signup` | email | Usuario crea cuenta |
| `demo_expiring_7d` | email | 7 días antes de fin demo |
| `demo_expiring_1d` | email | Día antes de fin demo |
| `demo_blocked` | email | Demo bloqueado |
| `password_reset` | email | Recuperación contraseña |
| `user_invited` | email | Owner invita usuario |
| `accountant_invited` | email | Owner invita contador |
| `sale_completed_to_customer` | email | Cliente con email recibe ticket digital (opt-in) |
| `daily_summary_owner` | email | Resumen diario al owner 23:00 |
| `cash_session_closed_with_difference` | email | Cierre con descuadre > tolerancia |
| `afip_invoice_reconciled` | email | Factura reconciliada exitosa |
| `afip_invoice_reconciliation_timeout` | email | Reconciliación falló |
| `afip_certificate_expiring_30d` | email | Certificado vence en 30 días |
| `afip_certificate_expiring_7d` | email + SMS | Certificado vence en 7 días |
| `payment_due` | email | Suscripción no cobrada día 1 |
| `grace_period_warning_d7` | email + SMS | Día 7 de impago |
| `reading_mode_activated` | email | Día 11 de impago |
| `suspension_imminent` | email + SMS | Día 30 de impago |
| `negative_stock_alert` | email | Venta con stock negativo (a owner) |
| `cross_tenant_blocked` | email | Sistema bloqueó intento cross-tenant |

## 12.4 Rate limiting anti-spam

- Máximo 1 mismo template/destinatario/día.
- Horario respetado: 9:00-21:00 hora local del tenant.
- Excepciones (críticas, cualquier hora): `afip_invoice_reconciliation_timeout`, `cross_tenant_blocked`, `suspension_imminent`.

## 12.5 Opt-in / opt-out

- Email transaccional al cliente del comerciante: opt-in al crear cliente con email.
- Notificaciones de Pandora al owner: obligatorias (operacionales, no marketing).
- Unsubscribe link en todo email (excepto críticos transaccionales).

## 12.6 Reputación de dominio

🟢 **VERDE** — Crítico para deliverability.

- DNS configurado correctamente: SPF, DKIM, DMARC antes del primer envío.
- Monitoreo de bounce rate. Si > 10%: alerta crítica.
- Monitoreo de spam complaints. Si > 0.1%: investigación obligatoria.
- IPs warming gradual con Resend en primeras semanas.

## 12.7 WhatsApp (Fase 1+)

🟢 **VERDE** — Política definida en Sesión 1, Fix 7.

- Canal default Fase 1: Email.
- Canal opcional Fase 1: SMS + WhatsApp.
- WhatsApp requiere Business Manager verificado + templates aprobados (24-72h por Meta).
- SMS Twilio es fallback inmediato si WhatsApp no aprobado.

**Templates a aprobar Fase 1:**
- Recordatorio de pago
- Confirmación de pedido (omnicanal F2)
- Comprobante digital de venta

---

*[Sesión 4 — Parte 2 de 5 — Continúa en parte 3]*
# 13. Observabilidad operativa

🟢 **VERDE** — Sin esto, operás ciego.

## 13.1 Filosofía

**Sin trazabilidad no se mergea.** Toda operación crítica debe poder reconstruirse desde logs, métricas y traces sin necesidad de acceder a la DB de producción.

**Tres pilares operativos:**

1. **Logs estructurados** (Pino) — qué pasó, en qué orden, con qué contexto.
2. **Métricas** (Vercel Analytics + custom) — cuánto, qué tan rápido, qué tan seguido.
3. **Traces** (OpenTelemetry desde Fase 2) — flujo completo de una request end-to-end.

**Reglas no negociables:**

- Toda operación crítica emite log + métrica.
- Todo error 5xx genera entrada en Sentry con `tenant_id` + `correlation_id`.
- Toda llamada a integración externa (AFIP, MP, Resend, Twilio) tiene timeout, retry y métrica.
- Ningún log contiene secrets (certificados, tokens, passwords, números completos de tarjeta).
- El comerciante puede ver sus propios eventos críticos vía dashboard.
- El soporte Pandora puede ver eventos cross-tenant solo con auditoría obligatoria.

## 13.2 Logs estructurados (Pino)

**Schema obligatorio:**

```json
{
  "timestamp": "ISO8601 UTC con ms",
  "level": "trace|debug|info|warn|error|fatal",
  "service": "pandora-app|pandora-worker|pandora-cron",
  "environment": "development|staging|production",
  "tenant_id": "uuid o null si pre-auth",
  "user_id": "uuid o null si sistema",
  "user_role": "owner|admin|cashier|... o null",
  "correlation_id": "uuid generado al inicio de request",
  "request_id": "uuid del HTTP request si aplica",
  "action": "dominio.accion (sale.created, stock.adjusted)",
  "entity": "recurso afectado",
  "entity_id": "uuid del registro principal",
  "duration_ms": "number — solo en logs de finalización",
  "metadata": {
    "ip": "...",
    "user_agent": "...",
    "terminal_id": "...",
    "branch_id": "...",
    "channel": "pos|web|whatsapp|api"
  },
  "message": "string legible",
  "error": {
    "name": "...",
    "message": "...",
    "stack": "..."
  }
}
```

**Sanitización obligatoria:**

- Passwords: nunca aparecen.
- Certificados AFIP: solo `cert_id` y `expires_at`.
- Tokens: solo prefijos (`"abc1...xyz9"`).
- CUITs/DNIs: solo en operaciones que lo requieran. En logs generales: hash o omit.
- Direcciones y teléfonos: solo en operaciones específicas.

**Validación en CI:**

```typescript
// Test automático que falla el build si:
- console.log en código (debe ser logger.info)
- Strings que matchean patterns de tarjeta de crédito
- Strings que matchean CUIT completo
- Strings que matchean password
- Logs sin tenant_id en operaciones de negocio
```

## 13.3 Stack tecnológico de logs

| Capa | Tool | Fase |
|---|---|---|
| Generación | Pino | F0 |
| Dev local | pino-pretty | F0 |
| Agregación cloud F0 | Vercel logs nativos | F0 |
| Agregación extendida | Axiom o Better Stack | F1 (cuando duela) |
| Búsqueda y dashboards | Mismo proveedor | F1 |

**Decisión:** empezar con Vercel logs nativos. Migrar a Axiom cuando: (a) retención 7 días insuficiente, (b) > 50 clientes con volumen incómodo.

## 13.4 Métricas de negocio Fase 0

| Métrica | Tipo | SLO | Alerta si |
|---|---|---|---|
| `afip_cae_success_rate` | Gauge % | > 95% | < 90% por 15 min |
| `afip_request_latency_p99` | Histogram ms | < 8000 | > 25000 |
| `afip_timeout_count` | Counter | < 5/h | > 20/h |
| `sale_creation_duration_p95` | Histogram ms | < 2000 | > 5000 |
| `sale_creation_failure_rate` | Gauge % | < 1% | > 5% |
| `stock_negative_events` | Counter | 0 si bloqueado | > 0 cuando bloqueado |
| `cash_session_difference_rate` | Gauge % | < 5% | > 15% |
| `cash_session_force_closed_rate` | Gauge % | < 3% | > 10% |
| `mp_webhook_lag_p99` | Histogram s | < 30 | > 120 |
| `mp_webhook_failure_rate` | Gauge % | < 2% | > 10% |
| `email_bounce_rate` | Gauge % | < 5% | > 10% |
| `idempotency_replay_rate` | Counter | < 50/h | > 500/h |
| `serialization_retry_succeeded_rate` | Gauge % | < 5% | > 10% warning |
| `serialization_retry_exhausted_rate` | Gauge % | < 0.1% | > 1% critical |
| `cross_tenant_attempt_blocked` | Counter | 0 | > 0 → freezar tenant |
| `padron_revalidation_timeout_rate` | Gauge % | < 5% | > 10% |

## 13.5 Métricas Fase 1+

| Métrica | Fase | Notas |
|---|---|---|
| `queue_depth_by_priority` | F1 | BullMQ jobs por prioridad |
| `queue_processing_time_p95` | F1 | Tiempo encolado → completado |
| `dead_letter_queue_size` | F1 | Alerta si > 10 |
| `job_retry_rate` | F1 | % jobs con retry |
| `whatsapp_template_approval_rate` | F1 | % aceptación Meta |
| `accountant_dashboard_load_p95` | F1 | Dashboard con N empresas |
| `customer_retention_rate_monthly` | F1 | Churn mensual |
| `tenant_active_dau` | F1 | Daily Active Users |
| `api_rate_limit_hits` | F2 | Cuando haya API pública |
| `tenant_resource_consumption_p95` | F2 | Quotas |

## 13.6 Alertas con destinos

**Tres niveles:**

| Nivel | Destino | Respuesta esperada | Ejemplo |
|---|---|---|---|
| **Info** | Slack `#pandora-ops` o email diario | Revisión diaria | "Reporte: 234 ventas, 99.2% CAE" |
| **Warning** | Slack `#pandora-alerts` | 4 horas | "AFIP success bajó a 92%" |
| **Critical** | Slack + email + SMS al owner Pandora | < 30 min | "DB pool exhausted" |

**No usar PagerDuty en Fase 0** — overkill para 1 dev. Slack + SMS alcanzan.

**Alertas obligatorias F0:**

| Alerta | Trigger | Nivel |
|---|---|---|
| AFIP success rate baja | < 90% por 15 min | Critical |
| AFIP timeout masivo | > 20/h | Critical |
| 5xx elevados | > 5/min por 5 min | Critical |
| DB connection issues | Errores en logs | Critical |
| Certificado AFIP por vencer | 30/15/7/3/1 días | Warning → Critical |
| Cross-tenant leak detectado | Cualquier evento | Critical + freezar |
| Tasa de descuadre alta | > 15% global | Warning |
| Queue lag alta | > 30 min sin procesar | Warning |
| Webhook MP fallando | > 10% | Warning |
| DLQ creciendo | > 10 items | Warning |
| Serialization retry exhausted | > 1% en 15 min | Critical |
| Padron revalidation timeouts | > 10% | Warning |

**Alertas por tenant (al comerciante):**

| Alerta | Trigger | Canal |
|---|---|---|
| Caja con descuadre | Cierre > tolerancia | Email + dashboard |
| Stock crítico | Producto bajo mínimo | Email diario consolidado |
| Factura pendiente | `requires_reconciliation` > 1h | Email + dashboard |
| Certificado vence | 30/15/7 días | Email + banner persistente |
| Suspensión inminente | Día 7, 9, 10 impago | Email + SMS + banner crítico |

## 13.7 Health checks

**Endpoint `/health` (público, sin auth):**

```json
{
  "status": "ok|degraded|down",
  "version": "1.0.0",
  "uptime_seconds": 12345,
  "timestamp": "..."
}
```

**Endpoint `/health/detailed` (auth admin Pandora):**

```json
{
  "status": "ok",
  "services": {
    "database": { "status": "ok", "latency_ms": 12, "pool_used": 5, "pool_max": 20 },
    "afip_homologation": { "status": "ok", "latency_ms": 1500 },
    "mercadopago": { "status": "ok", "latency_ms": 250 },
    "resend": { "status": "ok" },
    "twilio": { "status": "ok" },
    "supabase_storage": { "status": "ok" }
  }
}
```

**Tests sintéticos (F1+):**

Cada 30 min, cron ejecuta:
1. Login sintético con usuario de prueba.
2. Lectura de productos del tenant de prueba.
3. Venta sintética en tenant aislado + anulación inmediata.
4. AFIP sintético contra homologación (no producción).

Si falla cualquier paso: alerta Critical inmediata.

## 13.8 Tracing distribuido

🟢 **VERDE** F0 (correlation_id en logs) + F2+ (OpenTelemetry).

**F0-1:** tracing implícito via `correlation_id`. Suficiente para reconstruir flujos manualmente.

**F2+:** OpenTelemetry cuando:
- Hay > 1 servicio (worker + app + edge).
- Volumen excede capacidad de leer logs lineales.
- Aparecen problemas de latencia que requieren ver tiempos por componente.

**Configuración F2:**
- Traces a Axiom, Honeycomb, o Grafana Tempo.
- Sampling: 100% errores, 10% normales.
- Spans obligatorios: HTTP → Server Action → Service → Drizzle tx → external API.
- Atributos: `tenant_id`, `user_id`, `action`, `entity_id`.

## 13.9 Sentry — errores y excepciones

**Configuración:**

```typescript
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
  beforeSend(event) {
    if (event.user) {
      delete event.user.password;
      delete event.user.token;
    }
    return event;
  },
});
```

**Tags obligatorios:**

```typescript
Sentry.withScope((scope) => {
  scope.setTag('tenant_id', companyId);
  scope.setTag('user_id', userId);
  scope.setTag('correlation_id', correlationId);
  scope.setTag('action', action);
  scope.setContext('request', { ... });
  Sentry.captureException(error);
});
```

**Groupings:** errores agrupados por `error.name + action + entity`. Evita issues duplicados de mismo bug en distintos tenants.

**Release tracking:** cada deploy crea release con commit hash.

## 13.10 Audit log — write-only server-side

🟢 **VERDE** — Crítico (Sesión 3.5 + 3.5.2).

**Reglas:**

- Cliente NUNCA escribe directamente. Tabla rechaza INSERT desde `authenticated`.
- Toda escritura usa `service_role` desde backend.
- Función única `AuditService.log()` valida tenant + user + action + reason antes de persistir.
- Si validación falla → throw → operación de negocio rollback.

**Schema:**

```sql
CREATE TABLE audit_log (
    id bigserial PRIMARY KEY,
    company_id uuid NOT NULL REFERENCES companies(id),
    user_id uuid REFERENCES profiles(id),
    user_role text NOT NULL,
    action text NOT NULL,
    entity text NOT NULL,
    entity_id uuid,
    changes jsonb NOT NULL,
    reason text,
    metadata jsonb,
    occurred_at timestamptz NOT NULL DEFAULT now()
);

REVOKE ALL ON audit_log FROM authenticated;
REVOKE UPDATE, DELETE, TRUNCATE ON audit_log FROM service_role;
GRANT INSERT ON audit_log TO service_role;

ALTER TABLE audit_log ADD CONSTRAINT reason_required_for_destructive
CHECK (
  action NOT IN (
    'sale.cancelled', 'sale.refunded', 'stock.negative_override',
    'cash_session.closed_with_difference', 'cash_session.force_closing_reverted',
    'customer.deleted', 'customer.iva_condition_changed',
    'product.deleted', 'product.price_changed',
    'user.role_changed', 'user.deactivated', 'accountant.revoked',
    'company.deleted', 'company.iva_condition_changed',
    'subscription.suspended', 'fiscal_config.modified',
    'support.impersonation_started', 'import.rolled_back'
  ) OR reason IS NOT NULL
);
```

**AuditService.log() recibe la transacción:**

```typescript
interface AuditLogParams {
  tx: TransactionContext;  // OBLIGATORIO
  companyId: string;
  userId: string | null;
  userRole: string;
  action: AuditableAction;
  entity: string;
  entityId: string | null;
  changes: { before: any; after: any };
  reason?: string;
  metadata: AuditMetadata;
}

export class AuditService {
  async log(params: AuditLogParams): Promise<void> {
    // Validaciones (tenant, user, action whitelist, reason si aplica)
    // ...
    
    // Insertar EN LA MISMA transacción que el negocio
    await params.tx.insert(auditLog).values({...});
    
    // Si esto falla, throw propaga, transacción rollback completa
  }
}
```

**Regla absoluta:** toda mutación crítica ejecuta audit DENTRO de la transacción.

## 13.11 Retención y archivado

| Tipo | Hot | Cold | Total legal |
|---|---|---|---|
| Logs `info` | 30 días | — | 30 días |
| Logs `warn` | 90 días | — | 90 días |
| Logs `error` | 1 año | — | 1 año |
| Logs `fatal` | Indefinido | — | Indefinido |
| Métricas detalle | 90 días | — | — |
| Métricas agregadas | 1 año | — | — |
| Sentry issues | 90 días (free) | — | — |
| `audit_log` | 2 años | 8 años S3 | 10 años (Ley 11.683) |
| `idempotency_log` | 90 días | índice 1 año | 6 meses garantía |
| `afip_invoices.xml` | 2 años | 8 años S3 | 10 años |
| `notifications` | 90 días | — | 90 días |
| `webhook_logs` | 30 días | — | 30 días |

**Cron de archivado mensual** día 1, 02:00 hora Argentina:
- Mueve audit_log y afip_invoices.xml > 2 años a S3 Glacier.
- Mantiene `audit_log_archive_index` consultable.
- Acceso archivado: async, 24-48h.

**Política de idempotency en borde de TTL** (Sesión 3.5):

```
1. Buscar en idempotency_log (hot, 90 días)
2. Si no encontrado: buscar en idempotency_log_archive_index
3. Si encontrado en archive: fetch resultado desde S3 (2-5s aceptable)
4. Si no: proceder operación nueva

Cutoff:
- < 6 meses: idempotente garantizada
- 6-12 meses: best-effort (lookup cold)
- > 12 meses: NO garantía. Cliente regenera key si > 6 meses sin completar.
```

## 13.12 Correlación end-to-end

Una venta toca: browser → Server Action → Service → Drizzle tx → AFIP SOAP → Resend → audit_log.

Sin `correlation_id` consistente, debugging es ciencia ficción.

**Generación:**
- Browser: header `X-Correlation-ID: <uuid>` en cada request.
- Si cliente no envía: server genera y devuelve en response.
- Propagación hacia abajo: Server Action → Service → External APIs.
- Loggeado en cada paso.

**Endpoint admin:**

`GET /api/admin/trace/:correlation_id` devuelve cronología completa:

```json
{
  "correlation_id": "uuid",
  "tenant_id": "uuid",
  "user_id": "uuid",
  "timeline": [
    { "timestamp": "...", "service": "app", "action": "sale.create.started" },
    { "timestamp": "...", "service": "app", "action": "stock.locked" },
    { "timestamp": "...", "service": "app", "action": "afip.request.sent" },
    { "timestamp": "...", "service": "app", "action": "afip.response.received", "cae": "..." },
    { "timestamp": "...", "service": "app", "action": "sale.completed" },
    { "timestamp": "...", "service": "worker", "action": "email.sent" }
  ],
  "duration_total_ms": 4521,
  "result": "success"
}
```

**Crítico para soporte:** cliente reporta "mi venta #1234 no se facturó", buscás `correlation_id`, ves toda la historia en una pantalla.

## 13.13 Definition of Done — Observabilidad

Una feature está DONE solo si:

- [ ] Emite logs estructurados con campos obligatorios
- [ ] Si crítica: emite métrica
- [ ] Si toca integración externa: timeout + retry + métrica
- [ ] Errores van a Sentry con tags correctos
- [ ] Aparece en al menos un dashboard si relevante
- [ ] Tiene alerta configurada si fallo es crítico
- [ ] `correlation_id` se propaga end-to-end
- [ ] Sin secrets en logs

---

# 14. UX operacional

🟢 **VERDE** — La diferencia entre POS que se usa y POS que se abandona.

## 14.1 Principios rectores

UX operacional, no decorativa. Optimizada para:

- **Cajeros cansados a las 21:00** que no quieren leer texto.
- **Comerciantes con manos ocupadas** (escanean + cobran + embolsan).
- **Adultos 40-60 años** no nativos digitales.
- **Tablets baratas** con pantallas táctiles imprecisas, CPUs lentas.
- **Conexión 4G fluctuante** en barrios alejados.

**Anti-principios:**
- No "moderno minimalista" con affordances ocultos.
- No animaciones > 200ms (genera percepción de lento).
- No tooltips para acciones críticas (no se leen en operación rápida).
- No menús anidados > 2 niveles.
- No modales sobre modales.
- No infinite scroll en operativas (siempre paginación clara).

## 14.2 Latencia máxima por operación

| Operación | SLO p95 | Inaceptable | Acción |
|---|---|---|---|
| Login → dashboard | < 800ms | > 2s | Alerta Sentry |
| Escaneo producto → carrito | < 200ms | > 500ms | Crítico, optimizar cache |
| Búsqueda fuzzy | < 300ms | > 800ms | Migrar a Meilisearch F2 |
| Confirmar venta sin facturar | < 500ms | > 1.5s | Revisar Drizzle tx |
| Confirmar venta + AFIP | < 8s p95 | > 25s | Timeout y fallback |
| Generar PDF ticket | < 1s | > 3s | Revisar template |
| Imprimir PDF browser | < 2s | > 5s | UX "Procesando impresión" |
| Cierre de turno con arqueo | < 1.5s | > 4s | Optimizar query |
| Listado de ventas día | < 700ms | > 2s | Índice |
| Carga catálogo 1.000 productos | < 2s | > 5s | Server Component stream |
| Importación CSV 5.000 productos | < 15s validar + 30s aplicar | > 60s | Procesar chunks 500 |

**Medición:** logs Pino con `duration_ms` + métricas con histograma p50/p95/p99.

## 14.3 Keyboard-first POS

El POS está optimizado para teclado físico. Mouse y touch son secundarios. **Cajero opera 90% sin levantar manos del teclado.**

**Atajos no negociables:**

| Tecla | Acción |
|---|---|
| `/` | Focus buscador productos |
| `Enter` | Confirmar acción primaria contextual |
| `Esc` | Cancelar/cerrar |
| `F2` | Cliente |
| `F3` | Cambiar caja |
| `F4` | Descuento global |
| `F5` | Modificar cantidad |
| `F6` | Eliminar item |
| `F7` | Notas internas |
| `F8` | Medios de pago |
| `F9` | Tipo de comprobante |
| `F10` | Anulación última venta |
| `F11` | Pantalla completa |
| `F12` | Cobrar y emitir |
| `Ctrl+Z` | Deshacer carrito |
| `Ctrl+P` | Reimprimir último ticket |
| `Ctrl+N` | Nueva venta |
| `↑/↓` | Navegar items carrito |

**Indicadores visuales:**
- Cada botón con atajo muestra atajo visible: `[F12] Cobrar`.
- Hover muestra atajo si existe.
- Pantalla de ayuda con `?` muestra todos.

**Accesibilidad táctil (fallback):**
- Todos los atajos tienen botón visible para casos sin teclado.
- Botones críticos: target táctil mínimo 48x48px (sobre el 44x44 estándar).
- Separación mínima 8px entre targets.

## 14.4 Estados visuales

**Loading:**

| Duración | UI |
|---|---|
| < 100ms | Nada (optimistic) |
| 100-300ms | Cursor wait + atenuación botón |
| 300-1000ms | Skeleton + botón "Procesando..." |
| 1000-3000ms | Skeleton + barra |
| 3000-10000ms (AFIP) | Modal "Solicitando CAE a AFIP..." + barra + "Cancelar tras 15s" |
| > 10000ms | Toast "La operación está tardando..." |

**Regla:** nunca > 100ms sin feedback.

**Success:**

| Severidad | UI |
|---|---|
| Rutinaria (carrito) | Sin toast, cambio visual basta |
| Importante (venta cobrada) | Toast verde 3-4s + animación check |
| Crítica (factura emitida) | Toast verde 5s + sound + ticket en pantalla |
| Destructiva (anulación) | Toast amarillo 5s + log historial |

**Error (sin mensajes genéricos):**

| Error | Mal | Bien |
|---|---|---|
| Stock insuficiente | "Error al confirmar" | "Stock insuficiente: queda 1 unidad de 'Coca 500ml'. [Sí con autorización] [Modificar] [Quitar]" |
| Sin internet | "Error conexión" | "Sin internet. Reintentando cada 10s. [Cancelar]" |
| AFIP timeout | "Error AFIP" | "AFIP no respondió en 30s. Ticket no fiscal emitido. Reintentamos en 5 min. [Reintentar manual]" |
| Pagos no cuadran | "Error pagos" | "Pagos suman $X, total $Y. Falta $Z. [Ajustar]" |
| Sin permiso | "Acceso denegado" | "Tu rol (cajero) no puede aplicar descuentos > 10%. Pedí autorización." |
| Sesión expirada | "Sesión expirada" | "Tu sesión venció. Tus datos del carrito se guardaron. [Reingresar]" |
| Producto duplicado | "Error validación" | "El SKU 'PROD-001' ya existe en 'Coca 1L'. [Editar ese] [Cambiar SKU]" |

## 14.5 Confirmaciones obligatorias

Acciones destructivas requieren confirmación verbose:

| Acción | Confirmación |
|---|---|
| Anular venta facturada | "Esta venta tiene factura B-0001-00001234. Anularla emite NC automática. [Cancelar] [Sí, anular y emitir NC]" + motivo obligatorio |
| Eliminar producto con histórico | "Este producto tiene 47 ventas. Se marca como inactivo (no eliminado físicamente). [Cancelar] [Sí, inactivar]" |
| Cierre con descuadre > 5% | "Descuadre $X (Y%). Requiere autorización admin. [Solicitar] [Cancelar]" |
| Eliminar empresa | Wizard 3-step + delay 7 días + email cancelación |
| Cambiar plan a menos features | "Bajar de Pro a Starter desactiva: variantes, multi-sucursal. [Cancelar] [Sí]" |

## 14.6 Tolerancia a errores humanos

| Error | Prevención |
|---|---|
| Doble escaneo rápido | Detección timing < 200ms = ignorar segundo |
| Cliente paga efectivo, cambio mal | Sistema sugiere cambio automático |
| Cantidad con coma vs punto | Aceptar ambos, normalizar |
| CSV con encoding raro | Auto-detect UTF-8, CP1252, ISO-8859-1 |
| Buscar SKU con espacios | Normalizar (ignorar espacios, guiones, mayúsculas) |
| CUIT con guiones | Auto-formatear/limpiar |
| Olvidar cerrar turno | Cron 23:59 con smart detection |
| Vender producto sin stock | Override solo si tenant lo habilita + motivo |
| Cobrar de menos | Validación pagos === total |
| Ticket roto | Reimprimir disponible |

**Mensajes preventivos:**

- Cerrar turno con `pending_payment`: "Hay 3 ventas sin cobrar."
- Deshabilitar AFIP: "Tenés 142 facturas este mes. Las nuevas no podrán facturarse."
- Anular venta de hace 23h: "Esta venta tiene 23h. Anulación permitida hasta 24h."
- Stock crítico al agregar: "Quedan 2 unidades. ¿Continuar?" (no bloqueante)

## 14.7 Fallback manual

| Sistema falla | Camino manual |
|---|---|
| AFIP timeout 30s | Ticket no fiscal + reconciliación async |
| Impresora no responde | PDF en pantalla con QR + "Reintentar impresión" |
| Padrón A5 no responde | Carga manual sin validación + "Pendiente validar" |
| Webhook MP no llega | Marcar pago manual con referencia + audit |
| Búsqueda fuzzy falla | Fallback literal |
| Imagen producto falla | Producto sin imagen, agregar después |
| Sync catálogo tablet falla | Cache local + banner "Catálogo desactualizado" |
| Login email/password falla | Magic link, después support |

## 14.8 UX offline (Fase 2+)

🟡 **AMARILLO** — Implementación F2.

- **Detección:** banner amarillo "Sin conexión. Ventas se guardan localmente."
- **Permitido offline:** venta ticket no fiscal, registro caja, búsqueda cache.
- **Bloqueado offline:** facturación AFIP (queue), Padrón nuevo, importación.
- **Contador pendiente:** visible "12 operaciones pendientes".
- **Reconexión:** banner verde 5s "Sincronizando..." → "Completo".
- **Conflicto sync:** modal con resolución manual.

## 14.9 Empty states

| Pantalla | Mensaje + CTA |
|---|---|
| Sin productos | "No tenés productos. [Importar CSV] [Cargar manual] [Productos demo del rubro]" |
| Sin clientes | "No tenés clientes. [Agregar] [Importar Excel]" |
| Sin ventas hoy | "Todavía no hay ventas hoy. [Nueva venta]" |
| Carrito vacío | "Carrito vacío. Escaneá o presioná / para buscar." |
| Sin turno abierto | "No tenés turno abierto. [Abrir turno con monto inicial]" |
| Sin notificaciones | "Sin notificaciones. Te avisamos cuando pase algo importante." |
| Sin reportes | "Generá tu primer reporte. [Ventas del día] [Stock crítico]" |

## 14.10 Mobile-aware (no mobile-first)

Pandora es desktop/tablet-primary.

| Dispositivo | Optimización |
|---|---|
| Desktop 1366px+ | POS completo. Keyboard-first. Grids amplios. |
| Tablet 768-1365px | POS completo touch-first. Botones grandes. |
| Mobile < 768px | **Solo lectura.** Dashboard simplificado. Notificaciones. Cierre desde tablet preferido. |

**Por qué no mobile POS:**
- Tablet más estable que celular.
- Celular muy chico para carrito + cliente + totales + atajos.
- Dedo cansado en zonas chicas propenso a error.
- Cobrar con celular + bolsa + producto = caos.

## 14.11 Modo nocturno

🟢 **VERDE** F1 — Crítico para kioscos hasta tarde.

- Activación: manual (toggle settings) o automática (hora local 20:00-07:00, F1+).
- Paleta: fondos gris oscuro (#0f172a), textos blancos (#f1f5f9), accents primary mantenidos.
- Reduce fatiga visual.
- Independiente del SO (algunos comerciantes no saben configurar).

## 14.12 Sonido y notificaciones audibles

🟡 **AMARILLO** — Validar con primeros 5 clientes.

- Venta exitosa: "ding" corto (configurable, default ON).
- Rechazo: tono grave corto (default OFF en local ruidoso).
- Error crítico (AFIP timeout): alerta larga (default ON).
- Configuración por usuario.
- Mute global para horarios (siesta).

## 14.13 Internacionalización

**F0-3:** Español rioplatense (es-AR) único. NO "español neutro" — el target argentino usa palabras locales (boleta, cambio, "te paso transferencia").

**F4+ multi-país:**
- Estructura i18n preparada desde F0 con archivos separados aunque solo se use es-AR.
- F4: es-UY, es-CL, es-MX con localizaciones (moneda, formato fecha, fiscal local).
- Inglés solo para soporte interno.

## 14.14 Accesibilidad

🟢 **VERDE** — WCAG 2.1 AA mínimo.

**Requisitos no negociables:**

- Contraste mínimo 4.5:1 normal, 3:1 grande. Validado con axe-core en CI.
- Foco visible en todo interactivo.
- Navegación por teclado completa.
- ARIA labels en botones de íconos. `aria-live` para toasts.
- Sin trampa de foco en modales (Esc cierra).
- Base 16px mínimo. 200% zoom sin romper.
- Información crítica con icono + texto, no solo color.

**Para comerciantes mayores:**
- Inter o sistema, no decorativas.
- 14px tablas densas, 16px formularios.
- Padding generoso (12vert, 24horiz).
- Iconos siempre con label crítico.

## 14.15 Métricas de UX

| Métrica | Target F0 |
|---|---|
| Escaneo → venta confirmada p95 | < 15s |
| Tasa anulación de ventas | < 3% |
| Tasa errores cierre (descuadre > 5%) | < 5% |
| Tiempo onboarding completo p50 | < 45 min |
| Abandono onboarding por paso | < 20% |
| Tasa reimpresión | Bajo es bueno |
| Errores 4xx POS | < 2% |
| Tiempo respuesta a error (ver → resolver) p50 | < 30s |

## 14.16 Onboarding detallado

**Paso 1: Registro (3 min):**
- Email + password + nombre comercio.
- CUIT optativo.
- Botón: "Empezar a vender ya".
- Sin marketing opt-in, sin cookies tracking obligatorias.

**Paso 2: Datos comerciales (5 min):**
- Nombre fantasía, dirección, teléfono, condición IVA (default RI).
- Rubro: dropdown con productos demo pre-cargados.
- Botón: "Continuar al POS" (opción saltear AFIP).

**Paso 3: AFIP (opcional, 30-60 min cuando tenga certificado):**
- Wizard sube certificado X.509 con instrucciones.
- Configurar punto de venta.
- Probar comprobante de prueba contra homologación.
- Si OK: activar producción.

**Por qué AFIP opcional al inicio:**
Los comerciantes ven el producto vendiendo antes de configurar fiscalidad. AFIP toma 1-3 días. Si bloqueás, perdés 60% de registros.

**Estrategia ganadora:** comerciante registra → vende con demo → se enamora → completa AFIP después.

## 14.17 Lo que NO hace el POS

🟢 **VERDE** — Decisiones explícitas de NO hacer.

- ❌ Tutoriales onboarding largos (cajero sabe vender)
- ❌ Gamificación
- ❌ Chat in-app (soporte por WhatsApp)
- ❌ Upselling en venta ("¿agregás X?")
- ❌ Social sharing
- ❌ Push de marketing
- ❌ Skin/temas personalizables (Fase 0-2)
- ❌ Tour interactivo del POS
- ❌ Estadísticas comparativas anónimas

---

# 15. Visual system

🟢 **VERDE** — Identidad Dawn Sky + 3 atmospheres + 6 ADRs formales.

## 15.1 Filosofía

**"Una identidad, tres intensidades."** La identidad (Dawn Sky + glass + motion philosophy) no negocia. La intensidad sí, según contexto operativo.

**Tres atmospheres:**

| Atmosphere | Dónde | Para qué |
|---|---|---|
| **Atmosphere** | Dashboard, onboarding, marketing | Premium emocional, conversión |
| **Operational** | POS, listados, workflow | Velocidad, baja fatiga 8-12h |
| **Critical** | Fiscal, destructivo, irreversible | Claridad máxima, cero distracción |

## 15.2 Identidad permanente: Dawn Sky

🟢 **VERDE** — ADR-0016.

Background pastel de gradientes radiales que evoca amanecer. Es la firma del producto.

**Default permanente F0:** dawn (rosa pastel + lavanda + cielo).
**F1+:** noon (mediodía), dusk (atardecer), night (modo nocturno) configurables.
**F0 confirmado:** solo dawn.

## 15.3 Mapa de pantallas por atmosphere

### Atmosphere

- Landing pública
- Onboarding wizard (3 pasos)
- Home dashboard del owner
- Dashboard multi-empresa del contador
- Reportes con visualizaciones
- Marketing surfaces (planes, upgrade, referidos)
- Pantalla post-venta exitosa con CAE
- AI Assistant (F1+)
- Settings de personalización

### Operational

- **POS (la pantalla más usada)**
- Listados de productos
- Listados de clientes
- Listados de ventas históricas
- Búsqueda fuzzy
- Carga/edición de productos
- Stock management
- Caja: apertura, movimientos durante turno
- Importación CSV
- Tablas operativas en general

### Critical

- Modal confirmación de venta antes de cobrar
- Pantalla de factura con CAE emitido
- Cierre de caja con arqueo y descuadre
- Anulación de venta
- Configuración AFIP (certificado, PV)
- Modo lectura por impago / suspensión
- Backup y exportación de datos
- Modal eliminación de empresa
- Operaciones que generan NC
- Cambio de condición IVA del comerciante
- Suplantación por soporte

## 15.4 Specs ejecutables por atmosphere

### Atmosphere

```css
[data-atmosphere="atmosphere"] {
  --surface-bg: rgba(255, 255, 255, 0.58);
  --surface-blur: 28px;
  --surface-saturate: 140%;
  --surface-border: rgba(255, 255, 255, 0.85);
  --surface-shadow: 
    0 1px 0 rgba(255,255,255,0.9) inset,
    0 8px 32px rgba(54, 70, 120, 0.10),
    0 2px 8px rgba(54, 70, 120, 0.06);
  
  --motion-enter-duration: 600ms;
  --motion-stagger-delay: 60ms;
  --motion-hover-lift: -2px;
  
  --feature-tilt: 1;
  --feature-sheen: 1;
  --feature-parallax: 1;
  --feature-counter-shine: 1;
  --feature-floaty: 1;
  --feature-avatar-ring: 1;
  
  --density-row-height: 44px;
  --density-input-height: 40px;
  --density-padding: 22px;
  --density-base-font: 14px;
  
  --chart-entry-animation: enabled;
}
```

### Operational

```css
[data-atmosphere="operational"] {
  --surface-bg: rgba(255, 255, 255, 0.82);
  --surface-blur: 12px;
  --surface-saturate: 110%;
  --surface-border: rgba(255, 255, 255, 0.6);
  
  --motion-enter-duration: 200ms;
  --motion-stagger-delay: 0ms;
  --motion-hover-lift: 0;
  
  --feature-tilt: 0;
  --feature-sheen: 0;
  --feature-parallax: 0;
  --feature-counter-shine: 0;
  --feature-floaty: 0;
  --feature-avatar-ring: 0;
  
  --density-row-height: 32px;
  --density-input-height: 36px;
  --density-padding: 12px;
  --density-base-font: 13px;
  
  --chart-entry-animation: disabled;
  --counter-animation: disabled;  /* ← clave: números reales sin animar */
}
```

### Critical

```css
[data-atmosphere="critical"] {
  --surface-bg: rgba(255, 255, 255, 0.96);
  --surface-blur: 0;
  --surface-saturate: 100%;
  --surface-border: rgba(13, 20, 36, 0.12);
  
  --motion-enter-duration: 0ms;
  
  --feature-tilt: 0;
  --feature-sheen: 0;
  --feature-parallax: 0;
  --feature-counter-shine: 0;
  
  --density-row-height: 56px;
  --density-input-height: 48px;
  --density-padding: 24px;
  --density-base-font: 15px;
  
  --type-amount-display: 56px;
  --type-cae-mono: 24px;
  
  --sky-overlay-bg: rgba(13, 20, 36, 0.35);
}
```

## 15.5 Color tokens

```css
:root {
  /* Ink (textos) */
  --ink-0: #0d1424;
  --ink-1: #1f2a44;
  --ink-2: #4a5570;
  --ink-3: #7681a0;
  --ink-4: #a8b0c5;
  
  /* Glass */
  --glass-58: rgba(255, 255, 255, 0.58);
  --glass-72: rgba(255, 255, 255, 0.72);
  --glass-82: rgba(255, 255, 255, 0.82);
  --glass-92: rgba(255, 255, 255, 0.92);
  --glass-96: rgba(255, 255, 255, 0.96);
  
  /* Accents */
  --purple: #6b5fff;
  --purple-2: #9088ff;
  --blue: #5b8cff;
  --teal: #1ea8a0;
  
  /* Semantic */
  --success: #34c77d;
  --warning: #f0b878;
  --danger: #ef5d6a;
  --orange: #f7984a;
  --pink: #ee6a8e;
  
  /* Fiscal */
  --fiscal: #0d1424;
  --fiscal-bg: rgba(13, 20, 36, 0.04);
  
  /* Active accent (runtime) */
  --accent: var(--purple);
  --accent-2: var(--purple-2);
  --accent-soft: rgba(107, 95, 255, 0.10);
}
```

## 15.6 Motion tokens

```css
:root {
  --motion-feedback: 80ms;
  --motion-fast: 180ms;
  --motion-medium: 240ms;
  --motion-slow: 400ms;
  --motion-deliberate: 600ms;
  --motion-rich: 900ms;
  --motion-chart: 1600ms;
  
  /* SOLO estas 4 easings */
  --ease-default: cubic-bezier(.2, .7, .2, 1);
  --ease-nav: cubic-bezier(.4, 0, .2, 1);
  --ease-pulse: ease-in-out;
  --ease-spin: linear;
}

@media (prefers-reduced-motion: reduce) {
  :root {
    --motion-feedback: 0ms;
    --motion-fast: 0ms;
    --motion-medium: 0ms;
    --motion-slow: 0ms;
    --motion-deliberate: 0ms;
    --motion-chart: 0ms;
  }
  
  .parallax-sky, .avatar-ring, .floaty-card,
  .counter-shine, .live-dot::after, .sheen::before {
    animation: none !important;
  }
}
```

## 15.7 Arquitectura técnica

**Estructura:**

```
src/
├── styles/tokens/             ← CSS custom properties
├── styles/atmospheres/        ← 3 archivos por atmosphere
├── styles/sky/dawn.css        ← F0
├── components/atmosphere/
│   ├── AtmosphereProvider.tsx
│   ├── Surface.tsx
│   ├── GlassCard.tsx
│   ├── TiltCard.tsx
│   ├── Sheen.tsx
│   └── ParallaxSky.tsx
├── components/charts/         ← 4 charts SVG puro migrados
├── components/primitives/     ← Icon, Avatar, LiveDot, etc.
└── lib/design/
    ├── atmospheres.ts
    ├── hardware-detection.ts
    └── motion-presets.ts
```

**Uso:**

```tsx
// POS — operational
<Surface level="operational">
  <GlassCard>
    <ProductGrid />
  </GlassCard>
</Surface>

// Dashboard — atmosphere
<Surface level="atmosphere">
  <ParallaxSky />
  <GlassCard>
    <RevenuePanel />
  </GlassCard>
</Surface>

// Anulación — critical
<Surface level="critical">
  <GlassCard variant="strong">
    <h1>¿Anular venta #1234?</h1>
    <BigAmount>${total}</BigAmount>
  </GlassCard>
</Surface>
```

## 15.8 Degradación automática por hardware

```typescript
function detectCapabilities(): Capabilities {
  if (typeof window === 'undefined') return { ...defaults };
  
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const cores = navigator.hardwareConcurrency ?? 4;
  const memory = (navigator as any).deviceMemory ?? 4;
  const isMobile = /Mobi|Android.*Mobile|iPhone/i.test(navigator.userAgent);
  const isTablet = /iPad|Android(?!.*Mobile)/i.test(navigator.userAgent) 
    || (window.innerWidth >= 768 && window.innerWidth < 1180);
  
  const highPerf = !reducedMotion && cores >= 4 && memory >= 4 && !isMobile;
  
  return {
    highPerf,
    reducedMotion,
    canDoGlass: !reducedMotion && cores >= 2,
    canDoTilt: highPerf && !isTablet,
    canDoParallax: highPerf && !isMobile && !isTablet,
    canDoCharts: true,
    isMobile,
    isTablet,
  };
}
```

**Si hardware bajo:** Atmosphere degrada automáticamente a Operational. Sin cambio de código.

## 15.9 Performance budget

| Atmosphere | LCP | FPS | FID | CLS |
|---|---|---|---|---|
| Atmosphere | < 2.5s | 60fps | < 100ms | < 0.1 |
| Operational | < 1.5s | 60fps consistente | < 50ms | < 0.05 |
| Critical | < 1.0s | N/A | < 30ms | 0 |

**Si Operational baja a 30fps en hardware target durante POS normal: bug bloqueante.**

## 15.10 Decisiones cerradas Fase 0

🔴 → 🟢 Cerradas en Sesión 3.7:

- Override de atmospheres por tenant: **NO permitido F0-2**, evaluar F3.
- Light vs Dark default: **Light siempre F0**, auto por hora F1+.
- Sky moods: **Solo dawn F0**, noon/dusk/night F1+.

---

*[Sesión 4 — Parte 3 de 5 — Continúa en parte 4]*
# 16. Máquinas de estado

🟢 **VERDE** — Las 12 máquinas formales consolidadas.

## 16.1 Convenciones

- `[estado]` = estado del sistema
- `→` = transición permitida
- `(condition)` = precondición
- `// side effect` = efecto colateral
- **terminal** = estado del que no se sale

**Regla absoluta:** ningún estado permite transición no listada. Si aparece la necesidad, primero se documenta en SRS, después se codea.

---

## SM-01 — Order (Pedido)

**Activo F2+** (omnicanal). En F0 está implícito en POS.

### Estados

```
[draft] (en armado por vendedor)
  ├── → [confirmed] (cliente confirma)
  └── → [cancelled] (terminal)

[confirmed] (con reservation_expires_at)
  ├── → [converted_to_sale] (terminal, se cobró)
  ├── → [expired] (terminal, TTL alcanzado por cron)
  ├── → [cancelled] (terminal)
  └── → [pending_review] (problema operativo)

[pending_review] (problema detectado, requiere intervención manual)
  ├── → [confirmed] (admin resuelve)
  └── → [cancelled] (terminal)

[converted_to_sale] (terminal)
[expired] (terminal)
[cancelled] (terminal)
```

### Tabla de transiciones

| Estado | Acción | Destino | Precondiciones | Side effects |
|---|---|---|---|---|
| draft | confirm | confirmed | Items > 0, stock disponible | stock_reservation activa, reservation_expires_at |
| draft | cancel | cancelled | — | Liberar lock pre-reserva si existe |
| confirmed | convert_to_sale | converted_to_sale | Sale.completed con order_id | stock_reservation → converted |
| confirmed | expire_ttl | expired | reservation_expires_at < now() (cron 15min) | stock_reservation → released, notificación cliente y vendedor |
| confirmed | cancel | cancelled | Usuario o cliente cancela | stock_reservation → released |
| confirmed | flag_issue | pending_review | Stock insuficiente al momento de cobrar, etc. | Notificación al admin |
| pending_review | resolve | confirmed | Admin valida | stock_reservation extendida |
| pending_review | reject | cancelled | Admin rechaza | stock_reservation → released |

### TTL por canal

| Canal | TTL default | Configurable |
|---|---|---|
| POS (F0 implícito) | N/A inmediato | No |
| Phone (F2) | 24h | Sí, hasta 72h |
| WhatsApp (F2) | 24h | Sí, hasta 72h |
| Web/Instagram (F2) | 30 min | Sí, hasta 24h |
| Marketplace (F3) | Según marketplace | No |

### Auditoría

Transiciones críticas (`cancelled`, `pending_review`, `expired`) generan `audit_log` con motivo.

---

## SM-02 — Sale (Venta)

🟢 **VERDE** — Núcleo del producto.

### Estados

```
[draft] (carrito en armado)
  ├── → [pending_payment] (totales calculados, esperando pago)
  └── → [cancelled] (terminal, sin efecto en stock)

[pending_payment]
  ├── → [completed] (pagos OK, sin facturar)
  ├── → [requires_invoice] (pagos OK, factura pendiente)
  └── → [cancelled] (terminal)

[requires_invoice]
  ├── → [invoice_issued] (CAE recibido)
  ├── → [requires_reconciliation] (AFIP timeout)
  ├── → [number_burned] (AFIP rechazó explícitamente)
  └── → [no_document] (venta sin factura por elección, ticket no fiscal)

[requires_reconciliation] (worker reintentando)
  ├── → [invoice_issued] (CAE recuperado)
  ├── → [number_burned] (AFIP confirmó rechazo)
  └── → [reconciliation_timeout] (terminal, 2h sin éxito)

[invoice_issued] (factura emitida, terminal "exitoso")
  ├── → [cancelled_with_nc] (anulación vía NC F1+)
  └── → [refunded] (devolución F1+)

[number_burned] (terminal, número quemado, sin factura)
[reconciliation_timeout] (terminal, sin factura, gestión externa)
[no_document] (terminal, válido operativamente sin factura)
[completed] (terminal sin factura)
[cancelled] (terminal sin efecto en stock/caja)
[cancelled_with_nc] (terminal con NC)
[refunded] (terminal con devolución)
```

### Tabla de transiciones críticas

| Estado | Acción | Destino | Precondiciones | Side effects |
|---|---|---|---|---|
| draft | add_payment | pending_payment | Items > 0 | calcular total |
| pending_payment | confirm_no_invoice | completed | Pagos === total | stock_movement, cash_movement |
| pending_payment | request_invoice | requires_invoice | Pagos === total | stock_movement, cash_movement |
| requires_invoice | afip_success | invoice_issued | CAE recibido | afip_invoice.cae, audit_log |
| requires_invoice | afip_timeout | requires_reconciliation | 30s timeout | encolar worker reconciliation |
| requires_invoice | afip_rejected | number_burned | AFIP rechazó | número quemado en invoice_sequences |
| requires_reconciliation | worker_finds_cae | invoice_issued | FECompConsultar OK | mismo que afip_success |
| requires_reconciliation | worker_finds_rejection | number_burned | AFIP confirma rechazo | número quemado |
| requires_reconciliation | timeout_2h | reconciliation_timeout | 24 intentos × 5 min | audit_log, notificación owner |
| completed | cancel | cancelled | < 24h + mismo turno + permisos | stock_movement reverso, cash_movement reverso |
| invoice_issued | cancel_with_nc | cancelled_with_nc | F1+, motivo obligatorio | NC emitida, stock reverso, cash reverso |

### Estado terminal `reconciliation_timeout`

🟢 **VERDE** — Sesión 1, Fix 5.

- Trigger: 2 horas sin resolución de AFIP.
- Acción: número quemado definitivo.
- Notificación obligatoria: email + Sentry alert al owner del tenant.
- Auditoría: motivo automático "AFIP no respondió tras 2hs de reconciliación".
- UI: ticket no fiscal definitivo, comerciante gestiona manualmente con AFIP.

🟡 **AMARILLO** — La venta queda válida operativamente (cobrada, mercadería entregada). Solo factura queda pendiente. Requiere validación de contador para producción real.

---

## SM-03 — Invoice (Factura AFIP)

🟢 **VERDE**

### Estados

```
[pending] (insertada, AFIP no contactado)
  ├── → [sending] (enviando a WSFEv1)
  └── → [cancelled] (terminal, antes de enviar)

[sending]
  ├── → [issued] (CAE recibido OK)
  ├── → [failed] (AFIP rechazó)
  └── → [timeout] (30s sin respuesta)

[timeout]
  └── → [requires_reconciliation] (worker reintenta)

[requires_reconciliation]
  ├── → [issued] (CAE recuperado)
  ├── → [burned] (AFIP confirmó rechazo)
  └── → [reconciliation_timeout] (terminal, 2h)

[issued] (terminal exitoso, CAE válido)
[failed] (terminal, requiere análisis)
[burned] (terminal, número consumido)
[reconciliation_timeout] (terminal, sin CAE)
[cancelled] (terminal antes de envío)
```

### Reglas

- Una `sale` puede tener 0 o 1 `afip_invoice`.
- Una vez `issued`, el invoice es inmutable.
- Modificación = nueva factura (sustitución) o NC (cancelación).
- `customer_snapshot` capturado al pasar a `sending` es inmutable.

---

## SM-04 — Payment (Pago de venta)

🟢 **VERDE**

### Estados

```
[pending] 
  ├── → [processing] (enviado a procesador externo)
  ├── → [confirmed] (efectivo recibido, cheque conformado, transferencia OK)
  └── → [cancelled] (terminal)

[processing]
  ├── → [confirmed] (procesador confirma — webhook MP, conformación bancaria)
  ├── → [failed] (procesador rechaza)
  └── → [timeout] (sin respuesta en N min)

[failed]
  └── → [pending] (operador reintenta si sale sigue abierta)

[timeout]
  ├── → [confirmed] (webhook tardío)
  ├── → [failed] (24h sin webhook)
  └── → [reconciliation_pending] (admin revisa manual)

[confirmed] (terminal salvo refund)
  └── → [refunded] (vía NC o anulación)

[refunded] (terminal)
[cancelled] (terminal)
[reconciliation_pending] (admin manual)
```

### Timeouts por procesador

| Procesador | Timeout pending → timeout | Timeout final |
|---|---|---|
| MercadoPago QR | 5 min | 24h |
| Tarjeta presente | N/A síncrono | N/A |
| Transferencia bancaria | 24h | 7 días |
| Cheque | N/A manual | N/A |
| Efectivo | N/A instantáneo | N/A |

### Idempotencia

- Webhook MP: por `external_reference + event_id`.
- Refunds vía NC: por `credit_note_id`.

---

## SM-05 — CashSession (Turno de caja)

🟢 **VERDE** — Versión unificada con reversión (Sesión 3.5).

### Estados

```
[closed] (terminal del turno anterior)
  └── → [opening] (admin/cashier inicia)

[opening] (transitorio breve)
  ├── → [open] (apertura completada con monto inicial)
  └── → [closed] (cancelado)

[open]
  ├── → [closing] (cashier inicia cierre voluntario)
  └── → [force_closing] (cron + inactividad + smart detection negativa)

[closing] (cashier contando efectivo)
  ├── → [closed] (arqueo OK dentro de tolerancia)
  ├── → [closed_with_difference] (descuadre > tolerancia + motivo)
  └── → [open] (cashier cancela cierre)

[force_closing] (cron forzando, 1h de gracia)
  ├── → [open] (admin/owner revierte con motivo) ← NUEVO
  ├── → [closing] (cashier responde y completa cierre normal) ← NUEVO
  └── → [force_closed] (1h sin respuesta — terminal)

[closed] (terminal — permite próximo turno)
[closed_with_difference] (terminal con audit)
[force_closed] (terminal — pending reconciliation)
```

### Transición clave: reversión

| Acción | Quién | Requiere |
|---|---|---|
| `force_closing → open` | admin/owner | Motivo obligatorio |
| `force_closing → closing` | cashier | Continúa cierre voluntario |
| `force_closing → force_closed` | sistema | 1h sin respuesta ni reversión |

### Cron force-close

🟢 **VERDE** — Configurable + smart detection (Sesión 3 + 3.5).

- Worker: `cron-cash-session-force-close`
- Frecuencia: cada 5 minutos
- Lógica: ver Sección 10.4

### Tenant fiscal snapshot

🟢 **VERDE** — Crítico (Sesión 3.5).

- NOT NULL en cash_sessions.
- Capturado al abrir turno.
- Todas las ventas del turno lo usan, no consultan estado actual del tenant.
- Bloqueo: owner no cambia condición IVA con turnos abiertos.

---

## SM-06 — StockReservation

🟢 **VERDE** F2+ (en F0 está latente).

### Estados

```
[active] (reserva creada por Order confirmado)
  ├── → [converted] (Sale completada, reserva → deducción dura)
  ├── → [released] (Order cancelado o modificado, stock vuelve)
  └── → [expired] (TTL alcanzado por cron)

[converted] (terminal)
[released] (terminal)
[expired] (terminal)
```

### TTL por canal

Ver Sección 8.7.

### Edge cases

- **Producto eliminado mientras hay reserva:** la reserva expira normal, producto inactivo. Cuando vuelve disponible: stock_available refleja real.
- **Cambio de precio mientras hay reserva:** Order mantiene precio reservado (price_locked_at). Sale resultante usa ese precio.
- **Stock físico insuficiente al convertir:** error explícito, Order → `pending_review`, admin resuelve manual.

---

## SM-07 — WebhookEvent (inbound + outbound)

🟢 **VERDE**

### Estados (inbound, ej: MP webhook)

```
[received]
  ├── → [validating] (verificando HMAC, idempotencia)
  ├── → [rejected] (terminal, firma inválida)
  └── → [malformed] (terminal, payload inválido)

[validating]
  ├── → [processing] (firma OK, payload OK, encolado)
  └── → [duplicate] (terminal, idempotente — ya procesado)

[processing]
  ├── → [completed] (procesado OK)
  ├── → [failed] (error processable, retry)
  └── → [dead_letter] (terminal, max retries)

[failed]
  └── → [processing] (retry con backoff exponencial)

[completed] (terminal)
[dead_letter] (terminal, requiere intervención)
```

### Retry policy

```
Retry 1: 30s después
Retry 2: 2 min
Retry 3: 10 min
Retry 4: 1 hora
Retry 5: 6 horas
Después: dead_letter
```

### Idempotencia

`UNIQUE (source, external_event_id)`:
- source: 'mercadopago', 'afip', etc.
- external_event_id: ID del sistema externo.
- Si llega webhook con mismo par: status `duplicate`, devuelve 200 sin procesar.

### DLQ handling

- Dashboard admin con queue de items en DLQ.
- Cada item con payload, error, intentos.
- Admin puede: reintentar manual, marcar ignorar, investigar.

---

## SM-08 — BackgroundJob

🟢 **VERDE**

### Estados

```
[queued]
  └── → [running] (worker toma)

[running]
  ├── → [succeeded] (sin error)
  ├── → [failed] (excepción)
  └── → [timeout] (excede max_duration)

[failed]
  ├── → [retrying] (retries < max)
  └── → [dead_letter] (retries >= max, terminal)

[retrying]
  └── → [running] (backoff alcanzado)

[timeout]
  └── → [dead_letter] (no retry-amos timeouts, son bug)

[succeeded] (terminal)
[dead_letter] (terminal)
```

### Jobs Fase 0

| Job | Trigger | Frecuencia | Max retries |
|---|---|---|---|
| afip-reconciliation | Sale en requires_reconciliation | 5 min | 24 (= 2h) |
| email-send | Operación de negocio | Inmediato | 3 |
| cron-cash-session-force-close | Configurable | 5 min | 1 |
| cron-certificate-expiry-check | Diario 09:00 | Diario | 1 |
| cron-trial-extension-reminder | Diario 10:00 | Diario | 1 |
| cron-subscription-suspension | Diario 03:00 | Diario | 1 |
| cron-idempotency-cleanup | Mensual día 1 | Mensual | 1 |
| cron-audit-log-archive | Mensual día 1 | Mensual | 1 |

### Prioridades

- Crítica: afip-reconciliation, email transaccional.
- Normal: crons diarios.
- Baja: archivado, cleanup, reportes.

### Idempotencia obligatoria

- Cada job tiene `idempotency_key` UUID.
- Worker crashea → job vuelve a queue → reintenta.
- Handlers idempotentes: ejecutar 2 veces no duplica efectos.

---

## SM-09 — ImportJob (CSV)

🟢 **VERDE**

### Estados

```
[uploaded]
  └── → [parsing]

[parsing]
  ├── → [validating] (parsing OK)
  └── → [parse_error] (terminal, archivo corrupto)

[validating]
  ├── → [previewed] (validación OK, esperando confirm)
  └── → [validation_error] (terminal, requiere CSV corregido)

[previewed] (preview con TTL 24h)
  ├── → [applying] (usuario confirma)
  ├── → [cancelled] (terminal)
  └── → [expired] (terminal, TTL 24h)

[applying]
  ├── → [applied] (terminal, todas las filas OK)
  ├── → [partial_applied] (terminal, algunas filas fallaron)
  └── → [rolled_back] (terminal, rollback completo por error transversal)
```

### Validaciones obligatorias

**Productos:**
- SKU único (no existe en empresa)
- Barcode único si presente
- Precio > 0
- IVA rate válido (alícuota AFIP)
- Categoría existente o auto-crear

**Clientes:**
- CUIT formato válido si presente
- Email formato válido si presente
- Deduplicación por (document_type, document_number)

### Rollback

`rolled_back`: DELETE de todos los INSERT con `import_id`. stock_movements iniciales también.
`partial_applied`: filas OK quedan, fallidas en reporte descargable.

---

## SM-10 — ExportJob

🟢 **VERDE**

### Estados

```
[queued]
  └── → [generating]

[generating]
  ├── → [ready] (archivo en Storage, URL pre-signed)
  └── → [generation_error] (terminal)

[ready]
  ├── → [downloaded] (usuario bajó)
  ├── → [expired] (terminal, TTL)
  └── → [revoked] (terminal, admin revoca)

[downloaded]
  └── → [expired] (terminal)
```

### TTL por tipo

| Tipo | TTL |
|---|---|
| CSV ventas | 7 días |
| Libro IVA mensual (F1) | 30 días |
| Backup completo tenant | 24h (urgente) |
| Datos personales (derecho al olvido) | 7 días, 1 descarga |

### Seguridad

- URLs pre-signed Supabase Storage.
- TTL en URL, no solo en DB.
- Acceso verificado contra tenant + user.
- Audit log de descarga: quién, cuándo, qué, IP.

---

## SM-11 — Integration

🟢 **VERDE**

### Estados

```
[unconfigured] (default)
  └── → [configuring]

[configuring]
  ├── → [pending_validation] (datos cargados, validando con servicio externo)
  └── → [unconfigured] (owner cancela)

[pending_validation]
  ├── → [active] (validación exitosa)
  ├── → [validation_failed] (credenciales inválidas)
  └── → [unconfigured] (owner abandona)

[validation_failed]
  ├── → [configuring] (owner corrige)
  └── → [unconfigured] (owner abandona)

[active]
  ├── → [paused] (owner pausa temporalmente)
  ├── → [degraded] (servicio intermitente, alertas)
  ├── → [expired] (credenciales vencidas — cert AFIP)
  └── → [revoked] (owner revoca)

[paused]
  ├── → [active] (owner reactiva)
  └── → [revoked] (owner revoca definitivo)

[degraded]
  ├── → [active] (servicio se normaliza)
  └── → [expired] (problema persiste)

[expired]
  ├── → [configuring] (owner renueva)
  └── → [revoked] (owner abandona)

[revoked] (terminal)
```

### Por integración

**AFIP:**
- Validación: WSAA devuelve token OK.
- Alertas vencimiento cert: 30/15/7/3/1 días.

**MercadoPago:**
- Validación: consulta dummy a MP API.
- Degraded si webhooks > 10% fallan.

**WhatsApp Cloud API (F1+):**
- Validación: Business Manager ID + token + al menos 1 template aprobado.
- Pending_validation puede loop 24-72h esperando aprobación de Meta.

---

## SM-12 — OfflineSync (F2+)

🟡 **AMARILLO** — Definida para preparar arquitectura, implementación F2.

### Estados (por operación local)

```
[pending] (offline en queue local)
  └── → [syncing] (conexión disponible, enviando)

[syncing]
  ├── → [synced] (terminal, servidor acepta)
  ├── → [conflict] (servidor detecta conflicto)
  └── → [rejected] (terminal, validación falla)

[conflict]
  ├── → [resolved_user] (usuario decide)
  └── → [resolved_auto] (regla automática)

[resolved_user] → [synced] (terminal)
[resolved_auto] → [synced] (terminal)
[rejected] (terminal, acción manual)
[synced] (terminal)
```

### Resolución de conflictos

🟢 **VERDE** — Corregido en Sesión 3.5.

| Conflicto | Política |
|---|---|
| Stock insuficiente | Servidor gana. Modal: modificar venta o cancelar. |
| Cliente eliminado en server | **NO reasignar automático.** Modal: "Asignar Consumidor Final" / "Anular" / "Reactivar cliente". |
| Producto eliminado | Bloquear sync, marcar revisión manual. |
| Precio cambió | Mantener precio local (lock al vender). Notificar admin. |
| Caja cerrada server mientras vendía offline | Pasan a caja del próximo turno. Audit. |
| Idempotencia: mismo client_id 2 veces | Ignorar duplicado, devolver resultado anterior. |

### Idempotencia

- Cada operación local: `client_id` UUID generado offline.
- Server detecta duplicados por `(tenant_id, client_id)`.
- Re-sync: devuelve resultado anterior.

### Detección de conexión

```
1. Ping cada 30s con timeout 5s
2. Browser online/offline events
3. Failed request detection

Estados:
- online
- degraded (pings > 2s o intermitentes)
- offline (3 pings fallidos consecutivos)
```

---

# 17. Riesgos estructurales

🟢 **VERDE** + 🟡 **AMARILLO** (algunos riesgos requieren validación contable/legal)

## 17.1 Matriz de riesgos

24 riesgos cuantificados con probabilidad / impacto / mitigación / timing.

### Riesgos técnicos críticos

| ID | Riesgo | Prob | Impacto | Mitigación | Trigger |
|---|---|---|---|---|---|
| R-01 | Cross-tenant leak en producción | Media | Crítico | Defensa en profundidad (RLS + Application + tests) | Cualquier leak → freezar tenant, postmortem |
| R-02 | AFIP cae durante operación | Alta | Alto | Timeout 30s + ticket no fiscal + reconciliation 2h | Activo desde día 1 |
| R-03 | Deadlock en hot path de ventas | Alta | Alto | Retry serializable con backoff (ADR-0011) | Métrica > 1% retry exhausted |
| R-04 | Connection pool exhausted | Media | Alto | Monitor + alertas + upgrade Supabase Pro | > 80% uso pool sostenido |
| R-05 | Cron force-close en comercio 24h | Alta | Medio | Configurable + smart detection + opt-out | Comerciante reporta cierre indebido |
| R-06 | Padrón AFIP A5 inactivo en cliente | Media | Alto | Revalidación hot path > 24h cache | Bloquear emisión si CUIT inactivo |
| R-07 | Storage explotando con PDFs (10 años) | Alta | Medio | Cron mensual archive a S3 Glacier | Storage > 80% de quota |
| R-08 | Cost Supabase escalando peor que ingresos | Media | Alto | Monitor mensual cost/customer | > 15% revenue en infra |

### Riesgos operativos

| ID | Riesgo | Prob | Impacto | Mitigación |
|---|---|---|---|---|
| R-09 | Falla cascada Resend/Twilio | Baja | Alto | Fallback entre canales + cola persistente |
| R-10 | Bounce email masivo (reputación dominio) | Media | Medio | DNS correcto + monitoreo + IP warming |
| R-11 | Borrado accidental por owner | Baja | Crítico | 2-step + delay 7 días + email cancelación |
| R-12 | Concurrencia en cierre de turno | Baja | Bajo | Lock + isolation serializable |
| R-13 | Tipo de cambio impacta MP cobros USD | Alta | Medio | Documentar exposición |
| R-14 | Padrón A5 con CUITs prueba en producción | Baja | Medio | Cache 7 días + revalidación hot path |
| R-15 | DLQ acumulando jobs | Media | Medio | Alerta > 10 items + dashboard admin |

### Riesgos comerciales

🟡 **AMARILLO** — Requieren validación con clientes reales.

| ID | Riesgo | Prob | Impacto | Mitigación |
|---|---|---|---|---|
| R-16 | Pricing no validado ($25k/$60k) | Alta | Crítico | Pricing tiered + entrevistas + landing tests |
| R-17 | Metas comerciales irreales (5k clientes mes 24) | Alta | Medio | Marcar metas como aspiracionales |
| R-18 | Tango/Bejerman bajan precios | Media | Medio | Diferenciación por UX/contador integrado |
| R-19 | Inflación argentina erosionando ARR ARS | Alta | Alto | Ajuste trimestral IPC + métricas en USD |
| R-20 | Churn alto post-Fase 0 | Media | Alto | Onboarding fluido + soporte WhatsApp |
| R-21 | Adopción de contador como canal lenta | Alta | Medio | Marketing directo a contadores Fase 1 |

### Riesgos legales/fiscales

🟡 **AMARILLO** — Validar con abogado y contador.

| ID | Riesgo | Prob | Impacto | Mitigación |
|---|---|---|---|---|
| R-22 | "Ticket no fiscal válido" no acepta AFIP retroactivo | Media | Crítico | ⚠️ Validar con contador |
| R-23 | Compliance Ley 25.326 (datos personales) | Alta | Crítico | ⚠️ Validar con abogado + inscripción AAIP |
| R-24 | Retención 10 años XML AFIP | Alta | Medio | Cron archive + S3 Glacier |

## 17.2 Plan de mitigación de R-22 (ticket no fiscal)

🟡 Crítico para validar antes de producción.

**Hipótesis actual:** la venta es válida operativamente (cobrada, mercadería entregada). Solo factura queda pendiente, se resuelve fuera del sistema con el contador del comerciante.

**Antes de primer cliente pagando:**
- Consultar a contador advisor (1 sesión one-shot ~$30-50k ARS).
- Confirmar interpretación legal.
- Si la interpretación es incorrecta: cambiar política a "venta se anula automáticamente si AFIP no responde tras 2h".

## 17.3 Plan de mitigación de R-23 (Ley 25.326)

🟡 Crítico para compliance.

**Antes de primer cliente pagando:**
- Consultar a abogado (1 sesión one-shot).
- Inscripción obligatoria en AAIP (Agencia de Acceso a la Información Pública) como responsable de base de datos.
- Redactar política de privacidad.
- Redactar DPAs (Data Processing Agreements) modelo para cada cliente.
- Definir procedimiento de derecho al olvido (cómo eliminar datos personales si cliente lo solicita).

## 17.4 Riesgo macro: inflación

🟢 **VERDE** — Documentado (Sesión 3.5).

Argentina tiene inflación mensual > 5%. Comerciantes cargan precios en ARS y los cobran días/semanas después. Entre carga y cobro, el precio real puede haber bajado significativamente.

**Manifestaciones operativas:**
- Precios cargados con delay.
- Listas sin auto-update.
- Cuentas corrientes en pesos.
- Pricing del SaaS Pandora en ARS erosionado.

**Mitigaciones de producto (F1+):**
- Listas con factor de actualización masiva.
- Cuentas corrientes con ajuste por CER/IPC/USD opcional.
- Sugerencia de revisión cuando IPC mensual > 5%.

**Mitigaciones comerciales:**
- Ajuste trimestral obligatorio de planes por IPC INDEC.
- Métricas internas en USD MRR equivalente.
- Comunicación transparente: "Tu plan se ajusta el día X".

**Decisión arquitectónica:** NO implementar ajuste automático de precios del comerciante en F0-2. Es decisión de producto del comerciante. Pandora provee herramientas.

---

# 18. Roadmap por fases

🟢 **VERDE** + 🟡 **AMARILLO** (metas comerciales aspiracionales)

## 18.1 Fase 0 — Validación (semanas 1-16)

**Meta operativa:** 5 clientes pagando.
**Meta comercial:** $1.5M-3M ARS ARR (~$1.5K-3K USD MRR).
**Meta técnica:** producto operable 8-12h diarias en POS con AFIP estable.

**Funcionalidades obligatorias:**
- Multi-tenant con RLS + auth.jwt()
- Auth + Onboarding 3 pasos
- POS con keyboard-first + atajos F1-F12
- Catálogo simple (productos, categorías, IVA)
- Stock con movimientos auditados
- Caja con apertura/cierre + smart detection + reversión
- Ventas con pagos mixtos
- Facturación AFIP sincrónica + reconciliación async
- Anulación < 24h + mismo turno
- Clientes con CUIT + Padrón A5
- Modo demo 14d + 7d extensión + bloqueo
- Acceso contador gratuito multi-empresa
- Dashboard básico + reportes esenciales
- Audit log inmutable server-side
- Suscripción MercadoPago + suspensión por impago
- Email Resend + SMS Twilio crítico

**Visual:**
- 3 atmospheres implementadas (Atmosphere/Operational/Critical)
- Dawn Sky únicamente (otros moods F1+)
- Light mode (dark F1+)
- Glass system con degradación por hardware
- 4 charts SVG migrados

**No incluido F0:**
- Multi-sucursal operativa
- Múltiples depósitos
- Compras
- NC (sí infraestructura preparada)
- WhatsApp Business
- Cuenta corriente
- BI avanzado
- Conciliación bancaria

## 18.2 Fase 1 — Expansión (semanas 17-28)

**Meta:** 30-50 clientes activos. ARR $5M-12M ARS.

**Nuevo:**
- Multi-sucursal y multi-depósito
- Compras y proveedores
- Notas de crédito (NC) con flujo completo
- Cuenta corriente de clientes
- Variantes de producto (matriz simple)
- WhatsApp Business Cloud API (opcional)
- Dark mode completo
- Modo nocturno auto-detect por hora
- Sky moods configurables (dawn/noon/dusk)
- Dashboard contador completo (multi-empresa)
- Reportes avanzados (ventas por canal, top productos, etc.)
- Worker dedicado Railway + BullMQ
- Axiom o Better Stack para logs
- Tests sintéticos en producción

## 18.3 Fase 2 — Omnicanal (semanas 29-44)

**Meta:** 200 clientes. ARR $25M-50M ARS.

**Nuevo:**
- Pedidos omnicanal (WhatsApp, Instagram, web simple)
- Stock reservations con TTL por canal
- Modo offline POS con sync de operaciones
- Conciliación bancaria semi-automática (CSV)
- Notas de débito
- BI básico con dashboards customizables
- OpenTelemetry tracing distribuido
- Notification push web
- App móvil para owner (consulta, no operación)

## 18.4 Fase 3 — Plataforma (meses 10-18)

**Meta:** 500-1000 clientes. ARR $60M-120M ARS.

**Nuevo:**
- Marketplace de módulos internos (todos desarrollados por Pandora)
- BI/Analytics avanzado
- Módulo gastronomía (si valida)
- Módulo sucursales jerárquicas (franquicia básica)
- Reportes contables avanzados
- API pública v1 (REST + HMAC + idempotencia)
- White-label básico (logo en tickets)

## 18.5 Fase 4 — Ecosistema (meses 18-24)

**Meta:** 2000+ clientes. ARR $150M+ ARS.

**Nuevo:**
- Programa de partners externos
- Revenue share 70/30 → 80/20
- Sandbox de testing para partners
- Marketplace público de extensiones
- Theming custom per tenant (Business+)
- Modo multi-país preparado (es-UY, es-CL evaluación)

## 18.6 Fase 5 — Madurez (mes 24+, aspiracional)

**No calendarizable. Solo aspiracional.**

- 5000+ clientes
- Multi-país operativo (UY, CL, MX evaluación)
- Trigger condicional Serie A si justifica (2000+ clientes y $25M ARR)
- BI predictivo con ML
- Optimizaciones masivas de costo (read replicas, archiving distribuido)

**Nota:** Fase 5 es objetivo aspiracional, no compromiso de cronograma. Depende de validación de pricing, capacidad de adquisición, restricciones macro argentinas.

## 18.7 Escenario pesimista

🟡 **AMARILLO** — Importante mantener plan B.

**Si Fase 0 tarda 24-26 semanas en vez de 14-16:**
- Re-evaluar pricing.
- Considerar pivot a nicho específico (solo kioscos, o solo mercerías).
- Reducir scope F1 a esenciales: NC + cuenta corriente solamente.

**Si Fase 1 no alcanza 30 clientes en mes 7:**
- Reducir scope F2 al mínimo.
- Postergar omnicanal a F3.
- Foco en retention sobre adquisición.

**Si churn > 30% mensual en F0:**
- Detener desarrollo de features F1.
- Investigar por qué se van.
- Considerar refactor de producto basado en feedback.

---

# 19. Decisiones de NO hacer

🟢 **VERDE** — Decisiones explícitas, no por omisión.

## 19.1 Lo que Pandora NO va a ser

- ❌ Un Excel mejorado
- ❌ Un facturador AFIP genérico
- ❌ Un POS minimalista sin ERP
- ❌ Un ERP corporativo (SAP, Oracle)
- ❌ Una plataforma de e-commerce (Shopify, Tiendanube)
- ❌ Un software de contabilidad puro (Tango, Bejerman)
- ❌ Un sistema gastronómico especializado (F0-2)
- ❌ Multi-país desde día 1
- ❌ Un producto white-label genérico

## 19.2 Lo que Pandora NO va a tener (F0-3)

- ❌ Apps móviles nativas (consulta sí F2, operación nunca)
- ❌ Marketplace externo abierto F0-3
- ❌ Customización visual por usuario individual
- ❌ Plugin/extensiones de terceros sin review
- ❌ Integraciones con sistemas legacy bajo demanda
- ❌ Soporte 24/7 humano F0-1
- ❌ SLA contractuales con garantías de uptime F0-1
- ❌ Multi-currency operativo F0-3

## 19.3 Decisiones técnicas de NO hacer

- ❌ Microservicios desde día 1 (ADR-0007)
- ❌ Kafka / RabbitMQ (ADR-0007)
- ❌ Kubernetes (ADR-0007)
- ❌ MongoDB / NoSQL (ADR-0001)
- ❌ GraphQL público (REST + Server Actions)
- ❌ plpgsql para lógica de negocio (ADR-0003)
- ❌ Schema-per-tenant (ADR-0002)
- ❌ Tauri / desktop apps
- ❌ Web Serial API para impresoras (impresión vía PDF browser)
- ❌ Múltiples cloud providers (todo Vercel + Supabase + Railway)
- ❌ Float / double para money (ADR-0005)

## 19.4 Decisiones de UX de NO hacer

🟢 **VERDE** — Sección 14.17.

- ❌ Tutoriales onboarding largos
- ❌ Gamificación
- ❌ Chat in-app
- ❌ Upselling en venta
- ❌ Social sharing
- ❌ Push de marketing
- ❌ Skin/temas personalizables F0-2
- ❌ Tour interactivo del POS
- ❌ Estadísticas comparativas anónimas con otros comercios
- ❌ Mobile POS operativo (solo consulta)

## 19.5 Decisiones visuales de NO hacer

🟢 **VERDE** — Sección 15.

- ❌ Tilt 3D en POS u operational
- ❌ Parallax sky en POS o critical
- ❌ Counter shine en montos fiscales
- ❌ Animaciones > 2s en entrada
- ❌ Glassmorphism en pantallas críticas
- ❌ Live ticker en POS (números reales sin animar)
- ❌ 3D / WebGL en UI
- ❌ Custom fonts pesadas (Inter + JetBrains alcanzan)
- ❌ Lottie animations F0
- ❌ Per-tenant theming F0-2
- ❌ White-label completo F0-3

## 19.6 Por qué importa documentar el NO

Sin estas decisiones documentadas:
- Cada nuevo dev las cuestiona y las re-evalúa.
- Aparecen feature requests de clientes que parecen razonables pero rompen la dirección.
- Se acumula deuda por features que se construyen y después se eliminan.

**Las decisiones de NO hacer son ADRs implícitos.** Si querés cambiar una, primero documentás el cambio.

---

*[Sesión 4 — Parte 4 de 5 — Continúa en parte 5 final: apéndices + 17 ADRs + README]*
# 20. Apéndices

## Apéndice A — Glosario unificado

🟢 **VERDE**

| Término | Definición | Categoría |
|---|---|---|
| **AFIP / ARCA** | Administración Federal de Ingresos Públicos / Agencia de Recaudación y Control Aduanero (nuevo nombre desde 2024). Organismo fiscal argentino. | Fiscal |
| **Application Service** | Capa TypeScript que orquesta lógica de negocio. Ejemplo: `SaleService.create()`. Vive en `src/lib/services/`. | Arquitectura |
| **Atmosphere** | Nivel visual del sistema. Tres valores: `atmosphere`, `operational`, `critical`. | Visual |
| **Audit log** | Tabla `audit_log` append-only y write-only server-side. Registra todas las operaciones críticas. Retención 10 años. | Compliance |
| **AuditService.log()** | Función única para escribir en audit_log. Recibe `tx` (transacción) obligatoria. | Arquitectura |
| **Backfill** | Llenar valores en filas existentes durante una migración. Necesario antes de `SET NOT NULL`. | DB |
| **BullMQ** | Library de queues sobre Redis para jobs async. Activa Fase 1+. | Stack |
| **CAE** | Código de Autorización Electrónico. Lo emite AFIP cuando aprueba una factura. | Fiscal |
| **Cash session** | Turno de caja. Modelo `cash_sessions`. | Negocio |
| **CER** | Coeficiente de Estabilización de Referencia. Ajuste por inflación. | Macro |
| **Consumidor Final** | Cliente sin CUIT/condición fiscal. Default de cualquier tenant. | Fiscal |
| **Correlation ID** | UUID generado al inicio de una request HTTP. Se propaga end-to-end para trazabilidad. | Observabilidad |
| **Critical (atmosphere)** | Superficie fiscal/destructiva. Cero motion, alta legibilidad. | Visual |
| **Cross-tenant leak** | Bug donde un usuario de tenant A ve datos de tenant B. Crítico. | Seguridad |
| **Customer snapshot** | Datos del cliente capturados al momento de la venta. Inmutable. | Negocio |
| **Dawn Sky** | Identidad visual permanente de Pandora. Background pastel de amanecer. | Visual |
| **Defensa en profundidad** | Múltiples capas de seguridad. Aplicación + RLS + tests. | Seguridad |
| **Density** | Espaciado vertical/horizontal. `tight` (POS), `comfortable` (dashboard), `spacious` (onboarding). | Visual |
| **Dominio (bounded context)** | Conjunto de entidades + lógica con responsabilidad clara. Ejemplo: Sales, Fiscal, Cash. | Arquitectura |
| **Drizzle** | ORM TypeScript para PostgreSQL. Usado en lugar de Prisma. | Stack |
| **DLQ** | Dead Letter Queue. Cola de jobs/webhooks que fallaron todos los retries. | Observabilidad |
| **FECompUltimoAutorizado** | Método de WSFEv1 que devuelve el último número autorizado por AFIP para un (PV, tipo). Usado para reconciliación. | Fiscal |
| **FECompConsultar** | Método de WSFEv1 que devuelve detalles de un comprobante específico. | Fiscal |
| **Force close** | Cierre forzado de turno por cron + smart detection + inactividad. | Negocio |
| **Glass** | Material visual translúcido con `backdrop-filter: blur()`. | Visual |
| **Hot path** | Camino crítico de una operación. Ejemplo: hot path de venta incluye AFIP. | Performance |
| **Idempotency key** | UUID generado por el cliente para garantizar que reintentos no duplican operaciones. | Arquitectura |
| **Idempotency_log** | Tabla que persiste resultado de operaciones idempotentes. Hot 90 días, cold 1 año. | DB |
| **Iva Condition** | Condición frente al IVA: RI (Responsable Inscripto), Monotributo, Exento, Consumidor Final, No Responsable. | Fiscal |
| **Lock pesimista** | `SELECT FOR UPDATE` en transacción. Bloquea fila hasta commit/rollback. | DB |
| **Modo demo** | Estado inicial de cuenta nueva. 14 días + 7 extensión + bloqueo. Sin AFIP real, comprobantes con marca "DEMO". | Producto |
| **Modo lectura** | Estado de cuenta con impago día 11-30. Puede consultar pero no operar. | Billing |
| **Monotributo** | Régimen simplificado fiscal argentino. Condición IVA específica. | Fiscal |
| **NC (Nota de Crédito)** | Comprobante fiscal que anula o reduce una factura. F1+ en Pandora. | Fiscal |
| **OKLCH** | Espacio de color con luminosidad consistente entre hues. | Visual |
| **Operational (atmosphere)** | Superficie de workflow. Tight, fast, low fatigue. | Visual |
| **Padrón AFIP A5** | Servicio AFIP para validar CUIT y condición IVA. Cache 7 días + revalidación 24h. | Fiscal |
| **Parallax sky** | Sky de fondo que se mueve con el cursor. Solo activo en atmosphere. | Visual |
| **Pino** | Logger estructurado para Node.js. Stack canónico Pandora. | Stack |
| **PV (Punto de Venta)** | Sale point fiscal AFIP. Identifica origen de comprobantes. | Fiscal |
| **Reconciliation timeout** | Estado terminal cuando AFIP no responde en 2h tras timeout original. Sale queda sin factura. | Fiscal |
| **Reduced motion** | Preferencia OS que desactiva animaciones. Respetada por todo el visual system. | Accesibilidad |
| **RLS (Row Level Security)** | Feature PostgreSQL que filtra filas por policy. Pandora usa policies con `auth.jwt()`. | DB |
| **Retry serializable** | Política de reintentos para errores 40001/40P01. Max 3 con backoff 50/150/400ms. | Arquitectura |
| **Sale snapshot** | Datos de cliente, producto y precios capturados al momento de la venta. Inmutables. | Negocio |
| **Sentry** | Servicio de error tracking. Tags obligatorios: tenant_id, user_id, correlation_id, action. | Observabilidad |
| **Serializable** | Isolation level más estricto de PostgreSQL. Default en hot path de Pandora. | DB |
| **Smart detection** | Verificación de actividad reciente antes de cerrar turno por cron. | Negocio |
| **Snapshot inmutable** | Datos capturados en un momento específico que nunca se reescriben. Customer snapshot, tenant fiscal snapshot. | Arquitectura |
| **Soft delete** | Eliminación lógica con `deleted_at` timestamp. Histórico se preserva. | DB |
| **Sotos** | Servicio gratuito de validación CUIT (alternativa a Padrón A5). | Fiscal |
| **Stagger** | Animación con delay incremental entre elementos. 60ms en atmosphere. | Visual |
| **Stock reservation** | Reserva blanda de stock para pedidos confirmados sin cobrar. F2+. | Negocio |
| **Supabase** | Stack managed: PostgreSQL + Auth + Storage. Backbone de Pandora. | Stack |
| **Supavisor** | Connection pooler de Supabase. Razón por la que NO usamos `current_setting`. | DB |
| **TC** | Tipo de Cambio. Métricas se trackean en USD MRR equivalente. | Macro |
| **Tenant** | Cliente del SaaS (empresa). Cada uno con su `company_id`. | Multi-tenancy |
| **Tenant fiscal snapshot** | Condición fiscal del tenant capturada al abrir turno. Inmutable durante el turno. | Negocio |
| **Tilt 3D** | Animación de inclinación con mouse. Solo en atmosphere. ±4°. | Visual |
| **Ticket no fiscal** | Comprobante interno emitido cuando AFIP no responde. Sin valor fiscal hasta reconciliación. | Fiscal |
| **TTL** | Time To Live. Tiempo de vida de un dato antes de expirar. | Arquitectura |
| **WSAA** | Web Service de Autenticación y Autorización AFIP. Login con certificado X.509. | Fiscal |
| **WSFEv1** | Web Service de Factura Electrónica AFIP versión 1. | Fiscal |

## Apéndice B — Checklist de Readiness

🟢 **VERDE** + 🟡 **AMARILLO** (algunos items requieren validación humana antes de producción)

### B.1 Pre-código (antes del primer commit productivo)

- [ ] Repo configurado con CLAUDE.md como fuente de verdad operativa
- [ ] Supabase project creado (dev + staging + producción)
- [ ] Vercel project creado con variables de entorno
- [ ] Resend account con dominio verificado (SPF/DKIM/DMARC)
- [ ] Twilio account con número argentino
- [ ] AFIP homologación: certificado de prueba obtenido
- [ ] MercadoPago: cuenta de prueba + producción
- [ ] Sentry project configurado
- [ ] Vercel Analytics activado
- [ ] Tokens en CSS custom properties cargados
- [ ] AtmosphereProvider + Surface + GlassCard implementados
- [ ] Hardware detection funcional
- [ ] 3 atmospheres validadas visualmente en dev
- [ ] 4 charts SVG migrados a TSX
- [ ] Hooks (useCountUp, useLiveTicker, use3DTilt) en TypeScript
- [ ] Icon set migrado
- [ ] Schema base con migrations Drizzle
- [ ] Tests cross-tenant configurados en CI
- [ ] Test de pool de conexiones en CI

### B.2 Pre-primer cliente real (validación humana)

🟡 Críticos antes de pricing y producción.

- [ ] Consulta con contador advisor:
  - [ ] Política de "venta sin factura tras 2h" validada
  - [ ] Esquema de retención XML AFIP confirmado
  - [ ] Motivos obligatorios fiscales en operaciones destructivas
  - [ ] Política de redondeo (half-up vs half-even)
  - [ ] Campos obligatorios en customer_snapshot por tipo de comprobante
  - [ ] Revalidación CUIT en hot path
- [ ] Consulta con abogado:
  - [ ] Audit_log con cierre estricto cumple Ley 11.683
  - [ ] Privacidad de exports de datos personales
  - [ ] Compliance con Ley 25.326
  - [ ] T&C con limitación de responsabilidad
  - [ ] Inscripción AAIP (Agencia de Acceso a la Información Pública)
  - [ ] DPAs (Data Processing Agreements) modelo
- [ ] Validación de pricing con 3-5 comerciantes reales del target
- [ ] Demo del producto a 3 contadores externos

### B.3 Pre-deploy a producción

- [ ] Backup automatizado de DB configurado
- [ ] Snapshot semanal a S3 propio
- [ ] DNS configurado: SPF, DKIM, DMARC, MX
- [ ] HTTPS forzado en todos los dominios
- [ ] Rate limiting configurado en Vercel
- [ ] WAF (si aplica) en Cloudflare
- [ ] Alertas configuradas: Slack + email + SMS al owner
- [ ] Health check endpoint funcionando
- [ ] /health/detailed con auth admin
- [ ] Sentry release tracking activo
- [ ] Test sintético de venta E2E en staging
- [ ] Documentación operativa: cómo reiniciar worker, cómo rotar cert AFIP
- [ ] Runbook básico para 5 escenarios críticos
- [ ] Test de DR (recovery): restore desde backup en < 1h

### B.4 Pre-primer cierre de turno fiscal

- [ ] Validación de cálculo de IVA por línea (no solo total)
- [ ] Tests con tenant en RI: facturas A/B/C generadas correctamente
- [ ] Tests con tenant en Monotributo: facturas C
- [ ] Reconciliación AFIP probada en homologación con CAE perdido simulado
- [ ] Cierre forzado probado con cron + smart detection
- [ ] Anulación de venta < 24h funcional con stock + cash reverso
- [ ] Exportación CSV de ventas funcional
- [ ] Reporte de turno PDF generado correctamente

### B.5 Items específicos agregados Sesión 1

- [ ] Política de retención de PDFs (cron archive S3 Glacier post-F2)
- [ ] Política de cleanup de idempotency_log (cron mensual)
- [ ] Reputación de dominio email (DNS configurado antes del primer envío masivo)
- [ ] Protección de delete company (confirmación 2-step + delay 7 días + email cancelación)
- [ ] Test sintético de venta E2E (cada 30 min en producción)

### B.6 Items específicos agregados Sesión 3.5/3.5.2

- [ ] audit_log con REVOKE INSERT a authenticated aplicado
- [ ] AuditService.log() recibiendo tx obligatorio
- [ ] sales.customer_snapshot NOT NULL con backfill
- [ ] afip_invoices.customer_snapshot con constraint estructural
- [ ] cash_sessions.tenant_fiscal_snapshot NOT NULL con backfill
- [ ] Policy RLS contador con EXISTS (no ANY+SELECT)
- [ ] withSerializationRetry implementado en todos los Application Services del hot path
- [ ] Cron afip-reconciliation con cadencia 5 min × 24 intentos
- [ ] Revalidación CUIT en hot path implementada
- [ ] Bloqueo de cambio condición IVA con turnos abiertos

## Apéndice C — Matriz completa de permisos

🟢 **VERDE**

| Acción | owner | admin | cashier | warehouse | viewer | accountant | auditor | support |
|---|---|---|---|---|---|---|---|---|
| **Tenancy** | | | | | | | | |
| Ver datos empresa | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ propias | ✓ desde access_from | ✓ con ticket |
| Editar datos empresa | ✓ | ✓ | — | — | — | — | — | ✓ con ticket |
| Cambiar condición IVA empresa | ✓ con motivo + sin turnos | — | — | — | — | — | — | — |
| Eliminar empresa | ✓ 2-step + 7d | — | — | — | — | — | — | — |
| **Identity** | | | | | | | | |
| Invitar usuario | ✓ | ✓ | — | — | — | — | — | — |
| Cambiar rol usuario | ✓ | — | — | — | — | — | — | — |
| Desactivar usuario | ✓ | ✓ con motivo | — | — | — | — | — | — |
| Invitar contador | ✓ | — | — | — | — | — | — | — |
| Revocar contador | ✓ | — | — | — | — | — | — | — |
| Invitar auditor | ✓ | — | — | — | — | — | — | — |
| **Catalog** | | | | | | | | |
| Crear producto | ✓ | ✓ | — | ✓ | — | — | — | — |
| Editar producto | ✓ | ✓ | — | ✓ | — | — | — | — |
| Eliminar producto | ✓ | ✓ con motivo | — | — | — | — | — | — |
| Cambiar precio | ✓ | ✓ con motivo | — | — | — | — | — | — |
| Importar CSV productos | ✓ | ✓ | — | ✓ | — | — | — | — |
| **Inventory** | | | | | | | | |
| Ver stock | ✓ | ✓ | ✓ | ✓ | ✓ | — | — | — |
| Ajustar stock | ✓ | ✓ | — | ✓ | — | — | — | — |
| Stock negativo (si habilitado) | ✓ con motivo | ✓ con motivo | — | — | — | — | — | — |
| Activar permitir stock negativo | ✓ confirmación + motivo | — | — | — | — | — | — | — |
| Transferencia entre depósitos (F1) | ✓ | ✓ | — | ✓ | — | — | — | — |
| **Customers** | | | | | | | | |
| Crear cliente | ✓ | ✓ | ✓ | — | — | — | — | — |
| Editar cliente | ✓ | ✓ | ✓ | — | — | — | — | — |
| Eliminar cliente | ✓ | ✓ con motivo | — | — | — | — | — | — |
| Cambiar condición IVA cliente | ✓ con motivo | ✓ con motivo | — | — | — | — | — | — |
| **Sales** | | | | | | | | |
| Crear venta | ✓ | ✓ | ✓ | — | — | — | — | — |
| Anular venta < 24h mismo turno | ✓ | ✓ | ✓ propia | — | — | — | — | — |
| Anular venta otros casos | ✓ con motivo | ✓ con motivo | — | — | — | — | — | — |
| NC sobre venta (F1+) | ✓ con motivo | ✓ con motivo | — | — | — | — | — | — |
| **Cash** | | | | | | | | |
| Abrir turno | ✓ | ✓ | ✓ | — | — | — | — | — |
| Cerrar turno propio | ✓ | ✓ | ✓ | — | — | — | — | — |
| Cerrar turno ajeno | ✓ | ✓ con motivo | — | — | — | — | — | — |
| Cierre con descuadre > 5% | ✓ | ✓ con motivo | — | — | — | — | — | — |
| Cierre con descuadre > 10% | ✓ | — | — | — | — | — | — | — |
| Revertir force_closing | ✓ con motivo | ✓ con motivo | — | — | — | — | — | ✓ ticket |
| **Fiscal** | | | | | | | | |
| Configurar AFIP (cert, PV) | ✓ | — | — | — | — | — | — | — |
| Rotar certificado AFIP | ✓ con motivo | — | — | — | — | — | — | — |
| Ver libros IVA (F1+) | ✓ | ✓ | — | — | ✓ | ✓ propias | — | — |
| **Subscription** | | | | | | | | |
| Ver plan actual | ✓ | ✓ | — | — | — | — | — | ✓ |
| Cambiar plan | ✓ | — | — | — | — | — | — | — |
| Cancelar suscripción | ✓ | — | — | — | — | — | — | — |
| **Exports** | | | | | | | | |
| Exportar CSV ventas | ✓ | ✓ | — | — | — | ✓ propias | — | — |
| Exportar datos personales (Ley 25.326) | ✓ | ✓ con 2FA | — | — | — | — | — | — |
| Backup completo del tenant | ✓ con 2FA | — | — | — | — | — | — | — |
| **Audit** | | | | | | | | |
| Ver audit log propio | ✓ | ✓ | — | — | — | ✓ propias | ✓ desde access_from | ✓ |
| **Support** | | | | | | | | |
| Suplantar tenant | — | — | — | — | — | — | — | ✓ con ticket + audit |

## Apéndice D — Resumen de validaciones humanas pendientes

🟡 **AMARILLO** — Consolidado de toda la sesión.

### D.1 Antes del primer cliente pagando

**Con contador advisor:**

1. Política de "venta válida sin factura tras 2h reconciliation_timeout"
2. Esquema de retención XML AFIP 10 años
3. Motivos obligatorios fiscales en operaciones destructivas
4. Política exacta de redondeo (half-up, half-even, half-down) que AFIP espera
5. Campos obligatorios en customer_snapshot por tipo de comprobante (A/B/C)
6. Revalidación CUIT en hot path: política de timeout (proceed_with_cache vs block_emission)
7. Política de cambio de condición IVA del comerciante: ¿requiere comunicación a AFIP?
8. Cálculo de IVA: ¿redondeo por línea o solo en total?
9. AFIP acepta facturación con customer_snapshot vs datos actuales del cliente

**Con abogado:**

1. Audit_log con cierre estricto cumple Ley 11.683 (conservación de registros)
2. Política delete company con delay 7 días
3. Privacidad de exports de datos personales
4. Compliance con Ley 25.326 sobre datos en logs
5. T&C con limitación de responsabilidad
6. Inscripción AAIP obligatoria como responsable de base de datos
7. DPAs (Data Processing Agreements) modelo
8. Customer snapshot inmutable: derecho del cliente a actualizar sus datos vs inmutabilidad histórica
9. Archive index de idempotency: política de retención y derecho al olvido

**Con clientes reales (primeros 5):**

1. Validación de pricing $25k (kioscos) / $60k (mercerías) ARS
2. Validación de UX operacional en POS (atajos F1-F12, latencias)
3. Validación de timeline de suspensión por impago (día 11 modo lectura, día 31 suspensión)
4. Validación de sonido/notificaciones en local comercial real
5. Validación de modo demo: extensión 7 días + bloqueo aceptable
6. Validación de cierre forzado: smart detection inactividad funciona
7. Validación de target táctil mínimo en tablets reales del mercado argentino

### D.2 Para iniciar Fase 1 (post primeros 30 clientes)

- Modelo de cuenta corriente con ajuste por inflación (validar con contador)
- WhatsApp Business templates aprobados por Meta
- Política exacta de NC (validar con contador)
- Política de compras y proveedores (workflow validado con clientes)
- Variantes de producto: matriz aceptable (validar con mercerías)

### D.3 Para iniciar Fase 4 (multi-país)

- Adaptaciones fiscales para Uruguay (DGI), Chile (SII), México (SAT)
- T&C multi-país con consultas legales locales
- Pricing por país validado
- Localización de UX (microcopy, formato fecha, moneda)

---

# Cierre del SRS v3.0

## Documentos relacionados

Este SRS principal se complementa con:

- **`adr/`** — 17 ADRs como archivos separados
- **`README.md`** — guía de lectura del paquete
- **`CLAUDE.md`** — fuente de verdad operativa (en el repo, no en este SRS)

## Total de líneas del SRS v3.0

| Parte | Líneas | KB |
|---|---|---|
| Parte 1 (visión a customers) | 990 | 38 |
| Parte 2 (catalog a notifications) | 1.091 | 33 |
| Parte 3 (observabilidad + UX + visual) | ~1.150 | ~37 |
| Parte 4 (máquinas + riesgos + roadmap + NO hacer) | 966 | 32 |
| Parte 5 (apéndices) | ~700 | ~22 |
| **Total** | **~4.900** | **~162 KB** |

## Próximos pasos operativos

**Inmediatos (esta semana):**

1. Revisar el SRS v3.0 completo (estimado 2-3 horas de lectura).
2. Marcar cualquier sección que no encaje con tu visión.
3. Conseguir contacto de contador advisor (consulta one-shot $30-50k ARS).
4. Conseguir contacto de abogado (consulta one-shot similar).
5. Configurar repo siguiendo CLAUDE.md.

**Próximas 2 semanas:**

1. Sprint visual de 3 días (tokens + AtmosphereProvider + primitives + charts).
2. Setup completo del repo + Supabase + Vercel.
3. Primera pantalla: POS (operational atmosphere).

**Próximas 4-6 semanas:**

1. POS funcional con AFIP en homologación.
2. Onboarding wizard 3 pasos.
3. Dashboard básico.

**Antes de primer cliente real:**

1. Validaciones con contador y abogado completadas.
2. Pricing validado con 3-5 comerciantes.
3. Tests sintéticos en producción funcionando.
4. Backup + DR probados.
5. Documentación operativa lista.

## Lo que NO está en este SRS

Por decisión deliberada, este SRS no incluye:

- **Wireframes o mockups detallados** de cada pantalla (eso vive en Figma o equivalente).
- **Código completo** de implementación (eso vive en el repo).
- **Plan de marketing y go-to-market** (es otro documento).
- **Plan financiero detallado** (es otro documento).
- **CV del equipo** (no aplica, sos solo vos).

Este SRS es la **fuente de verdad técnica y operativa** del producto. Todo lo demás se construye sobre él.

---

## Una nota final, del autor humano para el lector futuro

Este documento es resultado de iteración real, no de copy-paste de templates. Cada decisión registrada tuvo discusión: alternativas evaluadas, contras explícitos, validación cuando fue posible, marcado AMARILLO cuando no.

El SRS sin validación humana sigue siendo un SRS técnico, no un contrato listo para producción. Las validaciones con contador, abogado y clientes reales son no negociables antes del primer commit productivo.

El producto se construye desde aquí. La documentación deja de iterarse. **Lo que sigue es código.**

---

**Pandora ERP — SRS v3.0**
**Fin del documento principal**

*Para detalle de decisiones arquitectónicas formales, ver `adr/`.*
*Para guía de lectura del paquete completo, ver `README.md`.*
