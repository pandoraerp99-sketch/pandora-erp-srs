# ADR-0015 — Motion presets nombrados con 4 easings restringidos

**Fecha:** 2026-05-17
**Estado:** Aprobado

## Contexto

Animaciones libres en componentes generan inconsistencia:
- Distintos componentes con distintas duraciones para acción similar.
- Easings improvisados que se sienten "raros".
- Imposible mantener coherencia visual.

## Decisión

Sistema de motion centralizado con:

**4 easings permitidos:**
- `--ease-default: cubic-bezier(.2, .7, .2, 1)` — default casi todo
- `--ease-nav: cubic-bezier(.4, 0, .2, 1)` — hover lifts, nav
- `--ease-pulse: ease-in-out` — typing, pulses
- `--ease-spin: linear` — avatar ring, spinners

**Durations nombradas:**
- `--motion-feedback: 80ms` — click immediate
- `--motion-fast: 180ms` — hover
- `--motion-medium: 240ms` — zone transitions
- `--motion-slow: 400ms` — modal entrance
- `--motion-deliberate: 600ms` — onboarding
- `--motion-rich: 900ms` — sheen sweep
- `--motion-chart: 1600ms` — chart entry

**Presets nombrados** para animaciones complejas (`fade-up`, `draw-line`, `grow-bar`, `reveal-area`, etc.).

Cualquier animación nueva DEBE entrar al motion system antes de usarse en componente.

**Reduced motion override** automático respeta `prefers-reduced-motion`.

## Alternativas rechazadas

- **Animación libre por componente:** rechazado. Genera caos.
- **Framer Motion como library principal:** rechazado. 50KB de bundle extra para casos simples. Permitido para casos complejos puntuales (gestures, drag).
- **Auto-animate:** rechazado. Mágico pero poco predecible.

## Consecuencias

**Positivas:**
- Coherencia visual garantizada.
- Reduced motion trivial (cambia los CSS vars).
- Performance predecible.

**Negativas:**
- Devs deben usar tokens, no animación libre.
- Animación custom requiere agregar al system primero.

## Triggers de re-evaluación

- Necesidad de gestures complejos (drag-and-drop avanzado).
- Necesidad de animaciones físicas (springs reales).
- Más de 20 motion presets nombrados (señal de complejidad excesiva).
