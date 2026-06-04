# ADR-0003 — Application Services en TypeScript, no plpgsql

**Fecha:** 2026-05-17
**Estado:** Aprobado

## Contexto

La lógica de negocio crítica (cálculo de IVA, reserva de número fiscal, transacción de venta, anulación) puede vivir en:

- TypeScript (Application Services con transacciones Drizzle).
- plpgsql (stored procedures, triggers, functions).
- Mezcla de ambos.

## Decisión

**Toda la lógica de negocio vive en TypeScript en `src/lib/services/`.**

plpgsql se usa **únicamente para:**
- Triggers de utilidad (updated_at automático).
- Constraints CHECK declarativos.
- Vistas materializadas para reportes (Fase 2+).

**Nunca para:**
- Cálculo de IVA.
- Reserva de número fiscal.
- Procesamiento de pagos.
- Cualquier lógica de dominio.

## Alternativas rechazadas

- **plpgsql para atomicidad:** rechazado. Drizzle transactions con `isolationLevel: 'serializable'` proveen la misma atomicidad sin las desventajas.
- **Mezcla pragmática:** rechazado. Genera dos fuentes de verdad para misma lógica, debugging infernal.

## Consecuencias

**Positivas:**
- Testing unitario con Vitest sin DB levantada.
- Debugging con stack traces legibles.
- Versionado en git con mismo rigor que el resto.
- Onboarding de devs nuevos sin requerir expertise plpgsql.
- Type safety end-to-end con Drizzle.

**Negativas:**
- Las transacciones cruzan capa app ↔ DB con latencia adicional (sub-milisegundo).
- Lock contention en transacciones serializables puede ser bottleneck a escala.

**Riesgos a monitorear:**
- Deadlocks en transacciones serializables. Mitigación: ADR-0011 (retry policy con backoff).
