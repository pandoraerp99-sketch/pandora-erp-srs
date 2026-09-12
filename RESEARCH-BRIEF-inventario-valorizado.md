# Research Brief — Inventario de bienes de cambio valorizado al cierre

**Fecha:** 2026-09-12
**Estado:** propuesto
**Slice:** 4 de `RESEARCH-BRIEF-compras-y-lotes.md` — la última
**Ítem 8** del pedido de la contadora, textual: *"Inventario de bienes de cambio
VALORIZADO al cierre (fecha adq., detalle, importe de compra)"*.

---

## 1. Objetivo

Que el comercio pueda entregarle al estudio, sin transcribir nada, **cuánta
mercadería tenía a la fecha de cierre y cuánto costó** — con la fecha de
adquisición y el importe de compra de cada lote, que es lo que el ítem pide
literalmente.

## 2. Problema de negocio

Hoy el comercio manda un Excel hecho a mano contando estantes. Dos cosas lo
hacen malo: se cuenta el stock de **hoy** (no el del cierre, que fue hace
meses), y se valoriza con "lo que me acuerdo que salía", no con el comprobante.

`products.cost` por sí solo **no alcanza** y es el motivo de las slices 2 y 3:
es un valor único que se pisa cada vez que el proveedor aumenta, así que no
tiene ni fecha de adquisición ni importe de compra. El lote sí.

## 3. Investigación

**Interna (medido en la base de dev, no leído):**

| Qué | Estado |
|---|---|
| Stock reconstruible desde el libro | ✅ desde migration 0035 — **0 de 7 descuadrados** |
| Signo de cada movimiento (`direction`) | ✅ migration 0032 — sin esto la reconstrucción era imposible |
| Lote con fecha + costo (`expense_items`) | ✅ migration 0034 + 0036 |
| Compras cargadas por la pantalla | ✅ 3 comprobantes reales (jul y sep) |
| Productos sin `stock_tracking_enabled` | **0** hoy — pero el código tiene que decidir qué hace |
| Ejercicio de la demo | cierra en **julio** → último cerrado: 01/08/2025 → **31/07/2026** |

**Fuentes externas:** las mismas del brief de compras (capas PEPS). No hace
falta más: el modelo de datos ya está decidido y probado.

## 4. Síntesis — qué incorporamos

Nada nuevo de afuera. Lo que se incorpora es una **función pura**: dadas las
cantidades a una fecha y las compras ordenadas, devolver la valuación. Sin DB,
sin estado, testeable con casos borde explícitos.

## 5. Qué hacemos distinto

**Es una FOTO a una fecha, no un período.** Los seis bloques que ya tiene
`/contador` son flujos (ventas del período, cobros, gastos). Éste es un saldo a
un instante, y por eso el encabezado dice **"al 31/07/2026"** y no un rango.
Mezclar las dos cosas en la misma pantalla sin decirlo es cómo se termina
mandando al estudio un inventario que no es el del cierre.

**El stock sale del LIBRO, no de `stock_current`.** `stock_current` es hoy; el
cierre fue hace meses. Se suma el movimiento con su signo hasta esa fecha. Toda
la sesión anterior existió para que esta cuenta sea posible.

**Los tres estados se muestran, no se rellenan** (§8.4.1 del brief de compras):

1. Unidades **con lote** → al costo del comprobante, con su fecha de adquisición.
2. Unidades **sin compra asociada** → al costo *declarado*, **diciendo que es
   declarado**. Siempre van a existir: el stock de apertura, lo regularizado por
   la migration 0035, los ajustes de entrada.
3. El **total**, que sólo se entiende si los dos anteriores están a la vista.

Mezclar (2) dentro de (1) daría un número prolijo que la contadora no puede
cotejar contra ningún papel.

**El método de valuación se dice en la salida.** Se implementa **PEPS** (las
unidades que quedan son las compras más recientes). 🔴 **No es nuestra
decisión**: la elección del método es del estudio (CLAUDE.md §22.6). El reporte
la declara en la pantalla y en el CSV, y la pregunta va al doc de la contadora.

## 6. Lo que se descubrió y no estaba en el plan

### ⚠️ 6.1 Ya existe un "valor de stock" que dice otra cosa

La pantalla de Productos muestra un KPI de valor de stock que hace
`Σ stock_current × cost`: es **hoy** y al **costo declarado**. El reporte al
cierre va a dar distinto —otra fecha y otro criterio— y dos números con el
mismo nombre que no coinciden es exactamente lo que hace desconfiar de los dos.

**Decisión:** el reporte nombra su fecha y su método en el encabezado. No se
toca el KPI de Productos en esta slice, pero queda anotado que debería decir
"a hoy, al último costo" para no pisarse.

### ⚠️ 6.2 Una compra POSTERIOR al cierre no cuenta, aunque sea la más reciente

Bajo PEPS "lo que queda son las compras más recientes", pero **a la fecha de
cierre**. En la base de dev hay una compra de Sprite del 02/09 y el cierre es el
31/07: esas unidades no existían todavía. Es el caso que un `ORDER BY fecha
DESC` sin filtro se come en silencio, y es exactamente el que aparece cuando se
arma el inventario **después** del cierre, que es siempre.

### ⚠️ 6.3 Productos sin control de stock

Hoy no hay ninguno, pero `stock_tracking_enabled = false` significa que
`stock_current` **no** está respaldado por el libro: no se puede reconstruir a
una fecha pasada. **Decisión:** quedan fuera del inventario y el reporte dice
cuántos son. Valorizarlos con un número que no se puede reconstruir sería
ensuciar el total con lo único que no se puede auditar.

## 7. Qué NO vamos a implementar

| Qué | Por qué |
|---|---|
| **Elegir el método de valuación** (PEPS / PPP / UEPS) | Es decisión del estudio. Se implementa uno y **se declara**. Si la contadora pide otro, es un cambio chico y aislado en una función pura. |
| **Ajuste por inflación / valores corrientes** | Es criterio contable del estudio (RT 6, RT 17). Pandora entrega el costo del comprobante. |
| **Valor neto de realización / desvalorización** | Idem. Requiere criterio profesional sobre obsolescencia. |
| **Inventario de bienes de USO (ítem 7)** | Activos fijos: otro dominio entero, y el estudio ya los lleva. |
| **Toma de inventario físico (conteo)** | Es otra feature (contar estantes y ajustar). Valiosa, pero es entrada de datos, no reporte. Backlog. |
| **Reconstruir stock de productos sin tracking** | §6.3. No hay libro que reconstruir. |
| **Guardar el inventario "cerrado"** | El reporte se **calcula** cada vez desde el libro, que es append-only. Persistirlo sería la única pieza mutable de la cadena — el mismo principio que `remaining_qty` (ADR-0027). |

## 8. Decisión de diseño

1. **Función pura** `valorizarInventario(cantidades, compras, fechaCierre)` →
   por producto: unidades con lote (cada uno con fecha e importe), unidades sin
   compra, y los subtotales.
2. **Lectura**: stock a la fecha desde `stock_movements` (suma con signo hasta
   la fecha), compras desde `expense_items` de gastos **vigentes** con
   `fecha <= cierre`.
3. **Bloque nuevo en `/contador`**, séptimo, con la fecha de cierre en el
   encabezado y el método declarado.
4. **CSV** con una fila por lote: producto, fecha de adquisición, cantidad,
   importe de compra unitario y total — más las filas "sin compra asociada"
   marcadas como tales.
5. La fecha sale del selector de período que la pantalla ya tiene, acotada a
   **hoy** (no se valoriza el futuro).

## 9. Plan de implementación

1. Dominio puro + tests unitarios con casos borde (compra posterior al cierre,
   cobertura parcial, producto sin compras, stock 0, sin costo declarado).
2. Lectura desde el libro (stock a la fecha) + compras vigentes.
3. Bloque en `/contador` + CSV.
4. Verificación contra la base de dev y captura en ambos temas.
5. Pregunta al doc de la contadora: **qué método de valuación quiere**.

## 10. Revisión

- **Pendiente contadora:** método de valuación (§5). No bloquea: se implementa
  PEPS y se declara.
- **Anotado, sin acción:** el KPI de Productos debería nombrar su criterio
  (§6.1).
