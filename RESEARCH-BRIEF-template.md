# Research Brief — `<módulo / feature>`

**Fecha:** YYYY-MM-DD
**Estado:** 🔬 investigando · 🧩 diseño · ✅ aprobado · 🚧 en implementación · 🏁 cerrado
**Autor:** <sesión / persona>
**Relacionado:** <ADR-NNNN · CAPABILITY-MAP C-XXX · NON-GOALS N-XXX · backlog-validaciones ítem>

> Metodología obligatoria antes de programar (ver memoria `feedback-investigar-referencias-siempre`).
> Proporcional: módulo significativo = Brief completo. Tarea chica = pasada liviana, sin este doc.

---

## 1. Objetivo del módulo
Una o dos frases: qué es y qué logra.

## 2. Problema de negocio
- **Problema:** ¿qué dolor real resuelve?
- **Usuarios:** ¿quién lo necesita? (dueño / cajero / contador / cliente)
- **Impacto:** ¿cuánto valor agrega? (alto / medio / bajo + por qué)
- **Complejidad:** ¿vale la pena vs el esfuerzo?

## 3. Investigación (fuentes)
Recorrer las que apliquen — NO solo la documentación oficial. Citar con URL + fecha.

| Categoría | Qué se miró | Hallazgo clave | Fuente (URL) |
|---|---|---|---|
| Documentación oficial | | | |
| Papers / estudios | | | |
| Competidores | ¿cómo lo hacen? ¿qué les falta? | | |
| GitHub / discusiones | | | |
| Foros / comunidad / usuarios | ¿qué se quejan? | | |
| UX / casos reales | | | |
| Cross-industry (ERP JP/DE, POS US, retail) | | | |
| Errores comunes | qué evitar | | |
| Tendencias | hacia dónde va | | |

## 4. Síntesis — ¿qué incorporamos?
| Fuente | Idea | ¿Vale la pena? | Nota |
|---|---|---|---|
| | | ✅ / ❌ | |

## 5. Estado del arte
La mejor solución conocida hoy (el listón a igualar o superar).

## 6. Ideas innovadoras — qué hacemos MEJOR
Lo que diferencia a Pandora. Invariantes propuestas (ej: "verify, don't trust", fail-safe, "el comerciante primero").

## 7. Qué NO vamos a implementar
Ideas investigadas y descartadas — con razón + trigger para reabrir. Promover a `NON-GOALS.md` (rechazo permanente) o `backlog-validaciones.md` (diferido con trigger) según corresponda.

| Idea descartada | Por qué | Trigger para revisar |
|---|---|---|
| | | |

## 8. Decisión de diseño
La decisión tomada + su justificación (basada en evidencia de arriba, no intuición). Si tiene impacto arquitectónico → abrir ADR y linkearlo.

## 9. Plan de implementación
- **MVP:** lo mínimo valioso.
- **Mejoras futuras:** F1+/F2+ con trigger.
- **Riesgos + edge cases:** qué puede salir mal.
- **Tests (TDD, primero):** lista de tests obligatorios.

## 10. Revisión
Post-implementación: ¿se puede hacer aún mejor? ¿qué aprendimos?
