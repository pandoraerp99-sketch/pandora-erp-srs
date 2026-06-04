# ADR-0004 — AFIP sincrónico en hot path

**Fecha:** 2026-05-17
**Estado:** Aprobado
**Validación:** 🟡 AMARILLO — confirmar con contador advisor

## Contexto

La facturación electrónica con AFIP/ARCA puede integrarse:

- **Sincrónico en hot path:** el cajero espera hasta 30s la respuesta de AFIP antes de imprimir.
- **Asincrónico vía queue:** la venta se completa instantáneamente, factura se genera en background.

El Deep Research Report propuso modo asincrónico con Kafka.

## Decisión

**Modo sincrónico en hot path, timeout 30 segundos, fallback a ticket no fiscal + reconciliación async.**

Flujo:
1. Cajero confirma venta + solicita factura.
2. Application Service reserva número correlativo dentro de transacción Drizzle.
3. Llama WSFEv1 sincrónicamente con timeout 30s.
4. Si CAE en < 30s: imprime con QR fiscal.
5. Si timeout: imprime ticket no fiscal + encola worker reconciliación.
6. Worker `afip-reconciliation` corre cada 5 min, consulta FECompUltimoAutorizado, recupera CAE perdido si AFIP lo procesó. Max 24 intentos = 2 horas.

**Consecuencia adicional (Sesión 3.5):** antes de cada emisión, si la validación del cliente contra Padrón A5 tiene más de 24h, se revalida sincrónicamente. Esto agrega +1-3s al hot path en ese caso. Es trade-off aceptable porque evita emitir facturas con condición fiscal obsoleta. Configurable por tenant (puede deshabilitarse si genera fricción).

## Alternativas rechazadas

- **Async total vía Kafka:** rechazado. El cajero argentino necesita imprimir factura con CAE al momento del cobro. Esperar 60s "para que el worker procese" rompe la promesa de POS rápido.
- **Async con notification al cliente:** rechazado. El cliente espera ticket en el momento. Notification "tu factura llegará por email en 5 min" es invendible.

## Consecuencias

**Positivas:**
- Experiencia POS fluida cuando AFIP responde bien (>95% del tiempo).
- Manejo robusto de fallos via reconciliación async.
- Cumple expectativa del cajero/cliente argentino.

**Negativas:**
- Latencia p95 incluye latencia AFIP (~3-8s en condiciones normales, 30s en peor caso).
- Transacción Drizzle abierta 30s en peor caso. Riesgo de lock contention.
- Reconciliación de CAE perdido es complejidad adicional.

**Riesgos a monitorear:**
- Cambios en SLA de AFIP que aumenten latencia media > 10s.
- Tasa de timeouts > 10% (puede indicar bug en AFIP, cert vencido, etc.).
- Lock contention en `invoice_sequences` con > 50 ventas concurrentes.

## 🟡 Pendiente de validación

Confirmar con contador advisor:
- ¿Es legalmente válido emitir ticket no fiscal y "regularizar" después con CAE? La interpretación es que sí porque el ticket no fiscal se reemplaza por la factura definitiva, pero requiere validación formal.
