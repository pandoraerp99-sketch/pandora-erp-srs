# ADR-0013 — Glass system con 3 niveles + degradación automática

**Fecha:** 2026-05-17
**Estado:** Aprobado

## Contexto

`backdrop-filter: blur()` es costoso en GPU. En hardware target (tablets argentinas $200-400, 4GB RAM, 4 cores) puede degradar FPS notablemente.

Aplicar blur uniforme tiene tres problemas:
- Performance en hardware bajo.
- Pérdida de legibilidad en pantallas críticas (datos fiscales detrás de blur reducen claridad).
- Consumo de batería en tablets.

## Decisión

Tres niveles de glass según atmosphere:

| Atmosphere | Blur | Saturate | BG opacity |
|---|---|---|---|
| Atmosphere | 28px | 140% | 0.58 |
| Operational | 12px | 110% | 0.82 |
| Critical | 0px | 100% | 0.96 |

Degradación automática vía `useCapabilities()`:
- Si hardware no soporta glass (cores < 2 o reducedMotion): degradar Atmosphere → Operational automáticamente.
- Si dispositivo es mobile/tablet: Atmosphere efectivo se mantiene visualmente pero con blur reducido (12px) para preservar performance.

```typescript
export function detectCapabilities(): Capabilities {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const cores = navigator.hardwareConcurrency ?? 4;
  const memory = (navigator as any).deviceMemory ?? 4;
  const isMobile = /Mobi|Android.*Mobile|iPhone/i.test(navigator.userAgent);
  const isTablet = /iPad|Android(?!.*Mobile)/i.test(navigator.userAgent);
  
  const highPerf = !reducedMotion && cores >= 4 && memory >= 4 && !isMobile;
  
  return {
    highPerf,
    canDoGlass: !reducedMotion && cores >= 2,
    canDoTilt: highPerf && !isTablet,
    canDoParallax: highPerf && !isMobile && !isTablet,
  };
}
```

## Alternativas rechazadas

- **Glass uniforme 28px:** rechazado. Performance inaceptable en tablets baratas.
- **Sin glass (flat design):** rechazado. Pierde identidad de marca.
- **Glass solo en cards, no en sidebars/topbars:** rechazado. Inconsistencia visual.

## Consecuencias

**Positivas:**
- Performance preservada en hardware bajo.
- Identidad visual mantenida en cualquier dispositivo.
- Critical surfaces son más legibles (sin blur).

**Negativas:**
- Tres definiciones de glass que mantener sincronizadas.
- Devs deben usar `useAtmosphere()` para acceder al glass correcto.

**Riesgos:**
- Hardcoded blur values en componentes (lint rule lo previene).

## Triggers de re-evaluación

- Quejas de performance en hardware específico (tablet model X).
- Mayoría de usuarios (>50%) en hardware que dispara degradación.
