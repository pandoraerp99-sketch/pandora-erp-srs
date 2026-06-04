# Cross-Tenant Leak — Runbook

**Severidad:** S0 (catástrofe absoluta)
**Detección:** automática vía test cross-tenant CI falla / manual vía reporte cliente / audit anomaly
**SLA target F0:** detección < 5 min · stop < 30 min · resolución < 24h · notificación legal según B-3/B-4 abogado

> ⚠️ ESTE ES EL PEOR ESCENARIO POSIBLE EN PANDORA. Datos de tenant A vistos por tenant B = violación grave Ley 25.326 + pérdida total de confianza + potencial denuncia AAIP + responsabilidad civil. **Seguir este runbook al pie de la letra.**

---

## Síntomas

- Test cross-tenant en CI rojo → revisar inmediato antes de merge
- Cliente reporta "vi datos que no son míos"
- Audit log con `cross_tenant_access_attempt` con `resolved=true` (NO bloqueado)
- Query manual confirma datos de tenant A en respuesta de tenant B

## Detección automática

```sql
-- Trigger S0
SELECT count(*) FROM audit_log
WHERE event_name = 'system.cross_tenant_attempt_blocked'
  AND payload->>'blocked' = 'false'
  AND created_at > now() - interval '24 hours';
-- > 0 → S0 confirmado
```

Tests CI:

```typescript
// tests/cross-tenant/sales.test.ts
test('T-MT-01: cross-tenant SELECT bloqueado por RLS', async () => {
  const tenantA = await createTestTenant();
  const tenantB = await createTestTenant();
  const saleA = await SaleService.createDraft(tenantA, userA);

  // Como tenantB, intentar acceder a saleA
  await loginAs(userB, tenantB);
  await expect(SaleQuery.findById(saleA.id))
    .rejects.toThrow(CrossTenantAccessError);
});
```

Si CI falla → **NO mergear** + investigar antes que nada.

## Pasos de mitigación inmediata (< 30 min)

### 1. STOP de operaciones del tenant afectado

**Inmediato:**

```sql
-- Marcar tenant víctima en feature flag de emergencia
INSERT INTO feature_flags (tenant_id, flag_key, enabled, payload)
VALUES (
  '{tenant_b_uuid}',
  'emergency_stop',
  true,
  '{"reason": "cross_tenant_leak_investigation", "started_at": "...", "runbook": "cross-tenant-leak.md"}'
);
```

App debe respetar `emergency_stop` y bloquear TODA mutation del tenant. UX: "Tu cuenta está temporalmente en mantenimiento. Pandora team te contactará en breve."

### 2. STOP de operaciones del tenant que filtró (origen)

Si tenant A es quien filtró datos vistos por B, también pausar A para investigación.

```sql
INSERT INTO feature_flags (tenant_id, flag_key, enabled, payload)
VALUES (
  '{tenant_a_uuid}',
  'emergency_stop',
  true,
  '{"reason": "cross_tenant_leak_investigation_source", ...}'
);
```

### 3. Invalidar sesiones activas de ambos tenants

```sql
-- Forzar logout de todos los usuarios de ambos tenants
UPDATE active_sessions
SET revoked_at = now(), revoke_reason = 'cross_tenant_investigation'
WHERE tenant_id IN ('{tenant_a_uuid}', '{tenant_b_uuid}')
  AND revoked_at IS NULL;
```

Comerciantes recibirán logout automático al próximo refresh.

### 4. Snapshot de estado (preservar evidencia)

```sql
-- Snapshot de audit_log relevante
COPY (
  SELECT * FROM audit_log
  WHERE tenant_id IN ('{tenant_a_uuid}', '{tenant_b_uuid}')
    AND created_at > now() - interval '7 days'
  ORDER BY created_at
) TO '/tmp/incident-{fecha}-audit.csv' WITH CSV HEADER;
```

```sql
-- Snapshot de queries recientes (si hay log de queries)
COPY (
  SELECT * FROM query_log
  WHERE tenant_id IN (...)
    AND created_at > now() - interval '7 days'
) TO '/tmp/incident-{fecha}-queries.csv';
```

Backup completo del estado actual antes de cualquier modificación:

```bash
# Snapshot Supabase punto-en-tiempo
# Vía consola Supabase: trigger backup manual
```

### 5. Audit log entry inmediato

```sql
INSERT INTO audit_log (event_name, payload, severity, actor_type, tenant_id, ...)
VALUES (
  'security.cross_tenant_leak_detected',
  '{
    "victim_tenant_id": "{tenant_b_uuid}",
    "source_tenant_id": "{tenant_a_uuid}",
    "detection_method": "ci_test_failed | client_report | audit_anomaly",
    "data_types_exposed": ["sales", "customers", ...],
    "estimated_records_exposed": N,
    "discovered_at": "...",
    "runbook": "cross-tenant-leak.md"
  }',
  'critical',
  'operator',
  '00000000-0000-0000-0000-000000000000',  -- SYSTEM_TENANT_ID
  ...
);
```

## Pasos de investigación (< 4h)

### 1. Identificar vector exacto del leak

- ¿RLS policy rota? → query `pg_policies` + revisar policy de tabla afectada
- ¿Service validation faltante? → revisar Service que devolvió datos
- ¿Cache leak? → revisar caché client-side / Redis (F1+)
- ¿Logging accidental? → revisar Pino logs (no debería tener datos cross-tenant)
- ¿Backup mal scoped? → revisar export tools

### 2. Bug en RLS — diagnóstico

```sql
-- Listar policies activas sobre tabla
SELECT * FROM pg_policies WHERE tablename = 'sales';

-- Test directo de RLS como tenant_b
SET request.jwt.claims = '{"company_id": "{tenant_b_uuid}", "sub": "user_b"}';
SELECT * FROM sales WHERE id = '{sale_a_id}';
-- Si devuelve filas → RLS está rota
```

### 3. Bug en Service validation — diagnóstico

```typescript
// Revisar Service que devolvió datos
async findSale(saleId) {
  const sale = await db.select().from(sales).where(eq(sales.id, saleId)); // ← faltó tenant filter?
  // Debería ser:
  const tenantId = getCurrentTenantId();
  const sale = await db.select().from(sales)
    .where(and(eq(sales.id, saleId), eq(sales.tenant_id, tenantId)));
  return sale;
}
```

### 4. Bug en cache client-side — diagnóstico

```typescript
// ¿Cliente cachea por session sin tenant scope?
const cacheKey = `sale-${saleId}`; // ← MAL, faltó tenant
// Debería ser:
const cacheKey = `tenant-${tenantId}-sale-${saleId}`;
```

### 5. Cuantificar exposure

- ¿Qué datos exactamente vio tenant B?
- ¿Cuántos registros?
- ¿Cuánto tiempo?
- ¿Solo lectura o también pudo modificar?
- ¿Datos con PII (CUIT cliente, domicilio)?

Doc evidencia en `docs/incidents/{fecha}-cross-tenant-leak/`.

## Resolución técnica

### 1. Fix del bug

- Patch al RLS / Service / cache.
- Test cross-tenant que reproduzca el bug **antes** del fix → garantizar test queda.
- Code review obligatorio.
- Deploy a homologación + verificar.
- Deploy a prod.

### 2. Test exhaustivo

Ejecutar TODOS los tests T-MT-01 a T-MT-07. Agregar nuevos tests para escenario específico.

### 3. Audit log entry de fix

```sql
INSERT INTO audit_log (event_name, payload, severity, ...)
VALUES (
  'security.cross_tenant_leak_fixed',
  '{
    "victim_tenant_id": "...",
    "source_tenant_id": "...",
    "root_cause": "rls_policy_missing_on_sales | service_skipped_tenant_filter | ...",
    "fix_commit": "...",
    "fix_deployed_at": "...",
    "regression_test_added": "T-MT-08-..."
  }',
  'critical',
  ...
);
```

### 4. Reactivar tenants

```sql
UPDATE feature_flags
SET enabled = false, payload = jsonb_set(payload, '{resolved_at}', now()::text::jsonb)
WHERE flag_key = 'emergency_stop'
  AND tenant_id IN ('{tenant_a}', '{tenant_b}');
```

## Notificación legal y al cliente

### 1. Notificación al cliente afectado (tenant B — víctima)

Plazo: ASAP, antes de 24h.

Template:

```
Estimado/a {nombre_comercio},

Te escribimos para informarte un incidente de seguridad ocurrido el {fecha}.

QUÉ PASÓ:
Por un error en nuestro sistema, datos de tu cuenta pudieron haber sido
visibles para otro usuario de Pandora durante el período {hora_inicio} a {hora_fin}.

QUÉ DATOS ESTUVIERON EXPUESTOS:
- {listado específico}

QUÉ HICIMOS:
- Detectamos el incidente a las {hora_deteccion}
- Detuvimos el acceso inmediatamente
- Identificamos y corregimos la causa
- Notificamos a la autoridad correspondiente (AAIP)
- Estamos disponibles para tus consultas

QUÉ PODÉS HACER:
- Revisar tu cuenta por actividad inusual
- Cambiar tu contraseña como precaución (ya forzamos logout)
- Contactarnos a {soporte@pandora}

LAMENTAMOS PROFUNDAMENTE este incidente. Estamos comprometidos con la
seguridad de tus datos.

— Pandora team
Contacto legal: {abogado}
```

### 2. Notificación a tenant A (origen, si vió datos sin derecho)

```
Estimado/a {nombre_comercio},

Por un error en nuestro sistema, durante el período {...} podés haber
visto datos de OTRO usuario de Pandora.

QUÉ NECESITAMOS DE VOS:
- Si guardaste o copiaste algún dato que no era tuyo, te pedimos
  que los elimines completamente.
- Que confirmes por escrito que entendiste el alcance.

LEGAL:
Por Ley 25.326, no podés usar/distribuir esos datos. El incumplimiento
puede tener consecuencias legales graves.

— Pandora team
Contacto legal: {abogado}
```

### 3. Notificación a AAIP

Ver runbook [breach-notification.md](breach-notification.md).

Plazo: depende del cierre de pregunta B-3 abogado. **Conservador F0: 72h.**

## Post-mortem (obligatorio S0)

Doc completo en `docs/post-mortems/{fecha}-cross-tenant-leak.md`:

- Timeline minuto a minuto
- Causa raíz técnica detallada
- Causa raíz organizacional (¿por qué no detectamos antes? ¿qué del proceso de review falló?)
- Impacto cuantificado
- Acciones preventivas:
  - Tests cross-tenant adicionales
  - Code review reforzado en multi-tenant
  - Linter rules específicas (TBD)
  - Mejora de runbook

## Acciones preventivas a futuro

### Refuerzos técnicos

- **Linter rule** que falle si Service hace query sin `getCurrentTenantId()` validation
- **Test cross-tenant en cada PR** que toque tablas tenant-aware
- **Code review checklist** con item específico de multi-tenant
- **Linter rule** que prohíba cache keys sin tenant_id prefix
- **Audit log query** trimestral buscando access patterns anómalos

### Refuerzos organizacionales

- Onboarding nuevo dev incluye módulo dedicado de multi-tenant
- Documentación de [CLAUDE.md §7](../CLAUDE.md) leída en orientación inicial
- Drills trimestrales de este runbook

---

## Anti-patterns durante incidente

- ❌ NO mencionar AAIP/Ley 25.326 al cliente sin abogado validando wording
- ❌ NO publicar nada en redes sociales hasta tener storyline completo
- ❌ NO borrar audit_log (es evidencia)
- ❌ NO "arreglar rápido y ver después" — debe haber test que reproduce ANTES del fix
- ❌ NO subestimar (S0 es S0, no S1)
- ❌ NO continuar operación normal con bug confirmado sin fix
- ❌ NO esperar a tener storyline perfecto antes de comunicar — comunicar pronto + claro

---

## Cross-references

- [CLAUDE.md §7](../CLAUDE.md) — Multi-Tenant Constitution
- [CLAUDE.md §11.10](../CLAUDE.md) — Threat model F0
- [OPERATIONAL-SEVERITY.md](../OPERATIONAL-SEVERITY.md) — S0
- [breach-notification.md](breach-notification.md) — notificación AAIP
- [AUTHORITY-MAP.md](../AUTHORITY-MAP.md) — autoridad multi-tenant
- Pregunta B-4 advisor doc — responsabilidades cross-tenant leak (pendiente abogado)

---

*Runbook cross-tenant-leak.md v1.0 — 2026-05-28. NO improvisar.*
