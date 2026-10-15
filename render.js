/* =====================================================================
   render.js — motor compartido (web pública + lienzo del editor)
   Lee un "documento de página" (secciones + elementos) y lo dibuja.
   Expone el objeto global PG.
   ===================================================================== */
(function (W) {
  'use strict';
  var DEV = { d: { w: 1280 }, t: { w: 820 }, m: { w: 390 } };
  var PRESET = [
    ['Cormorant Garamond', 'Cormorant+Garamond:wght@500;700', 'serif'], ['Playfair Display', 'Playfair+Display:wght@500;700', 'serif'],
    ['Lora', 'Lora:wght@400;700', 'serif'], ['Montserrat', 'Montserrat:wght@400;600;700', 'sans-serif'], ['Poppins', 'Poppins:wght@400;600;700', 'sans-serif'],
    ['Raleway', 'Raleway:wght@400;600;700', 'sans-serif'], ['Inter', 'Inter:wght@400;600;700', 'sans-serif'], ['Oswald', 'Oswald:wght@400;600', 'sans-serif'],
    ['Bebas Neue', 'Bebas+Neue', 'sans-serif'], ['Pinyon Script', 'Pinyon+Script', 'cursive'], ['Dancing Script', 'Dancing+Script:wght@500;700', 'cursive'], ['Great Vibes', 'Great+Vibes', 'cursive']
  ];
  var PMAP = {}; PRESET.forEach(function (p) { PMAP[p[0]] = p; });
  var BLOCKS = [
    { t: 'aviso', n: 'Barra de avisos' }, { t: 'menu', n: 'Menú' }, { t: 'categorias', n: 'Categorías' }, { t: 'catalogo', n: 'Catálogo de prendas' },
    { t: 'opinion', n: 'Opinión de clienta' }, { t: 'galeria', n: 'Galería Instagram' }, { t: 'ventajas', n: 'Ventajas' }, { t: 'cta', n: 'Llamado a WhatsApp' }, { t: 'pie', n: 'Pie de página' }
  ];
  var BNAME = {}; BLOCKS.forEach(function (b) { BNAME[b.t] = b.n; });
  var ICONOS = {
    envio: '<svg viewBox="0 0 32 32"><path d="M2 8h18v14H2zM20 13h6l4 4v5H20zM8 26a2.5 2.5 0 1 0 .01 0M24 26a2.5 2.5 0 1 0 .01 0"/></svg>',
    cambio: '<svg viewBox="0 0 32 32"><path d="M5 12h20l-5-5M27 20H7l5 5"/></svg>',
    chat: '<svg viewBox="0 0 32 32"><path d="M4 6h24v16H14l-6 5v-5H4z"/></svg>',
    candado: '<svg viewBox="0 0 32 32"><path d="M7 14h18v14H7zM11 14V9a5 5 0 0 1 10 0v5"/></svg>'
  };
  var PG = { DEV: DEV, PRESET: PRESET, BLOCKS: BLOCKS, BNAME: BNAME, asset: function (p) { return p; } };
  var filtro = 'Todo';

  /* ---------- utilidades ---------- */
  function uid() { return Math.random().toString(36).slice(2, 8); }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function hex(h) { h = String(h || '#000').replace('#', ''); if (h.length === 3) h = h.replace(/./g, '$&$&'); var n = parseInt(h, 16) || 0; return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
  function mix(a, b, t) { var x = hex(a), y = hex(b); return '#' + x.map(function (v, i) { return ('0' + Math.round(v + (y[i] - v) * t).toString(16)).slice(-2); }).join(''); }
  function tok(v) { return typeof v === 'string' && v.charAt(0) === '@' ? 'var(--' + v.slice(1) + ')' : v; }
  function fillCss(v) {
    if (!v || v === 'none') return 'transparent';
    if (v.indexOf('g:') === 0) { var p = v.slice(2).split(','); return 'linear-gradient(' + (p[2] || 135) + 'deg,' + tok(p[0]) + ',' + tok(p[1] || p[0]) + ')'; }
    return tok(v);
  }
  function shCss(s) { return !s ? 'none' : (s.x || 0) + 'px ' + (s.y || 0) + 'px ' + (s.b || 0) + 'px ' + (s.s || 0) + 'px color-mix(in srgb,' + tok(s.c || '#000') + ' ' + Math.round((s.o == null ? .35 : s.o) * 100) + '%,transparent)'; }
  function tshCss(s) { return !s ? 'none' : (s.x || 0) + 'px ' + (s.y || 0) + 'px ' + (s.b || 0) + 'px color-mix(in srgb,' + tok(s.c || '#000') + ' ' + Math.round((s.o == null ? .35 : s.o) * 100) + '%,transparent)'; }
  function fontCss(v) {
    if (!v || v === '@fb') return 'var(--fb)'; if (v === '@fh') return 'var(--fh)';
    var p = PMAP[v]; return "'" + v + "'," + (p ? p[2] : 'sans-serif');
  }
  function fltCss(f) {
    if (!f) return 'none'; var o = [];
    if (f.bl) o.push('blur(' + f.bl + 'px)'); if (f.br != null && f.br !== 100) o.push('brightness(' + f.br + '%)');
    if (f.co != null && f.co !== 100) o.push('contrast(' + f.co + '%)'); if (f.gr) o.push('grayscale(' + f.gr + '%)');
    if (f.sa != null && f.sa !== 100) o.push('saturate(' + f.sa + '%)'); if (f.hu) o.push('hue-rotate(' + f.hu + 'deg)');
    return o.length ? o.join(' ') : 'none';
  }
  function res(el, dev) { var r = Object.assign({}, el); if (dev !== 'd' && el.o && el.o[dev]) Object.assign(r, el.o[dev]); return r; }
  function secRes(s, dev) { var r = Object.assign({}, s); if (dev !== 'd' && s.o && s.o[dev]) Object.assign(r, s.o[dev]); return r; }
  function adapted(s, dev) { return dev === 'd' || !!(s.o && s.o[dev]); }
  function autoDev(w) { return w >= 1024 ? 'd' : w >= 600 ? 't' : 'm'; }

  /* ---------- documento ---------- */
  var TEMA = { c1: '#111111', c2: '#9aa0a8', c3: '#f5f5f6', bg: '#ffffff', tx: '#111111', fh: 'Cormorant Garamond', fb: 'Montserrat', rad: 0, sp: 70 };
  function norm(doc) {
    doc = doc && typeof doc === 'object' ? doc : {};
    doc.v = 1; doc.tema = Object.assign({}, TEMA, doc.tema || {});
    doc.secs = Array.isArray(doc.secs) ? doc.secs : []; doc.els = Array.isArray(doc.els) ? doc.els : [];
    doc.fuentes = doc.fuentes || []; doc.gn = doc.gn || {};
    doc.secs.forEach(function (s) { s.id = s.id || uid(); });
    doc.els.forEach(function (e) { e.id = e.id || uid(); });
    return doc;
  }
  /* escala geométrica desde escritorio hacia tablet/móvil (punto de partida) */
  function adapt(doc, sid, dev) {
    var s = doc.secs.filter(function (x) { return x.id === sid; })[0]; if (!s || s.t !== 'libre' || dev === 'd') return;
    var Wd = DEV[dev].w, k = Wd / 1280, ky = .4 + .6 * k, cap = Math.round(Wd * .92);
    s.o = s.o || {}; s.o[dev] = { h: Math.round((s.h || 500) * ky) };
    doc.els.forEach(function (e) {
      if (e.sec !== sid) return; e.o = e.o || {};
      var w = e.w || 100, nw = Math.min(w, cap), cx = ((e.x || 0) + w / 2) / 1280 * Wd, a = { w: Math.round(nw), y: Math.round((e.y || 0) * ky) };
      a.x = Math.round(Math.max(0, Math.min(Wd - nw, cx - nw / 2)));
      if (typeof e.h === 'number') a.h = (e.t === 'img' || e.t === 'box') ? Math.round(e.h * nw / w) : e.h;
      if (e.t === 'text' || e.t === 'btn') { a.fs = Math.max(12, Math.round((e.fs || 18) * ky)); if (e.ls) a.ls = +(e.ls * ky).toFixed(1); }
      e.o[dev] = a;
    });
  }
  function defaultDoc() {
    var S = W.SITIO || {}, secs = [], els = [], z = 1;
    function B(t) { var s = { id: uid(), t: t, n: BNAME[t] }; secs.push(s); return s; }
    B('aviso'); B('menu');
    var h = { id: uid(), t: 'libre', n: 'Portada', h: 640, bg: 'g:@bg,#e4e6ea,135', imgs: (S.portada || []).map(function (p) { return 'images/' + p; }), velo: S.velo == null ? .55 : S.velo, o: { t: { h: 580 }, m: { h: 600 } } };
    secs.push(h);
    var cat = B('categorias'); var gal = B('catalogo'); B('opinion'); B('galeria'); B('ventajas'); B('cta'); B('pie');
    function E(t, n, p, ot, om) { var e = Object.assign({ id: uid(), sec: h.id, t: t, n: n, z: z++ }, p); e.o = { t: ot, m: om }; els.push(e); }
    E('text', 'Texto superior', { x: 240, y: 150, w: 800, tx: S.heroSup || 'BOUTIQUE LUXURY VIP', fs: 14, fw: 600, ls: 6, al: 'center', col: '@c2' },
      { x: 60, y: 140, w: 700 }, { x: 20, y: 120, w: 350, fs: 12, ls: 4 });
    E('text', 'Título', { x: 140, y: 195, w: 1000, tx: S.heroTitulo || 'Tu estilo, nuestra pasión', ff: '@fh', fs: 96, fw: 700, lh: 1, al: 'center', col: '@c1' },
      { x: 40, y: 185, w: 740, fs: 76 }, { x: 15, y: 160, w: 360, fs: 52 });
    E('text', 'Descripción', { x: 340, y: 400, w: 600, tx: S.heroTexto || 'Tendencias exclusivas y ropa de calidad para cada ocasión.', fs: 20, lh: 1.5, al: 'center' },
      { x: 160, y: 385, w: 500, fs: 18 }, { x: 30, y: 330, w: 330, fs: 16 });
    E('btn', 'Botón', { x: 540, y: 505, w: 200, h: 52, tx: S.heroBoton || 'Ver novedades', bg: '@c1', col: '@bg', fs: 13, fw: 600, ls: 2, ac: 'ancla', anc: gal.id },
      { x: 310, y: 475, w: 200 }, { x: 95, y: 440, w: 200 });
    return norm({ tema: Object.assign({}, TEMA), secs: secs, els: els, t: 0 });
  }

  /* ---------- fuentes ---------- */
  function ensureFonts(doc) {
    var used = { 'Pinyon Script': 1 }, t = doc.tema;
    [t.fh, t.fb].forEach(function (f) { used[f] = 1; });
    doc.els.forEach(function (e) { [e.ff].concat(e.o ? [e.o.t && e.o.t.ff, e.o.m && e.o.m.ff] : []).forEach(function (f) { if (f) used[f] = 1; }); });
    var fam = Object.keys(used).filter(function (f) { return PMAP[f]; }).map(function (f) { return 'family=' + PMAP[f][1]; });
    var h = document.head, l = document.getElementById('pg-gf'), href = 'https://fonts.googleapis.com/css2?' + fam.join('&') + '&display=swap';
    if (!l) { l = document.createElement('link'); l.id = 'pg-gf'; l.rel = 'stylesheet'; h.appendChild(l); }
    if (l.getAttribute('href') !== href) l.setAttribute('href', href);
    var st = document.getElementById('pg-ff');
    if (!st) { st = document.createElement('style'); st.id = 'pg-ff'; h.appendChild(st); }
    var css = doc.fuentes.map(function (f) { return "@font-face{font-family:'" + f.n + "';src:url('" + PG.asset(f.f) + "');font-display:swap}"; }).join('');
    if (st.textContent !== css) st.textContent = css;
  }
  function applyTheme(m, t) {
    var s = m.style, ff = function (v) { return fontCss(v); };
    s.setProperty('--c1', t.c1); s.setProperty('--c2', t.c2); s.setProperty('--c3', t.c3); s.setProperty('--bg', t.bg); s.setProperty('--tx', t.tx);
    s.setProperty('--plata-claro', mix(t.c2, '#ffffff', .55)); s.setProperty('--plata-oscuro', mix(t.c2, '#000000', .4)); s.setProperty('--linea', mix(t.bg, t.tx, .12));
    s.setProperty('--fh', ff(t.fh)); s.setProperty('--fb', ff(t.fb)); s.setProperty('--rad', (t.rad || 0) + 'px'); s.setProperty('--sp', (t.sp == null ? 70 : t.sp) + 'px');
    s.background = 'var(--bg)';
  }
  PG.fontNames = function (doc) { return PRESET.map(function (p) { return p[0]; }).concat((doc.fuentes || []).map(function (f) { return f.n; })); };

  /* ---------- animaciones ---------- */
  var LOOP = { float: 1, pulse: 1, spin: 1, wiggle: 1 }, DIRV = { bottom: [0, 1], top: [0, -1], left: [-1, 0], right: [1, 0] };
  PG.LOOP = LOOP;
  PG.ANIMS = [['', 'Ninguna'], ['fade', 'Fundido'], ['slide', 'Deslizar'], ['slidefade', 'Deslizar + fundido'], ['bounce', 'Rebote'], ['scale', 'Crecer'], ['zoomin', 'Zoom desde grande'], ['pop', 'Pop (rebote de escala)'], ['rotate', 'Girar'],
    ['flip', 'Giro 3D vertical'], ['flipx', 'Giro 3D horizontal'], ['blur', 'Desenfoque a nítido'], ['wipe', 'Revelar (cortina)'], ['skew', 'Deslizar inclinado'],
    ['float', 'Flotar (continua)'], ['pulse', 'Latido (continua)'], ['spin', 'Girar sin parar (continua)'], ['wiggle', 'Balanceo (continua)']];
  function kfs(a, op) {
    var o = op == null ? 1 : op, d = a.dist == null ? 60 : a.dist, v = DIRV[a.dir || 'bottom'] || DIRV.bottom, x = v[0] * d, y = v[1] * d, T = 'translate(' + x + 'px,' + y + 'px)', end = { transform: 'none', opacity: o };
    switch (a.t) {
      case 'fade': return [{ opacity: 0 }, { opacity: o }];
      case 'slide': return [{ transform: T }, { transform: 'none' }];
      case 'slidefade': return [{ transform: T, opacity: 0 }, end];
      case 'bounce': return [{ transform: T, opacity: 0 }, { transform: 'translate(' + (-x * .12) + 'px,' + (-y * .12) + 'px)', opacity: o, offset: .55 }, { transform: 'translate(' + (x * .05) + 'px,' + (y * .05) + 'px)', offset: .75 }, { transform: 'translate(' + (-x * .02) + 'px,' + (-y * .02) + 'px)', offset: .9 }, end];
      case 'scale': return [{ transform: 'scale(.4)', opacity: 0 }, end];
      case 'zoomin': return [{ transform: 'scale(1.7)', opacity: 0 }, end];
      case 'pop': return [{ transform: 'scale(.3)', opacity: 0 }, { transform: 'scale(1.12)', opacity: o, offset: .6 }, end];
      case 'rotate': return [{ transform: 'rotate(-180deg) scale(.5)', opacity: 0 }, end];
      case 'flip': return [{ transform: 'perspective(900px) rotateY(90deg)', opacity: 0 }, end];
      case 'flipx': return [{ transform: 'perspective(900px) rotateX(90deg)', opacity: 0 }, end];
      case 'blur': return [{ filter: 'blur(16px)', opacity: 0 }, { filter: 'blur(0px)', opacity: o }];
      case 'wipe': return [{ clipPath: { bottom: 'inset(100% 0 0 0)', top: 'inset(0 0 100% 0)', left: 'inset(0 100% 0 0)', right: 'inset(0 0 0 100%)' }[a.dir || 'bottom'] }, { clipPath: 'inset(0 0 0 0)' }];
      case 'skew': return [{ transform: T + ' skewX(-20deg)', opacity: 0 }, end];
      case 'float': return [{ transform: 'translateY(0)' }, { transform: 'translateY(-14px)' }, { transform: 'translateY(0)' }];
      case 'pulse': return [{ transform: 'scale(1)' }, { transform: 'scale(1.08)' }, { transform: 'scale(1)' }];
      case 'spin': return [{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }];
      case 'wiggle': return [{ transform: 'rotate(-4deg)' }, { transform: 'rotate(4deg)' }, { transform: 'rotate(-4deg)' }];
    }
    return null;
  }
  function mkAnim(target, a, fill, extra) {
    var k = kfs(a, extra && extra.op); if (!k) return null; var lp = !!LOOP[a.t];
    var an = target.animate(k, { duration: Math.max(50, (a.dur == null ? (lp ? 3 : .8) : a.dur) * 1000), delay: ((a.del || 0) + ((extra && extra.stag) || 0)) * 1000, easing: a.ease || (a.t === 'spin' ? 'linear' : lp ? 'ease-in-out' : 'ease-out'),
      iterations: lp ? (a.rep ? a.rep : Infinity) : (a.rep === 0 ? Infinity : (a.rep || 1)), fill: fill || 'both' });
    an.playbackRate = a.vel || 1; return an;
  }
  PG.playAnim = function (node, a, extra) {
    if (!node || !a) return; var t = node.classList && node.classList.contains('el') ? node.firstChild : node;
    t.getAnimations().forEach(function (x) { x.cancel(); }); mkAnim(t, a, 'none', extra);
  };
  PG.playPiece = function (ctx, sid, k, a, op) {
    var n = ctx.sec[sid]; if (!n || !a) return; var i = 0; n.querySelectorAll('[data-k="' + k + '"]').forEach(function (el) { PG.playAnim(el, a, { op: op, stag: i++ * (a.stag || 0) }); });
  };
  /* arma la animación según el disparador: al aparecer (por defecto), al cargar o al pasar el mouse */
  function armAnim(ctx, node, target, a, extra) {
    if (W.matchMedia && matchMedia('(prefers-reduced-motion:reduce)').matches) return;
    var an = mkAnim(target, a, 'both', extra); if (!an) return; node._an = an;
    if (a.trig === 'load') return;
    if (a.trig === 'hover') { an.cancel(); node._an = null; node.onmouseenter = function () { target.getAnimations().forEach(function (x) { x.cancel(); }); mkAnim(target, a, 'none', extra); }; return; }
    an.pause(); if (ctx.io) { /* 'revelar' recorta el elemento a 0: se observa su contenedor para que sí se dispare */ var ob = a.t === 'wipe' && node === target && node.parentElement ? node.parentElement : node, l = ctx.pend.get(ob) || []; l.push(an); ctx.pend.set(ob, l); ctx.io.observe(ob); }
  }

  /* ---------- elementos ---------- */
  function waUrl(m) { return 'https://wa.me/' + ((W.SITIO || {}).whatsapp || '') + '?text=' + encodeURIComponent(m || 'Hola, quiero información'); }
  function buildEl(ctx, el) {
    var n = document.createElement('div'); n.className = 'el t-' + el.t; n.dataset.id = el.id;
    var inn = document.createElement((el.t === 'btn' || el.t === 'img') && !ctx.edit ? 'a' : 'div'); inn.className = 'in'; n.appendChild(inn);
    ctx.el[el.id] = n; paintEl(ctx, el); return n;
  }
  function paintEl(ctx, el) {
    var n = ctx.el[el.id]; if (!n) return; var r = res(el, ctx.dev), st = n.style, inn = n.firstChild, is = inn.style;
    st.left = (r.x || 0) + 'px'; st.top = (r.y || 0) + 'px'; st.width = (r.w == null ? 200 : r.w) + 'px';
    var auto = r.h == null || r.h === 'auto'; st.height = auto ? 'auto' : r.h + 'px'; n.dataset.auto = auto ? 1 : 0;
    st.zIndex = r.z || 1; st.opacity = r.op == null ? 1 : r.op;
    var tr = ''; if (r.tz || ctx.d3) tr += 'translateZ(calc(' + (r.tz || 0) + 'px + var(--zz,0px))) ';
    if (r.rx) tr += 'rotateX(' + r.rx + 'deg) '; if (r.ry) tr += 'rotateY(' + r.ry + 'deg) ';
    if (r.r) tr += 'rotate(' + r.r + 'deg) '; if (r.sc != null && r.sc !== 1) tr += 'scale(' + r.sc + ')';
    st.transform = tr.trim() || 'none'; if (ctx.d3) st.setProperty('--zz', (r.z || 1) * 14 + 'px'); else st.removeProperty('--zz');
    n.classList.toggle('hid', !!r.hide);
    var bd = function () { is.border = r.bw ? r.bw + 'px ' + (r.bs || 'solid') + ' ' + tok(r.bc || '@tx') : '0'; is.borderRadius = (r.rad || 0) + 'px'; is.boxShadow = shCss(r.sh); };
    if (el.t === 'text' || el.t === 'btn') {
      is.fontFamily = fontCss(r.ff); is.fontSize = (r.fs || 18) + 'px'; is.fontWeight = r.fw || 400; is.fontStyle = r.it ? 'italic' : 'normal';
      is.textDecoration = r.ul ? 'underline' : 'none'; is.color = tok(r.col || '@tx'); is.letterSpacing = (r.ls || 0) + 'px'; is.lineHeight = r.lh || 1.3;
    }
    if (el.t === 'text') { if (inn.textContent !== (r.tx || '')) inn.textContent = r.tx == null ? '' : r.tx; is.textAlign = r.al || 'left'; is.textShadow = tshCss(r.tsh); is.height = auto ? 'auto' : '100%'; }
    else if (el.t === 'btn') {
      if (inn.textContent !== (r.tx || '')) inn.textContent = r.tx == null ? '' : r.tx;
      is.background = fillCss(r.bg || '@c1'); bd(); is.height = auto ? 'auto' : '100%'; if (auto) is.minHeight = '44px'; else is.minHeight = '';
      if (!ctx.edit) setAction(inn, r);
    } else if (el.t === 'box') { is.background = fillCss(r.bg || '@c3'); bd(); is.height = auto ? '100%' : '100%'; }
    else if (el.t === 'img') {
      if (!ctx.edit) setAction(inn, r); else if (r.ac && r.ac !== 'none') n.setAttribute('data-link', '1'); else n.removeAttribute('data-link');
      var src = r.src || (r.logo && (W.SITIO || {}).logo ? 'images/' + W.SITIO.logo : ''), im = inn.querySelector('img'), ph = inn.querySelector('.ph');
      bd(); is.height = '100%'; is.display = (!src && !ctx.edit) ? 'none' : '';
      if (src) { if (!im) { im = document.createElement('img'); im.alt = r.n || ''; inn.insertBefore(im, inn.firstChild); } var u = PG.asset(src); if (im.getAttribute('src') !== u) im.setAttribute('src', u);
        im.style.objectFit = r.fit || 'cover'; im.style.objectPosition = (r.cx == null ? 50 : r.cx) + '% ' + (r.cy == null ? 50 : r.cy) + '%'; im.style.transformOrigin = (r.cx == null ? 50 : r.cx) + '% ' + (r.cy == null ? 50 : r.cy) + '%';
        im.style.transform = r.cz && r.cz !== 1 ? 'scale(' + r.cz + ')' : ''; im.style.filter = fltCss(r.fl); if (ph) ph.remove(); }
      else { if (im) im.remove(); if (ctx.edit && !ph) { ph = document.createElement('div'); ph.className = 'ph'; ph.textContent = r.logo ? 'Logo · doble clic para subir' : 'Imagen · doble clic para subir'; inn.appendChild(ph); } }
    }
  }
  function setAction(inn, r) {
    var ac = r.ac || 'none', h = r.href && !/^(https?:|mailto:|tel:|#)/i.test(r.href) && /\./.test(r.href) ? 'https://' + r.href : r.href;
    if (ac === 'url' && h) inn.href = h, inn.target = /^https?:/i.test(h) ? '_blank' : '', inn.rel = 'noopener';
    else if (ac === 'wa') inn.href = waUrl(r.msg), inn.target = '_blank', inn.rel = 'noopener';
    else if (ac === 'ancla' && r.anc) inn.href = '#s_' + r.anc; else inn.removeAttribute('href');
  }
  function setupAnim(ctx, n, el) { var a = el.an; if (!a || !a.t || ctx.edit) return; armAnim(ctx, n, n.firstChild, a, null); }

  /* ---------- secciones ---------- */
  function paintBg(ctx, s, node) {
    var bg = node.querySelector(':scope>.sbg'), imgs = (s.imgs || []).filter(Boolean), key = imgs.join('|') + '|' + (s.fit || 'cover') + '|' + (s.velo || 0) + '|' + (s.vc || '');
    bg.style.background = s.bg ? fillCss(s.bg) : '';
    if (node._bk !== key) {
      node._bk = key; bg.innerHTML = imgs.map(function (p, i) { return '<img alt="" src="' + esc(PG.asset(p)) + '" style="object-fit:' + (s.fit || 'cover') + '" class="' + (i ? '' : 'on') + '">'; }).join('') +
        (imgs.length ? '<div class="velo" style="background:' + fillCss(s.vc || '@bg') + ';opacity:' + (s.velo == null ? .5 : s.velo) + '"></div>' : '');
      if (imgs.length > 1 && !ctx.edit) { var k = 0, im = bg.querySelectorAll('img'); ctx.timers.push(setInterval(function () { im[k].classList.remove('on'); k = (k + 1) % im.length; im[k].classList.add('on'); }, 5000)); }
    }
  }
  var BLK = { categorias: 1, catalogo: 1, opinion: 1, galeria: 1, ventajas: 1, cta: 1 };
  function K(k, n, t, single, extra) { return ' data-k="' + k + '" data-n="' + n + '" data-t="' + t + '"' + (single ? ' data-s="1"' : '') + (extra || ''); }
  function html(t) {
    var S = W.SITIO || {}, wa = function (m) { return waUrl(m); }, cats = S.categorias || [];
    switch (t) {
      case 'aviso': return '<span class="av"' + K('av', 'Texto del aviso', 'text', 1) + '>' + esc((S.avisos || [''])[0]) + '</span>';
      case 'menu': return '<a class="logo' + (S.logo ? '' : ' plata') + '" href="#"' + K('logo', 'Logo', 'logo', 0, S.logo ? '' : ' data-plata="1"') + '>' + (S.logo ? '<img data-p="images/' + esc(S.logo) + '" src="' + esc(PG.asset('images/' + S.logo)) + '" alt="' + esc(S.nombre) + '">' : esc(S.nombre)) + '</a><nav><a href="#novedades"' + K('n1', 'Enlace Novedades', 'text', 1) + '>Novedades</a><a href="#categorias"' + K('n2', 'Enlace Categorías', 'text', 1) + '>Categorías</a><a href="#contacto"' + K('n3', 'Enlace Contacto', 'text', 1) + '>Contacto</a><a class="btn" target="_blank" rel="noopener" href="' + wa('Hola, quiero información') + '"' + K('wa', 'Cuadro WhatsApp', 'btn') + '><span' + K('wal', 'Texto WhatsApp', 'text', 1) + '>WhatsApp</span></a></nav>';
      case 'categorias': return '<i id="categorias" style="display:block;height:0;scroll-margin-top:70px"></i><h2 class="tit"' + K('tit', 'Título', 'text', 1) + '>Compra por categoría</h2><div class="linea"' + K('linea', 'Línea decorativa', 'line') + '></div><div class="cats">' + cats.map(function (c) { return '<button data-c="' + esc(c) + '" aria-pressed="' + (c === filtro) + '"' + K('cb', 'Cuadro de categoría', 'btn') + '><span' + K('cbl', 'Texto de categoría', 'text') + '>' + esc(c) + '</span></button>'; }).join('') + '</div>';
      case 'catalogo': return '<i id="novedades" style="display:block;height:0;scroll-margin-top:70px"></i><h2 class="tit cat-t"' + K('tit', 'Título', 'text', 1) + '></h2><div class="linea"' + K('linea', 'Línea decorativa', 'line') + '></div><div class="grid cat-g"></div>';
      case 'opinion': return '<blockquote' + K('q', 'Frase', 'text', 1) + '>“' + esc(S.opinion) + '”</blockquote><div class="est"' + K('est', 'Estrellas', 'text', 1) + '>★★★★★</div><p' + K('au', 'Autora', 'text', 1) + '>' + esc(S.opinionAutor) + '</p>';
      case 'galeria': var g = S.galeria || [], n = g.length || 6; return '<h2 class="tit"' + K('tit', 'Título', 'text', 1) + '>Síguenos en Instagram</h2><div class="linea"' + K('linea', 'Línea decorativa', 'line') + '></div><div class="galeria">' + Array.apply(null, Array(n)).map(function (_, i) { return '<div' + K('gi', 'Fotos de la galería', 'card') + '>' + (g[i] ? '<img data-p="images/' + esc(g[i]) + '" src="' + esc(PG.asset('images/' + g[i])) + '" alt="">' : '') + '</div>'; }).join('') + '</div>';
      case 'ventajas': return '<div class="ventajas">' + (S.ventajas || []).map(function (v) { return '<div>' + (ICONOS[v.icono] || '').replace('<svg', '<svg' + K('vi', 'Íconos', 'icon')) + '<h3' + K('vt', 'Títulos', 'text') + '>' + esc(v.titulo) + '</h3><p' + K('vx', 'Descripciones', 'text') + '>' + esc(v.texto) + '</p></div>'; }).join('') + '</div>';
      case 'cta': return '<h2' + K('tit', 'Título', 'text', 1) + '>¿Te gustó algo? Pídelo por WhatsApp</h2><a class="btn claro" target="_blank" rel="noopener" href="' + wa('Hola, quiero hacer un pedido') + '"' + K('btn', 'Cuadro del botón', 'btn') + '><span' + K('ctl', 'Texto del botón', 'text', 1) + '>Escríbenos</span></a>';
      case 'pie': return '<i id="contacto" style="display:block;height:0"></i><div><h3' + K('ph', 'Encabezados', 'text') + '>' + esc(S.nombre) + '</h3><p' + K('pl', 'Textos y enlaces', 'text') + '>' + esc(S.direccion) + '</p><p' + K('pl', 'Textos y enlaces', 'text') + '>' + esc(S.horario) + '</p><p' + K('pl', 'Textos y enlaces', 'text') + '>' + esc(S.telefono) + '</p></div><div><h3' + K('ph', 'Encabezados', 'text') + '>Tienda</h3>' + cats.map(function (c) { return '<a href="#novedades"' + K('pl', 'Textos y enlaces', 'text') + '>' + esc(c) + '</a>'; }).join('') + '</div><div><h3' + K('ph', 'Encabezados', 'text') + '>Síguenos</h3>' + (S.redes || []).map(function (r) { return '<a href="' + esc(r.url) + '" target="_blank" rel="noopener"' + K('pl', 'Textos y enlaces', 'text') + '>' + esc(r.nombre) + '</a>'; }).join('') + '</div><div class="copy"' + K('copy', 'Derechos', 'text', 1) + '>' + esc(S.pie) + '</div>';
    }
    return '';
  }
  /* ---------- tallas y pedido por WhatsApp ---------- */
  var TALLAS = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '0', '1', '3', '5', '7', '9', '11', '13', '15', 'Única'];
  function tallasDe(p) {
    if (Array.isArray(p.tallasDisp)) return p.tallasDisp.filter(Boolean);
    return String(p.tallas || '').replace(/[–—-]/g, ' ').split(/[\s,\/]+/).map(function (x) { return x.trim(); }).filter(function (x) { return x && !/^tallas?:?$/i.test(x); }).map(function (x) { return /^[uú]nica$/i.test(x) ? 'Única' : x; });
  }
  function slug(t) { return String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
  /* identificador estable de la prenda (si no tiene id: nombre + número cuando hay nombres repetidos) */
  function pid(p) {
    if (p.id) return p.id; var all = (W.SITIO || {}).productos || [], sl = slug(p.nombre) || 'prenda', k = 0;
    for (var i = 0; i < all.length && all[i] !== p; i++) if (!all[i].id && (slug(all[i].nombre) || 'prenda') === sl) k++;
    return sl + (k ? '-' + (k + 1) : '');
  }
  function prodLink(p, talla) { var o = /^https?:/.test(location.origin) ? location.origin : ''; return o + '/p/' + encodeURIComponent(pid(p)) + (talla ? '?t=' + encodeURIComponent(talla) : ''); }
  function precioL(v) { return 'L ' + Number(v || 0).toLocaleString('es-HN'); }
  function pedido(p, talla) {
    return '🛍️ *PEDIDO*\n\n*Detalles del producto:*\n\n• *' + p.nombre + '*\n' + (talla ? 'Talla: ' + talla + ' | ' : '') + 'Cantidad: 1\nPrecio: ' + precioL(p.precio) + '\n\n¿Está disponible?';
  }
  PG.TALLAS = TALLAS; PG.tallasDe = tallasDe; PG.pid = pid; PG.slug = slug;
  /* cuadrícula del catálogo: columnas × filas por dispositivo, forma de foto y espacio */
  var CGDEF = { d: { c: 4, f: 0 }, t: { c: 3, f: 0 }, m: { c: 2, f: 0 } };
  function catCfg(s, dev) { var g = s.cg || {}, o = Object.assign({}, CGDEF[dev] || CGDEF.d, g[dev] || {}); o.ar = g.ar || '4/5'; o.gap = g.gap == null ? (dev === 'm' ? 12 : 24) : g.gap; o.w = g.w || 100; o.al = g.al || 'center'; o.card = g.card == null ? '1' : String(g.card); o.s = g.s || 100; o.tb = g.tb == null ? '1' : String(g.tb); o.tm = g.tm || 'chico'; o.eq = g.eq == null ? '1' : String(g.eq); o.est = g.est || 'capas'; o.wab = g.wab == null ? (o.est === 'moderno' ? '0' : '1') : String(g.wab); o.tbc = g.tbc || '#9aa0a8'; o.tbo = g.tbo == null ? 22 : g.tbo; return o; }
  function applyCat(b, s, dev) {
    var g = b.querySelector('.cat-g'); if (!g) return; var c = catCfg(s, dev), cols = Math.max(1, Math.min(8, c.c | 0));
    g.style.gridTemplateColumns = 'repeat(' + cols + ',minmax(0,1fr))'; g.style.gap = c.gap + 'px'; g.style.maxWidth = c.w + '%';
    g.style.marginLeft = c.al === 'left' ? '0' : 'auto'; g.style.marginRight = c.al === 'right' ? '0' : 'auto';
    g.style.setProperty('--cat-ar', c.ar); g.style.setProperty('--cat-s', c.s / 100); g.dataset.cols = cols; g.dataset.card = c.card; g.dataset.tb = c.tb; g.dataset.tm = c.tm; g.dataset.est = c.est; g.dataset.wab = c.est === 'capas' ? (g.dataset.wab || '0') : c.wab; g.style.alignItems = c.eq === '0' ? 'start' : ''; g.style.setProperty('--cat-tb', 'color-mix(in srgb, ' + tok(c.tbc) + ' ' + c.tbo + '%, transparent)');
    var lim = c.f > 0 ? cols * c.f : 1e9; Array.prototype.forEach.call(g.children, function (a, i) { a.style.display = i < lim ? '' : 'none'; });
  }
  PG.catCfg = catCfg;
  /* prendas que muestra cada catálogo: todas, una categoría o una selección propia */
  function prendasDe(s) {
    var all = (W.SITIO || {}).productos || [], m = (s && s.pm) || 'todas';
    if (m === 'cat') return all.filter(function (p) { return p.cat === s.pc; });
    if (m === 'sel') return (s.ps || []).map(function (id) { return all.filter(function (p) { return pid(p) === id; })[0]; }).filter(Boolean);
    return all.filter(function (p) { return filtro === 'Todo' || p.cat === filtro; });
  }
  PG.prendasDe = prendasDe;
  function fillOne(b, ctx, s) {
    var S = W.SITIO || {}, L = precioL, libre = !s || !s.pm || s.pm === 'todas';
    var t = b.querySelector('.cat-t'), tx = libre && filtro !== 'Todo' ? filtro : (s && s.pm === 'cat' && s.pc ? s.pc : (S.tituloProductos || 'Novedades')); t.dataset.o = tx; t.textContent = tx;
    var lista = prendasDe(s), chico = !!(s && ctx && catCfg(s, ctx.dev).tm === 'chico');
    var capas = s && ctx && catCfg(s, ctx.dev).est === 'capas', tpl = capas && tplDe(ctx);
    if (capas) {
      var g0 = b.querySelector('.cat-g'); g0.innerHTML = lista.length ? lista.map(function (p) { return tarjetaHTML(p, tpl); }).join('') : (ctx.edit ? '<p class="cat-vacio">Este catálogo no tiene prendas.</p>' : '');
      applyCat(b, s, ctx.dev); var pd = tpl.capas.filter(function (c) { return c.t === 'pedir'; })[0]; g0.dataset.wab = pd && !pd.hid ? '1' : '0';
      requestAnimationFrame(function () { ajustarTextos(g0); }); return;
    }
    b.querySelector('.cat-g').innerHTML = lista.length ? lista.map(function (p) {
      var f = p.foto ? '<img data-p="images/' + esc(p.foto) + '" src="' + esc(PG.asset('images/' + p.foto)) + '" alt="' + esc(p.nombre) + '" loading="lazy">' : '<span class="plata">' + esc(p.nombre.charAt(0)) + '</span>';
      var ts = tallasDe(p), uno = ts.length === 1 ? ts[0] : '';
      var tz = ts.length ? '<div class="tallas tb"' + K('pt', 'Tallas', 'text') + '><button type="button" class="tl-btn"' + K('tbt', 'Botón de tallas', 'btn') + '><span class="tl-v"' + K('tbl', 'Texto de tallas', 'text', !uno) + '>' + (uno ? 'Talla: ' + esc(uno) : (chico ? 'Talla' : 'Elegir talla')) + '</span><i>▾</i></button><div class="tl-pop"><span class="tl-l"' + K('tpl', 'Título del cuadro de tallas', 'text', 1) + '>Elige tu talla</span><span class="tl-g">' + ts.map(function (t) { return '<button type="button" class="tl' + (t === uno ? ' on' : '') + '" data-t="' + esc(t) + '"' + K('tc', 'Opciones de talla', 'btn') + '>' + esc(t) + '</button>'; }).join('') + '</span></div></div>' : '';
      return '<article class="prod" data-pid="' + esc(pid(p)) + '"' + K('pcard', 'Cuadro de la prenda', 'card') + (uno ? ' data-talla="' + esc(uno) + '"' : '') + '><div class="foto"' + K('pc', 'Foto de la prenda', 'card') + '>' + f + '</div><div class="det"><h3 class="tb"' + K('pn', 'Nombre de prenda', 'text') + '>' + esc(p.nombre) + '</h3><span class="precio tb"' + K('pp', 'Precio', 'text') + '><i class="pl">Precio</i>' + L(p.precio) + '</span>' + tz + '<a class="btn btn-pedir" target="_blank" rel="noopener" href="' + esc(waUrl(pedido(p, uno))) + '"' + K('pb', 'Cuadro pedir', 'btn') + '><span' + K('pbl', 'Texto pedir', 'text') + '>Pedir por WhatsApp</span></a><span class="tl-msg">Primero elige tu talla 👆</span></div></article>';
    }).join('') : (ctx && ctx.edit ? '<p class="cat-vacio">Este catálogo no tiene prendas. Elígelas en el panel derecho → "Prendas de este catálogo".</p>' : '');
    if (ctx && s) { paintKs(ctx, b, s); applyCat(b, s, ctx.dev); }
  }
  /* ================= TARJETA POR CAPAS =================
     Un solo diseño (doc.tarjeta) para todas las prendas de todos los catálogos.
     Cada capa se ubica en % de la tarjeta y el texto en "cqw" (1 = 1% del ancho de la tarjeta),
     así la tarjeta se ve idéntica en cualquier tamaño. */
  function CARRITO_DEF() { return { id: 'carrito', t: 'carrito', n: 'Botón carrito', x: 80, y: 3, w: 15, h: 8.1, bg: '#ffffff', rad: 7.5, sh: 'suave', col: '#111111', fs: 4, fw: 700, al: 'c', va: 'c', ff: '@fb' }; }
  var TPL_DEF = { v: 3, ar: 2.05, capas: [
    { id: 'fondo', t: 'fondo', n: 'Fondo de la tarjeta', x: 0, y: 0, w: 100, h: 100, bg: '#ffffff', rad: 7, bw: 1, bc: '#ececec', sh: 'suave' },
    { id: 'foto', t: 'foto', n: 'Foto', x: 2, y: 1.1, w: 96, h: 65, rad: 5.5, fy: 20 },
    { id: 'nombre', t: 'nombre', n: 'Nombre', x: 7, y: 68.2, w: 86, h: 9, fs: 7, fw: 400, col: '#111111', lines: 2, ff: '@fb' },
    { id: 'talla', t: 'talla', n: 'Talla', x: 7, y: 80.6, w: 40, h: 5.9, fs: 4.4, fw: 500, col: '#111111', ls: .12, up: 1, op: .75, va: 'c', ff: '@fb' },
    { id: 'precio', t: 'precio', n: 'Precio', x: 40, y: 78.9, w: 53, h: 8.6, fs: 10, fw: 800, col: '#111111', al: 'r', va: 'c', lab: 1, labt: 'Precio', ff: '@fb' },
    { id: 'pedir', t: 'pedir', n: 'Botón pedir', x: 5, y: 89.5, w: 90, h: 7.6, fs: 4.2, fw: 700, col: '#ffffff', bg: '#111111', rad: 2.5, al: 'c', va: 'c', tx: 'Pedir por WhatsApp', up: 1, ls: .06, ff: '@fb' },
    CARRITO_DEF()
  ] };
  /* diseño inicial anterior (foto más baja): si nadie lo modificó, se usa el nuevo */
  var TPL_V1 = '[{"id":"fondo","t":"fondo","n":"Fondo de la tarjeta","x":0,"y":0,"w":100,"h":100,"bg":"#ffffff","rad":7,"bw":1,"bc":"#ececec","sh":"suave"},{"id":"foto","t":"foto","n":"Foto","x":2,"y":1.4,"w":96,"h":63,"rad":5.5}';
  PG.TPL_DEF = TPL_DEF;
  var BOLSA = '<svg class="bolsa" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 8h14l-1.2 12.2a1 1 0 0 1-1 .8H7.2a1 1 0 0 1-1-.8z"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8"/><path d="M12 12v4M10 14h4"/></svg>';
  var AVISO_TALLA = '<span class="tl-aviso"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16.5v.01"/></svg>Selecciona tu talla para ordenar</span>';
  var SOMBRAS = { suave: '0 3cqw 7cqw rgba(0,0,0,.10)', media: '0 3cqw 9cqw rgba(0,0,0,.18)', fuerte: '0 4cqw 12cqw rgba(0,0,0,.30)' };
  function tplOk(t) {
    if (!t || !Array.isArray(t.capas) || !t.capas.length) return TPL_DEF; if (!t.v && t.ar === 1.48 && JSON.stringify(t.capas).indexOf(TPL_V1) === 0) return TPL_DEF;
    if (!t.capas.some(function (c) { return c.t === 'carrito'; })) { t = JSON.parse(JSON.stringify(t)); t.capas.push(CARRITO_DEF()); }
    /* v3: el botón "Pedir por WhatsApp" vuelve a ser visible (tocar la foto ya no abre WhatsApp).
       Si estaba oculto, se agranda la tarjeta hacia abajo y el botón se pone debajo, sin mover lo demás. */
    var pd = t.capas.filter(function (c) { return c.t === 'pedir'; })[0];
    if ((t.v || 0) < 3 && (!pd || pd.hid)) {
      t = JSON.parse(JSON.stringify(t)); var k = 1.11, ar = t.ar || 1.48; t.ar = Math.round(ar * k * 100) / 100; t.v = 3;
      t.capas.forEach(function (c) { if (c.t === 'fondo') return; c.y = Math.round(c.y / k * 10) / 10; c.h = Math.round(c.h / k * 10) / 10; });
      pd = t.capas.filter(function (c) { return c.t === 'pedir'; })[0];
      if (!pd) { pd = JSON.parse(JSON.stringify(TPL_DEF.capas.filter(function (c) { return c.t === 'pedir'; })[0])); t.capas.splice(t.capas.length - 1, 0, pd); }
      delete pd.hid; pd.x = 5; pd.w = 90; pd.y = Math.round((100 / k + 0.8) * 10) / 10; pd.h = Math.round((100 - pd.y - 2.2) * 10) / 10;
    }
    return t;
  }
  function tplDe(ctx) { return tplOk(ctx && ctx.doc && ctx.doc.tarjeta); }
  PG.tplDe = function (doc) { return tplOk(doc && doc.tarjeta); };
  function capaCss(L, z) {
    var c = ['left:' + (L.x || 0) + '%', 'top:' + (L.y || 0) + '%', 'width:' + (L.w || 10) + '%', 'height:' + (L.h || 10) + '%', 'z-index:' + z];
    if (L.hid) c.push('display:none'); if (L.op != null && L.op !== 1) c.push('opacity:' + L.op);
    if (L.bg) c.push('background:' + fillCss(L.bg)); if (L.bw) c.push('border:' + (L.bw) + 'px solid ' + tok(L.bc || '#000000'));
    if (L.rad) c.push('border-radius:' + L.rad + 'cqw'); if (L.sh && SOMBRAS[L.sh]) c.push('box-shadow:' + SOMBRAS[L.sh]);
    if (L.fs) c.push('font-size:' + L.fs + 'cqw'); if (L.fw) c.push('font-weight:' + L.fw); if (L.ff) c.push('font-family:' + fontCss(L.ff));
    if (L.col) c.push('color:' + tok(L.col)); if (L.ls) c.push('letter-spacing:' + L.ls + 'em'); if (L.up) c.push('text-transform:uppercase'); if (L.it) c.push('font-style:italic');
    if (L.pad) c.push('padding:' + L.pad + 'cqw');
    if (L.rot) c.push('transform:rotate(' + L.rot + 'deg)');
    var al = L.al === 'c' ? 'center' : L.al === 'r' ? 'flex-end' : 'flex-start', va = L.va === 'c' ? 'center' : L.va === 'b' ? 'flex-end' : 'flex-start';
    c.push('justify-content:' + al, 'align-items:' + va, 'text-align:' + (L.al === 'c' ? 'center' : L.al === 'r' ? 'right' : 'left'));
    return c.join(';');
  }
  PG.capaCss = capaCss;
  function tarjetaHTML(p, tpl, o) {
    o = o || {}; var ts = tallasDe(p), capas = tpl.capas, talla = capas.filter(function (c) { return c.t === 'talla'; })[0];
    if (!talla || talla.hid) ts = [];
    var uno = '';
    var h = capas.map(function (L, i) {
      var st = capaCss(L, i + 1), a = ' data-capa="' + esc(L.id) + '"';
      switch (L.t) {
        case 'foto': return '<div class="ly ly-foto"' + a + ' style="' + st + '">' + (p.foto ? '<img src="' + esc(PG.asset('images/' + p.foto)) + '" alt="' + esc(p.nombre) + '" loading="lazy" style="object-fit:' + (L.fit || 'cover') + ';object-position:50% ' + (L.fy == null ? 20 : L.fy) + '%">' : '<span class="plata">' + esc((p.nombre || '?').charAt(0)) + '</span>') + '</div>';
        case 'nombre': return '<h3 class="ly ly-nombre"' + a + ' style="' + st + '"><span class="lc" style="-webkit-line-clamp:' + (L.lines || 2) + '">' + esc(p.nombre) + '</span></h3>';
        case 'precio': return '<div class="ly ly-precio" data-fit="1"' + a + ' style="' + st + '"><span class="fitw">' + (L.lab ? '<i class="pl">' + esc(L.labt || 'Precio') + '</i>' : '') + precioL(p.precio) + '</span></div>';
        case 'talla': return ts.length ? '<div class="ly ly-talla tallas"' + a + ' style="' + st + '"><button type="button" class="tl-btn"><span class="tl-v">' + (uno ? 'Talla: ' + esc(uno) : esc(L.tx || 'Talla')) + '</span><i>▾</i></button><div class="tl-pop"><span class="tl-l">Elige tu talla</span><span class="tl-g">' + ts.map(function (t) { return '<button type="button" class="tl' + (t === uno ? ' on' : '') + '" data-t="' + esc(t) + '">' + esc(t) + '</button>'; }).join('') + '</span>' + AVISO_TALLA + '</div><span class="tl-msg">Selecciona talla para ordenar</span></div>' : '';
        case 'pedir': return '<a class="ly ly-pedir btn-pedir" target="_blank" rel="noopener" href="' + esc(waUrl(pedido(p, uno))) + '"' + a + ' style="' + st + '"><span>' + esc(L.tx || 'Pedir por WhatsApp') + '</span></a>';
        case 'carrito': return '<button type="button" class="ly ly-carrito" title="Agregar al carrito"' + a + ' style="' + st + '">' + BOLSA + (L.tx ? '<span class="ctx">' + esc(L.tx) + '</span>' : '') + '</button>';
        case 'texto': return '<div class="ly ly-texto"' + a + ' style="' + st + '"><span>' + esc(L.tx || 'Texto') + '</span></div>';
        default: return '<div class="ly ly-' + esc(L.t) + '"' + a + ' style="' + st + '"></div>';
      }
    }).join('');
    return '<article class="prod capas" data-pid="' + esc(pid(p)) + '"' + (uno ? ' data-talla="' + esc(uno) + '"' : '') + ' style="aspect-ratio:100/' + Math.round((tpl.ar || 1.48) * 100) + '">' + h + '</article>';
  }
  PG.tarjetaHTML = tarjetaHTML;
  /* el precio se achica solo si no cabe en su capa */
  function ajustarTextos(root) {
    root.querySelectorAll('.ly[data-fit]').forEach(function (el) {
      var w = el.querySelector('.fitw'); if (!w) return; w.style.fontSize = '';
      var max = el.clientWidth, k = 1; if (!max) return;
      while (w.scrollWidth > max && k > .4) { k -= .05; w.style.fontSize = k + 'em'; }
    });
  }
  PG.ajustarTextos = ajustarTextos;
  function fillCatalog(root, ctx) {
    root.querySelectorAll('.b-catalogo').forEach(function (b) { fillOne(b, ctx, ctx && ctx.doc.secs.filter(function (x) { return x.id === b.dataset.sid; })[0]); });
  }

  /* ---------- piezas editables dentro de los bloques ---------- */
  function rectApply(el, r) {
    var st = el.style, rx = r.xt != null || r.xb != null || r.xl != null || r.xr != null;
    el.removeAttribute('data-rect'); if (!rx) return;
    var cs = getComputedStyle(el);
    st.setProperty('--rc-bg', cs.backgroundImage && cs.backgroundImage !== 'none' ? cs.backgroundImage + ',' + cs.backgroundColor : cs.backgroundColor);
    st.setProperty('--rc-bd', cs.borderTopWidth + ' ' + cs.borderTopStyle + ' ' + cs.borderTopColor); st.setProperty('--rc-rad', cs.borderRadius); st.setProperty('--rc-sh', cs.boxShadow);
    st.setProperty('--it', -(r.xt || 0) + 'px'); st.setProperty('--ib', -(r.xb || 0) + 'px'); st.setProperty('--il', -(r.xl || 0) + 'px'); st.setProperty('--ir', -(r.xr || 0) + 'px');
    el.setAttribute('data-rect', '');
  }
  function applyPiece(ctx, el, r, i) {
    var kind = el.dataset.t, st = el.style, ph = kind === 'text' || kind === 'btn' || kind === 'logo';
    if (el._an) { el._an.cancel(); el._an = null; } el.onmouseenter = null;
    if (el.dataset.o === undefined && el.dataset.s) el.dataset.o = el.textContent;
    if (kind === 'logo' && el.dataset.oh === undefined) el.dataset.oh = el.innerHTML;
    st.cssText = '';
    if (r.hide) { if (ctx.edit) { st.opacity = '.25'; st.outline = '1px dashed #888'; } else { st.display = 'none'; return; } }
    if (ph) {
      if (r.ff) st.fontFamily = fontCss(r.ff); if (r.fs) st.fontSize = r.fs + 'px'; if (r.fw) st.fontWeight = r.fw; if (r.it) st.fontStyle = 'italic'; if (r.ul) st.textDecoration = 'underline';
      if (r.col) st.color = tok(r.col); if (r.ls != null) st.letterSpacing = r.ls + 'px'; if (r.lh && kind !== 'logo') st.lineHeight = r.lh; if (r.al) st.textAlign = r.al; if (r.tsh) st.textShadow = tshCss(r.tsh);
    }
    if (kind === 'logo') {
      var has = r.src || el.dataset.oh.indexOf('<img') >= 0;
      if (r.src) el.innerHTML = '<img data-p="' + esc(r.src) + '" src="' + esc(PG.asset(r.src)) + '" alt="">'; else if (el.innerHTML !== el.dataset.oh) el.innerHTML = el.dataset.oh;
      var im = el.querySelector('img'); if (im) { im.style.height = (r.ih || 46) + 'px'; im.style.display = 'block'; } else if (r.tx != null) el.textContent = r.tx;
      el.classList.toggle('plata', el.dataset.plata === '1' && !r.col && !has);
    } else if (el.dataset.s) el.textContent = r.tx != null ? r.tx : el.dataset.o;
    if (kind === 'btn' || kind === 'card' || kind === 'text') {
      if (r.pd != null) st.padding = r.pd + 'px';
      var lados = r.pt != null || r.pb != null || r.pl != null || r.pr != null;
      if (r.pt != null) st.paddingTop = r.pt + 'px'; if (r.pb != null) st.paddingBottom = r.pb + 'px'; if (r.pl != null) st.paddingLeft = r.pl + 'px'; if (r.pr != null) st.paddingRight = r.pr + 'px';
      if (el.classList.contains('prod')) el.toggleAttribute('data-lados', lados);
      if (r.bg && el.classList.contains('tb') && !r.sh) st.boxShadow = 'none';
      if (r.wp) { st.width = r.wp + '%'; st.maxWidth = '100%'; st.alignSelf = 'auto'; st.marginLeft = r.wa === 'l' ? '0' : 'auto'; st.marginRight = r.wa === 'r' ? '0' : 'auto'; }
      if (r.hp) { st.height = r.hp + 'px'; st.aspectRatio = 'auto'; if (kind === 'btn') { st.display = 'flex'; st.alignItems = 'center'; st.justifyContent = 'center'; st.paddingTop = st.paddingBottom = '0'; } }
      if (r.bg) st.background = fillCss(r.bg); if (r.bw != null) st.border = r.bw + 'px ' + (r.bs || 'solid') + ' ' + tok(r.bc || '@tx'); if (r.rad != null) st.borderRadius = r.rad + 'px'; if (r.sh) st.boxShadow = shCss(r.sh);
    }
    if (el.classList.contains('tb')) {
      el.classList.toggle('sin-tb', r.tbg === '0');
      if (r.tbc || r.tbo != null) st.setProperty('--cat-tb', 'color-mix(in srgb, ' + tok(r.tbc || '#9aa0a8') + ' ' + (r.tbo == null ? 22 : r.tbo) + '%, transparent)');
    }
    if (kind === 'line') { st.background = fillCss(r.bg || '@c2'); if (r.w) st.width = r.w + 'px'; if (r.h) st.height = r.h + 'px'; }
    if (kind === 'icon') { if (r.col) st.stroke = tok(r.col); if (r.sz) { st.width = r.sz + 'px'; st.height = r.sz + 'px'; } }
    /* rectángulo de fondo independiente: cada borde se mueve sin tocar lo de adentro */
    if (kind === 'btn' || kind === 'card' || kind === 'text') { if (el.isConnected) rectApply(el, r); else setTimeout(function () { rectApply(el, r); }, 0); }
    var mv = r.dx || r.dy || r.r || (r.sc != null && r.sc !== 1);
    if (r.dx || r.dy) st.translate = (r.dx || 0) + 'px ' + (r.dy || 0) + 'px'; if (r.r) st.rotate = r.r + 'deg'; if (r.sc != null && r.sc !== 1) st.scale = r.sc;
    if (mv && /^(A|SPAN|I)$/.test(el.tagName)) st.display = 'inline-block';
    if (r.op != null) st.opacity = r.op;
    if (!ctx.edit && r.an && r.an.t) armAnim(ctx, el, el, r.an, { op: r.op, stag: i * (r.an.stag || 0) });
  }
  function paintKs(ctx, n, s) {
    var ks = s.k || {}, ko = (ctx.dev !== 'd' && s.ko && s.ko[ctx.dev]) || {}, idx = {};
    n.querySelectorAll('[data-k]').forEach(function (el) { var k = el.dataset.k, r = Object.assign({}, ks[k], ko[k]); idx[k] = idx[k] || 0; applyPiece(ctx, el, r, idx[k]++); });
  }
  PG.pieceRes = function (s, k, dev) { var r = Object.assign({}, (s.k || {})[k]); if (dev !== 'd' && s.ko && s.ko[dev]) Object.assign(r, s.ko[dev][k]); return r; };

  function buildSec(ctx, s) {
    var n = document.createElement('section'); n.dataset.sid = s.id; n.id = 's_' + s.id; ctx.sec[s.id] = n; paintSec(ctx, s, n, true); return n;
  }
  function paintSec(ctx, s, n, first) {
    var r = secRes(s, ctx.dev);
    if (s.t === 'libre') {
      if (first) { n.className = 'sec libre'; n.innerHTML = '<div class="sbg"></div><div class="swrap"><div class="stage"></div></div>'; }
      n.dataset.ad = adapted(s, ctx.dev) ? 1 : 0;
      if (ctx.edit) { var nd = n.querySelector(':scope>.noad'), need = !adapted(s, ctx.dev); if (need && !nd) { nd = document.createElement('div'); nd.className = 'noad'; nd.innerHTML = '<div>Esta sección usa el diseño de escritorio reducido.<br><button data-adapt="' + s.id + '">Adaptar a ' + (ctx.dev === 't' ? 'tablet' : 'móvil') + '</button></div>'; n.appendChild(nd); } else if (!need && nd) nd.remove(); }
    } else if (first) {
      n.className = 'sec b-' + s.t + (BLK[s.t] ? ' blk' : ''); n.innerHTML = '<div class="sbg"></div><div class="sin">' + html(s.t) + '</div>';
    }
    paintBg(ctx, s, n);
    if (s.t === 'catalogo') { if (first) applyCat(n, s, ctx.dev); else fillOne(n, ctx, s); }
    if (s.t !== 'libre') { n.style.paddingTop = n.style.paddingBottom = s.py != null ? s.py + 'px' : ''; n.dataset.sid = s.id; paintKs(ctx, n, s); if (s.t === 'catalogo') applyCat(n, s, ctx.dev); }
    n.classList.toggle('hid', !!s.hide);
    if (first && !ctx.edit && s.an && s.an.t) armAnim(ctx, n, n.querySelector(s.t === 'libre' ? '.swrap' : '.sin') || n, s.an, null);
  }
  PG.paintSec = function (ctx, s) { var n = ctx.sec[s.id]; if (n) { paintSec(ctx, s, n, false); fit(ctx); } };
  /* En celular y tablet la página se dibuja al ancho de diseño (390 / 820) y se escala al ancho real:
     así se ve IGUAL en cualquier teléfono (iPhone 11, 17, Android…) y igual que en la vista previa del editor. */
  function fit(ctx) {
    var cw = ctx.mount.clientWidth || W.innerWidth, esc = ctx.dev !== 'd', Wp = esc ? DEV[ctx.dev].w : cw, z = esc ? cw / Wp : 1;
    if (Math.abs(z - 1) < .002) z = 1;
    ctx.mount.style.setProperty('--pw', Wp + 'px');
    ctx.doc.secs.forEach(function (s) {
      var n0 = ctx.sec[s.id]; if (n0 && s.t !== 'libre') n0.style.zoom = z === 1 ? '' : z;
      if (s.t !== 'libre') return; var n = ctx.sec[s.id]; if (!n) return;
      var ad = adapted(s, ctx.dev), Wd = ad ? DEV[ctx.dev].w : 1280, k = esc && ad ? cw / Wd : Math.min(1, cw / Wd), h = ad ? secRes(s, ctx.dev).h : s.h; h = h || 400;
      var stg = n.querySelector('.stage'), sw = n.querySelector('.swrap');
      stg.style.width = Wd + 'px'; stg.style.height = h + 'px'; stg.style.marginLeft = -Wd / 2 + 'px'; stg.style.transform = k !== 1 ? 'scale(' + k + ')' : '';
      sw.style.height = Math.round(h * k) + 'px'; ctx.k[s.id] = k; ctx.Wd[s.id] = Wd;
    });
  }
  PG.fit = fit;

  /* ---------- render principal ---------- */
  function destroy(ctx) { if (!ctx) return; ctx.timers.forEach(clearInterval); if (ctx.io) ctx.io.disconnect(); }
  PG.destroy = destroy;
  function render(doc, mount, o) {
    o = o || {}; doc = norm(doc);
    var ctx = { doc: doc, mount: mount, edit: !!o.edit, d3: !!o.d3, dev: o.dev || autoDev(mount.clientWidth || W.innerWidth), el: {}, sec: {}, k: {}, Wd: {}, timers: [], pend: new Map() };
    mount.classList.add('pg'); mount.classList.toggle('edit', ctx.edit); mount.classList.toggle('d3', ctx.d3);
    applyTheme(mount, doc.tema); ensureFonts(doc);
    ctx.io = !ctx.edit && W.IntersectionObserver ? new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { (ctx.pend.get(e.target) || []).forEach(function (an) { an.play(); }); ctx.io.unobserve(e.target); } }); }, { threshold: .15 }) : null;
    var frag = document.createDocumentFragment();
    doc.secs.forEach(function (s) {
      if (s.hide && !ctx.edit) return; if (s.hide && ctx.edit) { /* se muestra atenuada */ }
      var n = buildSec(ctx, s); frag.appendChild(n);
      if (s.t === 'libre') {
        var stg = n.querySelector('.stage');
        doc.els.filter(function (e) { return e.sec === s.id; }).sort(function (a, b) { return (a.z || 0) - (b.z || 0); }).forEach(function (e) {
          if (!ctx.edit && res(e, ctx.dev).hide) return; var en = buildEl(ctx, e); stg.appendChild(en); setupAnim(ctx, en, e);
        });
      }
    });
    mount.innerHTML = ''; mount.appendChild(frag);
    mount._ctx = ctx; fillCatalog(mount, ctx); fit(ctx);
    if (!ctx.edit) {
      if (catalogoConCarrito(doc)) CART.init();
      var av = mount.querySelector('.av'), S = W.SITIO || {};
      var avs = doc.secs.filter(function (x) { return x.t === 'aviso'; })[0];
      if (av && (S.avisos || []).length > 1 && !(avs && avs.k && avs.k.av && avs.k.av.tx != null)) { var i = 0; ctx.timers.push(setInterval(function () { i = (i + 1) % S.avisos.length; av.textContent = S.avisos[i]; }, 4000)); }
      if (!mount._pgc) {
        mount._pgc = 1; mount.addEventListener('click', function (e) {
          if (pedidoClick(e)) return;
          var b = e.target.closest('.cats button'); if (!b) return;
          filtro = filtro === b.dataset.c ? 'Todo' : b.dataset.c;
          mount.querySelectorAll('.cats button').forEach(function (x) { x.setAttribute('aria-pressed', x.dataset.c === filtro); });
          fillCatalog(mount, mount._ctx); var c = mount.querySelector('.b-catalogo'); if (c) c.scrollIntoView();
        });
      }
    }
    return ctx;
  }
  function aviso(t) {
    var e = document.querySelector('.cc-toast'); if (!e) { e = document.createElement('div'); e.className = 'cc-toast'; document.body.appendChild(e); }
    e.textContent = t; e.classList.add('on'); clearTimeout(aviso.t); aviso.t = setTimeout(function () { e.classList.remove('on'); }, 2200);
  }
  PG.aviso = aviso;
  /* ================= CARRITO =================
     Se guarda en el navegador de la clienta. "Enviar pedido" arma un solo
     mensaje de WhatsApp con todas las prendas, tallas, cantidades y el total. */
  var CART = PG.carrito = (function () {
    var KEY = 'canaan_carrito', items = [], ui = null;
    try { items = JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { items = []; }
    function guardar() { try { localStorage.setItem(KEY, JSON.stringify(items)); } catch (e) {} pintar(); }
    function prod(id) { return ((W.SITIO || {}).productos || []).filter(function (p) { return pid(p) === id; })[0]; }
    function vivos() { return items.filter(function (it) { return prod(it.id); }); }
    function total() { return vivos().reduce(function (a, it) { return a + (Number(prod(it.id).precio) || 0) * it.q; }, 0); }
    function cuenta() { return vivos().reduce(function (a, it) { return a + it.q; }, 0); }
    function agregar(art) {
      var id = art.dataset.pid, t = art.dataset.talla || '', it = items.filter(function (x) { return x.id === id && x.t === t; })[0];
      if (it) it.q++; else items.push({ id: id, t: t, q: 1 });
      guardar(); aviso('✓ Agregado al carrito' + (t ? ' · Talla ' + t : '')); limpiarTalla(art); var b = ui && ui.btn; if (b) { b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop'); }
    }
    function mensaje() {
      var L = vivos().map(function (it) {
        var p = prod(it.id), u = Number(p.precio) || 0;
        return '• *' + p.nombre + '*\n' + (it.t ? 'Talla: ' + it.t + ' | ' : '') + 'Cantidad: ' + it.q + '\n' +
          'Precio: ' + (it.q > 1 ? precioL(u) + ' c/u (' + precioL(u * it.q) + ')' : precioL(u));
      });
      return '🛍️ *PEDIDO*\n\n*Detalles de los productos:*\n\n' + L.join('\n\n') + '\n\n*Total: ' + precioL(total()) + '*';
    }
    function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
    function init() {
      if (ui) return; ui = {};
      ui.btn = el('button', 'cc-btn', BOLSA + '<b class="cc-n">0</b>'); ui.btn.type = 'button'; ui.btn.title = 'Ver carrito'; ui.btn.onclick = abrir;
      ui.toast = document.querySelector('.cc-toast') || el('div', 'cc-toast');
      ui.fondo = el('div', 'cc-fondo'); ui.fondo.onclick = cerrar;
      ui.panel = el('aside', 'cc-panel', '<div class="cc-h"><b>Tu carrito</b><button type="button" class="cc-x" aria-label="Cerrar">✕</button></div><div class="cc-list"></div><div class="cc-pie"><div class="cc-tot"><span>Total</span><b></b></div><a class="cc-enviar" target="_blank" rel="noopener">Enviar pedido por WhatsApp</a><button type="button" class="cc-vaciar">Vaciar carrito</button></div>');
      ui.panel.querySelector('.cc-x').onclick = cerrar;
      ui.panel.querySelector('.cc-vaciar').onclick = function () { if (confirm('¿Vaciar el carrito?')) { items = []; guardar(); } };
      ui.panel.querySelector('.cc-enviar').onclick = function (e) { if (!cuenta()) { e.preventDefault(); return; } this.href = waUrl(mensaje()); };
      ui.panel.querySelector('.cc-list').onclick = function (e) {
        var b = e.target.closest('[data-op]'); if (!b) return; var it = items[+b.dataset.i]; if (!it) return;
        if (b.dataset.op === '+') it.q++; else if (b.dataset.op === '-') { it.q--; if (it.q < 1) items.splice(+b.dataset.i, 1); } else items.splice(+b.dataset.i, 1);
        guardar();
      };
      [ui.btn, ui.toast, ui.fondo, ui.panel].forEach(function (x) { document.body.appendChild(x); });
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape') cerrar(); });
      pintar();
    }
    function abrir() { pintar(); document.documentElement.classList.add('cc-abierto'); }
    function cerrar() { document.documentElement.classList.remove('cc-abierto'); }
    function pintar() {
      if (!ui) return; var n = cuenta(); ui.btn.querySelector('.cc-n').textContent = n; ui.btn.classList.toggle('vacio', !n);
      ui.panel.querySelector('.cc-tot b').textContent = precioL(total());
      ui.panel.querySelector('.cc-enviar').classList.toggle('off', !n);
      ui.panel.querySelector('.cc-list').innerHTML = n ? items.map(function (it, i) {
        var p = prod(it.id); if (!p) return ''; var f = p.mini || p.foto;
        return '<div class="cc-it">' + (f ? '<img src="' + esc(PG.asset('images/' + f)) + '" alt="">' : '<span class="cc-ph"></span>') +
          '<div class="cc-d"><b>' + esc(p.nombre) + '</b><span>' + (it.t ? 'Talla ' + esc(it.t) + ' · ' : '') + precioL(p.precio) + '</span>' +
          '<div class="cc-q"><button type="button" data-op="-" data-i="' + i + '">−</button><em>' + it.q + '</em><button type="button" data-op="+" data-i="' + i + '">+</button></div></div>' +
          '<div class="cc-r"><b>' + precioL((Number(p.precio) || 0) * it.q) + '</b><button type="button" class="cc-del" data-op="x" data-i="' + i + '" aria-label="Quitar">🗑</button></div></div>';
      }).join('') : '<p class="cc-vacio">Tu carrito está vacío.<br>Toca la bolsita 🛍 de una prenda para agregarla.</p>';
    }
    return { agregar: agregar, init: init, abrir: abrir, pintar: pintar };
  })();

  /* elegir talla y pedir */
  function prodDe(art) { var id = art && art.dataset.pid; return ((W.SITIO || {}).productos || []).filter(function (p) { return pid(p) === id; })[0]; }
  function cerrarTallas(salvo) {
    document.querySelectorAll('.pg .prod.open, .pg .prod.need').forEach(function (x) { if (x !== salvo) x.classList.remove('open', 'need'); });
    document.querySelectorAll('.pg .tl-pop-cart').forEach(function (x) { if (!salvo || !salvo.contains(x)) x.remove(); });
  }
  function elegirTalla(art, t) {
    var p = prodDe(art); if (!p) return; art.dataset.talla = t; art.classList.remove('need', 'open');
    art.querySelectorAll('.tl').forEach(function (x) { x.classList.toggle('on', x.dataset.t === t); });
    var v = art.querySelector('.tl-v'); if (v) v.textContent = 'Talla: ' + t;
    var a = art.querySelector('.btn-pedir'); if (a) a.href = waUrl(pedido(p, t));
  }
  PG.elegirTalla = elegirTalla;
  function limpiarTalla(art) {
    if (!art.querySelector('.tl')) return; delete art.dataset.talla; art.querySelectorAll('.tl').forEach(function (x) { x.classList.remove('on'); });
    var v = art.querySelector('.tl-v'), p = prodDe(art), L = art.querySelector('.ly-talla'); if (v) v.textContent = 'Talla';
    var a = art.querySelector('.btn-pedir'); if (a && p) a.href = waUrl(pedido(p, ''));
  }
  /* mantiene el cuadro de tallas dentro de la tarjeta (no se sale por los lados) */
  function encajar(pop, art) {
    if (!pop || !art) return;
    pop.style.marginLeft = ''; pop.style.minWidth = '0'; pop.style.maxWidth = Math.max(140, art.clientWidth - 8) + 'px';
    var a = art.getBoundingClientRect(), q = pop.getBoundingClientRect(), k = q.width ? pop.offsetWidth / q.width : 1, dx = 0;
    if (q.right > a.right - 4) dx = a.right - 4 - q.right;
    if (q.left + dx < a.left + 4) dx = a.left + 4 - q.left;
    if (dx) { if (pop.classList.contains('tl-pop-cart')) { pop.style.left = (pop.offsetLeft + dx * k) + 'px'; pop.style.right = 'auto'; } else pop.style.marginLeft = (dx * k) + 'px'; }
  }
  function pedirTalla(art, ir) {
    cerrarTallas(); art.dataset.ir = ir;
    var c = ir === 'cart' && art.querySelector('.ly-carrito'), g = art.querySelector('.tl-g');
    if (c && g) {   /* las tallas salen junto a la bolsita del carrito */
      var pop = document.createElement('div'); pop.className = 'tl-pop tl-pop-cart';
      pop.innerHTML = '<span class="tl-l">Elige tu talla</span><span class="tl-g">' + g.innerHTML + '</span>' + AVISO_TALLA;
      pop.style.top = (c.offsetTop + c.offsetHeight + 6) + 'px'; pop.style.right = Math.max(4, art.clientWidth - c.offsetLeft - c.offsetWidth) + 'px';
      art.appendChild(pop); encajar(pop, art); return;
    }
    art.classList.remove('need'); void art.offsetWidth; art.classList.add('open', 'need');
    if (art.classList.contains('capas')) encajar(art.querySelector('.ly-talla .tl-pop'), art);
  }
  function pedidoClick(e) {
    var tl = e.target.closest('.prod .tl'); if (tl) {
      e.preventDefault(); var ap = tl.closest('.prod'); elegirTalla(ap, tl.dataset.t);
      if (ap.dataset.ir === 'cart') { delete ap.dataset.ir; cerrarTallas(); CART.agregar(ap); }
      else if (ap.dataset.ir) { delete ap.dataset.ir; var wa = ap.querySelector('.btn-pedir'); if (wa) W.open(wa.href, '_blank', 'noopener'); }
      return true;
    }
    var cb = e.target.closest('.prod .ly-carrito'); if (cb) {
      e.preventDefault(); var ac2 = cb.closest('.prod');
      if (ac2.querySelector('.tl') && !ac2.dataset.talla) pedirTalla(ac2, 'cart'); else CART.agregar(ac2);
      return true;
    }
    var tb = e.target.closest('.prod .tl-btn'); if (tb) { e.preventDefault(); var ar = tb.closest('.prod'); cerrarTallas(ar); ar.classList.toggle('open'); if (ar.classList.contains('capas') && ar.classList.contains('open')) encajar(ar.querySelector('.ly-talla .tl-pop'), ar); return true; }
    if (!e.target.closest('.tl-pop')) cerrarTallas();
    var bt = e.target.closest('.prod .btn-pedir'); if (!bt) return false;
    var art = bt.closest('.prod'), g = art.closest('.cat-g');
    if (art.querySelector('.tl') && !art.dataset.talla) {
      e.preventDefault();
      if (art.classList.contains('capas') || (g && g.dataset.tm === 'pedir')) pedirTalla(art, '1');   /* elige talla y se abre WhatsApp */
      else { cerrarTallas(art); art.classList.remove('need'); void art.offsetWidth; art.classList.add('need', 'open'); }
    }
    return true;
  }
  function catalogoConCarrito(doc) {
    var cap = doc.secs.some(function (s) { return s.t === 'catalogo' && ((s.cg || {}).est || 'capas') === 'capas'; }); if (!cap) return false;
    var c = tplOk(doc.tarjeta).capas.filter(function (x) { return x.t === 'carrito'; })[0]; return !!c && !c.hid;
  }
  PG.render = render; PG.paintEl = paintEl; PG.buildEl = buildEl; PG.res = res; PG.secRes = secRes; PG.adapted = adapted;
  PG.norm = norm; PG.defaultDoc = defaultDoc; PG.adapt = adapt; PG.uid = uid; PG.mix = mix; PG.tok = tok; PG.autoDev = autoDev; PG.ensureFonts = ensureFonts; PG.applyTheme = applyTheme;

  /* ---------- montaje público ---------- */
  /* un documento inválido NUNCA debe dejar la web vacía */
  var STYPES = { libre: 1, aviso: 1, menu: 1, categorias: 1, catalogo: 1, opinion: 1, galeria: 1, ventajas: 1, cta: 1, pie: 1 }, ETYPES = { text: 1, img: 1, btn: 1, box: 1 };
  function valid(d) {
    try {
      if (!d || typeof d !== 'object' || !Array.isArray(d.secs) || !d.secs.length || !Array.isArray(d.els)) return false;
      var ids = {};
      for (var i = 0; i < d.secs.length; i++) { var s = d.secs[i]; if (!s || !s.id || !STYPES[s.t] || (s.t === 'libre' && !(s.h > 0))) return false; ids[s.id] = 1; }
      for (var j = 0; j < d.els.length; j++) { var e = d.els[j]; if (!e || !e.id || !ids[e.sec] || !ETYPES[e.t] || typeof e.x !== 'number' || typeof e.y !== 'number' || typeof e.w !== 'number') return false; }
      return true;
    } catch (x) { return false; }
  }
  PG.valid = valid;
  PG.mount = function (el, doc) {
    var ctx, raf;
    try { doc = norm(doc); } catch (e) { doc = null; }
    if (!valid(doc)) { if (doc) console.warn('La página publicada no es válida: se muestra el diseño por defecto.'); doc = defaultDoc(); }
    function go(dev) { destroy(ctx); try { ctx = render(doc, el, { dev: dev }); } catch (e) { console.error('Error al dibujar, uso diseño por defecto:', e); doc = defaultDoc(); ctx = render(doc, el, { dev: dev }); } }
    go();
    W.addEventListener('resize', function () { cancelAnimationFrame(raf); raf = requestAnimationFrame(function () { var dv = autoDev(el.clientWidth || W.innerWidth); if (dv !== ctx.dev) go(dv); else fit(ctx); }); });
    return function () { return ctx; };
  };
  W.PG = PG;
})(window);
