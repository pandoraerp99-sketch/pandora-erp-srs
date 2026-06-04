# PLAN DE ACCIÓN INMEDIATO — BLOQUEANTES CRÍTICOS

**Fecha:** 23 mayo 2026  
**Plazo:** Próximas 5 días  
**Objetivo:** Resolver 3 bloqueantes antes de Semana 1 de desarrollo  

---

## BLOQUEANTE #1: Validación Legal AFIP Fiscal

**Descripción:** El SRS propone "ticket no fiscal + reconciliación async" pero esto NO está validado legalmente.

### Acción paso a paso

#### Paso 1: Encontrar contador (HOY)
```
Perfil buscado:
- Contador matriculado en Argentina
- Con experiencia en facturación electrónica AFIP
- Disponible para consulta urgente (1-2 horas, one-shot)

Dónde buscar:
- Cámara de Contadores de [tu provincia]
- LinkedIn: "contador AFIP argentino"
- Amigos/red: "¿recomendación de contador que sepa AFIP?"

Coste estimado: $30-50k ARS por sesión 2h
```

#### Paso 2: Agendar sesión (Mañana)
```
Correo/Mensaje:

Asunto: Consulta urgente - Validación legal de política fiscal (AFIP)

Hola [Contador],

Estoy desarrollando una plataforma POS+ERP para comercios argentinos (Pandora ERP).

Necesito validar UNA política fiscal clave:

"Si AFIP no responde tras 30 segundos durante facturación:
1. Emito 'ticket no fiscal' (sin CAE) al cliente
2. El sistema intenta reconciliación async cada 5 min × 24h
3. Si 2h pasaron sin CAE: alerto al comerciante para gestión manual"

Preguntas:

1. ¿Esto es legalmente válido en Argentina?
2. ¿Hay límite de tiempo máximo sin CAE?
3. ¿Hay precedentes de multas AFIP por esto?
4. ¿Qué recomiendas como alternativa más segura?

Disponibilidad: Mañana o pasado
Duración: ~1-2 horas
Presupuesto: $50k ARS

¿Podés?

---
[Tu nombre]
[Tu teléfono]
```

#### Paso 3: Preparar preguntas (Hoy, 2h antes de sesión)
```
1. Política de "ticket no fiscal"
   - ¿Válido legalmente?
   - ¿Máximo tiempo permitido sin CAE?
   - ¿Precedentes de multas?

2. Redondeo de IVA
   - ¿Por línea o por total?
   - ¿Política exacta que AFIP espera?
   - ¿Test case para validar?

3. Retención de XML
   - ¿10 años cumple Ley 11.683?
   - ¿Hot storage vs cold storage?

4. Customer snapshot
   - ¿Campos obligatorios por tipo de comprobante (A/B/C)?
   - ¿Validación CUIT, es requerida en hot path?

5. Cambio de condición IVA
   - ¿Tenant cambia de RI a Monotributo, requiere notificación a AFIP?

6. Cálculo de IVA por línea
   - ¿Algoritmo exacto para redondeo?
```

#### Paso 4: Documentar respuestas (Mismo día, después de sesión)
```
Crear documento: validacion_contador_AFIP_[fecha].md

Formato:

PREGUNTA 1: ¿Ticket no fiscal es válido?
RESPUESTA: [Transcripción]
CONCLUSIÓN: [Tu interpretación]
ACCIÓN: [Cambios al SRS si aplican]
VALIDADO: ✓ O ✗

... (repetir para cada pregunta)
```

#### Paso 5: Actualizar SRS (W1)
```
En sección 11.5, agregar:

🟢 VALIDADO — Contador [Nombre], [Fecha]

Política de AFIP timeout:
- [Decisión final basada en feedback]
- [Cambios al algoritmo si aplican]
- [Referencias legales si las hay]
```

**Timeline:** HOY → MAÑANA (sesión) → MISMO DÍA (documentar)  
**Responsable:** TÚ  
**Coste:** $50k ARS aprox  
**Bloqueador:** Si respuesta es "NO es válido", rediseñar hot path (⚠️ 2 semanas extra)

---

## BLOQUEANTE #2: 22 Validaciones sin propietario

**Descripción:** SRS lista 22 validaciones críticas pero nadie es responsable de auditorlas.

### Acción paso a paso

#### Paso 1: Crear spreadsheet (HOY, 1h)
```
Archivo: validaciones_criticas_responsables.xlsx

Columnas:
- ID (V1, V2, ... V22)
- Validación (texto)
- Responsable (Contador / Abogado / Usuario / N/A)
- Plazo máximo (Semana X o Fecha)
- Coste estimado (si aplica)
- Criterio de aceptación
- Status (Pendiente / En progreso / Completada / Bloqueada)

Ejemplo:

ID | Validación | Responsable | Plazo | Coste | Criterio | Status
---|---|---|---|---|---|---
V1 | AFIP ticket no fiscal válido | Contador | W0 | $50k | Acta firmada | Pendiente
V2 | Retención XML cumple Ley 11.683 | Contador | W0 | $50k | Legal opinion | Pendiente
V3 | Audit_log cierre estricto | Abogado | W0-1 | $50k | Legal opinion | Pendiente
...
```

#### Paso 2: Asignar responsables (HOY, 30min)
```
CON CONTADOR (7 items):
- V1: AFIP ticket no fiscal
- V2: XML 10 años
- V3: Redondeo exacto
- V4: IVA por línea
- V5: Customer snapshot
- V6: Padrón A5 policy
- V7: Cambio condición IVA

CON ABOGADO (9 items):
- V8: Audit_log Ley 11.683
- V9: Delete company 7 días
- V10: Privacidad exports
... (V11-V16)

CON USUARIOS REALES (6 items):
- V17: Pricing $25k/$60k validado
- V18: UX operacional POS
... (V19-V22)
```

#### Paso 3: Fijar plazos (HOY, 30min)
```
Regla:
- Validaciones con Contador + Abogado: Semana 0-1 (BLOQUEANTES)
- Validaciones con usuarios: Semana 6-7 (post primeros 5 clientes)

En spreadsheet:

V1 | AFIP ticket no fiscal | Contador | 23/5 (mañana) | ...
V2 | XML 10 años | Contador | 24/5 | ...
...
V8 | Audit_log | Abogado | 24/5 | ...
...
V17 | Pricing | Usuarios | 30/6 | ...
```

#### Paso 4: Enviar a responsables (MAÑANA)
```
Email a contador:

Asunto: [URGENTE] 7 validaciones críticas AFIP - Pandora ERP

Hola [Contador],

Adjunto: validaciones_criticas_responsables.xlsx

Tu responsabilidad: Validar estos 7 items

V1. ¿AFIP ticket no fiscal es válido?
V2. ¿Retención XML 10 años cumple Ley 11.683?
V3. ¿Redondeo half-up es correcto?
V4. ¿IVA por línea es el algoritmo?
V5. ¿Customer snapshot con campos obligatorios?
V6. ¿Padrón A5 timeout policy?
V7. ¿Cambio condición IVA requiere notificación?

Plazo: 24/5 EOD (mañana)
Coste: $50k ARS

¿Confirmas?
```

Email a abogado (similar):
```
9 validaciones de privacidad/compliance
Plazo: 24/5-25/5
Coste: $50k ARS
```

#### Paso 5: Trackear en spreadsheet (Diario)
```
Cada mañana:
- ¿Contador respondió V1-V7?
- ¿Abogado respondió V8-V16?
- ¿Hay gaps?
- ¿Bloqueantes?

Actualizar Status:
V1: Pendiente → En progreso (contador respondió) → Completada
```

**Timeline:** HOY (crear) → MAÑANA (enviar) → 24/5 (respuestas) → 25/5 (compilar)  
**Responsable:** TÚ  
**Coste:** $100k ARS aprox (contador + abogado)  
**Bloqueador:** Si alguno dice "no es válido", revisar SRS (⚠️ 1-2 semanas)

---

## BLOQUEANTE #3: SQL RLS policies

**Descripción:** SRS dice "RLS en Supabase" pero no muestra código de policies. Sin código, no se puede validar seguridad.

### Acción paso a paso

#### Paso 1: Listar tablas sensibles (HOY, 30min)
```
Tablas que REQUIEREN RLS:

TIER 1 — Críticas (aislamiento obligatorio):
- sales (company_id isolation)
- audit_log (REVOKE INSERT a authenticated)
- customers (company_id isolation)
- stock_movements (company_id isolation)

TIER 2 — Media (isolation importante):
- cash_sessions (company_id isolation)
- products (company_id isolation)
- payment_methods (company_id isolation)

TIER 3 — Baja (isolation nice-to-have):
- users (company_id isolation)
- subscription (company_id isolation)
```

#### Paso 2: Escribir policies para TIER 1 (HOY, 2-3h)

```sql
-- 1. sales — isolation básica por company_id
CREATE POLICY "users_can_view_own_company_sales"
ON sales FOR SELECT
USING (company_id = auth.jwt() -> 'company_id');

CREATE POLICY "users_can_create_own_company_sales"
ON sales FOR INSERT
WITH CHECK (company_id = auth.jwt() -> 'company_id');

-- Test: Usuario de tenant A intenta leer sales de tenant B
-- Expected: 0 rows

---

-- 2. audit_log — REVOKE INSERT a authenticated (solo system)
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

REVOKE INSERT ON audit_log FROM authenticated;

-- Solo Application Service puede insertar (via service_role key)
CREATE POLICY "system_can_insert_audit_log"
ON audit_log FOR INSERT
TO authenticated
WITH CHECK (false);  -- Nunca, salvo service_role

---

-- 3. accountant_access — multi-empresa
CREATE POLICY "accountant_sees_granted_companies"
ON companies FOR SELECT
USING (
  -- Owner siempre ve su company
  auth.uid() = owner_id
  OR
  -- Contador ve companies donde fue invitado
  EXISTS (
    SELECT 1 FROM accountant_access_grants
    WHERE accountant_id = auth.uid()
    AND company_id = companies.id
    AND revoked_at IS NULL
  )
);

-- Test: Contador A con acceso a Empresa 1
-- SELECT de Empresa 2 → 0 rows
-- SELECT de Empresa 1 → datos visibles
```

#### Paso 3: Escribir tests (W1, 3h)

```typescript
// tests/security/rls.test.ts

import { createClient } from '@supabase/supabase-js';

describe('RLS - Cross-tenant isolation', () => {
  
  test('Tenant A cannot read Tenant B sales', async () => {
    const tenantA = await createTestTenant();
    const tenantB = await createTestTenant();
    
    // Crear sale en tenantB
    const saleB = await createSaleInTenant(tenantB, {
      amount: 100,
      productId: 'product-x',
    });
    
    // Cliente de tenantA intenta leer la sale
    const clientA = createSupabaseClient(tenantA.jwt);
    const { data, error } = await clientA
      .from('sales')
      .select()
      .eq('id', saleB.id);
    
    // Debe bloquearse por RLS
    expect(data).toHaveLength(0);
    expect(error?.message).toMatch(/row-level security/i);
  });
  
  test('audit_log insert blocked for authenticated (not service_role)', async () => {
    const tenant = await createTestTenant();
    const client = createSupabaseClient(tenant.jwt);
    
    // Intentar insertar audit log directamente
    const { error } = await client
      .from('audit_log')
      .insert({
        company_id: tenant.id,
        action: 'suspicious_activity',
        entity: 'sales',
      });
    
    // Debe fallar
    expect(error?.message).toMatch(/permission denied/i);
  });
  
  test('Accountant can read only granted companies', async () => {
    const accountant = await createTestUser({ role: 'accountant' });
    const companyA = await createTestTenant();
    const companyB = await createTestTenant();
    
    // Grant accountant acceso a companyA
    await grantAccountantAccess(accountant.id, companyA.id);
    
    const clientAccountant = createSupabaseClient(accountant.jwt);
    
    // Leer companyA → success
    const { data: dataA } = await clientAccountant
      .from('companies')
      .select()
      .eq('id', companyA.id);
    expect(dataA).toHaveLength(1);
    
    // Leer companyB → bloqueado por RLS
    const { data: dataB } = await clientAccountant
      .from('companies')
      .select()
      .eq('id', companyB.id);
    expect(dataB).toHaveLength(0);
  });
});
```

#### Paso 4: Validar con Supabase team (W1, 1h)
```
Opción A: Email a Supabase support
- Adjuntar policies
- Pedir review de seguridad
- Respuesta típica: 24-48h

Opción B: Revisar con DevSecOps si lo tenes en equipo

Opción C: Consultar docs de Supabase + Stack Overflow
```

#### Paso 5: Integrar en SRS (W1)
```
En sección 5 y ADR-0002:

🟢 VALIDADO — RLS policies específicas

[Incluir código SQL actualizado]

Tests de aislamiento: CI/CD verde
Review Supabase: Completada [Fecha]
```

**Timeline:** HOY (escribir) → W1 (tests + validation)  
**Responsable:** TÚ (con posible review de Supabase)  
**Coste:** 0 (solo tiempo)  
**Bloqueador:** Si hay agujeros de seguridad, rediseño (⚠️ 1 semana)

---

## MATRIZ DE RESPONSABILIDADES Y PLAZOS

| Bloqueante | Responsable | Acción | Plazo | Coste | Riesgo si no |
|---|---|---|---|---|---|
| #1 AFIP fiscal | TÚ + Contador | Sesión validación | Hoy-Mañana | $50k | Facturas inválidas W8 |
| #2 Validaciones | TÚ | Spreadsheet + asignación | Hoy-Mañana | $100k | Gap en auditoría |
| #3 RLS policies | TÚ (+ Supabase review) | Código + tests | W1 | 0 | Cross-tenant leak |

---

## DAILY STANDUP — Próximos 5 días

### HOY (23 mayo)
- [ ] Buscar contador (1h)
- [ ] Crear spreadsheet validaciones (1h)
- [ ] Escribir SQL RLS (2h)
- [ ] Agendar sesión contador (30min)

### MAÑANA (24 mayo)
- [ ] Sesión con contador (2h)
- [ ] Enviar spreadsheet a contador + abogado (30min)
- [ ] Documentar respuestas contador (1h)
- [ ] Refinar SQL policies basado en counter feedback (1h)

### 25 mayo
- [ ] Sesión con abogado (2h)
- [ ] Compilar todas las respuestas en documento (2h)
- [ ] Actualizar SRS secciones relevantes (1h)

### 26-27 mayo
- [ ] Escribir tests RLS (3h)
- [ ] Validar con Supabase (1h async)
- [ ] Crear runbook de 5 escenarios críticos (2h)
- [ ] Buffer para resolución de gaps (variable)

### 28 mayo (viernes)
- [ ] Checkpoint: ¿Todos los 3 bloqueantes resueltos?
- [ ] Go/No-go para Semana 1 de dev
- [ ] Actualizar README: "Status: 3/3 bloqueantes resueltos"

---

## DOCUMENTOS A ENTREGAR

1. **validaciones_contador_AFIP_[fecha].md** — Respuestas del contador
2. **validaciones_abogado_[fecha].md** — Respuestas del abogado
3. **validaciones_criticas_responsables.xlsx** — Tracker actualizado
4. **rls_policies_final.sql** — Código de RLS listo para Supabase
5. **rls_policies_tests.ts** — Tests de cross-tenant isolation
6. **PANDORA_ERP_SRS_v3.0_ACTUALIZADO.md** — SRS con incorporación de validaciones

---

## SEÑALES DE ÉXITO

✅ Contador validó política de AFIP (respuesta escrita)  
✅ Abogado validó privacidad + compliance (legal opinion)  
✅ Spreadsheet de 22 validaciones actualizado (Status ≥ 10 items completados)  
✅ RLS policies escritas y testeadas (CI verde)  
✅ README actualizado: "🟢 Bloqueantes críticos resueltos"  

---

**Inicio:** 23 mayo 2026, 14:00  
**Fin esperado:** 27 mayo 2026, 18:00  
**Buffer:** 1 día (28 mayo)  
**Go/No-go:** 28 mayo, 10:00

---

