/* =====================================================================
   ed-core.js — estado del editor, historial, operaciones sobre el documento
   Todo cambio pasa por ED.change / ED.set / ED.patch para que el
   deshacer/rehacer, el autoguardado y el repintado funcionen igual.
   ===================================================================== */
(function (W) {
  'use strict';
  var ED = W.ED = {
    doc: null, sel: [], secSel: null, dev: 'd', files: {}, grid: false, snap: true, preview: false, d3: false,
    hist: [], hi: -1, dirty: true, clip: null, ar: true, pending: {}, L: {}, pub: null, savedT: 0, collapsed: {}
  };
  var LS = 'canaan_borrador', DEV = PG.DEV;
  var GLOBAL = { n: 1, lock: 1, g: 1, sec: 1, z: 1, an: 1, tx: 1, src: 1, ac: 1, href: 1, msg: 1, anc: 1, t: 1, logo: 1, id: 1 };

  /* ---------- eventos ---------- */
  ED.on = function (n, f) { (ED.L[n] = ED.L[n] || []).push(f); };
  ED.emit = function (n, a) { (ED.L[n] || []).forEach(function (f) { f(a); }); };

  /* ---------- acceso ---------- */
  ED.el = function (id) { for (var i = 0; i < ED.doc.els.length; i++) if (ED.doc.els[i].id === id) return ED.doc.els[i]; return null; };
  ED.sec = function (id) { for (var i = 0; i < ED.doc.secs.length; i++) if (ED.doc.secs[i].id === id) return ED.doc.secs[i]; return null; };
  ED.selEls = function () { return ED.sel.map(ED.el).filter(Boolean); };
  ED.r = function (el) { return PG.res(el, ED.dev); };
  ED.val = function (ids, k) { var e = ED.el(ids[0]); return e ? PG.res(e, ED.dev)[k] : undefined; };
  ED.isOv = function (id, k) { var e = ED.el(id); return !!(ED.dev !== 'd' && e && e.o && e.o[ED.dev] && k in e.o[ED.dev]); };
  ED.themeHex = function (v) { var t = ED.doc.tema; return v && v.charAt(0) === '@' ? (t[v.slice(1)] || '#000000') : (v || '#000000'); };
  ED.members = function (id) { var e = ED.el(id); if (!e || !e.g) return [id]; return ED.doc.els.filter(function (x) { return x.g === e.g; }).map(function (x) { return x.id; }); };
  ED.expand = function (ids) { var o = {}; ids.forEach(function (i) { ED.members(i).forEach(function (m) { o[m] = 1; }); }); return Object.keys(o); };
  ED.secW = function (sid) { var s = ED.sec(sid); return s && PG.adapted(s, ED.dev) ? DEV[ED.dev].w : 1280; };
  ED.secH = function (sid) { var s = ED.sec(sid); return s ? (PG.secRes(s, ED.dev).h || s.h || 400) : 400; };
  /* alto real del elemento (auto = medido en el lienzo) */
  ED.hOf = function (el) { var r = ED.r(el); if (typeof r.h === 'number') return r.h; var c = ED.ctx && ED.ctx(); var n = c && c.el[el.id]; return n ? n.offsetHeight : 40; };
  ED.geom = function (el) { var r = ED.r(el); return { x: r.x || 0, y: r.y || 0, w: r.w == null ? 200 : r.w, h: ED.hOf(el) }; };

  /* ---------- escritura de propiedades (con overrides por dispositivo) ---------- */
  function ensureAdapted(d, sid, dev) { var s = d.secs.filter(function (x) { return x.id === sid; })[0]; if (dev !== 'd' && s && s.t === 'libre' && !PG.adapted(s, dev)) PG.adapt(d, sid, dev); }
  function writeProps(d, e, props) {
    Object.keys(props).forEach(function (k) {
      var v = props[k];
      if (GLOBAL[k] || ED.dev === 'd') { if (v === undefined) delete e[k]; else e[k] = v; }
      else { ensureAdapted(d, e.sec, ED.dev); e.o = e.o || {}; e.o[ED.dev] = e.o[ED.dev] || {}; e.o[ED.dev][k] = v === undefined ? null : v; }
    });
  }
  ED.set = function (ids, props, ck) {
    ED.change(function (d) { ids.forEach(function (id) { var e = find(d, id); if (e) writeProps(d, e, props); }); }, ck, { paint: ids, noPanel: true });
  };
  ED.patch = function (map, ck) {
    ED.change(function (d) { Object.keys(map).forEach(function (id) { var e = find(d, id); if (e) writeProps(d, e, map[id]); }); }, ck, { paint: Object.keys(map), noPanel: true });
  };
  ED.live = function (map) { /* cambia sin historial (arrastres) */
    Object.keys(map).forEach(function (id) { var e = ED.el(id); if (e) writeProps(ED.doc, e, map[id]); });
    ED.emit('live', Object.keys(map));
  };
  ED.resetKey = function (ids, k) { ED.change(function (d) { ids.forEach(function (id) { var e = find(d, id); if (e && e.o && e.o[ED.dev]) delete e.o[ED.dev][k]; }); }, null, { paint: ids }); };
  function find(d, id) { for (var i = 0; i < d.els.length; i++) if (d.els[i].id === id) return d.els[i]; return null; }
  function findS(d, id) { for (var i = 0; i < d.secs.length; i++) if (d.secs[i].id === id) return d.secs[i]; return null; }
  ED.setSec = function (sid, props, ck, dev) {
    ED.change(function (d) { var s = findS(d, sid); if (!s) return; Object.keys(props).forEach(function (k) {
      var v = props[k]; if ((k === 'h') && ED.dev !== 'd') { ensureAdapted(d, sid, ED.dev); s.o[ED.dev].h = v; } else if (v === undefined) delete s[k]; else s[k] = v; }); }, ck, { secs: [sid], noPanel: true });
  };

  /* ---------- piezas de bloques (logo, títulos, botones…) ---------- */
  var PGLOBAL = { tx: 1, src: 1, an: 1 };
  function wpiece(d, sid, k, props) {
    var s = findS(d, sid); if (!s) return;
    Object.keys(props).forEach(function (p) {
      var v = props[p], o;
      if (PGLOBAL[p] || ED.dev === 'd') { s.k = s.k || {}; o = s.k[k] = s.k[k] || {}; }
      else { s.ko = s.ko || {}; s.ko[ED.dev] = s.ko[ED.dev] || {}; o = s.ko[ED.dev][k] = s.ko[ED.dev][k] || {}; }
      if (v === undefined) delete o[p]; else o[p] = v;
    });
  }
  ED.setPiece = function (sid, k, props, ck) { ED.change(function (d) { wpiece(d, sid, k, props); }, ck, { secs: [sid], noPanel: true }); };
  ED.livePiece = function (sid, k, props) { wpiece(ED.doc, sid, k, props); ED.emit('change', { secs: [sid], noPanel: true }); };
  ED.resetPiece = function (sid, k) { ED.change(function (d) { var s = findS(d, sid); if (!s) return; if (ED.dev === 'd') { if (s.k) delete s.k[k]; if (s.ko) Object.keys(s.ko).forEach(function (x) { delete s.ko[x][k]; }); } else if (s.ko && s.ko[ED.dev]) delete s.ko[ED.dev][k]; }, null, { secs: [sid] }); };
  ED.pieceVal = function (sid, k, p) { var s = ED.sec(sid); return s ? PG.pieceRes(s, k, ED.dev)[p] : undefined; };
  ED.pieceOv = function (sid, k, p) { var s = ED.sec(sid); return !!(ED.dev !== 'd' && s && s.ko && s.ko[ED.dev] && s.ko[ED.dev][k] && p in s.ko[ED.dev][k]); };

  /* ---------- historial / autoguardado ---------- */
  var lastCk = null, lastT = 0, saveTm;
  ED.snap0 = function () { ED.hist = [JSON.stringify(ED.doc)]; ED.hi = 0; };
  ED.commit = function (ck) {
    ED.doc.t = Date.now(); var s = JSON.stringify(ED.doc), now = Date.now();
    if (ck && ck === lastCk && now - lastT < 900 && ED.hi === ED.hist.length - 1 && ED.hi > 0) ED.hist[ED.hi] = s;
    else { ED.hist = ED.hist.slice(0, ED.hi + 1); ED.hist.push(s); if (ED.hist.length > 150) ED.hist.shift(); ED.hi = ED.hist.length - 1; }
    lastCk = ck || null; lastT = now; ED.dirty = true; clearTimeout(saveTm);
    saveTm = setTimeout(function () { try { localStorage.setItem(LS, s); } catch (e) {} }, 350);
    ED.emit('status');
  };
  ED.change = function (fn, ck, opt) { fn(ED.doc); ED.commit(ck); ED.emit('change', opt || { full: true }); };
  function restore(i) {
    ED.hi = i; ED.doc = PG.norm(JSON.parse(ED.hist[i]));
    ED.sel = ED.sel.filter(function (id) { return ED.el(id); }); if (ED.secSel && !ED.sec(ED.secSel)) ED.secSel = null;
    ED.dirty = true; lastCk = null; try { localStorage.setItem(LS, ED.hist[i]); } catch (e) {}
    ED.emit('change', { full: true }); ED.emit('sel'); ED.emit('status');
  }
  ED.undo = function () { if (ED.hi > 0) restore(ED.hi - 1); };
  ED.redo = function () { if (ED.hi < ED.hist.length - 1) restore(ED.hi + 1); };

  /* ---------- selección ---------- */
  ED.select = function (ids, add) {
    ids = ids || [];
    if (add) { var cur = ED.sel.slice(); ids.forEach(function (i) { var p = cur.indexOf(i); if (p < 0) cur.push(i); else cur.splice(p, 1); }); ids = cur; }
    ED.pc = null; ED.sel = ids; ED.secSel = ids.length ? null : ED.secSel; if (ids.length) ED.secSel = null;
    ED.emit('sel');
  };
  ED.selectSec = function (sid) { ED.pc = null; ED.sel = []; ED.secSel = sid; ED.emit('sel'); };
  ED.selectPiece = function (sid, k) { ED.sel = []; ED.secSel = null; ED.pc = { sid: sid, k: k }; ED.emit('sel'); };
  ED.deselect = function () { ED.pc = null; ED.sel = []; ED.secSel = null; ED.emit('sel'); };

  /* ---------- crear elementos ---------- */
  var TPL = {
    text: { t: 'text', n: 'Texto', w: 360, tx: 'Escribe tu texto', fs: 32, fw: 400, col: '@tx' },
    title: { t: 'text', n: 'Título', w: 600, tx: 'Título', ff: '@fh', fs: 64, fw: 700, lh: 1.05, col: '@c1' },
    img: { t: 'img', n: 'Imagen', w: 320, h: 320, fit: 'cover' },
    logo: { t: 'img', n: 'Logo', logo: 1, w: 200, h: 100, fit: 'contain' },
    btn: { t: 'btn', n: 'Botón', w: 220, h: 54, tx: 'Botón', bg: '@c1', col: '@bg', fs: 14, fw: 600, ls: 2, ac: 'none' },
    box: { t: 'box', n: 'Contenedor', w: 360, h: 220, bg: '@c3' }
  };
  ED.TPL = TPL;
  ED.nextZ = function (sid) { var m = 0; ED.doc.els.forEach(function (e) { if (e.sec === sid && (e.z || 0) > m) m = e.z; }); return m + 1; };
  ED.targetSec = function () {
    var cand = ED.secSel || (ED.sel[0] && ED.el(ED.sel[0]) && ED.el(ED.sel[0]).sec), s = cand && ED.sec(cand);
    if (s && s.t === 'libre') return s.id;
    var v = ED.viewCenter && ED.viewCenter(); if (v && v.sid) return v.sid;
    var f = ED.doc.secs.filter(function (x) { return x.t === 'libre'; })[0]; return f ? f.id : null;
  };
  ED.addEl = function (type, extra, at) {
    var sid = ED.targetSec(), made = null;
    ED.change(function (d) {
      if (!sid) { var ns = { id: PG.uid(), t: 'libre', n: 'Sección ' + (d.secs.length + 1), h: 600, bg: '@bg' }; d.secs.push(ns); sid = ns.id; }
      var tp = Object.assign({}, TPL[type], extra || {}), e = Object.assign({ id: PG.uid(), sec: sid, z: ED.nextZ(sid) }, tp);
      var w = e.w, h = typeof e.h === 'number' ? e.h : 60, c = at || (ED.viewCenter && ED.viewCenter()) || {}, sw = ED.secW(sid), sh = ED.secH(sid);
      var gx = Math.round(Math.max(0, Math.min(sw - w, (c.sid === sid && c.x != null ? c.x : sw / 2) - w / 2))), gy = Math.round(Math.max(0, Math.min(sh - h, (c.sid === sid && c.y != null ? c.y : sh / 2) - h / 2)));
      if (ED.dev === 'd') { e.x = gx; e.y = gy; }
      else { ensureAdapted(d, sid, ED.dev); var k = DEV[ED.dev].w / 1280; e.x = Math.round(gx / k); e.y = Math.round(gy / k); e.o = {}; e.o[ED.dev] = { x: gx, y: gy }; if (w * 1 > sw) { e.o[ED.dev].w = sw - 20; } }
      d.els.push(e); made = e.id;
    });
    ED.select([made]); return made;
  };
  ED.addSection = function (t, after, extra) {
    var id = PG.uid();
    ED.change(function (d) {
      var s = t === 'libre' ? { id: id, t: 'libre', n: 'Sección ' + (d.secs.length + 1), h: 500, bg: '@bg' } : { id: id, t: t, n: PG.BNAME[t] };
      if (extra) Object.assign(s, JSON.parse(JSON.stringify(extra)));
      var i = d.secs.map(function (x) { return x.id; }).indexOf(after || ED.secSel || (ED.sel[0] && ED.el(ED.sel[0]) && ED.el(ED.sel[0]).sec));
      if (i < 0) i = d.secs.length - 1; d.secs.splice(i + 1, 0, s);
    });
    ED.selectSec(id); ED.emit('scrollto', id); return id;
  };
  ED.delSection = function (sid) {
    ED.change(function (d) { d.secs = d.secs.filter(function (s) { return s.id !== sid; }); d.els = d.els.filter(function (e) { return e.sec !== sid; }); });
    ED.deselect();
  };
  ED.dupSection = function (sid) {
    var nid = PG.uid();
    ED.change(function (d) {
      var i = d.secs.map(function (x) { return x.id; }).indexOf(sid), s = JSON.parse(JSON.stringify(d.secs[i])); s.id = nid; s.n = (s.n || 'Sección') + ' copia'; d.secs.splice(i + 1, 0, s);
      var gm = {}; d.els.filter(function (e) { return e.sec === sid; }).forEach(function (e) { var c = JSON.parse(JSON.stringify(e)); c.id = PG.uid(); c.sec = nid; if (c.g) { gm[c.g] = gm[c.g] || PG.uid(); d.gn[gm[c.g]] = d.gn[c.g]; c.g = gm[c.g]; } d.els.push(c); });
    });
    ED.selectSec(nid);
  };
  ED.moveSec = function (sid, targetId, after) {
    ED.change(function (d) {
      var s = findS(d, sid); if (!s || sid === targetId) return; d.secs = d.secs.filter(function (x) { return x.id !== sid; });
      var i = d.secs.map(function (x) { return x.id; }).indexOf(targetId); d.secs.splice(i + (after ? 1 : 0), 0, s);
    });
  };
  ED.shiftSec = function (sid, dir) {
    var ids = ED.doc.secs.map(function (s) { return s.id; }), i = ids.indexOf(sid), j = i + dir; if (j < 0 || j >= ids.length) return;
    ED.moveSec(sid, ids[j], dir > 0);
  };

  /* ---------- duplicar / copiar / pegar / borrar ---------- */
  function cloneSet(d, els, sid, off) {
    var gm = {}, out = [];
    els.forEach(function (e) {
      var c = JSON.parse(JSON.stringify(e)); c.id = PG.uid(); c.sec = sid; c.z = ED.nextZ(sid) + out.length;
      if (c.g) { gm[c.g] = gm[c.g] || PG.uid(); d.gn[gm[c.g]] = d.gn[c.g] || 'Grupo'; c.g = gm[c.g]; }
      c.x = (c.x || 0) + off; c.y = (c.y || 0) + off;
      if (c.o) Object.keys(c.o).forEach(function (k) { if (c.o[k].x != null) c.o[k].x += off; if (c.o[k].y != null) c.o[k].y += off; });
      c.n = c.n && /copia$/.test(c.n) ? c.n : (c.n || '') + ' copia'; d.els.push(c); out.push(c.id);
    });
    return out;
  }
  ED.duplicate = function (off) {
    var els = ED.selEls(); if (!els.length) return; var ids;
    ED.change(function (d) { ids = cloneSet(d, els, els[0].sec, off == null ? 20 : off); }); ED.select(ids);
  };
  ED.copy = function () { var els = ED.selEls(); if (els.length) ED.clip = JSON.parse(JSON.stringify(els)); return !!els.length; };
  ED.cut = function () { if (ED.copy()) ED.remove(); };
  ED.paste = function () {
    if (!ED.clip || !ED.clip.length) return; var sid = ED.sec(ED.clip[0].sec) && ED.sec(ED.clip[0].sec).t === 'libre' ? ED.clip[0].sec : ED.targetSec(), ids;
    if (!sid) return; var tg = ED.secSel && ED.sec(ED.secSel) && ED.sec(ED.secSel).t === 'libre' ? ED.secSel : sid;
    ED.change(function (d) { ids = cloneSet(d, ED.clip, tg, 24); ED.clip.forEach(function (e) { e.x = (e.x || 0) + 24; e.y = (e.y || 0) + 24; }); }); ED.select(ids);
  };
  ED.remove = function (ids) {
    ids = ids || ED.sel; if (!ids.length) return;
    ED.change(function (d) { d.els = d.els.filter(function (e) { return ids.indexOf(e.id) < 0; }); }); ED.deselect();
  };
  ED.toggle = function (ids, k) { var p = {}; p[k] = ED.val(ids, k) ? undefined : true; ED.set(ids, p); };
  ED.setLock = function (ids, v) { ED.change(function (d) { ids.forEach(function (i) { var e = find(d, i); if (e) { if (v) e.lock = true; else delete e.lock; } }); }, null, { paint: ids }); };

  /* ---------- agrupar ---------- */
  ED.group = function () {
    var els = ED.selEls(); if (els.length < 2) return; var sid = els[0].sec; els = els.filter(function (e) { return e.sec === sid; }); var g = PG.uid();
    ED.change(function (d) { d.gn[g] = 'Grupo'; els.forEach(function (e) { find(d, e.id).g = g; }); }, null, { paint: [] }); ED.select(els.map(function (e) { return e.id; }));
  };
  ED.ungroup = function () {
    var ids = ED.expand(ED.sel); ED.change(function (d) { ids.forEach(function (i) { var e = find(d, i); if (e) delete e.g; }); }, null, { paint: [] }); ED.select(ids);
  };

  /* ---------- orden Z (capas) ---------- */
  ED.units = function (sid, d) {
    d = d || ED.doc; var els = d.els.filter(function (e) { return e.sec === sid; }), map = {}, out = [];
    els.forEach(function (e) { var k = e.g || e.id; if (!map[k]) { map[k] = { key: k, g: !!e.g, ids: [], z: 0 }; out.push(map[k]); } map[k].ids.push(e.id); });
    out.forEach(function (u) { u.ids.sort(function (a, b) { return (find(d, a).z || 0) - (find(d, b).z || 0); }); u.z = Math.min.apply(null, u.ids.map(function (i) { return find(d, i).z || 0; })); });
    out.sort(function (a, b) { return a.z - b.z; }); return out;
  };
  function renumber(d, units) { var n = 1; units.forEach(function (u) { u.ids.forEach(function (i) { find(d, i).z = n++; }); }); }
  function zop(fn) {
    var sid = ED.selEls()[0] && ED.selEls()[0].sec; if (!sid) return; var sel = ED.sel;
    ED.change(function (d) { var u = ED.units(sid, d), isSel = function (x) { return x.ids.some(function (i) { return sel.indexOf(i) >= 0; }); }; fn(u, isSel); renumber(d, u); }, null, { paint: ED.doc.els.filter(function (e) { return e.sec === sid; }).map(function (e) { return e.id; }) });
  }
  ED.front = function () { zop(function (u, s) { var a = u.filter(function (x) { return !s(x); }), b = u.filter(s); u.length = 0; [].push.apply(u, a.concat(b)); }); };
  ED.back = function () { zop(function (u, s) { var a = u.filter(function (x) { return !s(x); }), b = u.filter(s); u.length = 0; [].push.apply(u, b.concat(a)); }); };
  ED.forward = function () { zop(function (u, s) { for (var i = u.length - 2; i >= 0; i--) if (s(u[i]) && !s(u[i + 1])) { var t = u[i]; u[i] = u[i + 1]; u[i + 1] = t; } }); };
  ED.backward = function () { zop(function (u, s) { for (var i = 1; i < u.length; i++) if (s(u[i]) && !s(u[i - 1])) { var t = u[i]; u[i] = u[i - 1]; u[i - 1] = t; } }); };
  ED.reorder = function (sid, key, targetKey, above) { /* above = queda por encima del destino */
    ED.change(function (d) {
      var u = ED.units(sid, d), a = u.filter(function (x) { return x.key === key; })[0], rest = u.filter(function (x) { return x.key !== key; }); if (!a) return;
      var i = rest.map(function (x) { return x.key; }).indexOf(targetKey); if (i < 0) return; rest.splice(i + (above ? 1 : 0), 0, a); renumber(d, rest);
    }, null, { paint: ED.doc.els.filter(function (e) { return e.sec === sid; }).map(function (e) { return e.id; }) });
  };

  /* ---------- alinear / distribuir ---------- */
  ED.align = function (mode) {
    var els = ED.selEls(); if (!els.length) return; var sid = els[0].sec, G = els.map(function (e) { return { id: e.id, g: ED.geom(e) }; }), box;
    if (els.length === 1) box = { x: 0, y: 0, w: ED.secW(sid), h: ED.secH(sid) };
    else { var x0 = Math.min.apply(null, G.map(function (o) { return o.g.x; })), y0 = Math.min.apply(null, G.map(function (o) { return o.g.y; })), x1 = Math.max.apply(null, G.map(function (o) { return o.g.x + o.g.w; })), y1 = Math.max.apply(null, G.map(function (o) { return o.g.y + o.g.h; })); box = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }; }
    var m = {}; G.forEach(function (o) { var g = o.g, p = {};
      if (mode === 'l') p.x = box.x; if (mode === 'c') p.x = Math.round(box.x + (box.w - g.w) / 2); if (mode === 'r') p.x = box.x + box.w - g.w;
      if (mode === 't') p.y = box.y; if (mode === 'm') p.y = Math.round(box.y + (box.h - g.h) / 2); if (mode === 'b') p.y = box.y + box.h - g.h; m[o.id] = p; });
    ED.patch(m);
  };
  ED.distribute = function (axis) {
    var els = ED.selEls(); if (els.length < 3) return; var G = els.map(function (e) { return { id: e.id, g: ED.geom(e) }; }), X = axis === 'h', p = X ? 'x' : 'y', s = X ? 'w' : 'h';
    G.sort(function (a, b) { return a.g[p] - b.g[p]; }); var first = G[0].g[p], last = G[G.length - 1].g[p] + G[G.length - 1].g[s], tot = G.reduce(function (a, o) { return a + o.g[s]; }, 0), gap = (last - first - tot) / (G.length - 1), cur = first, m = {};
    G.forEach(function (o) { m[o.id] = {}; m[o.id][p] = Math.round(cur); cur += o.g[s] + gap; }); ED.patch(m);
  };

  /* ---------- archivos (imágenes / fuentes) ---------- */
  var urls = {};
  PG.asset = function (p) { if (ED.files[p]) { return urls[p] || (urls[p] = URL.createObjectURL(ED.files[p])); } return W.NUBE ? NUBE.ruta(p) : p; };
  ED.addFile = function (file, folder) {
    var base = file.name.replace(/[^a-z0-9._-]/gi, '_').replace(/\.(?=.*\.)/g, '_'), dot = base.lastIndexOf('.'), nm = (dot > 0 ? base.slice(0, dot) : base) + '_' + Date.now().toString(36).slice(-4) + (dot > 0 ? base.slice(dot) : '');
    var p = folder + '/' + nm; ED.files[p] = file; ED.pending[p] = 1; ED.idbPut(p, file); ED.emit('status'); return p;
  };
  ED.addFont = function (file) {
    var p = ED.addFile(file, 'fonts'), nm = file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim() || 'Fuente';
    if (ED.doc.fuentes.some(function (f) { return f.n === nm; })) nm += ' ' + Math.floor(Math.random() * 99);
    ED.change(function (d) { d.fuentes.push({ n: nm, f: p }); }, null, { full: true, panel: true }); return nm;
  };
  ED.delFont = function (nm) { ED.change(function (d) { d.fuentes = d.fuentes.filter(function (f) { return f.n !== nm; }); }, null, { full: true, panel: true }); };

  /* ---------- IndexedDB mínima (archivos pendientes + carpeta conectada) ---------- */
  var db;
  function idb() { return db || (db = new Promise(function (ok, no) { var r = indexedDB.open('canaan_editor', 1); r.onupgradeneeded = function () { r.result.createObjectStore('kv'); }; r.onsuccess = function () { ok(r.result); }; r.onerror = no; })); }
  function tx(m, fn) { return idb().then(function (d) { return new Promise(function (ok, no) { var t = d.transaction('kv', m), s = t.objectStore('kv'), q = fn(s); t.oncomplete = function () { ok(q && q.result); }; t.onerror = no; }); }); }
  ED.idbPut = function (k, v) { return tx('readwrite', function (s) { return s.put(v, k); }).catch(function () {}); };
  ED.idbGet = function (k) { return tx('readonly', function (s) { return s.get(k); }).catch(function () {}); };
  ED.idbDel = function (k) { return tx('readwrite', function (s) { return s.delete(k); }).catch(function () {}); };
  ED.idbAll = function () { return idb().then(function (d) { return new Promise(function (ok) { var o = {}, t = d.transaction('kv', 'readonly'), c = t.objectStore('kv').openCursor(); c.onsuccess = function () { var cu = c.result; if (cu) { o[cu.key] = cu.value; cu.continue(); } }; t.oncomplete = function () { ok(o); }; t.onerror = function () { ok({}); }; }); }).catch(function () { return {}; }); };

  /* ---------- carga inicial ---------- */
  ED.same = function (a, b) {
    if (!a || !b) return false; var A = JSON.parse(JSON.stringify(a)), B = JSON.parse(JSON.stringify(b)); delete A.t; delete B.t; return JSON.stringify(A) === JSON.stringify(B);
  };
  ED.load = function () {
    var ls = null; try { ls = JSON.parse(localStorage.getItem(LS)); } catch (e) {}
    var file = W.PAGINA_BORRADOR, pub = W.PAGINA, pick = null;
    if (ls && file) pick = (ls.t || 0) >= (file.t || 0) ? ls : file; else pick = ls || file || pub;
    ED.pub = pub ? JSON.parse(JSON.stringify(pub)) : null;
    ED.doc = PG.norm(pick ? JSON.parse(JSON.stringify(pick)) : PG.defaultDoc()); ED.snap0(); ED.dirty = !!(ls && (!file || (ls.t || 0) > (file.t || 0)));
    if (!pick) { ED.dirty = false; ED.pub = JSON.parse(JSON.stringify(ED.doc)); }
    return ED.idbAll().then(function (all) { Object.keys(all).forEach(function (k) { if (/^(images|fonts)\//.test(k)) { ED.files[k] = all[k]; ED.pending[k] = 1; } }); });
  };
  ED.keyStr = LS;
})(window);
