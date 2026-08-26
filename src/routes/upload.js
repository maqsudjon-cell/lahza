import {
  json, err, readEvent, countPhotos, newPhotoId,
  fullKey, thumbKey, MAX_PHOTOS, MAX_BYTES, MAX_THUMB_BYTES,
} from '../../lib/store.js';

/**
 * Fayl turini BAYTLARDAN aniqlaymiz, mijoz aytgan `type` dan emas.
 * Mijoz `type` ni istalgancha yozishi mumkin, bo'sh qoldirishi ham
 * mumkin — avval bo'sh `type` tekshiruvdan butunlay o'tib ketardi.
 */
function sniffImage(bytes) {
  const b = bytes;
  if (b.length < 12) return null;

  // JPEG: FF D8 FF
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 &&
      b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return 'image/png';

  const ascii = (from, to) => String.fromCharCode(...b.slice(from, to));

  // WebP: "RIFF" .... "WEBP"
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'image/webp';

  // GIF: kamdan-kam, lekin galereyada uchraydi (siqish yo'li ishlamaganda
  // asl fayl kelishi mumkin) — rad etib, mehmonni ovora qilishning hojati yo'q.
  if (ascii(0, 6) === 'GIF87a' || ascii(0, 6) === 'GIF89a') return 'image/gif';

  // HEIC/HEIF/AVIF: ISO BMFF quti — 4 bayt uzunlik, keyin "ftyp", keyin brend.
  // iPhone'ning asl fayli shu ko'rinishda keladi (siqish yo'li ishlamaganda).
  if (ascii(4, 8) === 'ftyp') {
    const brand = ascii(8, 12);
    if (['heic', 'heix', 'heim', 'heis', 'hevc', 'hevx', 'hevm', 'hevs',
         'mif1', 'msf1', 'avif', 'avis'].includes(brand)) return 'image/heic';
  }

  return null;
}

/** POST /api/upload/:id — bitta rasm (to'liq + eskiz). */
export async function uploadPhoto(request, env, id) {
  // Tanani o'qishdan OLDIN hajmni tekshiramiz. Avval `formData()` butun
  // so'rovni xotiraga yoyar, hajm esa undan keyin tekshirilardi — ya'ni
  // 100 MB lik so'rov ham avval to'liq qabul qilinardi.
  const declared = Number(request.headers.get('content-length'));
  const maxRequest = MAX_BYTES + MAX_THUMB_BYTES + 64 * 1024; // + multipart chegaralari
  if (Number.isFinite(declared) && declared > maxRequest) {
    return err('Rasm juda katta', 413);
  }

  const meta = await readEvent(env.PHOTOS, id);
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

  const head = new Uint8Array(await full.slice(0, 12).arrayBuffer());
  const kind = sniffImage(head);
  if (!kind) return err('Bu fayl rasm emas', 415);

  const photoId = newPhotoId();

  // Saqlangan tur baytlarga mos bo'lishi kerak. Avval hammasi `image/jpeg`
  // deb yozilardi — PNG yoki HEIC yuborilganda esa turi yolg'on bo'lib
  // qolardi va ZIP ichida ham noto'g'ri kengaytma bilan chiqardi.
  const httpMetadata = {
    contentType: kind,
    cacheControl: 'public, max-age=31536000, immutable',
  };

  // Eskizni birinchi yozamiz: agar to'liq rasm yozilmasa, ro'yxatga
  // (u faqat p/ prefiksini o'qiydi) yetim eskiz tushmaydi.
  if (thumb instanceof File && thumb.size > 0 && thumb.size <= MAX_THUMB_BYTES) {
    const th = new Uint8Array(await thumb.slice(0, 12).arrayBuffer());
    const thumbKind = sniffImage(th);
    if (thumbKind) {
      await env.PHOTOS.put(thumbKey(meta.id, photoId), thumb, {
        httpMetadata: { ...httpMetadata, contentType: thumbKind },
      });
    }
  }
  await env.PHOTOS.put(fullKey(meta.id, photoId), full, { httpMetadata });

  return json({ id: photoId }, 201);
}
