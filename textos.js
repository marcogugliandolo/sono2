'use strict';
/* Textos editables de la web y menú (nombres y orden).
   Los textos originales salen del propio index.html: cada elemento con data-texto="clave".
   Aquí solo se guardan los cambios; un texto vacío vuelve al original. */

const MENU = [
  { id: 'nosotros', texto: 'Nosotros' },
  { id: 'carta', texto: 'Carta' },
  { id: 'llevar', texto: 'Para llevar' },
  { id: 'club', texto: 'Club' },
  { id: 'galeria', texto: 'Galería' },
  { id: 'resenas', texto: 'Reseñas' },
  { id: 'contacto', texto: 'Visítanos' }
];
const MENU_IDS = MENU.map((m) => m.id);
const MAX_MENU = 30;
const MAX_TEXTO = 600;

/* Textos que no están escritos tal cual en la página (cambian según los Ajustes) */
const TEXTOS_EXTRA = {
  'llevar.textoRecoger': 'Haz tu pedido aquí y pásate a recogerlo cuando esté listo.'
};

/* Nombre de cada parte de la web, para el historial */
const PARTES = {
  portada: 'Portada', escena: 'Así preparamos tu café', nosotros: 'Nosotros', mes: 'Carta (lo mejor del mes)', carta: 'Carta', llevar: 'Para llevar',
  club: 'Club', galeria: 'Galería', resenas: 'Reseñas', contacto: 'Visítanos', escribenos: 'Visítanos', empleo: 'Trabaja con nosotros',
  pie: 'Pie de página'
};

const RE_ELEMENTO = /<([a-z0-9]+)\b([^>]*?)\sdata-texto="([a-z0-9.]+)"([^>]*)>([\s\S]*?)<\/\1>/g;

function deEntidades(s) {
  return s.replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
}
function escapar(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* HTML de un elemento → texto con {premio}, {sellos} y saltos de línea */
function aTexto(html) {
  return deEntidades(html
    .replace(/<strong id="club-premio">[\s\S]*?<\/strong>/g, '{premio}')
    .replace(/<span id="club-n">[\s\S]*?<\/span>/g, '{sellos}')
    .replace(/<br\s*\/?>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/[ \t]*\n[ \t]*/g, '\n')
    .replace(/[ \t]+/g, ' ')).trim();
}

/* Texto → HTML seguro. {premio} y {sellos} solo se cambian en los textos del club */
function aHtml(clave, valor, club) {
  let h = escapar(valor).replace(/\n/g, '<br>');
  if (clave === 'club.texto') h = h.replace('{premio}', '<strong id="club-premio">' + escapar((club && club.premio) || '') + '</strong>');
  if (clave === 'club.p3') h = h.replace('{sellos}', '<span id="club-n">' + escapar(String((club && club.sellos) || '')) + '</span>');
  return h;
}

/* Textos originales: los de la página + los extra */
function textosOriginales(html) {
  const base = {};
  let m;
  RE_ELEMENTO.lastIndex = 0;
  while ((m = RE_ELEMENTO.exec(html))) {
    if (!(m[3] in base)) base[m[3]] = aTexto(m[5]);
  }
  return Object.assign(base, TEXTOS_EXTRA);
}

/* Un menú guardado antes de que existiera una sección nueva: la sección entra en su sitio
   (detrás de la que tiene delante en el menú original), no al principio ni al final */
function completarMenu(menu) {
  const lista = (Array.isArray(menu) ? menu : []).filter((m) => m && MENU_IDS.includes(m.id))
    .filter((m, i, todos) => todos.findIndex((x) => x.id === m.id) === i)
    .map((m) => ({ id: m.id, texto: m.texto }));
  MENU.forEach((m, i) => {
    if (lista.some((x) => x.id === m.id)) return;
    let pos = 0;
    for (let j = i - 1; j >= 0; j--) {
      const k = lista.findIndex((x) => x.id === MENU[j].id);
      if (k !== -1) { pos = k + 1; break; }
    }
    lista.splice(pos, 0, { id: m.id, texto: m.texto });
  });
  return lista;
}

function limpiarTexto(v, max) {
  if (typeof v !== 'string') return '';
  return v.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, '').replace(/\n{3,}/g, '\n\n').trim().slice(0, max);
}

/* Lo que llega del panel → lo que se guarda (solo los textos cambiados) */
function validarTextos(v, base) {
  const x = v && typeof v === 'object' ? v : {};
  const menu = completarMenu(x.menu).map((item) => {
    const original = MENU.find((m) => m.id === item.id).texto;
    return { id: item.id, texto: limpiarTexto(item.texto, MAX_MENU).replace(/\n/g, ' ') || original };
  });
  const textos = {};
  const entrada = x.textos && typeof x.textos === 'object' ? x.textos : {};
  Object.keys(base).forEach((clave) => {
    const valor = limpiarTexto(entrada[clave], MAX_TEXTO);
    if (valor && valor !== base[clave]) textos[clave] = valor;
  });
  return { menu, textos };
}

function textosIniciales() {
  return { menu: MENU.map((m) => Object.assign({}, m)), textos: {} };
}

/* Prepara el index.html con los textos y el menú guardados (así no parpadea al cargar).
   «tr» traduce cada texto cuando la página va en otro idioma (en castellano no se pasa) */
function aplicarAlHtml(html, guardado, base, datos, tr) {
  const g = guardado || textosIniciales();
  const cambiados = g.textos || {};
  const traduce = typeof tr === 'function';
  let club = (datos && datos.club) || {};
  if (traduce && club.premio) club = Object.assign({}, club, { premio: tr(club.premio) });
  const sinDomicilio = datos && datos.domicilio === false;
  RE_ELEMENTO.lastIndex = 0;
  html = html.replace(RE_ELEMENTO, (todo, etiqueta, antes, clave, despues, dentro) => {
    let valor = cambiados[clave];
    if (clave === 'llevar.texto' && sinDomicilio) valor = cambiados['llevar.textoRecoger'] || base['llevar.textoRecoger'];
    if (clave === 'club.texto' || clave === 'club.p3') valor = valor || base[clave];   // con el premio y los sellos de verdad
    if (traduce) valor = tr(valor || base[clave] || '');
    if (!valor) return todo;
    return '<' + etiqueta + antes + ' data-texto="' + clave + '"' + despues + '>' + aHtml(clave, valor, club) + '</' + etiqueta + '>';
  });
  const menu = completarMenu(g.menu || MENU);
  const orden = menu.map((m) => m.id);
  const nombre = new Map(menu.map((m) => [m.id, m.texto]));
  return html.replace(/(<ul\b[^>]*\sdata-menu-lista[^>]*>)([\s\S]*?)(\n[ \t]*<\/ul>)/g, (todo, abre, dentro, cierra) => {
    const items = dentro.match(/\n[ \t]*<li\b[\s\S]*?<\/li>/g) || [];
    const fijos = [];
    const delMenu = [];
    items.forEach((li) => {
      const m = /data-menu="([a-z]+)"/.exec(li);
      if (!m) { fijos.push(li); return; }
      const texto = nombre.get(m[1]) || '';
      delMenu.push({ id: m[1], li: li.replace(/(<a\b[^>]*>)[\s\S]*?(<\/a>)/, (t, a, b) => a + escapar(traduce ? tr(texto) : texto) + b) });
    });
    delMenu.sort((a, b) => orden.indexOf(a.id) - orden.indexOf(b.id));
    return abre + fijos.concat(delMenu.map((x) => x.li)).join('') + cierra;
  });
}

/* Resumen de cambios para el historial */
function resumenTextos(a, b, base) {
  const lineas = [];
  const ma = (a && a.menu) || MENU;
  const mb = (b && b.menu) || MENU;
  const na = new Map(ma.map((m) => [m.id, m.texto]));
  mb.forEach((m) => {
    if (na.has(m.id) && na.get(m.id) !== m.texto) lineas.push('Menú: «' + na.get(m.id) + '» pasa a llamarse «' + m.texto + '»');
  });
  if (ma.map((m) => m.id).join() !== mb.map((m) => m.id).join()) lineas.push('Orden del menú');
  const ta = (a && a.textos) || {};
  const tb = (b && b.textos) || {};
  const partes = new Set();
  Object.keys(Object.assign({}, base, ta, tb)).forEach((clave) => {
    if ((ta[clave] || '') !== (tb[clave] || '')) partes.add(PARTES[clave.split('.')[0]] || 'Otros');
  });
  partes.forEach((p) => lineas.push('Textos de «' + p + '»'));
  return lineas;
}

module.exports = { MENU, MENU_IDS, completarMenu, textosOriginales, validarTextos, textosIniciales, aplicarAlHtml, resumenTextos, aTexto, aHtml };
