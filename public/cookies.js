/* SOÑO · aviso de cookies
   La web solo usa cookies técnicas (la sesión de la tarjeta del club y la del panel). Esas cookies
   no necesitan consentimiento (artículo 22.2 de la LSSI), así que el aviso solo informa:
   sale la primera vez, se cierra con «Entendido» y no vuelve a salir en ese navegador.
   Si algún día se añaden cookies de estadísticas o de otras empresas, habrá que pedir permiso antes. */
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

  var caja = document.createElement('div');
  caja.className = 'aviso-cookies';
  caja.setAttribute('role', 'region');
  caja.setAttribute('aria-label', 'Aviso de cookies');

  var texto = document.createElement('p');
  texto.className = 'aviso-cookies__texto';
  texto.appendChild(document.createTextNode('Solo usamos cookies técnicas, las necesarias para que la web funcione. Nada de publicidad ni estadísticas.'));
  caja.appendChild(texto);

  var acciones = document.createElement('div');
  acciones.className = 'aviso-cookies__acciones';
  var boton = document.createElement('button');
  boton.type = 'button';
  boton.className = 'boton boton--lleno boton--mini';
  boton.textContent = 'Entendido';
  var enlace = document.createElement('a');
  enlace.href = '/cookies';
  enlace.className = 'aviso-cookies__enlace';
  enlace.textContent = 'Más información';
  acciones.appendChild(boton);
  acciones.appendChild(enlace);
  caja.appendChild(acciones);

  function cerrarAviso() {
    recordar();
    caja.classList.add('se-va');
    setTimeout(function () { if (caja.parentNode) caja.parentNode.removeChild(caja); }, 260);
  }
  boton.addEventListener('click', cerrarAviso);
  enlace.addEventListener('click', recordar);

  document.body.appendChild(caja);
})();
