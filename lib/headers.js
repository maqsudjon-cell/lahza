/* ==========================================================================
   Xavfsizlik sarlavhalari.

   Bularsiz sayt ishlaydi, lekin brauzerga hech qanday cheklov bermaydi:
   sahifani boshqa saytga <iframe> qilib qo'yish mumkin, yuklangan fayl
   HTML deb talqin qilinishi mumkin, havolalar esa manzilni (albom
   kalitini!) begona saytlarga uzatib yuboradi.
   ========================================================================== */

/**
 * Kontent siyosati (CSP).
 *
 * `'unsafe-inline'` ni olib tashlab bo'lmaydi: sahifalarda ichki <script>
 * (animatsiya bootstrap'i, JSON-LD) va ichki <style> bloklari bor, statik
 * fayllarga esa nonce qo'yib bo'lmaydi. Shunga qaramay manbalar ro'yxati
 * cheklangani foydali — begona domendan skript yuklab bo'lmaydi.
 *
 * Ruxsat etilganlar va sababi:
 *   gc.zgo.at              — GoatCounter hisoblagichi (count.js)
 *   chaqnoq.goatcounter.com — hisoblagich ma'lumot yuboradigan manzil
 *   blob:                  — yuborishdan oldingi mahalliy ko'rinish (/e/)
 *   data:                  — ichki SVG va kichik rasmlar
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://gc.zgo.at",
  // Shriftlar o'z domenimizda, shuning uchun Google domenlariga ruxsat
  // kerak emas — bu ham tezlik, ham bitta yopilgan eshik.
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self'",
  "img-src 'self' data: blob: https://chaqnoq.goatcounter.com",
  "connect-src 'self' https://chaqnoq.goatcounter.com",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  'upgrade-insecure-requests',
].join('; ');

/** Har qanday javobga tegishli. */
const BASE = {
  'x-content-type-options': 'nosniff',
  // Albom manzilida kalit bor. `strict-origin-when-cross-origin` begona
  // saytga faqat `https://chaqnoq.uz` ni yuboradi, `?i=...` ni emas.
  'referrer-policy': 'strict-origin-when-cross-origin',
  'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
};

const HTML_ONLY = {
  'content-security-policy': CSP,
  'x-frame-options': 'DENY',
};

/**
 * Mehmon yuklagan fayllar sayt bilan bir xil domendan beriladi. Agar
 * kimdir rasm o'rniga HTML yuborsa va brauzer uni sahifa deb ochsa, bu
 * chaqnoq.uz ichida begona kod ishga tushishi demak. `sandbox` va
 * `default-src 'none'` shu yo'lni butunlay yopadi.
 */
const USER_CONTENT = {
  'content-security-policy': "default-src 'none'; sandbox",
  'x-content-type-options': 'nosniff',
  'cross-origin-resource-policy': 'same-origin',
};

/**
 * Javobni o'zgartirib bo'lmaydigan sarlavhalar bilan qaytaradi.
 * `fetch()` dan kelgan javobning sarlavhalari qotib qolgan, shuning uchun
 * yangi Response yasaymiz (tanasi o'sha oqimning o'zi — nusxa olinmaydi).
 */
export function harden(response, { html = false, userContent = false, hsts = true } = {}) {
  const headers = new Headers(response.headers);

  for (const [k, v] of Object.entries(userContent ? USER_CONTENT : BASE)) headers.set(k, v);
  if (html) for (const [k, v] of Object.entries(HTML_ONLY)) headers.set(k, v);
  if (hsts) headers.set('strict-transport-security', 'max-age=31536000; includeSubDomains');

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/** Javob HTML sahifami? CSP faqat shularga kerak. */
export const isHtml = (response) =>
  (response.headers.get('content-type') || '').toLowerCase().includes('text/html');


/* --- Kesh muddati --------------------------------------------------------
   Cloudflare statik fayllarga `max-age=0, must-revalidate` qo'yadi — ya'ni
   brauzer faylni saqlab qo'ysa ham HAR SAFAR serverdan so'raydi. Bitta
   sahifada 16 ga yaqin fayl bor; sekin mobil tarmoqda bu 16 ta ortiqcha
   borish-kelish demak.

   `stale-while-revalidate` shu yerda kalit: muddat tugagach brauzer eski
   nusxani DARHOL ko'rsatadi va yangisini orqa fonda oladi. Foydalanuvchi
   hech qachon kutmaydi, yangilanish esa keyingi ochilishda yetib boradi.
   -------------------------------------------------------------------------- */

const KESH = [
  // Rasm va belgilar deyarli o'zgarmaydi. O'zgartirilsa fayl nomini
  // almashtirish kerak, aks holda eski nusxa bir oygacha qolib ketadi.
  [/^\/(assets\/img\/|favicon|apple-touch-icon|icon-)/,
   'public, max-age=2592000, stale-while-revalidate=604800'],
  // Shrift hech qachon o'zgarmaydi — nomida versiya bor. Bir yil.
  [/^\/assets\/fonts\//, 'public, max-age=31536000, immutable'],
  // Uslub va skript tez-tez o'zgaradi: qisqa muddat, uzun zaxira.
  [/^\/assets\/.*\.(css|js)$/,
   'public, max-age=600, stale-while-revalidate=604800'],
  [/^\/site\.webmanifest$/, 'public, max-age=86400'],
];

/** Statik fayl javobiga mos kesh muddatini qo'yadi. */
export function withCache(response, pathname) {
  for (const [re, value] of KESH) {
    if (!re.test(pathname)) continue;
    const headers = new Headers(response.headers);
    headers.set('cache-control', value);
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }
  return response;
}
