# Research Brief — Costos, gastos y compras en Pandora

**Fecha:** 2026-11-18
**Estado:** propuesta funcional (sin código). Para decidir antes de construir.
**Base:** mockup `pos-preview/facturas-v4.html`, lo construido en `/gastos` (ADR-0028, migraciones 0033-0042), inventario valorizado PEPS (ítem 8), margen con `unit_cost_snapshot`.

---

## Resumen para decidir (en palabras simples)

**Qué recomiendo.** Juntar todo lo que es *plata que sale y mercadería que entra* en un solo apartado llamado **"Compras y gastos"**, que reemplaza a la pantalla Gastos actual. Adentro van las compras (remitos y facturas de proveedor), los gastos del local, los pagos a proveedores, los fletes y los gastos que se repiten todos los meses. **"Facturas"** queda sólo para las facturas que Pandora le hace a sus clientes, que dependen del certificado de AFIP.

**Qué construir primero (versión 1), en este orden** (revisado con tus respuestas, ver §0):
1. **Fijo o variable en cada gasto.** Es lo que pidió tu novia, y sale casi gratis con lo que ya existe.
2. **Vencimientos, pagos por factura y "desde qué cuenta se pagó".** Cuánto se le debe a cada proveedor, qué vence esta semana, qué factura cancela cada pago, y si salió de la caja o de cuál de los dos bancos.
3. **El expreso como proveedor con cuenta corriente,** y cada flete vinculado a la compra que trajo, sumado al costo de esa mercadería.
4. **Gastos recurrentes.** Por ejemplo el alquiler: Pandora avisa que vence, y al cargarlo no se duplica.

**El remito separado ya no hace falta.** La factura llega con la mercadería, y a veces antes por mail. El único caso nuevo es "factura cargada, mercadería todavía no llegó", y es chico.

**Las cuatro palabras, en una línea cada una:**
- **Costo:** lo que te cuesta algo. Por ejemplo, el hilo que comprás para vender.
- **Gasto:** la parte del costo que corresponde a un mes. El alquiler de noviembre es gasto de noviembre aunque lo pagues el 10 de diciembre.
- **Pago:** la plata que sale, el día que sale. Puede ser antes o después del gasto.
- **Fijo / variable:** si el costo cambia o no cuando vendés más. El alquiler es fijo; las bolsas son variables.

---

## 0. Lo que confirmaste (2026-11-18) y cómo cambia la propuesta

| Respuesta | Qué cambia |
|---|---|
| **La factura llega con la mercadería**; a veces antes, por mail | **Se descarta el remito separado y el costo provisorio** (la parte más riesgosa de la versión anterior). El costo siempre es el real de la factura. Queda un caso chico: cargar la factura **"pendiente de recibir"**: la deuda nace con la factura y el stock entra recién al confirmar que llegó la mercadería. |
| **Fletes:** un expreso con **cuenta corriente comercial**; le transferís cada ~2 semanas para bajar la cuenta | El expreso es **un proveedor más**, con la cuenta corriente que ya existe (ADR-0028). Cada flete es un cargo a esa cuenta, vinculado a la compra que trajo, y su costo se reparte entre esa mercadería. Los pagos quincenales bajan la cuenta del expreso, no la del proveedor de la mercadería. |
| **Cobros:** efectivo, transferencia, QR, débito y crédito | Las comisiones de cobro (posnet débito y crédito, QR) son el **único costo variable de vender** que tiene Pandora. La transferencia, en principio, no tiene comisión. |
| **Embalaje:** no se entregan bolsas | Sale de la lista de costos variables. |
| **Envíos:** no se hacen | Sale de la lista. No hay costo de vender por envío. |
| **Cuentas:** 2 bancos (uno por cada posnet) | Hay que modelar **tres cuentas**: caja (efectivo), banco 1 y banco 2. Cada pago dice de cuál salió. El saldo de cada banco y la conciliación quedan para más adelante. |

**Segunda ronda de respuestas (2026-11-18):**

| Pregunta | Respuesta | Qué cambia |
|---|---|---|
| ¿El monto del flete se conoce al llegar? | **Sí**: la factura del expreso llega junto con la de la mercadería y la mercadería | El flete se carga **en el mismo momento** que la compra, así que cada venta guarda el costo completo. **No hace falta el "ajuste de costo"** de §5: se saca del plan. |
| ¿El QR es de MercadoPago o de un banco? | **Se genera desde los dos posnets.** El cliente paga con cualquier billetera o banco, y acredita en el banco de ese posnet | **No hay una cuarta cuenta.** El QR es un medio de cobro de cada posnet, como débito y crédito. Para saber a qué banco entra cada cobro y qué comisión paga, alcanzaría con registrar **en qué posnet** se cobró (ver pendientes). |
| ¿Qué comisión cobra cada posnet? | **A confirmar** con el resumen | Queda en **Pendientes**. Sin esos porcentajes no se calcula el margen de contribución. |
| ¿Desde qué banco pagan? | **Desde los dos, según el saldo de cada uno** | Cada pago tiene que decir de qué cuenta salió. Si un pago se reparte entre los dos bancos, se registra como dos pagos. |

### Pendientes (para chequear juntos)

1. **Comisiones de cada posnet:** el porcentaje por débito, por crédito y por QR, y el plazo de acreditación. Sale del resumen del banco. *Lo pasás vos y lo chequeamos.*
2. **¿Registrar en qué posnet se cobró cada venta?** Hoy el POS guarda el medio (tarjeta, QR) pero no el posnet. Sin ese dato las comisiones se pueden cargar **por mes desde el resumen** (simple y suficiente para el margen). Con el dato, se calculan venta por venta y se sabe cuánto entra en cada banco. Recomiendo empezar por mes y decidir después con el resumen en la mano.
3. **Categoría para las comisiones:** la lista actual de categorías es la de la contadora, así que se agrega con su acuerdo.
4. **A-33** (contadora): el flete de compra en el costo de la mercadería para los estados contables.

---

## 1. El mockup de Facturas frente a lo que ya existe

### Qué dibuja el mockup (`facturas-v4.html`)

| Pestaña | Qué tiene | Estado en el código |
|---|---|---|
| **Emitidas** | Facturas de venta con estado AFIP (autorizada, reconciliando, rechazada), detalle con Ley 27.743 y CAE. | No construido. Depende del **certificado AFIP** y de A-2/A-11. No tiene nada que ver con costos. |
| **Recibidas** | Carga de factura de proveedor: tipo, PV-número, CAE, proveedor, artículos con IVA por línea, percepciones (IIBB TDF, IVA), exento Ley 19.640, **"Incorporar a stock"** vinculando cada línea a un producto, control "Total impreso coincide". | **Parcial.** `/gastos` registra compras de mercadería con lote (`expense_items`) que mueve stock, neto/IVA, comprobante y adjunto. No hay CAE ni percepciones discriminadas ni vínculo línea → producto en la carga. |
| **Gastos** | Alta rápida (categoría, concepto, beneficiario, monto, medio, fecha, adjunto) y "Gastos del mes" por categoría. | **Construido** en `/gastos`, con más que el mockup: proveedores con cuenta corriente, acreedores al cierre, anulación append-only, adjuntos. |

### Qué pasa con el nombre

**Recomendación: renombrar el ítem actual "Gastos" a "Compras y gastos" y mover ahí "Recibidas" y "Gastos".** "Facturas" queda sólo para "Emitidas".

**Por qué:**
- **"Facturas" mezcla dos mundos.** Juntaría lo que Pandora le factura a sus clientes (IVA débito, AFIP) con lo que le facturan a Pandora (IVA crédito, proveedores). Son flujos con dueños, riesgos y bloqueos distintos: Emitidas está frenada por el certificado y el resto no.
- **Mucho de lo que hay que registrar no es una factura.** Un remito, un pago parcial, un flete pagado en efectivo sin comprobante o el alquiler sin recibo todavía. Un nombre que dice "Facturas" esconde la mitad del contenido.
- **"Compras y gastos" es el vocabulario del comerciante:** "lo que compro para vender" y "lo que gasto para que el local funcione". Esa es la distinción que después vuelve como costo de mercadería frente a gastos fijos y variables.

La contadora ya tiene su propia vista (`/contador`) y no se toca.

### Qué conviene hacer con `/gastos`

Que **evolucione** a "Compras y gastos": no se tira nada. Ya resuelve proveedores, deuda al cierre, anulaciones y adjuntos. Lo nuevo se agrega como pestañas con la estética de `pos-preview` (barra de título `.bar`, KPIs `.kpis`, chips de filtro, tabla, modal de detalle), igual que se hizo con Pedidos.

### Categorías

Mandan las del código, que salen del pedido real de la contadora: `alquiler`, `seguros`, `servicios`, `impuestos_y_tasas`, `honorarios`, `mercaderia`, `otros`. Las del mockup (Empleados, Compras diarias) no se adoptan. "Compras diarias" es en realidad un gasto variable sin comprobante, y "Empleados" roza la **liquidación de sueldos, que es NON-GOAL**: el *pago* de un sueldo se registra como gasto fijo, pero Pandora no liquida sueldos.

---

## 2. Qué dicen las fuentes y qué adopto

### Conceptos

- **Fijo y variable.** *Principles of Managerial Accounting* (OpenStax, cap. 2.2) define el costo fijo como uno que "does not change in total over the short term", y el variable como el que "varies in direct proportion to the level of activity". Reconoce además costos **mixtos**: "Mixed costs are those that have both a fixed and variable component". → **Adopto los tres valores: fijo, variable y mixto.** La luz es el ejemplo típico de mixto: cargo fijo más consumo.
- **Costo del producto y costo del período.** El mismo libro (cap. 2, términos clave) separa *product costs* de *period costs*: estos últimos se tratan "as an expense in the period incurred (examples include many sales and administrative expenses)". → Es una pregunta **distinta** de fijo/variable: un costo puede ser variable y del período, como la comisión de cobro, o variable y del producto, como la mercadería.
- **Margen de contribución y punto de equilibrio.** Margen de contribución = ventas − costos variables; punto de equilibrio = costos fijos ÷ margen de contribución por unidad, o en porcentaje. Es material estándar de costos; ver por ejemplo LibreTexts, *Introducción a los Negocios*, "El punto de equilibrio".

### El flete como parte del costo de la mercadería

- **NIC 2 (Inventarios).** El costo de adquisición "comprenderá el precio de compra, incluyendo aranceles de importación y otros impuestos" no recuperables, más "los transportes, el almacenamiento y otros costos directamente atribuibles a la adquisición". Además, "los descuentos comerciales, las rebajas y otras partidas similares se deducirán". Fuente: texto en castellano publicado por el Ministerio de Economía de Uruguay (versión de 1995; la numeración de párrafos difiere de la edición vigente), consultado el 2026-11-18. El **CTCP de Colombia (Concepto 437 de 2021)** repite el criterio: transporte, manejo y otros costos directamente atribuibles.
- **Para la norma argentina no afirmo nada.** El tratamiento contable en Argentina (RT 17 y la nueva RT 54 para entes pequeños) es criterio de la contadora. **Pregunta A-33** (§7).
- → **Adopto para la gestión:** el flete **de compra** se suma al costo de la mercadería, con IVA recuperable excluido, igual que ya hace Pandora con el precio. El flete **de envío a un cliente** no es costo del producto: es costo de vender.

### Cómo lo resuelven los sistemas de gestión

- **Recepción separada de la factura (ERPNext).** El *Purchase Receipt* "records the quantity that actually arrived" y "updates stock", pero "does not, by itself, create the supplier's payable". La deuda nace con la factura posterior, que además "clears Stock Received But Not Billed". → **Adopto la separación:** el remito mueve stock, la factura mueve deuda. La lista de "recibido sin facturar" es la herramienta para que no quede nada colgado.
- **Fletes y otros costos adicionales.** El *Landed Cost Voucher* de ERPNext se crea contra la recepción o la factura, y "these additional charges once added, get added in the Item Valuation rate". Odoo hace lo mismo con *Landed Costs* ("take additional costs into account when calculating the valuation of a product") y ofrece repartos "Equal", "By Quantity", "By Current Cost", "By Weight" y "By Volume". → **Adopto el reparto por valor (default) o por cantidad, con override manual.** Por peso o volumen no se puede: Pandora no guarda peso ni volumen de los productos.
- **Gastos recurrentes.** Los sistemas contables chicos ofrecen plantillas que generan el comprobante cada período, como borrador para revisar o ya aprobado. No encontré la ayuda oficial de Xero sobre esto, así que describo la práctica sin atribuirla. → **Adopto: la plantilla genera un *vencimiento previsto*, no un gasto.** El gasto nace recién cuando se carga, y queda conciliado con el previsto.

**Lo que NO adopto de esos sistemas:**
- **Orden de compra formal con "three-way match"** (orden, recepción y factura). Para un comercio de 1 a 3 personas es burocracia. El remito y la factura alcanzan.
- **Contabilidad por partida doble.** Pandora no es un sistema contable (CLAUDE.md §1.8).

---

## 3. Fijo o variable frente a "se asigna al producto"

Son **dos preguntas independientes**:

| Ejemplo | ¿Cambia si vendés más? | ¿Se suma al costo de un producto? | Qué dato hace falta confirmar |
|---|---|---|---|
| **Alquiler** | Fijo | No: es del período (del mes) | — |
| **Mercadería** | Variable | **Sí**: es el costo del producto; entra al stock y se vuelve costo cuando se vende | — |
| **Flete de compra** | Variable (cada compra) | **Sí**, repartido entre lo que vino en esa compra | ¿Lo cobra el proveedor en la factura o un transportista aparte? |
| **Flete de envío a clientes** | Variable (por envío) | No: es costo de vender | ✔ Pandora **no hace envíos**: no aplica |
| **Embalaje (bolsas, cajas)** | Variable | Normalmente no: va al período | ✔ Pandora **no entrega bolsas**: no aplica |
| **Comisión de cobro (posnet débito y crédito, QR)** | Variable (por venta con ese medio) | No: es costo de *cobrar*, no del producto | ✔ Medios confirmados. Falta el porcentaje de cada posnet y de quién es el QR. **Es el único costo variable de vender que tiene Pandora** |
| **Luz** | **Mixto** | No | — |
| **IIBB** | Variable (porcentaje de lo vendido) | No | La alícuota la confirma la contadora |
| **Honorarios de la contadora** | Fijo | No | — |
| **Sueldo fijo** | Fijo | No | Sólo se registra el pago; la liquidación es NON-GOAL |

**Por qué importa separarlas:**
- **"Fijo/variable"** sirve para el punto de equilibrio y para preguntarse "si vendo el doble, ¿qué costos suben?".
- **"Se asigna al producto"** sirve para el margen de cada artículo.

Si se mezclan aparecen los errores clásicos:
- **Repartir el alquiler entre los productos** ("costeo por absorción"). Hace que un producto parezca no rentable sólo porque se vendió poco ese mes.
- **Dejar el flete afuera del costo de la mercadería.** Infla el margen de esos productos.

**Cómo se carga sin trabajo extra:** cada categoría trae un valor por defecto de fijo/variable/mixto, que se puede cambiar en cada gasto.

| Categoría | Por defecto |
|---|---|
| alquiler, seguros, honorarios | fijo |
| servicios | mixto |
| impuestos_y_tasas | depende: IIBB variable, tasa municipal fija; se elige al cargar |
| otros | se elige al cargar |

"Mercadería" no es un gasto del mes: es una compra que va al stock. Por eso en los reportes de costos se muestra aparte, como **costo de la mercadería vendida**.

---

## 4. Gastos recurrentes sin duplicar

1. **Plantilla.** "Alquiler, $X, vence el día 10, todos los meses, desde enero". Puede tener monto fijo o "monto a confirmar", como la luz. Para el avance de fechas se reutiliza la lógica de recurrencia que ya tienen los Pendientes (`tasks`), que avanza salteando y no amontona.
2. **Vencimiento previsto.** La plantilla genera "Alquiler de noviembre, vence el 10/12". **No es un gasto y no suma en ningún total.** Se ve en "Próximos vencimientos" y en el Panel.
3. **Al cargar el gasto real** (o su factura), Pandora sugiere "¿es el alquiler de noviembre?". Si se confirma, el previsto queda **cumplido** y apunta a ese gasto.

**Por qué no se duplica:**
- **Lo previsto no suma nada.** Sólo lo cargado entra en los totales.
- **Un período cubre una sola vez.** Cada gasto recurrente lleva el **período al que corresponde** (mes), y un mismo período de una plantilla sólo se puede cumplir una vez (restricción única).
- **Si lo previsto no llega, se nota.** Un previsto vencido y sin cumplir queda en rojo, igual que un pedido vencido.

Esto también resuelve **"cuándo corresponde"**. El alquiler de noviembre pagado el 10/12 es **gasto de noviembre** y **pago de diciembre**: el campo "período" lleva lo primero y la fecha de pago lo segundo.

---

## 5. El circuito conectado

**Regla de oro:**
- **La recepción de la mercadería** mueve **cantidades de stock**, al costo de la factura. Cuando la factura llega con la mercadería, las dos cosas se registran juntas, como hoy.
- **La factura y el flete** mueven **la deuda y el costo**.
- **El pago** mueve **la plata**.

Ninguno repite lo de los otros: la factura no vuelve a sumar stock, y el pago no vuelve a sumar costo.

### Qué se carga una vez, quién y qué actualiza

| Paso | Quién | Se carga una vez | Actualiza |
|---|---|---|---|
| **Factura de compra** (llega con la mercadería o antes por mail) | La dueña (o quien administra) | Tipo y número, fecha, **vencimiento**, neto por alícuota, IVA, percepciones, exento o no gravado, productos con cantidad y precio, foto | Deuda con el proveedor; IVA crédito. Si la mercadería ya llegó, también el stock con su costo real (como hoy). Si no, queda **"pendiente de recibir"**. |
| **Recepción** (sólo si la factura llegó antes) | Quien recibe | Confirmar qué llegó (todo o parte) | Stock (+cantidad) con el costo **real** de la factura. Lo que falta queda pendiente. |
| **Flete** (guía del expreso) | La dueña | Expreso (proveedor con cuenta corriente), monto, **compras a las que se aplica**, criterio de reparto | Costo de esas unidades (se reparte); deuda con el expreso. |
| **Pago a proveedor o al expreso** | La dueña | Fecha, monto, medio, **cuenta** (caja, banco 1, banco 2), **facturas que cancela** (por defecto la que vence primero) | Deuda (−); caja si es efectivo; queda registrado de qué banco salió. |
| **Gasto general** | Cualquiera que opere | Fecha del hecho, período, categoría, fijo/variable/mixto, monto, medio o "a pagar" con vencimiento, comprobante (puede llegar después) | Si está pagado, caja (efectivo); si es "a pagar", deuda. |

### Casos puntuales

- **Factura antes que la mercadería.** Si llegó por mail, se carga "pendiente de recibir": la deuda nace ya, el stock no. Al llegar la mercadería se confirma la recepción, total o parcial. Si llegaron 40 de 50, quedan 10 pendientes hasta que lleguen.
- **Diferencias entre lo recibido y lo facturado.** Si facturaron unidades que nunca llegaron, se marcan "reclamar al proveedor" y la deuda queda con una nota hasta que llegue la nota de crédito. Pandora no **emite** notas de crédito (F1+), pero sí puede **registrar** una recibida. Lo pendiente de recibir por mucho tiempo aparece en una lista de alerta.
- **Flete del expreso** (el caso de Pandora). Es un cargo en la cuenta corriente del expreso, vinculado a la compra que trajo. La deuda es con el expreso, no con el proveedor, y los pagos quincenales bajan esa cuenta.
- **Flete en la misma factura del proveedor** (por si pasa). Se marca la línea "flete" de esa factura y se reparte entre las líneas de mercadería de la misma factura.
- **Flete compartido entre varias compras.** Se elige a qué compras se aplica y se reparte por valor (o por cantidad). El reparto queda guardado línea por línea, para poder revisarlo.
- **Gasto sin comprobante.** Se registra igual con "sin comprobante" y se le adjunta el respaldo cuando llega; los adjuntos ya existen (ítem 12). La consulta "incurrido, pagado y pendiente" sale de comparar lo cargado contra los pagos.
- **"La cuenta desde la que se pagó".** Pandora tiene dos bancos (uno por posnet) más la caja. En la V1 cada pago dice de cuál de las tres salió: el efectivo mueve la caja como hoy, y los bancos quedan registrados como salida. El **saldo** de cada banco y la conciliación con el extracto son versión 3.

### El riesgo técnico: costo que llega después de vender

> **Actualización 2026-11-18 (segunda ronda): esto NO se construye.** La factura de la mercadería y la del flete llegan juntas con la mercadería, así que el costo completo se conoce antes de vender. Queda descripto sólo por si algún día un costo llega después.

Hoy el lote de stock nace **con** el gasto y trae el costo real. Si un costo llega **después**, el lote ya existe. Propuesta:
1. **El flete no edita el lote**, porque es append-only. Agrega un **ajuste de costo** por línea que apunta al lote. El costo vigente del lote es el de la factura más los ajustes, y `products.cost` se actualiza.
2. **Las ventas hechas en el medio no se reescriben.** Su `unit_cost_snapshot` queda como estaba. La diferencia de las unidades **ya vendidas** se registra como **ajuste de costo de mercadería vendida** en el mes en que llega el flete, y se muestra como línea propia en el margen.
3. **La fecha de adquisición** para PEPS es la de **recepción**.

Así el valor del inventario y el costo de lo vendido siempre suman lo que realmente costó la compra (ver el control al final del ejemplo).

---

## 6. Ejemplo numérico completo (con el circuito real de Pandora)

Proveedor **Distribuidora Austral** (factura A, IVA 21% discriminado: el IVA **no** es costo). Producto **A** (hilo) y producto **B** (cinta). El flete lo trae **el expreso**, con el que Pandora tiene cuenta corriente.

**Paso 1 — La factura llega por mail antes que la mercadería:** 100 A a $1.000 y 40 B a $2.000.

| | Cambio | Saldo |
|---|---|---|
| Deuda con el proveedor | Neto $180.000 + IVA $37.800 = **+$217.800** | **$217.800** |
| Stock | **ninguno**: todavía no llegó | "Pendiente de recibir": 100 A · 40 B |
| Inventario | — | $0 |
| IVA crédito | +$37.800 | $37.800 |
| Caja y bancos | — | — |

**Paso 2 — Llega la mercadería** y se confirma la recepción.

| | Cambio | Saldo |
|---|---|---|
| Stock | A +100, B +40, con el costo **real** de la factura | A 100 · B 40 |
| Inventario | 100 × $1.000 + 40 × $2.000 | **$180.000** |
| Deuda | **ninguno**: ya nació con la factura | $217.800 |
| Caja y bancos | — | — |

*(Si hubieran llegado 90 A, quedan 10 A "pendientes de recibir". La deuda no cambia porque es lo que dice la factura, y si nunca llegan, se reclama la nota de crédito al proveedor.)*

**Paso 3 — El expreso cobra el flete en su cuenta corriente:** $10.000 + IVA $2.100 = $12.100, aplicado a esta compra y repartido **por valor**.

| | Cálculo | Resultado |
|---|---|---|
| Deuda con **el expreso** | +$12.100 | **$12.100** (la del proveedor no cambia) |
| Parte de A | $10.000 × 100.000 / 180.000 | $5.555,56 → **$55,56 por unidad** |
| Parte de B | $10.000 × 80.000 / 180.000 | $4.444,44 → **$111,11 por unidad** |
| Costo unitario final | | A **$1.055,56** · B **$2.111,11** |
| Inventario | $180.000 + $10.000 | **$190.000** |
| IVA crédito | +$2.100 | $39.900 |
| Caja y bancos | — | — |

*(Repartido por cantidad daría $10.000 / 140 = $71,43 por unidad para A y B por igual. Por valor es más justo cuando los precios son muy distintos.)*

**Se venden 10 A a $1.600.** Como el flete ya estaba cargado, cada venta guarda su costo completo, $1.055,56. Costo de lo vendido: **$10.555,56**. Inventario: **$179.444,44**.

**Paso 4 — Pago parcial al proveedor:** $100.000 por transferencia **desde el banco 1**, aplicado a esa factura.

| | Cambio | Saldo |
|---|---|---|
| Deuda con el proveedor | −$100.000 | **$117.800** (factura "pagada en parte") |
| Banco 1 | −$100.000 (registrado como salida) | — |
| Caja (efectivo) | **ninguno** | — |
| Inventario y costo | **ninguno**: pagar no es costo | $179.444,44 |

**Paso 5 — Pago quincenal al expreso:** $12.100 por transferencia **desde el banco 2**.

| | Cambio | Saldo |
|---|---|---|
| Deuda con el expreso | −$12.100 | **$0** |
| Banco 2 | −$12.100 | — |
| Inventario y costo | **ninguno** | $179.444,44 |

**Control de que nada se contó dos veces:**
- **Costo real de la compra:** $180.000 (mercadería neta) + $10.000 (flete neto) = **$190.000**.
- **Dónde quedó:** inventario $179.444,44 + costo de lo vendido $10.555,56 = **$190.000**. ✔
- **Stock:** lo sumó sólo la recepción.
- **Deudas:** las crearon sólo la factura y el flete, y las bajaron sólo los pagos.
- **Plata:** salió sólo con los pagos: $112.100, todo por banco, nada de la caja.
- **Gastos del mes.** El número que el owner decidió mostrar (2026-09-17: plata que salió) da $112.100. La compra **no** aparece como gasto del mes: es mercadería que espera venderse, y se vuelve costo recién al venderla.

**En Pandora el flete llega con la mercadería** (confirmado), así que se carga junto con la compra y las ventas siempre guardan el costo completo. En la práctica, los pasos 1 a 3 suelen ser uno solo: llega la caja con las dos facturas y se carga todo junto.

**Notas:**
- **Mercadería amparada por la Ley 19.640.** Si la compra viene exenta, no hay IVA crédito y el costo es el total.
- **Proveedor monotributista (factura C).** El IVA no se discrimina, así que es parte del costo. Es la regla que ya aplica Pandora en `expense_items.unit_cost`.

---

## 7. Qué se resuelve con lo existente y qué hay que confirmar

| Tema | Se resuelve con lo que hay | Depende de cómo trabaja Pandora (confirmar con vos o tu novia) | Depende de la contadora |
|---|---|---|---|
| Fijo / variable / mixto | ✅ columna nueva en gastos más valor por defecto por categoría | Qué categorías usa de verdad y si quiere subcategorías | Cómo clasificar IIBB y tasas |
| Vencimientos y saldo por proveedor | ✅ la cuenta corriente de proveedores ya existe (ADR-0028); falta la fecha de vencimiento y aplicar pagos a facturas | Plazos típicos (¿30 o 60 días?) | — |
| Gastos recurrentes | ✅ la lógica de recurrencia de Pendientes | Cuáles son: alquiler, servicios, contadora, ¿seguros? | — |
| Factura antes que la mercadería | ✅ chico: la factura queda "pendiente de recibir" y la recepción mueve el stock al costo real | ✔ Confirmado: llega con la mercadería o antes por mail. **No se construye remito separado** | — |
| Fletes al costo | ✅ el expreso es un proveedor con cuenta corriente (ADR-0028); falta vincular el flete a la compra y repartirlo | ✔ Expreso con cuenta corriente y pagos cada ~2 semanas. ✔ El monto llega **con** la mercadería | **A-33:** ¿el flete entra al costo de la mercadería para los estados contables? |
| Comisiones de cobro | ❌ no se registran hoy | ✔ Efectivo, transferencia, QR, débito, crédito; ✔ el QR sale de los posnets. ⏳ **Pendiente:** porcentaje de cada posnet | Categoría para la comisión (hoy no está en la lista de la contadora) |
| Embalaje | — | ✔ No se entregan bolsas: **no aplica** | — |
| Cuentas | ❌ no modeladas | ✔ **2 bancos** (uno por posnet) más la caja; ✔ se paga desde los dos según el saldo; ✔ no hay cuarta cuenta | — |
| Envíos a clientes | — | ✔ No hacen envíos: **no aplica** | — |
| Sueldos | ✅ el pago como gasto fijo | ¿Hay empleados con sueldo fijo? | La liquidación es NON-GOAL |
| Mes del IVA computable y "gastos del ejercicio" | ya abierto | — | A-29 / A-30 (ya en la lista) |

---

## 8. Qué tiene que poder consultarse y con qué datos

| Consulta | Datos que necesita | Disponible en |
|---|---|---|
| **Gastos fijos y variables por mes** (incurrido, por período) | Clasificación más período | V1 |
| **Pagado / incurrido / pendiente** | Gastos más pagos aplicados | V1. "Gastos del mes" **sigue siendo lo que salió** (decisión del owner 2026-09-17); lo incurrido se muestra **aparte** y con su nombre |
| **Saldo y próximos vencimientos por proveedor** | Vencimiento en factura o gasto a pagar, más pagos aplicados | V1 |
| **Pagos realizados** (por mes, por medio, por proveedor) | Pagos | V1 (ya están; falta la vista) |
| **Costo de la mercadería vendida** | `unit_cost_snapshot` de las ventas más ajustes de costo | Ya existe (margen bruto); los ajustes llegan en V2 |
| **Compras del mes frente a costo de lo vendido** | Compras más ventas | V1 (con lo que hay) |
| **Margen de contribución** | Ventas − costo de mercadería − **comisiones de cobro** (− IIBB, si la contadora lo confirma variable). Sin embalaje ni envíos, es más simple de lo previsto | V2. Sin las comisiones cargadas sale **inflado**: queda detrás de una compuerta |
| **Punto de equilibrio** | Costos fijos clasificados de **al menos 3 meses** más margen de contribución confiable | V3, detrás de una compuerta como la de "días de stock": sin datos suficientes **no se muestra el número**, se muestra qué falta |

---

## 9. Estructura propuesta de la pantalla "Compras y gastos"

Conserva el vocabulario visual de `pos-preview` (`.bar`, `.kpis`, chips, tabla, modal de detalle; mismo tratamiento que `/gastos` y `/pedidos`).

- **Barra de título.** "Compras y gastos", con dos botones: **Cargar compra** y **Cargar gasto**.
- **KPIs:**
  - Plata que salió este mes.
  - Incurrido sin pagar.
  - Deuda a proveedores.
  - Vence en 7 días.
- **Pestañas:**
  1. **Resumen.** Fijos, variables y mixtos por mes (gráfico SVG de barras, ADR-0014); compras del mes frente a costo de lo vendido; próximos vencimientos.
  2. **Compras.** Facturas recibidas con su mercadería y fletes aplicados. Chips: Pendiente de recibir · A pagar · Pagada en parte · Pagada. Es donde va el formulario "Recibidas" del mockup, con "Incorporar a stock".
  3. **Gastos.** El alta rápida del mockup más la lista actual. Chips: Fijos · Variables · Mixtos · Sin comprobante · A pagar.
  4. **Proveedores.** Saldo, vencimientos y pagos por proveedor; **Pagar** aplica a facturas. Se mudan acá los "Acreedores al cierre" actuales.
  5. **Recurrentes.** Plantillas y calendario de vencimientos.
- **Detalle de una operación** (modal, como en Pedidos). Línea de tiempo factura → recepción → flete → pagos; ítems con costo de factura, flete prorrateado y costo final; adjuntos; saldo.

---

## 10. Orden recomendado de implementación (revisado con tus respuestas)

**Versión 1 — sobre lo que ya existe, sin tocar cómo se calcula el costo de lo vendido:**
1. **Fijo / variable / mixto** en gastos (columna más valor por defecto por categoría) y pestaña **Resumen** con fijos y variables por mes.
2. **Proveedores:** vencimiento en las facturas a pagar, **pagos aplicados a facturas** (tabla de aplicaciones append-only, compatible con el libro por proveedor de ADR-0028), **cuenta de salida** (caja, banco 1, banco 2) y pestaña con próximos vencimientos.
3. **Fletes del expreso:** el expreso como proveedor con cuenta corriente; el flete se carga **junto con la compra** (llegan juntos), vinculado a ella y repartido por valor (o cantidad, o a mano), así cada venta guarda el costo completo.
4. **Gastos recurrentes** (plantillas, vencimientos previstos y conciliación al cargar).
5. Renombrar el ítem a **"Compras y gastos"** y reorganizar en pestañas.

**Versión 2:**
6. **Factura "pendiente de recibir"** (llegó por mail antes que la mercadería) y confirmación de recepción, total o parcial.
7. **Comisiones de cobro**, cargadas por mes desde el resumen de cada posnet (cuando estén los porcentajes, pendiente 1), y **margen de contribución**, detrás de una compuerta hasta tener un mes completo de comisiones.
8. *(Opcional, según pendiente 2)* **Posnet en cada cobro del POS**, para calcular comisiones venta por venta y saber cuánto entra en cada banco.

**Versión 3:**
9. Punto de equilibrio con compuerta (3 meses de costos fijos clasificados).
10. Saldo y conciliación de los dos bancos.
11. Vínculo pedido → compra ("por encargar al proveedor").
12. "Emitidas", cuando esté el certificado AFIP.

**Por qué este orden:** con la factura llegando junto con la mercadería, todo lo que pidió tu novia (fijos y variables, cuánto debo, qué vence y desde qué banco pagué) y además el flete en el costo entran en la V1, sin el mecanismo riesgoso de costos provisorios.

**Lo que la implementación va a necesitar de vos:**
- **Eventos de auditoría nuevos.** Por ejemplo, pago aplicado a factura, flete aplicado a compra y recepción confirmada. El catálogo es cerrado, así que van con tu aprobación.
- **La categoría para las comisiones de cobro.** La lista actual es la de la contadora, así que se agrega con su acuerdo.

---

## 11. Qué NO implementar

- **Orden de compra formal y "three-way match":** desproporcionado para un comercio de 1 a 3 personas.
- **Remito separado con costo provisorio:** confirmado que la factura llega con la mercadería (2026-11-18). No hace falta.
- **Ajuste de costo por flete tardío:** el flete llega con la mercadería (2026-11-18). No hace falta.
- **Una cuenta aparte para el QR:** el QR se cobra por los posnets y acredita en sus bancos.
- **Contabilidad por partida doble o plan de cuentas:** Pandora no es un sistema contable (CLAUDE.md §1.8).
- **Liquidación de sueldos:** NON-GOAL. Sólo se registra el pago.
- **Repartir costos fijos entre productos** (costeo por absorción): distorsiona el margen de cada artículo en un comercio.
- **Reparto de fletes por peso o volumen:** no hay datos de peso ni volumen en el catálogo.
- **Lectura automática de facturas con IA (OCR):** F1+/F2. Si llega, sólo sugiere y una persona confirma (ADR-0024).
- **Conciliación bancaria automática:** F2+.
- **Presupuestos de gastos:** no los pidió nadie todavía.

---

## Fuentes (consultadas el 2026-11-18)

- OpenStax, *Principles of Managerial Accounting*, 2.2 "Identify and Apply Basic Cost Behavior Patterns": https://openstax.org/books/principles-managerial-accounting/pages/2-2-identify-and-apply-basic-cost-behavior-patterns
- OpenStax, *Principles of Managerial Accounting*, cap. 2, términos clave: https://openstax.org/books/principles-managerial-accounting/pages/2-key-terms
- NIC 2 Inventarios (texto en castellano, Ministerio de Economía y Finanzas de Uruguay): https://www.gub.uy/ministerio-economia-finanzas/institucional/normativa/norma-internacional-contabilidad-2-nic-2
- CTCP Colombia, Concepto 437 de 2021: https://www.cijuf.org.co/node/22088
- ERPNext, Purchase Receipt: https://docs.frappe.io/erpnext/purchase-receipt
- ERPNext, Landed Cost Voucher: https://docs.frappe.io/erpnext/landed-cost-voucher
- Odoo, Landed costs: https://www.odoo.com/documentation/master/applications/inventory_and_mrp/inventory/inventory_valuation/landed_costs.html
- LibreTexts, *Introducción a los Negocios*, "El punto de equilibrio": https://espanol.libretexts.org/Bookshelves/Negocio/Negocios/Negocio_Introductorio/Libro%3A_Introduccion_a_los_Negocios_(Lumen)/16%3A_Contabilidad_y_Finanzas/16.04%3A_El_punto_de_equilibrio
