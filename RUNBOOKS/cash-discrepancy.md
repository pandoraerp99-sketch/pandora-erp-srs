# Cash Discrepancy — Runbook

**Severidad:** S2 (> $5000 ARS o > 5% del total caja) / S3 (menor)
**Detección:** automática al cierre de caja
**SLA target F0:** investigación < 24h · resolución cliente < 48h

---

## Síntomas

- Cierre de caja muestra descuadre entre saldo esperado y saldo contado
- `cash.descuadre_detected` evento emitido
- Comerciante reporta inconsistencia tras cierre

## Pasos de mitigación inmediata

### 1. NO bloquear cierre — registrar con motivo

El comerciante DEBE poder cerrar el día. Sistema permite cerrar con descuadre + motivo obligatorio.

```sql
UPDATE cash_sessions
SET closed_at = now(),
    final_amount = {amount_contado},
    expected_amount = {amount_esperado},
    descuadre = {final - expected},
    discrepancy_reason = '{motivo}',
    closed_by = '{user_id}'
WHERE id = '{session_id}';
```

### 2. Audit log

```sql
INSERT INTO audit_log (event_name, payload, severity, ...)
VALUES (
  'cash.session_closed_with_discrepancy',
  '{
    "session_id": "...",
    "expected": {amount},
    "actual": {amount},
    "discrepancy": {amount},
    "reason": "{texto}",
    "runbook": "cash-discrepancy.md"
  }',
  '{high|medium}',
  ...
);
```

### 3. Evaluar severidad

- Discrepancia > $5000 ARS O > 5% del total ventas del día → **S2**
- Discrepancia menor → **S3**

## Pasos de investigación (S2)

### 1. Revisar ventas del día

```sql
-- Q: ventas del día por forma de pago
SELECT s.id, s.created_at, s.total, sp.method, sp.amount
FROM sales s
JOIN sale_payments sp ON sp.sale_id = s.id
WHERE s.tenant_id = '{tenant}'
  AND s.created_at::date = '{fecha_caja}'
ORDER BY s.created_at;
```

### 2. Revisar movimientos de caja manuales

```sql
SELECT * FROM cash_movements
WHERE cash_session_id = '{session_id}'
ORDER BY created_at;
```

Comerciante puede haber registrado retiros / aportes / pagos a proveedores.

### 3. Revisar MercadoPago QR

```sql
SELECT * FROM mp_payments
WHERE tenant_id = '{tenant}'
  AND created_at::date = '{fecha}';
```

Comparar contra reporte MP del día.

### 4. Revisar tarjetas

Comerciante debe conciliar con resúmenes de POS terminal (Posnet, etc.) externos.

### 5. Identificar causa probable

| Causa | Acción |
|---|---|
| Vuelto mal dado | Educación cajero + auditar siguientes cierres |
| Venta no registrada en sistema | Audit + investigar por qué (bug? bypass?) |
| Movimiento manual no registrado | Capacitación + UX para hacerlo más fácil |
| Robo / fraude | Escalar a cliente + audit detallado |
| Error de conteo | Re-contar al inicio del día siguiente |
| Error en sistema (bug) | Investigar urgente + posible S1 |

## Comunicación al cliente

Template (S2):

```
Hola {nombre_comercio},

Detectamos un descuadre en tu cierre de caja del {fecha}:
- Esperado: ${X}
- Contado: ${Y}
- Diferencia: ${Z}

Las posibles causas más comunes son:
- Vueltos mal calculados durante el día
- Movimientos manuales (retiros, pagos a proveedores) no registrados
- Diferencia en MP / tarjeta vs efectivo

Te recomendamos:
1. Revisar el reporte de ventas del día (link)
2. Conciliar con resúmenes externos (MP, Posnet)
3. Si encontrás la causa, registrarla con un movimiento de ajuste

Si necesitás ayuda, contactanos.

— Pandora team
```

## Resolución

### Criterio para declarar resuelto

- Comerciante identificó causa probable + registró nota explicativa
- O comerciante decidió absorber la diferencia (caso pequeño)
- Audit log con resolución registrada

### Casos especiales

#### Discrepancia recurrente > 3 cierres consecutivos

→ Escalada a S1 → investigación profunda (¿bug del sistema? ¿fraude empleado?)

#### Discrepancia > 20% del total del día

→ Escalada a S1 → posible bug o robo grave → contacto directo con comerciante

#### Diferencia que sugiere bug Pandora

→ Investigar inmediato (logs + audit + replay) → posible S0 si afecta integridad fiscal

## Acciones preventivas

- UX clara para registrar movimientos manuales (retiros, aportes)
- Resumen al cierre con totales por forma de pago
- Alerta proactiva si descuadre > umbral durante el día (no esperar al cierre)
- Capacitación documentada para cajeros

---

## Anti-patterns

- ❌ Bloquear cierre por descuadre — comerciante debe poder cerrar, sistema debe registrar
- ❌ Ajustar montos automáticamente sin audit — TODA modificación requiere motivo
- ❌ Asumir robo sin evidencia → puede ser un bug nuestro
- ❌ Asumir bug nuestro sin evidencia → puede ser operación real

---

## Cross-references

- [CLAUDE.md §12.4](../CLAUDE.md) — Estados de cash
- [CAPABILITY-MAP.md](../CAPABILITY-MAP.md) — C-OPS-01
- [BOUNDED-CONTEXTS.md](../BOUNDED-CONTEXTS.md) — Cash context

---

*Runbook cash-discrepancy.md v1.0 — 2026-05-28*
