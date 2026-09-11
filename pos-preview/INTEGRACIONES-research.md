# Integraciones de Pandora — research + curaduría

**Fecha:** 2026-06-29
**Deliverable:** `pos-preview/integraciones.html` — panel marketplace (56 integraciones · 11 conectadas · 11 categorías), estilo Stripe Apps / Shopify App Store en dawn-glass. Enchufado al sidebar de las 11 pantallas.

## Principio de diseño (advisor)
- **Estado por integración** (🟢 Conectado / Conectar / Próximamente) = lo que permite ser "super completo" **sin romper scope**: las F2/F3 van como "Próximamente".
- **Lead con "Conectadas"**, después secciones por categoría (no un volcado de 56 cards). Brand tiles (monograma + color de marca), NO logos reales.
- **"Conectado" honesto**: solo lo F0/nativo (AFIP, Contador integrado, MercadoPago vinculado, Email, impresora, lector, CVU, backups, Régimen Transparencia, Excel, cajón = 11).

## Hallazgos AR clave (verificados, mi directiva de no inventar)
- **Cuotas en 3/6**: "Ahora 12" → "Cuota Simple" → **AMBOS derogados (jun-2025/2026)**. Vigente = **"Cuotas MiPyME"** (CAME + Payway). → usé ese.
- **Nave (Galicia) / Viumi (ICBC)**: no confirmados vigentes → **descartados** (nada de tiles stale).
- **Adquirentes**: las dos redes son **Fiserv (Posnet)** y **Prisma (Payway)**; MODO se apoya en ambas. GetNet = Santander.
- **Billeteras top**: MercadoPago, MODO ("billetera de los bancos"), Cuenta DNI, Ualá Bis, Naranja X (Toque), Personal Pay, BNA+.
- **WhatsApp Business API**: enviar factura/presupuesto + link de pago por chat, con marco ARCA claro — alto valor.

## Set curado (11 categorías)
1. **Conectadas** (8): AFIP/ARCA, Contador integrado, MercadoPago, Email, Impresora térmica, Lector de barras, Transferencias/CVU, Backups.
2. **Fiscal y Gobierno** (5): AREF·IIBB TDF, Libro IVA Digital, Mis Comprobantes, Régimen Transparencia (Ley 27.743), IIBB otras prov. (F2).
3. **Cobros y billeteras** (6): MODO, Cuenta DNI, Ualá Bis, Naranja X, Personal Pay, BNA+.
4. **Tarjetas y terminales** (4): Payway (Prisma), Posnet (Fiserv), GetNet, Cuotas MiPyME.
5. **Bancos y conciliación** (5): Galicia, Santander, BBVA, Nación, Macro.
6. **Contabilidad** (7): Tango, Bejerman, Xubio, Holistor, Colppy, SIAP, Excel/CSV.
7. **Comunicación** (3): WhatsApp Business, SMS, Mailchimp.
8. **Ventas online** (5, F2): Tienda Nube, MercadoLibre, WooCommerce, Shopify, Instagram Shop.
9. **Envíos** (5, F2): Mercado Envíos, Andreani, OCA, Correo Argentino, EnvíoPack.
10. **Hardware** (4): Balanza, Cajón, Visor de cliente, Controlador fiscal.
11. **Datos y automatización** (4): Google Sheets, Drive, API/Webhooks (F3), Zapier/Make (F3).

## Coherencia de scope
F0 = Conectadas + las "Disponible" fiscales/pago/hardware. F1 = más billeteras/bancos/WhatsApp. **F2 = Ventas online + Envíos** (coincide con CLAUDE.md §21.2: TiendaNube/MercadoLibre lectura inventario con trigger 50+ clientes). **F3 = API/Zapier.** Generador reproducible: `scratchpad/gen_integraciones.py`.

## Fuentes
- [iProUP — MercadoPago/MODO/Ualá/Naranja comisiones](https://www.iproup.com/finanzas/34928-mercado-pago-uala-modo-y-naranja-cual-conviene-en-pagos) · [Payway QR](https://www.payway.com.ar/cobrar-con-qr)
- [Cuota Simple (argentina.gob.ar)](https://www.argentina.gob.ar/economia/comercio/cuota-simple) · [Infobae — derogación Ahora 12/Cuota Simple](https://www.infobae.com/economia/2026/06/09/el-gobierno-derogo-en-forma-definitva-la-normativa-de-los-programas-ahora-12-cuota-simple-y-precios-cuidados/) · [Cuotas MiPyME (CAME/Payway)](https://www.redcame.org.ar/novedades/14257/fin-del-cuota-simple-came-garantiza-nuevo-programa-de-cuotas-para-el-comercio-pyme)
- [Contabilium — integraciones e-commerce/medios de pago](https://contabilium.com/ar/soluciones-de-gestion-para-ecommerce) · [Producteca integraciones](https://www.producteca.com/integraciones/) · [Tiendanube — apps de gestión](https://ayuda.tiendanube.com/es_ES/123502-aplicaciones-de-gestion-y-facturacion)
- [WhatsApp Business API Argentina (ITPago)](https://itpago.com/blog/5-integraciones-de-whatsapp-business-api-argentina-2026) · [Stripe Apps Marketplace](https://marketplace.stripe.com/) (referencia de UX)
