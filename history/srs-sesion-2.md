# PANDORA ERP — SRS Sesión 2
## Sección 13 Observabilidad + Máquinas de Estado completas

**Fecha:** 17 mayo 2026
**Base:** SRS v2.0-OMN + Sesión 1
**Estado:** Aprobado para integración en SRS v3.0
**Contenido:**
- **Parte 1:** Sección 13 Observabilidad operativa (reemplaza párrafos dispersos de v2.0-OMN)
- **Parte 2:** 9 máquinas de estado faltantes (Payment, CashSession completa, StockReservation, WebhookEvent, BackgroundJob, ImportJob, ExportJob, Integration, OfflineSync)

**Marcado:**
- 🟢 **VERDE:** Técnico, alta confianza
- 🟡 **AMARILLO:** Requiere validación humana antes de producción
- 🔴 **ROJO:** Decisión pendiente del owner

---

# PARTE 1 — SECCIÓN 13 OBSERVABILIDAD OPERATIVA

🟢 **VERDE en su totalidad** — técnico/operativo sin implicancias fiscales o legales.

---

## 13. Observabilidad

### 13.1 Filosofía

**Sin trazabilidad no se mergea.** Toda operación crítica debe poder reconstruirse desde logs, métricas y traces sin necesidad de acceder a la DB de producción. La observabilidad no es una capa opcional: es parte del producto, no overhead.

**Tres pilares operativos:**

1. **Logs estructurados** (Pino) — qué pasó, en qué orden, con qué contexto.
2. **Métricas** (Prometheus / Vercel Analytics / OpenTelemetry) — cuánto, qué tan rápido, qué tan seguido.
3. **Traces** (OpenTelemetry desde Fase 2) — el flujo completo de una request end-to-end.

**Reglas no negociables:**

- Toda operación crítica emite log + métrica.
- Todo error 5xx genera entrada en Sentry con `tenant_id` + `correlation_id`.
- Toda llamada a integración externa (AFIP, MP, Resend, Twilio) tiene timeout, retry y métrica de éxito/fallo.
- Ningún log contiene datos sensibles (certificados AFIP, tokens, passwords, números completos de tarjeta).
- El comerciante puede ver sus propios eventos críticos vía dashboard. El soporte Pandora puede ver eventos cross-tenant solo con auditoría obligatoria.

### 13.2 Logs estructurados (Pino)

#### Schema obligatorio

Toda entrada de log incluye estos campos. Sin excepción.

```json
{
  "timestamp": "ISO8601 UTC con milisegundos",
  "level": "trace | debug | info | warn | error | fatal",
  "service": "pandora-app | pandora-worker | pandora-cron",
  "environment": "development | staging | production",
  "tenant_id": "uuid de la empresa, null si pre-auth",
  "user_id": "uuid del usuario, null si sistema",
  "user_role": "owner | admin | cashier | ... | null",
  "correlation_id": "uuid generado al inicio de la request",
  "request_id": "uuid del HTTP request si aplica",
  "action": "string en formato dominio.accion (sale.created, stock.adjusted)",
  "entity": "string del recurso afectado (sale, stock, customer)",
  "entity_id": "uuid del registro principal afectado",
  "duration_ms": "number — solo en logs de finalización de operación",
  "metadata": {
    "ip": "IP del cliente",
    "user_agent": "string",
    "terminal_id": "uuid si POS",
    "branch_id": "uuid si aplica",
    "channel": "pos | web | whatsapp | api"
  },
  "message": "string legible humano",
  "error": {
    "name": "string del error class",
    "message": "string",
    "stack": "string (solo en error/fatal)",
    "cause": "objeto del error original si fue wrap"
  }
}
```

#### Niveles de log: cuándo usar cada uno

| Nivel | Uso | Ejemplo | Retención |
|---|---|---|---|
| `trace` | Detalle granular para debugging local | "DB query started: SELECT * FROM products WHERE..." | No persistir en producción |
| `debug` | Información útil para debugging diferido | "Cache hit on product_catalog:tenant-uuid" | 7 días en staging, off en prod |
| `info` | Operaciones de negocio normales | "Sale #1234 created, total $12.345" | 30 días |
| `warn` | Algo no ideal pero no crítico | "AFIP responded slowly (>10s) but succeeded" | 90 días |
| `error` | Error que afecta una operación pero no el sistema | "Payment failed: insufficient funds" | 1 año |
| `fatal` | Error crítico que requiere intervención | "Database connection pool exhausted" | Indefinido + alerta inmediata |

#### Sanitización obligatoria

Antes de loggear, sanitizar:

- **Passwords:** nunca aparecen en logs, ni siquiera en errores de auth.
- **Certificados AFIP:** loggear solo `cert_id` y `expires_at`, nunca el contenido.
- **Tokens (AFIP, MP, sesión):** loggear solo prefijos (`token: "abc1...xyz9"`).
- **Tarjetas de crédito:** Pandora no recibe datos de tarjeta directos (delegado a MP), pero si llegara: solo last4 + brand.
- **CUITs/DNIs:** loggear solo en operaciones que lo requieran (facturación). En logs operativos generales: hash o omit.
- **Direcciones físicas y teléfonos de clientes:** solo en operaciones específicas, no en logs rutinarios.

#### Validación en CI

Test automático que falla el build si:

- Hay `console.log` en el código (debe ser `logger.info`).
- Hay strings que matchean patterns de tarjeta de crédito, CUIT completo, password.
- Hay logs sin `tenant_id` en operaciones de negocio.

### 13.3 Stack tecnológico de logs

| Capa | Tool | Fase | Notas |
|---|---|---|---|
| Generación | Pino | Fase 0 | Standard de Node.js, performante. |
| Transporte local (dev) | pino-pretty | Fase 0 | Console output legible. |
| Agregación cloud (prod) | Vercel logs nativos | Fase 0 | Built-in. Retención limitada a 7 días en Hobby. |
| Agregación extendida | Axiom o Better Stack | Fase 1 | Cuando Vercel logs sea insuficiente. ~$25/mes. |
| Búsqueda y dashboards | Mismo proveedor que agregación | Fase 1 | Filtros por tenant_id, correlation_id, action. |

**Decisión:** Empezar con Vercel logs nativos en Fase 0. Migrar a Axiom o Better Stack cuando: (a) la retención de 7 días sea insuficiente, o (b) haya más de 50 clientes que generen volumen incómodo de buscar.

### 13.4 Métricas de negocio

Las métricas técnicas (CPU, memoria, latencia HTTP) las cubre Vercel Analytics out of the box. Lo que NO cubre y debe instrumentarse manualmente: **métricas de negocio**.

#### Métricas obligatorias Fase 0

| Métrica | Tipo | Unidad | SLO | Alerta si |
|---|---|---|---|---|
| `afip_cae_success_rate` | Gauge | % | > 95% | < 90% por 15 min consecutivos |
| `afip_request_latency_p99` | Histogram | ms | < 8000ms | > 25000ms (cerca del timeout) |
| `afip_timeout_count` | Counter | count/hora | < 5 | > 20/hora |
| `sale_creation_duration_p95` | Histogram | ms | < 2000ms | > 5000ms |
| `sale_creation_failure_rate` | Gauge | % | < 1% | > 5% |
| `stock_negative_events` | Counter | count/día | 0 si tenant lo prohíbe | > 0 cuando el tenant lo prohíbe |
| `cash_session_difference_rate` | Gauge | % | < 5% sesiones con descuadre | > 15% |
| `cash_session_force_closed_rate` | Gauge | % | < 3% | > 10% |
| `mp_webhook_lag_p99` | Histogram | seconds | < 30s | > 120s |
| `mp_webhook_failure_rate` | Gauge | % | < 2% | > 10% |
| `email_bounce_rate` | Gauge | % | < 5% | > 10% (afecta reputación de dominio) |
| `idempotency_replay_rate` | Counter | count/hora | < 50 | > 500 (puede indicar bug en cliente que reenvía) |

#### Métricas obligatorias Fase 1+

| Métrica | Tipo | Fase | Notas |
|---|---|---|---|
| `queue_depth_by_priority` | Gauge | F1 | BullMQ jobs en cola por prioridad. |
| `queue_processing_time_p95` | Histogram | F1 | Tiempo desde encolado hasta completado. |
| `dead_letter_queue_size` | Gauge | F1 | Alerta si > 10. |
| `job_retry_rate` | Gauge | F1 | % de jobs que requieren retry. |
| `whatsapp_template_approval_rate` | Gauge | F1 | % aceptación por Meta. Lento = bloqueante. |
| `accountant_dashboard_load_p95` | Histogram | F1 | Dashboard contador con N empresas. |

#### Métricas de Fase 2 (escala)

| Métrica | Tipo | Fase |
|---|---|---|
| `customer_retention_rate_monthly` | Gauge | F1 |
| `accountant_referral_conversion` | Gauge | F1 |
| `tenant_active_dau` | Gauge | F1 |
| `api_rate_limit_hits` | Counter | F2 |
| `tenant_resource_consumption_p95` | Histogram | F2 |
| `cross_tenant_attempt_blocked` | Counter | F2 |

#### Stack para métricas

| Capa | Tool | Fase | Notas |
|---|---|---|---|
| Generación | Custom helper sobre Pino + headers | Fase 0 | Métrica = log con `type: 'metric'`. |
| Agregación | Vercel Analytics (web vitals) + Sentry Performance (transactions) | Fase 0 | Cubre lo básico. |
| Métricas custom | Axiom queries sobre logs estructurados | Fase 1 | Las métricas se derivan de logs. |
| Time-series dedicada | OpenTelemetry + Prometheus + Grafana | Fase 2+ | Cuando volumen lo justifique. |

### 13.5 Alertas y destinos

#### Filosofía de alertas

Tres niveles. Cada nivel tiene destino y tiempo de respuesta esperado.

| Nivel | Destino | Tiempo de respuesta esperado | Ejemplo |
|---|---|---|---|
| **Info** | Slack `#pandora-ops` o email diario | Revisión diaria | "Reporte diario: 234 ventas, 99.2% CAE success" |
| **Warning** | Slack `#pandora-alerts` | 4 horas | "AFIP success rate cayó a 92% en última hora" |
| **Critical** | Slack + Email + SMS al owner (Pandora) | < 30 minutos | "DB connection pool exhausted en producción" |

**No usar PagerDuty en Fase 0.** Es overkill para un equipo de 1 persona. Slack + SMS al teléfono propio alcanzan.

#### Alertas obligatorias Fase 0

| Alerta | Trigger | Nivel | Destino |
|---|---|---|---|
| AFIP success rate baja | `afip_cae_success_rate < 90%` por 15 min | Critical | Slack + SMS |
| AFIP timeout masivo | > 20 timeouts/hora | Critical | Slack + SMS |
| Errors 5xx elevados | > 5 errores/min por 5 min | Critical | Slack + SMS |
| DB connection issues | Connection errors en logs | Critical | Slack + SMS |
| Certificado AFIP por vencer | Vence en 30/15/7/3/1 días | Warning escalando a Critical | Email al owner del tenant + Pandora |
| Cross-tenant leak detectado | Cualquier query con tenant_id mismatch | Critical | Slack + SMS + freeze del tenant |
| Tasa de descuadre alta | `cash_session_difference_rate > 15%` global | Warning | Slack |
| Queue lag alta | Jobs encolados > 30 min sin procesar | Warning | Slack |
| Webhook MP fallando | `mp_webhook_failure_rate > 10%` | Warning | Slack |
| Dead letter queue creciendo | > 10 items en DLQ | Warning | Slack |

#### Alertas por tenant (lado del comerciante)

El comerciante recibe alertas operativas de SU empresa, no de Pandora global:

| Alerta | Trigger | Canal |
|---|---|---|
| Caja con descuadre | Cierre con diferencia > tolerancia | Email + dashboard |
| Stock crítico | Producto bajo mínimo | Email diario consolidado |
| Factura pendiente | Sale en `requires_reconciliation` > 1h | Email + dashboard |
| Certificado vencimiento | 30/15/7 días | Email + banner persistente |
| Suspensión inminente | Día 7, 9, 10 de impago | Email + SMS + banner crítico |

### 13.6 Health checks

#### Endpoint `/health` (público, sin auth)

```json
{
  "status": "ok | degraded | down",
  "version": "1.0.0",
  "uptime_seconds": 12345,
  "timestamp": "2026-05-17T18:00:00Z"
}
```

#### Endpoint `/health/detailed` (auth requerida, solo admin Pandora)

```json
{
  "status": "ok | degraded | down",
  "services": {
    "database": {
      "status": "ok",
      "latency_ms": 12,
      "pool_used": 5,
      "pool_max": 20
    },
    "afip_homologation": {
      "status": "ok",
      "latency_ms": 1500,
      "last_check": "2026-05-17T17:59:30Z"
    },
    "mercadopago": {
      "status": "ok",
      "latency_ms": 250
    },
    "resend": {
      "status": "ok"
    },
    "twilio": {
      "status": "ok"
    },
    "supabase_storage": {
      "status": "ok"
    },
    "redis": {
      "status": "ok",
      "latency_ms": 3,
      "fase": "1+"
    }
  }
}
```

#### Tests sintéticos (Fase 1+)

🟢 **VERDE** — Recomendado activar en cuanto haya 10 clientes en producción.

Cada 30 minutos, un cron ejecuta:

1. **Login sintético:** usuario de prueba dedicado autenticándose.
2. **Lectura sintética:** consulta de productos del tenant de prueba.
3. **Venta sintética:** registro de venta en tenant aislado, validación, anulación inmediata.
4. **AFIP sintético:** factura de prueba contra homologación (no producción).

Si cualquier paso falla: alerta Critical inmediata. Permite detectar caídas antes que los clientes.

### 13.7 Tracing distribuido (OpenTelemetry, Fase 2+)

Fase 0-1: tracing implícito via `correlation_id` en logs. Suficiente para reconstruir flujos manualmente.

Fase 2+: OpenTelemetry tracing automático cuando:

- Hay más de 1 servicio (worker + app + edge functions).
- El número de operaciones por minuto excede capacidad de leer logs lineales.
- Aparecen problemas de latencia que requieren ver tiempos por componente.

#### Configuración Fase 2

- Traces enviados a Axiom, Honeycomb, o Grafana Tempo.
- Sampling: 100% de errores, 10% de operaciones normales.
- Spans obligatorios: HTTP request → Server Action → Service → Drizzle transaction → external API call.
- Atributos: `tenant_id`, `user_id`, `action`, `entity_id`.

### 13.8 Sentry — Errores y excepciones

#### Configuración obligatoria

```typescript
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1, // 10% en prod
  beforeSend(event) {
    // Sanitizar antes de enviar
    if (event.user) {
      delete event.user.password;
      delete event.user.token;
    }
    return event;
  },
});
```

#### Tags obligatorios

Cada error reportado a Sentry incluye:

```typescript
Sentry.withScope((scope) => {
  scope.setTag('tenant_id', companyId);
  scope.setTag('user_id', userId);
  scope.setTag('correlation_id', correlationId);
  scope.setTag('action', action);
  scope.setContext('request', {
    url: req.url,
    method: req.method,
    headers: sanitizedHeaders,
  });
  Sentry.captureException(error);
});
```

#### Issues groupings

- Errores agrupados por: `error.name` + `action` + `entity`.
- Esto evita que dos errores en distintos tenants pero mismo bug aparezcan como issues separados.

#### Release tracking

- Cada deploy crea un release con commit hash.
- Permite identificar "este bug apareció en release X" rápido.

### 13.9 Dashboards operativos

#### Dashboard 1: Operativo Pandora (interno)

Para vos como owner del proyecto. Visible 24/7. Métricas clave:

- AFIP success rate (gauge última hora)
- Ventas por hora (timeseries últimas 24h)
- Errores 5xx (timeseries)
- Tenants activos (último período)
- Latencia p95 endpoints críticos
- Dead letter queue size
- DB connection pool usage
- Cost meter (Supabase + Vercel + Railway estimado)

**Stack:** Axiom dashboard custom o Grafana Cloud free tier.

#### Dashboard 2: Operativo Comerciante (lado del cliente)

Lo ve cada comerciante en su panel. Solo de SU empresa:

- Ventas del día (en grande, comparativa ayer)
- Caja actual estado
- Stock crítico top 10
- Facturas pendientes (si hay)
- Notificaciones operativas

**Implementado nativo en Next.js con Server Components.** No usar herramienta externa.

#### Dashboard 3: Contador (Fase 1+)

Lo ve el contador. Multi-empresa:

- Lista de empresas vinculadas
- Resumen mensual por empresa (ventas, IVA débito/crédito, NCs)
- Botones de export por empresa
- Alertas de empresas que requieren atención (facturas pendientes, errores fiscales)

### 13.10 Audit log: motivo obligatorio

🟢 **VERDE** — Ya estaba parcialmente cubierto en v2.0-OMN sección 9.4. Lo formalizo acá con la lista completa.

#### Lista de acciones que requieren `audit_log.reason` no-null

| Acción | Motivo obligatorio | Quién puede hacerla |
|---|---|---|
| Anulación de venta < 24h | Sí | cashier (propia), admin (cualquiera) |
| Anulación de venta > 24h | Sí + autorización admin | admin, owner |
| Ajuste de stock manual | Sí | warehouse, admin, owner |
| Stock negativo (override) | Sí + autorización admin | admin, owner |
| Cambio de precio de producto | Sí | admin, owner |
| Edición de pago en venta | Sí | admin, owner |
| Cierre de caja con descuadre > 5% | Sí + autorización admin | admin, owner |
| Cierre forzado por cron 23:59 | Automático "force_closed_by_cron" | sistema |
| Nota de crédito (Fase 1+) | Sí | admin, owner |
| Nota de débito (Fase 2+) | Sí | admin, owner |
| Modificación de condición IVA del cliente | Sí | admin, owner |
| Cambios en configuración fiscal (PV, certificado) | Sí | owner |
| Suplantación de tenant por soporte Pandora | Sí + ticket de soporte ID | support (rol especial) |
| Cambio de plan de suscripción | Sí | owner |
| Eliminación lógica de empresa | Sí + delay 7 días | owner |
| Reactivación de empresa eliminada | Sí | owner (durante delay) |
| Cambio de rol de usuario | Sí | owner |
| Eliminación lógica de usuario | Sí | owner, admin |
| Exportación masiva de datos | Sí | owner, admin, accountant |
| Reset de password ajeno | Sí + verificación 2FA | owner |

#### Schema reforzado de audit_log

```sql
CREATE TABLE audit_log (
    id bigserial PRIMARY KEY,
    company_id uuid NOT NULL REFERENCES companies(id),
    user_id uuid REFERENCES profiles(id),
    user_role text NOT NULL,
    action text NOT NULL,
    entity text NOT NULL,
    entity_id uuid,
    changes jsonb NOT NULL,  -- { before: {...}, after: {...} }
    reason text,             -- NULL solo en operaciones de sistema
    metadata jsonb,          -- { ip, user_agent, correlation_id, terminal_id, branch_id, channel }
    occurred_at timestamptz NOT NULL DEFAULT now()
);

-- Constraints
ALTER TABLE audit_log ADD CONSTRAINT reason_required_for_destructive
    CHECK (
        action NOT IN (
            'sale.cancelled', 'stock.adjusted', 'cash_session.force_closed_with_difference',
            'credit_note.issued', 'customer.iva_condition_changed', 'fiscal_config.modified',
            'support.impersonation', 'plan.changed', 'company.deleted', 'user.role_changed'
        )
        OR reason IS NOT NULL
    );

-- Immutability
REVOKE UPDATE, DELETE ON audit_log FROM authenticated, service_role;
GRANT INSERT ON audit_log TO authenticated;
```

### 13.11 Retención y archivado

| Tipo de dato | Retención hot (consulta rápida) | Retención cold (archivado) | Total legal |
|---|---|---|---|
| Logs `info` | 30 días | — | 30 días |
| Logs `warn` | 90 días | — | 90 días |
| Logs `error` | 1 año | — | 1 año |
| Logs `fatal` | Indefinido | — | Indefinido |
| Métricas | 90 días detalle, 1 año agregado | — | 1 año |
| Sentry issues | 90 días (plan free) | — | 90 días |
| `audit_log` | 2 años hot | 8 años cold S3 | 10 años (Ley 11.683) |
| `idempotency_log` | 90 días | — | 90 días, después purga |
| `afip_invoices.xml` | 2 años hot | 8 años cold S3 | 10 años |
| `notifications` | 90 días | — | 90 días |
| `webhook_logs` | 30 días | — | 30 días (no es info fiscal) |

**Cron de archivado mensual:**

- Primer día del mes, 02:00 hora Argentina.
- Mueve `audit_log` y `afip_invoices.xml` mayores a 2 años a S3 Glacier.
- Mantiene índice consultable: `audit_log_archive_index` con metadata mínima.
- Si se necesita consultar archivado: query async (24-48h), no acceso directo.

### 13.12 Correlación end-to-end

Una venta toca: navegador → Server Action → Service → Drizzle tx → AFIP SOAP → email Resend → audit_log. Sin `correlation_id` consistente, debuggear un caso específico es ciencia ficción.

#### Generación

- En navegador: header `X-Correlation-ID: <uuid>` en cada request.
- Si el cliente no envía: el server genera uno y lo devuelve en response.
- Se propaga hacia abajo: Server Action → Service → External APIs (en headers).
- Se loggea en cada paso.

#### Endpoint para soporte

Endpoint admin: `GET /api/admin/trace/:correlation_id`

Devuelve cronología completa:

```json
{
  "correlation_id": "uuid",
  "tenant_id": "uuid",
  "user_id": "uuid",
  "timeline": [
    {"timestamp": "...", "service": "app", "action": "sale.create.started", ...},
    {"timestamp": "...", "service": "app", "action": "stock.locked", ...},
    {"timestamp": "...", "service": "app", "action": "invoice_sequence.reserved", ...},
    {"timestamp": "...", "service": "app", "action": "afip.request.sent", ...},
    {"timestamp": "...", "service": "app", "action": "afip.response.received", "cae": "...", ...},
    {"timestamp": "...", "service": "app", "action": "sale.completed", ...},
    {"timestamp": "...", "service": "worker", "action": "email.sent", ...}
  ],
  "duration_total_ms": 4521,
  "result": "success"
}
```

**Crítico para soporte:** cuando un cliente reporta "mi venta #1234 no se facturó", con un click en su `correlation_id` ves toda la historia.

### 13.13 Definition of Done — Observabilidad

Una feature está DONE en términos de observabilidad solo si:

- [ ] Emite logs estructurados con campos obligatorios.
- [ ] Si es operación crítica, emite métrica.
- [ ] Si toca integración externa, tiene timeout + retry + métrica de éxito/fallo.
- [ ] Sus errores van a Sentry con tags correctos.
- [ ] Aparece en al menos un dashboard si es relevante.
- [ ] Tiene alerta configurada si su fallo es crítico.
- [ ] El `correlation_id` se propaga end-to-end.
- [ ] Sin secrets en logs.

---

# PARTE 2 — MÁQUINAS DE ESTADO FALTANTES

🟢 **VERDE** — Todas son técnicas, sin implicancias legales/fiscales que requieran validación externa.

Convención:

- `[estado]` = estado del sistema
- `→` = transición permitida
- `(condition)` = precondición de la transición
- `// side effect` = comentario sobre efecto colateral
- **terminal** = estado del que no se sale

---

## SM-04 — Payment (Pago de una venta)

### Contexto

Un `Payment` representa un instrumento de pago aplicado a una `Sale`. Una venta puede tener N pagos (pagos mixtos: parte efectivo, parte tarjeta). Cada pago tiene su propio ciclo de vida.

### Estados

```
[pending] 
  ├── → [processing] (cuando se envía a procesador externo)
  ├── → [confirmed] (efectivo recibido, cheque conformado, transferencia validada)
  └── → [cancelled] (terminal — operador cancela antes de procesar)

[processing]
  ├── → [confirmed] (procesador externo confirma — webhook MP, conformación bancaria)
  ├── → [failed] (procesador rechaza)
  └── → [timeout] (no responde en N minutos según procesador)

[failed]
  └── → [pending] (operador reintenta — solo si la venta sigue abierta)

[timeout]
  ├── → [confirmed] (webhook tardío llega — reconciliación)
  ├── → [failed] (después de N horas sin webhook)
  └── → [reconciliation_pending] (queda para revisión manual)

[confirmed] (terminal salvo refund)
  └── → [refunded] (vía NC o anulación)

[refunded] (terminal)
[cancelled] (terminal)
```

### Tabla de transiciones

| Estado actual | Acción | Estado destino | Precondiciones | Side effects |
|---|---|---|---|---|
| pending | confirm_cash | confirmed | Efectivo recibido | cash_movement insert |
| pending | send_to_processor | processing | Tarjeta/MP/transferencia | API call externa |
| pending | cancel | cancelled | Sale aún en draft/pending_payment | Sin efecto en otras tablas |
| processing | webhook_success | confirmed | Webhook con firma válida | sale_payment.confirmed_at, cash_movement |
| processing | webhook_failure | failed | Webhook con error | sale_payment.failure_reason |
| processing | timeout_reached | timeout | N min sin webhook | reconciliation_job encolado |
| failed | retry | pending | Sale sigue abierta + permiso usuario | Sin efecto |
| timeout | webhook_delayed | confirmed | Webhook llega tardío | Misma lógica que confirm |
| timeout | timeout_final | failed | 24h sin webhook | Notificación al admin |
| timeout | escalate_manual | reconciliation_pending | Admin decide | Queue de revisión manual |
| confirmed | refund (vía NC o anulación) | refunded | NC emitida o anulación válida | cash_movement reverso |

### Timeouts por procesador

| Procesador | Timeout pending → timeout | Timeout final |
|---|---|---|
| MercadoPago QR | 5 minutos | 24 horas |
| Tarjeta presente (POSnet, terminal física) | N/A — sincrónico | N/A |
| Transferencia bancaria | 24 horas (validación manual del owner) | 7 días |
| Cheque | N/A — validación manual al recibir | N/A |
| Efectivo | N/A — instantáneo | N/A |

### Idempotencia

- Webhook MP llega múltiples veces → idempotencia por `external_reference + event_id`.
- Refunds via NC → idempotencia por `credit_note_id`.

### Auditoría

- Todo cambio de estado → `audit_log` con `entity = 'payment'`.
- `refunded` requiere motivo obligatorio.
- Pagos en `reconciliation_pending` aparecen en dashboard del admin para resolución manual.

---

## SM-05 — CashSession (Turno de caja, versión completa)

### Contexto

El v2.0-OMN tenía estados simplificados (`open → closed`). Esta versión incluye los estados intermedios reales que se necesitan para operación robusta.

### Estados

```
[closed] (terminal de cierre)
  └── → [opening] (admin/cashier inicia apertura)

[opening] (estado transitorio breve)
  ├── → [open] (apertura completada, monto inicial registrado)
  └── → [closed] (cancelar apertura, no hay turno)

[open]
  ├── → [closing] (cashier inicia cierre)
  ├── → [force_closing] (cron 23:59 o admin)
  └── (no hay salida directa a closed sin pasar por closing)

[closing] (estado transitorio: cajero contando efectivo)
  ├── → [closed] (arqueo cuadra dentro de tolerancia)
  ├── → [closed_with_difference] (diferencia > tolerancia, motivo registrado)
  └── → [open] (cashier cancela cierre y sigue operando)

[force_closing] (cron forzando cierre)
  └── → [force_closed] (cierre automático sin arqueo del cajero)

[closed] (terminal pero permite reapertura del próximo turno)
[closed_with_difference] (terminal — descuadre auditado)
[force_closed] (terminal — requiere reconciliación posterior)
```

### Tabla de transiciones

| Estado actual | Acción | Estado destino | Precondiciones | Side effects |
|---|---|---|---|---|
| closed | open_session | opening | No hay turno abierto en la caja | Lock UNIQUE (cash_register_id, status='open') |
| opening | confirm_open | open | Monto inicial registrado | cash_session.initial_amount, cash_movement initial |
| opening | cancel_opening | closed | Cashier abandona | Sin efecto |
| open | initiate_close | closing | No hay ventas pending_payment | Bloquear nuevas ventas en esta caja |
| open | force_close | force_closing | Cron 23:59 OR admin manual | Notificar cashier |
| closing | submit_count | closed | Diferencia <= tolerancia | cash_session.final_amount, generar reporte PDF |
| closing | submit_count_difference | closed_with_difference | Diferencia > tolerancia + motivo | Mismo + audit_log con reason |
| closing | cancel_close | open | Cashier decide seguir operando | Desbloquear ventas |
| force_closing | complete_force | force_closed | Sistema completa cierre sin cashier | Marcar como pending_reconciliation |
| closed | next_session | opening | Nuevo turno se abre | Nueva fila en cash_sessions |

### Tolerancia configurable

- Por defecto: 1% del total declarado.
- Tenant puede configurar en `company_settings.cash_difference_tolerance_percent`.
- Diferencia > 5%: requiere autorización admin para cerrar.
- Diferencia > 10%: bloquea cierre, requiere autorización owner.

### Cron de cierre forzado

```
Trigger: 23:59 hora local del tenant
Condición: cash_session.status = 'open' AND opened_at < now() - interval '2 hours'
Acción: 
  1. Marcar como force_closing
  2. Notificar cashier por email/SMS
  3. Esperar 1 hora para que cashier responda
  4. Si no responde: completar a force_closed
  5. Generar reporte automático con monto final = monto esperado calculado (sin arqueo real)
  6. Audit log con reason='force_closed_by_cron_inactivity'
```

### Casos especiales

🔴 **DECISIÓN PENDIENTE** — Comercios 24hs

Para kioscos que operan más allá de medianoche, el cron 23:59 cierra turnos activos. Opciones:

- **(a)** Mantener cron 23:59 universal (fuerza cierres operativos en medio de la noche).
- **(b)** Configurable por tenant: hora de cierre forzado.
- **(c)** Detección automática: si hay ventas en las últimas 2 horas, no forzar cierre.

Recomiendo **(b) + (c) combinados**: configurable + smart detection. Lo dejo marcado para que confirmes.

### Auditoría

- Apertura, cierre y descuadre: todos en `audit_log`.
- `closed_with_difference` y `force_closed` con motivo obligatorio.

---

## SM-06 — StockReservation

### Contexto

Reserva blanda de stock cuando un Order se confirma pero todavía no se cobró. En Fase 0, esto está latente (todos los pedidos son POS con conversión inmediata). En Fase 2+ se activa con omnicanal.

### Estados

```
[active] (reserva creada por Order confirmado)
  ├── → [converted] (Order convertido a Sale, reserva se convierte en deducción dura)
  ├── → [released] (Order cancelado o expirado, stock vuelve a disponible)
  └── → [expired] (TTL alcanzado sin conversión)

[converted] (terminal)
[released] (terminal)
[expired] (terminal)
```

### Tabla de transiciones

| Estado | Acción | Destino | Precondiciones | Side effects |
|---|---|---|---|---|
| active | convert_to_sale | converted | Sale.completed con order_id | stock_movement deducción dura, sale_item.reserved_stock_id |
| active | release_manual | released | Order.cancelled por usuario | stock_available += quantity |
| active | release_expired | expired | TTL alcanzado (cron) | stock_available += quantity, Order → expired |
| active | release_by_order_change | released | Order modificado a menor cantidad | Release parcial proporcional |

### TTL por canal

| Canal | TTL default | Configurable |
|---|---|---|
| POS (Fase 0) | 60 minutos | No (inmediato siempre) |
| Phone (Fase 2) | 24 horas | Sí, hasta 72h |
| WhatsApp (Fase 2) | 24 horas | Sí, hasta 72h |
| Web/Instagram (Fase 2) | 30 minutos | Sí, hasta 24h |
| Marketplace (Fase 3) | Según marketplace (típicamente 30 min) | No |

### Cron de cleanup

```
Trigger: cada 15 minutos
Query: SELECT * FROM stock_reservations 
       WHERE status = 'active' AND expires_at < now()
Acción para cada uno:
  1. UPDATE stock_reservations SET status='expired'
  2. UPDATE orders SET status='expired' (si Order todavía en confirmed)
  3. Notification al cliente si tiene email
  4. Notification al vendedor que armó pedido
  5. audit_log entry
```

### Edge cases

- **Producto eliminado mientras hay reserva:** la reserva expira normalmente, el producto sigue inactivo. Cuando vuelve a disponible: stock_available reflejará disponibilidad real.
- **Cambio de precio mientras hay reserva:** el Order mantiene el precio reservado (price_locked_at = reservation timestamp). La Sale resultante usa ese precio.
- **Stock físico insuficiente al convertir:** error explícito, Order pasa a `pending_review`, admin resuelve manualmente.

### Auditoría

- Creation, conversion y release: en `audit_log`.
- `release_expired` con reason automático "ttl_reached".

---

## SM-07 — WebhookEvent (Eventos webhook entrantes y salientes)

### Contexto

Aplica a webhooks inbound (MP confirma pago, AFIP no aplica acá porque es síncrono) y outbound (Pandora notifica a partners externos en Fase 3+).

### Estados (inbound)

```
[received] (webhook entró al sistema)
  ├── → [validating] (verificando firma HMAC, idempotencia)
  ├── → [rejected] (firma inválida, terminal)
  └── → [malformed] (payload inválido, terminal)

[validating]
  ├── → [processing] (firma OK, payload OK, encolado para procesar)
  └── → [duplicate] (ya procesado antes, terminal — idempotencia)

[processing]
  ├── → [completed] (procesado exitosamente)
  ├── → [failed] (error procesando, retry)
  └── → [dead_letter] (max retries alcanzado, terminal pero requiere intervención)

[failed]
  └── → [processing] (retry con backoff exponencial)

[completed] (terminal)
[dead_letter] (terminal)
[rejected] (terminal)
[malformed] (terminal)
[duplicate] (terminal)
```

### Estados (outbound, Fase 3+)

```
[queued] → [sending] → [delivered] | [failed] → [retrying] → [delivered] | [dead_letter]
```

### Tabla de transiciones (inbound)

| Estado | Acción | Destino | Precondiciones | Side effects |
|---|---|---|---|---|
| received | validate_signature | validating | — | Verificar HMAC |
| validating | sig_valid_payload_valid | processing | Firma OK, schema OK | Encolar job |
| validating | sig_invalid | rejected | Firma HMAC inválida | Log warn, no procesar |
| validating | payload_malformed | malformed | Schema inválido | Log error, alert |
| validating | duplicate_detected | duplicate | `external_event_id` ya procesado | Devolver 200 (idempotente) |
| processing | process_success | completed | Handler ejecutó OK | Side effects del handler |
| processing | process_error_retryable | failed | Error transient (network, etc.) | Schedule retry |
| processing | process_error_fatal | dead_letter | Error no retryable | Alert admin |
| failed | retry_backoff_reached | processing | N segundos pasaron (exponencial) | Reintentar |
| failed | max_retries_reached | dead_letter | Retries > 5 | Alert + manual review |

### Retry policy

```
Retry 1: después de 30s
Retry 2: después de 2 min
Retry 3: después de 10 min
Retry 4: después de 1 hora
Retry 5: después de 6 horas
Después: dead_letter
```

### Idempotencia

Tabla `webhook_events`:

```sql
UNIQUE (source, external_event_id)
```

- Source: 'mercadopago' | 'afip' | etc.
- external_event_id: el ID que envía el sistema externo.
- Si llega un webhook con mismo par, se marca como `duplicate` y devuelve 200 sin procesar.

### Dead letter handling

- Dashboard admin con queue de DLQ.
- Cada item con: payload, error message, intentos.
- Admin puede: reintentar manualmente, marcar como "ignorar", investigar.

### Auditoría

- Webhooks rechazados (firma inválida): log warn, no audit.
- Webhooks procesados exitosamente con efecto en negocio: audit_log.
- DLQ entries: alertas + dashboard.

---

## SM-08 — BackgroundJob

### Contexto

Jobs async procesados por worker. En Fase 0, los jobs corren en proceso Next.js (no hay worker dedicado). En Fase 1+, BullMQ sobre Upstash Redis con worker en Railway.

### Estados

```
[queued]
  └── → [running] (worker toma el job)

[running]
  ├── → [succeeded] (job termina sin error)
  ├── → [failed] (job lanza excepción)
  └── → [timeout] (job excede tiempo máximo)

[failed]
  ├── → [retrying] (retries < max)
  └── → [dead_letter] (retries >= max, terminal)

[retrying]
  └── → [running] (backoff timer expiró)

[timeout]
  └── → [dead_letter] (no se retry-ean timeouts, son síntoma de bug)

[succeeded] (terminal)
[dead_letter] (terminal)
```

### Tabla de transiciones

| Estado | Acción | Destino | Precondiciones | Side effects |
|---|---|---|---|---|
| queued | worker_pick | running | Worker disponible | Lock del job, started_at |
| running | success | succeeded | Job retorna sin throw | completed_at, result |
| running | error | failed | Job throws excepción | failed_at, error.stack |
| running | exceed_time | timeout | Job > max_duration | timeout_at |
| failed | schedule_retry | retrying | retries < max_retries | scheduled_retry_at |
| retrying | retry_time | running | Backoff alcanzado | Reincorporar a queue |
| failed | max_retries | dead_letter | retries == max | Alert |
| timeout | direct_to_dlq | dead_letter | — | Alert (timeouts no retry) |

### Tipos de jobs Fase 0

| Job | Trigger | Frecuencia | Max retries |
|---|---|---|---|
| `afip-reconciliation` | Venta en `requires_reconciliation` | Cron 5 min | 5 |
| `email-send` | Operación de negocio | Inmediato | 3 |
| `cron-cash-session-force-close` | 23:59 horario tenant | Diario | 1 |
| `cron-certificate-expiry-check` | Diario 09:00 | Diario | 1 |
| `cron-trial-extension-reminder` | Diario 10:00 | Diario | 1 |
| `cron-subscription-suspension` | Diario 03:00 | Diario | 1 |
| `cron-stock-reservation-cleanup` (Fase 2) | Cada 15 min | Continuo | 2 |
| `cron-idempotency-cleanup` | Mensual día 1 | Mensual | 1 |
| `cron-audit-log-archive` | Mensual día 1 | Mensual | 1 |

### Prioridades

- **Crítica:** afip-reconciliation (cliente espera factura), email-send transaccionales.
- **Normal:** crons operativos diarios.
- **Baja:** archivado, cleanup, reportes.

BullMQ (Fase 1+) soporta prioridades nativamente. En Fase 0 con jobs en proceso, ejecutar críticos primero.

### Idempotencia

- Cada job tiene `idempotency_key` (UUID generado al encolar).
- Si el worker crashea mientras procesa, el job vuelve a queue y se reintenta.
- Los handlers deben ser idempotentes: ejecutar el mismo job 2 veces no debe duplicar efectos.

### Dead letter handling

- DLQ visible en dashboard admin.
- Alert si DLQ tiene > 5 items.
- Cada item con payload, error, intentos, posibilidad de reintentar manual.

### Auditoría

- Jobs críticos (afip-reconciliation, subscription-suspension) generan audit_log al completar.
- Jobs operativos rutinarios solo loggean, no auditan.

---

## SM-09 — ImportJob

### Contexto

Importación masiva de productos, clientes, proveedores desde CSV/Excel. Operación compleja con preview obligatorio antes de aplicar.

### Estados

```
[uploaded] (archivo subido)
  └── → [parsing] (sistema lee archivo)

[parsing]
  ├── → [validating] (parsing OK)
  └── → [parse_error] (terminal — archivo corrupto)

[validating]
  ├── → [previewed] (validación OK, esperando confirmación del usuario)
  └── → [validation_error] (terminal — errores que requieren CSV corregido)

[previewed]
  ├── → [applying] (usuario confirma apply)
  ├── → [cancelled] (terminal — usuario descarta preview)
  └── → [expired] (terminal — preview expira a las 24h)

[applying]
  ├── → [applied] (terminal — todas las filas procesadas)
  ├── → [partial_applied] (terminal — algunas filas fallaron, requiere revisión)
  └── → [rolled_back] (terminal — error masivo, rollback completo)

[applied] (terminal)
[partial_applied] (terminal — requiere revisión humana)
[rolled_back] (terminal)
[parse_error] (terminal)
[validation_error] (terminal)
[cancelled] (terminal)
[expired] (terminal)
```

### Tabla de transiciones

| Estado | Acción | Destino | Precondiciones | Side effects |
|---|---|---|---|---|
| uploaded | start_parse | parsing | Archivo en Storage | Worker job parse-import |
| parsing | parse_success | validating | CSV bien formado | Filas en memoria |
| parsing | parse_error | parse_error | Encoding/formato malo | Error visible al usuario |
| validating | validate_success | previewed | Validaciones row-by-row OK | preview_token con TTL 24h |
| validating | validate_errors | validation_error | Errores que no se pueden auto-corregir | CSV de errores descargable |
| previewed | confirm_apply | applying | Usuario click "Aplicar" | Worker job apply-import |
| previewed | user_cancel | cancelled | Usuario click "Cancelar" | Borrar preview de memoria |
| previewed | ttl_expired | expired | 24h sin confirmar | Borrar preview |
| applying | all_rows_ok | applied | 100% filas procesadas | Productos/clientes creados |
| applying | partial_rows | partial_applied | Algunas filas fallaron | Reporte de errores |
| applying | critical_error | rolled_back | Error transversal | UNDO de todo lo aplicado |

### Rollback

Para `rolled_back`:

- Cada fila exitosa generó INSERT.
- Rollback emite DELETE de todos los INSERT con `import_id` matching.
- Stock movements de tipo "initial" creados por el import también se eliminan.
- Audit log marca rollback con reason.

Para `partial_applied`:

- Las filas exitosas quedan.
- Las filas fallidas listadas en reporte descargable.
- Usuario puede corregir CSV y volver a importar solo las fallidas.

### Validaciones obligatorias

Por tipo de import:

**Productos:**
- SKU único (no existe ya en empresa).
- Barcode único si presente.
- Precio > 0.
- IVA rate válido (alícuota AFIP).
- Categoría existente o auto-crear.

**Clientes:**
- CUIT formato válido si presente.
- Email formato válido si presente.
- Deduplicación por (documento_type, documento_number).

**Proveedores (Fase 1):**
- CUIT obligatorio y validado contra padrón.

### Idempotencia

- Cada import tiene `import_id` UUID.
- Re-importar el mismo CSV no duplica (UNIQUE constraint en `(company_id, file_hash)` para detectar repetidos).

### Auditoría

- Cada import: audit_log con `entity='import'`, antes/después de la empresa (cantidad de productos antes/después).
- Aplicación masiva: una entrada agregada, no una por fila.
- Rollback: entrada explícita con motivo.

---

## SM-10 — ExportJob

### Contexto

Exportación masiva de datos: ventas (CSV para contador), libros IVA (Fase 1+), backups completos del tenant, etc.

### Estados

```
[queued]
  └── → [generating]

[generating]
  ├── → [ready] (archivo generado, descarga disponible)
  └── → [generation_error] (terminal)

[ready]
  ├── → [downloaded] (usuario descargó al menos una vez)
  ├── → [expired] (terminal — TTL alcanzado sin descarga)
  └── → [revoked] (terminal — admin revoca por seguridad)

[downloaded]
  └── → [expired] (terminal — TTL alcanzado)

[expired] (terminal)
[revoked] (terminal)
[generation_error] (terminal)
```

### Tabla de transiciones

| Estado | Acción | Destino | Precondiciones | Side effects |
|---|---|---|---|---|
| queued | start_generation | generating | Worker disponible | Job export en cola |
| generating | success | ready | Archivo generado en Storage | URL pre-signed con TTL |
| generating | error | generation_error | Excepción al generar | Notificar usuario |
| ready | user_download | downloaded | Usuario descarga | Marcar timestamp first_download |
| ready | ttl_expired | expired | TTL alcanzado sin descarga | Borrar archivo de Storage |
| ready | admin_revoke | revoked | Owner/admin revoca | Borrar archivo, notificar |
| downloaded | ttl_expired | expired | TTL alcanzado | Borrar archivo de Storage |

### TTL por tipo de export

| Tipo de export | TTL ready/downloaded |
|---|---|
| Export CSV de ventas | 7 días |
| Libro IVA mensual (Fase 1) | 30 días |
| Backup completo del tenant | 24 horas (urgente, no se guarda mucho) |
| Datos personales (derecho al olvido) | 7 días, 1 sola descarga |

### Seguridad

- URLs de descarga son pre-signed (Supabase Storage signed URLs).
- TTL configurado en la URL, no solo en DB.
- Acceso solo para el usuario que solicitó (verificación de tenant + user).
- Audit log de descarga: quién, cuándo, qué archivo, IP.

### Privacidad

- Exports de datos personales requieren autorización explícita del owner.
- Logs no contienen el contenido del export, solo metadata.
- Backups completos del tenant solo para owner/admin con 2FA si está activado.

### Auditoría

- Generación: audit_log con `entity='export'` y tipo.
- Descarga: audit_log con timestamp e IP.
- Revocación: audit_log con motivo.

---

## SM-11 — Integration (Configuración de integración externa)

### Contexto

Cada conexión a un servicio externo (AFIP, MercadoPago, WhatsApp, Twilio) tiene un ciclo de vida de configuración.

### Estados

```
[unconfigured] (default — integración disponible pero no configurada)
  └── → [configuring] (owner inicia setup)

[configuring]
  ├── → [pending_validation] (datos cargados, validando con servicio externo)
  └── → [unconfigured] (owner cancela)

[pending_validation]
  ├── → [active] (validación exitosa)
  ├── → [validation_failed] (credenciales inválidas, sintaxis mala)
  └── → [unconfigured] (owner abandona setup)

[validation_failed]
  ├── → [configuring] (owner corrige datos)
  └── → [unconfigured] (owner abandona)

[active]
  ├── → [paused] (owner pausa temporalmente)
  ├── → [degraded] (servicio externo intermitente, alertas Sentry)
  ├── → [expired] (credenciales expiradas — caso AFIP cert vencido)
  └── → [revoked] (owner revoca acceso)

[paused]
  ├── → [active] (owner reactiva)
  └── → [revoked] (owner revoca definitivamente)

[degraded]
  ├── → [active] (servicio externo se normaliza)
  └── → [expired] (problema persiste)

[expired]
  ├── → [configuring] (owner renueva credenciales)
  └── → [revoked] (owner abandona)

[revoked] (terminal)
```

### Tabla de transiciones por integración

#### AFIP

| Estado | Acción | Destino | Precondiciones |
|---|---|---|---|
| unconfigured | start_setup | configuring | Owner inicia wizard AFIP |
| configuring | upload_cert | pending_validation | Cert X.509 + private key cargados |
| pending_validation | wsaa_test_success | active | WSAA devuelve token válido |
| pending_validation | wsaa_test_failure | validation_failed | WSAA rechaza |
| active | cert_expiring_soon | active (alert) | < 30 días vencimiento |
| active | cert_expired | expired | Cert vencido, no permite WSAA |
| expired | owner_renews | configuring | Owner sube cert nuevo |

#### MercadoPago

| Estado | Acción | Destino | Precondiciones |
|---|---|---|---|
| unconfigured | start_setup | configuring | Owner inicia setup |
| configuring | enter_credentials | pending_validation | Access token + webhook secret |
| pending_validation | api_test_success | active | Consulta dummy a MP API OK |
| active | webhook_failures_high | degraded | > 10% webhooks fallan |
| degraded | webhook_success_resume | active | < 5% fallas por 1h |

#### WhatsApp Business Cloud API

| Estado | Acción | Destino | Precondiciones |
|---|---|---|---|
| unconfigured | start_setup | configuring | Owner inicia setup |
| configuring | enter_business_id | pending_validation | Business Manager ID + token |
| pending_validation | templates_approved | active | Meta aprueba al menos 1 template |
| pending_validation | templates_pending | pending_validation (loop) | Esperando Meta 24-72h |
| active | templates_rejected_by_meta | degraded | Meta rechazó templates en uso |

### Auditoría

- Toda transición: audit_log con `entity='integration'`, action específica.
- Cambios de credenciales: audit_log + alerta a owner del tenant.
- Revocación: audit_log con reason obligatorio.

---

## SM-12 — OfflineSync (Fase 2+, planificación)

🟡 **AMARILLO** — Esta máquina se implementa en Fase 2. La defino acá para que la arquitectura esté preparada desde Fase 0.

### Contexto

Operaciones realizadas offline en POS (Fase 2+). Cada operación local genera un evento en queue local (IndexedDB) que se sincroniza al volver internet.

### Estados (por operación local)

```
[pending] (operación creada offline, en queue local)
  └── → [syncing] (conexión disponible, se envía al servidor)

[syncing]
  ├── → [synced] (servidor acepta, terminal)
  ├── → [conflict] (servidor detecta conflicto — stock, etc.)
  └── → [rejected] (servidor rechaza — validación falla)

[conflict]
  ├── → [resolved_user] (usuario decide resolución)
  └── → [resolved_auto] (regla automática aplicada)

[resolved_user] → [synced] (terminal)
[resolved_auto] → [synced] (terminal)
[rejected] (terminal — requiere acción manual)
[synced] (terminal)
```

### Estrategia de resolución de conflictos

| Tipo de conflicto | Política |
|---|---|
| Stock insuficiente | Servidor gana. Mostrar al usuario, ofrecer modificar venta o cancelar. |
| Cliente eliminado en servidor | Reasignar a "consumidor final" automáticamente. |
| Producto eliminado en servidor | Bloquear sync, marcar para revisión manual. |
| Precio cambió en servidor | Mantener precio local (lock al momento de venta). Notificar al admin. |
| Caja cerrada en servidor mientras se vendía offline | Ventas pasan a caja del próximo turno. Auditar. |
| Idempotencia: mismo ID local enviado dos veces | Ignorar duplicado, devolver resultado original. |

### Idempotencia

- Cada operación local tiene `client_id` UUID generado offline.
- Server detecta duplicados por `(tenant_id, client_id)`.
- Re-sync de la misma operación: devuelve resultado anterior.

### Auditoría

- Operación creada offline: registrar en evento local con timestamp.
- Sync: audit_log con `metadata.synced_from_offline = true` y `client_id` original.
- Conflicto: audit_log con tipo de conflicto y resolución.

### Detección de conexión

```
Estrategias:
1. Ping al servidor cada 30s con timeout 5s.
2. Browser online/offline events.
3. Failed request detection (cualquier fetch que falla por timeout = offline).

Estados de conexión:
- online: pings exitosos
- degraded: pings lentos (> 2s) o intermitentes
- offline: 3 pings fallidos consecutivos
```

### UI offline

- Banner amarillo persistente: "Sin conexión. Operaciones se sincronizarán automáticamente."
- Contador de operaciones pendientes visible.
- Listado de operaciones pendientes en panel.
- Cuando vuelve conexión: banner verde "Sincronizando X operaciones...".

---

# CIERRE DE SESIÓN 2

## Resumen de lo entregado

**Parte 1 — Sección 13 Observabilidad operativa completa:**

13 subsecciones cubriendo filosofía, logs estructurados, métricas por fase, alertas con destinos, health checks, tracing, Sentry, dashboards, audit log expandido, retención y archivado, correlación end-to-end, y Definition of Done.

**Parte 2 — 9 máquinas de estado faltantes:**

- SM-04: Payment con timeouts por procesador
- SM-05: CashSession completa con estados intermedios
- SM-06: StockReservation con TTL por canal
- SM-07: WebhookEvent inbound/outbound con DLQ
- SM-08: BackgroundJob con prioridades y retry policy
- SM-09: ImportJob con preview y rollback
- SM-10: ExportJob con TTL y privacidad
- SM-11: Integration con flujos específicos por proveedor
- SM-12: OfflineSync (Fase 2, definida para preparar arquitectura)

## Decisiones pendientes nuevas 🔴 ROJO

1. **Cron de cierre forzado 23:59 para comercios 24hs.** Te propuse: configurable por tenant + smart detection (no forzar si hay ventas en últimas 2h). Confirmá o ajustá.

## Lo que falta para SRS v3.0 final

- **Sesión 3:** 10 ADRs formales como archivos .md + Resolución de 8 ambigüedades originales (las del Hallazgo de auditoría) + Sección "Dominios del Sistema" expandida con eventos/workflows.
- **Sesión 4:** Integración completa en SRS v3.0 unificado.

## Validación humana pendiente recordatorio

⚠️ Cuando consigas contador advisor, validá específicamente:
- Política de "venta válida sin factura tras 2h" (sección 13 audit_log)
- Esquema de retención de XML AFIP 10 años (sección 13.11)
- Motivos obligatorios fiscales (sección 13.10)

⚠️ Cuando consigas abogado, validá:
- Política de delete company con 7 días delay
- Privacidad de exports de datos personales (SM-10)
- Compliance con Ley 25.326 sobre datos en logs

---

*Fin de SRS Sesión 2 — 17 mayo 2026*
