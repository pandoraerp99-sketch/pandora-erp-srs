# Ofertas y Descuentos — Research (Pandora ERP)

**Fecha:** 2026-07-03
**Autor:** sesión Claude + owner (Agus)
**Estado:** research pre-diseño (mismo método que PEDIDOS-SENAS y DEVOLUCIONES)
**Propósito:** cubrir la mayor cantidad de detalle posible sobre cómo debería funcionar un panel de ofertas/descuentos en Pandora, con el marco fiscal/legal argentino verificado, la taxonomía completa de promociones, las reglas de aplicación (el corazón del motor), las interacciones con otros módulos, y la propuesta de UX Dawn Sky. Ordenado para que la **primera pantalla sea limpia y usable** ("que ella pueda lanzar una promo la semana que viene") y el resto quede como roadmap dentro del panel.

> **Norte del proyecto (recordatorio):** esto se construye principalmente para el comercio de la novia del owner. El objetivo es que quede increíble, durable y que la ayude — no llegar rápido a mercado. Ver memoria `proposito-real-app-para-la-novia`. Por eso el research es exhaustivo; pero "increíble" para una comerciante = una herramienta que funciona, es clara, es rápida y **no le hace perder plata**. Un panel de promos confuso e inflado es lo *opuesto* a increíble.

---

## 0. Regla de oro del panel (la que más la ayuda)

Si este panel hace UNA sola cosa bien, que sea: **nunca dejar que un descuento venda por debajo del costo sin avisar.** Es la feature de mayor valor real para una comerciante y es la semilla del futuro Motor de Precios (ver `idea-centro-inteligencia-pricing`). Todo lo demás es secundario a esto.

---

## 1. Marco fiscal y legal argentino

### 1.1 ✅ VERIFICADO — El descuento reduce la base imponible del IVA

**Ley de IVA (Ley 23.349 t.o.), Artículo 10** — "precio neto gravado":
> "…el que resulte de la factura o documento equivalente extendido por los obligados al ingreso del impuesto, **neto de descuentos y similares efectuados de acuerdo con las costumbres de plaza**."

**Implicancia técnica directa (define el orden de cálculo):**
- El descuento se aplica sobre el **precio neto (sin IVA)**, y el IVA se calcula sobre la base **ya descontada**. NO se calcula IVA sobre el precio pleno y después se descuenta el total.
- Orden canónico: `precio neto → aplicar descuento → base neta descontada → IVA sobre base descontada → total`.
- Esto es coherente con Money Constitution §9 (Decimal.js, HALF_EVEN, PER_LINE) y con el Fiscal Projection Layer §8. El descuento vive en el modelo per-line **antes** de la proyección a IVA.

**Descuentos posteriores** (Art. 11 y 12 Ley IVA): devoluciones, rescisiones, descuentos, bonificaciones o quitas posteriores a la emisión → ajuste de débito/crédito fiscal. En Pandora eso ya cae en el territorio de **Nota de Crédito** (ver DEVOLUCIONES-research → NC es F1+). Un descuento aplicado *en el momento de la venta* es distinto: va directo en la factura original.

> Fuente: Infoleg, texto actualizado Ley IVA, consultado 2026-07-03. La cita literal exacta debe re-confirmarse contra el manual/fuente primaria antes de que maneje código fiscal (fue extraída vía fetch+resumen).

### 1.2 ✅ VERIFICADO — La oferta obliga y debe tener fecha de inicio/fin + condiciones (¡es requisito LEGAL, no opcional!)

**Ley 24.240 Defensa del Consumidor, Artículo 7 (Oferta):**
> "La oferta dirigida a consumidores potenciales indeterminados, obliga a quien la emite durante el tiempo en que se realice, debiendo contener la **fecha precisa de comienzo y de finalización**, así como también sus **modalidades, condiciones o limitaciones**."

- Revocación válida **solo** si se comunica por medios similares a los usados para publicarla.
- No efectivizar la oferta publicada = "restricción injustificada de venta", sancionable.

**Ley 24.240, Artículo 8 (Efectos de la publicidad):**
> "Las precisiones formuladas en la publicidad o en anuncios, prospectos, circulares u otros medios de difusión se tienen por incluidas en el contrato con el consumidor y **obligan al oferente**."

**Implicancia de diseño directa:** el formulario de "crear promoción" debe **forzar** fecha de inicio + fecha de fin + condiciones/limitaciones (stock, tope, exclusiones) como campos **obligatorios**. No es UX nice-to-have: es cumplimiento legal. Una promo sin fecha de fin es una promo mal formada.

> Fuente: Infoleg, texto actualizado Ley 24.240, consultado 2026-07-03.

### 1.3 ✅ VERIFICADO (corregido 2026-07-03) — "Precio único": NO se puede diferenciar precio por medio de pago → Pandora NO ofrece descuento por medio de pago

> **Corrección importante.** Una versión anterior de este doc trataba el "descuento por efectivo/débito" como algo modelable (encuadrado como descuento sobre el precio de lista). **Es incorrecto.** El owner lo marcó y la investigación lo confirma: en Argentina rige el **precio único** — el precio no puede diferir según el medio de pago, y promocionar descuentos por efectivo NO es legal.

**Marco normativo:**
- **Ley 25.065 (Tarjetas de Crédito), art. 37 (vigente):** "El proveedor está obligado a […] No efectuar diferencias de precio entre operaciones al contado y con tarjeta." El DNU 70/2023 derogó otros artículos pero NO el 37.
- **Ley 27.253 (2016):** obliga a aceptar **tarjeta de débito** y establece que el comercio debe aceptarla **sin realizar diferencias de precio respecto del pago en efectivo/contado**; a través de la terminal debe ofrecer cancelar la compra **sin recargo alguno**, y los proveedores **deben abstenerse de promocionar descuentos por pago en efectivo**.
- **Principio de precio único:** distintas normas y resoluciones establecen que el precio de un producto debe ser **único** en el comercio, sin recargo ni diferenciación por medio de pago.

**Contexto (por qué existía la práctica y por qué se está muriendo):**
- El "10-15-20% en efectivo" era una **zona gris de facto**, motivada porque el efectivo era el único medio **sin retenciones** de IVA/Ganancias sobre cobros electrónicos (parte del incentivo era no dejar rastro). No era legal, era tolerado.
- Desde el **1/9/2024** el Gobierno **eliminó los regímenes de retención de IVA y Ganancias** sobre pagos electrónicos → desapareció la razón económica del descuento por efectivo. Prensa: *"¿murió el 10% de descuento en efectivo?"*.

**Decisión de diseño para Pandora (definitiva):**
- ❌ **Pandora NO incluye "descuento por medio de pago" como tipo de promoción.** No se ofrece diferenciar precio por efectivo/débito/transferencia/tarjeta. Es coherente con la identidad del sistema (CLAUDE.md §1.7/§8: integridad fiscal primero, nunca facilitar algo al borde de la evasión; fail-closed fiscal).
- El **precio es único**. Si el comercio quiere bajar un precio, lo hace con una **promoción real** (%/$ sobre el producto o el total), aplicable a todos los medios de pago por igual.
- ✅ **Excepción legítima, distinta y diferida (v3/F2): promos financiadas por terceros** (banco/billetera reintegra al cliente, ej. "sábados 15% con Cuenta DNI"). Ahí el comercio **no** diferencia su precio — el precio es el mismo y el reintegro lo pone el banco/Estado. Eso es un concepto aparte (integración con programas bancarios) y NO es "el comercio cobra distinto por medio de pago".

> Fuentes: Infoleg (Ley 25.065 art. 37; Ley 27.253); argentina.gob.ar Ley Simple "Pagos con tarjetas de débito"; cobertura de prensa sobre eliminación de retenciones (Infobae/Cronista, ago-2024). Consultado 2026-07-03.

### 1.4 `[PENDIENTE VERIFICACIÓN]` — Discriminación de bonificaciones en el comprobante

Los descuentos/bonificaciones deben constar/discriminarse en el comprobante emitido (régimen de emisión de comprobantes, **RG 1415/2003** y modificatorias). Principio bien establecido, pero **el número de RG y el texto exacto deben verificarse** cuando WebSearch se restablezca (rate-limited al 2026-07-03). No afirmar de memoria (regla `feedback-validar-fuentes-oficiales`).

### 1.5 `[PENDIENTE VERIFICACIÓN]` — "Precio anterior" / precio tachado ("de $X a $Y")

La normativa de **Lealtad Comercial (DNU 274/2019)** y defensa del consumidor regula la publicidad de descuentos: el "precio anterior" tachado debe ser un precio **real y vigente** durante un período previo (no inflar-y-tachar). Existe la regla, pero el número/artículo exacto y el período de referencia deben verificarse antes de citarlo como canónico. Marcar pendiente.

### 1.6 Ley 27.743 Transparencia Fiscal (ya en el radar → A-11)

El ticket con Régimen de Transparencia Fiscal (IVA discriminado, "otros impuestos nacionales indirectos") ya está en la pregunta abierta **A-11** de la contadora (ver `reunion-contador-y-abogado.md`). El detalle "cómo se muestra un descuento en ese ticket" se **rutea a A-11** — NO se abre hilo nuevo. Un descuento cambia la base, así que el breakdown de transparencia debe reflejar la base ya descontada.

---

## 2. Taxonomía de tipos de descuento/oferta (exhaustiva)

Ordenados aprox. de más simple/frecuente a más complejo. La columna "orden" sugiere v1 (primera pantalla) vs roadmap.

| Tipo | Qué es | Ejemplo comercio real | Orden |
|---|---|---|---|
| **% sobre línea** | Porcentaje off un producto/categoría | "20% en toda la mercería" | **v1** |
| **Monto fijo sobre línea** | $ off un producto | "$500 off este pantalón" | **v1** |
| **% / $ sobre el total (global)** | Descuento sobre el ticket entero | "10% en toda la compra hoy" | **v1** |
| **Por monto total (umbral / compra mínima)** | Superás $X → % off (incentiva ticket más grande) | "superando $30.000, 10%" | **v1** (pedido owner) |
| ~~Descuento por medio de pago~~ | ❌ **NO soportado** — precio único, no se diferencia por medio de pago (§1.3) | — | ❌ excluido por diseño |
| Promo financiada por banco/billetera | El banco/Estado reintegra al cliente; el comercio NO diferencia su precio | "sábados 15% con Cuenta DNI" | v3/F2 (integración externa) |
| **Precio manual / override** | El cajero fija un precio puntual (autorizado + auditado) | "te lo dejo en $X" (regateo) | **v1** (con guard de margen + rol) |
| **Redondeo / "la yapa"** | Redondear a favor del cliente | "son $980, redondeá $950" | **v1** (caso simple del override) |
| **Cantidad: 2x1 / 3x2 / NxM** | Llevás N, pagás M (descuento efectivo (N−M)/N) | "2x1 en velas" | **v1** (pedido owner) |
| **Volumen / escalonado** | +cantidad → +descuento | "6+ unidades: 10% off" | roadmap v2 |
| **Combo / bundle** | Precio especial por comprar un conjunto | "kit costura $X" | roadmap v2 |
| **Buy X get Y** | Comprá X, llevás Y (distinto) gratis/con descuento | "comprá 2 telas, la aguja gratis" | roadmap v2 |
| **Por segmento de cliente** | VIP / jubilados / estudiantes / empleados / cuenta corriente | "10% jubilados" | **v1** (pedido owner) — requiere identificar cliente (link a Clientes) |
| **Por tiempo** | Happy hour / día de la semana / franja horaria | "jueves 15%", "18–20 h" | **v1** (pedido owner) — condición sobre la vigencia |
| **Por vencimiento próximo** | Descuento a mercadería por vencer (semilla pricing) | "pan del día -30% a las 20h" | roadmap v2 |
| **Liquidación / clearance** | Bajar precio de lo que no rota | "liquidación temporada" | roadmap v2 |
| **Cupón / código** | Código canjeable | "código VERANO10" | roadmap v2/v3 |
| **Fidelización / puntos** | Acumula puntos → canjea | programa de puntos | F2 (`idea-centro-inteligencia`) |

**Regla:** v1 cubre lo que una mercería/kiosco/rotisería usa TODOS los días (%, $, global, medio de pago, override con guard). El resto es motor de reglas más rico, roadmap dentro del mismo panel.

---

## 3. Reglas de aplicación (el corazón del motor)

Acá es donde los motores de descuento se pudren en bugs. Diseño para **transparencia**: la comerciante tiene que entender por qué salió ese precio.

### 3.1 Auto-aplica vs manual
- **Auto-aplica:** promo vigente que se aplica sola al cumplirse condiciones (ej: "10% miércoles").
- **Manual:** el cajero la elige/tipea (ej: override de precio).
- v1: soportar ambas, pero mostrar SIEMPRE en el ticket qué promo se aplicó y cuánto (transparencia).

### 3.2 Stacking / acumulación (empezar simple)
> Recomendación advisor: **default = una sola promo por línea/ticket salvo que esté marcada explícitamente como "combinable".** Mostrarlo explícito. NO construir una matriz completa de prioridad/exclusión en v1 (es donde nacen los bugs).
- v1: promo no combinable por defecto. Si hay dos aplicables, gana la de mayor descuento para el cliente (o la que el cajero elija), y se muestra cuál ganó.
- roadmap: reglas de prioridad, exclusiones por categoría, "combinable con X pero no con Y".

### 3.3 Tope de descuento + protección de margen (LA regla de oro)
- **Guard de costo:** si el descuento lleva el precio por debajo del costo conocido del producto → **avisar** (y **bloquear** según rol). Ver §0.
- **Tope por rol:** cada rol tiene un % máximo de descuento que puede otorgar sin autorización (cajero 10%, encargado 25%, dueño ilimitado — configurable).
- **Tope por promo:** una promo puede tener "descuento máximo $X" aunque el % dé más.

### 3.4 Condiciones / límites
- **Mínimo de compra:** "10% en compras +$20.000".
- **Límite de usos:** por cliente / total / por día.
- **Vigencia:** fecha inicio + fin (obligatorio legal §1.2) + opcional días de semana + franja horaria.
- **Exclusiones:** productos/categorías que no entran (ej: no aplica a lo ya en liquidación).
- **Stock/tope de unidades:** limitar cuántas unidades entran a la promo.

### 3.5 Orden de cálculo (fiscalmente correcto — §1.1)
```
precio_unitario (neto, sin IVA)
  → descuento de línea (%/$)
  → subtotal línea neto descontado
  → [descuento global prorrateado por línea]
  → base neta final por línea
  → IVA por línea (HALF_EVEN, PER_LINE)  ← Money Constitution §9
  → total
```
- El descuento global se **prorratea** entre las líneas (para mantener el IVA por alícuota correcto).
- Nunca "total con IVA menos descuento" como atajo → rompería la base imponible.

### 3.6 Redondeo
- HALF_EVEN, Decimal.js, PER_LINE (Money Constitution §9). El descuento entra en el pipeline antes del redondeo final de IVA.

---

## 4. Interacción con otros módulos

| Módulo | Interacción |
|---|---|
| **Fiscal (§8)** | El descuento vive en el modelo per-line ANTES de la proyección WSFEv1. La base imponible que va a AFIP ya está descontada. El Fiscal Snapshot persiste el descuento aplicado (auditable). Ticket muestra el descuento discriminado (§1.4 pendiente + A-11). |
| **Señas / Pedidos** | ¿La promo se congela con la seña? Si la seña congela precio (RG 707/1999, ver PEDIDOS-SENAS-research), entonces el descuento vigente **al momento de señar** debería congelarse también. → pregunta contadora. |
| **Devoluciones / NC** | La NC debe reflejar el precio **con descuento** efectivamente cobrado, no el de lista. (NC es F1+.) |
| **Stock** | La mayoría de las promos NO cambian la lógica de stock (mismo producto, menor precio). Excepción: 2x1 / buy-X-get-Y entregan **más unidades** → el stock debe descontar las unidades entregadas (2), no las cobradas (1). |
| **Caja / Cierre** | El cierre debe reportar **total de descuentos otorgados** en el día (control anti-abuso + visibilidad). Semilla de reporting. |
| **Permisos / Roles** | Quién puede dar descuento y hasta cuánto (§3.3). Todo descuento manual auditado. |

---

## 5. Auditoría y control (anti-abuso)

El descuento es un vector clásico de fuga/fraude interno. No negociable:
- **Todo descuento manual / override** → `audit_log` con actor, monto, %, motivo, producto/venta.
- **Motivo obligatorio** en override de precio y en descuentos por encima del tope del rol.
- **Límite por rol** (§3.3).
- **Reporte diario** de descuentos por cajero (visible en cierre y en el panel).
- Coherente con Observability Constitution §10 + Anti-Patterns §20 (nada de descuentos silenciosos).

---

## 6. UX / diseño del panel (Dawn Sky)

Sistema visual: liquid-glass Dawn Sky, mismo chrome canónico que las otras pantallas (sidebar 210px + topbar + content flex + col-main/col-side). Tokens y glass idénticos.

### 6.1 Vista principal — lista de promociones
- **Header en glass** (icono + título "Ofertas y descuentos" + sub).
- **Filtro por estado en la topbar** (chips): Activas / Programadas / Vencidas / Todas (mismo patrón que pedidos/devoluciones).
- **KPIs arriba:** descuento total otorgado (mes), promo más usada, impacto estimado en margen, promos por vencer.
- **Cards de promoción** agrupadas por estado, cada una con: nombre, tipo (chip de color), valor (%/$), vigencia (fecha inicio→fin, con rojo si vence pronto), condiciones (mínimo, medio de pago, segmento), usos, y un mini-indicador de **margen** (🟢 sano / 🟡 ajustado / 🔴 bajo costo). Quick actions: pausar / editar / duplicar / ver detalle.

### 6.2 Rail lateral (col-side)
- **Promos por vencer** (para que no se olvide de renovarlas o pausarlas).
- **Guard de margen** — resumen: "3 promos con margen sano, 1 ajustada".
- **Tip fiscal** (recordatorio: el descuento reduce la base de IVA; precio único — no se diferencia por medio de pago).

### 6.3 Crear/editar promoción (modal wizard)
Campos, con los legales **forzados**:
1. Nombre + tipo (%/$/global/medio de pago/override).
2. Valor (con **preview en vivo** del precio resultante y del **margen resultante** → 🟢🟡🔴).
3. **Vigencia: fecha inicio + fecha fin OBLIGATORIAS** (§1.2 legal) + opcional días/horario.
4. Condiciones: mínimo de compra, productos/categorías incluidos/excluidos, límite de usos, tope de descuento.
5. Combinable con otras promos: sí/no (default no — §3.2).
6. Si toca margen negativo → warning inline "⚠️ esta promo vende [producto] por debajo del costo ($X < $Y)". Bloquea o pide confirmación según rol.

### 6.4 Aplicación en POS (cómo se ve al cobrar)
- Promo auto-aplicada → aparece como línea de descuento visible con su nombre.
- Descuento manual → botón "Descuento" con % o $, pide motivo si supera el tope del rol.
- El total muestra: subtotal, descuento (con nombre de promo), IVA sobre base descontada, total. Transparencia total.

### 6.5 KPIs / reporting
- Descuento total otorgado (día/mes), por tipo, por cajero.
- Promo más usada, promo con mejor/peor impacto en margen.
- (Semilla del Centro de Inteligencia — no construir el BI acá, solo los números básicos.)

---

## 7. Casos borde / riesgos

- **Descuento sobre descuento:** ¿el % global se aplica antes o después del descuento de línea? (Definir: línea primero, después global prorrateado — §3.5.)
- **Margen negativo por combinación:** dos promos combinables que juntas venden bajo costo → el guard debe evaluar el precio FINAL, no cada promo aislada.
- **Redondeo:** el descuento no debe introducir errores de centavos en el IVA (HALF_EVEN, PER_LINE).
- **Promo vencida aún aplicándose:** el POS debe validar vigencia en el momento de cobro, no al abrir la venta.
- **2x1 y stock:** descontar unidades entregadas, no cobradas.
- **Medio de pago:** jamás modelar como recargo tarjeta (§1.3).
- **Seña + promo:** definir congelamiento (§4).
- **Ticket fiscal:** el descuento debe verse discriminado (§1.4 + A-11).

---

## 8. Scope / orden de construcción (fases = orden técnico, NO gate de permiso)

> Recordatorio del norte: se puede ir a v2/v3/F2 igual. Las fases acá son solo **qué conviene antes que qué por dependencias**, para que ella tenga algo real y usable primero.

- **v1 (primera pantalla, "usable la semana que viene"):** %/$ por línea, descuento global, **por monto total/umbral** (superás $X → % off — pedido owner), **2x1/3x2/NxM** (cantidad — pedido owner), **selección por categoría o por productos elegidos** (ej: "solo Mercería tiene oferta"; incluye chip **"Todas las categorías"** = todo el local de un click), **segmento de cliente** (jubilados/estudiantes/VIP + tipos creables/eliminables), **días/horario**, override con **guard de margen sobre toda la selección + rol + motivo auditado**, vigencia obligatoria, transparencia en el ticket. Reglas simples (no combinable por defecto). **NO** descuento por medio de pago (§1.3, precio único).
  - *Nota stock:* 2x1/NxM entregan más unidades → el stock descuenta las **entregadas** (2), no las cobradas (1). Ya reflejado en el mock ("descuenta 2 de stock").
  - *Guard sobre selección:* el margen se evalúa producto por producto en la selección; si **alguno** queda bajo costo, avisa y bloquea. La UI lista los productos en rojo (advisor: evaluar el precio final, no cada promo aislada).
  - **Segmento de cliente** (jubilados/estudiantes/VIP/empleados + **los que el usuario cree**): la promo solo aplica a ese segmento → **requiere identificar al cliente** en la venta (link al módulo Clientes; sin cliente identificado no se aplica). El descuento por segmento NO tiene tratamiento fiscal distinto (sigue siendo descuento normal, §1.1). *Nota:* descuentos a jubilados pueden tener regímenes específicos en ciertos rubros (PAMI/medicamentos) — no aplica a mercería, pero si el rubro lo tuviera, verificar con contadora.
    - **Tipos de cliente creables/eliminables** (pedido owner): el usuario crea/borra sus propios tipos ("Mayoristas", "Vecinos del barrio"…) inline desde "¿Para quién?" con "+ Nuevo tipo" y una × por chip. **Decisión de arquitectura pendiente:** el **home canónico de "tipos de cliente" debe ser el módulo Clientes/Configuración** (single source of truth) para poder etiquetar clientes y que el POS reconozca el segmento; el alta inline en la promo es solo un atajo. Cuando se implemente de verdad, los tipos viven en la config del tenant (multi-tenant §7), NO hardcodeados. En el mock persisten en sesión.
  - **Día/horario** (días de la semana + franja horaria tipo happy hour): condición sobre la vigencia. El POS valida día y hora **en el momento del cobro**.
- **v2 (roadmap dentro del panel):** cantidad (2x1/NxM), volumen, combos, buy-X-get-Y, segmentos de cliente, por tiempo/día/horario, liquidación, stacking con prioridad/exclusiones.
- **v3 / F2:** cupones/códigos, fidelización/puntos, descuentos dinámicos sugeridos por el Motor de Precios (`idea-centro-inteligencia-pricing`), analítica de impacto en el Centro de Inteligencia.

El guard de margen de v1 es la **semilla explícita** del Motor de Precios — se construye chico ahora y crece después.

---

## 9. Preguntas para la contadora / abogado

1. **Precio único / descuento por medio de pago** (§1.3): confirmar la decisión de **NO ofrecerlo** (precio único: art. 37 Ley 25.065 + Ley 27.253) y que no haya excepción vigente que la contadora conozca. Y si en el futuro se integran **promos financiadas por banco/billetera** (reintegro de tercero), cómo se registra fiscalmente. *(contadora + abogado)*
2. **Congelamiento de promo con la seña:** si la seña congela precio (RG 707/1999), ¿el descuento vigente al señar se congela también? *(contadora)*
3. **Discriminación del descuento en el ticket** con Transparencia Fiscal Ley 27.743 → **rutea a A-11** (no hilo nuevo). Confirmar cómo se muestra la base descontada.
4. **Precio anterior/tachado** (§1.5): ¿período mínimo que el "precio anterior" debe haber estado vigente para poder tacharlo? *(verificar norma + contadora)*
5. **Bonificación vs descuento** a efectos de comprobante (§1.4): ¿hay diferencia de tratamiento/discriminación entre "bonificación" y "descuento comercial"? *(contadora)*

---

## 10. Fuentes (consultadas 2026-07-03)

- **Ley 24.240 Defensa del Consumidor** (art. 7 Oferta, art. 8 Publicidad) — Infoleg, texto actualizado. `http://servicios.infoleg.gob.ar/infolegInternet/anexos/0-4999/638/texact.htm`
- **Ley de IVA (Ley 23.349 t.o.)** (art. 10 precio neto gravado, art. 11/12 ajustes posteriores) — Infoleg, texto actualizado.
- **Ley 25.065 Tarjetas de Crédito** (art. 37 vigente; DNU 70/2023 no lo derogó) — Infoleg, texto actualizado. `http://servicios.infoleg.gob.ar/infolegInternet/anexos/55000-59999/55556/texact.htm`
- `[PENDIENTE]` RG 1415/2003 (discriminación bonificaciones en comprobante) — verificar cuando WebSearch se restablezca.
- `[PENDIENTE]` Lealtad Comercial DNU 274/2019 (precio anterior/tachado) — verificar.

> Nota de rigor: las tres citas ✅ fueron extraídas vía fetch+resumen de Infoleg (modelo rápido). Sirven para el research; el **texto literal exacto debe re-confirmarse contra la fuente primaria** antes de que maneje código fiscal. Todas son derecho bien establecido, bajo riesgo — solo no dejar que una paráfrasis se vuelva cita canónica.
