# Cómo contribuir

Gracias por querer echar una mano. Este proyecto es para familias que empiezan de cero, así que
la prioridad es que lo que publicamos sea **correcto** y **fácil de usar con una mano**.

## Correcciones de signos

Es la contribución más valiosa. Si ves un signo mal, una acepción equivocada o una atribución
incompleta:

1. Abre una incidencia o un PR **aportando la fuente oficial** (enlace a la ficha del
   diccionario, no una captura o un recuerdo).
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

El CI ejecuta lo mismo en Ubuntu más los presupuestos de Lighthouse. Si falla ahí, está roto,
aunque funcione en tu máquina.

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
- **Móvil.** Objetivos táctiles de 44 px como mínimo, texto de 16 px o más, todo alcanzable con
  el pulgar.
- **TypeScript.** `strict`, sin `any` sin justificar.
- Comentarios y nombres **en inglés**; el contenido de usuario en ca/es/en.

### Commits

[Conventional Commits](https://www.conventionalcommits.org/). Hay un hook que lo valida.

```
feat: add practice mode
fix: keep focus inside the video dialog
content: verify LSC video for "llet"
docs: explain the poster decision
```

El tipo `content` es para cambios en los datos de signos.

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
