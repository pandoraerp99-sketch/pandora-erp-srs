# ADR-0029 — Pedidos (encargos) con seña, y su plata en la caja

**Fecha:** 2026-11-18
**Estado:** Aprobado (por delegación de la misión del 2026-11-18: "asumí la dirección de producto"). **Pendiente de ratificación del owner** en los puntos marcados ⚠️.
**Reemplaza a:** —
**Relacionado:** ADR-0026 (corrección append-only de medio), ADR-0027 (cuenta corriente), ADR-0010 (idempotencia), ADR-0005 (money), EVENT-TAXONOMY v2.4.0, `pos-preview/PEDIDOS-SENAS-research.md`, `pos-preview/pedidos.html`, `pos-preview/pedidos-senados.html`.

## Contexto

La misión del 2026-11-18 puso como prioridad "la toma de pedidos, la caja y la fidelidad visual a los mockups". En los mockups, **Pedidos** es una pantalla propia (`pedidos.html`): el libro de **encargos** — el cliente pide algo que no se lleva hoy (no hay stock, es a medida, se trae del proveedor) y puede dejar una **seña**. El POS (venta en el momento) ya funcionaba de punta a punta; los pedidos no existían en el código.

Una seña es plata real que entra a la caja **fuera de una venta**. Si no queda atada a su pedido y a la sesión de caja, el arqueo deja de cerrar y nadie puede explicar por qué.

## Decisión

1. **Tres tablas** (migration 0043):
   - `orders`: encabezado. **Editable** mientras el pedido está vivo (un pedido es intención, como `tasks`); **no se borra**, se cancela (trigger). Número correlativo por comercio (`#0001`) con advisory lock por tenant + `UNIQUE (tenant_id, number)`.
   - `order_items`: líneas del catálogo o **libres** ("cortinado a medida"), cantidad decimal (metros). Se reemplazan enteras al editar; antes/después en `order.updated`.
   - `order_payments`: la plata. **Append-only** por trigger, igual que `sale_payments`. Tipo derivado, no elegido: el primer cobro es `sena`, el que deja el saldo en cero es `saldo`, el resto `parcial`.
   - FK compuestas `(id, tenant_id)` a clientes, productos, cajas y pedidos (patrón de la 0041): la **base** rechaza referencias a otro comercio.
2. **Todo cobro de pedido entra por una caja ABIERTA**, sea el medio que sea. El arqueo por medio (posnet, transferencias) también lo tiene que ver. Si no hay caja abierta, el cobro no se registra, y **el alta con seña falla entera**: no queda un pedido "con seña" cuya seña no está en ningún lado.
3. **La caja los lee de su tabla**, como a `sale_payments`: `computeCashBreakdown` suma `order_payments` con `method='efectivo'` al esperado (`orderPayments`). **No** se agrega un tipo a `cash_movements`: un cobro de pedido está atado a su pedido, no es un movimiento suelto del cajón, y así el `CHECK` de `cash_movements` no cambia.
4. **El total se calcula en el servidor** con Decimal.js, **HALF_EVEN por línea** (PER_LINE, ADR-0005) y se guarda en la misma transacción que las líneas. La pantalla previsualiza con la misma función (`domain/pedidos.ts`); el servidor recalcula siempre.
5. **Reglas de saldo:** no se cobra de más (saldo a favor no está modelado); editar no puede dejar el total por debajo de lo cobrado; **entregar exige saldo cero** ("Cobrar saldo y entregar" hace las dos cosas en una transacción).
6. **Concurrencia e idempotencia:** cada mutación toma el pedido `FOR UPDATE` antes de leer lo cobrado (dos cobros simultáneos no pasan los dos el chequeo de saldo); la caja se lee `FOR SHARE` (el cierre la toma `FOR UPDATE`, así un cobro no se cuela en una caja que se está cerrando). Alta, cobro y entrega van por `withIdempotency` (reserve-first, `releaseOnError`): un doble click o un reintento no duplican.
7. **Medios:** efectivo, débito, crédito, transferencia. **Sin `mp_qr`:** el cobro por QR todavía no se verifica contra MercadoPago (H-03), y anotar "pagó por QR" sin verificar es anotar plata que puede no haber entrado.
8. **Auditoría:** 4 eventos nuevos (EVENT-TAXONOMY v2.4.0): `order.created`, `order.updated`, `order.status_changed`, `order.payment.received`. ⚠️ El catálogo es cerrado: se agregaron por la delegación de la misión y **quedan pendientes de ratificación del owner**.
9. **Estados persistidos:** `tomado → en_preparacion → listo → entregado`, más `cancelado`. "Señado", "saldado" y "vencido" **no son estados**: se derivan de los cobros y de la fecha de retiro (día del comercio).

## Consecuencias

### Positivas
- El recorrido de mostrador queda completo: tomar el pedido, cobrar la seña, y encontrar ese cobro en `/caja` (lista, totales por medio, efectivo esperado y cierre).
- La pantalla y el cierre usan **la misma fórmula** del esperado. Al hacerlo aparecieron y se corrigieron dos errores previos de `/caja`: el esperado en pantalla no restaba los pagos a proveedor en efectivo ni sumaba los cobros de fiado, y los cobros de fiado figuraban como **egresos** con signo negativo.

### Negativas / trade-offs aceptados
- **Entregar NO convierte el pedido en venta**: no descuenta stock y no aparece en el CSV de ventas de la contadora. La plata sí está en la caja. Es la tanda siguiente y depende de A-32.
- **Cancelar un pedido con cobros está bloqueado**: devolver una seña es un egreso que necesita su propio movimiento (por la misma razón que dio el ADR-0027). Mientras tanto, la pantalla lo explica.
- **No se reserva stock** al tomar el pedido.
- **Descuentos** en pedidos: no implementados.

### Pendientes (reglas de negocio a confirmar)
- ⚠️ **A-32 (contadora):** la seña que congela precio perfecciona el hecho imponible (RG 707/1999, ver research). Hoy `price_freezes` **se guarda pero no dispara ningún comprobante**, y la pantalla lo dice. Hay que definir: comprobante de la seña, cómo se documenta seña ↔ saldo ↔ entrega, y TDF.
- ⚠️ **Precio del encargo:** el precio por línea es editable (un encargo se negocia) y no se compara contra el de lista. Si el owner quiere un tope o una marca de "precio distinto al de lista", es un cambio chico.
- ⚠️ **Devolución de seña** al cancelar: política comercial (¿se devuelve?, ¿en qué medio?) y movimiento de caja propio.
- ⚠️ **Conversión a venta** al entregar: cómo entra la seña ya cobrada sin contarse dos veces en la caja (la venta llevaría como pago sólo el saldo, o la seña aplicada como medio que no es efectivo).
- **Señas** (`pedidos-senados.html`) queda como vista filtrada del mismo libro, sin construir.

## Alternativas consideradas
- **Leer "pedido" como el carrito del POS:** descartada. La misión pide guardar, editar y revisar un pedido **antes** del cobro y vincular el cobro a él, y compararlo contra un mockup de Pedidos que existe. El POS ya hacía venta → cobro → caja.
- **Cobro de pedido como `cash_movements.type='order_payment'`:** descartada. Exige cambiar el `CHECK` y deja dos filas para un mismo hecho (el pago y el movimiento). Los pagos de venta ya viven en su tabla y la caja los lee; se replica eso.
- **Usar `customer_payment` / la cuenta corriente:** descartada. Una seña es plata **a favor** del cliente; meterla en el libro de deudas ensucia el reporte de deudores al cierre (ítem 5).

## Implementación
- Migration `drizzle/migrations/post_initial/0043_pedidos.sql` (+ `scripts/aplicar-0043.sh`).
- `src/lib/domain/pedidos.ts` (reglas puras), `src/lib/services/orders/order.service.ts` + `order.queries.ts`.
- `src/lib/cash/sessions.ts` (`computeCashBreakdown`, ahora en Decimal) y `queries.ts` (falla ante un tipo desconocido, como el cierre).
- Pantalla `/pedidos` (`src/app/pedidos/*`), `/caja` y Panel muestran los cobros.
- Tests: `T-PED-01` (13 casos de integración), `pedidos-dominio` (12 unitarios), `T-ROL-01` (+5 mutaciones), catálogo (57 eventos). Recorrido en navegador: `scripts/recorrido-pedidos.mjs`.

## Validación
🟡 — decisión interna implementada y probada; A-32 (contable) y la ratificación de los 4 eventos quedan abiertas.
