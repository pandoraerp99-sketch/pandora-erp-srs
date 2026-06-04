# PANDORA ERP — SRS Sesión 3.5.2
## Addendum: correcciones de segunda pasada de auditoría

**Fecha:** 17 mayo 2026
**Base:** Sesión 3.5 + segunda pasada de auditoría externa
**Estado:** Aprobado para integración en SRS v3.0 (Sesión 4)
**Origen:** Auditor externo detectó 4 detalles refinados después de aplicada 3.5

---

## Contexto

Después de aplicada Sesión 3.5, el auditor externo hizo segunda pasada de validación. Confirmó que los 4 hallazgos bloqueantes originales fueron correctamente resueltos, pero detectó 4 detalles refinados que conviene cerrar antes de Sesión 4.

Los 4 son técnicamente menores en alcance pero importantes en consecuencias:

1. Policy RLS de contador con sintaxis frágil de Postgres
2. `sales.customer_snapshot` queda nullable (invariante solo en app)
3. `cash_sessions.tenant_fiscal_snapshot` con migración insegura
4. `AuditService.log()` no garantiza atomicidad con operación de negocio

---

## CORRECCIÓN 3.5.2-A — Policy RLS de contador

**Severidad:** Importante
**Ubicación:** Sesión 3.5, Cambio #1, policy `audit_log_read_accountant`

### Problema

```sql
USING (
  (auth.jwt() ->> 'rol') = 'accountant'
  AND company_id::text = ANY(
    SELECT jsonb_array_elements_text(auth.jwt() -> 'authorized_companies')
  )
)
```

`ANY(SELECT ...)` con función set-returning como subconsulta es legal en Postgres pero ambiguo. El plan del optimizador puede variar entre versiones de Postgres. Hay formulaciones más claras y predecibles.

Adicionalmente, el alias `company_id` en la subconsulta colisiona con la columna `company_id` de la tabla `audit_log`, generando ambigüedad de scope.

### Corrección

```sql
USING (
  (auth.jwt() ->> 'rol') = 'accountant'
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements_text(auth.jwt() -> 'authorized_companies') AS ac(company_id_text)
    WHERE ac.company_id_text = company_id::text
  )
)
```

**Cambios aplicados:**

1. Reemplazado `ANY(SELECT ...)` por `EXISTS (...)`: semántica más clara, plan más predecible.
2. Renombrado alias a `company_id_text`: evita colisión con la columna `company_id` de la tabla.
3. Comparación explícita `ac.company_id_text = company_id::text`: sin ambigüedad de scope.

### Aplica también a

Mismo patrón debe corregirse en las otras políticas RLS para contador que aparecen en el SRS:

```sql
-- En sales (y todas las tablas de negocio con acceso de contador)
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

**Aplicar mismo patrón a:** `sales`, `sale_items`, `sale_payments`, `afip_invoices`, `cash_sessions`, `cash_movements`, `stock_movements`, `customers`, `products`, `audit_log`.

---

## CORRECCIÓN 3.5.2-B — sales.customer_snapshot NOT NULL

**Severidad:** Importante
**Ubicación:** Sesión 3.5, Cambio #3, schema de `sales`

### Problema

La migración original deja la columna nullable:

```sql
ALTER TABLE sales ADD COLUMN customer_snapshot jsonb;
```

Esto significa que el invariant "toda venta tiene snapshot inmutable" depende de que el Application Service nunca falle. Un bug, un INSERT desde otro path, o un script de mantenimiento mal escrito pueden generar filas con `customer_snapshot IS NULL`.

**Principio violado:** invariantes críticas de datos se enforced en DB, no en aplicación.

### Corrección con migración segura en 3 pasos

```sql
-- ═══════════════════════════════════════════════════════════════
-- Migration: sales.customer_snapshot NOT NULL
-- Estrategia: agregar nullable → backfill → SET NOT NULL
-- ═══════════════════════════════════════════════════════════════

BEGIN;

-- Paso 1: agregar columna nullable
ALTER TABLE sales ADD COLUMN customer_snapshot jsonb;

-- Paso 2A: backfill para ventas con customer_id
UPDATE sales s
SET customer_snapshot = jsonb_build_object(
  'name', COALESCE(c.name, 'Consumidor Final'),
  'document_type', c.document_type,
  'document_number', c.document_number,
  'iva_condition', COALESCE(c.iva_condition, 'consumidor_final'),
  'fiscal_address', c.fiscal_address,
  'phone', c.phone,
  'email', c.email,
  'captured_at', s.created_at,
  'source', 'backfill_migration'
)
FROM customers c
WHERE s.customer_id = c.id
AND s.customer_snapshot IS NULL;

-- Paso 2B: backfill para ventas sin customer (consumidor final default)
UPDATE sales s
SET customer_snapshot = jsonb_build_object(
  'name', 'Consumidor Final',
  'document_type', 'CONSUMIDOR_FINAL',
  'document_number', NULL,
  'iva_condition', 'consumidor_final',
  'fiscal_address', NULL,
  'phone', NULL,
  'email', NULL,
  'captured_at', s.created_at,
  'source', 'backfill_migration_default'
)
WHERE s.customer_snapshot IS NULL;

-- Paso 3: verificación obligatoria pre-constraint
DO $$
DECLARE
  null_count int;
BEGIN
  SELECT COUNT(*) INTO null_count FROM sales WHERE customer_snapshot IS NULL;
  IF null_count > 0 THEN
    RAISE EXCEPTION 'Backfill incompleto: % filas en sales con customer_snapshot NULL. ROLLBACK.', null_count;
  END IF;
  RAISE NOTICE 'Backfill OK: 0 filas con customer_snapshot NULL en sales.';
END $$;

-- Paso 4: agregar constraint NOT NULL
ALTER TABLE sales ALTER COLUMN customer_snapshot SET NOT NULL;

-- Paso 5: agregar constraint adicional sobre estructura mínima del JSON
ALTER TABLE sales ADD CONSTRAINT customer_snapshot_structure_valid
  CHECK (
    customer_snapshot ? 'name'
    AND customer_snapshot ? 'iva_condition'
    AND customer_snapshot ? 'captured_at'
  );

COMMIT;
```

### Aplica también a

`afip_invoices.customer_snapshot` ya estaba con `NOT NULL DEFAULT '{}'::jsonb` en la versión original de Sesión 3.5, pero el `DEFAULT '{}'::jsonb` es problemático porque permite snapshot vacío. **Corrección adicional:**

```sql
-- Migrar afip_invoices.customer_snapshot a constraint estricto
ALTER TABLE afip_invoices ALTER COLUMN customer_snapshot DROP DEFAULT;
ALTER TABLE afip_invoices ADD CONSTRAINT invoice_customer_snapshot_not_empty
  CHECK (
    customer_snapshot != '{}'::jsonb
    AND customer_snapshot ? 'legal_name'
    AND customer_snapshot ? 'iva_condition'
    AND customer_snapshot ? 'captured_at'
  );
```

---

## CORRECCIÓN 3.5.2-C — cash_sessions migración segura

**Severidad:** Importante
**Ubicación:** Sesión 3.5, Cambio #9, schema de `cash_sessions`

### Problema

La migración original era:

```sql
ALTER TABLE cash_sessions ADD COLUMN tenant_fiscal_snapshot jsonb NOT NULL;
```

`ADD COLUMN ... NOT NULL` sin `DEFAULT` falla en cualquier tabla con filas existentes. PostgreSQL no puede aplicar NOT NULL a filas que ya existen sin un valor concreto.

**Por qué importa aunque Fase 0 arranque con tabla vacía:**

1. Migraciones se ejecutan en orden. Si en producción real se agregan filas antes de esta migración (caso multi-environment con timing distinto), la migración falla.
2. Si Pandora migra clientes desde sistemas legacy con backfill de cash_sessions históricos, hay filas pre-existentes.
3. Es el patrón correcto que debe quedar documentado en el SRS, regardless de si Fase 0 está vacía hoy.

### Corrección con migración segura

```sql
-- ═══════════════════════════════════════════════════════════════
-- Migration: cash_sessions.tenant_fiscal_snapshot NOT NULL
-- ═══════════════════════════════════════════════════════════════

BEGIN;

-- Paso 1: agregar columna nullable
ALTER TABLE cash_sessions ADD COLUMN tenant_fiscal_snapshot jsonb;

-- Paso 2: backfill desde companies + sale_points
UPDATE cash_sessions cs
SET tenant_fiscal_snapshot = jsonb_build_object(
  'iva_condition', co.iva_condition,
  'cuit', co.cuit,
  'fiscal_address', co.fiscal_address,
  'sale_point_id', cs.sale_point_id,
  'sale_point_number', COALESCE(sp.number, 0),
  'captured_at', cs.opened_at,
  'source', 'backfill_migration'
)
FROM companies co
LEFT JOIN sale_points sp ON sp.id = cs.sale_point_id
WHERE cs.company_id = co.id
AND cs.tenant_fiscal_snapshot IS NULL;

-- Paso 3: verificación
DO $$
DECLARE
  null_count int;
BEGIN
  SELECT COUNT(*) INTO null_count FROM cash_sessions WHERE tenant_fiscal_snapshot IS NULL;
  IF null_count > 0 THEN
    RAISE EXCEPTION 'Backfill incompleto: % cash_sessions con snapshot NULL. ROLLBACK.', null_count;
  END IF;
  RAISE NOTICE 'Backfill OK: 0 cash_sessions con snapshot NULL.';
END $$;

-- Paso 4: NOT NULL
ALTER TABLE cash_sessions ALTER COLUMN tenant_fiscal_snapshot SET NOT NULL;

-- Paso 5: constraint estructural
ALTER TABLE cash_sessions ADD CONSTRAINT tenant_fiscal_snapshot_structure_valid
  CHECK (
    tenant_fiscal_snapshot ? 'iva_condition'
    AND tenant_fiscal_snapshot ? 'cuit'
    AND tenant_fiscal_snapshot ? 'captured_at'
  );

COMMIT;
```

### Patrón canónico para todas las migraciones futuras

Documentar como regla operativa en el repositorio:

```markdown
## Regla de migraciones con NOT NULL

Toda migración que agrega columna NOT NULL a tabla con filas existentes 
DEBE seguir el patrón de 4 pasos:

1. ADD COLUMN como NULLABLE
2. UPDATE con backfill explícito (estrategia de default según el dominio)
3. DO $$ ... END $$ con verificación de 0 NULLs antes de continuar
4. ALTER COLUMN SET NOT NULL

Nunca: ADD COLUMN ... NOT NULL directo a tabla con filas.

Excepción: si la tabla está GARANTIZADO vacía en TODOS los environments 
(local, staging, producción), se puede usar ADD COLUMN ... NOT NULL directo. 
Pero esta excepción se documenta explícitamente en la migration con comment.
```

---

## CORRECCIÓN 3.5.2-D — AuditService.log() atomicidad con operación

**Severidad:** Bloqueante (arquitectónica)
**Ubicación:** Sesión 3.5, Cambio #1, interface de `AuditService.log()`

### Problema

La implementación original de Sesión 3.5 tenía el siguiente patrón:

```typescript
export class AuditService {
  constructor(
    private dbAdmin: SupabaseClient,  // service_role cliente global
    private currentContext: RequestContext
  ) {}

  async log(params: AuditLogParams): Promise<void> {
    // validaciones...
    await this.dbAdmin.from('audit_log').insert({...});
  }
}
```

**Problemas operativos:**

1. **AuditService usa cliente global, no la transacción en curso.** Si la operación de negocio está dentro de `db.transaction(...)` y AuditService.log() falla, la operación de negocio ya hizo commit parcial. Queda inconsistencia: operación realizada sin audit_log.

2. **Si AuditService.log() ejecuta DESPUÉS de la transacción de negocio:** queda peor. La transacción cierra OK, después audit_log falla, queda venta registrada sin audit. Pérdida total de trazabilidad.

3. **Si AuditService.log() ejecuta ANTES de la transacción de negocio:** queda audit_log de operación que después falló. Peor: audit_log dice que algo pasó cuando en realidad no pasó. Trazabilidad falsa.

**Ninguno de los tres escenarios es aceptable** para un sistema fiscal/contable.

### Corrección: AuditService recibe la transacción

```typescript
// src/lib/services/audit/audit.service.ts

import type { TransactionContext } from '@/lib/db/types';

interface AuditLogParams {
  tx: TransactionContext;  // ← OBLIGATORIO, no opcional
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
  metadata: AuditMetadata;
}

export class AuditService {
  constructor(
    private currentContext: RequestContext
  ) {
    // YA NO recibe cliente global. La tx llega en cada call.
  }

  async log(params: AuditLogParams): Promise<void> {
    // 1. Validar tenant
    if (params.companyId !== this.currentContext.companyId
        && params.userRole !== 'support') {
      throw new FatalAuditError('TENANT_MISMATCH_IN_AUDIT');
    }

    // 2. Validar user
    if (params.userId !== null
        && params.userId !== this.currentContext.userId
        && params.userRole !== 'support') {
      throw new FatalAuditError('USER_MISMATCH_IN_AUDIT');
    }

    // 3. Validar action whitelist
    if (!AUDITABLE_ACTIONS.includes(params.action)) {
      throw new FatalAuditError(`INVALID_ACTION: ${params.action}`);
    }

    // 4. Validar reason si action lo requiere
    if (REQUIRES_REASON.includes(params.action) && !params.reason) {
      throw new FatalAuditError(`REASON_REQUIRED: ${params.action}`);
    }

    // 5. Insertar EN LA MISMA TRANSACCIÓN que la operación de negocio
    await params.tx.insert(auditLog).values({
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

    // Si esto falla con error, el throw propaga hasta el bloque transaction()
    // que envuelve TODO. PostgreSQL rollback automático.
    // Garantía: nunca queda operación sin audit_log ni audit_log sin operación.
  }
}
```

### Uso obligatorio en Application Services

```typescript
// src/lib/services/sale/sale.service.ts

async create(input: CreateSaleInput) {
  return withSerializationRetry(
    'sale.create',
    () => this.executeCreateSaleTransaction(input),
    { correlationId: input.correlationId, companyId: input.companyId }
  );
}

private async executeCreateSaleTransaction(input: CreateSaleInput) {
  return await db.transaction(async (tx) => {
    // 1. Idempotency check
    // 2. Validación tenant
    // 3. Validación shift abierto
    // 4. Lock stock, calcular IVA por línea, insertar sale_items
    // 5. Insertar sale
    
    const sale = await tx.insert(sales).values({
      // ... 
      customer_snapshot: customerSnapshot,
    }).returning();

    // 6. Insertar payments y cash_movements
    
    // 7. Si invoice requested: llamar FiscalService DENTRO de la misma tx
    
    // 8. AUDIT DENTRO de la misma transacción
    await this.auditService.log({
      tx,  // ← clave: misma tx
      companyId: input.companyId,
      userId: input.userId,
      userRole: input.userRole,
      action: 'sale.created',
      entity: 'sale',
      entityId: sale[0].id,
      changes: { before: null, after: sale[0] },
      metadata: {
        correlationId: input.correlationId,
        ip: input.ip,
        terminalId: input.terminalId,
        branchId: input.branchId,
        channel: input.channel,
      },
    });
    
    // 9. Idempotency log
    
    return sale[0];
  }, { isolationLevel: 'serializable' });
}
```

### Regla absoluta

```markdown
**REGLA OPERATIVA — Audit log atomicity:**

Toda operación que muta datos críticos (sales, stock, payments, invoices, 
customers, cash_sessions, subscriptions, certificates) ejecuta el audit log 
DENTRO de la misma transacción Drizzle que la operación de negocio.

Patrón obligatorio:

  return await db.transaction(async (tx) => {
    // operaciones de negocio sobre tx
    // ...
    
    // audit dentro de la misma tx
    await auditService.log({ tx, ... });
    
    return result;
  });

Si auditService.log() falla:
- throw propaga hasta el bloque transaction()
- PostgreSQL hace ROLLBACK automático
- TODA la operación se revierte: negocio + audit
- Estado: como si nunca hubiera pasado nada

Garantías:
- Nunca operación sin audit_log
- Nunca audit_log sin operación
- Trazabilidad fiscal/contable 100% confiable
```

### Excepción única (logs informativos no críticos)

Logs informativos no críticos pueden ir fuera de transacción sin riesgo:

- `login.successful` → audit async sin transacción
- `login.failed` → audit async sin transacción  
- `query.cache_hit` → solo logger, no audit
- `session.heartbeat` → solo logger, no audit

Estos NO son operaciones de negocio mutativas. Si fallan al auditar, el sistema sigue funcionando. La pérdida de logs informativos no genera inconsistencia fiscal/contable.

**Toda otra operación: audit DENTRO de la transacción. Sin excepciones.**

---

## Schema completo consolidado (3.5 + 3.5.2)

Para referencia, el schema completo con todos los cambios aplicados:

```sql
-- ═══════════════════════════════════════════════════════════════
-- Audit log: write-only server-side + RLS para read
-- ═══════════════════════════════════════════════════════════════

REVOKE ALL ON audit_log FROM authenticated;
REVOKE UPDATE, DELETE, TRUNCATE ON audit_log FROM service_role;
GRANT INSERT ON audit_log TO service_role;

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

CREATE POLICY audit_log_read_accountant ON audit_log
  FOR SELECT
  USING (
    (auth.jwt() ->> 'rol') = 'accountant'
    AND EXISTS (
      SELECT 1
      FROM jsonb_array_elements_text(auth.jwt() -> 'authorized_companies') AS ac(company_id_text)
      WHERE ac.company_id_text = company_id::text
    )
  );

-- ═══════════════════════════════════════════════════════════════
-- Sales: customer_snapshot NOT NULL + constraint estructural
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE sales ADD COLUMN customer_snapshot jsonb;
-- ... backfill ...
ALTER TABLE sales ALTER COLUMN customer_snapshot SET NOT NULL;
ALTER TABLE sales ADD CONSTRAINT customer_snapshot_structure_valid
  CHECK (
    customer_snapshot ? 'name'
    AND customer_snapshot ? 'iva_condition'
    AND customer_snapshot ? 'captured_at'
  );

-- ═══════════════════════════════════════════════════════════════
-- Afip_invoices: customer_snapshot estricto
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE afip_invoices ALTER COLUMN customer_snapshot DROP DEFAULT;
ALTER TABLE afip_invoices ADD CONSTRAINT invoice_customer_snapshot_not_empty
  CHECK (
    customer_snapshot != '{}'::jsonb
    AND customer_snapshot ? 'legal_name'
    AND customer_snapshot ? 'iva_condition'
    AND customer_snapshot ? 'captured_at'
  );

-- ═══════════════════════════════════════════════════════════════
-- Cash_sessions: tenant_fiscal_snapshot NOT NULL
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE cash_sessions ADD COLUMN tenant_fiscal_snapshot jsonb;
-- ... backfill ...
ALTER TABLE cash_sessions ALTER COLUMN tenant_fiscal_snapshot SET NOT NULL;
ALTER TABLE cash_sessions ADD CONSTRAINT tenant_fiscal_snapshot_structure_valid
  CHECK (
    tenant_fiscal_snapshot ? 'iva_condition'
    AND tenant_fiscal_snapshot ? 'cuit'
    AND tenant_fiscal_snapshot ? 'captured_at'
  );

-- ═══════════════════════════════════════════════════════════════
-- Aplicar patrón EXISTS a todas las RLS de contador
-- ═══════════════════════════════════════════════════════════════

-- Mismo patrón para: sales, sale_items, sale_payments, afip_invoices,
-- cash_sessions, cash_movements, stock_movements, customers, products
-- (ver sección correspondiente para cada tabla)
```

---

# CIERRE DE SESIÓN 3.5.2

## Resumen de lo aplicado

4 correcciones refinadas, todas aceptadas del auditor:

1. ✅ **Policy RLS con EXISTS:** sintaxis robusta sin ambigüedades de scope
2. ✅ **sales.customer_snapshot NOT NULL:** invariant enforced en DB
3. ✅ **cash_sessions migración segura:** patrón de 4 pasos documentado
4. ✅ **AuditService atomicidad:** audit DENTRO de la transacción de negocio

## Cambios arquitectónicos derivados

1. **Nuevo principio operativo:** "Audit dentro de transacción" como regla absoluta.
2. **Nuevo principio operativo:** "Invariantes críticas enforced en DB, no en aplicación".
3. **Nuevo principio operativo:** "Migraciones NOT NULL con backfill verificado en 4 pasos".

Estos tres principios deberían ser documentados en el SRS v3.0 como reglas no negociables de implementación.

## Validaciones acumuladas (no nuevas)

Las validaciones pendientes de Sesión 3.5 siguen vigentes. Esta 3.5.2 no agrega ni quita validaciones humanas necesarias.

## Estado del SRS

| Sesión | Estado | Líneas | KB |
|---|---|---|---|
| Sesión 1 (fixes + UX Operacional) | ✅ Completa | 704 | 38 |
| Sesión 2 (Observabilidad + 9 máquinas) | ✅ Completa | 1320 | 51 |
| Sesión 3 (ambigüedades + ADRs + Dominios) | ✅ Completa | 1404 | 56 |
| Sesión 3.5 (correcciones bloqueantes) | ✅ Completa | 1283 | 45 |
| **Sesión 3.5.2 (refinements segunda pasada)** | ✅ **Completa** | ~600 | ~30 |
| Sesión 4 (integración SRS v3.0 final) | 🔜 Pendiente | est. 4000+ | est. 200+ |

## Próximo paso

**Sesión 4 — Integración SRS v3.0 final**, ahora con:
- v2.0-OMN base
- Sesión 1 (fixes + UX Operacional)
- Sesión 2 (Observabilidad + máquinas)
- Sesión 3 (ambigüedades + ADRs + Dominios)
- Sesión 3.5 (correcciones de auditoría)
- **Sesión 3.5.2 (refinements de segunda pasada)** ← agregado

---

*Fin de SRS Sesión 3.5.2 — 17 mayo 2026*
