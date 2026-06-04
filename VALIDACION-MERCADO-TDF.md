# Validación de Mercado — Pandora ERP TDF F0

**Versión:** 1.0.0
**Fecha:** 2026-05-29
**Estado:** vigente — ejecución pendiente
**Propósito:** filtrar Go/No-Go del proyecto Pandora mediante 5 entrevistas a comerciantes TDF reales ANTES de escribir código productivo.

> Esta acción surge del [MASTER AUDIT 2026-05-28](../../memory/master-audit-2026-05-28.md): el target "5 clientes pagando" se asumió, nunca se midió. PMF, pricing y features no-negociables están sin validar empíricamente. Sin este filtro, hay 40-60% de probabilidad de burnout/abandono.

---

## 0. Por qué esto antes que cualquier código

Pandora tiene ~80k líneas de spec arquitectónica y 0 líneas de código productivo. Antes de invertir 14-16 semanas solo-dev en Sprint 0-10, hay que validar:

1. **¿Existe el dolor real?** No "todos sufren con AFIP" genérico — específico, con costo y frecuencia medibles.
2. **¿Hay disposición a cambiar?** El comerciante TDF promedio usa lo que usa hace 10 años. Cambiar es costo, no beneficio neutral.
3. **¿El pricing asumido (\$25k kiosco / \$60k mercería) sobrevive a 1 conversación real?** Probablemente no a la primera.
4. **¿Las features que dimos por F0 son las correctas?** Sin NC F0 puede ser bloqueante para mercerías. Sin scanner para ferreterías. Sin impresora térmica para todos.

**Costo de saltearse esto:** escribir 8 semanas de POS + fiscal y descubrir que (a) nadie lo necesita, (b) lo necesitan pero al precio que ofrecemos no, (c) faltan features sin las cuales no migra nadie.

**Costo de hacerlo:** 1 semana de campo, ~ARS 50-100k en cafés/almuerzos/tiempo, 5 conversaciones de 30-45 min cada una.

ROI: si descubrís 1 cosa que cambia el scope F0, ahorraste semanas de código equivocado.

---

## 1. Hipótesis a *disconfirmar* (no confirmar)

El sesgo natural es buscar señales positivas. Mom Test 101: andá a *disconfirmar* tus hipótesis. Si sobreviven al ataque empírico, son robustas.

### Hipótesis principales a poner en duda

| # | Hipótesis | Cómo se disconfirma |
|---|---|---|
| H1 | El comerciante TDF sufre con su sistema actual de facturación. | Si describe el sistema actual sin quejas concretas, sin episodios reales recientes, sin haber gastado plata en arreglarlo → H1 falsa. |
| H2 | El comerciante TDF cambiaría de sistema si hay uno mejor. | Si ya intentó cambiar y volvió + razones, o si dice "para qué cambiar si funciona" → H2 falsa. |
| H3 | El comerciante TDF pagaría ~ARS 25-60k/mes por POS+ERP+contador integrado. | Si reacciona con shock al precio, o paga menos hoy por algo equivalente → H3 falsa. |
| H4 | F0 sin Notas de Crédito alcanza para los primeros 5 clientes. | Si 3+ de 5 dicen "tengo devoluciones todas las semanas" → H4 falsa. F0 necesita NC. |
| H5 | F0 con impresora térmica básica (ESC/POS) alcanza. | Si descubrís marcas/modelos específicos que NO soportan ESC/POS o requieren driver propietario → H5 falsa parcial. |
| H6 | El contador integrado gratuito multi-empresa es el diferenciador clave. | Si comerciantes dicen "mi contador tiene su sistema, no le voy a cambiar" → H6 sobrevive sólo si 3+ contadores dicen lo contrario. |
| H7 | El target real de F0 es kiosco/mercería/ferretería/panadería pequeños. | Si los que tienen el dolor real son comercios *medianos* (5-15 empleados) y los chicos no necesitan tanto → H7 falsa. Re-targetear. |

### Cómo registrarlo

Cada hipótesis tiene **3 estados**: sobrevive / sobrevive parcial / refutada. Al final de las 5 entrevistas, cada H queda con un veredicto.

---

## 2. Quiénes entrevistar — perfil de los 5

Buscar **diversidad de rubros**, NO 5 kioscos. Si los 5 son del mismo rubro, sesgo de muestra. Mix recomendado:

| # | Rubro | Por qué importa | Específico TDF |
|---|---|---|---|
| 1 | Kiosco / autoservicio chico | Volumen alto, ticket bajo, velocidad de cobro crítica | Río Grande centro / Ushuaia centro |
| 2 | Mercería / textil | Devoluciones frecuentes (NC), inventario alto, ticket medio | Ferretería de barrio o mercería tradicional |
| 3 | Ferretería | Catálogo extenso (1000+ SKU), B2B mixto con consumidor final | Ferretería barrial con 1-2 cajas |
| 4 | Panadería / despensa | Productos diarios, balanza, peso variable | Panadería tradicional con horneo propio |
| 5 | Comodín (heladería / librería / quiosco-locutorio) | Captura un rubro no anticipado | Algo que aparezca naturalmente en tu zona |

**Criterio de inclusión:**
- 1-3 empleados (incluido dueño)
- 1-2 cajas POS o cuasi-POS
- 30-200 ventas/día (aproximado)
- Régimen fiscal típico: RI + Ley 19.640 o Monotributo
- Dueño accesible (no franquicia con manager corporativo)

**Criterio de exclusión:**
- Negocios sin facturación AFIP (informalidad pura)
- Gastronomía con servicio de mesa (NO target)
- Comercio en línea / e-commerce (NO target)
- Multi-sucursal (NO target F0)

---

## 3. Cómo conseguir las entrevistas

### Vías de acceso (de fácil a difícil)

1. **Tu red personal en TDF.** Listá ahora 10 comerciantes que conozcas o conozca alguien cercano (familia, amigos, vecinos). Pedí 1 introducción cada uno. Conversión esperada: 3-4 de 10.
2. **Visita en frío en horario tranquilo.** Mañana temprano (8-10am) o siesta (15-17h) según rubro. Llevá café/medialunas. Pedí 15 min. Si dan, alargás a 30. Conversión esperada: 1-2 de 10 puertas.
3. **Cámara de Comercio TDF / asociación rubro.** Pedile a un dirigente que te conecte con 2-3 socios.
4. **Tu contador / abogado actual.** Si tienen clientes comerciantes TDF, una intro es la mejor llave.

### Cómo presentarse

> "Hola, soy Agus, vivo en Río Grande. Estoy investigando cómo trabajan los comerciantes de la zona con la facturación AFIP y los sistemas que usan. No te voy a vender nada. Necesito 30 minutos para entender cómo es tu día a día y qué te complica. ¿Cuándo te queda cómodo?"

**Reglas:**
- NO decir "tengo un sistema/app/producto". Decirlo cierra al entrevistado en modo "cliente potencial".
- NO ofrecer descuento / acceso temprano. Es soborno; sesga la respuesta.
- SÍ ofrecer compartir los resultados ("cuando termine, te paso lo que encontré").
- SÍ pagar el café / medialunas / lo que sea. Acto de respeto, no transacción.

### Compensación por el tiempo

- Café + medialunas (ARS 5-10k por entrevista) suficiente para 30 min.
- Si la entrevista pasa de 45 min, ofrecer almuerzo otro día como cierre + segunda ronda.
- NO pagar plata directa por la entrevista — distorsiona la respuesta (dirán lo que crean que querés escuchar).

---

## 4. Guion de entrevista (30-45 min)

**Estructura:**
- Bloque A (5 min) — calentamiento + contexto
- Bloque B (15 min) — dolor actual, específico, con plata y tiempo
- Bloque C (10 min) — features no-negociables + flujos críticos
- Bloque D (10 min) — pricing + disposición a cambiar
- Bloque E (5 min) — cierre + pedido de intro / próximo paso

**Regla maestra:** preguntar por el **pasado** y por **hechos concretos**, no por hipótesis ni opiniones sobre el futuro.

### Bloque A — Calentamiento (5 min)

1. *"Contame cómo arrancó el comercio. ¿Hace cuánto estás acá?"*
2. *"¿Cuántas personas trabajan? ¿Quiénes atienden caja?"*
3. *"¿Cuántas ventas hacen un día promedio? ¿Y un sábado o fin de mes?"*
4. *"¿Cómo es el cliente típico? ¿Vienen seguido o pasan una vez?"*

**Qué buscás:** contexto + volumen real (para validar target F0) + perfil del cliente final (CF vs B2B).

### Bloque B — Dolor actual (15 min) — CRÍTICO

5. *"Cuando llega un cliente, ¿qué hacés desde que entra hasta que se va? Llevame paso por paso."*
6. *"¿Con qué facturás? ¿Tango? ¿RCEL? ¿La web de AFIP? ¿Manual?"*
7. *"Cuando vendés algo, ¿cómo lo descontás del stock?"*
8. *"¿Cuándo fue la **última vez** que tuviste un problema con la facturación AFIP? Contame qué pasó."* ← oro puro
9. *"¿Te pasó alguna vez que AFIP rechazara una factura? ¿O que se te quedara colgado el sistema en pleno cobro? ¿Qué hiciste?"*
10. *"¿Cuántas horas por semana te lleva el tema administrativo — facturas, IVA, planillas para el contador?"*
11. *"¿Y al cierre del mes? ¿Cuánto tiempo te lleva preparar lo que necesita el contador?"*
12. *"¿Tu contador cómo recibe los datos? ¿Le mandás Excel? ¿Le das acceso a algún sistema? ¿Le imprimís todo?"*
13. *"¿Cuál es **la cosa que más te jode** del sistema actual? Si pudieras eliminar UNA, ¿cuál sería?"*

**Qué buscás:**
- Hechos concretos (no genéricos: "todo es un quilombo")
- Episodios recientes (último mes / última semana)
- Tiempo medible perdido (horas/semana)
- Plata medible perdida (multas, rectificativas, retrabajo)
- Intentos previos de arreglar el problema (¿cambió de sistema? ¿pagó por algo?)

### Bloque C — Features no-negociables (10 min)

14. *"¿Cuántas devoluciones / notas de crédito hacés por mes? ¿Cómo las manejás hoy?"* ← H4
15. *"¿Cuándo emitís una factura, ¿qué impresora usás? ¿Andan los rollos? ¿Te quedaste sin tinta alguna vez en medio de la venta?"* ← H5
16. *"¿Usás lector de código de barras? ¿De qué marca? ¿Para qué productos?"*
17. *"¿Cómo cargás un producto nuevo al sistema? Si te llega un proveedor con 50 productos, ¿cómo los das de alta?"*
18. *"Hablame de TDF — ¿qué de la mercadería tuya está amparada por Ley 19.640? ¿Tu contador te dice cuál sí y cuál no?"*
19. *"¿Cómo cobrás? Efectivo / tarjeta / MercadoPago QR. ¿Cuál es el mix?"*
20. *"¿Cómo cerrás la caja al final del día? ¿Te cuadra siempre?"*

**Qué buscás:**
- Frecuencia real de NC (si >5/mes → F0 necesita NC)
- Modelo de impresora y problemas (define soporte hardware F0)
- Scanner: marcas + casos de uso
- Importación de catálogo (cómo entra Excel/lista a Pandora)
- Régimen 19.640 entendido por el comerciante (o no — implica documentación nuestra)
- Mix de medios de pago (define prioridad MercadoPago vs efectivo)

### Bloque D — Pricing + disposición a cambiar (10 min)

21. *"¿Hoy cuánto pagás por mes en software de facturación / contable / POS, sumando todo?"*
22. *"¿Cuánto le pagás al contador?"*
23. *"¿Pagaste alguna vez por capacitación de software? ¿Te capacitó alguien cuando arrancaste con AFIP?"*
24. *"Si te dijera que existe un sistema único que hace POS + factura AFIP + stock + el contador entra directo a ver los datos sin que vos le mandes nada — ¿lo usarías? ¿Por qué sí, por qué no?"*
25. *(Si responde positivo)* *"¿Cuánto pagarías por mes por algo así?"* ← NO sugerir precio primero
26. *(Si dice un número)* *"¿Y si te dijera \$25.000/mes? ¿Y \$60.000?"* ← chequear elasticidad
27. *"¿Qué tendría que cumplir SÍ o SÍ para que migres del sistema que usás hoy?"*
28. *"Para que pruebes algo nuevo, ¿qué garantía necesitarías? ¿Trial? ¿Que alguien venga a instalarlo? ¿Recomendación de tu contador?"*

**Qué buscás:**
- Pricing actual real (base de comparación)
- Reacción a los números asumidos por Pandora
- "Tendría que cumplir SÍ o SÍ" → features bloqueantes reales
- Mecanismo de confianza para migrar (onboarding implícito)

### Bloque E — Cierre (5 min)

29. *"¿Conocés a 2 o 3 comerciantes más que les pasen cosas parecidas y a quienes les podría hacer la misma entrevista?"* ← test de compromiso
30. *"¿Te parece si te aviso cuando esto esté listo para probar?"* (No prometer features ni fechas)
31. *"¿Me podés pasar el contacto de tu contador? Me gustaría entender el lado de él también."* ← bonus para Parte B advisor

**Qué buscás:**
- ¿Te pasa contactos? Señal fuerte (interés real).
- ¿Te deja avisarle? Señal media.
- ¿Te pasa contacto del contador? Señal muy fuerte.
- Si dice "no, gracias" a todo → señal débil de PMF en ese segmento.

---

## 5. Template de captura de respuestas

Llenar inmediatamente al salir de cada entrevista (5-10 min máximo después). NO confiar en la memoria 24h después.

```
═══════════════════════════════════════════════════
ENTREVISTA #__ — [Fecha YYYY-MM-DD] — [Hora] — [Lugar]
═══════════════════════════════════════════════════

PERFIL
- Nombre + apodo: __________
- Rubro: __________
- Ubicación (Río Grande/Ushuaia + barrio): __________
- Empleados: __ | Cajas: __ | Ventas/día aprox: __
- Régimen fiscal: RI / Monotributo / IVA Liberado 19.640 / mixto
- Sistema actual: __________

DOLOR — citas literales si las dijo
- Último problema fiscal concreto: __________
- Tiempo administrativo/semana: __ horas
- Cosa que más le jode: "__________"
- ¿Intentó cambiar antes? Sí / No / Detalle: __________

FEATURES NO-NEGOCIABLES
- NC/mes aprox: __ → bloqueante F0? Sí / No
- Impresora actual: marca __________ — problemas: __________
- Scanner: Sí / No — uso: __________
- Carga de productos: __________
- 19.640: entiende régimen Sí / No / Parcial
- Mix de pago: __% efectivo / __% tarjeta / __% MP

PRICING
- Paga hoy por software: ARS __________ / mes
- Paga al contador: ARS __________ / mes
- Lo que dijo que pagaría por Pandora: ARS __________ / mes
- Reacción al precio asumido (25k/60k): "__________"
- Condiciones para migrar (features SÍ o SÍ): __________

CIERRE
- ¿Pasó contactos? Sí / No → Cuántos: __
- ¿Acepta seguimiento? Sí / No
- ¿Pasó contacto del contador? Sí / No → nombre: __________

OBSERVACIÓN DEL ENTREVISTADOR
- Lenguaje corporal / interés genuino vs cortesía: __________
- Algo inesperado que dijo / mostró: __________
- Mi instinto: ¿pagaría realmente? Sí / Tal vez / No

VEREDICTO H1-H7 PARA ESTA ENTREVISTA
- H1 dolor real: sobrevive / parcial / refutada
- H2 cambiaría: sobrevive / parcial / refutada
- H3 precio: sobrevive / parcial / refutada
- H4 sin NC F0: sobrevive / parcial / refutada
- H5 impresora ESC/POS: sobrevive / parcial / refutada
- H6 contador integrado clave: sobrevive / parcial / refutada
- H7 target chico correcto: sobrevive / parcial / refutada
```

Guardalo como `c:\Users\Pandora\Desktop\SRS\entrevistas-tdf\entrevista-NN-YYYY-MM-DD.md`. Crear carpeta `entrevistas-tdf/` cuando hagas la primera.

---

## 6. Criterio Go / No-Go (post 5 entrevistas)

Después de las 5 entrevistas, contar:

### Señales de GO (mínimo 3 de 5 deben darse)

- [ ] Describió dolor concreto reciente (último mes) con costo medible (tiempo o plata).
- [ ] Ha gastado plata en intentar arreglarlo (cambió de sistema, pagó capacitación, contrató asistente).
- [ ] Aceptó un número de precio ≥ ARS 20k/mes sin shock visible.
- [ ] Pasó al menos 1 contacto (otro comerciante o su contador).
- [ ] Identificó features bloqueantes ALINEADAS con scope F0 actual (no requiere 5 features F2+).

### Señales de NO-GO (si ≥3 de 5 se dan, parar Pandora)

- [ ] "Lo que uso me funciona bien" sin episodios negativos recientes.
- [ ] Precio máximo dicho < ARS 10k/mes.
- [ ] Features bloqueantes que NO tenemos F0 ni cerca (multi-sucursal, MRP, e-commerce, manejo de mesa).
- [ ] No conoce comerciantes con el mismo dolor / no pasa contactos.
- [ ] Su contador "tiene su sistema, no le voy a cambiar" + comerciante coincide.

### Casos intermedios

- **GO parcial:** PMF existe pero scope F0 está mal calibrado. → Reajustar F0 (probablemente agregar NC + asegurar impresora ESC/POS + simplificar pricing).
- **GO con re-targeting:** PMF existe pero NO en el target asumido. → Cambiar target (ej. el dolor está en ferreterías medianas, no en kioscos chicos). Re-spec parcial.
- **NO-GO:** PMF no se valida. → Pivot del producto, pivot del segmento, o pause indefinida del proyecto.

### Output esperado

Al cierre escribir `c:\Users\Pandora\Desktop\SRS\entrevistas-tdf\SINTESIS-2026-MM-DD.md` con:

1. Tabla de 5 entrevistados + veredicto por hipótesis.
2. Top 3 dolores reales con cita literal.
3. Top 3 features no-negociables que aparecieron repetidas.
4. Rango de pricing real observado (mín / max / mediana / lo que pagarían).
5. Veredicto Go / No-Go / Re-targetear con justificación.
6. Si Go: lista de ajustes al scope F0 antes de Sprint 0.
7. Si Re-targetear: nuevo target propuesto + nuevas hipótesis.
8. Si No-Go: análisis y decisión sobre el proyecto.

---

## 7. Anti-patterns — qué NO hacer

| Anti-pattern | Por qué malo | Qué hacer |
|---|---|---|
| Pitchear el producto antes de escuchar | Cierra al entrevistado en modo "evaluador de producto" | Hablar del producto sólo al final, después de entender contexto |
| Preguntar "¿usarías esto?" | Sesgo de cortesía — todos dicen que sí | Preguntar qué hizo HOY / la última vez |
| Preguntar "¿cuánto pagarías?" sin contexto | Respuestas sin compromiso | Primero preguntar qué paga HOY |
| Aceptar cumplidos como datos | "Está re bueno" no es PMF | Pedir compromiso concreto: "¿me pasás contactos?" |
| Entrevistar a tu mejor amigo o familiar | Sesgo de cariño | Mix con extraños o conocidos lejanos |
| Hacer 5 entrevistas en 1 día | Saturación → no procesás | Máximo 2/día, llenar template entre cada una |
| No grabar / no anotar | Recuerdo se distorsiona en 24h | Llenar template inmediato al salir |
| Cambiar el guion entre entrevistas para "mejorarlo" | Sesgo de comparación pérdida | Mantener guion estable las 5; iterar al final |
| Dejar que la entrevista se vaya a un tema no-Pandora | Pierde foco | Volver suavemente: "¿y volviendo al tema de la facturación...?" |
| Mostrar diseños / mockups / atmospheres | Sesgo estético prematuro | El POS premium se valida cuando exista el POS |

---

## 8. Logística mínima

### Materiales

- Cuaderno físico + lapicera (parece más profesional que telefono/laptop en el comercio).
- Celular para grabar audio (pedir permiso explícito; si dice no, no grabes).
- Template de captura impresa o en celular para repaso.
- ARS 50-100k de bolsillo para cafés/medialunas.

### Tiempo de Agus

- 5 entrevistas × 45 min = 3.75 horas reales.
- + traslado en TDF (Río Grande es chico, Ushuaia tiene más distancias) → 5-7 horas de campo total.
- + procesamiento (llenar template) → 1-2 horas.
- + síntesis final → 2-3 horas.
- **Total: 1 semana calendario con 1-2 horas/día activas.**

### Calendario sugerido

| Día | Acción |
|---|---|
| Lunes | Listar 10 candidatos en red personal. Mandar 5 mensajes pidiendo intro. |
| Martes | Confirmar 2-3 entrevistas. Hacer la #1. |
| Miércoles | Hacer #2. Procesar templates. |
| Jueves | Hacer #3 y #4. |
| Viernes | Hacer #5. |
| Sábado | Sintetizar. Veredicto Go/No-Go. |
| Domingo | Si Go: ajustar scope F0 + arrancar P2 (contador/abogado) lunes. Si No-Go: dormirlo, pensar el lunes. |

### Si no conseguís 5 en 1 semana

- 4 entrevistas pueden alcanzar si los veredictos H1-H7 son contundentes (todos GO o todos NO-GO).
- Si están mezclados, hacé la 5ta como tiebreaker.
- Más de 7 entrevistas = procrastinación. Si después de 5-7 no hay claridad, el problema es la pregunta, no la muestra.

---

## 9. Después de las 5 entrevistas

### Si GO

1. Aplicar ajustes al scope F0 (ej. agregar NC si 3+ pidieron, validar marca de impresora).
2. Actualizar `ROADMAP.md` con los ajustes.
3. Documentar en `DECISION-LEDGER.md` el resultado de validación.
4. Arrancar P2 (contador + abogado) y P3 (setup cuentas externas) en paralelo.
5. Arrancar P4 (spike técnico) cuando P2/P3 estén en curso.
6. Sprint 0 código la semana siguiente al spike exitoso.

### Si GO con re-targeting

1. Documentar nuevo target en `pandora-erp-project-state.md` + memoria.
2. Re-examinar `NON-GOALS.md` y `CAPABILITY-MAP.md` — pueden necesitar ajustes.
3. Re-pricing F0 según lo observado.
4. Volver a paso #4 del flow Go normal.

### Si NO-GO

1. Documentar honestamente en `DECISION-LEDGER.md`: "validación de mercado 2026-MM-DD refutó H1/H2/H3 → proyecto en pausa indefinida".
2. Guardar el package SRS como referencia (puede servir si en 6 meses cambia algo).
3. Considerar pivot:
   - Mismo producto, otro target (multi-sucursal? gastronomía? otra provincia?)
   - Otro producto, mismo target TDF (consultoría de AFIP? software de uso interno?)
   - Salir del problema (otro proyecto)
4. **No es derrota.** Validar antes de codear ahorró ~14 semanas de trabajo en vacío. Eso es ganancia, no pérdida.

---

## 10. Cómo evitar auto-engaño durante las entrevistas

El sesgo de confirmación es enemigo. Tres trucos:

1. **Antes de cada entrevista, releé las 7 hipótesis a *disconfirmar*** (no a confirmar). Vas con la mentalidad de buscar el agujero.
2. **Llevá un colega o pareja a la #1 sólo a escuchar**. Después le pedís: "¿qué escuchaste vos?". Doble lectura captura sesgos.
3. **Al cerrar el template, escribí en una línea: "señal contraria más fuerte de esta entrevista"**. Forzás a registrar lo que NO querías escuchar.

Si al final de las 5 entrevistas tenés más "señales contrarias" que "señales positivas", el NO-GO es real, no es derrotismo.

---

## 11. Lo que esta validación NO mide

Por honestidad, lo que NO se valida con esto:

- Si tu UI Dawn Sky + 3 atmospheres es diferenciador real (eso lo valida un piloto con 1-2 clientes reales).
- Si tu performance P95 < 3s se cumple (eso lo valida producción).
- Si tu integración AFIP funciona bien (eso lo valida homologación + piloto).
- Si tu pricing exacto es el óptimo (eso requiere 10-20 clientes pagando para curva real).
- Si Pandora escala a 30+ clientes (problema F1+).

Esto sólo mide: **¿existe el problema, lo viven personas a las que podés llegar, y pagarían algo razonable por una solución?** Es el filtro mínimo previo al código.

---

## 12. Cross-references

- [master-audit-2026-05-28](../../memory/master-audit-2026-05-28.md) — auditoría que motiva esta acción
- [ROADMAP.md](ROADMAP.md) — sprints quedan en pausa hasta veredicto
- [reunion-contador-y-abogado.md](reunion-contador-y-abogado.md) — P2 a ejecutar en paralelo
- [NON-GOALS.md](NON-GOALS.md) — para revisar si re-targeting altera límites
- [CAPABILITY-MAP.md](CAPABILITY-MAP.md) — para revisar si features no-negociables exigen ajuste F0

---

*Documento creado 2026-05-29. Ejecución estimada: 1 semana calendario. Output esperado: veredicto Go / No-Go / Re-targeting documentado en `entrevistas-tdf/SINTESIS-YYYY-MM-DD.md` + ajustes a `DECISION-LEDGER.md`.*
