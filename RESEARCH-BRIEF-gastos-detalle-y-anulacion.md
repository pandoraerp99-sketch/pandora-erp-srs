# Research Brief — `/gastos`: cargar el detalle de una compra y anular

**Fecha:** 2026-09-12
**Estado:** propuesto
**Slice:** 3 de `RESEARCH-BRIEF-compras-y-lotes.md`
**Alcance:** pantalla. El backend ya está: `registerExpense({ items })`, `annulExpense`, `expense_items` (migration 0034).

---

## 1. Objetivo

Que el comercio pueda hacer **desde la app** las dos cosas que hoy sólo existen
como service: cargar una compra de mercadería con su detalle, y anular un gasto
mal cargado.

## 2. Problema de negocio

Llega la factura del proveedor. El comercio la carga, y con eso tienen que pasar
tres cosas a la vez: sale la plata, entra la mercadería al stock, y queda
registrado a qué costo entró cada producto (**el lote**, que es el ítem 8 del
pedido de la contadora). Hoy las tres suceden en el service y **ninguna tiene
botón**.

Y al revés: un gasto cargado con un cero de más no se puede deshacer desde la
pantalla, aunque `annulExpense` exista desde la slice 1. Es el caso más común de
todos — cargar mal y querer corregir.

## 3. Investigación

**Interna (el código, medido — no leído):**

| Qué | Dónde | Estado |
|---|---|---|
| Alta de gasto con líneas | `registerExpense({ items })` | ✅ valida que el detalle cierre contra el comprobante |
| Anular | `annulExpense` | ✅ devuelve plata y mercadería; bloquea si ya se vendió |
| Leer el detalle de una compra | — | ❌ **no existe función de lectura** |
| Orden estable de las líneas | — | ❌ `expense_items` no tiene número de línea |
| Modal de carga | `GastosClient.tsx` §`GastoModal` | ✅ fecha, categoría, proveedor, importes, medio, comprobante |
| Lista | `listExpenses` | ⚠️ filtra `GASTO_VIGENTE` (ver §6.1) |

**Maqueta (`pos-preview/facturas-v4.html`, pestaña "Recibidas"):** es la
autoridad visual del proyecto y ya tiene resuelto el gesto — secciones
numeradas (1 Comprobante, 2 Proveedor, 3 Ítems) y una tabla de ítems editable
en línea, con subtotal por fila que se recalcula al tipear.

## 4. Síntesis — qué incorporamos de la maqueta y qué no

**Sí:** la tabla editable en línea con subtotal por fila, el recalculado al
tipear, y el bloque de "cierra / no cierra" contra el comprobante.

**No, y no es un olvido:**

- 🔴 **La maqueta tiene descripción de texto libre; nosotros necesitamos un
  PRODUCTO.** Una línea con texto libre no puede mover stock ni valorizar nada:
  es transcripción de un papel, no un lote. La línea apunta a `products.id`.
- 🔴 **La maqueta tiene alícuota de IVA por línea; `expense_items` no.** El
  costo que guardamos es **neto de IVA recuperable**, y el IVA se informa una
  vez a nivel comprobante (discriminado o no). Copiar el IVA por línea metería
  una segunda fuente de verdad para el crédito fiscal.
- **La maqueta es de `/facturas > Recibidas`, no de `/gastos`.** Ver §7.

## 5. Qué hacemos distinto

**El detalle aparece solo cuando corresponde.** La sección de líneas se muestra
únicamente con `categoria = 'mercaderia'`. El service ya rechaza líneas en otras
categorías; la pantalla no tiene que dejar llegar hasta ahí.

**El cierre se ve ANTES de mandar.** El modal ya hace esto con neto + IVA vs
total; el detalle usa el mismo lenguaje: suma de líneas vs la base (el **neto**
si el IVA está discriminado, el **total** si no — la misma regla que el
service). Un error de tipeo se ve en el momento, no como error del servidor.

**El bloqueo al anular se lee como una explicación.** Si ya se vendió parte de
la mercadería, `annulExpense` devuelve un mensaje que **nombra el producto y sus
números**. Eso va a la pantalla tal cual: es la diferencia entre "no se pudo
anular" y "de Yerba 1kg quedan 7 y la compra fue de 10".

## 6. Lo que se descubrió y no estaba en el plan

### 🔴 6.1 Anular hace que el gasto DESAPAREZCA de la pantalla

Las 7 lecturas filtran `GASTO_VIGENTE` (= `total > 0` **y** que nadie lo
corrija). Después de anular, el original deja de ser vigente y la fila de
anulación vale 0: **las dos desaparecen de la lista**. El comerciante aprieta
"anular" y el gasto se evapora.

Para el CSV del estudio está perfecto — es exactamente por lo que se hizo así.
Para la pantalla es engañoso: contradice que la tabla sea append-only y deja al
comerciante sin forma de saber si anuló, o si apretó mal y borró algo.

**Decisión:** un filtro **"Anulados"** en la barra que ya existe (hoy: todos /
fuera de ARCA / etc.), que muestra los pares original + anulación con su motivo
y su fecha. Ningún total los suma. Es la misma solución que el cierre de caja le
dio a los medios de pago corregidos (ADR-0026): no se esconden, se muestran en
su lugar.

### ⚠️ 6.2 Falta el número de línea

Dos líneas del mismo comprobante insertadas en la misma transacción comparten
`created_at`, así que el detalle se puede mostrar hoy en un orden y mañana en
otro. Y es la misma pieza que falta para que **anular recalcule
`products.cost`** (hoy queda en el valor de un comprobante que ya no existe).

**Decisión:** migration 0036 agrega `linea` a `expense_items`. Es una columna de
orden, no de negocio, y entra con esta slice porque las dos cosas la necesitan.

### ⚠️ 6.3 El producto de la factura puede no estar en el catálogo

Es lo que pasa en la vida real: llega una factura con algo que nunca se vendió.
Ver §7.

## 7. Qué NO vamos a implementar

| Qué | Por qué |
|---|---|
| **Dar de alta productos desde el comprobante** | Es el caso real, pero mete un alta de catálogo (precio de venta, alícuota, rubro, exención Ley 19.640) adentro de la carga de una factura. Se hace en dos pasos: crear el producto en `/productos`, volver. Si al usarlo resulta molesto, vuelve con evidencia. |
| **Editar un gasto** | `expenses` es append-only. Corregir = anular + volver a cargar. Un "editar" sería un UPDATE disfrazado. |
| **Carga asistida / escanear la factura** | F1+/F2, y con gate legal por transferencia de datos a IA (B-IA). La maqueta ya la muestra como *Próximamente*. |
| **Nota de crédito del proveedor** | Es otro comprobante con otras reglas (RG 4540/2019). NC es F1+. |
| **Multi-alícuota por línea** | §4. El crédito fiscal se informa una vez, a nivel comprobante. |
| **Mudar esto a `/facturas > Recibidas`** | Puede que ése sea el hogar definitivo, pero mover la carga de comprobantes de compra es una decisión de arquitectura de pantallas, no una consecuencia de esta slice. El service es el mismo desde las dos. Queda anotado. |
| **Anular una anulación** | El `UNIQUE` parcial lo impide por diseño (ADR-0026). Si hay que revertir, se vuelve a cargar el gasto. |

## 8. Decisión de diseño

1. **Modal de carga**: con `categoria = 'mercaderia'` aparece la sección
   **Detalle**, con filas producto / cantidad / costo unitario / subtotal, y un
   renglón de control "suma del detalle vs comprobante" con el mismo tratamiento
   visual que el de neto + IVA.
2. **Producto**: buscador sobre el catálogo activo (mismo gesto que el POS). La
   línea guarda `product_id`; el nombre queda snapshot en `expense_items`.
3. **Costo unitario**: es **neto**. La etiqueta lo dice, porque es la diferencia
   entre un margen correcto y uno ~21% subestimado.
4. **Ver el detalle**: al abrir una compra ya cargada, en modo lectura. Requiere
   `getExpenseItems(expense_id)` (nueva) + `linea` para el orden.
5. **Anular**: acción en la fila, con motivo obligatorio y confirmación que
   diga qué va a pasar (vuelve la plata a la caja de hoy, vuelve la mercadería).
   Los errores del service se muestran textuales.
6. **Después de anular**: el gasto pasa al filtro "Anulados" (§6.1).

## 9. Plan de implementación

1. Migration 0036 — `expense_items.linea` + orden estable.
2. `getExpenseItems` + anular recalcula `products.cost` desde las líneas
   vigentes.
3. Server Actions: `anularGastoAction`, `getDetalleAction`.
4. Modal: sección Detalle + validación en vivo.
5. Lista: filtro "Anulados" + acción anular + ver detalle.
6. Tests: integración de las actions (incluye el mensaje de bloqueo) +
   mutación.

## 10. Revisión

- **Pendiente decisión owner:** el filtro "Anulados" de §6.1 — es la única parte
  que agrega superficie visible no pedida. La alternativa es no mostrarlos, y
  que anular se vea como borrar.
- **Anotado, sin acción:** el hogar definitivo de la carga de comprobantes de
  compra (§7, última fila).
