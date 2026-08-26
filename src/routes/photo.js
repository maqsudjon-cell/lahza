import {
  json, err, readEvent, validId, fullKey, thumbKey,
  photoDeleteKey, sameSecret,
} from '../../lib/store.js';

/**
 * DELETE /api/photo/:eventId/:photoId
 *
 * Ruxsat ikki yo'l bilan beriladi:
 *   ?k=<boshqaruv kaliti>  — albom egasi, istalgan rasmni o'chiradi
 *   ?d=<o'chirish kaliti>  — rasmni qo'shgan mehmon, faqat o'zinikini
 *
 * Ikkinchisi yuklash javobida qaytariladi va mehmonning brauzerida
 * saqlanadi. Shu sababli "adashib boshqa rasm yubordim" holati
 * yordam so'rashsiz hal bo'ladi.
 */
export async function deletePhoto(request, env, eventId, photoId) {
  if (!validId(eventId) || !validId(photoId)) return err('Rasm topilmadi', 404);

  const meta = await readEvent(env.PHOTOS, eventId);
  if (!meta) return err('Albom topilmadi', 404);

  const params = new URL(request.url).searchParams;
  const manageKey = params.get('k') || '';
  const delKey    = params.get('d') || '';

  let ruxsat = manageKey && sameSecret(manageKey, meta.manageKey);
  if (!ruxsat && delKey) {
    ruxsat = sameSecret(delKey, await photoDeleteKey(meta.manageKey, photoId));
  }
  if (!ruxsat) return err('Ruxsat yo\'q', 403);

  // Eskiz avval — u qolib ketsa galereyada "arvoh" katakcha ko'rinadi.
  await env.PHOTOS.delete(thumbKey(meta.id, photoId));
  await env.PHOTOS.delete(fullKey(meta.id, photoId));

  return json({ ochirildi: photoId });
}
