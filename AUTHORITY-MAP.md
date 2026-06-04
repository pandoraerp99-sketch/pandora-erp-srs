# Authority Map — Pandora ERP

**Última actualización:** 2026-05-27
**Propósito:** definir quién es autoridad final para cada recurso o estado del sistema. Donde hay ambigüedad, documentarla explícitamente para que no se resuelva por improvisación bajo presión.

> Cada vez que aparece un conflicto de autoridad en producción (ej: cliente y server discrepan en un monto), consultar esta tabla. Si la respuesta no está acá, agregarla con justificación.

---

## Por qué este documento existe

En la auditoría del 2026-05-26 se detectaron **4 conflictos de autoridad reales** sin formalizar:

1. Money preview cliente vs cálculo server
2. Permisos cache cliente vs server fresh
3. Activación de modo contingencia AFIP (cliente vs server)
4. Reconciliation completion (cómo el cliente sabe que se completó)

Sin authority map, cada uno de estos casos se va a resolver de manera distinta por developer/fecha. Eso genera bugs sutiles imposibles de diagnosticar.

---

## Tabla maestra de autoridades

| Recurso / Estado | Autoridad final | Quién PUEDE leer | Quién PUEDE escribir | Ambigüedad detectada / Resolución |
|---|---|---|---|---|
| **Money** (totales, IVA, descuentos) | Server (recalcula contra DB siempre) | Cliente (preview) + Server | Solo Server | Cliente muestra preview con string Decimal; server recalcula desde precios DB. Si discrepan > $0.01 → server gana + log `price_tampering_attempt`. |
| **Política de redondeo fiscal** | Server (env `MONEY_ROUNDING_POLICY`) | Cliente vía Context inyectado | Solo deploy de infraestructura | Cliente NO lee env directo. Solo recibe policy via React Context server-poblado. |
| **Permisos del usuario** | Server (RLS Postgres + Service validation) | Cliente (cache UX only) + Server | Solo Server (mutation con audit) | Cache cliente puede mentir hasta 5 min. **Server SIEMPRE revalida en cada Server Action.** Cache cliente es solo para esconder/mostrar botones, NUNCA para autorizar operaciones. |
| **Stock disponible** | Server (con SELECT FOR UPDATE en mutation) | Cliente (vista) + Server | Solo Server | Cliente puede mostrar stock = 5 mientras otro POS lo agotó. Server hace lock pesimista en venta y rechaza si stock < cantidad. UX: error claro "alguien acaba de tomar el último, refrescá". |
| **CAE de factura** | AFIP (única autoridad fiscal) | Server (consulta + cache) | AFIP (vía WSFEv1) — sistema persiste lo recibido | Server NUNCA "inventa" CAE. Si AFIP timeout, estado = `requires_reconciliation`, worker reintenta. Si AFIP rechaza, número quemado y se documenta. |
| **Número de factura correlativo** | DB `invoice_sequences` (SELECT FOR UPDATE) | Server | Solo Server (transacción serializable) | Lock pesimista por (sale_point, invoice_type). Concurrencia bloqueada por isolation serializable + retry ADR-0011. |
| **Estado conectividad del cliente** | Cliente (browser via `navigator.onLine` + Realtime status) | Cliente | Cliente (no se reporta al server F0) | Cliente decide su propio status. Server NO recibe ping de connectivity F0. F1+ podría agregar heartbeat reverso. |
| **Modo contingencia AFIP** | Server (decide tras timeout 30s o error explícito) | Cliente + Server | Solo Server | Cliente NO decide pasar a contingencia. Server marca `fiscal_status = 'contingency'` o `requires_reconciliation` cuando WSFEv1 falla. Cliente solo refleja el estado server. |
| **Reconciliation completion** | Worker async (después de obtener CAE post-timeout) | Cliente (via Realtime push) + Server | Solo Worker | Worker actualiza `fiscal_status = 'reconciled_issued'` cuando obtiene CAE. Cliente recibe notification via Supabase Realtime broadcast. Si Realtime falla, cliente no se entera hasta refresh. |
| **Session state (turno caja)** | Server (`cash_sessions` table) | Cliente + Server | Solo Server | Cliente NO mantiene estado de turno propio. Cada operación POS valida con server "¿hay turno abierto para este cajero?". |
| **Pricing del producto** | Server (catálogo DB) | Cliente (snapshot al cargar) + Server | Solo Server | Cliente carga precios al abrir POS. Si owner cambia precio mientras hay POS abierto, cliente queda con precio viejo hasta refresh. Server SIEMPRE recalcula contra precio actual al guardar venta. |
| **Customer snapshot en factura** | Server (captura en momento de emisión) | Cliente (lectura) + Server | Solo Server (immutable post-emisión) | Snapshot es inmutable. Si cliente actualiza datos después de factura emitida, factura vieja mantiene snapshot original. Coherente con Sesión 5 v4 cambio #3. |
| **Condición IVA del comerciante** | AFIP (Padrón A5) + DB local (cache + sync) | Cliente + Server | Solo Server (sync con padrón) | Si flag `requires_fiscal_revalidation = true` en companies, bloquear emisión hasta revalidar contra AFIP. Sesión 5 v4 cambio #5. Padrón A13 (monotributo) NO F0 — trigger: primer tenant Monotributo que requiera lookup específico. |
| **Cuotas de subscription SaaS** | Server (estado de pago vía MercadoPago) | Cliente (vista) + Server | Solo Server (vía webhook MP) | Cliente no decide su propio estado de pago. Server actualiza por webhook validado con HMAC (ADR-0019 S3). |
| **Estados del demo lifecycle** | Server (cron `cron.archive_expired_demos` — EVENT-TAXONOMY §6) | Cliente (vista) + Server | Solo Server (transiciones automáticas) | Cliente NO puede extender su propio demo. Solo el cron transiciona estados. Activación de AFIP es lo único que cambia el estado desde el cliente. ADR-0020. |
| **Audit log entries** | Server (append-only) | Auditoría (con permisos) + Server (write) | Solo Server, dentro de transacción de mutation. Nunca UPDATE/DELETE. Cleanup vía DROP PARTITION anual con retención 10 años (Ley 11.683). ADR-0010 + 04-observability rule + CLAUDE.md §16.4. |
| **Idempotency keys** | Server (`idempotency_log` con UNIQUE) | Server | Solo Server (INSERT once) | Cliente genera UUID. Server registra y devuelve resultado. Si key duplicada → devuelve resultado cacheado. ADR-0010. |

---

## Reglas absolutas de authority

### R1 — Cliente NUNCA es autoridad fiscal

Cualquier cálculo monetario, total, IVA, descuento, precio que llegue al cliente es **informativo**. El server es la única autoridad. Anti price-tampering del ADR-0019 S4.

### R2 — Permisos cache cliente es SOLO para UX

Esconder/mostrar botones. Nunca para autorizar operación. Cada Server Action revalida server-side contra DB.

### R3 — AFIP es la única autoridad fiscal externa

Pandora NUNCA "decide" que una factura es válida. Solo registra lo que AFIP responde:
- CAE OK → factura emitida
- AFIP rechaza → número quemado
- AFIP timeout → estado intermedio + worker reconcilia

### R4 — Connectivity es decisión local del cliente

Server NO valida si "el cliente está realmente conectado". Cliente lo dice y server confía. Si cliente miente, el peor caso es que server reciba request y responda lento — no es problema de seguridad.

### R5 — Customer snapshot es inmutable post-emisión

Una vez que se emitió factura con un snapshot del cliente, ese snapshot NO se modifica nunca. Ni siquiera por el propio cliente al actualizar sus datos. Esto es por exigencia AFIP (datos al momento de emisión) y por inmutabilidad de audit log.

### R6 — Stock es eventual desde el cliente

Cliente muestra stock con eventual consistency. Server tiene la verdad y rechaza venta si stock < cantidad solicitada en el momento de la transacción. Cliente NUNCA decide "tengo stock suficiente".

### R7 — Numeración fiscal es server con lock pesimista

DB `invoice_sequences` + SELECT FOR UPDATE + transacción serializable. Cliente NO genera números. Cliente solo recibe el número asignado tras commit exitoso.

---

## Conflictos pendientes de resolver (con plan de acción)

### ~~Conflict #1 — Reconciliation completion notification al cliente~~ ✅ CERRADO 2026-05-27 (Sesión 3)

**Resolución final:** opción (a) + (c) confirmadas en RECONCILIATION-ENGINE.md sección 10. Worker publica `realtime_broadcast` con `correlation_id` en payload. Cliente filtra por su `correlation_id` activo (CORRELATION-PROPAGATION.md). Si Realtime falla o cliente cerró browser → recovery al reabrir POS via fetch de `sales` con `correlation_id` desde `sessionStorage` o post-cierre desde server. Polling (b) descartado.

### Conflict #2 — Activación de contingencia: server vs cliente

**Problema:** server timeout 30s vs cliente offline detection. ¿Qué pasa si el cliente cree que está offline pero el server logra respuesta a AFIP?

**Resolución:** **server gana siempre**. Cliente puede mostrar "intentando" pero no decide el estado fiscal. Si cliente está offline, no llega la mutation al server, no se intenta nada. Si cliente está online y la mutation llega, server decide.

### Conflict #3 — Precio cambia mientras hay POS abierto

**Problema:** cajero abre POS con precios snapshot. Owner sube precio mientras cajero arma carrito. ¿Qué pasa al cobrar?

**Resolución propuesta F0:** server recalcula con precio actual al guardar. Si difiere del cliente, UX muestra warning "los precios cambiaron, revisá" y exige reconfirmación. **Pendiente UX detallada en F0.2.**

### Conflict #4 — Permisos cambia mientras usuario logueado

**Problema:** owner reduce permisos de un cajero. Cache cliente puede tardar hasta 5 min en invalidarse.

**Resolución:** cache cliente es solo UX. Cada Server Action revalida. Peor caso: cajero ve botón habilitado por 5 min, hace click, server responde 403. UX: mensaje "tus permisos cambiaron, recarga".

---

## Cómo agregar una nueva autoridad

1. Identificar el recurso / estado en disputa.
2. Decidir la autoridad final (default: el componente que tiene la fuente de verdad persistente).
3. Documentar lectores y escritores.
4. Si hay ambigüedad, listar el plan de resolución.
5. Agregar fila a la tabla maestra arriba.
6. Si el cambio reemplaza decisión previa, mencionarlo en "Conflictos resueltos" abajo.

---

## Autoridades agregadas en investigación oficial AFIP 2026-05-26 noche

| Recurso / Estado | Autoridad final | Quién PUEDE leer | Quién PUEDE escribir | Ambigüedad / Resolución |
|---|---|---|---|---|
| **Modo de redondeo (HALF_EVEN)** | AFIP (manuales oficiales) | Server + Cliente vía Context | Solo deploy infra | ✅ CERRADO. AFIP usa HALF_EVEN, Pandora también. Configurable solo para test. |
| **Stage de redondeo (PER_LINE)** | ERP interno (decisión técnica) | Server + Cliente | Solo deploy infra | ✅ PROPUESTO. Validar con tests WSFE homologación. |
| **Shape de payload WSFEv1** | `fiscal/projection/wsfev1.ts` único módulo | Server | Solo Server (dentro del módulo de proyección) | Resto del sistema NO conoce shape WSFEv1. Cambio de WS = solo nuevo archivo en `projection/`. |
| **Invariante `ImpIVA == sum(Iva[].Importe)`** | AFIP (validación WS) | Server | Solo proyector lo enforce | Tolerancia 0. Test obligatorio antes de enviar. Si falla → bug del proyector. |
| **Versión activa del calculation engine** | Code registry F0 (`v1.0.0` único) | Server | Bump de versión = nuevo release | F1+ múltiples versiones cargadas para reproducir histórico. |
| **Tax policy version persistida por factura** | `fiscal_snapshots.tax_policy_version` | Server | Solo Server (al crear factura) | Inmutable post-emisión. Reproducible histórico. |
| **Reproducibilidad de factura histórica** | `fiscal_snapshots` + engine registry | Server | NUNCA (snapshot inmutable) | Test mensual F1+: tomar muestra de facturas y verificar `reproduceInvoice(id)` da idéntico. |
| **Jurisdicción del comerciante** | `fiscal_snapshots.jurisdiction_context` (province + special_regime) | Server | Solo Server (al crear factura) | **F0 target real = TIERRA_DEL_FUEGO** (retail fueguino). Schema enum prepara CABA, BUENOS_AIRES, OTRAS_PROVINCIAS_F2+ pero NO usados F0. `special_regime: 'LEY_19640' \| null`. Otras jurisdicciones AR F2+ con trigger primer cliente. |
| **Aplicabilidad exención Ley 19.640 a un producto** | Comerciante (via flag `products.tdf_exempt`) con asesoría de su contador | Server (lectura) | Solo Server (set al cargar/editar producto en catálogo) | Default conservador `false` (paga IVA). Pandora provee el flag, NO decide qué productos están amparados. Cada comercio define con su contador. |
| **Aplicación efectiva de exención en transacción** | `projectToFiscalBreakdown()` función pura | Server | Computed at emission, persistido inmutable | Si `merchant_special_regime === 'LEY_19640'` Y `transaction_in_special_zone === true` Y `product.tdf_exempt === true` → exento. Cualquier otra combinación → tratamiento estándar. |
| **`FiscalBreakdown` mostrado en ticket** | `fiscal_snapshots.fiscal_breakdown` (inmutable) | Cliente (impresión) + Server | Solo Server (al emitir) | El ticket impreso NUNCA recalcula. Lee del snapshot. Si cambia normativa después, snapshots viejos mantienen lo que se imprimió. |
| **Tolerancia en reconciliación MP/banco** | `withinTolerance()` con scope por caller | Server | Solo Server (path reconciliación) | NUNCA en path fiscal. Default ±$0.50 configurable. |

## Autoridades agregadas en auditoría 2026-05-26 PM

| Recurso / Estado | Autoridad final | Quién PUEDE leer | Quién PUEDE escribir | Ambigüedad / Resolución |
|---|---|---|---|---|
| **Stage de redondeo** (per-line vs per-bracket) | Contador matriculado (decisión externa) | Server + Cliente vía Context | Solo deploy de infraestructura | Decisión 🟡 abierta. Una vez cerrada, env var `MONEY_ROUNDING_STAGE` con fail-fast paralelo a `MONEY_ROUNDING_POLICY`. |
| **Versión activa de encryption key** | Server (env `SECRETS_ENCRYPTION_KEY_ACTIVE_VERSION`) | Server | Solo deploy de infraestructura | Cliente NUNCA accede a keys. Versioning permite rotation sin perder histórico. |
| **Validez temporal de webhook entrante** | Server (timestamp window ±5min + event ID dedup) | Server | Solo Server (write a `processed_webhook_events`) | Webhook con timestamp fuera de ventana O event ID repetido → rechazo. Métrica `webhook_replay_detected`. |
| **Sesión activa del usuario** | Server (`active_sessions` table + JWT TTL) | Server + Cliente (su propia sesión) | Solo Server | Idle 30min / absolute 12h. Rotation al cambiar password/rol. Revocación admin posible. |
| **Vigencia de la sesión en cliente** | Cliente reporta actividad → Server valida y refresca o invalida | Cliente + Server | Cliente (heartbeat) + Server (validación) | Cliente reporta actividad. Server decide si renueva token o exige re-auth. |
| **`pii_level` operacional vs categoría legal AAIP** | Operacional: este ADR. Legal: abogado AAIP (pendiente) | Server | Solo deploy de infraestructura | Operacional para retention/acceso. Legal para compliance Ley 25.326. **El mapping legal exacto NO está cerrado.** |

## Autoridades agregadas en Sesión 3 — RECONCILIATION-ENGINE (2026-05-27 PM)

| Recurso / Estado | Autoridad final | Quién PUEDE leer | Quién PUEDE escribir | Ambigüedad / Resolución |
|---|---|---|---|---|
| **Transiciones de `fiscal_status`** | Worker `afip-reconcile-pending` (y handlers de emisión inicial) | Cliente (vía Realtime + lectura) + Server | Solo Worker / Service de emisión, dentro de tx con audit_log | Cliente NUNCA escribe fiscal_status. Operator manual sí (via Server Action con audit explícito) en `manual_resolution_required`. Grafo de transiciones explícito en RECONCILIATION-ENGINE.md §2. |
| **CAE recuperado post-timeout (validez)** | `validateRecoveredCae()` función pura | Server | Solo Worker (path recovery) | Match obligatorio en ImpTotal + DocTipo + DocNro contra `sales` original. Mismatch → NO acepta, escala a `manual_resolution_required`. NUNCA "asumir que es nuestro" si AFIP tiene un número con datos distintos. |
| **Discard de un job de jobs_queue** | Operator manual con audit | Server | Operator (via Server Action con razón obligatoria + audit_log) | NUNCA automático. Tras MAX_ATTEMPTS=24 → `manual_resolution_required`, alerta. Operator decide re-enqueue / discard / resolve manual. Dead letter philosophy de RECONCILIATION-ENGINE.md §6. |
| **Clasificación de un evento como poison** | Worker en primer attempt | Server | Solo Worker (path `processJobWithPoisonDetection()`) | Payload corrupto / job_type desconocido / shape inválido detectado en attempt #1 → aislamiento inmediato. NO esperar 5 reintentos. Métrica `reconciliation.poison_jobs_detected`. |
| **Requerimiento de resolución manual** | Worker | Server + Operator | Solo Worker (vía transition a `manual_resolution_required`) | Triggers: (a) MAX_ATTEMPTS agotado, (b) validateRecoveredCae mismatch, (c) AFIP `failed` explícito, (d) poison detection. Emite `fiscal.manual_required` event canónico. |
| **Retry budget de un job** | Configuración hardcoded F0 (MAX_ATTEMPTS=24, intervalo 5min) | Server | Cambio = bump de versión + ADR | Calibrado para AFIP: ventana 2h cubre downtime típico. NO exponencial (AFIP no nos rate-limita). F1+ podría volverse per-job-type. |
| **AFIP `failed` (rechazo explícito) — retry?** | NO retry automático nunca | Server | NO escribir intento de retry | Distingue transient (timeout, 5xx) de permanent (rechazo de AFIP por datos inválidos). Permanent = bug nuestro → fix → re-emitir manual con número quemado documentado. RECONCILIATION-ENGINE.md §5. |
| **Idempotencia del worker** | `sales.fiscal_status` lectura ANTES de actuar | Server | Worker compara, no escribe si terminal | Reintento N veces = mismo resultado. Si ya `issued`/`reconciled_issued`/`rejected_final` → exit sin tocar. |
| **Audit trail de decisión del worker** | `audit_log` con event_name canónico EVENT-TAXONOMY.md | Auditoría + Server | Solo Worker (INSERT-only en tx de la decisión) | Eventos: `fiscal.reconciliation_started`, `fiscal.cae_recovered`, `fiscal.cae_recovery_mismatch`, `fiscal.reconciliation_timeout`, `fiscal.manual_required`. Toda decisión del worker queda investigable. |
| **Realtime broadcast filtering** | Cliente (por `correlation_id` activo) | Cliente + Server | Worker publica, cliente filtra | Worker emite a canal del tenant. Cliente recibe TODOS los broadcasts del tenant pero ignora los que no coinciden con su `correlation_id` activo (CORRELATION-PROPAGATION.md). |
| **Operator queries Q1-Q4** | SQL directo F0 | Operator técnico (Pandora team) | Read-only | F0: SQL en consola. F0.5: dashboard. F1+: UI completa con botones de acción. Queries canónicas Q1 (active reconciliations), Q2 (dead jobs > 24h), Q3 (poison events), Q4 (recovery investigation por correlation_id). |
| **Reconciliation outcome (final classification)** | Worker | Métricas + audit_log | Solo Worker | Una de 5 categorías acotadas: `cae_received`, `cae_recovered`, `reconciliation_timeout`, `manual_required`, `rejected`. Whitelist `reconciliation.outcome` enforced. |

## Conflictos resueltos (histórico)

| Fecha | Conflict | Resolución |
|---|---|---|
| 2026-05-26 | Money policy: cliente o server lee env | Server lee env, cliente recibe via Context (ADR-0021) |
| 2026-05-26 | LRU permisos: server o cliente | Cliente-only F0 (deferred completamente F1+) (ADR-0021 apéndice) |
| 2026-05-26 | Connectivity: heartbeat o eventos | Eventos simples F0 (`online`/`offline`). Heartbeat F1+ si justifica (ADR-0021 apéndice D4) |
| 2026-05-26 PM | Stage de redondeo: per-line vs per-total | Decisión 🟡 abierta, mismo proceso que `MONEY_ROUNDING_POLICY` con env var paralela (ADR-0005) |
| 2026-05-26 PM | Replay de webhooks: ¿solo HMAC alcanza? | NO. HMAC + timestamp window + event ID dedup (ADR-0019 S3-bis) |
| 2026-05-26 PM | Encryption key única vs versionada | Versionada desde día 1 con `SECRETS_ENCRYPTION_KEY_V*` + `ACTIVE_VERSION` (ADR-0019 S5-bis) |
| 2026-05-26 PM | Audit log es tamper-proof | NO en F0. Es append-only solo. WORM real F1+. Limitación declarada explícitamente (ADR-0019 S6 caveat) |
| 2026-05-26 noche | ¿AFIP exige modo de rounding? | SÍ: HALF_EVEN. Confirmado por 3 manuales oficiales. Cerrado ADR-0005 Dimensión 1. |
| 2026-05-26 noche | ¿WSFEv1 acepta detalle ítem o solo agregado? | Solo agregado. Por eso existe Fiscal Projection Layer (ADR-0022). |
| 2026-05-26 noche | ¿Cómo se reproduce una factura histórica si cambia el código? | Persistir `fiscal_snapshot` completo + mantener versiones de engine en registry (ADR-0022). |
| 2026-05-26 noche | ¿Tolerance aplica a WSFEv1? | NO al `ImpIVA`. SÍ a reconciliación interna (MP, banco). Ámbito definido en ADR-0022. |
| 2026-05-26 noche | ~~¿TDF aplica a F0?~~ | ~~NO. Target inicial CABA + GBA. Backlog F2+ explícito.~~ **REEMPLAZADO 2026-05-27** por entry abajo: TDF ES target F0 REAL (retail fueguino). |
| 2026-05-26 madrugada | ¿Bypass de TLS validation permitido? | NUNCA. Pattern muy común en industria, prohibido explícitamente en ADR-0019 S15. |
| 2026-05-26 madrugada | ¿Cert homo puede llegar a endpoint prod? | NO. Validación en código + audit. ADR-0019 S13. |
| 2026-05-26 madrugada | Si integridad fiscal incierta, ¿emitir igual? | NO. Fail-closed obligatorio. ADR-0022 sección "Fail-Closed Fiscal Semantics". |
| 2026-05-26 madrugada | ¿WSAA token puede loggearse para debugging? | NUNCA. Lista canónica en DIFFS-TO-APPLY → Rule 04. |
| 2026-05-26 madrugada | ¿Bug que emite 10k facturas en 5min se detiene solo? | SÍ — circuit breakers fiscales (CB1 rate limit + CB2 anomaly + CB3 emergency stop). ADR-0022. |
| 2026-05-27 | ¿TDF es target F0 o F2+? | F0 REAL. Retail pequeño fueguino (kioscos, ferreterías). Refactor scope acotado aplicado. ADR-0022 actualizado. |
| 2026-05-27 | ¿Quién decide qué productos están amparados Ley 19.640? | NO Pandora. NO un engine. El comerciante con su contador define vía flag `products.tdf_exempt`. Default conservador `false`. |
| 2026-05-27 | ¿Cómo se asegura que el ticket impreso refleje exactamente la regulación al momento de emitir? | `fiscal_breakdown` persistido inmutable en `fiscal_snapshots` + impresión lee de allí (NUNCA recalcula). |
| 2026-05-27 | ¿WSFEv1 alcanza para TDF retail? | HIPÓTESIS sí (operaciones exentas vía `ImpOpEx` del header). **Confirmar con contador TDF antes de homologación productiva.** |
| 2026-05-27 | ~~¿Cómo se publican eventos del sistema?~~ | ~~Outbox pattern. Insert en outbox_events en misma tx. Worker procesa con SKIP LOCKED + retry exponencial + dead letter.~~ **REEMPLAZADO 2026-05-27 PM** (ver fila "¿Outbox pattern + worker poller F0?" abajo): outbox dedicado NO F0; audit_log directo en tx. EVENT-TAXONOMY v2.0.1. |
| 2026-05-27 | ¿Quién decide qué eventos existen? | EVENT-TAXONOMY.md es el catálogo canónico. Agregar/cambiar requiere PR + bump versión. |
| 2026-05-27 | ~~¿Audit log y eventos son sistemas separados?~~ | ~~Dual persistence deliberada. outbox_events para procesamiento + retention configurable. audit_log para compliance + 10 años. Linked vía event_id FK.~~ **REEMPLAZADO 2026-05-27 PM:** sin outbox F0. `audit_log` (compliance + 10 años Ley 11.683) + `jobs_queue` (tareas async) + `metrics_counter` (observability) + Pino logs (debugging) = 4 concerns separados (EVENT-TAXONOMY v2.0.1 §5-§7). |
| 2026-05-27 | ¿Severity de un evento puede cambiar post-release? | NO. severity + retention son contrato. Cambiarlos = bump MAJOR del catálogo. |
| 2026-05-27 PM | ¿4 concerns en una sola tabla o separados? | **SEPARADOS.** audit_log (compliance) + jobs_queue (async tasks) + metrics_counter (counts) + Pino logs (debugging). Cada uno con lifecycle/retention/consumer propio. |
| 2026-05-27 PM | ¿Outbox pattern + worker poller F0? | **NO F0.** Audit_log directo en tx de la mutación. Outbox dedicado solo cuando aparezca primer caso real de integración externa reactiva (F1+). |
| 2026-05-27 PM | ¿Quién decide qué va a audit_log vs Pino logs vs metrics? | Test §1 de EVENT-TAXONOMY.md: "¿auditor querría saberlo 6 meses después?". Sí → audit_log. No → Pino o métrica. |
| 2026-05-27 PM | ¿`audit_log` permite UPDATE de algún campo? | NO. Strict INSERT-only. Trigger throw en cualquier UPDATE/DELETE. Excepción: cleanup mensual con audit propio. |
| 2026-05-27 PM | ¿Worker procesa jobs_queue con SKIP LOCKED? | SÍ. Garantía: cero double-processing entre workers concurrentes. |
| 2026-05-27 PM | ¿Cómo se hace cleanup de audit_log respetando trigger inmutable? | **Partitioning por año + DROP PARTITION** (DDL, no triggera BEFORE DELETE). NUNCA DROP TRIGGER temporal. Cron crea/drops particiones con verificación. |
| 2026-05-27 PM | ¿`tenant_id` en metrics_counter es nullable? | NO. Usar `SYSTEM_TENANT_ID = '00000000-...'` constante para system-wide. PK natural sin COALESCE. |
| 2026-05-27 PM | ¿Quién puede agregar `job_type` nuevo a jobs_queue? | Catálogo CERRADO. PR explícito + worker dedicado + aprobación owner técnico. `JOB_TYPES` const en código valida runtime. |
| 2026-05-27 PM | ¿Hay handler genérico de jobs que despache por tipo? | NO. Cada `job_type` tiene worker dedicado en su propio archivo. Esa regla previene drift a event bus encubierto. |
| 2026-05-27 PM | ¿Quién valida que métricas no exploten en cardinalidad? | `METRIC_WHITELIST` en código TS. Función `incrementCounter()` valida `tag_key` permitido + `tag_value` en lista bounded. Cron mensual monitorea cardinality drift. |
| 2026-05-27 PM | ¿`correlation_id` en jobs_queue es para state ownership o trazabilidad? | **Trazabilidad operativa SÍ** (correlacionar logs/audit/jobs/métricas para investigación + operator tooling). **State ownership NO** (el estado de la operación vive en tablas de negocio autoritativas — sales.fiscal_status, invoices.cae, etc., NUNCA derivado de la secuencia de jobs). EVENT-TAXONOMY.md Regla J5. |
| 2026-05-27 PM | ¿Quién genera `correlation_id`? | Cliente al iniciar operación lógica. Middleware Next.js si la request entra sin header. Cron al crear job sin operación previa. NUNCA un layer intermedio genera nuevo si ya tiene uno activo (anti-pattern). |
| 2026-05-27 PM | ¿Quién genera `request_id`? | Middleware Next.js SIEMPRE por cada HTTP request. Workers generan nuevo `request_id` al procesar job (cada procesamiento de job es nueva "request lógica"). |
| 2026-05-27 PM | ¿Cómo se propaga correlation_id entre Edge Runtime y Node Runtime? | Edge: headers HTTP (`x-correlation-id`, `x-request-id`). Node: AsyncLocalStorage (`src/lib/tracing/context.ts`). Bridge: `withServerActionTracing()` lee headers + monta AsyncLocalStorage. |
| 2026-05-27 PM | ¿Quién valida que todo log tiene correlation_id? | Pino logger es Proxy que auto-inyecta desde AsyncLocalStorage. Si no hay context activo → log sin correlation_id (válido para boot logs pre-context). |
| 2026-05-27 PM | ¿En qué entidades se persiste correlation_id? | Audit_log SIEMPRE. Jobs_queue SIEMPRE. `sales` SÍ (operación crítica multi-step). `invoices` SÍ (investigación fiscal). Productos/cart NO. Criterio: solo si vale para investigación posterior. |
| 2026-05-27 PM | ¿Realtime broadcasts incluyen correlation_id? | SÍ, en payload. Cliente filtra broadcasts por su `correlation_id` activo. Helper `publishRealtimeEvent()` lo inyecta desde context. |
| 2026-05-27 PM (endurecimiento) | ¿Cliente persiste correlation_id post-reload? | SÍ vía `sessionStorage` (sobrevive reload, NO sobrevive cierre tab). Hook `useOperationCorrelationId(operationKey)`. Cierre tab → recovery desde server (`sales.correlation_id` u otra entidad). localStorage RECHAZADO. |
| 2026-05-27 PM (endurecimiento) | ¿Cliente es source of truth de correlation_id? | NO post-cierre. Cliente lo mantiene durante sesión browser. Si necesita continuidad post-cierre, viene del server. |
| 2026-05-27 PM (endurecimiento) | ¿`request_id` siempre NOT NULL en audit_log? | SÍ. Workers/crons generan propio por cada attempt. Schema invariante. Sin caso F0 donde sea nullable. |
| 2026-05-27 PM (endurecimiento) | ¿`jobs_queue.last_request_id` existe? | SÍ (nullable hasta primer attempt). Worker actualiza al empezar cada attempt → permite query "investigar attempt #3 de este job". |
| 2026-05-27 PM (endurecimiento) | ¿Cliente DEBE enviar `x-correlation-id`? | SÍ por default. Excepciones: lista CERRADA de paths (`/api/webhooks/`, `/api/health`, `/api/internal/cron/`, `/api/public/`). Caso no documentado → warning log + investigación (no error fatal). |
| 2026-05-27 PM (precisión final) | ¿`request_id` es para trazabilidad o state ownership? | **Trazabilidad de attempt SÍ** (investigar request HTTP o attempt de worker específico, agrupar logs por attempt). **State ownership NO** (autoridad de recovery sigue siendo `sales.correlation_id` + `jobs_queue.last_request_id` informativo + tabla autoritativa de la entidad). Paralelo a Regla J5 de EVENT-TAXONOMY. |
| 2026-05-27 PM (Sesión 3) | ¿Reconciliation completion notification al cliente? | Realtime broadcast con `correlation_id` en payload + fallback recovery al reabrir POS via fetch de `sales.correlation_id` desde sessionStorage o server. Polling descartado. |
| 2026-05-27 PM (Sesión 3) | ¿Worker discarda jobs automáticamente tras N retries? | NO. Tras MAX_ATTEMPTS=24 → `manual_resolution_required` + alerta operator. Operator decide. Mejor reconciliación tardía que decisión apresurada. |
| 2026-05-27 PM (Sesión 3) | ¿Recovered CAE post-timeout se acepta confiando en AFIP? | NO sin validación. `validateRecoveredCae()` exige match ImpTotal + DocTipo + DocNro. Mismatch → manual. |
| 2026-05-27 PM (Sesión 3) | ¿Cuándo se detecta un poison event? | En primer attempt si payload corrupto / job_type desconocido / shape inválido. NUNCA esperar 5 reintentos para aislar. |
| 2026-05-27 PM (Sesión 3) | ¿AFIP `failed` explícito se reintenta? | NO. Distingue transient de permanent. Permanent = bug → fix → re-emitir manual. |
| 2026-05-27 PM (Sesión 3) | ¿Backoff exponencial para reintentar AFIP? | NO. Lineal 5min × 24 = 2h. AFIP no nos rate-limita; ventana corta y abundante es óptima. |
| 2026-05-27 PM (Sesión 3) | ¿Operator tooling F0 es UI completa o SQL? | SQL queries Q1-Q4 documentadas. UI dashboard diferido F0.5/F1+. |

## Autoridades agregadas en bloque ADRs estratégicos 2026-06-02 (ADR-0023 / 0024 / 0025)

> Verificadas contra fuentes oficiales (Boletín Oficial + WSDL WSFEv1) durante research 2026-06-02. Detalle en [[research-fuentes-oficiales-adr-0023-2026-06-02]] y [[mini-auditoria-coherencia-adrs-0023-0025-2026-06-03]].

| Recurso / Estado | Autoridad final | Quién PUEDE leer | Quién PUEDE escribir | Ambigüedad / Resolución |
|---|---|---|---|---|
| **Códigos de los 12 catálogos `FEParam*`** (CondicionIvaReceptor, TiposCbte, TiposDoc, TiposIva, TiposConcepto, TiposMonedas, Cotizacion, TiposTributos, TiposPaises, TiposOpcional, PtosVenta, Actividades) | ARCA WSFEv1 runtime — fuente oficial via método `FEParamGet*` correspondiente | Server (cache in-memory por catálogo) | Solo cron `catalog-refresh` daily + boot validation. Cliente NUNCA. | ADR-0025: lista de 12 catálogos verificada contra [WSDL oficial](https://servicios1.afip.gov.ar/wsfev1/service.asmx?WSDL). Pandora NUNCA hardcodea códigos regulatorios. 7 F0 críticos + 2 F0 condicional + 3 F1+. |
| **`catalog_version_at_emission` de cada valor de catálogo usado** | `fiscal_snapshots` (jsonb `{fetched_from_arca_at, hash, size}`) | Server | Solo Server al emitir (snapshot inmutable post-creación) | Triada derivable determinísticamente desde la respuesta ARCA. NO depende de campo "version" del WS (no garantizado). |
| **Decisión "cache stale > 7 días → fail-closed"** | Cron `catalog-refresh` + módulo fiscal boot | Server | Solo cron / boot (con audit `system.catalog.degraded_fail_closed` cuando dispara) | ADR-0025: módulo fiscal NO arranca si catálogo crítico no disponible. Boot toma 5-15s por catálogos. Mejor que arrancar y fallar en cada emisión. |
| **Excepciones al principio "catálogos runtime"** | Lista CERRADA de 5 catálogos locales Pandora (tipos de pago, atmospheres, ACTOR_TYPES, PII_LEVELS/SEVERITIES/USER_ROLES, códigos error AFIP) | Server + Cliente vía Context | PR + ADR | Regla práctica: si viene de ente regulatorio externo (ARCA/AFIP/SRT/IGJ) → ADR-0025 obligatorio. Si interno Pandora → hardcoded OK. |
| **`CondicionIVAReceptorId` aplicada al receptor en una emisión** | RG 5616/2024 obligatorio desde 01/08/2025 — id elegido por operador POS, valor desde catálogo runtime ARCA | Server | Solo Server al emitir (snapshot inmutable) | ADR-0023 Decisión 1: persistir id + desc_at_emission + catalog_version. Snapshot autosuficiente sin depender de catálogo externo histórico. |
| **`condicion_iva_receptor_desc_at_emission` (vs descripción actual)** | Snapshot — captura del momento de emisión | Server + Cliente (read reimpresión) | Solo Server al emitir | Si ARCA renombra una condición ("IVA Responsable Inscripto" → "IVA RI") en 2030, el snapshot del 2026 sigue siendo CORRECTO con su descripción histórica. Sufijo `_at_emission` previene confusión. |
| **Spec del payload QR fiscal (versión, campos, encoding Base64, URL base)** | ARCA — RG 4892/2020 + spec PDF oficial | Server (lectura inmutable post-emisión) | NUNCA (post-emisión) — Spec ARCA en boot del módulo de generación | ADR-0023 Decisión 2: persistir `qr_version` + `qr_payload_json` completo + `qr_url_base_at_emission`. Imagen PNG es derivable, NO se persiste. |
| **`qr_payload_json` post-emisión** | AFIP (los valores `codAut`, `tipoCodAut`, etc. vienen de la respuesta WSFEv1) | Server + Cliente (impresión / reimpresión) | NUNCA mutable post-emisión | Pandora compone los 13 campos pero los valores autoritativos (CAE/CAEA + fecha + número) vienen del response WSFEv1. Reproducibilidad bit-perfect: imagen QR se regenera determinísticamente desde JSON + URL base. |
| **Representación legal del QR (imagen vs payload JSON)** | 🟡 **PENDIENTE A-22 contadora** (agregada en ADR-0023) | — | — | Hipótesis Pandora: ambas equivalentes ya que imagen es derivable del JSON + URL base. Confirmar antes de Sprint 6. |
| **`tax_policy_version` (perfil normativo activo)** | Pandora (decisión interna documentada en archivo Git inmutable `tax-policy-versions/ar-YYYY-MM-vN.md`) | Server (al crear factura — fija la versión) + Cualquiera (lectura del archivo Git) | Solo PR que crea nueva versión (NUNCA edita las viejas) | ADR-0023 Decisión 3: convención `ar-AAAA-MM-vN`. Una vez publicada, el archivo NUNCA se edita. Cambio normativo → nueva versión. Git history = trazabilidad legal. Único campo del frontmatter que puede actualizarse es `Estado: SUPERSEDED` cuando entra versión siguiente. |
| **`authorization_code_type` (CAE vs CAEA) por factura** | AFIP — el tipo está determinado por la modalidad de emisión (online vs contingencia CAEA) y se refleja en `tipoCodAut` del QR ("E"=CAE, "A"=CAEA) | Server + Cliente (reimpresión) | Solo Server al emitir (inmutable) | ADR-0023 Decisión 4 + alineado RG 5782/2025 + RG 5785/2025 (vigentes 01/08/2026 post RG 5852/2026). Fail-closed: si tipo no detectable al emitir → bloquear. |
| **Decisión "IA sugiere vs IA decide"** | Pandora (ADR-0024 — invariante absoluta, sin excepciones F0/F1/F2) | Server + Cliente (lo aplica) | NUNCA editar la política sin nuevo ADR que reemplace 0024 | 15 áreas BLINDADAS: fiscal_status / Decimal.js / tipo comprobante / CondicionIVAReceptor / alícuota IVA / Ley 19.640 / tenant_id / cross-tenant / emisión AFIP / snapshot mutations / audit mutations / retenciones / numeración fiscal / CAE-CAEA / reconciliación. Áreas PERMITIDAS con guidelines (OCR sugerencia, búsqueda semántica, etc.) — humano siempre firma. |
| **`actor_type` cuando IA está involucrada en una operación** | Humano que confirma (`actor_type='user'`) o cron (`actor_type='cron'`) — **NUNCA `actor_type='ai'`** | Server (audit_log) | Solo Server según operación | ADR-0024: IA NO es actor responsable legal. IA queda en `payload.ai_suggestion: {ai_model_id, ai_model_version, ai_confidence, suggested_values, fields_edited_by_human}` para trazabilidad. Sujeto a scrub policy Sprint 2 #4. |
| **Refresh de catálogos regulatorios** | Cron daily `catalog-refresh` 04:00 ART + boot validation por catálogo | Server + Cliente (read after refresh) | Solo cron / boot | ADR-0025: 24h TTL por catálogo crítico, 1h para `Cotizacion` (F2+ multi-moneda). Cron diff por hash → emite `system.catalog.degraded_fail_closed` si > 7 días sin refresh exitoso. |

---

*Authority Map versión 1.1 — 2026-05-26 / actualizado 2026-05-27 (Sesión 3) / actualizado 2026-06-03 (ADRs 0023/0024/0025 + mini-auditoría coherencia)*
