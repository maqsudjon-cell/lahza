/**
 * GET /f/{eventId}/{p|t}/{photoId} — R2'dan rasm beradi.
 * Bu yo'l orqali chiqadigan trafik uchun Cloudflare pul olmaydi (R2 egress = 0).
 */

/**
 * `If-None-Match` sarlavhasini R2 kutgan ko'rinishga keltiradi.
 *
 * HTTP standarti ETag'ni qo'shtirnoq bilan yuboradi (`W/"abc"`), R2 esa
 * qo'shtirnoqni qabul qilmaydi va xato tashlaydi. Shuning uchun qo'shtirnoq
 * ham, `W/` prefiksi ham olib tashlanadi.
 */
function conditionalEtag(header) {
  if (!header) return null;
  const first = header.split(',')[0].trim();
  if (!first || first === '*') return null;
  const clean = first.replace(/^W\//i, '').replace(/^"(.*)"$/, '$1').trim();
  return clean || null;
}

export async function serveFile(request, env, { eventId, kind, photoId }) {
  if (kind !== 'p' && kind !== 't') return new Response('Topilmadi', { status: 404 });

  const etag = conditionalEtag(request.headers.get('if-none-match'));
  const object = await env.PHOTOS.get(
    `e/${eventId}/${kind}/${photoId}`,
    etag ? { onlyIf: { etagDoesNotMatch: etag } } : undefined
  );

  if (!object) return new Response('Topilmadi', { status: 404 });

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  headers.set('cache-control', 'public, max-age=31536000, immutable');

  // Shart bajarilmasa R2 tanasiz obyekt qaytaradi — bu 304 demak.
  if (!('body' in object)) return new Response(null, { status: 304, headers });

  return new Response(object.body, { headers });
}
