"""Simula fotos de móvil de un QR (tamaño, giro, perspectiva, desenfoque, ruido, luz desigual, JPG)
y cuenta cuántas lee cada lector: ZXing (Android y muchas apps), zbar y OpenCV."""
import sys, random, io
import numpy as np
import cv2
from PIL import Image
import zxingcpp
from pyzbar import pyzbar


def fotos(ruta, n=30, semilla=7):
    base = cv2.imread(ruta)
    rnd = random.Random(semilla)
    salida = []
    for i in range(n):
        lado = rnd.choice([220, 280, 360, 480, 620])
        qr = cv2.resize(base, (lado, lado), interpolation=cv2.INTER_AREA)
        lienzo = np.full((900, 900, 3), (196, 205, 214), np.uint8)   # una mesa
        x0, y0 = rnd.randint(80, 900 - lado - 80), rnd.randint(80, 900 - lado - 80)
        src = np.float32([[0, 0], [lado, 0], [lado, lado], [0, lado]])
        j = lado * 0.09
        dst = np.float32([[x0 + rnd.uniform(-j, j), y0 + rnd.uniform(-j, j)], [x0 + lado + rnd.uniform(-j, j), y0 + rnd.uniform(-j, j)],
                          [x0 + lado + rnd.uniform(-j, j), y0 + lado + rnd.uniform(-j, j)], [x0 + rnd.uniform(-j, j), y0 + lado + rnd.uniform(-j, j)]])
        ang = np.deg2rad(rnd.uniform(-14, 14))
        c = dst.mean(axis=0)
        R = np.array([[np.cos(ang), -np.sin(ang)], [np.sin(ang), np.cos(ang)]])
        dst = ((dst - c) @ R.T + c).astype(np.float32)
        H = cv2.getPerspectiveTransform(src, dst)
        cv2.warpPerspective(qr, H, (900, 900), lienzo, borderMode=cv2.BORDER_TRANSPARENT)
        img = lienzo.astype(np.float32)
        # luz desigual
        g = np.linspace(rnd.uniform(0.7, 0.95), rnd.uniform(0.95, 1.08), 900, dtype=np.float32)
        img *= (g[None, :, None] if rnd.random() < 0.5 else g[:, None, None])
        img = cv2.GaussianBlur(img, (0, 0), rnd.uniform(0.5, 1.6))
        img += np.random.default_rng(semilla + i).normal(0, rnd.uniform(3, 9), img.shape).astype(np.float32)
        img = np.clip(img, 0, 255).astype(np.uint8)
        ok, buf = cv2.imencode('.jpg', img, [cv2.IMWRITE_JPEG_QUALITY, rnd.randint(55, 85)])
        salida.append((lado, cv2.imdecode(buf, cv2.IMREAD_COLOR)))
    return salida


def leer(ruta, url, n=30):
    det = cv2.QRCodeDetector()
    zx = zb = ocv = 0
    fallos_zx = []
    for lado, img in fotos(ruta, n):
        gris = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        if any(r.text == url for r in zxingcpp.read_barcodes(gris)): zx += 1
        else: fallos_zx.append(lado)
        if any(d.data.decode() == url for d in pyzbar.decode(Image.fromarray(gris))): zb += 1
        if det.detectAndDecode(img)[0] == url: ocv += 1
    return zx, zb, ocv, fallos_zx


if __name__ == '__main__':
    url = sys.argv[1]
    for ruta in sys.argv[2:]:
        zx, zb, ocv, f = leer(ruta, url)
        print('%-48s ZXing %2d/30 · zbar %2d/30 · OpenCV %2d/30  (ZXing falla en tamaños %s)' % (ruta.split('/')[-1], zx, zb, ocv, f))
