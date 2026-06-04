# AFIP Outage — Runbook

**Severidad:** S1 (outage extendido) / S2 (timeouts intermitentes)
**Detección:** automática vía métricas + manual vía reporte cliente
**SLA target F0:** detección < 15 min · mitigación < 1h · resolución depende de AFIP

---

## Síntomas

- Tickets / facturas no se emiten — comerciantes ven "AFIP no responde" en POS
- Reconciliation jobs acumulándose (`reconciliation.outcome=reconciliation_timeout` métrica subiendo)
- WSAA token refresh job falla persistentemente
- Padrón A5 timeouts repetidos
- AFIP request P95 latencia > 30s sostenido

## Detección automática

Triggers de alerta (configurar en F0):

```sql
-- Trigger S1 (outage extendido)
SELECT count(*) FROM metrics_counter
WHERE metric_name = 'afip.request_timeout'
  AND bucket_hour > now() - interval '5 minutes';
-- > 10 timeouts en 5 min sostenidos → S1
```

```typescript
// En código: si N requests consecutivos a AFIP fallan con timeout
const consecutiveFailures = getConsecutiveAfipFailures();
if (consecutiveFailures > 5) {
  emitAlert('S1', 'afip-outage', { consecutiveFailures });
  openCircuitBreaker('afip'); // ADR-0022 CB1
}
```

## Pasos de mitigación inmediata (< 1h)

### 1. Confirmar que el problema es de AFIP, no nuestro

```bash
# Test desde environment Pandora
curl -X POST https://wsfev1.homo.afip.gob.ar/WSFEV1/service.asmx \
  -H "Content-Type: text/xml" \
  -d '<test request>'
# Esperar respuesta o timeout
```

```sql
-- Verificar métricas internas Pandora
SELECT metric_name, sum(counter) FROM metrics_counter
WHERE metric_name LIKE 'afip.%'
  AND bucket_hour > now() - interval '1 hour'
GROUP BY metric_name;
```

**Si nuestro test directo a AFIP también falla** → confirmado outage AFIP (no nuestro).

**Si nuestro test funciona pero la app no** → el problema es Pandora: stack trace + revisar deploy reciente + considerar rollback.

### 2. Validar circuit breaker abierto

```sql
SELECT * FROM circuit_breaker_state WHERE service = 'afip';
-- Si state != 'open' → abrir manualmente
```

```sql
UPDATE circuit_breaker_state
SET state = 'open', opened_at = now(), reason = 'afip-outage-manual'
WHERE service = 'afip';

-- Evento ad-hoc del runbook. Usa severity canónico EVENT-TAXONOMY: 'error' (incident operativo).
INSERT INTO audit_log (event_name, payload, severity, actor_type, ...)
VALUES (
  'system.incident_handled',
  '{"runbook": "afip-outage.md", "severity_observed": "S1", "steps_taken": ["circuit_breaker_opened_manually"], "service": "afip", "outcome": "in_progress"}',
  'error',
  'system',
  ...
);
```

### 3. Verificar que UX comerciante refleja el estado

Comerciante debe ver mensaje:

> "AFIP no responde en este momento. Tu venta quedó registrada y se facturará automáticamente cuando se restablezca el servicio. Podés seguir vendiendo — las facturas pendientes se emitirán en orden cuando AFIP vuelva."

**Si NO ve eso** → bug en UI fail-closed. Comunicar a Pandora team + fix urgente.

### 4. Verificar status oficial AFIP

- https://www.afip.gob.ar/ws (status público)
- https://twitter.com/AFIPComunica
- Forum de devs AFIP / Telegram grupo

Si AFIP confirma outage → comunicar tiempo estimado a clientes.

### 5. Comunicación a clientes afectados

Template email/WhatsApp:

```
Hola {nombre_comercio},

AFIP está experimentando problemas técnicos desde {hora_inicio}.
Las ventas que estás cobrando quedan registradas correctamente y
las facturas se emitirán automáticamente cuando AFIP restablezca
el servicio.

Podés seguir vendiendo con normalidad.

Tiempo estimado de restablecimiento: {según AFIP / desconocido}.

Te mantenemos informado.

— Pandora team
```

## Pasos de investigación (después de mitigación)

### 1. Cuantificar impacto

```sql
-- Facturas pendientes acumuladas por tenant
SELECT tenant_id, count(*) FROM sales
WHERE fiscal_status IN ('pending', 'pending_reconciliation')
  AND created_at > {outage_start}
GROUP BY tenant_id;

-- Jobs queue de reconciliación pendientes
SELECT count(*) FROM jobs_queue
WHERE job_type = 'afip.reconcile_pending'
  AND status IN ('pending', 'running');
```

### 2. Verificar reconciliation engine

```sql
-- Q1 active reconciliations (RECONCILIATION-ENGINE §11)
SELECT s.id, s.tenant_id, s.fiscal_status, s.correlation_id,
       jq.attempts, jq.next_retry_at, jq.last_error
FROM sales s
LEFT JOIN jobs_queue jq ON jq.payload->>'sale_id' = s.id::text
WHERE s.fiscal_status IN ('pending_reconciliation', 'recovery')
ORDER BY s.created_at;
```

### 3. Validar que cliente puede seguir operando

POS debe seguir respondiendo. Cobros offline (efectivo, tarjeta presencial) no requieren AFIP en el momento.

## Resolución

### Criterio para declarar resuelto

1. AFIP responde con latencia < 5s P95 sostenido > 15 min
2. Backlog de reconciliación consumido (queue < 10 jobs pendientes)
3. Circuit breaker `afip` cerrado automáticamente
4. Comerciantes recibieron facturas pendientes
5. Audit log con timeline completo del incidente

### Cerrar circuit breaker

```sql
UPDATE circuit_breaker_state
SET state = 'closed', closed_at = now()
WHERE service = 'afip' AND state = 'open';
```

### Procesar backlog de reconciliación

Reactivar workers (si se pausaron). Worker `afip.reconcile_pending` debe consumir backlog automáticamente con SKIP LOCKED.

### Comunicación final

```
Hola {nombre_comercio},

El servicio AFIP fue restablecido a las {hora_fin}.
Tus facturas pendientes ya fueron emitidas correctamente.
Total facturas pendientes durante outage: {N}.

Si detectás alguna inconsistencia, contactanos.

— Pandora team
```

## Acciones post-incidente

### 1. Post-mortem escrito (obligatorio S1)

Doc en `docs/post-mortems/{fecha}-afip-outage.md` con:
- Timeline (detección, comunicación, mitigación, resolución)
- Causa raíz (lo que reportó AFIP o lo que deducimos)
- Qué funcionó del runbook
- Qué faltó
- Acciones preventivas (mejora del runbook, ajuste de thresholds)

### 2. Audit log

```sql
-- Cierre del incidente con outcome completo. Evento canónico EVENT-TAXONOMY §5 + severity 'error'.
INSERT INTO audit_log (event_name, payload, severity, actor_type, ...)
VALUES (
  'system.incident_handled',
  '{
    "runbook": "afip-outage.md",
    "severity_observed": "S1",
    "service": "afip",
    "started_at": "...",
    "resolved_at": "...",
    "impact": { "tenants_affected": N, "sales_pending": N, "max_reconciliation_delay_minutes": N },
    "outcome": "resolved",
    "duration_minutes": N
  }',
  'error',
  'system',
  ...
);
```

### 3. Actualizar métricas

Si reconciliation se vio afectada, registrar `reconciliation.outcome=cae_received_late_after_outage` (variante).

### 4. Update runbook si faltó algo

Si descubriste un paso que no estaba documentado, agregar acá inmediatamente después del incidente.

## Anti-patterns prohibidos durante AFIP outage

- ❌ Permitir emisión sin CAE "porque AFIP volvió a aceptar números viejos" → riesgo fiscal
- ❌ "Emitir manual" números reservados sin reconciliación → corrumpe numeración
- ❌ Silenciar UI fail-closed para que cliente "no se asuste" → cliente pierde info crítica
- ❌ Forzar reintentos manuales sin SKIP LOCKED → double-processing
- ❌ Bajar circuit breaker antes de confirmar AFIP estable → re-acumular backlog

---

*Runbook afip-outage.md v1.0 — 2026-05-28*
