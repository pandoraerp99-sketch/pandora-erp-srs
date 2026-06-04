# RUNBOOKS — Pandora ERP

**Fecha:** 2026-06-03 (agregado catalogs-stale-fail-closed post ADR-0025)
**Propósito:** índice de runbooks operativos para responder a incidentes específicos. Cada runbook tiene severidad ([OPERATIONAL-SEVERITY.md](../OPERATIONAL-SEVERITY.md)), pasos secuenciales, criterio de resolución.

> Runbook = "no improvises, seguí estos pasos". Especialmente útil cuando el incidente pasa a las 3am o cuando el incidente toca compliance/legal.

---

## Runbooks F0 disponibles

| Runbook | Severidad | Cuándo |
|---|---|---|
| [afip-outage.md](afip-outage.md) | S1 / S2 | AFIP WSAA / WSFEv1 / Padrón A5 inalcanzable o degradado |
| [cross-tenant-leak.md](cross-tenant-leak.md) | S0 | Datos de tenant A vistos por tenant B confirmado |
| [cash-discrepancy.md](cash-discrepancy.md) | S2 / S3 | Descuadre de caja al cierre |
| [dead-jobs-resolution.md](dead-jobs-resolution.md) | S2 | `jobs_queue` con `status='dead'` acumulados (requieren intervención humana) |
| [security-incident.md](security-incident.md) | S0 / S1 | Breach confirmado, credentials filtradas, ataque sostenido |
| [breach-notification.md](breach-notification.md) | S0 | Cumplimiento Ley 25.326 — notificación a AAIP + titular |
| [catalogs-stale-fail-closed.md](catalogs-stale-fail-closed.md) | S1 / S2 | Catálogos regulatorios WSFEv1 stale > 7 días → módulo fiscal bloqueado (ADR-0025) |

---

## Runbooks F1+ (deferred)

- `arco-request.md` — pedido de Acceso/Rectificación/Cancelación/Oposición del titular (Ley 25.326). Trigger: primer pedido real. Bloqueado por pregunta B-10 abogado.
- `audit-log-cleanup-failure.md` — cron DROP PARTITION falló o quedó pendiente.
- `cert-expired.md` — certificado X.509 AFIP expirado en producción.
- `database-restore.md` — restore desde Supabase managed backup en producción.

---

## Estructura estándar de runbook

Cada runbook sigue esta plantilla:

```markdown
# {Nombre} — Runbook

**Severidad:** S0 / S1 / S2 / S3 (de [OPERATIONAL-SEVERITY.md])
**Detección:** trigger automático / reporte cliente / observación interna
**SLA target:** detección < X / mitigación < Y / resolución < Z

## Síntomas
- Cómo se reconoce el incidente

## Detección
- Cómo se dispara el alert (trigger técnico)

## Pasos de mitigación inmediata (< X min)
1. ...
2. ...

## Pasos de investigación
1. ...
2. ...

## Resolución
- Criterio para declarar resuelto
- Comunicación al cliente
- Post-mortem si S0/S1

## Acciones post-incidente
- Audit log entry
- Métrica a observar
- ADR si decisión arquitectónica
```

---

## Reglas operativas

### R1 — Seguir runbook al pie de la letra durante S0/S1

NO improvisar durante incidente crítico. Si el runbook falla, escalar.

### R2 — Cada incidente deja audit log

```sql
-- Evento canónico EVENT-TAXONOMY §5 domain system: 'system.incident_handled' (severity 'error')
INSERT INTO audit_log (event_name, payload, severity, ...)
VALUES (
  'system.incident_handled',
  '{ "runbook": "afip-outage.md", "severity_observed": "S1", "steps_taken": [...], "outcome": "resolved", "duration_minutes": 45 }',
  'error',
  ...
);
```

### R3 — Post-mortem obligatorio en S0/S1

Después de resolver: doc escrito con timeline + causa raíz + acciones preventivas + qué del runbook fue útil / faltante.

### R4 — Update runbook tras incidente

Si el runbook NO cubrió algo, actualizar el runbook después del post-mortem.

### R5 — Test trimestral de runbooks (chaos light)

Trimestralmente: simular incidente + seguir runbook + cronometrar + identificar fricciones.

---

## Cross-references

- [OPERATIONAL-SEVERITY.md](../OPERATIONAL-SEVERITY.md) — matriz S0-S4
- [EVENT-TAXONOMY.md](../EVENT-TAXONOMY.md) — eventos canónicos para audit logs de runbooks
- [CAPABILITY-MAP.md](../CAPABILITY-MAP.md) — capabilities afectadas por cada runbook
- [BOUNDED-CONTEXTS.md](../BOUNDED-CONTEXTS.md) — context owner del recurso afectado
- [CORRELATION-PROPAGATION.md](../CORRELATION-PROPAGATION.md) — `correlation_id` para reconstruir timeline durante post-mortem
- [RECONCILIATION-ENGINE.md](../RECONCILIATION-ENGINE.md) — Sección 11 operator tooling F0 (SQL queries Q1-Q4)
- [DECISION-LEDGER.md](../DECISION-LEDGER.md) — autoridad
- [CLAUDE.md §13](../CLAUDE.md) — Reliability & Recovery Constitution

---

*RUNBOOKS — 2026-05-28. Vivir y actualizar con cada incidente real.*
