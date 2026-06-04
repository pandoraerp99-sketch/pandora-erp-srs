# Proposal — EVENT-TAXONOMY update para ADR-0025

**Fecha:** 2026-06-03
**Estado:** PROPOSAL (sin aplicar — para implementación en Sprint 6)
**Disparador:** ADR-0025 (Catálogos Regulatorios Runtime) + mini-auditoría coherencia 2026-06-03
**Reemplaza:** la sección "Eventos audit_log nuevos" que estaba inicialmente en ADR-0025 (corregida inline tras mini-auditoría 2026-06-03)

---

## Por qué este doc existe (y NO se aplicó directo a EVENT-TAXONOMY)

EVENT-TAXONOMY.md v2.0.2 tiene **regla J1** (catálogo CERRADO):

> "agregar event_name aquí = agregar a EVENT-TAXONOMY + PR review + actualizar DECISION-LEDGER. No agregar event names 'on the fly'."

Esta proposal cumple el patrón:
- ✅ Documenta el cambio formal con justificación
- ✅ Listo para PR review cuando se construya Sprint 6
- ✅ Evita que EVENT-TAXONOMY refleje eventos sin código (sería claim falso)
- ✅ Cuando Sprint 6 implemente el módulo `src/lib/fiscal/catalogs/`, este doc se aplica al catálogo + se actualiza DECISION-LEDGER

**Anti-pattern evitado:** actualizar EVENT-TAXONOMY ahora sin código es exactamente el patrón "doc dice una cosa, código dice otra" que la regla J1 quiere prevenir. Mejor proposal documentada → aplicación atómica con el PR de Sprint 6.

---

## Cambios propuestos

### A. audit_log — agregar 1 evento canónico nuevo

```diff
Domain: system (existente)

+ system.catalog.degraded_fail_closed
```

**Definición:**

| Atributo | Valor |
|---|---|
| `event_name` | `system.catalog.degraded_fail_closed` |
| `severity` | **critical** |
| `pii_level` | `internal` |
| `domain` | `system` (existente) |
| `sub_domain` | N/A (no requiere nuevo sub-domain — usa estructura `system.X.Y` plana) |
| Schema payload | `{ catalog_name: string, days_since_last_refresh: number, last_successful_refresh: ISO8601, failed_attempts_in_window: number }` |
| Inmutabilidad | INSERT-only (trigger inmutable existente) |
| Retention | 10 años (Ley 11.683 — heredada de retention `system.*` críticos) |

**Justificación de auditabilidad:**

Este evento marca el momento exacto en que el módulo fiscal degradó a fail-closed por catálogos stale. Es:

- **Operacionalmente crítico**: bloquea emisiones nuevas → comerciantes afectados → potencial reporte a AFIP por ventana sin facturación.
- **Equivalente a `system.fiscal_emergency_stop_activated`** (ya existente en catálogo) — ambos son decisiones operativas que bloquean emisión.
- **Auditor/inspector AFIP querría saber** "¿hubo ventana sin emisión? ¿por qué?" — este evento responde.
- **NO se puede reconstruir desde otra fuente** (cron logs son Pino, rotables; este es persistente).

**Ejemplo de payload:**

```json
{
  "catalog_name": "FEParamGetCondicionIvaReceptor",
  "days_since_last_refresh": 8,
  "last_successful_refresh": "2026-08-23T04:00:12Z",
  "failed_attempts_in_window": 8,
  "module_blocked_since": "2026-08-31T04:00:35Z"
}
```

**Evento de recuperación (NO se propone, queda derivable):**

La recuperación del fail-closed NO requiere evento audit propio. Se reconstruye desde el `system.incident_handled` que el operator emite al ejecutar el runbook [catalogs-stale-fail-closed.md](../RUNBOOKS/catalogs-stale-fail-closed.md).

### B. METRIC_WHITELIST — agregar 3 métricas counter nuevas

```diff
Existente: 'afip.padron.cache_hit_rate' { scope: 'tenant', allowedTagKeys: ['outcome'] }

Nuevas (mismo patrón, scope='system'):

+ 'fiscal.catalog.refresh' {
+   scope: 'system',
+   allowedTagKeys: ['catalog_name', 'outcome'],
+   allowedValues: {
+     catalog_name: [<lista de 12 catálogos FEParam* — ver tabla abajo>],
+     outcome: ['updated', 'unchanged', 'failed'],
+   },
+   cardinalityWarn: 15,  // 12 catálogos + 3 outcomes (cada increment usa SOLO 1 tag_key — ver §"Notas")
+ }
+
+ 'fiscal.catalog.boot_load' {
+   scope: 'system',
+   allowedTagKeys: ['catalog_name', 'outcome'],
+   allowedValues: {
+     catalog_name: [<lista de 12 catálogos FEParam*>],
+     outcome: ['success', 'failed'],
+   },
+   cardinalityWarn: 14,  // 12 + 2 (mismo patrón — 1 tag_key por increment)
+ }
+
+ 'fiscal.catalog.id_lookup_miss' {
+   scope: 'tenant',
+   allowedTagKeys: ['catalog_name'],
+   allowedValues: {
+     catalog_name: [<lista de 12 catálogos FEParam*>],
+   },
+   cardinalityWarn: 12,
+ }
```

### Notas sobre el patrón multi-tag de Sprint 2 #5

**CORRECCIÓN aplicada 2026-06-03 tras revisión auto-crítica:** la versión inicial del proposal calculaba cardinality como producto cartesiano (12 × 3 = 36, 12 × 2 = 24). Esto era INCORRECTO. El código real de Sprint 2 #5 (`prepareMetricIncrement`) acepta UN solo par `(tag_key, tag_value)` por incremento:

```typescript
const tagKey = options.tag?.key ?? '';
const tagValue = options.tag?.value ?? '';
```

Esto significa que con `allowedTagKeys: ['catalog_name', 'outcome']`, cada incremento usa UNO de los dos tag_keys, generando series independientes:
- 12 series con `tag_key='catalog_name'` (una por catálogo)
- 3 series con `tag_key='outcome'` (una por outcome)
- Total = **12 + 3 = 15 series** (no 36)

Mismo patrón existente con `fiscal.rounding.delta_cents` (que tiene `allowedTagKeys: ['mode', 'stage']` con cardinalityWarn=6 = 3+3, no 9).

**Cómo correlacionar dimensiones:** los counters NO permiten join nativo entre catalog_name y outcome. Para preguntar "¿cuántos refresh exitosos de TiposIva?" hay 2 alternativas:

1. **Patrón counter agregado** (recomendado F0): leer los Pino logs `fiscal.catalog.refresh_no_change` / `refresh_changed` (incluyen catalog_name + outcome en payload).
2. **Patrón tag_value compuesto** (futuro F1+ si se necesita): cambiar a una sola `tag_key='dimensions'` con `tag_value='FEParamGetTiposIva:updated'`. Esto cambia cardinality a 36 con UNA tag_key. NO se propone F0 — sin caso de uso real.

**Lista de 12 catálogos para `allowedValues.catalog_name`:**

```typescript
const FEPARAM_CATALOG_NAMES = [
  'FEParamGetCondicionIvaReceptor',
  'FEParamGetTiposCbte',
  'FEParamGetTiposDoc',
  'FEParamGetTiposIva',
  'FEParamGetTiposConcepto',
  'FEParamGetTiposMonedas',
  'FEParamGetCotizacion',
  'FEParamGetTiposTributos',
  'FEParamGetTiposPaises',
  'FEParamGetTiposOpcional',
  'FEParamGetPtosVenta',
  'FEParamGetActividades',
] as const;
```

**Justificación de cardinality bounded:**
- 12 catálogos = lista CERRADA (verificada contra WSDL oficial)
- `outcome` enumerado pequeño = bounded
- Cardinality máxima conocida = 36 (refresh) + 24 (boot) + 12 (miss) = 72 series totales
- Trivial vs umbral típico EVENT-TAXONOMY (cardinalityWarn > 100)

**Patrón de uso esperado:**

```typescript
// Cron diario refresh exitoso sin cambios
incrementCounter('fiscal.catalog.refresh', {
  tag: { catalog_name: 'FEParamGetTiposIva', outcome: 'unchanged' }
});

// Cron diario refresh con cambios (hash diff)
incrementCounter('fiscal.catalog.refresh', {
  tag: { catalog_name: 'FEParamGetCondicionIvaReceptor', outcome: 'updated' }
});

// Boot del módulo fiscal carga catálogo OK
incrementCounter('fiscal.catalog.boot_load', {
  tag: { catalog_name: 'FEParamGetTiposCbte', outcome: 'success' }
});

// Emisión con ID que no está en cache
incrementCounter('fiscal.catalog.id_lookup_miss', {
  tag: { catalog_name: 'FEParamGetCondicionIvaReceptor' }
});
// + tenant_id automático desde tracing context (scope=tenant)
```

### C. Pino logs — 6 eventos operativos (NO audit, NO métricas)

Estos NO requieren update a EVENT-TAXONOMY (Pino logs son scope local del módulo). Se documentan acá para que Sprint 6 los implemente con shape consistente:

| Log event | Nivel | Cuándo | Payload mínimo |
|---|---|---|---|
| `fiscal.catalog.loaded_at_boot` | `info` | Boot del módulo carga catálogo OK | `{ catalog_name, items_count, fetched_from_arca_at }` |
| `fiscal.catalog.refresh_no_change` | `info` | Cron refresh, hash igual al previo | `{ catalog_name, hash, last_change_ago_hours }` |
| `fiscal.catalog.refresh_changed` | `info` | Cron refresh con cambios reales | `{ catalog_name, old_hash, new_hash, items_added, items_removed, items_modified }` |
| `fiscal.catalog.boot_failed` | `fatal` + alerta | Boot del módulo no logró cargar catálogo crítico | `{ catalog_name, last_attempt_error, attempts }` |
| `fiscal.catalog.stale_warning` | `warn` + alerta | Cache > 5 días sin refresh exitoso | `{ catalog_name, days_since_last_refresh }` |
| `fiscal.catalog.id_not_in_version` | `error` | Caller solicita ID que no está en cache | `{ catalog_name, requested_id, available_ids_count }` |

**Patrón de scrub** (Sprint 2 #4 aplica): estos logs NO contienen secrets. SECRET_PATHS no requiere ampliación para este dominio.

### D. Anti-pattern documentado (evitar drift futuro)

```diff
Sección "Qué NO va a audit_log" — agregar entry:

+ | `system.catalog.updated` u otros refresh routinarios de catálogos | counter `fiscal.catalog.refresh` + Pino info |
+ | `fiscal.catalog.boot_failed` (carga inicial) | Pino fatal + alerta (NO audit — es bug operacional, NO decisión de compliance) |
+ | `fiscal.catalog.stale_warning` (5-6 días sin refresh) | Pino warn + alerta (NO audit — es señal temprana, no decisión) |
+ | `fiscal.catalog.id_not_in_version` (emisión solicita ID no cacheado) | counter + Pino error (NO audit — es bug del caller, no operación auditable) |
```

**Por qué documentarlo como anti-pattern:**

La versión inicial de ADR-0025 (pre-mini-auditoría) proponía estos 4 como audit events. La mini-auditoría detectó la inconsistencia con la regla J1. Documentar el anti-pattern previene que un dev futuro cometa el mismo error.

---

## Conteo post-aplicación

| Métrica | Antes | Después |
|---|---|---|
| Total eventos audit canónicos F0 | 42 (v2.0.2) | **43** (+1) |
| Total métricas counter canónicas | (no contado v2.0.2) | +3 nuevas |
| Domains permitidos F0 | 11 (existentes) | 11 (sin cambios) |
| Sub-domains válidos F0 | `system.dead_job.*` | `system.dead_job.*` (sin cambios) |

**Nota sobre sub-domains:** la propuesta NO introduce sub-domain nuevo como `system.catalog.*`. El único evento (`system.catalog.degraded_fail_closed`) usa el nivel plano `system.X.Y` directo, mismo patrón que `system.fiscal_emergency_stop_activated`. Esto evita expandir la complejidad del catálogo.

---

## Checklist de aplicación (Sprint 6 PR)

Cuando Sprint 6 implemente `src/lib/fiscal/catalogs/`, el PR debe incluir:

- [ ] Agregar `'system.catalog.degraded_fail_closed'` a `AUDIT_EVENT_NAMES` en `src/lib/audit/event-names.ts`
- [ ] Agregar 3 entries a `METRIC_WHITELIST` en `src/lib/observability/metrics.ts`
- [ ] Validar typecheck contra catálogo expandido
- [ ] Tests del scrub + Pino redact (los Pino logs no deberían contener PII)
- [ ] Actualizar `EVENT-TAXONOMY.md`:
  - Conteo total: 42 → 43
  - Agregar entry al catálogo en §5
  - Agregar entrada a "Qué NO va a audit_log" con las 4 razones documentadas
  - Bump versión: v2.0.2 → v2.0.3
- [ ] Actualizar `DECISION-LEDGER.md` con cambio aplicado (regla J1)
- [ ] Verificar runbook [catalogs-stale-fail-closed.md](../RUNBOOKS/catalogs-stale-fail-closed.md) cita los nuevos eventos correctamente

---

## Relación con docs

- [ADR-0025 — Catálogos Regulatorios Runtime](../files/ADR-0025-catalogos-regulatorios-runtime.md) — origen del cambio
- [EVENT-TAXONOMY.md v2.0.2](../EVENT-TAXONOMY.md) — catálogo a ampliar
- [RUNBOOKS/catalogs-stale-fail-closed.md](../RUNBOOKS/catalogs-stale-fail-closed.md) — runbook que dispara y registra el evento `system.catalog.degraded_fail_closed`
- [Mini-auditoría coherencia 2026-06-03](../../C:\Users\Pandora\.claude\projects\c--Users-Pandora-Desktop-SRS\memory\mini-auditoria-coherencia-adrs-0023-0025-2026-06-03.md) — detección del problema que motivó esta proposal
- [WSDL WSFEv1 oficial](https://servicios1.afip.gov.ar/wsfev1/service.asmx?WSDL) — fuente de los 12 catálogos

---

**Estado:** PROPOSAL aprobado por owner (asume "decisión interna" del feedback). Aplicación atómica en Sprint 6 PR.
