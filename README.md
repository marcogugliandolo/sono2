# SOÑO · web de la cafetería (versión 2, minimalista)

Segunda versión de la web de SOÑO. Tiene las mismas funciones que la primera (repo `sono`): carta con alérgenos, pedidos para llevar, galería, reservas de mesa, formulario de contacto y el mismo panel para editarlo todo sin tocar código. Cambia el diseño.

- **Diseño**: basado en la plantilla de Canva «Cafe Website in Cream Blue Orange Handdrawn Human-centric Style», en versión minimalista. Tiene portada centrada con un bodegón dibujado a línea, franja de «Nuestra historia», carta con tarjetas de favoritos y una caja por sección, bloques de dos tarjetas para «Para llevar» y «Visítanos», y pie en tarjeta.
- **Marca**: el mismo logo SOÑO en vector (el café de la Ñ se mueve) y los colores oficiales: marrón rgb(86, 41, 18) · #562912 y beige rgb(243, 224, 166) · #F3E0A6. El fondo general es un beige muy aclarado (#FBF7EB).
- **Tipografías**: Instrument Serif para los titulares, Geist para el texto y Geist Mono para etiquetas y precios.
- **Panel**: se abre tocando el logo de la cabecera. Usa el mismo usuario y contraseña que la primera web: `ADMIN_USER` y `ADMIN_PASSWORD`.
- **Servidor**: Node.js sin dependencias. Guarda todo en la carpeta de datos (un volumen de Docker).

## La taza que se llena

Justo después de la portada hay una sección, «Así preparamos tu café». Al bajar, el dibujo se queda fijo en el centro y la taza (la misma de la portada, más grande) se llena en tres pasos: la cafetera sirve el café (60 ml), la jarra añade la leche (hasta 220 ml) y después la espuma (250 ml). Al terminar aparecen un corazón en la espuma y el vapor, y la página sigue. La cafetera y la jarra tienen el mismo tamaño. Con «reducir movimiento» activado en el sistema, o en pantallas muy bajas, la taza aparece ya llena y sin efecto.

## Novedad: favoritos

Encima de las cajas de la carta salen 4 productos destacados en tarjetas. Para elegirlos, añade la etiqueta `Favorito` a los productos en el panel (pestaña **Carta**). Si hay menos de 4 marcados, el resto se completa solo con un producto de cada sección, primero los que tienen foto.

## Zonas al reservar

Al reservar mesa se puede elegir zona en un mini plano: interior, zona de lectura, terraza (dibujada fuera del local) o «Donde haya sitio». En **Ajustes → Zonas para reservar** se renombran, se añaden (hasta 6, con dibujo de mesas, terraza, lectura o barra) y se desactivan. La zona elegida aparece en cada reserva del panel.

## Estructura

```
server.js              servidor web y API
datos-iniciales.json   carta y horarios de partida (solo se usan el primer arranque)
public/                la web: index.html, styles.css, app.js, tipografías
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

Todo está en el volumen del stack (Portainer lo llama `sono2_sono2_datos`): `contenido.json`, `reservas.json`, `pedidos.json`, `mensajes.json` y la carpeta `fotos/`.

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
