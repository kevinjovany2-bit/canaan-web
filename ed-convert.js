/* =====================================================================
   ed-convert.js — convierte un bloque de la tienda en una sección LIBRE:
   cada pieza pasa a ser un elemento independiente (texto, botón, imagen,
   caja) con todas las herramientas: guías, centrar, alinear, capas, 3D…
   Mide el diseño real en escritorio, tablet y móvil.
   ===================================================================== */
(function (W) {
  'use strict';
  function hex(c) {
    var m = /rgba?\(\s*(\d+)[ ,]+(\d+)[ ,]+(\d+)(?:[ ,/]+([\d.]+))?/.exec(c || ''); if (!m || (m[4] != null && +m[4] === 0)) return null;
    return '#' + [1, 2, 3].map(function (i) { return ('0' + (+m[i]).toString(16)).slice(-2); }).join('');
  }
  function tokOf(c, tema) { var h = hex(c); if (!h) return null; var ks = ['c1', 'c2', 'c3', 'bg', 'tx']; for (var i = 0; i < ks.length; i++) if ((tema[ks[i]] || '').toLowerCase() === h) return '@' + ks[i]; return h; }
  function fam(cs, tema) { var f = cs.fontFamily.split(',')[0].replace(/["']/g, '').trim(); if (f === tema.fh) return '@fh'; if (f === tema.fb) return '@fb'; return f; }

  function measure(doc, sid, dev) {
    var Wd = PG.DEV[dev].w, host = document.createElement('div'); host.style.cssText = 'position:absolute;left:-30000px;top:0;width:' + Wd + 'px;visibility:hidden';
    document.body.appendChild(host);
    var sub = JSON.parse(JSON.stringify(doc)); sub.secs = sub.secs.filter(function (s) { return s.id === sid; }); sub.els = [];
    var ctx = PG.render(sub, host, { edit: true, dev: dev }), n = ctx.sec[sid], sr = n.getBoundingClientRect(), tema = doc.tema, out = { h: Math.round(sr.height), bg: tokOf(getComputedStyle(n).backgroundColor, tema), items: [] };
    n.querySelectorAll('[data-k]').forEach(function (nd) {
      var cs = getComputedStyle(nd), b = nd.getBoundingClientRect(), vis = cs.display !== 'none' && b.width > 0 && b.height > 0, kind = nd.dataset.t, it = { k: nd.dataset.k, n: nd.dataset.n, kind: kind, vis: vis };
      it.x = Math.round(b.left - sr.left); it.y = Math.round(b.top - sr.top); it.w = Math.round(b.width); it.h = Math.round(b.height);
      if (vis || dev === 'd') {
        it.fs = Math.round(parseFloat(cs.fontSize)); it.ls = cs.letterSpacing === 'normal' ? 0 : +parseFloat(cs.letterSpacing).toFixed(1);
        if (dev === 'd') {
          it.ff = fam(cs, tema); it.fw = parseInt(cs.fontWeight, 10) || 400; it.it = cs.fontStyle === 'italic' || undefined; it.ul = /underline/.test(cs.textDecorationLine) || undefined;
          var lh = parseFloat(cs.lineHeight); it.lh = isNaN(lh) ? undefined : +(lh / it.fs).toFixed(2); it.al = cs.textAlign === 'start' ? 'left' : cs.textAlign;
          it.col = nd.classList.contains('plata') || cs.color === 'rgba(0, 0, 0, 0)' ? '@c2' : tokOf(cs.color, tema);
          it.bg = tokOf(cs.backgroundColor, tema); it.bw = parseFloat(cs.borderTopWidth) || 0; it.bc = tokOf(cs.borderTopColor, tema); it.rad = parseFloat(cs.borderTopLeftRadius) || 0;
          var tx = nd.textContent.trim(); it.tx = cs.textTransform === 'uppercase' ? tx.toUpperCase() : tx; it.tag = nd.tagName;
          var im = nd.tagName === 'IMG' ? nd : nd.querySelector('img'); if (im && im.dataset.p) it.src = im.dataset.p;
          if (nd.tagName === 'A') { it.href = nd.getAttribute('href') || ''; }
          if (nd.dataset.c) it.cat = nd.dataset.c;
          if (nd.tagName.toLowerCase() === 'svg') { var c = nd.cloneNode(true); c.setAttribute('xmlns', 'http://www.w3.org/2000/svg'); c.setAttribute('width', 64); c.setAttribute('height', 64); c.removeAttribute('data-k'); c.removeAttribute('data-n'); c.removeAttribute('data-t'); c.setAttribute('style', 'fill:none;stroke:' + (hex(cs.stroke) || '#9aa0a8') + ';stroke-width:1.5'); it.svg = c.outerHTML; }
        }
      }
      out.items.push(it);
    });
    PG.destroy(ctx); host.remove(); return out;
  }

  ED.convertSection = function (sid) {
    var s = ED.sec(sid); if (!s || s.t === 'libre') return;
    var M = { d: measure(ED.doc, sid, 'd'), t: measure(ED.doc, sid, 't'), m: measure(ED.doc, sid, 'm') }, base = M.d.items, DEVS = ['t', 'm'];
    var secs = ED.doc.secs, anchors = {}; secs.forEach(function (x) { if (x.t === 'catalogo') anchors['#novedades'] = x.id; if (x.t === 'categorias') anchors['#categorias'] = x.id; if (x.t === 'pie') anchors['#contacto'] = x.id; });
    ED.change(function (d) {
      var S = d.secs.filter(function (x) { return x.id === sid; })[0], list = [];
      base.forEach(function (b, i) {
        var kind = b.kind, e = { id: PG.uid(), sec: sid, n: b.n, z: i + 1, x: b.x, y: b.y, w: Math.max(8, b.w + (kind === 'text' || kind === 'logo' ? 4 : 0)) };
        if (kind === 'text' && b.tag === 'A') kind = 'btn';
        if (kind === 'text') { Object.assign(e, { t: 'text', tx: b.tx, ff: b.ff, fs: b.fs, fw: b.fw, col: b.col || '@tx', ls: b.ls || undefined, lh: b.lh, al: b.al, it: b.it, ul: b.ul }); }
        else if (kind === 'logo') {
          if (b.src) Object.assign(e, { t: 'img', logo: 1, src: b.src, fit: 'contain', w: b.w, h: b.h }); else Object.assign(e, { t: 'text', tx: b.tx, ff: b.ff, fs: b.fs, fw: b.fw, col: b.col || '@tx', ls: b.ls || undefined });
        }
        else if (kind === 'btn') {
          Object.assign(e, { t: 'btn', tx: b.tx, ff: b.ff, fs: b.fs, fw: b.fw, col: b.col || '@bg', ls: b.ls || undefined, bg: b.bg || 'none', bw: b.bw || undefined, bc: b.bc || undefined, rad: b.rad || undefined, w: b.w, h: b.h, ac: 'none' });
          if (b.href && b.href.indexOf('wa.me') >= 0) { e.ac = 'wa'; try { e.msg = decodeURIComponent((b.href.split('text=')[1] || '')); } catch (x) {} }
          else if (b.href && anchors[b.href]) { e.ac = 'ancla'; e.anc = anchors[b.href]; }
        }
        else if (kind === 'card') { if (b.src) Object.assign(e, { t: 'img', src: b.src, fit: 'cover', w: b.w, h: b.h }); else Object.assign(e, { t: 'box', bg: b.bg || '@c3', w: b.w, h: b.h }); }
        else if (kind === 'line') Object.assign(e, { t: 'box', bg: b.bg || '@c2', w: b.w, h: b.h });
        else if (kind === 'icon') { if (!b.svg) return; var f = new File([b.svg], 'icono-' + sid + '-' + i + '.svg', { type: 'image/svg+xml' }); Object.assign(e, { t: 'img', src: ED.addFile(f, 'images'), fit: 'contain', w: b.w, h: b.h }); }
        else return;
        if (!b.vis) e.hide = true;
        Object.keys(e).forEach(function (q) { if (e[q] === undefined || e[q] === null || e[q] === '') delete e[q]; });
        e._i = i; list.push(e);
      });
      list.forEach(function (e) {
        e.o = {}; DEVS.forEach(function (dv) {
          var m = M[dv].items[e._i], o = {}; if (!m) return;
          if (!m.vis) o.hide = true; else {
            o.hide = false; o.x = m.x; o.y = m.y; o.w = Math.max(8, m.w + (e.t === 'text' ? 4 : 0));
            if (e.t === 'img' || e.t === 'box' || e.t === 'btn') o.h = m.h; if (m.fs && (e.t === 'text' || e.t === 'btn')) o.fs = m.fs;
          } e.o[dv] = o;
        }); delete e._i;
      });
      /* sección: pasa a libre conservando fondo, imágenes y animación */
      S.t = 'libre'; S.h = M.d.h; S.o = { t: { h: M.t.h }, m: { h: M.m.h } }; delete S.py; delete S.k; delete S.ko;
      if (!S.bg || S.bg === 'none') S.bg = M.d.bg || 'none';
      d.els = d.els.concat(list);
    }, null, { full: true });
    ED.selectSec(sid); ED.toast('Listo: ahora cada pieza es un elemento libre, con guías, centrado y alineación.', 'ok');
  };

  /* centrar una pieza de bloque horizontalmente respecto a su sección */
  ED.centerPiece = function (sid, k, axis) {
    var c = ED.ctx(), n = c && c.sec[sid], nd = n && n.querySelector('[data-k="' + k + '"]'); if (!nd) return;
    var sr = n.getBoundingClientRect(), b = nd.getBoundingClientRect(), z = sr.width / n.offsetWidth || 1, p = {};
    if (axis !== 'v') p.dx = Math.round((ED.pieceVal(sid, k, 'dx') || 0) + ((sr.left + sr.width / 2) - (b.left + b.width / 2)) / z);
    if (axis === 'v') p.dy = Math.round((ED.pieceVal(sid, k, 'dy') || 0) + ((sr.top + sr.height / 2) - (b.top + b.height / 2)) / z);
    ED.setPiece(sid, k, p, 'center');
  };
})(window);
