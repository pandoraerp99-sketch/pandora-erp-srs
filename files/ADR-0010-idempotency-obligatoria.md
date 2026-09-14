# ADR-0010 — Idempotencia obligatoria en mutaciones públicas

**Fecha:** 2026-05-17
**Estado:** Aprobado

## Contexto

En POS, una venta puede dispararse dos veces por:
- Doble click del cajero impaciente.
- Reintento por timeout de red.
- Bug del frontend que reenvía request.

Sin idempotencia, esto genera duplicados: doble venta, doble cobro, doble factura.

## Decisión

**Toda mutación crítica requiere header `Idempotency-Key: <uuid>` generado por el cliente. Tabla `idempotency_log` append-only con UNIQUE en la key. Retorna resultado cacheado en reintento.**

Schema:

```sql
CREATE TABLE idempotency_log (
  id bigserial PRIMARY KEY,
  company_id uuid NOT NULL,
  idempotency_key uuid NOT NULL,
  operation text NOT NULL,
  request_hash text NOT NULL,
  result jsonb NOT NULL,
  status int NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(company_id, idempotency_key)
);
```

Flujo:

1. Cliente genera UUID y lo envía como header.
2. Server intenta INSERT en `idempotency_log`.
3. Si succeed: procesa operación, guarda resultado.
4. Si fail (duplicate key): devuelve resultado anterior.

**Operaciones que requieren Idempotency-Key:**
- Crear venta.
- Procesar pago.
- Anular venta.
- Cerrar turno.
- Crear factura.
- Cualquier mutación facturable o con efecto en stock/caja/AFIP.

**Retención:** 90 días hot, después archivado a S3 + índice consultable (Sesión 3.5).

**Política de borde de TTL:**
- < 6 meses: idempotente garantizada.
- 6-12 meses: best-effort (lookup en archive).
- > 12 meses: no garantía. Cliente debe regenerar key.

## Alternativas rechazadas

- **Idempotencia opcional:** rechazado. Si no es obligatoria, devs olvidan, bugs en producción.
- **Idempotency generada por server:** rechazado. El cliente sabe cuándo retiene la operación; el server no.

## Consecuencias

**Positivas:**
- Cero duplicados garantizados.
- Recovery de timeouts de red sin pánico.
- Audit log claro de reintentos.

**Negativas:**
- Cliente debe generar UUID y persistirlo localmente hasta confirmar éxito.
- Validación extra en cada mutación crítica (sub-milisegundo).

**Riesgos a monitorear:**
- `idempotency_log` crece linealmente. Mitigación: cleanup mensual + archive a S3.

---

## Actualización 2026-06-25 — Implementación reserve-first (Sprint 5)

> Esta sección documenta cómo se implementó realmente el primitivo y en qué
> **se desvía del schema/flujo originales de arriba** (CLAUDE.md §22.8 — no se
> deja un doc contradiciendo el código en silencio).

### Patrón: reserve-first (refina el flujo original)

El flujo original ("INSERT → si succeed, procesá y guardá resultado") es
ambiguo respecto del orden. La implementación lo fija en **reserve-first**:

1. **Clamar** la key: `INSERT status='pending'` (auto-commit). Reserva atómica
   vía el UNIQUE y la hace **visible de inmediato** a duplicados concurrentes.
2. **Ejecutar** la operación (`fn`).
3. **Completar**: `UPDATE result + status='completed'`.

**Por qué importa:** para mutaciones con efectos externos **no-rollbackeables**
(emisión de CAE, Sprint 6), un do-then-insert dejaría que dos duplicados
concurrentes ejecuten AMBOS el side effect antes de que el UNIQUE elija
ganador. Reserve-first hace que el perdedor vea `'pending'` y **no ejecute**.

### Desviación del schema original (`result NOT NULL` → nullable + `status`)

El schema de arriba especifica `result jsonb NOT NULL` + `status int`. Es
**incompatible con reserve-first**: al clamar la key todavía no existe el
result. Schema real implementado (`drizzle/migrations/post_initial/0014_idempotency_log.sql`):

- `result jsonb` **NULLABLE** (NULL mientras `pending`).
- `status text` **`'pending' | 'completed'`** (CHECK), no `int`.
- `completed_at timestamptz` + CHECK que ata `completed_at ⟺ status='completed'`.
- `tenant_id uuid` (no `company_id`) + PK `uuid` (no `bigserial`) — convención del repo.
- `idempotency_key uuid`, FK `tenant_id → companies(id) ON DELETE RESTRICT`, **RLS** (3 policies authenticated; helper corre privileged + filtra por tenant_id).

### Scope angosto

Dedupea **requests duplicados**. NO hace recovery de crash-mid-operación (eso
es la Reconciliation Engine, Sprint 7). Un row `'pending'` huérfano (fn falló /
proceso murió) es **aceptable F0**: el cliente reintenta con key NUEVA. No se
libera la key en error (liberarla reintroduciría el doble-side-effect).

### Estado real (honesto)

- ✅ **Primitivo `withIdempotency()` construido y verificado**: helper en
  `src/lib/idempotency/idempotency.ts` + 6 tests de concurrencia contra DB real
  (`tests/integration/T-IDEMP-01-reserve-first.test.ts`, todos verde).
- ⚠️ **NINGUNA mutación llama `withIdempotency` todavía.** La obligación de esta
  ADR ("toda mutación crítica requiere idempotency") sigue **ABIERTA**. El
  payoff es **Sprint 6** (envolver la emisión de CAE). El wiring de mutaciones
  F0 (finalizeSale/cobro) queda pendiente — `finalizeSale` ya tiene idempotencia
  natural vía state machine (2do finalize → StateTransitionError), así que
  envolverlo es baja prioridad y no cierra un bug.

### Diferido / no implementado F0

- **Cleanup cron** de `idempotency_log` (rows acumulan, incl. pending huérfanos).
  Aceptable F0/5 tenants. Trigger: > 30 tenants O volumen.
- Retención 90d hot + archive S3 + política de borde TTL (6/12 meses): F1+.
