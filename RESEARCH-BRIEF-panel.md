# Research Brief — `Panel` (pantalla de inicio)

**Fecha:** 2026-09-10
**Estado:** 🚧 parcial — 4 de 7 bloques (`db428ef`…`aa19918`). Los 3 que faltan esperan DATO: merma (ya hay una fila `loss` real desde `dc7b98c`), régimen, vencimientos
**Autor:** sesión Claude (owner: Agus)
**Relacionado:** ADR-0012 (atmospheres · Panel = *Insight*) · ADR-0014 (charts SVG puros) · commits `db428ef` `5c5aedb` `a6622b4` `911ec5e`

---

## 1. Objetivo del módulo

La pantalla que se abre primero. Tiene que contestar, sin que nadie navegue a
ningún lado: **cómo viene el día, dónde está la plata, y qué hay que hacer ahora**.

## 2. Problema de negocio

- **Problema:** hasta el 2026-09-10 `/panel` era la **maqueta estática** servida
  desde `public/panel.html`, sin auth, con todos los números escritos a mano. Se
  veía hermosa y no decía nada.
- **Usuarios:** el dueño (mira el día y el mes) y el cajero (abre y cierra caja).
- **Impacto:** **alto.** Es la primera impresión del producto y la única pantalla
  que se mira todos los días sin buscar nada.
- **Complejidad:** media. Casi todos los datos ya existen; el trabajo es
  elegir cuáles y no inventar los que faltan.

## 3. Investigación (fuentes)

| Categoría | Qué se miró | Hallazgo clave | Fuente |
|---|---|---|---|
| Competidores POS retail | KORONA POS, PosNation, EposNow, Shopify, NetSuite | El set canónico: ventas, **margen bruto**, rotación de inventario, sell-through, quiebres de stock, devoluciones, **merma**, ticket promedio, retención de clientes | [KORONA](https://koronapos.com/blog/retail-kpi-dashboard/) · [PosNation](https://www.posnation.com/blog/retail-store-performance-dashboard-kpis) · [Shopify](https://www.shopify.com/blog/store-performance-dashboard) |
| Crítica / voz del usuario | Qué se le reprocha a estos dashboards | **"Un total de ventas no te dice por qué el día estuvo flojo, ni QUÉ GÓNDOLA TE ESTÁ PAGANDO EL ALQUILER"**. La mayoría de los comercios sólo lee el total del día. | [VMS — Retail Metrics Hidden in Every Receipt](https://www.getvms.com/retail-metrics/) |
| Errores comunes | *Vanity metrics* | Elegir KPIs **accionables**; si no informan una decisión son estáticos y **engañan** sobre la performance | [KORONA](https://koronapos.com/blog/retail-kpi-dashboard/) |
| Estructura recomendada | Cómo ordenarlos | Primero resultado (ventas, margen, salud de inventario), después los **drivers** que explican el porqué | [Fanruan](https://www.fanruan.com/en/blog/retail-business-dashboard) |
| Tamaño del comercio | Chico vs cadena | Para un comercio chico, **una sola vista combinada alcanza**. No multi-dashboard. | [VMS](https://www.getvms.com/retail-metrics/) |
| Evidencia propia | Pedido real de la contadora | Ver `EVIDENCIA-pedido-contadora-2026-09.md` | — |
| Inventario propio | Esquema real de la base (28 tablas) | Ver §3.b | — |

### 3.b Inventario del esquema — qué datos YA existen y el Panel no muestra

Esta es la investigación que ninguna fuente externa podía dar.

| Tabla · columna | Qué habilita | ¿Se usa hoy? |
|---|---|---|
| `products.category` | **Ventas por rubro** — "qué góndola paga el alquiler" | ❌ **en NINGUNA pantalla** |
| `products.cost` | Valor del stock (plata dormida) + margen **actual** | ❌ |
| `products.tdf_exempt` | Cuántos productos amparados Ley 19.640 | ❌ |
| `stock_movements.type` (`adjustment`, `loss`) | **Merma y ajustes** — señal de robo o error de carga | ❌ |
| `customers.created_at` + `sales.customer_id` | **Clientes activos**, nuevos vs que vuelven | ❌ |
| `customers.tags` | Segmentos comerciales | sólo en `/clientes` |
| `companies.merchant_special_regime` | Badge "Zona franca TDF · Ley 19.640" | ❌ (y está **vacío** en la demo) |
| `cash_movements.payee_name` / `reason` | Retiros por concepto | sólo en `/caja` |

## 4. Síntesis — ¿qué incorporamos?

| Fuente | Idea | ¿Vale? | Nota |
|---|---|---|---|
| VMS ("qué góndola paga el alquiler") | **Ventas por rubro** | ✅ | El hallazgo más fuerte. El dato existe y no se muestra en ningún lado. |
| Owner (pedido explícito) | **Clientes activos** | ✅ | Activos, nuevos, y los que vuelven. |
| Owner (pedido explícito) | **Acciones rápidas** | ✅ | Nueva venta · Nuevo gasto · Cargar producto. |
| Owner (pedido explícito) | **Abrir / cerrar caja** desde el panel | ✅ | El cajero no debería navegar para arrancar el turno. |
| Owner (pedido explícito) | **Día, mes, año** | ✅ | Trivial, y ancla el resto de los números. |
| KORONA / NetSuite | **Merma y ajustes de stock** | ✅ | `stock_movements` ya los guarda con motivo. |
| KORONA / NetSuite | **Valor del stock** | ✅ | `stock_current × cost`. Es plata quieta. |
| Maqueta del owner | Badge **Ley 19.640** | ✅ | Chico, y refuerza que Pandora es fueguino. |
| KORONA / NetSuite | **Margen bruto** | 🟡 | Ver §7 — sólo margen ACTUAL, rotulado. El histórico es imposible hoy. |
| KORONA | Rotación de inventario | 🟡 | Aproximable (unidades vendidas / stock). Diferido: sin costo histórico el número es flojo. |
| Owner (pedido explícito) | **Calendario / vencimientos** | ❌ | Ver §7. Bloqueado por dato, no por ganas. |

## 5. Estado del arte

El listón es el dashboard de Shopify / KORONA: ventas, margen, inventario,
clientes, todo en una vista. **Ninguno resuelve el problema fiscal argentino**
ni cruza gastos con ingresos, porque no tienen el módulo de gastos que Pandora
construyó la semana pasada.

## 6. Ideas innovadoras — qué hacemos MEJOR

1. **Ningún número inventado.** Los tres bloques de la maqueta sin dato detrás
   (comprobantes AFIP, meta del día, calendario) **no se rellenan con un cero** —
   un cero se lee como "no hubo movimiento", que es otra afirmación. Se dice qué
   falta y cuál es el próximo paso.
2. **La caja muestra la CUENTA, no el resultado.** Apertura + cobrado en efectivo
   + cobros de fiado − retiros = efectivo en caja. El cajero lo verifica contra
   el cajón en vez de confiar. Idea que trajo el owner y superó a la versión previa.
3. **El día es el del COMERCIO.** Todas las fronteras de tiempo pasan por
   `America/Argentina/Ushuaia`. Medido: a las 21:01 locales, contar en UTC daba
   20 ventas contra 13 reales — el comerciante veía su día reiniciarse con el
   local abierto.
4. **La curva no puede inventar.** Interpolación monótona (Fritsch–Carlson): una
   spline común dibuja plata que no existe entre los puntos. Verificado sobre el
   path renderizado, no sólo sobre la matemática.
5. **Ingresos vs Gastos real.** El único bloque que la maqueta **sólo podía
   dibujar**: los gastos no existían hasta hace una semana.

## 7. Qué NO vamos a implementar

| Idea descartada | Por qué | Trigger para revisar |
|---|---|---|
| **Margen bruto histórico** | `sale_items` **NO guarda el costo** (verificado). Calcularlo con el costo de HOY haría que subir un precio de compra cambie el margen de una venta de marzo. | Ver §8.b — hay que empezar a guardarlo |
| **Vencimientos fiscales** (calendario) | Las fechas tienen que salir de un calendario **verificado**: la regla del IVA por terminación de CUIT que repiten los blogs es **falsa** (`research-vencimientos-fiscales`) | Cargar el calendario verificado |
| **"Por pagar" a proveedores** | Todo gasto nace pagado. Es la mitad de "acreedores" que falta en el pedido de la contadora | Cuenta corriente de proveedores (F1+) |
| **Vencimientos de cuenta corriente** ("te vencen esta semana") | `customer_account_movements` no tiene columna de vencimiento | Agregar `due_date` (F1+) |
| **Proyección del mes** | Es un pronóstico. Un número grande en la pantalla de inicio se lee como promesa | Sólo con rótulo explícito, si el owner lo pide |
| **Tasa de conversión** | Necesita tráfico de personas. No hay sensor ni forma de saberlo | NON-GOAL sin hardware |
| **Costo laboral / ventas por empleado** | Payroll es NON-GOAL declarado | — |
| **Devoluciones** | El módulo no existe (es F1+, y una devolución facturada es NC) | Módulo devoluciones |
| **Meta del día** | No existe el concepto de meta. Inventar $400.000 es ponerle al comerciante una vara que nadie fijó | Si el owner quiere fijar metas → mini-dominio |
| **Rotación de inventario** | Sin costo histórico el número es flojo y se presta a mala lectura | Cuando exista el snapshot de costo |
| **Multi-dashboard / dashboards por rol** | Para un comercio chico **una sola vista alcanza** (fuente VMS). Configurabilidad = muerte del producto (CLAUDE.md §4.4) | 3+ clientes pidiéndolo |

## 8. Decisión de diseño

Se incorporan, en este orden: **fecha del día**, **acciones rápidas** (con
**abrir/cerrar caja**), **clientes activos**, **ventas por rubro**, **merma y
ajustes**, **valor del stock**, y el **badge Ley 19.640**.

El filtro que se aplicó a cada bloque, tomado de la crítica de *vanity metrics*:

> **¿Qué decisión cambia este número?** Si la respuesta es "ninguna, pero queda
> lindo", no entra.

### 8.b 🔴 Hallazgo que excede al Panel — `sale_items` no guarda el costo

El margen bruto es el KPI #2 de **todas** las fuentes consultadas, y en Pandora
es **imposible de calcular hacia atrás**: `sale_items` snapshotea nombre, sku,
precio, alícuota y exención — **pero no el costo**.

Es barato agregarlo de acá en adelante (`unit_cost_snapshot` en `sale_items`) e
**imposible de backfillear**: el costo de un producto cambia y no queda historia.
Cada día que pasa sin eso es un día de ventas sin margen recuperable.

**No se hace en este brief** (es un cambio de esquema en el camino de la venta,
merece su propio slice), pero queda anotado como lo próximo del área.

### 8.c Lo que entró en el primer slice, y por qué no los siete

Se construyeron **cuatro**: fecha del día, acciones rápidas (con abrir caja),
ventas por rubro y clientes del mes. Los otros tres se difieren, cada uno por
una razón distinta:

| Bloque | Estado | Por qué |
|---|---|---|
| **Merma y ajustes** | diferido | `stock_movements` tiene **0 filas** de tipo `adjustment` o `loss` en la base (medido). Un bloque sin un solo caso no se puede verificar, y se estaría diseñando contra la nada. Entra cuando exista el primer ajuste real. |
| **Valor del stock** | diferido | El dato existe ($163.900, medido) y es un renglón, no un bloque. Va con el próximo pase, junto a merma, en una tarjeta de inventario. |
| **Badge Ley 19.640** | diferido | `companies.merchant_special_regime` está **en NULL** en la demo (ya anotado en §3.b). Dibujar el badge exige primero poder cargar el régimen, y eso es la pantalla de Configuración. |

**Cerrar la caja NO se hizo desde el panel, y es deliberado.** Abrir es declarar
un fondo inicial; cerrar exige el arqueo por denominación y produce un descuadre
que hay que justificar. Un botón de "cerrar" en la pantalla de inicio sería, en
los hechos, una forma de cerrar la caja sin contarla. El panel abre, y manda a
`/caja` para el cierre.

### 8.d Hallazgo de accesibilidad — `--ink-3` está por debajo de AA

Midiendo el contraste **sobre los píxeles pintados** (no sobre el CSS
declarado, que con fondos translúcidos miente), el token `--ink-3` que usa
`.label-sm` en todo el Panel da **2,94 en claro y 3,95 en oscuro** contra el
4,5 que pide WCAG AA para texto normal.

**No lo introdujo este slice y no se cambió acá**: tocar el token redibuja
todas las pantallas de costado. Los textos nuevos que cargan contenido real
—la fecha, las etiquetas de clientes, el pie de cada rubro— sí se subieron a
`--ink-2`, que mide entre 4,7 y 6,9. Queda como ítem propio.

## 9. Plan de implementación

- **MVP (este slice):** los 4 bloques de §8.c, todos con dato real.
- **Mejoras futuras:**
  - `unit_cost_snapshot` en `sale_items` → habilita margen bruto real (§8.b).
  - Vencimientos fiscales cuando exista el calendario verificado.
  - Rotación de inventario cuando exista el costo histórico.
