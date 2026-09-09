# Evidencia — Lo que la contadora le pide al comercio

**Fecha:** 2026-09-09
**Origen:** pedido real de la contadora de **ROMERO & RUIZ SAS** al cliente, para los
Estados Contables del ejercicio N° 2 (01/08/2025 → 31/07/2026). Detalle al 07/09/2026.
**Por qué importa:** es la **especificación real** de qué tiene que producir Pandora
para la contadora. No es una hipótesis nuestra ni una maqueta: es lo que un
profesional matriculado pide, por escrito, a un comercio que existe.

> Vale más que cualquier research: acá no hay que adivinar qué necesita el
> contador. Está la lista.

---

## 1. La lista, contra lo que Pandora tiene hoy

| # | Lo que pide | ¿Pandora lo puede dar? | Nota |
|---|---|---|---|
| 1 | Saldo de **caja** al cierre del ejercicio | ✅ **Sí, hoy** | `cash_sessions`. En el pedido está puesto **a mano**: "$349.000". Pandora lo da exacto a cualquier fecha. |
| 2 | Saldo en **moneda extranjera** al cierre | ❌ | ARS-only (CLAUDE.md §9.4). Está "Pendiente" en el pedido. |
| 3 | **Extractos bancarios** mensuales de todas las cuentas **y billeteras virtuales** | ❌ | Ojo: "billeteras virtuales" incluye MercadoPago, donde Pandora sí tiene `mp_payments`. No es el extracto, pero es la mitad. |
| 4 | Detalle de **cheques emitidos** | ❌ | No hay cheques. (Acá: "sin cheques emitidos".) |
| 5 | **Deudores** por prestación de servicios: **razón social, CUIT e importe** | ✅ **Sí, hoy** | Es EXACTAMENTE la cuenta corriente (ADR-0027) + `customers.doc_number`. En el pedido dice "Sin deudores" — porque no lo llevan, no porque no exista. |
| 6 | **Otros créditos**: depósitos en garantía, retiro de socios, sumas a cobrar | ❌ | Contabilidad societaria, fuera del POS. |
| 7 | Inventario de **bienes de uso** (fecha de adquisición, descripción, valor de compra) | ❌ | Activos fijos. No existe. |
| 8 | Inventario de **bienes de cambio VALORIZADO** al cierre (fecha adq., detalle, importe de compra) | 🟡 **Casi** | Hay stock y `products.cost`. **Falta la fecha de adquisición por lote** — hoy el costo es un valor único del producto, no por compra. Está "Pendiente" en el pedido. |
| 9 | **Proveedores/acreedores**: razón social, CUIT e importe | 🟡 **Media** (2026-09-09) | El **proveedor con CUIT** ya sale: `expenses.payee_name` + `payee_doc`, y `terceros` type='proveedor'. Lo que falta es la otra mitad: "acreedores **a la fecha de cierre**" son los que **NO se pagaron**, y todo gasto en Pandora nace pagado (tiene `medio_pago`). Cuenta corriente de proveedores está diferida en el brief. |
| 10 | **Préstamos bancarios** | ❌ | — |
| 11 | **Libro IVA compras y ventas** del ejercicio | 🟡 | Ventas: cuando se emita ante AFIP. Compras: no. El pedido aclara que **el estudio ya lo tiene** (lo baja de ARCA). |
| 12 | Comprobantes de pago: **alquileres** (con contrato), **seguros**, **servicios** (luz, gas, agua, cable, teléfono), **impuestos y tasas municipales**, **honorarios de directores**, y **otros gastos no incluidos en el IVA compras** | 🟡 **Media** (2026-09-09) | **Construido**: `/gastos` con esas mismas 6 categorías + export CSV. Lo que da es el **detalle** de cada pago (fecha, proveedor, CUIT, comprobante, importe, medio). Lo que NO da es el **comprobante en sí** —el PDF, la foto, el contrato de alquiler— porque adjuntos quedó diferido en el brief (necesita Storage por tenant). Ver §3. |

**Marcador: de 12 ítems, Pandora cubre 2 enteros y 3 a medias** (era 2 y 1 antes
del módulo de gastos, 2026-09-09).

## 2. Lo que esto corrige de lo que estábamos construyendo

### a) El ejercicio NO es el año calendario

ROMERO & RUIZ cierra el **31/07**. El selector "Año" del panel usa **año
calendario**, así que para esta empresa daría un período que no le sirve a nadie:
no coincide con el balance ni con ninguna presentación.

~~**Falta un dato en `companies`: la fecha de cierre de ejercicio.**~~
✅ **Resuelto el 2026-09-09** (migration 0027,
`companies.fiscal_year_end_month`). El grano **Ejercicio** ya existe en
`/gastos` y en `/contador`, y es el recorte con el que la contadora
efectivamente trabaja. Ver §3.

### b) Una sociedad tiene OTROS vencimientos, y no dependen del CUIT

El research de vencimientos (`RESEARCH-BRIEF-vencimientos-fiscales.md`) miró el
calendario **mensual** de ARCA (IVA, Monotributo), que se ordena por terminación
de CUIT. Pero lo que este pedido lista para una SAS es otra cosa:

| Obligación | Vence |
|---|---|
| Ganancias Sociedades | **14/12/2026** |
| P.U.B. (Presentación Única de Balance) | **31/01/2027** |
| Participaciones Societarias | **28/07/2027** |

Son **anuales y atadas a la fecha de cierre de ejercicio**, no a la terminación
de CUIT. O sea: hay dos calendarios distintos, y el brief sólo cubría uno.

### c) La multa dejó de ser simbólica — VERIFICADO

El pedido advierte $440.000 por falta de presentación en término. **Es exacto.**

> **Ley 27.799**, art. 15 (BO 02/01/2026): sustituye en el primer párrafo del
> art. 38 de la Ley 11.683 la expresión "cuatrocientos pesos ($400)" por
> **"pesos cuatrocientos cuarenta mil ($440.000)"** para sociedades, asociaciones
> o entidades constituidas en el país; y "doscientos pesos ($200)" por
> **"pesos doscientos veinte mil ($220.000)"** para personas humanas.
>
> Fuente: https://www.boletinoficial.gob.ar/detalleAviso/primera/337029/20260102
> (verificado 2026-09-09)

Eran **$400 nominales**, congelados desde hacía décadas: en la práctica, nadie
los miraba. Ahora presentar tarde cuesta plata de verdad.

**Qué cambia:** la sección "Próximos vencimientos" pasa de ser un lindo-de-tener
a justificar el producto sola. Y refuerza la decisión del brief de **no inventar
fechas**: el costo de una fecha mal puesta ahora tiene número.

## 3. El hallazgo de producto más grande

Una línea del pedido, respondida por el comercio:

> *"Otros gastos no incluidos en el IVA COMPRAS. **Ok, clasifico gastos y envío
> gastos no incluidos en ARCA mensualmente**."*

Eso es trabajo manual, **todos los meses**, hecho por la persona que atiende el
comercio. Y es el mismo dato que hoy bloquea media app:

- **IVA crédito fiscal** → hoy la Posición de IVA no puede cerrar.
- **Estado de Resultados** → falta costo de mercadería vendida y gastos.
- **Proveedores/acreedores** del ítem 9.
- **Comprobantes de alquiler, seguros, servicios y tasas** del ítem 12.

Un módulo de **gastos con categoría** —aunque sea carga manual con foto del
comprobante— destraba los cuatro y le saca a una persona real un trabajo mensual
que ya está haciendo. Es el candidato más fuerte para lo próximo, y no salió de
una maqueta: salió de un pedido.

### ✅ CONSTRUIDO (2026-09-09, commits `14d7e1f` + `ca83d2e`)

Módulo + pantalla `/gastos`: carga con las 6 categorías del pedido, listado del
período, y **export CSV de los que no entran al IVA compras** — exactamente la
frase de arriba, hecha botón. La Posición de IVA del panel ya cierra con crédito
fiscal real.

**Las dos cosas que se vieron al releer el pedido con la pantalla ya hecha
quedaron RESUELTAS el 2026-09-09 (commit `68e021d`):**

1. ~~**El export no puede recortar el ejercicio.**~~ ✅ **Resuelto.**

   *Era:* el selector ofrecía mes, trimestre y año **calendario**, y el
   ejercicio de esta empresa va del **01/08/2025 al 31/07/2026** — ninguno de
   los tres lo daba. Para armar el pedido había que bajar 12 meses sueltos y
   pegarlos, o sea el mismo trabajo manual que esto vino a sacar.

   *Ahora:* migration 0027 agrega `companies.fiscal_year_end_month` (cierra el
   §2.a) y el selector ofrece **Ejercicio** — el último **cerrado**, que es el
   que tiene destinatario. Verificado con cierre en julio:
   `/gastos?periodo=ejercicio` muestra *"ejercicio 01/08/2025 al 31/07/2026"*,
   el rango exacto de este pedido, y el CSV trae esos mismos doce meses.

2. ~~**La contadora pide DOS cosas distintas de los gastos, y el botón da una.**~~
   ✅ **Resuelto.**

   El último sub-ítem ("otros gastos **no incluidos** en el IVA compras") era lo
   único que exportaba. Pero los cinco anteriores —alquiler, seguros, servicios,
   impuestos y tasas, honorarios— los pide **igual**, tengan o no factura: son
   "comprobantes de **pago**", que es otra cosa que el libro IVA compras. Para
   ésos hace falta exportar **todos** los gastos del período, no sólo los de
   afuera de ARCA. El servicio ya lo soporta (`getExpenseTotals(..., false)` y
   `exportarGastosCsvAction(grano, false)`, ambos con test). El botón
   "Exportar para el estudio" abre un menú con las dos, cada una con su
   explicación: *Lo que hay que mandar* (la rutina mensual) y *Todos los
   gastos* (los comprobantes de pago, para el balance).

## 4. Detalles menores pero reales

- La contadora pide **CUIT** en deudores y proveedores. `customers.doc_number`
  existe y es opcional: para que el listado sirva, en los clientes B2B tiene que
  estar cargado. Vale un aviso en la pantalla de Clientes.
- El inventario de bienes de cambio pide **fecha de adquisición e importe de
  compra**, no el costo actual. Es un modelo por **lote**, no por producto.
- El plazo del pedido son **30 días desde la recepción**, y vencerlo es del
  contribuyente. Un recordatorio de "documentación pedida por tu contador" es
  una función chica y de valor alto.

---

## Qué NO concluir de esto

Que hay que construir un sistema contable. **No.** La lista es del *estudio*: la
contadora arma los Estados Contables. Lo que Pandora tiene que hacer es
**entregarle los datos que ya nacen en el comercio** —caja, deudores,
inventario, gastos— sin que nadie los transcriba. Los ítems 6, 7, 9 y 10
(créditos societarios, bienes de uso, préstamos) son del estudio, no del POS, y
seguirlos sería el Frankenstein ERP que CLAUDE.md §4.4 rechaza.
