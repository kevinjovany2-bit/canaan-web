/* =====================================================================
   ed-io.js — Guardar → Previsualizar → Publicar, carpeta, acceso y arranque
     Todo se guarda en Supabase (tabla "contenido"):
       borrador        = lo que guardas (la web pública NO lo muestra)
       pagina          = lo publicado (lo que ve el cliente)
       pagina_anterior = copia de lo publicado antes de la última publicación
     Fotos y fuentes nuevas se suben a Supabase Storage (bucket "imagenes").
   ===================================================================== */
(function (W) {
  'use strict';
  var $ = function (i) { return document.getElementById(i); };

  ED.toast = function (msg, kind) {
    var t = $('toast'); t.textContent = msg; t.className = 'show ' + (kind || ''); clearTimeout(ED._tt); ED._tt = setTimeout(function () { t.className = ''; }, kind === 'err' || kind === 'warn' ? 11000 : 4200);
  };

  function usedFiles() { var s = JSON.stringify(ED.doc); return Object.keys(ED.pending).filter(function (p) { return s.indexOf(p) >= 0; }); }
  async function subirPendientes() {
    var files = usedFiles();
    for (var i = 0; i < files.length; i++) { await NUBE.subir(files[i], ED.files[files[i]]); delete ED.pending[files[i]]; ED.idbDel(files[i]); }
  }

  /* ---------- guardar (borrador) ---------- */
  ED.save = async function (quiet) {
    var btn = $('b-save'); btn.disabled = true;
    try {
      await subirPendientes();
      await NUBE.guardar({ borrador: ED.doc });
      ED.dirty = false; ED.emit('status'); if (!quiet) ED.toast('Borrador guardado en la nube. Aún NO es público: usa Publicar.', 'ok');
      return true;
    } catch (e) { ED.toast('No se pudo guardar: ' + e.message, 'err'); return false; }
    finally { btn.disabled = false; }
  };

  /* ---------- publicar ---------- */
  ED.publish = async function () {
    if (!confirm('Publicar: la web pública mostrará este diseño.\nLa versión publicada anterior se conserva como respaldo.\n\n¿Publicar ahora?')) return;
    var btn = $('b-pub'); btn.disabled = true;
    try {
      var ok = await ED.save(true); if (!ok) return;
      var prev = null; try { prev = (await NUBE.leer(['pagina'])).pagina; } catch (e) {}
      var obj = { pagina: ED.doc }; if (prev) obj.pagina_anterior = prev;
      await NUBE.guardar(obj);
      ED.toast('✔ Publicado. Ya está visible en la web para todo el mundo.', 'ok');
      ED.pub = JSON.parse(JSON.stringify(ED.doc)); ED.emit('status');
    } catch (e) { ED.toast('No se pudo publicar: ' + e.message, 'err'); } finally { btn.disabled = false; }
  };

  /* ---------- acceso + arranque ---------- */
  var booted = false;
  function boot() {
    if (booted) return; booted = true;
    ED.load().then(function () {
      ED.initPanels(); ED.render();
      requestAnimationFrame(function () { ED.fit(); ED.emit('status'); document.body.classList.add('ready');
        if (location.hash === '#logo') setTimeout(function () { /* viene de "productos": selecciona el logo */
          var m = ED.doc.secs.filter(function (s) { return s.t === 'menu'; })[0], l = ED.doc.els.filter(function (e) { return e.logo || /^logo$/i.test(e.n || ''); })[0];
          if (l) { ED.select([l.id]); ED.emit('scrollto', l.sec); } else if (m) { ED.selectPiece(m.id, 'logo'); ED.emit('scrollto', m.id); }
        }, 150); });
    });
  }
  /* trae de Supabase los datos, lo publicado y el borrador; luego abre el editor */
  async function abrir() {
    $('err').textContent = 'Cargando desde la nube…';
    try { await NUBE.cargarAdmin(); }
    catch (e) { $('err').textContent = 'No se pudo cargar: ' + e.message; $('login').style.display = ''; return; }
    $('err').textContent = ''; $('login').style.display = 'none'; boot();
  }
  async function entrar() {
    var b = $('entrar'); b.disabled = true; $('err').textContent = 'Entrando…';
    try { await NUBE.entrar($('correo').value.trim(), $('clave').value); await abrir(); }
    catch (e) { $('err').textContent = e.message; }
    finally { b.disabled = false; }
  }
  $('entrar').onclick = entrar; $('clave').onkeydown = function (e) { if (e.key === 'Enter') entrar(); };
  NUBE.token().then(function (t) { if (t) abrir(); else { var s = NUBE.sesion(); if (s && s.email) $('correo').value = s.email; setTimeout(function () { $(s && s.email ? 'clave' : 'correo').focus(); }, 50); } });
  $('b-save').onclick = function () { ED.save(); }; $('b-pub').onclick = function () { ED.publish(); };
  $('b-salir').onclick = function () { if (ED.dirty && !confirm('Tienes cambios sin guardar en la nube. ¿Salir igual?')) return; NUBE.salir(); location.reload(); };
  $('b-open').onclick = function () { W.open('index.html?preview=1', '_blank'); };
  W.addEventListener('beforeunload', function (e) { if (ED.dirty && ED.hi > 0) { e.preventDefault(); e.returnValue = ''; } });
})(window);
