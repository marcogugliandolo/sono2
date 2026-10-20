'use strict';

/*
 * SOÑO · la tarjeta del Club SOÑO en Apple Wallet y Google Wallet
 * Sin dependencias externas: el ZIP, el PNG y la firma PKCS#7 se hacen aquí con Node.
 *
 * Apple Wallet (tarjeta de cliente «storeCard», firmada con el certificado de Apple):
 *   - Los archivos van en la carpeta de datos, en wallet/apple/: el certificado de la tarjeta
 *     (pass.cer o .pem), su clave privada (.key o .pem) y el certificado intermedio de Apple
 *     (WWDR G4). Se reconocen solos, se llamen como se llamen.
 *   - Si la web va por https, la tarjeta se actualiza sola: el iPhone se registra en
 *     /wallet/apple/v1/… y, al poner un sello, se le avisa por APNs.
 *
 * Google Wallet (tarjeta de fidelización «loyalty»):
 *   - El archivo JSON de la cuenta de servicio de Google Cloud va en wallet/google/ y el ID de
 *     emisor en la variable WALLET_GOOGLE_ISSUER_ID.
 *   - El botón lleva a pay.google.com con un JWT firmado; al poner un sello se actualiza
 *     la tarjeta con la API de Google Wallet.
 *
 * Si falta algo, ese botón simplemente no sale en la web. El panel (pestaña Club) dice qué falta.
 */

const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const http2 = require('node:http2');

const DIR_IMAGENES = path.join(__dirname, 'wallet');
const BEIGE = [243, 224, 166];
const CAFE = '#562912';

/* ======================================================================
   Utilidades binarias: CRC32, ZIP y PNG
   ====================================================================== */
const TABLA_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = TABLA_CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function fechaDos(d) {
  return {
    hora: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1),
    dia: ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()
  };
}

/* ZIP con los archivos comprimidos (deflate) */
function crearZip(archivos) {
  const partes = [];
  const central = [];
  const f = fechaDos(new Date());
  let desplazamiento = 0;
  for (const a of archivos) {
    const nombre = Buffer.from(a.nombre, 'utf8');
    const comprimido = zlib.deflateRawSync(a.datos, { level: 9 });
    const crc = crc32(a.datos);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(8, 8);
    local.writeUInt16LE(f.hora, 10);
    local.writeUInt16LE(f.dia, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(comprimido.length, 18);
    local.writeUInt32LE(a.datos.length, 22);
    local.writeUInt16LE(nombre.length, 26);
    partes.push(local, nombre, comprimido);
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0);
    c.writeUInt16LE(20, 4);
    c.writeUInt16LE(20, 6);
    c.writeUInt16LE(0x0800, 8);
    c.writeUInt16LE(8, 10);
    c.writeUInt16LE(f.hora, 12);
    c.writeUInt16LE(f.dia, 14);
    c.writeUInt32LE(crc, 16);
    c.writeUInt32LE(comprimido.length, 20);
    c.writeUInt32LE(a.datos.length, 24);
    c.writeUInt16LE(nombre.length, 28);
    c.writeUInt32LE(desplazamiento, 42);
    central.push(c, nombre);
    desplazamiento += local.length + nombre.length + comprimido.length;
  }
  const tamCentral = central.reduce((s, b) => s + b.length, 0);
  const fin = Buffer.alloc(22);
  fin.writeUInt32LE(0x06054b50, 0);
  fin.writeUInt16LE(archivos.length, 8);
  fin.writeUInt16LE(archivos.length, 10);
  fin.writeUInt32LE(tamCentral, 12);
  fin.writeUInt32LE(desplazamiento, 16);
  return Buffer.concat(partes.concat(central, [fin]));
}

/* PNG RGBA de 8 bits */
function crearPng(ancho, alto, rgba) {
  const fila = ancho * 4 + 1;
  const crudo = Buffer.alloc(fila * alto);
  for (let y = 0; y < alto; y++) rgba.copy(crudo, y * fila + 1, y * ancho * 4, (y + 1) * ancho * 4);
  const trozo = (tipo, datos) => {
    const t = Buffer.from(tipo, 'ascii');
    const largo = Buffer.alloc(4);
    largo.writeUInt32BE(datos.length);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(Buffer.concat([t, datos])));
    return Buffer.concat([largo, t, datos, crc]);
  };
  const cab = Buffer.alloc(13);
  cab.writeUInt32BE(ancho, 0);
  cab.writeUInt32BE(alto, 4);
  cab[8] = 8;   // bits por canal
  cab[9] = 6;   // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    trozo('IHDR', cab),
    trozo('IDAT', zlib.deflateSync(crudo, { level: 9 })),
    trozo('IEND', Buffer.alloc(0))
  ]);
}

/* ======================================================================
   La franja con los sellos (las tazas), como la tarjeta de la web
   ====================================================================== */
function cargarSprite(nombre) {
  const raw = zlib.gunzipSync(fs.readFileSync(path.join(DIR_IMAGENES, nombre)));
  const w = raw.readUInt32BE(0);
  const h = raw.readUInt32BE(4);
  const px = new Float32Array(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const a = raw[8 + i * 4 + 3] / 255;   // se guarda premultiplicado para mezclar sin bordes oscuros
    px[i * 4] = raw[8 + i * 4] * a;
    px[i * 4 + 1] = raw[8 + i * 4 + 1] * a;
    px[i * 4 + 2] = raw[8 + i * 4 + 2] * a;
    px[i * 4 + 3] = a * 255;
  }
  const niveles = [{ w, h, px }];
  while (niveles[niveles.length - 1].w > 24) {
    const s = niveles[niveles.length - 1];
    const w2 = s.w >> 1;
    const h2 = s.h >> 1;
    const p2 = new Float32Array(w2 * h2 * 4);
    for (let y = 0; y < h2; y++) {
      for (let x = 0; x < w2; x++) {
        for (let c = 0; c < 4; c++) {
          p2[(y * w2 + x) * 4 + c] = (s.px[((2 * y) * s.w + 2 * x) * 4 + c] + s.px[((2 * y) * s.w + 2 * x + 1) * 4 + c] +
            s.px[((2 * y + 1) * s.w + 2 * x) * 4 + c] + s.px[((2 * y + 1) * s.w + 2 * x + 1) * 4 + c]) / 4;
        }
      }
    }
    niveles.push({ w: w2, h: h2, px: p2 });
  }
  return niveles;
}

let sprites = null;
function spritesSellos() {
  if (!sprites) sprites = { puesto: cargarSprite('sello-puesto.rgba.gz'), vacio: cargarSprite('sello-vacio.rgba.gz') };
  return sprites;
}

function muestra(s, x, y, salida) {
  x -= 0.5;
  y -= 0.5;
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const pesos = [(1 - fx) * (1 - fy), fx * (1 - fy), (1 - fx) * fy, fx * fy];
  const dx = [0, 1, 0, 1];
  const dy = [0, 0, 1, 1];
  for (let k = 0; k < 4; k++) {
    const xx = x0 + dx[k];
    const yy = y0 + dy[k];
    if (xx < 0 || yy < 0 || xx >= s.w || yy >= s.h) continue;
    const i = (yy * s.w + xx) * 4;
    salida[0] += s.px[i] * pesos[k];
    salida[1] += s.px[i + 1] * pesos[k];
    salida[2] += s.px[i + 2] * pesos[k];
    salida[3] += s.px[i + 3] * pesos[k];
  }
}

/* Pinta un sello centrado en (cx, cy), de lado «tam» y girado «grados» */
function estampar(lienzo, ancho, alto, niveles, cx, cy, tam, grados) {
  let s = niveles[0];
  for (const n of niveles) if (n.w >= tam) s = n;
  const k = s.w / tam;
  const rad = (grados * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const r = (tam / 2) * 1.45;
  const acc = [0, 0, 0, 0];
  const sub = [0.25, 0.75];
  for (let py = Math.max(0, Math.floor(cy - r)); py < Math.min(alto, Math.ceil(cy + r)); py++) {
    for (let px = Math.max(0, Math.floor(cx - r)); px < Math.min(ancho, Math.ceil(cx + r)); px++) {
      acc[0] = acc[1] = acc[2] = acc[3] = 0;
      for (const sy of sub) {
        for (const sx of sub) {
          const dx = px + sx - cx;
          const dy = py + sy - cy;
          const ux = dx * cos + dy * sin;
          const uy = -dx * sin + dy * cos;
          muestra(s, ux * k + s.w / 2, uy * k + s.h / 2, acc);
        }
      }
      const a = acc[3] / 4 / 255;
      if (a <= 0.001) continue;
      const i = (py * ancho + px) * 4;
      for (let c = 0; c < 3; c++) lienzo[i + c] = Math.round(acc[c] / 4 + lienzo[i + c] * (1 - a));
    }
  }
}

const cacheTiras = new Map();
/* Franja de sellos: «puestos» de «necesarios», en un lienzo de ancho × alto píxeles */
function tiraSellos(puestos, necesarios, ancho, alto) {
  const clave = puestos + '/' + necesarios + '/' + ancho + 'x' + alto;
  if (cacheTiras.has(clave)) return cacheTiras.get(clave);
  const lienzo = Buffer.alloc(ancho * alto * 4);
  for (let i = 0; i < ancho * alto; i++) {
    lienzo[i * 4] = BEIGE[0];
    lienzo[i * 4 + 1] = BEIGE[1];
    lienzo[i * 4 + 2] = BEIGE[2];
    lienzo[i * 4 + 3] = 255;
  }
  const escala = alto / 123;
  const mx = 18 * escala;
  const my = 14 * escala;
  const filas = necesarios <= 6 ? 1 : 2;     // como en la web: 10 sellos van en dos filas de 5
  const columnas = Math.ceil(necesarios / filas);
  const celda = Math.min((ancho - 2 * mx) / columnas, (alto - 2 * my) / filas);
  const tam = Math.min(celda * 0.84, 74 * escala);
  const { puesto, vacio } = spritesSellos();
  const arriba = (alto - filas * celda) / 2;
  for (let i = 0; i < necesarios; i++) {
    const f = Math.floor(i / columnas);
    const enFila = f < filas - 1 ? columnas : necesarios - columnas * (filas - 1);
    const col = i - f * columnas;
    const x0 = (ancho - enFila * celda) / 2;
    const cx = x0 + celda * (col + 0.5);
    const cy = arriba + celda * (f + 0.5);
    const lleno = i < puestos;
    estampar(lienzo, ancho, alto, lleno ? puesto : vacio, cx, cy, tam, lleno ? ((i * 37) % 13) - 6 : 0);
  }
  const png = crearPng(ancho, alto, lienzo);
  if (cacheTiras.size > 400) cacheTiras.clear();
  cacheTiras.set(clave, png);
  return png;
}

/* ======================================================================
   Firma PKCS#7 (CMS) separada, como pide Apple para el manifest.json
   ====================================================================== */
function der(tag, contenido) {
  const largo = contenido.length;
  let cab;
  if (largo < 0x80) cab = Buffer.from([tag, largo]);
  else {
    const bytes = [];
    let n = largo;
    while (n > 0) { bytes.unshift(n & 0xff); n = Math.floor(n / 256); }
    cab = Buffer.from([tag, 0x80 | bytes.length].concat(bytes));
  }
  return Buffer.concat([cab, contenido]);
}
const secuencia = (...p) => der(0x30, Buffer.concat(p));
const conjunto = (...p) => der(0x31, Buffer.concat(p.slice().sort(Buffer.compare)));
const entero = (n) => der(0x02, Buffer.from([n]));
const octetos = (b) => der(0x04, b);
const NULO = Buffer.from([0x05, 0x00]);
function oid(texto) {
  const p = texto.split('.').map(Number);
  const bytes = [40 * p[0] + p[1]];
  for (const n of p.slice(2)) {
    const b = [n & 0x7f];
    let v = Math.floor(n / 128);
    while (v > 0) { b.unshift((v & 0x7f) | 0x80); v = Math.floor(v / 128); }
    bytes.push(...b);
  }
  return der(0x06, Buffer.from(bytes));
}
function horaUtc(d) {
  const dd = (n) => String(n).padStart(2, '0');
  return der(0x17, Buffer.from(dd(d.getUTCFullYear() % 100) + dd(d.getUTCMonth() + 1) + dd(d.getUTCDate()) +
    dd(d.getUTCHours()) + dd(d.getUTCMinutes()) + dd(d.getUTCSeconds()) + 'Z', 'ascii'));
}
function leerTLV(buf, pos) {
  let largo = buf[pos + 1];
  let cab = 2;
  if (largo & 0x80) {
    const n = largo & 0x7f;
    largo = 0;
    for (let i = 0; i < n; i++) largo = largo * 256 + buf[pos + 2 + i];
    cab = 2 + n;
  }
  return { tag: buf[pos], inicio: pos, contenido: pos + cab, fin: pos + cab + largo };
}
/* Emisor y número de serie del certificado, tal cual vienen en el DER */
function emisorYSerie(certDer) {
  const cert = leerTLV(certDer, 0);
  const tbs = leerTLV(certDer, cert.contenido);
  let t = leerTLV(certDer, tbs.contenido);
  if (t.tag === 0xa0) t = leerTLV(certDer, t.fin);                 // versión
  const serie = certDer.subarray(t.inicio, t.fin);
  t = leerTLV(certDer, t.fin);                                      // algoritmo de firma
  t = leerTLV(certDer, t.fin);                                      // emisor
  return { emisor: certDer.subarray(t.inicio, t.fin), serie };
}

function firmarPkcs7(datos, apple) {
  const SHA256 = secuencia(oid('2.16.840.1.101.3.4.2.1'), NULO);
  const atributos = [
    secuencia(oid('1.2.840.113549.1.9.3'), conjunto(oid('1.2.840.113549.1.7.1'))),
    secuencia(oid('1.2.840.113549.1.9.5'), conjunto(horaUtc(new Date()))),
    secuencia(oid('1.2.840.113549.1.9.4'), conjunto(octetos(crypto.createHash('sha256').update(datos).digest())))
  ].sort(Buffer.compare);
  const firmados = Buffer.concat(atributos);
  const firma = crypto.sign('sha256', der(0x31, firmados), apple.clave);
  const esEc = apple.clave.asymmetricKeyType === 'ec';
  const algoritmoFirma = esEc ? secuencia(oid('1.2.840.10045.4.3.2')) : secuencia(oid('1.2.840.113549.1.1.1'), NULO);
  const { emisor, serie } = emisorYSerie(apple.certDer);
  const firmante = secuencia(entero(1), secuencia(emisor, serie), SHA256, der(0xa0, firmados), algoritmoFirma, octetos(firma));
  const datosFirmados = secuencia(
    entero(1),
    conjunto(SHA256),
    secuencia(oid('1.2.840.113549.1.7.1')),
    der(0xa0, Buffer.concat([apple.certDer, apple.wwdrDer])),
    conjunto(firmante)
  );
  return secuencia(oid('1.2.840.113549.1.7.2'), der(0xa0, datosFirmados));
}

/* ======================================================================
   Credenciales: se leen de la carpeta de datos
   ====================================================================== */
function bloquesPem(texto) {
  const re = /-----BEGIN ([A-Z0-9 ]+)-----[\s\S]+?-----END \1-----/g;
  const salida = [];
  let m;
  while ((m = re.exec(texto))) salida.push({ tipo: m[1], pem: m[0] });
  return salida;
}

function cargarApple(dir) {
  const r = { activo: false, motivo: '', passTypeId: '', teamId: '', caduca: '' };
  let nombres;
  try { nombres = fs.readdirSync(dir); } catch (e) { r.motivo = 'Faltan los certificados de Apple (carpeta wallet/apple de los datos).'; return r; }
  const certs = [];
  let clave = null;
  let claveCifrada = false;
  for (const n of nombres) {
    const ruta = path.join(dir, n);
    let buf;
    try { if (!fs.statSync(ruta).isFile()) continue; buf = fs.readFileSync(ruta); } catch (e) { continue; }
    const texto = buf.toString('latin1');
    const bloques = bloquesPem(texto);
    const intentos = bloques.length ? bloques : [{ tipo: 'DER', pem: null }];
    for (const b of intentos) {
      if (b.tipo === 'CERTIFICATE' || b.tipo === 'DER') {
        try { certs.push(new crypto.X509Certificate(b.pem || buf)); continue; } catch (e) { /* no es un certificado */ }
      }
      if (/PRIVATE KEY/.test(b.tipo) || b.tipo === 'DER') {
        try {
          clave = crypto.createPrivateKey({ key: b.pem || buf, format: b.pem ? 'pem' : 'der', type: b.pem ? undefined : 'pkcs8', passphrase: process.env.WALLET_APPLE_KEY_PASSWORD || undefined });
        } catch (e) {
          if (/ENCRYPTED/.test(b.tipo) || /passphrase|decrypt|bad decrypt/i.test(e.message)) claveCifrada = true;
        }
      }
    }
  }
  const tarjeta = certs.find((c) => /Pass Type ID|UID=pass\./.test(c.subject));
  const wwdr = certs.find((c) => c !== tarjeta && tarjeta && tarjeta.checkIssued(c));
  if (!tarjeta) { r.motivo = 'Falta el certificado de la tarjeta (Pass Type ID) de Apple.'; return r; }
  r.passTypeId = (tarjeta.subject.match(/UID=([^\n,]+)/) || [])[1] || '';
  r.teamId = (tarjeta.subject.match(/OU=([^\n,]+)/) || [])[1] || '';
  r.caduca = new Date(tarjeta.validTo).toISOString();
  if (!wwdr) { r.motivo = 'Falta el certificado intermedio de Apple (WWDR G4) que firma el de la tarjeta.'; return r; }
  if (!clave) { r.motivo = claveCifrada ? 'La clave privada tiene contraseña: ponla en WALLET_APPLE_KEY_PASSWORD.' : 'Falta la clave privada del certificado de la tarjeta.'; return r; }
  if (!tarjeta.checkPrivateKey(clave)) { r.motivo = 'La clave privada no corresponde al certificado de la tarjeta.'; return r; }
  if (!r.passTypeId || !r.teamId) { r.motivo = 'No se ha podido leer el Pass Type ID o el Team ID del certificado.'; return r; }
  if (new Date(tarjeta.validTo) < new Date()) { r.motivo = 'El certificado de la tarjeta ha caducado: renuévalo en la web de Apple.'; return r; }
  r.activo = true;
  r.certDer = tarjeta.raw;
  r.certPem = tarjeta.toString();
  r.wwdrDer = wwdr.raw;
  r.clave = clave;
  r.clavePem = clave.export({ type: 'pkcs8', format: 'pem' });
  return r;
}

function cargarGoogle(dir) {
  const r = { activo: false, motivo: '', issuerId: String(process.env.WALLET_GOOGLE_ISSUER_ID || '').trim(), email: '' };
  let nombres;
  try { nombres = fs.readdirSync(dir); } catch (e) { r.motivo = 'Falta la cuenta de servicio de Google (carpeta wallet/google de los datos).'; return r; }
  let cuenta = null;
  for (const n of nombres) {
    if (!/\.json$/i.test(n)) continue;
    try {
      const j = JSON.parse(fs.readFileSync(path.join(dir, n), 'utf8'));
      if (j && j.type === 'service_account' && j.private_key && j.client_email) { cuenta = j; break; }
    } catch (e) { /* no es la cuenta */ }
  }
  if (!cuenta) { r.motivo = 'Falta el archivo JSON de la cuenta de servicio de Google Cloud.'; return r; }
  r.email = cuenta.client_email;
  if (!/^\d{6,25}$/.test(r.issuerId)) { r.motivo = 'Falta el ID de emisor de Google Wallet en WALLET_GOOGLE_ISSUER_ID.'; return r; }
  try { r.clave = crypto.createPrivateKey(cuenta.private_key); } catch (e) { r.motivo = 'La clave de la cuenta de servicio de Google no es válida.'; return r; }
  r.clase = r.issuerId + '.' + String(process.env.WALLET_GOOGLE_CLASE || 'club_sono').replace(/[^\w.-]/g, '');
  r.activo = true;
  return r;
}

/* ======================================================================
   La tarjeta
   ====================================================================== */
const fMes = new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' });
function codigoBonito(c) { return c.slice(0, 4) + '-' + c.slice(4); }
function datosTarjeta(socio, club) {
  const necesarios = club.sellos;
  const puestos = Math.min(socio.sellos, necesarios);
  return {
    necesarios,
    puestos,
    completa: socio.sellos >= necesarios,
    faltan: Math.max(0, necesarios - socio.sellos),
    codigo: codigoBonito(socio.codigo),
    desde: fMes.format(new Date(socio.creado))
  };
}

function base64url(b) { return Buffer.from(b).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_'); }
function jwtRS256(carga, clave) {
  const cuerpo = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' })) + '.' + base64url(JSON.stringify(carga));
  return cuerpo + '.' + base64url(crypto.sign('RSA-SHA256', Buffer.from(cuerpo), clave));
}

function crearWallet(op) {
  // op: { dirDatos, socios(), guardarSocios(), ajustesClub(), secreto (Buffer), urlPublica }
  const dirWallet = path.join(op.dirDatos, 'wallet');
  const archivoRegistros = path.join(dirWallet, 'registros.json');
  let apple = { activo: false, motivo: '' };
  let google = { activo: false, motivo: '' };
  let registros = [];          // { dispositivo, pushToken, serie, desde }
  let globalActualizado = 0;   // cuando cambian los sellos o el premio del club, cambian todas
  let baseConocida = String(op.urlPublica || '').replace(/\/+$/, '');

  function log(t) { console.log('[soño] Wallet: ' + t); }

  function recargar() {
    try { fs.mkdirSync(path.join(dirWallet, 'apple'), { recursive: true }); fs.mkdirSync(path.join(dirWallet, 'google'), { recursive: true }); } catch (e) { /* sin permisos: se informa abajo */ }
    apple = cargarApple(path.join(dirWallet, 'apple'));
    google = cargarGoogle(path.join(dirWallet, 'google'));
    try {
      const guardado = JSON.parse(fs.readFileSync(archivoRegistros, 'utf8'));
      registros = Array.isArray(guardado.registros) ? guardado.registros : [];
      globalActualizado = Number(guardado.global) || 0;
    } catch (e) { registros = []; }
    log('Apple ' + (apple.activo ? 'activa (' + apple.passTypeId + ')' : 'sin configurar: ' + apple.motivo));
    log('Google ' + (google.activo ? 'activa (emisor ' + google.issuerId + ')' : 'sin configurar: ' + google.motivo));
  }

  let colaRegistros = Promise.resolve();
  function guardarRegistros() {
    const datos = JSON.stringify({ registros, global: globalActualizado }, null, 2);
    colaRegistros = colaRegistros.then(async () => {
      const tmp = archivoRegistros + '.' + process.pid + '.tmp';
      await fsp.writeFile(tmp, datos);
      await fsp.rename(tmp, archivoRegistros);
    }).catch((e) => log('no se han podido guardar los registros: ' + e.message));
    return colaRegistros;
  }

  /* Dirección pública de la web (https://…). Si no está en WALLET_URL, sale de la petición */
  function baseDe(req) {
    if (op.urlPublica) return baseConocida;
    if (req) {
      const host = String((op.confiarProxy && req.headers['x-forwarded-host']) || req.headers.host || '').split(',')[0].trim();
      if (host && /^[a-z0-9.:[\]-]+$/i.test(host)) {
        const b = (op.esHttps(req) ? 'https://' : 'http://') + host;
        if (b.startsWith('https://')) baseConocida = b;
        return b;
      }
    }
    return baseConocida;
  }

  function estado() {
    return {
      apple: { activo: apple.activo, motivo: apple.motivo, passTypeId: apple.passTypeId || '', caduca: apple.caduca || '', registrados: registros.length },
      google: { activo: google.activo, motivo: google.motivo, issuerId: google.issuerId || '' },
      https: /^https:\/\//.test(baseConocida)
    };
  }
  function disponible() { return { apple: apple.activo, google: google.activo }; }

  /* Datos de wallet de cada socio: la clave de su tarjeta y cuándo cambió por última vez */
  async function prepararSocio(socio) {
    if (socio.wallet && socio.wallet.token) return socio.wallet;
    socio.wallet = Object.assign({ token: crypto.randomBytes(24).toString('hex'), actualizado: Date.now(), google: false }, socio.wallet || {});
    await op.guardarSocios();
    return socio.wallet;
  }
  function actualizadoDe(socio) { return Math.max((socio.wallet && socio.wallet.actualizado) || 0, globalActualizado); }

  /* --- Apple --- */
  function passJson(socio, base) {
    const club = op.ajustesClub();
    const d = datosTarjeta(socio, club);
    const j = {
      formatVersion: 1,
      passTypeIdentifier: apple.passTypeId,
      serialNumber: socio.id,
      teamIdentifier: apple.teamId,
      organizationName: 'SOÑO',
      description: 'Tarjeta de desayunos del Club SOÑO',
      logoText: 'Club',
      foregroundColor: 'rgb(86, 41, 18)',
      backgroundColor: 'rgb(243, 224, 166)',
      labelColor: 'rgb(122, 85, 57)',
      suppressStripShine: true,
      sharingProhibited: true,
      barcodes: [{ format: 'PKBarcodeFormatQR', message: 'SONO:' + socio.codigo, messageEncoding: 'iso-8859-1', altText: d.codigo }],
      storeCard: {
        headerFields: [{
          key: 'sellos', label: 'SELLOS', value: d.puestos + ' / ' + d.necesarios,
          textAlignment: 'PKTextAlignmentRight', changeMessage: 'Nuevo sello en tu tarjeta de SOÑO: llevas %@'
        }],
        secondaryFields: [
          { key: 'socio', label: 'SOCIO', value: socio.nombre },
          d.completa
            ? { key: 'premio', label: '¡TARJETA COMPLETA!', value: 'Tienes ' + club.premio, textAlignment: 'PKTextAlignmentRight', changeMessage: '%@. Enséñala al pedir' }
            : { key: 'premio', label: d.faltan === 1 ? 'TE FALTA 1 PARA' : 'TE FALTAN ' + d.faltan + ' PARA', value: club.premio, textAlignment: 'PKTextAlignmentRight' }
        ],
        backFields: [
          { key: 'como', label: 'Cómo funciona', value: 'Enseña el QR en la barra al pedir y te ponemos el sello. Con ' + d.necesarios + ' sellos tienes ' + club.premio + '.' },
          { key: 'codigo', label: 'Código de la tarjeta', value: d.codigo },
          { key: 'total', label: 'Desayunos con nosotros', value: String(socio.total) },
          { key: 'desde', label: 'Socio desde', value: d.desde },
          { key: 'actualiza', label: 'Se actualiza sola', value: 'Cada vez que te ponemos un sello, esta tarjeta cambia sola.' }
        ]
      }
    };
    if (base) {
      j.storeCard.backFields.push({ key: 'web', label: 'Tu tarjeta en la web', value: base + '/#tarjeta' });
      j.storeCard.backFields.push({ key: 'privacidad', label: 'Privacidad', value: base + '/privacidad' });
    }
    if (/^https:\/\//.test(base || '')) {
      j.webServiceURL = base + '/wallet/apple';
      j.authenticationToken = socio.wallet.token;
    }
    return j;
  }

  async function passApple(socio, base) {
    if (!apple.activo) throw Object.assign(new Error('Apple Wallet no está configurada.'), { status: 404, publico: true });
    await prepararSocio(socio);
    const club = op.ajustesClub();
    const d = datosTarjeta(socio, club);
    const leer = (n) => fs.readFileSync(path.join(DIR_IMAGENES, n));
    const archivos = [
      { nombre: 'pass.json', datos: Buffer.from(JSON.stringify(passJson(socio, base)), 'utf8') },
      { nombre: 'icon.png', datos: leer('icono.png') },
      { nombre: 'icon@2x.png', datos: leer('icono@2x.png') },
      { nombre: 'icon@3x.png', datos: leer('icono@3x.png') },
      { nombre: 'logo.png', datos: leer('logo.png') },
      { nombre: 'logo@2x.png', datos: leer('logo@2x.png') },
      { nombre: 'logo@3x.png', datos: leer('logo@3x.png') },
      { nombre: 'strip.png', datos: tiraSellos(d.puestos, d.necesarios, 375, 123) },
      { nombre: 'strip@2x.png', datos: tiraSellos(d.puestos, d.necesarios, 750, 246) },
      { nombre: 'strip@3x.png', datos: tiraSellos(d.puestos, d.necesarios, 1125, 369) }
    ];
    const manifiesto = {};
    for (const a of archivos) manifiesto[a.nombre] = crypto.createHash('sha1').update(a.datos).digest('hex');
    const manifest = Buffer.from(JSON.stringify(manifiesto), 'utf8');
    archivos.push({ nombre: 'manifest.json', datos: manifest });
    archivos.push({ nombre: 'signature', datos: firmarPkcs7(manifest, apple) });
    return crearZip(archivos);
  }

  /* Avisa a los iPhone que tienen la tarjeta (APNs, con el mismo certificado) */
  function avisarApple(series) {
    if (!apple.activo) return;
    const objetivo = registros.filter((r) => series === null || series.includes(r.serie));
    const tokens = Array.from(new Set(objetivo.map((r) => r.pushToken)));
    if (!tokens.length) return;
    let sesion;
    try {
      sesion = http2.connect('https://api.push.apple.com:443', { cert: apple.certPem, key: apple.clavePem });
    } catch (e) { log('no se ha podido conectar con Apple: ' + e.message); return; }
    sesion.on('error', (e) => log('error con Apple: ' + e.message));
    sesion.setTimeout(15000, () => sesion.close());
    let pendientes = tokens.length;
    let malos = [];
    const terminar = () => {
      if (--pendientes > 0) return;
      sesion.close();
      if (malos.length) {
        registros = registros.filter((r) => !malos.includes(r.pushToken));
        guardarRegistros();
        log(malos.length + ' iPhone ya no tienen la tarjeta; se quitan del registro');
      }
    };
    for (const token of tokens) {
      let estadoHttp = 0;
      let cuerpo = '';
      const req = sesion.request({ ':method': 'POST', ':path': '/3/device/' + token, 'apns-topic': apple.passTypeId, 'content-type': 'application/json' });
      req.setEncoding('utf8');
      req.on('response', (h) => { estadoHttp = h[':status']; });
      req.on('data', (c) => { cuerpo += c; });
      req.on('end', () => {
        if (estadoHttp === 410 || /BadDeviceToken|Unregistered/.test(cuerpo)) malos.push(token);
        else if (estadoHttp !== 200) log('Apple respondió ' + estadoHttp + ' ' + cuerpo.slice(0, 120));
        terminar();
      });
      req.on('error', (e) => { log('aviso a Apple fallido: ' + e.message); terminar(); });
      req.end('{}');
    }
  }

  /* --- Google --- */
  function claseGoogle(base) {
    return {
      id: google.clase,
      issuerName: 'SOÑO',
      programName: 'Club SOÑO',
      programLogo: {
        sourceUri: { uri: base + '/wallet/logo-cuadrado.png' },
        contentDescription: { defaultValue: { language: 'es-ES', value: 'Logo de SOÑO' } }
      },
      hexBackgroundColor: '#F3E0A6',
      countryCode: 'ES',
      reviewStatus: 'UNDER_REVIEW',
      multipleDevicesAndHoldersAllowedStatus: 'ONE_USER_ALL_DEVICES'
    };
  }
  function firmaTira(id) { return crypto.createHmac('sha256', op.secreto).update('tira:' + id).digest('hex').slice(0, 20); }
  function objetoGoogle(socio, base) {
    const club = op.ajustesClub();
    const d = datosTarjeta(socio, club);
    const o = {
      id: google.issuerId + '.' + socio.id,
      classId: google.clase,
      state: 'ACTIVE',
      accountId: d.codigo,
      accountName: socio.nombre,
      hexBackgroundColor: '#F3E0A6',
      loyaltyPoints: { label: 'Sellos', balance: { string: d.puestos + ' / ' + d.necesarios } },
      secondaryLoyaltyPoints: {
        label: d.completa ? '¡Tarjeta completa!' : (d.faltan === 1 ? 'Te falta 1 para' : 'Te faltan ' + d.faltan + ' para'),
        balance: { string: d.completa ? 'Tienes ' + club.premio : club.premio }
      },
      barcode: { type: 'QR_CODE', value: 'SONO:' + socio.codigo, alternateText: d.codigo },
      heroImage: {
        sourceUri: { uri: base + '/wallet/tira/' + socio.id + '-' + d.puestos + '-' + d.necesarios + '.png?k=' + firmaTira(socio.id) },
        contentDescription: { defaultValue: { language: 'es-ES', value: d.puestos + ' de ' + d.necesarios + ' sellos' } }
      },
      textModulesData: [
        { id: 'como', header: 'Cómo funciona', body: 'Enseña el QR en la barra al pedir y te ponemos el sello. Con ' + d.necesarios + ' sellos tienes ' + club.premio + '.' },
        { id: 'total', header: 'Desayunos con nosotros', body: String(socio.total) + ' · socio desde ' + d.desde }
      ],
      linksModuleData: { uris: [{ id: 'web', uri: base + '/#tarjeta', description: 'Tu tarjeta en la web' }] }
    };
    return o;
  }
  async function enlaceGoogle(socio, base) {
    if (!google.activo) throw Object.assign(new Error('Google Wallet no está configurada.'), { status: 404, publico: true });
    if (!/^https:\/\//.test(base || '')) throw Object.assign(new Error('Google Wallet necesita que la web vaya por https.'), { status: 409, publico: true });
    await prepararSocio(socio);
    if (!socio.wallet.google) { socio.wallet.google = true; await op.guardarSocios(); }
    const carga = {
      iss: google.email,
      aud: 'google',
      typ: 'savetowallet',
      iat: Math.floor(Date.now() / 1000),
      origins: [base],
      payload: { loyaltyClasses: [claseGoogle(base)], loyaltyObjects: [objetoGoogle(socio, base)] }
    };
    return 'https://pay.google.com/gp/v/save/' + jwtRS256(carga, google.clave);
  }

  let tokenGoogle = { valor: '', caduca: 0 };
  async function accesoGoogle() {
    if (tokenGoogle.valor && tokenGoogle.caduca > Date.now() + 60000) return tokenGoogle.valor;
    const ahora = Math.floor(Date.now() / 1000);
    const afirmacion = jwtRS256({
      iss: google.email,
      scope: 'https://www.googleapis.com/auth/wallet_object.issuer',
      aud: 'https://oauth2.googleapis.com/token',
      iat: ahora,
      exp: ahora + 3600
    }, google.clave);
    const r = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'grant_type=' + encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer') + '&assertion=' + afirmacion,
      signal: AbortSignal.timeout(15000)
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.access_token) throw new Error('Google no ha dado acceso (' + r.status + ')');
    tokenGoogle = { valor: j.access_token, caduca: Date.now() + (j.expires_in || 3600) * 1000 };
    return tokenGoogle.valor;
  }
  async function actualizarGoogle(socio) {
    const base = baseConocida;
    if (!google.activo || !socio.wallet || !socio.wallet.google || !/^https:\/\//.test(base)) return;
    const o = objetoGoogle(socio, base);
    const r = await fetch('https://walletobjects.googleapis.com/walletobjects/v1/loyaltyObject/' + encodeURIComponent(o.id), {
      method: 'PATCH',
      headers: { Authorization: 'Bearer ' + (await accesoGoogle()), 'Content-Type': 'application/json' },
      body: JSON.stringify(o),
      signal: AbortSignal.timeout(15000)
    });
    if (r.status === 404) return;   // aún no la ha guardado en su Google Wallet
    if (!r.ok) log('Google respondió ' + r.status + ' al actualizar una tarjeta');
  }

  /* --- Cambios: un sello, un canje, o los ajustes del club --- */
  function cambioSocio(socio) {
    if (!socio.wallet || !socio.wallet.token) return;          // no tiene la tarjeta en ninguna wallet
    socio.wallet.actualizado = Date.now();
    avisarApple([socio.id]);
    actualizarGoogle(socio).catch((e) => log('no se ha podido actualizar en Google: ' + e.message));
  }
  function cambioClub() {
    globalActualizado = Date.now();
    guardarRegistros();
    avisarApple(null);
    const conGoogle = op.socios().filter((s) => s.wallet && s.wallet.google);
    (async () => {
      for (const s of conGoogle) {
        try { await actualizarGoogle(s); } catch (e) { log('no se ha podido actualizar en Google: ' + e.message); break; }
      }
    })();
  }
  function olvidar(idSocio) {
    const antes = registros.length;
    registros = registros.filter((r) => r.serie !== idSocio);
    if (registros.length !== antes) guardarRegistros();
  }

  /* ======================================================================
     Rutas /wallet/…: imágenes públicas y el servicio web de Apple
     ====================================================================== */
  function responder(res, estado, cuerpo, cabeceras) {
    res.writeHead(estado, Object.assign({ 'Cache-Control': 'no-store' }, cabeceras || {}));
    res.end(cuerpo);
  }
  function json(res, estado, datos) {
    responder(res, estado, JSON.stringify(datos), { 'Content-Type': 'application/json; charset=utf-8' });
  }
  function leerJson(req) {
    return new Promise((ok) => {
      let total = 0;
      const trozos = [];
      req.on('data', (c) => { total += c.length; if (total <= 32768) trozos.push(c); });
      req.on('end', () => { try { ok(JSON.parse(Buffer.concat(trozos).toString('utf8') || '{}')); } catch (e) { ok({}); } });
      req.on('error', () => ok({}));
    });
  }
  function socioConToken(req, serie) {
    const auth = String(req.headers.authorization || '');
    const m = auth.match(/^ApplePass\s+([a-f0-9]{48})$/i);
    if (!m) return null;
    const socio = op.socios().find((s) => s.id === serie);
    if (!socio || !socio.wallet || !socio.wallet.token) return null;
    const a = Buffer.from(m[1].toLowerCase());
    const b = Buffer.from(socio.wallet.token);
    return a.length === b.length && crypto.timingSafeEqual(a, b) ? socio : null;
  }

  async function atender(req, res, pathname, permitir) {
    const metodo = req.method;
    if (pathname === '/wallet/logo-cuadrado.png' && (metodo === 'GET' || metodo === 'HEAD')) {
      responder(res, 200, fs.readFileSync(path.join(DIR_IMAGENES, 'logo-cuadrado.png')), { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=86400' });
      return true;
    }
    const mTira = pathname.match(/^\/wallet\/tira\/([a-f0-9]{16})-\d+-\d+\.png$/);
    if (mTira && metodo === 'GET') {
      const url = new URL(req.url, 'http://x');
      const socio = op.socios().find((s) => s.id === mTira[1]);
      if (!socio || url.searchParams.get('k') !== firmaTira(socio.id)) { responder(res, 404, 'No encontrado'); return true; }
      const d = datosTarjeta(socio, op.ajustesClub());
      responder(res, 200, tiraSellos(d.puestos, d.necesarios, 1032, 336), { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=300' });
      return true;
    }
    if (!pathname.startsWith('/wallet/apple/v1/')) return false;
    if (!apple.activo) { responder(res, 404, ''); return true; }
    if (!permitir('wallet', 120)) { responder(res, 429, ''); return true; }
    const partes = pathname.slice('/wallet/apple/v1/'.length).split('/').map((p) => { try { return decodeURIComponent(p); } catch (e) { return ''; } });

    // POST/DELETE /devices/:dispositivo/registrations/:passTypeId/:serie
    if (partes[0] === 'devices' && partes[2] === 'registrations' && partes.length === 5 && (metodo === 'POST' || metodo === 'DELETE')) {
      const [, dispositivo, , ptid, serie] = partes;
      if (ptid !== apple.passTypeId || !/^[\w-]{1,128}$/.test(dispositivo)) { responder(res, 404, ''); return true; }
      const socio = socioConToken(req, serie);
      if (!socio) { responder(res, 401, ''); return true; }
      if (metodo === 'DELETE') {
        registros = registros.filter((r) => !(r.dispositivo === dispositivo && r.serie === serie));
        await guardarRegistros();
        responder(res, 200, '');
        return true;
      }
      const cuerpo = await leerJson(req);
      const pushToken = String(cuerpo.pushToken || '');
      if (!/^[a-f0-9]{16,200}$/i.test(pushToken)) { responder(res, 400, ''); return true; }
      const existente = registros.find((r) => r.dispositivo === dispositivo && r.serie === serie);
      if (existente) {
        existente.pushToken = pushToken;
        await guardarRegistros();
        responder(res, 200, '');
      } else {
        if (registros.length > 20000) { responder(res, 503, ''); return true; }
        registros.push({ dispositivo, pushToken, serie, desde: new Date().toISOString() });
        await guardarRegistros();
        log('una tarjeta se ha añadido a Apple Wallet');
        responder(res, 201, '');
      }
      return true;
    }

    // GET /devices/:dispositivo/registrations/:passTypeId?passesUpdatedSince=…
    if (partes[0] === 'devices' && partes[2] === 'registrations' && partes.length === 4 && metodo === 'GET') {
      const [, dispositivo, , ptid] = partes;
      if (ptid !== apple.passTypeId) { responder(res, 404, ''); return true; }
      const desde = Number(new URL(req.url, 'http://x').searchParams.get('passesUpdatedSince')) || 0;
      const series = registros.filter((r) => r.dispositivo === dispositivo).map((r) => r.serie);
      let ultimo = 0;
      const cambiadas = series.filter((serie) => {
        const s = op.socios().find((x) => x.id === serie);
        if (!s) return false;
        const t = actualizadoDe(s);
        if (t > ultimo) ultimo = t;
        return t > desde;
      });
      if (!cambiadas.length) { responder(res, 204, ''); return true; }
      json(res, 200, { serialNumbers: cambiadas, lastUpdated: String(ultimo) });
      return true;
    }

    // GET /passes/:passTypeId/:serie
    if (partes[0] === 'passes' && partes.length === 3 && metodo === 'GET') {
      const [, ptid, serie] = partes;
      if (ptid !== apple.passTypeId) { responder(res, 404, ''); return true; }
      const socio = socioConToken(req, serie);
      if (!socio) { responder(res, 401, ''); return true; }
      const t = actualizadoDe(socio);
      const modificado = new Date(Math.floor(t / 1000) * 1000);
      const ims = Date.parse(String(req.headers['if-modified-since'] || ''));
      if (ims && ims >= modificado.getTime()) { responder(res, 304, ''); return true; }
      const pass = await passApple(socio, baseDe(req));
      responder(res, 200, pass, {
        'Content-Type': 'application/vnd.apple.pkpass',
        'Last-Modified': modificado.toUTCString(),
        'Content-Length': pass.length
      });
      return true;
    }

    // POST /log
    if (partes[0] === 'log' && metodo === 'POST') {
      const cuerpo = await leerJson(req);
      (Array.isArray(cuerpo.logs) ? cuerpo.logs.slice(0, 5) : []).forEach((l) => log('mensaje del iPhone: ' + String(l).slice(0, 200)));
      responder(res, 200, '');
      return true;
    }

    responder(res, 404, '');
    return true;
  }

  recargar();
  return { estado, disponible, baseDe, passApple, enlaceGoogle, cambioSocio, cambioClub, olvidar, atender, recargar };
}

module.exports = { crearWallet, tiraSellos, crearZip, crearPng, firmarPkcs7, emisorYSerie, CAFE };
