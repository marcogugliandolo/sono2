"""QR de SOÑO con el logo grande y macizo (técnica «semitono»): el logo entero (SO/ÑO) o solo la Ñ.

El dibujo se pinta tal cual, en marrón, ocupando casi todo el código. Un lector de QR solo mira
el centro de cada módulo, así que encima del logo solo hace falta pintar puntos donde el color no cuadra:
  · módulo claro que cae sobre el logo   → punto crema
  · módulo oscuro que cae fuera del logo → punto marrón
Los tres cuadrados de las esquinas van completos (y cuadrados: redondeados fallan en algunos lectores).
"""
import re, os
import segno
import codewords
import cv2
from PIL import Image
from pyzbar import pyzbar

D = os.path.dirname(os.path.abspath(__file__)) + '/'
INDEX = os.path.join(D, '..', '..', 'public', 'index.html')   # de aquí se saca el logo, igual que en la web

CAFE = '#562912'          # el marrón SOÑO: logo, puntos oscuros y esquinas
CAFE_LOGO = '#8A5A35'     # el café dentro de la Ñ
FONDO = '#FFFDF7'         # crema: fondo y puntos claros sobre el logo
MARGEN = 4                # la zona en blanco que exige el estándar, en módulos
VERSION = 5               # 37 × 37 módulos
LIBRES = int(os.environ.get('QR_LIBRES', 7))   # codewords por bloque que se dejan sin puntos (la corrección arregla 11: quedan 4 de margen)
N = 17 + 4 * VERSION
T = N + 2 * MARGEN
# Diámetro de los puntos, en módulos: más grandes tapan el logo; más pequeños, se leen peor
PUNTO_CLARO = float(os.environ.get('QR_PUNTO_CLARO', 0.72))     # los crema, encima del logo
PUNTO_OSCURO = float(os.environ.get('QR_PUNTO_OSCURO', 0.72))   # los marrones, fuera del logo
DIBUJO = os.environ.get('QR_DIBUJO', 'logo')   # 'logo' (SO/ÑO entero) o 'ene' (solo la Ñ)

_html = open(INDEX, encoding='utf-8').read()
RECORTE = re.search(r'<clipPath id="logo-taza".*?</clipPath>', _html, re.S).group(0)
if DIBUJO == 'logo':
    _s = re.search(r'<symbol id="logo-sono" viewBox="([^"]+)">(.*?)</symbol>', _html, re.S)
    G_CAFE = '<g class="logo__cafe" clip-path="url(#logo-taza)" fill-opacity="0.76" stroke="none">'
    LADO_W = N * float(os.environ.get('QR_ESCALA', 0.70))   # 70 % del ancho: así no toca las esquinas
    BAJADA = 0
else:
    _s = re.search(r'<symbol id="i-ene" viewBox="([^"]+)">(.*?)</symbol>', _html, re.S)
    G_CAFE = '<g clip-path="url(#logo-taza)" fill-opacity="0.76" stroke="none">'
    # La Ñ es casi cuadrada y tiene tinta en las dos esquinas de arriba, justo donde van los cuadrados del QR:
    # para hacerla grande hay que bajarla un poco (se calcula para que no los toque).
    LADO_W = float(os.environ.get('QR_ENE_LADO', 26.5))      # en módulos
    BAJADA = float(os.environ.get('QR_ENE_BAJADA', 2))       # en módulos, respecto al centro
VB, DENTRO = _s.group(1), _s.group(2)
assert G_CAFE in DENTRO, 'El logo de index.html ha cambiado: revisa G_CAFE'
vbx, vby, vbw, vbh = [float(x) for x in VB.split()]
LADO_H = LADO_W * vbh / vbw
LX = MARGEN + (N - LADO_W) / 2
LY = MARGEN + (N - LADO_H) / 2 + BAJADA


def dibujo_logo(color, color_cafe):
    d = DENTRO.replace('currentColor', color).replace(G_CAFE, '<g clip-path="url(#logo-taza)" fill="%s" stroke="none">' % color_cafe)
    return '<svg x="%.3f" y="%.3f" width="%.3f" height="%.3f" viewBox="%s">%s</svg>' % (LX, LY, LADO_W, LADO_H, VB, d)


def svg_entero(cuerpo, fondo, titulo):
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {t} {t}" width="1000" height="1000">'
            '<title>{ti}</title><defs>{r}</defs><rect width="{t}" height="{t}" fill="{f}"/>{c}</svg>').format(
        t=T, ti=titulo, r=RECORTE, f=fondo, c=cuerpo)


def renderizar(pagina, svg, ruta, px=2000):
    pagina.set_viewport_size({'width': px, 'height': px})
    pagina.set_content('<html><body style="margin:0">' + re.sub(r'width="\d+" height="\d+"', 'width="%d" height="%d"' % (px, px), svg, count=1) + '</body></html>')
    pagina.locator('svg').first.screenshot(path=ruta)


PX = 32
_mascara = None
def mascara(pagina):
    """El logo en blanco y negro, a 32 px por módulo, para saber qué hay debajo de cada punto (se calcula una vez)."""
    global _mascara
    if _mascara is None:
        renderizar(pagina, svg_entero(dibujo_logo('#000', '#000'), '#fff', 'mascara'), D + '_mascara-%s-%d.png' % (DIBUJO, os.getpid()), T * PX)
        _mascara = Image.open(D + '_mascara-%s-%d.png' % (DIBUJO, os.getpid())).convert('L')
        os.remove(D + '_mascara-%s-%d.png' % (DIBUJO, os.getpid()))
    return _mascara


def svg_qr(url, mask, pagina):
    qr = segno.make(url, error='h', version=VERSION, mask=mask, boost_error=False)
    m = [list(r) for r in qr.matrix]
    assert len(m) == N
    img = mascara(pagina)
    r = max(PUNTO_CLARO, PUNTO_OSCURO) / 2

    def en_logo(x, y):
        return img.getpixel((min(int(x * PX), T * PX - 1), min(int(y * PX), T * PX - 1))) < 128

    def en_esquina(f, k):
        return (f < 8 and k < 8) or (f < 8 and k >= N - 8) or (f >= N - 8 and k < 8)

    puntos = {}   # (fila, col) → 'oscuro' o 'claro'
    for f in range(N):
        for k in range(N):
            if en_esquina(f, k):
                continue
            cx, cy = k + MARGEN + 0.5, f + MARGEN + 0.5
            # se mira el logo en 9 puntos del círculo: si el punto cae en el borde de una letra, se pinta igualmente
            muestras = [en_logo(cx + dx, cy + dy) for dx in (-r * 0.7, 0, r * 0.7) for dy in (-r * 0.7, 0, r * 0.7)]
            if m[f][k] and not all(muestras):
                puntos[(f, k)] = 'oscuro'
            elif not m[f][k] and any(muestras):
                puntos[(f, k)] = 'claro'

    # Puntos que sobran: los bits de relleno no cuentan, y en cada bloque se eligen los LIBRES codewords que más
    # puntos quitarían (pesan el doble los claros, que son los que rompen el logo). Esos se quedan sin puntos:
    # el lector los leerá mal y la corrección de errores los arregla.
    sitio = codewords.mapa(VERSION)
    quitar = {p for p in puntos if p in sitio and sitio[p] is None}
    if LIBRES:
        ganancia = {}
        for p, tipo in puntos.items():
            cw = sitio.get(p)
            if cw is not None:
                ganancia[cw] = ganancia.get(cw, 0) + (2 if tipo == 'claro' else 1)
        elegidos = set()
        for b in range(len(codewords.BLOQUES[VERSION][1])):
            del_bloque = sorted((g, cw) for cw, g in ganancia.items() if cw[0] == b)
            elegidos.update(cw for g, cw in del_bloque[-LIBRES:])
        quitar |= {p for p in puntos if sitio.get(p) in elegidos}

    oscuros, claros = [], []
    for (f, k), tipo in sorted(puntos.items()):
        if (f, k) in quitar:
            continue
        cx, cy = k + MARGEN + 0.5, f + MARGEN + 0.5
        r = (PUNTO_CLARO if tipo == 'claro' else PUNTO_OSCURO) / 2
        punto = 'M%.3f %.3fa%.3f %.3f 0 1 0 %.3f 0a%.3f %.3f 0 1 0 -%.3f 0z' % (cx - r, cy, r, r, 2 * r, r, r, 2 * r)
        (oscuros if tipo == 'oscuro' else claros).append(punto)

    def esquina(x, y):
        return ('<rect x="{a0}" y="{b0}" width="9" height="9" fill="{f}"/>'
                '<rect x="{a}" y="{b}" width="7" height="7" fill="{c}"/><rect x="{a1}" y="{b1}" width="5" height="5" fill="{f}"/>'
                '<rect x="{a2}" y="{b2}" width="3" height="3" fill="{c}"/>').format(
            a0=x - 1, b0=y - 1, a=x, b=y, a1=x + 1, b1=y + 1, a2=x + 2, b2=y + 2, c=CAFE, f=FONDO)

    cuerpo = (dibujo_logo(CAFE, CAFE_LOGO) +
              '<path d="%s" fill="%s"/>' % (''.join(oscuros), CAFE) +
              '<path d="%s" fill="%s"/>' % (''.join(claros), FONDO) +
              esquina(MARGEN, MARGEN) + esquina(MARGEN + N - 7, MARGEN) + esquina(MARGEN, MARGEN + N - 7))
    return svg_entero(cuerpo, FONDO, 'SOÑO · ' + url), qr.mask


PRUEBAS = [(l, b) for l in (2000, 800, 400, 250, 180, 140, 110) for b in (0, 3)]


def comprobar_tamanos(ruta_png, url):
    """Cuántas de las 14 pruebas de tamaño (de 2000 a 110 px, nítido y algo borroso) lee zbar."""
    img = cv2.imread(ruta_png)
    ok = 0
    for lado, borroso in PRUEBAS:
        x = cv2.resize(img, (lado, lado), interpolation=cv2.INTER_AREA)
        if borroso:
            x = cv2.GaussianBlur(x, (borroso, borroso), 0)
        if any(d.data.decode() == url for d in pyzbar.decode(Image.fromarray(cv2.cvtColor(x, cv2.COLOR_BGR2GRAY)))):
            ok += 1
    return ok
