# ADR-0025 — Catálogos Regulatorios Runtime + Snapshot Policy

**Fecha:** 2026-06-02
**Estado:** ⏸️ **Aprobado — implementación DIFERIDA a F1+** (revisión 2026-09-03)
**Relacionado con:** ADR-0023 (Snapshot Fiscal Completo — primera aplicación del patrón), ADR-0022 (Fiscal Projection Layer), ADR-0024 (IA Boundary Policy), ADR-0019 (Security baseline)
**Reemplaza:** ninguno (generaliza principio aplicado puntualmente en ADR-0023)
**Validación:** 🟡 El principio sigue vigente; **el momento de construirlo se corrió a F1+** por evidencia normativa (ver abajo)

---

## ⏸️ REVISIÓN 2026-09-03 — implementación diferida a F1+

**Qué gatilló la revisión:** la auditoría del 2026-09-02 detectó que `src/lib/fiscal/afip-codes.ts` **hardcodea** `CBTE_TIPO`, `CONDICION_IVA_RECEPTOR`, `DOC_TIPO` y `CONCEPTO`, y que el módulo `catalogs/` que este ADR exige **no existe**. Estaba catalogado como drift de severidad ALTA: un ADR *Aprobado* describiendo algo que nunca se construyó.

**Evidencia que cambió la decisión** — la **RG 5762/2025** eliminó **la clase de comprobante "M" entera** a partir del 01/12/2025 (cambio normativo mayor: nuevo procedimiento de habilitación, dos sub-tipos de A, leyendas nuevas). Y aun así:

> **el código interno del comprobante siguió siendo `0051`.** Pasó a llamarse "Factura A con leyenda", pero el número del catálogo no se movió.

O sea: ARCA cambia **nombres, leyendas y condiciones**, pero preserva la **estabilidad de los códigos numéricos** por retrocompatibilidad con los clientes de webservice. El riesgo #1 que motivó este ADR ("drift cuando ARCA modifique códigos") resulta ser mucho menor de lo asumido en 2026-06-02.

**Decisión:**
- **F0** → catálogos hardcodeados en `afip-codes.ts`, anclados por `tax_policy_version` en el snapshot fiscal. Esto ya da reproducibilidad histórica, que es el objetivo de fondo.
- **F1+** → construir `catalogs/` (fetch runtime + cache + boot validation fail-closed + cron de refresh) tal como está especificado más abajo. **La especificación NO se toca** — sigue siendo el destino correcto.

**Disparador para promover:** ARCA **agrega un código nuevo que necesitemos**, o **modifica uno existente**. Cualquiera de las dos cosas se detecta al re-extraer el Manual COMPG en cada bump de `tax_policy_version`.

**Por qué no se degrada a "Rechazado" ni se borra:** el principio (no hardcodear regulación, persistir snapshot autosuficiente) sigue siendo correcto. Lo que estaba mal era el **momento**: construir un módulo de fetch + cache + validación al boot para resolver un problema que la evidencia dice que hoy no tenemos es exactamente el over-engineering que el proyecto rechaza (CLAUDE.md §20.1).

**Lo que SÍ hay que hacer en F0 (no diferible):** que `afip-codes.ts` documente en su encabezado que es una **fotografía versionada** de los catálogos de ARCA, con el manual y la fecha de extracción, y que su fuente de verdad es `tax-policy-versions/`. Sin eso, el hardcode sí es deuda silenciosa.

---

## Contexto

ADR-0023 introdujo el patrón **"consultar catálogo en runtime + persistir snapshot autosuficiente"** específicamente para `CondicionIVAReceptorId`. Ese patrón aplica en realidad a **todos los catálogos regulatorios** que provee ARCA/AFIP vía WSFEv1, no solo a uno.

Sin formalización del principio general, el riesgo concreto a 1-2 años es:

1. **Drift hacia hardcoded codes.** Próxima vez que se necesite un catálogo (ej. `TiposIva` para Sprint 6), el dev podría hardcodear `[21.0, 10.5, 0.0]` por urgencia → drift cuando ARCA agregue/modifique alícuotas.
2. **Patrón inconsistente entre módulos.** Algunos catálogos en runtime, otros hardcoded → mantenimiento explosivo.
3. **Snapshots no autosuficientes para catálogos distintos a CondicionIVAReceptor.** Reproducibilidad histórica queda fragmentada por dominio.
4. **Sin política de cache + fail-closed unificada.** Cada catálogo termina con TTL distinto + comportamientos de fallo distintos.

### Verificación contra fuente primaria (2026-06-02)

Métodos `FEParam*` confirmados contra **WSDL oficial WSFEv1** (https://servicios1.afip.gov.ar/wsfev1/service.asmx?WSDL):

| # | Operation | Catálogo |
|---|---|---|
| 1 | `FEParamGetCondicionIvaReceptor` | Condición frente al IVA del receptor (RG 5616/2024) |
| 2 | `FEParamGetTiposCbte` | Tipos de comprobantes |
| 3 | `FEParamGetTiposDoc` | Tipos de documento receptor |
| 4 | `FEParamGetTiposIva` | Tipos de alícuota IVA |
| 5 | `FEParamGetTiposConcepto` | Concepto (productos/servicios/ambos) |
| 6 | `FEParamGetTiposMonedas` | Monedas utilizables |
| 7 | `FEParamGetCotizacion` | Cotización de moneda específica |
| 8 | `FEParamGetTiposTributos` | Tributos adicionales |
| 9 | `FEParamGetTiposPaises` | Países |
| 10 | `FEParamGetTiposOpcional` | Campos opcionales |
| 11 | `FEParamGetPtosVenta` | Puntos de venta del emisor |
| 12 | `FEParamGetActividades` | Actividades habilitadas del emisor |

Esta es la lista AUTORITATIVA. Cualquier catálogo regulatorio AFIP/ARCA que Pandora consuma debe estar entre estos 12.

## Decisión

### Principio core (invariante)

> **Todo catálogo regulatorio AFIP/ARCA consumido por Pandora viene del WS oficial en runtime. NO se hardcodean códigos ni descripciones en código Pandora. El snapshot persiste `{id, desc_at_emission, catalog_version_at_emission}` para cada valor usado en una emisión fiscal, garantizando reproducibilidad histórica autosuficiente.**

Este principio se aplica **siempre** que un catálogo regulatorio sea consumido. Las excepciones explícitas (lista cerrada en §"Excepciones") son catálogos LOCALES Pandora, no regulatorios.

### Clasificación de catálogos F0 / F0.5 / F1+

Los 12 catálogos del WSDL clasificados por necesidad operativa para Pandora F0 (target retail TDF):

#### F0 crítico (necesarios desde primera emisión)

| Catálogo | Por qué crítico F0 | Uso típico |
|---|---|---|
| `FEParamGetTiposCbte` | Decide tipo de comprobante (A/B/C/sub-tipos RG 5762) | Cada emisión |
| `FEParamGetTiposDoc` | Tipo documento receptor (80=CUIT, 96=DNI, 99=Otros) | Cuando hay receptor identificado |
| `FEParamGetTiposIva` | Alícuotas IVA disponibles (21/10.5/0/exento) | Cada item de venta |
| `FEParamGetTiposConcepto` | Concepto (1=productos, 2=servicios, 3=ambos) | Cada emisión |
| `FEParamGetCondicionIvaReceptor` | RG 5616/2024 obligatorio desde 01/08/2025 | Cada emisión |
| `FEParamGetTiposMonedas` | Código moneda (PES, etc.) | Cada emisión (aunque F0 ARS-only) |
| `FEParamGetPtosVenta` | Validar PV registrado del emisor | Boot + cada cambio de config |

#### F0 condicional (depende de validaciones pendientes contadora)

| Catálogo | Decisión bloqueada por |
|---|---|
| `FEParamGetActividades` | A-21 contadora (RG 5824/2026 PV-actividad opcional) |
| `FEParamGetCotizacion` | F0 ARS-only → no requerido. Activación F2+ multi-moneda |

#### F1+ con trigger

| Catálogo | Trigger objetivo |
|---|---|
| `FEParamGetTiposTributos` | Primer cliente con IIBB / tributos provinciales |
| `FEParamGetTiposPaises` | Primer cliente con receptor extranjero |
| `FEParamGetTiposOpcional` | Caso de uso específico que requiera campos opcionales WSFEv1 |

### Cache policy unificada

Patrón obligatorio para los 7 catálogos F0 crítico:

```
[Boot del módulo fiscal]
    ↓
Para cada catálogo en F0_CRITICAL_CATALOGS:
    1. Llamar FEParamGet* al WS WSFEv1
    2. Cachear in-memory con structure { items, fetched_at, hash, size }
    3. Si call falla → 3 retries con backoff
    4. Si los 3 retries fallan → fail-closed (módulo fiscal NO arranca)
    ↓
[Operación normal — cache caliente]
    ↓
[Cron diario refresh]
    1. Llamar FEParamGet* nuevamente
    2. Si nueva respuesta != cache → actualizar + log audit `system.catalog.updated`
    3. Si call falla → mantener cache existente + alerta operacional
    4. Si cache > 7 días sin refresh exitoso → degradar a fail-closed
```

**TTL por catálogo:**

| Catálogo | TTL | Refresh |
|---|---|---|
| Catálogos F0 crítico (7) | 24h | Cron diario 04:00 ART |
| `FEParamGetPtosVenta` | 24h pero validate-on-use | Refresh cuando se agrega PV nuevo |
| `FEParamGetCotizacion` (F2+) | 1h | Cada hora — cotizaciones cambian intra-día |

### Snapshot policy — `catalog_version_at_emission`

Cada `FiscalSnapshot` (ADR-0023) que use un valor de catálogo debe persistir:

```typescript
interface CatalogReference {
  catalog_name: string;          // "FEParamGetCondicionIvaReceptor", etc.
  id: number | string;            // valor numérico/string del catálogo
  desc_at_emission: string;       // descripción AL MOMENTO DE EMITIR
  catalog_version_at_emission: {
    fetched_from_arca_at: string;  // ISO timestamp cuando se cargó la cache
    hash: string;                  // hash sha256 de la respuesta ARCA cacheada
    size: number;                  // cantidad de items en el catálogo
  };
}
```

**Por qué los 3 campos en `catalog_version_at_emission`:**
- `fetched_from_arca_at`: trazabilidad temporal (cuándo se cargó esta versión)
- `hash`: detección de cambios entre versiones (auditor puede comparar dos snapshots)
- `size`: sanity check (si tamaño cambia mucho entre versiones, señal de cambio significativo)

**Decisión deliberada de NO depender de un "version field" del WS:** el WSDL no garantiza que ARCA devuelva versión explícita en cada catálogo. Hash + timestamp son **derivables determinísticamente desde la respuesta**, independientes de qué shape ARCA elija.

### Patrón canónico de uso

**Lookup runtime:**

```typescript
// src/lib/fiscal/catalogs/registry.ts (Sprint 6)
import 'server-only';

export class CatalogRegistry {
  async getCondicionIvaReceptor(id: number): Promise<CatalogEntry> {
    const cached = await this.cache.get('FEParamGetCondicionIvaReceptor');
    if (!cached) {
      throw new CatalogNotAvailableError('FEParamGetCondicionIvaReceptor');  // fail-closed
    }
    const entry = cached.items.find(i => i.id === id);
    if (!entry) {
      throw new CatalogIdNotInVersionError(
        'FEParamGetCondicionIvaReceptor',
        id,
        cached.version
      );  // fail-closed: ID inexistente en versión actual del catálogo
    }
    return {
      id: entry.id,
      desc: entry.desc,
      version: cached.version,  // metadata completa para snapshot
    };
  }
  // ...resto de catálogos
}
```

**Persistencia en snapshot:**

```typescript
// Al emitir factura
const condicionEntry = await catalogRegistry.getCondicionIvaReceptor(receptor.condicion_id);

fiscalSnapshot.condicion_iva_receptor = {
  catalog_name: 'FEParamGetCondicionIvaReceptor',
  id: condicionEntry.id,
  desc_at_emission: condicionEntry.desc,
  catalog_version_at_emission: condicionEntry.version,
};
```

### Excepciones (lista cerrada — catálogos que SÍ pueden hardcodearse)

**NO son catálogos regulatorios ARCA.** El principio NO aplica:

| Catálogo | Por qué hardcoded está OK | Mantenimiento |
|---|---|---|
| Tipos de pago Pandora (`cash`, `card_credit`, `card_debit`, `transfer`, `mp_qr`) | Decisión interna de Pandora, no regulatoria | PR en código + ADR si crece |
| Atmospheres UI (`operational`, `insight`, `ceremonial`) | Decisión de diseño (ADR-0012) | Stable |
| `ACTOR_TYPES` (`user`, `system`, `support`, `cron`, `worker`) | Decisión de arquitectura (CLAUDE.md §10) | PR si se agrega |
| `PII_LEVELS`, `SEVERITIES`, `USER_ROLES` | Catálogos de plataforma | PR + memoria |
| Códigos de error AFIP (`10242`, `820`, etc.) | Documentación referencial (no determinan flow) | Doc en error-codes.md |

**Regla práctica:** si el código viene de ARCA/AFIP/SRT/IGJ/etc. (entes regulatorios externos), aplica este ADR. Si es interno Pandora, no aplica.

### Migration policy — cuando ARCA cambia un catálogo

**Caso A — ARCA agrega códigos nuevos** (ej: agregan código 12 a `CondicionIVAReceptor`):
1. Cron diario detecta cambio (hash diferente)
2. Cache se actualiza con nuevo set
3. `audit_log` registra `system.catalog.updated` con `{catalog_name, old_hash, new_hash, items_added, items_removed}`
4. **Snapshots históricos NO se tocan** — su `catalog_version_at_emission.hash` apunta a versión vieja, sigue siendo correcto.
5. Nuevas emisiones usan catálogo actualizado.

**Caso B — ARCA renombra una descripción** (ej: "IVA Responsable Inscripto" → "IVA RI"):
1. Idem caso A.
2. Snapshots viejos siguen con `desc_at_emission: "IVA Responsable Inscripto"` — históricamente CORRECTO.
3. Nuevas emisiones reflejan la descripción actual.
4. UI puede opcionalmente mostrar tooltip "(históricamente: IVA Responsable Inscripto)" cuando muestra snapshot viejo.

**Caso C — ARCA elimina un código** (ej: deroga el ID 4):
1. Cron detecta + audit log.
2. Snapshots viejos con ID 4 SIGUEN siendo válidos (su `catalog_version_at_emission` apuntaba a versión donde existía).
3. Si UI/lookup en nueva emisión intenta usar ID 4 → `CatalogIdNotInVersionError` fail-closed.
4. Operación manual: si es transición compleja (ej: ID 4 → migra a ID 7), operator decide policy en runbook.

**Caso D — ARCA cambia semánticamente un código** (mismo ID, distinta semántica):
- Caso peligroso pero raro.
- Hash cambiará → audit log alerta.
- Operator + contadora deciden si snapshots viejos requieren disclaimer al reimprimir.
- Sin ADR-0025, este caso pasaría desapercibido. Con ADR-0025, queda detectado.

### Boot validation obligatoria

Al iniciar el módulo fiscal (Sprint 6):

```typescript
// src/lib/fiscal/boot.ts (Sprint 6)
async function bootFiscalModule(): Promise<void> {
  const F0_CRITICAL_CATALOGS = [
    'FEParamGetTiposCbte',
    'FEParamGetTiposDoc',
    'FEParamGetTiposIva',
    'FEParamGetTiposConcepto',
    'FEParamGetCondicionIvaReceptor',
    'FEParamGetTiposMonedas',
    'FEParamGetPtosVenta',
  ];

  for (const catalog of F0_CRITICAL_CATALOGS) {
    try {
      await catalogRegistry.preload(catalog);
      logger.info({ event: 'fiscal.catalog.loaded', catalog }, 'Catalog loaded at boot');
    } catch (err) {
      logger.fatal({ event: 'fiscal.catalog.boot_failed', catalog, err },
        'Catalog F0 critical no disponible al boot — modulo fiscal bloqueado');
      throw new FiscalModuleNotReadyError(catalog);  // FAIL-CLOSED
    }
  }
}
```

**Sin los 7 catálogos críticos cargados, el módulo fiscal NO arranca.** Esto es coherente con CLAUDE.md §8.12 "Fail-closed semantics fiscal".

### Fail-closed semantics — cuándo bloquear emisión

| Escenario | Acción |
|---|---|
| Catálogo F0 crítico no cargado al boot | Módulo fiscal NO arranca |
| Catálogo cacheado pero ID solicitado no existe en cache | Throw `CatalogIdNotInVersionError` + bloquear emisión |
| Cache > 7 días sin refresh exitoso | Degradar a fail-closed + alerta crítica |
| `FEParamGetCotizacion` no disponible + venta multi-moneda (F2+) | Bloquear emisión multi-moneda + fallback ARS-only |
| `FEParamGetPtosVenta` no incluye el PV configurado | Bloquear emisión + alerta config equivocada |

## Consecuencias

### Positivas

1. **Single source of truth.** Todos los catálogos regulatorios apuntan a ARCA. Sin duplicación.

2. **Snapshot autosuficiente garantizado por catálogo.** ADR-0023 lo prometió para CondicionIVAReceptor — ADR-0025 lo extiende a los 7 catálogos críticos F0.

3. **Auto-actualización.** Cuando ARCA agrega códigos (ej. nuevo tipo de comprobante), Pandora los recibe automático en 24h sin deploy.

4. **Detección automática de cambios regulatorios.** Cron detecta hash diferente → audit log + alerta operacional. Contadora puede ser notificada.

5. **Patrón consistente y enforceable.** Code review puede rechazar PRs con catálogos hardcodeados regulatorios.

6. **Auditabilidad histórica completa.** `catalog_version_at_emission` permite reconstruir cualquier emisión histórica exacta.

7. **Coherente con ADR-0024 (IA Boundary).** Catálogos NO se infieren con IA, vienen de fuente autoritativa.

### Negativas (trade-offs aceptados)

1. **Dependencia operacional de WSFEv1.** Si ARCA cae al boot del módulo, Pandora no arranca emisión. Mitigación: cache local + fail-closed con alerta clara.

2. **Mayor complejidad de cache.** vs hardcodear. Trade-off: complejidad vs auto-actualización.

3. **Boot del módulo fiscal toma 5-15s.** Por los 7 catálogos iniciales. Aceptable para módulo fiscal — no es UI crítica.

4. **Cron diario + worker dedicado** para refresh. Infraestructura adicional (delegada a Sprint 2 #6 cuando se construya worker).

5. **Snapshot ligeramente más pesado.** ~100 bytes adicionales por valor de catálogo persistido (hash + timestamp + size + desc). Para snapshot con ~5 catálogos referenciados = ~500 bytes/emisión. Trivial.

### Items deferidos F1+ con trigger

| Item | Trigger |
|---|---|
| Compresión de cache cuando catálogo > 10MB | `FEParamGetTiposTributos` o `FEParamGetTiposPaises` con > N entries |
| Distributed cache (Redis) para multi-instance | > 5 instancias Vercel sostenidas O cache miss > 5% |
| Real-time invalidation vía WS push | ARCA publica WS push (no existe hoy en WSFEv1) |
| Auto-rollback de cache si nueva versión rompe emisión | Primer caso real de cambio regulatorio que rompió emisión |
| Diff visual entre versiones de catálogo para operator | Operator pide tooling de auditoría |
| Versionado semántico de cambios catalog | Cuando hash-only resulte insuficiente para clasificar cambios |

## Implementación esperada (Sprint 6 — no implementar ahora)

Esquema directorio:

```
src/lib/fiscal/
├── catalogs/
│   ├── registry.ts         # CatalogRegistry class
│   ├── cache.ts            # Cache in-memory con TTL
│   ├── errors.ts           # CatalogNotAvailableError, CatalogIdNotInVersionError
│   ├── boot.ts             # bootFiscalModule()
│   └── types.ts            # CatalogEntry, CatalogReference
├── projection/
│   └── wsfev1.ts           # (ADR-0022)
└── snapshot.ts             # (ADR-0023)
```

Worker dedicado (cuando se promueva Sprint 2 #6 a Sprint 6+):
```
src/lib/workers/
└── catalog-refresh.ts      # Cron diario refresh + audit log
```

Tests obligatorios Sprint 6:
- Boot validation con WS mockeado fallando → module fail-closed
- Cache hit con ID válido → devuelve entry
- Cache hit con ID inválido → throw `CatalogIdNotInVersionError`
- Cache stale > 7 días → fail-closed
- Hash diferente entre versiones → audit log `system.catalog.updated`
- Snapshot persiste `catalog_version_at_emission` completo

## Estado validación

🟢 **Aprobado arquitectónicamente** — decisión interna de arquitectura.

NO requiere:
- Validación contadora (no toca regulación fiscal específica, formaliza cómo Pandora consume catálogos ARCA)
- Validación abogado (no introduce compliance nueva)
- Confirmación owner adicional (consensuado en 14-point strategic review 2026-06-02 — punto 5)

## Cómo aplicar este ADR (checklist futuro)

Antes de consumir CUALQUIER catálogo regulatorio en código Pandora:

1. ¿El catálogo está en la lista de 12 `FEParam*` del WSDL? Si no → no es catálogo regulatorio AFIP, posiblemente aplique excepción.
2. ¿Estoy importando códigos hardcodeados (ej. `const TIPOS_CBTE = [1, 6, ...]`)? Si sí → STOP, usar runtime lookup.
3. ¿Estoy persistiendo el `catalog_version_at_emission` en el snapshot? Si no → STOP.
4. ¿Hay test de boot validation que verifica fail-closed cuando catálogo no disponible? Si no → agregar.
5. ¿El catálogo está clasificado F0 crítico / F0 condicional / F1+? Si no → clasificar y documentar.

## Relación con otras decisiones

### Generaliza

- **ADR-0023** — primera aplicación específica del patrón (CondicionIVAReceptorId). ADR-0025 lo extiende a los otros 6 catálogos F0 críticos.

### Refuerza

- **ADR-0022** — Fiscal Projection Layer + fail-closed semantics (catálogos críticos fail-closed)
- **ADR-0024** — Catálogos NO se infieren con IA, vienen de WS autoritativo
- **CLAUDE.md §8.12** — Fail-closed semantics fiscal (extiende a catálogos)
- **CLAUDE.md §10** — Audit log eventos canónicos (incluye `system.catalog.updated` nuevo)

### Habilita

- **Sprint 6 fiscal** — implementación concreta del módulo `catalogs/`
- **ADR futuro multi-país** (F2+) — patrón replicable para catálogos de Chile/Uruguay/etc.

## Observabilidad asociada — eventos audit, métricas y logs

**CORRECCIÓN POST mini-auditoría 2026-06-03:** EVENT-TAXONOMY.md tiene catálogo CERRADO (regla J1) con criterio explícito de "qué va a audit vs qué va a Pino + counters" (§"Qué NO va a audit_log"). La versión previa de esta sección proponía 5 eventos audit. Tras verificar contra EVENT-TAXONOMY, solo **1 califica como audit-worthy**, los otros 4 son operativos (Pino + counters). Aplico la corrección abajo siguiendo el patrón de eventos como `system.cron.executed`, `fiscal.padron.cuit_cache_hit`, etc.

### audit_log (1 nuevo evento — agregar a EVENT-TAXONOMY §5 cuando se construya Sprint 6)

| Event name | Domain | Severity | pii_level | Cuándo |
|---|---|---|---|---|
| `system.catalog.degraded_fail_closed` | system | **critical** | internal | Cache > 7 días sin refresh exitoso → módulo fiscal fail-closed (decisión operativa crítica equivalente a `system.fiscal_emergency_stop_activated`) |

Justificación: este SÍ es audit-worthy porque es una **decisión operativa crítica** (bloqueo de emisiones) con responsabilidad de operador. Inspector AFIP o contador pueden necesitar saber por qué hubo ventana sin emisión.

### Métricas counter (3 nuevas — agregar a METRIC_WHITELIST cuando se construya Sprint 6)

| Metric | Scope | Tags | Cuándo se incrementa |
|---|---|---|---|
| `fiscal.catalog.refresh` | system | `catalog_name`, `outcome` (`updated`/`unchanged`/`failed`) | Cron diario completa intento de refresh |
| `fiscal.catalog.boot_load` | system | `catalog_name`, `outcome` (`success`/`failed`) | Boot del módulo fiscal carga un catálogo |
| `fiscal.catalog.id_lookup_miss` | tenant | `catalog_name` | Emisión solicita ID que no está en cache |

Patrón equivalente a `afip.padron.cache_hit_rate` ya existente — métricas operacionales sobre catálogos.

### Pino logs (NO audit, NO métricas) — operativos puros

| Evento operativo | Nivel Pino | Cuándo |
|---|---|---|
| Boot del módulo carga catálogo OK | `info` | Cada catálogo cargado en boot |
| Cron refresh exitoso sin cambios | `info` | Cron completa sin diff |
| Cron refresh con cambios (hash diff) | `info` con `{catalog_name, old_hash, new_hash, items_added, items_removed}` | Cuando ARCA cambió el catálogo |
| Boot failed con catálogo no disponible | `fatal` + alerta operacional | Bloqueo del módulo |
| Cache stale > 5 días sin refresh exitoso | `warn` + alerta operacional | Threshold de advertencia |
| Emisión solicita ID inválido | `error` con `{catalog_name, requested_id, available_ids_size}` | Caller (servicio de emisión) lo eleva como `CatalogIdNotInVersionError` que el handler responde 422 al UI |

### Anti-pattern explícito que se evita

`system.catalog.updated` como audit event sería equivalente a auditar `system.cron.executed` (EVENT-TAXONOMY §"Qué NO va a audit_log"). Los cambios de catálogo se reconstruyen desde `catalog_version_at_emission` de los snapshots históricos — esa es la fuente autoritativa de "qué versión usé cuándo". No necesita audit duplicado.

## Aprendizajes core

1. **Generalización post-aplicación concreta.** ADR-0023 aplicó el patrón a 1 catálogo. ADR-0025 generaliza después de ver que el patrón funciona y aplica a múltiples casos. Esto es mejor que generalizar prematuramente sin caso de uso real.

2. **WSDL como fuente autoritativa.** Cuando hay decisión sobre qué métodos existen en un WS, el WSDL es THE source of truth. Mejor que manuales (que pueden desactualizarse) y mejor que docs de terceros.

3. **Hash + timestamp + size como triada de versionado.** Cuando el WS no provee versión explícita, derivar versionado determinístico desde la respuesta. No depender de campos opcionales del WS.

4. **Fail-closed al boot, no solo al emitir.** Si catálogo crítico no carga al boot, módulo fiscal no debe arrancar siquiera. Mejor que arrancar y fallar en cada emisión.

5. **Excepciones explícitas en lista cerrada.** Catálogos LOCALES Pandora SÍ pueden hardcodearse — pero la lista de qué cuenta como "local" es cerrada (5 items). Sin esa lista cerrada, "local" se vuelve excusa para hardcodear cualquier cosa.

## Referencias

- [WSDL oficial WSFEv1](https://servicios1.afip.gov.ar/wsfev1/service.asmx?WSDL) — verificado 2026-06-02
- ADR-0022 — Fiscal Projection Layer + Snapshot
- ADR-0023 — Snapshot Fiscal Completo (primera aplicación del patrón)
- ADR-0024 — IA Boundary Policy
- ADR-0019 — Security baseline (audit log)
- CLAUDE.md §8.12 — Fail-closed semantics fiscal
- CLAUDE.md §10 — Observability Constitution (events catalog)
- EVENT-TAXONOMY.md — a actualizar con 5 nuevos eventos `system.catalog.*` y `fiscal.catalog.*`

---

**Última verificación contra fuentes oficiales:** 2026-06-02
**Próxima revisión esperada:** cuando ARCA publique nueva versión del WSFEv1 (v5.x+) o agregue nuevos métodos `FEParam*`.
