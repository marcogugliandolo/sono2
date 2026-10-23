# SOÑO · web de la cafetería (versión 2, minimalista)

Segunda versión de la web de SOÑO. Tiene las mismas funciones que la primera (repo `sono`): carta con alérgenos, pedidos para llevar, galería, reservas de mesa, formulario de contacto y el mismo panel para editarlo todo sin tocar código. Cambia el diseño, y añade el Club SOÑO, las reseñas, el historial de versiones y los textos legales con el aviso de cookies.

- **Diseño**: basado en la plantilla de Canva «Cafe Website in Cream Blue Orange Handdrawn Human-centric Style», en versión minimalista. Tiene portada centrada con un bodegón dibujado a línea, franja de «Nuestra historia», carta con tarjetas de favoritos y una caja por sección, bloques de dos tarjetas para «Para llevar» y «Visítanos», y pie en tarjeta.
- **Marca**: el mismo logo SOÑO en vector (el café de la Ñ se mueve) y los colores oficiales: marrón rgb(86, 41, 18) · #562912 y beige rgb(243, 224, 166) · #F3E0A6. El fondo general es un beige muy aclarado (#FBF7EB).
- **Tipografías**: Instrument Serif para los titulares, Geist para el texto y Geist Mono para etiquetas y precios.
- **Panel**: se abre tocando el logo de la cabecera. Usa el mismo usuario y contraseña que la primera web: `ADMIN_USER` y `ADMIN_PASSWORD`.
- **Servidor**: Node.js sin dependencias. Guarda todo en la carpeta de datos (un volumen de Docker).

## La taza que se llena

Justo después de la portada hay una sección, «Así preparamos tu café». Al bajar, el dibujo se queda fijo en el centro y la taza (la misma de la portada, más grande) se llena en tres pasos: la cafetera sirve el café (60 ml), la leche (hasta 220 ml) y después la espuma (250 ml). Al terminar aparecen un corazón en la espuma y el vapor, y la página sigue. Siempre es la misma cafetera, con el mismo tamaño. Con «reducir movimiento» activado en el sistema, o en pantallas muy bajas, la taza aparece ya llena y sin efecto.

## Historial: volver a una versión anterior

Cada vez que se guardan cambios desde el panel en los **ajustes**, los **textos**, la **carta**, las **fotos** o los **horarios**, queda una versión en la pestaña **Historial** con la fecha y un resumen de lo que cambió («Precio de Capuchino: 2,20 € → 2,50 €», «Borrado: Cold brew», «Dirección: …»). Se puede filtrar por parte de la web.

**Volver a esta versión** deja esa parte de la web como estaba en ese momento; el resto no se toca. La versión de antes de volver también se guarda, así que se puede deshacer. Se guardan las últimas 30 versiones de cada parte (en `versiones.json`). La primera vez que arranca, se guarda cómo estaba la web como punto de partida.

El historial es para lo que se cambia desde el panel. Las reservas, pedidos, mensajes, socios del club y reseñas no entran (cada uno tiene su propia pestaña). Tampoco los interruptores del club y de las reseñas: volver a una versión de Ajustes no los enciende ni los apaga.

## Club SOÑO: tarjeta de sellos

Los clientes se hacen socios desde la web (sección «Club»): nombre, email, teléfono opcional y una contraseña. Al entrar se abre su tarjeta en una ventana con los sellos (la Ñ del logo, una por desayuno), su código QR y los últimos movimientos. Mientras la tarjeta está abierta se actualiza sola, así ven el sello en cuanto se lo ponéis. Con `#tarjeta` al final de la dirección (por ejemplo `https://tu-dominio/#tarjeta`) se abre la tarjeta directamente; pueden guardarlo como acceso en el móvil.

En el panel, pestaña **Club**:
- **Club activo en la web**: interruptor arriba de la pestaña. Se guarda al momento. Desactivado, el club no sale en la web (ni la sección, ni el menú, ni la tarjeta) y nadie puede apuntarse ni entrar; los socios y sus sellos se conservan para cuando se vuelva a activar.
- **Escanear QR**: abre la cámara del móvil o la tablet, lee el QR del socio y **le pone el sello directamente**. No lo pone solo si la tarjeta ya está completa (toca canjear el premio) o si a ese socio se le acaba de sellar escaneando hace menos de 2 minutos (para no sumar dos por error); en esos casos se pulsa el botón. La cámara del navegador solo funciona si la web va por **https** (con su dominio); por `http://IP:puerto` no. Mientras tanto, se puede escribir el **código** que sale debajo del QR (por ejemplo `BZ4Z-4BAR`).
- **+1 sello**, **−1** para corregir y **Canjear premio** cuando la tarjeta está completa (la tarjeta vuelve a empezar y lo que sobre se conserva).
- **Quién atiende**: el nombre que escribáis sale en la tarjeta del socio («Sello añadido por Marta»). Se recuerda en cada dispositivo.
- **Nueva contraseña** para quien la haya olvidado: se enseña una vez para dársela al socio y cierra sus sesiones abiertas.
- **Borrar socio**, y una lista de socios con buscador por nombre, email, teléfono o código.

En la pestaña **Club**, bajo el interruptor, está **Tarjeta de sellos**: cuántos sellos tiene la tarjeta (de 3 a 20; por defecto 10) y cuál es el premio, con su botón «Guardar premio y sellos». El cambio queda en el historial de Ajustes.

### La tarjeta en la cartera del móvil (Apple Wallet y Google Wallet)

En la ventana de la tarjeta del socio salen los botones **Añadir a Apple Wallet** (en el iPhone y en el ordenador) y **Añadir a Google Wallet** (en Android y en el ordenador). La tarjeta lleva el logo, los colores de SOÑO, los sellos con la Ñ del logo y el mismo QR que se escanea en la barra, y **se actualiza sola** cuando se pone un sello, se canjea el premio o se cambian los sellos o el premio en la pestaña Club (en el iPhone sale un aviso: «Nuevo sello en tu tarjeta de SOÑO»).

Cada botón solo sale cuando está configurado. **Todo se configura desde el panel, también desde el móvil**: pestaña **Club** → *Tarjeta en el móvil (Wallet)*. Ahí se ve si Apple y Google están listos o qué falta, cuántos iPhone tienen la tarjeta y cuándo caduca el certificado de Apple, con los pasos numerados y los enlaces a cada web.

Hace falta que la web vaya por **https** con su dominio, y conviene poner esa dirección en el stack: `WALLET_URL=https://tu-dominio`. Las rutas `/wallet/…` tienen que llegar al contenedor sin contraseña del proxy (Apple y Google las llaman directamente).

**Apple Wallet** (con la cuenta de Apple Developer), desde el panel:
1. **Descargar solicitud**: el servidor crea la clave privada (se queda en el volumen de datos, nunca sale de él) y te da el archivo `SONO.certSigningRequest`.
2. En [developer.apple.com](https://developer.apple.com/account/resources/identifiers/list/passTypeId) → *Identifiers* → **+** → *Pass Type IDs*: descripción «Club SOÑO» e identificador tipo `pass.es.tudominio.club`. Después, en *Certificates* → **+** → *Pass Type ID Certificate*, eliges ese ID, subes la solicitud y descargas `pass.cer`.
3. **Subir certificado** en el panel. El certificado intermedio de Apple (WWDR G4) lo descarga el servidor solo; si no tiene salida a internet, el panel da el enlace para subirlo con el mismo botón.
4. El certificado dura un año: cuando falte menos de un mes el panel lo marca. Se repiten los mismos pasos (las tarjetas que ya tienen los socios siguen valiendo si usas el mismo Pass Type ID).

Si el iPhone no deja guardar el `.cer`, los pasos 2 y 3 se pueden hacer desde un ordenador. También se pueden copiar los archivos a mano a `/app/data/wallet/apple/` (certificado, clave y WWDR G4, con cualquier nombre; un `.p12` del Llavero se convierte con `openssl pkcs12 -in certificado.p12 -out pass.pem -nodes -legacy`; si la clave tiene contraseña, va en `WALLET_APPLE_KEY_PASSWORD`).

**Google Wallet** (gratis), desde el panel:
1. En la [Google Pay & Wallet Console](https://pay.google.com/business/console) → **Google Wallet API** → crea la cuenta de emisor y copia el **Issuer ID** (un número largo).
2. En [Google Cloud](https://console.cloud.google.com/) crea un proyecto, activa la **Google Wallet API** y, en *IAM* → *Cuentas de servicio*, crea una cuenta de servicio (sin permisos).
3. La clave de esa cuenta: en el panel pulsa **Crear certificado** (el servidor crea la clave privada, que nunca sale de él, y te da `sono-google-wallet.pem`) y súbelo en la cuenta de servicio → *Claves* → *Agregar clave* → **Subir clave existente**. Después escribe en el panel el Issuer ID y el correo de la cuenta de servicio y pulsa **Guardar y comprobar**: el servidor comprueba con Google que funciona y, si todo va bien, crea la tarjeta del Club SOÑO en tu emisor. (También vale una clave **JSON** descargada de Google Cloud: se elige en el panel con «O elegir una clave .json».)
4. Si el panel dice que falta permiso: en la Wallet Console → *Usuarios*, invita al email de la cuenta de servicio (sale en el panel, con botón para copiarlo) con permiso de **Desarrollador** y pulsa **Comprobar con Google**. Mientras la comprobación diga que algo falla, el botón de Google Wallet no sale a los socios.
5. Al principio la cuenta está en **modo de prueba**: solo pueden guardar la tarjeta las cuentas de Google que añadas como usuarios de prueba. Cuando funcione, pide el **acceso de publicación** en la Wallet Console para que la pueda guardar cualquiera.

Las claves y certificados se guardan en `wallet/apple/` y `wallet/google/` dentro del volumen de datos (solo los puede leer el servidor) y los iPhone que tienen la tarjeta en `wallet/registros.json`. La política de privacidad ya explica qué se guarda al añadir la tarjeta a la cartera.

Con la sesión de socio iniciada, en el menú de arriba (y en la cabecera del móvil) el enlace del club se cambia por la **Ñ del logo resaltada**, que abre su tarjeta.

Los socios pueden darse de baja ellos mismos desde su tarjeta (se borran sus datos). Las contraseñas se guardan cifradas (scrypt) y la sesión del socio dura 120 días. Al recoger nombre, email y teléfono, conviene mencionarlo en la política de privacidad de la cafetería.

Los datos del club están en `socios.json` y la clave que firma las sesiones en `secreto.json`, dentro del volumen de datos. Si se pierde `secreto.json`, los socios solo tienen que volver a entrar.

## Soñito, el asistente de la web

Abajo a la derecha sale un botón **«¿Te ayudo?»** con un ayudante que responde al momento, con la información que ya tiene la web: horario (y si hoy está abierto), dirección con enlace a Google Maps, la carta (precio, descripción y alérgenos de cada producto: «¿cuánto cuesta el capuchino?», «¿el cruasán lleva huevo?»), qué se puede tomar sin un alérgeno («algo sin gluten»), reservas, pedidos para llevar y el club. Si no sabe algo, ofrece **llamar**, **WhatsApp**, email o el formulario de contacto. Tiene preguntas rápidas para tocar sin escribir.

No usa inteligencia artificial ni servicios de fuera, no guarda nada de lo que se escribe y no cuesta nada. Sale cuando la persona ya ha elegido en el aviso de cookies (así no se tapan). En **Ajustes → Asistente de la web** se quita o se le cambia el nombre.

## Textos y menú

En el panel, pestaña **Textos**:

- **Menú**: el nombre de cada enlace («Nosotros», «Carta», «Visítanos»…) y su orden con ↑ ↓. El orden es el mismo en la cabecera, en el menú del móvil y en el pie.
- **Textos de cada parte de la web**: etiqueta, título y textos de la portada, «Así preparamos tu café», Nosotros, Carta, Para llevar, Club, Galería, Reseñas, Visítanos y el pie. Si un texto se deja vacío, vuelve el original. En el texto del club, `{premio}` y `{sellos}` se cambian solos por el premio y los sellos de la pestaña Club.

Se guarda con «Guardar cambios» y queda en el Historial. El servidor ya manda la página con los textos puestos, así que no parpadea al cargar. Los textos originales son los del propio `public/index.html` (cada uno lleva `data-texto="…"`).

## Fotos, GIF y vídeos de la carta

Cada producto puede llevar una **foto** (también las HEIC del iPhone: el navegador las pasa a JPG), un **GIF** animado o un **vídeo corto** (MP4, MOV o WebM, hasta 30 segundos y 30 MB). El vídeo se ve sin sonido y en bucle, como un GIF. Si un vídeo del iPhone está en HEVC, el panel avisa: en algunos Android no se ve, y conviene grabar en «Más compatible» (Ajustes → Cámara → Formatos). La galería solo admite fotos.

Si la web va detrás de un proxy (por ejemplo Nginx Proxy Manager), sube su límite de subida para los vídeos (`client_max_body_size 32m;`).

## La carta en su propia página

La carta también se puede ver sola en **`/carta`** (por ejemplo `https://gruposono.com/carta`), con la cabecera, la carta y el formulario de «Para llevar» debajo. Va bien para un QR en las mesas.

En el panel, pestaña **Carta**, el interruptor **«Carta en su propia página»** la quita de la página de inicio: los enlaces «Carta» del menú y del pie y el botón «Ver la carta» pasan a abrir `/carta`, y los enlaces antiguos a `/#carta` también llevan allí. Se guarda al momento y no cambia al guardar Ajustes ni al volver a una versión anterior.

## Reseñas

Sección «Lo que nos contáis», después de la galería. Arriba sale la nota media (por ejemplo, 4,6 con 12 reseñas) y debajo las reseñas en un **slider**: 3 tarjetas a la vez en el ordenador, 2 en la tableta y 1 en el móvil (asomando la siguiente). Se pasa con el dedo, arrastrando con el ratón (o con el trackpad) y con las flechas del teclado, y una barra fina indica por dónde vas; si caben todas, la barra no sale. Las reseñas largas se cortan a unas líneas con «Leer entera». Cualquiera puede escribir una desde «Escribir una reseña»: estrellas del 1 al 5, nombre (como quiera que salga), comentario y la casilla para aceptar que se publique. Si quien escribe tiene abierta su tarjeta del club, la reseña sale con la etiqueta «Socio del club».

Las reseñas **no salen en la web hasta que se publican** desde el panel, pestaña **Reseñas**:
- **Reseñas activas en la web**: interruptor arriba de la pestaña, como el del club. Se guarda al momento. Desactivado, la sección y el enlace del menú desaparecen y nadie puede escribir; las reseñas se guardan para cuando se vuelva a activar.
- Filtros **Por revisar**, **Publicadas**, **Ocultas** y **Todas**. La pestaña muestra cuántas hay por revisar, por ejemplo «Reseñas (2)».
- En cada reseña: **Publicar**, **Ocultar** (deja de salir en la web pero no se borra), **Responder** (la respuesta sale debajo, firmada por SOÑO) y **Borrar**.

Conviene publicar también las negativas si son respetuosas: es lo que dice el aviso legal («publicamos tanto las buenas como las malas») y lo que da confianza. Solo se dejan fuera las que tienen insultos, datos de otras personas, publicidad o nada que ver con SOÑO. Las reseñas no se pueden editar, solo publicar, ocultar, responder o borrar.

Con `#escribir-resena` al final de la dirección (por ejemplo `https://tu-dominio/#escribir-resena`) se abre directamente la ventana para escribir una; sirve para un QR en las mesas o en el ticket.

Para evitar spam: hay una trampa para bots, cada IP puede enviar 3 reseñas por hora y como mucho se guardan 200 por revisar. Se guardan en `resenas.json`.

## Cookies, aviso legal y privacidad

- **Aviso de cookies**: una tarjeta beige abajo a la izquierda con una galleta dibujada, que sale la primera vez que se entra. Tiene **Aceptar** y **Rechazar** con el mismo aspecto (como pide la guía de la AEPD); con cualquiera de los dos, la galleta se come a mordiscos rápidos y el aviso se va. La elección se guarda un año (en `sono2-cookies`, en el navegador) y se puede cambiar cuando se quiera con **Configurar cookies**, en el pie de la web, o en la política de cookies («Cambiar mi elección»).
  Ahora mismo la web solo usa cookies técnicas (la de la tarjeta del club y la del panel), que no se pueden rechazar porque sin ellas no funcionaría lo que pide el propio usuario (artículo 22.2 de la LSSI). Por eso «Rechazar» deja la web igual: el aviso pregunta por las cookies opcionales, que hoy no hay. **Si algún día se añade Google Analytics, el píxel de Meta, un mapa de Google o un vídeo de YouTube, hay que cargarlo solo si `window.sonoCookies.eleccion() === 'aceptadas'`** (o al recibir el evento `sono:cookies`), y añadirlo a la política de cookies en `public/legal.js`.
- **Textos legales en su propia página**: `/aviso-legal`, `/privacidad` y `/cookies` (una sola página con tres pestañas). Se enlazan desde el pie de la web, y cada formulario (reservas, pedidos, «Escríbenos», club y reseñas) lleva una línea corta que explica para qué se usan los datos, con el enlace a la política de privacidad.
- Los textos se rellenan solos con **Ajustes → Datos legales**: titular (nombre y apellidos o razón social), NIF o CIF, domicilio y email para privacidad (si se dejan vacíos, se usan la dirección y el email de contacto) y los datos del Registro Mercantil si es una sociedad. Mientras falten el titular o el NIF, el panel avisa y en la página sale «Por completar». La fecha de «Última actualización» cambia sola cuando se tocan estos datos.
- Los textos se adaptan a lo que está activo (pedidos para llevar, club y reseñas) y cuentan lo que hace la web de verdad: qué datos se guardan, para qué y cuánto tiempo. Si se cambia algo de eso en el código, hay que cambiarlo también en `public/legal.js`.
- Son una base pensada para esta web, no asesoramiento legal: conviene que la gestoría o un abogado los revise antes de abrir. Si la web va detrás de Cloudflare u otro servicio fuera de la UE, también habría que mencionarlo en la política de privacidad.

**Borrado automático** (lo que dice la política de privacidad): las reservas se borran 90 días después de su fecha, los pedidos a los 30 días y los mensajes y las candidaturas (con su currículum) al año. Se hace al arrancar y cada 6 horas.

## Lo mejor del mes (en la carta)

Arriba de la carta, antes de los favoritos, sale un recuadro beige con **lo mejor del mes**: hasta 3 destacados (por ejemplo «Café del mes», «Dulce del mes» y «Desayuno del mes»). Con uno solo, la tarjeta va en grande; con dos o tres, en fila. Cada tarjeta lleva un sello redondo con el nombre del mes en curso, que cambia solo.

Se gestiona arriba del todo en la pestaña **Carta** del panel, en el bloque «Lo mejor del mes»:
- **«Lo mejor del mes» en la carta**: interruptor arriba, como el del club o las reseñas. Se guarda al momento. Apagado, el recuadro no sale y lo que haya preparado se guarda.
- Cada destacado tiene una **etiqueta** libre y puede ser un **producto de la carta** (sale con su nombre, precio, foto y alérgenos, con los botones «Pedir para llevar» y «Ver detalles y alérgenos») o algo **escrito a mano** (nombre, precio opcional y un dibujo). En los dos casos se puede escribir por qué lo recomendáis y poner una foto, un GIF o un vídeo corto propios.
- Se guarda con el mismo «Guardar cambios» de la carta y queda en **Historial** (filtro «Del mes»). Los títulos del recuadro se cambian en **Textos → Carta: lo mejor del mes**.
- Si es un producto de la carta, no se repite en las tarjetas de favoritos de debajo.
- Soñito lo sabe: a «¿qué me recomendáis?» responde con lo mejor del mes.

## Trabaja con nosotros (candidaturas con currículum)

En «Escríbenos» (sección Visítanos) se elige entre **Una consulta** y **Trabaja con nosotros**. La candidatura pide nombre y email, y deja poner teléfono, qué le gustaría hacer, unas líneas sobre la persona y el **currículum** (PDF, Word u OpenDocument, o una foto; hasta 5 MB, tocando la zona o arrastrando el archivo). Hace falta el currículum o al menos unas líneas, y aceptar la casilla de privacidad. En el pie hay un enlace «Trabaja con nosotros», y `#trabaja` al final de la dirección (`https://tu-dominio/#trabaja`) abre directamente el formulario, por ejemplo para un cartel con QR.

Las candidaturas llegan a la pestaña **Mensajes** del panel, junto a las consultas, con los filtros **Todos**, **Consultas** y **Candidaturas**. En cada una: **Ver currículum** (los PDF y las fotos se abren en el navegador), **Descargar**, **Responder por email** y **Borrar** (borra también el archivo). Arriba de la pestaña está el interruptor **«Trabaja con nosotros» en la web**: apagado, desaparece de la web y nadie puede mandar su currículum; lo recibido se guarda.

Los currículums se guardan en la carpeta `cv/` de los datos, **no se pueden abrir desde la web pública** (solo con la sesión del panel) y se comprueban por su contenido, no por el nombre. Se borran solos al año, como los mensajes. Cada IP puede mandar 3 candidaturas por hora y se guardan como mucho 300. La política de privacidad ya lo explica (qué datos, para qué, base legal y plazo).

## Novedad: favoritos

Encima de las cajas de la carta salen 4 productos destacados en tarjetas. Para elegirlos, añade la etiqueta `Favorito` a los productos en el panel (pestaña **Carta**). Si hay menos de 4 marcados, el resto se completa solo con un producto de cada sección, primero los que tienen foto.

## Zonas al reservar

Al reservar mesa se puede elegir zona en un mini plano: interior, zona de lectura, terraza (dibujada fuera del local) o «Donde haya sitio». En **Ajustes → Zonas para reservar** se renombran, se añaden (hasta 6, con dibujo de mesas, terraza, lectura o barra) y se desactivan. La zona elegida aparece en cada reserva del panel.

## Estructura

```
server.js              servidor web y API
datos-iniciales.json   carta y horarios de partida (solo se usan el primer arranque)
public/                la web: index.html, styles.css, app.js, tipografías
public/legal.html      página de aviso legal, privacidad y cookies (el texto está en legal.js)
public/cookies.js      aviso de cookies (lo usan la web y la página legal)
wallet.js              tarjeta del club para Apple Wallet y Google Wallet (sin dependencias)
textos.js              textos y menú editables (los aplica a la página antes de enviarla)
wallet/                logo, iconos y sellos con los que se dibuja la tarjeta de Wallet
public/vendor/         librerías del QR del club (dibujarlo y leerlo con la cámara), con sus licencias
stack-portainer.yml    stack para el «Web editor» de Portainer (descarga el código de GitHub)
Dockerfile             imagen de la web
docker-compose.yml     stack para Portainer con la imagen de GitHub
.github/workflows/     construye la imagen y la publica en GitHub Container Registry
```

## Variables de entorno

| Variable | Para qué sirve | Valor por defecto |
|---|---|---|
| `ADMIN_PASSWORD` | Contraseña del panel. **Obligatoria**. Pon la misma que en la web `sono`. | — |
| `ADMIN_USER` | Usuario del panel | `soño` (también vale `sono`) |
| `PUERTO` | Puerto del servidor donde se publica la web (solo `docker-compose.yml`) | `8081` |
| `TRUST_PROXY` | `true` si la web va detrás de un proxy (Nginx Proxy Manager, Traefik, Cloudflare Tunnel) | `true` |
| `COOKIE_SECURE` | `auto` marca la sesión como segura cuando la web va por HTTPS | `auto` |
| `WALLET_URL` | Dirección pública con https (para Apple Wallet y Google Wallet) | la de cada petición |
| `WALLET_GOOGLE_ISSUER_ID` | Issuer ID de Google Wallet (opcional: mejor desde el panel, que manda sobre esta) | — |
| `WALLET_APPLE_KEY_PASSWORD` | Contraseña de la clave del certificado de Apple, si tiene | — |

La cookie de sesión se llama `sono2_sesion`, distinta de la de la primera web, así que las dos pueden estar en el mismo servidor sin cerrarse la sesión una a otra.

## Probar en tu ordenador

Necesitas Node.js 20 o superior.

```bash
ADMIN_PASSWORD=2026 node server.js
```

Abre http://localhost:3000. Los datos se guardan en la carpeta `data/`.

## Publicar en el servidor con Portainer

### Opción A · Web editor (la más sencilla)

1. En Portainer: **Stacks** → **Add stack**, nombre `sono2`, método **Web editor**.
2. Pega el contenido de `stack-portainer.yml`.
3. Cambia `ADMIN_PASSWORD` por la misma contraseña que usa el stack `sono`. Si el puerto 3071 está ocupado, cambia el número de la izquierda en `ports`.
4. **Deploy the stack**.

En cada arranque el contenedor descarga la última versión de `main` desde GitHub. Para actualizar la web basta con subir los cambios y reiniciar el contenedor desde Portainer. Los datos se guardan en el volumen `sono2_datos` y no se pierden.

### Opción B · Imagen ya construida en GitHub

Cada vez que se sube un cambio a `main`, GitHub Actions construye la imagen para x86 y ARM (vale para Contabo, Oracle y las Raspberry Pi) y la publica en `ghcr.io/marcogugliandolo/sono2:latest`. La primera vez, hazla pública: en GitHub ve a tu perfil → **Packages** → **sono2** → **Package settings** → **Change visibility** → **Public**.

Después, en Portainer: **Stacks** → **Add stack**, nombre `sono2`, método **Repository**, con la URL de este repositorio, la referencia `refs/heads/main` y el Compose path `docker-compose.yml`. En **Environment variables** añade `ADMIN_PASSWORD` (y si quieres `PUERTO`). Para actualizar, pulsa **Pull and redeploy** cuando la acción termine en verde.

## Usar la misma carta que la primera web

La versión 2 empieza con la carta de ejemplo. Para copiar la carta, horarios, datos y fotos de la primera web, ejecuta esto en el servidor con los nombres de volumen que muestra Portainer en **Volumes**. Después, reinicia `sono2`.

```bash
docker run --rm -v sono_sono_datos:/origen:ro -v sono2_sono2_datos:/destino alpine \
  sh -c "cp /origen/contenido.json /destino/ && cp -r /origen/fotos/. /destino/fotos/"
```

Las reservas, los pedidos y los mensajes de cada web siguen separados.

## Copia de seguridad

Todo está en el volumen del stack (Portainer lo llama `sono2_sono2_datos`): `contenido.json`, `reservas.json`, `pedidos.json`, `mensajes.json`, `socios.json`, `resenas.json`, `secreto.json`, `versiones.json`, la carpeta `fotos/`, la carpeta `cv/` (currículums de «Trabaja con nosotros») y la carpeta `wallet/` (certificados de Apple, clave de Google y los iPhone registrados; guarda esa copia en un sitio seguro, porque lleva claves privadas).

```bash
docker run --rm -v sono2_sono2_datos:/datos -v "$PWD":/copia alpine \
  tar czf /copia/sono2-copia-$(date +%F).tgz -C /datos .
```

## Seguridad

- El panel pide usuario y contraseña al servidor; la contraseña no está en el código de la web.
- Tras 5 intentos fallidos desde la misma IP, el acceso se bloquea 15 minutos.
- La sesión dura 12 horas y la cookie solo la puede leer el servidor.
- Las fotos y vídeos se comprueban por su contenido, no por el nombre (JPG, PNG, WebP o GIF hasta 10 MB; MP4, MOV o WebM hasta 30 MB) y el navegador reduce las fotos antes de subirlas.
- Las reservas, los pedidos, los mensajes y las candidaturas tienen límite de envíos por IP y una trampa para bots.
- Los currículums solo se abren con la sesión del panel y se aceptan solo PDF, Word, OpenDocument o fotos, mirando su contenido (hasta 5 MB).
- El total de cada pedido lo calcula el servidor con los precios de la carta, no el navegador.
- Usa una contraseña larga en `ADMIN_PASSWORD`, sobre todo si la web es pública.

## Alérgenos

Los 14 alérgenos de declaración obligatoria (Reglamento UE 1169/2011) se marcan en cada producto desde el panel, pestaña **Carta**. Los que trae la carta de ejemplo son orientativos: revisadlos con vuestras recetas y proveedores antes de abrir.

## Tipografías e iconos

Instrument Serif, Geist y Geist Mono están alojadas en `public/fuentes` con su licencia SIL Open Font License (`LICENCIAS.txt`). No se cargan desde Google, así que la web no hace peticiones a terceros.

El icono de la pestaña (`favicon.ico`, `favicon.svg` y `apple-touch-icon.png`) es el logo.

## Horas de recogida

Los pedidos para recoger se pueden programar para hoy, mañana o pasado mañana, en las mismas horas que las reservas (pestaña **Horarios** del panel). Si no hay horas puestas, el pedido se envía sin hora y se acuerda por teléfono.
