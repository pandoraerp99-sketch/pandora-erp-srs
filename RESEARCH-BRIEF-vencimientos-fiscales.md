# Research Brief — `Próximos vencimientos` (panel de la contadora)

**Fecha:** 2026-09-09
**Estado:** 🧩 diseño — **NO construido** al 2026-09-14 (no hay tabla de vencimientos; sólo feriados, migrations 0028/0029). Falta además la pasada de verificación del calendario anual (§ pendientes)
**Autor:** sesión Claude + Agus
**Relacionado:** panel `/contador` · maqueta `pos-preview/contador-v2.html` · `tax-policy-versions/` · memoria `feedback-validar-fuentes-oficiales`

---

## 1. Objetivo del módulo

La sección "Próximos vencimientos" del panel de la contadora: cuatro tarjetas con
**qué obligación vence, cuándo y por cuánto** (IVA, IIBB TDF, Ganancias, SICORE).

## 2. Problema de negocio

- **Problema:** presentar tarde una DDJJ es multa automática. Hoy la contadora
  lleva el calendario aparte (agenda, Excel, memoria) y el comerciante no lo ve
  nunca.
- **Usuarios:** la contadora primero; el dueño de rebote ("¿qué se me viene?").
- **Impacto:** ALTO. Es probablemente lo más valioso del panel: el resto son
  números que ella ya podría sacar; esto es una alarma.
- **Complejidad:** media, pero con un riesgo asimétrico — una fecha mal puesta
  es peor que no mostrar nada.

## 3. Investigación (fuentes)

| Categoría | Qué se miró | Hallazgo clave | Fuente |
|---|---|---|---|
| Oficial (portal) | Agenda de vencimientos de ARCA | **Sólo enlaza a una agenda interactiva** (`seti.afip.gob.ar/av/seleccionVencimientos.do`) que pide datos por formulario. No es un documento citable ni fetcheable. | https://www.arca.gob.ar/vencimientos/ (2026-09-09) |
| Oficial (norma) | RG 4172-E/2017, la que fija los vencimientos generales por terminación de CUIT | El cuerpo de la norma **no trae las fechas**: remite a un Anexo (`IF-2017-00005729-AFIP-DVCOTA#SDGCTI`) que no se reproduce en el texto publicado. | https://servicios.infoleg.gob.ar/infolegInternet/anexos/305000-309999/305148/norma.htm (BO 26/12/2017) |
| Oficial (portal gob) | argentina.gob.ar/arca/vencimientos | **SÍ publica el cronograma mes a mes, por terminación de CUIT.** Es la fuente utilizable. | https://www.argentina.gob.ar/arca/vencimientos (2026-09-09) |
| Oficial (BO) | RG 5851/2026, 5876/2026, 5890/2026 | Al menos **tres prórrogas en 2026** que corrieron fechas ya publicadas (1er anticipo de Ganancias movido a 27/07 y después a 24/09). | boletinoficial.gob.ar — avisos 342284 (22/05), 344534 (20/07), 346339 (25/08) |
| Secundarias | Blogs y calculadoras de vencimientos | Todas repiten la misma "regla": 0-1→18, 2-3→19, 4-5→20, 6-7→21, 8-9→22. | calcularsueldo, yo-facturo, txtfacil, foro.ar |
| Contraste | La regla contra el dato oficial | **La regla es FALSA.** Para junio 2026 el oficial dice 18, 19, **22, 23, 24** — porque los días caen en fin de semana y se corren. Una fecha calculada con la regla habría dado **20/06** donde el vencimiento real es **22/06**. | argentina.gob.ar (2026-09-09) |
| Provincial | IIBB Tierra del Fuego (AREF) | **No está en el calendario de ARCA.** Es otro organismo y otro calendario. | — (pendiente) |
| Errores comunes | Qué evitar | Sistemas que calculan la fecha con la regla y quedan desfasados los meses con feriado; y los que scrapean y muestran lo último que salió bien. | — |

## 4. Síntesis — ¿qué incorporamos?

| Fuente | Idea | ¿Vale? | Nota |
|---|---|---|---|
| argentina.gob.ar | Calendario mensual por terminación de CUIT como **dato cargado** | ✅ | Es la única fuente oficial legible por máquina. |
| RG 4172 | Derivar la fecha de una regla fija | ❌ | El propio dato oficial la contradice. |
| Prórrogas 2026 | El calendario **caduca durante el año** | ✅ | Obliga a versionar y a mostrar la fecha de verificación. |
| Blogs | Usarlos como fuente | ❌ | Coinciden entre ellos y difieren del oficial. Coincidir no es estar bien. |

## 5. Estado del arte

Los sistemas contables argentinos (Tango, Bejerman, Xubio) traen el calendario
**cargado por el proveedor** y lo actualizan por release. Ninguno lo calcula.
El listón, entonces, no es "calcularlo bien": es **tenerlo actualizado y que se
note cuándo no lo está**.

## 6. Ideas innovadoras — qué hacemos MEJOR

La invariante del proyecto aplicada acá: **"verify, don't trust" + fail-closed**.

- Cada fecha guarda **de dónde salió y cuándo se verificó**.
- Si el calendario cargado no cubre el período que se está mirando, la sección
  **lo dice** en vez de mostrar la fecha vieja o una calculada. Una fecha
  incorrecta se archiva como si fuera cierta; un "calendario desactualizado"
  hace que alguien lo mire.
- Es exactamente el criterio de ADR-0025 (catálogos regulatorios con boot
  validation fail-closed) y del resto del panel: mejor "no lo sé" que un número
  que parece bien.

## 7. Qué NO vamos a implementar

| Idea descartada | Por qué | Trigger para revisar |
|---|---|---|
| Calcular la fecha con la regla por terminación de CUIT | El dato oficial la contradice (junio 2026: 22 y no 20). Un error de 2 días en una DDJJ es multa. | Nunca. Es incorrecto, no incompleto. |
| Scrapear ARCA automáticamente | La página cambia de forma y un scrape roto muestra la última fecha buena como si fuera de hoy — el peor modo de falla. | Si ARCA publica una API o un archivo estable. |
| Calcular el MONTO a pagar de IVA | Falta el crédito fiscal: no hay carga de compras. Un "saldo a pagar" sin crédito está mal, no incompleto. | Cuando exista el módulo de compras. |
| Anticipos de Ganancias e IIBB con monto | Necesitan el cálculo del impuesto y la parametrización provincial. | F1+/F2. |
| Avisar por mail/WhatsApp del vencimiento | Es una promesa de entrega: si el mail no sale, el comercio presenta tarde y la culpa es nuestra. | Cuando haya notificaciones con reintento y evidencia de envío. |

## 8. Decisión de diseño

**El calendario es DATO, no lógica.** Se guarda versionado con la misma
disciplina que `tax-policy-versions/`: cada entrada con impuesto, período,
terminación de CUIT, fecha, y **URL + fecha de verificación**.

La pantalla muestra:
- las obligaciones cuyo vencimiento **está cargado y cubre el período**;
- la **fecha de última verificación** del calendario, a la vista;
- y si no hay calendario para el período, lo dice — no calcula, no reusa el
  anterior.

Los **montos** quedan fuera de esta iteración: sólo IVA débito es real, y el
saldo a pagar necesita crédito fiscal. La tarjeta muestra la fecha (que es lo
accionable) y declara que el monto todavía no se calcula.

## 8-bis. AMPLIACIÓN (2026-09-09) — hay DOS calendarios, no uno

El pedido real de una contadora a una SAS (ver
`EVIDENCIA-pedido-contadora-2026-09.md`) muestra que este brief cubría sólo la
mitad del problema.

| Calendario | Se ordena por | Ejemplos |
|---|---|---|
| **Mensual** (lo investigado acá) | terminación de CUIT | IVA F2002, Monotributo, SICORE |
| **Anual de sociedades** (NO investigado) | **fecha de cierre de ejercicio** | Ganancias Sociedades, P.U.B., Participaciones Societarias |

Para ROMERO & RUIZ SAS (cierre 31/07/2026) la contadora informa: Ganancias
Sociedades **14/12/2026**, P.U.B. **31/01/2027**, Participaciones Societarias
**28/07/2027**.

Consecuencias:

1. **Falta un dato en `companies`: la fecha de cierre de ejercicio.** Sin eso no
   se puede ubicar a la empresa en el calendario anual — ni ofrecer "el
   ejercicio" como período en el panel, que es el recorte con el que la
   contadora trabaja de verdad. El selector "Año" usa año calendario, que para
   esta empresa **no corresponde**.
2. El calendario anual necesita su propia pasada de verificación. Queda
   pendiente.

## 8-ter. El costo de equivocarse ahora tiene número — VERIFICADO

**Ley 27.799**, art. 15 (BO 02/01/2026) sustituye en el art. 38 de la Ley 11.683
la multa por falta de presentación en término: de "$400" a **"$440.000"** para
sociedades, y de "$200" a **"$220.000"** para personas humanas.

Fuente: https://www.boletinoficial.gob.ar/detalleAviso/primera/337029/20260102
(verificado 2026-09-09).

Eran importes nominales congelados desde hacía décadas. Esto refuerza las dos
decisiones del brief: la sección vale mucho más de lo que parecía, y **no se
inventa una fecha** — el costo del error tiene precio de lista.

## 9. Plan de implementación

- **MVP:** tabla/archivo de calendario + la sección con fechas reales +
  indicador de "verificado el <fecha>" + guard de calendario faltante.
- **Carga inicial:** una pasada de verificación contra
  `argentina.gob.ar/arca/vencimientos` para el período en curso, citando fuente
  y fecha. **La hace una persona, no el sistema.**
- **F1+:** IIBB TDF (AREF) — otro organismo, otro calendario, hay que
  investigarlo aparte.
- **F1+:** montos, cuando exista carga de compras.

---

## Nota sobre el método

Este brief existe porque la regla del proyecto es no afirmar fechas de AFIP de
memoria. Valió la pena: **la versión "de memoria" habría estado mal.** La regla
que repiten todas las fuentes secundarias da 20/06 para terminación 4-5, y el
vencimiento real de ese mes fue el 22/06.
