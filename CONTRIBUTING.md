# Cómo contribuir

Gracias por querer echar una mano. Este proyecto es para familias que empiezan de cero, así que
la prioridad es que lo que publicamos sea **correcto** y **fácil de usar con una mano**.

## Correcciones de signos

Es la contribución más valiosa. Si ves un signo mal, una acepción equivocada o una atribución
incompleta:

1. Abre una incidencia o un PR **aportando la fuente oficial** (enlace a la ficha del
   diccionario, no una captura o un recuerdo). Si no tienes cuenta de GitHub, escribe a
   [petitsignes@petitsignes.cat](mailto:petitsignes@petitsignes.cat); cada ficha tiene un
   enlace que ya pone en el asunto de qué signo se trata.
2. Localiza el fichero en `src/content/signs/<slug>.json` — un fichero por concepto.

No hace falta que sepas programar: cada signo es un JSON de diez líneas. Reglas que no se
negocian al tocarlo:

- **Nunca se inventa ni se describe un signo de memoria.** Si no tienes fuente, deja la ficha sin
  vídeo: es más honesto que un vídeo equivocado.
- **Nunca se sustituye el signo de una lengua por el de la otra** (LSC y LSE son lenguas
  distintas). Si falta el vídeo en una, la ficha lo indica y punto.
- Cuidado con los **homógrafos y las acepciones múltiples**: en catalán el acento cambia el
  significado (_més_ = "más" ≠ _mes_ = "mes del calendario"), y una misma palabra castellana
  puede tener veinte vídeos distintos en el diccionario de origen (solo uno es el correcto para
  este contexto). Ante la duda, no lo pongas.
- **Mira el vídeo entero antes de enlazarlo.** Que el título coincida no basta: es justo donde se
  cuelan los errores.

Si eres una persona sorda o intérprete y ves algo que chirría, dínoslo aunque no tengas la
referencia a mano. Preferimos quitar un signo dudoso a dejarlo.

## Problemas de seguridad

No abras una incidencia: son públicas desde el primer momento. Cómo avisar en privado está en
[`SECURITY.md`](SECURITY.md).

## Cambios de código

```bash
npm ci
npm run dev
```

### Ramas

El proyecto usa Gitflow: `feature/*` → `develop` → pull request → `main`. Parte siempre de
`develop`, nunca de `main`, y dirige tu pull request a `develop`.

`main` está protegida: solo entra por pull request, con los tres trabajos del CI en verde, y sin
force-push ni borrado. Es la rama que sirve producción.

Antes de abrir el PR:

```bash
npm run lint && npm run typecheck && npm test && npm run test:e2e
```

En local, los e2e reutilizan un servidor que ya esté escuchando en el puerto 4321. Si tienes otra
copia del repositorio sirviendo ahí (otro worktree, por ejemplo), los tests correrían contra
aquel build: usa otro puerto con `E2E_PORT=4322 npm run test:e2e`.

El CI ejecuta lo mismo en Ubuntu, más una auditoría de las dependencias que se publican
(`npm audit --omit=dev --audit-level=high`) y los presupuestos de Lighthouse. Si falla ahí, está
roto, aunque funcione en tu máquina.

### Lo que se revisa en un PR

- **Accesibilidad.** Teclado completo, foco visible, contraste AA, `aria-*` correctos. El
  objetivo es WCAG 2.2 AA, que es lo que exige la normativa europea (EN 301 549 / Directiva
  2019/882). Es un proyecto sobre lengua de signos: la accesibilidad no es un extra.
- **Diseño con tokens.** Los colores, radios, sombras y duraciones salen de
  `src/styles/global.css`. No introduzcas valores sueltos: rompen el tema oscuro y el contraste.
  Si vas a tocar la interfaz, lee antes [`docs/design-system.md`](docs/design-system.md): explica
  los tokens, los componentes que ya existen y la lista de comprobación que debe pasar cualquiera
  nuevo.
- **JavaScript enviado al cliente.** Si una función se puede hacer con HTML y CSS, se hace con
  HTML y CSS. Las dependencias nuevas hay que justificarlas.
- **Móvil.** Objetivos táctiles de 44 px en los controles principales y nunca por debajo de
  24 px (WCAG 2.5.8); una excepción entre 24 y 44 lleva su razón escrita junto al CSS. Cuerpo de
  texto de 16 px, tamaños en `rem`, y todo alcanzable con el pulgar.
- **TypeScript.** `strict`, sin `any` sin justificar.
- Comentarios y nombres **en inglés**; el contenido de usuario en ca/es/en.
- **Comentarios que se explican solos.** Un comentario da su razón en el propio sitio o enlaza a
  un documento que está en el repositorio: quien lee el código solo tiene el repositorio.
  - Nada de «ver mis notas» ni de una sección citada sin decir de qué documento es. Las únicas
    `§` válidas son las de WCAG (`WCAG 2.2 §2.5.8`), las de la licencia (`AGPL §13`) y, dentro de
    un documento, las de sus propias secciones numeradas. Lo comprueba
    `src/lib/references.test.ts`.
  - Nada de etiquetas de una lista de tareas o de una auditoría (`H5:`, «el fallo que arregló
    C3») en comentarios ni en títulos de tests: el identificador solo significa algo para quien
    tiene esa lista. Describe el problema en sí («cualquier dirección equivocada devolvía la
    portada con un 200»). Esto no lo comprueba ningún test; se mira en la revisión.

### Commits

[Conventional Commits](https://www.conventionalcommits.org/). Hay un hook que lo valida.

```
feat: add practice mode
fix: keep focus inside the video dialog
content: verify LSC video for "llet"
docs: explain the poster decision
```

El tipo `content` es para cambios en los datos de signos.

Un trailer `Co-authored-by` acredita a una **persona** que responde del cambio. El hook rechaza
los que apuntan a una dirección `noreply@` de una cuenta de servicio; la dirección privada que
GitHub da a cada persona (`1234+nombre@users.noreply.github.com`) sí es válida.

## Qué no encaja aquí

- Analítica que rastree a la gente, o cualquier cosa que envíe datos personales fuera.
- Vídeos de signos sin fuente, o generados.
- Convertir esto en un diccionario general: el foco es el vocabulario de 6 a 24 meses.

## Licencia de las contribuciones

Al abrir un PR declaras dos cosas. Están escritas aquí en vez de en un formulario que
haya que firmar, pero cuentan igual.

**1. Que puedes aportarlo.** El trabajo es tuyo, o tienes permiso para aportarlo y para
publicarlo bajo estas condiciones. Nada de código copiado de otro sitio sin comprobar su
licencia, y —regla nº 1 del proyecto— **ningún signo sin fuente oficial verificable**.

**2. Que se publica bajo la licencia del proyecto.** El código entra bajo
**AGPL-3.0-or-later** y los datos curados bajo **CC BY-SA 4.0**, igual que el resto (ver
[`NOTICE`](NOTICE)). Conservas tu autoría y tu copyright: esto no te los quita.

**Y concedes además una licencia no exclusiva para relicenciar.** Es decir: autorizas a
Alexandre Martínez Olmos, como titular del proyecto, a publicar tu contribución también
bajo otras licencias, incluida una licencia comercial.

Esto último se dice en voz alta porque es lo justo, y conviene entender para qué sirve.
La AGPL protege el proyecto de que alguien lo cierre y lo venda, pero tiene un efecto
secundario: si cada contribución queda atada a su autor, el proyecto **no puede volver a
cambiar de licencia nunca** sin localizar y convencer a todo el mundo que haya tocado una
línea. Sin esta cláusula, un solo colaborador ilocalizable congela el proyecto para
siempre. Con ella, sigue habiendo margen de maniobra.

Lo que **no** significa: no cede tu copyright, no es exclusiva, y no permite retirar de la
AGPL nada de lo ya publicado — lo que está liberado, liberado se queda. Cualquiera puede
seguir usando la versión AGPL, siempre.

Si esto no te encaja, dilo en el PR antes de invertir tiempo y lo hablamos.

## Código de conducta

Ver [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md).
