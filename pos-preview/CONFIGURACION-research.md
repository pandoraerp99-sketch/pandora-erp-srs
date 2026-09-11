# Configuración de Pandora — qué debe tener (research riguroso)

> Investigación 2026-06-24 sobre paneles de configuración de POS/ERP reales (Loyverse, Lightspeed X/R, Square, KORONA) + requisitos fiscales AR (ARCA/AFIP) + control de acceso + hardware. Objetivo: definir TODO lo útil/práctico/indispensable que debe ofrecer el panel de Configuración, marcando lo que **ya está** en el mockup vs los **gaps**, y la prioridad (F0 indispensable / F1+ / F2+). Cada bloque con su fundamento.

## Leyenda
- 🟢 **F0 indispensable** — sin esto no se puede operar/facturar.
- 🟡 **F0.5/F1** — muy útil, no bloquea el arranque.
- 🔵 **F2+** — escala / nice-to-have.
- ✅ ya en `configuracion-v1.html` · ➕ gap a incorporar.

---

## 1. Empresa y fiscal — 🟢 ✅ (ampliar)
Identidad fiscal del comercio. Ya está; **faltan**:
- ➕ **Logo del comercio** (va en ticket/factura/email).
- ➕ **Rubro / actividad** (código de actividad AFIP) — afecta alícuotas y régimen.
- ➕ **Teléfono / email comercial** (para el comprobante y el cliente).
- ➕ **Múltiples CUIT / empresas** (un dueño con 2 comercios) — atado a multi-tenant.

## 2. Conexión AFIP / ARCA — 🟢 ✅ (ampliar, lo más crítico)
Es lo que habilita facturar. Requisitos reales 2026: CUIT activo + **clave fiscal nivel 3+** + **certificado digital vigente** + **punto de venta WS habilitado**. Ya están certificado/ambiente/PV/estado; **faltan**:
- ➕ **Servicios habilitados** (WSFE Facturación + Padrón A5/constancia + WSAA) con check de estado.
- ➕ **Alerta de vencimiento de certificado** (avisar 30 días antes — si vence, NO se factura → fail-closed).
- ➕ **Botón "Probar conexión"** (emite comprobante de prueba en homologación → valida CAE).
- ➕ **Cambio de ambiente Homologación↔Producción** con confirmación (cutover).
> Fuentes: [Guía certificado ARCA](https://www.kontto.com.ar/factura-electronica.html) · [Manual desarrollador ARCA COMPG v4.0](https://www.afip.gob.ar/fe/documentos/manual-desarrollador-ARCA-COMPG-v4-0.pdf) · [Habilitación puntos de venta ARCA](https://www.afip.gob.ar/derechos-de-exportacion-de-servicios/comprobantes-y-facturacion/)

## 3. Puntos de venta — 🟢 ✅ (ampliar)
- ➕ **Numeración actual por PV y tipo** (último número emitido de A/B/C) — visible y auditable.
- ➕ **Sincronizar con ARCA** (`FECompUltimoAutorizado`) para evitar saltos/duplicados.
- ➕ Asignar cada PV a una **sucursal/ubicación** y a una **caja**.

## 4. Comprobantes y numeración — 🟢 ➕ (GAP grande, indispensable)
Define qué y cómo se factura. **Nada de esto está**:
- 🟢 **Tipos habilitados** (Factura A/B/C, Nota de Crédito, Nota de Débito) y **comprobante por defecto** para consumidor final.
- 🟢 **Leyendas obligatorias** configurables: *Régimen de Transparencia Fiscal al Consumidor Ley 27.743*, *Ley 19.640 — mercadería amparada*, defensa al consumidor. (Atado a hallazgo fiscal del proyecto.)
- 🟢 **Umbral de identificación**: desde qué monto se exige DNI/CUIT del cliente (RG ARCA).
- 🟡 **Copia automática por email** al cliente (plazo 10 días post-CAE).
- 🟡 **Formato**: ticket 58/80mm vs A4 · con/sin QR · con/sin detalle de IVA.
- 🟡 **CAEA / contingencia**: comportamiento ante caída de ARCA.

## 5. Impuestos, redondeo y precios — 🟢 ➕ (GAP, indispensable)
- 🟢 **Modo de redondeo** `HALF_EVEN` + etapa `PER_LINE` (ya decidido por ADR-0005 — exponerlo, no editable sin contador).
- 🟢 **Redondeo de efectivo** (a $10/$50/$100 — no hay monedas chicas) con registro de la diferencia.
- 🟢 **Precios mostrados con/sin IVA** (consumidor final = con IVA incluido).
- 🟡 **Percepciones IIBB** (alícuota AREF) automáticas.
- 🟡 **Listas de precios** (minorista / mayorista) + **descuento máximo permitido** sin autorización.
- 🟡 **Recargo por tarjeta / cuotas** (config de financiación).
> Fuentes: [Lightspeed general options](https://retail-support.lightspeedhq.com/hc/en-us/articles/228842387-Configuring-general-options) · [tax & rounding settings](https://heartlandpos.zendesk.com/hc/en-us/articles/18724494067355-Cash-Discounting-Guide)

## 6. Medios de pago — 🟢 ✅ (sección existe, ampliar)
- 🟢 **Efectivo** (on) + **denominaciones de moneda** AR (para arqueo por denominación).
- 🟢 **Débito/Crédito (posnet)**: qué tarjetas, recargo, cuotas, conciliación del cierre.
- 🟢 **MercadoPago QR**: **vincular cuenta** (credenciales/OAuth), webhook, conciliación automática.
- 🟡 **Transferencia / CVU/alias**, **cuenta corriente** (límite de crédito por cliente).

## 7. Usuarios y permisos — 🟢 ➕ (GAP CRÍTICO de seguridad)
Lo más subrayado por la industria. **Casi nada está**:
- 🟢 **Roles**: Dueño / Encargado / Cajero / Contador (read-only multi-empresa).
- 🟢 **Permisos granulares** — y **gatear los 3 más abusados: anulaciones, devoluciones y descuentos** (causa principal de robo hormiga).
- 🟢 **Límites por rol**: monto máximo de descuento/devolución, horario de acceso, monto que requiere autorización del encargado (PIN).
- 🟢 **PIN por cajero** + cuentas individuales (nunca compartidas) + **timeout de sesión** (idle 30min / absoluta 12h — ADR-0019).
- 🟢 **Invitar al contador** (entra con su login, ve N empresas — ADR-0008).
- 🟡 **Registro de actividad / audit trail** por usuario (quién anuló/descontó/abrió caja).
> Fuentes: [Loyverse access rights](https://help.loyverse.com/help/how-manage-access-rights-employees) · [Lightspeed roles & permissions](https://x-series-support.lightspeedhq.com/hc/en-us/articles/25534171377819-Setting-user-roles-and-permissions) · [POS permissions strategies](https://hostmerchantservices.com/2026/04/pos-permissions/)

## 8. Caja — 🟢 ➕ (GAP, operativo indispensable)
- 🟢 **Fondo inicial por defecto** + **arqueo obligatorio al cierre**.
- 🟢 **Tolerancia de descuadre** (a partir de qué diferencia exige motivo / alerta).
- 🟢 **Quién puede cerrar caja** y **relevo de turno** (cambio de cajero sin cerrar el día).
- 🟡 **Umbral de alivio/sangría** (avisar cuando el efectivo supera $X → retirar al depósito).

## 9. Stock / inventario — 🟡 ➕ (GAP)
- 🟢 **¿Permitir vender sin stock?** (sí/no) — clave anti-oversell.
- 🟡 **Stock mínimo** global + alertas de reposición.
- 🟡 **Descuento de stock automático** por venta + **control por ubicación** (Local/Depósito).
- 🟡 **Método de costo** (último / promedio ponderado) + motivos de ajuste.
> Fuentes: [Lightspeed inventory/re-order](https://www.bosstab.com/resources/software-guides/pos-systems/lightspeed/)

## 10. Impresora y hardware — 🟢 ✅ (sección existe, detallar)
- 🟢 **Impresora de tickets**: modelo, conexión (USB/red/BT), ancho **58/80mm**, nº de copias, imprimir automático vs preguntar.
- 🟢 **Lector de código de barras** (teclado-emulación, prefijo/sufijo).
- 🟢 **Cajón de dinero**: apertura **siempre / solo efectivo / nunca**.
- 🟡 **Balanza** (productos por peso, PLU), **visor de cliente**.
> Fuentes: [Lightspeed cash drawer](https://retail-support.lightspeedhq.com/hc/en-us/articles/228842547-Setting-up-a-cash-drawer) · [ConnectPOS hardware](https://www.connectpos.com/best-pos-systems-supporting-receipts-customization/)

## 11. Clientes y fidelización — 🟡 ➕
- 🟡 **Validación de CUIT contra Padrón ARCA** al cargar cliente.
- 🔵 **Programa de puntos / fidelización** (F2+ — NON-GOAL hasta cliente que lo pida).

## 12. Notificaciones y alertas — 🟡 ✅ (sección existe, definir contenido)
Qué avisar + a quién + por dónde (email / push / WhatsApp F1+):
- 🟢 **CAE rechazado** / factura pendiente de reconciliación (fiscal — crítico).
- 🟢 **Caja sin cerrar** al fin del día.
- 🟡 **Stock bajo / sin stock**, **vencimientos fiscales** (IVA/IIBB/Ganancias).
- 🟡 **Certificado ARCA por vencer**, dead jobs > 4h.

## 13. Integraciones — 🟡 ➕
- 🟢 **Contador**: export a Tango / Xubio / Bejerman / Holistor + Libro IVA Digital.
- 🟢 **MercadoPago** (cobros).
- 🟡 **Casilla de carga asistida** de facturas de compra (foto/email) — ver [[feature-carga-asistida-facturas-compra]].
- 🔵 Email (Resend), e-commerce (ML/Tiendanube F2+), API pública (F3+).

## 14. Seguridad y respaldos — 🟡 ➕ (GAP)
- 🟢 **Sesiones activas** (ver/cerrar dispositivos) + cierre remoto.
- 🟡 **2FA**, política de contraseñas, **log de auditoría** consultable.
- 🟡 **Exportar mis datos**, política de retención (10 años fiscal).

## 15. Plan y facturación (de Pandora) — 🟡 ✅ (sección existe)
- Plan actual + **uso** (ventas/mes, usuarios, PV) + método de pago + **facturas que Pandora le emite** + upgrade/baja.

## 16. Privacidad y legal (Ley 25.326) — 🟡 ➕
- 🟡 **T&C aceptados** + **Política de privacidad** + inscripción **AAIP**.
- 🟡 **Derechos ARCO** de los clientes (acceso/rectificación/supresión).
> Pendiente abogado (B-7/B-8/B-9 del advisor doc).

## 17. Preferencias / apariencia — 🔵 ➕
- 🔵 Zona horaria (America/Argentina/Ushuaia), formato moneda/fecha (es-AR), tema/atmosphere, densidad, sonidos de confirmación.

---

## Resumen — los gaps INDISPENSABLES (🟢) que NO estaban
1. **Comprobantes y numeración** (tipos, leyendas Ley 27.743/19.640, umbral de identificación). *(sección nueva)*
2. **Impuestos, redondeo y precios** (redondeo de efectivo, precios c/IVA, descuento máximo). *(sección nueva)*
3. **Usuarios y permisos de verdad** (roles + gatear anulaciones/devoluciones/descuentos + PIN + límites). *(la más crítica de seguridad)*
4. **Caja** (fondo inicial, arqueo obligatorio, tolerancia, quién cierra). *(sección nueva)*
5. **Conexión ARCA ampliada** (servicios habilitados, alerta de vencimiento, probar conexión).
6. **Medios de pago operativos** (vincular MercadoPago, denominaciones, recargo tarjeta).
7. **Hardware detallado** (cajón: cuándo abre; lector de barras; ancho de ticket).
8. **¿Vender sin stock?** (un solo toggle, altísimo impacto).

## Notas de coherencia con el proyecto
- Redondeo `HALF_EVEN`/`PER_LINE` y leyendas Ley 27.743 **ya están decididos** (ADR-0005 / hallazgo fiscal) → en Configuración se **muestran**, no se editan sin contador.
- Roles/permisos, timeout de sesión y support-mode salen de ADR-0008/ADR-0019.
- Feature flags por tenant (ADR-0009) → varias de estas son flags, no pantallas duras.
- Muchos toggles son **F0 "mostrar el estado", la edición real es F1+** (no sobre-construir).
