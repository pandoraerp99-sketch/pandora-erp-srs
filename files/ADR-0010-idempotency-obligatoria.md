# ADR-0010 — Idempotencia obligatoria en mutaciones públicas

**Fecha:** 2026-05-17
**Estado:** Aprobado

## Contexto

En POS, una venta puede dispararse dos veces por:
- Doble click del cajero impaciente.
- Reintento por timeout de red.
- Bug del frontend que reenvía request.

Sin idempotencia, esto genera duplicados: doble venta, doble cobro, doble factura.

## Decisión

**Toda mutación crítica requiere header `Idempotency-Key: <uuid>` generado por el cliente. Tabla `idempotency_log` append-only con UNIQUE en la key. Retorna resultado cacheado en reintento.**

Schema:

```sql
CREATE TABLE idempotency_log (
  id bigserial PRIMARY KEY,
  company_id uuid NOT NULL,
  idempotency_key uuid NOT NULL,
  operation text NOT NULL,
  request_hash text NOT NULL,
  result jsonb NOT NULL,
  status int NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(company_id, idempotency_key)
);
```

Flujo:

1. Cliente genera UUID y lo envía como header.
2. Server intenta INSERT en `idempotency_log`.
3. Si succeed: procesa operación, guarda resultado.
4. Si fail (duplicate key): devuelve resultado anterior.

**Operaciones que requieren Idempotency-Key:**
- Crear venta.
- Procesar pago.
- Anular venta.
- Cerrar turno.
- Crear factura.
- Cualquier mutación facturable o con efecto en stock/caja/AFIP.

**Retención:** 90 días hot, después archivado a S3 + índice consultable (Sesión 3.5).

**Política de borde de TTL:**
- < 6 meses: idempotente garantizada.
- 6-12 meses: best-effort (lookup en archive).
- > 12 meses: no garantía. Cliente debe regenerar key.

## Alternativas rechazadas

- **Idempotencia opcional:** rechazado. Si no es obligatoria, devs olvidan, bugs en producción.
- **Idempotency generada por server:** rechazado. El cliente sabe cuándo retiene la operación; el server no.

## Consecuencias

**Positivas:**
- Cero duplicados garantizados.
- Recovery de timeouts de red sin pánico.
- Audit log claro de reintentos.

**Negativas:**
- Cliente debe generar UUID y persistirlo localmente hasta confirmar éxito.
- Validación extra en cada mutación crítica (sub-milisegundo).

**Riesgos a monitorear:**
- `idempotency_log` crece linealmente. Mitigación: cleanup mensual + archive a S3.
