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
- Todo vídeo nuevo entra con `"status": "draft"`. Pasar uno a `"verified"` — haber visto el clip
  entero y confirmado que corresponde al concepto — es en sí mismo una contribución muy valiosa.

Si eres una persona sorda o intérprete y ves algo que chirría, dínoslo aunque no tengas la
referencia a mano. Preferimos quitar un signo dudoso a dejarlo.

## Cambios de código

```bash
npm ci
npm run dev
```

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

## Código de conducta

Ver [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md).
