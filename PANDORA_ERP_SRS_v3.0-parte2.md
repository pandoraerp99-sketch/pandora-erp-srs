# 8. Catalog e Inventory

🟢 **VERDE**

## 8.1 Catalog: productos y categorías

**Modelo:**

```typescript
interface Product {
  id: string;
  companyId: string;
  sku?: string;                  // único por tenant
  barcode?: string;              // único por tenant
  name: string;
  description?: string;
  categoryId?: string;
  price: number;                 // numeric(19,4)
  ivaRateId: string;             // FK a iva_rates
  active: boolean;
  trackStock: boolean;           // default true
  minStock?: number;             // alerta de stock crítico
  imageUrl?: string;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface Category {
  id: string;
  companyId: string;
  name: string;
  parentId?: string;             // jerárquica
  position: number;              // orden visual
  active: boolean;
}
```

**Reglas:**

- SKU único por tenant (`UNIQUE(company_id, sku)` con `WHERE deleted_at IS NULL`).
- Barcode único por tenant.
- Soft delete: producto eliminado no se puede vender pero histórico se preserva.
- Cambio de precio: audit log obligatorio con motivo.
- Cambio de IVA rate: audit log obligatorio + alerta al owner ("Cambiaste el IVA del producto X, esto afecta cómo se factura").

## 8.2 Productos demo por rubro

🟢 **VERDE** — Onboarding facilitado.

Al crear tenant + elegir rubro, se cargan 20-30 productos demo:

| Rubro | Productos demo |
|---|---|
| Kiosco | Coca-Cola 500ml, Gaseosa marca propia, Cigarrillos Marlboro, Cigarrillos Philip Morris, Chicles Beldent, Caramelos surtidos, Galletitas Oreo, Galletitas Pepitos, Alfajor Jorgito, Mantecol, Snack Lays, Tarjeta SUBE recarga, Carga celular Movistar, etc. |
| Mercería | Hilo de coser blanco, Hilo de coser negro, Aguja N°8, Cierre 20cm, Botón nacarado, Cinta de medir, Tijera de modista, Almohadilla, Tiza de sastre, Velcro adhesivo, etc. |
| Panadería | Pan flauta, Pan miñón, Facturas surtidas, Medialunas dulces, Medialunas saladas, Bizcochos, Tortas pequeñas, Pan dulce, Galletitas surtidas, etc. |
| Ferretería | Tornillos varios, Clavos varios, Pegamento universal, Cinta aisladora, Llave inglesa 8", Destornillador Phillips, Martillo, Sierra manual, etc. |

El comerciante puede editar precios, eliminar, o agregar más. Los productos demo son punto de partida, no obligatorios.

## 8.3 Variantes simples (Fase 0)

Fase 0 soporta variantes simples (color o talle, no matriz):

```typescript
interface ProductVariant {
  id: string;
  productId: string;
  name: string;                  // "Rojo", "M", etc.
  sku?: string;                  // override SKU base
  priceModifier?: number;        // delta sobre precio base
  active: boolean;
}
```

**Fase 1+:** variantes en matriz (color × talle). Schema preparado pero sin lógica completa.

## 8.4 Inventory: stock y movimientos

🟢 **VERDE** — Append-only, append-only, append-only.

**Modelo:**

```typescript
interface Stock {
  productId: string;             // PK compuesto (productId, warehouseId)
  warehouseId: string;
  quantity: number;              // denormalización
  reservedQuantity: number;      // sumatoria de stock_reservations activas (F2+)
  availableQuantity: number;     // quantity - reservedQuantity (computed)
  lastMovementAt: Date;
}

interface StockMovement {
  id: bigint;                    // bigserial
  companyId: string;
  warehouseId: string;
  productId: string;
  movementType: MovementType;    // 'sale' | 'purchase' | 'adjustment' | 'transfer_out' | 'transfer_in' | 'initial' | 'cancellation_reverse'
  quantity: number;              // positivo o negativo
  resultingQuantity: number;     // stock después del movimiento
  saleId?: string;               // si proviene de venta
  cancellationOfMovementId?: bigint;  // si es reverso de cancelación
  userId?: string;
  reason?: string;               // obligatorio en adjustments
  negativeStockOverrideReason?: string;
  metadata: jsonb;
  createdAt: Date;               // append-only, NUNCA UPDATE
}
```

**Reglas absolutas:**

- `stock_movements` es **append-only**. Nunca UPDATE ni DELETE.
- Corrección de movimiento erróneo: nuevo movimiento inverso con `cancellation_of_movement_id`.
- `stock.quantity` es denormalización de `SUM(stock_movements WHERE product_id, warehouse_id)`. Se mantiene por performance pero la verdad está en los movimientos.
- Recálculo periódico (cron diario) que valida que la denormalización coincide con la suma. Si difiere: alerta crítica.

## 8.5 Stock negativo

🟢 **VERDE** — Política definida en Sesión 3.

**Default:** stock negativo bloqueado para todo tenant.

**Activación:**
- Solo owner puede activar (no admin).
- Segunda confirmación + motivo obligatorio en audit_log.

**Operación:**
- Cada venta que genera stock negativo requiere motivo obligatorio en `stock_movements.negative_stock_override_reason`.
- Email automático al owner: "Venta con stock negativo registrada por [usuario] - Producto: X - Cantidad: Y - Motivo: Z".
- Dashboard muestra "Top 5 productos con stock negativo" para revisión.

**Schema:**

```sql
ALTER TABLE company_settings ADD COLUMN
  allow_negative_stock boolean NOT NULL DEFAULT false,
  negative_stock_alert_email text;

ALTER TABLE stock_movements ADD COLUMN
  negative_stock_override_reason text;

ALTER TABLE stock_movements ADD CONSTRAINT
  negative_override_requires_reason
  CHECK (
    resulting_quantity >= 0
    OR negative_stock_override_reason IS NOT NULL
  );
```

## 8.6 Importación CSV de productos

🟢 **VERDE** — Wizard con preview obligatorio (ver máquina de estado SM-09).

**Flujo:**

1. Owner sube CSV.
2. Sistema parsea con auto-detección de encoding (UTF-8, CP1252, ISO-8859-1).
3. Validación row-by-row: SKU único, barcode único, precio > 0, IVA rate válido, categoría existente o auto-crear.
4. Preview con 3 categorías:
   - Verde: filas OK, listas para importar.
   - Amarillo: filas con warnings (ej: precio sospechosamente bajo). Importables con confirmación.
   - Rojo: filas con errores. Requieren corrección de CSV.
5. Owner confirma. Sistema importa filas verdes y amarillas confirmadas en batches de 500.
6. Si error transversal: rollback completo. Si filas individuales fallan: `partial_applied` con reporte.

**TTL del preview:** 24 horas. Después: requiere re-upload.

## 8.7 Stock reservations (Fase 2+)

Para omnicanal (pedido confirmado pero no cobrado todavía):

```typescript
interface StockReservation {
  id: string;
  companyId: string;
  productId: string;
  warehouseId: string;
  quantity: number;
  orderId: string;               // pedido que reserva
  channel: 'pos' | 'whatsapp' | 'instagram' | 'web' | 'phone';
  status: 'active' | 'converted' | 'released' | 'expired';
  expiresAt: Date;
  createdAt: Date;
}
```

**TTL por canal (Fase 2):**
- POS: 60 minutos
- WhatsApp/Instagram: 24 horas (configurable hasta 72h)
- Web: 30 minutos (configurable hasta 24h)
- Marketplace (F3+): según marketplace

**Cron de cleanup:** cada 15 minutos. Reservas expiradas liberan stock y notifican.

---

# 9. Sales, orders y pagos

🟢 **VERDE**

## 9.1 Separación conceptual Order / Sale / Invoice

🟢 **VERDE** — Decisión formalizada en ADR-0015 (parte del v2.0-OMN original).

**Order (Pedido):** intención de compra. Captura demanda. Fase 0: implícito en POS. Fase 2+: explícito en omnicanal.

**Sale (Venta):** transacción completada. Tiene items, pagos, total. Puede o no tener factura.

**Invoice (Factura):** documento fiscal emitido a AFIP. Tiene CAE. Una venta puede tener 0 o 1 factura.

**Por qué la separación importa:**
- Venta puede existir sin factura (ticket no fiscal cuando AFIP no responde).
- Pedido puede existir sin venta (cliente reservó pero no vino).
- Factura puede existir sin reflejarse en venta (NC sobre venta antigua).

## 9.2 Sale model

```typescript
interface Sale {
  id: string;
  companyId: string;
  saleNumber: number;            // correlativo interno por tenant
  cashSessionId: string;         // turno donde se hizo
  branchId: string;
  cashRegisterId: string;
  terminalId: string;
  userId: string;                // cajero
  customerId?: string;           // null = consumidor final
  customerSnapshot: jsonb;       // INMUTABLE, NOT NULL
  status: SaleStatus;
  
  // Totales (numeric 19,4)
  subtotal: number;
  totalDiscounts: number;
  totalTaxes: number;
  total: number;
  
  // Pagos
  totalPaid: number;
  
  // Fiscal
  invoiceRequested: boolean;
  afipInvoiceId?: string;        // FK
  
  // Audit
  cancellationReason?: string;
  refundReason?: string;
  notes?: string;
  channel: 'pos' | 'omnichannel';
  
  createdAt: Date;
  completedAt?: Date;
  cancelledAt?: Date;
}
```

## 9.3 SaleItem model

```typescript
interface SaleItem {
  id: string;
  saleId: string;
  productId: string;
  productSnapshot: jsonb;        // INMUTABLE: name, sku, barcode al momento
  variantId?: string;
  quantity: number;              // numeric 19,4 (permite fracciones para peso)
  unitPrice: number;
  totalDiscount: number;
  ivaRate: number;               // % aplicable
  ivaAmount: number;
  totalAmount: number;
  position: number;              // orden en el ticket
}
```

**Snapshot inmutable de producto:** captura nombre y SKU al momento de venta. Si el producto se renombra después, el ticket histórico mantiene el nombre original.

## 9.4 SalePayment model

```typescript
interface SalePayment {
  id: string;
  saleId: string;
  paymentMethod: PaymentMethod;  // cash | card_present | mp_qr | transfer | check | credit_account
  amount: number;
  status: PaymentStatus;
  externalReference?: string;    // ej: MP operation_id
  metadata: jsonb;
  confirmedAt?: Date;
  createdAt: Date;
}
```

## 9.5 Pagos mixtos

Una venta puede tener N pagos. Suma exacta debe igualar `total`:

```typescript
// Validación en SaleService
const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
if (Math.abs(totalPaid - sale.total) > 0.01) {
  throw new BusinessError('PAYMENTS_DO_NOT_MATCH_TOTAL', `Total: ${sale.total}, Pagado: ${totalPaid}`);
}
```

**Regla:** la diferencia debe ser <= $0.01 ARS (un centavo) por errores de redondeo numéricos.

## 9.6 Flujo de creación de venta

🟢 **VERDE** + ⚠️ retry obligatorio (ADR-0011).

```typescript
async function createSale(input: CreateSaleInput) {
  return withSerializationRetry(
    'sale.create',
    () => executeCreateSaleTransaction(input),
    { correlationId: input.correlationId, companyId: input.companyId }
  );
}

async function executeCreateSaleTransaction(input: CreateSaleInput) {
  return await db.transaction(async (tx) => {
    // 1. Idempotency check
    await checkIdempotency(tx, input.idempotencyKey, input.companyId);
    
    // 2. Validar tenant
    await assertTenantMatches(input.companyId, currentContext);
    
    // 3. Validar shift abierto
    const shift = await tx.query.cashSessions.findFirst({
      where: and(
        eq(cashSessions.id, input.cashSessionId),
        eq(cashSessions.status, 'open')
      )
    });
    if (!shift) throw new BusinessError('NO_OPEN_SHIFT');
    
    // 4. Validar customer si aplica, capturar snapshot
    const customer = input.customerId 
      ? await customersService.getById(tx, input.customerId)
      : null;
    const customerSnapshot = buildCustomerSnapshot(customer);
    
    // 5. Lock y descontar stock (SELECT FOR UPDATE)
    for (const item of input.items) {
      await lockAndDecrementStock(tx, item, shift.tenant_fiscal_snapshot);
    }
    
    // 6. Calcular totales con redondeo half-up
    const totals = calculateTotals(input.items, input.discounts);
    
    // 7. Validar pagos cuadran
    validatePaymentsMatchTotal(input.payments, totals.total);
    
    // 8. Insertar sale
    const [sale] = await tx.insert(sales).values({
      ...sale_fields,
      customer_snapshot: customerSnapshot,
    }).returning();
    
    // 9. Insertar sale_items
    await tx.insert(saleItems).values(items_with_snapshots);
    
    // 10. Insertar payments y cash_movements
    await tx.insert(salePayments).values(input.payments);
    await tx.insert(cashMovements).values(cash_movements_for_each_payment);
    
    // 11. Si invoice requested: llamar FiscalService DENTRO de la misma tx
    if (input.invoiceRequested) {
      const invoice = await fiscalService.issueInvoice(tx, {
        saleId: sale.id,
        customerSnapshot,
        items: items_with_snapshots,
        salePoint: shift.tenant_fiscal_snapshot.sale_point_id,
      });
      sale.afip_invoice_id = invoice.id;
    }
    
    // 12. Audit DENTRO de la transacción (ADR-0011)
    await auditService.log({
      tx,
      companyId: input.companyId,
      userId: input.userId,
      userRole: input.userRole,
      action: 'sale.created',
      entity: 'sale',
      entityId: sale.id,
      changes: { before: null, after: sale },
      metadata: {
        correlationId: input.correlationId,
        ip: input.ip,
        terminalId: input.terminalId,
        branchId: input.branchId,
        channel: input.channel,
      },
    });
    
    // 13. Idempotency log entry
    await tx.insert(idempotencyLog).values({
      company_id: input.companyId,
      idempotency_key: input.idempotencyKey,
      operation: 'sale.create',
      result: { sale_id: sale.id },
      status: 200,
    });
    
    return sale;
  }, { isolationLevel: 'serializable' });
}
```

## 9.7 Anulación de venta

🟢 **VERDE** — Criterio resuelto en Sesión 3.

**Anulación (rollback completo) válida solo si:**
- Está dentro de 24 horas cronológicas desde `sale.completed_at`, **Y**
- El turno donde se hizo la venta sigue abierto.

**Si pasaron 24h o el turno cerró:** requiere Nota de Crédito (Fase 1+), no anulación.

**Permisos:**
- Cashier puede anular propias dentro de mismo turno + 24h.
- Admin/owner pueden anular cualquiera del mismo turno + 24h.

**Side effects de anulación:**
- Stock movement inverso (devuelve stock).
- Cash movement inverso.
- Si factura emitida: bloquear anulación, requerir NC.
- Audit log con motivo obligatorio.

## 9.8 Orders (Fase 2+)

Pedido omnicanal. Modelo preparado:

```typescript
interface Order {
  id: string;
  companyId: string;
  orderNumber: number;
  customerId?: string;
  customerSnapshot: jsonb;       // INMUTABLE
  channel: 'whatsapp' | 'instagram' | 'web' | 'phone';
  status: OrderStatus;
  reservationExpiresAt: Date;
  total: number;
  notes?: string;
  saleId?: string;               // null hasta convertir
  createdAt: Date;
}
```

**TTL por canal** (Sesión 1, Fix 6):
- POS (implícito): 60 min
- WhatsApp/Instagram: 24h
- Web/teléfono: 30 min - 24h configurable

## 9.9 Reservation expires (Fase 2+)

Cron `orders-cleanup` cada 15 minutos:

```sql
UPDATE orders 
SET status = 'expired'
WHERE reservation_expires_at < now() 
AND status = 'confirmed';

-- + liberar stock_reservations asociadas
-- + notification al cliente si tiene email
-- + notification al vendedor que armó pedido
```

---

# 10. Cash

🟢 **VERDE** — Estados completos formalizados en Sesión 2 + unificación en 3.5.

## 10.1 Modelo de turno

```typescript
interface CashSession {
  id: string;
  companyId: string;
  cashRegisterId: string;
  userId: string;                // cajero que abrió
  status: CashSessionStatus;     // ver máquina de estado SM-05
  
  // Apertura
  openedAt: Date;
  initialAmount: number;
  
  // Cierre (si aplica)
  closingStartedAt?: Date;
  closedAt?: Date;
  expectedAmount?: number;       // calculado
  declaredAmount?: number;       // declarado por cajero
  difference?: number;           // declared - expected
  closureReason?: string;
  closedByUserId?: string;
  
  // Force close
  forceClosingStartedAt?: Date;
  forceClosedAt?: Date;
  forceClosingRevertedAt?: Date;
  forceClosingRevertedByUserId?: string;
  forceClosingRevertReason?: string;
  
  // Snapshot fiscal del tenant
  tenantFiscalSnapshot: jsonb;   // INMUTABLE, NOT NULL
  
  notes?: string;
}
```

## 10.2 Snapshot fiscal del tenant

🟢 **VERDE** — Crítico para consistencia fiscal durante el turno (Sesión 3.5).

Al abrir cash_session, capturar:

```json
{
  "iva_condition": "RI",
  "cuit": "30-12345678-9",
  "fiscal_address": "...",
  "sale_point_id": "uuid",
  "sale_point_number": 1,
  "captured_at": "2026-05-18T08:00:00Z",
  "source": "session_open"
}
```

Todas las ventas del turno usan este snapshot, no consultan estado actual del tenant.

**Bloqueo:** owner no puede cambiar condición IVA con turnos abiertos.

```typescript
async function changeIvaCondition(input: ChangeIvaInput) {
  const openSessions = await db.query.cashSessions.findMany({
    where: and(
      eq(cashSessions.companyId, input.companyId),
      eq(cashSessions.status, 'open')
    )
  });
  
  if (openSessions.length > 0) {
    throw new BusinessError(
      'CANNOT_CHANGE_IVA_WITH_OPEN_SESSIONS',
      `No podés cambiar tu condición IVA con turnos abiertos. 
       Cerrá las cajas primero. Turnos abiertos: ${openSessions.length}.`
    );
  }
  
  // Proceder con cambio + audit_log
}
```

## 10.3 Cash movements

```typescript
interface CashMovement {
  id: bigint;
  companyId: string;
  cashSessionId: string;
  movementType: CashMovementType; // 'initial' | 'sale_payment' | 'sale_payment_reverse' | 'expense' | 'adjustment' | 'closing_difference'
  amount: number;
  paymentMethod?: PaymentMethod;
  saleId?: string;
  salePaymentId?: string;
  expenseId?: string;
  reason?: string;
  userId: string;
  createdAt: Date;
}
```

**Append-only.** Corrección = nuevo movimiento inverso.

## 10.4 Cierre forzado

🟢 **VERDE** — Versión unificada (Sesión 3 + 3.5).

**Worker:** `cron-cash-session-force-close`
**Frecuencia:** cada 5 minutos.

**Configuración por tenant:**

```sql
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS
  force_close_hour text NOT NULL DEFAULT '23:59',
  smart_detection_enabled boolean NOT NULL DEFAULT true,
  smart_detection_inactivity_threshold_hours int NOT NULL DEFAULT 2,
  cash_session_no_auto_close boolean NOT NULL DEFAULT false,
  cash_difference_tolerance_percent numeric(5,2) NOT NULL DEFAULT 1.00;
```

**Lógica:**

```
Cada 5 minutos:

Para cada cash_session candidata (status=open, pasada la hora configurada):

  1. Si smart_detection_enabled:
     Verificar actividad en últimas N horas:
     - cash_movements creados
     - sales creados
     
     Si HAY actividad reciente:
       SKIP. Próxima evaluación en 5 min.
  
  2. Marcar status = 'force_closing'
  3. Notificar cashier por email/SMS
  4. Esperar 1 hora de gracia
  
  5. Si cashier respondió (status pasó a closing): flujo normal de cierre.
  6. Si admin/owner revirtió (status volvió a open): audit + reevaluar próximo ciclo.
  7. Si 1 hora sin respuesta: 
     - status = 'force_closed' 
     - calcular expected_amount
     - reporte PDF con disclaimer
     - audit_log
     - notificar owner
```

**Reversión de force_closing:**

| Acción | Quién | Requiere |
|---|---|---|
| `force_closing → open` | admin / owner | Motivo obligatorio |
| `force_closing → closing` | cashier | Continúa como cierre voluntario |
| `force_closing → force_closed` | sistema | 1 hora sin respuesta |

**Excepción:** tenants con `cash_session_no_auto_close = true` quedan completamente fuera del cron. Comercios 24h reales pueden desactivar con audit + advertencia UI.

## 10.5 Tolerancia de descuadre

| Descuadre | Acción |
|---|---|
| <= tolerancia (default 1%) | Cierre normal a `closed` |
| > tolerancia y <= 5% | Requiere motivo, cierra a `closed_with_difference` |
| > 5% | Requiere autorización admin |
| > 10% | Requiere autorización owner |

Tolerancia configurable en `company_settings.cash_difference_tolerance_percent`.

## 10.6 Reportes de turno

Al cerrar turno (cualquier status terminal), generar PDF automático con:

- Período (apertura → cierre)
- Monto inicial
- Ventas totales por método de pago
- Gastos del turno (Fase 1+)
- Anulaciones del turno
- Diferencia (si aplica)
- Items vendidos (resumen top 10)
- Cajero responsable

PDF guardado en Storage con TTL 10 años (fiscal).

---

# 11. Fiscal: AFIP/ARCA

🟢 **VERDE** + 🟡 **AMARILLO** (validación contable pendiente)

## 11.1 Stack fiscal

| Servicio | Uso | Implementación |
|---|---|---|
| **WSAA** | Autenticación con certificado X.509 | Sincrónico, token TTL 12h |
| **WSFEv1** | Facturación electrónica A/B/C | Sincrónico con timeout 30s |
| **WSPN A5 (Padrón)** | Validación CUIT y condición IVA | Cache 7 días + revalidación 24h |
| **WSMTXCA** | Comprobantes especiales | Evaluar en F2, no F0 |

## 11.2 Certificados

```typescript
interface AfipCertificate {
  id: string;
  companyId: string;
  certificatePem: string;        // X.509 encriptado en DB
  privateKeyPem: string;         // RSA encriptada en DB
  cn: string;                    // Common Name del certificado
  issuer: string;
  validFrom: Date;
  validUntil: Date;
  environment: 'homologation' | 'production';
  active: boolean;
  createdAt: Date;
}
```

**Reglas:**

- Solo 1 certificado activo por (company_id, environment) — `UNIQUE constraint`.
- Encriptación at-rest con AES-256 (clave en Supabase Vault).
- Solo owner puede subir/cambiar certificado.
- Audit log al subir/rotar/eliminar.
- Alertas de vencimiento: 30, 15, 7, 3, 1 días antes.

## 11.3 Tokens WSAA

```typescript
interface AfipToken {
  id: string;
  companyId: string;
  service: 'wsfev1' | 'ws_sr_padron_a5' | 'wsmtxca';
  token: string;                 // encriptado
  sign: string;                  // encriptado
  generationTime: Date;
  expirationTime: Date;          // típicamente 12 horas
  environment: 'homologation' | 'production';
}
```

**Reglas:**
- Token reutilizado dentro de TTL para evitar throttling AFIP.
- Refresh automático 30 min antes de expiración.
- Token expirado nunca se intenta usar.

## 11.4 Numeración fiscal correlativa

🟢 **VERDE** — Formalizado en ADR-0006 + retry serializable en ADR-0011.

```typescript
interface InvoiceSequence {
  id: string;
  companyId: string;
  salePointId: string;
  invoiceType: InvoiceType;      // 'A' | 'B' | 'C' | 'M' | etc.
  lastNumber: number;
  updatedAt: Date;
}
```

**Reserva atómica con SELECT FOR UPDATE + transacción serializable:**

```typescript
async function reserveInvoiceNumber(
  tx: Transaction,
  salePointId: string,
  invoiceType: InvoiceType
): Promise<number> {
  const seq = await tx.execute(sql`
    SELECT last_number 
    FROM invoice_sequences 
    WHERE sale_point_id = ${salePointId} 
    AND invoice_type = ${invoiceType}
    FOR UPDATE
  `);
  
  const nextNumber = seq.rows[0].last_number + 1;
  
  await tx.update(invoiceSequences)
    .set({ last_number: nextNumber, updated_at: new Date() })
    .where(and(
      eq(invoiceSequences.salePointId, salePointId),
      eq(invoiceSequences.invoiceType, invoiceType)
    ));
  
  return nextNumber;
}
```

**Números quemados nunca se reutilizan.** Si AFIP rechaza el comprobante, el número queda como `burned`.

## 11.5 Flujo de facturación

🟢 **VERDE** + 🟡 **AMARILLO** (política de "ticket no fiscal válido" pendiente de validación)

```typescript
async function issueInvoice(tx: Transaction, input: IssueInvoiceInput) {
  // 1. Customer snapshot fresh (con revalidación Padrón si > 24h)
  const customerSnapshot = await buildFreshCustomerSnapshot(input.customer);
  
  // 2. Determinar tipo de comprobante según condición IVA del cliente + tenant
  const invoiceType = determineInvoiceType(
    input.tenantIvaCondition,
    customerSnapshot.iva_condition
  );
  
  // 3. Reservar número correlativo
  const number = await reserveInvoiceNumber(tx, input.salePointId, invoiceType);
  
  // 4. Insertar afip_invoice en estado 'pending'
  const [invoice] = await tx.insert(afipInvoices).values({
    company_id: input.companyId,
    sale_id: input.saleId,
    sale_point_id: input.salePointId,
    invoice_type: invoiceType,
    invoice_number: number,
    customer_snapshot: customerSnapshot,
    total: input.total,
    iva_breakdown: input.ivaBreakdown,
    status: 'pending',
    requested_at: new Date(),
  }).returning();
  
  // 5. Llamar AFIP WSFEv1 con timeout 30s
  try {
    const cae = await Promise.race([
      afipClient.requestCAE(invoice, customerSnapshot),
      timeoutAfter(30000),
    ]);
    
    if (cae.success) {
      await tx.update(afipInvoices)
        .set({ 
          status: 'issued',
          cae: cae.cae,
          cae_expiration: cae.expiration,
          afip_response: cae.rawResponse,
          issued_at: new Date(),
        })
        .where(eq(afipInvoices.id, invoice.id));
      return { ...invoice, cae: cae.cae };
    } else {
      // AFIP rechazó: número quemado
      await tx.update(afipInvoices)
        .set({
          status: 'burned',
          afip_error: cae.error,
          afip_response: cae.rawResponse,
        })
        .where(eq(afipInvoices.id, invoice.id));
      throw new BusinessError('AFIP_REJECTED', cae.error);
    }
  } catch (err) {
    if (err.code === 'TIMEOUT') {
      // Timeout: requires_reconciliation
      await tx.update(afipInvoices)
        .set({ 
          status: 'requires_reconciliation',
          timeout_at: new Date(),
          attempts: 0,
        })
        .where(eq(afipInvoices.id, invoice.id));
      
      // Encolar worker de reconciliación
      await scheduleReconciliation(invoice.id);
      
      // Devolver invoice sin CAE — caller debe emitir ticket no fiscal
      return { ...invoice, cae: null, status: 'requires_reconciliation' };
    }
    throw err;
  }
}
```

## 11.6 Reconciliation worker

🟢 **VERDE** — Cadencia definida en Sesión 3.5.

**Worker:** `afip-reconciliation`
**Frecuencia:** cada 5 minutos.

**Por cada `afip_invoice` en `requires_reconciliation`:**

```
1. Verificar attempts < 24
   Si >= 24: → reconciliation_timeout (terminal)
            → audit_log
            → notificación owner

2. Consultar AFIP:
   - FECompUltimoAutorizado para (sale_point, invoice_type)
   - Si último >= número reservado:
     → FECompConsultar(número reservado)
     → Si CAE existe: status = 'issued', save CAE
     → Si rechazo: status = 'burned'
   - Si último < número reservado:
     → AFIP no procesó. Incrementar attempts.

3. Incrementar attempts y next_attempt_at = now() + interval '5 minutes'
```

**Tope temporal duro:** 2 horas = 24 intentos × 5 min.

**Notificaciones intermedias:**
- 30 min: email "Tu factura sigue pendiente, seguimos intentando."
- 1h: email + dashboard banner.
- 2h (terminal): email + alerta visible en POS.

## 11.7 Estados de afip_invoice

Ver máquina de estado completa en Sección 16 (SM-03 Invoice).

Resumen:
- `pending`: insertado, AFIP no contactado todavía
- `issued`: CAE recibido
- `failed`: AFIP rechazó explícitamente
- `requires_reconciliation`: timeout, worker reintenta
- `reconciliation_timeout`: terminal, no se pudo emitir tras 2h
- `burned`: número quemado, NUNCA se reutiliza

## 11.8 Customer snapshot fiscal

🟢 **VERDE** — Crítico (Sesión 3.5).

```sql
ALTER TABLE afip_invoices ADD CONSTRAINT invoice_customer_snapshot_not_empty
CHECK (
  customer_snapshot != '{}'::jsonb
  AND customer_snapshot ? 'legal_name'
  AND customer_snapshot ? 'iva_condition'
  AND customer_snapshot ? 'captured_at'
);
```

**Captura:**

```typescript
const fiscalSnapshot = {
  legal_name: customer.legal_name ?? customer.name,
  document_type: customer.document_type,
  document_number: customer.document_number,
  iva_condition: customer.iva_condition,
  fiscal_address: customer.fiscal_address,
  captured_at: new Date().toISOString(),
  source: padron_fresh ? 'padron_a5_fresh' : 'cache_within_24h',
};
```

## 11.9 Retención de XML

🟡 **AMARILLO** — Política de 10 años, validar con contador.

- XML request/response de cada llamada AFIP persistido.
- Hot storage (DB) 2 años.
- Cold storage (S3 Glacier) años 2-10.
- Cron mensual de archivado.
- Acceso a archivado: async, 24-48h.

## 11.10 Redondeo

🟡 **AMARILLO** — Validar con contador qué política exacta espera AFIP.

**Política propuesta:**

- Cálculos internos: `numeric(19,4)` (ADR-0005).
- Presentación AFIP: redondeo half-up al centavo (2 decimales).
- Cálculo de IVA: redondeo por línea (no solo en total).

```typescript
function roundHalfUp(value: number, decimals: number = 2): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}
```

## 11.11 Tipos de comprobante

Determinación según condición IVA del tenant y del cliente:

| Tenant | Cliente | Comprobante |
|---|---|---|
| RI | RI | A |
| RI | Monotributo | B |
| RI | Consumidor Final | B |
| RI | Exento | B |
| Monotributo | RI | C |
| Monotributo | Monotributo | C |
| Monotributo | Consumidor Final | C |

(Tabla resumida, validar matriz completa con contador.)

## 11.12 Notificaciones operativas de AFIP

🟢 **VERDE** — Sesión 1, Fix 9.

**Cuando venta queda en `requires_reconciliation`:**

1. **Inmediato (toast 5s):** "AFIP no respondió. Ticket no fiscal emitido. La factura saldrá automáticamente."
2. **Dashboard:** panel con sales en `requires_reconciliation`, contador "X intentos, próximo a HH:MM".
3. **Cada 5 min si exitosa:** email + push (F1+): "Tu factura #X salió."
4. **Tras 2h sin éxito:** email + alerta POS: "Contactá a tu contador para gestión manual."

---

# 12. Notifications

🟢 **VERDE**

## 12.1 Stack

| Servicio | Canal | Fase |
|---|---|---|
| Resend | Email | F0 |
| Twilio | SMS | F0 (solo alertas owner) |
| WhatsApp Business Cloud API | WhatsApp | F1+ |
| Push web (Service Workers) | Push browser | F1+ |

## 12.2 Modelo

```typescript
interface Notification {
  id: string;
  companyId: string;
  templateKey: string;
  recipient: string;             // email o teléfono
  recipientUserId?: string;
  channel: 'email' | 'sms' | 'whatsapp' | 'push';
  status: 'pending' | 'sent' | 'delivered' | 'bounced' | 'failed';
  subject?: string;
  bodyData: jsonb;               // variables del template
  externalMessageId?: string;
  sentAt?: Date;
  deliveredAt?: Date;
  failedReason?: string;
  metadata: jsonb;
  createdAt: Date;
}

interface NotificationTemplate {
  key: string;
  channel: 'email' | 'sms' | 'whatsapp' | 'push';
  subject?: string;
  body: string;                  // con placeholders {{var}}
  active: boolean;
}
```

## 12.3 Templates Fase 0

| Key | Canal | Trigger |
|---|---|---|
| `welcome_signup` | email | Usuario crea cuenta |
| `demo_expiring_7d` | email | 7 días antes de fin demo |
| `demo_expiring_1d` | email | Día antes de fin demo |
| `demo_blocked` | email | Demo bloqueado |
| `password_reset` | email | Recuperación contraseña |
| `user_invited` | email | Owner invita usuario |
| `accountant_invited` | email | Owner invita contador |
| `sale_completed_to_customer` | email | Cliente con email recibe ticket digital (opt-in) |
| `daily_summary_owner` | email | Resumen diario al owner 23:00 |
| `cash_session_closed_with_difference` | email | Cierre con descuadre > tolerancia |
| `afip_invoice_reconciled` | email | Factura reconciliada exitosa |
| `afip_invoice_reconciliation_timeout` | email | Reconciliación falló |
| `afip_certificate_expiring_30d` | email | Certificado vence en 30 días |
| `afip_certificate_expiring_7d` | email + SMS | Certificado vence en 7 días |
| `payment_due` | email | Suscripción no cobrada día 1 |
| `grace_period_warning_d7` | email + SMS | Día 7 de impago |
| `reading_mode_activated` | email | Día 11 de impago |
| `suspension_imminent` | email + SMS | Día 30 de impago |
| `negative_stock_alert` | email | Venta con stock negativo (a owner) |
| `cross_tenant_blocked` | email | Sistema bloqueó intento cross-tenant |

## 12.4 Rate limiting anti-spam

- Máximo 1 mismo template/destinatario/día.
- Horario respetado: 9:00-21:00 hora local del tenant.
- Excepciones (críticas, cualquier hora): `afip_invoice_reconciliation_timeout`, `cross_tenant_blocked`, `suspension_imminent`.

## 12.5 Opt-in / opt-out

- Email transaccional al cliente del comerciante: opt-in al crear cliente con email.
- Notificaciones de Pandora al owner: obligatorias (operacionales, no marketing).
- Unsubscribe link en todo email (excepto críticos transaccionales).

## 12.6 Reputación de dominio

🟢 **VERDE** — Crítico para deliverability.

- DNS configurado correctamente: SPF, DKIM, DMARC antes del primer envío.
- Monitoreo de bounce rate. Si > 10%: alerta crítica.
- Monitoreo de spam complaints. Si > 0.1%: investigación obligatoria.
- IPs warming gradual con Resend en primeras semanas.

## 12.7 WhatsApp (Fase 1+)

🟢 **VERDE** — Política definida en Sesión 1, Fix 7.

- Canal default Fase 1: Email.
- Canal opcional Fase 1: SMS + WhatsApp.
- WhatsApp requiere Business Manager verificado + templates aprobados (24-72h por Meta).
- SMS Twilio es fallback inmediato si WhatsApp no aprobado.

**Templates a aprobar Fase 1:**
- Recordatorio de pago
- Confirmación de pedido (omnicanal F2)
- Comprobante digital de venta

---

*[Sesión 4 — Parte 2 de 5 — Continúa en parte 3]*
