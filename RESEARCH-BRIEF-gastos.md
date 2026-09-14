# Research Brief — `Gastos`

**Fecha:** 2026-09-09
**Estado:** 🧩 diseño
**Relacionado:** `EVIDENCIA-pedido-contadora-2026-09.md` · panel `/contador` · `terceros` · ADR-0027 (mismo patrón de "toca la caja o no")

> Brief **corto a propósito**: la especificación no hay que investigarla, está en
> el pedido real de la contadora. Lo que sí hay que decidir es el modelo.

---

## 1. Objetivo

Registrar los **gastos del comercio** con el detalle que necesita la contadora,
para dejar de mandárselos clasificados a mano todos los meses.

## 2. Problema de negocio

La evidencia es una línea del pedido, respondida por el comercio:

> *"Otros gastos no incluidos en el IVA COMPRAS. **Ok, clasifico gastos y envío
> gastos no incluidos en ARCA mensualmente**."*

- **Usuarios:** el dueño/encargado carga; la contadora consume.
- **Impacto:** ALTO y medible — es trabajo manual recurrente que ya existe.
- **Desbloquea, además:** IVA crédito fiscal (hoy la Posición de IVA no cierra),
  Estado de Resultados (falta gastos), proveedores/acreedores con CUIT, y los
  comprobantes de alquiler/seguros/servicios/tasas del ítem 12 del pedido.

## 3. Lo que ya existe y NO hay que rehacer

| Pieza | Estado | Cómo se reusa |
|---|---|---|
| `terceros` con `type='proveedor'` + `doc` (CUIT) | ✅ existe | Es el proveedor. Su propio docstring dice: *"el futuro módulo compras reutiliza `terceros` type='proveedor' sin migrar"*. |
| `cash_movements.type='provider_payment'` | ✅ existe **y ya suma en el arqueo** | El gasto pagado en efectivo genera este movimiento, igual que el cobro de cuenta corriente genera `customer_payment` (ADR-0027). |
| Patrón "toca la caja o no" | ✅ resuelto en ADR-0027 | Efectivo sí; transferencia/tarjeta no. Misma regla, sin inventar nada. |

## 4. Las categorías NO se inventan: salen del pedido

La contadora las enumera. Ese es el catálogo, y es evidencia, no diseño:

`alquiler` · `seguros` · `servicios` (luz, gas, agua, cable, teléfono) ·
`impuestos_y_tasas` · `honorarios` · `mercaderia` · `otros`

`mercaderia` se agrega porque la compra de mercadería es el gasto más frecuente
de un kiosco y la contadora lo pide aparte (bienes de cambio, ítem 8).

## 5. La distinción que importa, y que casi se pierde

El pedido separa dos mundos:

- Gastos **con comprobante fiscal** → entran al IVA compras, y **el estudio ya
  los baja de ARCA**. El pedido lo dice: *"Información con la que contamos en el
  estudio"*.
- Gastos **sin comprobante fiscal** (o no incluidos en ARCA) → **esos son los que
  el comercio tiene que mandar**.

Si Pandora no distingue los dos, le manda a la contadora un listado que duplica
lo que ella ya tiene, y el trabajo de separar vuelve a caer en el comercio — que
es exactamente el trabajo que se quiere eliminar.

**Decisión:** el gasto lleva un flag `en_iva_compras` y el export para la
contadora se puede filtrar por él.

## 6. Qué NO vamos a implementar

| Idea descartada | Por qué | Trigger |
|---|---|---|
| **Cuenta corriente de proveedores** (deuda con el proveedor, pagos parciales) | Es el módulo Compras completo, F1+. Un gasto es un hecho consumado: se pagó. | Cliente que compre a crédito de forma habitual. |
| **Órdenes de compra / recepción de mercadería** | MRP encubierto. NON-GOALS. | Nunca en F0/F1. |
| **Lectura automática del comprobante (OCR/IA)** | ADR-0024: la IA sugiere, nunca decide. Un neto/IVA mal leído entra a una DDJJ. | F1+, y con verificación humana obligatoria. |
| **Impacto en el stock al comprar mercadería** | Suena obvio y es una trampa: mezcla el hecho contable con el movimiento de inventario, y un gasto corregido tendría que revertir stock. Se registran por separado. | Cuando exista Compras con recepción. |
| **Calcular el IVA crédito desde el gasto para la DDJJ** | El dato entra, pero la posición de IVA la arma la contadora. Pandora prepara, no liquida (Ley 20.488). | — |
| **Adjuntar la foto del comprobante** | Necesita Storage por tenant, y una foto que no se puede recuperar es peor que ninguna. | Cuando esté resuelto el storage con RLS. |

## 7. Decisión de diseño

Tabla `expenses`: **el gasto como hecho contable, independiente de cómo se pagó.**

- `fecha`, `categoria`, `neto` / `iva` / `total`, `descripcion`
- proveedor: `tercero_id` opcional + **`payee_name` snapshot** (mismo criterio que
  el resto: la historia no se reescribe si se renombra el tercero)
- `comprobante_tipo` / `comprobante_numero` opcionales
- `en_iva_compras` (boolean) — §5
- `medio_pago`; si es **efectivo**, genera el `cash_movements` `provider_payment`
  ligado, y suma al arqueo. Si no, no toca la caja.

**Append-only, como el resto de lo que es plata**: corregir es registrar un
gasto de ajuste, no editar. (`audit_log` + `stock_movements` +
`customer_account_movements` ya siguen ese patrón.)

**Riesgo identificado — doble conteo:** hoy la caja ya permite registrar un
"pago a proveedor" a mano. Si alguien carga el gasto Y el movimiento de caja, el
arqueo cuenta dos veces. Mitigación: el gasto es el que crea el movimiento; el
egreso manual de caja sigue existiendo para lo que no es un gasto registrado, y
la pantalla lo dice.

## 8. Plan

- **MVP:** tabla + servicio + registrar gasto (con caja si es efectivo) +
  listado del período + export para la contadora separando `en_iva_compras`.
- **F1+:** cuenta corriente de proveedores, adjuntos, OCR con verificación.
