# ROADMAP.md — Pandora ERP

**Versión:** 1.0.1
**Fecha:** 2026-06-03 (Sprint 6 actualizado post ADR-0023/0024/0025 + mini-auditoría coherencia)
**Estado:** vigente
**Propósito:** roadmap operativo super quirúrgico desde Sprint 0 (setup técnico) hasta Pilot Launch (5 clientes pagando TDF). Cada sprint con inputs requeridos, deliverables exactos, gating criteria, tests obligatorios, métricas de validación, y plan B ante bloqueos.

> **Target:** 14-16 semanas solo-dev (Agus) desde inicio Sprint 0 hasta primer cliente cobrando con factura AFIP CAE válida en producción.
>
> **Hallazgos críticos:** Hallazgo #1 (ticket no fiscal) + Hallazgo #2 (Ley 27.743) **GATEAN Sprint 6 (Fiscal core)**. Sprints 0-5 NO requieren cerrar contador/abogado — pueden arrancar inmediato. Sprint 6 espera cierre de A-2 + A-11 + B-6.

---

## Mapa visual de dependencias

```
┌──────────────────────────────────────────────────────────────────┐
│  PRE-FLIGHT (paralelo, semanas 1-6 según gating Sprint 6)        │
│  ─ Reuniones contador (A-1..A-11)                                │
│  ─ Reuniones abogado (B-1..B-10)                                 │
│  ─ DIFFS-TO-APPLY → WSL                                          │
│  ─ Cuentas (Vercel, Supabase, Resend, MP merchant)               │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│  Sprint 0 — Setup técnico WSL (1 semana)                         │
│  ─ Next.js 16 + Drizzle + Supabase managed                       │
│  ─ env.ts Zod fail-fast                                          │
│  ─ CI/CD GitHub Actions + Vercel preview                         │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│  Sprint 1 — Platform contexts base (2 semanas)                   │
│  ─ MultiTenant + Tracing + Observability + JobsQueue             │
│  ─ Audit + Security base                                         │
│  ─ Schema: audit_log partitioned + jobs_queue + metrics_counter  │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│  Sprint 2 — Identity context (2 semanas)                         │
│  ─ companies + users + user_roles + customers                    │
│  ─ Supabase Auth + JWT custom + RLS                              │
│  ─ Demo lifecycle (ADR-0020)                                     │
│  ─ Tests cross-tenant T-MT-01..07 OBLIGATORIOS                   │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│  Sprint 3 — Inventory context (2 semanas)                        │
│  ─ products (con tdf_exempt) + stock_movements append-only       │
│  ─ Búsqueda typeahead + barcode                                  │
│  ─ Tests oversell prevention                                     │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│  Sprint 4 — Cash context (1 semana)                              │
│  ─ cash_sessions + cash_movements                                │
│  ─ Apertura/cierre con descuadre                                 │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│  Sprint 5 — Sales + MercadoPago (2 semanas)                      │
│  ─ sales + sale_items + sale_payments                            │
│  ─ Cobro efectivo + MP QR                                        │
│  ─ Webhook MP HMAC + replay + dedup                              │
│  ─ Idempotency obligatoria                                       │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼ ⚠️ GATING: A-2 + A-11 + B-6 cerrados
┌──────────────────────────────────────────────────────────────────┐
│  Sprint 6 — Fiscal core (3 semanas) 🔴 BLOQUEABLE                │
│  ─ Projection Layer + Snapshot inmutable                         │
│  ─ FiscalBreakdown (Ley 27.743 — REQUIERE A-11)                  │
│  ─ Numeración SELECT FOR UPDATE                                  │
│  ─ WSAA + WSFEv1 + Padrón A5                                     │
│  ─ Circuit breakers + Fail-closed                                │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│  Sprint 7 — Reconciliation Engine (2 semanas) 🔴 BLOQUEABLE     │
│  ─ Worker afip-reconcile-pending + SKIP LOCKED                   │
│  ─ Recovery FECompUltimoAutorizado + validateRecoveredCae        │
│  ─ Constancia provisoria UI (REQUIERE A-2 + B-6)                 │
│  ─ Tests T-REC-01..07                                            │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│  Sprint 8 — Reporting + Notifications (1 semana)                 │
│  ─ Reportes diario/mensual + IVA                                 │
│  ─ Vista contador read-only multi-empresa                        │
│  ─ Email factura post-CAE                                        │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│  Sprint 9 — Hardening + Drills (1 semana)                        │
│  ─ Tests cross-tenant exhaustivos                                │
│  ─ Drills de runbooks (cada uno simulado)                        │
│  ─ Performance review (POS P95 < 3s)                             │
│  ─ Security review (CSP, rate limit, HMAC end-to-end)            │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│  Sprint 10 — Pilot Launch (1 semana)                             │
│  ─ Onboarding asistido cliente 1 → 5                             │
│  ─ Soporte intensivo                                             │
│  ─ Iteración basada en feedback real                             │
└──────────────────────────────────────────────────────────────────┘
```

**Tiempo total estimado:** 1 (pre-flight paralelo) + 1+2+2+2+1+2+3+2+1+1+1 = **17 semanas si secuencial**, **14-16 semanas con paralelización inteligente** (pre-flight + Sprints 1-5 mientras esperan respuestas contador/abogado para Sprint 6).

---

## Pre-flight — antes de Sprint 0

**Duración estimada:** 1 semana solo-dev / paralelizable con Sprints 0-5

### Inputs requeridos

- [DECISION-LEDGER.md](DECISION-LEDGER.md) — leer completo
- [CLAUDE.md](CLAUDE.md) — leer §1, §3, §22, §23
- [CAPABILITY-MAP.md](CAPABILITY-MAP.md) + [BOUNDED-CONTEXTS.md](BOUNDED-CONTEXTS.md) — leer mapas visuales
- [NON-GOALS.md](NON-GOALS.md) — leer header + categoría que aplique al pedido

### Tareas

#### 1. Reuniones contador (1-2 sesiones, ~3-4h total) 🔴 BLOQUEA Sprint 6

**Cuándo agendar:** ASAP. Es el item más demorado por gestión externa.

**Documento:** [reunion-contador-y-abogado.md](reunion-contador-y-abogado.md) Parte A.

**Output esperado:**
- A-1: Stage redondeo PER_LINE vs PER_BRACKET + conciliación centavos
- A-2: Modelo "constancia provisoria" post-2h (3 opciones) 🔴 BLOQUEA Sprint 7
- A-3: Captura legal_name/fiscal_address opcional vs obligatorio
- A-4: Política caché Padrón A5 + tolerancia timeout
- A-7: Manejo observed CAE
- A-8: Cold storage Glacier para XMLs > 1 año
- A-10: TDF — texto legal + rubros + default conservador
- **A-11: Ley 27.743 texto literal + estructura visual** 🔴 BLOQUEA Sprint 6 ticket impreso

**Honorarios estimados:** USD 100-300 según experiencia TDF del contador.

#### 2. Reuniones abogado (1 sesión, ~1-1.5h)

**Cuándo agendar:** ASAP en paralelo con contador.

**Documento:** [reunion-contador-y-abogado.md](reunion-contador-y-abogado.md) Parte B.

**Output esperado:**
- B-1: Responsabilidad civil error fiscal + RC profesional + SRL
- B-2: Inscripción AAIP cronograma + riesgo piloto
- B-3: Plazo + formato notificación breach AAIP
- B-4: Responsabilidades fuga cross-tenant
- B-5: Conservación legal docs NO fiscales
- **B-6: Ángulo civil/comercial de venta cobrada sin CAE** 🔴 BLOQUEA Sprint 7
- B-7: Cláusulas T&C
- B-8: DPA + Privacy Policy
- B-9: Mapping legal PII vs Ley 25.326
- B-10: ARCO vs conservación fiscal

**Honorarios estimados:** USD 100-300.

#### 3. Aplicar DIFFS-TO-APPLY.md al repo WSL

**Documento:** [DIFFS-TO-APPLY.md](DIFFS-TO-APPLY.md) + [CLAUDE-WSL-INSTRUCCIONES.md](CLAUDE-WSL-INSTRUCCIONES.md)

**Acciones:**
1. Backup actual `.claude/CLAUDE.md` del WSL (si existe)
2. Aplicar CLAUDE-WSL-INSTRUCCIONES.md (Opción C: docs/architecture/ espejo)
3. Copiar/sync 14 docs SRS canónicos a `~/workspace/pandora-erp/docs/architecture/`
4. Verificar que `.claude/rules/01-05-*.md` están alineados con ADRs actuales

**Gating criteria:** `ls ~/workspace/pandora-erp/docs/architecture/` lista los 14 docs.

#### 4. Setup cuentas externas

- [ ] Vercel team account (Hobby alcanza F0)
- [ ] Supabase project: 1 prod + 1 homologación
- [ ] Resend account (o equivalente para email)
- [ ] MercadoPago merchant account (test + producción)
- [ ] AFIP homologación: solicitar credenciales WSAA + WSFEv1 (proceso oficial ~7-14 días)
- [ ] Sentry account (free tier F0)
- [ ] GitHub repo con branch protection

**Gating criteria:** todos los API keys + cuentas creadas + secretos en password manager (NO en código).

#### 5. Memoria + DECISION-LEDGER review final

- [ ] Lotes auditoría 1-4 aplicados (post-auditoría 2026-05-28)
- [ ] Lotes 5-8 ejecutados o aprobados como diferidos
- [ ] Estado fiscal coherente: `requires_reconciliation` canónico
- [ ] Naming events: `fiscal.invoice.X` canónico
- [ ] Job_types: 10 unificados (catálogo cerrado)

**Gating criteria:** sesión nueva de Claude Code en repo WSL puede leer DECISION-LEDGER + CLAUDE.md y entender estado completo.

### Plan B si reuniones humanas se demoran

Si contador/abogado tardan > 3 semanas en agendar:
- Sprints 0-5 NO requieren respuestas — codear esos primero
- Sprint 6 fiscal core puede SCAFFOLDARSE (interface vacía) pero NO implementarse hasta cerrar A-2 + A-11
- Si > 6 semanas sin respuesta: contactar contador alternativo / abogado alternativo / búsqueda activa
- Hipótesis conservadoras documentadas: PER_LINE redondeo + Glacier OK XMLs > 1 año + default `tdf_exempt=false` + texto Ley 27.743 placeholder

### Cierre Pre-flight

| Check | OK / Pending |
|---|---|
| Contador agendado | ☐ |
| Abogado agendado | ☐ |
| Cuentas externas creadas | ☐ |
| AFIP homologación credentials solicitadas | ☐ |
| DIFFS-TO-APPLY aplicado a WSL | ☐ |
| Memoria + LEDGER en estado consistente | ☐ |

---

## Sprint 0 — Setup técnico WSL

**Duración estimada:** 1 semana solo-dev
**Pre-conditions:** Pre-flight completo (cuentas creadas; reuniones humanas pueden estar pending)
**Bloqueable por:** ninguno

### Inputs requeridos

- [CLAUDE.md §6](CLAUDE.md) — Architecture Constitution (stack approved)
- [BOUNDED-CONTEXTS.md](BOUNDED-CONTEXTS.md) — estructura de folders esperada
- ADR-0001 + ADR-0018 — stack tecnológico
- [CLAUDE-WSL-INSTRUCCIONES.md](CLAUDE-WSL-INSTRUCCIONES.md)

### Deliverables

#### Estructura de carpetas

```
~/workspace/pandora-erp/
├── .claude/
│   ├── CLAUDE.md                          (sync desde SRS)
│   ├── rules/
│   │   ├── 01-stack.md
│   │   ├── 02-multi-tenant.md
│   │   ├── 03-fiscal.md
│   │   ├── 04-observability.md
│   │   └── 05-visual-system.md
│   └── settings.json                      (allowedTools si aplica)
├── .github/
│   └── workflows/
│       ├── ci.yml                         (lint + typecheck + tests)
│       └── deploy.yml                     (Vercel preview)
├── docs/
│   ├── architecture/                      (espejo SRS canónicos)
│   ├── adrs/                              (espejo SRS ADRs físicos)
│   └── runbooks/                          (placeholder F0; copiar de SRS al ir necesitando)
├── drizzle/
│   └── migrations/                        (vacío inicial)
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx                       (placeholder)
│   │   └── api/
│   │       └── health/
│   │           └── route.ts               (deliverable visible)
│   ├── lib/
│   │   └── env.ts                         (Zod fail-fast)
│   └── styles/
│       └── globals.css                    (Tailwind 4 base)
├── tests/
│   ├── unit/                              (vacío)
│   ├── integration/                       (vacío)
│   └── e2e/                               (vacío)
├── .env.example                           (sin secretos, con shape Zod)
├── .gitignore
├── drizzle.config.ts
├── next.config.mjs
├── package.json
├── postcss.config.js
├── tailwind.config.ts
├── tsconfig.json                          (strict + noUncheckedIndexedAccess)
├── vercel.json                            (cron schedules placeholder)
└── README.md                              (delgado, apunta a docs/)
```

#### env.ts canónico

```typescript
// src/lib/env.ts
import { z } from 'zod';

const envSchema = z.object({
  // Runtime
  NODE_ENV: z.enum(['development', 'test', 'production']),
  
  // Supabase
  DATABASE_URL: z.string().url(),
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  
  // AFIP — Sprint 6 (placeholder Sprint 0)
  AFIP_ENVIRONMENT: z.enum(['homologacion', 'produccion']).optional(),
  AFIP_CUIT: z.string().regex(/^\d{11}$/).optional(),
  AFIP_CERT_PATH: z.string().optional(),
  AFIP_KEY_PATH: z.string().optional(),
  
  // Money — Sprint 6 (placeholder Sprint 0)
  MONEY_ROUNDING_POLICY: z.literal('HALF_EVEN').default('HALF_EVEN'),
  MONEY_ROUNDING_STAGE: z.enum(['PER_LINE', 'PER_TAX_BRACKET']).default('PER_LINE'),
  
  // Secrets vault
  SECRETS_ENCRYPTION_KEY_V1: z.string().length(64).regex(/^[0-9a-f]+$/i),
  SECRETS_ENCRYPTION_KEY_ACTIVE_VERSION: z.coerce.number().int().positive(),
  
  // Observability
  SENTRY_DSN: z.string().url().optional(),
});

const result = envSchema.safeParse(process.env);
if (!result.success) {
  console.error('Invalid env:', result.error.format());
  throw new Error('Env validation failed at boot');
}

export const env = result.data;
```

#### Health check endpoint

```typescript
// src/app/api/health/route.ts
import { sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';

export const runtime = 'nodejs';

export async function GET() {
  try {
    await db.execute(sql`SELECT 1`);
    return Response.json({ ok: true, db: 'reachable' });
  } catch (err) {
    return Response.json({ ok: false, db: 'unreachable', error: String(err) }, { status: 500 });
  }
}
```

### Tests obligatorios Sprint 0

- T-SETUP-01: `pnpm dev` arranca sin error
- T-SETUP-02: `pnpm test` (vitest) corre con 0 tests OK
- T-SETUP-03: `pnpm tsc --noEmit` sin errores
- T-SETUP-04: `pnpm eslint .` sin errores
- T-SETUP-05: GET `/api/health` devuelve `{ ok: true }` localmente
- T-SETUP-06: env sin variables requeridas → `pnpm dev` falla con mensaje claro de Zod

### Gating criteria Sprint 0

✅ Sprint 0 done cuando:
- [ ] Vercel preview deploy automático en cada PR
- [ ] GitHub Actions CI verde
- [ ] Health check responde OK en production
- [ ] env fail-fast funciona (test confirmado)
- [ ] `.claude/CLAUDE.md` accesible en sesiones Claude Code

### Métricas de validación

- Tiempo de boot local: < 5s
- Build production: < 60s
- Vercel cold start: < 3s

### Bloqueantes posibles + plan B

| Bloqueo | Plan B |
|---|---|
| Supabase project no se crea (capacidad / región) | Usar self-hosted Postgres temporal o esperar capacidad |
| Vercel preview no funciona | Local-only + manual deploy via CLI hasta resolver |
| `@supabase/ssr` versión cambiada | Pin version + abrir issue Supabase |

---

## Sprint 1 — Platform contexts base

**Duración estimada:** 2 semanas solo-dev
**Pre-conditions:** Sprint 0 done
**Bloqueable por:** ninguno

### Inputs requeridos

- [BOUNDED-CONTEXTS.md](BOUNDED-CONTEXTS.md) — Platform contexts: MultiTenant, Tracing, Observability, JobsQueue, Audit, Security
- [EVENT-TAXONOMY.md](EVENT-TAXONOMY.md) — schema canónico audit_log + jobs_queue + metrics_counter + 10 job_types + 36 events
- [CORRELATION-PROPAGATION.md](CORRELATION-PROPAGATION.md) — AsyncLocalStorage + bridge Edge→Node
- ADR-0001 + ADR-0010 + ADR-0019

### Deliverables

#### Schema DB (Drizzle migration #1)

```typescript
// src/lib/db/schema/platform.ts
import { pgTable, uuid, text, bigint, jsonb, timestamp, integer, primaryKey } from 'drizzle-orm/pg-core';

// audit_log partitioned por año (Drizzle no soporta partitioning nativo
// — usar raw SQL en migration custom)
export const auditLog = pgTable('audit_log', {
  id: bigint('id', { mode: 'number' }).notNull(),
  event_name: text('event_name').notNull(),
  event_version: text('event_version').notNull().default('v1'),
  tenant_id: uuid('tenant_id').notNull(),
  actor_user_id: uuid('actor_user_id'),
  actor_type: text('actor_type').notNull(),
  correlation_id: uuid('correlation_id').notNull(),
  request_id: uuid('request_id').notNull(),
  occurred_at: timestamp('occurred_at', { withTimezone: true }).notNull(),
  payload: jsonb('payload').notNull(),
  severity: text('severity').notNull(),
  pii_level: text('pii_level').notNull(),
  idempotency_key: text('idempotency_key'),
  retention_days: integer('retention_days').notNull(),
});

// jobs_queue (no partitioned)
export const jobsQueue = pgTable('jobs_queue', {
  id: bigint('id', { mode: 'number' }).primaryKey(),
  tenant_id: uuid('tenant_id').notNull(),
  job_type: text('job_type').notNull(),
  payload: jsonb('payload').notNull(),
  correlation_id: uuid('correlation_id').notNull(),
  last_request_id: uuid('last_request_id'),
  status: text('status').notNull().default('pending'),
  attempts: integer('attempts').notNull().default(0),
  max_attempts: integer('max_attempts').notNull().default(5),
  next_attempt_at: timestamp('next_attempt_at', { withTimezone: true }).notNull().defaultNow(),
  last_error: text('last_error'),
  started_at: timestamp('started_at', { withTimezone: true }),
  completed_at: timestamp('completed_at', { withTimezone: true }),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// metrics_counter
export const metricsCounter = pgTable('metrics_counter', {
  metric_name: text('metric_name').notNull(),
  tenant_id: uuid('tenant_id').notNull(),  // SYSTEM_TENANT_ID nil UUID si system-wide
  tag_key: text('tag_key').notNull().default(''),
  tag_value: text('tag_value').notNull().default(''),
  count: bigint('count', { mode: 'number' }).notNull().default(0),
  last_incremented_at: timestamp('last_incremented_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  pk: primaryKey({ columns: [table.metric_name, table.tenant_id, table.tag_key, table.tag_value] }),
}));

// processed_webhook_events (Security + Integrations comparten)
export const processedWebhookEvents = pgTable('processed_webhook_events', {
  provider: text('provider').notNull(),
  event_id: text('event_id').notNull(),
  processed_at: timestamp('processed_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  pk: primaryKey({ columns: [table.provider, table.event_id] }),
}));

// idempotency_log
export const idempotencyLog = pgTable('idempotency_log', {
  idempotency_key: text('idempotency_key').notNull(),
  tenant_id: uuid('tenant_id').notNull(),
  endpoint: text('endpoint').notNull(),
  response_payload: jsonb('response_payload').notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  pk: primaryKey({ columns: [table.idempotency_key, table.tenant_id] }),
}));
```

Migration raw SQL para audit_log partitioned + trigger inmutable + particiones 2026+2027 + secuencia + indexes.

#### Tracing context

```typescript
// src/lib/tracing/context.ts (ya documentado en CORRELATION-PROPAGATION §3.3)
// src/lib/tracing/server-action.ts (withServerActionTracing)
// src/lib/tracing/worker.ts (withWorkerTracing)
// src/lib/tracing/cron.ts (withCronTracing)
// src/lib/tracing/use-correlation.client.ts (useOperationCorrelationId hook)
```

#### Middleware Next.js

```typescript
// src/middleware.ts (ya documentado en CORRELATION-PROPAGATION §2.1)
```

#### Observability

```typescript
// src/lib/observability/logger.ts (Pino Proxy)
// src/lib/observability/metrics.ts (METRIC_WHITELIST + incrementCounter)
// src/lib/observability/audit.ts (auditLog helper)
```

#### MultiTenant

```typescript
// src/lib/multi_tenant/context.ts (withTenantContext + getCurrentTenantId)
// src/lib/multi_tenant/validation.ts (validateTenantAccess + CrossTenantAccessError)
// src/lib/multi_tenant/feature_flags.ts (isEnabled con cache TTL 60s)
```

#### JobsQueue

```typescript
// src/lib/jobs_queue/index.ts
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

// enqueue + fetchNextWithLock + markDone/Failed/Poisoned
```

#### Audit

```typescript
// src/lib/audit/index.ts (re-export desde Observability + cleanup helpers)
```

#### Security

```typescript
// src/lib/security/rate_limit.ts (in-memory F0)
// src/lib/security/hmac.ts (timing-safe HMAC validation)
// src/lib/security/vault.ts (AES-256-GCM con versioning)
// src/lib/security/csp.ts (middleware CSP headers)
```

### Tests obligatorios Sprint 1

- T-OBS-01: end-to-end correlation_id propagation HTTP → audit_log
- T-OBS-02: worker continuity (correlation_id heredado, request_id nuevo)
- T-OBS-03: logger auto-inject desde AsyncLocalStorage
- T-OBS-04: metrics whitelist enforcement (throw si tag no autorizado)
- T-OBS-05: audit_log inmutability (trigger throw en UPDATE/DELETE)
- T-SEC-01: CSP header presente
- T-SEC-02: HMAC validation webhook
- T-SEC-03: replay protection webhook (timestamp out of window)
- T-SEC-04: dedup webhook (event_id repetido)
- T-SEC-05: rate limit hits
- T-SEC-07: secret no logueado (lista canónica)

### Gating criteria Sprint 1

✅ Sprint 1 done cuando:
- [ ] Migration #1 aplicada en homologación + producción
- [ ] audit_log particiones 2026 + 2027 creadas
- [ ] Trigger inmutable funcional (verificar con UPDATE manual que tira excepción)
- [ ] Middleware genera request_id + propaga correlation_id
- [ ] Pino logger Proxy inyecta context automáticamente
- [ ] `incrementCounter('metric_no_en_whitelist')` throw
- [ ] 11 tests T-OBS-01..05 + T-SEC-01..07 verdes

### Métricas de validación

- audit_log insert latency P95: < 10ms
- jobs_queue SKIP LOCKED query: < 5ms
- Middleware overhead: < 2ms

### Bloqueantes posibles + plan B

| Bloqueo | Plan B |
|---|---|
| AsyncLocalStorage no preserva context en Next.js 16 Server Actions | Investigar React 19 + Next 16 issue; fallback: pasar correlation_id explícito como argumento (peor pero funcional) |
| Partitioning audit_log no funciona en Supabase managed | Alternativa: cleanup mensual con `DROP TRIGGER` temporal (anti-pattern documentado pero recoverable) |
| Pino Proxy mata performance | Fallback: logger sin Proxy + getTracingContext() explícito en cada log |

---

## Sprint 2 — Identity context

**Duración estimada:** 2 semanas solo-dev
**Pre-conditions:** Sprint 1 done
**Bloqueable por:** ninguno

### Inputs requeridos

- [BOUNDED-CONTEXTS.md](BOUNDED-CONTEXTS.md) — Identity context spec
- [CLAUDE.md §7](CLAUDE.md) — Multi-Tenant Constitution
- ADR-0002 + ADR-0008 + ADR-0019 S12 + ADR-0020
- CAPABILITY-MAP: C-IDE-01..05 + C-IDE-07 + C-OPS-09 + C-PLT-07 + C-PLT-08

### Deliverables

#### Schema DB (Drizzle migration #2)

```typescript
// src/lib/db/schema/identity.ts

export const companies = pgTable('companies', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  cuit: text('cuit').notNull(),
  
  // Demo lifecycle (ADR-0020)
  demo_state: text('demo_state').notNull().default('trial'),  // trial|read_only|archived|active
  demo_started_at: timestamp('demo_started_at', { withTimezone: true }).notNull().defaultNow(),
  
  // Jurisdicción + régimen fiscal (ADR-0022)
  merchant_jurisdiction_province: text('merchant_jurisdiction_province').notNull(),
  merchant_special_regime: text('merchant_special_regime'),  // 'LEY_19640' | null
  
  // Padrón A5 revalidation flag
  requires_fiscal_revalidation: boolean('requires_fiscal_revalidation').notNull().default(false),
  
  // Plan
  plan: text('plan').notNull().default('trial'),  // trial|kiosco|ferreteria|mercerria
  
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  cuitUnique: uniqueIndex('uq_companies_cuit').on(table.cuit),
  // CHECK constraint en raw SQL: merchant_jurisdiction_province IN ('TIERRA_DEL_FUEGO', 'CABA', 'BUENOS_AIRES', 'OTRAS_PROVINCIAS_F2_PLUS')
}));

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull(),
  supabase_auth_user_id: uuid('supabase_auth_user_id').notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  emailUnique: uniqueIndex('uq_users_email').on(table.email),
  supabaseUnique: uniqueIndex('uq_users_supabase').on(table.supabase_auth_user_id),
}));

export const userRoles = pgTable('user_roles', {
  user_id: uuid('user_id').notNull(),
  company_id: uuid('company_id').notNull(),
  role: text('role').notNull(),  // owner|cashier|accountant|support
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  pk: primaryKey({ columns: [table.user_id, table.company_id] }),
}));

export const customers = pgTable('customers', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenant_id: uuid('tenant_id').notNull(),
  doc_type: text('doc_type').notNull(),  // CUIT|DNI|CUIL
  doc_number: text('doc_number').notNull(),
  name: text('name').notNull(),
  email: text('email'),
  phone: text('phone'),
  iva_condition: text('iva_condition').notNull(),
  fiscal_address: text('fiscal_address'),  // opcional según A-3 contador
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  correlation_id: uuid('correlation_id'),  // trazabilidad creación
}, (table) => ({
  tenantDocUnique: uniqueIndex('uq_customers_tenant_doc').on(table.tenant_id, table.doc_type, table.doc_number),
  tenantIdx: index('idx_customers_tenant').on(table.tenant_id),
}));

export const featureFlags = pgTable('feature_flags', {
  tenant_id: uuid('tenant_id').notNull(),
  flag_key: text('flag_key').notNull(),
  enabled: boolean('enabled').notNull().default(false),
  payload: jsonb('payload'),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  pk: primaryKey({ columns: [table.tenant_id, table.flag_key] }),
}));
```

#### RLS policies (raw SQL migration)

```sql
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;

-- companies: owner ve su empresa; contador ve las de su company_ids[]
CREATE POLICY companies_owner_select ON companies FOR SELECT
  USING (id = (auth.jwt() ->> 'company_id')::uuid);

CREATE POLICY companies_accountant_select ON companies FOR SELECT
  USING (id::text = ANY(SELECT jsonb_array_elements_text(auth.jwt() -> 'company_ids')));

-- customers: tenant-scoped
CREATE POLICY customers_tenant_isolation ON customers FOR ALL
  USING (tenant_id = (auth.jwt() ->> 'company_id')::uuid);

-- ... etc.
```

#### Identity context

```typescript
// src/lib/identity/auth.ts (AuthService.loginWithSupabase + getCurrentContext)
// src/lib/identity/customers.ts (IdentityService.createCustomer + searchCustomers)
// src/lib/identity/invitations.ts (IdentityService.inviteAccountant)
// src/lib/identity/demo.ts (DemoService.transitionDemo)
// src/lib/identity/permissions.ts (RBAC simple: owner/cashier/accountant)
// src/lib/identity/index.ts (Public API exports)
```

#### Cron jobs

- `cron.archive_expired_demos` (worker en MultiTenant/Identity)

### Tests obligatorios Sprint 2

- T-MT-01: cross-tenant SELECT bloqueado por RLS
- T-MT-02: cross-tenant UPDATE bloqueado por RLS + service
- T-MT-03: contador multi-empresa solo ve sus `company_ids`
- T-MT-04: secreto de tenant A no accesible desde tenant B
- T-MT-05: numeración fiscal concurrente entre tenants sin colisión (placeholder, real test Sprint 6)
- T-MT-06: realtime broadcast de tenant A NO llega a cliente de tenant B
- T-MT-07: job de tenant A no procesa datos de tenant B (poison test)
- T-IDE-01: demo transitions día 60 → 82 → archive
- T-IDE-02: support_mode flag activación con audit
- T-IDE-03: contador con JWT company_ids[] ve empresas correctas
- T-IDE-04: customer snapshot inmutabilidad documentada (real test Sprint 5)

### Gating criteria Sprint 2

✅ Sprint 2 done cuando:
- [ ] Login/logout con Supabase Auth funciona
- [ ] JWT custom con `tenant_id` + `roles` + `company_ids[]`
- [ ] Tests cross-tenant 7/7 verdes (CRÍTICO)
- [ ] Demo cron transiciona correctamente
- [ ] Soporte impersonation flag con audit obligatorio

### Bloqueantes posibles + plan B

| Bloqueo | Plan B |
|---|---|
| RLS policies complejas con `company_ids[]` array | Helper function PL/pgSQL para chequeo; última opción: service-side ONLY |
| Demo cron deja race conditions | UNIQUE constraint en (tenant_id, demo_state) parcial + serializable retry |

---

## Sprint 3 — Inventory context

**Duración estimada:** 2 semanas solo-dev
**Pre-conditions:** Sprint 2 done
**Bloqueable por:** ninguno

### Inputs requeridos

- [BOUNDED-CONTEXTS.md](BOUNDED-CONTEXTS.md) — Inventory context
- ADR-0022 — `products.tdf_exempt`
- CAPABILITY-MAP: C-COM-02, C-COM-03, C-OPS-02..05

### Deliverables

#### Schema DB (Drizzle migration #3)

```typescript
// src/lib/db/schema/inventory.ts

export const products = pgTable('products', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenant_id: uuid('tenant_id').notNull(),
  name: text('name').notNull(),
  code: text('code').notNull(),  // código interno
  barcode: text('barcode'),  // EAN/UPC opcional
  price: numeric('price', { precision: 19, scale: 4 }).notNull(),
  stock_actual: numeric('stock_actual', { precision: 19, scale: 4 }).notNull().default('0'),
  min_stock: numeric('min_stock', { precision: 19, scale: 4 }).notNull().default('0'),
  tdf_exempt: boolean('tdf_exempt').notNull().default(false),  // ADR-0022
  category: text('category'),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  tenantCodeUnique: uniqueIndex('uq_products_tenant_code').on(table.tenant_id, table.code),
  tenantBarcodeIdx: index('idx_products_tenant_barcode').on(table.tenant_id, table.barcode),
  // trigram index para typeahead (raw SQL)
}));

// Trigram index para búsqueda (raw SQL migration)
// CREATE EXTENSION IF NOT EXISTS pg_trgm;
// CREATE INDEX idx_products_name_trgm ON products USING gin (name gin_trgm_ops);

export const stockMovements = pgTable('stock_movements', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  tenant_id: uuid('tenant_id').notNull(),
  product_id: uuid('product_id').notNull(),
  type: text('type').notNull(),  // sale|purchase|adjustment|return|loss
  qty: numeric('qty', { precision: 19, scale: 4 }).notNull(),
  reason: text('reason'),  // obligatorio si type=adjustment
  related_sale_id: uuid('related_sale_id'),
  related_purchase_id: uuid('related_purchase_id'),
  created_by: uuid('created_by'),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  correlation_id: uuid('correlation_id'),
}, (table) => ({
  tenantProductIdx: index('idx_stock_movements_tenant_product').on(table.tenant_id, table.product_id, table.created_at),
}));

// Trigger raw SQL: stock_movements append-only (THROW en UPDATE/DELETE)
```

#### RLS + Inventory context

```typescript
// src/lib/inventory/products.ts
// src/lib/inventory/stock.ts (con SELECT FOR UPDATE para oversell prevention)
// src/lib/inventory/queries.ts (search trigram + barcode lookup)
// src/lib/inventory/projection.ts (toSaleItemSnapshot)
// src/lib/inventory/index.ts (Public API)
```

### Tests obligatorios Sprint 3

- T-INV-01: CRUD products con tenant isolation (RLS + service)
- T-INV-02: Stock decremento concurrente NO oversell (SELECT FOR UPDATE)
- T-INV-03: Búsqueda typeahead < 100ms con 10k productos
- T-INV-04: Stock_movements append-only (trigger throw en UPDATE)
- T-INV-05: Ajuste manual sin reason → throw
- T-INV-06: Snapshot toSaleItemSnapshot determinístico

### Gating criteria Sprint 3

✅ Sprint 3 done cuando:
- [ ] CRUD products UI básica funcionando
- [ ] Búsqueda P95 < 100ms con 10k productos seed
- [ ] Test concurrencia oversell 6/6 verdes
- [ ] Snapshot inventario consistente

---

## Sprint 4 — Cash context

**Duración estimada:** 1 semana solo-dev
**Pre-conditions:** Sprint 2 done (NO requiere Sprint 3)
**Bloqueable por:** ninguno

### Inputs requeridos

- [BOUNDED-CONTEXTS.md](BOUNDED-CONTEXTS.md) — Cash context
- [RUNBOOKS/cash-discrepancy.md](RUNBOOKS/cash-discrepancy.md)
- CAPABILITY-MAP: C-OPS-01

### Deliverables

#### Schema DB (Drizzle migration #4)

```typescript
export const cashSessions = pgTable('cash_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenant_id: uuid('tenant_id').notNull(),
  sale_point: integer('sale_point').notNull(),
  opened_by: uuid('opened_by').notNull(),
  opened_at: timestamp('opened_at', { withTimezone: true }).notNull().defaultNow(),
  closed_at: timestamp('closed_at', { withTimezone: true }),
  initial_amount: numeric('initial_amount', { precision: 19, scale: 4 }).notNull(),
  final_amount: numeric('final_amount', { precision: 19, scale: 4 }),
  expected_amount: numeric('expected_amount', { precision: 19, scale: 4 }),
  descuadre: numeric('descuadre', { precision: 19, scale: 4 }),
  discrepancy_reason: text('discrepancy_reason'),
});

// Unique partial index: solo 1 session abierta por (tenant, sale_point)
// CREATE UNIQUE INDEX uq_cash_session_open
//   ON cash_sessions (tenant_id, sale_point) WHERE closed_at IS NULL;

export const cashMovements = pgTable('cash_movements', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  cash_session_id: uuid('cash_session_id').notNull(),
  type: text('type').notNull(),  // withdraw|deposit|provider_payment|...
  amount: numeric('amount', { precision: 19, scale: 4 }).notNull(),
  reason: text('reason').notNull(),
  created_by: uuid('created_by').notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
```

#### Cash context

```typescript
// src/lib/cash/sessions.ts (openSession + closeSession + getActiveSession)
// src/lib/cash/movements.ts (registerMovement)
// src/lib/cash/queries.ts (getSessionSummary)
// src/lib/cash/index.ts (Public API)
```

### Tests obligatorios Sprint 4

- T-CASH-01: solo 1 session abierta por (tenant, sale_point) — constraint enforce
- T-CASH-02: cierre con descuadre > umbral genera audit + métrica
- T-CASH-03: cierre sin descuadre limpio
- T-CASH-04: movimiento manual sin reason → throw
- T-CONC-02: cash session open concurrente bloqueado por unique partial index

### Gating criteria Sprint 4

✅ Sprint 4 done cuando:
- [ ] Apertura caja UI básica
- [ ] Cierre con conciliación (cuenta operator vs calculado)
- [ ] Descuadre genera audit + métrica con severidad correcta (S2 si > $5000 ARS, S3 si menor)

---

## Sprint 5 — Sales + MercadoPago

**Duración estimada:** 2 semanas solo-dev
**Pre-conditions:** Sprints 2 + 3 + 4 done
**Bloqueable por:** ninguno

### Inputs requeridos

- [BOUNDED-CONTEXTS.md](BOUNDED-CONTEXTS.md) — Sales + Integrations contexts
- ADR-0010 (idempotency) + ADR-0011 (retry serializable) + ADR-0019 S3+S3-bis (webhooks)
- [MONEY-POLICY.md](MONEY-POLICY.md)
- CAPABILITY-MAP: C-COM-01, C-COM-05, C-COM-06, C-OPS-12, C-INT-02

### Deliverables

#### Schema DB (Drizzle migration #5)

```typescript
// src/lib/db/schema/sales.ts

export const sales = pgTable('sales', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenant_id: uuid('tenant_id').notNull(),
  cash_session_id: uuid('cash_session_id'),
  customer_id: uuid('customer_id'),  // opcional para CF
  customer_snapshot: jsonb('customer_snapshot'),  // inmutable post-cobro
  
  total: numeric('total', { precision: 19, scale: 4 }).notNull(),
  total_iva: numeric('total_iva', { precision: 19, scale: 4 }).notNull(),
  
  commercial_status: text('commercial_status').notNull().default('draft'),
  fiscal_status: text('fiscal_status').notNull().default('not_required'),  // see CLAUDE.md §12.2
  
  cae: text('cae'),  // se llena en Sprint 6
  cae_expiration: text('cae_expiration'),
  
  correlation_id: uuid('correlation_id').notNull(),
  created_by: uuid('created_by').notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  charged_at: timestamp('charged_at', { withTimezone: true }),
  
  // Manual resolution
  manual_resolution_at: timestamp('manual_resolution_at', { withTimezone: true }),
  manual_resolution_by: uuid('manual_resolution_by'),
  manual_resolution_note: text('manual_resolution_note'),
}, (table) => ({
  tenantStatusIdx: index('idx_sales_tenant_status').on(table.tenant_id, table.fiscal_status, table.created_at),
  correlationIdx: index('idx_sales_correlation').on(table.correlation_id),
}));

export const saleItems = pgTable('sale_items', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  sale_id: uuid('sale_id').notNull(),
  product_snapshot: jsonb('product_snapshot').notNull(),  // inmutable
  qty: numeric('qty', { precision: 19, scale: 4 }).notNull(),
  unit_price: numeric('unit_price', { precision: 19, scale: 4 }).notNull(),
  line_subtotal: numeric('line_subtotal', { precision: 19, scale: 4 }).notNull(),
  line_iva: numeric('line_iva', { precision: 19, scale: 4 }).notNull(),
  line_total: numeric('line_total', { precision: 19, scale: 4 }).notNull(),
  iva_rate: numeric('iva_rate', { precision: 5, scale: 2 }).notNull(),
});

export const salePayments = pgTable('sale_payments', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  sale_id: uuid('sale_id').notNull(),
  method: text('method').notNull(),  // cash|debit|credit|mp_qr
  amount: numeric('amount', { precision: 19, scale: 4 }).notNull(),
  mp_payment_id: text('mp_payment_id'),  // null si no es MP
});

// src/lib/db/schema/mp_payments.ts (Integrations context)
export const mpPayments = pgTable('mp_payments', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenant_id: uuid('tenant_id').notNull(),
  sale_id: uuid('sale_id').notNull(),
  mp_payment_id: text('mp_payment_id').notNull(),
  status: text('status').notNull(),
  amount: numeric('amount', { precision: 19, scale: 4 }).notNull(),
  webhook_received_at: timestamp('webhook_received_at', { withTimezone: true }),
  reconciled_at: timestamp('reconciled_at', { withTimezone: true }),
}, (table) => ({
  mpUnique: uniqueIndex('uq_mp_payments_mp_id').on(table.mp_payment_id),
}));
```

#### Sales context

```typescript
// src/lib/sales/draft.ts (createDraft + addItem + applyDiscount)
// src/lib/sales/charge.ts (cobrar - con idempotency)
// src/lib/sales/cancel.ts (cancel pre-cobro)
// src/lib/sales/queries.ts (findById, findByCorrelationId)
// src/lib/sales/pricing.internal.ts (NO exportar — internal)
// src/lib/sales/state_machine.ts (transition fiscal_status)
// src/lib/sales/index.ts (Public API)
```

#### Integrations.MercadoPago

```typescript
// src/lib/integrations/mp/client.ts (MP SDK wrapper)
// src/lib/integrations/mp/webhook.ts (HMAC + replay + dedup)
// src/lib/integrations/mp/payment.ts (createPayment + handleWebhook)
// src/lib/workers/mp-reconcile-webhook-worker.ts
// src/app/api/webhooks/mp/route.ts (entry point)
```

### Tests obligatorios Sprint 5

- T-SALES-01: createDraft + addItem + applyDiscount + cobrar flow completo
- T-SALES-02: customer_snapshot inmutable post-cobro
- T-SALES-03: idempotency key colapsa segundo cobro
- T-MP-01: webhook HMAC válido procesa OK
- T-MP-02: webhook con timestamp out of window → 401
- T-MP-03: webhook duplicado (mismo event_id) → no procesa de nuevo
- T-MP-04: payment confirmation actualiza sale_payments
- T-MONEY-01..07 todos verdes (incluye projections básicas sin AFIP todavía)

### Gating criteria Sprint 5

✅ Sprint 5 done cuando:
- [ ] Venta completa con cobro efectivo funciona
- [ ] Venta completa con MP QR funciona (sandbox MP)
- [ ] Webhook MP HMAC validated + dedup funciona
- [ ] T-MONEY-01..07 verdes
- [ ] Idempotency obligatoria probada
- [ ] customer_snapshot persiste inmutable

### Bloqueantes posibles + plan B

| Bloqueo | Plan B |
|---|---|
| MP sandbox no responde | Mock MP client + skip integration tests temporal |
| Decimal.js performance issue | Profile + cache pricing calculations |

---

## Sprint 6 — Fiscal core 🔴 BLOQUEABLE

**Duración estimada:** 3 semanas solo-dev
**Pre-conditions:** Sprints 1-5 done **+ A-2 + A-11 cerrados (contador) + B-6 cerrado (abogado)**
**Bloqueable por:** Hallazgos críticos #1 + #2 sin cerrar

### ⚠️ Gating obligatorio antes de empezar

**Contador (7 items — todos cerrados):**

- [ ] **A-11 cerrado:** texto literal Ley 27.743 + estructura visual + sanción confirmada con contador
- [ ] **A-2 cerrado:** modelo "constancia provisoria" definido (opción A/B/C/otro) con leyenda + plazos
- [ ] **A-1 cerrado:** stage redondeo PER_LINE vs PER_BRACKET decidido
- [ ] **A-10 cerrado:** texto TDF Ley 19.640 + rubros amparados + default conservador
- [ ] **A-4 cerrado:** política caché Padrón A5 + tolerancia timeout
- [ ] **A-18 cerrado:** RG 5003/2021 — RI a Monotri = clase A + leyenda Ley 27.618 (aplicabilidad a LIS retail TDF)
- [ ] **A-19 cerrado:** RG 5762/2025 — sub-tipos clase A ("OPERACIÓN SUJETA A RETENCIÓN" / "PAGO EN CBU INFORMADA") aplicabilidad caso por caso
- [ ] **A-20 cerrado:** RG 5782/2025 — política CAEA pool + flujo de contingencia (revisa A-2 + B-6)
- [ ] **A-21 cerrado:** RG 5824/2026 — vinculación PV ↔ actividad económica opcional vs estructura de PVs en Pandora
- [ ] **A-22 cerrado (NUEVA — agregada en ADR-0023):** representación legal vinculante del QR fiscal (imagen PNG vs payload JSON Base64 vs ambas equivalentes)

**Abogado:**

- [ ] **B-6 cerrado:** ángulo legal de venta cobrada sin CAE confirmado por abogado

Si todos cerrados → arrancar. Si alguno pending → STOP + insistir con contador/abogado.

> **Nota post-ADRs 2026-06-02:** los gating A-18 a A-22 fueron agregados durante la sesión de ADRs estratégicos (0023/0024/0025). El bloque original Sprint 6 incluía solo A-1, A-2, A-4, A-10, A-11 + B-6.

### Inputs requeridos

- **ADRs base fiscales:**
  - ADR-0004 (parcialmente invalidado, ver §8.10 CLAUDE.md + ver ADR-0023 §"Decisión 4" para CAE/CAEA)
  - ADR-0005 + ADR-0006 + ADR-0019 (S15+S16) + ADR-0022
- **ADRs estratégicos 2026-06-02 (OBLIGATORIOS):**
  - **ADR-0023 — Snapshot Fiscal Completo** (CondicionIVAReceptor + QR fiscal + tax_policy_version + CAE/CAEA explícito)
  - **ADR-0024 — IA Boundary Policy** ("IA sugiere, nunca decide" en fiscal)
  - **ADR-0025 — Catálogos Regulatorios Runtime** (12 métodos `FEParam*` + cache + boot validation fail-closed)
- **Docs gobernantes:**
  - [MONEY-POLICY.md](MONEY-POLICY.md) — completa
  - [RECONCILIATION-ENGINE.md](RECONCILIATION-ENGINE.md) — §2 estados fiscales
  - [CLAUDE.md §8](CLAUDE.md) — Fiscal Constitution completa
  - [BOUNDED-CONTEXTS.md](BOUNDED-CONTEXTS.md) — Fiscal context (incluye `src/lib/fiscal/catalogs/`)
  - [tax-policy-versions/ar-2026-06-v1.md](tax-policy-versions/ar-2026-06-v1.md) — perfil normativo vigente al momento de Sprint 6 (o la versión siguiente si entra en vigor RG 5782/5785 el 01/08/2026)

### Deliverables

#### Schema DB (Drizzle migration #6)

```typescript
// src/lib/db/schema/fiscal.ts

export const invoices = pgTable('invoices', {
  id: uuid('id').primaryKey().defaultRandom(),
  sale_id: uuid('sale_id').notNull(),
  tenant_id: uuid('tenant_id').notNull(),
  
  sale_point: integer('sale_point').notNull(),
  invoice_type: integer('invoice_type').notNull(),  // 1=A, 6=B, 11=C, etc.
  invoice_number: integer('invoice_number').notNull(),
  
  cae: text('cae').notNull(),
  cae_expiration: text('cae_expiration').notNull(),  // YYYYMMDD
  
  emitted_at: timestamp('emitted_at', { withTimezone: true }).notNull().defaultNow(),
  correlation_id: uuid('correlation_id').notNull(),
}, (table) => ({
  saleUnique: uniqueIndex('uq_invoices_sale').on(table.sale_id),
  tenantNumberUnique: uniqueIndex('uq_invoices_number').on(table.tenant_id, table.sale_point, table.invoice_type, table.invoice_number),
}));

export const fiscalSnapshots = pgTable('fiscal_snapshots', {
  id: uuid('id').primaryKey().defaultRandom(),
  invoice_id: uuid('invoice_id').notNull(),
  
  // Versioning — convención ADR-0023
  calculation_engine_version: text('calculation_engine_version').notNull(),  // 'v1.0.0' F0
  tax_policy_version: text('tax_policy_version').notNull(),  // 'ar-YYYY-MM-vN' — archivo Git inmutable en tax-policy-versions/
  
  // Snapshot completo (jsonb + columnas materializadas críticas)
  rounding_mode: text('rounding_mode').notNull(),  // HALF_EVEN
  rounding_stage: text('rounding_stage').notNull(),  // PER_LINE
  currency_code: text('currency_code').notNull().default('ARS'),
  
  // Jurisdicción + régimen
  merchant_jurisdiction_province: text('merchant_jurisdiction_province').notNull(),
  merchant_special_regime: text('merchant_special_regime'),
  transaction_in_special_zone: boolean('transaction_in_special_zone').notNull(),
  
  // Breakdown Ley 27.743 (inmutable)
  fiscal_breakdown: jsonb('fiscal_breakdown').notNull(),
  
  // CondicionIVAReceptor — RG 5616/2024 obligatorio desde 01/08/2025 (ADR-0023 Decisión 1)
  // Persistir id + desc al momento de emitir = snapshot autosuficiente
  condicion_iva_receptor_id: integer('condicion_iva_receptor_id').notNull(),
  condicion_iva_receptor_desc_at_emission: text('condicion_iva_receptor_desc_at_emission').notNull(),
  condicion_iva_receptor_catalog_version_at_emission: jsonb('condicion_iva_receptor_catalog_version_at_emission').notNull(),  // {fetched_from_arca_at, hash, size} — ADR-0025
  
  // QR fiscal — RG 4892/2020 (ADR-0023 Decisión 2)
  // Payload JSON completo permite reproducibilidad bit-perfect; imagen NO se persiste
  qr_version: integer('qr_version').notNull(),  // 1 al momento de redactar ADR-0023
  qr_payload_json: jsonb('qr_payload_json').notNull(),  // 13 campos spec ARCA
  qr_url_base_at_emission: text('qr_url_base_at_emission').notNull(),  // "https://www.arca.gob.ar/fe/qr/"
  
  // Tipo de autorización CAE vs CAEA — RG 5782/2025 + RG 5785/2025 vigentes 01/08/2026 (ADR-0023 Decisión 4)
  authorization_code_type: text('authorization_code_type').notNull(),  // 'CAE' | 'CAEA' — alineado con tipoCodAut del QR
  
  // WSFEv1
  wsfe_version: text('wsfe_version').notNull().default('WSFEv1'),
  wsfe_request_payload: jsonb('wsfe_request_payload').notNull(),
  wsfe_response_raw: jsonb('wsfe_response_raw').notNull(),
  
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  // CHECK constraints recomendados
  authCodeTypeCheck: check('fiscal_snapshots_auth_code_type_check', sql`${table.authorization_code_type} IN ('CAE', 'CAEA')`),
}));

// NOTA ADR-0023/0025: la tabla customer_snapshots (no listada aquí) debe persistir
// condicion_iva_receptor_id_at_emission + condicion_iva_receptor_desc_at_emission para
// el receptor cuando aplica. Ver ADR-0023 §"Customer Snapshot ampliado".

// Trigger raw SQL: fiscal_snapshots inmutable post-creación

export const invoiceSequences = pgTable('invoice_sequences', {
  tenant_id: uuid('tenant_id').notNull(),
  sale_point: integer('sale_point').notNull(),
  invoice_type: integer('invoice_type').notNull(),
  next_number: integer('next_number').notNull().default(1),
}, (table) => ({
  pk: primaryKey({ columns: [table.tenant_id, table.sale_point, table.invoice_type] }),
}));

export const wsaaTokensCache = pgTable('wsaa_tokens_cache', {
  tenant_id: uuid('tenant_id').primaryKey(),
  token: text('token').notNull(),  // encrypted
  sign: text('sign').notNull(),  // encrypted
  expires_at: timestamp('expires_at', { withTimezone: true }).notNull(),
  generated_at: timestamp('generated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const padronA5Cache = pgTable('padron_a5_cache', {
  cuit: text('cuit').primaryKey(),
  data: jsonb('data').notNull(),
  fetched_at: timestamp('fetched_at', { withTimezone: true }).notNull().defaultNow(),
});
```

#### Fiscal context

```typescript
// src/lib/fiscal/projection/wsfev1.ts (función pura projectToWSFEv1)
// src/lib/fiscal/snapshot.ts (persistir snapshot inmutable — campos ADR-0023 ampliados)
// src/lib/fiscal/breakdown.ts (Ley 27.743 — projectToFiscalBreakdown)
// src/lib/fiscal/numeration.ts (SELECT FOR UPDATE)
// src/lib/fiscal/wsaa.ts (token cache + refresh)
// src/lib/fiscal/padron.ts (Padrón A5 cache)
// src/lib/fiscal/circuit_breakers.ts (CB1+CB2+CB3+CB4 ADR-0022)
// src/lib/fiscal/fail_closed.ts (8 escenarios CLAUDE.md §8.12)
// src/lib/fiscal/services/FiscalService.ts (emitInvoice + reconcilePending)
//
// Módulo catalogs/ (NUEVO — introducido por ADR-0025)
// src/lib/fiscal/catalogs/registry.ts (CatalogRegistry — lookup runtime)
// src/lib/fiscal/catalogs/cache.ts (Cache in-memory con TTL por catálogo)
// src/lib/fiscal/catalogs/errors.ts (CatalogNotAvailableError, CatalogIdNotInVersionError)
// src/lib/fiscal/catalogs/boot.ts (bootFiscalModule — preload 7 críticos F0, fail-closed)
// src/lib/fiscal/catalogs/types.ts (CatalogEntry, CatalogReference, ResolveInboundIds patrón)
// src/lib/workers/catalog-refresh.ts (Cron diario refresh + audit `system.catalog.degraded_fail_closed`)
// src/lib/fiscal/qr.ts (NUEVO — generador determinístico del payload QR según spec RG 4892/2020)
// src/lib/fiscal/services/FiscalQuery.ts
// src/lib/fiscal/index.ts (Public API)

// src/lib/integrations/afip/client.ts (SOAP client — TLS 1.2+ obligatorio)
// src/lib/integrations/afip/wsaa.ts (autenticación)
// src/lib/integrations/afip/wsfev1.ts (SOAP envelopes)
// src/lib/integrations/afip/padron_a5.ts
// src/lib/integrations/afip/ntp.ts (getCurrentFiscalTime + drift check)
```

#### Cron jobs

- `afip.refresh_wsaa_token` (cada 30min worker check)
- `afip.refresh_padron` (cron diario nocturno)

### Tests obligatorios Sprint 6

- T-MONEY-01..07 todos verdes (con projections reales ahora)
- T-FISCAL-01: emisión happy path WSFEv1 homologación
- T-FISCAL-02: `ImpIVA == sum(Iva[].Importe)` tolerancia 0
- T-FISCAL-03: customer snapshot tipo A con DocTipo=80 (CUIT)
- T-FISCAL-04: customer snapshot tipo C sin array IVA
- T-FISCAL-05: TDF con `merchant_special_regime='LEY_19640'` + producto `tdf_exempt=true` → ImpOpEx
- T-FISCAL-06: Padrón A5 CUIT inválido → rechazo CAE
- T-FISCAL-07: FiscalBreakdown Ley 27.743 con texto correcto
- T-FISCAL-08: Snapshot reproducibilidad (reproduceInvoice da idéntico)
- T-CONC-01: 100 emisiones concurrentes mismo (tenant, sale_point, invoice_type) → 100 números distintos sin colisión
- T-SEC-06: TLS 1.2+ enforcement con AFIP

### Gating criteria Sprint 6

✅ Sprint 6 done cuando:
- [ ] Emisión WSFEv1 homologación funcional happy path
- [ ] FiscalBreakdown Ley 27.743 imprime con texto/estructura confirmados A-11
- [ ] TDF amparado proyecta correctamente con ImpOpEx
- [ ] T-CONC-01 (100 emisiones concurrentes) verde
- [ ] Circuit breakers + fail-closed scenarios todos cubiertos
- [ ] NTP drift check funcional
- [ ] WSAA token cache + refresh proactivo OK

### Bloqueantes posibles + plan B

| Bloqueo | Plan B |
|---|---|
| AFIP homologación demora > 2 semanas en aprobar | Sprints 7+8+9 con mocks AFIP; deploy a prod sin emitir hasta aprobación |
| Padrón A5 timeout frecuente | Caché agresivo + fail-closed (consultar A-4 contador) |
| WSFEv1 SOAP lib incompatible Node 22 | Custom HTTP+XML implementation; comparar `node-soap` vs alternativas |

---

## Sprint 7 — Reconciliation Engine 🔴 BLOQUEABLE

**Duración estimada:** 2 semanas solo-dev
**Pre-conditions:** Sprint 6 done **+ A-2 + B-6 cerrados (modelo constancia provisoria)**
**Bloqueable por:** A-2 + B-6 sin cerrar

### Inputs requeridos

- [RECONCILIATION-ENGINE.md](RECONCILIATION-ENGINE.md) — completa
- [RUNBOOKS/afip-outage.md](RUNBOOKS/afip-outage.md)
- [RUNBOOKS/dead-jobs-resolution.md](RUNBOOKS/dead-jobs-resolution.md)
- ADR-0004 (post-refactor de A-2) + ADR-0011

### Deliverables

#### Reconciliation Engine

```typescript
// src/lib/fiscal/recovery.ts
//   fetchUltimoAutorizado (FECompUltimoAutorizado)
//   fetchAndRestoreLostCae (FECompConsultar)
//   validateRecoveredCae (match ImpTotal + DocTipo + DocNro)

// src/lib/workers/afip-reconcile-pending-worker.ts
//   reconcileSingleInvoice
//   applyReconciliationResult
//   tryRecoverLostCae
//   processJobWithPoisonDetection
```

#### Constancia provisoria UI

```tsx
// Diseño exacto depende de respuesta A-2:
// Opción A: imprimir constancia con leyenda + obligación 10 días
// Opción B: anular venta + devolver dinero
// Opción C: esperar contingencia (no realista)

// src/components/pos/ConstanciaProvisoria.tsx
// src/lib/fiscal/constancia.ts (generación leyenda + número interno)
```

#### Operator queries Q1-Q4 documentadas

```typescript
// docs/operator-queries/q1-active-reconciliations.sql
// docs/operator-queries/q2-dead-jobs.sql
// docs/operator-queries/q3-poison-events.sql
// docs/operator-queries/q4-investigation-by-correlation-id.sql
```

### Tests obligatorios Sprint 7

- T-REC-01: AFIP timeout → worker recovery exitoso con FECompUltimoAutorizado
- T-REC-02: Worker crash mid-processing → otro worker NO procesa el mismo job (SKIP LOCKED)
- T-REC-03: Browser reload mid-venta → `correlation_id` recovered desde sessionStorage
- T-REC-04: Browser tab close mid-venta → al reabrir, sales pendiente con `correlation_id` visible
- T-REC-05: Poison job detección inmediata + aislamiento + audit
- T-REC-06: AFIP retorna mismatch en recovery → no acepta + manual_resolution_required
- T-REC-07: MP webhook duplicado → segundo ignorado (ya Sprint 5)
- T-FISCAL-09: Constancia provisoria genera con leyenda correcta (post A-2)

### Gating criteria Sprint 7

✅ Sprint 7 done cuando:
- [ ] Worker reconciliación SKIP LOCKED funciona
- [ ] Recovery FECompUltimoAutorizado + validateRecoveredCae OK
- [ ] Constancia provisoria UI según A-2 (opción elegida)
- [ ] 7 tests T-REC verdes
- [ ] Dead letter philosophy implementada (MAX_ATTEMPTS=24 → manual_resolution_required)
- [ ] Poison detection inmediata

---

## Sprint 8 — Reporting + Notifications

**Duración estimada:** 1 semana solo-dev
**Pre-conditions:** Sprint 7 done
**Bloqueable por:** ninguno

### Inputs requeridos

- [BOUNDED-CONTEXTS.md](BOUNDED-CONTEXTS.md) — Reporting + Notifications
- CAPABILITY-MAP: C-OPS-06, C-OPS-07, C-OPS-08, C-NTF-01..03, C-INT-03

### Deliverables

#### Reporting

```typescript
// src/lib/reporting/sales_report.ts
// src/lib/reporting/iva_report.ts
// src/lib/reporting/stock_report.ts
// src/lib/reporting/cash_session_report.ts
// src/lib/reporting/export.ts (toCSV + toExcel)
// src/lib/reporting/index.ts
```

#### Notifications

```typescript
// src/lib/notifications/templates/invoice.tsx
// src/lib/notifications/templates/demo_expiring.tsx
// src/lib/notifications/templates/breach_notification.tsx
// src/lib/notifications/services/NotificationService.ts
// src/lib/workers/email-send-invoice-worker.ts
// src/lib/workers/email-send-breach-notification-worker.ts

// src/lib/integrations/email/client.ts (Resend wrapper)
```

#### Schema

```typescript
export const notificationLog = pgTable('notification_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenant_id: uuid('tenant_id').notNull(),
  type: text('type').notNull(),
  recipient: text('recipient').notNull(),
  status: text('status').notNull().default('pending'),
  sent_at: timestamp('sent_at', { withTimezone: true }),
  retry_count: integer('retry_count').notNull().default(0),
  last_error: text('last_error'),
  correlation_id: uuid('correlation_id').notNull(),
});
```

### Tests obligatorios Sprint 8

- T-REP-01: reporte ventas día con totales por forma de pago
- T-REP-02: reporte IVA con totales por alícuota
- T-REP-03: vista contador C-IDE-02 con company_ids[] correcto
- T-REP-04: export CSV/Excel formato compatible AFIP
- T-NTF-01: email factura enviado tras `fiscal.invoice.cae_received`
- T-NTF-02: idempotency email por (sale_id, recipient)

### Gating criteria Sprint 8

✅ Sprint 8 done cuando:
- [ ] Reportes operativos funcionan
- [ ] Vista contador multi-empresa funciona con JWT array
- [ ] Email factura post-CAE delivered (homologación + producción)

---

## Sprint 9 — Hardening + Drills

**Duración estimada:** 1 semana solo-dev
**Pre-conditions:** Sprint 8 done
**Bloqueable por:** ninguno

### Inputs requeridos

- [OPERATIONAL-SEVERITY.md](OPERATIONAL-SEVERITY.md) — matriz completa
- [RUNBOOKS/](RUNBOOKS/) — todos los 6 F0
- [CLAUDE.md §11](CLAUDE.md) — Security Constitution
- [CLAUDE.md §18](CLAUDE.md) — Testing Constitution

### Deliverables

#### Tests adicionales

- T-MT-08: cross-tenant SELECT/UPDATE/DELETE en TODAS las tablas tenant-aware (autogenerar tests)
- T-PERF-01: POS happy path P95 < 3s con 100 ventas concurrentes simuladas
- T-PERF-02: AFIP request latency P95 < 5s con homologación
- T-SEC-08: CSP nonce funciona en producción
- T-SEC-09: rate limit 100 req/min por IP enforced
- T-RUN-01..06: cada runbook ejecutado simulado + tiempo cronometrado

#### Drills de runbooks

Por cada runbook F0:
- [afip-outage.md](RUNBOOKS/afip-outage.md): simular AFIP DOWN → seguir runbook → confirmar UX cliente + circuit breaker
- [cross-tenant-leak.md](RUNBOOKS/cross-tenant-leak.md): no se puede simular real, dry-run con tenant test
- [cash-discrepancy.md](RUNBOOKS/cash-discrepancy.md): cerrar caja con descuadre forzado
- [dead-jobs-resolution.md](RUNBOOKS/dead-jobs-resolution.md): forzar 11 dead jobs + ejecutar Q2
- [security-incident.md](RUNBOOKS/security-incident.md): simular credentials filtradas (cuenta test)
- [breach-notification.md](RUNBOOKS/breach-notification.md): redactar template emails (sin enviar)

#### Métricas a configurar

ALERT_THRESHOLDS del OPERATIONAL-SEVERITY (10 alertas):
- `reconciliation.outcome` (manual_required + reconciliation_timeout)
- `reconciliation.poison_jobs_detected`
- `reconciliation.dead_jobs_waiting`
- `system.webhook.replay_detected`
- `system.cross_tenant.blocked`
- `system.price_tampering_attempt`

#### Sentry instrumentación

- Capturar errors + fatal logs
- Tagging con tenant_id + correlation_id (sin PII)

### Gating criteria Sprint 9

✅ Sprint 9 done cuando:
- [ ] Tests cross-tenant exhaustivos verdes (todas las tablas)
- [ ] 6 runbooks F0 ejecutados drill + tiempos documentados
- [ ] Métricas configuradas + dashboard básico
- [ ] Sentry capturando errors
- [ ] Performance review documentado (P95 numbers)
- [ ] Security review pasado (CSP + rate limit + HMAC end-to-end)

### Plan B

Si performance no cumple targets:
- Profile + identificar bottleneck (DB queries, AFIP, Decimal.js)
- Optimization quirúrgica (índices faltantes, cache, batch operations)
- Si no se resuelve: documentar como debt + comunicar a clientes piloto

---

## Sprint 10 — Pilot Launch

**Duración estimada:** 1 semana solo-dev (+ ongoing support semanas siguientes)
**Pre-conditions:** Sprint 9 done + producción AFIP aprobada
**Bloqueable por:** AFIP cutover de homologación a producción no aprobado

### Inputs requeridos

- 5 clientes TDF identificados + comprometidos al piloto
- AFIP producción credentials emitidas
- Inscripción AAIP completada (B-2 cerrado)
- T&C + Privacy Policy redactados (B-7 + B-8 cerrados)

### Deliverables

#### Onboarding cliente 1

- [ ] Owner técnico (Agus) asiste cliente 1 in-situ o remoto
- [ ] Setup empresa: alta companies + users + roles
- [ ] Carga catálogo inicial (productos básicos)
- [ ] Configuración cert AFIP + sale_points
- [ ] Primera venta cobrada con CAE válido emitido
- [ ] Verificación: factura impresa con FiscalBreakdown Ley 27.743 correcto

#### Onboarding clientes 2-5

Una vez cliente 1 OK por > 1 semana operativa:
- [ ] Cliente 2: 1-2 días asistido + 1 semana soporte intensivo
- [ ] Cliente 3-5: process iterado con lessons learned

#### Métricas piloto

- [ ] 5 clientes activos pagando mensualidad
- [ ] > 99% disponibilidad sostenida
- [ ] < 1% facturas en `manual_resolution_required`
- [ ] Cero fugas cross-tenant
- [ ] Cero corrupción fiscal

### Gating criteria Sprint 10

✅ Sprint 10 done cuando:
- [ ] 5 clientes pagando mensualidad
- [ ] Sostenido > 4 semanas sin incidente S0
- [ ] Feedback documentado para F0.5 (refinamientos UX)

---

## Apéndices

### A. Gating Criteria — Snapshot por sprint

| Sprint | Gating crítico para considerar done |
|---|---|
| Pre-flight | Contador + abogado agendados, cuentas creadas |
| 0 | Vercel preview deploy verde + env Zod fail-fast funciona |
| 1 | 11 tests T-OBS + T-SEC verdes; audit_log partitioned; trigger inmutable |
| 2 | 7 tests T-MT cross-tenant verdes; demo lifecycle cron OK |
| 3 | Test concurrencia oversell verde; búsqueda P95 < 100ms |
| 4 | Constraint 1 session abierta por (tenant, sale_point); descuadre genera audit/métrica |
| 5 | Venta cobrada efectivo + MP funcional; idempotency probada; T-MONEY verdes |
| 6 | **A-1, A-2, A-4, A-10, A-11 cerrados** + emisión WSFEv1 homologación OK + T-CONC-01 verde + FiscalBreakdown correcto |
| 7 | **A-2 + B-6 cerrados** + recovery FECompUltimoAutorizado + 7 tests T-REC verdes |
| 8 | Reportes + email factura post-CAE funcional |
| 9 | Drills 6 runbooks + métricas configuradas + performance OK |
| 10 | 5 clientes pagando + > 4 semanas sin S0 |

### B. Dependency Graph — qué bloquea qué

```
Pre-flight ──────────────────────► Sprint 6 (gating A-2, A-11)
                                    Sprint 7 (gating A-2, B-6)

Sprint 0 ──► Sprint 1 ──► Sprint 2 ──► Sprint 3 ──► (paralelo con 4)
                                  ╰──► Sprint 4 ──► Sprint 5
                                                     │
                                                     ▼
                                          ⚠️ GATING contador/abogado
                                                     │
                                                     ▼
                                          Sprint 6 ──► Sprint 7
                                                       │
                                                       ▼
                                                  Sprint 8 ──► Sprint 9 ──► Sprint 10
```

### C. Catálogo F0 — verificación pre-merge

Antes de mergear cualquier código fiscal:

| Item | Verificar contra |
|---|---|
| `job_type` nuevo | [EVENT-TAXONOMY.md §3.3](EVENT-TAXONOMY.md) catálogo 10 cerrado |
| `event_name` nuevo | [EVENT-TAXONOMY.md §5](EVENT-TAXONOMY.md) catálogo 36 cerrado |
| `severity` audit_log | enum: `info / notice / warning / error / critical` |
| `jobs_queue.status` | enum: `pending / running / success / failed / dead` |
| Métrica nueva | [EVENT-TAXONOMY.md §4.1](EVENT-TAXONOMY.md) METRIC_WHITELIST |
| Fiscal state | [CLAUDE.md §12.2](CLAUDE.md) — 8 estados + transiciones |
| Money policy | [MONEY-POLICY.md](MONEY-POLICY.md) — 10 reglas absolutas |
| Multi-tenant query | [CLAUDE.md §7.6](CLAUDE.md) — 5 invariantes absolutas |
| Stack approved | [CLAUDE.md §6.1 + §6.2](CLAUDE.md) — approved + prohibido |
| Bounded context boundary | [BOUNDED-CONTEXTS.md](BOUNDED-CONTEXTS.md) — 8 reglas R1-R8 |

### D. Tabla de tests obligatorios F0

| Domain | Tests | Sprint |
|---|---|---|
| Multi-tenant | T-MT-01..07 | 2 |
| Observability | T-OBS-01..05 | 1 |
| Security | T-SEC-01..09 | 1 + 6 + 9 |
| Money | T-MONEY-01..07 | 5 (mock) + 6 (real) |
| Fiscal | T-FISCAL-01..09 | 6 + 7 |
| Recovery | T-REC-01..07 | 7 |
| Concurrency | T-CONC-01..03 | 5 + 4 + 6 |
| Identity | T-IDE-01..04 | 2 |
| Inventory | T-INV-01..06 | 3 |
| Cash | T-CASH-01..04 | 4 |
| Sales | T-SALES-01..03 | 5 |
| MP | T-MP-01..04 | 5 |
| Reporting | T-REP-01..04 | 8 |
| Notifications | T-NTF-01..02 | 8 |
| Performance | T-PERF-01..02 | 9 |
| Runbooks drills | T-RUN-01..06 | 9 |
| Setup | T-SETUP-01..06 | 0 |
| **Total** | **~67 tests obligatorios** | — |

### E. Estimación total

| Sprint | Semanas |
|---|---|
| Pre-flight (paralelo) | 1 |
| Sprint 0 | 1 |
| Sprint 1 | 2 |
| Sprint 2 | 2 |
| Sprint 3 | 2 |
| Sprint 4 | 1 |
| Sprint 5 | 2 |
| Sprint 6 | 3 |
| Sprint 7 | 2 |
| Sprint 8 | 1 |
| Sprint 9 | 1 |
| Sprint 10 | 1 |
| **Total secuencial** | **18 semanas** |
| **Total con paralelización** | **14-16 semanas** |

Paralelización posible:
- Pre-flight corre durante Sprints 0-1-2-3-4-5
- Sprint 3 (Inventory) y Sprint 4 (Cash) parcialmente en paralelo
- Documentación + setup operacional puede paralelizarse con código

### F. Criterios de DONE F0

✅ Pandora F0 está **DONE** cuando:

| Criterio | Verificar |
|---|---|
| 5 clientes TDF pagando mensualidad | Subscription billing OK |
| Sostenido > 4 semanas sin incidente S0 | Audit log de incidentes |
| Cero fugas cross-tenant confirmadas | Audit log + test suite |
| Cero corrupción fiscal | 0 CAEs rechazados por bug nuestro |
| < 1% facturas en `manual_resolution_required` | Métrica `reconciliation.outcome` |
| POS happy path P95 < 3s | Métrica latencia |
| > 99% disponibilidad | Sentry uptime |
| Contador del comerciante con vista funcional | C-OPS-08 working |
| AFIP producción aprobada | Cert + ambiente correctos |
| AAIP inscripción completada | Documentado en DECISION-LEDGER |
| T&C + Privacy Policy publicados | URLs activas |
| Backup mensual restore test OK | Audit log |

### G. Después de F0

**F0.5 (refinamiento operativo, 4-8 semanas):**
- Operator dashboard UI (queries Q1-Q4 en UI, no SQL)
- Refinamientos UX detectados con piloto
- Reportes contables expandidos
- Bug polishing

**F1 trigger:** 5 clientes estables → planificar expansión a 30 clientes.

---

## Mantenimiento de este doc

- **Tras cada sprint cerrado:** marcar gating criteria como ✅ + agregar lessons learned al final del sprint
- **Si scope cambia:** actualizar tabla de tiempos + dependency graph
- **Si aparecen sprints nuevos:** insertar con número decimal (ej: Sprint 6.5)
- **Si DECISION-LEDGER cambia algo arquitectónico:** revisar deliverables de sprints afectados

---

## Cross-references

- [CLAUDE.md §21](CLAUDE.md) — Evolution Path Strategy (este roadmap es la versión operativa de §21)
- [DECISION-LEDGER.md](DECISION-LEDGER.md) — autoridad
- [CAPABILITY-MAP.md](CAPABILITY-MAP.md) — qué capabilities cubre cada sprint
- [BOUNDED-CONTEXTS.md](BOUNDED-CONTEXTS.md) — folders + Public APIs por sprint
- [EVENT-TAXONOMY.md](EVENT-TAXONOMY.md) — catálogo cerrado de validación pre-merge
- [OPERATIONAL-SEVERITY.md](OPERATIONAL-SEVERITY.md) — ALERT_THRESHOLDS a configurar Sprint 9
- [RECONCILIATION-ENGINE.md](RECONCILIATION-ENGINE.md) — Sprint 7
- [CORRELATION-PROPAGATION.md](CORRELATION-PROPAGATION.md) — Sprint 1
- [MONEY-POLICY.md](MONEY-POLICY.md) — Sprints 5 + 6
- [RUNBOOKS/](RUNBOOKS/) — Sprint 9 drills
- [reunion-contador-y-abogado.md](reunion-contador-y-abogado.md) — Pre-flight gating
- [NON-GOALS.md](NON-GOALS.md) — qué NO entra en F0 (anti scope creep durante sprints)
- [CLAUDE-WSL-INSTRUCCIONES.md](CLAUDE-WSL-INSTRUCCIONES.md) — Sprint 0 setup

---

*ROADMAP.md v1.0.0 — 2026-05-28. 11 sprints + Pre-flight. Target 14-16 semanas solo-dev hasta 5 clientes pagando TDF.*
