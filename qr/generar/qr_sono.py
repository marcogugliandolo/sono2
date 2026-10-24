"""QR de SOÑO con la Ñ del logo dibujada con los propios puntos del código.

Dentro de la Ñ: fondo beige (el café, un tono más tostado) y los módulos oscuros como cuadrados enteros.
Fuera: fondo crema y los módulos oscuros como puntos algo más pequeños y claros. Los lectores miran
el centro de cada módulo, así que se lee igual; de lejos se ve la Ñ.

Para cada dirección se prueban las 8 máscaras del QR y se queda la que mejor leen OpenCV y zbar
(en grande, en pequeño y algo borroso).
"""
import re, os
import segno
import cv2
import numpy as np
from PIL import Image
from pyzbar import pyzbar

D = os.path.dirname(os.path.abspath(__file__)) + '/'
INDEX = os.path.join(D, '..', '..', 'public', 'index.html')

CAFE = '#562912'
CAFE_SUAVE = '#6E4429'
BEIGE = '#F3E0A6'
TOSTADO = '#E8CB8C'
FONDO = '#FFFDF7'
MARGEN = 4
PUNTO = 0.72
ESCALA_ENE = 0.86
VERSION = 6
N = 17 + 4 * VERSION          # 41 módulos
T = N + 2 * MARGEN

_html = open(INDEX, encoding='utf-8').read()
RECORTE = re.search(r'<clipPath id="logo-taza".*?</clipPath>', _html, re.S).group(0)
_ene = re.search(r'<symbol id="i-ene" viewBox="([^"]+)">(.*?)</symbol>', _html, re.S)
VB, DENTRO = _ene.group(1), _ene.group(2)
CAFE_LOGO = '<g clip-path="url(#logo-taza)" fill-opacity="0.76" stroke="none">'
assert CAFE_LOGO in DENTRO

LADO = N * ESCALA_ENE
EX = MARGEN + (N - LADO) / 2
EY = MARGEN + (N - LADO) / 2 + N * 0.015


def dibujo_ene(color_ene, color_cafe):
    d = DENTRO.replace('currentColor', color_ene)
    d = d.replace(CAFE_LOGO, '<g clip-path="url(#logo-taza)" fill="%s" stroke="none">' % color_cafe)
    return '<svg x="%.3f" y="%.3f" width="%.3f" height="%.3f" viewBox="%s">%s</svg>' % (EX, EY, LADO, LADO, VB, d)


def svg_entero(cuerpo, fondo, titulo, ancho=1000):
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {t} {t}" width="{a}" height="{a}">'
            '<title>{ti}</title><defs>{r}</defs><rect width="{t}" height="{t}" fill="{f}"/>{c}</svg>').format(
        t=T, a=ancho, ti=titulo, r=RECORTE, f=fondo, c=cuerpo)


def renderizar(pagina, svg, ruta, px=2000):
    pagina.set_viewport_size({'width': px, 'height': px})
    pagina.set_content('<html><body style="margin:0">' + re.sub(r'width="\d+" height="\d+"', 'width="%d" height="%d"' % (px, px), svg, count=1) + '</body></html>')
    pagina.locator('svg').first.screenshot(path=ruta)


_mascara = None
def mascara(pagina):
    """Silueta de la Ñ: qué módulos caen dentro (se calcula una vez; es igual para todos los QR)."""
    global _mascara
    if _mascara is None:
        px = T * 24
        renderizar(pagina, svg_entero(dibujo_ene('#000', '#000'), '#fff', 'mascara'), D + '_mascara.png', px)
        img = Image.open(D + '_mascara.png').convert('L')
        _mascara = [[img.getpixel((int((k + MARGEN + 0.5) * 24), int((f + MARGEN + 0.5) * 24))) < 128 for k in range(N)] for f in range(N)]
    return _mascara


def svg_qr(url, mask, pagina):
    qr = segno.make(url, error='h', version=VERSION, mask=mask, boost_error=False)
    m = [list(r) for r in qr.matrix]
    assert len(m) == N
    dentro = mascara(pagina)

    def en_buscador(f, k):
        return (f < 8 and k < 8) or (f < 8 and k >= N - 8) or (f >= N - 8 and k < 8)

    cuadros, puntos = [], []
    o = (1 - PUNTO) / 2
    for f in range(N):
        for k in range(N):
            if not m[f][k] or en_buscador(f, k):
                continue
            x, y = k + MARGEN, f + MARGEN
            if dentro[f][k]:
                cuadros.append('M%d %dh1v1h-1z' % (x, y))
            else:
                puntos.append('M%.2f %.2fh%.2fv%.2fh-%.2fz' % (x + o, y + o, PUNTO, PUNTO, PUNTO))

    def buscador(x, y):
        return ('<rect x="{a}" y="{b}" width="7" height="7" fill="{c}"/><rect x="{a1}" y="{b1}" width="5" height="5" fill="{f}"/>'
                '<rect x="{a2}" y="{b2}" width="3" height="3" fill="{c}"/>').format(a=x, b=y, a1=x + 1, b1=y + 1, a2=x + 2, b2=y + 2, c=CAFE, f=FONDO)

    cuerpo = (dibujo_ene(BEIGE, TOSTADO) +
              '<path d="%s" fill="%s" shape-rendering="crispEdges"/>' % (''.join(cuadros), CAFE) +
              '<path d="%s" fill="%s"/>' % (''.join(puntos), CAFE_SUAVE) +
              buscador(MARGEN, MARGEN) + buscador(MARGEN + N - 7, MARGEN) + buscador(MARGEN, MARGEN + N - 7))
    return svg_entero(cuerpo, FONDO, 'SOÑO · ' + url), qr.mask


PRUEBAS = [(l, b) for l in (2000, 800, 400, 250, 180, 140, 110) for b in (0, 3)]
_det = cv2.QRCodeDetector()


def comprobar(ruta_png, url):
    """Cuántas pruebas pasa cada lector (OpenCV y zbar), con la dirección exacta."""
    img = cv2.imread(ruta_png)
    ok_cv = ok_zbar = 0
    fallos = []
    for lado, borroso in PRUEBAS:
        x = cv2.resize(img, (lado, lado), interpolation=cv2.INTER_AREA)
        if borroso:
            x = cv2.GaussianBlur(x, (borroso, borroso), 0)
        t, _, _ = _det.detectAndDecode(x)
        if t == url: ok_cv += 1
        else: fallos.append('opencv %d%s' % (lado, 'b' if borroso else ''))
        z = pyzbar.decode(Image.fromarray(cv2.cvtColor(x, cv2.COLOR_BGR2GRAY)))
        if any(d.data.decode() == url for d in z): ok_zbar += 1
        else: fallos.append('zbar %d%s' % (lado, 'b' if borroso else ''))
    return ok_cv, ok_zbar, fallos
