# OPERATIONAL-SEVERITY.md — Pandora ERP

**Versión:** 1.0.0
**Fecha:** 2026-05-28
**Estado:** vigente
**Propósito:** definir formalmente las **severidades operativas** de Pandora (S0 a S4), su impacto en alertas, retries, UX, escalado y SLAs internos. **Sin matriz de severidad, todo se trata igual — y eso es el peor escenario.**

> Severidad ≠ Prioridad. Severidad = impacto técnico/legal/operativo del incidente. Prioridad = qué se atiende primero según severidad + contexto + recursos.

---

## Por qué este documento existe

Sin matriz de severidad:
- Bug visual y corrupción fiscal entran al mismo backlog
- Alertas saturan al operator (todo es "critical")
- Cliente con caja sin cerrar espera tanto como cliente con tema cosmético
- Decisiones de retry / fail-closed / escalado son improvisadas
- Métricas inútiles ("hubo 50 errores hoy" sin contexto)

Con matriz de severidad:
- Alertas calibradas por severidad
- Retry policy alineada con severidad
- UX comunica severidad al usuario
- Operator sabe qué atender primero
- Métricas accionables ("hubo 1 S0 + 3 S1 hoy")

---

## Matriz canónica F0

| Severidad | Nombre | Definición | Ejemplo | Detección | Acción operator |
|---|---|---|---|---|---|
| **S0** | Catástrofe fiscal/legal | Riesgo de corrupción de datos fiscales, pérdida de información legalmente requerida, violación grave compliance | Doble facturación, fuga cross-tenant, audit_log mutado, certificado AFIP usado por tenant equivocado, pérdida de XML AFIP, hash chain rota (F1+) | Inmediata: alertas + paging | **STOP de operaciones del tenant** + investigación inmediata + posible notificación legal AAIP / cliente |
| **S1** | Incidente operativo crítico | Imposibilita operar venta o cumplir compliance, sin corrupción pero con bloqueo grave | AFIP DOWN > 30 min, cert AFIP expirado en producción, RLS rota detectada en tests, secret vault inaccesible, DB Supabase DOWN | < 5 min | Activar runbook + comunicar a clientes afectados + escalado a Pandora team |
| **S2** | Degradación significativa | Operación posible pero con costo (manual, lento, parcial) | Reconciliación pendiente > 2h, dead jobs > 10, MercadoPago timeout intermitente, métricas dashboard caído | < 30 min | Investigar causa raíz + considerar runbook + comunicar si afecta varios tenants |
| **S3** | Anomalía no bloqueante | Algo está mal pero el comerciante puede seguir vendiendo | Cron de cleanup falló (próxima vez se ajusta), email enviado tarde, reporte tardó más de lo esperado, métrica fuera de rango sin causa clara | < 24h | Investigar en horario laboral + ticket interno |
| **S4** | Cosmético / informativo | Ruido, mejora UX, signal débil sin acción urgente | Texto mal formateado, animación entrecortada en hardware viejo, warning de browser viejo, log "info" inusual | < 1 semana | Backlog técnico |

---

## Calibración por dominio

### Dominio FISCAL

| Evento | Severidad |
|---|---|
| Doble emisión del mismo número fiscal | **S0** |
| Audit log mutado | **S0** |
| Certificado X.509 usado por tenant equivocado | **S0** |
| Hash chain rota (F1+) | **S0** |
| XML AFIP perdido / inaccesible | **S0** |
| AFIP WSAA inalcanzable > 30 min | **S1** |
| Certificado AFIP expirado en producción | **S1** |
| `reconciliation.outcome=manual_required` > 5/día/tenant | **S1** |
| Reconciliación pendiente > 2h por tenant | **S2** |
| `reconciliation.outcome=reconciliation_timeout` > 1/día | **S2** |
| AFIP `observed` warning sin rechazo | **S3** |
| Latencia AFIP P95 > 10s | **S3** |

### Dominio MULTI-TENANT

| Evento | Severidad |
|---|---|
| Cross-tenant data leak confirmado (datos de A vistos por B) | **S0** |
| Cross-tenant access attempt bloqueado por RLS | **S2** (signal de bug o ataque) |
| Cross-tenant access attempt bloqueado por Service validation (defensa en profundidad) | **S2** |
| Permisos cliente no invalidados tras cambio | **S3** |

### Dominio MONEY

| Evento | Severidad |
|---|---|
| Cliente recibe money mal calculado (preview != server, server gana) | **S2** (tampering attempt o bug) |
| Money tampering attempt (cliente envía amount distinto al recalculado) | **S1** (security signal) |
| Money invariant violation (NaN, overflow) | **S0** |

### Dominio CASH

| Evento | Severidad |
|---|---|
| 2 cash_sessions abiertas para el mismo (tenant, sale_point) | **S0** (constraint violado, bug en serializable) |
| Descuadre de caja > umbral configurable (default $5000 ARS) | **S2** |
| Descuadre menor (< $5000) | **S3** |

### Dominio JOBS / RECONCILIATION

| Evento | Severidad |
|---|---|
| `reconciliation.poison_jobs_detected > 0` | **S1** (bug crítico) |
| `dead_jobs_waiting > 10` sin atender | **S2** |
| Worker SKIP LOCKED falla → double-processing detectado | **S0** |
| Job `manual_resolution_required` > 4h | **S2** |
| Job retry budget agotado (24 attempts) | **S2** |

### Dominio AUTH / SECURITY

| Evento | Severidad |
|---|---|
| Brute force detectado | **S2** |
| Session token comprometido (uso desde IP imposible) | **S1** |
| Webhook HMAC validation falla > 5/min | **S1** |
| Webhook replay attempt detectado | **S2** |
| TLS handshake fail con AFIP | **S1** |
| NTP drift > 5s | **S1** |
| Secret loggeado por error (post-detección) | **S0** |

### Dominio OBSERVABILITY

| Evento | Severidad |
|---|---|
| `audit_log` write falla dentro de tx fiscal | **S0** (tx debe rollback) |
| `audit_log` write falla fuera de tx crítica | **S1** |
| Pino log no se persiste | **S2** |
| Metrics whitelist violation (intento de tag no autorizado) | **S2** (bug en código) |
| Realtime broadcast falla | **S3** (cliente refresh manual ok) |

### Dominio INTEGRATIONS

| Evento | Severidad |
|---|---|
| MercadoPago webhook firma inválida persistente | **S1** |
| MP payment.confirmed sin sale asociada (reverse lookup falla) | **S2** |
| Email factura falla 3+ veces para mismo destinatario | **S3** |

### Dominio UX

| Evento | Severidad |
|---|---|
| POS no responde > 5s en happy path | **S2** |
| POS lento entre 3-5s (excede target P95 < 3s — CLAUDE.md §14.7) | **S3** |
| Animación 60fps no se logra (degradación glass) | **S4** |
| Tipografía mal renderizada | **S4** |

> **Nota performance:** target P95 venta cobrada = **< 3s end-to-end** (CLAUDE.md §1.4 + §14.7). Threshold S3 = 3-5s (excede target). Threshold S2 = > 5s (degradación significativa). Distinción: target es lo que se espera siempre; threshold es cuándo escalar.

---

## Impacto en políticas

### Retry policy por severidad

| Severidad | Retry automático | Razón |
|---|---|---|
| **S0** | **NO retry automático.** Estado intermedio + intervención humana. | Re-ejecutar = re-corrumpir. |
| **S1** | Retry limitado según contexto (AFIP: 24 attempts del worker). Después manual. | Riesgo alto, no asumir resolución sola. |
| **S2** | Retry exponencial controlado + dead letter. | Probablemente recoverable, monitorear. |
| **S3** | Retry con backoff. | Eventualmente OK. |
| **S4** | Best effort. | Sin urgencia. |

### Fail-closed vs fail-open

| Severidad | Default |
|---|---|
| **S0 fiscal** | **Fail-closed absoluto.** No emitir. |
| **S0 multi-tenant** | **Fail-closed absoluto.** Bloquear acceso. |
| **S1 fiscal** | Fail-closed con UX clara ("AFIP no responde, no podemos emitir factura ahora"). |
| **S1 no fiscal** | Caso por caso. |
| **S2** | Degradar funcionalidad afectada, mantener resto operativo. |
| **S3** | Continuar normal + log + métrica. |
| **S4** | Ignorar UI, fix en backlog. |

### Alerting

| Severidad | Canal | Latencia objetivo |
|---|---|---|
| **S0** | Paging on-call (SMS / WhatsApp / llamada) + email + Sentry alert | < 1 min detección → notificación |
| **S1** | Email + Sentry alert + dashboard rojo | < 5 min |
| **S2** | Email diario digest + dashboard amarillo | < 30 min |
| **S3** | Email semanal digest | < 24h |
| **S4** | Solo dashboard | Cuando se mire |

### UX al usuario (comerciante)

| Severidad | UX | Mensaje |
|---|---|---|
| **S0** | Pantalla bloqueante con contacto soporte | "Hubo un problema con tu cuenta. Pandora team ya está investigando. Te contactaremos a (email). NO continúes operando hasta nuevo aviso." |
| **S1 fiscal** | Bloqueo de emisión + UX clara | "AFIP no responde en este momento. Tu venta quedó registrada y se facturará automáticamente cuando se restablezca el servicio." |
| **S1 no fiscal** | Banner rojo + retry button | "Hubo un problema. Reintentá o contactá soporte." |
| **S2** | Banner amarillo informativo | "Algunas operaciones pueden estar lentas. Estamos resolviendo." |
| **S3** | Sin UX visible | (sólo dashboard interno) |
| **S4** | Sin UX visible | (backlog) |

### Escalado interno

| Severidad | Quién interviene | Cuándo |
|---|---|---|
| **S0** | Owner técnico (Agus) + posible asesor legal | Inmediato |
| **S1** | Owner técnico (Agus) | < 1h |
| **S2** | Owner técnico (Agus) en horario | Mismo día |
| **S3** | Owner técnico (Agus) en backlog | Esta semana |
| **S4** | Backlog técnico | Cuando toque |

(F0: equipo de 1 — Agus. F1+ con team: definir on-call schedule.)

### SLA interno (target F0)

| Severidad | Detección | Mitigación inicial | Resolución completa |
|---|---|---|---|
| **S0** | < 5 min | < 30 min (stop + investigación) | < 24h |
| **S1** | < 15 min | < 1h | < 8h |
| **S2** | < 1h | < 4h | < 48h |
| **S3** | < 24h | < 1 semana | < 2 semanas |
| **S4** | best effort | best effort | backlog |

(Targets aspiracionales F0 con 1 persona. Realistas F1+ con team y on-call rotation.)

---

## Detección automática

### Triggers a configurar en F0

| Trigger | Severidad |
|---|---|
| `audit_log` UPDATE intento (trigger throw) → Sentry fatal | **S0** |
| Constraint violation en `cash_sessions` unique partial → Sentry error | **S0** |
| Test cross-tenant falla en CI → bloquea merge | **S0** preventivo |
| `metrics_counter` cardinality drift detectado por cron mensual | **S2** |
| `reconciliation.outcome=manual_required` count > 5/día/tenant en métrica | **S1** |
| `dead_jobs_waiting > 10` query Q2 RECONCILIATION-ENGINE | **S2** |
| AFIP request latencia P95 > 10s sostenida 5 min | **S3** |
| AFIP request latencia P95 > 30s (timeout) sostenida 5 min | **S1** |
| Padron A5 cache miss > 50% sostenido | **S3** |

### Métricas con threshold alert

Configurar en F0 (vía cron que consulte métricas + escriba alerta):

```typescript
// Métricas referenciadas alineadas con EVENT-TAXONOMY.md §4.1 METRIC_WHITELIST.
const ALERT_THRESHOLDS = {
  'reconciliation.outcome': {
    // 'manual_required' es el tag VALUE acotado de la métrica
    // (corto por cardinality control); el estado de venta es
    // 'manual_resolution_required' (más largo). Son cosas distintas.
    'manual_required': { perDay: 5, severity: 'S1' },
    'reconciliation_timeout': { perDay: 1, severity: 'S2' },
  },
  'reconciliation.poison_jobs_detected': { perDay: 0, severity: 'S1' }, // any
  'reconciliation.dead_jobs_waiting': { instantaneous: 10, severity: 'S2' },
  'system.webhook.replay_detected': { perHour: 5, severity: 'S2' },
  'system.cross_tenant.blocked': { perDay: 0, severity: 'S2' }, // any
  'system.price_tampering_attempt': { perDay: 0, severity: 'S2' }, // any
};
```

---

## Reglas absolutas

### R1 — No mezclar severidades

Cada incidente tiene UNA severidad. Si entre S1 y S2, elegir la mayor.

### R2 — Severidad puede subir, no bajar

Si en investigación se descubre que un S2 era en realidad S0, se sube. No se baja "porque era menos malo de lo que parecía" sin justificación.

### R3 — S0 SIEMPRE genera audit + retrospectiva

Aunque se resuelva rápido, S0 deja audit explícito + retrospectiva escrita.

### R4 — S0/S1 nunca se silencian

Si una alerta S0/S1 es "ruidosa" (falsos positivos), el fix es **calibrar el trigger**, NO silenciar.

### R5 — UX comunica severidad

Comerciante NUNCA ve "internal server error 500". Ve mensaje calibrado a severidad.

### R6 — Métricas reflejan severidad

Dashboard de operator ordena por severidad descendente.

### R7 — Backlog ordenado por severidad

Items abiertos del backlog se priorizan por severidad antes que por antigüedad.

---

## Anti-patterns prohibidos

- "Todo es crítico" (alert fatigue → ignoras todo)
- "Todo es nice-to-have" (no priorizás S0/S1)
- Silencio de S0/S1 por ruido (calibrar trigger en su lugar)
- UX que NO comunica severidad al comerciante
- Métricas sin severidad asociada
- "Fix temporal" en S0 sin retrospectiva escrita
- Asumir que S2 se va a resolver solo

---

## Cómo agregar evento nuevo a la matriz

1. Identificar dominio (fiscal, multi-tenant, money, cash, jobs, auth, observability, integrations, UX).
2. Evaluar impacto técnico/legal/operativo.
3. Asignar severidad según matriz.
4. Si genera detección automática: agregar a `ALERT_THRESHOLDS` + cron / Sentry rule.
5. Definir mensaje UX si afecta cliente.
6. Documentar en runbook si requiere acción específica.

---

## Cross-references

- [RUNBOOKS/](RUNBOOKS/) — playbooks específicos por incidente
- [CLAUDE.md §11](CLAUDE.md) — Security Constitution (threat model)
- [CLAUDE.md §13](CLAUDE.md) — Reliability & Recovery
- [EVENT-TAXONOMY.md](EVENT-TAXONOMY.md) — eventos canónicos + métricas (METRIC_WHITELIST en §4.1)
- [CAPABILITY-MAP.md](CAPABILITY-MAP.md) — capabilities cuyo health monitorea esta matriz
- [BOUNDED-CONTEXTS.md](BOUNDED-CONTEXTS.md) — context que emite cada evento → severidad
- [CORRELATION-PROPAGATION.md](CORRELATION-PROPAGATION.md) — `correlation_id` indispensable para investigation S0/S1
- [RECONCILIATION-ENGINE.md](RECONCILIATION-ENGINE.md) — fuente de métricas reconciliation.* + dead letter philosophy
- [MONEY-POLICY.md](MONEY-POLICY.md) — money invariant violations son S0
- [DECISION-LEDGER.md](DECISION-LEDGER.md) — autoridad

---

## Estado real al 2026-05-28

- 🟡 documentado sin implementación (no hay alerts configuradas, ningún sistema productivo).
- Triggers + thresholds quedan como spec para implementación F0.

---

*OPERATIONAL-SEVERITY.md v1.0.0 — 2026-05-28. La calibración es la única defensa contra alert fatigue.*
