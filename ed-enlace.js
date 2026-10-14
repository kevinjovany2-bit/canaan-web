/* =====================================================================
   ed-enlace.js — clic derecho sobre una imagen: ponerle un enlace
   (red social / página, WhatsApp o ir a una sección de la web)
   ===================================================================== */
(function (W) {
  'use strict';
  var menu = null;
  function cerrar() { if (menu) { menu.remove(); menu = null; } }
  function item(txt, fn, cls) { var b = document.createElement('button'); b.className = 'cm-i ' + (cls || ''); b.textContent = txt; b.onclick = function () { cerrar(); fn(); }; return b; }
  function actual(r) {
    if (r.ac === 'url' && r.href) return '🔗 ' + r.href;
    if (r.ac === 'wa') return '💬 WhatsApp: ' + (r.msg || 'Hola, quiero información');
    if (r.ac === 'ancla' && r.anc) { var s = ED.sec(r.anc); return '⬇ Va a: ' + ((s && (s.n || PG.BNAME[s.t])) || 'sección'); }
    return 'Sin enlace';
  }
  function abrir(id, x, y) {
    cerrar(); var el = ED.el(id); if (!el) return; var r = ED.r(el);
    menu = document.createElement('div'); menu.id = 'cmenu';
    var cur = document.createElement('div'); cur.className = 'cm-cur'; cur.textContent = actual(r); menu.appendChild(cur);
    menu.appendChild(item('🔗 Poner enlace (Instagram, Facebook, página…)', function () {
      var v = prompt('Pega el enlace al que llevará esta imagen:\n(ej. instagram.com/canaanboutique)', r.ac === 'url' && r.href ? r.href : 'https://');
      if (v == null) return; v = v.trim(); if (!v || v === 'https://') return;
      if (!/^(https?:|mailto:|tel:|#)/i.test(v)) v = 'https://' + v;
      ED.set([id], { ac: 'url', href: v }, 'ac'); ED.toast('Enlace puesto. Se activa en la web al publicar.', 'ok');
    }));
    menu.appendChild(item('💬 Abrir WhatsApp de la tienda…', function () {
      var v = prompt('Mensaje que se escribirá en WhatsApp:', r.ac === 'wa' && r.msg ? r.msg : 'Hola, quiero información');
      if (v == null) return; ED.set([id], { ac: 'wa', msg: v.trim() || undefined }, 'ac'); ED.toast('La imagen abrirá WhatsApp al publicar.', 'ok');
    }));
    var sub = document.createElement('div'); sub.className = 'cm-sub';
    var t = document.createElement('div'); t.className = 'cm-cur'; t.style.border = '0'; t.textContent = '⬇ Llevar a una sección de la web:'; sub.appendChild(t);
    ED.doc.secs.forEach(function (s) { if (s.id === el.sec) return; sub.appendChild(item(s.n || PG.BNAME[s.t] || 'Sección', function () { ED.set([id], { ac: 'ancla', anc: s.id }, 'ac'); ED.toast('La imagen bajará a "' + (s.n || PG.BNAME[s.t]) + '".', 'ok'); })); });
    menu.appendChild(sub);
    if (r.ac && r.ac !== 'none') menu.appendChild(item('✕ Quitar enlace', function () { ED.set([id], { ac: undefined, href: undefined, msg: undefined, anc: undefined }, 'ac'); }, 'del'));
    document.body.appendChild(menu);
    var w = menu.offsetWidth, h = menu.offsetHeight;
    menu.style.left = Math.max(6, Math.min(x, W.innerWidth - w - 6)) + 'px'; menu.style.top = Math.max(6, Math.min(y, W.innerHeight - h - 6)) + 'px';
  }
  document.addEventListener('contextmenu', function (e) {
    var vp = document.getElementById('vp'); if (!vp || !vp.contains(e.target) || ED.preview || ED.d3) return;
    var en = e.target.closest && e.target.closest('.el.t-img'); if (!en) return;
    e.preventDefault(); var id = en.dataset.id; if (ED.sel.indexOf(id) < 0) ED.select([id]); abrir(id, e.clientX, e.clientY);
  });
  document.addEventListener('pointerdown', function (e) { if (menu && !menu.contains(e.target)) cerrar(); }, true);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') cerrar(); });
  W.addEventListener('blur', cerrar);
})(window);
