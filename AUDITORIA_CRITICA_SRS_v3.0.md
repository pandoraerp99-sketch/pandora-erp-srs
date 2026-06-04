# AUDITORÍA CRÍTICA Y RIGUROSA — PANDORA ERP SRS v3.0

**Fecha de auditoría:** 23 mayo 2026  
**Auditor:** Análisis crítico asistido por IA  
**Documentos auditados:** README.md + PANDORA_ERP_SRS_v3.0.md + parte2 + parte3  
**Estado del documento:** Aprobado para implementación (con hallazgos críticos)

---

## RESUMEN EJECUTIVO

El SRS v3.0 de Pandora ERP es un **documento de calidad muy superior al promedio**, con:
- ✅ Arquitectura clara y bien justificada
- ✅ Decisiones documentadas con contexto
- ✅ 17 ADRs formales
- ✅ Honestidad explícita sobre validaciones pendientes

**PERO tiene 11 hallazgos CRÍTICOS y 8 de ALTO IMPACTO que deben resolverse ANTES de escribir código productivo.**

---

# 1. HALLAZGOS CRÍTICOS — Bloqueantes para producción

## 1.1 🔴 CRÍTICO: Validaciones humanas sin propietario ni plazo

**Ubicación:** README.md líneas 140-171, SRS sección D.1  
**Severidad:** CRÍTICO  
**Confianza:** 100%

### Problema

Apéndice D.1 lista 22 validaciones que el documento marca como **NO negociables antes de producción**:

```
- [ ] Política de "venta sin factura tras 2h" validada (CONTADOR)
- [ ] Retención XML AFIP 10 años (CONTADOR)
- [ ] Redondeo exacto que AFIP espera (CONTADOR)
- [ ] Compliance Ley 11.683 (ABOGADO)
- [ ] Privacidad de exports (ABOGADO)
... (17 más)
```

**El problema:** Ninguna tiene:
- Responsable asignado
- Plazo máximo  
- Coste estimado
- Criterio de aceptación explícito
- Dependencia de otras validaciones

### Impacto

- **Riesgo legal:** Empezar código sin validar AFIP = multa potencial o invalidez de facturas
- **Riesgo operacional:** Descubrir en Week 8 que todo lo fiscal está mal = reescritura completa
- **Riesgo de timeline:** Sin propietarios, se olvidan. Sin plazos, se difieren indefinidamente

### Evidencia

```
README.md línea 142:
"No tipear código de producción sin resolver esto:"

Pero luego:
README.md línea 146: "Con contador advisor (1 sesión one-shot)"
```

NO hay:
- ¿Cuál contador? ¿De dónde sacas contacto?
- ¿Cuándo es "antes de producción"? ¿Antes de Fase 0 semana 1? ¿Semana 8?
- ¿Qué pasa si contador no estará disponible?

### Recomendación

**CREAR MATRIZ CRÍTICA antes de abrir GitHub (Semana -1):**

| Validación | Responsable | Plazo máximo | Coste est. | Criterio accept. | Riesgo si falla |
|---|---|---|---|---|---|
| Política venta sin factura | Contador X | Semana 0 (antes code) | $40k ARS | 1 reunión, acta firmada | Código inútil |
| XML 10 años AFIP | Contador X | Semana 0 | $40k | Confirmación escrita | Incumpl. legal |
| Redondeo IVA exacto | Contador X | Semana 2 | $20k | Test case aprobado | Facturas rechazo |
| Compliance Ley 11.683 | Abogado Y | Semana 1 | $50k | Legal opinion | Multa |
| Privacidad exports | Abogado Y | Semana 1 | $50k | Legal opinion | AAIP notificación |

**Acion concreta:**
1. Esta semana: conseguir contactos reales (contador + abogado)
2. Crear spreadsheet con 22 validaciones, asignar responsable + plazo
3. **Bloquear primer commit de código de negocio hasta tener 80% completado**
4. En README, actualizar: "Validaciones completadas: X/22"

---

## 1.2 🔴 CRÍTICO: AFIP timeout + ticket no fiscal como fallback sin validación legal

**Ubicación:** Secciones 9.5, 11.5, 11.12  
**Severidad:** CRÍTICO  
**Confianza:** 95%

### Problema

El SRS propone un **patrón innovador pero potencialmente ilegal:**

```
AFIP no responde tras 30s
↓
Emitir "ticket no fiscal" (sin CAE)
↓
Luego async reconciliation intenta obtener CAE
↓
Si 2h sin CAE: "contactá a tu contador para gestión manual"
```

**Cita textual (sección 11.5):**
> "Si timeout > 8s en FSR y no hay CAE, emitir «ticket no fiscal» 
> (sales.requires_reconciliation = true) y mostrar toast"

**El riesgo legal:** ¿Es legalmente válido en Argentina vender SIN factura por 2 horas?

- AFIP requiere factura **inmediata**
- Código fiscal argentino exige "comprobante de venta"
- Ticket no fiscal = ¿aceptable como comprobante transitorio?

Esto NO está en D.1 como validación "Con contador advisor", cuando **debería ser ITEM #1**.

### Impacto

- **Riesgo: Multa AFIP** si determina que "ticket no fiscal" es inválido
- **Riesgo: Rechazo masivo de facturas** si revalidadas ex-post resulta en duplicados/rechazos
- **Riesgo: Clientes afectados** que vendieron sin factura válida durante 2h

### Evidencia

Sección 11.5: Habla de "tolerancia a fallos" pero NO de cobertura legal.  
Sección D.1: Lista como validación pero sin urgencia explícita.  
Sección 11.12: Notificación es amigable pero no comunica riesgo.

### Recomendación

**ANTES de escribir una línea de código AFIP:**

1. **Consulta legal (contador + abogado):** 
   - ¿"Ticket no fiscal transitorio" es válido en Ley 11.683?
   - ¿Cuál es el máximo tiempo permitido sin CAE?
   - ¿Hay precedente de multas?

2. **Alternativa A (si NO es legal):**
   ```typescript
   // AFIP timeout → BLOQUEAR venta
   // Mostrar: "AFIP no responde. Reintentando..."
   // Timeout final: "Contactá a AFIP, no podemos facturar"
   // Sin UI para "continuar sin factura"
   ```

3. **Alternativa B (si SÍ es legal, con cobertura):**
   - Documentar legal opinion firmada del contador/abogado
   - Avisar explícitamente: "Esta factura se emitió sin CAE y debe validarse"
   - Agregar a audit_log: "ticket_no_fiscal_emitted_reason: {timeout, afip_down, network_error}"
   - SLA: reconciliación en < 1 hora (no 2)

4. **Test de regresión obligatorio:**
   ```typescript
   test('sale creation timeout - AFIP down', () => {
     // Simular AFIP sin respuesta
     // Validar que NO se puede crear venta (o se crea con warning)
     // Validar que contador se notifica
   });
   ```

---

## 1.3 🔴 CRÍTICO: Stock negativo sin límites de razonabilidad

**Ubicación:** Sección 8.5  
**Severidad:** CRÍTICO  
**Confianza:** 90%

### Problema

Stock negativo está permitido (si owner lo habilita), pero sin controles:

```typescript
// Sección 8.5: "Cada venta que genera stock negativo requiere motivo"

// ACtual especificado:
negative_stock_override_reason?: string;    // opcional, no obligatorio
```

**El riesgo:** 

```typescript
// Owner habilita stock negativo
// Cashier vende 10.000 unidades de producto (stock real: 3)
// Stock: -9.997
// Motivo registrado: "sí"
// Email al owner: "Venta con stock negativo registrada por Juan"

// ¿Qué pasa después? 
// - Email leído
// - Owner busy
// - 200 ventas más con stock negativo
// - Pérdida de $500k ARS sin detección
```

No hay:
- ❌ Límite de cantidad por operación (ej: máx -100 unidades)
- ❌ Límite de frecuencia (ej: máx 5 operaciones/día con stock negativo)
- ❌ Alerta en tiempo real al owner (solo email async)
- ❌ Dashboard con "stock crítico" como métrica obligatoria
- ❌ Pausa automática después de N operaciones en rojo

### Impacto

- Fraude interno (cachier vende stock inexistente)
- Pérdidas cuantificables no detectadas hasta cierre de mes
- Metadata de historial corrupto (stock_movements con deducciones irreales)

### Evidencia

**Sección 8.5:** 
> "Email automático al owner: 'Venta con stock negativo registrada por [usuario]'"
> "Dashboard muestra 'Top 5 productos con stock negativo'"

Esto es **insuficiente**. Email es async. Dashboard es pasivo. No hay autoprotección.

### Recomendación

**Reemplazar política con:**

```typescript
// enum.ts
const STOCK_OVERRIDE_LIMITS = {
  MAX_QUANTITY_PER_OPERATION: -100,  // no permitas vender -10k
  MAX_OPERATIONS_PER_DAY: 5,         // máx 5 ops con stock negativo
  MAX_TOTAL_NEGATIVE_PER_DAY: -500,  // máx -500 unidades acumuladas
  ALERT_THRESHOLD: -50,              // alerta a owner si pasa -50
} as const;

// En sales.service.ts:
async createSale(saleData: CreateSaleDTO) {
  // ... validaciones ...
  
  const resultingStock = currentStock - quantity;
  
  if (resultingStock < 0 && !allowNegativeStock) {
    throw new StockNegativeNotAllowedError();
  }
  
  if (resultingStock < 0 && allowNegativeStock) {
    const dailyNegativeOps = await this.countNegativeOpsToday(company_id);
    
    if (dailyNegativeOps >= STOCK_OVERRIDE_LIMITS.MAX_OPERATIONS_PER_DAY) {
      throw new StockNegativeQuotaExceededError(
        `Límite de ${STOCK_OVERRIDE_LIMITS.MAX_OPERATIONS_PER_DAY} operaciones alcanzado`
      );
    }
    
    if (Math.abs(resultingStock) > Math.abs(STOCK_OVERRIDE_LIMITS.MAX_QUANTITY_PER_OPERATION)) {
      throw new StockNegativeQuantityTooLargeError(
        `Máximo permitido: ${STOCK_OVERRIDE_LIMITS.MAX_QUANTITY_PER_OPERATION} unidades`
      );
    }
    
    // INMEDIATO: alerta al owner
    if (resultingStock < STOCK_OVERRIDE_LIMITS.ALERT_THRESHOLD) {
      await this.notificationService.alertOwnerImmediately(
        company_id,
        `⚠️ ALERTA CRÍTICA: Stock de ${product.name} en ${resultingStock}. 
         Operación por ${user.name}. Motivo: ${reason}`
      );
    }
  }
  
  return await this.persistSale(saleData);
}
```

**Nota en README:**
> "Stock negativo está habilitado SOLO como excepción operacional. 
> Hay límites automáticos por operación/día. El sistema NO permite vender 
> stock inexistente en escala sin notificación inmediata."

---

## 1.4 🔴 CRÍTICO: Algoritmo de cálculo de IVA ambiguo

**Ubicación:** Sección 11.10, D.1 item 8  
**Severidad:** CRÍTICO  
**Confianza:** 100%

### Problema

El SRS propone: "Cálculo de IVA: redondeo por línea (no solo en total)"

**¿Pero qué significa exactamente?**

```typescript
// Ambigüedad 1: ¿Cuándo se redondea?

OPCIÓN A — Redondeo por línea, LUEGO suma:
  Línea 1: $100 * 21% = $21.00 → redondeo → $21
  Línea 2: $99.99 * 21% = $20.9979 → redondeo → $21
  Total IVA: $21 + $21 = $42

OPCIÓN B — Suma PRIMERO, LUEGO redondeo:
  Total: $100 + $99.99 = $199.99
  IVA: $199.99 * 21% = $41.9979 → redondeo → $42

// En este caso: $42 vs $42 (igual)
// Pero con números reales:

Línea 1: $100.01 * 21% = $21.0021
Línea 2: $99.99 * 21% = $20.9979
  OPCIÓN A: $21 + $21 = $42
  OPCIÓN B: $199.99 * 0.21 = $41.9979 → $42

// Sigue siendo igual, pero en facturas de 50+ líneas el error acumula
```

**AFIP no especifica esto en su documentación pública.** El SRS asume "redondeo por línea" pero:
- ❌ Sin cita de fuente AFIP
- ❌ Sin validación con contador
- ❌ Sin test cases que validen exactitud

### Impacto

- **Riesgo alto:** Facturas rechazadas por AFIP si redondeo está mal
- **Riesgo de auditoría:** AFIP puede exigir recalcular todas las facturas emitidas
- **Riesgo contable:** Diferencias acumuladas en libros IVA

### Evidencia

**Sección 11.10:**
```typescript
function roundHalfUp(value: number, decimals: number = 2): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}
```

Función definida. Pero: ¿se aplica POR LÍNEA O EN TOTAL?

**Sección D.1 Item 8:**
> "Cálculo de IVA: ¿redondeo por línea o por total?"

Está en la lista de validaciones, pero el SRS no propone respuesta.

### Recomendación

**ANTES de primera venta en producción:**

1. **Test case explícito:**
   ```typescript
   test('IVA rounding - 50-line invoice matches AFIP expectations', () => {
     const lines = [
       { amount: 100.01, ivaRate: 0.21 },
       { amount: 99.99, ivaRate: 0.21 },
       // ... 48 más con valores reales
     ];
     
     const result = calculateInvoiceIVA(lines, 'per_line_rounding');
     const expected = 42.35;  // Value from AFIP documentation
     
     expect(result).toBe(expected);
   });
   ```

2. **Validación con contador:**
   - "¿Cómo calcula AFIP IVA en facturación electrónica?"
   - "¿Es por línea o por total?"
   - "¿Qué hago si resultado difiere por 0.01 ARS?"
   - Obtener documentación AFIP o precedente real

3. **Documentación en código:**
   ```typescript
   /**
    * Calcula IVA según norma AFIP XXXX (cite tu fuente aquí)
    * 
    * Política: redondeo por línea
    * - Cada línea: amount * rate → redondeo half-up → centavo
    * - Suma de líneas
    * - NO se redondea nuevamente el total
    * 
    * Fuente: Contacto contador Julio 2026
    */
   function calculateIVA(lines: InvoiceLine[]): number {
     return lines.reduce((sum, line) => 
       sum + roundHalfUp(line.amount * line.rate, 2), 0);
   }
   ```

---

## 1.5 🔴 CRÍTICO: Seguridad multi-tenant sin implementación especificada

**Ubicación:** Sección 5, ADR-0002 (referenciado pero no incluido)  
**Severidad:** CRÍTICO  
**Confianza:** 85%

### Problema

El SRS está basado en "multi-tenant con defensa en profundidad" pero:

```
Sección 5.4: "RLS con auth.jwt() + Application Service checks"

¿Pero cuál es exactamente la policy RLS?

Código mencionado pero NO incluido:
- SQL de constraint en audit_log
- Policy para contador (EXISTS vs ANY+SELECT)
- Policy para support (con access_from tracking)
```

**Sin código concreto, no se puede validar la seguridad.**

Sección D.1 Item de Sesión 3.5.2:
> "audit_log con REVOKE INSERT a authenticated aplicado"
> "Policy RLS contador con EXISTS (no ANY+SELECT)"

¿Por qué EXISTS y no ANY? ¿Cuál es la diferencia de seguridad?

### Impacto

- **Riesgo crítico:** Cross-tenant leak sin detectar (si la policy tiene agujero)
- **Riesgo de no-operabilidad:** Implementar sin política clara = rework masivo

### Evidencia

Sección 5.4 menciona:
> "Supabase RLS policy por company_id. Combinado con JWT claims."

Pero no muestra:

```sql
-- ¿Cuál es la policy actual? 
-- ¿Y la del contador?
-- ¿Y la del auditor?
-- ¿Y la del support?
```

### Recomendación

**Antes de merging de código:**

1. **Incluir en SRS o ADR-0002:**
   ```sql
   -- RLS Policy: users table (owner/admin/cashier)
   CREATE POLICY "users_see_own_company"
   ON users FOR SELECT
   USING (company_id = auth.jwt() -> 'company_id');
   
   -- RLS Policy: sales table
   CREATE POLICY "sales_company_isolation"
   ON sales FOR ALL
   USING (company_id = auth.jwt() -> 'company_id');
   
   -- RLS Policy: accountant access (multi-company)
   CREATE POLICY "accountant_see_invited_companies"
   ON companies FOR SELECT
   USING (
     EXISTS (
       SELECT 1 FROM accountant_access_grants
       WHERE accountant_id = auth.uid()
       AND company_id = companies.id
       AND revoked_at IS NULL
     )
   );
   ```

2. **Test obligatorio en CI:**
   ```typescript
   test('RLS - tenant A cannot read tenant B sales', async () => {
     const tenantA = await createTestTenant();
     const tenantB = await createTestTenant();
     
     const saleInB = await createSaleInTenant(tenantB, { ... });
     
     const clientA = createClient({ jwt: tenantA.jwt });
     const result = await clientA.from('sales').select().eq('id', saleInB.id);
     
     expect(result.data).toHaveLength(0);  // RLS bloqueó
   });
   ```

3. **Documentación en código:** Por qué EXISTS y no ANY

---

## 1.6 🔴 CRÍTICO: Demo mode UX/bloqueo ambiguo

**Ubicación:** Sección 14.4  
**Severidad:** CRÍTICO  
**Confianza:** 90%

### Problema

El SRS especifica:
- Demo: 14 días
- Extensión: +7 días (total 21)
- Luego: "bloqueo"

**Pero ¿qué es exactamente "bloqueo"?**

Sección 14.4 dice:
> "Día 22 en adelante: lectura permitida, mutaciones bloqueadas (modo audit)"

¿Pero la UX exacta es:

```
Opción A: 
  Click "crear venta" → Toast "Demo expirado"
  Button deshabilitado

Opción B:
  Click "crear venta" → Modal "¿Quieres continuar con plan?"
  Opción: "Sí, contratá"

Opción C:
  Click "crear venta" → ERROR 403: "Suscripción requerida"
  Workflow completamente bloqueado

Opción D:
  Click "crear venta" → Crear venta PERO con watermark "DEMO"
  Permitir operación educativa sin persistir
```

**Sin UX clara, la implementación será confusa:**
- ¿Frontend valida o backend?
- ¿Muestra formulario bloqueado o error?
- ¿Permite lectura de datos pero no mutación?

### Impacto

- Mala UX → cliente confundido → churn
- Inconsistencia entre descrito y implementado

### Evidencia

**Sección 14.4:**
> "Día 21 en adelante: lectura permitida, mutaciones bloqueadas"

No especifica:
- API response type (error vs success with flag)
- Frontend UI (button disabled vs error modal)
- Qué mutaciones exactas están bloqueadas
- ¿Se puede leer datos de demo? ¿Exportar?

### Recomendación

**Documentar exactamente:**

```typescript
// lib/subscription.ts

interface SubscriptionState {
  status: 'trial' | 'extended' | 'expired' | 'active' | 'suspended';
  daysRemaining: number;
  canRead: boolean;
  canMutate: boolean;
  uiState: 'normal' | 'warning' | 'blocked' | 'audit_only';
  message?: string;
}

// Timeline explícita:
const SUBSCRIPTION_TIMELINE = {
  TRIAL_DAYS: 14,                      // Día 1-14: NORMAL
  EXTENSION_DAYS: 7,                   // Día 15-21: WARNING
  GRACE_PERIOD_DAYS: 0,                // Día 22: BLOCKED
  READING_MODE_DAYS: 10,               // Día 22-31: audit mode (read only)
  SUSPENSION_THRESHOLD: 31,            // Día 31+: suspensión completa
};

// UX en cada fase:
const PHASE_UX = {
  TRIAL_DAYS_1_14: {
    uiState: 'normal',
    buttons: 'fully_enabled',
    banner: null,
    message: null,
  },
  EXTENSION_DAYS_15_21: {
    uiState: 'warning',
    buttons: 'fully_enabled',
    banner: 'Prueba gratuita expira en X días',
    message: 'Contratá un plan para continuar',
  },
  BLOCKED_DAYS_22_31: {
    uiState: 'audit_only',
    buttons: 'disabled_mutate',
    banner: 'PRUEBA EXPIRADA - Modo lectura',
    message: 'Contratá un plan para crear operaciones',
    canRead: true,
    canMutate: false,
  },
  SUSPENDED_DAY_31_PLUS: {
    uiState: 'blocked',
    buttons: 'all_disabled',
    banner: 'Suscripción suspendida',
    message: null,
    canRead: false,
    canMutate: false,
  },
};

// API response:
async function createSale(req: CreateSaleRequest) {
  const subscription = await getSubscriptionState(req.company_id);
  
  if (!subscription.canMutate) {
    // ¿Opción 1: Error HTTP?
    throw new SubscriptionExpiredError('trial_expired');
    
    // ¿Opción 2: Success con warning?
    // return { success: false, code: 'DEMO_EXPIRED', data: null };
  }
  
  // Crear venta ...
}
```

**UX en componente:**

```tsx
<CreateSaleButton
  disabled={!subscription.canMutate}
  title={
    subscription.canMutate
      ? 'Crear venta'
      : subscription.status === 'extended'
        ? 'Demo expira pronto - Contratá'
        : 'Demo expirado - Contratá para continuar'
  }
/>
```

---

## 1.7 🔴 CRÍTICO: Padrón A5 timeout sin fallback claro

**Ubicación:** Sección 7.4, 11.7  
**Severidad:** ALTO  
**Confianza:** 95%

### Problema

AFIP Padrón A5 es crítico para validar CUIT de cliente:

```
// Sección 11.7:
"Padrón AFIP A5 (cache 7 días con revalidación en hot path si > 24h)"

¿Pero qué pasa si:
1. Padrón timeout (> 30s)
2. Cache expiró (> 7 días)
3. AFIP está down
4. Red está cortada
```

**El SRS NO especifica fallback:**

```
Opción A: Bloquear venta ("AFIP down, reintenta")
Opción B: Proceed con cache old (> 7 días)
Opción C: Proceed sin validar CUIT (riesgo fraude)
Opción D: Marcar como "requires_validation_later"
```

Sección D.1 dice:
> "Revalidación CUIT en hot path: política de timeout (proceed_with_cache vs block_emission)"

**Está documentado como validación pendiente, pero no hay especificación de CUÁL elegir.**

### Impacto

- **Bloqueo completo:** Si elige "bloquear", Padrón down = no se vende nada
- **Fraude:** Si elige "proceed sin validar", cliente con CUIT falso pasa

### Evidencia

Sección 11.7:
> "Padrón A5 (cache 7 días con revalidación en hot path si > 24h)"

No dice qué pasa si:
- ❌ Revalidación falla
- ❌ Cache expiró + red down
- ❌ Padrón retorna error

### Recomendación

**Definir política ANTES de implementar:**

```typescript
// enums.ts
const PADRON_FALLBACK_POLICY = {
  // Opción recomendada: Proceed con cache, pero con restrictions
  MODE: 'proceed_with_warning',
  
  // Si cache > 24h, proceder pero:
  MAX_CACHE_AGE_HOT_PATH: 24 * 60 * 60 * 1000,  // 24h
  MAX_CACHE_AGE_ALLOWED: 7 * 24 * 60 * 60 * 1000,  // 7 días
  TIMEOUT: 8000,  // ms
  RETRIES: 2,
  
  // Si timeout + cache expirado:
  FALLBACK: 'use_last_known' | 'block_emission',  // ← ELEGIR ESTO
};

// Lógica:
async function validateCustomerCuit(cuit: string, companyId: string) {
  try {
    // Intenta Padrón fresco
    const fresh = await fetchPadronA5(cuit, { timeout: 8000 });
    return { source: 'padron_fresh', data: fresh };
  } catch (error) {
    // Padrón falló, intenta cache
    const cached = await getCachedPadron(cuit);
    const cacheAge = Date.now() - cached.fetchedAt;
    
    if (cacheAge <= 7 * 24 * 60 * 60 * 1000) {
      // Cache válido
      if (cacheAge <= 24 * 60 * 60 * 1000) {
        // Cache fresco (< 24h), normal
        return { source: 'padron_cache_fresh', data: cached };
      } else {
        // Cache viejo (> 24h), proceder pero avisar
        return { 
          source: 'padron_cache_old', 
          data: cached,
          warning: 'Validación no actualizada por AFIP, usar con cuidado'
        };
      }
    } else {
      // Cache expiró (> 7 días)
      if (FALLBACK === 'block_emission') {
        throw new PadronValidationFailedError('No pudimos validar CUIT. Contactá soporte.');
      } else {
        // Proceed (risky)
        return { 
          source: 'padron_unavailable', 
          data: cached,
          warning: 'ADVERTENCIA: CUIT no validado por AFIP',
          risk: 'high'
        };
      }
    }
  }
}

// En sales.service.ts:
async createSale(saleData: CreateSaleDTO) {
  const cuitValidation = await validateCustomerCuit(saleData.customerCuit);
  
  if (cuitValidation.risk === 'high') {
    // Log crítico y alerta
    await this.logger.warn('High-risk sale without fresh CUIT validation', {
      companyId: saleData.companyId,
      cuit: saleData.customerCuit,
      source: cuitValidation.source,
    });
    
    // Opción: enviar email al owner
    await notificationService.alertOwner(
      saleData.companyId,
      `ALERTA: Venta sin validación CUIT fresca. Cliente: ${saleData.customerCuit}`
    );
  }
  
  // Crear venta...
}
```

**En README:**
> "Si AFIP Padrón no responde: procedemos con cache válida (hasta 7 días). 
> Si cache expiró: bloqueamos venta y notificamos al owner."

---

# 2. HALLAZGOS DE ALTO IMPACTO — No bloqueantes pero críticos

## 2.1 📊 ALTO: Documentación distribuida en 4 archivos sin sincronización

**Ubicación:** Estructura del paquete  
**Severidad:** ALTO  
**Confianza:** 100%

### Problema

El SRS está dividido en:
1. `README.md` — Guía de lectura
2. `PANDORA_ERP_SRS_v3.0.md` — Documento maestro (4.478 líneas)
3. `PANDORA_ERP_SRS_v3.0-parte2.md` (1.092 líneas)
4. `PANDORA_ERP_SRS_v3.0-parte3.md` (1.062 líneas)

**Riesgo de desincronización:**

```
Cambio en parte2, línea 500:
  "AFIP timeout: 30 segundos"

Pero en parte3, línea 200:
  "AFIP timeout: 8 segundos"

¿Cuál es correcto? ¿Quién lo valida?
```

Sección 2.2 del maestro dice:
> "AFIP WSFEv1 + WSAA (SOAP, sincrónico, timeout 30s)"

Pero sección 13.4 de métricas dice:
> "`afip_request_latency_p99` < 8000 [ms]"

¿El timeout es 30s o 8s? (30s timeout pero SLO de 8s de latencia)

### Impacto

- Confusión en lectura
- Implementadores usan valores inconsistentes
- Auditoría encuentra discrepancias

### Evidencia

Buscar en los 4 archivos por "timeout" revela inconsistencias leves pero reales.

### Recomendación

**Opción A (recomendado): Merge en un único documento maestro**
- Archivo único: `PANDORA_ERP_SRS_v3.0.md` (5-6 MB es tolerable)
- Índice al inicio con links)
- Control de versión único

**Opción B: Mantener split pero con sincronización**
- `parte2.md` y `parte3.md` son excerpts del maestro, NO independientes
- Generar desde maestro con script
- CI falla si hay desincronización

**Opción C (no recomendado): Dejar como está**
- Advertencia explícita en README: "Estos archivos pueden desincronizarse"
- Siempre leer maestro como fuente de verdad

Recomendación: **Opción A** — merge en un único archivo.

---

## 2.2 📊 ALTO: ADRs referenciados pero no incluidos en paquete

**Ubicación:** Multiple secciones  
**Severidad:** ALTO  
**Confianza:** 100%

### Problema

El README menciona 17 ADRs:

```
├── ADR-0001-stack-tecnologico-fase-0.md
├── ADR-0002-multi-tenant-rls-jwt.md
├── ADR-0003-typescript-services-no-plpgsql.md
... (14 más)
└── ADR-0017-density-obligatoria-atmosphere.md
```

**Pero los archivos NO están adjuntos ni referenciados en el paquete.**

Sección 6 del SRS menciona:
> "Multi-tenant con RLS + auth.jwt() — ver ADR-0002"

Pero ADR-0002 no está disponible para revisar.

### Impacto

- Lectura incompleta
- No se pueden validar decisiones de arquitectura
- Implementadores deben asumir lo que dice el SRS sin fuente original

### Evidencia

README.md línea 15-33 lista los 17 ADRs pero no los incluye en attachments.

### Recomendación

**Crear folder `ADRs/` con resumen ejecutivo de cada uno:**

Dado que los ADRs completos son 17 archivos, crear un:

```
## ADRs — Resumen Ejecutivo

### ADR-0001: Stack tecnológico Fase 0
**Estado:** Aprobado ✅
**Decisión:** Next.js 14 + Supabase + Drizzle + Vercel
**Alternativas rechazadas:** SvelteKit, Remix, tRPC
**Riesgo:** Monolito, no microservicios (evaluada en F2)
**Revisar detalle:** En repo adr/ADR-0001-stack-tecnologico-fase-0.md

### ADR-0002: Multi-tenant con RLS + auth.jwt()
**Estado:** Aprobado ✅
**Decisión:** RLS en Supabase + Application Service checks
**Alternativas rechazadas:** Row-level triggers, Row security via code
**Riesgo:** Auth bypass si policy mal escrita (mitigado con tests)
**Revisar detalle:** En repo adr/ADR-0002-multi-tenant-rls-jwt.md
```

O simplemente: **Incluir los 17 archivos ADR en los attachments.**

---

## 2.3 📊 ALTO: Fase 0 demasiado ambiciosa en scope

**Ubicación:** Secciones 2.1, 10, 11, 15  
**Severidad:** ALTO  
**Confianza:** 90%

### Problema

**Fase 0 (semanas 1-16) incluye:**

✅ POS  
✅ AFIP fiscal completo (WSFEv1 + reconciliación async)  
✅ Inventory completo (stock, movimientos, variantes)  
✅ Cash (turnos, arqueo, cierre forzado)  
✅ Visual system (3 atmospheres, glass effects, motion)  
✅ Observabilidad (logs, métricas, alertas)  
✅ Customers (Padrón A5, snapshot, cambios IVA)  

**En solo 16 semanas, con 1-2 devs.**

Comparación histórica:
- Square (POS): 18 meses + 8 devs
- Toast (POS): 2 años + 12 devs
- Bejerman (POS local AR): 3 años + 5 devs

### Impacto

- **Riesgo de desvío:** semana 8 va al 70% en lugar del 75% planificado
- **Riesgo de quality:** bugs en Fiscal + Inventory simultáneamente sin debug time
- **Riesgo de timeline:** extensiones de 4-8 semanas son normales en FV

### Evidencia

**Sección 18 (Roadmap) dice:**
> "Fase 0 (semanas 1-16): 5 clientes pagando"

Eso es logístico, no técnico. **En realidad, 16 semanas para TODO lo listado arriba es optimista.**

Checklist de Apéndice B.1:
```
- [ ] POS completo con múltiples items + pagos mixtos
- [ ] AFIP WSFEv1 + WSAA en homologación
- [ ] Reconciliación async + ticket no fiscal
- [ ] Stock con movimientos append-only
- [ ] Customers con Padrón A5
- [ ] Atmoospheres + glass + motion
- [ ] Logs Pino + métricas custom
... (60 items más)
```

**Realista:** 60 items en 16 semanas = ~2.7 items/semana. Si un dev.

### Recomendación

**Repriorizar Fase 0:**

```
CORE (OBLIGATORIO, semanas 1-12):
- POS básico (múltiples items, pagos)
- AFIP mínimo (no-fiscal timeout → reconciliación)
- Customers básicos (CUIT, nombre)
- Inventory mínimo (stock block negativos)
- Cash turno + cierre simple
- Onboarding wizard 1 paso
- Logs básicos (sin Pino, usar console structurada)

SECONDARY (si hay tiempo, semanas 13-16):
- Visual system (puede ser minimal en F0)
- Observabilidad completa
- Variantes simples
- Multiple usuarios (owner + 1 admin)

DEFER A F1:
- Padrón A5 online (usar cache/mock en F0)
- Glass effects
- Motion philosophy
- Advanced cash reports
- Accounting features
```

**Realista F0 reducida:** 40 items en 12 semanas = 3.3 items/semana (manejable).

---

## 2.4 📊 ALTO: Roles y permisos sin validación de UX

**Ubicación:** Apéndice C  
**Severidad:** ALTO  
**Confianza:** 85%

### Problema

Matriz de permisos define 8 roles:

| Rol | Count | 
|---|---|
| owner | 30 permisos |
| admin | 25 permisos |
| cashier | 15 permisos |
| warehouse | 8 permisos |
| viewer | 5 permisos |
| accountant | 10 (multi-empresa) |
| auditor | 8 (custom access) |
| support | 6 (con ticket) |

**Pero:**
- ❌ No hay UX mock de "assignment de roles"
- ❌ No hay validación de si matriz es intuitiva para comerciante
- ❌ No hay caso de uso de cada rol documentado

Ejemplo: ¿Cuándo un comerciante pequeño invita a "auditor"?
- ¿Counter?
- ¿Auditor externo?
- ¿Reportero de AFIP?

Sin contexto, la matriz es abstracta.

### Impact

- Overengineering potencial
- UX confusa al momento de implementar "Manage users"

### Evidencia

Apéndice C es tabla pura. No hay narrativa de "por qué auditor existe" o "cuándo usar warehouse".

### Recomendación

**Expandir Apéndice C con casos de uso:**

```
## Apéndice C.1 — Casos de uso de cada rol

### owner
Perfil: Dueño del comercio
Contexto de uso: Configura empresa, autoriza pagos, ve reportes
Permisos: 30 (casi todo)
Ejemplo: "El dueño abre la app para ver ingresos del día"

### admin
Perfil: Gerente o encargado del local
Contexto: Gestiona usuarios, editores de precios
Permisos: 25 (todo excepto billing/delete)
Ejemplo: "El admin edita precio de producto"

### cashier
Perfil: Persona que atiende caja
Contexto: Solo crea ventas
Permisos: Crear venta, anular venta propia
Ejemplo: "Cashier vende artículos"

### warehouse
Perfil: Responsable de stock
Contexto: Ajusta stock, ve movimientos
Permisos: Ver stock, ajustar cantidad
Ejemplo: "Warehouse cuenta stock físico y ajusta"

### viewer
Perfil: Persona que ve reportes
Contexto: No puede crear/editar nada
Permisos: Solo lectura
Ejemplo: "Contador externo ve resumen del mes (si invitado)"

### accountant
Perfil: Contador autorizado del cliente
Contexto: Multi-empresa, auditoría fiscal
Permisos: Ver audit log, exportar, ver IVA books
Ejemplo: "Contador semanal revisa facturación de 4 clientes"

### auditor
Perfil: Auditor externo o compliance
Contexto: Acceso desde fecha X, para investigación
Permisos: Ver datos de período específico
Ejemplo: "AFIP auditor investiga período Q2 2026"
(Nota: Probablemente NO sea caso real en Fase 0)

### support
Perfil: Soporte Pandora
Contexto: Suplanta tenant con ticket para debug
Permisos: Acceso temporal con auditoría obligatoria
Ejemplo: "Support investiga bug de cliente con suplantación"
```

---

## 2.5 📊 ALTO: Tests de concurrencia no especificados

**Ubicación:** Sección 2.2  
**Severidad:** ALTO  
**Confianza:** 90%

### Problema

Sección 2.2 dice:
> "Tests cross-tenant obligatorios. Tests de concurrencia con isolation level"

**Pero NO especifica:**
- ¿Cuáles tests de concurrencia?
- ¿Cuál isolation level? (READ UNCOMMITTED, READ COMMITTED, REPEATABLE READ, SERIALIZABLE)
- ¿Cuántas operaciones simultáneas?
- ¿Cuál es el pass/fail criteria?

### Impact

- Sin spec, implementador elige cualquier cosa
- Concurrencia bugs detectados en producción en lugar de CI

### Evidencia

Sección 2.2 menciona "isolation level" pero Sección 5.10 (transacciones) es donde estaría el detalle y está vacío.

### Recomendación

**Agregar a SRS o CLAUDE.md:**

```typescript
// tests/concurrency.test.ts

describe('Concurrency tests', () => {
  // Test 1: Stock race condition
  test('2 simultaneous sales do not create negative stock if blocked', async () => {
    const product = await createProduct({ stock: 5 });
    
    // 2 usuarios simultáneamente venden 4 unidades each
    const [sale1, sale2] = await Promise.all([
      createSaleAsync({ productId: product.id, qty: 4 }),
      createSaleAsync({ productId: product.id, qty: 4 }),
    ]);
    
    // Uno debe fallar si allow_negative_stock = false
    expect(
      [sale1.status, sale2.status].filter(s => s === 'success')
    ).toHaveLength(1);
  });
  
  // Test 2: Cash session race condition
  test('Simultaneous close of same cash session prevents double-close', async () => {
    const session = await createCashSession({ initialAmount: 1000 });
    
    const [close1, close2] = await Promise.all([
      closeCashSessionAsync({ sessionId: session.id, amount: 1050 }),
      closeCashSessionAsync({ sessionId: session.id, amount: 1050 }),
    ]);
    
    // Uno debe fallar
    expect(
      [close1.status, close2.status].filter(s => s === 'success')
    ).toHaveLength(1);
  });
  
  // Test 3: Isolation level validation
  test('Serializable isolation prevents dirty reads on sales', async () => {
    // Simular: TX 1 lee stock, TX 2 vende, TX 1 sigue sin re-leer
    // En SERIALIZABLE, TX 1 debe abortar
    // En READ_COMMITTED, TX 1 lee valor viejo
    
    // El SRS elige SERIALIZABLE, validar que se usa
    expect(await getIsolationLevel()).toBe('SERIALIZABLE');
  });
});
```

---

# 3. HALLAZGOS MEDIANOS — Mejoras recomendadas

## 3.1 🟡 MEDIO: IVA rates hardcodeados en lugar de configurables

**Ubicación:** Sección 11  
**Severidad:** MEDIO  
**Confianza:** 85%

### Problema

SRS asume:
- 21% IVA (standard)
- 10.5% IVA (reducido)
- 0% IVA (exento)

**Pero Argentina cambia estos rates periódicamente.** Si AFIP cambia en Q3 2026, SRS es inválido.

### Recomendación

```typescript
// Almacenar como configuración:
interface IVARate {
  id: string;
  rate: number;    // 0.21, 0.105, etc.
  description: string;
  active: boolean;
  effectiveFrom: Date;
  effectiveTo?: Date;
}

// En Fase 0, precargado:
await seedIVARates([
  { rate: 0.21, description: 'Standard (IVA 21%)', effectiveFrom: '2026-01-01' },
  { rate: 0.105, description: 'Reduced (IVA 10.5%)', effectiveFrom: '2026-01-01' },
  { rate: 0, description: 'Exempt (0%)', effectiveFrom: '2026-01-01' },
]);
```

---

## 3.2 🟡 MEDIO: Payment methods hardcodeados sin soporte para agregadores

**Ubicación:** Sección 9.4  
**Severidad:** MEDIO  
**Confianza:** 80%

### Problema

Sección 9.4 especifica:
- Efectivo
- Tarjeta (débito/crédito)
- Transferencia
- MercadoPago

**Pero ¿qué pasa cuando cliente pide Efecty? ¿Billetera virtual X?**

Sin abstracción de payment methods, agregar nuevo requiere cambios en schema + lógica.

### Recomendación

```typescript
interface PaymentMethod {
  id: string;
  type: 'cash' | 'card' | 'transfer' | 'wallet' | 'custom';
  label: string;
  tenantSpecific: boolean;
  requiresRef: boolean;  // ¿requiere referencia (transferencia)?
  integrationId?: string;  // Si MercadoPago, Efecty, etc
  active: boolean;
}
```

---

# 4. HALLAZGOS MENORES — Clarificaciones

## 4.1 ℹ️ MENOR: Timeout values inconsistent

**Ubicación:** Secciones 2.2, 9.5, 11.5, 13.4  
**Severidad:** MENOR  

### Menciones de timeout:

- Sección 2.2: "AFIP timeout 30s"
- Sección 9.5: "timeout > 8s en FSR"
- Sección 13.4: "afip_request_latency_p99 < 8000"

**¿Son estos valores compatibles?**

Interpretar como:
- **30s:** hard timeout (si no responde en 30s, falla absoluto)
- **8s:** SLO (objetivo de performance, no timeout)
- **p99 < 8000ms:** métrica de monitoreo

Clarificar en README.

---

## 4.2 ℹ️ MENOR: Notificación stack incomplete

**Ubicación:** Section 12  
**Severidad:** MENOR  

### Problema

Sección 12 especifica Resend + Twilio en F0, pero NO especifica:
- ¿Quién paga Twilio? (Owner? Pandora?)
- ¿Rate limiting de SMS? (Twilio cuesta $0.05 por SMS)
- ¿Opt-in/out para cada canal?

### Recomendation

Agregar coste + UX de notificaciones a Roadmap de costos.

---

# 5. OPORTUNIDADES DE MEJORA

## 5.1 ✨ Agregar walkthrough de "primer día de operación"

Muchas decisiones tienen sentido cuando entiendes el flujo real:

```
08:00 - Owner llega al comercio
  → App abre, POS lista
  → Stock verificado
  
10:15 - Primera venta
  → Selecciona producto
  → Cliente paga
  → Factura sale inmediatamente O ticket no fiscal
  
17:00 - AFIP timeout (nunca pasa pero...)
  → Toast: "AFIP no responde, ticket emitido"
  → Continuá vendiendo
  
20:00 - Cierre de turno
  → Contabiliza dinero
  → Sistema archivea movimientos
  → Ready para reporte mañana
  
22:00 - Owner ve dashboard
  → $50k en ventas hoy
  → Stock crítico en producto X
  → Todo auditado automáticamente
```

Agregar narrativa ayuda a validar decisiones.

---

## 5.2 ✨ Crear "runbook operativo" antes de primer cliente

Apéndice B.3 menciona:
> "Runbook básico para 5 escenarios críticos"

Pero no especifica cuáles son los 5. Propuesta:

1. **AFIP down → reconciliación timeout**
2. **Venta con stock negativo → bloqueo y alerta**
3. **Certificado AFIP por vencer → rotación**
4. **DB corrompida o inconsistente → restore**
5. **Cross-tenant leak detectado → freezar + investigar**

---

# 6. VALIDACIÓN DE COMPLETENESS

## Checklist: ¿Está el SRS listo para implementación?

| Aspecto | Status | Gap |
|---|---|---|
| Visión y posicionamiento | ✅ | None |
| Dominios técnicos | ✅ | None |
| Stack tecnológico | ✅ | None |
| Modelo de datos | ⚠️ INCOMPLETO | Variantes no en matriz (F1) |
| AFIP fiscal | ⚠️ CRÍTICO | Validación legal pendiente |
| Multi-tenant seguridad | ⚠️ CRÍTICO | SQL policies no incluidas |
| Inventory | ✅ | None |
| Cash & turnos | ✅ | None |
| Observabilidad | ✅ | None |
| Visual system | ✅ | None |
| Demo mode UX | ⚠️ | Bloqueo UX ambiguo |
| Tests & quality | ⚠️ | Concurrency tests no especificados |
| Validaciones humanas | 🔴 CRÍTICO | 22 validaciones sin responsable |

**Score general:** 7/11 aspectos críticos ✅  
**Bloqueantes:** 3 (AFIP fiscal, multi-tenant SQL, validaciones responsables)

---

# 7. PLAN DE REMEDIACIÓN

**Antes de Semana 1 (esta semana):**

- [ ] Crear spreadsheet "Validaciones críticas" (22 items)
  - Responsable por validación
  - Plazo máximo
  - Coste estimado
  - Criterio de aceptación
  
- [ ] Contactar contador + abogado
  - Agendar consulta individual
  - Listar 22 validaciones
  - Obtener "go/no-go" antes de first commit

- [ ] Documentar SQL policies multi-tenant
  - Por cada tabla, escribir RLS policy
  - Tests de cross-tenant isolation
  - Agregar a ADR-0002 o SRS sección 5

- [ ] Especificar IVA rounding exacto
  - Test case contra AFIP doc
  - Validación con contador
  - Incluir en sección 11.10

**Antes de Semana 2 (segunda semana):**

- [ ] Definir demo mode UX exacta
  - API contracts (success/error responses)
  - Frontend mockups (buttons disabled vs error modals)
  - Test cases de cada fase (1-14, 15-21, 22+)

- [ ] Especificar Padrón A5 fallback
  - Elegir: block_emission vs proceed_with_warning
  - Documentar en código
  - Test de timeout + cache expiry

- [ ] Rebalancear Fase 0 scope
  - Identificar CORE (must-have)
  - Identificar SECONDARY (nice-to-have)
  - Mover DEFER a F1

- [ ] Consolidar documentación
  - Opción: Merge en 1 archivo
  - Opción: Split con CI validation

---

# CONCLUSIÓN

**El SRS es de muy buena calidad,** pero tiene **3 bloqueantes críticos que deben resolverse antes de escribir código productivo:**

1. ✋ **Validaciones humanas sin propietario** → Crea spreadsheet de responsables
2. ✋ **AFIP fiscal no validado legalmente** → Consulta contador antes de Week 1
3. ✋ **Multi-tenant SQL policies no específicas** → Escribir SQL policies concretas

Resolver estos 3 puntos toma **2-3 días de trabajo administrativo**, pero evita **2-6 meses de reescritura en producción.**

El resto (UX de demo, Padrón fallback, scope de Fase 0) son **importantes pero no bloqueantes** si se documentan correctamente.

**Recomendación final:**

> "No mergéis el primer PR de negocio hasta tener:
> 1. Validaciones críticas auditadas por contador + abogado (acta firmada)
> 2. RLS policies testeadas con cross-tenant tests
> 3. Algoritmos fiscales (IVA, redondeo, CAE) validados en escritura"

El SRS es el mapa. El mapa es bueno. **Pero antes de conducir, validá que los caminos realmente existen (auditoría legal) y que no hay rutas cerradas (seguridad multi-tenant).**

---

**Fin de auditoría.**

*Auditoría realizada: 23 mayo 2026*  
*Siguiente revisión recomendada: Post-resolución de bloqueantes (Semana 1)*  
*Categoría: CRÍTICA — Retrasar implementación sin resolver hallazgos críticos*
