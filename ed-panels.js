/* =====================================================================
   ed-panels.js — barra superior, pestañas (Añadir / Capas / Diseño) y
   panel de propiedades. Los controles se generan con pocas fábricas
   reutilizables (num, rng, sel, seg, chk, col, fill, shadow...).
   ===================================================================== */
(function (W) {
  'use strict';
  var $ = function (i) { return document.getElementById(i); };
  function h(tag, a, kids) {
    var e = document.createElement(tag);
    if (a) Object.keys(a).forEach(function (k) { var v = a[k]; if (k === 'class') e.className = v; else if (k === 'text') e.textContent = v; else if (k === 'html') e.innerHTML = v; else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), v); else if (v != null) e.setAttribute(k, v); });
    (kids || []).forEach(function (c) { if (c) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); }); return e;
  }
  ED.h = h;
  var syncs = [], root = $('props'), TOK = [['c1', 'Principal'], ['c2', 'Secundario'], ['c3', 'Gris suave'], ['bg', 'Fondo'], ['tx', 'Texto']];
  var DEVN = { d: 'Escritorio', t: 'Tablet', m: 'Móvil' };

  /* ---------- binders: elementos / sección / tema ---------- */
  function elT(ids) { return { get: function (k) { return ED.val(ids, k); }, set: function (p, ck) { ED.set(ids, p, ck || Object.keys(p).join()); }, ov: function (k) { return ED.isOv(ids[0], k); }, reset: function (k) { ED.resetKey(ids, k); } }; }
  function secT(sid) { return { get: function (k) { var s = ED.sec(sid); return k === 'h' ? ED.secH(sid) : s && s[k]; }, set: function (p, ck) { ED.setSec(sid, p, ck || Object.keys(p).join()); }, ov: function () { return false; }, reset: function () {} }; }
  function temaT() { return { get: function (k) { return ED.doc.tema[k]; }, set: function (p, ck) { ED.change(function (d) { Object.assign(d.tema, p); }, 'tema' + Object.keys(p).join(), { theme: true, noPanel: true }); }, ov: function () { return false; }, reset: function () {} }; }

  /* ---------- fábricas de controles ---------- */
  function fld(label, T, key, ctl, cls) {
    var dot = h('button', { class: 'ovd', title: 'Valor propio de ' + DEVN[ED.dev] + ' · clic para volver al de escritorio', onclick: function () { T.reset(key); } });
    var lb = h('label', { text: label }), row = h('div', { class: 'fld ' + (cls || '') }, [lb, ctl, dot]);
    syncs.push(function () { dot.style.display = key && T.ov(key) ? '' : 'none'; }); return { row: row, lb: lb };
  }
  function num(label, T, key, o) {
    o = o || {}; var sc = o.scale || 1, inp = h('input', { type: 'number', step: o.step || 1, min: o.min, max: o.max });
    function read() { var v = T.get(key); if (v == null || v === 'auto') v = o.def; return typeof v !== 'number' ? '' : Math.round(v * sc * 100) / 100; }
    if (o.def === 'auto') inp.placeholder = 'auto';
    function sync() { if (W.document.activeElement !== inp) inp.value = read(); }
    inp.oninput = function () { var v = parseFloat(inp.value); if (isNaN(v)) return; if (o.min != null && v < o.min) v = o.min; if (o.max != null && v > o.max) v = o.max; (o.on || function (x) { var p = {}; p[key] = x; T.set(p, key); })(v / sc); };
    syncs.push(sync); sync(); var f = fld(label, T, key, inp, 'num');
    f.lb.classList.add('scrub'); f.lb.onpointerdown = function (e) {
      if (e.button) return; e.preventDefault(); var x0 = e.clientX, v0 = parseFloat(inp.value) || 0; f.lb.setPointerCapture(e.pointerId);
      f.lb.onpointermove = function (ev) { var v = v0 + Math.round((ev.clientX - x0) / 3) * (o.step || 1); if (o.min != null) v = Math.max(o.min, v); if (o.max != null) v = Math.min(o.max, v); inp.value = Math.round(v * 100) / 100; inp.oninput(); };
      f.lb.onpointerup = function (ev) { f.lb.onpointermove = null; f.lb.releasePointerCapture(ev.pointerId); };
    }; return f.row;
  }
  function rng(label, T, key, o) {
    o = o || {}; var sc = o.scale || 1, r = h('input', { type: 'range', min: o.min, max: o.max, step: o.step || 1 }), n = h('input', { type: 'number', min: o.min, max: o.max, step: o.step || 1 });
    function read() { var v = T.get(key); if (v == null) v = o.def; return v == null ? 0 : Math.round(v * sc * 100) / 100; }
    function put(v) { var p = {}; p[key] = v / sc; (o.on || function () { T.set(p, key); })(v / sc, p); }
    r.oninput = function () { n.value = r.value; put(parseFloat(r.value)); }; n.oninput = function () { var v = parseFloat(n.value); if (isNaN(v)) return; r.value = v; put(v); };
    syncs.push(function () { var v = read(); r.value = v; if (W.document.activeElement !== n) n.value = v; }); syncs[syncs.length - 1]();
    return fld(label, T, key, h('div', { class: 'rg' }, [r, n]), 'rng').row;
  }
  function sel(label, T, key, opts, o) {
    o = o || {}; var s = h('select', null, opts.map(function (p) { return h('option', { value: p[0], text: p[1] }); }));
    s.onchange = function () { var p = {}; p[key] = s.value === '' ? undefined : s.value; (o.on || function () { T.set(p, key); })(s.value, p); };
    syncs.push(function () { var v = T.get(key); s.value = v == null ? (o.def == null ? '' : o.def) : v; }); syncs[syncs.length - 1](); return fld(label, T, key, s).row;
  }
  function seg(label, T, key, opts, o) {
    o = o || {}; var bs = opts.map(function (p) { return h('button', { type: 'button', title: p[2] || p[1], text: p[1], onclick: function () { var q = {}; q[key] = p[0]; T.set(q, key); } }); });
    syncs.push(function () { var v = T.get(key); if (v == null) v = o.def; bs.forEach(function (b, i) { b.classList.toggle('on', opts[i][0] === v); }); }); syncs[syncs.length - 1]();
    return fld(label, T, key, h('div', { class: 'seg' }, bs)).row;
  }
  function chk(label, T, key) {
    var c = h('input', { type: 'checkbox' }); c.onchange = function () { var p = {}; p[key] = c.checked ? true : undefined; T.set(p, key); };
    syncs.push(function () { c.checked = !!T.get(key); }); syncs[syncs.length - 1](); return fld(label, T, key, c, 'chk').row;
  }
  function colW(get, set, def) { /* selector de color + fichas del tema */
    var inp = h('input', { type: 'color' }), chips = TOK.map(function (t) { return h('button', { type: 'button', class: 'chip', title: t[1], style: 'background:' + ED.doc.tema[t[0]], onclick: function () { set('@' + t[0]); } }); });
    inp.oninput = function () { set(inp.value); };
    function sync() { var v = get(); if (v == null || v === 'none' || v === '') v = def || '@tx'; inp.value = ED.themeHex(v); chips.forEach(function (c, i) { c.classList.toggle('on', v === '@' + TOK[i][0]); }); }
    syncs.push(sync); sync(); return h('div', { class: 'col' }, [inp].concat(chips));
  }
  function col(label, T, key, def) { return fld(label, T, key, colW(function () { return T.get(key); }, function (v) { var p = {}; p[key] = v; T.set(p, key); }, def)).row; }
  function parseFill(v) { if (!v || v === 'none') return { m: 'none' }; if (v.indexOf('g:') === 0) { var p = v.slice(2).split(','); return { m: 'g', a: p[0], b: p[1] || p[0], ang: p[2] == null ? 135 : +p[2] }; } return { m: 's', a: v }; }
  function fillStr(f) { return f.m === 'none' ? 'none' : f.m === 's' ? f.a : 'g:' + f.a + ',' + f.b + ',' + f.ang; }
  function fill(label, T, key, def) {
    var cur = function () { return parseFill(T.get(key) == null ? def : T.get(key)); }, put = function (f) { var p = {}; p[key] = fillStr(f); T.set(p, key); };
    var m = h('select', null, [h('option', { value: 'none', text: 'Ninguno' }), h('option', { value: 's', text: 'Sólido' }), h('option', { value: 'g', text: 'Degradado' })]);
    m.onchange = function () { var f = cur(); f.m = m.value; f.a = f.a || '@c1'; f.b = f.b || '@bg'; f.ang = f.ang == null ? 135 : f.ang; put(f); };
    var A = colW(function () { return cur().a; }, function (v) { var f = cur(); if (f.m === 'none') f.m = 's'; f.a = v; put(f); }, '@c1');
    var B = colW(function () { return cur().b; }, function (v) { var f = cur(); f.b = v; put(f); }, '@bg');
    var ang = h('input', { type: 'number', min: 0, max: 360, step: 5 }); ang.oninput = function () { var f = cur(); f.ang = parseFloat(ang.value) || 0; put(f); };
    var wB = h('div', { class: 'sub' }, [h('span', { text: 'Color 2' }), B]), wAng = h('div', { class: 'sub' }, [h('span', { text: 'Ángulo' }), ang]);
    syncs.push(function () { var f = cur(); m.value = f.m; wB.style.display = wAng.style.display = f.m === 'g' ? '' : 'none'; A.style.display = f.m === 'none' ? 'none' : ''; if (W.document.activeElement !== ang) ang.value = f.ang == null ? 135 : f.ang; }); syncs[syncs.length - 1]();
    return fld(label, T, key, h('div', { class: 'fillw' }, [m, A, wB, wAng])).row;
  }
  function shadow(label, T, key, box) {
    var D = { x: 0, y: box ? 8 : 2, b: box ? 20 : 4, s: 0, c: '#000000', o: .35 }, cur = function () { return Object.assign({}, D, T.get(key) || {}); }, on = function () { return !!T.get(key); };
    function put(o) { var p = {}; p[key] = o; T.set(p, key); }
    var c = h('input', { type: 'checkbox' }); c.onchange = function () { put(c.checked ? cur() : undefined); };
    var body = h('div', { class: 'shb' });
    function nm(l, k, mn, mx, st) { var i = h('input', { type: 'number', min: mn, max: mx, step: st || 1 }); i.oninput = function () { var o = cur(); o[k] = parseFloat(i.value) || 0; put(o); }; syncs.push(function () { if (W.document.activeElement !== i) i.value = cur()[k]; }); return h('label', { class: 'mini' }, [l, i]); }
    body.appendChild(h('div', { class: 'r4' }, [nm('X', 'x', -200, 200), nm('Y', 'y', -200, 200), nm('Desenfoque', 'b', 0, 200)].concat(box ? [nm('Expansión', 's', -100, 100)] : [])));
    body.appendChild(colW(function () { return cur().c; }, function (v) { var o = cur(); o.c = v; put(o); }, '#000000'));
    var op = h('input', { type: 'range', min: 0, max: 100 }); op.oninput = function () { var o = cur(); o.o = op.value / 100; put(o); }; body.appendChild(h('label', { class: 'mini' }, ['Opacidad', op]));
    syncs.push(function () { c.checked = on(); body.style.display = on() ? '' : 'none'; op.value = Math.round(cur().o * 100); }); syncs[syncs.length - 1]();
    return h('div', { class: 'shw' }, [fld(label, T, key, c, 'chk').row, body]);
  }
  function area(label, T, key) {
    var t = h('textarea', { rows: 3 }); t.oninput = function () { var p = {}; p[key] = t.value; T.set(p, key); };
    syncs.push(function () { if (W.document.activeElement !== t) t.value = T.get(key) == null ? '' : T.get(key); }); syncs[syncs.length - 1](); return fld(label, T, key, t, 'area').row;
  }
  function txt(label, T, key, ph) {
    var t = h('input', { type: 'text', placeholder: ph || '' }); t.oninput = function () { var p = {}; p[key] = t.value; T.set(p, key); };
    syncs.push(function () { if (W.document.activeElement !== t) t.value = T.get(key) == null ? '' : T.get(key); }); syncs[syncs.length - 1](); return fld(label, T, key, t).row;
  }
  function btn(text, fn, cls) { return h('button', { type: 'button', class: 'b ' + (cls || ''), text: text, onclick: fn }); }
  function fontSel(label, T, key) {
    var names = PG.fontNames(ED.doc), opts = [['@fh', '★ Fuente de títulos'], ['@fb', '★ Fuente de texto']].concat(names.map(function (n) { return [n, n]; }));
    var s = h('select', null, opts.map(function (p) { var o = h('option', { value: p[0], text: p[1] }); if (p[0] !== '@fh' && p[0] !== '@fb') o.style.fontFamily = "'" + p[0] + "'"; return o; }));
    s.onchange = function () { var p = {}; p[key] = s.value; T.set(p, key); };
    syncs.push(function () { s.value = T.get(key) || '@fb'; }); syncs[syncs.length - 1]();
    var up = btn('Subir fuente (.ttf .otf .woff)', function () { var i = h('input', { type: 'file', accept: '.ttf,.otf,.woff,.woff2' }); i.onchange = function () { if (i.files[0]) { var nm = ED.addFont(i.files[0]); var p = {}; p[key] = nm; setTimeout(function () { T.set(p, key); }, 0); } }; i.click(); }, 'sm');
    return h('div', null, [fld(label, T, key, s).row, up]);
  }
  function group(title, kids, closed) {
    var d = h('details', { class: 'grp' }), open = ED.openG && ED.openG[title]; if (open === undefined) open = !closed; d.open = open;
    d.addEventListener('toggle', function () { ED.openG = ED.openG || {}; ED.openG[title] = d.open; });
    d.appendChild(h('summary', { text: title })); var b = h('div', { class: 'gb' }); kids.forEach(function (k) { if (k) b.appendChild(k); }); d.appendChild(b); return d;
  }
  function rowOf(kids, cls) { return h('div', { class: cls || 'r2' }, kids); }
  function iconBtn(t, title, fn, cls) { return h('button', { type: 'button', class: 'ib ' + (cls || ''), title: title, text: t, onclick: fn }); }

  /* ---------- panel de propiedades ---------- */
  function build() {
    syncs = []; root.innerHTML = '';
    if (ED.pc && ED.sec(ED.pc.sid)) piecePanel(ED.pc.sid, ED.pc.k); else if (ED.sel.length) elPanel(ED.sel.slice()); else if (ED.secSel && ED.sec(ED.secSel)) secPanel(ED.secSel); else pagePanel();
    sync(); root.scrollTop = 0;
  }
  function sync() { syncs.forEach(function (f) { f(); }); designSyncs.forEach(function (f) { f(); }); }
  var ICON = { text: 'T', img: '▣', btn: '▭', box: '□' };
  function elPanel(ids) {
    var els = ids.map(ED.el).filter(Boolean); if (!els.length) return pagePanel(); var t = els[0].t, same = els.every(function (e) { return e.t === t; }), single = ids.length === 1, T = elT(ids), first = els[0];
    var tname = { text: 'Texto', img: first.logo ? 'Logo' : 'Imagen', btn: 'Botón', box: 'Contenedor' }[t];
    root.appendChild(h('div', { class: 'phead' }, [h('span', { class: 'pico', text: ICON[t] }), single ? txt('Nombre', { get: function (k) { return first[k] || tname; }, set: function (p) { ED.set(ids, p, 'name'); }, ov: function () { return false; }, reset: function () {} }, 'n') : h('b', { text: ids.length + ' elementos' })]));
    root.appendChild(h('div', { class: 'toolrow' }, [
      iconBtn(els.every(function (e) { return e.lock; }) ? '🔒' : '🔓', 'Bloquear / desbloquear', function () { ED.setLock(ids, !els.every(function (e) { return e.lock; })); ED.emit('sel'); }),
      iconBtn(els.every(function (e) { return ED.r(e).hide; }) ? '🙈' : '👁', 'Ocultar / mostrar en ' + DEVN[ED.dev], function () { ED.set(ids, { hide: els.every(function (e) { return ED.r(e).hide; }) ? undefined : true }); setTimeout(build, 0); }),
      iconBtn('⧉', 'Duplicar (Ctrl+D)', function () { ED.duplicate(); }), iconBtn('📋', 'Copiar (Ctrl+C)', function () { ED.copy(); }), iconBtn('🗑', 'Eliminar (Supr)', function () { ED.remove(); }, 'danger')]));
    if (ED.dev !== 'd') root.appendChild(h('div', { class: 'note', text: 'Editando para ' + DEVN[ED.dev] + ': los cambios de posición y estilo solo afectan a este dispositivo. Un punto ● junto a un campo indica que difiere de escritorio.' }));
    root.appendChild(group('Alinear y ordenar', [
      h('div', { class: 'toolrow' }, [iconBtn('⇤', 'Alinear izquierda', function () { ED.align('l'); }), iconBtn('↔', 'Centrar horizontal', function () { ED.align('c'); }), iconBtn('⇥', 'Alinear derecha', function () { ED.align('r'); }),
        iconBtn('⤒', 'Alinear arriba', function () { ED.align('t'); }), iconBtn('↕', 'Centrar vertical', function () { ED.align('m'); }), iconBtn('⤓', 'Alinear abajo', function () { ED.align('b'); }),
        iconBtn('⇹', 'Distribuir horizontal', function () { ED.distribute('h'); }), iconBtn('⇳', 'Distribuir vertical', function () { ED.distribute('v'); })]),
      h('div', { class: 'toolrow' }, [btn('Al frente', function () { ED.front(); }, 'sm'), btn('Adelante', function () { ED.forward(); }, 'sm'), btn('Atrás', function () { ED.backward(); }, 'sm'), btn('Al fondo', function () { ED.back(); }, 'sm')]),
      h('div', { class: 'toolrow' }, [btn('Agrupar', function () { ED.group(); }, 'sm'), btn('Desagrupar', function () { ED.ungroup(); }, 'sm')])]));
    var tr = [];
    if (single) {
      tr.push(rowOf([num('X', T, 'x'), num('Y', T, 'y')]));
      var ratio = function () { var g = ED.geom(first); return g.h / g.w; };
      tr.push(rowOf([num('Ancho', T, 'w', { min: 8, on: function (v) { var p = { w: Math.round(v) }; if (ED.ar && typeof ED.r(first).h === 'number') p.h = Math.round(v * ratio()); T.set(p, 'w'); } }),
        num('Alto', T, 'h', { min: 8, def: 'auto', on: function (v) { var p = { h: Math.round(v) }; if (ED.ar) p.w = Math.round(v / ratio()); T.set(p, 'h'); } })]));
      tr.push(h('div', { class: 'toolrow' }, [h('label', { class: 'inl' }, [h('input', { type: 'checkbox', checked: ED.ar ? '' : null, onchange: function (e) { ED.ar = e.target.checked; } }), 'Mantener proporción']), (t === 'text' || t === 'btn') ? btn('Alto automático', function () { T.set({ h: undefined }, 'h'); }, 'sm') : null]));
      var cb = tr[tr.length - 1].querySelector('input'); cb.checked = !!ED.ar;
    }
    tr.push(rowOf([num('Rotación °', T, 'r', { def: 0, min: -360, max: 360 }), num('Escala %', T, 'sc', { def: 1, scale: 100, min: 5, max: 500 })]));
    tr.push(rng('Opacidad %', T, 'op', { min: 0, max: 100, def: 1, scale: 100 }));
    if (single) tr.push(num('Z-index (profundidad)', T, 'z', { step: 1, def: 1, on: function (v) { ED.set(ids, { z: Math.round(v) }, 'z'); } }));
    root.appendChild(group('Posición y tamaño', tr));
    root.appendChild(group('3D · perspectiva', [rowOf([num('Inclinar X °', T, 'rx', { def: 0, min: -80, max: 80 }), num('Girar Y °', T, 'ry', { def: 0, min: -80, max: 80 })]), num('Profundidad Z (px)', T, 'tz', { def: 0, min: -600, max: 600, step: 10 })], true));
    if (same) {
      if (t === 'text') textGroups(ids, T, single); if (t === 'img') imgGroups(ids, T, single); if (t === 'btn') btnGroups(ids, T, single); if (t === 'box') boxGroups(T);
    }
    root.appendChild(animEl(ids));
    if (ED.dev !== 'd') root.appendChild(btn('Restablecer este elemento a escritorio', function () { ED.change(function (d) { ids.forEach(function (i) { var e = d.els.filter(function (z) { return z.id === i; })[0]; if (e && e.o) delete e.o[ED.dev]; }); }, null, { full: true, panel: true }); }, 'sm wide'));
  }
  function textGroups(ids, T, single) {
    if (single) root.appendChild(group('Contenido', [area('Texto', T, 'tx')]));
    root.appendChild(group('Tipografía', [fontSel('Fuente', T, 'ff'),
      rowOf([num('Tamaño', T, 'fs', { def: 18, min: 4, max: 400 }), sel('Peso', T, 'fw', [['300', '300 Fina'], ['400', '400 Normal'], ['500', '500'], ['600', '600 Seminegrita'], ['700', '700 Negrita'], ['800', '800'], ['900', '900 Extra']], { def: '400', on: function (v) { T.set({ fw: parseInt(v, 10) }, 'fw'); } })]),
      rowOf([chk('Cursiva', T, 'it'), chk('Subrayado', T, 'ul')]), col('Color', T, 'col', '@tx'),
      rowOf([num('Espaciado letras', T, 'ls', { def: 0, step: .5, min: -10, max: 80 }), num('Interlineado', T, 'lh', { def: 1.3, step: .05, min: .5, max: 4 })]),
      seg('Alineación', T, 'al', [['left', '⟸', 'Izquierda'], ['center', '≡', 'Centro'], ['right', '⟹', 'Derecha']], { def: 'left' })]));
    root.appendChild(group('Sombra de texto', [shadow('Sombra', T, 'tsh', false)], true));
  }
  function borderG(T, rmax) {
    return [rowOf([num('Grosor borde', T, 'bw', { def: 0, min: 0, max: 40 }), sel('Estilo', T, 'bs', [['solid', 'Sólido'], ['dashed', 'Guiones'], ['dotted', 'Puntos'], ['double', 'Doble']], { def: 'solid' })]), col('Color de borde', T, 'bc', '@tx'),
      rng('Radio de borde', T, 'rad', { def: 0, min: 0, max: rmax || 300 })];
  }
  function actGroup(ids, T) {
    var ac = ED.r(ED.el(ids[0])).ac || 'none', secs = ED.doc.secs.map(function (s) { return [s.id, s.n || PG.BNAME[s.t] || 'Sección']; });
    var kids = [sel('Al hacer clic', T, 'ac', [['none', 'Nada'], ['url', 'Abrir enlace (Instagram, Facebook, otra página…)'], ['wa', 'Escribir por WhatsApp'], ['ancla', 'Ir a una sección']], { def: 'none', on: function (v) { T.set({ ac: v }, 'ac'); setTimeout(build, 0); } })];
    if (ac === 'url') kids.push(txt('Enlace (https://…)', T, 'href', 'https://'));
    if (ac === 'wa') kids.push(txt('Mensaje de WhatsApp', T, 'msg', 'Hola, quiero información'));
    if (ac === 'ancla') kids.push(sel('Sección', T, 'anc', [['', '— elegir —']].concat(secs)));
    root.appendChild(group('Enlace / acción', kids));
  }
  function imgGroups(ids, T, single) {
    var first = ED.el(ids[0]), src = ED.r(first).src;
    root.appendChild(group('Imagen', [h('div', { class: 'imgprev' }, [src ? h('img', { src: PG.asset(src) }) : h('span', { text: first.logo ? 'Sin logo' : 'Sin imagen' })]),
      h('div', { class: 'toolrow' }, [btn(src ? 'Reemplazar imagen' : 'Subir imagen', function () { ED.pickImage(ids); }, 'sm pri'), src ? btn('Quitar', function () { T.set({ src: undefined }, 'src'); }, 'sm') : null])]));
    root.appendChild(group('Ajuste y recorte', [seg('Ajuste', T, 'fit', [['cover', 'Cubrir'], ['contain', 'Contener'], ['fill', 'Estirar']], { def: 'cover' }),
      rng('Zoom del recorte %', T, 'cz', { def: 1, min: 100, max: 400, scale: 100 }), rowOf([rng('Enfoque X %', T, 'cx', { def: 50, min: 0, max: 100 }), rng('Enfoque Y %', T, 'cy', { def: 50, min: 0, max: 100 })], 'c1')]));
    root.appendChild(group('Bordes', borderG(T)));
    root.appendChild(group('Sombra', [shadow('Sombra', T, 'sh', true)], true));
    root.appendChild(h('div', { class: 'note', text: 'Tip: clic derecho sobre la imagen para ponerle un enlace (red social, página o WhatsApp).' }));
    var F = function (k) { return { get: function () { return (T.get('fl') || {})[k]; }, set: function (p) { var o = Object.assign({}, T.get('fl') || {}); o[k] = p[k]; T.set({ fl: o }, 'fl' + k); }, ov: function () { return false; }, reset: function () {} }; };
    root.appendChild(group('Filtros', [rng('Desenfoque px', F('bl'), 'bl', { def: 0, min: 0, max: 30 }), rng('Brillo %', F('br'), 'br', { def: 100, min: 0, max: 200 }), rng('Contraste %', F('co'), 'co', { def: 100, min: 0, max: 200 }),
      rng('Saturación %', F('sa'), 'sa', { def: 100, min: 0, max: 200 }), rng('Blanco y negro %', F('gr'), 'gr', { def: 0, min: 0, max: 100 }), rng('Tono °', F('hu'), 'hu', { def: 0, min: -180, max: 180 }),
      btn('Quitar filtros', function () { T.set({ fl: undefined }, 'fl'); }, 'sm')], true));
  }
  function btnGroups(ids, T, single) {
    if (single) root.appendChild(group('Texto del botón', [area('Texto', T, 'tx')]));
    root.appendChild(group('Tipografía', [fontSel('Fuente', T, 'ff'), rowOf([num('Tamaño', T, 'fs', { def: 18, min: 4, max: 200 }), sel('Peso', T, 'fw', [['400', 'Normal'], ['600', 'Seminegrita'], ['700', 'Negrita'], ['800', 'Extra']], { def: '400', on: function (v) { T.set({ fw: parseInt(v, 10) }, 'fw'); } })]),
      col('Color de texto', T, 'col', '@bg'), num('Espaciado letras', T, 'ls', { def: 0, step: .5, min: -10, max: 80 })]));
    root.appendChild(group('Fondo y bordes', [fill('Fondo', T, 'bg', '@c1')].concat(borderG(T, 100))));
    root.appendChild(group('Sombra', [shadow('Sombra', T, 'sh', true)], true));
    actGroup(ids, T);
  }
  function boxGroups(T) {
    root.appendChild(group('Relleno', [fill('Fondo', T, 'bg', '@c3')])); root.appendChild(group('Bordes', borderG(T)));
    root.appendChild(group('Sombra', [shadow('Sombra', T, 'sh', true)], true));
  }
  var PRESETS = [['Aparecer', { t: 'fade' }], ['Subir', { t: 'slidefade', dir: 'bottom' }], ['Bajar', { t: 'slidefade', dir: 'top' }], ['Desde izq.', { t: 'slidefade', dir: 'left' }], ['Desde der.', { t: 'slidefade', dir: 'right' }],
    ['Zoom', { t: 'zoomin' }], ['Pop', { t: 'pop' }], ['Rebote', { t: 'bounce', dir: 'bottom', dist: 80 }], ['Desenfoque', { t: 'blur' }], ['Revelar', { t: 'wipe', dir: 'left' }], ['Giro 3D', { t: 'flip' }], ['Flotar', { t: 'float' }], ['Latido', { t: 'pulse' }]];
  var EASES = [['ease-out', 'Suave al final'], ['ease-in-out', 'Suave'], ['ease-in', 'Suave al inicio'], ['linear', 'Lineal'], ['cubic-bezier(.34,1.56,.64,1)', 'Rebote'], ['cubic-bezier(.22,1,.36,1)', 'Elástica suave']];
  function animGroup(A, preview, stag) {
    var o = A.cur() || {}, kids = [];
    kids.push(h('div', { class: 'presets' }, PRESETS.map(function (pr) { return h('button', { type: 'button', class: 'pre' + (o.t === pr[1].t && (pr[1].dir || o.dir) === (o.dir) ? ' on' : ''), text: pr[0], onclick: function () { A.put(Object.assign({ dur: PG.LOOP[pr[1].t] ? 3 : .8, del: 0, vel: 1, rep: 1, trig: 'view', ease: 'ease-out' }, pr[1])); setTimeout(function () { build(); preview(); }, 0); } }); })));
    kids.push(sel('Tipo', A, 't', PG.ANIMS, { on: function (v) { var p = { t: v || undefined }; if (v && !A.cur()) Object.assign(p, { dur: PG.LOOP[v] ? 3 : .8, del: 0, vel: 1, rep: 1, dir: 'bottom', ease: 'ease-out', trig: 'view' }); A.set(p); setTimeout(build, 0); } }));
    if (o.t) {
      if (/^(slide|slidefade|bounce|skew|wipe)$/.test(o.t)) { kids.push(sel(o.t === 'wipe' ? 'Revela desde' : 'Entra desde', A, 'dir', [['bottom', 'Abajo'], ['top', 'Arriba'], ['left', 'Izquierda'], ['right', 'Derecha']], { def: 'bottom' })); if (o.t !== 'wipe') kids.push(num('Distancia px', A, 'dist', { def: 60, min: 0, max: 800, step: 10 })); }
      if (!PG.LOOP[o.t]) kids.push(sel('Se activa', A, 'trig', [['view', 'Al aparecer en pantalla'], ['load', 'Al cargar la página'], ['hover', 'Al pasar el mouse']], { def: 'view' }));
      kids.push(rowOf([num('Duración s', A, 'dur', { def: PG.LOOP[o.t] ? 3 : .8, step: .1, min: .1, max: 20 }), num('Retraso s', A, 'del', { def: 0, step: .1, min: 0, max: 20 })]));
      kids.push(rowOf([num('Velocidad ×', A, 'vel', { def: 1, step: .25, min: .25, max: 4 }), num('Repeticiones (0=∞)', A, 'rep', { def: 1, min: 0, max: 99 })]));
      if (stag) kids.push(num('Escalonado s (entre piezas iguales)', A, 'stag', { def: 0, step: .05, min: 0, max: 2 }));
      kids.push(sel('Curva', A, 'ease', EASES, { def: 'ease-out' }));
      kids.push(h('div', { class: 'toolrow' }, [btn('▶ Previsualizar', preview, 'sm pri'), btn('Quitar animación', function () { A.put(undefined); setTimeout(build, 0); }, 'sm')]));
    }
    return group('Animación', kids, !o.t);
  }
  function animEl(ids) {
    var A = { cur: function () { return ED.el(ids[0]).an; }, put: function (v) { ED.set(ids, { an: v }, 'an'); }, get: function (k) { return (ED.el(ids[0]).an || {})[k]; }, set: function (p) { var o = Object.assign({}, ED.el(ids[0]).an || {}, p); ED.set(ids, { an: o.t ? o : undefined }, 'an'); }, ov: function () { return false; }, reset: function () {} };
    return animGroup(A, function () { var c = ED.ctx(); ids.forEach(function (i) { PG.playAnim(c.el[i], ED.el(i).an); }); });
  }
  function animSec(sid) {
    var A = { cur: function () { return ED.sec(sid).an; }, put: function (v) { ED.setSec(sid, { an: v }, 'an'); }, get: function (k) { return (ED.sec(sid).an || {})[k]; }, set: function (p) { var o = Object.assign({}, ED.sec(sid).an || {}, p); ED.setSec(sid, { an: o.t ? o : undefined }, 'an'); }, ov: function () { return false; }, reset: function () {} };
    return animGroup(A, function () { var s = ED.sec(sid), n = ED.ctx().sec[sid], t = n && n.querySelector(s.t === 'libre' ? '.swrap' : '.sin'); if (t) PG.playAnim(t, s.an); });
  }
  function animPiece(sid, k) {
    var A = { cur: function () { return ED.pieceVal(sid, k, 'an'); }, put: function (v) { ED.setPiece(sid, k, { an: v }, 'an'); }, get: function (q) { return (ED.pieceVal(sid, k, 'an') || {})[q]; }, set: function (p) { var o = Object.assign({}, ED.pieceVal(sid, k, 'an') || {}, p); ED.setPiece(sid, k, { an: o.t ? o : undefined }, 'an'); }, ov: function () { return false; }, reset: function () {} };
    return animGroup(A, function () { PG.playPiece(ED.ctx(), sid, k, ED.pieceVal(sid, k, 'an'), ED.pieceVal(sid, k, 'op')); }, true);
  }

  /* ---------- pieza de un bloque (logo, títulos, botones, íconos…) ---------- */
  function piecePanel(sid, k) {
    var s = ED.sec(sid), nd = ED.ctx().sec[sid] && ED.ctx().sec[sid].querySelector('[data-k="' + k + '"]'); if (!nd) return pagePanel();
    var kind = nd.dataset.t, nm = nd.dataset.n, count = ED.ctx().sec[sid].querySelectorAll('[data-k="' + k + '"]').length, single = !!nd.dataset.s, cs = getComputedStyle(nd);
    var T = { get: function (q) {
        var v = ED.pieceVal(sid, k, q); if (v != null) return v;
        if (q === 'fs') return Math.round(parseFloat(cs.fontSize)); if (q === 'fw') return String(cs.fontWeight); if (q === 'lh' && kind === 'text') return null; return v; },
      set: function (pp, ck) { ED.setPiece(sid, k, pp, ck || Object.keys(pp).join()); }, ov: function (q) { return ED.pieceOv(sid, k, q); }, reset: function (q) { var o = {}; o[q] = undefined; ED.setPiece(sid, k, o); } };
    root.appendChild(h('div', { class: 'phead' }, [h('span', { class: 'pico', text: { text: 'T', btn: '▭', logo: '♛', line: '—', card: '▣', icon: '✦' }[kind] || '·' }), h('b', { text: nm + (count > 1 ? ' (' + count + ' iguales)' : '') })]));
    root.appendChild(h('div', { class: 'toolrow' }, [
      iconBtn(ED.pieceVal(sid, k, 'hide') ? '🙈' : '👁', 'Ocultar / mostrar en ' + DEVN[ED.dev], function () { T.set({ hide: ED.pieceVal(sid, k, 'hide') ? undefined : true }, 'hide'); setTimeout(build, 0); }),
      iconBtn('↺', 'Restablecer esta pieza al diseño original', function () { ED.resetPiece(sid, k); setTimeout(build, 0); }), iconBtn('▤', 'Seleccionar la sección', function () { ED.selectSec(sid); })]));
    if (ED.dev !== 'd') root.appendChild(h('div', { class: 'note', text: 'Editando para ' + DEVN[ED.dev] + ': estilo y posición solo de este dispositivo (textos y animaciones son comunes).' }));
    if (count > 1) root.appendChild(h('div', { class: 'note', text: 'Los cambios se aplican a las ' + count + ' piezas iguales (' + nm.toLowerCase() + '). Su contenido (nombres, precios, fotos) viene de Productos y datos.' }));
    if (single && (kind === 'text' || kind === 'btn')) root.appendChild(group('Contenido', [area('Texto', { get: function () { var v = ED.pieceVal(sid, k, 'tx'); return v != null ? v : nd.dataset.o; }, set: function (pp) { T.set(pp, 'tx'); }, ov: function () { return false; }, reset: function () {} }, 'tx'), btn('Usar texto original', function () { T.set({ tx: undefined }, 'tx'); setTimeout(build, 0); }, 'sm')]));
    if (kind === 'logo') root.appendChild(h('div', { class: 'cvt' }, [btn('✦ Liberar el menú: logo y enlaces 100% libres', function () { if (confirm('El menú pasará a ser una sección libre: el logo, los enlaces y el botón serán elementos que mueves, escalas y rotas sin límites (puedes deshacer con Ctrl+Z).')) { ED.convertSection(sid); var l = ED.doc.els.filter(function (e) { return e.sec === sid && (e.logo || /^logo$/i.test(e.n || '')); })[0]; if (l) ED.select([l.id]); } }, 'sm pri wide')]));
    if (kind === 'logo') {
      var src = ED.pieceVal(sid, k, 'src'), cur = nd.querySelector('img');
      root.appendChild(group('Logo', [h('div', { class: 'imgprev' }, [cur ? h('img', { src: cur.src }) : h('span', { text: 'Logo en texto' })]),
        h('div', { class: 'toolrow' }, [btn('Subir logo (imagen)', function () { var i = h('input', { type: 'file', accept: 'image/*' }); i.onchange = function () { if (i.files[0]) { T.set({ src: ED.addFile(i.files[0], 'images') }, 'src'); setTimeout(build, 0); } }; i.click(); }, 'sm pri'), src ? btn('Quitar', function () { T.set({ src: undefined }, 'src'); setTimeout(build, 0); }, 'sm') : null]),
        num('Alto del logo px', { get: function () { return ED.pieceVal(sid, k, 'ih') || 46; }, set: function (pp) { T.set(pp, 'ih'); }, ov: function () { return ED.pieceOv(sid, k, 'ih'); }, reset: function () { T.reset('ih'); } }, 'ih', { min: 12, max: 400 }),
        txt('Texto (si no hay imagen)', { get: function () { var v = ED.pieceVal(sid, k, 'tx'); return v != null ? v : nd.textContent; }, set: function (pp) { T.set(pp, 'tx'); }, ov: function () { return false; }, reset: function () {} }, 'tx')]));
    }
    if (kind === 'text' || kind === 'btn' || (kind === 'logo' && !nd.querySelector('img'))) {
      var tg = [fontSel('Fuente', T, 'ff'), rowOf([num('Tamaño', T, 'fs', { min: 6, max: 300 }), sel('Peso', T, 'fw', [['300', '300 Fina'], ['400', '400 Normal'], ['500', '500'], ['600', '600 Seminegrita'], ['700', '700 Negrita'], ['800', '800'], ['900', '900 Extra']], { on: function (v) { T.set({ fw: parseInt(v, 10) }, 'fw'); } })]),
        rowOf([chk('Cursiva', T, 'it'), chk('Subrayado', T, 'ul')]), col('Color', T, 'col', '@tx'), rowOf([num('Espaciado letras', T, 'ls', { def: 0, step: .5, min: -10, max: 80 }), num('Interlineado', T, 'lh', { def: 1.3, step: .05, min: .5, max: 4 })])];
      if (kind === 'text') tg.push(seg('Alineación', T, 'al', [['left', '⟸', 'Izquierda'], ['center', '≡', 'Centro'], ['right', '⟹', 'Derecha']]));
      if (kind !== 'logo' || !nd.querySelector('img')) root.appendChild(group('Tipografía', tg));
      root.appendChild(group('Sombra de texto', [shadow('Sombra', T, 'tsh', false)], true));
    }
    if (kind === 'btn' || kind === 'card' || kind === 'text') root.appendChild(group('Tamaño (' + DEVN[ED.dev] + ')', [
      rng('Ancho % del cuadro', T, 'wp', { def: 100, min: 20, max: 100 }),
      num(kind === 'btn' ? 'Alto px (vacío = automático)' : 'Alto px (vacío = según forma)', T, 'hp', { min: 20, max: 1200 }),
      seg('Alinear', T, 'wa', [['l', '⟸', 'Izquierda'], ['c', '≡', 'Centro'], ['r', '⟹', 'Derecha']], { def: 'c' }),
      btn('Tamaño automático', function () { T.set({ wp: undefined, hp: undefined, wa: undefined }, 'wp'); setTimeout(build, 0); }, 'sm')]));
    if (kind === 'btn' || kind === 'card' || kind === 'text') root.appendChild(group('Fondo y bordes', [fill('Fondo', T, 'bg', kind === 'btn' ? '@c1' : kind === 'text' ? 'none' : '@c3'), num('Espacio interior px', T, 'pd', { min: 0, max: 80 })].concat(borderG(T, 100))));
    if (nd.classList.contains('tb') && kind === 'text') root.appendChild(group('Fondo detrás del texto', [
      seg('Fondo', T, 'tbg', [['1', 'Con fondo'], ['0', 'Sin fondo']], { def: '1' }),
      col('Color', T, 'tbc', '#9aa0a8'), rng('Intensidad %', T, 'tbo', { def: 22, min: 0, max: 100 }),
      h('div', { class: 'note', text: 'Para quitarlo en todo el catálogo: toca la sección → "Fondo de los textos" → Sin fondo.' })]));
    if (kind === 'btn' || kind === 'card' || kind === 'text') root.appendChild(group('Sombra', [shadow('Sombra', T, 'sh', true)], true));
    if (kind === 'line') root.appendChild(group('Línea', [fill('Color', T, 'bg', '@c2'), rowOf([num('Largo px', T, 'w', { min: 10, max: 2000 }), num('Grosor px', T, 'h', { min: 1, max: 60 })])]));
    if (kind === 'icon') root.appendChild(group('Ícono', [col('Color', T, 'col', '@c2'), num('Tamaño px', T, 'sz', { min: 12, max: 300 })]));
    root.appendChild(group('Posición y transformación', [h('div', { class: 'toolrow' }, [btn('↔ Centrar horizontal', function () { ED.centerPiece('x'); }, 'sm'), btn('↕ Centrar vertical', function () { ED.centerPiece('y'); }, 'sm'), btn('Reiniciar posición', function () { T.set({ dx: undefined, dy: undefined }, 'dx'); }, 'sm')]), rowOf([num('Mover X', T, 'dx', { def: 0, min: -1500, max: 1500 }), num('Mover Y', T, 'dy', { def: 0, min: -1500, max: 1500 })]), rowOf([num('Rotación °', T, 'r', { def: 0, min: -360, max: 360 }), num('Escala %', T, 'sc', { def: 1, scale: 100, min: 5, max: 500 })]), rng('Opacidad %', T, 'op', { min: 0, max: 100, def: 1, scale: 100 })]));
    root.insertBefore(h('div', { class: 'toolrow' }, [btn('↔ Centrar horizontal', function () { ED.centerPiece(sid, k, 'h'); }, 'sm'), btn('↕ Centrar vertical', function () { ED.centerPiece(sid, k, 'v'); }, 'sm')]), root.lastChild);
    root.appendChild(animPiece(sid, k));
  }

  /* ---------- sección ---------- */
  function secPanel(sid) {
    var s = ED.sec(sid), T = secT(sid), libre = s.t === 'libre';
    root.appendChild(h('div', { class: 'phead' }, [h('span', { class: 'pico', text: libre ? '▤' : '▦' }), txt('Nombre', { get: function () { return ED.sec(sid).n || ''; }, set: function (p) { ED.setSec(sid, p, 'sname'); }, ov: function () { return false; }, reset: function () {} }, 'n')]));
    root.appendChild(h('div', { class: 'toolrow' }, [iconBtn('▲', 'Subir sección', function () { ED.shiftSec(sid, -1); }), iconBtn('▼', 'Bajar sección', function () { ED.shiftSec(sid, 1); }), iconBtn('⧉', 'Duplicar sección', function () { ED.dupSection(sid); }),
      iconBtn(s.lock ? '🔒' : '🔓', 'Bloquear sección', function () { ED.setSec(sid, { lock: s.lock ? undefined : true }); ED.emit('sel'); }), iconBtn(s.hide ? '🙈' : '👁', 'Ocultar / mostrar', function () { ED.setSec(sid, { hide: s.hide ? undefined : true }); ED.emit('sel'); }),
      iconBtn('🗑', 'Eliminar sección', function () { if (confirm('¿Eliminar la sección "' + (s.n || '') + '"' + (libre ? ' y sus elementos' : '') + '?')) ED.delSection(sid); }, 'danger')]));
    if (libre) {
      root.appendChild(group('Tamaño', [num('Alto de la sección (' + DEVN[ED.dev] + ')', T, 'h', { min: 60, max: 4000, step: 10 }), ED.dev !== 'd' ? btn('Re-adaptar desde escritorio', function () { if (confirm('Esto reemplaza las posiciones de ' + DEVN[ED.dev] + ' en esta sección.')) ED.adaptSec(sid); }, 'sm') : null]));
      root.appendChild(group('Elementos', [h('div', { class: 'toolrow' }, [btn('+ Texto', function () { ED.selectSec(sid); ED.addEl('text'); }, 'sm'), btn('+ Imagen', function () { ED.selectSec(sid); ED.addEl('img'); }, 'sm'), btn('+ Botón', function () { ED.selectSec(sid); ED.addEl('btn'); }, 'sm'), btn('+ Caja', function () { ED.selectSec(sid); ED.addEl('box'); }, 'sm')])]));
    } else {
      root.appendChild(group('Espaciado', [num('Relleno arriba/abajo px', T, 'py', { min: 0, max: 400, step: 5, def: ED.doc.tema.sp, on: function (v) { ED.setSec(sid, { py: v }, 'py'); } }), btn('Usar espaciado global', function () { ED.setSec(sid, { py: undefined }); }, 'sm')]));
      root.appendChild(h('div', { class: 'cvt' }, [btn('✦ Convertir en sección libre (editar todo con guías y centrado)', function () { if (confirm('Cada pieza de "' + (s.n || PG.BNAME[s.t]) + '" pasará a ser un elemento independiente: lo moverás, centrarás y alinearás con total libertad.' + (s.t === 'catalogo' ? '\n\nAtención: las prendas dejarán de actualizarse desde productos.html en esta sección.' : '') + '\n\nPuedes deshacer con Ctrl+Z.')) ED.convertSection(sid); }, 'sm pri wide')]));
      var pcs = pieceList(sid);
      root.appendChild(group('Piezas editables', [h('div', { class: 'plist' }, pcs.map(function (q) { return h('button', { class: 'bl', text: q.n + (q.c > 1 ? ' ×' + q.c : ''), onclick: function () { ED.selectPiece(sid, q.k); } }); })),
        h('div', { class: 'note', html: 'Haz clic en cualquier parte del bloque (o elige aquí) para editar su estilo, mover o animar. El contenido (productos, precios, redes, WhatsApp) se cambia en <a href="productos.html" target="_blank">Productos y datos ↗</a>.' })]));
    }
    if (s.t === 'catalogo') catGroups(sid);
    root.appendChild(animSec(sid));
    root.appendChild(group('Fondo', [fill('Relleno', T, 'bg', 'none'), bgImgs(sid), rng('Velo sobre la foto %', T, 'velo', { def: .5, min: 0, max: 100, scale: 100 }), col('Color del velo', T, 'vc', '@bg'), seg('Ajuste foto', T, 'fit', [['cover', 'Cubrir'], ['contain', 'Contener']], { def: 'cover' })]));
  }
  function catGroups(sid) {
    prendasGroup(sid);
    root.appendChild(h('div', { class: 'cvt' }, [btn('⧉ Aplicar este diseño a todos los catálogos', function () { aplicarATodos(sid); }, 'sm wide')]));
    function cg() { return JSON.parse(JSON.stringify(ED.sec(sid).cg || {})); }
    function put(fn, ck) { var o = cg(); fn(o); ED.setSec(sid, { cg: o }, ck); }
    function devT(dv) { return { get: function (k) { return PG.catCfg(ED.sec(sid), dv)[k]; }, set: function (p, ck) { put(function (o) { o[dv] = Object.assign(o[dv] || {}, p); }, 'cg' + dv + ck); }, ov: function () { return false; }, reset: function () {} }; }
    var G = { get: function (k) { return PG.catCfg(ED.sec(sid), ED.dev)[k]; }, set: function (p, ck) { put(function (o) { Object.assign(o, p); }, 'cg' + ck); }, ov: function () { return false; }, reset: function () {} };
    var rows = [['d', '🖥 Computadora'], ['t', '▭ Tablet'], ['m', '▯ Celular']].map(function (x) {
      var T = devT(x[0]); return h('div', null, [h('div', { class: 'note', text: x[1] }), rowOf([num('Columnas', T, 'c', { min: 1, max: 8 }), num('Filas (0 = todas)', T, 'f', { min: 0, max: 30 })])]);
    });
    root.appendChild(group('Cuadrícula de prendas', rows.concat([h('div', { class: 'note', text: 'Ej.: 4 columnas × 2 filas = muestra 8 prendas. Filas en 0 muestra todas. Cambia a Tablet o Móvil arriba para ver cómo queda.' })])));
    root.appendChild(group('Cuadros de las prendas (todos juntos)', [
      seg('Cuadro', G, 'card', [['1', 'Con marco'], ['0', 'Sin marco']], { def: '1' }),
      rng('Tamaño del texto en cuadros %', G, 's', { def: 100, min: 60, max: 150 }),
      seg('Forma', G, 'ar', [['3/4', 'Alta'], ['4/5', 'Normal'], ['1/1', 'Cuadrada'], ['4/3', 'Ancha']], { def: '4/5' }),
      rng('Tamaño del catálogo %', G, 'w', { def: 100, min: 40, max: 100 }),
      rng('Espacio entre prendas px', G, 'gap', { def: 24, min: 0, max: 80 }),
      seg('Alinear', G, 'al', [['left', '⟸', 'Izquierda'], ['center', '≡', 'Centro'], ['right', '⟹', 'Derecha']], { def: 'center' })]));
      root.appendChild(group('Fondo de los textos (nombre, precio, tallas)', [
      seg('Fondo', G, 'tb', [['1', 'Difuminado'], ['0', 'Sin fondo']], { def: '1' }),
      col('Color', G, 'tbc', '#9aa0a8'),
      rng('Intensidad %', G, 'tbo', { def: 22, min: 0, max: 100 })]));
  }
  /* qué prendas muestra este catálogo (cada catálogo es independiente) */
  function prendasGroup(sid) {
    var s = ED.sec(sid), m = s.pm || 'todas', all = (W.SITIO || {}).productos || [], cats = (W.SITIO || {}).categorias || [];
    var T = { get: function (k) { return ED.sec(sid)[k]; }, set: function (p, ck) { ED.setSec(sid, p, ck); setTimeout(build, 0); }, ov: function () { return false; }, reset: function () {} };
    var kids = [seg('Mostrar', T, 'pm', [['todas', 'Todas'], ['cat', 'Una categoría'], ['sel', 'Elegir prendas']], { def: 'todas' })];
    if (m === 'cat') kids.push(sel('Categoría', T, 'pc', [['', '— elegir —']].concat(cats.map(function (c) { return [c, c]; }))));
    if (m === 'sel') {
      var ps = (s.ps || []).slice(), put = function (arr) { ED.setSec(sid, { ps: arr }, 'ps'); setTimeout(build, 0); };
      var orden = ps.map(function (id) { return all.filter(function (p) { return PG.pid(p) === id; })[0]; }).filter(Boolean).concat(all.filter(function (p) { return ps.indexOf(PG.pid(p)) < 0; }));
      kids.push(h('div', { class: 'note', text: 'Marca las prendas de este catálogo y ordénalas con ▲ ▼. ' + ps.length + ' elegidas.' }));
      kids.push(h('div', { class: 'toolrow' }, [btn('Marcar todas', function () { put(all.map(PG.pid)); }, 'sm'), btn('Ninguna', function () { put([]); }, 'sm')]));
      kids.push(h('div', { class: 'plst' }, orden.map(function (p) {
        var id = PG.pid(p), i = ps.indexOf(id), on = i >= 0, c = h('input', { type: 'checkbox' }); c.checked = on;
        c.onchange = function () { var a = ps.filter(function (x) { return x !== id; }); if (c.checked) a.push(id); put(a); };
        var mv = function (d) { var a = ps.slice(), j = i + d; if (j < 0 || j >= a.length) return; a[i] = a[j]; a[j] = id; put(a); };
        return h('div', { class: 'prow' + (on ? ' on' : '') }, [c, p.foto ? h('img', { src: PG.asset('images/' + p.foto) }) : h('span', { class: 'ph0' }), h('span', { class: 'pn', text: p.nombre + ' · L ' + p.precio }),
          on ? iconBtn('▲', 'Subir', function () { mv(-1); }) : null, on ? iconBtn('▼', 'Bajar', function () { mv(1); }) : null]);
      })));
    }
    kids.push(h('div', { class: 'note', text: 'Para otro catálogo: Añadir → "+ Catálogo de prendas". Muévelo con ▲ ▼ arriba en este panel, duplícalo con ⧉ o bórralo con 🗑.' }));
    root.appendChild(group('Prendas de este catálogo', kids));
  }
  function aplicarATodos(sid) {
    var otros = ED.doc.secs.filter(function (x) { return x.t === 'catalogo' && x.id !== sid; });
    if (!otros.length) { ED.toast('No hay otros catálogos en la página.', 'warn'); return; }
    if (!confirm('Copiar el diseño de este catálogo (cuadrícula, cuadros, fotos, fondos de texto, colores, botones y animaciones) a los otros ' + otros.length + ' catálogo(s)?\nSus títulos y sus prendas se mantienen.')) return;
    var cl = function (o) { return o == null ? undefined : JSON.parse(JSON.stringify(o)); };
    ED.change(function (d) {
      var src = d.secs.filter(function (x) { return x.id === sid; })[0];
      d.secs.forEach(function (x) {
        if (x.t !== 'catalogo' || x.id === sid) return;
        var tt = x.k && x.k.tit && x.k.tit.tx;
        ['cg', 'ko', 'an', 'py', 'bg', 'imgs', 'velo', 'vc', 'fit'].forEach(function (k) { var v = cl(src[k]); if (v === undefined) delete x[k]; else x[k] = v; });
        x.k = cl(src.k) || {}; if (x.k.tit) delete x.k.tit.tx; if (tt != null) { x.k.tit = x.k.tit || {}; x.k.tit.tx = tt; }
      });
    }, null, { full: true });
    ED.toast('✔ Diseño aplicado a ' + otros.length + ' catálogo(s).', 'ok');
  }
  function pieceList(sid) {
    var n = ED.ctx() && ED.ctx().sec[sid], seen = {}, out = []; if (!n) return out;
    n.querySelectorAll('[data-k]').forEach(function (e) { var k = e.dataset.k; if (!seen[k]) { seen[k] = { k: k, n: e.dataset.n, c: 0 }; out.push(seen[k]); } seen[k].c++; }); return out;
  }
  function bgImgs(sid) {
    var s = ED.sec(sid), imgs = s.imgs || [], box = h('div', { class: 'bgimgs' });
    imgs.forEach(function (p, i) { box.appendChild(h('div', { class: 'bgi' }, [h('img', { src: PG.asset(p) }), h('button', { text: '✕', title: 'Quitar', onclick: function () { ED.setSec(sid, { imgs: imgs.filter(function (_, j) { return j !== i; }) }, null); setTimeout(build, 0); } })])); });
    var add = btn('+ Fotos de fondo (varias = presentación)', function () { var i = h('input', { type: 'file', accept: 'image/*', multiple: '' }); i.onchange = function () { var ps = Array.prototype.map.call(i.files, function (f) { return ED.addFile(f, 'images'); }); ED.setSec(sid, { imgs: imgs.concat(ps) }, null); setTimeout(build, 0); }; i.click(); }, 'sm');
    return h('div', null, [box, add]);
  }
  function pagePanel() {
    root.appendChild(h('div', { class: 'empty' }, [h('h3', { text: 'Editor visual' }), h('p', { text: 'Haz clic en un elemento para editarlo, o en el fondo de una sección para cambiar su fondo y tamaño.' }),
      h('ul', null, ['Arrastra para mover; esquinas y lados para redimensionar; ● arriba para rotar.', 'Doble clic en un texto para escribir directamente.', 'Espacio + arrastrar (o rueda del mouse) para mover el lienzo; Ctrl + rueda para zoom.', 'Shift + clic para seleccionar varios; arrastra en el fondo para seleccionar con un marco.', 'Ctrl+Z / Ctrl+Y deshacer y rehacer · Ctrl+D duplicar · Ctrl+G agrupar.', 'Cambia a Tablet o Móvil arriba para ajustar el diseño de cada pantalla.'].map(function (t) { return h('li', { text: t }); }))]));
  }

  /* ---------- pestañas izquierdas ---------- */
  function tabs() {
    var bs = document.querySelectorAll('#ltabs button');
    function open(n) { bs.forEach(function (b) { b.classList.toggle('on', b.dataset.tab === n); }); ['add', 'layers', 'design'].forEach(function (k) { $('pane-' + k).style.display = k === n ? '' : 'none'; }); if (n === 'layers') layers(); if (n === 'design') design(); }
    bs.forEach(function (b) { b.onclick = function () { open(b.dataset.tab); }; }); ED.openTab = open; open('add');
  }
  function addPane() {
    var p = $('pane-add'), cards = [['text', 'T', 'Texto'], ['title', 'Aa', 'Título'], ['img', '▣', 'Imagen'], ['logo', '♛', 'Logo'], ['btn', '▭', 'Botón'], ['box', '□', 'Contenedor']];
    p.appendChild(h('div', { class: 'ptitle', text: 'Elementos' }));
    p.appendChild(h('div', { class: 'cards' }, cards.map(function (c) { return h('button', { class: 'card', onclick: function () { ED.addEl(c[0]); } }, [h('b', { text: c[1] }), h('span', { text: c[2] })]); })));
    p.appendChild(h('div', { class: 'cards one' }, [h('button', { class: 'card wide', onclick: function () { var i = h('input', { type: 'file', accept: 'image/*', multiple: '' }); i.onchange = function () { Array.prototype.forEach.call(i.files, function (f) { ED.addImageFile(f, ED.viewCenter()); }); }; i.click(); } }, [h('b', { text: '⇪' }), h('span', { text: 'Subir imagen(es)' })])]));
    p.appendChild(h('div', { class: 'ptitle', text: 'Secciones' }));
    p.appendChild(h('div', { class: 'cards one' }, [h('button', { class: 'card wide', onclick: function () { ED.addSection('libre'); } }, [h('b', { text: '▤' }), h('span', { text: 'Sección en blanco (libre)' })])]));
    p.appendChild(h('div', { class: 'ptitle', text: 'Bloques de la tienda' }));
    p.appendChild(h('label', { class: 'inl hint' }, [h('input', { type: 'checkbox', checked: '', onchange: function (e) { ED.asFree = e.target.checked; } }), ' Añadir como sección libre (todo editable)']));
    ED.asFree = true;
    p.appendChild(h('div', { class: 'blist' }, PG.BLOCKS.map(function (b) { return h('button', { class: 'bl', text: '+ ' + b.n, onclick: function () { var id = ED.addSection(b.t); if (ED.asFree && b.t !== 'catalogo') ED.convertSection(id); } }); })));
    p.appendChild(h('div', { class: 'hint', text: 'Tip: también puedes arrastrar imágenes o fuentes desde tu computadora directamente al lienzo.' }));
  }

  /* ---------- diseño global ---------- */
  var designSyncs = [];
  function design() {
    var p = $('pane-design'); p.innerHTML = ''; var prev = syncs; syncs = []; var T = temaT();
    [group('Colores', [col('Principal (botones, títulos)', T, 'c1'), col('Secundario (acentos / plata)', T, 'c2'), col('Gris suave (fondos)', T, 'c3'), col('Fondo de la página', T, 'bg'), col('Texto', T, 'tx')]),
      group('Tipografías', [fontSel('Fuente de títulos', T, 'fh'), fontSel('Fuente de texto', T, 'fb')]),
      group('Espaciado y bordes', [num('Espaciado vertical de secciones px', T, 'sp', { min: 0, max: 300, step: 5, def: 70 }), num('Radio de esquinas px (botones, tarjetas)', T, 'rad', { min: 0, max: 60, def: 0 })]),
      group('Fuentes subidas', ED.doc.fuentes.length ? ED.doc.fuentes.map(function (f) { return h('div', { class: 'frow' }, [h('span', { text: f.n, style: "font-family:'" + f.n + "'" }), h('button', { text: '✕', title: 'Quitar fuente', onclick: function () { ED.delFont(f.n); } })]); }) : [h('div', { class: 'hint', text: 'Sin fuentes subidas. Súbelas desde cualquier selector de fuente.' })], true)
    ].forEach(function (i) { p.appendChild(i); });
    designSyncs = syncs; syncs = prev; designSyncs.forEach(function (f) { f(); });
  }

  /* ---------- capas ---------- */
  var drag = null, layersQ = 0;
  function layers() {
    var box = $('pane-layers'); box.innerHTML = '';
    box.appendChild(h('div', { class: 'ltool' }, [btn('+ Sección', function () { ED.addSection('libre'); }, 'sm'), btn('Agrupar', function () { ED.group(); }, 'sm'), btn('Desagrupar', function () { ED.ungroup(); }, 'sm')]));
    var list = h('div', { class: 'llist' }); box.appendChild(list);
    ED.doc.secs.forEach(function (s) {
      var libre = s.t === 'libre', open = !ED.collapsed[s.id];
      list.appendChild(row({ cls: 'sec' + (ED.secSel === s.id ? ' on' : ''), key: 's:' + s.id, caret: libre ? (open ? '▾' : '▸') : ((ED.fopen && ED.fopen[s.id]) ? '▾' : '▸'), ico: libre ? '▤' : '▦', name: s.n || PG.BNAME[s.t], eye: !s.hide, lock: !!s.lock,
        onclick: function () { ED.selectSec(s.id); var n = ED.ctx().sec[s.id]; if (n) ED.panTo(n.offsetTop); }, oncaret: function () { if (libre) ED.collapsed[s.id] = open; else { ED.fopen = ED.fopen || {}; ED.fopen[s.id] = !ED.fopen[s.id]; } layers(); }, ontog: function () { ED.setSec(s.id, { hide: s.hide ? undefined : true }); ED.emit('sel'); }, onlock: function () { ED.setSec(s.id, { lock: s.lock ? undefined : true }); ED.emit('sel'); },
        rename: function (v) { ED.setSec(s.id, { n: v }, 'sname'); }, sec: s.id, kind: 's' }));
      if (!libre && ED.fopen && ED.fopen[s.id]) pieceList(s.id).forEach(function (q) {
        list.appendChild(row({ cls: 'el' + (ED.pc && ED.pc.sid === s.id && ED.pc.k === q.k ? ' on' : ''), key: 'p:' + s.id + ':' + q.k, ico: '◦', name: q.n + (q.c > 1 ? ' ×' + q.c : ''), depth: 1, eye: !ED.pieceVal(s.id, q.k, 'hide'), lock: false, kind: 'p', sec: s.id,
          onclick: function () { ED.selectPiece(s.id, q.k); }, ontog: function () { ED.setPiece(s.id, q.k, { hide: ED.pieceVal(s.id, q.k, 'hide') ? undefined : true }, 'hide'); }, onlock: function () {}, rename: function () {} }));
      });
      if (libre && open) ED.units(s.id).reverse().forEach(function (u) {
        if (u.g) {
          var mem = u.ids.map(ED.el), allSel = u.ids.every(function (i) { return ED.sel.indexOf(i) >= 0; });
          list.appendChild(row({ cls: 'grp' + (allSel ? ' on' : ''), key: 'u:' + u.key, ico: '▥', name: ED.doc.gn[u.key] || 'Grupo', depth: 1, eye: !mem.every(function (e) { return ED.r(e).hide; }), lock: mem.every(function (e) { return e.lock; }), sec: s.id, kind: 'u', ukey: u.key,
            onclick: function () { ED.select(u.ids); }, ontog: function () { var hid = mem.every(function (e) { return ED.r(e).hide; }); ED.set(u.ids, { hide: hid ? undefined : true }); }, onlock: function () { ED.setLock(u.ids, !mem.every(function (e) { return e.lock; })); },
            rename: function (v) { ED.change(function (d) { d.gn[u.key] = v; }, null, { paint: [], noPanel: true }); } }));
          u.ids.slice().reverse().forEach(function (i) { list.appendChild(elRow(ED.el(i), 2, s.id, u.key)); });
        } else list.appendChild(elRow(ED.el(u.ids[0]), 1, s.id, u.key));
      });
    });
  }
  function elRow(e, depth, sid, ukey) {
    var r = ED.r(e);
    return row({ cls: 'el' + (ED.sel.indexOf(e.id) >= 0 ? ' on' : ''), key: 'e:' + e.id, ico: ICON[e.t] || '·', name: e.n || { text: 'Texto', img: 'Imagen', btn: 'Botón', box: 'Contenedor' }[e.t], depth: depth, eye: !r.hide, lock: !!e.lock, sec: sid, kind: 'u', ukey: ukey, hid: !!r.hide,
      onclick: function (ev) { var ids = ev.altKey ? [e.id] : ED.members(e.id); if (ev.shiftKey || ev.ctrlKey || ev.metaKey) ED.select(ids, true); else ED.select(ids); },
      ontog: function () { ED.toggle([e.id], 'hide'); }, onlock: function () { ED.setLock([e.id], !e.lock); }, rename: function (v) { ED.set([e.id], { n: v }, 'name'); } });
  }
  function row(o) {
    var name = h('span', { class: 'nm', text: o.name, ondblclick: function (ev) {
      ev.stopPropagation(); var i = h('input', { class: 'rn', value: o.name }); name.replaceWith(i); i.focus(); i.select(); var done = false;
      function fin(ok) { if (done) return; done = true; if (ok && i.value.trim()) o.rename(i.value.trim()); layers(); } i.onblur = function () { fin(true); }; i.onkeydown = function (k) { k.stopPropagation(); if (k.key === 'Enter') fin(true); if (k.key === 'Escape') fin(false); }; } });
    var r = h('div', { class: 'lr ' + o.cls + (o.hid ? ' hid' : ''), draggable: 'true', style: 'padding-left:' + (6 + (o.depth || 0) * 14) + 'px', onclick: o.onclick, 'data-k': o.key }, [
      h('span', { class: 'cr', text: o.caret || '', onclick: function (ev) { if (o.oncaret) { ev.stopPropagation(); o.oncaret(); } } }), h('span', { class: 'ic', text: o.ico }), name,
      h('button', { class: 'tg', title: 'Mostrar / ocultar', text: o.eye ? '👁' : '—', onclick: function (ev) { ev.stopPropagation(); o.ontog(); } }),
      h('button', { class: 'tg', title: 'Bloquear / desbloquear', text: o.lock ? '🔒' : '🔓', onclick: function (ev) { ev.stopPropagation(); o.onlock(); } })]);
    r.addEventListener('dragstart', function (ev) { drag = o; ev.dataTransfer.setData('text/plain', o.key); ev.dataTransfer.effectAllowed = 'move'; });
    r.addEventListener('dragover', function (ev) { if (!drag || drag.kind !== o.kind || (o.kind === 'u' && drag.sec !== o.sec) || drag.key === o.key) return; ev.preventDefault(); var up = ev.offsetY < r.offsetHeight / 2; r.classList.toggle('dtu', up); r.classList.toggle('dtd', !up); });
    r.addEventListener('dragleave', function () { r.classList.remove('dtu', 'dtd'); });
    r.addEventListener('drop', function (ev) {
      ev.preventDefault(); r.classList.remove('dtu', 'dtd'); if (!drag || drag.key === o.key) return; var up = ev.offsetY < r.offsetHeight / 2, d = drag; drag = null;
      if (o.kind === 's' && d.kind === 's') ED.moveSec(d.key.slice(2), o.key.slice(2), !up); else if (o.kind === 'u' && d.kind === 'u' && d.sec === o.sec) ED.reorder(o.sec, d.ukey, o.ukey, up); });
    r.addEventListener('dragend', function () { drag = null; document.querySelectorAll('.dtu,.dtd').forEach(function (x) { x.classList.remove('dtu', 'dtd'); }); });
    return r;
  }
  function layersLater() { if (!layersQ) layersQ = requestAnimationFrame(function () { layersQ = 0; if ($('pane-layers').style.display !== 'none') layers(); }); }

  /* ---------- barra superior ---------- */
  function topbar() {
    ['d', 't', 'm'].forEach(function (d) { $('dev-' + d).onclick = function () { ED.setDev(d); }; });
    $('b-undo').onclick = function () { ED.undo(); }; $('b-redo').onclick = function () { ED.redo(); };
    $('z-out').onclick = function () { ED.zoomBy(1 / 1.2); }; $('z-in').onclick = function () { ED.zoomBy(1.2); }; $('z-fit').onclick = function () { ED.fit(); }; $('z-100').onclick = function () { ED.zoomSet(1); };
    $('b-grid').onclick = function () { ED.grid = !ED.grid; $('b-grid').classList.toggle('on', ED.grid); ED.emit('sel'); };
    $('b-snap').onclick = function () { ED.snap = !ED.snap; $('b-snap').classList.toggle('on', ED.snap); };
    $('b-hand').onclick = function () { var v = !$('b-hand').classList.contains('on'); $('b-hand').classList.toggle('on', v); ED.setHand(v); };
    $('b-3d').onclick = function () { ED.setD3(!ED.d3); }; $('b-prev').onclick = function () { ED.setPreview(true); };
    $('b-exit').onclick = function () { ED.setPreview(false); }; $('b-replay').onclick = function () { ED.render(); };
    $('b-snap').classList.add('on');
    ED.on('dev', function () { ['d', 't', 'm'].forEach(function (d) { $('dev-' + d).classList.toggle('on', ED.dev === d); }); build(); });
    ED.on('mode', function () { document.body.classList.toggle('preview', ED.preview); document.body.classList.toggle('d3', ED.d3); $('b-3d').classList.toggle('on', ED.d3); if (!ED.d3) ED.fit(); build(); });
    ED.on('status', status);
    $('dev-d').classList.add('on');
  }
  function status() {
    var s = $('status'), pend = Object.keys(ED.pending).length, cls, txt;
    if (ED.dirty) { cls = 'warn'; txt = 'Cambios sin guardar'; } else if (!ED.same(ED.doc, ED.pub)) { cls = 'info'; txt = 'Borrador guardado · sin publicar'; } else { cls = 'ok'; txt = 'Publicado'; }
    s.className = 'status ' + cls; s.textContent = txt; s.title = pend ? pend + ' archivo(s) por subir a la nube (fotos/fuentes)' : '';
    $('b-undo').disabled = ED.hi <= 0; $('b-redo').disabled = ED.hi >= ED.hist.length - 1;
  }
  ED.status = status;

  /* ---------- eventos globales ---------- */
  ED.on('sel', function () { build(); layersLater(); });
  ED.on('change', function (o) { o = o || {}; if (o.full || o.panel) { build(); if ($('pane-design').style.display !== 'none') design(); } else sync(); layersLater(); });
  ED.on('live', function () { sync(); });
  ED.initPanels = function () { tabs(); addPane(); topbar(); build(); status(); };
})(window);
