# Verificación rigurosa de la guía "Módulo contable SaaS Argentina"

> Verificado 2026-06-22 contra fuentes oficiales (Infoleg, ARCA/AFIP, CPCECABA). Regla del proyecto: NO afirmar leyes/RG/specs de memoria. Cada claim con veredicto + fuente + fecha.

## Veredicto general
La guía es **mayormente correcta y muy bien orientada** legalmente, PERO tiene **1 error técnico concreto** (códigos de alícuota de IVA) y **1 imprecisión** (servicio de Padrón). Lo más valioso: el **modelo legal que propone YA es el principio de Pandora** (CLAUDE.md §4.2: "Pandora EXPONE datos al contador, NO hace contabilidad").

## Claim por claim

| # | Claim de la guía | Veredicto | Fuente oficial |
|---|---|---|---|
| 1 | **Ley 20.488** regula ciencias económicas y reserva actos al CPN (firma/certificación de estados contables, etc.) | ✅ **VERIFICADO** | [Infoleg Ley 20.488](https://servicios.infoleg.gob.ar/infolegInternet/anexos/35000-39999/38590/norma.htm) · [CPCECABA](https://archivo.consejo.org.ar/elconsejo/incumbencias.htm) |
| 2 | **Caso Lannis**: CPCECABA intimó (oct 2025, 48h) por "asesoramiento y liquidación impositiva sin CPN" invocando Ley 20.488; Sturzenegger cruzó al Consejo | ✅ **VERIFICADO** (real) | [CPCECABA — Intimamos a Lannis](https://www.consejo.org.ar/noticias/2025/intimamos-a-la-plataforma-lannis-a-cesar-sus-actividades-profesionales) · [La Nación](https://www.lanacion.com.ar/economia/negocios/rebelion-de-los-contadores-contra-la-ia-una-app-argentina-genero-un-conflicto-en-la-disciplina-nid17102025/) · [El Economista](https://eleconomista.com.ar/economia/tras-episodio-lannis-contadores-portenos-defienden-criticas-dan-su-postura-sobre-uso-ia-n90064) |
| 3 | Modelo legal "software genera borrador → contador revisa/firma/presenta" (= Tango/Bejerman/ONVIO) | ✅ **CORRECTO** (coherente con Ley 20.488) | Deriva de #1 |
| 4 | **Libro IVA Digital** obligatorio para RI desde 2025 (RG 4597 derogó el CITI/RG 3685) | ✅ **VERIFICADO** (research previo) | [RG 4597 — Especificaciones](https://www.afip.gob.ar/iva/documentos/Libro-IVA-Digital-Especificaciones.pdf) |
| 5 | Endpoints WSFEv1: prod `servicios1.afip.gov.ar/wsfev1`, homo `wswhomo.afip.gov.ar/wsfev1` | ✅ **VERIFICADO** | [Manual WSFEv1](https://www.afip.gob.ar/fe/ayuda/documentos/wsfev1-COMPG.pdf) |
| 6 | **Códigos alícuota IVA: "AlicId 3=10.5%, 5=21%, 4=27%"** | 🔴 **INCORRECTO** | Ver corrección ↓ |
| 7 | Validar CUIT con **"Padrón A4 / WS_SR_PADRON_A4"** | ⚠️ **IMPRECISO** | Ver corrección ↓ |
| 8 | CbteTipo: 1=Factura A, 6=Factura B (y 11=C) | ✅ **CORRECTO** | Manual WSFEv1 |
| 9 | CAE vence ~10 días; CAEA reservado a contingencia desde jun 2026 | ✅ CAE 10 días (verif. previa) · ❓ **CAEA jun-2026 a verificar RG exacta** (proyecto tiene research RG 5782/5785/5852) | [Manual WSFEv1] · pendiente confirmar RG |
| 10 | IVA discriminado obligatorio (21/10,5/27/no gravado/exento) desde abril 2025 | ✅ **VERIFICADO** (Transparencia Fiscal Ley 27.743, research previo) | proyecto §8.6 |

## 🔴 Corrección 6 — Códigos de alícuota de IVA (WSFEv1)

La guía dice `3=10.5%, 5=21%, 4=27%`. **Está mal.** Tabla oficial (Libro IVA Digital — Tablas del Sistema):

| Código | Alícuota |
|---|---|
| 0003 | **0,00%** (NO 10,5%) |
| 0004 | **10,50%** (NO 27%) |
| 0005 | 21,00% ✅ (lo único correcto) |
| 0006 | **27,00%** (NO código 4) |
| 0008 | 5,00% |
| 0009 | 2,50% |

Fuente: [AFIP — Libro IVA Digital, Tablas del Sistema](https://www.afip.gob.ar/iva/documentos/Libro-IVA-Digital-Tablas-del-Sistema.pdf). **Coincide exactamente con lo que ya tiene Pandora** (CLAUDE.md / ADR-0023). Si seguíamos la guía al pie, facturábamos con alícuotas equivocadas → CAE rechazado o factura mal emitida. **Por esto se valida contra fuente oficial.**

## ⚠️ Corrección 7 — Servicio de Padrón

La guía dice "Padrón A4". El servicio **vigente** para la constancia de inscripción es **`ws_sr_constancia_inscripcion`** (ex *Alcance 5 / ws_sr_padron_a5*, hoy deprecado→reemplazado). El *Alcance 4* es otro (datos de situación tributaria), no el estándar para validar CUIT/condición. Pandora venía usando A5 → migrar a `ws_sr_constancia_inscripcion`. Fuente: [ARCA — Manual ws_sr_constancia_inscripcion](https://www.afip.gov.ar/ws/WSCI/manual_ws_sr_ws_constancia_inscripcion_v3.7.pdf) · [Catálogo WS ARCA](https://www.afip.gob.ar/ws/documentacion/catalogo.asp).

## Lo más importante (estratégico)
El **modelo de 3 actores** (comercio carga → SaaS organiza/calcula borrador → CPN revisa/firma/presenta) NO es solo legal: **es protección activa** post-Lannis. Pandora debe **posicionarse explícitamente como herramienta para el contador, no su reemplazo**, y nunca decir "presentamos/liquidamos tus impuestos". Esto refuerza el principio que ya está en CLAUDE.md §4.2 y amerita: (a) decisión formal en DECISION-LEDGER/ADR, (b) cláusula en T&C ("no constituye asesoramiento profesional; revisar con CPN matriculado"), (c) acercamiento al CPCE TDF.
