import {
  json, err, readEvent, countPhotos, newPhotoId,
  fullKey, thumbKey, MAX_PHOTOS, MAX_BYTES,
} from '../../../lib/store.js';

const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);

/** POST /api/upload/:id — bitta rasm (to'liq + eskiz). */
export async function onRequestPost({ params, env, request }) {
  const meta = await readEvent(env.PHOTOS, params.id);
  if (!meta) return err('Albom topilmadi', 404);

  const count = await countPhotos(env.PHOTOS, meta.id);
  if (count >= MAX_PHOTOS) return err('Bu albom to\'lgan', 409);

  let form;
  try {
    form = await request.formData();
  } catch {
    return err('Fayl o\'qilmadi');
  }

  const full  = form.get('full');
  const thumb = form.get('thumb');

  if (!(full instanceof File)) return err('Rasm yuborilmadi');
  if (full.size === 0)         return err('Rasm bo\'sh');
  if (full.size > MAX_BYTES)   return err('Rasm juda katta', 413);
  if (full.type && !ALLOWED.has(full.type)) return err('Bu fayl turi qo\'llab-quvvatlanmaydi', 415);

  const photoId = newPhotoId();
  const type = 'image/jpeg';

  // Eskizni birinchi yozamiz: agar to'liq rasm yozilmasa, ro'yxatga
  // (u faqat p/ prefiksini o'qiydi) yetim eskiz tushmaydi.
  if (thumb instanceof File && thumb.size > 0 && thumb.size <= MAX_BYTES) {
    await env.PHOTOS.put(thumbKey(meta.id, photoId), thumb, {
      httpMetadata: { contentType: type, cacheControl: 'public, max-age=31536000, immutable' },
    });
  }

  await env.PHOTOS.put(fullKey(meta.id, photoId), full, {
    httpMetadata: { contentType: type, cacheControl: 'public, max-age=31536000, immutable' },
  });

  return json({ id: photoId }, 201);
}
