# Correlation-ID Propagation — Pandora ERP

**Versión:** v1.0.0
**Fecha:** 2026-05-27
**Estado:** Aprobado base F0
**Relacionado con:** EVENT-TAXONOMY.md (`correlation_id` field en `audit_log` + `jobs_queue`), ADR-0019 (observability), Rule 04-observability

> **Sesión 2 de 3.** EVENT-TAXONOMY definió **qué eventos existen y dónde se persisten**. Este documento define **cómo se trazan end-to-end** desde el click del cajero hasta el audit log final, pasando por workers async y AFIP.
>
> **Sin propagación correcta de `correlation_id`**, debuggear "qué pasó con la venta X" en producción es archeology manual cruzando timestamps.

---

## 1. Modelo conceptual — 2 IDs canónicos F0

### `correlation_id` — operación end-to-end

- **Lifetime server-side:** desde inicio de operación lógica hasta su resolución final. Puede vivir **minutos a horas** si hay workers async (ej: venta → AFIP timeout → reconciliation worker 2h después).
- **Lifetime cliente browser:** sobrevive **reload** (sessionStorage) pero NO sobrevive **cierre de pestaña/browser** (ver §5.5). Si la operación necesita continuidad post-cierre, se recupera desde server.
- **Granularidad:** una operación de negocio completa. Ejemplo: una venta + su facturación AFIP + su notificación al cliente = mismo `correlation_id`.
- **Persistencia server-side:** SIEMPRE en `audit_log` + `jobs_queue` + entidades de negocio relevantes (`sales.correlation_id`, `invoices.correlation_id`). NUNCA en entidades cosméticas (`products`, `cart_items`).
- **Persistencia client-side:** sessionStorage durante la sesión browser. Al cerrar tab/browser se pierde — recovery desde server vía draft sale ID si aplica.
- **Origen:** generado por el cliente (POS browser) al iniciar la operación. Si la request entra sin uno desde un origen autorizado a NO enviarlo (lista cerrada — ver §2.1), el middleware genera. Si entra sin uno desde origen que SÍ debería enviarlo → warning log + investigación.

### `request_id` — request HTTP individual O ciclo de procesamiento de worker

- **Lifetime:** **milisegundos a segundos** — lo que dura una request HTTP o un job de worker.
- **Granularidad:** una sola request HTTP (incluyendo Server Action) O un solo procesamiento de job (cada attempt es una "request lógica" del worker).
- **Persistencia:** **SIEMPRE NOT NULL** en `audit_log` y `jobs_queue.last_request_id` (campo nuevo, ver §4). En logs Pino structurados también. NO se persiste en entidades de negocio.
- **Origen — 3 casos canónicos:**
  - HTTP request → middleware Next.js genera (siempre, sin excepción)
  - Worker procesa job → genera nuevo `request_id` al empezar cada attempt
  - Cron job → genera nuevo `request_id` al disparar la ejecución

**Por qué NOT NULL siempre:** simplifica queries de investigación. "Mostrame todos los audit events de este request" siempre funciona. Schema mantiene invariante. Workers/crons generan su propio sin sobrepensar el caso.

### Relación entre los dos

```
Operación: "Cliente compra 3 productos + se factura"
correlation_id = uuid-A
│
├── HTTP request 1: POST /api/pos/sale (Server Action createSale)
│   request_id = uuid-B1
│
├── HTTP request 2: POST /api/pos/sale/cobrar (Server Action processPayment)
│   request_id = uuid-B2
│
└── Worker async (horas después): afip.emit_invoice
    request_id = uuid-B3 (nueva "request lógica" del worker)
    correlation_id = uuid-A  (heredado del job)
```

**Una operación de negocio = un `correlation_id` + N `request_id`.**

### Por qué F0 NO incluye `causation_id`

`causation_id` (ID del evento/job que causó este) es útil para:
- Event sourcing real (reconstruir state desde chain)
- Distributed tracing con spans causales (OpenTelemetry-style)

F0 con `audit_log` tradicional + `jobs_queue` simple + Pino logs no lo necesita. El `correlation_id` permite agrupar todo lo asociado a una operación; el orden temporal es por `occurred_at`. Si en F1+ aparece necesidad real (event sourcing, OpenTelemetry traces), agregar `causation_id` es cambio backwards-compatible.

Ver EVENT-TAXONOMY.md §11 Evolution Path.

### Decisión: UUID v4 (no v7)

- **UUID v4** (random, 16 bytes) — estándar `crypto.randomUUID()` en Node 22 + browser
- Sin extensions Postgres necesarias
- Sin garantía de ordering temporal (no la necesitamos — ordering temporal viene de `occurred_at` timestamptz)
- Anti-prediction natural

---

## 2. Generación y lifecycle

### Regla cerrada — quién DEBE generar `correlation_id` y quién está exento

**Por default, todo cliente Pandora interno (browser, mobile, desktop futuro) DEBE enviar `x-correlation-id` en cada request.** Olvidarlo no es error fatal (el middleware genera fallback + warning log) pero es bug del cliente que merece investigación.

**Lista CERRADA de orígenes exentos** (NO requieren enviar `x-correlation-id`, middleware genera silenciosamente):

| Path prefix exento | Razón |
|---|---|
| `/api/webhooks/` | Webhooks externos (MercadoPago, AFIP futuro, otros providers) — origen no controlado por nosotros |
| `/api/health` | Health checks de monitoring externo (Uptime Robot, etc.) |
| `/api/internal/cron/` | Crons disparados por Vercel/external scheduler — no es origen cliente |
| `/api/public/` | Endpoints públicos sin auth (catálogo público F1+, status page) |

Cualquier path que NO coincida con estos prefijos y reciba request sin `x-correlation-id` → **warning log** explícito para investigación:

```typescript
// src/middleware.ts
const CORRELATION_HEADER = 'x-correlation-id';
const REQUEST_HEADER = 'x-request-id';

const EXEMPT_PATH_PREFIXES = [
  '/api/webhooks/',
  '/api/health',
  '/api/internal/cron/',
  '/api/public/',
] as const;

function isExemptPath(pathname: string): boolean {
  return EXEMPT_PATH_PREFIXES.some(prefix => pathname.startsWith(prefix));
}

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const incomingCorrelation = request.headers.get(CORRELATION_HEADER);
  
  let correlation_id: string;
  let correlation_source: 'client' | 'middleware_exempt' | 'middleware_fallback';
  
  if (incomingCorrelation) {
    correlation_id = incomingCorrelation;
    correlation_source = 'client';
  } else if (isExemptPath(path)) {
    correlation_id = crypto.randomUUID();
    correlation_source = 'middleware_exempt';  // silencioso, esperado
  } else {
    correlation_id = crypto.randomUUID();
    correlation_source = 'middleware_fallback';
    
    // Warning explícito — cliente debería haberlo enviado
    console.warn(
      `[middleware] missing x-correlation-id from non-exempt path "${path}". ` +
      `Generated ${correlation_id}. Investigate client.`
    );
  }
  
  const request_id = crypto.randomUUID();  // siempre nuevo
  
  // Propagar a downstream
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(CORRELATION_HEADER, correlation_id);
  requestHeaders.set(REQUEST_HEADER, request_id);
  
  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });
  
  response.headers.set(CORRELATION_HEADER, correlation_id);
  response.headers.set(REQUEST_HEADER, request_id);
  
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

### Por qué este modelo (cliente genera + lista cerrada de excepciones)

**Alternativas rechazadas:**

| Alternativa | Por qué se rechazó |
|---|---|
| Middleware siempre genera, cliente nunca envía | Pierde la garantía de que un correlation_id agrupe toda la operación end-to-end del cliente. Si la operación abarca 3 HTTP requests, cada una tendría correlation_id distinto generado por middleware. |
| Cliente puede o no enviar, sin distinción | Sin warning, bugs de clientes (olvido de propagar) son invisibles. Después de meses descubrís que tu Realtime correlation está roto. |
| Cliente DEBE enviar SIEMPRE, sin excepciones | Webhooks externos no controlados por nosotros no pueden enviar — necesitamos generar. Rompe la regla si la aplicamos universal. |

**Modelo F0 elegido:** cliente DEBE enviar EXCEPTO lista cerrada de paths externos/sistema. Cualquier desviación se loguea como warning (no error) para que aparezca en investigación sin romper el sistema.

### Cuándo se hereda vs cuándo se genera nuevo

**Heredar `correlation_id`:**
- Server Action lee del header HTTP entrante
- Worker async lee del `jobs_queue.correlation_id` del job que procesa
- Service called desde otro Service mantiene el contexto activo (AsyncLocalStorage)
- Realtime broadcast incluye correlation_id del evento que disparó

**Generar nuevo `correlation_id`:**
- Cliente arranca operación nueva (POS abre nueva venta)
- Middleware genera fallback (path exento o cliente sin enviar)
- Cron crea job no asociado a operación previa
- Worker decide explícitamente que un sub-trabajo es operación independiente (raro F0 — generalmente herencia)

### Lifecycle de un `correlation_id` típico

```
T+0:00     Cliente genera correlation_id=A, inicia venta
T+0:01     POST /api/pos/sale con header x-correlation-id=A
T+0:02     Server Action procesa, inserta sale + audit_log (correlation_id=A) + job afip.emit_invoice (correlation_id=A)
T+0:03     Respuesta HTTP al cliente con header x-correlation-id=A
T+0:05     Cliente muestra "venta registrada, facturando..."
T+0:30     Worker toma job, hereda correlation_id=A, llama AFIP
T+0:45     AFIP timeout (15s), worker marca job failed, enqueue afip.reconcile_pending (hereda correlation_id=A)
T+5:00     Worker reconcile, llama AFIP, recibe CAE
T+5:01     Worker inserta audit_log fiscal.invoice.cae_received (correlation_id=A)
T+5:02     Worker dispara Supabase Realtime broadcast (payload incluye correlation_id=A)
T+5:03     Cliente recibe broadcast, filtra por su correlation_id=A, actualiza UI

Total lifetime correlation_id=A: 5 minutos 3 segundos
```

---

## 3. Propagación entre layers — el flujo end-to-end

### Diagrama completo

```
┌─────────────────────────────────────────────────────────────────┐
│ Cliente (POS browser)                                           │
│  ├─ Genera correlation_id al iniciar operación                  │
│  └─ Mantiene en estado local durante toda la operación          │
│         │                                                         │
│         │  HTTP request                                          │
│         │  headers: x-correlation-id, x-request-id (generado)    │
│         ↓                                                         │
└─────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────┐
│ Next.js Middleware (Edge Runtime, no Node)                      │
│  ├─ Extrae x-correlation-id (o genera si no viene)              │
│  ├─ Genera x-request-id siempre (cada HTTP es nueva request)    │
│  ├─ Inyecta ambos en request.headers para downstream            │
│  └─ Inyecta ambos en response.headers (cliente puede loguear)   │
│         │                                                         │
└─────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────┐
│ Server Action / Route Handler (Node Runtime)                    │
│  ├─ Lee headers vía next/headers                                │
│  ├─ withTracingContext({ correlation_id, request_id }, fn)      │
│  └─ Todo lo de adentro hereda via AsyncLocalStorage             │
│         │                                                         │
│         │  Service call (mismo AsyncLocalStorage)                │
│         ↓                                                         │
└─────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────┐
│ Application Service (Node Runtime — mismo proceso)              │
│  ├─ getCorrelationId() lee del AsyncLocalStorage                │
│  ├─ Pino logger inyecta automáticamente correlation_id          │
│  ├─ db.transaction(...)                                          │
│  │   ├─ INSERT sales (...)                                       │
│  │   ├─ INSERT audit_log (correlation_id, ...)                  │
│  │   └─ INSERT jobs_queue (correlation_id, ...)                 │
│  └─ COMMIT                                                       │
│         │                                                         │
└─────────────────────────────────────────────────────────────────┘
                          ⋮ ... tiempo pasa ... ⋮
┌─────────────────────────────────────────────────────────────────┐
│ Worker (Node Runtime, proceso separado, horas después)          │
│  ├─ SELECT * FROM jobs_queue WHERE status='pending' FOR UPDATE  │
│  ├─ withTracingContext({                                         │
│  │     correlation_id: job.correlation_id,  ← heredado          │
│  │     request_id: randomUUID()             ← NUEVO             │
│  │   }, fn)                                                      │
│  ├─ Procesa el job — todos los logs/audits llevan correlation_id│
│  ├─ Llama AFIP (X-Correlation-Id custom header, mejor esfuerzo) │
│  ├─ Recibe response                                              │
│  ├─ INSERT audit_log (correlation_id, ...)                      │
│  └─ supabase.channel(...).send({ payload: { correlation_id }})  │
│         │                                                         │
└─────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────┐
│ Cliente (Supabase Realtime listener activo)                     │
│  ├─ Recibe broadcast                                             │
│  ├─ Filtra por correlation_id que aún tiene en memoria          │
│  └─ Actualiza UI: "Factura emitida — CAE: 12345678"             │
└─────────────────────────────────────────────────────────────────┘
```

### Paso por paso — implementación concreta

#### 3.1 — Cliente: generación + propagación

```typescript
// src/lib/tracing/client.ts
'use client';

const CORRELATION_HEADER = 'x-correlation-id';
const REQUEST_HEADER = 'x-request-id';

export function generateCorrelationId(): string {
  return crypto.randomUUID();
}

export interface TracedFetchOptions extends RequestInit {
  correlationId: string;  // OBLIGATORIO — el caller decide qué operación es
}

export async function tracedFetch(
  url: string,
  options: TracedFetchOptions
): Promise<Response> {
  const requestId = crypto.randomUUID();
  
  return fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      [CORRELATION_HEADER]: options.correlationId,
      [REQUEST_HEADER]: requestId,
    },
  });
}
```

```typescript
// Uso en componente — generar correlation_id al iniciar operación
// Usa hook custom que sobrevive reload via sessionStorage (ver §5.5)
'use client';
import { useOperationCorrelationId } from '@/lib/tracing/use-correlation';
import { tracedFetch } from '@/lib/tracing/client';

function POSSaleScreen({ draftSaleId }: { draftSaleId: string }) {
  // Hook genera o recupera de sessionStorage indexado por draftSaleId.
  // Sobrevive reload, NO sobrevive cierre de tab.
  const correlationId = useOperationCorrelationId(`sale:${draftSaleId}`);
  
  async function addItem(productId: string) {
    await tracedFetch('/api/pos/cart/add-item', {
      method: 'POST',
      correlationId,  // mismo durante toda la venta, sobrevive reload
      body: JSON.stringify({ productId }),
    });
  }
  
  async function checkout(paymentMethod: string) {
    await tracedFetch('/api/pos/sale/checkout', {
      method: 'POST',
      correlationId,
      body: JSON.stringify({ paymentMethod }),
    });
  }
}
```

**Regla del cliente:** una operación lógica = un `correlation_id` generado al inicio + reutilizado en todos los HTTP requests de esa operación. NO generar nuevo por cada click. Sobrevive reload (via sessionStorage). Si la operación necesita sobrevivir cierre de browser, recovery desde server (ver §5.5).

#### 3.2 — Middleware Next.js

Implementación completa en §2 (ver bloque "src/middleware.ts" arriba con lista cerrada de paths exentos + warning para casos no documentados).

**Por qué middleware en Edge Runtime y no Node:**
- Latencia mínima (no levanta proceso Node por cada request)
- AsyncLocalStorage no funciona en Edge — por eso propagamos via headers, no via context
- El AsyncLocalStorage se arma en el primer punto de Node Runtime (Server Action / Service)

#### 3.3 — AsyncLocalStorage (Node Runtime — Server Actions + Services)

```typescript
// src/lib/tracing/context.ts
import 'server-only';
import { AsyncLocalStorage } from 'node:async_hooks';

export interface TracingContext {
  correlation_id: string;
  request_id: string;
  tenant_id?: string;       // se agrega cuando se conoce (post-auth)
  actor_user_id?: string;   // idem
}

const storage = new AsyncLocalStorage<TracingContext>();

export function withTracingContext<T>(
  ctx: TracingContext,
  fn: () => T | Promise<T>
): T | Promise<T> {
  return storage.run(ctx, fn);
}

export function getTracingContext(): TracingContext | undefined {
  return storage.getStore();
}

export function getCorrelationId(): string {
  const ctx = storage.getStore();
  if (!ctx) {
    throw new Error(
      'No tracing context active. ' +
      'Wrap entry point with withTracingContext() or extractTracingFromHeaders().'
    );
  }
  return ctx.correlation_id;
}

export function getRequestId(): string {
  const ctx = storage.getStore();
  if (!ctx) {
    throw new Error('No tracing context active');
  }
  return ctx.request_id;
}

// Agrega campos al context cuando se conocen (post-auth)
export function enrichTracingContext(
  enrichment: Partial<Pick<TracingContext, 'tenant_id' | 'actor_user_id'>>
): void {
  const existing = storage.getStore();
  if (!existing) {
    throw new Error('Cannot enrich — no context active');
  }
  // AsyncLocalStorage stores son mutables (es objeto)
  Object.assign(existing, enrichment);
}
```

#### 3.4 — Server Action: bridge headers → context

```typescript
// src/lib/tracing/server-action.ts
import 'server-only';
import { headers } from 'next/headers';
import { withTracingContext } from './context';

const CORRELATION_HEADER = 'x-correlation-id';
const REQUEST_HEADER = 'x-request-id';

/**
 * Wrapper obligatorio para Server Actions.
 * Extrae correlation + request id de headers (puestos por middleware)
 * y arma AsyncLocalStorage para todo el código downstream.
 */
export async function withServerActionTracing<T>(
  fn: () => Promise<T>
): Promise<T> {
  const h = await headers();
  const correlation_id = h.get(CORRELATION_HEADER);
  const request_id = h.get(REQUEST_HEADER);
  
  if (!correlation_id || !request_id) {
    throw new Error(
      'Missing tracing headers. ' +
      'Middleware should set x-correlation-id and x-request-id.'
    );
  }
  
  return withTracingContext({ correlation_id, request_id }, fn);
}
```

```typescript
// Uso en Server Action
// src/app/(app)/pos/actions.ts
'use server';

import { withServerActionTracing } from '@/lib/tracing/server-action';
import { enrichTracingContext } from '@/lib/tracing/context';
import { getAuthContext } from '@/lib/auth/context';
import { SaleService } from '@/lib/services/sales';

export async function createSale(formData: FormData) {
  return withServerActionTracing(async () => {
    const auth = await getAuthContext();
    
    // Una vez conocido el actor, enriquecer el context
    enrichTracingContext({
      tenant_id: auth.companyId,
      actor_user_id: auth.userId,
    });
    
    return await SaleService.create(auth, parseFormData(formData));
  });
}
```

#### 3.5 — Service / DB layer: lectura del context

```typescript
// src/lib/services/sales/SaleService.ts
import { db } from '@/lib/db/client';
import { getTracingContext } from '@/lib/tracing/context';
import { sales, auditLog, jobsQueue } from '@/lib/db/schema';

export const SaleService = {
  async create(auth: AuthContext, params: CreateSaleParams) {
    const trace = getTracingContext();
    if (!trace) throw new Error('SaleService.create requires tracing context');
    
    return db.transaction(async (tx) => {
      const [sale] = await tx.insert(sales).values({
        ...params,
        correlation_id: trace.correlation_id,  // ← propagación a entidad
      }).returning();
      
      // Audit log dentro de la misma tx
      await tx.insert(auditLog).values({
        event_name: 'sale.completed',
        tenant_id: auth.companyId,
        actor_user_id: auth.userId,
        actor_type: 'user',
        correlation_id: trace.correlation_id,
        request_id: trace.request_id,
        occurred_at: new Date(),
        payload: { sale_id: sale.id, total: sale.total },
        severity: 'info',
        pii_level: 'internal',
        retention_days: 365 * 10,
        idempotency_key: params.idempotencyKey,
      });
      
      // Job async para AFIP — hereda correlation_id
      await tx.insert(jobsQueue).values({
        tenant_id: auth.companyId,
        job_type: 'afip.emit_invoice',
        payload: { sale_id: sale.id },
        correlation_id: trace.correlation_id,  // ← propagación a worker
      });
      
      return sale;
    });
  },
};
```

#### 3.6 — Worker: extraer correlation_id del job, armar nuevo context

```typescript
// src/lib/workers/with-tracing.ts
import 'server-only';
import { withTracingContext } from '@/lib/tracing/context';

interface JobRecord {
  id: number;
  tenant_id: string;
  correlation_id: string | null;  // siempre debería existir, pero defensivo
  payload: unknown;
  // ...
}

export async function processJobWithTracing<T>(
  job: JobRecord,
  processor: (job: JobRecord) => Promise<T>
): Promise<T> {
  // Worker hereda correlation_id del job
  const correlation_id = job.correlation_id ?? crypto.randomUUID();
  const request_id = crypto.randomUUID();  // worker = nueva request lógica
  
  return withTracingContext(
    {
      correlation_id,
      request_id,
      tenant_id: job.tenant_id,
    },
    () => processor(job)
  );
}
```

```typescript
// Worker dedicado (siguiendo Regla J2 de EVENT-TAXONOMY — no handler genérico)
// src/lib/workers/afip-emit-invoice-worker.ts
import 'server-only';
import { processJobWithTracing } from './with-tracing';

export async function runAfipEmitInvoiceWorker() {
  const jobs = await fetchPendingJobs('afip.emit_invoice', { limit: 10 });
  
  for (const job of jobs) {
    await processJobWithTracing(job, async (j) => {
      try {
        const result = await emitInvoiceToAfip(j.payload);
        await markJobSuccess(j.id);
        await publishRealtimeUpdate(j, result);  // incluye correlation_id en payload
      } catch (err) {
        await markJobFailed(j.id, err);
      }
    });
  }
}
```

#### 3.7 — AFIP call: headers HTTP custom (best effort)

AFIP usa SOAP, no honra `X-Correlation-Id` (no es estándar SOAP). Pero podemos:

```typescript
// src/lib/afip/wsfev1-client.ts
import { getCorrelationId, getRequestId } from '@/lib/tracing/context';
import { logger } from '@/lib/logger';

export async function solicitarCAE(payload: WSFEv1Payload): Promise<CAEResponse> {
  const correlation_id = getCorrelationId();
  const request_id = getRequestId();
  
  // Log local antes de la llamada
  logger.info({
    pii_level: 'internal',
    event: 'afip.wsfev1.request_sent',
    correlation_id,
    request_id,
    sale_point: payload.PtoVta,
    invoice_type: payload.CbteTipo,
  });
  
  const startMs = Date.now();
  
  try {
    const response = await soapCall(payload, {
      // Best effort: agregar custom header (AFIP lo ignora pero proxy intermedio puede loguearlo)
      headers: { 'X-Correlation-Id': correlation_id },
      timeout: 30_000,
    });
    
    // Log local después
    logger.info({
      pii_level: 'internal',
      event: 'afip.wsfev1.response_received',
      correlation_id,
      request_id,
      duration_ms: Date.now() - startMs,
      result: response.success ? 'success' : 'rejected',
    });
    
    return response;
  } catch (err) {
    logger.error({
      pii_level: 'internal',
      event: 'afip.wsfev1.error',
      correlation_id,
      request_id,
      duration_ms: Date.now() - startMs,
      error_message: err.message,
    });
    throw err;
  }
}
```

Si AFIP devuelve error de payload, el `correlation_id` está en los logs locales — basta para investigar.

#### 3.8 — Realtime broadcast: payload con correlation_id

```typescript
// src/lib/realtime/publish.ts
import { supabase } from '@/lib/supabase/admin';
import { getCorrelationId } from '@/lib/tracing/context';

export async function publishSaleFiscalStatusChanged(
  saleId: string,
  newStatus: string
): Promise<void> {
  const correlation_id = getCorrelationId();
  
  await supabase
    .channel(`tenant:${tenantId}:sales`)
    .send({
      type: 'broadcast',
      event: 'sale.fiscal_status_changed',
      payload: {
        sale_id: saleId,
        new_status: newStatus,
        correlation_id,         // ← cliente puede filtrar por su operación
        emitted_at: new Date().toISOString(),
      },
    });
}
```

#### 3.9 — Cliente: recibir broadcast + correlacionar

```typescript
'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';

function POSSaleScreen() {
  const [operationCorrelationId] = useState(() => crypto.randomUUID());
  const [fiscalStatus, setFiscalStatus] = useState<string>('pending');
  
  useEffect(() => {
    const channel = supabase
      .channel(`tenant:${tenantId}:sales`)
      .on('broadcast', { event: 'sale.fiscal_status_changed' }, (msg) => {
        // Filtrar: solo updates de NUESTRA operación actual
        if (msg.payload.correlation_id === operationCorrelationId) {
          setFiscalStatus(msg.payload.new_status);
        }
      })
      .subscribe();
    
    return () => { supabase.removeChannel(channel); };
  }, [operationCorrelationId]);
  
  // ...
}
```

---

## 4. `request_id` vs `correlation_id` — cuándo cuál

### `request_id`: SIEMPRE existe, SIEMPRE persiste

Cada origen de "request lógica" recibe un `request_id` nuevo. Sin excepción:

| Origen | Quién genera | Cuándo |
|---|---|---|
| HTTP request entrante | Middleware Next.js | Una vez por cada HTTP request (incluido health checks, webhooks, OAuth callbacks) |
| Worker procesando job | El worker en `processJobWithTracing()` | Nuevo `request_id` por cada attempt (si un job se reintenta 3 veces, son 3 `request_id` distintos con el mismo `correlation_id`) |
| Cron job ejecutándose | El cron al iniciar | Uno por cada disparo del cron |

**`request_id` se persiste SIEMPRE NOT NULL en `audit_log`.** Schema invariante:

```sql
ALTER TABLE audit_log
  ALTER COLUMN request_id SET NOT NULL;
```

Razón: cualquier audit event tiene un origen identificable. Aunque el `correlation_id` sea el mismo (ej: worker reintenta 3 veces), cada attempt tiene `request_id` distinto. Permite query: "mostrame todo lo que pasó en el attempt #2 del worker para esta venta".

#### ⚠️ `request_id` es ID de intento, NO authority de estado (paralelo a Regla J5)

Misma distinción crítica que `correlation_id` en `jobs_queue`:

✅ **Permitido (trazabilidad de intento):**
- Investigar qué ocurrió en una request HTTP específica o en un attempt específico de un worker
- Agrupar logs de un único attempt fallido
- Operator tooling: "el attempt #3 de este job tiene request_id X, mostrame todos los audit events de ese attempt"
- Métricas por request_id (latencia de una request específica)

❌ **Prohibido (state ownership):**
- Derivar el estado de una entidad de negocio leyendo qué request_id la modificó por última vez
- Usar request_id como "última versión válida" para resolver concurrencia
- Tratar la secuencia de request_id como source of truth del flow
- Recovery de operación basado en "buscar el último request_id exitoso"

**Authority de recovery sigue siendo:**
- `sales.correlation_id` para retomar tracking de una operación de venta
- `jobs_queue.last_request_id` para identificar el último attempt de un job (informativo — para investigar — no para derivar estado)
- Tabla autoritativa de la entidad (`sales.fiscal_status`, `invoices.cae`, etc.) para state real

**`request_id` es coordenada de búsqueda por attempt** (más granular que `correlation_id` que agrupa toda la operación). **Nunca** atributo del que se infiere estado de negocio.

```typescript
// ✅ Trazabilidad — investigar attempt específico
async function investigateJobAttempt(jobId: number) {
  const job = await db.query.jobsQueue.findFirst({ where: eq(jobsQueue.id, jobId) });
  const events = await db.query.auditLog.findMany({
    where: eq(auditLog.request_id, job.last_request_id),
    orderBy: auditLog.occurred_at,
  });
  return { job, events };  // operator dashboard
}

// ❌ State ownership — anti-pattern
async function isJobActuallyDone(jobId: number) {
  const lastSuccessRequest = await db.query.auditLog.findFirst({
    where: and(
      eq(auditLog.event_name, 'fiscal.invoice.cae_received'),
      eq(auditLog.correlation_id, /* del job */),
    ),
    orderBy: desc(auditLog.occurred_at),
  });
  return lastSuccessRequest !== null;  // ❌ MAL — derivar estado del job desde audit_log
}

// ✅ State desde fuente autoritativa
async function isJobActuallyDone(jobId: number) {
  const job = await db.query.jobsQueue.findFirst({ where: eq(jobsQueue.id, jobId) });
  return job.status === 'success';  // ✅ jobs_queue.status es la verdad
}
```

### `jobs_queue.last_request_id` (campo nuevo)

Para investigación de jobs específicos, agregar a `jobs_queue`:

```sql
ALTER TABLE jobs_queue
  ADD COLUMN last_request_id uuid;  -- nullable hasta primer attempt
```

Worker actualiza este campo al empezar cada attempt:

```typescript
async function processJobWithTracing<T>(job, processor) {
  const request_id = crypto.randomUUID();
  
  await db.update(jobsQueue)
    .set({ last_request_id: request_id, started_at: new Date() })
    .where(eq(jobsQueue.id, job.id));
  
  return withTracingContext(
    { correlation_id: job.correlation_id, request_id, tenant_id: job.tenant_id },
    () => processor(job)
  );
}
```

Permite query operativa: "este job falló en su attempt #3 — mostrame el `request_id` y de ahí saco todos los logs/audit events de ese attempt específico".

### `correlation_id`: SIEMPRE existe (heredado o generado)

El middleware **siempre** garantiza que existe un `correlation_id`. Casos:

| Caso | `correlation_id` resultante |
|---|---|
| Cliente envía `x-correlation-id` (operación de negocio) | Heredado del cliente |
| Request entra sin header (request directo, simple GET) | Generado por middleware |
| Webhook MercadoPago entra sin header | Generado por middleware |
| Cron crea job | Generado por el código que crea el job |

**No hay "request sin correlation_id".** Si el cliente no lo envía, el middleware lo crea. Esto simplifica todo el código downstream — getCorrelationId() siempre funciona.

### Diferencia operativa

```
Operación "venta + facturación":
correlation_id = A
│
├─ request_id = B1: POST /api/pos/sale (Server Action)
│   logs con correlation=A, request=B1
│
├─ request_id = B2: POST /api/pos/sale/print (otro Server Action)
│   logs con correlation=A, request=B2
│
└─ request_id = B3: worker async procesando afip.emit_invoice
    logs con correlation=A, request=B3
```

Para investigar "qué pasó con esta venta":
- Query por `correlation_id = A` → ves TODO (los 3 requests + worker)
- Query por `request_id = B2` → ves solo lo que pasó en ese request específico

### `request_id` y `correlation_id` SIEMPRE son UUIDs independientes

No hay caso F0 donde sean iguales. Aunque sea una request trivial (`GET /api/products` sin operación lógica), middleware genera dos UUIDs distintos. Mantener invariante simplifica reasoning.

---

## 5. AsyncLocalStorage en Node 22 + Next.js 16

### Setup canónico

Implementación en `src/lib/tracing/context.ts` (ya mostrada en §3.3). Notas técnicas:

#### Edge Runtime vs Node Runtime

| Runtime | AsyncLocalStorage | Propagación |
|---|---|---|
| **Edge** (middleware, algunas Route Handlers) | NO soportado | Solo via headers |
| **Node** (Server Actions, Route Handlers con `runtime = 'nodejs'`, workers) | Soportado | Via AsyncLocalStorage |

**Decisión F0:** middleware en Edge (propaga via headers). Server Actions + Services + Workers en Node (AsyncLocalStorage). Bridge entre los dos es `withServerActionTracing()` que lee headers y monta AsyncLocalStorage.

#### Compatibilidad con Next.js Server Actions

Next.js 16 con React 19 maneja su propio AsyncLocalStorage internamente para `headers()`, `cookies()`, etc. **El nuestro convive sin conflicto** porque son AsyncLocalStorage instances separados.

#### Caveats con setTimeout / setInterval

```typescript
// ❌ ATENCIÓN: setTimeout perdería el context si se usa fuera del contexto
withTracingContext({ correlation_id: 'X', request_id: 'Y' }, async () => {
  setTimeout(() => {
    getCorrelationId();  // ❓ depende del runtime
  }, 1000);
});
```

Node 22+ `AsyncLocalStorage` **sí preserva** context en `setTimeout`, `setInterval`, callbacks promise, etc. Eso es lo normal. **Pero queues externas (BullMQ, Redis pub/sub)** rompen el context — para esos casos, propagar manualmente al encolar y reconstruir al consumir (eso es lo que hace `processJobWithTracing()`).

### 5.5 — Browser persistence + recovery (decisión cerrada F0)

Caso real: cajero arranca venta, llega cliente, queda 5 min con la pestaña. Tab se reload por bug o usuario refresca. ¿Pierdo el `correlation_id`?

Otro caso: cajero cobra venta, AFIP tarda 30s, cajero cierra el browser sin querer y reabre. ¿Retoma tracking?

#### Decisión F0 — 3 niveles

| Evento | Comportamiento |
|---|---|
| **Reload accidental** (F5, ctrl+R, error de página, navegación back-forward) | `correlation_id` **sobrevive** vía `sessionStorage` |
| **Cierre de tab/browser** (cmd+W, cierre proceso, crash) | `correlation_id` **se pierde** en cliente |
| **Cierre con operación pendiente** (venta en curso sin facturar) | Al reabrir POS y cargar el draft sale, **se recupera** `correlation_id` desde server (`sales.correlation_id`) |

#### Por qué sessionStorage y no localStorage

- `sessionStorage`: scope tab + dura hasta cierre de tab. **Sobrevive reload** dentro del mismo tab.
- `localStorage`: persistente cross-tab + cross-session. Genera bugs típicos:
  - 2 tabs del mismo cliente con misma operación → corrupción
  - `correlation_id` viejo de hace 3 días reutilizado por accidente
  - Necesita cleanup activo (otro vector de bugs)

`sessionStorage` da exactamente la garantía que queremos (sobrevive reload, no más).

#### Implementación

```typescript
// src/lib/tracing/use-correlation.ts
'use client';
import { useState, useEffect } from 'react';

const STORAGE_PREFIX = 'pandora:correlation:';

/**
 * Hook que devuelve un correlation_id estable para una operación.
 * Sobrevive reload (sessionStorage). NO sobrevive cierre de tab.
 * 
 * @param operationKey Identificador estable de la operación (ej: `sale:${draftSaleId}`).
 *                     Si la operación no tiene draft persistido, usar un UUID generado una vez.
 */
export function useOperationCorrelationId(operationKey: string): string {
  const [correlationId] = useState(() => {
    if (typeof window === 'undefined') {
      // SSR — generate transient (no se usa en cliente real, se reemplaza al hidratar)
      return crypto.randomUUID();
    }
    
    const storageKey = `${STORAGE_PREFIX}${operationKey}`;
    const existing = sessionStorage.getItem(storageKey);
    
    if (existing) {
      return existing;
    }
    
    const fresh = crypto.randomUUID();
    sessionStorage.setItem(storageKey, fresh);
    return fresh;
  });
  
  return correlationId;
}

/**
 * Helper para limpiar correlation_id de una operación completada exitosamente.
 * Llamar después de que la operación termine (ej: post-cobro confirmado).
 */
export function clearOperationCorrelationId(operationKey: string): void {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(`${STORAGE_PREFIX}${operationKey}`);
}
```

#### Recovery post-cierre — desde server

Si la operación necesita continuidad cross-session (ej: cajero cierra POS antes de que AFIP confirme, vuelve al día siguiente para ver el estado), el flujo es:

```typescript
// Al cargar la pantalla de "ventas pendientes"
async function loadPendingSale(saleId: string) {
  const sale = await fetchSale(saleId);
  
  // sale.correlation_id está persistido en DB desde la creación original
  // El cliente lo "redescubre" desde el server, no lo guardó localmente
  
  // Si quiere seguir tracking esa operación con Realtime:
  const operationKey = `sale:${sale.id}`;
  sessionStorage.setItem(
    `${STORAGE_PREFIX}${operationKey}`,
    sale.correlation_id
  );
  
  // Ahora useOperationCorrelationId(operationKey) devuelve el correlation_id histórico
}
```

#### Reglas absolutas

1. **El cliente NUNCA es source of truth del `correlation_id` post-cierre.** Si necesita recuperarlo, viene del server (`sales.correlation_id` u otra entidad relevante).
2. **`sessionStorage` solo dura la sesión browser.** No usar para operaciones que ABSOLUTAMENTE deben sobrevivir cierre.
3. **`operationKey` debe ser estable** (ej: derivado de un `draftSaleId` persistido server-side), no aleatorio cada render — sino el hook genera nuevo `correlation_id` en cada mount.
4. **Cleanup explícito** al completar operación (`clearOperationCorrelationId`) para no acumular sessionStorage.
5. **Múltiples tabs del mismo browser** con operaciones distintas → cada tab tiene su propio sessionStorage, sin colisión. Si el mismo cajero abre 2 tabs con MISMA operación (raro, anti-pattern), cada tab arma su propio `correlation_id` distinto — aceptado, son operaciones lógicamente independientes desde la perspectiva del browser.

#### Lo que NO entra F0

- localStorage cross-session — defer F1+ si aparece necesidad real
- IndexedDB para queue offline (correlation_id incluido) — defer F2+ con modo offline
- Cross-device correlation continuity (mismo usuario en mobile + desktop) — defer F2+

#### Tests con AsyncLocalStorage

```typescript
// tests/integration/tracing.test.ts
import { withTracingContext, getCorrelationId } from '@/lib/tracing/context';

it('preserves correlation_id across async boundaries', async () => {
  const ctx = { correlation_id: 'test-corr', request_id: 'test-req' };
  
  await withTracingContext(ctx, async () => {
    expect(getCorrelationId()).toBe('test-corr');
    
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(getCorrelationId()).toBe('test-corr');
    
    await db.query.products.findMany();
    expect(getCorrelationId()).toBe('test-corr');
  });
});

it('throws if no context active', () => {
  expect(() => getCorrelationId()).toThrow(/No tracing context/);
});
```

---

## 6. Worker continuity

### Caso típico: Sale → Worker AFIP 2h después

1. Cliente crea venta con `correlation_id = A`
2. Server Action persiste sale + job (con `jobs_queue.correlation_id = A`)
3. 2h después: worker corre, lee job, hereda `correlation_id = A`
4. Worker llama AFIP, persiste audit log con `correlation_id = A`
5. Worker dispara broadcast Realtime con `correlation_id = A`

**El cliente** mantuvo `correlation_id = A` en memoria todo ese tiempo (si la pestaña está abierta) o lo recupera al volver (persistido en localStorage opcional). Cuando llega el broadcast, lo correlaciona.

### Cuándo el worker GENERA nuevo correlation_id (raro)

Solo si el trabajo es **operación independiente** del que lo encoló. Ejemplo casi único F0:

- Cron `cron.audit_log.create_next_year_partition` → NO viene de operación de usuario, es operación de sistema. Genera nuevo `correlation_id`.

Para todo lo demás (afip.emit_invoice, email.send, etc.) → heredar del job.

### Worker en cron sin trigger previo

Crons (sin job que los disparara desde Server Action) generan `correlation_id` al crear el job:

```typescript
// src/lib/workers/cron/demo-lifecycle.ts
export async function runDemoLifecycleCron() {
  const cronCorrelationId = crypto.randomUUID();  // operación independiente
  const cronRequestId = crypto.randomUUID();
  
  await withTracingContext(
    { correlation_id: cronCorrelationId, request_id: cronRequestId },
    async () => {
      logger.info({ event: 'cron.demo_lifecycle.started' });
      
      // Procesar transiciones día 14, 22, 82
      await transitionDemoExtended();
      await transitionDemoReadonly();
      await transitionDemoArchived();
      
      logger.info({ event: 'cron.demo_lifecycle.completed' });
    }
  );
}
```

Todos los audit_log generados por el cron tendrán el mismo `correlation_id` → fácil de revisar "qué hizo el cron de hoy".

---

## 7. Realtime linkage

### Patrón canónico

Cuando server publica un Realtime broadcast, **siempre** incluir `correlation_id` en el payload:

```typescript
// Helper canónico
import { getCorrelationId } from '@/lib/tracing/context';

export async function publishRealtimeEvent(
  channel: string,
  event: string,
  payload: Record<string, unknown>
): Promise<void> {
  const correlation_id = getCorrelationId();
  
  await supabase.channel(channel).send({
    type: 'broadcast',
    event,
    payload: {
      ...payload,
      correlation_id,
      emitted_at: new Date().toISOString(),
    },
  });
}
```

### Cliente: correlacionar con operación activa

```typescript
// Helper de filtrado
function useCorrelationFilteredBroadcast(
  channel: string,
  event: string,
  correlationId: string,
  handler: (payload: any) => void
) {
  useEffect(() => {
    const ch = supabase
      .channel(channel)
      .on('broadcast', { event }, (msg) => {
        if (msg.payload.correlation_id === correlationId) {
          handler(msg.payload);
        }
      })
      .subscribe();
    
    return () => { supabase.removeChannel(ch); };
  }, [channel, event, correlationId, handler]);
}
```

### Caso: cliente cerró el browser, vuelve después

Si el cliente cierra antes de recibir el broadcast (ej: factura tarda 5 min, cliente cerró la pestaña):

- Al volver: query directo a la DB por estado actual de la venta (no Realtime)
- `correlation_id` que el cliente tenía guardado (localStorage) sirve para filtrar logs/debug si el operador quiere investigar
- Pero el state autoritativo viene de `sales.fiscal_status`, no del broadcast (que ya pasó)

Consistente con Regla J5 de EVENT-TAXONOMY: trazabilidad sí, state ownership no.

---

## 8. Logging conventions

### Pino logger con correlation_id automático

```typescript
// src/lib/logger.ts
import pino from 'pino';
import { getTracingContext } from '@/lib/tracing/context';

const baseLogger = pino({
  base: {
    service: 'pandora-erp',
    env: process.env.NODE_ENV,
  },
  redact: { /* ... */ },
});

/**
 * Wrapper que automáticamente inyecta correlation_id + request_id si hay context activo.
 * Use SIEMPRE este logger, no baseLogger directamente.
 */
export const logger = new Proxy(baseLogger, {
  get(target, prop) {
    if (typeof target[prop] !== 'function') return target[prop];
    
    return (...args: any[]) => {
      const ctx = getTracingContext();
      
      if (ctx && typeof args[0] === 'object' && args[0] !== null) {
        args[0] = {
          ...args[0],
          correlation_id: ctx.correlation_id,
          request_id: ctx.request_id,
          tenant_id: ctx.tenant_id,
        };
      }
      
      return target[prop](...args);
    };
  },
}) as typeof baseLogger;
```

### Uso

```typescript
// Cualquier código dentro de un AsyncLocalStorage context
import { logger } from '@/lib/logger';

logger.info({
  pii_level: 'internal',
  event: 'sale.processing',
  step: 'stock_validated',
  // correlation_id + request_id se inyectan automáticamente
});
```

### Tests

Test obligatorio: log dentro de context debe tener correlation_id presente.

```typescript
it('logger includes correlation_id from active context', () => {
  const writeSpy = vi.spyOn(process.stdout, 'write');
  
  withTracingContext(
    { correlation_id: 'test-A', request_id: 'test-B' },
    () => {
      logger.info({ event: 'test' });
    }
  );
  
  const output = writeSpy.mock.calls.flat().join(' ');
  expect(output).toContain('test-A');
});
```

---

## 9. Tests obligatorios

### T1 — End-to-end correlation flow

Test integración: simular request HTTP completo → Server Action → Service → DB insert → verificar que correlation_id llega intacto a `audit_log`.

```typescript
it('correlation_id propagates from HTTP request to audit_log', async () => {
  const testCorrelationId = crypto.randomUUID();
  
  const response = await fetch('/api/pos/sale', {
    method: 'POST',
    headers: {
      'x-correlation-id': testCorrelationId,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ items: [...] }),
  });
  
  expect(response.headers.get('x-correlation-id')).toBe(testCorrelationId);
  
  // Verificar que audit_log tiene el correlation_id
  const auditEntries = await db.query.auditLog.findMany({
    where: eq(auditLog.correlation_id, testCorrelationId),
  });
  expect(auditEntries.length).toBeGreaterThan(0);
  expect(auditEntries[0].correlation_id).toBe(testCorrelationId);
});
```

### T2 — Worker continuity

```typescript
it('worker preserves correlation_id from job', async () => {
  const testCorrelationId = crypto.randomUUID();
  
  // Insertar job con correlation_id específico
  await db.insert(jobsQueue).values({
    tenant_id: testTenantId,
    job_type: 'afip.emit_invoice',
    payload: { sale_id: testSaleId },
    correlation_id: testCorrelationId,
  });
  
  // Ejecutar worker (mock AFIP para que no llame real)
  await runAfipEmitInvoiceWorker();
  
  // Verificar que audit_log generado por el worker tiene mismo correlation_id
  const auditFromWorker = await db.query.auditLog.findFirst({
    where: and(
      eq(auditLog.correlation_id, testCorrelationId),
      eq(auditLog.event_name, 'fiscal.invoice.cae_received'),
    ),
  });
  expect(auditFromWorker).toBeDefined();
});
```

### T3 — Middleware genera correlation_id si no viene

```typescript
it('middleware generates correlation_id if absent', async () => {
  const response = await fetch('/api/products');  // sin x-correlation-id
  
  const generatedId = response.headers.get('x-correlation-id');
  expect(generatedId).toMatch(/^[0-9a-f-]{36}$/);  // UUID format
});
```

### T4 — Realtime broadcast incluye correlation_id

Test E2E con dos clientes en paralelo, cada uno con su correlation_id, verificar que cada cliente solo recibe broadcasts de SU operación.

### T5 — Logger inyecta correlation_id automáticamente

Ver §8.

---

## 10. Anti-patterns

### ❌ Generar nuevo correlation_id en cada layer

```typescript
// MAL
async function processInService(params: Params) {
  const correlation_id = crypto.randomUUID();  // ❌ rompe la cadena
  // ...
}

// BIEN
async function processInService(params: Params) {
  const correlation_id = getCorrelationId();  // ✅ hereda del context
  // ...
}
```

### ❌ No propagar correlation_id "por simplicidad"

```typescript
// MAL — service que no acepta context y no usa AsyncLocalStorage
function calculateTotal(items: Item[]): Decimal {
  // sin tracing
}
// Si esto loggea internamente, los logs no tienen correlation_id

// BIEN — usa getCorrelationId() si va a loguear
function calculateTotal(items: Item[]): Decimal {
  const correlation_id = getTracingContext()?.correlation_id;
  // logs con correlation_id si está disponible
}
```

### ❌ Múltiples correlation_id en una sola operación

```typescript
// MAL — cliente genera nuevo correlation_id por cada click
async function addItem(productId: string) {
  await tracedFetch('/api/cart/add', {
    correlationId: crypto.randomUUID(),  // ❌ cada add es operación distinta
  });
}

// BIEN — cliente genera UNA vez al iniciar operación
const operationCorrelationId = useMemo(() => crypto.randomUUID(), []);
async function addItem(productId: string) {
  await tracedFetch('/api/cart/add', {
    correlationId: operationCorrelationId,  // ✅ mismo durante toda la venta
  });
}
```

### ❌ Loggear correlation_id manualmente cuando ya está en context

```typescript
// MAL — duplicado
logger.info({
  event: 'sale.created',
  correlation_id: getCorrelationId(),  // ❌ el logger ya lo inyecta
});

// BIEN — el wrapper Proxy del logger lo inyecta automáticamente
logger.info({
  event: 'sale.created',
});
```

### ❌ Confiar en correlation_id como state ownership

Ver Regla J5 de EVENT-TAXONOMY.md. `correlation_id` es coordenada de búsqueda, no atributo de estado.

### ❌ Persistir correlation_id en entidades sin razón

Solo persistir en entidades de negocio si vale la pena para investigación posterior:

- `sales.correlation_id` ✅ (sí — operación crítica multi-step)
- `invoices.correlation_id` ✅ (sí — investigación fiscal)
- `products.correlation_id` ❌ (no — CRUD simple, basta con audit_log)
- `cart_items.correlation_id` ❌ (no — UI state)

---

## 11. F1+/F2+ Evolution Path

### F1+ — Cuando aparece `causation_id`

Si el sistema empieza a manejar eventos reactivos genuinos (no solo jobs explícitos), agregar `causation_id` al schema:

```sql
ALTER TABLE audit_log ADD COLUMN causation_id uuid;
ALTER TABLE jobs_queue ADD COLUMN causation_event_id uuid;
```

Permite reconstruir chains: "evento X fue causado por evento Y que fue causado por evento Z".

### F1+ — W3C `traceparent` header

Cuando aparezcan integraciones externas que soporten W3C Trace Context (OpenTelemetry estándar):

- Bridge entre nuestro `x-correlation-id` y `traceparent` standard
- Propagar traces a sistemas externos
- Recibir traces de sistemas externos

### F2+ — Distributed tracing real (OpenTelemetry)

Cuando hay N microservicios + integraciones complejas:

- OpenTelemetry SDK
- Tempo / Jaeger / Datadog APM
- Spans con parent/child relationships
- `correlation_id` se mapea a `trace_id` OTLP

F0 con AsyncLocalStorage + Pino + custom headers alcanza para 5 clientes piloto en monolito modular. OpenTelemetry justifica F2+ con escala real.

### F2+ — Distributed correlation cross-region

Si el proyecto escala a multi-region (improbable F0-F2):

- Garantías de uniqueness UUID v4 entre regions (estadística, no determinista)
- Replicación de audit_log cross-region
- Trace queries federadas

---

## 12. Resumen operativo

### Reglas absolutas

1. **Middleware** genera/extrae `correlation_id` + `request_id` en cada request HTTP. SIEMPRE.
2. **Server Actions** envuelven con `withServerActionTracing()` que monta AsyncLocalStorage.
3. **Services + Workers** usan `getCorrelationId()` / `getTracingContext()` para leer del context.
4. **Jobs encolados** llevan `correlation_id` del context que los creó (`jobs_queue.correlation_id`).
5. **Workers** heredan `correlation_id` del job + generan nuevo `request_id` propio.
6. **Audit log + entities relevantes** persisten `correlation_id` para queries posteriores.
7. **Realtime broadcasts** incluyen `correlation_id` en payload.
8. **Logger** inyecta `correlation_id` automáticamente desde context.
9. **Cliente** mantiene UN correlation_id por operación lógica (no por click).
10. **Anti-pattern absoluto:** generar nuevo correlation_id en cada layer.

### Implementación priorizada

| Componente | Prioridad | Razón |
|---|---|---|
| `src/lib/tracing/context.ts` (AsyncLocalStorage) | 🔴 F0 día 1 | Base de todo |
| `src/middleware.ts` (extracción headers) | 🔴 F0 día 1 | Sin esto, nada funciona |
| `src/lib/tracing/server-action.ts` (bridge) | 🔴 F0 día 1 | Server Actions lo necesitan |
| `src/lib/logger.ts` (Proxy con auto-inject) | 🔴 F0 día 1 | Todo log debe tener correlation_id |
| Schema migration: `sales.correlation_id`, `jobs_queue.correlation_id` | 🔴 F0 día 1 | Persistencia |
| `tracedFetch()` cliente | 🔴 F0 — antes del primer POST | Cliente lo necesita |
| `processJobWithTracing()` workers | 🟡 F0 — cuando se code primer worker | Workers async |
| `publishRealtimeEvent()` helper | 🟡 F0 — cuando se code primer broadcast | Realtime |
| `useCorrelationFilteredBroadcast()` hook | 🟡 F0 — cuando se code primera UI con Realtime | UI |

---

## 13. Conexión con Sesión 3 (Reconciliation Engine)

Reconciliation engine consume eventos como `fiscal.invoice.requires_reconciliation` y jobs como `afip.reconcile_pending`. La capacidad de **trazar end-to-end** una operación que vive horas (entre intentos del worker) **depende de que `correlation_id` se propague correctamente** desde el Sale original hasta el job de reconciliación y el audit log final del CAE recibido.

Sesión 3 va a usar las primitives definidas acá:

- `correlation_id` como coordenada para juntar todos los eventos de una reconciliación
- `jobs_queue.correlation_id` heredado del job original
- Logger automático con context
- Realtime broadcast al cliente cuando se resuelve

---

## Relacionado con

- [EVENT-TAXONOMY.md](EVENT-TAXONOMY.md) — define `correlation_id` field en `audit_log` + `jobs_queue` (Regla J5: trazabilidad sí, state ownership no)
- [DECISION-LEDGER.md](DECISION-LEDGER.md) — entry "CORRELATION-PROPAGATION v1.0.0"
- [AUTHORITY-MAP.md](AUTHORITY-MAP.md) — autoridades de propagación
- ADR-0019 — observability, Pino logger
- Rule 04-observability — logs estructurados + Pino + scrubbing

---

## Próxima sesión

**Sesión 3 — Reconciliation Engine.** Cómo `fiscal.invoice.requires_reconciliation` se procesa: states, retry semantics, dead letter philosophy, operator tooling, poison events. Usa AS BASE este documento + EVENT-TAXONOMY.md.
