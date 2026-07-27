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
3. **El color nunca es la única señal.** Seis familias de tono cubren quince categorías, así que
   el tono dice a qué familia pertenece una tarjeta, nunca cuál es: eso lo dicen su icono y el
   encabezado de sección que tiene encima. El icono no es decoración, es la señal.
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

### Gama: por qué el color se queda dentro de sRGB

OKLCH sabe nombrar colores que ninguna pantalla puede mostrar. Cuando ocurre, el navegador
**recorta**, canal a canal, en silencio — y recorta distinto en una pantalla de gama amplia que
en una normal. Diez de los colores del sistema lo hacían: `--cat-bg` pedía croma 0.045 donde el
tono más azul solo admite 0.021, más del doble. Ese recorte es lo que hacía converger tonos que
sobre el papel estaban separados.

Así que **cada croma del bloque base es el máximo que sRGB admite a esa luminosidad y tono**, y
lo que una pantalla P3 sí puede mostrar se añade aparte:

```css
@media (color-gamut: p3) {
  :root { --cat-fg-c: 0.088; }   /* misma L, mismo tono, menos comprimido */
}
```

Nunca un color distinto en una pantalla mejor: la misma luminosidad y el mismo tono, con la
croma que esa pantalla puede reproducir. Una pantalla que no declara P3 jamás ve esas reglas.

### Categorías: seis familias, no quince tonos

Quince categorías tuvieron quince tonos, separados **10°** en el caso más justo. Diez grados no
se ven: medidos en OKLab, nueve de los 105 pares de fondos quedaban por debajo del umbral de
diferencia perceptible, el más próximo en **ΔE 0.008**, un tercio del umbral. El color prometía
distinguir «Cos» de «Emocions» y no podía.

Ahora las categorías se agrupan en **seis familias separadas ≥50°**, y la familia dice algo
cierto:

| Familia | Tono | Categorías |
|---|---|---|
| Comida y cuidado | 65 | `food`, `routines`, `body` |
| Personas | 10 | `family`, `emotions`, `courtesy` |
| Mundo vivo | 145 | `animals`, `nature` |
| Hacer y describir | 195 | `actions`, `qualities` |
| Abstracciones | 250 | `colors`, `numbers`, `time` |
| Objetos | 300 | `objects`, `clothing` |

Cuál de las tres es una tarjeta lo dice su **icono** y el **encabezado de sección** que tiene
encima, como siempre. El tono nunca tuvo que cargar una identidad él solo, y ahora no finge
hacerlo.

> La croma es **uniforme entre familias**, no la máxima de cada tono. El verde admite casi
> cuatro veces la croma del azul a esta luminosidad; dejárselo haría que los verdes gritaran por
> encima del resto. Croma igual es lo que hace que seis colores se lean como una sola paleta.

Las luminosidades y cromas (`--cat-bg-l`, `--cat-fg-l`…) son comunes y viven en el tema, así que
claro y oscuro no se pueden desincronizar.

### Daltonismo: qué se comprobó y qué no se puede arreglar

Simulado con las matrices de **Machado, Oliveira & Fernandes (2009)** a severidad 1,0 sobre RGB
lineal (`deltaEAs` y `contrastRatioAs` en `src/lib/color.ts`), no mirado en un plugin: así el
resultado es un número que rompe el build cuando se mueve. Dos hallazgos que apuntan en
direcciones opuestas.

**El tono no puede identificar la categoría, y ninguna paleta lo conseguiría.** Con deuteranopía
—la más común— el par de tintes más cercano cae de **ΔE 0,0296 a 0,0051**, una quinta parte del
umbral perceptible. No es un defecto que corregir: a un dicrómata le falta una dimensión de
color, así que seis familias distinguibles por tono es **inalcanzable por construcción**.

| Peor par de tintes | Normal | Protanopía | Deuteranopía | Tritanopía |
|---|---|---|---|---|
| Tema claro | 0,0296 | 0,0113 | **0,0051** | 0,0077 |
| Tema oscuro | 0,0406 | 0,0149 | **0,0072** | 0,0117 |

Por eso la regla de que **cada categoría lleva icono y encabezado que la nombra** no es un
extra: es lo único que identifica la categoría para una parte real del público.

**La legibilidad sí aguanta, y eso sí se puede fijar.** La paleta mantiene todas las familias a
una misma luminosidad, así que al colapsar el tono la luminancia apenas se mueve: el chip se
queda **por encima de 6,3:1 en las tres dicromacías** y en los dos temas. Una paleta futura que
variara la luminosidad por familia perdería esto en silencio, así que hay test.

| Contraste del chip | Normal | Protanopía | Deuteranopía | Tritanopía |
|---|---|---|---|---|
| Tema claro | 6,64:1 | 6,37:1 | 6,67:1 | 6,43:1 |
| Tema oscuro | 9,01:1 | 8,95:1 | 9,02:1 | 8,87:1 |

Los dos estados de la tarjeta (estrella y aprendido) quedan a ΔE 0,076 en el peor caso, pero eso
es de propina: lo que los distingue es el **cambio de forma** (§7, `.sign-card__toggle`).

### Nada de esto se vigila solo

Un color fuera de gama se dibuja igual. Un par de fondos por debajo del umbral se dibuja igual.
Los dos son invisibles en una revisión y evidentes para quien lee. Por eso
[`src/lib/color.test.ts`](../src/lib/color.test.ts) **lee la hoja de estilos que se publica** y
comprueba, en CI: que ningún color se sale de su gama, que las seis familias siguen a ≥45°, que
cualquier par de fondos supera el umbral perceptible, que el chip llega a 4.5:1 en claro, en
oscuro y en P3, y que los dos bloques de tema oscuro siguen siendo idénticos.

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

- **Tarjeta** (≥ `sm` y pantalla alta): panel de color arriba con los toggles encima, palabra
  debajo, acción al pie. **266 px**, antes 370.
- **Fila compacta** (estrecho **o** bajo): baldosa de categoría a la izquierda, palabra en línea,
  acción abajo, toggles apilados en el borde. Una entrada ocupa 122 px.

Anatomía: `__media` (panel o baldosa) · `__toggles` · `__header` › `__label` › `__title` +
`__chip` · `__actions` › `__cta`.

#### Por qué la tarjeta encogió un 28 %

La tarjeta decía **tres veces lo mismo**: el encabezado de sección «Roba», un chip que ponía
«Roba» bajo la palabra, y un bloque de medio con el icono de la categoría. Contado en el DOM:
**217 de los 229 chips repetían literalmente su encabezado**. Nada de eso fue un error en su
momento — el chip informaba cuando la rejilla era plana, y los encabezados que le quitaron el
trabajo llegaron después.

Y la palabra, que es lo que alguien viene a buscar, perdía contra su propio mobiliario: 115 px la
palabra, 115 px el chip a su lado, y 234 px de CTA con relleno sólido de marca **repetido idéntico
en 180 tarjetas**. Algo que aparece 180 veces igual es textura, no una llamada a la acción, y
estaba cobrando el precio de una.

- **El chip solo donde informa.** Lo decide quien monta la rejilla (`CatalogueView`), no la
  tarjeta: una tarjeta no puede saber qué hay escrito encima de ella. Se queda en las 12 fichas
  bajo «Primers signes», el único encabezado que no es una categoría.
- **Los toggles suben al bloque de medio**, cada uno con **pastilla sólida**. La pastilla no es
  adorno: detrás hay un tinte de categoría distinto en cada tarjeta y el criterio 1.4.11 pide 3:1
  al propio control. Medido en los quince tintes: **el icono queda a 4,31:1 en el peor caso**, y
  el filo de la pastilla usa `border-strong` porque con el hairline normal salía a **1,03:1** en
  los tintes más claros — un borde que nadie ve.
- **El bloque de medio pasa de 3:2 a 16:9** (177 → 150 px). Se queda, y a ancho completo: es la
  única parte de la tarjeta que algún día dirá algo que no está escrito —el pictograma de la
  palabra, nunca del gesto (§2.1)—. Simplemente no necesita media tarjeta. Por debajo de 16:9 un
  dibujo cuadrado empieza a ahogarse.
- **El CTA baja a relleno suave** con tinta de marca. `color.test.ts` sostiene ese par a 4,5:1 en
  los dos temas: cuanto más callado es un par, más cerca queda del suelo.

**El orden del código es el orden de lectura.** El marcado era medio → acción → palabra →
toggles y se veía medio → palabra → acción, con `order` tapando la diferencia; subir los toggles
habría ensanchado ese hueco. Ahora el marcado es medio → toggles → palabra → acción, que es lo que
hace el ojo en una tarjeta ancha, y no queda ni un `order`. La fila compacta usa áreas de rejilla,
así que el móvil no se entera.

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

Tres filas: buscador, chips de categoría y filtros de estado. En móvil, todo lo que va tras el
buscador vive en `.toolbar__filters` y **se pliega al bajar** por el catálogo, recuperando ~68 px
de un viewport de 812.

Se ocultan de verdad (`visibility: hidden`), no solo se encogen, para que sus controles **salgan
del orden de tabulación** en vez de convertirse en cosas invisibles a las que tabular. Y
`:focus-within` en la cabecera los mantiene abiertos mientras el foco esté dentro, así que
filtrar con teclado nunca cierra los controles bajo los dedos.

El plegado usa una fila de rejilla animada entre `1fr` y `0fr`, no un `max-block-size`: el
contenido puede crecer (la lista de categorías se despliega) y un techo fijo lo recortaría. El
recorte ocurre en `.toolbar__filters-inner`.

**La consulta es `(width < 40rem), (height < 34rem)`, y el segundo término no es un adorno.** El
plegado resuelve un problema de *altura* y durante un tiempo preguntó por el ancho: en un móvil
girado —844×390— el observador ponía `data-condensed="true"` en el primer deslizamiento y no se
movía un píxel, porque 844 px no es estrecho. Un estado anunciado a las tecnologías de apoyo y
desmentido por la pantalla. Un portátil a 768 px de alto conserva sus filtros, que era la
intención original; 34 rem queda lejos de cualquier portátil y por encima de cualquier móvil
apaisado.

Ese mismo eje decide otras dos cosas en pantallas bajas: la tarjeta pasa a `.sign-card` en fila
compacta (una tarjeta póster mide 363 px, más que el viewport entero, así que ninguna podía verse
completa) y la rejilla pide un **suelo de 22 rem por columna** en vez de un número de columnas,
porque tres columnas de 260 px volvían a partir el botón en dos líneas.

### `.chip`, `.chip-quiet` y `.chip--more` — filtros

Botones con `aria-pressed`. Cada grupo necesita **su propio `aria-label`**: dos grupos llamados
igual son indistinguibles navegando por regiones, y axe no lo detecta porque ambos *tienen*
etiqueta.

**`.chip-row` envuelve, nunca hace scroll lateral.** Con 17 filtros en una fila desplazable solo
se veían 3 en una pantalla de 375 px, y los otros 14 quedaban tras cinco pantallas de arrastre
sin nada que delatara su existencia.

`.chip--more` (borde discontinuo, para que se lea como control y no como un filtro más) despliega
el resto. Plegado se muestran «Tots», «Primers signes» y **la categoría activa**: sin ella,
filtrar y seguir leyendo dejaba el catálogo recortado sin explicación a la vista.

> **Los chips ocultos no se renderizan**, no se recortan. Un control invisible pero enfocable es
> peor que uno ausente. Vale para cualquier cosa que se pliegue en este sistema.

> **Regla que no se puede romper en `.chip--more`.** El texto visible es
> `filter.showCategories` («+15 més») y el nombre accesible es `filter.showCategoriesLabel`.
> WCAG 2.5.3 (Label in Name, **nivel A**) exige que el nombre **contenga** el texto visible, o
> quien maneja la web por voz dice lo que ve y no pasa nada. Durante un tiempo anunciaba «Mostra
> les 15 categories» sobre un botón que decía «+15 més»: incumplía.
>
> La regla operativa es que **la etiqueta empieza por el texto visible** y luego aclara.
> Deletrearla entera en el botón también cumpliría, pero empuja los chips a una segunda fila a
> 360 px —un ancho de móvil muy común— y cuesta 52 px de cabecera. `i18n.test.ts` fija que
> `showCategoriesLabel` empiece por `showCategories` en los tres idiomas.

**`Amb vídeo` es un filtro de contenido, no de progreso.** Va junto a `Primers signes` y no en el
grupo `Tots / Preferits / Apresos / Pendents`, que se llama «Filtra pel teu progrés» y responde a
«¿por dónde voy?». Este responde a «¿qué puedo ver?»: 49 de 229 signos (21 %) no tienen vídeo en
la lengua de su página y no había forma de dejarlos fuera.

Y a diferencia de los chips de categoría, **una búsqueda no lo suspende**. Los chips se apagan al
buscar porque encontrar una palabra no puede depender de qué chip esté encendido; este, en cambio,
dice qué parte del catálogo se puede ver, y responder a una búsqueda con los callejones sin salida
que el filtro tenía que esconder sería la misma mentira de F1 apuntando al revés. Cuando eso vacía
la rejilla, **el estado vacío nombra la causa que se puede quitar**: «Cap signe per «biberó»» es
cierto y engañoso a la vez —la palabra está en el catálogo, lo que falta es el vídeo—.

Cuesta 52 px de cabecera en móvil: el cuarto chip no cabe en los 358 px de un teléfono de 390 y la
fila envuelve. Cuatro chips piden 430 px; recortarles el relleno y quitar el icono llega a 357, y
una fila que cabe por los pelos es justo contra lo que advierte `.app-header__row`. Se aceptó a
conciencia, está anotado en el e2e del cromo de la primera pantalla, y la fila se pliega al primer
deslizamiento.

### `.hero` — la portada del catálogo

`.hero`, `.hero__title`, `.hero__lead`, `.hero__accent`. La cabecera más el héroe eran **458 px de
una pantalla de 844**: el 54 % de lo primero que se ve, gastado en un texto de presentación que ya
se ha leído en la segunda visita, en una herramienta a la que se vuelve a diario.

Se valoraron dos salidas. **Encogerlo a partir de la segunda visita se descartó:** haría que un
estado de cliente decidiera un layout, con el parpadeo de la altura equivocada en cada carga y una
página que no es la misma dos veces. Así que simplemente es más corto.

- El paso `--text-display` se reserva para `sm` y más, donde ocupa dos líneas en vez de tres. Por
  debajo el titular usa `--text-2xl` con el interlineado de display.
- En pantallas bajas (`height < 34rem`) vuelve al paso compacto aunque haya ancho de sobra.
- **No se oculta nada en ninguna anchura.** El `h1` es el encabezado de la página y la entradilla
  es la única frase que dice qué es el sitio; la entradilla **nunca baja de 16 px**. La altura sale
  del espacio, no de la legibilidad.

Medido, primera pantalla: móvil 458 → 425 px (54 % → 50 %, con la navegación móvil ya dentro),
escritorio 446 → 437 px.

### `.grid-section` — encabezado de grupo

Un `<h2>` que ocupa toda la fila de la rejilla y nombra el grupo que viene: primero la ruta
curada, después cada categoría. El orden ya existía en el dato; esto solo lo hace visible.

Los encabezados **se quedan cuando hay un filtro activo** y el controlador oculta los que se
quedan sin tarjetas. Así una búsqueda devuelve resultados agrupados por su categoría en vez de
una lista plana, y la jerarquía de encabezados no se rompe nunca — por eso el título de la
tarjeta es `h3`: pertenece a la sección, no va al lado.

Al añadir una sección hay que emitirla desde el mismo listado ya ordenado
(`CatalogueView.astro`), no declararla aparte: dos fuentes para el mismo agrupamiento solo
pueden acabar discrepando.

### `.sign-card__cta` — acción principal

Dos variantes según cómo se puede mostrar legalmente el vídeo: botón (incrusta el reproductor) y
enlace externo (solo enlaza a la fuente).

### `.sign-card__novideo` — cuando no hay vídeo en esa lengua

**No es un control y no puede parecerlo.** Llevaba borde discontinuo, radio y 44 px centrados: la
silueta exacta de un botón desactivado, en 49 de las 229 tarjetas, prometiendo una acción que no
existe y que por §2.1 nunca existirá.

Ahora es una nota: icono `#i-video-off`, texto alineado al inicio, sin borde ni radio. **La altura
se queda** —es lo que mantiene cuadradas las tarjetas de una misma fila—, pero la forma ya no es
la de algo pulsable.

### `.site-nav` — el resto del sitio, desde la cabecera

`El projecte`, `Fonts i crèdits` y `Accessibilitat` vivían **solo en el pie**: a 650 pulsaciones de
Tab y 38,6 pantallas de scroll, con la declaración de accesibilidad que obliga la EAA al final del
recorrido. Desde `sm` la fila de la cabecera tiene ~800 px sin usar, así que estos enlaces **no
cuestan ni un píxel de altura** (227 px antes y después, medido a 1280).

En móvil bajan a **una fila propia** bajo la marca, y esa fila **se pliega con los filtros**
mientras se baja por el catálogo: está al llegar y al volver a subir, pero no ocupa 44 px de
cabecera fija durante toda la visita. Mismo mecanismo que `.toolbar__filters` —pista de rejilla
de `1fr` a `0fr`, `visibility: hidden` para salir del orden de tabulación, `:focus-within` para
no cerrarse bajo el teclado—. `.site-nav-fold` es la caja que se anima; por encima de `sm` es
`display: contents` y no es una caja en absoluto.

**El orden del código es el orden de lectura en las dos anchuras, y eso decide dónde va el
selector de idioma.** Va junto a la marca, y la navegación al extremo opuesto de la fila. No es
decoración: si uno de los dos adelantara al otro al envolverse la fila, la tabulación
contradiría a la página en uno de los dos breakpoints. De paso deja el control más
consecuente del sitio —elige LSC o LSE para todo el catálogo, no solo una traducción— pegado a
la marca a la que pertenece.

El recorte del plegado se apaga cuando la fila está abierta (`:not([data-condensed='true'])` y
`:focus-within`): un `overflow: hidden` permanente cortaría el anillo de foco de 3 px de los
enlaces, que miden exactamente el alto de la fila.

La página actual se marca con `aria-current="page"` y **se subraya**, no solo se recolorea: saber
dónde estás no puede depender de distinguir dos grises (WCAG 1.4.1).

### `.bypass-link` — saltar el catálogo

Bloque de omisión (WCAG 2.4.1), justo antes de la rejilla. De los 654 focos de la página, **638
están dentro del catálogo**, así que todo lo que viene después quedaba a 650 tabulaciones. Ahora
está a 16.

Se oculta como `.sr-only` (recortado, no desplazado) porque vive **en el flujo**, entre el héroe y
la rejilla: reservarle sitio dejaría un hueco permanente. Al enfocarse pasa a `position: static` y
a 44 px. Apunta a `#footer-nav`, que lleva `tabindex="-1"` para recibir el foco de verdad: la
siguiente tabulación ya es el primer enlace del pie.

### `.toolbar__note` — por qué los chips se han apagado

La búsqueda mira todo el catálogo e **ignora los chips de categoría a propósito**, pero nadie los
despresurizaba: elegir `Primers signes` y buscar `gos` devolvía una tarjeta que no es un primer
signo con el chip todavía en `aria-pressed="true"`. La interfaz mentía a la vista y al lector de
pantalla a la vez.

Ahora, mientras hay búsqueda, esos chips van a `aria-pressed="false"` y esta nota explica por qué.
**La elección no se borra**: al vaciar el buscador el chip se vuelve a encender. La nota solo se
renderiza en ese caso, así que no es altura permanente.

### La región viva del recuento

Decía «22 signes»: un número sin sujeto. Quien ve la pantalla lee el chip encendido; quien no,
no tenía nada. Ahora lleva un `sr-only` con el ámbito —categoría, filtro de estado, o la búsqueda
y su término—, que cuesta 0 px de cabecera porque para quien ve la pantalla ya está dicho.

### `.player-dialog` — el reproductor

`<dialog>` nativo con fondo de cristal reforzado. Cerrar es poner el estado a `null`, lo que
desmonta el iframe: eso es lo que de verdad detiene la reproducción.

---

### `.footer-link` — enlaces del pie

Cuatro enlaces que antes repetían la misma cadena de utilidades cuatro veces y medían **22 px
de alto**: por debajo de los 24 px de WCAG 2.5.8 y los únicos controles del sitio que
incumplían el compromiso de 44 px del §5.

Ahora son `inline-flex` con `min-block-size: var(--spacing-touch)`. Como los enlaces envuelven,
esa altura hace además de separación vertical entre filas, así que `.footer-nav` solo necesita
`column-gap`.

### `.shell` — el contenedor del sitio

Un único contenedor para la fila de la cabecera, la barra de filtros, el `main` y el pie, para
que la marca, el buscador, la rejilla y los enlaces del pie caigan sobre los mismos dos bordes.
Antes eran las mismas cuatro utilidades escritas cuatro veces.

**Por encima de 90 rem el tope se abre.** A 2560 px la rejilla se quedaba en 1120 px con cuatro
columnas y **el 56 % de la pantalla era margen**: correcto para prosa, que tiene una medida que
proteger, y puro desperdicio para una rejilla de 229 fichas, que no tiene ninguna. El tope pasa a
`min(112rem, 88vw)` — el primero son unas seis columnas de tarjeta, que es lo ancha que puede
ponerse una fila antes de que el ojo tenga que viajar para leerla; el segundo garantiza margen en
cualquier pantalla, así que nunca llega de borde a borde.

Y la rejilla deja de contar columnas y pasa a **pedir un ancho**, igual que ya hacía en pantallas
bajas: un suelo de 16 rem —el ancho que la tarjeta póster ya tenía— deja que el navegador quepa
las que quepan. Por debajo de 90 rem no cambia nada: los breakpoints están medidos y el problema
solo existe arriba.

| | 1280 px | 1440 px | 1920 px | 2560 px |
|---|---|---|---|---|
| Columnas | 4 | 4 | **6** | **6** |
| Margen | 13 % | 14 % | 14 % | **31 %** (antes 56 %) |

Nada de lo de dentro pierde su medida: el titular conserva `max-w-5xl`, la entradilla 60ch y las
páginas de texto 65ch. Un contenedor más ancho les da más margen, no líneas más largas.

### `.app-header__row` — la fila superior no puede desbordar

`flex-wrap: wrap`, y por debajo de `sm` el `gap` y el `padding-inline` se estrechan.

A 320 px —el ancho que WCAG 1.4.10 exige que la página aguante— la marca y el selector de idioma
pedían 315 px de un presupuesto de 288, y el documento se iba a 330 px con scroll lateral. El
espaciado estrecho es lo que los hace caber; **el `wrap` es lo que garantiza que siempre quepan**,
haga lo que haga una traducción futura con la longitud de las cadenas. Un diseño que no puede
desbordar vale más que uno ajustado a las cadenas de hoy.

### `PageShell` — las tres páginas de texto

`/el-projecte/`, `/credits/` y `/accessibilitat/` eran prosa sobre crema: **ni un solo elemento
llevaba una clase de este fichero**, el `h1` no tenía nada del tratamiento del catálogo, y la
columna de texto eran **624 px de un `main` de 1152** — el 46 % de la página vacío por la derecha,
que se lee como un layout que se quedó corto, no como uno que decidió algo. Tampoco había camino
de vuelta: la marca era la única ruta al catálogo y una marca no parece un enlace.

**La medida nunca fue el problema** —65 caracteres está donde tiene que estar—, así que la columna
conserva su ancho y el hueco de al lado recibe un trabajo.

| Clase | Qué hace |
|---|---|
| `.breadcrumb` | La vuelta al catálogo, con los 44 px que cumple todo control del sitio. La página actual se **afirma** con `aria-current`, no se enlaza, y la barra separadora es `aria-hidden`: una barra leída en voz alta entre dos nombres de página es ruido |
| `.page-hero` | La misma tipografía, peso e interlineado que el titular del catálogo, un paso por debajo. Estos títulos son cortos; el paso de display sería gritar |
| `.page-layout` | Una columna centrada hasta `lg`, donde el índice ocupa el espacio que ya estaba vacío |
| `.page-toc` | Índice pegajoso. **Solo desde `lg`**: más estrecho no hay columna sobrante, y una lista de enlaces sobre el artículo sería una cosa más que pasar en el móvil |
| `.page-callout` | Superficie para los bloques que son **datos y no prosa** (licencias, estado del contenido, limitaciones conocidas). Una o dos por página: seis paneles apilados serían ensalada de tarjetas |

**Las secciones y el índice salen de una sola lista.** Cada vista declara `sections: PageSection[]`
y entrega el cuerpo por un slot con el nombre del `id`. Declararla dos veces es exactamente cómo
una entrada acaba apuntando a un encabezado que se renombró — el mismo motivo por el que los
encabezados de grupo del catálogo se emiten desde su propio listado ordenado (§7, `.grid-section`).

Los `id` son **anclas enlazables** y no dependen del idioma servido: una declaración de
accesibilidad se cita sección por sección. Los encabezados llevan `scroll-margin-top`, no solo el
`scroll-padding-top` del documento, o el enlace entregaría la sección con su propio título detrás
de la cabecera fija.

El índice enlaza a 32 px de alto y no a 44, a conciencia: es una **ruta duplicada** a encabezados
que ya están en el documento, visible solo en pantallas con puntero y teclado, y cinco entradas a
44 px serían más altas que la sección a la que apuntan. Sigue muy por encima de los 24 px del
criterio 2.5.8.

### Impresión

Imprimir daba 229 tarjetas bajo una cabecera fija sobre fondo crema. Escuelas infantiles y
matronas quieren **una hoja** de los signos que están trabajando, y el catálogo ya sabe
producirla: el controlador oculta con `hidden` lo que no pasa el filtro, así que **lo que hay en
pantalla es lo que sale**. Se filtra y se imprime.

El bloque `@media print` quita el cromo, los controles que no se pueden pulsar en papel y el
marcador de medio —que no tiene póster ni lo tendrá (§2.1), así que en papel es un rectángulo en
blanco—, encoge el titular del héroe y pasa la rejilla a tres columnas con `break-inside: avoid`.

**El enlace a la fuente se queda, y gana su URL.** Es la atribución que pide la licencia y lo
único de una tarjeta impresa que sigue siendo accionable.

## 8. Cómo añadir una categoría

1. Añádela a `src/content/categories.json` con su `id`, etiquetas, `icon` y `order`.
2. Añade su icono al sprite de [`IconSprite.astro`](../src/components/IconSprite.astro), en la
   misma rejilla de 24×24 y con el mismo trazo. **Nunca representa un gesto**: los iconos son
   marcas decorativas y se pueden dibujar libremente.
3. **Asígnala a una familia existente** en `global.css`, añadiendo su selector al grupo que le
   corresponda:

   ```css
   [data-category='actions'],
   [data-category='qualities'],
   [data-category='nueva'] {
     --cat-hue: 195;
   }
   ```

   No inventes un tono nuevo. Seis familias ya ocupan el círculo a ≥50°; una séptima solo cabe
   estrechando a todas, que es exactamente el problema que este sistema resolvió (§3).

4. Ejecuta `npm run test`. `color.test.ts` falla si la categoría se queda sin familia, si algún
   color se sale de gama o si el contraste del chip baja de 4.5:1 en cualquiera de los cuatro
   escenarios (claro, oscuro, y ambos en P3).

---

## 9. Lista de comprobación

Antes de dar por terminado un componente:

- [ ] Navegable con teclado, con foco visible y en orden lógico.
- [ ] Controles ≥ 44 px. Hay un e2e que barre la página entera y falla por debajo de 24.
- [ ] **A 320 px no aparece scroll horizontal** (WCAG 1.4.10). Cubierto por e2e en las 4 páginas.
- [ ] Si el control lleva `aria-label` **y** texto visible, el nombre contiene el texto visible
      (WCAG 2.5.3). Hay un e2e que barre todos los controles.
- [ ] El estado activo no se distingue **solo por el tono**: que se rellene, cambie de forma o
      aparezca algo.
- [ ] Contraste AA en **ambos** temas.
- [ ] Todo color nuevo, **dentro de sRGB** a su luminosidad y tono (§3). `npm run test` lo
      comprueba; si falla, baja la croma, no el listón.
- [ ] Nombres accesibles correctos, no solo presentes (§7, `.chip`).
- [ ] Nada de información transmitida solo por color.
- [ ] **Si no es un control, no tiene silueta de control**: nada de bordes, radios y 44 px
      centrados en un `<p>` (§7, `.sign-card__novideo`).
- [ ] **Ningún `aria-pressed` afirma un filtro que no se está aplicando** (§7, `.toolbar__note`).
- [ ] No se afirma una cifra que todavía no se conoce: el servidor no renderiza un `0` que la
      hidratación va a corregir (`.progress-data__summary`).
- [ ] Si el componente sale en el catálogo, mirar cómo **se imprime** (§7, Impresión).
- [ ] **Probado con el móvil girado** (844×390), no solo estrecho. Si una regla resuelve un
      problema de altura, la media query pregunta por `height` (§7, `.toolbar`).
- [ ] Si algo se reordena al envolverse una fila, **el orden del código sigue siendo el orden de
      lectura** en todas las anchuras (§7, `.site-nav`).
- [ ] Nada que se pueda navegar se declara dos veces: si hay un índice, sale de la misma lista que
      los encabezados (§7, `PageShell`).
- [ ] **Nada dice dos veces lo mismo.** Si una etiqueta repite lo que ya pone encima, sobra (§7,
      `.sign-card`).
- [ ] Un control sobre una superficie **que cambia de color** lleva su propia base sólida; el
      contraste se mide contra los quince tintes, no contra uno (§7, `.sign-card`).
- [ ] Si un par de colores se hace **más callado**, se mide: es al bajar el contraste cuando se
      cruza el suelo sin enterarse (`color.test.ts`).
- [ ] Un ancla aterriza **por debajo** de la cabecera fija, no detrás (`scroll-margin-top`).
- [ ] Se comporta con `prefers-reduced-motion` y con `prefers-reduced-transparency`.
- [ ] Sin valores sueltos: todo sale de tokens.
- [ ] Lo que se repite es una clase de componente, no una cadena de utilidades.
- [ ] `npm run test:e2e` en verde (incluye axe sobre las 8 páginas y el tema oscuro).
- [ ] Lighthouse ≥ 95 en las 4 categorías; vigila **CLS**.

```bash
npm run lint && npm run typecheck && npm run test:coverage && npm run build && npm run test:e2e
npx --yes @lhci/cli@0.15.x autorun --config=lighthouserc.json
```
