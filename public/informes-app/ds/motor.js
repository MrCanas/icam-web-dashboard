/* Motor común de los informes trimestrales: pinta slides de informe.json con el design system
   (window.ImparInformes) y reparte el hueco libre (aireado) midiendo en el navegador.
   Lo usan el visor del skill (templates/visor.html) y la web del equipo (app-equipo/). */
(function () {
  var N = window.ImparInformes, h = React.createElement;

  // Componentes que reciben pie legal y número de página.
  var CON_PIE = { Slide: 1, ResumenEjecutivo: 1, DosColumnas: 1, TextoImagen: 1, SlideKpisRiesgosObjetivos: 1, Colaboradores: 1, VehiculoInversion: 1, SlideBloqueado: 1 };
  var SOLO_PAGINA = { Disclaimer: 1 };
  var HTML = { div: 1, span: 1, p: 1, strong: 1, em: 1, br: 1 };

  /* Los assets del design system (logos, iconos, fondo de cierre) se sirven desde `base`. */
  function configurarAssets(base) {
    N.assets.logoAzul = base + 'logo-impar-capital-azul.png';
    N.assets.logoBlanco = base + 'logo-impar-capital-blanco.png';
    N.assets.cierreMosaico = base + 'fondo-cierre-mosaico.png';
    Object.keys(N.assets.iconos).forEach(function (k) {
      var f = /^(kpi|vehiculo|desinversion)-/.test(k) ? k : 'icono-' + k;
      N.assets.iconos[k] = base + f + '.png';
    });
  }

  /* Nodo: texto | {c, props, hijos}. Cualquier valor de props con forma de nodo se convierte en elemento. */
  function nodo(n, key) {
    if (n == null || typeof n !== 'object') return n;
    if (Array.isArray(n)) return n.map(function (x, i) { return nodo(x, i); });
    if (!n.c) return valor(n);
    var comp = HTML[n.c] ? n.c : N[n.c];
    if (!comp) throw new Error('Componente desconocido: ' + n.c);
    var props = valor(n.props || {});
    props.key = key;
    var hijos = (n.hijos || []).map(function (x, i) { return nodo(x, i); });
    return h.apply(null, [comp, props].concat(hijos));
  }
  function valor(v) {
    if (Array.isArray(v)) return v.map(function (x, i) { return x && typeof x === 'object' && x.c ? nodo(x, i) : valor(x); });
    if (v && typeof v === 'object') {
      if (v.c) return nodo(v);
      var o = {}; Object.keys(v).forEach(function (k) { o[k] = valor(v[k]); }); return o;
    }
    return v;
  }

  function elemento(s, pagina, meta) {
    var pie = meta && meta.pie;
    if (s.compuesto) {
      var c = s.compuesto;
      return h(N.Slide, { pie: pie, pagina: pagina, layout: c.layout },
        h(N.SlideHeader, { seccion: c.seccion, titulo: c.titulo }),
        h(N.Contenido, { className: c.clase, style: c.estilo }, (c.contenido || []).map(function (x, i) { return nodo(x, i); })),
        c.nota ? h('div', { className: 'iq-nota' }, N.rt(c.nota)) : null);
    }
    if (!N[s.c]) throw new Error('Componente desconocido: ' + s.c);
    var props = valor(s.props || {});
    if (CON_PIE[s.c]) { if (props.pie === undefined) props.pie = pie; props.pagina = pagina; }
    if (SOLO_PAGINA[s.c]) props.pagina = pagina;
    var hijos = (s.hijos || []).map(function (x, i) { return nodo(x, i); });
    return h.apply(null, [N[s.c], props].concat(hijos));
  }

  /* Pinta un slide de forma síncrona (para poder medirlo justo después). Devuelve la raíz React. */
  function pintar(esc, s, pagina, meta, raiz) {
    raiz = raiz || ReactDOM.createRoot(esc);
    try {
      ReactDOM.flushSync(function () { raiz.render(elemento(s, pagina, meta)); });
    } catch (e) {
      raiz.unmount();
      raiz = ReactDOM.createRoot(esc);
      esc.innerHTML = '';
      var msg = 'Error en el slide «' + s.id + '»: ' + e.message;
      ReactDOM.flushSync(function () { raiz.render(h('div', { style: { padding: 40, font: '14px Lato, sans-serif', color: '#b00' } }, msg)); });
      raiz.error = msg;
    }
    return raiz;
  }

  /* Resalta «[pendiente: …]». Devuelve cuántos hay. */
  function marcarPendientes(esc) {
    var w = document.createTreeWalker(esc, NodeFilter.SHOW_TEXT), t, nodos = [];
    while ((t = w.nextNode())) if (/\[pendiente[^\]]*\]/i.test(t.nodeValue)) nodos.push(t);
    nodos.forEach(function (t) {
      var span = document.createElement('span');
      span.innerHTML = t.nodeValue.replace(/[&<>]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]; })
        .replace(/\[pendiente[^\]]*\]/gi, function (m) { return '<mark class="v-pend">' + m + '</mark>'; });
      t.parentNode.replaceChild(span, t);
    });
    return nodos.length;
  }

  /* ---------- Aireado: reparte el hueco libre entre las partes de cada slide sin tocar el cuerpo de letra ----------
     Todas las medidas en unidades del lienzo (960 × 540). Orden: huecos entre partes → espacio entre párrafos y
     viñetas → alto de filas de tabla. Si el contenido desborda, no airea y lo marca. */
  var ATOMICAS = ['iq-texto', 'iq-vinetas', 'iq-timeline', 'iq-galeria', 'iq-fichas', 'iq-kpi-iconos', 'iq-bloque-icono',
    'iq-colab-rol', 'iq-mapa-lateral', 'iq-breeam', 'iq-consol', 'iq-barras', 'iq-tlq', 'iq-donut', 'iq-cols', 'iq-figura'];
  var TOPE_HUECO = 36, TOPE_HUECO_POCOS = 56, TOPE_PARRAFO = 6, TOPE_CELDA = 4, HOLGURA = 4;

  function esTitulo(el) { return el.classList.contains('iq-sub') || el.classList.contains('iq-sub2'); }
  function esAtomica(el) {
    if (el.tagName !== 'DIV' && el.tagName !== 'SECTION') return true;
    return ATOMICAS.some(function (c) { return el.classList.contains(c); });
  }
  function partes(cont) {
    var out = [];
    Array.prototype.forEach.call(cont.children, function (el) {
      if (!el.offsetHeight || getComputedStyle(el).position === 'absolute') return;
      if (esTitulo(el) || esAtomica(el)) out.push(el); else out = out.concat(partes(el));
    });
    return out;
  }
  // Un subtítulo, o un texto que termina en «:», va pegado a lo que le sigue.
  function introduce(el) { return esTitulo(el) || (el.classList.contains('iq-texto') && /:\s*$/.test(el.textContent)); }
  function grupos(ps) {
    var gs = [];
    ps.forEach(function (p, i) {
      if (i === 0 || !introduce(ps[i - 1])) gs.push([p]); else gs[gs.length - 1].push(p);
    });
    return gs;
  }
  function sumarMargen(el, px) { el.style.marginTop = (parseFloat(getComputedStyle(el).marginTop) + px) + 'px'; }

  /* Mide y airea un slide ya pintado dentro de `esc` (caja de 960 × 540, escalada o no).
     Devuelve {ocupacion, relleno, desborde}; null en slides sin área de contenido (portada, índice…). */
  function airear(esc) {
    var k = esc.getBoundingClientRect().width / 960;
    if (!k) return null;
    var cont = esc.querySelector('.iq-contenido, .iq-bloqueado-cuerpo');
    if (!cont) return null;
    var y = function (el, lado) { return (el.getBoundingClientRect()[lado] - esc.getBoundingClientRect().top) / k; };
    var arriba = y(cont, 'top'), limite = y(cont, 'bottom');
    // Elementos fijos dentro del área (logos de colaboradores, notas) acortan el espacio útil.
    Array.prototype.forEach.call(esc.querySelectorAll('.iq-colab-logos, .iq-nota'), function (el) {
      var t = y(el, 'top'); if (t > arriba + 40 && t < limite) limite = t - 8;
    });
    var fondo = function (ps) { return ps.reduce(function (m, p) { return Math.max(m, y(p, 'bottom')); }, arriba); };
    var todas = partes(cont);
    if (!todas.length) return { ocupacion: 0, relleno: 0, desborde: false };
    var ultimo = Math.max(fondo(todas), fondo(Array.prototype.slice.call(cont.querySelectorAll('.iq-cols > div > *'))));
    var ocupacion = Math.round(100 * (ultimo - arriba) / (limite - arriba));
    if (ultimo > limite + 1) return { ocupacion: ocupacion, relleno: ocupacion, desborde: true };

    function airearCont(contenedor, tope) {
      var ps = partes(contenedor);
      var libre = tope - fondo(ps) - HOLGURA;
      if (libre <= 2) return;
      var gs = grupos(ps);
      if (gs.length > 1) {
        var g = Math.min(gs.length <= 3 ? TOPE_HUECO_POCOS : TOPE_HUECO, libre / (gs.length - 1));
        gs.slice(1).forEach(function (grp) { sumarMargen(grp[0], g); });
        libre -= g * (gs.length - 1);
      }
      var sep = Array.prototype.filter.call(contenedor.querySelectorAll('.iq-texto p, .iq-vinetas li'), function (el) { return el.previousElementSibling; });
      if (libre > 4 && sep.length) {
        var d = Math.min(TOPE_PARRAFO, libre / sep.length);
        sep.forEach(function (el) { sumarMargen(el, d); });
        libre -= d * sep.length;
      }
      var filas = contenedor.querySelectorAll('.iq-tabla-rayada tbody tr');
      if (libre > 4 && filas.length) {
        var c = Math.min(TOPE_CELDA, libre / (2 * filas.length));
        Array.prototype.forEach.call(filas, function (tr) {
          Array.prototype.forEach.call(tr.children, function (td) {
            var cs = getComputedStyle(td);
            td.style.paddingTop = (parseFloat(cs.paddingTop) + c) + 'px';
            td.style.paddingBottom = (parseFloat(cs.paddingBottom) + c) + 'px';
          });
        });
      }
    }
    // Pila principal (o columnas si el área entera es de dos columnas); después, cada rejilla iguala sus columnas.
    if (cont.classList.contains('iq-cols')) Array.prototype.forEach.call(cont.children, function (col) { airearCont(col, limite); });
    else airearCont(cont, limite);
    // Cada rejilla interior (de la última a la primera) crece con el hueco que quede al final del área.
    Array.prototype.slice.call(cont.querySelectorAll('.iq-cols')).reverse().forEach(function (grid) {
      if (grid === cont) return;
      var sobrante = Math.max(0, limite - HOLGURA - fondo(partes(cont)));
      var tope = y(grid, 'bottom') + sobrante;
      Array.prototype.forEach.call(grid.children, function (col) { airearCont(col, tope); });
    });
    var despues = Math.max(fondo(partes(cont)), fondo(Array.prototype.slice.call(cont.querySelectorAll('.iq-cols > div > *'))));
    return { ocupacion: ocupacion, relleno: Math.round(100 * (despues - arriba) / (limite - arriba)), desborde: false };
  }

  window.InformeMotor = {
    configurarAssets: configurarAssets,
    elemento: elemento,
    pintar: pintar,
    marcarPendientes: marcarPendientes,
    airear: airear,
    componentes: function () { return Object.keys(N).filter(function (k) { return /^[A-Z]/.test(k); }).concat(Object.keys(HTML)); }
  };
})();
