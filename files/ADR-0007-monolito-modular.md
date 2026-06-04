# ADR-0007 — Monolito modular, no microservicios

**Fecha:** 2026-05-17
**Estado:** Aprobado

## Contexto

Arquitectura de aplicación: monolito modular vs microservicios. Pros y contras tradicionales aplicables.

El Deep Research Report propuso microservicios con Kafka, K8s, Go. Análisis de viabilidad para equipo de 1-2 personas: insostenible.

## Decisión

**Monolito modular en Fase 0-3.** Extracción a microservicios solo cuando: (a) equipo > 5 ingenieros, (b) dolor medible por acoplamiento o despliegue, (c) métricas justifican el costo operativo.

Estructura modular dentro del monolito:
- `src/lib/services/` — Application Services por dominio.
- `src/lib/domain/` — Lógica pura testeable.
- `src/lib/integrations/` — Clients de APIs externas aisladas.
- Cada módulo tiene interface explícita y no toca datos de otro directamente.

## Alternativas rechazadas

- **Microservicios desde día 1:** rechazado. Overhead operativo (deploy, debug, observabilidad distribuida) insostenible para 1-2 devs.
- **Monolito desordenado:** rechazado. Sin disciplina modular, refactor futuro a microservicios imposible.

## Consecuencias

**Positivas:**
- Deploy único, sin orquestación.
- Debugging local trivial.
- Transacciones ACID simples.
- Refactor entre módulos sin breaking changes externos.

**Negativas:**
- Scaling vertical solamente hasta cierto punto.
- Si un módulo tiene bug, afecta todo el deploy.

**Riesgos a monitorear:**
- Disciplina modular: revisión de PRs verifica que módulos no se acoplen.

## Triggers de re-evaluación

- Equipo > 5 ingenieros.
- Deploy tiempo > 15 min sostenido.
- Conflictos de merge frecuentes entre dominios.
- Necesidad de scaling independiente de un módulo (ej: AFIP recibe 10x más carga que el resto).
