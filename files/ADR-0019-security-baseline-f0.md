# ADR-0019 — Security baseline F0

**Fecha:** 2026-05-26 (original) — actualizado 2026-05-26 (auditoría externa)
**Estado:** Aprobado
**Relacionado con:** ADR-0002 (multi-tenant RLS), ADR-0010 (idempotency), Rule 04-observability
**Pendiente validación:** abogado especializado en Ley 25.326 + AAIP (items B2.7 + B4.4 + clasificación legal PII)

## Contexto

F0 va a producción con datos fiscales y personales de comercios argentinos. Sin baseline de seguridad explícito, cada feature trae decisiones ad-hoc inconsistentes. Este ADR consolida el mínimo no negociable.

**No reemplaza** pen-testing externo ni auditoría profesional (esos son F1+ cuando haya volumen real). **Define el suelo.**

## Threat model F0 — actores y amenazas

| Actor | Capacidad | Amenazas principales | Mitigaciones primarias |
|---|---|---|---|
| **Atacante externo no autenticado** | Conexión a internet, scripts automatizados | Credential stuffing, scraping, scanning, replay de webhooks | Rate limiting (S2), HMAC + replay protection (S3), CSP (S1) |
| **Usuario malicioso autenticado** | Cuenta en tenant A | Cross-tenant read, price tampering, escalación privilegios | RLS + Service validation (S7), recompute server (S4), audit log (S6) |
| **Empleado de cliente con permisos limitados** | Cajero con acceso al POS | Operaciones fuera de su rol, exfiltración de datos | Permisos por rol + audit log + S12 session policy |
| **Atacante con webhook secret filtrado** | Conoce secret HMAC | Replay attacks, event injection | S3-bis (timestamp + event ID dedup) |
| **Atacante con DB credentials** | Acceso directo a Postgres | Modificación audit log, dump completo | S6 trigger + S5 encryption + caveat: NO es tamper-proof real (ver S6) |
| **Atacante con master encryption key filtrada** | Puede decifrar todo histórico | Exfiltración secretos AFIP, MP, etc. | S5-bis key versioning + rotation strategy |
| **Atacante interno con acceso a backup** | Snapshot fuera de prod | Acceso fuera de RLS, decifrado de secrets persistidos | S14 backup encryption + access audit |
| **AAIP / inspector regulatorio** | Auditoría legal | Multa por no compliance Ley 25.326 / 11.683 | S8 PII classification + retention policy + S11 breach notification |

---

## S1 — Headers HTTP de seguridad

Configurar en `next.config.ts` para todas las rutas:

```typescript
const securityHeaders = [
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
  { key: 'Content-Security-Policy', value: buildCspString(nonce) },
];
```

### CSP — plantilla, calibrar en deploy

**⚠️ El CSP de abajo es PLANTILLA, no política final.** Next.js 16 + React 19 + RSC + dynamic chunks + Sentry + MercadoPago requieren calibración en primer deploy productivo.

```
default-src 'self';
script-src 'self' 'nonce-{REQUEST_NONCE}' 'strict-dynamic' https://js.mercadopago.com https://*.sentry-cdn.com;
style-src 'self' 'unsafe-inline';
img-src 'self' data: https: blob:;
font-src 'self' data:;
connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.mercadopago.com https://*.sentry.io https://*.ingest.sentry.io;
frame-src 'self' https://www.mercadopago.com.ar;
object-src 'none';
base-uri 'self';
form-action 'self';
upgrade-insecure-requests;
```

#### Checklist calibración primer deploy

- [ ] Verificar que Next 16 RSC chunks NO violan CSP con `'unsafe-inline'` en script-src (usar nonce + `strict-dynamic`)
- [ ] Verificar dominios de fonts (si usás Geist self-hosted, no necesita external)
- [ ] Sentry: confirmar dominio exacto de `*.ingest.sentry.io` según tu DSN
- [ ] MercadoPago: confirmar dominios de redirect en Checkout Pro
- [ ] Probar con CSP en `Content-Security-Policy-Report-Only` primero, monitorear violaciones por 1 semana
- [ ] Solo después pasar a `Content-Security-Policy` enforcing
- [ ] `style-src 'unsafe-inline'` queda por Tailwind/shadcn — aceptable; XSS via style es vector menor
- [ ] Reportar violaciones a endpoint propio (`/api/csp-report`) y a Sentry

---

## S2 — Rate limiting en endpoints públicos

### Targets mínimos F0

| Endpoint | Límite | Ventana | Por |
|---|---|---|---|
| `POST /api/auth/signin` | 5 intentos | 15 min | IP |
| `POST /api/auth/signup` | 3 cuentas | 1 hora | IP |
| `POST /api/auth/password-reset` | 3 requests | 1 hora | email |
| `POST /api/webhooks/mercadopago` | 1000 req | 1 min | IP (anti-flood) |
| Server Actions críticas | 100 ops | 1 min | usuario |

### Implementación F0 — tabla Postgres con TTL obligatorio

```sql
CREATE TABLE rate_limit_log (
  id bigserial PRIMARY KEY,
  bucket text NOT NULL,           -- ej: 'signin:1.2.3.4'
  attempted_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb
);

CREATE INDEX idx_rate_limit_lookup ON rate_limit_log(bucket, attempted_at DESC);
CREATE INDEX idx_rate_limit_cleanup ON rate_limit_log(attempted_at);
```

**Cleanup obligatorio:** cron diario que ejecuta:

```sql
DELETE FROM rate_limit_log WHERE attempted_at < now() - interval '24 hours';
```

**⚠️ Riesgo auto-DoS:** sin cleanup, la tabla crece linealmente y los inserts masivos generan write amplification + locks + storage. Si volumen real supera ~10k requests/min sostenido, **migrar a Upstash Redis** (lectura/escritura O(1), sin write amplification).

**Trigger Redis:** `rate_limit_log` > 1M filas O queries de lookup p95 > 50ms.

---

## S3 — HMAC verification en webhooks externos

Validar firma antes de procesar payload:

```typescript
import { createHmac, timingSafeEqual } from 'node:crypto';

export function verifyHmacSignature(
  body: string,
  signature: string | null,
  secret: string
): boolean {
  if (!signature) return false;
  const expected = createHmac('sha256', secret).update(body).digest('hex');
  if (expected.length !== signature.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}
```

**Métrica obligatoria:** `webhook_signature_invalid` > 0 dispara alerta (posible ataque).

## S3-bis — Replay protection en webhooks (CRÍTICO)

**HMAC valida autenticidad, NO previene replay.** Sin estas defensas, un atacante con un webhook válido capturado puede repetirlo 100 veces:

### Defensa 1 — Timestamp window

Validar que el webhook fue enviado en los últimos N minutos:

```typescript
const REPLAY_WINDOW_MS = 5 * 60 * 1000; // 5 minutos

function validateWebhookTimestamp(timestampHeader: string | null): boolean {
  if (!timestampHeader) return false;
  const ts = parseInt(timestampHeader, 10);
  if (Number.isNaN(ts)) return false;
  const skew = Math.abs(Date.now() - ts);
  return skew <= REPLAY_WINDOW_MS;
}
```

MercadoPago envía `x-request-id` y timestamp en headers. Adaptar según provider.

### Defensa 2 — Event ID deduplication

Cada evento procesado se registra en `processed_webhook_events`. Reintentos legítimos del provider (esperados) leen el resultado cacheado:

```sql
CREATE TABLE processed_webhook_events (
  provider text NOT NULL,
  event_id text NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now(),
  result jsonb NOT NULL,
  PRIMARY KEY (provider, event_id)
);

CREATE INDEX idx_processed_webhook_cleanup ON processed_webhook_events(processed_at);
```

```typescript
// /api/webhooks/mercadopago/route.ts
const eventId = body.id; // ID único del provider
const existing = await db.query.processedWebhookEvents.findFirst({
  where: and(
    eq(processedWebhookEvents.provider, 'mercadopago'),
    eq(processedWebhookEvents.eventId, eventId),
  ),
});

if (existing) {
  // Retorna el resultado original (reintento legítimo)
  return Response.json(existing.result);
}

// Procesar + persistir + insertar en processed_webhook_events DENTRO de la misma tx
```

**Cleanup obligatorio:** cron mensual que borra `processed_webhook_events` > 90 días (límite razonable de window de reintentos de cualquier provider).

### Defensa 3 — Métricas

| Métrica | Alerta si |
|---|---|
| `webhook_replay_detected` | > 0 en 1h → posible ataque |
| `webhook_timestamp_skew_exceeded` | > 0 → reloj desincronizado O ataque |
| `webhook_event_id_duplicate` | > 5/hora → posible bug del provider o ataque |

---

## S4 — Anti price-tampering

Server **NUNCA** confía en totales calculados en cliente:

```typescript
// SaleService.create()
const items = await db.query.products.findMany({ where: inArray(products.id, itemIds) });
const recalculatedTotal = calculateTotalFromDb(items, requestedItems);

if (!recalculatedTotal.equals(clientReportedTotal)) {
  logger.warn({
    pii_level: 'sensitive_pii',
    event: 'price_tampering_attempt',
    user_id: ctx.userId,
    company_id: ctx.companyId,
    client_total: clientReportedTotal.toString(),
    server_total: recalculatedTotal.toString(),
  });
  throw new PriceTamperingError();
}
```

**Métrica obligatoria:** `price_tampering_attempt` > 0 dispara investigación.

---

## S5 — Encriptación de secrets en DB

Datos sensibles persistidos van encriptados con AES-256-GCM:

| Dato | Por qué |
|---|---|
| **Certificados AFIP X.509 (clave privada)** | **⚠️ NO es API key — es IDENTIDAD FISCAL del comerciante**. Quien tiene el cert + key puede emitir comprobantes, consultar padrón, operar como contribuyente. Tratamiento ≠ API key común. |
| Tokens MercadoPago de larga duración | Cobros recurrentes |
| Tokens WhatsApp Business | Comunicación al cliente |
| **Tokens WSAA (Token + Sign)** | **⚠️ Autorización fiscal delegada temporal**. Robo permite emisión durante TTL del token (~12h). NUNCA exponer en logs, traces, frontend, ni traces de error. |
| API keys de terceros guardadas por tenant | Idem |

## S5-bis — Key versioning y rotation (CRÍTICO)

**Una sola master key sin versioning es game over si se filtra.** F0 debe arrancar con key versioning + plan de rotation desde día 1.

### Esquema con versioning

```typescript
// .env
SECRETS_ENCRYPTION_KEY_V1=<64 hex chars = 32 bytes>
SECRETS_ENCRYPTION_KEY_V2=  # vacía hasta primera rotación
SECRETS_ENCRYPTION_KEY_ACTIVE_VERSION=1
```

Cada ciphertext incluye prefijo de versión:

```typescript
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const KEYS: Record<number, Buffer> = {
  1: Buffer.from(process.env.SECRETS_ENCRYPTION_KEY_V1!, 'hex'),
  ...(process.env.SECRETS_ENCRYPTION_KEY_V2
    ? { 2: Buffer.from(process.env.SECRETS_ENCRYPTION_KEY_V2, 'hex') }
    : {}),
};

const ACTIVE_VERSION = parseInt(process.env.SECRETS_ENCRYPTION_KEY_ACTIVE_VERSION!, 10);

export function encrypt(plaintext: string): string {
  const version = ACTIVE_VERSION;
  const key = KEYS[version];
  if (!key) throw new Error(`Encryption key v${version} not loaded`);
  
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  
  // Format: v{N}:base64(iv || tag || ciphertext)
  return `v${version}:${Buffer.concat([iv, tag, ct]).toString('base64')}`;
}

export function decrypt(ciphertext: string): string {
  const match = ciphertext.match(/^v(\d+):(.+)$/);
  if (!match) throw new Error('Invalid ciphertext format — missing version prefix');
  
  const version = parseInt(match[1], 10);
  const key = KEYS[version];
  if (!key) throw new Error(`Decryption key v${version} not loaded — cannot read historical secret`);
  
  const data = Buffer.from(match[2], 'base64');
  const iv = data.subarray(0, 12);
  const tag = data.subarray(12, 28);
  const ct = data.subarray(28);
  
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
}
```

### Plan de rotation

| Cuando | Acción |
|---|---|
| Setup inicial | Generar `KEY_V1`, setear `ACTIVE_VERSION=1` |
| Rotation rutinaria (anual) | Generar `KEY_V2`, setear `ACTIVE_VERSION=2`, mantener V1 cargada por 90 días |
| Filtración detectada | Generar `KEY_V_NEW` inmediatamente, setear `ACTIVE_VERSION=NEW`, **re-encrypt todos los secrets persistidos** vía job, después remover key comprometida |

### Re-encryption job

```typescript
// scripts/reencrypt-secrets.ts
async function reencryptAllSecrets() {
  const tables = ['afip_certificates', 'mp_tokens', 'whatsapp_tokens', 'tenant_api_keys'];
  for (const table of tables) {
    const rows = await db.execute(sql`SELECT id, encrypted_data FROM ${sql.identifier(table)}`);
    for (const row of rows) {
      const plaintext = decrypt(row.encrypted_data);
      const reencrypted = encrypt(plaintext); // usa ACTIVE_VERSION
      await db.execute(sql`UPDATE ${sql.identifier(table)} SET encrypted_data = ${reencrypted} WHERE id = ${row.id}`);
    }
  }
}
```

**Envelope encryption (F1+):** evaluar AWS KMS o Supabase Vault. Por ahora `process.env` con versioning es F0-suficiente.

---

## S6 — Audit log inmutable

Tabla `audit_log` con trigger que bloquea UPDATE y DELETE:

```sql
CREATE OR REPLACE FUNCTION prevent_audit_log_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_log_no_update
  BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_mutation();
```

### ⚠️ Caveat — append-only ≠ tamper-proof

Esta protección es **defensa contra bugs y usuarios autenticados**, NO contra atacantes con acceso DB administrativo. Un atacante con credenciales `SUPERUSER` puede:

- `DROP TRIGGER audit_log_no_update`
- `TRUNCATE audit_log`
- Restaurar backup anterior sin las entradas comprometedoras
- Modificar `pg_catalog` directamente

**Compliance fiscal real requiere WORM (Write-Once-Read-Many):** ver S14 backup security + considerar S3 Object Lock para audit log archivado F1+. **F0 acepta la limitación explícitamente.**

### Trigger F1+: Hash chain audit log

Cuando el sistema escale (50+ clientes, primer post-incident con cuestionamiento legal de integridad del audit log), implementar hash chain criptográfico:

```sql
ALTER TABLE audit_log ADD COLUMN previous_hash text;
ALTER TABLE audit_log ADD COLUMN entry_hash text NOT NULL;

-- Trigger calcula:
-- entry_hash = SHA256(previous_hash || row_data || timestamp)
```

Beneficio: cualquier mutación post-hecho es detectable porque rompe la cadena de hashes. Detección, no prevención (sigue habiendo necesidad de WORM para prevención real).

**Trigger para implementar:**
- Primer cuestionamiento legal de integridad del audit log en producción
- O compliance auditor lo exige
- O 50+ clientes pagando (umbral de "vale la pena")

Costo: ~1 sprint de implementación + ~2-5ms latency por insert. No urgente F0.

### Excepción cleanup

Retention policy puede DELETE registros > 5 años (PII) o > 10 años (internal, Ley 11.683). Job mensual con audit propio del cleanup.

---

## S7 — Defensa en profundidad multi-tenant (ADR-0002)

Toda query con tenant context tiene **dos barreras**:

1. RLS Postgres con `auth.jwt() ->> 'company_id'`
2. Application Service con filtro explícito `eq(table.company_id, ctx.companyId)` + `assertCompanyMatches()`

Test cross-tenant obligatorio por Service. Sin test, no merge. Detalle en Rule 02-multi-tenant.md.

### Tenant isolation fiscal hard

El tenant aislamiento NO se limita a tablas de negocio. Se extiende a TODO recurso fiscal:

| Recurso | Aislamiento por tenant | Implementación |
|---|---|---|
| **Datos de negocio** (sales, products, etc.) | RLS + Service filter | ADR-0002 (estándar) |
| **Certificados AFIP X.509** | Encrypted por tenant, key derivation por `company_id` | ADR-0019 S5/S5-bis |
| **Tokens WSAA cache** | Tabla `wsaa_tokens` con `company_id` + RLS | Implementación específica del módulo AFIP |
| **Numeración fiscal** | `invoice_sequences` con `company_id` + (sale_point, invoice_type) | ADR-0006 |
| **Audit log fiscal** | `audit_log` con `company_id` + RLS | ADR-0010 |
| **Storage (PDFs, XMLs)** | Bucket/prefix por `company_id` | Supabase Storage policies |
| **Queues / jobs** | Cada job lleva `company_id` + worker valida | Implementación específica F1+ |
| **Métricas fiscales** | Tag `company_id` en cada métrica | Rule 04-observability |

**Regla absoluta:** un tenant **jamás** debe poder ver, usar, emitir, ni tocar credenciales del tenant B. Test cross-tenant cubre TODA estas dimensiones, no solo tablas de negocio.

---

## S8 — PII en logs: clasificación operacional + mapping legal pendiente

### Clasificación operacional (Rule 04-observability)

| `pii_level` | Contenido | Retención | Acceso |
|---|---|---|---|
| `public` | Metadata sin contexto personal | 90 días | Dev del proyecto |
| `internal` | IDs sin contenido personal | 90 días | Dev del proyecto |
| `pii` | Nombres parciales, CUIT/CUIL/DNI masked | 30 días | Dev + auditoría |
| `sensitive_pii` | IPs, sesiones, intentos auth fallidos | 7 días | Solo seguridad |

**⚠️ Esta clasificación es OPERACIONAL, no legal.** Argentina Ley 25.326 (AAIP) ≠ GDPR. El mapping legal exacto (qué constituye "dato sensible" art. 7, qué requiere consentimiento explícito, qué clasifica como "dato común") **requiere validación con abogado especializado AAIP** (ver item B2.7 + Sesión 5 v4).

Sentry tiene `beforeSend()` con scrubbing default-deny.

---

## S9 — Secrets management

Variables de entorno validadas con Zod en arranque (`src/config/env.ts`):

```typescript
const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().url(),
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(40),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(40),
  
  // Auth
  JWT_SECRET: z.string().min(32),
  
  // Money (ADR-0005)
  MONEY_ROUNDING_POLICY: z.enum(['HALF_UP', 'HALF_DOWN', 'HALF_EVEN']),
  
  // Encryption (S5-bis)
  SECRETS_ENCRYPTION_KEY_V1: z.string().length(64),
  SECRETS_ENCRYPTION_KEY_V2: z.string().length(64).optional(),
  SECRETS_ENCRYPTION_KEY_ACTIVE_VERSION: z.coerce.number().int().positive(),
  
  // External
  AFIP_CUIT: z.string().regex(/^\d{11}$/),
  AFIP_ENVIRONMENT: z.enum(['homologacion', 'produccion']),
  MP_ACCESS_TOKEN: z.string().min(20),
  MP_WEBHOOK_SECRET: z.string().min(20),
  
  // Observability
  SENTRY_DSN: z.string().url().optional(),
});

export const env = envSchema.parse(process.env);
```

## S13 — Secret lifecycle (CRÍTICO)

### Provenance — quién genera

| Secret | Generador | Ubicación canónica | Acceso humano |
|---|---|---|---|
| `JWT_SECRET` | Owner técnico (vos) | Vercel env vars | Solo vos |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard | Vercel env vars | Solo vos |
| `SECRETS_ENCRYPTION_KEY_V*` | Owner técnico (vos) generado con `openssl rand -hex 32` | Vercel env vars | Solo vos |
| `MP_ACCESS_TOKEN` | MercadoPago Developer Panel | Vercel env vars | Solo vos |
| `MP_WEBHOOK_SECRET` | Owner técnico vía MP panel | Vercel env vars | Solo vos |
| Certificado AFIP X.509 (tenant) | Cliente (sube vía wizard onboarding) | Encrypted DB (S5-bis) | Cliente + admin tenant |

### Isolation por environment

**Cada environment (development / staging / production) tiene su propio set de secrets, sin overlap:**

| Environment | Origen secrets | AFIP environment |
|---|---|---|
| `development` | `.env.local` con valores de test | **`homologacion`** (sandbox AFIP) |
| `staging` | Vercel preview env vars (sandbox tokens) | **`homologacion`** |
| `production` | Vercel production env vars (tokens reales) | **`produccion`** |

**Regla absoluta:** un secret de producción NUNCA aparece en code, logs, commits, ni en `.env.example`. `.env.example` solo tiene placeholders vacíos.

### ⚠️ AFIP — Homologación vs Producción: separación HARD

ARCA/AFIP separa explícitamente:
- Certificados X.509
- Endpoints WSAA + WSFEv1
- Cadenas de certificación

Entre **homologación** (testing) y **producción** (real).

**Reglas operativas no negociables:**

1. **Un certificado de homologación NUNCA puede llegar a un endpoint de producción.** Validación a nivel código: si `AFIP_ENVIRONMENT === 'produccion'` y el cert metadata indica homologación → throw, no enviar request.

2. **Un certificado de producción NUNCA puede aparecer en development/staging.** El cert prod solo existe en Vercel production env vars + DB de producción.

3. **Test de tenant nunca usa secrets de tenant productivo.** Datos sintéticos para testing — no copiar producción a development.

4. **DB de producción no se replica a development.** Si necesitás reproducir un bug con data real, sanitizar primero (anonimizar CUIT, encriptar secrets distintos, etc.).

```typescript
// src/lib/afip/client.ts — validación obligatoria
function buildAfipClient(env: 'homologacion' | 'produccion', cert: X509Certificate) {
  const certEnv = cert.metadata.environment;
  if (env !== certEnv) {
    throw new EnvironmentMismatchError(
      `Cert is for ${certEnv}, but client target is ${env}. ABORT.`
    );
  }
  return new AfipClient(env, cert);
}
```

### Access audit

Cualquier cambio de env vars en Vercel queda en audit log de Vercel (incluido en plan Pro). Para F0 con plan Hobby, mantener changelog manual en `docs/security-changelog.md`.

### Rotation cadence

| Secret | Rotation | Trigger |
|---|---|---|
| `JWT_SECRET` | Cada 12 meses | Rutinario O exposición sospechada |
| `SECRETS_ENCRYPTION_KEY` | Cada 12 meses (con re-encryption job) | Rutinario O exposición |
| `MP_WEBHOOK_SECRET` | Cuando MercadoPago lo permita rotar | Exposición sospechada |
| Certificados AFIP (tenant) | Cuando el certificado vence | Vencimiento del certificado AFIP |

---

## S10 — CSRF protection + Cookie policy

### CSRF

Server Actions de Next.js 16 incluyen CSRF protection automática vía `Origin`/`Host` header check. **Verificar en cada release** que no se deshabilita con `experimental.serverActions.allowedOrigins` mal configurado.

### Cookies — SameSite=Lax default

```typescript
// Set cookie auth
cookieStore.set('session', token, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax', // ← default para evitar romper redirects MP/OAuth
  path: '/',
  maxAge: 60 * 60 * 24 * 7, // 7 días (ver S12 para política de sesión)
});
```

**Por qué Lax y no Strict:**
- MercadoPago redirect → vuelta al sitio: Strict bloquea cookie en cross-site navigation
- OAuth flows (futuro): idem
- Compartir links del POS entre tabs / WhatsApp: Strict puede romper

**Strict by exception** para endpoints de mayor riesgo (ej: anular venta, cerrar caja con descuadre). Implementar cookie separada `__Host-pandora-strict` con SameSite=Strict para esos casos críticos si auditoría futura lo requiere.

---

## S11 — Notification breach (pendiente validación AAIP)

Si se detecta fuga cross-tenant en producción:

1. Pausar deploys
2. Identificar scope: qué tenants, qué datos, qué ventana de tiempo
3. **Notificar a AAIP** (plazo legal pendiente confirmar con abogado — item B4.4 de Sesión 5 v4)
4. Notificar a tenants afectados
5. Post-mortem público (sin nombres de tenants)
6. Generar test que previene el bug específico

Runbook detallado en `docs/runbooks/security-incident.md` (F0.5).

---

## S12 — Session security policy (CRÍTICO)

### Timeouts

| Tipo | Duración | Comportamiento al expirar |
|---|---|---|
| **Idle timeout** | 30 minutos | Logout automático, requiere re-auth |
| **Absolute timeout** | 12 horas | Logout forzado independiente de actividad |
| **Refresh token TTL** | 7 días | Después de eso, login completo requerido |

```typescript
// src/lib/auth/session.ts
export const SESSION_IDLE_TIMEOUT_MS = 30 * 60 * 1000;
export const SESSION_ABSOLUTE_TIMEOUT_MS = 12 * 60 * 60 * 1000;
export const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
```

### Rotation

- Cada cambio de password → invalidar todas las sesiones del usuario
- Cada cambio de rol (admin → cajero) → invalidar sesiones del usuario afectado
- Cada cambio de `company_id` activo (contador multi-empresa) → rotar JWT con nuevo claim
- Reset password → invalidar todas las sesiones + email de notificación

### Concurrent sessions

F0: **permitidas** (cajero abre dos tabs, owner usa desktop + móvil). No bloquear.

F1+ evaluar:
- Límite de N sesiones concurrentes por usuario
- Notificar al usuario cuando hay nueva sesión activa
- "Ver mis sesiones activas" + "Cerrar otras sesiones"

### Device revocation

Tabla `active_sessions`:

```sql
CREATE TABLE active_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id),
  company_id uuid REFERENCES companies(id),
  device_fingerprint text,           -- user agent + IP hash
  ip_masked text,                    -- 192.168.X.X
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_activity timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  revoked_reason text                -- 'user_logout' | 'admin_revoke' | 'password_change' | 'idle_timeout' | 'absolute_timeout'
);

CREATE INDEX idx_active_sessions_user ON active_sessions(user_id) WHERE revoked_at IS NULL;
CREATE INDEX idx_active_sessions_cleanup ON active_sessions(created_at);
```

UI F1+: "Mis dispositivos activos" + botón "Revocar".

### Métricas

| Métrica | Alerta si |
|---|---|
| `session_idle_timeout` | Tracking — informa si 30min es muy corto |
| `session_absolute_timeout_forced` | > 5% sesiones — informa si 12h es muy corto |
| `session_concurrent_per_user_p95` | > 5 → posible credential sharing |
| `session_revoked_admin` | > 0 → investigar |

---

## S15 — TLS enforcement obligatorio (compatibilidad AFIP)

ARCA/AFIP **discontinuó oficialmente TLS 1.0 y TLS 1.1** por inseguridad. Toda conexión hacia AFIP web services requiere **TLS 1.2+** con validación estricta.

### Reglas absolutas

1. **TLS 1.2 mínimo, TLS 1.3 preferido** en cualquier conexión saliente a AFIP / ARCA.
2. **Validación de certificado del servidor obligatoria.** Nunca `rejectUnauthorized: false` o equivalente.
3. **Hostname verification obligatoria.** El cert del servidor debe matchear el hostname AFIP esperado.
4. **Cipher suites modernas.** Bloquear ciphers débiles (RC4, 3DES, CBC sin AEAD).

### Implementación Node.js

```typescript
// src/lib/afip/wsfev1-client.ts
import { Agent } from 'node:https';

const afipAgent = new Agent({
  minVersion: 'TLSv1.2',           // floor
  maxVersion: 'TLSv1.3',
  // ciphers: use defaults (Node 20+ son seguros)
  rejectUnauthorized: true,         // NUNCA cambiar a false
  // Hostname verification es el default — no deshabilitar
});

// Validación al iniciar
const tlsCheckResult = await tlsVersionProbe('https://wsaa.afip.gov.ar/ws/services/LoginCms');
if (!['TLSv1.2', 'TLSv1.3'].includes(tlsCheckResult.protocol)) {
  throw new Error(`AFIP endpoint negotiated insecure TLS: ${tlsCheckResult.protocol}`);
}
```

### ⚠️ Anti-pattern muy común a evitar

**Muchos integradores AFIP en la industria desactivan validación SSL "para que funcione".** Eso es vector de ataque MITM trivial. Pandora NO hace eso, sin excepciones.

Si la conexión AFIP falla por cert/TLS:
- NO bypass
- Investigar la causa real (cert vencido del lado AFIP, CA chain incompleta, hostname diff)
- Reportar como incident, no como workaround

### CA allowlist (informativo, no enforce hard)

ARCA publica autoridades certificantes reconocidas. Hard pinning agresivo NO se recomienda (ARCA cambia certificados periódicamente y un pin desactualizado bloquea toda la facturación).

Solución intermedia: telemetría de cambios de CA.

```typescript
// Cada conexión AFIP loggea el CA del cert del servidor (no el cert completo, solo issuer)
metric('afip_tls_ca_issuer', { 
  issuer: cert.issuer.CN,
  endpoint: 'wsaa' | 'wsfev1' | 'padron_a5',
});
```

**Alerta:** si `issuer` cambia de un día al otro sin que ARCA haya anunciado cambio → investigar (puede ser MITM o cambio legítimo no comunicado).

### Métricas obligatorias

| Métrica | Alerta si |
|---|---|
| `afip_tls_version_used` | != TLSv1.2 / TLSv1.3 |
| `afip_tls_validation_failed` | > 0 (CRÍTICO — investigar) |
| `afip_tls_ca_issuer_change` | > 0 en 1 día (investigar) |

---

## S16 — Time synchronization (NTP)

### Por qué importa

WSAA tokens, replay windows, timestamps en payload, audit log timestamps, todo depende de tiempo monotónico y consistente. Drift de reloj > 5 minutos rompe:

- **WSAA token expiration** — token "todavía vivo" según nuestro reloj puede estar expirado según AFIP, o viceversa
- **Replay protection** (S3-bis) — window ±5min se calcula sobre Date.now() local
- **Timestamps en payload AFIP** — fecha de emisión debe coincidir con expectativa AFIP
- **Audit log ordering** — eventos secuenciales pueden quedar desordenados
- **Idempotency TTL** — entrada "vencida" según un servidor sigue "vigente" según otro

### Reglas operativas

1. **Vercel y Supabase usan NTP managed.** No requiere configuración manual.
2. **Verificar al arranque:** test simple de drift contra servidor NTP público (`time.google.com`). Si drift > 1 segundo → log warning. Si > 5 segundos → throw error y no servir requests.
3. **UTC como tiempo canónico interno.** Toda timestamp en DB es `timestamptz` UTC. Conversión a timezone del cliente solo en presentación.
4. **NUNCA usar `new Date()` para timestamps fiscales.** Usar `getCurrentFiscalTime()` que valida drift antes de retornar.

```typescript
// src/lib/time/fiscal-time.ts
'use server';
import 'server-only';

let lastDriftCheck: Date | null = null;
let knownDriftMs: number = 0;
const DRIFT_THRESHOLD_WARN_MS = 1000;
const DRIFT_THRESHOLD_ERROR_MS = 5000;
const DRIFT_CHECK_INTERVAL_MS = 5 * 60 * 1000;  // 5 min

export async function getCurrentFiscalTime(): Promise<Date> {
  const now = new Date();
  
  if (!lastDriftCheck || (now.getTime() - lastDriftCheck.getTime()) > DRIFT_CHECK_INTERVAL_MS) {
    knownDriftMs = await measureNtpDrift();
    lastDriftCheck = now;
    
    if (Math.abs(knownDriftMs) > DRIFT_THRESHOLD_ERROR_MS) {
      throw new ClockDriftError(`Clock drift ${knownDriftMs}ms exceeds threshold`);
    }
    if (Math.abs(knownDriftMs) > DRIFT_THRESHOLD_WARN_MS) {
      logger.warn({ pii_level: 'internal', event: 'clock.drift_warning', drift_ms: knownDriftMs });
    }
  }
  
  return now;
}
```

### Métricas obligatorias

| Métrica | Alerta si |
|---|---|
| `clock_drift_ms` | abs > 1000 (warning) o > 5000 (critical) |
| `clock_drift_check_failed` | > 0 (servidor NTP unreachable) |

---

## S14 — Backup security

Supabase managed cubre lo básico:

- **PITR (Point-In-Time Recovery):** hasta 7 días en plan Pro
- **Daily snapshots:** retención 7 días
- **Encryption at rest:** AES-256 a nivel storage

### F0 — política mínima

| Tarea | Frecuencia | Quién |
|---|---|---|
| **Restore test** | Mensual | Owner técnico (vos) |
| **Export semanal a S3 propio** | Semanal automatizado | Vercel cron |
| **Verificación integridad export** | Mensual con restore test | Vos |
| **Access audit Supabase Dashboard** | Trimestral | Vos |

### Restore test mensual

Procedimiento documentado en `docs/runbooks/restore-test.md` (F0.5):

```bash
# Pseudo:
1. supabase backup download --latest
2. crear DB temporal de prueba
3. restore al ambiente test
4. verificar count rows = production count rows ± 5%
5. correr query sample: SELECT * FROM sales LIMIT 10
6. confirmar tenant isolation (RLS funciona en restore)
7. destruir DB temporal
8. logear resultado en `docs/security-changelog.md`
```

**Si el restore test falla:** STOP deploys, investigar inmediatamente. Backup que no restaura = no es backup.

### Backup encryption + secret leakage

- **Secretos en DB ya están encrypted (S5-bis)** — el backup hereda esa protección
- `audit_log` en backup tiene la misma limitación que en prod (no es tamper-proof real)
- **Secrets en `.env` NO van a backups** porque viven en Vercel env, no en DB

---

## Métricas obligatorias agregadas

| Métrica | Severidad alerta |
|---|---|
| `cross_tenant_attempt_blocked` > 0 | 🔴 CRÍTICO inmediato |
| `price_tampering_attempt` > 0 | 🔴 CRÍTICO |
| `webhook_signature_invalid` > 0 | 🔴 CRÍTICO |
| `webhook_replay_detected` > 0 | 🔴 CRÍTICO |
| `auth_failed_attempts` > 10/min mismo IP | 🟡 ALTO |
| `rate_limit_log` > 1M filas | 🟡 ALTO (migrar a Redis) |
| `session_concurrent_per_user_p95` > 5 | 🟡 MEDIO (credential sharing?) |
| `restore_test_failed` | 🔴 CRÍTICO |

---

## Alternativas rechazadas

- **CSP con `'unsafe-inline'` global en script-src:** rechazado. Solo permitido en `style-src` (Tailwind/shadcn).
- **Rate limiting solo en cliente:** rechazado. Trivial bypass.
- **JWT en localStorage:** rechazado. Vulnerable a XSS.
- **SameSite=Strict por default:** rechazado. Rompe MP redirects.
- **Hashear CUIT en logs (sin masking):** rechazado. Re-identificación con rainbow tables.
- **Pen-test antes de F0:** rechazado por costo y timing. Defer F1 con 50+ clientes.
- **Master key sin versioning:** rechazado en esta auditoría — F0 arranca con V1 + plan rotation.
- **Sesiones sin idle timeout:** rechazado. ERP fiscal con cajeros = riesgo de PC desatendida.

---

## Consecuencias

**Positivas:**
- Baseline explícito que cada feature debe cumplir.
- Threat model documentado (no implícito).
- Replay protection desde día 1.
- Key rotation factible sin refactor masivo.
- Session policy clara reduce vector de PC desatendida.

**Negativas:**
- Setup inicial: ~6-10 horas (vs ~4-8h sin S3-bis/S5-bis/S12).
- Más env vars que mantener.
- Restore test mensual es trabajo del owner — disciplina necesaria.

**Riesgos a monitorear:**
- CSP rompe integración con tercero nuevo → calibrar al agregar dominio.
- Rate limit muy agresivo bloquea uso legítimo → calibrar con clientes piloto.
- Idle timeout 30min muy corto si cajeros toman pausas largas → ajustar por feedback.

## Pendiente validación humana

- **Abogado especializado AAIP + Ley 25.326:**
  - B2.7 — Cuándo es obligatoria inscripción AAIP
  - B4.4 — Plazo legal notificación breach
  - B2.3 — IP es dato personal según AAIP, ¿requiere consentimiento?
  - B2.5 — Plazo legal solicitud borrado ARCO
  - Mapping legal exacto de `pii_level` operacional vs categorías Ley 25.326

- **Pen-test externo:** F1+ cuando haya volumen real.

- **Threat model expandido (STRIDE completo):** F1+ con 50+ clientes.

---

## Triggers de re-evaluación

| Trigger | Acción |
|---|---|
| Primer incidente de seguridad reportado | Revisar todo este baseline |
| Cambio normativo AAIP/Ley 25.326 | Actualizar S8/S11 |
| Auditoría externa contratada | Incorporar findings |
| Volumen > 100 clientes pagando | Considerar pen-test + envelope encryption AWS KMS |
| `rate_limit_log` > 1M filas | Migrar a Upstash Redis |
| Filtración de cualquier master key | Rotation inmediata + re-encryption + investigación |
| Restore test falla | STOP deploys hasta resolver |
