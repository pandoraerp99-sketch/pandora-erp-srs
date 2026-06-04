# ADR-0014 — Charts en SVG puro sin librería externa

**Fecha:** 2026-05-17
**Estado:** Aprobado

## Contexto

Para visualización de datos (revenue, sales, productivity) hay opciones:
- Librerías: Recharts, Chart.js, Tremor, Nivo, Visx.
- Custom SVG con D3 utilities.
- SVG puro escrito a mano.

El prototipo ya implementa 4 charts en SVG puro con animaciones custom. Funciona, es performante, y se ve premium.

## Decisión

**Mantener charts en SVG puro escritos a mano.** Los 4 charts existentes (SmoothLine, RoundedBars, DualLineChart, AnimatedDonut) se migran a TypeScript y se mantienen como primitives propias.

Para charts más complejos (Fase 2+: heatmaps, sankey, advanced):
- Primero intentar SVG puro.
- Si justifica, usar Visx (D3 con React) como fallback.
- Recharts solo como último recurso (es pesado y customización limitada).

## Alternativas rechazadas

- **Recharts:** rechazado. Bundle ~120KB, customización limitada, no encaja con Dawn Sky.
- **Chart.js:** rechazado. Canvas-based, difícil de combinar con glass system.
- **Tremor:** rechazado. Componentes opinados que no respetan atmosphere.
- **Nivo:** rechazado. Bundle pesado, overkill para 4 chart types.
- **D3 puro:** rechazado. Curva de aprendizaje alta, no necesario para nuestros casos.

## Consecuencias

**Positivas:**
- Bundle mínimo (charts viven en TSX, no library).
- Animaciones perfectamente integradas con motion system.
- Performance óptima.
- Charts respetan atmosphere automáticamente.

**Negativas:**
- Chart types nuevos requieren implementación manual.
- Mantener primitives es trabajo de design system.

**Riesgos:**
- Solicitudes de chart types complejos en Fase 2+ (heatmap, treemap). Mitigación: agregar Visx solo cuando justifique.

## Triggers de re-evaluación

- Necesidad de más de 8 chart types distintos.
- Solicitud de funcionalidades complejas (zoom, brush, animated transitions complex).
