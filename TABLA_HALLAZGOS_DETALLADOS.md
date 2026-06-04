# TABLA COMPARATIVA — HALLAZGOS DETALLADOS

## Críticos (Bloqueantes para desarrollo)

| ID | Hallazgo | Ubicación | Severidad | Impacto | Acción | Plazo | Propietario |
|---|---|---|---|---|---|---|---|
| C1 | AFIP timeout + ticket no fiscal SIN validación legal | 11.5, 11.12, D.1 | 🔴 CRÍTICO | Facturas inválidas en producción, multa AFIP | Consulta contador + abogado (acta escrita) | Hoy-Mañana | Contador especialista |
| C2 | 22 validaciones críticas SIN propietario/plazo | D.1, README | 🔴 CRÍTICO | Validaciones se olvidan, descubrimiento tardío en W8 | Crear spreadsheet, asignar responsables | Hoy | Owner Pandora |
| C3 | RLS policies multi-tenant NO especificadas en SQL | 5.4, ADR-0002 (ref) | 🔴 CRÍTICO | Cross-tenant leak silenciosa (robo datos) | Escribir SQL + tests CI | Hoy-W1 | Tech lead |
| C4 | Demo mode UX/bloqueo AMBIGUO | 14.4 | 🔴 CRÍTICO | Mala UX → confusión cliente → churn | Documentar API responses + UI states | W1 | Product/Dev |
| C5 | IVA rounding "por línea" vs "total" SIN algoritmo | 11.10, D.1 item 8 | 🔴 CRÍTICO | Facturas rechazadas AFIP, diferencias acumuladas | Test case + validación contador | Hoy-Mañana | Contador |
| C6 | Stock negativo SIN límites automáticos | 8.5 | 🔴 CRÍTICO | Fraude interno (venta de stock inexistente) | Agregar MAX_QTY, MAX_OPS, rate limiting | W1 | Dev |
| C7 | Padrón A5 timeout SIN fallback (proceed vs block) | 11.7, D.1 | 🔴 CRÍTICO | Bloqueo total de ventas O fraude por no validar | Elegir policy, documentar, test | Mañana | Product |

---

## Altos (Importantes, afectan timeline/calidad)

| ID | Hallazgo | Ubicación | Severidad | Impacto | Acción | Plazo | Propietario |
|---|---|---|---|---|---|---|---|
| A1 | Documentación en 4 archivos SIN sincronización | Estructura del paquete | 🟡 ALTO | Desincronización → implementadores usan valores contradictorios | Merge en 1 archivo O crear CI validation | W1 | Owner |
| A2 | 17 ADRs referenciados pero NO incluidos | README 15-33 | 🟡 ALTO | Lectura incompleta, decisiones no validables | Incluir resumen ADRs en SRS + links | W1 | Tech lead |
| A3 | Fase 0 scope DEMASIADO ambiciosa (16 semanas) | 2.1, 18 | 🟡 ALTO | Desvío timeline, 4-8 semanas de extensión | Repriorizar: CORE (W1-12) vs SECONDARY (W13-16) | HOY | Owner + Product |
| A4 | Tests de concurrencia NO especificados | 2.2 | 🟡 ALTO | Concurrency bugs detectados en producción, no en CI | Documentar isolation level + test cases | W1 | QA/Dev |
| A5 | Permissions matrix SIN validación de UX | Apéndice C | 🟡 ALTO | Overengineering, UX confusa al implementar | Expandir con casos de uso de cada rol | W1 | Product |
| A6 | Payment methods hardcodeados | 9.4 | 🟡 ALTO | Agregar método nuevo = schema + lógica change | Crear abstracción PaymentMethod configurable | F1 | Dev |
| A7 | IVA rates hardcodeados | 11 | 🟡 ALTO | AFIP cambia rates → SRS inválido | Usar configuración en DB + seed inicial | W1 | Dev |
| A8 | Notification stack incompleto (costes no spec) | 12 | 🟡 ALTO | Sorpresas con facturación de Twilio/Resend | Documentar costes y rate limiting | W1 | Ops/Finance |

---

## Menores (Clarificaciones, no bloqueantes)

| ID | Hallazgo | Ubicación | Severidad | Impacto | Acción | Plazo | Propietario |
|---|---|---|---|---|---|---|---|
| M1 | Timeout values inconsistentes (30s vs 8s) | 2.2, 9.5, 11.5, 13.4 | ℹ️ MENOR | Confusión en implementación | Clarificar: 30s hard timeout, 8s SLO | W1 | Tech lead |
| M2 | Validación humana sin coste explícito | D.1, README | ℹ️ MENOR | Budget sorpresas | Desglosar coste por validación (contador $40k, abogado $50k) | HOY | Finance |
| M3 | Runbook de 5 escenarios no especificado | Apéndice B.3 | ℹ️ MENOR | Onboarding operativo débil | Definir 5 escenarios críticos + paso a paso | W1 | Ops |
| M4 | Walkthrough "primer día" ausente | General | ℹ️ MENOR | Decisiones no tienen narrativa | Crear document: "8:00-20:00 en comercio" | W1 | Product |

---

## MATRIZ CAUSA-RAÍZ

| Hallazgo | Por qué ocurrió | Cómo prevenirlo |
|---|---|---|
| **Validaciones SIN propietario** | SRS menciona pero no asigna | En cada validación pendiente: "Responsable: X, Plazo: Y" |
| **AFIP fiscal NO validado** | Asumió política sin consultar | Regla: "NUNCA asumir validez legal, siempre consultar" |
| **RLS policies NO en SQL** | SRS menciona arquitectura pero no código | Template: "Si es security-critical, incluir SQL concreto" |
| **Demo mode UX ambigua** | Describió intent sin especificar API | Template: "Si es UX, especificar: request → response → UI" |
| **Documentación fragmentada** | Dividir por facilidad de edición | Usar single source of truth O CI validation |
| **Scope demasiado grande** | Feature creep en roadmap | Usar MoSCoW: Must-have (F0) vs Could-have (F1) |

---

## RIESGOS SI NO SE RESUELVEN

### C1: AFIP fiscal sin validación
**Si no resuelve antes de código productivo:**
- Semana 8: AFIP rechaza facturas (¿razón? política no válida)
- Reescribir hot path: 2-4 semanas
- Clientes pierden historial de ventas
- Potencial multa AFIP (puede ser 0 a significativo)

### C2: Validaciones SIN propietario
**Si no resuelve antes de Semana 1:**
- Semana 8: Descubrir "validación X no se hizo"
- Validación = 1-2 semanas de investigación legal
- Desarrollo bloqueado esperando respuesta
- Impacto: +4-8 semanas de delay

### C3: RLS policies NO validadas
**Si no resuelve antes de Semana 2:**
- Semana 6: Cross-tenant leak detectada en testing
- Reescribir RLS + policies: 1-2 semanas
- Auditoría de seguridad retrasada
- Perdida de confianza: "¿Qué más está inseguro?"

### C4: Demo mode UX ambigua
**Si no resuelve antes de Semana 3:**
- Semana 5: Implementador A crea UX así, Implementador B así diferente
- Rework de componentes: 3-5 días
- Usuario confundido con UI inconsistente
- Mala primera impresión en demo

### A3: Scope F0 demasiado grande
**Si no reprioriza antes de Semana 1:**
- Semana 4: 30% adelantado (vs 25% planeado)
- Semana 8: 50% adelantado, sprint presión alta
- Semana 12: Extensión a 16 semanas (deadline miss)
- Burnout: 1-2 devs burned out

---

## ORDEN DE RESOLUCIÓN RECOMENDADO

```
FASE 0 — SEMANAL 0 (HOY → MAÑANA)
├─ C1: AFIP validación legal (Contador) ← INICIO HOY
├─ C2: Crear spreadsheet validaciones ← INICIO HOY
├─ C5: IVA rounding validación (Contador) ← JUNTO CON C1
└─ C7: Padrón policy decision ← HOY tarde

FASE 1 — SEMANAL 0 (MAÑANA → VIERNES)
├─ C2: Seguimiento spreadsheet + respuestas
├─ C3: RLS policies SQL + tests
├─ A3: Repriorizar Fase 0 (CORE vs SECONDARY)
└─ A4: Concurrency test spec

FASE 2 — SEMANAL 1
├─ C4: Demo mode UX API contracts
├─ C6: Stock negativo rate limiting
├─ A1: Consolidar documentación (merge o CI)
├─ A2: Resumen ADRs en SRS
└─ A5: Roles matrix + casos de uso

FASE 3 — SEMANAL 2
├─ Validaciones contador + abogado incorporadas al SRS
├─ Tests RLS con CI validación
├─ Go/No-go para Semana 1 desarrollo
└─ Reunion: "¿Algún bloqueante?"
```

---

## SUCCESS CRITERIA

### Semana 0 (HOY-27 mayo)
- ✅ Contador validó AFIP: acta escrita
- ✅ Abogado validó privacidad: legal opinion
- ✅ Spreadsheet 22 validaciones: ≥ 10 completadas
- ✅ RLS policies: SQL escrito + tests verdes

### Semana 1 (28 mayo - 3 junio)
- ✅ SRS actualizado con feedback legal
- ✅ Demo mode UX especificado (API + UI)
- ✅ Padrón fallback implementado (proceed vs block)
- ✅ Stock negativo con limits
- ✅ README: "🟢 3/3 bloqueantes resueltos"

### Semana 2-3
- ✅ 22 validaciones trackeadas (≥ 80% completadas)
- ✅ Roles + permissions validados con mockups
- ✅ Fase 0 reprioritizado (CORE definido)
- ✅ Tests CI pasando

---

## CONVERSACIÓN CON CONTADOR (Próxima sesión)

**Duración:** 2 horas  
**Coste:** $40-50k ARS  
**Preguntas obligatorias:**

1. **AFIP timeout policy**
   - "Si AFIP no responde 30s, emitimos 'ticket no fiscal' sin CAE. ¿Válido?"
   - "¿Máximo tiempo permitido sin CAE antes de multa?"
   - "¿Hay precedentes de multas por esto?"

2. **IVA rounding**
   - "¿AFIP espera redondeo por línea o total?"
   - "¿Algorithm exacto?"
   - "¿Cómo valido si está correcto?"

3. **Customer snapshot**
   - "¿Campos obligatorios por tipo (A/B/C)?"
   - "¿Puedo usar snapshot vs datos actuales?"

4. **Retención XML**
   - "¿10 años cumple Ley 11.683?"
   - "¿Hot vs cold storage política?"

5. **Padrón A5**
   - "¿Validación CUIT obligatoria en hot path?"
   - "¿Si Padrón timeout, qué hago?"

**Resultado esperado:**
- Documento firmado con respuestas
- Cambios necesarios al SRS identificados
- "Go" o "No-go" para política de AFIP

---

## CONVERSACIÓN CON ABOGADO (Próxima sesión)

**Duración:** 2 horas  
**Coste:** $50k ARS  
**Preguntas obligatorias:**

1. **Audit log**
   - "¿Cierre estricto (REVOKE INSERT) cumple Ley 11.683?"
   - "¿Retención 10 años es suficiente?"

2. **Privacidad**
   - "¿Exports de datos personales complian con Ley 25.326?"
   - "¿Datos en logs requieren especial consideración?"

3. **Compliance general**
   - "¿Inscripción AAIP obligatoria?"
   - "¿DPAs modelo con clientes?"
   - "¿T&C con limitación de responsabilidad validan?"

4. **Datos del cliente**
   - "¿Customer snapshot inmutable vs derecho a actualizar?"
   - "¿Qué hacer con histórico si cliente pide 'borrar mis datos'?"

5. **Empresa**
   - "¿Delete company con 7 días delay defendible?"
   - "¿Cómo documentar para auditoría?"

**Resultado esperado:**
- Documento firmado con legal opinions
- "Go" o "No-go" para políticas de privacidad
- Recomendaciones para T&C

---

