import { json, err, readEvent, listPhotos as listFromStore } from '../../lib/store.js';

/** GET /api/photos/:id — albomdagi rasmlar ro'yxati. */
export async function listPhotos(request, env, id) {
  const meta = await readEvent(env.PHOTOS, id);
  if (!meta) return err('Albom topilmadi', 404);

  // Mehmon sahifasiga faqat identifikator kerak — hajm va turni
  // yubormaymiz, ular albom ichidagi ortiqcha ma'lumot.
  const photos = (await listFromStore(env.PHOTOS, meta.id)).map(({ id }) => ({ id }));
  return json({ photos }, 200, { 'cache-control': 'no-store' });
}
