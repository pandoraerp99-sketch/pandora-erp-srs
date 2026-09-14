# Event Taxonomy F0 — Pandora ERP

**Versión:** v2.1.0
**Fecha:** 2026-05-27 (creación) · 2026-05-28 (auditoría Lote 3) · 2026-05-30 (auditoría focal pre-migración) · 2026-07-13 (ADR-0026) · 2026-09-14 (plata y acceso)
**Reemplaza:**
- v1.0.0 — enterprise scope original (archivada conceptualmente en §11 "Evolution Path")
- v2.0.0 — simplificación F0 inicial (mismo día); 4 fixes técnicos aplicados para v2.0.1: PK metrics_counter sin COALESCE + cleanup partitioning + jobs_queue 6 reglas J1-J6 + metrics whitelist
- v2.0.1 — post-auditoría Lote 3: catálogo job_types unificado con CLAUDE.md/BOUNDED-CONTEXTS, dedupe reglas operativas, 3 eventos `system.dead_job.*` agregados
- v2.0.2 — post-auditoría focal 2026-05-30 PM: agregado dominio `product` con 6 eventos (cambios fiscalmente sensibles) + refinada disciplina "qué va a audit_log y qué a Pino" para sale/product domains
- v2.0.3 — ADR-0026 (2026-07-13): agregado `payment.method_reclassified` (corrección append-only de medio de pago). 42→43 eventos
- v2.1.0 — esta versión (2026-09-14, **aprobada por el owner**): 6 eventos para mutaciones de plata y de acceso que quedaban sólo en Pino — `expense.registered`, `expense.annulled`, `customer.account.settled`, `customer.account.adjusted`, `auth.accountant.granted`, `auth.accountant.revoked`. Dominio nuevo `expense`. 43→49 eventos. Propuesta y exclusiones razonadas: [PROPUESTA-EVENTOS-AUDITORIA-2026-09.md](PROPUESTA-EVENTOS-AUDITORIA-2026-09.md). Test: `T-AUDIT-02`
**Relacionado con:** ADR-0010 (idempotency), ADR-0019 (audit_log + observability), Rule 04-observability, ADR-0022 (fiscal events críticos), [CAPABILITY-MAP.md](CAPABILITY-MAP.md), [BOUNDED-CONTEXTS.md](BOUNDED-CONTEXTS.md), [OPERATIONAL-SEVERITY.md](OPERATIONAL-SEVERITY.md)

> **Filosofía:** F0 separa 4 concerns que la versión anterior mezclaba. Resultado: 3 tablas dedicadas (`audit_log` para compliance, `jobs_queue` para trabajo async, `metrics_counter` para observability) + Pino logs (debugging) externos. Sin outbox enterprise, sin event bus, sin worker poller para audit.

---

## 0. Los 4 concerns que F0 separa explícitamente

| Concern | Mecanismo F0 | Lifetime | Mutable? |
|---|---|---|---|
| **1. Compliance / audit** | Tabla `audit_log` (INSERT-only, trigger inmutable) | 10 años (Ley 11.683) | NO |
| **2. Trabajo async** | Tabla `jobs_queue` (status mutable) | 90 días post-completion | SÍ (status) |
| **3. Observability** | Pino logs estructurados + counters Postgres | 7-90 días según severity | n/a (write-only logs) |
| **4. Debugging** | Pino logs con `pii_level: 'public'/'internal'` | 7-30 días | n/a |

**Regla absoluta:** estos 4 concerns NO se mezclan. Si dudás dónde poner algo, leé el test de §1.

### ¿Por qué separados?

Cada uno tiene retention, acceso, consumer, y costo distintos. Mezclarlos en una sola "tabla de eventos" (lo que hacía v1) acopla concerns que después son caros de desacoplar.

---

## 1. Test rápido — ¿dónde va esto?

```
¿Un auditor / contador / inspector lo querría ver 6 meses después?
├─ SÍ → audit_log (con event_name canónico)
└─ NO →
   ¿Es trabajo asíncrono que algún worker debe ejecutar?
   ├─ SÍ → jobs_queue
   └─ NO →
      ¿Es métrica de salud / performance / contador?
      └─ SÍ → counter Postgres + Pino log con pii_level
      
      ¿Es debugging de operación específica?
      └─ SÍ → Pino log estructurado
```

**Si el test no es claro: default a Pino log + decisión explícita después.** No agregues a audit_log "por si acaso" — audit_log es contrato fiscal, no scratch pad.

---

## 2. `audit_log` — registro canónico

### Schema — partitioned por año

`audit_log` es **partitioned table por RANGE de `occurred_at`** (particiones anuales). Esto permite:

- **Cleanup por DROP PARTITION** (DDL, NO requiere disable trigger, NO requiere DELETE row-by-row, NO requiere window de "trigger temporalmente off")
- Performance: vacuum, REINDEX, backup por partición
- Particiones viejas → cold storage F1+ (S3 Glacier para >5 años)
- Trigger inmutability se mantiene SIEMPRE activo (DROP PARTITION es DDL, no dispara triggers BEFORE DELETE)

```sql
-- ============================================================================
-- audit_log — partitioned por año
-- ============================================================================

CREATE TABLE audit_log (
  id bigint NOT NULL DEFAULT nextval('audit_log_id_seq'),
  
  -- Identidad del evento
  event_name text NOT NULL,                  -- 'sale.completed', etc.
  event_version text NOT NULL DEFAULT 'v1',
  
  -- Tenant + Actor
  tenant_id uuid NOT NULL REFERENCES companies(id),
  actor_user_id uuid REFERENCES profiles(id),
  actor_type text NOT NULL CHECK (actor_type IN ('user', 'system', 'worker', 'webhook', 'cron')),
  
  -- Tracing (detalle completo en CORRELATION-PROPAGATION.md)
  correlation_id uuid NOT NULL,
  request_id uuid NOT NULL,                  -- SIEMPRE NOT NULL (workers/crons generan propio)
  
  -- Timing — clave de particionado
  occurred_at timestamptz NOT NULL,
  
  -- Payload + clasificación
  payload jsonb NOT NULL,
  severity text NOT NULL CHECK (severity IN ('info', 'notice', 'warning', 'error', 'critical')),
  pii_level text NOT NULL CHECK (pii_level IN ('public', 'internal', 'pii', 'sensitive_pii')),
  
  -- Idempotency (cuando aplica)
  idempotency_key text,
  
  -- Retention efectiva (calculada al insertar — informativo + cleanup heuristic)
  retention_days int NOT NULL,
  
  -- PK incluye occurred_at por requisito de Postgres (clave de particionado debe estar en PK)
  PRIMARY KEY (id, occurred_at)
) PARTITION BY RANGE (occurred_at);

-- Secuencia compartida por todas las particiones
CREATE SEQUENCE audit_log_id_seq OWNED BY audit_log.id;

-- Idempotency: UNIQUE per partition (basta para deduplicar dentro del año del evento)
-- NOTA: dedup cross-year solo si el caller usa idempotency_key estable que ya esté
-- procesado en la partición correcta (Postgres aplica el UNIQUE per-partition automáticamente).
-- Para los casos F0 (sale_id, mp_event_id, CAE) esto siempre es OK porque las
-- reintenciones ocurren en ventanas cortas (horas/días), nunca cross-year.

-- Particiones iniciales — crear por adelantado el año actual + siguiente
CREATE TABLE audit_log_2026 PARTITION OF audit_log
  FOR VALUES FROM ('2026-01-01') TO ('2027-01-01');

CREATE TABLE audit_log_2027 PARTITION OF audit_log
  FOR VALUES FROM ('2027-01-01') TO ('2028-01-01');

-- Constraints + indexes en cada partición (heredan estructura, no indexes)
-- Aplicar índices a las particiones individualmente (Postgres 11+ tiene partition-wise indexes
-- automáticos si CREATE INDEX se hace en el parent table)

CREATE INDEX idx_audit_log_tenant_time ON audit_log (tenant_id, occurred_at DESC);
CREATE INDEX idx_audit_log_correlation ON audit_log (correlation_id);
CREATE INDEX idx_audit_log_name ON audit_log (tenant_id, event_name, occurred_at DESC);
CREATE UNIQUE INDEX uq_audit_log_idempotency ON audit_log (tenant_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- ============================================================================
-- Inmutabilidad estricta — SIEMPRE activa
-- ============================================================================

CREATE OR REPLACE FUNCTION prevent_audit_log_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is append-only — UPDATE/DELETE prohibited (use partition cleanup instead)';
END;
$$ LANGUAGE plpgsql;

-- Trigger en el parent table → se aplica a todas las particuones automáticamente
CREATE TRIGGER audit_log_no_mutation
  BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_mutation();
```

### Cleanup por retention — DROP PARTITION, NO disable trigger

```sql
-- Cron anual (1ro de enero) — crea partición del año siguiente
CREATE TABLE audit_log_{YYYY+1} PARTITION OF audit_log
  FOR VALUES FROM ('{YYYY+1}-01-01') TO ('{YYYY+2}-01-01');

-- Cron anual — drop partición que cumplió 10 años (Ley 11.683)
-- Solo si TODAS las rows en esa partición tienen retention_days <= 365*10
-- (verificación previa antes del drop)
DO $$
DECLARE
  v_partition_name text := 'audit_log_2016';  -- 10 años atrás
  v_max_retention int;
BEGIN
  -- Verificar que la partición NO tiene eventos con retention extendida
  EXECUTE format('SELECT MAX(retention_days) FROM %I', v_partition_name)
  INTO v_max_retention;
  
  IF v_max_retention > 365 * 10 THEN
    RAISE EXCEPTION 'Partition % has events with retention > 10 years (max=% days). Manual review required.',
      v_partition_name, v_max_retention;
  END IF;
  
  -- Antes de drop, archivar a cold storage (F1+)
  -- PERFORM archive_partition_to_s3(v_partition_name);
  
  -- DROP PARTITION — DDL, no triggera BEFORE DELETE
  EXECUTE format('DROP TABLE IF EXISTS %I', v_partition_name);
END $$;
```

**Por qué partitioning y no DROP TRIGGER + DELETE:**

| Approach | Pro | Contra |
|---|---|---|
| **F0 elegido — Partitioning por año + DROP PARTITION** | DDL atómico, sin race con writes, sin window de trigger off, performance natural por partición, archivar a cold storage trivial | Requiere `CREATE TABLE PARTITION` anual (cron simple) |
| DROP TRIGGER + DELETE + RECREATE TRIGGER | "Fácil" de implementar inicialmente | Race condition: durante el window, cualquier worker puede UPDATE/DELETE legítimamente sin restricción. Si el job crashea entre DROP y CREATE, el trigger queda removido. Logs de DDL en pg_logs cada vez. **NO HACER.** |
| Retention granular row-by-row DELETE | Más flexible | Sigue requiriendo deshabilitar trigger O excepción especial en el trigger. Mismo problema base. |

### Reglas operativas audit_log (revisadas)

1. **Append-only.** Solo INSERT. UPDATE/DELETE → throw (sin excepciones — partitioning resuelve cleanup).
2. **Insert en la misma tx que la mutación de negocio.** Atomicidad real.
3. **Idempotency key cuando aplica.** UNIQUE INDEX parcial (`WHERE idempotency_key IS NOT NULL`).
4. **Payload mínimo necesario.** No copiar entidad entera.
5. **Naming canónico inmutable.**
6. **Cleanup vía DROP PARTITION anual.** NO DROP TRIGGER bajo ninguna circunstancia.
7. **Pre-crear particiones del año siguiente.** Cron 1ro de diciembre crea la partición del próximo año (margen para evitar insert sin partición destino).

### Cron operativo de mantenimiento

```typescript
// src/lib/workers/cron/audit-log-partitions.ts
import 'server-only';

// Cron diciembre 1 — crear partición próximo año
export async function createNextYearPartition() {
  const nextYear = new Date().getFullYear() + 1;
  const partitionName = `audit_log_${nextYear}`;
  
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS ${sql.identifier(partitionName)}
    PARTITION OF audit_log
    FOR VALUES FROM (${`${nextYear}-01-01`}) TO (${`${nextYear + 1}-01-01`})
  `);
}

// Cron enero 1 — drop partición de 10 años atrás (con verificación)
export async function dropExpiredPartition() {
  const targetYear = new Date().getFullYear() - 10;
  const partitionName = `audit_log_${targetYear}`;
  
  // Verificar partition existe + tiene retention vencida
  const result = await db.execute(sql`
    SELECT MAX(retention_days) AS max_retention
    FROM ${sql.identifier(partitionName)}
  `);
  
  const maxRetention = result.rows[0]?.max_retention ?? 0;
  
  if (maxRetention > 365 * 10) {
    // Algún evento tiene retention extendida → NO DROP, alertar
    throw new PartitionDropBlockedError(
      `Partition ${partitionName} has events with retention > 10y. Manual review required.`
    );
  }
  
  // Archivar antes de drop (F1+)
  // await archivePartitionToS3(partitionName);
  
  await db.execute(sql`DROP TABLE IF EXISTS ${sql.identifier(partitionName)}`);
}
```

Job registrado en `jobs_queue`: `cron.partition_audit_log` (mensual — checa fecha actual y ejecuta create_next_year (1 dic) O drop_expired (1 ene) según corresponda con verificación previa).

### Por qué INSERT en la misma tx (no outbox async)

| Approach | Pro | Contra |
|---|---|---|
| **F0 elegido — INSERT directo en tx** | Atomicidad real. Cero eventos perdidos por crash. Simple. | Latencia +5-15ms por mutación (índices). |
| Outbox async + worker | Latencia menor en hot path. | Complejidad: tabla extra, worker, retry, dead letter, 2 writes, dual persistence. |

Para F0 con 5 clientes y ~100 ventas/día por cliente, los 5-15ms extra son invisibles. Outbox vale cuando volumen + integraciones externas lo justifican (F1+). Ver §11.

---

## 3. `jobs_queue` — trabajo async

### Schema

```sql
CREATE TABLE jobs_queue (
  id bigserial PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES companies(id),
  
  -- Tipo + payload del trabajo
  job_type text NOT NULL,                    -- ver §3.3 catálogo
  payload jsonb NOT NULL,
  
  -- Tracing (mismo correlation_id que el audit_log que lo generó)
  correlation_id uuid NOT NULL,              -- siempre presente (worker hereda al procesar)
  last_request_id uuid,                      -- NULL hasta primer attempt — worker setea al empezar
  
  -- Estado mutable
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'success', 'failed', 'dead')),
  attempts int NOT NULL DEFAULT 0,
  max_attempts int NOT NULL DEFAULT 5,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  
  -- Resultado
  last_error text,
  started_at timestamptz,
  completed_at timestamptz,
  
  -- Timing
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_jobs_pending ON jobs_queue (next_attempt_at)
  WHERE status = 'pending';

CREATE INDEX idx_jobs_tenant_type ON jobs_queue (tenant_id, job_type, created_at DESC);

CREATE INDEX idx_jobs_dead ON jobs_queue (created_at DESC)
  WHERE status = 'dead';
```

### Catálogo F0 de `job_type` (10 tipos — cerrado, ver Regla J1)

> **v2.0.1 (2026-05-28):** catálogo unificado con CLAUDE.md §10.3 + BOUNDED-CONTEXTS. 3 jobs movidos a F1+ deferred con trigger explícito.

| `job_type` | Trigger | Worker (Bounded Context) | Max attempts | Backoff |
|---|---|---|---|---|
| `afip.emit_invoice` | Server Action crea sale + enqueue explícito (transacción) | Worker dedicado en Fiscal context, cron Vercel 30s | 5 | 30s → 2m → 10m → 1h → 6h |
| `afip.reconcile_pending` | Service marca `requires_reconciliation` post-timeout | Worker dedicado en Fiscal context, cron 5min | 24 | constante 5min (= 2h total) |
| `afip.refresh_wsaa_token` | Worker proactivo cuando token < 1h expiración | Worker dedicado en Fiscal context, cron 30min | 5 | 1m → 5m → 30m → 1h → 6h |
| `afip.refresh_padron` | Cron diario nocturno batch refresh + on-demand stale | Worker dedicado en Fiscal context, cron diario | 3 | 30m → 2h → 6h |
| `email.send_invoice` | Fiscal context emite `fiscal.invoice.cae_received` → Notifications encola | Worker dedicado en Notifications context, cron 1min | 5 | 1m → 5m → 30m → 1h → 6h |
| `email.send_breach_notification` | Runbook `breach-notification.md` (manual) o detección automática breach | Worker dedicado en Notifications context, cron 1min | 5 | 1m → 5m → 30m → 1h → 6h |
| `mp.reconcile_webhook` | Webhook MP entrante con dedup OK + necesita reconciliación con sale | Worker dedicado en Integrations/Sales context, cron 30s | 5 | 30s → 2m → 10m → 30m → 1h |
| `cron.archive_expired_demos` | Cron diario (transición demo día 82 — ADR-0020) | Worker dedicado en MultiTenant context, cron diario | 1 | n/a (operator manual si falla) |
| `cron.partition_audit_log` | Cron mensual (crea partition next + drop expired con verificación) | Worker dedicado en Audit context, cron mensual | 3 | 1h → 6h → 24h |
| `cron.cleanup_old_jobs` | Cron diario (DELETE jobs success > 90 días) | Worker dedicado en JobsQueue context, cron diario | 1 | n/a |

**Catálogo cerrado** (Regla J1). Agregar tipo nuevo requiere PR + worker dedicado + actualización CLAUDE.md §10.3 + BOUNDED-CONTEXTS. Sin handler genérico (Regla J2). Sin fan-out implícito (Regla J3).

### Jobs deferred a F1+ (NO F0)

Estos 3 jobs existían en v2.0.0 pero se movieron a F1+ por scope discipline:

| `job_type` deferred | Trigger F1+ |
|---|---|
| `cron.cash_session.force_close` | Volumen > 30 tenants O comerciante reporta cierres olvidados frecuentes |
| `cron.subscription.check_billing` | Modelo billing automatizado (F0 son 5 clientes piloto con billing manual) |
| `security.cert.check_expiration` | > 10 tenants con certs distintos O incidente de cert vencido |

### Reglas operativas jobs_queue (con anti-event-bus drift)

1. **Status transitions explícitas:**
   ```
   pending → running → success
                    → failed → pending (si attempts < max)
                            → dead (si attempts >= max)
   ```
2. **`SKIP LOCKED` en el worker** para evitar dos workers tomando el mismo job:
   ```sql
   SELECT * FROM jobs_queue
   WHERE status = 'pending' AND next_attempt_at <= now()
   ORDER BY next_attempt_at
   LIMIT 10
   FOR UPDATE SKIP LOCKED;
   ```
3. **Dead jobs requieren intervención humana.** Sin retry automático infinito. Operador (vos F0) revisa con query y decide.
4. **Workers son idempotentes.** Reintento debe ser seguro (job puede ejecutarse 2 veces si crash entre completion y UPDATE status).
5. **Cleanup mensual:** delete `WHERE completed_at < now() - interval '90 days' AND status = 'success'`.

### Reglas que IMPIDEN que `jobs_queue` se vuelva event bus encubierto

Este es el riesgo real: si dejamos `jobs_queue` "para cualquier cosa async", terminamos con devs creando job_types ad-hoc, handlers genéricos despachando por tipo, fan-out de un evento a múltiples consumers, y reconstruyendo un event bus pobre dentro de Postgres. Para impedirlo:

#### Regla J1 — Catálogo de `job_type` CERRADO

Los únicos `job_type` permitidos son los **10** listados en §3.3 catálogo. **Agregar uno nuevo requiere:**
- PR explícito que modifica este documento
- Justificación: es una **tarea concreta**, no un evento reactivo
- Worker dedicado documentado (no handler genérico)
- Aprobación del owner técnico

Sin esa secuencia, el INSERT del `job_type` fuera del catálogo es **error de runtime**:

```typescript
// src/lib/jobs/types.ts
import 'server-only';

export const JOB_TYPES = [
  'afip.emit_invoice',
  'afip.reconcile_pending',
  'afip.refresh_wsaa_token',
  'afip.refresh_padron',
  'email.send_invoice',
  'email.send_breach_notification',
  'mp.reconcile_webhook',
  'cron.archive_expired_demos',
  'cron.partition_audit_log',
  'cron.cleanup_old_jobs',
] as const;

export type JobType = typeof JOB_TYPES[number];

// El único punto de entrada para crear jobs — valida type en runtime
export async function enqueueJob(
  jobType: JobType,
  payload: unknown,
  options?: { tenantId?: string; correlationId?: string; delayMs?: number }
): Promise<void> {
  if (!JOB_TYPES.includes(jobType as JobType)) {
    throw new Error(`Job type "${jobType}" not in catalog. See EVENT-TAXONOMY.md §3.3.`);
  }
  // ... insert en jobs_queue
}
```

#### Regla J2 — Worker dedicado por `job_type`, NO handler genérico

Cada `job_type` tiene su función específica que lo procesa. **No hay handler genérico que despache por tipo.**

```typescript
// ❌ PROHIBIDO — patrón event bus encubierto
const handlers: Record<JobType, Handler> = {
  'afip.emit_invoice': handleAfipEmit,
  'email.send': handleEmailSend,
  // ...
};
function processJob(job: Job) {
  return handlers[job.job_type](job);
}

// ✅ CORRECTO — worker dedicado, sabe qué procesa
// src/lib/workers/afip-emit-invoice-worker.ts
async function runAfipEmitInvoiceWorker() {
  const jobs = await fetchPendingJobs('afip.emit_invoice', { limit: 10 });
  for (const job of jobs) {
    try {
      await processAfipEmitInvoice(job);
      await markJobSuccess(job.id);
    } catch (err) {
      await markJobFailed(job.id, err);
    }
  }
}
```

Cada worker es un archivo dedicado. Si se necesita procesar 8 tipos, hay 8 archivos (no 1 con dispatch).

#### Regla J3 — Un job genera UN trabajo, NO fan-out

**Prohibido:** crear un `job_type` que dispare múltiples consumers internamente. Si necesitás que múltiples cosas pasen como consecuencia de algo, **crear N jobs explícitamente** en el código que sabe quién consume:

```typescript
// ❌ PROHIBIDO — fan-out implícito
await enqueueJob('sale.completed', { saleId });  // worker fan-out a email, AFIP, MP, etc.

// ✅ CORRECTO — cada side-effect explícito
await db.transaction(async (tx) => {
  // 1. Mutación
  const sale = await tx.insert(sales).values(...).returning();
  
  // 2. Audit log directo en tx
  await tx.insert(auditLog).values({ event_name: 'sale.completed', ...});
  
  // 3. Cada job async necesario, explícitamente
  await tx.insert(jobsQueue).values({ job_type: 'afip.emit_invoice', payload: { saleId: sale.id } });
  await tx.insert(jobsQueue).values({ job_type: 'email.send', payload: { template: 'sale_receipt', ... } });
});
```

El código que crea la venta sabe explícitamente qué tareas async dispara. **Sin pub/sub, sin event bus, sin reactividad oculta.**

#### Regla J4 — NO usar `jobs_queue` para reconstruir state

`jobs_queue` no es event sourcing. NO usar para:
- Reconstruir state de una entidad desde una secuencia de jobs
- "Replay" de jobs históricos para regenerar estado
- Snapshots derivados de la secuencia de jobs

State autoritativo vive en tablas de negocio (`sales`, `invoices`, etc.). Jobs son **trabajo a ejecutar**, no eventos para proyección.

#### Regla J5 — `correlation_id` en jobs_queue: trazabilidad SÍ, state ownership NO

El campo `correlation_id` en `jobs_queue` **sirve activamente para trazabilidad operativa** de la tarea. Esto incluye:

✅ **Permitido (trazabilidad operativa):**
- Agrupar logs Pino, métricas, audit events y jobs por `correlation_id` para investigar una operación completa
- Operator tooling: "¿qué pasó con la venta X?" → query cross-tabla por `correlation_id` → ver toda la cadena (sale → audit → jobs disparados → resultado de cada job)
- Debugging end-to-end de un flujo (Sesión 2 lo formaliza)
- Heredar `correlation_id` del contexto que crea el job (Server Action heredando del request HTTP, worker heredando del job que lo encoló)
- Métricas por `correlation_id` para detectar operaciones lentas o con retries excesivos

❌ **Prohibido (state ownership):**
- Derivar el estado de una entidad de negocio leyendo la secuencia de jobs con ese `correlation_id` ("el último job exitoso con correlation_id X me dice si la venta está facturada")
- Tratar `jobs_queue` como state machine de la operación
- Reconstruir el flow autoritativo a partir de los jobs (eso es event sourcing — no F0)
- Que el estado canónico de una venta dependa de qué jobs ya corrieron

**La distinción clave:** trazabilidad usa el `correlation_id` para **leer y correlacionar** datos que viven en sus tablas autoritativas. State ownership intentaría usar `jobs_queue` como source of truth — y la fuente de verdad del estado vive en las tablas de negocio (`sales`, `invoices`, etc.), no en la cola de tareas.

```typescript
// ✅ Trazabilidad operativa — legítimo
async function investigateSale(saleId: string) {
  const sale = await db.query.sales.findFirst({ where: eq(sales.id, saleId) });
  const correlationId = sale.correlation_id;
  
  const auditEvents = await db.query.auditLog.findMany({
    where: eq(auditLog.correlation_id, correlationId),
    orderBy: auditLog.occurred_at,
  });
  
  const jobs = await db.query.jobsQueue.findMany({
    where: eq(jobsQueue.correlation_id, correlationId),
  });
  
  return { sale, auditEvents, jobs };  // operator dashboard / debugging
}

// ❌ State ownership — anti-pattern
async function isSaleInvoiced(saleId: string) {
  const correlationId = await getCorrelationIdFromSale(saleId);
  const lastJob = await db.query.jobsQueue.findFirst({
    where: and(
      eq(jobsQueue.correlation_id, correlationId),
      eq(jobsQueue.job_type, 'afip.emit_invoice'),
      eq(jobsQueue.status, 'success'),
    ),
  });
  return lastJob !== null;  // ❌ MAL — el estado vive en sales.fiscal_status, no en jobs
}

// ✅ State desde la fuente autoritativa
async function isSaleInvoiced(saleId: string) {
  const sale = await db.query.sales.findFirst({ where: eq(sales.id, saleId) });
  return sale.fiscal_status === 'issued';  // ✅ source of truth correcto
}
```

Resumen operativo: **`correlation_id` es coordenada de búsqueda** (trazabilidad), **NO atributo de estado** (ownership).

#### Regla J6 — Catálogo `job_type` no se "deprecan" — se eliminan con migración

Si un job_type ya no se usa:
1. Verificar que no hay jobs `pending` o `dead` con ese tipo
2. Remover del catálogo `JOB_TYPES`
3. Remover worker file
4. Migration que verifica que no quedan rows con ese tipo

No mantener "tipos deprecated" por compatibility — eso es el camino al event bus encubierto.

#### Test rápido — ¿esto va a jobs_queue?

```
¿Es una tarea concreta que un worker debe ejecutar para completar un side-effect?
├─ SÍ → jobs_queue (con job_type específico en el catálogo)
└─ NO →
   ¿Es un evento de dominio que múltiples consumers podrían procesar?
   └─ Eso NO existe F0 — si aparece la necesidad, ver §11 Evolution Path (integration_outbox)
```

Si el job_type empieza a sonar como "domain event" en lugar de "tarea concreta", **es bandera roja**.

---

## 4. Observability — metrics + logs (NO tabla)

### Metrics: counters Postgres simples (con PK natural válida)

Tabla única `metrics_counter` para tracking básico F0:

```sql
-- Sentinel UUID para métricas system-wide (no atadas a tenant)
-- Constante: '00000000-0000-0000-0000-000000000000'
-- Se exporta desde src/lib/metrics/constants.ts como SYSTEM_TENANT_ID

CREATE TABLE metrics_counter (
  metric_name text NOT NULL,
  tenant_id uuid NOT NULL,                    -- usar SYSTEM_TENANT_ID nil UUID para system-wide
  tag_key text NOT NULL DEFAULT '',           -- '' si la métrica no tiene tags
  tag_value text NOT NULL DEFAULT '',
  
  count bigint NOT NULL DEFAULT 0,
  last_incremented_at timestamptz NOT NULL DEFAULT now(),
  
  -- PK natural válida (sin COALESCE en PK — eso no es válido en Postgres)
  PRIMARY KEY (metric_name, tenant_id, tag_key, tag_value)
);

COMMENT ON COLUMN metrics_counter.tenant_id IS
  'Usar UUID ''00000000-0000-0000-0000-000000000000'' (SYSTEM_TENANT_ID) para métricas system-wide';

-- Atomic increment helper
CREATE OR REPLACE FUNCTION increment_counter(
  p_metric text,
  p_tenant uuid,                              -- NOT NULL — usar SYSTEM_TENANT_ID si aplica
  p_tag_key text DEFAULT '',
  p_tag_value text DEFAULT '',
  p_amount bigint DEFAULT 1
) RETURNS void AS $$
BEGIN
  INSERT INTO metrics_counter (metric_name, tenant_id, tag_key, tag_value, count, last_incremented_at)
  VALUES (p_metric, p_tenant, p_tag_key, p_tag_value, p_amount, now())
  ON CONFLICT (metric_name, tenant_id, tag_key, tag_value)
  DO UPDATE SET 
    count = metrics_counter.count + p_amount,
    last_incremented_at = now();
END;
$$ LANGUAGE plpgsql;

-- Index secundario para queries por tenant + recencia (dashboards)
CREATE INDEX idx_metrics_counter_tenant_recent ON metrics_counter (tenant_id, last_incremented_at DESC);
```

**Por qué UUID nil sentinel y no nullable + UNIQUE INDEX con COALESCE:**

- PK natural sin COALESCE: queries usan el plan más directo (index unique scan)
- ON CONFLICT con PK directa es estándar y rápido
- Sin riesgo de "NULL en PK" que Postgres NO permite
- Trade-off aceptado: hay que recordar usar `SYSTEM_TENANT_ID` constant para system metrics — controlado vía wrapper TS (ver §4.3)

**F1+:** migrar a OpenTelemetry o Datadog cuando volumen lo justifique.

### 4.1 — Whitelist obligatoria de métricas y tags (anti-cardinality-explosion)

**El problema:** sin whitelist, cualquier dev puede escribir `incrementCounter('foo', tenant, 'product_id', 'abc-123')` y la tabla explota a 100k filas por métrica × N tenants.

**Solución F0:** whitelist explícita en código TS. La función `incrementCounter` valida antes de insertar y throwea si:
- La métrica no está en la whitelist
- El `tag_key` no está permitido para esa métrica
- El `tag_value` no está en la lista de valores permitidos (cuando son bounded)

```typescript
// src/lib/metrics/whitelist.ts
import 'server-only';

export const SYSTEM_TENANT_ID = '00000000-0000-0000-0000-000000000000' as const;

export type MetricConfig = {
  scope: 'tenant' | 'system';
  allowedTagKeys: readonly string[];              // [] = sin tags
  allowedValues?: Record<string, readonly string[]>;  // si bounded, lista explícita
  cardinalityWarn?: number;                       // alerta si supera N filas distintas
};

export const METRIC_WHITELIST: Record<string, MetricConfig> = {
  // ──── AFIP / Fiscal ────────────────────────────────────────────
  'afip.cae.success': {
    scope: 'tenant',
    allowedTagKeys: ['sale_point', 'invoice_type'],
    allowedValues: {
      invoice_type: ['A', 'B', 'C', 'NC_A', 'NC_B', 'NC_C'],
      // sale_point: bounded por tenant (~5 puntos venta típico) — sin allowedValues
    },
    cardinalityWarn: 60,                          // ~10 sale_points × 6 types
  },
  'afip.cae.rejected': {
    scope: 'tenant',
    allowedTagKeys: ['error_code'],
    // error codes AFIP son bounded (~50 codes documentados)
    cardinalityWarn: 100,
  },
  'afip.cae.timeout': {
    scope: 'tenant',
    allowedTagKeys: [],
  },
  'afip.padron.cache_hit_rate': {
    scope: 'tenant',
    allowedTagKeys: ['outcome'],
    allowedValues: { outcome: ['hit', 'miss'] },
    cardinalityWarn: 2,
  },
  'fiscal.rounding.delta_cents': {
    scope: 'tenant',
    allowedTagKeys: ['mode', 'stage'],
    allowedValues: {
      mode: ['HALF_UP', 'HALF_DOWN', 'HALF_EVEN'],
      stage: ['PER_LINE', 'PER_TAX_BRACKET'],
    },
    cardinalityWarn: 6,
  },
  
  // ──── Payment ──────────────────────────────────────────────────
  'payment.mp.confirmed': { scope: 'tenant', allowedTagKeys: [] },
  'payment.mp.timeout':   { scope: 'tenant', allowedTagKeys: [] },
  
  // ──── System (cross-tenant) ─────────────────────────────────────
  'system.rate_limit.hit': {
    scope: 'system',
    allowedTagKeys: ['endpoint'],
    // endpoints son bounded por las rutas existentes — agregar a allowedValues
    // cuando se enumeran todas. Mientras tanto, monitorear cardinalityWarn.
    cardinalityWarn: 50,
  },
  'system.cross_tenant.blocked': {
    scope: 'system',
    allowedTagKeys: [],
  },
  'system.price_tampering_attempt': {
    scope: 'tenant',
    allowedTagKeys: [],
  },
  'system.webhook.replay_detected': {
    scope: 'system',
    allowedTagKeys: ['provider'],
    allowedValues: { provider: ['mercadopago', 'afip'] },
    cardinalityWarn: 5,
  },
  
  // ──── Cash session ──────────────────────────────────────────────
  'cash_session.diff.amount': {
    scope: 'tenant',
    allowedTagKeys: ['sign'],
    allowedValues: { sign: ['positive', 'negative', 'zero'] },
    cardinalityWarn: 3,
  },
} as const;

// Validador + helper que usa SIEMPRE el código de aplicación (nunca SQL directo)
export async function incrementCounter(
  metric: string,
  options: {
    tenantId?: string;                        // undefined → usa SYSTEM_TENANT_ID
    tag?: { key: string; value: string };
    amount?: number;
  } = {}
): Promise<void> {
  const config = METRIC_WHITELIST[metric];
  if (!config) {
    throw new Error(
      `Metric "${metric}" not in whitelist. ` +
      `Add it to METRIC_WHITELIST in src/lib/metrics/whitelist.ts before using.`
    );
  }
  
  // Resolución de tenant_id según scope
  let tenantId: string;
  if (config.scope === 'system') {
    if (options.tenantId && options.tenantId !== SYSTEM_TENANT_ID) {
      throw new Error(`Metric "${metric}" is system-scope but tenantId was provided`);
    }
    tenantId = SYSTEM_TENANT_ID;
  } else {
    if (!options.tenantId || options.tenantId === SYSTEM_TENANT_ID) {
      throw new Error(`Metric "${metric}" requires tenantId (scope=tenant)`);
    }
    tenantId = options.tenantId;
  }
  
  // Validación de tags
  let tagKey = '';
  let tagValue = '';
  if (options.tag) {
    if (!config.allowedTagKeys.includes(options.tag.key)) {
      throw new Error(
        `Tag key "${options.tag.key}" not allowed for metric "${metric}". ` +
        `Allowed: ${config.allowedTagKeys.join(', ') || '(none)'}`
      );
    }
    if (config.allowedValues?.[options.tag.key]) {
      const allowed = config.allowedValues[options.tag.key];
      if (!allowed.includes(options.tag.value)) {
        throw new Error(
          `Tag value "${options.tag.value}" not in allowed list for ` +
          `${metric}/${options.tag.key}. Allowed: ${allowed.join(', ')}`
        );
      }
    }
    tagKey = options.tag.key;
    tagValue = options.tag.value;
  } else if (config.allowedTagKeys.length > 0) {
    // Métrica espera tag pero no se pasó — OK, asume aggregate total
  }
  
  await db.execute(sql`
    SELECT increment_counter(${metric}, ${tenantId}::uuid, ${tagKey}, ${tagValue}, ${options.amount ?? 1}::bigint)
  `);
}
```

**Anti-patterns explícitamente prohibidos:**

- `tag_value` con IDs de entidad (product_id, customer_id, sale_id, correlation_id) — eso es alta cardinalidad
- `tag_value` con valores no enumerables (URLs completas, timestamps, hashes)
- Métricas ad-hoc (typo, no en whitelist)
- SQL directo a `metrics_counter` desde código de negocio — pasa por `incrementCounter()`

**Monitoreo de cardinalidad:** cron mensual que ejecuta:

```sql
SELECT metric_name, COUNT(DISTINCT (tenant_id, tag_key, tag_value)) AS unique_rows
FROM metrics_counter
GROUP BY metric_name
HAVING COUNT(DISTINCT (tenant_id, tag_key, tag_value)) > 1000
ORDER BY unique_rows DESC;
```

Resultado > 0 filas → revisar métrica (tag mal definido, cardinality drift).

### 4.2 — Métricas obligatorias F0 (corresponden a la whitelist)

| Métrica | Scope | Tags | Alert si |
|---|---|---|---|
| `afip.cae.success` | tenant | sale_point, invoice_type | < 95% en 1h |
| `afip.cae.rejected` | tenant | error_code | > 5% en 1h |
| `afip.cae.timeout` | tenant | — | > 5/día |
| `afip.padron.cache_hit_rate` | tenant | outcome (hit/miss) | hit_rate < 50% |
| `fiscal.rounding.delta_cents` | tenant | mode, stage | distribución sesgada |
| `payment.mp.confirmed` | tenant | — | métrica solo |
| `payment.mp.timeout` | tenant | — | > 10% de QRs |
| `system.rate_limit.hit` | system | endpoint | > 100/h sostenido |
| `system.cross_tenant.blocked` | system | — | **> 0 (CRÍTICO)** |
| `cash_session.diff.amount` | tenant | sign | > $1000/sesión |

**Agregar métrica nueva F0/F1:**
1. PR que actualiza `METRIC_WHITELIST` en código
2. Justificación: bounded cardinality + utilidad medible
3. Documentar en esta tabla
4. NO se puede usar antes de mergear la whitelist update

### 4.3 — Constante `SYSTEM_TENANT_ID` exportada en código

```typescript
// src/lib/metrics/constants.ts (re-exportada desde whitelist.ts)
export const SYSTEM_TENANT_ID = '00000000-0000-0000-0000-000000000000' as const;
```

Cualquier código que necesite escribir métrica system-wide la importa de acá. Sin magic strings dispersos.

### Logs: Pino estructurado (Rule 04-observability)

Para debugging operativo: Pino con `pii_level` clasificado. Retention según severity (ya en Rule 04-observability). **NO van a `audit_log`** — son logs separados que viven en Vercel + Sentry F0, datadog F1+.

```typescript
logger.info({
  pii_level: 'internal',
  event: 'sale.processing',          // NO va a audit_log — es trace
  correlation_id: ctx.correlationId,
  sale_id: sale.id,
  step: 'stock_validated',
});
```

---

## 5. Catálogo F0 de `audit_log` events (49 eventos)

Solo los que pasan el test de §1. El resto va a Pino logs + counters.

### Domain: `auth` (6 eventos)

| `event_name` | severity | pii_level | idempotency_key | Notas |
|---|---|---|---|---|
| `auth.login.success` | info | sensitive_pii (IP) | — | Insert también en `active_sessions` (ADR-0019 S12) |
| `auth.login.failed` | warning | sensitive_pii (IP) | — | Tracking abuso |
| `auth.password.changed` | warning | internal | — | Invalida sesiones existentes |
| `auth.role.changed` | warning | internal | — | Invalida cache permisos |
| `auth.accountant.granted` | warning | internal | — | v2.1.0. Un **tercero** (la contadora, ADR-0008) pasa a ver los datos del comercio. Se emite sólo cuando el vínculo se **crea** (reinvitar no emite). Payload: `{accountant_user_id, via: 'invitacion'\|'usuario_existente'}` — sólo ids, el email no va |
| `auth.accountant.revoked` | warning | internal | — | v2.1.0. El vínculo se borra de `company_users`: sin el evento no queda rastro de que tuvo acceso. Sólo si efectivamente se borró una fila. Payload: `{accountant_user_id}` |

> **Por qué no se reusa `auth.role.changed` para la contadora:** ese evento es "a un usuario del comercio le cambiaron el rol". Dar acceso a un tercero externo es otro hecho, y reusarlo haría que el log mintiera sobre qué pasó.

### Domain: `sale` (4 eventos)

| `event_name` | severity | pii_level | idempotency_key | Notas |
|---|---|---|---|---|
| `sale.completed` | info | internal | sale_id | `commercial_status = 'completed'` |
| `sale.cancelled` | notice | internal | — | Antes de cobrar |
| `sale.voided` | warning | internal | — | Post-cobro (genera NC F1+) |
| `sale.refunded` | warning | internal | — | F1+ con NC fiscal |

### Domain: `fiscal` (8 eventos críticos)

| `event_name` | severity | pii_level | idempotency_key | Notas |
|---|---|---|---|---|
| `fiscal.invoice.cae_received` | info | internal | CAE | Éxito |
| `fiscal.invoice.cae_rejected` | error | internal | — | AFIP rechazó payload |
| `fiscal.invoice.requires_reconciliation` | warning | internal | — | Timeout — job de reconciliación toma el caso |
| `fiscal.invoice.reconciled_issued` | info | internal | CAE | Worker recuperó post-timeout |
| `fiscal.invoice.reconciliation_timeout` | error | internal | — | 2h sin resolver → manual |
| `fiscal.invoice.number_burned` | error | internal | — | Número perdido |
| `fiscal.invoice.manual_resolution_required` | error | internal | — | Terminal — gestión externa contador |
| `fiscal.invariant_violation` | critical | internal | — | `ImpIVA != sum(Iva[].Importe)` u otro (ADR-0022) |

### Domain: `payment` (3 eventos)

| `event_name` | severity | pii_level | idempotency_key | Notas |
|---|---|---|---|---|
| `payment.cash.received` | info | internal | — | Efectivo registrado |
| `payment.mp.confirmed` | info | internal | mp_event_id | MP webhook confirmó cobro |
| `payment.mp.refunded` | warning | internal | — | F1+ con NC |
| `payment.method_reclassified` | info | internal | — | Corrección append-only de medio (ADR-0026). Payload: `{sale_id, original_payment_id, correction_payment_id, from_method, to_method, amount, reason}` |

### Domain: `stock` (2 eventos)

| `event_name` | severity | pii_level | idempotency_key | Notas |
|---|---|---|---|---|
| `stock.adjusted_manually` | notice | internal | — | Comerciante ajusta inventario (motivo obligatorio en payload). Desde 2026-09-12 (migration 0038) cubre la **corrección** (`type: 'adjustment'`) y la **merma** cargada a mano (`type: 'loss'`): el payload lleva `type` y `motivo` (rotura/vencimiento/robo/recuento/error_carga/otro). Se reusó el evento en vez de agregar `stock.loss_recorded` (catálogo intacto). Ver RESEARCH-BRIEF-ajuste-de-stock.md |
| `stock.negative.allowed` | warning | internal | — | Excepción de stock negativo aplicada |

### Domain: `product` (6 eventos — agregado v2.0.2)

> **Disciplina:** product domain audita SOLO cambios fiscalmente sensibles (precio, alícuota IVA, exención TDF) o de ciclo de vida (creación, desactivación, carga inicial masiva). Updates triviales (nombre, descripción, stock mínimo) van a Pino log debug — NO a audit_log.
>
> Razón: contador / inspector AFIP necesita reconstruir base imponible histórica. Si un producto cambió precio el 15-mar, los comprobantes anteriores valen con el precio anterior. Por eso `product.price_changed` SÍ es auditable. Cambiar la descripción "tela negra" → "tela negra premium" NO afecta nada fiscal.

| `event_name` | severity | pii_level | idempotency_key | Notas |
|---|---|---|---|---|
| `product.created` | info | internal | — | Alta inicial al catálogo. Payload incluye {product_id, name, sku, barcode, price, tax_rate, tdf_exempt} |
| `product.deactivated` | notice | internal | — | Soft delete (is_active=false). Producto no aparece en POS pero historial preservado |
| `product.price_changed` | notice | internal | — | Cambio de price. Payload {product_id, old_price, new_price, reason?}. Afecta valuación inventario + facturas futuras |
| `product.tax_rate_changed` | warning | internal | — | Cambio de alícuota IVA. Payload {product_id, old_rate, new_rate}. Sensible — debería ser raro |
| `product.tdf_exempt_changed` | warning | internal | — | Cambio de flag Ley 19.640. Payload {product_id, old_value, new_value}. Afecta directamente facturación TDF |
| `product.bulk_imported` | info | internal | — | Carga masiva via CSV. Payload {ok_count, fail_count, total_rows, sample_ids[0..10]} |

### Domain: `cash_session` (3 eventos)

| `event_name` | severity | pii_level | idempotency_key | Notas |
|---|---|---|---|---|
| `cash_session.opened` | info | internal | — | Apertura con monto inicial |
| `cash_session.closed` | info | internal | — | Cierre limpio |
| `cash_session.closed_with_difference` | warning | internal | — | Diferencia ≠ 0 → atención |

### Domain: `customer` (4 eventos)

| `event_name` | severity | pii_level | idempotency_key | Notas |
|---|---|---|---|---|
| `customer.created` | info | pii | — | Nuevo cliente cargado |
| `customer.deletion_requested` | warning | pii | — | ARCO request — Ley 25.326 |
| `customer.account.settled` | info | internal | — | v2.1.0 (ADR-0027). El cliente paga su cuenta; en efectivo entra plata al cajón **fuera de una venta**. Payload: `{movement_id, customer_id, amount, method, saldo_antes, cash_session_id, cash_movement_id}` |
| `customer.account.adjusted` | warning | internal | — | v2.1.0 (ADR-0027). Ajuste manual que **suma deuda**, con motivo obligatorio. Payload: `{movement_id, customer_id, amount, reason, saldo_antes}` |

> El **cargo** por venta fiada no tiene evento propio: ocurre dentro de `finalizeSale` y `sale.completed` ya lleva `payments[]` con `method: 'cuenta_corriente'`. Un evento aparte duplicaría el mismo hecho.

### Domain: `expense` (2 eventos — agregado v2.1.0)

| `event_name` | severity | pii_level | idempotency_key | Notas |
|---|---|---|---|---|
| `expense.registered` | info | internal | — | Gasto cargado. Si es mercadería, **entra stock**: el movimiento `purchase` va con `skip_audit` y este evento lleva sus ids (mismo patrón que `sale.completed`). Payload: `{expense_id, fecha, categoria, total, neto, iva, medio_pago, en_iva_compras, tercero_id, comprobante_tipo, comprobante_numero, cash_movement_id, items[{product_id, qty, unit_cost}], stock_movement_ids[]}` |
| `expense.annulled` | warning | internal | — | Anulación append-only (fila en cero con `corrects_id`): **devuelve plata a la caja de hoy y saca el stock** de la compra. Payload: `{expense_id, annulment_id, fecha_original, total_anulado, motivo, devolvio_a_caja, cash_session_id, deposit_cash_movement_id, stock_movement_ids[]}` |

### Domain: `subscription` (2 eventos)

| `event_name` | severity | pii_level | idempotency_key | Notas |
|---|---|---|---|---|
| `subscription.activated` | info | internal | — | Pago primer mes OK |
| `subscription.suspended` | error | internal | — | Día 31 sin pago — sin acceso facturación |

### Domain: `system` + `security` — CRITICALS (4 eventos)

| `event_name` | severity | pii_level | idempotency_key | Notas |
|---|---|---|---|---|
| `system.cross_tenant_attempt_blocked` | **critical** | sensitive_pii | — | Posible fuga — investigar inmediato |
| `system.price_tampering_attempt` | **critical** | sensitive_pii | — | Anti-fraude (ADR-0019 S4) |
| `system.fiscal_emergency_stop_activated` | **critical** | internal | — | CB3 disparado (ADR-0022) |
| `security.tls.validation_failed` | **critical** | internal | — | Cert AFIP no valida — MITM? (ADR-0019 S15) |

### Domain: `system.dead_job.*` — operator decisions sobre jobs (3 eventos — F0)

> Agregados en v2.0.1 (auditoría Lote 3). Cubren las acciones del operator definidas en RECONCILIATION-ENGINE §6.

| `event_name` | severity | pii_level | idempotency_key | Notas |
|---|---|---|---|---|
| `system.dead_job.re_enqueued` | warning | internal | — | Operator reactivó dead job tras fix raíz |
| `system.dead_job.discarded` | warning | internal | — | Operator descarta job (entidad cancelada/N.A.) — payload incluye `reason` obligatorio |
| `system.dead_job.resolved_manually` | warning | internal | — | Operator resolvió entidad de negocio + cerró job — payload con `resolution_summary` |

### Domain: `system.incident_handled` — runbook execution audit (1 evento — F0)

> Agregado en v2.0.1 (auditoría Lote 4). Cubre la ejecución de runbooks de incidente según RUNBOOKS/.

| `event_name` | severity | pii_level | idempotency_key | Notas |
|---|---|---|---|---|
| `system.incident_handled` | error | internal | — | Operator ejecutó runbook completo. Payload obligatorio: `{ runbook: string, severity_observed: S0\|S1\|S2\|S3, steps_taken: string[], outcome: string, duration_minutes: number }` |

**Total: 49 eventos auditables F0** (32 originales + 3 system.dead_job.* + 1 system.incident_handled v2.0.1 + 6 product.* v2.0.2 + 1 payment.method_reclassified v2.0.3/ADR-0026 + 6 de plata y acceso v2.1.0). Todo lo demás (cache hits, request lifecycle, debug, métricas, draft lifecycle, updates triviales) → Pino logs + counters.

### Lo que NO va a audit_log (deliberado)

| ❌ NO en audit_log | ✅ Va en otro lugar |
|---|---|
| `sale.draft.created` | Pino log debug |
| `sale.draft.item_added`, `item_quantity_updated`, `item_removed` | Pino log debug |
| `sale.customer_set` (durante draft) | Pino log debug — el customer snapshot final está en payload de `sale.completed` |
| `product.updated` (campos triviales: name, description, sku, barcode, stock_minimum, unit_type) | Pino log debug |
| `fiscal.wsaa.token_obtained/renewed` | Pino log + counter `wsaa.token.refresh` |
| `fiscal.padron.cuit_cache_hit` | counter `padron.cache_hit_rate` |
| `stock.reserved`, `stock.released` | Estado en `cart` table (no es event) |
| `system.cron.executed` | Pino log + counter `cron.executions` |
| `system.rate_limit_exceeded` | Pino log warn + counter `rate_limit.hit` |
| `payment.mp.qr_generated` | counter `payment.mp.qr_generated` |
| `fiscal.invoice.requested` | Es estado interno del job, no event auditable |
| `fiscal.invoice.afip_request_sent` | Pino log debug del worker |
| Pendientes / agenda (`task.*`: crear, completar, reabrir, editar, borrar) | Pino log — un pendiente es **intención**, no hecho económico; es la primera tabla que se edita a propósito (decidido v2.1.0) |
| Alta/edición de proveedores (`terceros`) | Pino log — no cambia plata ni stock |
| El `cash_movement` de un cobro o de la devolución de un gasto anulado | Resumido en `cash_session.closed*`; el hecho de negocio lo audita `customer.account.settled` / `expense.annulled` con el id |

### Regla de oro para decidir audit vs Pino

> **"¿Un auditor / contador / inspector AFIP querría ver este evento al reconstruir lo que pasó?"**
>
> - Sale completed: SÍ — base imponible registrada
> - Sale cancelled (pre-cobro): SÍ — explica por qué número fiscal saltó
> - Items agregados al draft: NO — son lifecycle interno
> - Product price changed: SÍ — afecta valuación + facturas futuras
> - Product description changed: NO — no afecta nada fiscal
> - Stock adjusted manually: SÍ — explica diferencias inventario
> - Stock decrement por venta: NO — derivable del payload de sale.completed

---

## 6. Naming convention

```
{domain}.{entity?}.{action}[.{outcome?}]
```

- **Lowercase + snake_case** por segmento
- **Punto como separador**
- **Verbos en pasado** (`created`, `received`, `failed`)
- **Outcome solo si dual** (`cae_received` vs `cae_rejected`)

Domains permitidos F0: `auth`, `sale`, `fiscal`, `payment`, `stock`, `product`, `cash_session`, `customer`, `expense` (v2.1.0), `subscription`, `system`, `security`. Sub-domains válidos F0: `system.dead_job.*`, `customer.account.*` y `auth.accountant.*` (v2.1.0).

**Naming inmutable post-release.** Si necesitás cambiar payload manteniendo semántica → bumpear `event_version`.

---

## 7. Severity levels

| Severity | Significado | Retention default |
|---|---|---|
| **info** | Operación normal exitosa | 90 días |
| **notice** | Operación destacable (ajustes, decisiones) | 1 año |
| **warning** | Algo no fatal que merece atención | 1 año |
| **error** | Operación falló pero sistema OK | 5 años |
| **critical** | Sistema o seguridad comprometido | 10 años |

**Override por domain:**

| Domain | Retention efectiva |
|---|---|
| `fiscal.*` | 10 años (Ley 11.683) |
| `payment.*` | 10 años (compliance financiero) |
| `subscription.*` financieros | 10 años |
| `auth.*` | aplicar tabla default (`auth.accountant.*`: plazo legal pendiente **B-5** abogado) |
| `system.*` críticos | 10 años |
| `expense.*`, `customer.account.*` | 10 años — son plata, igual que `payment.*` (v2.1.0) |

> ⚠️ **2026-09-14:** `computeRetentionDays` está especificada acá pero **no implementada** en `audit-writer.ts`: hoy todo evento vive lo que vive su partición anual (DROP PARTITION a los 10 años). Si se implementa, el override de `expense.*` y `customer.account.*` es obligatorio — con la tabla por defecto, `expense.registered` (info) duraría 90 días.

Función canónica al insertar:

```typescript
function computeRetentionDays(severity: Severity, eventName: string): number {
  const domain = eventName.split('.')[0];
  
  // Overrides fiscales (Ley 11.683)
  if (['fiscal', 'payment'].includes(domain)) return 365 * 10;
  if (domain === 'subscription') return 365 * 10;
  if (severity === 'critical') return 365 * 10;
  
  // Default por severity
  switch (severity) {
    case 'info': return 90;
    case 'notice': return 365;
    case 'warning': return 365;
    case 'error': return 365 * 5;
    case 'critical': return 365 * 10;
  }
}
```

**`debug` no existe en audit_log.** Si pensaste en debug → va a Pino log, no acá.

---

## 8. Idempotency semantics

Schema: `UNIQUE (tenant_id, idempotency_key)` en `audit_log`.

### Cuándo usar idempotency_key

Eventos que pueden disparar 2+ veces y deben colapsar a 1:

| `event_name` | `idempotency_key` |
|---|---|
| `sale.completed` | `sale_id` |
| `fiscal.invoice.cae_received` | CAE (único por AFIP) |
| `fiscal.invoice.reconciled_issued` | CAE |
| `payment.mp.confirmed` | `mp_event_id` |

### Cuándo NO

Eventos que reflejan transición única e irrepetible:
- `auth.login.success` (cada login es único)
- `stock.adjusted_manually` (cada ajuste es nuevo)
- `cash_session.opened` (cada apertura es nueva)

### Dedup window

UNIQUE constraint sin TTL: dedup hasta cleanup por retention. Para AFIP CAE eso es 10 años — colisión solo si AFIP reusa CAE (no pasa).

---

## 9. Anti-patterns (no son eventos auditables)

Si pensaste en agregar uno de estos al catálogo, **NO**:

- `button.clicked`, `modal.opened`, `route.changed` → UI traces (analytics frontend si se quiere)
- `query.executed`, `transaction.opened` → DB query logs (Pino)
- `worker.poll.tick`, `cron.tick` → debug worker (Pino)
- `form.field.changed`, `cart.updated` → UI state local
- `api.request.received`, `api.response.sent` → access logs (Vercel)

**Test:** ¿un humano querría saber 6 meses después que esto pasó? No → no es audit event.

---

## 10. Triggers de re-evaluación del catálogo

| Trigger | Acción |
|---|---|
| Aparece nuevo dominio de negocio | Considerar nuevo `domain` (revisar antes de agregar) |
| Bug requirió debugging y faltó audit visibility | Agregar evento con justificación |
| Inspector AFIP pide visibilidad que no tenemos | Agregar evento `audit_required` |
| Integración externa nueva F1+ | Agregar eventos del dominio asociado |
| 50+ clientes pagando | Re-evaluar §11 evolution path |

---

## 11. F1+/F2+ Evolution Path (lo que ESTABA en v1.0.0)

Esta sección documenta la **visión enterprise** que la v1.0.0 tenía. NO se implementa F0. Se referencia cuando aparezca trigger real.

### F1+ — Cuando aparece primera integración externa reactiva

Si aparece un caso real tipo "cuando se emite factura, enviar a sistema X del cliente":

**Agregar outbox pattern dedicado** (no reemplazar audit_log):

```sql
CREATE TABLE integration_outbox (
  id bigserial PRIMARY KEY,
  destination text NOT NULL,                 -- 'webhook_url' o 'integration_id'
  event_name text NOT NULL,
  payload jsonb NOT NULL,
  published_at timestamptz,
  attempts int DEFAULT 0,
  ...
);
```

Insert en la misma tx que la mutación. Worker publica + retry. Separado de `audit_log` y `jobs_queue` deliberadamente.

### F1+ — Cuando volumen métrico justifica OpenTelemetry

Cuando `metrics_counter` se vuelve insuficiente (queries lentas, dashboards pobres, falta de percentiles), migrar a:
- OpenTelemetry + Tempo/Jaeger para tracing
- Prometheus + Grafana para metrics
- Loki para logs

F0: counter Postgres simple alcanza con 5 clientes.

### F2+ — Cuando aparece event sourcing real

Si el modelo de dominio se vuelve event-sourced (reconstruir state desde events, projections múltiples), considerar:
- Tabla `events` separada con causation_id, version, snapshot pointers
- Event store dedicado (EventStoreDB, AxonDB)
- CQRS con read models proyectados

F0/F1: lifecycle states tradicionales con `commercial_status` + `fiscal_status` alcanza.

### F2+ — Cuando volumen requiere event bus

Cuando hay > 10 sistemas consumiendo eventos (analytics, ML, ETL, notifications, reporting), considerar:
- Kafka / NATS / Redpanda
- Outbox pattern global con CDC (Debezium)

F0/F1: jobs_queue + integration_outbox alcanzan.

### Reglas para promover de F0 a F1+

NO promover preventivamente. Trigger debe ser:
1. Caso de uso real con valor de negocio claro
2. Métrica F0 muestra bottleneck objetivo
3. Costo de mantener F0 supera costo de migrar

---

## 12. Conexión con Sesiones siguientes

- **Sesión 2 — Correlation-ID Propagation:** cómo el campo `correlation_id` (que ya está en `audit_log` + `jobs_queue`) se propaga client → server → service → worker → AFIP → audit. Spec end-to-end.
- **Sesión 3 — Reconciliation Engine:** cómo eventos como `fiscal.invoice.requires_reconciliation` se procesan por jobs (`afip.reconcile_pending`), qué states intermedios existen, dead letter, operator tooling.

Esta v2 simplificada es base correcta para ambas sesiones.

---

## Cambios respecto a v1.0.0 (2026-05-27 misma fecha — simplificación post-auditoría)

| Aspecto | v1.0.0 (deprecada) | v2.0.0 (F0) |
|---|---|---|
| Tablas | `outbox_events` + `audit_log` con FK | `audit_log` única + `jobs_queue` separada |
| Dual persistence | Sí | No |
| Worker async para eventos | Sí (cron 30s) | No (audit inline en tx) |
| Eventos catalogados | 107 | 32 |
| `causation_id` | Sí | No (defer F1+) |
| `UUID v7` | Sí (requiere extension no Supabase) | No (`bigserial`) |
| Triggers complejos con permits | Sí | No (INSERT-only strict) |
| Métricas | Mezcladas con eventos | Tabla `metrics_counter` separada |
| Tasks async | Mezclados con eventos | Tabla `jobs_queue` separada |
| Pino logs | Implícito | Concern explícito separado |
| Outbox enterprise | Base F0 | Diferido F1+ con trigger |
| Storage estimado 5 años | ~12GB | ~3GB |
| Líneas de doc | ~750 | ~600 (más enfocado) |

**Lo que se conserva conceptualmente:**
- Naming convention
- Severity levels + retention con overrides
- Anti-patterns (qué NO es event)
- Idempotency semantics
- Versionado del catálogo

---

## Relacionado con

- [DECISION-LEDGER.md](DECISION-LEDGER.md) — entries "EVENT-TAXONOMY v2.0.0 simplificada F0" + "Event Taxonomy v2.0.1 4 fixes técnicos" + Lote 3 auditoría
- [AUTHORITY-MAP.md](AUTHORITY-MAP.md) — autoridad clarificada: 4 concerns separados
- [CAPABILITY-MAP.md](CAPABILITY-MAP.md) — capabilities C-OBS-01 (audit_log), C-OBS-03 (metrics), C-PLT-02 (jobs_queue)
- [BOUNDED-CONTEXTS.md](BOUNDED-CONTEXTS.md) — qué context publica/consume cada evento + qué worker procesa cada job_type
- [CORRELATION-PROPAGATION.md](CORRELATION-PROPAGATION.md) — `correlation_id` propagation en audit_log + jobs_queue
- [RECONCILIATION-ENGINE.md](RECONCILIATION-ENGINE.md) — eventos `fiscal.invoice.*` y dead_job semantics
- [OPERATIONAL-SEVERITY.md](OPERATIONAL-SEVERITY.md) — mapping severity audit → severidad S0-S4 operativa
- ADR-0010 — idempotency obligatoria en mutations (consumida por `audit_log.idempotency_key`)
- ADR-0019 — audit_log inmutable + observability + security events críticos
- ADR-0022 — fiscal events (los 8 del catálogo §5 domain `fiscal`)
- Rule 04-observability — Pino + scrubbing + niveles
