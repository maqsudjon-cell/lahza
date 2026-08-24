import { json, err, readEvent, listPhotos } from '../../../lib/store.js';

/** GET /api/photos/:id — albomdagi rasmlar ro'yxati. */
export async function onRequestGet({ params, env }) {
  const meta = await readEvent(env.PHOTOS, params.id);
  if (!meta) return err('Albom topilmadi', 404);

  const photos = await listPhotos(env.PHOTOS, meta.id);
  return json({ photos }, 200, { 'cache-control': 'no-store' });
}
