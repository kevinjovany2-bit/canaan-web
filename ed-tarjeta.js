/* =====================================================================
   ed-tarjeta.js — Editor de la TARJETA DE PRENDA por capas
   Un solo diseño para todas las prendas de todos los catálogos.
   Cada capa (fondo, foto, nombre, precio, talla, botón, textos y cajas
   extra) se mueve y se estira con el mouse y se edita en el panel.
   ===================================================================== */
(function (W) {
  'use strict';
  var box = null, sel = null, prodIdx = 0, CW = 320;
  var TXT = { nombre: 1, precio: 1, talla: 1, pedir: 1, texto: 1, carrito: 1 };
  var ICO = { fondo: '▭', foto: '🖼', nombre: 'T', precio: '$', talla: '▾', pedir: '💬', texto: 'T', caja: '■', carrito: '🛍' };
  function $(q, r) { return (r || box).querySelector(q); }
  function h(tag, at, kids) {
    var e = document.createElement(tag); at = at || {};
    Object.keys(at).forEach(function (k) { if (k === 'text') e.textContent = at[k]; else if (k === 'html') e.innerHTML = at[k]; else if (k.slice(0, 2) === 'on') e[k] = at[k]; else e.setAttribute(k, at[k]); });
    (kids || []).forEach(function (c) { if (c) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); }); return e;
  }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function tpl() { return ED.doc.tarjeta; }
  function capa(id) { return tpl().capas.filter(function (c) { return c.id === id; })[0]; }
  function prods() { return ((W.SITIO || {}).productos || []); }

  /* ---------- guardar cambios ---------- */
  var liveT = 0;
  function live() { pintar(); clearTimeout(liveT); liveT = setTimeout(function () { ED.emit('change', { full: true }); }, 120); }
  function commit(ck) { ED.commit(ck || 'tj'); ED.emit('change', { full: true }); pintar(); panel(); lista(); }
  function set(id, p, ck) { var L = capa(id); if (!L) return; Object.keys(p).forEach(function (k) { if (p[k] === undefined || p[k] === '') delete L[k]; else L[k] = p[k]; }); commit(ck || ('tj' + id + Object.keys(p).join())); }

  /* ---------- abrir / cerrar ---------- */
  ED.abrirTarjeta = function () {
    var cats = ED.doc.secs.filter(function (s) { return s.t === 'catalogo'; });
    ED.change(function (d) {
      d.tarjeta = clone(PG.tplDe(d));
      d.secs.forEach(function (s) { if (s.t === 'catalogo') { s.cg = s.cg || {}; s.cg.est = 'capas'; } });
    }, 'tjopen', { full: true });
    if (!cats.length) ED.toast('No hay catálogos en la página; el diseño se usará cuando agregues uno.', 'warn');
    construir(); pintar(); lista(); panel();
  };
  function cerrar() { if (box) { box.remove(); box = null; sel = null; document.removeEventListener('keydown', teclas, true); } }

  function construir() {
    cerrar();
    box = h('div', { id: 'tj' });
    var ps = prods();
    var pick = h('select', { title: 'Prenda de ejemplo' }, ps.map(function (p, i) { return h('option', { value: i, text: p.nombre + ' · L ' + p.precio }); }));
    pick.value = prodIdx; pick.onchange = function () { prodIdx = +pick.value; pintar(); };
    box.appendChild(h('div', { class: 'tj-top' }, [
      h('b', { text: 'Diseño de la tarjeta' }), h('span', { class: 'tj-sub', text: 'Se aplica a todas las prendas de todos los catálogos, en PC, tablet y celular.' }),
      h('span', { class: 'sp' }), h('label', { class: 'tj-pick' }, ['Ver con: ', pick]),
      h('button', { class: 'b', text: '↺ Diseño inicial', onclick: function () { if (confirm('¿Volver al diseño inicial de la tarjeta? (Ctrl+Z para deshacer)')) { ED.doc.tarjeta = clone(PG.TPL_DEF); sel = null; commit('tjreset'); } } }),
      h('button', { class: 'b pri', text: '✓ Listo', onclick: cerrar })]));
    box.appendChild(h('div', { class: 'tj-main' }, [
      h('aside', { class: 'tj-l' }, [h('div', { class: 'tj-h', text: 'Capas' }), h('div', { class: 'tj-list' }),
        h('div', { class: 'tj-add' }, [h('button', { class: 'b sm', text: '+ Texto', onclick: function () { agregar('texto'); } }), h('button', { class: 'b sm', text: '+ Caja / fondo', onclick: function () { agregar('caja'); } })]),
        h('div', { class: 'tj-tip', text: 'Arrastra una capa para moverla y sus puntos para estirarla. Flechas = mover (Shift = más). Supr = borrar capa extra.' })]),
      h('div', { class: 'tj-c' }, [h('div', { class: 'tj-stage pg', style: 'width:' + (CW + 80) + 'px' }, [h('div', { class: 'cat-g', style: 'width:' + CW + 'px' }), h('div', { class: 'tj-ovl' })])]),
      h('aside', { class: 'tj-r' })]));
    document.body.appendChild(box);
    PG.applyTheme($('.tj-stage'), ED.doc.tema); PG.ensureFonts(ED.doc);
    $('.tj-stage').addEventListener('pointerdown', abajo);
    $('.tj-stage').addEventListener('click', function (e) { e.preventDefault(); }, true);
    document.addEventListener('keydown', teclas, true);
  }

  /* ---------- dibujar la tarjeta de ejemplo ---------- */
  function pintar() {
    if (!box) return; var g = $('.tj-stage .cat-g'), p = prods()[prodIdx] || { nombre: 'Nombre de la prenda', precio: 1250, tallas: 'S M L', foto: '' };
    g.innerHTML = PG.tarjetaHTML(p, tpl()); PG.ajustarTextos(g); marco();
  }
  function card() { return $('.tj-stage .prod'); }
  function marco() {
    var o = $('.tj-ovl'); o.innerHTML = ''; var c = card(); if (!c) return;
    o.style.width = c.offsetWidth + 'px'; o.style.height = c.offsetHeight + 'px';
    if (!sel || !capa(sel)) return; var L = capa(sel);
    var f = h('div', { class: 'tj-sel' + (L.hid ? ' oculto' : ''), style: 'left:' + L.x + '%;top:' + L.y + '%;width:' + L.w + '%;height:' + L.h + '%' });
    ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].forEach(function (k) { f.appendChild(h('i', { class: 'tj-hd tj-' + k, 'data-h': k })); });
    f.appendChild(h('span', { class: 'tj-tag', text: (L.n || L.t) + ' · ' + r1(L.w) + '×' + r1(L.h) + '%' }));
    o.appendChild(f);
  }
  function r1(v) { return Math.round(v * 10) / 10; }

  /* ---------- mover / estirar con el mouse ---------- */
  function abajo(e) {
    if (e.button !== 0) return; var c = card(); if (!c) return;
    var hd = e.target.dataset && e.target.dataset.h, ly = e.target.closest('.ly'), id = hd ? sel : (ly && ly.dataset.capa);
    if (!hd && e.target.closest('.tj-sel')) id = sel;
    if (!id) { sel = null; marco(); panel(); lista(); return; }
    e.preventDefault(); if (sel !== id) { sel = id; panel(); lista(); }
    var L = capa(id); if (!L) return; var r = c.getBoundingClientRect(), x0 = e.clientX, y0 = e.clientY, s0 = { x: L.x, y: L.y, w: L.w, h: L.h }, moved = false;
    marco();
    function mv(ev) {
      var dx = (ev.clientX - x0) / r.width * 100, dy = (ev.clientY - y0) / r.height * 100; if (Math.abs(dx) + Math.abs(dy) > .2) moved = true;
      if (!hd) {
        var nx = s0.x + dx, ny = s0.y + dy;
        [[0, 0], [50, .5], [100, 1]].forEach(function (q) { var edge = nx + s0.w * q[1]; if (Math.abs(edge - q[0]) < 1.2) nx = q[0] - s0.w * q[1]; });
        [[0, 0], [50, .5], [100, 1]].forEach(function (q) { var edge = ny + s0.h * q[1]; if (Math.abs(edge - q[0]) < 1.2) ny = q[0] - s0.h * q[1]; });
        L.x = r1(nx); L.y = r1(ny);
      } else {
        var x = s0.x, y = s0.y, w = s0.w, hh = s0.h;
        if (/e/.test(hd)) w = Math.max(2, s0.w + dx); if (/s/.test(hd)) hh = Math.max(2, s0.h + dy);
        if (/w/.test(hd)) { w = Math.max(2, s0.w - dx); x = s0.x + s0.w - w; } if (/n/.test(hd)) { hh = Math.max(2, s0.h - dy); y = s0.y + s0.h - hh; }
        L.x = r1(x); L.y = r1(y); L.w = r1(w); L.h = r1(hh);
      }
      live(); syncNums();
    }
    function up() { W.removeEventListener('pointermove', mv); W.removeEventListener('pointerup', up); if (moved) commit('tjmv' + id + Date.now()); }
    W.addEventListener('pointermove', mv); W.addEventListener('pointerup', up);
  }
  function teclas(e) {
    if (!box) return; var t = e.target; if (t && /INPUT|SELECT|TEXTAREA/.test(t.tagName)) return;
    if (e.key === 'Escape') { e.stopPropagation(); return cerrar(); }
    if (!sel) return; var L = capa(sel); if (!L) return; var st = e.shiftKey ? 2 : .5;
    var m = { ArrowLeft: ['x', -st], ArrowRight: ['x', st], ArrowUp: ['y', -st], ArrowDown: ['y', st] }[e.key];
    if (m) { e.preventDefault(); e.stopPropagation(); L[m[0]] = r1((L[m[0]] || 0) + m[1]); commit('tjkey' + sel); return; }
    if ((e.key === 'Delete' || e.key === 'Backspace') && (L.t === 'texto' || L.t === 'caja')) { e.preventDefault(); e.stopPropagation(); borrar(sel); }
  }

  /* ---------- capas: lista, orden, agregar, borrar ---------- */
  function lista() {
    if (!box) return; var l = $('.tj-list'); l.innerHTML = ''; var cs = tpl().capas;
    l.appendChild(h('div', { class: 'tj-row' + (!sel ? ' on' : ''), onclick: function () { sel = null; marco(); panel(); lista(); } }, [h('span', { class: 'ic', text: '▢' }), h('span', { class: 'nm', text: 'Tarjeta (tamaño)' })]));
    cs.slice().reverse().forEach(function (L) {
      var i = cs.indexOf(L);
      l.appendChild(h('div', { class: 'tj-row' + (sel === L.id ? ' on' : '') + (L.hid ? ' off' : ''), onclick: function () { sel = L.id; marco(); panel(); lista(); } }, [
        h('span', { class: 'ic', text: ICO[L.t] || '·' }), h('span', { class: 'nm', text: L.n || L.t }),
        h('button', { class: 'ib', title: L.hid ? 'Mostrar' : 'Ocultar', text: L.hid ? '🙈' : '👁', onclick: function (e) { e.stopPropagation(); set(L.id, { hid: L.hid ? undefined : 1 }, 'tjhid'); } }),
        h('button', { class: 'ib', title: 'Subir (adelante)', text: '▲', onclick: function (e) { e.stopPropagation(); mover(i, 1); } }),
        h('button', { class: 'ib', title: 'Bajar (atrás)', text: '▼', onclick: function (e) { e.stopPropagation(); mover(i, -1); } })]));
    });
  }
  function mover(i, d) { var cs = tpl().capas, j = i + d; if (j < 0 || j >= cs.length) return; var t = cs[i]; cs[i] = cs[j]; cs[j] = t; commit('tjord'); }
  function agregar(t) {
    var id = t + Date.now().toString(36).slice(-4), L = t === 'texto' ? { id: id, t: 'texto', n: 'Texto', tx: 'NUEVO', x: 6, y: 5, w: 30, h: 8, fs: 4.5, fw: 700, col: '#ffffff', bg: '#111111', rad: 2, al: 'c', va: 'c', ls: .1, ff: '@fb' }
      : { id: id, t: 'caja', n: 'Caja', x: 0, y: 66, w: 100, h: 34, bg: '#f4efe7', rad: 0 };
    if (t === 'caja') tpl().capas.splice(1, 0, L); else tpl().capas.push(L);
    sel = id; commit('tjadd');
  }
  function borrar(id) { var cs = tpl().capas, i = cs.map(function (c) { return c.id; }).indexOf(id); if (i < 0) return; cs.splice(i, 1); sel = null; commit('tjdel'); }

  /* ---------- panel de propiedades ---------- */
  var nums = [];
  function syncNums() { nums.forEach(function (f) { f(); }); var L = sel && capa(sel), t = box && $('.tj-tag'); if (L && t) t.textContent = (L.n || L.t) + ' · ' + r1(L.w) + '×' + r1(L.h) + '%'; }
  function grp(t, kids) { return h('div', { class: 'tj-g' }, [h('div', { class: 'tj-gt', text: t })].concat(kids)); }
  function row(kids) { return h('div', { class: 'tj-rw' }, kids); }
  function num(lb, id, k, o) {
    o = o || {}; var i = h('input', { type: 'number', step: o.step || .5, min: o.min, max: o.max });
    var rd = function () { var v = capa(id) && capa(id)[k]; if (document.activeElement !== i) i.value = v == null ? (o.def == null ? '' : o.def) : r1(v * (o.sc || 1)) ; };
    i.oninput = function () { var v = parseFloat(i.value); if (isNaN(v)) return; capa(id)[k] = v / (o.sc || 1); live(); };
    i.onchange = function () { commit('tjn' + id + k); };
    rd(); nums.push(rd); return h('label', { class: 'tj-f' }, [lb, i]);
  }
  function txt(lb, id, k, def) { var i = h('input', { type: 'text', value: (capa(id)[k] != null ? capa(id)[k] : def || '') }); i.oninput = function () { capa(id)[k] = i.value; live(); }; i.onchange = function () { commit('tjt' + id + k); }; return h('label', { class: 'tj-f wide' }, [lb, i]); }
  function color(lb, id, k, def, quitar) {
    var v = capa(id)[k], i = h('input', { type: 'color', value: /^#[0-9a-f]{6}$/i.test(v || '') ? v : (def || '#000000') });
    i.oninput = function () { capa(id)[k] = i.value; live(); }; i.onchange = function () { commit('tjc' + id + k); };
    return h('label', { class: 'tj-f' }, [lb, h('span', { class: 'tj-cl' }, [i, quitar ? h('button', { class: 'b sm', text: v ? 'Quitar' : 'Sin', onclick: function (e) { e.preventDefault(); set(id, (function () { var p = {}; p[k] = undefined; return p; })()); } }) : null])]);
  }
  function selc(lb, id, k, opts, def) {
    var s = h('select', null, opts.map(function (o) { return h('option', { value: o[0], text: o[1] }); }));
    var v = capa(id)[k]; s.value = v == null ? (def == null ? '' : def) : String(v);
    s.onchange = function () { var p = {}; p[k] = s.value === '' ? undefined : (isNaN(+s.value) || s.value === '' || /^@|[a-z]/i.test(s.value) ? s.value : +s.value); set(id, p); };
    return h('label', { class: 'tj-f' }, [lb, s]);
  }
  function chk(lb, id, k) { var c = h('input', { type: 'checkbox' }); c.checked = !!capa(id)[k]; c.onchange = function () { var p = {}; p[k] = c.checked ? 1 : undefined; set(id, p); }; return h('label', { class: 'tj-f chk' }, [c, lb]); }
  function seg(lb, id, k, opts, def) {
    var v = capa(id)[k] || def; return h('div', { class: 'tj-f' }, [lb, h('div', { class: 'tj-seg' }, opts.map(function (o) { return h('button', { class: o[0] === v ? 'on' : '', text: o[1], title: o[2] || o[1], onclick: function () { var p = {}; p[k] = o[0]; set(id, p); } }); }))]);
  }
  function panel() {
    if (!box) return; var r = $('.tj-r'); r.innerHTML = ''; nums = [];
    if (!sel || !capa(sel)) {
      var T = tpl(), ar = h('input', { type: 'range', min: 80, max: 240, step: 1, value: Math.round((T.ar || 1.48) * 100) }), lb = h('b', { text: (T.ar || 1.48).toFixed(2) });
      ar.oninput = function () { T.ar = +ar.value / 100; lb.textContent = T.ar.toFixed(2); live(); }; ar.onchange = function () { commit('tjar'); };
      r.appendChild(grp('Tarjeta', [h('label', { class: 'tj-f wide' }, ['Alto de la tarjeta (alto ÷ ancho): ', lb, ar]),
        h('div', { class: 'tj-tip', text: 'El ancho lo decide la cuadrícula del catálogo (columnas por dispositivo). Todo lo de adentro se ubica en % de la tarjeta, por eso se ve igual en cualquier pantalla.' })]));
      r.appendChild(grp('Cómo se pide', [h('div', { class: 'tj-tip', text: 'Si la capa "Botón pedir" está oculta, la clienta toca la tarjeta → elige talla → se abre WhatsApp. Si la muestras, pide con el botón.' })]));
      return;
    }
    var L = capa(sel), id = sel;
    r.appendChild(grp(L.n || L.t, [txt('Nombre de la capa', id, 'n', L.t), chk('Oculta', id, 'hid'),
      row([num('X %', id, 'x'), num('Y %', id, 'y')]), row([num('Ancho %', id, 'w'), num('Alto %', id, 'h')]),
      row([num('Rotación °', id, 'rot', { step: 1, def: 0 }), num('Opacidad %', id, 'op', { step: 5, sc: 100, def: 100, min: 0, max: 100 })]),
      (L.t === 'texto' || L.t === 'caja') ? h('button', { class: 'b sm danger', text: '🗑 Borrar capa', onclick: function () { borrar(id); } }) : null]));
    r.appendChild(grp('Fondo y borde', [color('Fondo', id, 'bg', '#ffffff', true), row([num('Borde px', id, 'bw', { step: 1, min: 0, def: 0 }), color('Color borde', id, 'bc', '#dddddd')]),
      row([num('Esquinas', id, 'rad', { step: .5, min: 0, def: 0 }), num('Relleno', id, 'pad', { step: .5, min: 0, def: 0 })]),
      selc('Sombra', id, 'sh', [['', 'Sin sombra'], ['suave', 'Suave'], ['media', 'Media'], ['fuerte', 'Fuerte']], '')]));
    if (TXT[L.t]) {
      var fonts = [['@fb', 'Texto del tema'], ['@fh', 'Títulos del tema']].concat(PG.fontNames(ED.doc).map(function (f) { return [f, f]; }));
      var g = [selc('Fuente', id, 'ff', fonts, '@fb'), row([num('Tamaño', id, 'fs', { step: .2, min: 1 }), selc('Peso', id, 'fw', [['300', 'Fina'], ['400', 'Normal'], ['500', 'Media'], ['600', 'Semi'], ['700', 'Negrita'], ['800', 'Extra']], '400')]),
        color('Color', id, 'col', '#111111'), row([chk('Cursiva', id, 'it'), chk('MAYÚSCULAS', id, 'up')]), num('Espaciado letras', id, 'ls', { step: .01, def: 0 }),
        seg('Alinear', id, 'al', [['l', '⟸', 'Izquierda'], ['c', '≡', 'Centro'], ['r', '⟹', 'Derecha']], 'l'), seg('Vertical', id, 'va', [['t', '⤒', 'Arriba'], ['c', '↕', 'Centro'], ['b', '⤓', 'Abajo']], 't')];
      if (L.t === 'nombre') g.push(num('Líneas máximas', id, 'lines', { step: 1, min: 1, max: 6, def: 2 }));
      if (L.t === 'precio') { g.push(chk('Mostrar la palabra antes del precio', id, 'lab')); g.push(txt('Palabra', id, 'labt', 'Precio')); g.push(h('div', { class: 'tj-tip', text: 'Si el precio no cabe (ej. L 12,500), la letra se achica sola.' })); }
      if (L.t === 'talla') g.push(txt('Texto', id, 'tx', 'Talla'));
      if (L.t === 'carrito') { g.push(txt('Texto junto a la bolsita (opcional)', id, 'tx', '')); g.push(h('div', { class: 'tj-tip', text: 'Al tocarla se agrega la prenda al carrito (pide talla si hace falta). Para quitar el carrito de la web, oculta esta capa con 👁.' })); }
      if (L.t === 'pedir' || L.t === 'texto') g.push(txt('Texto', id, 'tx', L.t === 'pedir' ? 'Pedir por WhatsApp' : 'Texto'));
      r.appendChild(grp('Texto', g));
    }
    if (L.t === 'foto') r.appendChild(grp('Foto', [seg('Ajuste', id, 'fit', [['cover', 'Cubrir'], ['contain', 'Contener (sin recortar)']], 'cover'),
      num('Enfoque vertical % (0 = arriba, 100 = abajo)', id, 'fy', { step: 5, min: 0, max: 100, def: 20 }),
      h('div', { class: 'tj-tip', text: 'Si se cortan las cabezas, baja el Enfoque (ej. 0–20) o haz la foto más alta estirando su punto de abajo.' })]));
  }

  /* si se deshace (Ctrl+Z) o cambia algo desde fuera, refrescar */
  ED.on('change', function () { if (box && document.activeElement && !/INPUT|SELECT/.test(document.activeElement.tagName)) { if (sel && !capa(sel)) sel = null; pintar(); } });
})(window);
