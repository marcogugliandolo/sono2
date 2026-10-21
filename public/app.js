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
  /* Zonas del local para reservar */
  var TIPOS_ZONA = [
    { id: 'mesas', nombre: 'Mesas' }, { id: 'terraza', nombre: 'Terraza (fuera)' },
    { id: 'lectura', nombre: 'Zona de lectura' }, { id: 'barra', nombre: 'Barra' }
  ];
  var ZONAS_INICIALES = [
    { id: 'interior', nombre: 'Interior', tipo: 'mesas', activa: true },
    { id: 'lectura', nombre: 'Zona de lectura', tipo: 'lectura', activa: true },
    { id: 'terraza', nombre: 'Terraza', tipo: 'terraza', activa: true }
  ];
  var MAX_ZONAS = 6;
  var DIAS_SEMANA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  var PIES_GALERIA = ['El local', 'La barra', 'Latte art', 'Desayunos', 'Buenos ratos'];
  var CLAVE_DE = { carta: 'carta', fotos: 'galeria', horarios: 'horario', datos: 'datos' };
  var RE_PRECIO = /^\d{1,3}([.,]\d{1,2})?$/;
  var RE_HORA = /^([01]\d|2[0-3]):[0-5]\d$/;
  var RE_NIF = /^([0-9]{8}[A-Z]|[XYZ][0-9]{7}[A-Z]|[ABCDEFGHJNPQRSUVW][0-9]{7}[0-9A-J])$/;
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
    pintarClub();
    pintarResenas();
    pintarZonas();
    actualizarResumen();
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

  function zonasActivas() {
    var d = estado.datos || {};
    return (Array.isArray(d.zonas) ? d.zonas : ZONAS_INICIALES).filter(function (z) { return z.activa !== false; });
  }
  function nombreZona(id) {
    var z = zonasActivas().filter(function (x) { return x.id === id; })[0];
    return z ? z.nombre : '';
  }
  /* Mini plano: las zonas de dentro van en el local; la terraza, fuera */
  function pintarZonas() {
    var cont = $('plano-zonas');
    var elegida = seleccion('zona') || '';
    var zonas = zonasActivas();
    $('campo-zona').hidden = !zonas.length;
    cont.innerHTML = '';
    if (!zonas.length) return;
    function opcion(z, cls) {
      var id = 'zona-' + (z ? z.id : 'cualquiera');
      var input = el('input', 'oculto');
      input.type = 'radio';
      input.name = 'zona';
      input.id = id;
      input.value = z ? z.id : '';
      input.checked = (z ? z.id : '') === elegida;
      input.defaultChecked = !z;
      var label = el('label', cls);
      label.htmlFor = id;
      if (z) {
        var dib = svgUso('zona-' + z.tipo);
        dib.setAttribute('viewBox', '0 0 120 60');
        label.appendChild(dib);
      }
      label.appendChild(el('span', null, z ? z.nombre : 'Donde haya sitio'));
      return [input, label];
    }
    var cualquiera = el('div', 'plano__cualquiera');
    opcion(null, 'chip chip--zona').forEach(function (n) { cualquiera.appendChild(n); });
    cont.appendChild(cualquiera);
    var dentro = zonas.filter(function (z) { return z.tipo !== 'terraza'; });
    var fuera = zonas.filter(function (z) { return z.tipo === 'terraza'; });
    if (dentro.length) {
      var local = el('div', 'plano__local');
      dentro.forEach(function (z) { opcion(z, 'zona').forEach(function (n) { local.appendChild(n); }); });
      cont.appendChild(local);
      cont.appendChild(el('p', 'plano__entrada', '↑ Entrada'));
    }
    if (fuera.length) {
      var ext = el('div', 'plano__fuera');
      fuera.forEach(function (z) { opcion(z, 'zona').forEach(function (n) { ext.appendChild(n); }); });
      cont.appendChild(ext);
    }
    if (!formReserva.querySelector('input[name="zona"]:checked')) $('zona-cualquiera').checked = true;
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
    var zona = seleccion('zona');
    if (zona) partes.push(nombreZona(zona));
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
      zona: seleccion('zona') || '',
      nombre: nombre,
      telefono: telefono,
      notas: formReserva.notas.value,
      web: formReserva.web.value
    }).then(function () {
      avisoReserva.textContent = '';
      var zonaElegida = nombreZona(seleccion('zona') || '');
      detalle.textContent = 'Mesa para ' + textoPersonas(personas) + ', ' + dias[+dia] + ' a las ' + hora +
        (zonaElegida ? ', zona ' + zonaElegida : '') + ', a nombre de ' + nombre + '.';
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

  /* ---------- Club SOÑO: tarjeta de sellos ----------
     El socio entra con su email y contraseña y ve su tarjeta en una ventana:
     los sellos (tazas), su QR para enseñarlo en la barra y los últimos movimientos.
     Mientras la tarjeta está abierta se actualiza sola, así el sello aparece al momento. */
  var socio = null;
  var modalClub = $('modal-club');
  var modalTarjeta = $('modal-tarjeta');
  var fCorta = new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
  var fMesAnio = new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' });

  function ajustesClub() {
    var c = (estado.datos && estado.datos.club) || {};
    return { activo: c.activo !== false, sellos: c.sellos || 10, premio: c.premio || 'un desayuno gratis' };
  }
  function codigoBonito(c) { return c ? c.slice(0, 4) + '-' + c.slice(4) : ''; }

  /* Tazas de la tarjeta: las selladas, rellenas y un poco giradas, como un sello de goma */
  function pintarSellos(cont, puestos, necesarios, nuevoDesde) {
    cont.innerHTML = '';
    var columnas = necesarios <= 5 ? necesarios : necesarios <= 10 ? Math.ceil(necesarios / 2) : 5;
    cont.style.setProperty('--columnas', columnas);
    for (var i = 0; i < necesarios; i++) {
      var hueco = el('span', 'sello' + (i < puestos ? ' sello--puesto' : ''));
      hueco.style.setProperty('--giro', ((i * 37) % 13 - 6) + 'deg');
      if (i < puestos && nuevoDesde !== undefined && i >= nuevoDesde) hueco.classList.add('sello--nuevo');
      hueco.appendChild(svgUso('taza'));
      cont.appendChild(hueco);
    }
  }

  /* QR de la tarjeta: «SONO:» + código. Se dibuja como SVG nítido */
  function pintarQR(cont, codigo) {
    cont.innerHTML = '';
    if (typeof window.qrcode !== 'function' || !codigo) {
      cont.appendChild(el('p', 'estado-vacio', 'Enseña este código en la barra: ' + codigoBonito(codigo)));
      return;
    }
    var qr = window.qrcode(0, 'M');
    qr.addData('SONO:' + codigo);
    qr.make();
    var n = qr.getModuleCount();
    var margen = 2;
    var d = '';
    for (var f = 0; f < n; f++) {
      for (var c = 0; c < n; c++) if (qr.isDark(f, c)) d += 'M' + (c + margen) + ' ' + (f + margen) + 'h1v1h-1z';
    }
    var ns = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 ' + (n + margen * 2) + ' ' + (n + margen * 2));
    svg.setAttribute('shape-rendering', 'crispEdges');
    svg.setAttribute('aria-hidden', 'true');
    var fondo = document.createElementNS(ns, 'rect');
    fondo.setAttribute('width', '100%'); fondo.setAttribute('height', '100%'); fondo.setAttribute('class', 'qr__fondo');
    var puntos = document.createElementNS(ns, 'path');
    puntos.setAttribute('d', d); puntos.setAttribute('class', 'qr__puntos');
    svg.appendChild(fondo); svg.appendChild(puntos);
    cont.appendChild(svg);
  }

  function textoMovimiento(m) {
    var quien = m.por ? ' por ' + m.por : '';
    if (m.tipo === 'sello') return { texto: (m.n > 1 ? m.n + ' sellos añadidos' : 'Sello añadido') + quien, valor: '+' + m.n };
    if (m.tipo === 'quitar') return { texto: (m.n > 1 ? m.n + ' sellos corregidos' : 'Sello corregido') + quien, valor: '−' + m.n };
    if (m.tipo === 'canje') return { texto: 'Desayuno gratis canjeado' + quien, valor: 'Premio' };
    return { texto: 'Te uniste al club', valor: '' };
  }
  function pintarMovimientos(ul, historial, vacio) {
    ul.innerHTML = '';
    if (!historial || !historial.length) { ul.appendChild(el('li', 'estado-vacio', vacio)); return; }
    historial.forEach(function (m) {
      var x = textoMovimiento(m);
      var li = el('li', 'movimiento movimiento--' + m.tipo);
      var t = el('span', 'movimiento__texto');
      t.appendChild(document.createTextNode(x.texto));
      t.appendChild(el('span', 'movimiento__fecha', ' · ' + fCorta.format(new Date(m.t))));
      li.appendChild(t);
      li.appendChild(el('span', 'movimiento__valor', x.valor));
      ul.appendChild(li);
    });
  }

  var sellosVistos = null;
  function pintarTarjeta() {
    if (!socio) return;
    var necesarios = socio.necesarios;
    var completa = socio.sellos >= necesarios;
    var puestos = Math.min(socio.sellos, necesarios);
    $('tarjeta-nombre').textContent = 'Hola, ' + socio.nombre.split(' ')[0];
    // Si ha entrado un sello nuevo mientras está abierta, se anima
    var desde = sellosVistos !== null && socio.sellos > sellosVistos ? Math.min(sellosVistos, necesarios) : undefined;
    pintarSellos($('tarjeta-sellos'), puestos, necesarios, desde);
    sellosVistos = socio.sellos;
    $('tarjeta-sellos').setAttribute('aria-label', puestos + ' de ' + necesarios + ' sellos');
    $('tarjeta-barra').style.transform = 'scaleX(' + (puestos / necesarios).toFixed(3) + ')';
    var estadoEl = $('tarjeta-estado');
    estadoEl.classList.toggle('es-premio', completa);
    var faltan = necesarios - socio.sellos;
    estadoEl.textContent = completa
      ? '¡Tarjeta completa! Tienes ' + socio.premio + '. Enseña el QR al pedir.'
      : faltan === 1 ? 'Te falta 1 sello para ' + socio.premio + '.'
      : 'Llevas ' + socio.sellos + ' de ' + necesarios + '. Te faltan ' + faltan + ' sellos para ' + socio.premio + '.';
    pintarQR($('tarjeta-qr'), socio.codigo);
    $('tarjeta-codigo').textContent = codigoBonito(socio.codigo);
    pintarMovimientos($('tarjeta-historial'), socio.historial, 'Aún no hay movimientos.');
    var total = socio.total === 1 ? '1 desayuno' : socio.total + ' desayunos';
    $('tarjeta-total').textContent = total + ' con nosotros · socio desde ' + fMesAnio.format(new Date(socio.desde));
  }

  function pintarClub() {
    var c = ajustesClub();
    document.querySelectorAll('[data-club]').forEach(function (n) { n.hidden = !c.activo; });
    if (!c.activo) {
      if (modalTarjeta.open) cerrar(modalTarjeta);
      if (modalClub.open) cerrar(modalClub);
    }
    $('club-premio').textContent = c.premio;
    $('club-n').textContent = String(c.sellos);
    pintarSellos($('club-muestra-sellos'), Math.min(4, c.sellos - 1), c.sellos);
    var pie = document.querySelector('.club__carton-pie');
    if (pie) {
      pie.firstChild.textContent = Math.min(4, c.sellos - 1) + ' de ' + c.sellos;
      pie.lastChild.textContent = 'Premio al completarla';
    }
    $('club-acciones').hidden = !!socio;
    $('club-acciones-socio').hidden = !socio;
    if (socio) {
      var faltan = socio.necesarios - socio.sellos;
      $('club-hola').textContent = 'Hola, ' + socio.nombre.split(' ')[0] + '. ' +
        (faltan <= 0 ? 'Tienes ' + socio.premio + ' esperándote.' : 'Llevas ' + socio.sellos + ' de ' + socio.necesarios + ' sellos.');
    }
    document.querySelectorAll('[data-enlace-club]').forEach(function (a) { a.textContent = socio ? 'Mi tarjeta' : 'Club'; });
  }

  /* Botones de Wallet: en el iPhone solo Apple, en Android solo Google y en el ordenador los dos
     (cada uno sale solo si está configurado en el servidor) */
  var walletSocio = null;
  function pintarWallet() {
    var ua = navigator.userAgent || '';
    var esIos = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
    var esAndroid = /Android/.test(ua);
    var apple = !!(walletSocio && walletSocio.apple) && !esAndroid;
    var google = !!(walletSocio && walletSocio.google) && !esIos;
    $('wallet-apple').hidden = !apple;
    $('wallet-google').hidden = !google;
    $('tarjeta-wallet').hidden = !apple && !google;
  }

  function ponerSocio(s, w) {
    socio = s;
    if (w !== undefined) walletSocio = w;
    if (!s) walletSocio = null;
    pintarWallet();
    pintarClub();
    if (socio && modalTarjeta.open) pintarTarjeta();
  }

  /* Ventana de acceso: pestañas «Unirme» y «Ya soy socio» */
  function pestanaClub(cual) {
    var alta = cual === 'alta';
    $('club-tab-alta').setAttribute('aria-selected', alta ? 'true' : 'false');
    $('club-tab-entrar').setAttribute('aria-selected', alta ? 'false' : 'true');
    $('club-tab-alta').tabIndex = alta ? 0 : -1;
    $('club-tab-entrar').tabIndex = alta ? -1 : 0;
    $('form-club-alta').hidden = !alta;
    $('form-club-entrar').hidden = alta;
    $('t-club-acceso').textContent = alta ? 'Únete al club' : 'Entra en tu tarjeta';
  }
  function abrirAccesoClub(cual) {
    pestanaClub(cual);
    $('aviso-club-alta').textContent = '';
    $('aviso-club-entrar').textContent = '';
    abrir(modalClub);
    setTimeout(function () { (cual === 'alta' ? $('club-nombre') : $('club-entrar-email')).focus(); }, 60);
  }
  $('club-tab-alta').addEventListener('click', function () { pestanaClub('alta'); });
  $('club-tab-entrar').addEventListener('click', function () { pestanaClub('entrar'); });
  document.querySelectorAll('[data-club-alta]').forEach(function (b) { b.addEventListener('click', function () { abrirAccesoClub('alta'); }); });
  document.querySelectorAll('[data-club-entrar]').forEach(function (b) { b.addEventListener('click', function () { abrirAccesoClub('entrar'); }); });

  /* La tarjeta se actualiza sola mientras está abierta */
  var relojTarjeta = null;
  function abrirTarjeta() {
    if (!socio) { abrirAccesoClub('entrar'); return; }
    sellosVistos = null;
    $('form-baja').hidden = true;
    pintarTarjeta();
    abrir(modalTarjeta);
    clearInterval(relojTarjeta);
    relojTarjeta = setInterval(function () {
      if (document.hidden || !modalTarjeta.open) return;
      api('GET', '/api/club/yo').then(function (r) {
        if (!r.socio) { ponerSocio(null); cerrar(modalTarjeta); abrirAccesoClub('entrar'); return; }
        var cambio = !socio || r.socio.sellos !== socio.sellos || r.socio.historial.length !== socio.historial.length ||
          (r.socio.historial[0] && socio.historial[0] && r.socio.historial[0].t !== socio.historial[0].t);
        socio = r.socio;
        if (r.wallet) { walletSocio = r.wallet; pintarWallet(); }
        if (cambio) { pintarTarjeta(); pintarClub(); }
      }).catch(function () {});
    }, 5000);
  }
  modalTarjeta.addEventListener('close', function () { clearInterval(relojTarjeta); relojTarjeta = null; });
  document.querySelectorAll('[data-abrir-tarjeta]').forEach(function (b) { b.addEventListener('click', abrirTarjeta); });
  document.querySelectorAll('[data-enlace-club]').forEach(function (a) {
    a.addEventListener('click', function (e) { if (socio) { e.preventDefault(); abrirTarjeta(); } });
  });

  function enviarClub(form, ruta, datos, aviso) {
    var boton = form.querySelector('button[type="submit"]');
    boton.disabled = true;
    aviso.textContent = '';
    return api('POST', ruta, datos).then(function (r) {
      form.reset();
      ponerSocio(r.socio, r.wallet);
      cerrar(modalClub);
      abrirTarjeta();
    }).catch(function (err) {
      aviso.textContent = err.message;
    }).then(function () { boton.disabled = false; });
  }
  $('form-club-alta').addEventListener('submit', function (e) {
    e.preventDefault();
    var f = e.target;
    var aviso = $('aviso-club-alta');
    if (f.nombre.value.trim().length < 2) { aviso.textContent = 'Escribe tu nombre para la tarjeta.'; f.nombre.focus(); return; }
    if (f.email.value.trim().indexOf('@') < 1) { aviso.textContent = 'Revisa el email: parece que le falta algo.'; f.email.focus(); return; }
    if (f.clave.value.length < 8) { aviso.textContent = 'La contraseña necesita al menos 8 caracteres.'; f.clave.focus(); return; }
    if (!f.acepto.checked) { aviso.textContent = 'Para unirte tienes que aceptar que guardemos tus datos del club.'; return; }
    enviarClub(f, '/api/club/alta', {
      nombre: f.nombre.value, email: f.email.value, telefono: f.telefono.value,
      clave: f.clave.value, acepto: true, web: f.web.value
    }, aviso);
  });
  $('form-club-entrar').addEventListener('submit', function (e) {
    e.preventDefault();
    var f = e.target;
    var aviso = $('aviso-club-entrar');
    if (!f.email.value.trim() || !f.clave.value) { aviso.textContent = 'Escribe tu email y tu contraseña.'; return; }
    enviarClub(f, '/api/club/entrar', { email: f.email.value, clave: f.clave.value }, aviso);
  });

  $('club-salir').addEventListener('click', function () {
    api('POST', '/api/club/salir').catch(function () {}).then(function () {
      ponerSocio(null);
      cerrar(modalTarjeta);
    });
  });
  $('club-baja').addEventListener('click', function () {
    $('form-baja').hidden = false;
    $('aviso-baja').textContent = '';
    $('baja-clave').focus();
  });
  $('baja-cancelar').addEventListener('click', function () { $('form-baja').reset(); $('form-baja').hidden = true; });
  $('form-baja').addEventListener('submit', function (e) {
    e.preventDefault();
    var f = e.target;
    if (!f.clave.value) { $('aviso-baja').textContent = 'Escribe tu contraseña para confirmarlo.'; return; }
    api('POST', '/api/club/baja', { clave: f.clave.value }).then(function () {
      f.reset();
      ponerSocio(null);
      cerrar(modalTarjeta);
    }).catch(function (err) { $('aviso-baja').textContent = err.message; });
  });

  /* ---------- Reseñas ----------
     Las publicadas salen en un slider de tarjetas (3 a la vez en el ordenador, 2 en la tableta
     y 1 asomando la siguiente en el móvil), con la nota media arriba. Se pasa con el dedo,
     arrastrando con el ratón o con el teclado; la barra de abajo indica por dónde vas.
     Las nuevas llegan al panel «por revisar» y no salen hasta que el personal las publica. */
  var modalResena = $('modal-resena');
  var formResena = $('form-resena');
  var listaResenas = $('resenas-lista');
  var controlesResenas = $('resenas-controles');
  var barraResenas = $('resenas-progreso');
  var opiniones = { lista: [], total: 0, media: 0, cargadas: false, error: false };
  var NOTAS_ESTRELLAS = ['Toca las estrellas para valorar', 'Mal', 'Regular', 'Bien', 'Muy bien', '¡Genial!'];
  var valorResena = 0;

  function resenasActivas() {
    var r = estado.datos && estado.datos.resenas;
    return !(r && r.activo === false);
  }
  function numeroBonito(n) { return (Math.round(n * 10) / 10).toFixed(1).replace('.', ','); }
  function svgEstrella() {
    var ns = 'http://www.w3.org/2000/svg';
    var s = document.createElementNS(ns, 'svg');
    s.setAttribute('viewBox', '0 0 24 24');
    s.setAttribute('aria-hidden', 'true');
    var u = document.createElementNS(ns, 'use');
    u.setAttribute('href', '#i-estrella');
    s.appendChild(u);
    return s;
  }
  function dibujarEstrellas(cont, n) {
    cont.innerHTML = '';
    var llenas = Math.round(n);
    for (var i = 1; i <= 5; i++) {
      var s = svgEstrella();
      if (i <= llenas) s.setAttribute('class', 'es-llena');
      cont.appendChild(s);
    }
    cont.setAttribute('role', 'img');
    cont.setAttribute('aria-label', (n % 1 ? numeroBonito(n) : String(n)) + ' de 5 estrellas');
  }

  function tarjetaResena(r) {
    var li = el('li', 'resena');
    var cab = el('div', 'resena__cabeza');
    var est = el('span', 'estrellas estrellas--peque');
    dibujarEstrellas(est, r.estrellas);
    cab.appendChild(est);
    var fecha = el('time', 'resena__fecha', fMesAnio.format(new Date(r.fecha)));
    fecha.dateTime = String(r.fecha).slice(0, 10);
    cab.appendChild(fecha);
    li.appendChild(cab);
    var cita = el('blockquote', 'resena__texto');
    cita.appendChild(el('p', null, r.texto));
    li.appendChild(cita);
    var autor = el('div', 'resena__autor');
    var inicial = el('span', 'resena__inicial', (Array.from(r.nombre)[0] || '').toUpperCase());
    inicial.setAttribute('aria-hidden', 'true');
    autor.appendChild(inicial);
    var quien = el('div', 'resena__quien');
    quien.appendChild(el('span', 'resena__nombre', r.nombre));
    if (r.socio) quien.appendChild(el('span', 'resena__socio', 'Socio del club'));
    autor.appendChild(quien);
    li.appendChild(autor);
    if (r.respuesta) {
      var resp = el('div', 'resena__respuesta');
      resp.appendChild(el('p', 'meta', 'Respuesta de SOÑO'));
      resp.appendChild(el('p', null, r.respuesta));
      li.appendChild(resp);
    }
    return li;
  }

  function pintarResenas() {
    var activas = resenasActivas();
    document.querySelectorAll('[data-resenas]').forEach(function (n) { n.hidden = !activas; });
    if (!activas) {
      if (modalResena.open) cerrar(modalResena);
      return;
    }
    $('resenas-media').hidden = !opiniones.total;
    if (opiniones.total) {
      $('resenas-nota').textContent = numeroBonito(opiniones.media);
      dibujarEstrellas($('resenas-estrellas'), opiniones.media);
      $('resenas-total').textContent = opiniones.total === 1 ? '1 reseña' : opiniones.total + ' reseñas';
    }
    listaResenas.innerHTML = '';
    listaResenas.scrollLeft = 0;
    if (opiniones.error) {
      listaResenas.appendChild(el('li', 'estado-vacio', 'Ahora mismo no se pueden cargar las reseñas.'));
    } else if (opiniones.cargadas && !opiniones.lista.length) {
      var vacio = el('li', 'resenas__vacio');
      vacio.appendChild(svgUso('taza'));
      var txt = el('div', 'resenas__vacio-texto');
      txt.appendChild(el('p', 'resenas__vacio-titulo', 'Aún no hay reseñas'));
      txt.appendChild(el('p', null, '¿Ya nos conoces? Cuéntanos qué tal: la tuya puede ser la primera.'));
      vacio.appendChild(txt);
      var b = el('button', 'boton boton--borde', 'Escribir la primera');
      b.type = 'button';
      b.addEventListener('click', abrirResena);
      vacio.appendChild(b);
      listaResenas.appendChild(vacio);
    } else {
      opiniones.lista.forEach(function (r) { listaResenas.appendChild(tarjetaResena(r)); });
      marcarResenasLargas();
    }
    actualizarSlider();
  }

  /* Las reseñas largas se cortan a unas líneas, con «Leer entera» para verlas completas */
  function marcarResenasLargas() {
    listaResenas.querySelectorAll('.resena').forEach(function (li) {
      var cortados = li.querySelectorAll('.resena__texto p, .resena__respuesta p:last-child');
      var hayMas = Array.prototype.some.call(cortados, function (p) { return p.scrollHeight > p.clientHeight + 2; });
      if (!hayMas) return;
      var b = el('button', 'resena__mas', 'Leer entera');
      b.type = 'button';
      b.setAttribute('aria-expanded', 'false');
      b.addEventListener('click', function () {
        var abierta = li.classList.toggle('es-entera');
        b.textContent = abierta ? 'Leer menos' : 'Leer entera';
        b.setAttribute('aria-expanded', abierta ? 'true' : 'false');
      });
      li.querySelector('.resena__texto').appendChild(b);
    });
  }

  /* El slider: barra de progreso y arrastre con el ratón */
  function suaveONo() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
  }
  function actualizarSlider() {
    var max = listaResenas.scrollWidth - listaResenas.clientWidth;
    var desliza = max > 4 && !!listaResenas.querySelector('.resena');
    controlesResenas.hidden = !desliza;
    listaResenas.classList.toggle('desliza', desliza);
    if (!desliza) return;
    var visible = listaResenas.clientWidth / listaResenas.scrollWidth;
    var pos = Math.min(1, Math.max(0, listaResenas.scrollLeft / max));
    barraResenas.style.width = (visible * 100).toFixed(2) + '%';
    barraResenas.style.left = (pos * (1 - visible) * 100).toFixed(2) + '%';
  }
  var sliderPendiente = false;
  listaResenas.addEventListener('scroll', function () {
    if (sliderPendiente) return;
    sliderPendiente = true;
    requestAnimationFrame(function () { sliderPendiente = false; actualizarSlider(); });
  }, { passive: true });
  window.addEventListener('resize', actualizarSlider);

  // Arrastrar con el ratón (con el dedo ya se desliza solo)
  (function () {
    var arrastre = null;
    listaResenas.addEventListener('pointerdown', function (e) {
      if (e.pointerType !== 'mouse' || e.button !== 0 || !listaResenas.classList.contains('desliza')) return;
      arrastre = { x: e.clientX, inicio: listaResenas.scrollLeft, movido: false, id: e.pointerId };
    });
    listaResenas.addEventListener('pointermove', function (e) {
      if (!arrastre) return;
      var dx = e.clientX - arrastre.x;
      if (!arrastre.movido) {
        if (Math.abs(dx) < 6) return;
        arrastre.movido = true;
        listaResenas.classList.add('arrastrando');
        try { listaResenas.setPointerCapture(arrastre.id); } catch (err) { /* sin captura, también vale */ }
      }
      listaResenas.scrollLeft = arrastre.inicio - dx;
    });
    function soltar() {
      if (!arrastre) return;
      var movido = arrastre.movido;
      arrastre = null;
      if (!movido) return;
      listaResenas.classList.remove('arrastrando');
      // Queda encajada en la tarjeta más cercana
      var primera = listaResenas.firstElementChild;
      var mejor = 0;
      Array.prototype.forEach.call(listaResenas.children, function (li) {
        var x = li.offsetLeft - primera.offsetLeft;
        if (Math.abs(x - listaResenas.scrollLeft) < Math.abs(mejor - listaResenas.scrollLeft)) mejor = x;
      });
      listaResenas.scrollTo({ left: mejor, behavior: suaveONo() });
      // El clic que sigue al arrastre no cuenta (no abre «Leer entera» sin querer)
      function parar(ev) { ev.stopPropagation(); ev.preventDefault(); }
      listaResenas.addEventListener('click', parar, true);
      setTimeout(function () { listaResenas.removeEventListener('click', parar, true); }, 0);
    }
    listaResenas.addEventListener('pointerup', soltar);
    listaResenas.addEventListener('pointercancel', soltar);
  })();

  function cargarResenas() {
    if (!resenasActivas()) { pintarResenas(); return; }
    api('GET', '/api/resenas').then(function (r) {
      opiniones.lista = r.resenas || [];
      opiniones.total = r.total || 0;
      opiniones.media = r.media || 0;
      opiniones.cargadas = true;
      opiniones.error = false;
      pintarResenas();
    }).catch(function () {
      opiniones.error = !opiniones.cargadas;
      pintarResenas();
    });
  }

  /* Ventana para escribir una reseña: estrellas, nombre y comentario */
  function pintarEstrellasElegidas(n) {
    document.querySelectorAll('#elegir-estrellas label').forEach(function (l, i) { l.classList.toggle('es-llena', i < n); });
    $('resena-valoracion').textContent = NOTAS_ESTRELLAS[n] || NOTAS_ESTRELLAS[0];
  }
  document.querySelectorAll('#elegir-estrellas input').forEach(function (input) {
    input.addEventListener('change', function () {
      valorResena = Number(input.value);
      pintarEstrellasElegidas(valorResena);
    });
  });
  document.querySelectorAll('#elegir-estrellas label').forEach(function (l, i) {
    l.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse') pintarEstrellasElegidas(i + 1); });
  });
  document.querySelector('#elegir-estrellas .elegir-estrellas__fila').addEventListener('pointerleave', function () {
    pintarEstrellasElegidas(valorResena);
  });
  $('resena-texto').addEventListener('input', function () {
    $('resena-contador').textContent = $('resena-texto').value.length + ' / 600';
  });
  formResena.addEventListener('input', function () { $('aviso-resena').textContent = ''; });
  formResena.addEventListener('change', function () { $('aviso-resena').textContent = ''; });

  function abrirResena() {
    if (!resenasActivas()) return;
    formResena.hidden = false;
    $('resena-gracias').hidden = true;
    $('aviso-resena').textContent = '';
    if (socio && !formResena.nombre.value) formResena.nombre.value = socio.nombre.split(' ')[0];
    abrir(modalResena);
  }
  document.querySelectorAll('[data-escribir-resena]').forEach(function (b) { b.addEventListener('click', abrirResena); });

  formResena.addEventListener('submit', function (e) {
    e.preventDefault();
    var f = formResena;
    var aviso = $('aviso-resena');
    if (!valorResena) { aviso.textContent = 'Elige de 1 a 5 estrellas.'; f.querySelector('input[name="estrellas"]').focus(); return; }
    if (f.nombre.value.trim().length < 2) { aviso.textContent = 'Escribe tu nombre: así saldrá en la reseña.'; f.nombre.focus(); return; }
    if (f.texto.value.trim().length < 10) { aviso.textContent = 'Cuéntanos un poco más: al menos 10 caracteres.'; f.texto.focus(); return; }
    if (!f.acepto.checked) { aviso.textContent = 'Para publicarla necesitamos que aceptes que salga con tu nombre.'; f.acepto.focus(); return; }
    var boton = f.querySelector('button[type="submit"]');
    boton.disabled = true;
    aviso.textContent = '';
    api('POST', '/api/resenas', {
      estrellas: valorResena, nombre: f.nombre.value, texto: f.texto.value, acepto: true, web: f.web.value
    }).then(function () {
      f.reset();
      valorResena = 0;
      pintarEstrellasElegidas(0);
      $('resena-contador').textContent = '0 / 600';
      f.hidden = true;
      $('resena-gracias').hidden = false;
      $('resena-gracias').querySelector('button').focus();
    }).catch(function (err) {
      aviso.textContent = err.message;
    }).then(function () { boton.disabled = false; });
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
    if (k === 'datos' && !Array.isArray(b.zonas)) b.zonas = clonar(ZONAS_INICIALES);
    if (k === 'datos' && (!b.club || typeof b.club !== 'object')) b.club = { activo: true, sellos: 10, premio: 'un desayuno gratis' };
    if (k === 'datos' && (!b.resenas || typeof b.resenas !== 'object')) b.resenas = { activo: true };
    if (k === 'datos' && (!b.legal || typeof b.legal !== 'object')) b.legal = { titular: '', nif: '', domicilio: '', email: '', registro: '' };
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
    pararEscaner();
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
    if (pestana === 'club') panelClub();
    if (pestana === 'resenas') panelResenas();
    if (pestana === 'historial') panelHistorial();
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

    var gz = el('section', 'admin__grupo');
    gz.appendChild(el('h3', null, 'Zonas para reservar'));
    gz.appendChild(el('p', 'admin__ayuda', 'Salen en un mini plano al reservar mesa. Las de tipo «Terraza» se dibujan fuera del local. Desmarca una zona para que no se pueda elegir.'));
    var listaZonas = el('div', 'zonas-admin');
    b.zonas.forEach(function (z, n) {
      var fila = el('div', 'zona-admin');
      fila.appendChild(campoTexto('adm-zona-nombre-' + z.id, 'Nombre', z.nombre, function (v) { z.nombre = v; }, { maxlength: '30', placeholder: 'Terraza' }));
      var campoTipo = el('div', 'campo');
      var lt = el('label', null, 'Dibujo'); lt.htmlFor = 'adm-zona-tipo-' + z.id;
      var sel = el('select'); sel.id = 'adm-zona-tipo-' + z.id;
      TIPOS_ZONA.forEach(function (t) {
        var o = el('option', null, t.nombre); o.value = t.id;
        if (t.id === z.tipo) o.selected = true;
        sel.appendChild(o);
      });
      sel.addEventListener('change', function () { z.tipo = sel.value; marcar(); });
      campoTipo.appendChild(lt); campoTipo.appendChild(sel);
      fila.appendChild(campoTipo);
      var lab = el('label', 'casilla');
      var ch = el('input'); ch.type = 'checkbox'; ch.id = 'adm-zona-activa-' + z.id; ch.checked = z.activa !== false;
      ch.addEventListener('change', function () { z.activa = ch.checked; marcar(); });
      lab.appendChild(ch); lab.appendChild(document.createTextNode('Se puede reservar'));
      fila.appendChild(lab);
      fila.appendChild(botonBorrar('Quitar zona', function () { b.zonas.splice(n, 1); marcar(); pintarPanel(); }));
      listaZonas.appendChild(fila);
    });
    gz.appendChild(listaZonas);
    var nuevaZona = botonMini('+ Añadir zona', function () {
      var z = { id: 'z' + Date.now().toString(36), nombre: '', tipo: 'mesas', activa: true };
      b.zonas.push(z);
      marcar();
      pintarPanel();
      var campo = $('adm-zona-nombre-' + z.id);
      if (campo) enfocarEnPanel(campo);
    });
    nuevaZona.disabled = b.zonas.length >= MAX_ZONAS;
    gz.appendChild(nuevaZona);
    cuerpo.appendChild(gz);

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

    var gc = el('section', 'admin__grupo');
    gc.appendChild(el('h3', null, 'Club SOÑO'));
    gc.appendChild(el('p', 'admin__ayuda', 'Tarjeta de sellos para los socios. Cada desayuno es un sello; al completar la tarjeta, el socio tiene el premio. Para activar o desactivar el club y poner sellos, ve a la pestaña «Club».'));
    var camposClub = el('div', 'admin__campos');
    var filaClub = el('div', 'fila-2');
    filaClub.appendChild(campoTexto('adm-club-premio', 'Premio al completar la tarjeta', b.club.premio, function (v) { b.club.premio = v; }, { maxlength: '60', placeholder: 'un desayuno gratis' }));
    filaClub.appendChild(campoTexto('adm-club-sellos', 'Sellos de la tarjeta', String(b.club.sellos), function (v) { b.club.sellos = Number(String(v).trim()); }, { inputmode: 'numeric', placeholder: '10' }));
    camposClub.appendChild(filaClub);
    gc.appendChild(camposClub);
    cuerpo.appendChild(gc);

    var gl = el('section', 'admin__grupo');
    gl.appendChild(el('h3', null, 'Datos legales'));
    var ayudaLegal = el('p', 'admin__ayuda');
    ayudaLegal.appendChild(document.createTextNode('Salen en el aviso legal y en la política de privacidad, que se abren desde el pie de la web. Si el domicilio o el email son los de arriba, déjalos vacíos. '));
    var verLegal = el('a', 'enlace', 'Ver los textos legales');
    verLegal.href = '/aviso-legal';
    verLegal.target = '_blank';
    verLegal.rel = 'noopener';
    ayudaLegal.appendChild(verLegal);
    gl.appendChild(ayudaLegal);
    if (!texto(b.legal.titular) || !texto(b.legal.nif)) {
      gl.appendChild(el('p', 'admin__alerta', 'Falta el titular o el NIF/CIF: la ley pide que salgan en el aviso legal de la web.'));
    }
    var camposLegal = el('div', 'admin__campos');
    var filaLegal = el('div', 'fila-2 fila-2--legal');
    filaLegal.appendChild(campoTexto('adm-legal-titular', 'Titular: nombre y apellidos o razón social', b.legal.titular, function (v) { b.legal.titular = v; }, { maxlength: '120', autocomplete: 'off' }));
    filaLegal.appendChild(campoTexto('adm-legal-nif', 'NIF o CIF', b.legal.nif, function (v) { b.legal.nif = v; }, { maxlength: '20', placeholder: 'Ej.: 12345678Z', autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false' }));
    camposLegal.appendChild(filaLegal);
    camposLegal.appendChild(campoTexto('adm-legal-domicilio', 'Domicilio del titular', b.legal.domicilio, function (v) { b.legal.domicilio = v; }, { maxlength: '200', placeholder: 'Si es distinto de la dirección del local', autocomplete: 'off' }));
    camposLegal.appendChild(campoTexto('adm-legal-email', 'Email para temas de privacidad', b.legal.email, function (v) { b.legal.email = v; }, { maxlength: '120', placeholder: 'Si es distinto del email de contacto', inputmode: 'email', autocomplete: 'off' }));
    camposLegal.appendChild(campoTexto('adm-legal-registro', 'Datos del Registro Mercantil (solo si es una sociedad)', b.legal.registro, function (v) { b.legal.registro = v; }, { maxlength: '200', placeholder: 'Registro Mercantil de …, tomo …, folio …, hoja …', autocomplete: 'off' }));
    gl.appendChild(camposLegal);
    cuerpo.appendChild(gl);
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
    if (x.zonaNombre) t.appendChild(el('p', 'registro__recogida', 'Zona: ' + x.zonaNombre));
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
    cuerpo.appendChild(el('p', 'admin__ayuda', 'Mensajes que llegan desde el formulario «Escríbenos» de la web. Bórralos cuando estén atendidos. Los de hace más de un año se borran solos.'));
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

  /* Pestaña: Reseñas
     Las nuevas llegan «por revisar» y no salen en la web hasta que se publican.
     Arriba, el interruptor para enseñar u ocultar la sección en la web. */
  var panelOpiniones = { filtro: 'pendiente', datos: null };
  var NOMBRE_ESTADO = { pendiente: 'Por revisar', publicada: 'Publicada', oculta: 'Oculta' };

  function avisoResenas(t, esError, esOk) {
    var a = $('resenas-aviso');
    if (!a) return;
    a.textContent = t || '';
    a.classList.toggle('es-error', !!esError);
    a.classList.toggle('es-ok', !!esOk && !esError);
  }

  function panelResenas() {
    var activo = resenasActivas();
    var bloque = el('section', 'club-admin__estado' + (activo ? ' es-activo' : ''));
    var interruptor = el('label', 'interruptor');
    var ch = el('input');
    ch.type = 'checkbox';
    ch.id = 'resenas-activo';
    ch.setAttribute('role', 'switch');
    ch.checked = activo;
    interruptor.appendChild(ch);
    interruptor.appendChild(el('span', 'interruptor__pista'));
    interruptor.appendChild(el('span', 'interruptor__texto', 'Reseñas activas en la web'));
    bloque.appendChild(interruptor);
    var explica = el('p', 'club-admin__estado-texto');
    bloque.appendChild(explica);
    function textoEstado(si) {
      explica.textContent = si
        ? 'La web muestra las reseñas publicadas y deja escribir nuevas.'
        : 'La sección de reseñas no sale en la web y nadie puede escribir una. Las que ya hay se guardan.';
      bloque.classList.toggle('es-activo', si);
    }
    textoEstado(activo);
    ch.addEventListener('change', function () {
      var quiere = ch.checked;
      ch.disabled = true;
      api('POST', '/api/resenas/activo', { activo: quiere }).then(function (r) {
        estado.datos.resenas = r.resenas;
        if (borradores.datos) borradores.datos.resenas = Object.assign({}, borradores.datos.resenas, { activo: r.resenas.activo });
        textoEstado(r.resenas.activo);
        cargarResenas();
        avisoResenas(r.resenas.activo ? 'Reseñas activadas: ya se ven en la web.' : 'Reseñas desactivadas: ya no salen en la web.', false, true);
      }).catch(function (err) {
        ch.checked = !quiere;
        if (!sesionCaducada(err)) avisoResenas(err.message, true);
      }).then(function () { ch.disabled = false; });
    });
    cuerpo.appendChild(bloque);

    cuerpo.appendChild(el('p', 'admin__ayuda', 'Las reseñas que escriben los clientes llegan aquí «por revisar» y no salen en la web hasta que pulsas «Publicar». Publica también las negativas si son respetuosas: es lo que da confianza, y así lo explica el aviso legal. Borra las que tengan insultos, datos de otras personas o publicidad. Puedes responder a cualquiera: la respuesta sale debajo.'));
    var pAviso = el('p', 'resenas-admin__aviso');
    pAviso.id = 'resenas-aviso';
    pAviso.setAttribute('aria-live', 'polite');
    cuerpo.appendChild(pAviso);
    var resumenEl = el('p', 'resenas-admin__resumen');
    resumenEl.id = 'resenas-resumen';
    cuerpo.appendChild(resumenEl);
    var filtros = el('div', 'historial__filtros');
    filtros.id = 'resenas-filtros';
    filtros.setAttribute('role', 'group');
    filtros.setAttribute('aria-label', 'Ver reseñas');
    cuerpo.appendChild(filtros);
    var lista = el('div', 'registros');
    lista.id = 'resenas-admin-lista';
    lista.appendChild(el('p', 'estado-vacio', 'Cargando reseñas…'));
    cuerpo.appendChild(lista);
    if (panelOpiniones.datos) pintarListaResenasAdmin();
    cargarResenasAdmin();
  }

  function cargarResenasAdmin() {
    return api('GET', '/api/resenas/todas').then(function (r) {
      panelOpiniones.datos = r;
      ponerContador('resenas', r.pendientes);
      if (pestana === 'resenas') pintarListaResenasAdmin();
    }).catch(function (err) {
      if (sesionCaducada(err)) return;
      var lista = $('resenas-admin-lista');
      if (lista && pestana === 'resenas') { lista.innerHTML = ''; lista.appendChild(el('p', 'estado-vacio', err.message)); }
    });
  }

  function pintarListaResenasAdmin() {
    var d = panelOpiniones.datos;
    var lista = $('resenas-admin-lista');
    if (!d || !lista) return;
    var cuenta = { pendiente: 0, publicada: 0, oculta: 0 };
    d.resenas.forEach(function (r) { cuenta[r.estado] = (cuenta[r.estado] || 0) + 1; });
    $('resenas-resumen').textContent = d.total
      ? 'Nota media en la web: ' + numeroBonito(d.media) + ' de 5, con ' + (d.total === 1 ? '1 reseña publicada.' : d.total + ' reseñas publicadas.')
      : 'Aún no hay ninguna reseña publicada en la web.';
    var filtros = $('resenas-filtros');
    filtros.innerHTML = '';
    [['pendiente', 'Por revisar'], ['publicada', 'Publicadas'], ['oculta', 'Ocultas'], ['', 'Todas']].forEach(function (f) {
      var n = f[0] ? cuenta[f[0]] : d.resenas.length;
      var b = el('button', 'historial__filtro', f[1] + ' (' + n + ')');
      b.type = 'button';
      b.setAttribute('aria-pressed', panelOpiniones.filtro === f[0] ? 'true' : 'false');
      b.addEventListener('click', function () { panelOpiniones.filtro = f[0]; pintarListaResenasAdmin(); });
      filtros.appendChild(b);
    });
    lista.innerHTML = '';
    var visibles = d.resenas.filter(function (r) { return !panelOpiniones.filtro || r.estado === panelOpiniones.filtro; });
    if (!visibles.length) {
      lista.appendChild(el('p', 'estado-vacio', panelOpiniones.filtro === 'pendiente' ? 'No hay reseñas por revisar.' : 'No hay reseñas en este apartado.'));
      return;
    }
    visibles.forEach(function (r) { lista.appendChild(tarjetaResenaAdmin(r)); });
  }

  function accionResena(r, datos, textoOk) {
    return api('POST', '/api/resenas/' + r.id, datos).then(function () {
      avisoResenas(textoOk, false, true);
      cargarResenasAdmin();
      cargarResenas();
    }).catch(function (err) {
      if (!sesionCaducada(err)) avisoResenas(err.message, true);
      if (pestana === 'resenas') pintarListaResenasAdmin();
    });
  }

  function tarjetaResenaAdmin(r) {
    var t = el('article', 'registro resena-admin resena-admin--' + r.estado);
    var cab = el('div', 'registro__cabecera');
    var titulo = el('p', 'registro__titulo');
    titulo.appendChild(el('span', 'etiqueta-tipo', NOMBRE_ESTADO[r.estado] || r.estado));
    titulo.appendChild(document.createTextNode(r.nombre));
    if (r.socio) titulo.appendChild(el('span', 'resena__socio', 'Socio del club'));
    cab.appendChild(titulo);
    cab.appendChild(el('p', 'registro__meta', fRecibido.format(new Date(r.creada))));
    t.appendChild(cab);
    var est = el('span', 'estrellas estrellas--peque');
    dibujarEstrellas(est, r.estrellas);
    t.appendChild(est);
    t.appendChild(el('p', 'registro__texto', r.texto));

    var zonaRespuesta = el('div', 'resena-admin__respuesta');
    function verRespuesta() {
      zonaRespuesta.innerHTML = '';
      if (!r.respuesta) return;
      var caja = el('div', 'resena__respuesta');
      caja.appendChild(el('p', 'meta', 'Vuestra respuesta'));
      caja.appendChild(el('p', null, r.respuesta));
      zonaRespuesta.appendChild(caja);
    }
    function editarRespuesta() {
      zonaRespuesta.innerHTML = '';
      var c = el('div', 'campo');
      var id = 'respuesta-' + r.id;
      var l = el('label', null, 'Respuesta de SOÑO (sale debajo de la reseña)');
      l.htmlFor = id;
      var area = el('textarea');
      area.id = id;
      area.maxLength = 600;
      area.value = r.respuesta || '';
      area.style.minHeight = '90px';
      c.appendChild(l);
      c.appendChild(area);
      zonaRespuesta.appendChild(c);
      var acc = el('div', 'acciones-mini');
      var g = el('button', 'boton boton--lleno boton--mini', 'Guardar respuesta');
      g.type = 'button';
      g.addEventListener('click', function () {
        g.disabled = true;
        accionResena(r, { respuesta: area.value }, area.value.trim() ? 'Respuesta guardada.' : 'Respuesta quitada.');
      });
      acc.appendChild(g);
      acc.appendChild(botonMini('Cancelar', verRespuesta));
      zonaRespuesta.appendChild(acc);
      area.focus();
    }
    verRespuesta();
    t.appendChild(zonaRespuesta);

    var acciones = el('div', 'acciones-mini');
    if (r.estado !== 'publicada') {
      var publicar = el('button', 'boton boton--lleno boton--mini', 'Publicar');
      publicar.type = 'button';
      publicar.addEventListener('click', function () {
        publicar.disabled = true;
        accionResena(r, { estado: 'publicada' }, 'Reseña de ' + r.nombre + ' publicada: ya se ve en la web.');
      });
      acciones.appendChild(publicar);
    } else {
      acciones.appendChild(botonMini('Ocultar', function () {
        accionResena(r, { estado: 'oculta' }, 'Reseña de ' + r.nombre + ' oculta: ya no sale en la web.');
      }));
    }
    acciones.appendChild(botonMini(r.respuesta ? 'Editar respuesta' : 'Responder', editarRespuesta));
    acciones.appendChild(botonBorrar('Borrar', function () {
      api('DELETE', '/api/resenas/' + r.id).then(function () {
        avisoResenas('Reseña borrada.', false, true);
        cargarResenasAdmin();
        cargarResenas();
      }).catch(function (err) { if (!sesionCaducada(err)) avisoResenas(err.message, true); });
    }));
    t.appendChild(acciones);
    return t;
  }

  /* Pestaña: Club SOÑO
     Para sellar: escanear el QR del socio con la cámara, escribir el código que sale
     debajo del QR o buscarlo en la lista. Lo que se hace queda en el historial del socio,
     con el nombre de quien atiende. */
  var club = { socios: [], ajustes: null, elegido: null, filtro: '', clave: '' };
  var escaner = { stream: null, activo: false, temporizador: null };

  function quienAtiende() { try { return localStorage.getItem('sono2-quien') || ''; } catch (e) { return ''; } }
  function guardarQuien(v) { try { localStorage.setItem('sono2-quien', v); } catch (e) { /* sin almacenamiento: no pasa nada */ } }
  function sinAcentos(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }
  function avisoClub(t, esError, esOk) {
    var a = $('club-aviso');
    if (!a) return;
    a.textContent = t || '';
    a.classList.toggle('es-error', !!esError);
    a.classList.toggle('es-ok', !!esOk && !esError);
  }

  function panelClub() {
    var activo = ajustesClub().activo;
    var bloque = el('section', 'club-admin__estado' + (activo ? ' es-activo' : ''));
    bloque.id = 'club-estado';
    var interruptor = el('label', 'interruptor');
    var ch = el('input');
    ch.type = 'checkbox';
    ch.id = 'club-activo';
    ch.setAttribute('role', 'switch');
    ch.checked = activo;
    interruptor.appendChild(ch);
    interruptor.appendChild(el('span', 'interruptor__pista'));
    interruptor.appendChild(el('span', 'interruptor__texto', 'Club activo en la web'));
    bloque.appendChild(interruptor);
    var explica = el('p', 'club-admin__estado-texto');
    explica.id = 'club-estado-texto';
    bloque.appendChild(explica);
    function textoEstado(si) {
      explica.textContent = si
        ? 'La web muestra el club: los clientes pueden apuntarse y ver su tarjeta.'
        : 'El club no sale en la web y nadie puede apuntarse ni entrar. Los socios y sus sellos se guardan.';
      bloque.classList.toggle('es-activo', si);
    }
    textoEstado(activo);
    ch.addEventListener('change', function () {
      var quiere = ch.checked;
      ch.disabled = true;
      api('POST', '/api/club/activo', { activo: quiere }).then(function (r) {
        estado.datos.club = r.club;
        if (borradores.datos) borradores.datos.club = Object.assign({}, borradores.datos.club, { activo: r.club.activo });
        textoEstado(r.club.activo);
        pintarClub();
        avisoClub(r.club.activo ? 'Club activado: ya se ve en la web.' : 'Club desactivado: ya no sale en la web.', false, true);
      }).catch(function (err) {
        ch.checked = !quiere;
        if (!sesionCaducada(err)) avisoClub(err.message, true);
      }).then(function () { ch.disabled = false; });
    });
    cuerpo.appendChild(bloque);

    cuerpo.appendChild(el('p', 'admin__ayuda', 'Al escanear el QR de la tarjeta, el sello se pone solo. También puedes escribir el código que sale debajo del QR o buscar al socio en la lista y pulsar «+1 sello».'));

    var lector = el('section', 'admin__grupo club-admin__lector');
    var filaLector = el('div', 'club-admin__fila');
    var botonEscanear = el('button', 'boton boton--lleno', 'Escanear QR');
    botonEscanear.type = 'button';
    botonEscanear.id = 'club-escanear';
    botonEscanear.addEventListener('click', escanear);
    filaLector.appendChild(botonEscanear);
    var formCodigo = el('form', 'club-admin__codigo');
    formCodigo.noValidate = true;
    var lCodigo = el('label', 'solo-lector', 'Código de la tarjeta'); lCodigo.htmlFor = 'club-codigo';
    var iCodigo = el('input'); iCodigo.id = 'club-codigo'; iCodigo.type = 'text'; iCodigo.placeholder = 'Código: ABCD-2345';
    iCodigo.setAttribute('autocomplete', 'off'); iCodigo.setAttribute('autocapitalize', 'characters'); iCodigo.spellcheck = false;
    var bCodigo = el('button', 'boton boton--borde', 'Buscar'); bCodigo.type = 'submit';
    formCodigo.appendChild(lCodigo); formCodigo.appendChild(iCodigo); formCodigo.appendChild(bCodigo);
    formCodigo.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!iCodigo.value.trim()) { avisoClub('Escribe el código que sale debajo del QR.', true); iCodigo.focus(); return; }
      buscarCodigo(iCodigo.value);
    });
    filaLector.appendChild(formCodigo);
    lector.appendChild(filaLector);

    var camara = el('div', 'club-admin__camara');
    camara.id = 'club-camara';
    camara.hidden = true;
    var video = el('video');
    video.id = 'club-video';
    video.setAttribute('playsinline', '');
    video.muted = true;
    camara.appendChild(video);
    camara.appendChild(el('span', 'club-admin__marco'));
    var bCancelar = el('button', 'boton boton--borde boton--mini club-admin__cancelar', 'Cancelar');
    bCancelar.type = 'button';
    bCancelar.addEventListener('click', function () { pararEscaner(); avisoClub(''); });
    camara.appendChild(bCancelar);
    lector.appendChild(camara);

    var pAviso = el('p', 'admin__estado club-admin__aviso');
    pAviso.id = 'club-aviso';
    pAviso.setAttribute('aria-live', 'polite');
    lector.appendChild(pAviso);

    lector.appendChild(campoTextoSimple('club-quien', 'Quién atiende (sale en la tarjeta del socio)', quienAtiende(), guardarQuien, 'Marta'));
    cuerpo.appendChild(lector);

    var ficha = el('section', 'club-admin__ficha');
    ficha.id = 'club-ficha';
    ficha.hidden = true;
    cuerpo.appendChild(ficha);

    var gLista = el('section', 'admin__grupo');
    var cab = el('div', 'club-admin__cabeza-lista');
    var h = el('h3', null, 'Socios');
    h.id = 'club-titulo-lista';
    cab.appendChild(h);
    var lBuscar = el('label', 'solo-lector', 'Buscar socio'); lBuscar.htmlFor = 'club-buscar';
    var iBuscar = el('input', 'club-admin__buscar'); iBuscar.id = 'club-buscar'; iBuscar.type = 'search';
    iBuscar.placeholder = 'Buscar por nombre, email, teléfono o código';
    iBuscar.value = club.filtro;
    iBuscar.addEventListener('input', function () { club.filtro = iBuscar.value; pintarListaSocios(); });
    cab.appendChild(lBuscar); cab.appendChild(iBuscar);
    gLista.appendChild(cab);
    var lista = el('div', 'registros');
    lista.id = 'club-lista';
    lista.appendChild(el('p', 'estado-vacio', 'Cargando socios…'));
    gLista.appendChild(lista);
    cuerpo.appendChild(gLista);

    /* La configuración de la tarjeta en el móvil va al final: se toca poco */
    var estadoWallet = el('div', 'club-admin__wallet');
    estadoWallet.id = 'club-wallet';
    cuerpo.appendChild(estadoWallet);
    pintarEstadoWallet();

    if (club.elegido) pintarFicha();
    cargarSocios();
  }

  /* Campo de texto que no marca «cambios sin guardar» (se guarda en este dispositivo) */
  function campoTextoSimple(id, etiqueta, valor, alCambiar, ejemplo) {
    var c = el('div', 'campo club-admin__quien');
    var l = el('label', null, etiqueta); l.htmlFor = id;
    var i = el('input'); i.id = id; i.type = 'text'; i.value = valor || ''; i.maxLength = 30; i.placeholder = ejemplo || '';
    i.setAttribute('autocomplete', 'off');
    i.addEventListener('input', function () { alCambiar(i.value.trim()); });
    c.appendChild(l); c.appendChild(i);
    return c;
  }

  /* Tarjeta en el móvil: estado de Apple Wallet y Google Wallet, y los pasos para configurarlas desde aquí */
  var walletUi = { abierto: {}, aviso: {}, issuer: '', email: '', cuenta: null, cuentaNombre: '', ocupado: false };

  function enlaceFuera(texto, url) {
    var a = el('a', 'boton boton--borde boton--mini', texto + ' ↗');
    a.href = url; a.target = '_blank'; a.rel = 'noopener';
    return a;
  }
  function avisoWallet(cual, t, esError, esOk) {
    walletUi.aviso[cual] = t ? { t: t, error: !!esError, ok: !!esOk } : null;
    var p = $('wallet-aviso-' + cual);
    if (!p) return;
    p.textContent = t || '';
    p.classList.toggle('es-error', !!esError);
    p.classList.toggle('es-ok', !!esOk && !esError);
  }
  function walletOcupado(si) {
    walletUi.ocupado = si;
    document.querySelectorAll('#club-wallet button, #club-wallet input').forEach(function (b) { b.disabled = si; });
  }
  function ponerWallet(r) {
    if (r && r.wallet) club.wallet = r.wallet;
    pintarEstadoWallet();
  }

  function pasoWallet(lista, texto, extra) {
    var li = el('li');
    var p = el('p');
    texto.forEach(function (trozo) {
      if (typeof trozo === 'string') p.appendChild(document.createTextNode(trozo));
      else p.appendChild(el('strong', null, trozo[0]));
    });
    li.appendChild(p);
    if (extra) {
      var acciones = el('div', 'wallet-config__acciones');
      extra.forEach(function (x) { acciones.appendChild(x); });
      li.appendChild(acciones);
    }
    lista.appendChild(li);
    return li;
  }

  function bloqueWallet(cual, nombre, datos, textoEstado, abrirPorDefecto, chip) {
    var s = el('section', 'wallet-config' + (datos.activo && !chip ? ' es-activo' : ''));
    var cab = el('div', 'wallet-config__cabeza');
    cab.appendChild(el('h4', null, nombre));
    cab.appendChild(el('span', 'wallet-config__chip', chip || (datos.activo ? 'Lista' : 'Sin configurar')));
    s.appendChild(cab);
    s.appendChild(el('p', 'wallet-config__estado', textoEstado));
    var det = el('details', 'wallet-config__pasos');
    det.open = walletUi.abierto[cual] !== undefined ? walletUi.abierto[cual] : abrirPorDefecto;
    det.addEventListener('toggle', function () { walletUi.abierto[cual] = det.open; });
    s.appendChild(det);
    var aviso = el('p', 'admin__estado wallet-config__aviso');
    aviso.id = 'wallet-aviso-' + cual;
    aviso.setAttribute('aria-live', 'polite');
    s.appendChild(aviso);
    return { seccion: s, detalles: det };
  }

  /* Si el fallo ya sale como estado de Google Wallet, no se repite debajo */
  function mensajeComprobacion(r, c) {
    var guardada = r.wallet && r.wallet.google.comprobacion;
    if (!c.ok && guardada && !guardada.ok && guardada.mensaje === c.mensaje) avisoWallet('google', '');
    else avisoWallet('google', c.mensaje, !c.ok, c.ok);
  }

  function descargarTexto(nombre, texto) {
    var url = URL.createObjectURL(new Blob([texto], { type: 'application/octet-stream' }));
    var a = el('a');
    a.href = url; a.download = nombre;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 10000);
  }

  function pintarEstadoWallet() {
    var cont = $('club-wallet');
    if (!cont) return;
    cont.innerHTML = '';
    var w = club.wallet;
    if (!w) return;
    cont.appendChild(el('p', 'meta', 'Tarjeta en el móvil (Wallet)'));
    var rejilla = el('div', 'wallet-config__rejilla');
    cont.appendChild(rejilla);

    /* ---- Apple Wallet ---- */
    var a = w.apple;
    var textoA;
    var diasA = a.caduca ? Math.floor((new Date(a.caduca) - Date.now()) / 86400000) : null;
    if (a.activo) {
      textoA = 'Los socios con iPhone ya pueden añadir la tarjeta (' + a.passTypeId + ').';
      if (a.registrados) textoA += ' ' + (a.registrados === 1 ? '1 iPhone la tiene.' : a.registrados + ' iPhone la tienen.');
      if (a.caduca) textoA += ' El certificado caduca el ' + fCorta.format(new Date(a.caduca)) + '.';
    } else textoA = a.motivo;
    var bA = bloqueWallet('apple', 'Apple Wallet', a, textoA, !a.activo || (diasA !== null && diasA < 30));
    if (a.activo && diasA !== null && diasA < 30) bA.seccion.classList.add('es-aviso');
    var resumenA = el('summary', null, a.activo ? 'Renovar o cambiar el certificado' : 'Cómo activarla (unos 5 minutos)');
    bA.detalles.appendChild(resumenA);
    var pasosA = el('ol', 'wallet-config__lista');
    var bSolicitud = el('button', 'boton boton--lleno boton--mini', a.solicitudPendiente ? 'Descargar la solicitud otra vez' : 'Descargar solicitud');
    bSolicitud.type = 'button';
    bSolicitud.addEventListener('click', function () {
      walletOcupado(true);
      avisoWallet('apple', 'Preparando la solicitud…');
      api('POST', '/api/club/wallet/apple/solicitud').then(function (r) {
        descargarTexto('SONO.certSigningRequest', r.solicitud);
        walletUi.abierto.apple = true;
        avisoWallet('apple', 'Solicitud descargada (SONO.certSigningRequest). Ahora el paso 2.', false, true);
        ponerWallet(r);
      }).catch(function (err) {
        if (!sesionCaducada(err)) avisoWallet('apple', err.message, true);
      }).then(function () { walletOcupado(false); });
    });
    pasoWallet(pasosA, ['Descarga la solicitud de certificado. La clave secreta se crea en el servidor y no sale de él.'], [bSolicitud]);
    pasoWallet(pasosA, [
      'En Apple Developer, en ', ['Identifiers'], ', pulsa + y crea un ', ['Pass Type ID'],
      ' (por ejemplo «Club SOÑO» con pass.es.sono.club). Después, en ', ['Certificates'], ' pulsa +, elige ',
      ['Pass Type ID Certificate'], ', escoge ese ID, sube la solicitud y descarga el certificado (pass.cer).'
    ], [
      enlaceFuera('Pass Type IDs', 'https://developer.apple.com/account/resources/identifiers/list/passTypeId'),
      enlaceFuera('Certificados', 'https://developer.apple.com/account/resources/certificates/add')
    ]);
    var lCert = el('label', 'boton boton--lleno boton--mini wallet-config__archivo', 'Subir certificado');
    var iCert = el('input', 'oculto');
    iCert.type = 'file'; iCert.id = 'wallet-cert';
    lCert.appendChild(iCert);
    iCert.addEventListener('change', function () {
      var f = iCert.files && iCert.files[0];
      if (!f) return;
      if (f.size > 60000) { avisoWallet('apple', 'Ese archivo es demasiado grande para ser un certificado.', true); iCert.value = ''; return; }
      walletOcupado(true);
      avisoWallet('apple', 'Subiendo el certificado…');
      api('POST', '/api/club/wallet/apple/certificado', f, { binario: true }).then(function (r) {
        var ok = r.wallet && r.wallet.apple.activo;
        walletUi.abierto.apple = !ok;
        ponerWallet(r);
        avisoWallet('apple', ok ? '¡Listo! Apple Wallet ya está activa.' : 'Certificado guardado. ' + r.wallet.apple.motivo, !ok, ok);
      }).catch(function (err) {
        if (!sesionCaducada(err)) avisoWallet('apple', err.message, true);
      }).then(function () { walletOcupado(false); iCert.value = ''; });
    });
    pasoWallet(pasosA, ['Sube aquí el certificado que te ha dado Apple. El certificado intermedio de Apple lo descarga el servidor solo.'], [lCert]);
    if (!a.activo && /intermedio/.test(a.motivo)) {
      pasoWallet(pasosA, ['El servidor no ha podido descargar el certificado intermedio de Apple. Descárgalo tú y súbelo con el mismo botón del paso 3.'], [
        enlaceFuera('Certificado intermedio (G4)', 'https://www.apple.com/certificateauthority/AppleWWDRCAG4.cer')
      ]);
    }
    bA.detalles.appendChild(pasosA);
    bA.detalles.appendChild(el('p', 'admin__ayuda', 'Si el iPhone no te deja guardar el archivo .cer, haz los pasos 2 y 3 desde un ordenador (también puedes abrir este panel allí). El certificado dura un año: cuando vaya a caducar, repite estos pasos.'));
    rejilla.appendChild(bA.seccion);

    /* ---- Google Wallet ---- */
    var g = w.google;
    var fallaG = g.activo && g.comprobacion && !g.comprobacion.ok;
    var textoG = fallaG ? g.comprobacion.mensaje
      : g.activo ? 'Los socios con Android ya pueden guardar la tarjeta (emisor ' + g.issuerId + ').' : g.motivo;
    var bG = bloqueWallet('google', 'Google Wallet', g, textoG, !g.activo || fallaG, fallaG ? 'Falta un paso' : '');
    if (fallaG) bG.seccion.classList.add('es-aviso');
    bG.detalles.appendChild(el('summary', null, g.activo ? 'Cambiar los datos de Google' : 'Cómo activarla (unos 10 minutos)'));
    var pasosG = el('ol', 'wallet-config__lista');
    pasoWallet(pasosG, [
      'En la Google Pay & Wallet Console, abre ', ['Google Wallet API'], ' y copia el ', ['Issuer ID'], ' (un número largo).'
    ], [enlaceFuera('Wallet Console', 'https://pay.google.com/business/console')]);
    pasoWallet(pasosG, [
      'En Google Cloud, crea un proyecto y activa la ', ['Google Wallet API'], '. Luego, en ', ['Cuentas de servicio'],
      ', crea una cuenta de servicio (sin permisos).'
    ], [
      enlaceFuera('Activar la API', 'https://console.cloud.google.com/apis/library/walletobjects.googleapis.com'),
      enlaceFuera('Cuentas de servicio', 'https://console.cloud.google.com/iam-admin/serviceaccounts')
    ]);

    /* Paso 3: la clave. Lo recomendado es que la cree el servidor y solo se suba su certificado a Google Cloud */
    var bCert = el('button', 'boton boton--lleno boton--mini', g.certificadoServidor ? 'Descargar el certificado otra vez' : 'Crear certificado');
    bCert.type = 'button';
    bCert.addEventListener('click', function () {
      walletOcupado(true);
      avisoWallet('google', 'Preparando el certificado…');
      api('POST', '/api/club/wallet/google/certificado').then(function (r) {
        descargarTexto('sono-google-wallet.pem', r.certificado);
        walletUi.abierto.google = true;
        ponerWallet(r);
        avisoWallet('google', 'Certificado descargado (sono-google-wallet.pem). Súbelo en la cuenta de servicio: Claves → Agregar clave → Subir clave existente.', false, true);
      }).catch(function (err) {
        if (!sesionCaducada(err)) avisoWallet('google', err.message, true);
      }).then(function () { walletOcupado(false); });
    });
    var lJson = el('label', 'boton boton--borde boton--mini wallet-config__archivo', walletUi.cuentaNombre ? 'Cambiar archivo .json' : 'O elegir una clave .json');
    var iJson = el('input', 'oculto');
    iJson.type = 'file'; iJson.id = 'wallet-json'; iJson.accept = 'application/json,.json';
    lJson.appendChild(iJson);
    var nombreJson = el('span', 'wallet-config__archivo-nombre', walletUi.cuentaNombre || '');
    iJson.addEventListener('change', function () {
      var f = iJson.files && iJson.files[0];
      if (!f) return;
      if (f.size > 20000) { avisoWallet('google', 'Ese archivo es demasiado grande para ser la clave de una cuenta de servicio.', true); return; }
      var lector = new FileReader();
      lector.onload = function () {
        var j = null;
        try { j = JSON.parse(lector.result); } catch (e) { j = null; }
        if (!j || j.type !== 'service_account' || !j.client_email || !j.private_key) {
          walletUi.cuenta = null; walletUi.cuentaNombre = '';
          avisoWallet('google', 'Ese archivo no es la clave JSON de una cuenta de servicio.', true);
          nombreJson.textContent = '';
          return;
        }
        walletUi.cuenta = j; walletUi.cuentaNombre = f.name + ' · ' + j.client_email;
        nombreJson.textContent = walletUi.cuentaNombre;
        lJson.firstChild.textContent = 'Cambiar archivo .json';
        avisoWallet('google', 'Archivo elegido. Ahora pulsa «Guardar y comprobar».', false, true);
      };
      lector.readAsText(f);
      iJson.value = '';
    });
    pasoWallet(pasosG, [
      'Dale una clave a la cuenta de servicio. Lo más seguro es que la cree el servidor: pulsa ', ['Crear certificado'],
      ' y, en la cuenta de servicio → Claves → Agregar clave → ', ['Subir clave existente'],
      ', sube ese archivo. Así la clave privada no sale nunca del servidor. (Si ya tienes una clave .json, también vale.)'
    ], [bCert, lJson, nombreJson]);

    var form = el('form', 'wallet-config__form');
    form.noValidate = true;
    var cIssuer = el('div', 'campo');
    var lIssuer = el('label', null, 'Issuer ID'); lIssuer.htmlFor = 'wallet-issuer';
    var iIssuer = el('input'); iIssuer.id = 'wallet-issuer'; iIssuer.type = 'text'; iIssuer.inputMode = 'numeric';
    iIssuer.placeholder = '3388000000012345678'; iIssuer.setAttribute('autocomplete', 'off');
    iIssuer.value = walletUi.issuer || g.issuerId || '';
    iIssuer.addEventListener('input', function () { walletUi.issuer = iIssuer.value; });
    cIssuer.appendChild(lIssuer); cIssuer.appendChild(iIssuer);
    form.appendChild(cIssuer);
    var cEmail = el('div', 'campo');
    var lEmail = el('label', null, 'Correo de la cuenta de servicio'); lEmail.htmlFor = 'wallet-email';
    var iEmail = el('input'); iEmail.id = 'wallet-email'; iEmail.type = 'email';
    iEmail.placeholder = 'nombre@proyecto.iam.gserviceaccount.com'; iEmail.setAttribute('autocomplete', 'off');
    iEmail.value = walletUi.email || (g.modo === 'servidor' ? g.email : '') || '';
    iEmail.addEventListener('input', function () { walletUi.email = iEmail.value; });
    cEmail.appendChild(lEmail); cEmail.appendChild(iEmail);
    form.appendChild(cEmail);
    var bGuardar = el('button', 'boton boton--lleno boton--mini', 'Guardar y comprobar');
    bGuardar.type = 'submit';
    form.appendChild(bGuardar);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var issuer = iIssuer.value.replace(/\s+/g, '');
      var email = iEmail.value.trim().toLowerCase();
      if (!issuer && !g.issuerId) { avisoWallet('google', 'Escribe el Issuer ID.', true); iIssuer.focus(); return; }
      if (issuer && !/^\d{6,25}$/.test(issuer)) { avisoWallet('google', 'El Issuer ID son solo números.', true); iIssuer.focus(); return; }
      var datos = {};
      if (issuer) datos.issuerId = issuer;
      if (walletUi.cuenta) datos.cuenta = walletUi.cuenta;
      else if (email && email !== (g.modo === 'servidor' ? g.email : '')) datos.email = email;
      if (!datos.cuenta && !datos.email && !g.email) {
        avisoWallet('google', g.certificadoServidor ? 'Escribe el correo de la cuenta de servicio a la que subiste el certificado.' : 'Primero crea el certificado (paso 3) o elige una clave .json.', true);
        if (g.certificadoServidor) iEmail.focus();
        return;
      }
      walletOcupado(true);
      avisoWallet('google', 'Guardando y comprobando con Google…');
      api('POST', '/api/club/wallet/google', datos).then(function (r) {
        walletUi.cuenta = null; walletUi.cuentaNombre = ''; walletUi.issuer = ''; walletUi.email = '';
        var c = r.comprobacion;
        walletUi.abierto.google = !(c && c.ok);
        ponerWallet(r);
        if (c) mensajeComprobacion(r, c);
        else avisoWallet('google', 'Guardado. ' + r.wallet.google.motivo, true);
      }).catch(function (err) {
        if (!sesionCaducada(err)) avisoWallet('google', err.message, true);
      }).then(function () { walletOcupado(false); });
    });
    var liForm = pasoWallet(pasosG, ['Escribe aquí el Issuer ID y el correo de la cuenta de servicio, y pulsa «Guardar y comprobar».']);
    liForm.appendChild(form);
    var textoInvita = ['En la Wallet Console, en ', ['Usuarios'], ', invita al correo de la cuenta de servicio con permiso de ', ['Desarrollador'], '.'];
    var extraInvita = [];
    if (g.email) {
      textoInvita.push(' Es este: ');
      textoInvita.push([g.email]);
      var bCopiar = el('button', 'boton boton--borde boton--mini', 'Copiar correo');
      bCopiar.type = 'button';
      bCopiar.addEventListener('click', function () {
        var hecho = function () { bCopiar.textContent = 'Copiado'; setTimeout(function () { if (bCopiar.isConnected) bCopiar.textContent = 'Copiar correo'; }, 2000); };
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(g.email).then(hecho, function () { avisoWallet('google', g.email); });
        else avisoWallet('google', g.email);
      });
      extraInvita.push(bCopiar);
    }
    if (g.activo) {
      var bComprobar = el('button', 'boton boton--borde boton--mini', 'Comprobar con Google');
      bComprobar.type = 'button';
      bComprobar.addEventListener('click', function () {
        walletOcupado(true);
        avisoWallet('google', 'Comprobando con Google…');
        api('POST', '/api/club/wallet/google/comprobar').then(function (r) {
          ponerWallet(r);
          mensajeComprobacion(r, r.comprobacion);
        }).catch(function (err) {
          if (!sesionCaducada(err)) avisoWallet('google', err.message, true);
        }).then(function () { walletOcupado(false); });
      });
      extraInvita.push(bComprobar);
    }
    pasoWallet(pasosG, textoInvita, extraInvita.length ? extraInvita : null);
    pasoWallet(pasosG, [
      'Mientras Google no revise tu cuenta, solo pueden guardar la tarjeta los usuarios de prueba. En la Wallet Console, en Google Wallet API, pulsa ',
      ['Solicitar acceso de publicación'], ' para que la pueda guardar cualquiera.'
    ]);
    bG.detalles.appendChild(pasosG);
    rejilla.appendChild(bG.seccion);

    if (!w.https) {
      cont.appendChild(el('p', 'admin__ayuda', 'Abre este panel desde la dirección https de la web (con su dominio): Google Wallet la necesita y así las tarjetas de los iPhone se actualizan solas.'));
    }
    ['apple', 'google'].forEach(function (cual) {
      var x = walletUi.aviso[cual];
      if (x) avisoWallet(cual, x.t, x.error, x.ok);
    });
    if (walletUi.ocupado) walletOcupado(true);
  }

  function cargarSocios() {
    api('GET', '/api/club/socios').then(function (r) {
      club.socios = r.socios;
      club.ajustes = r.club;
      club.wallet = r.wallet || null;
      if (pestana === 'club') { pintarListaSocios(); pintarEstadoWallet(); }
    }).catch(function (err) {
      if (sesionCaducada(err)) return;
      var lista = $('club-lista');
      if (lista) { lista.innerHTML = ''; lista.appendChild(el('p', 'estado-vacio', err.message)); }
    });
  }

  function pintarListaSocios() {
    var lista = $('club-lista');
    if (!lista) return;
    var necesarios = (club.ajustes && club.ajustes.sellos) || 10;
    var q = sinAcentos(club.filtro).replace(/[\s-]/g, '');
    var visibles = club.socios.filter(function (s) {
      if (!q) return true;
      return [s.nombre, s.email, s.telefono, s.codigo].some(function (v) { return sinAcentos(v).replace(/[\s-]/g, '').indexOf(q) !== -1; });
    });
    $('club-titulo-lista').textContent = 'Socios (' + club.socios.length + ')';
    lista.innerHTML = '';
    if (!club.socios.length) { lista.appendChild(el('p', 'estado-vacio', 'Todavía no hay socios. Se apuntan desde la web, en la sección «Club».')); return; }
    if (!visibles.length) { lista.appendChild(el('p', 'estado-vacio', 'Ningún socio coincide con la búsqueda.')); return; }
    visibles.slice(0, 200).forEach(function (s) {
      var b = el('button', 'socio-fila' + (club.elegido && club.elegido.id === s.id ? ' es-elegido' : ''));
      b.type = 'button';
      var izq = el('span', 'socio-fila__datos');
      izq.appendChild(el('span', 'socio-fila__nombre', s.nombre));
      izq.appendChild(el('span', 'socio-fila__meta', [s.email, s.telefono, codigoBonito(s.codigo)].filter(Boolean).join(' · ')));
      b.appendChild(izq);
      var der = el('span', 'socio-fila__sellos' + (s.sellos >= necesarios ? ' es-premio' : ''), s.sellos >= necesarios ? 'Premio' : s.sellos + '/' + necesarios);
      b.appendChild(der);
      b.addEventListener('click', function () {
        api('GET', '/api/club/socios/' + s.id).then(function (r) { elegir(r.socio, r.club); })
          .catch(function (err) { if (!sesionCaducada(err)) avisoClub(err.message, true); });
      });
      lista.appendChild(b);
    });
    if (visibles.length > 200) lista.appendChild(el('p', 'estado-vacio', 'Se muestran 200. Busca para encontrar al resto.'));
  }

  function elegir(s, ajustes, desdeSellos) {
    club.elegido = s;
    if (ajustes) club.ajustes = ajustes;
    club.clave = '';
    // Actualiza también la fila de la lista
    var i = club.socios.findIndex(function (x) { return x.id === s.id; });
    var resumen = Object.assign({}, s); delete resumen.historial;
    if (i === -1) club.socios.unshift(resumen); else club.socios[i] = resumen;
    pintarFicha(desdeSellos);
    pintarListaSocios();
    // Solo se baja hasta la ficha si no se ve (al elegir un socio de la lista);
    // así, tras escanear, el lector sigue a la vista para el siguiente cliente
    var ficha = $('club-ficha');
    if (ficha && desdeSellos === undefined) {
      var caja = cuerpo.getBoundingClientRect();
      var r = ficha.getBoundingClientRect();
      if (r.top < caja.top || r.top > caja.bottom - 120) {
        cuerpo.scrollTop = Math.max(0, r.top - caja.top + cuerpo.scrollTop - 16);
      }
    }
  }

  function pintarFicha(desdeSellos) {
    var ficha = $('club-ficha');
    var s = club.elegido;
    if (!ficha || !s) return;
    var necesarios = (club.ajustes && club.ajustes.sellos) || 10;
    var premio = (club.ajustes && club.ajustes.premio) || 'un desayuno gratis';
    var tienePremio = s.sellos >= necesarios;
    ficha.hidden = false;
    ficha.innerHTML = '';
    var cab = el('div', 'club-admin__ficha-cabeza');
    var nombre = el('div');
    nombre.appendChild(el('h3', 'club-admin__nombre', s.nombre));
    nombre.appendChild(el('p', 'socio-fila__meta', [s.email, s.telefono, 'Tarjeta ' + codigoBonito(s.codigo)].filter(Boolean).join(' · ')));
    cab.appendChild(nombre);
    var cerrarFicha = el('button', 'boton boton--borde boton--mini', 'Cerrar');
    cerrarFicha.type = 'button';
    cerrarFicha.addEventListener('click', function () { club.elegido = null; ficha.hidden = true; pintarListaSocios(); });
    cab.appendChild(cerrarFicha);
    ficha.appendChild(cab);

    var sellos = el('div', 'tarjeta-sellos tarjeta-sellos--panel');
    pintarSellos(sellos, Math.min(s.sellos, necesarios), necesarios, desdeSellos);
    ficha.appendChild(sellos);
    var resumen = s.sellos + ' de ' + necesarios + ' sellos · ' + (s.total === 1 ? '1 desayuno' : s.total + ' desayunos') + ' en total' +
      (s.canjes ? ' · ' + (s.canjes === 1 ? '1 premio canjeado' : s.canjes + ' premios canjeados') : '');
    ficha.appendChild(el('p', 'club-admin__resumen', resumen));
    if (tienePremio) ficha.appendChild(el('p', 'premio-aviso', 'Tiene ' + premio + ' para canjear.'));

    var acc = el('div', 'club-admin__acciones');
    var mas = el('button', 'boton boton--lleno club-admin__mas', '+1 sello');
    mas.type = 'button';
    mas.addEventListener('click', function () { accionSocio('sellos', { cantidad: 1 }, 'Sello añadido a ' + s.nombre + '.'); });
    acc.appendChild(mas);
    var menos = el('button', 'boton boton--borde', '−1');
    menos.type = 'button';
    menos.setAttribute('aria-label', 'Quitar un sello');
    menos.disabled = s.sellos === 0;
    menos.addEventListener('click', function () { accionSocio('sellos', { cantidad: -1 }, 'Sello quitado.'); });
    acc.appendChild(menos);
    var canjear = el('button', 'boton ' + (tienePremio ? 'boton--lleno' : 'boton--borde'), 'Canjear premio');
    canjear.type = 'button';
    canjear.disabled = !tienePremio;
    canjear.addEventListener('click', function () { accionSocio('canjear', {}, 'Premio canjeado. La tarjeta vuelve a empezar.'); });
    acc.appendChild(canjear);
    ficha.appendChild(acc);

    var hist = el('div', 'club-admin__historial');
    hist.appendChild(el('p', 'meta', 'Últimos movimientos'));
    var ul = el('ul', 'movimientos');
    pintarMovimientos(ul, s.historial, 'Sin movimientos todavía.');
    hist.appendChild(ul);
    ficha.appendChild(hist);

    var extra = el('div', 'acciones-mini club-admin__extra');
    extra.appendChild(botonMini('Nueva contraseña', function () {
      api('POST', '/api/club/socios/' + s.id + '/clave', {}).then(function (r) {
        club.clave = r.clave;
        pintarFicha();
      }).catch(function (err) { if (!sesionCaducada(err)) avisoClub(err.message, true); });
    }));
    extra.appendChild(botonBorrar('Borrar socio', function () {
      api('DELETE', '/api/club/socios/' + s.id).then(function () {
        club.socios = club.socios.filter(function (x) { return x.id !== s.id; });
        club.elegido = null;
        ficha.hidden = true;
        pintarListaSocios();
        avisoClub('Socio borrado.');
      }).catch(function (err) { if (!sesionCaducada(err)) avisoClub(err.message, true); });
    }));
    ficha.appendChild(extra);
    if (club.clave) {
      var caja = el('p', 'club-admin__clave');
      caja.appendChild(document.createTextNode('Contraseña provisional: '));
      caja.appendChild(el('strong', null, club.clave));
      caja.appendChild(document.createTextNode(' Dísela al socio: entrará con ella y su email. Solo se enseña ahora.'));
      ficha.appendChild(caja);
    }
  }

  function accionSocio(accion, datos, hecho) {
    var s = club.elegido;
    if (!s) return;
    var antes = s.sellos;
    datos.por = quienAtiende();
    document.querySelectorAll('.club-admin__acciones .boton').forEach(function (b) { b.disabled = true; });
    api('POST', '/api/club/socios/' + s.id + '/' + accion, datos).then(function (r) {
      var necesarios = (r.club && r.club.sellos) || 10;
      elegir(r.socio, r.club, r.socio.sellos > antes ? Math.min(antes, necesarios) : undefined);
      avisoClub(typeof hecho === 'function' ? hecho(r.socio, necesarios) : hecho, false, true);
      if (navigator.vibrate) navigator.vibrate(40);
    }).catch(function (err) {
      if (!sesionCaducada(err)) avisoClub(err.message, true);
      pintarFicha();
    });
  }

  /* Al escanear el QR se pone el sello directamente. No se pone solo si:
     - la tarjeta ya está completa (toca canjear el premio), o
     - a ese socio ya se le puso un sello escaneando hace menos de 2 minutos
       (para no sumar dos por leer el mismo QR dos veces). En ese caso se pulsa «+1 sello». */
  var ultimoEscaneo = { codigo: '', hora: 0 };
  function buscarCodigo(texto, escaneado) {
    avisoClub('Buscando la tarjeta…');
    api('POST', '/api/club/buscar', { codigo: texto }).then(function (r) {
      var i = $('club-codigo'); if (i) i.value = '';
      elegir(r.socio, r.club);
      if (navigator.vibrate) navigator.vibrate(60);
      var s = r.socio;
      var necesarios = (r.club && r.club.sellos) || 10;
      var premio = (r.club && r.club.premio) || 'un desayuno gratis';
      if (!escaneado) { avisoClub('Tarjeta de ' + s.nombre + '. Pulsa «+1 sello» para sellar.'); return; }
      if (s.sellos >= necesarios) {
        avisoClub('Tarjeta de ' + s.nombre + ' completa: tiene ' + premio + '. Pulsa «Canjear premio».', false, true);
        return;
      }
      var segundos = Math.round((Date.now() - ultimoEscaneo.hora) / 1000);
      if (ultimoEscaneo.codigo === s.codigo && segundos < 120) {
        avisoClub('A ' + s.nombre + ' ya se le puso un sello hace ' + segundos + ' s. Si es otro desayuno, pulsa «+1 sello».', true);
        return;
      }
      ultimoEscaneo = { codigo: s.codigo, hora: Date.now() };
      accionSocio('sellos', { cantidad: 1 }, function (socioNuevo, n) {
        var faltan = n - socioNuevo.sellos;
        return 'Sello añadido a ' + socioNuevo.nombre + ': ' + Math.min(socioNuevo.sellos, n) + ' de ' + n +
          (faltan <= 0 ? '. ¡Tarjeta completa! La próxima vez, canjea el premio.' : '.');
      });
    }).catch(function (err) { if (!sesionCaducada(err)) avisoClub(err.message, true); });
  }

  /* Lector de QR: usa el del navegador si lo trae; si no, carga jsQR (solo al escanear) */
  function cargarJsQR() {
    return new Promise(function (ok, mal) {
      if (window.jsQR) { ok(); return; }
      var s = document.createElement('script');
      s.src = '/vendor/jsQR.js';
      s.onload = function () { ok(); };
      s.onerror = function () { mal(new Error('No se ha podido cargar el lector de QR. Escribe el código de la tarjeta.')); };
      document.head.appendChild(s);
    });
  }
  function lectorJsQR() {
    return cargarJsQR().then(function () {
      var lienzo = document.createElement('canvas');
      var ctx = lienzo.getContext('2d', { willReadFrequently: true });
      return function (video) {
        var w = video.videoWidth, h = video.videoHeight;
        if (!w || !h) return Promise.resolve(null);
        var escala = Math.min(1, 720 / Math.max(w, h));
        lienzo.width = Math.round(w * escala);
        lienzo.height = Math.round(h * escala);
        ctx.drawImage(video, 0, 0, lienzo.width, lienzo.height);
        var img = ctx.getImageData(0, 0, lienzo.width, lienzo.height);
        var res = window.jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
        return Promise.resolve(res ? res.data : null);
      };
    });
  }
  function crearLector() {
    if ('BarcodeDetector' in window && window.BarcodeDetector.getSupportedFormats) {
      return window.BarcodeDetector.getSupportedFormats().then(function (formatos) {
        if (formatos.indexOf('qr_code') === -1) return lectorJsQR();
        var detector = new window.BarcodeDetector({ formats: ['qr_code'] });
        return function (video) {
          return detector.detect(video).then(function (c) { return c.length ? c[0].rawValue : null; });
        };
      }).catch(function () { return lectorJsQR(); });
    }
    return lectorJsQR();
  }
  function pararEscaner() {
    escaner.activo = false;
    clearTimeout(escaner.temporizador);
    if (escaner.stream) { escaner.stream.getTracks().forEach(function (pista) { pista.stop(); }); escaner.stream = null; }
    var caja = $('club-camara');
    if (caja) caja.hidden = true;
    var video = $('club-video');
    if (video) video.srcObject = null;
  }
  function escanear() {
    if (!window.isSecureContext || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      avisoClub('La cámara solo funciona cuando la web va por https (con su dominio). Mientras, escribe el código que sale debajo del QR.', true);
      return;
    }
    pararEscaner();
    var caja = $('club-camara');
    var video = $('club-video');
    caja.hidden = false;
    avisoClub('Apunta la cámara al QR de la tarjeta.');
    escaner.activo = true;
    Promise.all([
      navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false }),
      crearLector()
    ]).then(function (res) {
      if (!escaner.activo) { res[0].getTracks().forEach(function (p) { p.stop(); }); return; }
      escaner.stream = res[0];
      var leer = res[1];
      video.srcObject = escaner.stream;
      var reproducir = video.play();
      if (reproducir && reproducir.catch) reproducir.catch(function () {});
      var avisoOtro = false;
      (function vuelta() {
        if (!escaner.activo) return;
        leer(video).then(function (leido) {
          if (!escaner.activo) return;
          if (leido && /^SONO:/i.test(leido)) { pararEscaner(); buscarCodigo(leido, true); return; }
          if (leido && !avisoOtro) { avisoOtro = true; avisoClub('Ese QR no es de una tarjeta de SOÑO.', true); }
          escaner.temporizador = setTimeout(vuelta, 220);
        }).catch(function () { escaner.temporizador = setTimeout(vuelta, 400); });
      })();
    }).catch(function (err) {
      pararEscaner();
      avisoClub(err && err.name === 'NotAllowedError'
        ? 'Sin permiso para usar la cámara. Permítelo en el navegador o escribe el código de la tarjeta.'
        : (err && err.message) || 'No se ha podido abrir la cámara. Escribe el código de la tarjeta.', true);
    });
  }
  modalAdmin.addEventListener('close', pararEscaner);

  /* Pestaña: historial de versiones
     Cada vez que se guarda la carta, las fotos, los horarios o los ajustes queda una versión.
     Volver a una versión cambia solo esa parte de la web y también se puede deshacer. */
  var historial = { filtro: '' };
  var fHistorial = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
  var CLAVE_DE_SECCION = { carta: 'carta', galeria: 'galeria', horario: 'horario', datos: 'datos' };

  function panelHistorial() {
    cuerpo.appendChild(el('p', 'admin__ayuda', 'Cada vez que guardas cambios en la carta, las fotos, los horarios o los ajustes queda aquí una versión con lo que cambió. Si algo no te convence, vuelve a una versión anterior: solo cambia esa parte de la web, y la versión de ahora también se guarda, así que puedes deshacerlo.'));
    var filtros = el('div', 'historial__filtros');
    filtros.setAttribute('role', 'group');
    filtros.setAttribute('aria-label', 'Ver versiones de');
    [['', 'Todo'], ['carta', 'Carta'], ['galeria', 'Fotos'], ['horario', 'Horarios'], ['datos', 'Ajustes']].forEach(function (f) {
      var b = el('button', 'historial__filtro', f[1]);
      b.type = 'button';
      b.setAttribute('aria-pressed', historial.filtro === f[0] ? 'true' : 'false');
      b.addEventListener('click', function () { historial.filtro = f[0]; pintarPanel(); });
      filtros.appendChild(b);
    });
    cuerpo.appendChild(filtros);
    var lista = el('div', 'registros');
    lista.appendChild(el('p', 'estado-vacio', 'Cargando el historial…'));
    cuerpo.appendChild(lista);
    api('GET', '/api/versiones').then(function (r) {
      if (pestana !== 'historial') return;
      lista.innerHTML = '';
      var visibles = r.versiones.filter(function (v) { return !historial.filtro || v.seccion === historial.filtro; });
      if (!visibles.length) { lista.appendChild(el('p', 'estado-vacio', 'Todavía no hay versiones guardadas.')); return; }
      visibles.forEach(function (v) { lista.appendChild(tarjetaVersion(v)); });
    }).catch(function (err) {
      if (sesionCaducada(err)) return;
      lista.innerHTML = '';
      lista.appendChild(el('p', 'estado-vacio', err.message));
    });
  }

  function tarjetaVersion(v) {
    var t = el('article', 'registro version' + (v.actual ? ' version--actual' : ''));
    var cab = el('div', 'registro__cabecera');
    var titulo = el('p', 'registro__titulo');
    titulo.appendChild(el('span', 'etiqueta-tipo', v.nombre));
    var fecha = fHistorial.format(new Date(v.fecha));
    titulo.appendChild(document.createTextNode(fecha.charAt(0).toUpperCase() + fecha.slice(1)));
    cab.appendChild(titulo);
    if (v.actual) cab.appendChild(el('span', 'version__actual', 'Es la que se ve ahora'));
    t.appendChild(cab);
    var ul = el('ul', 'version__cambios');
    v.resumen.forEach(function (linea) { ul.appendChild(el('li', null, linea)); });
    t.appendChild(ul);
    if (!v.actual) {
      var acc = el('div', 'acciones-mini');
      var texto = 'Volver a esta versión de ' + v.nombre.toLowerCase();
      var b = botonMini(texto, function () {
        if (b.getAttribute('data-confirmar') !== '1') {
          b.setAttribute('data-confirmar', '1');
          b.textContent = '¿Seguro? Toca otra vez';
          setTimeout(function () { if (b.isConnected) { b.removeAttribute('data-confirmar'); b.textContent = texto; } }, 4000);
          return;
        }
        b.disabled = true;
        api('POST', '/api/versiones/' + v.id + '/restaurar').then(function (r) {
          var k = CLAVE_DE_SECCION[r.seccion];
          estado[k] = r.valor;
          borradores[k] = null;
          sucio[k] = false;
          pintarTodo();
          pintarPanel();
          mostrarEstado(v.nombre + ' vuelve a estar como el ' + fHistorial.format(new Date(v.fecha)) + '. Ya se ve en la web.');
        }).catch(function (err) {
          b.disabled = false;
          if (!sesionCaducada(err)) mostrarEstado(err.message, true);
        });
      });
      acc.appendChild(b);
      t.appendChild(acc);
    }
    return t;
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
    var base = { reservas: 'Reservas', mensajes: 'Mensajes', pedidos: 'Pedidos', resenas: 'Reseñas' }[pest];
    tab.textContent = n ? base + ' (' + n + ')' : base;
  }
  function actualizarContadores() {
    api('GET', '/api/reservas').then(function (r) {
      ponerContador('reservas', r.reservas.filter(function (x) { return x.fecha >= r.hoy; }).length);
    }).catch(function () {});
    api('GET', '/api/mensajes').then(function (r) { ponerContador('mensajes', r.mensajes.length); }).catch(function () {});
    api('GET', '/api/pedidos').then(function (r) { ponerContador('pedidos', r.pedidos.length); }).catch(function () {});
    api('GET', '/api/resenas/todas').then(function (r) { ponerContador('resenas', r.pendientes); }).catch(function () {});
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
    if (k === 'datos') {
      var nSellos = Number(b.club.sellos);
      if (!(nSellos >= 3 && nSellos <= 20 && Math.floor(nSellos) === nSellos)) return 'Los sellos de la tarjeta del club van de 3 a 20.';
      for (var z = 0; z < b.zonas.length; z++) {
        if (!texto(b.zonas[z].nombre)) return 'Hay una zona sin nombre (la ' + (z + 1) + 'ª). Escríbelo o quita la zona.';
      }
    }
    if (k === 'datos' && texto(b.email) && texto(b.email).indexOf('@') < 1) {
      return 'Revisa el email: parece que le falta la @.';
    }
    if (k === 'datos') {
      var nif = texto(b.legal.nif).toUpperCase().replace(/[\s.-]/g, '');
      if (nif && !RE_NIF.test(nif)) return 'Revisa el NIF o CIF de los datos legales: por ejemplo 12345678Z o B12345678.';
      if (texto(b.legal.email) && texto(b.legal.email).indexOf('@') < 1) return 'Revisa el email para temas de privacidad: parece que le falta la @.';
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
      mostrarEstado('Guardado. Ya se ve en la web. Si quieres deshacerlo, está en «Historial».');
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

  /* ---------- Escena: la taza se llena al bajar ----------
     Va justo después de la portada. El dibujo se queda fijo en el centro mientras
     se recorre «.escena__recorrido». p va de 0 (taza vacía) a 1 (café listo):
       0,00–0,33  la cafetera sirve el café (60 ml)
       0,33–0,66  la misma cafetera añade la leche (hasta 220 ml)
       0,66–0,90  y después la espuma (hasta 250 ml)
       0,90–1,00  sale el vapor y aparece el corazón en la espuma
     Siempre es la misma cafetera, con el mismo tamaño.
     Sin JavaScript, o con «reducir movimiento», se ve la taza ya llena. */
  (function () {
    var escena = $('escena');
    var fijo = $('escena-fijo');
    if (!escena || !fijo) return;
    var recorrido = escena.querySelector('.escena__recorrido');
    var raizHtml = document.documentElement;
    var cabecera = $('cabecera');
    var capas = { cafe: $('capa-cafe'), leche: $('capa-leche'), espuma: $('capa-espuma') };
    var superficie = $('superficie');
    var ondas = $('ondas');
    var onda1 = $('onda-1');
    var onda2 = $('onda-2');
    var corazon = $('corazon');
    var chorros = { cafe: $('chorro-cafe'), leche: $('chorro-leche'), espuma: $('chorro-espuma') };
    var cafetera = $('cafetera');
    var vapor = $('escena-vapor');
    var pasos = [$('paso-1'), $('paso-2'), $('paso-3')];
    var barras = pasos.map(function (li) { return li.querySelector('.escena__barra > span'); });
    var textoEl = $('escena-texto');
    var mlEl = $('escena-ml');
    var PICO = { x: 300, y: 74 };     // pico de la cafetera (en el dibujo)
    var ESCALA = 1.15;                // tamaño de la cafetera: no cambia en toda la escena
    var reducido = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };

    function entre(v, a, b) { return Math.min(b, Math.max(a, v)); }
    function tramo(p, a, b) { return entre((p - a) / (b - a), 0, 1); }
    function suave(x) { return x * x * (3 - 2 * x); }

    // Ancho del cuenco de la taza a cada altura (curva del dibujo, en coordenadas de la taza)
    function bez(s, a, b, c, d) { var u = 1 - s; return u * u * u * a + 3 * u * u * s * b + 3 * u * s * s * c + s * s * s * d; }
    var perfil = [];
    for (var i = 0; i <= 80; i++) {
      var s = i / 80;
      perfil.push({ y: bez(s, 262, 334, 366, 366), m: 210 - bez(s, 118, 118, 160, 210) });
    }
    function mitadAncho(y) {
      for (var j = 1; j < perfil.length; j++) {
        if (perfil[j].y >= y) {
          var a = perfil[j - 1], b = perfil[j];
          var k = (y - a.y) / ((b.y - a.y) || 1);
          return Math.max(0, a.m + (b.m - a.m) * k - 2);
        }
      }
      return 0;
    }
    function nivelY(f) { return 363 - f * 95; }             // f: 0 fondo de la taza, 1 borde
    function enDibujoY(y) { return 1.4 * y - 136.8; }       // de la taza al dibujo completo
    // Zona del líquido por debajo del borde delantero de su superficie
    function capa(y) {
      var m = mitadAncho(y);
      if (m < 0.5) return '';
      var r = (m * 0.196).toFixed(2);
      return 'M' + (210 - m).toFixed(2) + ' ' + y.toFixed(2) + ' A' + m.toFixed(2) + ' ' + r + ' 0 0 0 ' +
        (210 + m).toFixed(2) + ' ' + y.toFixed(2) + ' L' + (210 + m).toFixed(2) + ' 380 L' + (210 - m).toFixed(2) + ' 380 Z';
    }
    function elipse(el, y, factor) {
      var m = mitadAncho(y) * (factor || 1);
      el.setAttribute('cy', y.toFixed(2));
      el.setAttribute('rx', m.toFixed(2));
      el.setAttribute('ry', (m * 0.196).toFixed(2));
    }

    var ultimoTexto = '';
    var ultimoMl = -1;
    var ultimoTipo = '';
    function pintar(p) {
      var tCafe = tramo(p, 0.06, 0.29);
      var tLeche = tramo(p, 0.41, 0.65);
      var tEspuma = tramo(p, 0.67, 0.85);
      var fCafe = 0.3 * tCafe;
      var fLeche = fCafe + 0.55 * tLeche;
      var fEspuma = fLeche + 0.1 * tEspuma;
      var yCafe = nivelY(fCafe), yLeche = nivelY(fLeche), yEspuma = nivelY(fEspuma);
      capas.cafe.setAttribute('d', capa(yCafe));
      capas.leche.setAttribute('d', capa(yLeche));
      capas.espuma.setAttribute('d', capa(yEspuma));

      // Superficie que se ve desde arriba, del color de la capa de encima
      var tipo = tEspuma > 0 ? 'espuma' : tLeche > 0 ? 'leche' : 'cafe';
      if (tipo !== ultimoTipo) { superficie.setAttribute('class', 'superficie es-' + tipo); ultimoTipo = tipo; }
      elipse(superficie, yEspuma);
      superficie.style.opacity = fEspuma > 0.004 ? '1' : '0';

      // La cafetera se inclina para servir el café, se endereza un momento,
      // vuelve a inclinarse para la leche y la espuma, y al final desaparece
      var inclinaCafe = suave(tramo(p, 0, 0.05)) - suave(tramo(p, 0.28, 0.33));
      var inclinaLeche = suave(tramo(p, 0.36, 0.4)) - suave(tramo(p, 0.86, 0.91));
      var giro = -18 - 40 * Math.max(inclinaCafe, inclinaLeche);
      cafetera.setAttribute('transform', 'translate(' + PICO.x + ' ' + PICO.y + ') rotate(' + giro.toFixed(2) + ') scale(' + ESCALA + ')');
      cafetera.setAttribute('opacity', (1 - tramo(p, 0.91, 0.95)).toFixed(3));

      // Chorros: del pico a la superficie, solo mientras se sirve
      var fondo = enDibujoY(yEspuma) + 1;
      var sirviendo = false;
      function chorro(el, desde, hasta) {
        var visible = p > desde && p < hasta;
        if (visible) sirviendo = true;
        var largo = visible ? (fondo - PICO.y) * tramo(p, desde, desde + 0.025) : 0;
        el.setAttribute('height', Math.max(0, largo).toFixed(2));
      }
      chorro(chorros.cafe, 0.04, 0.29);
      chorro(chorros.leche, 0.39, 0.655);
      chorro(chorros.espuma, 0.66, 0.855);
      ondas.classList.toggle('sirviendo', sirviendo && fEspuma > 0.02);
      elipse(onda1, yEspuma, 0.8);
      elipse(onda2, yEspuma, 0.8);

      // Al final: corazón en la espuma y vapor
      corazon.setAttribute('transform', 'translate(0 ' + (yEspuma - 264).toFixed(2) + ') ' +
        'translate(210 264) scale(' + (0.75 + 0.25 * tramo(p, 0.88, 0.96)).toFixed(3) + ') translate(-210 -264)');
      corazon.style.opacity = tramo(p, 0.88, 0.95).toFixed(3);
      vapor.style.opacity = tramo(p, 0.9, 0.97).toFixed(3);

      // Pasos y texto de abajo
      var avance = [tCafe, tLeche, tEspuma];
      var actual = p < 0.33 ? 0 : p < 0.66 ? 1 : p < 0.9 ? 2 : 3;
      barras.forEach(function (b, n) { b.style.setProperty('--t', avance[n].toFixed(3)); });
      pasos.forEach(function (li, n) {
        li.classList.toggle('activo', n === actual && p > 0.02);
        li.classList.toggle('hecho', avance[n] >= 1);
      });
      var texto = p < 0.03 ? 'Baja para servirte un café ↓'
        : actual === 0 ? 'Primero, el café recién hecho'
        : actual === 1 ? 'Después, leche cremosa'
        : actual === 2 ? 'Y una capa fina de espuma'
        : 'Tu café con leche, listo';
      if (texto !== ultimoTexto) { textoEl.textContent = texto; ultimoTexto = texto; }
      var ml = Math.round(60 * tCafe + 160 * tLeche + 30 * tEspuma);
      if (ml !== ultimoMl) { mlEl.textContent = ml + ' ml'; ultimoMl = ml; }
    }

    // El dibujo queda centrado en el hueco que deja la cabecera
    function colocar() {
      var alto = cabecera ? cabecera.offsetHeight : 0;
      var hueco = window.innerHeight - alto - fijo.offsetHeight;
      fijo.style.top = Math.round(alto + Math.max(0, hueco / 2)) + 'px';
    }
    function progreso() {
      var arriba = parseFloat(fijo.style.top) || 0;
      var r = recorrido.getBoundingClientRect();
      if (!r.height) return 1;
      return entre((arriba + fijo.offsetHeight - r.top) / r.height, 0, 1);
    }
    function activa() { return !reducido.matches && window.innerHeight >= 520; }

    var pendiente = false;
    function alMover() {
      if (pendiente || !raizHtml.classList.contains('escena-activa')) return;
      pendiente = true;
      requestAnimationFrame(function () { pendiente = false; pintar(progreso()); });
    }
    function iniciar() {
      if (activa()) {
        raizHtml.classList.add('escena-activa');
        colocar();
        pintar(progreso());
      } else {
        raizHtml.classList.remove('escena-activa');
        fijo.style.top = '';
        pintar(1);
      }
    }
    window.addEventListener('scroll', alMover, { passive: true });
    // En el móvil la barra del navegador cambia el alto al bajar: eso no recoloca el dibujo
    var ultimoAncho = window.innerWidth;
    var ultimoAlto = window.innerHeight;
    window.addEventListener('resize', function () {
      if (window.innerWidth === ultimoAncho && Math.abs(window.innerHeight - ultimoAlto) < 120) return;
      ultimoAncho = window.innerWidth;
      ultimoAlto = window.innerHeight;
      iniciar();
    });
    if (reducido.addEventListener) reducido.addEventListener('change', iniciar);
    else if (reducido.addListener) reducido.addListener(iniciar);
    iniciar();
  })();

  /* ---------- Menú del móvil ---------- */
  (function () {
    var boton = $('menu-boton');
    var panel = $('menu-movil');
    if (!boton || !panel) return;
    function poner(abierto) {
      boton.setAttribute('aria-expanded', abierto ? 'true' : 'false');
      boton.setAttribute('aria-label', abierto ? 'Cerrar menú' : 'Abrir menú');
      panel.hidden = !abierto;
      document.documentElement.classList.toggle('menu-abierto', abierto);
    }
    boton.addEventListener('click', function () { poner(boton.getAttribute('aria-expanded') !== 'true'); });
    // Al tocar cualquier enlace del menú se cierra (y la página baja a esa sección)
    panel.addEventListener('click', function (e) { if (e.target.closest('a')) poner(false); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !panel.hidden) { poner(false); boton.focus(); }
    });
    var ancho = window.matchMedia('(min-width: 761px)');
    var alCambiar = function () { if (ancho.matches) poner(false); };
    if (ancho.addEventListener) ancho.addEventListener('change', alCambiar); else if (ancho.addListener) ancho.addListener(alCambiar);
  })();

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
    cargarResenas();
    // Con «#escribir-resena» en la dirección (por ejemplo, un QR en las mesas) se abre la ventana
    if (location.hash === '#escribir-resena') abrirResena();
  }).catch(function () {
    cargado = true;
    sinDatos = true;
    pintarTodo();
    cargarResenas();
  });
  if (location.hash === '#reservar') abrir(modalReserva);

  /* Sesión del socio del club. Con «#tarjeta» en la dirección se abre la tarjeta directamente */
  api('GET', '/api/club/yo').then(function (r) {
    ponerSocio(r.socio || null, r.wallet || null);
  }).catch(function () {
    ponerSocio(null);
  }).then(function () {
    if (location.hash === '#tarjeta' && ajustesClub().activo) {
      if (socio) abrirTarjeta(); else abrirAccesoClub('entrar');
    }
  });
})();
