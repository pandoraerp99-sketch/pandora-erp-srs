# Inventario Real — Pandora ERP

**Fecha:** 2026-09-02
**Método:** 4 barridos paralelos (código / mockups / drift / tests) + verificación manual de los hallazgos de severidad alta.
**Qué es:** el mapa de lo que **existe de verdad** en el código. No es una spec, no es un plan. Si contradice a otro doc, este gana en materia de "qué hay".

---

## Números crudos

| Métrica | Valor |
|---|---|
| Archivos `.ts/.tsx` en `src/` | 134 (19.715 líneas) |
| Archivos de test | 83 (18.978 líneas) — 39 unit / 37 integration / 7 cross-tenant |
| Migraciones | 22 → 22 tablas |
| ADRs físicos en `files/` | 26 |
| Mockups HTML en `pos-preview/` | 82 → 16 pantallas únicas |
| **`pnpm build`** | ✅ **PASA** (exit 0, sin `.env.test`) |
| **Tests unitarios** | ✅ **748 / 748** |
| **Tests integration + cross-tenant** | ✅ **213 / 213** (44 archivos) |
| **Suite completa** | ✅ **961 tests en verde** |
| Cobertura (medida solo sobre unit) | 48,4% líneas · 47,6% funciones |

> ⚠️ **`pnpm test` NO corre la suite completa.** El script por defecto es `vitest run` y sólo toma los unitarios (39 archivos). Integración y cross-tenant necesitan `pnpm test:integration`, con otro config. Decir "748 verde" sin correr el segundo comando deja **44 archivos sin ejecutar** y da falsa sensación de cobertura.

> ⚠️ **Los 961 tests en verde NO detectaron D-23 ni D-25** (ver [DRIFT-REPORT.md](DRIFT-REPORT.md)). Hay un bypass cross-tenant **demostrado con una consulta real** sobre el `audit_log` y ocho tablas sin RLS, y toda la suite pasa igual. Los tests no están mal — simplemente no cubren esas tablas ni esos caminos de acceso. Es el mismo patrón que `COVERAGE-MATRIX.md:201` ya documentó una vez: *"el gap sistémico vivió silente desde Sprint 0"*.

---

## Rutas vivas de la app

| Ruta | Tipo | Auth | Estado |
|---|---|---|---|
| `/login` | React | — | Funcional |
| `/pos` | React | Sí | Funcional — cadena venta → cobro probada e2e |
| `/caja-real` | React | Sí | Funcional — abrir / alivios / cierre / reclassify (990 líneas) |
| `/api/webhooks/mp/[company_id]` | Route handler | HMAC | Funcional |
| `/api/internal/cron/mp-reconcile` | Cron | Interno | Funcional |
| `/` | Estática | — | Landing |
| `/caja` | **HTML estático** | Ninguna | Mockup servido por rewrite |
| `/panel` | **HTML estático** | Ninguna | Mockup servido por rewrite |

> `/caja` y `/panel` **no son React**. Están exentos del middleware de CSP y de auth.

---

## Pantallas: mockup vs código

16 pantallas diseñadas. **1 portada.**

| Pantalla | Mockup | React | Modo oscuro |
|---|---|---|---|
| POS | ✅ `checkpoint-v19-top-tools` | ✅ `/pos` | ❌ |
| Caja | ⚠️ **fork triple** | ⚠️ `/caja-real` (no es la ruta pública) | ✅ |
| Panel / Dashboard | ✅ `dashboard.html` | ⚠️ servido como HTML | ✅ |
| Clientes | ✅ | ❌ | ✅ |
| Productos | ✅ | ❌ | ❌ |
| Stock | ✅ | ❌ | ❌ |
| Facturas | ✅ | ❌ | ❌ |
| Reportes | ✅ | ❌ | ❌ |
| Ofertas | ✅ | ❌ | ❌ |
| Pedidos | ✅ | ❌ | ❌ |
| Señas | ✅ | ❌ | ❌ |
| Devoluciones | ✅ | ❌ | ❌ |
| Presupuestos | ✅ | ❌ | ❌ |
| Contador | ✅ | ❌ | ❌ |
| Integraciones | ✅ | ❌ | ❌ |
| Configuración | ✅ | ❌ | ❌ |

**Fork triple de Caja** — tres versiones divergentes:

1. `pos-preview/caja-editorial.html` — mockup canónico del SRS
2. `public/caja.html` — lo que sirve `/caja`. **No coincide con ningún archivo del SRS**; evolucionó solo en WSL y le agregaron modo oscuro que nunca volvió al SRS.
3. `src/app/caja-real/` — el React con toda la funcionalidad real

---

## Tablas y aislamiento multi-tenant

> ✅ **Verificado contra la base viva** (2026-09-02, Supabase local levantado) vía `pg_class.relrowsecurity` + `pg_policies`. No hay divergencia con los archivos de migración.

**14 tablas con row level security activo:** `audit_log`, `cash_withdrawal_reasons`, `companies`, `company_users`, `fiscal_snapshots`, `idempotency_log`, `invoice_sequences`, `padron_a5`, `products`, `sale_items`, `sales`, `terceros`, `users`, `wsaa_tokens`.

**8 tablas sin RLS y sin ninguna policy en las migraciones:**

`sale_payments` · `mp_payments` · `stock_movements` · `metrics_counter` · `cash_sessions` · `cash_movements` · `jobs_queue` · `processed_webhook_events`

**Más las 2 particiones de `audit_log`** (`audit_log_2026`, `audit_log_2027`): el padre tiene RLS y 2 policies, pero **las hijas están en `off` con cero policies**. Consultar la hija directamente devuelve el audit log completo de todos los comercios — demostrado, ver D-25.

Estas tablas dependen **exclusivamente** del filtro `tenant_id` escrito a mano en cada query. El propio `src/lib/fiscal/README.md:32` lo dice explícito: *"services usan filtros app-level, no `withRlsContext`"*.

El filtro existe hoy (verificado, ej. `src/lib/cash/queries.ts:93`). Pero **no hay red de contención**: si una query futura olvida el `.where(eq(tenant_id))`, nada lo detiene. Ver D-23 en [DRIFT-REPORT.md](DRIFT-REPORT.md).

---

## Módulos de `src/lib` sin conectar

**12 huérfanos** (~1.148 líneas, 7,8% de `src/lib`). Cinco son barrels `index.ts` sin consumidores — ruido inofensivo. Los otros siete están escritos y testeados pero **nadie los importa en producción**:

| Módulo | Qué hace | Exigido por |
|---|---|---|
| `multi_tenant/validation.ts` | `validateTenantAccess()` — 2ª capa de aislamiento | CLAUDE.md §7.2 |
| `security/rate-limit.ts` | Límite de requests por IP y tenant | CLAUDE.md §11.2 |
| `security/vault.ts` | Cifrado AES-256-GCM de secretos | CLAUDE.md §11.8 |
| `auth/supabase-browser.ts` | Cliente Supabase de browser | — |
| `integrations/afip/wsaa-client.ts` | Cliente WSAA | — |
| `money/format.ts` | Formateo monetario | — |
| `utils.ts` | `cn()` de shadcn (nunca usado) | — |

---

## Módulo fiscal: más construido de lo que se creía

**16 archivos** entre `src/lib/fiscal/` e `src/lib/integrations/afip/`:

`afip-codes.ts` · `emit-after-cobro.ts` · `emit-invoice.ts` · `fiscal-client-factory.ts` · `fiscal-db-guard.ts` · `invoice-type.ts` · `projection/wsfev1.ts` · `receptor.ts` · `wsaa-client.ts` · `wsaa-endpoints.ts` · `wsaa-tra.ts` · `wsfev1-client.ts` · `wsfev1-request.ts` · `wsfev1-response.ts` · `xml.ts`

No es solo el projection layer: el cliente SOAP de WSAA y WSFEv1 **ya está escrito**. Le falta conectarse, endurecerse (TLS, ver D-24) y el certificado de homologación.

---

## Módulos sin ningún test

`services/products/product.service.ts` (**456 líneas, 0 tests** — el gap más grande y el único sin justificación documentada) · `csv-import.ts` · `auth/supabase-browser.ts` · `auth/supabase-server.ts` · `fiscal/fiscal-client-factory.ts` · `integrations/mercadopago/mp-secret.ts` · `utils.ts` (trivial)

---

## Catálogo de tests obligatorios (CLAUDE.md §18.3)

**41 IDs: 23 completos · 6 parciales · 12 faltantes.**

De los 12 que faltan, **9 son del Reconciliation Engine** (`T-FISCAL-01..05` = 0/5, `T-REC` = 1/7). No es deuda oculta: faltan porque el worker `afip.reconcile_pending` no existe, y está documentado como diferido.

Los otros 3:

| ID | Estado |
|---|---|
| `T-MT-06` (Realtime broadcast) | Infra no implementada — justificado |
| `T-MONEY-03` (precio cliente vs server) | Requiere UI que no existe en F0 — justificado |
| **`T-SEC-06` (TLS 1.2+ en cliente AFIP)** | ⚠️ **Gap real de código.** El cliente ya existe, la config TLS no. |

Además hay decenas de tests con IDs `T-CASH-*`, `T-INV-*`, `T-SALES-*`, `T-MP-*` que no figuran en §18.3 — están documentados en ROADMAP y COVERAGE-MATRIX. Es deuda documental, no un problema.
