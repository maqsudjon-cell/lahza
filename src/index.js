/* ==========================================================================
   Lahza — Worker kirish nuqtasi.

   Statik fayllar `[assets]` orqali beriladi va ular Worker'gacha yetib
   kelmaydi. Bu yerga faqat mos keladigan fayl topilmagan so'rovlar tushadi —
   ya'ni API va rasm yo'llari.
   ========================================================================== */

import { err } from '../lib/store.js';
import { createEvent, getEvent } from './routes/event.js';
import { listPhotos } from './routes/photos.js';
import { uploadPhoto } from './routes/upload.js';
import { zipAlbum } from './routes/zip.js';
import { qrSvg } from './routes/qr.js';
import { serveFile } from './routes/file.js';
import { robots, sitemap } from './routes/seo.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const seg = url.pathname.split('/').filter(Boolean);
    const method = request.method;

    try {
      if (url.pathname === '/robots.txt')  return robots(request);
      if (url.pathname === '/sitemap.xml') return sitemap(request);

      // /f/{eventId}/{p|t}/{photoId}
      if (seg[0] === 'f' && seg.length === 4) {
        if (method !== 'GET' && method !== 'HEAD') return err('Faqat GET', 405);
        return await serveFile(request, env, {
          eventId: seg[1], kind: seg[2], photoId: seg[3],
        });
      }

      if (seg[0] === 'api') {
        const [, resource, id] = seg;

        if (resource === 'event' && seg.length === 2 && method === 'POST') {
          return await createEvent(request, env);
        }
        if (resource === 'event' && seg.length === 3 && method === 'GET') {
          return await getEvent(request, env, id);
        }
        if (resource === 'photos' && seg.length === 3 && method === 'GET') {
          return await listPhotos(request, env, id);
        }
        if (resource === 'upload' && seg.length === 3 && method === 'POST') {
          return await uploadPhoto(request, env, id);
        }
        if (resource === 'zip' && seg.length === 3 && method === 'GET') {
          return await zipAlbum(request, env, id);
        }
        if (resource === 'qr' && seg.length === 3 && method === 'GET') {
          return await qrSvg(request, env, id);
        }
        return err('Bunday manzil yo\'q', 404);
      }

      // Statik faylga ham, API'ga ham tushmadi.
      return env.ASSETS
        ? env.ASSETS.fetch(request)
        : new Response('Topilmadi', { status: 404 });
    } catch (e) {
      console.error('So\'rovda xatolik:', url.pathname, e);
      return err('Serverda xatolik', 500);
    }
  },
};
