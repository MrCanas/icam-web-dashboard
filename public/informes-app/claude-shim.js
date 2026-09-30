/*
 * claude-shim.js — la app de informes dentro del portal ICAM.
 *
 * La app (app.html) está escrita contra las capacidades de un artifact de
 * claude.ai: window.claude.use('db' | 'sample' | 'assets' | 'downloads').
 * Este fichero implementa esa misma interfaz contra las rutas del portal
 * (/api/informes/*), de modo que la app funciona igual en los dos sitios.
 *
 * Solo se incluye en la build `--destino dashboard` de construir_app.py.
 * También define window.ICAM, que activa los ganchos propios del portal
 * (proyectos de pm_activos, actas y planificación como fuentes automáticas).
 */
(function () {
  'use strict';
  var BASE = '/api/informes';
  var MAX_LADO = 1600;

  function errorCon(code, message) { var e = new Error(message || code); e.code = code; return e; }

  function irALogin() {
    try { (window.top || window).location.href = '/login'; } catch (e) { window.location.href = '/login'; }
  }

  function pedir(url, opciones) {
    return fetch(url, Object.assign({ credentials: 'same-origin', cache: 'no-store' }, opciones || {})).then(function (r) {
      if (r.status === 401) { irALogin(); throw errorCon('session_expired', 'Sesión caducada'); }
      if (r.status === 403) throw errorCon('permission_denied', 'Sin permiso');
      return r;
    });
  }
  function json(r) {
    if (!r.ok) {
      return r.json().catch(function () { return {}; }).then(function (b) {
        var msg = b && (typeof b.error === 'string' ? b.error : b.error && b.error.message);
        throw errorCon(r.status === 413 ? 'too_large' : 'error_' + r.status, msg || ('HTTP ' + r.status));
      });
    }
    return r.json();
  }

  /* ---------------- Identidad y permisos ---------------- */
  var yo = pedir('/api/me').then(json).then(function (u) {
    var zona = (u.zones || []).filter(function (z) { return z.zone_key === 'pm'; })[0];
    var rol = zona ? zona.role : null;
    return { usuario: u, rol: rol, escribe: rol === 'admin' || rol === 'editor' };
  }).catch(function () { return { usuario: null, rol: null, escribe: false }; });

  /* ---------------- db: colecciones y documentos ---------------- */
  function snapshot(docs) {
    return { docs: docs.map(function (d) { return { id: d.id, data: function () { return d.datos; } }; }), empty: !docs.length, size: docs.length };
  }
  var suscripciones = {};
  function listar(coleccion, filtro) {
    var q = filtro ? '?campo=' + encodeURIComponent(filtro.campo) + '&valor=' + encodeURIComponent(filtro.valor) : '';
    return pedir(BASE + '/db/' + coleccion + q).then(json).then(function (b) { return snapshot(b.docs || []); });
  }
  function refrescar(coleccion) {
    (suscripciones[coleccion] || []).forEach(function (s) {
      listar(coleccion).then(s.ok, function (e) { if (s.ko) s.ko(e); });
    });
  }
  // Sin tiempo real: se recarga al volver a la pestaña (otra PM puede haber
  // creado un informe) como mucho una vez por minuto.
  var ultimoFoco = Date.now();
  window.addEventListener('focus', function () {
    if (Date.now() - ultimoFoco < 60000) return;
    ultimoFoco = Date.now();
    Object.keys(suscripciones).forEach(refrescar);
  });

  function coleccion(nombre) {
    return {
      onSnapshot: function (ok, ko) {
        var s = { ok: ok, ko: ko };
        (suscripciones[nombre] = suscripciones[nombre] || []).push(s);
        listar(nombre).then(ok, function (e) { if (ko) ko(e); });
        return function () { suscripciones[nombre] = (suscripciones[nombre] || []).filter(function (x) { return x !== s; }); };
      },
      get: function () { return listar(nombre); },
      where: function (campo, op, valor) {
        if (op !== '==') throw errorCon('unsupported', 'Solo se admite where(campo, "==", valor)');
        return { get: function () { return listar(nombre, { campo: campo, valor: valor }); } };
      }
    };
  }
  function documento(ruta) {
    var partes = String(ruta).split('/');
    if (partes.length !== 2) throw errorCon('invalid_path', 'Ruta no válida: ' + ruta);
    var url = BASE + '/db/' + encodeURIComponent(partes[0]) + '/' + encodeURIComponent(partes[1]);
    return {
      id: partes[1],
      get: function () {
        return pedir(url).then(function (r) {
          if (r.status === 404) return { exists: false, id: partes[1], data: function () { return undefined; } };
          return json(r).then(function (b) { return { exists: true, id: partes[1], data: function () { return b.datos; } }; });
        });
      },
      set: function (datos) {
        return pedir(url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(datos) }).then(json);
      },
      delete: function () { return pedir(url, { method: 'DELETE' }).then(json); }
    };
  }
  var db = { collection: coleccion, doc: documento };

  /* ---------------- Imágenes ---------------- */
  function aJpeg(blob) {
    return createImageBitmap(blob).then(function (bmp) {
      var k = Math.min(1, MAX_LADO / Math.max(bmp.width, bmp.height));
      var cv = document.createElement('canvas');
      cv.width = Math.round(bmp.width * k); cv.height = Math.round(bmp.height * k);
      cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height);
      return new Promise(function (ok) { cv.toBlob(ok, 'image/jpeg', 0.85); });
    });
  }
  function aBase64(blob) {
    return new Promise(function (ok, ko) {
      var fr = new FileReader();
      fr.onload = function () { ok(String(fr.result).split(',')[1] || ''); };
      fr.onerror = function () { ko(fr.error); };
      fr.readAsDataURL(blob);
    });
  }

  var assets = {
    upload: function (blob, opciones) {
      var tipo = (opciones && opciones.type) || blob.type || 'image/jpeg';
      return pedir(BASE + '/assets', { method: 'POST', headers: { 'Content-Type': tipo }, body: blob }).then(json)
        .then(function (b) { return { id: b.id, url: BASE + '/assets/' + b.id }; });
    },
    delete: function (id) { return pedir(BASE + '/assets/' + encodeURIComponent(id), { method: 'DELETE' }).then(json); }
  };

  /* ---------------- sample: peticiones a Claude ---------------- */
  var sample = {
    limits: function () { return Promise.resolve({ images: { maxCount: 4 } }); },
    json: function (prompt, o) {
      o = o || {};
      var imagenes = (o.images || []).slice(0, 4);
      return Promise.all(imagenes.map(function (b) {
        return aJpeg(b).then(aBase64).then(function (data) { return { mediaType: 'image/jpeg', data: data }; });
      })).then(function (imgs) {
        return fetch(BASE + '/claude', {
          method: 'POST', credentials: 'same-origin', signal: o.signal,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: prompt, imagenes: imgs, informeId: o.informeId || null })
        });
      }).then(function (r) {
        if (!r.ok) {
          return r.json().catch(function () { return {}; }).then(function (b) {
            if (r.status === 401) irALogin();
            var e = (b && b.error) || {};
            throw errorCon(e.code || (r.status === 401 ? 'session_expired' : r.status === 403 ? 'not_granted' : 'api_error'), e.message);
          });
        }
        var lector = r.body.getReader(), dec = new TextDecoder(), resto = '', fin = null;
        function linea(l) {
          if (!l.trim()) return;
          var m = JSON.parse(l);
          if (m.t != null) { if (o.onText) { try { o.onText(m.t); } catch (e) { /* la UI no debe cortar la petición */ } } }
          else fin = m;
        }
        function leer() {
          return lector.read().then(function (x) {
            if (x.done) {
              linea(resto);
              if (!fin) throw errorCon('api_error', 'La respuesta de Claude se cortó');
              if (fin.error) throw errorCon(fin.error.code, fin.error.message);
              return fin.json;
            }
            var partes = (resto + dec.decode(x.value, { stream: true })).split('\n');
            resto = partes.pop();
            partes.forEach(linea);
            return leer();
          });
        }
        return leer();
      }).catch(function (e) {
        if (e && e.name === 'AbortError') throw errorCon('cancelled', 'Parado');
        throw e;
      });
    }
  };

  /* ---------------- downloads ---------------- */
  var downloads = {
    save: function (o) {
      var url = URL.createObjectURL(o.data), a = document.createElement('a');
      a.href = url; a.download = o.filename || 'descarga';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 10000);
      return Promise.resolve({ ok: true });
    }
  };

  /* ---------------- API pública ---------------- */
  window.claude = {
    use: function (nombre) {
      return yo.then(function (p) {
        if (nombre === 'db') return db;
        if (nombre === 'downloads') return downloads;
        // Un lector de la zona pm consulta informes pero no genera ni sube fotos:
        // sin estas capacidades la app ya desactiva esos botones.
        if (nombre === 'sample') return p.escribe ? sample : null;
        if (nombre === 'assets') return p.escribe ? assets : null;
        return null;
      });
    }
  };

  window.ICAM = {
    version: 1,
    permisos: function () { return yo; },
    /** Parámetros de la URL: ?activo=<id_activo> abre la app con ese proyecto elegido. */
    parametro: function (n) { try { return new URLSearchParams(window.location.search).get(n); } catch (e) { return null; } },
    fuentesAutomaticas: function (idActivo, trimestre) {
      var q = '?activo=' + encodeURIComponent(idActivo) + '&trimestre=' + encodeURIComponent(trimestre);
      return pedir(BASE + '/fuentes-auto' + q).then(json);
    },
    uso: function (informeId) { return pedir(BASE + '/uso?informe=' + encodeURIComponent(informeId)).then(json); }
  };
})();
