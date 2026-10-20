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

Cada vez que se guardan cambios desde el panel en la **carta**, las **fotos**, los **horarios** o los **ajustes**, queda una versión en la pestaña **Historial** con la fecha y un resumen de lo que cambió («Precio de Capuchino: 2,20 € → 2,50 €», «Borrado: Cold brew», «Dirección: …»). Se puede filtrar por parte de la web.

**Volver a esta versión** deja esa parte de la web como estaba en ese momento; el resto no se toca. La versión de antes de volver también se guarda, así que se puede deshacer. Se guardan las últimas 30 versiones de cada parte (en `versiones.json`). La primera vez que arranca, se guarda cómo estaba la web como punto de partida.

El historial es para lo que se cambia desde el panel. Las reservas, pedidos, mensajes, socios del club y reseñas no entran (cada uno tiene su propia pestaña). Tampoco los interruptores del club y de las reseñas: volver a una versión de Ajustes no los enciende ni los apaga.

## Club SOÑO: tarjeta de sellos

Los clientes se hacen socios desde la web (sección «Club»): nombre, email, teléfono opcional y una contraseña. Al entrar se abre su tarjeta en una ventana con los sellos (una taza por desayuno), su código QR y los últimos movimientos. Mientras la tarjeta está abierta se actualiza sola, así ven el sello en cuanto se lo ponéis. Con `#tarjeta` al final de la dirección (por ejemplo `https://tu-dominio/#tarjeta`) se abre la tarjeta directamente; pueden guardarlo como acceso en el móvil.

En el panel, pestaña **Club**:
- **Club activo en la web**: interruptor arriba de la pestaña. Se guarda al momento. Desactivado, el club no sale en la web (ni la sección, ni el menú, ni la tarjeta) y nadie puede apuntarse ni entrar; los socios y sus sellos se conservan para cuando se vuelva a activar.
- **Escanear QR**: abre la cámara del móvil o la tablet, lee el QR del socio y **le pone el sello directamente**. No lo pone solo si la tarjeta ya está completa (toca canjear el premio) o si a ese socio se le acaba de sellar escaneando hace menos de 2 minutos (para no sumar dos por error); en esos casos se pulsa el botón. La cámara del navegador solo funciona si la web va por **https** (con su dominio); por `http://IP:puerto` no. Mientras tanto, se puede escribir el **código** que sale debajo del QR (por ejemplo `BZ4Z-4BAR`).
- **+1 sello**, **−1** para corregir y **Canjear premio** cuando la tarjeta está completa (la tarjeta vuelve a empezar y lo que sobre se conserva).
- **Quién atiende**: el nombre que escribáis sale en la tarjeta del socio («Sello añadido por Marta»). Se recuerda en cada dispositivo.
- **Nueva contraseña** para quien la haya olvidado: se enseña una vez para dársela al socio y cierra sus sesiones abiertas.
- **Borrar socio**, y una lista de socios con buscador por nombre, email, teléfono o código.

En **Ajustes → Club SOÑO** se elige cuántos sellos tiene la tarjeta (de 3 a 20; por defecto 10) y cuál es el premio. Activarlo o desactivarlo solo se hace con el interruptor de la pestaña **Club**.

### La tarjeta en la cartera del móvil (Apple Wallet y Google Wallet)

En la ventana de la tarjeta del socio salen los botones **Añadir a Apple Wallet** (en el iPhone y en el ordenador) y **Añadir a Google Wallet** (en Android y en el ordenador). La tarjeta lleva el logo, los colores de SOÑO, las tazas selladas y el mismo QR que se escanea en la barra, y **se actualiza sola** cuando se pone un sello, se canjea el premio o se cambian los sellos o el premio en Ajustes (en el iPhone sale un aviso: «Nuevo sello en tu tarjeta de SOÑO»).

Cada botón solo sale cuando está configurado. En el panel, pestaña **Club**, se ve si Apple y Google están listos o qué falta, cuántos iPhone tienen la tarjeta y cuándo caduca el certificado de Apple.

Hace falta que la web vaya por **https** con su dominio, y conviene poner esa dirección en el stack: `WALLET_URL=https://tu-dominio`. Las rutas `/wallet/…` tienen que llegar al contenedor sin contraseña del proxy (Apple y Google las llaman directamente).

**Apple Wallet** (con la cuenta de Apple Developer):
1. En [developer.apple.com](https://developer.apple.com/account/resources/identifiers/list/passTypeId) → *Identifiers* → **+** → *Pass Type IDs*. Descripción «Club SOÑO» e identificador tipo `pass.es.tudominio.club`.
2. En el servidor (o en cualquier ordenador con OpenSSL), crea la clave y la solicitud del certificado:
   ```bash
   openssl req -new -newkey rsa:2048 -nodes -keyout pass.key -out pass.csr -subj "/CN=Club SONO"
   ```
3. En ese Pass Type ID → **Create Certificate** → sube `pass.csr` y descarga `pass.cer`.
4. Descarga el certificado intermedio de Apple **WWDR G4**: [AppleWWDRCAG4.cer](https://www.apple.com/certificateauthority/AppleWWDRCAG4.cer).
5. Copia los tres archivos al contenedor y reinícialo:
   ```bash
   docker exec sono2_web mkdir -p /app/data/wallet/apple
   docker cp pass.cer sono2_web:/app/data/wallet/apple/
   docker cp pass.key sono2_web:/app/data/wallet/apple/
   docker cp AppleWWDRCAG4.cer sono2_web:/app/data/wallet/apple/
   docker restart sono2_web
   ```
   Los nombres dan igual: la web reconoce cuál es cada uno. Si exportaste el certificado como `.p12` desde el Llavero del Mac, conviértelo antes: `openssl pkcs12 -in certificado.p12 -out pass.pem -nodes -legacy` (y copia `pass.pem` en lugar de `pass.cer` y `pass.key`). Si la clave tiene contraseña, ponla en `WALLET_APPLE_KEY_PASSWORD`.
6. El certificado dura un año: cuando vaya a caducar (el panel avisa de la fecha), repite los pasos 2 a 5.

**Google Wallet** (gratis):
1. En la [Google Pay & Wallet Console](https://pay.google.com/business/console) → **Google Wallet API** → crea la cuenta de emisor. Apunta el **Issuer ID** (un número largo).
2. En la [consola de Google Cloud](https://console.cloud.google.com/) crea un proyecto, activa la **Google Wallet API** y, en *IAM* → *Cuentas de servicio*, crea una cuenta de servicio y una clave **JSON**.
3. En la Wallet Console → *Usuarios*, invita al email de esa cuenta de servicio con permiso de **Desarrollador**.
4. Copia el JSON al contenedor (`docker exec sono2_web mkdir -p /app/data/wallet/google` y `docker cp clave.json sono2_web:/app/data/wallet/google/`), añade `WALLET_GOOGLE_ISSUER_ID=` con tu Issuer ID en el stack y vuelve a desplegarlo.
5. Al principio la cuenta está en **modo de prueba**: solo pueden guardar la tarjeta las cuentas de Google que añadas como usuarios de prueba. Cuando funcione, pide el **acceso de publicación** en la Wallet Console para que la pueda guardar cualquiera.

Los iPhone que tienen la tarjeta se guardan en `wallet/registros.json`, dentro del volumen de datos. La política de privacidad ya explica qué se guarda al añadir la tarjeta a la cartera.

Los socios pueden darse de baja ellos mismos desde su tarjeta (se borran sus datos). Las contraseñas se guardan cifradas (scrypt) y la sesión del socio dura 120 días. Al recoger nombre, email y teléfono, conviene mencionarlo en la política de privacidad de la cafetería.

Los datos del club están en `socios.json` y la clave que firma las sesiones en `secreto.json`, dentro del volumen de datos. Si se pierde `secreto.json`, los socios solo tienen que volver a entrar.

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

**Borrado automático** (lo que dice la política de privacidad): las reservas se borran 90 días después de su fecha, los pedidos a los 30 días y los mensajes al año. Se hace al arrancar y cada 6 horas.

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
| `WALLET_GOOGLE_ISSUER_ID` | Issuer ID de Google Wallet | — |
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

Todo está en el volumen del stack (Portainer lo llama `sono2_sono2_datos`): `contenido.json`, `reservas.json`, `pedidos.json`, `mensajes.json`, `socios.json`, `resenas.json`, `secreto.json`, `versiones.json`, la carpeta `fotos/` y la carpeta `wallet/` (certificados de Apple, clave de Google y los iPhone registrados; guarda esa copia en un sitio seguro, porque lleva claves privadas).

```bash
docker run --rm -v sono2_sono2_datos:/datos -v "$PWD":/copia alpine \
  tar czf /copia/sono2-copia-$(date +%F).tgz -C /datos .
```

## Seguridad

- El panel pide usuario y contraseña al servidor; la contraseña no está en el código de la web.
- Tras 5 intentos fallidos desde la misma IP, el acceso se bloquea 15 minutos.
- La sesión dura 12 horas y la cookie solo la puede leer el servidor.
- Las fotos se comprueban (solo JPG, PNG o WebP, hasta 10 MB) y el navegador las reduce antes de subirlas.
- Las reservas, los pedidos y los mensajes tienen límite de envíos por IP y una trampa para bots.
- El total de cada pedido lo calcula el servidor con los precios de la carta, no el navegador.
- Usa una contraseña larga en `ADMIN_PASSWORD`, sobre todo si la web es pública.

## Alérgenos

Los 14 alérgenos de declaración obligatoria (Reglamento UE 1169/2011) se marcan en cada producto desde el panel, pestaña **Carta**. Los que trae la carta de ejemplo son orientativos: revisadlos con vuestras recetas y proveedores antes de abrir.

## Tipografías e iconos

Instrument Serif, Geist y Geist Mono están alojadas en `public/fuentes` con su licencia SIL Open Font License (`LICENCIAS.txt`). No se cargan desde Google, así que la web no hace peticiones a terceros.

El icono de la pestaña (`favicon.ico`, `favicon.svg` y `apple-touch-icon.png`) es el logo.

## Horas de recogida

Los pedidos para recoger se pueden programar para hoy, mañana o pasado mañana, en las mismas horas que las reservas (pestaña **Horarios** del panel). Si no hay horas puestas, el pedido se envía sin hora y se acuerda por teléfono.
