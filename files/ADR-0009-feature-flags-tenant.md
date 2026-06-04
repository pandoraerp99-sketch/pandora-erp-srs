# ADR-0009 — Feature flags por tenant desde Fase 0

**Fecha:** 2026-05-17
**Estado:** Aprobado

## Contexto

Necesitamos activar/desactivar features por tenant para:
- Rollout gradual de AFIP (no todos los tenants al mismo tiempo).
- Rollout de MercadoPago QR a clientes piloto antes de general.
- Activar módulo contador para algunos tenants.
- Activar stock negativo solo en tenants que lo pidieron.

## Decisión

**Tabla `tenant_features` con flags por tenant en JSONB desde Fase 0.** Sin servicio externo (LaunchDarkly, Unleash) hasta que la complejidad lo justifique.

Schema:

```sql
CREATE TABLE tenant_features (
  company_id uuid PRIMARY KEY REFERENCES companies(id),
  features jsonb NOT NULL DEFAULT '{}',
  -- Estructura: 
  -- {
  --   "afip_enabled": true,
  --   "mp_qr_enabled": false,
  --   "offline_enabled": false,
  --   "accountant_module_enabled": true,
  --   "negative_stock_allowed": false,
  --   ...
  -- }
  updated_at timestamptz DEFAULT now()
);
```

Helper en TS:

```typescript
async function hasFeature(companyId: string, feature: string): Promise<boolean> {
  const tf = await db.query.tenantFeatures.findFirst({
    where: eq(tenantFeatures.companyId, companyId)
  });
  return tf?.features?.[feature] ?? false;
}
```

## Alternativas rechazadas

- **LaunchDarkly / Unleash:** rechazado. Costo extra ($50+/mes) para casos que la tabla resuelve. Migrar cuando: (a) > 50 features activos, (b) necesitás targeting complejo (% rollout, A/B tests).
- **Configuración hardcoded por tenant en código:** rechazado. Requiere deploy por cambio.

## Consecuencias

**Positivas:**
- Rollout gradual de features sin código nuevo.
- Rollback instantáneo (cambiar flag).
- Audit log de cambio de flags.

**Negativas:**
- Cache en memoria si se consulta frecuentemente (mitigar con stale-while-revalidate).
- Sin targeting avanzado (sin %, sin A/B nativo).

## Triggers de re-evaluación

- Más de 50 features activos simultáneamente.
- Necesidad de A/B testing con tracking de cohorts.
- Necesidad de targeting por geografía, plan, fase de cliente.
