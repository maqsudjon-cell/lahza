import qrcode from 'qrcode-generator';
import { readEvent } from '../../lib/store.js';

/**
 * GET /api/qr/:id — albom havolasining QR kodi, SVG ko'rinishida.
 *
 * SVG tanlangani bejiz emas: QR chop etiladi va A5 qog'ozda ham, katta
 * plakatda ham bir xil aniq chiqishi kerak. PNG kattalashtirilganda buziladi.
 */
export async function qrSvg(request, env, id) {
  const meta = await readEvent(env.PHOTOS, id);
  if (!meta) return new Response('Topilmadi', { status: 404 });

  const url = new URL(request.url);
  const target = `${url.origin}/e/?i=${meta.id}`;

  // Tuzatish darajasi Q: kod yuzasining ~25% shikastlansa ham o'qiladi.
  // To'yxonada qog'oz dog' bo'lishi yoki yorug'lik tushishi odatiy hol.
  const qr = qrcode(0, 'Q');
  qr.addData(target);
  qr.make();

  const count = qr.getModuleCount();
  const quiet = 2;
  const size  = count + quiet * 2;

  let path = '';
  for (let r = 0; r < count; r++) {
    for (let c = 0; c < count; c++) {
      if (qr.isDark(r, c)) path += `M${c + quiet} ${r + quiet}h1v1h-1z`;
    }
  }

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" ` +
    `shape-rendering="crispEdges" role="img" aria-label="Albom QR kodi">` +
    `<rect width="${size}" height="${size}" fill="#ffffff"/>` +
    `<path d="${path}" fill="#1A1A18"/></svg>`;

  return new Response(svg, {
    headers: {
      'content-type': 'image/svg+xml; charset=utf-8',
      'cache-control': 'public, max-age=86400',
    },
  });
}
