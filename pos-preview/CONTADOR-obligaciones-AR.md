# Carga laboral del Contador en Argentina — mapa exhaustivo para Pandora

> Investigación 2026-06-22 (fuentes oficiales ARCA/AREF/Infoleg). Objetivo: identificar **todo** lo que hace un contador de un comercio chico (RI o Monotributo, foco TDF) para que Pandora le saque la mayor carga. Ilustrativo / visión futura (F1–F2). Verificar RG y fechas exactas contra fuente oficial antes de implementar.

## A. MENSUAL (el grueso de la carga)

| Obligación | Norma / form | Vence | Qué hace el contador | Cómo lo automatiza Pandora |
|---|---|---|---|---|
| **IVA — DDJJ + Libro IVA Digital** | RG 4597 (reemplazó CITI/RG 3685) · F2002 | día 18–22 s/ CUIT | Registra ventas y compras, determina débito/crédito, presenta | **Genera Libro IVA Ventas+Compras + posición + archivo de importación** ✅ (ya en panel) |
| **IIBB provincial** | TDF: **AREF** · Convenio Multilateral CM03 si opera en varias provincias | ~15–20 | Liquida IIBB, aplica alícuotas/exenciones, percepciones | Liquidación IIBB + base imponible + percepciones/retenciones (parcial) |
| **Retenciones/percepciones** | **SIRE** (reemplaza SICORE) · F2003/F2004 · TDF retenciones IIBB **SIRCIP** (RG CA 9/2025) | ~10 | Carga retenciones practicadas/sufridas, emite certificados | Registro de retenciones + certificados + archivo SIRE (gap) |
| **Empleados — Cargas sociales** | **F931** + **Libro de Sueldos Digital (LSD)** | día 9–11 | Liquida sueldos, SAC, ART, sindicato; arma F931 | Liquidación de sueldos + generación LSD/F931 (gap, F1+) |
| **Monotributo (si aplica)** | cuota mensual | día 20 | Controla pago + parámetros | Control de cuota + alerta de límite |

## B. SEMESTRAL

| Obligación | Vence | Qué hace | Pandora |
|---|---|---|---|
| **Recategorización Monotributo** | enero y julio | Recalcula categoría según ingresos brutos + energía + alquileres + superficie (12 meses) | **Calcula ingresos acumulados, sugiere categoría y alerta riesgo de exclusión** (tope facturación cat. A $10,27M – K $108,3M 2026; precio unitario máx. ~$613k) (gap) |

## C. ANUAL

| Obligación | Form | Qué hace | Pandora |
|---|---|---|---|
| **Ganancias** (humanas/sociedades) | DDJJ anual + anticipos bimestrales | Determina resultado impositivo, ajustes | Estado de Resultados + papeles de trabajo ✅ |
| **Bienes Personales** | junio | Patrimonio | — |
| **Estados contables** | Balance + EERR + EFE + anexos | Cierre + dictamen/certificación | Balance · EERR · Sumas y Saldos exportables ✅ |

## D. TRANSVERSAL / EVENTUAL

- **Conciliación bancaria** — extractos vs registros (clave, recurrente). → Import extracto + match automático. **(gap, alto valor)**
- **Cuentas corrientes** clientes/proveedores (saldos, antigüedad).
- **Régimen de información** varios + constancias (inscripción, no retención).
- **Plan de cuentas / Libro Diario / Libro Mayor** (ya en panel) ✅.

## Documentación que el contador junta del comercio cada mes

1. Comprobantes **emitidos** (ventas) ✅ Pandora los tiene
2. Comprobantes **recibidos** (compras + gastos) ✅ carga asistida (foto/email)
3. **Extractos bancarios** → para conciliación (gap)
4. **Recibos de sueldo / liquidaciones** (si hay empleados)
5. **Resúmenes de tarjeta / MercadoPago** → conciliación de cobros
6. Papeles de trabajo, retenciones sufridas, certificados

## Lo que le ahorra MÁS trabajo (prioridad Pandora)

1. **Libro IVA Digital listo para importar** ✅
2. **Asientos contables auto-generados** (partida doble) ✅
3. **Conciliación bancaria + MP automática** ⬅ gap top
4. **Liquidación de sueldos + F931/LSD** ⬅ gap (si hay empleados)
5. **Alertas**: vencimientos + recategorización monotributo + riesgo de exclusión ⬅ gap
6. **Export directo** a su sistema (Tango/Xubio/Bejerman/Holistor/Colppy) + a ARCA ✅
7. **SIRE** retenciones practicadas/sufridas consolidadas ⬅ gap parcial
8. **Convenio Multilateral / IIBB** liquidación ⬅ gap parcial

## Gaps del panel actual (orden de impacto)

1. **Conciliación bancaria + MercadoPago** (sección nueva)
2. **Recategorización Monotributo + alerta de exclusión** (card)
3. **Sueldos / Libro de Sueldos Digital / F931** (módulo)
4. **SIRE — retenciones practicadas** (hoy solo sufridas)
5. **IIBB / Convenio Multilateral** liquidación detallada
6. **Cuentas corrientes** clientes/proveedores con antigüedad de saldos

## Fuentes
- ARCA — Vencimientos: https://www.afip.gob.ar/vencimientos/ · Calendario 2026 (BBVA): https://www.bbva.com/es/ar/empresas/calendario-fiscal-arca-2026-en-argentina-monotributo-iva-ganancias-y-aportes/
- Libro IVA Digital (RG 4597, derogó CITI/RG 3685): https://www.afip.gob.ar/iva/documentos/Libro-IVA-Digital-Especificaciones.pdf · https://blogdelcontador.com.ar/news-23687-rg-4597-afip-libro-iva-digital
- SIRE (reemplaza SICORE): https://www.afip.gob.ar/sire/
- Libro de Sueldos Digital / F931: https://www.afip.gob.ar/librodesueldosdigital/
- Monotributo categorías 2026: https://www.afip.gob.ar/monotributo/documentos/categorias/ · escalas: https://www.iprofesional.com/impuestos/457386
- AREF (IIBB TDF) + SIRCIP RG CA 9/2025: https://www.aref.gob.ar/impuesto-sobre-los-ingresos-brutos/
- Ley 19.640 (régimen TDF): https://prodyambiente.tierradelfuego.gob.ar/regimen-de-promocion-economica-y-fiscal-ley-19-640-2/
