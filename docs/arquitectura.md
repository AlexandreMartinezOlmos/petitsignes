# Arquitectura

Decisiones estructurales y por qué. Para construir interfaz que encaje, ver
[`design-system.md`](design-system.md); para añadir o corregir contenido,
[`contenido.md`](contenido.md).

## El problema de fondo

El catálogo tiene ~229 conceptos y crecerá. Un enfoque SPA clásico enviaría los 229 al
navegador como JSON y los renderizaría en cliente: eso pone el coste de arranque en función
del tamaño del catálogo, justo lo contrario de lo que necesita un móvil de gama media con
conexión 4G — donde el objetivo es Lighthouse ≥ 95 en las cuatro categorías.

La estructura que sigue existe para romper esa dependencia: **el JavaScript enviado no crece
con el número de signos**.

## Cómo encaja

```
Build (Astro)                          Navegador
─────────────                          ─────────
content/signs/*.json ──┐
                       ├──> HTML estático con las 229 tarjetas
content/categories.json┘         │
                                 │  data-sign-id, data-category,
                                 │  data-label-ca/es/en, data-first-sign
                                 ▼
                          catalogue-grid.ts  ◄──── nanostores ────►  islas React
                          (lee los data-attrs,       (estado)         · CatalogueToolbar
                           oculta y muestra)                          · SignVideoDialog
                                 │
                                 ▼
                          storage.ts (localStorage)
```

### 1. La rejilla es HTML estático

Cada tarjeta se renderiza en el build con sus datos en atributos `data-*`. El controlador
`catalogue-grid.ts` los lee al arrancar y construye el índice de búsqueda **desde el DOM**, así
que el catálogo no viaja dos veces (una en HTML y otra en el bundle).

Filtrar es poner o quitar el atributo `hidden`. No hay re-render ni framework implicado. Los
encabezados de sección se ocultan igual, cuando el filtro deja su grupo sin tarjetas.

Consecuencia: la página funciona sin JavaScript para leer y navegar; sin él se pierden búsqueda,
filtros y progreso, pero el contenido está —agrupado y con sus encabezados— y es indexable.

### 2. Dos islas de React, no una aplicación

- `CatalogueToolbar` — búsqueda, chips de categoría y filtros de estado.
- `SignVideoDialog` — el reproductor, montado una sola vez y despertado por un evento.

El selector de idioma **no** es una isla: son enlaces (ver punto 3).

Los botones de favorito y aprendido de las tarjetas **no** son componentes de React: son
botones HTML y un único listener delegado en la rejilla. Hidratar 458 botones costaría más que
todo lo demás junto.

### 3. El idioma vive en la URL, y arrastra la lengua de signos

El idioma de interfaz está enrutado: `ca` en la raíz (`/`, `/el-projecte/`, `/credits/`) y `es`
bajo `/es/`.
Cada idioma se **acopla** a una lengua de signos —`ca → LSC`, `es → LSE`— mediante el mapa
`LANGUAGE_TO_SIGN_LANGUAGE` de [`../src/lib/types.ts`](../src/lib/types.ts). La página escribe
`<html lang>` y `data-sign-language` **en el build**, así que la lengua de signos se decide en la
URL, no en el cliente.

Por qué en la URL y no en estado de cliente: cualquier control cuyo aspecto dependa de una
preferencia guardada provoca un **desajuste de hidratación** (el servidor renderiza un valor, el
cliente tiene otro, y React 19 no lo corrige: *"this won't be patched up"*). Al fijar el idioma
en el build, el HTML del servidor y el del cliente son idénticos. Además las URLs se comparten y
se indexan por idioma (hay `hreflang` para cada locale).

El selector de idioma es un par de **enlaces** `<a>`, no un control de React: funciona sin
JavaScript y su estado activo es server-rendered, sin parpadeo ni resaltado equivocado.

Siguen existiendo dos ejes distintos en el dato (un vídeo es LSC o LSE al margen de la interfaz),
pero **cada página emite una sola lengua de signos**: `SignCard` deriva cuál con
`LANGUAGE_TO_SIGN_LANGUAGE` y renderiza solo esa.

Hubo una versión anterior que renderizaba las dos y ocultaba la inactiva con CSS, para que un
conmutador LSC/LSE no costara JavaScript. Ese conmutador nunca existió —el idioma se fija en la
URL—, así que cada página cargaba **141 KB (23 %) de HTML que el navegador analizaba para no
mostrarlo jamás**, y 229 subárboles DOM de más en un móvil.

Se eliminó, y la regla ahora es estructural: el gesto de la otra lengua **no llega al navegador**.
Que no esté en el DOM es lo que hace imposible mostrarlo por error a un `display` de distancia —
una tarjeta nunca puede enseñar el signo de una lengua bajo la etiqueta de la otra, porque son
gestos distintos.

### 4. El estado compartido son nanostores

React y el controlador de la rejilla necesitan la misma verdad (qué se busca, qué filtro está
activo, qué es favorito). nanostores pesa ~1 KB y permite que ambos mundos se suscriban sin
acoplarlos.

### 5. La persistencia está detrás de una interfaz

`ProgressStore` (ver [`../src/lib/storage.ts`](../src/lib/storage.ts)) define métodos **async**
aunque `localStorage` sea síncrono. Es deliberado: cuando algún día haya sincronización entre
dispositivos, será una implementación nueva de la interfaz y no una reescritura de la app.

Ningún componente toca `localStorage` directamente.

El formato persistido lleva `schemaVersion` desde el día uno, y `parseSnapshot` valida entrada
no confiable (un fichero que importa el usuario) descartando lo que no reconoce en vez de
confiar en ello.

### 6. Los dos ejes de idioma: separados en el dato, acoplados en la UI

- `Language` (`ca` | `es` | `en`) — el idioma del **texto**.
- `SignLanguage` (`lsc` | `lse`) — la **lengua de signos** del vídeo.

En el **modelo de datos** siguen siendo independientes: un vídeo declara su `signLanguage` sin
saber nada de la interfaz. En la **experiencia**, para este público, van juntos: quien lee en
catalán aprende LSC, quien lee en castellano aprende LSE. Por eso el idioma seleccionado deriva
la lengua de signos (ver punto 3). El acoplamiento vive en un solo sitio,
`LANGUAGE_TO_SIGN_LANGUAGE`, y es reversible: separar ambos ejes en la UI sería volver a exponer
dos controles, no rehacer el modelo.

`en` está traducido pero aún no enrutado (no tiene lengua de signos propia en el alcance); se
añadirá con una decisión explícita. Todo el texto pasa por `i18n.ts`, así que sumar un idioma es
añadir sus cadenas y su ruta, no tocar los componentes.

## Sistema de diseño

Todo el diseño vive en [`../src/styles/global.css`](../src/styles/global.css), en tres capas:

1. `@theme` — escalas que no cambian con el tema: tipografía fluida con `clamp()`, radios,
   duraciones y curvas de movimiento, y tres niveles de elevación.
2. `@theme inline` — los colores semánticos (`surface`, `ink`, `brand`…).
3. Bloques `:root` — los valores reales de tema claro y oscuro.

**Elevación de dos capas.** Cada sombra combina una difusa ambiental y otra direccional más
cerrada. Una sola capa se lee como un borde caído; dos se leen como profundidad.

**Color en OKLCH, dentro de la gama que se renderiza.** Las 15 categorías se agrupan en **seis
familias de tono** separadas ≥50°; cada familia aporta un único número y de ahí se derivan el
degradado del panel y la tinta, con la misma luminosidad perceptual en ambos temas. Quince tonos
distintos no eran distinguibles: los pares más próximos quedaban a 10°, por debajo del umbral
perceptible. El tono nunca es la única señal — cada categoría lleva icono y va bajo su
encabezado de sección.

Cada croma es además **el máximo que sRGB admite** a esa luminosidad y tono. OKLCH sabe nombrar
colores que ninguna pantalla muestra, y entonces el navegador recorta en silencio, canal a canal
y distinto según la pantalla; era lo que hacía converger tonos separados sobre el papel. Lo que
una pantalla P3 sí puede mostrar se añade aparte, con `@media (color-gamut: p3)`, a igual
luminosidad y tono.

**El CSS repetido vive en CSS.** La tarjeta se repite 229 veces, así que las cadenas largas de
clases de utilidad se pagarían una vez por tarjeta en el DOM. Las partes repetidas
(`.sign-card`, `.chip`, `.player-dialog`…) son clases de componente y el marcado solo lleva
lo que varía. Lo mismo con los iconos: un sprite de `<symbol>` con referencias `<use>`, en vez
de más de mil SVG en línea.

**Micro-interacciones.** Elevación al pasar el cursor, zoom suave del icono de categoría, rebote
al marcar favorito o aprendido, y entrada del modal. Todo es decorativo, así que
`prefers-reduced-motion` lo desactiva por completo.

## Accesibilidad como restricción de diseño

El objetivo es **WCAG 2.2 AA**, el nivel que exige la norma armonizada EN 301 549 referenciada
por la Directiva (UE) 2019/882. No es una capa que se añade al final: condiciona el sistema de
diseño.

- Los tokens de color se escogen para cumplir contraste AA en claro y oscuro **antes** de
  usarlos. La derivación en OKLCH es lo que hace ese cumplimiento predecible al añadir categorías,
  y `src/lib/color.test.ts` lo comprueba en CI leyendo la hoja de estilos publicada: gama,
  separación entre familias y contraste del chip en claro, oscuro y P3.
- `--spacing-touch` (44 px) es el tamaño mínimo de todo control, por encima de los 24 px del
  criterio 2.5.8.
- `scroll-padding-top` en `html` mantiene el elemento enfocado fuera de la cabecera fija
  (criterio 2.4.11). Hay un test e2e que lo comprueba midiendo geometría real.
- La rejilla concentra **638 de los 654 focos** de la página, así que hay un bloque de omisión
  (criterio 2.4.1) justo antes de ella que salta al pie: 650 tabulaciones pasan a 16. El destino
  lleva `tabindex="-1"` para recibir el foco de verdad, no solo el hash.
- **Una regla que resuelve un problema de altura pregunta por la altura.** El plegado de la
  cabecera vivía tras `width < 40rem` y en un móvil girado (844×390) anunciaba
  `data-condensed="true"` sin mover un píxel: un estado dado a las tecnologías de apoyo y
  desmentido por la pantalla. La consulta es ahora `(width < 40rem), (height < 34rem)`, y con
  ella la tarjeta en fila compacta y el suelo de columna de la rejilla.
- **El orden del código es el orden de lectura en todas las anchuras.** La fila de la cabecera
  envuelve, y el selector de idioma va antes que la navegación tanto en el código como a la
  vista: a un lado en una fila, encima cuando son dos. Cualquier reordenación visual dejaría la
  tabulación en desacuerdo con la página en uno de los dos breakpoints.
- **Nada navegable se declara dos veces.** El índice de las páginas de texto y sus encabezados
  salen de la misma lista de secciones (`PageShell.astro`), igual que los encabezados de grupo
  del catálogo se emiten desde su propio listado ordenado: dos fuentes para el mismo agrupamiento
  solo pueden acabar discrepando, y aquí discrepar significa un enlace a un ancla que ya no está.
- Toda la animación es decorativa y se apaga con `prefers-reduced-motion`.
- **Ningún estado de la interfaz afirma algo que no esté ocurriendo.** La búsqueda ignora los
  chips de categoría por diseño, así que mientras hay búsqueda esos chips van a
  `aria-pressed="false"` y una nota lo explica; el recuento en directo lleva el ámbito, no solo
  la cifra; y la página del proyecto no renderiza un `0` que la hidratación va a corregir.
- El sitio publica una **declaración de accesibilidad** en `/accessibilitat/` y `/es/accessibilitat/`,
  como espera la directiva.

Se comprueba con axe-core (etiquetas WCAG 2.0/2.1/2.2, niveles A y AA) sobre las ocho páginas y
en tema oscuro, más Lighthouse con presupuestos que rompen el CI.

## Portabilidad

- Versión de Node fijada en `.nvmrc` y en `engines`.
- `package-lock.json` commiteado; el CI usa `npm ci`.
- El build no invoca binarios del sistema. Cualquier procesado de vídeo será un script de
  contenido cuyo resultado se commitea, nunca parte de `npm run build`.
- Sin variables de entorno obligatorias. `SITE_URL` es opcional y solo afecta a las URLs
  absolutas (canonical, Open Graph).

## Entrega de vídeo: nada se aloja aquí

Los vídeos **no son del proyecto** y ninguna de las dos fuentes permite descargarlos,
transformarlos ni realojarlos:

- **DILSE (Fundación CNSE, LSE).** Su [aviso legal](https://fundacioncnse-dilse.org/aviso-legal.php)
  autoriza la descarga solo para uso «personal y privado», y prohíbe expresamente la distribución,
  la comunicación pública, la transformación y instalar los contenidos en un servidor accesible
  por terceros. Los ficheros son `.mov`, que habría que transcodificar para la web — y transformar
  también está prohibido. El pie de su web, en cambio, muestra una licencia CC BY-NC-SA 3.0, que sí
  permitiría compartir: **las dos cosas se contradicen**, y ante la contradicción se aplica lo más
  restrictivo.
- **Vocabulari bàsic de la LSC (Generalitat / FESOCA).** Los vídeos están en YouTube. Descargarlos
  va contra las condiciones de YouTube, al margen de la licencia del contenido. El uso previsto es
  incrustarlos.

Por eso cada realización declara en el dato **cómo puede mostrarse legalmente**:

| `delivery` | Qué hace la tarjeta | Se usa en |
|---|---|---|
| `youtube-embed` | Abre el reproductor incrustado en un modal | LSC (Gencat publicó los vídeos en YouTube) |
| `external-link` | Enlaza a la ficha original, sin reproducir | LSE (DILSE solo permite enlazar) |

Ninguno de los dos usos requiere autorización por escrito: incrustar es para lo que Gencat activó
la inserción al publicar en YouTube, y enlazar a una página pública nunca la ha necesitado. Sí
haría falta —y habría que archivarla antes de tocar nada— para descargar, transcodificar, realojar
o extraer fotogramas.

El reproductor usa la **IFrame Player API** de YouTube (ver [`../src/lib/youtube.ts`](../src/lib/youtube.ts)),
cargada **solo al abrir el modal** y contra el host `youtube-nocookie.com`: navegar el catálogo
no genera ninguna petición a YouTube. Se usa la API completa, y no un `<iframe>` pelado, por dos
motivos concretos:

- **Bucle fiable.** Al terminar el clip escuchamos el estado `ENDED` y hacemos `seekTo(0)` +
  `playVideo()`. El parámetro `loop` de un embed simple no lo garantiza entre navegadores, y era
  la causa de que un vídeo terminado pareciera "cerrar" la ficha.
- **El diálogo nunca se cierra solo.** El estado `request` de React es la única fuente de verdad:
  cerrar es poner `request = null`, lo que a la vez cierra el `<dialog>` y **desmonta el iframe**
  (lo que de verdad detiene la reproducción y corta la conexión). No dependemos del evento `close`
  del `<dialog>`, que no se dispara de forma fiable cuando el foco está dentro del iframe.

La velocidad 0,5× se aplica con `setPlaybackRate` de la propia API.

Consecuencia asumida: sin derecho a extraer fotogramas, `posterUrl` es opcional y hoy está vacío
en todas las fichas. La cara de la tarjeta es el marcador neutro de categoría. El campo sigue en
el esquema porque si algún día se consigue el permiso, rellenarlo es un cambio de datos y no de
código.

**Nunca se sustituye por una ilustración del gesto.** Enseñaría configuraciones de mano
incorrectas, que es el daño exacto que este proyecto existe para evitar. Una tarjeta sin imagen
no es trabajo pendiente: es la decisión correcta.
