'use strict';

/*
 * SOÑO · servidor web
 * Sin dependencias externas: solo Node.js 20 o superior.
 * Sirve la web, guarda la carta, fotos, horarios, reservas, mensajes (y las candidaturas con su
 * currículum), los socios del club y las reseñas en la carpeta de datos, y protege el panel
 * con usuario y contraseña.
 */

const http = require('node:http');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { crearWallet } = require('./wallet');
const textosWeb = require('./textos');

/* ---------- Configuración (variables de entorno) ---------- */
const PUERTO = Number(process.env.PORT || 3000);
const DIR_DATOS = path.resolve(process.env.DATA_DIR || path.join(__dirname, 'data'));
const DIR_FOTOS = path.join(DIR_DATOS, 'fotos');
const DIR_CV = path.join(DIR_DATOS, 'cv');          // currículums de «Trabaja con nosotros» (no se sirven en público)
const DIR_PUBLICO = path.join(__dirname, 'public');
const ARCHIVO_INICIAL = path.join(__dirname, 'datos-iniciales.json');
const ADMIN_USUARIO = normalizarUsuario(process.env.ADMIN_USER || 'soño');
const ADMIN_CLAVE = process.env.ADMIN_PASSWORD || '';
const CONFIAR_PROXY = /^(1|true|si|sí|yes)$/i.test(process.env.TRUST_PROXY || '');
const COOKIE_SEGURA = (process.env.COOKIE_SECURE || 'auto').toLowerCase();

const HORAS_SESION = 12;
const MAX_JSON = 512 * 1024;
const MAX_FOTO = 10 * 1024 * 1024;
const MAX_VIDEO = 30 * 1024 * 1024;   // vídeos cortos de los productos
const MAX_RESERVAS = 3000;
const MAX_MENSAJES = 1000;
const MAX_PEDIDOS = 3000;
/* Trabaja con nosotros: candidaturas con currículum (PDF, Word o foto) */
const EMPLEO_INICIAL = { activo: true };
const MAX_CV = 5 * 1024 * 1024;
const MAX_JSON_CV = Math.ceil(MAX_CV * 4 / 3) + 64 * 1024;   // el archivo llega en base64 dentro del JSON
const MAX_CANDIDATURAS = 300;
const RE_CV = /^[a-f0-9]{32}\.(pdf|doc|docx|odt|jpg|png|webp)$/;
const TIPOS_CV = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  odt: 'application/vnd.oasis.opendocument.text',
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp'
};
/* Lo mejor del mes: hasta 3 destacados (de la carta o escritos a mano) */
const MES_INICIAL = { activo: true };
const MAX_MES = 3;
const MAX_VERSIONES_SECCION = 30;  // versiones que se guardan de cada parte de la web

const MAX_GRUPOS = 12;
/* Zonas del local que se pueden elegir al reservar (el tipo decide el dibujo del plano) */
const TIPOS_ZONA = ['mesas', 'terraza', 'lectura', 'barra'];
const MAX_ZONAS = 6;
const ZONAS_INICIALES = [
  { id: 'interior', nombre: 'Interior', tipo: 'mesas', activa: true },
  { id: 'lectura', nombre: 'Zona de lectura', tipo: 'lectura', activa: true },
  { id: 'terraza', nombre: 'Terraza', tipo: 'terraza', activa: true }
];
/* Club SOÑO: tarjeta de sellos de los socios */
const CLUB_INICIAL = { activo: true, sellos: 10, premio: 'un desayuno gratis' };
const MAX_SOCIOS = 5000;
const MAX_HISTORIAL = 30;
const DIAS_SESION_SOCIO = 120;
const ALFABETO_CODIGO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   // sin 0/O ni 1/I, para dictarlo sin dudas
/* Reseñas: las escriben los clientes y salen en la web cuando el personal las publica */
const RESENAS_INICIAL = { activo: true };
const MAX_RESENAS = 2000;
const MAX_RESENAS_PENDIENTES = 200;
/* Datos del titular para el aviso legal y la política de privacidad */
const LEGAL_VACIO = { titular: '', nif: '', domicilio: '', email: '', registro: '', actualizado: '' };
const RE_NIF = /^([0-9]{8}[A-Z]|[XYZ][0-9]{7}[A-Z]|[ABCDEFGHJNPQRSUVW][0-9]{7}[0-9A-J])$/;
/* La página de textos legales: una sola página con tres pestañas */
const PAGINAS_LEGALES = ['/legal', '/aviso-legal', '/privacidad', '/cookies'];
const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ICONOS = ['taza', 'vaso', 'vaso-alto', 'coldbrew', 'cruasan', 'tostada', 'bol', 'bizcocho', 'filtro', 'prensa', 'chemex', 'llevar'];
const DIAS_SEMANA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const ALERGENOS = ['gluten', 'crustaceos', 'huevos', 'pescado', 'cacahuetes', 'soja', 'lacteos', 'frutos', 'apio', 'mostaza', 'sesamo', 'sulfitos', 'altramuces', 'moluscos'];

const RE_ID = /^[a-z0-9]{1,24}$/i;
const RE_FOTO = /^[a-f0-9]{32}\.(jpg|png|webp|gif|mp4|webm|mov)$/;
const RE_VIDEO = /\.(mp4|webm|mov)$/;
const RE_HORA = /^([01]\d|2[0-3]):[0-5]\d$/;
const RE_PRECIO = /^\d{1,3}([.,]\d{1,2})?$/;
const RE_FECHA = /^\d{4}-\d{2}-\d{2}$/;

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/mp4',      // QuickTime con H.264: así también lo reproduce Chrome
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json'
};

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self'",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'"
].join('; ');

/* ---------- Estado en memoria ---------- */
let contenido = null;
let reservas = [];
let mensajes = [];
let pedidos = [];
const sesiones = new Map();        // token -> caducidad (ms)
const intentosLogin = new Map();   // ip -> { fallos, bloqueadoHasta }
const envios = new Map();          // 'tipo:ip' -> [marcas de tiempo]
let socios = [];                   // socios del club
let secretoClub = null;            // firma las sesiones de los socios (se guarda en la carpeta de datos)
const intentosSocio = new Map();   // ip -> { fallos, bloqueadoHasta }
let versiones = [];                // historial de lo que se guarda desde el panel
let resenas = [];                  // reseñas de los clientes
let wallet = null;                 // la tarjeta del club en Apple Wallet y Google Wallet (wallet.js)

/* ---------- Utilidades ---------- */
function normalizarUsuario(u) {
  return String(u || '').normalize('NFC').trim().toLowerCase();
}

function texto(v, max) {
  return typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '';
}

function textoLargo(v, max) {
  return typeof v === 'string' ? v.replace(/\r\n/g, '\n').trim().slice(0, max) : '';
}

function errorCliente(mensaje, estado) {
  const e = new Error(mensaje);
  e.status = estado || 400;
  e.publico = true;
  return e;
}

function hoyISO(desplazamientoDias) {
  const d = new Date();
  d.setDate(d.getDate() + (desplazamientoDias || 0));
  const dd = (n) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + dd(d.getMonth() + 1) + '-' + dd(d.getDate());
}

function ipCliente(req) {
  if (CONFIAR_PROXY) {
    /* La última IP la añade el propio proxy; las anteriores las puede inventar el cliente */
    const xff = req.headers['x-forwarded-for'];
    if (typeof xff === 'string' && xff.trim()) {
      const ips = xff.split(',').map((s) => s.trim()).filter(Boolean);
      if (ips.length) return ips[ips.length - 1];
    }
  }
  return req.socket.remoteAddress || 'desconocida';
}

function esHttps(req) {
  if (req.socket.encrypted) return true;
  return CONFIAR_PROXY && String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() === 'https';
}

function leerCookies(req) {
  const salida = {};
  String(req.headers.cookie || '').split(';').forEach((par) => {
    const i = par.indexOf('=');
    if (i > 0) salida[par.slice(0, i).trim()] = decodeURIComponent(par.slice(i + 1).trim());
  });
  return salida;
}

function igualSeguro(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

/* Límite sencillo de envíos por IP y ventana de tiempo */
function permitirEnvio(tipo, ip, maximo, ventanaMs) {
  const clave = tipo + ':' + ip;
  const ahora = Date.now();
  const lista = (envios.get(clave) || []).filter((t) => ahora - t < ventanaMs);
  if (lista.length >= maximo) {
    envios.set(clave, lista);
    return false;
  }
  lista.push(ahora);
  envios.set(clave, lista);
  return true;
}

/* ---------- Almacenamiento en disco ---------- */
let colaEscritura = Promise.resolve();

function guardarArchivo(nombre, datos) {
  const tarea = colaEscritura.then(async () => {
    const destino = path.join(DIR_DATOS, nombre);
    const temporal = destino + '.' + process.pid + '.tmp';
    await fsp.writeFile(temporal, JSON.stringify(datos, null, 2));
    await fsp.rename(temporal, destino);
  });
  colaEscritura = tarea.catch(() => {});
  return tarea;
}

async function leerArchivo(nombre, porDefecto) {
  try {
    return JSON.parse(await fsp.readFile(path.join(DIR_DATOS, nombre), 'utf8'));
  } catch (e) {
    if (e.code === 'ENOENT') return porDefecto;
    throw e;
  }
}

async function iniciarDatos() {
  await fsp.mkdir(DIR_FOTOS, { recursive: true });
  await fsp.mkdir(DIR_CV, { recursive: true });
  contenido = await leerArchivo('contenido.json', null);
  if (!contenido) {
    const inicial = JSON.parse(await fsp.readFile(ARCHIVO_INICIAL, 'utf8'));
    contenido = {
      carta: validarCarta(inicial.carta),
      galeria: validarGaleria(inicial.galeria),
      horario: validarHorario(inicial.horario),
      datos: validarDatos(inicial.datos)
    };
    await guardarArchivo('contenido.json', contenido);
    console.log('[soño] Contenido inicial creado en', DIR_DATOS);
  }
  await completarContenido();
  reservas = await leerArchivo('reservas.json', []);
  mensajes = await leerArchivo('mensajes.json', []);
  await limpiarCvSueltos();
  pedidos = await leerArchivo('pedidos.json', []);
  socios = await leerArchivo('socios.json', []);
  resenas = await leerArchivo('resenas.json', []);
  versiones = await leerArchivo('versiones.json', []);
  if (!versiones.length) {
    // Punto de partida: cómo estaba la web cuando se activó el historial
    ['datos', 'horario', 'galeria', 'carta'].forEach((s) => registrarVersion(s, contenido[s], ['Cómo estaba la web al empezar a guardar versiones']));
    await guardarArchivo('versiones.json', versiones);
  }
  const secreto = await leerArchivo('secreto.json', null);
  if (secreto && /^[a-f0-9]{64}$/.test(secreto.clave || '')) {
    secretoClub = Buffer.from(secreto.clave, 'hex');
  } else {
    secretoClub = crypto.randomBytes(32);
    await guardarArchivo('secreto.json', { clave: secretoClub.toString('hex') });
  }
  await limpiarAntiguos();
  wallet = crearWallet({
    dirDatos: DIR_DATOS,
    socios: () => socios,
    guardarSocios: () => guardarArchivo('socios.json', socios),
    ajustesClub,
    secreto: secretoClub,
    urlPublica: process.env.WALLET_URL || '',
    confiarProxy: CONFIAR_PROXY,
    esHttps
  });
}

/* Borra lo que ya no hace falta, tal y como dice la política de privacidad:
   pedidos de hace más de 30 días, reservas de hace más de 90 y mensajes y candidaturas
   (con su currículum) de hace más de un año.
   Se hace al arrancar y cada 6 horas. */
async function limpiarAntiguos() {
  const limitePedidos = new Date(Date.now() - 30 * 86400000).toISOString();
  const nPedidos = pedidos.length;
  pedidos = pedidos.filter((p) => p.creado >= limitePedidos);
  if (pedidos.length !== nPedidos) await guardarArchivo('pedidos.json', pedidos);
  const limiteReservas = hoyISO(-90);
  const nReservas = reservas.length;
  reservas = reservas.filter((r) => r.fecha >= limiteReservas);
  if (reservas.length !== nReservas) await guardarArchivo('reservas.json', reservas);
  const limiteMensajes = new Date(Date.now() - 365 * 86400000).toISOString();
  const viejos = mensajes.filter((m) => m.creado < limiteMensajes);
  if (viejos.length) {
    mensajes = mensajes.filter((m) => m.creado >= limiteMensajes);
    await guardarArchivo('mensajes.json', mensajes);
    viejos.forEach(borrarCv);
  }
}

/* Completa contenido guardado con versiones anteriores de la web:
 * alérgenos de los productos de ejemplo (solo si el producto no se ha renombrado)
 * y los ajustes de pedidos para llevar. */
async function completarContenido() {
  const inicial = JSON.parse(await fsp.readFile(ARCHIVO_INICIAL, 'utf8'));
  const porId = new Map(inicial.carta.productos.map((p) => [p.id, p]));
  let cambiado = false;
  contenido.carta.productos.forEach((p) => {
    if (!Array.isArray(p.alergenos)) {
      const original = porId.get(p.id);
      p.alergenos = original && original.nombre === p.nombre && Array.isArray(original.alergenos) ? original.alergenos.slice() : [];
      cambiado = true;
    }
  });
  if (!Array.isArray(contenido.carta.categorias)) {
    // Versiones anteriores tenían los tres grupos fijos en el código
    contenido.carta.categorias = inicial.carta.categorias.map((g) => Object.assign({}, g));
    cambiado = true;
  }
  if (contenido.datos.paraLlevar === undefined) { contenido.datos.paraLlevar = true; cambiado = true; }
  if (!Array.isArray(contenido.datos.zonas)) { contenido.datos.zonas = ZONAS_INICIALES.map((z) => Object.assign({}, z)); cambiado = true; }
  if (contenido.datos.domicilio === undefined) { contenido.datos.domicilio = true; cambiado = true; }
  if (!contenido.datos.club) { contenido.datos.club = Object.assign({}, CLUB_INICIAL); cambiado = true; }
  if (!contenido.datos.resenas) { contenido.datos.resenas = Object.assign({}, RESENAS_INICIAL); cambiado = true; }
  if (!contenido.datos.legal) { contenido.datos.legal = Object.assign({}, LEGAL_VACIO); cambiado = true; }
  if (!contenido.datos.legal.actualizado) { contenido.datos.legal.actualizado = hoyISO(0); cambiado = true; }
  if (!contenido.textos || !Array.isArray(contenido.textos.menu)) { contenido.textos = textosWeb.textosIniciales(); cambiado = true; }
  if (!contenido.datos.asistente) { contenido.datos.asistente = Object.assign({}, ASISTENTE_INICIAL); cambiado = true; }
  if (!contenido.datos.empleo) { contenido.datos.empleo = Object.assign({}, EMPLEO_INICIAL); cambiado = true; }
  if (!contenido.datos.mes) { contenido.datos.mes = Object.assign({}, MES_INICIAL); cambiado = true; }
  if (!contenido.mes || !Array.isArray(contenido.mes.items)) { contenido.mes = mesInicial(contenido.carta); cambiado = true; }
  // Secciones nuevas del menú (por ejemplo «Del mes»): entran en su sitio en un menú ya guardado
  const menuCompleto = textosWeb.completarMenu(contenido.textos.menu);
  if (JSON.stringify(menuCompleto) !== JSON.stringify(contenido.textos.menu)) { contenido.textos = Object.assign({}, contenido.textos, { menu: menuCompleto }); cambiado = true; }
  if (cambiado) await guardarArchivo('contenido.json', contenido);
}

/* ---------- Validación del contenido editable ---------- */
function validarFoto(v, admiteVideo) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v !== 'string' || !RE_FOTO.test(v)) throw errorCliente('Hay una foto con un identificador no válido.');
  if (!admiteVideo && RE_VIDEO.test(v)) throw errorCliente('En la galería solo van fotos (los vídeos, en los productos de la carta).');
  if (!fs.existsSync(path.join(DIR_FOTOS, v))) throw errorCliente('Una de las fotos ya no existe. Vuelve a subirla.');
  return v;
}

function normPrecio(v) {
  const t = String(v).trim().replace('.', ',');
  const partes = t.split(',');
  return partes[0] + ',' + ((partes[1] || '') + '00').slice(0, 2);
}

function validarCarta(c) {
  const lista = c && Array.isArray(c.productos) ? c.productos : null;
  const grupos = c && Array.isArray(c.categorias) ? c.categorias : null;
  if (!lista || !grupos) throw errorCliente('La carta no tiene el formato esperado.');
  if (grupos.length > MAX_GRUPOS) throw errorCliente('Hay demasiados grupos en la carta (máximo ' + MAX_GRUPOS + ').');
  if (lista.length > 150) throw errorCliente('Hay demasiados productos en la carta (máximo 150).');
  const iconoDe = new Map();
  const categorias = grupos.map((g) => {
    if (!g || typeof g !== 'object') throw errorCliente('Hay un grupo con un formato no válido.');
    const id = String(g.id || '');
    if (!RE_ID.test(id) || iconoDe.has(id)) throw errorCliente('Hay un grupo con un identificador repetido o no válido.');
    const nombre = texto(g.nombre, 40);
    if (!nombre) throw errorCliente('Hay un grupo de la carta sin nombre.');
    const icono = ICONOS.includes(g.icono) ? g.icono : 'taza';
    iconoDe.set(id, icono);
    return { id, nombre, desc: texto(g.desc, 120), icono };
  });
  const vistos = new Set();
  return {
    categorias,
    productos: lista.map((p) => {
      if (!p || typeof p !== 'object') throw errorCliente('Hay un producto con un formato no válido.');
      const id = String(p.id || '');
      if (!RE_ID.test(id) || vistos.has(id)) throw errorCliente('Hay un producto con un identificador repetido o no válido.');
      vistos.add(id);
      const cat = iconoDe.has(p.cat) ? p.cat : null;
      if (!cat) throw errorCliente('Hay un producto en un grupo que ya no existe.');
      const nombre = texto(p.nombre, 80);
      if (!nombre) throw errorCliente('Hay un producto sin nombre.');
      const precioTexto = texto(p.precio, 10);
      if (!RE_PRECIO.test(precioTexto)) throw errorCliente('Revisa el precio de «' + nombre + '»: escribe solo el número, por ejemplo 2,50.');
      const etiquetas = (Array.isArray(p.etiquetas) ? p.etiquetas : [])
        .map((t) => texto(t, 30)).filter(Boolean).slice(0, 6);
      return {
        id,
        cat,
        nombre,
        precio: normPrecio(precioTexto),
        desc: textoLargo(p.desc, 400),
        icono: ICONOS.includes(p.icono) ? p.icono : iconoDe.get(cat),
        etiquetas,
        alergenos: ALERGENOS.filter((a) => Array.isArray(p.alergenos) && p.alergenos.includes(a)),
        foto: validarFoto(p.foto, true)
      };
    })
  };
}

function validarGaleria(g) {
  const lista = g && Array.isArray(g.fotos) ? g.fotos : null;
  if (!lista || !lista.length) throw errorCliente('La galería no tiene el formato esperado.');
  if (lista.length > 12) throw errorCliente('La galería admite como mucho 12 fotos.');
  return {
    fotos: lista.map((f, i) => {
      const id = RE_ID.test(String((f && f.id) || '')) ? String(f.id) : 'g' + (i + 1);
      return { id, pie: texto(f && f.pie, 60), foto: validarFoto(f && f.foto) };
    })
  };
}

function validarHoras(lista, nombre) {
  const horas = (Array.isArray(lista) ? lista : []).map((h) => String(h).trim()).filter(Boolean);
  for (const h of horas) {
    if (!RE_HORA.test(h)) throw errorCliente('La hora «' + h + '» de la ' + nombre + ' no es válida. Escríbela así: 09:30.');
  }
  return Array.from(new Set(horas)).sort().slice(0, 24);
}

function validarHorario(h) {
  if (!h || typeof h !== 'object') throw errorCliente('El horario no tiene el formato esperado.');
  const porDia = {};
  (Array.isArray(h.dias) ? h.dias : []).forEach((d) => {
    if (d && DIAS_SEMANA.includes(d.dia)) porDia[d.dia] = texto(d.texto, 40);
  });
  return {
    dias: DIAS_SEMANA.map((dia) => ({ dia, texto: porDia[dia] || '' })),
    manana: validarHoras(h.manana, 'mañana'),
    tarde: validarHoras(h.tarde, 'tarde')
  };
}

function validarDatos(d) {
  if (!d || typeof d !== 'object') throw errorCliente('Los datos de contacto no tienen el formato esperado.');
  const email = texto(d.email, 120);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw errorCliente('Revisa el email de contacto.');
  const instagram = texto(d.instagram, 40).replace(/^@/, '');
  if (instagram && !/^[A-Za-z0-9._]{1,30}$/.test(instagram)) throw errorCliente('El usuario de Instagram solo puede tener letras, números, puntos y guiones bajos.');
  const whatsapp = texto(d.whatsapp, 25);
  if (whatsapp && whatsapp.replace(/[^\d]/g, '').length < 9) throw errorCliente('Revisa el WhatsApp: escribe el número de teléfono, con al menos 9 cifras.');
  const vistas = new Set();
  const zonas = (Array.isArray(d.zonas) ? d.zonas : ZONAS_INICIALES).slice(0, MAX_ZONAS).map((z) => {
    if (!z || typeof z !== 'object') throw errorCliente('Hay una zona con un formato no válido.');
    const id = String(z.id || '');
    if (!RE_ID.test(id) || vistas.has(id)) throw errorCliente('Hay una zona con un identificador repetido o no válido.');
    vistas.add(id);
    const nombre = texto(z.nombre, 30);
    if (!nombre) throw errorCliente('Hay una zona del local sin nombre.');
    return { id, nombre, tipo: TIPOS_ZONA.includes(z.tipo) ? z.tipo : 'mesas', activa: z.activa !== false };
  });
  return {
    direccion: texto(d.direccion, 160),
    email,
    telefono: texto(d.telefono, 30),
    instagram,
    whatsapp,
    abrimosPronto: d.abrimosPronto !== false,
    paraLlevar: d.paraLlevar !== false,
    domicilio: d.domicilio !== false,
    zonas,
    club: validarClub(d.club),
    resenas: { activo: !(d.resenas && d.resenas.activo === false) },
    cartaAparte: d.cartaAparte === true,
    empleo: { activo: !(d.empleo && d.empleo.activo === false) },
    mes: { activo: !(d.mes && d.mes.activo === false) },
    asistente: {
      activo: !(d.asistente && d.asistente.activo === false),
      nombre: texto(d.asistente && d.asistente.nombre, 20) || ASISTENTE_INICIAL.nombre
    },
    legal: validarLegal(d.legal)
  };
}

const ASISTENTE_INICIAL = { activo: true, nombre: 'Soñito' };

function validarLegal(l) {
  const v = l && typeof l === 'object' ? l : {};
  const nif = texto(v.nif, 20).toUpperCase().replace(/[\s.-]/g, '');
  if (nif && !RE_NIF.test(nif)) throw errorCliente('Revisa el NIF o CIF: por ejemplo 12345678Z o B12345678.');
  const email = texto(v.email, 120);
  if (email && !RE_EMAIL.test(email)) throw errorCliente('Revisa el email para temas de privacidad.');
  return {
    titular: texto(v.titular, 120),
    nif,
    domicilio: texto(v.domicilio, 200),
    email,
    registro: texto(v.registro, 200),
    actualizado: RE_FECHA.test(String(v.actualizado || '')) ? v.actualizado : ''
  };
}

/* Al guardar Ajustes o volver a una versión: el club, las reseñas, la carta aparte,
   «Trabaja con nosotros» y «Lo mejor del mes» no se encienden ni se apagan
   (eso se hace en sus pestañas) y la fecha de los textos legales se pone sola si cambian sus datos */
function prepararDatos(limpio, antes) {
  limpio.club.activo = ajustesClub().activo !== false;
  limpio.resenas.activo = ajustesResenas().activo !== false;
  limpio.cartaAparte = contenido.datos.cartaAparte === true;
  limpio.empleo.activo = ajustesEmpleo().activo !== false;
  limpio.mes.activo = ajustesMes().activo !== false;
  const sinFecha = (l) => JSON.stringify(Object.assign({}, LEGAL_VACIO, l || {}, { actualizado: '' }));
  const previo = (antes && antes.legal) || {};
  limpio.legal.actualizado = sinFecha(previo) !== sinFecha(limpio.legal) ? hoyISO(0) : (previo.actualizado || hoyISO(0));
}

function validarClub(c) {
  const v = c && typeof c === 'object' ? c : CLUB_INICIAL;
  const sellos = Number(v.sellos);
  if (!Number.isInteger(sellos) || sellos < 3 || sellos > 20) throw errorCliente('Los sellos para conseguir el premio van de 3 a 20.');
  return { activo: v.activo !== false, sellos, premio: texto(v.premio, 60) || CLUB_INICIAL.premio };
}

/* ---------- Lo mejor del mes ----------
   Hasta 3 destacados. Cada uno es un producto de la carta (con su nombre, precio, foto y alérgenos)
   o algo escrito a mano. La etiqueta («Café del mes», «Dulce del mes»…) y el texto son libres. */
function ajustesMes() { return contenido.datos.mes || MES_INICIAL; }

function mesInicial(carta) {
  const lista = (carta && Array.isArray(carta.productos)) ? carta.productos : [];
  const v60 = lista.find((p) => p.id === 'p11' && /origen/i.test(p.nombre));
  const cafe = v60 || lista.find((p) => ['taza', 'vaso', 'vaso-alto', 'filtro', 'prensa', 'chemex', 'coldbrew'].includes(p.icono)) || lista[0];
  return {
    items: [{
      id: 'm1',
      etiqueta: 'Café del mes',
      producto: cafe ? cafe.id : null,
      nombre: cafe ? '' : 'Café del mes',
      precio: '',
      icono: 'taza',
      desc: v60
        ? 'Cada mes traemos un café de origen distinto y lo preparamos en V60, para que se noten todos sus matices. Pregúntanos de dónde viene el de este mes.'
        : 'Nuestra recomendación de este mes. Pregúntanos por él en la barra.',
      foto: null
    }]
  };
}

function validarMes(m) {
  const lista = m && Array.isArray(m.items) ? m.items : null;
  if (!lista) throw errorCliente('«Lo mejor del mes» no tiene el formato esperado.');
  if (lista.length > MAX_MES) throw errorCliente('En «Lo mejor del mes» caben como mucho ' + MAX_MES + ' destacados.');
  const vistos = new Set();
  return {
    items: lista.map((x, i) => {
      if (!x || typeof x !== 'object') throw errorCliente('Hay un destacado del mes con un formato no válido.');
      let id = String(x.id || '');
      if (!RE_ID.test(id) || vistos.has(id)) id = 'm' + crypto.randomBytes(4).toString('hex');
      vistos.add(id);
      const producto = x.producto ? String(x.producto) : null;
      if (producto && !contenido.carta.productos.some((p) => p.id === producto)) {
        throw errorCliente('El destacado ' + (i + 1) + ' es un producto que ya no está en la carta. Elige otro o escríbelo a mano.');
      }
      const nombre = producto ? '' : texto(x.nombre, 80);
      if (!producto && !nombre) throw errorCliente('El destacado ' + (i + 1) + ' no tiene nombre: elige un producto de la carta o escribe cuál es.');
      const precio = producto ? '' : texto(x.precio, 10);
      if (precio && !RE_PRECIO.test(precio)) throw errorCliente('Revisa el precio de «' + nombre + '»: escribe solo el número, por ejemplo 2,50.');
      return {
        id,
        etiqueta: texto(x.etiqueta, 40) || 'Del mes',
        producto,
        nombre,
        precio: precio ? normPrecio(precio) : '',
        icono: ICONOS.includes(x.icono) ? x.icono : 'taza',
        desc: textoLargo(x.desc, 320).replace(/\n{3,}/g, '\n\n'),
        foto: validarFoto(x.foto, true)
      };
    })
  };
}

/* Destacados que se pueden enseñar (un producto borrado de la carta y sin nombre no sale) */
function mesVisible() {
  if (!contenido || ajustesMes().activo === false || !contenido.mes) return false;
  return (contenido.mes.items || []).some((x) => x.nombre || (x.producto && contenido.carta.productos.some((p) => p.id === x.producto)));
}

const VALIDADORES = {
  carta: validarCarta, galeria: validarGaleria, horario: validarHorario, datos: validarDatos,
  textos: (v) => textosWeb.validarTextos(v, textosBase()),
  mes: validarMes
};

/* ---------- Respuestas ---------- */
function cabecerasSeguridad(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Permissions-Policy', 'camera=(self), microphone=(), geolocation=(), interest-cohort=()');   // la cámara, para leer el QR de los socios en el panel
  res.setHeader('Content-Security-Policy', CSP);
}

function enviarJSON(res, estado, datos) {
  const cuerpo = JSON.stringify(datos);
  res.writeHead(estado, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(cuerpo),
    'Cache-Control': 'no-store'
  });
  res.end(cuerpo);
}

function enviarTexto(res, estado, t) {
  res.writeHead(estado, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(t);
}

/* Lee el cuerpo de la petición sin pasar del límite */
function leerCuerpo(req, limite) {
  return new Promise((resolve, reject) => {
    const declarado = Number(req.headers['content-length'] || 0);
    if (declarado > limite) {
      req.resume();
      reject(errorCliente('El archivo es demasiado grande.', 413));
      return;
    }
    const trozos = [];
    let total = 0;
    let excedido = false;
    req.on('data', (c) => {
      if (excedido) return;
      total += c.length;
      if (total > limite) { excedido = true; trozos.length = 0; return; }
      trozos.push(c);
    });
    req.on('end', () => {
      if (excedido) reject(errorCliente('El archivo es demasiado grande.', 413));
      else resolve(Buffer.concat(trozos));
    });
    req.on('error', reject);
  });
}

async function leerJSON(req, limite) {
  const tipo = String(req.headers['content-type'] || '');
  if (!tipo.startsWith('application/json')) throw errorCliente('Formato de petición no válido.', 415);
  const cuerpo = await leerCuerpo(req, limite || MAX_JSON);
  try {
    const datos = JSON.parse(cuerpo.toString('utf8') || '{}');
    if (!datos || typeof datos !== 'object' || Array.isArray(datos)) throw new Error('no es un objeto');
    return datos;
  } catch (e) {
    throw errorCliente('Los datos enviados no son válidos.');
  }
}

/* Las peticiones que cambian algo deben venir de la propia web */
function mismoOrigen(req) {
  const origen = req.headers.origin;
  if (!origen) return req.headers['x-requested-with'] === 'sono';
  try {
    const host = (CONFIAR_PROXY && req.headers['x-forwarded-host']) || req.headers.host;
    return new URL(origen).host === String(host).split(',')[0].trim();
  } catch (e) {
    return false;
  }
}

/* ---------- Sesión del panel ---------- */
function sesionValida(req) {
  const token = leerCookies(req).sono2_sesion;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return false;
  const caduca = sesiones.get(token);
  if (!caduca) return false;
  if (caduca < Date.now()) { sesiones.delete(token); return false; }
  return true;
}

function cookieSesion(req, valor, maxAgeSeg) {
  const segura = COOKIE_SEGURA === 'true' || (COOKIE_SEGURA === 'auto' && esHttps(req));
  return 'sono2_sesion=' + valor + '; Path=/; HttpOnly; SameSite=Strict; Max-Age=' + maxAgeSeg + (segura ? '; Secure' : '');
}

function exigirAdmin(req) {
  if (!sesionValida(req)) throw errorCliente('Tu sesión ha caducado. Vuelve a entrar en el panel.', 401);
  if (!mismoOrigen(req)) throw errorCliente('Petición no permitida.', 403);
}

/* ---------- Fotos ---------- */
/* Fotos, GIF y vídeos: el tipo se mira en los primeros bytes, no en el nombre */
function tipoImagen(buf) {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (buf.length > 8 && buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buf.length > 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  if (buf.length > 6 && /^GIF8[79]a$/.test(buf.toString('ascii', 0, 6))) return 'gif';
  if (buf.length > 4 && buf.readUInt32BE(0) === 0x1a45dfa3) return 'webm';
  if (buf.length > 12 && buf.toString('ascii', 4, 8) === 'ftyp') {
    const marca = buf.toString('ascii', 8, 12);
    if (/^(heic|heix|hevc|hevx|mif1|msf1|avif|avis)$/.test(marca)) return 'heic';
    return marca === 'qt  ' ? 'mov' : 'mp4';
  }
  return null;
}
/* Vídeo en HEVC (lo normal en el iPhone): en muchos Android y en Chrome de Windows no se ve */
function esHevc(buf) {
  return buf.indexOf('hvc1', 0, 'ascii') !== -1 || buf.indexOf('hev1', 0, 'ascii') !== -1;
}

/* ---------- Archivos estáticos ---------- */
async function servirArchivo(req, res, ruta, cache) {
  let info;
  try {
    info = await fsp.stat(ruta);
    if (!info.isFile()) throw new Error('no es archivo');
  } catch (e) {
    return false;
  }
  const etag = 'W/"' + info.size.toString(16) + '-' + Math.floor(info.mtimeMs).toString(16) + '"';
  const tipo = TIPOS[path.extname(ruta).toLowerCase()] || 'application/octet-stream';
  res.setHeader('ETag', etag);
  res.setHeader('Cache-Control', cache);
  res.setHeader('Accept-Ranges', 'bytes');
  if (req.headers['if-none-match'] === etag && !req.headers.range) {
    res.writeHead(304);
    res.end();
    return true;
  }
  // Trozos («Range»): los vídeos se piden por partes (Safari no los reproduce sin esto)
  const m = /^bytes=(\d*)-(\d*)$/.exec(String(req.headers.range || '').trim());
  if (m && (m[1] || m[2])) {
    let inicio = m[1] ? Number(m[1]) : Math.max(0, info.size - Number(m[2]));
    let fin = m[1] && m[2] ? Math.min(Number(m[2]), info.size - 1) : info.size - 1;
    if (inicio > fin || inicio >= info.size) {
      res.writeHead(416, { 'Content-Range': 'bytes */' + info.size });
      res.end();
      return true;
    }
    res.writeHead(206, { 'Content-Type': tipo, 'Content-Length': fin - inicio + 1, 'Content-Range': 'bytes ' + inicio + '-' + fin + '/' + info.size });
    if (req.method === 'HEAD') { res.end(); return true; }
    fs.createReadStream(ruta, { start: inicio, end: fin }).pipe(res);
    return true;
  }
  res.writeHead(200, { 'Content-Type': tipo, 'Content-Length': info.size });
  if (req.method === 'HEAD') { res.end(); return true; }
  fs.createReadStream(ruta).pipe(res);
  return true;
}

/* La portada y la página de la carta salen del mismo index.html, ya preparado según el ajuste
   «carta en su propia página», para que no parpadee mientras carga el JavaScript */
let indiceCache = { mtime: 0, html: '', base: {} };
async function leerIndice() {
  const ruta = path.join(DIR_PUBLICO, 'index.html');
  const info = await fsp.stat(ruta);
  if (info.mtimeMs !== indiceCache.mtime) {
    const html = await fsp.readFile(ruta, 'utf8');
    indiceCache = { mtime: info.mtimeMs, html, base: textosWeb.textosOriginales(html) };
  }
  return indiceCache.html;
}
/* Textos originales de la web (los del index.html): se leen al arrancar */
function textosBase() {
  if (!indiceCache.mtime) {
    const html = fs.readFileSync(path.join(DIR_PUBLICO, 'index.html'), 'utf8');
    indiceCache = { mtime: fs.statSync(path.join(DIR_PUBLICO, 'index.html')).mtimeMs, html, base: textosWeb.textosOriginales(html) };
  }
  return indiceCache.base;
}
async function servirIndice(req, res, enCarta) {
  let html = await leerIndice();
  html = textosWeb.aplicarAlHtml(html, contenido && contenido.textos, indiceCache.base, contenido && contenido.datos);
  // «Lo mejor del mes» y «Trabaja con nosotros» salen ya bien desde el servidor (así no aparecen ni desaparecen al cargar)
  if (mesVisible()) html = html.replace(/ data-mes hidden/g, ' data-mes');
  if (contenido && ajustesEmpleo().activo === false) html = html.replace(/ data-empleo(?=[ >])/g, ' data-empleo hidden');
  const aparte = !!(contenido && contenido.datos && contenido.datos.cartaAparte);
  if (enCarta) {
    html = html.replace('<html lang="es">', '<html lang="es" class="modo-carta">')
      .replace('<title>SOÑO</title>', '<title>Carta · SOÑO</title>');
  } else if (aparte) {
    html = html.replace('<html lang="es">', '<html lang="es" class="carta-aparte">')
      .replace(/href="#carta" data-enlace-carta/g, 'href="/carta" data-enlace-carta');
  }
  const cuerpo = Buffer.from(html, 'utf8');
  const etag = 'W/"' + crypto.createHash('sha1').update(cuerpo).digest('hex').slice(0, 20) + '"';
  res.setHeader('ETag', etag);
  res.setHeader('Cache-Control', 'no-cache');
  if (req.headers['if-none-match'] === etag) { res.writeHead(304); return res.end(); }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Length': cuerpo.length });
  res.end(req.method === 'HEAD' ? undefined : cuerpo);
}

async function servirPublico(req, res, pathname) {
  let relativa;
  try { relativa = decodeURIComponent(pathname); } catch (e) { return false; }
  if (relativa === '/' || relativa === '') relativa = '/index.html';
  const ruta = path.normalize(path.join(DIR_PUBLICO, relativa));
  if (!ruta.startsWith(DIR_PUBLICO + path.sep)) return false;
  const ext = path.extname(ruta).toLowerCase();
  const cache = ext === '.woff2' ? 'public, max-age=31536000, immutable' : 'no-cache';
  return servirArchivo(req, res, ruta, cache);
}

/* ---------- Trabaja con nosotros ----------
   Las candidaturas llegan a «Mensajes» del panel con su currículum. El archivo se guarda
   en la carpeta cv/ de los datos y solo se puede abrir con la sesión del panel. */
function ajustesEmpleo() { return contenido.datos.empleo || EMPLEO_INICIAL; }

/* Tipo del currículum mirando los primeros bytes (no el nombre del archivo) */
function tipoCv(buf) {
  if (buf.length > 5 && buf.toString('latin1', 0, 5) === '%PDF-') return 'pdf';
  if (buf.length > 8 && buf.readUInt32BE(0) === 0xd0cf11e0 && buf.readUInt32BE(4) === 0xa1b11ae1) return 'doc';
  if (buf.length > 30 && buf.readUInt32BE(0) === 0x504b0304) {
    // Word (.docx) y OpenDocument (.odt) son ZIP: se reconocen por lo que llevan dentro
    if (buf.indexOf('word/', 0, 'latin1') !== -1) return 'docx';
    if (buf.indexOf('application/vnd.oasis.opendocument.text', 0, 'latin1') !== -1) return 'odt';
    return null;
  }
  const img = tipoImagen(buf);
  if (img === 'jpg' || img === 'png' || img === 'webp' || img === 'heic') return img;
  return null;
}

function borrarCv(m) {
  if (m && m.cv && RE_CV.test(String(m.cv.archivo || ''))) {
    fsp.unlink(path.join(DIR_CV, m.cv.archivo)).catch(() => {});
  }
}

/* Currículums que ya no son de ningún mensaje (por ejemplo, si se cortó la luz al guardar) */
async function limpiarCvSueltos() {
  let nombres = [];
  try { nombres = await fsp.readdir(DIR_CV); } catch (e) { return; }
  const usados = new Set(mensajes.filter((m) => m.cv).map((m) => m.cv.archivo));
  await Promise.all(nombres.filter((n) => !usados.has(n)).map((n) => fsp.unlink(path.join(DIR_CV, n)).catch(() => {})));
}

/* Como mucho MAX_MENSAJES: los más antiguos salen (con su currículum) */
function recortarMensajes() {
  if (mensajes.length <= MAX_MENSAJES) return;
  mensajes.slice(MAX_MENSAJES).forEach(borrarCv);
  mensajes = mensajes.slice(0, MAX_MENSAJES);
}

/* ---------- Club SOÑO ---------- */
function scrypt(clave, sal) {
  return new Promise((ok, mal) => crypto.scrypt(String(clave), sal, 64, (e, k) => (e ? mal(e) : ok(k))));
}
async function cifrarClave(clave) {
  const sal = crypto.randomBytes(16);
  return sal.toString('hex') + ':' + (await scrypt(clave, sal)).toString('hex');
}
async function claveCorrecta(clave, guardada) {
  const partes = String(guardada || '').split(':');
  const sal = Buffer.from(partes[0] || '00', 'hex');
  const ref = Buffer.from(partes[1] || '', 'hex');
  const k = await scrypt(clave, sal);   // se calcula siempre, también si el socio no existe
  return ref.length === k.length && crypto.timingSafeEqual(ref, k);
}

function nuevoCodigo() {
  let codigo;
  do {
    codigo = Array.from(crypto.randomBytes(8), (b) => ALFABETO_CODIGO[b % 32]).join('');
  } while (socios.some((s) => s.codigo === codigo));
  return codigo;
}
/* Acepta lo que lee el escáner («SONO:ABCD2345») o lo que se escribe a mano («abcd-2345») */
function limpiarCodigo(v) {
  let s = String(v || '').toUpperCase();
  if (s.indexOf(':') !== -1) s = s.slice(s.lastIndexOf(':') + 1);
  return s.replace(/[^A-Z0-9]/g, '').slice(0, 16);
}

function ajustesClub() { return contenido.datos.club || CLUB_INICIAL; }

/* Botones de Wallet que puede ver el socio (Google necesita que la web vaya por https) */
function walletDisponible(req) {
  const d = wallet.disponible();
  return { apple: d.apple, google: d.google && /^https:\/\//.test(wallet.baseDe(req)) };
}
function avisarCambioClub(antes, despues) {
  const a = (antes && antes.club) || {};
  const b = despues.club || {};
  if (a.sellos !== b.sellos || a.premio !== b.premio) wallet.cambioClub();
}

function anotar(socio, tipo, n, por) {
  socio.historial.unshift({ t: new Date().toISOString(), tipo, n, por: por || '' });
  if (socio.historial.length > MAX_HISTORIAL) socio.historial.length = MAX_HISTORIAL;
}

/* Lo que ve el socio en su tarjeta */
function tarjeta(s) {
  const club = ajustesClub();
  return {
    nombre: s.nombre,
    codigo: s.codigo,
    sellos: s.sellos,
    necesarios: club.sellos,
    premio: club.premio,
    total: s.total,
    canjes: s.canjes,
    desde: s.creado,
    historial: s.historial.slice(0, 8)
  };
}
/* Lo que ve el personal en el panel */
function fichaSocio(s, conHistorial) {
  const ficha = {
    id: s.id,
    codigo: s.codigo,
    nombre: s.nombre,
    email: s.email,
    telefono: s.telefono,
    sellos: s.sellos,
    total: s.total,
    canjes: s.canjes,
    creado: s.creado,
    ultimo: (s.historial[0] && s.historial[0].t) || s.creado
  };
  if (conHistorial) ficha.historial = s.historial.slice(0, 15);
  return ficha;
}

/* Sesión del socio: cookie firmada (sobrevive a los reinicios del servidor) */
function firmar(txt) { return crypto.createHmac('sha256', secretoClub).update(txt).digest('base64url'); }
function cookieSocio(req, valor, maxAgeSeg) {
  const segura = COOKIE_SEGURA === 'true' || (COOKIE_SEGURA === 'auto' && esHttps(req));
  return 'sono2_socio=' + valor + '; Path=/; HttpOnly; SameSite=Strict; Max-Age=' + maxAgeSeg + (segura ? '; Secure' : '');
}
function abrirSesionSocio(req, res, socio) {
  const cuerpo = socio.id + '.' + socio.version + '.' + (Date.now() + DIAS_SESION_SOCIO * 86400000);
  res.setHeader('Set-Cookie', cookieSocio(req, cuerpo + '.' + firmar(cuerpo), DIAS_SESION_SOCIO * 86400));
}
function socioDeSesion(req) {
  const valor = leerCookies(req).sono2_socio;
  if (!valor) return null;
  const partes = valor.split('.');
  if (partes.length !== 4) return null;
  const cuerpo = partes.slice(0, 3).join('.');
  const firma = Buffer.from(partes[3]);
  const buena = Buffer.from(firmar(cuerpo));
  if (firma.length !== buena.length || !crypto.timingSafeEqual(firma, buena)) return null;
  if (Number(partes[2]) < Date.now()) return null;
  const socio = socios.find((s) => s.id === partes[0]);
  return socio && String(socio.version) === partes[1] ? socio : null;
}

function bloqueoSocio(ip) {
  const estado = intentosSocio.get(ip) || { fallos: 0, bloqueadoHasta: 0 };
  if (estado.bloqueadoHasta > Date.now()) {
    const minutos = Math.ceil((estado.bloqueadoHasta - Date.now()) / 60000);
    throw errorCliente('Demasiados intentos. Prueba otra vez dentro de ' + minutos + ' min.', 429);
  }
  return estado;
}
function falloSocio(ip, estado) {
  estado.fallos += 1;
  if (estado.fallos >= 6) { estado.bloqueadoHasta = Date.now() + 15 * 60000; estado.fallos = 0; }
  intentosSocio.set(ip, estado);
}

async function apiClub(req, res, pathname, metodo, ip) {
  /* --- Socios --- */
  if (pathname === '/api/club/yo' && metodo === 'GET') {
    const socio = ajustesClub().activo ? socioDeSesion(req) : null;
    if (socio) wallet.baseDe(req);   // así se sabe la dirección https de la web para avisar a Google
    return enviarJSON(res, 200, { socio: socio ? tarjeta(socio) : null, wallet: socio ? walletDisponible(req) : null });
  }

  /* Tarjeta para Apple Wallet (.pkpass) y enlace para guardarla en Google Wallet */
  const mWallet = pathname.match(/^\/api\/club\/wallet\/(apple|google)$/);
  if (mWallet && metodo === 'GET') {
    const socio = ajustesClub().activo ? socioDeSesion(req) : null;
    if (!socio) {
      res.writeHead(302, { Location: '/#tarjeta', 'Cache-Control': 'no-store' });
      return res.end();
    }
    if (!permitirEnvio('wallet-descarga', ip, 30, 3600000)) throw errorCliente('Has pedido la tarjeta muchas veces seguidas. Prueba más tarde.', 429);
    const base = wallet.baseDe(req);
    if (mWallet[1] === 'apple') {
      const pass = await wallet.passApple(socio, base);
      res.writeHead(200, {
        'Content-Type': 'application/vnd.apple.pkpass',
        'Content-Disposition': 'attachment; filename="SONO-club.pkpass"',
        'Content-Length': pass.length,
        'Cache-Control': 'no-store'
      });
      return res.end(pass);
    }
    const enlace = await wallet.enlaceGoogle(socio, base);
    res.writeHead(302, { Location: enlace, 'Cache-Control': 'no-store' });
    return res.end();
  }

  if (pathname === '/api/club/alta' && metodo === 'POST') {
    if (!mismoOrigen(req)) throw errorCliente('Petición no permitida.', 403);
    if (!ajustesClub().activo) throw errorCliente('El club está desactivado ahora mismo.', 409);
    const datos = await leerJSON(req);
    if (texto(datos.web, 200)) return enviarJSON(res, 201, { ok: true });   // trampa para bots
    const nombre = texto(datos.nombre, 60);
    if (nombre.length < 2) throw errorCliente('Escribe tu nombre para la tarjeta.');
    const email = texto(datos.email, 120).toLowerCase();
    if (!RE_EMAIL.test(email)) throw errorCliente('Revisa el email: parece que le falta algo.');
    const telefono = texto(datos.telefono, 25);
    if (telefono && telefono.replace(/[^\d]/g, '').length < 9) throw errorCliente('Revisa el teléfono: necesita al menos 9 cifras (o déjalo vacío).');
    const clave = typeof datos.clave === 'string' ? datos.clave : '';
    if (clave.length < 8) throw errorCliente('La contraseña necesita al menos 8 caracteres.');
    if (clave.length > 200) throw errorCliente('La contraseña es demasiado larga.');
    if (datos.acepto !== true) throw errorCliente('Para unirte tienes que aceptar que guardemos tus datos del club.');
    if (socios.some((s) => s.email === email)) throw errorCliente('Ya hay una tarjeta con ese email. Entra con tu contraseña.', 409);
    if (!permitirEnvio('alta', ip, 5, 3600000)) throw errorCliente('Has creado muchas tarjetas seguidas. Prueba más tarde.', 429);
    if (socios.length >= MAX_SOCIOS) throw errorCliente('El club está completo ahora mismo. Pregúntanos en la barra.', 503);
    const socio = {
      id: crypto.randomBytes(8).toString('hex'),
      codigo: nuevoCodigo(),
      nombre,
      email,
      telefono,
      clave: await cifrarClave(clave),
      version: 1,
      creado: new Date().toISOString(),
      sellos: 0,
      total: 0,
      canjes: 0,
      historial: []
    };
    anotar(socio, 'alta', 0, '');
    socios.push(socio);
    await guardarArchivo('socios.json', socios);
    abrirSesionSocio(req, res, socio);
    console.log('[soño] Nuevo socio del club');
    return enviarJSON(res, 201, { socio: tarjeta(socio), wallet: walletDisponible(req) });
  }

  if (pathname === '/api/club/entrar' && metodo === 'POST') {
    if (!mismoOrigen(req)) throw errorCliente('Petición no permitida.', 403);
    if (!ajustesClub().activo) throw errorCliente('El club está desactivado ahora mismo.', 409);
    const estado = bloqueoSocio(ip);
    const datos = await leerJSON(req);
    const email = texto(datos.email, 120).toLowerCase();
    const socio = socios.find((s) => s.email === email);
    const ok = await claveCorrecta(typeof datos.clave === 'string' ? datos.clave : '', socio ? socio.clave : '');
    if (!socio || !ok) {
      falloSocio(ip, estado);
      throw errorCliente('El email o la contraseña no son correctos.', 401);
    }
    intentosSocio.delete(ip);
    abrirSesionSocio(req, res, socio);
    return enviarJSON(res, 200, { socio: tarjeta(socio), wallet: walletDisponible(req) });
  }

  if (pathname === '/api/club/salir' && metodo === 'POST') {
    res.setHeader('Set-Cookie', cookieSocio(req, '', 0));
    return enviarJSON(res, 200, { ok: true });
  }

  if (pathname === '/api/club/baja' && metodo === 'POST') {
    if (!mismoOrigen(req)) throw errorCliente('Petición no permitida.', 403);
    const socio = socioDeSesion(req);
    if (!socio) throw errorCliente('Tu sesión ha caducado. Vuelve a entrar.', 401);
    const estado = bloqueoSocio(ip);
    const datos = await leerJSON(req);
    if (!(await claveCorrecta(typeof datos.clave === 'string' ? datos.clave : '', socio.clave))) {
      falloSocio(ip, estado);
      throw errorCliente('La contraseña no es correcta.', 401);
    }
    socios = socios.filter((s) => s !== socio);
    await guardarArchivo('socios.json', socios);
    wallet.olvidar(socio.id);
    res.setHeader('Set-Cookie', cookieSocio(req, '', 0));
    return enviarJSON(res, 200, { ok: true });
  }

  /* --- Personal (panel) --- */
  if (pathname === '/api/club/activo' && metodo === 'POST') {
    exigirAdmin(req);
    const datos = await leerJSON(req);
    if (typeof datos.activo !== 'boolean') throw errorCliente('Indica si el club queda activo o no.');
    contenido.datos = Object.assign({}, contenido.datos, { club: Object.assign({}, ajustesClub(), { activo: datos.activo }) });
    await guardarArchivo('contenido.json', contenido);
    console.log('[soño] Club ' + (datos.activo ? 'activado' : 'desactivado'));
    return enviarJSON(res, 200, { club: ajustesClub() });
  }

  /* Premio y sellos de la tarjeta (pestaña Club del panel). Queda en el historial de Ajustes */
  if (pathname === '/api/club/ajustes' && metodo === 'POST') {
    exigirAdmin(req);
    const datos = await leerJSON(req);
    const antes = contenido.datos;
    const club = validarClub(Object.assign({}, ajustesClub(), { premio: datos.premio, sellos: datos.sellos }));
    club.activo = ajustesClub().activo !== false;
    const nuevo = Object.assign({}, contenido.datos, { club });
    if (JSON.stringify(antes.club) !== JSON.stringify(club)) {
      contenido.datos = nuevo;
      await guardarArchivo('contenido.json', contenido);
      avisarCambioClub(antes, nuevo);
      if (!versiones.some((x) => x.seccion === 'datos')) registrarVersion('datos', antes, ['Cómo estaba antes del primer cambio']);
      registrarVersion('datos', nuevo, resumenCambios('datos', antes, nuevo));
      await guardarArchivo('versiones.json', versiones);
      console.log('[soño] Club: ' + club.sellos + ' sellos, premio «' + club.premio + '»');
    }
    return enviarJSON(res, 200, { club: ajustesClub() });
  }

  /* Configurar la tarjeta en el móvil (Apple Wallet y Google Wallet) desde el panel */
  if (pathname === '/api/club/wallet/apple/solicitud' && metodo === 'POST') {
    exigirAdmin(req);
    return enviarJSON(res, 200, { solicitud: wallet.solicitudApple(), wallet: wallet.estado() });
  }
  if (pathname === '/api/club/wallet/apple/certificado' && metodo === 'POST') {
    exigirAdmin(req);
    const buf = await leerCuerpo(req, 64 * 1024);
    wallet.baseDe(req);
    const estado = await wallet.subirCertificadoApple(buf);
    console.log('[soño] Wallet: certificado de Apple subido desde el panel');
    return enviarJSON(res, 200, { wallet: estado });
  }
  if (pathname === '/api/club/wallet/google' && metodo === 'POST') {
    exigirAdmin(req);
    const datos = await leerJSON(req);
    wallet.baseDe(req);
    const r = await wallet.guardarGoogle({ issuerId: datos.issuerId, cuenta: datos.cuenta, email: datos.email });
    console.log('[soño] Wallet: datos de Google guardados desde el panel');
    return enviarJSON(res, 200, { wallet: r.estado, comprobacion: r.comprobacion });
  }
  if (pathname === '/api/club/wallet/google/certificado' && metodo === 'POST') {
    exigirAdmin(req);
    return enviarJSON(res, 200, { certificado: wallet.certificadoGoogle(), wallet: wallet.estado() });
  }
  if (pathname === '/api/club/wallet/google/comprobar' && metodo === 'POST') {
    exigirAdmin(req);
    wallet.baseDe(req);
    return enviarJSON(res, 200, { wallet: wallet.estado(), comprobacion: await wallet.comprobarGoogle() });
  }

  if (pathname === '/api/club/socios' && metodo === 'GET') {
    exigirAdmin(req);
    const lista = socios.map((s) => fichaSocio(s, false)).sort((a, b) => b.ultimo.localeCompare(a.ultimo));
    wallet.baseDe(req);
    return enviarJSON(res, 200, { socios: lista, club: ajustesClub(), wallet: wallet.estado() });
  }

  if (pathname === '/api/club/buscar' && metodo === 'POST') {
    exigirAdmin(req);
    const datos = await leerJSON(req);
    const codigo = limpiarCodigo(datos.codigo);
    const socio = codigo ? socios.find((s) => s.codigo === codigo) : null;
    if (!socio) throw errorCliente('No hay ninguna tarjeta con ese código.', 404);
    return enviarJSON(res, 200, { socio: fichaSocio(socio, true), club: ajustesClub() });
  }

  const m = pathname.match(/^\/api\/club\/socios\/([a-f0-9]{16})(?:\/(sellos|canjear|clave))?$/);
  if (m) {
    exigirAdmin(req);
    const socio = socios.find((s) => s.id === m[1]);
    if (!socio) throw errorCliente('Ese socio ya no existe.', 404);
    const accion = m[2];
    if (!accion && metodo === 'GET') return enviarJSON(res, 200, { socio: fichaSocio(socio, true), club: ajustesClub() });
    if (!accion && metodo === 'DELETE') {
      socios = socios.filter((s) => s !== socio);
      await guardarArchivo('socios.json', socios);
      wallet.olvidar(socio.id);
      return enviarJSON(res, 200, { ok: true });
    }
    if (metodo !== 'POST') throw errorCliente('Método no permitido.', 405);
    const datos = await leerJSON(req);
    const por = texto(datos.por, 30);
    if (accion === 'sellos') {
      const cantidad = Number(datos.cantidad);
      if (!Number.isInteger(cantidad) || cantidad === 0 || cantidad < -5 || cantidad > 5) throw errorCliente('Se pueden sumar o quitar de 1 a 5 sellos cada vez.');
      if (cantidad < 0 && socio.sellos === 0) throw errorCliente('Este socio no tiene sellos que quitar.', 409);
      const real = cantidad < 0 ? -Math.min(socio.sellos, -cantidad) : cantidad;
      socio.sellos += real;
      socio.total = Math.max(0, socio.total + real);
      anotar(socio, real > 0 ? 'sello' : 'quitar', Math.abs(real), por);
      wallet.cambioSocio(socio);
    } else if (accion === 'canjear') {
      const necesarios = ajustesClub().sellos;
      if (socio.sellos < necesarios) throw errorCliente('Aún le faltan ' + (necesarios - socio.sellos) + ' sellos para el premio.', 409);
      socio.sellos -= necesarios;
      socio.canjes += 1;
      anotar(socio, 'canje', 1, por);
      wallet.cambioSocio(socio);
    } else if (accion === 'clave') {
      // Contraseña provisional para quien la ha olvidado: se enseña una sola vez y cierra sus sesiones
      const provisional = Array.from(crypto.randomBytes(10), (b) => ALFABETO_CODIGO[b % 32]).join('').toLowerCase();
      socio.clave = await cifrarClave(provisional);
      socio.version += 1;
      await guardarArchivo('socios.json', socios);
      return enviarJSON(res, 200, { clave: provisional });
    }
    await guardarArchivo('socios.json', socios);
    return enviarJSON(res, 200, { socio: fichaSocio(socio, true), club: ajustesClub() });
  }

  return enviarJSON(res, 404, { error: 'No encontrado.' });
}

/* ---------- Reseñas ----------
   Los clientes las escriben desde la web y quedan «por revisar». Solo salen en la web
   cuando el personal las publica desde el panel, que también puede ocultarlas, responderlas
   o borrarlas. Si quien escribe tiene abierta su tarjeta del club, sale como «Socio del club». */
function ajustesResenas() { return contenido.datos.resenas || RESENAS_INICIAL; }

function resenaPublica(r) {
  return { id: r.id, nombre: r.nombre, estrellas: r.estrellas, texto: r.texto, fecha: r.creada, respuesta: r.respuesta || '', socio: !!r.socio };
}

function cuentaResenas() {
  const publicadas = resenas.filter((r) => r.estado === 'publicada');
  const suma = publicadas.reduce((s, r) => s + r.estrellas, 0);
  return {
    total: publicadas.length,
    media: publicadas.length ? Math.round((suma / publicadas.length) * 10) / 10 : 0,
    pendientes: resenas.filter((r) => r.estado === 'pendiente').length
  };
}

async function apiResenas(req, res, pathname, metodo, ip) {
  /* --- Web --- */
  if (pathname === '/api/resenas' && metodo === 'GET') {
    if (!ajustesResenas().activo) return enviarJSON(res, 200, { activo: false, resenas: [], total: 0, media: 0 });
    const c = cuentaResenas();
    const lista = resenas.filter((r) => r.estado === 'publicada')
      .sort((a, b) => b.creada.localeCompare(a.creada))
      .slice(0, 120)
      .map(resenaPublica);
    return enviarJSON(res, 200, { activo: true, resenas: lista, total: c.total, media: c.media });
  }

  if (pathname === '/api/resenas' && metodo === 'POST') {
    if (!mismoOrigen(req)) throw errorCliente('Petición no permitida.', 403);
    if (!ajustesResenas().activo) throw errorCliente('Ahora mismo no se pueden dejar reseñas.', 409);
    const datos = await leerJSON(req);
    if (texto(datos.web, 200)) return enviarJSON(res, 201, { ok: true });   // trampa para bots
    const estrellas = Number(datos.estrellas);
    if (!Number.isInteger(estrellas) || estrellas < 1 || estrellas > 5) throw errorCliente('Elige de 1 a 5 estrellas.');
    const nombre = texto(datos.nombre, 40);
    if (nombre.length < 2) throw errorCliente('Escribe tu nombre: así saldrá en la reseña.');
    const comentario = textoLargo(datos.texto, 600).replace(/\n{3,}/g, '\n\n');
    if (comentario.length < 10) throw errorCliente('Cuéntanos un poco más: al menos 10 caracteres.');
    if (datos.acepto !== true) throw errorCliente('Para publicarla necesitamos que aceptes que salga con tu nombre.');
    if (!permitirEnvio('resena', ip, 3, 3600000)) throw errorCliente('Has enviado varias reseñas seguidas. Prueba más tarde.', 429);
    if (cuentaResenas().pendientes >= MAX_RESENAS_PENDIENTES || resenas.length >= MAX_RESENAS) {
      throw errorCliente('Ahora mismo no podemos recibir más reseñas. Prueba otro día.', 503);
    }
    const socio = ajustesClub().activo ? socioDeSesion(req) : null;
    resenas.unshift({
      id: crypto.randomBytes(8).toString('hex'),
      creada: new Date().toISOString(),
      nombre,
      estrellas,
      texto: comentario,
      estado: 'pendiente',
      respuesta: '',
      socio: !!socio
    });
    await guardarArchivo('resenas.json', resenas);
    console.log('[soño] Nueva reseña por revisar (' + estrellas + ' estrellas)');
    return enviarJSON(res, 201, { ok: true });
  }

  /* --- Personal (panel) --- */
  if (pathname === '/api/resenas/activo' && metodo === 'POST') {
    exigirAdmin(req);
    const datos = await leerJSON(req);
    if (typeof datos.activo !== 'boolean') throw errorCliente('Indica si las reseñas quedan activas o no.');
    contenido.datos = Object.assign({}, contenido.datos, { resenas: Object.assign({}, ajustesResenas(), { activo: datos.activo }) });
    await guardarArchivo('contenido.json', contenido);
    console.log('[soño] Reseñas ' + (datos.activo ? 'activadas' : 'desactivadas'));
    return enviarJSON(res, 200, { resenas: ajustesResenas() });
  }

  if (pathname === '/api/resenas/todas' && metodo === 'GET') {
    exigirAdmin(req);
    return enviarJSON(res, 200, Object.assign({ resenas, activo: ajustesResenas().activo }, cuentaResenas()));
  }

  const m = pathname.match(/^\/api\/resenas\/([a-f0-9]{16})$/);
  if (m) {
    exigirAdmin(req);
    const resena = resenas.find((x) => x.id === m[1]);
    if (!resena) throw errorCliente('Esa reseña ya no existe.', 404);
    if (metodo === 'DELETE') {
      resenas = resenas.filter((x) => x !== resena);
      await guardarArchivo('resenas.json', resenas);
      return enviarJSON(res, 200, Object.assign({ ok: true }, cuentaResenas()));
    }
    if (metodo !== 'POST') throw errorCliente('Método no permitido.', 405);
    const datos = await leerJSON(req);
    if (datos.estado !== undefined) {
      if (datos.estado !== 'publicada' && datos.estado !== 'oculta') throw errorCliente('Ese estado no es válido.');
      resena.estado = datos.estado;
      if (resena.estado === 'publicada' && !resena.publicada) resena.publicada = new Date().toISOString();
    }
    if (datos.respuesta !== undefined) resena.respuesta = textoLargo(datos.respuesta, 600).replace(/\n{3,}/g, '\n\n');
    await guardarArchivo('resenas.json', resenas);
    return enviarJSON(res, 200, Object.assign({ resena }, cuentaResenas()));
  }

  return enviarJSON(res, 404, { error: 'No encontrado.' });
}

/* ---------- Historial de versiones ----------
   Cada vez que se guarda una parte de la web desde el panel (carta, fotos, horarios
   o ajustes) queda una copia con un resumen de lo que cambió. Volver a una versión
   la guarda como versión nueva, así que también se puede deshacer. */
const NOMBRE_SECCION = { carta: 'Carta', galeria: 'Fotos', horario: 'Horarios', datos: 'Ajustes', textos: 'Textos', mes: 'Lo mejor del mes' };
const fVersion = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

function registrarVersion(seccion, datos, resumen) {
  versiones.unshift({
    id: crypto.randomBytes(6).toString('hex'),
    fecha: new Date().toISOString(),
    seccion,
    resumen: resumen && resumen.length ? resumen : ['Cambios guardados'],
    datos: JSON.parse(JSON.stringify(datos))
  });
  // Se quedan las últimas de cada parte
  const cuenta = {};
  versiones = versiones.filter((v) => (cuenta[v.seccion] = (cuenta[v.seccion] || 0) + 1) <= MAX_VERSIONES_SECCION);
}

function resumenCambios(seccion, a, b) {
  const lineas = [];
  const vacio = (v) => (v === '' || v === null || v === undefined ? 'vacío' : String(v));
  const siNo = (v) => (v ? 'sí' : 'no');
  const igual = (x, y) => JSON.stringify(x) === JSON.stringify(y);
  a = a || {};
  b = b || {};
  if (seccion === 'textos') {
    const l = textosWeb.resumenTextos(a, b, textosBase()).slice(0, 8);
    return l.length ? l : ['Cambios guardados'];
  }
  if (seccion === 'mes') {
    const nombreDe = (x) => x.nombre || ((contenido.carta.productos.find((p) => p.id === x.producto) || {}).nombre) || 'destacado';
    const ia = new Map((a.items || []).map((x) => [x.id, x]));
    const ib = new Map((b.items || []).map((x) => [x.id, x]));
    ib.forEach((x, id) => {
      const v = ia.get(id);
      if (!v) { lineas.push('Nuevo: ' + x.etiqueta + ' · ' + nombreDe(x)); return; }
      if (v.producto !== x.producto || v.nombre !== x.nombre) lineas.push(x.etiqueta + ': ahora es ' + nombreDe(x));
      if (v.etiqueta !== x.etiqueta) lineas.push('«' + v.etiqueta + '» pasa a ser «' + x.etiqueta + '»');
      if (v.desc !== x.desc) lineas.push('Texto de ' + nombreDe(x));
      if (v.precio !== x.precio) lineas.push('Precio de ' + nombreDe(x) + ': ' + vacio(v.precio) + ' → ' + vacio(x.precio));
      if (v.foto !== x.foto) lineas.push(x.foto ? 'Foto nueva de ' + nombreDe(x) : 'Foto quitada de ' + nombreDe(x));
      if (v.icono !== x.icono && !x.producto) lineas.push('Dibujo de ' + nombreDe(x));
    });
    ia.forEach((x, id) => { if (!ib.has(id)) lineas.push('Quitado: ' + x.etiqueta + ' · ' + nombreDe(x)); });
    const oa = (a.items || []).map((x) => x.id).filter((id) => ib.has(id));
    const ob = (b.items || []).map((x) => x.id).filter((id) => ia.has(id));
    if (!igual(oa, ob)) lineas.push('Orden de los destacados');
  }
  if (seccion === 'carta') {
    const gA = new Map((a.categorias || []).map((g) => [g.id, g]));
    const gB = new Map((b.categorias || []).map((g) => [g.id, g]));
    gB.forEach((g, id) => {
      const v = gA.get(id);
      if (!v) lineas.push('Nuevo grupo: ' + g.nombre);
      else {
        if (v.nombre !== g.nombre) lineas.push('Grupo «' + v.nombre + '» pasa a llamarse «' + g.nombre + '»');
        if (v.desc !== g.desc) lineas.push('Frase del grupo «' + g.nombre + '»');
        if (v.icono !== g.icono) lineas.push('Dibujo del grupo «' + g.nombre + '»');
      }
    });
    gA.forEach((g, id) => { if (!gB.has(id)) lineas.push('Grupo borrado: ' + g.nombre); });
    const ordenA = (a.categorias || []).map((g) => g.id).filter((id) => gB.has(id));
    const ordenB = (b.categorias || []).map((g) => g.id).filter((id) => gA.has(id));
    if (!igual(ordenA, ordenB)) lineas.push('Orden de los grupos');
    const pA = new Map((a.productos || []).map((x) => [x.id, x]));
    const pB = new Map((b.productos || []).map((x) => [x.id, x]));
    pB.forEach((x, id) => {
      const v = pA.get(id);
      if (!v) { lineas.push('Nuevo: ' + x.nombre + ' (' + x.precio + ' €)'); return; }
      if (v.nombre !== x.nombre) lineas.push('«' + v.nombre + '» pasa a llamarse «' + x.nombre + '»');
      if (v.precio !== x.precio) lineas.push('Precio de ' + x.nombre + ': ' + v.precio + ' € → ' + x.precio + ' €');
      if (v.desc !== x.desc) lineas.push('Descripción de ' + x.nombre);
      if (!igual(v.alergenos, x.alergenos)) lineas.push('Alérgenos de ' + x.nombre);
      if (!igual(v.etiquetas, x.etiquetas)) lineas.push('Etiquetas de ' + x.nombre);
      if (v.foto !== x.foto) lineas.push(x.foto ? (v.foto ? 'Foto nueva de ' : 'Foto añadida a ') + x.nombre : 'Foto quitada de ' + x.nombre);
      if (v.cat !== x.cat) lineas.push(x.nombre + ' cambia de grupo');
    });
    pA.forEach((x, id) => { if (!pB.has(id)) lineas.push('Borrado: ' + x.nombre); });
  }
  if (seccion === 'galeria') {
    const fa = a.fotos || [], fb = b.fotos || [];
    for (let i = 0; i < Math.max(fa.length, fb.length); i++) {
      const x = fa[i] || {}, y = fb[i] || {};
      if (x.foto !== y.foto) lineas.push('Foto ' + (i + 1) + ': ' + (!y.foto ? 'quitada' : x.foto ? 'cambiada' : 'añadida'));
      if ((x.pie || '') !== (y.pie || '')) lineas.push('Pie de la foto ' + (i + 1) + ': ' + vacio(y.pie));
    }
  } else if (seccion === 'horario') {
    const dA = new Map((a.dias || []).map((d) => [d.dia, d.texto]));
    (b.dias || []).forEach((d) => {
      if ((dA.get(d.dia) || '') !== d.texto) lineas.push(d.dia + ': ' + vacio(dA.get(d.dia)) + ' → ' + vacio(d.texto));
    });
    if (!igual(a.manana, b.manana)) lineas.push('Horas para reservar por la mañana');
    if (!igual(a.tarde, b.tarde)) lineas.push('Horas para reservar por la tarde');
  } else if (seccion === 'datos') {
    [['direccion', 'Dirección'], ['email', 'Email'], ['telefono', 'Teléfono'], ['instagram', 'Instagram'], ['whatsapp', 'WhatsApp']].forEach((c) => {
      if ((a[c[0]] || '') !== (b[c[0]] || '')) lineas.push(c[1] + ': ' + vacio(a[c[0]]) + ' → ' + vacio(b[c[0]]));
    });
    [['abrimosPronto', 'Aviso «Abrimos pronto»'], ['paraLlevar', 'Pedidos para llevar'], ['domicilio', 'Entrega a domicilio']].forEach((c) => {
      if (a[c[0]] !== b[c[0]]) lineas.push(c[1] + ': ' + siNo(b[c[0]]));
    });
    if (!igual(a.zonas, b.zonas)) lineas.push('Zonas para reservar');
    const ca = a.club || {}, cb = b.club || {};
    if (ca.sellos !== cb.sellos) lineas.push('Sellos de la tarjeta del club: ' + vacio(ca.sellos) + ' → ' + cb.sellos);
    if (ca.premio !== cb.premio) lineas.push('Premio del club: ' + cb.premio);
    const aa = a.asistente || ASISTENTE_INICIAL, ab = b.asistente || ASISTENTE_INICIAL;
    if (aa.activo !== ab.activo) lineas.push('Asistente de la web: ' + (ab.activo ? 'activado' : 'desactivado'));
    if (aa.nombre !== ab.nombre) lineas.push('El asistente se llama ahora «' + ab.nombre + '»');
    const la = a.legal || {}, lb = b.legal || {};
    [['titular', 'Titular'], ['nif', 'NIF/CIF'], ['domicilio', 'Domicilio legal'], ['email', 'Email para privacidad'], ['registro', 'Datos del registro']].forEach((c) => {
      if ((la[c[0]] || '') !== (lb[c[0]] || '')) lineas.push(c[1] + ': ' + vacio(la[c[0]]) + ' → ' + vacio(lb[c[0]]));
    });
  }
  if (!lineas.length) return ['Cambios guardados'];
  return lineas.length > 8 ? lineas.slice(0, 7).concat(['y ' + (lineas.length - 7) + ' cambios más']) : lineas;
}

function apiVersiones(req, res, pathname, metodo) {
  exigirAdmin(req);
  if (pathname === '/api/versiones' && metodo === 'GET') {
    const vistas = new Set();
    return enviarJSON(res, 200, {
      versiones: versiones.map((v) => {
        const actual = !vistas.has(v.seccion);
        vistas.add(v.seccion);
        return { id: v.id, fecha: v.fecha, seccion: v.seccion, nombre: NOMBRE_SECCION[v.seccion], resumen: v.resumen, actual };
      })
    });
  }
  const m = pathname.match(/^\/api\/versiones\/([a-f0-9]{12})\/restaurar$/);
  if (m && metodo === 'POST') {
    return (async () => {
      const v = versiones.find((x) => x.id === m[1]);
      if (!v) throw errorCliente('Esa versión ya no está en el historial.', 404);
      const ultima = versiones.find((x) => x.seccion === v.seccion);
      if (ultima === v) throw errorCliente('Esa ya es la versión que se ve en la web.', 409);
      const limpio = VALIDADORES[v.seccion](JSON.parse(JSON.stringify(v.datos)));
      const antes = contenido[v.seccion];
      if (v.seccion === 'datos') {
        if (!v.datos.legal) limpio.legal = Object.assign({}, antes.legal);   // versiones de antes de los datos legales: se conservan los de ahora
        prepararDatos(limpio, antes);
      }
      contenido = Object.assign({}, contenido, { [v.seccion]: limpio });
      await guardarArchivo('contenido.json', contenido);
      if (v.seccion === 'datos') avisarCambioClub(antes, limpio);
      const cambios = resumenCambios(v.seccion, antes, limpio).filter((l) => l !== 'Cambios guardados');
      registrarVersion(v.seccion, limpio, ['Vuelta a la versión del ' + fVersion.format(new Date(v.fecha))].concat(cambios).slice(0, 8));
      await guardarArchivo('versiones.json', versiones);
      console.log('[soño] Restaurada una versión de', NOMBRE_SECCION[v.seccion]);
      return enviarJSON(res, 200, { seccion: v.seccion, valor: limpio });
    })();
  }
  return enviarJSON(res, 404, { error: 'No encontrado.' });
}

/* ---------- Rutas de la API ---------- */
async function api(req, res, pathname) {
  const metodo = req.method;
  const ip = ipCliente(req);

  if (pathname.startsWith('/api/club/')) return apiClub(req, res, pathname, metodo, ip);
  if (pathname === '/api/versiones' || pathname.startsWith('/api/versiones/')) return apiVersiones(req, res, pathname, metodo);
  if (pathname === '/api/resenas' || pathname.startsWith('/api/resenas/')) return apiResenas(req, res, pathname, metodo, ip);

  /* La carta en su propia página (/carta) en lugar de en la portada */
  if (pathname === '/api/carta/aparte' && metodo === 'POST') {
    exigirAdmin(req);
    const datos = await leerJSON(req);
    if (typeof datos.aparte !== 'boolean') throw errorCliente('Indica si la carta va en su propia página o no.');
    contenido.datos = Object.assign({}, contenido.datos, { cartaAparte: datos.aparte });
    await guardarArchivo('contenido.json', contenido);
    console.log('[soño] Carta ' + (datos.aparte ? 'en su propia página' : 'en la portada'));
    return enviarJSON(res, 200, { cartaAparte: datos.aparte });
  }

  /* Interruptores que se guardan al momento: «Lo mejor del mes» y «Trabaja con nosotros» */
  const mInterruptor = pathname.match(/^\/api\/(mes|empleo)\/activo$/);
  if (mInterruptor && metodo === 'POST') {
    exigirAdmin(req);
    const datos = await leerJSON(req);
    const cual = mInterruptor[1];
    if (typeof datos.activo !== 'boolean') throw errorCliente('Indica si queda activo o no.');
    const actual = cual === 'mes' ? ajustesMes() : ajustesEmpleo();
    contenido.datos = Object.assign({}, contenido.datos, { [cual]: Object.assign({}, actual, { activo: datos.activo }) });
    await guardarArchivo('contenido.json', contenido);
    console.log('[soño] ' + (cual === 'mes' ? 'Lo mejor del mes' : 'Trabaja con nosotros') + (datos.activo ? ' activado' : ' desactivado'));
    return enviarJSON(res, 200, { [cual]: contenido.datos[cual] });
  }

  if (pathname === '/api/contenido' && metodo === 'GET') {
    return enviarJSON(res, 200, Object.assign({}, contenido, { textosBase: textosBase() }));
  }

  if (pathname === '/api/sesion' && metodo === 'GET') {
    return enviarJSON(res, 200, { admin: sesionValida(req) });
  }

  if (pathname === '/api/login' && metodo === 'POST') {
    if (!mismoOrigen(req)) throw errorCliente('Petición no permitida.', 403);
    const estado = intentosLogin.get(ip) || { fallos: 0, bloqueadoHasta: 0 };
    if (estado.bloqueadoHasta > Date.now()) {
      const minutos = Math.ceil((estado.bloqueadoHasta - Date.now()) / 60000);
      throw errorCliente('Demasiados intentos. Prueba otra vez dentro de ' + minutos + ' min.', 429);
    }
    const datos = await leerJSON(req);
    if (!ADMIN_CLAVE) throw errorCliente('El panel está desactivado: falta configurar ADMIN_PASSWORD en el servidor.', 503);
    const usuarioOk = igualSeguro(normalizarUsuario(datos.usuario), ADMIN_USUARIO) ||
      (ADMIN_USUARIO === 'soño' && igualSeguro(normalizarUsuario(datos.usuario), 'sono'));
    const claveOk = igualSeguro(String(datos.clave || ''), ADMIN_CLAVE);
    if (!usuarioOk || !claveOk) {
      estado.fallos += 1;
      if (estado.fallos >= 5) { estado.bloqueadoHasta = Date.now() + 15 * 60000; estado.fallos = 0; }
      intentosLogin.set(ip, estado);
      throw errorCliente('Usuario o contraseña incorrectos.', 401);
    }
    intentosLogin.delete(ip);
    const token = crypto.randomBytes(32).toString('hex');
    sesiones.set(token, Date.now() + HORAS_SESION * 3600000);
    res.setHeader('Set-Cookie', cookieSesion(req, token, HORAS_SESION * 3600));
    return enviarJSON(res, 200, { ok: true });
  }

  if (pathname === '/api/logout' && metodo === 'POST') {
    const token = leerCookies(req).sono2_sesion;
    if (token) sesiones.delete(token);
    res.setHeader('Set-Cookie', cookieSesion(req, '', 0));
    return enviarJSON(res, 200, { ok: true });
  }

  const mContenido = pathname.match(/^\/api\/contenido\/(carta|galeria|horario|datos|textos|mes)$/);
  if (mContenido && metodo === 'PUT') {
    exigirAdmin(req);
    const clave = mContenido[1];
    const limpio = VALIDADORES[clave](await leerJSON(req));
    const antes = contenido[clave];
    if (clave === 'datos') {
      prepararDatos(limpio, antes);
      limpio.club = Object.assign({}, ajustesClub());   // el premio y los sellos se cambian en la pestaña Club
    }
    contenido = Object.assign({}, contenido, { [clave]: limpio });
    await guardarArchivo('contenido.json', contenido);
    if (clave === 'datos') avisarCambioClub(antes, limpio);
    if (JSON.stringify(antes) !== JSON.stringify(limpio)) {
      // La primera vez que se cambia una parte nueva (los textos), se guarda también cómo estaba
      if (antes && !versiones.some((x) => x.seccion === clave)) registrarVersion(clave, antes, ['Cómo estaba antes del primer cambio']);
      registrarVersion(clave, limpio, resumenCambios(clave, antes, limpio));
      await guardarArchivo('versiones.json', versiones);
    }
    return enviarJSON(res, 200, { ok: true, [clave]: limpio });
  }

  if (pathname === '/api/fotos' && metodo === 'POST') {
    exigirAdmin(req);
    const buf = await leerCuerpo(req, MAX_VIDEO);
    const ext = tipoImagen(buf);
    if (ext === 'heic') throw errorCliente('Esa foto está en formato HEIC/AVIF y este navegador no la ha podido convertir. Ábrela desde el iPhone o el Mac (Safari) o guárdala antes como JPG.', 415);
    if (!ext) throw errorCliente('Ese formato no vale. Usa una foto (JPG, PNG, WebP), un GIF o un vídeo MP4.', 415);
    const video = ['mp4', 'webm', 'mov'].includes(ext);
    if (!video && buf.length > MAX_FOTO) throw errorCliente('La foto pesa demasiado (máximo 10 MB).', 413);
    const id = crypto.randomBytes(16).toString('hex') + '.' + ext;
    await fsp.writeFile(path.join(DIR_FOTOS, id), buf);
    const aviso = video && esHevc(buf)
      ? 'Ojo: este vídeo está en HEVC (el formato del iPhone) y en algunos Android no se verá. Si puedes, súbelo en MP4 «más compatible» (en el iPhone: Ajustes → Cámara → Formatos → Más compatible).'
      : '';
    return enviarJSON(res, 201, { id, url: '/fotos/' + id, video, aviso });
  }

  if (pathname === '/api/reservas' && metodo === 'POST') {
    if (!mismoOrigen(req)) throw errorCliente('Petición no permitida.', 403);
    const datos = await leerJSON(req);
    if (texto(datos.web, 200)) return enviarJSON(res, 201, { ok: true });   // trampa para bots
    const fecha = String(datos.fecha || '');
    if (!RE_FECHA.test(fecha) || isNaN(Date.parse(fecha + 'T12:00:00'))) throw errorCliente('Elige un día para la reserva.');
    if (fecha < hoyISO(-1) || fecha > hoyISO(60)) throw errorCliente('Solo se puede reservar para los próximos días.');
    const hora = String(datos.hora || '');
    const horas = contenido.horario.manana.concat(contenido.horario.tarde);
    if (!horas.includes(hora)) throw errorCliente('Esa hora ya no está disponible. Elige otra.');
    const personas = Number(datos.personas);
    if (!Number.isInteger(personas) || personas < 1 || personas > 8) throw errorCliente('Las reservas son de 1 a 8 personas.');
    const nombre = texto(datos.nombre, 80);
    if (!nombre) throw errorCliente('Escribe tu nombre para guardar la mesa.');
    const telefono = texto(datos.telefono, 25);
    if (telefono.replace(/[^\d]/g, '').length < 9) throw errorCliente('Revisa el teléfono: necesitamos al menos 9 cifras para avisarte.');
    // Zona: vacía = donde haya sitio; si no, una de las zonas activas
    const idZona = String(datos.zona || '');
    let zona = null;
    if (idZona) {
      zona = (contenido.datos.zonas || []).find((z) => z.id === idZona && z.activa);
      if (!zona) throw errorCliente('Esa zona ya no se puede reservar. Elige otra o «Donde haya sitio».');
    }
    if (!permitirEnvio('reserva', ip, 8, 3600000)) throw errorCliente('Has hecho muchas reservas seguidas. Si necesitas más, escríbenos.', 429);
    if (reservas.length >= MAX_RESERVAS) throw errorCliente('No podemos aceptar más reservas ahora mismo. Escríbenos, por favor.', 503);
    const reserva = {
      id: crypto.randomBytes(8).toString('hex'),
      creada: new Date().toISOString(),
      fecha,
      hora,
      personas,
      zona: zona ? zona.id : null,
      zonaNombre: zona ? zona.nombre : null,
      nombre,
      telefono,
      notas: textoLargo(datos.notas, 500)
    };
    reservas.push(reserva);
    await guardarArchivo('reservas.json', reservas);
    console.log('[soño] Nueva reserva:', fecha, hora, personas + ' pers.', zona ? zona.nombre : '');
    return enviarJSON(res, 201, { ok: true });
  }

  if (pathname === '/api/reservas' && metodo === 'GET') {
    exigirAdmin(req);
    const orden = reservas.slice().sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora));
    return enviarJSON(res, 200, { reservas: orden, hoy: hoyISO(0) });
  }

  const mReserva = pathname.match(/^\/api\/reservas\/([a-f0-9]{16})$/);
  if (mReserva && metodo === 'DELETE') {
    exigirAdmin(req);
    reservas = reservas.filter((r) => r.id !== mReserva[1]);
    await guardarArchivo('reservas.json', reservas);
    return enviarJSON(res, 200, { ok: true });
  }

  if (pathname === '/api/pedidos' && metodo === 'POST') {
    if (!mismoOrigen(req)) throw errorCliente('Petición no permitida.', 403);
    const datos = await leerJSON(req);
    if (texto(datos.web, 200)) return enviarJSON(res, 201, { ok: true });   // trampa para bots
    if (contenido.datos.paraLlevar === false) throw errorCliente('Ahora mismo no aceptamos pedidos para llevar.', 409);
    const tipo = datos.tipo === 'domicilio' ? 'domicilio' : (datos.tipo === 'recoger' ? 'recoger' : null);
    if (!tipo) throw errorCliente('Elige si vienes a recogerlo o te lo llevamos.');
    if (tipo === 'domicilio' && contenido.datos.domicilio === false) throw errorCliente('Ahora mismo no hacemos entregas a domicilio. Puedes pedir para recoger.');
    const nombre = texto(datos.nombre, 80);
    if (!nombre) throw errorCliente('Escribe tu nombre para el pedido.');
    const telefono = texto(datos.telefono, 25);
    if (telefono.replace(/[^\d]/g, '').length < 9) throw errorCliente('Revisa el teléfono: necesitamos al menos 9 cifras para avisarte.');
    const direccion = tipo === 'domicilio' ? texto(datos.direccion, 160) : '';
    if (tipo === 'domicilio' && direccion.length < 5) throw errorCliente('Escribe la dirección de entrega.');
    // Hora de recogida: una de las horas del horario, de hoy a pasado mañana y que no haya pasado ya
    let recogida = null;
    const horasLocal = [...new Set(contenido.horario.manana.concat(contenido.horario.tarde))];
    if (tipo === 'recoger' && horasLocal.length) {
      const r = datos.recogida && typeof datos.recogida === 'object' ? datos.recogida : {};
      const fecha = String(r.fecha || '');
      const hora = String(r.hora || '');
      if (!RE_FECHA.test(fecha) || fecha < hoyISO(0) || fecha > hoyISO(2)) throw errorCliente('Elige qué día pasas a recogerlo: hoy, mañana o pasado mañana.');
      if (!horasLocal.includes(hora)) throw errorCliente('Elige a qué hora pasas a recogerlo.');
      if (fecha === hoyISO(0)) {
        const ahora = new Date();
        const [hh, mm] = hora.split(':').map(Number);
        if (hh * 60 + mm < ahora.getHours() * 60 + ahora.getMinutes() + 5) throw errorCliente('Esa hora de recogida ya ha pasado. Elige otra un poco más tarde.');
      }
      recogida = { fecha, hora };
    }
    const entrada = Array.isArray(datos.lineas) ? datos.lineas.slice(0, 20) : [];
    const cantidades = new Map();
    for (const l of entrada) {
      const id = String((l && l.id) || '');
      const cantidad = Number(l && l.cantidad);
      if (!id) continue;
      const producto = contenido.carta.productos.find((p) => p.id === id);
      if (!producto) throw errorCliente('Uno de los productos ya no está en la carta. Revisa el pedido.');
      if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > 20) throw errorCliente('Las cantidades van de 1 a 20 por producto.');
      cantidades.set(id, Math.min(20, (cantidades.get(id) || 0) + cantidad));
    }
    if (!cantidades.size) throw errorCliente('Elige al menos un producto de la carta.');
    let totalCent = 0;
    const lineas = [];
    for (const [id, cantidad] of cantidades) {
      const p = contenido.carta.productos.find((x) => x.id === id);
      const cent = Math.round(Number(p.precio.replace(',', '.')) * 100);
      totalCent += cent * cantidad;
      lineas.push({ id, nombre: p.nombre, precio: p.precio, cantidad });
    }
    if (!permitirEnvio('pedido', ip, 6, 3600000)) throw errorCliente('Has hecho muchos pedidos seguidos. Si necesitas más, llámanos.', 429);
    if (pedidos.length >= MAX_PEDIDOS) throw errorCliente('No podemos aceptar más pedidos ahora mismo. Llámanos, por favor.', 503);
    const total = (totalCent / 100).toFixed(2).replace('.', ',');
    const pedido = {
      id: crypto.randomBytes(8).toString('hex'),
      creado: new Date().toISOString(),
      tipo,
      nombre,
      telefono,
      direccion,
      recogida,
      lineas,
      total,
      notas: textoLargo(datos.notas, 500)
    };
    pedidos.unshift(pedido);
    await guardarArchivo('pedidos.json', pedidos);
    console.log('[soño] Nuevo pedido:', tipo, recogida ? recogida.fecha + ' ' + recogida.hora : '', total + ' €');
    return enviarJSON(res, 201, { ok: true, total, lineas, recogida });
  }

  if (pathname === '/api/pedidos' && metodo === 'GET') {
    exigirAdmin(req);
    return enviarJSON(res, 200, { pedidos });
  }

  const mPedido = pathname.match(/^\/api\/pedidos\/([a-f0-9]{16})$/);
  if (mPedido && metodo === 'DELETE') {
    exigirAdmin(req);
    pedidos = pedidos.filter((p) => p.id !== mPedido[1]);
    await guardarArchivo('pedidos.json', pedidos);
    return enviarJSON(res, 200, { ok: true });
  }

  if (pathname === '/api/mensajes' && metodo === 'POST') {
    if (!mismoOrigen(req)) throw errorCliente('Petición no permitida.', 403);
    const datos = await leerJSON(req);
    if (texto(datos.web, 200)) return enviarJSON(res, 201, { ok: true });
    const nombre = texto(datos.nombre, 80);
    const email = texto(datos.email, 120);
    const mensaje = textoLargo(datos.mensaje, 2000);
    if (!nombre || !email || !mensaje) throw errorCliente('Rellena nombre, email y mensaje para continuar.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw errorCliente('Revisa el email: parece que le falta algo.');
    if (!permitirEnvio('mensaje', ip, 5, 3600000)) throw errorCliente('Has enviado muchos mensajes seguidos. Prueba más tarde.', 429);
    mensajes.unshift({ id: crypto.randomBytes(8).toString('hex'), tipo: 'consulta', creado: new Date().toISOString(), nombre, email, mensaje });
    recortarMensajes();
    await guardarArchivo('mensajes.json', mensajes);
    return enviarJSON(res, 201, { ok: true });
  }

  /* Trabaja con nosotros: la candidatura llega a «Mensajes» con el currículum */
  if (pathname === '/api/candidaturas' && metodo === 'POST') {
    if (!mismoOrigen(req)) throw errorCliente('Petición no permitida.', 403);
    if (ajustesEmpleo().activo === false) throw errorCliente('Ahora mismo no estamos recibiendo candidaturas.', 409);
    const datos = await leerJSON(req, MAX_JSON_CV);
    if (texto(datos.web, 200)) return enviarJSON(res, 201, { ok: true });   // trampa para bots
    const nombre = texto(datos.nombre, 80);
    if (nombre.length < 2) throw errorCliente('Escribe tu nombre.');
    const email = texto(datos.email, 120);
    if (!RE_EMAIL.test(email)) throw errorCliente('Revisa el email: parece que le falta algo.');
    const telefono = texto(datos.telefono, 25);
    if (telefono && telefono.replace(/[^\d]/g, '').length < 9) throw errorCliente('Revisa el teléfono: necesita al menos 9 cifras (o déjalo vacío).');
    const puesto = texto(datos.puesto, 80);
    const mensaje = textoLargo(datos.mensaje, 1500).replace(/\n{3,}/g, '\n\n');
    let buf = null;
    let nombreArchivo = '';
    if (datos.cv && typeof datos.cv === 'object' && typeof datos.cv.datos === 'string' && datos.cv.datos) {
      const b64 = datos.cv.datos.replace(/^data:[^,]*,/, '');
      if (!/^[A-Za-z0-9+/=\s]+$/.test(b64)) throw errorCliente('No se ha podido leer el currículum. Prueba a adjuntarlo otra vez.');
      buf = Buffer.from(b64, 'base64');
      nombreArchivo = texto(datos.cv.nombre, 120).replace(/[\\/:*?"<>|\u0000-\u001f]/g, '');
    }
    if (!buf && mensaje.length < 20) throw errorCliente('Adjunta tu currículum o cuéntanos un poco de ti (al menos 20 caracteres).');
    let ext = null;
    if (buf) {
      if (buf.length > MAX_CV) throw errorCliente('El currículum pesa demasiado (máximo 5 MB). Prueba a guardarlo en PDF.', 413);
      if (buf.length < 64) throw errorCliente('El archivo del currículum está vacío. Prueba a adjuntarlo otra vez.');
      ext = tipoCv(buf);
      if (ext === 'heic') throw errorCliente('Esa foto está en formato HEIC y no la podemos abrir. Mejor sube el currículum en PDF, o una foto en JPG.', 415);
      if (!ext) throw errorCliente('Ese formato no vale para el currículum. Usa PDF (mejor), Word o una foto.', 415);
    }
    if (datos.acepto !== true) throw errorCliente('Para enviarla tienes que aceptar que guardemos tu candidatura.');
    if (!permitirEnvio('candidatura', ip, 3, 3600000)) throw errorCliente('Has enviado varias candidaturas seguidas. Prueba más tarde.', 429);
    if (mensajes.filter((m) => m.tipo === 'empleo').length >= MAX_CANDIDATURAS) {
      throw errorCliente('Ahora mismo no podemos recibir más candidaturas. Prueba en unos días o escríbenos.', 503);
    }
    const candidatura = {
      id: crypto.randomBytes(8).toString('hex'),
      tipo: 'empleo',
      creado: new Date().toISOString(),
      nombre,
      email,
      telefono,
      puesto,
      mensaje,
      cv: null
    };
    if (buf) {
      const archivo = crypto.randomBytes(16).toString('hex') + '.' + ext;
      await fsp.writeFile(path.join(DIR_CV, archivo), buf);
      let nombreCv = nombreArchivo || 'curriculum.' + ext;
      if (!new RegExp('\\.' + (ext === 'jpg' ? 'jpe?g' : ext) + '$', 'i').test(nombreCv)) nombreCv = nombreCv.replace(/\.[a-z0-9]{1,5}$/i, '') + '.' + ext;
      candidatura.cv = { archivo, nombre: nombreCv, tamano: buf.length, tipo: ext };
    }
    mensajes.unshift(candidatura);
    recortarMensajes();
    try {
      await guardarArchivo('mensajes.json', mensajes);
    } catch (e) {
      mensajes = mensajes.filter((m) => m !== candidatura);
      borrarCv(candidatura);
      throw e;
    }
    console.log('[soño] Nueva candidatura' + (candidatura.cv ? ' con currículum (' + ext + ')' : ''));
    return enviarJSON(res, 201, { ok: true });
  }

  if (pathname === '/api/mensajes' && metodo === 'GET') {
    exigirAdmin(req);
    return enviarJSON(res, 200, { mensajes, empleo: ajustesEmpleo() });
  }

  /* El currículum de una candidatura: solo con la sesión del panel. PDF y fotos se abren en el navegador */
  const mCv = pathname.match(/^\/api\/mensajes\/([a-f0-9]{16})\/cv$/);
  if (mCv && (metodo === 'GET' || metodo === 'HEAD')) {
    if (!sesionValida(req)) throw errorCliente('Tu sesión ha caducado. Vuelve a entrar en el panel.', 401);
    const m = mensajes.find((x) => x.id === mCv[1]);
    if (!m || !m.cv || !RE_CV.test(String(m.cv.archivo || ''))) throw errorCliente('Ese currículum ya no está.', 404);
    let buf;
    try { buf = await fsp.readFile(path.join(DIR_CV, m.cv.archivo)); } catch (e) { throw errorCliente('Ese currículum ya no está.', 404); }
    const ext = m.cv.archivo.split('.').pop();
    const verAqui = ['pdf', 'jpg', 'png', 'webp'].includes(ext) && !new URL(req.url, 'http://x').searchParams.has('descargar');
    const nombre = 'CV ' + m.nombre.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '').slice(0, 60) + '.' + ext;
    const ascii = nombre.normalize('NFD').replace(/[^\x20-\x7e]/g, '').replace(/["\\]/g, '') || 'curriculum.' + ext;
    // El visor de PDF del navegador no arranca con la política de seguridad de la web (object-src 'none')
    if (ext === 'pdf') res.removeHeader('Content-Security-Policy');
    res.writeHead(200, {
      'Content-Type': TIPOS_CV[ext],
      'Content-Length': buf.length,
      'Cache-Control': 'private, no-store',
      'Content-Disposition': (verAqui ? 'inline' : 'attachment') + '; filename="' + ascii + '"; filename*=UTF-8\'\'' + encodeURIComponent(nombre).replace(/['()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase())
    });
    return res.end(metodo === 'HEAD' ? undefined : buf);
  }

  const mMensaje = pathname.match(/^\/api\/mensajes\/([a-f0-9]{16})$/);
  if (mMensaje && metodo === 'DELETE') {
    exigirAdmin(req);
    const borrado = mensajes.find((m) => m.id === mMensaje[1]);
    mensajes = mensajes.filter((m) => m !== borrado);
    await guardarArchivo('mensajes.json', mensajes);
    borrarCv(borrado);
    return enviarJSON(res, 200, { ok: true });
  }

  return enviarJSON(res, 404, { error: 'No encontrado.' });
}

/* ---------- Servidor ---------- */
async function atender(req, res) {
  cabecerasSeguridad(res);
  let url;
  try { url = new URL(req.url, 'http://localhost'); } catch (e) { return enviarTexto(res, 400, 'Petición no válida'); }
  const pathname = url.pathname;

  if (pathname === '/salud') return enviarTexto(res, 200, 'ok');

  if (pathname.startsWith('/api/')) return api(req, res, pathname);

  if (pathname.startsWith('/wallet/') && wallet) {
    const ip = ipCliente(req);
    if (await wallet.atender(req, res, pathname, (tipo, maximo) => permitirEnvio(tipo, ip, maximo, 3600000))) return;
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') return enviarTexto(res, 405, 'Método no permitido');

  const mFoto = pathname.match(/^\/fotos\/([a-f0-9]{32}\.(?:jpg|png|webp|gif|mp4|webm|mov))$/);
  if (mFoto) {
    const ok = await servirArchivo(req, res, path.join(DIR_FOTOS, mFoto[1]), 'public, max-age=31536000, immutable');
    if (!ok) enviarTexto(res, 404, 'Foto no encontrada');
    return;
  }

  if (PAGINAS_LEGALES.includes(pathname)) {
    if (await servirArchivo(req, res, path.join(DIR_PUBLICO, 'legal.html'), 'no-cache')) return;
  }

  if (pathname === '/' || pathname === '/index.html') return servirIndice(req, res, false);
  if (pathname === '/carta' || pathname === '/carta/') return servirIndice(req, res, true);

  if (await servirPublico(req, res, pathname)) return;

  /* Cualquier otra ruta muestra la portada, sin cambiar de URL */
  if (!path.extname(pathname)) return servirIndice(req, res, false);
  enviarTexto(res, 404, 'No encontrado');
}

const servidor = http.createServer((req, res) => {
  atender(req, res).catch((e) => {
    if (!e.publico) console.error('[soño] Error:', e);
    if (res.headersSent) { res.end(); return; }
    enviarJSON(res, e.status || 500, { error: e.publico ? e.message : 'Error interno del servidor.' });
  });
});

/* Limpieza periódica de sesiones e intentos caducados */
setInterval(() => {
  const ahora = Date.now();
  for (const [t, caduca] of sesiones) if (caduca < ahora) sesiones.delete(t);
  for (const [ip, e] of intentosLogin) if (e.bloqueadoHasta < ahora && e.fallos === 0) intentosLogin.delete(ip);
  for (const [k, lista] of envios) if (!lista.some((t) => ahora - t < 3600000)) envios.delete(k);
  for (const [ip, e] of intentosSocio) if (e.bloqueadoHasta < ahora && e.fallos === 0) intentosSocio.delete(ip);
}, 10 * 60000).unref();

/* Borrado de lo antiguo (reservas, pedidos y mensajes) cada 6 horas */
setInterval(() => {
  limpiarAntiguos().catch((e) => console.error('[soño] Error al borrar datos antiguos:', e));
}, 6 * 3600000).unref();

iniciarDatos().then(() => {
  servidor.listen(PUERTO, () => {
    console.log('[soño] Web en marcha en el puerto ' + PUERTO + ' · datos en ' + DIR_DATOS);
    if (!ADMIN_CLAVE) console.warn('[soño] AVISO: ADMIN_PASSWORD no está configurada; el panel no deja entrar.');
    else if (ADMIN_CLAVE.length < 8) console.warn('[soño] AVISO: la contraseña del panel es corta. Usa una de 8 caracteres o más.');
  });
}).catch((e) => {
  console.error('[soño] No se pudo arrancar:', e);
  process.exit(1);
});

function apagar() {
  servidor.close(() => colaEscritura.then(() => process.exit(0)));
  setTimeout(() => process.exit(0), 5000).unref();
}
process.on('SIGTERM', apagar);
process.on('SIGINT', apagar);
