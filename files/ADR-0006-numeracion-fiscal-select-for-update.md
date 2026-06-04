# ADR-0006 — Numeración fiscal correlativa con SELECT FOR UPDATE

**Fecha:** 2026-05-17
**Estado:** Aprobado

## Contexto

AFIP exige numeración correlativa estricta por (sale_point, invoice_type). Sin saltos no explicados, sin repeticiones, sin reasignaciones.

En sistema multi-cajero concurrente, dos ventas simultáneas que piden el mismo número de factura es race condition garantizada si no se maneja con cuidado.

## Decisión

**Reserva atómica de número vía `SELECT ... FOR UPDATE` en `invoice_sequences` dentro de transacción Drizzle con isolation level serializable.**

Flujo:

```typescript
await db.transaction(async (tx) => {
  const seq = await tx.query.invoiceSequences.findFirst({
    where: ...,
    for: 'update'
  });
  
  const nextNumber = seq.last_number + 1;
  const cae = await afipClient.requestCAE(nextNumber, ...);
  
  if (cae.success) {
    await tx.update(invoiceSequences).set({ last_number: nextNumber });
    await tx.insert(afipInvoices).values({...});
  } else {
    // Número quemado, NUNCA reutilizar
    await tx.insert(afipInvoices).values({ ..., status: 'burned' });
    await tx.update(invoiceSequences).set({ last_number: nextNumber });
  }
}, { isolationLevel: 'serializable' });
```

Números quemados NUNCA se reutilizan. Si una venta falla, el número queda consumido. No hay hueco porque el serializable garantiza secuencialidad.

**Acompañado por ADR-0011** (retry serializable con backoff) para manejar contención bajo carga.

## Alternativas rechazadas

- **AUTO_INCREMENT/serial:** rechazado. PostgreSQL sequences pueden tener huecos por rollback de transacción.
- **Lock optimista con retry:** rechazado. Demasiada complejidad para garantizar correlativa estricta.
- **Generación pre-ventiva de números:** rechazado. Genera lote de números reservados que pueden vencer por timing.

## Consecuencias

**Positivas:**
- Numeración correlativa estricta garantizada.
- Compatible con FECompUltimoAutorizado de AFIP para reconciliación.
- Simple de implementar y testear.

**Negativas:**
- Lock pesimista limita concurrencia en `invoice_sequences` (1 venta a la vez por (sale_point, invoice_type)).
- Con > 50 ventas/segundo por sale_point, puede ser bottleneck.

**Riesgos a monitorear:**
- Contention en sale_points con alto volumen. Mitigación Fase 3+: múltiples sale_points por sucursal para paralelizar.

## Triggers de re-evaluación

- p99 de creación de venta con factura > 5s sostenido.
- Errores 40001 / 40P01 con tasa exhausted > 1%.
