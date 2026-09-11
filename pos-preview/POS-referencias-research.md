# Referencias e inspiración para el POS (Venta)

**Fecha:** 2026-06-29
**Para:** iterar la pantalla de Venta de Pandora. Un POS se juzga por **velocidad y claridad bajo presión** (cajero a las 11pm con cola), no solo por estética — por eso conviene mirar **POS reales** (flujo) + **galerías** (look).

---

## A) POS reales — lo más valioso (probados en mostrador)

| # | Producto | Por qué mirarlo / qué robar | Link |
|---|---|---|---|
| 1 | **Loyverse** | **El más comparable a Pandora** (gratis, retail, muy usado en LatAm/AR; usabilidad 9.9). Robar: grilla de productos densa + categorías, carrito simple, claridad "para no-técnicos". | YouTube "Loyverse POS demo" · loyverse.com |
| 2 | **Square POS / Square for Retail** | Estándar de oro. **4 formas de armar el carrito**: búsqueda por palabra, scroll por categoría, **escaneo de barcode**, y la **grilla de ítems**. Tap targets grandes, checkout limpio. | [Build your cart · Square](https://squareup.com/help/us/en/article/8238-build-your-customer-s-cart-in-the-square-retail-pos-app) |
| 3 | **Lightspeed Retail (X-Series) · Quick Keys** | **Quick keys** = tiles de la pantalla de venta para los productos top → más rápido que buscar. Configurás tu propia grilla. | [Quick keys · Lightspeed](https://x-series-support.lightspeedhq.com/hc/en-us/articles/25534083091867-Setting-up-quick-keys) |
| 4 | **Shopify POS** | Retail moderno y pulido, omnicanal. Robar: búsqueda + carrito + flujo de cobro (tender). | YouTube "Shopify POS walkthrough" |
| 5 | **MercadoPago Point / SumUp** (AR/pagos) | El **momento del cobro** (QR, montos rápidos, vuelto). Relevante para TDF. | apps oficiales |

> Pro-tip: para verlos sin instalar nada, **YouTube → "[nombre] POS demo / walkthrough"** te muestra el flujo real en video.

## B) Galerías de inspiración visual

| Fuente | Qué tiene | Cómo buscar |
|---|---|---|
| **[Mobbin](https://mobbin.com/)** | **Screenshots de apps REALES** (600k+ pantallas, 1.200 apps). Oro porque es producción, no conceptos. | "POS", "checkout", "commerce" |
| **[Dribbble · Point of Sale UI](https://dribbble.com/tags/point-of-sale-ui)** | Conceptos visuales (ej. [SALESWIFT POS UI Kit](https://dribbble.com/shots/25120521-SALESWIFT-Point-of-Sale-POS-UI-Kit)). **Ojo: lindos pero a veces poco prácticos** — robá el look, no el flujo. | `point of sale`, `cashier app`, `POS dashboard`, `retail POS` |
| **Behance** | Case studies completos (flujo + decisiones). | "POS system case study" |
| **Figma Community** | UI kits de POS para diseccionar. | "POS UI kit" |
| **Dribbble (mood Pandora)** | Para el dawn liquid-glass. | `glassmorphism dashboard`, `fintech dashboard`, `iOS 18 / visionOS UI` |

## C) Lecturas de mejores prácticas (carrito/checkout/teclado)
- **Hotkeys / quick keys**: atajos para montos de pago, cambiar de pantalla, devoluciones, descuentos → menos tiempo por transacción.
- **Carrito**: cantidad editable **inline** sin recargar, **totales en tiempo real** tras cualquier cambio, variantes sin volver a la ficha.
- [15 Checkout & Cart UX best practices](https://www.designstudiouiux.com/blog/ecommerce-checkout-ux-best-practices/) · [Loman: Square vs Loyverse](https://loman.ai/blog/square-pos-vs-loyverse) · [G2: best retail POS](https://learn.g2.com/best-retail-pos-systems)

---

## D) Crítica del POS actual de Pandora (vs los mejores)

El POS de Pandora **ya está muy bien**: sidebar consistente, búsqueda con scanner ("LISTO" + ⌘K), categorías, grilla con imagen/SKU/precio/stock/badge "stock bajo", carrito claro (qty −/+, descuento, IVA, total), método de pago + Cobrar. Ideas **para subirlo de nivel** (cada una respaldada por un POS real):

1. **Quick keys / "Más vendidos" siempre a la vista** (Lightspeed/Square) — una fila/grilla fija de los 6-8 productos top para no buscar. Pandora ya tiene tab "Favoritos" → convertirlo en acceso rápido permanente. *El mayor acelerador.*
2. **Atajos de teclado visibles** (CLAUDE.md §14.9: F2 agregar, F3 cliente, F2 cobrar…). Pandora es keyboard-first → **mostrar los hints** para que el cajero los aprenda. El ⌘K de búsqueda es el primer paso.
3. **Montos rápidos en el cobro** (MercadoPago/Square) — botones $5.000 / $10.000 / exacto + cálculo de vuelto. Pandora **ya tiene** los checkpoints `v13-grilla-montos` y `v11-pago-mixto` → asegurar que el flujo de Cobrar los use.
4. **Densidad de la grilla** — hoy muestra 8 productos con espacio vacío abajo. Un POS de alto volumen lo llena (grilla más densa, o sección "recientes/más vendidos"). Square/Loyverse priorizan densidad tappable.
5. **Barcode primero** — el indicador "LISTO" (scanner listo) es un golazo; mantener el camino de escaneo bien al frente (Square pone el barcode como vía principal).
6. **Descuento por línea** rápido en el carrito (atajo) — patrón común en POS retail.

**No tocar:** el look dawn-glass, el carrito limpio, la atmósfera "operacional" (sin animaciones decorativas — el cajero opera rápido, no mira shots de Dribbble).

---

## Fuentes
- [Square — Build your cart](https://squareup.com/help/us/en/article/8238-build-your-customer-s-cart-in-the-square-retail-pos-app)
- [Lightspeed — Quick keys](https://x-series-support.lightspeedhq.com/hc/en-us/articles/25534083091867-Setting-up-quick-keys)
- [Dribbble — Point of Sale UI](https://dribbble.com/tags/point-of-sale-ui) · [SALESWIFT POS UI Kit](https://dribbble.com/shots/25120521-SALESWIFT-Point-of-Sale-POS-UI-Kit)
- [Mobbin](https://mobbin.com/)
- [Checkout & Cart UX best practices](https://www.designstudiouiux.com/blog/ecommerce-checkout-ux-best-practices/)
- [Square vs Loyverse (Merchant Maverick)](https://www.merchantmaverick.com/loyverse-vs-square/) · [G2 best retail POS](https://learn.g2.com/best-retail-pos-systems)
