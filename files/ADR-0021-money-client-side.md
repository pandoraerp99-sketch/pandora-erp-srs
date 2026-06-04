# ADR-0021 — Money client-side con Decimal.js

**Fecha:** 2026-05-26
**Estado:** Aprobado
**Relacionado con:** ADR-0005 (money server / redondeo 🟡), ADR-0001 (stack), ADR-0019 (security baseline)
**Reemplaza:** Versión anterior de ADR-0020 (que mezclaba 4 concerns — D2/D3/D4 diferidos a F1+, ver Apéndice)

## Contexto

ADR-0005 define `numeric(19,4)` + `Decimal.js` en server. El gap es el cliente: el carrito en React calcula subtotales, descuentos, IVA y totales en el browser antes de mandar el payload al server. Si el cliente usa `number` nativo (IEEE 754) hay drift de centavos:

```
0.1 + 0.2 === 0.30000000000000004
1.005 * 100 === 100.49999999999999
```

En un POS fiscal, una diferencia de $0.01 entre lo que muestra el cliente y lo que calcula el server genera confusión del cajero, descuadre de turno, y potencial discrepancia con el comprobante AFIP. ADR-0005 cubre la DB; este ADR cierra el ciclo en cliente.

## Decisión

**Toda operación aritmética monetaria en cliente usa `Decimal.js`. `number` nativo está prohibido para money. Política de redondeo se inyecta desde server vía Context, no se lee de env en cliente.**

### Implementación

```typescript
// src/lib/money/round.shared.ts
// Universal: cliente y servidor pueden importarlo.

import Decimal from 'decimal.js';

export type RoundingPolicy = 'HALF_UP' | 'HALF_DOWN' | 'HALF_EVEN';

// MoneyInput intencionalmente NO acepta number — fuerza al caller a pasar
// string o Decimal explícitamente. Si tenés un number, convertilo con
// unsafeDecimalFromNumber() para hacer el riesgo visible.
export type MoneyInput = string | Decimal;

const DECIMAL_ROUNDING_MODES: Readonly<Record<RoundingPolicy, Decimal.Rounding>> = Object.freeze({
  HALF_UP: Decimal.ROUND_HALF_UP,
  HALF_DOWN: Decimal.ROUND_HALF_DOWN,
  HALF_EVEN: Decimal.ROUND_HALF_EVEN,
});

// FIX prototype pollution: Object.prototype.hasOwnProperty.call, NO `in`.
function isValidPolicy(value: unknown): value is RoundingPolicy {
  if (typeof value !== 'string') return false;
  return Object.prototype.hasOwnProperty.call(DECIMAL_ROUNDING_MODES, value);
}

function assertValidMoneyInput(value: unknown): asserts value is MoneyInput {
  if (value instanceof Decimal) return;
  if (typeof value === 'string') return;
  if (typeof value === 'number') {
    throw new TypeError(
      `Cannot use number ${value} as MoneyInput — propagates IEEE 754 bug. ` +
      `Use unsafeDecimalFromNumber() upstream or pass as string.`
    );
  }
  throw new TypeError(`Invalid MoneyInput type: ${typeof value}`);
}

export function roundFiscal(
  value: MoneyInput,
  decimals: number,
  policy: RoundingPolicy
): Decimal {
  assertValidMoneyInput(value);
  if (!isValidPolicy(policy)) {
    throw new Error(
      `Rounding policy "${policy}" is invalid. ` +
      `Valid: ${Object.keys(DECIMAL_ROUNDING_MODES).join(' | ')}`
    );
  }
  return new Decimal(value).toDecimalPlaces(decimals, DECIMAL_ROUNDING_MODES[policy]);
}

export function unsafeDecimalFromNumber(n: number): Decimal {
  if (!Number.isFinite(n)) {
    throw new Error(`Cannot convert non-finite number to Decimal: ${n}`);
  }
  return new Decimal(String(n));
}

export { DECIMAL_ROUNDING_MODES };
```

```typescript
// src/lib/money/round.server.ts
// Server-only — lee env. NO importar desde cliente.

import 'server-only';
import {
  roundFiscal,
  type RoundingPolicy,
  type MoneyInput,
  DECIMAL_ROUNDING_MODES,
} from './round.shared';

let cachedPolicy: RoundingPolicy | null = null;

export function getRoundingPolicyFromEnv(): RoundingPolicy {
  if (cachedPolicy !== null) return cachedPolicy;
  const policy = process.env.MONEY_ROUNDING_POLICY;
  if (!policy) {
    throw new Error(
      'MONEY_ROUNDING_POLICY env var is required. ' +
      'Valid: HALF_UP | HALF_DOWN | HALF_EVEN. ' +
      'Fiscal decision — must be explicit per environment. See ADR-0005.'
    );
  }
  if (!Object.prototype.hasOwnProperty.call(DECIMAL_ROUNDING_MODES, policy)) {
    throw new Error(`MONEY_ROUNDING_POLICY="${policy}" is invalid.`);
  }
  cachedPolicy = policy as RoundingPolicy;
  return cachedPolicy;
}

export function roundFiscalFromEnv(value: MoneyInput, decimals: number = 2) {
  return roundFiscal(value, decimals, getRoundingPolicyFromEnv());
}

export { roundFiscal };
export type { RoundingPolicy, MoneyInput };

// Test helper
export function _resetCachedPolicyForTesting(): void {
  cachedPolicy = null;
}
```

### Inyección de policy server → client

`MONEY_ROUNDING_POLICY` es server-only (sin prefijo `NEXT_PUBLIC_`, intencional para no exponer decisiones fiscales al bundle del browser). El cliente la recibe vía React Context, poblado en el layout raíz:

```tsx
// src/app/layout.tsx (Server Component)
import { RoundingPolicyProvider } from '@/lib/money/rounding-policy-context';
import { getRoundingPolicyFromEnv } from '@/lib/money/round.server';

export default function RootLayout({ children }) {
  // Fail-fast aquí: si no hay env, la app no arranca en producción.
  const policy = getRoundingPolicyFromEnv();
  return (
    <html lang="es">
      <body>
        <RoundingPolicyProvider value={policy}>{children}</RoundingPolicyProvider>
      </body>
    </html>
  );
}
```

```tsx
// src/lib/money/rounding-policy-context.tsx
'use client';

import { createContext, useContext } from 'react';
import type { RoundingPolicy } from './round.shared';

const Ctx = createContext<RoundingPolicy | null>(null);
export const RoundingPolicyProvider = Ctx.Provider;

export function useRoundingPolicy(): RoundingPolicy {
  const policy = useContext(Ctx);
  if (!policy) {
    throw new Error(
      'useRoundingPolicy must be inside RoundingPolicyProvider. ' +
      'Check that the tree descends from RootLayout.'
    );
  }
  return policy;
}
```

### Authority de cálculos monetarios

| Layer | Calcula | Autoridad fiscal |
|---|---|---|
| Cliente preview UI | Total carrito en vivo | **NO** |
| Cliente submit | Manda items + cantidades + precios (strings) | **NO** |
| Server Action | Recalcula desde DB precios + items | **SÍ** |
| DB persistencia | `numeric(19,4)` | (fuente de verdad) |
| Payload AFIP | Redondeo final con `roundFiscalFromEnv` | (formato presentación) |

**Regla absoluta:** server NUNCA confía en totales del cliente. Anti price-tampering del ADR-0019.

### `precision: 30` global

Default Decimal.js es 20 dígitos significativos. Carritos con percepciones encadenadas (IVA 21% + IIBB + RG 2126) pueden agotar 20 dígitos en cálculos intermedios antes de redondear. Subir a 30 da margen para ~5000 líneas con 5 niveles de impuesto sin perder centavo.

**NO configuramos `rounding` global.** Cada llamada a `roundFiscal()` pasa policy explícita. Eso evita cerrar ADR-0005 (🟡 pendiente contador) por omisión.

```typescript
// src/lib/money/client.ts
'use client';
import Decimal from 'decimal.js';

Decimal.set({ precision: 30 });
// NO se configura `rounding` global — política viene de Context.
```

## Tests obligatorios

```typescript
// tests/unit/money/round.test.ts
describe('CRÍTICO: bug IEEE 754', () => {
  it('1.005 con HALF_UP → 1.01', () => {
    expect(roundFiscal('1.005', 2, 'HALF_UP').toString()).toBe('1.01');
  });
  it('1.005 con HALF_DOWN → 0', () => {
    expect(roundFiscal('1.005', 2, 'HALF_DOWN').toString()).toBe('1');
  });
});

describe('Runtime guard contra number', () => {
  it('rechaza number aunque TS lo permita por cast', () => {
    expect(() => roundFiscal(1.005 as any, 2, 'HALF_UP'))
      .toThrow(/Cannot use number/);
  });
});

describe('Prototype pollution en isValidPolicy', () => {
  it('rechaza "toString", "constructor", "__proto__"', () => {
    expect(() => roundFiscal('1.005', 2, 'toString' as any)).toThrow();
    expect(() => roundFiscal('1.005', 2, 'constructor' as any)).toThrow();
    expect(() => roundFiscal('1.005', 2, '__proto__' as any)).toThrow();
  });
});

describe('Fail-fast en env', () => {
  beforeEach(() => delete process.env.MONEY_ROUNDING_POLICY);
  it('throw si env no seteada', async () => {
    const { roundFiscalFromEnv, _resetCachedPolicyForTesting } =
      await import('@/lib/money/round.server');
    _resetCachedPolicyForTesting();
    expect(() => roundFiscalFromEnv('1.005', 2)).toThrow(/env var is required/);
  });
});
```

Property-based con fast-check para invariantes (commutatividad, identidad de descuento 0%, etc.) se agrega en la implementación.

## `.env.example`

```bash
# Política de redondeo fiscal — REQUERIDO, sin default.
# Si dejás esta línea vacía, la app NO arranca (fail-fast).
# Valores: HALF_UP | HALF_DOWN | HALF_EVEN
# 🔴 DECISIÓN FISCAL: validar con contador matriculado antes de producción.
# Ver ADR-0005 + reunion-contador-y-abogado.md (Parte A).
MONEY_ROUNDING_POLICY=
```

## Alternativas rechazadas

- **`big.js` (6KB)** en vez de Decimal.js (~30KB): rechazado porque ya hay precedente con Decimal.js en server (ADR-0005). Si bundle size se vuelve issue, evaluar entonces.
- **MoneyString como branded type `string & { __brand }`**: defer F1. Decimal.js + tipos TS estrictos + Zod en boundaries de API alcanza. Agregar brand cuando aparezca caso real de string malformado en runtime.
- **`number | string | Decimal` como input**: rechazado. Aceptar number invita al bug IEEE 754 implícito. Mejor forzar al caller a hacerlo visible con `unsafeDecimalFromNumber()`.
- **Hardcodear `Decimal.set({ rounding: ROUND_HALF_UP })` global**: rechazado. Cierra ADR-0005 silenciosamente. Política se inyecta por Context desde env server-side.

## Consecuencias

**Positivas:**
- Cliente y server calculan idéntico (Decimal.js + misma policy).
- Cero drift de centavos visible al cajero.
- ADR-0005 cerrado end-to-end sin requerir abrirlo.

**Negativas:**
- Decimal.js agrega ~30KB gzipped al bundle. Aceptable porque ya es dependencia server.
- Caller debe usar `unsafeDecimalFromNumber()` explícitamente si tiene number — más verboso, pero el riesgo queda visible.

**Riesgos a monitorear:**
- Bundle size cliente > 250KB gzipped → evaluar `big.js` (6KB) como reemplazo.
- Carritos > 5000 líneas con percepciones → subir `precision` a 50 o segmentar cálculo. Improbable F0 (target kiosco/mercería).

---

## APÉNDICE — D2/D3/D4 diferidos a F1+

La versión anterior de este ADR (ADR-0020 v3, ahora reasignado) incluía cuatro patrones: D1 (Money), D2 (BroadcastChannel sync tabs), D3 (LRU cache permisos), D4 (Connectivity monitor event-driven). **Solo D1 entra en F0**. D2, D3 y D4 se difieren con justificación:

### D2 — BroadcastChannel sync entre tabs (deferred F1+)

**Por qué deferred:** asume cajero opera con 2+ pestañas simultáneas. Sin métrica real de uso multi-tab, es problema hipotético. React Query refetch on focus cubre ~80% del caso.

**Trigger para implementar:** métricas reales muestran > 5% de sesiones con 2+ tabs activas del POS simultáneamente.

### D3 — LRU cache de permisos (deferred F1+)

**Por qué deferred:** la justificación original ("~500 queries/h con 10 cajeros activos") asume escala que F0 no tiene. Resolver permisos contra DB en cada Server Action agrega ~5-20ms — insignificante con 5 clientes piloto.

**Trigger para implementar:** observabilidad real muestra que verificación de permisos es bottleneck (p95 > 100ms por verificación) **Y** hit rate proyectado > 70%.

**Restricción:** si se implementa, debe ser **client-only exclusivo** (no server-side en serverless por instancias efímeras de Vercel).

### D4 — Connectivity event-driven con heartbeat (deferred F1+ — versión simple en F0)

**Por qué deferred (versión completa):** heartbeat 30s/90s + presence channel + 4 estados degraded son complejidad innecesaria para detectar simple offline.

**Versión F0 (simplificada):** wrapper minimal sobre `window.addEventListener('online'/'offline')` + estado del canal Supabase Realtime al suscribirse. Sin heartbeat, sin presence channel, sin estados intermedios.

```typescript
// src/lib/connectivity/simple.ts — versión F0
'use client';

export type ConnectivityStatus = 'online' | 'offline';

export class SimpleConnectivity extends EventTarget {
  private status: ConnectivityStatus = 'online';
  private readonly onOnline  = () => this.set('online');
  private readonly onOffline = () => this.set('offline');

  start() {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      this.status = 'offline';
    }
    window.addEventListener('online',  this.onOnline);
    window.addEventListener('offline', this.onOffline);
  }

  stop() {
    window.removeEventListener('online',  this.onOnline);
    window.removeEventListener('offline', this.onOffline);
  }

  private set(next: ConnectivityStatus) {
    if (this.status === next) return;
    this.status = next;
    this.dispatchEvent(new CustomEvent('change', { detail: next }));
  }

  get(): ConnectivityStatus { return this.status; }
}
```

**Trigger para implementar versión completa:** primer cliente productivo reporta más de 1 incidente/mes donde "el sistema no detectó que AFIP estaba caído antes de cobrar".

---

## Triggers de re-evaluación

| Trigger | Acción |
|---|---|
| Bug fiscal en producción atribuido a redondeo | Auditar paths que no usan `roundFiscal()` |
| Bundle cliente > 250KB gzipped | Evaluar `big.js` como reemplazo |
| Carritos reales > 1000 líneas | Verificar que precision: 30 alcanza |
| Diff cliente vs server > $0.01 reportado | Audit fix inmediato |
| Métrica multi-tab > 5% | Implementar D2 |
| Verificación permisos p95 > 100ms | Considerar D3 client-only |
| Incidente "no detecté AFIP caído" reportado | Implementar D4 completo |

## Pendiente de validación

Este ADR **no cierra ADR-0005**. La policy de redondeo (HALF_UP/HALF_DOWN/HALF_EVEN) sigue 🟡 abierta pendiente contador matriculado. ADR-0021 solo provee el mecanismo; la decisión sigue siendo de ADR-0005.
