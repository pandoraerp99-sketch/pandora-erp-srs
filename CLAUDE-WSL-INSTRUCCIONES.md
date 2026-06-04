# CLAUDE.md — Instrucciones de aplicación al repo WSL

**Fecha:** 2026-05-27
**Propósito:** copiar / adaptar [CLAUDE.md](CLAUDE.md) (versión maestra en SRS) al repo Pandora ERP en WSL: `~/workspace/pandora-erp/.claude/CLAUDE.md`.

---

## Contexto

La versión maestra del CLAUDE.md vive en `c:\Users\Pandora\Desktop\SRS\CLAUDE.md` porque ahí está toda la spec arquitectónica (ADRs, DECISION-LEDGER, AUTHORITY-MAP, trilogía spec, advisor doc, etc.). Pero el archivo donde Claude Code lo va a leer **automáticamente** al iniciar una sesión en el repo Pandora es `~/workspace/pandora-erp/.claude/CLAUDE.md`.

Las dos versiones NO deben ser idénticas. La de SRS es la fuente; la de WSL es una adaptación con paths relativos al repo + sin secciones que no aplican al código (auditorías externas históricas, history/, etc.).

---

## Estado actual en WSL

Según memoria ([pandora-erp-skeleton](../../../.claude/projects/c--Users-Pandora-Desktop-SRS/memory/pandora-erp-skeleton.md)) y ([pandora-erp-project-state](../../../.claude/projects/c--Users-Pandora-Desktop-SRS/memory/pandora-erp-project-state.md)):

- Path: `~/workspace/pandora-erp` (WSL2/Ubuntu/Node 22)
- **Sin avances desde 2026-05-21** (sólo Sprint Visual de 3 días — esqueleto UI)
- `.claude/CLAUDE.md` existente: **descripciones de ADRs NO matchean filenames físicos** (según `pandora-erp-project-state` línea 122). El filesystem real es la verdad.
- `.claude/rules/` existente: 5 rules originales (01-stack, 02-multi-tenant, 03-fiscal, 04-observability, 05-visual-system) probablemente desactualizadas vs ADR-0018 + ADR-0019 + ADR-0022.

---

## Plan de aplicación (al iniciar sesión en WSL)

### Paso 1 — Backup del CLAUDE.md viejo

```bash
cd ~/workspace/pandora-erp
mv .claude/CLAUDE.md .claude/CLAUDE.md.backup-pre-2026-05-27
```

Razón: lo viejo tiene info útil (paths físicos del repo, comandos npm/pnpm, etc.) que podría no estar en la versión SRS. Conservar como referencia.

### Paso 2 — Copiar el CLAUDE.md de SRS y adaptar

```bash
# Desde WSL, asumiendo que SRS está accesible desde /mnt/c/Users/Pandora/Desktop/SRS
cp /mnt/c/Users/Pandora/Desktop/SRS/CLAUDE.md ~/workspace/pandora-erp/.claude/CLAUDE.md
```

### Paso 3 — Adaptar paths (manual / con sed)

El CLAUDE.md de SRS asume que estás parado en `c:\Users\Pandora\Desktop\SRS\`. Los links relativos (DECISION-LEDGER.md, AUTHORITY-MAP.md, etc.) apuntan a archivos que NO están en el repo WSL.

**Decisión a tomar** (en el momento de aplicar):

#### Opción A — Mantener referencias al SRS
- Reemplazar links relativos por links absolutos al WSL filesystem path donde están los docs SRS espejados.
- Requiere espejar (`rsync`) los docs SRS al WSL periódicamente.

#### Opción B — Copiar los docs canónicos al repo
- Crear `~/workspace/pandora-erp/docs/architecture/` con copia de:
  - DECISION-LEDGER.md
  - AUTHORITY-MAP.md
  - EVENT-TAXONOMY.md
  - CORRELATION-PROPAGATION.md
  - RECONCILIATION-ENGINE.md
  - backlog-validaciones.md
  - reunion-contador-y-abogado.md
  - files/ADR-*.md
- Adaptar links del CLAUDE.md a `docs/architecture/*`
- Riesgo: drift entre las 2 copias. Establecer `docs/architecture/README.md` con regla: "estos archivos son espejo de `/mnt/c/Users/Pandora/Desktop/SRS/`. Mantener sync manual con `rsync` o regla pre-commit."

#### Opción C — Recomendada — copia más limpia
- Copiar SOLO los docs canónicos al repo (Opción B subset):
  - `docs/architecture/DECISION-LEDGER.md`
  - `docs/architecture/AUTHORITY-MAP.md`
  - `docs/architecture/EVENT-TAXONOMY.md`
  - `docs/architecture/CORRELATION-PROPAGATION.md`
  - `docs/architecture/RECONCILIATION-ENGINE.md`
  - `docs/architecture/backlog-validaciones.md`
  - `docs/architecture/reunion-contador-y-abogado.md`
  - `docs/adrs/ADR-*.md` (copiar la carpeta `files/` renombrada a `adrs/`)
- Establecer `docs/architecture/README.md` que diga:
  > Estos docs son espejo de los originales en `c:\Users\Pandora\Desktop\SRS\` (filesystem owner Pandora). Para cambios estructurales: editar primero el original SRS, luego sync acá con script. Para cambios de implementación: editar acá, después promover al SRS si vale la pena.

**Recomendación:** Opción C. Permite que el código viva con su doc + tiene un proceso definido para sync.

### Paso 4 — Ajustar paths internos del CLAUDE.md WSL

Tras decidir Opción C:

```bash
cd ~/workspace/pandora-erp/.claude
# Cambiar referencias DECISION-LEDGER.md → docs/architecture/DECISION-LEDGER.md
# (sed o edit manual)
```

Patterns a reemplazar (referenciando paths del CLAUDE.md):

| Original (SRS) | Reemplazo (WSL) |
|---|---|
| `[DECISION-LEDGER.md](DECISION-LEDGER.md)` | `[DECISION-LEDGER.md](../docs/architecture/DECISION-LEDGER.md)` |
| `[AUTHORITY-MAP.md](AUTHORITY-MAP.md)` | `[AUTHORITY-MAP.md](../docs/architecture/AUTHORITY-MAP.md)` |
| `[EVENT-TAXONOMY.md](EVENT-TAXONOMY.md)` | `[EVENT-TAXONOMY.md](../docs/architecture/EVENT-TAXONOMY.md)` |
| `[CORRELATION-PROPAGATION.md](CORRELATION-PROPAGATION.md)` | `[CORRELATION-PROPAGATION.md](../docs/architecture/CORRELATION-PROPAGATION.md)` |
| `[RECONCILIATION-ENGINE.md](RECONCILIATION-ENGINE.md)` | `[RECONCILIATION-ENGINE.md](../docs/architecture/RECONCILIATION-ENGINE.md)` |
| `[backlog-validaciones.md](backlog-validaciones.md)` | `[backlog-validaciones.md](../docs/architecture/backlog-validaciones.md)` |
| `[reunion-contador-y-abogado.md](reunion-contador-y-abogado.md)` | `[reunion-contador-y-abogado.md](../docs/architecture/reunion-contador-y-abogado.md)` |
| `files/ADR-NNNN-...` | `docs/adrs/ADR-NNNN-...` |
| `c:\Users\Pandora\Desktop\SRS\` (cuando aparezca como literal) | `~/workspace/pandora-erp/docs/architecture/` |

### Paso 5 — Adaptar §23 (Apéndice — Filesystem Map)

Reemplazar el árbol "Layout SRS" por el árbol real del repo WSL. El layout WSL ya está documentado en §23.2 del CLAUDE.md SRS — copiarlo como §23.1 nuevo del CLAUDE.md WSL.

Eliminar §23.3 "Layout memoria" si la memoria del agente vive en el filesystem owner (Windows) y NO se accede desde WSL.

### Paso 6 — Agregar sección WSL-specific al final

Agregar después de §23:

```markdown
# 24. Notas WSL-específicas

## Path
- Workspace: `~/workspace/pandora-erp`
- Node: 22.x via `nvm`
- Package manager: `pnpm` (lockfile `pnpm-lock.yaml`)
- Editor: VS Code con extensión Claude Code

## Comandos frecuentes
- Dev: `pnpm dev`
- Build: `pnpm build`
- Test: `pnpm test`
- Drizzle generate: `pnpm drizzle-kit generate`
- Drizzle push: `pnpm drizzle-kit push`
- Type check: `pnpm tsc --noEmit`
- Lint: `pnpm eslint . --fix`
- Format: `pnpm prettier --write .`

## Env vars críticas (ver `src/lib/env.ts` con Zod fail-fast)
- `DATABASE_URL` — Supabase Postgres
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `AFIP_ENVIRONMENT=homologacion|produccion`
- `AFIP_CUIT`, `AFIP_CERT_PATH`, `AFIP_KEY_PATH`
- `MONEY_ROUNDING_POLICY=HALF_EVEN` (cerrado)
- `MONEY_ROUNDING_STAGE=PER_LINE` (propuesto, pendiente contador)
- `SECRETS_ENCRYPTION_KEY_V1=<hex 64>`
- `SECRETS_ENCRYPTION_KEY_ACTIVE_VERSION=1`
- `SENTRY_DSN`

## Estructura repo
Ver §23.1 (Layout repo WSL) arriba.
```

### Paso 7 — Sincronizar rules

Las 5 rules en `.claude/rules/` están desactualizadas vs ADRs nuevos. Revisar contra:

| Rule | Verificar contra |
|---|---|
| `01-stack.md` | ADR-0001 + ADR-0018 (Next 16 + Tailwind 4) |
| `02-multi-tenant.md` | ADR-0002 + ADR-0008 + §7 CLAUDE.md |
| `03-fiscal.md` | ADR-0004 + ADR-0005 + ADR-0006 + ADR-0022 + RECONCILIATION-ENGINE + §8 CLAUDE.md |
| `04-observability.md` | EVENT-TAXONOMY + CORRELATION-PROPAGATION + §10 CLAUDE.md |
| `05-visual-system.md` | ADR-0012 a ADR-0017 + §14 CLAUDE.md |

Si una rule contradice CLAUDE.md / ADRs / DECISION-LEDGER:
1. CLAUDE.md / ADRs / DECISION-LEDGER ganan (jerarquía §2.1)
2. Actualizar la rule
3. Documentar el cambio

### Paso 8 — Validar consistencia

Antes de hacer commit, verificar:

- [ ] CLAUDE.md WSL referencia paths correctos (no apunta a archivos inexistentes)
- [ ] `docs/architecture/` está espejado correctamente desde SRS
- [ ] `docs/adrs/` tiene los 22 ADRs físicos
- [ ] Rules `.claude/rules/01-05-*.md` actualizadas
- [ ] README del repo apunta al CLAUDE.md
- [ ] Comando `grep -r "reunion-contador-advisor" .` no devuelve nada (era el nombre viejo del advisor doc)
- [ ] Las decisiones críticas pendientes (2 hallazgos + advisor questions) están explícitas en algún lugar visible

### Paso 9 — Commit inicial

```bash
cd ~/workspace/pandora-erp
git add .claude/CLAUDE.md docs/architecture docs/adrs .claude/rules
git commit -m "docs: aplicar CLAUDE.md v1.0.0 + docs/architecture (sync desde SRS 2026-05-27)"
```

---

## Sync workflow futuro

Una vez aplicado, mantener sync con esta regla:

### Cambios estructurales (ADR nuevo, ledger update, AUTHORITY-MAP cambio)
1. Editar en SRS primero (`c:\Users\Pandora\Desktop\SRS\`)
2. Validar consistencia con CLAUDE.md SRS
3. Espejar al WSL con `rsync` o copy manual
4. Commit en repo WSL con referencia al cambio

### Cambios de implementación (código, schema, runbooks)
1. Editar en repo WSL
2. Si vale la pena promover (ej: runbook nuevo que afecta a futuro), copiar al SRS
3. Mantener sync de docs canónicos solamente

### Script de sync (opcional, F1+)

```bash
#!/usr/bin/env bash
# sync-from-srs.sh
SRS=/mnt/c/Users/Pandora/Desktop/SRS
REPO=~/workspace/pandora-erp

# Docs canónicos
rsync -av --delete \
  --include="DECISION-LEDGER.md" \
  --include="AUTHORITY-MAP.md" \
  --include="EVENT-TAXONOMY.md" \
  --include="CORRELATION-PROPAGATION.md" \
  --include="RECONCILIATION-ENGINE.md" \
  --include="backlog-validaciones.md" \
  --include="reunion-contador-y-abogado.md" \
  --exclude="*" \
  "$SRS/" "$REPO/docs/architecture/"

# ADRs
rsync -av --delete "$SRS/files/" "$REPO/docs/adrs/"

# CLAUDE.md — manual porque requiere adaptación de paths
echo "ATENCIÓN: CLAUDE.md NO se sincroniza automáticamente."
echo "Si el CLAUDE.md de SRS cambió, actualizar manualmente .claude/CLAUDE.md con paths adaptados."
```

---

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| **Drift entre CLAUDE.md SRS y WSL** | Sync workflow explícito + script. Validar trimestralmente. |
| **Drift entre docs/architecture (WSL) y SRS** | rsync con `--delete`. Pre-commit hook que verifique fechas. |
| **Rules desactualizadas vs ADRs nuevos** | Trimestralmente revisar contra DECISION-LEDGER. |
| **Olvidar adaptar paths** | Pre-commit hook que ejecute `grep -r "c:\\\\Users\\\\Pandora" .` y falle si encuentra. |
| **Code session lee CLAUDE.md viejo en WSL** | Backup explícito + commit del nuevo en mismo momento. |

---

## Estado tras aplicar este plan

Repo WSL tendrá:

- `~/workspace/pandora-erp/.claude/CLAUDE.md` — versión adaptada del maestro
- `~/workspace/pandora-erp/.claude/rules/` — 5 rules actualizadas
- `~/workspace/pandora-erp/docs/architecture/` — espejo de docs canónicos SRS
- `~/workspace/pandora-erp/docs/adrs/` — copia de 22 ADRs
- `~/workspace/pandora-erp/docs/runbooks/` — vacío F0, agregar cuando aparezcan (security-incident, cross-tenant-leak, arco-request)

Repo WSL queda listo para que la próxima sesión de Claude Code arranque con:
- Contexto completo via CLAUDE.md
- ADRs accesibles localmente
- Rules consistentes con ADRs
- Visibilidad de pendientes (2 hallazgos + advisor questions)

---

## Cuándo NO aplicar este plan

- **Antes de que esté listo el repo WSL.** Si vas a hacer setup técnico desde cero (Drizzle schema + RLS + auth, etc.), aplicar este plan al inicio de esa sesión.
- **Si vas a refactor mayor del repo WSL.** Si vas a tirar y reescribir el repo, hacer plan después del setup nuevo.

---

*Documento de instrucciones — 2026-05-27. Mantener hasta que el plan se aplique, después archivar.*
