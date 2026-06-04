# Dead Jobs Resolution — Runbook

**Severidad:** S2 (10+ dead jobs sin atender)
**Detección:** automática vía métrica `reconciliation.dead_jobs_waiting > 10` + query Q2
**SLA target F0:** detección < 30 min · resolución < 24h

> Dead jobs = jobs en `jobs_queue` con `status='dead'` por MAX_ATTEMPTS=24 agotado. Requieren operator manual según dead letter philosophy (RECONCILIATION-ENGINE §6). Status enum canónico EVENT-TAXONOMY §3: `pending / running / success / failed / dead`.

---

## Síntomas

- Métrica `reconciliation.dead_jobs_waiting` superior a umbral
- Q2 (RECONCILIATION-ENGINE §11) devuelve jobs > 24h en estado `dead`
- Tenant reporta facturas que "nunca llegaron"

## Detección

```sql
-- Q2 - Dead jobs query (RECONCILIATION-ENGINE §11)
SELECT id, tenant_id, job_type, correlation_id, attempts, last_error, created_at, updated_at
FROM jobs_queue
WHERE status = 'dead'
  AND updated_at < now() - interval '24 hours'
ORDER BY updated_at;
```

## Pasos de mitigación inmediata

### 1. Triage rápido por tipo de job

```sql
SELECT job_type, count(*), array_agg(distinct tenant_id) as affected_tenants
FROM jobs_queue
WHERE status = 'dead'
GROUP BY job_type
ORDER BY count(*) DESC;
```

| job_type | Acción típica |
|---|---|
| `afip.emit_invoice` | Investigar si AFIP rechazó (failed) o si quedó pending. Ver RECONCILIATION-ENGINE §4. |
| `afip.reconcile_pending` | Similar — recovery posiblemente falló por mismatch. |
| `email.send_invoice` | Email rebotó o config provider falló. |
| `mp.reconcile_webhook` | Webhook MP fuera de orden o duplicado mal manejado. |

### 2. Por cada job — clasificar

Para cada job en estado `dead`:

```sql
SELECT id, payload, last_error, last_request_id, correlation_id
FROM jobs_queue
WHERE id = '{job_id}';
```

Investigar:

- ¿`last_error` indica problema técnico recoverable? → re-enqueue
- ¿`last_error` indica problema de datos (CUIT inválido, monto cero)? → contactar tenant, NO re-enqueue
- ¿AFIP `failed` permanente? → NO retry, escalar a operador manual de Pandora team
- ¿Poison job (payload corrupto)? → discard con audit (NO re-enqueue, se confunde con poison normal)

## Investigación por job_type

### `afip.emit_invoice` dead

```sql
-- Buscar sale relacionada
SELECT s.id, s.fiscal_status, s.tenant_id, s.correlation_id, s.created_at
FROM sales s
WHERE s.id = (jobs_queue.payload->>'sale_id')::uuid;

-- Buscar invoice si existe
SELECT i.id, i.invoice_number, i.cae, i.fiscal_status
FROM invoices i
WHERE i.sale_id = '{sale_id}';

-- Buscar audit
SELECT * FROM audit_log
WHERE correlation_id = '{correlation_id}'
ORDER BY created_at;
```

Posibles escenarios:

| Escenario | Acción |
|---|---|
| Sale en `pending_reconciliation` + sin invoice + último error timeout | Verificar AFIP. Si OK, intentar recovery manual con `FECompUltimoAutorizado`. |
| Sale en `manual_resolution_required` + invoice con CAE válido | Bug — el flow no terminó. Marcar sale como `reconciled_issued` manualmente con audit. |
| Sale + invoice ambos en estado inconsistente | Escalada S1 — investigar profundo. |
| AFIP devolvió `failed` permanente | No retry. Marcar `rejected_final` + comunicar tenant + NC para corregir. |

### `email.send_invoice` dead

```sql
-- Verificar invoice + email
SELECT i.id, i.cae, c.email
FROM invoices i
JOIN customers c ON c.id = i.customer_id
WHERE i.id = (jobs_queue.payload->>'invoice_id')::uuid;
```

- Si email inválido / vacío → no retry, contactar tenant para corregir.
- Si provider falló (Resend caído) → re-enqueue cuando provider esté OK.
- Si email rebotó (bounce) → no retry, marcar customer con flag de email inválido.

### `mp.reconcile_webhook` dead

```sql
-- Verificar webhook event
SELECT * FROM processed_webhook_events
WHERE event_id = jobs_queue.payload->>'mp_event_id';
```

- Si ya procesado → discard (era duplicado).
- Si no procesado pero estado inconsistente → investigación manual + contactar MP soporte si necesario.

## Acciones manuales

### Re-enqueue de un job

```sql
UPDATE jobs_queue
SET status = 'pending',
    next_retry_at = now(),
    attempts = 0,  -- reset attempts
    last_error = null,
    updated_at = now()
WHERE id = '{job_id}';

-- Evento canónico EVENT-TAXONOMY §5 + severity 'warning'.
INSERT INTO audit_log (event_name, payload, severity, actor_type, ...)
VALUES (
  'system.dead_job.re_enqueued',
  '{
    "job_id": "...",
    "job_type": "...",
    "reason": "{texto explicativo}",
    "operator": "{nombre}",
    "runbook": "dead-jobs-resolution.md"
  }',
  'warning',
  'operator',
  ...
);
```

### Discard de un job

```sql
-- Discard NO usa status nuevo. Se mantiene status='dead' + audit con event canónico.
-- Nota: dead_job.discarded NO transiciona status — el job sigue 'dead' pero el audit
-- documenta la decisión del operator de no re-enqueue.
INSERT INTO audit_log (event_name, payload, severity, actor_type, ...)
VALUES (
  'system.dead_job.discarded',
  '{
    "job_id": "...",
    "job_type": "...",
    "reason": "{texto explicativo OBLIGATORIO — ej: venta cancelada}",
    "operator": "{nombre}",
    "runbook": "dead-jobs-resolution.md"
  }',
  'warning',
  'operator',
  ...
);
```

### Resolución manual (operator resuelve entidad de negocio directamente)

Para cuando el operator resuelve fuera del worker (ej: marcar venta como `reconciled_issued` porque verificó manualmente con AFIP):

```sql
-- 1. Actualizar entidad de negocio (autoritativa)
UPDATE sales
SET fiscal_status = 'reconciled_issued',
    cae = '{cae_value}',
    manual_resolution_at = now(),
    manual_resolution_by = '{operator_id}',
    manual_resolution_note = '{texto}'
WHERE id = '{sale_id}';

-- 2. Marcar job como 'success' con nota
UPDATE jobs_queue
SET status = 'success', updated_at = now(),
    completion_note = 'manual_resolution_by_operator'
WHERE id = '{job_id}';

-- 3. Audit con evento canónico EVENT-TAXONOMY §5 + severity 'warning'.
INSERT INTO audit_log (event_name, payload, severity, actor_type, ...) VALUES (
  'system.dead_job.resolved_manually',
  '{ "job_id": "...", "sale_id": "...", "resolution_summary": "{texto}", "runbook": "dead-jobs-resolution.md" }',
  'warning',
  'operator',
  ...
);
```

## Comunicación al cliente

Por cada tenant afectado:

```
Hola {nombre_comercio},

Detectamos {N} operaciones pendientes en tu cuenta que requirieron
intervención manual. Las resolvimos así:

{listado}:
- Venta {ID} → factura emitida correctamente (CAE {numero})
- Venta {ID} → contactanos: necesitamos confirmar datos del cliente
- ...

Si tenés dudas o detectás algo raro, contactanos.

— Pandora team
```

## Resolución

### Criterio para declarar resuelto

- `reconciliation.dead_jobs_waiting < 5`
- Tenants afectados notificados
- Audit log con resolución de cada job

### Si el volumen es alto (> 50 dead jobs simultáneos)

→ **Investigar causa raíz** — bug sistemático probable.

- Revisar reciente deploys (rollback si necesario)
- Revisar métricas AFIP (¿outage que causó cola?)
- Revisar logs Pino con filtro por `correlation_id` de varios jobs

→ Posible escalada a **S1** según severidad.

## Acciones preventivas

- Configurar alerta dashboard cuando `dead_jobs_waiting > 5` (anticipar > 10)
- Cron diario que ejecuta Q2 y notifica si hay nuevos
- F1+ quarantine queue separada para análisis offline (CLAUDE.md §15 deferred)
- F1+ operator UI con botones de re-enqueue / discard

---

## Anti-patterns

- ❌ Re-enqueue sin investigar causa → mismo error de nuevo
- ❌ Discard masivo sin audit → pierde info de operación real
- ❌ Reset de attempts sin razón → bypass de circuit breaker
- ❌ Procesar dead jobs sin SKIP LOCKED (ej: script ad-hoc) → double-processing
- ❌ Comunicar a cliente "todo OK" sin verificar caso por caso

---

## Cross-references

- [RECONCILIATION-ENGINE.md §6](../RECONCILIATION-ENGINE.md) — Dead letter philosophy
- [RECONCILIATION-ENGINE.md §11](../RECONCILIATION-ENGINE.md) — Queries operacionales Q1-Q4
- [EVENT-TAXONOMY.md §6](../EVENT-TAXONOMY.md) — jobs_queue reglas J1-J6
- [OPERATIONAL-SEVERITY.md](../OPERATIONAL-SEVERITY.md) — calibración severidad

---

*Runbook dead-jobs-resolution.md v1.0 — 2026-05-28*
