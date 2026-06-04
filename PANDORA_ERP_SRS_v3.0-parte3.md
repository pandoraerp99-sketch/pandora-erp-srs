# 13. Observabilidad operativa

🟢 **VERDE** — Sin esto, operás ciego.

## 13.1 Filosofía

**Sin trazabilidad no se mergea.** Toda operación crítica debe poder reconstruirse desde logs, métricas y traces sin necesidad de acceder a la DB de producción.

**Tres pilares operativos:**

1. **Logs estructurados** (Pino) — qué pasó, en qué orden, con qué contexto.
2. **Métricas** (Vercel Analytics + custom) — cuánto, qué tan rápido, qué tan seguido.
3. **Traces** (OpenTelemetry desde Fase 2) — flujo completo de una request end-to-end.

**Reglas no negociables:**

- Toda operación crítica emite log + métrica.
- Todo error 5xx genera entrada en Sentry con `tenant_id` + `correlation_id`.
- Toda llamada a integración externa (AFIP, MP, Resend, Twilio) tiene timeout, retry y métrica.
- Ningún log contiene secrets (certificados, tokens, passwords, números completos de tarjeta).
- El comerciante puede ver sus propios eventos críticos vía dashboard.
- El soporte Pandora puede ver eventos cross-tenant solo con auditoría obligatoria.

## 13.2 Logs estructurados (Pino)

**Schema obligatorio:**

```json
{
  "timestamp": "ISO8601 UTC con ms",
  "level": "trace|debug|info|warn|error|fatal",
  "service": "pandora-app|pandora-worker|pandora-cron",
  "environment": "development|staging|production",
  "tenant_id": "uuid o null si pre-auth",
  "user_id": "uuid o null si sistema",
  "user_role": "owner|admin|cashier|... o null",
  "correlation_id": "uuid generado al inicio de request",
  "request_id": "uuid del HTTP request si aplica",
  "action": "dominio.accion (sale.created, stock.adjusted)",
  "entity": "recurso afectado",
  "entity_id": "uuid del registro principal",
  "duration_ms": "number — solo en logs de finalización",
  "metadata": {
    "ip": "...",
    "user_agent": "...",
    "terminal_id": "...",
    "branch_id": "...",
    "channel": "pos|web|whatsapp|api"
  },
  "message": "string legible",
  "error": {
    "name": "...",
    "message": "...",
    "stack": "..."
  }
}
```

**Sanitización obligatoria:**

- Passwords: nunca aparecen.
- Certificados AFIP: solo `cert_id` y `expires_at`.
- Tokens: solo prefijos (`"abc1...xyz9"`).
- CUITs/DNIs: solo en operaciones que lo requieran. En logs generales: hash o omit.
- Direcciones y teléfonos: solo en operaciones específicas.

**Validación en CI:**

```typescript
// Test automático que falla el build si:
- console.log en código (debe ser logger.info)
- Strings que matchean patterns de tarjeta de crédito
- Strings que matchean CUIT completo
- Strings que matchean password
- Logs sin tenant_id en operaciones de negocio
```

## 13.3 Stack tecnológico de logs

| Capa | Tool | Fase |
|---|---|---|
| Generación | Pino | F0 |
| Dev local | pino-pretty | F0 |
| Agregación cloud F0 | Vercel logs nativos | F0 |
| Agregación extendida | Axiom o Better Stack | F1 (cuando duela) |
| Búsqueda y dashboards | Mismo proveedor | F1 |

**Decisión:** empezar con Vercel logs nativos. Migrar a Axiom cuando: (a) retención 7 días insuficiente, (b) > 50 clientes con volumen incómodo.

## 13.4 Métricas de negocio Fase 0

| Métrica | Tipo | SLO | Alerta si |
|---|---|---|---|
| `afip_cae_success_rate` | Gauge % | > 95% | < 90% por 15 min |
| `afip_request_latency_p99` | Histogram ms | < 8000 | > 25000 |
| `afip_timeout_count` | Counter | < 5/h | > 20/h |
| `sale_creation_duration_p95` | Histogram ms | < 2000 | > 5000 |
| `sale_creation_failure_rate` | Gauge % | < 1% | > 5% |
| `stock_negative_events` | Counter | 0 si bloqueado | > 0 cuando bloqueado |
| `cash_session_difference_rate` | Gauge % | < 5% | > 15% |
| `cash_session_force_closed_rate` | Gauge % | < 3% | > 10% |
| `mp_webhook_lag_p99` | Histogram s | < 30 | > 120 |
| `mp_webhook_failure_rate` | Gauge % | < 2% | > 10% |
| `email_bounce_rate` | Gauge % | < 5% | > 10% |
| `idempotency_replay_rate` | Counter | < 50/h | > 500/h |
| `serialization_retry_succeeded_rate` | Gauge % | < 5% | > 10% warning |
| `serialization_retry_exhausted_rate` | Gauge % | < 0.1% | > 1% critical |
| `cross_tenant_attempt_blocked` | Counter | 0 | > 0 → freezar tenant |
| `padron_revalidation_timeout_rate` | Gauge % | < 5% | > 10% |

## 13.5 Métricas Fase 1+

| Métrica | Fase | Notas |
|---|---|---|
| `queue_depth_by_priority` | F1 | BullMQ jobs por prioridad |
| `queue_processing_time_p95` | F1 | Tiempo encolado → completado |
| `dead_letter_queue_size` | F1 | Alerta si > 10 |
| `job_retry_rate` | F1 | % jobs con retry |
| `whatsapp_template_approval_rate` | F1 | % aceptación Meta |
| `accountant_dashboard_load_p95` | F1 | Dashboard con N empresas |
| `customer_retention_rate_monthly` | F1 | Churn mensual |
| `tenant_active_dau` | F1 | Daily Active Users |
| `api_rate_limit_hits` | F2 | Cuando haya API pública |
| `tenant_resource_consumption_p95` | F2 | Quotas |

## 13.6 Alertas con destinos

**Tres niveles:**

| Nivel | Destino | Respuesta esperada | Ejemplo |
|---|---|---|---|
| **Info** | Slack `#pandora-ops` o email diario | Revisión diaria | "Reporte: 234 ventas, 99.2% CAE" |
| **Warning** | Slack `#pandora-alerts` | 4 horas | "AFIP success bajó a 92%" |
| **Critical** | Slack + email + SMS al owner Pandora | < 30 min | "DB pool exhausted" |

**No usar PagerDuty en Fase 0** — overkill para 1 dev. Slack + SMS alcanzan.

**Alertas obligatorias F0:**

| Alerta | Trigger | Nivel |
|---|---|---|
| AFIP success rate baja | < 90% por 15 min | Critical |
| AFIP timeout masivo | > 20/h | Critical |
| 5xx elevados | > 5/min por 5 min | Critical |
| DB connection issues | Errores en logs | Critical |
| Certificado AFIP por vencer | 30/15/7/3/1 días | Warning → Critical |
| Cross-tenant leak detectado | Cualquier evento | Critical + freezar |
| Tasa de descuadre alta | > 15% global | Warning |
| Queue lag alta | > 30 min sin procesar | Warning |
| Webhook MP fallando | > 10% | Warning |
| DLQ creciendo | > 10 items | Warning |
| Serialization retry exhausted | > 1% en 15 min | Critical |
| Padron revalidation timeouts | > 10% | Warning |

**Alertas por tenant (al comerciante):**

| Alerta | Trigger | Canal |
|---|---|---|
| Caja con descuadre | Cierre > tolerancia | Email + dashboard |
| Stock crítico | Producto bajo mínimo | Email diario consolidado |
| Factura pendiente | `requires_reconciliation` > 1h | Email + dashboard |
| Certificado vence | 30/15/7 días | Email + banner persistente |
| Suspensión inminente | Día 7, 9, 10 impago | Email + SMS + banner crítico |

## 13.7 Health checks

**Endpoint `/health` (público, sin auth):**

```json
{
  "status": "ok|degraded|down",
  "version": "1.0.0",
  "uptime_seconds": 12345,
  "timestamp": "..."
}
```

**Endpoint `/health/detailed` (auth admin Pandora):**

```json
{
  "status": "ok",
  "services": {
    "database": { "status": "ok", "latency_ms": 12, "pool_used": 5, "pool_max": 20 },
    "afip_homologation": { "status": "ok", "latency_ms": 1500 },
    "mercadopago": { "status": "ok", "latency_ms": 250 },
    "resend": { "status": "ok" },
    "twilio": { "status": "ok" },
    "supabase_storage": { "status": "ok" }
  }
}
```

**Tests sintéticos (F1+):**

Cada 30 min, cron ejecuta:
1. Login sintético con usuario de prueba.
2. Lectura de productos del tenant de prueba.
3. Venta sintética en tenant aislado + anulación inmediata.
4. AFIP sintético contra homologación (no producción).

Si falla cualquier paso: alerta Critical inmediata.

## 13.8 Tracing distribuido

🟢 **VERDE** F0 (correlation_id en logs) + F2+ (OpenTelemetry).

**F0-1:** tracing implícito via `correlation_id`. Suficiente para reconstruir flujos manualmente.

**F2+:** OpenTelemetry cuando:
- Hay > 1 servicio (worker + app + edge).
- Volumen excede capacidad de leer logs lineales.
- Aparecen problemas de latencia que requieren ver tiempos por componente.

**Configuración F2:**
- Traces a Axiom, Honeycomb, o Grafana Tempo.
- Sampling: 100% errores, 10% normales.
- Spans obligatorios: HTTP → Server Action → Service → Drizzle tx → external API.
- Atributos: `tenant_id`, `user_id`, `action`, `entity_id`.

## 13.9 Sentry — errores y excepciones

**Configuración:**

```typescript
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
  beforeSend(event) {
    if (event.user) {
      delete event.user.password;
      delete event.user.token;
    }
    return event;
  },
});
```

**Tags obligatorios:**

```typescript
Sentry.withScope((scope) => {
  scope.setTag('tenant_id', companyId);
  scope.setTag('user_id', userId);
  scope.setTag('correlation_id', correlationId);
  scope.setTag('action', action);
  scope.setContext('request', { ... });
  Sentry.captureException(error);
});
```

**Groupings:** errores agrupados por `error.name + action + entity`. Evita issues duplicados de mismo bug en distintos tenants.

**Release tracking:** cada deploy crea release con commit hash.

## 13.10 Audit log — write-only server-side

🟢 **VERDE** — Crítico (Sesión 3.5 + 3.5.2).

**Reglas:**

- Cliente NUNCA escribe directamente. Tabla rechaza INSERT desde `authenticated`.
- Toda escritura usa `service_role` desde backend.
- Función única `AuditService.log()` valida tenant + user + action + reason antes de persistir.
- Si validación falla → throw → operación de negocio rollback.

**Schema:**

```sql
CREATE TABLE audit_log (
    id bigserial PRIMARY KEY,
    company_id uuid NOT NULL REFERENCES companies(id),
    user_id uuid REFERENCES profiles(id),
    user_role text NOT NULL,
    action text NOT NULL,
    entity text NOT NULL,
    entity_id uuid,
    changes jsonb NOT NULL,
    reason text,
    metadata jsonb,
    occurred_at timestamptz NOT NULL DEFAULT now()
);

REVOKE ALL ON audit_log FROM authenticated;
REVOKE UPDATE, DELETE, TRUNCATE ON audit_log FROM service_role;
GRANT INSERT ON audit_log TO service_role;

ALTER TABLE audit_log ADD CONSTRAINT reason_required_for_destructive
CHECK (
  action NOT IN (
    'sale.cancelled', 'sale.refunded', 'stock.negative_override',
    'cash_session.closed_with_difference', 'cash_session.force_closing_reverted',
    'customer.deleted', 'customer.iva_condition_changed',
    'product.deleted', 'product.price_changed',
    'user.role_changed', 'user.deactivated', 'accountant.revoked',
    'company.deleted', 'company.iva_condition_changed',
    'subscription.suspended', 'fiscal_config.modified',
    'support.impersonation_started', 'import.rolled_back'
  ) OR reason IS NOT NULL
);
```

**AuditService.log() recibe la transacción:**

```typescript
interface AuditLogParams {
  tx: TransactionContext;  // OBLIGATORIO
  companyId: string;
  userId: string | null;
  userRole: string;
  action: AuditableAction;
  entity: string;
  entityId: string | null;
  changes: { before: any; after: any };
  reason?: string;
  metadata: AuditMetadata;
}

export class AuditService {
  async log(params: AuditLogParams): Promise<void> {
    // Validaciones (tenant, user, action whitelist, reason si aplica)
    // ...
    
    // Insertar EN LA MISMA transacción que el negocio
    await params.tx.insert(auditLog).values({...});
    
    // Si esto falla, throw propaga, transacción rollback completa
  }
}
```

**Regla absoluta:** toda mutación crítica ejecuta audit DENTRO de la transacción.

## 13.11 Retención y archivado

| Tipo | Hot | Cold | Total legal |
|---|---|---|---|
| Logs `info` | 30 días | — | 30 días |
| Logs `warn` | 90 días | — | 90 días |
| Logs `error` | 1 año | — | 1 año |
| Logs `fatal` | Indefinido | — | Indefinido |
| Métricas detalle | 90 días | — | — |
| Métricas agregadas | 1 año | — | — |
| Sentry issues | 90 días (free) | — | — |
| `audit_log` | 2 años | 8 años S3 | 10 años (Ley 11.683) |
| `idempotency_log` | 90 días | índice 1 año | 6 meses garantía |
| `afip_invoices.xml` | 2 años | 8 años S3 | 10 años |
| `notifications` | 90 días | — | 90 días |
| `webhook_logs` | 30 días | — | 30 días |

**Cron de archivado mensual** día 1, 02:00 hora Argentina:
- Mueve audit_log y afip_invoices.xml > 2 años a S3 Glacier.
- Mantiene `audit_log_archive_index` consultable.
- Acceso archivado: async, 24-48h.

**Política de idempotency en borde de TTL** (Sesión 3.5):

```
1. Buscar en idempotency_log (hot, 90 días)
2. Si no encontrado: buscar en idempotency_log_archive_index
3. Si encontrado en archive: fetch resultado desde S3 (2-5s aceptable)
4. Si no: proceder operación nueva

Cutoff:
- < 6 meses: idempotente garantizada
- 6-12 meses: best-effort (lookup cold)
- > 12 meses: NO garantía. Cliente regenera key si > 6 meses sin completar.
```

## 13.12 Correlación end-to-end

Una venta toca: browser → Server Action → Service → Drizzle tx → AFIP SOAP → Resend → audit_log.

Sin `correlation_id` consistente, debugging es ciencia ficción.

**Generación:**
- Browser: header `X-Correlation-ID: <uuid>` en cada request.
- Si cliente no envía: server genera y devuelve en response.
- Propagación hacia abajo: Server Action → Service → External APIs.
- Loggeado en cada paso.

**Endpoint admin:**

`GET /api/admin/trace/:correlation_id` devuelve cronología completa:

```json
{
  "correlation_id": "uuid",
  "tenant_id": "uuid",
  "user_id": "uuid",
  "timeline": [
    { "timestamp": "...", "service": "app", "action": "sale.create.started" },
    { "timestamp": "...", "service": "app", "action": "stock.locked" },
    { "timestamp": "...", "service": "app", "action": "afip.request.sent" },
    { "timestamp": "...", "service": "app", "action": "afip.response.received", "cae": "..." },
    { "timestamp": "...", "service": "app", "action": "sale.completed" },
    { "timestamp": "...", "service": "worker", "action": "email.sent" }
  ],
  "duration_total_ms": 4521,
  "result": "success"
}
```

**Crítico para soporte:** cliente reporta "mi venta #1234 no se facturó", buscás `correlation_id`, ves toda la historia en una pantalla.

## 13.13 Definition of Done — Observabilidad

Una feature está DONE solo si:

- [ ] Emite logs estructurados con campos obligatorios
- [ ] Si crítica: emite métrica
- [ ] Si toca integración externa: timeout + retry + métrica
- [ ] Errores van a Sentry con tags correctos
- [ ] Aparece en al menos un dashboard si relevante
- [ ] Tiene alerta configurada si fallo es crítico
- [ ] `correlation_id` se propaga end-to-end
- [ ] Sin secrets en logs

---

# 14. UX operacional

🟢 **VERDE** — La diferencia entre POS que se usa y POS que se abandona.

## 14.1 Principios rectores

UX operacional, no decorativa. Optimizada para:

- **Cajeros cansados a las 21:00** que no quieren leer texto.
- **Comerciantes con manos ocupadas** (escanean + cobran + embolsan).
- **Adultos 40-60 años** no nativos digitales.
- **Tablets baratas** con pantallas táctiles imprecisas, CPUs lentas.
- **Conexión 4G fluctuante** en barrios alejados.

**Anti-principios:**
- No "moderno minimalista" con affordances ocultos.
- No animaciones > 200ms (genera percepción de lento).
- No tooltips para acciones críticas (no se leen en operación rápida).
- No menús anidados > 2 niveles.
- No modales sobre modales.
- No infinite scroll en operativas (siempre paginación clara).

## 14.2 Latencia máxima por operación

| Operación | SLO p95 | Inaceptable | Acción |
|---|---|---|---|
| Login → dashboard | < 800ms | > 2s | Alerta Sentry |
| Escaneo producto → carrito | < 200ms | > 500ms | Crítico, optimizar cache |
| Búsqueda fuzzy | < 300ms | > 800ms | Migrar a Meilisearch F2 |
| Confirmar venta sin facturar | < 500ms | > 1.5s | Revisar Drizzle tx |
| Confirmar venta + AFIP | < 8s p95 | > 25s | Timeout y fallback |
| Generar PDF ticket | < 1s | > 3s | Revisar template |
| Imprimir PDF browser | < 2s | > 5s | UX "Procesando impresión" |
| Cierre de turno con arqueo | < 1.5s | > 4s | Optimizar query |
| Listado de ventas día | < 700ms | > 2s | Índice |
| Carga catálogo 1.000 productos | < 2s | > 5s | Server Component stream |
| Importación CSV 5.000 productos | < 15s validar + 30s aplicar | > 60s | Procesar chunks 500 |

**Medición:** logs Pino con `duration_ms` + métricas con histograma p50/p95/p99.

## 14.3 Keyboard-first POS

El POS está optimizado para teclado físico. Mouse y touch son secundarios. **Cajero opera 90% sin levantar manos del teclado.**

**Atajos no negociables:**

| Tecla | Acción |
|---|---|
| `/` | Focus buscador productos |
| `Enter` | Confirmar acción primaria contextual |
| `Esc` | Cancelar/cerrar |
| `F2` | Cliente |
| `F3` | Cambiar caja |
| `F4` | Descuento global |
| `F5` | Modificar cantidad |
| `F6` | Eliminar item |
| `F7` | Notas internas |
| `F8` | Medios de pago |
| `F9` | Tipo de comprobante |
| `F10` | Anulación última venta |
| `F11` | Pantalla completa |
| `F12` | Cobrar y emitir |
| `Ctrl+Z` | Deshacer carrito |
| `Ctrl+P` | Reimprimir último ticket |
| `Ctrl+N` | Nueva venta |
| `↑/↓` | Navegar items carrito |

**Indicadores visuales:**
- Cada botón con atajo muestra atajo visible: `[F12] Cobrar`.
- Hover muestra atajo si existe.
- Pantalla de ayuda con `?` muestra todos.

**Accesibilidad táctil (fallback):**
- Todos los atajos tienen botón visible para casos sin teclado.
- Botones críticos: target táctil mínimo 48x48px (sobre el 44x44 estándar).
- Separación mínima 8px entre targets.

## 14.4 Estados visuales

**Loading:**

| Duración | UI |
|---|---|
| < 100ms | Nada (optimistic) |
| 100-300ms | Cursor wait + atenuación botón |
| 300-1000ms | Skeleton + botón "Procesando..." |
| 1000-3000ms | Skeleton + barra |
| 3000-10000ms (AFIP) | Modal "Solicitando CAE a AFIP..." + barra + "Cancelar tras 15s" |
| > 10000ms | Toast "La operación está tardando..." |

**Regla:** nunca > 100ms sin feedback.

**Success:**

| Severidad | UI |
|---|---|
| Rutinaria (carrito) | Sin toast, cambio visual basta |
| Importante (venta cobrada) | Toast verde 3-4s + animación check |
| Crítica (factura emitida) | Toast verde 5s + sound + ticket en pantalla |
| Destructiva (anulación) | Toast amarillo 5s + log historial |

**Error (sin mensajes genéricos):**

| Error | Mal | Bien |
|---|---|---|
| Stock insuficiente | "Error al confirmar" | "Stock insuficiente: queda 1 unidad de 'Coca 500ml'. [Sí con autorización] [Modificar] [Quitar]" |
| Sin internet | "Error conexión" | "Sin internet. Reintentando cada 10s. [Cancelar]" |
| AFIP timeout | "Error AFIP" | "AFIP no respondió en 30s. Ticket no fiscal emitido. Reintentamos en 5 min. [Reintentar manual]" |
| Pagos no cuadran | "Error pagos" | "Pagos suman $X, total $Y. Falta $Z. [Ajustar]" |
| Sin permiso | "Acceso denegado" | "Tu rol (cajero) no puede aplicar descuentos > 10%. Pedí autorización." |
| Sesión expirada | "Sesión expirada" | "Tu sesión venció. Tus datos del carrito se guardaron. [Reingresar]" |
| Producto duplicado | "Error validación" | "El SKU 'PROD-001' ya existe en 'Coca 1L'. [Editar ese] [Cambiar SKU]" |

## 14.5 Confirmaciones obligatorias

Acciones destructivas requieren confirmación verbose:

| Acción | Confirmación |
|---|---|
| Anular venta facturada | "Esta venta tiene factura B-0001-00001234. Anularla emite NC automática. [Cancelar] [Sí, anular y emitir NC]" + motivo obligatorio |
| Eliminar producto con histórico | "Este producto tiene 47 ventas. Se marca como inactivo (no eliminado físicamente). [Cancelar] [Sí, inactivar]" |
| Cierre con descuadre > 5% | "Descuadre $X (Y%). Requiere autorización admin. [Solicitar] [Cancelar]" |
| Eliminar empresa | Wizard 3-step + delay 7 días + email cancelación |
| Cambiar plan a menos features | "Bajar de Pro a Starter desactiva: variantes, multi-sucursal. [Cancelar] [Sí]" |

## 14.6 Tolerancia a errores humanos

| Error | Prevención |
|---|---|
| Doble escaneo rápido | Detección timing < 200ms = ignorar segundo |
| Cliente paga efectivo, cambio mal | Sistema sugiere cambio automático |
| Cantidad con coma vs punto | Aceptar ambos, normalizar |
| CSV con encoding raro | Auto-detect UTF-8, CP1252, ISO-8859-1 |
| Buscar SKU con espacios | Normalizar (ignorar espacios, guiones, mayúsculas) |
| CUIT con guiones | Auto-formatear/limpiar |
| Olvidar cerrar turno | Cron 23:59 con smart detection |
| Vender producto sin stock | Override solo si tenant lo habilita + motivo |
| Cobrar de menos | Validación pagos === total |
| Ticket roto | Reimprimir disponible |

**Mensajes preventivos:**

- Cerrar turno con `pending_payment`: "Hay 3 ventas sin cobrar."
- Deshabilitar AFIP: "Tenés 142 facturas este mes. Las nuevas no podrán facturarse."
- Anular venta de hace 23h: "Esta venta tiene 23h. Anulación permitida hasta 24h."
- Stock crítico al agregar: "Quedan 2 unidades. ¿Continuar?" (no bloqueante)

## 14.7 Fallback manual

| Sistema falla | Camino manual |
|---|---|
| AFIP timeout 30s | Ticket no fiscal + reconciliación async |
| Impresora no responde | PDF en pantalla con QR + "Reintentar impresión" |
| Padrón A5 no responde | Carga manual sin validación + "Pendiente validar" |
| Webhook MP no llega | Marcar pago manual con referencia + audit |
| Búsqueda fuzzy falla | Fallback literal |
| Imagen producto falla | Producto sin imagen, agregar después |
| Sync catálogo tablet falla | Cache local + banner "Catálogo desactualizado" |
| Login email/password falla | Magic link, después support |

## 14.8 UX offline (Fase 2+)

🟡 **AMARILLO** — Implementación F2.

- **Detección:** banner amarillo "Sin conexión. Ventas se guardan localmente."
- **Permitido offline:** venta ticket no fiscal, registro caja, búsqueda cache.
- **Bloqueado offline:** facturación AFIP (queue), Padrón nuevo, importación.
- **Contador pendiente:** visible "12 operaciones pendientes".
- **Reconexión:** banner verde 5s "Sincronizando..." → "Completo".
- **Conflicto sync:** modal con resolución manual.

## 14.9 Empty states

| Pantalla | Mensaje + CTA |
|---|---|
| Sin productos | "No tenés productos. [Importar CSV] [Cargar manual] [Productos demo del rubro]" |
| Sin clientes | "No tenés clientes. [Agregar] [Importar Excel]" |
| Sin ventas hoy | "Todavía no hay ventas hoy. [Nueva venta]" |
| Carrito vacío | "Carrito vacío. Escaneá o presioná / para buscar." |
| Sin turno abierto | "No tenés turno abierto. [Abrir turno con monto inicial]" |
| Sin notificaciones | "Sin notificaciones. Te avisamos cuando pase algo importante." |
| Sin reportes | "Generá tu primer reporte. [Ventas del día] [Stock crítico]" |

## 14.10 Mobile-aware (no mobile-first)

Pandora es desktop/tablet-primary.

| Dispositivo | Optimización |
|---|---|
| Desktop 1366px+ | POS completo. Keyboard-first. Grids amplios. |
| Tablet 768-1365px | POS completo touch-first. Botones grandes. |
| Mobile < 768px | **Solo lectura.** Dashboard simplificado. Notificaciones. Cierre desde tablet preferido. |

**Por qué no mobile POS:**
- Tablet más estable que celular.
- Celular muy chico para carrito + cliente + totales + atajos.
- Dedo cansado en zonas chicas propenso a error.
- Cobrar con celular + bolsa + producto = caos.

## 14.11 Modo nocturno

🟢 **VERDE** F1 — Crítico para kioscos hasta tarde.

- Activación: manual (toggle settings) o automática (hora local 20:00-07:00, F1+).
- Paleta: fondos gris oscuro (#0f172a), textos blancos (#f1f5f9), accents primary mantenidos.
- Reduce fatiga visual.
- Independiente del SO (algunos comerciantes no saben configurar).

## 14.12 Sonido y notificaciones audibles

🟡 **AMARILLO** — Validar con primeros 5 clientes.

- Venta exitosa: "ding" corto (configurable, default ON).
- Rechazo: tono grave corto (default OFF en local ruidoso).
- Error crítico (AFIP timeout): alerta larga (default ON).
- Configuración por usuario.
- Mute global para horarios (siesta).

## 14.13 Internacionalización

**F0-3:** Español rioplatense (es-AR) único. NO "español neutro" — el target argentino usa palabras locales (boleta, cambio, "te paso transferencia").

**F4+ multi-país:**
- Estructura i18n preparada desde F0 con archivos separados aunque solo se use es-AR.
- F4: es-UY, es-CL, es-MX con localizaciones (moneda, formato fecha, fiscal local).
- Inglés solo para soporte interno.

## 14.14 Accesibilidad

🟢 **VERDE** — WCAG 2.1 AA mínimo.

**Requisitos no negociables:**

- Contraste mínimo 4.5:1 normal, 3:1 grande. Validado con axe-core en CI.
- Foco visible en todo interactivo.
- Navegación por teclado completa.
- ARIA labels en botones de íconos. `aria-live` para toasts.
- Sin trampa de foco en modales (Esc cierra).
- Base 16px mínimo. 200% zoom sin romper.
- Información crítica con icono + texto, no solo color.

**Para comerciantes mayores:**
- Inter o sistema, no decorativas.
- 14px tablas densas, 16px formularios.
- Padding generoso (12vert, 24horiz).
- Iconos siempre con label crítico.

## 14.15 Métricas de UX

| Métrica | Target F0 |
|---|---|
| Escaneo → venta confirmada p95 | < 15s |
| Tasa anulación de ventas | < 3% |
| Tasa errores cierre (descuadre > 5%) | < 5% |
| Tiempo onboarding completo p50 | < 45 min |
| Abandono onboarding por paso | < 20% |
| Tasa reimpresión | Bajo es bueno |
| Errores 4xx POS | < 2% |
| Tiempo respuesta a error (ver → resolver) p50 | < 30s |

## 14.16 Onboarding detallado

**Paso 1: Registro (3 min):**
- Email + password + nombre comercio.
- CUIT optativo.
- Botón: "Empezar a vender ya".
- Sin marketing opt-in, sin cookies tracking obligatorias.

**Paso 2: Datos comerciales (5 min):**
- Nombre fantasía, dirección, teléfono, condición IVA (default RI).
- Rubro: dropdown con productos demo pre-cargados.
- Botón: "Continuar al POS" (opción saltear AFIP).

**Paso 3: AFIP (opcional, 30-60 min cuando tenga certificado):**
- Wizard sube certificado X.509 con instrucciones.
- Configurar punto de venta.
- Probar comprobante de prueba contra homologación.
- Si OK: activar producción.

**Por qué AFIP opcional al inicio:**
Los comerciantes ven el producto vendiendo antes de configurar fiscalidad. AFIP toma 1-3 días. Si bloqueás, perdés 60% de registros.

**Estrategia ganadora:** comerciante registra → vende con demo → se enamora → completa AFIP después.

## 14.17 Lo que NO hace el POS

🟢 **VERDE** — Decisiones explícitas de NO hacer.

- ❌ Tutoriales onboarding largos (cajero sabe vender)
- ❌ Gamificación
- ❌ Chat in-app (soporte por WhatsApp)
- ❌ Upselling en venta ("¿agregás X?")
- ❌ Social sharing
- ❌ Push de marketing
- ❌ Skin/temas personalizables (Fase 0-2)
- ❌ Tour interactivo del POS
- ❌ Estadísticas comparativas anónimas

---

# 15. Visual system

🟢 **VERDE** — Identidad Dawn Sky + 3 atmospheres + 6 ADRs formales.

## 15.1 Filosofía

**"Una identidad, tres intensidades."** La identidad (Dawn Sky + glass + motion philosophy) no negocia. La intensidad sí, según contexto operativo.

**Tres atmospheres:**

| Atmosphere | Dónde | Para qué |
|---|---|---|
| **Atmosphere** | Dashboard, onboarding, marketing | Premium emocional, conversión |
| **Operational** | POS, listados, workflow | Velocidad, baja fatiga 8-12h |
| **Critical** | Fiscal, destructivo, irreversible | Claridad máxima, cero distracción |

## 15.2 Identidad permanente: Dawn Sky

🟢 **VERDE** — ADR-0016.

Background pastel de gradientes radiales que evoca amanecer. Es la firma del producto.

**Default permanente F0:** dawn (rosa pastel + lavanda + cielo).
**F1+:** noon (mediodía), dusk (atardecer), night (modo nocturno) configurables.
**F0 confirmado:** solo dawn.

## 15.3 Mapa de pantallas por atmosphere

### Atmosphere

- Landing pública
- Onboarding wizard (3 pasos)
- Home dashboard del owner
- Dashboard multi-empresa del contador
- Reportes con visualizaciones
- Marketing surfaces (planes, upgrade, referidos)
- Pantalla post-venta exitosa con CAE
- AI Assistant (F1+)
- Settings de personalización

### Operational

- **POS (la pantalla más usada)**
- Listados de productos
- Listados de clientes
- Listados de ventas históricas
- Búsqueda fuzzy
- Carga/edición de productos
- Stock management
- Caja: apertura, movimientos durante turno
- Importación CSV
- Tablas operativas en general

### Critical

- Modal confirmación de venta antes de cobrar
- Pantalla de factura con CAE emitido
- Cierre de caja con arqueo y descuadre
- Anulación de venta
- Configuración AFIP (certificado, PV)
- Modo lectura por impago / suspensión
- Backup y exportación de datos
- Modal eliminación de empresa
- Operaciones que generan NC
- Cambio de condición IVA del comerciante
- Suplantación por soporte

## 15.4 Specs ejecutables por atmosphere

### Atmosphere

```css
[data-atmosphere="atmosphere"] {
  --surface-bg: rgba(255, 255, 255, 0.58);
  --surface-blur: 28px;
  --surface-saturate: 140%;
  --surface-border: rgba(255, 255, 255, 0.85);
  --surface-shadow: 
    0 1px 0 rgba(255,255,255,0.9) inset,
    0 8px 32px rgba(54, 70, 120, 0.10),
    0 2px 8px rgba(54, 70, 120, 0.06);
  
  --motion-enter-duration: 600ms;
  --motion-stagger-delay: 60ms;
  --motion-hover-lift: -2px;
  
  --feature-tilt: 1;
  --feature-sheen: 1;
  --feature-parallax: 1;
  --feature-counter-shine: 1;
  --feature-floaty: 1;
  --feature-avatar-ring: 1;
  
  --density-row-height: 44px;
  --density-input-height: 40px;
  --density-padding: 22px;
  --density-base-font: 14px;
  
  --chart-entry-animation: enabled;
}
```

### Operational

```css
[data-atmosphere="operational"] {
  --surface-bg: rgba(255, 255, 255, 0.82);
  --surface-blur: 12px;
  --surface-saturate: 110%;
  --surface-border: rgba(255, 255, 255, 0.6);
  
  --motion-enter-duration: 200ms;
  --motion-stagger-delay: 0ms;
  --motion-hover-lift: 0;
  
  --feature-tilt: 0;
  --feature-sheen: 0;
  --feature-parallax: 0;
  --feature-counter-shine: 0;
  --feature-floaty: 0;
  --feature-avatar-ring: 0;
  
  --density-row-height: 32px;
  --density-input-height: 36px;
  --density-padding: 12px;
  --density-base-font: 13px;
  
  --chart-entry-animation: disabled;
  --counter-animation: disabled;  /* ← clave: números reales sin animar */
}
```

### Critical

```css
[data-atmosphere="critical"] {
  --surface-bg: rgba(255, 255, 255, 0.96);
  --surface-blur: 0;
  --surface-saturate: 100%;
  --surface-border: rgba(13, 20, 36, 0.12);
  
  --motion-enter-duration: 0ms;
  
  --feature-tilt: 0;
  --feature-sheen: 0;
  --feature-parallax: 0;
  --feature-counter-shine: 0;
  
  --density-row-height: 56px;
  --density-input-height: 48px;
  --density-padding: 24px;
  --density-base-font: 15px;
  
  --type-amount-display: 56px;
  --type-cae-mono: 24px;
  
  --sky-overlay-bg: rgba(13, 20, 36, 0.35);
}
```

## 15.5 Color tokens

```css
:root {
  /* Ink (textos) */
  --ink-0: #0d1424;
  --ink-1: #1f2a44;
  --ink-2: #4a5570;
  --ink-3: #7681a0;
  --ink-4: #a8b0c5;
  
  /* Glass */
  --glass-58: rgba(255, 255, 255, 0.58);
  --glass-72: rgba(255, 255, 255, 0.72);
  --glass-82: rgba(255, 255, 255, 0.82);
  --glass-92: rgba(255, 255, 255, 0.92);
  --glass-96: rgba(255, 255, 255, 0.96);
  
  /* Accents */
  --purple: #6b5fff;
  --purple-2: #9088ff;
  --blue: #5b8cff;
  --teal: #1ea8a0;
  
  /* Semantic */
  --success: #34c77d;
  --warning: #f0b878;
  --danger: #ef5d6a;
  --orange: #f7984a;
  --pink: #ee6a8e;
  
  /* Fiscal */
  --fiscal: #0d1424;
  --fiscal-bg: rgba(13, 20, 36, 0.04);
  
  /* Active accent (runtime) */
  --accent: var(--purple);
  --accent-2: var(--purple-2);
  --accent-soft: rgba(107, 95, 255, 0.10);
}
```

## 15.6 Motion tokens

```css
:root {
  --motion-feedback: 80ms;
  --motion-fast: 180ms;
  --motion-medium: 240ms;
  --motion-slow: 400ms;
  --motion-deliberate: 600ms;
  --motion-rich: 900ms;
  --motion-chart: 1600ms;
  
  /* SOLO estas 4 easings */
  --ease-default: cubic-bezier(.2, .7, .2, 1);
  --ease-nav: cubic-bezier(.4, 0, .2, 1);
  --ease-pulse: ease-in-out;
  --ease-spin: linear;
}

@media (prefers-reduced-motion: reduce) {
  :root {
    --motion-feedback: 0ms;
    --motion-fast: 0ms;
    --motion-medium: 0ms;
    --motion-slow: 0ms;
    --motion-deliberate: 0ms;
    --motion-chart: 0ms;
  }
  
  .parallax-sky, .avatar-ring, .floaty-card,
  .counter-shine, .live-dot::after, .sheen::before {
    animation: none !important;
  }
}
```

## 15.7 Arquitectura técnica

**Estructura:**

```
src/
├── styles/tokens/             ← CSS custom properties
├── styles/atmospheres/        ← 3 archivos por atmosphere
├── styles/sky/dawn.css        ← F0
├── components/atmosphere/
│   ├── AtmosphereProvider.tsx
│   ├── Surface.tsx
│   ├── GlassCard.tsx
│   ├── TiltCard.tsx
│   ├── Sheen.tsx
│   └── ParallaxSky.tsx
├── components/charts/         ← 4 charts SVG puro migrados
├── components/primitives/     ← Icon, Avatar, LiveDot, etc.
└── lib/design/
    ├── atmospheres.ts
    ├── hardware-detection.ts
    └── motion-presets.ts
```

**Uso:**

```tsx
// POS — operational
<Surface level="operational">
  <GlassCard>
    <ProductGrid />
  </GlassCard>
</Surface>

// Dashboard — atmosphere
<Surface level="atmosphere">
  <ParallaxSky />
  <GlassCard>
    <RevenuePanel />
  </GlassCard>
</Surface>

// Anulación — critical
<Surface level="critical">
  <GlassCard variant="strong">
    <h1>¿Anular venta #1234?</h1>
    <BigAmount>${total}</BigAmount>
  </GlassCard>
</Surface>
```

## 15.8 Degradación automática por hardware

```typescript
function detectCapabilities(): Capabilities {
  if (typeof window === 'undefined') return { ...defaults };
  
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const cores = navigator.hardwareConcurrency ?? 4;
  const memory = (navigator as any).deviceMemory ?? 4;
  const isMobile = /Mobi|Android.*Mobile|iPhone/i.test(navigator.userAgent);
  const isTablet = /iPad|Android(?!.*Mobile)/i.test(navigator.userAgent) 
    || (window.innerWidth >= 768 && window.innerWidth < 1180);
  
  const highPerf = !reducedMotion && cores >= 4 && memory >= 4 && !isMobile;
  
  return {
    highPerf,
    reducedMotion,
    canDoGlass: !reducedMotion && cores >= 2,
    canDoTilt: highPerf && !isTablet,
    canDoParallax: highPerf && !isMobile && !isTablet,
    canDoCharts: true,
    isMobile,
    isTablet,
  };
}
```

**Si hardware bajo:** Atmosphere degrada automáticamente a Operational. Sin cambio de código.

## 15.9 Performance budget

| Atmosphere | LCP | FPS | FID | CLS |
|---|---|---|---|---|
| Atmosphere | < 2.5s | 60fps | < 100ms | < 0.1 |
| Operational | < 1.5s | 60fps consistente | < 50ms | < 0.05 |
| Critical | < 1.0s | N/A | < 30ms | 0 |

**Si Operational baja a 30fps en hardware target durante POS normal: bug bloqueante.**

## 15.10 Decisiones cerradas Fase 0

🔴 → 🟢 Cerradas en Sesión 3.7:

- Override de atmospheres por tenant: **NO permitido F0-2**, evaluar F3.
- Light vs Dark default: **Light siempre F0**, auto por hora F1+.
- Sky moods: **Solo dawn F0**, noon/dusk/night F1+.

---

*[Sesión 4 — Parte 3 de 5 — Continúa en parte 4]*
