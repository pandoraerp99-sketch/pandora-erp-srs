# Research Brief — Gestión de efectivo en Caja (sangrías, arqueo, apertura/cierre)

**Fecha:** 2026-07-10
**Estado:** ✅ aprobado (aplicado a la Caja mockup)
**Relacionado:** `pos-preview/checkpoint-caja-v2.html` (→ `public/caja.html` en la app) · [[feedback-investigar-referencias-siempre]]

> Metodología obligatoria (owner). Este brief nació de un pedido concreto ("los alivios deberían afectar al efectivo del cajón") + el reclamo de que estaba editando sin investigar. Fase 1 investigación → Fase 2 síntesis → Fase 3 decisión → Fase 4 implementación.

## 1. Objetivo
Modelar el ciclo de efectivo de la Caja fiel a cómo lo hacen los POS/retail reales: cajón (drawer) → sangría/alivio → caja fuerte → retiro autorizado → tesorería.

## 2. Problema de negocio
- **Problema:** el alivio (sangría) saca plata del cajón, pero el mockup subía la caja fuerte sin bajar el "Efectivo en caja". Modelo inconsistente.
- **Usuarios:** dueño/cajero (operación diaria); contador (arqueo/cierre auditable).
- **Impacto:** alto — un modelo de efectivo incoherente rompe la confianza en el arqueo y el cierre Z.

## 3. Investigación (fuentes reales, no solo doc oficial)

| Categoría | Qué se miró | Hallazgo | Fuente |
|---|---|---|---|
| Best practices retail | Cash handling / safe drop | El drop saca el excedente del cajón a la caja fuerte; requiere monto máx de cajón + conteo con testigo + registro | apg, Integrated Cash Logistics, KoronaPOS |
| Balanceo de cajón | Fórmula canónica de arqueo | **fondo + ventas efectivo − sangrías = arqueo final**. Los drops RESTAN del cajón | Shopify, RetailDogma, RevenueRegister |
| POS real (Loyverse) | Pay Out / cash management | Sacar efectivo del cajón queda en el historial de movimientos + reporte de turno | help.loyverse.com |
| ERP (MS Dynamics 365 Commerce) | Cash management | Declaración de apertura/cierre, tender removal, safe drop como operaciones tipadas | learn.microsoft.com |
| UX / anti-sesgo | Blind count | Contar sin ver el esperado evita sesgo de confirmación (el cajero "cuenta hacia el número") | RevenueRegister Blind Mode |
| Métricas | Variance objetivo | Descuadre sano < 0,1% de ventas en efectivo | apg, thecfoclub |
| Seguridad | Autorización / testigo | El drop y su retiro los hace/valida personal autorizado; nada se borra | apg, American Security |

## 4. Síntesis — qué incorporamos

| Idea | ¿Vale? | Nota |
|---|---|---|
| Alivio (drop) **resta del efectivo del cajón** | ✅ | núcleo del pedido; fórmula canónica |
| Cajón → caja fuerte → retiro autorizado (nada vuelve al cajón) | ✅ | el retiro de la caja fuerte NO toca el cajón |
| Alivio queda en historial (quién/cuándo) + numeración | ✅ | ya implementado |
| Autorización para retirar de la caja fuerte | ✅ | ya implementado (nota "solo la dueña") |
| **Conteo ciego** (arqueo sin ver esperado) | 🟡 F1+ | toggle "modo ciego"; hoy mostramos esperado |
| **Monto máximo de cajón** + alerta de sangría | 🟡 F1+ | sugerir drop al superar el máx |
| **Variance % objetivo** (< 0,1%) | 🟡 F1+ | métrica en cierre/reportes |

## 5. Estado del arte
El estándar (Shopify/RetailDogma/Dynamics) modela el efectivo como un flujo tipado de movimientos (apertura, ventas, pay-in, pay-out/drop, retiro), y el arqueo reconcilia contra la fórmula. La caja fuerte es un "tender" separado del cajón.

## 6. Ideas innovadoras (diferenciador Pandora)
- **Ciclo cajón↔caja fuerte↔tesorería explícito y visual** (la mayoría de los POS lo tienen enterrado en reportes). En Pandora se ve en vivo.
- **Alivio con faltante/parcial** al retirar (ya implementado): el POS típico asume que lo que se guardó = lo que se retira; Pandora registra la discrepancia por si falta un billete.

## 7. Qué NO vamos a implementar (ahora)
| Idea descartada | Por qué | Trigger para revisar |
|---|---|---|
| Conteo ciego | Feature F1+, el owner hoy quiere ver el esperado | cuando haya empleados que no son el dueño |
| Máx de cajón + alerta | Optimización; no es el dolor de hoy | comercio con mucho volumen de efectivo |
| Variance % en cierre | Reportería avanzada | módulo de reportes/analytics F1 |

## 8. Decisión de diseño
**`Nuevo alivio` = cash drop:** resta del "Efectivo en caja" (cajón) y de "Ingresos − Egresos", y suma a la caja fuerte. El **retiro desde la caja fuerte** (autorizado) NO modifica el cajón (esa plata salió al hacer el alivio; ahora va a tesorería). Interfaz mínima entre scripts: `window.Caja.egreso(monto)` expuesta por el módulo de efectivo, llamada por el módulo de alivios.

## 9. Plan
- **MVP (hoy):** Nuevo alivio resta del efectivo del cajón, en vivo.
- **Futuro F1+:** conteo ciego (toggle), máx de cajón + alerta, variance % en cierre.
- **Riesgos:** doble contabilización si el alivio también se listara en "Egresos/Retiros" (lo evitamos: el alivio impacta el neto pero vive en su propia sección).

## 10. Revisión
El modelo ahora respeta la fórmula canónica de arqueo. Próxima mejora de mayor valor: conteo ciego (mejor práctica anti-sesgo) cuando haya cajeros distintos del dueño.

---
**Sources:** apgsolutions.com/cash-handling-best-practices · shopify.com/blog/balancing-a-cash-drawer · retaildogma.com/balancing-a-cash-drawer · revenueregister.com/topics/balancing_a_cash_drawer · help.loyverse.com/help/shift-management-loyverse-pos · learn.microsoft.com/dynamics365/commerce/cash-mgmt · koronapos.com/blog/cash-handling-procedures-in-retail
