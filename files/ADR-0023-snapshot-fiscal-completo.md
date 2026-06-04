# ADR-0023 — Snapshot Fiscal Completo (extensión de ADR-0022)

**Fecha:** 2026-06-02
**Estado:** Aprobado
**Relacionado con:** ADR-0022 (Fiscal Projection Layer + Snapshot — **amplía**), ADR-0004 (AFIP sincrónico), ADR-0005 (money), ADR-0006 (numeración fiscal), ADR-0010 (idempotency)
**Reemplaza:** ninguno (extiende ADR-0022 sin invalidarlo)
**Validación:** 🟡 Pendiente validación humana A-22 (representación legal QR — ver §8)

## Contexto

ADR-0022 (2026-05-26) estableció Fiscal Projection Layer + Fiscal Snapshot inmutable con la promesa de **"reproducibilidad histórica de comprobantes años después"**. La investigación de fuentes oficiales realizada el 2026-06-02 ([[research-fuentes-oficiales-adr-0023-2026-06-02]]) reveló **4 gaps específicos** en el snapshot definido por ADR-0022 que impedirían cumplir esa promesa en escenarios reales de auditoría a 5/10 años.

### Investigación verificada contra fuentes primarias (2026-06-02)

| Norma | Publicación BO | Vigencia | Establece |
|---|---|---|---|
| [RG 4892/2020](https://www.boletinoficial.gob.ar/detalleAviso/primera/239173/20201224) | 24/12/2020 | Vigente | QR fiscal obligatorio (extiende RG 4291/2018) |
| [RG 5616/2024](https://biblioteca.afip.gob.ar/search/query/norma.aspx?p=t:RAG%7Cn:5616%7Co:9%7Ca:2024%7Cf:17/12/2024) | 18/12/2024 | 01/08/2025 (tras 2 prórrogas) | `CondicionIVAReceptorId` obligatorio en payload WSFEv1 |
| [RG 5762/2025](https://www.boletinoficial.gob.ar/detalleAviso/primera/331947/20250925) | 25/09/2025 | 01/12/2025 | Elimina factura M, crea 2 sub-tipos A ("OPERACIÓN SUJETA A RETENCIÓN" y "PAGO EN CBU INFORMADA") |
| [RG 5782/2025](https://www.argentina.gob.ar/normativa/nacional/resoluci%C3%B3n-5782-2025-419496/texto) | 30/10/2025 | 01/08/2026 (postergada) | CAE como regla general, CAEA solo para contingencias |
| [RG 5785/2025](https://www.boletinoficial.gob.ar/detalleAviso/primera/333886/20251103) | 03/11/2025 | 01/08/2026 (postergada) | Complementaria — adecua RG 4290, habilita CAEA reemplazo CAE en WebService |
| [RG 5852/2026](https://www.boletinoficial.gob.ar/detalleAviso/primera/342594/20260529) | 29/05/2026 | Inmediata | Posterga RG 5782 + RG 5785 al 01/08/2026 |

### Especificación QR oficial verificada

Fuente primaria: [PDF oficial ARCA](https://www.afip.gob.ar/fe/qr/documentos/QRespecificaciones.pdf)

```
URL del QR: https://www.arca.gob.ar/fe/qr/?p={DATOS_CMPBASE64}
Encoding: Base64
Formato datos: JSON
Versión actual: 1 (explícito en payload — reserva espacio para v2+)
```

13 campos del payload JSON (11 obligatorios + 2 "DE CORRESPONDER"):
`ver`, `fecha`, `cuit`, `ptoVta`, `tipoCmp`, `nroCmp`, `importe`, `moneda`, `ctz`, `tipoDocRec` (corresponder), `nroDocRec` (corresponder), `tipoCodAut` ("A"=CAEA / "E"=CAE), `codAut`.

### Gaps identificados en ADR-0022

1. **CondicionIVAReceptorId NO está como columna propia del snapshot.** ADR-0022 menciona `merchant_special_regime` pero no la condición IVA del **receptor**, que es obligatoria desde 01/08/2025 (RG 5616/2024). El payload WSFEv1 lo lleva, pero no queda persistido como dato auditable independiente.

2. **QR fiscal NO se persiste.** ADR-0022 no contempla el payload QR ni su versión. Sin esto, una reimpresión a 5 años puede generar un QR DIFERENTE al original si la spec ARCA cambia (la spec actual es "versión 1" explícita).

3. **`tax_policy_version` existe en ADR-0022 pero sin convención formal.** El campo está, pero no hay convención de naming ni documento versionado externo que defina qué reglas formaban parte de cada perfil. Esto deja la reproducibilidad histórica colgando.

4. **Distinción CAE vs CAEA NO está explícita.** ADR-0022 asume WSFEv1 → CAE, pero RG 5782/2025 (vigente 01/08/2026) introduce CAEA como modalidad de contingencia. El QR distingue ambos con `tipoCodAut` ("A"=CAEA / "E"=CAE). Sin persistir esto, el snapshot pierde un campo regulatoriamente relevante.

## Decisión

**Ampliar Fiscal Snapshot con 4 secciones nuevas, sin invalidar campos existentes de ADR-0022.**

### Decisión 1 — CondicionIVAReceptorId persistido como par {id, desc_at_emission}

**Pattern:** `condicion_iva_receptor_id` (numérico oficial ARCA) + `condicion_iva_receptor_desc_at_emission` (descripción **al momento de emitir**, NO la actual).

**Por qué ambos campos:**
- Sin `id`: queries de auditoría dependen de match por string (frágil).
- Sin `desc_at_emission`: si ARCA renombra una condición en 2030 (ej. "IVA Responsable Inscripto" → "IVA RI"), el snapshot histórico depende de catálogo externo para interpretarse.
- Con ambos: snapshot **autosuficiente**.

**Sufijo `_at_emission`:** previene confusión "descripción actual" vs "descripción histórica". El nombre del campo deja claro que captura el momento histórico.

**Fuente del valor:** lookup en runtime contra `FEParamGetCondicionIvaReceptor` del WSFEv1 al momento de emitir. Catálogo cacheado en módulo fiscal (ver ADR-0025 cuando se escriba).

### Decisión 2 — QR fiscal persistido con `qr_version` + `qr_payload_json`

**Pattern:** persistir TANTO la versión de spec del QR como el payload JSON COMPLETO (no la imagen).

```typescript
qr_version: 1,  // versión spec ARCA al momento de emitir
qr_payload_json: {
  ver: 1,
  fecha: "2026-08-15",
  cuit: 30712345678,
  ptoVta: 1,
  tipoCmp: 6,
  nroCmp: 12345,
  importe: 12100.50,
  moneda: "PES",
  ctz: 1,
  tipoDocRec: 80,
  nroDocRec: 30711868420,
  tipoCodAut: "E",
  codAut: 71434758235936
}
```

**Por qué no persistir solo la imagen PNG:**
- Imagen es derivable determinísticamente desde el JSON + URL base ARCA.
- Imagen pesa más (~2KB vs ~300 bytes).
- Reimpresión puede regenerar la imagen exacta desde el JSON.

**Por qué no persistir solo la versión y regenerar el payload:**
- Si bug en código generador, reimpresión deja de matchear original.
- Auditor moderno NO debería necesitar ejecutar código Pandora para verificar QR histórico.

**Costo storage:** ~400 bytes/factura. Para 100k facturas/año = ~40MB/año. Trivial.

**Reproducibilidad QR a 10 años:**
1. Snapshot persiste `qr_payload_json` + `qr_version`.
2. Reimpresión toma el JSON, hace `JSON.stringify` → Base64 → concatena URL.
3. Si en 2036 spec ARCA cambia a versión 2: comprobantes históricos siguen mostrando QR con versión 1 (autosuficiente).

### Decisión 3 — `tax_policy_version` formal + archivo Git inmutable

**Convención de naming:** `ar-AAAA-MM-vN`

Ejemplos válidos:
- `ar-2026-06-v1` — primer perfil del mes 2026-06
- `ar-2026-08-v1` — primer perfil del mes 2026-08 (cuando entren RG 5782+5785)
- `ar-2026-08-v2` — segundo perfil del mismo mes (si aparece RG intermedia)

**Por qué fecha + secuencia (no SemVer):**
- Auditor argentino piensa en términos de fechas vinculantes (RG fechan).
- SemVer es abstracto — no responde directo "¿qué reglas aplicaban en agosto 2026?".
- Permite múltiples versiones por mes si normativa cambia rápido.

**Archivos inmutables en repo:**

Path: `docs/tax-policy-versions/ar-YYYY-MM-vN.md` (en SRS + sincronizado a repo Pandora).

```markdown
# Tax Policy Version: ar-2026-06-v1
**Vigencia desde:** 2026-06-02
**Próxima versión esperada:** 2026-08-01 (cuando RG 5782+5785 entren en vigor)
**Estado:** ACTIVA

## Resoluciones aplicables
| RG | BO | Vigencia | Aplica |
|---|---|---|---|
| RG 4892/2020 | 24/12/2020 | Vigente | QR fiscal en todos los comprobantes electrónicos |
| RG 5616/2024 | 18/12/2024 | 01/08/2025 | CondicionIVAReceptorId obligatorio |
| RG 5762/2025 | 25/09/2025 | 01/12/2025 | Sub-tipos A (sustituye factura M) |

## Por jurisdicción
- `merchant_jurisdiction_province=TIERRA_DEL_FUEGO` + `products.tdf_exempt=true` → Ley 19.640 (IVA exento)
- Resto AR → tratamiento estándar

## Cambios respecto a versión anterior
(N/A — primera versión formal)
```

**Inmutabilidad:** una vez publicada una versión, ese archivo **NUNCA se edita**. Si hay cambio normativo → nueva versión `ar-2026-09-v1`. Git history = trazabilidad legal.

**Snapshot persiste:**
```typescript
tax_policy_version: "ar-2026-06-v1"
```

**Reconstrucción auditoría:** snapshot apunta a versión → archivo en repo (commit histórico) → enumera RG aplicables → caso cerrado sin subjetividad inline.

### Decisión 4 — Distinción CAE vs CAEA explícita

**Campo nuevo:**
```typescript
authorization_code_type: 'CAE' | 'CAEA'  // "E"=CAE, "A"=CAEA según RG 5782+5785
```

**Por qué:** vigente desde 01/08/2026 (postergación RG 5852/2026), el `tipoCodAut` del QR distingue ambos. Sin persistir, snapshot pierde info regulatoriamente relevante.

**Fail-closed:** si tipo de autorización no detectable al emitir → bloquear con error claro. CAEA solo permitido en flujo de contingencia explícito (ver futuro ADR de contingencia cuando se construya Sprint 7).

## Schema TypeScript del Fiscal Snapshot ampliado

```typescript
// src/lib/fiscal/snapshot.ts (Sprint 6)
import 'server-only';

export interface FiscalSnapshot {
  // ──── Campos de ADR-0022 (preservados) ──────────────────────
  calculation_engine_version: string;       // 'v1.0.0' en F0
  tax_policy_version: string;               // NUEVA convención ar-YYYY-MM-vN
  rounding_mode: 'HALF_UP' | 'HALF_DOWN' | 'HALF_EVEN';
  rounding_stage: 'PER_LINE' | 'PER_TAX_BRACKET';
  precision_internal: number;
  iva_rates_applied: Record<string, number>;
  currency_code: string;                    // 'ARS' F0
  fx_rate: string;                          // '1.0000' F0
  wsfe_version: string;                     // 'WSFEv1'
  wsfe_manual_revision: string;             // 'COMPG_v4.0' u otra verificada
  jurisdiction_context: {
    country: 'AR';
    province: 'CABA' | 'BUENOS_AIRES' | 'TIERRA_DEL_FUEGO';
    special_regime: 'LEY_19640' | null;
  };
  merchant_special_regime: 'LEY_19640' | null;
  merchant_jurisdiction_province: 'CABA' | 'BUENOS_AIRES' | 'TIERRA_DEL_FUEGO';
  transaction_in_special_zone: boolean;
  customer_snapshot_ref: string;
  fiscal_breakdown: FiscalBreakdown;

  // ──── NUEVO ADR-0023 — Decisión 1 ────────────────────────────
  /**
   * RG 5616/2024 — obligatorio desde 01/08/2025.
   * Par {id, desc_at_emission} = snapshot autosuficiente sin depender de
   * catálogo externo para interpretarse en auditoría histórica.
   */
  condicion_iva_receptor_id: number;        // ID oficial AFIP (ej. 1, 4, 5...)
  condicion_iva_receptor_desc_at_emission: string;  // ej. "IVA Responsable Inscripto"
  condicion_iva_receptor_catalog_version_at_emission: string;  // ej. "wsfev1-catalog-2026-06-15T08:00Z"

  // ──── NUEVO ADR-0023 — Decisión 2 ────────────────────────────
  /**
   * QR fiscal — RG 4892/2020. Persistir payload JSON + versión spec.
   * Imagen PNG es derivable y NO se persiste.
   */
  qr_version: number;                        // 1 al momento de redactar este ADR
  qr_payload_json: {
    ver: number;
    fecha: string;                           // RFC3339 "YYYY-MM-DD"
    cuit: number;                            // CUIT emisor
    ptoVta: number;
    tipoCmp: number;
    nroCmp: number;
    importe: number;                         // en moneda emisión
    moneda: string;                          // "PES" para ARS según tabla ARCA
    ctz: number;                             // 1 si ARS
    tipoDocRec?: number;                     // DE CORRESPONDER
    nroDocRec?: number;                      // DE CORRESPONDER
    tipoCodAut: 'A' | 'E';                   // A=CAEA, E=CAE
    codAut: number;                          // código autorización 14 dígitos
  };
  qr_url_base_at_emission: string;           // "https://www.arca.gob.ar/fe/qr/" al momento de emitir

  // ──── NUEVO ADR-0023 — Decisión 4 ────────────────────────────
  /**
   * RG 5782/2025 + RG 5785/2025 — vigente 01/08/2026.
   */
  authorization_code_type: 'CAE' | 'CAEA';
}
```

## Customer Snapshot ampliado

```typescript
// src/lib/fiscal/customer-snapshot.ts (Sprint 6)
export interface CustomerSnapshot {
  // ──── Campos previos (Sesión 5 v4) ────────
  customer_id: string;
  cuit_or_dni: string;
  doc_type: number;                         // 80=CUIT, 96=DNI, etc. (catálogo ARCA)
  legal_name: string;
  fiscal_address: string;
  iva_condition_label: string;               // descriptor legacy (deprecated post-0023)

  // ──── NUEVO ADR-0023 ────────────────────
  /**
   * Campo nuevo en customer_snapshot — captura condición IVA del receptor
   * al momento de emitir, alineado con FiscalSnapshot.condicion_iva_receptor_id.
   */
  condicion_iva_receptor_id_at_emission: number;
  condicion_iva_receptor_desc_at_emission: string;
}
```

## Consecuencias

### Positivas

1. **Reproducibilidad histórica REAL a 10 años.** Snapshot es autosuficiente:
   - QR regenerable bit-perfect desde `qr_payload_json`.
   - Condición IVA receptor interpretable sin catálogo externo (`desc_at_emission`).
   - Régimen normativo identificable vía `tax_policy_version` → archivo Git inmutable.
   - Tipo de autorización (CAE/CAEA) explícito.

2. **Auditor friendly.** Inspector AFIP pide factura del 2026-08-15 → snapshot dice todo. NO necesita ejecutar código Pandora ni consultar catálogos externos mutables.

3. **Costo storage trivial.** ~600 bytes adicionales por snapshot (QR payload + descripciones). 100k facturas/año = ~60MB/año.

4. **Compatible con ADR-0022.** Campos previos preservados, solo agrega nuevos.

### Negativas (trade-offs aceptados)

1. **Disciplina de archivos tax-policy-versions.** Cada cambio regulatorio → 1 commit con nueva versión. Bajo costo pero requiere disciplina.

2. **Snapshot algo más pesado.** ~600 bytes extras por factura. Negligible vs auditabilidad ganada.

3. **`desc_at_emission` puede confundir si se renombra el campo en código.** Mitigación: sufijo explícito + JSDoc.

4. **Dependencia runtime de FEParamGetCondicionIvaReceptor.** Si AFIP cae al boot del módulo fiscal, módulo no arranca. Mitigación: cache local con TTL + fallback a último catálogo conocido + alerta operacional.

### Items deferidos F1+ con trigger

| Item | Trigger |
|---|---|
| `qr_version: 2` soporte | Cuando ARCA publique nueva spec con `ver: 2` |
| `tax_policy_version` por jurisdicción (no solo país) | Cliente B2B multi-jurisdicción AR (CABA + TDF) |
| Migración a object storage WORM para snapshots > 5 años | Storage Postgres > 100GB de snapshots |
| Verificación QR contra endpoint ARCA al emitir | Sprint 6 — opcional para detección temprana de divergencia |

## Validaciones humanas pendientes

### A-22 (NUEVA — Contadora) — Representación QR legalmente vinculante

**Pregunta:** ¿Qué representación del QR es legalmente vinculante para AFIP?
- Imagen PNG impresa en el comprobante físico
- Payload JSON Base64 dentro del URL
- Ambas equivalentes
- Otra interpretación legal

**Por qué importa:** la implementación de Pandora persiste el JSON + regenera imagen. Si AFIP considera que solo la imagen tiene validez legal (no el JSON), necesitamos también persistir el binario PNG. Si el JSON tiene validez legal equivalente, ahorramos ~2KB/factura.

**Hipótesis Pandora:** ambos son equivalentes ya que la imagen es derivable determinísticamente del JSON + URL base. Pero esto requiere confirmación legal.

### Validaciones previas (siguen pendientes)

- A-19 contadora (RG 5762/2025 sub-tipos A)
- A-20 contadora (RG 5782/2025 CAEA — revisa A-2 + B-6)
- A-21 contadora (PV-actividad opcional RG 5824/2026)
- A-11 contadora (Ley 27.743 texto literal + estructura visual)

## Plan de migración desde ADR-0022

ADR-0023 **AMPLÍA** ADR-0022 sin invalidarlo. Para Sprint 6 fiscal:

1. **Schema Drizzle:** agregar columnas nuevas a `fiscal_snapshots` con `jsonb` extensión (no nuevas tablas — el snapshot sigue siendo un row jsonb).
2. **Trigger inmutable existente** (Sprint 2 #4 audit_log pattern) NO cambia.
3. **Migration SQL** específica `0006_fiscal_snapshot_v2.sql` agrega columnas nullable con default vacío.
4. **Datos históricos** (cuando aparezcan facturas pre-ADR-0023): backfill con `condicion_iva_receptor_id=NULL` + flag `legacy_pre_adr_0023:true`. NO se intenta reconstruir.

## Aplicación del patrón "catálogos regulatorios runtime"

ADR-0023 introduce el patrón **runtime + snapshot autosuficiente** para `CondicionIVAReceptorId`. Este patrón aplica también a:

- TiposCbte (tipos de comprobante)
- TiposDoc (tipos de documento receptor)
- TiposMonedas (incluye PES + cotizaciones)
- TiposIva (alícuotas IVA)
- TiposConcepto (servicio/producto/ambos)
- TiposPaises
- TiposTributos

El principio general **NO se formaliza en este ADR** — se delega a **ADR-0025** (pendiente escritura). ADR-0023 es la primera aplicación concreta del patrón.

## Estado validación

🟡 **Pendiente validación humana A-22** (contadora — representación legal QR).

Otros campos del snapshot quedan ✅ Aprobados arquitectónicamente (sin dependencia legal externa pendiente).

## Cambios respecto a ADR-0022

| Campo | ADR-0022 | ADR-0023 |
|---|---|---|
| `tax_policy_version` | "v2026-05-ar-tdf" (informal) | `ar-YYYY-MM-vN` + archivo Git inmutable |
| `condicion_iva_receptor_id` | ❌ No existe | ✅ Agregado + `desc_at_emission` |
| `qr_version` + `qr_payload_json` | ❌ No existe | ✅ Agregados |
| `authorization_code_type` | ❌ No existe (asume CAE) | ✅ Agregado (CAE / CAEA) |
| `condicion_iva_receptor_catalog_version_at_emission` | ❌ | ✅ Agregado (trazabilidad catálogo runtime) |

## Referencias

- [Research fuentes oficiales 2026-06-02](../memory/research-fuentes-oficiales-adr-0023-2026-06-02.md) — detalle de verificaciones contra Boletín Oficial + Biblioteca AFIP
- [QR Spec PDF (ARCA oficial)](https://www.afip.gob.ar/fe/qr/documentos/QRespecificaciones.pdf)
- [Boletín Oficial RG 4892/2020](https://www.boletinoficial.gob.ar/detalleAviso/primera/239173/20201224)
- [Biblioteca AFIP RG 5616/2024](https://biblioteca.afip.gob.ar/search/query/norma.aspx?p=t:RAG%7Cn:5616%7Co:9%7Ca:2024%7Cf:17/12/2024)
- [Boletín Oficial RG 5762/2025](https://www.boletinoficial.gob.ar/detalleAviso/primera/331947/20250925)
- [argentina.gob.ar RG 5782/2025](https://www.argentina.gob.ar/normativa/nacional/resoluci%C3%B3n-5782-2025-419496/texto)
- [Boletín Oficial RG 5785/2025](https://www.boletinoficial.gob.ar/detalleAviso/primera/333886/20251103)
- [Boletín Oficial RG 5852/2026](https://www.boletinoficial.gob.ar/detalleAviso/primera/342594/20260529)
- ADR-0022 — Fiscal Projection Layer + Fiscal Snapshot (base que se amplía)
- ADR-0025 — Catálogos regulatorios runtime + snapshot policy (pendiente escritura)

---

**Última verificación contra fuentes oficiales:** 2026-06-02
**Próxima revisión esperada:** post-vigencia 01/08/2026 (RG 5782 + 5785), o cuando ARCA publique QR spec versión 2
