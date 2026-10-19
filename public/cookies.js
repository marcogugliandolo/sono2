/* SOÑO · aviso de cookies con «Aceptar» y «Rechazar»
   Ahora mismo la web solo usa cookies técnicas (la sesión de la tarjeta del club y la del panel),
   que no se pueden rechazar porque sin ellas no funcionaría lo que pide el propio usuario
   (artículo 22.2 de la LSSI). El aviso pregunta por las demás, las opcionales: hoy no hay ninguna,
   pero la elección se guarda un año y queda lista para cuando se añadan.

   Si algún día se añade algo opcional (Google Analytics, el píxel de Meta, un mapa o un vídeo
   de otra empresa), hay que cargarlo SOLO si window.sonoCookies.eleccion() === 'aceptadas',
   o al recibir el evento «sono:cookies» con detail.eleccion === 'aceptadas'.

   Los dos botones tienen el mismo aspecto (así lo pide la guía de la AEPD) y la elección se puede
   cambiar cuando se quiera con «Configurar cookies», en el pie de la web.

   La galleta: al pulsar cualquiera de los dos botones se la comen a mordiscos rápidos,
   caen las migas y el aviso se va. Con «reducir movimiento» se cierra sin animación. */
(function () {
  'use strict';
  var CLAVE = 'sono2-cookies';
  var CLAVE_VIEJA = 'sono2-aviso-cookies';          // la del aviso antiguo, que solo informaba
  var VIGENCIA = 365 * 86400000;                    // pasado un año se vuelve a preguntar
  var enMemoria = null;                             // por si el navegador no deja guardar nada

  function leer() {
    try {
      var v = JSON.parse(localStorage.getItem(CLAVE) || 'null');
      if (v && (v.eleccion === 'aceptadas' || v.eleccion === 'rechazadas') && Date.now() - v.fecha < VIGENCIA) return v;
    } catch (e) { /* sin almacenamiento */ }
    return enMemoria;
  }
  function guardar(eleccion) {
    enMemoria = { eleccion: eleccion, fecha: Date.now() };
    try {
      localStorage.setItem(CLAVE, JSON.stringify(enMemoria));
      localStorage.removeItem(CLAVE_VIEJA);
    } catch (e) { /* sin almacenamiento: vale para esta visita */ }
    var evento;
    try { evento = new CustomEvent('sono:cookies', { detail: { eleccion: eleccion } }); } catch (e) { evento = null; }
    if (evento) document.dispatchEvent(evento);
  }

  window.sonoCookies = {
    eleccion: function () { var v = leer(); return v ? v.eleccion : null; },
    configurar: function () { mostrar(); }
  };

  /* ---------- La galleta ----------
     Masa con pepitas y un mordisco ya dado. Al cerrar aparecen los demás mordiscos, uno tras otro;
     cada mordisco tiene su borde dibujado a línea, tapado donde lo cubren los otros. */
  var COOKIE = { x: 38, y: 40, r: 27 };
  var YA = { x: 62, y: 19, r: 10 };
  var MORDISCOS = [
    { x: 67, y: 41, r: 12 },
    { x: 51, y: 64, r: 14 },
    { x: 23, y: 61, r: 14 },
    { x: 11, y: 34, r: 14 },
    { x: 36, y: 13, r: 13 }
  ];
  var PASO = 80;                                     // milisegundos entre mordisco y mordisco
  var MIGAS = [
    { x: 74, y: 30, r: 1.3, fija: true }, { x: 71, y: 8, r: 1, fija: true },
    { x: 73, y: 50, r: 1.6, dx: 4, d: 0 }, { x: 64, y: 54, r: 1.2, dx: -3, d: 30 },
    { x: 58, y: 72, r: 1.5, dx: 3, d: 90 }, { x: 45, y: 74, r: 1.1, dx: -2, d: 110 },
    { x: 21, y: 74, r: 1.4, dx: -3, d: 170 }, { x: 12, y: 64, r: 1.1, dx: -5, d: 190 },
    { x: 7, y: 42, r: 1.3, dx: -4, d: 250 }, { x: 30, y: 9, r: 1.2, dx: 2, d: 330 },
    { x: 44, y: 8, r: 1, dx: 4, d: 340 }
  ];
  var PEPITAS = [
    'M24 29.5 c1.6-1.4 4.2-0.8 4.4 1.2 c0.2 2-2 3.2-3.8 2.4 c-1.4-0.6-1.8-2.4-0.6-3.6 Z',
    'M39 23 c1.4-0.8 3.4 0 3.2 1.8 c-0.2 1.6-2.2 2.2-3.4 1.2 c-0.8-0.8-0.8-2.4 0.2-3 Z',
    'M45 38.5 c1.8-1 4.2 0.2 3.8 2.4 c-0.4 1.8-2.8 2.4-4.2 1.2 c-1-0.8-0.8-2.8 0.4-3.6 Z',
    'M28.5 46 c1.6-0.8 3.6 0.4 3.2 2.2 c-0.4 1.6-2.6 2-3.6 0.8 c-0.8-0.8-0.6-2.4 0.4-3 Z',
    'M41 53 c1.2-0.6 2.8 0.2 2.6 1.6 c-0.2 1.2-1.8 1.6-2.8 0.8 c-0.6-0.6-0.4-1.8 0.2-2.4 Z',
    'M57.5 38.5 c1.2-0.6 2.8 0.2 2.6 1.6 c-0.2 1.2-1.8 1.6-2.8 0.8 c-0.6-0.6-0.4-1.8 0.2-2.4 Z',
    'M17.5 39 c1-0.6 2.4 0 2.2 1.2 c-0.2 1-1.6 1.4-2.4 0.6 c-0.4-0.4-0.4-1.4 0.2-1.8 Z'
  ];

  function circulo(c, atributos) {
    return '<circle cx="' + c.x + '" cy="' + c.y + '" r="' + c.r + '"' + (atributos || '') + '/>';
  }
  function mordisco(i, clase, relleno) {
    return circulo(MORDISCOS[i], (relleno ? ' fill="#000"' : '') + ' class="' + clase + '" style="--retraso:' + (i * PASO) + 'ms"');
  }
  // Máscara con todos los mordiscos menos uno (el que se está dibujando)
  function mascara(id, menos) {
    var s = '<mask id="' + id + '" maskUnits="userSpaceOnUse" x="-10" y="-10" width="100" height="100">' +
      '<rect x="-10" y="-10" width="100" height="100" fill="#fff"/>';
    if (menos !== 'ya') s += circulo(YA, ' fill="#000"');
    MORDISCOS.forEach(function (m, i) { if (menos !== i) s += mordisco(i, 'galleta__mordisco', true); });
    return s + '</mask>';
  }
  function dibujoGalleta() {
    var defs = mascara('galleta-m', null) + mascara('galleta-m-ya', 'ya') +
      MORDISCOS.map(function (m, i) { return mascara('galleta-m-' + i, i); }).join('') +
      '<clipPath id="galleta-borde">' + circulo(COOKIE) + '</clipPath>';
    var masa = '<g mask="url(#galleta-m)">' + circulo(COOKIE, ' class="trazo galleta__masa"') +
      PEPITAS.map(function (d) { return '<path class="galleta__pepita" d="' + d + '"/>'; }).join('') + '</g>';
    var bordes = '<g clip-path="url(#galleta-borde)">' +
      '<g mask="url(#galleta-m-ya)">' + circulo(YA, ' class="trazo"') + '</g>' +
      MORDISCOS.map(function (m, i) { return '<g mask="url(#galleta-m-' + i + ')">' + mordisco(i, 'trazo galleta__mordisco') + '</g>'; }).join('') +
      '</g>';
    var migas = MIGAS.map(function (m) {
      return m.fija
        ? circulo(m, ' class="galleta__miga galleta__miga--fija"')
        : circulo(m, ' class="galleta__miga galleta__miga--cae" style="--x:' + m.dx + 'px;--d:' + m.d + 'ms"');
    }).join('');
    return '<svg class="aviso-cookies__dibujo galleta" viewBox="7 5 72 72" aria-hidden="true" focusable="false">' +
      '<defs>' + defs + '</defs><g class="galleta__cuerpo">' + masa + bordes + '</g>' + migas + '</svg>';
  }

  /* ---------- El aviso ---------- */
  var caja = null;
  var reducido = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fCorta = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long' });

  function mostrar() {
    if (caja) return;
    var actual = leer();
    caja = document.createElement('div');
    caja.className = 'aviso-cookies';
    caja.setAttribute('role', 'region');
    caja.setAttribute('aria-labelledby', 'aviso-cookies-titulo');
    caja.innerHTML = dibujoGalleta() +
      '<div class="aviso-cookies__cuerpo">' +
        '<p class="aviso-cookies__titulo" id="aviso-cookies-titulo">Cookies, solo las justas</p>' +
        '<p class="aviso-cookies__texto">Usamos las técnicas, necesarias para que la web funcione. Las demás, solo si las aceptas. ' +
          '<a class="aviso-cookies__enlace" href="/cookies">Más información</a></p>' +
        (actual ? '<p class="aviso-cookies__actual"></p>' : '') +
        '<div class="aviso-cookies__acciones">' +
          '<button type="button" class="boton boton--lleno boton--mini aviso-cookies__boton" data-eleccion="aceptadas">Aceptar</button>' +
          '<button type="button" class="boton boton--lleno boton--mini aviso-cookies__boton" data-eleccion="rechazadas">Rechazar</button>' +
        '</div>' +
      '</div>';
    if (actual) {
      caja.querySelector('.aviso-cookies__actual').textContent =
        'El ' + fCorta.format(new Date(actual.fecha)) + ' elegiste «' + (actual.eleccion === 'aceptadas' ? 'Aceptar' : 'Rechazar') + '».';
    }
    caja.querySelectorAll('[data-eleccion]').forEach(function (b) {
      b.addEventListener('click', function () { elegir(b.getAttribute('data-eleccion')); });
    });
    document.body.appendChild(caja);
    if (actual) caja.querySelector('[data-eleccion]').focus({ preventScroll: true });
  }

  function elegir(eleccion) {
    var c = caja;
    if (!c || c.classList.contains('comiendo')) return;
    guardar(eleccion);
    c.querySelectorAll('button').forEach(function (b) { b.disabled = true; });
    c.querySelector('[data-eleccion="' + eleccion + '"]').classList.add('es-elegido');
    caja = null;
    if (reducido) {
      c.classList.add('se-va');
      setTimeout(function () { quitar(c); }, 250);
      return;
    }
    c.classList.add('comiendo');                                   // ñam: mordiscos, migas y adiós
    setTimeout(function () { c.classList.add('se-va'); }, MORDISCOS.length * PASO + 260);
    setTimeout(function () { quitar(c); }, MORDISCOS.length * PASO + 600);
  }
  function quitar(c) { if (c.parentNode) c.parentNode.removeChild(c); }

  // «Configurar cookies» (en el pie): vuelve a abrir el aviso para cambiar la elección
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-configurar-cookies]');
    if (!b) return;
    e.preventDefault();
    mostrar();
  });

  if (!leer()) mostrar();
})();
