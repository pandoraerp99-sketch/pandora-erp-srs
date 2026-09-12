# Research Brief — `compras de mercadería y lotes`

**Fecha:** 2026-09-11
**Estado:** 🧩 diseño
**Autor:** sesión Claude Opus 5 (con Agus)
**Relacionado:** EVIDENCIA-pedido-contadora ítem 8 · `RESEARCH-BRIEF-gastos.md` · ADR-0027 (libro append-only, el saldo se calcula) · ADR-0026 (`corrects_id`) · migration 0032 (`stock_movements.direction`) · CLAUDE.md §5.2

> Metodología obligatoria antes de programar (memoria `feedback-investigar-referencias-siempre`).

---

## 1. Objetivo del módulo

Que una compra de mercadería registre **qué entró, cuánto y a qué costo**, y no
sólo cuánta plata salió — para poder contestar el ítem 8 del pedido de la
contadora: *"Inventario de bienes de cambio VALORIZADO al cierre (fecha adq.,
detalle, importe de compra)"*.

## 2. Problema de negocio

La contadora pide, para el cierre del 31/07, el inventario valorizado **con la
fecha de adquisición y el importe de compra**. Eso es un modelo **por lote**: no
alcanza con `products.cost`, que es un único valor "el costo de hoy" y se pisa
cada vez que el proveedor aumenta.

Hoy el ítem 8 figura como 🟡 *"Casi"*. La mitad que falta es exactamente ésta.

### Sobre el scope F0

CLAUDE.md §5.2 no lista compras en F0, y el comentario de
`stock_movements.related_purchase_id` dice *"F1+ cuando exista módulo compras"*.
No se está saltando la regla: la memoria `proposito-real-app-para-la-novia`
establece que las fases son **orden técnico**, no gates de clientes, y que la
lista de la contadora **es** la especificación. El owner lo autorizó
explícitamente en esta sesión. Se deja dicho acá para que un lector futuro no
encuentre una contradicción aparente.

## 3. Investigación (fuentes)

### 3.1 La fuente más fuerte es el pedido, y ya está en la mano

`EVIDENCIA-pedido-contadora-2026-09.md` ítem 8, textual: *"fecha adq., detalle,
importe de compra"*. Y el análisis del propio doc (líneas 146-147): *"pide fecha
de adquisición e importe de compra, **no el costo actual**. Es un modelo por
lote, no por producto."*

No hace falta adivinar el requerimiento. Investigación externa acotada, como
pide la metodología (proporcional).

### 3.2 Lo que YA existe en el código — medido, no supuesto

Esto es lo que más cambia el diseño, y no lo sabía al empezar:

| Pieza | Estado | Dónde |
|---|---|---|
| Proveedor como entidad (razón social + CUIT) | ✅ existe | `terceros` con `type='proveedor'` |
| Comprobante de compra pagado (fecha, neto/iva/total, tipo y número, medio de pago) | ✅ existe | `expenses`, **con `categoria='mercaderia'` ya en el CHECK** |
| Impacto en caja si se pagó en efectivo | ✅ existe | `expenses.cash_movement_id` |
| Movimiento de stock de entrada con signo | ✅ existe | `stock_movements` `type='purchase'` + `direction` (migration 0032, hoy) |
| **Qué productos y a qué costo unitario entró** | ❌ **falta** | — |

Medido: hay **1 gasto `mercaderia` de $257.000** cargado y **cero movimientos
`type='purchase'`**. O sea: **el lado plata de una compra ya funciona; lo que no
existe es el puente al stock.**

⚠️ Corrección al registro anterior: en el commit `65aa0ae` escribí *"no existe
camino de compras"*. Es cierto sólo para los **movimientos de stock**. El lado
plata existe hace rato. La afirmación sin matizar induce a reconstruir algo que
ya está.

### 3.3 Estado del arte — cómo se modela el consumo de lotes

Dos familias, y la diferencia es si el remanente se **guarda** o se **deriva**:

- **Capas materializadas (FIFO cost layers).** Cada recepción crea una capa con
  su costo y una cantidad remanente **mutable**, que se va descontando con cada
  salida. Es lo que hacen Oracle Cost Management y la mayoría de los IMS.
- **Derivación hacia atrás.** Bajo PEPS, *"las capas que quedan en inventario son
  siempre las compras más recientes"* — porque las viejas se vendieron primero.
  Con el stock actual y la lista de compras ordenada por fecha se reconstruye
  qué lotes quedan, **sin guardar remanente**.

Las dos dan el mismo número bajo PEPS. La segunda evita una columna mutable.

## 4. Síntesis — ¿qué incorporamos?

- El **lote es la línea de una compra**: producto + cantidad + costo unitario,
  colgando de un comprobante que ya tiene fecha, proveedor e importe.
- La valuación al cierre se **deriva**, no se materializa (§8).
- La **fecha de adquisición** que pide la contadora es la `fecha` del gasto, que
  ya se carga.

## 5. Ideas — qué hacemos distinto

1. **No inventamos el comprobante de compra: ya lo teníamos.** Una compra de
   mercadería es un gasto `categoria='mercaderia'` **con líneas**. Todo lo que
   una tabla `purchases` tendría en su cabecera —fecha, proveedor con CUIT,
   tipo y número de comprobante, neto/IVA/total, medio de pago, el asiento de
   caja— ya está en `expenses`. Duplicarlo obligaría además a decidir si una
   compra *también* genera un gasto.
2. **El remanente se calcula, nunca se guarda.** Mismo principio que ADR-0027
   ("el saldo se CALCULA") y que el ledger de stock. Una columna
   `remaining_qty` mutable sería la única pieza editable en un módulo donde
   todo lo demás es append-only.
3. **El método de valuación se dice en el reporte, no se esconde.** Ver §7.

## 6. Lo que se descubrió y no estaba en el plan

### 🔴 6.1 El camino de corrección declarado NO funciona

`RESEARCH-BRIEF-gastos.md` §7 dice: *"Append-only... corregir es registrar un
gasto de ajuste, no editar."* Verificado: `expenses` tiene triggers
`expenses_no_update` / `expenses_no_delete` y el UPDATE efectivamente falla.

Pero `expenses_importes_check` exige **`total > 0`**. O sea que **un gasto de
ajuste negativo es imposible**: se puede corregir hacia arriba, nunca hacia
abajo. Hoy un gasto cargado de más **no se puede corregir por ningún camino**.

Es un hueco **preexistente en gastos**, no lo introduce este módulo. Pero acá
pesa más: un comprobante mal tipeado corrompería justo el reporte que la
contadora va a usar.

**El patrón para arreglarlo ya está decidido en este proyecto**: ADR-0026,
`corrects_id` self-ref + las consultas excluyen las filas superseded. Sin
negativos y sin UPDATE.

### ⚠️ 6.2 `related_purchase_id` nombra algo que no va a existir

`stock_movements.related_purchase_id` es un uuid sin FK, con el comentario *"F1+
cuando exista módulo compras"*. Si el lote es un gasto, apuntar esa columna a
`expenses.id` deja **un nombre de columna que miente sobre a qué referencia** —
la misma clase de problema que los dos comentarios que corregí hoy, pero más
difícil de ver porque está en el schema. Se decide en §8 y no se dejan las dos.

### ⚠️ 6.3 `inferDirection` contradice al catálogo en `return`

`_common.ts` documenta *"return: retorno (sale → return invierte stock, **o
purchase → return descuenta**)"*, pero `inferDirection` devuelve siempre `'in'`
para `return`. Una devolución a proveedor **suma** stock según el código y
**resta** según el comentario. Hoy no rompe nada (nadie emite `return`), pero
queda anotado: es exactamente el tipo de inconsistencia latente que este commit
vino a cerrar en el hermano de al lado.

## 7. Qué NO vamos a implementar

| No | Por qué |
|---|---|
| **Tabla `purchases` separada** | Duplicaría toda la cabecera que `expenses` ya tiene (§5.1). |
| **Capas con `remaining_qty` mutable** | Da el mismo número que derivar y rompe el append-only (§5.2). |
| **Elegir el método de valuación (PEPS / UEPS / promedio / costo de reposición)** | 🔴 **Es decisión de la contadora, no nuestra.** CLAUDE.md §22.6 + la memoria de fuentes oficiales prohíben afirmar criterios fiscales/contables de memoria. El modelo de datos es **idéntico bajo cualquier método**, así que no bloquea: se implementa uno, **se dice cuál en el reporte**, y la pregunta va al doc de la contadora. |
| **Órdenes de compra / recepción parcial / backorders** | Es flujo de compras de empresa mediana. Acá la compra se registra cuando llegó la mercadería con su factura. NON-GOALS / §4.4. |
| **Libro IVA compras** | El pedido aclara que **el estudio ya lo baja de ARCA** (ítem 11). |
| **Costeo con flete/gastos prorrateados** | Sin pedido real. Backlog con trigger. |
| **Adjuntar el PDF/foto del comprobante** | Ya diferido en el brief de gastos (necesita Storage por tenant). Mismo diferimiento, misma razón. |

## 8. Decisión de diseño

### 8.1 El lote es una línea de gasto

```
expense_items (
  id, tenant_id,
  expense_id      → expenses(id),
  product_id      → products(id),
  qty             numeric(19,4)  CHECK > 0,
  unit_cost       numeric(19,4)  CHECK >= 0,
  -- snapshot, mismo criterio que sale_items: la historia no se reescribe
  product_name_snapshot text
)
```

Sólo tienen sentido con `categoria='mercaderia'`. Al guardar un gasto con
líneas, cada línea emite su `stock_movements` `type='purchase'`,
`direction='in'` **en la misma transacción** — reusando `recordStockMovement`,
que ya toma el lock y audita.

### 8.2 `related_expense_id`, y `related_purchase_id` se retira

Se agrega `related_expense_id` con FK real a `expenses`, y se elimina
`related_purchase_id` (hoy: 0 filas lo usan, medido). **No se dejan las dos**: un
nombre que miente sobre su referente es deuda silenciosa.

### 8.3 ¿La compra actualiza `products.cost`?

**Sí**, y queda dicho dónde el margen lo lee. Si no lo hiciera, `products.cost`
—que es de donde sale `unit_cost_snapshot` al vender— quedaría a mantenimiento
manual y el margen se calcularía contra un número que nadie actualiza.
Consecuencia a declarar: **`products.cost` significa "costo de la última
compra"**, y eso se escribe en el bloque de Rentabilidad.

### 8.4 La valuación al cierre se deriva

Con el stock a la fecha (reconstruible desde el ledger, que desde hoy tiene
signo) y las compras ordenadas por fecha descendente, se toman lotes hasta
cubrir la cantidad. Es una función pura, testeable, sin estado mutable.

#### 🔴 8.4.1 El tercer estado: unidades sin compra asociada

**Agregado 2026-09-12, después de cerrar el hallazgo del stock inicial**
(commit `2f58a96` + migration 0035).

Caminando las compras hacia atrás **siempre van a sobrar unidades sin lote**:
el stock con el que el comercio arrancó, el que se regularizó con la migration
0035, y todo ajuste manual de entrada. No es un caso raro — un comercio que
abrió con mercadería heredada lo tiene desde el día uno.

Esas unidades **no se pueden valorizar como una compra**: no tienen
comprobante, ni proveedor, ni costo verificable. Lo único disponible es
`products.cost`, que es un valor **declarado** (y hasta hoy editable a mano
desde la pantalla de Productos).

Entonces el reporte tiene que mostrar tres cosas separadas, no dos:

1. Unidades con lote → valorizadas al costo del comprobante, con su fecha.
2. Unidades **sin compra asociada** → cantidad + valuación al costo declarado,
   **diciendo que es declarado**, no un importe de compra.
3. El total, que sólo se entiende si los dos anteriores están a la vista.

Mezclar (2) dentro de (1) daría un único número prolijo que la contadora no
puede auditar contra ningún papel. Mismo criterio que los tres estados de
Rentabilidad y de Días de stock: **el hueco se muestra, no se rellena.**

### 8.5 Corrección

Se adopta el patrón ADR-0026 (`corrects_id` en `expenses` + las consultas
excluyen superseded) **en su propia slice, antes o junto con ésta** — la
decisión de §6.1 no puede quedar abierta si el reporte va a ser usado. La
anulación supersede cabecera **y** líneas juntas, y emite los movimientos de
stock compensatorios. Esto es lo que permite que las líneas cuelguen del gasto
en vez de ser direccionables por separado.

## 9. Plan de implementación

| # | Slice | Qué entrega |
|---|---|---|
| 1 | **Corrección de gastos** (`corrects_id`, patrón ADR-0026) | Destraba §6.1, que hoy está roto para gastos en general |
| 2 | **`expense_items` + movimientos `purchase`** | La compra entra al stock con su costo y su fecha |
| 3 | **UI: líneas en el alta de gasto `mercaderia`** | Se puede cargar de verdad |
| 4 | **Reporte ítem 8** (inventario valorizado al cierre) | Lo que pidió la contadora, con el método dicho en la salida |

Cada slice con RED por mutación y verificación contra la base real, como las
anteriores.

## 10. Revisión

- **Pendiente contadora:** método de valuación para el inventario al cierre
  (§7). Va al doc de reunión.
- **Pendiente decisión owner:** si la slice 1 (corrección de gastos) entra
  ahora o el módulo se construye sabiendo que un error no se puede deshacer.
- **Anotado, sin acción:** la contradicción de `return` en §6.3.

---

**Fuentes externas consultadas** (§3.3):
- [Oracle Cost Management — FIFO cost layers](https://docs.oracle.com/cd/E18727_01/doc.121/e13635/T372621T375126.htm)
- [Oracle — FIFO Costing Overview](https://docs.oracle.com/cd/F10642_01/oroms/pdf/182/cws_help/WH14_01.htm)
- [Guía de diseño de base de datos de inventario (lotes, series, capas de costo)](https://www.cleverence.com/articles/for-business/inventory-management-database-6392/)
- [fifo_ims_database — esquema de referencia](https://github.com/thetadog/fifo_ims_database)
