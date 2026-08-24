/**
 * GET /f/{eventId}/{p|t}/{photoId} — R2'dan rasm beradi.
 * Bu yo'l orqali chiqadigan trafik uchun Cloudflare pul olmaydi (R2 egress = 0),
 * shuning uchun galereyani cheksiz ko'rish mumkin.
 */
export async function onRequestGet({ params, env, request }) {
  const parts = params.path || [];
  if (parts.length !== 3) return new Response('Topilmadi', { status: 404 });

  const [eventId, kind, photoId] = parts;
  if (kind !== 'p' && kind !== 't') return new Response('Topilmadi', { status: 404 });

  const inm = request.headers.get('if-none-match');
  const object = await env.PHOTOS.get(
    `e/${eventId}/${kind}/${photoId}`,
    inm ? { onlyIf: { etagDoesNotMatch: inm } } : undefined
  );

  if (!object) return new Response('Topilmadi', { status: 404 });
  if (!('body' in object)) return new Response(null, { status: 304 });

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  headers.set('cache-control', 'public, max-age=31536000, immutable');
  return new Response(object.body, { headers });
}
