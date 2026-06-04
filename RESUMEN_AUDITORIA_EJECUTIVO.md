# RESUMEN EJECUTIVO — AUDITORÍA SRS PANDORA ERP v3.0

**Fecha:** 23 mayo 2026  
**Veredicto:** ✅ DOCUMENTO DE CALIDAD SUPERIOR — 🔴 CON 3 BLOQUEANTES CRÍTICOS  
**Recomendación:** NO iniciar desarrollo sin resolver los 3 puntos críticos

---

## SCORECARD RÁPIDA

| Aspecto | Calidad | Estado |
|---|---|---|
| Arquitectura general | ⭐⭐⭐⭐⭐ | Excelente |
| Documentación de decisiones | ⭐⭐⭐⭐⭐ | Exhaustiva |
| Honestidad sobre gaps | ⭐⭐⭐⭐⭐ | Admirable |
| Completeness técnica | ⭐⭐⭐⭐☆ | 95% |
| **Legalidad/validación** | ⭐⭐⭐☆☆ | **GAPS CRÍTICOS** |
| **Seguridad multi-tenant** | ⭐⭐⭐⭐☆ | **Especificación incompleta** |
| **Claridad de reqs** | ⭐⭐⭐⭐☆ | **Algunos ambigüos** |

---

## 3 BLOQUEANTES CRÍTICOS — Resueltos hoy, o el proyecto aborta en W8

### 🔴 #1: AFIP Fiscal sin validación legal (Máximo riesgo)

**Problema:** Proponer "ticket no fiscal + reconciliación async" sin auditoría legal de contador.

**¿Por qué crítico?** 
- Si AFIP dice NO es válido → facturas emitidas inválidas
- Potencial multa de AFIP o rechazo masivo
- Reescritura completa del hot path

**Acción (hoy):**
- [ ] Agendar contador para mañana
- [ ] Presentar: "¿Es válido vender sin factura 2h tras timeout AFIP?"
- [ ] Obtener respuesta escrita

**Timeline:** Máx 48 horas

---

### 🔴 #2: 22 Validaciones humanas sin propietario ni plazo

**Problema:** SRS dice "CRÍTICAS antes de producción" pero no asigna responsable ni fecha.

**¿Por qué crítico?**
- Sin propietario → se olvidan
- Sin fecha → se difieren eternamente
- Descubrir en W8 que todo está mal = 4-8 semanas extra

**Acción (hoy):**
- [ ] Crear spreadsheet: `validaciones_criticas_responsables.xlsx`
- [ ] 22 validaciones con: responsable | plazo | coste | criterio aceptación
- [ ] Asignar Contador a items 1-7, Abogado a items 8-16, Usuarios a items 17-22
- [ ] Enviar a responsables con plazo máximo

**Timeline:** Esta semana

---

### 🔴 #3: SQL RLS policies no especificadas (riesgo seguridad)

**Problema:** SRS dice "multi-tenant RLS + Application Service checks" pero no muestra SQL de policies.

**¿Por qué crítico?**
- Sin policy específica → implementador adivina
- Agujeros de seguridad no detectados hasta producción
- Cross-tenant leak silenciosa (robo de datos)

**Acción (hoy):**
- [ ] Escribir SQL de RLS policies para 3 tablas principales:
  - `sales` (company_id isolation)
  - `audit_log` (con REVOKE INSERT a authenticated)
  - `accountant_access_grants` (multi-empresa)
- [ ] Tests de cross-tenant isolation en CI
- [ ] Validar con Supabase docs/Security team

**Timeline:** Antes de W1

---

## 8 HALLAZGOS DE ALTO IMPACTO — Importantes pero no bloqueantes

| # | Tema | Severidad | Acción |
|---|---|---|---|
| 1 | IVA rounding: "por línea" vs "total" | ALTO | Especificar algoritmo exacto con contador |
| 2 | Demo mode: UX de bloqueo ambigua | ALTO | Documentar API response + UI state para cada fase |
| 3 | Padrón A5 timeout sin fallback | ALTO | Elegir: proceed_with_cache vs block_emission |
| 4 | Documentación en 4 archivos sin sync | ALTO | Merge en 1 o crear CI validation |
| 5 | Stock negativo sin límites | ALTO | Agregar MAX_QTY_PER_OP, MAX_OPS_PER_DAY |
| 6 | Tests de concurrencia no especificados | ALTO | Documentar isolation level + test cases |
| 7 | ADRs referenciados pero no incluidos | ALTO | Agregar resumen ejecutivo a SRS |
| 8 | Fase 0 scope muy ambiciosa | ALTO | Repriorizar: CORE (W1-12) vs SECONDARY (W13-16) |

---

## CHECKLIST DE REMEDIACIÓN

**SEMANA 0 (Esta semana) — 3 días de trabajo:**

- [ ] **Contador:** agendar sesión 2h (validar AFIP + IVA + redondeo)
  - Coste: ~$40k ARS
  - Resultado: acta firmada con respuestas a 7 preguntas
  
- [ ] **Abogado:** agendar sesión 2h (validar audit_log + privacidad + AAIP)
  - Coste: ~$50k ARS
  - Resultado: legal opinion escrita

- [ ] **Spreadsheet "validaciones_criticas":** 22 items asignados
  - Responsable por cada uno
  - Plazo máximo explícito
  - Criterio de aceptación claro

- [ ] **SQL policies:** escribir 3 policies principales
  - `sales`: company_id isolation
  - `audit_log`: REVOKE INSERT
  - `accountant_access`: multi-empresa con EXISTS

- [ ] **API contracts:** especificar demo mode exacto
  - CreateSaleDTO: validación cuando status='expired'
  - Response: { success: false, code: 'DEMO_EXPIRED' }
  - UI: button disabled o error modal

**SEMANA 1 (Primera semana real) — Antes de first commit:**

- [ ] Incorporar feedback de contador + abogado al SRS
- [ ] Actualizar README: "Validaciones completadas: X/22"
- [ ] Escribir tests de cross-tenant isolation (CI red/green)
- [ ] Repriorizar Fase 0: separar CORE vs SECONDARY
- [ ] Crear runbook de 5 escenarios críticos

---

## VALIDACIONES CRÍTICAS — Responsables asignados

**🔴 CON CONTADOR (7 items):**
1. Política: ¿venta sin factura tras 2h es válida legalmente?
2. XML AFIP: ¿10 años cumple Ley 11.683?
3. Redondeo: ¿half-up, half-even o half-down que AFIP espera?
4. IVA: ¿redondeo por línea o total?
5. Customer snapshot: ¿campos obligatorios por tipo de comprobante?
6. Padrón A5: ¿timeout, qué hacer?
7. Condición IVA: ¿tenant cambio requiere notificación a AFIP?

**Plazo máximo:** Semana 0  
**Coste:** ~$40k ARS (consulta one-shot)

---

**🔴 CON ABOGADO (9 items):**
1. Audit_log: ¿cierre estricto cumple Ley 11.683?
2. Delete company: ¿7 días delay defendible?
3. Exports: ¿privacidad compliance?
4. Ley 25.326: ¿datos personales en logs?
5. T&C: ¿limitación de responsabilidad?
6. AAIP: ¿inscripción obligatoria?
7. DPAs: ¿modelo con clientes?
8. Customer snapshot: ¿derecho cliente a actualizar vs inmutabilidad histórica?
9. Idempotency archive: ¿retención vs derecho al olvido?

**Plazo máximo:** Semana 0-1  
**Coste:** ~$50k ARS (consulta one-shot)

---

**🔴 CON CLIENTES REALES (6 items) — Después de validaciones legales:**
1. Pricing validado ($25k/$60k ARS)
2. UX operacional en POS
3. Timeline suspensión por impago
4. Sonido/notificaciones local
5. Demo mode timeline aceptable
6. Target táctil en tablets reales

**Plazo máximo:** Antes de first cliente pagando (Semana 8 aprox)  
**Coste:** Time del owner + product

---

## SCORE FINAL DE CALIDAD

**Calidad Técnica:** 9/10  
**Claridad Documentación:** 8/10  
**Completeness:** 8/10  
**Legalidad/Validación:** 4/10 ⚠️  
**Seguridad especificada:** 7/10 ⚠️  

**SCORE GENERAL: 7.2/10** con asteriscos críticos

---

## LO QUE ESTÁ BIEN

✅ Arquitectura multi-tenant clara  
✅ Decisiones documentadas con contexto  
✅ Honestidad sobre validaciones pendientes  
✅ 17 ADRs formales  
✅ 12 máquinas de estado definidas  
✅ Visual system coherente  
✅ Observabilidad desde Fase 0  
✅ Roadmap realista por fases  

---

## LO QUE FALTA RESOLVER

🔴 Validación legal de AFIP fiscal  
🔴 Propietarios de 22 validaciones críticas  
🔴 SQL policies multi-tenant específicas  

⚠️ IVA rounding algorithm (exactitud)  
⚠️ Demo mode UX (API + UI)  
⚠️ Padrón A5 fallback (proceed vs block)  
⚠️ Fase 0 reprioritización (scope demasiado grande)  

---

## RECOMENDACIÓN FINAL

**"No mergéis Commit #1 sin:**
1. **Acta firmada de contador** (AFIP fiscal validado)
2. **Legal opinion de abogado** (privacidad/compliance)
3. **RLS policies testeadas** (cross-tenant aislado)
4. **Spreadsheet de responsables** (22 validaciones asignadas)"

**Esto toma 3-5 días. Vale $100k ARS en consultas. Evita $5M ARS en rework.**

---

**Auditoría completada:** 23 mayo 2026  
**Próxima revisión:** Post-resolución de 3 bloqueantes (Semana 1)  
**Criticidad:** 🔴 MÁXIMA — Retrasar dev sin estos inputs

