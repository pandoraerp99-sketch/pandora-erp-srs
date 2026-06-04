# ADR-0005 — Money: numeric(19,4) + Decimal.js + redondeo configurable

**Fecha:** 2026-05-17 (original) — actualizado 2026-05-26 (auditoría externa + investigación oficial AFIP)
**Estado:** Aprobado
- 🟢 **Dimensión 1 (modo de redondeo): CERRADA — HALF_EVEN** (confirmado por manuales oficiales AFIP/ARCA)
- 🟢 **Dimensión 2 (stage): PER_LINE propuesto** con flag configurable + tests WSFE homologación
- 🟡 **Conciliación contable de diferencias de centavos:** pendiente contador (tratamiento contable, no decisión normativa)

**Relacionado con:** ADR-0021 (money client-side), ADR-0022 (fiscal projection layer + snapshot), Sesión 5 v4 cambio #2, Sesión 5 v4 cambio #1 (commercial/fiscal status)

## Contexto

Necesitamos representación monetaria para totales, IVA, descuentos, percepciones. Opciones:

- **float / double:** rápido pero imprecisa para cálculos fiscales (drift de centavos).
- **numeric(12,2):** dos decimales, suficiente para presentación pero pierde precisión en cálculos intermedios.
- **numeric(19,4):** cuatro decimales (diezmilésimos), precisión exacta intermedia.
- **numeric(19,6) o (19,8):** mayor precisión para FX, impuestos compuestos, interés.

## Decisión

### Persistencia

**`numeric(19,4)` en DB para todos los campos monetarios.** El driver postgres-js devuelve `numeric` como `string` para evitar pérdida de precisión vía conversión a `number` JS.

```sql
-- Ejemplo schema
CREATE TABLE sales (
  total_amount numeric(19,4) NOT NULL,
  tax_amount numeric(19,4) NOT NULL,
  ...
);
```

### Cálculo en memoria

**Decimal.js como canonical type para toda aritmética monetaria.** Configuración:

```typescript
import Decimal from 'decimal.js';

Decimal.set({
  precision: 30,  // dígitos significativos durante cálculo intermedio
  // NO se configura `rounding` global. Se pasa policy explícita por llamada
  // a roundFiscal() — la decisión de redondeo es fiscal, no de motor de cálculo.
});
```

**Por qué `precision: 30` y no el default 20:** carritos con impuestos encadenados (IVA 21% + IIBB CABA + RG 2126 percepción) pueden agotar 20 dígitos significativos en cálculos intermedios antes de redondear. 30 da margen para ~5000 líneas con 5 niveles de impuesto.

**Por qué Decimal.js y no big.js (6KB) o bigint scaled:**
- Decimal.js tiene mejor API para redondeo configurable
- Soporte para precisión arbitraria + scale
- Ya es dependencia del cliente vía ADR-0021 (consistencia end-to-end)
- big.js es alternativa válida si bundle size se vuelve issue F1+ (ver triggers)

### Separación storage / compute / presentation

| Layer | Precisión | Tipo | Razón |
|---|---|---|---|
| **Storage (DB)** | `numeric(19,4)` | string al pasar por TS | Persistencia exacta, suficiente para 15 dígitos enteros + 4 decimales |
| **Compute (in-memory)** | `Decimal.js precision: 30` | `Decimal` | Margen para cálculos intermedios sin perder centavo |
| **Presentation (AFIP/UI)** | 2 decimales con redondeo `roundFiscal()` | string formato fijo | Lo que AFIP recibe y el cajero ve |

**Regla absoluta:** cálculos intermedios NUNCA persisten directo. Solo se persiste el resultado redondeado a `numeric(19,4)`. Si la operación es multi-paso, el resultado intermedio puede vivir en memoria con `precision: 30` y solo al final se reduce al storage scale.

### Política de redondeo — DOS dimensiones independientes

La política de redondeo tiene **dos dimensiones ortogonales** que se deciden por separado:

#### Dimensión 1 — Modo de redondeo (CÓMO) — 🟢 CERRADA: HALF_EVEN

**Decisión cerrada por documentación técnica oficial del ecosistema WSFEv1/COMPG (verificada 2026-05-26):**

| Modo | Comportamiento en `*.5` | Estado en Pandora |
|---|---|---|
| `HALF_UP` | redondea hacia arriba | ❌ no usado (contradice manuales técnicos oficiales) |
| `HALF_DOWN` | redondea hacia abajo | ❌ no usado |
| **`HALF_EVEN`** | **banker's rounding** | **✅ DEFAULT FISCAL (interoperabilidad AFIP/ARCA)** |

**Fuentes oficiales consultadas:**

| Manual | Cita literal |
|---|---|
| **Manual WSFEv1 COMPG v3.4.2** (oficial AFIP) | *"El criterio de redondeo que utilizamos en este servicio es Round Half Even."* |
| **Manual WSMTXCA v0.25.5** (oficial AFIP) | *"El método de redondeo a utilizar es Round Half Even."* |
| **Manual WSFEX v2.1.0** (oficial AFIP) | *"El criterio de redondeo que utilizamos en este servicio es Round Half Even."* |

**Naturaleza de la decisión (importante para evitar sobre-afirmación):**

Esta decisión es **técnica, no normativa legal**. Lo que se afirma con base sólida:

- HALF_EVEN es el criterio **explícitamente documentado** en los manuales técnicos oficiales utilizados por el ecosistema WSFEv1/WSMTXCA/WSFEX/COMPG.
- AFIP usa HALF_EVEN para sus validaciones internas dentro de esos web services.
- Por interoperabilidad técnica, el emisor (Pandora) **debe** usar HALF_EVEN para que `ImpIVA == sum(Iva[].Importe)` matchee con tolerancia 0.

Lo que **NO** se afirma (y nadie debería derivar de este ADR):

- ❌ "AFIP obliga legalmente HALF_EVEN en todo cálculo fiscal argentino" — NO está dicho así en ninguna norma textual.
- ❌ "Toda liquidación IVA argentina debe calcularse en HALF_EVEN" — es derivación, no regla textual.
- ❌ "Otro modo de redondeo es ilegal" — falso. El emisor puede internamente usar otro modo, pero entonces el payload AFIP necesita reconciliación adicional.

**La elección Pandora es:** evitar reconciliación adicional usando el mismo criterio que el proveedor documenta. Es ingeniería defensiva, no obligación normativa.

**Configuración default F0:**

```bash
# .env.example
MONEY_ROUNDING_MODE=HALF_EVEN
```

**Configurabilidad mantenida:** el flag sigue siendo configurable (`HALF_UP | HALF_DOWN | HALF_EVEN`) para:
- Tests que verifican comportamiento por modo
- Eventual cambio futuro de AFIP (poco probable pero no imposible)
- Comparación con datos de sistemas externos que usen otro modo

**Pero el default productivo es HALF_EVEN, no debate.**

**Lo que NO se confirmó oficialmente** (importante para evitar sobre-afirmar):
- "Toda liquidación IVA argentina debe calcularse en HALF_EVEN" — esto es derivación, NO regla textual
- El contador todavía debe confirmar tratamiento contable de diferencia de centavos cuando per-line ≠ per-total (ítem #3 de Pendientes)

#### Dimensión 2 — Stage de redondeo (CUÁNDO)

| Stage | Significado | Default propuesto F0 | Estado |
|---|---|---|---|
| **per-line** | redondear cada item antes de sumar | ✅ propuesto F0 (respaldo empírico) | 🟡 confirmar empíricamente con WSFE homologación |
| **per-tax-bracket** | redondear por alícuota agrupada (compatible con shape WSFEv1 array `Iva`) | alternativa válida | 🟡 fallback si per-line falla validación |
| **per-total** | calcular preciso, redondear solo el total final | ❌ NO recomendado | descartado por evidencia operacional |

**Ejemplo:** 3 items × $333.335 IVA discriminado pueden dar:
- per-line: round($333.335) × 3 = $333.34 × 3 = $1000.02
- per-total: 3 × $333.335 = $1000.005 → $1001.01 (HALF_UP) o $1000.00 (HALF_DOWN)

**Diferencia de centavos no es bug — es decisión técnica.**

### Evidencia empírica y exigencia AFIP real

**Investigación 2026-05-26 (research fuentes oficiales):**

AFIP/ARCA **NO publica regla textual única** que diga "el IVA se redondea por línea" o "solo sobre el total". Lo que SÍ exige el WSFEv1 documentado:

> `ImpIVA` (header del comprobante) debe coincidir **exactamente** con la suma de los `Importe` del array `Iva` por alícuota. Tolerancia a diferencia: **0 centavos**.

Esa es **la única exigencia técnica de AFIP en materia de redondeo IVA**. Todo lo demás es decisión interna del emisor, validada empíricamente contra WSFE homologación.

**Implicancia:** el stage de redondeo es decisión técnica del emisor, NO normativa textual de AFIP. Pero el resultado debe satisfacer la **invariante de consistencia interna**:

```
ImpIVA == sum(iva.Importe for each iva in Iva[])
```

**Fuentes consultadas:**

| Fuente | Aporta |
|---|---|
| Manual WSFEv1 oficial ARCA/AFIP | Validación de `ImpIVA` exacta vs `Iva[].Importe`. Tolerancia 0. |
| ARCA/AFIP micrositio FE | No regla explícita sobre stage |
| Normativa AFIP/ARCA FE pública | No regla explícita sobre stage |
| WNPower — error WSFE redondeo IVA | Confirma que problema de centavos por acumulación de rounding es **conocido en producción real**; muchas implementaciones hacen per-line antes de sumar |
| Afip SDK + ARCA SDK ejemplos | Implementaciones de referencia usan per-line o per-bracket |

### Default operativo F0: PER-LINE con flag

**Decisión:** F0 arranca con `MONEY_ROUNDING_STAGE=PER_LINE` por:

1. **Respaldo empírico:** documentación operacional (WNPower) confirma que es el patrón más común para evitar diferencias de centavos.
2. **Compatibilidad shape WSFEv1:** WSFEv1 acepta array `Iva` por alícuota — per-line es trivial de agrupar a per-bracket en el payload final.
3. **Determinismo:** el cajero ve el mismo total que el comprobante final. Per-total puede crear discrepancia visible.
4. **Fallback fácil:** si tests WSFE homologación rechazan per-line con caso real, switch a per-bracket es cambio de flag, no refactor.

**Flag implementado:** `MONEY_ROUNDING_STAGE=PER_LINE | PER_TAX_BRACKET` con fail-fast paralelo a `MONEY_ROUNDING_POLICY`.

### Bloqueante para F0 productivo

Antes del primer cliente facturando con AFIP **producción** (no homologación), se requiere:

#### 1. ~~Confirmación del modo (Dimensión 1)~~ ✅ CERRADO 2026-05-26

Decisión cerrada por documentación oficial AFIP/ARCA (3 manuales). Ver tabla arriba.

#### 2. Validación empírica del stage (Dimensión 2) — tests WSFE homologación

Suite de tests obligatoria contra WSFE homologación con casos límite:
- 3 items × $333.335 con IVA 21% (caso clásico de centavo)
- Items con cantidades fraccionales (0.5 kg, 1.25 m)
- Comprobante multi-alícuota (líneas con 21% + 10.5% + 27%)
- Producto exento mezclado con gravado
- Descuentos por línea + descuento global

Cada test verifica: AFIP acepta el comprobante **Y** `ImpIVA` recibido == calculado.

Si todos los tests pasan con `PER_LINE`: stage queda confirmado.
Si algún test falla por inconsistencia: switch a `PER_TAX_BRACKET` y re-correr.

#### Bloqueante para F0 productivo

Ambas dimensiones deben quedar cerradas por contador matriculado antes del primer cliente facturando. Output esperado:
- Modo seleccionado + respaldo normativo (RG AFIP número/año o cita Código Fiscal)
- Stage seleccionado + ejemplo numérico validado
- Implementación: flag env + función `roundFiscal(value, decimals, policy, stage?)`

### Cálculo IVA (dependencia de Dimensión 2)

Según stage decidido:

```typescript
// Stage per-line (criterio primario propuesto)
function calculateInvoiceTotals(items: Item[], policy: RoundingPolicy) {
  const linesRounded = items.map(item => {
    const lineSubtotal = new Decimal(item.price).times(item.quantity);
    const lineIVA = lineSubtotal.times(item.taxRate);
    return {
      ...item,
      subtotal: roundFiscal(lineSubtotal, 2, policy),
      iva: roundFiscal(lineIVA, 2, policy),
    };
  });
  const totalSubtotal = linesRounded.reduce((acc, l) => acc.plus(l.subtotal), new Decimal(0));
  const totalIVA = linesRounded.reduce((acc, l) => acc.plus(l.iva), new Decimal(0));
  return { totalSubtotal, totalIVA, total: totalSubtotal.plus(totalIVA) };
}
```

Stage per-tax-bracket agrupa por `taxRate` y redondea el subtotal del grupo. Implementación alternativa lista para cuando contador confirme.

### Currency — F0 ARS only

**F0 y F1: ARS exclusivamente.** No hay soporte para multi-currency. Las consecuencias:

- No hay columna `currency_code` en tablas monetarias F0
- No hay tabla `fx_rates`
- No hay FX snapshot por venta
- No hay precision-per-currency

**F2+:** evaluar multi-currency si aparece demanda real. El refactor implicará:
- Agregar `currency_code` NOT NULL a `sales`, `invoices`, etc.
- Tabla `fx_rates` con snapshot histórico
- Money invariants: validar `currency_code` match en operaciones aritméticas

**Trigger para promover:** 3+ clientes piden facturación USD/USDT en 6 meses **O** regulación AFIP cambia y exige multi-currency.

## Invariants

Toda operación monetaria debe respetar estos invariantes. Implementar como type guards o runtime asserts:

1. **NO sumar monedas distintas.** F0 ARS only — pero el wrapper debe ser preparado para validar `currency_code` cuando se agregue.
2. **NO persistir `number` JS.** Solo `string` (que el driver convierte a numeric) o `Decimal`.
3. **NO redondear silenciosamente.** Cualquier `toFixed()` o redondeo implícito está prohibido — usar `roundFiscal()` explícito.
4. **NO permitir NaN ni Infinity.** Validar con `Decimal.isNaN()` y `Decimal.isFinite()` antes de persistir.
5. **NO permitir overflow.** `numeric(19,4)` = 15 dígitos enteros máximo. Si excede `Number.MAX_SAFE_INTEGER` post-redondeo, throw.
6. **NO permitir money negativo accidental.** Validar `value >= 0` salvo en casos explícitos (refunds, NC). Cuando el caso lo permita, exigir un flag `allowNegative: true` en la API del wrapper.
7. **NO divide-by-zero.** Validar divisor !== 0 antes de operar.
8. **NO mezclar layers.** Cálculo intermedio en `Decimal`, persistencia en string `numeric(19,4)`, AFIP en string 2 decimales. Cada layer tiene tipo distinto.

```typescript
// Ejemplo: wrapper con invariants
export class Money {
  private constructor(private readonly value: Decimal, public readonly currency: string = 'ARS') {
    if (value.isNaN()) throw new MoneyInvariantError('NaN not allowed');
    if (!value.isFinite()) throw new MoneyInvariantError('Infinity not allowed');
    if (value.abs().gt('9999999999999.9999')) {
      throw new MoneyInvariantError('Exceeds numeric(19,4) range');
    }
  }

  static from(value: string | Decimal, currency: string = 'ARS'): Money {
    return new Money(value instanceof Decimal ? value : new Decimal(value), currency);
  }

  plus(other: Money): Money {
    if (this.currency !== other.currency) {
      throw new MoneyInvariantError(`Cannot add ${this.currency} + ${other.currency}`);
    }
    return new Money(this.value.plus(other.value), this.currency);
  }

  divide(divisor: Decimal | string | number): Money {
    const d = new Decimal(divisor);
    if (d.isZero()) throw new MoneyInvariantError('Division by zero');
    return new Money(this.value.div(d), this.currency);
  }

  // ... etc
}
```

## Alternativas rechazadas

- **Float / double:** rechazado. Drift en cálculos fiscales es inaceptable.
- **`numeric(12,2)` storage:** rechazado. Pierde precisión intermedia.
- **bigint scaled:** rechazado. API menos clara que Decimal.js, manejo de scale propenso a errores.
- **Money library hand-rolled:** rechazado. Decimal.js está battle-tested y mantenida.
- **Configurar `Decimal.set({ rounding })` global:** rechazado. Cierra silenciosamente decisión 🟡 pendiente contador.

## Consecuencias

**Positivas:**
- Precisión exacta end-to-end (cliente ADR-0021 + servidor ADR-0005).
- Compatible con cualquier modo de redondeo (HALF_UP/DOWN/EVEN) sin refactor.
- Compatible con cualquier stage (per-line/per-bracket/per-total).
- Invariants previenen clase entera de bugs (NaN, overflow, mezcla monedas).

**Negativas:**
- Decimal.js agrega ~30KB gzipped al bundle del cliente. Ya aceptado en ADR-0021.
- Margen de cálculo `precision: 30` es overkill para casos simples. Acepted trade-off por consistency.

**Riesgos a monitorear:**
- Bug fiscal real detectado en producción → auditar paths que no usan `roundFiscal()`.
- Diff cliente vs server > $0.01 reportado → fix inmediato + test que lo previene.
- Performance: Decimal.js es ~10x más lento que float JS. Imperceptible en POS (sub-milisegundo por operación), pero monitorear si aparece en hot path crítico.

## Triggers de re-evaluación

| Trigger | Acción |
|---|---|
| Contador confirma modo + stage de redondeo | Cerrar 🟡 → 🟢 + actualizar este ADR + flag env productivo |
| Bug fiscal en producción por redondeo | Auditar + test de regresión |
| Bundle cliente > 250KB gzipped | Evaluar big.js (6KB) como reemplazo (impacta ADR-0021) |
| Carritos > 1000 líneas reales | Verificar `precision: 30` alcanza, sino subir a 50 |
| Demanda multi-currency (3+ clientes en 6m) | Promover currency a feature F2+ con refactor planeado |
| AFIP publica norma específica sobre stage de redondeo | Actualizar ADR + ajustar flag |

## 🟡 Pendiente de validación humana (reducido)

Cierres aplicados 2026-05-26:
- ✅ Dimensión 1 (modo) cerrada a HALF_EVEN por 3 manuales oficiales AFIP
- ✅ Dimensión 2 (stage) propuesta PER_LINE con tests WSFE homologación como validación

**Solo queda pendiente contador:**

1. **Conciliación contable de diferencias de centavos.** Cuando per-line HALF_EVEN suma $1000.02 pero per-total HALF_EVEN da $1000.01:
   - La invariante AFIP `ImpIVA == sum(Iva[].Importe)` resuelve el payload técnico
   - Pero ¿cómo se trata contablemente la diferencia? ¿Asiento de ajuste por "diferencia de redondeo"? ¿Se acepta como tradicional sin ajuste?

2. **Confirmación de aplicabilidad a régimen del comerciante.** ¿El comerciante target (kiosco/mercería/panadería) usa exclusivamente WSFEv1 o eventualmente WSMTXCA / WSFEX?
   - F0 asume WSFEv1 exclusivamente
   - Pendiente confirmar que ningún cliente target necesita otro WS

3. **Tratamiento Tierra del Fuego (Ley 19.640).** Si algún cliente target opera en TDF, requiere análisis específico de régimen especial. (No urgente F0 — target inicial es CABA + GBA + ciudades grandes.)

Ver `reunion-contador-y-abogado.md` (Parte A — Contador) para guion de reunión actualizado y `backlog-validaciones.md` para items relacionados.
