# Cola de trabajo — Pandora ERP

**Fecha:** 2026-09-02 · **última actualización:** 2026-09-05
**Base:** [INVENTARIO-REAL.md](INVENTARIO-REAL.md) + [DRIFT-REPORT.md](DRIFT-REPORT.md)
**Cómo se usa:** se toma de arriba hacia abajo. Cada ítem dice qué, por qué, dónde tocar, cómo verificar y cuánto pesa.

**Tamaños:** `S` < 1h · `M` 1-4h · `L` > 4h o multi-sesión.

> ## Estado al 2026-09-14 — esta cola quedó atrás del trabajo real
>
> Desde el 2026-09-09 la prioridad sale de `EVIDENCIA-pedido-contadora-2026-09.md`, no de esta cola. Lo decidido y construido desde junio está en DECISION-LEDGER → "Puesta al día jun → sep 2026". Estado de los ítems de abajo que no estaban marcados:
>
> | # | Estado real |
> |---|---|
> | 2 TLS AFIP | ✅ **Cerrado** — `5c49410`: `soap-transport.ts` con TLS 1.2 + `rejectUnauthorized`, test `T-SEC-06` contra servidores reales |
> | 3 `vault.ts` | ✅ **Cableado** — primer consumidor real: certificados AFIP por tenant (migration 0025) |
> | 4 Fork triple de Caja | ✅ **Resuelto** — `ae42a49` (2026-09-03): `/caja` es el React sobre AppShell |
> | 6 Archivar mockups | ✅ Hecho por Fable F4 (2026-09-02) |
> | 9 Sincronizar CLAUDE.md | ✅ Hecho (Fable F1) y re-sincronizado 2026-09-14 (27 ADRs, §3.6) |
> | 10 Tests `product.service.ts` | 🟡 **Parcial** — cubren alta/edición/rubro/ajuste/stock inicial/historial (T-INV-09/10/11/13); sin test propio `softDeleteProduct`, `searchProducts`, `listLowStockProducts` |
> | 11 `noUncheckedIndexedAccess` | ✅ `1341334` (Fable F5) |
> | 13 Portar pantallas | 🚧 7 reales: POS, Caja, Productos, Clientes, Gastos, Contador, Panel. Faltan Stock, Ofertas, Facturas, Presupuestos, Pedidos, Señas, Devoluciones, Reportes, Integraciones, Configuración |
> | 14 Modo oscuro | 🚧 Con tema: Caja, Clientes, Gastos, Panel. **Sin tema (medido): Productos, Contador** |
>
> **Nuevo, fuera de esta cola:** mutaciones de plata y de acceso sin evento de `audit_log` (ver Ledger → Decisiones abiertas).

---

## P0 — Cerrar agujeros de seguridad

Los tres son baratos, no dependen de nadie externo, y cierran huecos que la constitución del proyecto declara obligatorios. **Nada de P1 en adelante debería arrancar antes que esto.**

### 0. ✅ HECHO — verificación contra la base viva (2026-09-02)

- **Resultado:** las 8 tablas confirmadas sin RLS y sin policies en la base real. **No hay divergencia** con los archivos de migración → el ítem #1 se mantiene tal cual estaba escrito.
- **Hallazgo extra:** las particiones de `audit_log` también están sin RLS → nuevo ítem **#1-bis**.
- **Suite completa corrida:** 748 unit + 213 integration/cross-tenant = **961 en verde**.
- **Aprendizaje operativo:** `pnpm test` **no** corre la suite completa (sólo unitarios). Hace falta además `pnpm test:integration`.

### 1 + 1-bis. ✅ HECHO — 2026-09-02 · migración `0020_rls_tablas_faltantes.sql`

> 🔥 **Resultó ser una fuga ACTIVA, no latente.** Al investigar antes de escribir la migración apareció que Supabase expone PostgREST y que la **anon key viaja al browser**. Con esa key pública se leían **59 pagos, 202 métricas y las sesiones/movimientos de caja de todos los comercios**. Lo que se había dicho de que "aguanta una sesión" era incorrecto.
>
> - **Fix:** RLS + policies en las 8 tablas (`cash_movements` vía join con `cash_sessions`, que no tiene `tenant_id` propio) + las 2 particiones de `audit_log`.
> - **Verificado:** el mismo `curl` que demostró la fuga devuelve 0 en las 11 tablas. La partición pasó de 1192 filas a 3, idéntico al padre.
> - **Regresión:** `tests/cross-tenant/T-MT-08-rls-tablas-faltantes.test.ts` — 4 casos, prueba capa SQL **y** capa HTTP con anon key.
> - **La trampa del webhook no aplicaba:** el dedup corre con el cliente que bypassa RLS. Verificado que el cliente Supabase JS se usa sólo para auth.
> - **Pendiente heredado:** quien implemente `cron.partition_audit_log` **debe** habilitar RLS en cada partición nueva — `CREATE TABLE ... PARTITION OF` no lo hereda. Está anotado en el header de la migración.

<details><summary>Definición original (histórica)</summary>

### 1. RLS en las 8 tablas huérfanas · `M`

- **Qué:** habilitar row level security + policies `tenant_id IN (SELECT pandora.current_company_ids())` sobre `sale_payments`, `mp_payments`, `stock_movements`, `metrics_counter`, `cash_sessions`, `cash_movements`, `jobs_queue`, `processed_webhook_events`.
- **Por qué:** según las migraciones, esas tablas tienen **cero** capas de aislamiento activas (D-23). La única defensa es que cada query recuerde filtrar a mano.
- **Dónde:** nueva migración `drizzle/migrations/post_initial/0020_rls_tablas_faltantes.sql` + espejo en la migración base para bases nuevas.
- **Verificar:** test en `tests/cross-tenant/` usando `withRlsContext()` que intente leer `cash_movements` del tenant B desde el tenant A y falle. **Sin ese test no está hecho** — el precedente de `COVERAGE-MATRIX.md:201` es que los tests "cross-tenant" pueden mentir si corren con cliente privilegiado.

#### ⛔ Dos trampas antes de escribir la policy

**a) El path de webhooks no tiene JWT.** `processed_webhook_events` y `mp_payments` se escriben desde el webhook de MercadoPago, que entra **sin usuario autenticado**. Ahí `auth.jwt() ->> 'company_id'` es null y una policy basada en `current_company_ids()` **no matchea nada**.

Y el daño no sería un error visible: el dedup hace `INSERT ... ON CONFLICT DO NOTHING ... RETURNING`, y cero filas devueltas se interpreta como *"evento ya procesado"* → **el webhook se descarta en silencio**. Una policy ingenua convierte cada notificación de MercadoPago en un cobro perdido sin ruido.

Necesitan bypass de service-role o una policy que admita el contexto del webhook.

**b) Filas de sistema.** `metrics_counter` y `jobs_queue` tienen filas con `SYSTEM_TENANT_ID`. La policy tiene que contemplarlas o rompés los workers.

</details>

### 1-bis. RLS en las particiones de `audit_log` · `M` — **el más grave**

- **Qué:** habilitar RLS + policies en `audit_log_2026` y `audit_log_2027`, y **arreglar el cron que crea la partición del año siguiente** para que la nueva nazca con RLS.
- **Por qué:** demostrado con una consulta real (D-25) — vía el padre se ven 3 filas del tenant, vía la hija se ven **1192, de todos los comercios**. Es el audit log: la tabla que sostiene la defensa ante una inspección de ARCA y ante un reclamo civil.
- **Dónde:** misma migración que el #1 + el job `cron.partition_audit_log`.
- **Verificar:** repetir la consulta del D-25 con `role = authenticated` y un JWT de un tenant. Vía la hija tiene que devolver **lo mismo** que vía el padre. Y un test que cree la partición del año siguiente y compruebe que nace con RLS.
- **Ojo:** si sólo arreglás las particiones existentes y no el cron, el agujero **vuelve solo el año que viene**, en silencio.

### 2. TLS en el cliente AFIP · **BLOQUEADO** — corregido 2026-09-02

> ⚠️ **Corrección.** Este ítem estaba mal estimado como `S`. Al abrir los archivos: `wsaa-client.ts` y `wsfev1-client.ts` son **orquestación pura con dependencias inyectadas**. `LoginCmsTransport` y `Wsfev1Transport` son **interfaces** — el HTTP real no existe. `fiscal-client-factory.ts` devuelve `null` a propósito porque *"falta el certificado de homologación y/o los adaptadores reales"*.
>
> **No hay transporte que endurecer todavía.** D-24 sigue siendo válido como requisito, pero baja de "gap de código" a "requisito pendiente de un módulo que no existe" — misma categoría que los tests diferidos del Reconciliation Engine.

- **Qué queda accionable ahora:** dejar el requisito TLS escrito **en el punto donde se va a construir el transporte**, para que no se pierda. Ver tarea **F3** en [FABLE-TASKS.md](FABLE-TASKS.md).
- **Cuándo se implementa de verdad:** junto con el adaptador de transporte, cuando llegue el certificado de homologación.
- **Verificar entonces:** `T-SEC-06` del catálogo §18.3.

### 3. Resolver los 3 huérfanos de seguridad · `M` — ✅ **CERRADO 2026-09-05**

- **Qué:** decidir, para cada uno, **wirear o borrar**. No pueden quedar en limbo.
  - ✅ **`security/rate-limit.ts` — CABLEADO 2026-09-05** (commit `0a4c5d6`). El login aceptaba **intentos infinitos**: el módulo estaba entero y testeado, sin un solo import. Ahora aplica 5/min por IP + 10/hora por email, y de paso se cablearon `auth.login.success` / `failed`, que también estaban en el catálogo sin escritor.
    - **Bug que apareció al cablear:** llamar `checkLoginRateLimit` dos veces consumía el slot de IP dos veces por intento → el límite real era 2/min, no 5. Sólo lo ve un test que ejerza la Server Action; el test del módulo no podía.
    - **Nuevo:** `security/client-ip.ts` — se toma el **último** hop de `x-forwarded-for`, no el primero (el cliente controla el extremo izquierdo y podría elegir su propio bucket). ⚠️ **Confirmar en el primer deploy real** qué header llega.
    - **Contradicción resuelta:** el docstring de `rate-limit.ts` mandaba escribir `auth.login.rate_limited` en audit_log — evento inexistente, y EVENT-TAXONOMY lo pone en "va a Pino, NO a audit_log". Gana la taxonomía.
    - **Para el ADR, no ajuste silencioso:** dos cajeros detrás del mismo router comparten los 5/min, éxitos incluidos. Si molesta en el piloto, es hallazgo para ADR-0019.
    - **Probado contra la base real** (`T-SEC-08`, commit `1a9937d`): el unitario mockea el tracing y el writer, así que sólo probaba la llamada. El de integración confirma que la fila **existe**, con `SYSTEM_TENANT_ID`, en la partición del año, y con la password redactada. Sin él, un audit roto se habría tragado en el `catch` con la suite en verde.
    - ✅ **`POLICY_PUBLIC_ENDPOINT` cableado 2026-09-05** (`4c7586f`) en la ruta del webhook de MP. Se cerró porque **yo mismo abrí una regresión**: validar la company es una consulta a Postgres y quedó *antes* del HMAC, o sea input no autenticado llegando a la base sin ningún límite. Antes de ese cambio una request sin firma moría en `resolveSecret` sin tocar la DB.
  - ✅ **`multi_tenant/validation.ts` — RESUELTO 2026-09-05** (commit `2a4aa27`), pero **no como decía el ítem**. Se auditó la superficie antes de cablear: **todos** los lookups de `sale.service`, `product.service`, `cash` e `inventory` ya filtran por `tenant_id` dentro del `where`. Un acceso cruzado devuelve cero filas y termina en `NotFoundError` — nunca hay un recurso ajeno en memoria que comparar. Meter `validateTenantAccess()` ahí sería un chequeo **siempre verdadero**, o sea justo la falsa sensación de cobertura que este ítem quería eliminar.
    - **Lo que sí hacía falta:** la única superficie donde el tenant **no viene de la sesión** es el webhook de MP — el `company_id` llega en el path de la URL y entraba **crudo** al tracing context.
    - **Agujero real, verificado contra la base:** malformado → el INSERT de dedup reventaba en el cast a uuid → **500** (y un 500 hace que MP reintente). UUID válido pero inexistente → `processed_webhook_events` y `jobs_queue` **no tienen FK** sobre `tenant_id` → fila de dedup + **job encolado para un tenant fantasma**. `mp_payments` sí tiene FK, o sea que lo atrapaba una tabla *más abajo* — ese desfasaje es el argumento para chequear en el borde.
    - **Fix:** `resolveKnownTenantId()` (forma + existencia) **antes** de `withTracingContext` — una vez adentro, un tenant basura mancha cada línea de Pino y cada audit. 400 si malformado, 404 si no existe. Test `T-MT-09`.
    - **CLAUDE.md §7.2 corregido:** describía una disciplina (leer y después comparar) que el código cumple filtrando en la query. Se arregló el doc, no se dobló el código.
  - ⬜ `security/vault.ts` — §11.8. Cero consumidores reales (sólo un comentario en `mp-secret.ts` que lo señala como F1). **Correctamente diferido** hasta los certificados AFIP por tenant — ver el gate de abajo.
- **Por qué:** código muerto que la documentación presenta como activo es peor que no tenerlo: da falsa sensación de cobertura.
- **Verificar:** o hay un import de producción, o el módulo no existe y CLAUDE.md se corrigió. Nada intermedio.
- **Nota:** `vault.ts` probablemente se necesite igual cuando entren los certificados AFIP por tenant. Wirearlo, no borrarlo.

---

## P1 — Una sola fuente de verdad

### 4. Colapsar el fork triple de Caja · `M`

- **Qué:** que `/caja` sirva el React de `caja-real`, y que quede **un** mockup canónico.
- **Por qué:** hoy hay tres versiones divergentes y la que ves en `/caja` es huérfana (no tiene padre en el SRS). Cualquier trabajo visual sobre Caja hoy se hace sobre una base que nadie sabe cuál es.
- **Dónde:** sacar el rewrite de `next.config.ts`, renombrar la ruta, y **antes** portar a `caja-real` lo que `public/caja.html` tenga de más (el modo oscuro que evolucionó solo en WSL).
- **Verificar:** screenshot logueado de `/caja` contra el mockup. Y que `public/caja.html` quede archivado, no borrado.
- **Ojo:** esta es la que más frustración generó la última vez. **Portar todo de una y mostrar solo cuando esté entero** — nada de estados intermedios.

### 5. ✅ HECHO 2026-09-05 — Fusionar el spike v20 del POS (`4134dff`)

> El cobro tipeable ya está en `/pos`. **El cobro es multi-medio**: `sale_payments` se diseñó en el Sprint 5 con una fila por pago y el service ya derivaba `mixto` — lo único single-method era la UI. Lo F1+ de ADR-0026 es *reclasificar* un mixto, no crearlo (`reclassify.ts:192`).
>
> **Bug vivo encontrado:** la opción "QR / MP" del POS **nunca pudo cobrar** — mandaba `mp_qr` sin `mp_payment_external_id` y el schema lo rechaza siempre. Ahora se ve apagada con el motivo. Fijado en `tests/unit/pos-payment-methods.test.ts`.
>
> **Dos bugs de layout que sólo aparecieron midiendo**, no mirando la captura: (a) la hoja no subía (faltaba `sheet-open` en el carrito) y el botón de cobrar caía fuera de pantalla; (b) `.shell` no declara filas de grid → `.main` medía 1005px en un shell de 848 y el carrito se cortaba. **La maqueta tiene el mismo bug (b)** — el arreglo va como bloque de corrección, no es divergencia.
>
> Herramienta nueva: `scripts/shot-pos.mjs` — captura del POS logueado por CDP + diagnóstico medido del DOM.

<details><summary>Definición original (histórica)</summary>

#### Fusionar el spike v20 del POS · `M`

- **Qué:** llevar el cobro tipeable de `checkpoint-v20-cobro-tipeable.html` a la línea principal, y de ahí al `/pos` real.
- **Por qué:** el advisor ya marcó que hay dos POS funcionando como dos fuentes de verdad. v20 es un spike aislado que nunca volvió.
- **Verificar:** el numpad + input tipeable funcionando en `/pos` con sesión real.

</details>

### 6. Archivar mockups obsoletos · `S`

- **Qué:** 82 HTML → mover los superados a `pos-preview/_historico/`, dejar los ~16 canónicos.
- **Por qué:** `index.html` quedó congelado entre v18 y v19 y no es el entry de la demo. Nadie sabe cuál abrir.
- **Verificar:** un archivo por pantalla en la raíz de `pos-preview/`.

---

## P2 — Que los ADRs dejen de mentir

> Estos son **decisiones antes que código**. Cada uno tiene dos salidas legítimas: implementar lo que el ADR dice, o degradar el ADR a *Propuesto*. Lo que no se puede es dejarlo *Aprobado* describiendo algo que no existe.

### 7. ✅ RESUELTO 2026-09-03 — ADR-0023 implementado · migración `0021`

- **Momento ideal:** `fiscal_snapshots` estaba **vacía (0 filas)** — sin backfill ni riesgo. Todas las columnas nuevas son NULLABLE, así que no rompen la emisión actual.
- **Se agregaron 7 columnas:** `condicion_iva_receptor_id` + `_desc_at_emission` (RG 5616) · `qr_version` + `qr_payload_json` + `qr_url_base_at_emission` (QR RG 4892) · `authorization_code_type` (CAE/CAEA, default `CAE` + CHECK) · `wsfe_manual_revision`.
- **Se decidió NO agregar 3, con motivo escrito en la migración:**
  - `condicion_iva_receptor_catalog_version_at_emission` — sólo tiene sentido con catálogos en runtime, y **ADR-0025 quedó diferido a F1+**. En F0 quien identifica la fotografía del catálogo es `tax_policy_version`, que ya está en la tabla.
  - `fx_rate` / `precision_internal` — constantes en F0 (ARS-only, `numeric(19,4)` + HALF_EVEN). Además la cotización que importa fiscalmente ya viaja **dentro del QR** (`ctz`).
  - `customer_snapshot_ref` — ya existe vía `sale_id`; duplicarlo sería una segunda fuente de verdad (§20.26).
- **Regresión:** `T-FISCAL-SCHEMA-01` T1.5 y T1.6 — fijan las 7 columnas contra el ADR y que `authorization_code_type` sólo acepte CAE/CAEA. 6/6 verde.
- **Queda pendiente (no bloqueante):** la **lógica de llenado** de esos campos. Depende del certificado de homologación y, para el QR en comprobantes exentos, de A-11.c. Las columnas ya están listas para recibirlos.

### 8. ✅ RESUELTO 2026-09-03 — ADR-0025 diferido a F1+

- **Cómo se resolvió:** investigación en fuente normativa. La **RG 5762/2025 eliminó la clase de comprobante "M" entera** (01/12/2025) y aun así **el código interno siguió siendo `0051`** → ARCA cambia nombres, leyendas y condiciones, pero **preserva los códigos numéricos** por retrocompatibilidad. El riesgo que motivó el ADR ("drift cuando ARCA modifique códigos") es mucho menor al asumido.
- **Decisión:** F0 = hardcode en `afip-codes.ts` anclado por `tax_policy_version` (da la reproducibilidad histórica, que era el objetivo). F1+ = construir `catalogs/`, con la spec del ADR intacta. **Disparador:** ARCA agrega un código que necesitemos o modifica uno existente.
- **Actualizado en:** ADR-0025, DECISION-LEDGER, CLAUDE.md §3.1, DRIFT-REPORT (drifts 11 y 12 cerrados).
- **Queda pendiente — `S`, no diferible:** que `afip-codes.ts` documente en su encabezado que es una **fotografía versionada** de los catálogos, con el manual y la fecha de extracción, y que su fuente de verdad es `tax-policy-versions/`. Sin esa nota, el hardcode sí es deuda silenciosa.

### 9. Sincronizar CLAUDE.md · `S`

- §3.1: agregar ADR-0023/0024/0025 y corregir "22 vigentes" → **26**
- §3.1: ADR-0004 pasa de 🔴 a 🟡 (gana el Ledger)
- §23: sacar del mapa lo que no existe (`.claude/`, `components/atmospheres`, `components/charts`, `lib/workers/`, `docs/runbooks/`, `tests/e2e/`)
- §6.1: aclarar que Sentry está declarado pero no instalado
- EVENT-TAXONOMY §5: el header dice "~32", son **43**

---

## P3 — Deuda de calidad

| # | Ítem | Por qué | Tam |
|---|---|---|---|
| 10 | Tests para `product.service.ts` | 456 líneas, 0 tests, sin justificación documentada. El gap más grande. | `M` |
| 11 | Activar `noUncheckedIndexedAccess` | CLAUDE.md §6.1 lo exige. Va a romper compilación en varios lados — hacer y arreglar. | `M` |
| 12 | ~~Levantar Docker y correr integration + cross-tenant~~ | **Promovido a P0 #0** — es prerrequisito del #1, no deuda de calidad. | — |

---

## P4 — Producto

| # | Ítem | Nota | Tam |
|---|---|---|---|
| 13 | Portar 13 pantallas a React | Productos y Clientes primero (tienen research hecho y alimentan al POS) | `L` c/u |
| 14 | Modo oscuro en las 13 restantes | El mecanismo ya existe en 3 pantallas — es replicar, no diseñar | `M` |

### 15. ✅ HECHO 2026-09-03 — Modo consulta de precio en el POS (commit `95d9987`)

> Se implementó como **modo del POS**, no pantalla aparte (Tango lo tiene aparte): el cajero no debería perder de vista la venta en curso para contestar una pregunta de mostrador. Banda ámbar + botón de salida para que sea inconfundible. Los atajos quedaron dibujados (F2 / Esc). Verificado midiendo el DOM: tras consultar, el carrito sigue en 0 ítems.

<details><summary>Definición original (histórica)</summary>

#### Modo consulta de precio en el POS · `M`

- **Qué:** un modo donde el cajero escanea o tipea un código y ve **precio + stock** sin que el producto entre al carrito. Salida con `Esc`.
- **Por qué:** hueco real de todos los días. Hoy, si un cliente pregunta *"¿cuánto sale esto?"*, el cajero escanea y **se le agrega al carrito** — después tiene que borrarlo. Con cola de gente eso es fricción y fuente de errores.
- **Evidencia (no es corazonada):** Tango Facturador le dedica una pantalla entera con atajo propio (*Precios y saldos de stock*), fotografiada por el owner en un comercio real el 2026-09-03. Que el estándar del mercado la tenga aparte confirma que es un flujo diario, no un adorno.
- **Dónde:** `src/app/pos/POSClient.tsx` + `findProductByBarcode` de `src/lib/inventory/` (ya existe — no hay backend nuevo).
- **Qué mostrar:** nombre, código de barras, precio, stock con su unidad, y el chip `19.640` si el producto es `tdf_exempt`. Con la marca de exento visible, el cajero contesta bien una pregunta fiscal sin llamar al dueño.
- **Verificar:** escanear en modo consulta **no** crea `sale` ni `sale_items` — chequearlo en la base, no sólo en pantalla. `Esc` vuelve al POS con el carrito intacto.
- **En la misma pasada — atajos visibles:** dibujar la tecla sobre el botón (Tango pone un `F5` chiquito encima de "Precios"). CLAUDE.md §14.9 compromete keyboard-first pero hoy los atajos no se ven en ningún lado; que el cajero novato los aprenda solo es gratis. El CSS de la maqueta ya trae la clase `.kbd`.
- **Ojo:** el modo consulta tiene que ser **visualmente inconfundible** respecto del modo venta. Si el cajero no distingue en cuál está, el remedio es peor que la enfermedad.

> Origen, alternativas evaluadas y descartes en [backlog-validaciones.md](backlog-validaciones.md) §D.4.

</details>

---

## Bloqueado — no arrancar

| Ítem | Bloqueado por |
|---|---|
| Worker `afip.reconcile_pending` | A-2 (contadora) + B-6 (abogado) + certificado de homologación |
| Emisión fiscal productiva | Reunión con la contadora — nada sale a cliente real sin su OK |
| Notas de crédito | Es F1+ por decisión de scope |

### ✅ Gate del segundo comercio — CERRADO por construcción 2026-09-05 (`4c7586f`)

Estaba escrito acá como nota: *"antes de conectar el segundo comercio, implementar secret per-tenant"*. **Una nota no se ejecuta** — el momento en que importa es meses después, cuando alguien conecta el segundo comercio sin leer esta cola. Se convirtió en una restricción que corre.

- **El agujero:** `resolveMpWebhookSecret` ignoraba el `companyId` y devolvía el mismo secret global para cualquiera. Con 2+ comercios, una notificación legítima de MP **reenviada con otro `company_id` en la URL** pasa el HMAC y el cobro se acredita en el comercio equivocado. La validación de `T-MT-09` no cerraba esto: garantiza que el tenant exista, no que la notificación le corresponda.
- **El fix:** `MP_WEBHOOK_SECRET` ahora viene con `MP_WEBHOOK_SECRET_COMPANY_ID`, que declara de quién es. Cualquier otro `companyId` → `null` → 401. Secret sin dueño declarado → se rechaza todo (fail-closed). Test `T-SEC-09`.
- **Escala solo:** con el segundo comercio la variable ya no alcanza y hay que ir al vault. No queda margen para olvidarse — que era el problema de tenerlo escrito en una nota.
- **Se descartó** un guard que contaba filas en `companies`: la base de test tiene 7 y las demos suman, así que confundía fixtures con comercios reales. Un guard que se apaga de bronca es peor que no tenerlo.

**Sigue pendiente para el segundo comercio** (ahora sí sólo trabajo, no riesgo silencioso): secret per-tenant desde `security/vault.ts` + onboarding de MP por comercio.

---

## Reglas para quien tome esta cola

1. **Cero documentos de arquitectura nuevos.** El sistema ya tiene 26 ADRs y 12 docs de gobernanza. Si algo se arregla en 10 minutos, se arregla en vez de documentarse.
2. **Si un ADR y el código se contradicen, se resuelve — no se deja anotado.** Ese es el hábito que produjo las 10 contradicciones de severidad alta.
3. **Nada de estados intermedios visibles.** Portar entero y mostrar entero.
4. **Un test que no viste correr no está verde.**
