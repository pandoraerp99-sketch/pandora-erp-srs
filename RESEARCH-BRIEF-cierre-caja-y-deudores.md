# Research Brief — Caja y deudores **a la fecha de cierre** (ítems 1 y 5)

**Fecha:** 2026-09-16
**Estado:** 🧩 diseño
**Autor:** sesión Claude Opus 5 + Agus
**Relacionado:** [EVIDENCIA-pedido-contadora-2026-09.md](EVIDENCIA-pedido-contadora-2026-09.md) ítems 1 y 5 · ADR-0027 (cuenta corriente append-only) · migration 0027 (`fiscal_year_end_month`) · brief del inventario valorizado (mismo patrón: foto a una fecha + CSV + método declarado)

---

## 1. Objetivo

Que el comercio pueda **sacar de Pandora** los dos primeros datos que la contadora
pide para el balance, **a la fecha de cierre del ejercicio** (31/07 para ROMERO &
RUIZ, no 31/12):

1. **Saldo de caja al cierre** — hoy en el pedido está escrito **a mano**: "$349.000".
2. **Deudores** — razón social, **CUIT** e importe.

## 2. Problema de negocio

- **Problema:** los dos ítems figuran ✅ en la evidencia, pero eso mide que **el dato
  existe en la base**, no que alguien pueda sacarlo. Medido contra el código:
  - `getResumenContable()` devuelve de caja `{cierres, conDescuadre, descuadreTotal}`
    — **cuántos cierres hubo y el descuadre, nunca el saldo**.
  - `getDeudores(limite=6)` devuelve `{nombre, saldo}` calculado **a HOY**, sin CUIT
    y sin export. El balance necesita el saldo **al 31/07**, no el de hoy.
- **Usuario:** la contadora (vía el comercio). Es literalmente la primera línea de su lista.
- **Impacto:** alto y barato — los datos ya están, falta la consulta y la pantalla.
- **Complejidad:** baja-media. Sin migraciones.

## 3. Investigación (lo que se miró, contra el código real)

| Fuente | Hallazgo |
|---|---|
| `src/lib/db/schema/cash_sessions.ts` | `final_amount` = **efectivo contado** al cerrar. CHECK de cierre todo-o-nada, inmutable post-cierre. UNIQUE parcial: **una sesión abierta por `(tenant, sale_point)`** → puede haber **N puntos de venta**. |
| Pantalla `/caja` (cierre) | El arqueo separa Efectivo / QR-Transferencia / Débito / Crédito. `final_amount` es **la línea de efectivo**. |
| `src/lib/db/schema/customer_account.ts` | Libro append-only (ADR-0027): `type ∈ charge/payment/adjustment`, `amount` siempre positivo. **No hay columna de fecha de negocio — sólo `created_at`.** |
| `src/lib/services/reporting/accountant.report.ts` | `getMesCierreEjercicio()` y el grano `ejercicio` ya existen; la caja y los deudores **no** usan la fecha de cierre. |
| Ítem 8 (inventario valorizado, `3be8928`) | Precedente del patrón: foto a una fecha + tres estados + método declarado adentro del CSV. |

## 4. Decisiones de diseño

### a) "Saldo de caja" son N cajas, no una

Se suma el `final_amount` de **cada sesión cerrada** de ese día y se muestra **el
desglose por punto de venta al lado**. Un número solo se volvería otra cosa en
silencio el día que el comercio abra una segunda caja (§6.2: el número nunca va solo).

### b) Es **efectivo**, y se dice

`final_amount` es la plata del cajón. Lo cobrado con tarjeta/QR no está ahí (es un
crédito contra el banco/billetera = ítem 3, que Pandora no tiene). La tarjeta y el
CSV lo escriben; si no, el número se lee como "toda la plata al cierre" y queda corto.

### c) Tres estados, y uno de ellos **no lleva número**

| Estado | Qué se muestra |
|---|---|
| **Contado ese día** | El total contado + desglose por caja. |
| **Último cierre anterior** | El monto **con su fecha** ("contado el 29/07"), marcado como tal. |
| **Quedó abierta** | **Sin número.** "La caja del 31/07 quedó abierta, nunca se contó." |
| **Sin datos** | No hay ninguna sesión cerrada hasta esa fecha. |

Para una sesión abierta habría que hacer `inicial + movimientos`: eso es **aritmética
de Pandora, no un hecho contado**. El balance pide plata contada. Se muestra el hueco.

### d) Deudores al cierre: el corte es `created_at`, y se declara

Se suma `charge − payment ± adjustment` con `created_at < inicioDelDia(díaSiguienteAlCierre)`
en el reloj del comercio (`America/Argentina/Ushuaia`), como el resto del reporte.
Se agrega **CUIT/DNI** (`customers.doc_type` + `doc_number`) y export CSV.

**Limitación declarada dentro del CSV:** un fiado del 30/07 cargado el 02/08 cae en el
ejercicio siguiente. El libro no tiene fecha de negocio, sólo de registración. Se dice,
igual que el CSV de acreedores del ítem 9 aclara su propio caveat. **No** se agrega
columna de fecha en este slice — es una migración que el pedido no bloquea.

## 5. Qué NO se construye

| Idea | Por qué | Trigger |
|---|---|---|
| Columna `fecha` de negocio en el libro de cuenta corriente | Migración cara; el pedido no la bloquea. El desfase se declara. | Si la contadora dice que el corte por registración le rompe el balance |
| Saldo estimado de una caja abierta | Sería un número calculado por Pandora presentado como plata contada | Nunca |
| Ítem 2 (moneda extranjera), 3 (extractos), 9 acreedores impagos | Datos que Pandora no tiene; la evidencia ya lo dice | Los suyos propios |
| Sumar QR/tarjeta al "saldo de caja" | No es plata en el cajón: es ítem 3 | Cuando exista conciliación bancaria (F2) |

## 6. Plan

**MVP:** capa pura con los estados + dos consultas en `accountant.report.ts` + tarjeta
"Al cierre del ejercicio" en `/contador` + CSV de deudores con CUIT.

**Tests obligatorios:**
- Unit (capa pura): los 4 estados de la caja; el abierto **no** emite monto; N puntos de venta suman y se listan.
- Unit: saldo de un cliente con `charge/payment/adjustment` a ambos lados del corte → al cierre ≠ hoy.
- Integración: el CSV trae razón social + CUIT + importe y el caveat.
- **Datos reales**: la base de dev tiene `porCobrar = $0` y **cero deudores** → una pantalla verde acá **no prueba nada**. Script que inserta movimientos cruzando el 31/07, mide que el saldo al cierre difiere del de hoy, y limpia ([[base-de-dev-y-chequeos-en-falso]]).
- Sin `Number` en el camino de la plata (Decimal.js).

**Riesgos:** el corte por `created_at` (declarado); zona horaria en el borde del día
(se usa `inicioDelDia()`, ya probado); un comercio con dos cajas (cubierto por el desglose).

## 7. Revisión

Post-implementación: ¿el estado "quedó abierta" aparece alguna vez en una base real?
Si es frecuente, el problema no es el reporte — es que se está cerrando mal la caja.
