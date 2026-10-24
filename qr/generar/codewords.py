"""Qué «codeword» (bloque, número) ocupa cada módulo de datos de un QR versión 5-H, siguiendo el estándar
(ISO/IEC 18004): zonas reservadas, recorrido en zigzag y entrelazado de bloques. Sirve para saber qué
puntos se pueden quitar sin pasarse de lo que la corrección de errores arregla."""
BLOQUES = {5: (22, [11, 11, 12, 12])}   # versión: (codewords de corrección por bloque, datos por bloque)
ALINEACION = {5: [6, 30]}

def reservados(version):
    N = 17 + 4 * version
    r = [[False] * N for _ in range(N)]
    def marca(f0, f1, c0, c1):
        for f in range(max(f0, 0), min(f1, N)):
            for c in range(max(c0, 0), min(c1, N)):
                r[f][c] = True
    marca(0, 9, 0, 9); marca(0, 9, N - 8, N); marca(N - 8, N, 0, 9)   # esquinas + separadores + formato
    for i in range(N): r[6][i] = r[i][6] = True                        # temporización
    pos = ALINEACION[version]
    for a in pos:
        for b in pos:
            if (a, b) in ((6, 6), (6, pos[-1]), (pos[-1], 6)): continue
            marca(a - 2, a + 3, b - 2, b + 3)
    return r

def mapa(version):
    """Devuelve dict (fila, col) → (bloque, n.º de codeword dentro del bloque) o None (bits sobrantes)."""
    N = 17 + 4 * version
    ec, datos = BLOQUES[version]
    orden = []
    for i in range(max(datos)):
        for b, n in enumerate(datos):
            if i < n: orden.append((b, i))
    for i in range(ec):
        for b, n in enumerate(datos):
            orden.append((b, n + i))
    res = reservados(version)
    m = {}
    k = 0
    j = N - 1
    subiendo = True
    while j > 0:
        if j == 6: j -= 1
        filas = range(N - 1, -1, -1) if subiendo else range(N)
        for f in filas:
            for c in (j, j - 1):
                if res[f][c]: continue
                m[(f, c)] = orden[k // 8] if k // 8 < len(orden) else None
                k += 1
        subiendo = not subiendo
        j -= 2
    assert len(orden) * 8 <= k <= len(orden) * 8 + 7, (k, len(orden))
    return m
