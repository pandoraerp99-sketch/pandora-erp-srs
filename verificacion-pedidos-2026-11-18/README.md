# Verificación — Pedidos y caja (2026-11-18)

Qué se construyó: la pantalla **Pedidos** (`pos-preview/pedidos.html`) con alta, edición, estados, cobros con seña y "Cobrar saldo y entregar", y su integración con **Caja**. Decisiones: [ADR-0029](../files/ADR-0029-pedidos-con-sena.md).

## Cómo abrirla

1. Docker Desktop prendido.
2. En WSL, dentro de `~/workspace/pandora-erp`: `bash scripts/dev-con-supabase-local.sh`.
3. Abrir **http://localhost:3000/pedidos** con `operador@pandora.dev` / `pandora-dev-1234`.
4. Para ver el libro como en la maqueta: `bash scripts/sembrar-pedidos-demo.sh` (sólo dev; no se repite).
5. Para cobrar una seña hace falta la caja abierta (`/caja`).

## Comparaciones visuales (misma ventana: 1600×1000)

| Archivo | Qué compara |
|---|---|
| `comparacion-pedidos-claro.png` | Maqueta `pedidos.html` vs `/pedidos` real, mismo estado (libro con encargos). |
| `real-pedidos-oscuro.png` | `/pedidos` en oscuro (la maqueta sólo existe en claro). |
| `comparacion-alta.png` | Formulario "Nuevo pedido señado" de `pedidos-senados.html` vs el alta real. |
| `real-detalle.png` | Detalle con historial de pagos y aclaración fiscal. |
| `comparacion-caja-claro.png` | Maqueta `caja-editorial.html` vs `/caja` real. Misma composición. Suma la celda "Señas de pedidos" en el cajón y cuenta "cobros" en vez de "tickets" cuando hay pedidos. El esperado es alto porque la caja de dev está abierta desde septiembre y acumula los cobros de prueba del sembrado y de los recorridos. |
| `comparacion-alivios-claro.png` | Tarjeta "Alivios de caja" de `caja-editorial.html` vs `/caja`: mismas medidas computadas (fila 53 px, checkbox 13×17, barra, título). Los nombres son los del usuario de prueba. |
| `comparacion-alivios-oscuro.png` | Lo mismo en oscuro. **Diferencia deliberada:** avatar y botón "Marcar retirados" en violeta más oscuro, porque el de la maqueta deja el texto blanco por debajo de 4,5:1 (lo vigila `tema-oscuro-pantallas`). |
| `alivios/` | Capturas del recorrido de alivios (`scripts/recorrido-alivios.mjs`). |
| `real-caja.png` | `/caja` con los cobros del pedido en movimientos, arqueo y efectivo esperado. |
| `recorrido/` | Las 8 capturas del recorrido automático, paso a paso. |

**Diferencias que quedan, y por qué:**
- **Shell compartido.** La barra superior (búsqueda ancha, íconos de tema y bandeja) y el pie del sidebar son los del shell de toda la app, no los de esta maqueta. Cambiarlos acá cambiaría todas las pantallas.
- **Columna "Tomó" y etiqueta "mayorista".** Hay un solo usuario de prueba, y las etiquetas de cliente no se muestran en el libro.
- **Exportar.** CSV e Imprimir funcionan; "Excel" no está (no se presenta algo que no existe).
- **Contraste en claro.** Los grises de la maqueta (`--ink-3`, `--ink-4`) miden entre 1,85:1 y 3,6:1 sobre píxeles. Se respetan porque son los de todas las pantallas; corregirlos es la pasada global de tokens (ver `UI-MEDICIONES-CONTRASTE-2026-11-15.md`). En oscuro todo lo medido pasa 4,5:1, re-medido después de los ajustes: "Sin seña" 5,39, pie de KPI 5,51, y el botón Cobrar del POS 4,99.

## Decisiones donde la maqueta no alcanzaba

- **Varias líneas por pedido.** La maqueta dibuja una sola; se agregaron filas con los mismos campos y "Agregar ítem".
- **Teléfono** junto al cliente.
- **Medio de la seña.** La maqueta lo da por "Efectivo".
- **Texto del interruptor "La seña congela el precio".** La maqueta dice que se factura con IVA, pero hoy no se emite comprobante, así que el texto dice eso (pregunta A-32).
- **Detalle.** Agrega acciones de estado ("En preparación", "Marcar listo", "Registrar cobro", "Cancelar pedido") con los mismos botones del modal.
- **Errores.** Se muestran en un bloque rojo dentro del modal, nunca como toast.

## Alivios de caja (migration 0044)

- **Un alivio sigue siendo un retiro**, así que el efectivo esperado y el cierre no cambian. Lo nuevo es una marca de que ese retiro fue un alivio, y después quién lo retiró y a qué hora. Las dos marcas son append-only. Antes un alivio sólo se reconocía por el texto del motivo, que el cajero puede cambiar.
- **La tarjeta** lista los pendientes de cualquier caja (la plata sigue en el sobre hasta que alguien la retira) y los retirados de la caja abierta.
- **"Marcar retirados"** lo puede usar **sólo la dueña** (confirmado por el owner el 2026-11-18). Ni el encargado ni el cajero: para ellos el checkbox queda deshabilitado y el servidor lo rechaza igual. El test se probó rompiendo la regla a propósito.
- **Doble click.** No duplica ni el alivio ni el retiro.
- **Auditoría.** No hay evento nuevo, porque el catálogo es cerrado. La fila misma registra quién y cuándo.
- **Pruebas.** `T-ALIV-01` (5 casos), `T-ROL-01` (+2 mutaciones) y `scripts/recorrido-alivios.mjs` (registrar con doble click, marcar retirado, recargar).

## Pruebas

- `T-PED-01` (integración, 13 casos): el total cierra con el detalle (HALF_EVEN por línea), la seña en efectivo entra al esperado y el cierre da cero, el débito figura en caja pero no en el cajón, sin caja el alta con seña falla entera, doble click y reintento no duplican, dos cobros simultáneos no superan el saldo, editar no baja de lo cobrado, cancelar con cobros se bloquea, cobros inmutables en la base, aislamiento entre comercios.
- `pedidos-dominio` (12 unitarios), `T-ROL-01` (+5 mutaciones: la contadora y un usuario sin membresía no escriben), catálogo de eventos (57).
- `scripts/recorrido-pedidos.mjs`: navegador real, de punta a punta, contra la base de dev.
