/* SOÑO · lógica de la web y del panel */
(function () {
  'use strict';

  /* Logo: copia el dibujo dentro de cada <svg class="logo"> para que el café de la Ñ
     se pueda animar en todos los navegadores (dentro de <use> algunos no lo animan). */
  (function () {
    var simbolo = document.getElementById('logo-sono');
    if (!simbolo) return;
    document.querySelectorAll('svg.logo > use').forEach(function (u) {
      var svg = u.parentNode;
      svg.setAttribute('viewBox', simbolo.getAttribute('viewBox'));
      Array.prototype.forEach.call(simbolo.childNodes, function (n) { svg.appendChild(n.cloneNode(true)); });
      svg.removeChild(u);
    });
  })();

  /* ---------- Constantes ---------- */
  /* Dibujos que se pueden elegir para cada grupo de la carta */
  var ICONOS = [
    { id: 'taza', nombre: 'Taza' }, { id: 'vaso', nombre: 'Vaso' }, { id: 'vaso-alto', nombre: 'Vaso alto' },
    { id: 'coldbrew', nombre: 'Café frío' }, { id: 'cruasan', nombre: 'Cruasán' }, { id: 'tostada', nombre: 'Tostada' },
    { id: 'bol', nombre: 'Bol' }, { id: 'bizcocho', nombre: 'Bizcocho' }, { id: 'filtro', nombre: 'Filtro' },
    { id: 'prensa', nombre: 'Prensa francesa' }, { id: 'chemex', nombre: 'Chemex' }, { id: 'llevar', nombre: 'Para llevar' }
  ];
  var MAX_GRUPOS = 12;
  var DIAS_SEMANA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  var PIES_GALERIA = ['El local', 'La barra', 'Latte art', 'Desayunos', 'Buenos ratos'];
  var CLAVE_DE = { carta: 'carta', fotos: 'galeria', horarios: 'horario', datos: 'datos' };
  var RE_PRECIO = /^\d{1,3}([.,]\d{1,2})?$/;
  var RE_HORA = /^([01]\d|2[0-3]):[0-5]\d$/;
  var ALERGENOS = [
    { id: 'gluten', nombre: 'Gluten' },
    { id: 'crustaceos', nombre: 'Crustáceos' },
    { id: 'huevos', nombre: 'Huevos' },
    { id: 'pescado', nombre: 'Pescado' },
    { id: 'cacahuetes', nombre: 'Cacahuetes' },
    { id: 'soja', nombre: 'Soja' },
    { id: 'lacteos', nombre: 'Lácteos' },
    { id: 'frutos', nombre: 'Frutos de cáscara' },
    { id: 'apio', nombre: 'Apio' },
    { id: 'mostaza', nombre: 'Mostaza' },
    { id: 'sesamo', nombre: 'Sésamo' },
    { id: 'sulfitos', nombre: 'Sulfitos' },
    { id: 'altramuces', nombre: 'Altramuces' },
    { id: 'moluscos', nombre: 'Moluscos' }
  ];

  /* ---------- Estado ---------- */
  var estado = { carta: null, galeria: null, horario: null, datos: null };
  var cargado = false;
  var sinDatos = false;

  /* ---------- Utilidades ---------- */
  function $(id) { return document.getElementById(id); }
  function el(tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt !== undefined && txt !== null) e.textContent = txt;
    return e;
  }
  function svgUso(simbolo) {
    var ns = 'http://www.w3.org/2000/svg';
    var s = document.createElementNS(ns, 'svg');
    s.setAttribute('viewBox', '0 0 100 100');
    s.setAttribute('aria-hidden', 'true');
    var u = document.createElementNS(ns, 'use');
    u.setAttribute('href', '#i-' + simbolo);
    s.appendChild(u);
    return s;
  }
  function urlFoto(id) { return '/fotos/' + id; }
  function pendiente(t) { return el('span', 'pendiente', t || 'Por confirmar'); }
  function clonar(o) { return JSON.parse(JSON.stringify(o)); }
  function texto(v) { return typeof v === 'string' ? v.trim() : ''; }
  function dos(n) { return (n < 10 ? '0' : '') + n; }
  function precioBonito(p) {
    var t = texto(p).replace('.', ',');
    if (!t) return '';
    if (t.indexOf(',') === -1) t += ',00';
    else if (t.split(',')[1].length === 1) t += '0';
    return t + '\u00a0€';
  }
  function precioNum(p) { return Number(texto(p).replace(',', '.')) || 0; }
  function euros(n) { return n.toFixed(2).replace('.', ',') + '\u00a0€'; }
  function svgAlergeno(id) {
    var ns = 'http://www.w3.org/2000/svg';
    var s = document.createElementNS(ns, 'svg');
    s.setAttribute('viewBox', '0 0 24 24');
    s.setAttribute('aria-hidden', 'true');
    var u = document.createElementNS(ns, 'use');
    u.setAttribute('href', '#al-' + id);
    s.appendChild(u);
    return s;
  }
  function categorias() {
    return (estado.carta && Array.isArray(estado.carta.categorias)) ? estado.carta.categorias : [];
  }
  function nombreGrupo(lista, id) {
    var g = lista.filter(function (c) { return c.id === id; })[0];
    return g ? g.nombre : '';
  }
  /* Productos en el orden en que salen en la carta (grupo a grupo) */
  function productos() {
    var todos = (estado.carta && Array.isArray(estado.carta.productos)) ? estado.carta.productos : [];
    var orden = [];
    categorias().forEach(function (c) {
      todos.forEach(function (p) { if (p.cat === c.id) orden.push(p); });
    });
    return orden;
  }

  /* Llamadas al servidor */
  function api(metodo, ruta, datos, opciones) {
    var cabeceras = { 'X-Requested-With': 'sono' };
    var cuerpo;
    if (opciones && opciones.binario) {
      cabeceras['Content-Type'] = datos.type || 'application/octet-stream';
      cuerpo = datos;
    } else if (datos !== undefined) {
      cabeceras['Content-Type'] = 'application/json';
      cuerpo = JSON.stringify(datos);
    }
    return fetch(ruta, { method: metodo, headers: cabeceras, body: cuerpo, credentials: 'same-origin' })
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (j) {
          if (!r.ok) {
            var e = new Error(j.error || 'No se ha podido completar. Inténtalo de nuevo.');
            e.status = r.status;
            throw e;
          }
          return j;
        });
      }, function () {
        var e = new Error('No hay conexión con el servidor. Revisa tu conexión e inténtalo de nuevo.');
        e.status = 0;
        throw e;
      });
  }

  function pintarTodo() {
    pintarCarta();
    pintarGaleria();
    pintarHorario();
    pintarDatos();
    pintarLineas();
    pintarRecogida();
  }

  /* ---------- Ventanas emergentes ---------- */
  var raiz = document.documentElement;
  function abrir(dialogo) {
    document.querySelectorAll('dialog[open]').forEach(function (d) { if (d !== dialogo) d.close(); });
    if (!dialogo.open) {
      if (typeof dialogo.showModal === 'function') dialogo.showModal();
      else dialogo.setAttribute('open', '');
    }
    raiz.classList.add('modal-abierto');
  }
  function cerrar(dialogo) {
    if (typeof dialogo.close === 'function') dialogo.close();
    else dialogo.removeAttribute('open');
  }
  document.querySelectorAll('dialog').forEach(function (d) {
    d.addEventListener('close', function () {
      if (!document.querySelector('dialog[open]')) raiz.classList.remove('modal-abierto');
    });
    d.addEventListener('click', function (e) { if (e.target === d) cerrar(d); });
    d.querySelectorAll('[data-cerrar]').forEach(function (b) {
      b.addEventListener('click', function () { cerrar(d); });
    });
  });

  var modalReserva = $('modal-reserva');
  var modalProducto = $('modal-producto');
  var modalLogin = $('modal-login');
  var modalAdmin = $('modal-admin');

  document.querySelectorAll('[data-abrir-reserva]').forEach(function (a) {
    a.addEventListener('click', function (e) { e.preventDefault(); abrir(modalReserva); });
  });

  /* ---------- Carta pública ---------- */
  /* Arriba, 4 favoritos en tarjetas; debajo, una caja por grupo con sus precios.
     Favoritos: primero los productos con la etiqueta «Favorito»; el resto se completa con uno
     de cada grupo (antes los que tienen foto). */
  var MAX_FAVORITOS = 4;
  function favoritos(lista) {
    var marcados = lista.filter(function (p) {
      return (Array.isArray(p.etiquetas) ? p.etiquetas : []).some(function (t) { return /^favorit/i.test(texto(t)); });
    });
    var porGrupo = categorias().map(function (c) { return lista.filter(function (p) { return p.cat === c.id; }); });
    var ronda = [];
    for (var r = 0; r < 50; r++) {
      var alguno = false;
      porGrupo.forEach(function (g) { if (g[r]) { ronda.push(g[r]); alguno = true; } });
      if (!alguno) break;
    }
    var conFoto = ronda.filter(function (p) { return p.foto; });
    var sinFoto = ronda.filter(function (p) { return !p.foto; });
    // Primero los marcados; si son menos de 4, se completan con el resto
    var resto = conFoto.concat(sinFoto).filter(function (p) { return marcados.indexOf(p) === -1; });
    return marcados.concat(resto).slice(0, MAX_FAVORITOS);
  }
  function abrirProducto(i) { mostrarProducto(i); abrir(modalProducto); }
  function etiquetaProducto(p) { return (p.nombre || 'Producto') + ', ' + precioBonito(p.precio) + '. Ver detalles'; }
  function animarLista(nodo) {
    nodo.classList.remove('entra');
    void nodo.offsetWidth;
    nodo.classList.add('entra');
  }

  function pintarCarta() {
    var lista = productos();
    var cont = $('carta-grupos');
    var favs = $('carta-favoritos');
    cont.innerHTML = '';
    favs.innerHTML = '';
    if (!cargado) { cont.appendChild(el('p', 'estado-vacio', 'Cargando la carta…')); return; }
    if (sinDatos) { cont.appendChild(el('p', 'estado-vacio', 'No se ha podido cargar la carta. Recarga la página en unos segundos.')); return; }
    var grupos = categorias();
    if (!grupos.length) { cont.appendChild(el('p', 'estado-vacio', 'Muy pronto podrás ver aquí nuestra carta.')); return; }

    favoritos(lista).forEach(function (p, n) {
      var i = lista.indexOf(p);
      var li = el('li');
      li.style.setProperty('--i', n);
      var b = el('button', 'plato');
      b.type = 'button';
      b.setAttribute('aria-haspopup', 'dialog');
      b.setAttribute('aria-label', etiquetaProducto(p));
      var media = el('span', 'plato__media');
      var dibujo = svgUso(p.icono || 'taza');
      if (p.foto) {
        var img = el('img');
        img.src = urlFoto(p.foto);
        img.alt = '';
        img.loading = 'lazy';
        img.decoding = 'async';
        img.addEventListener('error', function () { img.replaceWith(dibujo); });
        media.appendChild(img);
      } else {
        media.appendChild(dibujo);
      }
      b.appendChild(media);
      var info = el('span', 'plato__info');
      info.appendChild(el('span', 'plato__nombre', p.nombre || 'Producto'));
      info.appendChild(el('span', 'plato__precio', precioBonito(p.precio)));
      b.appendChild(info);
      b.addEventListener('click', function () { abrirProducto(i); });
      li.appendChild(b);
      favs.appendChild(li);
    });

    grupos.forEach(function (cat, n) {
      var caja = el('article', 'caja');
      caja.style.setProperty('--i', n);
      var ico = svgUso(cat.icono || 'taza');
      ico.setAttribute('class', 'caja__icono');
      caja.appendChild(ico);
      caja.appendChild(el('h3', null, cat.nombre));
      if (cat.desc) caja.appendChild(el('p', 'caja__desc', cat.desc));
      var ul = el('ul', 'caja__lista');
      ul.setAttribute('data-categoria', cat.id);
      var items = [];
      lista.forEach(function (p, i) { if (p.cat === cat.id) items.push(i); });
      if (!items.length) ul.appendChild(el('li', 'estado-vacio', 'Pronto habrá productos en esta sección.'));
      items.forEach(function (i) {
        var p = lista[i];
        var li = el('li');
        var b = el('button', 'fila-plato');
        b.type = 'button';
        b.setAttribute('aria-haspopup', 'dialog');
        b.setAttribute('aria-label', etiquetaProducto(p));
        b.appendChild(el('span', 'fila-plato__nombre', p.nombre || 'Producto'));
        b.appendChild(el('span', 'fila-plato__precio', precioBonito(p.precio)));
        var mas = el('span', 'fila-plato__mas', '+'); mas.setAttribute('aria-hidden', 'true'); b.appendChild(mas);
        b.addEventListener('click', function () { abrirProducto(i); });
        li.appendChild(b);
        ul.appendChild(li);
      });
      caja.appendChild(ul);
      cont.appendChild(caja);
    });
  }

  var actual = 0;
  var visual = $('producto-visual');
  var dibujo = $('producto-dibujo');
  var icono = $('producto-icono');
  var imgProducto = $('producto-img');
  imgProducto.addEventListener('error', function () {
    imgProducto.hidden = true;
    visual.classList.remove('con-foto');
  });
  function animarEntrada(nodo) {
    nodo.classList.remove('entra');
    void nodo.getBoundingClientRect();
    nodo.classList.add('entra');
  }
  function mostrarProducto(i) {
    var lista = productos();
    if (!lista.length) return;
    actual = (i + lista.length) % lista.length;
    var p = lista[actual];
    $('producto-categoria').textContent = nombreGrupo(categorias(), p.cat);
    $('producto-nombre').textContent = p.nombre || 'Producto';
    $('producto-precio').textContent = precioBonito(p.precio);
    $('producto-desc').textContent = p.desc || '';
    $('producto-cuenta').textContent = (actual + 1) + ' de ' + lista.length;
    var ul = $('producto-etiquetas');
    ul.innerHTML = '';
    (Array.isArray(p.etiquetas) ? p.etiquetas : []).forEach(function (t) { ul.appendChild(el('li', null, t)); });
    var ulAl = $('producto-alergenos');
    ulAl.innerHTML = '';
    var lista_al = Array.isArray(p.alergenos) ? p.alergenos : [];
    if (!lista_al.length) ulAl.appendChild(el('li', 'sin-alergenos', 'Sin alérgenos declarados'));
    ALERGENOS.forEach(function (a) {
      if (lista_al.indexOf(a.id) === -1) return;
      var li = el('li');
      li.appendChild(svgAlergeno(a.id));
      li.appendChild(el('span', null, a.nombre));
      ulAl.appendChild(li);
    });
    icono.setAttribute('href', '#i-' + (p.icono || 'taza'));
    dibujo.setAttribute('aria-label', 'Ilustración: ' + (p.nombre || 'producto'));
    if (p.foto) {
      visual.classList.add('con-foto');
      imgProducto.hidden = false;
      imgProducto.src = urlFoto(p.foto);
      imgProducto.alt = p.nombre || '';
      animarEntrada(imgProducto);
    } else {
      visual.classList.remove('con-foto');
      imgProducto.hidden = true;
      imgProducto.removeAttribute('src');
      animarEntrada(dibujo);
    }
  }
  $('producto-llevar').addEventListener('click', function () {
    var p = productos()[actual];
    if (!p) return;
    agregarAlPedido(p.id);
    cerrar(modalProducto);
    var seccion = $('llevar');
    if (seccion && !seccion.hidden) seccion.scrollIntoView({ behavior: 'smooth', block: 'start' });
    avisoPedido.textContent = '«' + p.nombre + '» añadido a tu pedido.';
  });
  $('producto-anterior').addEventListener('click', function () { mostrarProducto(actual - 1); });
  $('producto-siguiente').addEventListener('click', function () { mostrarProducto(actual + 1); });
  modalProducto.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowLeft') mostrarProducto(actual - 1);
    if (e.key === 'ArrowRight') mostrarProducto(actual + 1);
  });

  /* ---------- Galería pública (solo aparece cuando hay fotos) ---------- */
  function pintarGaleria() {
    var ul = $('galeria-lista');
    ul.innerHTML = '';
    var fotos = (estado.galeria && Array.isArray(estado.galeria.fotos) ? estado.galeria.fotos : [])
      .filter(function (f) { return f && f.foto; });
    document.querySelectorAll('[data-galeria]').forEach(function (n) { n.hidden = !fotos.length; });
    fotos.forEach(function (f) {
      var li = el('li');
      var fig = el('figure', 'foto');
      var img = el('img');
      img.src = urlFoto(f.foto);
      img.alt = f.pie || 'Foto de SOÑO';
      img.loading = 'lazy';
      img.decoding = 'async';
      img.addEventListener('error', function () { li.remove(); });
      fig.appendChild(img);
      if (f.pie) fig.appendChild(el('figcaption', 'pie-foto', f.pie));
      li.appendChild(fig);
      ul.appendChild(li);
    });
  }

  /* ---------- Horario y horas de reserva ---------- */
  function pintarHorario() {
    var h = estado.horario || {};
    var dd = $('dato-horario');
    dd.innerHTML = '';
    var dias = Array.isArray(h.dias) ? h.dias.filter(function (d) { return d && texto(d.texto); }) : [];
    if (!dias.length) dd.appendChild(pendiente());
    else {
      var ul = el('ul', 'horario-lista');
      dias.forEach(function (d) {
        var li = el('li');
        li.appendChild(el('span', null, d.dia));
        li.appendChild(el('span', null, texto(d.texto)));
        ul.appendChild(li);
      });
      dd.appendChild(ul);
    }
    var elegida = seleccion('hora');
    pintarHoras('horas-manana', h.manana, 'm');
    pintarHoras('horas-tarde', h.tarde, 't');
    if (elegida) {
      var misma = formReserva.querySelector('input[name="hora"][value="' + elegida + '"]');
      if (misma) misma.checked = true;
    }
    actualizarResumen();
  }
  function pintarHoras(idCont, horas, pre) {
    var cont = $(idCont);
    cont.innerHTML = '';
    var lista = Array.isArray(horas) ? horas.filter(function (t) { return RE_HORA.test(t); }) : [];
    if (!lista.length) {
      cont.appendChild(el('p', 'estado-vacio', cargado ? 'Sin horas disponibles.' : 'Cargando horas…'));
      return;
    }
    lista.forEach(function (t) {
      var id = 'hora-' + pre + '-' + t.replace(':', '');
      var input = el('input', 'oculto');
      input.type = 'radio'; input.name = 'hora'; input.id = id; input.value = t;
      var label = el('label', 'chip chip--hora', t);
      label.htmlFor = id;
      cont.appendChild(input);
      cont.appendChild(label);
    });
  }

  /* ---------- Datos de contacto ---------- */
  function ponerDato(id, valor) {
    var dd = $(id);
    dd.innerHTML = '';
    var v = texto(valor);
    if (v) dd.textContent = v; else dd.appendChild(pendiente());
  }
  /* Redes sociales y llamada: Instagram, WhatsApp y llamar por teléfono, con sus iconos */
  function enlacesRedes(d) {
    var lista = [];
    var ig = texto(d.instagram).replace(/^@/, '');
    if (ig) lista.push({ id: 'instagram', nombre: 'Instagram', texto: '@' + ig, url: 'https://www.instagram.com/' + encodeURIComponent(ig) + '/' });
    var wa = texto(d.whatsapp).replace(/[^\d]/g, '');
    if (wa.length === 9) wa = '34' + wa;   // número español sin prefijo
    if (wa.length >= 9) lista.push({ id: 'whatsapp', nombre: 'WhatsApp', etiqueta: 'Escribir por WhatsApp a SOÑO', texto: texto(d.whatsapp), url: 'https://wa.me/' + wa });
    // Llamar: usa el teléfono de contacto
    var tel = texto(d.telefono).replace(/[^\d+]/g, '');
    if (/^\d{9}$/.test(tel)) tel = '+34' + tel;
    if (tel.replace(/\D/g, '').length >= 9) lista.push({ id: 'llamar', nombre: 'Llamar', etiqueta: 'Llamar a SOÑO: ' + texto(d.telefono), texto: texto(d.telefono), url: 'tel:' + tel, mismaVentana: true });
    return lista;
  }
  function enlaceRed(red) {
    var a = el('a', 'enlace-red');
    a.href = red.url;
    if (!red.mismaVentana) { a.target = '_blank'; a.rel = 'noopener'; }
    a.setAttribute('aria-label', red.etiqueta || red.nombre + ' de SOÑO');
    a.title = red.nombre;
    var icono = el('span', 'icono-red icono-red--' + red.id);
    icono.setAttribute('aria-hidden', 'true');
    a.appendChild(icono);
    return a;
  }

  function pintarDatos() {
    var d = estado.datos || {};
    ponerDato('dato-direccion', d.direccion);
    ponerDato('dato-email', d.email);
    ponerDato('dato-telefono', d.telefono);
    var ig = texto(d.instagram).replace(/^@/, '');
    var redes = enlacesRedes(d);
    // Pie de la galería: solo Instagram, con su usuario
    document.querySelectorAll('.dato-instagram').forEach(function (n) {
      n.innerHTML = '';
      var red = redes.filter(function (x) { return x.id === 'instagram'; })[0];
      if (red) {
        var a = enlaceRed(red);
        a.appendChild(el('span', null, red.texto));
        n.appendChild(a);
      } else {
        n.appendChild(pendiente('Instagram por confirmar'));
      }
    });
    // «Síguenos»: un icono por cada red que tenga datos en el panel
    var pie = $('redes-pie');
    if (pie) {
      pie.innerHTML = '';
      if (!redes.length) pie.appendChild(pendiente('Redes por confirmar'));
      redes.forEach(function (red) { pie.appendChild(enlaceRed(red)); });
    }
    $('pegatina').hidden = d.abrimosPronto === false;
    var hayLlevar = d.paraLlevar !== false;
    var hayDomicilio = d.domicilio !== false;
    document.querySelectorAll('[data-llevar]').forEach(function (n) { n.hidden = !hayLlevar; });
    document.querySelectorAll('[data-domicilio]').forEach(function (n) { n.hidden = !hayDomicilio; });
    if (!hayDomicilio && $('tipo-domicilio').checked) { $('tipo-recoger').checked = true; }
    $('llevar-intro').textContent = hayDomicilio
      ? 'Haz tu pedido aquí y pásate a recogerlo, o te lo llevamos a casa.'
      : 'Haz tu pedido aquí y pásate a recogerlo cuando esté listo.';
    actualizarTipo();
  }

  /* ---------- Reservas ---------- */
  var formReserva = $('form-reserva');
  var diasEl = $('dias');
  var personasEl = $('personas');
  var menos = $('menos');
  var mas = $('mas');
  var resumen = $('resumen');
  var avisoReserva = $('aviso-reserva');
  var confirmacion = $('confirmacion');
  var detalle = $('confirmacion-detalle');
  var otra = $('otra-reserva');
  var botonReservar = formReserva.querySelector('button[type="submit"]');

  var MIN = 1, MAX = 8, personas = 2;
  var dias = [];
  var fechas = [];

  function sinPunto(s) { return s.replace('.', ''); }
  var fCorto = new Intl.DateTimeFormat('es-ES', { weekday: 'short' });
  var fMes = new Intl.DateTimeFormat('es-ES', { month: 'short' });
  var fLargo = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });

  var hoy = new Date();
  hoy.setHours(12, 0, 0, 0);
  for (var i = 0; i < 7; i++) {
    var d = new Date(hoy);
    d.setDate(hoy.getDate() + i);
    var arriba = i === 0 ? 'Hoy' : i === 1 ? 'Mañana' : sinPunto(fCorto.format(d));
    var largo = fLargo.format(d).replace(',', '');
    dias.push(i === 0 ? 'hoy, ' + largo : i === 1 ? 'mañana, ' + largo : largo);
    fechas.push(d.getFullYear() + '-' + dos(d.getMonth() + 1) + '-' + dos(d.getDate()));

    var input = el('input', 'oculto');
    input.type = 'radio';
    input.name = 'dia';
    input.id = 'dia-' + i;
    input.value = String(i);
    if (i === 0) { input.defaultChecked = true; input.checked = true; }

    var label = el('label', 'chip chip--dia');
    label.htmlFor = input.id;
    label.appendChild(el('span', 'arriba', arriba));
    label.appendChild(el('span', 'numero', String(d.getDate())));
    label.appendChild(el('span', 'abajo', sinPunto(fMes.format(d))));

    diasEl.appendChild(input);
    diasEl.appendChild(label);
  }

  function seleccion(nombre) {
    var e = formReserva.querySelector('input[name="' + nombre + '"]:checked');
    return e ? e.value : null;
  }
  function textoPersonas(n) { return n === 1 ? '1 persona' : n + ' personas'; }

  function actualizarResumen() {
    personasEl.textContent = personas;
    menos.disabled = personas <= MIN;
    mas.disabled = personas >= MAX;
    var dia = seleccion('dia');
    var hora = seleccion('hora');
    var partes = ['Mesa para ' + personas];
    partes.push(dia !== null ? dias[+dia] : 'elige día');
    partes.push(hora ? 'a las ' + hora : 'elige hora');
    resumen.textContent = partes.join(' · ');
  }

  menos.addEventListener('click', function () { if (personas > MIN) { personas--; actualizarResumen(); } });
  mas.addEventListener('click', function () { if (personas < MAX) { personas++; actualizarResumen(); } });
  formReserva.addEventListener('change', function () { avisoReserva.textContent = ''; actualizarResumen(); });

  formReserva.addEventListener('submit', function (e) {
    e.preventDefault();
    var dia = seleccion('dia');
    var hora = seleccion('hora');
    var nombre = formReserva.nombre.value.trim();
    var telefono = formReserva.telefono.value.trim();
    if (dia === null) { avisoReserva.textContent = 'Elige un día para la reserva.'; return; }
    if (!hora) { avisoReserva.textContent = 'Elige una hora para la reserva.'; return; }
    if (!nombre) { avisoReserva.textContent = 'Escribe tu nombre para guardar la mesa.'; formReserva.nombre.focus(); return; }
    if (telefono.replace(/[^\d]/g, '').length < 9) { avisoReserva.textContent = 'Revisa el teléfono: necesitamos al menos 9 cifras para avisarte.'; formReserva.telefono.focus(); return; }

    botonReservar.disabled = true;
    avisoReserva.textContent = 'Enviando la reserva…';
    api('POST', '/api/reservas', {
      fecha: fechas[+dia],
      hora: hora,
      personas: personas,
      nombre: nombre,
      telefono: telefono,
      notas: formReserva.notas.value,
      web: formReserva.web.value
    }).then(function () {
      avisoReserva.textContent = '';
      detalle.textContent = 'Mesa para ' + textoPersonas(personas) + ', ' + dias[+dia] + ' a las ' + hora + ', a nombre de ' + nombre + '.';
      formReserva.hidden = true;
      confirmacion.hidden = false;
      modalReserva.scrollTop = 0;
    }).catch(function (err) {
      avisoReserva.textContent = err.message;
    }).then(function () {
      botonReservar.disabled = false;
    });
  });

  function reiniciarReserva() {
    formReserva.reset();
    personas = 2;
    avisoReserva.textContent = '';
    confirmacion.hidden = true;
    formReserva.hidden = false;
    actualizarResumen();
  }
  otra.addEventListener('click', reiniciarReserva);
  modalReserva.addEventListener('close', function () {
    if (!confirmacion.hidden) reiniciarReserva();
  });

  /* ---------- Pedidos para llevar ---------- */
  var formPedido = $('form-pedido');
  var lineasEl = $('pedido-lineas');
  var totalPedido = $('pedido-total');
  var avisoPedido = $('aviso-pedido');
  var confPedido = $('confirmacion-pedido');
  var botonPedido = formPedido.querySelector('button[type="submit"]');
  var lineas = [{ id: '', cantidad: 1 }];

  function opcionesProductos(sel, elegido) {
    sel.innerHTML = '';
    var vacio = el('option', null, 'Elige un producto');
    vacio.value = '';
    sel.appendChild(vacio);
    categorias().forEach(function (cat) {
      var grupo = document.createElement('optgroup');
      grupo.label = cat.nombre;
      productos().forEach(function (p) {
        if (p.cat !== cat.id) return;
        var o = el('option', null, p.nombre + ' · ' + precioBonito(p.precio));
        o.value = p.id;
        if (p.id === elegido) o.selected = true;
        grupo.appendChild(o);
      });
      if (grupo.children.length) sel.appendChild(grupo);
    });
  }
  function pintarLineas() {
    lineasEl.innerHTML = '';
    if (!lineas.length) lineas.push({ id: '', cantidad: 1 });
    lineas.forEach(function (l, i) {
      if (l.id && !productos().some(function (p) { return p.id === l.id; })) l.id = '';
      var fila = el('div', 'linea');
      var idSel = 'pedido-producto-' + i;
      var idCant = 'pedido-cantidad-' + i;
      var lab = el('label', 'solo-lector', 'Producto ' + (i + 1)); lab.htmlFor = idSel;
      var sel = el('select'); sel.id = idSel;
      opcionesProductos(sel, l.id);
      sel.addEventListener('change', function () { l.id = sel.value; avisoPedido.textContent = ''; actualizarTotal(); });
      var labC = el('label', 'solo-lector', 'Cantidad del producto ' + (i + 1)); labC.htmlFor = idCant;
      var cant = el('select'); cant.id = idCant;
      for (var n = 1; n <= 10; n++) { var o = el('option', null, '× ' + n); o.value = String(n); cant.appendChild(o); }
      cant.value = String(l.cantidad);
      cant.addEventListener('change', function () { l.cantidad = Number(cant.value); actualizarTotal(); });
      var quitar = el('button', 'linea__quitar', '×');
      quitar.type = 'button';
      quitar.setAttribute('aria-label', 'Quitar el producto ' + (i + 1));
      quitar.hidden = lineas.length === 1 && !l.id;
      quitar.addEventListener('click', function () { lineas.splice(i, 1); pintarLineas(); });
      fila.appendChild(lab); fila.appendChild(sel); fila.appendChild(labC); fila.appendChild(cant); fila.appendChild(quitar);
      lineasEl.appendChild(fila);
    });
    actualizarTotal();
  }
  function actualizarTotal() {
    var total = 0, unidades = 0;
    lineas.forEach(function (l) {
      var p = productos().filter(function (x) { return x.id === l.id; })[0];
      if (p) { total += precioNum(p.precio) * l.cantidad; unidades += l.cantidad; }
    });
    totalPedido.textContent = unidades
      ? euros(total) + ' · ' + (unidades === 1 ? '1 producto' : unidades + ' productos')
      : 'Elige al menos un producto';
  }
  function agregarAlPedido(id) {
    var existente = lineas.filter(function (l) { return l.id === id; })[0];
    if (existente) existente.cantidad = Math.min(10, existente.cantidad + 1);
    else {
      var libre = lineas.filter(function (l) { return !l.id; })[0];
      if (libre) libre.id = id; else lineas.push({ id: id, cantidad: 1 });
    }
    confPedido.hidden = true;
    formPedido.hidden = false;
    pintarLineas();
  }
  function actualizarTipo() {
    var domicilio = $('tipo-domicilio').checked;
    $('campo-direccion').hidden = !domicilio;
    $('campo-recogida').hidden = domicilio;
  }

  /* Día y hora de recogida: las horas del horario (mañana y tarde), de hoy a pasado mañana */
  var recogida = { dia: 0, hora: '' };
  var DIAS_RECOGIDA = 3;
  function minutos(t) { var x = t.split(':'); return Number(x[0]) * 60 + Number(x[1]); }
  function horasRecogida(dia) {
    var h = estado.horario || {};
    var todas = [].concat(Array.isArray(h.manana) ? h.manana : [], Array.isArray(h.tarde) ? h.tarde : [])
      .filter(function (t, i, a) { return RE_HORA.test(t) && a.indexOf(t) === i; })
      .sort();
    if (dia === 0) {
      var ahora = new Date();
      var limite = ahora.getHours() * 60 + ahora.getMinutes() + 15;   // margen para prepararlo
      todas = todas.filter(function (t) { return minutos(t) >= limite; });
    }
    return todas;
  }
  function textoDia(i) {
    if (i === 0) return 'hoy';
    if (i === 1) return 'mañana';
    return 'el ' + fLargo.format(new Date(fechas[i] + 'T12:00:00')).replace(',', '');
  }
  function pintarRecogida() {
    var diasEl = $('recogida-dias');
    var horasEl = $('recogida-horas');
    var nota = $('recogida-nota');
    diasEl.innerHTML = '';
    horasEl.innerHTML = '';
    if (!horasRecogida(1).length) {
      // Sin horas en el horario: se acuerda por teléfono
      diasEl.hidden = true;
      horasEl.hidden = true;
      nota.hidden = false;
      nota.textContent = cargado ? 'Te llamamos para acordar la hora de recogida.' : 'Cargando horas…';
      recogida.hora = '';
      return;
    }
    diasEl.hidden = false;
    horasEl.hidden = false;
    nota.hidden = true;
    var disponibles = [];
    for (var i = 0; i < DIAS_RECOGIDA; i++) { if (horasRecogida(i).length) disponibles.push(i); }
    if (disponibles.indexOf(recogida.dia) === -1) { recogida.dia = disponibles[0]; recogida.hora = ''; }
    disponibles.forEach(function (i) {
      var d = new Date(fechas[i] + 'T12:00:00');
      var input = el('input', 'oculto');
      input.type = 'radio';
      input.name = 'recogida-dia';
      input.id = 'recogida-dia-' + i;
      input.value = String(i);
      input.checked = i === recogida.dia;
      var label = el('label', 'chip chip--dia');
      label.htmlFor = input.id;
      label.appendChild(el('span', 'arriba', i === 0 ? 'Hoy' : i === 1 ? 'Mañana' : sinPunto(fCorto.format(d))));
      label.appendChild(el('span', 'numero', String(d.getDate())));
      label.appendChild(el('span', 'abajo', sinPunto(fMes.format(d))));
      diasEl.appendChild(input);
      diasEl.appendChild(label);
    });
    var horas = horasRecogida(recogida.dia);
    if (horas.indexOf(recogida.hora) === -1) recogida.hora = '';
    horas.forEach(function (t) {
      var input = el('input', 'oculto');
      input.type = 'radio';
      input.name = 'recogida-hora';
      input.id = 'recogida-hora-' + t.replace(':', '');
      input.value = t;
      input.checked = t === recogida.hora;
      var label = el('label', 'chip chip--hora', t);
      label.htmlFor = input.id;
      horasEl.appendChild(input);
      horasEl.appendChild(label);
    });
  }
  formPedido.addEventListener('input', function () { if (!botonPedido.disabled) avisoPedido.textContent = ''; });
  formPedido.addEventListener('change', function (e) {
    var n = e.target && e.target.name;
    if (n === 'tipo') { avisoPedido.textContent = ''; actualizarTipo(); }
    if (n === 'recogida-dia') { recogida.dia = Number(e.target.value); recogida.hora = ''; pintarRecogida(); }
    if (n === 'recogida-hora') { recogida.hora = e.target.value; avisoPedido.textContent = ''; }
  });
  $('pedido-anadir').addEventListener('click', function () {
    lineas.push({ id: '', cantidad: 1 });
    pintarLineas();
    var ultimo = $('pedido-producto-' + (lineas.length - 1));
    if (ultimo) ultimo.focus();
  });

  formPedido.addEventListener('submit', function (e) {
    e.preventDefault();
    var tipo = $('tipo-domicilio').checked ? 'domicilio' : 'recoger';
    var nombre = formPedido.nombre.value.trim();
    var telefono = formPedido.telefono.value.trim();
    var direccion = formPedido.direccion.value.trim();
    var elegidas = lineas.filter(function (l) { return l.id; });
    if (!elegidas.length) { avisoPedido.textContent = 'Elige al menos un producto de la carta.'; return; }
    if (!nombre) { avisoPedido.textContent = 'Escribe tu nombre para el pedido.'; formPedido.nombre.focus(); return; }
    if (telefono.replace(/[^\d]/g, '').length < 9) { avisoPedido.textContent = 'Revisa el teléfono: necesitamos al menos 9 cifras para avisarte.'; formPedido.telefono.focus(); return; }
    if (tipo === 'domicilio' && direccion.length < 5) { avisoPedido.textContent = 'Escribe la dirección de entrega.'; formPedido.direccion.focus(); return; }
    var conHora = tipo === 'recoger' && horasRecogida(1).length > 0;
    if (conHora && !recogida.hora) {
      pintarRecogida();
      avisoPedido.textContent = 'Elige a qué hora pasas a recogerlo.';
      $('campo-recogida').scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    var diaElegido = recogida.dia;

    botonPedido.disabled = true;
    avisoPedido.textContent = 'Enviando el pedido…';
    api('POST', '/api/pedidos', {
      tipo: tipo,
      nombre: nombre,
      telefono: telefono,
      direccion: direccion,
      lineas: elegidas.map(function (l) { return { id: l.id, cantidad: l.cantidad }; }),
      recogida: conHora ? { fecha: fechas[recogida.dia], hora: recogida.hora } : null,
      notas: formPedido.notas.value,
      web: formPedido.web.value
    }).then(function (r) {
      avisoPedido.textContent = '';
      var resumenLineas = r.lineas.map(function (l) { return l.cantidad + ' × ' + l.nombre; }).join(', ');
      $('confirmacion-pedido-detalle').textContent = resumenLineas + '. Total: ' + r.total + ' €. ' +
        (tipo === 'domicilio' ? 'Te lo llevamos a ' + direccion + '.'
          : r.recogida ? 'Te esperamos en SOÑO ' + textoDia(diaElegido) + ' a las ' + r.recogida.hora + '.'
          : 'Te esperamos en SOÑO para recogerlo.');
      formPedido.hidden = true;
      confPedido.hidden = false;
    }).catch(function (err) {
      avisoPedido.textContent = err.message;
      pintarRecogida();   // por si la hora elegida ya ha pasado
    }).then(function () {
      botonPedido.disabled = false;
    });
  });

  $('otro-pedido').addEventListener('click', function () {
    formPedido.reset();
    lineas = [{ id: '', cantidad: 1 }];
    recogida = { dia: 0, hora: '' };
    avisoPedido.textContent = '';
    confPedido.hidden = true;
    formPedido.hidden = false;
    actualizarTipo();
    pintarLineas();
    pintarRecogida();
  });

  /* ---------- Formulario de contacto ---------- */
  var fc = $('formulario-contacto');
  var avisoContacto = $('aviso');
  var botonContacto = fc.querySelector('button[type="submit"]');
  fc.addEventListener('submit', function (e) {
    e.preventDefault();
    var n = fc.nombre.value.trim();
    var c = fc.correo.value.trim();
    var m = fc.mensaje.value.trim();
    if (!n || !c || !m) { avisoContacto.textContent = 'Rellena nombre, email y mensaje para continuar.'; return; }
    if (c.indexOf('@') < 1) { avisoContacto.textContent = 'Revisa el email: parece que le falta algo.'; return; }
    botonContacto.disabled = true;
    avisoContacto.textContent = 'Enviando…';
    api('POST', '/api/mensajes', { nombre: n, email: c, mensaje: m, web: fc.web.value }).then(function () {
      fc.reset();
      avisoContacto.textContent = 'Mensaje enviado. Te responderemos lo antes posible.';
    }).catch(function (err) {
      avisoContacto.textContent = err.message;
    }).then(function () {
      botonContacto.disabled = false;
    });
  });

  /* ---------- Acceso al panel ---------- */
  function abrirLogin(mensaje) {
    $('form-login').reset();
    $('aviso-login').textContent = mensaje || '';
    abrir(modalLogin);
    setTimeout(function () { $('login-usuario').focus(); }, 50);
  }

  $('logo').addEventListener('click', function () {
    api('GET', '/api/sesion').then(function (r) {
      if (r.admin) abrirPanel(); else abrirLogin();
    }).catch(function () { abrirLogin(); });
  });

  $('form-login').addEventListener('submit', function (e) {
    e.preventDefault();
    var boton = e.target.querySelector('button[type="submit"]');
    boton.disabled = true;
    $('aviso-login').textContent = '';
    api('POST', '/api/login', { usuario: $('login-usuario').value, clave: $('login-clave').value }).then(function () {
      cerrar(modalLogin);
      abrirPanel();
    }).catch(function (err) {
      $('aviso-login').textContent = err.message;
      $('login-clave').value = '';
      $('login-clave').focus();
    }).then(function () {
      boton.disabled = false;
    });
  });

  $('cerrar-sesion').addEventListener('click', function () {
    api('POST', '/api/logout').catch(function () {}).then(function () { cerrar(modalAdmin); });
  });

  /* ---------- Panel de administración ---------- */
  var pestana = 'carta';
  var borradores = {};
  var sucio = {};
  var guardando = false;
  var cuerpo = $('admin-cuerpo');
  var estadoPanel = $('admin-estado');
  var btnGuardar = $('admin-guardar');
  var btnDescartar = $('admin-descartar');

  function sesionCaducada(err) {
    if (err && err.status === 401) {
      cerrar(modalAdmin);
      abrirLogin('Tu sesión ha caducado. Vuelve a entrar; tus cambios sin guardar siguen en el panel.');
      return true;
    }
    return false;
  }

  function vacio(k) {
    if (k === 'carta') return { categorias: [], productos: [] };
    if (k === 'galeria') return { fotos: PIES_GALERIA.map(function (pie, i) { return { id: 'g' + (i + 1), pie: pie, foto: null }; }) };
    if (k === 'horario') return { dias: DIAS_SEMANA.map(function (dia) { return { dia: dia, texto: '' }; }), manana: [], tarde: [] };
    return { direccion: '', email: '', telefono: '', instagram: '', whatsapp: '', abrimosPronto: true, paraLlevar: true, domicilio: true };
  }
  function normalizar(k, b) {
    if (k === 'carta' && !Array.isArray(b.productos)) b.productos = [];
    if (k === 'carta' && !Array.isArray(b.categorias)) b.categorias = [];
    if (k === 'galeria' && (!Array.isArray(b.fotos) || !b.fotos.length)) b.fotos = vacio('galeria').fotos;
    if (k === 'horario') {
      var porDia = {};
      (Array.isArray(b.dias) ? b.dias : []).forEach(function (d) { if (d && d.dia) porDia[d.dia] = d.texto || ''; });
      b.dias = DIAS_SEMANA.map(function (dia) { return { dia: dia, texto: porDia[dia] || '' }; });
      if (!Array.isArray(b.manana)) b.manana = [];
      if (!Array.isArray(b.tarde)) b.tarde = [];
    }
    if (k === 'datos' && b.abrimosPronto === undefined) b.abrimosPronto = true;
    if (k === 'datos' && b.paraLlevar === undefined) b.paraLlevar = true;
    if (k === 'datos' && b.domicilio === undefined) b.domicilio = true;
    if (k === 'carta') b.productos.forEach(function (p) { if (!Array.isArray(p.alergenos)) p.alergenos = []; });
    return b;
  }
  function borrador(k) {
    if (!borradores[k] || !sucio[k]) borradores[k] = normalizar(k, clonar(estado[k] || vacio(k)));
    return borradores[k];
  }
  function claveActual() { return CLAVE_DE[pestana] || null; }
  function marcar() {
    var k = claveActual();
    if (!k) return;
    sucio[k] = true;
    btnDescartar.disabled = false;
    mostrarEstado('Hay cambios sin guardar.');
  }
  function mostrarEstado(t, esError) {
    estadoPanel.textContent = t || '';
    estadoPanel.classList.toggle('es-error', !!esError);
  }

  function abrirPanel() {
    abrir(modalAdmin);
    pintarPanel();
    actualizarContadores();
  }

  document.querySelectorAll('.pestana').forEach(function (t) {
    t.addEventListener('click', function () { cambiarPestana(t.getAttribute('data-pestana')); });
    t.addEventListener('keydown', function (e) {
      var tabs = Array.prototype.slice.call(document.querySelectorAll('.pestana'));
      var i = tabs.indexOf(t);
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        var sig = tabs[(i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length];
        sig.focus();
        cambiarPestana(sig.getAttribute('data-pestana'));
      }
    });
  });
  function cambiarPestana(nombre) {
    pestana = nombre;
    document.querySelectorAll('.pestana').forEach(function (t) {
      var activa = t.getAttribute('data-pestana') === nombre;
      t.setAttribute('aria-selected', activa ? 'true' : 'false');
      t.tabIndex = activa ? 0 : -1;
      if (activa) cuerpo.setAttribute('aria-labelledby', t.id);
    });
    pintarPanel();
    cuerpo.scrollTop = 0;
  }

  /* Lleva un campo al centro del panel moviendo solo la zona de contenido
     (scrollIntoView también desplazaría la ventana del panel y taparía la cabecera) */
  function enfocarEnPanel(campo) {
    campo.focus({ preventScroll: true });
    var arriba = campo.getBoundingClientRect().top - cuerpo.getBoundingClientRect().top + cuerpo.scrollTop;
    cuerpo.scrollTop = Math.max(0, arriba - cuerpo.clientHeight / 2);
    modalAdmin.scrollTop = 0;
  }
  var ultimaPestanaPintada = null;
  function pintarPanel() {
    var k = claveActual();
    // Al redibujar la misma pestaña (añadir, mover o borrar algo) se mantiene la posición de lectura
    var mismaPestana = ultimaPestanaPintada === pestana;
    var posicion = cuerpo.scrollTop;
    ultimaPestanaPintada = pestana;
    cuerpo.innerHTML = '';
    btnGuardar.hidden = !k;
    btnDescartar.hidden = !k;
    if (k && !cargado) { cuerpo.appendChild(el('p', 'estado-vacio', 'Cargando…')); return; }
    if (pestana === 'carta') panelCarta();
    if (pestana === 'fotos') panelFotos();
    if (pestana === 'horarios') panelHorarios();
    if (pestana === 'datos') panelDatos();
    if (pestana === 'reservas') panelReservas();
    if (pestana === 'pedidos') panelPedidos();
    if (pestana === 'mensajes') panelMensajes();
    cuerpo.scrollTop = mismaPestana ? posicion : 0;
    if (!guardando) mostrarEstado(k && sucio[k] ? 'Hay cambios sin guardar.' : '');
    btnDescartar.disabled = !(k && sucio[k]);
    btnGuardar.disabled = guardando;
  }

  /* Campos reutilizables del panel */
  function campoTexto(id, etiqueta, valor, alCambiar, extra) {
    var c = el('div', 'campo');
    var l = el('label', null, etiqueta); l.htmlFor = id;
    var i = el('input'); i.id = id; i.type = 'text'; i.value = valor || '';
    if (extra) Object.keys(extra).forEach(function (a) { i.setAttribute(a, extra[a]); });
    i.addEventListener('input', function () { alCambiar(i.value); marcar(); });
    c.appendChild(l); c.appendChild(i);
    return c;
  }
  function campoArea(id, etiqueta, valor, alCambiar) {
    var c = el('div', 'campo');
    var l = el('label', null, etiqueta); l.htmlFor = id;
    var t = el('textarea'); t.id = id; t.value = valor || ''; t.style.minHeight = '76px';
    t.addEventListener('input', function () { alCambiar(t.value); marcar(); });
    c.appendChild(l); c.appendChild(t);
    return c;
  }
  function botonMini(textoBoton, alPulsar, peligro) {
    var b = el('button', 'boton boton--borde boton--mini' + (peligro ? ' boton--peligro' : ''), textoBoton);
    b.type = 'button';
    b.addEventListener('click', alPulsar);
    return b;
  }
  function botonBorrar(textoBoton, alConfirmar) {
    var b = botonMini(textoBoton, function () {
      if (b.getAttribute('data-confirmar') === '1') { alConfirmar(); return; }
      b.setAttribute('data-confirmar', '1');
      b.textContent = '¿Seguro? Toca otra vez';
      setTimeout(function () {
        if (b.isConnected) { b.removeAttribute('data-confirmar'); b.textContent = textoBoton; }
      }, 4000);
    }, true);
    return b;
  }
  function botonFoto(id, textoBoton, alElegir) {
    var w = el('span');
    var i = el('input', 'oculto');
    i.type = 'file'; i.id = id; i.accept = 'image/jpeg,image/png,image/webp';
    var l = el('label', 'boton boton--borde boton--mini', textoBoton);
    l.htmlFor = id;
    i.addEventListener('change', function () {
      var f = i.files && i.files[0];
      i.value = '';
      if (f) alElegir(f);
    });
    w.appendChild(i); w.appendChild(l);
    return w;
  }

  /* Pestaña: carta y precios */
  function panelCarta() {
    var b = borrador('carta');
    cuerpo.appendChild(el('p', 'admin__ayuda', 'Organiza la carta en grupos (por ejemplo «Zumos» o «Repostería») y dentro de cada grupo cambia nombres, precios, descripciones, alérgenos y fotos. Los cambios se ven en la web en cuanto pulsas «Guardar cambios». Revisa bien los alérgenos de cada producto: es información que la ley obliga a dar. Para destacar un producto en las tarjetas de arriba de la carta, ponle la etiqueta «Favorito» (hasta 4).'));
    if (!b.categorias.length) cuerpo.appendChild(el('p', 'estado-vacio', 'La carta no tiene grupos. Crea el primero con «+ Añadir grupo».'));
    b.categorias.forEach(function (cat, n) {
      var grupo = el('section', 'admin__grupo grupo-carta');
      var cab = el('div', 'grupo-carta__cabecera');
      var titulo = el('h3', null, texto(cat.nombre) || 'Grupo sin nombre');
      cab.appendChild(titulo);
      var acc = el('div', 'acciones-mini');
      var subir = botonMini('↑ Subir', function () { mover(n, -1); });
      subir.disabled = n === 0;
      subir.setAttribute('aria-label', 'Subir el grupo ' + (texto(cat.nombre) || (n + 1)));
      var bajar = botonMini('↓ Bajar', function () { mover(n, 1); });
      bajar.disabled = n === b.categorias.length - 1;
      bajar.setAttribute('aria-label', 'Bajar el grupo ' + (texto(cat.nombre) || (n + 1)));
      acc.appendChild(subir);
      acc.appendChild(bajar);
      var cuantos = b.productos.filter(function (p) { return p.cat === cat.id; }).length;
      acc.appendChild(botonBorrar(cuantos === 1 ? 'Borrar grupo y su producto' : cuantos ? 'Borrar grupo y sus ' + cuantos + ' productos' : 'Borrar grupo', function () {
        b.categorias.splice(n, 1);
        b.productos = b.productos.filter(function (p) { return p.cat !== cat.id; });
        marcar();
        pintarPanel();
      }));
      cab.appendChild(acc);
      grupo.appendChild(cab);

      var datosGrupo = el('div', 'grupo-carta__datos');
      var fila = el('div', 'fila-2 fila-2--ancha');
      fila.appendChild(campoTexto('adm-grupo-nombre-' + cat.id, 'Nombre del grupo', cat.nombre, function (v) {
        cat.nombre = v;
        titulo.textContent = texto(v) || 'Grupo sin nombre';
        botonAnadir.textContent = textoAnadir();
      }, { maxlength: '40', placeholder: 'Zumos y batidos' }));
      fila.appendChild(campoTexto('adm-grupo-desc-' + cat.id, 'Frase debajo del nombre (opcional)', cat.desc, function (v) { cat.desc = v; }, { maxlength: '120', placeholder: 'Naturales y hechos al momento.' }));
      datosGrupo.appendChild(fila);
      datosGrupo.appendChild(selectorIcono(cat));
      grupo.appendChild(datosGrupo);

      var lista = el('div', 'admin__lista admin__lista--productos');
      var deCat = b.productos.filter(function (p) { return p.cat === cat.id; });
      if (!deCat.length) lista.appendChild(el('p', 'estado-vacio', 'Sin productos todavía.'));
      deCat.forEach(function (p) { lista.appendChild(tarjetaProducto(b, p)); });
      grupo.appendChild(lista);
      function textoAnadir() { return texto(cat.nombre) ? '+ Añadir producto a «' + texto(cat.nombre) + '»' : '+ Añadir producto'; }
      var botonAnadir = botonMini(textoAnadir(), function () {
        var nuevo = { id: 'p' + Date.now().toString(36), cat: cat.id, nombre: '', precio: '', desc: '', icono: cat.icono, etiquetas: [], alergenos: [], foto: null };
        b.productos.push(nuevo);
        marcar();
        pintarPanel();
        var campo = $('adm-nombre-' + nuevo.id);
        if (campo) enfocarEnPanel(campo);
      });
      grupo.appendChild(botonAnadir);
      cuerpo.appendChild(grupo);
    });

    var nuevoGrupo = el('div', 'grupo-carta__nuevo');
    var botonGrupo = el('button', 'boton boton--lleno boton--peque', '+ Añadir grupo');
    botonGrupo.type = 'button';
    botonGrupo.disabled = b.categorias.length >= MAX_GRUPOS;
    botonGrupo.addEventListener('click', function () {
      var cat = { id: 'c' + Date.now().toString(36), nombre: '', desc: '', icono: 'taza' };
      b.categorias.push(cat);
      marcar();
      pintarPanel();
      var campo = $('adm-grupo-nombre-' + cat.id);
      if (campo) enfocarEnPanel(campo);
    });
    nuevoGrupo.appendChild(botonGrupo);
    nuevoGrupo.appendChild(el('p', 'admin__ayuda', b.categorias.length >= MAX_GRUPOS ? 'Has llegado al máximo de ' + MAX_GRUPOS + ' grupos.' : 'Cada grupo sale como una caja de la carta, en este mismo orden.'));
    cuerpo.appendChild(nuevoGrupo);

    function mover(n, paso) {
      var destino = n + paso;
      if (destino < 0 || destino >= b.categorias.length) return;
      var g = b.categorias.splice(n, 1)[0];
      b.categorias.splice(destino, 0, g);
      marcar();
      pintarPanel();
    }
  }
  function selectorIcono(cat) {
    var fs = el('fieldset', 'iconos-admin');
    fs.appendChild(el('legend', null, 'Dibujo del grupo'));
    var lista = el('div', 'iconos-admin__lista');
    ICONOS.forEach(function (ic) {
      var id = 'adm-grupo-icono-' + cat.id + '-' + ic.id;
      var inp = el('input', 'oculto');
      inp.type = 'radio';
      inp.name = 'adm-grupo-icono-' + cat.id;
      inp.id = id;
      inp.checked = (cat.icono || 'taza') === ic.id;
      inp.addEventListener('change', function () { if (inp.checked) { cat.icono = ic.id; marcar(); } });
      var lab = el('label', 'icono-chip');
      lab.htmlFor = id;
      lab.title = ic.nombre;
      lab.appendChild(svgUso(ic.id));
      lab.appendChild(el('span', 'solo-lector', ic.nombre));
      lista.appendChild(inp);
      lista.appendChild(lab);
    });
    fs.appendChild(lista);
    return fs;
  }
  function tarjetaProducto(b, p) {
    var t = el('div', 'tarjeta-admin');
    var mini = el('div', 'tarjeta-admin__mini');
    if (p.foto) { var im = el('img'); im.src = urlFoto(p.foto); im.alt = ''; mini.appendChild(im); }
    else mini.appendChild(svgUso(p.icono || 'taza'));
    t.appendChild(mini);

    var campos = el('div', 'tarjeta-admin__campos');
    var fila = el('div', 'fila-2');
    fila.appendChild(campoTexto('adm-nombre-' + p.id, 'Nombre', p.nombre, function (v) { p.nombre = v; }));
    fila.appendChild(campoTexto('adm-precio-' + p.id, 'Precio (€)', p.precio, function (v) { p.precio = v; }, { inputmode: 'decimal', placeholder: '2,50' }));
    campos.appendChild(fila);
    campos.appendChild(campoArea('adm-desc-' + p.id, 'Descripción', p.desc, function (v) { p.desc = v; }));
    if (b.categorias.length > 1) {
      var campoGrupo = el('div', 'campo');
      var lg = el('label', null, 'Grupo'); lg.htmlFor = 'adm-cat-' + p.id;
      var sel = el('select'); sel.id = 'adm-cat-' + p.id;
      b.categorias.forEach(function (c) {
        var o = el('option', null, texto(c.nombre) || 'Grupo sin nombre');
        o.value = c.id;
        if (c.id === p.cat) o.selected = true;
        sel.appendChild(o);
      });
      sel.addEventListener('change', function () { p.cat = sel.value; marcar(); pintarPanel(); });
      campoGrupo.appendChild(lg); campoGrupo.appendChild(sel);
      campos.appendChild(campoGrupo);
    }
    campos.appendChild(campoTexto('adm-etiq-' + p.id, 'Etiquetas (separadas por comas)', (p.etiquetas || []).join(', '), function (v) {
      p.etiquetas = v.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    }, { placeholder: 'Caliente, Con leche' }));

    var grupoAl = el('fieldset', 'alergenos-admin');
    grupoAl.appendChild(el('legend', null, 'Alérgenos'));
    var listaAl = el('div', 'alergenos-admin__lista');
    ALERGENOS.forEach(function (a) {
      var idAl = 'adm-al-' + p.id + '-' + a.id;
      var inp = el('input', 'oculto');
      inp.type = 'checkbox';
      inp.id = idAl;
      inp.checked = (p.alergenos || []).indexOf(a.id) !== -1;
      inp.addEventListener('change', function () {
        var actuales = (p.alergenos || []).filter(function (x) { return x !== a.id; });
        if (inp.checked) actuales.push(a.id);
        p.alergenos = ALERGENOS.map(function (x) { return x.id; }).filter(function (x) { return actuales.indexOf(x) !== -1; });
        marcar();
      });
      var lab = el('label', 'alergeno-chip');
      lab.htmlFor = idAl;
      lab.appendChild(svgAlergeno(a.id));
      lab.appendChild(el('span', null, a.nombre));
      listaAl.appendChild(inp);
      listaAl.appendChild(lab);
    });
    grupoAl.appendChild(listaAl);
    campos.appendChild(grupoAl);

    var acc = el('div', 'acciones-mini');
    acc.appendChild(botonFoto('adm-foto-' + p.id, p.foto ? 'Cambiar foto' : 'Subir foto', function (f) {
      subirFoto(f, function (idFoto) { p.foto = idFoto; });
    }));
    if (p.foto) acc.appendChild(botonMini('Quitar foto', function () { p.foto = null; marcar(); pintarPanel(); }));
    acc.appendChild(botonBorrar('Eliminar producto', function () {
      b.productos = b.productos.filter(function (x) { return x !== p; });
      marcar();
      pintarPanel();
    }));
    campos.appendChild(acc);
    t.appendChild(campos);
    return t;
  }

  /* Pestaña: fotos de la galería */
  function panelFotos() {
    var b = borrador('galeria');
    cuerpo.appendChild(el('p', 'admin__ayuda', 'Sube una foto para cada hueco. La primera sale en grande. La galería aparece en la web en cuanto hay al menos una foto; los huecos sin foto no se muestran.'));
    var rejilla = el('div', 'admin__fotos');
    b.fotos.forEach(function (f, i) {
      var tarjeta = el('div', 'tarjeta-foto');
      var vista = el('div', 'tarjeta-foto__vista' + (f.foto ? ' con-foto' : ''));
      if (f.foto) { var im = el('img'); im.src = urlFoto(f.foto); im.alt = f.pie || ''; vista.appendChild(im); }
      else vista.appendChild(svgUso('camara'));
      tarjeta.appendChild(vista);
      tarjeta.appendChild(campoTexto('adm-pie-' + f.id, i === 0 ? 'Pie de foto (foto grande)' : 'Pie de foto', f.pie, function (v) { f.pie = v; }));
      var acc = el('div', 'acciones-mini');
      acc.appendChild(botonFoto('adm-galeria-' + f.id, f.foto ? 'Cambiar foto' : 'Subir foto', function (file) {
        subirFoto(file, function (idFoto) { f.foto = idFoto; });
      }));
      if (f.foto) acc.appendChild(botonMini('Quitar foto', function () { f.foto = null; marcar(); pintarPanel(); }));
      tarjeta.appendChild(acc);
      rejilla.appendChild(tarjeta);
    });
    cuerpo.appendChild(rejilla);
  }

  /* Pestaña: horarios */
  function panelHorarios() {
    var b = borrador('horario');
    var g1 = el('section', 'admin__grupo');
    g1.appendChild(el('h3', null, 'Horario de apertura'));
    g1.appendChild(el('p', 'admin__ayuda', 'Escribe el horario de cada día, por ejemplo «08:00 – 20:00» o «Cerrado». Los días vacíos no se muestran.'));
    var lista = el('div', 'admin__dias');
    b.dias.forEach(function (d) {
      var fila = el('div', 'admin__dia');
      var id = 'adm-dia-' + d.dia.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      var l = el('label', null, d.dia); l.htmlFor = id;
      var i = el('input'); i.id = id; i.type = 'text'; i.value = d.texto || ''; i.placeholder = '08:00 – 20:00';
      i.addEventListener('input', function () { d.texto = i.value; marcar(); });
      fila.appendChild(l); fila.appendChild(i);
      lista.appendChild(fila);
    });
    g1.appendChild(lista);
    cuerpo.appendChild(g1);

    var g2 = el('section', 'admin__grupo');
    g2.appendChild(el('h3', null, 'Horas para reservar mesa'));
    g2.appendChild(el('p', 'admin__ayuda', 'Escribe las horas separadas por comas, así: 08:30, 09:00, 09:30. Son las que aparecen al reservar.'));
    var campos = el('div', 'admin__campos');
    campos.appendChild(campoTexto('adm-manana', 'Mañana', b.manana.join(', '), function (v) { b.manana = partirHoras(v); }, { placeholder: '08:30, 09:00, 09:30' }));
    campos.appendChild(campoTexto('adm-tarde', 'Tarde', b.tarde.join(', '), function (v) { b.tarde = partirHoras(v); }, { placeholder: '16:30, 17:00, 17:30' }));
    g2.appendChild(campos);
    cuerpo.appendChild(g2);
  }
  function partirHoras(v) {
    return v.split(/[,;\s]+/).map(function (s) {
      s = s.trim().replace('.', ':').replace('h', '');
      if (/^\d:\d\d$/.test(s)) s = '0' + s;
      if (/^\d{1,2}$/.test(s)) s = (s.length === 1 ? '0' + s : s) + ':00';
      return s;
    }).filter(Boolean);
  }

  /* Pestaña: contacto */
  function panelDatos() {
    var b = borrador('datos');
    cuerpo.appendChild(el('p', 'admin__ayuda', 'Estos datos salen en la sección de contacto y en el pie de la web. Deja un campo vacío para que aparezca «Por confirmar».'));
    var campos = el('div', 'admin__campos');
    campos.appendChild(campoTexto('adm-direccion', 'Dirección', b.direccion, function (v) { b.direccion = v; }, { autocomplete: 'off' }));
    campos.appendChild(campoTexto('adm-email', 'Email', b.email, function (v) { b.email = v; }, { inputmode: 'email', autocomplete: 'off' }));
    campos.appendChild(campoTexto('adm-telefono', 'Teléfono', b.telefono, function (v) { b.telefono = v; }, { inputmode: 'tel', autocomplete: 'off' }));
    campos.appendChild(campoTexto('adm-instagram', 'Instagram', b.instagram, function (v) { b.instagram = v; }, { placeholder: 'usuario', autocomplete: 'off' }));
    campos.appendChild(campoTexto('adm-whatsapp', 'WhatsApp', b.whatsapp, function (v) { b.whatsapp = v; }, { placeholder: '600 123 456', inputmode: 'tel', autocomplete: 'off' }));

    var casilla = el('label', 'casilla');
    var check = el('input'); check.type = 'checkbox'; check.id = 'adm-abrimos'; check.checked = b.abrimosPronto !== false;
    check.addEventListener('change', function () { b.abrimosPronto = check.checked; marcar(); });
    casilla.appendChild(check);
    casilla.appendChild(document.createTextNode('Mostrar el aviso «Abrimos pronto» en la portada'));
    campos.appendChild(casilla);
    cuerpo.appendChild(campos);

    var grupo = el('section', 'admin__grupo');
    grupo.appendChild(el('h3', null, 'Pedidos para llevar'));
    var camposLlevar = el('div', 'admin__campos');
    [['adm-llevar', 'paraLlevar', 'Aceptar pedidos para llevar (muestra la sección en la web)'],
     ['adm-domicilio', 'domicilio', 'Ofrecer entrega a domicilio']].forEach(function (c) {
      var lab = el('label', 'casilla');
      var ch = el('input'); ch.type = 'checkbox'; ch.id = c[0]; ch.checked = b[c[1]] !== false;
      ch.addEventListener('change', function () { b[c[1]] = ch.checked; marcar(); });
      lab.appendChild(ch);
      lab.appendChild(document.createTextNode(c[2]));
      camposLlevar.appendChild(lab);
    });
    grupo.appendChild(camposLlevar);
    cuerpo.appendChild(grupo);
  }

  /* Pestaña: reservas recibidas */
  var fDiaLargo = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
  var fRecibido = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  function fechaBonita(iso) {
    var t = fDiaLargo.format(new Date(iso + 'T12:00:00'));
    return t.charAt(0).toUpperCase() + t.slice(1);
  }

  function panelReservas() {
    cuerpo.appendChild(el('p', 'admin__ayuda', 'Aquí llegan las reservas que se hacen desde la web. Borra las que ya estén atendidas o canceladas. Las de hace más de 90 días se borran solas.'));
    var cont = el('div', 'registros');
    cont.appendChild(el('p', 'estado-vacio', 'Cargando reservas…'));
    cuerpo.appendChild(cont);
    api('GET', '/api/reservas').then(function (r) {
      if (pestana !== 'reservas') return;
      cont.innerHTML = '';
      var proximas = r.reservas.filter(function (x) { return x.fecha >= r.hoy; });
      var pasadas = r.reservas.filter(function (x) { return x.fecha < r.hoy; }).reverse();
      ponerContador('reservas', proximas.length);
      if (!r.reservas.length) { cont.appendChild(el('p', 'estado-vacio', 'Todavía no hay reservas.')); return; }
      var g1 = el('section', 'admin__grupo');
      g1.appendChild(el('h3', null, 'Próximas (' + proximas.length + ')'));
      if (!proximas.length) g1.appendChild(el('p', 'estado-vacio', 'No hay reservas para los próximos días.'));
      proximas.forEach(function (x) { g1.appendChild(tarjetaReserva(x, false)); });
      cont.appendChild(g1);
      if (pasadas.length) {
        var g2 = el('section', 'admin__grupo');
        g2.appendChild(el('h3', null, 'Anteriores (' + pasadas.length + ')'));
        pasadas.forEach(function (x) { g2.appendChild(tarjetaReserva(x, true)); });
        cont.appendChild(g2);
      }
    }).catch(function (err) {
      if (sesionCaducada(err)) return;
      cont.innerHTML = '';
      cont.appendChild(el('p', 'estado-vacio', err.message));
    });
  }
  function tarjetaReserva(x, pasada) {
    var t = el('article', 'registro' + (pasada ? ' registro--pasada' : ''));
    var cab = el('div', 'registro__cabecera');
    cab.appendChild(el('p', 'registro__titulo', fechaBonita(x.fecha) + ' · ' + x.hora + ' · ' + (x.personas === 1 ? '1 persona' : x.personas + ' personas')));
    cab.appendChild(el('p', 'registro__meta', 'Recibida ' + fRecibido.format(new Date(x.creada))));
    t.appendChild(cab);
    var datos = el('p', 'registro__datos');
    var n = el('span'); n.appendChild(el('strong', null, x.nombre)); datos.appendChild(n);
    var tel = el('a', null, x.telefono); tel.href = 'tel:' + x.telefono.replace(/[^\d+]/g, ''); datos.appendChild(tel);
    t.appendChild(datos);
    if (x.notas) t.appendChild(el('p', 'registro__texto', x.notas));
    var acc = el('div', 'acciones-mini');
    acc.appendChild(botonBorrar('Borrar reserva', function () {
      api('DELETE', '/api/reservas/' + x.id).then(function () { panelReservasDeNuevo(); })
        .catch(function (err) { if (!sesionCaducada(err)) mostrarEstado(err.message, true); });
    }));
    t.appendChild(acc);
    return t;
  }
  function panelReservasDeNuevo() { if (pestana === 'reservas') pintarPanel(); }

  /* Pestaña: mensajes del formulario de contacto */
  function panelMensajes() {
    cuerpo.appendChild(el('p', 'admin__ayuda', 'Mensajes que llegan desde el formulario «Escríbenos» de la web.'));
    var cont = el('div', 'registros');
    cont.appendChild(el('p', 'estado-vacio', 'Cargando mensajes…'));
    cuerpo.appendChild(cont);
    api('GET', '/api/mensajes').then(function (r) {
      if (pestana !== 'mensajes') return;
      cont.innerHTML = '';
      ponerContador('mensajes', r.mensajes.length);
      if (!r.mensajes.length) { cont.appendChild(el('p', 'estado-vacio', 'Todavía no hay mensajes.')); return; }
      r.mensajes.forEach(function (m) {
        var t = el('article', 'registro');
        var cab = el('div', 'registro__cabecera');
        cab.appendChild(el('p', 'registro__titulo', m.nombre));
        cab.appendChild(el('p', 'registro__meta', fRecibido.format(new Date(m.creado))));
        t.appendChild(cab);
        var datos = el('p', 'registro__datos');
        var mail = el('a', null, m.email); mail.href = 'mailto:' + m.email; datos.appendChild(mail);
        t.appendChild(datos);
        t.appendChild(el('p', 'registro__texto', m.mensaje));
        var acc = el('div', 'acciones-mini');
        acc.appendChild(botonBorrar('Borrar mensaje', function () {
          api('DELETE', '/api/mensajes/' + m.id).then(function () { if (pestana === 'mensajes') pintarPanel(); })
            .catch(function (err) { if (!sesionCaducada(err)) mostrarEstado(err.message, true); });
        }));
        t.appendChild(acc);
        cont.appendChild(t);
      });
    }).catch(function (err) {
      if (sesionCaducada(err)) return;
      cont.innerHTML = '';
      cont.appendChild(el('p', 'estado-vacio', err.message));
    });
  }

  /* Pestaña: pedidos para llevar */
  var fHora = new Intl.DateTimeFormat('es-ES', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  function panelPedidos() {
    cuerpo.appendChild(el('p', 'admin__ayuda', 'Pedidos para llevar que llegan desde la web, del más nuevo al más antiguo. Bórralos cuando estén entregados. Los de hace más de 30 días se borran solos.'));
    var cont = el('div', 'registros');
    cont.appendChild(el('p', 'estado-vacio', 'Cargando pedidos…'));
    cuerpo.appendChild(cont);
    api('GET', '/api/pedidos').then(function (r) {
      if (pestana !== 'pedidos') return;
      cont.innerHTML = '';
      ponerContador('pedidos', r.pedidos.length);
      if (!r.pedidos.length) { cont.appendChild(el('p', 'estado-vacio', 'Todavía no hay pedidos.')); return; }
      r.pedidos.forEach(function (x) {
        var t = el('article', 'registro');
        var cab = el('div', 'registro__cabecera');
        var titulo = el('p', 'registro__titulo');
        titulo.appendChild(el('span', 'etiqueta-tipo', x.tipo === 'domicilio' ? 'A domicilio' : 'Para recoger'));
        titulo.appendChild(document.createTextNode(x.nombre));
        cab.appendChild(titulo);
        cab.appendChild(el('p', 'registro__meta', fHora.format(new Date(x.creado))));
        t.appendChild(cab);
        var datos = el('p', 'registro__datos');
        var tel = el('a', null, x.telefono); tel.href = 'tel:' + x.telefono.replace(/[^\d+]/g, ''); datos.appendChild(tel);
        if (x.direccion) datos.appendChild(el('span', null, x.direccion));
        t.appendChild(datos);
        if (x.recogida) {
          var cuando = fDiaLargo.format(new Date(x.recogida.fecha + 'T12:00:00'));
          t.appendChild(el('p', 'registro__recogida', 'Pasa a recogerlo el ' + cuando + ' a las ' + x.recogida.hora));
        }
        var ul = el('ul', 'registro__lineas');
        x.lineas.forEach(function (l) {
          var li = el('li');
          li.appendChild(el('span', null, l.cantidad + ' × ' + l.nombre));
          li.appendChild(el('span', null, euros(precioNum(l.precio) * l.cantidad)));
          ul.appendChild(li);
        });
        t.appendChild(ul);
        t.appendChild(el('p', 'registro__total', 'Total: ' + x.total + '\u00a0€'));
        if (x.notas) t.appendChild(el('p', 'registro__texto', x.notas));
        var acc = el('div', 'acciones-mini');
        acc.appendChild(botonBorrar('Borrar pedido', function () {
          api('DELETE', '/api/pedidos/' + x.id).then(function () { if (pestana === 'pedidos') pintarPanel(); })
            .catch(function (err) { if (!sesionCaducada(err)) mostrarEstado(err.message, true); });
        }));
        t.appendChild(acc);
        cont.appendChild(t);
      });
    }).catch(function (err) {
      if (sesionCaducada(err)) return;
      cont.innerHTML = '';
      cont.appendChild(el('p', 'estado-vacio', err.message));
    });
  }

  function ponerContador(pest, n) {
    var tab = $('tab-' + pest);
    var base = { reservas: 'Reservas', mensajes: 'Mensajes', pedidos: 'Pedidos' }[pest];
    tab.textContent = n ? base + ' (' + n + ')' : base;
  }
  function actualizarContadores() {
    api('GET', '/api/reservas').then(function (r) {
      ponerContador('reservas', r.reservas.filter(function (x) { return x.fecha >= r.hoy; }).length);
    }).catch(function () {});
    api('GET', '/api/mensajes').then(function (r) { ponerContador('mensajes', r.mensajes.length); }).catch(function () {});
    api('GET', '/api/pedidos').then(function (r) { ponerContador('pedidos', r.pedidos.length); }).catch(function () {});
  }

  /* Validación y guardado */
  function validar(k, b) {
    if (k === 'carta') {
      for (var g = 0; g < b.categorias.length; g++) {
        if (!texto(b.categorias[g].nombre)) return 'Hay un grupo sin nombre (el ' + (g + 1) + 'º). Escríbelo o borra el grupo.';
      }
      for (var i = 0; i < b.productos.length; i++) {
        var p = b.productos[i];
        if (!texto(p.nombre)) return 'Hay un producto sin nombre en «' + (nombreGrupo(b.categorias, p.cat) || 'la carta') + '». Escríbelo o elimina el producto.';
        if (!RE_PRECIO.test(texto(p.precio))) return 'Revisa el precio de «' + texto(p.nombre) + '»: escribe solo el número, por ejemplo 2,50.';
      }
    }
    if (k === 'horario') {
      var todas = b.manana.concat(b.tarde);
      for (var j = 0; j < todas.length; j++) {
        if (!RE_HORA.test(todas[j])) return 'La hora «' + todas[j] + '» no es válida. Escríbela así: 09:30.';
      }
    }
    if (k === 'datos' && texto(b.email) && texto(b.email).indexOf('@') < 1) {
      return 'Revisa el email: parece que le falta la @.';
    }
    return '';
  }

  function guardar() {
    var k = claveActual();
    if (!k) return Promise.resolve(false);
    var b = borradores[k] || borrador(k);
    var error = validar(k, b);
    if (error) { mostrarEstado(error, true); return Promise.resolve(false); }
    guardando = true;
    btnGuardar.disabled = true;
    mostrarEstado('Guardando…');
    return api('PUT', '/api/contenido/' + k, b).then(function (r) {
      estado[k] = r[k];
      borradores[k] = normalizar(k, clonar(r[k]));
      sucio[k] = false;
      guardando = false;
      var arriba = cuerpo.scrollTop;
      pintarPanel();
      cuerpo.scrollTop = arriba;
      pintarTodo();
      mostrarEstado('Guardado. Ya se ve en la web.');
      return true;
    }).catch(function (err) {
      guardando = false;
      btnGuardar.disabled = false;
      if (!sesionCaducada(err)) mostrarEstado(err.message, true);
      return false;
    });
  }
  btnGuardar.addEventListener('click', guardar);
  btnDescartar.addEventListener('click', function () {
    var k = claveActual();
    if (!k) return;
    sucio[k] = false;
    borradores[k] = null;
    pintarPanel();
    mostrarEstado('Cambios descartados.');
  });

  /* Fotos: reducir en el navegador y subir */
  function reducirImagen(file) {
    return new Promise(function (resolve) {
      if (!/^image\/(jpeg|png|webp)$/.test(file.type)) { resolve(file); return; }
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        try {
          var max = 1800;
          var w = img.naturalWidth, h = img.naturalHeight;
          var k = Math.min(1, max / Math.max(w, h));
          var c = document.createElement('canvas');
          c.width = Math.round(w * k); c.height = Math.round(h * k);
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          c.toBlob(function (bl) {
            URL.revokeObjectURL(url);
            resolve(bl && bl.size < file.size ? bl : file);
          }, 'image/jpeg', 0.82);
        } catch (e) { URL.revokeObjectURL(url); resolve(file); }
      };
      img.onerror = function () { URL.revokeObjectURL(url); resolve(file); };
      img.src = url;
    });
  }
  function subirFoto(file, alTerminar) {
    mostrarEstado('Subiendo foto…');
    reducirImagen(file).then(function (blob) {
      return api('POST', '/api/fotos', blob, { binario: true });
    }).then(function (r) {
      alTerminar(r.id);
      sucio[claveActual()] = true;
      pintarPanel();
      return guardar();
    }).catch(function (err) {
      if (!sesionCaducada(err)) mostrarEstado(err.message, true);
    });
  }

  /* ---------- Cabecera y aparición suave de los bloques ---------- */
  (function () {
    var cab = $('cabecera');
    if (!('IntersectionObserver' in window)) { cab.classList.add('con-linea'); return; }
    // Línea fina bajo la cabecera en cuanto se baja un poco
    var marca = el('div');
    marca.setAttribute('aria-hidden', 'true');
    marca.style.cssText = 'position:absolute;top:0;left:0;width:1px;height:8px;pointer-events:none';
    document.body.insertBefore(marca, document.body.firstChild);
    new IntersectionObserver(function (e) { cab.classList.toggle('con-linea', !e[0].isIntersecting); }).observe(marca);

    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    // Solo se ocultan los bloques que aún no se ven, así nada parpadea al cargar
    var alto = window.innerHeight;
    var obs = new IntersectionObserver(function (entradas) {
      entradas.forEach(function (en) {
        if (!en.isIntersecting) return;
        var n = en.target;
        obs.unobserve(n);
        if (n.classList.contains('en-espera')) { n.classList.remove('en-espera'); animarLista(n); }
        else n.classList.add('aparecido');
      });
    }, { rootMargin: '0px 0px -8% 0px' });
    document.querySelectorAll('[data-aparece]').forEach(function (n) {
      if (n.getBoundingClientRect().top > alto * 0.92) { n.classList.add('por-aparecer'); obs.observe(n); }
    });
    // Las tarjetas de la carta aún no existen (llegan con los datos): se mira dónde está la sección
    var bajoCarta = $('carta-grupos').getBoundingClientRect().top > alto * 0.92;
    [$('carta-favoritos'), $('carta-grupos')].forEach(function (n) {
      if (bajoCarta) { n.classList.add('en-espera'); obs.observe(n); }
    });
  })();

  /* ---------- Arranque ---------- */
  pintarTodo();
  api('GET', '/api/contenido').then(function (c) {
    estado = { carta: c.carta, galeria: c.galeria, horario: c.horario, datos: c.datos };
    cargado = true;
    pintarTodo();
  }).catch(function () {
    cargado = true;
    sinDatos = true;
    pintarTodo();
  });
  if (location.hash === '#reservar') abrir(modalReserva);
})();
