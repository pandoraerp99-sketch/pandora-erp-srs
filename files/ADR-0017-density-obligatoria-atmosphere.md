# ADR-0017 — Density obligatoria por atmosphere

**Fecha:** 2026-05-17
**Estado:** Aprobado

## Contexto

Aplicar una sola densidad a todas las pantallas falla en dos direcciones:
- **Densidad alta uniforme:** pantallas críticas como facturación se vuelven incómodas.
- **Densidad baja uniforme:** POS pierde productividad (menos productos visibles, más scroll).

Densidad correcta depende del contexto operativo, no del componente.

## Decisión

Density se asigna automáticamente por atmosphere:

| Atmosphere | Density | Row | Input | Font | Padding |
|---|---|---|---|---|---|
| Atmosphere | comfortable | 44px | 40px | 14px | 22px |
| Operational | tight | 32px | 36px | 13px | 12px |
| Critical | comfortable+ | 56px | 48px | 15px | 24px |

Tabletas táctiles fuerzan mínimo `comfortable` (target táctil ≥44px) regardless de atmosphere — accesibilidad mata densidad.

Density no es configurable por usuario individual. Es decisión arquitectónica del system, no preferencia.

## Alternativas rechazadas

- **Densidad configurable por usuario:** rechazado. Decisión arquitectónica, no preferencia.
- **Densidad uniforme:** rechazado. Falla en POS o en fiscal.
- **Densidad por componente:** rechazado. Inconsistencia entre módulos.

## Consecuencias

**Positivas:**
- POS denso y productivo.
- Fiscal claro y legible.
- Dashboard balanceado.
- Accesibilidad táctil respetada automáticamente.

**Negativas:**
- Tres sets de density tokens que mantener.

**Riesgos:**
- Componente compartido entre atmospheres debe responder a density. Mitigación: usar CSS vars, no valores hardcoded.

## Triggers de re-evaluación

- Quejas de accesibilidad específicas en operational (cajeros mayores con dificultad de lectura).
- Solicitud de "modo accesible" como toggle global.
