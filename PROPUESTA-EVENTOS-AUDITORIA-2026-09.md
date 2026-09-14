# Propuesta — eventos de auditoría que faltan (EVENT-TAXONOMY v2.0.3 → v2.1.0)

**Fecha:** 2026-09-14
**Estado:** 🟢 **APROBADA completa por el owner el 2026-09-14** ("dale") e implementada: EVENT-TAXONOMY v2.1.0, test `T-AUDIT-02`, `scripts/mutar-auditoria-plata.sh`. Los hallazgos §4.1 y §4.2 quedaron arreglados en el mismo trabajo; §4.3 (retención) queda anotado en EVENT-TAXONOMY §7.
**Origen:** auditoría de documentación del 2026-09-14 → decisión abierta 🔴 del DECISION-LEDGER ("mutaciones de plata y de acceso sin evento de audit_log")
**Qué pide la regla:** CLAUDE.md §16.9 — *"toda tabla con datos de tenant: evento `audit_log` en cada mutation crítica"*; §1.7 — *"decir 'no se loguea' debe ser una decisión deliberada y documentada"*.

> Cómo leer esto: cada evento dice **qué hecho deja asentado, por qué es crítico y
> qué lleva adentro**. Podés aprobar todo, aprobar una parte, o cambiar nombres.
> Lo que se rechace queda anotado como "no se audita, a propósito" — que también
> cumple la regla.

---

## 1. Lo que hay hoy (verificado contra el código)

| Operación | Función | ¿Qué deja? |
|---|---|---|
| Cargar un gasto (y, si es mercadería, **entrar stock**) | `registerExpense` | Sólo log Pino. El stock entra con `skip_audit: true` |
| **Anular** un gasto (devuelve plata a la caja + **saca stock**) | `annulExpense` | Sólo log Pino `expense.annulled`. El stock sale con `skip_audit: true` |
| Cliente paga su cuenta corriente (efectivo **entra al cajón**) | `settleAccount` | Sólo log Pino `account.settled` |
| Ajuste manual que **suma deuda** a un cliente | `adjustAccount` | **Nada** (ni Pino) |
| Fiar en una venta | `registerChargeFromSale` | Log Pino — pero **ya queda cubierto** por `sale.completed` (ver §3) |
| Dar acceso a la contadora | `inviteAccountant` → `linkAccountant` | Sólo log Pino `accountant.invited` |
| Sacarle el acceso | `revokeAccountant` | Log Pino, y un `DELETE` sin rastro en la base |

Pino rota en días; `audit_log` es inmutable y se guarda por partición anual. Hoy,
un gasto anulado en marzo **no se puede explicar en diciembre** más que por la
fila `ANULADO: <motivo>` en `expenses`, que dice qué, pero no **quién ni desde
qué pedido**.

### El hallazgo que empuja esto

`registerExpense` le pasa `skip_audit: true` al movimiento de stock con el
comentario *"mismo criterio que `finalizeSale`"*. Pero `finalizeSale` apaga el
audit del movimiento **porque emite `sale.completed` con los
`stock_movement_ids`** — y el gasto no emite nada. Resultado: **la mercadería
comprada entra al stock, y la de una compra anulada sale, sin un solo evento de
auditoría.** El comentario es cierto a medias, y la mitad que falta es la que
importa.

---

## 2. Eventos propuestos (6 → el catálogo pasa de 43 a 49)

Naming según EVENT-TAXONOMY §6 (`{domain}.{entity?}.{action}`, verbo en pasado).
Para no inflar la lista cerrada de **dominios**, dos de los tres grupos entran
como entidad de un dominio que ya existe (`customer`, `auth`). Sólo `expense` es
dominio nuevo.

`pii_level: internal` en los seis a propósito: el payload lleva **ids**, no
nombres, emails ni CUIT. La persona se reconstruye por join; el audit no
duplica datos personales por 10 años.

### 2.1 Gastos — dominio nuevo `expense`

| `event_name` | severity | pii_level | Por qué es crítico |
|---|---|---|---|
| `expense.registered` | info | internal | Sale plata del comercio y, si es mercadería, **entra stock valorizado**. Es la contracara de `sale.completed`: sin él, el inventario valorizado que va al estudio (ítem 8) no tiene rastro de por qué subió. |
| `expense.annulled` | **warning** | internal | Deshace un hecho ya registrado: **devuelve plata a la caja de hoy y saca stock** con la fecha original. Es la operación que un inspector o la contadora van a preguntar. Mismo peso que `sale.voided` (warning). |

**Payload `expense.registered`**
```
{ expense_id, fecha, categoria, total, neto, iva, medio_pago, en_iva_compras,
  tercero_id, comprobante_tipo, comprobante_numero,
  cash_movement_id,                 // null si no salió del cajón
  items: [{ product_id, qty, unit_cost }],
  stock_movement_ids: [...] }       // mismo patrón que sale.completed
```

**Payload `expense.annulled`**
```
{ expense_id,            // el original
  annulment_id,          // la fila en cero con corrects_id
  fecha_original, total_anulado, motivo,
  devolvio_a_caja: bool, cash_session_id, deposit_cash_movement_id,
  stock_movement_ids: [...] }       // las salidas que revierten la compra
```

### 2.2 Cuenta corriente — entidad `account` bajo `customer`

| `event_name` | severity | pii_level | Por qué es crítico |
|---|---|---|---|
| `customer.account.settled` | info | internal | Cobro de deuda. En efectivo **entra plata al cajón** fuera de una venta: si el arqueo no cierra, este es el movimiento a mirar. |
| `customer.account.adjusted` | **warning** | internal | **Le suma deuda a un cliente a mano.** Es exactamente lo que se discute si un cliente dice "yo no debía eso". Hoy no deja ni un log. |

**Payload `customer.account.settled`**
```
{ movement_id, customer_id, amount, method, saldo_antes,
  cash_session_id, cash_movement_id }   // null si no fue efectivo
```

**Payload `customer.account.adjusted`**
```
{ movement_id, customer_id, amount, reason, saldo_antes }
```

### 2.3 Acceso de la contadora — entidad `accountant` bajo `auth`

| `event_name` | severity | pii_level | Por qué es crítico |
|---|---|---|---|
| `auth.accountant.granted` | **warning** | internal | Un **tercero** pasa a ver los datos fiscales y comerciales del tenant. Es la misma familia que CLAUDE.md §7.8 cuida para soporte (*"toda activación deja audit"*): hoy, dar ese acceso **no deja rastro inmutable**. |
| `auth.accountant.revoked` | **warning** | internal | El vínculo se **borra** (`DELETE` en `company_users`): sin este evento, no queda en ningún lado que alguna vez tuvo acceso, ni hasta cuándo. |

**Payload `auth.accountant.granted`** — sólo cuando el vínculo **se crea** (si ya
estaba, no cambió nada → Pino, como hoy)
```
{ accountant_user_id, via: 'invitacion' | 'usuario_existente' }
```

**Payload `auth.accountant.revoked`** — sólo si **efectivamente** se borró una fila
```
{ accountant_user_id }
```

---

## 3. Lo que NO se audita — decidido, no olvidado

| Operación | Decisión | Por qué |
|---|---|---|
| **Pendientes** (`task.service`: crear, completar, reabrir, editar, borrar) | ❌ No va a `audit_log` | Un pendiente es una **intención**, no un hecho económico. Es la primera tabla que se edita a propósito. Auditarla llenaría el log de ruido que nadie va a pedir, y es exactamente lo que EVENT-TAXONOMY §5 "Lo que NO va" excluye. Sigue en Pino. |
| **Fiar en una venta** (`registerChargeFromSale`) | ❌ Sin evento propio | Corre **dentro** de `finalizeSale`, y `sale.completed` ya lleva `payments[]` con `method: 'cuenta_corriente'` + importe + snapshot del cliente. Un evento aparte duplicaría el mismo hecho — la regla J1 dice UN evento agregado por operación. |
| **Alta/edición de proveedores** (`terceros`) | ❌ | Igual que el nombre de un producto: no cambia plata ni stock. |
| **El `cash_movement` del cobro o de la devolución** | ❌ Sin evento propio | Ya decidido en el Ledger (Sprint 4): los movimientos de caja no se auditan uno por uno, se resumen en `cash_session.closed*`. Lo que se audita acá es el **hecho de negocio** (cobro, anulación), y su payload lleva el `cash_movement_id` para cruzarlo. |

### Alternativa considerada y descartada

**Reusar `auth.role.changed` para la contadora** (catálogo intacto). Se descarta:
ese evento es "a un usuario del comercio le cambiaron el rol"; dar acceso a un
tercero externo es otro hecho. Reusarlo haría que el log **mintiera sobre qué
pasó** — el mismo razonamiento por el que la anulación de compra no se audita
como `stock.adjusted_manually`.

---

## 4. Tres cosas que aparecieron al leer el código (no son eventos)

1. 🔴 **`adjustAccount` no verifica que el cliente sea de este comercio.**
   `registerChargeFromSale` sí lo hace; `adjustAccount` inserta directo. La FK
   `customer_id → customers(id)` **no ata el tenant** (verificado en la base con
   `scripts/fk-cuenta-corriente.sh`). Hoy es **latente**: ninguna pantalla ni
   action llama a `adjustAccount`. Se arregla con el mismo chequeo + test
   cross-tenant, en el mismo PR que el cableado.
2. 🟡 **`revokeAccountant` no sabe si borró algo.** Revocar a alguien que no
   estaba vinculado "funciona" en silencio. Con `.returning()` se sabe, y eso es
   lo que decide si se emite el evento.
3. 🟡 **La retención por severidad no está implementada.** `computeRetentionDays`
   (EVENT-TAXONOMY §7) existe en el documento, no en `audit-writer.ts`: hoy todo
   evento vive lo que vive su partición anual. Si algún día se implementa,
   `expense.*` y `customer.account.*` tienen que entrar en el override de 10
   años junto a `payment.*` — con la tabla por defecto, `expense.registered`
   (info) duraría 90 días, que para un gasto no sirve. Para
   `auth.accountant.*` el plazo legal es pregunta **B-5** (abogado), no nuestra.

---

## 5. Si se aprueba — cómo se cablea

Mismo método que el resto del proyecto:

1. **RED primero**, un test de integración por evento: la mutación deja
   **exactamente una** fila en `audit_log` con ese `event_name` y ese payload, en
   la **misma transacción** (si la mutación hace rollback, no queda audit).
2. `event-names.ts` + EVENT-TAXONOMY **v2.1.0** (MINOR: aditivo) + fila en
   DECISION-LEDGER + domains permitidos (§6: agregar `expense`).
3. `writeAuditLog(..., tx)` dentro de cada transacción. `registerExpense`,
   `annulExpense` y `settleAccount` ya abren una; `adjustAccount`,
   `linkAccountant` y `revokeAccountant` (un solo INSERT/DELETE cada una) tienen
   que pasar a correr en una.
4. Arreglo de §4.1 y §4.2 con sus tests.
5. Mutaciones: sacar cada `writeAuditLog` tiene que poner un test en rojo.

**Para aprobar:** alcanza con decir "dale" (todo), o qué eventos sí / no / con
otro nombre.
