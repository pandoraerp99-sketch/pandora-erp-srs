# ADR-0020 — Política de demo expirado

**Fecha:** 2026-05-21 (decisión) — 2026-05-26 (formalización en ADR)
**Estado:** Aprobado
**Relacionado con:** ADR-0009 (feature flags por tenant) — para flag `is_demo`. SRS sección 14.16 (onboarding).

## Contexto

Un demo de Pandora se crea cuando un comerciante prueba el producto sin activar AFIP (es decir, sin completar el onboarding fiscal). El demo dura 21 días: 14 días iniciales + 7 días de extensión automática (definido en Sesión 1 Fix 3 del SRS).

**Gap detectado:** el SRS no definía qué pasa con el demo que NUNCA activa AFIP después del día 21. Tres opciones quedaban implícitas y mal cerradas:

1. Bloqueo de login inmediato (pierde el cliente potencial + viola Ley 25.326 derecho ARCO al retener datos detrás de paywall).
2. Suspensión total sin acceso (similar problema legal).
3. Modo lectura con export disponible (resuelve ambos riesgos).

## Decisión

**Política definitiva del ciclo de vida del demo:**

```
Día 1-14:    demo activo (modo demo según SRS sección 14.16)
Día 14:      banner crítico + email "Activá AFIP"
Día 15-21:   extensión automática 7 días (ya en Sesión 1 Fix 3)
Día 22-81:   modo lectura (60 días)
Día 82:      bloqueo de login + cuenta marcada 'archived'
Día 82+:     reactivación solo vía soporte Pandora
Día 82+5años: eliminación lógica permanente (alineado con Ley 11.683)
```

### Modo lectura (día 22-81) permite

- Login y navegación
- Ver productos, clientes, ventas demo cargadas
- Exportar CSV/Excel (compliance Ley 25.326 derecho ARCO)
- Activar AFIP en cualquier momento → la cuenta vuelve a producción inmediatamente

### Modo lectura NO permite

- Vender (incluso ticket no fiscal)
- Facturar
- Crear/editar productos, clientes, configuración
- Generar reportes nuevos (los ya generados sí se ven)

### UI obligatoria en modo lectura

Banner persistente "Modo lectura. Activá AFIP para seguir." con CTA al wizard. NO dismissable.

## Por qué modo lectura y no bloqueo total

1. **Coherencia con SRS Sesión 3 (política de impago):** el SRS ya define el patrón "modo lectura antes de suspensión total" para usuarios que dejan de pagar. Aplicar el mismo patrón al demo evita lógicas duplicadas.

2. **Ley 25.326 — derecho ARCO:** retener datos personales del usuario detrás de un paywall total es exposición legal. Modo lectura con export disponible cumple por default.

3. **Conversión:** usuario que cargó N productos + M clientes durante el demo y vuelve 3 semanas después convierte si encuentra su data intacta; abandona si encuentra "no podés entrar".

4. **Reducir fricción de reactivación:** retener "casi cliente" es más barato que adquirir nuevo.

## Por qué 60 días y no más/menos

- Más que los 20 días de modo lectura por impago (que tiene urgencia comercial: ya facturó real).
- Suficiente para que un demo serio vuelva con plata.
- Corto suficiente para no inflar la DB con cuentas zombies.

## Diferencia con política de impago (SRS Sesión 3 Ambigüedad 4)

| | Impago | Demo expirado |
|---|---|---|
| Estado previo | Cliente pagó, facturó real | Nunca pagó, "ventas" son demo con marca de agua |
| Urgencia comercial | Alta (perder cliente activo) | Baja (nunca fue cliente) |
| Modo lectura | 20 días (día 11-30) | 60 días (día 22-81) |
| Suspensión total | Día 31 | Día 82 |
| Archivado | Día 90 | Día 82 |
| Eliminación | 5 años post-archivado | 5 años post-archivado |

## Schema impactado

`companies.status` acepta valores adicionales:

```sql
ALTER TABLE companies
  DROP CONSTRAINT IF EXISTS companies_status_check,
  ADD CONSTRAINT companies_status_check CHECK (status IN (
    -- Producción
    'active', 'past_due', 'read_only', 'suspended', 'archived',
    -- Demo (este ADR)
    'demo_active', 'demo_extended', 'demo_readonly', 'demo_archived'
  ));
```

## Audit log obligatorio

Transiciones día 14, 22, 82 generan entradas en `audit_log` con:

| Día | Action | Trigger |
|---|---|---|
| 14 | `demo.extended` | Cron `cron-demo-lifecycle` |
| 22 | `demo.readonly_entered` | Cron |
| 82 | `demo.archived` | Cron |
| Cualquiera | `demo.activated_afip` | Server Action del wizard (usuario activa AFIP) |

## Implementación operativa

Cron job único `cron-demo-lifecycle` ejecuta diariamente:

```sql
-- Día 14 → demo_extended
UPDATE companies SET status = 'demo_extended'
WHERE status = 'demo_active'
  AND created_at <= now() - interval '14 days';

-- Día 22 → demo_readonly
UPDATE companies SET status = 'demo_readonly'
WHERE status = 'demo_extended'
  AND created_at <= now() - interval '21 days';

-- Día 82 → demo_archived (bloqueo login)
UPDATE companies SET status = 'demo_archived'
WHERE status = 'demo_readonly'
  AND created_at <= now() - interval '81 days';
```

Cada paso debe insertar audit_log dentro de la misma transacción.

## Alternativas rechazadas

- **Bloqueo de login día 22:** rechazado. Viola derecho ARCO + pierde data del cliente que pudo haber convertido.
- **Modo lectura indefinido (sin archivado):** rechazado. Acumula cuentas zombies y datos personales sin propósito (viola minimización ley 25.326).
- **30 días de modo lectura en vez de 60:** rechazado. Demasiado corto para usuarios que vuelven después de feriados o temporada baja.
- **Email diario durante modo lectura:** rechazado. Spam que reduce probabilidad de conversión. Solo 3 emails: día 22 (informativo), día 60 (recordatorio), día 75 (último aviso).

## Consecuencias

**Positivas:**
- Compliance Ley 25.326 sin esfuerzo adicional.
- Conversión post-demo medible (clientes que vuelven en día 30-75).
- Patrón único de "modo lectura" reutilizado del impago.

**Negativas:**
- Storage de cuentas demo retenidas 81 días (vs bloqueo inmediato). Aceptable en F0.
- Más estados en máquina de estado de companies.

**Riesgos a monitorear:**
- Abuso: alguien crea muchas cuentas demo para mantener acceso lectura por 81 días. Mitigación: rate limit por email/CUIT en signup.

## Triggers de re-evaluación

- Storage de cuentas demo en modo lectura > 5% del DB total.
- Abuso detectado (mismo email/CUIT creando múltiples demos).
- Compliance flag de AAIP sobre datos retenidos sin propósito.

## Pendiente

- Documentar formalmente en SRS sección 14.16 en próxima pasada del SRS (no urgente — este ADR es la fuente de verdad mientras tanto).
