/* SOÑO · la web en gallego o en inglés
   El servidor ya manda la página traducida. Aquí se traduce lo que pinta el JavaScript después
   (la carta, las ventanas, los avisos, Soñito…): cada texto que aparece se busca en el diccionario
   (/idiomas/gl.js o /idiomas/en.js) y, si está, se cambia. Lo que no está se queda en castellano.
   No se traduce lo que escribe la gente (reseñas, nombres…): esas partes llevan translate="no".
   Este archivo solo se carga en /gl y /en; en castellano no hace nada. */
(function () {
  'use strict';
  var D = window.SONO_TEXTOS;
  if (!D || !D.idioma) return;

  var idioma = D.idioma;
  var prefijo = '/' + idioma;
  var textos = D.textos || {};
  var tiene = Object.prototype.hasOwnProperty;

  /* Plantillas con huecos: «Mesa para {n}». {n}, {m} y {k} son números; el resto, cualquier texto */
  var NUMERICOS = { n: 1, m: 1, k: 1 };
  var patrones = Object.keys(D.patrones || {}).map(function (es) {
    var nombres = [];
    var fuente = es.split(/\{(\w+)\}/).map(function (trozo, i) {
      if (i % 2) { nombres.push(trozo); return NUMERICOS[trozo] ? '(\\d+(?:[.,]\\d+)?)' : '(.+?)'; }
      return trozo.replace(/[.*+?^$()|[\]\\{}]/g, '\\$&');
    }).join('');
    return { re: new RegExp('^' + fuente + '$'), nombres: nombres, destino: D.patrones[es], fijo: es.replace(/\{\w+\}/g, '').length };
  }).sort(function (a, b) { return b.fijo - a.fijo; });   // primero las más concretas

  function exacto(s) { return tiene.call(textos, s) ? textos[s] : null; }
  function poner(plantilla, valores) {
    return String(plantilla).replace(/\{(\w+)\}/g, function (t, k) { return valores && tiene.call(valores, k) ? valores[k] : t; });
  }
  /* Un texto entero: primero tal cual y si no, con las plantillas */
  function traducir(s) {
    var limpio = String(s).replace(/\s+/g, ' ').trim();
    if (!limpio) return null;
    var r = exacto(limpio);
    if (r !== null) return r;
    for (var i = 0; i < patrones.length; i++) {
      var m = patrones[i].re.exec(limpio);
      if (!m) continue;
      var valores = {};
      patrones[i].nombres.forEach(function (k, j) { var v = m[j + 1]; var x = exacto(v); valores[k] = x !== null ? x : v; });
      return poner(patrones[i].destino, valores);
    }
    return null;
  }
  /* Para el código: t('Mesa para {n}', { n: 2 }) */
  function t(plantilla, valores) {
    var r = exacto(plantilla);
    return poner(r !== null ? r : plantilla, valores);
  }

  /* Enlaces a las páginas de la web: llevan delante /gl o /en */
  var RE_PAGINA = /^\/(carta|aviso-legal|privacidad|cookies|legal)?\/?(?=$|[#?])/;
  function ruta(r) {
    r = String(r || '/');
    if (r.indexOf(prefijo + '/') === 0 || r === prefijo) return r;
    var m = RE_PAGINA.exec(r);
    if (!m) return r;
    return prefijo + (m[1] ? '/' + m[1] : '') + r.slice(m[0].length);
  }

  /* ---------- Traducir lo que aparece en la página ---------- */
  var SALTAR = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, NOSCRIPT: 1 };
  var ATRIBUTOS = ['aria-label', 'placeholder', 'title', 'alt'];
  var puestos = typeof WeakMap === 'function' ? new WeakMap() : null;   // lo que ya se tradujo, para no darle vueltas

  function excluido(nodo) {
    var e = nodo.nodeType === 1 ? nodo : nodo.parentElement;
    if (!e) return true;
    if (SALTAR[e.tagName]) return true;
    return !!(e.closest && e.closest('[translate="no"], [contenteditable="true"]'));
  }
  function traducirTexto(nodo) {
    var v = nodo.nodeValue;
    if (!v || !/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ¿¡]/.test(v)) return;
    if (puestos && puestos.get(nodo) === v) return;
    if (excluido(nodo)) return;
    var r = traducir(v);
    if (r === null) return;
    var nuevo = v.match(/^\s*/)[0] + r + v.match(/\s*$/)[0];
    if (puestos) puestos.set(nodo, nuevo);
    if (nuevo !== v) nodo.nodeValue = nuevo;
  }
  function traducirAtributo(e, nombre) {
    if (nombre === 'href') {
      if (e.hasAttribute('data-idioma')) return;   // el selector de idioma ya lleva sus enlaces
      var h = e.getAttribute('href');
      if (e.tagName === 'A' && h && h.charAt(0) === '/') { var n = ruta(h); if (n !== h) e.setAttribute('href', n); }
      return;
    }
    var v = e.getAttribute(nombre);
    if (!v || excluido(e)) return;
    var r = traducir(v);
    if (r !== null && r !== v) e.setAttribute(nombre, r);
  }
  function recorrer(raiz) {
    if (raiz.nodeType === 3) { traducirTexto(raiz); return; }
    if (raiz.nodeType !== 1 && raiz.nodeType !== 11) return;
    if (raiz.nodeType === 1) {
      if (SALTAR[raiz.tagName] || (raiz.closest && raiz.closest('[translate="no"]'))) return;
      ATRIBUTOS.concat('href').forEach(function (a) { if (raiz.hasAttribute(a)) traducirAtributo(raiz, a); });
    }
    var w = document.createTreeWalker(raiz, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        if (n.nodeType === 1 && (SALTAR[n.tagName] || n.getAttribute('translate') === 'no')) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    var n;
    while ((n = w.nextNode())) {
      if (n.nodeType === 3) traducirTexto(n);
      else ATRIBUTOS.concat('href').forEach(function (a) { if (n.hasAttribute(a)) traducirAtributo(n, a); });
    }
  }

  new MutationObserver(function (cambios) {
    cambios.forEach(function (c) {
      if (c.type === 'characterData') traducirTexto(c.target);
      else if (c.type === 'attributes') traducirAtributo(c.target, c.attributeName);
      else c.addedNodes.forEach(recorrer);
    });
  }).observe(document.documentElement, {
    subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATRIBUTOS.concat('href')
  });
  recorrer(document.documentElement);   // por si algo se quedó sin traducir en el servidor

  /* Fechas: con Intl si el navegador trae el idioma; si no (algunos móviles no traen el gallego),
     con los nombres de aquí. Admite las combinaciones que usa la web */
  var GL = {
    meses: ['xaneiro', 'febreiro', 'marzo', 'abril', 'maio', 'xuño', 'xullo', 'agosto', 'setembro', 'outubro', 'novembro', 'decembro'],
    mesesCortos: ['xan.', 'feb.', 'mar.', 'abr.', 'mai.', 'xuñ.', 'xul.', 'ago.', 'set.', 'out.', 'nov.', 'dec.'],
    dias: ['domingo', 'luns', 'martes', 'mércores', 'xoves', 'venres', 'sábado'],
    diasCortos: ['dom.', 'luns', 'mar.', 'mér.', 'xov.', 'ven.', 'sáb.']
  };
  var locale = D.locale || idioma;
  var intlVale = (function () {
    try {
      return Intl.DateTimeFormat.supportedLocalesOf([locale]).length > 0 &&
        new Intl.DateTimeFormat(locale, { month: 'long' }).format(new Date(2020, 0, 15)) !== 'January';
    } catch (e) { return false; }
  })();
  function fecha(o) {
    if (idioma !== 'gl' || intlVale) return new Intl.DateTimeFormat(locale, o);
    return {
      format: function (d) {
        d = d instanceof Date ? d : new Date(d);
        var dia = d.getDate(), mes = d.getMonth(), anio = d.getFullYear();
        var dos = function (n) { return (n < 10 ? '0' : '') + n; };
        if (o.day === '2-digit') return dos(dia) + '/' + dos(mes + 1) + '/' + anio;
        var trozos = [];
        if (o.day) trozos.push(String(dia));
        if (o.month) trozos.push(o.month === 'short' ? GL.mesesCortos[mes] : GL.meses[mes]);
        if (o.year) trozos.push(String(anio));
        var texto = trozos.join(' de ');
        if (o.weekday) {
          var sem = o.weekday === 'short' ? GL.diasCortos[d.getDay()] : GL.dias[d.getDay()];
          texto = texto ? sem + ', ' + texto : sem;
        }
        if (o.hour) texto += ', ' + dos(d.getHours()) + ':' + dos(d.getMinutes());
        return texto;
      }
    };
  }

  window.sonoIdioma = {
    idioma: idioma,
    locale: locale,
    fecha: fecha,
    t: t,
    traducir: function (s) { var r = traducir(s); return r === null ? s : r; },
    ruta: ruta
  };
})();
