# Design Adaptation Plan — Claude Design JSX → Pandora ERP TSX

**Versión:** 1.0.0
**Fecha:** 2026-05-30
**Estado:** vigente
**Propósito:** mapping quirúrgico entre los 6 archivos JSX de Claude Design (estética CRM B2B) y la versión retail TSX modular que necesita Pandora ERP (sedería + rotisería + kiosko), conservando 100% de fidelidad visual y reemplazando 100% del dominio.

> Este doc cierra la **disonancia entre forma y contenido** detectada al leer los 6 archivos: la estética es excelente y se conserva, el dominio CRM (pipeline / deals / Velmont SA) se reemplaza por retail real (POS / stock / facturas / pedidos). El resultado debe verse idéntico al diseño actual cuando lo abre alguien que no sepa retail, y servir 100% a tu novia / amigo de la rotisería / kiosqueros cuando lo usen.

---

## 1. Filosofía de la adaptación

**Regla 1 — Estética sagrada.** Cada paleta, cada gradiente, cada sombra, cada radio, cada tipografía, cada animación intencional se preserva idéntica. El diseño que hizo Claude Design es trabajo serio y diferenciador real para Pandora.

**Regla 2 — Dominio reemplazado.** Cada texto en inglés/CRM/B2B se reemplaza por equivalente en español rioplatense / retail / B2C real. Cada KPI sin sentido para tu novia se reemplaza por uno que ella mire 20 veces por día. Cada panel cambia de contenido pero NO de molde.

**Regla 3 — Componentes técnicos al 100%.** Charts SVG, hooks de animación, TiltCard, iconos, LogoMark, Avatar — todos se portan tal cual de JSX a TSX. Sólo agregamos tipos.

**Regla 4 — Currency Argentina.** Todo monto en pesos argentinos con formato `es-AR`. Nada de US dollar formatting.

**Regla 5 — Sin AI/Chat F0.** El AIAssistantPanel sale (era over-engineering rejected). Su lugar se rellena con un panel del mismo molde para algo útil retail.

**Regla 6 — Sin fake live data.** El `useLiveTicker` con random increments sale. Lo que parece "live" debe ser live de verdad cuando llegue, o estático mientras tanto.

**Regla 7 — Animaciones intencionales sí, decorativas no.** count-up + growBar + draw-line se quedan (refuerzan datos). ParallaxSky on mousemove se vuelve opcional. Float-cards rotados se mantienen como impacto visual del Hero.

---

## 2. Inventario actual — qué tiene cada archivo

| Archivo | LOC | Qué contiene |
|---|---|---|
| `app.jsx` | 111 | Root + tweak defaults (accents purple/blue/teal, skies dawn/noon/dusk) + layout principal + sidebar + topbar + composición de paneles |
| `hooks.jsx` | 108 | `useCountUp` / `useLiveTicker` / `use3DTilt` / `TiltCard` / `fmt$` / `ParallaxSky` |
| `icons.jsx` | 75 | Set de ~38 iconos outline SVG + `LogoMark` + `Avatar` |
| `panels.jsx` | 721 | Sidebar + Topbar + SalesArt + Hero + 11 paneles de contenido (Revenue/ActiveClients/Efficiency/IncomeExpense/ProjectsOverview/TaskCompletion/Meetings/AIAssistant/QuickActions/RecentTransactions/InvoiceOverview/DateRangeRow) |
| `charts.jsx` | 257 | `SmoothLine` / `RoundedBars` / `DualLineChart` / `AnimatedDonut` (todo SVG puro) |
| `tweaks-panel.jsx` | 569 | Sistema de tweaks completo (TweaksPanel + Section + Slider + Toggle + Radio + Select + Text + Number + Color + Button + useTweaks hook) con protocolo postMessage para host externo |

**Total:** ~1,840 líneas de JSX + Babel browser + window globals. Migra a ~2,200 líneas TSX modular con tipos.

---

## 3. Tokens CSS a extraer (consolidar dispersos en variables)

**Estado actual:** los colores, skies, glass, motion están dispersos en `app.jsx`, `panels.jsx` y hardcoded en `style={{}}` inline en todos lados.

**Estado target:** todos los design tokens viven en `src/styles/tokens/` y se consumen vía CSS custom properties + Tailwind config.

### 3.1 Paletas accent (de `app.jsx` líneas 6-10)

```css
/* src/styles/tokens/colors.css */
:root {
  /* Accent — default purple */
  --accent-a: #6b5fff;
  --accent-b: #9088ff;
  --accent-soft: rgba(107, 95, 255, 0.1);

  /* Ink hierarchy (del CSS heredado del esqueleto previo) */
  --ink-0: #0d1424;
  --ink-1: #1f2a44;
  --ink-2: #4a5470;
  --ink-3: #7681a0;
  --ink-4: #bcc6e3;

  /* Estados semánticos */
  --success: #1a8e5a;
  --success-bg: rgba(52, 199, 125, 0.14);
  --warning: #f7984a;
  --danger: #ef5d6a;
  --info: #5b8cff;
}

[data-accent="blue"] {
  --accent-a: #5b8cff;
  --accent-b: #8eb0ff;
  --accent-soft: rgba(91, 140, 255, 0.1);
}

[data-accent="teal"] {
  --accent-a: #1ea8a0;
  --accent-b: #5fd5cc;
  --accent-soft: rgba(30, 168, 160, 0.1);
}
```

### 3.2 Skies (de `app.jsx` líneas 12-30)

```css
/* src/styles/tokens/sky.css */
.sky-dawn {
  background:
    radial-gradient(ellipse 60% 50% at 20% 90%, rgba(238, 200, 220, 0.55) 0%, transparent 60%),
    radial-gradient(ellipse 70% 60% at 85% 80%, rgba(240, 210, 180, 0.40) 0%, transparent 60%),
    radial-gradient(ellipse 50% 40% at 60% 30%, rgba(255, 255, 255, 0.6) 0%, transparent 50%),
    radial-gradient(ellipse 50% 40% at 15% 30%, rgba(195, 215, 245, 0.6) 0%, transparent 60%),
    linear-gradient(180deg, #b8c8e8 0%, #c8d4ea 25%, #e0d4e0 60%, #f0d8d2 100%);
}

.sky-noon { /* ... idéntico al jsx ... */ }
.sky-dusk { /* ... idéntico al jsx ... */ }
```

Por defecto: **Dawn** (alineado con ADR-0016 Dawn Sky identidad permanente).

### 3.3 Glass + motion + radius + spacing (heredan del esqueleto previo)

El esqueleto en `pandora-erp/src/styles/tokens/` ya tiene `colors.css`, `typography.css`, `spacing.css`, `motion.css`, `elevation.css`, `radius.css`. **Mantener esos** y agregar `sky.css` nuevo + actualizar `colors.css` con las variables `--accent-*`.

### 3.4 Tipografía mono para números

`tnum` class viene del JSX:

```css
.tnum {
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.02em;
}

.mono {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
}
```

Críticos para precios, montos, contadores.

---

## 4. Componentes técnicos — conservar 1:1 (port JSX → TSX directo)

Estos NO cambian semánticamente. Sólo agregamos tipos y los ponemos en módulos.

### 4.1 Hooks (`hooks.jsx` → `src/lib/hooks/`)

| JSX original | TSX destino | Cambios |
|---|---|---|
| `useCountUp(target, opts)` | `src/lib/hooks/useCountUp.ts` | Tipos + named export. **Conservar al 100%.** |
| `useLiveTicker(initial, increment)` | `src/lib/hooks/useLiveTicker.ts` | **NO USAR EN PRODUCCIÓN F0.** Mantener el código pero comentar uso. Es fake data. |
| `use3DTilt(max)` | `src/lib/hooks/use3DTilt.ts` | Tipos + opcional `respectsReducedMotion` que devuelve early si `prefers-reduced-motion: reduce`. |
| `ParallaxSky` (componente) | `src/components/atmosphere/ParallaxSky.tsx` | Tipos + opcional prop `enabled` (default true). En route `/pos` operativo se renderiza con `enabled={false}` para no distraer al cajero. |
| `fmt$` | **REEMPLAZAR** por `formatARS()` en `src/lib/format/currency.ts` (ver §10) | Cambio real, no port |
| `TiltCard` | `src/components/primitives/TiltCard.tsx` | Tipos + `respectsReducedMotion` integrado. Conservar sheen + glass. |

```typescript
// Ejemplo: src/lib/hooks/useCountUp.ts
interface UseCountUpOptions {
  duration?: number;
  decimals?: number;
  delay?: number;
}

export function useCountUp(target: number, options: UseCountUpOptions = {}): number {
  const { duration = 1400, decimals = 0, delay = 0 } = options;
  const [val, setVal] = useState(0);

  useEffect(() => {
    let raf: number;
    const start = performance.now() + delay;
    const tick = (now: number) => {
      if (now < start) { raf = requestAnimationFrame(tick); return; }
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(target * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, delay]);

  const factor = Math.pow(10, decimals);
  return Math.round(val * factor) / factor;
}
```

### 4.2 Charts (`charts.jsx` → `src/components/charts/`)

| JSX original | TSX destino | Cambios |
|---|---|---|
| `SmoothLine` | `src/components/charts/SmoothLine.tsx` | Tipos para `data: Array<{ label: string; v: number }>`. Conservar smooth bezier + highlight last + animation. |
| `RoundedBars` | `src/components/charts/RoundedBars.tsx` | Tipos. Conservar hover + tooltip negro + delay por barra. |
| `DualLineChart` | `src/components/charts/DualLineChart.tsx` | Tipos. Conservar crosshair + tooltip + grid punteada. |
| `AnimatedDonut` | `src/components/charts/AnimatedDonut.tsx` | Tipos. Conservar fill secuencial con delay 380ms entre segmentos. |

El esqueleto previo de `pandora-erp/src/components/charts/` ya tiene `SmoothLine.tsx`, `RoundedBars.tsx`, `DualLineChart.tsx`, `AnimatedDonut.tsx`. **Comparar y reemplazar con los nuevos si éstos son mejores.** Probablemente sí — los del esqueleto eran placeholders.

### 4.3 Iconos (`icons.jsx` → `src/components/primitives/`)

| JSX original | TSX destino | Cambios |
|---|---|---|
| `Icon` (componente con map de ~38 paths) | `src/components/primitives/Icon.tsx` | Tipos + union literal de `IconName`. **Conservar los 38 iconos.** **Agregar 7 nuevos para retail:** `barcode`, `cart`, `box`, `boxOpen`, `printer`, `qrcode`, `tag`. |
| `LogoMark` | `src/components/primitives/LogoMark.tsx` | Tipos. **Conservar al 100%** — gradient lila/azul + estrella pandórica. |
| `Avatar` | `src/components/primitives/Avatar.tsx` | Tipos. **Conservar al 100%.** |

```typescript
// src/components/primitives/Icon.tsx
type IconName =
  | 'dashboard' | 'insights' | 'accounts' | 'projects' | 'tasks' | 'time'
  | 'files' | 'invoices' | 'team' | 'clients' | 'integrations' | 'reports'
  | 'settings' | 'search' | 'bell' | 'inbox'
  | 'chevronDown' | 'chevronRight' | 'arrowUpRight' | 'arrowRight'
  | 'triUp' | 'triDown' | 'more' | 'sliders' | 'calendar' | 'sparkle'
  | 'plus' | 'send' | 'upload' | 'invoiceDoc' | 'receipt'
  | 'dollar' | 'expense' | 'pdf' | 'paperclip' | 'edit' | 'wave'
  // Retail-specific
  | 'barcode' | 'cart' | 'box' | 'boxOpen' | 'printer' | 'qrcode' | 'tag';

interface IconProps extends React.SVGProps<SVGSVGElement> {
  name: IconName;
  size?: number;
  stroke?: number;
}
```

---

## 5. Componentes shell — estructura igual, contenido distinto

### 5.1 Sidebar (`panels.jsx` líneas 2-46 → `src/components/shell/Sidebar.tsx`)

**Conservar 100%:**
- Glass strong background
- Logo row arriba
- Nav items con icon-box + label
- Active state con clase
- Bloque "Mejorá a Pro" abajo
- Fade-in animation

**Reemplazar al 100%:**
- `items` array → retail items

```typescript
const SIDEBAR_ITEMS: ReadonlyArray<{
  id: SidebarRoute;
  icon: IconName;
  label: string;
}> = [
  { id: 'dashboard',    icon: 'dashboard', label: 'Panel' },
  { id: 'pos',          icon: 'cart',      label: 'Vender' },
  { id: 'products',     icon: 'tag',       label: 'Productos' },
  { id: 'inventory',    icon: 'box',       label: 'Stock' },
  { id: 'cash',         icon: 'dollar',    label: 'Caja' },
  { id: 'invoices',     icon: 'invoices',  label: 'Facturas' },
  { id: 'orders',       icon: 'receipt',   label: 'Pedidos' },
  { id: 'customers',    icon: 'clients',   label: 'Clientes' },
  { id: 'reports',      icon: 'reports',   label: 'Reportes' },
  { id: 'employees',    icon: 'team',      label: 'Empleados' },
  { id: 'settings',     icon: 'settings',  label: 'Configuración' },
];
```

**Bloque "Mejorá a Pro" del JSX:**
- Si tenant está en `trial` → mostrar "Días restantes del trial: N. Activá tu plan."
- Si tenant `active` → ocultar.
- Si tenant `read_only` (post-trial sin pago) → mostrar "Trial expirado. Activá ya." con CTA prominente.

### 5.2 Topbar (`panels.jsx` líneas 49-93 → `src/components/shell/Topbar.tsx`)

**Conservar 100%:**
- Search input con icon + placeholder + kbd `⌘ K`
- Segmented buttons (Hoy / Semana / Mes / Reportes)
- Top tools: bell + inbox con badge + settings
- User chip con avatar-ring + nombre + role + live-dot

**Cambios mínimos:**
- Placeholder: `"Buscar deals, cuentas, contactos…"` → `"Buscar productos, clientes, facturas…"`
- User demo `Alberto Flores / Gerente` → real del session (`{user.name} / {user.role}`)
- Badge inbox `7` → contador real (alertas stock + facturas pendientes + pedidos)

### 5.3 Layout grid principal (`app.jsx` líneas 50-83 → `src/components/shell/Layout.tsx`)

**Conservar 100%:**
- `marginLeft: 240, marginRight: 16, padding: '16px 0 24px'` sidebar + main
- Right column 340px fixed
- Stagger class para fade-in en orden

**Cambios:**
- En route `/pos` (operativo) el layout cambia: sidebar colapsable + Hero ausente + grid distinto.
- En route `/dashboard` (vista panel) layout idéntico al JSX actual.

---

## 6. Paneles — mapping 1:1 (mismo molde, contenido retail)

**Regla:** cada panel del diseño se reemplaza por uno retail con **mismas dimensiones**, **mismas animaciones**, **mismos charts**. Sólo cambia qué métrica miden.

### 6.1 Hero (`panels.jsx` líneas 212-246 → `src/components/dashboard/Hero.tsx`)

| Aspecto | JSX actual | TSX retail |
|---|---|---|
| Saludo | "Buen día, Alberto 👋" | "Buen día, {firstName} 👋" ← OK como está |
| Headline | "Cerremos más ventas hoy." | **"Hoy es {fecha}.<br/>Caja abierta hace {Xh}m."** O alternativa: **"Buenos días.<br/>15 ventas hoy."** |
| Live block | "Facturación en vivo $73,558.42" (con useLiveTicker fake) | **"Vendido hoy: ${total_real_del_dia}"** SIN ticker fake. Actualización por evento real (nueva venta cerrada). |
| Delta "vs objetivo" | "+12.4%" | "vs ayer" con delta real del día anterior. |
| `SalesArt` (floating pipeline card $324,820 + chips) | Conservar el efecto visual + reemplazar contenido: "**Ventas última hora $X.XXX**" con barras de últimas 7 horas. Chip "Cerrado · Velmont $48.2k" → "**Venta · {producto top día} $X.XXX**". Chip AI "Helios al 94%" → **eliminar o reemplazar por "**Stock bajo: {X} productos**"**. |

### 6.2 RevenuePanel → VentasMesPanel

`panels.jsx` 249-274 → `src/components/dashboard/VentasMesPanel.tsx`

| Aspecto | JSX | TSX retail |
|---|---|---|
| Título | "Facturación total" | "Ventas del mes" |
| Big number | `$73,558.00` con `useCountUp` | `$X.XXX.XXX` con `useCountUp` (monto real ventas del mes) |
| Delta | "+12.4% vs mes anterior" | "+X.X% vs mes anterior" (cálculo real) |
| Chart | `SmoothLine` con 7 datapoints (Jan-Jul) | `SmoothLine` con últimos 7 meses (vienen del server con `currency: 'ARS'`) |
| Color | `#6b5fff` (purple accent) | Igual ✅ |

### 6.3 ActiveClientsPanel → ProductosVendidosPanel

`panels.jsx` 277-304 → `src/components/dashboard/ProductosVendidosPanel.tsx`

| Aspecto | JSX | TSX retail |
|---|---|---|
| Título | "Clientes activos" | "Productos vendidos" (mes) |
| Big number | `1,248` | unidades totales vendidas en el mes |
| Delta | "+8.3%" | delta real vs mes anterior |
| Chart | `RoundedBars` con 7 meses + hover + tooltip | Igual ✅, datos reales |

### 6.4 EfficiencyPanel → AlertaStockPanel

`panels.jsx` 307-337 → `src/components/dashboard/AlertaStockPanel.tsx`

**Razón del cambio:** "AI Pronóstico" sale (over-engineering rejected F0). Su espacio se aprovecha para algo crítico que tu novia tiene que ver TODOS LOS DÍAS: **alerta de productos en stock mínimo**.

| Aspecto | JSX | TSX retail |
|---|---|---|
| Título | "AI · Pronóstico" con sparkle | "Stock crítico" con icon `boxOpen` |
| Texto principal | "Este trimestre vas en camino a superar tu objetivo en un 27%" | **"{N} productos por debajo del mínimo. Reponé esta semana."** |
| Wave decorativa (3 paths SVG lila) | **Mantener** (es decoración, queda lindo) |
| Color accent | Lila | Cambiar a `--warning` (#f7984a) — semánticamente correcto para alerta |
| CTA | `arrowUpRight` → "Ver pronóstico" | `arrowUpRight` → linkea a `/inventory?filter=below_min` |

### 6.5 IncomeExpensePanel → VentasVsCostosPanel

`panels.jsx` 340-388 → `src/components/dashboard/VentasVsCostosPanel.tsx`

| Aspecto | JSX | TSX retail |
|---|---|---|
| Título | "Ingresos vs Gastos" | "Ventas vs Costos" |
| Leyenda | "Ingresos / Gastos" con #5b8cff / #f7984a | Igual ✅ con "Ventas / Costos" |
| Chart `DualLineChart` | 7 meses Jan-Jul con crosshair interactivo | Igual ✅, datos reales (ventas - costo mercadería) |
| Bottom split | "Ingresos / Gastos del mes seleccionado" | Igual ✅ con monto + delta |
| Colors | `colorA="#5b8cff" colorB="#f7984a"` | Igual ✅ |

### 6.6 ProjectsOverviewPanel → EstadoStockPanel

`panels.jsx` 391-431 → `src/components/dashboard/EstadoStockPanel.tsx`

| Aspecto | JSX | TSX retail |
|---|---|---|
| Título | "Etapas del pipeline" | "Estado del stock" |
| Items donut | "En curso 14 / Cerrados 32 / Sin iniciar 54" | **"Stock crítico {N} / Stock medio {N} / Stock OK {N}"** |
| Colors | naranja / lila / gris | rojo `#ef5d6a` / naranja `#f7984a` / verde `#34c77d` (semántica retail) |
| Total bottom | "Total deals" | "Total productos" |
| Chart | `AnimatedDonut` con fill secuencial | Igual ✅ |

### 6.7 TaskCompletionPanel → CierreCajaPanel

`panels.jsx` 434-480 → `src/components/dashboard/CierreCajaPanel.tsx`

**Razón del cambio:** "Tareas completadas" no aplica a retail. En su lugar, panel de **cierre de caja del día** — uno de los momentos más estresantes según lo que validamos (control anti-robo).

| Aspecto | JSX | TSX retail |
|---|---|---|
| Título | "Tareas completadas" | "Cierre de caja — hoy" |
| Big number | "68.4%" con count-up | **"$X.XXX.XXX"** total esperado en caja con count-up |
| Delta | "+6.1% vs mes anterior" | "**OK / Descuadre $X**" con color condicional verde/rojo |
| Progress bar 3 segmentos (gradient lila→azul) | Conservar visual. 3 segmentos = **Efectivo / Tarjeta / MercadoPago QR** con su monto |
| Bottom grid 3 columnas | Completadas / En curso / Sin iniciar | **Efectivo / Tarjeta / MP QR** con monto count-up cada uno |
| Color | lila gradiente | Conservar lila gradient ✅ |

### 6.8 RecentTransactionsPanel → VentasRecientesPanel

`panels.jsx` 652-679 → `src/components/dashboard/VentasRecientesPanel.tsx`

| Aspecto | JSX | TSX retail |
|---|---|---|
| Título | "Deals recientes" | "Ventas recientes" |
| Rows | "Velmont SA · 17 may · +$48,200" + iconos colores | "**Venta #00125 · 14:30 · $4.250**" + iniciales de cajero + monto |
| Positive/negative | "+$X" verde / "-$X" gris | Solo positivos (todas son ventas). Si querés mostrar devoluciones, las podemos diferenciar con NC. |
| Currency | US `$` | ARS `$` con `formatARS()` |

### 6.9 InvoiceOverviewPanel → FacturasEstadoPanel

`panels.jsx` 682-712 → `src/components/dashboard/FacturasEstadoPanel.tsx`

| Aspecto | JSX | TSX retail |
|---|---|---|
| Título | "Estado de facturas" | Igual ✅ — ya está bien |
| Filas | "Vencidas / Sin pagar / Parciales / Pagadas" | **"Pendientes CAE / Rechazadas AFIP / Emitidas / Anuladas"** ← más relevante para retail con AFIP |
| Colors | lila / rojo / naranja / verde | Igual ✅ |
| Counts + amounts | Datos hardcoded | Datos reales del server |
| Bars `growBar` animation | Conservar ✅ |

### 6.10 MeetingsPanel → PedidosHoyPanel

`panels.jsx` 499-543 → `src/components/dashboard/PedidosHoyPanel.tsx`

**Razón del cambio:** "Mis reuniones" no aplica a retail. Reemplazo perfecto: **pedidos custom del día** — feature crítica para mercería y rotisería.

| Aspecto | JSX | TSX retail |
|---|---|---|
| Título | "Mis reuniones" | "Pedidos para hoy" |
| Rows | "Descubrimiento Velmont · 18:45 – 19:30 · 3 avatars" | **"Pedido #PE042 · {cliente nombre} · retira 17:30 · 3 items"** |
| Avatar stack | 3 avatars + count "+N" | Avatar del cliente que pidió. Si es anónimo, iniciales. |
| Color avatars | Multi gradient | Igual ✅ |
| "Ver todas" link | → `/orders` |

### 6.11 AIAssistantPanel → AccionesRapidasOperativas (REEMPLAZO TOTAL)

`panels.jsx` 546-623 → `src/components/dashboard/AccionesRapidasOperativasPanel.tsx`

**Razón del cambio:** Asistente IA con chat + typing dots = **cortado** (over-engineering rejected F0, sin uso comprobado, agrega complejidad). En su lugar, un panel del **mismo tamaño** con accesos directos críticos del día.

| Aspecto | JSX | TSX retail |
|---|---|---|
| Título | "Asistente IA" con sparkle | "Operaciones del día" con `wave` icon |
| Chat bubble usuario | "¿Qué deal debería priorizar hoy?" | **Cortar** |
| Chat bubble bot con typing dots | "El pipeline de Velmont aceleró..." | **Cortar** |
| Input "Preguntá lo que quieras" | Input "..." + botón send | **Cortar** |
| Reemplazo: bloque visual con 4 botones grandes | — | **Abrir caja / Cierre rápido / Imprimir último ticket / Nueva NC** ← acciones inmediatas |

Alternativa si querés conservar la estética chat / texto: **panel "Notas del día"** con bloc para que tu novia anote lo que le quedó pendiente (proveedor X llamó, falta ese hilo Z, cliente W retira mañana). Más útil que IA + decora bien.

### 6.12 QuickActionsPanel → QuickActionsRetail

`panels.jsx` 625-650 → `src/components/dashboard/QuickActionsRetail.tsx`

**Conservar visual al 100%.** Cambiar acciones:

| JSX actual | TSX retail |
|---|---|
| "Nuevo deal" + invoiceDoc + lila | **"Nueva venta"** + `cart` + lila |
| "Agregar contacto" + dollar + naranja | **"Cargar producto"** + `tag` + naranja |
| "Nueva tarea" + tasks + verde | **"Nuevo pedido"** + `receipt` + verde |
| "Subir archivo" + upload + azul | **"Importar catálogo CSV"** + `upload` + azul |

### 6.13 DateRangeRow

`panels.jsx` 483-497 → `src/components/dashboard/DateRangeRow.tsx`

**Conservar al 100%.** Sólo cambiar contenido:

- "1 – 18 de mayo" → date picker real con `es-AR` locale
- "Todas las cuentas" → "Todos los rubros" si multi-rubro, o "Sucursal principal" si single-store

---

## 7. SalesArt del Hero — adaptación cuidadosa

`panels.jsx` 96-209. **Este es el wow visual del dashboard** — float-cards rotados con sun halo. **Conservar al 100% el efecto, reemplazar contenido.**

### 7.1 Sun halo (líneas 102-110)

**Conservar 100%.** Decoración pura.

### 7.2 Pipeline card central (líneas 111-162)

| Aspecto | JSX | TSX retail |
|---|---|---|
| Label upper | "Pipeline · mayo" | **"Ventas · {nombre del mes}"** |
| Big number | "$324,820" | Total ventas del mes en ARS con `formatARS()` |
| Badge delta | "↑ 18.4%" verde | Delta real vs mes anterior |
| Growing bars | 7 barras animadas (delays 600 + i*90ms) | Conservar visual. Datos: ventas de últimas 7 semanas. |
| Avatar stack | CR/DA/MC | Iniciales de cajeros del mes |
| Bottom right | "34 deals" | "**X ventas**" con número real |

### 7.3 Notification chip top (líneas 165-185)

| Aspecto | JSX | TSX retail |
|---|---|---|
| Check icon verde | Conservar ✅ |
| Label upper | "Cerrado" | **"Última venta"** |
| Big text | "Velmont · $48.2k" | **"{ticket más reciente} · ${monto}"** |

### 7.4 AI chip bottom (líneas 188-207)

| Aspecto | JSX | TSX retail |
|---|---|---|
| Sparkle icon en gradient lila | **Eliminar el "AI"** (over-engineering rejected). |
| Texto "Helios al 94% de cerrar" | **Reemplazo:** sparkle icon verde + **"Stock OK"** con tildecito O `box` icon naranja + **"3 productos bajos"** (rota cada 4 segundos entre estados). |

---

## 8. Animaciones — qué se mantiene, reduce o corta

| Animación | Origen | Decisión | Razón |
|---|---|---|---|
| `useCountUp` | hooks.jsx | **Mantener** | Sutil, 1.4s una vez, refuerza dato |
| `useLiveTicker` | hooks.jsx | **Cortar de uso** (mantener el código por si F1+ con realtime real) | Random fake increments confunden y consumen |
| `use3DTilt` | hooks.jsx | **Reducir intensidad de 4 a 2** + respetar `prefers-reduced-motion` | Tilt fuerte distrae en POS operativo |
| `ParallaxSky` mousemove | hooks.jsx | **Habilitar sólo en `/dashboard`. Disable en `/pos`** | En tablet touch no aplica y distrae al cajero |
| `growBar` (barras crecen al mount) | CSS keyframes | **Mantener** | Sutil, 900ms una vez |
| `draw-line` + `reveal-area` (charts) | CSS keyframes | **Mantener** | Excelente primera impresión, no se repite |
| `fadeUp` (tooltips) | CSS keyframes | **Mantener** | Standard, esperable |
| Float-cards rotación + transform | inline styles | **Mantener** | Impacto visual del Hero |
| AI typing dots + chat | panels.jsx AIAssistant | **Cortar entero** | Componente eliminado |
| `liveRing` cursor blink | panels.jsx | **Cortar** (sale con AIAssistant) | — |
| Sheen on TiltCard hover | hooks.jsx | **Mantener** | Premium feel sutil |
| Tweaks panel drag + animations | tweaks-panel.jsx | **Mantener** (es dev tool) | No interfiere con prod |

---

## 9. TweaksPanel — decisión

**El panel actual** (569 líneas) usa `window.parent.postMessage` con protocolo `__activate_edit_mode` / `__deactivate_edit_mode` — viene del entorno de **Claude artifacts**, NO funciona standalone en una app Next.js sin un host externo.

### Decisión: Dev Tool oculto

**Conservar el panel + sus controles** (TweakSection, TweakRadio, TweakColor, TweakSlider, TweakToggle) pero:

1. **Remover el protocolo postMessage al host externo.** El estado se guarda en `localStorage` directamente.
2. **Reemplazar el trigger de apertura.** En vez de mensaje del host, abrirse con keyboard shortcut `Ctrl+Shift+T` (sólo en `NODE_ENV=development`).
3. **NO renderizarse en producción.** Tree-shaking + condicional `if (process.env.NODE_ENV !== 'development') return null`.

Esto te da:
- ✅ Refinamiento visual en vivo durante desarrollo (cambiar accent + sky sin recompile)
- ✅ No expone configuración al usuario final
- ✅ Cero overhead en bundle de producción

### Tokens vivos via TweaksPanel

Sólo los siguientes tokens son ajustables vía TweaksPanel en dev:

```typescript
interface DevTweaks {
  accent: 'purple' | 'blue' | 'teal';
  sky: 'dawn' | 'noon' | 'dusk';
  glassOpacity: number;  // 0.5 - 0.9
  density: 'compact' | 'comfortable';
  reducedMotion: boolean;  // override para probar con/sin animaciones
}
```

El TweakColor con palettes custom + TweakNumber con scrub se mantienen como componentes utility pero no se usan en F0.

---

## 10. Currency formatter — reemplazar `fmt$` por `formatARS`

`hooks.jsx` línea 67-70:

```javascript
// JSX actual
const fmt$ = (n, decimals = 2) => '$' + n.toLocaleString('en-US', {
  minimumFractionDigits: decimals,
  maximumFractionDigits: decimals,
});
```

**Reemplazar por** `src/lib/format/currency.ts`:

```typescript
const ARS_FORMATTER = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const ARS_FORMATTER_NO_DECIMALS = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export function formatARS(amount: number, options: { decimals?: boolean } = {}): string {
  const { decimals = true } = options;
  if (Number.isNaN(amount) || !Number.isFinite(amount)) return '—';
  return decimals ? ARS_FORMATTER.format(amount) : ARS_FORMATTER_NO_DECIMALS.format(amount);
}

// Para Decimal.js (path money real server-side) ver MONEY-POLICY.md
```

**Reemplazos en cada panel:**

```typescript
// Antes (JSX)
{fmt$(73558.42)}  // → "$73,558.42"

// Después (TSX)
{formatARS(73558.42)}  // → "$73.558,42"
```

---

## 11. Plan de port JSX → TSX (estructura de carpetas)

### 11.1 Carpetas destino en `pandora-erp/src/`

```
src/
├── app/
│   ├── (dashboard)/
│   │   ├── page.tsx              ← Panel principal (usa Hero + paneles)
│   │   ├── layout.tsx
│   │   └── loading.tsx
│   ├── pos/
│   │   ├── page.tsx              ← Pantalla operativa POS (otro layout)
│   │   └── layout.tsx
│   ├── products/page.tsx
│   ├── inventory/page.tsx
│   ├── cash/page.tsx
│   ├── invoices/page.tsx
│   ├── orders/page.tsx
│   ├── customers/page.tsx
│   ├── reports/page.tsx
│   ├── employees/page.tsx
│   └── settings/page.tsx
├── components/
│   ├── primitives/
│   │   ├── Icon.tsx              ← del icons.jsx
│   │   ├── LogoMark.tsx          ← del icons.jsx
│   │   ├── Avatar.tsx            ← del icons.jsx
│   │   └── TiltCard.tsx          ← del hooks.jsx
│   ├── shell/
│   │   ├── Sidebar.tsx           ← del panels.jsx
│   │   ├── Topbar.tsx            ← del panels.jsx
│   │   ├── Layout.tsx
│   │   └── UserChip.tsx
│   ├── atmosphere/
│   │   ├── ParallaxSky.tsx       ← del hooks.jsx
│   │   ├── SkyBackground.tsx     ← nuevo, wraps sky variants
│   │   └── Sheen.tsx
│   ├── charts/
│   │   ├── SmoothLine.tsx        ← del charts.jsx
│   │   ├── RoundedBars.tsx       ← del charts.jsx
│   │   ├── DualLineChart.tsx     ← del charts.jsx
│   │   └── AnimatedDonut.tsx     ← del charts.jsx
│   ├── dashboard/
│   │   ├── Hero.tsx              ← del panels.jsx (mapped retail)
│   │   ├── HeroArt.tsx           ← del SalesArt del panels.jsx
│   │   ├── VentasMesPanel.tsx
│   │   ├── ProductosVendidosPanel.tsx
│   │   ├── AlertaStockPanel.tsx
│   │   ├── VentasVsCostosPanel.tsx
│   │   ├── EstadoStockPanel.tsx
│   │   ├── CierreCajaPanel.tsx
│   │   ├── VentasRecientesPanel.tsx
│   │   ├── FacturasEstadoPanel.tsx
│   │   ├── PedidosHoyPanel.tsx
│   │   ├── AccionesRapidasOperativasPanel.tsx
│   │   ├── QuickActionsRetail.tsx
│   │   └── DateRangeRow.tsx
│   └── dev/
│       └── TweaksPanel.tsx       ← solo en dev, oculto
├── lib/
│   ├── hooks/
│   │   ├── useCountUp.ts         ← del hooks.jsx
│   │   ├── useLiveTicker.ts      ← del hooks.jsx (no usar en F0)
│   │   ├── use3DTilt.ts          ← del hooks.jsx
│   │   ├── useReducedMotion.ts   ← nuevo (estándar)
│   │   └── useTweaks.ts          ← del tweaks-panel.jsx (solo dev)
│   ├── format/
│   │   ├── currency.ts           ← formatARS (reemplaza fmt$)
│   │   ├── date.ts               ← formatARDate
│   │   └── number.ts             ← formatNumber
│   └── ...
└── styles/
    ├── globals.css
    ├── tokens/
    │   ├── colors.css            ← extended con accents lila/blue/teal
    │   ├── typography.css
    │   ├── spacing.css
    │   ├── motion.css
    │   ├── elevation.css
    │   ├── radius.css
    │   └── sky.css               ← nuevo: dawn / noon / dusk
    └── components/
        ├── glass-card.css
        ├── tilt-card.css
        ├── sidebar.css
        └── ...
```

### 11.2 Orden de migración (sprint 0 del re-roadmap retail)

| Paso | Acción | Validación |
|---|---|---|
| 1 | Crear `tokens/colors.css` + `tokens/sky.css` con todos los valores extraídos | Compile + dawn sky renderiza igual |
| 2 | Migrar `primitives/Icon.tsx` + `LogoMark.tsx` + `Avatar.tsx` | Storybook visual side-by-side con JSX original |
| 3 | Migrar `hooks/useCountUp.ts` + `use3DTilt.ts` + `useReducedMotion.ts` | Test unitario: countUp llega a target en N ms |
| 4 | Migrar `primitives/TiltCard.tsx` + `atmosphere/ParallaxSky.tsx` | Visual diff: hover tilt + sky background |
| 5 | Migrar 4 charts SVG (`SmoothLine` + `RoundedBars` + `DualLineChart` + `AnimatedDonut`) | Visual diff con datos hardcoded del JSX |
| 6 | Migrar shell: `Sidebar.tsx` con items retail + `Topbar.tsx` + `Layout.tsx` | Visual diff del shell (sin paneles aún) |
| 7 | Migrar Hero con SalesArt adaptado a retail | Visual diff + valida números reales en cache si hay |
| 8 | Migrar 11 paneles de dashboard uno por uno (orden por importancia: VentasMes → AlertaStock → CierreCaja → ...) | Visual diff + lógica de cada panel |
| 9 | Migrar `TweaksPanel.tsx` con localStorage en lugar de postMessage | Dev tool funciona con `Ctrl+Shift+T` en dev |
| 10 | Wire data layer: cada panel recibe data via Server Component → cliente | Funcional end-to-end con DB Drizzle |

Estimado: **2-3 semanas para migración completa con visual fidelity al 100%**, sin todavía empezar features de negocio (POS, AFIP, etc).

---

## 12. Anti-patterns durante la migración

| Anti-pattern | Por qué malo | Qué hacer |
|---|---|---|
| Rehacer la estética "porque no me convence ahora" | El diseño ya fue aprobado. Rehacer = revisión infinita | Migración fiel primero. Refinamientos post-validación con usuaria real. |
| Saltarse `useReducedMotion` | Personas con vértigo / ansiedad ven mareo | Implementar de entrada, no de retro. |
| Mezclar TSX migrado con JSX legacy | Inconsistencia + duplicación | Migrar paquete completo antes de mergear |
| Borrar los `.jsx` antes de tener TSX equivalente | Pérdida de referencia visual | Mantener los `.jsx` en `c:\Users\Pandora\Desktop\SRS\` como referencia hasta que TSX equivalente esté validado |
| Cambiar la paleta durante la migración | "Mientras estamos, probemos otra paleta" | NO. La paleta es decisión cerrada (ADR-0016 Dawn Sky). Cambios futuros con ADR nuevo. |
| Animaciones nuevas durante la migración | Inflación de motion | Lista cerrada. Cualquier animación nueva = decisión separada. |
| Tipos `any` durante el port | Pérdida de seguridad estática | Tipar cada hook + cada componente |
| Olvidar `formatARS` en algún panel | Display de moneda inconsistente | Lint rule `forbid 'en-US' currency` + grep audit pre-commit |
| Conservar el "Asistente IA" "porque queda lindo" | Es over-engineering rejected | Cortar. Reemplazar por panel útil del mismo molde. |
| Conservar `useLiveTicker` con fake data | El usuario lo nota y baja la confianza | Cortar uso. Mantener código por si F1+. |

---

## 13. Validación post-migración

Para declarar la migración "completa":

- [ ] Cada panel del JSX tiene equivalente TSX retail funcionando
- [ ] Visual diff side-by-side: forma idéntica, contenido retail
- [ ] `useReducedMotion` respetado en todos los componentes con animación
- [ ] Cero `style={{}}` hardcoded en TSX (todos via Tailwind + tokens)
- [ ] Cero `'en-US'` en formatters
- [ ] `Ctrl+Shift+T` abre TweaksPanel en dev, no aparece en prod build
- [ ] Iconos retail (`barcode`, `cart`, `box`, etc) agregados
- [ ] Sidebar items en español rioplatense + orden retail
- [ ] Currency render `$X.XXX,XX` (formato AR)
- [ ] Date render con `es-AR` locale
- [ ] Sky default = `dawn`
- [ ] Accent default = `purple` (lila)
- [ ] Sin `AIAssistant`, sin `MeetingsPanel` (reemplazados)
- [ ] Charts SVG idénticos al JSX original
- [ ] Glass + sheen + tilt funcionan
- [ ] ParallaxSky enabled en `/dashboard`, disabled en `/pos`
- [ ] Build de producción NO incluye TweaksPanel

---

## 14. Cross-references

- [CLAUDE.md §14](CLAUDE.md) — UI/UX Constitution (3 atmospheres, Dawn Sky, charts SVG, motion presets, density)
- [ADR-0012](files/ADR-0012-sistema-3-atmospheres.md) — sistema 3 atmospheres
- [ADR-0013](files/ADR-0013-glass-system-degradacion.md) — glass con degradación
- [ADR-0014](files/ADR-0014-charts-svg-puro.md) — charts SVG puros (este plan lo cumple)
- [ADR-0015](files/ADR-0015-motion-presets-nombrados.md) — motion presets
- [ADR-0016](files/ADR-0016-dawn-sky-identidad-permanente.md) — Dawn Sky permanente
- [ADR-0017](files/ADR-0017-density-obligatoria-atmosphere.md) — density obligatoria
- [master-audit-2026-05-28](../../memory/master-audit-2026-05-28.md) — auditor recomendó simplificar (este plan respeta ese consejo manteniendo lo valioso)
- 6 archivos JSX origen: [app.jsx](app.jsx) · [hooks.jsx](hooks.jsx) · [icons.jsx](icons.jsx) · [panels.jsx](panels.jsx) · [charts.jsx](charts.jsx) · [tweaks-panel.jsx](tweaks-panel.jsx)
- Esqueleto destino: [pandora-erp/src/](pandora-erp/src/)

---

## 15. Próximo paso lógico

Cuando vuelvas con P1 (validación mercado) cerrado y P2 (contador + abogado) agendados, esta migración entra en Sprint 0 (re-ordenado):

1. Setup técnico repo WSL (Drizzle schema base + auth + env.ts)
2. **Migrar 6 .jsx → TSX** según este plan (2-3 semanas)
3. Wire data layer real (Server Components + Drizzle queries)
4. AFIP integration (Sprint posterior, requiere respuestas contador)
5. POS funcional para tu novia (Sprint posterior)

Sin este plan en mano, la migración corre riesgo de drift visual y de perder horas en decisiones que ya están tomadas.

---

*Documento creado 2026-05-30. Migración estimada: 2-3 semanas tras validación P1. Output esperado: 6 archivos .jsx archivados como referencia + estructura TSX modular en `pandora-erp/src/` con fidelidad visual al 100% y dominio retail al 100%.*
