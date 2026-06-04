# ADR-0018 — Stack bump mayo 2026 (Next 14→16, Tailwind 3→4)

**Fecha:** 2026-05-26
**Estado:** Aprobado
**Reemplaza versiones de:** ADR-0001 (stack F0 — actualizaciones de versión, no reemplazo conceptual)
**Relacionado con:** ADR-0017 (density), ADR-0016 (Dawn Sky), ADR-0021 (money client)

## Contexto

ADR-0001 (mayo 2026) fijó stack con Next.js 14 + Tailwind 3 como versiones canónicas. En las semanas posteriores se realizaron upgrades a versiones más recientes sin documento formal:

- **Next.js 14 → 16.2.6** — RSC + Server Actions estables, Turbopack default, mejor soporte para edge cases de streaming.
- **Tailwind 3 → 4.3** — `@theme inline` nativo + OKLCH tokens sin plugin (requerido por ADR-0017 / Dawn Sky).
- **React 18 → 19.2.4** — Concurrent features estables, mejoras de Server Components.
- **TypeScript 5.x → 5.9 strict** — sin cambios conceptuales, solo bump.

Este ADR formaliza el cambio de versión retroactivamente para mantener el ledger limpio.

## Decisión

Stack canónico actualizado (mayo 2026):

| Capa | Versión | Razón del bump |
|---|---|---|
| Next.js | 16.2.6 | RSC stable + Turbopack default reduce build time CI |
| React | 19.2.4 | Concurrent features estables |
| TypeScript | 5.9 strict | Sin cambios — bump natural |
| Tailwind CSS | 4.3 | `@theme inline` + OKLCH nativo (requerido por ADR-0017) |
| shadcn/ui | latest | Preset Radix + Nova (Lucide icons + Geist font) |
| Drizzle ORM | 0.45.2 | Migration support + serializable transactions estables |
| postgres-js | 3.4.9 | Driver oficial Supabase + Drizzle |
| @supabase/ssr | 0.10.3 | Auth helpers Next.js App Router |
| jose | 6.2.3 | JWT verification para `company_id` extraction |
| zod | 4.4.3 | Schemas + runtime validation |
| decimal.js | 10.6.0 | Money con precisión arbitraria (ADR-0005 + ADR-0021) |
| pino + pino-pretty | latest | Logging estructurado |
| Vitest | latest | Unit + integration |
| fast-check | latest | Property-based testing (edge cases fiscales) |

## Por qué Tailwind 4

ADR-0017 (density obligatoria por atmosphere) y ADR-0016 (Dawn Sky identidad permanente) requieren tokens OKLCH. Tailwind 3 lo soporta solo vía plugin externo (`@csstools/postcss-oklab-function`). Tailwind 4 lo soporta nativamente via `@theme inline { ... }`. Tener que mantener plugin custom es deuda técnica innecesaria.

## Por qué Next.js 16

- App Router con RSC + Server Actions necesarios para arquitectura ADR-0013 (no API routes para mutations internas)
- Turbopack reduce build time CI de 60s a 8s en proyecto base
- Streaming de Server Components estable (relevante para SRS sección 14 — POS performance)
- Compatibilidad con React 19 que ya está en stack

## Alternativas rechazadas

- **Mantener Next.js 14 hasta F1:** rechazado. Cambio retrasa cuando solo agrega valor (Turbopack + Server Actions estables).
- **Saltar a Next.js 15 intermedio:** rechazado. Versión transición sin valor incremental sobre 16.
- **Esperar a Tailwind 5:** rechazado. Roadmap Tailwind no muestra versión inminente y 4 cumple requisitos OKLCH.

## Consecuencias

**Positivas:**
- OKLCH nativo elimina plugin externo de Tailwind.
- Turbopack reduce CI time.
- Server Actions estables (ADR-0013 deja de ser experimental).

**Negativas:**
- Devs deben familiarizarse con sintaxis `@theme inline` de Tailwind 4 (no mayor que el cambio de v2→v3 en su momento).
- Algunos packages del ecosistema todavía no migraron oficialmente a React 19 (verificar antes de cada `pnpm add`).

**Riesgos a monitorear:**
- Breaking changes en Next.js 17 — probable migración futura, no urgente.
- Performance regression no detectada en RSC streaming — verificar con tests de Lighthouse al primer deploy productivo.

## Migración (ya aplicada en `~/workspace/pandora-erp`)

La migración ya se aplicó en el repo de desarrollo. Este ADR la documenta retroactivamente.

```bash
# Para nuevos contributors / replicar el setup:
pnpm install
pnpm run build  # debe pasar sin warnings
pnpm run typecheck  # strict
```

## Triggers de re-evaluación

- Next.js 17 sale con feature requerida (ej: nuevo router que justifique migrar).
- React 20 sale con cambio breaking — evaluar timing.
- Tailwind 5 sale con cambio breaking de tokens.
- Sentry o package crítico marca incompatibilidad con versiones actuales.
