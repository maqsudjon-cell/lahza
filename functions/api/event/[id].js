import { json, err, readEvent, publicMeta } from '../../../lib/store.js';

/** GET /api/event/:id — mehmon sahifasi uchun ochiq ma'lumot. */
export async function onRequestGet({ params, env }) {
  const meta = await readEvent(env.PHOTOS, params.id);
  if (!meta) return err('Albom topilmadi', 404);

  return json(publicMeta(meta), 200, {
    // Meta kamdan-kam o'zgaradi, lekin muddat tugashini tez sezishi kerak.
    'cache-control': 'public, max-age=60',
  });
}
