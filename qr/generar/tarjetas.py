"""Tarjetas A6 para imprimir con cada QR (PDF vectorial y PNG a 300 ppp), con las tipografías de la web.
Salen de qr/qr-sono-*.svg (o de qr/ene/ con «python3 tarjetas.py ene»)."""
import re, os, sys, pathlib
from playwright.sync_api import sync_playwright
import qr_sono as q

DIBUJO = sys.argv[1] if len(sys.argv) > 1 else 'logo'   # 'logo' → qr/ · 'ene' → qr/ene/
SALIDA = q.D + ('../' if DIBUJO == 'logo' else '../ene/')
FUENTES = pathlib.Path(q.D, '..', '..', 'public', 'fuentes').resolve().as_uri() + '/'

TARJETAS = [
    ('web', 'Café · Desayunos · Buenos ratos', 'Descubre <em>SOÑO</em>', 'La carta, reservas y pedidos para llevar.', 'gruposono.com'),
    ('carta', 'La carta', 'Mira la <em>carta</em>', 'Descripción y alérgenos de cada producto.', 'gruposono.com/carta'),
    ('resenas', 'Reseñas', '¿Qué tal en <em>SOÑO</em>?', 'Cuéntanoslo en un minuto. Las leemos todas.', 'gruposono.com'),
    ('trabaja', 'Trabaja con nosotros', '¿Te vienes al <em>equipo</em>?', 'Mándanos tu currículum desde el móvil.', 'gruposono.com'),
]

PLANTILLA = '''<!doctype html><html lang="es"><head><meta charset="utf-8"><style>
@font-face {{ font-family: "Instrument Serif"; src: url("{f}instrument-serif.woff2"); }}
@font-face {{ font-family: "Instrument Serif"; font-style: italic; src: url("{f}instrument-serif-italic.woff2"); }}
@font-face {{ font-family: "Geist"; src: url("{f}geist.woff2"); font-weight: 100 900; }}
@font-face {{ font-family: "Geist Mono"; src: url("{f}geist-mono-500.woff2"); font-weight: 500; }}
@page {{ size: 105mm 148mm; margin: 0; }}
* {{ box-sizing: border-box; margin: 0; }}
html, body {{ width: 105mm; height: 148mm; }}
body {{ background: #FBF7EB; color: #562912; font-family: "Geist", sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }}
.t {{ width: 105mm; height: 148mm; padding: 9mm 9mm 8mm; display: flex; flex-direction: column; align-items: center; text-align: center; }}
.meta {{ margin-top: 3mm; font-family: "Geist Mono", monospace; font-weight: 500; font-size: 7.2pt; letter-spacing: 0.12em; text-transform: uppercase; color: #7A5539; }}
h1 {{ margin-top: 2.5mm; font-family: "Instrument Serif", serif; font-weight: 400; font-size: 30pt; line-height: 1; letter-spacing: -0.02em; }}
h1 em {{ font-style: italic; }}
.qr {{ margin-top: 7mm; width: 76mm; height: 76mm; border-radius: 3mm; overflow: hidden; }}
.qr svg {{ display: block; width: 100%; height: 100%; }}
.texto {{ margin-top: 6mm; font-size: 9.5pt; line-height: 1.4; max-width: 72mm; text-wrap: balance; }}
.pista {{ margin-top: auto; display: flex; align-items: center; gap: 2mm; font-size: 7.5pt; color: #7A5539; }}
.pista svg {{ width: 4mm; height: 4mm; }}
.url {{ margin-top: 1.5mm; font-family: "Geist Mono", monospace; font-weight: 500; font-size: 8.5pt; letter-spacing: 0.04em; }}
</style></head><body><div class="t">
<p class="meta">{meta}</p>
<h1>{titulo}</h1>
<div class="qr">{qr}</div>
<p class="texto">{texto}</p>
<p class="pista"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="2.5" width="12" height="19" rx="2.5"/><path d="M10.5 18.5h3"/></svg>Apunta con la cámara del móvil</p>
<p class="url">{url}</p>
</div></body></html>'''

with sync_playwright() as pw:
    b = pw.chromium.launch()
    for nombre, meta, titulo, texto, url in TARJETAS:
        qr = open(SALIDA + 'qr-sono-' + nombre + '.svg', encoding='utf-8').read()
        qr = re.sub(r'width="\d+" height="\d+"', '', qr, count=1)
        # El QR lleva su propio clipPath con el mismo id que el del logo: se renombra para que no choquen
        qr = qr.replace('id="logo-taza"', 'id="qr-taza"').replace('url(#logo-taza)', 'url(#qr-taza)')
        pagina_html = PLANTILLA.format(f=FUENTES, meta=meta, titulo=titulo, qr=qr, texto=texto, url=url)
        ruta_html = q.D + '_tarjeta-' + DIBUJO + '-' + nombre + '.html'   # temporal
        open(ruta_html, 'w', encoding='utf-8').write(pagina_html)
        p = b.new_page(viewport={'width': 397, 'height': 560}, device_scale_factor=1240 / 396.85)
        p.goto('file://' + ruta_html)
        p.evaluate('document.fonts.ready')
        p.wait_for_timeout(300)
        p.screenshot(path=SALIDA + 'tarjeta-' + nombre + '.png', clip={'x': 0, 'y': 0, 'width': 396.85, 'height': 559.37})
        p.pdf(path=SALIDA + 'tarjeta-' + nombre + '.pdf', width='105mm', height='148mm', print_background=True, margin={'top': '0', 'right': '0', 'bottom': '0', 'left': '0'})
        print(nombre, 'fuentes:', p.evaluate("Array.from(document.fonts).filter(f => f.status === 'loaded').map(f => f.family + ' ' + f.style).join(', ')"))
        p.close()
        os.remove(ruta_html)
    b.close()
