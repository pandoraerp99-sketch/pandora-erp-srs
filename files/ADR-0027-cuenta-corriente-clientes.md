# ADR-0027 — Cuenta corriente de clientes (libro append-only)

**Fecha:** 2026-09-05
**Estado:** Aprobado
**Reemplaza a:** —

## Contexto

Hasta ahora Pandora no tenía forma de registrar que un cliente **se lleva mercadería y paga después** — el "fiado" de toda la vida, que en un comercio de barrio no es una excepción sino parte del negocio diario.

La maqueta `pos-preview/clientes-v6.html` muestra una columna **Cta. corriente** y un KPI **Por cobrar**, y el owner los pidió explícitamente. No se podían implementar porque no existía el dominio: no hay dónde anotar la deuda ni cómo cancelarla.

**Hallazgo previo que condiciona el diseño.** Al analizar la integración con caja apareció que `computeExpectedAmountFromActivity` (el cálculo del monto esperado al cerrar) iteraba los movimientos de caja y **descartaba en silencio** los tipos que no conocía, con un comentario que decía *"type fuera del enum: ignorado"*.

Eso convertía cualquier tipo de movimiento nuevo en un **descuadre invisible**: el cliente paga su cuenta en efectivo, la plata entra al cajón, y el arqueo no la cuenta. El cajero ve una diferencia y no tiene forma de explicarla.

## Decisión

### 1. El cierre de caja falla fuerte ante un tipo desconocido

`computeExpectedAmountFromActivity` **lanza** `CashValidationError('unknown_movement_type')` en vez de ignorar. Un tipo que la fórmula no contempla significa que el catálogo creció y el cálculo no se actualizó — es exactamente el momento de frenar (CLAUDE.md §13.9, fail-closed en path crítico).

Se aplica **antes** que el resto de este ADR, y vale por sí solo.

### 2. La deuda es un LIBRO, no un campo

Tabla `customer_account_movements`, **append-only** como `stock_movements` y `sale_payments`:

| Tipo | Qué es | Signo |
|---|---|---|
| `charge` | Venta a cuenta corriente | aumenta la deuda |
| `payment` | El cliente paga | reduce la deuda |
| `adjustment` | Corrección con motivo obligatorio | cualquiera |

**NO existe `customers.saldo`.** El saldo es `sum(charge) − sum(payment) ± adjustment`, calculado. Un saldo denormalizado y un libro divergen, y cuando divergen nadie puede decir cuál tiene razón (CLAUDE.md §20.26 — duplicated source of truth).

### 3. La venta a cuenta corriente es un medio de pago más

Se agrega `cuenta_corriente` a `SALE_PAYMENT_METHODS`. Consecuencias:

- El cierre de caja **ya la excluye correctamente** sin tocar nada: filtra `method='efectivo'`.
- `sales` sigue siendo el registro único de lo que se vendió.
- El **pago mixto sigue funcionando**: mitad efectivo, mitad fiado es un caso real y frecuente.
- El `charge` del libro se deriva de esa fila de `sale_payments`.

### 4. El cobro de la deuda distingue si es plata del cajón

El movimiento `payment` lleva su **medio de pago**. Sólo el efectivo entra a la caja:

- **Efectivo** → además genera un `cash_movements` de tipo `customer_payment` ligado a la sesión abierta, y el cierre lo suma. Misma regla que ya usa `sale_payments.cash_session_id`.
- **Transferencia / tarjeta** → NO toca la caja. Si todo cobro fuera a `cash_movements`, el arqueo contaría plata que nunca entró al cajón.

**No se reusa `deposit`.** Un depósito genérico y un cliente pagando su cuenta son eventos distintos con significado distinto en la auditoría; mezclarlos hace el arqueo inexplicable (*"¿de dónde salieron estos $50.000?"*).

### 5. Pagos parciales, por construcción

*"Te pago $20.000 de los $50.000"* es el caso normal, no el borde. El libro lo maneja solo. **No se agrega un flag `pagado/impago`** a la venta: obligaría a decidir qué hacer con los parciales y sería otra fuente de verdad.

## Consecuencias

### Positivas
- El saldo siempre se puede reconstruir y auditar movimiento por movimiento.
- Los pagos parciales y los mixtos funcionan sin casos especiales.
- El arqueo cuenta el efectivo cobrado de cuentas corrientes, y sólo ése.
- El fail-loud del punto 1 protege a **cualquier** tipo de movimiento futuro, no sólo a éste.

### Negativas / trade-offs aceptados
- Calcular el saldo requiere agregar el libro. A volumen F0 es irrelevante; si algún día pesa, se cachea con un materialized view — **nunca** con una columna que se actualiza a mano.
- El fail-loud puede romper el cierre si alguien agrega un tipo sin actualizar la fórmula. **Es a propósito**: mejor un cierre que no cierra que un descuadre silencioso.

### Fuera de alcance (deliberado)
Límite de crédito, antigüedad de saldos (los "45 días" de la maqueta), intereses por mora, y resúmenes de cuenta. Ninguno hace falta para que el comercio pueda fiar y cobrar.

## Alternativas consideradas

| Alternativa | Por qué se rechazó |
|---|---|
| Columna `customers.saldo` actualizada en cada operación | Diverge del libro y no hay forma de saber cuál es correcto |
| Cobro como `cash_movements` tipo `deposit` | Pierde el significado: un arqueo con depósitos genéricos no se puede explicar |
| Todo cobro va a `cash_movements` | El arqueo contaría transferencias y tarjetas, que no son plata del cajón |
| Flag `pagado` en la venta | No soporta pagos parciales, que son el caso común |

## Validación

🟢 Decisión interna. **No es fiscal**: la forma de pago no viaja en el CAE de B/C, igual que en ADR-0026.

⚠️ **Pendiente contadora:** si una venta a cuenta corriente se factura al momento de la entrega (lo esperable) o al cobro. La hipótesis implementada es **al entregar**, que es lo conservador y lo que hace hoy el sistema. Va como pregunta al guion.

## Relacionado
- ADR-0026 — corrección de medio de pago append-only (mismo patrón de libro)
- CLAUDE.md §13.9 fail-closed · §20.26 duplicated source of truth
- `RESEARCH`: `pos-preview/CLIENTES-research.md`
