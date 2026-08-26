/* ==========================================================================
   Umumiy backend mantiq. Barcha API funksiyalari shundan foydalanadi.
   Saqlash faqat R2'da — alohida ma'lumotlar bazasi yo'q.

   R2'dagi tuzilma:
     e/{eventId}/meta.json      — tadbir ma'lumoti
     e/{eventId}/p/{photoId}    — to'liq rasm (1920px)
     e/{eventId}/t/{photoId}    — eskiz (400px)
   ========================================================================== */

export const RETENTION_DAYS = 60;   // R2 lifecycle qoidasi ham shu songa moslanadi
export const MAX_PHOTOS     = 1500; // bitta tadbirga
export const MAX_BYTES      = 12 * 1024 * 1024; // bitta faylga (HEIC zaxira yo'li uchun keng)
// Eskiz 400px — amalda ~50 KB. Avval unga ham 12 MB ruxsat berilardi, ya'ni
// bitta so'rovda 24 MB yuborish mumkin edi.
export const MAX_THUMB_BYTES = 1024 * 1024;

/* --- Identifikatorlar ---------------------------------------------------- */

// Chalkashtiradigan belgilar (0/O, 1/l/I) yo'q — QR o'qilmasa qo'lda teriladi.
const ALPHABET = '23456789abcdefghjkmnpqrstuvwxyz';

/**
 * Alifbo 31 ta belgidan iborat, bayt esa 256 qiymat oladi — `b % 31`
 * birinchi sakkiz belgini boshqalardan ko'proq tanlaydi. Boshqaruv kaliti
 * uchun bu jiddiy zaif nuqta emas, lekin tasodifiylik "deyarli" bo'lmasligi
 * kerak: chegaradan chiqqan baytni tashlab, yangisini olamiz.
 */
function randomId(length) {
  const limit = 256 - (256 % ALPHABET.length); // 248
  let out = '';
  while (out.length < length) {
    const bytes = crypto.getRandomValues(new Uint8Array(length - out.length + 8));
    for (const b of bytes) {
      if (b >= limit) continue;
      out += ALPHABET[b % ALPHABET.length];
      if (out.length === length) break;
    }
  }
  return out;
}

export const newEventId  = () => randomId(9);
export const newPhotoId  = () => randomId(16);
export const newManageKey = () => randomId(28);

const ID_RE = new RegExp(`^[${ALPHABET}]{4,32}$`);
export const validId = (s) => typeof s === 'string' && ID_RE.test(s);

/* --- Kalitlar ------------------------------------------------------------ */

export const metaKey  = (e)      => `e/${e}/meta.json`;
export const fullKey  = (e, p)   => `e/${e}/p/${p}`;
export const thumbKey = (e, p)   => `e/${e}/t/${p}`;

/* --- Javoblar ------------------------------------------------------------ */

export const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...headers },
  });

export const err = (message, status = 400) => json({ error: message }, status);

/* --- Tadbir -------------------------------------------------------------- */

export async function readEvent(bucket, eventId) {
  if (!validId(eventId)) return null;
  const obj = await bucket.get(metaKey(eventId));
  if (!obj) return null;

  let meta;
  try {
    meta = await obj.json();
  } catch {
    return null;
  }
  // Muddati tugaganini yo'q deb hisoblaymiz. Baytlarni R2 lifecycle o'chiradi.
  if (meta.expiresAt && new Date(meta.expiresAt).getTime() < Date.now()) return null;
  return meta;
}

export function publicMeta(meta) {
  return {
    id: meta.id,
    title: meta.title,
    date: meta.date,
    expiresAt: meta.expiresAt,
  };
}

/* --- Rasmlar ro'yxati ---------------------------------------------------- */

/**
 * Tadbirdagi rasm identifikatorlari, yangisidan eskisiga qarab.
 * Identifikatorda vaqt yo'q, shuning uchun tartib R2'ning `uploaded`
 * maydonidan olinadi.
 */
export async function listPhotos(bucket, eventId, { limit = MAX_PHOTOS, withType = false } = {}) {
  const prefix = `e/${eventId}/p/`;
  const out = [];
  let cursor;

  do {
    const page = await bucket.list({
      prefix, cursor, limit: 1000,
      // Turni faqat ZIP so'raydi (arxivdagi kengaytma uchun). Mehmon
      // sahifasiga u kerak emas, shuning uchun odatda so'ralmaydi.
      ...(withType ? { include: ['httpMetadata'] } : {}),
    });
    for (const o of page.objects) {
      out.push({
        id: o.key.slice(prefix.length),
        at: o.uploaded,
        size: o.size,
        type: o.httpMetadata?.contentType || 'image/jpeg',
      });
      if (out.length >= limit) return sortNewestFirst(out);
    }
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);

  return sortNewestFirst(out);
}

/** Rasm turidan arxiv uchun kengaytma. */
export function extForType(type) {
  switch (type) {
    case 'image/png':  return 'png';
    case 'image/webp': return 'webp';
    case 'image/heic': return 'heic';
    case 'image/gif':  return 'gif';
    default:           return 'jpg';
  }
}

function sortNewestFirst(list) {
  list.sort((a, b) => new Date(b.at) - new Date(a.at));
  return list.map(({ id, size, type }) => ({ id, size, type }));
}

export async function countPhotos(bucket, eventId) {
  // MAX_PHOTOS + 1 tagacha sanaymiz — chegaraga yetganini bilish kifoya.
  const prefix = `e/${eventId}/p/`;
  let total = 0, cursor;
  do {
    const page = await bucket.list({ prefix, cursor, limit: 1000 });
    total += page.objects.length;
    if (total > MAX_PHOTOS) return total;
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  return total;
}

/* --- O'chirish kaliti ----------------------------------------------------- */

/**
 * Rasmni o'chirish uchun kalit.
 *
 * Muammo: albom havolasi ochiq, ya'ni har kim rasmlar ro'yxatini ola oladi.
 * Agar o'chirish faqat rasm identifikatoriga qarab ishlaganda, havolaga ega
 * har kim BOSHQANING suratini o'chirib yuborardi.
 *
 * Yechim: kalit boshqaruv kalitidan hosil qilinadi. Rasm identifikatorini
 * bilish yetarli emas — boshqaruv kaliti ham kerak. Uni esa faqat albom
 * egasi biladi, va rasm qo'shgan mehmon o'z suratining kalitini yuklash
 * javobida oladi. Ya'ni: mehmon faqat o'zi qo'shganini o'chira oladi,
 * albom egasi esa hammasini.
 *
 * Alohida ombor kerak emas — kalit har safar qaytadan hisoblanadi.
 */
export async function photoDeleteKey(manageKey, photoId) {
  const data = new TextEncoder().encode(`ochirish:${manageKey}:${photoId}`);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(buf).slice(0, 8)]
    .map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Uzunlikka bog'liq bo'lmagan solishtirish. */
export function sameSecret(a, b) {
  const x = String(a ?? ''), y = String(b ?? '');
  if (x.length !== y.length) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return diff === 0;
}

/* --- Matn tozalash ------------------------------------------------------- */

/**
 * Tadbir nomi mehmon sahifasida, QR varaqasida va ZIP fayl nomida
 * ko'rinadi. Ko'rinmas boshqaruv belgilari olib tashlanadi: ular orasida
 * matn yo'nalishini teskari qiladiganlari ham bor (U+202E), ya'ni nomni
 * ko'zga butunlay boshqacha ko'rsatib qo'yish mumkin.
 */
export function cleanTitle(raw) {
  const s = String(raw ?? '')
    .replace(/[\u0000-\u001F\u007F\u200B-\u200F\u2028-\u202E\u2066-\u2069\uFEFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return s.slice(0, 70);
}

/** ISO sana (YYYY-MM-DD) — boshqa formatlarni qabul qilmaymiz. */
export function cleanDate(raw) {
  const s = String(raw ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return '';
  const d = new Date(s + 'T00:00:00Z');
  return Number.isNaN(d.getTime()) ? '' : s;
}

/** Fayl nomiga xavfsiz aylantirish (ZIP ichidagi nom uchun). */
export function safeFilename(s) {
  return String(s).replace(/[\\/:*?"<>|\x00-\x1f]/g, '').trim().slice(0, 60) || 'albom';
}
