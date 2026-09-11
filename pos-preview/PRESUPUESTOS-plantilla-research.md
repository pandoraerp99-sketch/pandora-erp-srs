# Research — Plantilla de presupuesto personalizada por comercio

**Fecha:** 2026-06-26
**Pregunta del owner:** "Cada local ya tiene su plantilla de presupuesto (ej: Excel de mi novia). ¿Hay forma de que los datos cargados en Pandora se completen en *su* planilla y que sea esa la que reciba el cliente?"
**Método:** WebSearch + WebFetch contra los SaaS del rubro AR/LatAm/ES. Para Pandora ERP F1+ (NO F0).

---

## Hallazgo central

**Ningún SaaS del rubro rellena el archivo Excel/Word propio del usuario.** El patrón universal es **plantilla NATIVA incorporada que el comercio "brandea"** (sube logo + elige colores/fuente + activa/desactiva campos). El resultado *parece* de ellos, pero el motor es del SaaS. Quien necesita un diseño único, lo **manda y el SaaS lo adapta a su plantilla** (servicio de onboarding), NO se sube un .xlsx para rellenar en runtime.

Esto **valida el "Camino A"** que recomendé y confirma que el "Camino B" (rellenar el Excel literal del comercio) es un pantano que nadie en la industria recorre — por buenas razones.

---

## Evidencia por herramienta (con fuente)

| Herramienta | Qué permite personalizar | ¿Sube su archivo propio? |
|---|---|---|
| **Alegra** (AR/LatAm, hace cotizaciones) | Plantillas predefinidas (Clásico, Simple, Compacto, Moderno, Transparente) + fuente (Helvetica/Times) + tamaño + espaciado + **campos visibles** (totales, descuentos, IVA% con checkboxes) + **logo** en todos los documentos | **NO** — "users cannot upload custom Excel/Word files". Solo brandean plantillas incorporadas. Los comprobantes **electrónicos** quedan forzados a la plantilla "Clásico" (constraint fiscal). |
| **Anfix** (ES) | Logo + colores corporativos + firma + idioma; **13+ plantillas** prediseñadas | **NO** directamente. Ofrece un **bridge**: "si querés algo único, hacé tu propio diseño y **enviánoslo para que nosotros lo adaptemos**". Auto-carga datos + envía al cliente con 1 clic + confirmación de apertura del email. |
| **Contasimple** (ES) | Plantillas de presupuesto personalizables con logo + colores; subir logo en config | NO — brandea plantilla nativa |
| **Billin** (ES) | Personaliza facturas y presupuestos online (plantillas + logo + colores corporativos) | NO — plantilla nativa |
| **Quipu** (ES) | Ofrece plantillas Excel **descargables** (DIY, fuera del SaaS) | N/A — son plantillas sueltas para quien NO usa el SaaS |

**Conclusión de la evidencia:** el flujo deseado ("su planilla, con la marca del local, recibida por el cliente") se resuelve en TODOS los casos con **plantilla nativa branded + envío desde la plataforma**, no rellenando el archivo del usuario.

---

## Por qué el "Camino B" (rellenar el Excel propio) es un pantano

- Cada archivo es distinto → no hay esquema estable que mapear.
- Las **tablas de ítems dinámicas** en Excel/Word se rompen al expandir filas; las fórmulas/formatos se desarman.
- La **conversión a PDF** (LibreOffice headless / servicio) pierde fidelidad según el archivo.
- **Soporte por comercio explota**: cada plantilla rota es un ticket.
- Libs como *docxtemplater* (Word) o *carbone.io* sirven para plantillas **controladas por nosotros con tokens**, NO para archivos arbitrarios del usuario.
- **Por eso ningún competidor lo hace.** Alegra lo prohíbe explícitamente.

---

## Approach recomendado para Pandora (F1+)

**Plantilla de presupuesto NATIVA, branded por comercio** (modelo Alegra/Anfix):

1. **Branding en Configuración → Comprobantes/Plantilla:** logo, color de acento, datos de contacto/pago, condiciones/validez por defecto, qué campos mostrar (IVA discriminado sí/no para B2B vs consumidor final).
2. **2-3 plantillas base opinadas** (NO 13 — filosofía Pandora: decisiones opinadas, no configurable infinito). Ej: "Clásica", "Compacta", "Con detalle de servicios".
3. **Output = PDF branded** que se envía por **WhatsApp / email** o se imprime, directo desde Pandora (botones ya mockeados en `presupuestos-v1.html`).
4. **Bridge de onboarding (estilo Anfix):** si un comercio tiene un diseño muy propio, lo manda y se recrea **una vez** como plantilla Pandora. De ahí en más, la data siempre cae en la versión Pandora. Resuelve el caso "mi novia ya tiene su Excel" sin la fragilidad del runtime-fill.
5. **Constraint fiscal:** el presupuesto **NO es comprobante fiscal** (sin CAE). Al "Convertir a venta" → entra al carrito → se factura con CAE (plantilla fiscal aparte, forzada como en Alegra). NO mezclar el branding del presupuesto con el comprobante fiscal.

### Fasing
- **F0:** nada (presupuestos es F1). El mockup `presupuestos-v1.html` es exploración visual.
- **F1:** presupuestos como bounded context (schema presupuesto + líneas producto/servicio/ítem-libre + estados + convert-to-sale) + plantilla nativa branded (logo + color + campos + 1 plantilla base) + PDF + envío.
- **F2:** 2-3 plantillas base + bridge "mandá tu diseño y lo adaptamos" + métricas de conversión.

### Trigger de promoción F1
- **≥3 comercios piloto piden presupuestos**, O 1 piloto cuyo negocio (ferretería/servicios) los necesita para operar. (La novia del owner es **señal direccional** real, pero no piloto pago todavía.)
- Requiere **ADR** al promover (bounded context nuevo + convert-to-sale flow + plantilla/branding).

---

## Fuentes
- Alegra — personaliza plantillas de facturación: https://ayuda.alegra.com/int/configura-y-personaliza-tus-plantillas-de-facturacion
- Alegra — personalizar facturas (branding): https://blog.alegra.com/es/personalizar-facturas/
- Anfix — personalización de facturas: https://www.anfix.com/facturacion/personalizacion-de-facturas
- Contasimple — plantilla presupuestos: https://www.contasimple.com/academia/plantilla-presupuestos/
- Billin — personalizar facturas y presupuestos: https://www.billin.net/personalizar-facturas/
- Quipu — plantillas presupuesto (DIY Excel): https://getquipu.com/blog/plantilla-presupuesto-descargar/
