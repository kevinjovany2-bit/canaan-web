/* =====================================================================
   /p/<prenda> — tarjeta de vista previa para WhatsApp (como Airbnb)
   WhatsApp lee estas etiquetas (foto, nombre, precio) y arma la tarjeta.
   Una persona que toca el enlace es enviada a la prenda dentro de la web.
   ===================================================================== */
const SUPA = process.env.CANAAN_SUPA || 'https://hqywpbzvkplbkdvdyhhm.supabase.co';
const KEY = 'sb_publishable_eHf8KxGVmu_Cz09CI3iPtQ_aigm_oDH';
const LOCALES = new Set(["images/Dise_o_sin_t_tulo__38__y54r.png", "images/IMG_8538.jpg", "images/IMG_8556.jpg", "images/IMG_8607.jpg", "images/IMG_8637.jpg", "images/IMG_8708.jpg", "images/IMG_8730.jpg", "images/IMG_8784.jpg", "images/IMG_8795.jpg", "images/IMG_8840.jpg", "images/logo_canaan__1_.png", "images/mini/Dise_o_sin_t_tulo__38__y54r.jpg", "images/mini/IMG_8538.jpg", "images/mini/IMG_8556.jpg", "images/mini/IMG_8607.jpg", "images/mini/IMG_8637.jpg", "images/mini/IMG_8708.jpg", "images/mini/IMG_8730.jpg", "images/mini/IMG_8784.jpg", "images/mini/IMG_8795.jpg", "images/mini/IMG_8840.jpg", "images/mini/logo_canaan__1_.jpg"]);

const slug = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const esc = (t) => String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const enc = (p) => p.split('/').map(encodeURIComponent).join('/');
const precio = (v) => 'L ' + Number(v || 0).toLocaleString('es-HN');

async function datos(origin) {
  try {
    const r = await fetch(SUPA + '/rest/v1/contenido?select=valor&clave=eq.datos', { headers: { apikey: KEY } });
    if (r.ok) { const j = await r.json(); if (j[0] && j[0].valor) return JSON.parse(j[0].valor); }
  } catch (e) {}
  try { const t = await (await fetch(origin + '/datos.js')).text(); return JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1)); } catch (e) {}
  return {};
}

export default async (req, context) => {
  const u = new URL(req.url);
  const id = decodeURIComponent((context && context.params && context.params.id) || u.pathname.split('/').filter(Boolean).pop() || '');
  const talla = (u.searchParams.get('t') || '').slice(0, 20);
  const S = await datos(u.origin);
  const ps = S.productos || [];
  const seen = {};
  const pidDe = (x) => { if (x.id) return x.id; const sl = slug(x.nombre) || 'prenda'; seen[sl] = (seen[sl] || 0) + 1; return sl + (seen[sl] > 1 ? '-' + seen[sl] : ''); };
  const p = ps.find((x) => pidDe(x) === id) || ps.find((x) => slug(x.nombre) === id);
  const ruta = (n) => { const r = 'images/' + n; return LOCALES.has(r) ? u.origin + '/' + enc(r) : SUPA + '/storage/v1/object/public/imagenes/' + enc(r); };
  const tienda = (S.nombre || 'Canaàn') + ' Boutique';
  const title = p ? p.nombre + ' · ' + precio(p.precio) : tienda;
  const desc = p ? [talla && 'Talla ' + talla, '¿Está disponible?', tienda].filter(Boolean).join(' · ') : 'Boutique Luxury VIP';
  const img = p && (p.mini || p.foto) ? ruta(p.mini || p.foto) : (S.logo ? ruta(S.logo) : '');
  const dest = u.origin + '/?p=' + encodeURIComponent(id) + (talla ? '&t=' + encodeURIComponent(talla) : '') + '#novedades';
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta property="og:type" content="product">
<meta property="og:site_name" content="${esc(tienda)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(u.href)}">
${img ? `<meta property="og:image" content="${esc(img)}">\n<meta property="og:image:secure_url" content="${esc(img)}">\n<meta property="og:image:type" content="image/jpeg">\n<meta name="twitter:image" content="${esc(img)}">` : ''}
<meta name="twitter:card" content="summary_large_image">
<link rel="canonical" href="${esc(dest)}">
<style>body{font:16px system-ui;margin:0;display:grid;place-items:center;min-height:100vh;background:#fff;color:#111;text-align:center}img{max-width:240px;border-radius:10px}a{color:#111}</style>
</head><body><div>${img ? `<img src="${esc(img)}" alt="">` : ''}<h1 style="font-size:20px">${esc(title)}</h1><p><a href="${esc(dest)}">Ver en la tienda →</a></p></div>
<script>location.replace(${JSON.stringify(dest)})</script></body></html>`;
  return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=300' } });
};

export const config = { path: '/p/:id' };
