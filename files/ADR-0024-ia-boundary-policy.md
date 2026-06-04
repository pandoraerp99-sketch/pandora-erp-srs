# ADR-0024 — IA Boundary Policy ("IA sugiere, nunca decide")

**Fecha:** 2026-06-02
**Estado:** Aprobado
**Relacionado con:** ADR-0019 (Security baseline + audit), ADR-0022 (Fiscal Projection Layer + fail-closed), ADR-0023 (Snapshot fiscal completo), NON-GOALS.md (N-TECH-15)
**Reemplaza:** ninguno (formaliza invariante arquitectónica nueva)
**Validación:** 🟢 Aprobado arquitectónicamente (decisión interna, sin dependencia legal externa)

## Contexto

La industria SaaS argentina muestra una tendencia clara de incorporar features de IA (LLMs, OCR, clasificación automática, asistentes conversacionales) en módulos críticos. Sin un boundary policy formal, Pandora corre el riesgo a 1-3 años de:

1. Drift de producto hacia features de IA en path fiscal/money/multi-tenant ("ya que tenemos LLM, que clasifique el tipo de comprobante automático").
2. Pérdida de auditabilidad — una factura mal emitida no tiene "actor responsable" si IA decidió el tipo.
3. Exposición legal — ante inspector AFIP, "lo decidió la IA" no es defensa válida.
4. Inconsistencia con principios ya cristalizados:
   - Fail-closed semantics (ADR-0022 §8.12 + §13.9)
   - Audit log con actor responsable (ADR-0019 + Sprint 2 #4)
   - Reproducibilidad histórica (ADR-0023 — snapshot autosuficiente)
   - Multi-tenant guards explícitos (ADR-0002 + CLAUDE.md §7)

### Casos típicos donde IA tienta entrar al path crítico

Estos son los puntos donde la decisión "meto IA" es seductora pero peligrosa:

| Tentación | Riesgo concreto |
|---|---|
| LLM decide tipo de comprobante (A/B/C) según RUT del cliente | Inspector AFIP pide explicación → "el modelo lo decidió" = sin defensa |
| OCR auto-emite factura desde foto de presupuesto | Bug del OCR → factura con monto equivocado → 10 años inmutable en audit |
| IA auto-clasifica producto para alícuota IVA (21% / 10.5% / exento) | Drift de modelo → IVA mal aplicado en N facturas antes de detectarse |
| Chatbot que "ejecuta" el cierre de caja | Cajero confió que la IA cerró pero quedó pendiente → descuadre + responsabilidad confusa |
| LLM auto-completa CondicionIVAReceptorId | Sugerencia incorrecta + humano apura "Sí" → factura rechazada (error 10242) o emitida con código equivocado |
| IA decide si una operación es TDF exenta (Ley 19.640) | Bug → IVA cobrado de más O exención mal aplicada → contingente fiscal |

### Por qué AHORA (antes de Sprint 6 fiscal)

Sprint 6 fiscal va a tocar el módulo más sensible. Si el ADR de IA boundary llega después de Sprint 6, hay incentivos perversos para "ya que estamos, agreguemos sugerencias automáticas". Este ADR cristaliza el invariante ANTES de que aparezcan tentaciones concretas.

## Decisión

### Principio core (invariante absoluta)

> **En Pandora, la Inteligencia Artificial puede sugerir input al usuario y asistir en tareas operativas no críticas. NUNCA decide transiciones fiscales, cálculos monetarios, autorizaciones multi-tenant, emisiones de comprobantes, ni mutaciones de snapshots inmutables.**

Este principio NO admite excepciones F0/F1/F2. Cualquier caso que parezca excepción se reanaliza contra el principio y se reformula como sugerencia + confirmación humana, o se descarta.

### Áreas BLINDADAS (lista cerrada — IA prohibida explícita)

| Área | Por qué blindada |
|---|---|
| **Transiciones de `fiscal_status`** | ADR-0022 + CLAUDE.md §12.2 — máquina de estados explícita, requiere actor responsable |
| **Cálculos monetarios** (Decimal.js) | ADR-0005 — bit-perfect determinístico, IA introduce no-determinismo |
| **Decisión de tipo de comprobante** (A/B/C/E/sub-tipos RG 5762/2025) | Tax policy version determina, NO IA |
| **Decisión de `CondicionIVAReceptorId`** | Catálogo runtime + lookup contra padrón AFIP — NO inferencia |
| **Decisión de alícuota IVA** (21% / 10.5% / 0% / exento) | Producto + jurisdicción + tax policy version — NO sugerencia probabilística |
| **Decisión de exención Ley 19.640 TDF** | `merchant_special_regime` + `transaction_in_special_zone` + `product.tdf_exempt` — flags explícitos, NO inferencia |
| **Resolución de `tenant_id`** | Multi-tenant guard explícito (CLAUDE.md §7), NUNCA inferido |
| **Autorización cross-tenant** | Solo `actor_type=system\|support` con audit explícito |
| **Emisión a AFIP** | Solo flujo humano confirmado, NUNCA disparado por IA |
| **Snapshot fiscal mutations** | Inmutable post-emisión (ADR-0022 + ADR-0023) |
| **Audit log mutations** | Trigger inmutable plpgsql (Sprint 2 #4) |
| **Aplicación de retenciones** (RG 5762/2025 100% IVA + 6% Ganancias) | Reglas explícitas del régimen, NO inferencia |
| **Numeración fiscal** (ADR-0006) | SELECT FOR UPDATE, NUNCA generación por modelo |
| **Generación de CAE/CAEA** | Solo ARCA, Pandora persiste lo que ARCA devuelve |
| **Reconciliación fiscal** (Sprint 7) | Reglas + worker dedicado, NO LLM decide reintento |

### Áreas PERMITIDAS (lista abierta con guidelines)

IA puede asistir bajo guidelines siempre que cumpla el patrón canónico (ver §siguiente):

| Área permitida | Ejemplo concreto | Guidelines |
|---|---|---|
| **Sugerencia de input de carga** | OCR escanea remito proveedor → sugiere CUIT/razón social/items/montos → humano confirma cada campo | Confidence score visible + edit obligatorio |
| **Búsqueda semántica de productos** | "Buscame el martillo carpintero 16oz" → match aproximado | NO toca fiscal, solo UX |
| **Autocompletado descripciones no-fiscales** | Tags de producto, marca, color, descripción visible al cliente | NUNCA descripción regulatoriamente vinculante (esa va al catálogo del comerciante) |
| **Ayuda contextual al cajero** | Tooltip "este producto suele venir con descuento de 10%" | Sugerencia visual, NO aplica descuento solo |
| **Reportes narrados** | Texto explicativo SOBRE datos ya verificados ("este mes facturaste 23% más que el mes anterior") | El número viene del query SQL, NO de la IA |
| **Detección de anomalías para alertar humano** | "Esta venta es 10x más grande que el promedio, ¿confirmás?" | Alerta humano, NO bloquea ni modifica |
| **Asistente de configuración onboarding** | "Parece que sos kiosco, te configuro categorías típicas" | Humano valida y edita catálogo final |
| **Resumen de movimientos para contador** | Texto descriptivo de movimientos del período | Datos siempre desde DB verificada, IA solo redacta |

**Regla práctica:** si la pregunta es "¿qué pasa si la IA se equivoca acá?" y la respuesta incluye "audit_log queda contaminado" o "AFIP rechaza" o "cliente pierde dinero" o "tenant equivocado" → área BLINDADA. Si la respuesta es "el usuario ve sugerencia rara y la edita" → área PERMITIDA.

### Patrón canónico de uso de IA

**FLUJO PERMITIDO** (siempre):

```
Input externo (documento, foto, búsqueda)
    ↓
IA procesa (OCR / parsing / sugerencia / match)
    ↓
Devuelve { candidate_values, confidence_score, ai_model_id, ai_model_version }
    ↓
UI muestra al humano:
  - Valores sugeridos editables
  - Confidence visible (alta/media/baja)
  - Botón "Editar" prominente
  - Botón "Confirmar" requiere acción explícita
    ↓
Humano edita si corresponde + confirma valores FINALES
    ↓
Dominio Pandora procesa con valores HUMANOS
    ↓
Snapshot/audit registra:
  - actor_type: 'user'
  - actor_user_id: <humano real>
  - metadata: { ai_suggestion_used: true, ai_model_id, ai_confidence, fields_edited_by_human: [...] }
```

**FLUJO PROHIBIDO** (siempre):

```
Input externo
    ↓
IA decide
    ↓
Sistema emite/persiste sin confirmación humana
```

Esto incluye el caso sutil: "humano hace click en 'aceptar todo' sin revisar". Para mitigar:
- Confirmación granular por campo crítico (no un "OK" global)
- Campos con confidence baja → forzar edit antes de confirmar
- Threshold de confidence configurable, default conservador

### Trazabilidad en audit_log

**Cuando IA está involucrada en una operación:**

```typescript
// audit_log entry
{
  event_name: 'product.created',  // o el evento canónico que aplique
  actor_type: 'user',              // SIEMPRE el humano que confirmó
  actor_user_id: '<uuid real>',    // NUNCA NULL si IA sugirió
  payload: {
    ...datos del evento...,
    ai_suggestion: {
      ai_model_id: 'ocr-v2',
      ai_model_version: '2.4.1',
      ai_confidence: 0.87,
      suggested_values: { ... },
      fields_edited_by_human: ['cuit', 'razon_social'],  // qué cambió el humano
      fields_accepted_as_suggested: ['fecha', 'monto']    // qué aceptó sin cambios
    }
  },
  pii_level: 'pii_low'
}
```

**Reglas clave:**

1. `actor_type` SIEMPRE es `'user'` (o `'system'` si es cron) cuando IA está involucrada. **NUNCA existe `actor_type: 'ai'`** — la IA no es actor responsable legal.
2. `ai_suggestion` en payload registra qué sugirió la IA y qué editó el humano. Esto permite:
   - Auditar accuracy de la IA después
   - Identificar campos donde humanos siempre editan (señal de mal modelo)
   - Reconstruir histórico ante disputa ("la IA sugirió X pero el humano puso Y")
3. `ai_model_id` + `ai_model_version` permiten trazabilidad cuando se actualice el modelo.
4. Los campos `ai_suggestion` quedan sujetos al **scrub policy de Sprint 2 #4** — si la sugerencia contenía secrets accidentales, se scrubean igual que cualquier otro payload.

### Anti-patrones explícitos prohibidos

| Anti-patrón | Por qué prohibido |
|---|---|
| `actor_type: 'ai'` o `actor_type: 'llm'` en audit_log | IA no es actor responsable. Si IA decidió, el `actor_type` es el humano que confirmó. |
| "Auto-aceptar si confidence > 0.95" sin click humano | Eso es IA decidiendo. Confidence alta justifica defaults sugeridos, NO confirmación automática. |
| LLM que llama a Server Action de emisión fiscal | Server Actions de emisión solo se invocan desde UI con sesión humana activa. |
| Chatbot que "ejecuta" operaciones por instrucción conversacional | NO. Chatbot puede mostrar UI/links, humano hace click. |
| OCR + auto-INSERT sin paso intermedio de revisión | Patrón canónico requiere revisión humana explícita. |
| IA sugiere transición de `fiscal_status` o `commercial_status` | Estados son explícitos, transiciones determinísticas (CLAUDE.md §12). |
| LLM genera CAE / código de autorización sintético | CAE solo viene de ARCA. Sintético = fraude. |

## Consecuencias

### Positivas

1. **Auditabilidad legal preservada.** Cada decisión fiscal tiene actor humano responsable. AFIP/inspector siempre puede atribuir.

2. **Determinismo en path crítico.** Fiscal/money/multi-tenant son bit-perfect reproducibles. Sin no-determinismo de modelos.

3. **Fail-closed alineado.** ADR-0022 + CLAUDE.md §13.9 ya exigen fail-closed en path crítico. IA no introduce ambigüedad ahí.

4. **Anti-drift de producto.** Refuerza NON-GOALS.md N-TECH-15. Cuando alguien proponga "agreguemos chatbot que emita facturas" → ADR-0024 dice no.

5. **Liability claro.** Disputa cliente vs Pandora vs proveedor IA: el humano firmó la operación → responsabilidad clara.

6. **Reproducibilidad histórica intacta** (alineado con ADR-0023). Modelo de IA puede cambiar en 2030 — pero el snapshot fiscal del 2026 sigue siendo el mismo.

### Negativas (trade-offs aceptados)

1. **Peor UX en algunos casos.** Una IA que "lo hace todo" sería más cómoda. Trade-off: comodidad vs auditabilidad. Pandora elige auditabilidad.

2. **Mayor fricción en carga de comprobantes proveedores** (F1+ OCR). Cada campo confirmable, no "aceptar todo".

3. **Sin chatbot conversacional que ejecuta.** Pandora no compite con "AI-first ERPs". Es decisión consciente.

4. **Posible obsolescencia percibida.** En 2028-2030, "ERP sin AI" puede sonar viejo. Mitigación: aplicar IA en áreas PERMITIDAS visibles (búsqueda semántica, sugerencias, reportes narrados) sin comprometer principio.

### Items deferidos F1+ con trigger

| Item | Trigger objetivo |
|---|---|
| OCR sugerencia carga comprobantes proveedores | 3+ clientes B2B con > 50 comprobantes/mes manuales |
| Búsqueda semántica productos | Catálogo > 500 productos en 1 cliente |
| Detección de anomalías de venta | Cliente reporta venta fraudulenta no detectada |
| Reportes narrados para contador | Contador adopción explícita pide texto explicativo |
| Asistente onboarding | > 10 nuevos onboarding/mes sostenido |

**NO triggers que justifican entrar a áreas BLINDADAS** — ningún volumen de clientes ni urgencia justifica violar el principio core.

## Cómo aplicar este ADR (checklist futuro)

Antes de incluir IA en cualquier feature nueva de Pandora, responder:

1. ¿La IA decide algo o solo sugiere? Si decide → STOP, reformular como sugerencia + confirmación.
2. ¿La decisión final humana queda registrada en audit_log con `actor_user_id` real? Si no → STOP.
3. ¿Los campos sugeridos tienen confidence visible al humano antes de confirmar? Si no → STOP.
4. ¿El área toca alguno de los 15 puntos BLINDADOS de §"Áreas BLINDADAS"? Si sí → STOP, esta área no admite IA.
5. ¿La operación es reproducible determinísticamente sin la IA? Si no → STOP, la IA no debe ser dependencia crítica.
6. ¿El snapshot/audit registra el modelo + versión + confidence? Si no → STOP, falta trazabilidad.
7. ¿Hay test E2E que simule "IA sugiere mal" + "humano detecta y corrige"? Si no → agregar antes de mergear.

Si todas son ✅ → feature pasa el filtro ADR-0024 y puede implementarse.

## Estado validación

🟢 **Aprobado arquitectónicamente.**

Esta es una decisión interna de producto/arquitectura. NO requiere:
- Validación contadora (no toca regulación fiscal específica)
- Validación abogado (no toca compliance legal específica, salvo si en futuro AAIP publique guía AI específica → revisar entonces)
- Validación owner adicional (ya consensuada en 14-point strategic review 2026-06-02)

## Relación con otras decisiones

### Refuerza

- **ADR-0019 Security baseline + audit log** — IA queda sujeta al mismo audit + scrub policy
- **ADR-0022 Fail-closed semantics** — IA no introduce paths fail-open en zona fiscal
- **ADR-0023 Snapshot autosuficiente** — modelo de IA puede cambiar, snapshot histórico permanece
- **CLAUDE.md §7 Multi-tenant** — IA nunca decide tenant
- **CLAUDE.md §13.9 Fail-closed por concern** — IA en fiscal/money es fail-closed (no IA permitida)
- **CLAUDE.md §22.13 Fail loudly** — IA que no confía debe fallar abierto (sugerir nada), NO inventar

### Cubre / formaliza

- **NON-GOALS.md N-TECH-15** ("AI Copilot features NO críticas") — este ADR pasa de "no goal" a invariante arquitectónica con definición operativa.

### Habilita futuro

- **ADR-0026 (Document template versioning)** — templates pueden ser asistidos por IA (sugerencia de layout), pero la decisión visual final la firma humano.

## Aprendizajes core

1. **Cristalizar invariantes ANTES de que aparezcan tentaciones concretas.** Si ADR-0024 llega post Sprint 6, hay incentivos perversos para "ya que estamos, agreguemos auto-sugerencia fiscal".

2. **Principios arquitectónicos absolutos > policies con excepciones.** Un principio con "salvo en casos X, Y, Z" se erosiona con el tiempo. ADR-0024 no admite excepciones.

3. **Distinguir "IA asiste" de "IA decide" con definición operativa.** El test concreto: ¿qué pasa si la IA se equivoca? Si la respuesta toca fiscal/money/multi-tenant/audit → área blindada.

4. **Audit trace de IA != actor IA.** IA queda en `payload.ai_suggestion`, NO en `actor_type`. Esto preserva responsabilidad legal.

## Referencias

- ADR-0019 — Security baseline F0 (audit log inmutable)
- ADR-0022 — Fiscal Projection Layer + fail-closed semantics
- ADR-0023 — Snapshot Fiscal Completo (reproducibilidad histórica)
- NON-GOALS.md (N-TECH-15) — AI Copilot features NO críticas
- CLAUDE.md §7 Multi-tenant Constitution
- CLAUDE.md §13.9 Fail-closed semantics
- CLAUDE.md §22.13 Fail loudly philosophy
- ADR-0025 (pendiente) — Catálogos regulatorios runtime (complementa ADR-0024: catálogos NO se infieren, vienen de ARCA)

---

**Última revisión:** 2026-06-02
**Próxima revisión esperada:** si AAIP publica guía específica AI o si normativa argentina sobre IA fiscal aparece.
