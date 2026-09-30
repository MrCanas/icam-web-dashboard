/* @ds-bundle: {"format":4,"namespace":"ImparInformes","components":[{"name":"Slide"},{"name":"SlideHeader"},{"name":"Logo"},{"name":"PieConfidencial"},{"name":"Subtitulo"},{"name":"Texto"},{"name":"Vinetas"},{"name":"ImagenMarco"},{"name":"Portada"},{"name":"Indice"},{"name":"Disclaimer"},{"name":"Cierre"},{"name":"BloqueIcono"},{"name":"ResumenEjecutivo"},{"name":"AntecedentesNovedades"},{"name":"DosColumnas"},{"name":"TextoImagen"},{"name":"MapaLateral"},{"name":"TablaKpis"},{"name":"TablaRiesgos"},{"name":"ListaObjetivos"},{"name":"SlideKpisRiesgosObjetivos"},{"name":"Timeline"},{"name":"HitosResenables"},{"name":"TimelineTrimestral"},{"name":"Galeria"},{"name":"BreeamRating"},{"name":"BarrasBreeam"},{"name":"BarraConsolidacion"},{"name":"Colaboradores"},{"name":"VehiculoInversion"},{"name":"ConsejoAdministracion"},{"name":"SlideBloqueado"},{"name":"KpiIconosFinancieros"},{"name":"TablaVarianzas"},{"name":"TablaFinanciera"},{"name":"TablaLicitaciones"},{"name":"TablaMensual"},{"name":"DonutOcupacion"}]} */
(function () {
  var React = window.React;
  var h = React.createElement;
  var F = React.Fragment;

  /* Asset URLs. Inside the design system they point at its asset store;
     a consuming app overrides them once: ImparInformes.assets.logoAzul = '/brand/logo-azul.png'. */
  var assets = {
    logoAzul: '/_blob/08ec04802e078fd1721954d73897312e',
    logoBlanco: '/_blob/2f83bb9f9e7f680aa52134aeaca1f86b',
    cierreMosaico: '/_blob/ea7c63481a6bdd1e270bd47385f4724b',
    iconos: {
      'situacion-actual': '/_blob/350a6b72fc6d08e5cfc33064073f1b56',
      'compraventa-financiacion': '/_blob/92a8536fdf5f0bfa13de60c17fc0b306',
      'operacion-cronograma': '/_blob/0e176fc84e929e8719247880a62112dc',
      'logros': '/_blob/b9b4459956b66b641a2bc12eb6123f70',
      'kpi-fondos-propios': '/_blob/b8ad104325a9655e43cc77c80b4f9a98',
      'kpi-roe': '/_blob/0b4819b8eb7410280db70641b71c4544',
      'kpi-tir': '/_blob/23149f37cdb625a5202b0536bbe8a592',
      'kpi-plazo': '/_blob/626c1eaf313f5dbff76507b847f553df',
      'kpi-ltv': '/_blob/367d44ca1782286581e675ddafd2028c',
      'kpi-yield': '/_blob/fd4d73aeaebfb994aa4563de82c277fc',
      'kpi-yield-salida': '/_blob/c72adb017afe6c53d1723c6858b5bdc2',
      'kpi-noi': '/_blob/1abf18475b7039ad04987ed9dd387bf4',
      'vehiculo-aeat': '/_blob/48f912c8b60259bf92ec0588ed11a900',
      'vehiculo-obligacion-mercantil': '/_blob/6f80a9ac6a221230cb191de486f4360c',
      'vehiculo-inscripcion-rm': '/_blob/5755d3c5f8b2b39022aff14142c886fb',
      'vehiculo-siguiente-informe': '/_blob/911e752d72cfd3b06bdf033a52a7ff2e',
      'desinversion-rotacion': '/_blob/1b8c8d676f33f4caf58fe7bad9a1b318',
      'desinversion-red-mercado': '/_blob/7703438b88df4cc4aba545fa96ed9b7d',
      'desinversion-firma': '/_blob/8e9ab85c284c85ed759049446a5433a3',
      'desinversion-calendario-bloqueo': '/_blob/87575cd7c0104ce0e3879286ebb78cb1',
      'desinversion-ubicacion-vision': '/_blob/9cb68f552d1ad3b2df8dda4b508a8485'
    }
  };

  function cx() {
    return Array.prototype.filter.call(arguments, Boolean).join(' ');
  }
  function icono(nombre) {
    return assets.iconos[nombre] || nombre;
  }

  /* Rich text: "**negrita**" becomes <strong>. Keeps copy editable as plain strings. */
  function rt(s) {
    if (s == null) return null;
    if (typeof s !== 'string') return s;
    var parts = s.split(/\*\*(.+?)\*\*/g);
    return parts.map(function (p, i) {
      return i % 2 ? h('strong', { key: i }, p) : p;
    });
  }

  /* ---------- Legal footer ---------- */
  var PIE_COLA =
    'La información se facilita única y exclusivamente al receptor de este y con el propósito para el que ha sido elaborado. Dicha información tiene carácter confidencial y, en consecuencia, no puede ser parcial o completamente (i) copiada o duplicada en ningún medio o soporte, (ii) redistribuida, citada, divulgada o comunicada ni (iii) entregada a ninguna otra persona o entidad sin la autorización previa y por escrito de ';

  function textoPie(p) {
    p = p || {};
    if (p.variante === 'cnmv') {
      return (
        'La información contenida en este documento va dirigida al inversor del ' +
        (p.tipo || 'fondo') + ' ' + (p.fondo || '{FONDO}') + ', ISIN ' + (p.isin || '{ISIN}') +
        ', el cual ha sido creado por Impar Capital Asset Management, Sociedad Gestora de Entidades de Inversión Colectiva de tipo cerrado (ICAM SGEIC), inscrita en la CNMV bajo el número 192. ' +
        PIE_COLA + 'Impar Capital Asset Management SGEIC, S.A.'
      );
    }
    var entidad = p.entidad || 'Impar Capital Investment, S.L.';
    return (
      'La información contenida en este documento va dirigida al inversor del vehículo ' +
      (p.vehiculo || '{VEHÍCULO}') + ', NIF ' + (p.nif || '{NIF}') + ', el cual ha sido creado por ' +
      entidad + ', inscrita en el Registro Mercantil de Madrid. ' + PIE_COLA + entidad + '.'
    );
  }

  function PieConfidencial(props) {
    return h('div', { className: 'iq-pie' }, textoPie(props));
  }

  /* ---------- Base ---------- */
  function Logo(props) {
    var tono = props.tono || 'azul';
    return h('img', {
      className: cx('iq-logo', props.className),
      src: tono === 'blanco' ? assets.logoBlanco : assets.logoAzul,
      alt: 'Impar Capital',
      style: props.style
    });
  }

  function Slide(props) {
    var fondo = props.fondo || 'paper';
    return h(
      'section',
      { className: cx('iq-slide', 'iq-fondo-' + fondo, props.className), 'data-layout': props.layout },
      props.children,
      props.pie && fondo === 'paper' ? h(PieConfidencial, props.pie) : null,
      props.pagina != null ? h('div', { className: 'iq-pagina' }, props.pagina) : null
    );
  }

  /* Baskerville titles are uppercase and fit one line. A title longer than TITULO_MAX
     is split at its first ". ": the section stays in Baskerville, the rest becomes an uppercase Lato subtitle. */
  var TITULO_MAX = 40;
  function partirTitulo(titulo, subtitulo) {
    var t = titulo || '';
    if (subtitulo != null) return [t, subtitulo];
    var i = t.indexOf('. ');
    if (t.length > TITULO_MAX && i > 0) return [t.slice(0, i), t.slice(i + 2)];
    return [t, null];
  }

  function SlideHeader(props) {
    var p = partirTitulo(props.titulo, props.subtitulo);
    return h(
      'header',
      { className: cx('iq-header', p[1] && 'iq-header-sub') },
      h(
        'h1',
        { className: 'iq-titulo' },
        props.seccion != null ? h('span', { className: 'iq-seccion' }, props.seccion) : null,
        h('span', { className: 'iq-titulo-linea' }, p[0], p[1] ? h('span', { className: 'iq-titulo-sub' }, p[1]) : null)
      ),
      props.logo === false ? null : h(Logo, { tono: 'azul', className: 'iq-header-logo' })
    );
  }

  function Contenido(props) {
    return h('div', { className: cx('iq-contenido', props.className), style: props.style }, props.children);
  }

  function Subtitulo(props) {
    return h(props.nivel === 2 ? 'h3' : 'h2', { className: props.nivel === 2 ? 'iq-sub2' : 'iq-sub' }, props.children);
  }

  function Texto(props) {
    var p = props.parrafos || (props.children != null ? [props.children] : []);
    return h(
      'div',
      { className: 'iq-texto' },
      p.map(function (t, i) {
        return h('p', { key: i }, rt(t));
      })
    );
  }

  function Vinetas(props) {
    return h(
      'ul',
      { className: cx('iq-vinetas', props.compacta && 'iq-vinetas-compacta') },
      (props.items || []).map(function (t, i) {
        return h('li', { key: i }, rt(t));
      })
    );
  }

  function ImagenMarco(props) {
    var style = Object.assign({ width: props.ancho, height: props.alto }, props.style);
    return h(
      'figure',
      { className: 'iq-figura', style: { width: props.ancho } },
      props.src
        ? h('img', {
            className: 'iq-img',
            src: props.src,
            alt: props.alt || props.pie || '',
            style: Object.assign({ objectPosition: (props.focalX != null ? props.focalX * 100 : 50) + '% ' + (props.focalY != null ? props.focalY * 100 : 50) + '%' }, style)
          })
        : h('div', { className: 'iq-ph', style: style }, h('span', null, props.placeholder || 'Foto aportada por el PM')),
      props.pie ? h('figcaption', { className: 'iq-pie-foto' }, props.pie) : null
    );
  }

  /* ---------- Structural ---------- */
  function Portada(props) {
    return h(
      Slide,
      { fondo: 'navy', layout: 'portada' },
      h('div', { className: 'iq-portada-fecha' }, props.trimestre),
      h(Logo, { tono: 'blanco', className: 'iq-logo-navy' }),
      h('div', { className: cx('iq-portada-foto', props.recorte === 'sobresale' && 'iq-portada-sobresale') },
        h(ImagenMarco, { src: props.imagen, ancho: 390, alto: 296, placeholder: 'Foto de portada aportada por el PM' })),
      h('div', { className: 'iq-portada-titulo' }, 'INFORME TRIMESTRAL'),
      h('div', { className: 'iq-portada-proyecto' }, props.proyecto)
    );
  }

  function Chevron() {
    return h(
      'svg',
      { className: 'iq-chevron', viewBox: '0 0 32 32', width: 32, height: 32, 'aria-hidden': true },
      h('circle', { cx: 16, cy: 16, r: 15, className: 'iq-chevron-aro' }),
      h('path', { d: 'M13 9 L20 16 L13 23', className: 'iq-chevron-flecha' })
    );
  }

  function Indice(props) {
    var s = props.secciones || [];
    return h(
      Slide,
      { fondo: 'navy', layout: 'indice' },
      h(Logo, { tono: 'blanco', className: 'iq-logo-navy' }),
      h(
        'ol',
        { className: 'iq-indice' },
        s.map(function (t, i) {
          return h(
            'li',
            { key: i, className: i === s.length - 1 ? 'iq-indice-ultimo' : null },
            h('span', { className: 'iq-indice-num' }, (i < 9 ? '0' : '') + (i + 1)),
            h('span', { className: 'iq-indice-label' }, t),
            h(Chevron)
          );
        })
      ),
      h('div', { className: 'iq-indice-titulo' }, 'ÍNDICE')
    );
  }

  var DISCLAIMER = [
    'El presente documento es propiedad de **IMPAR CAPITAL**. Cualquier denominación, diseño, marca y/o logotipos contenidos en el mismo son propiedad intelectual de Impar Capital.',
    'Este documento se limita a describir de forma genérica una oportunidad de inversión y la información contenida es meramente informativa. Por tanto, dicho documento no constituye, bajo ningún concepto, una recomendación, propuesta de inversión o modalidad de asesoramiento análoga alguna para sus destinatarios.',
    'La información contenida en este documento ha sido elaborada sobre la base de condiciones específicas que constituyen premisas o asunciones razonablemente válidas en la fecha de su emisión, de acuerdo con la experiencia de Impar Capital y en cumplimiento de los más altos estándares de cuidado o diligencia. No obstante, dichas condiciones podrían cambiar debido a la incidencia de factores que no dependen de Impar Capital, de modo que éste no garantiza expresa o implícitamente que la información referida sea exacta, completa y/o actualizada en fechas posteriores a aquella en que fue obtenida y/o analizada.',
    'Asimismo, se advierte que este documento podría contener previsiones y/o proyecciones que, por definición, tienen naturaleza incierta. Dichas previsiones responden a expectativas que se han considerado razonables atendiendo a la evolución futura de distintas variables, si bien los resultados reales pueden diferir de dichas expectativas por razón de diversos factores. En particular, y a título meramente enunciativo, tales factores podrían estar relacionados directa o indirectamente con (i) alteraciones macroeconómicas, políticas y/o regulatorias, (ii) variaciones en los mercados, tipos de interés, tipos de cambio u otros riesgos de mercado, (iii) condiciones específicas de la financiación concedida a fin de acometer las inversiones descritas, (iv) plazos de concesión de las licencias, autorizaciones o permisos necesarios por parte de los organismos públicos competentes, (v) costes de construcción, precios de venta, ritmos de comercialización o circunstancias análogas propias del sector o, incluso, (vi) perturbaciones económicas impredecibles a nivel global y/o local (tanto derivadas de factores o circunstancias puramente económicas, como de cualquier otro tipo -como pandemias, catástrofes naturales y/o cualesquiera otras causas de fuerza mayor-), que puedan producirse en el futuro.',
    'El inversor o potencial inversor que tenga acceso a este documento debe ser plenamente consciente de que se trata de un producto complejo, no adecuado para todos los clientes y, cuya rentabilidad es variable pudiendo llegar a perder la totalidad del capital invertido ya que éste no está garantizado. Antes de realizar cualquier inversión debe ser consciente de que se trata de un producto destinado a inversores profesionales que puedan mantener la inversión durante toda la vida del vehículo. Antes de adoptar cualquier decisión de inversión debe tener en cuenta sus circunstancias personales y recurrir, si fuera necesario, a asesoramiento profesional independiente sobre las implicaciones financieras, legales, regulatorias y/o fiscales asociadas a dichas inversiones.',
    'En el supuesto de acometerse las inversiones referidas en este documento, los destinatarios de éste deben ser igualmente conscientes de que dichas inversiones tienen asociados determinados riesgos financieros que deben analizarse o valorarse de forma personalizada antes de formalizar dichas inversiones. En particular, y a título meramente enunciativo, las inversiones podrían presentar (i) riesgos de obtener una rentabilidad inferior a la esperada o de perder todo el capital invertido, (ii) riesgos de iliquidez derivados del desfase entre la fecha real y deseada de la liquidación de la inversión, (iii) riesgos ligados a la transmisibilidad de las acciones o participaciones sociales adquiridas a los efectos de articular las inversiones, (iv) riesgos de dilución, (v) riesgos de no recibir dividendos o (vi) riesgos de no poder influir en la gestión de las sociedades en las que se materialicen las inversiones.',
    'La información contenida en este documento se facilita única y exclusivamente al receptor de este documento, y con el propósito para el que ha sido elaborado. Dicha información tiene carácter confidencial y, en consecuencia, no puede ser parcial o completamente (i) copiada o duplicada en ningún medio o soporte, (ii) redistribuida, citada, divulgada o comunicada ni (iii) entregada a ninguna otra persona o entidad sin la autorización previa y por escrito de Impar Capital.',
    'En ningún caso, Impar Capital, sus administradores, directivos, empleados y/o personal autorizado asumen responsabilidad alguna en relación con cualquier perjuicio, pérdida, reclamación o gastos de ningún tipo que pueda derivar del uso de este documento o de su contenido, y en particular, de la confianza que los inversores o potenciales inversores depositen o puedan depositar en el mismo.',
    'Impar Capital declina expresamente cualquier responsabilidad por error u omisión en la información contenida en este documento.',
    'Los destinatarios de este documento aceptan en su integridad todas las advertencias expresadas anteriormente mediante la mera recepción de este.'
  ];

  function Disclaimer(props) {
    return h(
      Slide,
      { fondo: 'pearl', layout: 'disclaimer', pagina: props.pagina },
      h('h1', { className: 'iq-disclaimer-titulo' }, 'DISCLAIMER'),
      h(Logo, { tono: 'azul', className: 'iq-header-logo' }),
      h(
        'div',
        { className: 'iq-disclaimer-texto' },
        (props.parrafos || DISCLAIMER).map(function (t, i) {
          return h('p', { key: i }, rt(t));
        })
      )
    );
  }

  function Cierre() {
    return h(
      Slide,
      { fondo: 'navy', layout: 'cierre' },
      h('img', { className: 'iq-cierre-fondo', src: assets.cierreMosaico, alt: '' }),
      h(Logo, { tono: 'blanco', className: 'iq-cierre-logo' })
    );
  }

  /* ---------- Narrative ---------- */
  function BloqueIcono(props) {
    return h(
      'div',
      { className: 'iq-bloque-icono' },
      props.icono ? h('img', { className: 'iq-bloque-icono-img', src: icono(props.icono), alt: '' }) : h('span', { className: 'iq-bloque-icono-img' }),
      h(
        'div',
        { className: 'iq-bloque-icono-cuerpo' },
        h(Subtitulo, null, props.titulo),
        props.parrafos ? h(Texto, { parrafos: props.parrafos }) : null,
        props.vinetas ? h(Vinetas, { items: props.vinetas }) : null,
        props.children
      )
    );
  }

  function columnaBloques(bloques) {
    return (bloques || []).map(function (b, i) {
      return h(BloqueIcono, Object.assign({ key: i }, b));
    });
  }

  function ResumenEjecutivo(props) {
    var logros = { icono: 'logros', titulo: 'LOGROS ' + (props.trimestre || ''), vinetas: props.logros };
    var der = [logros].concat(props.derecha || []);
    return h(
      Slide,
      { layout: 'resumen-ejecutivo', pie: props.pie, pagina: props.pagina },
      h(SlideHeader, { seccion: props.seccion || 1, titulo: 'Resumen Ejecutivo del Proyecto. ' + (props.trimestre || '') }),
      h(Contenido, { className: 'iq-cols' }, h('div', null, columnaBloques(props.izquierda)), h('div', null, columnaBloques(der)))
    );
  }

  function AntecedentesNovedades(props) {
    return h(
      'div',
      { className: 'iq-antecedentes' },
      props.titulo ? h(Subtitulo, null, props.titulo) : null,
      h(Subtitulo, { nivel: 2 }, 'Antecedentes. ' + props.anterior.trimestre),
      h(Texto, { parrafos: props.anterior.parrafos }),
      h(Subtitulo, { nivel: 2 }, 'Novedades. ' + props.actual.trimestre),
      h(Texto, { parrafos: props.actual.parrafos }),
      props.actual.vinetas ? h(Vinetas, { items: props.actual.vinetas }) : null
    );
  }

  function DosColumnas(props) {
    return h(
      Slide,
      { layout: 'dos-columnas', pie: props.pie, pagina: props.pagina },
      h(SlideHeader, { seccion: props.seccion, titulo: props.titulo }),
      h(Contenido, { className: 'iq-cols' }, h('div', null, props.izquierda), h('div', null, props.derecha)),
      props.nota ? h('div', { className: 'iq-nota' }, rt(props.nota)) : null
    );
  }

  function TextoImagen(props) {
    var imgs = props.imagenes || [{}];
    var apiladas = props.variante === 'dos-apiladas';
    return h(
      Slide,
      { layout: 'texto-imagen', pie: props.pie, pagina: props.pagina },
      h(SlideHeader, { seccion: props.seccion, titulo: props.titulo }),
      h(
        Contenido,
        { className: 'iq-cols' },
        h('div', null, props.subtitulo ? h(Subtitulo, null, props.subtitulo) : null, h(Texto, { parrafos: props.parrafos }), props.nota ? h('div', { className: 'iq-nota-inline' }, rt(props.nota)) : null),
        h(
          'div',
          { className: 'iq-imagenes-col' },
          (apiladas ? imgs.slice(0, 2) : imgs.slice(0, 1)).map(function (im, i) {
            return h(ImagenMarco, Object.assign({ key: i, ancho: 348, alto: apiladas ? 180 : 290 }, im));
          })
        )
      )
    );
  }

  function MapaLateral(props) {
    return h(
      'aside',
      { className: 'iq-mapa-lateral' },
      h(ImagenMarco, { src: props.mapa, ancho: 262, alto: 176, placeholder: 'Mapa de ubicación' }),
      props.pin ? h('div', { className: 'iq-mapa-pin-label' }, props.pin) : null,
      h('div', { className: 'iq-regla-oro' }),
      h('div', { className: 'iq-mapa-rotulo' }, props.rotulo),
      h(ImagenMarco, { src: props.foto, ancho: 270, alto: 172 })
    );
  }

  /* ---------- Structured data ---------- */
  function TablaKpis(props) {
    return h(
      'table',
      { className: 'iq-tabla iq-tabla-rayada' },
      h('colgroup', null, h('col', { style: { width: '27%' } }), h('col', { style: { width: '17%' } }), h('col')),
      h('thead', null, h('tr', null,
        h('th', null, 'Indicador'),
        h('th', null, 'Estado actual (' + props.trimestre + ')'),
        h('th', null, (props.cabeceraObjetivo || 'Objetivo') + ' (' + props.siguiente + ')'))),
      h('tbody', null, (props.filas || []).map(function (f, i) {
        return h('tr', { key: i }, h('td', null, f.indicador), h('td', { className: 'iq-c' }, f.actual), h('td', null, rt(f.objetivo)));
      }))
    );
  }

  function TablaRiesgos(props) {
    return h(
      'table',
      { className: 'iq-tabla iq-tabla-rayada' },
      h('colgroup', null, h('col', { style: { width: '42%' } }), h('col')),
      h('thead', null, h('tr', null, h('th', null, 'Riesgo identificado'), h('th', null, 'Mitigación'))),
      h('tbody', null, (props.filas || []).map(function (f, i) {
        return h('tr', { key: i }, h('td', null, rt(f.riesgo)), h('td', null, rt(f.mitigacion)));
      }))
    );
  }

  function ListaObjetivos(props) {
    return h('div', { className: 'iq-objetivos' }, h(Subtitulo, null, 'OBJETIVOS ' + props.trimestre), h(Vinetas, { items: props.items, compacta: true }));
  }

  function SlideKpisRiesgosObjetivos(props) {
    return h(
      Slide,
      { layout: 'kpis-riesgos-objetivos', pie: props.pie, pagina: props.pagina },
      h(SlideHeader, { seccion: props.seccion || 3, titulo: 'Resumen de Proyecto. KPIs, Riesgos y Mitigaciones & Objetivos ' + props.siguiente }),
      h(
        Contenido,
        { className: 'iq-apilado' },
        h(Subtitulo, null, 'INDICADORES CLAVE (KPIs)'),
        h(TablaKpis, { trimestre: props.trimestre, siguiente: props.siguiente, filas: props.kpis, cabeceraObjetivo: props.cabeceraObjetivo }),
        h(Subtitulo, null, 'RIESGOS Y MITIGACIONES'),
        h(TablaRiesgos, { filas: props.riesgos }),
        h(ListaObjetivos, { trimestre: props.siguiente, items: props.objetivos })
      )
    );
  }

  function Timeline(props) {
    var hitos = props.hitos || [];
    var n = hitos.length;
    var ancho = props.ancho || 760;
    var paso = n > 1 ? (ancho - 80) / (n - 1) : 0;
    var x0 = 40;
    var y = 92;
    var hechos = hitos.filter(function (m) { return m.hecho; }).length;
    var punto = props.puntoSituacion != null ? props.puntoSituacion : hechos - 0.5;
    var xPunto = x0 + (punto) * paso;
    var xUltimoHecho = hechos ? x0 + (hechos - 1) * paso : x0;
    return h(
      'div',
      { className: cx('iq-timeline', 'iq-timeline-' + (props.variante || 'slate')), style: { width: ancho, height: 170 } },
      h('div', { className: 'iq-tl-linea iq-tl-pend', style: { left: x0, width: ancho - 80, top: y - 1.5 } }),
      hechos ? h('div', { className: 'iq-tl-linea iq-tl-hecha', style: { left: x0, width: Math.max(0, xPunto - x0), top: y - 1.5 } }) : null,
      hitos.map(function (m, i) {
        var x = x0 + i * paso;
        var arriba = i % 2 === 0;
        return h(
          F,
          { key: i },
          h('div', { className: cx('iq-tl-nodo', m.hecho ? 'iq-tl-nodo-hecho' : 'iq-tl-nodo-pend'), style: { left: x, top: y } }),
          h('div', { className: cx('iq-tl-tallo', m.hecho ? 'iq-tl-tallo-hecho' : 'iq-tl-tallo-pend'), style: { left: x, top: arriba ? y - 58 : y + 12, height: 46 } }),
          h(
            'div',
            { className: cx('iq-tl-etiqueta', m.hecho ? 'iq-tl-hecho' : 'iq-tl-pend-txt'), style: { left: x + 6, top: arriba ? y - 64 : y + 22 } },
            h('span', { className: 'iq-tl-num' }, i + 1),
            h('span', { className: 'iq-tl-texto' }, m.titulo, h('br'), h('b', null, m.fecha))
          )
        );
      }),
      props.puntoSituacion !== false && n
        ? h(F, null,
            h('div', { className: 'iq-tl-punto', style: { left: xPunto, top: y + 4 } }),
            h('div', { className: 'iq-tl-punto-label', style: { left: xPunto + 6, top: y + 72 } }, 'Punto de situación'))
        : null,
      props.nota ? h('div', { className: 'iq-nota', style: { position: 'absolute', right: 0, bottom: 0 } }, rt(props.nota)) : null
    );
  }

  function HitosResenables(props) {
    return h(
      'div',
      { className: 'iq-hitos' },
      h(Subtitulo, { nivel: 2 }, 'Hitos reseñables'),
      props.intro ? h(Texto, { parrafos: [props.intro] }) : null,
      h(Vinetas, { items: (props.items || []).map(function (it) { return '**' + it.etiqueta + '**: ' + it.fecha; }), compacta: true })
    );
  }

  function TimelineTrimestral(props) {
    var tr = props.trimestres || [];
    return h(
      'div',
      { className: 'iq-tlq' },
      h('div', { className: 'iq-tlq-linea' }),
      h(
        'div',
        { className: 'iq-tlq-grupos' },
        tr.map(function (q, qi) {
          return h(
            'div',
            { key: qi, className: cx('iq-tlq-grupo', 'iq-tlq-' + (q.estado || 'futuro')) },
            h('div', { className: 'iq-tlq-eventos' },
              (q.eventos || []).map(function (e, i) {
                return h('div', { key: i, className: cx('iq-tlq-evento', i % 2 ? 'iq-tlq-abajo' : 'iq-tlq-arriba') },
                  h('b', null, e.fecha), h('span', null, e.texto));
              })),
            h('div', { className: 'iq-tlq-llave' }),
            h('div', { className: 'iq-tlq-nombre' }, q.nombre)
          );
        })
      )
    );
  }

  /* ---------- Images ---------- */
  var DISPOSICIONES = {
    '1': [[600, 330]],
    '2': [[420, 300], [420, 300]],
    '3': [[280, 260], [280, 260], [280, 260]],
    '4': [[420, 170], [420, 170], [420, 170], [420, 170]],
    'hero-2': [[540, 350], [300, 170], [300, 170]]
  };

  function Galeria(props) {
    var d = props.disposicion || '4';
    var tam = DISPOSICIONES[d] || DISPOSICIONES['4'];
    var imgs = props.imagenes || [];
    return h(
      'div',
      { className: cx('iq-galeria', 'iq-galeria-' + d), style: props.ancho ? { width: props.ancho } : null },
      tam.map(function (t, i) {
        return h(ImagenMarco, Object.assign({ key: i, ancho: props.escala ? t[0] * props.escala : t[0], alto: props.escala ? t[1] * props.escala : t[1] }, imgs[i] || {}));
      })
    );
  }

  /* ---------- Sustainability ---------- */
  function Estrella(p) {
    return h('svg', { viewBox: '0 0 24 24', width: 22, height: 22, 'aria-hidden': true },
      h('path', { className: p.llena ? 'iq-estrella-llena' : 'iq-estrella-vacia', d: 'M12 2.5l2.9 6.2 6.8.8-5 4.6 1.3 6.7L12 17.5l-6 3.3 1.3-6.7-5-4.6 6.8-.8z' }));
  }

  function BreeamRating(props) {
    var total = props.total || 5;
    var arr = [];
    for (var i = 0; i < total; i++) arr.push(h(Estrella, { key: i, llena: i < (props.estrellas || 0) }));
    return h('div', { className: 'iq-breeam', role: 'img', 'aria-label': props.estrellas + ' de ' + total + ' estrellas' },
      h('span', { className: 'iq-breeam-estrellas' }, arr),
      h('span', { className: 'iq-breeam-label' }, h('b', null, props.calificacion), props.rango ? ' (' + props.rango + ')' : ''));
  }

  function fmtPct(v) {
    return (Math.round(v * 100) / 100).toFixed(2).replace('.', ',') + ' %';
  }

  function BarrasBreeam(props) {
    var max = props.max || Math.max.apply(null, (props.categorias || []).map(function (c) { return Math.max(c.objetivo || 0, c.avance || 0); }).concat([1]));
    return h(
      'div',
      { className: 'iq-barras' },
      props.titulo ? h('div', { className: 'iq-barras-titulo' }, props.titulo) : null,
      (props.categorias || []).map(function (c, i) {
        return h('div', { key: i, className: 'iq-barras-fila' },
          h('span', { className: 'iq-barras-cat' }, c.nombre),
          h('span', { className: 'iq-barras-pista' },
            h('span', { className: 'iq-barra iq-barra-obj', style: { width: (c.objetivo / max) * 100 + '%' } }),
            h('span', { className: 'iq-barra iq-barra-av', style: { width: ((c.avance || 0) / max) * 100 + '%' } })),
          h('span', { className: 'iq-barras-val' }, fmtPct(c.objetivo)));
      }),
      h('div', { className: 'iq-leyenda' },
        h('span', null, h('i', { className: 'iq-sw iq-barra-obj' }), 'OBJETIVO'),
        h('span', null, h('i', { className: 'iq-sw iq-barra-av' }), 'AVANCE'))
    );
  }

  function BarraConsolidacion(props) {
    var segs = props.segmentos || [];
    return h(
      'div',
      { className: 'iq-consol' },
      h('div', { className: 'iq-consol-barra' },
        segs.map(function (s, i) {
          return h('span', { key: i, className: 'iq-consol-seg iq-tono-' + (s.tono || i), style: { width: s.valor + '%' } }, s.valor >= 8 ? fmtPct(s.valor) : '');
        })),
      h('div', { className: 'iq-leyenda' },
        segs.map(function (s, i) {
          return h('span', { key: i }, h('i', { className: 'iq-sw iq-tono-' + (s.tono || i) }), s.etiqueta);
        }))
    );
  }

  /* ---------- Collaborators & vehicle ---------- */
  function Colaboradores(props) {
    var roles = props.roles || [];
    var mitad = Math.ceil(roles.length / 2);
    function col(rs) {
      return rs.map(function (r, i) {
        return h('div', { key: i, className: 'iq-colab-rol' }, h(Subtitulo, null, r.rol), r.parrafos ? h(Texto, { parrafos: r.parrafos }) : null, r.vinetas ? h(Vinetas, { items: r.vinetas, compacta: true }) : null);
      });
    }
    return h(
      Slide,
      { layout: 'colaboradores', pie: props.pie, pagina: props.pagina },
      h(SlideHeader, { seccion: props.seccion || 5, titulo: 'Colaboradores' }),
      h(Contenido, null,
        props.intro ? h(Texto, { parrafos: [props.intro] }) : null,
        h('div', { className: 'iq-cols' }, h('div', null, col(roles.slice(0, mitad))), h('div', null, col(roles.slice(mitad))))),
      h('div', { className: 'iq-colab-logos' },
        (props.logos || []).map(function (l, i) {
          return h('figure', { key: i, className: 'iq-colab-logo' },
            l.src ? h('img', { src: l.src, alt: l.nombre || '' }) : h('div', { className: 'iq-ph iq-ph-logo' }, h('span', null, l.nombre || 'Logo')),
            l.pie ? h('figcaption', null, l.pie) : null);
        }))
    );
  }

  function VehiculoInversion(props) {
    return h(
      Slide,
      { layout: 'vehiculo', pie: props.pie, pagina: props.pagina },
      h(SlideHeader, { seccion: props.seccion || 6, titulo: props.titulo || 'Vehículo de inversión. Detalles' }),
      h(Contenido, null,
        h(Subtitulo, null, 'DETALLES DEL VEHÍCULO DE INVERSIÓN'),
        h(Vinetas, { items: props.detalles }),
        h('div', { className: 'iq-fichas' },
          (props.fichas || []).map(function (f, i) {
            return h('div', { key: i, className: 'iq-ficha' },
              h('img', { src: icono(f.icono), alt: '' }),
              h('div', { className: 'iq-ficha-label' }, f.etiqueta),
              h('div', { className: 'iq-ficha-valor' }, f.valor));
          })),
        props.nota ? h('div', { className: 'iq-nota-inline' }, rt(props.nota)) : null)
    );
  }

  function ConsejoAdministracion(props) {
    return h('div', { className: 'iq-consejo' },
      h(Subtitulo, null, props.titulo),
      props.intro ? h(Texto, { parrafos: [props.intro] }) : null,
      h('ol', { className: 'iq-consejo-lista' }, (props.puntos || []).map(function (p, i) { return h('li', { key: i }, rt(p)); })));
  }

  /* ---------- Locked / external ---------- */
  function Candado() {
    return h('svg', { viewBox: '0 0 24 24', width: 14, height: 14, 'aria-hidden': true, className: 'iq-candado' },
      h('rect', { x: 5, y: 11, width: 14, height: 10, rx: 1 }),
      h('path', { d: 'M8 11V7a4 4 0 0 1 8 0v4', fill: 'none' }));
  }

  function SlideBloqueado(props) {
    return h(
      Slide,
      { layout: 'bloqueado', pie: props.pie, pagina: props.pagina },
      props.titulo ? h(SlideHeader, { seccion: props.seccion, titulo: props.titulo }) : null,
      h('div', { className: 'iq-bloqueado-cuerpo' }, props.children || (props.vista ? h('img', { src: props.vista, alt: props.titulo || '' }) : null)),
      h('div', { className: 'iq-bloqueado-sello' }, h(Candado), ' Bloqueado · ', props.origen || 'Finanzas', props.version ? ' · v' + props.version : '', props.estado ? ' · ' + props.estado : '')
    );
  }

  function KpiIconosFinancieros(props) {
    return h('div', { className: 'iq-kpi-iconos', style: { gridTemplateColumns: 'repeat(' + (props.columnas || 4) + ', 1fr)' } },
      (props.kpis || []).map(function (k, i) {
        return h('div', { key: i, className: 'iq-kpi-icono' },
          h('img', { src: icono(k.icono), alt: '' }),
          h('div', { className: 'iq-kpi-icono-label' }, k.etiqueta),
          h('div', { className: 'iq-kpi-icono-valor' }, k.valor));
      }));
  }

  function TablaVarianzas(props) {
    return h(
      'table',
      { className: 'iq-tabla iq-tabla-var' },
      h('thead', null,
        h('tr', null,
          h('th', { rowSpan: 2, className: 'iq-l' }, 'Descripción'),
          h('th', { colSpan: 2 }, 'Proyecciones Financieras'),
          h('th', { colSpan: 2 }, 'Variación'),
          h('th', { rowSpan: 2, className: 'iq-l' }, 'Observaciones')),
        h('tr', null,
          h('th', null, props.anterior), h('th', { className: 'iq-var-actual' }, props.actual),
          h('th', null, 'Informe previo €'), h('th', null, 'Informe previo %'))),
      h('tbody', null, (props.filas || []).map(function (f, i) {
        return h('tr', { key: i },
          h('td', null, f.descripcion),
          h('td', { className: 'iq-r' }, f.previo),
          h('td', { className: 'iq-r iq-var-actual' }, f.actual),
          h('td', { className: 'iq-r' }, f.variacion),
          h('td', { className: 'iq-r' }, f.variacionPct),
          h('td', null, rt(f.observaciones)));
      }))
    );
  }

  function TablaFinanciera(props) {
    var cols = props.columnas || [];
    return h('div', { className: 'iq-tfin' },
      h('div', { className: 'iq-tfin-barra' }, props.titulo),
      h('table', { className: 'iq-tabla iq-tabla-fin' },
        h('thead', null, h('tr', null, cols.map(function (c, i) { return h('th', { key: i, className: i ? 'iq-r' : 'iq-l' }, c); }))),
        h('tbody', null, (props.filas || []).map(function (f, i) {
          return h('tr', { key: i, className: f.total ? 'iq-tfin-total' : null }, f.celdas.map(function (c, j) { return h('td', { key: j, className: j ? 'iq-r' : null }, c); }));
        }))));
  }

  function TablaLicitaciones(props) {
    var cols = props.columnas || ['Lote', 'Alcance', 'Empresas previstas'];
    return h('div', { className: 'iq-tlic' },
      h('table', { className: 'iq-tabla iq-tabla-lic' },
        h('thead', null,
          h('tr', null, h('th', { colSpan: cols.length, className: 'iq-tlic-titulo' }, props.titulo)),
          h('tr', null, cols.map(function (c, i) { return h('th', { key: i }, c); }))),
        h('tbody', null, (props.filas || []).map(function (f, i) {
          return h('tr', { key: i }, f.map(function (c, j) { return h('td', { key: j }, rt(c)); }));
        }))));
  }

  function TablaMensual(props) {
    var meses = props.meses || [];
    return h('table', { className: 'iq-tabla iq-tabla-mensual' },
      h('thead', null, h('tr', null, h('th', { className: 'iq-l' }, 'Activo'), meses.map(function (m, i) { return h('th', { key: i }, m); }), h('th', null, props.etiquetaTotal || 'Total'))),
      h('tbody', null,
        (props.filas || []).map(function (f, i) {
          return h('tr', { key: i, className: f.vendido ? 'iq-vendido' : null },
            h('td', null, f.activo), f.valores.map(function (v, j) { return h('td', { key: j, className: 'iq-r' }, v); }), h('td', { className: 'iq-r' }, f.total));
        }),
        props.total ? h('tr', { className: 'iq-tfin-total' }, h('td', null, 'TOTAL'), props.total.valores.map(function (v, j) { return h('td', { key: j, className: 'iq-r' }, v); }), h('td', { className: 'iq-r' }, props.total.total)) : null));
  }

  var TONOS_DONUT = ['var(--navy)', 'var(--slate-600)', 'var(--periwinkle)', 'var(--teal-600)', 'var(--teal-200)', 'var(--pearl-300)'];

  function DonutOcupacion(props) {
    var segs = props.segmentos || [];
    var tot = segs.reduce(function (a, s) { return a + s.valor; }, 0) || 1;
    var r = 42, c = 2 * Math.PI * r, acc = 0;
    return h('figure', { className: 'iq-donut' },
      props.titulo ? h('figcaption', { className: 'iq-donut-titulo' }, props.titulo) : null,
      h('svg', { viewBox: '0 0 120 120', width: props.tam || 140, height: props.tam || 140, role: 'img', 'aria-label': props.titulo },
        segs.map(function (s, i) {
          var len = (s.valor / tot) * c;
          var el = h('circle', { key: i, cx: 60, cy: 60, r: r, fill: 'none', stroke: TONOS_DONUT[i % TONOS_DONUT.length], strokeWidth: 18, strokeDasharray: len + ' ' + (c - len), strokeDashoffset: -acc, transform: 'rotate(-90 60 60)' });
          acc += len;
          return el;
        })),
      h('div', { className: 'iq-leyenda iq-leyenda-v' },
        segs.map(function (s, i) {
          return h('span', { key: i }, h('i', { className: 'iq-sw', style: { background: TONOS_DONUT[i % TONOS_DONUT.length] } }), s.etiqueta + ' · ' + Math.round((s.valor / tot) * 100) + ' %');
        })));
  }

  window.ImparInformes = {
    assets: assets,
    textoPie: textoPie,
    partirTitulo: partirTitulo,
    rt: rt,
    Slide: Slide, SlideHeader: SlideHeader, Contenido: Contenido, Logo: Logo, PieConfidencial: PieConfidencial,
    Subtitulo: Subtitulo, Texto: Texto, Vinetas: Vinetas, ImagenMarco: ImagenMarco,
    Portada: Portada, Indice: Indice, Disclaimer: Disclaimer, Cierre: Cierre,
    BloqueIcono: BloqueIcono, ResumenEjecutivo: ResumenEjecutivo, AntecedentesNovedades: AntecedentesNovedades,
    DosColumnas: DosColumnas, TextoImagen: TextoImagen, MapaLateral: MapaLateral,
    TablaKpis: TablaKpis, TablaRiesgos: TablaRiesgos, ListaObjetivos: ListaObjetivos, SlideKpisRiesgosObjetivos: SlideKpisRiesgosObjetivos,
    Timeline: Timeline, HitosResenables: HitosResenables, TimelineTrimestral: TimelineTrimestral,
    Galeria: Galeria, BreeamRating: BreeamRating, BarrasBreeam: BarrasBreeam, BarraConsolidacion: BarraConsolidacion,
    Colaboradores: Colaboradores, VehiculoInversion: VehiculoInversion, ConsejoAdministracion: ConsejoAdministracion,
    SlideBloqueado: SlideBloqueado, KpiIconosFinancieros: KpiIconosFinancieros, TablaVarianzas: TablaVarianzas,
    TablaFinanciera: TablaFinanciera, TablaLicitaciones: TablaLicitaciones, TablaMensual: TablaMensual, DonutOcupacion: DonutOcupacion
  };
})();
