# ADR-0022 — Fiscal Projection Layer + Fiscal Snapshot

**Fecha:** 2026-05-26
**Estado:** Aprobado
**Relacionado con:** ADR-0004 (AFIP sincrónico), ADR-0005 (money), ADR-0006 (numeración fiscal), ADR-0010 (idempotency), ADR-0021 (money client)

## Contexto

La investigación de fuentes oficiales AFIP (2026-05-26) confirmó **dos hechos arquitectónicos que no estaban explicitados** en los ADRs anteriores:

### Hecho 1 — WSFEv1 trabaja sobre AGREGADOS, no detalle de ítems

**Fuente oficial AFIP:**
- **WSFEv1** → factura electrónica **sin detalle de ítem**
- **WSMTXCA** → factura electrónica **con detalle de ítems**
- **WSFEX** → factura electrónica exportación

Implicación: el shape del payload WSFEv1 acepta `Iva[]` agrupado por alícuota, no por línea individual. **El ERP puede (y debe) trabajar línea por línea internamente, pero el payload final es agregado.**

Sin este reconocimiento explícito, en el momento de codear el módulo fiscal aparecen 3 patrones discutibles:
- (a) Construir el payload directamente desde modelos internos sin transformación → frágil, mezcla concerns
- (b) Tener un "translator" ad-hoc en cada lugar que llama AFIP → duplicación y drift
- (c) **Tener una capa de proyección explícita** (este ADR)

### Hecho 2 — Las reglas fiscales cambian y las facturas deben ser reproducibles

Reglas fiscales que **cambian con frecuencia mayor a la del código**:
- Alícuotas IVA (aunque 21%/10.5%/27% son estables, han cambiado)
- Tasas IIBB por jurisdicción y actividad
- RG AFIP que afectan validaciones del WS (timestamps, campos obligatorios, etc.)
- Régimen del comerciante (RI → Monotributo)
- Versiones del propio WSFEv1

Si una factura emitida en mayo 2026 con regla X se "recalcula" en julio 2028 con regla Y, **el resultado puede ser distinto**. Eso es problema legal (la factura emitida es la verdad, no su recálculo posterior) y operativo (auditoría no puede reproducir histórico).

## Decisión

**Implementar dos capas conceptuales en el motor fiscal F0:**

### Capa 1 — Internal Computation (lo que el ERP calcula y muestra)

Modelo rico por línea con full precision. Es lo que el cajero ve, lo que se persiste en `sales` + `sale_items`, lo que se usa en reportes internos.

```typescript
interface SaleItem {
  product_id: string;
  quantity: Decimal;
  unit_price_net: Decimal;       // string en DB, Decimal en cómputo
  tax_rate: Decimal;              // 21.00, 10.50, 0.00, etc.
  tax_amount_per_line: Decimal;   // calculado per-line, redondeado HALF_EVEN
  total_per_line: Decimal;        // net + tax_amount
}

interface Sale {
  items: SaleItem[];
  subtotal: Decimal;
  tax_total: Decimal;             // sum(items[].tax_amount_per_line)
  total: Decimal;
  // ...
}
```

### Capa 2 — Fiscal Projection (lo que se envía a AFIP)

Función pura que **transforma** el modelo interno en payload WSFEv1 válido. **Vive en un solo módulo, es la única autoridad sobre el shape final.**

```typescript
// src/lib/fiscal/projection/wsfev1.ts
'use server';
import 'server-only';

export interface WSFEv1Projection {
  CbteTipo: number;
  PtoVta: number;
  Concepto: number;
  DocTipo: number;
  DocNro: string;
  CbteFch: string;
  ImpTotal: string;       // numeric formato AFIP
  ImpNeto: string;
  ImpIVA: string;
  ImpTotConc: string;
  ImpOpEx: string;
  ImpTrib: string;
  MonId: 'PES';
  MonCotiz: string;
  Iva: Array<{ Id: number; BaseImp: string; Importe: string }>;
  // ...resto de campos WSFEv1
}

/**
 * Proyección INTERNO → WSFEv1.
 * Es la única función que conoce el shape WSFEv1. El resto del sistema NO debe importar
 * tipos de AFIP fuera de este módulo.
 */
export function projectToWSFEv1(sale: Sale, snapshot: FiscalSnapshot): WSFEv1Projection {
  // 1. Agrupar items por alícuota
  const ivaByRate = groupItemsByTaxRate(sale.items);
  
  // 2. Para cada grupo: BaseImp = sum(line.net), Importe = sum(line.tax_amount_per_line)
  //    Esto satisface la invariante AFIP: ImpIVA total == sum(Iva[].Importe)
  const ivaArray = Array.from(ivaByRate.entries()).map(([rate, items]) => ({
    Id: ratecodeToAfipId(rate),
    BaseImp: sumDecimal(items.map(i => i.subtotal_per_line)).toFixed(2),
    Importe: sumDecimal(items.map(i => i.tax_amount_per_line)).toFixed(2),
  }));
  
  // 3. Construir payload con redondeo HALF_EVEN (ADR-0005 Dimensión 1 cerrada)
  return {
    // ...
    ImpIVA: sumDecimal(ivaArray.map(i => new Decimal(i.Importe))).toFixed(2),
    Iva: ivaArray,
    // ...
  };
}
```

**Invariante verificada por el proyector:**

```typescript
function assertWSFEv1Invariants(payload: WSFEv1Projection) {
  // AFIP exige tolerancia 0
  const ivaTotalFromArray = sumDecimal(payload.Iva.map(i => new Decimal(i.Importe)));
  const ivaTotalFromHeader = new Decimal(payload.ImpIVA);
  if (!ivaTotalFromArray.equals(ivaTotalFromHeader)) {
    throw new FiscalProjectionError(
      `ImpIVA inconsistency: header=${payload.ImpIVA}, sum=${ivaTotalFromArray}`
    );
  }
  // ImpTotal == ImpNeto + ImpIVA + ImpTotConc + ImpOpEx + ImpTrib
  // ...etc
}
```

### Extensibilidad F1+

Cuando aparezca caso de uso real:

```typescript
// src/lib/fiscal/projection/wsmtxca.ts (F1+ si cliente lo necesita)
export function projectToWSMTXCA(sale: Sale, snapshot: FiscalSnapshot): WSMTXCAProjection {
  // WSMTXCA SÍ acepta detalle por ítem
  return {
    Items: sale.items.map(item => ({
      Descripcion: item.product_name_snapshot,
      Cantidad: item.quantity.toString(),
      // ...
    })),
    // ...
  };
}

// src/lib/fiscal/projection/wsfex.ts (F1+ si target B2B exportador)
export function projectToWSFEX(sale: Sale, snapshot: FiscalSnapshot): WSFEXProjection { ... }
```

**Regla absoluta:** un Sale interno NO conoce el WS de destino. La proyección se elige en el momento de emitir según contexto.

### Capa 3 — Fiscal Snapshot (persistencia reproducible)

**Cada factura emitida persiste un snapshot completo del contexto fiscal que la generó:**

```typescript
interface FiscalSnapshot {
  // Versión del motor de cálculo (semver)
  calculation_engine_version: string;     // 'v1.0.0' en F0
  
  // Versión de la política fiscal aplicada
  tax_policy_version: string;             // 'v2026-05-ar-tdf' o 'v2026-05-ar-caba' según jurisdicción
  
  // Parámetros de redondeo al momento de emisión
  rounding_mode: 'HALF_UP' | 'HALF_DOWN' | 'HALF_EVEN';
  rounding_stage: 'PER_LINE' | 'PER_TAX_BRACKET';
  precision_internal: number;             // 30
  
  // Alícuotas aplicadas
  iva_rates_applied: Record<string, number>;  // { 'IVA_21': 21.0, 'IVA_10_5': 10.5 }
  
  // Currency y FX
  currency_code: string;                  // 'ARS'
  fx_rate: string;                        // '1.0000' para ARS
  
  // WS de destino
  wsfe_version: string;                   // 'WSFEv1' (vs WSMTXCA, WSFEX)
  wsfe_manual_revision: string;           // 'COMPG_v3.4.2' — versión del manual contra la que validamos
  
  // Jurisdicción del comerciante en momento de venta (NUEVO 2026-05-27)
  jurisdiction_context: {
    country: 'AR';
    province: 'CABA' | 'BUENOS_AIRES' | 'TIERRA_DEL_FUEGO';
    special_regime: 'LEY_19640' | null;
  };
  
  // NUEVO 2026-05-27 — contexto del comerciante (necesario para reglas TDF)
  merchant_special_regime: 'LEY_19640' | null;
  merchant_jurisdiction_province: 'CABA' | 'BUENOS_AIRES' | 'TIERRA_DEL_FUEGO';
  
  // NUEVO 2026-05-27 — naturaleza de la transacción
  // true si el comercio TDF vende a un consumidor dentro del área aduanera especial
  // (relevante para aplicación de exención Ley 19.640)
  transaction_in_special_zone: boolean;
  
  // Snapshot del cliente (ya estaba en Sesión 5 v4 — referencia aquí)
  customer_snapshot_ref: string;          // FK a customer_snapshots
  
  // NUEVO 2026-05-27 — desglose fiscal para ticket
  // Calculado al emitir, inmutable. Lo que se imprimió en el ticket es exactamente esto.
  fiscal_breakdown: FiscalBreakdown;      // ver sección "Projection: Fiscal Ticket Breakdown"
}
```

**Storage:**

```sql
CREATE TABLE fiscal_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL UNIQUE REFERENCES sales(id),
  snapshot_data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Inmutable: trigger BLOQUEA UPDATE/DELETE (igual que audit_log)
CREATE TRIGGER fiscal_snapshots_immutable
  BEFORE UPDATE OR DELETE ON fiscal_snapshots
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_mutation();
```

### Garantía: reproducibilidad

Dado un `sale_id` y su `fiscal_snapshot`, el motor de cálculo **debe poder reconstruir el payload WSFEv1 idéntico** a años de distancia:

```typescript
// Función "función pura" que F1+ puede usar para auditoría
export function reproduceInvoice(saleId: string): WSFEv1Projection {
  const sale = loadSale(saleId);
  const snapshot = loadFiscalSnapshot(saleId);
  
  // El motor debe poder ejecutar con la versión histórica de engine + policy
  const engine = getCalculationEngine(snapshot.calculation_engine_version);
  const policy = getTaxPolicy(snapshot.tax_policy_version);
  
  return engine.projectToWSFEv1(sale, snapshot, policy);
}
```

### Alcance F0 vs F1+ del versioning — explícito

**F0 (lo que se implementa ahora):**

| Componente | F0 |
|---|---|
| Persistir `calculation_engine_version` en cada `fiscal_snapshot` | ✅ SÍ |
| Persistir `tax_policy_version` en cada `fiscal_snapshot` | ✅ SÍ |
| `getCalculationEngine()` con UNA sola versión (`v1.0.0`) en registry | ✅ SÍ |
| `getTaxPolicy()` con UNA sola versión (`v2026-05-ar-caba`) en registry | ✅ SÍ |
| Validar al insertar que la versión persistida coincide con la versión activa | ✅ SÍ |
| Runtime de multi-engine para reproducción histórica con versiones distintas | ❌ NO (defer) |
| Migrations/registries cuando bumpea engine | ❌ NO (defer) |

**Justificación del defer:** F0 solo va a tener una versión. Construir el runtime multi-engine antes de tener al menos DOS versiones reales es complejidad accidental temprana. El campo `calculation_engine_version` se persiste pero al leerlo siempre es `'v1.0.0'`.

**F1+ trigger para implementar multi-engine runtime:** primer bump real de engine version (ej: cuando un cliente piloto fuerce un cambio en algoritmo que cambia output numérico). En ese momento:
1. Se mantiene `v1.0.0` cargado para reproducir facturas pre-bump
2. Se agrega `v1.1.0` (o `v2.0.0` si es MAJOR) como nueva versión activa
3. `getCalculationEngine(version)` devuelve la versión correcta según snapshot
4. Tests de regresión obligatorios contra muestra de facturas reales

**Beneficio del approach F0:** cuando llegue el primer cambio real, los snapshots existentes ya tienen la versión correctamente persistida. No hay que migrar nada. Solo se agrega el runtime de selección.

## Calculation Engine Versioning — política F0

| Versión | Inicio | Cambios |
|---|---|---|
| `v1.0.0` | 2026-05-26 | Initial — HALF_EVEN + PER_LINE + WSFEv1 only |

**Regla de bump:**
- **PATCH (v1.0.X):** bug fix que NO cambia output numérico (refactor, performance)
- **MINOR (v1.X.0):** cambio que AGREGA capacidad sin cambiar output existente (nuevo WS, nueva jurisdicción)
- **MAJOR (vX.0.0):** cambio que MODIFICA output numérico (cambio rounding, cambio stage)

**Cualquier MAJOR bump:**
1. Documentar exactamente qué cambia
2. Mantener versión anterior en code registry para reproducir histórico
3. Tests de regresión: para una sample de facturas históricas, `reproduceInvoice(id, snapshot.engine_version)` debe dar idéntico al original

## Tax Policy Versioning — política F0

| Versión | Inicio | Scope |
|---|---|---|
| `v2026-05-ar-caba` | 2026-05-26 | Argentina + CABA / GBA, RI / Monotributo, IVA 21%/10.5%/27%/0%, sin TDF, sin exportación |

**Bump cuando cambia:**
- Alícuota IVA (improbable pero posible)
- Inscripción nueva del comerciante (RI → Monotributo)
- Nueva jurisdicción soportada (TDF, exterior)
- Nueva RG AFIP relevante para validaciones

## Métricas obligatorias fiscales (Concept C de la investigación)

Agregar al sistema de observabilidad (Rule 04-observability):

```typescript
// 4 métricas básicas F0
metric('invoice_rounding_delta', { 
  mode: 'HALF_EVEN', 
  stage: 'PER_LINE', 
  delta_cents: number  // diferencia entre per-line sum y per-total
});

metric('afip_rejection_rate', { 
  error_code: string, 
  sale_point: number,
  wsfe_version: string  // 'WSFEv1'
});

metric('reconciliation_mismatch', { 
  source: 'mercadopago' | 'bank' | 'manual', 
  delta_cents: number 
});

metric('iva_delta_distribution', { 
  tax_rate: number, 
  sign: 'positive' | 'negative' | 'zero'
});
```

**Sin estas métricas, los bugs fiscales son silenciosos y acumulativos.** Aparecen 18 meses después como diferencia de millones en libro IVA.

## Tolerance Semantics — ámbito definido

| Área | Política |
|---|---|
| `ImpIVA == sum(Iva[].Importe)` (AFIP WSFEv1) | **Exacta — tolerancia 0** |
| Recálculo cliente vs server | **Exacta — tolerancia 0** (ADR-0019 S4 anti-tampering) |
| Reconciliación MercadoPago vs venta registrada | Tolerante (±$0.50, configurable) |
| Reconciliación bancaria | Tolerante (±$0.50) |
| Importación CSV / Excel | Tolerante (configurable por caller) |
| Analytics / reportes de gestión | Tolerante (no fiscal) |

```typescript
// src/lib/money/tolerance.ts
export function withinTolerance(
  a: Decimal,
  b: Decimal,
  toleranceCents: number = 50  // default ±$0.50
): boolean {
  return a.minus(b).abs().lte(new Decimal(toleranceCents).div(100));
}
```

**Regla absoluta:** `withinTolerance()` NUNCA se usa en path fiscal (emisión WSFE). Solo para reconciliación con sistemas externos.

## Jurisdicción — F0 (TDF incluido como target real)

**Corrección 2026-05-27:** versiones anteriores de este ADR documentaban TDF como F2+. **Eso era incorrecto.** Target real F0 incluye comercios de Tierra del Fuego (kioscos, ferreterías, retail pequeño). TDF F0 con scope acotado.

### Jurisdicciones soportadas F0

```typescript
type Jurisdiction = {
  country: 'AR';
  province: 'CABA' | 'BUENOS_AIRES' | 'TIERRA_DEL_FUEGO';
  special_regime: 'LEY_19640' | null;  // null para CABA/BUENOS_AIRES, opcional para TDF
};
```

### Reglas operativas mínimas (sin tax engine)

Lógica simple en el projection layer — un `if` por jurisdicción, sin engine de reglas dinámicas:

```typescript
function computeIvaForLine(item: SaleItem, snapshot: FiscalSnapshot): {
  iva_amount: Decimal;
  ivaCode: 'IVA_21' | 'IVA_10_5' | 'IVA_27' | 'EXENTO_LEY_19640' | 'EXENTO_GENERAL';
} {
  const isTdfComerciante = snapshot.merchant_jurisdiction_province === 'TIERRA_DEL_FUEGO'
    && snapshot.merchant_special_regime === 'LEY_19640';
  
  if (isTdfComerciante && item.product.tdf_exempt && snapshot.transaction_in_special_zone) {
    return { iva_amount: new Decimal(0), ivaCode: 'EXENTO_LEY_19640' };
  }
  
  // Tratamiento estándar IVA (21% / 10.5% / 27%)
  return computeStandardIva(item);
}
```

### Mapeo a WSFEv1

Operaciones exentas por Ley 19.640:
- No se incluyen en array `Iva[]` de WSFEv1
- Su base imponible va al campo `ImpOpEx` (importe operaciones exentas) del header
- Pueden coexistir con operaciones gravadas en la misma factura (item gravado en `Iva[]`, item exento en `ImpOpEx`)

WSFEv1 estándar soporta esto sin necesidad de WSBFE o WSCT (esto requiere confirmación final con contador TDF — ver `reunion-contador-y-abogado.md` Parte A sección 11).

### Lo que NO entra F0 (deliberado, no over-engineering)

| Concepto | Razón de defer |
|---|---|
| **WSBFE** (Bonos Fiscales) | Aplica a industrias promovidas TDF, no a retail pequeño |
| **WSCT** (turismo) | Aplica a venta a turistas extranjeros, no retail local |
| **Multi-currency / USD** | Retail TDF factura ARS. USD solo en exportaciones grandes |
| **Tax engine con reglas dinámicas** | YAGNI. Un `if (special_regime === 'LEY_19640')` alcanza F0 |
| **IIBB provincial completo** | TDF tiene su propia normativa IIBB, pero F0 prioriza facturación AFIP. IIBB queda para libro IVA mensual del contador (no automático F0) |
| **Tabla canónica "productos exentos Ley 19.640"** | Cada comercio define con su contador. Pandora provee el flag, no la decisión |

### Backlog (con triggers explícitos)

| Caso | Trigger |
|---|---|
| WSBFE | Primer cliente target con Bonos Fiscales industriales |
| WSCT | Primer cliente turismo |
| Multi-currency USD | Primer caso real de exportación que justifique |
| Cliente CABA/BUENOS_AIRES | Soportado F0 sin special_regime |
| Otras provincias (Mendoza, Córdoba, etc.) | Primer cliente fuera de CABA/GBA/TDF |
| Régimen industrial promovido TDF | Primer cliente industrial (probable WSBFE) |

## Schema completo

```sql
-- ALTER existente en sales
ALTER TABLE sales ADD COLUMN fiscal_snapshot_id uuid REFERENCES fiscal_snapshots(id);

-- Nueva tabla
CREATE TABLE fiscal_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL UNIQUE REFERENCES sales(id),
  
  -- Engine + Policy
  calculation_engine_version text NOT NULL,
  tax_policy_version text NOT NULL,
  
  -- Rounding context
  rounding_mode text NOT NULL,
  rounding_stage text NOT NULL,
  precision_internal int NOT NULL,
  
  -- Tax rates snapshot (JSON para flexibilidad de schema)
  iva_rates_applied jsonb NOT NULL,
  
  -- Currency / FX
  currency_code text NOT NULL DEFAULT 'ARS',
  fx_rate numeric(19,6) NOT NULL DEFAULT 1.0,
  
  -- WS context
  wsfe_version text NOT NULL,
  wsfe_manual_revision text NOT NULL,
  
  -- Jurisdiction
  jurisdiction_country text NOT NULL DEFAULT 'AR',
  jurisdiction_province text NOT NULL,
  jurisdiction_special_regime text,
  
  -- Customer snapshot reference
  customer_snapshot jsonb NOT NULL,  -- denormalizado para reproducibilidad
  
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_fiscal_snapshots_sale ON fiscal_snapshots(sale_id);
CREATE INDEX idx_fiscal_snapshots_engine_version ON fiscal_snapshots(calculation_engine_version);
CREATE INDEX idx_fiscal_snapshots_policy_version ON fiscal_snapshots(tax_policy_version);

-- Inmutable
CREATE TRIGGER fiscal_snapshots_immutable
  BEFORE UPDATE OR DELETE ON fiscal_snapshots
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_mutation();
```

## Schema impactado por TDF F0 (NUEVO 2026-05-27)

### Tabla `products` — flag `tdf_exempt`

```sql
ALTER TABLE products ADD COLUMN tdf_exempt boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN products.tdf_exempt IS
  'Si true Y el comercio opera bajo Ley 19.640 Y la venta es dentro de TDF: ' ||
  'el item se factura como exento (ImpOpEx en WSFEv1). ' ||
  'Default conservador false: paga IVA estándar. ' ||
  'Decisión del comerciante con asesoría de su contador.';
```

**Default `false` (conservador):** si el comerciante no marcó explícitamente, el producto paga IVA. Mejor falso negativo (IVA cobrado de más, ajustable contablemente) que falso positivo (IVA omitido = riesgo de inspección AFIP).

### Tabla `fiscal_snapshots` — columnas nuevas

```sql
ALTER TABLE fiscal_snapshots
  ADD COLUMN merchant_special_regime text,           -- 'LEY_19640' | null
  ADD COLUMN merchant_jurisdiction_province text NOT NULL DEFAULT 'BUENOS_AIRES',
  ADD COLUMN transaction_in_special_zone boolean NOT NULL DEFAULT false,
  ADD COLUMN fiscal_breakdown jsonb NOT NULL DEFAULT '{}'::jsonb;
```

Default a `BUENOS_AIRES` + `false` para que nuevos comercios sin TDF no rompan. Comercios TDF setean explícitamente en setup.

---

## Projection: Fiscal Ticket Breakdown (transparencia fiscal — NUEVO 2026-05-27)

### Por qué

La regulación argentina viene empujando hacia mayor transparencia fiscal en tickets/facturas (visibilidad del peso impositivo al consumidor). Sin un modelo explícito, el sistema termina hardcodeando "IVA 21%" en el ticket sin posibilidad de adaptación.

**F0 mínimo:** modelo de breakdown que permite mostrar componentes fiscales al consumidor, persistido inmutable en el snapshot para reproducibilidad histórica.

**NO F0:** engine regulatorio dinámico, motor de reglas, framework de disclosure. Eso es over-engineering hasta que aparezca trigger real.

### Modelo

```typescript
// src/lib/fiscal/types.ts
import type Decimal from 'decimal.js';

export interface FiscalBreakdown {
  policy_version: string;        // vínculo con tax_policy_version del snapshot
  lines: FiscalComponent[];
}

export interface FiscalComponent {
  code: string;
  // Códigos canónicos F0:
  //   'IVA_21' | 'IVA_10_5' | 'IVA_27' | 'IVA_0'
  //   'EXENTO_LEY_19640' | 'EXENTO_GENERAL'
  //   'PERCEPCION_IIBB' (F1+)
  //   'PERCEPCION_RG2126' (F1+)
  
  jurisdiction:
    | 'NATIONAL'        // AFIP / IVA / Ganancias
    | 'PROVINCIAL'      // IIBB CABA/PBA/TDF
    | 'MUNICIPAL'       // tasas municipales (F1+)
    | 'SPECIAL_REGIME'; // Ley 19.640
  
  label: string;        // texto visible en ticket: "IVA 21%", "Exento Ley 19.640", etc.
  
  amount: Decimal;      // monto del componente
  
  // Opcionales para auditabilidad + legibilidad
  base_amount?: Decimal;   // monto sobre el que se calcula
  tax_rate?: Decimal;      // alícuota efectiva (ej: 21.00, 0.00)
  
  included_in_price: boolean;
  // true → precio mostrado en pantalla YA incluye este componente (típico factura B/C consumidor final)
  // false → componente se suma al precio (típico factura A)
  
  visible_to_consumer: boolean;
  // true → aparece impreso en el ticket
  // false → solo en registro interno / payload AFIP
  
  legal_reference?: string;
  // ej: "Ley 19.640 art. 1 inc. b", "RG AFIP 4291", null si no aplica
  
  display_order: number;  // orden de aparición en ticket
}
```

### Constructor — función pura

```typescript
// src/lib/fiscal/projection/ticket.ts
import 'server-only';

export function projectToFiscalBreakdown(
  sale: Sale,
  snapshot: FiscalSnapshot
): FiscalBreakdown {
  const lines: FiscalComponent[] = [];
  
  // 1. Componente exenciones Ley 19.640 (si aplica)
  if (snapshot.merchant_special_regime === 'LEY_19640' && snapshot.transaction_in_special_zone) {
    const exemptItems = sale.items.filter(i => i.product.tdf_exempt);
    if (exemptItems.length > 0) {
      const exemptBase = sumDecimal(exemptItems.map(i => i.subtotal_per_line));
      lines.push({
        code: 'EXENTO_LEY_19640',
        jurisdiction: 'SPECIAL_REGIME',
        label: 'Exento Ley 19.640',
        amount: new Decimal(0),
        base_amount: exemptBase,
        tax_rate: new Decimal(0),
        included_in_price: true,
        visible_to_consumer: true,
        legal_reference: 'Ley 19.640',
        display_order: 10,
      });
    }
  }
  
  // 2. Componentes IVA por alícuota
  const ivaByRate = groupItemsByTaxRate(sale.items.filter(i => !isExempt(i, snapshot)));
  for (const [rate, items] of ivaByRate) {
    lines.push({
      code: `IVA_${rate.toString().replace('.', '_')}`,
      jurisdiction: 'NATIONAL',
      label: `IVA ${rate}%`,
      amount: sumDecimal(items.map(i => i.tax_amount_per_line)),
      base_amount: sumDecimal(items.map(i => i.subtotal_per_line)),
      tax_rate: rate,
      included_in_price: isConsumerFinal(sale.customer),
      visible_to_consumer: true,
      legal_reference: 'Ley 20.631 (IVA)',
      display_order: 20 + parseInt(rate.toString()),
    });
  }
  
  // F1+: agregar componentes percepciones, IIBB, etc cuando aparezcan
  
  return {
    policy_version: snapshot.tax_policy_version,
    lines: lines.sort((a, b) => a.display_order - b.display_order),
  };
}
```

### Persistencia + uso

| Layer | Comportamiento |
|---|---|
| Emisión | `projectToFiscalBreakdown(sale, snapshot)` se ejecuta al emitir. Resultado se guarda en `fiscal_snapshots.fiscal_breakdown`. **Inmutable** post-emisión. |
| Ticket impresión / PDF | Lee `fiscal_snapshots.fiscal_breakdown` directamente. **NUNCA recalcula.** Lo que se imprimió es lo que está en el snapshot. |
| Reproducibilidad | Dado `(sale, snapshot)`, ejecutar `projectToFiscalBreakdown` debe dar resultado idéntico al persistido. Test obligatorio. |
| Cambios regulatorios futuros | Nueva versión de `projectToFiscalBreakdown` solo aplica a snapshots con `policy_version` nuevo. Snapshots viejos siguen mostrando lo que se imprimió en su momento. |

### Reglas absolutas

1. **El ticket impreso NUNCA se recalcula on-the-fly.** Lee del snapshot.
2. **`FiscalBreakdown` es inmutable** post-emisión (mismo régimen que `customer_snapshot`).
3. **NUEVOS componentes** se agregan modificando `projectToFiscalBreakdown` + bumpeando `tax_policy_version`. NO se modifican snapshots históricos.
4. **`visible_to_consumer: false`** se usa para componentes internos (ej: reserva de cálculo) que no deben verse en el ticket pero sí en payload AFIP.

### Lo que NO entra F0

- Engine de templates de tickets configurable por comercio → F2+
- Componentes municipales (tasas) → F1+ cuando aparezca cliente
- Disclosure dinámico basado en monto / tipo de cliente → F1+
- Multi-idioma del ticket → F2+

---

## Deterministic Decimal Serialization (canonical AFIP format)

### Por qué

El payload WSFEv1 espera valores numéricos como **strings con formato canónico**. Cualquier variación (locale, scientific notation, trailing ambiguity) genera rechazo del servicio. La serialización debe ser **determinística**: para cualquier valor monetario interno, **siempre** produce el mismo string.

### Reglas operativas

| Caso | Output canónico | NO permitido |
|---|---|---|
| `1234.50` | `"1234.50"` | `"1,234.50"` (locale comma), `"1234.5"` (trailing strip), `"1.2345e3"` (notation) |
| `0` | `"0.00"` | `"0"`, `"0."`, `".00"`, `""` |
| `0.50` | `"0.50"` | `".50"`, `"0.5"` |
| `1000.005` (post-redondeo HALF_EVEN) | `"1000.00"` o `"1000.01"` según par | `"1.00000050000e3"` |
| Negativo `-12.30` | `"-12.30"` | `"-12.3"`, `"(12.30)"`, `"−12.30"` (Unicode minus) |

### Implementación

```typescript
// src/lib/fiscal/serialization.ts
import 'server-only';
import Decimal from 'decimal.js';

/**
 * Serialización canónica de un valor monetario para AFIP.
 * 
 * Reglas:
 * - SIEMPRE exactamente N decimales (default 2 para presentación AFIP)
 * - SIEMPRE punto como separador decimal (NUNCA coma)
 * - SIEMPRE notación fija (NUNCA exponencial)
 * - SIN locale, SIN thousand separators
 * - Negativo con guión ASCII directo (NUNCA Unicode minus ni paréntesis)
 */
export function serializeCanonicalAFIP(
  value: Decimal | string,
  decimals: number = 2
): string {
  const d = value instanceof Decimal ? value : new Decimal(value);
  
  // toFixed garantiza notación fija + decimales exactos
  // NUNCA usa locale (es Decimal.js, no Number.toLocaleString())
  const result = d.toFixed(decimals);
  
  // Validación defensiva — formato esperado: -?\d+\.\d{N}
  const expectedPattern = new RegExp(`^-?\\d+\\.\\d{${decimals}}$`);
  if (!expectedPattern.test(result)) {
    throw new FiscalSerializationError(
      `Canonical AFIP format violation: "${result}" does not match /^-?\\d+\\.\\d{${decimals}}$/`
    );
  }
  
  return result;
}
```

### Uso obligatorio en projection layer

```typescript
// src/lib/fiscal/projection/wsfev1.ts
function buildPayload(sale: Sale, snapshot: FiscalSnapshot): WSFEv1Projection {
  return {
    // ❌ MAL — Decimal.toString() puede dar "1234.5" o "1.2345e3"
    ImpTotal: sale.total.toString(),
    
    // ✅ BIEN — canonical serializer
    ImpTotal: serializeCanonicalAFIP(sale.total),
    ImpNeto: serializeCanonicalAFIP(sale.subtotal),
    ImpIVA: serializeCanonicalAFIP(sale.tax_total),
    Iva: groupedItems.map(g => ({
      Id: g.afip_id,
      BaseImp: serializeCanonicalAFIP(g.base),
      Importe: serializeCanonicalAFIP(g.iva),
    })),
  };
}
```

### Tests obligatorios

```typescript
describe('serializeCanonicalAFIP', () => {
  it('1234.50 → "1234.50"', () => {
    expect(serializeCanonicalAFIP(new Decimal('1234.50'))).toBe('1234.50');
  });
  
  it('0 → "0.00"', () => {
    expect(serializeCanonicalAFIP(new Decimal('0'))).toBe('0.00');
  });
  
  it('negativo -12.30 → "-12.30"', () => {
    expect(serializeCanonicalAFIP(new Decimal('-12.30'))).toBe('-12.30');
  });
  
  it('NO usa scientific notation para números grandes', () => {
    expect(serializeCanonicalAFIP(new Decimal('1000000000.00'))).toBe('1000000000.00');
  });
  
  it('NO usa locale comma', () => {
    const result = serializeCanonicalAFIP(new Decimal('1234567.89'));
    expect(result).not.toContain(',');
    expect(result).toBe('1234567.89');
  });
  
  it('4 decimales internos', () => {
    expect(serializeCanonicalAFIP(new Decimal('100.1234'), 4)).toBe('100.1234');
  });
  
  it('throw si formato resultante es inválido', () => {
    // Caso construido para forzar inconsistencia (no debería pasar nunca)
    expect(() => serializeCanonicalAFIP(new Decimal('NaN'))).toThrow();
  });
});
```

### Regla absoluta

**El payload AFIP NUNCA se construye con `.toString()` o `${value}` template literals sobre Decimal.** Pasa siempre por `serializeCanonicalAFIP()`. Lint rule custom puede enforcear esto a nivel código F1+.

---

## Monotonic Fiscal Sequencing — invariante operacional

### Problema

En retries, failovers, race conditions, los timestamps fiscales pueden quedar inconsistentes:
- Worker A asigna número 1234 con timestamp T1
- Worker A crashea antes de commit
- Worker B retoma, asigna número 1235 con timestamp T2
- Worker A revive, ya había hecho `INSERT` que se commiteó tarde
- Resultado: número 1234 tiene timestamp **posterior** a número 1235

AFIP **no rechaza** este caso (no valida monotonía exacta entre números consecutivos), pero genera:
- Audit incoherente
- Reportes mensuales fuera de orden
- Confusión en investigación de bugs
- Posible inspección AFIP detecta inconsistencia

### Invariante operacional

> **Para una combinación (sale_point, invoice_type), si el número N+1 existe, su timestamp debe ser ≥ al timestamp del número N. Sin excepciones.**

Equivalente formal:

```
∀ n, m ∈ invoices for (sale_point, type):
  n.number < m.number  ⟹  n.created_at ≤ m.created_at
```

### Implementación

**Garantías que ya provee ADR-0006 (SELECT FOR UPDATE en `invoice_sequences`) + ADR-0011 (serializable retry):**

1. Solo UN worker a la vez puede tomar el próximo número para una `(sale_point, invoice_type)` específica
2. La transacción que reserva el número también persiste la factura
3. Si la transacción rollback, el número queda libre

**Lo que ADR-0022 agrega:**

- Constraint check explícito en la tabla `afip_invoices`:

```sql
-- Función de validación
CREATE OR REPLACE FUNCTION assert_monotonic_invoice_sequence()
RETURNS trigger AS $$
DECLARE
  prev_timestamp timestamptz;
BEGIN
  SELECT created_at INTO prev_timestamp
  FROM afip_invoices
  WHERE company_id = NEW.company_id
    AND sale_point = NEW.sale_point
    AND invoice_type = NEW.invoice_type
    AND number = NEW.number - 1;
  
  IF prev_timestamp IS NOT NULL AND NEW.created_at < prev_timestamp THEN
    RAISE EXCEPTION 'Monotonic invoice sequence violation: number % has timestamp % but previous number % has timestamp %',
      NEW.number, NEW.created_at, NEW.number - 1, prev_timestamp;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER afip_invoices_monotonic
  BEFORE INSERT ON afip_invoices
  FOR EACH ROW EXECUTE FUNCTION assert_monotonic_invoice_sequence();
```

- Uso de `getCurrentFiscalTime()` (ADR-0019 S16) en lugar de `now()` Postgres directo en la lógica de emisión, para que el clock drift check aplique antes del INSERT

### Casos límite cubiertos

| Caso | Comportamiento |
|---|---|
| Worker A tarda 2 segundos, Worker B procesa 1 segundo después | Worker B obtuvo lock primero → su número es mayor + timestamp mayor ✅ |
| Clock drift > 5s detectado al iniciar emisión | `getCurrentFiscalTime()` throw antes del INSERT ✅ (fail-closed S16) |
| Failover de Postgres con réplica con clock drift | Trigger detecta violation + throw → fail-closed ✅ |
| Worker resucitado con timestamp viejo intenta INSERT | Trigger detecta violation + throw ✅ |

### Métricas

| Métrica | Alerta si |
|---|---|
| `fiscal_monotonic_sequence_violation` | > 0 (CRÍTICO — investigar inmediatamente, hay race condition no manejada) |

---

## Alternativas rechazadas

- **Crear 5 capas separadas (Money / Tax Policy / Projection / Snapshot / Jurisdiction)** como propuso la investigación inicial — rechazado por over-abstraction. F0 con 2 ADRs (0005 + este 0022) cubre las necesidades. Las "capas" emergen naturalmente del código sin necesidad de ADRs separados.
- **No persistir snapshot fiscal, calcular on-demand desde reglas actuales** — rechazado. Imposibilita reproducción histórica. Violación de "factura emitida es la verdad".
- **Snapshot solo del customer (Sesión 5 v4 cambio #3)** — insuficiente. Customer es solo una dimensión. Engine + policy + rounding + jurisdiction + WS son igualmente críticos.
- **Mezclar emisión y proyección en un solo Service** — rechazado. Acoplamiento entre lógica interna y shape WSFEv1 hace imposible agregar WSMTXCA / WSFEX sin refactor masivo.
- **Calculation engine versioning con sub-versiones por componente** (engine separado de policy) — rechazado para F0. Una sola versión combinada `(engine_version, policy_version)` es suficiente. Granularidad mayor en F2+.

## Consecuencias

**Positivas:**
- Reproducibilidad histórica garantizada (compliance + auditoría + post-mortem de bugs fiscales).
- Multi-WS extensible sin refactor (WSMTXCA, WSFEX F1+ son agregar archivo en `projection/`).
- Tres vistas separadas (comercial / contable / fiscal) sin código spaghetti.
- Tolerance semantics con ámbito definido — no se aplica a path fiscal por accidente.

**Negativas:**
- Una tabla más (`fiscal_snapshots`) con storage proporcional a número de facturas. Aceptable: ~1KB por factura = 1GB cada 1M facturas.
- Disciplina necesaria al bumpear engine/policy versions. Sin disciplina, reproducibilidad falla silenciosamente.
- Más conceptos para nuevo dev al onboarding.

**Riesgos a monitorear:**
- Drift entre código de engine y snapshot persistido — implementar tests de reproducción de facturas reales mensualmente F1+.
- Storage de snapshots crece linealmente con facturas — cold storage F2+ con S3 Glacier para snapshots > 5 años.
- Cliente que requiere WSMTXCA/WSFEX antes de F1 — significa refactor anticipado.

## Circuit Breakers fiscales (NUEVO 2026-05-26)

### Por qué

Un bug en el motor fiscal puede emitir miles de facturas inválidas en minutos antes de que alguien lo detecte. Sin circuit breakers, el sistema:

- Emite duplicados a AFIP (bloqueo CUIT)
- Quema cientos de números de comprobante
- Genera obligación fiscal real con AFIP
- Imposible de rollback (CAE emitido es CAE emitido)

### Reglas operativas

#### CB1 — Rate limit fiscal por tenant

```typescript
// src/lib/fiscal/circuit-breakers.ts
const MAX_INVOICES_PER_MINUTE_PER_TENANT = 30;  // ajustable post-piloto
const MAX_INVOICES_PER_HOUR_PER_TENANT = 500;

async function assertFiscalRateLimit(ctx: AuthContext): Promise<void> {
  const lastMinute = await countInvoicesIssued(ctx.companyId, '1 minute');
  if (lastMinute >= MAX_INVOICES_PER_MINUTE_PER_TENANT) {
    throw new FiscalRateLimitExceeded(
      `Tenant ${ctx.companyId} exceeded ${MAX_INVOICES_PER_MINUTE_PER_TENANT} invoices/min. ` +
      `Manual review required.`
    );
  }
  // Similar para hora
}
```

**Targets default F0** (calibrar con clientes piloto reales):
- 30 facturas/minuto por tenant — sobra para POS humano, bloquea bug
- 500 facturas/hora por tenant — sobra para comercio activo

#### CB2 — Anomaly detection — diff vs histórico del tenant

```typescript
// Si tenant emite súbitamente 10x más que su promedio histórico → alerta
const recentRate = invoicesIssuedLast(ctx.companyId, '1 hour');
const historicalAvg = avgInvoicesPerHour(ctx.companyId, 'last 30 days');

if (recentRate > historicalAvg * 10) {
  metric('fiscal_anomaly_detected', { 
    company_id: ctx.companyId, 
    recent_rate: recentRate, 
    historical_avg: historicalAvg 
  });
  // No bloquea automáticamente — alerta para revisión humana
}
```

#### CB3 — Emergency stop por tenant

Bandera global por tenant que pausa toda emisión fiscal:

```sql
ALTER TABLE companies ADD COLUMN fiscal_emergency_stop boolean NOT NULL DEFAULT false;
ALTER TABLE companies ADD COLUMN fiscal_emergency_stop_reason text;
ALTER TABLE companies ADD COLUMN fiscal_emergency_stop_at timestamptz;
ALTER TABLE companies ADD COLUMN fiscal_emergency_stop_by uuid REFERENCES profiles(id);
```

Cuando se activa (manual por admin de Pandora o automático por anomaly):
- Toda emisión nueva → throw `FiscalEmergencyStopActive`
- POS muestra banner crítico al cajero
- Email automático al owner del tenant + al equipo Pandora

Reactivación: solo manual por admin Pandora con motivo documentado en audit_log.

#### CB4 — Batch confirmation obligatorio

Operaciones masivas (ej: importar 100 facturas históricas a re-emitir, anular un lote, etc.) requieren confirmación humana explícita:

```typescript
async function batchEmitInvoices(invoices: Invoice[], confirmation: string) {
  if (invoices.length > 10 && confirmation !== `EMIT-${invoices.length}-INVOICES`) {
    throw new BatchConfirmationRequired(
      `Operación masiva de ${invoices.length} facturas requiere confirmación: ` +
      `pasá "EMIT-${invoices.length}-INVOICES" como segundo parámetro.`
    );
  }
  // ... proceder
}
```

### Métricas obligatorias

| Métrica | Alerta si |
|---|---|
| `fiscal_rate_limit_hit` | > 0 (auditar — bug o cliente legítimo con pico?) |
| `fiscal_anomaly_detected` | > 0 (revisar manualmente) |
| `fiscal_emergency_stop_activated` | > 0 (CRÍTICO inmediato) |
| `fiscal_batch_confirmation_required` | tracking — verifica que no se intenta bypass |

---

## Fail-Closed Fiscal Semantics (NUEVO 2026-05-26)

### Regla absoluta

> **Si la integridad fiscal es incierta: NO EMITIR.**

Aplica a TODOS los siguientes escenarios:

| Escenario | Comportamiento |
|---|---|
| WSAA token failure (no se obtuvo token válido) | NO emitir. Reintentar autenticación. |
| Certificate X.509 inválido / expirado | NO emitir. Bloquear con error claro. |
| Numeración fiscal: lock contention sin resolver | NO emitir. Esperar lock o fallar limpio. |
| Tax policy version no encontrada en registry | NO emitir. Throw `UnsupportedTaxPolicyVersion`. |
| `assertWSFEv1Invariants()` falla (ImpIVA != sum) | NO emitir. Throw `FiscalProjectionError`. |
| `MONEY_ROUNDING_POLICY` env no seteada | NO emitir. App no arranca (ADR-0005 fail-fast). |
| Clock drift > 5 segundos vs NTP | NO emitir. Throw `ClockDriftError` (ADR-0019 S16). |
| Cross-tenant assertion falla | NO emitir + audit `cross_tenant_attempt_blocked` + investigation. |
| Tenant tiene `fiscal_emergency_stop = true` | NO emitir. Mostrar banner al cajero. |
| Rate limit fiscal excedido (CB1) | NO emitir. Mensaje al cajero. |
| Anomaly detection dispara (CB2) | Emitir con warning + investigation flag. |

### Anti-pattern explícitamente prohibido

```typescript
// ❌ PROHIBIDO
try {
  await assertWSFEv1Invariants(payload);
} catch (err) {
  logger.warn('Invariant failed, but continuing anyway...');
  await afipClient.solicitarCAE(payload);  // emit pese a inconsistencia
  await reconcileLater(saleId);  // "ya lo arreglo después"
}

// ✅ CORRECTO
await assertWSFEv1Invariants(payload);  // si falla, throw — NO se emite
await afipClient.solicitarCAE(payload);
```

### Justificación

Emitir CAE inválido es **irreversible**. AFIP registra el comprobante con ese CUIT, ese punto de venta, ese tipo, ese número. Pandora puede emitir nota de crédito para "anular" pero:
- El número queda gastado (no se reutiliza)
- AFIP mantiene el rastro
- Inspección verá comprobantes con observations / inconsistencias

**Prevención > reconciliación.** Fail-closed elimina la clase entera de bugs "emitido pero inconsistente".

### Distinción importante: fail-closed ≠ fail-rude

Fail-closed NO significa "rechazar al cajero sin explicación". Significa:
- NO emitir a AFIP
- SÍ guardar el sale internamente con `fiscal_status = 'failed'` o `'pending'`
- SÍ mostrar mensaje claro al cajero ("el sistema fiscal está degradado, podés cobrar pero la factura queda pendiente")
- SÍ enrolar a la cola de reconciliación si aplica

La separación `commercial_status` / `fiscal_status` (Sesión 5 v4 cambio #1) está diseñada exactamente para esto.

---

## Concurrencia de numeración fiscal (referencia explícita ADR-0006)

Este ADR depende críticamente de la garantía de ADR-0006 (SELECT FOR UPDATE en `invoice_sequences`) + ADR-0011 (retry serializable con backoff).

**Sin esa garantía, el Fiscal Projection Layer no puede operar correctamente:**
- Dos workers concurrentes intentando emitir → ambos podrían tomar el mismo número
- AFIP rechazaría el segundo con error "número ya autorizado"
- Worker A cree que tiene número 1234, worker B también
- Estado inconsistente

**Verificación obligatoria al arranque:** test de concurrencia con N workers simultáneos en homologación AFIP — confirmar que `invoice_sequences` + serializable resuelve correctamente.

```typescript
// tests/integration/fiscal/concurrency.test.ts
test('100 emisiones simultáneas no quema numeros', async () => {
  const promises = Array.from({ length: 100 }, () => 
    SaleService.emitInvoice(testCtx, validInvoiceData)
  );
  const results = await Promise.allSettled(promises);
  
  const successful = results.filter(r => r.status === 'fulfilled');
  const numbers = successful.map(r => r.value.invoice_number);
  
  // Todos los números asignados deben ser únicos
  expect(new Set(numbers).size).toBe(successful.length);
  
  // Y consecutivos (sin saltos no explicados)
  numbers.sort((a, b) => a - b);
  for (let i = 1; i < numbers.length; i++) {
    expect(numbers[i] - numbers[i-1]).toBe(1);
  }
});
```

---

## Triggers de re-evaluación

| Trigger | Acción |
|---|---|
| Primer bump MAJOR de calculation engine | Test de reproducción contra todas las facturas históricas |
| Cambio de alícuotas IVA AFIP | Bump tax_policy_version + tests |
| Primer cliente en TDF | Expandir `jurisdiction_special_regime` con lógica Ley 19.640 |
| Primer cliente que necesita WSMTXCA | Crear `projection/wsmtxca.ts` + tests |
| `invoice_rounding_delta` distribución sesgada > 5% | Auditar implementación + posible bug |
| Snapshot storage > 10GB | Mover snapshots > 5 años a S3 Glacier |
| `fiscal_emergency_stop` activado | Investigación inmediata + post-mortem |
| `fiscal_anomaly_detected` > 1/día por tenant | Revisar threshold + posible bug |
| Test concurrencia (100 emisiones) falla | STOP deploys hasta resolver |
| Primer caso de "casi se emitió pese a inconsistencia" en logs | Verificar fail-closed semantics + tests |
