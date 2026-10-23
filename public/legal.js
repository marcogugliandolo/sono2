/* SOÑO · textos legales
   Una sola página con tres pestañas: aviso legal (/aviso-legal), privacidad (/privacidad)
   y cookies (/cookies). Los datos del titular salen de «Ajustes → Datos legales» del panel
   y los textos se adaptan a lo que está activo en la web (pedidos, club y reseñas).
   Lo que dicen los textos tiene que coincidir con lo que hace la web: si cambia algo
   (plazos de borrado, cookies, datos que se piden), hay que cambiarlo también aquí. */
(function () {
  'use strict';

  var DOCS = {
    'aviso-legal': { titulo: 'Aviso legal', ruta: '/aviso-legal' },
    privacidad: { titulo: 'Política de privacidad', ruta: '/privacidad' },
    cookies: { titulo: 'Política de cookies', ruta: '/cookies' }
  };
  var RUTAS = { '/legal': 'aviso-legal', '/aviso-legal': 'aviso-legal', '/privacidad': 'privacidad', '/cookies': 'cookies' };
  var fLarga = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });

  var d = {};                                          // datos de la web (Ajustes)
  var actual = RUTAS[location.pathname] || 'aviso-legal';
  var caja = document.getElementById('legal-texto');
  var titulo = document.getElementById('legal-titulo');

  /* ---------- Utilidades para escribir los textos ---------- */
  function el(tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt !== undefined && txt !== null) e.textContent = txt;
    return e;
  }
  function meter(nodo, partes) {
    partes.forEach(function (x) { nodo.appendChild(typeof x === 'string' ? document.createTextNode(x) : x); });
    return nodo;
  }
  function p() { return meter(el('p'), Array.prototype.slice.call(arguments)); }
  function h2(t, id) { var h = el('h2', null, t); if (id) h.id = id; return h; }
  function lista(items) {
    var ul = el('ul');
    items.forEach(function (x) { ul.appendChild(meter(el('li'), Array.isArray(x) ? x : [x])); });
    return ul;
  }
  function enlace(t, href, fuera) {
    var a = el('a', null, t);
    a.href = href;
    if (fuera) { a.target = '_blank'; a.rel = 'noopener'; }
    return a;
  }
  function enlaceDoc(t, doc) {
    var a = enlace(t, DOCS[doc].ruta);
    a.setAttribute('data-doc', doc);
    return a;
  }
  function falta() { return el('span', 'pendiente', 'Por completar'); }
  function dato(v) { return v ? document.createTextNode(v) : falta(); }
  function unir(cosas) {
    return cosas.length < 2 ? cosas.join('') : cosas.slice(0, -1).join(', ') + ' y ' + cosas[cosas.length - 1];
  }
  function tabla(filas) {
    var envoltorio = el('div', 'legal__tabla');
    var t = el('table');
    var cab = el('thead');
    var trCab = el('tr');
    filas[0].forEach(function (c) { var th = el('th', null, c); th.scope = 'col'; trCab.appendChild(th); });
    cab.appendChild(trCab);
    t.appendChild(cab);
    var cuerpo = el('tbody');
    filas.slice(1).forEach(function (f) {
      var tr = el('tr');
      f.forEach(function (c, i) {
        var td = el(i === 0 ? 'th' : 'td', i === 0 ? 'legal__codigo' : null, c);
        if (i === 0) td.scope = 'row';
        tr.appendChild(td);
      });
      cuerpo.appendChild(tr);
    });
    t.appendChild(cuerpo);
    envoltorio.appendChild(t);
    return envoltorio;
  }

  /* ---------- Datos del titular ---------- */
  function legal() { return d.legal || {}; }
  function domicilio() { return String(legal().domicilio || d.direccion || '').trim(); }
  function email() { return String(legal().email || d.email || '').trim(); }
  function correo() { var e = email(); return e ? enlace(e, 'mailto:' + e) : falta(); }
  function hay() {
    return {
      pedidos: d.paraLlevar !== false,
      domicilio: d.domicilio !== false,
      club: !(d.club && d.club.activo === false),
      resenas: !(d.resenas && d.resenas.activo === false),
      empleo: !(d.empleo && d.empleo.activo === false)
    };
  }
  function fichaTitular(conRegistro) {
    var dl = el('dl', 'legal__ficha');
    function fila(t, v) {
      var div = el('div');
      div.appendChild(el('dt', null, t));
      var dd = el('dd');
      dd.appendChild(v);
      div.appendChild(dd);
      dl.appendChild(div);
    }
    fila('Titular', dato(String(legal().titular || '').trim()));
    fila('NIF / CIF', dato(String(legal().nif || '').trim()));
    fila('Nombre comercial', document.createTextNode('SOÑO'));
    fila('Domicilio', dato(domicilio()));
    fila('Email', correo());
    if (d.telefono) fila('Teléfono', document.createTextNode(d.telefono));
    if (conRegistro && legal().registro) fila('Registro', document.createTextNode(legal().registro));
    return dl;
  }

  /* ---------- Aviso legal ---------- */
  function avisoLegal() {
    var h = hay();
    var f = document.createDocumentFragment();
    f.appendChild(p('Estos son los datos de quien está detrás de esta web, como pide la Ley 34/2002 de servicios de la sociedad de la información y de comercio electrónico (LSSI-CE).'));
    f.appendChild(h2('Quiénes somos'));
    f.appendChild(fichaTitular(true));

    f.appendChild(h2('Para qué sirve esta web'));
    var cosas = ['reservar mesa'];
    if (h.pedidos) cosas.push('hacer pedidos para llevar');
    if (h.club) cosas.push('unirte al Club SOÑO');
    if (h.resenas) cosas.push('dejar una reseña');
    cosas.push('escribirnos');
    if (h.empleo) cosas.push('mandarnos tu currículum');
    f.appendChild(p('Esta web presenta la cafetería SOÑO: la carta, el horario y dónde estamos. Desde ella puedes ' + unir(cosas) + '.'));

    f.appendChild(h2('Condiciones de uso'));
    var condiciones = [
      'Úsala de buena fe: no envíes datos falsos ni datos de otras personas sin su permiso.',
      (h.pedidos ? 'Las reservas y los pedidos dependen de que haya sitio y producto.' : 'Las reservas dependen de que haya sitio.') +
        ' Si hay algún problema, te avisamos al teléfono que nos dejes.'
    ];
    if (h.pedidos) condiciones.push('Los pedidos se pagan al recogerlos' + (h.domicilio ? ' o al recibirlos' : '') + '. La web no cobra nada ni pide datos de pago.');
    condiciones.push('La carta, los precios y el horario pueden cambiar. Intentamos que la web esté siempre al día.');
    condiciones.push('La información de alérgenos de la carta es orientativa. Si tienes alguna alergia o intolerancia, pregúntanos antes de pedir.');
    if (h.club) condiciones.push('El Club SOÑO es gratis. Las condiciones de la tarjeta (cuántos sellos hacen falta y cuál es el premio) son las que se ven en la web en cada momento; si cambian, conservas los sellos que ya tengas.');
    f.appendChild(lista(condiciones));

    if (h.resenas) {
      f.appendChild(h2('Cómo tratamos las reseñas', 'resenas'));
      f.appendChild(p('Las reseñas las escriben nuestros clientes desde esta web. Las leemos todas antes de publicarlas y publicamos tanto las buenas como las malas. Solo dejamos fuera las que tienen insultos, datos personales de otras personas, publicidad o nada que ver con SOÑO.'));
      f.appendChild(p('No podemos comprobar que cada persona haya venido al local. Cuando la escribe un socio del club con su tarjeta abierta, la reseña lo indica con «Socio del club». Si respondemos a una reseña, la respuesta sale debajo, firmada por SOÑO.'));
    }

    f.appendChild(h2('Propiedad intelectual'));
    f.appendChild(p('El logotipo, los textos, los dibujos y las fotos de esta web son de SOÑO o se usan con permiso de sus autores. No se pueden copiar ni usar con fines comerciales sin nuestra autorización. Las tipografías (Instrument Serif, Geist y Geist Mono) se usan con la licencia SIL Open Font License.'));

    f.appendChild(h2('Enlaces a otras webs'));
    f.appendChild(p('Los enlaces a Instagram o WhatsApp llevan a servicios de otras empresas, con sus propias condiciones y políticas de privacidad. No respondemos de lo que publiquen.'));

    f.appendChild(h2('Tus datos y las cookies'));
    f.appendChild(p('Qué datos guardamos y para qué está en la ', enlaceDoc('política de privacidad', 'privacidad'), ', y las cookies, en la ', enlaceDoc('política de cookies', 'cookies'), '.'));

    f.appendChild(h2('Ley aplicable'));
    f.appendChild(p('Esta web y su uso se rigen por la legislación española.'));
    return f;
  }

  /* ---------- Política de privacidad ---------- */
  function privacidad() {
    var f = document.createDocumentFragment();
    f.appendChild(p('Aquí te contamos qué datos tuyos guardamos cuando usas esta web, para qué y durante cuánto tiempo. Solo pedimos los imprescindibles, no los usamos para publicidad y no se los damos a nadie.'));

    f.appendChild(h2('Quién es el responsable'));
    f.appendChild(fichaTitular(false));

    f.appendChild(h2('Qué datos tratamos y para qué'));
    var usos = [
      {
        titulo: 'Reservas de mesa',
        datos: 'Nombre, teléfono, día, hora, número de personas, zona y comentarios.',
        para: 'Guardarte la mesa y avisarte si hay algún cambio.',
        base: 'Atender lo que nos pides antes de venir (artículo 6.1.b del RGPD).',
        tiempo: 'Se borran solos 90 días después del día de la reserva.'
      },
      {
        titulo: 'Pedidos para llevar',
        datos: 'Nombre, teléfono, productos, día y hora de recogida, comentarios y, si pides a domicilio, la dirección de entrega.',
        para: 'Preparar el pedido y entregártelo.',
        base: 'Cumplir el pedido que nos haces (artículo 6.1.b del RGPD).',
        tiempo: 'Se borran solos 30 días después del pedido.'
      },
      {
        titulo: 'Mensajes de «Escríbenos»',
        datos: 'Nombre, email y lo que nos cuentes.',
        para: 'Responderte.',
        base: 'Tu consentimiento al enviarnos el mensaje (artículo 6.1.a del RGPD).',
        tiempo: 'Los borramos cuando ya están atendidos y, como mucho, al año.'
      },
      {
        titulo: 'Candidaturas de «Trabaja con nosotros»',
        datos: 'Nombre, email, teléfono (si nos lo das), el puesto que te interesa, lo que nos cuentes y tu currículum, con los datos que pongas en él.',
        para: 'Valorar tu candidatura y llamarte si encaja en este proceso de selección o en los siguientes.',
        base: 'Tu consentimiento al mandarnos la candidatura (artículo 6.1.a del RGPD), que puedes retirar cuando quieras.',
        tiempo: 'Un año como mucho desde que nos la mandas; después se borran solos, con el currículum. Si nos lo pides, la borramos antes.'
      },
      {
        titulo: 'Club SOÑO',
        datos: 'Nombre, email, teléfono (si nos lo das), tu contraseña (guardada cifrada: nadie puede leerla) y tus sellos y premios, con la fecha y el nombre de quien te atendió.',
        para: 'Llevar tu tarjeta de sellos.',
        base: 'Tu alta en el club (artículo 6.1.b del RGPD).',
        tiempo: 'Mientras seas socio. Si te das de baja desde tu tarjeta, se borra todo en ese momento.'
      },
      {
        titulo: 'Tarjeta en Apple Wallet o Google Wallet',
        datos: 'Si añades la tarjeta del club a la cartera del móvil, lleva tu nombre, el código de la tarjeta y tus sellos. Con Apple Wallet guardamos además un identificador del dispositivo para avisarle cuando cambian los sellos.',
        para: 'Que tengas la tarjeta en el móvil y se actualice sola.',
        base: 'Tu decisión de añadirla, como parte del club (artículo 6.1.b del RGPD).',
        tiempo: 'Mientras la tengas en la cartera. Si la quitas o te das de baja del club, borramos el registro de tu dispositivo.'
      },
      {
        titulo: 'Reseñas',
        datos: 'El nombre que elijas, tu valoración, tu comentario, la fecha y, si tienes abierta tu tarjeta del club, que eres socio.',
        para: 'Publicarla en la web después de leerla. Lo que se publica (nombre, valoración, comentario y fecha) lo puede ver cualquiera.',
        base: 'Tu consentimiento (artículo 6.1.a del RGPD), que puedes retirar cuando quieras.',
        tiempo: 'Mientras esté publicada, o hasta que nos pidas que la borremos.'
      },
      {
        titulo: 'Seguridad de la web',
        datos: 'Tu dirección IP.',
        para: 'Frenar envíos repetidos e intentos de entrar en cuentas ajenas.',
        base: 'Nuestro interés legítimo en proteger la web y tus datos (artículo 6.1.f del RGPD).',
        tiempo: 'Solo en la memoria del servidor, unas horas como mucho. No se guarda junto a tus datos.'
      }
    ];
    var cont = el('div', 'legal__usos');
    usos.forEach(function (u) {
      var c = el('section', 'legal__uso');
      c.appendChild(el('h3', null, u.titulo));
      var dl = el('dl');
      [['Qué datos', u.datos], ['Para qué', u.para], ['Base legal', u.base], ['Cuánto tiempo', u.tiempo]].forEach(function (x) {
        var div = el('div');
        div.appendChild(el('dt', null, x[0]));
        div.appendChild(el('dd', null, x[1]));
        dl.appendChild(div);
      });
      c.appendChild(dl);
      cont.appendChild(c);
    });
    f.appendChild(cont);

    f.appendChild(h2('Con quién los compartimos'));
    f.appendChild(p('Con nadie, salvo que una ley nos obligue. No vendemos datos ni los usamos para publicidad. La web está alojada en un servidor; quien lo mantiene solo puede usar los datos para que la web funcione, como encargado del tratamiento.'));
    f.appendChild(p('Si añades la tarjeta del club a Google Wallet, Google la guarda en tu cuenta de Google; si la añades a Apple Wallet, se guarda en tu dispositivo y los avisos de cambios pasan por el servicio de notificaciones de Apple. En los dos casos se aplican también sus políticas de privacidad, y puede haber transferencias de datos fuera de la UE con las garantías que ofrecen esas empresas.'));

    f.appendChild(h2('Tus derechos'));
    f.appendChild(p('Puedes pedirnos ver tus datos, corregirlos, borrarlos, llevártelos a otro sitio, limitar su uso u oponerte a él, y retirar tu consentimiento cuando quieras. Escríbenos a ', correo(), ' con el asunto «Protección de datos» y te responderemos en menos de un mes.'));
    f.appendChild(p('Si eres socio del club, también puedes darte de baja tú mismo desde tu tarjeta. Y si crees que no hemos atendido bien tu petición, puedes reclamar ante la Agencia Española de Protección de Datos en ', enlace('www.aepd.es', 'https://www.aepd.es', true), '.'));

    f.appendChild(h2('Menores'));
    f.appendChild(p('Para unirte al club o dejar una reseña tienes que tener al menos 14 años, y para mandarnos tu candidatura, al menos 16.'));

    f.appendChild(h2('Cómo cuidamos tus datos'));
    f.appendChild(p('Las contraseñas del club se guardan cifradas, el panel de gestión de la web está protegido con usuario y contraseña, y solo el equipo de SOÑO puede ver tus datos. Los currículums no están a la vista en la web: solo se pueden abrir desde el panel.'));
    f.appendChild(p('Las cookies que usa la web se explican en la ', enlaceDoc('política de cookies', 'cookies'), '.'));
    return f;
  }

  /* ---------- Política de cookies ---------- */
  function cookies() {
    var f = document.createDocumentFragment();
    f.appendChild(p('Las cookies son pequeños archivos que una web guarda en tu navegador. Ahora mismo esta web solo usa cookies técnicas, las imprescindibles para que funcione. No usamos cookies de análisis, de publicidad ni de otras empresas.'));

    f.appendChild(h2('Qué cookies usamos'));
    f.appendChild(tabla([
      ['Nombre', 'Para qué sirve', 'Duración'],
      ['sono2_socio', 'Mantener abierta tu tarjeta del Club SOÑO después de entrar.', '120 días, o hasta que cierres la sesión'],
      ['sono2_sesion', 'Mantener abierta la sesión del panel de gestión. Solo la tiene el equipo de SOÑO.', '12 horas']
    ]));
    f.appendChild(p('Las dos son propias (las pone esta web, no otra empresa) y técnicas.'));

    f.appendChild(h2('Otros datos que guarda tu navegador'));
    f.appendChild(p('La web también guarda un par de datos en el almacenamiento local de tu navegador, que funciona de forma parecida:'));
    f.appendChild(tabla([
      ['Nombre', 'Para qué sirve', 'Duración'],
      ['sono2-cookies', 'Recordar si has aceptado o rechazado las cookies opcionales, para no preguntarte cada vez.', 'Un año; después te volvemos a preguntar'],
      ['sono2-quien', 'Solo en los dispositivos del equipo: recordar quién atiende al poner los sellos del club.', 'Hasta que borres los datos del navegador']
    ]));

    f.appendChild(h2('Aceptar o rechazar'));
    f.appendChild(p('Las cookies técnicas no se pueden rechazar: sin ellas no funcionaría lo que tú mismo pides, como entrar en tu tarjeta del club (están exentas de consentimiento según el artículo 22.2 de la LSSI).'));
    f.appendChild(p('El aviso que sale al entrar te pregunta por las demás, las opcionales. Hoy no usamos ninguna; si algún día añadimos alguna (por ejemplo, de estadísticas), solo se activará si has pulsado «Aceptar». Si pulsas «Rechazar», la web funciona igual.'));
    f.appendChild(tuEleccion());

    f.appendChild(h2('Cómo borrarlas o bloquearlas'));
    f.appendChild(p('Desde los ajustes de tu navegador puedes borrar las cookies y los datos de esta web, o bloquearlas. Si las bloqueas, la web se sigue viendo, pero no podrás mantener abierta tu tarjeta del club.'));

    f.appendChild(h2('Enlaces a otras webs'));
    f.appendChild(p('Si tocas el enlace de Instagram o de WhatsApp, esas webs pueden usar sus propias cookies, según sus políticas. Las tipografías y todo lo demás se sirve desde nuestro propio servidor: mientras navegas por SOÑO, tu navegador no se conecta con ninguna otra empresa.'));

    f.appendChild(h2('Si esto cambia'));
    f.appendChild(p('Si algún día añadimos cookies opcionales, las explicaremos aquí antes de usarlas, y solo funcionarán si las aceptas. Más sobre tus datos en la ', enlaceDoc('política de privacidad', 'privacidad'), '.'));
    return f;
  }

  /* Lo que eligió esta persona en el aviso, con un botón para cambiarlo */
  function textoEleccion() {
    var e = window.sonoCookies && window.sonoCookies.eleccion();
    if (e === 'aceptadas') return 'Has aceptado las cookies opcionales.';
    if (e === 'rechazadas') return 'Has rechazado las cookies opcionales.';
    return 'Todavía no has elegido.';
  }
  function tuEleccion() {
    var caja = el('div', 'legal__eleccion');
    var t = el('p', null, textoEleccion());
    t.id = 'legal-eleccion';
    caja.appendChild(t);
    var b = el('button', 'boton boton--borde boton--peque', 'Cambiar mi elección');
    b.type = 'button';
    b.setAttribute('data-configurar-cookies', '');
    caja.appendChild(b);
    return caja;
  }
  document.addEventListener('sono:cookies', function () {
    var t = document.getElementById('legal-eleccion');
    if (t) t.textContent = textoEleccion();
  });

  var CONSTRUIR = { 'aviso-legal': avisoLegal, privacidad: privacidad, cookies: cookies };

  /* ---------- Mostrar un texto y moverse entre los tres ---------- */
  function mostrar(doc, soloCabecera) {
    actual = DOCS[doc] ? doc : 'aviso-legal';
    var info = DOCS[actual];
    document.title = info.titulo + ' · SOÑO';
    titulo.textContent = info.titulo;
    var act = legal().actualizado;
    document.getElementById('legal-fecha').textContent = act
      ? 'Última actualización: ' + fLarga.format(new Date(act + 'T12:00:00'))
      : '';
    document.querySelectorAll('.legal__nav a').forEach(function (a) {
      if (a.getAttribute('data-doc') === actual) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    if (soloCabecera) return;
    caja.innerHTML = '';
    caja.appendChild(CONSTRUIR[actual]());
  }

  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[data-doc]');
    if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    var doc = a.getAttribute('data-doc');
    if (doc !== actual) {
      history.pushState({ doc: doc }, '', DOCS[doc].ruta);
      mostrar(doc);
    }
    window.scrollTo(0, 0);
    titulo.setAttribute('tabindex', '-1');
    titulo.focus({ preventScroll: true });
  });
  window.addEventListener('popstate', function () { mostrar(RUTAS[location.pathname] || 'aviso-legal'); });

  function irAlAncla() {
    if (!location.hash) return;
    var destino = document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (destino) destino.scrollIntoView();
  }

  mostrar(actual, true);   // el texto sale cuando llegan los datos del titular
  fetch('/api/contenido', { credentials: 'same-origin' })
    .then(function (r) { return r.ok ? r.json() : {}; })
    .then(function (c) { d = (c && c.datos) || {}; })
    .catch(function () { d = {}; })
    .then(function () { mostrar(actual); irAlAncla(); });
})();
