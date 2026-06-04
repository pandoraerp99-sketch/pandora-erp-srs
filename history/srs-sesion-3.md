# PANDORA ERP — SRS Sesión 3
## Ambigüedades resueltas + Dominios expandidos + 10 ADRs formales

**Fecha:** 17 mayo 2026
**Base:** SRS v2.0-OMN + Sesiones 1 y 2
**Estado:** Aprobado para integración en SRS v3.0
**Contenido:**
- **Parte 1:** Resolución de 8 ambigüedades originales identificadas en auditoría
- **Parte 2:** Sección 4 expandida — Dominios del Sistema con eventos, workflows, dependencias
- **Parte 3:** 10 ADRs formales con template estándar

**Marcado:**
- 🟢 **VERDE:** Técnico, alta confianza
- 🟡 **AMARILLO:** Requiere validación humana antes de producción
- 🔴 **ROJO:** Decisión pendiente

---

# PARTE 1 — RESOLUCIÓN DE 8 AMBIGÜEDADES

## Ambigüedad 1: Modo demo

**Estado:** ✅ RESUELTA en Sesión 1

**Resumen final:**
- 14 días iniciales + extensión automática 7 días si no activa + bloqueo total después
- NO accede al módulo contador
- Máximo 100 productos, 50 ventas
- Comprobantes con marca de agua "DEMO"
- Datos cargados en demo (productos, clientes) se conservan al pasar a producción; ventas NO

**Pendiente menor:** decidir si el "bloqueo total" es bloqueo de login (recomendado) o solo bloqueo de operaciones nuevas dejando lectura. 🔴 Quedó sin contestar explícitamente.

## Ambigüedad 2: Acceso temporal del rol auditor

**Estado:** ✅ RESUELTA acá

### Decisión

**Quién configura:** Owner del tenant.

**Default:** 30 días desde la creación de la sesión auditor.

**Configurable hasta:** 90 días máximo. No se permite "indefinido" — auditor permanente es rol de "accountant", no "auditor".

**Cómo se revoca:** Owner puede revocar manualmente desde panel de usuarios. Revocación es inmediata: la próxima request del auditor devuelve 401.

**Qué pasa si expira durante sesión activa:** La sesión sigue activa hasta que el JWT expire (max 1 hora). Después no puede renovar token. UI muestra: "Tu acceso de auditor expiró el [fecha]. Contactá al owner para extenderlo."

**Notificaciones:**
- 7 días antes de expirar: email al auditor + email al owner.
- 1 día antes: email al auditor + owner + banner persistente en UI del auditor.
- Al expirar: email a ambos.

**Auditoría:**
- Cada login del auditor genera `audit_log` con `action='auditor.login'`.
- Cada export genera `audit_log` con detalles del export.
- Revocación: `audit_log` con `reason` obligatorio del owner.

## Ambigüedad 3: Cierre forzado 23:59 para comercios 24hs

**Estado:** ✅ RESUELTA en Sesión 2 + esta confirmación

### Implementación final

**Configuración por tenant en `company_settings`:**

```typescript
{
  force_close_hour: "23:59",  // HH:MM en timezone del tenant
  force_close_smart_detection: true,  // default true
  force_close_grace_minutes: 120,  // si hay venta en últimos N min, no forzar
}
```

**Lógica del cron:**

```
Trigger: cada 5 minutos (no solo 23:59 — para soportar timezones diversos)
Query: SELECT * FROM cash_sessions cs
       JOIN companies c ON cs.company_id = c.id
       WHERE cs.status = 'open'
         AND (now() AT TIME ZONE c.timezone)::time >= c.force_close_hour
         AND opened_at < now() - interval '2 hours'

Para cada sesión candidata:
  1. Si force_close_smart_detection = true:
     SELECT count(*) FROM sales 
       WHERE shift_id = cs.id 
         AND created_at > now() - (c.force_close_grace_minutes || ' minutes')::interval
     Si hay ventas recientes: NO forzar, esperar próximo ciclo.
  
  2. Si pasa el chequeo:
     - Marcar cash_session.status = 'force_closing'
     - Enviar email + SMS al cashier asignado
     - Esperar 1 hora
     - Si cashier no cerró manualmente: completar a 'force_closed'
     - Generar reporte automático con expected_final_amount calculado
     - audit_log con reason = 'force_closed_by_cron_inactivity'
```

**Validación de hora configurable:**
- No se permite force_close_hour configurado para "nunca" — siempre hay un cierre forzado al cabo de 24h.
- Si el tenant intenta poner force_close_hour igual a opened_at: validación de schema lo previene.

## Ambigüedad 4: Suspensión por impago — 10 días gracia → modo lectura

**Estado:** ✅ RESUELTA acá

🟡 **AMARILLO** — Política de billing. Aunque técnicamente VERDE, el detalle de "qué pasa con datos en lectura" requiere review legal eventual.

### Política definitiva de impago

```
Día 1 (fecha de cobro fallido):
  - Reintento automático del cargo en MercadoPago
  - Email al owner: "Pago fallido. Reintentaremos automáticamente en 24h."
  - Sin impacto operativo

Día 2-3:
  - Reintento automático cada 24h
  - Email diario con CTA "Actualizar método de pago"

Día 4-10 (período de gracia):
  - Banner persistente en UI: "Cuenta con pago pendiente. Suspensión el [fecha]. Actualizá tu método de pago."
  - Email cada 2 días
  - SMS al owner el día 7 y 9
  - Sin impacto operativo todavía

Día 11 (modo lectura):
  - cash_session no permite apertura nueva
  - Ventas existentes pueden cerrarse pero no hay nuevas
  - Productos, clientes, configuración: solo lectura
  - Reportes: disponibles
  - Export CSV: disponible (importante para que el comerciante pueda migrar si decide irse)
  - Banner crítico: "Tu cuenta está en modo lectura. Pagá para seguir operando."

Día 11-30:
  - Modo lectura persiste
  - Email cada 3 días con CTA pago

Día 31 (suspensión total):
  - Cuenta marcada como 'suspended'
  - Login bloqueado para todos los usuarios
  - Datos preservados intactos (NO se eliminan)
  - Email al owner: "Tu cuenta fue suspendida. Para reactivar, contactanos."

Día 90 (post-suspensión):
  - Si no se reactiva: cuenta marcada como 'archived'
  - Datos siguen preservados pero sin acceso self-service
  - Reactivación posible solo vía soporte Pandora

Después de 5 años de archivado:
  - Eliminación lógica permanente
  - Audit_log se mantiene 5 años más por ley
  - Datos personales clientes se anonimizan según Ley 25.326
```

### Recuperación

- Pago durante gracia (días 4-10): vuelve a `active` inmediatamente al confirmar pago.
- Pago durante modo lectura (días 11-30): vuelve a `active` inmediatamente, sin recargo.
- Pago durante suspensión (días 31-90): vuelve a `active` con recargo de reactivación equivalente a 1 mes adicional.
- Después de archivado: requiere intervención de soporte.

### Decisiones que requieren validación legal 🟡

- ⚠️ Eliminación permanente tras 5 años: validar si la Ley 25.326 (privacidad) lo requiere o lo prohíbe.
- ⚠️ Política de "datos preservados intactos" durante suspensión: debe estar en TyC.
- ⚠️ Recargo de reactivación post-suspensión: debe estar en TyC.

## Ambigüedad 5: Stock negativo configurable

**Estado:** ✅ RESUELTA acá

### Política definitiva

**Configuración a nivel de tenant** (`company_settings.allow_negative_stock`):

| Valor | Comportamiento |
|---|---|
| `'never'` (default) | Bloqueo absoluto. Si stock = 0, venta rechazada. |
| `'with_authorization'` | Permitido si admin autoriza con motivo. Cashier no puede activar. |
| `'with_warning'` | Permitido para cualquier rol, con motivo obligatorio. Alerta al owner por email. |

**Quién puede cambiar la configuración:** Solo owner.

**Auditoría:**
- Cambio de configuración: `audit_log` con `entity='company_settings'`, `action='stock_policy_changed'`, motivo obligatorio.
- Cada venta con stock negativo: `audit_log` con `entity='sale'`, `metadata.negative_stock_override = true`, motivo obligatorio.

**Alertas:**
- Email diario al owner si hubo ventas con stock negativo el día anterior.
- Banner en dashboard del owner con contador de ventas con override del mes.

**Por producto:** No se sobre-escribe individualmente. La política es a nivel tenant. Si un producto necesita comportamiento distinto (ej: backorder permitido), se modela como flag separado `products.allow_backorder` en Fase 1+.

### Casos especiales

- **Productos no inventariables** (servicios, intangibles): `products.is_inventoriable = false`. Estos productos nunca chequean stock, independientemente de la política.
- **Productos compuestos** (Fase 1+): si un combo se vende, se decrementa stock de cada componente. Si algún componente cae en negativo, aplica la política configurada.

## Ambigüedad 6: NC < 24h definido con precisión

**Estado:** ✅ RESUELTA acá

### Política definitiva

**24 horas desde** `sale.completed_at`, **no** desde `cash_session.opened_at` ni desde `invoice_issued_at`.

**Misma sesión de caja:** además de las 24h, debe ser el mismo `cash_session_id` que la venta original. Si el turno cerró, ya no es anulación simple — se requiere Nota de Crédito formal.

**Quién puede anular dentro de 24h + mismo turno:**
- Cashier que registró la venta.
- Admin.
- Owner.

**Quién puede emitir NC formal (> 24h o turno cerrado):**
- Admin.
- Owner.

**Motivo obligatorio:** Sí, en ambos casos.

**Diferencia operativa entre los dos casos:**

| Caso | Acción técnica | Comprobante fiscal |
|---|---|---|
| Anulación < 24h, mismo turno | Reversa stock + reversa caja + sale.status='cancelled' | Si tenía CAE: emisión de NC automática |
| Anulación > 24h o turno cerrado | NC formal con motivo + restitución de stock opcional + reintegro de dinero registrado | NC fiscal con CAE propio |

**Edge cases:**

- **Turno extendido (force_closed + reopen):** la "misma sesión" se determina por `cash_session_id`. Si el turno se cerró forzosamente y se abrió uno nuevo, son distintos turnos.
- **Venta sin factura (no_document):** anulación < 24h posible, reversa stock + caja, sin NC fiscal.
- **Venta facturada pero CAE perdido (`reconciliation_timeout`):** anulación posible, pero requiere acción del contador del comerciante para regularización fiscal manual.

### Validación con contador 🟡

⚠️ Confirmar:
- ¿La NC emitida automáticamente al anular dentro de 24h debe llevar mismo cliente que la factura original?
- ¿Qué hacer si el cliente cambió de condición IVA entre factura original y NC?
- ¿Hay alguna ventana fiscal específica para NC de venta del mismo día (legal vs el sistema)?

## Ambigüedad 7: Conciliación bancaria — automática vs manual

**Estado:** ✅ RESUELTA acá

### Política por fase

**Fase 0:** No existe módulo de conciliación. El comerciante usa Pandora para POS + caja, y concilia con su banco manualmente o vía su contador.

**Fase 2 (cuando entra "Conciliación bancaria"):** **Semi-automática**

- Comerciante sube extracto CSV/Excel del banco.
- Sistema parsea y matchea automáticamente con `cash_movements` o `mp_transactions` por:
  - Monto exacto + fecha próxima (±3 días)
  - Referencia/descripción que matchea
- Sistema sugiere matches, comerciante confirma uno por uno.
- Items sin match: revisión manual.

**Por qué NO automática total:**
- Bancos argentinos no tienen API estandarizada accesible para PyMEs.
- Comprobantes bancarios tienen variaciones de formato.
- Matches automáticos sin confirmación humana generan errores fiscales.

**Fase 3+:** Evaluar integración directa con bancos vía Bind, Modo, o similar si hay demanda. **Decisión postergada** — depende del estado del open banking argentino al momento.

### Datos requeridos del extracto

Sistema acepta CSV con columnas mínimas:
- Fecha
- Descripción
- Monto (positivo = ingreso, negativo = egreso)
- Tipo movimiento (opcional)
- Referencia externa (opcional)

Encodings soportados: UTF-8, CP1252 (Excel Argentina).

## Ambigüedad 8: Marketplace — partners externos vs módulos internos

**Estado:** ✅ RESUELTA acá

### Política definitiva

**Fase 3 — "App Store interna":**
- Solo **módulos desarrollados por Pandora** activables/desactivables por tenant según plan.
- Ejemplos: módulo de promociones, módulo de gastronomía liviana, módulo de e-commerce sync básico.
- Revenue: incluidos en precio de plan, no revenue share.
- Permite probar nuevos verticales sin sumar peso al core.

**Fase 4 — "Marketplace de Integraciones":**
- Partners **externos** (desarrolladores third-party) construyen integraciones sobre la API pública.
- Revenue share 70/30 (developer/Pandora).
- Sandbox de desarrollo + review process de partners.
- Permisos declarativos por integración (qué datos puede leer/escribir).

**Razón de la separación:**

Lo aprendí discutiendo con vos hace tres sesiones: Pandora con 500-1000 clientes en Fase 3 no tiene masa crítica para atraer developers third-party. Pero sí tiene capacidad de empaquetar features propios como "módulos opcionales" que se venden incrementalmente.

Fase 4 con 2000+ clientes empieza a justificar marketplace externo real.

### Decisiones técnicas que esto impacta

- Fase 3 NO necesita API pública aún (los módulos internos consumen API interna).
- Fase 3 SÍ necesita feature flags por módulo (`tenant_modules` además de `tenant_features`).
- Fase 4 introduce: HMAC en webhooks, OAuth2 para partners, sandbox env, docs públicas.

## Ambigüedades menores resueltas en pasada

Te las consolido acá rápido porque salieron en el camino:

| Ambigüedad | Resolución |
|---|---|
| Productos eliminados en histórico | Soft delete con `products.active = false`. Histórico muestra el producto tachado con (eliminado) al lado. Nunca DELETE físico. |
| Cliente cambia condición IVA con NCs pendientes | NC se emite con condición IVA del momento de la NC, no de la factura original. Esto es regla AFIP. Sistema persiste ambos snapshots en `audit_log`. ⚠️ Validar con contador. |
| Stock 0 en pedidos confirmados Fase 2 | Modal de conflicto: "Stock insuficiente al sincronizar. ¿Cancelar pedido / ¿Backorder (si producto lo permite)? / ¿Reducir cantidad?" Decisión del operador. |
| AFIP devuelve `observed` (CAE con observaciones) | Tratar como `approved` para flujo operativo: se imprime, se entrega ticket al cliente. Las observaciones se persisten en `afip_invoices.observations` para que el contador las revise. ⚠️ Validar con contador. |
| Idempotency-Key TTL | 90 días en hot DB, después archivado. Esto está cubierto en Sesión 2 (13.11). |
| Stock fantasma cleanup | Cron cada 15 min limpia `stock_reservations` expiradas (Sesión 2, SM-06). |

---

# PARTE 2 — SECCIÓN 4 DOMINIOS DEL SISTEMA EXPANDIDA

🟢 **VERDE** — Técnica, sin implicancias fiscales/legales.

## 4. Dominios del Sistema (versión expandida)

### 4.1 Filosofía de bounded contexts

Pandora opera como **monolito modular**. Cada dominio tiene:

- **Responsabilidad clara:** qué hace y qué NO hace.
- **Ownership de entidades:** qué tablas son suyas, cuáles son ajenas.
- **Eventos emitidos:** qué publica para que otros dominios reaccionen.
- **Eventos consumidos:** qué eventos de otros dominios procesa.
- **Dependencias permitidas:** a qué otros dominios puede invocar directamente.
- **Side effects:** qué cambios produce fuera de sus tablas.
- **Límites explícitos:** qué NO le pertenece.

**Regla absoluta:** un dominio NO puede tocar tablas de otro dominio directamente. La comunicación es por:
- **Llamada directa** a Service del otro dominio (síncrona, dentro de la misma transacción si aplica).
- **Evento interno** (asíncrono, vía cola — Fase 1+).

### 4.2 Inventario de dominios

| Dominio | Fase | Responsable | Owner técnico |
|---|---|---|---|
| Tenant Management | F0 | Empresas, sucursales, usuarios, roles, settings | Core |
| Identity & Auth | F0 | Login, JWT, roles, sesiones | Core |
| Catalog | F0 | Productos, categorías, precios | Catalog |
| Inventory | F0 | Stock, depósitos, movimientos | Inventory |
| Customer Management | F0 | Clientes, datos fiscales | CRM |
| Sales | F0 | Carritos, ventas, ítems, pagos | Sales |
| Cash Management | F0 | Cajas, turnos, movimientos de caja | Cash |
| Fiscal | F0 | AFIP, comprobantes, CAE, numeración | Fiscal |
| Notifications | F0 | Email, SMS, WhatsApp templates | Comms |
| Audit | F0 | audit_log, trazabilidad | Platform |
| Observability | F0 | Logs, métricas, health | Platform |
| Subscription & Billing | F0 | Planes, suscripciones, cobro MP | Billing |
| Onboarding | F0 | Wizard, modo demo, activación | Product |
| Procurement (Compras) | F1 | Proveedores, órdenes de compra | Sales (extensión) |
| Accounting Assistance | F1 | Asientos, libros, dashboard contador | Accounting |
| Accounts Receivable | F1 | Cuenta corriente clientes | Sales (extensión) |
| Accounts Payable | F1 | Cuenta corriente proveedores | Procurement |
| Order Management | F2 | Captura demanda omnicanal | Orders |
| Fulfillment | F2 | Logística de entrega | Operations |
| Integrations Hub | F3 | API pública, webhooks salientes | Platform |
| Marketplace | F4 | App store de partners | Platform |

### 4.3 Definición por dominio (Fase 0)

A continuación, cada dominio de Fase 0 con su contrato completo. Los de Fase 1+ se detallan cuando entren al roadmap.

---

#### 4.3.1 Tenant Management

**Responsabilidad:** Gestión del ciclo de vida del tenant (empresa). Crear, configurar, eliminar (soft) empresas. Gestionar sucursales y usuarios dentro de cada tenant.

**Entidades propias:**
- `companies`
- `branches`
- `sale_points`
- `terminals` (si aplica)
- `profiles` (usuarios)
- `company_settings`
- `tenant_features`
- `accountant_companies` (vincula contador con N empresas)

**Eventos emitidos:**
- `company.created` → consumido por Subscription, Onboarding
- `company.activated` → consumido por Fiscal (habilitar AFIP), Billing
- `company.suspended` → consumido por Sales (bloquear operaciones), Fiscal
- `company.deleted` → consumido por Audit, Billing
- `user.created` → consumido por Auth, Notifications
- `user.deactivated` → consumido por Sales (transferir turnos), Audit
- `branch.created` → consumido por Inventory (crear depósito default)

**Eventos consumidos:**
- `subscription.payment_failed` → marca company en estado "grace_period"
- `subscription.suspended` → marca company.status = 'suspended'

**Dependencias permitidas:**
- Llama a: Auth (crear usuarios), Notifications (notificar onboarding)
- NO llama a: Sales, Fiscal, Inventory (esos dominios consumen eventos)

**Side effects:**
- Al crear company: crea automáticamente branch principal "Sucursal 1", warehouse default, sale_point 1, cash_register default.
- Al eliminar company (soft): no toca tablas hijas, solo marca `companies.active = false` + `deleted_at`.

**Límites explícitos:**
- NO gestiona facturación del SaaS (es Subscription & Billing).
- NO valida CUIT contra AFIP (es Fiscal).
- NO administra stock (es Inventory).

---

#### 4.3.2 Identity & Auth

**Responsabilidad:** Autenticación, autorización, gestión de sesiones, RBAC.

**Entidades propias:**
- `auth.users` (Supabase Auth)
- Reglas RLS en todas las tablas
- Tabla auxiliar de sesiones revocadas (Fase 1+ si aplica)

**Eventos emitidos:**
- `user.logged_in` → consumido por Audit
- `user.logged_out` → consumido por Cash (alertar turno abierto), Audit
- `user.password_changed` → consumido por Notifications, Audit
- `user.role_changed` → consumido por Audit

**Eventos consumidos:**
- `user.created` (de Tenant Management) → crear cuenta en Supabase Auth
- `user.deactivated` → revocar sesiones activas

**Dependencias permitidas:**
- Llama a: Tenant Management (verificar permisos sobre company)
- NO llama a: dominios de negocio (Sales, Inventory, etc.)

**Side effects:**
- Login exitoso: emite JWT con `company_id` + `role` + `user_id`.
- Logout: invalida JWT en lista de revocaciones (Fase 1+).

**Límites explícitos:**
- NO toma decisiones de negocio. Solo dice "este usuario es X, su rol es Y, está autorizado para Z".
- NO maneja billing de SaaS.
- NO gestiona contraseñas en plain text (delegado a Supabase Auth).

---

#### 4.3.3 Catalog

**Responsabilidad:** Catálogo de productos, categorías, precios, IVA por producto.

**Entidades propias:**
- `products`
- `categories`
- `product_prices` (histórico de precios — Fase 1)
- `product_variants` (Fase 1)

**Eventos emitidos:**
- `product.created` → consumido por Inventory (crear stock = 0 en warehouse default)
- `product.updated` → consumido por Audit
- `product.deleted` → consumido por Inventory (marcar stock como histórico), Audit
- `product.price_changed` → consumido por Audit (con motivo obligatorio)

**Eventos consumidos:**
- `branch.created` → asegurar que productos están disponibles en warehouse de la nueva sucursal (Fase 1)

**Dependencias permitidas:**
- Llama a: Inventory (consultar disponibilidad pero no modificar)
- NO llama a: Sales, Fiscal

**Side effects:**
- Crear producto: emite `product.created`, espera que Inventory cree stock = 0.
- Cambiar precio: registra en `product_prices` con timestamp para precio histórico.

**Límites explícitos:**
- NO modifica stock (es Inventory).
- NO factura (es Fiscal).
- NO maneja órdenes de compra (es Procurement, Fase 1).

---

#### 4.3.4 Inventory

**Responsabilidad:** Stock por (producto, depósito), movimientos de stock, reservas (Fase 2+).

**Entidades propias:**
- `warehouses`
- `stock`
- `stock_movements`
- `stock_reservations` (Fase 2+)
- `inventory_alerts` (Fase 1+)

**Eventos emitidos:**
- `stock.movement_created` → consumido por Audit
- `stock.low_threshold_reached` → consumido por Notifications (alerta al owner)
- `stock.negative` → consumido por Notifications (alerta crítica si tenant permite)
- `stock.reservation_created` → consumido por Audit (Fase 2)
- `stock.reservation_expired` → consumido por Sales/Orders (libera Order) (Fase 2)

**Eventos consumidos:**
- `sale.completed` → ejecutar deducción de stock con transacción serializable
- `sale.cancelled` → ejecutar reversa de stock
- `purchase.received` → ejecutar incremento de stock (Fase 1)
- `product.created` → crear `stock` row con quantity = 0 en warehouse default

**Dependencias permitidas:**
- Llama a: Catalog (validar product_id)
- NO llama a: Sales (Sales le pide a Inventory, no al revés)

**Side effects:**
- Toda mutación de `stock` crea `stock_movements` (append-only).
- Si `stock.quantity` cruza umbral configurado: emite evento.

**Límites explícitos:**
- NO conoce precios (es Catalog).
- NO conoce ventas (es Sales).
- NO factura (es Fiscal).

**Reglas internas críticas:**

- Toda lectura para validación: optimista, no bloqueante.
- Toda escritura: dentro de transacción serializable con `SELECT FOR UPDATE` sobre `stock`.
- `stock_movements` es append-only: NUNCA UPDATE ni DELETE. Corrección via movimiento inverso.

---

#### 4.3.5 Customer Management

**Responsabilidad:** Gestión de clientes, datos fiscales, historial de compras, condición IVA.

**Entidades propias:**
- `customers`
- `customer_addresses` (Fase 1+)
- `customer_tags` (Fase 1+)
- `customer_notes` (Fase 1+)

**Eventos emitidos:**
- `customer.created` → consumido por Audit
- `customer.iva_condition_changed` → consumido por Audit (motivo obligatorio)
- `customer.deleted` → consumido por Audit (soft delete)

**Eventos consumidos:**
- `sale.completed_with_customer` → actualizar `last_purchase_at`, agregar a estadísticas internas

**Dependencias permitidas:**
- Llama a: Fiscal (validar CUIT contra padrón A5)
- NO llama a: Sales, Inventory

**Side effects:**
- Crear cliente con CUIT: dispara validación async contra padrón A5 (cache 7 días).
- Si CUIT inválido: cliente queda creado con flag `pending_validation = true`.

**Límites explícitos:**
- NO maneja deudas (es Accounts Receivable, Fase 1+).
- NO emite facturas (es Fiscal).
- NO maneja preferencias de notificación con detalle (es Notifications).

---

#### 4.3.6 Sales

**Responsabilidad:** Carritos, ventas, items, pagos, descuentos. Orquesta el flujo de venta end-to-end.

**Entidades propias:**
- `sales`
- `sale_items`
- `sale_payments`
- `payment_methods` (catálogo de medios)

**Eventos emitidos:**
- `sale.draft_created` → consumido por Audit
- `sale.confirmed` → consumido por Inventory (deducción de stock), Cash (movimiento)
- `sale.completed` → consumido por Fiscal (si pide factura), Audit, Notifications
- `sale.cancelled` → consumido por Inventory (reversa), Cash (reversa), Fiscal (NC si aplica), Audit
- `sale.payment_received` → consumido por Cash, Audit
- `sale.payment_failed` → consumido por Notifications

**Eventos consumidos:**
- `payment.confirmed` (de external — MP webhook) → marcar payment como `confirmed`
- `payment.failed` (de external) → marcar payment como `failed`
- `customer.deleted` → reasignar sales históricas a "consumidor final" (mantener referencial integrity sin exponer cliente eliminado)

**Dependencias permitidas:**
- Llama a: Inventory (validar stock, deducir), Cash (registrar movimiento), Fiscal (emitir comprobante), Customer (validar customer_id), Catalog (precio actual del producto)
- Es el dominio MÁS CONECTADO. Por eso requiere transacciones cuidadosas.

**Side effects (en el flujo completo de venta):**
1. Verifica auth + tenant (Auth)
2. Lock optimista de productos (Catalog query)
3. Inicia transacción serializable
4. SELECT FOR UPDATE en stock (Inventory)
5. Inserta sale + sale_items + sale_payments
6. Inserta stock_movements (Inventory)
7. Inserta cash_movements (Cash)
8. Si facturación: reserva número (Fiscal) + llama AFIP sincrónico (Fiscal)
9. Si OK: commit + emite eventos
10. Si falla AFIP: rollback de fiscal, sale queda en `no_document`, commit del resto

**Límites explícitos:**
- NO calcula IVA por su cuenta — delega a Fiscal.
- NO modifica stock directamente — delega a Inventory.
- NO maneja MP API — delega a Payment integration.
- NO emite XML AFIP — delega a Fiscal.

---

#### 4.3.7 Cash Management

**Responsabilidad:** Apertura/cierre de turnos, arqueo, movimientos de caja, reportes de caja.

**Entidades propias:**
- `cash_registers`
- `cash_register_shifts`
- `cash_movements`
- `cash_session_reports` (PDF generados, Fase 1+)

**Eventos emitidos:**
- `cash_session.opened` → consumido por Audit
- `cash_session.closed` → consumido por Audit, Notifications (reporte al owner)
- `cash_session.closed_with_difference` → consumido por Audit, Notifications (alerta al owner)
- `cash_session.force_closed` → consumido por Audit, Notifications
- `cash_movement.created` → consumido por Audit

**Eventos consumidos:**
- `sale.payment_received` → crear cash_movement entrada
- `sale.cancelled` → crear cash_movement reversa
- `user.deactivated` con turno abierto → notificar admin

**Dependencias permitidas:**
- Llama a: Sales (consultar ventas del turno para reporte)
- Llama a: Notifications (enviar reporte al owner al cerrar)

**Side effects:**
- Apertura: lock UNIQUE constraint sobre (`cash_register_id`, `status='open'`) garantiza solo 1 turno abierto.
- Cierre: calcula `expected_final_amount`, compara con declarado, genera reporte PDF.
- Cron: chequea turnos a forzar (lógica detallada en Sesión 2 SM-05).

**Límites explícitos:**
- NO valida pagos externos (MP, etc.) — eso es responsabilidad de Payment integration.
- NO emite facturas — Fiscal.
- NO modifica ventas — Sales.

---

#### 4.3.8 Fiscal

**Responsabilidad:** Integración AFIP/ARCA. Emisión de comprobantes electrónicos, gestión de CAE, validación de CUIT contra padrón, certificados X.509.

**Entidades propias:**
- `afip_invoices`
- `invoice_sequences`
- `afip_certificates`
- `afip_tokens`
- `padron_a5_cache`

**Eventos emitidos:**
- `invoice.requested` → consumido por Audit
- `invoice.issued` → consumido por Sales (actualizar sale.document_status), Notifications (enviar ticket al cliente si email)
- `invoice.failed` → consumido por Sales, Notifications, Audit
- `invoice.reconciliation_started` → consumido por Audit
- `invoice.reconciliation_completed` → consumido por Sales, Notifications
- `invoice.reconciliation_timeout` → consumido por Audit, Notifications
- `certificate.expiring` → consumido por Notifications (alertar owner)
- `certificate.expired` → consumido por Tenant Management (pausar facturación)

**Eventos consumidos:**
- `sale.completed_with_invoice_request` → trigger principal de facturación
- `sale.cancelled` con factura emitida → emitir NC automática (dentro de 24h)

**Dependencias permitidas:**
- Llama a: AFIP webservices (WSAA, WSFEv1, padrón A5)
- Llama a: Sales (notificar resultado)
- Llama a: Notifications (avisar al comerciante)

**Side effects:**
- Reserva número fiscal con `SELECT FOR UPDATE` antes de llamar AFIP.
- Si AFIP responde OK: persiste CAE, XML, QR.
- Si AFIP timeout: marca número como "burned" tentativo, encola reconciliación.
- Worker `afip-reconciliation` cada 5 min consulta `FECompUltimoAutorizado`.
- Validación de CUIT: cache local 7 días.

**Límites explícitos:**
- NO conoce stock (Inventory).
- NO conoce caja (Cash).
- NO modifica ventas (notifica vía eventos).
- NO maneja billing del SaaS (es Subscription).

---

#### 4.3.9 Notifications

**Responsabilidad:** Envío de notificaciones transaccionales (email, SMS Fase 1, WhatsApp Fase 1+). Gestión de templates, preferencias, rate limiting.

**Entidades propias:**
- `notification_templates`
- `notifications` (registro de envíos)
- `notification_preferences` (por cliente del tenant)

**Eventos emitidos:**
- `notification.sent` → consumido por Audit
- `notification.failed` → consumido por Audit, alerta a admin
- `notification.bounced` → afecta reputación de dominio (Fase 1+)

**Eventos consumidos:**
- `sale.completed` con email del cliente → enviar ticket digital
- `cash_session.closed` → enviar reporte al owner
- `invoice.issued` → enviar factura al cliente (si email)
- `subscription.payment_failed` → enviar notificación al owner
- `certificate.expiring` → enviar notificación al owner
- `stock.low_threshold_reached` → enviar al owner

**Dependencias permitidas:**
- Llama a: Resend (email), Twilio (SMS Fase 1), WhatsApp Cloud API (Fase 1)
- NO llama a dominios de negocio.

**Side effects:**
- Anti-spam: max 1 email del mismo template al mismo destinatario por día.
- Horario: 9-21hs hora local del comerciante (configurable).
- Fallback: si SMS falla, intentar email.

**Límites explícitos:**
- NO genera el contenido de la notificación (lo recibe en el evento).
- NO maneja templates de marketing (futuro, Fase 2+).
- NO valida números de teléfono o emails (eso es responsabilidad del dominio que envía).

---

#### 4.3.10 Audit

**Responsabilidad:** Registro inmutable de eventos auditables. NO toma decisiones, solo persiste.

**Entidades propias:**
- `audit_log` (append-only, REVOKE UPDATE/DELETE)

**Eventos emitidos:**
- Ninguno (es un sink, no un emisor).

**Eventos consumidos:**
- Todos los eventos emitidos por otros dominios que requieran auditoría.

**Dependencias permitidas:**
- Ninguna. Es completamente pasivo.

**Side effects:**
- INSERT en audit_log.
- Validación: si la acción requiere motivo obligatorio (lista en Sesión 2 sección 13.10) y reason es null, rechaza.

**Límites explícitos:**
- NO modifica nada.
- NO consulta para autorizar — Auth hace eso.
- NO genera reportes (Audit Reports es feature de Fase 2+).

---

#### 4.3.11 Observability

**Responsabilidad:** Logs estructurados, métricas, health checks, correlation tracing.

**Entidades propias:**
- Logs (Vercel logs / Axiom Fase 1+)
- Métricas (Prometheus / Vercel Analytics)
- Sentry issues

**Eventos emitidos:**
- Ninguno (es overhead técnico, no de negocio).

**Eventos consumidos:**
- Todos. Cada evento de negocio genera log estructurado.

**Dependencias permitidas:**
- Ninguna. Es transversal.

**Side effects:**
- Cada log: envío a transporte configurado.
- Métricas: actualización en tiempo real.
- Errores: envío a Sentry.

**Límites explícitos:**
- NO modifica datos de negocio.
- NO impacta performance crítica (logs async, métricas en memoria).

---

#### 4.3.12 Subscription & Billing

**Responsabilidad:** Gestión de suscripciones al SaaS, cobro recurrente, planes, upgrade/downgrade.

**Entidades propias:**
- `plans`
- `subscriptions`
- `invoices_pandora` (facturación del SaaS al cliente — diferente de afip_invoices)
- `payment_methods_pandora` (MP suscripciones del cliente)

**Eventos emitidos:**
- `subscription.created` → consumido por Tenant Management
- `subscription.payment_succeeded` → consumido por Tenant Management (mantener active)
- `subscription.payment_failed` → consumido por Tenant Management (iniciar gracia), Notifications
- `subscription.suspended` → consumido por Tenant Management (modo lectura), Notifications
- `subscription.reactivated` → consumido por Tenant Management
- `subscription.upgraded` → consumido por Tenant Management (activar features), Notifications
- `subscription.downgraded` → consumido por Tenant Management (desactivar features según plan), Notifications

**Eventos consumidos:**
- `company.created` → crear subscription en trial
- `company.deleted` → cancelar subscription, prorratear

**Dependencias permitidas:**
- Llama a: MercadoPago Suscripciones API
- Llama a: Notifications

**Side effects:**
- Cobro recurrente vía MP Suscripciones.
- Webhook MP de éxito/fallo → procesar.

**Límites explícitos:**
- NO factura AFIP-style al cliente (es servicio de Pandora a su cliente, no operación fiscal del cliente).
- NO maneja contadores (es Tenant Management).

---

#### 4.3.13 Onboarding

**Responsabilidad:** Wizard inicial, modo demo, activación de AFIP, carga inicial de productos.

**Entidades propias:**
- Estado del wizard (sesión efímera)
- Productos demo por rubro (templates pre-cargados)

**Eventos emitidos:**
- `onboarding.step_completed` → consumido por Audit, analítica
- `onboarding.abandoned` → consumido por Notifications (email de re-engagement Fase 1+)
- `demo.expired` → consumido por Tenant Management

**Eventos consumidos:**
- `company.created` → iniciar wizard
- `tenant.afip_configured` → marcar modo producción

**Dependencias permitidas:**
- Llama a: Tenant Management, Fiscal (validación inicial), Catalog (carga productos demo)

**Side effects:**
- Crea estructura inicial (branch, warehouse, sale_point, cash_register).
- Si rubro elegido tiene productos demo: pre-carga 20-30 productos.

**Límites explícitos:**
- NO opera POS (solo configura).
- NO valida fiscalmente comprobantes (es Fiscal).

---

### 4.4 Mapa de dependencias entre dominios (Fase 0)

```
                    ┌──────────────────────┐
                    │   Tenant Management  │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │   Identity & Auth    │
                    └──────────┬───────────┘
                               │
       ┌───────────────────────┼────────────────────────┐
       ▼                       ▼                        ▼
  ┌────────┐            ┌────────────┐            ┌──────────┐
  │Catalog │◄───────────│   Sales    ├───────────►│   Cash   │
  └───┬────┘            └─────┬──────┘            └──────────┘
      │                       │                        ▲
      ▼                       ▼                        │
  ┌────────────┐         ┌─────────┐                   │
  │  Inventory │◄────────│  Fiscal │                   │
  └────────────┘         └─────────┘                   │
                              │                        │
                              ▼                        ▼
                         ┌────────────────────────────────┐
                         │       Notifications            │
                         └────────────────────────────────┘
                              │
                              ▼
                         ┌────────────────────────────────┐
                         │           Audit                │
                         └────────────────────────────────┘
                              │
                              ▼
                         ┌────────────────────────────────┐
                         │        Observability           │
                         └────────────────────────────────┘
```

**Lectura:**
- Las flechas indican dependencias permitidas (quién puede invocar a quién).
- Audit y Observability son sinks transversales (todos les escriben, no leen de nadie).
- Sales es el "hub" de coordinación, conecta múltiples dominios.
- Tenant Management y Auth están "arriba" — los demás dependen de ellos pero no al revés.

### 4.5 Reglas de oro entre dominios

1. **Nunca acceso directo a tablas ajenas.** Solo via Service o evento.
2. **Eventos NO son control de flujo.** Si la operación requiere consistencia transaccional, es llamada directa. Eventos solo para reacciones idempotentes.
3. **Side effects auditados.** Todo cambio de estado relevante genera entrada en `audit_log`.
4. **Idempotencia obligatoria.** Cualquier dominio que reciba eventos debe ser idempotente. Eventos pueden duplicarse en Fase 1+ con BullMQ.
5. **Servicios sin estado.** Todos los Services son funciones puras + acceso a DB. No memoria global.

### 4.6 Estructura de carpetas resultante

```
src/lib/
├── domains/
│   ├── tenant/
│   │   ├── tenant.service.ts
│   │   ├── tenant.types.ts
│   │   ├── tenant.events.ts
│   │   └── tenant.test.ts
│   ├── auth/
│   ├── catalog/
│   ├── inventory/
│   ├── customer/
│   ├── sales/
│   ├── cash/
│   ├── fiscal/
│   ├── notifications/
│   ├── audit/
│   ├── observability/
│   ├── subscription/
│   └── onboarding/
└── shared/
    ├── events.ts       # Event bus interno (Fase 0: in-memory)
    ├── errors.ts       # Error classes tipadas
    └── types.ts        # Tipos compartidos
```

---

# PARTE 3 — 10 ADRs FORMALES

🟢 **VERDE** — Todos son decisiones técnicas, alta confianza.

Los presento como **archivo unificado por brevedad** — en Sesión 4 los separo en archivos individuales si querés. Cada ADR sigue el mismo template estándar.

---

## ADR-0001: Stack base — Next.js + Supabase + PostgreSQL

**Fecha:** 17 mayo 2026
**Estado:** Aceptado
**Autores:** Owner técnico
**Reemplaza a:** —
**Reemplazado por:** —

### Contexto

Necesitamos definir el stack base para Pandora ERP, optimizando para:
- Velocidad de desarrollo con equipo de 1-2 personas.
- Costo bajo en Fase 0 (target: < $100/mes en infra hasta 50 clientes).
- Compliance argentino (RLS, auditoría, retención fiscal).
- Capacidad de escalar a 2.000+ clientes sin rewrite del core.

### Decisión

Adoptar:
- **Frontend:** Next.js 14 App Router con TypeScript strict mode.
- **Backend:** Server Actions de Next.js. Application Services en TypeScript puro.
- **Base de datos:** Supabase managed (PostgreSQL 16 + Auth + Storage + Edge Functions).
- **ORM:** Drizzle.
- **Lenguaje único:** TypeScript end-to-end.

### Alternativas consideradas

- **Stack Go + gRPC + Kafka + K8s:** propuesto por Deep Research Report. Rechazado por overhead operativo insostenible para equipo de 1-2 personas.
- **Rails + PostgreSQL:** opción válida pero ecosistema TS más fuerte y permite reutilizar tipos entre frontend y backend.
- **Stack Java + Spring:** demasiado pesado para Fase 0.
- **Database custom (MongoDB, CockroachDB):** PostgreSQL es battle-tested con RLS nativo y herramientas argentinas (Tango exporta CSV pensando en Postgres-likes).

### Consecuencias

**Positivas:**
- Velocidad de desarrollo máxima con 1-2 devs.
- Tipos compartidos entre frontend y backend.
- Supabase managed reduce overhead operativo (auth, storage, backups built-in).
- Vercel deploy automatizado.
- Comunidad enorme y documentación abundante.

**Negativas:**
- Vendor lock-in moderado a Supabase. Mitigación: usar solo PostgreSQL standard, sin features Supabase-specific.
- Vercel pricing escala con tráfico, no con clientes. Puede ser caro en Fase 3+.
- Server Actions tienen menor portabilidad si en Fase 4 se decide migrar a otro framework.

**Riesgos:**
- Supabase cambia pricing → mitigación: export semanal a S3 propio.
- Vercel limita ejecución prolongada (jobs largos) → mitigación: worker dedicado en Railway desde Fase 1.

---

## ADR-0002: Multi-tenant con RLS sobre auth.jwt()

**Fecha:** 17 mayo 2026
**Estado:** Aceptado
**Autores:** Owner técnico

### Contexto

Pandora es multi-tenant con miles de empresas potenciales compartiendo infraestructura. Cada empresa ve solo sus datos. Necesitamos aislamiento robusto sin overhead operativo.

### Decisión

- **Shared database, shared schema.** Todas las empresas en mismas tablas, diferenciadas por `company_id`.
- **Aislamiento por Row Level Security (RLS) de PostgreSQL.**
- **Policy basada en JWT:** `company_id = (auth.jwt() ->> 'company_id')::uuid`
- **Doble validación:** Application Service verifica `company_id` antes de ejecutar, RLS es red de seguridad.

### Alternativas consideradas

- **Schema-per-tenant:** rechazado. Overhead operativo de migraciones, backups, conexiones por tenant es insostenible para 100+ empresas.
- **Database-per-tenant:** rechazado por la misma razón. Posible considerar en Fase 5 para clientes Enterprise.
- **RLS con `current_setting('app.tenant_id')`:** rechazado. No sobrevive a connection pooling (Supavisor) — el setting puede leak entre tenants.
- **Sin RLS, solo validación a nivel aplicación:** rechazado. Single point of failure. Si Application Service tiene bug, leak total.

### Consecuencias

**Positivas:**
- Escalabilidad operativa (Notion, Linear, Stripe operan así).
- Backups simples (un solo dump por base completa).
- Migraciones únicas.
- Defensa en profundidad.

**Negativas:**
- Overhead de CPU en Postgres por evaluar policy en cada query. Tolerable hasta Fase 3.
- Algunas queries complejas requieren reformulación para que RLS sea eficiente.

**Riesgos:**
- Bug en RLS policy → leak cross-tenant. Mitigación: tests cross-tenant obligatorios en CI desde primer commit.
- A 2.000+ clientes el RLS overhead puede ser bottleneck. Mitigación: re-evaluar Fase 3 con datos reales, considerar BFF si necesario.

---

## ADR-0003: Lógica de dominio en TypeScript, no en plpgsql

**Fecha:** 17 mayo 2026
**Estado:** Aceptado
**Autores:** Owner técnico
**Sobrescribe propuesta inicial del proyecto** que sugería RPCs en plpgsql.

### Contexto

La propuesta inicial (corregida) sugería implementar lógica de negocio crítica (creación de venta, facturación, ajuste de stock) en plpgsql como RPCs SECURITY DEFINER. Esto fue rechazado en auditoría posterior.

### Decisión

**Toda la lógica de negocio vive en TypeScript** como Application Services con transacciones Drizzle.

```typescript
// CORRECTO
class SaleService {
  async create(input: CreateSaleInput) {
    return await db.transaction(async (tx) => {
      // toda la lógica acá, en TS
    }, { isolationLevel: 'serializable' });
  }
}

// PROHIBIDO
CREATE FUNCTION create_sale_rpc(...) AS $$ ... $$
```

### Alternativas consideradas

- **plpgsql RPCs:** rechazado. No testeable unitariamente con cobertura real, no debuggeable con stack traces normales, acopla dominio al motor de DB.
- **Stored procedures con pl/v8 (JavaScript dentro de Postgres):** rechazado. Combina lo peor de ambos mundos.
- **Microservicios separados por dominio:** rechazado por ADR-0007 (monolito modular).

### Consecuencias

**Positivas:**
- Testeable con Vitest, cobertura real.
- Debuggeable con stack traces normales.
- Versionable en git como cualquier código.
- Onboarding de devs nuevos no requiere expertise específico de Postgres.

**Negativas:**
- Transacciones más cuidadosas (Drizzle `transaction()` con `isolationLevel`).
- Más roundtrips DB en operaciones complejas (vs un solo plpgsql).

**Riesgos:**
- Performance: para operaciones MUY complejas con 10+ queries, considerar batch. Mitigación: medir antes de optimizar.

---

## ADR-0004: AFIP sincrónico en hot path con timeout 30s

**Fecha:** 17 mayo 2026
**Estado:** Aceptado
**Autores:** Owner técnico

### Contexto

AFIP (WSFEv1) es síncrono por naturaleza — no tiene webhooks. Cuando el comerciante factura, debe obtener CAE inmediatamente para imprimir el ticket. Hubo propuesta de "facturación asíncrona con cola" que se rechazó.

### Decisión

- **Llamada sincrónica** a WSFEv1 dentro de la transacción de venta.
- **Timeout 30 segundos** (límite operativo, el cajero no espera más).
- **Si AFIP responde OK:** persiste CAE, commit transacción, imprime con QR.
- **Si AFIP responde con error:** número quemado, rollback, error visible.
- **Si timeout (no responde en 30s):** rollback de transacción de fiscal, venta queda en `no_document`, encola job de reconciliación.

### Alternativas consideradas

- **Asíncrono con cola desde el origen:** rechazado. Rompe la experiencia del cajero argentino — necesita CAE inmediato.
- **Caché de CAEAs anticipados:** evaluado, descartado para Fase 0. Complejo de gestionar, mejor reconciliación post-facto.

### Consecuencias

**Positivas:**
- UX del cajero alineada con expectativa local.
- Modelo simple: AFIP OK = comprobante OK.

**Negativas:**
- Latencia visible de venta = latencia AFIP. Aceptable porque AFIP típicamente responde en 1-3s.
- Si AFIP cae, fallback a ticket no fiscal puede confundir.

**Riesgos:**
- AFIP timeout masivo afecta tasa de facturación. Mitigación: alertas Sentry, fallback automático, reconciliación robusta.

---

## ADR-0005: Money en numeric(19,4), nunca float

**Fecha:** 17 mayo 2026
**Estado:** Aceptado
**Autores:** Owner técnico

### Contexto

Argentina tiene cálculos fiscales precisos. Drift monetario por float es bug fiscal grave (genera multas AFIP). El IVA se calcula por línea con alícuotas variables, requiere precisión.

### Decisión

- **DB:** `numeric(19,4)` para todos los montos operativos (4 decimales = diezmilésimos).
- **DB:** `numeric(12,2)` solo en outputs hacia AFIP (2 decimales).
- **TS:** clase `Money` que envuelve operaciones, jamás `number`.
- **Cálculo IVA:** por línea individual, redondeo half-up a 2 decimales al cierre.
- **Verificación:** sum(sale_items.total_line) === sale.total, exact match (sin tolerancia).

### Alternativas consideradas

- **`numeric(12,2)` interno:** rechazado. 2 decimales no alcanza para cálculos intermedios (porcentajes, divisiones).
- **`bigint` en centavos:** alternativa válida pero menos legible y requiere conversión constante.
- **`decimal` library en TS sobre `numeric`:** opción a evaluar. Por ahora wrapper simple `Money`.

### Consecuencias

**Positivas:**
- Cero drift.
- Cálculo fiscal exacto.
- Compatible con cualquier sistema contable.

**Negativas:**
- Operaciones aritméticas requieren wrapper (no se puede hacer `total + iva` directo).

---

## ADR-0006: Numeración fiscal correlativa con SELECT FOR UPDATE

**Fecha:** 17 mayo 2026
**Estado:** Aceptado
**Autores:** Owner técnico

### Contexto

AFIP exige numeración correlativa estricta por (punto de venta, tipo de comprobante). Sin huecos. Sin reutilizar números. Bajo concurrencia esto requiere coordinación.

### Decisión

- Tabla `invoice_sequences` con (`sale_point_id`, `invoice_type`, `last_number`).
- Reserva atómica: `SELECT ... FOR UPDATE` sobre la fila correspondiente dentro de transacción serializable.
- Después del lock: `last_number = last_number + 1`, retornar.
- Lock se libera al commit/rollback.
- Si AFIP rechaza: número queda "consumido" en la secuencia (status `burned` en `afip_invoices`). NUNCA reutilizable.
- Sincronización inicial: al crear PV, consultar `FECompUltimoAutorizado` para iniciar secuencia.

### Alternativas consideradas

- **PostgreSQL sequence (`CREATE SEQUENCE`):** rechazado. Sequences no son transaccionales (incrementan aunque rollback), generaría huecos no auditables.
- **Optimistic concurrency con retry:** rechazado. Bajo alta concurrencia genera múltiples retries y latencia variable. SELECT FOR UPDATE es determinista.

### Consecuencias

**Positivas:**
- Garantía de orden y no-duplicación.
- Auditable.
- Resistente a race conditions.

**Negativas:**
- Lock contention si dos cajeros del mismo PV facturan simultáneamente. En la práctica: lock dura < 100ms, no problema real.

---

## ADR-0007: Monolito modular, sin microservicios en Fase 0-2

**Fecha:** 17 mayo 2026
**Estado:** Aceptado
**Autores:** Owner técnico

### Contexto

Equipo de 1-2 desarrolladores. Iniciar con microservicios desde el día 1 mata velocidad por overhead operativo (deploy, debugging, monitoring distribuido).

### Decisión

- **Fase 0-2:** Aplicación monolítica con dominios separados (bounded contexts) dentro de la misma codebase.
- **Fase 3:** Re-evaluar extracción de servicios si:
  - Hay dolor medible (latencia, deploy time, conflictos de merge).
  - El equipo creció a 5+ devs.
- **Fase 4+:** Microservicios solo donde haya razón clara (motor fiscal, integraciones).

### Alternativas consideradas

- **Microservicios desde Fase 0:** rechazado. Overhead de orquestación, observabilidad distribuida, transacciones distribuidas para equipo de 1-2 es deal-breaker.
- **Hexagonal architecture sin separación física:** alternativa válida, esencialmente esto es lo que hacemos.

### Consecuencias

**Positivas:**
- Velocidad de desarrollo máxima.
- Transacciones simples (ACID dentro del monolito).
- Debugging directo.
- Deploys atómicos.

**Negativas:**
- Si Pandora crece a 100+ devs en Fase 5, monolito tendrá fricciones.
- Acoplamiento posible si no se respetan dominios.

**Mitigación:**
- Estructura de carpetas refleja dominios (`src/lib/domains/`).
- Tests de límites entre dominios.
- ADRs documentan dependencias permitidas.

---

## ADR-0008: Accountant multi-empresa con JWT extendido

**Fecha:** 17 mayo 2026
**Estado:** Aceptado
**Autores:** Owner técnico

### Contexto

El contador de un comerciante es feature crítica del modelo de negocio (CAC bajo vía referidos). Necesita ver múltiples empresas con un solo usuario.

### Decisión

- Rol `accountant` con tabla `accountant_companies` (vincula contador → empresa).
- JWT del contador incluye `authorized_companies: [uuid, uuid, ...]`.
- RLS extiende la policy: `company_id IN (SELECT...)` para rol accountant.
- Contador no modifica datos del comerciante. Solo lee + exporta.

### Alternativas consideradas

- **Una cuenta de usuario por empresa:** rechazado. UX inaceptable, contador tendría 50 logins.
- **Empresas como "subuser":** rechazado. Complica modelo de tenant.

### Consecuencias

**Positivas:**
- UX del contador excelente.
- Modelo de adquisición vía referidos viable.
- Audit log trackea qué contador hizo qué.

**Negativas:**
- Si contador tiene 50+ empresas, JWT puede crecer demasiado. Mitigación: límite 50 empresas por contador, después migrar a lookup en DB.

---

## ADR-0009: Feature flags por tenant desde Fase 0

**Fecha:** 17 mayo 2026
**Estado:** Aceptado
**Autores:** Owner técnico

### Contexto

Activar funcionalidades gradualmente por tenant evita bugs masivos y permite probar features con piloto.

### Decisión

- Tabla `tenant_features` con flags por empresa.
- Flags evaluados en Server Actions y UI.
- Flags configurables por owner del tenant (lo permitido por su plan) y por admin de Pandora (override global si necesario).

### Alternativas consideradas

- **LaunchDarkly o herramienta externa:** rechazado para Fase 0 por costo. Considerar Fase 2+ si hay > 100 flags.
- **Sin feature flags:** rechazado. Sin esto, todos los tenants reciben todo simultáneamente. Bugs masivos.

### Consecuencias

**Positivas:**
- Rollout gradual.
- Rollback inmediato si feature falla.
- Permite venta basada en features (planes Starter/Pro/Business).

**Negativas:**
- Código se llena de `if (flag)` chequeos. Mitigación: helper centralizado.

---

## ADR-0010: Audit log inmutable con REVOKE UPDATE/DELETE

**Fecha:** 17 mayo 2026
**Estado:** Aceptado
**Autores:** Owner técnico

### Contexto

La auditoría es feature de seguridad y compliance crítica. Sin inmutabilidad, un atacante (interno o externo) puede borrar evidencia de operaciones fraudulentas. Ley 11.683 requiere trazabilidad de 10 años.

### Decisión

- Tabla `audit_log` con `REVOKE UPDATE, DELETE` para todos los roles excepto superadmin DB (que nadie tiene acceso normal).
- Append-only: solo INSERT permitido.
- Constraint: si acción está en lista de "motivo obligatorio", `reason` no puede ser null.
- Retención: 2 años en hot DB, 8 años en cold (S3 Glacier).

### Alternativas consideradas

- **Audit log en blockchain interno:** rechazado. Overhead enorme sin beneficio práctico para nuestra escala.
- **Eventos en Kafka como audit:** rechazado por ADR-0007. Mismo objetivo se logra con tabla PostgreSQL.

### Consecuencias

**Positivas:**
- Cumplimiento Ley 11.683.
- Soporte fácil de incidentes.
- Trazabilidad completa.

**Negativas:**
- Tabla crece sin parar. Mitigación: cron de archivado mensual a S3 Glacier.
- Updates a registros: imposible. Si hay corrección, se inserta entrada nueva con `previous_audit_id` referencia. (Edge case raro.)

---

# CIERRE DE SESIÓN 3

## Resumen entregado

**Parte 1 — 8 ambigüedades originales resueltas:**

1. ✅ Modo demo (resuelta en Sesión 1)
2. ✅ Acceso temporal auditor (30 días default, hasta 90, configurable por owner)
3. ✅ Cron 23:59 (configurable + smart detection, definida en Sesión 2)
4. ✅ Suspensión por impago (política día 1 → día 90+)
5. ✅ Stock negativo configurable (3 niveles: never/with_authorization/with_warning)
6. ✅ NC < 24h (24h desde sale.completed_at + mismo cash_session_id)
7. ✅ Conciliación bancaria (semi-automática Fase 2, evaluar bancos directos Fase 3+)
8. ✅ Marketplace (Fase 3 módulos internos, Fase 4 partners externos)

**Parte 2 — Sección 4 Dominios expandida:**

13 dominios de Fase 0 documentados con responsabilidad, entidades propias, eventos emitidos/consumidos, dependencias permitidas, side effects, límites explícitos. Mapa de dependencias visual. Reglas de oro entre dominios. Estructura de carpetas resultante.

**Parte 3 — 10 ADRs formales:**

ADR-0001 a ADR-0010 con template estándar (contexto, decisión, alternativas, consecuencias). Cubren todas las decisiones arquitectónicas críticas que necesitás documentadas antes del primer commit.

## Decisiones menores pendientes 🔴

1. ¿Bloqueo de demo expirado es de login o de operaciones?

## Validaciones humanas pendientes 🟡

Las consolido para que las tengas en una sola lista cuando consigas contador y abogado:

**Contador advisor — validar:**
- Venta válida sin factura definitiva tras reconciliation_timeout
- NC con cambio de condición IVA del cliente
- Manejo de comprobante `observed` (con observaciones AFIP)
- Esquema completo de motivos obligatorios fiscales
- Política de NC dentro de 24h: alcance y excepciones

**Abogado — validar:**
- TyC con cláusulas de limitación de responsabilidad
- Política de suspensión por impago y conservación de datos
- DPA template para clientes
- Inscripción AAIP completa
- Política de delete company con 7 días delay
- Eliminación de datos personales según Ley 25.326

## Próxima sesión

**Sesión 4:** Integración completa en SRS v3.0 unificado.

**Contenido:** Tomo el v2.0-OMN + correcciones Sesión 1 + Observabilidad y Máquinas de Sesión 2 + Ambigüedades, Dominios y ADRs de Sesión 3, y produzco **un solo archivo SRS v3.0 final**.

**Estado de proyecto:** 75% completado.

---

*Fin de SRS Sesión 3 — 17 mayo 2026*
