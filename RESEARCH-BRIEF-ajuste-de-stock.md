# Research Brief — Ajuste manual de stock + Historial del producto

**Fecha:** 2026-09-12
**Estado:** 🏁 cerrado — `dc7b98c` en pandora-erp (migration 0038)
**Relacionado:** CLAUDE.md §5.2 ("Ajuste manual con motivo obligatorio" es F0) ·
EVENT-TAXONOMY `stock.adjusted_manually` · migration 0032 (signo), 0037 (fecha) ·
`RESEARCH-BRIEF-panel.md` §merma · `RESEARCH-BRIEF-inventario-valorizado.md`

---

## 1. Objetivo

Que el comercio pueda corregir el stock de un producto **desde la pantalla de
Productos**, diciendo por qué, y ver después el rastro de todo lo que movió ese
stock.

## 2. Problema de negocio

- **Problema:** se rompe un pack, vence la leche, falta mercadería, el conteo no
  da. Hoy no hay forma de registrarlo: `adjustStock` existe y está testeado, pero
  `adjustStockAction` no tiene un solo llamador. El comerciante termina vendiendo
  "en negativo" contra el sistema o dejando el número mal.
- **Usuarios:** dueño / encargado.
- **Impacto:** alto. Sin esto, el inventario al cierre (ítem 8) arrastra
  diferencias que nadie puede explicar, y el bloque de merma del Panel no tiene
  de dónde leer.
- **Complejidad:** baja-media. El libro ya guarda signo (0032) y fecha (0037).

## 3. Investigación

| Categoría | Qué se miró | Hallazgo | Fuente |
|---|---|---|---|
| Competidor POS | Square for Retail | Motivos predefinidos: recuento, daño, robo, pérdida, vencimiento/desperdicio, **uso interno**, muestras. Daño/robo/pérdida **siempre restan**; el **recuento puede sumar o restar**. Permite motivos propios. | [Square — ajustar inventario](https://squareup.com/help/us/en/article/6110-manage-inventory-with-the-retail-pos-app) · [motivos propios](https://squareup.com/help/us/en/article/8670-create-and-manage-custom-inventory-adjustment-reasons) (2026-09-12) |
| Competidor e-commerce | Shopify | Ajuste manual con **motivo etiquetado**; el historial del producto muestra motivo, **fecha y quién**. | [Shopify — ajustar cantidades](https://help.shopify.com/en/manual/products/inventory/adjusting-inventory/adjusting-inventory-quantities) · [historial](https://help.shopify.com/en/manual/products/inventory/adjusting-inventory/adjustment-history) (2026-09-12) |
| Maqueta propia | `pos-preview/stock-v2.html` | Filas de movimientos con motivo + quién ("Ajuste por rotura · Agus", "Vencimiento · Agus" como **Merma**). **No hay modal de ajuste**: es una pantalla de Stock entera, con depósito/local y transferencias que el esquema no tiene. | local |
| Código propio | `stock.ts:374` | El TODO ya planteaba cómo auditar un `loss` manual: (A) reusar `stock.adjusted_manually` o (B) evento nuevo. | local |

## 4. Síntesis

| Idea | ¿Sí? | Nota |
|---|---|---|
| Motivo de lista cerrada, no texto libre | ✅ | Es lo que permite que el Panel separe merma de corrección. |
| Merma siempre resta | ✅ | Square. Se valida en el service, no sólo en la pantalla. |
| Recuento suma o resta | ✅ | Square. |
| Historial con motivo, fecha y quién | ✅ | Shopify + maqueta. |
| Motivos propios del comercio | ❌ | Configuración; ver §7. |
| Depósito / transferencias | ❌ | No existen en el esquema. |

## 5. Decisiones

**Del usuario:**
1. **Categorías; la merma se registra como `type = 'loss'`.**
2. **Se audita con `stock.adjusted_manually`** (opción A del TODO): el catálogo
   de EVENT-TAXONOMY no cambia; el payload lleva `type` y `motivo`.
3. **El Historial entra en la misma tanda.**

**De diseño (mías, con el porqué):**

| Motivo | Grupo | `type` | Signo |
|---|---|---|---|
| Rotura | Merma | `loss` | sólo resta |
| Vencimiento | Merma | `loss` | sólo resta |
| Robo / faltante | Merma | `loss` | sólo resta |
| Recuento | Corrección | `adjustment` | suma o resta |
| Error de carga | Corrección | `adjustment` | suma o resta |
| Otro | Corrección | `adjustment` | suma o resta, **detalle obligatorio** |

- **La categoría va en una columna (`stock_movements.motivo`, migration 0038),
  no como prefijo del texto.** `type` sólo separa merma de corrección; la
  distinción rotura / vencimiento / robo —la que dice "hay un problema de
  robo"— viviría en texto libre, y el Panel tendría que parsearlo. Y es un dato
  **con reloj**: lo que se cargue sin la columna no se puede reclasificar bien
  después (mismo argumento que `unit_cost_snapshot`, migration 0031). CHECK en
  la DB: motivo de merma ⇔ `loss`; motivo de corrección ⇒ `adjustment`; los
  movimientos del sistema (venta, compra, anulación, stock inicial) llevan
  `motivo` NULL.
- **`reason` sigue siendo el texto humano** ("Rotura · se cayó el pack"): es lo
  que se muestra y lo que exige el CHECK de `adjustment`.
- **Delta, no valor final.** Se manda cuánto sumar o restar. Dos ajustes
  simultáneos con delta se acumulan bien; con valor final se pisan.
- **Sin selector de fecha.** Un ajuste pasa cuando se cuenta el estante: la
  fecha es la del día (default de la columna). Una fecha editable reabre por
  otra puerta el agujero de la fecha futura (0037).
- **Productos sin control de stock: no se ajustan.** `recordStockMovement`
  registraría el movimiento sin mover el número, y el modal mostraría "28 → 26"
  mintiendo. El botón no aparece y se dice por qué.
- **Historial ordenado y fechado por `fecha`** (el día en que pasó). Donde
  `created_at` cae otro día —un comprobante de julio cargado en septiembre— se
  muestran las dos, o el comerciante ve una fila de julio que sabe que tipeó
  ayer y desconfía de la pantalla.

## 6. Lo que se descubrió y no estaba en el plan

- **El guard de `prepareStockMovementValues` rechaza cualquier `loss`** que no
  sea `skip_audit` (y una merma tiene que auditarse). Se ensancha a
  `adjustment | loss`; `sale` / `purchase` / `return` siguen obligados a llevar
  su propio evento de negocio.
- **El trigger del bloque de merma del Panel se cumple con esto.** Su bloqueo
  declarado era "0 filas `adjustment`/`loss`". No se construye acá; queda
  anotado.

## 7. Qué NO vamos a implementar

| Qué | Por qué |
|---|---|
| **Consumo propio / uso interno** como categoría | Square lo tiene y en un kiosco es común. Pero no es merma ni corrección, y cómo se trata es criterio del estudio. **Pendiente de decisión del usuario**; agregarlo después es cambiar una CHECK. |
| Motivos configurables por comercio | Configuración inflada (CLAUDE.md §4.4). Lista cerrada. |
| **Toma de inventario físico** (contar todo y cargar valores finales) | Otra feature; ya en backlog (brief de inventario §7). |
| Ajuste con fecha pasada | §5. |
| Depósito / local / transferencias | No existen en el esquema. |
| Bloque de merma del Panel | Trigger cumplido, pero es otra slice. |

## 8. Plan

1. RED: el service rechaza hoy un `loss`; la merma que suma; "Otro" sin detalle.
2. Migration 0038 `motivo` + CHECK; ensanchar el guard; `adjustStock` recibe
   `motivo` y deriva `type`.
3. Lectura del historial por producto (tenant, orden por `fecha`, quién, venta
   o comprobante legible).
4. Modal de ajuste + modal de historial en Productos, con el vocabulario `.pm-*`.
5. Mutaciones, captura en ambos temas, números medidos contra la DB.

## 9. Resultado (2026-09-13)

Hecho en `dc7b98c`. Lo que apareció al construirlo y no estaba en el plan:

- 🔴 **La primera CHECK de la 0038 dejaba entrar un `loss` sin motivo.** Con
  `motivo` NULL, `NULL IN (...)` da NULL; el OR entero da NULL; y una CHECK que
  da NULL se considera **cumplida**. Lo atrapó el test contra la DB (T-INV-06).
  Cada rama lleva ahora `motivo IS NOT NULL` explícito.
- 🔴 **El test de orden del historial no discriminaba.** La compra "de julio" se
  cargaba primero, así que ordenar por fecha y por carga daban lo mismo. Lo
  encontró la mutación; se agregó un caso cargado último con fecha vieja.
- **"Venta Venta" / "Compra Compra"** en la captura: el origen repetía el tipo.
  Ahora el origen es lo que se sabe *además* (cliente, comprobante) y "sin
  comprobante" cuando falta el papel.
- **Falsa alarma descartada antes de "arreglarla":** parecía que el historial no
  leía el proveedor del catálogo; `registerExpense` ya copia su nombre a
  `payee_name` como snapshot.
- **La lista de motivos vive en dos archivos** (`_common.ts` para la DB, el
  dominio para la pantalla) porque no pueden importarse entre sí; un test falla
  si difieren.
- 🔴 **`/productos` no tiene modo oscuro** (medido: 0 reglas `data-theme`, la
  pantalla entera queda clara). Preexistente.
- ⚠️ Editar por `\\wsl.localhost` dejó cuatro archivos enteros en CRLF; se
  normalizaron antes del commit.

**Números verificados en dev:** rotura de 2 cargada por la pantalla → yerba
25 → 23; historial +20 +8 −1 −1 −1 −2 = 23; valor de stock −$4.800. Mutaciones
9/9. 1020 unit + 503 integración.

**Queda:** consumo propio (§7, decisión del usuario) · bloque de merma del
Panel (trigger cumplido: ya hay una fila `loss` real) · EVENT-TAXONOMY: la nota
del evento se actualizó en el working copy, sin commitear porque el archivo ya
tenía cambios del usuario.
