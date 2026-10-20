/* =====================================================================
   despertar — mantiene activo el proyecto de Supabase (plan gratis).
   Supabase pausa los proyectos gratis que pasan 7 días sin actividad.
   Netlify ejecuta esta función sola 2 veces al día y hace una lectura
   pequeña a la base de datos, así el proyecto nunca se queda "dormido".
   No hay que tocar nada: funciona sola al subirla a GitHub.
   ===================================================================== */
const SUPA = process.env.CANAAN_SUPA || 'https://hqywpbzvkplbkdvdyhhm.supabase.co';
const KEY = 'sb_publishable_eHf8KxGVmu_Cz09CI3iPtQ_aigm_oDH';

export default async () => {
  try {
    const r = await fetch(SUPA + '/rest/v1/contenido?select=clave&limit=1', { headers: { apikey: KEY }, cache: 'no-store' });
    console.log('Supabase despierto:', r.status);
  } catch (e) {
    console.log('No se pudo llegar a Supabase:', e.message);
  }
  return new Response('ok');
};

/* cada 12 horas (Netlify usa hora UTC) */
export const config = { schedule: '0 */12 * * *' };
