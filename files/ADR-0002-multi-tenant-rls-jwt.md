# ADR-0002 — Multi-tenant con RLS + auth.jwt()

**Fecha:** 2026-05-17
**Estado:** Aprobado
**Reemplaza:** —

## Contexto

Necesitamos modelo de aislamiento multi-tenant. Cada cliente (empresa) debe tener sus datos aislados de los demás. Un usuario de empresa A jamás debe ver datos de empresa B.

Alternativas evaluadas:
- **Shared DB, shared schema, RLS:** todos los tenants en mismas tablas con `company_id` y Row Level Security.
- **Shared DB, schema-per-tenant:** cada tenant tiene su schema en la misma DB.
- **Database-per-tenant:** cada tenant tiene su propia DB.
- **BFF con service role:** bypass RLS, validar todo en código TS.

## Decisión

Adoptar Shared DB + Shared schema + RLS con policy basada en `auth.jwt()`.

Policy canónica:

```sql
CREATE POLICY tenant_isolation ON sales
  USING (company_id = (auth.jwt() ->> 'company_id')::uuid);
```

Defensa en profundidad: validación adicional en Application Service en TypeScript como primera barrera, RLS como red de seguridad.

## Alternativas rechazadas

- **`current_setting('app.company_id')`:** rechazado. No sobrevive a connection pooling de Supabase Supavisor. Bugs intermitentes garantizados.
- **Schema-per-tenant:** rechazado. Overhead de migraciones, backups, queries cross-tenant. Notion/Linear/Stripe demuestran que shared+RLS escala a miles de tenants.
- **DB-per-tenant:** rechazado. Insostenible operativamente para 1-2 devs.
- **BFF puro sin RLS:** rechazado. Pierde defensa en profundidad. Un bug en el BFF leak total. Mejor combinar.

## Consecuencias

**Positivas:**
- Aislamiento garantizado en dos capas (app + DB).
- Migraciones únicas para todos los tenants.
- Backups simples.
- Queries cross-tenant para soporte/admin son posibles con service role.

**Negativas:**
- RLS tiene overhead de CPU (sub-milisegundo, pero medible a escala).
- JWT debe contener `company_id` siempre — requiere lógica en Supabase Auth.
- Tests cross-tenant obligatorios en CI desde primer commit.

**Riesgos a monitorear:**
- Si el contador tiene > 50 empresas, el JWT puede crecer > 4KB (límite de cookie). Mitigación: usar referencia + lookup en DB si excede.
- RLS overhead a > 2000 tenants concurrentes puede ser cuello de botella. Mitigación: planear migración a BFF puro como segunda fase si p99 > 200ms.

## Triggers de re-evaluación

- p99 latency > 200ms con queries que tocan RLS.
- Más de 2000 tenants activos simultáneos.
- Cross-tenant leak detectado en producción.
