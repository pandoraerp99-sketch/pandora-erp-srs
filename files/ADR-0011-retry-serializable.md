# ADR-0011 — Retry policy para fallos de serialización

**Fecha:** 2026-05-17
**Estado:** Aprobado

## Contexto

Las transacciones serializables en SaleService.create() y operaciones de Inventory garantizan consistencia pero, bajo concurrencia real, PostgreSQL devuelve errores 40001 (serialization failure) y 40P01 (deadlock detected).

Sin política de retry, esos errores se propagan al usuario como "venta fallida aleatoria" en momentos de carga normal (varios cajeros simultáneos, hot stock products).

Este ADR es respuesta al hallazgo bloqueante de auditoría externa (Sesión 3.5).

## Decisión

**Retry automático con backoff exponencial corto en todas las operaciones del hot path que usan isolation serializable.**

**Política:**

- **Máximo 3 intentos** por operación.
- **Backoff exponencial corto:** 50ms, 150ms, 400ms entre intentos.
- **Códigos retryables:**
  - `40001` (serialization_failure)
  - `40P01` (deadlock_detected)
- **Otros errores:** NO retry. Propagar inmediatamente.
- **Idempotency key obligatoria:** garantizada por ADR-0010.
- **Después de 3 intentos fallidos:** error explícito al usuario.

**Implementación canónica:**

```typescript
// src/lib/db/retry.ts

const SERIALIZATION_ERROR_CODES = ['40001', '40P01'];
const MAX_RETRIES = 3;
const BACKOFF_MS = [50, 150, 400];

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
      if (attempt > 0) {
        metrics.increment('serialization_retry_succeeded', { operation, attempts: attempt + 1 });
      }
      return { result, retryMetadata: { attempts: attempt + 1, totalDurationMs: Date.now() - startTime } };
    } catch (err: any) {
      lastError = err;
      if (!SERIALIZATION_ERROR_CODES.includes(err.code)) throw err;
      if (attempt < MAX_RETRIES - 1) {
        await sleep(BACKOFF_MS[attempt]);
      }
    }
  }

  metrics.increment('serialization_retry_exhausted', { operation });
  throw new SerializationRetryExhaustedError(operation, MAX_RETRIES, lastError);
}
```

**Operaciones que DEBEN usar withSerializationRetry():**

- SaleService.create()
- SaleService.cancel()
- InvoiceService.issue()
- InventoryService.adjustStock()
- InventoryService.transfer()
- CashSessionService.close()
- CashSessionService.open()
- Cualquier operación con `transaction()` y isolation serializable.

## Alternativas rechazadas

- **Sin retry:** rechazado. Hallazgo bloqueante de auditoría externa. Bajo carga normal, genera ventas fallidas aleatorias.
- **Retry infinito:** rechazado. Esconde problemas reales de contención.
- **Backoff largo (1s, 5s, 15s):** rechazado. POS necesita respuesta < 2s, no podemos esperar segundos.
- **Lock global pesimista:** rechazado. Mata throughput.
- **Isolation level read committed:** rechazado. Pierde garantías de consistencia.

## Consecuencias

**Positivas:**
- Sistema robusto bajo concurrencia normal.
- Conflictos transientes invisibles para el usuario.
- Métricas observables (`serialization_retry_succeeded`, `serialization_retry_exhausted`).

**Negativas:**
- Latencia adicional en peor caso (50+150+400ms = 600ms extra).
- Devs deben envolver toda operación serializable.

**Riesgos a monitorear:**
- `serialization_retry_exhausted_rate > 1%` por 15 min = critical alert.
- `serialization_retry_succeeded_rate > 5%` por 15 min = warning (indica contención excesiva).

## Triggers de re-evaluación

- Retry exhausted > 1% sostenido.
- Latencia p99 con retries > 5s.
- Consideración de migrar a isolation read committed con app-level locks.
