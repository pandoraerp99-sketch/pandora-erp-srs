# Research Brief — Egresos de caja estructurados (concepto + beneficiario) + búsqueda de movimientos

**Fecha:** 2026-07-13
**Estado:** 🧩 diseño → 🚧 en implementación
**Autor:** sesión Claude (con advisor)
**Relacionado:** ADR-0026 (reclassify append-only), cash_withdrawal_reasons (664217e), NON-GOALS (payroll/HR, módulo compras F1+), CAPABILITY-MAP Cash

> Corrige la primera versión (a medias): el cajero **tipeaba** el concepto. Debe **seleccionarlo**, elegir el **beneficiario** (empleado/proveedor) y las **notas** aparte. Además la lista de movimientos debe ser **buscable por nombre y monto**, no solo por medio.

---

## 1. Objetivo
Que registrar una salida de plata de la caja sea rápido y bien clasificado: **concepto** (elegido de lista), **beneficiario/tercero** (empleado o proveedor, elegido — con escape "Otro"), **monto** y **notas**. Y que la lista de movimientos del día se pueda **buscar/filtrar** por los campos que importan (nombre de cliente, monto, medio).

## 2. Problema de negocio
- **Problema:** hoy el cajero tipea texto libre → datos inconsistentes, imposible saber "cuánto le pagué a tal proveedor / en sueldos". Y no se puede encontrar una venta por nombre/monto en la caja.
- **Usuarios:** cajero (registra rápido, sin escribir de más), dueño (define conceptos/terceros, y después reportea).
- **Impacto:** alto — es el uso diario real de la caja del comercio (la novia).
- **Complejidad:** media. Catálogos + pickers en cascada + filtros. Sin tocar fiscal ni el motor del cierre.

## 3. Investigación (fuentes)
| Categoría | Hallazgo clave | Fuente |
|---|---|---|
| Contabilidad / comprobante de egreso | Una salida de caja se registra como **monto + concepto (expense head) + tercero/beneficiario (proveedor/empleado/cliente) + notas + comprobante**. El "tercero" es campo central. | [Siigo — comprobante de egreso](https://www.siigo.com/blog/que-es-un-comprobante-de-egreso/) (2026-07-13) |
| POS competidores (Alegra, Siigo POS, EGA Futura) | Al registrar salida: monto + **cuenta contable/concepto** + **seleccionar el tercero** al que se carga. Generan comprobante. | [Alegra POS efectivo](https://ayuda.alegra.com/int/gestiona-tu-dinero-desde-el-punto-de-venta-pos) (2026-07-13) |
| Petty cash best practices (US) | Documentar payee + purpose + amount + date. Categorizar por "expense heads". Restringir acceso, aprobaciones, límites por ítem, conciliar. | [Ramp cash disbursement](https://ramp.com/blog/what-is-cash-disbursement), [Alaan expense heads](https://www.alaan.com/blog/petty-cash-expenses-heads-guide) (2026-07-13) |
| Filtros/búsqueda UX | Filtros **combinables**, selección múltiple, **chips removibles**, **contador de resultados dinámico**, "Limpiar todo", **rango** para montos, texto para nombres. | [UXPin filter UX](https://www.uxpin.com/studio/blog/filter-ui-and-ux/), [Baymard multi-filter](https://baymard.com/blog/allow-applying-of-multiple-filter-values) (2026-07-13) |

## 4. Síntesis — qué incorporamos
| Idea | ¿Vale? | Nota |
|---|---|---|
| Concepto = lista gestionada (no tipear) | ✅ | Ya existe `cash_withdrawal_reasons`; se le agrega `beneficiario_tipo`. |
| Beneficiario/tercero seleccionable + "Otro" libre | ✅ | Catálogo nuevo `terceros` (empleado/proveedor). |
| `payee_id` FK **+** nombre snapshot | ✅ | FK para agregación futura; snapshot para comprobante/historia (advisor). |
| Notas aparte | ✅ | Campo libre opcional. |
| Filtros combinables (nombre + monto + medios) + contador + limpiar | ✅ | Client-side sobre las ventas del día. |
| Comprobante de egreso imprimible | ⏸️ | Diferido (ver §7). |
| Aprobaciones / límites por ítem | ⏸️ | Diferido (ver §7). |

## 5. Estado del arte
Siigo/Alegra POS: salida de caja = concepto + tercero + monto + comprobante. Pandora iguala eso, con el toque de "el comerciante primero": cero tipeo del cajero (todo selección), "Otro" siempre a mano, pickers buscables.

## 6. Qué hacemos MEJOR / invariantes
- **Cero fricción para el cajero:** selecciona, no escribe (salvo "Otro" o notas).
- **"Otro" nunca crea catálogo** (respeta owner-only): se guarda como texto snapshot con `payee_id=null`. Solo el dueño agrega terceros.
- **Renombrar/baja no reescribe historia:** el movimiento guarda snapshot del concepto y del beneficiario.
- **Todo lo que sea lista, es buscable** (criterio permanente del owner): el picker de terceros y la lista de movimientos tienen búsqueda.

## 7. Qué NO implementamos ahora
| Idea | Por qué | Trigger |
|---|---|---|
| Payroll (sueldos, cargas, liquidación) | NON-GOAL. `terceros` empleado = solo nombre para atribuir un pago, NO nómina. | Nunca sin cliente que pague módulo RRHH |
| Cuenta corriente proveedor / módulo compras | F1+. `terceros` proveedor = nombre + CUIT opcional. | Primer cliente que necesite compras |
| Comprobante de egreso PDF imprimible | Valor bajo F0 (comercio chico). El movimiento queda registrado + auditable. | Pedido real de imprimir el vale |
| Aprobación/límite por ítem de retiro | Owner y cajero suelen ser la misma persona/confianza F0. | Comercio con varios cajeros + control |
| Reporte de agregación ("cuánto a cada tercero/concepto") | La DATA queda estructurada (payee_id/concept_id) para no pintar la esquina; el reporte se hace después. | Al construir Reportes |
| Búsqueda por rango de fechas en caja | La caja muestra el día actual; rango es para Reportes. | Vista histórica de movimientos |

## 8. Decisión de diseño
Sin ADR (config + catálogos mutables, no toca invariantes). Modelo:

- **`cash_withdrawal_reasons`** += `beneficiario_tipo ∈ {ninguno, empleado, proveedor}`. Backfill: proveedor→proveedor, sueldo→empleado, mercadería→proveedor, Otros→ninguno. Configurable por el dueño.
- **`terceros`** (tabla nueva, genérica, reusable por compras F1+): `{id, tenant_id, type: empleado|proveedor, name, doc (CUIT nullable), is_active, sort_order, timestamps}`. Owner-managed, soft-delete. Campos mínimos (sin payroll/cuenta corriente).
- **`cash_movements`** += `concept_id` (FK reasons, null salvo retiro/gasto) + `payee_id` (FK terceros, null si "Otro"/no aplica) + `payee_name` (snapshot) + `payee_type` + `notes`. `reason` sigue NOT NULL = label del concepto (o nota para ingreso/alivio).
- **Flujo retiro/gasto:** concepto (chips) → si `beneficiario_tipo≠ninguno`: picker de terceros de ese tipo (**buscable + "Otro" siempre**) → si "Otro": nombre libre → **Notas** (opcional). Submit habilitado solo con monto + concepto + (beneficiario resuelto si aplica).
- **Alivio** (withdraw) y **Ingreso** (deposit): siguen sin concepto/beneficiario (nota).
- **Gate owner** para gestionar conceptos y terceros (assertOwner, ya existe el patrón).

## 9. Plan de implementación
**MVP (ahora):**
1. Schema + migración: `terceros`, `beneficiario_tipo` (+ backfill), columnas en `cash_movements`.
2. Dominio: `terceros.ts` (CRUD owner + list-by-type), `reasons.ts` (beneficiario_tipo), `movements.ts` (register extendido con concept/payee/notes).
3. Actions caja: terceros CRUD + reason con tipo. Flujo retiro extendido.
4. UI CajaClient: picker en cascada (concepto→tercero buscable→Otro→notas), panel owner de terceros + tipo por concepto.
5. Thread B: búsqueda nombre + rango monto + medios multi + contador + limpiar en "Últimos movimientos".

**Tests (TDD):**
- `terceros` CRUD + gate owner (cajero rechazado) + tenant scope + soft-delete.
- `beneficiario_tipo` create/update.
- `registerCashMovement` con concept_id/payee_id/payee_name/notes → persistidos; "Otro" → payee_id null + name snapshot.
- Backfill verificado (los 3 seed rows con tipo correcto).

**Riesgos / edge cases:**
- "Otro" no debe crear tercero (test).
- Beneficiario baja → oculto del picker, movimientos viejos intactos.
- Concepto sin beneficiario_tipo → no pide tercero.
- Consumidor final (venta sin nombre) → la búsqueda por nombre no lo encuentra; el filtro de monto sí (esperado, no es bug).
- Picker de terceros vacío → "Otro" igual disponible.

## 10. Revisión
Post-build: caminar los estados del picker en cascada (concepto→tercero→Otro→notas→submit) — ahí es donde un flujo así se rompe. Verificación browser manual pendiente (no hay Playwright).
