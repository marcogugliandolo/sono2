# Códigos QR de SOÑO

Dos juegos de QR, con la misma técnica: el dibujo va grande y macizo en marrón, y el código se pinta encima
con puntitos (crema sobre el dibujo, marrón fuera). El móvil solo mira el centro de cada punto, así que
se leen como un QR normal (corrección de errores alta, «H»).

Para que el logo se vea más, a cada QR se le quitan los puntos de unos cuantos «codewords» (los trozos de 8
bits en que se divide el código): en cada bloque, los 7 que más puntos quitan de encima del logo. El lector
los lee mal y la corrección de errores los arregla (aguanta 11 por bloque, así que quedan 4 de margen).
`generar/codewords.py` sabe qué módulos son de cada codeword, siguiendo el estándar.

- **`qr/`**: con el logo entero (SO / ÑO).
- **`qr/ene/`**: solo con la Ñ del logo (la taza con el café).

| QR | Lleva a | Para qué |
|---|---|---|
| `qr-sono-web` | https://gruposono.com | La web: carteles, redes, tarjetas de visita |
| `qr-sono-carta` | https://gruposono.com/carta | Las mesas (la carta en su propia página) |
| `qr-sono-resenas` | https://gruposono.com/#escribir-resena | El ticket o la barra: abre la ventana para escribir una reseña |
| `qr-sono-trabaja` | https://gruposono.com/#trabaja | Un cartel de «buscamos gente»: abre el formulario con el currículum |

Archivos de cada uno (en las dos carpetas):
- `qr-sono-*.svg`: el QR suelto, vectorial (para la imprenta o para meterlo en otro diseño).
- `qr-sono-*.png`: el QR suelto, 2000 × 2000 px.
- `tarjeta-*.pdf`: tarjeta A6 (10,5 × 14,8 cm) lista para imprimir, con un título, una frase y la dirección.
- `tarjeta-*.png`: la misma tarjeta a 300 ppp.
- `tarjetas-todas.png`: las cuatro tarjetas juntas, para verlas de un vistazo.
- `comprobacion.json`: cómo se leyó cada uno en las pruebas.

## Comprobados

Cada QR se ha probado con 30 fotos de móvil simuladas (de cerca y de lejos, torcidas, en perspectiva,
algo movidas, con ruido, luz desigual y compresión JPG) y con dos lectores distintos: ZXing (el de Android
y muchas apps) y zbar. Se leen en 25–28 de las 30, y todos los fallos son de las fotos más lejanas y
borrosas: de media distancia para arriba se leen siempre. También se leen las tarjetas, tanto el PNG como
el PDF impreso a 300 ppp.

Al imprimir: el QR, de **4 cm de lado como mínimo**, y sin recortar el borde crema que lo rodea.
El de reseñas solo abre la ventana si las reseñas están activas en el panel, y el de «Trabaja con
nosotros», si está activo en la pestaña Mensajes.

## Volver a generarlos (por ejemplo, si cambia el dominio o el logo)

Las direcciones están en `generar/generar_todos.py` y los textos de las tarjetas en `generar/tarjetas.py`.
El logo se saca de `public/index.html`, así que si cambia en la web, cambia aquí.

```bash
pip install segno opencv-python-headless pyzbar zxing-cpp pillow numpy playwright
# QR_LIBRES=0 python3 generar_todos.py  → sin quitar puntos (se lee aún mejor, pero se ve menos el logo)
cd qr/generar
python3 generar_todos.py        # QR con el logo entero → qr/   (prueba las 8 máscaras y se queda con la que mejor se lee)
python3 tarjetas.py             # sus tarjetas A6 en PDF y PNG
python3 generar_todos.py ene    # QR solo con la Ñ → qr/ene/
python3 tarjetas.py ene
```
