/* SOÑO · aviso de cookies
   La web solo usa cookies técnicas (la sesión de la tarjeta del club y la del panel). Esas cookies
   no necesitan consentimiento (artículo 22.2 de la LSSI), así que el aviso solo informa:
   sale la primera vez, se cierra con «Entendido» y no vuelve a salir en ese navegador.
   Si algún día se añaden cookies de estadísticas o de otras empresas, habrá que pedir permiso antes.

   El aviso es una tarjeta beige con una galleta dibujada a línea, como las ilustraciones de la web.
   Al pulsar «Entendido», la galleta se lleva otro mordisco (caen unas migas) y el aviso se va. */
(function () {
  'use strict';
  var CLAVE = 'sono2-aviso-cookies';

  function yaVisto() {
    try { return localStorage.getItem(CLAVE) === '1'; } catch (e) { return false; }
  }
  function recordar() {
    try { localStorage.setItem(CLAVE, '1'); } catch (e) { /* sin almacenamiento: volverá a salir, sin más */ }
  }
  // En la propia política de cookies no hace falta
  if (yaVisto() || location.pathname === '/cookies') return;

  /* La galleta: masa con pepitas, un mordisco ya dado y otro que aparece al cerrar */
  var GALLETA =
    '<svg class="aviso-cookies__dibujo galleta" viewBox="7 5 72 72" aria-hidden="true" focusable="false">' +
      '<defs>' +
        '<mask id="galleta-mordiscos" maskUnits="userSpaceOnUse" x="0" y="0" width="80" height="80">' +
          '<rect width="80" height="80" fill="#fff"/>' +
          '<circle cx="62" cy="19" r="10" fill="#000"/>' +
          '<circle class="galleta__mordisco-nuevo" cx="67" cy="37" r="9" fill="#000"/>' +
        '</mask>' +
        '<clipPath id="galleta-borde"><circle cx="38" cy="40" r="27"/></clipPath>' +
      '</defs>' +
      '<g mask="url(#galleta-mordiscos)">' +
        '<circle class="trazo galleta__masa" cx="38" cy="40" r="27"/>' +
        '<path class="galleta__pepita" d="M24 29.5 c1.6-1.4 4.2-0.8 4.4 1.2 c0.2 2-2 3.2-3.8 2.4 c-1.4-0.6-1.8-2.4-0.6-3.6 Z"/>' +
        '<path class="galleta__pepita" d="M39 23 c1.4-0.8 3.4 0 3.2 1.8 c-0.2 1.6-2.2 2.2-3.4 1.2 c-0.8-0.8-0.8-2.4 0.2-3 Z"/>' +
        '<path class="galleta__pepita" d="M45 38.5 c1.8-1 4.2 0.2 3.8 2.4 c-0.4 1.8-2.8 2.4-4.2 1.2 c-1-0.8-0.8-2.8 0.4-3.6 Z"/>' +
        '<path class="galleta__pepita" d="M28.5 46 c1.6-0.8 3.6 0.4 3.2 2.2 c-0.4 1.6-2.6 2-3.6 0.8 c-0.8-0.8-0.6-2.4 0.4-3 Z"/>' +
        '<path class="galleta__pepita" d="M41 53 c1.2-0.6 2.8 0.2 2.6 1.6 c-0.2 1.2-1.8 1.6-2.8 0.8 c-0.6-0.6-0.4-1.8 0.2-2.4 Z"/>' +
        '<path class="galleta__pepita" d="M57.5 38.5 c1.2-0.6 2.8 0.2 2.6 1.6 c-0.2 1.2-1.8 1.6-2.8 0.8 c-0.6-0.6-0.4-1.8 0.2-2.4 Z"/>' +
        '<path class="galleta__pepita" d="M17.5 39 c1-0.6 2.4 0 2.2 1.2 c-0.2 1-1.6 1.4-2.4 0.6 c-0.4-0.4-0.4-1.4 0.2-1.8 Z"/>' +
      '</g>' +
      '<g clip-path="url(#galleta-borde)">' +
        '<circle class="trazo" cx="62" cy="19" r="10"/>' +
        '<circle class="trazo galleta__mordisco-nuevo" cx="67" cy="37" r="9"/>' +
      '</g>' +
      '<circle class="galleta__miga galleta__miga--fija" cx="74" cy="28" r="1.3"/>' +
      '<circle class="galleta__miga galleta__miga--fija" cx="71" cy="8" r="1"/>' +
      '<circle class="galleta__miga galleta__miga--cae" cx="70" cy="49" r="1.6" style="--x:3px;--d:0s"/>' +
      '<circle class="galleta__miga galleta__miga--cae" cx="64" cy="51" r="1.2" style="--x:-4px;--d:.06s"/>' +
      '<circle class="galleta__miga galleta__miga--cae" cx="75" cy="44" r="1.1" style="--x:6px;--d:.1s"/>' +
    '</svg>';

  var caja = document.createElement('div');
  caja.className = 'aviso-cookies';
  caja.setAttribute('role', 'region');
  caja.setAttribute('aria-labelledby', 'aviso-cookies-titulo');
  caja.innerHTML = GALLETA +
    '<div class="aviso-cookies__cuerpo">' +
      '<p class="aviso-cookies__titulo" id="aviso-cookies-titulo">Cookies, solo las justas</p>' +
      '<p class="aviso-cookies__texto">Las necesarias para que la web funcione. Nada de publicidad ni estadísticas.</p>' +
      '<div class="aviso-cookies__acciones">' +
        '<button type="button" class="boton boton--lleno boton--mini">Entendido</button>' +
        '<a class="aviso-cookies__enlace" href="/cookies">Más información</a>' +
      '</div>' +
    '</div>';

  var boton = caja.querySelector('button');
  var enlace = caja.querySelector('a');
  var reducido = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function cerrarAviso() {
    recordar();
    boton.disabled = true;
    caja.classList.add('mordiendo');                                  // otro mordisco y caen las migas
    setTimeout(function () { caja.classList.add('se-va'); }, reducido ? 0 : 560);
    setTimeout(function () { if (caja.parentNode) caja.parentNode.removeChild(caja); }, reducido ? 250 : 900);
  }
  boton.addEventListener('click', cerrarAviso);
  enlace.addEventListener('click', recordar);

  document.body.appendChild(caja);
})();
