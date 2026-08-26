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
 *   fonts.googleapis.com   — Inter va IBM Plex Mono uslub fayli
 *   fonts.gstatic.com      — shriftlarning o'zi
 *   blob:                  — yuborishdan oldingi mahalliy ko'rinish (/e/)
 *   data:                  — ichki SVG va kichik rasmlar
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://gc.zgo.at",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
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
