# Seguridad

Petits Signes es un sitio estático: no tiene cuentas ni servidor propio, y no guarda datos
personales. El progreso de cada visitante vive solo en su navegador. Aun así, si encuentras un
problema de seguridad, avísanos **en privado** antes de hacerlo público.

## Cómo avisar

- **Aviso privado en GitHub** (preferido):
  [abre un aviso de vulnerabilidad](https://github.com/AlexandreMartinezOlmos/petitsignes/security/advisories/new).
  Solo lo ve quien mantiene el proyecto, y permite preparar el arreglo sin exponer el problema.
- **Correo**: [petitsignes@petitsignes.cat](mailto:petitsignes@petitsignes.cat), si no tienes
  cuenta de GitHub.

**No abras una incidencia pública** para un problema de seguridad: las incidencias las puede leer
cualquiera desde el primer momento.

Ayuda mucho que el aviso diga en qué página o fichero está el problema, qué pasa, cómo
reproducirlo y qué podría hacer alguien con él.

## Qué puedes esperar

Acusamos recibo del aviso y te mantenemos al tanto hasta que esté resuelto. Cuando el arreglo esté
publicado, el aviso se hace público en el repositorio con tu nombre, si quieres que figure.

## Alcance

- El sitio [petitsignes.cat](https://petitsignes.cat) y el código de este repositorio.
- Las cabeceras de seguridad y la política de seguridad de contenido, que viven en
  [`public/_headers`](public/_headers) y [`src/lib/csp.ts`](src/lib/csp.ts).

Fuera de alcance, porque no son de este proyecto: los reproductores y vídeos de YouTube, el
diccionario DILSE, GoatCounter y Cloudflare. Un problema en ellos se avisa a quien los mantiene.

Solo se da soporte a la versión publicada, que es la rama `main`.

La dirección de contacto para máquinas está en
[`/.well-known/security.txt`](https://petitsignes.cat/.well-known/security.txt) (RFC 9116).
