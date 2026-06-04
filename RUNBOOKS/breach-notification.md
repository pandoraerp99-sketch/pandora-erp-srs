# Breach Notification — Runbook

**Severidad:** S0 (cualquier breach con datos personales expuestos)
**Detección:** post-confirmación de breach (manual, después de mitigación inicial)
**SLA target F0:** notificación AAIP según B-3 abogado (conservador: 72h tipo GDPR mientras se confirme plazo AR)

> Cumplimiento Ley 25.326 + AAIP. **Wording validado con abogado del proyecto antes de enviar.** Bloqueado hasta cierre de pregunta B-3 (plazo exacto AR).

---

## Cuándo activar

Activar este runbook cuando:

1. **Cross-tenant leak confirmado** con datos personales expuestos
2. **Breach de DB** con datos personales (Supabase comprometido, leak de backup)
3. **Credentials filtradas** que dieron acceso a datos de N+ usuarios
4. **Pérdida de control de XML AFIP** con datos identificatorios
5. **Cualquier exposición** que califica como "incidente reportable" según criterio B-3 abogado

NO activar para:
- Bugs sin exposición real de datos
- Intentos de acceso bloqueados (esos van a `security-incident.md`)
- DDoS sin exposición de datos

---

## Prerequisitos antes de notificar

**ANTES de notificar a AAIP:**

1. ✅ Mitigación inicial completada ([cross-tenant-leak.md](cross-tenant-leak.md) o [security-incident.md](security-incident.md) ejecutados)
2. ✅ Evidencia preservada (snapshots audit + backups)
3. ✅ Alcance cuantificado (qué datos, cuántos titulares, ventana de tiempo)
4. ✅ Causa raíz preliminar identificada
5. ✅ Abogado del proyecto consultado sobre wording + procedimiento + plazo

**Si no tenés los 5 → no notifiques todavía.** Pero NO esperes a tener storyline perfecto — comunicar pronto + claro es mejor que tarde + completo.

---

## Información a recopilar

### Datos del incidente

| Campo | Valor |
|---|---|
| Fecha y hora de inicio del breach | |
| Fecha y hora de detección | |
| Fecha y hora de contención | |
| Tipo de breach | Cross-tenant / DB compromise / Credentials filtradas / Pérdida XML / Otro |
| Vector / causa raíz | Bug RLS / Bug Service / SQL injection / Phishing / Otro |
| Datos personales expuestos | Listar específico: CUIT comerciante, razón social, email, etc. |
| Datos sensibles expuestos (Art. 7 Ley 25.326) | Listar si aplica |
| Cantidad de titulares afectados (comerciantes) | N |
| Cantidad de clientes finales del comerciante afectados | N |
| ¿Pandora es responsable o encargado en este caso? | Encargado (default) — responsable es comerciante |
| Mitigación aplicada | Stop tenant + fix + ... |
| Comunicación al comerciante afectado | Sí/No + fecha |

---

## Procedimiento de notificación

### 1. Notificación a AAIP (Autoridad de Acceso a la Información Pública)

**Plazo:** depende del cierre de B-3 abogado. **Conservador F0: 72h desde detección** (tipo GDPR).

**Formato:** según el cierre de B-3. Hipótesis: vía TAD (Trámites a Distancia) con clave fiscal del responsable de la base.

**Información mínima** (estimada — confirmar con abogado):

```
Titular del breach: {responsable inscripto AAIP}
Encargado del tratamiento: Pandora ERP (CUIT {Pandora})

Fecha del breach: {fecha}
Fecha de detección: {fecha}
Naturaleza del breach: {descripción técnica}

Categorías de datos personales afectados:
- {Listar}

Categorías de titulares afectados:
- Comerciantes (responsables inscriptos): N
- Clientes finales: N

Consecuencias probables:
- {Listar — exposición de datos identificatorios, fiscal, etc.}

Medidas adoptadas:
- {Stop, fix, rotación, ...}

Medidas para mitigar consecuencias:
- {Notificación titulares, recomendaciones, ...}

Punto de contacto:
- {Nombre, email, teléfono}
```

### 2. Notificación al titular del dato (comerciante)

**Plazo:** ASAP (ideal mismo día de detección)

Template:

```
Estimado/a {nombre_comercio},

Te escribimos para informarte un incidente de seguridad ocurrido el {fecha}.

EN QUÉ CONSISTIÓ:
{descripción clara, sin jerga técnica}

QUÉ DATOS DE TU CUENTA ESTUVIERON AFECTADOS:
{listado específico}

QUÉ HEMOS HECHO:
- Detectamos el incidente a las {hora_detección}
- Contuvimos el problema inmediatamente
- {acciones específicas}
- Notificamos a la AAIP conforme a Ley 25.326

QUÉ PODÉS HACER:
- {acciones recomendadas: revisar cuenta, cambiar contraseña, monitorear actividad}
- {derecho a contactar AAIP si querés información adicional}

PROFUNDA DISCULPA:
Lamentamos profundamente este incidente. La seguridad de tu información
es nuestra responsabilidad y trabajaremos para evitar que esto se repita.

CONTACTO:
- {email Pandora}
- {teléfono / WhatsApp Pandora}
- Asesor legal del proyecto: {contacto abogado}

Saludos cordiales,
{Nombre owner Pandora}
```

### 3. Notificación a clientes finales del comerciante (si aplica)

Si datos de clientes finales del comerciante fueron expuestos:

- Pandora notifica al comerciante (paso 2).
- Comerciante decide si notifica a sus clientes finales (es responsable según Ley 25.326).
- Pandora provee template + ayuda al comerciante.

Template para que el comerciante envíe a su cliente final:

```
Estimado/a {nombre_cliente},

Te escribimos para informarte que el día {fecha}, debido a un incidente
en nuestro proveedor de software (Pandora ERP), datos personales tuyos
que tenemos registrados pudieron haber estado temporalmente expuestos.

DATOS AFECTADOS:
{listado}

QUÉ HICIMOS:
- El incidente fue contenido inmediatamente
- Notificamos a la AAIP
- Trabajamos con Pandora ERP para evitar recurrencia

TUS DERECHOS:
Según Ley 25.326 tenés derecho de:
- Acceder a tus datos
- Solicitar rectificación o supresión
- Contactar a la AAIP si querés información adicional

Para ejercer estos derechos contactame a {email/teléfono}.

LAMENTAMOS este incidente.

{Nombre comercio}
```

### 4. Notificación pública (post-mortem)

Considerar publicar post-mortem técnico (sin datos sensibles) en blog Pandora si:

- Incidente fue público (medios, redes sociales)
- Comunidad técnica puede aprender
- Demuestra transparencia (genera trust)

NO publicar si:
- Aún investigación activa
- Datos sensibles podrían filtrarse en el doc
- Abogado lo desaconseja

---

## Audit log de la notificación

```sql
INSERT INTO audit_log (event_name, payload, severity, actor_type, ...)
VALUES (
  'security.breach_notification_sent',
  '{
    "incident_id": "...",
    "notifications": [
      { "to": "aaip", "sent_at": "...", "method": "tad", "tracking_id": "..." },
      { "to": "comerciante_tenant_uuid", "sent_at": "...", "method": "email" },
      { "to": "clientes_finales_via_comerciante", "instruction_sent_at": "..." }
    ],
    "runbook": "breach-notification.md"
  }',
  'critical',
  'operator',
  ...
);
```

---

## Seguimiento

### 1. Confirmación de recepción AAIP

Si AAIP confirma recepción → guardar comprobante.

Si AAIP solicita información adicional → responder en plazo.

### 2. Acciones correctivas tracked

Plan de acciones correctivas con responsable + plazo + status:

| Acción | Responsable | Plazo | Status |
|---|---|---|---|
| Fix del bug | Pandora team | {fecha} | done/pending |
| Rotar credentials afectados | Pandora team | {fecha} | done/pending |
| Test que reproduce vulnerabilidad | Pandora team | {fecha} | done/pending |
| Mejora del runbook | Pandora team | {fecha} | done/pending |
| Revisión arquitectónica de área afectada | Pandora team | {fecha} | done/pending |

### 3. Reporte a AAIP de cierre

Cuando se completaron acciones correctivas, reportar cierre del incidente a AAIP (si así lo requirieron).

---

## Decisiones que dependen de B-3 abogado (pendiente)

| Decisión | Hipótesis F0 conservadora | A confirmar B-3 |
|---|---|---|
| Plazo notificación a AAIP | 72h tipo GDPR | Plazo legal AR exacto |
| Formato notificación | Texto + datos estructurados vía TAD | Formulario AAIP específico o template oficial |
| Qué califica como reportable | Cualquier exposición de datos personales | Lista oficial AAIP de categorías |
| Notificación al titular | Sí, plazo razonable (días) | Plazo legal AR |
| Pandora como encargado vs responsable | Encargado (responsable es comerciante) | Caso por caso |

---

## Cross-references

- [CLAUDE.md §11.12](../CLAUDE.md) — pendientes seguridad abogado
- [cross-tenant-leak.md](cross-tenant-leak.md) — runbook que típicamente activa este
- [security-incident.md](security-incident.md) — runbook predecesor
- ADR-0019 S11 — pendiente cerrar plazo AAIP
- Pregunta B-3 advisor doc — plazo + formato

---

*Runbook breach-notification.md v1.0 — 2026-05-28. NO enviar sin abogado validando wording.*
