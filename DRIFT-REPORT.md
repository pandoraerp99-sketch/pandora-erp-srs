# Drift Report — docs vs código real

**Fecha:** 2026-09-02
**Qué es:** dónde la documentación y el código se contradicen. Cada fila cita ambos lados.
**Regla de autoridad:** `DECISION-LEDGER.md` gana siempre. `CLAUDE.md` cede ante el Ledger.

**25 contradicciones: 11 ALTA · 10 MEDIA · 4 BAJA.**
(22 del barrido automático + 2 que aparecieron al cruzar barridos + 1 que sólo se ve consultando la base viva.)

---

## Verificadas a mano

Estas las abrí yo contra el código, no las tomé del barrido:

| Hallazgo | Verificación |
|---|---|
| `fiscal_snapshots` sin los campos de ADR-0023 | ✅ CONFIRMADO — el schema tiene 18 columnas y **ninguna** es `condicion_iva_receptor_id`, `qr_payload_json` ni `authorization_code_type`. El encabezado del archivo dice "ADR-0022", nunca se actualizó a ADR-0023. |
| 8 tablas sin RLS | ✅ CONFIRMADO **contra la base viva** — `pg_class.relrowsecurity = f` y cero policies en las ocho. Coincide con los archivos de migración. |
| Particiones de `audit_log` sin RLS | ✅ CONFIRMADO **y demostrado con una consulta real** — ver D-25. |
| TLS ausente en cliente AFIP | ✅ CONFIRMADO — `grep -rn "minVersion\|rejectUnauthorized\|TLSv1" src/` → **cero resultados**. |
| `noUncheckedIndexedAccess` ausente | ✅ CONFIRMADO — `tsconfig.json` solo tiene `"strict": true`. |
| Catálogos AFIP hardcodeados | ✅ CONFIRMADO — no existe `src/lib/fiscal/catalogs/`. |

---

## 🔴 D-23 (NUEVO — surgió de cruzar barridos)

**Ocho tablas quedaron con UNA sola capa de aislamiento donde la constitución exige dos.**

Ningún barrido lo vio solo. Sale de cruzar dos hallazgos:

- El barrido de **código** encontró que `multi_tenant/validation.ts` (`validateTenantAccess`, la 2ª capa según CLAUDE.md §7.2) está **huérfano** — escrito, testeado, sin un solo import de producción.
- El barrido de **código** también encontró 8 tablas **sin RLS** (1ª capa).

Intersección: en `sale_payments`, `mp_payments`, `stock_movements`, `metrics_counter`, `cash_sessions`, `cash_movements`, `jobs_queue` y `processed_webhook_events` **no está activa ninguna de las dos capas** que CLAUDE.md §7.2 declara obligatorias.

Hoy no hay fuga: el filtro `tenant_id` está escrito a mano en las queries (verificado, ej. `src/lib/cash/queries.ts:93`). El problema es que **es la única línea de defensa y depende de disciplina humana**. Una query futura que olvide el `.where()` no la detiene nadie.

**Precedente que lo hace más urgente:** `tests/COVERAGE-MATRIX.md:201` documenta que los tests marcados "cross-tenant" corrían con cliente privilegiado y **no testeaban aislamiento real** — "el gap sistémico vivió silente desde Sprint 0". Este es el mismo patrón, una capa más abajo.

**Severidad: ALTA.** Multi-tenant es uno de los tres dominios blindados del proyecto.

> 🔥 **ESCALADO A FUGA ACTIVA — y CERRADO** (2026-09-02).
>
> **Lo que se creía:** riesgo latente, "aguanta una sesión". **Era falso.**
>
> El cliente `db` de la app conecta con un role `rolbypassrls = t`, así que RLS nunca aplica al path de la app — de ahí la impresión de que no pasaba nada. Pero **Supabase expone PostgREST** (`NEXT_PUBLIC_SUPABASE_URL`), que corre como `anon`/`authenticated` (`rolbypassrls = f`). Y la anon key **viaja al browser**.
>
> Medido con un `curl` y la anon key pública, antes del fix:
>
> ```
> GET /rest/v1/sale_payments   ->  59 filas   (todos los comercios)
> GET /rest/v1/metrics_counter -> 202 filas
> GET /rest/v1/cash_sessions   ->   2 filas   (con tenant_id visible)
> GET /rest/v1/cash_movements  ->   2 filas
> GET /rest/v1/stock_movements ->   2 filas
> ```
>
> Las tablas que sí tenían RLS (`sales`, `products`, `audit_log`) devolvían **0** al mismo request. `mp_payments`, `jobs_queue` y `processed_webhook_events` devolvían 0 sólo porque estaban **vacías** — iban a filtrar igual al poblarse.
>
> **Fix aplicado:** `0020_rls_tablas_faltantes.sql`. Post-fix, las 11 tablas devuelven 0 al mismo request.
> **Regresión:** `tests/cross-tenant/T-MT-08-rls-tablas-faltantes.test.ts` (4 casos) — prueba la capa SQL **y** la capa HTTP con la anon key, que es el vector real.
>
> **La trampa del webhook no existía:** el dedup de `processed_webhook_events` corre con el cliente que bypassa RLS, así que las policies son transparentes para él. Verificado además que el cliente Supabase JS se usa **sólo para auth** (cero `.from()` de datos en `src/`).

---

## 🔴 D-24 (NUEVO — cruce tests × código)

**El cliente AFIP se construyó sin el endurecimiento TLS que el propio repo se había prometido.**

`src/lib/integrations/afip/` tiene 7 archivos (WSAA + WSFEv1 + XML) — está mucho más construido de lo que creíamos. Pero no tiene `minVersion: 'TLSv1.2'` ni `rejectUnauthorized: true`, que CLAUDE.md §11.4 marca como obligatorio y que `tests/COVERAGE-MATRIX.md` prometía para este momento (test `T-SEC-06`).

CLAUDE.md §11.4 además dice textual que el bypass de validación TLS está **"PROHIBIDO explícitamente"**.

**Severidad: ALTA.** Es el canal por donde viajan certificado y token fiscal.

---

## 🔴 D-25 (NUEVO — solo visible contra la base viva)

**El `audit_log` se puede leer completo, de todos los comercios, consultando la partición hija.**

`audit_log` es una tabla **particionada por año**. En Postgres, las policies del padre se aplican cuando se consulta **a través del padre** — pero **no** cuando se consulta una partición directamente. Ahí manda el RLS de la propia partición.

Estado real en la base:

| Tabla | Tipo | RLS | Policies |
|---|---|---|---|
| `audit_log` | partición padre | ✅ on | 2 |
| `audit_log_2026` | partición hija | ❌ **off** | **0** |
| `audit_log_2027` | partición hija | ❌ **off** | **0** |

**Demostrado empíricamente**, no deducido. Con `role = authenticated` y un JWT de un tenant concreto:

```
via PADRE audit_log        →     3 filas   (filtrado correcto)
via HIJA  audit_log_2026   →  1192 filas   (TODAS, de TODOS los tenants)
```

Cualquier consulta que apunte a la partición —una query de operador, el cron de `DROP PARTITION`, código futuro que targetee la partición por performance, alguien depurando— **lee el audit log completo de todos los comercios**.

Peso específico: el `audit_log` es la tabla que sostiene la defensa ante una inspección de ARCA y ante un reclamo civil. Es, por diseño, la que más datos sensibles cruzados concentra. CLAUDE.md §7.6 lo pone como invariante absoluta: *"NO existe query sin `company_id` filter en tablas tenant-aware"*.

**Agravante estructural:** el cron de `cash.partition_audit_log` crea la partición del año siguiente. Si esa creación no habilita RLS explícitamente, **cada año que pase agrega una partición nueva con el mismo agujero**, en silencio.

**Severidad: ALTA.**

---

## Tabla consolidada

| # | Tema | Doc | Código | Gana | Sev |
|---|---|---|---|---|---|
| **D-25** | **Particiones de `audit_log` sin RLS → lectura cross-tenant demostrada** | CLAUDE.md §7.6 | base viva: `audit_log_2026/2027` `rls=f` | CLAUDE.md | **ALTA** |
| D-23 | 8 tablas sin RLS **y** `validateTenantAccess` huérfano → cero capas | CLAUDE.md §7.2 | base viva + `multi_tenant/validation.ts` | CLAUDE.md | **ALTA** |
| D-24 | Cliente AFIP sin TLS `minVersion`/`rejectUnauthorized` | CLAUDE.md §11.4 | `src/lib/integrations/afip/*` | CLAUDE.md | **ALTA** |
| ~~7~~ | ~~Campos `condicion_iva_receptor_*` ausentes~~ | ✅ **RESUELTO 2026-09-03** — migración `0021`, columnas nullable (el campo sigue OPCIONAL en WSFEv1 per Manual v4.5) | | | ~~ALTA~~ |
| ~~8~~ | ~~Campos QR fiscal ausentes~~ | ✅ **RESUELTO 2026-09-03** — `qr_version` + `qr_payload_json` + `qr_url_base_at_emission`. Se persiste el payload, no la imagen (el PNG es derivable) | | | ~~ALTA~~ |
| ~~9~~ | ~~`authorization_code_type` (CAE/CAEA) ausente~~ | ✅ **RESUELTO 2026-09-03** — NOT NULL default `CAE` + CHECK | | | ~~ALTA~~ |
| ~~10~~ | ~~Migración `0006_fiscal_snapshot_v2.sql` declarada, nunca creada~~ | ✅ **RESUELTO 2026-09-03** — se implementó como `0021_fiscal_snapshot_adr_0023.sql`. El número del ADR era aspiracional; el real es 0021 | | | ~~ALTA~~ |
| ~~11~~ | ~~Catálogos AFIP hardcodeados violando invariante~~ | ✅ **RESUELTO 2026-09-03** — ganó el código, no el ADR: la RG 5762/2025 eliminó la clase "M" entera y el código interno siguió siendo `0051` → ARCA preserva los códigos numéricos. ADR-0025 pasa a **implementación diferida F1+**; F0 = hardcode anclado por `tax_policy_version` | | | ~~ALTA~~ |
| ~~12~~ | ~~Módulo `catalogs/` runtime inexistente~~ | ✅ **RESUELTO 2026-09-03** — mismo motivo. Construirlo hoy sería over-engineering (§20.1); la spec queda intacta para F1+ con disparador explícito | | | ~~ALTA~~ |
| 18 | Worker AFIP reconciliación inexistente | CLAUDE.md §23.2 · ROADMAP:1352 | solo worker de MP | ROADMAP | **ALTA** |
| — | Sprint 6 fiscal: ~75% de archivos declarados faltan | ROADMAP:1258-1287 | 9 reales vs 14+ declarados | gap real | **ALTA** |
| 1-3 | ADR-0023/0024/0025 ausentes de CLAUDE.md §3.1 | CLAUDE.md:177-203 | existen en `files/` + Ledger:50-52 | LEDGER | MEDIA |
| 5 | ADR-0004: 🔴 en CLAUDE.md vs 🟡 en Ledger | CLAUDE.md:184 | LEDGER:31 | LEDGER (🟡) | MEDIA |
| 13 | Enum `merchant_jurisdiction_province` restringido a TDF | CLAUDE.md:889 · ADR-0023:183 | `schema/_common.ts:32` | ambiguo | MEDIA |
| 14 | Sentry en stack aprobado, sin dependencia real | CLAUDE.md:79,517 | `package.json` sin `@sentry/*` | deuda ya reconocida | MEDIA |
| 15 | `noUncheckedIndexedAccess` requerido, ausente | CLAUDE.md:496 | `tsconfig.json:2-24` | CLAUDE.md | MEDIA |
| 16 | `.claude/CLAUDE.md` + `rules/` declarado, inexistente | CLAUDE.md §23.2 | no existe | plan no ejecutado | MEDIA |
| 17 | `src/components/{atmospheres,charts}/` inexistente | CLAUDE.md §23.2 | solo `ui/` y `pos/` | no construido | MEDIA |
| 19 | `docs/runbooks/*.md` inexistente | CLAUDE.md §23.2 | solo 2 docs de diseño POS | no construido | MEDIA |
| — | Tabla `invoices` separada declarada, inexistente | ROADMAP:1162-1179 | solo `invoice_sequences.ts` | diseño real difiere | MEDIA |
| 4 | "22 ADRs vigentes" stale | CLAUDE.md:177 | filesystem = 26 | filesystem | BAJA |
| 6 | Header EVENT-TAXONOMY dice "~32 eventos" | EVENT-TAXONOMY:820 | 43 en doc y código, **coinciden** | contenido real | BAJA |
| 20 | `tests/e2e/` declarado, inexistente | CLAUDE.md §23.2 | sin Playwright | BAJA |
| 21 | §23.1 no refleja archivos reales del SRS | CLAUDE.md §23.1 | 10+ sin listar | BAJA |
| 22 | Sketches de schema Sprint 1/2 no coinciden | ROADMAP:414,617 | `schema/audit.ts`, `companies.ts` | código sigue CLAUDE.md | BAJA |

---

## El patrón de fondo

Las 10 de severidad alta comparten una sola causa: **los ADRs se escribieron como si ya estuvieran implementados.** ADR-0023 y ADR-0025 figuran como *Aprobado* y declaran archivos y migraciones concretas que nunca se crearon.

No es que el código esté mal escrito. Es que **el doc dejó de ser un plan y pasó a leerse como un registro de algo hecho**, y nadie cerró el círculo.

Consecuencia práctica: cualquiera —humano o IA— que arranque leyendo los ADRs va a asumir capacidades que no existen. Que fue exactamente lo que nos pasó en el slice 1 del Sprint 6, cuando escribimos `afip-codes.ts` hardcodeado violando un ADR aprobado sin notarlo.

---

## El límite de los tests

La suite completa estaba en **961 verde** (748 unit + 213 integration/cross-tenant) mientras había una **fuga cross-tenant remotamente explotable con una key pública**.

La causa raíz es la misma que hacía invisible el bug: **todos los tests usan el cliente `db`, que bypassa RLS.** Ningún test ejercitaba jamás el rol bajo el que corre PostgREST. El aislamiento nunca se estaba probando — se estaba probando el filtro `tenant_id` del código de aplicación, que sí funciona.

Es el mismo patrón que `COVERAGE-MATRIX.md:201` ya documentó una vez: *"el gap sistémico vivió silente desde Sprint 0"*. Segunda vez, una capa más abajo.

**Conclusión operativa:** en este proyecto, verde no era evidencia de aislamiento. Por eso `T-MT-08` prueba **las dos superficies** — la SQL con `withRlsContext` y la HTTP con la anon key real. Toda tabla tenant-aware nueva tiene que sumarse a la lista de ese test, o vuelve el agujero.

**Y un detalle que engaña:** `pnpm test` corre **sólo los unitarios**. Los 44 archivos de integración y cross-tenant necesitan `pnpm test:integration` aparte. Decir "748 verde" suena a suite completa y no lo es.

---

## Una buena

El catálogo de EVENT-TAXONOMY (43 eventos) coincide **exacto** con `src/lib/audit/event-names.ts`. Lo único viejo es un encabezado que dice "~32". Es el único doc del sistema que no driftó.
