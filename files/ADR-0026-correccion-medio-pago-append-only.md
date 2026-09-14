# ADR-0026 — Corrección de medio de pago (reclasificación append-only)

**Fecha:** 2026-07-13
**Estado:** Aprobado
**Reemplaza a:** —
**Relacionado:** ADR-0010 (idempotency), A-26 (taxonomía débito/crédito, RESUELTO 2026-07-12), CLAUDE.md §16.5 (append-only), §20.5 (mutable audit log anti-pattern)

## Contexto

El cajero puede clasificar mal el medio de pago de una venta (caso real del owner:
"una clienta abonó en efectivo y la venta quedó marcada como débito"). Como el arqueo
de caja separa efectivo/débito/crédito (A-26) y el cierre deriva el efectivo esperado
de `sale_payments` (filas con `method='efectivo'` y `cash_session_id` de la sesión),
una mala clasificación produce un descuadre igual-y-opuesto (falta en efectivo, sobra
en el otro medio) que hoy no se puede corregir salvo dejarlo asentado en el motivo de
descuadre del cierre.

**Mitigación previa ya aplicada (commit 8ae4a98):** el POS ahora captura el medio
correcto en el punto de venta (selector efectivo/débito/crédito/QR). Esto vuelve la
mala clasificación **rara**, pero no imposible (el cajero puede elegir mal el chip).

**Restricción dura descubierta:** `sale_payments` está documentada **append-only**
en su propio schema (`src/lib/db/schema/sale_payments.ts`: "sale_payments NUNCA
UPDATE/DELETE", CHECK `amount > 0` que impide filas compensatorias negativas, y
rechazo explícito del patrón INSERT-inverso). Además hay un **trigger de
inmutabilidad real** (`sale_payments_immutable`, migración post_initial 0008) que
**bloquea UPDATE/DELETE/TRUNCATE a nivel DB** — o sea, mutar `method` con un `UPDATE`
ni siquiera es posible; el motor lo rechaza. El append-only no es solo intención
documentada: está enforced. Cualquier corrección debe ser **INSERT-only**.

## Decisión

Implementar la corrección de medio como un **evento append-only**, sin `UPDATE` sobre
las columnas financieras de `sale_payments`.

### 1. Modelo de datos: `corrects_id` (auto-referencia)

Se agrega a `sale_payments` una columna **`corrects_id uuid NULL`** con FK a
`sale_payments.id` (misma tabla). Semántica:

- Una corrección es una **fila NUEVA** de `sale_payments` con: mismo `sale_id`, mismo
  `amount`, el `method` corregido, el `cash_session_id` correcto para el nuevo método,
  y `corrects_id = <id de la fila original>`.
- La fila original **nunca se toca** (ni `method`, ni `amount`, ni `cash_session_id`,
  ni marcador). Sus columnas financieras quedan inmutables por diseño.
- **"Activo" = fila que nadie corrige.** Una fila `p` está superseded si existe otra
  fila `c` con `c.corrects_id = p.id`. No se persiste ningún flag "superseded" — se
  deriva. Esto logra **cero UPDATE** sobre `sale_payments`.
- Cadena de correcciones: si una corrección se vuelve a corregir, se apunta a la
  última fila activa. Siempre hay a lo sumo una fila activa por cadena.

Ventaja de auditabilidad: la historia completa queda visible ("originalmente débito,
reclasificado a efectivo por el usuario X el T"), **más** auditable que una mutación.

### 2. `cash_session_id` de la fila corregida

- Si `new_method = 'efectivo'` y hay una sesión de caja **abierta** en el punto de
  venta → `cash_session_id = <sesión abierta>` (para que el efectivo cuente en el
  cierre de esa sesión).
- En cualquier otro caso → `cash_session_id = NULL` (débito/crédito/QR no tocan el
  cajón).

### 3. Alcance: solo sesión ABIERTA + venta de esa sesión

La reclasificación solo se permite si:
- Existe una sesión de caja **abierta** en el punto de venta, y
- La venta fue finalizada **durante** esa sesión (`sales.finalized_at >=
  session.opened_at` y la sesión sigue abierta).

Correcciones sobre ventas de sesiones ya cerradas **NO** se permiten en F0 (el cierre
ya consolidó el descuadre con su motivo; reabrir contabilidad cerrada es F1+ con su
propio flujo). Es un `ReclassifyValidationError('session_closed_or_mismatch')`.

### 4. Derivación del cierre excluye superseded

`computeExpectedAmountFromActivity` (y cualquier lectura de efectivo por sesión) suma
solo filas **activas**:

```
Σ sale_payments.amount
  WHERE cash_session_id = X AND method = 'efectivo'
    AND NOT EXISTS (SELECT 1 FROM sale_payments c WHERE c.corrects_id = sale_payments.id)
```

Así la fila original mal clasificada (si era efectivo y pasó a otro medio) deja de
sumar, y la fila corregida (si pasó a efectivo) suma — cerrando el descuadre
igual-y-opuesto que el owner describió.

### 5. Denormalizado `sales.payment_method`

Tras la corrección se recomputa desde las filas **activas** de la venta: si hay un
solo método activo → ese; si hay 2+ métodos distintos → `'mixto'`. Se hace `UPDATE`
de `sales.payment_method` (columna denormalizada/cache, **sin** trigger de
inmutabilidad — el trigger de `sales` solo congela `customer_*_snapshot`). El arqueo
"Últimos movimientos" (que lee `sales.payment_method`) queda correcto sin más cambios.

### 6. Auditoría obligatoria

Cada reclasificación emite `cash.payment_reclassified` (nuevo evento, severity `info`)
en `audit_log` con payload: `sale_id`, `original_payment_id`, `correction_payment_id`,
`from_method`, `to_method`, `amount`, `reason` (motivo obligatorio, defensa anti
mutable-audit igual que cash_movements). Se agrega al catálogo EVENT-TAXONOMY.

### 7. Idempotency

La server action acepta `idempotency_key` (ADR-0010): un doble-click no crea dos
filas de corrección para el mismo pago.

## Consecuencias

### Positivas
- Invariante append-only de `sale_payments` **respetado** (cero UPDATE sobre columnas
  financieras; solo INSERT + UPDATE del cache denormalizado en `sales`).
- Auditabilidad **mejor** que una mutación: la cadena de correcciones es historia.
- El cierre refleja la corrección automáticamente (deriva de filas activas).

### Negativas / trade-offs aceptados
- Toda lectura de "medio efectivo por sesión" debe filtrar superseded (un `NOT EXISTS`
  extra). Hoy hay un único punto (`computeExpectedAmountFromActivity`); si aparecen
  más, extraer un helper `activeSalePaymentsFilter`.
- Índice nuevo sobre `corrects_id` para que el `NOT EXISTS` sea barato.

### Pendientes
- Correcciones sobre sesiones cerradas → F1+ (fuera de alcance).
- Reparto multi-medio estilo lisCobro (v20) en el POS → slice de UI posterior.

## Alternativas consideradas

- **UPDATE directo de `method`:** rechazada — erosiona el invariante documentado
  append-only de un registro financiero (§20.5).
- **Fila compensatoria con `amount` negativo / void + reissue:** rechazada — el CHECK
  `amount > 0` y el comentario del schema rechazan explícitamente el INSERT-inverso.
- **Flag `superseded_at` en la fila original:** rechazada — requiere `UPDATE` sobre
  `sale_payments`; el modelo `corrects_id` deriva "activo" sin tocar la fila original.
- **Tabla separada `sale_payment_corrections`:** viable pero agrega una tabla y un JOIN
  en cada lectura; `corrects_id` en la misma tabla es más simple y unifica el modelo
  (una corrección ES un pago).

## Validación

🟢 cerrado — decisión técnica de producto. A-26 (taxonomía) ya resuelta por
investigación. No requiere validación de contadora (la forma de pago no viaja en el
CAE; es concern de caja/conciliación, no fiscal).
