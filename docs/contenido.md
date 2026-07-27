# Cómo añadir o corregir un signo

El contenido es la parte más delicada del proyecto. Un signo mal puesto enseña a un padre un
gesto equivocado, y ese padre se lo enseña a su hijo. Por eso el listón es alto.

**Regla que no se negocia: nunca se publica un signo sin fuente oficial verificable.** Si no
tienes la fuente, deja la ficha sin vídeo. Una ficha sin vídeo es honesta; una con el vídeo
equivocado, no.

## Dónde vive el contenido

```
src/content/signs/<slug>.json   una ficha por concepto (fuente de verdad del build)
src/content/categories.json     las 15 categorías
content/vocabulary.tsv          hoja editable con todas las palabras (ida y vuelta)
docs/vocabulari.md              catálogo generado, con todos los enlaces clicables
```

Un fichero por signo: los diffs son pequeños y una corrección se revisa de un vistazo.

## Dos formas de editar

**A) Directamente en el JSON.** Para una corrección puntual, edita
`src/content/signs/<slug>.json` (formato abajo). Es lo mejor para tocar `tips`, `status` o una
variante concreta.

**B) Con la hoja de vocabulario.** Para añadir palabras o revisar la cobertura de un vistazo, usa
la tabla editable. Los JSON siguen siendo la fuente de verdad; la tabla es una capa cómoda encima
con ida y vuelta sin pérdida:

```bash
npm run content:export   # JSON → content/vocabulary.tsv  y  docs/vocabulari.md
# edita content/vocabulary.tsv en Excel / Numbers / Google Sheets
npm run content:import   # content/vocabulary.tsv → JSON  (fusiona, no pisa)
npm run build            # la palabra nueva ya está en la web
```

Columnas de `vocabulary.tsv`:

| Columna | Qué es |
|---|---|
| `id` | Slug estable = nombre del fichero. No lo cambies (rompe los favoritos guardados). |
| `category` | Una de las 15 categorías. |
| `first_sign_order` | Número → entra en la ruta "Primeros signos"; vacío → no. |
| `difficulty` | 1–3 opcional. |
| `ca` / `es` / `en` | Las tres etiquetas (obligatorias). |
| `lsc_youtube` | Id(s) de YouTube del Vocabulari bàsic. Varios separados por coma = variantes. Vacío = sin LSC. |
| `lse_dilse_term` | Término de búsqueda de DILSE (`?buscar=…`). Vacío = sin LSE. |

El `import` **conserva** lo que no está en la tabla: el `status` de verificación y la etiqueta de
`variant` sobreviven mientras el id/término no cambie, y los `tips` se mantienen. Cambiar un
enlace vuelve a poner ese vídeo en `draft`. Un concepto que ya no esté en la tabla **no se borra**
automáticamente: el script lo avisa y lo borras a mano si es intencionado.

La lógica del round-trip está en [`../scripts/lib/vocabulary.ts`](../scripts/lib/vocabulary.ts) y
tiene tests unitarios; el `build` sigue validando cada ficha con Zod, así que un error en la tabla
rompe el build igual que un error en el JSON.

## Formato de una ficha

```json
{
  "labels": { "ca": "llet", "es": "leche", "en": "milk" },
  "category": "food",
  "isFirstSign": true,
  "firstSignOrder": 1,
  "difficulty": 1,
  "tips": {
    "ca": "…",
    "es": "…",
    "en": "…"
  },
  "videos": []
}
```

| Campo | Obligatorio | Notas |
|---|---|---|
| `labels` | sí | Las tres lenguas. El esquema rechaza que falte una. |
| `category` | sí | Una de las 15 de `categories.json`. |
| `isFirstSign` | sí | Si es `true`, `firstSignOrder` pasa a ser obligatorio. |
| `firstSignOrder` | condicional | Posición en la ruta guiada. |
| `difficulty` | no | 1–3, dificultad motriz aproximada. |
| `tips` | no | Consejo de **uso** (cuándo signarlo), nunca descripción del gesto. |
| `videos` | sí | Puede ser `[]`. |

El `id` sale del nombre del fichero, así que el slug debe ser estable: cambiarlo rompe los
favoritos que la gente tenga guardados.

### Una realización signada

```json
{
  "signLanguage": "lsc",
  "videoUrl": "…",
  "posterUrl": "…",
  "source": "Gencat-VocabulariLSC",
  "sourceUrl": "https://…",
  "license": "…",
  "updatedAt": "2026-07-23",
  "status": "verified",
  "variant": "opcional"
}
```

- `source` solo admite valores conocidos; añadir una fuente nueva implica añadir también su
  atribución en la página de créditos.
- `status` es `draft` hasta que alguien ha **visto el vídeo** y confirmado que corresponde al
  concepto. Solo `verified` cuenta como listo.
- `variant` es para cuando una lengua documenta varias realizaciones del mismo concepto (en LSC,
  por ejemplo, *No* tiene tres). Sin `variant`, el esquema no deja meter dos vídeos de la misma
  lengua para un mismo signo.

El build valida todo esto con Zod: si algo no cuadra, el build falla. Es intencionado.

## El proceso, paso a paso

1. **Busca el concepto en el diccionario oficial.**
   - LSC → [Vocabulari bàsic de la LSC](https://llengua.gencat.cat/ca/llengua_signes_catalana/recursos-i-activitats/vocabulari/)
   - LSE → [DILSE](https://fundacioncnse-dilse.org/)
2. **Comprueba que es la acepción correcta.** Este es el paso donde se cometen los errores.
   Ejemplos reales encontrados al preparar los primeros signos:
   - *Mes* en catalán es el mes del calendario, **no** «más».
   - En DILSE, *más* tiene 24 vídeos: `mas-suma.mov` (aritmética) no sirve; el de bebés es el
     de «más comida».
   - *papá* convive con `papa-alimento.mov`, que es la patata.
   - *mamá* convive con `mama-pecho.mov`.
   Si dudas, **no lo pongas**. Abre una incidencia y que lo mire alguien con conocimiento de la
   lengua.
3. **Mira el vídeo entero.** No basta con que el título coincida.
4. **Anota la fuente**: `sourceUrl` a la ficha original, `license` con las condiciones, y
   `updatedAt` con la fecha en que lo comprobaste.
5. **Deja `status: "draft"`** si no has podido verificarlo del todo.
6. `npm run build` para validar y `npm test` antes de abrir el PR.

## Qué se puede generar y qué no

| Se puede | No se puede |
|---|---|
| Iconos de categoría, ilustraciones decorativas, marca | Cualquier representación del gesto que no venga del vídeo real |
| Traducciones de las etiquetas (ca/es/en) | Describir cómo se hace un signo "de memoria" |
| Consejos de uso (`tips`) | Sustituir un signo que falta en una lengua por el de la otra |

La cara de la tarjeta cuando no hay vídeo es un marcador neutro con el icono de la categoría.
Es deliberado: comunica "todavía no lo tenemos" sin enseñar nada incorrecto.

## Carga masiva desde el Vocabulari bàsic (LSC)

Los 180 conceptos con vídeo LSC se emparejaron contra el **Vocabulari bàsic de la LSC** de la
Generalitat, que es el índice autoritativo del canal oficial de YouTube: 2.480 términos, cada uno
con su vídeo. Es mejor fuente que el listado del canal porque da el **término normalizado** de
cada signo, no el título de un vídeo.

El emparejamiento fue **exacto y sensible a acentos**, y esa decisión es el corazón del asunto:

> En catalán el acento distingue palabras. Un primer intento que ignoraba acentos emparejó
> **`més`** (more, entonces el segundo de los primeros signos) con **`Mes`**, el mes del
> calendario. Son signos distintos: habríamos enseñado el gesto equivocado a un padre, que se lo
> habría enseñado a su hijo. Plegar acentos en una búsqueda de usuario es tolerancia; plegarlos
> al elegir un signo es un error de contenido.
>
> El desenlace refuerza la regla en vez de suavizarla: al buscar `més` a mano tampoco apareció
> ningún vídeo LSC válido, así que el concepto se retiró (§9 de `pendientes.md`). El acierto no
> fue encontrar el signo correcto — fue **no** publicar el incorrecto.

Reglas que quedaron fijadas:

1. **Coincidencia exacta del término**, respetando acentos y diéresis. Nada de aproximaciones.
2. Se separan las alternativas de género que el diccionario escribe con barra (`Gos / gossa`) y
   se ignora el sufijo numérico de los números (`Tres - 3`).
3. Las **variantes numeradas** del diccionario (`Ós (1)`, `Ós (2)`) son realizaciones distintas
   del mismo signo: se cargan **todas**, cada una con su `variant`. 14 conceptos las tienen.
4. Los **cualificadores entre paréntesis** se resuelven a mano, no por regla: `Cap (part del cos)`
   sirve para «cabeza», `Cap (patró)` (jefe) no. `Taronja (fruita)` sí, `Taronja (color)` no.
5. Ante cualquier duda, **no se carga**.

Casos rechazados a propósito, que quedan documentados para que nadie los «arregle» por lote —lo
que no impide que alguien busque y confirme el vídeo correcto a mano, que es justo lo que pasó
después con varios de ellos (ver más abajo):

| Concepto | Candidato | Por qué no |
|---|---|---|
| `sed` (set / sed) | `Set - 7` | Es el número siete; en catalán *set* es homógrafo |
| `estrella` | `Estrella (forma)` | Es la figura geométrica, no el astro |

El vocabulario de la Generalitat es general —con mucha terminología parlamentaria, sanitaria y
geográfica— y no de puericultura, así que la carga automática dejó 49 conceptos sin vídeo LSC y
4 sin enlace LSE.

**Todos los vídeos cargados están en `status: draft`.** El término coincide con el diccionario,
pero nadie ha visto aún cada clip para confirmar la realización. Pasar uno a `verified` es una
contribución muy valiosa: mira el vídeo, comprueba que corresponde al concepto y cambia el campo.

## Búsqueda manual de lo que quedó sin fuente

La carga automática solo cubre lo que el vocabulario de la Generalitat tiene indexado por
término exacto (regla 1 de arriba). Lo que dejó fuera se buscó **a mano, uno por uno**, en el
propio canal de YouTube del Vocabulari bàsic y en el buscador del DILSE:

- **11 conceptos** encontraron su vídeo o enlace correcto bajo **otra palabra** — el matching
  automático no falló por descuido, sino porque el diccionario no signa el verbo o sustantivo
  exacto del catálogo. `abrir` no está, pero `abierto/a` sí; `sed` no está como estado, pero
  `beber` sí; `te quiero` no existe como frase, pero `amar` sí. En estos casos se cambió la
  palabra del catálogo, no el signo: la ficha ahora se llama como el signo real, en las tres
  lenguas de interfaz.
- **5 conceptos** (`ratón`, `adiós`, `estrella`, `tía`, `pantalón`) solo les faltaba una de las
  dos lenguas y se encontró el vídeo o enlace correcto sin tocar la palabra.
- **34 conceptos** no tenían ni una alternativa razonable en una de las dos lenguas —o en
  ninguna— y se **retiraron** del catálogo en vez de quedarse como fichas sin salida. Es la
  misma regla de §1: si no hay fuente verificable, no se inventa ni se rellena con un
  placeholder; se pregunta o, si ya se preguntó y la respuesta es que no existe, se quita.

## Estado actual

195 conceptos: **todos con vídeo LSC y enlace LSE.** **Ninguno está `verified` todavía** — los
390 vídeos cargados están en `draft` a la espera de que alguien vea cada clip. El catálogo
completo, con los enlaces clicables, se genera en [`vocabulari.md`](vocabulari.md).

Las condiciones de reutilización de cada fuente están analizadas en
[`arquitectura.md`](arquitectura.md#entrega-de-vídeo-nada-se-aloja-aquí).
