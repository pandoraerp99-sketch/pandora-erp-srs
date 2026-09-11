# Devoluciones — Investigación exhaustiva (pre-diseño)

**Fecha:** 2026-07-02
**Objetivo:** definir TODO lo que puede/debe tener el apartado **Devoluciones** de Pandora antes de diseñarlo. Segunda de las 2 pantallas que vienen del proyecto viejo `lisCobro` (sedería LIS) y que al owner no le gustan cómo quedaron. Frentes: (1) fiscal AR (Nota de Crédito), (2) mejores prácticas POS, (3) marco legal del consumidor AR.

> ⚠️ **Contexto de roadmap:** en Pandora, las **Notas de Crédito son F1+** (CLAUDE.md §5.3: "F0 solo emite facturas"). O sea: la pantalla es una **maqueta del futuro**; el motor fiscal de NC real es F1. Esto NO impide diseñarla — sí impide hardcodear el flujo fiscal ahora (fail-closed).

---

## 1. Qué es y para qué sirve

Una **devolución** = el cliente trae mercadería vendida y (a) se le devuelve la plata, (b) se la cambia por otra, o (c) se le da un **saldo a favor / vale**. Puede ser **total** (toda la venta) o **parcial** (algunos ítems).

**Caso sedería:** vendiste 3 m de tela, el cliente trae 1 m que sobró / vino fallado → devolución parcial. O trae todo porque no era el color → cambio o reembolso.

Es el **espejo** de una venta: revierte plata + (opcional) devuelve stock + genera el comprobante fiscal que corresponde (Nota de Crédito).

---

## 2. Tipos de devolución

| Eje | Opciones |
|---|---|
| **Alcance** | Total (toda la venta) · Parcial (algunos ítems / cantidades) |
| **Forma de reintegro** | Reembolso en **efectivo** · **Saldo a favor / vale** (crédito en la tienda) · **Cambio** (return + nueva venta) · Reversa a **tarjeta** (contracargo/anulación) |
| **Vínculo** | Con venta original (lo ideal — se ata al ticket) · Sin venta (excepcional, requiere motivo + aprobación) |
| **Motivo** | Fallado / defectuoso · No le gustó / no le quedó · Se equivocó de producto · Regalo · Diferencia de precio |
| **Fiscal** | Con comprobante original (→ Nota de Crédito) · Sin comprobante (ticket interno / informal) |

---

## 3. Fiscal (AR) — 🔴 el corazón, la Nota de Crédito

### La regla (RG 4540/2019, vigente desde 1/7/2020 · RG 1415)
La devolución de una venta que se **facturó** se documenta con una **Nota de Crédito (NC)**:
- La emite **el mismo que emitió la factura original**, al **mismo receptor**.
- Debe ser del **mismo tipo** que el comprobante original (NC **A** para factura A, **B** para B, **C** para C).
- Debe **referenciar el comprobante asociado** (Nº de la factura/tique original) — comprobante asociado obligatorio en WSFEv1.
- **Plazo: 15 días corridos** desde que surge el hecho (la devolución).
- **Revierte el IVA** proporcional a lo devuelto.
- **Total** → NC por el total. **Parcial** → NC por los ítems/cantidades devueltos.

### TDF / Ley 19.640
Si la venta fue exenta (amparada), la NC también es exenta (`ImpOpEx`), pero **igual se emite** referenciando el comprobante.

### Tique / consumidor final
Si la venta fue un Tique / Factura B o C a consumidor final, la NC es B/C referenciando ese comprobante. (En Pandora, ver tipos de comprobante y CondicionIVAReceptor — [[adr-0023-snapshot-fiscal-completo-2026-06-02]].)

### Reversa a tarjeta
Si se pagó con tarjeta, además de la NC fiscal hay que gestionar el **contracargo/anulación** con la tarjeta (Payway/Prisma/Fiserv). Eso es integración de medios de pago → **F2+**.

### ⚠️ Estado en Pandora
- **NC = F1+** (CLAUDE.md). El motor fiscal (emitir NC vía WSFEv1, revertir IVA, comprobante asociado) es **Sprint F1**.
- En el **mockup F0** se diseña el flujo + se muestra "se generará la Nota de Crédito" como resultado, pero **no se hardcodea la emisión**.
- **[VERIFICAR CON CONTADORA]** — preguntas §10.

---

## 4. Marco legal del consumidor (AR) — lo que el comercio DEBE respetar

- **Ley 24.240 (Defensa del Consumidor, nacional):** derecho de **arrepentimiento** — 10 días corridos para compras a distancia / fuera del local → reintegro sin penalidad (art. 34). (Para venta en local presencial no hay obligación legal nacional de aceptar cambios "porque no me gustó"; es política del comercio.)
- **Ley 3281 (CABA) y similares provinciales:** productos **no perecederos** → cambio/devolución dentro de **30 días corridos** (si el comercio pone un plazo menor, vale 30). Si queda **saldo a favor** del cliente, el comercio debe darle un **vale** (o efectivo, a elección del comercio); el vale vale **90 días** mínimo. El **ticket de cambio** debe referenciar la compra original con un código único.
- **[VERIFICAR]** el equivalente en **Tierra del Fuego** (norma provincial de defensa del consumidor) — para F0 usamos el marco nacional + política del comercio configurable.

**Implicancia de diseño:** Pandora debería permitir configurar la **política de cambios** (plazo, si acepta "por no me gustó", si da efectivo o solo vale) y mostrarla.

---

## 5. Datos / campos

**Devolución (header):**
- Nº de devolución (secuencial)
- **Venta original** (link + Nº comprobante) — la base de todo
- Cliente (del snapshot de la venta)
- Fecha
- Ítems devueltos (ver abajo)
- **Motivo** (fallado / no le gustó / equivocado / regalo / diferencia)
- **Tipo de reintegro** (efectivo / saldo a favor / cambio / reversa tarjeta)
- **Monto devuelto**
- ¿**Vuelve al stock**? (sí/no — fallado no vuelve; sano sí)
- Comprobante fiscal generado (**Nota de Crédito** — F1)
- Aprobado por (si supera umbral / política)
- Notas
- Auditoría (quién, cuándo)

**Ítem devuelto:**
- Link al ítem de la venta original (`venta_item_id`)
- Producto · Cantidad devuelta (≤ vendida) · Precio unit. · Subtotal
- ¿Vuelve al stock? (por ítem)

---

## 6. Funcionalidades (universo completo)

### 6.1 Iniciar una devolución
- **Buscar la venta original** (por Nº, cliente, fecha, producto) → traer sus ítems. ⭐ Atar al ticket es la mejor práctica.
- Elegir **qué ítems** y **qué cantidad** devolver (parcial).
- Devolución **sin venta** (excepcional): manual + motivo + aprobación.

### 6.2 Motivo (obligatorio)
- Lista: Fallado/defectuoso · No le gustó/no le quedó · Producto equivocado · Regalo · Diferencia de precio · Otro.
- Da **insights** (qué producto se devuelve más).

### 6.3 Reintegro
- **Efectivo** → sale de Caja (egreso).
- **Saldo a favor / vale** → crédito en cuenta corriente del cliente (vale 90 días, código único).
- **Cambio** → devolución + nueva venta en una sola operación (más rápido, retiene la venta).
- **Reversa a tarjeta** (F2+ — integración con la terminal).

### 6.4 Stock
- **¿Vuelve al stock?** por ítem (sano vuelve, fallado no → merma). Reposición separada del estado de la devolución (evitar stock fantasma).

### 6.5 Fiscal
- Generar **Nota de Crédito** del tipo correcto, referenciando el comprobante original (F1). Revertir IVA. Mostrar el comprobante.

### 6.6 Aprobación / control
- Umbral configurable: devoluciones grandes o sin ticket requieren **aprobación** (rol dueño). Anti-fraude interno.

### 6.7 Listado / búsqueda / reportes
- Historial de devoluciones (fecha, cliente, motivo, monto, tipo).
- **Totales**: total devuelto (período), cantidad, **tasa de devolución** (devoluciones/ventas), **top motivos**, top productos devueltos, devoluciones por cajero (control).

### 6.8 Comprobante / impresión
- **Comprobante de devolución** para el cliente + la **Nota de Crédito** (F1) + el **vale** si es saldo a favor.

### 6.9 Vínculos con el resto de Pandora
| Con | Cómo |
|---|---|
| **Ventas** | se ata a la venta original (comprobante asociado) |
| **Caja** | reembolso en efectivo = egreso de caja |
| **Stock** | ítems sanos vuelven al stock |
| **Clientes** | saldo a favor = crédito en cuenta corriente |
| **Fiscal** | Nota de Crédito (F1) |
| **Pedidos/Señas** | cancelar pedido con seña facturada → NC (mismo motor) |
| **Reportes** | tasa de devolución, motivos, merma |

---

## 7. UX / diseño (Dawn Sky) — cómo superar el tema oscuro de lisCobro

**Qué está flojo en lisCobro:** pantalla oscura, "Resumen de Devoluciones (-$0)" + "No hay devoluciones para mostrar", y el **flujo de hacer** una devolución no se ve (botón "Nueva Devolución" y listo).

**Cómo lo haría en Pandora:**
1. **Header glass** (título + acción "Nueva devolución"), NO flotando (aprendizaje de Pedidos).
2. **KPIs arriba**: total devuelto (mes) · cantidad · tasa de devolución · motivo top.
3. **El flujo de "Nueva devolución" como asistente claro** (modal/paso a paso):
   - **1. Buscar la venta** → aparece con sus ítems.
   - **2. Tildar qué se devuelve** (ítems + cantidad, parcial).
   - **3. Motivo.**
   - **4. Tipo de reintegro** (efectivo / vale / cambio) + ¿vuelve al stock?
   - **5. Confirmar** → muestra "se genera Nota de Crédito" (F1) + comprobante.
4. **Historial** como cards/lista legible: cliente, venta original, motivo (chip), monto, tipo de reintegro.
5. **Rail**: motivos top (mini-gráfico), política de cambios configurable, tip fiscal (NC).

---

## 8. Referencia lisCobro + gaps

**Tenía** (schema `devoluciones` + `devoluciones_items`): link a `venta_id`, cliente, **motivo**, `tipo_devolucion` (default `REEMBOLSO_EFECTIVO`), notas, `monto_total`, estado; ítems con `venta_item_id`, producto, cantidad, precio, subtotal. Pantalla: resumen + historial + "Nueva Devolución".

**Gaps (lo que sumamos):**
- ❌ Sin **Nota de Crédito** fiscal → ✅ (F1, pero se diseña el flujo).
- ❌ Sin **buscar/atar la venta original** con su detalle en el alta (flujo asistido).
- ❌ Sin **reposición de stock** explícita (¿vuelve o no?).
- ❌ Solo reembolso efectivo → ✅ **efectivo / vale-saldo a favor / cambio**.
- ❌ Sin **cambio** (return + nueva venta).
- ❌ Sin **aprobación / control** (anti-fraude interno).
- ❌ Sin **reportes** (tasa de devolución, motivos top).
- ❌ Sin **política de cambios** configurable.
- ❌ Sin **vale** con vencimiento 90 días.

---

## 9. Scope — qué diseñamos en la MAQUETA (F0) vs F1+

**Diseñar ahora (pantalla Devoluciones):**
- Listado/historial premium + KPIs + filtros.
- El **asistente "Nueva devolución"** (buscar venta → ítems → motivo → reintegro → confirmar).
- Guiño al resultado fiscal ("se genera la Nota de Crédito").
- Rail (motivos, política, tip).

**Mostrar como concepto, marcado F1+ / real:**
- 🔴 **Nota de Crédito real** (WSFEv1) = **F1** (CLAUDE.md). En el mockup se muestra el paso, no se emite.
- Reversa a tarjeta = **F2+**.

**Depende de humano:**
- **[VERIFICAR CONTADORA]** flujo NC (§10).
- **Política de cambios** por defecto (plazo, efectivo vs vale) → decisión owner + marco legal TDF.

---

## 10. Preguntas para la contadora (advisor doc)

1. **Nota de Crédito por devolución**: ¿NC del mismo tipo que la factura original siempre? ¿Algún caso de ND?
2. **Devolución parcial**: NC por los ítems devueltos referenciando la factura — ¿ok? ¿IVA proporcional?
3. **Tique / consumidor final**: ¿NC B/C referenciando el tique? ¿Requisitos?
4. **Saldo a favor / vale**: ¿tiene tratamiento fiscal (es un pasivo)? ¿O es solo comercial?
5. **TDF / Ley 19.640**: NC de venta exenta → ¿exenta (`ImpOpEx`)?
6. **Plazo 15 días** para la NC vs 30 días de derecho del consumidor: ¿cómo se concilian si el cliente devuelve al día 25?

---

## Fuentes

**Fiscal AR (Nota de Crédito):**
- [AFIP/ARCA — Emisión de notas de crédito y/o débito](https://servicioscf.afip.gob.ar/publico/abc/ABCpaso2.aspx?id_nivel1=562&id_nivel2=603&id_nivel3=2629&p=Emisi%C3%B3n+de+notas+de+cr%C3%A9dito+y/o+d%C3%A9bito)
- [RG 1415/2003 (Facturación y Registración)](https://www.argentina.gob.ar/normativa/nacional/resoluci%C3%B3n-1415-2003-81316/texto)
- [RG 4540/2019 (cómo/quién/cuándo emitir NC y ND)](https://contadoresenred.com/entro-en-vigencia-la-rg-4540-19-sobre-emision-de-notas-de-debito-y-credito/)

**POS returns/refunds (funcional):**
- [Square — Process a return or exchange](https://squareup.com/help/us/en/article/6350-process-a-return-or-exchange-with-square-for-retail) · [Shopify POS — returns & store credit](https://help.shopify.com/en/manual/sell-in-person/shopify-pos/payment-management/store-credit/returns-and-exchanges)
- [Lightspeed — returns, exchanges, refunds](https://onsite-support.lightspeedhq.com/hc/en-us/articles/226834568-Doing-POS-returns-exchanges-and-refunds) · [Scantranx — returns POS workflow](https://scantranx.com/returns-and-exchanges-made-simple-a-pos-workflow-that-prevents-loss/)

**Marco legal consumidor AR:**
- [Ley 3281 CABA — devolución en comercios](https://juristeca.jusbaires.gob.ar/compilacion-normativa-juristeca/ley-3281/) · [GCBA — control cambios y devoluciones](https://buenosaires.gob.ar/noticias/defensa-al-consumidor-realizo-una-campana-para-que-se-respete-el-derecho-cambiar-productos)
- Ley 24.240 (Defensa del Consumidor, art. 34 arrepentimiento)
