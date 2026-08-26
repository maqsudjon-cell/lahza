/**
 * robots.txt va sitemap.xml — manzil so'rovning o'zidan olinadi.
 *
 * Shu sababli domen o'zgarsa yoki qo'shilsa, hech narsani qo'lda tahrirlash
 * kerak emas: `.workers.dev` da ham, o'z domenida ham to'g'ri chiqadi.
 */

// Faqat ochiq sahifalar. /e/, /boshqarish/, /qr/ — shaxsiy, ular indekslanmaydi.
//
// `lastmod` — sahifa MATNI oxirgi marta o'zgargan sana. Uni bugungi sana
// bilan to'ldirish xato: har kuni yangilanadigan sitemap Google uchun
// "bu sanalar ma'nosiz" degan signal va u lastmod'ga umuman ishonmay
// qo'yadi. Sahifani tahrirlaganda shu yerdagi sanani ham yangilang.
const PUBLIC_PAGES = [
  { path: '/',           priority: '1.0', lastmod: '2026-08-25' },
  { path: '/yaratish/',  priority: '0.8', lastmod: '2026-08-25' },
  { path: '/maxfiylik/', priority: '0.3', lastmod: '2026-08-25' },
  { path: '/shartlar/',  priority: '0.3', lastmod: '2026-08-25' },
  { path: '/manbalar/',  priority: '0.2', lastmod: '2026-08-25' },
];

/**
 * IndexNow kaliti.
 *
 * IndexNow — Bing va **Yandex** ga "sahifa o'zgardi" deb darhol xabar
 * beradigan ochiq protokol. Akkaunt kerak emas, faqat shu kalit fayl
 * saytda turishi kifoya. O'zbekistonda Yandex ulushi katta bo'lgani
 * uchun bu Google'dan kam ahamiyatli emas.
 */
export const INDEXNOW_KEY = 'aadbf93700f7c63be3658b7dcb7dd34a';

export function indexNowKey() {
  return new Response(INDEXNOW_KEY, {
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
}

export function robots(request) {
  const { origin } = new URL(request.url);
  const body = [
    'User-agent: *',
    'Allow: /$',
    'Allow: /yaratish/',
    'Allow: /maxfiylik/',
    'Allow: /shartlar/',
    'Allow: /manbalar/',
    '',
    '# Albom havolalari shaxsiy — ular qidiruvga tushmasligi kerak',
    'Disallow: /e/',
    'Disallow: /boshqarish/',
    'Disallow: /qr/',
    'Disallow: /api/',
    'Disallow: /f/',
    '',
    `Sitemap: ${origin}/sitemap.xml`,
    '',
  ].join('\n');

  return new Response(body, {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=3600',
    },
  });
}

export function sitemap(request) {
  const { origin } = new URL(request.url);

  const urls = PUBLIC_PAGES.map(({ path, priority, lastmod }) =>
    `  <url>\n` +
    `    <loc>${origin}${path}</loc>\n` +
    `    <lastmod>${lastmod}</lastmod>\n` +
    `    <priority>${priority}</priority>\n` +
    `  </url>`
  ).join('\n');

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;

  return new Response(xml, {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': 'public, max-age=3600',
    },
  });
}
