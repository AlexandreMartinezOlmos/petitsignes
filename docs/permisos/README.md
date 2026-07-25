# Permisos de reutilización

Esta carpeta guarda la **prueba escrita** de que podemos usar cada fuente de vídeo, y en qué
condiciones. Sin un documento aquí, un vídeo no se publica.

## Qué guardar

Un fichero por fuente, con el nombre de la fuente (`cnse-dilse.md`, `gencat-fesoca.md`), que
contenga:

1. **Con quién se habló** (entidad, persona de contacto, cargo) y **cuándo**.
2. **Qué se pidió exactamente.** No basta con "¿podemos usar los vídeos?". Hay que preguntar por
   separado:
   - ¿Podemos **enlazar** a la ficha original?
   - ¿Podemos **incrustar** el vídeo?
   - ¿Podemos **descargar y realojar** el fichero en nuestro servidor?
   - ¿Podemos **transformarlo** (transcodificar a MP4/WebM, recortar)?
   - ¿Podemos **extraer un fotograma** y usarlo como imagen de la ficha?
   - ¿Podemos **cachearlo para uso sin conexión** en el dispositivo del usuario (PWA)?
   - ¿Cubre esto también los **derechos de imagen** de las personas que aparecen signando?
3. **La respuesta literal**, copiada o adjunta (correo en PDF, captura, carta).
4. **El texto de atribución** que la fuente exige, tal cual, para poder ponerlo en la ficha.
5. **Caducidad o condiciones** si las hay.

## Por qué tanto detalle

Los derechos sobre estos vídeos son dos cosas distintas y hay que resolver las dos:

- **Copyright** sobre la obra audiovisual, que es de la entidad.
- **Derechos de imagen** de los intérpretes que aparecen. Una autorización de reutilización de
  información pública no cubre automáticamente la imagen de una persona identificable.

Además, las condiciones publicadas y las páginas de licencia pueden contradecirse entre sí (ya
ha pasado con DILSE: ver abajo). Cuando eso ocurre, lo que vale es la autorización expresa por
escrito, no la interpretación más favorable.

## Condiciones de cada fuente, analizadas (23/07/2026)

Este es el análisis que llevó a la decisión de **no alojar ningún vídeo**. Ninguna de las dos
fuentes encaja con el auto-alojamiento.

### DILSE — Fundación CNSE (LSE)

Su [aviso legal](https://fundacioncnse-dilse.org/aviso-legal.php) autoriza la descarga solo para
uso «personal y privado», y **prohíbe expresamente** la distribución, la comunicación pública, la
transformación y instalar los contenidos en un servidor accesible por terceros. Además los
ficheros son `.mov`, que habría que transcodificar para la web — y transformarlos también está
prohibido.

El pie de la web, en cambio, muestra una licencia CC BY-NC-SA 3.0, que sí permitiría compartir.
**Las dos cosas se contradicen.** Ante la contradicción se aplica lo más restrictivo: solo se
enlaza a la ficha original (`delivery: external-link`).

### Vocabulari bàsic de la LSC — Generalitat / FESOCA

Los vídeos están en YouTube. Descargarlos va contra las condiciones de YouTube, con independencia
de la licencia del contenido. El uso previsto es incrustarlos, así que eso es lo que se hace
(`delivery: youtube-embed`, contra `youtube-nocookie.com`).

### Consecuencia de producto, asumida

Sin los ficheros originales cedidos por la fuente **no se puede extraer un fotograma**, así que la
cara estática de la tarjeta no puede ser una imagen del gesto. Hoy es un marcador neutro con el
icono de la categoría, que no enseña ningún gesto incorrecto. `posterUrl` sigue en el esquema: si
algún día hay permiso para extraer fotogramas, rellenarlo es un cambio de datos y no de código.

**Nunca se sustituye por una ilustración del gesto.** Enseñaría configuraciones de mano
incorrectas, que es el daño exacto que este proyecto existe para evitar.

## Estado

| Fuente | Permiso escrito | Alcance en uso hoy |
|---|---|---|
| Gencat / FESOCA (LSC) | ⬜ pendiente de archivar | Solo **incrustar** el reproductor de YouTube del canal oficial |
| Fundación CNSE / DILSE (LSE) | ⬜ pendiente de archivar | Solo **enlazar** a la ficha original |

Ninguna de las dos permite hoy descargar, transcodificar ni servir los vídeos desde nuestro
dominio, así que el proyecto no lo hace. Si se consigue autorización para realojar, actualizar
esta tabla, archivar el documento y solo entonces cambiar el campo `delivery` de las fichas.
