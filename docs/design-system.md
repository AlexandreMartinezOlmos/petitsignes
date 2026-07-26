# Sistema de diseño

Cómo construir algo nuevo que encaje con el resto de la web.

Este documento describe lo que **existe hoy**, no lo que se pretende. Si el código y este
fichero se contradicen, manda el código y este fichero está mal: avísalo o corrígelo.

Para *por qué* la web está construida así (rejilla estática, islas, entrega de vídeo), ver
[`arquitectura.md`](arquitectura.md). Para añadir o corregir signos, [`contenido.md`](contenido.md).

---

## 1. Principios

1. **La accesibilidad es una restricción, no una capa.** El objetivo es WCAG 2.2 AA, que es lo
   que exige la EN 301 549 referenciada por la Directiva (UE) 2019/882. Un componente que no lo
   cumple no está terminado. En un proyecto sobre lengua de signos esto además es coherencia.
2. **Móvil primero de verdad.** El uso real es un bebé en brazos y el móvil en la otra mano.
   Objetivo táctil mínimo 44 px, texto nunca por debajo de 16 px.
3. **El color nunca es la única señal.** Cada categoría lleva icono además de tono.
4. **Mínimo JavaScript.** Si algo se puede hacer con HTML y CSS, se hace con HTML y CSS.
5. **El diseño vive en `src/styles/global.css`.** Con 229 tarjetas, una cadena larga de clases
   de utilidad se paga en cada nodo del DOM: lo que se repite es una clase de componente.

---

## 2. Tokens

Tres capas en [`global.css`](../src/styles/global.css), y el orden importa:

| Capa | Qué contiene |
|---|---|
| `@theme` | Escalas que no cambian con el tema: tipografía, pesos, radios, movimiento, desenfoque |
| `@theme inline` | Nombres semánticos de color (`--color-surface`, `--color-ink`…) |
| `:root` y bloques oscuros | Los valores reales de cada tema |

La regla práctica: **un componente nunca escribe un valor suelto**. Si necesitas un número que no
está en los tokens, o falta un token o el componente se está saliendo del sistema.

El tema oscuro está declarado dos veces a propósito —una en `@media (prefers-color-scheme: dark)`
y otra en `:root[data-theme='dark']`— para que una elección explícita gane a la del sistema en
ambos sentidos. Al añadir un token de tema hay que ponerlo en los tres bloques.

---

## 3. Color

Todo el color se escribe en **OKLCH**. No es preciosismo: en OKLCH la luminosidad es
perceptualmente uniforme, así que dos tonos con la misma L se ven igual de claros y **el
contraste es predecible al añadir una categoría**. En HSL no lo sería.

### Categorías

Cada categoría aporta **un solo número, su tono**, y de ahí se derivan el fondo, su pareja de
degradado y la tinta:

```css
[data-category='food'] {
  --cat-hue: 70;
}
```

Las luminosidades y cromas (`--cat-bg-l`, `--cat-fg-l`…) son comunes y viven en el tema, así que
claro y oscuro no se pueden desincronizar.

> ⚠️ **Límite conocido.** Hay 15 categorías repartidas en el círculo, y las más próximas
> (`body` 10 / `emotions` 20, y `objects` 290 / `time` 300) están a **10°**. A la croma que usan
> los fondos eso es prácticamente indistinguible, y con deficiencia de visión cromática peor. Es
> la razón por la que el icono es obligatorio. Si algún día se rehace la paleta, el camino es
> agrupar en ~5 familias de tono, no repartir 15 tonos más finos.

### Suelo de contraste del cristal

`--glass-tint` es la opacidad mínima de una superficie translúcida. **No es una preferencia
estética**: sobre cristal, el contraste depende de lo que haya detrás en ese momento, y detrás
hay 229 tarjetas con 15 tintes que además se desplazan. El desenfoque aporta el efecto; este
número aporta la legibilidad. Bajarlo hace que el contraste dependa del scroll.

---

## 4. Tipografía

**Nunito Sans Variable**, un solo fichero de 31 KB con `preload`, que trae el eje `wght` de 200 a
1000. Los pesos extremos no cuestan bytes adicionales: úsalos.

| Token | Para qué |
|---|---|
| `--text-xs` … `--text-2xl` | Escala general; las grandes son fluidas con `clamp()` |
| `--text-display` | El titular de portada, el único momento de despliegue |
| `--text-word` | **La palabra del catálogo.** Tiene su propio paso porque es lo que la gente busca |
| `--font-weight-normal` … `--font-weight-display` | 400 a 900 |

El cuerpo nunca baja de 16 px. Los tamaños grandes usan `clamp()` para ganar presencia en
pantallas anchas sin una media query.

---

## 5. Espacio, forma, elevación y movimiento

- **Táctil:** `--spacing-touch` (44 px) es el mínimo de todo control. No se negocia para que algo
  quepa; si no cabe, cambia el layout.
- **Radios:** `--radius-card`, `--radius-control`, `--radius-chip`.
- **Elevación:** `--elevation-1..3`, cada una con **dos capas** (una ambiental difusa y otra
  direccional cerrada). Una sola capa se lee como un borde caído; dos se leen como profundidad.
- **Canto de luz:** `--edge-light` es un `inset` claro en el borde superior. Es lo que hace que
  una superficie se lea como un plano elevado — el aspecto de cristal por el precio de una sombra
  y sin `backdrop-filter`. Va acompañando a la elevación, y **hay que conservarlo en `:hover` y
  `:focus`** o el canto parpadea justo al apuntar.
- **Movimiento:** `--duration-fast|base|slow` con `--ease-out` y `--ease-spring`. Toda la
  animación es decorativa y se apaga por completo con `prefers-reduced-motion`.

---

## 6. Cristal: dónde sí y dónde no

El cristal es para el **chrome**: superficies que flotan sobre el contenido. Ahí significa algo
—«esto no es el contenido»—. Aplicado a todo deja de significar nada y solo queda el coste.

| Superficie | Cristal | Motivo |
|---|---|---|
| Cabecera pegajosa | **Sí** | Flota sobre el contenido |
| Barra de filtros | **Sí** | Es chrome |
| Fondo del reproductor | **Sí**, y más intenso | No hay scroll detrás: se rasteriza una vez |
| **Las 229 tarjetas** | **No** | Son el contenido; usan `--edge-light` |
| Fondo de texto largo | **Nunca** | El contraste no puede depender del scroll |

Uso: la clase `.glass`. Es la única fuente del efecto, y por eso el contrato de accesibilidad se
cumple en un sitio.

```css
.glass {
  background-color: color-mix(in oklab, var(--color-surface) var(--glass-tint), transparent);
}
@supports (backdrop-filter: blur(1px)) {
  .glass {
    backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
  }
}
```

Ese `@supports` **no se puede quitar**: sin él, un navegador sin `backdrop-filter` se queda con
una superficie translúcida y sin desenfocar, que es justo el caso ilegible.

**Trampa nº1:** `backdrop-filter` crea un *stacking context*. Puede romper el `z-index` de la
cabecera o el `sticky` de sus hijos. **Trampa nº2:** un ancestro con `transform`, `filter` o
`will-change` cambia lo que el elemento considera «el fondo».

---

## 7. Componentes

### `.sign-card` — la tarjeta de signo

La unidad del catálogo, repetida 229 veces. Tiene **dos formas**:

- **Tarjeta** (≥ `sm`): panel de color arriba, palabra y chip debajo, acción al pie.
- **Fila compacta** (< `sm`): baldosa de categoría a la izquierda, palabra y chip en línea,
  acción abajo, toggles apilados en el borde. Una entrada ocupa 122 px en vez de 156 px.

Anatomía: `__media` (panel o baldosa) · `__header` › `__label` › `__title` + `__chip` ·
`__toggles` · `__actions` › `__cta`.

Reglas que no se tocan:

- **Solo se renderiza una lengua de signos por página.** No es estético: LSC y LSE son lenguas
  distintas y una tarjeta nunca puede mostrar el gesto de una bajo la etiqueta de la otra. Que el
  otro bloque no llegue al navegador es lo que hace estructural esa prohibición. Hay un test e2e.
- **La cara por defecto nunca es el vídeo.** Se abre bajo demanda.
- **`__media` sin póster muestra un marcador neutro de categoría**, nunca una ilustración del
  gesto: enseñaría una configuración de mano incorrecta. Que una tarjeta no tenga imagen **no es
  trabajo pendiente**, es la decisión correcta.

### `.glass` — superficie translúcida

Ver §6. Se combina con la clase del componente: `class="app-header glass"`.

### `.toolbar` — buscador y filtros

Tres filas: buscador, chips de categoría (scroll horizontal) y filtros de estado. En móvil, todo
lo que va tras el buscador vive en `.toolbar__filters` y **se pliega al bajar** por el catálogo,
recuperando ~68 px de un viewport de 812.

Se ocultan de verdad (`visibility: hidden`), no solo se encogen, para que sus controles **salgan
del orden de tabulación** en vez de convertirse en cosas invisibles a las que tabular. Y
`:focus-within` en la cabecera los mantiene abiertos mientras el foco esté dentro, así que
filtrar con teclado nunca cierra los controles bajo los dedos.

### `.chip` y `.chip-quiet` — filtros

Botones con `aria-pressed`. Cada grupo necesita **su propio `aria-label`**: dos grupos llamados
igual son indistinguibles navegando por regiones, y axe no lo detecta porque ambos *tienen*
etiqueta.

### `.sign-card__cta` — acción principal

Tres variantes según cómo se puede mostrar legalmente el vídeo: botón (incrusta el reproductor),
enlace externo (solo enlaza a la fuente) y un estado inerte cuando no hay vídeo en esa lengua.

### `.player-dialog` — el reproductor

`<dialog>` nativo con fondo de cristal reforzado. Cerrar es poner el estado a `null`, lo que
desmonta el iframe: eso es lo que de verdad detiene la reproducción.

---

## 8. Cómo añadir una categoría

1. Añádela a `src/content/categories.json` con su `id`, etiquetas, `icon`, `color` y `order`.
2. Añade su icono al sprite de [`IconSprite.astro`](../src/components/IconSprite.astro), en la
   misma rejilla de 24×24 y con el mismo trazo. **Nunca representa un gesto**: los iconos son
   marcas decorativas y se pueden dibujar libremente.
3. Elige el tono en `global.css`:

   ```css
   [data-category='nueva'] {
     --cat-hue: 195;
   }
   ```

4. **Comprueba la separación con las vecinas.** Por debajo de ~30° no se distinguen (§3).
5. Verifica el contraste en **claro y oscuro**, no solo en el que tengas puesto.

---

## 9. Lista de comprobación

Antes de dar por terminado un componente:

- [ ] Navegable con teclado, con foco visible y en orden lógico.
- [ ] Controles ≥ 44 px.
- [ ] Contraste AA en **ambos** temas.
- [ ] Nombres accesibles correctos, no solo presentes (§7, `.chip`).
- [ ] Nada de información transmitida solo por color.
- [ ] Se comporta con `prefers-reduced-motion` y con `prefers-reduced-transparency`.
- [ ] Sin valores sueltos: todo sale de tokens.
- [ ] Lo que se repite es una clase de componente, no una cadena de utilidades.
- [ ] `npm run test:e2e` en verde (incluye axe sobre las 8 páginas y el tema oscuro).
- [ ] Lighthouse ≥ 95 en las 4 categorías; vigila **CLS**.

```bash
npm run lint && npm run typecheck && npm run test:coverage && npm run build && npm run test:e2e
npx --yes @lhci/cli@0.15.x autorun --config=lighthouserc.json
```
