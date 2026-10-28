'use strict';
/* La web en gallego (/gl) y en inglés (/en).
   Los textos traducidos están en public/idiomas/gl.js y public/idiomas/en.js (los usa también el navegador).
   Cada texto en castellano es la clave de su traducción, así que si en el panel se cambia un texto,
   mientras nadie lo traduzca sale en castellano (mejor eso que una traducción que ya no dice lo mismo).
   Las traducciones que se escriben en el panel (pestaña «Idiomas») van por delante de las de los archivos. */

const IDIOMAS = ['es', 'gl', 'en'];
const OTROS = ['gl', 'en'];
const NOMBRES = { es: 'Castellano', gl: 'Galego', en: 'English' };
const CORTOS = { es: 'ES', gl: 'GL', en: 'EN' };
const LOCALES = { es: 'es-ES', gl: 'gl-ES', en: 'en-GB' };
const NUMERICOS = { n: 1, m: 1, k: 1 };

const DIC = {};
function preparar(d) {
  const patrones = Object.keys(d.patrones || {}).map((es) => {
    const nombres = [];
    const fuente = es.split(/\{(\w+)\}/).map((trozo, i) => {
      if (i % 2) { nombres.push(trozo); return NUMERICOS[trozo] ? '(\\d+(?:[.,]\\d+)?)' : '(.+?)'; }
      return trozo.replace(/[.*+?^$()|[\]\\{}]/g, '\\$&');
    }).join('');
    return { re: new RegExp('^' + fuente + '$'), nombres, destino: d.patrones[es], fijo: es.replace(/\{\w+\}/g, '').length };
  }).sort((a, b) => b.fijo - a.fijo);
  return { textos: d.textos || {}, patrones };
}
function cargar() {
  OTROS.forEach((i) => {
    const ruta = require.resolve('./public/idiomas/' + i + '.js');
    delete require.cache[ruta];
    DIC[i] = preparar(require(ruta));
  });
}
cargar();

const tiene = (o, k) => !!o && Object.prototype.hasOwnProperty.call(o, k);
function limpiar(s) { return String(s).replace(/\s+/g, ' ').trim(); }

/* Traducción de un texto, o null si no la hay. «propias» son las del panel para ese idioma */
function buscar(idioma, s, propias) {
  if (typeof s !== 'string' || !s.trim() || !DIC[idioma]) return null;
  const d = DIC[idioma];
  const limpio = limpiar(s);
  for (const k of [s, limpio]) {
    if (tiene(propias, k) && propias[k]) return propias[k];
    if (tiene(d.textos, k)) return d.textos[k];
  }
  for (const p of d.patrones) {
    const m = p.re.exec(limpio);
    if (!m) continue;
    const valores = {};
    p.nombres.forEach((k, j) => { const v = m[j + 1]; valores[k] = tiene(d.textos, v) ? d.textos[v] : v; });
    return p.destino.replace(/\{(\w+)\}/g, (t, k) => (tiene(valores, k) ? valores[k] : t));
  }
  return null;
}
function traducir(idioma, s, propias) {
  if (idioma === 'es') return s;
  const r = buscar(idioma, s, propias);
  return r === null ? s : r;
}
/* Lo que hay para un idioma en los archivos (para la pestaña «Idiomas» del panel) */
function diccionario(idioma) { return DIC[idioma] ? DIC[idioma].textos : {}; }

/* ---------- La página (index.html y legal.html) ---------- */
function deEntidades(s) {
  return s.replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
}
function aHtml(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function aAtributo(s) { return aHtml(s).replace(/"/g, '&quot;'); }

const RE_ATRIBUTO = /(\s(?:aria-label|placeholder|title|alt|content)=")([^"]*)(")/g;
/* Traduce los textos y algunos atributos (aria-label, placeholder, title, alt y las meta). No toca
   los <script> ni los <style>, ni lo que va dentro de un elemento con translate="no" */
function traducirHtml(html, idioma, propias) {
  if (idioma === 'es') return html;
  let sinTraducir = 0;   // profundidad dentro de translate="no"
  const pila = [];
  return html.replace(/(<(script|style)\b[\s\S]*?<\/\2>)|(<!--[\s\S]*?-->)|(<\/?([a-zA-Z][\w-]*)\b[^>]*>)|([^<]+)/g,
    (todo, bloque, _t, comentario, etiqueta, nombre, texto) => {
      if (bloque || comentario) return todo;
      if (etiqueta) {
        const cierra = etiqueta.charAt(1) === '/';
        const vacia = /\/>$/.test(etiqueta) || /^(br|hr|img|input|meta|link|source|use|path|circle|rect|ellipse|line|polyline|polygon|stop)$/i.test(nombre);
        if (cierra) {
          if (pila.length && pila[pila.length - 1].nombre === nombre) { const x = pila.pop(); if (x.no) sinTraducir--; }
          return etiqueta;
        }
        const no = /\stranslate="no"/.test(etiqueta);
        if (!vacia) { pila.push({ nombre, no }); if (no) sinTraducir++; }
        if (sinTraducir || no) return etiqueta;
        return etiqueta.replace(RE_ATRIBUTO, (t, a, v, b) => {
          const r = buscar(idioma, deEntidades(v), propias);
          return r === null ? t : a + aAtributo(r) + b;
        });
      }
      if (sinTraducir || !/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ¿¡]/.test(texto)) return todo;
      const r = buscar(idioma, deEntidades(texto), propias);
      if (r === null) return todo;
      return texto.match(/^\s*/)[0] + aHtml(r) + texto.match(/\s*$/)[0];
    });
}

/* Enlaces a las páginas de la web: en /gl y /en llevan el prefijo */
const RE_ENLACE = /(\shref=")\/(carta|aviso-legal|privacidad|cookies|legal)?\/?((?:#[^"]*)?)"/g;
function prefijarEnlaces(html, idioma) {
  if (idioma === 'es') return html;
  return html.replace(RE_ENLACE, (t, a, pagina, hash) => a + '/' + idioma + (pagina ? '/' + pagina : '') + hash + '"');
}

/* Idioma y página a partir de la dirección: /gl/carta → { idioma: 'gl', resto: '/carta' } */
function deRuta(pathname) {
  const m = /^\/(gl|en)(\/.*)?$/.exec(pathname);
  if (!m) return { idioma: 'es', resto: pathname, conPrefijo: false };
  return { idioma: m[1], resto: m[2] || '/', conPrefijo: true };
}
function conIdioma(idioma, resto) {
  if (idioma === 'es') return resto || '/';
  return '/' + idioma + (resto && resto !== '/' ? resto : '');
}

/* ---------- El contenido que pinta el JavaScript (/api/contenido?idioma=gl) ---------- */
function traducirContenido(c, idioma, propias) {
  if (idioma === 'es' || !c) return c;
  const x = JSON.parse(JSON.stringify(c));
  const tr = (s) => traducir(idioma, s, propias);
  if (x.carta) {
    (x.carta.categorias || []).forEach((g) => { g.nombre = tr(g.nombre); if (g.desc) g.desc = tr(g.desc); });
    (x.carta.productos || []).forEach((p) => {
      p.nombre = tr(p.nombre);
      if (p.desc) p.desc = tr(p.desc);
      if (Array.isArray(p.etiquetas)) { p.etiquetasOrig = p.etiquetas.slice(); p.etiquetas = p.etiquetas.map(tr); }
    });
  }
  if (x.mes && Array.isArray(x.mes.items)) {
    x.mes.items.forEach((m) => { if (m.etiqueta) m.etiqueta = tr(m.etiqueta); if (m.nombre) m.nombre = tr(m.nombre); if (m.desc) m.desc = tr(m.desc); });
  }
  if (x.galeria && Array.isArray(x.galeria.fotos)) x.galeria.fotos.forEach((f) => { if (f.pie) f.pie = tr(f.pie); });
  if (x.horario && Array.isArray(x.horario.dias)) x.horario.dias.forEach((d) => { if (d.texto) d.texto = tr(d.texto); });
  if (x.datos) {
    if (x.datos.club && x.datos.club.premio) x.datos.club.premio = tr(x.datos.club.premio);
    if (Array.isArray(x.datos.zonas)) x.datos.zonas.forEach((z) => { z.nombre = tr(z.nombre); });
  }
  if (x.textos) {
    if (Array.isArray(x.textos.menu)) x.textos.menu.forEach((m) => { m.texto = tr(m.texto); });
    const t = x.textos.textos || {};
    Object.keys(t).forEach((k) => { t[k] = tr(t[k]); });
  }
  if (x.textosBase) Object.keys(x.textosBase).forEach((k) => { x.textosBase[k] = tr(x.textosBase[k]); });
  return x;
}

module.exports = {
  IDIOMAS, OTROS, NOMBRES, CORTOS, LOCALES,
  buscar, traducir, diccionario, traducirHtml, prefijarEnlaces, deRuta, conIdioma, traducirContenido, recargar: cargar
};
