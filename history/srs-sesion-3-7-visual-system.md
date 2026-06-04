# PANDORA ERP — SRS Sesión 3.7
## Visual System: atmospheres, arquitectura técnica y ADRs visuales

**Fecha:** 17 mayo 2026
**Base:** Sesiones 1, 2, 3, 3.5, 3.5.2 + prototipo JSX "Pandora Dashboard v2"
**Estado:** Aprobado para integración en SRS v3.0
**Contenido:**
- **Parte 1:** Sistema de 3 atmospheres con specs ejecutables
- **Parte 2:** Arquitectura técnica de migración del prototipo
- **Parte 3:** 6 ADRs visuales formales (ADR-0012 a ADR-0017)
- **Parte 4:** Plan de migración paso a paso

**Marcado:**
- 🟢 **VERDE:** Técnico/visual, alta confianza
- 🟡 **AMARILLO:** Requiere validación con primeros clientes reales
- 🔴 **ROJO:** Decisión pendiente

---

# PARTE 1 — SISTEMA DE 3 ATMOSPHERES

## 1.1 Filosofía y principios

Pandora tiene **una sola identidad visual** (Dawn Sky + glass + motion philosophy) que se expresa en **tres niveles de intensidad** según el contexto operativo de la pantalla.

**Principio rector:**

> "Una identidad, tres intensidades. La identidad no negocia, la intensidad sí."

**Por qué tres y no una:**

Aplicar máxima intensidad visual (tilt, parallax, glass denso, motion constante) en TODAS las pantallas tiene tres consecuencias graves:

1. **Performance degradado** en hardware mediocre (tablets argentinas $200-400).
2. **Fatiga visual** en uso de 8-12 horas diarias.
3. **Pérdida de confianza fiscal** cuando montos críticos se animan o se distorsionan visualmente.

**Por qué tres y no diez:**

Más de tres niveles genera inconsistencia. Tres es el mínimo que cubre los casos reales:
- Una donde el producto "vende" (premium emocional).
- Una donde se trabaja (operacional).
- Una donde el error cuesta dinero (crítico).

## 1.2 Mapa de pantallas por atmosphere

### Atmosphere (premium, emocional)

| Pantalla | Por qué Atmosphere |
|---|---|
| Landing pública | Captura: primera impresión vende |
| Onboarding wizard | Captura: enamorar antes de pedir AFIP |
| Home dashboard del owner | Engagement: vuelve por el dashboard |
| Dashboard multi-empresa del contador | Diferenciador clave vs competencia |
| Reportes con visualizaciones | Premium feel para data exploration |
| Marketing surfaces (planes, upgrade, referidos) | Conversión a Pro/Business |
| Pantalla post-venta exitosa con CAE | Celebración (NO el modal crítico, sino el feedback final) |
| AI Assistant (Fase 1+) | Conversacional, motion natural |
| Settings de personalización | Donde el usuario "juega" |

### Operational (workflow, productivity)

| Pantalla | Por qué Operational |
|---|---|
| **POS (la pantalla más usada)** | 8-12h diarias, velocidad > estética |
| Listados de productos | Densidad alta, búsqueda rápida |
| Listados de clientes | Densidad alta, búsqueda rápida |
| Listados de ventas históricas | Densidad alta, scrolling |
| Búsqueda fuzzy | Resultados en <300ms |
| Carga/edición de productos | Formularios denso, foco en velocidad |
| Stock management | Tablas largas, ajustes rápidos |
| Caja: apertura, movimientos durante turno | Operativo continuo |
| Importación CSV | Wizard funcional, no decorativo |
| Tablas de datos operativas en general | Densidad operativa |

### Critical (fiscal, destructivo, irreversible)

| Pantalla | Por qué Critical |
|---|---|
| Modal de confirmación de venta antes de cobrar | Cliente espera ver total claro |
| Pantalla de factura con CAE emitido | Datos fiscales legibles obligatorios |
| Cierre de caja con arqueo y descuadre | Decisión que afecta contabilidad |
| Anulación de venta | Destructivo, requiere confirmación |
| Configuración AFIP (certificado, PV) | Setup que afecta facturación real |
| Modo lectura por impago / suspensión | Estado crítico que hay que entender |
| Backup y exportación de datos | Acción importante, no decorativa |
| Modal de eliminación de empresa | Destructivo permanente |
| Operaciones que generan Nota de Crédito | Fiscal, irreversible |
| Cambio de condición IVA del comerciante | Afecta facturación toda |
| Suplantación por soporte (modal) | Compliance + audit |

## 1.3 Specs ejecutables — Atmosphere

```css
/* src/styles/atmospheres/atmosphere.css */

[data-atmosphere="atmosphere"] {
  /* Glass */
  --surface-bg: rgba(255, 255, 255, 0.58);
  --surface-bg-strong: rgba(255, 255, 255, 0.72);
  --surface-blur: 28px;
  --surface-saturate: 140%;
  --surface-border: rgba(255, 255, 255, 0.85);
  --surface-shadow: 
    0 1px 0 rgba(255,255,255,0.9) inset,
    0 8px 32px rgba(54, 70, 120, 0.10),
    0 2px 8px rgba(54, 70, 120, 0.06);
  
  /* Motion */
  --motion-enter-duration: 600ms;
  --motion-stagger-delay: 60ms;
  --motion-hover-lift: -2px;
  --motion-easing-enter: cubic-bezier(.2, .7, .2, 1);
  
  /* Features enabled */
  --feature-tilt: 1;          /* ±4° */
  --feature-sheen: 1;         /* on hover */
  --feature-parallax: 1;      /* mouse-tracked sky */
  --feature-counter-shine: 1; /* en KPIs */
  --feature-floaty: 1;        /* hero art */
  --feature-avatar-ring: 1;   /* conic rotating */
  
  /* Density */
  --density-row-height: 44px;
  --density-input-height: 40px;
  --density-padding: 22px;
  --density-gap: 16px;
  --density-base-font: 14px;
  
  /* Typography scales */
  --type-h1: clamp(40px, 5vw, 56px);
  --type-h2: 30px;
  --type-h3: 14.5px;
  --type-kpi-big: 30px;
  --type-kpi-giant: 36px;
  --type-body: 13.5px;
  
  /* Charts */
  --chart-entry-animation: enabled;
  --chart-stroke-width: 2.4;
  
  /* Sky */
  --sky-parallax-enabled: 1;
  --sky-mood-default: dawn;
}
```

**Comportamiento operativo:**

- Parallax sky activo (mouse-tracked)
- Tilt 3D activo en cards (±4°)
- Sheen on hover en cards
- Charts con entry animation completa (line draw + area reveal)
- Stagger entry de elementos (60ms delays acumulativos)
- Counter animations en KPIs (0 → target en 1200-1600ms)
- Avatar ring rotating (conic gradient 6s)
- Counter shine en valores destacados (live revenue)
- Floating cards en hero (3 elementos máximo, ±3°)

## 1.4 Specs ejecutables — Operational

```css
/* src/styles/atmospheres/operational.css */

[data-atmosphere="operational"] {
  /* Glass más opaco, menos blur */
  --surface-bg: rgba(255, 255, 255, 0.82);
  --surface-bg-strong: rgba(255, 255, 255, 0.92);
  --surface-blur: 12px;
  --surface-saturate: 110%;
  --surface-border: rgba(255, 255, 255, 0.6);
  --surface-shadow:
    0 1px 0 rgba(255,255,255,0.7) inset,
    0 2px 8px rgba(54, 70, 120, 0.08);
  
  /* Motion sutil */
  --motion-enter-duration: 200ms;
  --motion-stagger-delay: 0ms;        /* sin stagger */
  --motion-hover-lift: 0;              /* sin lift */
  --motion-easing-enter: cubic-bezier(.4, 0, .2, 1);
  
  /* Features disabled */
  --feature-tilt: 0;          /* ← off */
  --feature-sheen: 0;         /* ← off */
  --feature-parallax: 0;      /* ← off */
  --feature-counter-shine: 0; /* ← off */
  --feature-floaty: 0;        /* ← off */
  --feature-avatar-ring: 0;   /* ← off (ring estático) */
  
  /* Density tight (POS, listados) */
  --density-row-height: 32px;
  --density-input-height: 36px;
  --density-padding: 12px;
  --density-gap: 8px;
  --density-base-font: 13px;
  
  /* Typography más compacta */
  --type-h1: 22px;
  --type-h2: 18px;
  --type-h3: 14px;
  --type-body: 13px;
  
  /* Charts sin animación */
  --chart-entry-animation: disabled;
  --chart-stroke-width: 2;
  
  /* Sky estático */
  --sky-parallax-enabled: 0;
  --sky-mood-default: dawn;
}
```

**Comportamiento operativo:**

- Sky de fondo presente pero **estático** (sin parallax, sin mouse tracking)
- Hover simple: cambio de background y border, **sin tilt ni sheen**
- Charts cargan instantáneos (sin entry animation)
- Sin stagger entry: elementos aparecen todos juntos
- **Números reales NO se animan**: total de venta, stock, monto en caja aparecen exactos al instante
- Avatar ring estático (no rotating)
- Live ticker desactivado (no hay "valores creciendo solos")
- Counter animations desactivadas

**Razón crítica:** El cajero confía en lo que ve. Si los números se animan o "se calculan en pantalla", pierde confianza. En operación, **el valor exacto debe estar disponible inmediatamente.**

## 1.5 Specs ejecutables — Critical

```css
/* src/styles/atmospheres/critical.css */

[data-atmosphere="critical"] {
  /* Casi sólido, sin glass real */
  --surface-bg: rgba(255, 255, 255, 0.96);
  --surface-bg-strong: rgba(255, 255, 255, 1);
  --surface-blur: 0;                  /* ← cero blur */
  --surface-saturate: 100%;
  --surface-border: rgba(13, 20, 36, 0.12);
  --surface-shadow:
    0 4px 16px rgba(13, 20, 36, 0.08),
    0 1px 2px rgba(13, 20, 36, 0.04);
  
  /* Sin motion */
  --motion-enter-duration: 0ms;
  --motion-stagger-delay: 0ms;
  --motion-hover-lift: 0;
  --motion-easing-enter: linear;       /* irrelevante porque duration=0 */
  
  /* Features off */
  --feature-tilt: 0;
  --feature-sheen: 0;
  --feature-parallax: 0;
  --feature-counter-shine: 0;
  --feature-floaty: 0;
  --feature-avatar-ring: 0;
  
  /* Density comfortable para legibilidad */
  --density-row-height: 56px;
  --density-input-height: 48px;
  --density-padding: 24px;
  --density-gap: 16px;
  --density-base-font: 15px;
  
  /* Typography agrandada para fiscal */
  --type-h1: 32px;
  --type-h2: 24px;
  --type-h3: 18px;
  --type-body: 15px;
  --type-amount-display: 56px;        /* totales fiscales */
  --type-amount-weight: 700;
  --type-amount-tracking: -0.03em;
  --type-cae-mono: 24px;              /* CAE en JetBrains Mono */
  
  /* Charts sin animación, alta legibilidad */
  --chart-entry-animation: disabled;
  --chart-stroke-width: 2.5;
  
  /* Sky de fondo se oscurece */
  --sky-overlay-bg: rgba(13, 20, 36, 0.35);
  --sky-parallax-enabled: 0;
}
```

**Comportamiento operativo:**

- Sky de fondo se oscurece con overlay 35% para foco total en el modal/pantalla
- Cero animación de entrada (render instantáneo)
- Botones más grandes (mínimo 52x44px)
- Confirmación destructiva con texto obligatorio del usuario ("Escribí ANULAR para confirmar")
- Colores: máximo contraste, alta legibilidad
- Sin glow ni shine en CAE ni montos
- Spacing más generoso (24px padding base)
- Tipografía agrandada para montos críticos
- CAE en mono 24px, copiable
- Sin glass real: superficie casi sólida porque la transparencia distrae de la decisión

**Razón crítica:** El comerciante está por aprobar una transacción fiscal o destructiva. Cualquier distracción visual (motion, blur, parallax) reduce la atención al dato real. Cero ornamento.

## 1.6 Comparación visual rápida

| Propiedad | Atmosphere | Operational | Critical |
|---|---|---|---|
| Background opacity | 0.58 | 0.82 | 0.96 |
| Backdrop blur | 28px | 12px | 0 |
| Saturate | 140% | 110% | 100% |
| Border | white 0.85 | white 0.6 | ink 0.12 |
| Entry duration | 600ms | 200ms | 0ms |
| Tilt 3D | ±4° | off | off |
| Sheen on hover | ✓ | off | off |
| Parallax sky | ✓ (mouse) | off | off (overlay) |
| Counter animation | ✓ | off | off |
| Charts entry anim | ✓ | off | off |
| Avatar ring rotating | ✓ | static | static |
| Stagger entry | 60ms | 0 | 0 |
| Density default | comfortable | tight | comfortable |
| Base font | 14px | 13px | 15px |
| Floating cards | hero only | off | off |
| Live ticker | dashboard | off | off |
| Min-width target | 1180px | 768px | 360px (responsive) |

## 1.7 Reglas de transición entre atmospheres

Cuando un usuario navega entre pantallas con atmospheres distintos, la transición debe ser **suave pero deliberada**:

| De → A | Transición |
|---|---|
| Atmosphere → Operational | 200ms fade, sin slide |
| Operational → Critical | 0ms (instant), overlay del sky aparece con 150ms fade |
| Atmosphere → Critical | 0ms (instant) |
| Cualquier → Atmosphere | 300ms fade-in con stagger de elementos |

**No hacer:** transiciones largas (>400ms) entre pantallas, especialmente hacia Critical donde el usuario espera respuesta inmediata.

## 1.8 Sky moods (configurable, default dawn)

```css
/* src/styles/sky/dawn.css — DEFAULT */
[data-sky="dawn"] body {
  background:
    radial-gradient(ellipse 60% 50% at 20% 90%, rgba(238, 200, 220, 0.55) 0%, transparent 60%),
    radial-gradient(ellipse 70% 60% at 85% 80%, rgba(240, 210, 180, 0.40) 0%, transparent 60%),
    radial-gradient(ellipse 50% 40% at 60% 30%, rgba(255, 255, 255, 0.6) 0%, transparent 50%),
    radial-gradient(ellipse 50% 40% at 15% 30%, rgba(195, 215, 245, 0.6) 0%, transparent 60%),
    linear-gradient(180deg, #b8c8e8 0%, #c8d4ea 25%, #e0d4e0 60%, #f0d8d2 100%);
}

/* src/styles/sky/noon.css — Fase 1+ */
[data-sky="noon"] body {
  background:
    radial-gradient(ellipse 50% 40% at 50% 30%, rgba(255, 255, 255, 0.7) 0%, transparent 50%),
    radial-gradient(ellipse 60% 50% at 20% 90%, rgba(220, 240, 255, 0.55) 0%, transparent 60%),
    linear-gradient(180deg, #a8c0e8 0%, #c4d8ef 60%, #e8eef8 100%);
}

/* src/styles/sky/dusk.css — Fase 1+ */
[data-sky="dusk"] body {
  background:
    radial-gradient(ellipse 60% 50% at 80% 90%, rgba(255, 180, 130, 0.55) 0%, transparent 60%),
    radial-gradient(ellipse 70% 60% at 20% 70%, rgba(220, 140, 180, 0.45) 0%, transparent 60%),
    linear-gradient(180deg, #9aa8d0 0%, #b8a8c8 40%, #e0b8a8 80%, #f0c8a8 100%);
}

/* src/styles/sky/night.css — Fase 2+ */
[data-sky="night"] body {
  background:
    radial-gradient(ellipse 60% 50% at 80% 10%, rgba(80, 60, 120, 0.35) 0%, transparent 60%),
    radial-gradient(ellipse 70% 60% at 20% 90%, rgba(40, 50, 90, 0.45) 0%, transparent 60%),
    linear-gradient(180deg, #0a1428 0%, #14223a 60%, #1a2848 100%);
}
```

**Default:** dawn permanente. Otros moods se activan en Fase 1+ después de validar UX nocturno con clientes reales.

## 1.9 Color tokens consolidados

```css
/* src/styles/tokens/colors.css */

:root {
  /* PRIMITIVE — luminosidad balanceada */
  
  /* Ink (textos) */
  --ink-0: #0d1424;   /* primary text on cards */
  --ink-1: #1f2a44;   /* secondary body */
  --ink-2: #4a5570;   /* labels, nav idle */
  --ink-3: #7681a0;   /* meta data, dates */
  --ink-4: #a8b0c5;   /* dimmed timestamps */
  
  /* Glass */
  --glass-58: rgba(255, 255, 255, 0.58);
  --glass-72: rgba(255, 255, 255, 0.72);
  --glass-82: rgba(255, 255, 255, 0.82);
  --glass-92: rgba(255, 255, 255, 0.92);
  --glass-96: rgba(255, 255, 255, 0.96);
  --glass-border-light: rgba(255, 255, 255, 0.85);
  --glass-border-medium: rgba(255, 255, 255, 0.6);
  --glass-border-strong: rgba(13, 20, 36, 0.12);
  
  /* Accents (configurable runtime) */
  --purple: #6b5fff;
  --purple-2: #9088ff;
  --purple-soft: rgba(107, 95, 255, 0.10);
  --blue: #5b8cff;
  --blue-2: #8eb0ff;
  --blue-soft: rgba(91, 140, 255, 0.10);
  --teal: #1ea8a0;
  --teal-2: #5fd5cc;
  --teal-soft: rgba(30, 168, 160, 0.10);
  
  /* Semantic */
  --success: #34c77d;        /* venta exitosa, CAE OK */
  --success-soft: rgba(52, 199, 125, 0.13);
  --warning: #f0b878;        /* timeout AFIP, stock crítico */
  --warning-soft: rgba(240, 184, 120, 0.13);
  --danger: #ef5d6a;         /* anulación, error fiscal */
  --danger-soft: rgba(239, 93, 106, 0.13);
  --orange: #f7984a;         /* expense, gastos */
  --orange-soft: rgba(247, 152, 74, 0.13);
  --pink: #ee6a8e;
  --pink-soft: rgba(238, 106, 142, 0.10);
  --yellow: #f4c948;
  
  /* Fiscal (neutro, serio) */
  --fiscal: #0d1424;          /* CAE display, montos críticos */
  --fiscal-bg: rgba(13, 20, 36, 0.04);
  --fiscal-border: rgba(13, 20, 36, 0.08);
  
  /* Active accent (cambia en runtime) */
  --accent: var(--purple);
  --accent-2: var(--purple-2);
  --accent-soft: var(--purple-soft);
}

/* Theme: light por default, dark en Fase 1+ */
[data-theme="dark"] {
  /* TODO Fase 1+ — preparar estructura ahora, valores específicos después */
}
```

## 1.10 Motion tokens consolidados

```css
/* src/styles/tokens/motion.css */

:root {
  /* DURATIONS */
  --motion-instant: 0ms;
  --motion-feedback: 80ms;     /* click, focus immediate */
  --motion-fast: 180ms;        /* hover, simple transitions */
  --motion-medium: 240ms;      /* zone transitions */
  --motion-slow: 400ms;        /* modal entrance */
  --motion-deliberate: 600ms;  /* onboarding, premium */
  --motion-rich: 900ms;        /* sheen sweep */
  --motion-chart: 1600ms;      /* chart entry */
  
  /* EASINGS — solo estas 4 */
  --ease-default: cubic-bezier(.2, .7, .2, 1);    /* casi todo */
  --ease-nav: cubic-bezier(.4, 0, .2, 1);          /* hover lifts, nav */
  --ease-pulse: ease-in-out;                       /* typing, pulses */
  --ease-spin: linear;                             /* avatar ring */
}

/* Reduced motion override */
@media (prefers-reduced-motion: reduce) {
  :root {
    --motion-feedback: 0ms;
    --motion-fast: 0ms;
    --motion-medium: 0ms;
    --motion-slow: 0ms;
    --motion-deliberate: 0ms;
    --motion-rich: 0ms;
    --motion-chart: 0ms;
  }
  
  /* Desactivar animaciones decorativas */
  .parallax-sky,
  .avatar-ring,
  .floaty-card,
  .counter-shine,
  .live-dot::after,
  .sheen::before {
    animation: none !important;
  }
}
```

---

# PARTE 2 — ARQUITECTURA TÉCNICA DE MIGRACIÓN

## 2.1 Estructura de carpetas final

```
src/
├── styles/
│   ├── tokens/
│   │   ├── colors.css
│   │   ├── typography.css
│   │   ├── spacing.css
│   │   ├── motion.css
│   │   ├── elevation.css
│   │   └── radius.css
│   ├── atmospheres/
│   │   ├── atmosphere.css       ← premium specs
│   │   ├── operational.css      ← workflow specs
│   │   └── critical.css         ← fiscal specs
│   ├── sky/
│   │   ├── dawn.css
│   │   ├── noon.css
│   │   ├── dusk.css
│   │   └── night.css
│   ├── themes/
│   │   ├── light.css
│   │   └── dark.css             ← TODO Fase 1+
│   └── globals.css              ← imports + reset + base
│
├── components/
│   ├── ui/                      ← shadcn primitives (NO TOCAR)
│   ├── atmosphere/
│   │   ├── AtmosphereProvider.tsx
│   │   ├── Surface.tsx          ← contenedor con atmosphere context
│   │   ├── GlassCard.tsx        ← card glass según atmosphere
│   │   ├── MotionDiv.tsx        ← wrapper con motion presets
│   │   ├── ParallaxSky.tsx      ← solo activo en atmosphere
│   │   ├── TiltCard.tsx         ← solo activo en atmosphere
│   │   └── Sheen.tsx            ← wrapper que aplica sheen on hover
│   ├── charts/
│   │   ├── SmoothLine.tsx       ← migrado de JSX
│   │   ├── RoundedBars.tsx
│   │   ├── DualLineChart.tsx
│   │   └── AnimatedDonut.tsx
│   ├── primitives/
│   │   ├── Avatar.tsx
│   │   ├── AvatarRing.tsx
│   │   ├── LogoMark.tsx
│   │   ├── Icon.tsx             ← icon set propio (40 iconos)
│   │   ├── LiveDot.tsx
│   │   └── DeltaBadge.tsx
│   ├── shell/
│   │   ├── Sidebar.tsx
│   │   ├── Topbar.tsx
│   │   ├── Layout.tsx
│   │   └── UserChip.tsx
│   ├── widgets/                 ← composite widgets reusables
│   │   ├── KPICard.tsx
│   │   ├── DataTable.tsx
│   │   ├── EmptyState.tsx
│   │   └── LoadingSkeleton.tsx
│   └── domain/
│       ├── pos/                 ← operational atmosphere
│       ├── dashboard/           ← atmosphere
│       ├── fiscal/              ← critical atmosphere
│       ├── accountant/          ← atmosphere
│       ├── inventory/           ← operational
│       └── shared/
│
└── lib/
    ├── design/
    │   ├── atmospheres.ts       ← types + constants
    │   ├── motion-presets.ts
    │   ├── hardware-detection.ts
    │   └── density.ts
    └── hooks/
        ├── useCountUp.ts        ← migrado
        ├── useLiveTicker.ts     ← migrado
        ├── use3DTilt.ts         ← migrado
        ├── useAtmosphere.ts     ← consume Context
        └── useCapabilities.ts   ← hardware detection
```

## 2.2 AtmosphereProvider y types

```typescript
// src/lib/design/atmospheres.ts

export type Atmosphere = 'atmosphere' | 'operational' | 'critical';

export interface AtmosphereConfig {
  level: Atmosphere;
  glass: {
    bgOpacity: number;
    blur: number;
    saturate: number;
    borderOpacity: number;
  };
  motion: {
    enterDuration: number;
    staggerDelay: number;
    hoverLift: number;
  };
  features: {
    tilt: boolean;
    sheen: boolean;
    parallax: boolean;
    counterShine: boolean;
    floaty: boolean;
    avatarRing: boolean;
    counterAnimation: boolean;
  };
  density: {
    rowHeight: number;
    inputHeight: number;
    padding: number;
    gap: number;
    baseFontSize: number;
  };
}

export const ATMOSPHERE_CONFIGS: Record<Atmosphere, AtmosphereConfig> = {
  atmosphere: {
    level: 'atmosphere',
    glass: { bgOpacity: 0.58, blur: 28, saturate: 140, borderOpacity: 0.85 },
    motion: { enterDuration: 600, staggerDelay: 60, hoverLift: -2 },
    features: {
      tilt: true, sheen: true, parallax: true,
      counterShine: true, floaty: true, avatarRing: true,
      counterAnimation: true,
    },
    density: { rowHeight: 44, inputHeight: 40, padding: 22, gap: 16, baseFontSize: 14 },
  },
  operational: {
    level: 'operational',
    glass: { bgOpacity: 0.82, blur: 12, saturate: 110, borderOpacity: 0.6 },
    motion: { enterDuration: 200, staggerDelay: 0, hoverLift: 0 },
    features: {
      tilt: false, sheen: false, parallax: false,
      counterShine: false, floaty: false, avatarRing: false,
      counterAnimation: false,
    },
    density: { rowHeight: 32, inputHeight: 36, padding: 12, gap: 8, baseFontSize: 13 },
  },
  critical: {
    level: 'critical',
    glass: { bgOpacity: 0.96, blur: 0, saturate: 100, borderOpacity: 0.12 },
    motion: { enterDuration: 0, staggerDelay: 0, hoverLift: 0 },
    features: {
      tilt: false, sheen: false, parallax: false,
      counterShine: false, floaty: false, avatarRing: false,
      counterAnimation: false,
    },
    density: { rowHeight: 56, inputHeight: 48, padding: 24, gap: 16, baseFontSize: 15 },
  },
};
```

## 2.3 Hardware detection y degradación automática

```typescript
// src/lib/design/hardware-detection.ts

export interface Capabilities {
  highPerf: boolean;
  reducedMotion: boolean;
  canDoGlass: boolean;
  canDoTilt: boolean;
  canDoParallax: boolean;
  canDoCharts: boolean;
  isMobile: boolean;
  isTablet: boolean;
}

export function detectCapabilities(): Capabilities {
  if (typeof window === 'undefined') {
    return {
      highPerf: true, reducedMotion: false,
      canDoGlass: true, canDoTilt: true, canDoParallax: true,
      canDoCharts: true,
      isMobile: false, isTablet: false,
    };
  }
  
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const cores = navigator.hardwareConcurrency ?? 4;
  const memory = (navigator as any).deviceMemory ?? 4;
  
  const ua = navigator.userAgent;
  const isMobile = /Mobi|Android.*Mobile|iPhone/i.test(ua);
  const isTablet = /iPad|Android(?!.*Mobile)/i.test(ua) || (window.innerWidth >= 768 && window.innerWidth < 1180);
  
  const highPerf = !reducedMotion && cores >= 4 && memory >= 4 && !isMobile;
  
  return {
    highPerf,
    reducedMotion,
    canDoGlass: !reducedMotion && cores >= 2,        // glass funciona en casi todo
    canDoTilt: highPerf && !isTablet,                 // tilt off en tablet
    canDoParallax: highPerf && !isMobile && !isTablet, // parallax solo desktop
    canDoCharts: true,                                // SVG es universal
    isMobile,
    isTablet,
  };
}
```

```typescript
// src/lib/hooks/useCapabilities.ts

import { useEffect, useState } from 'react';
import { detectCapabilities, type Capabilities } from '@/lib/design/hardware-detection';

export function useCapabilities(): Capabilities {
  const [caps, setCaps] = useState<Capabilities>(() => detectCapabilities());
  
  useEffect(() => {
    setCaps(detectCapabilities());
    
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = () => setCaps(detectCapabilities());
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  
  return caps;
}
```

## 2.4 AtmosphereProvider con degradación

```typescript
// src/components/atmosphere/AtmosphereProvider.tsx

'use client';

import { createContext, useContext, useMemo } from 'react';
import { ATMOSPHERE_CONFIGS, type Atmosphere, type AtmosphereConfig } from '@/lib/design/atmospheres';
import { useCapabilities } from '@/lib/hooks/useCapabilities';

interface AtmosphereContextValue {
  level: Atmosphere;
  config: AtmosphereConfig;
  effectiveLevel: Atmosphere;
  effectiveConfig: AtmosphereConfig;
  canDoTilt: boolean;
  canDoParallax: boolean;
  canDoSheen: boolean;
}

const AtmosphereContext = createContext<AtmosphereContextValue | null>(null);

export function AtmosphereProvider({
  level,
  children,
}: {
  level: Atmosphere;
  children: React.ReactNode;
}) {
  const caps = useCapabilities();
  
  const effectiveLevel: Atmosphere = useMemo(() => {
    if (level === 'critical') return 'critical';
    if (level === 'atmosphere' && !caps.canDoGlass) return 'operational';
    return level;
  }, [level, caps.canDoGlass]);
  
  const config = ATMOSPHERE_CONFIGS[level];
  const effectiveConfig = ATMOSPHERE_CONFIGS[effectiveLevel];
  
  const value = useMemo<AtmosphereContextValue>(() => ({
    level,
    config,
    effectiveLevel,
    effectiveConfig,
    canDoTilt: caps.canDoTilt && effectiveConfig.features.tilt,
    canDoParallax: caps.canDoParallax && effectiveConfig.features.parallax,
    canDoSheen: caps.highPerf && effectiveConfig.features.sheen,
  }), [level, config, effectiveLevel, effectiveConfig, caps]);
  
  return (
    <AtmosphereContext.Provider value={value}>
      <div data-atmosphere={effectiveLevel}>
        {children}
      </div>
    </AtmosphereContext.Provider>
  );
}

export function useAtmosphere() {
  const ctx = useContext(AtmosphereContext);
  if (!ctx) {
    throw new Error('useAtmosphere must be used within AtmosphereProvider');
  }
  return ctx;
}
```

## 2.5 Surface component

```typescript
// src/components/atmosphere/Surface.tsx

'use client';

import { cn } from '@/lib/utils';
import { AtmosphereProvider } from './AtmosphereProvider';
import type { Atmosphere } from '@/lib/design/atmospheres';

interface SurfaceProps {
  level: Atmosphere;
  className?: string;
  children: React.ReactNode;
}

export function Surface({ level, className, children }: SurfaceProps) {
  return (
    <AtmosphereProvider level={level}>
      <div className={cn('surface', className)}>
        {children}
      </div>
    </AtmosphereProvider>
  );
}
```

```css
/* src/styles/atmospheres/_base.css */

.surface {
  position: relative;
  min-height: 100vh;
}

/* Atmosphere */
[data-atmosphere="atmosphere"] .surface,
[data-atmosphere="atmosphere"].surface {
  /* aplica todas las CSS vars de atmosphere.css */
}

/* Operational */
[data-atmosphere="operational"] .surface,
[data-atmosphere="operational"].surface {
  /* aplica vars de operational.css */
}

/* Critical: agrega overlay del sky */
[data-atmosphere="critical"] .surface,
[data-atmosphere="critical"].surface {
  /* aplica vars de critical.css */
}

[data-atmosphere="critical"]::before {
  content: '';
  position: fixed;
  inset: 0;
  background: var(--sky-overlay-bg);
  z-index: 0;
  pointer-events: none;
}
```

## 2.6 GlassCard reactivo al atmosphere

```typescript
// src/components/atmosphere/GlassCard.tsx

'use client';

import { forwardRef } from 'react';
import { cn } from '@/lib/utils';
import { useAtmosphere } from './AtmosphereProvider';
import { TiltCard } from './TiltCard';
import { Sheen } from './Sheen';

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'strong';
  enableTilt?: boolean;  // override
  enableSheen?: boolean; // override
}

export const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
  ({ variant = 'default', enableTilt, enableSheen, className, children, ...props }, ref) => {
    const { canDoTilt, canDoSheen, effectiveLevel } = useAtmosphere();
    
    const shouldTilt = enableTilt ?? canDoTilt;
    const shouldSheen = enableSheen ?? canDoSheen;
    
    const cardContent = (
      <div
        ref={ref}
        className={cn(
          'glass-card',
          variant === 'strong' && 'glass-card-strong',
          `glass-card-${effectiveLevel}`,
          className
        )}
        {...props}
      >
        {shouldSheen && <Sheen />}
        <div className="glass-card-inner">
          {children}
        </div>
      </div>
    );
    
    if (shouldTilt) {
      return <TiltCard max={4}>{cardContent}</TiltCard>;
    }
    
    return cardContent;
  }
);

GlassCard.displayName = 'GlassCard';
```

```css
/* src/styles/components/glass-card.css */

.glass-card {
  position: relative;
  background: var(--surface-bg);
  backdrop-filter: blur(var(--surface-blur)) saturate(var(--surface-saturate));
  -webkit-backdrop-filter: blur(var(--surface-blur)) saturate(var(--surface-saturate));
  border: 1px solid var(--surface-border);
  border-radius: 20px;
  box-shadow: var(--surface-shadow);
  padding: var(--density-padding);
  overflow: hidden;
}

.glass-card-strong {
  background: var(--surface-bg-strong);
}

.glass-card-critical {
  border-radius: 16px;
}

.glass-card-operational {
  border-radius: 14px;
}
```

## 2.7 Migración de charts (de JSX a TSX)

Los 4 charts ya están bien diseñados. Solo hay que:

1. Convertir JSX a TSX con tipos.
2. Reemplazar `window.X` por exports nombrados.
3. Hacerlos atmosphere-aware (animaciones según contexto).

```typescript
// src/components/charts/SmoothLine.tsx

'use client';

import { useId } from 'react';
import { useAtmosphere } from '@/components/atmosphere/AtmosphereProvider';

interface DataPoint {
  v: number;
  label: string;
}

interface SmoothLineProps {
  data: DataPoint[];
  color?: string;
  highlightLast?: boolean;
  width?: number;
  height?: number;
}

export function SmoothLine({
  data,
  color = 'var(--accent)',
  highlightLast = false,
  width = 320,
  height = 110,
}: SmoothLineProps) {
  const { effectiveConfig } = useAtmosphere();
  const animate = effectiveConfig.features.counterAnimation;
  
  // ... resto de la lógica de smooth path
  
  const id = `g_${useId().replace(/:/g, '')}`;
  
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%" preserveAspectRatio="none">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.32" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`} className={animate ? 'reveal-area' : ''} />
      <path d={path} fill="none" stroke={color} strokeWidth="2.4"
        strokeLinecap="round" strokeLinejoin="round"
        className={animate ? 'draw-line' : ''} />
      {/* ... resto ... */}
    </svg>
  );
}
```

## 2.8 Hooks migrados a TypeScript

```typescript
// src/lib/hooks/useCountUp.ts

import { useEffect, useState } from 'react';
import { useAtmosphere } from '@/components/atmosphere/AtmosphereProvider';

interface UseCountUpOptions {
  duration?: number;
  decimals?: number;
  delay?: number;
}

export function useCountUp(
  target: number,
  { duration = 1400, decimals = 0, delay = 0 }: UseCountUpOptions = {}
): number {
  const { effectiveConfig } = useAtmosphere();
  const shouldAnimate = effectiveConfig.features.counterAnimation;
  
  const [val, setVal] = useState(shouldAnimate ? 0 : target);
  
  useEffect(() => {
    if (!shouldAnimate) {
      setVal(target);
      return;
    }
    
    let raf: number;
    const start = performance.now() + delay;
    
    const tick = (now: number) => {
      if (now < start) {
        raf = requestAnimationFrame(tick);
        return;
      }
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(target * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, delay, shouldAnimate]);
  
  const factor = Math.pow(10, decimals);
  return Math.round(val * factor) / factor;
}
```

## 2.9 ParallaxSky atmosphere-aware

```typescript
// src/components/atmosphere/ParallaxSky.tsx

'use client';

import { useEffect, useRef } from 'react';
import { useAtmosphere } from './AtmosphereProvider';

export function ParallaxSky() {
  const { canDoParallax } = useAtmosphere();
  const layerARef = useRef<HTMLDivElement>(null);
  const layerBRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (!canDoParallax) return;
    
    const onMove = (e: MouseEvent) => {
      const x = (e.clientX / window.innerWidth - 0.5) * 20;
      const y = (e.clientY / window.innerHeight - 0.5) * 20;
      if (layerARef.current) {
        layerARef.current.style.transform = `translate(${x}px, ${y}px)`;
      }
      if (layerBRef.current) {
        layerBRef.current.style.transform = `translate(${-x * 0.5}px, ${-y * 0.5}px)`;
      }
    };
    
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, [canDoParallax]);
  
  return (
    <>
      <div ref={layerARef} className="sky-layer sky-layer-a" />
      <div ref={layerBRef} className="sky-layer sky-layer-b" />
    </>
  );
}
```

## 2.10 Performance budget por atmosphere

| Atmosphere | LCP target | FPS target | First Input Delay | CLS |
|---|---|---|---|---|
| Atmosphere | < 2.5s | 60fps | < 100ms | < 0.1 |
| Operational | < 1.5s | 60fps consistente | < 50ms | < 0.05 |
| Critical | < 1.0s | N/A | < 30ms | 0 |

**Si Operational baja a 30fps en hardware target (tablet $200) durante operación normal del POS: es bug bloqueante.**

**Tests automáticos en CI:**

- Lighthouse CI con presupuesto por ruta
- Tests con `cpu throttling` 4x simulando hardware bajo
- Test específico: POS con 100 productos en carrito + búsqueda activa
- Test específico: dashboard con 24h de data

---

# PARTE 3 — ADRs VISUALES FORMALES

---

## ADR-0012 — Sistema de 3 atmospheres

**Fecha:** 2026-05-17
**Estado:** Aprobado
**Autores:** Owner técnico
**Reemplaza:** —

### Contexto

Pandora tiene tres tipos de superficies con requisitos contradictorios:
- Dashboards e onboarding necesitan diferenciación visual premium para conversión.
- POS y workflow necesitan velocidad operativa y baja fatiga visual (uso 8-12h).
- Pantallas fiscales/destructivas necesitan claridad máxima y cero distracción.

Aplicar una sola intensidad visual a todas las pantallas falla en dos direcciones: si es muy premium, el POS se vuelve lento e incómodo; si es muy plana, el dashboard no diferencia el producto.

Alternativas evaluadas:
- **Una sola estética para todo:** simple pero falla en operación real.
- **Estética por dominio (sales, stock, fiscal):** se acopla a estructura del producto, difícil de mantener.
- **3 atmospheres por contexto operativo:** abstracción ortogonal a dominios, escala mejor.
- **5+ atmospheres con matices:** complejidad sin ganancia clara.

### Decisión

Adoptar tres atmospheres: **Atmosphere** (premium), **Operational** (workflow), **Critical** (fiscal/destructivo).

Cada pantalla se asigna a una atmosphere según su contexto operativo, no según su dominio funcional. Las atmospheres se implementan como CSS variables que se activan vía `[data-atmosphere="..."]` en un Provider de React.

Las tres atmospheres comparten la misma identidad (Dawn Sky + glass + motion philosophy) pero con intensidades calibradas.

### Alternativas rechazadas

- **Una sola estética:** rechazado. POS con tilt/parallax/sheen es invendible para uso real 8-12h.
- **Estética por dominio:** rechazado. Hay pantallas críticas en todos los dominios (anulación de venta, ajuste de stock, eliminación de cliente).
- **5+ atmospheres:** rechazado. Más de tres niveles genera inconsistencia operativa y decisiones ambiguas ("¿esto es premium-light o operational-rich?").

### Consecuencias

**Positivas:**
- Identidad coherente con flexibilidad operativa.
- Cada pantalla tiene atmosphere "correcta" sin ambigüedad.
- Performance optimizada por contexto.
- Reduced motion y degradación por hardware son triviales de implementar.

**Negativas:**
- Tres sets de CSS variables a mantener.
- Devs deben elegir atmosphere conscientemente al crear pantalla nueva.
- Testing visual requiere cubrir las 3 atmospheres.

**Riesgos:**
- Drift: alguien aplica atmosphere "premium" a pantalla operativa porque "se ve mejor". Mitigación: lint rule que valida atmosphere por ruta.
- Inconsistencia: aparece una atmosphere extra fuera de las 3. Mitigación: TypeScript type strict, no permite valores fuera del enum.

### Triggers de re-evaluación

- Aparece pantalla que no encaja en ninguna de las 3 atmospheres y no se puede forzar.
- Más de 10 atmosphere overrides en el código (señal de que las 3 no alcanzan).
- Performance de operational degrada por la abstracción.

---

## ADR-0013 — Glass system con 3 niveles + degradación automática

**Fecha:** 2026-05-17
**Estado:** Aprobado
**Autores:** Owner técnico

### Contexto

`backdrop-filter: blur()` es costoso en GPU. En hardware target (tablets argentinas $200-400, 4GB RAM, 4 cores) puede degradar FPS notablemente.

Aplicar blur uniforme tiene tres problemas:
- Performance en hardware bajo.
- Pérdida de legibilidad en pantallas críticas (datos fiscales detrás de blur reducen claridad).
- Consumo de batería en tablets.

### Decisión

Tres niveles de glass según atmosphere:

| Atmosphere | Blur | Saturate | BG opacity |
|---|---|---|---|
| Atmosphere | 28px | 140% | 0.58 |
| Operational | 12px | 110% | 0.82 |
| Critical | 0px | 100% | 0.96 |

Degradación automática vía `useCapabilities()`:
- Si hardware no soporta glass (cores < 2 o reducedMotion): degradar Atmosphere → Operational automáticamente.
- Si dispositivo es mobile/tablet: Atmosphere efectivo se mantiene visualmente pero con blur reducido (12px) para preservar performance.

### Alternativas rechazadas

- **Glass uniforme 28px:** rechazado. Performance inaceptable en tablets baratas.
- **Sin glass (flat design):** rechazado. Pierde identidad de marca.
- **Glass solo en cards, no en sidebars/topbars:** rechazado. Inconsistencia visual.

### Consecuencias

**Positivas:**
- Performance preservada en hardware bajo.
- Identidad visual mantenida en cualquier dispositivo.
- Critical surfaces son más legibles (sin blur).

**Negativas:**
- Tres definiciones de glass que mantener sincronizadas.
- Devs deben usar `useAtmosphere()` para acceder al glass correcto.

**Riesgos:**
- Hardcoded blur values en componentes (lint rule lo previene).

---

## ADR-0014 — Charts en SVG puro sin librería externa

**Fecha:** 2026-05-17
**Estado:** Aprobado
**Autores:** Owner técnico

### Contexto

Para visualización de datos (revenue, sales, productivity) hay opciones:
- Librerías: Recharts, Chart.js, Tremor, Nivo, Visx.
- Custom SVG con D3 utilities.
- SVG puro escrito a mano.

El prototipo ya implementa 4 charts en SVG puro con animaciones custom. Funciona, es performante, y se ve premium.

### Decisión

**Mantener charts en SVG puro escritos a mano.** Los 4 charts existentes (SmoothLine, RoundedBars, DualLineChart, AnimatedDonut) se migran a TypeScript y se mantienen como primitives propias.

Para charts más complejos (Fase 2+: heatmaps, sankey, advanced):
- Primero intentar SVG puro.
- Si justifica, usar Visx (D3 con React) como fallback.
- Recharts solo como último recurso (es pesado y customización limitada).

### Alternativas rechazadas

- **Recharts:** rechazado. Bundle ~120KB, customización limitada, no encaja con Dawn Sky.
- **Chart.js:** rechazado. Canvas-based, difícil de combinar con glass system.
- **Tremor:** rechazado. Componentes opinados que no respetan atmosphere.
- **Nivo:** rechazado. Bundle pesado, overkill para 4 chart types.
- **D3 puro:** rechazado. Curva de aprendizaje alta, no necesario para nuestros casos.

### Consecuencias

**Positivas:**
- Bundle mínimo (charts viven en TSX, no library).
- Animaciones perfectamente integradas con motion system.
- Performance óptima.
- Charts respetan atmosphere automáticamente.

**Negativas:**
- Chart types nuevos requieren implementación manual.
- Mantener primitives es trabajo de design system.

**Riesgos:**
- Solicitudes de chart types complejos en Fase 2+ (heatmap, treemap). Mitigación: agregar Visx solo cuando justifique.

---

## ADR-0015 — Motion presets nombrados con 4 easings restringidos

**Fecha:** 2026-05-17
**Estado:** Aprobado
**Autores:** Owner técnico

### Contexto

Animaciones libres en componentes generan inconsistencia:
- Distintos componentes con distintas duraciones para acción similar.
- Easings improvisados que se sienten "raros".
- Imposible mantener coherencia visual.

### Decisión

Sistema de motion centralizado con:

**4 easings permitidos:**
- `--ease-default: cubic-bezier(.2, .7, .2, 1)` — default casi todo
- `--ease-nav: cubic-bezier(.4, 0, .2, 1)` — hover lifts, nav
- `--ease-pulse: ease-in-out` — typing, pulses
- `--ease-spin: linear` — avatar ring, spinners

**Durations nombradas:**
- `--motion-feedback: 80ms` — click immediate
- `--motion-fast: 180ms` — hover
- `--motion-medium: 240ms` — zone transitions
- `--motion-slow: 400ms` — modal entrance
- `--motion-deliberate: 600ms` — onboarding
- `--motion-rich: 900ms` — sheen sweep
- `--motion-chart: 1600ms` — chart entry

**Presets nombrados** para animaciones complejas (`fade-up`, `draw-line`, `grow-bar`, `reveal-area`, etc.).

Cualquier animación nueva DEBE entrar al motion system antes de usarse en componente.

### Alternativas rechazadas

- **Animación libre por componente:** rechazado. Genera caos.
- **Framer Motion como library principal:** rechazado. 50KB de bundle extra para casos simples. Permitido para casos complejos puntuales (gestures, drag).
- **Auto-animate:** rechazado. Mágico pero poco predecible.

### Consecuencias

**Positivas:**
- Coherencia visual garantizada.
- Reduced motion trivial (cambia los CSS vars).
- Performance predecible.

**Negativas:**
- Devs deben usar tokens, no animación libre.
- Animación custom requiere agregar al system primero.

---

## ADR-0016 — Dawn Sky como identidad visual permanente

**Fecha:** 2026-05-17
**Estado:** Aprobado
**Autores:** Owner técnico

### Contexto

La identidad visual de Pandora es **Dawn Sky**: background pastel de gradientes radiales que evoca amanecer. Es lo que diferencia visualmente al producto de cualquier otro POS/ERP argentino (Tango es gris industrial, Zeus es plano corporativo).

Opciones:
- Mantener Dawn Sky permanente, con moods configurables como personalización.
- Dejar al usuario elegir cualquier background.
- Múltiples identidades visuales (sky / mountain / ocean) intercambiables.

### Decisión

**Dawn Sky es la identidad permanente del producto.** No es opción, es marca.

Moods disponibles (configurable por usuario, default dawn):
- **dawn** (default, permanente) — amanecer pastel pink/lavender/sky
- **noon** (Fase 1+) — mediodía cyan/white
- **dusk** (Fase 1+) — atardecer peach/pink/navy
- **night** (Fase 2+) — noche profunda (para modo nocturno real)

Los moods cambian la atmósfera del sky pero **no la identidad**. El producto siempre "se siente como Pandora" independientemente del mood activo.

### Alternativas rechazadas

- **Background neutro configurable:** rechazado. Pierde identidad.
- **Múltiples identidades visuales (themes radicales):** rechazado. Confunde, dilata brand.
- **Background plano sin sky:** rechazado. Sería un POS más.

### Consecuencias

**Positivas:**
- Identidad visual reconocible inmediatamente.
- Screenshots virales potenciales (es lo más diferenciador del producto).
- Justifica pricing premium ("se ve premium").

**Negativas:**
- Algunos usuarios pueden no gustarle el estilo pastel.
- Requiere skill de gradientes correcto en cada superficie.

**Riesgos:**
- Cliente Business pide "modo corporativo serio". Mitigación: dusk + variante "subtle" en Fase 3.

### Triggers de re-evaluación

- Más del 30% de usuarios desactivan el sky.
- Cliente Enterprise (Fase 4+) requiere identidad propia.

---

## ADR-0017 — Density obligatoria por atmosphere

**Fecha:** 2026-05-17
**Estado:** Aprobado
**Autores:** Owner técnico

### Contexto

Aplicar una sola densidad a todas las pantallas falla en dos direcciones:
- **Densidad alta uniforme:** pantallas críticas como facturación se vuelven incómodas.
- **Densidad baja uniforme:** POS pierde productividad (menos productos visibles, más scroll).

Densidad correcta depende del contexto operativo, no del componente.

### Decisión

Density se asigna automáticamente por atmosphere:

| Atmosphere | Density | Row | Input | Font | Padding |
|---|---|---|---|---|---|
| Atmosphere | comfortable | 44px | 40px | 14px | 22px |
| Operational | tight | 32px | 36px | 13px | 12px |
| Critical | comfortable+ | 56px | 48px | 15px | 24px |

Tabletas táctiles fuerzan mínimo `comfortable` (target táctil ≥44px) regardless de atmosphere — accesibilidad mata densidad.

### Alternativas rechazadas

- **Densidad configurable por usuario:** rechazado. Decisión arquitectónica, no preferencia.
- **Densidad uniforme:** rechazado. Falla en POS o en fiscal.
- **Densidad por componente:** rechazado. Inconsistencia entre módulos.

### Consecuencias

**Positivas:**
- POS denso y productivo.
- Fiscal claro y legible.
- Dashboard balanceado.
- Accesibilidad táctil respetada automáticamente.

**Negativas:**
- Tres sets de density tokens que mantener.

**Riesgos:**
- Componente compartido entre atmospheres debe responder a density. Mitigación: usar CSS vars, no valores hardcoded.

---

# PARTE 4 — PLAN DE MIGRACIÓN PASO A PASO

## 4.1 Sprint visual (estimado 2-3 días)

### Día 1 — Tokens y base

**Tareas:**

1. Crear `src/styles/tokens/` con todos los archivos:
   - `colors.css` (paleta completa)
   - `typography.css` (Inter + JetBrains Mono)
   - `spacing.css` (escala 4-8-12-16-24-32-48-64)
   - `motion.css` (durations + easings)
   - `elevation.css` (sombras)
   - `radius.css` (10/14/16/20/26)

2. Crear `src/styles/atmospheres/`:
   - `_base.css` (selectores comunes)
   - `atmosphere.css` (specs premium)
   - `operational.css` (specs workflow)
   - `critical.css` (specs fiscal)

3. Crear `src/styles/sky/dawn.css` (otros moods en Fase 1).

4. Configurar `src/styles/globals.css` con imports y reset.

5. Verificar que `next.config.js` permite las extensiones CSS necesarias.

### Día 2 — Atmosphere Provider y primitives

**Tareas:**

1. `src/lib/design/atmospheres.ts` — types y configs.
2. `src/lib/design/hardware-detection.ts` — detección de capabilities.
3. `src/lib/hooks/useCapabilities.ts` — hook con SSR safety.
4. `src/components/atmosphere/AtmosphereProvider.tsx`.
5. `src/components/atmosphere/Surface.tsx`.
6. `src/components/atmosphere/GlassCard.tsx`.
7. `src/components/atmosphere/TiltCard.tsx` (migrado del JSX).
8. `src/components/atmosphere/Sheen.tsx` (extraído del CSS).
9. `src/components/atmosphere/ParallaxSky.tsx` (migrado).
10. `src/lib/hooks/useCountUp.ts` (migrado a TS).
11. `src/lib/hooks/useLiveTicker.ts` (migrado a TS).
12. `src/lib/hooks/use3DTilt.ts` (migrado a TS).

### Día 3 — Charts y primitivas

**Tareas:**

1. `src/components/charts/SmoothLine.tsx` (migrado).
2. `src/components/charts/RoundedBars.tsx` (migrado).
3. `src/components/charts/DualLineChart.tsx` (migrado).
4. `src/components/charts/AnimatedDonut.tsx` (migrado).
5. `src/components/primitives/Icon.tsx` (migrado de icons.jsx — 40+ iconos).
6. `src/components/primitives/LogoMark.tsx` (migrado).
7. `src/components/primitives/Avatar.tsx` (migrado).
8. `src/components/primitives/AvatarRing.tsx` (extraído).
9. `src/components/primitives/LiveDot.tsx` (extraído del HTML).
10. `src/components/primitives/DeltaBadge.tsx` (nuevo, para KPIs).

## 4.2 Validación post-migración

**Tests obligatorios antes de seguir:**

```bash
# 1. Type check
npm run type-check

# 2. Lint
npm run lint

# 3. Build
npm run build

# 4. Test atmospheres rendering
npm run test:atmospheres

# 5. Performance budget
npm run lighthouse:atmospheres
```

**Validaciones visuales manuales:**

- [ ] AtmosphereProvider con level="atmosphere" muestra glass denso + tilt + parallax
- [ ] AtmosphereProvider con level="operational" muestra glass medio + sin tilt + sin parallax
- [ ] AtmosphereProvider con level="critical" muestra glass casi sólido + overlay del sky + sin animación
- [ ] Cambiar accent (purple/blue/teal) actualiza colores en runtime
- [ ] Cambiar sky (dawn/noon/dusk) actualiza fondo
- [ ] prefers-reduced-motion desactiva todas las animaciones decorativas
- [ ] En tablet simulada (4 cores) atmosphere degrada a operational
- [ ] Charts entry animation funciona en atmosphere, no funciona en operational
- [ ] useCountUp anima en atmosphere, no anima en operational/critical

## 4.3 Después de la migración

**Sesión 4 (integración SRS v3.0) incluirá:**

- Sección nueva "Visual System" en el SRS unificado
- Los 6 ADRs visuales (0012-0017) como archivos separados en `adr/`
- Referencias cross a las 3 atmospheres desde cada sección de pantallas

**Pre-código:**

- Setup del repo siguiendo CLAUDE.md sección 06
- Sprint visual de 2-3 días siguiendo este plan
- Primera pantalla a tipear: POS (operational atmosphere)
- Segunda pantalla: Home Dashboard (atmosphere)
- Tercera pantalla: Confirmación de venta (critical atmosphere)

## 4.4 Métricas de éxito

**Al finalizar el sprint visual, deberías poder:**

```tsx
// POS — operational
<Surface level="operational">
  <GlassCard>
    <ProductGrid />  // tight density, sin tilt
  </GlassCard>
</Surface>

// Dashboard — atmosphere
<Surface level="atmosphere">
  <ParallaxSky />
  <GlassCard>
    <RevenuePanel />  // counter animation, tilt, sheen
  </GlassCard>
</Surface>

// Anulación de venta — critical
<Surface level="critical">
  <GlassCard variant="strong">
    <h1>¿Anular venta #1234?</h1>
    <BigAmount>${total}</BigAmount>
    {/* sin animación, sin tilt, alta legibilidad */}
  </GlassCard>
</Surface>
```

**Y los tres deberían:**
- Verse coherentes (misma identidad Dawn Sky + glass)
- Comportarse distinto (motion según atmosphere)
- Performar correctamente (60fps en hardware target)
- Pasar tests de accesibilidad WCAG AA

---

# CIERRE DE SESIÓN 3.7

## Resumen de lo entregado

**Parte 1 — Sistema de 3 atmospheres:**
- Filosofía y principios
- Mapa exhaustivo de pantallas por atmosphere
- Specs ejecutables para cada atmosphere (CSS vars completos)
- Tabla comparativa
- Reglas de transición entre atmospheres
- Sky moods configurables
- Color tokens consolidados
- Motion tokens consolidados con reduced motion respetado

**Parte 2 — Arquitectura técnica:**
- Estructura de carpetas final
- AtmosphereProvider con types
- Hardware detection y degradación automática
- Surface component
- GlassCard reactivo
- Migración de charts
- Hooks migrados a TS
- ParallaxSky atmosphere-aware
- Performance budget por atmosphere

**Parte 3 — 6 ADRs visuales formales:**
- ADR-0012: Sistema de 3 atmospheres
- ADR-0013: Glass system con degradación
- ADR-0014: Charts en SVG puro
- ADR-0015: Motion presets nombrados
- ADR-0016: Dawn Sky como identidad permanente
- ADR-0017: Density obligatoria por atmosphere

**Parte 4 — Plan de migración paso a paso:**
- Sprint visual de 3 días
- Validaciones post-migración
- Métricas de éxito

## Estado actual del SRS

| Sesión | Estado | Líneas | KB |
|---|---|---|---|
| Sesión 1 (fixes + UX Operacional) | ✅ | 704 | 38 |
| Sesión 2 (Observabilidad + 9 máquinas) | ✅ | 1.320 | 51 |
| Sesión 3 (ambigüedades + ADRs + Dominios) | ✅ | 1.404 | 56 |
| Sesión 3.5 (correcciones auditoría) | ✅ | 1.283 | 45 |
| Sesión 3.5.2 (refinements segunda pasada) | ✅ | 642 | 23 |
| **Sesión 3.7 (visual system + 6 ADRs)** | ✅ **Completa** | ~1700 | ~70 |
| Sesión 4 (SRS v3.0 unificado) | 🔜 Próxima | est. 5000+ | est. 250+ |

**Total acumulado:** 7.053 líneas, 283 KB de contenido nuevo + base v2.0-OMN.

## Decisiones pendientes nuevas

🔴 ROJO:

1. **Customización de atmospheres por tenant:** ¿permitir que tenant Business override la atmosphere de algunas pantallas? Recomiendo NO en Fase 0-2, evaluar en Fase 3.

2. **Light vs Dark default:** ¿default light siempre, o auto según hora del sistema? Recomiendo light siempre en Fase 0, auto en Fase 1.

3. **Dawn como mood permanente o configurable:** ¿el usuario puede cambiar a noon/dusk desde día 1, o solo dawn en Fase 0? Recomiendo solo dawn en Fase 0.

🟡 AMARILLO:

1. **Specs táctiles para tablets argentinas:** target táctil mínimo 44px está cubierto, pero falta validación con tablets reales del target (Samsung Tab A8, Xiaomi Pad, etc.). Postergar a primer cliente piloto.

2. **Modo nocturno auto-detect por hora:** lógica de "después de las 20h activar dark" requiere validación con clientes que operen de noche. Postergar a Fase 1.

## Próximo paso

**Sesión 4 — Integración SRS v3.0 final**, ahora con:
- v2.0-OMN base
- Sesión 1 (fixes + UX Operacional)
- Sesión 2 (Observabilidad + máquinas)
- Sesión 3 (ambigüedades + ADRs + Dominios)
- Sesión 3.5 (correcciones de auditoría)
- Sesión 3.5.2 (refinements de segunda pasada)
- **Sesión 3.7 (visual system + 6 ADRs visuales)** ← agregado

**Output esperado:**
- `PANDORA_ERP_SRS_v3.0.md` (~5000+ líneas, ~250 KB)
- `adr/ADR-0001.md` a `adr/ADR-0017.md` (17 ADRs como archivos separados)
- `README.md` del paquete

---

*Fin de SRS Sesión 3.7 — 17 mayo 2026*
