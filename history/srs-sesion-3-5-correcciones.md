# PANDORA ERP — SRS Sesión 3.5
## Patch consolidado de correcciones de auditoría independiente

**Fecha:** 17 mayo 2026
**Base:** Sesiones 1, 2 y 3 + auditoría externa
**Estado:** Aprobado para integración en SRS v3.0 (Sesión 4)
**Origen:** Auditoría independiente de Sesiones 1-3, 10 hallazgos accionables

---

## Índice de cambios

| # | Severidad | Cambio | Sección afectada |
|---|---|---|---|
| 1 | BLOQUEANTE | audit_log: revoke INSERT a authenticated, AuditService.log() único | Sesión 2 → 13.10 |
| 2 | BLOQUEANTE | Cierre forzado unificado: solo versión configurable + smart detection | Sesión 2 → SM-05 |
| 3 | BLOQUEANTE | Customer snapshot inmutable en sales/invoices | Sesión 3 → Sales, Customers, Fiscal |
| 4 | BLOQUEANTE | Retry serializable con backoff en hot path | Sesión 3 → ADR-0006, Sales, Inventory |
| 5 | IMPORTANTE | Cadencia AFIP reconciliation (5 min, max 24 intentos) | Sesión 1 → Fix 5 |
| 6 | IMPORTANTE | Reversión force_closing → open con admin | Sesión 2 → SM-05 |
| 7 | IMPORTANTE | Política idempotency en borde de TTL | Sesión 2 → 13.11 |
| 8 | IMPORTANTE | Revalidación de CUIT en hot path de facturación | Sesión 3 → Fiscal, ADR-0004 |
| 9 | IMPORTANTE | Snapshot de condición fiscal del tenant en cash_session | Sesión 3 → Cash, Tenancy |
| 10 | MENOR | Riesgo macro inflación documentado en sección Riesgos | Sesión 4 → Riesgos |

---

# CAMBIO #1 — Audit_log: cierre de superficie de inserción

**Severidad:** BLOQUEANTE
**Origen:** Hallazgo Bloqueante 1 + Importante 1 de auditoría externa
**Aplica a:** Sesión 2, Sección 13.10

## Problema identificado

El esquema original revoca UPDATE/DELETE pero deja INSERT habilitado para `authenticated`. Esto permite que un cliente comprometido escriba auditoría falsa. El audit log deja de ser evidencia forense confiable.

## Texto a reemplazar en Sesión 2, Sección 13.10

### ANTES

```sql
-- Immutability
REVOKE UPDATE, DELETE ON audit_log FROM authenticated, service_role;
GRANT INSERT ON audit_log TO authenticated;
```

### DESPUÉS

```sql
-- Inmutabilidad y cierre de superficie de escritura
-- audit_log es write-only y solo accesible desde server-side
REVOKE ALL ON audit_log FROM authenticated;
REVOKE UPDATE, DELETE, TRUNCATE ON audit_log FROM service_role;
GRANT INSERT ON audit_log TO service_role;

-- SELECT permitido solo para roles específicos vía RLS
CREATE POLICY audit_log_read_owner ON audit_log
  FOR SELECT
  USING (
    company_id = (auth.jwt() ->> 'company_id')::uuid
    AND (auth.jwt() ->> 'rol') IN ('owner', 'admin')
  );

CREATE POLICY audit_log_read_auditor ON audit_log
  FOR SELECT
  USING (
    company_id = (auth.jwt() ->> 'company_id')::uuid
    AND (auth.jwt() ->> 'rol') = 'auditor'
    AND occurred_at >= (auth.jwt() ->> 'auditor_access_from')::timestamptz
  );

-- Acceso del contador: solo a SUS empresas autorizadas
CREATE POLICY audit_log_read_accountant ON audit_log
  FOR SELECT
  USING (
    (auth.jwt() ->> 'rol') = 'accountant'
    AND company_id::text = ANY(SELECT jsonb_array_elements_text(auth.jwt() -> 'authorized_companies'))
  );
```

## Texto NUEVO a agregar después del schema en Sesión 2, Sección 13.10

```markdown
### 13.10.bis Contrato de inserción de audit_log

Toda inserción en `audit_log` pasa por una sola API server-side: `AuditService.log()`.

**Reglas:**

1. Cliente NUNCA escribe directamente en `audit_log`. La tabla no acepta INSERT desde rol `authenticated`.
2. Toda escritura usa `service_role` desde código backend.
3. La función `AuditService.log()` valida:
   - `tenant_id` coincide con el JWT del request actual.
   - `user_id` coincide con `auth.uid()` del request (o `null` si es sistema).
   - `action` pertenece al whitelist de acciones auditables.
   - `correlation_id` está presente.
4. Si cualquier validación falla: `AuditService.log()` lanza error fatal. La operación de negocio asociada DEBE revertirse.

### Implementación TypeScript

```typescript
// src/lib/services/audit/audit.service.ts

const AUDITABLE_ACTIONS = [
  'sale.created', 'sale.cancelled', 'sale.refunded',
  'stock.adjusted', 'stock.negative_override',
  'cash_session.opened', 'cash_session.closed',
  'cash_session.closed_with_difference', 'cash_session.force_closed',
  'cash_session.force_closing_reverted',
  'invoice.issued', 'invoice.failed', 'invoice.burned',
  'invoice.reconciliation_timeout',
  'customer.created', 'customer.updated', 'customer.deleted',
  'customer.iva_condition_changed',
  'product.created', 'product.updated', 'product.deleted',
  'product.price_changed',
  'user.invited', 'user.role_changed', 'user.deactivated',
  'accountant.invited', 'accountant.revoked',
  'company.updated', 'company.deleted', 'company.iva_condition_changed',
  'subscription.suspended', 'subscription.reactivated',
  'fiscal_config.modified',
  'support.impersonation_started', 'support.impersonation_ended',
  'integration.activated', 'integration.deactivated',
  'export.requested', 'export.downloaded',
  'import.applied', 'import.rolled_back',
] as const;

type AuditableAction = typeof AUDITABLE_ACTIONS[number];

interface AuditLogParams {
  companyId: string;
  userId: string | null;
  userRole: string;
  action: AuditableAction;
  entity: string;
  entityId: string | null;
  changes: {
    before: Record<string, unknown> | null;
    after: Record<string, unknown> | null;
  };
  reason?: string;
  metadata: {
    correlationId: string;
    ip?: string;
    userAgent?: string;
    terminalId?: string;
    branchId?: string;
    channel?: 'pos' | 'web' | 'whatsapp' | 'api' | 'system';
  };
}

export class AuditService {
  constructor(
    private dbAdmin: SupabaseClient, // service_role client
    private currentContext: RequestContext
  ) {}

  async log(params: AuditLogParams): Promise<void> {
    // 1. Validar tenant matching
    if (params.companyId !== this.currentContext.companyId
        && params.userRole !== 'support') {
      throw new FatalAuditError('TENANT_MISMATCH_IN_AUDIT');
    }

    // 2. Validar user matching (si no es sistema)
    if (params.userId !== null
        && params.userId !== this.currentContext.userId
        && params.userRole !== 'support') {
      throw new FatalAuditError('USER_MISMATCH_IN_AUDIT');
    }

    // 3. Validar action en whitelist
    if (!AUDITABLE_ACTIONS.includes(params.action)) {
      throw new FatalAuditError(`INVALID_ACTION: ${params.action}`);
    }

    // 4. Validar reason en acciones destructivas
    const requiresReason = [
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
      'import.rolled_back',
    ];
    if (requiresReason.includes(params.action) && !params.reason) {
      throw new FatalAuditError(`REASON_REQUIRED: ${params.action}`);
    }

    // 5. Insertar con service_role
    await this.dbAdmin.from('audit_log').insert({
      company_id: params.companyId,
      user_id: params.userId,
      user_role: params.userRole,
      action: params.action,
      entity: params.entity,
      entity_id: params.entityId,
      changes: params.changes,
      reason: params.reason ?? null,
      metadata: params.metadata,
      occurred_at: new Date().toISOString(),
    });
  }
}
```

### Consecuencias

- Imposible escribir auditoría falsa desde cliente comprometido.
- Falsificación requiere comprometer service_role key (problema mucho más serio que tendría otros síntomas).
- AuditService.log() es el único lugar a auditar en code review para garantizar integridad de logs.
- Cualquier dominio que necesite auditar lo hace a través de esta interfaz.
```

---

# CAMBIO #2 — Cierre forzado de caja: unificación definitiva

**Severidad:** BLOQUEANTE
**Origen:** Hallazgo Bloqueante 2 + Importante 3 de auditoría externa
**Aplica a:** Sesión 2, SM-05 CashSession

## Problema identificado

Sesión 2 modela cron 23:59 fijo. Sesión 3 redefine como configurable + smart detection. Conviven dos formulaciones incompatibles. La implementación va a elegir una, la documentación otra.

## Texto a reemplazar en Sesión 2, SM-05

### ANTES (versión completa con cron fijo)

```
[open]
  ├── → [closing] (cashier inicia cierre)
  ├── → [force_closing] (cron 23:59 o admin)
  └── (no hay salida directa a closed sin pasar por closing)

...

### Cron de cierre forzado

```
Trigger: 23:59 hora local del tenant
Condición: cash_session.status = 'open' AND opened_at < now() - interval '2 hours'
Acción: 
  1. Marcar como force_closing
  2. Notificar cashier por email/SMS
  3. Esperar 1 hora para que cashier responda
  4. Si no responde: completar a force_closed
  5. Generar reporte automático con monto final = monto esperado calculado (sin arqueo real)
  6. Audit log con reason='force_closed_by_cron_inactivity'
```

### Casos especiales

🔴 **DECISIÓN PENDIENTE** — Comercios 24hs
...
```

### DESPUÉS (versión unificada, configurable + smart detection)

```markdown
### Estados y transiciones de CashSession (versión definitiva)

```
[closed] (terminal de cierre del turno anterior)
  └── → [opening] (admin/cashier inicia apertura)

[opening] (transitorio breve)
  ├── → [open] (apertura completada con monto inicial)
  └── → [closed] (apertura cancelada)

[open]
  ├── → [closing] (cashier inicia cierre voluntario)
  └── → [force_closing] (cron detecta inactividad + smart detection negativa)

[closing] (cashier contando efectivo)
  ├── → [closed] (arqueo dentro de tolerancia)
  ├── → [closed_with_difference] (descuadre > tolerancia + motivo registrado)
  └── → [open] (cashier cancela cierre y sigue operando)

[force_closing] (cron forzando, 1 hora de gracia)
  ├── → [open] (admin/owner revierte con motivo) -- NUEVO
  ├── → [closing] (cashier responde y completa cierre normal manual) -- NUEVO
  └── → [force_closed] (1 hora sin respuesta — terminal)

[closed] (terminal — permite reapertura como nuevo turno)
[closed_with_difference] (terminal — descuadre auditado)
[force_closed] (terminal — requiere reconciliación posterior)
```

### Tabla de transiciones actualizada

| Estado actual | Acción | Estado destino | Precondiciones | Side effects |
|---|---|---|---|---|
| closed | open_session | opening | No hay turno abierto en la caja | Lock UNIQUE (cash_register_id, status='open') |
| opening | confirm_open | open | Monto inicial registrado | cash_session.initial_amount, cash_movement initial |
| opening | cancel_opening | closed | Cashier abandona | Sin efecto |
| open | initiate_close | closing | No hay ventas pending_payment | Bloquear nuevas ventas en esta caja |
| open | smart_detection_force | force_closing | Cron + inactividad + smart detection negativa | Notificar cashier |
| closing | submit_count | closed | Diferencia <= tolerancia | cash_session.final_amount, generar reporte PDF |
| closing | submit_count_difference | closed_with_difference | Diferencia > tolerancia + motivo | Mismo + audit_log con reason |
| closing | cancel_close | open | Cashier decide seguir operando | Desbloquear ventas |
| force_closing | admin_revert | open | Admin/owner + motivo obligatorio | audit_log action='cash_session.force_closing_reverted' |
| force_closing | cashier_responds | closing | Cashier responde dentro de hora de gracia | Continúa como cierre normal |
| force_closing | grace_period_expired | force_closed | 1 hora sin respuesta ni reversión | Marcar como pending_reconciliation |
| closed | next_session | opening | Nuevo turno se abre | Nueva fila en cash_sessions |

### Configuración por tenant

```sql
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS
  force_close_hour text NOT NULL DEFAULT '23:59',
  smart_detection_enabled boolean NOT NULL DEFAULT true,
  smart_detection_inactivity_threshold_hours int NOT NULL DEFAULT 2,
  cash_session_no_auto_close boolean NOT NULL DEFAULT false,
  cash_difference_tolerance_percent numeric(5,2) NOT NULL DEFAULT 1.00;
```

### Cron de cierre forzado (versión definitiva)

```
Worker: cron-cash-session-force-close
Trigger: cada 5 minutos
Condición principal:
  - cash_session.status = 'open'
  - now() >= timestamp_at_tenant_local_force_close_hour(company.timezone, force_close_hour)
  - company_settings.cash_session_no_auto_close = false

Para cada cash_session candidata:

  1. Si smart_detection_enabled:
     Verificar si hubo actividad en las últimas N horas
     (N = smart_detection_inactivity_threshold_hours, default 2):
     
     SELECT EXISTS(
       SELECT 1 FROM cash_movements 
       WHERE shift_id = $1 
       AND created_at > now() - interval '${N} hours'
     ) OR EXISTS(
       SELECT 1 FROM sales
       WHERE shift_id = $1
       AND created_at > now() - interval '${N} hours'
     ) AS has_recent_activity;
     
     Si has_recent_activity = TRUE:
       SKIP. Dejar abierto. Próxima evaluación en 5 min.

  2. Marcar status = 'force_closing'
  3. Notificar cashier por email/SMS:
     "Tu turno va a cerrarse automáticamente en 1 hora por inactividad.
      Si seguís trabajando: cerrá manualmente.
      Si te olvidaste: no hagas nada, se cerrará solo."
  4. Esperar 1 hora desde force_closing.entered_at
  
  5. Si el cashier respondió (status pasó a closing) durante esa hora:
     Flujo normal de cierre voluntario.
  
  6. Si admin/owner revirtió durante esa hora (status volvió a open):
     audit_log con reason. Cron evalúa de nuevo en próximo ciclo.
  
  7. Si pasó 1 hora sin respuesta ni reversión:
     - Marcar status = 'force_closed'
     - Calcular expected_cash_amount automáticamente
     - Generar reporte PDF con disclaimer "Cierre automático sin arqueo presencial"
     - audit_log con action='cash_session.force_closed', 
       reason='cron_auto_close_grace_expired'
     - Notificar owner: "Tu caja se cerró automáticamente. Revisá."
```

### Excepción: comercios 24h

Tenants con `cash_session_no_auto_close = true` quedan **completamente excluidos del cron**. El owner debe activar este flag manualmente con audit_log y motivo. Estos tenants son responsables de gestionar cierres manualmente.

UI advierte al activar: "Si desactivás el cierre automático, tus turnos pueden quedar abiertos indefinidamente. Asegurate de tener proceso operativo propio para cerrarlos."
```

---

# CAMBIO #3 — Customer snapshot inmutable en ventas y facturas

**Severidad:** BLOQUEANTE
**Origen:** Hallazgo Bloqueante 3 + Riesgo 2 de auditoría externa
**Aplica a:** Sesión 3 (Sales, Customers, Fiscal) + schema de DB

## Problema identificado

Sesión 3 indica que Sales reasigna ventas históricas a "consumidor final" cuando un cliente se elimina. Esto reescribe el sujeto fiscal de una factura emitida, lo cual viola la inmutabilidad contable y rompe trazabilidad histórica.

## Texto a reemplazar en Sesión 3, dominio Customers

### ANTES (en sección de side effects de Customers)

```
- Soft delete de producto: NO afecta histórico de ventas.
- Customer Management define soft delete, Sales consume customer.deleted 
  para reasignar ventas históricas a "consumidor final".
```

### DESPUÉS (en sección 4.3, dominio Customers)

```markdown
### Side effects al eliminar cliente (CORREGIDO)

**Regla absoluta:** El histórico de ventas y facturas **nunca** se reescribe.

Cuando un cliente se elimina (soft delete):
- `customers.active = false`, `customers.deleted_at = now()`.
- Ventas y facturas históricas **mantienen** el `customer_id` original como FK.
- Ventas y facturas históricas **mantienen** el `customer_snapshot` inmutable
  (datos al momento de la transacción, ver cambio en Sales/Fiscal).
- UI muestra en histórico: nombre original del cliente + badge "(eliminado)".
- Nuevas ventas NO pueden seleccionar este cliente.

**Nunca:**
- Reasignar `customer_id` de ventas/facturas pasadas.
- Eliminar el registro físicamente.
- Modificar `customer_snapshot` capturado.

### Caso especial: OfflineSync

En Sesión 2 SM-12, el conflicto "Cliente eliminado en servidor" se documentó como 
"reasignar a consumidor final automáticamente". 

**Corrección:**

Cuando una operación offline llega al servidor y el cliente fue eliminado en el 
servidor mientras tanto:

1. **Bloquear sync de esa operación con conflicto explícito.**
2. UI ofrece al usuario:
   - "Asignar a Consumidor Final" (con audit_log de la decisión)
   - "Anular la venta offline" (con audit_log)
   - "Reactivar el cliente eliminado" (si tiene permisos)
3. Sin decisión del usuario: la operación queda en `conflict` indefinidamente.
4. Nunca reasignación automática silenciosa.
```

## Cambio de schema requerido

### Agregar columna a `sales`

```sql
ALTER TABLE sales ADD COLUMN customer_snapshot jsonb;

COMMENT ON COLUMN sales.customer_snapshot IS 
  'Snapshot inmutable de los datos del cliente al momento de la venta.
   Capturado por SaleService.create() y nunca modificado posteriormente.
   Incluye: name, document_type, document_number, iva_condition, 
   fiscal_address, phone, email.';

-- Backfill para ventas existentes (durante migración)
UPDATE sales s
SET customer_snapshot = jsonb_build_object(
  'name', c.name,
  'document_type', c.document_type,
  'document_number', c.document_number,
  'iva_condition', c.iva_condition,
  'fiscal_address', c.fiscal_address,
  'phone', c.phone,
  'email', c.email,
  'captured_at', s.created_at
)
FROM customers c
WHERE s.customer_id = c.id
AND s.customer_snapshot IS NULL;
```

### Agregar columna a `afip_invoices`

```sql
ALTER TABLE afip_invoices ADD COLUMN customer_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN afip_invoices.customer_snapshot IS
  'Snapshot inmutable de datos fiscales del cliente al momento de emisión.
   Incluye: legal_name, document_type, document_number, iva_condition, 
   fiscal_address. Datos que aparecen impresos en el comprobante.
   Capturado por FiscalService.issueInvoice() y nunca modificado.';
```

## Cambio en flujo de SaleService.create()

```typescript
// Dentro de SaleService.create(), después de validar cliente:

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
  // Consumidor final default
  name: 'Consumidor Final',
  document_type: 'CONSUMIDOR_FINAL',
  document_number: null,
  iva_condition: 'consumidor_final',
  fiscal_address: null,
  phone: null,
  email: null,
  captured_at: new Date().toISOString(),
};

await tx.insert(sales).values({
  ...,
  customer_id: customer?.id ?? null,
  customer_snapshot: customerSnapshot,
  ...
});
```

## Cambio en flujo de FiscalService.issueInvoice()

```typescript
// Antes de armar request a AFIP:

const fiscalSnapshot = {
  legal_name: customer.legal_name ?? customer.name,
  document_type: customer.document_type,
  document_number: customer.document_number,
  iva_condition: customer.iva_condition,
  fiscal_address: customer.fiscal_address,
  captured_at: new Date().toISOString(),
  source: 'sale.customer_snapshot', // si vino de la venta
                                    // o 'padron_a5_fresh' si revalidamos
};

// La factura se emite con estos datos. Nunca consultar customers table 
// para reproducir esta factura después.
```

---

# CAMBIO #4 — Retry serializable con backoff

**Severidad:** BLOQUEANTE
**Origen:** Hallazgo Bloqueante 4 + Riesgo 4 de auditoría externa
**Aplica a:** Sesión 3 ADR-0006 + dominios Sales/Inventory

## Problema identificado

Transacciones serializables en SaleService.create() y operaciones de Inventory garantizan consistencia pero, bajo concurrencia real, Postgres devuelve errores 40001 (serialization failure) y 40P01 (deadlock detected). Sin política de retry, esos errores se propagan al usuario como "venta fallida aleatoria".

## Texto a agregar en Sesión 3, ADR-0006

### Nueva subsección dentro del ADR-0006

```markdown
### Política de retry para fallos de serialización

Las transacciones serializables en hot path requieren retry automático con 
backoff exponencial. Sin retry, el sistema tira ventas fallidas bajo 
concurrencia normal.

**Política:**

- **Máximo 3 intentos** por operación.
- **Backoff exponencial corto:** 50ms, 150ms, 400ms entre intentos.
- **Códigos retryables:**
  - `40001` (serialization_failure)
  - `40P01` (deadlock_detected)
- **Otros errores:** NO retry. Propagar inmediatamente.
- **Idempotency key obligatoria:** garantizada por ADR-0010.
- **Después de 3 intentos fallidos:** error explícito al usuario.

### Implementación canónica

```typescript
// src/lib/db/retry.ts

const SERIALIZATION_ERROR_CODES = ['40001', '40P01'];
const MAX_RETRIES = 3;
const BACKOFF_MS = [50, 150, 400];

interface RetryMetadata {
  attempts: number;
  totalDurationMs: number;
  lastError?: string;
}

export async function withSerializationRetry<T>(
  operation: string,
  fn: () => Promise<T>,
  context: { correlationId: string; companyId: string }
): Promise<{ result: T; retryMetadata: RetryMetadata }> {
  const startTime = Date.now();
  let lastError: any;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const result = await fn();
      const totalDurationMs = Date.now() - startTime;

      // Métrica: si hubo retries, registrar
      if (attempt > 0) {
        logger.warn({
          operation,
          attempts: attempt + 1,
          totalDurationMs,
          correlationId: context.correlationId,
          companyId: context.companyId,
        }, 'serialization_retry_succeeded');
        
        metrics.increment('serialization_retry_succeeded', {
          operation,
          attempts: attempt + 1,
        });
      }

      return {
        result,
        retryMetadata: {
          attempts: attempt + 1,
          totalDurationMs,
        },
      };
    } catch (err: any) {
      lastError = err;

      if (!SERIALIZATION_ERROR_CODES.includes(err.code)) {
        // No es error retryable. Propagar inmediatamente.
        throw err;
      }

      if (attempt < MAX_RETRIES - 1) {
        const backoff = BACKOFF_MS[attempt];
        logger.info({
          operation,
          attempt: attempt + 1,
          backoffMs: backoff,
          errorCode: err.code,
          correlationId: context.correlationId,
        }, 'serialization_retry_attempt');
        
        await sleep(backoff);
        continue;
      }
    }
  }

  // Agotó los 3 intentos
  const totalDurationMs = Date.now() - startTime;
  logger.error({
    operation,
    attempts: MAX_RETRIES,
    totalDurationMs,
    errorCode: lastError.code,
    correlationId: context.correlationId,
    companyId: context.companyId,
  }, 'serialization_retry_exhausted');
  
  metrics.increment('serialization_retry_exhausted', { operation });
  
  throw new SerializationRetryExhaustedError(
    operation,
    MAX_RETRIES,
    lastError
  );
}
```

### Uso obligatorio en hot path

```typescript
// SaleService.create()
async create(input: CreateSaleInput) {
  return withSerializationRetry(
    'sale.create',
    () => this.executeCreateSaleTransaction(input),
    { correlationId: input.correlationId, companyId: input.companyId }
  );
}

private async executeCreateSaleTransaction(input: CreateSaleInput) {
  return await db.transaction(async (tx) => {
    // ... toda la lógica de venta
  }, { isolationLevel: 'serializable' });
}
```

### Error de usuario después de retries agotados

```
"Hubo un conflicto con otra operación. Esperá unos segundos y volvé a intentar."

Botón: [Reintentar]

Detrás de bambalinas:
- Misma idempotency_key se reusa.
- Sin duplicación garantizada.
- Logs con stack para investigación post-mortem.
```

### Métricas de monitoreo

- `serialization_retry_succeeded` (counter) — retries exitosos.
- `serialization_retry_exhausted` (counter) — retries agotados.
- Alerta: `serialization_retry_exhausted_rate > 1%` por 15 min = critical.
- Alerta: `serialization_retry_succeeded_rate > 5%` por 15 min = warning 
  (indica contención excesiva, considerar tuning).

### Operaciones que DEBEN usar withSerializationRetry()

- `SaleService.create()`
- `SaleService.cancel()`
- `InvoiceService.issue()`
- `InventoryService.adjustStock()`
- `InventoryService.transfer()`
- `CashSessionService.close()`
- `CashSessionService.open()`
- Cualquier operación que use `transaction()` con isolation serializable.

### Operaciones que NO necesitan retry

- Lecturas (SELECT puro).
- Operaciones con isolation level `read committed`.
- Operaciones que no entran en hot path (jobs background con sus propios retries).
```

---

# CAMBIO #5 — Cadencia AFIP reconciliation

**Severidad:** IMPORTANTE
**Origen:** Hallazgo Importante 2 de auditoría externa
**Aplica a:** Sesión 1, Fix 5

## Texto a agregar en Sesión 1, Fix 5, después del bloque de estado terminal

### NUEVO

```markdown
### Cadencia de reconciliación AFIP

**Worker:** `afip-reconciliation`

**Frecuencia de ejecución:** cada 5 minutos.

**Por cada `afip_invoice` en `requires_reconciliation`:**

```
1. Verificar attempts < 24
   Si attempts >= 24: 
     → Transición forzada a `reconciliation_timeout`
     → audit_log action='invoice.reconciliation_timeout'
     → Notificación al owner

2. Consultar AFIP:
   - Llamar FECompUltimoAutorizado para el (sale_point, invoice_type)
   - Si último número >= número reservado:
     → Llamar FECompConsultar(número reservado)
     → Si CAE existe: marcar como `invoice_issued`, save CAE
     → Si AFIP confirma rechazo: marcar como `number_burned`
   - Si último número < número reservado:
     → AFIP no procesó. Incrementar attempts.
     → Próximo intento en 5 minutos.

3. Incrementar attempts y next_attempt_at = now() + interval '5 minutes'

4. Logs estructurados con correlation_id para trace E2E
```

**Tope temporal duro:** 2 horas (= 24 intentos × 5 minutos).

**Tabla de cadencia:**

| Tiempo desde timeout inicial | Intentos completados | Estado |
|---|---|---|
| 5 min | 1 | Reintentando |
| 30 min | 6 | Reintentando |
| 1 h | 12 | Reintentando |
| 2 h | 24 | `reconciliation_timeout` (terminal) |

**Notificaciones intermedias:**

- 30 min sin resolver: email al owner "Tu factura sigue pendiente, seguimos intentando."
- 1 h sin resolver: email + dashboard banner.
- 2 h: transición terminal + email + alerta visible en POS.

**Métricas:**

- `afip_reconciliation_pending_count` (gauge): cuántas hay en `requires_reconciliation`.
- `afip_reconciliation_avg_attempts_to_success` (histogram): para casos resueltos.
- `afip_reconciliation_timeout_rate` (gauge): % que llegan a terminal.
- Alerta: `afip_reconciliation_pending_count > 10` por 30 min = warning.
- Alerta: `afip_reconciliation_timeout_rate > 5%` por 1 día = critical.
```

---

# CAMBIO #6 — Reversión force_closing → open

**Severidad:** IMPORTANTE
**Origen:** Hallazgo Importante 3 de auditoría externa
**Aplica a:** Sesión 2, SM-05 (parcialmente cubierto en Cambio #2)

## Estado

**Ya integrado en Cambio #2** como parte de la unificación de SM-05. Ver "Tabla de transiciones actualizada" con las transiciones nuevas:
- `force_closing → open` (admin_revert con motivo obligatorio)
- `force_closing → closing` (cashier_responds dentro de hora de gracia)

## Detalle adicional sobre permisos

```markdown
### Permisos para reversión de force_closing

| Rol | Puede revertir force_closing? |
|---|---|
| cashier | NO |
| admin | SÍ — con motivo obligatorio |
| owner | SÍ — con motivo obligatorio |
| support (Pandora) | SÍ — solo con ticket de soporte explícito |

### Auditoría de reversión

Todo `force_closing → open` genera:
- `audit_log` con action='cash_session.force_closing_reverted'
- Motivo obligatorio (texto libre, mínimo 10 caracteres)
- IP del admin que revirtió
- Notificación al owner si el reverter no es el owner: "Tu admin X revirtió el cierre forzado por motivo Y."

### Caso operativo típico

Cashier estaba en el baño cuando se disparó force_closing. Vuelve, ve la notificación, le pide al admin que revierta. Admin entra, revierte con motivo "cashier estaba en break, regresa a operar normalmente". Cashier completa cierre manual normal cuando termina su turno real.
```

---

# CAMBIO #7 — Política idempotency en borde de TTL

**Severidad:** IMPORTANTE
**Origen:** Hallazgo Importante 4 de auditoría externa
**Aplica a:** Sesión 2, Sección 13.11

## Texto a agregar en Sesión 2, después de la tabla de retención

### NUEVO

```markdown
### Política de lookup de idempotency en borde de TTL

**Retención hot:** 90 días en `idempotency_log` (consulta rápida con índice UNIQUE).

**Archivado:** después de 90 días, registros se mueven a `idempotency_log_archive_index` (cold storage S3 + índice metadata en DB con UUID + result resumido).

**Política de lookup en operaciones nuevas:**

```
function checkIdempotency(idempotencyKey, companyId, operation):
  1. Lookup en hot store (idempotency_log):
     SELECT * FROM idempotency_log
     WHERE company_id = $1 AND idempotency_key = $2
     
     Si encontrado:
       → Devolver result cacheado (idempotency replay)
       → Métrica: idempotency_replay_hot
  
  2. Si no encontrado en hot, lookup en archive index:
     SELECT * FROM idempotency_log_archive_index
     WHERE company_id = $1 AND idempotency_key = $2
     
     Si encontrado:
       → Fetch result completo desde S3 (latencia ~2-5s, aceptable porque es excepción)
       → Devolver result cacheado
       → Métrica: idempotency_replay_cold
  
  3. Si no encontrado en archive:
     → Proceder con operación nueva
     → Insertar nueva entrada en idempotency_log
```

**Cutoff operativo:**

- Keys con **menos de 6 meses**: respuesta idempotente garantizada.
- Keys con **6-12 meses**: respuesta idempotente best-effort (lookup en cold).
- Keys con **más de 12 meses**: NO garantía. Cliente debe regenerar idempotency_key 
  si pasó más de 6 meses sin completar la operación.

**Caso especial — sync offline tardío:**

Una operación offline guardada hace > 6 meses que llega a sincronizar:
1. Cliente offline almacena `idempotency_key` y `created_at`.
2. Al sincronizar, si `now() - created_at > 6 meses`: marcar como `expired_offline`.
3. UI pide al usuario decidir: descartar o crear como operación nueva (con nueva key).

### Archivado automático

**Cron:** `cron-idempotency-archive`, ejecutado mensualmente día 1, 02:00.

```
1. Identificar registros con created_at < now() - interval '90 days'
2. Para cada uno:
   - Subir contenido completo a S3 Glacier
   - Insertar fila en idempotency_log_archive_index con metadata + S3 URL
   - Borrar de idempotency_log
3. Mantener UNIQUE constraint en (company_id, idempotency_key) en ambas tablas
   para garantizar que no haya duplicados durante el archivado.
```
```

---

# CAMBIO #8 — Revalidación CUIT en hot path de facturación

**Severidad:** IMPORTANTE
**Origen:** Riesgo 2 de auditoría externa
**Aplica a:** Sesión 3, dominio Fiscal + ADR-0004

## Problema identificado

Hoy se valida CUIT contra Padrón A5 al crear cliente, con cache 7 días. Si durante esos 7 días el cliente queda inactivo o cambia condición IVA, se emite factura inválida.

## Texto a agregar en Sesión 3, dominio Fiscal

### Nueva subsección en Fiscal

```markdown
### Revalidación de CUIT en hot path de facturación

**Regla:** Antes de emitir factura, revalidar condición fiscal del cliente si 
la última validación tiene más de 24 horas.

**Flujo:**

```
1. SaleService dispara `fiscal.invoice_requested` con customer_id.

2. FiscalService.issueInvoice() obtiene customer:
   - Lookup en customers.padron_last_validated_at
   - Si > 24h desde última validación:
     → Llamar Padrón A5 sincrónicamente (timeout 3s)
     → Si responde:
        → Actualizar customer con datos frescos
        → Si cambió iva_condition o estado:
          → Bloquear emisión
          → Mostrar al cajero: "Datos fiscales del cliente cambiaron. Revisar antes de facturar."
        → Si datos OK:
          → Continuar con emisión usando snapshot fresh
     → Si Padrón timeout:
        → Decisión por política:
          → Opción A (recomendada): proceder con snapshot conocido + log warn
          → Opción B (estricta): bloquear emisión hasta validación
        → Default: Opción A con audit_log

3. Construir customer_snapshot con datos validados (campo source: 
   'padron_a5_fresh' o 'cache_within_24h')

4. Continuar flujo normal de facturación AFIP.
```

**Configuración por tenant:**

```sql
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS
  fiscal_padron_revalidation_required boolean NOT NULL DEFAULT true,
  fiscal_padron_revalidation_max_age_hours int NOT NULL DEFAULT 24,
  fiscal_padron_timeout_policy text NOT NULL DEFAULT 'proceed_with_cache'
    CHECK (fiscal_padron_timeout_policy IN ('proceed_with_cache', 'block_emission'));
```

**Métricas:**

- `padron_revalidation_count` (counter): cuántas revalidaciones se hacen.
- `padron_revalidation_changed_data_count` (counter): cuántas detectan cambios.
- `padron_revalidation_timeout_count` (counter): timeouts en revalidación.
- Alerta: `padron_revalidation_timeout_rate > 10%` = Padrón A5 con problemas.

**Impacto en latencia:**

- Caso normal (cache < 24h): 0 latencia adicional.
- Caso revalidación (cache > 24h): +1-3s en hot path de facturación.
- Aceptable porque facturación AFIP ya tiene timeout 30s.

### Actualización a ADR-0004

Agregar al ADR-0004 (AFIP sincrónico) en sección "Consecuencias":

> **Consecuencia adicional:** Antes de cada emisión, si la validación del 
> cliente contra Padrón A5 tiene más de 24h, se revalida sincrónicamente. 
> Esto agrega +1-3s al hot path en ese caso. Es trade-off aceptable porque 
> evita emitir facturas con condición fiscal obsoleta. Configurable por 
> tenant (puede deshabilitarse si genera fricción).
```

---

# CAMBIO #9 — Snapshot de condición fiscal del tenant en cash_session

**Severidad:** IMPORTANTE
**Origen:** Riesgo 3 de auditoría externa
**Aplica a:** Sesión 3, dominios Cash y Tenancy

## Problema identificado

Si el comerciante cambia su propia condición IVA (RI a Monotributo o viceversa) mientras hay turnos abiertos, las ventas del día tienen condición fiscal inconsistente.

## Cambio de schema requerido

```sql
ALTER TABLE cash_sessions ADD COLUMN tenant_fiscal_snapshot jsonb NOT NULL;

COMMENT ON COLUMN cash_sessions.tenant_fiscal_snapshot IS
  'Snapshot de condición fiscal del tenant al momento de abrir el turno.
   Incluye: iva_condition, cuit, fiscal_address, sale_point_id activo,
   captured_at. Inmutable durante el turno.';
```

## Texto a agregar en Sesión 3, dominio Cash

```markdown
### Snapshot fiscal del tenant al abrir turno

**Regla:** Al abrir cash_session, capturar snapshot fiscal del tenant. 
Todas las ventas del turno usan ese snapshot, no consultan el estado actual.

**Implementación:**

```typescript
// CashSessionService.open()
async open(input: OpenSessionInput) {
  return await db.transaction(async (tx) => {
    // 1. Validar caja libre
    // ...
    
    // 2. Capturar snapshot fiscal del tenant
    const company = await tx.query.companies.findFirst({
      where: eq(companies.id, input.companyId),
      with: { activeSalePoint: true }
    });
    
    const fiscalSnapshot = {
      iva_condition: company.iva_condition,
      cuit: company.cuit,
      fiscal_address: company.fiscal_address,
      sale_point_id: company.activeSalePoint.id,
      sale_point_number: company.activeSalePoint.number,
      captured_at: new Date().toISOString(),
    };
    
    // 3. Crear cash_session con snapshot
    const session = await tx.insert(cashSessions).values({
      // ...
      tenant_fiscal_snapshot: fiscalSnapshot,
    }).returning();
    
    return session;
  });
}
```

### Bloqueo de cambio de condición IVA con turnos abiertos

**Regla:** El owner no puede cambiar su propia condición IVA si hay turnos abiertos.

```typescript
// TenancyService.changeIvaCondition()
async changeIvaCondition(input: ChangeIvaInput) {
  // Verificar turnos abiertos
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
  
  // Proceder con cambio + audit_log con motivo obligatorio
  // ...
}
```

### UI: prevención al owner

Antes de permitir cambio de condición IVA:
1. Verificar turnos abiertos.
2. Si hay: mostrar modal con lista de turnos pendientes + botón "Cerrar cajas primero".
3. Si no hay: proceder con confirmación 2-step + motivo.

### Impacto en facturación durante el turno

- Ventas del turno usan `tenant_fiscal_snapshot.iva_condition` para determinar tipo de comprobante (A/B/C).
- Si el snapshot dice RI y la condición actual cambió a Monotributo (cosa que el bloqueo previene): el sistema mantiene el snapshot original durante todo el turno.
- Próximo turno: snapshot fresh con la nueva condición.
```

---

# CAMBIO #10 — Riesgo macro inflación

**Severidad:** MENOR (documentación)
**Origen:** Riesgo 1 de auditoría externa
**Aplica a:** Sesión 4 (Riesgos)

## Texto a agregar en sección Riesgos del SRS v3.0

```markdown
### R-25: Exposición macro a inflación y devaluación

**Categoría:** Riesgo de mercado / comercial
**Probabilidad:** Alta
**Impacto:** Medio-alto sobre la operación, no técnico

**Descripción:**

Argentina tiene historial de inflación mensual >5% y devaluaciones bruscas 
del peso. Comerciantes cargan precios en ARS y los cobran días/semanas 
después. Entre carga y cobro, el precio real (en USD o en poder adquisitivo) 
puede haber bajado significativamente.

**Manifestaciones operativas:**

1. **Precios cargados con delay:** un kiosquero carga su catálogo en domingo, 
   vende durante la semana con esos precios. Si el lunes hubo aumento 
   mayorista, vende perdiendo margen.

2. **Listas de precios sin auto-update:** los proveedores aumentan, el 
   comerciante no actualiza inmediatamente, vende al precio viejo.

3. **Cuentas corrientes en pesos:** un cliente que debe $50.000 desde hace 
   3 meses paga $50.000 nominales, pero en términos reales pagó la mitad. 
   El comerciante pierde por inflación.

4. **Pricing del SaaS Pandora:** los planes en ARS pierden valor real 
   trimestre a trimestre. Sin ajuste indexado, el ARR se erosiona.

**Mitigaciones operativas (no técnicas):**

- **En el roadmap de producto (Fase 1+):**
  - Listas de precios con factor de actualización masiva ("aumentar todos un 15%").
  - Cuentas corrientes con ajuste opcional por CER, IPC o tipo de cambio.
  - Sugerencia automática de revisión de precios cuando IPC INDEC mensual > 5%.

- **En el modelo comercial de Pandora:**
  - Ajuste trimestral obligatorio de planes por IPC INDEC (ya en CLAUDE.md).
  - Métricas internas en USD MRR equivalente, no solo ARS.
  - Comunicación transparente al comerciante: "Tu plan se ajusta el día X 
    según IPC del trimestre anterior."

**Decisión arquitectónica:**

NO se implementa ajuste automático de precios del comerciante en Fase 0-2. 
Es **decisión de producto del comerciante**, no del sistema. Pandora provee 
herramientas (actualización masiva, sugerencias) pero el comerciante decide.

Esto se documenta para:
- Recordar al equipo que la inflación es exposición permanente, no temporal.
- Justificar features comerciales relacionadas en el roadmap.
- Mantener metas internas en USD para no engañarse con cifras nominales en ARS.

**No requiere acción técnica inmediata.** Es awareness comercial.
```

---

# CIERRE DE SESIÓN 3.5

## Resumen de lo aplicado

**10 cambios procesados:**

1. ✅ audit_log con superficie cerrada + AuditService.log() único
2. ✅ Cierre forzado unificado (configurable + smart detection)
3. ✅ Customer snapshot inmutable en ventas y facturas
4. ✅ Retry serializable con backoff exponencial
5. ✅ Cadencia AFIP reconciliation (5 min × 24 = 2h)
6. ✅ Reversión force_closing con permisos (integrado en #2)
7. ✅ Política idempotency en borde de TTL
8. ✅ Revalidación CUIT en hot path de facturación
9. ✅ Snapshot fiscal del tenant en cash_session
10. ✅ Riesgo macro inflación documentado

## Cambios de schema acumulados

Sesión 3.5 introduce los siguientes cambios de schema (a aplicar en migrations):

```sql
-- Audit_log: cerrar superficie
REVOKE ALL ON audit_log FROM authenticated;
REVOKE UPDATE, DELETE, TRUNCATE ON audit_log FROM service_role;
GRANT INSERT ON audit_log TO service_role;
CREATE POLICY audit_log_read_owner ON audit_log FOR SELECT USING (...);
CREATE POLICY audit_log_read_auditor ON audit_log FOR SELECT USING (...);
CREATE POLICY audit_log_read_accountant ON audit_log FOR SELECT USING (...);

-- Sales y Invoices: snapshots inmutables
ALTER TABLE sales ADD COLUMN customer_snapshot jsonb;
ALTER TABLE afip_invoices ADD COLUMN customer_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb;

-- CashSession: snapshot fiscal del tenant
ALTER TABLE cash_sessions ADD COLUMN tenant_fiscal_snapshot jsonb NOT NULL;

-- Company settings: configuraciones nuevas
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS
  force_close_hour text NOT NULL DEFAULT '23:59',
  smart_detection_enabled boolean NOT NULL DEFAULT true,
  smart_detection_inactivity_threshold_hours int NOT NULL DEFAULT 2,
  cash_session_no_auto_close boolean NOT NULL DEFAULT false,
  cash_difference_tolerance_percent numeric(5,2) NOT NULL DEFAULT 1.00,
  fiscal_padron_revalidation_required boolean NOT NULL DEFAULT true,
  fiscal_padron_revalidation_max_age_hours int NOT NULL DEFAULT 24,
  fiscal_padron_timeout_policy text NOT NULL DEFAULT 'proceed_with_cache';

-- Idempotency: tabla de archive index
CREATE TABLE idempotency_log_archive_index (
  id bigserial PRIMARY KEY,
  company_id uuid NOT NULL,
  idempotency_key uuid NOT NULL,
  operation text NOT NULL,
  s3_url text NOT NULL,
  archived_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id, idempotency_key)
);
```

## ADRs nuevos derivados

Considerar agregar como ADR-0011: "Retry policy para fallos de serialización"
- Contexto: transacciones serializables en hot path.
- Decisión: retry con backoff exponencial corto, max 3 intentos.
- Alternativas: lock pesimista global (rechazado), isolation read committed (rechazado).
- Consecuencias: latencia adicional bajo contención, métricas observables.

## Validaciones humanas pendientes acumuladas

⚠️ Antes de producción real, validar con contador advisor:

1. Política de revalidación de CUIT en hot path (timeout 3s, fallback con cache).
2. Política de "venta sin factura definitiva" tras 2h de reconciliation_timeout.
3. Snapshot fiscal del cliente en factura: ¿qué campos son obligatorios para AFIP?
4. Política de cambio de condición IVA del comerciante: ¿requiere comunicación a AFIP?
5. Customer snapshot inmutable: ¿AFIP acepta facturación con datos snapshot vs datos actuales?

⚠️ Antes de producción real, validar con abogado:

1. Audit_log con cierre estricto: cumple Ley 11.683 sobre conservación de registros.
2. Archive index de idempotency: política de retención y derecho al olvido.
3. Customer snapshot inmutable: derecho del cliente a actualizar sus datos vs inmutabilidad histórica.

## Estado actual del SRS

| Sesión | Estado | Líneas | KB |
|---|---|---|---|
| Sesión 1 (fixes + UX Operacional) | ✅ Completa | 704 | 38 |
| Sesión 2 (Observabilidad + 9 máquinas) | ✅ Completa | 1320 | 51 |
| Sesión 3 (ambigüedades + ADRs + Dominios) | ✅ Completa | 1404 | 56 |
| **Sesión 3.5 (correcciones de auditoría)** | ✅ **Completa** | ~1000 | ~50 |
| Sesión 4 (integración SRS v3.0 final) | 🔜 Pendiente | est. 4000+ | est. 180+ |

## Próximo paso

**Sesión 4 — Integración SRS v3.0 final.**

Esta sesión toma:
- v2.0-OMN base
- Sesión 1 (fixes + UX Operacional)
- Sesión 2 (Observabilidad + máquinas)
- Sesión 3 (ambigüedades + ADRs + Dominios)
- **Sesión 3.5 (correcciones de auditoría) — INTEGRADAS**

Y produce:
1. `PANDORA_ERP_SRS_v3.0.md` — documento unificado navegable
2. `adr/ADR-0001.md` a `adr/ADR-0011.md` — ADRs como archivos separados
3. `README.md` — guía de lectura y validaciones pendientes

---

*Fin de SRS Sesión 3.5 — 17 mayo 2026*
