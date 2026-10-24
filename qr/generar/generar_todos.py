"""Genera los 4 QR de SOÑO. Para cada dirección prueba las 8 máscaras del QR y se queda
con la que mejor se lee en 30 fotos de móvil simuladas (ZXing y zbar) y en las pruebas de tamaño.

    python3 generar_todos.py        → con el logo entero, en qr/
    python3 generar_todos.py ene    → solo con la Ñ, en qr/ene/
"""
import os, sys, json
DIBUJO = sys.argv[1] if len(sys.argv) > 1 else 'logo'
os.environ['QR_DIBUJO'] = DIBUJO
from playwright.sync_api import sync_playwright
import qr_sono as q
import camara

SALIDA = q.D + ('../' if DIBUJO == 'logo' else '../ene/')
os.makedirs(SALIDA, exist_ok=True)
QRS = [
    ('web', 'https://gruposono.com'),
    ('carta', 'https://gruposono.com/carta'),
    ('resenas', 'https://gruposono.com/#escribir-resena'),
    ('trabaja', 'https://gruposono.com/#trabaja'),
]

resumen = {}
tmp = q.D + '_candidato-%s.png' % DIBUJO
with sync_playwright() as pw:
    b = pw.chromium.launch()
    p = b.new_page()
    for nombre, url in QRS:
        mejor = None
        for mask in range(8):
            svg, m = q.svg_qr(url, mask, p)
            q.renderizar(p, svg, tmp)
            tam = q.comprobar_tamanos(tmp, url)
            zx, zb, cv, _ = camara.leer(tmp, url)
            puntos = 3 * zx + 2 * zb + tam + cv
            print('%-8s máscara %d → fotos: ZXing %2d/30 · zbar %2d/30 · OpenCV %2d/30 · tamaños: zbar %2d/%d'
                  % (nombre, m, zx, zb, cv, tam, len(q.PRUEBAS)))
            if mejor is None or puntos > mejor[0]:
                mejor = (puntos, m, svg, {'fotos_zxing': '%d/30' % zx, 'fotos_zbar': '%d/30' % zb,
                                          'fotos_opencv': '%d/30' % cv, 'tamanos_zbar': '%d/%d' % (tam, len(q.PRUEBAS))})
        _, m, svg, datos = mejor
        open(SALIDA + 'qr-sono-' + nombre + '.svg', 'w', encoding='utf-8').write(svg)
        q.renderizar(p, svg, SALIDA + 'qr-sono-' + nombre + '.png')
        resumen[nombre] = dict(url=url, mascara=m, **datos)
        print('  ⇒', nombre, resumen[nombre])
    b.close()
os.remove(tmp)
json.dump(resumen, open(SALIDA + 'comprobacion.json', 'w'), ensure_ascii=False, indent=2)
