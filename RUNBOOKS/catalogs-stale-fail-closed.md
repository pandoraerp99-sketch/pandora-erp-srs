# Catálogos Regulatorios Stale → Fail-Closed — Runbook

**Severidad:** S1 (módulo fiscal bloqueado en producción) / S2 (warning de 5-7 días sin refresh)
**Detección:** automática vía cron + Pino warn/fatal + audit event `system.catalog.degraded_fail_closed`
**SLA target F0:** detección < 1h (warning cron diario) · mitigación < 4h · resolución < 12h
**Relacionado con:** ADR-0025 (Catálogos Regulatorios Runtime), [afip-outage.md](afip-outage.md)

---

## Contexto operativo

Pandora consume 12 catálogos regulatorios desde el WSFEv1 oficial (ADR-0025):

- 7 catálogos F0 críticos: TiposCbte, TiposDoc, TiposIva, TiposConcepto, CondicionIvaReceptor, TiposMonedas, PtosVenta
- 2 condicionales: Actividades (A-21), Cotizacion (F2+)
- 3 F1+: TiposTributos, TiposPaises, TiposOpcional

**Política de cache (ADR-0025):**
- TTL 24h por catálogo crítico
- Cron diario refresh 04:00 ART via worker `catalog-refresh`
- Boot validation obligatoria al iniciar módulo fiscal
- **Cache > 7 días sin refresh exitoso → fail-closed** (módulo fiscal bloqueado)

Este runbook cubre el escenario en que el cron de refresh falla repetidamente y el módulo fiscal queda en estado degradado.

---

## Síntomas

### Warning temprano (S2 — 5-6 días sin refresh exitoso)

- Pino logs `warn` repetidos: `{event: 'fiscal.catalog.stale_warning', catalog_name, days_since_last_refresh}`
- Métrica `fiscal.catalog.refresh` con tag `outcome=failed` aumentando
- Alerta operacional enviada (configurar email/SMS)
- **Operación NO bloqueada todavía** — emisiones siguen usando cache existente

### Fail-closed disparado (S1 — > 7 días sin refresh exitoso)

- Pino log `fatal`: `{event: 'fiscal.catalog.degraded_fail_closed', catalog_name, days_since_last_refresh, last_successful_refresh}`
- Audit event `system.catalog.degraded_fail_closed` (severity=critical) en `audit_log`
- **Módulo fiscal BLOQUEADO** — toda nueva emisión falla con `FiscalModuleNotReadyError`
- Comerciantes ven mensaje en POS: "Sistema fiscal temporalmente bloqueado. Contactar soporte."
- Métrica `fiscal.catalog.boot_load` con `outcome=failed` al próximo restart

### Diferencias vs AFIP outage normal ([afip-outage.md](afip-outage.md))

| Aspecto | AFIP outage | Catálogos stale fail-closed |
|---|---|---|
| Causa raíz típica | ARCA caído (server side) | (a) ARCA caído sostenido 7+ días, O (b) bug en código cron worker, O (c) credenciales WSAA expiradas |
| Emisiones nuevas | Fallan con timeout retry async | Fallan inmediato con error explicit |
| Reconciliación | Worker reintenta sin bloquear | NO aplica — el módulo no arranca |
| Recovery cuando AFIP vuelve | Automática via reconciliation | Requiere intervención operator |

---

## Detección automática

### Cron diario de monitoreo (configurar en F0)

**Nota sobre schema de `metrics_counter`:** según Sprint 2 #5 (código real) + EVENT-TAXONOMY.md, el schema usa `last_incremented_at` (no `bucket_hour` — discrepancia pre-existente con CLAUDE.md §10.4 que requiere PR de coherencia separado). Las queries abajo usan `last_incremented_at`.

**Nota sobre tags:** la API de `incrementCounter` acepta solo 1 par `(tag_key, tag_value)` por incremento. La métrica `fiscal.catalog.refresh` con `allowedTagKeys=['catalog_name', 'outcome']` significa que cada incremento usa UNO de los dos tag_keys, no ambos a la vez. Para correlacionar "qué catálogo + qué outcome", usar el evento Pino `fiscal.catalog.refresh_*` que sí tiene ambas dimensiones en su payload.

```sql
-- Trigger S2 — warning de fallas en refresh, por outcome=failed
SELECT
  tag_value AS outcome_or_catalog,
  count,
  last_incremented_at
FROM metrics_counter
WHERE metric_name = 'fiscal.catalog.refresh'
  AND tag_key = 'outcome'
  AND tag_value = 'failed'
  AND last_incremented_at > now() - interval '6 days'
ORDER BY last_incremented_at DESC;
-- Si count > 5 sostenido en 6 días → S2 warning
```

```sql
-- Para identificar QUÉ catálogos específicos están afectados, ir a Pino logs
-- (los logs `fiscal.catalog.refresh_no_change` / `refresh_changed` tienen
-- `catalog_name` en el payload). Los counters no permiten correlación nativa.
```

```sql
-- Trigger S1 — fail-closed disparado
SELECT event_name, payload, created_at
FROM audit_log
WHERE event_name = 'system.catalog.degraded_fail_closed'
  AND created_at > now() - interval '24 hours'
ORDER BY created_at DESC
LIMIT 10;
-- payload incluye: { catalog_name, days_since_last_refresh, last_successful_refresh }
```

### Verificación operativa rápida

```typescript
// Si tenés acceso a la app, verificar estado del módulo fiscal
import { CatalogRegistry } from '@/lib/fiscal/catalogs/registry';

const registry = await CatalogRegistry.getInstance();
const status = await registry.getHealth();
console.log(status);
// {
//   module_ready: false,  // <-- BLOQUEADO
//   catalogs: {
//     'FEParamGetCondicionIvaReceptor': {
//       last_refresh: '2026-05-25T08:34:12Z',  // 9 días atrás
//       cache_age_hours: 216,
//       status: 'FAIL_CLOSED'
//     },
//     ...
//   }
// }
```

---

## Pasos de mitigación inmediata (< 4h)

### 1. Confirmar el síntoma y aislar la causa

**1.a — ¿Es problema de ARCA o nuestro?**

Verificar conectividad al WS WSFEv1 desde el environment de Pandora:

```bash
# Test directo al WSDL
curl -s -o /dev/null -w "%{http_code}\n" https://servicios1.afip.gov.ar/wsfev1/service.asmx?WSDL
# 200 OK → ARCA responde, problema es nuestro
# Timeout / 5xx → problema en ARCA, escalar a runbook afip-outage.md
```

**1.b — ¿Qué catálogos están stale?**

Los counters no permiten correlación nativa entre catalog_name y outcome (cada increment usa solo 1 tag). Para identificar catálogos específicos afectados:

```sql
-- Vía 1: audit_log del evento fail-closed (incluye catalog_name en payload)
SELECT
  payload ->> 'catalog_name' AS catalog_name,
  payload ->> 'days_since_last_refresh' AS days,
  payload ->> 'last_successful_refresh' AS last_ok,
  created_at
FROM audit_log
WHERE event_name = 'system.catalog.degraded_fail_closed'
  AND created_at > now() - interval '14 days'
ORDER BY created_at DESC;
```

Si no hay aún `degraded_fail_closed` audit events pero hay warning, los Pino logs son la fuente:

```bash
# Vía 2: Pino logs del worker catalog-refresh (acceder via Sentry / Vercel logs)
# Filtrar por event=fiscal.catalog.stale_warning para los últimos 14 días
# El log incluye {catalog_name, days_since_last_refresh}
```

Identificar específicamente cuáles de los 7 críticos F0 están afectados.

**1.c — ¿Es problema de credenciales WSAA?**

```sql
SELECT tenant_id, expires_at, generated_at
FROM wsaa_tokens_cache
WHERE expires_at < now()
ORDER BY expires_at DESC;
```

WSAA tokens expirados → cron de refresh no autentica al WS. Causa raíz distinta.

### 2. Restore manual del cache

**2.a — Refresh forzado de catálogos críticos**

Ejecutar el worker de refresh manualmente para forzar reload:

```typescript
// Via Server Action admin (requiere actor_type=support con audit explícito)
import { runCatalogRefresh } from '@/lib/workers/catalog-refresh';

await runCatalogRefresh({
  catalogs: 'F0_CRITICAL',  // refresca los 7
  force: true,              // ignora TTL
  audit_reason: 'Manual refresh — runbook catalogs-stale-fail-closed'
});
```

Si esto falla con error de conectividad → ir al paso 1.a o 1.c.

**2.b — Boot validation forzado**

Reiniciar el módulo fiscal (Vercel redeploy o feature flag toggle) para gatillar boot validation con los catálogos refrescados.

### 3. Verificar restore

```typescript
const status = await registry.getHealth();
// Esperado tras restore exitoso:
// {
//   module_ready: true,
//   catalogs: {
//     'FEParamGetCondicionIvaReceptor': {
//       last_refresh: '<fecha actual>',
//       cache_age_hours: 0,
//       status: 'OK'
//     },
//     ...
//   }
// }
```

Audit event esperado tras restore:

```sql
SELECT event_name, payload, created_at
FROM audit_log
WHERE event_name IN ('fiscal.catalog.degraded_fail_closed', 'fiscal.catalog.recovered')
ORDER BY created_at DESC
LIMIT 5;
```

### 4. Comunicación operativa

- A **comerciantes afectados:** "Sistema fiscal restablecido. Si emitieron en POS y el ticket no quedó, verificar en `Configuración → Comprobantes pendientes`."
- A **owner/equipo Pandora:** post-mortem requerido si fail-closed estuvo activo > 1h.

---

## Causas raíz típicas + mitigación específica

### Causa A — Cron worker no corrió (bug operacional)

**Diagnóstico:** sin entries de `fiscal.catalog.refresh` en métrica para las últimas 24h.

**Mitigación:**
1. Verificar Vercel Cron config en `vercel.json` — ¿el cron está habilitado?
2. Verificar logs del worker — ¿hay errores?
3. Re-deploy + monitorear próxima corrida.

**Post-mortem:** ¿por qué falló el monitoreo del cron? Threshold de alerta muy alto?

### Causa B — Credenciales WSAA expiradas en cache

**Diagnóstico:** logs muestran `WSAAAuthenticationError` o `Token expired`.

**Mitigación:**
1. Invalidar cache WSAA: `DELETE FROM wsaa_tokens_cache WHERE expires_at < now();`
2. Trigger refresh manual de WSAA antes de catálogos.
3. Después de WSAA renovado, ejecutar catalog refresh forzado (paso 2.a).

**Post-mortem:** ¿el cron `afip.refresh_wsaa_token` funcionó? Si no, runbook separado.

### Causa C — ARCA cambió el shape de respuesta (poison entry)

**Diagnóstico:** cron corrió pero falló validation. Logs muestran `CatalogShapeValidationError` o similar.

**Mitigación:**
1. **NO sobrescribir** el cache existente con la respuesta nueva (poison).
2. Verificar manualmente el endpoint cambiado: `curl https://servicios1.afip.gov.ar/wsfev1/service.asmx?WSDL`
3. Si ARCA cambió contractualmente → bug crítico:
   - Aislar la respuesta para análisis
   - Avisar a owner + contadora si aplica
   - Implementar adapter en código + deploy de fix

**Post-mortem:** ¿cómo monitoreamos cambios upstream del WSDL? Trigger semanal de validation contra schema esperado.

### Causa D — ARCA outage extendido > 7 días (raro pero posible)

**Diagnóstico:** confirma con `curl` que ARCA está caído. Histórico AFIP indica downtime habitual < 24h.

**Mitigación:**
1. Escalar a runbook `afip-outage.md`.
2. Comunicación pública con comerciantes sobre la dependencia.
3. Mientras tanto, **NO desactivar fail-closed** — emitir con cache stale > 7 días es riesgo regulatorio.
4. Si dura > 14 días: discusión con contadora sobre alternativas formales (presentación CAEA emergencia, papel manual con post-carga, etc.).

**Post-mortem:** ¿Pandora necesita fallback documentado para outage extendido? ADR específico F1+.

---

## Lo que NO se hace

| Acción tentadora | Por qué NO |
|---|---|
| Deshabilitar fail-closed para "destrabar" emisiones rápido | Cache stale > 7 días = riesgo regulatorio real (códigos podrían estar desactualizados). Mejor bloquear que emitir mal. |
| Hardcodear códigos de catálogo como fallback | Viola ADR-0025 (principio core). Catálogos son autoritativos solo si vienen de ARCA. |
| Asumir que catálogos no cambiaron en 7 días | Mismo principio. Sin verificación, no se sabe. |
| Activar IA para "inferir" la condición IVA del receptor | Viola ADR-0024 (IA Boundary — 15 áreas BLINDADAS). |
| Modificar `fiscal_snapshots` históricos para "corregir" descripciones desactualizadas | Snapshot INMUTABLE (ADR-0022 + 0023). Su `desc_at_emission` es CORRECTO históricamente. |

---

## Eventos audit_log + métricas que el runbook emite

Durante la ejecución de este runbook, el operator humano que opera la mitigación deja trazabilidad:

```typescript
// Cuando el operator ejecuta refresh manual (paso 2.a)
await writeAuditLog({
  event_name: 'system.incident_handled',  // EVENT-TAXONOMY ya existente
  payload: {
    runbook: 'catalogs-stale-fail-closed.md',
    severity_observed: 'S1',
    steps_taken: [
      'Verified ARCA connectivity (200 OK)',
      'Identified 3 of 7 critical catalogs stale > 7 days',
      'Forced catalog refresh via admin Server Action',
      'Confirmed module_ready=true post-restore',
    ],
    outcome: 'restored',
    duration_minutes: 35,
    root_cause: 'cron_worker_silent_failure',  // categoría libre
  },
  severity: 'error',
  pii_level: 'internal',
});
```

---

## SLA y métricas de eficacia

### Métricas operativas a monitorear

| Métrica | Target F0 |
|---|---|
| Detección S2 (warning 5-6 días) | < 1h tras dispararse |
| Detección S1 (fail-closed disparado) | < 5 min tras dispararse |
| Mitigación causa A (cron) | < 1h |
| Mitigación causa B (WSAA) | < 30 min |
| Mitigación causa C (ARCA shape change) | < 24h (puede requerir fix de código) |
| Mitigación causa D (ARCA outage) | depende de ARCA |
| Re-occurrencia mensual | < 1 evento/mes F0 |

### Métricas anti-eficacia (qué NO debe pasar)

- Fail-closed sin detectar > 1h → falla en monitoreo
- Mitigación que viola alguna entry de "Lo que NO se hace" → revisar entrenamiento
- Comerciante reporta el problema antes que la alerta → tuning de thresholds requerido

---

## Cross-reference

- [ADR-0025 — Catálogos Regulatorios Runtime](../files/ADR-0025-catalogos-regulatorios-runtime.md)
- [ADR-0022 — Fiscal Projection Layer + Snapshot](../files/ADR-0022-fiscal-projection-layer.md)
- [ADR-0024 — IA Boundary Policy](../files/ADR-0024-ia-boundary-policy.md)
- [afip-outage.md](afip-outage.md) — runbook complementario para outage extendido de ARCA
- [dead-jobs-resolution.md](dead-jobs-resolution.md) — runbook complementario si el cron worker queda dead-letter
- [OPERATIONAL-SEVERITY.md](../OPERATIONAL-SEVERITY.md) — definición S0-S4 + matriz impacto

---

**Versión:** 1.0 — creado 2026-06-03 post ADR-0025
**Próxima revisión esperada:** después del primer disparo real en producción (post-mortem refina el runbook con causa raíz real encontrada).
