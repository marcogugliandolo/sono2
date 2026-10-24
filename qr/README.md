# Códigos QR de SOÑO

QR con la Ñ del logo dibujada con los propios puntos del código: dentro de la Ñ los puntos son cuadrados
marrones sobre beige (y el café, un beige más tostado); fuera, puntos más pequeños sobre crema. Se leen
como un QR normal (corrección de errores alta, «H») y están comprobados con dos lectores distintos, en
grande, en pequeño y algo borrosos.

| QR | Lleva a | Para qué |
|---|---|---|
| `qr-sono-web` | https://gruposono.com | La web: carteles, redes, tarjetas de visita |
| `qr-sono-carta` | https://gruposono.com/carta | Las mesas (la carta en su propia página) |
| `qr-sono-resenas` | https://gruposono.com/#escribir-resena | El ticket o la barra: abre la ventana para escribir una reseña |
| `qr-sono-trabaja` | https://gruposono.com/#trabaja | Un cartel de «buscamos gente»: abre el formulario con el currículum |

Archivos de cada uno:
- `qr-sono-*.svg`: el QR suelto, vectorial (para la imprenta o para meterlo en otro diseño).
- `qr-sono-*.png`: el QR suelto, 2000 × 2000 px.
- `tarjeta-*.pdf`: tarjeta A6 (10,5 × 14,8 cm) lista para imprimir, con el logo, un título, una frase y la dirección.
- `tarjeta-*.png`: la misma tarjeta a 300 ppp.
- `tarjetas-todas.png`: las cuatro tarjetas juntas, para verlas de un vistazo.

Al imprimir: el QR, de **3 cm de lado como mínimo**, y sin recortar el borde crema que lo rodea.
El de reseñas solo abre la ventana si las reseñas están activas en el panel, y el de «Trabaja con
nosotros», si está activo en la pestaña Mensajes.

## Volver a generarlos (por ejemplo, si cambia el dominio)

Las direcciones están en `generar/generar_todos.py` y los textos de las tarjetas en `generar/tarjetas.py`.

```bash
pip install segno opencv-python-headless pyzbar pillow playwright
python3 qr/generar/generar_todos.py   # los QR (prueba las 8 máscaras y se queda con la que mejor se lee)
python3 qr/generar/tarjetas.py        # las tarjetas A6 en PDF y PNG
```
