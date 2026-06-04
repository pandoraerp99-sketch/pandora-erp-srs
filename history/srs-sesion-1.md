# PANDORA ERP — SRS Sesión 1
## Patch v2.0-OMN → v2.1 + Sección 14 UX Operacional

**Fecha:** 17 mayo 2026
**Base:** PANDORA_ERP_Resumen_Ejecutivo_Definitivo_v2.0-OMN
**Estado:** Aprobado para integración en SRS v3.0
**Contenido:**
- **Parte 1:** Fixes quirúrgicos a contradicciones internas del v2.0-OMN
- **Parte 2:** Sección 14 UX Operacional completa (no existía en v2.0-OMN)

**Marcado de validación humana:**
- 🟢 **VERDE:** Contenido técnico, alta confianza, listo para implementar
- 🟡 **AMARILLO:** Requiere validación de contador, abogado, o entrevistas a clientes antes de producción
- 🔴 **ROJO:** Decisión pendiente del owner — vos tenés que responder

---

# PARTE 1 — FIXES INMEDIATOS AL v2.0-OMN

## Fix 1 — Sección 8.1: Corregir policy RLS

**Severidad:** Crítica
**Estado:** 🟢 VERDE

### Texto actual en v2.0-OMN

```
| **Row-Level** | RLS habilitado en PostgreSQL | Policy: `company_id = current_setting('app.current_company')` |
```

### Reemplazar por

```
| **Row-Level** | RLS habilitado en PostgreSQL | Policy: `company_id = (auth.jwt() ->> 'company_id')::uuid` |
```

### Justificación

`current_setting('app.current_company')` no sobrevive a connection pooling de Supabase Supavisor. Las conexiones se reasignan entre requests y el setting puede leak entre tenants. La policy correcta usa el claim firmado en el JWT que Supabase Auth ya provee.

### Acción adicional

En Sección 8.7 "Protección contra Tenant Leaks", agregar punto 5:

> 5. Tests de pool de conexiones en CI: simular reasignación de conexión bajo carga y verificar que RLS sigue aplicando correctamente con auth.jwt().

---

## Fix 2 — Sección 1.5 y 10.6: Clarificar timeline Fase 5

**Severidad:** Media
**Estado:** 🟢 VERDE

### Texto actual en v2.0-OMN (1.5)

> "Escalar a 5.000+ tenants, $50M+ ARS ARR (...) Considerar Serie A al cruzar 2.000 clientes y $25M ARR."

### Reemplazar por

> "Escalar a 5.000+ tenants y $50M+ ARS ARR es **objetivo aspiracional Fase 5**, no compromiso de cronograma. Considerar Serie A si se cruza 2.000 clientes y $25M ARR — esto es **trigger condicional**, no milestone de calendario. El tiempo real para llegar dependerá de validación de pricing, capacidad de adquisición vía contadores, y restricciones macro argentinas (inflación, devaluación, crisis sectoriales)."

### Texto actual en v2.0-OMN (10.6)

> "FASE 5 — Madurez (Mes 24+) — Objetivo comercial: 5.000+ clientes."

### Reemplazar por

> "FASE 5 — Madurez (**inicio mes 24+, duración indeterminada**) — Objetivo comercial: 5.000+ clientes (**aspiracional, no calendarizable**)."

### Justificación

Tango llevó 30 años para llegar a su base actual de comercios. Pandora prometiendo 5.000 clientes "mes 24" sin precedentes locales documentados es ficción. Mejor marcar Fase 5 como condicional, no temporal.

---

## Fix 3 — Sección 8.3: Definir "modo demo" formalmente

**Severidad:** Media
**Estado:** 🟢 VERDE (técnicamente) + 🔴 ROJO (límites comerciales requieren decisión tuya)

### Texto actual en v2.0-OMN

> "Modo demo: Acceso inmediato post-paso 1. Productos de ejemplo. Facturación simulada (sin CAE real). Permite vender en < 5 minutos."

### Reemplazar por (sección expandida)

#### 8.3.bis Modo Demo — Especificación Formal

**Propósito:** Permitir al comerciante operar Pandora desde el minuto 1 sin necesidad de tener configurado AFIP, certificado X.509, ni datos fiscales completos. Reduce fricción de onboarding, permite que el comerciante pruebe el POS la misma tarde que se registra.

**Acceso:**
- Activación automática al crear cuenta y completar paso 1 del wizard (datos mínimos: email, password, nombre comercio, CUIT optativo).
- No requiere tarjeta de crédito, no requiere certificado AFIP.
- Modo demo activo por defecto en todas las cuentas nuevas durante los primeros 14 días o hasta que el comerciante active facturación real, lo que ocurra primero.

**Funcionalidades habilitadas:**
- Vender, cobrar, registrar caja, gestionar productos, gestionar clientes, ver reportes.
- Toda la operación del POS Fase 0 sin restricciones.

**Funcionalidades simuladas (no producen efectos reales):**
- Emisión de comprobante fiscal: genera ticket interno con marca de agua "DEMO — Sin valor fiscal". No llama a AFIP. No genera CAE.
- Notificaciones email: se envían pero con prefijo "[DEMO]" en subject y disclaimer en body.
- Webhooks salientes: no se ejecutan.

**Límites del modo demo:**
- Máximo 100 productos cargados.
- Máximo 50 ventas registradas (después, bloqueo con CTA "Activá AFIP para seguir vendiendo").
- Máximo 14 días desde la creación de la cuenta.
- No es facturable. No se cobra suscripción hasta que el comerciante active AFIP real.

**Transición a producción:**
- El comerciante completa paso 2 del wizard (certificado AFIP, configuración PV).
- Sistema valida certificado contra AFIP homologación primero (verificación automática).
- Si todo OK, modo demo se desactiva, cuenta queda en modo producción.
- Las ventas realizadas en modo demo **NO se migran a producción**. Se mantienen en histórico marcadas como "DEMO" para referencia visual del comerciante. No se facturan retroactivamente.
- Productos y clientes cargados sí se conservan.

**Indicador visual obligatorio:**
- Banner persistente en header: "Modo Demo — N días restantes — Activá AFIP" con CTA al wizard.
- Marca de agua "DEMO" en todo PDF generado.
- Color de header distintivo (sugerido: ámbar 50) para diferenciar visualmente.

**Auditoría:**
- Toda operación en modo demo se registra en `audit_log` con `metadata.demo = true`.
- Permite analytics: % de demos que convierten, tiempo promedio hasta activación, abandono por etapa.

**Decisiones pendientes** 🔴 ROJO:

1. **¿Modo demo accede al módulo contador?** Recomiendo NO. El contador es función de "real". Si el comerciante invita contador en modo demo, el contador ve "Esta empresa está en demo". Sin acceso operativo.
2. **¿Si el comerciante no activa en 14 días, qué pasa?** Opciones:
   - (a) Bloqueo: no puede entrar hasta activar AFIP.
   - (b) Modo lectura: puede ver lo que cargó pero no operar.
   - (c) Extensión automática 7 días más con email.
   - Recomiendo (c) + después (a).

### Acción adicional

En Glosario (Apéndice A), agregar:

| **Modo Demo** | Estado inicial de cuenta nueva. Permite operación completa sin AFIP real. Comprobantes simulados con marca de agua. Hasta 14 días o 50 ventas. | Producto |

---

## Fix 4 — Sección 3.3 (límites de entidad): Baja de usuario con turno abierto

**Severidad:** Media
**Estado:** 🟢 VERDE (técnico) + 🔴 ROJO (decisión de política)

### Texto a agregar como nuevo subpunto en Sección 3.3

> **Baja de usuario con operaciones activas:**
>
> Cuando un usuario es desactivado (`profiles.active = false`) o eliminado lógicamente, el sistema **bloquea la transición** si existen operaciones pendientes:
>
> - **Turno abierto:** El usuario queda en estado `pending_deactivation`. No puede iniciar sesión nueva, pero el turno permanece abierto y debe cerrarse por owner/admin antes de completar la baja. El sistema notifica al admin: "Usuario X tiene turno abierto desde [fecha]. Cerrar antes de desactivar."
> - **Ventas en `pending_payment`:** Se transfieren automáticamente al admin que ejecuta la baja, con registro en `audit_log` indicando transferencia.
> - **Ventas en `draft`:** Se descartan automáticamente (no afectan stock ni caja).
> - **Movimientos de stock pendientes:** Se mantienen con el `user_id` original (histórico inmutable), pero las pendientes de aprobación pasan al admin que ejecuta la baja.
>
> El admin no puede completar la baja del usuario hasta que todas las operaciones críticas estén resueltas. Esta es regla de negocio enforced en `UserService.deactivate()`, no en DB.

### Decisión pendiente 🔴 ROJO

¿Qué pasa con el histórico de ventas del usuario eliminado? Recomiendo: el `user_id` en `sales` queda intacto (referencial), pero el `profiles` queda con `active=false, deleted_at=timestamp`. Nunca DELETE físico de profiles. Histórico siempre muestra "Usuario eliminado" si la baja fue posterior a la operación.

---

## Fix 5 — Sección 4.2 (Sale): Estado terminal para `requires_reconciliation`

**Severidad:** Alta
**Estado:** 🟢 VERDE

### Texto actual implícito

> "Revisar hasta 2 horas. Después: quemado + notificación owner."

### Reemplazar por (texto explícito en máquina de estado Sale)

```
[requires_reconciliation]
  ├── → [invoice_issued] (worker encuentra CAE en FECompConsultar)
  ├── → [number_burned] (worker no encuentra CAE, AFIP confirma rechazo)
  └── → [reconciliation_timeout] (NUEVO ESTADO TERMINAL)
        — Trigger: 2 horas sin respuesta confirmatoria de AFIP
        — Acción: número quemado definitivo
        — Notificación obligatoria: email + Sentry alert al owner del tenant
        — Auditoría: motivo automático "AFIP no respondió tras 2hs de reconciliación"
        — UI: ticket no fiscal definitivo, comerciante debe gestionar manualmente con AFIP
```

### Justificación

Sin estado terminal explícito, las ventas pueden quedar perpetuamente en `requires_reconciliation`. Esto rompe reportes contables ("¿cuántas ventas tengo sin facturar?") y bloquea cierres de turno si hay validación de "no quedan ventas pendientes".

### Acción adicional

En Sección 7.6 "CAE Perdido", agregar después de "Límite: Revisar hasta 2 horas":

> **Después de 2 horas sin resolución:**
> - Estado final: `reconciliation_timeout` (terminal).
> - Número marcado como `burned` definitivamente en `invoice_sequences`.
> - Sale queda en `no_document` permanente. Si el comerciante quiere facturar después, debe ser por comprobante manual a través de su contador, fuera del sistema.
> - Registro en `audit_log` con campos: `action='reconciliation_timeout'`, `entity='afip_invoice'`, `metadata.attempts=N`, `metadata.last_afip_response`.

---

## Fix 6 — Sección 4.2 (Order): Manejo de `expired`

**Severidad:** Media
**Estado:** 🟢 VERDE

### Texto a agregar después del estado `expired` en Sección 4.2

```
[expired]
  — Trigger: cron job `orders-cleanup` corre cada 15 minutos
  — Condición: `reservation_expires_at < now()` AND `status = 'confirmed'`
  — Side effects:
    * Status → 'expired'
    * Liberar stock_reservations asociadas (status → 'released')
    * Notificación al cliente si tiene email (template: "Pedido expirado")
    * Notificación al vendedor que armó el pedido (template: "Tu pedido X expiró")
  — Visibilidad: Pedido sigue visible en histórico durante 90 días, después archivado
  — Reactivación: Pedido en `expired` NO se puede reactivar. Si el cliente vuelve, se crea pedido nuevo.
```

### Decisión pendiente 🔴 ROJO

`reservation_expires_at` default: ¿60 minutos para todos? El v2.0-OMN dice "configurable por tenant, default 60 min". ¿Mantener? Recomiendo: 60 min para POS, 24hs para WhatsApp/Instagram (Fase 2), configurable per channel cuando se active omnicanal.

---

## Fix 7 — Sección 10.2: WhatsApp vs SMS en Fase 1

**Severidad:** Baja
**Estado:** 🟢 VERDE

### Texto actual

> "WhatsApp Business API + SMS Twilio"

### Reemplazar por

> "Canal default Fase 1: **Email (Resend)**. Canal opcional Fase 1: **SMS (Twilio)** y **WhatsApp Business Cloud API**. El comerciante elige en configuración cuál canal activar para qué tipo de notificación. WhatsApp requiere Business Manager verificado (24-72hs aprobación por Meta) + templates aprobados. SMS Twilio es fallback inmediato si WhatsApp no está aprobado."

### Justificación

WhatsApp Business Cloud API tiene curva de aprobación operativa (Business Manager + templates). No podés prometer WhatsApp "el día 1 de Fase 1" sin haber empezado el proceso semanas antes.

---

## Fix 8 — Sección 1.5: Metas en ARS volátiles por inflación

**Severidad:** Media
**Estado:** 🟢 VERDE

### Política a aplicar en todo el documento

Toda meta financiera en ARS debe acompañarse del equivalente USD aproximado al tipo de cambio del momento de redacción del documento, marcado como referencia, no compromiso.

### Ejemplo de aplicación (Sección 1.5)

**Antes:**
> "5.000+ tenants, $50M+ ARS ARR"

**Después:**
> "5.000+ tenants, $50M+ ARS ARR (~$45-50K USD MRR a TC oficial mayo 2026, sujeto a re-evaluación trimestral por inflación)"

### Aplicar mismo patrón en

- Sección 10.3 ($5-8M ARS ARR Fase 2)
- Sección 10.4 ($10-15M ARS ARR Fase 3)
- Sección 10.5 ($25M+ ARS ARR Fase 4)
- Sección 10.6 ($50M+ ARS ARR Fase 5)

### Acción operativa

Agregar nota al pie en Sección 10 Roadmap:

> **Nota inflacionaria:** Todas las metas en ARS son **referenciales al tipo de cambio de mayo 2026**. Se ajustan trimestralmente con publicación de IPC INDEC. Las metas reales se trackean en USD MRR equivalente al final de cada fase para evitar distorsión por macro argentina.

---

## Fix 9 — Sección 7.6 (CAE perdido): Notificación con runbook visible

**Severidad:** Media
**Estado:** 🟢 VERDE

### Texto a agregar al final de Sección 7.6

> **Notificación operativa al comerciante:**
>
> Cuando una venta queda en `requires_reconciliation`, el POS muestra:
>
> 1. **Inmediatamente (toast 5s):** "AFIP no respondió. Ticket no fiscal emitido. La factura saldrá automáticamente en los próximos minutos."
> 2. **En sales pendientes (panel dashboard):** Lista con sales en `requires_reconciliation`, contador "X intentos de reconciliación, próximo a las HH:MM".
> 3. **Si reconciliación es exitosa (cada 5 min):** Email + push (Fase 1+): "Tu factura #X salió. Podés reimprimirla desde el dashboard."
> 4. **Si reconciliación falla tras 2hs:** Email + alerta visible en POS: "Factura #X no pudo emitirse. Contactá a tu contador para gestión manual con AFIP. Tu venta queda como ticket no fiscal."

### Decisión pendiente 🔴 ROJO

¿En el caso (4) — venta sin factura definitiva — qué hacés con la cobranza? ¿La venta es válida o se anula? Mi recomendación: la venta es válida operativamente (ya se cobró, se entregó mercadería). Solo queda pendiente la factura fiscal, que se resuelve fuera del sistema. ⚠️ Esto requiere validación de contador.

---

## Fix 10 — Apéndice B (Readiness): Agregar 5 items críticos

**Severidad:** Baja
**Estado:** 🟢 VERDE

### Items a agregar al checklist

| Item | Estado | Descripción | Próximo paso |
|---|---|---|---|
| Política de retención de PDFs | ⏳ | 10 años retención legal. Storage Supabase crece linealmente. Política de archivado frío necesaria a partir de Fase 2. | Definir cuándo migrar a S3 Glacier o equivalente |
| Política de cleanup de idempotency_log | ⏳ | Append-only sin TTL crece sin límite. Definir: 90 días retención, después archivado o purga. | Cron mensual de cleanup con archivado |
| Reputación de dominio email | ⏳ | Resend requiere SPF/DKIM/DMARC configurados antes del primer envío masivo. | Configurar DNS antes del primer cliente real |
| Protección de delete company | ❌ | UI debe prevenir borrado accidental con confirmación 2-step + delay 7 días + email de cancelación. | Implementar antes de Fase 1 |
| Test sintético de venta E2E | ⏳ | Cada 30 min, test automatizado simula venta completa contra ambiente staging. Alerta si falla. | Configurar después de primer deploy estable |

---

# PARTE 2 — SECCIÓN 14 UX OPERACIONAL (NUEVA)

🟢 **VERDE** — Esta sección es técnica/UX, alta confianza, lista para implementar.

---

## 14. UX Operacional

### 14.1 Principios rectores

La UX de Pandora es **operacional**, no decorativa. Está optimizada para:

- **Cajeros cansados a las 21:00** que no quieren leer texto.
- **Comerciantes con manos ocupadas** (escanean producto, cobran, embolsan, simultáneamente).
- **Adultos de 40-60 años** que no son nativos digitales (target real).
- **Tablets baratas** con pantallas táctiles imprecisas y CPUs lentas.
- **Conexión 4G fluctuante** en barrios alejados de centros urbanos.

**Anti-principios:**
- No diseño "moderno minimalista" que requiere descubrir affordances ocultos.
- No animaciones largas (más de 200ms genera percepción de lentitud).
- No tooltips para acciones críticas (no se leen en operación rápida).
- No menús anidados de más de 2 niveles.
- No modales sobre modales.
- No infinite scroll en operaciones operativas (siempre paginación clara).

### 14.2 Latencia máxima por operación

Cada operación tiene latencia máxima aceptable definida y monitoreada. **Si la latencia real supera el SLO, es bug y entra a backlog de optimización.**

| Operación | SLO latencia p95 | Latencia inaceptable | Acción si se excede |
|---|---|---|---|
| Login → dashboard | < 800ms | > 2s | Alerta Sentry. Investigar query lenta o cold start. |
| Escaneo producto → carrito | < 200ms | > 500ms | Crítico. POS pierde fluidez. Optimizar cache productos. |
| Búsqueda producto (fuzzy) | < 300ms | > 800ms | Migrar a Meilisearch antes de Fase 2 si supera. |
| Confirmar venta (sin facturar) | < 500ms | > 1.5s | Revisar transacción Drizzle. Posible deadlock. |
| Confirmar venta + facturar AFIP | < 8s p95 (incluye llamada AFIP) | > 25s | Timeout y fallback ticket no fiscal. |
| Generar PDF ticket | < 1s | > 3s | Revisar template, considerar pre-render. |
| Imprimir PDF (browser nativo) | < 2s | > 5s | Independiente del backend. UX info "Procesando impresión". |
| Cierre de turno con arqueo | < 1.5s | > 4s | Optimizar query agregación cash_movements. |
| Listado de ventas del día | < 700ms (paginado 50) | > 2s | Índice en `(company_id, created_at DESC)`. |
| Carga inicial de catálogo (1.000 productos) | < 2s | > 5s | Server Component con stream. |
| Importación CSV 5.000 productos | < 15s validación, < 30s aplicar | > 60s | Procesar en chunks de 500. |

**Mecanismo de medición:**
- Logs Pino con `duration_ms` en cada operación crítica.
- Métricas Prometheus por endpoint con histograma p50/p95/p99.
- Dashboard de SLOs visible al equipo desde Sentry Performance.

### 14.3 Keyboard-first para POS

El POS está optimizado para teclado físico. Mouse y touch son secundarios. **El cajero debe poder operar el 90% del POS sin levantar las manos del teclado.**

#### Atajos globales del POS (no negociables)

| Tecla | Acción | Comportamiento |
|---|---|---|
| `/` | Focus en buscador de productos | Funciona desde cualquier lugar del POS. Limpia búsqueda previa. |
| `Enter` | Confirmar acción primaria contextual | En carrito: confirmar venta. En modal: aceptar. En búsqueda: agregar primer resultado. |
| `Esc` | Cancelar/cerrar | Cierra modal abierto. Si no hay modal, descarta venta en draft (con confirmación). |
| `F2` | Cliente | Abrir buscador/selector de cliente. Default consumidor final. |
| `F3` | Cambiar caja | Solo si usuario tiene acceso a múltiples cajas. |
| `F4` | Descuento global | Permite aplicar descuento porcentual o monto fijo al total. Requiere permiso. |
| `F5` | Modificar cantidad | Foco en cantidad del item seleccionado en carrito. |
| `F6` | Eliminar item | Borra el item seleccionado del carrito (con confirmación si es el último). |
| `F7` | Notas internas | Agregar nota a la venta (no se imprime en ticket por defecto). |
| `F8` | Medios de pago | Abrir modal de pagos mixtos. Tab para navegar entre métodos. |
| `F9` | Tipo de comprobante | Forzar tipo (A/B/C). Default auto-detect según cliente. |
| `F10` | Anulación última venta | Solo si está dentro de los criterios (<24h, mismo turno, permisos). |
| `F11` | Pantalla completa | Toggle fullscreen del POS. |
| `F12` | Cobrar y emitir | Acción primaria. Confirma venta + dispara facturación. |
| `Ctrl+Z` | Deshacer última acción del carrito | Solo afecta carrito en draft, no acciones confirmadas. |
| `Ctrl+P` | Reimprimir último ticket | Última venta cobrada en el turno actual. |
| `Tab` | Navegar entre campos | Orden lógico: buscador → carrito → cantidad → totales → cobrar. |
| `Shift+Tab` | Navegar inverso | — |
| `↑/↓` | Navegar items del carrito | Selecciona item para edición o eliminación. |
| `Ctrl+N` | Nueva venta (descarta actual) | Confirma descarte si hay items en carrito. |

#### Indicadores visuales de atajos

- Cada botón/acción con atajo muestra el atajo visible en el botón.
- Ejemplo: `[F12] Cobrar` no solo "Cobrar".
- Hover sobre cualquier elemento interactivo muestra atajo si existe.
- Pantalla de ayuda con `?` muestra todos los atajos.

#### Accesibilidad táctil (fallback)

- Todos los atajos tienen botón visible en la UI para casos sin teclado físico (tablets).
- Botones de operación crítica con tamaño táctil mínimo **48x48px** (sobre el estándar 44x44 de Apple HIG, porque cajeros usan tablets baratas).
- Targets táctiles separados al menos 8px entre sí.

### 14.4 Estados visuales de carga y feedback

#### Estados de carga (loading states)

| Duración esperada | UI a mostrar |
|---|---|
| < 100ms | Nada. Optimistic UI. |
| 100-300ms | Cursor "wait" + leve atenuación del botón. |
| 300-1000ms | Skeleton de la zona afectada (no spinner). Botón inhabilitado con texto "Procesando..." |
| 1000-3000ms | Skeleton + indicador de progreso si se puede (barra). |
| 3000-10000ms (ej: AFIP) | Modal de progreso con: "Solicitando CAE a AFIP... Esto puede tardar hasta 30 segundos." + barra animada + botón "Cancelar y emitir ticket no fiscal" tras 15s. |
| > 10000ms | Sospechoso. Toast de advertencia "La operación está tardando más de lo normal. Si necesitás, podés cancelar y reintentar." |

**Regla:** Nunca dejar la UI sin feedback más de 100ms. Si no se puede mostrar el resultado, mostrar el estado.

#### Estados de éxito (success states)

| Severidad | UI |
|---|---|
| Operación rutinaria (agregar al carrito) | Sin toast. Cambio visual del carrito basta. |
| Operación importante (venta cobrada) | Toast verde 3-4s: "Venta #1234 registrada — $12.345,67" + animación check |
| Operación crítica (factura emitida) | Toast verde 5s + sound effect opcional + el ticket aparece en pantalla automáticamente |
| Operación destructiva exitosa (anulación) | Toast amarillo 5s: "Venta #1234 anulada. Stock devuelto." + log visible en historial |

#### Estados de error (error states)

**Regla absoluta:** Cero mensajes genéricos. Cada error tiene mensaje específico y acción clara.

| Error | Mensaje (NO) | Mensaje (SÍ) |
|---|---|---|
| Stock insuficiente | "Error al confirmar venta" | "Stock insuficiente: queda 1 unidad de 'Coca-Cola 500ml'. Confirmar igual? [Sí, con autorización] [Modificar cantidad] [Quitar item]" |
| Sin internet | "Error de conexión" | "Sin conexión a internet. La venta no se puede confirmar. Verificá la red o esperá. Reintentando automáticamente cada 10s. [Cancelar]" |
| AFIP timeout | "Error AFIP" | "AFIP no respondió en 30 segundos. Se emitió ticket no fiscal. La factura saldrá automáticamente cuando AFIP responda (próximo intento en 5 min). [Reintentar manual] [Continuar sin factura]" |
| Pagos no cuadran | "Error en pagos" | "Los pagos suman $X pero el total es $Y. Falta $Z o sobra $W. [Ajustar pagos]" |
| Sin permiso | "Acceso denegado" | "Tu rol (cajero) no puede aplicar descuentos mayores a 10%. Pedí a un administrador con autorización." |
| Sesión expirada | "Sesión expirada" | "Tu sesión venció. Reingresá con tu contraseña. Tus datos del carrito se guardaron y los recuperás al volver. [Reingresar]" |
| Producto duplicado | "Error de validación" | "El SKU 'PROD-001' ya existe asignado al producto 'Coca-Cola 1L'. ¿Editar ese producto o usar otro SKU? [Editar] [Cambiar SKU]" |

#### Confirmaciones obligatorias

Acciones destructivas requieren confirmación **explícita y verbose**, no "¿Estás seguro?" genérico.

| Acción | Confirmación requerida |
|---|---|
| Anular venta facturada | Modal: "Esta venta tiene factura emitida #B-0001-00001234 con CAE válido. Anularla generará una **Nota de Crédito automática**. ¿Continuar? [Cancelar] [Sí, anular y emitir NC]" + campo motivo obligatorio. |
| Eliminar producto con histórico | Modal: "Este producto tiene 47 ventas históricas. Se marcará como **inactivo** (no eliminado físicamente) para preservar histórico. [Cancelar] [Sí, inactivar]" |
| Cierre forzado de turno con descuadre > 5% | Modal: "El descuadre es $X (Y% del total). Requiere autorización de admin. [Solicitar autorización] [Cancelar]" |
| Eliminar empresa (tenant) | Wizard 3-step: confirmación + delay 7 días + email de cancelación enviado + posibilidad de revocar durante esos 7 días. |
| Cambiar plan a uno con menos features | Modal: "Bajar de Pro a Starter desactivará: variantes, multi-sucursal, cuenta corriente. ¿Continuar? [Cancelar] [Sí, bajar plan]" |

### 14.5 Tolerancia a errores humanos

El POS debe **anticipar errores comunes** y prevenirlos antes de que ocurran.

#### Errores comunes anticipados

| Error humano | Prevención |
|---|---|
| Doble escaneo del mismo producto rápido | Detección por timing (< 200ms entre escaneos del mismo barcode = ignorar segundo). |
| Cliente paga con efectivo, cajero ingresa cambio incorrecto | Sistema sugiere automáticamente cambio basado en monto recibido. |
| Cantidad ingresada con coma argentina (1,5) vs punto inglés (1.5) | Aceptar ambos. Normalizar internamente. |
| Importar CSV con encoding raro (Excel Argentina exporta CP1252) | Auto-detectar encoding. Soportar UTF-8, CP1252, ISO-8859-1. |
| Buscar producto por SKU con espacios o guiones | Normalizar búsqueda (ignorar espacios, guiones, mayúsculas). |
| Cliente da CUIT con guiones | Auto-formatear/limpiar. Aceptar XX-XXXXXXXX-X y XXXXXXXXXXX. |
| Olvidar cerrar turno antes de irse | Cron 23:59 cierra automáticamente con estado `force_closed_by_cron` + email al owner. |
| Vender producto sin stock (override) | Permitido solo si tenant lo habilita + motivo obligatorio + alerta al owner. |
| Cobrar de menos accidentalmente | Validación: pagos === total exacto. Si difiere, no permite confirmar. Si es por descuento, debe estar registrado como descuento explícito. |
| Imprimir ticket roto y necesitar reimprimir | Botón "Reimprimir" disponible en toda venta dentro del turno actual + en histórico (con marca de "reimpresión"). |

#### Mensajes preventivos

Sistema avisa **antes** de que el error ocurra:

- Cajero intenta cerrar turno con ventas en `pending_payment`: "Hay 3 ventas sin cobrar. Resolvé antes de cerrar."
- Comerciante intenta deshabilitar AFIP en producción: "Tenés 142 ventas facturadas este mes. Deshabilitar AFIP no afecta el histórico pero las nuevas ventas no podrán facturarse. [Cancelar] [Sí, deshabilitar]"
- Cajero intenta anular venta de hace 23hs: "Esta venta tiene 23hs. La anulación está permitida hasta 24hs. ¿Confirmar?"
- Stock crítico al agregar producto al carrito: "Quedan 2 unidades. ¿Continuar?" (no bloqueante, solo informativo).

### 14.6 Fallback manual

Cuando algo automático falla, **siempre debe haber camino manual**.

#### Fallbacks definidos

| Sistema que falla | Camino manual |
|---|---|
| AFIP no responde tras 30s | Ticket no fiscal con número interno. Comerciante sigue cobrando. Reconciliación async. |
| Impresora no responde | Mostrar PDF en pantalla con QR. Cliente puede escanear y guardar digital. Botón "Reintentar impresión". |
| Padrón AFIP A5 no responde | Permitir carga manual de cliente con CUIT sin validación + marca "Pendiente de validar". Cron reintenta validación cada 24hs. |
| Webhook MercadoPago no llega | Comerciante puede marcar pago como confirmado manualmente con referencia. Registro auditado. |
| Búsqueda fuzzy de producto falla | Fallback a búsqueda literal exacta. Más lenta pero siempre disponible. |
| Carga de imagen de producto falla | Producto se crea sin imagen. Se puede agregar después. |
| Sync de catálogo a tablet falla | Tablet usa caché local de última sincronización exitosa. Banner: "Catálogo desactualizado, intentá sincronizar." |
| Login con email/password falla | Recuperación por email (link mágico). Si falla email, support manual con verificación de identidad. |

### 14.7 UX offline (Fase 2)

🟡 **AMARILLO** — Sección de planificación, implementación Fase 2.

Cuando se active modo offline (Fase 2+), la UX cambia así:

- **Detección de pérdida de conexión:** Banner amarillo persistente en header: "Sin conexión. Las ventas se guardan localmente y se sincronizan al volver internet."
- **Operaciones permitidas offline:** Venta con ticket no fiscal interno, registro de caja, consulta de catálogo cacheado, búsqueda de productos en cache local.
- **Operaciones bloqueadas offline:** Facturación AFIP (queda en queue), consulta padrón AFIP nuevo, importación CSV, configuración.
- **Indicador de cola pendiente:** Contador visible "12 operaciones pendientes de sincronizar" con detalle al click.
- **Reconexión:** Banner verde 5s: "Conexión restaurada. Sincronizando 12 operaciones..." → "Sincronización completa".
- **Conflicto en sync:** Si stock no alcanza al sincronizar, modal con conflicto y opciones manuales.

### 14.8 Empty states con CTA

Toda pantalla vacía tiene un call-to-action claro.

| Pantalla vacía | Mensaje + CTA |
|---|---|
| Sin productos | "No tenés productos cargados. [Importar CSV/Excel] [Cargar manualmente] [Usar productos demo del rubro]" |
| Sin clientes | "No tenés clientes registrados. [Agregar cliente] [Importar desde Excel]" |
| Sin ventas hoy | "Todavía no hay ventas hoy. [Empezar nueva venta]" |
| Carrito vacío | "Carrito vacío. Escaneá un producto o presioná / para buscar." (con icono ilustrativo) |
| Sin turno abierto | "No tenés turno abierto. [Abrir turno con monto inicial]" |
| Sin notificaciones | "No hay notificaciones. Te avisaremos cuando algo importante pase." |
| Sin reportes generados | "Generá tu primer reporte. [Reporte de ventas del día] [Reporte de stock crítico]" |

### 14.9 Mobile-aware (no mobile-first)

Pandora es **desktop/tablet-primary**. El comerciante consulta dashboards desde el celular pero **no opera POS desde celular**.

#### Diferenciación por dispositivo

| Dispositivo | Optimización |
|---|---|
| Desktop (1366px+) | POS completo. Keyboard-first. Dashboard con grids amplios. |
| Tablet (768-1365px) | POS completo touch-first. Botones más grandes. Layout adaptativo. |
| Mobile (< 768px) | **Solo modo lectura.** Dashboard simplificado con KPIs grandes. Notificaciones. Cierre de turno desde tablet preferido. Comerciante puede consultar pero **no operar POS**. |

#### Por qué no mobile-first POS

- Cajero usa tablet en mostrador (más estable que celular).
- Pantalla de celular es muy chica para ver carrito + cliente + totales + atajos.
- Operación con dedo gordo cansado es propensa a errores en zonas chicas.
- Cobrar con celular en mano + bolsa + producto = caos.

### 14.10 Modo nocturno

🟢 **VERDE** — Implementación recomendada para Fase 1.

- Activación: manual (toggle en settings) o automática (basada en hora local del tenant, 20:00-07:00).
- Paleta: fondos grises oscuros (#0f172a), textos blancos (#f1f5f9), acentos primary mantenidos.
- Crítico para kioscos y comercios que operan hasta tarde — reduce fatiga visual.
- Independiente del modo nocturno del sistema operativo (algunos comerciantes no saben configurarlo).

### 14.11 Sonido y notificaciones audibles

🟡 **AMARILLO** — Decisión de UX, validar con primeros 5 clientes.

- Sonido al confirmar venta exitosa: "ding" corto (configurable, default ON).
- Sonido al rechazo (stock insuficiente, etc.): tono grave corto (default OFF en local ruidoso).
- Sonido al error crítico (AFIP timeout): alerta más larga (default ON).
- Configuración por usuario: cada cajero puede ajustar.
- Volumen configurable.
- Soportar mute global para horarios de cliente (siesta, etc.).

### 14.12 Internacionalización (i18n)

**Fase 0-3:** Español rioplatense (Argentina) único idioma soportado. **No** "Español neutro" — el comerciante argentino usa palabras locales (boletín = boleta, vuelto = cambio, "te paso por transferencia").

**Fase 4+** (multi-país):
- Estructura i18n preparada desde Fase 0 con archivos de traducción separados, aunque solo se use es-AR.
- Cuando se active multi-país: es-UY, es-CL, es-MX con localizaciones específicas (moneda, formato de fecha, terminología fiscal local).
- Inglés (en-US) solo para soporte interno, no para producto.

### 14.13 Accesibilidad operacional

🟢 **VERDE** — Cumplimiento WCAG 2.1 nivel AA como mínimo.

#### Requisitos no negociables

- **Contraste mínimo:** 4.5:1 para texto normal, 3:1 para texto grande. Validado con axe-core en CI.
- **Foco visible:** Outline claro en todo elemento interactivo (no `outline: none` sin alternativa).
- **Navegación por teclado:** Toda función operable sin mouse. Tab order lógico.
- **Lectores de pantalla:** ARIA labels en botones de íconos. `aria-live` para toasts de éxito/error.
- **Sin trampa de foco:** En modales, foco se queda dentro pero Esc cierra siempre.
- **Tamaño de texto:** Base 16px mínimo. Usuario puede aumentar a 200% sin romper layout.
- **No solo color:** Información crítica (error, éxito) acompañada de icono + texto, no solo color rojo/verde.

#### Para comerciantes mayores (target real)

- Tipografía legible: Inter o sistema, no fonts decorativas.
- Tamaño base 14px en tablas densas, 16px en formularios.
- Botones primarios con padding generoso (al menos 12px vertical, 24px horizontal).
- Iconos acompañados de label en todos los casos críticos.

### 14.14 Métricas de UX a trackear

| Métrica | Tipo | Target Fase 0 |
|---|---|---|
| Tiempo desde escaneo a venta confirmada | Histogram p95 | < 15s |
| Tasa de anulación de ventas | % | < 3% |
| Tasa de errores en cierre de turno (descuadre > 5%) | % | < 5% |
| Tiempo en onboarding completo | Histogram p50 | < 45 min |
| Tasa de abandono de onboarding en cada paso | % por paso | < 20% |
| Tasa de re-impresión de tickets | % | Bajo es bueno (significa impresión OK al primer intento) |
| Errores 4xx en endpoints del POS | rate | < 2% |
| Tiempo medio de respuesta a errores (cajero ve error → resuelve) | Histogram p50 | < 30s |

### 14.15 Onboarding del comerciante (UX detallado)

#### Paso 1: Registro (target: 3 min)

- Email + password + nombre comercio.
- CUIT optativo (se puede completar después).
- Botón único: "Empezar a vender ya".
- Sin opt-in marketing, sin newsletter, sin cookies de tracking obligatorias.

#### Paso 2: Datos comerciales (target: 5 min)

- Nombre fantasía, dirección, teléfono, condición IVA (default RI).
- Rubro: dropdown con lista pre-cargada (kiosco, mercería, panadería, etc.) → carga automática de productos demo si el comerciante elige "Usar demo".
- Si elige rubro: 20-30 productos demo del rubro pre-cargados con precios sugeridos (editables después).
- Botón: "Continuar al POS" (opción saltear AFIP por ahora).

#### Paso 3: AFIP (opcional, target: 30-60 min cuando tenga certificado)

- Wizard guiado para subir certificado X.509 (con instrucciones de cómo obtenerlo de AFIP).
- Configurar punto de venta.
- Probar emisión de comprobante de prueba contra homologación.
- Si todo OK, activar en producción.

#### Por qué AFIP es opcional al inicio

Los comerciantes necesitan **ver el producto vendiendo antes de configurar fiscalidad**. La fricción de obtener certificado AFIP toma 1-3 días. Si bloqueás onboarding hasta tener AFIP, perdés el 60% de los registros.

**Estrategia ganadora:** comerciante registra → vende con modo demo → se enamora → completa AFIP cuando tenga tiempo.

### 14.16 Lo que NO hace el POS de Pandora

**Decisiones explícitas de NO hacer en UX:**

- ❌ No tutoriales onboarding largos (cajero ya sabe vender).
- ❌ No gamificación (no "subí de nivel", no badges).
- ❌ No chat in-app (soporte por WhatsApp/email del lado del comerciante).
- ❌ No upselling en medio de la venta (no "¿querés agregar X?").
- ❌ No social sharing (no "compartí tu venta en Twitter").
- ❌ No notificaciones push de marketing.
- ❌ No skin/temas personalizables (consume tiempo, no aporta valor operativo).
- ❌ No internacionalización completa Fase 0 (es-AR es suficiente).
- ❌ No tour interactivo del POS (que el cajero aprenda usando, o con el video tutorial del owner).
- ❌ No estadísticas comparativas con otros comercios anónimos (privacidad + irrelevante).

---

# CIERRE DE SESIÓN 1

## Resumen de lo entregado

**Parte 1 — Fixes inmediatos (10 correcciones quirúrgicas):**

1. ✅ RLS policy con auth.jwt() en lugar de current_setting
2. ✅ Fase 5 marcada como aspiracional, no calendarizable
3. ✅ Modo demo definido formalmente con límites y transición a producción
4. ✅ Baja de usuario con turno abierto definida
5. ✅ Estado terminal `reconciliation_timeout` agregado a máquina de Sale
6. ✅ Manejo de Order `expired` definido con cron y notificaciones
7. ✅ WhatsApp vs SMS en Fase 1 clarificado
8. ✅ Metas en ARS con equivalente USD por inflación
9. ✅ Notificación operativa de CAE perdido al comerciante
10. ✅ 5 items críticos agregados al checklist de readiness

**Parte 2 — Sección 14 UX Operacional completa:**

- 16 subsecciones cubriendo principios, latencia, keyboard-first, estados visuales, tolerancia a errores, fallback manual, UX offline (planificación), empty states, mobile-aware, modo nocturno, sonido, i18n, accesibilidad, métricas, onboarding detallado, y decisiones de NO hacer.

## Decisiones pendientes que necesitan tu input 🔴 ROJO

Antes de Sesión 2, contestá estas (te las consolido al final):

1. **Modo demo:** ¿accede al módulo contador? (recomiendo NO)
2. **Modo demo:** ¿qué pasa después de 14 días sin activar? (recomiendo (c) extensión 7 días + (a) bloqueo después)
3. **Baja de usuario:** ¿política de profiles? (recomiendo soft delete con audit visible)
4. **Order `reservation_expires_at`:** ¿60 min POS, 24h omnicanal? (recomiendo sí)
5. **Venta sin factura definitiva tras 2h:** ¿es válida operativamente? ⚠️ requiere contador.

## Próxima sesión (Sesión 2)

**Contenido:** Observabilidad operativa completa + 9 máquinas de estado faltantes
**Tiempo estimado:** 3-4 horas mías de trabajo
**Output:** Un solo archivo .md descargable
**Antes de arrancar:** confirmá las 5 decisiones de arriba

---

*Fin de SRS Sesión 1 — 17 mayo 2026*
