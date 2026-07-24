# Petits Signes

Web **gratuita y de código abierto** para que madres, padres, cuidadores y educadores oyentes
aprendan vocabulario básico de **LSC** (Llengua de Signes Catalana) y **LSE** (Lengua de Signos
Española) y lo usen con bebés antes de que hablen (aprox. 6–24 meses).

Sitio 100% estático. Sin backend, sin cuentas, sin cookies de seguimiento, sin publicidad.

> **Estado:** MVP funcional. Catálogo, búsqueda, filtros, progreso local, reproductor e interfaz
> en catalán y castellano. **180 conceptos con vídeo LSC y 225 con enlace LSE**, de 229 en total.
> Todos los vídeos están marcados como `draft` en el dato: coinciden con el diccionario oficial,
> pero aún no los ha revisado un humano uno por uno (ver [Estado del contenido](#estado-del-contenido-y-verificación)).

## Por qué existe este proyecto

Antes de que un bebé pueda hablar, ya puede comunicarse con las manos: señalar, pedir, decir "más"
o "otra vez" con un gesto sencillo reduce la frustración de ambos lados mucho antes de la primera
palabra. Esto no es un método propio ni una lengua inventada para bebés: son signos **reales** de
LSC y LSE, las lenguas de la comunidad sorda de Cataluña y España. Aprenderlos con tu bebé es,
también, un primer contacto respetuoso con esas lenguas y esa comunidad.

El proyecto nace para que cualquier familia o escuela infantil pueda empezar **sin pagar, sin
registrarse y sin publicidad**, con la garantía de que cada signo que ve viene de una fuente
oficial verificable — nunca de una ilustración inventada o de un signo "parecido".

Está pensado para dos públicos:

- **Familias**, que quieren aprender un puñado de signos útiles del día a día (comer, dormir,
  más, gracias) sin tener que estudiar una lengua entera de golpe.
- **Comunidad educativa** (escuelas infantiles, matronas, logopedas, educadores), que puede
  usarlo como recurso libre para introducir signos en el aula o recomendarlo a las familias.

## Principios

1. **Nunca un signo inventado.** Todo signo procede de una fuente oficial verificable y
   atribuida. Si no hay fuente, la ficha se queda sin vídeo — nunca se rellena con una
   ilustración o una suposición, y nunca se sustituye el signo de una lengua por el de la otra.
2. **Móvil primero.** El uso real es con el bebé en brazos y el móvil en la otra mano.
3. **Un vistazo basta.** La cara de la tarjeta es una imagen estática; el vídeo es opcional y
   nunca se reproduce solo.
4. **Sin fricción.** Sin registro, sin muros de pago, sin cuentas.
5. **Respeto a la comunidad sorda.** Esto es una puerta de entrada a lenguas reales, no un
   sustituto del aprendizaje formal ni una simplificación de la lengua de signos.

## Fuentes del vocabulario

Ningún vídeo es propio del proyecto; todos proceden de las fuentes oficiales de cada lengua de
signos, con atribución completa en cada ficha:

- **LSC** — [Vocabulari bàsic de la llengua de signes catalana](https://llengua.gencat.cat/ca/llengua_signes_catalana/recursos-i-activitats/vocabulari/),
  Generalitat de Catalunya (Departament de Cultura), con asesoramiento de la FESOCA. Es un
  diccionario de referencia de 2.480 términos, cada uno con su vídeo en el canal oficial de
  YouTube.
- **LSE** — [DILSE](https://fundacioncnse-dilse.org/), Fundación CNSE para la Supresión de las
  Barreras de Comunicación.

El emparejamiento entre cada palabra y su vídeo se hizo por **coincidencia exacta y sensible a
acentos**, porque en catalán un acento cambia el significado (_més_ = "más", _mes_ = "mes del
calendario"): confundirlos enseñaría un signo equivocado a una familia, que se lo enseñaría a su
bebé. Ver la sección siguiente para el detalle de cómo se muestran estos vídeos y por qué.

## Estado del contenido y verificación

El catálogo tiene **229 conceptos** curados con etiquetas en catalán, castellano e inglés,
repartidos en 15 categorías, más una ruta guiada de 12 "primeros signos".

|                     | LSC                         | LSE                        |
| ------------------- | --------------------------- | -------------------------- |
| Conceptos con vídeo | **180** de 229              | **225** de 229             |
| Cómo se muestra     | vídeo de YouTube incrustado | enlace a la ficha de DILSE |

**Ningún vídeo se aloja en este proyecto.** Las condiciones de reutilización de las dos fuentes
no permiten descargarlos, transcodificarlos ni republicarlos en un servidor propio, así que cada
ficha declara cómo puede mostrarse legalmente:

- `youtube-embed` (LSC) — se incrusta el reproductor oficial desde `youtube-nocookie.com`, y solo
  cuando la persona pulsa "ver el signo". Navegar el catálogo no carga nada de YouTube.
- `external-link` (LSE) — solo se enlaza a la ficha original de DILSE; el vídeo se reproduce en
  su propia web, nunca dentro de esta.

Como consecuencia, y sin derecho a extraer un fotograma del vídeo, la cara de la tarjeta es un
marcador neutro con el icono de la categoría — nunca una representación inventada del gesto.

**Todos los vídeos están en `status: draft`.** El término coincide con el diccionario oficial,
pero antes de considerarlo `verified` alguien tiene que haber visto el clip entero y confirmado
que corresponde al concepto (algunas palabras tienen decenas de acepciones distintas en el
diccionario de origen). Es la contribución más valiosa que se puede hacer al proyecto — ver
[Contribuir](#contribuir).

## Accesibilidad

El sitio se desarrolla contra **WCAG 2.2 nivel AA**, el listón que exige la norma armonizada
**EN 301 549**, referenciada por la **Directiva (UE) 2019/882** (Acta Europea de Accesibilidad).
Al tratarse de un proyecto sobre lengua de signos, la accesibilidad no es un añadido: es
coherencia con el propósito. Hay una declaración de accesibilidad publicada en el propio sitio,
en catalán y castellano.

Cada cambio se comprueba con axe-core sobre las seis páginas y en modo oscuro, más un test
específico de que la cabecera fija nunca tapa el elemento con el foco. Si algo falla, el CI falla.

## Arquitectura en una pantalla

- **Astro** genera el catálogo entero como HTML estático en el build.
- Dos **islas de React** aportan la interactividad: la barra de herramientas (búsqueda y
  filtros) y el reproductor de vídeo.
- Un controlador ligero conecta esas islas con la rejilla estática mostrando y ocultando
  tarjetas, de modo que el JavaScript enviado **no crece con el número de signos**.
- El **idioma vive en la URL** (`/` catalán, `/es/` castellano) y arrastra la lengua de signos
  correspondiente (ca → LSC, es → LSE). Se decide en el build, nunca en el cliente.
- Todo el progreso (favoritos, aprendidos) vive en `localStorage` del navegador, detrás de una
  interfaz `ProgressStore` — nada se envía a ningún servidor.

## Gestionar el vocabulario

El proyecto mantiene dos ficheros que dan una vista completa del vocabulario, generados
automáticamente a partir del contenido real (`src/content/signs/*.json`):

- [`docs/vocabulari.md`](docs/vocabulari.md) — catálogo **de solo lectura**, agrupado por
  categoría, con cada palabra en catalán/castellano/inglés y un enlace clicable a su vídeo LSC y/o
  su ficha LSE. Es la forma más rápida de ver de un vistazo qué está cubierto y qué falta.
- [`content/vocabulary.tsv`](content/vocabulary.tsv) — la misma información en formato **editable**
  (ábrela en Excel, Numbers o Google Sheets) para **añadir o corregir** palabras sin tocar JSON a
  mano.

El flujo de trabajo es una ida y vuelta sin pérdida de datos:

```bash
npm run content:export   # regenera ambos ficheros desde el contenido actual
# edita content/vocabulary.tsv: añade una fila para una palabra nueva,
# o corrige el enlace de LSC/LSE de una que ya existe
npm run content:import   # vuelca la hoja editada al contenido (src/content/signs/*.json)
npm run build             # la palabra nueva o corregida ya está en la web
```

El `import` conserva lo que la hoja no gestiona directamente — el estado de verificación
(`draft`/`verified`), las variantes y los consejos de uso — mientras el enlace de origen no
cambie; si cambias un enlace, ese vídeo vuelve a quedar en `draft` porque hay que confirmarlo de
nuevo. Un concepto que se borra de la hoja no se elimina solo: el script avisa y hay que borrarlo
a mano si es intencionado. La lógica de esta conversión tiene sus propios tests unitarios en
[`scripts/lib/vocabulary.test.ts`](scripts/lib/vocabulary.test.ts).

## Requisitos

- Node según [`.nvmrc`](.nvmrc). Con `nvm`: `nvm use`.
- npm 10 o superior.

No hace falta nada más: ni base de datos, ni Docker, ni binarios del sistema.

## Puesta en marcha

```bash
npm ci
npm run dev
```

## Comandos

| Comando                                     | Qué hace                                            |
| ------------------------------------------- | --------------------------------------------------- |
| `npm run dev`                               | Servidor de desarrollo en http://localhost:4321     |
| `npm run build`                             | Build de producción en `dist/`                      |
| `npm run preview`                           | Sirve el build                                      |
| `npm run lint`                              | ESLint + Prettier                                   |
| `npm run typecheck`                         | `astro check` + `tsc --noEmit`                      |
| `npm test`                                  | Tests unitarios (Vitest)                            |
| `npm run test:e2e`                          | Tests end-to-end y accesibilidad (Playwright + axe) |
| `npm run content:export` / `content:import` | Ida y vuelta con la hoja de vocabulario             |

## Calidad

El CI (Ubuntu) es la fuente de verdad. En cada push se ejecutan lint, typecheck, tests unitarios,
end-to-end, accesibilidad con axe y presupuestos de Lighthouse que **fallan el build** si bajan
de 95 en cualquiera de las cuatro categorías (rendimiento, accesibilidad, buenas prácticas, SEO).

## Contribuir

Se aceptan correcciones de signos **aportando siempre la fuente oficial** — no hace falta saber
programar, cada signo es un fichero JSON de diez líneas. También se agradece revisar un vídeo en
`draft` y confirmar (o desmentir) que corresponde al concepto. Ver
[`CONTRIBUTING.md`](CONTRIBUTING.md).

## Licencia

- Código: [MIT](LICENSE).
- Datos curados (etiquetas, categorías): CC BY-SA 4.0.
- Vídeos e imágenes de signos: de sus fuentes respectivas ([Vocabulari bàsic de la
  Generalitat de Catalunya](https://llengua.gencat.cat/ca/llengua_signes_catalana/recursos-i-activitats/vocabulari/)
  y [DILSE, Fundación CNSE](https://fundacioncnse-dilse.org/)), bajo sus propias condiciones. Este
  proyecto no es su autor y no los redistribuye: solo enlaza o incrusta el reproductor oficial.
