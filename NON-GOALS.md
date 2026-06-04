# NON-GOALS.md — Pandora ERP

**Versión:** 1.0.1
**Fecha:** 2026-06-03 (ampliación post 14-point strategic review + ADR-0024: agregados N-FEAT-16/17/18/19/20)
**Estado:** vigente
**Propósito:** lista AGRESIVA y FORMAL de lo que Pandora ERP NO va a ser, con triggers explícitos para reabrir si aparece evidencia real. **Este documento existe para impedir scope explosion.**

> **Si una propuesta viola este documento sin trigger objetivo: RECHAZAR.** Sin discusión. Sin "pero qué tal si...". Documentar la propuesta + razón de rechazo en memoria `over-engineering-rejected.md` y seguir.

---

## Por qué este documento existe

El mayor riesgo de Pandora **NO es técnico**. Es **scope explosion** — la enfermedad que convierte un POS+ERP retail TDF en una bola caótica intentando ser Odoo + Tango + SAP + WooCommerce + Stripe + Salesforce, sin lograr nada bien.

Sin un NON-GOALS formal:
- Cada feature parece "fácil de agregar"
- Las decisiones se acumulan sin filtro
- El producto pierde identidad
- El equipo pierde foco
- Los clientes pagan por algo que NO usan
- Pandora se vuelve indefendible vs competidores especializados

**Con un NON-GOALS formal:**
- Toda propuesta pasa por filtro objetivo
- Las negativas son sistemáticas, no caprichosas
- El equipo gana foco
- El producto gana identidad
- Pandora puede ganar a competidores especializados EN SU NICHO

---

## Jerarquía con otros docs

- **DECISION-LEDGER** > este doc (si DECISION-LEDGER reabre algo formalmente, este doc se actualiza).
- **CLAUDE.md §4.2 + §5.3 + §21.3** define lo mismo a nivel constitución. Este doc lo profundiza y lo hace standalone para referencias externas.
- **backlog-validaciones.md** lista items DIFERIDOS (van a ser hechos eventualmente). NON-GOALS lista items que **NO van a ser hechos** salvo trigger objetivo claro.

**Diferencia conceptual clave:**
- **Diferido (backlog):** lo voy a hacer en F1/F2/F3, sólo no ahora.
- **NON-GOAL:** NO lo voy a hacer salvo que aparezca evidencia que justifique reabrir la decisión.

---

## CATEGORÍA 1 — Mercados que Pandora NO atiende

### N-MKT-01 — Restaurantes / gastronomía

**Rechazado.** Sin lógica de mesa, comanda, cocina, propinas, división de cuenta, takeaway, delivery integration.

**Por qué:** target F0 es retail (kiosco, ferretería, mercería). Gastronomía requiere modelo de datos distinto (mesas + comandas + estado de pedido), UX de cocina, hardware específico (impresoras de comanda, KDS). Existen competidores especializados (Maxirest, Bistrosoft, Fudo). Pandora compitiendo con ellos es perder.

**Trigger para reabrir:** NUNCA en F0/F1/F2. **F3+ requiere:**
1. 100+ comerciantes retail pagando ESTABLES
2. 10+ pedidos formales de clientes retail con segunda boca gastronómica
3. Mercado retail Pandora saturado
4. ADR específico justificando entrada con análisis competitivo

### N-MKT-02 — Industria / manufactura / MRP

**Rechazado.** Sin bill of materials (BOM), órdenes de producción, planificación de capacidad, control de procesos, costeo industrial.

**Por qué:** target F0 es comercio (compra-vende). Manufactura es otro mundo (ERPs como Tango Manufactura, SAP, Bind ERP). Modelo de datos completamente distinto.

**Trigger para reabrir:** NUNCA F0/F1/F2/F3. Si aparece — empresa nueva, no Pandora.

### N-MKT-03 — E-commerce puro

**Rechazado.** Sin carrito web público, checkout online para consumidor final, integración con Mercado Libre / Tiendanube / VTEX como vendor.

**Por qué:** Pandora es POS físico + ERP. E-commerce es producto distinto con UX distinta (catálogo online, SEO, conversion optimization, carrito abandonado). Tiendanube/VTEX/Shopify son competidores que Pandora NO va a ganar.

**Trigger para reabrir:** F2+. **Específicamente:**
1. 50+ clientes pagando ESTABLES
2. 10+ clientes pidieron explícitamente "vender online desde Pandora"
3. ADR justificando entrada con análisis del mercado y trade-offs

**Excepción permitida en F2+:** integración LECTURA de pedidos desde Mercado Libre / Tiendanube para que se vuelquen al inventario Pandora (no construcción de e-commerce propio). Ver CAPABILITY-MAP C-INT-04.

### N-MKT-04 — Software contable completo

**Rechazado.** Pandora **EXPONE datos** al contador. NO hace asientos contables, libros mayores, plan de cuentas configurable, balance de sumas y saldos, conciliación bancaria automática multi-cuenta, IIBB liquidación.

**Por qué:** Tango Contabilidad / Bejerman / ContaBilidad / Holistor existen y son buenos. Hacer "contabilidad completa" requiere certificación del Consejo Profesional, soporte cambios normativos constantes, especialización. Pandora ES el cliente del software contable, NO compite con él.

**Trigger para reabrir:** NUNCA. Si aparece pedido — derivar a software contable específico + integración export.

### N-MKT-05 — Multi-país

**Rechazado.** AR-only F0/F1. Sin localización Chile, Uruguay, México, ni infraestructura para soportar reglas fiscales no-AFIP.

**Por qué:** cada país tiene autoridad fiscal propia (SUNAT, SAT, DGI, etc.), monedas, idioma técnico, partners locales. Cada país es un producto nuevo.

**Trigger para reabrir:** F2+. **Específicamente:**
1. 200+ clientes AR pagando ESTABLES
2. Pedido de 10+ comerciantes con sucursal en otro país específico (uno solo, no genérico)
3. Equipo técnico expandido con experiencia local del país objetivo
4. ADR justificando entrada con stack fiscal local + costos de mantenimiento

---

## CATEGORÍA 2 — Tecnologías que Pandora NO usa

### N-TECH-01 — Microservicios

**Rechazado.** Monolito modular F0/F1/F2 (ADR-0007). Sin servicios separados con APIs internas, sin service mesh, sin Kubernetes.

**Por qué:** 5 clientes no justifican operación de N servicios. Latencia inter-service, complexity de deploy, debugging distribuido — todo costo sin beneficio. Conway's Law: 1-2 devs no producen arquitectura de microservicios funcional.

**Trigger para reabrir:** F3+. Específicamente: 500+ clientes activos + bottleneck identificado por métricas que NO puede resolverse con scaling horizontal del monolito + equipo de 5+ devs.

### N-TECH-02 — Event sourcing como primary store

**Rechazado.** EVENT-TAXONOMY define `audit_log` como append-only y `jobs_queue` como cola de tareas — eso NO es event sourcing. Sin reconstrucción del estado actual desde stream de eventos, sin event store dedicado, sin proyections materializadas.

**Por qué:** complexity altísima sin pay-off en F0/F1. Postgres tradicional + audit_log es la opción correcta para retail.

**Trigger para reabrir:** F3+ si aparece caso real (compliance que exige replay completo del estado, multi-region con conflict resolution, etc.).

### N-TECH-03 — CQRS prematuro

**Rechazado.** Sin separación formal read/write models F0/F1.

**Por qué:** la separación lógica entre Services (writes) y queries Drizzle (reads) ya da el beneficio sin la complexity formal.

**Trigger:** cuando aparezca bottleneck real de lectura en producción que NO se resuelva con índices + caching.

### N-TECH-04 — Kafka / RabbitMQ / Message brokers pesados

**Rechazado.** F0: Cron Vercel. F1+: Railway + BullMQ + Upstash Redis si volumen lo amerita.

**Por qué:** brokers grandes requieren operación. 5 tenants no justifican infraestructura.

**Trigger:** > 50.000 jobs/día sostenidos O necesidad de orden estricto cross-tenant.

### N-TECH-05 — ORMs alternativos a Drizzle

**Rechazado.** NO Prisma, NO TypeORM, NO Knex, NO Sequelize, NO MikroORM.

**Por qué:** Drizzle elegido por type-safety + control sobre queries + sin migration drift. Cambiar de ORM = reescribir capa de persistencia.

**Trigger:** Drizzle abandona soporte / vulnerabilidad crítica sin fix / cambio drástico de licencia.

### N-TECH-06 — Chart libraries (Recharts/D3/Chart.js)

**Rechazado.** Charts SVG propios (ADR-0014).

**Por qué:** bundle size, control total, no dependency lock. Charts custom dan diferencial visual.

**Trigger:** chart con interactividad compleja imposible de implementar SVG puro en tiempo razonable + 3+ requerimientos similares.

### N-TECH-07 — State management global complejo (Redux / MobX)

**Rechazado.** React Server Components + Server Actions + Context para state local cubren F0/F1.

**Por qué:** Server-first arquitectura no necesita store global. Redux/MobX agregan complexity sin beneficio.

**Trigger:** state cliente con > 50 reducers que se acoplan + necesidad de time-travel debugging.

### N-TECH-08 — GraphQL

**Rechazado.** REST + Server Actions cubren F0/F1.

**Por qué:** GraphQL aporta cuando hay múltiples consumers heterogéneos. Pandora tiene 1 frontend.

**Trigger:** F2+ si aparece API pública con N consumers.

### N-TECH-09 — Backend framework separado (Express / Fastify / NestJS)

**Rechazado.** Next.js Server Actions + Route Handlers cubren F0/F1.

**Por qué:** separar backend = 2 deploys, 2 dependency trees, 2 puntos de fallo. Sin justificación.

**Trigger:** necesidad de WebSocket persistente complejo / job processing intensivo que Vercel no soporta.

### N-TECH-10 — NextAuth / Auth0 / Clerk / Firebase Auth

**Rechazado.** Supabase Auth + JWT custom con jose (ADR-0001).

**Por qué:** Supabase Auth ya es parte del stack. Agregar otro auth provider = costo + complexity sin beneficio.

**Trigger:** Supabase Auth abandonado o limitación crítica.

### N-TECH-11 — Plugin system / marketplace

**Rechazado F0/F1/F2.** Sin marketplace de extensiones, sin SDK público para terceros.

**Por qué:** complexity de seguridad altísima (sandbox de plugins, permisos granulares, billing share), sin masa crítica de devs interesados, sin clientes esperándolo.

**Trigger:** F3+ con 500+ clientes + 10+ requests formales de devs externos pidiendo build plugins.

### N-TECH-12 — Mobile apps nativas (iOS/Android)

**Rechazado F0/F1.** POS web responsive + PWA cubre tablet/móvil F0.

**Por qué:** 2 codebases nuevas, App Store/Play Store review, mantenimiento, distribución.

**Trigger:** F2+ si métricas muestran > 30% uso mobile + limitación clara de PWA en hardware target.

### N-TECH-13 — Blockchain / Crypto / NFT

**Rechazado PARA SIEMPRE.** Sin pagos crypto, sin invoicing blockchain, sin smart contracts.

**Por qué:** No aporta valor a retail TDF. Volatilidad. Regulación incierta. Costo de implementación + mantenimiento sin pay-off.

**Trigger para reabrir:** ninguno previsible. Si aparece — empresa nueva, no Pandora.

### N-TECH-14 — Warehouse robotics / IoT integration

**Rechazado.** Sin integración con robots de depósito, sensores RFID inventario, scanner industrial.

**Por qué:** target retail TDF NO tiene depósito automatizado. Kiosco/ferretería compra a mano.

**Trigger:** F3+ si aparece cliente mayorista grande con depósito automatizado pidiéndolo explícito + business case.

### N-TECH-15 — AI Copilot / LLM integrado en producto

**Rechazado F0/F1.** Sin asistente AI dentro del producto (chatbot para clientes, sugerencias de productos, etc.).

**Por qué:** Costo recurrente (tokens), latencia variable, output no determinístico en path crítico. Pandora ES un sistema fiscal — output determinístico es invariante.

**Trigger:** F2+ para features NO críticas (sugerencias de catálogo, ayuda contextual al cajero, etc.). NUNCA en path fiscal/money/multi-tenant.

---

## CATEGORÍA 3 — Funcionalidades de producto NO incluidas

### N-FEAT-01 — Payroll / sueldos

**Rechazado PARA SIEMPRE.** Pandora NO gestiona sueldos, recibos de haberes, aportes, AFIP empleadores.

**Por qué:** módulo legal específico AR (Ley de Contrato de Trabajo, sindicatos, cargas sociales). Existen Bejerman Sueldos, Calipso, Buk. Mantenimiento normativo constante.

**Trigger:** NUNCA. Derivar a software específico.

### N-FEAT-02 — CRM completo

**Rechazado F0/F1.** Sin pipeline de oportunidades, segmentación marketing, email campaigns, sales analytics CRM.

**Por qué:** retail no opera con pipeline de ventas (es punto de venta). Customer básico (datos AFIP + histórico compras) alcanza.

**Trigger:** F2+ con métrica de uso de "histórico cliente" + pedidos específicos de campañas email/SMS al cliente final.

### N-FEAT-03 — Marketing automation

**Rechazado.** Sin envío de campañas masivas, sin journey builder, sin A/B testing campaigns.

**Por qué:** ámbito de Mailchimp, HubSpot, ActiveCampaign. Pandora puede EXPORTAR lista de clientes a esas herramientas.

**Trigger:** NUNCA propio. Eventualmente integración export a herramientas third-party (F2+).

### N-FEAT-04 — Reportes BI avanzados

**Rechazado F0/F1.** Sin dashboards customizables, sin drill-down complejo, sin cross-tab pivoting, sin export a Tableau / PowerBI nativo.

**Por qué:** F0 da reportes operativos básicos (ventas día/mes, IVA, stock bajo). BI avanzado es ámbito de herramientas dedicadas.

**Trigger:** F2+ con métrica de uso de reportes básicos > X + pedido formal de N clientes.

### N-FEAT-05 — Multi-warehouse / depósitos múltiples

**Rechazado F0.** Un punto de stock por tenant.

**Por qué:** kiosco/ferretería retail TDF típica tiene 1 local. Complexity multi-warehouse no justificada.

**Trigger:** F1 con 5+ clientes pidiendo segunda boca o depósito separado.

### N-FEAT-06 — Multi-currency

**Rechazado F0.** ARS-only hardcoded.

**Por qué:** target AR. Complexity de tasa de cambio, fluctuación, contabilización en USD.

**Trigger:** F2+ con cliente B2B exportador real + use case justificado.

### N-FEAT-07 — Reservas / appointment booking

**Rechazado.** Sin sistema de turnos, citas, reservas online.

**Por qué:** ámbito de servicios (peluquería, médico, etc.), no retail. Existen Calendly, Booksy.

**Trigger:** NUNCA. Mercado distinto.

### N-FEAT-08 — Loyalty program / puntos / membresías

**Rechazado F0/F1.** Sin sistema de puntos, sin tarjetas de fidelización, sin niveles cliente.

**Por qué:** complexity significativa (estados de cliente, expiración puntos, canjes). Retail chico generalmente no lo usa.

**Trigger:** F2+ con 10+ clientes pidiendo + business case del propio comerciante con su contador.

### N-FEAT-09 — Subscription billing (clientes finales)

**Rechazado.** Sin facturación recurrente automática a clientes finales del comerciante.

**Por qué:** Pandora ES facturación recurrente del SaaS al comerciante. Pero NO emite recurrentes en nombre del comerciante a sus clientes finales.

**Trigger:** F2+ con caso real (gimnasio, escuela) + análisis vs ya existentes.

### N-FEAT-10 — Comercio electrónico B2B / EDI

**Rechazado.** Sin EDI (Electronic Data Interchange) con proveedores B2B grandes.

**Por qué:** ámbito enterprise. Target retail chico NO opera EDI.

**Trigger:** NUNCA en F0-F2. F3+ si aparece.

### N-FEAT-11 — Modo offline real

**Rechazado F0/F1.** Sin queue local de ventas offline que sincronice después.

**Por qué:** complexity altísima (conflict resolution stock + numeración + AFIP), riesgo fiscal real. **Fake offline mode es peor que no offline** (anti-pattern §20.19 CLAUDE.md).

**Trigger:** F2+ con investigación profunda + análisis de competidores + business case real.

### N-FEAT-12 — Multi-language (UI)

**Rechazado F0/F1.** Español rioplatense hardcoded.

**Por qué:** target AR. i18n agrega complexity sin beneficio.

**Trigger:** N-MKT-05 (multi-país) reabre primero → entonces i18n viene de la mano.

### N-FEAT-13 — White-label / multi-brand

**Rechazado.** Pandora es Pandora. Sin opción de re-branding para que terceros vendan como propio.

**Por qué:** modelo de negocio distinto (reseller program). Sin equipo para soportarlo.

**Trigger:** F3+ con análisis de modelo de negocio.

### N-FEAT-14 — Asistente AI integrado al cajero

**Rechazado F0/F1.** Sin "asistente" que sugiera al cajero "este producto se vende mucho ahora", "el cliente X suele comprar Y", etc.

**Por qué:** complexity, latencia, output no determinístico. POS necesita velocidad y certeza.

**Trigger:** F2+ con métrica de uso + análisis vs costo tokens.

### N-FEAT-15 — Marketplace de comerciantes

**Rechazado.** Sin sección donde un comerciante vea/compre a otros comerciantes Pandora.

**Por qué:** modelo de negocio distinto. Sin masa crítica.

**Trigger:** F3+ si emerge naturalmente.

### N-FEAT-16 — Chatbot conversacional que ejecuta operaciones

**Rechazado** (formalizado 2026-06-03 post 14-point strategic review).

Sin chatbot/asistente conversacional al que se le pueda decir "emití factura A a Juan por 12.000" y emita. Sin "WhatsApp bot" que ejecute operaciones por mensaje. Sin LLM que responda comandos productivos.

**Por qué:**
- **Conflicto absoluto con ADR-0024 (IA Boundary Policy):** áreas BLINDADAS incluyen emisión AFIP, transiciones fiscal_status, decisiones de tipo de comprobante. Un chatbot ejecutor las violaría.
- **Auditabilidad imposible:** disputa "el chatbot interpretó mal" no es defensa legal válida ante AFIP.
- **Latencia + determinismo:** LLM agrega latencia variable + no-determinismo a path crítico que necesita certeza.
- **No reemplaza UI:** un click confirmatorio en UI es contractualmente más fuerte que "le escribí al bot".

**Diferencia con N-FEAT-14 (Asistente AI cajero):** N-FEAT-14 cubre sugerencias inline al cajero. N-FEAT-16 cubre el patrón conversacional ejecutor distinto (chat = comando).

**Trigger:** NUNCA en F0-F3 mientras ADR-0024 esté vigente. Si alguna vez se reabre, requiere reemplazar ADR-0024 con argumentación explícita.

### N-FEAT-17 — Helpdesk / ticketing al cliente final

**Rechazado.** Sin sistema de tickets / soporte que el comerciante use para atender consultas de SUS clientes finales (post-venta, garantías, devoluciones gestionadas via tickets).

**Por qué:**
- Ámbito distinto al POS+ERP fiscal. Existen Zendesk, Freshdesk, Intercom.
- Target retail TDF no tiene volumen de tickets que justifique un módulo dedicado (WhatsApp directo + cuaderno alcanzan F0).
- Devoluciones SÍ se gestionan en Pandora pero como flow operativo (Sale + Nota de Crédito F1+), no como ticket.

**Trigger:** F3+ con 50+ clientes ESTABLES + 5+ pidiendo + business case.

### N-FEAT-18 — Calendar / scheduling de turnos profesionales

**Rechazado** (refuerzo de N-FEAT-07 con scope ampliado).

Sin sistema de agenda donde un profesional (peluquero, médico, mecánico) saque turnos online o gestione disponibilidad. Sin recordatorios automáticos de cita. Sin overbooking detection.

**Por qué:** N-FEAT-07 ya rechaza reservas. Este NON-GOAL refuerza para gestión de calendario profesional. Existen Calendly, Booksy, Cal.com — modelo de negocio distinto.

**Diferencia con N-FEAT-07:** N-FEAT-07 es booking público desde el lado del cliente. N-FEAT-18 cubre la **vista interna del profesional** (su calendario, su disponibilidad). Ambos rechazados.

**Trigger:** NUNCA en F0-F3. Mercado distinto.

### N-FEAT-19 — HR / RRHH expandido (más allá de payroll)

**Rechazado** (refuerzo de N-FEAT-01 con scope ampliado).

Sin directorio de empleados con perfiles enriquecidos, sin performance reviews, sin gestión de licencias/vacaciones, sin fichaje biométrico, sin organigrama, sin onboarding de empleados.

**Por qué:**
- N-FEAT-01 ya rechaza payroll/sueldos (liquidación formal). N-FEAT-19 amplía a TODO el dominio HR moderno.
- Target retail TDF tiene 1-3 empleados típicamente — no necesita HRIS.
- Lo único que Pandora SÍ ofrece: registro de `actor_user_id` en audit (quién vendió qué) — eso es auditoría operativa, NO HR.

**Diferencia con N-FEAT-01:** N-FEAT-01 = liquidación formal (recibos AFIP). N-FEAT-19 = todo el resto del dominio HR (people management). Ambos rechazados.

**Trigger:** NUNCA en F0-F3. Existen Buk, Runa, Bambee, Personio — mercado especializado.

### N-FEAT-20 — Project management / gestión de tareas

**Rechazado** (formalizado 2026-06-03 post 14-point review).

Sin tableros kanban tipo Trello, sin gestión de tareas con dependencias, sin gantt charts, sin sprints / backlog management dentro de Pandora.

**Por qué:**
- Dominio completamente fuera del POS+ERP fiscal.
- Existen Asana, Trello, Jira, Linear, Notion — mercado maduro.
- Si comerciante usa kanban, lo hace en herramienta dedicada externa.

**Trigger:** NUNCA. Mercado distinto.

---

## CATEGORÍA 4 — Prácticas de desarrollo NO permitidas

### N-DEV-01 — Lógica de negocio en plpgsql / triggers

**Rechazado.** ADR-0003: Services TS, no plpgsql.

**Excepción permitida:** triggers de inmutabilidad (audit_log), triggers updated_at, funciones simples de constraint.

**Trigger para reabrir:** caso muy específico donde plpgsql aporta beneficio claro + ADR justificando.

### N-DEV-02 — Mocking masivo en tests

**Rechazado.** Tests con DB real (test DB). Mocks SOLO en boundary externo (AFIP, MP).

**Por qué:** tests que mockean todo NO prueban nada real.

### N-DEV-03 — `console.log` en código productivo

**Rechazado.** Solo Pino (ver §10 CLAUDE.md).

### N-DEV-04 — Floating point para money

**Rechazado.** Solo Decimal.js. Ver §9 CLAUDE.md + ADR-0005.

### N-DEV-05 — TypeScript `any`

**Rechazado.** `strict: true` + `noUncheckedIndexedAccess: true`. `any` solo con `// @ts-expect-error` comentando razón.

### N-DEV-06 — Migrations directas en prod

**Rechazado.** Drizzle Kit + review obligatorio.

### N-DEV-07 — Commits a main sin PR

**Rechazado.** Branch protection + PR obligatorio.

### N-DEV-08 — Secretos en código

**Rechazado.** Env vars + Zod fail-fast + vault para secretos por tenant. Linter rule para detectar.

### N-DEV-09 — Skip de hooks pre-commit

**Rechazado.** `--no-verify` prohibido excepto con justificación documentada.

### N-DEV-10 — Optimization prematuro

**Rechazado.** Profile primero, optimize después. Premature optimization es anti-pattern.

---

## CATEGORÍA 5 — Decisiones de negocio NO consideradas

### N-BIZ-01 — Pricing dinámico por cliente

**Rechazado F0/F1.** Pricing por planes (Kiosco / Ferretería / Mercería) hardcoded.

**Trigger:** F2+ con N clientes solicitando customización.

### N-BIZ-02 — Onboarding self-service completo

**Rechazado F0.** Onboarding asistido (Pandora team configura cuenta nueva con comerciante).

**Por qué:** F0 son 5 clientes piloto TDF — viable asistido. Self-service requiere onboarding wizard maduro.

**Trigger:** F1+ con 30+ clientes y métricas que justifiquen automatización.

### N-BIZ-03 — Free tier

**Rechazado.** Free trial 60 días + paywall (ADR-0020). NO plan gratuito permanente.

**Por qué:** retail TDF es B2B real. Free tier indefinido = clientes que no pagan + soporte costoso.

**Trigger:** NUNCA salvo cambio drástico de modelo de negocio.

### N-BIZ-04 — Modelo freemium

**Rechazado.** Sin "plan gratis con limitaciones".

**Por qué:** complexity de feature gating + clientes en gratuito que generan soporte.

**Trigger:** NUNCA en F0-F2.

### N-BIZ-05 — Reseller program

**Rechazado F0/F1.** Sin program de revendedores.

**Trigger:** F2+ con análisis de modelo.

### N-BIZ-06 — Reverse marketplace (Pandora vende productos del comerciante a otros comerciantes)

**Rechazado.** Pandora NO es marketplace.

**Trigger:** NUNCA.

---

## CATEGORÍA 6 — Compliance / regulación NO target

### N-COMP-01 — PCI-DSS Level 1

**Rechazado F0/F1.** Pandora NO almacena tarjetas crediticias. MercadoPago maneja PCI compliance.

**Por qué:** evitar PCI scope = procesador tercero (MP) maneja datos sensibles. Pandora solo guarda last4 + token MP.

**Trigger:** NUNCA almacenar PAN/CVV. Si aparece pedido — derivar a MP/procesador.

### N-COMP-02 — HIPAA / health regulations

**Rechazado.** Sin datos de salud.

**Por qué:** mercado distinto (farmacia, clínicas tienen regulación específica).

**Trigger:** NUNCA en F0-F2.

### N-COMP-03 — SOX / regulación financiera enterprise

**Rechazado F0/F1.** Sin compliance SOX, sin auditorías financieras tipo Big Four.

**Por qué:** target retail chico no requiere. Costo desproporcionado.

**Trigger:** F2+ si cliente enterprise lo exige.

### N-COMP-04 — GDPR (target europeo)

**Rechazado F0/F1.** Compliance con Ley 25.326 AR (Habeas Data) + AAIP. GDPR aplica si Pandora opera en UE — no es el caso.

**Trigger:** N-MKT-05 (multi-país) reabre.

### N-COMP-05 — Auditoría ISO 27001

**Rechazado F0/F1.** Sin certificación ISO en F0/F1.

**Por qué:** costo + tiempo + complexity. Target retail TDF no lo exige.

**Trigger:** F2+ si cliente enterprise lo exige como condición.

---

## REGLA DE ORO

Si una propuesta cumple TODAS estas condiciones, considerar reabrir:

1. **Aparece referenciada en al menos 1 categoría arriba** con trigger explícito.
2. **El trigger objetivo se cumplió completamente.** No "casi" ni "se está acercando".
3. **Hay cliente real pagando que lo pide formalmente** (correo / video / contrato).
4. **Hay business case escrito** que justifica costo de implementación + mantenimiento.
5. **ADR específico se crea** documentando la decisión + plan + métrica de éxito.

Si la propuesta NO cumple las 5: **archivar en [over-engineering rejected memory] y seguir.**

---

## Decisión tomada al crear este doc

**Pandora ERP es:**
- Un POS+ERP fiscal AR
- Target inicial: retail pequeño TDF (kioscos, ferreterías, mercerías)
- Vertical específico, NO horizontal genérico
- Calidad ALTA en su nicho > calidad media en N nichos

**Pandora ERP NO es:**
- Un ERP universal
- Un competidor de SAP / Oracle / Odoo
- Un marketplace
- Un sistema gastronómico, médico, manufacturero
- Una plataforma blockchain
- Multi-país temprano
- Software contable completo

**Si esto se mantiene:** Pandora puede ganar a competidores especializados EN SU NICHO TDF retail.

**Si esto se diluye:** Pandora se vuelve indefendible vs competidores en CADA nicho que intente atender.

---

## Mantenimiento

- **Revisar trimestralmente** vs propuestas acumuladas en [over-engineering rejected memory].
- **Si una categoría se reabre formalmente:** mover de NON-GOALS a backlog con trigger explícito.
- **Si aparece categoría nueva** que debería rechazarse: agregar acá.
- **No editar para "ablandar":** el doc es agresivo a propósito.

---

## Cross-references

- [CLAUDE.md §4.2](CLAUDE.md) — "Lo que Pandora NUNCA será" (constitución)
- [CLAUDE.md §5.3](CLAUDE.md) — "Qué QUEDA DIFERIDO"
- [CLAUDE.md §21.3](CLAUDE.md) — "Qué NO debe implementarse ahora"
- [backlog-validaciones.md](backlog-validaciones.md) — items DIFERIDOS (van a ser hechos)
- [DECISION-LEDGER.md](DECISION-LEDGER.md) — autoridad si hay conflicto
- Memoria `over-engineering-rejected.md` — 15 propuestas previas rechazadas con triggers
- [CAPABILITY-MAP.md](CAPABILITY-MAP.md) — capabilities deferred con triggers explícitos
- [BOUNDED-CONTEXTS.md](BOUNDED-CONTEXTS.md) — estructura del código que refleja estos límites

---

*NON-GOALS.md v1.0.0 — 2026-05-28. Mantener AGRESIVO. La agresividad es la única defensa contra scope explosion.*
