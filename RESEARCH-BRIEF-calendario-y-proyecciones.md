# Research Brief — `Calendario`, `Agenda/Pendientes` y `Proyecciones`

**Fecha:** 2026-09-10
**Estado:** 🧩 diseño
**Autor:** sesión Claude (owner: Agus)
**Relacionado:** maqueta `public/panel.html` (bloques `#calCard` y `#pendCard`) · [`RESEARCH-BRIEF-vencimientos-fiscales.md`](RESEARCH-BRIEF-vencimientos-fiscales.md) · [`RESEARCH-BRIEF-panel.md`](RESEARCH-BRIEF-panel.md) §8.b · memoria `feedback-validar-fuentes-oficiales`

> ⚠️ **Esto NO es un slice, son tres.** El pedido ("un calendario que también sirva
> de agenda, y proyecciones de todo tipo") toca tres módulos con dependencias de
> datos distintas. El orden propuesto está en §9.

---

## 1. Objetivo

Tres cosas que el owner pidió juntas y conviene separar:

1. **Calendario** — el mes en grilla, con los días pintados según cuánto se vendió,
   feriados, y los vencimientos que se vienen.
2. **Agenda / Pendientes** — las tareas del comercio: reponer, llamar al proveedor,
   encargar lo del cliente García, hacer el arqueo.
3. **Proyecciones y análisis** — comparar contra el pasado y estimar lo que viene.

## 2. Problema de negocio — y el dato que condiciona TODO

- **Problema:** hoy eso vive en la cabeza, en un cuaderno y en la agenda del
  teléfono. El sistema tiene los datos pero no dice nada sobre el futuro.
- **Usuarios:** la dueña (qué se viene, qué comprar) y quien atiende (qué hay que
  hacer hoy).
- **Impacto:** alto. **Complejidad: alta**, y no por lo técnico.

### 2.a 🔴 El comercio real arranca en CERO filas

Esta es la restricción que manda sobre las tres cosas, y hay que decirla antes de
diseñar nada:

**Los 13 meses de datos que hay en la base son un seed sintético que escribí yo**
(`scripts/seed-dev-ventas.sql`). Tiene, hardcodeado:

- domingos cerrados y sábados a media máquina;
- un array de horas con el pico puesto a propósito en 18-19h;
- una tendencia de crecimiento lineal hacia el presente;
- **cero estacionalidad anual** — no hay repunte de diciembre ni de inicio de clases.

O sea: **medir un "patrón semanal" sobre ese seed es medir lo que yo mismo puse.**
Es circular y no prueba nada sobre el negocio real. Las 52 observaciones por día de
la semana que dan las consultas son 52 repeticiones de una regla inventada.

El comercio de verdad empieza **sin una sola venta**. Entonces la pregunta correcta
para cada bloque no es "¿tenemos el dato?" sino **"¿cuántas semanas de operación
real hacen falta para que este bloque diga algo?"**. Eso es §8.a.

## 3. Investigación (fuentes)

| Categoría | Qué se miró | Hallazgo clave | Fuente |
|---|---|---|---|
| Pronóstico con historia corta | Literatura de forecasting estacional en retail | El problema central del retail chico es **la historia corta**. Los estudios sobre comercios de alimentos chicos trabajan con **2-3 años**; con menos, la estacionalidad no se puede separar del ruido. | [CSUSB — Impact of seasonality on demand forecasting for small-scale food retailers](https://scholarworks.lib.csusb.edu/etd/1914/) · [ScienceDirect — Forecasting seasonal demand for retail](https://www.sciencedirect.com/science/article/abs/pii/S0169207023001383) |
| Métodos | Qué modelo usar | Holt-Winters y SARIMA le ganan a media móvil y suavizado simple **cuando hay estacionalidad que capturar**. Sin ciclos suficientes, el modelo sofisticado no mejora: sobreajusta. | [ScienceDirect — Time-series forecasting of seasonal items sales](https://www.sciencedirect.com/science/article/pii/S2667096822000027) |
| Métrica accionable | Qué mira un comercio chico de verdad | **Días de stock** (*days on hand*) y **punto de reposición**: `(venta diaria promedio × días de entrega) + stock de seguridad`. Convierte el stock en *tiempo*. | [inFlow — Reorder point formula](https://www.inflowinventory.com/blog/reorder-point-formula-safety-stock/) · [Retail Ops Toolkit](https://www.retailopstoolkit.com/calculators/inventory-management/reorder-point-calculator) |
| 🔴 Trampa de esa métrica | Cómo miente *days on hand* | **Baja igual cuando te quedás sin stock que cuando comprás mejor.** Un producto en cero muestra "0 días" y parece urgentísimo, pero el problema ya pasó. Hay que leerla al lado de los quiebres, o "optimizás" hacia la venta perdida. | [Retail Ops Toolkit](https://www.retailopstoolkit.com/calculators/inventory-management/reorder-point-calculator) |
| Errores comunes | Por qué los pronósticos engañan | El sesgo es **optimista**: se cuelan los casos excepcionales y el número queda inflado. Menos de la mitad de los responsables confía en su propio pronóstico. La IA encima hereda el exceso de confianza del que carga los datos. | [Challenger — Why you're getting sales projections wrong](https://challengerinc.com/blog/improve-sales-forecast-accuracy/) · [Force Management](https://www.forcemanagement.com/blog/forecast-inaccuracy-in-b2b-sales-causes-and-solutions) |
| Feriados (oficial) | Fuente para pintar el calendario | `argentina.gob.ar/feriados` publica **año por año**, en 4 categorías: inamovibles, trasladables, días no laborables y turísticos. **Las fechas se renderizan por JavaScript** — no se puede fetchear el listado como texto. Carga manual verificada, no scrape. | [argentina.gob.ar/interior/feriados](https://www.argentina.gob.ar/interior/feriados) (consultado 2026-09-10) |
| 🔴 Feriados (norma) | ¿Se pueden calcular? | Ley 27399: los trasladables que caen martes/miércoles pasan al lunes anterior, y jueves/viernes al lunes siguiente. **Pero el Ejecutivo fija hasta 3 días turísticos por año por decreto**, y **el calendario 2027 todavía no está publicado** (al 2026-09-10). Es la MISMA forma que la regla de CUIT que ya se probó falsa. | [Ley 27399, BO 18/10/2017](https://www.boletinoficial.gob.ar/detalleAviso/primera/172415/20171018) · [Decreto 1027/2024](https://www.boletinoficial.gob.ar/detalleAviso/primera/317188/20241121) |
| Feriados provinciales | TDF | La página nacional **no los incluye**. Es otro organismo y otra fuente. **No encontrada todavía** — queda abierto, no se adivina. | — |
| Vencimientos fiscales | Ya investigado | Ver [`RESEARCH-BRIEF-vencimientos-fiscales.md`](RESEARCH-BRIEF-vencimientos-fiscales.md): fuente utilizable `argentina.gob.ar/arca/vencimientos`, la regla por CUIT es falsa, y hubo 3 prórrogas en 2026. | — |
| Inventario propio | Esquema real | Ver §3.b | — |

### 3.b Qué hay en la base, y qué falta

Las 28 tablas actuales: **ninguna** sirve para agenda ni calendario.

| Necesita | ¿Existe? |
|---|---|
| Tareas / pendientes | ❌ no hay tabla |
| Notas por día | ❌ |
| Eventos de calendario | ❌ |
| Feriados | ❌ |
| Vencimientos fiscales | ❌ |
| Pedidos de clientes (los del mockup) | ❌ — sólo existe como maqueta HTML |
| Cuenta corriente de **proveedores** | ❌ — ya anotado en `RESEARCH-BRIEF-panel` §7 |
| Ventas por día / hora / producto | ✅ `sales` + `sale_items` |
| Stock actual y mínimo | ✅ `products` |

## 4. Síntesis — qué incorporamos

| Idea | ¿Vale? | Nota |
|---|---|---|
| **Heatmap de ventas en la grilla del mes** | ✅ | Es el único pedazo del calendario que **funciona con el dato de hoy**. Y es lindo *y* útil: se ve de un vistazo qué días laburás. |
| **Feriados** como dato verificado | ✅ | Con `verificado_at` y la categoría oficial. |
| **Vencimientos fiscales** cargados | ✅ | Ídem. Destraba lo que quedó pendiente del panel. |
| **Agenda / Pendientes** | ✅ | Dominio nuevo y chico. Ver §7 por qué NO es un widget. |
| **Días de stock restantes** | ✅ ⭐ | **La recomendación principal.** Es la única proyección que nombra una acción. |
| **Proyección de cierre de mes** (run-rate) | ✅ | Con rótulo explícito. Ver §6.2. |
| **Contra el mismo mes del año pasado** | ✅ | Cuando exista el año. Hoy no existe. |
| **Patrón por día de la semana** | 🟡 | Real y útil, pero recién después de ~2-3 meses de operación. |
| Exportar a Google Calendar / iPhone vía `.ics` | ✅ | Después de tener las fechas. Sin OAuth. Ver §6.3. |
| Estacionalidad anual / efecto de fechas especiales | ❌ | Ver §7. Necesita 2+ años. |
| Modelo SARIMA / Holt-Winters / ML | ❌ | Ver §7. |

## 5. Estado del arte

Los sistemas contables argentinos (Tango, Bejerman, Xubio) traen el calendario
**cargado por el proveedor** y lo actualizan por release; ninguno lo calcula. Los
POS grandes (Shopify, KORONA) sí traen pronóstico, pero corren sobre cadenas con
años de historia y miles de tickets por local.

El listón real para Pandora no es "pronosticar mejor". Es **no mentir mientras no
haya con qué**, y que se note cuándo el dato todavía no alcanza.

## 6. Ideas innovadoras — qué hacemos mejor

### 6.1 El calendario dice cuánto vendiste, no sólo qué día es

Un calendario que sólo muestra números del 1 al 30 no aporta nada — eso ya está en
el teléfono. Pintar cada día según lo que se facturó convierte la grilla en un
gráfico: se ve el patrón semanal, el día muerto, el efecto del feriado. **Y eso
funciona desde la primera semana**, sin ningún modelo.

### 6.2 Una proyección tiene que mostrar de qué está hecha

El sesgo documentado es optimista. Un número solo (`$2.400.000`) se lee como
promesa. La proyección va **siempre** con las tres cosas que la sostienen: sobre
cuántos días se calculó, cuál es el promedio diario, y cuánto falta del mes. Así se
puede discutir en vez de creer.

Y si el período de base es demasiado corto, **no se muestra el número** — se dice
cuánto falta para poder mostrarlo.

### 6.3 `.ics` antes que OAuth

Exportar un `.ics` le da Google Calendar, iPhone y Outlook de una sola vez, sin
OAuth, sin guardar tokens de Google por comercio en el vault (CLAUDE.md §11.8 /
§7.5) y sin mandarle los datos del negocio a un tercero desde el servidor. La
integración con OAuth sólo se justifica si Pandora tiene que **escribir** en el
calendario de la persona, que no es el caso.

### 6.4 Los feriados son dato verificado, igual que los vencimientos

La regla de traslado (martes/miércoles → lunes anterior) **existe y es tentadora**,
y es exactamente la misma forma que la regla de vencimientos por CUIT que se probó
falsa. El Ejecutivo agrega días turísticos por decreto y el calendario 2027 ni
siquiera está publicado. **Se cargan, no se calculan**, con la fecha en que se
verificaron.

## 7. Qué NO vamos a implementar

| Idea descartada | Por qué | Trigger para revisar |
|---|---|---|
| **Estacionalidad anual** ("diciembre es fuerte") | Con **un solo diciembre** no se puede distinguir estacionalidad de casualidad. La literatura trabaja con 2-3 años. Y el seed actual **no tiene ninguna** — cualquier patrón anual que "aparezca" hoy es ruido. | 2 años de operación real |
| **Efecto de fechas especiales** (Día de la Madre, inicio de clases) | Mismo motivo, peor: es UNA observación por fecha por año. | 2-3 años |
| **Modelos SARIMA / Holt-Winters / ML** | Ganan **cuando hay estacionalidad que capturar**. Sin ciclos suficientes sobreajustan y dan un número peor con más cara de exacto. Además contradice CLAUDE.md §20.1 y ADR-0024. | Si aparece estacionalidad validada Y el promedio simple falla medido |
| **Calcular feriados con la regla de traslado** | El Ejecutivo los mueve por decreto (Ley 27399, 3 turísticos/año). Misma trampa que la regla de CUIT. | — nunca |
| **Sueldos en la agenda** (fila del mockup) | Payroll es NON-GOAL declarado. | — |
| **"Pagar Distribuidora Austral"** (fila del mockup) | Cuenta corriente de proveedores no existe. Es la mitad de "acreedores" que ya faltaba en el pedido de la contadora. | Módulo proveedores (F1+) |
| **Montos de IVA en la agenda** ("Vence IVA · $849.000") | Pandora no liquida IVA. Puede decir **cuándo** vence, nunca **cuánto**. Inventar el monto de una DDJJ es lo más peligroso de toda la maqueta. | — nunca sin liquidación real |
| **Racha / "7 días seguidos"** (mockup) | Necesita historial de tareas completadas. Una racha inventada es una mentira, y gamificar una herramienta de trabajo es discutible. | Cuando existan tareas con historia; decisión del owner |
| **Sincronización bidireccional con Google Calendar** | OAuth + refresh tokens por comercio en el vault + decisión de compartir datos con un tercero. El `.ics` cubre el 90% al 10% del costo. | Si el owner quiere que Pandora escriba eventos |
| **Pronóstico por producto individual** | Con pocas unidades por producto y por día, el ruido se come la señal. "Días de stock" da lo mismo sin fingir precisión. | — |
| **Intervalos de confianza dibujados** | Un abanico de incertidumbre sobre un promedio de 3 semanas es teatro estadístico. | — |
| **Predicción de quiebre con lead time del proveedor** | No existe el dato de cuánto tarda cada proveedor en entregar. | Módulo proveedores |

## 8. Decisión de diseño

### 8.a Cuándo gana su lugar en pantalla cada bloque

Ordenado por **semanas de operación REAL** (no del seed) antes de que diga algo:

| Bloque | Qué necesita | Útil desde | Mientras tanto |
|---|---|---|---|
| **Heatmap del calendario** | ventas de cualquier día | **día 1** | los días sin dato quedan neutros, no en cero |
| **Feriados y vencimientos** | el calendario cargado | **día 1** | si no cubre el período, se dice — no se dibuja vacío |
| **Pendientes / agenda** | nada externo | **día 1** | — |
| **Días de stock restantes** | velocidad por producto | **~2-3 semanas** | "todavía no hay ventas suficientes para estimarlo" |
| **Proyección de cierre de mes** | ~1 mes en curso | **~1-2 semanas del mes** | no se muestra el número |
| **Patrón por día de la semana** | ≥8-10 observaciones por día | **~2-3 meses** | — |
| **Contra el mismo mes del año pasado** | 1 ciclo completo | **13 meses** | "todavía no hay con qué comparar" |

> **Un bloque de proyección que muestra un número confiado en la semana 2 es peor
> que el *vanity metric* que ya rechazamos** en `RESEARCH-BRIEF-panel` §8: aquel no
> cambiaba ninguna decisión; éste cambia la equivocada.

### 8.b La proyección que importa: **días de stock restantes**

"Vas a facturar ~$2.400.000 este mes" no cambia nada — no hay decisión atada.
**"A la Coca de 600 le quedan 4 días"** significa *comprar hoy*.

```
venta diaria promedio = unidades vendidas en los últimos N días / N
días restantes        = stock_current / venta diaria promedio
```

Con la trampa documentada en §3: **un producto en cero da 0 días y parece
urgentísimo, pero el quiebre ya pasó.** Se muestra al lado de los quiebres reales,
y "sin stock" se distingue de "se acaba pronto" — son dos acciones distintas.

### 8.c Pendientes es un dominio, no un widget

La maqueta tiene tipos, recurrencia (*"Recurrente · diario"*), plantillas
(*"Checklist apertura"*), agrupación por atrasada/hoy/semana/mes/año y filtros. Eso
no entra en una tabla de dos columnas.

Y trae una pregunta de esquema que conviene cerrar acá y no descubrir en el código:
**una tarea es estado mutable** — se marca y se desmarca. Es lo único mutable que
tocaríamos este mes; todo lo demás (`audit_log`, `sale_items`, `cash_movements`,
`expenses`) es append-only por trigger (CLAUDE.md §16.5). Propuesta: la tarea es
mutable y **no** lleva trigger de inmutabilidad, porque no es un hecho económico;
si alguna vez se necesita saber quién la marcó, eso va a `audit_log`, que sí es
inmutable.

### 8.d Filas del mockup que NO tienen dato detrás

Igual que con los tres bloques del panel, se dice cuáles son en vez de rellenarlas:

- **"Sueldos · 2 empleados · $656.000"** → payroll es NON-GOAL.
- **"Pagar Distribuidora Austral · $148.300"** → no existe cuenta corriente de proveedores.
- **"Vence IVA · DDJJ F2002 · $849.000"** → la **fecha** sí (cargada); el **monto** no, y no se inventa.
- **"7 días seguidos"** (racha) → no hay historial de tareas.

## 9. Plan de implementación — tres slices

Es más de un slice y conviene verlo entre medio. Orden propuesto:

1. ~~**Calendario**~~ — ✅ **HECHO** 2026-09-10 (`560f981`, `9f501b3`). Grilla del
   mes + heatmap real de ventas + feriados **cargados** (nunca calculados). Los
   **vencimientos fiscales NO entraron**: son dato verificado contra ARCA y
   todavía no lo tenemos — `holiday_calendars` ya sabe decir qué años faltan.
2. ~~**Agenda / Pendientes**~~ — ✅ **HECHO** 2026-09-10 (`f8a5ec5`, `665156b`).
   Tabla `tasks` (migration 0030), tipos, vencimiento, recurrencia, filtro por
   tipo y vista por día desde el calendario.

   Dos correcciones al plan original, con su motivo:

   - **"bajo mínimo → reponer" se descartó.** El panel ya tiene su tarjeta de
     Reponer, con los productos y las cantidades. Repetirlo como pendiente dice
     lo mismo con menos detalle y llena la lista de cosas que uno ya vio. Quedó
     sólo el de caja sin cerrar.
   - **Los derivados no se guardan.** "Caja abierta de un día anterior" ya vive
     en `cash_sessions`: una copia en `tasks` sólo puede desincronizarse. Se
     derivan al leer y van **sin casilla** — no se resuelven tachándolos.

   **Diferido y dicho** (se sacó su CSS huérfano en vez de dejarlo dando vueltas):
   los atajos de escritura `.todo-templates` (cuáles son los tres útiles se sabe
   mirando qué anota el comercio, no adivinando), el segmentado día/mes/año
   `.todo-seg` (lo reemplazó el agrupado por vencimiento) y las filas de agenda
   con importe `.cal-agenda`/`.ag-*` (necesitan el calendario fiscal verificado).
3. **Proyecciones** — 1 de 4 hecho.

   - ~~**días de stock**~~ — ✅ **HECHO** 2026-09-10 (`f534d17`, `35183c1`).
     Cálculo puro en `src/lib/stock/dias-de-stock.ts` + `stock.report.ts`.
     **Compuerta:** antes de 14 días de operación REAL no muestra número, dice
     cuántos faltan. La historia se mide desde la **primera venta**, no desde
     el alta de la empresa. **Cuatro estados, no un número:** `sin_stock` (el
     quiebre ya pasó — 0 días sería mentira), `se_acaba`, `sin_rotacion` (0
     ventas ≠ infinitos días) y `holgado`.

     Filtros distintos a los de la tarjeta *Reponer*, a propósito: acá **no**
     se exige `stock_minimum`, porque 20.001 de los 20.009 productos de la base
     no lo tienen cargado y un producto sin mínimo igual tiene velocidad. Sí se
     comparte `stock_tracking_enabled`.
   - **cierre de mes** ← **ACÁ VA LO PRÓXIMO**
   - patrón semanal (necesita ~2-3 meses de operación real)
   - contra el año pasado (necesita 13 meses)

   > ⚠️ Releer §6 antes de escribir una línea. Lo que hoy parece "patrón semanal
   > sólido" en los datos de desarrollo es el patrón que **yo mismo escribí** en
   > `scripts/seed-dev-ventas.sql` (domingos cerrados, sábados a la mitad, cero
   > estacionalidad anual). El comercio real arranca en cero filas. La pregunta
   > que tiene que contestar cada bloque es *"¿cuántas semanas de operación real
   > necesito antes de decir esto?"* — y decirlo en pantalla mientras no las haya.

Después, transversal: **exportar `.ics`** para que todo eso caiga en el calendario
del teléfono.

~~**Antes de arrancar hace falta una decisión del owner** (§7)~~ — **RESUELTO**
2026-09-10, delegado por el owner ("hagamos lo más conveniente").

El 1 de junio (Día de la Provincia) **no es un feriado**: es un receso
administrativo del sector público. Decretar feriados es facultad de la Nación y
**el empleador elige si adhiere**. Marcarlo como feriado le diría al comercio que
está cerrado cuando en realidad es su decisión. Va con tipo propio
(`asueto_provincial`), color distinto y nota visible. La fuente es **secundaria**
(Cámara de Comercio de Ushuaia → Ley Provincial 007/92); el texto primario no se
encontró, y la fila de cobertura lo dice en vez de callarlo.
