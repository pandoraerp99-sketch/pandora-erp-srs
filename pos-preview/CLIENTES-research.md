# Clientes — Research (Pandora ERP)

**Fecha:** 2026-07-03
**Estado:** research right-sized (la pantalla `clientes-v6.html` y el modelo fiscal ya existen — esto NO parte de cero como pedidos/devoluciones).
**Propósito:** definir el modelo de "tipos de cliente" y cerrar el loop con Ofertas, sin reconstruir la pantalla.

## 1. La decisión central: dos clasificaciones ORTOGONALES

Un cliente tiene **dos** clasificaciones independientes que NO deben mezclarse:

| | **Condición IVA (fiscal)** | **Tipo de cliente (comercial)** |
|---|---|---|
| Qué es | Situación frente al IVA | Segmento / etiqueta comercial |
| Valores | Resp. Inscripto · Monotributo · Cons. Final · Exento | Mayoristas · Jubilados · Estudiantes · VIP · Empleados · Vecinos · **+ los que cree el usuario** |
| Para qué sirve | **Obligatorio fiscal** — determina tipo de comprobante (A/B/C) y va al payload AFIP (`CondicionIVAReceptorId`, RG 5616) | **Comercial** — habilita promos "¿para quién?" ([[Ofertas]]), CRM, trato |
| Cardinalidad | **Uno** (un cliente tiene una condición) | **Varios** (un cliente puede ser Mayorista **y** Vecino) → tags |
| Lo decide | La realidad fiscal del cliente (AFIP/Padrón A5) | El comerciante |

**Son ortogonales:** un Mayorista puede ser RI *o* Monotributo; un Jubilado casi siempre es Cons. Final, pero "Jubilado" es el segmento comercial, no la condición fiscal. → **Campo separado, no un merge.**

## 2. Hogar canónico de los "tipos de cliente" = Clientes

Los tipos comerciales que en Ofertas se crean inline ("+ Nuevo tipo") tienen su **fuente de verdad acá, en Clientes**. Razón: para que una promo "solo Jubilados" funcione en el POS, hay que poder **etiquetar a cada cliente** con su tipo — y eso vive en Clientes. En Ofertas es un atajo; acá es donde se gestionan y se asignan.

- **En producción real:** los tipos viven en la config del tenant (multi-tenant §7), NO hardcodeados. El vocabulario de Clientes y Ofertas es **el mismo**.
- **En el mock:** persisten en sesión; Clientes es la lista "más completa".

## 3. Qué cierra el loop (4 cosas — NO reconstruir la pantalla)

1. **Gestionar la lista de tipos** (crear / eliminar) — reutilizar **verbatim** la interacción "+ Nuevo tipo" / × de Ofertas (que se lea como un solo producto). Vive en un modal "Gestionar tipos".
2. **Asignar tipo(s) a un cliente** — en el panel de detalle (multi-tag).
3. **Mostrarlo en la fila** — chip comercial **visualmente distinto** de la pill de condición IVA (la fiscal queda sobria/sólida; la comercial es outline/dashed, color cálido). Un vistazo = "esa es la fiscal, esa es la comercial".
4. **Filtrar por tipo** — dropdown "Tipo ▾" (NO una segunda fila de chips: el topbar ya tiene el filtro segmentado de condición IVA + deuda).

Lo que YA existe y **no se toca:** lista, condición IVA, cuenta corriente, panel detalle (contacto/stats/spark/deuda), KPIs, deudores, "Ver historial", "Nueva venta", Exportar.

## 4. Lente mercería (importante para que se vea la conexión)

El cast actual es muy B2B (Mayorista Sur, Distribuidora Austral, CUITs grandes, cuentas corrientes de $487k). Para la novia del owner los segmentos que importan son **B2C**: Jubilados, Estudiantes, Vecinos. → agregar un par de clientes Consumidor Final con esos tags, o la conexión con Ofertas no se ve.

## 5. Campos de un cliente (referencia)

- **Fiscales:** nombre / razón social · DNI o CUIT · **condición IVA** · domicilio fiscal (opcional según WSFEv1, ver A-3 contadora) · email (entrega comprobante 10 días).
- **Comerciales:** **tipo(s) de cliente** · contacto (tel/WhatsApp) · localidad · cliente desde · notas.
- **Cuenta corriente:** saldo · antigüedad de deuda · límite (F1+).
- **Derivados:** compras totales · tickets · ticket promedio · última compra · histórico 12m.

## 6. Privacidad (Ley 25.326) — nota

Nombre, DNI/CUIT, domicilio, teléfono y email de un cliente son **datos personales** (`pii_level`: `pii_low`/`pii_high`, ver ADR-0019 S8 + B-9 pendiente abogado). Implica: acceso auditado, retención (10 años lo fiscal), derechos ARCO (B-10). El "tipo de cliente" comercial NO es dato sensible, pero la ficha completa sí es PII. No afecta el mock; se respeta en la implementación real.

## 7. Scope

- **Ahora (este mock):** cerrar el loop (§3) + clientes B2C con tags (§4).
- **F1+ (no ahora):** límite de cuenta corriente + alertas, historial de compras navegable real, import/export masivo, merge de duplicados, envío de recordatorio de deuda por WhatsApp automatizado.

## 8. Fuentes
- Modelo fiscal condición IVA receptor: RG 5616/2024 (ya verificado en [[research-fuentes-oficiales-adr-0023-2026-06-02]] / ADR-0023). Sin RG nueva que verificar acá.
- Privacidad: Ley 25.326 (ADR-0019 S8 + advisor doc B-9/B-10).
