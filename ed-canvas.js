/* =====================================================================
   ed-canvas.js — lienzo: render, selección, mover, redimensionar, rotar,
   guías, grid, zoom/pan, edición de texto en sitio, vista previa y 3D.
   ===================================================================== */
(function (W) {
  'use strict';
  var $ = function (i) { return document.getElementById(i); };
  var vp = $('vp'), world = $('world'), frame = $('frame'), page = $('pagina'), ovl = $('ovl'), dyn = document.createElement('div'), gridl = document.createElement('div');
  dyn.className = 'dyn'; gridl.className = 'gridl'; ovl.appendChild(gridl); ovl.appendChild(dyn);
  var ctx = null, Z = .6, PX = 60, PY = 30, space = false, hand = false, editing = null, guides = [], oq = 0, rot = { x: 28, y: -22 }, tagTxt = '';
  ED.ctx = function () { return ctx; };
  ED.setGuides = function (g) { guides = g; overlay(); }; ED.zoomLevel = function () { return Z; };

  /* ---------- vista (zoom / pan) ---------- */
  function applyView() {
    world.style.transform = 'translate(' + PX + 'px,' + PY + 'px) scale(' + Z + ')'; world.style.setProperty('--iz', 1 / Z);
    var zv = $('zoomv'); if (zv) zv.textContent = Math.round(Z * 100) + '%';
  }
  function zoomAt(cx, cy, nz) {
    nz = Math.max(.1, Math.min(4, nz)); var r = vp.getBoundingClientRect(), px = cx - r.left, py = cy - r.top;
    PX = px - (px - PX) * (nz / Z); PY = py - (py - PY) * (nz / Z); Z = nz; applyView();
  }
  ED.zoomBy = function (f) { var r = vp.getBoundingClientRect(); zoomAt(r.left + r.width / 2, r.top + r.height / 2, Z * f); };
  ED.zoomSet = function (z) { var r = vp.getBoundingClientRect(); zoomAt(r.left + r.width / 2, r.top + r.height / 2, z); };
  ED.fit = function () { var w = PG.DEV[ED.dev].w, r = vp.getBoundingClientRect(); Z = Math.max(.1, Math.min(1, (r.width - 80) / w)); PX = (r.width - w * Z) / 2; PY = 24; applyView(); };
  ED.viewCenter = function () { var r = vp.getBoundingClientRect(); return locate((r.width / 2 - PX) / Z, (r.height / 2 - PY) / Z); };
  ED.panTo = function (y) { PY = 24 - y * Z; applyView(); };

  /* ---------- render ---------- */
  function renderAll() {
    if (ctx) PG.destroy(ctx); editing = null;
    frame.style.width = PG.DEV[ED.dev].w + 'px';
    ctx = PG.render(ED.doc, page, { edit: !ED.preview, dev: ED.dev, d3: ED.d3 });
    frame.classList.toggle('d3', ED.d3); world.style.perspective = ED.d3 ? '2600px' : ''; applyRot(); overlay();
  }
  ED.render = renderAll;
  function applyRot() { frame.style.transform = ED.d3 ? 'rotateX(' + rot.x + 'deg) rotateY(' + rot.y + 'deg)' : ''; }
  function paintOne(id) { var e = ED.el(id); if (e && ctx && ctx.el[id] && editing !== id) PG.paintEl(ctx, e); }
  ED.on('change', function (o) {
    o = o || {};
    if (o.theme && ctx) { PG.applyTheme(page, ED.doc.tema); PG.ensureFonts(ED.doc); overlay(); return; }
    if (o.full || !ctx) renderAll();
    else { (o.paint || []).forEach(paintOne); (o.secs || []).forEach(function (s) { var S = ED.sec(s); if (S) PG.paintSec(ctx, S); }); overlay(); }
  });
  ED.on('live', function (ids) { ids.forEach(paintOne); overlay(); });
  ED.on('sel', function () { overlay(); });
  ED.on('scrollto', function (sid) { setTimeout(function () { var n = ctx && ctx.sec[sid]; if (n) ED.panTo(n.offsetTop); }, 30); });
  ED.setDev = function (d) { ED.dev = d; renderAll(); ED.fit(); ED.emit('dev'); ED.emit('sel'); };
  ED.setPreview = function (v) { ED.preview = v; if (v) { ED.d3 = false; editing = null; } renderAll(); ED.emit('mode'); };
  ED.setD3 = function (v) {
    ED.d3 = v; if (v) ED.preview = false; renderAll(); ED.emit('mode');
    if (v) { var r = vp.getBoundingClientRect(), w = PG.DEV[ED.dev].w; Z = Math.max(.15, Math.min(.6, (r.width - 220) / w)); PX = (r.width - w * Z) / 2; PY = 40; applyView(); } else ED.fit();
  };
  ED.adaptSec = function (sid) { ED.change(function (d) { PG.adapt(d, sid, ED.dev); }, null, { full: true }); };

  /* ---------- geometría de páginas ---------- */
  function secOff(sid) {
    var n = ctx && ctx.sec[sid]; if (!n) return null; var sw = n.querySelector('.swrap'), st = n.querySelector('.stage');
    return { x: n.offsetLeft + (sw ? sw.offsetLeft : 0) + (st ? st.offsetLeft : 0), y: n.offsetTop + (sw ? sw.offsetTop : 0) + (st ? st.offsetTop : 0) };
  }
  function locate(px, py) { /* coordenada de página → sección libre + x,y locales */
    if (!ctx) return {}; var best = null;
    ED.doc.secs.forEach(function (s) { if (s.t !== 'libre' || !PG.adapted(s, ED.dev)) return; var n = ctx.sec[s.id]; if (!n) return; var top = n.offsetTop, h = n.offsetHeight;
      var d = py < top ? top - py : py > top + h ? py - top - h : 0; if (!best || d < best.d) best = { d: d, s: s }; });
    if (!best) return {}; var o = secOff(best.s.id); return { sid: best.s.id, x: px - o.x, y: py - o.y };
  }
  function toPage(e) { var r = vp.getBoundingClientRect(); return { x: (e.clientX - r.left - PX) / Z, y: (e.clientY - r.top - PY) / Z }; }

  /* ---------- overlay ---------- */
  function overlay() { if (!oq) oq = requestAnimationFrame(function () { oq = 0; drawOverlay(); }); }
  W.document.fonts && W.document.fonts.addEventListener && W.document.fonts.addEventListener('loadingdone', overlay);
  var HDL = { nw: [0, 0], n: [50, 0], ne: [100, 0], e: [100, 50], se: [100, 100], s: [50, 100], sw: [0, 100], w: [0, 50] };
  function mkFrame(cx, cy, w, h, r, cls) {
    var f = document.createElement('div'); f.className = 'sf ' + (cls || ''); f.style.cssText = 'left:' + (cx - w / 2) + 'px;top:' + (cy - h / 2) + 'px;width:' + w + 'px;height:' + h + 'px;transform:rotate(' + (r || 0) + 'deg)'; return f;
  }
  function addHandles(f, rotate) {
    Object.keys(HDL).forEach(function (k) { var i = document.createElement('i'); i.className = 'hd h-' + k; i.dataset.h = k; i.style.left = HDL[k][0] + '%'; i.style.top = HDL[k][1] + '%'; f.appendChild(i); });
    if (rotate) { var r = document.createElement('i'); r.className = 'hd h-rot'; r.dataset.h = 'rot'; f.appendChild(r); }
  }
  function elBox(el) {
    var n = ctx.el[el.id], o = secOff(el.sec); if (!n || !o) return null; var r = ED.r(el), sc = r.sc || 1, w = n.offsetWidth, h = n.offsetHeight;
    return { cx: o.x + (r.x || 0) + w / 2, cy: o.y + (r.y || 0) + h / 2, w: w * sc, h: h * sc, r: r.r || 0, x: o.x + (r.x || 0), y: o.y + (r.y || 0), bw: w, bh: h };
  }
  function drawOverlay() {
    dyn.innerHTML = ''; gridl.style.display = 'none'; if (!ctx || ED.preview || ED.d3) return;
    if (ED.grid) { var G = ED.gridSize || 20; gridl.style.cssText = 'display:block;width:' + frame.offsetWidth + 'px;height:' + page.offsetHeight + 'px;background-size:' + G + 'px ' + G + 'px'; }
    if (ED.pc && ctx.sec[ED.pc.sid]) {
      var pr = page.getBoundingClientRect(), nodes = ctx.sec[ED.pc.sid].querySelectorAll('[data-k="' + ED.pc.k + '"]');
      nodes.forEach(function (nd, i) {
        var b = nd.getBoundingClientRect(); if (!b.width && !b.height) return; var w = b.width / Z, hh = b.height / Z, ox = 0, oy = 0;
        var rect = /^(text|btn|card)$/.test(nd.dataset.t || '');
        if (rect) { var g = function (k) { return ED.pieceVal(ED.pc.sid, ED.pc.k, k) || 0; }; ox = g('xr') - g('xl'); oy = g('xb') - g('xt'); w += g('xl') + g('xr'); hh += g('xt') + g('xb'); }
        var f = mkFrame((b.left - pr.left) / Z + w / 2 - (rect ? (ED.pieceVal(ED.pc.sid, ED.pc.k, 'xl') || 0) : 0), (b.top - pr.top) / Z + hh / 2 - (rect ? (ED.pieceVal(ED.pc.sid, ED.pc.k, 'xt') || 0) : 0), w, hh, 0, 'one pc');
        if (rect && i === 0) [['t', 50, 0, 'n'], ['b', 50, 100, 's'], ['l', 0, 50, 'w'], ['r', 100, 50, 'e']].forEach(function (q) { var x = document.createElement('i'); x.className = 'hd h-' + q[3]; x.dataset.h = 'rx-' + q[0]; x.style.left = q[1] + '%'; x.style.top = q[2] + '%'; x.title = 'Arrastra para mover este borde'; f.appendChild(x); });
        if (i === 0 && nodes.length === 1) { var hd = document.createElement('i'); hd.className = 'hd h-se'; hd.dataset.h = 'psc'; hd.style.left = '100%'; hd.style.top = '100%'; f.appendChild(hd); }
        if (i === 0) { var t = document.createElement('span'); t.className = 'tag'; t.textContent = tagTxt || ((nd.dataset.n || 'Pieza') + (nodes.length > 1 ? ' · ×' + nodes.length : '')); f.appendChild(t); }
        dyn.appendChild(f);
      });
      return;
    }
    var els = ED.selEls().filter(function (e) { return ctx.el[e.id]; });
    if (!els.length && ED.secSel && ctx.sec[ED.secSel]) { var sn = ctx.sec[ED.secSel]; dyn.appendChild(mkFrame(sn.offsetLeft + sn.offsetWidth / 2, sn.offsetTop + sn.offsetHeight / 2, sn.offsetWidth, sn.offsetHeight, 0, 'sec')); }
    els.forEach(function (e) {
      var b = elBox(e); if (!b) return; var f = mkFrame(b.cx, b.cy, b.w, b.h, b.r, els.length > 1 ? 'multi' : 'one' + (e.lock ? ' lk' : '')); dyn.appendChild(f);
      if (els.length === 1 && !e.lock) { addHandles(f, true); }
      if (els.length === 1) { var t = document.createElement('span'); t.className = 'tag'; t.textContent = tagTxt || (Math.round(b.bw) + ' × ' + Math.round(b.bh) + (e.lock ? ' 🔒' : '')); f.appendChild(t); }
    });
    if (els.length > 1) {
      var bs = els.map(elBox).filter(Boolean), x0 = Math.min.apply(null, bs.map(function (b) { return b.x; })), y0 = Math.min.apply(null, bs.map(function (b) { return b.y; })), x1 = Math.max.apply(null, bs.map(function (b) { return b.x + b.bw; })), y1 = Math.max.apply(null, bs.map(function (b) { return b.y + b.bh; }));
      var u = mkFrame((x0 + x1) / 2, (y0 + y1) / 2, x1 - x0, y1 - y0, 0, 'union'); if (!els.some(function (e) { return e.lock; })) addHandles(u, false); dyn.appendChild(u);
    }
    guides.forEach(function (g) { var d = document.createElement('div'); d.className = 'guide ' + g.k; if (g.k === 'v') d.style.cssText = 'left:' + g.v + 'px;top:' + g.a + 'px;height:' + (g.b - g.a) + 'px'; else d.style.cssText = 'top:' + g.v + 'px;left:' + g.a + 'px;width:' + (g.b - g.a) + 'px'; dyn.appendChild(d); });
    if (marq) { var m = document.createElement('div'); m.className = 'mq'; m.style.cssText = 'left:' + marq.x + 'px;top:' + marq.y + 'px;width:' + marq.w + 'px;height:' + marq.h + 'px'; dyn.appendChild(m); }
  }
  var marq = null;

  /* ---------- guías / imanes ---------- */
  function targets(sid, skip) {
    var W_ = ED.secW(sid), H_ = ED.secH(sid), xs = [0, W_ / 2, W_], ys = [0, H_ / 2, H_];
    ED.doc.els.forEach(function (e) { if (e.sec !== sid || skip.indexOf(e.id) >= 0 || ED.r(e).hide) return; var g = ED.geom(e); xs.push(g.x, g.x + g.w / 2, g.x + g.w); ys.push(g.y, g.y + g.h / 2, g.y + g.h); });
    return { xs: xs, ys: ys, sid: sid };
  }
  function snapBox(b, tg) {
    var out = { dx: 0, dy: 0 }; guides = []; if (!ED.snap) return out; var thr = 6 / Z, cx = [b.x, b.x + b.w / 2, b.x + b.w], cy = [b.y, b.y + b.h / 2, b.y + b.h], bx = null, by = null;
    tg.xs.forEach(function (t) { cx.forEach(function (c) { var d = t - c; if (Math.abs(d) < thr && (!bx || Math.abs(d) < Math.abs(bx.d))) bx = { d: d, t: t }; }); });
    tg.ys.forEach(function (t) { cy.forEach(function (c) { var d = t - c; if (Math.abs(d) < thr && (!by || Math.abs(d) < Math.abs(by.d))) by = { d: d, t: t }; }); });
    if (ED.grid) { var G = ED.gridSize || 20; if (!bx) { var gx = Math.round(b.x / G) * G - b.x; if (Math.abs(gx) < thr) bx = { d: gx, t: null }; } if (!by) { var gy = Math.round(b.y / G) * G - b.y; if (Math.abs(gy) < thr) by = { d: gy, t: null }; } }
    var o = secOff(tg.sid) || { x: 0, y: 0 };
    if (bx) { out.dx = bx.d; if (bx.t != null) guides.push({ k: 'v', v: o.x + bx.t, a: o.y, b: o.y + ED.secH(tg.sid) }); }
    if (by) { out.dy = by.d; if (by.t != null) guides.push({ k: 'h', v: o.y + by.t, a: o.x, b: o.x + ED.secW(tg.sid) }); }
    return out;
  }
  function snapVal(v, ts) { if (!ED.snap) return v; var thr = 6 / Z, best = null; ts.forEach(function (t) { if (Math.abs(t - v) < thr && (best === null || Math.abs(t - v) < Math.abs(best - v))) best = t; }); return best === null ? v : best; }

  /* ---------- mover un borde del rectángulo de la prenda (sin tocar lo de adentro) ---------- */
  function startRectSide(e, side) {
    var pc = ED.pc; if (!pc) return; var key = 'x' + side, v0 = ED.pieceVal(pc.sid, pc.k, key) || 0, x0 = e.clientX, y0 = e.clientY;
    drag(function (ev) {
      var dx = (ev.clientX - x0) / Z, dy = (ev.clientY - y0) / Z, v = side === 't' ? v0 - dy : side === 'b' ? v0 + dy : side === 'l' ? v0 - dx : v0 + dx, p = {};
      p[key] = Math.round(Math.max(-400, Math.min(400, v))); ED.livePiece(pc.sid, pc.k, p); tagTxt = (side === 't' ? 'Arriba ' : side === 'b' ? 'Abajo ' : side === 'l' ? 'Izquierda ' : 'Derecha ') + p[key] + ' px'; overlay();
    }, function () { tagTxt = ''; ED.commit('rx' + side); ED.emit('sel'); });
  }

  /* ---------- listeners de ventana temporales ---------- */
  function drag(onMove, onUp) {
    function mv(e) { onMove(e); } function up(e) { W.removeEventListener('pointermove', mv); W.removeEventListener('pointerup', up); W.removeEventListener('pointercancel', up); onUp(e); }
    W.addEventListener('pointermove', mv); W.addEventListener('pointerup', up); W.addEventListener('pointercancel', up);
  }

  /* ---------- pointerdown ---------- */
  vp.addEventListener('pointerdown', function (e) {
    if (ED.preview) return;
    if (editing) { var en0 = e.target.closest && e.target.closest('.el'); if (en0 && en0.dataset.id === editing) return; endEdit(); }
    if (e.button === 1 || (e.button === 0 && (space || hand))) { e.preventDefault(); return startPan(e); }
    if (e.button !== 0) return;
    if (ED.d3) return startOrbit(e);
    var t = e.target, h = t.dataset && t.dataset.h;
    if (h === 'psc') { e.preventDefault(); return startPieceScale(e); }
    if (h && h.indexOf('rx-') === 0) { e.preventDefault(); return startRectSide(e, h.slice(3)); }
    if (h) { e.preventDefault(); return startHandle(e, h); }
    if (t.closest('[data-adapt]')) return;
    var cap = t.closest && t.closest('.prod.capas'); if (cap && ED.abrirTarjeta) { e.preventDefault(); ED.abrirTarjeta(); return; }
    var pk = t.closest('[data-k]');
    if (pk && ctx.sec[pk.closest('section.sec').dataset.sid] && !pk.closest('section.sec.libre')) {
      var ps = pk.closest('section.sec').dataset.sid, psec = ED.sec(ps); if (psec && psec.lock) { ED.selectSec(ps); return; }
      if (!(ED.pc && ED.pc.sid === ps && ED.pc.k === pk.dataset.k)) ED.selectPiece(ps, pk.dataset.k);
      return startPieceMove(e);
    }
    var en = t.closest('.el');
    if (en) {
      var id = en.dataset.id, el = ED.el(id); if (!el) return; var sc = ED.sec(el.sec);
      if (sc && sc.lock) { ED.selectSec(sc.id); return; }
      var ids = e.altKey ? [id] : ED.members(id);
      if (e.shiftKey) { ED.select(ids, true); return; }
      if (ED.sel.indexOf(id) < 0) ED.select(ids);
      if (!el.lock) startMove(e, id); return;
    }
    var sn = t.closest('section.sec');
    if (sn) { var s = ED.sec(sn.dataset.sid); if (s && s.t === 'libre' && PG.adapted(s, ED.dev) && !s.lock) startMarquee(e, s.id); else ED.selectSec(sn.dataset.sid); return; }
    ED.deselect();
  });
  function startPieceMove(e) { startPieceMoveImpl(e); }
  function startPieceScale(e) { startPieceScaleImpl(e); }
  function startPan(e) { var sx = e.clientX, sy = e.clientY, px = PX, py = PY; vp.classList.add('panning'); drag(function (ev) { PX = px + ev.clientX - sx; PY = py + ev.clientY - sy; applyView(); }, function () { vp.classList.remove('panning'); }); }
  function startOrbit(e) { var sx = e.clientX, sy = e.clientY, r0 = { x: rot.x, y: rot.y }; drag(function (ev) { rot.y = r0.y + (ev.clientX - sx) * .4; rot.x = Math.max(0, Math.min(80, r0.x - (ev.clientY - sy) * .4)); applyRot(); }, function () {}); }

  /* ---------- mover ---------- */
  function startMove(e, clickedId) {
    var ids = ED.sel.filter(function (i) { var x = ED.el(i); return x && !x.lock; }); if (!ids.length) return;
    var sx = e.clientX, sy = e.clientY, moved = false, o, sid, B, tg, alt = e.altKey, newSid = null;
    function orig() { sid = ED.el(ids[0]).sec; o = ids.map(function (i) { var g = ED.geom(ED.el(i)); return { id: i, x: g.x, y: g.y, w: g.w, h: g.h }; });
      B = { x: Math.min.apply(null, o.map(function (q) { return q.x; })), y: Math.min.apply(null, o.map(function (q) { return q.y; })) };
      B.w = Math.max.apply(null, o.map(function (q) { return q.x + q.w; })) - B.x; B.h = Math.max.apply(null, o.map(function (q) { return q.y + q.h; })) - B.y; }
    orig();
    drag(function (ev) {
      var dx = (ev.clientX - sx) / Z, dy = (ev.clientY - sy) / Z;
      if (!moved) { if (Math.hypot(dx, dy) * Z < 3) return; moved = true; if (alt) { ED.duplicate(0); ids = ED.sel.slice(); orig(); } tg = targets(sid, ids); }
      if (ev.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0; }
      var s = snapBox({ x: B.x + dx, y: B.y + dy, w: B.w, h: B.h }, tg); dx += s.dx; dy += s.dy;
      var m = {}; o.forEach(function (q) { m[q.id] = { x: Math.round(q.x + dx), y: Math.round(q.y + dy) }; }); ED.live(m);
      newSid = null; if (ED.dev === 'd') { var p = toPage(ev), L = locate(p.x, p.y); if (L.sid && L.sid !== sid) newSid = L.sid; }
    }, function (ev) {
      guides = [];
      if (!moved) { if (ED.sel.length > 1 && !ev.shiftKey) ED.select(ED.members(clickedId)); overlay(); return; }
      if (newSid) {
        var oo = secOff(sid), no = secOff(newSid);
        ED.change(function (d) { ids.forEach(function (i) { var e2 = d.els.filter(function (z) { return z.id === i; })[0]; if (!e2) return; var g = o.filter(function (q) { return q.id === i; })[0], cur = ED.geom(e2);
          e2.x = Math.round(cur.x + oo.x - no.x); e2.y = Math.round(cur.y + oo.y - no.y); e2.sec = newSid; e2.z = ED.nextZ(newSid); }); }, 'move', { full: true });
      } else { ED.commit('move'); overlay(); }
    });
  }

  /* ---------- redimensionar ---------- */
  function startHandle(e, h) {
    var els = ED.selEls(); if (!els.length) return; if (h === 'rot') return startRot(e, els[0]);
    if (els.some(function (x) { return x.lock; })) return;
    if (els.length > 1) return startGroupResize(e, h, els);
    var el = els[0], r0 = ED.r(el), g = ED.geom(el), sc = r0.sc || 1, a = (r0.r || 0) * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a), hx = HDL[h][0] === 100 ? 1 : HDL[h][0] === 0 ? -1 : 0, hy = HDL[h][1] === 100 ? 1 : HDL[h][1] === 0 ? -1 : 0;
    var cx = g.x + g.w / 2, cy = g.y + g.h / 2, sx = e.clientX, sy = e.clientY, tg = targets(el.sec, [el.id]), auto = typeof r0.h !== 'number', vw = g.w * sc, vh = g.h * sc;
    drag(function (ev) {
      var dxw = (ev.clientX - sx) / Z, dyw = (ev.clientY - sy) / Z, dx = dxw * ca + dyw * sa, dy = -dxw * sa + dyw * ca;
      var nvw = Math.max(8, vw + hx * dx), nvh = Math.max(8, vh + hy * dy);
      if (!a && ED.snap) { /* imán de bordes */
        if (hx === 1) nvw = snapVal(g.x + nvw / sc, tg.xs) * sc - g.x * sc; else if (hx === -1) nvw = vw + (g.x * sc - snapVal(g.x + (vw - nvw) / sc, tg.xs) * sc) ;
        if (hy === 1) nvh = snapVal(g.y + nvh / sc, tg.ys) * sc - g.y * sc; else if (hy === -1) nvh = vh + (g.y * sc - snapVal(g.y + (vh - nvh) / sc, tg.ys) * sc);
        nvw = Math.max(8, nvw); nvh = Math.max(8, nvh);
      }
      if ((ev.shiftKey || (hx && hy && el.t === 'img' && ED.ar === 'lock')) && hx && hy) { var k = Math.max(nvw / vw, nvh / vh); nvw = vw * k; nvh = vh * k; }
      else if (ev.shiftKey && (hx === 0 || hy === 0)) { if (hx === 0) nvw = vw * nvh / vh; else nvh = vh * nvw / vw; }
      var lcx = hx * (nvw - vw) / 2, lcy = hy * (nvh - vh) / 2, wcx = cx + lcx * ca - lcy * sa, wcy = cy + lcx * sa + lcy * ca, nw = nvw / sc, nh = nvh / sc;
      var m = { x: Math.round(wcx - nw / 2), y: Math.round(wcy - nh / 2), w: Math.round(nw) }; if (hy !== 0 || !auto) m.h = Math.round(nh); if (hy === 0 && auto) m.h = r0.h == null ? undefined : r0.h;
      tagTxt = Math.round(nw) + ' × ' + Math.round(nh); var mm = {}; mm[el.id] = m; ED.live(mm);
    }, function () { tagTxt = ''; guides = []; ED.commit('resize'); overlay(); });
  }
  function startGroupResize(e, h, els) {
    var G = els.map(function (x) { var g = ED.geom(x); return { id: x.id, el: x, x: g.x, y: g.y, w: g.w, h: g.h, auto: typeof ED.r(x).h !== 'number', fs: ED.r(x).fs, ls: ED.r(x).ls }; });
    var B = { x: Math.min.apply(null, G.map(function (q) { return q.x; })), y: Math.min.apply(null, G.map(function (q) { return q.y; })) };
    B.w = Math.max.apply(null, G.map(function (q) { return q.x + q.w; })) - B.x; B.h = Math.max.apply(null, G.map(function (q) { return q.y + q.h; })) - B.y;
    var hx = HDL[h][0] === 100 ? 1 : HDL[h][0] === 0 ? -1 : 0, hy = HDL[h][1] === 100 ? 1 : HDL[h][1] === 0 ? -1 : 0, ax = hx === 1 ? B.x : hx === -1 ? B.x + B.w : B.x, ay = hy === 1 ? B.y : hy === -1 ? B.y + B.h : B.y, sx0 = e.clientX, sy0 = e.clientY;
    drag(function (ev) {
      var dx = (ev.clientX - sx0) / Z, dy = (ev.clientY - sy0) / Z, sx = hx ? Math.max(.05, (B.w + hx * dx) / B.w) : 1, sy = hy ? Math.max(.05, (B.h + hy * dy) / B.h) : 1;
      if (hx && hy) { var k = Math.max(sx, sy); sx = sy = k; }
      var m = {}; G.forEach(function (q) { var p = { x: Math.round(ax + (q.x - ax) * sx), y: Math.round(ay + (q.y - ay) * sy), w: Math.round(q.w * sx) }; if (!q.auto) p.h = Math.round(q.h * sy);
        if (q.fs) p.fs = Math.max(6, Math.round(q.fs * (hx && hy ? sx : (hx ? sx : sy)))); m[q.id] = p; }); ED.live(m);
    }, function () { ED.commit('resize'); overlay(); });
  }
  function startRot(e, el) {
    if (el.lock) return; var n = ctx.el[el.id], rc = n.getBoundingClientRect(), cx = rc.left + rc.width / 2, cy = rc.top + rc.height / 2;
    drag(function (ev) { var a = Math.atan2(ev.clientY - cy, ev.clientX - cx) * 180 / Math.PI + 90; if (ev.shiftKey) a = Math.round(a / 15) * 15; a = Math.round(a); if (a > 180) a -= 360; if (a <= -180) a += 360;
      tagTxt = a + '°'; var m = {}; m[el.id] = { r: a }; ED.live(m); }, function () { tagTxt = ''; ED.commit('rot'); overlay(); });
  }

  /* ---------- selección por marco ---------- */
  function startMarquee(e, sid) {
    var p0 = toPage(e), add = e.shiftKey, o = secOff(sid), moved = false;
    drag(function (ev) {
      var p = toPage(ev); if (!moved && Math.hypot(p.x - p0.x, p.y - p0.y) * Z < 4) return; moved = true;
      marq = { x: Math.min(p.x, p0.x), y: Math.min(p.y, p0.y), w: Math.abs(p.x - p0.x), h: Math.abs(p.y - p0.y) }; overlay();
    }, function () {
      var m = marq; marq = null;
      if (!moved) { ED.selectSec(sid); return; }
      var ids = ED.doc.els.filter(function (x) { if (x.sec !== sid || x.lock) return false; var g = ED.geom(x), gx = o.x + g.x, gy = o.y + g.y; return gx < m.x + m.w && gx + g.w > m.x && gy < m.y + m.h && gy + g.h > m.y; }).map(function (x) { return x.id; });
      ED.select(ED.expand(ids), add && ids.length); if (!ids.length) ED.selectSec(sid);
    });
  }

  /* ---------- edición de texto en el sitio ---------- */
  function startEdit(id) {
    var n = ctx.el[id]; if (!n) return; ED.select([id]); var inn = n.firstChild; editing = id;
    inn.contentEditable = 'plaintext-only'; if (inn.contentEditable !== 'plaintext-only') inn.contentEditable = 'true';
    inn.style.pointerEvents = 'auto'; inn.style.cursor = 'text'; inn.style.outline = 'none'; inn.focus();
    var rg = document.createRange(); rg.selectNodeContents(inn); var s = W.getSelection(); s.removeAllRanges(); s.addRange(rg);
    inn.onblur = endEdit; inn.onkeydown = function (ev) { if (ev.key === 'Escape') { ev.preventDefault(); inn.blur(); } ev.stopPropagation(); };
  }
  function endEdit() {
    if (!editing) return; var id = editing; editing = null; var n = ctx.el[id]; if (!n) return; var inn = n.firstChild;
    inn.onblur = null; inn.onkeydown = null; var v = inn.textContent; inn.removeAttribute('contenteditable'); inn.style.pointerEvents = ''; inn.style.cursor = ''; inn.style.outline = '';
    if (v !== (ED.r(ED.el(id)).tx || '')) ED.set([id], { tx: v }, 'tx'); else overlay();
  }
  ED.startEdit = startEdit;
  vp.addEventListener('dblclick', function (e) {
    if (ED.preview || ED.d3) return; var en = e.target.closest('.el'); if (!en) return; var el = ED.el(en.dataset.id); if (!el || el.lock) return;
    if (el.t === 'text' || el.t === 'btn') startEdit(el.id); else if (el.t === 'img') ED.pickImage([el.id]);
  });
  page.addEventListener('click', function (e) {
    var b = e.target.closest('[data-adapt]'); if (b) { ED.adaptSec(b.dataset.adapt); return; }
    if (!ED.preview) return; var a = e.target.closest('a[href^="#"]');
    if (a) { e.preventDefault(); var id = a.getAttribute('href').slice(1), t = id && page.querySelector('#' + CSS.escape(id)); if (t) { var sec = t.closest('section') || t; PY = 24 - sec.offsetTop * Z; applyView(); } }
  });
  vp.addEventListener('scroll', function () { vp.scrollTop = 0; vp.scrollLeft = 0; });

  /* ---------- rueda / zoom ---------- */
  vp.addEventListener('wheel', function (e) {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) zoomAt(e.clientX, e.clientY, Z * Math.exp(-e.deltaY * .0015));
    else { PX -= e.shiftKey ? e.deltaY : e.deltaX; PY -= e.shiftKey ? 0 : e.deltaY; applyView(); }
  }, { passive: false });

  /* ---------- imágenes: elegir / soltar ---------- */
  function readSize(file, cb) { var u = URL.createObjectURL(file), im = new Image(); im.onload = function () { cb(im.naturalWidth, im.naturalHeight); URL.revokeObjectURL(u); }; im.onerror = function () { cb(300, 300); }; im.src = u; }
  ED.pickImage = function (ids, opt) {
    var i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*'; i.onchange = function () {
      var f = i.files[0]; if (!f) return; var p = ED.addFile(f, 'images');
      if (opt && opt.cb) return opt.cb(p, f);
      ED.set(ids, { src: p }); };
    i.click();
  };
  ED.addImageFile = function (file, at, type) {
    var p = ED.addFile(file, 'images'); readSize(file, function (nw, nh) { var w = Math.min(420, nw), h = Math.round(w * nh / nw); ED.addEl(type || 'img', { src: p, w: w, h: h }, at); });
  };
  vp.addEventListener('dragover', function (e) { e.preventDefault(); });
  vp.addEventListener('drop', function (e) {
    e.preventDefault(); if (ED.preview) return; var p = toPage(e), L = locate(p.x, p.y);
    Array.prototype.forEach.call(e.dataTransfer.files, function (f) {
      if (/^image\//.test(f.type)) ED.addImageFile(f, L); else if (/\.(ttf|otf|woff2?)$/i.test(f.name)) ED.addFont(f);
    });
  });

  /* ---------- teclado ---------- */
  function typing(t) { return t.isContentEditable || (t.tagName === 'TEXTAREA') || t.tagName === 'SELECT' || (t.tagName === 'INPUT' && !/^(range|checkbox|button|color|radio)$/.test(t.type)); }
  document.addEventListener('keydown', function (e) {
    if ($('login') && $('login').style.display !== 'none') return;
    var t = e.target, k = e.key, mod = e.ctrlKey || e.metaKey;
    if (typing(t)) { if (k === 'Escape') t.blur(); return; }
    if (k === ' ') { if (!space) { space = true; vp.classList.add('hand'); } e.preventDefault(); return; }
    if (mod && k.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? ED.redo() : ED.undo(); return; }
    if (mod && k.toLowerCase() === 'y') { e.preventDefault(); ED.redo(); return; }
    if (mod && k.toLowerCase() === 's') { e.preventDefault(); ED.save && ED.save(); return; }
    if (ED.preview) { if (k === 'Escape') ED.setPreview(false); return; }
    if (mod && k.toLowerCase() === 'c') { if (ED.copy()) e.preventDefault(); return; }
    if (mod && k.toLowerCase() === 'x') { e.preventDefault(); ED.cut(); return; }
    if (mod && k.toLowerCase() === 'v') { e.preventDefault(); ED.paste(); return; }
    if (mod && k.toLowerCase() === 'd') { e.preventDefault(); ED.duplicate(); return; }
    if (mod && k.toLowerCase() === 'g') { e.preventDefault(); e.shiftKey ? ED.ungroup() : ED.group(); return; }
    if (mod && k.toLowerCase() === 'a') { e.preventDefault(); var s = ED.targetSec(); if (s) ED.select(ED.doc.els.filter(function (x) { return x.sec === s && !x.lock; }).map(function (x) { return x.id; })); return; }
    if (mod && k === ']') { e.preventDefault(); e.shiftKey ? ED.front() : ED.forward(); return; }
    if (mod && k === '[') { e.preventDefault(); e.shiftKey ? ED.back() : ED.backward(); return; }
    if (mod && (k === '+' || k === '=')) { e.preventDefault(); ED.zoomBy(1.2); return; }
    if (mod && k === '-') { e.preventDefault(); ED.zoomBy(1 / 1.2); return; }
    if (mod && k === '0') { e.preventDefault(); ED.fit(); return; }
    if (k === 'Delete' || k === 'Backspace') { if (ED.sel.length) { e.preventDefault(); ED.remove(ED.sel.filter(function (i) { return !ED.el(i).lock; })); } return; }
    if (k === 'Escape') { ED.deselect(); return; }
    if (k === 'Enter' && ED.sel.length === 1) { var el = ED.el(ED.sel[0]); if (el && (el.t === 'text' || el.t === 'btn') && !el.lock) { e.preventDefault(); startEdit(el.id); } return; }
    if (k.indexOf('Arrow') === 0 && ED.sel.length) {
      e.preventDefault(); var st = e.shiftKey ? 10 : 1, dx = k === 'ArrowLeft' ? -st : k === 'ArrowRight' ? st : 0, dy = k === 'ArrowUp' ? -st : k === 'ArrowDown' ? st : 0, m = {};
      ED.selEls().forEach(function (x) { if (x.lock) return; var g = ED.geom(x); m[x.id] = { x: g.x + dx, y: g.y + dy }; }); ED.patch(m, 'nudge');
    }
  });
  document.addEventListener('keyup', function (e) { if (e.key === ' ') { space = false; vp.classList.remove('hand'); } });
  ED.setHand = function (v) { hand = v; vp.classList.toggle('hand', v); };
  W.addEventListener('resize', function () { overlay(); });
  applyView();
})(window);

/* ---------- piezas de bloques: mover / escalar / editar texto ---------- */
(function (W) {
  'use strict';
  var vp = document.getElementById('vp'), page = document.getElementById('pagina');
  function zoom() { var m = /scale\(([\d.]+)\)/.exec(document.getElementById('world').style.transform); return m ? +m[1] : 1; }
  ED.startPieceDrag = null;
  /* geometría (coordenadas de página) de la pieza y de sus objetivos de imán */
  function rel(b, pr, Z) { return { x: (b.left - pr.left) / Z, y: (b.top - pr.top) / Z, w: b.width / Z, h: b.height / Z }; }
  function pieceTargets(pc, Z) {
    var pr = page.getBoundingClientRect(), sn = ED.ctx().sec[pc.sid], s = rel(sn.getBoundingClientRect(), pr, Z), xs = [s.x, s.x + s.w / 2, s.x + s.w], ys = [s.y, s.y + s.h / 2, s.y + s.h], seen = {};
    sn.querySelectorAll('[data-k]').forEach(function (n) { var k = n.dataset.k; if (k === pc.k || seen[k]) return; seen[k] = 1; var g = rel(n.getBoundingClientRect(), pr, Z); xs.push(g.x, g.x + g.w / 2, g.x + g.w); ys.push(g.y, g.y + g.h / 2, g.y + g.h); });
    return { xs: xs, ys: ys, s: s };
  }
  W.startPieceMoveImpl = function (e) {
    var pc = ED.pc; if (!pc) return; var Z = zoom(), sx = e.clientX, sy = e.clientY, x0 = ED.pieceVal(pc.sid, pc.k, 'dx') || 0, y0 = ED.pieceVal(pc.sid, pc.k, 'dy') || 0, moved = false, tg = null, b0 = null, pr = null;
    function mv(ev) {
      var dx = (ev.clientX - sx) / Z, dy = (ev.clientY - sy) / Z; if (!moved && Math.hypot(dx, dy) * Z < 4) return;
      if (!moved) { moved = true; pr = page.getBoundingClientRect(); var nd = ED.ctx().sec[pc.sid].querySelector('[data-k="' + pc.k + '"]'); b0 = rel(nd.getBoundingClientRect(), pr, Z); tg = pieceTargets(pc, Z); }
      var g = [], thr = 6 / Z;
      if (ED.snap && ED.snap !== false) {
        var cx = [b0.x + dx, b0.x + dx + b0.w / 2, b0.x + dx + b0.w], cy = [b0.y + dy, b0.y + dy + b0.h / 2, b0.y + dy + b0.h], bx = null, by = null;
        tg.xs.forEach(function (t) { cx.forEach(function (c) { var d = t - c; if (Math.abs(d) < thr && (!bx || Math.abs(d) < Math.abs(bx.d))) bx = { d: d, t: t }; }); });
        tg.ys.forEach(function (t) { cy.forEach(function (c) { var d = t - c; if (Math.abs(d) < thr && (!by || Math.abs(d) < Math.abs(by.d))) by = { d: d, t: t }; }); });
        if (bx) { dx += bx.d; g.push({ k: 'v', v: bx.t, a: tg.s.y, b: tg.s.y + tg.s.h }); } if (by) { dy += by.d; g.push({ k: 'h', v: by.t, a: tg.s.x, b: tg.s.x + tg.s.w }); }
      }
      ED.setGuides(g); ED.livePiece(pc.sid, pc.k, { dx: Math.round(x0 + dx), dy: Math.round(y0 + dy) });
    }
    function up() { W.removeEventListener('pointermove', mv); W.removeEventListener('pointerup', up); ED.setGuides([]); if (moved) { ED.commit('pmove'); ED.emit('sel'); } }
    W.addEventListener('pointermove', mv); W.addEventListener('pointerup', up);
  };
  /* centrar la pieza respecto a su bloque */
  ED.centerPiece = function (axis) {
    var pc = ED.pc; if (!pc) return; var Z = zoom(), sn = ED.ctx().sec[pc.sid], nd = sn.querySelector('[data-k="' + pc.k + '"]'), b = nd.getBoundingClientRect(), s = sn.getBoundingClientRect(), p = {};
    if (axis === 'x') p.dx = Math.round((ED.pieceVal(pc.sid, pc.k, 'dx') || 0) + ((s.left + s.width / 2) - (b.left + b.width / 2)) / Z);
    else p.dy = Math.round((ED.pieceVal(pc.sid, pc.k, 'dy') || 0) + ((s.top + s.height / 2) - (b.top + b.height / 2)) / Z);
    ED.setPiece(pc.sid, pc.k, p, 'center');
  };
  W.startPieceScaleImpl = function (e) {
    var pc = ED.pc; if (!pc) return; var nd = ED.ctx().sec[pc.sid].querySelector('[data-k="' + pc.k + '"]'), b = nd.getBoundingClientRect(), cx = b.left + b.width / 2, cy = b.top + b.height / 2, d0 = Math.hypot(e.clientX - cx, e.clientY - cy) || 1, s0 = ED.pieceVal(pc.sid, pc.k, 'sc') || 1;
    function mv(ev) { var d = Math.hypot(ev.clientX - cx, ev.clientY - cy); ED.livePiece(pc.sid, pc.k, { sc: Math.max(.2, Math.min(5, +(s0 * d / d0).toFixed(2))) }); }
    function up() { W.removeEventListener('pointermove', mv); W.removeEventListener('pointerup', up); ED.commit('pscale'); ED.emit('sel'); }
    W.addEventListener('pointermove', mv); W.addEventListener('pointerup', up);
  };
  /* los clics en piezas no deben navegar ni filtrar dentro del editor */
  page.addEventListener('click', function (e) { if (!ED.preview && e.target.closest('[data-k]')) { e.preventDefault(); e.stopPropagation(); } }, true);
  vp.addEventListener('dblclick', function (e) {
    if (ED.preview || ED.d3) return; var nd = e.target.closest('[data-k]'); if (!nd || nd.closest('section.sec.libre') || !nd.dataset.s || nd.dataset.t === 'logo') return;
    var sid = nd.closest('section.sec').dataset.sid, k = nd.dataset.k; nd.contentEditable = 'true'; nd.focus();
    var rg = document.createRange(); rg.selectNodeContents(nd); var sl = getSelection(); sl.removeAllRanges(); sl.addRange(rg);
    function fin() { nd.removeEventListener('blur', fin); nd.contentEditable = 'false'; nd.removeAttribute('contenteditable'); ED.setPiece(sid, k, { tx: nd.textContent }, null); }
    nd.addEventListener('blur', fin); nd.addEventListener('keydown', function (ev) { ev.stopPropagation(); if (ev.key === 'Escape' || (ev.key === 'Enter' && !ev.shiftKey)) { ev.preventDefault(); nd.blur(); } });
  });
})(window);
