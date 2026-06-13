# Borrador — Mensaje a ARCA mesa de ayuda técnica

**Fecha:** 2026-06-13
**Estado:** 📝 BORRADOR — revisar con abogado antes de enviar
**Canal sugerido:** mesa de ayuda técnica WSDL / desarrolladores (NO consulta vinculante)
**Versión:** 1.0

---

## ⚠️ Disclaimer crítico antes de leer

Este documento es un **borrador de preguntas técnicas** para la mesa de ayuda ARCA / canales de soporte al desarrollador. **NO** es una consulta vinculante (RG 1948/2005).

**Por qué importa la distinción:**

1. **Consulta vinculante (RG 1948/2005)** — formal, vincula al fisco para el caso concreto, requiere que el consultante sea **sujeto pasivo del impuesto consultado**. Pandora ERP es una empresa de software que NO emite facturas — el sujeto pasivo es el COMERCIO usuario (el kiosco/ferretería). Si Pandora intenta presentar consulta vinculante en nombre propio, ARCA puede rechazarla por falta de legitimación activa. Requiere **abogado** que evalúe si Pandora como "software developer" tiene interés legítimo suficiente, o si la consulta debe presentarla un comercio piloto (con asesoría legal del comercio).

2. **Mesa de ayuda técnica WSDL** — informal, NO vinculante, pero responde dudas operativas sobre el funcionamiento del WS, código de error, mapping de catálogos, fecha de cutover de regímenes, etc. **Apropiada para todas las preguntas de este documento**.

3. **Otros canales útiles**:
   - Boletín Oficial de la Nación (BO) — fuente primaria para fechas de cutover y texto literal de RGs.
   - Foros de desarrolladores ARCA (si existen activos al 2026-06-13).
   - Manuales oficiales del WS (la versión COMPG v4.2 del 01/05/2026 ya está en nuestro acervo — memoria `extraccion-manual-v42-2026-06-03`).

**Acción requerida del owner antes de enviar**:

- [ ] Confirmar canal exacto (URL/email/teléfono de la mesa de ayuda WSDL actual)
- [ ] Revisar con abogado si la entidad firmante es Pandora ERP (CUIT del proveedor) o un comercio piloto (si ya existe convenio)
- [ ] Asegurar que el envío deja prueba documental (email con acuse de recibo, ticket ID, etc.) — relevante para defensa legal futura
- [ ] **NO enviar las preguntas marcadas 🚫 NO-ARCA** del listado final (esas van a contadora/abogado)

---

## Contexto a incluir en el cuerpo del mensaje

> Somos un equipo de desarrollo trabajando en una solución POS+ERP fiscal para comercios PyME de la región patagónica argentina (Tierra del Fuego, Ushuaia / Río Grande). Apuntamos a Responsables Inscriptos y Monotributistas con flujos retail B y C (consumidor final mayoritario) bajo régimen especial Ley 19.640 cuando aplique. Estamos en fase pre-productiva, completando la implementación contra WSFEv1 + Padrón A5 en ambiente homologación.
>
> Antes de cerrar nuestra spec interna y avanzar contra producción, queremos validar técnicamente algunos puntos del manual COMPG v4.2 (01/05/2026) y normativa de aplicación reciente (RG 5616/2024, 5762/2025, 5782/2025, 5785/2025, 5852/2026, Ley 27.743).

---

## Preguntas técnicas para ARCA mesa de ayuda

### Bloque 1 — `CondicionIVAReceptorId` (RG 5616/2024)

**Q1 — Fecha exacta de obligatoriedad para emisores de comprobantes a consumidor final.**

> El Manual WSFEv1 COMPG v4.2 (01/05/2026), tabla "Condiciones IVA Receptor" del Anexo, lista valores 1–13. RG 5616/2024 estableció obligatoriedad de informar `CondicionIVAReceptorId` con fecha original de aplicación. ¿Cuál es la fecha actualmente vigente a partir de la cual el campo es **obligatorio** vs **opcional** en `FECAESolicitar`? ¿Hay distinción entre Tipo A/B (B2B) y Tipo B/C (consumo final)?

**Q2 — Valor exacto para comprador Monotributista alcanzado por Ley 19.640 (Tierra del Fuego).**

> Para un comprador final con CUIT de Monotributo que reside en Ushuaia/Río Grande y compra un bien amparado por Ley 19.640: ¿qué `CondicionIVAReceptorId` corresponde? ¿Es `10 - IVA Liberado – Ley N° 19.640`, o se mantiene su condición original de Monotributo (`5 - Consumidor Final`? ¿`6 - Responsable Monotributo`?) y la Ley 19.640 se refleja únicamente vía `ImpOpEx` del header?

**Q3 — Comportamiento ante mismatch con Padrón A5.**

> Si un emisor envía `FECAESolicitar` con `CondicionIVAReceptorId = X` y el Padrón A5 del receptor consultado en paralelo devuelve una condición fiscal inconsistente con X (por ejemplo, emisor informa "Responsable Inscripto" pero Padrón devuelve "Monotributo Activo"): ¿el WS rechaza con CAE denegado, devuelve `observed`, o emite normalmente y el contraste es responsabilidad del emisor?

---

### Bloque 2 — Tipo M y RG 5762/2025

**Q4 — Fecha exacta de eliminación del tipo M de comprobante.**

> RG 5762/2025 dispuso eliminación del comprobante tipo M ("Factura de exportación") del régimen de FE habitual. ¿Cuál es la fecha exacta de cutover, y a partir de cuándo `FECAESolicitar` con `CbteTipo` correspondiente a M devuelve rechazo definitivo? ¿Existe período de coexistencia / contingencia, o el corte es estricto a la fecha?

**Q5 — Sub-tipos de comprobante A introducidos por RG 5762/2025.**

> Misma RG menciona reestructuración de sub-tipos de Factura A. ¿Hay un mapping oficial actualizado en el manual COMPG vigente con los `CbteTipo` válidos post-cutover, o las modificaciones se incorporan vía catálogo `FEParamGetTiposCbte` y debemos consultarlo en runtime?

---

### Bloque 3 — Régimen Transparencia Fiscal Ley 27.743 (consumidor final)

**Q6 — Implementación técnica del régimen en el comprobante electrónico.**

> Ley 27.743 (Régimen de Transparencia Fiscal al Consumidor) exige que el comprobante a consumidor final discrimine la base imponible neta + IVA + "otros impuestos nacionales indirectos" + leyenda obligatoria. ¿La discriminación viaja únicamente en el ticket impreso al consumidor, o hay también campos específicos en el payload `FECAESolicitar` (más allá de `Iva[]` + `Tributos[]`) que ARCA exige populated?

**Q7 — Aplicabilidad a comprobantes Tipo C y a operaciones bajo Ley 19.640.**

> ¿El régimen Transparencia Fiscal aplica a comprobantes Tipo C (emisor Monotributo)? ¿Y a operaciones amparadas por Ley 19.640 donde el IVA es 0? ¿La leyenda obligatoria se mantiene aún cuando el IVA discriminado sea 0?

---

### Bloque 4 — CAE / CAEA (RGs 5782/2025 + 5785/2025 + 5852/2026)

**Q8 — Diferenciación operativa CAE vs CAEA en el flujo POS retail.**

> RG 5782/2025 + 5785/2025 + 5852/2026 ajustaron el régimen de CAEA. Para un POS retail con flujo "venta-cobro-emisión-impresión" sincrónico y volumen 30–200 ventas/día por comercio: ¿es operativamente aplicable CAEA, o el flujo natural debe ser CAE solicitado por venta? ¿Cuál es la fecha actual de obligatoriedad / opcionalidad de CAEA por segmento (volumen / actividad)?

**Q9 — Comportamiento ante timeout 30s del WS y emisión post-2h.**

> Si `FECAESolicitar` no responde dentro del timeout configurado (ej: 30s) y el comercio ya cobró + entregó la mercadería, ¿cuál es el procedimiento oficial recomendado para regularizar?
>
> En particular:
>   - ¿La emisión posterior con el mismo número de comprobante reservado y fecha de la venta original es aceptable, o ARCA exige usar la fecha del momento de obtención del CAE?
>   - ¿Existe un plazo máximo (en horas/días) para regularizar la emisión post-timeout antes de incurrir en infracción?
>   - ¿La RG 5616/2024 art. 8 sobre "puesta a disposición dentro de 10 días" aplica al consumidor final del comprobante post-timeout?

---

### Bloque 5 — QR fiscal (RG 4892/2020)

**Q10 — Confirmación oficial de los 13 campos del payload QR.**

> El Manual COMPG v4.2 (01/05/2026), sección QR, lista los 13 campos del payload encodeable en base64url. Verificamos que coincide literal con la spec original RG 4892/2020. ¿Sigue siendo la versión vigente (campo `ver: 1`) o hay una v2 anunciada / en proceso?

**Q11 — URL base oficial vigente.**

> La URL base del QR (`https://www.afip.gob.ar/fe/qr/?p=...`) según RG 4892/2020. ¿Se mantiene esta URL después de la fusión institucional AFIP→ARCA, o cambió el dominio? El manual v4.2 todavía la cita con dominio `afip.gob.ar`.

---

### Bloque 6 — Padrón A5

**Q12 — Política oficial recomendada de caché de Padrón.**

> Para un POS retail que pre-valida CUITs de clientes B2B antes de emitir factura A: ¿cuál es la política de caché recomendada por ARCA respecto a respuestas Padrón A5? ¿Hay TTL máximo después del cual la consulta debe revalidarse antes de emitir? ¿Es aceptable un caché de 24h o ARCA exige verificación en tiempo real?

---

## 🚫 Preguntas que NO van a ARCA (decisiones internas / contadora / abogado)

Las siguientes preguntas del advisor doc Pandora se omiten del mensaje a ARCA porque son **decisiones estratégicas / contables / legales** que ARCA NO responde:

| ID | Pregunta | Va a | Por qué NO ARCA |
|---|---|---|---|
| A-1 | Stage redondeo PER_LINE vs PER_BRACKET + conciliación centavos | Contadora | Decisión contable de cierre, ARCA no opina sobre esquema interno |
| A-3 | `legal_name` / `fiscal_address` opcional vs obligatorio en customer_snapshot | Contadora | Decisión de retención fiscal del COMERCIO, ARCA exige lo mínimo del WS |
| A-7 | Manejo `observed` en respuestas WSFEv1 | Contadora + ARCA Q3 parcial | Lo TÉCNICO va en Q3; la decisión operativa (re-emitir / consultar / asumir) es contable |
| A-8 | Cold storage S3 Glacier para XMLs > 1 año | Contadora | Decisión de infra, ARCA solo exige retención 10 años (Ley 11.683) |
| A-10 | TDF: texto literal del comprobante amparado + rubros típicos + default conservador | Contadora especialista TDF | ARCA no validará un texto comercial específico |
| A-11 | Ley 27.743 — texto literal + estructura visual del ticket | Contadora + Q6/Q7 parcial | Lo TÉCNICO del WS va en Q6/Q7; el texto literal e implementación visual la valida contadora |
| **B-1** | Responsabilidad civil error fiscal automatizado + SRL vs Monotributo | **Abogado** | NO ARCA. Decisión societaria + RC profesional |
| **B-2** | Inscripción AAIP — SaaS multi-tenant + cronograma | **Abogado** + AAIP | AAIP es otro organismo (no ARCA). Trámite TAD propio |
| **B-3** | Plazo + formato notificación breach AAIP | **Abogado** + AAIP | Idem |
| **B-4** | Responsabilidades fuga cross-tenant | **Abogado** | Civil, no fiscal |
| **B-5** | Conservación legal docs NO fiscales (audit, T&C, política) | **Abogado** | Doctrina civil, no ARCA |
| **B-6** | Ángulo civil/comercial venta cobrada sin CAE post-2h | **Abogado** + Q9 parcial complementaria | Lo TÉCNICO va en Q9; el ángulo civil (vicio/anulabilidad/responsabilidad ante consumidor) es civil |
| **B-7** | Cláusulas T&C | **Abogado** | Doctrina civil |
| **B-8** | DPA + Privacy Policy | **Abogado** | Idem |
| **B-9** | Mapping legal `pii_level` operacional vs Ley 25.326 | **Abogado** + AAIP | NO ARCA |
| **B-10** | Resolución conflicto ARCO vs conservación fiscal 10 años | **Abogado** | Civil/AAIP, no ARCA |

---

## Cuerpo final propuesto para envío

> **Asunto:** Consulta técnica WSFEv1 + Padrón A5 — RGs 5616/2024, 5762/2025, 5782/2025, 5785/2025, 5852/2026 + Ley 27.743 + Ley 19.640 — desarrollador POS retail Patagonia
>
> Estimados,
>
> [contexto del bloque "Contexto a incluir" arriba]
>
> A continuación detallamos doce consultas técnicas agrupadas en seis bloques. Cualquier confirmación, referencia a artículo de RG/manual o redirección al canal apropiado nos sería de gran ayuda. Si alguna consulta excede el alcance de esta vía, agradecemos indicarnos el canal correcto.
>
> [insertar Q1 a Q12 verbatim]
>
> Quedamos a disposición para ampliar contexto operativo si fuera de utilidad. Agradecemos desde ya cualquier orientación.
>
> Saludos cordiales,
> [datos del firmante — CUIT + nombre + email de contacto]

---

## Notas para el owner

- **No comprometerse a plazos** ni cliente concreto en el mensaje. Pandora está en fase pre-productiva — si ARCA cree que hay un cliente firmando ya, puede cambiar el tono.
- **No incluir secrets, screenshots de payload con CUITs reales, ni datos del comerciante piloto.** Si un ejemplo es necesario, usar CUITs ficticios (todos 1s, todos 2s).
- **Guardar copia firmada digitalmente** del envío + cualquier respuesta — sirve como evidencia futura ante auditoría o defensa civil.
- **Esperable**: respuestas parciales o redirecciones. La mesa de ayuda NO es vinculante, las respuestas son orientativas.
- **Tiempo de espera típico**: 5–15 días hábiles. Pandora ERP no se planifica como bloqueada por esto — el camino crítico real sigue siendo la reunión con la contadora.

---

**Próximo paso del owner**:

1. Revisar este draft con abogado de Pandora (mismo abogado que evaluará B-1).
2. Confirmar canal exacto de ARCA mesa de ayuda WSDL actual.
3. Si abogado aprueba, enviar + archivar acuse.
4. Anotar las respuestas en `reunion-contador-y-abogado.md` cuando lleguen, junto con los 11 ítems de la contadora.
