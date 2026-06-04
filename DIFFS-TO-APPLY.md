# DIFFs pendientes de aplicar — sesión 2026-05-26

> Estos cambios son para archivos que **no están físicamente** en `c:\Users\Pandora\Desktop\SRS\` (probablemente viven en `~/workspace/pandora-erp/.claude/` en WSL o similar). Aplicar manualmente o vía el otro chat.

---

## DIFF 1 — `CLAUDE.md` — fix paths + descripciones ADRs

### Cambio 1.1 — Path correcto de ADRs

**Buscar:**
```
| **17 ADRs** | `c:\Users\Pandora\Desktop\SRS\adr/` | Decisiones arquitectónicas formales (ADR-0001 a ADR-0017) |
```

**Reemplazar por:**
```
| **21 ADRs** | `c:\Users\Pandora\Desktop\SRS\files\` | Decisiones arquitectónicas formales (ADR-0001 a ADR-0021) |
```

### Cambio 1.2 — Tabla "ADRs vigentes" actualizada con descripciones REALES

**Buscar la sección actual** (que lista 20 ADRs con descripciones que NO coinciden con los filenames físicos) y **reemplazar por:**

```markdown
## ADRs vigentes (resumen ejecutivo)

| ID | Decisión | Lectura obligatoria si tocás... |
|---|---|---|
| ADR-0001 | Stack F0 (Next.js + Supabase + Drizzle + TS strict) | Setup inicial / stack |
| ADR-0002 | Multi-tenant: RLS + Application Service validation | Cualquier query con tenant |
| ADR-0003 | Application Services en TypeScript, no plpgsql | Cualquier lógica de negocio |
| ADR-0004 | AFIP WSFEv1 sincrónico 30s + reconciliación async | AFIP integration |
| ADR-0005 | Money: numeric(19,4) + Decimal.js + redondeo configurable | Cualquier cálculo monetario |
| ADR-0006 | Numeración fiscal correlativa con SELECT FOR UPDATE | Facturación |
| ADR-0007 | Monolito modular (no microservicios) | Arquitectura |
| ADR-0008 | Contador con acceso multi-empresa vía JWT | Módulo contador |
| ADR-0009 | Feature flags por tenant desde Fase 0 | Rollout gradual de features |
| ADR-0010 | Idempotencia obligatoria en mutaciones públicas | Cualquier mutation crítica |
| ADR-0011 | Retry serializable con backoff (decorrelated jitter) | Workers, retries |
| ADR-0012 | Sistema de 3 atmospheres (Atmosphere/Operational/Critical) | UI |
| ADR-0013 | Glass system con degradación hardware | UI Atmosphere |
| ADR-0014 | Charts SVG puros (no Recharts ni libs pesadas) | Visualizaciones |
| ADR-0015 | Motion presets nombrados | Animaciones UI |
| ADR-0016 | Dawn Sky identidad permanente F0 | UI / branding |
| ADR-0017 | Density obligatoria por atmosphere | Componentes |
| ADR-0018 | Stack bump mayo 2026 (Next 14→16, Tailwind 3→4) | Versiones de dependencias |
| ADR-0019 | Security baseline F0 (CSP, HMAC, rate limit, anti-tampering) | Cualquier endpoint público |
| ADR-0020 | Política de demo expirado (modo lectura 60d + archivo día 82) | Onboarding / demo lifecycle |
| ADR-0021 | Money client-side con Decimal.js + Context injection | UI POS / cálculos cliente |
```

### Cambio 1.3 — Referencia a documentos consolidados

**Buscar:**
```
**Source of truth jerárquico:**
1. ADRs (la palabra final cuando hay conflicto)
2. SRS v3.0 + Sesión 5 v4
3. CLAUDE.md (este archivo, instrucciones operativas)
4. external-reviews/ (referencia, NO autoritativo)
```

**Reemplazar por:**
```
**Source of truth jerárquico:**
1. `DECISION-LEDGER.md` (índice maestro — gana en caso de conflicto)
2. ADRs físicos en `files/ADR-*.md`
3. SRS v3.0 + Sesión 5 v4
4. `AUTHORITY-MAP.md` (matriz de quién decide qué)
5. CLAUDE.md (este archivo, instrucciones operativas)
6. `backlog-validaciones.md` (items deferidos con triggers)
7. `external-reviews/` (referencia histórica, NO autoritativo)

Si CLAUDE.md contradice DECISION-LEDGER.md: el ledger gana. Reportá la inconsistencia.
```

### Cambio 1.4 — Estado del proyecto actualizado

**Buscar:**
```
- **Última versión SRS:** v3.0 + Sesión 5 v4 (CONGELADO)
- **Fase actual:** Fase 0 — desarrollo activo
- **Próximo milestone:** primer flujo POS + facturación AFIP homologación
- **Validaciones pendientes:** 4 BloqueanteCode + 38 BloqueanteProd (ver Sesión 5 v4 Apéndice)
```

**Reemplazar por:**
```
- **Última versión SRS:** v3.0 + Sesión 5 v4 (CONGELADO)
- **Fase actual:** Fase 0 — pre-código, cierre arquitectónico completado 2026-05-26
- **Próximo milestone:** validaciones humanas (contador + abogado) + setup técnico W3
- **Validaciones activas F0:** 4 BloqueanteCode + 10 BloqueanteProd reducido (ver `backlog-validaciones.md` para resto)
- **ADRs vigentes:** 21 (ver `DECISION-LEDGER.md`)
- **Decisiones abiertas 🟡:** ADR-0005 (redondeo), validez ticket no fiscal (deep research)
```

---

## DIFF 2 — `.claude/commands/explain-srs.md` — fix path

**Buscar:**
```
- Después en `c:\Users\Pandora\Desktop\SRS\adr/*.md`
```

**Reemplazar por:**
```
- Después en `c:\Users\Pandora\Desktop\SRS\files\ADR-*.md`
```

**También buscar (si existe):**
```
- Primero buscar en `c:\Users\Pandora\Desktop\SRS\PANDORA_ERP_SRS_v3.0.md`
```

**Y agregar a la lista:**
```
- Si trata de ADRs físicos: confirmar contenido leyendo el file. Las descripciones del CLAUDE.md pueden estar desactualizadas — el DECISION-LEDGER.md es la fuente de verdad sincronizada con los filenames.
```

---

## DIFF 3 — `.claude/rules/02-multi-tenant.md` — fix campo log

**Buscar (en el helper `assertCompanyMatches`):**
```typescript
function assertCompanyMatches(ctxCompanyId: string, recordCompanyId: string) {
  if (ctxCompanyId !== recordCompanyId) {
    logger.error({
      level: 'sensitive_pii',
      event: 'cross_tenant_attempt_detected',
      ctx_company_id: ctxCompanyId,
      record_company_id: recordCompanyId,
      severity: 'critical',
    });
    throw new CrossTenantAccessError();
  }
}
```

**Reemplazar `level: 'sensitive_pii'` por `pii_level: 'sensitive_pii'`:**

```typescript
function assertCompanyMatches(ctxCompanyId: string, recordCompanyId: string) {
  if (ctxCompanyId !== recordCompanyId) {
    logger.error({
      pii_level: 'sensitive_pii',  // FIX: pii_level (clasificación), no level (nivel pino)
      event: 'cross_tenant_attempt_detected',
      ctx_company_id: ctxCompanyId,
      record_company_id: recordCompanyId,
      severity: 'critical',
    });
    throw new CrossTenantAccessError();
  }
}
```

`level` es nivel pino (info/warn/error). `pii_level` es clasificación de sensibilidad para retención. Mezclarlos rompe el filtrado de retention policy.

---

## DIFF 4 — `srs-sesion-5-validaciones-v4.md` — eliminar DUAL_WRITE + reducir apéndice

### Cambio 4.1 — Eliminar plan DUAL_WRITE del Cambio #1

**Buscar la sección completa que dice:**
```
#### Plan de transición DUAL_WRITE (release R+1 a R+2)
```

**Y todo el contenido hasta el inicio de "### Nuevas máquinas de estado", reemplazar por:**

```
#### NOTA (auditoría 2026-05-26): DUAL_WRITE eliminado

La versión original de este cambio planteaba un plan DUAL_WRITE de 3 sprints
para migrar código legacy a las columnas nuevas `commercial_status` +
`fiscal_status`. **Esto se eliminó porque NO HAY CÓDIGO LEGACY:** el proyecto
está pre-código.

**Acción real F0:** crear las columnas `commercial_status` + `fiscal_status`
desde la primera migración. El campo `status` legacy NO existe — no hay
que migrarlo.

El helper `deriveLegacyStatus()` y la ESLint rule que bloquea `sales.status`
también se eliminan: defienden contra problemas que no existen porque la
tabla `status` legacy nunca se crea.

Detalle del plan DUAL_WRITE original archivado en commit anterior (ver
git history si se necesita revivir cuando aparezca migración real).
```

### Cambio 4.2 — Reducir apéndice de 110 → 14 items activos

**Buscar la sección:**
```
## Resumen de items por subtipo (reclasificación v4)
```

**Reemplazar por:**
```
## Resumen de items por subtipo (auditoría 2026-05-26)

| Subtipo | Cantidad activa F0 | Diferidos a backlog |
|---|---|---|
| 🔴 BloqueanteCode | 4 | 0 |
| 🔴 BloqueanteProd | 10 (reducido de 38) | 28 |
| 🟡 Importante | 0 (movidos al backlog) | 62 |
| ⚪ Nice-to-have | 0 (movidos al backlog) | 6 |
| **TOTAL** | **14** | **96** |

Items activos F0 listados abajo. Items diferidos en `../backlog-validaciones.md`
con triggers para promoverlos cuando aparezca señal real.

### Items activos F0

**🔴 BloqueanteCode (4) — validar antes de tipear código relacionado**

1. A1.1 — ¿Es "asesoramiento contable automatizado"?
2. A1.3 — ¿Qué operaciones NO automatizar?
3. B1.1 — Responsabilidad civil ante error fiscal automatizado
4. B4.1 — Qué pasa legalmente ante fuga cross-tenant

**🔴 BloqueanteProd (10) — validar antes del primer cliente real**

5. A2.1 — Política de redondeo (HALF_UP/DOWN/EVEN)
6. A2.2 — Cálculo IVA por línea o por total
7. A2.10 — Ticket no fiscal post 2h: ¿válido? (deep research dice NO)
8. A2.11 — Campos customer_snapshot por tipo A/B/C
9. A2.12 — Política CUIT por capas
10. A6.1 — Documentos que requieren conservación legal exhaustiva
11. B2.7 — Inscripción AAIP obligatoria + cronograma
12. B4.4 — Notificación obligatoria a AAIP ante breach + plazo
13. C3.5 — Validar pricing $25k / $60k ARS
14. D.1 — Qué cosas hacen manualmente porque no confían en sistemas
```

### Cambio 4.3 — Header de versión

**Actualizar el header de Sesión 5 v4 para reflejar la auditoría:**

**Buscar:**
```
**Versión:** v4 — congelada
```

**Reemplazar por:**
```
**Versión:** v4 — congelada base + auditoría 2026-05-26 (DUAL_WRITE eliminado, apéndice reducido)
```

---

## DIFF 5 — Resto de rules (`.claude/rules/03-fiscal.md`, etc) — fix referencia a ADRs reasignados

### En `03-fiscal.md`

**Buscar referencias a ADR-0020 que hablen de "Performance" o "client patterns":**

No debería haber, pero si las hay, **reemplazar** por referencias a **ADR-0021**.

### En cualquier rule que mencione "ADR-0020 demo expirado"

**Mantener** — esa referencia es correcta ahora.

---

## Checklist de aplicación

Cuando estés en la máquina con WSL o el otro chat con los archivos físicos:

- [ ] Aplicar DIFF 1 (CLAUDE.md — paths + tabla ADRs + estado proyecto)
- [ ] Aplicar DIFF 2 (explain-srs.md — fix path)
- [ ] Aplicar DIFF 3 (02-multi-tenant.md — fix level → pii_level)
- [ ] Aplicar DIFF 4 (Sesión 5 v4 — eliminar DUAL_WRITE + reducir apéndice)
- [ ] Aplicar DIFF 5 (otros rules — verificar referencias a ADR-0020)
- [ ] Verificar que `ADR-0018`, `ADR-0019`, `ADR-0020`, `ADR-0021` están sincronizados entre filesystem (`c:\Users\Pandora\Desktop\SRS\files\`) y el repo del proyecto si hay duplicación

---

## Archivos nuevos creados en esta sesión (`c:\Users\Pandora\Desktop\SRS\`)

| Archivo | Propósito |
|---|---|
| `files/ADR-0018-stack-bump-may-2026.md` | Formalizar Next 14→16, Tailwind 3→4 |
| `files/ADR-0019-security-baseline-f0.md` | Baseline de seguridad mínima F0 |
| `files/ADR-0020-demo-expired-policy.md` | Demo lifecycle (recupera decisión 2026-05-21 de memoria) |
| `files/ADR-0021-money-client-side.md` | Money cliente (era ADR-0020 v3, ahora simplificado) |
| `DECISION-LEDGER.md` | Source of truth de qué decisión está dónde |
| `AUTHORITY-MAP.md` | Matriz de autoridades del sistema |
| `backlog-validaciones.md` | 96 items deferidos con triggers |
| `DIFFS-TO-APPLY.md` | Este archivo |

## Archivo eliminado

- `files/ADR-0020-performance-client-patterns-pos.md` (su contenido pasó a ADR-0021)

---

## DIFF 6 — `.claude/rules/04-observability.md` — agregar 4 métricas fiscales (ADR-0022)

Agregar nueva sección **al final** del archivo:

```markdown
## Métricas fiscales obligatorias (ADR-0022)

Toda emisión de comprobante fiscal debe emitir las siguientes 4 métricas básicas para detectar bugs fiscales silenciosos. Sin estas, los bugs son acumulativos y caros de diagnosticar.

### `invoice_rounding_delta`

Diferencia (en centavos) entre lo que daría el cálculo per-line y per-total del mismo comprobante.

```typescript
metric('invoice_rounding_delta', {
  mode: 'HALF_EVEN',
  stage: 'PER_LINE',
  delta_cents: Number,        // signed: positivo = per-line > per-total
  sale_id: String,
});
```

**Alerta:** distribución sesgada > 5% en una dirección (siempre positivo o siempre negativo) → posible bug en el algoritmo.

### `afip_rejection_rate`

Tasa de rechazos del web service AFIP por código de error.

```typescript
metric('afip_rejection_rate', {
  error_code: String,         // ej: '10015', 'N/A'
  sale_point: Number,
  wsfe_version: 'WSFEv1',
  result: 'accepted' | 'rejected' | 'observed',
});
```

**Alerta:** > 5% de rechazos por código específico en 1 hora → bug fiscal en cierto tipo de comprobante.

### `reconciliation_mismatch`

Diferencia entre lo que un sistema externo reportó vs lo registrado en Pandora.

```typescript
metric('reconciliation_mismatch', {
  source: 'mercadopago' | 'bank' | 'manual' | 'afip',
  delta_cents: Number,
  within_tolerance: boolean,  // true si pasa withinTolerance() con default ±$0.50
});
```

**Alerta:** mismatch sostenido > $1000 acumulado en 24h → investigar.

### `iva_delta_distribution`

Distribución del residuo de IVA después del redondeo por alícuota.

```typescript
metric('iva_delta_distribution', {
  tax_rate: Number,           // 21.0, 10.5, 27.0, 0.0
  sign: 'positive' | 'negative' | 'zero',
});
```

**Alerta:** distribución no aproximadamente uniforme entre positive/negative → sesgo sistemático del algoritmo de redondeo.

### Implementación

Estas métricas se persisten en tabla `fiscal_metrics` (F0) o se envían a OpenTelemetry (F1+). La frecuencia es por emisión, no batch.

### Triggers para revisión

- `invoice_rounding_delta` distribución sesgada > 5% → auditar implementación
- `afip_rejection_rate` por código específico > 5% en 1h → investigar
- `reconciliation_mismatch` sostenido > $1000 acumulado 24h → investigar
- `iva_delta_distribution` no uniforme → posible bug HALF_EVEN

## PII fiscal expandida — lista explícita de prohibidos (ADR-0019 audit 2026-05-26)

Agregar a la sección de Sentry scrubbing + redaction list de Pino logger:

### Datos prohibidos en logs (lista canónica)

**NUNCA loggear en plain text, ni en mensajes de error, ni en breadcrumbs, ni en traces:**

| Categoría | Ejemplos | Razón |
|---|---|---|
| Credenciales WSAA | `Token`, `Sign` (XML completos o parciales) | Autorización fiscal delegada — robo permite emisión |
| Certificados AFIP X.509 | Cualquier cert (private key, public key, o cert bytes completos) | Identidad fiscal del tenant |
| Private keys | Cualquier private key (AFIP, JWT, encryption) | Acceso total al sistema o identidad |
| Payloads fiscales completos | Request/response XML completos a WSFEv1 | Pueden contener CUIT, montos, datos cliente, certs en headers |
| CUIT completos | `20-12345678-3` plain | Identificador personal (Ley 25.326) |
| Datos tarjeta | PAN, CVV, expiry | PCI obligatorio + Ley 25.326 |
| Tokens MercadoPago | Access tokens long-lived | Acceso a cobros |
| Tokens WhatsApp Business | Access tokens | Acceso a comunicación |
| Direcciones completas | "Av. Corrientes 1234 Piso 5 Dto B" | PII (Ley 25.326) |

### Redacción canónica al loggear

Si un objeto puede contener datos sensibles, usar helpers de masking ANTES de loggear:

```typescript
// ✅ CORRECTO
logger.info({
  pii_level: 'pii',
  event: 'afip.cae_received',
  company_id: ctx.companyId,        // OK — UUID
  invoice_id: result.invoice.id,    // OK — UUID
  cuit_masked: maskCuit(result.customer.cuit),  // 20-XXXX-3
  cae: result.cae,                  // OK — CAE no es secreto
  amount_masked: maskAmount(result.total),      // $XX,XXX
});

// ❌ PROHIBIDO
logger.info(`Customer ${customer.cuit} got CAE ${result.cae} for $${result.total}`);
logger.error(error);  // si error.message contiene payload completo
```

### Sentry — beforeSend expandido

```typescript
const FISCAL_SENSITIVE_KEYS = [
  ...SENSITIVE_KEYS,  // existing
  'wsaa_token', 'wsaa_sign', 'token', 'sign',
  'cert', 'certificate', 'private_key', 'x509',
  'xml_request', 'xml_response',
  'cae',  // OK loggearlo per se, pero junto con CUIT del cliente = pii
];
```

Aplicar **al final** del archivo `.claude/rules/04-observability.md`.
```

**Aplicar al final del archivo `.claude/rules/04-observability.md`.**

---

## DIFF 7 — `CLAUDE.md` — actualizar tabla ADRs con ADR-0022

Después de aplicar el DIFF 1 (que ya hace varios cambios al CLAUDE.md), agregar al final de la tabla "ADRs vigentes":

```markdown
| ADR-0022 | Fiscal Projection Layer + Fiscal Snapshot + versioning | Módulo fiscal / payload WSFEv1 / reproducibilidad histórica |
```

Y actualizar el conteo "21 ADRs" → "22 ADRs" en la fila correspondiente.

---

## Resumen final de archivos creados/modificados en sesiones 2026-05-26

| Archivo | Estado |
|---|---|
| `files/ADR-0005-money-numeric-19-4.md` | Modificado (Dimensión 1 cerrada HALF_EVEN, rounding stages, invariants, currency F0, snapshot reference) |
| `files/ADR-0018-stack-bump-may-2026.md` | Creado |
| `files/ADR-0019-security-baseline-f0.md` | Modificado (threat model, S3-bis replay, S5-bis key rotation, S12 session, S13 secrets, S14 backup) |
| `files/ADR-0020-demo-expired-policy.md` | Creado |
| `files/ADR-0021-money-client-side.md` | Creado (D2/D3/D4 deferred F1+) |
| `files/ADR-0022-fiscal-projection-layer.md` | Creado (NUEVO 2026-05-26 noche) |
| `files/ADR-0020-performance-client-patterns-pos.md` | Eliminado (contenido movido a ADR-0021) |
| `DECISION-LEDGER.md` | Creado + actualizado 2x |
| `AUTHORITY-MAP.md` | Creado + actualizado 2x |
| `backlog-validaciones.md` | Creado + items A2.17/A2.18/A2.19 nuevos |
| `DIFFS-TO-APPLY.md` | Creado + DIFF 6/7 agregados |
| `reunion-contador-y-abogado.md` | Renombrado desde `reunion-contador-advisor.md` 2026-05-27 + Parte B abogado nueva (10 preguntas: responsabilidad civil, AAIP inscripción, breach notification, fuga cross-tenant, conservación legal, ticket no fiscal legal, T&C, DPA/PrivacyPolicy, mapping legal PII, ARCO) + Parte A Dimensión 1 informativa, Dimensión 2 explícita, pregunta TDF, conciliación contable |
