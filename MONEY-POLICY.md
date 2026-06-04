# MONEY-POLICY.md — Pandora ERP

**Versión:** 1.0.0
**Fecha:** 2026-05-28
**Estado:** vigente
**Propósito:** consolidación canónica de la política monetaria de Pandora — modo, stage, precisión, currency, separación storage/compute/presentation, invariantes, anti-patterns. **Documento de referencia rápida** — el detalle vive en ADR-0005, ADR-0021 y CLAUDE.md §9.

> Este doc NO introduce decisiones nuevas. Consolida las existentes para que cualquier dev / IA pueda consultar política completa en un solo lugar.

---

## Por qué este documento existe

Money es **EL** invariante de Pandora. Un error de centavo en producción multiplicado por miles de facturas = pesadilla contable + fiscal + legal.

Sin doc consolidado:
- Política dispersa entre ADRs + CLAUDE.md
- Devs leen ADR-0005 sin enterarse de ADR-0021
- Cliente lee CLAUDE.md sin tener contexto histórico de ADR
- Conversaciones repetidas "¿pero la regla cuál era?"

Con doc consolidado:
- 1 link compartible
- Referencia rápida en code review
- Onboarding más rápido
- Política versionable como bloque

---

## Resumen ejecutivo (10 reglas absolutas)

1. **Storage:** `numeric(19,4)` en Postgres. NUNCA `float`, NUNCA `real`, NUNCA `double precision`.
2. **Compute:** `Decimal.js` en TypeScript. NUNCA `Number`, NUNCA `BigInt`, NUNCA otra lib monetaria.
3. **Wire:** strings Decimal serializadas (ej: `"1234.56"`). NUNCA float JS en JSON.
4. **Presentation:** `Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' })`.
5. **Modo redondeo:** `HALF_EVEN` (Banker's rounding). Confirmado por 3 manuales oficiales AFIP/ARCA.
6. **Stage redondeo (F0 propuesto, pendiente A-1 contador):** `PER_LINE` (per-item antes de sumar).
7. **Currency F0:** `ARS` only. Multi-currency F2+ con trigger.
8. **Server SIEMPRE recalcula** contra precios DB. Cliente preview es informativo.
9. **Invariante fiscal AFIP:** `ImpIVA == sum(Iva[].Importe)` con tolerancia 0.
10. **Tolerance semantics:** path fiscal AFIP = 0 tolerancia. Path reconciliación interna = `withinTolerance()` configurable (default ±$0.50).

---

## DIMENSIÓN 1 — Modo de redondeo

### Decisión

**`HALF_EVEN`** (Banker's rounding / Round Half to Even).

```typescript
import Decimal from 'decimal.js';

Decimal.set({ rounding: Decimal.ROUND_HALF_EVEN });
```

### Fundamento

Confirmado por 3 manuales oficiales AFIP/ARCA (verificación 2026-05-26):
- Manual WSFEv1 COMPG v3.4.2: *"El criterio de redondeo que utilizamos en este servicio es Round Half Even."*
- Manual WSMTXCA v0.25.5: *"El método de redondeo a utilizar es Round Half Even."*
- Manual WSFEX v2.1.0: *"El criterio de redondeo que utilizamos en este servicio es Round Half Even."*

### Estado

🟢 **CERRADO.** No requiere validación humana. Decisión técnica del proveedor (AFIP) que Pandora adopta.

### Comportamiento HALF_EVEN

```typescript
Decimal('0.5').toDecimalPlaces(0)   // → 0  (par)
Decimal('1.5').toDecimalPlaces(0)   // → 2  (par)
Decimal('2.5').toDecimalPlaces(0)   // → 2  (par)
Decimal('3.5').toDecimalPlaces(0)   // → 4  (par)
Decimal('0.05').toDecimalPlaces(1)  // → 0.0
Decimal('0.15').toDecimalPlaces(1)  // → 0.2
```

Diferencia con HALF_UP (común en otros sistemas):
- HALF_UP redondea siempre hacia arriba en .5 (0.5→1, 1.5→2, 2.5→3, 3.5→4)
- HALF_EVEN minimiza sesgo acumulado (importante en grandes volúmenes de operaciones)

### Configuración env

```bash
MONEY_ROUNDING_POLICY=HALF_EVEN
```

Validación al boot con Zod fail-fast.

### Fuente normativa

**ADR-0005 Dimensión 1.**

---

## DIMENSIÓN 2 — Stage de redondeo

### Decisión actual (PROPUESTA, pendiente confirmación contador)

**`PER_LINE`** — redondear IVA item por item, luego sumar para obtener total IVA.

```typescript
// PER_LINE
const totalIva = items.map(item =>
  new Decimal(item.unit_price)
    .times(item.qty)
    .times(item.iva_rate)
    .toDecimalPlaces(2)
).reduce((sum, x) => sum.plus(x), new Decimal(0));
```

### Alternativa documentada (fallback)

**`PER_TAX_BRACKET`** — agrupar items por alícuota, calcular IVA del subtotal del grupo.

```typescript
// PER_TAX_BRACKET
const bracketsTotalsIva = brackets.map(bracket => {
  const baseTotal = bracket.items.reduce((sum, item) =>
    sum.plus(new Decimal(item.unit_price).times(item.qty)),
    new Decimal(0)
  );
  return baseTotal.times(bracket.iva_rate).toDecimalPlaces(2);
});
```

### Diferencia operativa

Para 3 items × $333.335 + IVA 21%:

| Stage | Cálculo | IVA Total |
|---|---|---|
| **PER_LINE** | `round($333.335 × 0.21) × 3 = $69.99 × 3` | $209.97 |
| **PER_TAX_BRACKET** | `round(3 × $333.335 × 0.21) = round($210.00105)` con HALF_EVEN | $210.00 (el 0.00105 trunca a .00 — HALF_EVEN coincide con HALF_UP en este caso específico porque el dígito siguiente al lugar de redondeo no es exactamente 5) |

**Diferencia entre PER_LINE y PER_TAX_BRACKET:** $0.03 ($210.00 - $209.97). Esta diferencia es el "one cent problem" que requiere decisión de conciliación contable (pregunta A-1 contador).

### Estado

🟡 **PROPUESTO, pendiente contador (pregunta A-1).**

PER_LINE es hipótesis Pandora porque:
- Cada línea del comprobante "cuadra" con su IVA visible
- Coherente con UX per-line
- Es lo que muchas implementaciones reales hacen

PER_TAX_BRACKET es alternativa porque:
- Alineado con shape WSFEv1 (array `Iva[]` agrupa por alícuota)
- Posiblemente preferido en algunos contextos contables AR

### Sub-decisión pendiente — Tratamiento contable de diferencia de centavos

Cuando `sum(IVA per_line) ≠ IVA per_total`, generar:
- ☐ Asiento de ajuste "diferencia de redondeo"
- ☐ Aceptar sin ajuste
- ☐ Depender del monto / umbral

Decisión pendiente contador.

### Configuración env

```bash
MONEY_ROUNDING_STAGE=PER_LINE  # o PER_TAX_BRACKET tras decisión contador
```

### Fuente normativa

**ADR-0005 Dimensión 2** (propuesta). Cierre pendiente reunión contador (pregunta A-1 en `reunion-contador-y-abogado.md`).

---

## TIPO CANÓNICO

### Storage Postgres

```sql
CREATE TABLE products (
  ...
  price numeric(19, 4) NOT NULL CHECK (price >= 0),
  ...
);

CREATE TABLE sales (
  ...
  total numeric(19, 4) NOT NULL CHECK (total >= 0),
  total_iva numeric(19, 4) NOT NULL CHECK (total_iva >= 0),
  ...
);
```

- **Precision 19** = 15 dígitos enteros + 4 decimales.
- **Cubre montos hasta ~9.999.999.999.999.999,9999** (10 billones ARS).
- **CHECK constraint** rechaza valores inválidos.

### Compute TypeScript

```typescript
import Decimal from 'decimal.js';

// Configuración global al boot
Decimal.set({
  precision: 40,                  // alta precisión interna
  rounding: Decimal.ROUND_HALF_EVEN,
  toExpNeg: -7,
  toExpPos: 21,
});

// Uso
const total = new Decimal(price)
  .times(quantity)
  .times(new Decimal(1).plus(taxRate))
  .toDecimalPlaces(4);

// Comparación SIEMPRE con métodos
if (total.gt(other)) { ... }    // greater than
if (total.eq(other)) { ... }    // equal
if (total.lt(other)) { ... }    // less than

// NUNCA con operadores nativos
if (total > other) { ... }      // ❌ MAL — convierte a Number
if (total === other) { ... }    // ❌ MAL — referencia de objeto, no valor
```

### Wire format (API/JSON)

```typescript
// Server → Client
return {
  total: total.toString(),       // "1234.5678"
  total_iva: totalIva.toString() // "259.2492"
};

// Client → Server (parseo)
const total = new Decimal(req.body.total);
// (Zod validation antes de Decimal para validar shape de string)
```

**Nunca:**
- `JSON.stringify(decimal)` directo → devuelve `"0"` porque no hay `toJSON` definido
- `parseFloat(string)` → cae a Number con error de redondeo
- Enviar Number JS en JSON cuando representa money

### Presentation (UI/print)

```typescript
// Cliente / impresión
const formatter = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

formatter.format(total.toNumber());  // "$ 1.234,57"
```

**Nota:** `.toNumber()` solo aquí en boundary de presentación.

### Fuente normativa

**ADR-0005 + CLAUDE.md §9.**

---

## CURRENCY POLICY

### Decisión F0

**`ARS` only** hardcoded.

- Storage: `currency_code varchar(3) NOT NULL DEFAULT 'ARS' CHECK (currency_code = 'ARS')` — CHECK enforce hardcode.
- Compute: nunca mezclar Decimals de monedas distintas (verificar `currency_code` antes de operar).
- Persistir `currency_code` en `fiscal_snapshots` para reproducibilidad histórica si F2+ habilita multi-currency.

### Trigger para reabrir (F2+)

Multi-currency requiere:
- Primer cliente B2B exportador con use case real
- Análisis de tasa de cambio / fluctuación / contabilización en USD/EUR
- ADR específico

Hasta entonces: **rechazar todo intento de multi-currency** (NON-GOALS N-FEAT-06).

### Fuente normativa

**ADR-0005 sección "Currency F0 ARS only" + NON-GOALS N-FEAT-06.**

---

## SEPARACIÓN STORAGE / COMPUTE / PRESENTATION

| Stage | Tipo | Reglas |
|---|---|---|
| **Storage** | `numeric(19,4)` Postgres | Drizzle column type `numeric({ precision: 19, scale: 4 })`. NUNCA `real`, NUNCA `double precision`, NUNCA `float`. |
| **Compute** | `Decimal` (decimal.js) | Toda operación dentro de `new Decimal(value)`. Resultado intermedio NO redondeado. Solo redondeo al final del cálculo (per-line o per-bracket según stage). |
| **Wire** | string | `decimal.toFixed(4)` o `decimal.toString()` según contexto. JSON.stringify NUNCA toca Decimal directo. |
| **Presentation** | string formateado | `Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' })`. |

### Conversiones permitidas

```typescript
// DB → Compute
const price = new Decimal(row.price);  // numeric column → Decimal

// Compute → Wire
const wire = total.toString();  // Decimal → string

// Wire → Compute
const fromWire = new Decimal(wireValue);  // string → Decimal

// Compute → Presentation
const display = formatter.format(total.toNumber());
// ↑ ÚNICA conversión a Number permitida — solo presentación
```

### Conversiones PROHIBIDAS

```typescript
// ❌ MAL
const total = parseFloat(stringValue);
const iva = total * 0.21;
const final = total.toFixed(2);  // si total es Number, redondeo IEEE 754

// ❌ MAL
const tot = price + quantity * something;  // Number arithmetic en path money

// ❌ MAL
JSON.stringify({ total: decimal });  // devuelve "{ total: '0' }"
```

### Fuente normativa

**ADR-0005 sección "Separación storage / compute / presentation".**

---

## MONEY CLIENT-SIDE (ADR-0021)

### Decisión

Cliente recibe la policy Money vía **React Context inyectado por server**. NO lee `process.env` directo.

```tsx
// app/layout.tsx (Server Component)
import { getMoneyPolicy } from '@/lib/money/policy.server';

export default async function Layout({ children }) {
  const policy = await getMoneyPolicy();
  return (
    <MoneyContextProvider policy={policy}>
      {children}
    </MoneyContextProvider>
  );
}
```

```tsx
// client component
'use client';
import { useMoneyContext } from '@/lib/money/context.client';
import Decimal from 'decimal.js';

function POSCart({ items }) {
  const { calculate } = useMoneyContext();
  const preview = calculate({ items, discounts });
  return <div>Total preview: {preview.formattedTotal}</div>;
}
```

### Reglas

1. **Cliente puede mostrar preview** con Decimal.js client-side (compute correcto, sin float drift).
2. **Server SIEMPRE recalcula** al guardar venta contra precios DB actuales.
3. **Si discrepan > $0.01** → server gana + log `price_tampering_attempt` + métrica.
4. **Si discrepan ≤ $0.01** → aceptar (tolerancia de presentación, no de tampering).
5. **Client NUNCA decide** money policy. Solo refleja.

### Fuente normativa

**ADR-0021.**

---

## MONEY INVARIANTS

### 1. NO NaN

Toda operación Decimal valida que el input es válido. Si input es `NaN`, `Infinity`, string no parseable → throw `MoneyInputError`.

```typescript
function toMoney(value: unknown): Decimal {
  if (value === null || value === undefined) throw new MoneyInputError('null/undefined');
  const d = new Decimal(value);
  if (d.isNaN()) throw new MoneyInputError(`NaN from ${value}`);
  if (!d.isFinite()) throw new MoneyInputError(`Infinity from ${value}`);
  return d;
}
```

### 2. NO overflow

Montos > 10 billones ARS rechazados explícitamente.

```typescript
const MAX_MONEY = new Decimal('9999999999999999.9999');
if (amount.gt(MAX_MONEY)) throw new MoneyOverflowError(amount);
```

### 3. NO mezcla de monedas

```typescript
function add(a: Money, b: Money): Money {
  if (a.currency !== b.currency) throw new MixedCurrencyError();
  return { value: a.value.plus(b.value), currency: a.currency };
}
```

(En F0 con ARS-only la check es trivial, pero el patrón queda preparado para F2+.)

### 4. NO Number en path money

Convención code review F0 (revisión humana en PR). Linter rule eslint custom **deferred F1+** con trigger: > 3 violaciones detectadas en review en 1 mes (señal de que el reviewer no escala).

### 5. NO comparación con operadores nativos

```typescript
if (price === otherPrice) ...  // ❌ MAL
if (price.eq(otherPrice)) ...  // ✅ BIEN
```

### 6. NO float JSON en boundary

Zod validator en input boundary:

```typescript
const PriceSchema = z.string().regex(/^\d+(\.\d{1,4})?$/);
// Recibe "1234.56" como string, NO 1234.56 como number
```

### Fuente normativa

**ADR-0005 sección "Money invariants" + CLAUDE.md §9.7.**

---

## TOLERANCE SEMANTICS

### Path fiscal AFIP

**TOLERANCIA 0.** La invariante WSFEv1 `ImpIVA == sum(Iva[].Importe)` con tolerancia 0 es exigencia técnica del WS.

```typescript
// Antes de enviar payload AFIP
const impIVA = payload.ImpIVA;
const ivaArraySum = payload.Iva.reduce((sum, x) => sum.plus(x.Importe), new Decimal(0));
if (!impIVA.eq(ivaArraySum)) {
  throw new FiscalProjectionError('ImpIVA mismatch');
}
```

### Path reconciliación interna

**Tolerancia configurable.** Helper `withinTolerance()`.

```typescript
function withinTolerance(a: Decimal, b: Decimal, scope: 'mp' | 'bank' | 'manual') {
  const tolerance = TOLERANCE_BY_SCOPE[scope];  // default $0.50
  return a.minus(b).abs().lte(tolerance);
}
```

| Scope | Madurez | Uso |
|---|---|---|
| `'mp'` | **F0 Required** (CAPABILITY-MAP C-OPS-12 — conciliación MercadoPago automática básica) | Tolerancia entre `mp_payments.amount` y `sales.total` al reconciliar webhook |
| `'manual'` | F0 | Ajustes manuales del operator con motivo obligatorio |
| `'bank'` | **F2+ deferred** (NON-GOALS — conciliación bancaria automática F2+) | Cuando aparezca trigger |

### Anti-pattern: tolerancia en path fiscal

```typescript
// ❌ ABSOLUTAMENTE PROHIBIDO
if (withinTolerance(payload.ImpIVA, sum, 'fiscal')) ...
```

No existe `'fiscal'` scope. NO mezclar.

### Fuente normativa

**ADR-0022 sección "Tolerance Semantics — ámbito definido".**

---

## VERSIONING

### Calculation engine version

Cada cálculo monetario persistido en `fiscal_snapshots` lleva `calculation_engine_version`:

```sql
fiscal_snapshots.calculation_engine_version varchar(20) NOT NULL  -- ej: '1.0.0'
```

Cambios al engine = bump de versión + ADR. Versiones previas se mantienen en code registry F0 (un único activo).

F1+ trigger: múltiples versiones cargadas para reproducir histórico de facturas viejas exactas.

### Tax policy version

Análogo: `tax_policy_version` (fecha o semver) persistido por factura.

Cambios en política tributaria AR (RG AFIP nueva, nueva alícuota) = bump.

### Reproducibilidad

```typescript
function reproduceInvoice(invoiceId): Payload {
  const snapshot = await getFiscalSnapshot(invoiceId);
  const engine = getEngineByVersion(snapshot.calculation_engine_version);
  const policy = getPolicyByVersion(snapshot.tax_policy_version);
  return engine.computeWithPolicy(snapshot, policy);
}
```

Test mensual F1+: tomar muestra de facturas y verificar `reproduceInvoice(id)` da idéntico.

### Fuente normativa

**ADR-0022 sección "Versioning".**

---

## PROJECTION LAYERS

```
modelo_per_line (TypeScript dominio) {
  items: [{ name, qty, unit_price, iva_rate, line_subtotal, line_iva, line_total }]
  discount_global,
  total
}
   ↓ projectToFiscalBreakdown(snapshot)  ← función pura testeada
fiscal_breakdown_per_bracket (FiscalBreakdown model) {
  brackets: [{ rate, base, importe_iva }]
  imp_neto, imp_iva, imp_op_ex, imp_total
}
   ↓ projectToWSFEv1(breakdown, snapshot)  ← función pura testeada
wsfev1_payload (AFIP shape) {
  ImpNeto, ImpIVA, ImpOpEx, ImpTotal,
  Iva: [{ Id, BaseImp, Importe }]
}
```

Cada proyección es función pura testeada con casos límite (multi-alícuota, exenciones TDF, descuentos, redondeo edge cases).

### Fuente normativa

**ADR-0022 sección "Projection: Fiscal Ticket Breakdown" + CLAUDE.md §8.2.**

---

## TESTS OBLIGATORIOS MONEY

Ver CLAUDE.md §9.9 — listado completo T-MONEY-01 a T-MONEY-07.

Resumen:

| Test | Verifica |
|---|---|
| T-MONEY-01 | Cálculo IVA per-line vs per-bracket en factura multi-alícuota + descuentos |
| T-MONEY-02 | Invariante `ImpIVA == sum(Iva[].Importe)` con tolerancia 0 |
| T-MONEY-03 | Cliente vs server discrepancia > $0.01 → server gana + log |
| T-MONEY-04 | Overflow check con monto extremo |
| T-MONEY-05 | HALF_EVEN behavior en casos límite (0.005, 0.015, 0.025, ...) |
| T-MONEY-06 | NO NaN propagation desde input inválido |
| T-MONEY-07 | Round-trip Decimal → string → Decimal sin pérdida |

---

## ANTI-PATTERNS PROHIBIDOS

Resumen rápido (detalle en CLAUDE.md §9.8 y §20.6, §20.15, §20.24):

- ❌ Aritmética con Number JS en path money
- ❌ Comparación con `==`/`===` entre Decimals
- ❌ `JSON.stringify(decimal)` directo
- ❌ `parseFloat(string)` en boundary money
- ❌ `toFixed(2)` para cálculo (es solo para presentation)
- ❌ Round intermedio múltiples veces (acumula error)
- ❌ Aritmética mixta Decimal/Number en una expresión
- ❌ UI calcula y envía "ya calculado" al server (server SIEMPRE recalcula)
- ❌ Tolerance en path fiscal AFIP

---

## Estado real al 2026-05-28

| Tema | Estado |
|---|---|
| Modo HALF_EVEN | 🟢 Cerrado (3 manuales oficiales AFIP) |
| Stage PER_LINE | 🟡 Propuesto, pendiente A-1 contador |
| Currency ARS-only F0 | 🟢 Cerrado |
| Storage `numeric(19,4)` | 🟢 Cerrado |
| Compute `Decimal.js` | 🟢 Cerrado |
| Client preview via Context | 🟢 Cerrado (ADR-0021) |
| Calculation engine versioning | 🟢 Cerrado (ADR-0022) |
| Tax policy versioning | 🟢 Cerrado (ADR-0022) |
| Tolerance scope definido | 🟢 Cerrado (ADR-0022) |
| Tratamiento contable centavos | 🟡 Pendiente contador |

---

## Mantenimiento

- **Si cambia política:** abrir ADR que reemplace al vigente + actualizar este doc + bump version header.
- **Trimestralmente:** revisar coherencia con ADRs vigentes.
- **Cuando se cierre A-1 contador:** actualizar Dimensión 2 + bump version.

---

## Cross-references

- [ADR-0005](files/ADR-0005-money-numeric-19-4.md) — política monetaria base
- [ADR-0021](files/ADR-0021-money-client-side.md) — money client-side
- [ADR-0022](files/ADR-0022-fiscal-projection-layer.md) — projection + versioning + tolerance
- [CLAUDE.md §9](CLAUDE.md) — Money Constitution
- [CAPABILITY-MAP.md](CAPABILITY-MAP.md) — C-COM-05 (descuentos), C-COM-06 (cobro), C-OPS-12 (conciliación MP), C-FIS-* (todas usan money)
- [BOUNDED-CONTEXTS.md](BOUNDED-CONTEXTS.md) — Money compute vive en Sales/Fiscal contexts; MoneyContext es Platform
- [OPERATIONAL-SEVERITY.md](OPERATIONAL-SEVERITY.md) — Money invariant violations son S0/S1 según dominio
- [EVENT-TAXONOMY.md](EVENT-TAXONOMY.md) — métricas `fiscal.rounding.delta_cents` + audit `system.price_tampering_attempt`
- [reunion-contador-y-abogado.md](reunion-contador-y-abogado.md) — pregunta A-1 stage + conciliación
- [NON-GOALS.md](NON-GOALS.md) — N-FEAT-06 multi-currency
- [DECISION-LEDGER.md](DECISION-LEDGER.md) — autoridad

---

*MONEY-POLICY.md v1.0.0 — 2026-05-28. Consolidación. El detalle vive en ADRs y CLAUDE.md.*
