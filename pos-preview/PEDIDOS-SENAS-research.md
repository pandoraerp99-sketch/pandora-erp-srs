# Pedidos / Señas — Investigación exhaustiva (pre-diseño)

**Fecha:** 2026-07-01
**Objetivo:** definir TODO lo que puede/debe tener el apartado **Pedidos/Señas** de Pandora antes de diseñarlo, para que no sea "así nomás". Fuente de verdad funcional: el proyecto viejo del owner (`lisCobro`, sedería LIS). Frentes investigados: (1) fiscal AR, (2) mejores prácticas POS (layaway/deposit/special-order), (3) práctica argentina real.

---

## 1. Qué es y para qué sirve (caso de uso real)

Un **pedido señado** = el cliente encarga algo que **no está disponible** (no hay stock, es a medida, es por cantidad grande, hay que traerlo del proveedor) y deja una **seña** (adelanto) para reservarlo. Paga el **saldo** al retirarlo.

**Caso sedería LIS (real):** cliente encarga *50 m de tafeta roja*, no hay tanto en el local. Deja seña de $20.000 sobre $160.000. La sedería lo pide al proveedor. Cuando llega, avisa al cliente, que pasa a retirar y paga el saldo ($140.000).

Es el equivalente argentino de **layaway / special order / work order** de los POS internacionales, combinado con **cuenta corriente de cliente**.

**Dolores que resuelve:**
- No perder la venta de algo que no hay en el momento.
- No olvidarse de encargar / de avisar / de que el cliente retire.
- Saber en todo momento **cuánto falta cobrar** (saldo) y **qué falta entregar**.
- Que la seña quede registrada (plata que entró a caja pero la venta todavía no está "cerrada").

---

## 2. Ciclo de vida (estados) — el corazón del apartado

El proyecto viejo tiene un estado casi binario (`pendiente` / `listo`). Un módulo completo maneja un **ciclo real**:

```
BORRADOR (opcional)
   │  se confirma + se toma seña
   ▼
SEÑADO / PENDIENTE ──────────► el pedido está encargado, con seña, saldo pendiente
   │  (llega la mercadería / se termina el trabajo)
   ▼
LISTO PARA RETIRAR ──────────► avisar al cliente (WhatsApp)
   │  (cliente paga saldo + retira)
   ▼
ENTREGADO / COMPLETADO ──────► se convierte en VENTA (y factura). Cierra el ciclo.

Ramas alternativas:
   • VENCIDO        → pasó la fecha de retiro y no retiró (sigue apareciendo, en rojo)
   • CANCELADO      → el cliente se arrepiente → política de devolución de seña
   • ENTREGA PARCIAL → retira parte, queda saldo + ítems pendientes
```

**Transiciones que el sistema debe permitir/registrar:**
| De | A | Disparador |
|---|---|---|
| Señado | Listo | mercadería llegó / trabajo terminado |
| Señado/Listo | Entregado | cliente pagó saldo + retiró |
| Señado/Listo | Vencido | pasó fecha_retiro (automático, no manual) |
| Cualquiera | Cancelado | cliente cancela → resolver seña |
| Señado/Listo | Entrega parcial | retira parte |

Cada transición deja **fecha + quién** (auditoría) — patrón Pandora.

---

## 3. Fiscal (AR) — 🔴 CRÍTICO, lo que ningún POS común resuelve bien

Pandora es fiscal. La seña tiene tratamiento fiscal real (esto es el **diferenciador**):

### La regla (RG 707/1999 + Ley IVA art. 5, inc. a)
- **Seña que CONGELA precio** → **perfecciona el hecho imponible por el monto recibido**. Es decir: **hay que emitir comprobante + liquidar IVA sobre la seña en el momento de recibirla**. No se espera a la entrega.
- **Seña que NO congela precio** → **no** genera hecho imponible → **no** hay IVA sobre la seña (es un simple depósito en garantía). Se factura todo al entregar.
- En la **entrega**, el hecho imponible del saldo se perfecciona con la entrega / factura / acto equivalente, lo que ocurra primero.

### Qué implica para Pandora
El sistema debe preguntar/saber, al tomar la seña: **¿esta seña congela precio?**
- **Sí** (lo típico cuando se pacta precio firme): emitir **factura por la seña** ahora + factura por el saldo al entregar. Dos comprobantes.
- **No**: sin factura hasta la entrega; la seña es un movimiento de caja/cuenta corriente, no una venta fiscal.

### TDF / Ley 19.640
Si la mercadería está amparada (exenta), la seña sigue la misma suerte (exento vía `ImpOpEx`), pero **igual hay que emitir el comprobante** cuando congela precio. Ver [[fiscal-architecture-core]].

### Cancelación
Si el pedido se cancela y ya se facturó la seña → **Nota de Crédito** para revertir (esto engancha directo con el apartado **Devoluciones** que viene después).

### ⚠️ Marca
**[VERIFICAR CON CONTADORA]** — confirmar: (a) tratamiento por defecto (¿asumimos que la seña congela precio?), (b) tipo de comprobante para la seña, (c) cómo se documenta la relación seña↔saldo↔entrega, (d) TDF. Va al advisor doc como pregunta nueva. **NO hardcodear el flujo fiscal hasta cerrar esto** (regla fail-closed fiscal, CLAUDE.md §8).

---

## 4. Datos / campos (modelo completo)

**Pedido (header):**
- Nº de pedido (secuencial legible)
- Cliente (link a Clientes + snapshot nombre/tel)
- Fecha de creación
- **Fecha de retiro estimada** (clave)
- Items (ver abajo)
- Subtotal · Descuento (tipo/valor/monto) · **Total**
- **Seña** (monto) + fecha + medio de pago de la seña
- **Saldo** (= total − pagado)
- Estado (ciclo §2)
- **¿Congela precio?** (fiscal §3)
- Notas / detalle del encargo (ej. "tafeta roja, tono bordó, para vestido de novia")
- Comprobante(s) asociado(s) (factura seña / factura saldo / NC)
- Auditoría (creado por, transiciones)

**Item del pedido:**
- Producto (link) o **ítem libre / a medida** (ej. "corte de 50 m", "cortinado a medida")
- Cantidad (soporta decimales — metros, fracciones)
- Precio unitario · Total
- (para sedería: unidad = metro/unidad)

**Pagos (histórico, NO un solo campo `sena`):** ⭐ mejora sobre lisCobro
- Cada pago: fecha, monto, medio (efectivo/débito/transferencia/MP), tipo (seña / pago parcial / saldo final)
- Permite **varios pagos parciales** (cuenta corriente del pedido), no solo una seña única.

---

## 5. Funcionalidades (universo completo, priorizado)

### 5.1 Crear / editar pedido
- Alta con cliente + items + seña + fecha de retiro + nota.
- **Ítems a medida / libres** (no solo productos del catálogo) — indispensable para sedería (cortes, trabajos).
- Cantidades decimales (metros).
- Descuento.
- Duplicar pedido (encargos repetidos de mayoristas).

### 5.2 Pagos y saldo
- Registrar **seña** (con medio de pago) → **entra a Caja** como ingreso.
- Registrar **pagos parciales** posteriores (cuenta corriente del pedido).
- **Cobrar saldo** al entregar.
- Barra/indicador visual **pagado vs total** ("$20.000 de $160.000 · falta $140.000").
- Historial de pagos del pedido.

### 5.3 Estados y avisos
- Cambiar estado (Señado → Listo → Entregado) con un toque.
- **Vencido automático** por fecha_retiro (rojo, sigue apareciendo hasta resolver — el owner ya pidió esta persistencia).
- **Aviso al cliente por WhatsApp** ("tu pedido está listo para retirar") — práctica AR estándar. Link `wa.me` con mensaje pre-armado. (F1 real; en mockup se muestra el botón.)
- Recordatorio de retiro / de encargar al proveedor.

### 5.4 Stock
- **Reservar stock** al señar (descontar de disponible sin vender) — evita revender lo comprometido. Patrón layaway internacional.
- Si es a medida / se pide al proveedor: marcar como "por encargar al proveedor" (engancha con Pedidos a proveedor / Compras — F1+).

### 5.5 Entrega
- **Entrega total**: cobra saldo → genera **venta + factura** (fiscal §3) → estado Entregado.
- **Entrega parcial**: retira parte, la seña se prorratea sobre lo retirado, queda saldo + ítems pendientes (patrón Lightspeed/RMH).

### 5.6 Cancelación / devolución de seña
- Cancelar pedido → **política de seña**: ¿se devuelve, se retiene, se da crédito? (configurable).
- Si ya se facturó la seña → **Nota de Crédito** (link a Devoluciones).

### 5.7 Listado / búsqueda / filtros
- Buscar por cliente / Nº / producto.
- Filtrar por **estado** (Señado / Listo / Vencido / Entregado) y por **fecha de retiro** (hoy / esta semana / vencidos).
- Orden por urgencia (vencidos y "listos sin retirar" arriba).

### 5.8 Reportes / totales (arriba del listado)
- **Saldo total por cobrar** (suma de saldos pendientes) — plata que le deben.
- **Señas cobradas** en el período.
- **Pedidos pendientes de retiro** (cantidad) + **vencidos**.
- Valor de mercadería comprometida/reservada.

### 5.9 Comprobantes / impresión
- **Recibo de seña** para el cliente (con Nº de pedido, seña, saldo, fecha de retiro) — que se lleve el papelito.
- Factura de la seña (si congela precio, §3).

### 5.10 Vínculos con el resto de Pandora (lo que lo hace ERP, no una isla)
| Con | Cómo |
|---|---|
| **Clientes** | cuenta corriente del cliente, historial de pedidos |
| **Stock** | reserva al señar, baja al entregar |
| **Caja** | la seña y los pagos entran como ingreso |
| **Fiscal** | factura seña + factura saldo (o solo al entregar) según §3 |
| **Calendario / Pendientes** | fecha de retiro aparece en el calendario + "retirar X" en Pendientes (¡ya lo mockeamos!) |
| **Devoluciones** | cancelación con seña facturada → Nota de Crédito |
| **Reportes** | saldos por cobrar, señas del mes |

---

## 6. UX / diseño (Dawn Sky) — cómo superarlo al proyecto viejo

**Qué está mal en lisCobro (tema oscuro):** tabla fría Fecha/Cliente/Total/Seña/Saldo/Estado; el estado es un chip binario; no se ve de un golpe *cuánto falta / cuándo retira / si venció*; hacer una acción requiere entrar a "Ver".

**Cómo lo haría en Pandora:**
1. **Cards, no tabla fría** (o tabla con mucho más aire + jerarquía). Cada pedido = una tarjeta glass.
2. **Barra de progreso seña/saldo** visible en cada card (pagado vs total).
3. **Estado como pasos del ciclo** (Señado → Listo → Entregado), no un chip suelto — se entiende el flujo.
4. **Fecha de retiro prominente** + **rojo/alerta si vencido** ("debía retirar el 24 · sin retirar").
5. **Acciones rápidas en la card** (Cobrar saldo · Marcar listo · Avisar por WhatsApp · Entregar) — sin entrar a otra pantalla.
6. **Barra de totales arriba**: saldo total por cobrar · pendientes de retiro · vencidos.
7. **Agrupar por urgencia**: Vencidos → Listos sin retirar → Señados → Entregados (colapsado).
8. Botón claro **"＋ Nuevo pedido señado"** que abre el alta (cliente + items + seña + fecha).

---

## 7. Referencia lisCobro (qué tenía) + gaps a cubrir

**Tenía** (schema `pedidos_senados`): cliente, fecha, subtotal, descuento, total, **una** seña, saldo, fecha_retiro, estado, notas + items (producto, cantidad, precio). Listado con búsqueda + filtro estado + "Ver". Alta "Nuevo Pedido Señado".

**Gaps (lo que sumamos):**
- ❌ Solo **una** seña → ✅ **múltiples pagos parciales** (cuenta corriente del pedido).
- ❌ Sin **reserva de stock**.
- ❌ Sin nada **fiscal** (factura de seña / IVA / congela precio).
- ❌ Estado casi binario → ✅ **ciclo completo** + vencido automático.
- ❌ Sin **aviso al cliente** (WhatsApp).
- ❌ Sin **recibo de seña** imprimible.
- ❌ Sin **vínculo** a Caja/Stock/Calendario/Devoluciones.
- ❌ Sin **totales/reportes** (saldo por cobrar).
- ❌ Sin **entrega parcial**.
- ❌ Sin **ítems a medida/libres** claros (sedería los necesita).

---

## 8. Scope — qué diseñamos en la MAQUETA Pandora (F0) vs visión completa

> Es una **maqueta visual** (pos-preview). Mostramos el DISEÑO y las interacciones, no un backend real.

**Diseñar ahora en el mockup (la pantalla Pedidos/Señas):**
- Listado premium (cards, barra seña/saldo, ciclo de estado, fecha retiro + vencido, acciones rápidas).
- Barra de totales (saldo por cobrar, pendientes, vencidos).
- Filtros (estado + fecha).
- Botón + detalle "Nuevo pedido señado" (alta con items + seña + fecha).
- Detalle de un pedido (con historial de pagos + acciones).
- Guiños al vínculo (WhatsApp, "aparece en el calendario").

**Mostrar como concepto pero marcar F1+/real (no backend):**
- Aviso WhatsApp real, reserva de stock real, generación de factura real.

**Diferir / depende de humano:**
- 🔴 **Flujo fiscal de la seña** (congela precio, factura) → **pregunta a contadora** (§3). En el mockup se muestra la opción "¿congela precio?" pero el flujo fiscal real es Sprint 6 fiscal, gated.
- Entrega parcial (F1 — es complejidad extra; F0 = entrega total).
- Política de cancelación configurable (F1).

---

## 9. Preguntas para la contadora (nuevas, para el advisor doc)

1. **Seña que congela precio**: ¿asumimos por defecto que la seña de un pedido congela precio (→ factura + IVA al señar)? ¿O depende y hay que preguntarlo por pedido?
2. ¿Qué **tipo de comprobante** para la seña? (factura A/B/C según cliente).
3. Al **entregar**: ¿factura por el saldo, o factura total con la seña ya imputada? ¿Cómo se relacionan los comprobantes?
4. **Cancelación** con seña facturada → Nota de Crédito: ¿algún recaudo?
5. **TDF/Ley 19.640**: seña de mercadería exenta → ¿el comprobante de la seña también exento (`ImpOpEx`)?

---

## Fuentes

**Fiscal AR:**
- [AFIP — IVA señas o anticipos que congelan precio (PDF)](https://www.afip.gob.ar/presentaciones-digitales/documentos/IVA-obras-inmueble-propio-senas-o-anticipos-que-congelen-precio.pdf)
- [AFIP — Normativa de facturación (ayuda)](https://www.afip.gob.ar/facturacion/ayuda/normativa.asp)
- RG 707/1999 + Ley IVA art. 5 inc. a (hecho imponible; seña que congela precio) — vía fuentes anteriores.

**POS layaway / deposit / special order:**
- [ConnectPOS — Layaway partially paid order](https://www.connectpos.com/knowledgebase/layaway-sales-partially-paid-order/) · [Layaway payment method](https://www.connectpos.com/layaway-payment-method-in-pos/)
- [Lightspeed Retail — Managing deposits / credit accounts](https://retail-support.lightspeedhq.com/hc/en-us/articles/229129228-Managing-credit-accounts)
- [RMH POS — About layaways](https://docs.rmhpos.com/1377502/Content/Topics/POS_UG_Topics/about-layaways.html) · [Oracle Xstore — Layaway transactions](https://docs.oracle.com/en/industries/retail/retail-xstore-point-of-service/22.0/rpxmo/layaway-transactions.htm)
- [Realtime POS — Special/Sales orders](https://realtimepos.com/sales-orders-and-special-orders/) · [MicroBiz — Customer & work orders](https://microbiz.com/customer-orders-work-orders-in-pos/)

**Software de gestión AR (señas, cuenta corriente, WhatsApp):**
- [Control Comercio](https://controlcomercio.com/precios) · [Gestión Comercio](https://gestioncomercio.com.ar/) · [Zoo Logic / Dragonfish](https://www.zoologic.com.ar/descubri-el-software-para-comercios-mas-completo-en-argentina/)
