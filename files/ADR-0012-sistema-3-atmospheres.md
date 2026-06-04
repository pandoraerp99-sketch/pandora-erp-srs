# ADR-0012 — Sistema de 3 atmospheres

**Fecha:** 2026-05-17
**Estado:** Aprobado

## Contexto

Pandora tiene tres tipos de superficies con requisitos contradictorios:
- Dashboards e onboarding necesitan diferenciación visual premium para conversión.
- POS y workflow necesitan velocidad operativa y baja fatiga visual (uso 8-12h).
- Pantallas fiscales/destructivas necesitan claridad máxima y cero distracción.

Aplicar una sola intensidad visual a todas las pantallas falla en dos direcciones: si es muy premium, el POS se vuelve lento e incómodo; si es muy plana, el dashboard no diferencia el producto.

Alternativas evaluadas:
- **Una sola estética para todo:** simple pero falla en operación real.
- **Estética por dominio (sales, stock, fiscal):** se acopla a estructura del producto, difícil de mantener.
- **3 atmospheres por contexto operativo:** abstracción ortogonal a dominios, escala mejor.
- **5+ atmospheres con matices:** complejidad sin ganancia clara.

## Decisión

Adoptar tres atmospheres: **Atmosphere** (premium), **Operational** (workflow), **Critical** (fiscal/destructivo).

Cada pantalla se asigna a una atmosphere según su contexto operativo, no según su dominio funcional. Las atmospheres se implementan como CSS variables que se activan vía `[data-atmosphere="..."]` en un Provider de React.

Las tres atmospheres comparten la misma identidad (Dawn Sky + glass + motion philosophy) pero con intensidades calibradas:

| Atmosphere | Glass blur | Tilt | Sheen | Parallax | Counter animation | Density |
|---|---|---|---|---|---|---|
| Atmosphere | 28px | ±4° | ✓ | ✓ | ✓ | comfortable |
| Operational | 12px | — | — | — | — | tight |
| Critical | 0px | — | — | — | — | comfortable+ |

## Alternativas rechazadas

- **Una sola estética:** rechazado. POS con tilt/parallax/sheen es invendible para uso real 8-12h.
- **Estética por dominio:** rechazado. Hay pantallas críticas en todos los dominios (anulación de venta, ajuste de stock, eliminación de cliente).
- **5+ atmospheres:** rechazado. Más de tres niveles genera inconsistencia operativa y decisiones ambiguas.

## Consecuencias

**Positivas:**
- Identidad coherente con flexibilidad operativa.
- Cada pantalla tiene atmosphere "correcta" sin ambigüedad.
- Performance optimizada por contexto.
- Reduced motion y degradación por hardware son triviales de implementar.

**Negativas:**
- Tres sets de CSS variables a mantener.
- Devs deben elegir atmosphere conscientemente al crear pantalla nueva.
- Testing visual requiere cubrir las 3 atmospheres.

**Riesgos:**
- Drift: alguien aplica atmosphere "premium" a pantalla operativa porque "se ve mejor". Mitigación: lint rule que valida atmosphere por ruta.
- Inconsistencia: aparece una atmosphere extra fuera de las 3. Mitigación: TypeScript type strict.

## Triggers de re-evaluación

- Aparece pantalla que no encaja en ninguna de las 3 atmospheres y no se puede forzar.
- Más de 10 atmosphere overrides en el código (señal de que las 3 no alcanzan).
- Performance de operational degrada por la abstracción.
