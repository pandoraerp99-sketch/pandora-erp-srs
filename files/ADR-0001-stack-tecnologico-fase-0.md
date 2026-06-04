# ADR-0001 — Stack tecnológico Fase 0

**Fecha:** 2026-05-17
**Estado:** Aprobado
**Reemplaza:** —
**Reemplazado por:** —

## Contexto

Necesitamos elegir stack tecnológico para Fase 0. El equipo es de 1-2 personas. La meta es 5 clientes pagando en 14-16 semanas. El producto es POS+ERP fiscal para Argentina con AFIP integrado.

Restricciones:
- Equipo chico, sin SRE dedicado.
- Bootstrap, sin inversores.
- Necesita facturación AFIP funcional desde día 1.
- Necesita multi-tenant seguro desde día 1.

Alternativas evaluadas:
- **Next.js monolito + Supabase:** simple, rápido, managed.
- **Go microservicios + Kafka + K8s:** propuesta del Deep Research Report, arquitectura "Serie A".
- **Rails monolito + PostgreSQL:** clásico, productivo.
- **Django monolito + PostgreSQL:** clásico, productivo.

## Decisión

Adoptar Next.js 14 App Router + TypeScript strict + Supabase (PostgreSQL 16 managed + Auth + Storage) + Drizzle ORM como stack canónico para Fase 0.

Deploy: Vercel para app, Railway para worker (Fase 1+), Upstash Redis para BullMQ (Fase 1+).

## Alternativas rechazadas

- **Go microservicios + Kafka:** rechazado. Overhead operativo insostenible para 1-2 devs. Kafka requiere expertise SRE. Kafka es herramienta de escala, no de validación de producto.
- **Rails/Django:** rechazado. Ecosistema TypeScript+Next.js permite full-stack con un solo lenguaje, mejor para equipo chico.
- **Schema-per-tenant:** rechazado. Notion/Linear/Stripe operan con shared schema + RLS para miles de tenants.

## Consecuencias

**Positivas:**
- Velocidad de desarrollo alta.
- Type safety end-to-end.
- Supabase gestiona auth, DB, storage sin trabajo extra.
- Vercel deploy en 30 segundos.
- Comunidad grande, fácil contratar devs adicionales.

**Negativas:**
- Vendor lock-in a Supabase. Mitigación: plan de migración documentado, backups semanales a S3 propio.
- Vercel tiene límites en plan Hobby (logs 7 días, function duration). Plan Pro $20/mes cuando duela.
- Drizzle es relativamente nuevo (1-2 años madurez). Mitigación: comunidad activa, alternativa migración a Prisma si necesario.

**Riesgos a monitorear:**
- Supabase pricing escalando peor que ingresos (revisar mensualmente).
- Cold starts en Vercel para endpoints poco usados.
- Connection pool de Supavisor saturándose en pico de operación.

## Triggers de re-evaluación

- Más de 500 clientes activos con problemas de performance no resueltos.
- Supabase costos > 15% de ingresos.
- Equipo crece > 5 ingenieros (justifica complejidad mayor).
