# Proposals — Pandora ERP

**Fecha:** 2026-06-03
**Propósito:** carpeta para **proposals de cambios documentales** que NO se aplican inmediatamente porque dependen de implementación de código futura.

> Diferencia con ADRs: un ADR documenta una decisión arquitectónica tomada. Un proposal documenta un cambio a docs gobernantes (EVENT-TAXONOMY, AUTHORITY-MAP, etc.) que **se aplicará atómicamente con el PR de implementación correspondiente**.

---

## Por qué este patrón

Cuando un ADR introduce nuevos eventos, métricas, autoridades o capacidades, hay 2 opciones:

| Opción | Pros | Cons |
|---|---|---|
| **A) Actualizar docs gobernantes inmediato** | Coherencia visible en docs | Doc dice cosas que el código aún no implementa → claim falso (anti-pattern test theatre N-29) |
| **B) Documentar el cambio como proposal + aplicar atómico con el PR de Sprint** | Doc gobernante refleja realidad implementada. Proposal queda como spec del próximo update. | Doc gobernante puede quedar levemente desactualizado vs ADR (mitigado por link cruzado) |

Pandora elige **B** cuando hay regla de "catálogo cerrado" como EVENT-TAXONOMY.md regla J1 ("no agregar event names on the fly"). El proposal es el PR review pre-implementación.

---

## Proposals abiertos

| Proposal | Disparador | Estado | Aplicación esperada |
|---|---|---|---|
| [event-taxonomy-update-adr-0025.md](event-taxonomy-update-adr-0025.md) | ADR-0025 (Catálogos Regulatorios Runtime) + mini-auditoría coherencia 2026-06-03 | Aprobado, sin aplicar | Sprint 6 PR que implemente `src/lib/fiscal/catalogs/` |

---

## Ciclo de vida de un proposal

```
1. ADR aprobado introduce cambio que afecta doc gobernante con catálogo cerrado
   ↓
2. Crear proposal en proposals/ con diff propuesto + checklist de aplicación
   ↓
3. Owner review (opcional, depende de severidad)
   ↓
4. Estado = APROBADO, SIN APLICAR
   ↓
5. Sprint que implementa el código → PR incluye:
   - Cambios de código
   - Cambios atómicos al doc gobernante según proposal
   - Update DECISION-LEDGER
   - Mover proposal a proposals/applied/ con fecha de aplicación
   ↓
6. Proposal queda en applied/ como historia de cómo se decidió
```

---

## Estructura estándar de un proposal

```markdown
# Proposal — {nombre breve}

**Fecha:** YYYY-MM-DD
**Estado:** PROPOSAL (sin aplicar)
**Disparador:** {ADR / hallazgo / decisión que lo origina}

## Por qué este doc existe (y NO se aplicó directo)
Justificar por qué proposal vs aplicación inmediata.

## Cambios propuestos
Diff técnico con justificación.

## Conteo post-aplicación
Métricas antes/después.

## Checklist de aplicación ({Sprint X} PR)
Acciones concretas a ejecutar cuando se aplique.

## Relación con docs
Cross-references.
```

---

## Anti-patterns evitados

1. **Doc gobernante con catálogo que el código no respeta** — proposal pendiente preserva regla J1.
2. **ADR que cita eventos que no existen en catálogo** — ADR-0025 fue corregido inline post-mini-auditoría para evitar este caso.
3. **PR de Sprint con cambios doc dispersos** — proposal pre-acordado permite aplicación atómica + review focal.

---

**Cross-references:**
- [EVENT-TAXONOMY.md](../EVENT-TAXONOMY.md) regla J1
- [DECISION-LEDGER.md](../DECISION-LEDGER.md) — donde se registra el cambio cuando se aplica
- [files/](../files/) — ADRs que originan proposals
