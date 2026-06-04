# CLAUDE.md — Pandora ERP

**Versión:** 1.1.0
**Fecha:** 2026-05-28
**Estado:** vigente
**Propósito:** documento operativo central que gobierna evolución arquitectónica, restricciones de implementación, disciplina técnica, consistencia fiscal, coherencia visual, gobernanza documental y ejecución de sesiones futuras de Pandora ERP.

> Este archivo NO es una README. NO es marketing. NO es documentación aspiracional. Es el **sistema nervioso operativo** del proyecto: cualquier sesión futura (humano o IA) debe respetarlo como contrato.

> **Si este documento contradice algo, el [DECISION-LEDGER.md](DECISION-LEDGER.md) gana.** Reportar la inconsistencia, abrir issue, resincronizar.

---

## ÍNDICE

1. [Executive Context](#1-executive-context)
2. [Authority Map](#2-authority-map)
3. [Decision Registry Snapshot](#3-decision-registry-snapshot)
4. [Product Philosophy](#4-product-philosophy)
5. [Scope Discipline](#5-scope-discipline)
6. [Architecture Constitution](#6-architecture-constitution)
7. [Multi-Tenant Constitution](#7-multi-tenant-constitution)
8. [Fiscal Constitution](#8-fiscal-constitution)
9. [Money & Calculation Constitution](#9-money--calculation-constitution)
10. [Observability Constitution](#10-observability-constitution)
11. [Security Constitution](#11-security-constitution)
12. [State Machine Constitution](#12-state-machine-constitution)
13. [Reliability & Recovery Constitution](#13-reliability--recovery-constitution)
14. [UI/UX Constitution](#14-uiux-constitution)
15. [Backend Execution Rules](#15-backend-execution-rules)
16. [Database Constitution](#16-database-constitution)
17. [Integration Constitution](#17-integration-constitution)
18. [Testing Constitution](#18-testing-constitution)
19. [Documentation Governance](#19-documentation-governance)
20. [Anti-Patterns Catalog](#20-anti-patterns-catalog)
21. [Evolution Path Strategy](#21-evolution-path-strategy)
22. [Session Execution Protocol](#22-session-execution-protocol)
23. [Apéndice — Filesystem Map](#23-apéndice--filesystem-map)

---

# 1. Executive Context

## 1.1 Qué es Pandora ERP

SaaS POS + ERP fiscal argentino, multi-tenant, target inicial **retail pequeño de Tierra del Fuego** (kioscos, ferreterías, mercerías, panaderías locales). Reemplaza la combinación operativa típica "Excel + facturador RCEL + Tango/Bejerman" con una sola herramienta integrada.

## 1.2 Target real F0 (CONFIRMADO 2026-05-27)

- **Geografía:** Tierra del Fuego (Río Grande / Ushuaia). Owner técnico vive en TDF. Primeros 5 clientes piloto son comercios fueguinos reales.
- **Tamaño:** 1-3 empleados por comercio. 1-2 cajas POS. Volumen 30-200 ventas/día.
- **Régimen fiscal típico:** Responsable Inscripto IVA + Ley 19.640 (TDF) para mercadería amparada. Algunos Monotributo.
- **Tipo de venta:** consumidor final mayoritario (>80%) + facturación B/A esporádica para clientes B2B.
- **NO es target F0:** restaurantes (lógica de mesa/comanda), industria (manufactura/MRP), e-commerce puro, exportadores.

## 1.3 Diferenciadores no negociables

1. **POS premium real** — UX rápida, keyboard-first, sin freezes, sin retrabajo cuando AFIP falla.
2. **Contador integrado gratuito multi-empresa** — el contador del comercio entra con un login y ve N empresas que lo invitaron.
3. **AFIP/ARCA nativo desde día 1** — no add-on. WSAA + WSFEv1 + Padrón A5 + Régimen Transparencia Fiscal Ley 27.743 desde el primer commit productivo.
4. **Identidad visual Dawn Sky** — 3 atmospheres, glass system degradado por hardware, charts SVG puros. Distingue a Pandora de cualquier ERP genérico.

## 1.4 Métricas de éxito F0

- **5 clientes pagando** en 14-16 semanas desde inicio de código productivo.
- **Cero errores fiscales** (CAEs rechazados por bug nuestro, números quemados por error de software, IVA mal calculado).
- **Cero fugas cross-tenant.**
- **<3s latencia P95 de venta cobrada** (desde click "cobrar" hasta CAE devuelto en happy path).
- **>99% disponibilidad** del POS web (incluye degradación elegante si AFIP cae).

## 1.5 Pricing (memoria histórica — ajustable post-piloto)

- Kiosco / mercería chica: ARS ~25.000/mes
- Ferretería / comercio medio: ARS ~60.000/mes
- Validación final con clientes piloto reales TDF.

## 1.6 Stack tecnológico de superficie (detalle completo en §6)

Next.js 16 + React 19 + TypeScript 5.9 strict · Tailwind 4 + shadcn/ui · Supabase (Postgres 16 + Auth + Storage + RLS) · Drizzle ORM · jose (JWT) · zod · decimal.js · Pino + Sentry · Vitest + fast-check · Vercel (deploy F0) · Cron Vercel para workers F0.

## 1.7 Filosofía permanente

- **El comerciante primero.** Si la decisión técnica empeora la operación real de un kiosco a las 11pm con cola de gente, la decisión técnica está mal.
- **El contador como aliado.** Vista contable separada, datos exportables, motivos auditables.
- **Integridad fiscal > velocidad de feature.** Mejor pasar un día más en spec fiscal que tener que rectificar 500 facturas.
- **Operación real > tecnología cool.** No microservicios. No event sourcing F0. No CQRS. No Kubernetes. Sí monolito modular bien estructurado.
- **Auditabilidad sin opción.** Cada cambio sensible deja huella inmutable. Decir "no se loguea" debe ser una decisión deliberada y documentada.
- **Fail-closed fiscal.** Ante incertidumbre fiscal, NO emitir. Siempre.

## 1.8 Lo que Pandora NUNCA será

- ERP enterprise genérico universal
- Sistema manufacturero / MRP
- E-commerce
- Plataforma blockchain
- Software contable completo (es POS+ERP, no SAP Business One)
- Sistema gastronómico especializado (sin gestión de mesa, comanda, cocina)
- Solución multi-país temprana (AR-only hasta F2+ con cliente real que pague)
- Ecosistema de microservicios

Si alguien (humano o IA) propone llevar Pandora hacia uno de esos territorios sin un cliente real que pague por ello, la propuesta se rechaza y se documenta en [over-engineering rejected memory].

---

# 2. Authority Map

## 2.1 Jerarquía documental (orden de autoridad)

| Nivel | Documento | Cuando manda |
|---|---|---|
| 1 | **[DECISION-LEDGER.md](DECISION-LEDGER.md)** | SIEMPRE. Source of truth absoluto. |
| 2 | **[AUTHORITY-MAP.md](AUTHORITY-MAP.md)** | Para conflictos de autoridad de recursos/estados (quién decide qué). |
| 3 | **ADRs aprobados** (`files/ADR-*.md`) | Decisiones arquitectónicas formales. |
| 4 | **[EVENT-TAXONOMY.md](EVENT-TAXONOMY.md)** v2.0.1 | Catálogo canónico de eventos del sistema. |
| 5 | **[CORRELATION-PROPAGATION.md](CORRELATION-PROPAGATION.md)** v1.0.0 | Tracing end-to-end. |
| 6 | **[RECONCILIATION-ENGINE.md](RECONCILIATION-ENGINE.md)** v1.0.0 | Resolución de incertidumbre fiscal. |
| 7 | **[PANDORA_ERP_SRS_v3.0.md](PANDORA_ERP_SRS_v3.0.md)** (+ partes 2, 3) | Source of truth principal del producto (congelado). |
| 8 | **Sesión 5 v4** (vive en WSL `~/workspace/pandora-erp/.claude/`) | Patch incremental con validaciones humanas. |
| 9 | **[NON-GOALS.md](NON-GOALS.md)** v1.0.0 | Lo que Pandora NO va a ser. Defensa anti-scope-explosion. |
| 10 | **[CAPABILITY-MAP.md](CAPABILITY-MAP.md)** v1.0.0 | Qué hace Pandora (65 capabilities × 8 dominios). |
| 11 | **[BOUNDED-CONTEXTS.md](BOUNDED-CONTEXTS.md)** v1.0.0 | Cómo se estructura el código (14 contexts + 8 reglas anti-acoplamiento). |
| 12 | **[OPERATIONAL-SEVERITY.md](OPERATIONAL-SEVERITY.md)** v1.0.0 | Matriz S0-S4 + impacto operativo. |
| 13 | **[MONEY-POLICY.md](MONEY-POLICY.md)** v1.0.0 | Consolidación monetaria (referencia rápida). |
| 14 | **[RUNBOOKS/](RUNBOOKS/)** | Playbooks de incidentes (afip-outage, cross-tenant-leak, etc.). |
| 15 | **[ROADMAP.md](ROADMAP.md)** v1.0.0 | Roadmap operativo: 11 sprints quirúrgicos con deliverables + tests + gating + métricas + plan B. Target 14-16 semanas solo-dev. |
| 16 | **`.claude/rules/01-05-*.md`** | Reglas operativas (vive en WSL `.claude/rules/`). |
| 17 | **[backlog-validaciones.md](backlog-validaciones.md)** | 69 items diferidos con triggers explícitos para promoción (41 activos F0 + 69 diferidos = 110 originales de Sesión 5 v4). |
| 18 | **[reunion-contador-y-abogado.md](reunion-contador-y-abogado.md)** | Guion de reuniones para items abiertos contador / abogado. |
| 19 | Ideas futuras NO aprobadas | Sin autoridad. Van al backlog o se rechazan. |

## 2.2 Regla crítica de conflicto

**Si cualquier documento contradice el Decision Ledger:**

1. El Ledger gana siempre.
2. La contradicción debe reportarse explícitamente en la sesión donde se detectó.
3. Debe marcarse en el doc inconsistente (comentario inline o sección dedicada).
4. Debe proponerse resincronización del doc inconsistente al ledger.
5. NO asumir consistencia implícita. NO armonizar silenciosamente.

## 2.3 Tabla maestra de autoridades de recursos/estados

Ver [AUTHORITY-MAP.md](AUTHORITY-MAP.md) — define quién es autoridad final por recurso. Ejemplos críticos:

- **Money** → Server (cliente sólo preview)
- **CAE de factura** → AFIP (Pandora registra, no decide)
- **Stock disponible** → Server con lock pesimista
- **Transiciones `fiscal_status`** → Worker `afip-reconcile-pending` (o handlers de emisión inicial)
- **Recovered CAE post-timeout** → `validateRecoveredCae()` con match obligatorio
- **Permisos del usuario** → Server (cache cliente sólo para UX)
- **Modo contingencia AFIP** → Server (no cliente)
- **Customer snapshot** → Server, inmutable post-emisión

## 2.4 Cómo registrar cambios

| Acción | Pasos obligatorios |
|---|---|
| **Crear ADR nuevo** | (1) Verificar que no hay ADR previo cubriéndolo. (2) Crear `files/ADR-NNNN-slug.md` con numeración secuencial. (3) Agregar fila en DECISION-LEDGER tabla "ADRs vigentes". (4) Si introduce autoridad nueva, agregar en AUTHORITY-MAP. (5) Si cambia rules, actualizar `.claude/rules/`. (6) Verificar que CLAUDE.md no quede inconsistente. |
| **Cerrar decisión 🟡 → 🟢** | (1) Actualizar campo "Validación" en DECISION-LEDGER. (2) Mover de "Decisiones abiertas críticas" a "Decisiones cerradas". (3) Actualizar ADR relacionado. (4) Si elimina pregunta del advisor doc, marcarla como CERRADA con fuente y fecha. |
| **Promover item del backlog** | (1) Verificar trigger objetivo cumplido (cliente real, métrica cruzada, normativa). (2) Mover de `backlog-validaciones.md` a Sesión 5 v4 con justificación. (3) Crear ADR si introduce arquitectura nueva. (4) Actualizar DECISION-LEDGER. |
| **Cambiar stack** | (1) ADR de stack bump (modelo: ADR-0018). (2) Actualizar `.claude/rules/01-stack.md`. (3) Actualizar §6 de este doc. |
| **Renombrar doc** | (1) Cambiar archivo físico. (2) `grep` global de referencias en todos los docs + memorias. (3) Replace_all en cada uno. (4) Documentar rename en DIFFS-TO-APPLY.md o equivalente. |

## 2.5 Cómo manejar validaciones humanas pendientes

Pandora tiene validaciones que dependen de **profesionales externos** (contador matriculado, abogado AAIP). Mientras estén abiertas:

- El ADR queda en estado **🟡 (pendiente validación humana)** en la columna "Validación" del DECISION-LEDGER.
- El código que dependa de esa validación NO se escribe — se documenta como blocker en TODO/comentario.
- Si la implementación NO depende directamente (ej: schema preparado para ambas opciones), se puede avanzar con la opción más conservadora marcada como "subject to change".
- Las preguntas concretas viven en [reunion-contador-y-abogado.md](reunion-contador-y-abogado.md).

---

# 3. Decision Registry Snapshot

## 3.1 ADRs activos (22 vigentes — fuente: filesystem real `files/ADR-*.md`)

| ID | Tema | Estado | Validación |
|---|---|---|---|
| ADR-0001 | Stack tecnológico F0 (Next.js + Supabase + Drizzle) | Aprobado | 🟢 |
| ADR-0002 | Multi-tenant: RLS + `auth.jwt() ->> 'company_id'` | Aprobado | 🟢 |
| ADR-0003 | Application Services TypeScript, NO plpgsql para lógica de negocio | Aprobado | 🟢 |
| ADR-0004 | AFIP WSFEv1 sincrónico timeout 30s + reconciliación async | Aprobado | 🔴 **parcialmente invalidado** por hallazgo oficial 2026-05-27 (ver §8) |
| ADR-0005 | Money: `numeric(19,4)` + Decimal.js + HALF_EVEN | Aprobado | 🟡 (stage redondeo pendiente contador) |
| ADR-0006 | Numeración fiscal SELECT FOR UPDATE | Aprobado | 🟢 |
| ADR-0007 | Monolito modular (NO microservicios F0) | Aprobado | 🟢 |
| ADR-0008 | Contador multi-empresa vía JWT array `company_ids[]` | Aprobado | 🟢 |
| ADR-0009 | Feature flags por tenant | Aprobado | 🟢 |
| ADR-0010 | Idempotency obligatoria en mutations críticas | Aprobado | 🟢 |
| ADR-0011 | Retry serializable con backoff | Aprobado | 🟢 |
| ADR-0012 | Sistema de 3 atmospheres visuales (Operational/Insight/Ceremonial) | Aprobado | 🟢 |
| ADR-0013 | Glass system con degradación por hardware | Aprobado | 🟢 |
| ADR-0014 | Charts SVG puros (NO Recharts, NO D3 F0) | Aprobado | 🟢 |
| ADR-0015 | Motion presets nombrados (NO animaciones ad-hoc) | Aprobado | 🟢 |
| ADR-0016 | Dawn Sky identidad permanente F0 | Aprobado | 🟢 |
| ADR-0017 | Density obligatoria por atmosphere | Aprobado | 🟢 |
| ADR-0018 | Stack bump may-2026 (Next 14→16, Tailwind 3→4) | Aprobado | 🟢 |
| ADR-0019 | Security baseline F0 (CSP, HMAC, rate limit, TLS 1.2+, NTP, secret lifecycle, threat model) | Aprobado | 🟡 (B2.7 AAIP + B4.4 breach plazo pendientes abogado) |
| ADR-0020 | Política demo expirado (modo lectura 60d, archivo día 82) | Aprobado | 🟢 |
| ADR-0021 | Money client-side con Decimal.js + Context injection | Aprobado | 🟢 |
| ADR-0022 | Fiscal Projection Layer + Fiscal Snapshot + TDF F0 + FiscalBreakdown + Circuit Breakers + Fail-Closed Semantics | Aprobado | 🟡 (5 preguntas TDF + Ley 27.743 pendientes contador) |

## 3.2 Trilogía de spec arquitectónica (cerrada 2026-05-27 PM)

| # | Doc | Estado |
|---|---|---|
| 1 | [EVENT-TAXONOMY.md](EVENT-TAXONOMY.md) v2.0.1 — 32 eventos canónicos + 4 concerns separados (`audit_log` partitioned + `jobs_queue` + `metrics_counter` whitelist + Pino logs) | ✅ |
| 2 | [CORRELATION-PROPAGATION.md](CORRELATION-PROPAGATION.md) v1.0.0 — 2 IDs (`correlation_id` + `request_id`) + AsyncLocalStorage Node + headers Edge + worker continuity + sessionStorage cliente | ✅ |
| 3 | [RECONCILIATION-ENGINE.md](RECONCILIATION-ENGINE.md) v1.0.0 — Worker `afip-reconcile-pending` + SKIP LOCKED + `FECompUltimoAutorizado` recovery + dead letter philosophy + poison detection inmediata + operator tooling SQL F0 | ✅ |

## 3.3 Decisiones cerradas por investigación oficial 2026-05-27 PM

Investigación con fuentes ARCA/AFIP (manuales WSFEv1 COMPG v3.4.2, WSMTXCA v0.25.5, WSFEX v2.1.0) + AAIP + Infoleg cerró:

**Fiscal:**
- HALF_EVEN modo redondeo (ya estaba)
- TDF tiene código `10 - IVA Liberado – Ley 19.640` en `CondicionIVAReceptorId` de WSFEv1
- WSFEv1 alcanza para retail TDF (WSBFE es MiPyMEs/FCE, WSCT es turismo — NO obligatorios)
- `ImpOpEx` del header WSFEv1 = "Importe exento"
- Para Tipo C: array `Iva[]` NO se informa
- DocTipo tipo A = 80 (CUIT) obligatorio
- `CondicionIVAReceptorId` obligatorio (RG 5616)
- CUIT inactiva/inválida = rechazo CAE excluyente, salvo NC
- `legal_name`/`fiscal_address` NO obligatorios en esquema base WSFEv1
- Plazo 10 días entrega comprobante post-CAE al cliente
- Retención fiscal 10 años (Ley 11.683 + Decreto 1397/79)

**Legal:**
- AAIP inscripción obligatoria para bases que dan informes (Ley 25.326)
- Trámite vía TAD con clave fiscal nivel 2+
- Ley 25.326: definición amplia de "datos personales" + "datos sensibles" especiales (Art. 7)
- Derechos ARCO reconocidos

## 3.4 Hallazgos críticos pendientes (BLOQUEANTES de código fiscal)

### 🔴 Hallazgo #1 — "Ticket no fiscal" NO es fallback WSFEv1

Confirmado por fuente oficial: el término "comprobante no fiscal" pertenece al régimen de **controladores fiscales**, NO es fallback de WSFEv1 timeout. Además, comprobante autorizado debe ponerse a disposición del cliente dentro de **10 días post-CAE**.

**Invalida parte del modelo ADR-0004** (reconciliación post-2h asumiendo que un ticket interno puede ser entregado como comprobante operativo).

**Acción pendiente:** refactor del modelo a "**constancia provisoria**" + factura electrónica dentro de 10 días post-CAE. Pregunta A-2 (contador) + B-6 (abogado) en advisor doc.

**Bloquea:** código de reconciliación fiscal. NO escribir hasta que A-2 + B-6 cierren modelo final.

### 🔴 Hallazgo #2 — Régimen Transparencia Fiscal Ley 27.743

Obligatorio desde 2025. Todos los comprobantes deben llevar leyenda "**Régimen de Transparencia Fiscal al Consumidor Ley 27.743**" + IVA en línea separada + "Otros impuestos nacionales indirectos" en otra línea.

**Valida** que `FiscalBreakdown` de ADR-0022 NO es invención propia — está alineado.

**Acción pendiente:** pregunta A-11 (contador) — texto literal exacto + estructura visual + aplicabilidad Tipo C/TDF + sanción.

**Bloquea:** primer ticket impreso productivo.

## 3.5 Decisiones abiertas críticas (validaciones humanas pendientes)

Ver [DECISION-LEDGER.md sección "Decisiones abiertas críticas"](DECISION-LEDGER.md). Resumen:

**Contador (A-1, A-4, A-6, A-7, A-8, A-10, A-11):**
- Stage de redondeo PER_LINE vs PER_BRACKET + tratamiento contable diferencia centavos
- Política caché Padrón A5 (estricto vs permisivo) + tolerancia timeout
- NC sobre factura vieja con cambio condición IVA cliente
- Manejo observed
- Cold storage Glacier para XMLs > 1 año
- TDF: texto legal + rubros amparados + default conservador
- **Ley 27.743 texto literal + estructura visual** ← bloquea ticket impreso

**Abogado (B-1, B-2, B-3, B-4, B-5, B-6, B-7, B-8, B-9, B-10):**
- Responsabilidad civil error fiscal automatizado + RC profesional + SRL vs monotributo
- Cómo declarar SaaS multi-tenant ante AAIP + cronograma + riesgo piloto
- Plazo "72h" tipo GDPR para breach AAIP (NO existe oficial AR, sigue abierto)
- Asignación responsabilidad fuga cross-tenant
- Conservación legal docs NO fiscales (audit, logs, T&C, política)
- **Ángulo civil de venta cobrada sin CAE post-2h** ← bloquea reconciliación
- Cláusulas T&C / DPA / Privacy Policy
- Mapping legal `pii_level` operacional vs Ley 25.326
- Resolución conflicto ARCO vs conservación fiscal 10 años

## 3.6 Estado del repo (vive en WSL, no acá)

**Path:** `~/workspace/pandora-erp` (WSL2/Ubuntu/Node 22)
**Status:** SIN AVANCES desde 2026-05-21. Existe sólo el esqueleto del Sprint Visual de 3 días (componentes Hero / Atmospheres / etc.). Todo lo demás (multi-tenant, fiscal, POS, etc.) falta.

---

# 4. Product Philosophy

## 4.1 Qué es Pandora

**Una sola herramienta integrada** que reemplaza el stack típico operativo de un kiosco/ferretería/mercería argentino:

| Antes | Pandora |
|---|---|
| Excel para stock | Stock integrado con cada venta |
| Facturador RCEL o Buenavista | AFIP/ARCA nativo embebido |
| Calculadora + cuaderno para caja | Cierre de caja con conciliación |
| WhatsApp con contador | Contador entra al sistema con su login |
| Tango/Bejerman caro y complejo | POS+ERP simple, suscripción mensual |

## 4.2 Qué NO es Pandora

| Categoría | Por qué NO |
|---|---|
| ERP enterprise (SAP, Oracle) | Target distinto. Pandora no quiere competir con SAP. |
| Software contable completo | Pandora EXPONE datos al contador. NO hace contabilidad. |
| Sistema gastronómico | Sin lógica de mesa, comanda, cocina, propinas, división de cuenta. F2+ con trigger objetivo. |
| E-commerce | Sin carrito web, checkout público, integraciones con Mercado Libre. POS físico primero. |
| Plataforma blockchain | No tiene sentido para retail TDF. |
| Sistema manufacturero / MRP | Sin BOM, sin órdenes de producción. F3+ si aparece cliente real. |
| Multi-país temprano | AR-only hasta F2+. Localización Chile/Uruguay = ADR nuevo + cliente que pague. |
| Microservicios | Monolito modular F0 confirmado por ADR-0007. |

## 4.3 Cómo tomar decisiones de producto

Cada feature propuesto se evalúa contra este filtro (en orden):

1. **¿Resuelve un dolor operativo real de un comerciante TDF actual?** Si no → backlog con trigger "primer cliente que lo pida".
2. **¿Pertenece al scope F0?** Si es F1+ → backlog explícito, NO se mete por la ventana.
3. **¿Rompe algún ADR vigente?** Si sí → bloquear. Si la decisión amerita, abrir nuevo ADR que reemplace al anterior con justificación.
4. **¿Rompe alguna constitución de este doc** (fiscal, monetaria, multi-tenant, observabilidad, seguridad)? Si sí → bloquear.
5. **¿Requiere validación humana (contador/abogado)?** Si sí → al advisor doc, NO al código.
6. **¿Genera deuda técnica accidental?** Si sí → documentar la deuda intencional con trigger para resolverla.
7. **¿Es la opción más simple que resuelve el problema?** Si la respuesta es "no, pero esta es más elegante" → rechazar.

## 4.4 Cómo evitar Frankenstein ERP

**Anti-patterns de producto rechazados sistemáticamente:**

- Agregar módulos "por las dudas" (HR, CRM, marketing) — NO. Solo si hay cliente que pague.
- Soportar features que pidió 1 cliente raro — agregar al backlog con trigger "3+ clientes".
- Copiar features de competencia sin pensar si encajan — NO. Cada feature pasa el filtro de §4.3.
- Customización profunda por cliente — NO en F0. Todos los clientes usan el mismo producto. Feature flags F1+ con trigger.
- "Configurable" como respuesta — NO. La configuración inflada es la muerte de un producto. Decisiones opinadas.
- "Plugin system" / "marketplace" — NO F0/F1. F3+ con un ecosistema real probado.

## 4.5 Cómo mantener foco

- **Hoja de ruta visible:** roadmap escrito en ADRs + Sesión 5 v4 + backlog. Si no está en uno de esos tres, no existe.
- **Triggers objetivos para promoción:** items del backlog solo suben con métrica/cliente real, no con "me parece importante".
- **Memoria operativa:** [over-engineering rejected memory] tiene 15 propuestas rechazadas con triggers para reabrir. NO se discute sin trigger objetivo.
- **Fase de spec cerrada:** la spec arquitectónica F0 se cerró 2026-05-27. Más spec sin código real es over-engineering por defecto.

---

# 5. Scope Discipline

## 5.1 Definiciones de fases

| Fase | Definición |
|---|---|
| **F0** | Lo mínimo que permite cobrar 5 clientes pagando en TDF. 14-16 semanas desde inicio de código. |
| **F0.5** | Polishing operativo: operator tooling con UI, dashboards básicos, refinamientos UX detectados con clientes piloto. |
| **F1** | Lo que aparece al pasar a 10-30 clientes pagando. Incluye notas de crédito (NC), reportes contables, mejor onboarding. |
| **F2** | Escala a 50-200 clientes. Multi-jurisdicción argentina (CABA, BUENOS_AIRES, otras provincias), WSMTXCA si aparece B2B, conciliación bancaria. |
| **F3** | 500+ clientes / ecosistema. Plugin system, marketplace, multi-país, advanced analytics. |
| **Experiments** | Feature flag en 1 tenant piloto. No promoción sin métrica. |
| **Backlog** | Diferido con trigger explícito en [backlog-validaciones.md](backlog-validaciones.md). |
| **Investigación** | Sin compromiso. Puede no implementarse nunca. |

## 5.2 Qué entra en F0 (lista cerrada)

### Operación de venta
- POS con carrito, cobro efectivo / tarjeta / MercadoPago QR
- Apertura/cierre de caja diario con conciliación
- Customer search/create básico (DNI/CUIT)
- Customer snapshot inmutable

### Fiscal
- AFIP WSAA + WSFEv1 sincrónico timeout 30s
- Reconciliation Engine completo (worker, recovery, dead letter, poison detection)
- Fiscal Projection Layer (3 vistas: comercial, contable, fiscal)
- Fiscal Snapshot inmutable persistido por factura
- FiscalBreakdown alineado con Ley 27.743
- TDF support (Ley 19.640): `tdf_exempt` flag por producto, `merchant_special_regime`, `ImpOpEx` para exentos
- Numeración SELECT FOR UPDATE
- Padrón A5 con caché

### Stock
- Catálogo de productos con precio + stock
- Movimientos de stock por venta
- Ajuste manual con motivo obligatorio
- Stock mínimo (alerta, no bloquea)

### Contador
- Login contador con array de `company_ids` en JWT
- Vista read-only de N empresas que lo invitaron
- Export básico (Excel/CSV) de ventas + IVA

### Multi-tenant
- RLS Postgres con `auth.jwt() ->> 'company_id'`
- Feature flags por tenant
- Aislamiento total (tenant, secretos, jobs, queues, certs AFIP)
- Tests cross-tenant obligatorios

### Auditabilidad y trazabilidad
- `audit_log` append-only inmutable particionado por año
- `jobs_queue` con 10 job_types canónicos
- `metrics_counter` con whitelist
- Pino logs con `correlation_id` + `request_id` + `tenant_id` auto-inyectados
- Realtime broadcasts con `correlation_id` para filtrado cliente

### Seguridad
- CSP, HMAC webhooks, TLS 1.2+, NTP sync, key rotation versionada
- Session security (idle 30min, absolute 12h)
- Secret lifecycle con encrypted vault
- Threat model documentado

### Demo lifecycle
- Demo 60 días → modo lectura → archivo día 82 (ADR-0020)

### UI/UX
- 3 atmospheres (Operational/Insight/Ceremonial)
- Dawn Sky identidad visual
- Charts SVG puros
- Glass degradación por hardware
- Density obligatoria

## 5.3 Qué QUEDA DIFERIDO (NO F0)

### F0.5 (después de 1-3 clientes piloto)
- Dashboard operator UI (queries SQL Q1-Q4 ya disponibles F0)
- Refinamientos UX detectados con clientes reales
- Reportes contables expandidos

### F1+ (5-30 clientes)
- **Notas de crédito** — F1+. F0 solo emite facturas.
- Notificaciones proactivas al contador (email/WhatsApp por dead jobs > 4h)
- Outbox pattern enterprise con worker poller dedicado
- BroadcastChannel multi-tab POS
- LRU permisos cliente
- Heartbeat reverso connectivity
- Modo offline real (no fake offline)
- WSMTXCA (factura con detalle de ítem) — trigger: primer cliente B2B
- Quarantine queue separada
- Hash chain en audit log (tamper-proof real)
- Sentry instrumentación completa

### F2+ (50-200 clientes)
- Multi-jurisdicción AR (CABA, BUENOS_AIRES, otras provincias) más allá de TDF
- IIBB CABA / ARBA / otros impuestos provinciales
- WSFEX (exportación) — trigger: primer cliente exportador
- Multi-currency
- Conciliación bancaria automática
- Machine learning para predecir rechazos CAE
- Multi-region failover

### F3+ (500+ clientes / ecosistema)
- Plugin system / marketplace
- Multi-país (Chile, Uruguay, otros)
- Advanced analytics
- API pública

## 5.4 Triggers de promoción del backlog

Un item del backlog **NO** sube por:
- "Me parece importante"
- "Las grandes empresas lo tienen"
- "Por las dudas"
- "Para ser future-proof"
- Estética / elegancia técnica

Un item del backlog **SÍ** sube por:
- **Cliente real lo pidió** (al menos 3 para features generales, 1 para fiscal/legal obligatorio)
- **Métrica cruzó umbral** definido en el ítem del backlog
- **Cambio normativo** (RG AFIP nueva, ley nueva)
- **Bug en producción** lo hace bloqueante para clientes actuales
- **Tiempo en backlog > 12 meses** → revisar relevancia, quitar si ya no aplica

## 5.5 Cómo rechazar complejidad

Cuando alguien propone agregar X, preguntar en orden:

1. ¿Está en F0? Si no → "lo agendamos para F1+, no ahora."
2. ¿Hay un cliente que lo pida con dolor real? Si no → backlog con trigger.
3. ¿Hay un ADR vigente que lo cubra? Si sí → seguir ADR. Si no → ¿hace falta uno?
4. ¿Es la opción más simple? Si no → simplificar antes de avanzar.
5. ¿Genera deuda técnica? Si sí → documentar la deuda intencional con trigger.

Si la propuesta no pasa los 5 filtros, va a [over-engineering rejected memory] o al backlog.

---

# 6. Architecture Constitution

## 6.1 Stack tecnológico APROBADO (única fuente: ADR-0001 + ADR-0018)

### Runtime y framework
- **Node.js 22 LTS** (mínimo)
- **Next.js 16.2.6** (App Router, Server Actions, Server Components)
- **React 19.2.4**
- **TypeScript 5.9** con `strict: true` + `noUncheckedIndexedAccess: true`

### Base de datos y persistencia
- **Supabase managed** (Postgres 16 + Auth + Storage + Realtime + RLS)
- **Drizzle ORM 0.45.2** (NO Prisma, NO TypeORM, NO Knex)
- **postgres-js 3.4.9** como driver
- **@supabase/ssr 0.10.3** para auth en Server Components

### Validación y tipos
- **zod 4.4.3** para validación de input + env
- **jose 6.2.3** para JWT (NO `jsonwebtoken`)

### Money
- **decimal.js 10.6.0** (única lib monetaria permitida — ver §9)

### UI
- **Tailwind CSS 4.3** + **shadcn/ui** (Radix UI + Nova preset)
- Custom CSS via Tailwind solo cuando shadcn no alcance

### Observabilidad
- **Pino** para structured logs (NO console.log, NO winston)
- **Sentry** instrumentación básica F0, completa F1+

### Testing
- **Vitest** + **fast-check** (property-based testing donde aplique)

### Deploy y workers
- **Vercel** (Next.js + cron jobs F0)
- **Cron Vercel** para workers F0 (afip-reconcile-pending, etc.)
- **F1+:** Railway + BullMQ + Upstash Redis si volumen lo amerita

## 6.2 Stack PROHIBIDO (explícito, no asumir)

| Categoría | Prohibido F0 | Razón |
|---|---|---|
| ORM alternativo | Prisma, TypeORM, Knex, Sequelize | ADR-0001 confirma Drizzle |
| Money | Big.js, currency.js, dinero.js, plain Number | Solo decimal.js (ADR-0005) |
| State management | Redux, MobX, Zustand para state global complejo | React Server Components + Server Actions cubren F0 |
| Charts | Recharts, D3, Chart.js, Victory, Highcharts | ADR-0014: solo SVG puros |
| Animation | GSAP, Framer Motion ad-hoc | ADR-0015: motion presets nombrados |
| Microservicios | Cualquier separación de servicios | ADR-0007: monolito modular |
| Event sourcing | EventStore, message buses tipo Kafka/RabbitMQ | EVENT-TAXONOMY: `jobs_queue` NO es event bus encubierto (regla J5) |
| CQRS | Separación read/write models | Premature F0 |
| Lógica en plpgsql | Funciones plpgsql con lógica de negocio | ADR-0003: services TS, plpgsql solo para triggers de inmutabilidad |
| Logging | console.log, winston, bunyan, logger ad-hoc | Solo Pino (ver §10) |
| HTTP client | axios | fetch nativo + Server Actions |
| Auth | NextAuth, Auth0, Clerk | Supabase Auth + JWT propio con jose |
| Forms | Formik, react-hook-form sin zod | react-hook-form + zod si hace falta; Server Actions con FormData primero |
| GraphQL | Apollo, urql, graphql-yoga | REST + Server Actions cubren F0 |
| Backend framework | Express, Fastify, NestJS | Next.js Server Actions / Route Handlers cubren F0 |
| Email | sendgrid SDK, mailgun SDK | Resend (TBD por ADR si aparece) |
| File upload | Multer, formidable | Server Actions con FormData |

## 6.3 Layering obligatorio

```
┌─────────────────────────────────────────────────────────────┐
│  PRESENTATION (src/app/**, src/components/**)              │
│  ─ Server Components (default)                              │
│  ─ Client Components ('use client' explícito)              │
│  ─ Server Actions ('use server')                            │
│  ─ NO lógica fiscal, NO money math, NO acceso DB directo   │
└──────────────────┬──────────────────────────────────────────┘
                   ▼
┌─────────────────────────────────────────────────────────────┐
│  APPLICATION (src/lib/services/**)                          │
│  ─ Application Services (clases o funciones TS puras)       │
│  ─ Orquestación de uso casos                                │
│  ─ Transaction boundaries (BEGIN/COMMIT)                    │
│  ─ Idempotency dedup                                        │
│  ─ Llamada a Domain + Infrastructure                        │
└──────────────────┬──────────────────────────────────────────┘
                   ▼
┌─────────────────────────────────────────────────────────────┐
│  DOMAIN (src/lib/domain/**)                                 │
│  ─ Lógica pura: cálculos, reglas, invariantes               │
│  ─ Sin side effects, sin DB, sin HTTP                       │
│  ─ Money math, fiscal projection, state machines            │
└──────────────────┬──────────────────────────────────────────┘
                   ▼
┌─────────────────────────────────────────────────────────────┐
│  INFRASTRUCTURE (src/lib/db/**, src/lib/integrations/**)    │
│  ─ Drizzle schema + queries                                 │
│  ─ AFIP SOAP client (WSAA + WSFEv1 + Padrón)                │
│  ─ MercadoPago SDK                                          │
│  ─ Email provider                                           │
│  ─ Supabase Realtime publisher                              │
└──────────────────┬──────────────────────────────────────────┘
                   ▼
┌─────────────────────────────────────────────────────────────┐
│  JOBS (src/lib/workers/**)                                  │
│  ─ Worker dedicado por job_type (no handler genérico)       │
│  ─ SKIP LOCKED                                              │
│  ─ Idempotency lectura previa                               │
└─────────────────────────────────────────────────────────────┘

PLATFORM (cross-cutting — todos los contexts importan de acá)

  MULTI_TENANT (src/lib/multi_tenant/**)
    ─ withTenantContext(), getCurrentTenantId(), validateTenantAccess()
    ─ CrossTenantAccessError class

  OBSERVABILITY (src/lib/observability/**)
    ─ Pino logger Proxy con AsyncLocalStorage
    ─ Metrics counter writer (con whitelist)
    ─ Audit log writer

  TRACING (src/lib/tracing/**)
    ─ AsyncLocalStorage context (correlation_id + request_id + tenant_id)
    ─ withServerActionTracing(), withWorkerTracing(), withCronTracing()

  JOBS_QUEUE (src/lib/jobs_queue/**)
    ─ enqueue() + fetchNextWithLock() + markDone/Failed/Poisoned()

  AUDIT (src/lib/audit/**)
    ─ audit_log writes con trigger inmutable + cleanup vía DROP PARTITION

  SECURITY (src/lib/security/**)
    ─ rate_limit + hmac + vault + CSP middleware
```

> Para detalle completo de Bounded Contexts (Sales, Fiscal, Cash, Inventory, Reporting, Identity, Notifications, Integrations + 6 Platform contexts) ver [BOUNDED-CONTEXTS.md](BOUNDED-CONTEXTS.md).

## 6.4 Reglas de separación absolutas

### NO en UI (presentation)
- Acceso directo a Drizzle / Supabase client
- Cálculo de money real (sólo preview con Decimal.js client-side, ver §9)
- Llamadas a AFIP SOAP
- Decisión de transiciones de `fiscal_status`
- Lectura/escritura de env vars de secretos
- Lógica de autorización (sólo show/hide botones, autorización real en Server Action)
- Generación de números fiscales (sólo display del número devuelto por server)

### NO en handlers (Server Actions / Route Handlers)
- Cálculo de IVA / total / descuentos (delegar a Domain)
- Acceso directo a tablas sin pasar por Drizzle schema
- Lógica de retry (delegar a job worker o cliente)
- Decisiones fiscales (delegar a Fiscal Projection Layer)

### NO en DB (plpgsql / triggers)
- Lógica de negocio compleja (ADR-0003)
- Llamadas HTTP / SOAP
- Side effects fuera de la transacción
- Excepciones permitidas para plpgsql:
  - Trigger de inmutabilidad de `audit_log` (THROW en UPDATE/DELETE)
  - Trigger de bumping de `updated_at`
  - Funciones simples de constraint check

### NO en middleware
- Acceso a DB (excepto rate limit que puede leer Redis F1+)
- Decisiones de negocio
- Generación de tokens auth (Supabase Auth lo hace)
- **SÍ debe hacer:** generar `request_id`, generar/propagar `correlation_id`, montar headers de tracing

### NO en client components
- Lectura de env vars de secretos
- Money policy lookup directo (debe venir por Context inyectado por server — ADR-0021)
- Decisión de connectivity como autoridad (es decisión local del cliente — ver AUTHORITY-MAP)

---

# 7. Multi-Tenant Constitution

## 7.1 Modelo de tenant

Cada **comercio** (kiosco, ferretería) es un tenant identificado por `company_id` (UUID). Datos absolutamente segregados por `company_id`. Sólo el usuario contador puede ver múltiples `company_ids` (uno por cada empresa que lo invitó — ADR-0008).

## 7.2 Estrategia de aislamiento (ADR-0002)

### RLS Postgres como capa primaria
Toda tabla con datos de tenant debe tener:
1. Columna `company_id uuid NOT NULL`
2. Foreign key a `companies(id)` ON DELETE RESTRICT
3. Policy RLS que filtre por `auth.jwt() ->> 'company_id'` o `auth.jwt() -> 'company_ids' @> company_id` (contador)
4. Index en `company_id` (compuesto si query lo amerita)

### Service-side validation como capa secundaria
Cada Application Service que toca datos de tenant debe:
1. Leer `tenant_id` del AsyncLocalStorage context (montado por middleware)
2. Verificar que el `tenant_id` matchea el `company_id` del recurso accedido
3. Si no matchea → `throw new CrossTenantAccessError()`, audit log inmediato
4. Si el RLS rechaza (defensa en profundidad) → audit log + alerta

### Tests cross-tenant obligatorios
Toda operación crítica debe tener un test cross-tenant que:
1. Crea 2 tenants distintos
2. Loguea como tenant A
3. Intenta acceder a recurso de tenant B
4. Verifica que falla (RLS o service validation)
5. Verifica que el audit_log registró el intento

## 7.3 Contador multi-empresa (ADR-0008)

El JWT del contador contiene `company_ids: ['uuid1', 'uuid2', 'uuid3']` (array).

- Las policies RLS para tablas que el contador puede leer usan `company_id = ANY(auth.jwt() -> 'company_ids')`.
- El contador es **read-only por defecto.** Mutations requieren rol explícito por empresa.
- Cambio de empresa activa: query param o context client-side, **server SIEMPRE valida.**
- Invitación: el owner del comercio invita por email. Contador acepta con su login Supabase. Server agrega `company_id` al array.

## 7.4 Feature flags por tenant (ADR-0009)

- Tabla `feature_flags (tenant_id, flag_key, enabled, payload jsonb)`.
- Lectura en server: helper `isEnabled(flagKey, tenantId)` con cache TTL corto (60s).
- NO usar flags para A/B testing F0. Solo rollout gradual / killswitch / feature por plan.
- Lista canónica de flags F0 documentada en CLAUDE.md actualizado por sesión que la agregue.

## 7.5 Aislamiento de recursos no-DB

| Recurso | Aislamiento |
|---|---|
| **Secretos por tenant** (claves AFIP, MP) | Encrypted con `tenant_id` en path. Service role no puede leer secret de tenant B sin validación explícita. |
| **Certificados X.509 AFIP** | Path por tenant en Supabase Storage con RLS. NUNCA shared. |
| **Jobs queue** | `jobs_queue.tenant_id NOT NULL`. Worker lockea por SKIP LOCKED + WHERE tenant_id. |
| **Audit log** | `audit_log.tenant_id NOT NULL` (excepto eventos system-wide con `SYSTEM_TENANT_ID = '00000000-0000-0000-0000-000000000000'`). |
| **Metrics counter** | Igual que audit (scope tenant o system). |
| **Realtime broadcasts** | Canal por tenant (`tenant:{tenant_id}:events`). Cliente solo se suscribe a su canal. |
| **Numeración fiscal** | `invoice_sequences (tenant_id, sale_point, invoice_type)` con SELECT FOR UPDATE. |
| **Reconciliation jobs** | tenant_id obligatorio. Worker procesa por tenant. |
| **AFIP WSAA tokens** | Cache por tenant. NUNCA shared. |

## 7.6 Invariantes absolutas

1. **NO existe query sin `company_id` filter** en tablas tenant-aware (RLS lo enforce, service lo valida).
2. **NO existe job sin `tenant_id`** (excepto crons system-wide).
3. **NO existe log sin `tenant_id`** en context (excepto boot logs pre-context).
4. **NO se puede impersonar tenant** sin audit log + flag explícito de support.
5. **NO se shared secrets entre tenants** (cada tenant tiene su propio set de claves).

## 7.7 Anti-patterns prohibidos

- Cache de objetos con datos de tenant sin namespace por `tenant_id`
- `SELECT * FROM table` sin WHERE clause cuando RLS no aplica (job context, admin)
- Funciones plpgsql que no consultan `current_setting('app.tenant_id')` o no respetan RLS
- Operaciones bulk sin verificación per-row de `company_id`
- Compartir conexión DB entre requests de tenants distintos en transaction abierta
- Background jobs que iteran todos los tenants en un solo loop sin commit por tenant

## 7.8 Support impersonation policy

Para soporte técnico (humano de Pandora ayuda a comerciante):

1. **Requiere flag `support_mode` en JWT** + audit log obligatorio al activarse.
2. **Acceso read-only por defecto.** Mutations requieren consentimiento explícito del comerciante (token de 1 uso).
3. **Sesión limitada a 2h** con renovación explícita.
4. **TODO acción del support_user queda en audit_log** con `actor_type: 'support'`.
5. **NUNCA support_user puede emitir facturas** en nombre del comerciante.

## 7.9 Mandatory tests multi-tenant

- T-MT-01: cross-tenant SELECT bloqueado por RLS
- T-MT-02: cross-tenant UPDATE bloqueado por RLS + service
- T-MT-03: contador multi-empresa solo ve sus `company_ids`
- T-MT-04: secreto de tenant A no accesible desde tenant B
- T-MT-05: numeración fiscal concurrente entre tenants sin colisión
- T-MT-06: realtime broadcast de tenant A NO llega a cliente de tenant B
- T-MT-07: job de tenant A no procesa datos de tenant B (poison test)

---

# 8. Fiscal Constitution

> **Esta es la sección más rigurosa del doc.** Pandora es un sistema fiscal: cada decisión acá tiene impacto legal real sobre comerciantes y posiblemente sobre Pandora misma.

## 8.1 Autoridad fiscal externa

**AFIP/ARCA es la ÚNICA autoridad fiscal.** Pandora:
- **NUNCA decide** si una factura es válida.
- **REGISTRA** lo que AFIP devuelve (CAE → emitido / rejection → número quemado / timeout → reconciliación).
- **NUNCA inventa** CAE, fecha de vencimiento, número de comprobante.
- **PERSISTE** el `Fiscal Snapshot` completo de cada operación para reproducibilidad histórica.

## 8.2 Arquitectura fiscal (ADR-0022)

### 3 vistas separadas del mismo dato fiscal

1. **Comercial (POS UI):** lo que el cajero ve. Total grande, items con precio, descuentos visibles.
2. **Contable (DB persistido):** modelo interno per-line. Cada item con su IVA específico, su exención específica, su descuento prorrateado.
3. **Fiscal (payload WSFEv1):** lo que se envía a AFIP. Agregado per-bracket en array `Iva[]`. Header con `ImpTotal`, `ImpNeto`, `ImpIVA`, `ImpOpEx`.

### Fiscal Projection Layer
Módulo único `src/lib/fiscal/projection/wsfev1.ts` responsable del shape WSFEv1. **Resto del sistema NO conoce shape WSFEv1.** Cambio de WS = solo nuevo archivo en `projection/`.

```
modelo_interno (per-line con tax_lines) → projectToWSFEv1(snapshot) → payload AFIP
```

### Fiscal Snapshot inmutable
Cada factura emitida persiste un snapshot completo en `fiscal_snapshots`:

```typescript
{
  sale_id: uuid,
  calculation_engine_version: '1.0.0',
  tax_policy_version: '2026-05-27',
  rounding_mode: 'HALF_EVEN',
  rounding_stage: 'PER_LINE',
  iva_rates_applied: [{ rate: 21, base: 1000.00, importe: 210.00 }],
  currency_code: 'ARS',
  jurisdiction_context: {
    merchant_jurisdiction_province: 'TIERRA_DEL_FUEGO',
    merchant_special_regime: 'LEY_19640' | null,
    transaction_in_special_zone: true
  },
  fiscal_breakdown: { /* ver §8.6 */ },
  wsfe_version: 'WSFEv1',
  wsfe_request_payload: { /* sanitizado */ },
  wsfe_response_raw: { /* CAE + observaciones */ },
  created_at: timestamp,
  -- INMUTABLE post-emisión
}
```

### Reproducibilidad histórica
Dada `(sale_id, snapshot)`, el motor reconstruye el payload AFIP idéntico años después. Test mensual F1+: tomar muestra de facturas y verificar `reproduceInvoice(id)` da idéntico.

## 8.3 Lifecycle de CAE

Estados en snake_case (consistente con §12.2 y RECONCILIATION-ENGINE §2):

```
draft_sale ──cobro──→ try_afip ──WSFEv1.FECAESolicitar──→
   ├─ CAE devuelto OK → issued
   ├─ AFIP rechazo explícito (failed) → rejected_final + número quemado
   ├─ Timeout 30s → requires_reconciliation → worker async
   └─ Worker éxito → reconciled_issued (igual que issued legalmente)
```

Detalle completo: [RECONCILIATION-ENGINE.md](RECONCILIATION-ENGINE.md) §2.

## 8.4 Timeout semantics

- **Cliente espera hasta 30s** sincrónico (UX: spinner con mensaje "comunicando con AFIP").
- **Timeout 30s sin respuesta:**
  - Venta marcada `fiscal_status = 'requires_reconciliation'`
  - Cobro registrado, mercadería entregada
  - **NO se imprime factura fiscal** (CAE no obtenido)
  - **PROBLEMA ABIERTO** (Hallazgo #1): qué se le entrega al cliente entre la venta y la emisión post-CAE. Ver §8.10.
- **Worker `afip-reconcile-pending`:** retoma cada 5min × 24 attempts = 2h ventana.
- **Tras 24 attempts sin resolver:** `fiscal_status = 'manual_resolution_required'` + alerta operator.

## 8.5 Numeración fiscal (ADR-0006)

```sql
BEGIN;
SELECT next_number FROM invoice_sequences
  WHERE tenant_id = $1 AND sale_point = $2 AND invoice_type = $3
  FOR UPDATE;
-- (lock pesimista bloquea concurrencia)
UPDATE invoice_sequences SET next_number = next_number + 1 WHERE ...;
-- llamar AFIP con next_number
COMMIT (solo si AFIP devolvió CAE OK);
```

Si AFIP rechaza → ROLLBACK → número NO se incrementa.
Si AFIP timeout → la transacción permanece abierta con el número reservado + worker resuelve.

**Test de concurrencia obligatorio:** 100 emisiones concurrentes desde el mismo tenant/sale_point/invoice_type deben generar 100 números distintos sin colisión.

## 8.6 FiscalBreakdown (alineado con Ley 27.743)

> ⚠️ **Régimen de Transparencia Fiscal al Consumidor (Ley 27.743) obligatorio desde 2025.** Confirma que el `FiscalBreakdown` de ADR-0022 NO es invención propia.

Cada ticket impreso debe incluir:

```
─────────────────────────────────────────
Subtotal sin impuestos:        $X.XXX,XX
IVA (21%):                     $X.XXX,XX
Otros impuestos nacionales
indirectos:                    $X.XXX,XX
─────────────────────────────────────────
TOTAL:                         $X.XXX,XX

Régimen de Transparencia Fiscal
al Consumidor Ley 27.743
─────────────────────────────────────────
```

**Pendiente cerrar con contador (pregunta A-11):**
- Texto literal exacto de cada línea
- Estructura visual obligatoria (ubicación, tipografía, cuándo aparece)
- Aplicabilidad a Tipo C + comprobantes TDF amparados
- Sanción + período de gracia

Persistencia: `fiscal_snapshots.fiscal_breakdown jsonb` inmutable. Ticket impreso lee del snapshot — **NUNCA recalcula.**

## 8.7 TDF support (Ley 19.640) — CONFIRMADO OFICIAL

- **WSFEv1 alcanza** (NO WSBFE / WSCT). Confirmado oficial 2026-05-27.
- **Código `CondicionIVAReceptorId = 10`** ("IVA Liberado – Ley 19.640") existe en WSFEv1.
- **`ImpOpEx` del header WSFEv1** = "Importe exento". Allí van las operaciones amparadas.
- **Schema:**
  - `companies.merchant_jurisdiction_province` enum (CABA / BUENOS_AIRES / TIERRA_DEL_FUEGO / OTRAS_PROVINCIAS_F2+)
  - `companies.merchant_special_regime` enum (`LEY_19640` | null)
  - `products.tdf_exempt boolean DEFAULT false` (default conservador: paga IVA salvo flag explícito)
- **Lógica de aplicación:**
  ```typescript
  if (
    merchant.special_regime === 'LEY_19640' &&
    transaction.in_special_zone === true &&
    product.tdf_exempt === true
  ) {
    // → ImpOpEx, NO IVA
  } else {
    // → tratamiento estándar con IVA
  }
  ```

**Pendiente cerrar con contador (pregunta A-10):**
- Texto legal exacto en el ticket TDF amparado
- Rubros típicamente amparados (criterio empírico)
- Default conservador ante duda (hipótesis Pandora: gravado)

## 8.8 Retry semantics fiscal

| Caso | Acción |
|---|---|
| **Transient error** (timeout, 5xx, network) | Retry exponencial CLIENT-SIDE 1 vez (30s+30s). Si vuelve a fallar → worker async. |
| **Worker retry** | Lineal 5min × 24 attempts = 2h. **NO exponencial** (AFIP no nos rate-limita). |
| **AFIP `failed` (rechazo explícito)** | **NUNCA retry.** Bug nuestro → fix → re-emitir manual con número quemado documentado. |
| **AFIP observed (warning sin rechazo)** | Pendiente confirmar manejo con contador (pregunta A-7). |

## 8.9 Recovery de CAE perdido (FECompUltimoAutorizado pattern)

Si el worker crashea entre WSFEv1.FECAESolicitar y persistir el CAE:

1. Worker reintenta y antes de re-enviar, ejecuta `FECompUltimoAutorizado` para ver último número emitido por AFIP para ese (sale_point, invoice_type).
2. Si último número AFIP = número que íbamos a usar → llamar `FECompConsultar` para traer CAE + datos.
3. **Validar match obligatorio** con `validateRecoveredCae()`: `ImpTotal + DocTipo + DocNro` deben coincidir.
4. Si match → persistir como `reconciled_issued`.
5. Si mismatch → `manual_resolution_required` + alerta. **NUNCA asumir** que el comprobante de AFIP es nuestro.

Detalle: [RECONCILIATION-ENGINE.md](RECONCILIATION-ENGINE.md) §4.

## 8.10 🔴 PROBLEMA ABIERTO — Modelo de "constancia provisoria"

**Hallazgo crítico 2026-05-27:** el "ticket no fiscal" oficialmente pertenece al régimen de **controladores fiscales**, NO es fallback válido de WSFEv1. Plus: comprobante autorizado debe entregarse al cliente dentro de 10 días post-CAE.

**Estado actual de Pandora:** ADR-0004 asumía que tras timeout 2h se podía entregar un "ticket no fiscal" al cliente como evidencia operativa. Esto NO es válido.

**Pendiente cerrar (pregunta A-2 contador + B-6 abogado):**
- ¿Existe figura legal de "constancia provisoria" que Pandora pueda imprimir mientras espera CAE?
- ¿Texto legal exacto de la leyenda?
- ¿Plazo máximo entre venta cobrada y emisión post-CAE? (hipótesis: 10 días según fuente oficial)
- Si supera 10 días sin CAE: ¿anular y devolver, o emitir con fecha retroactiva cuando AFIP vuelva?

**Acción mientras tanto:** **NO escribir código de reconciliación fiscal** hasta cerrar A-2 + B-6.

## 8.11 Contingency semantics

- **Modo contingencia AFIP:** decidido por SERVER tras timeout 30s o error 5xx persistente.
- **Cliente NO decide** pasar a contingencia (ver AUTHORITY-MAP "Modo contingencia AFIP").
- **Cliente refleja** estado: muestra "AFIP no responde, generando constancia provisoria — recibirás factura por email."
- **Fail-closed obligatorio:** ante incertidumbre fiscal estructural (cert vencido, sin internet detectado, AFIP outage confirmado) → **NO emitir**, ofrecer cancelar venta.

## 8.12 Fail-closed semantics (ADR-0019 + ADR-0022)

| Escenario | Acción |
|---|---|
| Certificado AFIP X.509 expirado | **NO emitir.** Bloquear módulo fiscal del tenant. Alerta inmediata. |
| WSAA token inválido + WSAA timeout | **NO emitir.** Retry WSAA primero. Si persiste → bloqueo + alerta. |
| Padrón A5 inactivo + caché stale + Padrón timeout | **NO emitir.** Política definitiva pendiente (pregunta A-4). Default seguro: bloquear. |
| Calculation engine version mismatch | **NO emitir.** Bug crítico — investigar. |
| NTP drift > 5s | **NO emitir.** Time sync obligatorio (ADR-0019 S16). |
| Circuit breaker rate limit fiscal abierto | **NO emitir.** Throttle natural. |
| Circuit breaker anomaly detection abierto | **NO emitir.** Investigar antes de habilitar. |
| Tenant en emergency stop manual | **NO emitir.** Operator técnico habilita. |

**Anti-pattern explícito:** "emitir igual y rectificar después" — PROHIBIDO.

## 8.13 Circuit breakers fiscales (ADR-0022)

| Breaker | Threshold | Acción al disparar |
|---|---|---|
| **CB1 Rate limit fiscal** | > 100 emisiones/minuto por tenant | Throttle a 50/min + alerta |
| **CB2 Anomaly detection** | > 30% rechazos AFIP en 10min | Abrir breaker + bloquear emisión + alerta |
| **CB3 Emergency stop** | Manual por operator técnico | Bloquea emisión hasta reset manual con audit |
| **CB4 Batch confirmation** | Si más de 5000 emisiones en 1h | Requiere confirmación explícita |

## 8.14 Tolerance semantics

**Ámbito DEFINIDO:**
- **Path fiscal AFIP (`ImpIVA`):** TOLERANCIA 0. La invariante `ImpIVA == sum(Iva[].Importe)` con tolerancia 0 es exigencia técnica WSFEv1.
- **Path reconciliación (MP, banco):** tolerancia configurable (default ±$0.50). Helper `withinTolerance()`.

**NUNCA mezclar** tolerance fiscal con tolerance de reconciliación.

## 8.15 Persistence XML (ADR-0019 S14 + Ley 11.683)

- **Cada respuesta AFIP CAE persistida** como XML original + hash propio Pandora.
- **Retención obligatoria 10 años** (Ley 11.683 + Decreto 1397/79).
- **Format:** XML original AFIP. PDF puede generarse on-demand desde el XML para impresión, **PDF NO reemplaza XML.**
- **Storage:** Supabase Storage F0. Cold storage S3 Glacier F1+ para XMLs > 1 año (pendiente A-8 confirmación contador).
- **NUNCA UPDATE/DELETE** sobre XML almacenado (excepto cleanup post-10 años con audit propio).

## 8.16 Pendientes fiscales (validación humana)

| ID | Pregunta | A quién | Bloquea |
|---|---|---|---|
| A-1 | Stage de redondeo + conciliación centavos | Contador | Schema fiscal final, cálculo IVA real |
| A-2 | Modelo "constancia provisoria" post-2h | Contador | **Código reconciliación completo** |
| A-3 | Captura legal_name / fiscal_address opcional vs obligatorio | Contador | Schema customer_snapshot |
| A-4 | Política caché Padrón A5 | Contador | Refinamiento UX + fail-closed exacto |
| A-7 | Manejo observed | Contador | Runbook + UX cliente |
| A-8 | Cold storage Glacier para XMLs > 1 año | Contador | Decisión F1+ |
| A-10 | TDF: texto + rubros + default | Contador (TDF) | Texto en ticket amparado |
| **A-11** | **Ley 27.743: texto literal + estructura visual** | **Contador** | **Primer ticket impreso productivo** |
| B-6 | Ángulo civil/comercial de venta sin CAE | Abogado | Cierre A-2 |

---

# 9. Money & Calculation Constitution

## 9.1 Tipo canónico de money (ADR-0005)

- **Storage DB:** `numeric(19,4)` — 15 dígitos enteros + 4 decimales. Cubre montos hasta 10 billones AR con precisión sub-centavo.
- **Compute in-memory:** **`Decimal.js`** (única lib permitida). NO `Number`, NO `BigInt`, NO `Big.js`, NO `currency.js`, NO `dinero.js`.
- **Wire format (API/JSON):** string Decimal serializado (ej: `"1234.56"`). NO float, NO number JS.
- **Presentation (UI/print):** formateado con `Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' })`.

## 9.2 Modo de redondeo (DIMENSIÓN 1 — CERRADO)

`HALF_EVEN` (Banker's rounding). **Confirmado por 3 manuales oficiales AFIP** (WSFEv1 COMPG v3.4.2, WSMTXCA v0.25.5, WSFEX v2.1.0).

```typescript
import Decimal from 'decimal.js';
Decimal.set({ rounding: Decimal.ROUND_HALF_EVEN });
```

## 9.3 Stage de redondeo (DIMENSIÓN 2 — 🟡 PROPUESTO, pendiente contador)

`PER_LINE` propuesto:
- Calcular IVA por línea, redondear, sumar.
- Coherente con UI per-line.
- Alternativa: `PER_TAX_BRACKET` (agrupar por alícuota, sumar bases, redondear).

Env: `MONEY_ROUNDING_STAGE=PER_LINE` con fail-fast al boot.

Decisión final pendiente reunión contador (pregunta A-1).

## 9.4 Currency policy (F0 = ARS-only)

- F0: **ARS-only** hardcoded.
- F2+: multi-currency con trigger "primer cliente que pide USD o multi-moneda real".
- NO mezclar monedas en una misma operación monetaria sin conversión explícita documentada.
- NUNCA hacer aritmética sobre `Decimal` de monedas distintas.

## 9.5 Separación storage / compute / presentation

| Stage | Tipo | Reglas |
|---|---|---|
| **Storage** | `numeric(19,4)` | Drizzle column type `numeric({ precision: 19, scale: 4 })`. NUNCA `real`, NUNCA `double`. |
| **Compute** | `Decimal` | Toda operación dentro de `new Decimal(value)`. Resultado intermedio NO redondeado. Solo redondeo al final del cálculo (per-line o per-bracket según stage). |
| **Wire** | string | `decimal.toFixed(4)` o `decimal.toString()` según contexto. JSON.stringify NUNCA toca Decimal directo. |
| **Presentation** | string formateado | `Intl.NumberFormat` con locale `es-AR`. |

## 9.6 Money client-side (ADR-0021)

Cliente recibe Money via **React Context inyectado por server**, NO lee env directo:

```tsx
// app/layout.tsx (Server Component)
<MoneyContextProvider
  policy={{ rounding: 'HALF_EVEN', stage: 'PER_LINE', currency: 'ARS' }}
>
  {children}
</MoneyContextProvider>

// client component
const { calculate } = useMoneyContext();
const preview = calculate({ items, discounts });
```

- Cliente puede mostrar **preview** con Decimal.js client-side.
- **Server SIEMPRE recalcula** contra precios DB al guardar.
- **Si discrepan > $0.01** → server gana + log `price_tampering_attempt`.

## 9.7 Money invariants (ADR-0005)

1. **NO NaN** — toda operación Decimal valida que el input es válido (no NaN, no Infinity).
2. **NO overflow** — montos > 10 billones AR rechazados con error explícito.
3. **NO mezcla de monedas** sin conversión explícita.
4. **NO `Number` en path money** — fail-fast con type guard en boundary.
5. **NO comparación `==` o `===`** entre `Decimal` — usar `.eq()`, `.lt()`, `.gt()`.
6. **NO float JSON** que llegue al servidor sin parseo a Decimal en el boundary.

## 9.8 Anti-patterns prohibidos en path money

- Aritmética con `Number` JS (`a + b`, `a * 0.21`)
- Comparación con `==`/`===`
- `JSON.stringify(decimal)` directo (devuelve "0" porque no hay toJSON definido sin custom)
- `parseFloat(string)` en boundary money
- `toFixed(2)` para cálculo (es solo para presentation)
- Round intermedio múltiples veces (acumula error)
- Aritmética mixta Decimal/Number en una expresión

## 9.9 Test requirements money

- T-MONEY-01: cálculo IVA per-line vs per-bracket en factura compleja (multi-alícuota + descuentos)
- T-MONEY-02: invariante `ImpIVA == sum(Iva[].Importe)` con tolerancia 0 después de proyección WSFEv1
- T-MONEY-03: precio cliente vs precio server discrepancia > $0.01 → server gana + log
- T-MONEY-04: overflow check con monto $999.999.999.999.999,9999
- T-MONEY-05: HALF_EVEN behavior en casos límite (0.005, 0.015, 0.025, ...)
- T-MONEY-06: NO NaN propagation desde input inválido (string vacío, "abc", null)
- T-MONEY-07: round-trip Decimal → string → Decimal sin pérdida

## 9.10 Projection layers money

```
modelo_per_line {
  items: [{ name, qty, unit_price, iva_rate, line_subtotal, line_iva, line_total }]
  discount_global,
  total
}
   ↓ projectToFiscalBreakdown(snapshot)
fiscal_breakdown_per_bracket {
  brackets: [{ rate, base, importe_iva }]
  imp_neto, imp_iva, imp_op_ex, imp_total
}
   ↓ projectToWSFEv1(breakdown, snapshot)
wsfev1_payload {
  ImpNeto, ImpIVA, ImpOpEx, ImpTotal,
  Iva: [{ Id, BaseImp, Importe }]
}
```

Cada proyección es función pura testeada.

---

# 10. Observability Constitution

## 10.1 4 concerns separados (EVENT-TAXONOMY.md v2.0.1)

| Concern | Storage | Retention | Consumer |
|---|---|---|---|
| **audit_log** | Tabla `audit_log` partitioned por año | 10 años (Ley 11.683) — DROP PARTITION | Inspección AFIP, compliance, defensa civil |
| **jobs_queue** | Tabla `jobs_queue` con SKIP LOCKED | 30 días tras completion | Worker dedicado por job_type |
| **metrics_counter** | Tabla `metrics_counter` con whitelist | 90 días F0, F1+ rollup | Dashboards operativos, alertas |
| **Pino logs** | stdout → Vercel/Sentry → archive | 7-30 días según severity | Debugging tiempo real |

**Anti-pattern:** mezclar 4 concerns en una sola tabla. Cada uno tiene lifecycle/retention/consumer propio.

## 10.2 audit_log (EVENT-TAXONOMY §5)

### Schema obligatorio
```sql
CREATE TABLE audit_log (
  id bigserial PRIMARY KEY,
  event_name text NOT NULL,
  event_version int NOT NULL DEFAULT 1,
  tenant_id uuid NOT NULL,
  actor_user_id uuid,
  actor_type text NOT NULL,  -- 'user' | 'system' | 'support' | 'cron' | 'worker'
  correlation_id uuid NOT NULL,
  request_id uuid NOT NULL,
  payload jsonb NOT NULL,
  pii_level text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
) PARTITION BY RANGE (created_at);

-- Partition por año
CREATE TABLE audit_log_2026 PARTITION OF audit_log
  FOR VALUES FROM ('2026-01-01') TO ('2027-01-01');
```

### Trigger inmutabilidad
```sql
CREATE OR REPLACE FUNCTION audit_log_immutable()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is INSERT-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_log_no_update BEFORE UPDATE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION audit_log_immutable();
CREATE TRIGGER audit_log_no_delete BEFORE DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION audit_log_immutable();
```

### Cleanup (DDL, no DELETE)
- Cron diciembre crea partition next year.
- Cron enero drop partition con > 10 años + verificación previa (count > 0 si esperamos data).
- Cleanup deja audit de la propia operación de cleanup.

### Catálogo canónico
32 eventos F0 documentados en [EVENT-TAXONOMY.md §5](EVENT-TAXONOMY.md). Lista por domain: fiscal, sales, stock, cash, auth, multi_tenant, integration, system.

## 10.3 jobs_queue (EVENT-TAXONOMY §6)

### 10 job_types canónicos F0 (catálogo CERRADO)

```typescript
const JOB_TYPES = [
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
```

### 6 reglas operativas (J1-J6)

- **J1** Catálogo CERRADO. Agregar job_type = PR + worker dedicado + aprobación owner técnico.
- **J2** Worker dedicado por job_type. NO handler genérico que despache por tipo. Esa regla previene drift a event bus encubierto.
- **J3** SKIP LOCKED obligatorio. Cero double-processing entre workers concurrentes.
- **J4** Prohibido fan-out implícito. Job NO emite jobs nuevos automáticamente. Si necesita encadenar, encadenar explícitamente en código y documentar.
- **J5** `correlation_id` para trazabilidad operativa, NO para state ownership. El estado de la operación vive en tablas de negocio (sales, invoices), NUNCA derivado de la secuencia de jobs.
- **J6** Eliminación de job_type = remover del enum + dejar entry en DECISION-LEDGER. NO marcar "deprecated" silencioso.

### Schema
```sql
CREATE TABLE jobs_queue (
  id bigserial PRIMARY KEY,
  job_type text NOT NULL,
  tenant_id uuid NOT NULL,
  correlation_id uuid NOT NULL,
  last_request_id uuid,  -- nullable hasta primer attempt
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending',  -- pending|running|done|failed|manual
  attempts int NOT NULL DEFAULT 0,
  next_retry_at timestamptz NOT NULL DEFAULT now(),
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

## 10.4 metrics_counter (EVENT-TAXONOMY §7)

### Schema
```sql
CREATE TABLE metrics_counter (
  metric_name text NOT NULL,
  tag_key text NOT NULL DEFAULT '',
  tag_value text NOT NULL DEFAULT '',
  tenant_id uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  bucket_hour timestamptz NOT NULL,
  counter bigint NOT NULL DEFAULT 0,
  PRIMARY KEY (metric_name, tag_key, tag_value, tenant_id, bucket_hour)
);

-- SYSTEM_TENANT_ID constante para métricas system-wide
```

### Whitelist obligatoria
```typescript
const METRIC_WHITELIST = {
  'afip.cae_received': {
    scope: 'tenant',
    allowedTagKeys: ['invoice_type'],
    allowedValues: { invoice_type: ['A', 'B', 'C'] },
    cardinalityWarn: 3,
  },
  'reconciliation.outcome': {
    scope: 'tenant',
    allowedTagKeys: ['outcome'],
    allowedValues: { outcome: ['cae_received', 'cae_recovered', 'reconciliation_timeout', 'manual_required', 'rejected'] },
    cardinalityWarn: 5,
  },
  // ... resto en EVENT-TAXONOMY.md
};

function incrementCounter(metric, tags) {
  validateAgainstWhitelist(metric, tags); // throw si no autorizado
  // INSERT ... ON CONFLICT DO UPDATE SET counter = counter + 1
}
```

**Cron mensual** monitorea cardinality drift. Alerta si una métrica supera su `cardinalityWarn`.

## 10.5 Pino logs (debugging)

### Configuración
- **Formato:** structured JSON.
- **Niveles:** trace / debug / info / warn / error / fatal.
- **Auto-inject:** Proxy que lee AsyncLocalStorage e inyecta `correlation_id` + `request_id` + `tenant_id` automáticos.
- **NO console.log NUNCA** (excepto en `next dev` debugging puntual antes de commit).

### Pino Proxy auto-inject
```typescript
const logger = new Proxy(basePino, {
  get(target, prop) {
    if (typeof target[prop] === 'function') {
      return (...args) => {
        const ctx = getTracingContext(); // AsyncLocalStorage
        const enrichedArgs = enrichWithCtx(args, ctx);
        return target[prop](...enrichedArgs);
      };
    }
    return target[prop];
  }
});
```

### Qué se loguea
- **info:** operaciones normales (venta cobrada, factura emitida, login).
- **warn:** anomalías recuperables (cache miss, retry necesario, padron timeout con fallback).
- **error:** errores manejados pero no esperados (AFIP rechazo, validación fallida del cliente).
- **fatal:** errores no recuperables (DB inalcanzable, cert vencido al boot).

### Qué NUNCA se loguea (SECRET LIST)
- Tokens WSAA AFIP
- Certificados X.509
- Passwords (ni hasheadas)
- Session tokens
- API keys de MercadoPago / proveedores
- Encryption keys (`SECRETS_ENCRYPTION_KEY_V*`)
- Body completo de webhooks entrantes (sólo metadata: source, event_id, hash)
- Datos de tarjeta de crédito completos (sólo last4)

## 10.6 Correlation propagation (CORRELATION-PROPAGATION.md v1.0.0)

### 2 IDs canónicos F0

- **`correlation_id`** — UUID v4, life span = operación lógica (segundos a horas). Hereda entre layers.
- **`request_id`** — UUID v4, life span = un HTTP request o un job attempt (milisegundos a segundos). Nuevo en cada request/attempt.

### Propagación
- **Cliente:** genera `correlation_id` al iniciar operación. Persiste en `sessionStorage` indexado por `operationKey` (ej: `sale:${draftSaleId}`). Recovery post-cierre desde server (`sales.correlation_id`).
- **Middleware Next.js:** genera `request_id` SIEMPRE por cada HTTP. Lee `x-correlation-id` del cliente (warning log si falta + lista cerrada de exentos: `/api/webhooks/`, `/api/health`, `/api/internal/cron/`, `/api/public/`).
- **Bridge Edge → Node:** middleware (Edge) propaga headers. `withServerActionTracing()` (Node) lee headers + monta AsyncLocalStorage.
- **Worker:** hereda `correlation_id` del `jobs_queue.correlation_id`. Genera nuevo `request_id` por attempt. Updatea `jobs_queue.last_request_id`.
- **Cron:** genera nuevo `correlation_id` (operación independiente).
- **Realtime broadcasts:** payload incluye `correlation_id`. Cliente filtra por su `correlation_id` activo.
- **AFIP SOAP:** best effort `X-Correlation-Id` header custom (AFIP lo ignora pero proxy intermedio puede loguearlo).

### Persistencia en entidades
- `sales.correlation_id` — SÍ (operación crítica multi-step)
- `invoices.correlation_id` — SÍ (investigación fiscal)
- `audit_log.correlation_id` + `request_id` — SIEMPRE NOT NULL
- `jobs_queue.correlation_id` + `last_request_id` — SIEMPRE
- `products.correlation_id` — NO (operación trivial)
- `cart_items.correlation_id` — NO (transitoria)

Criterio: solo si vale para investigación posterior.

## 10.7 Realtime broadcasts

- Canal: `tenant:{tenant_id}:events`
- Payload SIEMPRE incluye `correlation_id`
- Cliente se suscribe al canal de su tenant + filtra broadcasts por `correlation_id` activo
- Helper `publishRealtimeEvent()` inyecta `correlation_id` desde context

## 10.8 Operator tooling F0

4 queries SQL canónicas:
- **Q1** — Active reconciliations (sales en `requires_reconciliation` o `recovery`)
- **Q2** — Dead jobs (`jobs_queue` con status `manual` > 24h)
- **Q3** — Poison events (`audit_log` con `fiscal.poison_detected`)
- **Q4** — Investigation por correlation_id (cross-join audit + jobs + sales + logs)

UI dashboard diferido F0.5/F1+.

## 10.9 Required metadata por log/event

| Campo | Obligatorio | Source |
|---|---|---|
| `correlation_id` | Sí | AsyncLocalStorage |
| `request_id` | Sí | AsyncLocalStorage |
| `tenant_id` | Sí (excepto system) | AsyncLocalStorage |
| `actor_user_id` | Sí (excepto cron/system) | Auth context |
| `actor_type` | Sí | Set explícito al iniciar context |
| `event_name` (audit) | Sí | Catálogo cerrado |
| `pii_level` (audit) | Sí | Schema enum |
| `severity` (audit) | Sí | Schema enum |

---

# 11. Security Constitution

> Detalle completo: ADR-0019 con S1-S16. Esta sección consolida lo accionable.

## 11.1 CSP (Content Security Policy)

- Configurada como header desde Next.js middleware.
- Plantilla en ADR-0019 S1. Marcada como PLANTILLA + checklist calibración.
- Nonce-based para scripts inline (NO `unsafe-inline` salvo style F0 con justificación).
- Reportar violaciones a endpoint propio + Sentry.

## 11.2 Rate limiting (ADR-0019 S2)

- F0: in-memory por proceso Vercel (alcanza para 5 clientes).
- F1+ trigger: > 100 req/s sostenidos → migrar a Upstash Redis con TTL cleanup obligatorio.
- Endpoints públicos: 100 req/min por IP.
- Endpoints autenticados: 1000 req/min por tenant.
- Login: 5 attempts/min por IP + 10 attempts/hora por email.

## 11.3 HMAC + replay protection en webhooks (ADR-0019 S3 + S3-bis)

```typescript
async function validateWebhook(req) {
  const signature = req.headers['x-signature'];
  const timestamp = req.headers['x-timestamp'];
  const eventId = req.headers['x-event-id'];
  const body = await req.text();

  // (1) Validar HMAC
  const expected = hmacSha256(secretForProvider, `${timestamp}.${body}`);
  if (!timingSafeEqual(signature, expected)) throw new Error('Invalid signature');

  // (2) Validar timestamp dentro de ventana ±5min
  if (Math.abs(Date.now() / 1000 - parseInt(timestamp)) > 300) {
    throw new Error('Timestamp out of window');
  }

  // (3) Dedup por event_id en `processed_webhook_events`
  const alreadyProcessed = await db.insert(processedWebhookEvents)
    .values({ event_id: eventId, provider, processed_at: new Date() })
    .onConflictDoNothing()
    .returning();
  if (alreadyProcessed.length === 0) throw new Error('Event already processed');

  return JSON.parse(body);
}
```

## 11.4 TLS 1.2+ obligatorio (ADR-0019 S15)

- `minVersion: 'TLSv1.2'` en cliente AFIP SOAP.
- `rejectUnauthorized: true` siempre.
- Métricas de TLS handshake fallido.
- Bypass de TLS validation **PROHIBIDO** explícitamente. Pattern común en industria, rechazado.

## 11.5 NTP sync (ADR-0019 S16)

- Función `getCurrentFiscalTime()` con drift check vs NTP server.
- Threshold 5s. Si drift > 5s → bloquear emisión fiscal (fail-closed).
- Métrica `system.ntp_drift_seconds`.

## 11.6 Session security (ADR-0019 S12)

- Idle timeout: 30 min
- Absolute timeout: 12h
- Rotation al cambiar password o rol
- Revocación admin con audit
- JWT corto (15min) + refresh token (12h)

## 11.7 SameSite policy (ADR-0019 S10)

- Cookies default `SameSite=Lax`
- Strict por excepción (sesión admin)
- Secure obligatorio
- HttpOnly obligatorio para auth cookies

## 11.8 Secret lifecycle (ADR-0019 S5 + S5-bis + S13)

### Versioning
```bash
SECRETS_ENCRYPTION_KEY_V1=<hex 64>
SECRETS_ENCRYPTION_KEY_V2=<hex 64>  # añadido al rotar
SECRETS_ENCRYPTION_KEY_ACTIVE_VERSION=2
```

- Rotación: agregar V2 → cambiar ACTIVE_VERSION → re-encriptar gradualmente → eliminar V1 cuando seguro.
- AES-256-GCM at-rest.
- Cliente NUNCA accede a keys.

### Categorías de secretos
| Categoría | Storage | Acceso |
|---|---|---|
| Encryption keys (`SECRETS_ENCRYPTION_KEY_V*`) | Env vars Vercel | Server only, NUNCA loguear |
| Certificados AFIP X.509 por tenant | Supabase Storage encrypted | Service AFIP + audit |
| AFIP cert passwords | Vault encrypted con encryption key | Service AFIP |
| Webhook signing secrets (MP, etc) | Env vars o vault | Service webhook validation |
| Service role Supabase | Env var | Solo path admin específico |
| WSAA tokens | Cache memoria + DB cache | NUNCA loguear |

### Homo vs Prod hard isolation (ADR-0019 S13)
- Certs homo NUNCA llegan a endpoint prod
- Validación en código + audit
- `AFIP_ENVIRONMENT=homologacion|produccion` env var con fail-fast

## 11.9 Backup security (ADR-0019 S14)

- Supabase managed backups (incluido en plan)
- Restore test MENSUAL (cron documentado)
- Backup retention 30 días F0, 90 días F1+
- Backups encrypted at-rest (Supabase managed)

## 11.10 Threat model F0 (ADR-0019)

| Actor | Amenaza | Mitigación |
|---|---|---|
| Atacante externo no-autenticado | DDoS, SQL injection, XSS | Rate limiting + Zod validation + CSP + RLS |
| Comerciante competidor pagando | Cross-tenant leak para ver datos | RLS + service validation + tests cross-tenant |
| Empleado del comerciante con permisos limitados | Privilege escalation | RBAC granular + audit log |
| Atacante con credenciales filtradas | Session hijack | TLS + SameSite + rotation + idle timeout |
| Insider Pandora team | Acceso indebido a datos cliente | Support mode flag + audit + 2h limit |
| Pandora misma (bug) | Fuga por bug | Tests cross-tenant + fail-closed + circuit breakers |
| AFIP / proveedor caído | Bloqueo operación | Fallback documentado + reconciliación |

## 11.11 PII classification operacional (ADR-0019 S8)

| `pii_level` | Ejemplo | Retention default | Acceso |
|---|---|---|---|
| `public` | Nombre comercial público, precios | Sin límite | Cualquier rol |
| `internal` | Métricas internas, configuración | 1 año | Internal staff |
| `pii_low` | Email del usuario, CUIT del comerciante | 5 años | Auth |
| `pii_high` | DNI/CUIT cliente final, domicilio fiscal | 10 años (Ley 11.683) | Auth + audit |
| `secret` | Passwords, tokens, keys | N/A — encrypted | Service role |

**Mapping legal exacto pendiente abogado** (pregunta B-9).

## 11.12 Pendientes seguridad (abogado)

| ID | Pregunta | Bloquea |
|---|---|---|
| B-1 | Responsabilidad civil error fiscal + RC profesional + SRL | T&C + decisión societaria |
| B-2 | Inscripción AAIP — cómo declarar SaaS multi-tenant + cronograma + riesgo piloto | Lanzamiento real |
| B-3 | Plazo + formato notificación breach AAIP | Runbook `security-incident.md` |
| B-4 | Responsabilidades fuga cross-tenant | Runbook `cross-tenant-leak.md` |
| B-5 | Conservación legal docs NO fiscales | Tabla retention canónica |
| B-7 | Cláusulas T&C | `terminos-y-condiciones-v1.md` |
| B-8 | DPA + Privacy Policy | `politica-de-privacidad-v1.md` |
| B-9 | Mapping legal `pii_level` vs Ley 25.326 | ADR-0019 S8 mapping |
| B-10 | ARCO vs conservación fiscal 10 años | Runbook `arco-request.md` |

---

# 12. State Machine Constitution

## 12.1 Filosofía de estados

- **Cada entidad crítica tiene una máquina de estados explícita.**
- Estados son **finitos, nombrados, documentados** en código (TypeScript enum/literal types).
- Transiciones permitidas declaradas explícitamente. Transición no permitida → throw.
- Cada transición emite **evento canónico** en `audit_log`.
- Cada estado terminal es claramente terminal (no se transiciona desde ahí).
- Estados que requieren intervención humana son explícitos.

## 12.2 Estados de venta (`sales.commercial_status` + `sales.fiscal_status`)

### `commercial_status`
```
draft → in_progress → cobrando → cobrada → terminada
                                      ↓
                                   cancelada
```

### `fiscal_status` (RECONCILIATION-ENGINE §2)
```
not_required (venta sin facturación)
   ─────────────
pending → requesting → issued                       ← happy path
                    → reconciled_issued             ← recovery exitoso
                    → requires_reconciliation → recovery → ...
                    → manual_resolution_required   ← terminal humano
                    → failed → manual_resolution_required  ← AFIP rechazó explícito (payload inválido)
                    → number_burned → manual_resolution_required  ← decisión técnica de no reusar número
                    → contingency                   ← AFIP outage extendido
```

**Estados terminales:** `issued`, `reconciled_issued`, `not_required`, `manual_resolution_required`. Los estados `failed` y `number_burned` son intermedios — siempre transicionan a `manual_resolution_required` (no se quedan ahí).

### Transiciones permitidas
| From | To | Trigger | Quién |
|---|---|---|---|
| `pending` | `requesting` | Service inicia WSFEv1 | Service emisión |
| `requesting` | `issued` | CAE recibido OK | Service emisión |
| `requesting` | `requires_reconciliation` | Timeout 30s | Service emisión |
| `requesting` | `failed` | AFIP rechazo explícito | Service emisión |
| `requesting` | `contingency` | AFIP outage detectado | Service + circuit breaker |
| `requires_reconciliation` | `reconciled_issued` | Worker recovery exitoso (`validateRecoveredCae()` OK) | Worker |
| `requires_reconciliation` | `number_burned` | Worker detecta `cae_recovery_mismatch` | Worker |
| `requires_reconciliation` | `requires_reconciliation` | Worker retry (attempts < 24) | Worker |
| `requires_reconciliation` | `manual_resolution_required` | MAX_ATTEMPTS = 24 → `reconciliation_timeout` | Worker |
| `contingency` | `issued` | AFIP vuelve OK + worker retry | Worker |
| `contingency` | `manual_resolution_required` | 2h sin AFIP | Worker |
| `failed` | `manual_resolution_required` | Audit + notificación operador | Service emisión |
| `number_burned` | `manual_resolution_required` | Operator decide próximo paso | Operator |

### Estados terminales
- `issued` — happy path
- `reconciled_issued` — recovery exitoso
- `not_required` — venta sin facturación
- `manual_resolution_required` — humano debe resolver

### Estados intermedios (no terminales, siempre transicionan a `manual_resolution_required`)
- `failed` — AFIP rechazó payload (bug nuestro → fix → re-emitir manual)
- `number_burned` — número fiscal perdido (decisión técnica de no reusar)

### Transiciones PROHIBIDAS
- `issued` → cualquier cosa (terminal)
- `reconciled_issued` → cualquier cosa (terminal)
- `manual_resolution_required` → automático (solo operator manual con audit explícito)
- `failed` / `number_burned` → automático sin pasar por `manual_resolution_required` con audit

## 12.3 Estados de stock (`stock_movements.movement_type`)

```
sale (egreso por venta)
purchase (ingreso por compra)
adjustment (ajuste manual con motivo obligatorio)
return (retorno)
loss (pérdida/merma)
```

Sin máquina de estados compleja F0 — cada movimiento es un INSERT inmutable con motivo.

## 12.4 Estados de cash (`cash_sessions`)

```
open → counting → closed
```

- Sólo una `cash_session` abierta por (tenant, sale_point) a la vez (unique index parcial).
- Cierre con descuadre genera `audit_log` + motivo obligatorio.

## 12.5 Estados de demo lifecycle (ADR-0020)

```
trial (días 1-60) → read_only (días 61-82) → archived (día 82+)
                          ↑
                  ACTIVATE_PAID → active (sin expiración)
```

- Cron diario evalúa transición.
- Día 60: notificación email + UI banner.
- Día 61: bloquea writes, permite reads.
- Día 82: archive (datos preservados, login bloqueado).
- Comerciante puede activar plan pagando antes de día 82 → `active`.

## 12.6 Estados de jobs (`jobs_queue.status`)

```
pending → running → done
                  ↘ failed → (retry hasta MAX_ATTEMPTS) → manual
                  ↘ poisoned (detección inmediata)
```

## 12.7 Diagram philosophy

- Cada máquina de estados se documenta en:
  - **Código** (enum/literal types + transition function pura)
  - **CLAUDE.md o ADR** (este documento o ADR específico)
  - **Test** (matrix de transiciones válidas + inválidas)

## 12.8 Anti-patterns prohibidos en state machines

- "estado calculado" (derivar de otros campos sin persistir explícito)
- Transiciones implícitas (sin función dedicada que las maneje)
- Updates directos a `fiscal_status` desde código de negocio (sólo helpers transitions)
- Estado en payload jsonb (debe ser columna)
- "estados temporales" usados como flags (preferir columnas booleanas o nuevo estado)

---

# 13. Reliability & Recovery Constitution

## 13.1 Filosofía

- **Failure no es excepción, es default.** Diseñar asumiendo que AFIP cae, network falla, worker crashea, browser se cierra, DB tiene latencia.
- **Recovery explícito > silencioso.** Si algo recupera, debe loguear/auditar la recuperación.
- **Fail-closed > fail-open** en path crítico (fiscal, money, multi-tenant).
- **Operator tooling > magic.** Mejor que un operator pueda destrabarse con SQL que un sistema mágico que se cura solo y oculta el problema.

## 13.2 Retries (ADR-0011)

### Tipos de retry

| Tipo | Cuándo | Implementación |
|---|---|---|
| **Serializable retry** | Conflictos de concurrencia DB (40001) | Helper `withSerializableRetry()` con backoff exponencial hasta 3 attempts |
| **Idempotent client retry** | Network timeout, 5xx transient | Cliente puede reintentar mismo `idempotency_key` → server devuelve resultado cacheado |
| **Worker retry** | Job failed transient | Backoff documentado por job_type |
| **AFIP retry** | Lineal 5min × 24 = 2h ventana | NO exponencial (no rate-limited) |

### Idempotency obligatoria (ADR-0010)

- Toda mutation crítica acepta `idempotency-key` header.
- Server registra en `idempotency_log` con UNIQUE constraint.
- Si key duplicada → devuelve resultado cacheado (no reejecuta).
- Cleanup: keys > 7 días eliminadas por cron.

## 13.3 SKIP LOCKED en workers (RECONCILIATION-ENGINE §3)

```sql
SELECT * FROM jobs_queue
WHERE status = 'pending' AND next_retry_at <= now()
ORDER BY created_at
LIMIT 1
FOR UPDATE SKIP LOCKED;
```

**Garantía:** cero double-processing entre workers concurrentes.

## 13.4 Dead letter philosophy

- **NO discard automático.** Tras MAX_ATTEMPTS → `manual_resolution_required` + alerta.
- **Operator decide:** re-enqueue / discard con razón / resolve manual.
- **Mejor reconciliación tardía** que decisión apresurada.

## 13.5 Poison detection

- Detección **inmediata** (primer attempt), NO esperar 5 reintentos.
- Triggers:
  - `job_type` desconocido
  - Payload shape inválido (Zod fail)
  - Tenant ID malformado
  - Campos críticos null/undefined inesperados
- Acción: aislamiento + `audit_log: 'fiscal.poison_detected'` + métrica `reconciliation.poison_jobs_detected`.

## 13.6 Browser crash recovery (CORRELATION-PROPAGATION §5)

- **`sessionStorage`** indexado por `operationKey` (ej: `sale:${draftSaleId}`).
- Sobrevive **reload**, NO sobrevive **cierre de tab**.
- Recovery post-cierre: fetch desde server (`sales.correlation_id` u otra entidad).
- Hook `useOperationCorrelationId(operationKey)` + helper `clearOperationCorrelationId()` post-completion.
- **localStorage RECHAZADO** (corrupción multi-tab + cleanup activo difícil).

## 13.7 Worker continuity

- Worker hereda `correlation_id` del `jobs_queue.correlation_id`.
- Genera nuevo `request_id` propio por cada attempt.
- Updatea `jobs_queue.last_request_id` al empezar attempt → permite investigar "qué pasó en attempt #3".

## 13.8 Realtime degradation

- **Si Supabase Realtime falla:** cliente NO se entera de updates automáticos.
- **Fallback:** al reabrir POS o refrescar página, fetch fresh de `sales` muestra estado actualizado.
- **NO polling F0** (costoso, complicaría rate limits).
- **F1+ trigger:** si Realtime cae frecuentemente, considerar polling adaptativo.

## 13.9 Fail-closed semantics (ADR-0022 + §8.12)

Ver §8.12 para escenarios fiscales. Principio general:

> Ante incertidumbre **en path crítico** (fiscal, money, multi-tenant): **NO PROCEDER**. Estado intermedio explícito > operación con datos inciertos.

Fail-closed ≠ fail-rude. UX debe explicar al usuario qué pasó y qué hacer.

## 13.10 Partial failure handling

| Escenario | Acción |
|---|---|
| Cobro MercadoPago OK, registro DB falla | Compensación: marcar venta `pending_persist` → worker reintenta. Si tras N intentos no resuelve, manual + alerta. |
| Stock decremento OK, AFIP timeout | `fiscal_status = requires_reconciliation`. Stock se conserva (no se restaura, AFIP puede confirmar después). |
| AFIP CAE OK, email factura falla | CAE persistido. Email a retry queue. Cliente puede descargar PDF del POS. |
| Multiple webhooks MP de la misma operación | Idempotency dedup por `event_id` en `processed_webhook_events`. |

## 13.11 Recovery tests obligatorios

- **T-REC-01:** AFIP timeout → worker recovery exitoso con FECompUltimoAutorizado
- **T-REC-02:** Worker crash mid-processing → otro worker no procesa el mismo job (SKIP LOCKED)
- **T-REC-03:** Browser reload mid-venta → `correlation_id` recovered desde sessionStorage
- **T-REC-04:** Browser tab close mid-venta → al reabrir, sales pendiente con `correlation_id` visible
- **T-REC-05:** Poison job detección inmediata + aislamiento + audit
- **T-REC-06:** AFIP retorna mismatch en recovery → no acepta + manual
- **T-REC-07:** MP webhook duplicado → segundo ignorado

## 13.12 Operator responsibilities

| Situación | Operator técnico Pandora |
|---|---|
| `manual_resolution_required` > 5/día por tenant | Investigar — algo sistémico mal |
| `reconciliation_timeout` > 1/día | AFIP outage real o bug nuestro |
| `poison_jobs_detected` > 0/día | **Bug crítico — investigar inmediato** |
| `dead_jobs_waiting` > 10 sin atender | Operator olvidó procesar |
| Cross-tenant access attempt en audit | Investigar + reportar a comerciante afectado si confirmado |

---

# 14. UI/UX Constitution

## 14.1 3 atmospheres (ADR-0012)

| Atmosphere | Uso | Características |
|---|---|---|
| **Operational** | POS, caja, operaciones rápidas | Density alta, 60fps target, keyboard-first, sin animaciones decorativas |
| **Insight** | Dashboards, reportes, vista contador | Density media, charts SVG, breathing room |
| **Ceremonial** | Onboarding, paywall, lanzamiento producto | Density baja, motion intencional, fotos/branding |

## 14.2 Dawn Sky identidad (ADR-0016)

- Paleta primaria: dawn sky gradients (oklch-based)
- Glass material con degradación (ver §14.4)
- Tipografía: Geist Sans (UI), Geist Mono (data/numbers)
- Iconografía: Lucide React
- Identidad PERMANENTE F0 — no se reemplaza por temas

## 14.3 Density (ADR-0017)

```css
:root {
  --density-tight: 4px;
  --density-compact: 8px;
  --density-comfortable: 16px;
  --density-spacious: 32px;
}

[data-atmosphere="operational"] {
  --density: var(--density-tight);
}
[data-atmosphere="insight"] {
  --density: var(--density-compact);
}
[data-atmosphere="ceremonial"] {
  --density: var(--density-spacious);
}
```

Toda spacing en componentes deriva de `--density` o múltiplos.

## 14.4 Glass system con degradación (ADR-0013)

Detecta hardware capability al boot:

```typescript
const supportsGlass = (
  CSS.supports('backdrop-filter', 'blur(20px)') &&
  navigator.hardwareConcurrency >= 4 &&
  // ... otros checks
);
document.documentElement.dataset.glass = supportsGlass ? 'full' : 'degraded';
```

CSS:
```css
[data-glass="full"] .glass {
  backdrop-filter: blur(20px);
  background: rgba(255, 255, 255, 0.7);
}
[data-glass="degraded"] .glass {
  /* fallback solid color */
  background: rgba(255, 255, 255, 0.95);
}
```

## 14.5 Charts SVG puros (ADR-0014)

- NO Recharts, NO D3, NO Chart.js
- Componentes SVG propios en `src/components/charts/`
- Datos pre-procesados server-side
- Animaciones via CSS / `@property` (no JS)
- Razones: bundle size, performance, control total, no abstraction debt

## 14.6 Motion presets (ADR-0015)

```typescript
export const MOTION_PRESETS = {
  'fade-in-fast': { duration: 150, easing: 'ease-out' },
  'slide-up-modal': { duration: 250, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' },
  'pop-success': { duration: 350, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)' },
  // ... lista cerrada
} as const;
```

NO animaciones ad-hoc. Si necesita motion nueva → agregar preset + justificación.

## 14.7 Performance targets

| Métrica | Target |
|---|---|
| **POS first interaction** | < 2s (LCP) |
| **Venta cobrada P95** | < 3s end-to-end (incluye AFIP) |
| **Animación operational** | 60fps consistente |
| **Bundle size POS** | < 300kb gzipped |
| **TTI** | < 3s en 3G simulado |

## 14.8 Accessibility expectations

- WCAG AA target F0
- Keyboard navigation obligatoria en POS (cajero opera sin mouse)
- Focus visible en todos los elementos interactivos
- aria-labels en iconos sin texto
- Contraste mínimo 4.5:1 (texto normal) / 3:1 (texto grande)
- Tests con axe-core automáticos en CI

## 14.9 Operational UX (POS)

- **Keyboard-first:** atajos para todas las acciones críticas
  - F1: ayuda
  - F2: agregar producto
  - F3: buscar cliente
  - Enter: confirmar
  - Esc: cancelar
  - Ctrl+P: imprimir último
- **Sin modal bloqueante** durante venta activa (excepto confirmación crítica)
- **Feedback inmediato:** cada acción tiene visual feedback < 100ms
- **Errores claros:** mensajes en español rioplatense, sin jerga técnica, con acción sugerida
- **Estados intermedios visibles:** "comunicando con AFIP" con timer visible
- **Recovery natural:** si algo falla, ofrecer reintentar O cancelar O continuar provisorio

## 14.10 Responsiveness

| Breakpoint | Uso |
|---|---|
| Mobile 320-768 | POS móvil, vista comerciante en celular |
| Tablet 768-1024 | POS tablet (más común en TDF) |
| Desktop 1024-1920 | POS desktop + dashboard contador |
| Wide 1920+ | Dashboard multi-monitor |

POS prioriza tablet (común en retail TDF).

## 14.11 Hardware degradation

| Capability check | Fallback |
|---|---|
| `backdrop-filter` no soporte | Glass solid color |
| `hardwareConcurrency < 4` | Glass solid color + motion reducido |
| `prefers-reduced-motion` | Motion mínimo + transitions cortas |
| Conexión slow (< 3G) | Defer non-critical assets |
| Touch device | Hover styles → focus/active styles |

## 14.12 Visual invariants

1. **Densidad coherente** dentro de cada atmosphere (no mezclar densities).
2. **Charts SVG** — siempre SVG propio.
3. **Money formateado** — siempre `Intl.NumberFormat es-AR`.
4. **Dawn Sky paleta** — sin colores ad-hoc fuera del design system.
5. **Motion preset** — sin animaciones improvisadas.

## 14.13 Forbidden UI patterns

- Modal stacking > 2 niveles
- Loading spinner sin mensaje (al menos 1s+ requiere mensaje)
- Toast notifications para errores fiscales (usar bloque inline + escalado)
- Texto rojo sin acción asociada (color por color es decorativo, debe acompañarse de info)
- Auto-submit en form con money (siempre confirmación explícita)
- "Click here" / "Hacé click acá" — usar texto descriptivo
- Iconos sin label en POS operational (cajero novato debe entender sin training)

---

# 15. Backend Execution Rules

## 15.1 Application Services TypeScript (ADR-0003)

- Toda lógica de negocio en clases o funciones TypeScript en `src/lib/services/**`.
- NO lógica en plpgsql (excepto triggers de inmutabilidad / updated_at).
- Services son testeables sin DB (inject repositories).
- Services orquestan: validar input → llamar domain → persistir → emit event.

## 15.2 Transaction boundaries

- Una operación de negocio = una transacción DB.
- `audit_log` insert dentro de la misma transacción que la mutación.
- Llamadas externas (AFIP, MP) FUERA de la transacción cuando posible.
- Cuando AFIP debe estar dentro (numeración fiscal con lock pesimista):
  - BEGIN
  - SELECT FOR UPDATE de invoice_sequences
  - UPDATE next_number
  - Llamada AFIP SOAP (la transacción permanece abierta)
  - Si AFIP OK → INSERT invoice + COMMIT
  - Si AFIP rechazo → ROLLBACK (número no se incrementa)
  - Si AFIP timeout → COMMIT con número reservado + sale en `requires_reconciliation`

## 15.3 Validation layers

```
Request input (FormData / JSON)
    ↓
Zod schema en boundary (Server Action / Route Handler)
    ↓ (failed → 422 with field errors)
Service layer (asume input válido)
    ↓
Domain layer (puro, asume input válido)
    ↓
DB layer (Drizzle + RLS + constraints)
```

NO validar el mismo input en múltiples capas. Validar en boundary + trust downstream.

## 15.4 Queue discipline (jobs_queue)

- Worker dedicado por `job_type` (regla J2 EVENT-TAXONOMY).
- Worker pattern:
  ```typescript
  while (true) {
    await withWorkerTracing(jobType, async () => {
      const job = await fetchNextJobWithSkipLocked(jobType);
      if (!job) {
        await sleep(POLL_INTERVAL);
        return;
      }

      if (isPoison(job)) {
        await markPoisoned(job, 'reason');
        return;
      }

      try {
        await processJob(job);
        await markDone(job);
      } catch (err) {
        await markFailedWithRetry(job, err);
      }
    });
  }
  ```

## 15.5 Domain ownership

Cada módulo de dominio (`fiscal`, `sales`, `stock`, `cash`, `auth`, `multi_tenant`) tiene:
- Owner técnico claro (Pandora team)
- Folder dedicado en `src/lib/{domain}/`
- Services TypeScript
- Domain functions puras
- Tests dedicados
- Documentación de invariantes en CLAUDE.md o ADR

## 15.6 API conventions

### Server Actions (preferido para mutations)
- Async functions en archivos con `'use server'`.
- Reciben `FormData` o objetos serializables.
- Return `{ ok: true, data }` o `{ ok: false, errors }`.
- Lanzan errores solo para 500 (fallos no esperados).

### Route Handlers (`/api/...`)
- Solo para webhooks entrantes, public endpoints, integraciones.
- REST naming convencional.
- HTTP status codes apropiados.
- Response envelope: `{ ok, data?, error? }`.

### Naming
- Endpoints: `/api/[resource]/[action]` o REST `/api/[resource]/:id`
- Server Actions: `verbResource()` (ej: `cobrarVenta`, `emitirFactura`)
- Services: `ResourceService.action()` (ej: `SaleService.charge()`)

## 15.7 Error strategy

### Errores tipados
```typescript
export class DomainError extends Error {
  constructor(
    public code: string,
    public messageEs: string,
    public statusCode: number = 400
  ) {
    super(messageEs);
  }
}

export class FiscalIntegrityError extends DomainError {
  constructor(messageEs: string) { super('FISCAL_INTEGRITY', messageEs, 422); }
}

export class CrossTenantAccessError extends DomainError {
  constructor() { super('CROSS_TENANT_ACCESS', 'Acceso denegado', 403); }
}
```

### Handling
- Boundary (Server Action / Route Handler) atrapa errores tipados → response formateada.
- Errores no tipados → 500 + Sentry + Pino fatal.
- NO `try { ... } catch { /* nada */ }` (silent failure prohibido).
- NO `console.error` (usar Pino).

## 15.8 Schema evolution + migration discipline

- Drizzle Kit para migraciones (`pnpm drizzle-kit generate`).
- Cada migración revisada antes de merge.
- Migraciones reversibles cuando posible.
- Migraciones forward-only para audit_log y otras append-only.
- Para deploys:
  - Migración aditiva primero (nueva columna nullable)
  - Deploy app que usa columna
  - Migración para constraints (NOT NULL, FK)
- NUNCA migrar datos en migración estructural (separar data migration).

## 15.9 Testing expectations

Ver §18. Todo service crítico tiene tests unitarios + integración.

---

# 16. Database Constitution

## 16.1 Naming

- Tablas: `snake_case` plural (ej: `sales`, `invoice_sequences`, `audit_log`)
- Columnas: `snake_case` (ej: `created_at`, `tenant_id`, `fiscal_status`)
- Indexes: `idx_{tabla}_{columnas}` (ej: `idx_sales_tenant_id_created_at`)
- Constraints: `chk_{tabla}_{check}`, `fk_{tabla}_{ref}`, `uq_{tabla}_{cols}`
- Enums: `text` con CHECK constraint (preferido) o `pg_enum` solo si se justifica
- Funciones: `snake_case` (ej: `audit_log_immutable()`)
- Triggers: `{tabla}_{evento}_{cuando}` (ej: `audit_log_no_update`)

## 16.2 Indexing

- Toda FK indexed
- Toda columna en WHERE frecuente indexed
- Composite index para queries multi-columna (orden por selectividad)
- Index parcial para columnas con cardinalidad muy desbalanceada
- Vacuum/analyze regular (auto en Supabase managed)
- NO over-index (cost write > benefit read)

## 16.3 FK policy

- Toda relación con FK explícita
- `ON DELETE RESTRICT` default (no orphan auto-delete)
- `ON DELETE CASCADE` solo cuando explícito (ej: `cart_items` → `cart`)
- `ON UPDATE NO ACTION` (no se actualizan PKs)
- `DEFERRABLE INITIALLY DEFERRED` para circular refs cuando necesario

## 16.4 Retention y partitioning

| Tabla | Retention | Strategy |
|---|---|---|
| `audit_log` | 10 años | Partition por año + DROP PARTITION cron enero |
| `jobs_queue` | 30 días tras `done` | Cron diario DELETE |
| `metrics_counter` | 90 días F0 | Cron mensual DELETE > 90d (F1+ rollup a daily) |
| `processed_webhook_events` | 7 días | Cron diario DELETE > 7d |
| `idempotency_log` | 7 días | Idem |
| `sessions` (Supabase Auth) | managed por Supabase | — |
| `sales`, `invoices`, `fiscal_snapshots` | Permanente (10 años fiscal) | NO eliminar |

## 16.5 Append-only tables

| Tabla | Append-only | Enforcement |
|---|---|---|
| `audit_log` | Sí | Trigger inmutable |
| `fiscal_snapshots` | Sí | Trigger inmutable (no UPDATE post-creación) |
| `stock_movements` | Sí | Trigger inmutable (cancelación = nuevo movimiento, no UPDATE) |
| `invoices` | Sí post-CAE | Trigger inmutable de campos fiscales |
| `processed_webhook_events` | Sí | UNIQUE + no UPDATE |

## 16.6 Constraints obligatorios

- `NOT NULL` por default. Nullable explícito con justificación.
- `CHECK` para enums y rangos.
- `UNIQUE` para identificadores naturales (ej: `(tenant_id, sale_point, invoice_type, invoice_number)`).
- `FK` para toda relación.
- `EXCLUDE` para rangos no superpuestos (F1+ si aplica).

## 16.7 Serialization isolation

- Default: `READ COMMITTED` (Postgres default).
- `SERIALIZABLE` para path crítico:
  - Numeración fiscal
  - Cash session open
  - Webhook MP que actualiza saldos
- Retry serializable obligatorio (ADR-0011).

## 16.8 Sequence handling

- `invoice_sequences` (NO usa `serial` o `bigserial`) — sequence manual con SELECT FOR UPDATE.
- `bigserial` permitido para PKs sin significado fiscal (audit_log.id, etc.).
- `uuid` con `gen_random_uuid()` para entidades de negocio (sales.id, etc.).

## 16.9 Audit requirements

- Toda tabla con datos de tenant: agregar evento `audit_log` en cada mutation crítica.
- Cambios sensibles: registrar **before/after** en payload jsonb del audit.
- Cambios masivos (bulk update): un audit por row (NO bulk audit single row).

## 16.10 Migration strategy

- Drizzle Kit `pnpm drizzle-kit generate`
- Cada migration: review + test en homologación antes de prod.
- Migration paths:
  - **Forward-only safe:** add column nullable, add table, add index
  - **Forward-only risky:** alter column type, drop column → require backup + rehearsal
  - **Data migration:** archivo separado, NO en schema migration

## 16.11 Rollback expectations

- Si migration estructural rompe prod: rollback vía revertir migration + redeploy.
- Datos eliminados (DROP): backup obligatorio antes.
- `audit_log` DROP PARTITION solo con backup verificado.

## 16.12 Backup + restore

- Supabase managed backups (incluido).
- Restore test MENSUAL (cron + alerta si falla).
- Backup size monitoreado.
- Point-in-time recovery hasta 7 días F0, 30 días F1+.

---

# 17. Integration Constitution

## 17.1 Filosofía

- **NO crear abstraction premature** de proveedor. Si solo hay 1 proveedor de email, NO crear `EmailProvider interface` con 1 implementación.
- **Wrapping mínimo** para testability + secret management.
- **Idempotency obligatoria** en webhooks.
- **HMAC + timestamp + dedup** en TODO webhook entrante.
- **Retry policy explícita** por proveedor.

## 17.2 AFIP (WSAA + WSFEv1 + Padrón A5)

### WSAA
- Token cache por tenant (memoria + DB cache `wsaa_tokens`)
- TTL 12h (AFIP default)
- Refresh proactivo a las 11h
- Worker dedicado `afip.refresh_wsaa_token`
- NUNCA loguear token

### WSFEv1
- Cliente SOAP (lib TBD — `node-soap` o custom HTTP+XML)
- Timeout 30s
- Retry NO automático (worker se encarga)
- TLS 1.2+ obligatorio
- Validación de respuesta con Zod

### Padrón A5
- Cache 24h en DB `padron_a5_cache (cuit, data, fetched_at)`
- Refresh on-demand cuando stale
- Worker dedicado `afip.refresh_padron` para refresh batch nocturno (opcional F1+)
- Política caché/timeout pendiente A-4 contador

### Ambiente isolation
```bash
AFIP_ENVIRONMENT=homologacion  # F0 inicial
AFIP_ENVIRONMENT=produccion    # post-homologación + ADR de cutover
```

Validación en código + fail-fast al boot si endpoint no matchea environment.

## 17.3 MercadoPago

### Cobro POS QR
- F0: integración directa con Checkout Pro o QR estático
- Webhook entrante con HMAC + replay protection
- Idempotency por `mp_event_id` en `processed_webhook_events`
- Reconciliation con worker dedicado si webhook fuera de orden

### Schema
```sql
CREATE TABLE mp_payments (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL,
  sale_id uuid REFERENCES sales(id),
  mp_payment_id text UNIQUE NOT NULL,
  status text NOT NULL,
  amount numeric(19,4) NOT NULL,
  webhook_received_at timestamptz,
  ...
);
```

## 17.4 Email

- F0: provider TBD (Resend o equivalente)
- Worker dedicado `email.send_invoice`
- Idempotency por (sale_id, recipient)
- Template estricto (no template engine inflado)
- Email para: factura emitida, demo expirando, breach notification

## 17.5 SMS / WhatsApp (F1+)

- F1+ trigger: cliente comerciante lo pide explícito
- Provider TBD
- Mismo patrón: worker dedicado + idempotency

## 17.6 Outbound webhooks

- F0: NO outbound webhooks (no terceros suscritos a eventos Pandora).
- F1+ trigger: primer integración real (ej: comerciante quiere notificación a su CRM).
- Cuando llegue: HMAC + retry exponencial + dead letter.

## 17.7 Inbound webhooks — patrón estándar

```typescript
// /api/webhooks/mp/route.ts
export async function POST(req: Request) {
  const event = await validateWebhook(req, 'mercadopago');
  // (1) HMAC, (2) timestamp window, (3) dedup
  await mpService.handleWebhook(event);
  return Response.json({ ok: true });
}
```

## 17.8 API evolution

- Internal APIs: versionado por path (`/api/v1/...`) si breaking change.
- External webhooks: versión en payload (`event.version`).
- Deprecation: aviso 90 días + métricas de uso de versión vieja.

## 17.9 Sandbox policy

- TODO proveedor con sandbox tiene env var `{PROVIDER}_ENVIRONMENT=sandbox|production`.
- Validación al boot.
- Sandbox y prod jamás comparten secretos.

## 17.10 Provider dependency philosophy

- **Aceptamos** dependencia de AFIP, Supabase, Vercel, MercadoPago (críticas).
- **Mitigamos:** fail-closed cuando no responden, fallback documentado.
- **NO sobre-abstraemos** (premature provider interface).
- **F1+ trigger** para abstraction real: cliente que pide proveedor alternativo + business case real.

---

# 18. Testing Constitution

## 18.1 Filosofía

- **Coverage 80% mínimo** (rule global).
- **TDD donde aplique:** servicios de dominio, money, fiscal projection, state machines.
- **Tests son spec ejecutable.** Si no hay test, la spec es ambigua.
- **Cero "tests verdes que mienten":** mocks que no reflejan realidad están prohibidos.

## 18.2 Tipos de tests

| Tipo | Cuándo |
|---|---|
| **Unit** | Funciones puras, domain logic, money math, projection |
| **Integration** | Services con DB real (test DB), HTTP handlers |
| **Cross-tenant** | Multi-tenant isolation (RLS + service) |
| **E2E** | Flujos POS críticos (venta cobrada happy + error paths) |
| **Concurrency** | Numeración fiscal, SKIP LOCKED workers, serializable retry |
| **Property-based** | Money invariants, state transitions (con fast-check) |
| **Visual regression** | UI componentes críticos (Playwright screenshots) |
| **Accessibility** | axe-core en CI |
| **Performance** | Lighthouse en PR de cambios UI |

## 18.3 Mandatory tests F0

### Multi-tenant (§7.9)
- T-MT-01 a T-MT-07

### Money (§9.9)
- T-MONEY-01 a T-MONEY-07

### Fiscal (RECONCILIATION-ENGINE §11)
- T-FISCAL-01 timeout-recovery
- T-FISCAL-02 validation-mismatch refusal
- T-FISCAL-03 poison isolation
- T-FISCAL-04 SKIP LOCKED concurrency
- T-FISCAL-05 audit trail completeness

### Recovery (§13.11)
- T-REC-01 a T-REC-07

### Concurrency
- T-CONC-01 numeración fiscal 100 emisiones concurrentes mismo tenant/sale_point/invoice_type
- T-CONC-02 cash session open concurrente bloqueado por unique partial index
- T-CONC-03 webhook MP duplicado dedup

### Observability
- T-OBS-01 end-to-end correlation_id propagation
- T-OBS-02 worker continuity (correlation_id heredado, request_id nuevo)
- T-OBS-03 logger auto-inject desde AsyncLocalStorage
- T-OBS-04 metrics whitelist enforcement (throw si tag no autorizado)
- T-OBS-05 audit log inmutability (trigger throw en UPDATE/DELETE)

### Security
- T-SEC-01 CSP header presente
- T-SEC-02 HMAC validation webhook
- T-SEC-03 replay protection webhook (timestamp out of window)
- T-SEC-04 dedup webhook (event_id repetido)
- T-SEC-05 rate limit hits
- T-SEC-06 TLS 1.2+ obligatorio en cliente AFIP
- T-SEC-07 secret no logueado (lista canónica)

## 18.4 Lo que NO puede mergearse sin test

- Cualquier mutation fiscal
- Cualquier operación monetaria
- Cualquier transición de state machine
- Cualquier query cross-tenant (test que valide aislamiento)
- Cualquier webhook entrante (HMAC + dedup tests)
- Cualquier worker (idempotency + poison detection tests)

## 18.5 Lo que requiere homologación AFIP

- Cambios en Fiscal Projection Layer
- Cambios en lógica de numeración
- Cambios en payload WSFEv1
- Cambios en Fiscal Snapshot schema
- Bump de `calculation_engine_version` o `tax_policy_version`

Test contra AFIP homologación obligatorio antes de promover a prod.

## 18.6 Lo que requiere manual verification

- UX cambios en POS (cajero real probando)
- Cambios en Dawn Sky identidad visual
- Cambios en flujo de cobro
- Cambios en print de ticket (papel real)

## 18.7 Test isolation

- Cada test setea su propio tenant
- Cada test usa BEGIN/ROLLBACK o limpia post
- NO compartir estado entre tests
- Mocks de AFIP solo para tests que NO requieren homologación

## 18.8 CI gates

```
pre-commit: prettier + eslint (rápido)
pre-push: pnpm test (unit + integration locales)
PR CI:
  - lint
  - typecheck
  - unit + integration
  - cross-tenant tests
  - concurrency tests
  - coverage >= 80%
  - axe-core a11y
PR review:
  - Codeowner approval (Pandora team)
Merge to main:
  - Deploy automático a homologación AFIP env
  - E2E suite en homologación
  - Deploy manual a prod tras smoke test
```

---

# 19. Documentation Governance

## 19.1 Cuándo crear ADR

Crear ADR cuando:
- Decisión arquitectónica con impacto > 1 módulo
- Decisión que afecta cómo trabajamos a futuro
- Decisión que cambia un ADR previo
- Restricción técnica nueva (stack, integración, política)

NO crear ADR para:
- Implementación detallada de feature (eso va en código + comentarios mínimos)
- Decisión local de 1 archivo
- Refactor que no cambia arquitectura
- Bug fix

## 19.2 Cómo crear ADR

1. **Asignar número siguiente** secuencial (ej: ADR-0023).
2. **Filename:** `files/ADR-NNNN-slug-corto.md`.
3. **Template mínimo:**
   ```markdown
   # ADR-NNNN — Título corto

   **Fecha:** YYYY-MM-DD
   **Estado:** Propuesto | Aprobado | Reemplazado por ADR-XXXX
   **Reemplaza a:** (si aplica)

   ## Contexto
   Qué situación / problema / restricción motivó esta decisión.

   ## Decisión
   La decisión tomada, en presente imperativo.

   ## Consecuencias
   ### Positivas
   ### Negativas / trade-offs aceptados
   ### Pendientes

   ## Alternativas consideradas
   Por qué se rechazaron.

   ## Validación
   🟢 cerrado / 🟡 pendiente humano / 🔴 abierto crítico
   ```
4. **Agregar fila en DECISION-LEDGER.md** tabla "ADRs vigentes".
5. **Si introduce autoridad nueva:** agregar en AUTHORITY-MAP.md.
6. **Si cambia rules:** actualizar `.claude/rules/*.md`.
7. **Si introduce evento nuevo:** agregar en EVENT-TAXONOMY.md.
8. **Si afecta CLAUDE.md:** actualizar sección relevante.

## 19.3 Naming rules

| Tipo | Pattern |
|---|---|
| ADR | `ADR-NNNN-slug-corto.md` |
| Memory | `kebab-case-descriptive.md` |
| Rule | `NN-{topic}.md` (ej: `03-fiscal.md`) |
| Spec doc | `UPPERCASE-NAME.md` (ej: `EVENT-TAXONOMY.md`) |
| Runbook | `kebab-case-action.md` (ej: `security-incident.md`) |

## 19.4 Versioning de docs

- ADRs: versionado implícito por fecha + estado (Reemplazado por nuevo ADR si cambia)
- Spec docs (EVENT-TAXONOMY etc.): SemVer en header (`v2.0.1`)
  - MAJOR: breaking change en contract
  - MINOR: feature aditiva
  - PATCH: fix técnico
- SRS: congelado en v3.0. NO se modifica. Parches via Sesión 5 v4 (también congelada).

## 19.5 Frozen docs

| Doc | Estado | Política |
|---|---|---|
| `PANDORA_ERP_SRS_v3.0.md` | Congelado | NO modificar. Si requiere parche → ADR o Sesión nueva. |
| `srs-sesion-5-validaciones-v4.md` (vive en otro filesystem) | Congelado | Idem. |
| ADRs aprobados | Inmutable en contenido. Si cambia decisión → nuevo ADR que reemplaza. |

## 19.6 Deprecations

- Marcar `**Estado:** Reemplazado por ADR-XXXX` en el ADR viejo.
- NO eliminar el ADR viejo.
- Actualizar DECISION-LEDGER.md.
- Si el ADR viejo se referencia en código, agregar TODO + trigger para migrar.

## 19.7 Cómo actualizar el ledger

1. Editar `DECISION-LEDGER.md`.
2. Mover fila si cambia estado (de "abiertas críticas" a "ADRs vigentes" cuando cierra).
3. Actualizar campo "Validación" 🔴 → 🟡 → 🟢.
4. Actualizar "Última actualización" del header.
5. Agregar entry en sección "Decisiones cerradas en {fecha}" si fue un cierre relevante.

## 19.8 Cómo actualizar rules

`.claude/rules/01-stack.md`, etc. viven (probablemente) en repo WSL `.claude/rules/`. Cuando cambien:

1. Editar el rule file.
2. Actualizar el header con `**Última actualización:** YYYY-MM-DD`.
3. Si el cambio refleja ADR nuevo, referenciar ADR en el rule.

## 19.9 Anti-drift process

- **Pre-merge check:** PR que toca ADR / spec doc / rule debe declarar en descripción qué otros docs actualiza.
- **Reviewer responsibility:** validar que CLAUDE.md / DECISION-LEDGER / AUTHORITY-MAP están coherentes.
- **Trimestralmente:** revisar DECISION-LEDGER vs filesystem real (¿hay ADRs físicos no listados? ¿filas que apuntan a archivos que no existen?).
- **Si se detecta drift:** abrir issue + fix antes de seguir trabajando sobre el área afectada.

## 19.10 DIFFS-TO-APPLY discipline

`DIFFS-TO-APPLY.md` es buffer temporal para cambios que viven en otro filesystem (WSL).

- Cada entry: filename target + diff conceptual + razón.
- Cuando se aplica el diff: marcar como aplicado + fecha en el doc.
- Cuando todos los diffs se aplican: el doc puede archivarse.

---

# 20. Anti-Patterns Catalog

> Catálogo EXTENSO. Cada anti-pattern incluye: descripción + por qué es malo + qué hacer en su lugar.

## 20.1 Over-engineering

**Descripción:** agregar abstracciones / capas / generalidad antes de tener 3+ casos reales que la requieran.

**Por qué malo:** muerte por mil cuts. Cada abstracción tiene costo (cognitivo, mantenimiento, testing).

**Qué hacer:** YAGNI. Esperar 3+ casos reales. Documentar el "no abstrction" con trigger explícito.

**Memoria:** [over-engineering rejected memory] tiene 15 propuestas rechazadas.

## 20.2 Premature abstractions

**Ejemplo:** `interface PaymentProvider` con 1 implementación (MercadoPago).

**Qué hacer:** import MercadoPago directo. Abstraer cuando aparece 2do proveedor.

## 20.3 Hidden retries

**Ejemplo:** worker que reintenta silenciosamente sin loguear cada attempt.

**Por qué malo:** debugging imposible. No sabés si tuviste 1 falla o 100.

**Qué hacer:** cada retry loguea + audita + actualiza `last_request_id` + métrica.

## 20.4 Silent failures

**Ejemplo:** `try { ... } catch(e) { /* nada */ }`.

**Por qué malo:** problema queda invisible hasta que es desastre.

**Qué hacer:** logger.error/fatal + Sentry. Si la lógica de negocio permite ignorar, hacerlo EXPLÍCITO con comment.

## 20.5 Mutable audit log

**Ejemplo:** UPDATE en `audit_log` para "corregir" un entry.

**Por qué malo:** auditabilidad rota. Inspector AFIP / juez no puede confiar en el log.

**Qué hacer:** trigger inmutable (ya implementado). Para "corregir" → INSERT nuevo evento que reemplaza/anula el anterior.

## 20.6 Floating point money

**Ejemplo:** `const total = price * 0.21`.

**Por qué malo:** error de redondeo IEEE 754. Cliente pagaría $0.001 más o menos.

**Qué hacer:** `new Decimal(price).times('0.21')`.

## 20.7 Cross-tenant leakage

**Ejemplo:** query sin filter `tenant_id` cuando RLS no aplica (admin context).

**Por qué malo:** fuga catastrófica. Violación legal Ley 25.326.

**Qué hacer:** service layer SIEMPRE valida `tenant_id` del context vs recurso. Tests cross-tenant obligatorios.

## 20.8 Unbounded metrics cardinality

**Ejemplo:** `metric_counter.increment('venta', { product_id: '...' })`.

**Por qué malo:** cardinality explota a millones de filas (1 row por (metric, product_id, tenant, hour)).

**Qué hacer:** whitelist METRIC_WHITELIST con `cardinalityWarn` por métrica. `tag_value` debe estar en lista bounded.

## 20.9 Magic event buses

**Ejemplo:** generic event handler que despacha jobs por type.

**Por qué malo:** drift a event sourcing. Imposible auditar qué evento dispara qué.

**Qué hacer:** worker dedicado por job_type (regla J2 EVENT-TAXONOMY).

## 20.10 Implicit state transitions

**Ejemplo:** `sale.fiscal_status = 'issued'` directo en código de negocio sin pasar por helper.

**Por qué malo:** transiciones inválidas pasan desapercibidas. State machine deja de ser confiable.

**Qué hacer:** helper `transitionFiscalStatus(sale, fromState, toState, reason)` con validación + audit + trigger.

## 20.11 Retry de AFIP `failed`

**Ejemplo:** retry automático ante AFIP `failed` (rechazo explícito).

**Por qué malo:** AFIP rechaza por bug nuestro (payload inválido). Retry = mismo bug = mismo rechazo + número quemado N veces.

**Qué hacer:** distinguir transient (timeout, 5xx) vs permanent (`failed`). Permanent → fix + re-emitir manual.

## 20.12 Uncontrolled background jobs

**Ejemplo:** `setInterval(() => doWork(), 60000)` en Vercel serverless.

**Por qué malo:** serverless no preserva intervals entre invocations. Job no corre.

**Qué hacer:** cron Vercel (declarado en `vercel.json`) o worker dedicado en Railway F1+.

## 20.13 Generic handlers

**Ejemplo:** `function handleEvent(event) { switch(event.type) { case 'A': ...; case 'B': ...; }}` con 20+ cases.

**Por qué malo:** crece sin límite, single point of bug, imposible testear por case.

**Qué hacer:** handler por type, archivos separados, tests dedicados.

## 20.14 Undocumented fallbacks

**Ejemplo:** "si AFIP no responde, usar `numero_provisorio` y ya".

**Por qué malo:** decisiones críticas implícitas. Auditor no sabe qué hace el sistema.

**Qué hacer:** TODA decisión fiscal/money/multi-tenant documentada en ADR o CLAUDE.md.

## 20.15 UI-owned business logic

**Ejemplo:** cálculo de IVA en componente React + envío al server "ya calculado".

**Por qué malo:** cliente puede manipular. Tamper attack trivial.

**Qué hacer:** server SIEMPRE recalcula. Cliente solo preview (ADR-0021).

## 20.16 Async inconsistencies

**Ejemplo:** mutación que dispara 3 awaits independientes en paralelo sin coordinar fallas.

**Por qué malo:** partial failure deja sistema en estado inconsistente.

**Qué hacer:** transacción única + outbox pattern F1+ si necesita disparar a otros sistemas.

## 20.17 Feature creep

**Ejemplo:** "ya que estamos, agregamos X". X no estaba en spec.

**Por qué malo:** scope explota, deadline corre, calidad baja.

**Qué hacer:** parar. Backlog con trigger. PR no contiene X.

## 20.18 Compliance shortcuts

**Ejemplo:** "este caveat de Ley 25.326 lo arreglamos después".

**Por qué malo:** "después" nunca llega. Riesgo legal acumulado.

**Qué hacer:** abogado primero, código después. Si abogado dice "necesario", es bloqueante.

## 20.19 Fake offline mode

**Ejemplo:** UI dice "trabajando offline" pero datos no se sync al volver.

**Por qué malo:** comerciante cree que vendió, no vendió. Stock incorrecto. Caja incorrecta.

**Qué hacer:** NO offline F0. Si AFIP cae, mostrar "AFIP no responde" claro. Modo offline real F2+ con investigación profunda.

## 20.20 Optimistic fiscal assumptions

**Ejemplo:** "asumimos que AFIP autorizó porque tardó mucho, igual emitimos".

**Por qué malo:** AFIP puede NO haber autorizado → factura inválida → fraude/multa.

**Qué hacer:** fail-closed. Si no hay CAE confirmado, NO emitir.

## 20.21 Premature multi-country abstractions

**Ejemplo:** `taxEngine.calculate(country, ...)` con stub para todos los países.

**Por qué malo:** abstraction sin cliente real. Mantenimiento eterno.

**Qué hacer:** AR-only. F2+ con cliente real que pague localización.

## 20.22 Untracked migrations

**Ejemplo:** migraciones manuales en prod sin checkin a Drizzle Kit.

**Por qué malo:** schema drift entre dev/staging/prod. Imposible reproducir env.

**Qué hacer:** TODA migración via Drizzle Kit + checkin + review.

## 20.23 Unsafe impersonation

**Ejemplo:** support_user puede emitir facturas en nombre del comerciante.

**Por qué malo:** responsabilidad legal directa para Pandora.

**Qué hacer:** support_user read-only por default. Mutations requieren consentimiento explícito + audit.

## 20.24 Manual money arithmetic

**Ejemplo:** `const total = parseFloat(price) * quantity`.

**Qué hacer:** Decimal.js SIEMPRE. Linter rule TBD para flaggear.

## 20.25 Undocumented side effects

**Ejemplo:** función `validateInput()` que también escribe en DB.

**Por qué malo:** nombre miente. Refactor imposible.

**Qué hacer:** nombre describe TODO lo que hace. Si hace varias cosas → separar.

## 20.26 Duplicated source of truth

**Ejemplo:** `tenant_id` cacheado en cookie + en JWT + en DB session.

**Por qué malo:** divergencia inevitable. ¿Cuál es la verdad?

**Qué hacer:** una sola fuente (AUTHORITY-MAP define cuál). Otras son cache marcado como tal.

## 20.27 Comentarios que mienten

**Ejemplo:** `// returns user count` sobre función que retorna ventas.

**Qué hacer:** eliminar comentario o sincronizar. NO confiar en comentarios viejos.

## 20.28 Test que mockea hasta no probar nada

**Ejemplo:** test que mockea DB, service, validator, repository — solo prueba que el wrapping funciona.

**Qué hacer:** integration test con DB real (test DB). Mock solo en boundary externo (AFIP).

## 20.29 Endpoint sin rate limit

**Qué hacer:** TODO endpoint público con rate limit. TODO endpoint autenticado con rate limit (por tenant).

## 20.30 Migration que toca prod sin backup

**Qué hacer:** backup obligatorio antes de migrations destructivas.

---

# 21. Evolution Path Strategy

> **Roadmap operativo detallado:** ver [ROADMAP.md](ROADMAP.md) — 11 sprints quirúrgicos desde Pre-flight hasta Pilot Launch con deliverables exactos, tests obligatorios, gating criteria, métricas de validación y planes B. Este §21 mantiene la visión estratégica de alto nivel (qué fase es qué); el ROADMAP entra a nivel implementación por sprint.

## 21.1 Visión general

```
F0 (5 clientes TDF, 14-16 semanas)
  ↓ trigger: 5 clientes pagando + estabilidad operativa
F0.5 (refinamiento operativo, 4-8 semanas)
  ↓ trigger: piloto exitoso + necesidades reales detectadas
F1 (10-30 clientes, expansión funcional)
  ↓ trigger: 30+ clientes + dolor escalabilidad
F2 (50-200 clientes, multi-jurisdicción)
  ↓ trigger: 200+ clientes + necesidad de ecosistema
F3 (500+, marketplace, multi-país)
```

## 21.2 Qué entra en cada fase

### F0 (lista cerrada — ver §5.2)
Lo mínimo que permite cobrar 5 clientes TDF.

### F0.5
- Operator dashboard UI (queries Q1-Q4 ya disponibles F0 vía SQL)
- Refinamientos UX detectados con piloto
- Bugs y polishing

### F1
- **Notas de crédito** (NC) — NO en F0 por simplicidad inicial
- Reportes contables expandidos (IIBB internos, libro IVA ventas, libro IVA compras)
- Notificaciones proactivas al contador (email/WhatsApp por dead jobs > 4h)
- Outbox pattern enterprise (si aparece integración externa reactiva)
- BroadcastChannel multi-tab POS (con métrica que justifique)
- LRU permisos cliente (con métrica)
- Heartbeat reverso connectivity (con caso de uso)
- WSMTXCA — trigger: primer cliente B2B con detalle de ítem
- Quarantine queue separada para poison jobs (cuando aparezcan con frecuencia)
- Hash chain en audit_log (tamper-proof real)
- Sentry instrumentación completa
- Mejor onboarding con video / wizard

### F2
- Multi-jurisdicción AR completa (CABA, BUENOS_AIRES, otras provincias)
- IIBB CABA / ARBA / IIBB otras
- WSFEX — trigger: primer cliente exportador
- Multi-currency (USD, otros) — trigger: cliente que paga + use case real
- Conciliación bancaria automática
- ML para predecir rechazos CAE
- Multi-region failover (improbable F2)
- **Loyalty program / puntos** — trigger: 10+ clientes pidiendo + business case (NON-GOALS N-FEAT-08)
- **Modo offline real** — trigger: investigación profunda + business case real (NON-GOALS N-FEAT-11)
- **AI Copilot features NO críticas** (sugerencias catálogo, ayuda contextual al cajero) — NUNCA en path fiscal/money/multi-tenant (NON-GOALS N-TECH-15)
- Mercado Libre / Tiendanube lectura inventario — trigger: 50+ clientes ESTABLES + pedido (NON-GOALS N-MKT-03)

### F3+
- Plugin system / marketplace
- Multi-país (Chile, Uruguay, etc.)
- Advanced analytics + BI
- API pública con SDK
- Bot Telegram/Slack para alertas críticas

## 21.3 Qué NO debe implementarse ahora

### Rechazado sistemáticamente (sin trigger)
1. Microservicios (ADR-0007 confirma monolito modular)
2. Event sourcing como primary store
3. CQRS prematuro
4. ORMs alternativos a Drizzle
5. Multi-país sin cliente que pague
6. Tax engine multi-jurisdicción abstracto
7. Regulatory Policy Engine genérico
8. Tabla canónica "productos exentos Ley 19.640" (cada comercio define con su contador)
9. Modo offline real (fake offline es peor que nada)
10. Plugin system / marketplace antes de F3

Memoria: [over-engineering rejected memory] tiene 15 con triggers para reabrir.

## 21.4 Debt intencionalmente aceptada

| Debt | Razón | Trigger para resolver |
|---|---|---|
| Cron Vercel para workers F0 (vs Railway+BullMQ) | Vercel cron alcanza para 5 tenants | > 30 tenants O > 5000 jobs/día |
| Operator tooling solo SQL F0 (vs UI) | Tiempo + foco F0 | F0.5 / F1 con clientes piloto |
| Audit log append-only sin hash chain | Hash chain F1+ con disposición legal específica | Disposición AAIP / requerimiento auditor |
| ARS-only F0 | Target TDF AR | Cliente B2B exportador con USD |
| WSFEv1 only (sin WSMTXCA, WSFEX, WSBFE) | TDF retail no requiere | Cliente B2B / exportador |
| `legal_name`/`fiscal_address` opcionales (no obligados AFIP) | WSFEv1 no exige | Pregunta A-3 contador puede cambiar |
| Cliente Realtime sin fallback polling | Realtime estable F0 | Si Realtime cae > 5%/mes → adaptive polling |
| Sentry instrumentación básica F0 | Setup base alcanza | Volumen real F1+ requiere observabilidad rica |

## 21.5 Migration expectations

Cada transición de fase requiere:
- ADR específico documentando la transición
- Tests de no-regresión
- Plan de rollback
- Comunicación a clientes piloto si afecta UX

---

# 22. Session Execution Protocol

> Esta sección es para **cualquier sesión futura** (humano o IA) que trabaje en Pandora.

## 22.1 Cómo iniciar una sesión

1. **Leer [DECISION-LEDGER.md](DECISION-LEDGER.md)** — entender estado actual.
2. **Leer este CLAUDE.md** completo (especialmente §3 Decision Registry Snapshot + §22 Protocol).
3. **Leer memoria** relevante en `~/.claude/projects/{proyecto}/memory/`.
4. **Verificar si lo pedido por usuario** está en F0, en backlog, o requiere nuevo ADR.

## 22.2 Cómo analizar pedidos

Para cada pedido del usuario, responder mentalmente:

1. ¿Esto es scope F0? Si no → al backlog con trigger. Confirmar con usuario antes de implementar.
2. ¿Hay ADR vigente que aplica? Si sí → respetar. Si conflicto → reportar al usuario.
3. ¿Hay validación humana pendiente (contador/abogado)? Si sí → bloquear código que dependa, avanzar resto si posible.
4. ¿Rompe alguna constitución (§6-§17 de este doc)? Si sí → bloquear + explicar.
5. ¿Es la opción más simple? Si no → simplificar antes de avanzar.

## 22.3 Cómo validar consistencia

Antes de cerrar una tarea:

- ¿El cambio requiere update de DECISION-LEDGER? Si sí, hacerlo.
- ¿El cambio requiere update de AUTHORITY-MAP? Si sí, hacerlo.
- ¿El cambio requiere update de este CLAUDE.md? Si sí, hacerlo.
- ¿El cambio requiere update de memoria? Si sí, hacerlo.
- ¿El cambio toca un ADR? Si sí, ¿el ADR ya cubre el cambio o requiere nuevo ADR / actualización?

## 22.4 Cuándo crear ADR

Ver §19.1. Resumen:
- Decisión arquitectónica con impacto > 1 módulo
- Decisión que cambia o reemplaza ADR previo
- Restricción técnica nueva

## 22.5 Cuándo bloquear implementación

**BLOQUEAR sin excepción cuando:**
- Pedido viola constitución fiscal (§8)
- Pedido viola fail-closed
- Pedido viola multi-tenant isolation (§7)
- Pedido viola money invariants (§9)
- Pedido viola audit immutability
- Pedido requiere validación humana pendiente (contador/abogado) y la implementación NO puede esperar

**Acción:** explicar al usuario qué viola + ofrecer alternativa.

## 22.6 Cuándo pedir validación humana

Pedir al usuario que abra issue / consulte contador / consulte abogado cuando:
- Pregunta es legal/fiscal sin fuente oficial clara
- Item del advisor doc afecta directamente el código a escribir
- Decisión tiene riesgo legal personal del owner

## 22.7 Cuándo rechazar scope

Rechazar feature cuando:
- NO está en F0 + usuario no aceptó moverlo a F0
- Rompe diferenciador no negociable (§1.3)
- Mueve Pandora hacia categorías "NO es" (§4.2)
- Requiere abstracción premature sin 3+ casos reales

## 22.8 Cómo reportar contradicciones

Si detectás que doc A contradice doc B:

1. Identificar cuál tiene mayor autoridad según §2.1.
2. El de mayor autoridad gana.
3. Reportar al usuario: "Detecté inconsistencia entre A y B. A gana por jerarquía. Voy a actualizar B."
4. Actualizar el de menor autoridad.
5. Documentar la resincronización en DECISION-LEDGER o memoria si es relevante.

## 22.9 Cómo manejar incertidumbre

Cuando no estás seguro:

- **NO inventar.** Decir "no encontré fuente" mejor que improvisar.
- **NO asumir.** Preguntar al usuario o buscar en docs.
- **NO simplificar silenciosamente.** Si la spec es ambigua, decirlo + ofrecer interpretación + pedir confirmación.
- **NO callar inconsistencias.** Reportar al usuario.

## 22.10 Cómo evitar drift

- Antes de modificar un ADR, leer el ADR completo + sus dependencias en DECISION-LEDGER.
- Antes de cambiar schema DB, verificar consistencia con ADRs fiscales + multi-tenant.
- Antes de agregar dependencia npm, verificar contra stack prohibido (§6.2).
- Antes de agregar metric, verificar whitelist.
- Antes de agregar event audit, verificar catálogo EVENT-TAXONOMY.

## 22.11 Cómo responder ante cambios peligrosos

Si el usuario pide algo que tiene alto riesgo:

1. **Explicar el riesgo concretamente.** No genéricamente.
2. **Ofrecer alternativas más seguras.**
3. **Pedir confirmación explícita** antes de proceder.
4. **Loguear la decisión** en DECISION-LEDGER si es estructural.

## 22.12 Philosophy: "ledger first"

Cuando hay duda sobre cualquier cosa, **el ledger gana**. Cuando el ledger no cubre algo, ofrecer agregarlo antes de proceder.

## 22.13 Philosophy: "fail loudly"

Errores deben gritar, no susurrar. Logs informativos sobre situaciones recoverable. Logs error sobre situaciones inesperadas. Logs fatal sobre situaciones no recoverable. NUNCA silencio.

## 22.14 Philosophy: "document before scaling"

Antes de escalar una solución (más tenants, más volumen, más features), documentar la solución actual + sus límites + el plan de escalado.

## 22.15 Philosophy: "never assume"

Nunca asumir que el usuario quiere lo mismo que la última vez. Nunca asumir que la consistencia es implícita. Nunca asumir que algo "obvio" está documentado.

## 22.16 Defaults del proyecto

- **Idioma:** español rioplatense (vos, no tú; "che", "ojo", "dale").
- **Fechas:** ISO 8601 (`2026-05-27`).
- **Timezone:** America/Argentina/Ushuaia para timestamps fiscales TDF; UTC para audit_log internal.
- **Money display:** `Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' })`.
- **CLI:** PowerShell (Windows, ambiente owner) + bash (WSL).
- **Editor:** VS Code + Claude Code extension.

---

# 23. Apéndice — Filesystem Map

## 23.1 Layout SRS (este filesystem `c:\Users\Pandora\Desktop\SRS\`)

```
SRS/
├── CLAUDE.md                                  ← este documento (v1.1.0)
├── CLAUDE-WSL-INSTRUCCIONES.md                ← plan aplicación a repo WSL
├── DECISION-LEDGER.md                         ← source of truth absoluto
├── AUTHORITY-MAP.md                           ← matriz de autoridades
├── NON-GOALS.md (v1.0.0)                      ← lo que Pandora NO va a ser
├── CAPABILITY-MAP.md (v1.0.0)                 ← 65 capabilities × 8 dominios
├── BOUNDED-CONTEXTS.md (v1.0.0)               ← 14 contexts + reglas anti-acoplamiento
├── OPERATIONAL-SEVERITY.md (v1.0.0)           ← matriz S0-S4
├── MONEY-POLICY.md (v1.0.0)                   ← consolidación monetaria
├── ROADMAP.md (v1.0.0)                        ← 11 sprints operativos hasta Pilot Launch
├── EVENT-TAXONOMY.md (v2.0.1)                 ← catálogo canónico eventos
├── CORRELATION-PROPAGATION.md (v1.0.0)        ← tracing end-to-end
├── RECONCILIATION-ENGINE.md (v1.0.0)          ← resolución incertidumbre fiscal
├── RUNBOOKS/                                  ← 6 playbooks F0
│   ├── README.md
│   ├── afip-outage.md
│   ├── cross-tenant-leak.md
│   ├── cash-discrepancy.md
│   ├── dead-jobs-resolution.md
│   ├── security-incident.md
│   └── breach-notification.md
├── PANDORA_ERP_SRS_v3.0.md (+ parte2, parte3) ← SRS congelado
├── backlog-validaciones.md                    ← 69 items diferidos con triggers
├── reunion-contador-y-abogado.md              ← guion advisor
├── DIFFS-TO-APPLY.md                          ← diffs pendientes para WSL
├── README.md                                  ← presentación general
├── AUDITORIA_CRITICA_SRS_v3.0.md              ← auditoría externa (histórico)
├── RESUMEN_AUDITORIA_EJECUTIVO.md             ← idem
├── PLAN_ACCION_INMEDIATO.md                   ← idem
├── TABLA_HALLAZGOS_DETALLADOS.md              ← idem
├── files/                                     ← ADRs físicos
│   ├── ADR-0001-stack-tecnologico-fase-0.md
│   ├── ADR-0002-multi-tenant-rls-jwt.md
│   ├── ADR-0003-typescript-services-no-plpgsql.md
│   ├── ADR-0004-afip-sincronico.md
│   ├── ADR-0005-money-numeric-19-4.md
│   ├── ADR-0006-numeracion-fiscal-select-for-update.md
│   ├── ADR-0007-monolito-modular.md
│   ├── ADR-0008-contador-multi-empresa-jwt.md
│   ├── ADR-0009-feature-flags-tenant.md
│   ├── ADR-0010-idempotency-obligatoria.md
│   ├── ADR-0011-retry-serializable.md
│   ├── ADR-0012-sistema-3-atmospheres.md
│   ├── ADR-0013-glass-system-degradacion.md
│   ├── ADR-0014-charts-svg-puro.md
│   ├── ADR-0015-motion-presets-nombrados.md
│   ├── ADR-0016-dawn-sky-identidad-permanente.md
│   ├── ADR-0017-density-obligatoria-atmosphere.md
│   ├── ADR-0018-stack-bump-may-2026.md
│   ├── ADR-0019-security-baseline-f0.md
│   ├── ADR-0020-demo-expired-policy.md
│   ├── ADR-0021-money-client-side.md
│   └── ADR-0022-fiscal-projection-layer.md
└── history/                                   ← sesiones SRS originales archivadas
    ├── srs-sesion-1.md
    ├── srs-sesion-2.md
    ├── srs-sesion-3.md
    ├── srs-sesion-3-5-correcciones.md
    ├── srs-sesion-3-5-2-correcciones.md
    └── srs-sesion-3-7-visual-system.md
```

## 23.2 Layout repo WSL (futuro / parcial)

```
~/workspace/pandora-erp/                       ← repo del proyecto en WSL
├── .claude/
│   ├── CLAUDE.md                              ← copia/spec de este doc (con paths relativos al repo)
│   └── rules/
│       ├── 01-stack.md
│       ├── 02-multi-tenant.md
│       ├── 03-fiscal.md
│       ├── 04-observability.md
│       └── 05-visual-system.md
├── src/
│   ├── app/                                   ← Next.js App Router
│   ├── components/                            ← UI components
│   │   ├── ui/                                ← shadcn
│   │   ├── pos/
│   │   ├── charts/
│   │   └── atmospheres/
│   ├── lib/
│   │   ├── services/                          ← Application Services TS
│   │   ├── domain/                            ← Domain functions puras
│   │   ├── db/                                ← Drizzle schema + queries
│   │   ├── fiscal/                            ← Fiscal Projection Layer
│   │   │   ├── projection/
│   │   │   │   └── wsfev1.ts
│   │   │   ├── snapshot.ts
│   │   │   └── breakdown.ts
│   │   ├── workers/                           ← Worker dedicado por job_type
│   │   ├── integrations/                      ← AFIP, MP, email
│   │   ├── observability/                     ← Pino, metrics, audit writer
│   │   ├── tracing/                           ← AsyncLocalStorage context
│   │   ├── money/                             ← Decimal.js wrappers
│   │   └── env.ts                             ← Zod fail-fast env validation
│   └── styles/
├── drizzle/                                   ← migraciones
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── cross-tenant/
│   └── e2e/
├── docs/
│   └── runbooks/
│       ├── security-incident.md
│       ├── cross-tenant-leak.md
│       └── arco-request.md
├── package.json
├── tsconfig.json
├── drizzle.config.ts
├── vercel.json
└── README.md
```

## 23.3 Layout memoria (auto-gestionada por agente)

```
~/.claude/projects/c--Users-Pandora-Desktop-SRS/memory/
├── MEMORY.md                                  ← índice
├── user-agus-owner.md
├── feedback-pace-bases-before-code.md
├── pandora-erp-project-state.md
├── tdf-target-real-f0.md
├── fiscal-architecture-core.md
├── over-engineering-rejected.md
├── pandora-erp-skeleton.md
├── arquitectura-cierre-2026-05-26.md
├── srs-package-structure.md
├── srs-sessions-history.md
├── analisis-ejecutivo-findings.md
├── decision-demo-expired-policy.md
├── pending-items-from-research-profundo.md
├── reconciliation-engine-v1.md
└── investigacion-oficial-afip-arca-aaip-2026-05-27.md
```

## 23.4 Cross-references útiles

| Si necesitás… | Mirá… |
|---|---|
| Estado de cualquier decisión | [DECISION-LEDGER.md](DECISION-LEDGER.md) |
| Quién es autoridad de un recurso | [AUTHORITY-MAP.md](AUTHORITY-MAP.md) |
| Qué NO va a ser Pandora (antes de proponer feature) | [NON-GOALS.md](NON-GOALS.md) |
| Qué hace Pandora (capabilities por dominio) | [CAPABILITY-MAP.md](CAPABILITY-MAP.md) |
| Cómo estructurar código (folders + public API + boundary rules) | [BOUNDED-CONTEXTS.md](BOUNDED-CONTEXTS.md) |
| Severidad de un incidente + acción | [OPERATIONAL-SEVERITY.md](OPERATIONAL-SEVERITY.md) |
| Ante incidente específico — playbook paso a paso | [RUNBOOKS/](RUNBOOKS/) |
| Política monetaria consolidada (referencia rápida) | [MONEY-POLICY.md](MONEY-POLICY.md) |
| Roadmap operativo por sprints (qué hacer cuándo) | [ROADMAP.md](ROADMAP.md) |
| Qué eventos existen / cómo emitirlos | [EVENT-TAXONOMY.md](EVENT-TAXONOMY.md) |
| Cómo traceear una operación | [CORRELATION-PROPAGATION.md](CORRELATION-PROPAGATION.md) |
| Cómo resolver incertidumbre fiscal | [RECONCILIATION-ENGINE.md](RECONCILIATION-ENGINE.md) |
| Items diferidos + triggers | [backlog-validaciones.md](backlog-validaciones.md) |
| Preguntas pendientes humanas | [reunion-contador-y-abogado.md](reunion-contador-y-abogado.md) |
| Stack approved/forbidden | §6 de este doc + ADR-0001 + ADR-0018 + NON-GOALS N-TECH-* |
| Política fiscal | §8 de este doc + ADR-0004 + ADR-0005 + ADR-0006 + ADR-0022 |
| Política money | [MONEY-POLICY.md](MONEY-POLICY.md) + §9 + ADR-0005 + ADR-0021 |
| Política observability | §10 + EVENT-TAXONOMY + CORRELATION-PROPAGATION |
| Política security | §11 + ADR-0019 + OPERATIONAL-SEVERITY |
| Política UI/UX | §14 + ADR-0012 a ADR-0017 |
| Reglas para sesiones futuras | §22 |

---

## Cierre

Este documento es **vigente al 2026-05-28**. Cualquier cambio estructural en Pandora debe sincronizarse acá. Cualquier sesión futura debe respetar este contrato.

**Estado al cierre:**
- 22 ADRs vigentes
- Trilogía de spec arquitectónica completa (EVENT-TAXONOMY + CORRELATION-PROPAGATION + RECONCILIATION-ENGINE)
- Sistema gobernable formal completo (NON-GOALS + CAPABILITY-MAP + BOUNDED-CONTEXTS + OPERATIONAL-SEVERITY + MONEY-POLICY + RUNBOOKS)
- 2 hallazgos críticos pendientes (ticket no fiscal post-2h + Ley 27.743 texto/estructura)
- Reuniones contador + abogado pendientes (preguntas concretas en advisor doc)
- Repo WSL sin avances desde 2026-05-21 (solo Sprint Visual)
- Fase de spec arquitectónica DECLARADA CERRADA
- Auditoría documental Lote 1 (Autoridad y constitución) completada 2026-05-28

**Próximo paso lógico:**
1. Reuniones contador + abogado (paralelo)
2. Auditoría documental Lotes 2-8 (estructura producto, trilogía spec, money/operación/runbooks, validaciones humanas, ADRs, SRS)
3. Aplicar este CLAUDE.md + rules a repo WSL
4. Setup técnico WSL (Drizzle schema, RLS, env.ts, auth, audit_log)
5. Implementar fiscal core en cuanto contador cierre A-2 (constancia provisoria) + A-11 (Ley 27.743)

**Última actualización:** 2026-05-28 (auditoría Lote 1 + 6 docs fundacionales del sistema gobernable).

*— CLAUDE.md v1.1.0 — Pandora ERP*
