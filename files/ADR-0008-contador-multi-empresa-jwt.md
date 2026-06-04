# ADR-0008 — Contador con acceso multi-empresa vía JWT

**Fecha:** 2026-05-17
**Estado:** Aprobado

## Contexto

El rol `accountant` necesita acceder a múltiples empresas (sus clientes) sin compartir credenciales con cada comerciante.

Modelos posibles:
- **Una cuenta por empresa:** contador tiene 10 logins distintos.
- **Una cuenta con switch de empresa:** contador tiene 1 login y elige empresa activa.
- **Una cuenta con vista consolidada:** contador ve todas sus empresas en un dashboard único.

## Decisión

**Una cuenta del contador con múltiples empresas autorizadas. JWT incluye claim `authorized_companies` (array de UUIDs) + `company_id` activo (la empresa seleccionada en sesión).**

Schema:

```sql
CREATE TABLE accountant_companies (
  id uuid PRIMARY KEY,
  accountant_id uuid NOT NULL REFERENCES profiles(id),
  company_id uuid NOT NULL REFERENCES companies(id),
  invited_by uuid REFERENCES profiles(id),
  invited_at timestamptz DEFAULT now(),
  revoked_at timestamptz,
  UNIQUE(accountant_id, company_id)
);
```

RLS expandido con EXISTS (sintaxis robusta corregida en Sesión 3.5.2):

```sql
CREATE POLICY accountant_multi_tenant ON sales
  USING (
    company_id = (auth.jwt() ->> 'company_id')::uuid
    OR (
      (auth.jwt() ->> 'rol') = 'accountant'
      AND EXISTS (
        SELECT 1
        FROM jsonb_array_elements_text(auth.jwt() -> 'authorized_companies') AS ac(company_id_text)
        WHERE ac.company_id_text = company_id::text
      )
    )
  );
```

## Alternativas rechazadas

- **Cuentas separadas por empresa:** rechazado. Pésima UX para contador, requiere logout/login constante.
- **Vista consolidada sin switch:** rechazado. Operaciones (exports, reportes) son por empresa, no consolidadas.

## Consecuencias

**Positivas:**
- UX excelente para contador.
- Aislamiento por sesión activa.
- Audit log claro de qué empresa estaba viendo en cada acción.

**Negativas:**
- JWT crece con cantidad de empresas autorizadas. Limit ~50 empresas por contador antes de exceder 4KB de header.
- RLS más complejo con condición OR.

**Riesgos a monitorear:**
- Contador con > 50 empresas. Mitigación: migrar de claim array a lookup en DB cuando se acerque el límite.

## Triggers de re-evaluación

- Contadores con > 30 empresas activos.
- p95 de queries con RLS de contador > 200ms.
