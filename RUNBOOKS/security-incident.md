# Security Incident — Runbook

**Severidad:** S0 (breach confirmado) / S1 (sospecha fundada)
**Detección:** automática (Sentry, métricas) + manual (reporte cliente / observación)
**SLA target F0:** detección < 15 min · contención < 1h · resolución < 8h · notificación legal según B-3 abogado

> Cubre: credentials filtradas, ataque sostenido, secret loggeado, sesión comprometida. Para fuga específica multi-tenant ver [cross-tenant-leak.md](cross-tenant-leak.md).

---

## Síntomas (por tipo)

### Tipo A — Credentials filtradas

- Login exitoso desde IP imposible (geo-anomalía)
- Múltiples sesiones simultáneas
- Cambio de password no solicitado
- Reportes de cliente "no fui yo"

### Tipo B — Secret loggeado

- Sentry / logs externos muestran string que matchea pattern de secreto (key, token, password)
- Audit de logs interno detecta WSAA token / cert pass / encryption key

### Tipo C — Ataque sostenido

- Rate limit hits masivos
- Webhook signature failures > umbral
- Login brute force
- Scan de paths (404s en patterns conocidos de exploit)

### Tipo D — Compromiso de cuenta interna

- Service role usado fuera de paths permitidos
- Support mode activo sin justificación
- Audit log entry sospechoso de actor `support` o `system`

## Pasos de mitigación INMEDIATA (< 1h)

### TIPO A — Credentials filtradas

#### 1. Forzar logout de usuario afectado

```sql
UPDATE active_sessions
SET revoked_at = now(), revoke_reason = 'security_incident_credentials'
WHERE user_id = '{user_id}' AND revoked_at IS NULL;
```

#### 2. Forzar reset de password

Vía Supabase Auth — invalidar sesión + obligar reset al próximo login.

#### 3. Audit log

```sql
-- Evento canónico EVENT-TAXONOMY §5 + severity 'error' (mapping de 'high' anterior).
-- NOTA: 'security.credentials_compromised' es ad-hoc del runbook; para audit canónico
-- usar 'system.incident_handled' con payload describiendo el tipo de incidente.
INSERT INTO audit_log (event_name, payload, severity, actor_type, ...)
VALUES (
  'system.incident_handled',
  '{
    "runbook": "security-incident.md",
    "severity_observed": "S1",
    "incident_type": "credentials_compromised",
    "user_id": "...",
    "detection_method": "...",
    "anomaly": {...},
    "outcome": "in_progress"
  }',
  'error',
  'system',
  ...
);
```

#### 4. Contactar al cliente

```
Hola {nombre},

Detectamos actividad inusual en tu cuenta. Por seguridad:
- Invalidamos todas tus sesiones activas
- Vas a necesitar restablecer tu contraseña

Pasos:
1. Andá a {link}
2. Restablecé tu contraseña con algo NUEVO (no reutilices)
3. Si activamos 2FA en algún momento (F1+), reactivá

Si notás algo raro, contactanos: {soporte}

— Pandora team
```

### TIPO B — Secret loggeado

#### 1. Identificar alcance

- ¿Dónde se loggeó? (Sentry / Vercel logs / DB)
- ¿Quién pudo verlo? (acceso al sistema de logs)
- ¿Cuánto tiempo estuvo expuesto?

#### 2. Rotar el secret comprometido

```bash
# Generar nuevo secret
NEW_KEY=$(openssl rand -hex 32)

# Si es SECRETS_ENCRYPTION_KEY (ADR-0019 S5-bis):
# 1. Agregar nuevo SECRETS_ENCRYPTION_KEY_V{N+1} a env vars Vercel
# 2. Cambiar SECRETS_ENCRYPTION_KEY_ACTIVE_VERSION=N+1
# 3. Worker re-encripta gradualmente
# 4. Eliminar V{N} cuando seguro

# Si es WSAA token: invalidar cache forzar regeneración
DELETE FROM wsaa_tokens_cache WHERE token LIKE '{exposed_substring}';

# Si es cert AFIP X.509:
# 1. Regenerar cert desde portal AFIP
# 2. Re-upload encrypted al vault
# 3. Notificar AFIP de revocación del viejo
```

#### 3. Borrar los logs con el secret expuesto

```sql
-- Si está en audit_log (NO debería, pero por si acaso)
-- Excepción al trigger de inmutabilidad — requiere migration manual + audit
-- Documentar EXTENSIVAMENTE por qué se hizo
```

⚠️ Borrar audit_log es EXCEPCIONAL y requiere:
- Justificación documentada
- Audit de la operación de borrado en SYSTEM_TENANT
- ADR ad-hoc

#### 4. Fix del bug que loggeó el secret

- Identificar punto del código donde se loggeó
- Patch para excluir field del log
- Agregar a Pino redact paths
- Test que verifica que el field nunca aparezca en logs
- Code review extra

### TIPO C — Ataque sostenido

#### 1. Identificar origen

```sql
-- audit_log: solo 'auth.login_failed' es event canónico (EVENT-TAXONOMY §5 domain auth).
-- Webhook signature failures + rate limit hits son MÉTRICAS (no audit events) — ver metrics_counter:
-- - 'system.webhook.replay_detected' por provider
-- - 'system.rate_limit.hit' por endpoint
SELECT ip_address, count(*) FROM audit_log
WHERE event_name = 'auth.login_failed'
  AND created_at > now() - interval '1 hour'
GROUP BY ip_address
ORDER BY count DESC
LIMIT 20;

-- Para rate limit y webhook attacks, consultar metrics_counter:
SELECT tag_value AS endpoint, sum(count) AS hits
FROM metrics_counter
WHERE metric_name = 'system.rate_limit.hit'
  AND bucket_hour > now() - interval '1 hour'
GROUP BY tag_value
ORDER BY hits DESC;
```

#### 2. Bloquear IPs ofensivas (F0 in-memory rate limit + F1+ WAF)

```typescript
// Agregar a in-memory blocklist
BLOCKED_IPS.add('{ip}');
```

F1+ con WAF (Cloudflare / Vercel Edge Middleware): bloqueo persistente.

#### 3. Si el ataque desborda capacidad

→ Escalar a S0 → activar emergency_stop por tenant afectado + comunicación + posible bloqueo geográfico temporal.

#### 4. Audit + reporte

```sql
INSERT INTO audit_log (event_name, payload, severity, ...)
VALUES (
  'security.sustained_attack_detected',
  '{
    "attack_type": "brute_force | webhook_replay | scan",
    "source_ips": [...],
    "duration_minutes": N,
    "mitigation_applied": "...",
    "runbook": "security-incident.md"
  }',
  'critical',
  ...
);
```

### TIPO D — Cuenta interna comprometida

#### 1. Revocar sesiones internas inmediato

```sql
UPDATE active_sessions
SET revoked_at = now(), revoke_reason = 'security_internal_compromise'
WHERE user_id IN (
  SELECT id FROM users WHERE actor_type IN ('support', 'system')
)
AND revoked_at IS NULL;
```

#### 2. Cambiar service role key

Vía Supabase consola: rotar service_role_key. Actualizar env var Vercel. Re-deploy.

#### 3. Auditar acciones recientes del actor

```sql
SELECT * FROM audit_log
WHERE actor_user_id = '{compromised_user_id}'
  AND created_at > now() - interval '7 days'
ORDER BY created_at;
```

Identificar:
- Mutations sospechosas
- Acceso a datos no justificado
- Pattern temporal anómalo (fuera de horario habitual)

#### 4. Si datos de tenant fueron tocados

→ Activar runbook cross-tenant-leak.md si aplica + comunicar.

## Investigación general (todos los tipos)

### 1. Snapshot evidencia

```bash
# Backup completo Supabase punto-en-tiempo
# Vía consola Supabase
```

```sql
COPY (SELECT * FROM audit_log WHERE created_at > '{start}' AND created_at < '{end}')
  TO '/tmp/security-incident-{fecha}-audit.csv' WITH CSV HEADER;
```

### 2. Timeline reconstruction

Vía `correlation_id` reconstruir flow completo del actor sospechoso.

```sql
-- Listar correlation_ids del usuario en ventana de tiempo
SELECT DISTINCT correlation_id FROM audit_log
WHERE actor_user_id = '{user_id}' AND created_at BETWEEN '{start}' AND '{end}';

-- Por cada correlation_id, traer audit + sales + invoices relacionados
```

### 3. Coordinación con abogado (S0)

Antes de cualquier comunicación a AAIP / cliente / público:
- Consultar con abogado registrado del proyecto
- Wording de comunicación validado
- Decisión de notificación a AAIP según B-3 (pendiente plazo exacto)

## Resolución

### Criterio para declarar resuelto

- Causa raíz identificada
- Fix aplicado y verificado en producción
- Logs / cuentas / secrets afectados rotados / cerrados
- Comunicaciones legales enviadas (si aplica)
- Audit log con timeline completo
- Post-mortem escrito

### Reactivar operaciones

Si se aplicó `emergency_stop`:

```sql
UPDATE feature_flags
SET enabled = false, payload = jsonb_set(payload, '{resolved_at}', to_jsonb(now()::text))
WHERE flag_key = 'emergency_stop' AND tenant_id = '{tenant}';
```

## Comunicación legal

### Notificación a AAIP (S0 con exposición de datos personales)

Ver [breach-notification.md](breach-notification.md).

### Notificación al titular del dato

Si hay clientes finales del comerciante afectados (datos PII expuestos):

→ Comunicar al comerciante para que él notifique a sus clientes finales.
→ Pandora puede proveer template + ayuda.

### Post-mortem público

S0/S1 sostenidos: considerar publicación de post-mortem en blog técnico (sin datos sensibles). Transparency genera confianza.

## Post-mortem (obligatorio S0/S1)

`docs/post-mortems/{fecha}-security-incident-{tipo}.md`:

- Timeline detallado
- Causa raíz técnica
- Causa raíz organizacional / proceso
- Impacto cuantificado
- Acciones preventivas implementadas
- Mejoras al runbook

## Acciones preventivas a futuro

### Refuerzos técnicos

- **Linter rule:** prohibir log de fields en SECRET LIST canónica (CLAUDE.md §10.5)
- **Pino redact paths:** lista exhaustiva configurada en logger config
- **Geo anomaly detection:** alert si login desde país/región no usual del usuario
- **MFA / 2FA:** F1+ obligatorio para roles owner / contador
- **Webhook signature monitoring:** alert si fail rate > umbral

### Refuerzos organizacionales

- Rotación periódica de secrets (rotación trimestral programada F1+)
- Audit trimestral de access logs por SYSTEM_TENANT actor
- Drills de runbooks trimestrales

---

## Anti-patterns

- ❌ Esconder incidente para no asustar clientes → empeora trust al revelarse después
- ❌ "Fix rápido + ver después" — debe haber test que reproduce + monitoreo activo
- ❌ Comunicación sin abogado en incidentes con PII
- ❌ Rotación de secrets sin documentación del proceso → próximo incidente repite errores
- ❌ Asumir que un fix solucionó algo sin verificar en logs

---

## Cross-references

- [CLAUDE.md §11](../CLAUDE.md) — Security Constitution completa
- [cross-tenant-leak.md](cross-tenant-leak.md) — runbook específico de fuga multi-tenant
- [breach-notification.md](breach-notification.md) — comunicación AAIP
- [OPERATIONAL-SEVERITY.md](../OPERATIONAL-SEVERITY.md) — calibración severidad
- ADR-0019 (security baseline F0) — S1-S16

---

*Runbook security-incident.md v1.0 — 2026-05-28*
