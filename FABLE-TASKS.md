# Tareas para Fable

> ## ✅ EJECUTADO COMPLETO — 2026-09-02 (Fable)
>
> | Tarea | Resultado | Commit |
> |---|---|---|
> | F1 | 9/9 cambios en CLAUDE.md + EVENT-TAXONOMY, checks verdes | sin commit (SRS tenía cambios previos del owner sin commitear — no se arrastran) |
> | F2 | 4 archivos marcados NO WIREADO, nada borrado | `337fd52` |
> | F3 | Requisito TLS + T-SEC-06 anclado en factory + README fiscal | `2509456` |
> | F4 | 62 mockups → `_historico/`, 18 canónicos en raíz + README. Cero borrados | sin commit (carpeta SRS) |
> | F5 | Flag activo. **CERO errores nuevos** — la estimación `M` era pesimista, el codebase ya indexaba con guards. Build + 748 unit + 213 integration verdes | `1341334` |
>
> **Hallazgos para Opus:**
> 1. **3 errores de tipos PREEXISTENTES** (no causados por F5): `tests/integration/T-CASH-10/11/12` anotan `Promise<T>` donde `withTracingContext` retorna `T | Promise<T>`. Invisibles porque ni `next build` ni vitest chequean tipos de `tests/`. Fix trivial pero fuera de scope — decidir si se corrige la anotación del test o la firma del helper.
> 2. **F4 — desvío justificado:** `checkpoint-caja-v2.html` quedó en raíz además de `caja-editorial.html` (son byte-idénticos) porque **el sidebar de la demo linkea a ese nombre** — archivarlo rompía la navegación. Verificado por grep de referencias cruzadas: con los 18 que quedaron, ningún link interno roto.
> 3. `pedidos.html` y `pedidos-senados.html` quedaron ambos (el barrido no confirmó si son 2 pantallas o 2 estados — decidir al portar).

**Fecha:** 2026-09-02
**Contexto:** derivado de [QUEUE.md](QUEUE.md), [INVENTARIO-REAL.md](INVENTARIO-REAL.md) y [DRIFT-REPORT.md](DRIFT-REPORT.md).
**Criterio de selección:** acá están **sólo** las tareas mecánicas, con archivos exactos y verificación objetiva. Todo lo que requiere criterio (RLS, fiscal, decisiones de ADR) quedó fuera a propósito.

---

## Reglas que aplican a TODAS las tareas

1. **Repo:** `~/workspace/pandora-erp` en WSL. Desde Windows: `\\wsl.localhost\Ubuntu-22.04\home\pandora\workspace\pandora-erp\`
   Bash: `wsl.exe -d Ubuntu-22.04 -- bash -lc 'export PATH="$HOME/.nvm/versions/node/v22.22.3/bin:$PATH"; cd "$HOME/workspace/pandora-erp" && <cmd>'`

2. **Verificación obligatoria antes de dar por cerrada cualquier tarea que toque código:**
   ```
   set -a; . ./.env.test; set +a; unset NODE_ENV
   pnpm test              # 748 unit  — DEBE seguir en 748
   pnpm test:integration  # 213 int   — DEBE seguir en 213
   pnpm build             # DEBE pasar
   ```
   ⚠️ `pnpm test` **no** corre la suite completa. Hay que correr los dos comandos. Docker tiene que estar levantado para el segundo.

3. **NO TOCAR sin autorización explícita:** nada en `src/lib/fiscal/`, `src/lib/money/`, `src/lib/multi_tenant/`, `src/lib/security/`, `drizzle/migrations/`, ni ninguna policy de RLS. Esas son de Opus.

4. **Si algo no está claro, PARÁ y reportá.** No inventes, no completes huecos con suposiciones. Un "no pude verificar X" vale más que una suposición prolija.

5. **Un commit por tarea.** Mensaje en formato `<tipo>: <descripción>`. Sin atribución al final.

6. **Cero documentos de arquitectura nuevos.** El proyecto tiene 26 ADRs y 12 docs de gobernanza. No agregues uno más.

7. **Idioma:** español rioplatense en comentarios y commits, igual que el resto del repo.

---

## F1 — Sincronizar CLAUDE.md y EVENT-TAXONOMY con la realidad · `S`

**Objetivo:** que los docs de gobernanza dejen de afirmar cosas falsas.

**Archivo:** `c:\Users\Pandora\Desktop\SRS\CLAUDE.md` y `EVENT-TAXONOMY.md` (filesystem Windows, NO el repo WSL).

**Cambios exactos:**

| Dónde | Qué dice hoy | Qué tiene que decir |
|---|---|---|
| CLAUDE.md §3.1 título | "22 ADRs activos (22 vigentes...)" | **26** ADRs — el filesystem tiene ADR-0001 a ADR-0026 |
| CLAUDE.md §3.1 tabla | Falta la fila de ADR-0023 | Agregar: *Snapshot Fiscal Completo — Aprobado — 🟡* |
| CLAUDE.md §3.1 tabla | Falta la fila de ADR-0024 | Agregar: *IA Boundary Policy — Aprobado — 🟢* |
| CLAUDE.md §3.1 tabla | Falta la fila de ADR-0025 | Agregar: *Catálogos Regulatorios Runtime — Aprobado — 🟡* |
| CLAUDE.md §3.1 fila ADR-0004 | 🔴 | **🟡** (gana DECISION-LEDGER por jerarquía §2.2) |
| CLAUDE.md §3.1 nota de drift | Dice que §3.1 no lista 0023-0025 | Borrar la nota — ya no aplica |
| CLAUDE.md §6.1 (Observabilidad) | "Sentry instrumentación básica F0" | Aclarar: **declarado pero NO instalado** (cero dependencia en `package.json`) |
| CLAUDE.md §23.2 | Lista `.claude/`, `src/components/atmospheres/`, `src/components/charts/`, `src/lib/workers/`, `docs/runbooks/`, `tests/e2e/` | **Ninguno existe.** Sacarlos del mapa o marcarlos `(no construido)` |
| EVENT-TAXONOMY.md §5 encabezado | "~32 eventos" | **43** — el contenido del propio doc ya lista 43 y coincide exacto con `src/lib/audit/event-names.ts` |

**Verificar:**
```
grep -n "22 vigentes\|22 ADRs" CLAUDE.md          # sin resultados
grep -c "ADR-002[3-6]" CLAUDE.md                  # >= 4
grep -n "~32 eventos" EVENT-TAXONOMY.md           # sin resultados
```

**NO hacer:** no toques ninguna otra sección de CLAUDE.md. No reescribas párrafos "para que queden mejor". Sólo los 9 cambios de la tabla.

---

## F2 — Marcar `src/lib/services/products/` como no wireado · `S`

**Objetivo:** sacar una trampa. Hay 762 líneas que parecen el servicio de productos vivo y no lo son.

**Contexto (ya verificado, no lo re-investigues):**
- `src/lib/services/products/` (`index.ts` 26 + `types.ts` 60 + `csv-import.ts` 219 + `product.service.ts` 457) → **nadie lo importa**, ni un test.
- El módulo VIVO es `src/lib/inventory/` — el POS usa `listProductsPaginated` de `inventory/queries.ts`.
- **No lo borres:** el módulo muerto tiene tres cosas que el vivo NO tiene → `updateProduct`, `softDeleteProduct`, `importProductsFromCsv`, más los schemas Zod.

**Qué hacer:** agregar al principio de cada uno de los 4 archivos un bloque de comentario con este contenido (adaptá la redacción a cada archivo, no lo copies literal 4 veces):

> ⚠️ MÓDULO NO WIREADO. Nadie importa este archivo — el módulo de productos vivo es `src/lib/inventory/`, que es el que usa el POS.
> NO borrar: acá viven `updateProduct`, `softDeleteProduct` e `importProductsFromCsv`, que `inventory/` todavía no tiene.
> Consolidar con `inventory/` cuando se porte la pantalla Productos. Ver QUEUE.md.

**Verificar:** `pnpm build` pasa (son sólo comentarios) + los 4 archivos tienen el aviso.

**NO hacer:** no borres nada, no muevas archivos, no consolides los módulos. Sólo comentarios.

---

## F3 — Dejar escrito el requisito TLS donde se va a construir el transporte · `S`

**Objetivo:** que el requisito de TLS no se pierda cuando alguien construya el adaptador HTTP de AFIP.

**Contexto (ya verificado):** `wsaa-client.ts` y `wsfev1-client.ts` son orquestación pura; `LoginCmsTransport` y `Wsfev1Transport` son **interfaces sin implementación**. `fiscal-client-factory.ts` devuelve `null` a propósito. No hay nada que endurecer todavía — por eso la tarea es documentar, no implementar.

**Archivo:** `src/lib/fiscal/fiscal-client-factory.ts` — ampliar el bloque `TODO (slice cert)` que ya existe.

**Qué agregar al TODO:** que el `LoginCmsTransport` y el `Wsfev1Transport` reales, cuando se construyan, **deben** ir con TLS mínimo 1.2 y validación de certificado activa, porque CLAUDE.md §11.4 lo exige y marca el bypass como *PROHIBIDO explícitamente*. Mencionar que eso es lo que cierra el test `T-SEC-06` del catálogo §18.3.

Agregar la misma nota en `src/lib/fiscal/README.md` donde se describan los adaptadores pendientes.

**Verificar:** `pnpm build` pasa + `grep -rn "T-SEC-06" src/lib/fiscal/` devuelve resultados.

**NO hacer:** **no implementes el transporte.** No agregues dependencias. No toques `wsaa-client.ts` ni `wsfev1-client.ts`.

---

## F4 — Archivar mockups obsoletos · `S`

**Objetivo:** que se sepa cuál abrir. Hay 82 HTML para 16 pantallas.

**Carpeta:** `c:\Users\Pandora\Desktop\SRS\pos-preview\` (Windows, NO el repo).

**Qué hacer:**
1. Crear `pos-preview/_historico/`.
2. Para cada pantalla, identificar el archivo canónico (el de número de versión más alto; si coexisten `checkpoint-{pantalla}-vN` y `{pantalla}-vN`, **el que no tiene prefijo es el más nuevo**).
3. **Mover** (no borrar) todo lo superado a `_historico/`.
4. Dejar en la raíz un archivo por pantalla + los `.md` de research + el entry de la demo.
5. Escribir un `pos-preview/README.md` **corto** (máximo 30 líneas): tabla de pantalla → archivo canónico, y una línea diciendo que `_historico/` es archivo muerto.

**Casos especiales que ya conocemos:**
- `index.html` quedó congelado entre v18 y v19 — **no es el más nuevo ni el entry**. Verificá cuál es el entry real antes de mover nada.
- `checkpoint-v20-cobro-tipeable.html` es un spike **que todavía no se fusionó** a `checkpoint-v19-top-tools.html`. **Los dos se quedan en la raíz** hasta que se fusionen.
- `caja-editorial.html` se queda: es el mockup canónico de Caja.

**Verificar:** contar archivos en la raíz (debería quedar en el orden de 16-20) y que `_historico/` tenga el resto. Ninguno borrado.

**NO hacer:** no borres ni un archivo. No edites el contenido de ningún HTML. No renombres los canónicos.

---

## F5 — Activar `noUncheckedIndexedAccess` · `M` — **la más riesgosa, hacela última**

**Objetivo:** cumplir CLAUDE.md §6.1, que lo exige como obligatorio y hoy no está.

**Archivo:** `tsconfig.json` — hoy sólo tiene `"strict": true`.

**Qué hacer:**
1. Agregar `"noUncheckedIndexedAccess": true`.
2. Correr `pnpm build` y contar los errores.
3. **Si son más de 30 → PARÁ y reportá el conteo y una muestra. No sigas.** Es señal de que la tarea necesita criterio y la toma Opus.
4. Si son 30 o menos, arreglarlos uno por uno.

**Cómo arreglarlos — esto es lo importante:**

`noUncheckedIndexedAccess` hace que `arr[0]` sea `T | undefined`. La forma correcta de arreglarlo es **manejar el caso undefined**, no silenciarlo.

✅ Permitido: guard explícito (`if (!x) return` / `throw`), destructuring con default, `?.`, `??`, chequear `length` antes de indexar.

❌ **Prohibido:** el operador `!` (non-null assertion) y los casts `as`. Silencian el error sin arreglar el bug y dejan el código peor que antes. Si un caso sólo se puede resolver con `!`, **dejalo sin arreglar y reportalo** — ese es exactamente el caso que necesita criterio.

**Verificar:**
```
pnpm build             # pasa
pnpm test              # sigue en 748
pnpm test:integration  # sigue en 213
grep -rn "!\." src/ --include=*.ts | wc -l   # no debe haber crecido
```

**NO hacer:** no cambies ninguna otra opción de `tsconfig.json`. No refactorices funciones "de paso". Sólo el mínimo para que compile bien.

---

## Orden sugerido

`F1` → `F2` → `F3` → `F4` → `F5`

Las cuatro primeras son de riesgo casi nulo y dejan el terreno limpio. `F5` va última porque es la única que puede escalar y necesita el escape hatch del paso 3.

---

## Qué NO está en esta lista y por qué

| Tarea | Por qué la toma Opus |
|---|---|
| **RLS en las 8 tablas + particiones de `audit_log`** | Una policy mal escrita hace que el webhook de MercadoPago **descarte cobros en silencio** (el dedup interpreta cero filas como "ya procesado"). Subtly-wrong acá cuesta plata real. |
| **ADR-0023 vs `fiscal_snapshots`** | Decisión: implementar la migración o degradar el ADR. Depende de A-11.c y A-25, abiertas con la contadora. |
| **ADR-0025 vs `afip-codes.ts`** | Misma clase de decisión. |
| **Fork triple de Caja** | Fidelidad visual + el antecedente de que los estados intermedios generaron frustración. Requiere portar entero y verificar por screenshot. |
| **Fusionar v20 del POS** | Ídem. |
| **Portar las 13 pantallas** | Ídem. Cuando haya un patrón probado y repetible, se puede delegar. |
