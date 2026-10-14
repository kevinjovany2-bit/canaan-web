/* =====================================================================
   nube.js — conexión con Supabase (datos, fotos y acceso del administrador)
   La web pública LEE de aquí; el editor y productos.html ESCRIBEN aquí.
   Si Supabase no responde, la web usa datos.js y pagina.js como respaldo.
   ===================================================================== */
(function (W) {
  'use strict';
  var N = W.NUBE = {
    url: 'https://hqywpbzvkplbkdvdyhhm.supabase.co',
    key: 'sb_publishable_eHf8KxGVmu_Cz09CI3iPtQ_aigm_oDH',
    bucket: 'imagenes',
    tabla: 'contenido'
  };
  /* Fotos que vienen dentro de la carpeta del sitio. Todo lo que se suba
     desde el editor o desde productos.html se guarda en Supabase Storage. */
  N.locales = {
    'images/Dise_o_sin_t_tulo__38__y54r.png': 1,
    'images/IMG_8538.jpg': 1,
    'images/IMG_8556.jpg': 1,
    'images/IMG_8607.jpg': 1,
    'images/IMG_8637.jpg': 1,
    'images/IMG_8708.jpg': 1,
    'images/IMG_8730.jpg': 1,
    'images/IMG_8784.jpg': 1,
    'images/IMG_8795.jpg': 1,
    'images/IMG_8840.jpg': 1,
    'images/logo_canaan__1_.png': 1,
    'images/mini/Dise_o_sin_t_tulo__38__y54r.jpg': 1,
    'images/mini/IMG_8538.jpg': 1,
    'images/mini/IMG_8556.jpg': 1,
    'images/mini/IMG_8607.jpg': 1,
    'images/mini/IMG_8637.jpg': 1,
    'images/mini/IMG_8708.jpg': 1,
    'images/mini/IMG_8730.jpg': 1,
    'images/mini/IMG_8784.jpg': 1,
    'images/mini/IMG_8795.jpg': 1,
    'images/mini/IMG_8840.jpg': 1,
    'images/mini/logo_canaan__1_.jpg': 1
  };
  var SES = 'canaan_sesion';

  /* ---------- rutas de fotos/fuentes ---------- */
  N.ruta = function (p) {
    if (!p || typeof p !== 'string') return p;
    if (/^(https?:|data:|blob:)/.test(p)) return p;
    if (/^(images|fonts)\/https?:/.test(p)) return p.replace(/^(images|fonts)\//, '');
    if (/^(images|fonts)\//.test(p) && !N.locales[p]) return N.url + '/storage/v1/object/public/' + N.bucket + '/' + p.split('/').map(encodeURIComponent).join('/');
    return p;
  };
  if (W.PG) W.PG.asset = N.ruta;

  /* ---------- sesión ---------- */
  N.sesion = function () { try { return JSON.parse(localStorage.getItem(SES)); } catch (e) { return null; } };
  function guardarSesion(j) {
    var s = { at: j.access_token, rt: j.refresh_token, exp: Date.now() + ((j.expires_in || 3600) - 60) * 1000, email: (j.user && j.user.email) || '' };
    try { localStorage.setItem(SES, JSON.stringify(s)); } catch (e) {}
    return s;
  }
  function errMsg(j, r) { return (j && (j.error_description || j.msg || j.message || j.error)) || ('Error ' + r.status); }
  async function auth(tipo, body) {
    var r = await fetch(N.url + '/auth/v1/token?grant_type=' + tipo, { method: 'POST', headers: { apikey: N.key, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    var j = await r.json().catch(function () { return null; });
    if (!r.ok) throw new Error(errMsg(j, r));
    return guardarSesion(j);
  }
  N.entrar = function (email, clave) {
    return auth('password', { email: email, password: clave }).catch(function (e) {
      if (/invalid login|invalid_grant|credentials/i.test(e.message)) throw new Error('Correo o contraseña incorrectos');
      if (/failed to fetch|network/i.test(e.message)) throw new Error('Sin conexión con Supabase. Revisa tu internet.');
      throw e;
    });
  };
  N.salir = function () { try { localStorage.removeItem(SES); } catch (e) {} };
  /* devuelve un token válido (renueva la sesión si venció) o null */
  N.token = async function () {
    var s = N.sesion(); if (!s) return null;
    if (Date.now() < s.exp) return s.at;
    try { return (await auth('refresh_token', { refresh_token: s.rt })).at; } catch (e) { N.salir(); return null; }
  };
  async function hdr(extra) {
    var t = await N.token(); if (!t) throw new Error('Tu sesión venció. Recarga la página y vuelve a entrar.');
    var h = { apikey: N.key, Authorization: 'Bearer ' + t }; for (var k in extra) h[k] = extra[k]; return h;
  }

  /* ---------- leer (público) ---------- */
  /* N.leer(['datos','pagina']) → { datos: {...}, pagina: {...} } (solo las que existan) */
  N.leer = async function (claves, ms) {
    var ctl = W.AbortController ? new AbortController() : null, tm = ctl && setTimeout(function () { ctl.abort(); }, ms || 8000);
    try {
      var r = await fetch(N.url + '/rest/v1/' + N.tabla + '?select=clave,valor&clave=in.(' + claves.join(',') + ')', { headers: { apikey: N.key }, cache: 'no-store', signal: ctl && ctl.signal });
      if (!r.ok) { var j = await r.json().catch(function () { return null; }); throw new Error(errMsg(j, r)); }
      var out = {}; (await r.json()).forEach(function (row) { try { out[row.clave] = JSON.parse(row.valor); } catch (e) {} });
      return out;
    } finally { if (tm) clearTimeout(tm); }
  };

  /* ---------- escribir (requiere sesión) ---------- */
  /* N.guardar({ borrador: doc, pagina: doc }) */
  N.guardar = async function (obj) {
    var filas = Object.keys(obj).map(function (k) { return { clave: k, valor: JSON.stringify(obj[k]) }; });
    var r = await fetch(N.url + '/rest/v1/' + N.tabla + '?on_conflict=clave', { method: 'POST', headers: await hdr({ 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' }), body: JSON.stringify(filas) });
    if (!r.ok) { var j = await r.json().catch(function () { return null; }); throw new Error(traducir(errMsg(j, r))); }
  };
  /* sube una foto/fuente a Storage en la ruta indicada (p. ej. "images/vestido_ab12.jpg") */
  N.subir = async function (ruta, archivo) {
    var r = await fetch(N.url + '/storage/v1/object/' + N.bucket + '/' + ruta.split('/').map(encodeURIComponent).join('/'), { method: 'POST', headers: await hdr({ 'Content-Type': archivo.type || 'application/octet-stream', 'x-upsert': 'true', 'cache-control': '31536000' }), body: archivo });
    if (!r.ok) { var j = await r.json().catch(function () { return null; }); throw new Error('No se pudo subir ' + ruta.split('/').pop() + ': ' + traducir(errMsg(j, r))); }
  };
  function traducir(m) {
    if (/does not exist|relation|schema cache/i.test(m)) return m + ' · Falta crear la tabla "contenido" en Supabase (SQL Editor).';
    if (/bucket not found/i.test(m)) return m + ' · Falta crear el bucket "imagenes" en Supabase Storage.';
    if (/row-level security|violates|unauthorized|jwt/i.test(m)) return m + ' · Sin permiso: vuelve a entrar o revisa las políticas (RLS) en Supabase.';
    return m;
  }

  /* ---------- primera vez: copia el contenido actual de la carpeta a Supabase ---------- */
  N.cargarAdmin = async function () {
    var d = await N.leer(['datos', 'pagina', 'borrador'], 15000), falta = {};
    if (!d.datos && W.SITIO) falta.datos = W.SITIO;
    if (!d.pagina && W.PAGINA) falta.pagina = W.PAGINA;
    if (!d.borrador && (W.PAGINA_BORRADOR || W.PAGINA)) falta.borrador = W.PAGINA_BORRADOR || W.PAGINA;
    if (Object.keys(falta).length) await N.guardar(falta);
    if (d.datos) W.SITIO = d.datos;
    if (d.pagina) W.PAGINA = d.pagina;
    if (d.borrador) W.PAGINA_BORRADOR = d.borrador;
    return d;
  };
})(window);
