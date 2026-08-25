/**
 * robots.txt va sitemap.xml — manzil so'rovning o'zidan olinadi.
 *
 * Shu sababli domen o'zgarsa yoki qo'shilsa, hech narsani qo'lda tahrirlash
 * kerak emas: `.workers.dev` da ham, o'z domenida ham to'g'ri chiqadi.
 */

// Faqat ochiq sahifalar. /e/, /boshqarish/, /qr/ — shaxsiy, ular indekslanmaydi.
const PUBLIC_PAGES = [
  { path: '/',          priority: '1.0' },
  { path: '/yaratish/', priority: '0.8' },
  { path: '/maxfiylik/', priority: '0.3' },
  { path: '/shartlar/',  priority: '0.3' },
  { path: '/manbalar/', priority: '0.2' },
];

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
  const today = new Date().toISOString().slice(0, 10);

  const urls = PUBLIC_PAGES.map(({ path, priority }) =>
    `  <url>\n` +
    `    <loc>${origin}${path}</loc>\n` +
    `    <lastmod>${today}</lastmod>\n` +
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
