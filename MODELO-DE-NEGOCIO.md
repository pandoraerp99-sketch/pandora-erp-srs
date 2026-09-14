# Modelo de Negocio — Pandora ERP

**Versión:** 1.0.0
**Fecha:** 2026-09-04
**Estado:** borrador — números de costo pendientes de verificación (§4.1)
**Propósito:** responder las tres preguntas que faltaban del checklist de la facultad — **mercado objetivo**, **propuesta de valor** y **estructura de costos e ingresos** — y dejar explícito qué está medido y qué es supuesto.

> **Regla del documento:** todo número que no esté verificado va marcado. No hay cifras de relleno. Si una celda dice `VERIFICAR`, es porque nadie la midió todavía, y eso es un dato en sí mismo.

---

## 0. Advertencia honesta antes de empezar

Este documento describe un modelo **no validado**. A la fecha:

- **0 clientes pagando.**
- **0 entrevistas de campo hechas** (la guía está escrita en [VALIDACION-MERCADO-TDF.md](VALIDACION-MERCADO-TDF.md), la ejecución está pendiente).
- Los precios ARS 25.000 / ARS 60.000 que circulan en el SRS son **supuestos de mayo 2026**, nunca contrastados con un comerciante real.

Lo que sí está construido y verificado es el **producto**: POS funcional punta a punta, caja con arqueo y cierre, inventario con control de sobreventa, multi-tenant con aislamiento probado, y la capa fiscal ARCA proyectada. 751 tests unitarios + 219 de integración en verde.

Es decir: **el riesgo de este proyecto no es técnico, es comercial.** Este documento es el intento de mirar ese riesgo de frente.

---

## 1. Mercado objetivo

### 1.1 Segmentación en tres anillos

No hay un solo "mercado". Hay tres círculos concéntricos y sólo el primero es real hoy.

| Anillo | Quién | Tamaño | Estado |
|---|---|---|---|
| **A — Beachhead** | Comercio minorista chico de Tierra del Fuego: 1-3 empleados, 1-2 cajas, 30-200 ventas/día, RI + Ley 19.640 o Monotributo | `VERIFICAR` (§1.2) | Target F0. Acceso directo: el dueño del proyecto vive acá |
| **B — Expansión natural** | Mismo perfil de comercio en el resto de la Patagonia y ciudades chicas del interior | Mayor, sin acceso directo | F1-F2. Requiere canal (contadores, cámaras) |
| **C — Mercado total AR** | Todo el retail chico argentino con obligación de factura electrónica | Grande y muy competido | F3. No es una meta, es un techo teórico |

**Por qué TDF como beachhead y no "Argentina":**

1. **Acceso físico.** Se puede entrar caminando al local, hablar con el dueño y volver al otro día. En un producto que se vende por confianza, esto vale más que cualquier campaña.
2. **Ley 19.640 es una barrera de entrada a favor.** El régimen de exención fueguino es una complicación que los sistemas nacionales resuelven mal o directamente no resuelven. Pandora lo tiene modelado desde el schema (`merchant_special_regime`, `tdf_exempt` por producto, `ImpOpEx` en el payload de ARCA). Es un foso chico pero real.
3. **Mercado abarcable.** Si el producto no gana en un mercado donde el fundador vive, conoce a los comerciantes y entiende el régimen fiscal, no va a ganar en Buenos Aires.

### 1.2 Cuántos son — método, no invento

**No tengo el número y no lo voy a estimar de memoria.** Se obtiene así, en este orden:

| Fuente | Qué da | Costo |
|---|---|---|
| Padrón de habilitaciones comerciales de las municipalidades de Río Grande y Ushuaia | Universo con dirección y rubro | Gratis, pedido formal |
| Cámara de Comercio de Río Grande / Ushuaia | Socios activos por rubro | Gratis, una reunión |
| INDEC — Censo Nacional Económico | Locales por rama de actividad y provincia | Gratis, online |
| Conteo propio a pie sobre las 3-4 arterias comerciales | Muestra real de rubros y densidad | Una tarde |

**Filtro para pasar de "comercios" a "mercado direccionable":** hay que descontar (a) los que no facturan electrónicamente, (b) gastronomía con servicio de mesa — es NON-GOAL explícito, (c) sucursales de cadenas nacionales con sistema corporativo impuesto, (d) los que no tienen ninguna computadora ni tablet.

La expectativa personal es que el mercado direccionable de TDF esté en **cientos, no miles**. Eso no es un defecto: 20-30 clientes en TDF ya sostienen el proyecto (§5), y sirven de prueba antes de salir.

### 1.3 Rubros priorizados

| Prioridad | Rubro | Por qué |
|---|---|---|
| 1 | Kiosco / autoservicio | Volumen alto, velocidad de cobro crítica, dolor diario visible |
| 2 | Ferretería | Catálogo grande, mezcla consumidor final + B2B, el stock les importa de verdad |
| 3 | Mercería / sedería / indumentaria | Devoluciones frecuentes, variantes de producto, ticket medio-alto |
| 4 | Panadería / despensa | Producto diario, alta frecuencia, cierre de caja diario |
| 5 | Librería, peluquería, comercios de servicio | Menor volumen pero misma obligación fiscal, buen test de generalidad |

---

## 2. Propuesta de valor

### 2.1 El problema real

El comerciante chico argentino no tiene *un* sistema. Tiene **cuatro herramientas desconectadas** y él es el integrador:

| Lo que usa hoy | Para qué |
|---|---|
| Excel o cuaderno | Stock, precios, lo que se debe |
| Facturador de ARCA (RCEL) o similar | Emitir la factura, en otra pestaña, retipeando |
| Calculadora + caja física | Cerrar el día |
| WhatsApp con el contador | Mandarle fotos, Excel y planillas a fin de mes |

El costo de esto no es la licencia del software. Es **el tiempo del dueño** haciendo de puente entre herramientas, y **los errores** que aparecen en ese puente: stock que no coincide, facturas que faltan, cierres que no cuadran, el contador reclamando datos.

### 2.2 La propuesta en una frase

> **Pandora hace el trabajo administrativo del comercio, y el comerciante confirma.**

No es "un sistema más" ni "un sistema más lindo". La diferencia está en **quién hace el trabajo**: hoy lo hace la persona, con el software como herramienta pasiva. En Pandora el sistema hace el borrador y la persona aprueba.

### 2.3 La IA al centro — y su límite, que es una ventaja

La IA es el corazón de la propuesta, pero con un contrato explícito y no negociable, escrito en ADR-0024:

> *"La IA puede sugerir input al usuario y asistir en tareas operativas no críticas. NUNCA decide transiciones fiscales, cálculos monetarios, autorizaciones multi-tenant, emisiones de comprobantes."*

**Dónde la IA hace el trabajo pesado:**

| Tarea | Hoy | Con Pandora |
|---|---|---|
| Cargar el catálogo inicial | Tipear 300 productos a mano | Se le pasa la lista del proveedor; la IA arma el borrador; el comerciante corrige y confirma |
| Facturas de compra | Se acumulan en una carpeta y se las lleva el contador | Llegan a una casilla, la IA extrae proveedor, importe e IVA; el comerciante verifica |
| Cierre de caja con descuadre | Recontar y adivinar | La IA cruza ventas, medios de pago y movimientos, y propone dónde está la diferencia |
| Preguntas del día a día | Buscar en el sistema o preguntarle al contador | Se pregunta en castellano: *"¿cuánto vendí de gaseosas este mes?"* |
| Preparar el mes para el contador | Armar Excel a mano | La IA arma el borrador; el contador matriculado revisa y firma |

**Dónde la IA no decide, nunca:**

- No emite un comprobante fiscal.
- No calcula el IVA que se informa a ARCA. Eso lo hace un motor determinístico con `Decimal.js` y redondeo `HALF_EVEN`, y queda un *snapshot* inmutable reproducible años después.
- No mueve plata ni cambia el estado fiscal de una venta.
- No cruza el límite entre dos comercios.

**Por qué el límite es una ventaja competitiva y no una limitación:**

Un competidor cuyo asistente "decide" cosas fiscales es un **pasivo legal**, no una funcionalidad. Ante un error, alguien tiene que responder. Pandora está diseñada para que la responsabilidad siga siendo de quien la tiene por ley — el comerciante y su contador matriculado (Ley 20.488) — y para que cada paso quede auditado en un log inmutable de 10 años (Ley 11.683).

Esa es, además, la razón por la cual **un contador puede recomendar Pandora sin exponerse**. Y el contador es el canal de venta más barato que existe en este mercado.

### 2.4 Los otros tres diferenciadores

| # | Diferenciador | Por qué importa acá |
|---|---|---|
| 1 | **ARCA nativo, no un agregado** | La factura se emite dentro de la venta. Si ARCA no responde, el sistema no inventa un CAE: registra el estado real y reconcilia después. Hoy el comerciante retipea todo en otra pestaña |
| 2 | **Contador integrado gratis, multi-empresa** | El contador entra con un login y ve las N empresas que lo invitaron. Se termina el WhatsApp con fotos. Y convierte al contador en aliado en vez de obstáculo |
| 3 | **Ley 19.640 nativa** | Exención fueguina modelada por producto. Los sistemas nacionales lo resuelven mal o directamente no lo resuelven |

### 2.5 Para quién NO es

Decirlo protege el foco y da credibilidad:

- Gastronomía con servicio de mesa (comanda, cocina, división de cuenta).
- Industria y manufactura (producción, BOM, MRP).
- E-commerce puro.
- Multi-sucursal y cadenas.
- Reemplazo del contador. **Pandora es la herramienta del contador, no su sustituto.**

---

## 3. Estructura de ingresos

### 3.1 Modelo: suscripción mensual por comercio

Un solo modelo, sin licencias ni instalación. Tres razones: ingreso predecible, alineación de incentivos (si el comercio no lo usa se va, y eso se ve a tiempo), y elimina la barrera del pago inicial grande.

### 3.2 Estructura de planes (propuesta a validar)

| Plan | Para quién | Precio ARS/mes | Estado |
|---|---|---|---|
| **Base** | Kiosco, despensa: 1 caja, 1-2 usuarios | `A VALIDAR` (supuesto: 25.000) | Nunca contrastado |
| **Comercio** | Ferretería, mercería: 2 cajas, hasta 5 usuarios, catálogo grande | `A VALIDAR` (supuesto: 60.000) | Nunca contrastado |
| **Contador** | Acceso multi-empresa para el contador | **Gratis, siempre** | Decidido. Es canal, no producto |

**Por qué el contador va gratis:** paga el comercio. El contador es distribución. Cobrarle mata el canal más barato que hay y transforma un aliado en un costo.

### 3.3 Cómo se validan esos precios

Los dos números salen del SRS de mayo 2026 y **nadie los probó**. El método está en [VALIDACION-MERCADO-TDF.md §4, Bloque D](VALIDACION-MERCADO-TDF.md): primero se pregunta **cuánto paga hoy** (software + contador), y recién después se menciona un número.

Anclas que hay que traer del campo, y que hoy son huecos:

- Cuánto paga hoy por su facturador o sistema.
- Cuánto le paga al contador por mes.
- Cuánto le cuesta una hora suya de trabajo administrativo.

Sin esas tres anclas, cualquier precio es una opinión.

### 3.4 Otras líneas de ingreso — evaluadas y descartadas para F0

| Línea | Veredicto |
|---|---|
| Comisión por transacción | **No.** Castiga al que más usa el producto, y compite con el medio de pago |
| Cobro por implementación / carga de catálogo | **No en F0.** El onboarding sin fricción es parte de la propuesta. Se reevalúa si el costo de carga resulta ser el cuello de botella (§4.3) |
| Venta de hardware | **No.** Otro negocio, otro capital de trabajo, otro margen |
| Módulos pagos por separado | **No en F0.** Fragmenta el producto antes de que exista un producto |

---

## 4. Estructura de costos

### 4.1 Infraestructura — costos a verificar

**Ninguno de estos números está verificado.** Son de memoria, y el software cambia precios. Antes de presentar esto hay que abrir las cinco páginas y completar la columna.

| Concepto | Estimado USD/mes | Verificado | Dónde se verifica |
|---|---|---|---|
| Hosting de la aplicación (Vercel Pro) | ~20 | `VERIFICAR` | vercel.com/pricing |
| Base de datos + auth + storage (Supabase Pro) | ~25 | `VERIFICAR` | supabase.com/pricing |
| Monitoreo de errores (Sentry) | ~26 | `VERIFICAR` | sentry.io/pricing |
| Envío de emails (Resend) | 0 a ~20 | `VERIFICAR` | resend.com/pricing |
| Dominio | ~1 | `VERIFICAR` | nic.ar |
| Certificado ARCA (homologación y producción) | **0** | Confirmado | Se tramita con clave fiscal, es gratis |
| **Subtotal infraestructura** | **~70-90 USD/mes** | | |

**Costo de la IA** — va en línea aparte porque es la única que escala con el uso:

| Concepto | Estimado | Verificado |
|---|---|---|
| API del modelo de lenguaje, por comercio activo | `VERIFICAR` — depende de los tokens/mes reales | Sin medir |

No se puede estimar de memoria: depende de cuántas facturas de compra procese cada comercio y de qué tan seguido usen el asistente. **Se mide en el piloto**, y hasta entonces es un agujero conocido del modelo. Es la línea que más puede sorprender.

> **Tipo de cambio.** Toda la infraestructura se paga en dólares y los ingresos son en pesos. Es la exposición estructural del modelo. En este documento no hay ningún monto en pesos derivado de un dólar: se calcula con `TC = ______` a fecha `______`, y se recalcula cada vez que se presenta. Un modelo de negocio argentino que fija un tipo de cambio queda mal en un trimestre.

### 4.2 Los costos que no son servidores — y que dominan al principio

Con 5 clientes, la infraestructura es la parte **barata y menos importante**. Lo que realmente cuesta:

| Costo | Qué es | Magnitud |
|---|---|---|
| **Adquisición** | Conseguir un cliente: visitas, demos, reuniones, seguimiento. El vendedor es el fundador | `MEDIR` — horas por cliente cerrado |
| **Onboarding** | Cargar el catálogo, configurar el certificado de ARCA, capacitar al cajero | `MEDIR` — horas por cliente. **Es el costo grande y de una sola vez** |
| **Soporte** | Solo-dev: cada WhatsApp a las 11 de la noche es tiempo del fundador | `MEDIR` — horas/mes por cliente |
| **Desarrollo** | El tiempo del fundador construyendo. No sale del bolsillo, pero es costo de oportunidad real | Meses ya invertidos |
| **Riesgo fiscal / responsabilidad civil** | Un error fiscal del software tiene consecuencias sobre el comerciante | `TBD` — pendiente abogado (B-1: RC profesional, forma societaria) |

**Esto es lo que responde la pregunta de rentabilidad de la facultad.** Una planilla que sólo cuenta servidores da un margen bruto altísimo y engañoso. La verdad es que **a 5 clientes el proyecto no es rentable**, porque el costo dominante es el tiempo del fundador en adquirir y dar de alta a cada uno. Se vuelve rentable cuando el onboarding se automatiza —la IA cargando el catálogo es exactamente eso— y cuando el número de clientes diluye la adquisición.

### 4.3 El costo del onboarding es la clave del modelo

Vale la pena aislarlo. Si dar de alta un comercio cuesta 8 horas de trabajo manual, el modelo no escala: 30 clientes son 240 horas sólo en altas. Si la IA baja eso a 1 hora de verificación, el modelo escala.

**La IA no es solamente propuesta de valor para el cliente: es la palanca de rentabilidad del negocio.** Es la misma capacidad mirada desde los dos lados del mostrador.

### 4.4 Riesgo legal abierto que afecta al modelo

**Gate B-IA:** procesar datos de un comercio con un proveedor de IA externo implica transferir datos personales a un tercero bajo la **Ley 25.326**. La base legal, el consentimiento y la eventual inscripción ante la AAIP **están sin resolver**, y son consulta pendiente al abogado.

Va acá y no en una nota al pie porque la IA es el centro de la propuesta de valor: si esa consulta sale mal, cambia el producto, no un detalle.

---

## 5. Punto de equilibrio

Sin tipo de cambio fijo, la respuesta correcta es una **fórmula**, no un monto:

```
Clientes para cubrir infraestructura =

      Costo infra USD/mes  ×  TC_ARS_USD
      ──────────────────────────────────
           Precio promedio ARS/mes
```

Con los supuestos actuales (infra ~80 USD/mes, precio promedio ~35.000 ARS), el equilibrio de infraestructura cae en **un puñado de clientes** — el número exacto depende del TC del día.

**Pero ese no es el equilibrio que importa.** El equilibrio real es el que además paga el tiempo del fundador:

```
Clientes para sostener al fundador =

      Costo infra  +  Ingreso mensual objetivo del fundador
      ────────────────────────────────────────────────────
       Precio promedio  −  costo de soporte mensual/cliente
```

Esa segunda fórmula es la que define si Pandora es un negocio o un proyecto. **Hoy no se puede completar**, porque falta medir el costo de soporte por cliente, y eso sólo se mide con clientes reales.

**Conclusión honesta:** el equilibrio de infraestructura está al alcance con pocos clientes. El equilibrio de "esto me da de vivir" está un orden de magnitud más arriba, y no se puede precisar sin datos de campo.

---

## 6. Camino a la sostenibilidad

| Etapa | Clientes | Qué prueba | Qué se mide |
|---|---|---|---|
| **Piloto** | 1-3 | Que el producto aguanta operación real diaria | Horas de onboarding, horas de soporte, costo de IA por comercio |
| **Validación** | 5-10 | Que hay gente dispuesta a pagar, no sólo a probar | Precio real aceptado, tasa de abandono, de dónde vienen |
| **Sostenibilidad** | 20-30 | Que cubre infraestructura + tiempo del fundador | Margen por cliente, costo de adquisición |
| **Expansión** | 50+ | Que funciona fuera del círculo de conocidos de TDF | Si el canal contador realmente trae clientes |

Cada etapa **corrige a la anterior**. Los números de la etapa piloto son los que van a cambiar este documento entero.

---

## 7. Riesgos del modelo

| # | Riesgo | Impacto | Mitigación |
|---|---|---|---|
| R1 | El precio supuesto está muy por encima de lo que el comerciante paga hoy | Alto | Entrevistas antes de fijar precio. El guion ya está escrito |
| R2 | El costo de la IA por comercio se come el margen | Alto | Medir en el piloto. Poder degradar a funciones sin IA sin romper el producto |
| R3 | El gate legal B-IA bloquea el uso de IA con datos reales | **Crítico** | Consulta al abogado antes del piloto |
| R4 | El onboarding no se automatiza y el modelo no escala | Alto | Es exactamente el trabajo de la carga asistida por IA |
| R5 | El mercado de TDF es demasiado chico para sostener el proyecto | Medio | Medir el universo real (§1.2) antes de asumir |
| R6 | Los contadores no recomiendan el producto | Medio | ADR-0024 y el posicionamiento "herramienta del contador" existen precisamente para esto. Validar con contadores reales |
| R7 | Devaluación: costos en dólares, ingresos en pesos | Medio | Precios con actualización periódica. Margen sobre infraestructura suficientemente amplio |
| R8 | Un competidor nacional agrega Ley 19.640 | Bajo-medio | El foso no es la exención: es el conocimiento local y la relación directa |

---

## 8. Lo que este documento todavía no puede responder

Por honestidad intelectual, la lista de lo que falta:

1. **Cuántos comercios direccionables hay en TDF.** Método en §1.2, ejecución pendiente.
2. **Cuánto paga hoy un comerciante por software.** Sale de las entrevistas.
3. **Cuánto cuesta la IA por comercio y por mes.** Sale del piloto.
4. **Cuántas horas cuesta un onboarding.** Sale del primer cliente real.
5. **Si el canal contador funciona.** Sale de hablar con contadores.
6. **Si el gate legal B-IA se puede resolver.** Sale del abogado.

**Ninguna de las seis se resuelve programando.** Todas se resuelven saliendo a hablar con gente. Ese es el próximo paso del proyecto.

---

## 9. Referencias

- [VALIDACION-MERCADO-TDF.md](VALIDACION-MERCADO-TDF.md) — guion de entrevistas, hipótesis y criterio Go/No-Go
- [NON-GOALS.md](NON-GOALS.md) — lo que Pandora explícitamente no va a ser
- [CAPABILITY-MAP.md](CAPABILITY-MAP.md) — qué hace el producto hoy
- [files/ADR-0024-ia-boundary-policy.md](files/ADR-0024-ia-boundary-policy.md) — el contrato "la IA sugiere, nunca decide"
- [reunion-contador-y-abogado.md](reunion-contador-y-abogado.md) — consultas profesionales abiertas, incluido B-IA
- [CLAUDE.md](CLAUDE.md) §1 — contexto ejecutivo y diferenciadores

---

*Documento creado 2026-09-04. Los números marcados `VERIFICAR` / `A VALIDAR` / `MEDIR` son huecos conocidos, no omisiones: se completan con trabajo de campo, no con estimaciones.*
