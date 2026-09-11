# Research Brief — Lectura X (reporte de control de caja)

**Fecha:** 2026-07-10
**Estado:** ✅ aprobado (aplicado al botón "Lectura X" de la Caja mockup)
**Relacionado:** `public/caja.html` (botón `.lecturax`) · [[cierre-z-lis-referencia-fiscal-2026-06-01]] · [[feedback-investigar-referencias-siempre]] · [[feedback-validar-fuentes-oficiales]]

> Metodología obligatoria (owner). Feature de UI que muestra datos ya presentes, pero fiscal-adjacente (vocabulario X/Z de controlador fiscal) → pasada de investigación real + validación de fuentes antes de cablear.

## 1. Objetivo
Cablear el botón "Lectura X" para que abra un **reporte de control de la sesión de caja actual**: totales del día hasta el momento (ventas, medios de pago, efectivo esperado en el cajón), **sin cerrar la caja y sin resetear nada**. Repetible.

## 2. Problema de negocio
- **Problema:** el botón existe (idiomático — todo comerciante argentino conoce "Lectura X" por décadas de controladores fiscales) pero es decorativo, no hace nada.
- **Usuarios:** dueño/cajero (control de medio turno, cambio de cajero, arqueo parcial de control).
- **Impacto:** medio — da confianza operativa (ver "¿cómo venimos?" sin cerrar), sin riesgo fiscal.

## 3. Investigación (fuentes reales)

| Categoría | Qué se miró | Hallazgo | Fuente |
|---|---|---|---|
| Estándar POS | Contenido de un X report | Resumen de actividad de la caja **desde la última Z hasta ahora**: ventas por medio de pago, devoluciones, nº de tickets, apertura, **efectivo esperado en cajón**, over/short. Se corre cuantas veces se quiera, **NO resetea** | Lightspeed, Citrus Lime, MobileTransaction |
| ERP | Shift/drawer management | X = preview, no toca el drawer; Z = cierra y resetea el drawer. Campos: opening amount, expected drawer, cash sales/returns, over/short, empleado, open/close times | MS Dynamics 365 Commerce, Loyverse Shift Report |
| Fiscal AR | Lectura X vs Cierre Z (controlador) | X = parcial/informativo, repetible, no borra memoria de trabajo ("útil para varios cierres de caja en el día"). Z = registra en memoria fiscal + borra; una por día; no dos Z seguidas sin una X en medio; obligatoria < 24h de la última venta fiscal | Fudo, Axoft, Generación Gamma |
| Fiscal AR (crítico) | ¿Aplica a Pandora? | Pandora factura **electrónico (WSFEv1), NO usa controlador fiscal** → no hay memoria fiscal que resetear ni obligación de "Z de controlador". X/Z son conceptos **operativos** de caja, no fiscales | ADR-0004/0022 (WSFEv1) · [[investigacion-oficial-afip-arca-aaip-2026-05-27]] |

## 4. Síntesis — qué incorporamos

| Idea | ¿Vale? | Nota |
|---|---|---|
| X = foto read-only de la sesión, **repetible, no cierra** | ✅ | núcleo del concepto |
| Numerar las lecturas (X#1, X#2…) por sesión | ✅ | igual que el controlador real; da trazabilidad |
| Ventas del día: total + tickets + ticket promedio | ✅ | ya en la barra de sesión |
| Desglose por medio de pago (efectivo/QR/débito/crédito) | ✅ | ya en el donut |
| **Efectivo esperado en cajón** + su composición (fondo + ventas efvo + ingresos − egresos − sangrías) | ✅ | el dato más útil de un X; se deriva del estado vivo |
| Hora exacta de la lectura + cajero + PV + apertura | ✅ | encabezado estándar de X |
| Leyenda "comprobante no fiscal · no cierra la caja" | ✅ | claridad + no confundir con Z/factura |
| Imprimir la X | 🟡 F1+ | `window.print()` de la vista; útil pero no bloqueante |
| Over/short (descuadre) en la X | ❌ ahora | el descuadre real se cuenta en el **cierre (Arqueo)**, no en un X de control; el X muestra *esperado*, no *contado* |

## 5. Estado del arte
El estándar (Lightspeed/Dynamics/Loyverse) trata la X como un **preview no destructivo** del turno; la Z como el cierre que resetea. En Pandora no hay reset fiscal, así que la X lee "desde la apertura de la sesión" (no "desde la última Z").

## 6. Ideas innovadoras (diferenciador Pandora)
- **Composición del efectivo esperado visible y en vivo** (fondo → ventas → ingresos/egresos → sangrías → esperado), no un número suelto. Coherente con el ciclo cajón↔caja fuerte de [[CAJA-cash-management-research]].
- **X numerada por sesión** con hora, para dejar rastro de los controles parciales de un turno largo.

## 7. Qué NO vamos a implementar (ahora)
| Idea descartada | Por qué | Trigger para revisar |
|---|---|---|
| Over/short en la X | El descuadre se resuelve en el Arqueo/cierre; el X muestra esperado, no contado | — |
| Persistir la X como documento / "Resumen Diario" fiscal | Terreno fiscal (¿Resumen Diario Equivalente aplica a factura electrónica?) — **pregunta para la contadora**, no inventar | reunión contadora |
| Imprimir / exportar PDF | Nice-to-have, no es el dolor de hoy | pedido del owner / F1 |
| Resetear algo | Un X NUNCA cierra ni resetea (eso es la Z / Arqueo) | nunca |
| Emitir a AFIP / darle CAE | No es comprobante fiscal | nunca |

## 8. Decisión de diseño
**Botón "Lectura X" → modal read-only** con: encabezado (Lectura X #N · fecha/hora de la lectura · sesión · cajero · PV · apertura) · Ventas del día (total, tickets, ticket prom.) · Por medio de pago (4 filas del donut) · Efectivo en cajón (composición fondo + ventas efvo + ingresos − egresos − sangrías = **esperado**) · leyenda "comprobante no fiscal · no cierra la caja". Contador de lecturas X por sesión. Todos los números se leen del **estado vivo** (DOM + `window.Caja.snapshot()`) al abrir, así refleja alivios/ingresos/retiros hechos en el turno.

## 9. Plan
- **MVP (hoy):** modal X read-only poblado del estado vivo + numeración + hora. No cierra nada.
- **Futuro F1+:** imprimir/exportar; validar con contadora si hay obligación de Resumen Diario en factura electrónica.
- **Riesgos:** que se confunda con un cierre → mitigado con leyenda explícita "no cierra la caja · comprobante no fiscal" y numeración X distinta del Arqueo.

## 10. Revisión
La X queda como control no destructivo, coherente con el modelo de efectivo ya cableado. Próximo valor: imprimir la X + cerrar la pregunta fiscal del Resumen Diario con la contadora.

---
**Sources:** shopkeep-support.lightspeedhq.com/support/reporting/z-and-x-reports · howto.citruslime.com/registers-cashiers-and-basics/understanding-x-report-z-report-2 · mobiletransaction.org/what-is-an-x-vs-z-report · learn.microsoft.com/dynamics365/commerce/shift-drawer-management · help.loyverse.com/help/shift-report-sales-summary-pos · ayuda.fu.do/es/10.-argentina-informe-de-cierre-z · ayudas.axoft.com (controlador fiscal)
