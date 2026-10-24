"""Genera los 4 QR de SOÑO (eligiendo la máscara más fiable) y los deja en salida/."""
import os, json, shutil
from playwright.sync_api import sync_playwright
import qr_sono as q

SALIDA = q.D + '../'
os.makedirs(SALIDA, exist_ok=True)

QRS = [
    ('web', 'https://gruposono.com'),
    ('carta', 'https://gruposono.com/carta'),
    ('resenas', 'https://gruposono.com/#escribir-resena'),
    ('trabaja', 'https://gruposono.com/#trabaja'),
]

resumen = {}
with sync_playwright() as pw:
    b = pw.chromium.launch()
    p = b.new_page()
    for nombre, url in QRS:
        mejor = None
        for mask in range(8):
            svg, m = q.svg_qr(url, mask, p)
            ruta = q.D + '_cand.png'
            q.renderizar(p, svg, ruta)
            cv, zb, fallos = q.comprobar(ruta, url)
            puntos = cv + zb
            print('%-8s máscara %d → OpenCV %2d/%d · zbar %2d/%d' % (nombre, m, cv, len(q.PRUEBAS), zb, len(q.PRUEBAS)))
            if mejor is None or puntos > mejor[0]:
                mejor = (puntos, m, svg, cv, zb, fallos)
        puntos, m, svg, cv, zb, fallos = mejor
        base = SALIDA + 'qr-sono-' + nombre
        open(base + '.svg', 'w', encoding='utf-8').write(svg)
        q.renderizar(p, svg, base + '.png')
        cv2_, zb2, fallos2 = q.comprobar(base + '.png', url)
        resumen[nombre] = {'url': url, 'mascara': m, 'opencv': '%d/%d' % (cv2_, len(q.PRUEBAS)), 'zbar': '%d/%d' % (zb2, len(q.PRUEBAS)), 'fallos': fallos2}
        print('  ⇒ elegida máscara %d: OpenCV %d/%d · zbar %d/%d %s' % (m, cv2_, len(q.PRUEBAS), zb2, len(q.PRUEBAS), fallos2))
    b.close()
json.dump(resumen, open(SALIDA + 'comprobacion.json', 'w'), ensure_ascii=False, indent=2)
for temporal in ('_cand.png', '_mascara.png'):
    if os.path.exists(q.D + temporal):
        os.remove(q.D + temporal)
