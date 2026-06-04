# Reconciliation Engine — Pandora ERP

**Versión:** v1.0.0
**Fecha:** 2026-05-27
**Estado:** Aprobado base F0
**Relacionado con:** EVENT-TAXONOMY.md (fiscal events), CORRELATION-PROPAGATION.md (trazabilidad), ADR-0004 (AFIP sincrónico), ADR-0006 (numeración fiscal), ADR-0022 (fiscal projection + fail-closed), ADR-0011 (retry serializable)

> **Sesión 3 de 3.** EVENT-TAXONOMY definió qué eventos existen. CORRELATION-PROPAGATION definió cómo se trazan end-to-end. Este documento define **cómo se resuelve la incertidumbre fiscal** — el caso donde AFIP no respondió, el CAE se perdió, el sistema quedó en estado intermedio.
>
> **El reconciliation engine es el sistema inmune del ERP.** El verdadero infierno operativo no está en emitir — está en estados inciertos, timeouts, duplicados, CAEs tardíos, retries parciales.

---

## 1. Modelo conceptual

### ¿Qué es reconciliación?

**Reconciliación = resolver la diferencia entre lo que sabemos vs lo que es real, cuando esos dos no coinciden por interrupción o ambigüedad.**

Casos canónicos F0:

| Caso | Síntoma | Pregunta a resolver |
|---|---|---|
| **CAE timeout** | AFIP no respondió en 30s | ¿AFIP autorizó la factura o no? |
| **CAE perdido** | Worker crash post-request a AFIP, antes de persistir | ¿AFIP nos dio CAE? ¿Cuál fue? |
| **CAE rechazado parcial** | AFIP devuelve "observado" (warning) | ¿Procedemos o rectificamos? |
| **MP webhook fuera de orden** | Llegan `payment.confirmed` antes que `payment.initiated` | ¿Cuál es el estado real? |
| **MP webhook duplicado** | Mismo `mp_event_id` llega 2 veces | Ignorar el segundo |
| **Banco reporta diferencia** | Banco dice cobramos $X, ERP dice $Y | ¿Quién tiene razón? (F1+) |

### ¿Qué NO es reconciliación?

- **Retries simples de transient errors.** Si AFIP devuelve timeout y reintentamos en 30s y funciona — eso es retry, no reconciliación.
- **Idempotency dedup.** Si el cliente reintenta el mismo POST con misma idempotency key — eso es dedup, no reconciliación.
- **Validación de input.** Si el payload AFIP es inválido por bug nuestro — eso es bug, no reconciliación.
- **Operator manual fixes.** Si el contador corrige manualmente un número quemado — eso es resolución manual, no reconciliación automática.

### Principios rectores

1. **Fail-closed (ADR-0022):** ante incertidumbre fiscal, NO emitir. Mejor estado intermedio que comprobante inválido.
2. **Idempotencia obligatoria (ADR-0010):** reintentar reconciliación 100 veces debe dar el mismo resultado que 1 vez.
3. **AFIP es autoridad fiscal externa (AUTHORITY-MAP):** Pandora NO decide si una factura es válida. Solo registra lo que AFIP confirma.
4. **Mejor reconciliación tardía que decisión apresurada.** El cajero puede esperar 5 min más; el contador no puede deshacer un CAE emitido mal.
5. **Toda decisión de reconciliación es auditable** (audit_log inmutable con event_name específico).

---

## 2. Estados fiscales y transiciones (overlay con Sesión 5 v4)

`fiscal_status` (ya en Sesión 5 v4 cambio #1) con flujo completo:

```
                    ┌─────────────────────────────────────┐
                    │  Estados terminales OK              │
                    │  ─ issued                           │
                    │  ─ reconciled_issued                │
                    │  ─ not_required                     │
                    └─────────────────────────────────────┘
                                  ▲
                                  │ (worker éxito post-incertidumbre)
                                  │
[not_required] ◄── (venta sin factura)
                                  │
[pending] ──── (factura solicitada)
   │
   ▼
[requesting] ──── (llamando WSFEv1)
   │
   ├──► CAE OK ──► [issued] ✅
   │
   ├──► AFIP rechazó explícito ──► [failed] ──► [manual_resolution_required]
   │
   ├──► Timeout 30s ──► [requires_reconciliation] (reconciliation engine entra)
   │                          │
   │                          ├──► worker éxito ──► [reconciled_issued] ✅
   │                          │
   │                          ├──► CAE perdido recovery ──► [reconciled_issued] ✅
   │                          │     (FECompUltimoAutorizado dice "AFIP tenía el número")
   │                          │
   │                          ├──► Worker concluye número quemado ──► [number_burned] ──► [manual_resolution_required]
   │                          │
   │                          └──► 2h sin resolver ──► [reconciliation_timeout] ──► [manual_resolution_required]
   │
   └──► AFIP servicio caído ──► [contingency] (worker reintenta cuando vuelva)
                                     │
                                     ├──► AFIP vuelve OK ──► [issued] ✅
                                     │
                                     └──► AFIP no vuelve en 2h ──► [manual_resolution_required]
```

### Estados que el reconciliation engine PROCESA

| Estado | Worker que lo procesa | Estrategia |
|---|---|---|
| `requires_reconciliation` | `afip.reconcile_pending` | Reintentar WSFEv1 + recovery CAE perdido |
| `contingency` | `afip.reconcile_pending` | Reintentar cuando AFIP vuelva |

### Estados que el reconciliation engine NO procesa (requieren operador humano)

| Estado | Por qué |
|---|---|
| `failed` | AFIP rechazó explícito por payload inválido. Hay bug que arreglar. No reintentes. |
| `manual_resolution_required` | Reconciliación dio up. Contador/operador resuelve fuera del sistema. |
| `number_burned` | Decisión técnica documentada de no reusar el número. No reintentes. |
| `reconciliation_timeout` | 2h sin éxito. Escala a `manual_resolution_required`. |

---

## 3. Worker `afip.reconcile_pending` — flujo canónico

### Anatomía

```typescript
// src/lib/workers/afip-reconcile-pending-worker.ts
import 'server-only';
import { processJobWithTracing } from './with-tracing';
import { logger } from '@/lib/logger';
import { db } from '@/lib/db/client';
import { sql, eq, and } from 'drizzle-orm';
import { sales, jobsQueue, auditLog } from '@/lib/db/schema';

const MAX_ATTEMPTS = 24;                    // 24 × 5min = 2h máximo
const ATTEMPT_INTERVAL_MS = 5 * 60 * 1000;  // 5 minutos entre intentos

export async function runAfipReconcilePendingWorker() {
  const jobs = await fetchPendingReconcileJobs({ limit: 10 });
  
  for (const job of jobs) {
    await processJobWithTracing(job, async (j) => {
      try {
        const result = await reconcileSingleInvoice(j);
        await applyReconciliationResult(j, result);
      } catch (err) {
        await markJobFailed(j.id, err);
      }
    });
  }
}

async function reconcileSingleInvoice(job: ReconcileJob): Promise<ReconcileResult> {
  const sale = await db.query.sales.findFirst({ where: eq(sales.id, job.payload.sale_id) });
  
  // 1. Verificar estado actual — si ya se resolvió por otra vía, NO procesar
  if (sale.fiscal_status === 'issued' || sale.fiscal_status === 'reconciled_issued') {
    logger.info({
      event: 'reconciliation.skip',
      reason: 'already_resolved',
      sale_id: sale.id,
      current_status: sale.fiscal_status,
    });
    return { outcome: 'already_resolved' };
  }
  
  if (sale.fiscal_status === 'manual_resolution_required') {
    logger.info({
      event: 'reconciliation.skip',
      reason: 'manual_resolution_required',
      sale_id: sale.id,
    });
    return { outcome: 'skip_manual' };
  }
  
  // 2. Verificar attempts — si llegamos al máximo, escalar
  if (job.attempts >= MAX_ATTEMPTS) {
    return { outcome: 'reconciliation_timeout' };
  }
  
  // 3. Si fue timeout previo: intentar recovery de CAE perdido PRIMERO
  if (sale.fiscal_status === 'requires_reconciliation') {
    const lostCaeResult = await tryRecoverLostCae(sale);
    if (lostCaeResult.recovered) {
      return { outcome: 'cae_recovered', cae: lostCaeResult.cae };
    }
    // Si no recuperamos, el número está libre o quemado — sigue paso 4
  }
  
  // 4. Re-intentar emisión WSFEv1
  try {
    const cae = await solicitarCAE(sale.fiscal_snapshot);
    return { outcome: 'cae_received', cae };
  } catch (err) {
    if (err instanceof AfipTimeoutError) {
      return { outcome: 'still_timeout' };  // reintentar después
    }
    if (err instanceof AfipServiceDownError) {
      return { outcome: 'service_down' };   // mantener contingency
    }
    if (err instanceof AfipRejectedError) {
      return { outcome: 'rejected', error_code: err.code };
    }
    throw err;
  }
}
```

### Aplicar resultado de reconciliación

```typescript
async function applyReconciliationResult(job: ReconcileJob, result: ReconcileResult) {
  await db.transaction(async (tx) => {
    switch (result.outcome) {
      case 'cae_received':
      case 'cae_recovered':
        await tx.update(sales)
          .set({
            fiscal_status: 'reconciled_issued',
            cae: result.cae.codigo,
            cae_expiration: result.cae.expiration,
          })
          .where(eq(sales.id, job.payload.sale_id));
        
        await tx.insert(auditLog).values({
          event_name: result.outcome === 'cae_recovered'
            ? 'fiscal.invoice.reconciled_issued'   // recovery via FECompUltimoAutorizado
            : 'fiscal.invoice.cae_received',        // retry exitoso sin recovery
          // ... resto
        });
        
        await markJobSuccess(job.id);
        await publishRealtimeUpdate(job, { new_status: 'reconciled_issued', cae: result.cae });
        break;
      
      case 'still_timeout':
      case 'service_down':
        // Reintentar en 5 min
        await tx.update(jobsQueue)
          .set({
            attempts: job.attempts + 1,
            next_attempt_at: new Date(Date.now() + ATTEMPT_INTERVAL_MS),
            status: 'pending',
            last_error: result.outcome,
          })
          .where(eq(jobsQueue.id, job.id));
        break;
      
      case 'reconciliation_timeout':
        // 2h sin éxito → escalar a manual
        await tx.update(sales)
          .set({ fiscal_status: 'manual_resolution_required' })
          .where(eq(sales.id, job.payload.sale_id));
        
        await tx.insert(auditLog).values({
          event_name: 'fiscal.invoice.reconciliation_timeout',
          severity: 'error',
          // ...
        });
        
        await tx.insert(auditLog).values({
          event_name: 'fiscal.invoice.manual_resolution_required',
          severity: 'error',
          // ...
        });
        
        await markJobDead(job.id, 'reconciliation_timeout_2h');
        await notifyOperator(job);
        break;
      
      case 'rejected':
        // AFIP rechazó explícito — bug en payload, no reintento
        await tx.update(sales)
          .set({ fiscal_status: 'failed' })
          .where(eq(sales.id, job.payload.sale_id));
        
        await tx.insert(auditLog).values({
          event_name: 'fiscal.invoice.cae_rejected',
          severity: 'error',
          payload: { error_code: result.error_code },
          // ...
        });
        
        await markJobDead(job.id, `afip_rejected_${result.error_code}`);
        await notifyOperator(job);
        break;
      
      case 'already_resolved':
      case 'skip_manual':
        // No-op — job se marca como success para limpiar la cola
        await markJobSuccess(job.id);
        break;
    }
  });
}
```

---

## 4. Recovery de CAE perdido — `FECompUltimoAutorizado` pattern

### El problema

Caso 1 (timeout sin respuesta):
1. Pandora pide CAE para venta X, número reservado = 1234
2. AFIP procesa pero la respuesta tarda > 30s (timeout HTTP del lado nuestro)
3. AFIP probablemente autorizó. **No sabemos.**

Caso 2 (worker crash):
1. Pandora pide CAE para venta X, número reservado = 1234
2. AFIP responde CAE = "12345678"
3. Antes de persistir el CAE en DB, worker crashea
4. AFIP tiene el número como autorizado. **Nosotros no.**

Si ahora intentamos emitir otra venta con número 1234 → AFIP rechaza ("número ya autorizado"). Si intentamos con número 1235 → desperdicio del 1234, hueco en la secuencia inexplicable en inspección.

### Solución: `FECompUltimoAutorizado`

WSFEv1 expone método que devuelve el **último número autorizado por AFIP** para una combinación `(PtoVta, TipoComprobante)`. Comparando con nuestro número reservado podemos saber si AFIP lo procesó.

```typescript
// src/lib/afip/wsfev1-client.ts

interface UltimoAutorizadoResponse {
  CbteNro: number;       // último número autorizado por AFIP
  PtoVta: number;
  CbteTipo: number;
}

export async function fetchUltimoAutorizado(
  ptoVta: number,
  cbteTipo: number
): Promise<UltimoAutorizadoResponse> {
  return soapCall('FECompUltimoAutorizado', { PtoVta: ptoVta, CbteTipo: cbteTipo });
}
```

### Algoritmo de recovery

```typescript
async function tryRecoverLostCae(sale: Sale): Promise<RecoveryResult> {
  const reservedNumber = sale.fiscal_snapshot.invoice_number;
  const ptoVta = sale.fiscal_snapshot.sale_point;
  const cbteTipo = sale.fiscal_snapshot.invoice_type;
  
  logger.info({
    event: 'reconciliation.cae_recovery.start',
    sale_id: sale.id,
    reserved_number: reservedNumber,
  });
  
  let ultimoAutorizado: UltimoAutorizadoResponse;
  try {
    ultimoAutorizado = await fetchUltimoAutorizado(ptoVta, cbteTipo);
  } catch (err) {
    logger.warn({
      event: 'reconciliation.cae_recovery.lookup_failed',
      sale_id: sale.id,
      error_message: err.message,
    });
    return { recovered: false, reason: 'lookup_failed' };
  }
  
  // CASO A: AFIP nunca autorizó nuestro número
  // Su último autorizado es MENOR que el nuestro → el número está libre
  if (ultimoAutorizado.CbteNro < reservedNumber) {
    logger.info({
      event: 'reconciliation.cae_recovery.number_still_free',
      sale_id: sale.id,
      reserved_number: reservedNumber,
      afip_last: ultimoAutorizado.CbteNro,
    });
    return { recovered: false, reason: 'number_free_for_retry' };
  }
  
  // CASO B: AFIP autorizó nuestro número exacto
  // Necesitamos consultar el detalle para obtener el CAE
  if (ultimoAutorizado.CbteNro === reservedNumber) {
    return await fetchAndRestoreLostCae(sale, reservedNumber, ptoVta, cbteTipo);
  }
  
  // CASO C: AFIP autorizó números POSTERIORES al nuestro
  // Esto NO debería pasar si la numeración es serializable (ADR-0006)
  // Pero defensivo por bug histórico o race
  if (ultimoAutorizado.CbteNro > reservedNumber) {
    logger.error({
      event: 'reconciliation.cae_recovery.number_anomaly',
      severity: 'critical',
      sale_id: sale.id,
      reserved_number: reservedNumber,
      afip_last: ultimoAutorizado.CbteNro,
      message: 'AFIP authorized numbers beyond our reserved — check serializable invariant',
    });
    
    // Aún así intentar recovery del nuestro
    return await fetchAndRestoreLostCae(sale, reservedNumber, ptoVta, cbteTipo);
  }
  
  return { recovered: false, reason: 'unexpected' };
}

async function fetchAndRestoreLostCae(
  sale: Sale,
  number: number,
  ptoVta: number,
  cbteTipo: number
): Promise<RecoveryResult> {
  try {
    const detalle = await soapCall('FECompConsultar', {
      CbteNro: number,
      PtoVta: ptoVta,
      CbteTipo: cbteTipo,
    });
    
    if (!detalle.CAE) {
      return { recovered: false, reason: 'no_cae_in_consultation' };
    }
    
    logger.info({
      event: 'reconciliation.cae_recovery.success',
      sale_id: sale.id,
      cae_recovered: detalle.CAE,
    });
    
    return {
      recovered: true,
      cae: {
        codigo: detalle.CAE,
        expiration: detalle.CAEFchVto,
      },
    };
  } catch (err) {
    logger.error({
      event: 'reconciliation.cae_recovery.consultation_failed',
      sale_id: sale.id,
      error_message: err.message,
    });
    return { recovered: false, reason: 'consultation_failed' };
  }
}
```

### Edge cases del recovery

| Edge case | Acción defensiva |
|---|---|
| `FECompUltimoAutorizado` timeout | Mantener `requires_reconciliation`, retry en 5min |
| `FECompConsultar` devuelve resultado sin CAE | Asumir `number_burned`, no reusar |
| AFIP devuelve número posterior al nuestro | Log critical + intentar recovery del nuestro igual + alertar |
| Detalle del comprobante no matchea (importes distintos) | Log critical + NO restaurar CAE (puede ser comprobante de otro cliente del mismo PV) + escalar manual |
| Race entre 2 workers haciendo recovery del mismo sale | Lock pesimista `FOR UPDATE` en `sales` row al inicio de `reconcileSingleInvoice` |

### Validación final post-recovery

Antes de marcar `reconciled_issued`, verificar que el detalle de AFIP **matcha** con nuestra venta:

```typescript
function validateRecoveredCae(
  ourSale: Sale,
  afipDetalle: AfipConsultarResponse
): boolean {
  // Comparar importes — si difieren, NO restaurar (puede ser comprobante de otro)
  if (afipDetalle.ImpTotal !== ourSale.fiscal_snapshot.imp_total) return false;
  if (afipDetalle.DocTipo !== ourSale.customer_snapshot.doc_tipo) return false;
  if (afipDetalle.DocNro !== ourSale.customer_snapshot.doc_nro) return false;
  // ... otras validaciones
  return true;
}
```

Si la validación falla → escalar a `manual_resolution_required` con motivo `cae_recovery_mismatch`. Operador investiga.

---

## 5. Retry semantics — backoff calibrado para AFIP

### Política F0

| Caso | Backoff |
|---|---|
| `afip.emit_invoice` (primer intento) | Inmediato |
| `afip.emit_invoice` falla con timeout | Cambia a `requires_reconciliation` (escala a `afip.reconcile_pending`) |
| `afip.reconcile_pending` retry | **Constante 5 min × 24 intentos = 2h total** |
| `afip.reconcile_pending` `service_down` | Mismo intervalo 5 min |
| AFIP rechazó explícito | **No retry** — sigue a `manual_resolution_required` |

### Por qué constante 5min y no exponential

| Approach | Pro | Contra |
|---|---|---|
| **Constante 5min (elegido)** | Predecible para el cajero ("en máximo 2h sabré"). Distribuye carga uniforme contra AFIP. Recovery rápido si AFIP volvió hace 1 min vs hace 50 min. | Más intentos totales (24 vs 8) |
| Exponential (30s → 2m → 10m → 1h → 6h) | Menos carga total | Si AFIP volvió hace 1 min pero estamos en window de 1h espera, esperamos 1h innecesario. Peor UX. |

**Caso AFIP:** los outages típicos duran 5-30 min. Backoff constante 5min recupera dentro de 5-10 min de que AFIP vuelva. Exponential haría esperar 1h.

### Ventana total 2h — por qué ese límite

- **Cajero esperando:** > 2h sin facturar es problema operativo serio
- **Contador esperando:** > 2h con venta sin CAE puede generar mismo número facturado por otro POS si no manejamos el bloqueo
- **AFIP outage típico:** < 30 min. Si está caído 2h+, es incidente que requiere acción manual (contingencia AFIP nivel país)

Después de 2h:
- `fiscal_status = 'manual_resolution_required'`
- Cajero ve banner: "Esta venta requiere intervención de tu contador. Comprobante no emitido fiscalmente."
- Dashboard del owner agrupa estos casos
- Email a contador del comerciante

---

## 6. Dead letter philosophy

### Qué llega a dead letter

`jobs_queue.status = 'dead'` cuando:

| Causa | Job | Estrategia post-mortem |
|---|---|---|
| Excedió MAX_ATTEMPTS sin éxito | `afip.reconcile_pending` (24 intentos) | Operador investiga: ¿AFIP estuvo caído realmente 2h? Verificar timestamps. |
| AFIP rechazó explícito por payload | `afip.emit_invoice` (luego de pasar a `failed`) | Bug en payload → fix de código + re-emitir manualmente |
| Crash del worker > 5 reintentos | Cualquier job | Investigar bug del worker + decidir si retry manual o descartar |
| Validation interna falla (FECompConsultar mismatch) | `afip.reconcile_pending` | Operador resuelve fuera del sistema |

### Qué NO llega a dead letter (deliberado)

- Reintentos transient esperados (timeout AFIP, network blip) — siguen como `failed` con `attempts < max`, próximo poll los retoma
- Jobs que el worker decide `skip` (ya resuelto por otra vía) — se marcan `success` sin procesar

### Qué pasa con un dead job

**Sin retry automático infinito.** Operador (vos F0) decide:

```sql
-- Query operacional: jobs dead esperando decisión
SELECT
  id,
  job_type,
  tenant_id,
  correlation_id,
  attempts,
  last_error,
  created_at,
  age(now(), created_at) AS waiting_for
FROM jobs_queue
WHERE status = 'dead'
ORDER BY created_at DESC;
```

Acciones posibles del operador:

| Acción | Cuándo | Cómo |
|---|---|---|
| **Re-enqueue** | Si el problema raíz se resolvió (ej: AFIP volvió, bug fix deployado) | `UPDATE jobs_queue SET status='pending', attempts=0, next_attempt_at=now() WHERE id=?` |
| **Discard** | Si el job ya no aplica (ej: venta cancelada) | `UPDATE jobs_queue SET status='success', last_error='discarded_by_operator' WHERE id=?` + audit log |
| **Manual fix** | Si la entidad de negocio necesita intervención (ej: número quemado, fix contable) | Operador resuelve la entidad directamente + `UPDATE jobs_queue SET status='success', last_error='resolved_manually' WHERE id=?` + audit log |

**TODA acción del operador debe quedar en audit_log** con event_name canónico (catálogo EVENT-TAXONOMY §5 v2.0.1):
- `system.dead_job.re_enqueued` — payload incluye `reason` por qué se re-enqueue
- `system.dead_job.discarded` — payload con `reason` obligatorio (ej: "venta cancelada", "entidad no aplica")
- `system.dead_job.resolved_manually` — payload con `resolution_summary` de qué se hizo fuera del sistema

Estos 3 eventos están en el catálogo F0 (35 eventos total — agregados en v2.0.1 auditoría Lote 3).

---

## 7. Poison events — detección y aislamiento

### ¿Qué es un poison event?

Job que **rompe el worker repetidamente** y bloquea el procesamiento de otros jobs detrás. Ejemplo:

- Job con payload corrupto que tira excepción al deserializar
- Job que referencia sale_id que ya no existe (DELETE post-creación)
- Job que dispara bug serio del worker (memory leak, infinite loop)

Sin manejo, este job vuelve a `pending` cada 5min y bloquea workers indefinidamente.

### Detección F0

Definimos como poison:

```typescript
function isPoisonJob(job: JobRecord): boolean {
  return (
    job.attempts >= 3 &&
    job.last_error !== null &&
    isPoisonError(job.last_error)
  );
}

function isPoisonError(errorMessage: string): boolean {
  // Patterns específicos que indican datos corrupted o bugs sistemáticos,
  // NO errores transient (timeouts, network blips, AFIP down) que sí merecen retry.
  const poisonPatterns = [
    /payload deserialization failed/i,           // payload JSON corrupto
    /SyntaxError.*JSON/i,                         // JSON.parse failed
    /referenced sale_id .* not found/i,           // entidad referida fue eliminada (no genérico "not found")
    /Zod validation failed/i,                     // payload no matcha schema esperado
    /assertion failed/i,                          // invariante de código violada
    /invariant violation: fiscal/i,               // invariante fiscal específica (ADR-0022)
    /unknown job_type/i,                          // job_type fuera del catálogo cerrado
  ];
  // NOTA: "database constraint violation" se excluyó como pattern poison —
  // puede ser race condition legítima que retry resuelve (ej: UNIQUE conflict).
  // Patterns conservadores → false negative tolerable (job sigue retry hasta MAX_ATTEMPTS).
  return poisonPatterns.some(p => p.test(errorMessage));
}
```

### Acción

Si detectado como poison:

1. Marcar `status = 'dead'` inmediatamente (no esperar 5 reintentos)
2. Insertar audit `system.poison_job_detected` con severity `error`
3. Notificar operador
4. NO bloquear procesamiento de otros jobs

```typescript
async function processJobWithPoisonDetection(job: JobRecord, processor: Function) {
  try {
    await processor(job);
    await markJobSuccess(job.id);
  } catch (err) {
    const updatedJob = { ...job, last_error: err.message, attempts: job.attempts + 1 };
    
    if (isPoisonJob(updatedJob)) {
      logger.error({
        event: 'reconciliation.poison_job_detected',
        severity: 'error',
        job_id: job.id,
        job_type: job.job_type,
        attempts: updatedJob.attempts,
        error_message: err.message,
      });
      
      await markJobDead(job.id, `poison: ${err.message}`);
      await notifyOperator(job);
    } else {
      await markJobFailed(job.id, err);
    }
  }
}
```

### Por qué no Quarantine Queue separada

F1+: cuando aparezca patrón real, mover poison a tabla separada `jobs_queue_quarantine` para análisis offline. F0 con marca `'dead'` + `last_error` informativo alcanza.

---

## 8. Idempotency en reconciliación

### Garantías

Reconciliación es **idempotente por construcción**:

| Operación | Idempotencia |
|---|---|
| Pedir CAE | Idempotency key `{sale_id}-{attempt}` → AFIP dedup por nuestro número de comprobante |
| Recovery CAE | Read-only en AFIP (FECompUltimoAutorizado, FECompConsultar) → safe para reintentar N veces |
| Persistir resultado | Lock pesimista en `sales` row + check de estado antes de update |
| Insertar audit_log | UNIQUE constraint `(tenant_id, idempotency_key)` para events que tienen key |
| Marcar job success/dead | UPDATE de single row, idempotente naturalmente |

### Race conditions evitadas

#### Race 1: dos workers procesan mismo job

`SELECT ... FOR UPDATE SKIP LOCKED` al fetchear pending jobs (ya en EVENT-TAXONOMY §3 Regla J2 implícita). Sin esto, dos workers podrían tomar el mismo job y duplicar requests a AFIP.

#### Race 2: worker procesando + operador re-enqueue

```sql
-- Operador re-enqueue mientras worker corre:
-- Worker tenía FOR UPDATE → operador espera (o si usa diferente conexión, transacción se rolloutea)
-- Si operador queda con UPDATE antes que worker → next_attempt_at en futuro evita doble procesamiento
```

#### Race 3: recovery CAE + emisión nueva al mismo número

Lock pesimista en `invoice_sequences` (ya ADR-0006). Si worker_A está haciendo recovery del número 1234, worker_B intentando emitir nueva no puede tomar 1234 hasta que worker_A libere el lock. Si worker_A confirma que AFIP autorizó 1234 → marca como issued, worker_B sigue con 1235.

---

## 9. Integración con audit_log — cada decisión es auditable

Eventos canónicos durante reconciliación (ya en EVENT-TAXONOMY §5):

```
sale.completed                            ← venta comercial
fiscal.invoice.cae_received               ← happy path
  O
fiscal.invoice.requires_reconciliation    ← timeout, entra al engine
  fiscal.invoice.reconciled_issued        ← recovery exitoso O
  fiscal.invoice.number_burned            ← decisión técnica O
  fiscal.invoice.reconciliation_timeout   ← 2h sin éxito O
  fiscal.invoice.manual_resolution_required ← terminal
```

**Cada transición de estado** del worker genera audit event. **Cada call a AFIP** (sea exitoso o no) genera Pino log con correlation_id + request_id (no audit, es trace operativo).

### Anti-pattern explícito

```typescript
// ❌ MAL — silent transition sin audit
await db.update(sales).set({ fiscal_status: 'reconciled_issued' });

// ✅ BIEN — transición + audit en misma tx
await db.transaction(async (tx) => {
  await tx.update(sales).set({ fiscal_status: 'reconciled_issued', cae });
  await tx.insert(auditLog).values({
    event_name: 'fiscal.invoice.reconciled_issued',
    payload: { cae, recovered_via: 'FECompConsultar' },
    // ...
  });
});
```

---

## 10. Realtime updates al cliente

Cuando se resuelve una reconciliación (éxito o terminal), publicar broadcast con `correlation_id` para que el cliente actualice UI:

```typescript
async function publishReconciliationResolved(job: ReconcileJob, result: ReconcileResult) {
  const sale = await db.query.sales.findFirst({ where: eq(sales.id, job.payload.sale_id) });
  
  await supabase.channel(`tenant:${sale.tenant_id}:sales`).send({
    type: 'broadcast',
    event: 'sale.fiscal_status_changed',
    payload: {
      sale_id: sale.id,
      new_status: sale.fiscal_status,
      cae: sale.cae ?? null,
      correlation_id: job.correlation_id,  // cliente filtra por su operación
      resolution: result.outcome,           // 'cae_received' | 'cae_recovered' | 'reconciliation_timeout' | ...
      emitted_at: new Date().toISOString(),
    },
  });
}
```

### Cliente recibiendo

Si el cliente tiene el POS abierto y el `correlation_id` activo en `sessionStorage` (ver CORRELATION-PROPAGATION.md §5.5):

```typescript
useCorrelationFilteredBroadcast(
  `tenant:${tenantId}:sales`,
  'sale.fiscal_status_changed',
  operationCorrelationId,
  (payload) => {
    if (payload.resolution === 'cae_received' || payload.resolution === 'cae_recovered') {
      showToast({ message: `Factura emitida — CAE: ${payload.cae}` });
      navigateToInvoice(payload.sale_id);
    } else if (payload.resolution === 'reconciliation_timeout') {
      showCriticalDialog({
        title: 'Factura pendiente',
        message: 'No se pudo emitir la factura. Tu contador necesita resolver manualmente.',
      });
    }
  }
);
```

### Cliente cerró el browser (no recibe broadcast)

Próxima vez que abra el POS y cargue la venta:

```typescript
async function loadSaleDetail(saleId: string) {
  const sale = await fetchSale(saleId);
  // sale.fiscal_status ya refleja la resolución actual desde el server
  // El broadcast que se perdió no importa — el estado real está en DB
}
```

Consistente con regla de CORRELATION-PROPAGATION: el cliente NO es source of truth post-cierre.

---

## 11. Operator tooling F0

### Queries operacionales canónicas

#### Q1: Jobs pendientes de reconciliación

```sql
SELECT
  j.id AS job_id,
  j.tenant_id,
  j.payload->>'sale_id' AS sale_id,
  j.attempts,
  j.next_attempt_at,
  age(now(), j.created_at) AS waiting_for,
  s.fiscal_status,
  s.cae
FROM jobs_queue j
JOIN sales s ON s.id = (j.payload->>'sale_id')::uuid
WHERE j.job_type = 'afip.reconcile_pending'
  AND j.status IN ('pending', 'failed')
ORDER BY j.created_at;
```

#### Q2: Ventas que requieren intervención manual

```sql
SELECT
  s.id AS sale_id,
  s.tenant_id,
  c.name AS customer_name,
  s.total,
  s.created_at,
  age(now(), s.created_at) AS waiting_for,
  s.fiscal_status,
  s.correlation_id
FROM sales s
LEFT JOIN customers c ON c.id = s.customer_id
WHERE s.fiscal_status IN (
  'manual_resolution_required',
  'reconciliation_timeout',
  'number_burned',
  'failed'
)
ORDER BY s.created_at DESC;
```

#### Q3: Investigación de operación específica (todo lo asociado a una venta)

```sql
-- Dada un sale_id, mostrar trazabilidad completa via correlation_id
WITH sale_corr AS (
  SELECT correlation_id FROM sales WHERE id = $1
)
SELECT
  'sale' AS source,
  occurred_at,
  '' AS event_name,
  jsonb_build_object('fiscal_status', s.fiscal_status) AS payload
FROM sales s
WHERE id = $1

UNION ALL

SELECT
  'audit' AS source,
  occurred_at,
  event_name,
  payload
FROM audit_log a
JOIN sale_corr sc USING (correlation_id)

UNION ALL

SELECT
  'job' AS source,
  created_at AS occurred_at,
  job_type AS event_name,
  jsonb_build_object(
    'status', status,
    'attempts', attempts,
    'last_error', last_error,
    'last_request_id', last_request_id
  ) AS payload
FROM jobs_queue j
JOIN sale_corr sc USING (correlation_id)

ORDER BY occurred_at;
```

#### Q4: Dead jobs por análisis

```sql
SELECT
  job_type,
  COUNT(*) AS count,
  array_agg(DISTINCT substring(last_error, 1, 100)) AS error_samples
FROM jobs_queue
WHERE status = 'dead'
  AND created_at > now() - interval '7 days'
GROUP BY job_type
ORDER BY count DESC;
```

### Dashboards operativos F0.5

Tabla simple en pantalla admin de Pandora (no cliente final):

| Tab | Contenido |
|---|---|
| **Reconciliación activa** | Q1 — jobs en proceso |
| **Requieren intervención** | Q2 — ventas esperando contador |
| **Dead jobs** | Q4 — análisis de fallas |
| **Investigar venta** | Input sale_id → ejecuta Q3 |

F0.5 — implementar tras MVP del POS. F0 directo: queries SQL en herramienta de admin (vos directamente).

---

## 12. Tests obligatorios

### T1 — CAE recovery happy path

```typescript
it('recovers lost CAE when AFIP confirms our number was authorized', async () => {
  const sale = await createTestSale({ fiscal_status: 'requires_reconciliation' });
  
  // Mock AFIP: dice que nuestro número fue autorizado
  mockAfip.fetchUltimoAutorizado = vi.fn().mockResolvedValue({
    CbteNro: sale.fiscal_snapshot.invoice_number,
    PtoVta: sale.fiscal_snapshot.sale_point,
    CbteTipo: sale.fiscal_snapshot.invoice_type,
  });
  mockAfip.fetchDetalle = vi.fn().mockResolvedValue({
    CAE: '12345678',
    CAEFchVto: '20260615',
    ImpTotal: sale.fiscal_snapshot.imp_total,
    DocTipo: sale.customer_snapshot.doc_tipo,
    DocNro: sale.customer_snapshot.doc_nro,
  });
  
  await runAfipReconcilePendingWorker();
  
  const updated = await db.query.sales.findFirst({ where: eq(sales.id, sale.id) });
  expect(updated.fiscal_status).toBe('reconciled_issued');
  expect(updated.cae).toBe('12345678');
  
  const auditEvent = await db.query.auditLog.findFirst({
    where: and(
      eq(auditLog.event_name, 'fiscal.invoice.reconciled_issued'),
      eq(auditLog.correlation_id, sale.correlation_id),
    ),
  });
  expect(auditEvent).toBeDefined();
});
```

### T2 — Number burned scenario

```typescript
it('marks number as burned when AFIP authorized beyond and detail does not match', async () => {
  const sale = await createTestSale({ 
    fiscal_status: 'requires_reconciliation',
    fiscal_snapshot: { ..., imp_total: '1000.00' },
  });
  
  mockAfip.fetchUltimoAutorizado.mockResolvedValue({ CbteNro: sale.fiscal_snapshot.invoice_number });
  mockAfip.fetchDetalle.mockResolvedValue({
    CAE: '99999999',
    ImpTotal: '2000.00',  // ← NO matcha
  });
  
  await runAfipReconcilePendingWorker();
  
  const updated = await db.query.sales.findFirst({ where: eq(sales.id, sale.id) });
  expect(updated.fiscal_status).toBe('manual_resolution_required');
  
  // Verificar audit event con motivo
  const audit = await db.query.auditLog.findFirst({
    where: eq(auditLog.event_name, 'fiscal.invoice.manual_resolution_required'),
  });
  expect(audit.payload.reason).toBe('cae_recovery_mismatch');
});
```

### T3 — Reconciliation timeout (2h sin éxito)

```typescript
it('escalates to manual_resolution_required after MAX_ATTEMPTS', async () => {
  const sale = await createTestSale({ fiscal_status: 'requires_reconciliation' });
  const job = await createReconcileJob(sale, { attempts: 23 });  // 1 attempt away from max
  
  mockAfip.solicitarCAE.mockRejectedValue(new AfipTimeoutError());
  
  await runAfipReconcilePendingWorker();
  
  const updatedJob = await db.query.jobsQueue.findFirst({ where: eq(jobsQueue.id, job.id) });
  expect(updatedJob.status).toBe('dead');
  expect(updatedJob.last_error).toContain('reconciliation_timeout_2h');
  
  const updatedSale = await db.query.sales.findFirst({ where: eq(sales.id, sale.id) });
  expect(updatedSale.fiscal_status).toBe('manual_resolution_required');
});
```

### T4 — Race condition: dos workers no procesan mismo job

```typescript
it('uses SKIP LOCKED to prevent double processing', async () => {
  const sale = await createTestSale({ fiscal_status: 'requires_reconciliation' });
  await createReconcileJob(sale);
  
  let afipCallCount = 0;
  mockAfip.solicitarCAE.mockImplementation(async () => {
    afipCallCount++;
    await sleep(100);
    return { CAE: '11111111' };
  });
  
  // Correr dos workers en paralelo
  await Promise.all([
    runAfipReconcilePendingWorker(),
    runAfipReconcilePendingWorker(),
  ]);
  
  // AFIP debe haber sido llamado UNA sola vez (SKIP LOCKED garantiza)
  expect(afipCallCount).toBe(1);
});
```

### T5 — Poison job detection

```typescript
it('marks job as dead immediately when error is poison pattern', async () => {
  const job = await createReconcileJob(testSale, {
    attempts: 3,
    last_error: 'payload deserialization failed: unexpected end of JSON',
  });
  
  mockAfip.solicitarCAE.mockRejectedValue(new Error('payload deserialization failed: ...'));
  
  await runAfipReconcilePendingWorker();
  
  const updated = await db.query.jobsQueue.findFirst({ where: eq(jobsQueue.id, job.id) });
  expect(updated.status).toBe('dead');
  expect(updated.last_error).toContain('poison');
});
```

---

## 13. Anti-patterns

### ❌ Reintentar `failed` (AFIP rechazó explícito) automáticamente

Si AFIP devolvió error de payload (CUIT inválido, monto fuera de rango, etc.), reintentar es:
- Loop infinito (mismo error)
- Waste de calls AFIP (potencial rate limit)
- Falsa sensación de "lo estoy resolviendo"

**Correcto:** `failed` → `manual_resolution_required` con audit + notificación operador.

### ❌ Auto-retry sin límite de tiempo

```typescript
// MAL
while (true) {
  const result = await tryAfip();
  if (result.success) break;
  await sleep(5000);
}
```

Bloquea worker. Sin window de "después de 2h escalo a manual". Atrapado para siempre si AFIP queda mal por días.

**Correcto:** MAX_ATTEMPTS = 24 con intervalo 5min = 2h. Después escala.

### ❌ Restaurar CAE sin validar matches

```typescript
// MAL — confiar ciegamente en FECompConsultar
const detalle = await consultarCAE(numero);
if (detalle.CAE) {
  await db.update(sales).set({ cae: detalle.CAE });  // ❌ puede ser CAE de OTRO comprobante
}
```

El número de comprobante en (PtoVta, CbteTipo) es único por tenant. Pero si hay bug y se duplican workers, podríamos restaurar CAE de un comprobante de otro tenant del mismo PtoVta.

**Correcto:** validar ImpTotal + DocTipo + DocNro antes de restaurar.

### ❌ Reconciliation engine sin idempotencia

```typescript
// MAL — sin lock, race condition
async function reconcile(saleId) {
  const sale = await fetchSale(saleId);
  if (sale.fiscal_status !== 'requires_reconciliation') return;
  
  const cae = await getCaeFromAfip();
  await db.update(sales).set({ cae, fiscal_status: 'reconciled_issued' });
}
```

Si 2 workers entran al mismo tiempo, ambos hacen request a AFIP, ambos updates. Doble request + race en update.

**Correcto:** `SELECT ... FOR UPDATE` + check de estado al inicio de la transacción.

### ❌ Worker silencioso

```typescript
// MAL — sin logs
catch (err) {
  job.attempts++;
  await save(job);
}
```

Cuando aparece bug en producción, no podés debuggear.

**Correcto:** log estructurado con correlation_id, request_id, error, contexto.

### ❌ Tratar reconciliation engine como pub/sub

```typescript
// MAL — fan-out implícito
await enqueueJob('sale.fiscal_resolved', { saleId });
// Otro worker consume y dispara email + WhatsApp + analytics
```

Violación de Regla J3 de EVENT-TAXONOMY (no fan-out implícito). El worker de reconciliation hace lo que tiene que hacer y NADA MÁS. Si hay que enviar email, lo enqueue explícitamente como `email.send`.

---

## 14. Métricas obligatorias

Agregar a `METRIC_WHITELIST`:

```typescript
'reconciliation.attempts_per_sale': {
  scope: 'tenant',
  allowedTagKeys: [],
  cardinalityWarn: 1,
},
'reconciliation.outcome': {
  scope: 'tenant',
  allowedTagKeys: ['outcome'],
  allowedValues: {
    outcome: ['cae_received', 'cae_recovered', 'reconciliation_timeout', 'manual_required', 'rejected'],
  },
  cardinalityWarn: 5,
},
'reconciliation.duration_seconds_p95': {
  scope: 'tenant',
  allowedTagKeys: [],
  cardinalityWarn: 1,
},
'reconciliation.poison_jobs_detected': {
  scope: 'system',
  allowedTagKeys: ['job_type'],
  cardinalityWarn: 10,
},
'reconciliation.dead_jobs_waiting': {
  scope: 'tenant',
  allowedTagKeys: ['job_type'],
  cardinalityWarn: 10,
},
```

### Alertas

| Métrica | Alert |
|---|---|
| `reconciliation.outcome` `manual_required` > 5/día por tenant | Revisar — algo sistémico mal |
| `reconciliation.outcome` `reconciliation_timeout` > 1/día | AFIP outage real o bug nuestro |
| `reconciliation.poison_jobs_detected` > 0/día | Bug crítico — investigar inmediato |
| `reconciliation.dead_jobs_waiting` > 10 sin atender | Operator olvidó procesar |
| `reconciliation.attempts_per_sale` p95 > 10 | AFIP problemas sostenidos |

---

## 15. Evolution Path F1+/F2+

### F1+ — Quarantine queue separada

Cuando poison jobs aparezcan con frecuencia, mover a tabla separada `jobs_queue_quarantine` para análisis offline sin contaminar la cola principal.

### F1+ — Operator tooling UI

Dashboard web (no SQL queries) con:
- Vista de reconciliación activa
- Botones para re-enqueue / discard / resolve
- Búsqueda por correlation_id / sale_id
- Filtros y exports

### F1+ — Notificaciones proactivas

Email/WhatsApp al contador del comerciante cuando una venta queda en `manual_resolution_required` por > 4h.

### F2+ — Multi-region failover

Si Pandora escala a otra región (improbable), reconciliación cross-region.

### F2+ — Machine learning para predecir CAE rejection

Modelo que detecta patrones de payload propenso a rechazo (CUIT con histórico problemático, montos inusuales, etc.) y alerta antes de enviar.

### F2+ — Bot Telegram/Slack para alertas críticas

Operador on-call recibe push cuando aparecen dead jobs o poison events.

---

## 16. Resumen operativo

### Reglas absolutas

1. **Fail-closed:** ante duda fiscal, NO emitir. Estado intermedio mejor que comprobante inválido.
2. **AFIP es autoridad fiscal externa.** Pandora registra, no decide.
3. **Idempotencia obligatoria.** Reintento N veces = mismo resultado.
4. **SKIP LOCKED en workers.** Cero double-processing.
5. **MAX_ATTEMPTS 24 + 5min intervalo = 2h ventana.** Después escala manual.
6. **Recovery CAE con validación de matches.** ImpTotal + DocTipo + DocNro deben coincidir.
7. **Poison detection inmediata.** No esperar 5 reintentos.
8. **Toda decisión auditable.** audit_log con event_name canónico.
9. **AFIP `failed` (rechazo explícito) NO se retry.** Bug → fix → re-emitir manual.
10. **Operator tooling es F0 vía SQL, F1+ con UI.**

### Implementación priorizada

| Componente | Cuándo |
|---|---|
| `src/lib/workers/afip-reconcile-pending-worker.ts` | 🔴 F0 antes de primer cliente productivo |
| `src/lib/afip/recovery.ts` (FECompUltimoAutorizado + FECompConsultar) | 🔴 F0 misma sesión |
| `validateRecoveredCae()` matching | 🔴 F0 misma sesión |
| Poison detection en `processJobWithPoisonDetection()` | 🔴 F0 |
| 5 tests obligatorios (T1-T5) | 🔴 F0 antes de deploy |
| Queries operacionales Q1-Q4 | 🔴 F0 disponibles antes de primer cliente |
| Métricas reconciliation.* en whitelist | 🔴 F0 |
| Dashboard operator (Q1-Q4 en UI) | 🟡 F0.5 |
| Notificaciones automáticas a contador | 🟡 F1+ |
| Quarantine queue separada | 🟡 F1+ |

---

## Relacionado con

- [EVENT-TAXONOMY.md](EVENT-TAXONOMY.md) — eventos fiscales (sección 5 domain `fiscal`), reglas jobs_queue (J1-J6)
- [CORRELATION-PROPAGATION.md](CORRELATION-PROPAGATION.md) — tracing del worker, request_id por attempt, correlation_id heredado
- [DECISION-LEDGER.md](DECISION-LEDGER.md) — entry "Sesión 3 — RECONCILIATION-ENGINE v1.0.0"
- [AUTHORITY-MAP.md](AUTHORITY-MAP.md) — autoridades de reconciliación
- ADR-0004 — AFIP sincrónico con timeout 30s + reconciliación async (este doc lo formaliza)
- ADR-0006 — Numeración fiscal SELECT FOR UPDATE (base del recovery)
- ADR-0010 — Idempotency (base de retries)
- ADR-0011 — Retry serializable
- ADR-0019 — Fail-closed semantics
- ADR-0022 — Fiscal Projection Layer + Circuit breakers + Monotonic sequencing

---

## Cierre de las 3 sesiones de spec arquitectónica

Esta es **Sesión 3 de 3**. Con EVENT-TAXONOMY + CORRELATION-PROPAGATION + RECONCILIATION-ENGINE, la arquitectura tiene:

✅ **Lenguaje canónico de eventos** (qué pasa en el sistema)
✅ **Tracing end-to-end** (cómo seguir una operación)
✅ **Resolución de incertidumbre fiscal** (cómo recuperar de fallas)

Esto cierra el trabajo de spec de "los 3 sistemas críticos que normalmente destruyen ERPs":
- Auditabilidad ✅
- Debuggability ✅
- Reconciliación ✅

**Próximo paso lógico (actualizado 2026-05-28 auditoría Lote 3):** spec arquitectónica completa, **PERO 2 hallazgos críticos posteriores (2026-05-27 PM) BLOQUEAN código fiscal productivo:**

- 🔴 **Hallazgo #1** — "Ticket no fiscal post-2h" NO es fallback válido WSFEv1 (fuente oficial ARCA). Modelo de "constancia provisoria" pendiente A-2 contador + B-6 abogado. **Bloquea código de reconciliación.**
- 🔴 **Hallazgo #2** — Ley 27.743 Transparencia Fiscal obligatoria desde 2025. Texto literal + estructura visual pendiente A-11 contador. **Bloquea primer ticket impreso productivo.**

Acción mientras tanto:
- Validaciones humanas con contador TDF (preguntas A-1, A-2, A-4, A-6 a A-11 en `reunion-contador-y-abogado.md` Parte A)
- Validaciones con abogado AAIP (preguntas B-1 a B-10 Parte B)
- Setup técnico del repo en WSL puede arrancar EN PARALELO (multi-tenant + auth + audit_log + Drizzle schema base no fiscal)
- **NO escribir código de reconciliación fiscal hasta cerrar A-2 + B-6.**

NO hay más sesiones de spec planificadas. Si aparece necesidad de spec adicional durante código, se documenta entonces, no antes.
