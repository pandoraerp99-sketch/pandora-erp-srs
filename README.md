# Pandora ERP — SRS v3.0
## Paquete de documentación técnica definitiva

**Fecha de release:** 18 mayo 2026
**Estado:** Aprobado para implementación
**Autor:** Owner técnico (Pandora ERP)

---

## Qué hay en este paquete

```
pandora-srs-v3/
├── README.md                       ← este archivo
├── PANDORA_ERP_SRS_v3.0.md         ← documento maestro (162 KB, 4.477 líneas)
└── adr/                            ← 17 Architecture Decision Records
    ├── ADR-0001-stack-tecnologico-fase-0.md
    ├── ADR-0002-multi-tenant-rls-jwt.md
    ├── ADR-0003-typescript-services-no-plpgsql.md
    ├── ADR-0004-afip-sincronico.md
    ├── ADR-0005-money-numeric-19-4.md
    ├── ADR-0006-numeracion-fiscal-select-for-update.md
    ├── ADR-0007-monolito-modular.md
    ├── ADR-0008-contador-multi-empresa-jwt.md
    ├── ADR-0009-feature-flags-tenant.md
    ├── ADR-0010-idempotency-obligatoria.md
    ├── ADR-0011-retry-serializable.md
    ├── ADR-0012-sistema-3-atmospheres.md
    ├── ADR-0013-glass-system-degradacion.md
    ├── ADR-0014-charts-svg-puro.md
    ├── ADR-0015-motion-presets-nombrados.md
    ├── ADR-0016-dawn-sky-identidad-permanente.md
    └── ADR-0017-density-obligatoria-atmosphere.md
```

## Cómo está organizado este paquete

Este SRS v3.0 es **el resultado final** de un proceso iterativo de 8 sesiones de trabajo que cubrieron:

- **Sesión 1:** 10 fixes quirúrgicos al SRS base v2.0-OMN + Sección 14 UX Operacional completa
- **Sesión 2:** Sección 13 Observabilidad operativa + 9 máquinas de estado faltantes
- **Sesión 3:** 8 ambigüedades estructurales resueltas + 11 ADRs técnicos + Sección 4 Dominios expandida
- **Sesión 3.5:** 10 correcciones de auditoría externa (primera pasada)
- **Sesión 3.5.2:** 4 refinements de auditoría (segunda pasada)
- **Sesión 3.7:** Sistema visual completo con 3 atmospheres + 6 ADRs visuales
- **Sesión 4 (este paquete):** Integración unificada

Todo el contenido de las sesiones intermedias está incorporado en el documento maestro. **Las sesiones intermedias no necesitan leerse.**

## Cómo leer este paquete

### Si sos vos (owner técnico) leyendo por primera vez

**Tiempo estimado:** 2-3 horas para lectura comprensiva.

**Orden recomendado:**

1. **README** (este archivo, 10 min) — entendé qué hay.
2. **SRS principal sección 1-2** (15 min) — visión, alcance, stack.
3. **SRS principal sección 19** (10 min) — Decisiones de NO hacer. Esto define el producto tanto como las decisiones de SÍ hacer.
4. **Validaciones humanas pendientes** (Apéndice D del SRS, 10 min) — qué necesitás resolver antes de tipear código productivo.
5. **SRS principal sección 4** (20 min) — Dominios + mapa de dependencias. Es la guía para no acoplar mal el código.
6. **SRS principal secciones 5-12** (45 min) — dominios técnicos.
7. **SRS principal secciones 13-15** (45 min) — observabilidad + UX operacional + visual system.
8. **SRS principal sección 16** (15 min) — máquinas de estado (referencia, no memorizar).
9. **SRS principal secciones 17-18** (15 min) — riesgos + roadmap.
10. **17 ADRs** (5-10 min cada uno) — leer los que te resulten más críticos para tu situación.

### Si sos un dev que se suma al equipo más adelante

**Tiempo estimado:** 4-6 horas para onboarding completo.

**Orden recomendado:**

1. **README** + **SRS sección 1-2** + **SRS sección 19** (30 min).
2. **CLAUDE.md** del repo (no en este paquete, en el repo) — guía operativa día a día.
3. **17 ADRs** completos en orden numérico (1.5-2 horas).
4. **SRS principal completo** (3 horas).

### Si sos un auditor externo / consultor / asesor

**Tiempo estimado:** 1-2 horas.

**Orden recomendado:**

1. **README**.
2. **SRS sección 1** (visión).
3. **17 ADRs** (decisiones críticas).
4. **SRS sección 17** (riesgos).
5. **Apéndice D** (validaciones pendientes).

### Si sos contador advisor

**Foco específico:** validar implicancias fiscales y contables.

**Leer obligatorio:**

1. **README**.
2. **SRS sección 11** (Fiscal AFIP/ARCA) — todo.
3. **SRS sección 7.3-7.5** (Customers — Padrón, snapshot, cambio condición IVA).
4. **SRS sección 9.6-9.7** (Sales y anulación).
5. **SRS sección 13.10-13.11** (Audit log + retención).
6. **ADR-0004** (AFIP sincrónico).
7. **ADR-0005** (Money numeric).
8. **ADR-0006** (Numeración fiscal).
9. **Apéndice D.1** (validaciones con contador).

**Preguntas concretas a responder** (con detalle en Apéndice D.1):

1. ¿Es legalmente válido "ticket no fiscal" tras 2h de reconciliation_timeout?
2. ¿Retención XML AFIP 10 años cumple Ley 11.683?
3. ¿Política de redondeo half-up para presentación AFIP es correcta?
4. ¿Cálculo de IVA debe ser por línea o por total?
5. ¿Customer snapshot inmutable es válido fiscalmente?
6. ¿Cambio de condición IVA del comerciante requiere notificación a AFIP?

### Si sos abogado

**Foco específico:** compliance legal y privacidad.

**Leer obligatorio:**

1. **README**.
2. **SRS sección 13.10-13.11** (Audit log + retención).
3. **SRS sección 6** (Identity y autorización).
4. **SRS sección 5.6** (Protección anti-cross-tenant).
5. **Apéndice D.1** (validaciones con abogado).

**Preguntas concretas a responder:**

1. ¿Audit log con cierre estricto cumple Ley 11.683?
2. ¿Compliance Ley 25.326 sobre datos personales?
3. ¿Inscripción AAIP obligatoria para Pandora como responsable de base de datos?
4. ¿Modelo de DPAs (Data Processing Agreements) con clientes?
5. ¿Política de delete company con delay 7 días defendible?
6. ¿Exports de datos personales cumple derecho al olvido?

## Validaciones humanas pendientes — RESUMEN CRÍTICO

**No tipear código de producción sin resolver esto:**

### Con contador advisor (1 sesión one-shot, ~$30-50k ARS)

- [ ] Política de "venta sin factura tras 2h" validada
- [ ] Retención XML AFIP 10 años
- [ ] Motivos obligatorios fiscales
- [ ] Redondeo exacto que AFIP espera
- [ ] Customer snapshot: campos obligatorios por tipo
- [ ] Revalidación CUIT en hot path
- [ ] Cambio condición IVA del tenant: ¿requiere comunicar AFIP?

### Con abogado (1 sesión one-shot)

- [ ] Audit log con cierre estricto cumple Ley 11.683
- [ ] Privacidad de exports
- [ ] Compliance Ley 25.326
- [ ] T&C con limitación de responsabilidad
- [ ] Inscripción AAIP obligatoria
- [ ] DPAs modelo

### Con clientes reales (primeros 5)

- [ ] Pricing $25k/$60k ARS validado
- [ ] UX operacional POS validada
- [ ] Timeline suspensión por impago aceptable
- [ ] Sonido/notificaciones en local
- [ ] Modo demo extensión + bloqueo aceptable
- [ ] Cierre forzado smart detection funciona
- [ ] Target táctil mínimo en tablets reales

**Mi recomendación honesta:** estas validaciones cuestan **menos de $100k ARS totales** y te evitan **bugs/refactors/multas** que pueden costar 10-100x más.

## Próximos pasos operativos

### Inmediatos (esta semana)

1. Revisar el SRS v3.0 completo (2-3 horas de lectura).
2. Marcar cualquier sección que no encaje con tu visión.
3. Conseguir contacto de contador advisor (consulta one-shot).
4. Conseguir contacto de abogado (consulta one-shot).
5. Configurar repo siguiendo CLAUDE.md (no en este paquete).

### Próximas 2 semanas

1. Sprint visual de 3 días (tokens + AtmosphereProvider + primitives + charts).
2. Setup completo del repo + Supabase + Vercel.
3. Primera pantalla: POS (operational atmosphere).

### Próximas 4-6 semanas

1. POS funcional con AFIP en homologación.
2. Onboarding wizard 3 pasos.
3. Dashboard básico.

### Antes de primer cliente real

1. Validaciones con contador y abogado completadas.
2. Pricing validado con 3-5 comerciantes.
3. Tests sintéticos en producción funcionando.
4. Backup + DR probados.
5. Documentación operativa lista.

## Estado de los ADRs

| ADR | Título | Estado | Validación |
|---|---|---|---|
| ADR-0001 | Stack tecnológico Fase 0 | Aprobado | 🟢 |
| ADR-0002 | Multi-tenant con RLS + auth.jwt() | Aprobado | 🟢 |
| ADR-0003 | TypeScript services, no plpgsql | Aprobado | 🟢 |
| ADR-0004 | AFIP sincrónico en hot path | Aprobado | 🟡 contador |
| ADR-0005 | Money numeric(19,4) | Aprobado | 🟡 contador |
| ADR-0006 | Numeración fiscal SELECT FOR UPDATE | Aprobado | 🟢 |
| ADR-0007 | Monolito modular | Aprobado | 🟢 |
| ADR-0008 | Contador multi-empresa JWT | Aprobado | 🟢 |
| ADR-0009 | Feature flags por tenant | Aprobado | 🟢 |
| ADR-0010 | Idempotencia obligatoria | Aprobado | 🟢 |
| ADR-0011 | Retry serializable con backoff | Aprobado | 🟢 |
| ADR-0012 | Sistema 3 atmospheres | Aprobado | 🟢 |
| ADR-0013 | Glass system con degradación | Aprobado | 🟢 |
| ADR-0014 | Charts SVG puro | Aprobado | 🟢 |
| ADR-0015 | Motion presets nombrados | Aprobado | 🟢 |
| ADR-0016 | Dawn Sky identidad permanente | Aprobado | 🟢 |
| ADR-0017 | Density por atmosphere | Aprobado | 🟢 |

## Métricas del paquete

| Métrica | Valor |
|---|---|
| Líneas SRS principal | 4.477 |
| KB SRS principal | 162 |
| ADRs | 17 archivos |
| Líneas totales ADRs | ~1.500 |
| KB totales ADRs | ~50 |
| Validaciones humanas pendientes (críticas) | 22 |
| Decisiones de NO hacer documentadas | 30+ |
| Máquinas de estado formales | 12 |
| Dominios definidos | 13 (más 6 F1+) |
| Pantallas mapeadas por atmosphere | 30+ |

## Filosofía del paquete

Este SRS es **defendible**: cada decisión tiene contexto, alternativas evaluadas, consecuencias, riesgos a monitorear, y triggers de re-evaluación.

Este SRS es **honesto**: lo que requiere validación humana está marcado AMARILLO, no como decisión cerrada. Las metas comerciales aspiracionales no se venden como certezas.

Este SRS es **operable**: las máquinas de estado, los SLOs, los thresholds de alertas son concretos y medibles, no abstracciones.

Este SRS es **mantenible**: las decisiones tienen sus razones registradas, por lo que dentro de 6 meses cuando alguien (vos mismo) las cuestione, hay respuesta.

**El SRS no reemplaza el producto.** El SRS es el mapa, el producto es el territorio. **Lo que sigue es código.**

## Una nota final

Si llegaste hasta acá leyendo este README completo, gracias. Este paquete es el resultado de iteración real, no de copy-paste de templates.

Tres recomendaciones para terminar:

1. **No agregues una "Sesión 5".** El SRS está completo. Cada iteración adicional reduce el ROI por más rigor. Lo siguiente que necesita Pandora es código, no más documentación.

2. **Conseguí el contador y el abogado antes de tipear.** Las consultas one-shot cuestan menos que un día de tu tiempo y te evitan reescribir código por interpretaciones legales/fiscales incorrectas.

3. **Volvé al SRS cuando dudes, no cuando estés seguro.** Si estás seguro de algo y el SRS dice otra cosa, **el SRS gana** — porque vos cuando lo escribiste pensabas más a fondo que vos cuando estás cansado a las 23:00 tipeando código. Si dudás, leé el ADR correspondiente; ahí está el razonamiento.

---

**Pandora ERP — SRS v3.0**
**Documento producido entre el 15 y 18 de mayo de 2026**
**Estado: cerrado para iteración. Listo para código.**
